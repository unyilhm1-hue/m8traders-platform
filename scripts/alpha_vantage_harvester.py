#!/usr/bin/env python3
"""
Alpha Vantage IDX Stock Data Harvester
Downloads 1-minute intraday data for Indonesian stocks (2025)

Requirements:
    pip install requests pandas python-dotenv

Usage:
    # Download all default IDX stocks
    python alpha_vantage_harvester.py

    # Download specific tickers
    python alpha_vantage_harvester.py --tickers BBCA.JK BBRI.JK

    # Test mode (single ticker, limited slices)
    python alpha_vantage_harvester.py --test --ticker BBCA.JK
"""

import os
import sys
import time
import json
import argparse
import requests
from typing import List, Dict, Any, Optional
from datetime import datetime
from pathlib import Path

# Default Indonesian stock tickers
DEFAULT_IDX_TICKERS = [
    'BBCA.JK',  # Bank Central Asia
    'BBRI.JK',  # Bank Rakyat Indonesia
    'TLKM.JK',  # Telkom Indonesia
    'GOTO.JK',  # GoTo Gojek Tokopedia
    'ANTM.JK',  # Aneka Tambang
    'ASII.JK',  # Astra International
]

# Alpha Vantage configuration
ALPHA_VANTAGE_BASE_URL = "https://www.alphavantage.co/query"
RATE_LIMIT_DELAY = 15  # seconds between requests (conservative for 5/min limit)
RETRY_DELAY = 60       # seconds to wait on rate limit error
MAX_RETRIES = 3

# Data paths
SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR.parent / "data"
DATA_DIR.mkdir(exist_ok=True)


class AlphaVantageHarvester:
    """Harvester for Alpha Vantage intraday data with rate limiting"""

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.session = requests.Session()
        self.request_count = 0
        self.start_time = time.time()

    def _wait_for_rate_limit(self):
        """Smart sleep to respect rate limits (5 req/min)"""
        self.request_count += 1
        
        # Log progress
        elapsed = time.time() - self.start_time
        print(f"  ⏱️  Request #{self.request_count} | Elapsed: {int(elapsed)}s")
        
        # Sleep between requests
        time.sleep(RATE_LIMIT_DELAY)

    def _fetch_slice(
        self, 
        ticker: str, 
        interval: str, 
        slice_name: str,
        retry_count: int = 0
    ) -> Optional[str]:
        """
        Fetch a single slice of intraday data
        
        Args:
            ticker: Stock symbol (e.g., 'BBCA.JK')
            interval: '1min' or '5min'
            slice_name: e.g., 'year1month1', 'year1month2'
            retry_count: Current retry attempt
            
        Returns:
            CSV text or None on error
        """
        params = {
            'function': 'TIME_SERIES_INTRADAY_EXTENDED',
            'symbol': ticker,
            'interval': interval,
            'slice': slice_name,
            'apikey': self.api_key,
            'datatype': 'csv'
        }

        try:
            print(f"    📥 Fetching {ticker} - {slice_name}...")
            response = self.session.get(ALPHA_VANTAGE_BASE_URL, params=params, timeout=30)
            
            # Check for rate limit error
            if response.status_code == 429 or 'rate limit' in response.text.lower():
                if retry_count < MAX_RETRIES:
                    print(f"    ⚠️  Rate limit hit! Waiting {RETRY_DELAY}s... (retry {retry_count + 1}/{MAX_RETRIES})")
                    time.sleep(RETRY_DELAY)
                    return self._fetch_slice(ticker, interval, slice_name, retry_count + 1)
                else:
                    print(f"    ❌ Max retries exceeded for {slice_name}")
                    return None
            
            # Check for API error messages
            if response.status_code != 200:
                print(f"    ❌ HTTP {response.status_code}: {response.text[:100]}")
                return None
            
            # Check if response contains error message
            if 'Error Message' in response.text or 'Invalid API call' in response.text:
                print(f"    ❌ API Error: {response.text[:200]}")
                return None
            
            # Check if data is empty (slice beyond available data)
            lines = response.text.strip().split('\n')
            if len(lines) <= 1:  # Only header or empty
                print(f"    ℹ️  No data in {slice_name} (beyond available range)")
                return None
            
            self._wait_for_rate_limit()
            return response.text

        except requests.RequestException as e:
            print(f"    ❌ Network error: {e}")
            return None

    def _parse_csv_to_candles(self, csv_text: str) -> List[Dict[str, Any]]:
        """
        Parse Alpha Vantage CSV to Candle format
        
        CSV format: time,open,high,low,close,volume
        Candle format: {t: timestamp_ms, o: open, h: high, l: low, c: close, v: volume}
        """
        candles = []
        lines = csv_text.strip().split('\n')
        
        # Skip header
        for line in lines[1:]:
            parts = line.split(',')
            if len(parts) != 6:
                continue
            
            try:
                timestamp_str = parts[0]
                dt = datetime.strptime(timestamp_str, '%Y-%m-%d %H:%M:%S')
                timestamp_ms = int(dt.timestamp() * 1000)
                
                candle = {
                    't': timestamp_ms,
                    'o': float(parts[1]),
                    'h': float(parts[2]),
                    'l': float(parts[3]),
                    'c': float(parts[4]),
                    'v': int(parts[5])
                }
                candles.append(candle)
            except (ValueError, IndexError) as e:
                print(f"    ⚠️  Skipping invalid line: {line[:50]}... ({e})")
                continue
        
        return candles

    def download_ticker(
        self,
        ticker: str,
        interval: str = '1min',
        year: int = 2025,
        test_mode: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Download full year of data for a ticker by stitching slices
        
        Args:
            ticker: Stock symbol (e.g., 'BBCA.JK')
            interval: '1min' or '5min'
            year: Target year (1 for 2025, 2 for 2024 from current perspective)
            test_mode: If True, only fetch first 2 months
            
        Returns:
            List of candles sorted by timestamp
        """
        print(f"\n{'='*60}")
        print(f"📊 Downloading {ticker} ({interval}) - Year {year}")
        print(f"{'='*60}")
        
        all_candles = []
        
        # Determine slice range
        # year1month1 = most recent year, month 1
        # For 2025 data (as of Jan 2026), we want year1month1 through year1month12
        months = range(1, 3) if test_mode else range(1, 13)
        
        for month in months:
            slice_name = f"year{year}month{month}"
            csv_data = self._fetch_slice(ticker, interval, slice_name)
            
            if csv_data is None:
                # No more data available, stop fetching
                if month == 1:
                    print(f"    ❌ No data available for {ticker}")
                    return []
                else:
                    print(f"    ✅ Reached end of available data at month {month}")
                    break
            
            candles = self._parse_csv_to_candles(csv_data)
            all_candles.extend(candles)
            print(f"    ✅ Parsed {len(candles)} candles from {slice_name}")
        
        # Sort by timestamp (ascending)
        all_candles.sort(key=lambda x: x['t'])
        
        print(f"\n✅ Total candles for {ticker}: {len(all_candles)}")
        if all_candles:
            first_dt = datetime.fromtimestamp(all_candles[0]['t'] / 1000)
            last_dt = datetime.fromtimestamp(all_candles[-1]['t'] / 1000)
            print(f"   📅 Date range: {first_dt} → {last_dt}")
        
        return all_candles

    def save_to_json(self, ticker: str, candles: List[Dict[str, Any]]):
        """Save candles to JSON file"""
        # Clean ticker for filename (remove .JK suffix)
        clean_ticker = ticker.replace('.JK', '').replace('.', '_')
        filename = DATA_DIR / f"{clean_ticker}_2025_1min.json"
        
        with open(filename, 'w') as f:
            json.dump(candles, f, indent=2)
        
        print(f"💾 Saved to: {filename}")
        print(f"   File size: {filename.stat().st_size / 1024:.1f} KB")


def main():
    parser = argparse.ArgumentParser(description='Alpha Vantage IDX Stock Harvester')
    parser.add_argument(
        '--tickers',
        nargs='+',
        default=DEFAULT_IDX_TICKERS,
        help='Ticker symbols (default: BBCA.JK BBRI.JK TLKM.JK GOTO.JK ANTM.JK ASII.JK)'
    )
    parser.add_argument(
        '--ticker',
        type=str,
        help='Single ticker (for test mode)'
    )
    parser.add_argument(
        '--api-key',
        type=str,
        default='Z27Y0JX9KRMLUKJ2',
        help='Alpha Vantage API key (default: provided key)'
    )
    parser.add_argument(
        '--interval',
        type=str,
        default='1min',
        choices=['1min', '5min'],
        help='Data interval (default: 1min)'
    )
    parser.add_argument(
        '--test',
        action='store_true',
        help='Test mode: download only 2 months for 1 ticker'
    )
    
    args = parser.parse_args()
    
    # API key validation
    if not args.api_key:
        print("❌ Error: No API key provided. Use --api-key or set ALPHA_VANTAGE_API_KEY env var")
        sys.exit(1)
    
    # Determine tickers
    if args.test and args.ticker:
        tickers = [args.ticker]
    elif args.test:
        tickers = [DEFAULT_IDX_TICKERS[0]]  # Use first ticker for test
    else:
        tickers = args.tickers
    
    print(f"\n🚀 Alpha Vantage IDX Stock Harvester")
    print(f"{'='*60}")
    print(f"📊 Tickers: {', '.join(tickers)}")
    print(f"⏱️  Interval: {args.interval}")
    print(f"🔑 API Key: {args.api_key[:8]}...")
    if args.test:
        print(f"🧪 TEST MODE: Fetching only 2 months")
    print(f"{'='*60}\n")
    
    # Estimate time
    if not args.test:
        total_requests = len(tickers) * 12  # 12 months per ticker
        estimated_seconds = total_requests * RATE_LIMIT_DELAY
        print(f"⏳ Estimated time: ~{estimated_seconds // 60} minutes ({total_requests} requests)")
        print(f"   Press Ctrl+C to cancel\n")
        time.sleep(3)
    
    # Initialize harvester
    harvester = AlphaVantageHarvester(args.api_key)
    
    # Download each ticker
    successful = 0
    failed = 0
    
    for ticker in tickers:
        try:
            candles = harvester.download_ticker(
                ticker=ticker,
                interval=args.interval,
                year=1,  # year1 = most recent year (2025)
                test_mode=args.test
            )
            
            if candles:
                harvester.save_to_json(ticker, candles)
                successful += 1
            else:
                print(f"⚠️  No data retrieved for {ticker}")
                failed += 1
                
        except KeyboardInterrupt:
            print(f"\n\n⚠️  Download interrupted by user")
            break
        except Exception as e:
            print(f"\n❌ Error processing {ticker}: {e}")
            failed += 1
            continue
    
    # Summary
    print(f"\n\n{'='*60}")
    print(f"📊 HARVEST COMPLETE")
    print(f"{'='*60}")
    print(f"✅ Successful: {successful}")
    if failed > 0:
        print(f"❌ Failed: {failed}")
    print(f"📁 Output directory: {DATA_DIR}")
    print(f"{'='*60}\n")


if __name__ == '__main__':
    main()
