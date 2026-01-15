#!/usr/bin/env python3
"""
Yahoo Finance Data Harvester for IDX Stocks (Multi-Interval)
Downloads intraday data with optimized lookback periods:
- 1m  : Max 30 days
- 2m, 5m, 15m, 30m : Max 60 days
- 60m : Max 730 days (2 years)

Usage:
    python harvest_yfinance.py --tickers BBCA.JK ASII.JK --auto
"""

import os
import sys
import json
import time
import argparse
from pathlib import Path
from datetime import datetime, timedelta
import yfinance as yf
import pandas as pd

# Default Indonesian stock tickers (LQ45 / Major Liquid Stocks)
DEFAULT_IDX_TICKERS = [
    # Banks
    'BBCA.JK', 'BBRI.JK', 'BMRI.JK', 'BBNI.JK', 'BRIS.JK',
    # Telco & Tech
    'TLKM.JK', 'GOTO.JK', 'ISAT.JK', 'EXCL.JK',
    # Consumer & Retail
    'ICBP.JK', 'INDF.JK', 'UNVR.JK', 'AMRT.JK', 'MAPI.JK',
    # Mining & Energy
    'ASII.JK', 'ADRO.JK', 'PTBA.JK', 'PGAS.JK', 'AKRA.JK',
    'ANTM.JK', 'INCO.JK', 'MDKA.JK', 'MEDC.JK',
    # Infrastructure & Others
    'JSMR.JK', 'UNTR.JK', 'SMGR.JK', 'CPIN.JK', 'KLBF.JK'
]

# Output directory
SCRIPT_DIR = Path(__file__).parent
OUTPUT_DIR = SCRIPT_DIR.parent / "public" / "simulation-data"
OUTPUT_DIR.mkdir(exist_ok=True, parents=True)

# Configuration for limits
INTERVAL_CONFIG = {
    '1m': {'days': 29, 'chunk': 7},
    '2m': {'days': 59, 'chunk': 28},
    '5m': {'days': 59, 'chunk': 28},
    '15m': {'days': 59, 'chunk': 28},
    '30m': {'days': 59, 'chunk': 28},
    '60m': {'days': 729, 'chunk': 28},
}

def download_intraday_chunked(ticker, interval, total_days):
    print(f"\n{'='*60}")
    print(f"📥 Downloading {ticker} ({interval} interval, {total_days} days)")
    print(f"{'='*60}")
    
    config = INTERVAL_CONFIG.get(interval, {'days': 59, 'chunk': 7})
    chunk_size = config['chunk']
    
    # Cap total_days to max allowed
    if total_days > config['days']:
        print(f"   ⚠️ Limit: capped to {config['days']} days for {interval}")
        total_days = config['days']

    all_data_chunks = []
    num_chunks = (total_days // chunk_size) + 1
    
    try:
        for i in range(num_chunks):
            end_date = datetime.now() - timedelta(days=i * chunk_size)
            start_date = end_date - timedelta(days=chunk_size)
            
            # Ensure we don't go into future (unlikely but safe)
            if start_date > datetime.now(): continue
            
            start_str = start_date.strftime('%Y-%m-%d')
            end_str = end_date.strftime('%Y-%m-%d')
            
            print(f"  📦 Chunk {i+1}/{num_chunks}: {start_str} to {end_str}")
            
            try:
                df_chunk = yf.download(
                    ticker,
                    start=start_str,
                    end=end_str,
                    interval=interval,
                    progress=False,
                    auto_adjust=True,
                    multi_level_index=False # Simplify columns
                )
                
                if not df_chunk.empty:
                    print(f"     ✅ Got {len(df_chunk)} candles")
                    all_data_chunks.append(df_chunk)
                else:
                    print(f"     ⚠️  No data")
                
            except Exception as e:
                print(f"     ❌ Error: {e}")
            
            # Rate limit polite delay
            time.sleep(1)

        if not all_data_chunks:
            return pd.DataFrame()

        print(f"\n  🔗 Merging {len(all_data_chunks)} chunks...")
        df_merged = pd.concat(all_data_chunks)
        df_merged = df_merged[~df_merged.index.duplicated(keep='first')]
        df_merged = df_merged.sort_index()
        
        return df_merged
        
    except Exception as e:
        print(f"❌ Critical Error: {e}")
        return pd.DataFrame()

def process_and_save(ticker, df, interval):
    if df.empty: return 0
    
    df['date'] = df.index.date
    grouped = df.groupby('date')
    clean_ticker = ticker.replace('.JK', '').replace('.', '_')
    files_saved = 0
    
    print(f"  💾 Saving JSON files for {interval}...")
    
    for date, day_df in grouped:
        candles = []
        for idx, row in day_df.iterrows():
            candle = {
                'time': idx.strftime('%H:%M'),
                'open': round(float(row.get('Open', 0)), 2),
                'high': round(float(row.get('High', 0)), 2),
                'low': round(float(row.get('Low', 0)), 2),
                'close': round(float(row.get('Close', 0)), 2),
                'volume': int(row.get('Volume', 0))
            }
            candles.append(candle)
        
        # New Filename Format: TICKER_INTERVAL_DATE.json 
        # e.g., BBCA_1m_2026-01-08.json
        # NOTE: For backward compatibility, 1m can stay as default format or change?
        # Let's use new format for ALL to verify frontend logic later.
        filename = OUTPUT_DIR / f"{clean_ticker}_{interval}_{date}.json"
        
        with open(filename, 'w') as f:
            json.dump(candles, f, indent=0) # Compact
            
        files_saved += 1
        
    print(f"     ✅ Saved {files_saved} files for {interval}")
    return files_saved

def main():
    parser = argparse.ArgumentParser(description='Multi-Interval Harvester')
    parser.add_argument('--tickers', nargs='+', default=DEFAULT_IDX_TICKERS)
    parser.add_argument('--auto', action='store_true', help='Download ALL intervals with max history')
    parser.add_argument('--interval', type=str, help='Specific interval (1m, 2m, 5m...)')
    parser.add_argument('--days', type=int, default=30)
    args = parser.parse_args()
    
    intervals  = []
    if args.auto:
        intervals = ['1m', '2m', '5m', '15m', '30m', '60m']
    elif args.interval:
        intervals = [args.interval]
    else:
        intervals = ['1m'] # Default

    print(f"\n🚀 Yahoo Finance Harvester (Multi-Interval)")
    print(f"Target Intervals: {intervals}")
    
    total_files = 0
    
    for ticker in args.tickers:
        for interval in intervals:
            # Determine days based on interval limit if --auto
            days = INTERVAL_CONFIG[interval]['days'] if args.auto else args.days
            
            df = download_intraday_chunked(ticker, interval, days)
            if not df.empty:
                total_files += process_and_save(ticker, df, interval)
            
            time.sleep(2) # Delay between intervals

    print(f"\n🎉 DONE! Total files: {total_files}")

if __name__ == '__main__':
    main()
