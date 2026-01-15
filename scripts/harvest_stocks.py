#!/usr/bin/env python3
"""
Smart yfinance Harvester with Incremental Update
Downloads 30 days of 1m data in 7-day chunks, supports incremental updates

Features:
- 30-day download via 4×7-day chunks (bypasses Yahoo limit)
- Single JSON file per stock (BBCA_full_30days.json)
- Incremental update: only downloads new data if file exists
- Auto-merge and deduplication

Requirements:
    pip install yfinance pandas

Usage:
    # First run (downloads full 30 days)
    python harvest_stocks.py

    # Subsequent runs (only downloads new data since last run)
    python harvest_stocks.py
"""

import os
import sys
import json
import time
import argparse
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import yfinance as yf
import pandas as pd

# Configuration
DEFAULT_IDX_TICKERS = [
    'BBCA.JK',  # Bank Central Asia
    'BBRI.JK',  # Bank Rakyat Indonesia
    'TLKM.JK',  # Telkom Indonesia
    'GOTO.JK',  # GoTo Gojek Tokopedia
    'ANTM.JK',  # Aneka Tambang
    'ASII.JK',  # Astra International
]

SCRIPT_DIR = Path(__file__).parent
OUTPUT_DIR = SCRIPT_DIR.parent / "public" / "simulation-data"
OUTPUT_DIR.mkdir(exist_ok=True, parents=True)

CHUNK_SIZE_DAYS = 7
TOTAL_DAYS = 28  # 4 weeks = 4 × 7-day chunks


def load_existing_data(filepath: Path) -> Optional[Dict]:
    """
    Load existing JSON file and extract metadata
    
    Returns:
        dict with 'data' (list) and 'last_timestamp' (datetime) or None
    """
    if not filepath.exists():
        return None
    
    try:
        with open(filepath, 'r') as f:
            data = json.load(f)
        
        if not data:
            return None
        
        # Parse last timestamp
        last_time_str = data[-1]['time']
        last_timestamp = datetime.strptime(last_time_str, '%Y-%m-%d %H:%M:%S')
        
        print(f"  📂 Found existing file: {len(data)} candles")
        print(f"  📅 Last timestamp: {last_timestamp}")
        
        return {
            'data': data,
            'last_timestamp': last_timestamp
        }
    except Exception as e:
        print(f"  ⚠️  Error reading existing file: {e}")
        return None


def download_chunk(ticker: str, start_date: datetime, end_date: datetime, interval: str = '1m') -> pd.DataFrame:
    """
    Download a single 7-day chunk
    
    Args:
        ticker: Stock symbol
        start_date: Start datetime
        end_date: End datetime
        interval: Data interval
    
    Returns:
        DataFrame with OHLCV data
    """
    start_str = start_date.strftime('%Y-%m-%d')
    end_str = end_date.strftime('%Y-%m-%d')
    
    try:
        df = yf.download(
            ticker,
            start=start_str,
            end=end_str,
            interval=interval,
            progress=False,
            auto_adjust=True
        )
        
        if not df.empty:
            print(f"     ✅ {len(df)} candles")
            return df
        else:
            print(f"     ⚠️  No data")
            return pd.DataFrame()
            
    except Exception as e:
        print(f"     ❌ Error: {e}")
        return pd.DataFrame()


def download_full_range(ticker: str, days: int, interval: str = '1m') -> pd.DataFrame:
    """
    Download full date range using 7-day chunking
    
    Args:
        ticker: Stock symbol
        days: Total days to download (must be multiple of 7)
        interval: Data interval
    
    Returns:
        Merged DataFrame
    """
    print(f"\n  🔄 Downloading {days} days in {days//CHUNK_SIZE_DAYS} chunks...")
    
    num_chunks = days // CHUNK_SIZE_DAYS
    all_chunks = []
    
    for i in range(num_chunks):
        end_date = datetime.now() - timedelta(days=i * CHUNK_SIZE_DAYS)
        start_date = end_date - timedelta(days=CHUNK_SIZE_DAYS)
        
        print(f"  📦 Chunk {i+1}/{num_chunks}: {start_date.date()} → {end_date.date()}")
        
        df_chunk = download_chunk(ticker, start_date, end_date, interval)
        
        if not df_chunk.empty:
            all_chunks.append(df_chunk)
        
        # Polite delay between chunks
        if i < num_chunks - 1:
            time.sleep(2)
    
    if not all_chunks:
        print(f"  ❌ No data retrieved")
        return pd.DataFrame()
    
    # Merge all chunks
    print(f"\n  🔗 Merging {len(all_chunks)} chunks...")
    df_merged = pd.concat(all_chunks)
    
    # Remove duplicates
    original_len = len(df_merged)
    df_merged = df_merged[~df_merged.index.duplicated(keep='first')]
    
    if original_len - len(df_merged) > 0:
        print(f"  🧹 Removed {original_len - len(df_merged)} duplicates")
    
    # Sort by time
    df_merged = df_merged.sort_index()
    
    return df_merged


def download_incremental(ticker: str, last_timestamp: datetime, interval: str = '1m') -> pd.DataFrame:
    """
    Download only new data since last_timestamp
    
    Args:
        ticker: Stock symbol
        last_timestamp: Last known timestamp
        interval: Data interval
    
    Returns:
        DataFrame with new data only
    """
    start_date = last_timestamp + timedelta(minutes=1)  # Start from next minute
    end_date = datetime.now()
    
    days_diff = (end_date - start_date).days
    
    if days_diff <= 0:
        print(f"  ℹ️  Data is already up-to-date")
        return pd.DataFrame()
    
    print(f"\n  ⚡ Incremental update: {days_diff} days")
    
    # If less than 7 days, download directly
    if days_diff <= CHUNK_SIZE_DAYS:
        print(f"  📦 Single chunk: {start_date.date()} → {end_date.date()}")
        return download_chunk(ticker, start_date, end_date, interval)
    
    # Otherwise, use chunking
    num_chunks = (days_diff // CHUNK_SIZE_DAYS) + 1
    all_chunks = []
    
    for i in range(num_chunks):
        chunk_start = start_date + timedelta(days=i * CHUNK_SIZE_DAYS)
        chunk_end = min(chunk_start + timedelta(days=CHUNK_SIZE_DAYS), end_date)
        
        print(f"  📦 Chunk {i+1}/{num_chunks}: {chunk_start.date()} → {chunk_end.date()}")
        
        df_chunk = download_chunk(ticker, chunk_start, chunk_end, interval)
        
        if not df_chunk.empty:
            all_chunks.append(df_chunk)
        
        if i < num_chunks - 1:
            time.sleep(2)
    
    if not all_chunks:
        return pd.DataFrame()
    
    df_merged = pd.concat(all_chunks)
    df_merged = df_merged[~df_merged.index.duplicated(keep='first')]
    df_merged = df_merged.sort_index()
    
    return df_merged


def dataframe_to_json_array(df: pd.DataFrame, ticker: str) -> List[Dict]:
    """
    Convert DataFrame to JSON array format
    
    Args:
        df: DataFrame with OHLCV data
        ticker: Stock symbol (for column handling)
    
    Returns:
        List of candle dictionaries
    """
    candles = []
    
    for idx, row in df.iterrows():
        # Handle different DataFrame column formats
        try:
            open_val = row['Open'] if 'Open' in row else row[('Open', ticker)]
            high_val = row['High'] if 'High' in row else row[('High', ticker)]
            low_val = row['Low'] if 'Low' in row else row[('Low', ticker)]
            close_val = row['Close'] if 'Close' in row else row[('Close', ticker)]
            volume_val = row['Volume'] if 'Volume' in row else row[('Volume', ticker)]
        except:
            open_val = row.iloc[0]
            high_val = row.iloc[1]
            low_val = row.iloc[2]
            close_val = row.iloc[3]
            volume_val = row.iloc[4]
        
        candle = {
            'time': idx.strftime('%Y-%m-%d %H:%M:%S'),  # Full timestamp
            'open': round(float(open_val), 2),
            'high': round(float(high_val), 2),
            'low': round(float(low_val), 2),
            'close': round(float(close_val), 2),
            'volume': int(volume_val)
        }
        candles.append(candle)
    
    return candles


def process_ticker(ticker: str, interval: str = '1m', force_full: bool = False) -> int:
    """
    Main processing logic for a ticker (with incremental update support)
    
    Args:
        ticker: Stock symbol
        interval: Data interval
        force_full: Force full download even if file exists
    
    Returns:
        Number of candles in final file
    """
    print(f"\n{'='*60}")
    print(f"📊 Processing: {ticker}")
    print(f"{'='*60}")
    
    clean_ticker = ticker.replace('.JK', '').replace('.', '_')
    filepath = OUTPUT_DIR / f"{clean_ticker}_full_30days.json"
    
    # Check for existing data
    existing = None if force_full else load_existing_data(filepath)
    
    if existing:
        # INCREMENTAL UPDATE MODE
        print(f"  🔄 Mode: Incremental Update")
        
        df_new = download_incremental(ticker, existing['last_timestamp'], interval)
        
        if df_new.empty:
            print(f"  ✅ Already up-to-date ({len(existing['data'])} candles)")
            return len(existing['data'])
        
        # Merge new data with existing
        print(f"\n  🔗 Merging new data with existing...")
        new_candles = dataframe_to_json_array(df_new, ticker)
        
        # Combine and deduplicate
        all_candles = existing['data'] + new_candles
        
        # Remove duplicates by time
        seen_times = set()
        unique_candles = []
        for candle in all_candles:
            if candle['time'] not in seen_times:
                seen_times.add(candle['time'])
                unique_candles.append(candle)
        
        # Sort by time
        unique_candles.sort(key=lambda x: x['time'])
        
        print(f"  📊 Total candles: {len(unique_candles)} (added {len(new_candles)} new)")
        
    else:
        # FULL DOWNLOAD MODE
        print(f"  🔄 Mode: Full Download (30 days)")
        
        df_full = download_full_range(ticker, TOTAL_DAYS, interval)
        
        if df_full.empty:
            print(f"  ❌ Failed to download data")
            return 0
        
        unique_candles = dataframe_to_json_array(df_full, ticker)
        print(f"  📊 Total candles: {len(unique_candles)}")
    
    # Save to file
    print(f"\n  💾 Saving: {filepath.name}")
    with open(filepath, 'w') as f:
        json.dump(unique_candles, f, indent=2)
    
    print(f"  ✅ Saved successfully")
    
    return len(unique_candles)


def main():
    parser = argparse.ArgumentParser(
        description='Smart yfinance Harvester with Incremental Update'
    )
    
    parser.add_argument(
        '--tickers',
        nargs='+',
        default=DEFAULT_IDX_TICKERS,
        help='Ticker symbols'
    )
    parser.add_argument(
        '--interval',
        type=str,
        default='1m',
        choices=['1m', '5m', '15m', '30m', '60m'],
        help='Data interval (default: 1m)'
    )
    parser.add_argument(
        '--force-full',
        action='store_true',
        help='Force full download even if file exists'
    )
    parser.add_argument(
        '--delay',
        type=float,
        default=3.0,
        help='Delay between tickers in seconds (default: 3.0)'
    )
    
    args = parser.parse_args()
    
    print(f"\n🚀 Smart yfinance Harvester")
    print(f"{'='*60}")
    print(f"📊 Tickers: {', '.join(args.tickers)}")
    print(f"⏱️  Interval: {args.interval}")
    print(f"📁 Output: {OUTPUT_DIR}")
    print(f"🔄 Mode: {'FORCE FULL' if args.force_full else 'INCREMENTAL'}")
    print(f"{'='*60}")
    
    successful = 0
    failed = 0
    total_candles = 0
    
    for i, ticker in enumerate(args.tickers):
        try:
            if i > 0:
                print(f"\n⏳ Waiting {args.delay}s...")
                time.sleep(args.delay)
            
            candle_count = process_ticker(ticker, args.interval, args.force_full)
            
            if candle_count > 0:
                successful += 1
                total_candles += candle_count
            else:
                failed += 1
                
        except KeyboardInterrupt:
            print(f"\n\n⚠️  Interrupted by user")
            break
        except Exception as e:
            print(f"\n❌ Error: {e}")
            failed += 1
            continue
    
    # Summary
    print(f"\n\n{'='*60}")
    print(f"📊 HARVEST COMPLETE")
    print(f"{'='*60}")
    print(f"✅ Successful: {successful} tickers")
    if failed > 0:
        print(f"❌ Failed: {failed} tickers")
    print(f"📊 Total candles across all stocks: {total_candles:,}")
    print(f"📁 Output: {OUTPUT_DIR}")
    print(f"{'='*60}\n")


if __name__ == '__main__':
    main()
