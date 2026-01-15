#!/usr/bin/env python3
"""
Yahoo Finance Data Harvester for IDX Stocks (7-Day Chunking - Simple Version)
Downloads 1-minute intraday data using chunk & merge to bypass 7-day API limit

NOTE: This version lets yfinance handle anti-bot protection automatically.
No custom session needed - yfinance uses curl_cffi internally.

Requirements:
    pip install yfinance pandas

Usage:
    python harvest_yfinance.py --tickers BBCA.JK --days 7
"""

import os
import sys
import json
import time
import argparse
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Dict, Any
import yfinance as yf
import pandas as pd

# Default Indonesian stock tickers
DEFAULT_IDX_TICKERS = [
    'BBCA.JK',  # Bank Central Asia
    'BBRI.JK',  # Bank Rakyat Indonesia
    'TLKM.JK',  # Telkom Indonesia
    'GOTO.JK',  # GoTo Gojek Tokopedia
    'ANTM.JK',  # Aneka Tambang
    'ASII.JK',  # Astra International
]

# Output directory
SCRIPT_DIR = Path(__file__).parent
OUTPUT_DIR = SCRIPT_DIR.parent / "public" / "simulation-data"
OUTPUT_DIR.mkdir(exist_ok=True, parents=True)


def download_intraday_chunked(
    ticker: str,
    total_days: int = 28,
    interval: str = '1m'
) -> pd.DataFrame:
    """
    Download intraday data in 7-day chunks and merge
    
    Args:
        ticker: Stock symbol (e.g., 'BBCA.JK')
        total_days: Total days to download (must be multiple of 7)
        interval: Data interval ('1m', '5m', etc.)
    
    Returns:
        Merged DataFrame with all data
    """
    print(f"\n{'='*60}")
    print(f"📥 Downloading {ticker} ({interval} interval, {total_days} days)")
    print(f"   Strategy: Chunked download (7-day windows)")
    print(f"{'='*60}")
    
    chunk_size_days = 7
    num_chunks = total_days // chunk_size_days
    all_data_chunks = []
    
    try:
        # Loop through each 7-day chunk
        for i in range(num_chunks):
            end_date = datetime.now() - timedelta(days=i * chunk_size_days)
            start_date = end_date - timedelta(days=chunk_size_days)
            
            start_str = start_date.strftime('%Y-%m-%d')
            end_str = end_date.strftime('%Y-%m-%d')
            
            print(f"\n  📦 Chunk {i+1}/{num_chunks}: {start_str} to {end_str}")
            
            try:
                # Use yf.download (simpler, handles anti-bot automatically)
                df_chunk = yf.download(
                    ticker,
                    start=start_str,
                    end=end_str,
                    interval=interval,
                    progress=False,  # Disable progress bar for cleaner output
                    auto_adjust=True
                )
                
                if not df_chunk.empty:
                    print(f"     ✅ Got {len(df_chunk)} candles")
                    all_data_chunks.append(df_chunk)
                else:
                    print(f"     ⚠️  No data for this chunk")
                
            except Exception as e:
                print(f"     ❌ Error: {e}")
                continue
            
            # Polite delay
            if i < num_chunks - 1:
                print(f"     ⏳ Waiting 1s...")
                time.sleep(1)
        
        # Merge chunks
        if not all_data_chunks:
            print(f"\n❌ No data retrieved for {ticker}")
            return pd.DataFrame()
        
        print(f"\n  🔗 Merging {len(all_data_chunks)} chunks...")
        df_merged = pd.concat(all_data_chunks)
        
        # Remove duplicates
        original_len = len(df_merged)
        df_merged = df_merged[~df_merged.index.duplicated(keep='first')]
        duplicates_removed = original_len - len(df_merged)
        
        if duplicates_removed > 0:
            print(f"  🧹 Removed {duplicates_removed} duplicates")
        
        # Sort by time
        df_merged = df_merged.sort_index()
        
        print(f"\n✅ Final dataset: {len(df_merged)} candles")
        print(f"   Date range: {df_merged.index[0]} → {df_merged.index[-1]}")
        
        return df_merged
        
    except Exception as e:
        print(f"\n❌ Error downloading {ticker}: {e}")
        return pd.DataFrame()


def process_and_save_by_day(ticker: str, df: pd.DataFrame) -> int:
    """
    Process merged DataFrame and save one JSON file per trading day
    """
    if df.empty:
        return 0
    
    df['date'] = df.index.date
    grouped = df.groupby('date')
    
    files_saved = 0
    clean_ticker = ticker.replace('.JK', '').replace('.', '_')
    
    print(f"\n  💾 Saving daily JSON files...")
    
    for date, day_df in grouped:
        candles = []
        for idx, row in day_df.iterrows():
            # Handle both single-ticker and multi-ticker column formats
            try:
                open_val = row['Open'] if 'Open' in row else row[('Open', ticker)]
                high_val = row['High'] if 'High' in row else row[('High', ticker)]
                low_val = row['Low'] if 'Low' in row else row[('Low', ticker)]
                close_val = row['Close'] if 'Close' in row else row[('Close', ticker)]
                volume_val = row['Volume'] if 'Volume' in row else row[('Volume', ticker)]
            except:
                # Fallback: try direct access
                open_val = row.get('Open', row.iloc[0])
                high_val = row.get('High', row.iloc[1])
                low_val = row.get('Low', row.iloc[2])
                close_val = row.get('Close', row.iloc[3])
                volume_val = row.get('Volume', row.iloc[4])
            
            candle = {
                'time': idx.strftime('%H:%M'),
                'open': round(float(open_val), 2),
                'high': round(float(high_val), 2),
                'low': round(float(low_val), 2),
                'close': round(float(close_val), 2),
                'volume': int(volume_val)
            }
            candles.append(candle)
        
        filename = OUTPUT_DIR / f"{clean_ticker}_{date}.json"
        with open(filename, 'w') as f:
            json.dump(candles, f, indent=2)
        
        print(f"     {filename.name} ({len(candles)} candles)")
        files_saved += 1
    
    return files_saved


def clean_old_files(ticker: str = None):
    """Clean old JSON files"""
    if ticker:
        clean_ticker = ticker.replace('.JK', '').replace('.', '_')
        pattern = f"{clean_ticker}_*.json"
    else:
        pattern = "*.json"
    
    deleted = 0
    for file in OUTPUT_DIR.glob(pattern):
        file.unlink()
        deleted += 1
    
    if deleted > 0:
        print(f"\n🗑️  Cleaned {deleted} old file(s)")


def main():
    parser = argparse.ArgumentParser(
        description='Yahoo Finance IDX Stock Harvester (7-Day Chunking)'
    )
    
    parser.add_argument(
        '--tickers',
        nargs='+',
        default=DEFAULT_IDX_TICKERS,
        help='Ticker symbols'
    )
    parser.add_argument(
        '--days',
        type=int,
        default=28,
        help='Total days to download (must be multiple of 7, default: 28)'
    )
    parser.add_argument(
        '--interval',
        type=str,
        default='1m',
        choices=['1m', '5m', '15m', '30m', '60m'],
        help='Data interval (default: 1m)'
    )
    parser.add_argument(
        '--clean',
        action='store_true',
        help='Clean old files before downloading'
    )
    parser.add_argument(
        '--delay',
        type=float,
        default=2.0,
        help='Delay in seconds between tickers (default: 2.0)'
    )
    
    args = parser.parse_args()
    
    if args.days % 7 != 0:
        print(f"❌ Error: --days must be a multiple of 7 (got {args.days})")
        sys.exit(1)
    
    print(f"\n🚀 Yahoo Finance IDX Stock Harvester")
    print(f"{'='*60}")
    print(f"📊 Tickers: {', '.join(args.tickers)}")
    print(f"⏱️  Interval: {args.interval}")
    print(f"📅 Days: {args.days} (in {args.days//7} × 7-day chunks)")
    print(f"📁 Output: {OUTPUT_DIR}")
    print(f"{'='*60}\n")
    
    if args.clean:
        clean_old_files()
    
    total_files = 0
    successful = 0
    failed = 0
    
    for i, ticker in enumerate(args.tickers):
        try:
            if i > 0:
                print(f"\n⏳ Waiting {args.delay}s...")
                time.sleep(args.delay)
            
            df = download_intraday_chunked(ticker, args.days, args.interval)
            
            if not df.empty:
                files_saved = process_and_save_by_day(ticker, df)
                total_files += files_saved
                successful += 1
            else:
                print(f"⚠️  Skipping {ticker} (no data)")
                failed += 1
                
        except KeyboardInterrupt:
            print(f"\n\n⚠️  Interrupted by user")
            break
        except Exception as e:
            print(f"\n❌ Error: {e}")
            failed += 1
            continue
    
    print(f"\n\n{'='*60}")
    print(f"📊 HARVEST COMPLETE")
    print(f"{'='*60}")
    print(f"✅ Successful: {successful}")
    if failed > 0:
        print(f"❌ Failed: {failed}")
    print(f"📄 Total files: {total_files}")
    print(f"📁 Output: {OUTPUT_DIR}")
    print(f"{'='*60}\n")


if __name__ == '__main__':
    main()
