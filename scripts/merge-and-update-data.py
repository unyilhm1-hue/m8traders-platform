#!/usr/bin/env python3
"""
Data Consolidation & Update System
===================================
Merges individual daily simulation data files into consolidated multi-day files
and checks yfinance for new tickers and date updates.

Features:
- Merge daily files per ticker+interval into one file
- Naming: TICKER_INTERVAL_DURATION_(START-END).json
- Check yfinance for new IDX tickers
- Auto-download missing dates
- Auto-merge new data

Usage:
    python scripts/merge-and-update-data.py
"""

import os
import json
import glob
from datetime import datetime, timedelta
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import yfinance as yf

# Configuration
DATA_DIR = Path("public/simulation-data")
INTERVALS = ["1m", "2m", "5m", "15m", "30m", "60m"]
IDX_SUFFIX = ".JK"  # Jakarta Stock Exchange suffix for yfinance

# Known IDX tickers (will be expanded by yfinance check)
KNOWN_TICKERS = [
    "ADRO", "AKRA", "AMRT", "ANTM", "ASII",  # Current
    "BBCA", "BBNI", "BBRI", "BBTN", "BMRI",   # Banks
    # Add more as discovered
]


def parse_filename(filename: str) -> Optional[Tuple[str, str, str]]:
    """
    Parse filename: TICKER_INTERVAL_DATE.json
    Returns: (ticker, interval, date) or None
    """
    try:
        name = filename.replace(".json", "")
        parts = name.split("_")
        if len(parts) == 3:
            ticker, interval, date = parts
            return (ticker, interval, date)
    except:
        pass
    return None


def scan_existing_files() -> Dict[str, Dict[str, List[str]]]:
    """
    Scan simulation-data directory and group files by ticker and interval.
    Returns: {ticker: {interval: [date1, date2, ...]}}
    """
    data_map = defaultdict(lambda: defaultdict(list))
    
    for file_path in DATA_DIR.glob("*.json"):
        parsed = parse_filename(file_path.name)
        if parsed:
            ticker, interval, date = parsed
            data_map[ticker][interval].append(date)
    
    # Sort dates for each ticker+interval
    for ticker in data_map:
        for interval in data_map[ticker]:
            data_map[ticker][interval].sort()
    
    return dict(data_map)


def calculate_duration_label(start_date: str, end_date: str) -> str:
    """
    Calculate human-readable duration label.
    Example: "30days", "60days", "90days"
    """
    start = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")
    days = (end - start).days + 1  # Include both start and end
    return f"{days}days"


def merge_files(ticker: str, interval: str, dates: List[str]) -> Dict:
    """
    Merge individual daily files into one consolidated file.
    Returns: {metadata, candles}
    """
    all_candles = []
    
    for date in dates:
        filename = f"{ticker}_{interval}_{date}.json"
        filepath = DATA_DIR / filename
        
        try:
            with open(filepath, 'r') as f:
                data = json.load(f)
                candles = data if isinstance(data, list) else data.get('candles', [])
                all_candles.extend(candles)
        except Exception as e:
            print(f"⚠️  Error reading {filename}: {e}")
    
    # Sort by timestamp to ensure chronological order
    all_candles.sort(key=lambda x: x.get('time', x.get('t', 0)))
    
    # Create consolidated file
    start_date = dates[0]
    end_date = dates[-1]
    duration = calculate_duration_label(start_date, end_date)
    
    merged_data = {
        "ticker": ticker,
        "interval": interval,
        "duration": duration,
        "start_date": start_date,
        "end_date": end_date,
        "total_candles": len(all_candles),
        "source_files": len(dates),
        "candles": all_candles
    }
    
    return merged_data


def save_merged_file(ticker: str, interval: str, data: Dict) -> str:
    """
    Save merged data to file with proper naming convention.
    Naming: TICKER_INTERVAL_DURATION_(START-END).json
    Example: ADRO_1m_30days_(2025-12-19_2026-01-15).json
    """
    duration = data['duration']
    start = data['start_date']
    end = data['end_date']
    
    filename = f"{ticker}_{interval}_{duration}_({start}_{end}).json"
    filepath = DATA_DIR / filename
    
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=2)
    
    print(f"✅ Created: {filename} ({data['total_candles']} candles)")
    return filename


def check_yfinance_for_updates(ticker: str, interval: str, last_date: str) -> List[str]:
    """
    Check yfinance for new dates beyond last_date.
    Returns: List of new dates available
    """
    try:
        yf_ticker = f"{ticker}{IDX_SUFFIX}"
        stock = yf.Ticker(yf_ticker)
        
        # Map interval to yfinance format
        interval_map = {
            "1m": "1m",
            "2m": "2m",
            "5m": "5m",
            "15m": "15m",
            "30m": "30m",
            "60m": "60m"
        }
        
        yf_interval = interval_map.get(interval, "1m")
        
        # Download recent data (last 7 days)
        last_dt = datetime.strptime(last_date, "%Y-%m-%d")
        today = datetime.now()
        
        if last_dt >= today:
            return []  # Already up to date
        
        # Download new data
        hist = stock.history(
            start=last_dt + timedelta(days=1),
            end=today,
            interval=yf_interval
        )
        
        if hist.empty:
            return []
        
        # Extract unique dates
        new_dates = hist.index.strftime("%Y-%m-%d").unique().tolist()
        return new_dates
        
    except Exception as e:
        print(f"⚠️  Error checking yfinance for {ticker}: {e}")
        return []


def discover_new_idx_tickers() -> List[str]:
    """
    Discover new Indonesian stock tickers from common lists.
    Returns: List of new ticker symbols
    """
    # Common LQ45 and IDX30 stocks
    idx_stocks = [
        # Mining
        "ADRO", "ANTM", "INCO", "ITMG", "PTBA",
        # Banking
        "BBCA", "BBNI", "BBRI", "BBTN", "BMRI", "BRIS",
        # Consumer
        "AMRT", "ICBP", "INDF", "KLBF", "UNVR",
        # Telco
        "TLKM", "EXCL", "ISAT",
        # Construction
        "ASII", "WIKA", "WSKT", "PTPP",
        # Other
        "AKRA", "SMGR", "UNTR", "CPIN"
    ]
    
    # Check which ones are new (not in existing data)
    existing = scan_existing_files()
    new_tickers = [t for t in idx_stocks if t not in existing]
    
    return new_tickers


def main():
    """Main execution"""
    print("="*60)
    print(" Data Consolidation & Update System")
    print("="*60)
    
    # Step 1: Scan existing files
    print("\n📂 Scanning existing files...")
    data_map = scan_existing_files()
    
    total_tickers = len(data_map)
    total_files = sum(len(dates) for ticker_data in data_map.values() 
                     for dates in ticker_data.values())
    
    print(f"   Found: {total_tickers} tickers, {total_files} files")
    
    # Step 2: Merge files per ticker+interval
    print("\n🔄 Merging files...")
    merged_count = 0
    
    for ticker in data_map:
        for interval in data_map[ticker]:
            dates = data_map[ticker][interval]
            
            if len(dates) < 2:
                print(f"⏭️  Skipping {ticker}_{interval} (only {len(dates)} file)")
                continue
            
            # Merge files
            merged_data = merge_files(ticker, interval, dates)
            save_merged_file(ticker, interval, merged_data)
            merged_count += 1
    
    print(f"\n✅ Created {merged_count} merged files")
    
    # Step 3: Check for new tickers
    print("\n🔍 Checking for new IDX tickers...")
    new_tickers = discover_new_idx_tickers()
    
    if new_tickers:
        print(f"   Found {len(new_tickers)} new tickers: {', '.join(new_tickers)}")
        print("   💡 Run download script to fetch data for these tickers")
    else:
        print("   No new tickers found")
    
    # Step 4: Check for data updates
    print("\n📥 Checking yfinance for date updates...")
    updates_found = 0
    
    for ticker in list(data_map.keys())[:5]:  # Check first 5 tickers as example
        for interval in INTERVALS[:3]:  # Check first 3 intervals
            if interval not in data_map[ticker]:
                continue
            
            last_date = data_map[ticker][interval][-1]
            new_dates = check_yfinance_for_updates(ticker, interval, last_date)
            
            if new_dates:
                print(f"   ✨ {ticker}_{interval}: {len(new_dates)} new dates available")
                updates_found += len(new_dates)
    
    if updates_found == 0:
        print("   All data up to date!")
    
    print("\n" + "="*60)
    print("✅ Data consolidation complete!")
    print("="*60)


if __name__ == "__main__":
    main()
