#!/usr/bin/env python3
"""
Batch Merge All Stock Data
===========================
Script untuk menjalankan merge_stock_data.py pada SEMUA kombinasi
ticker dan interval yang ada di folder simulation-data.

Usage:
    python batch_merge_all.py [DATA_DIR]

Example:
    python batch_merge_all.py public/simulation-data
"""

import os
import re
import glob
import subprocess
import sys
from pathlib import Path
from collections import defaultdict


def scan_available_data(data_dir: str) -> dict:
    """
    Scan direktori untuk menemukan semua kombinasi ticker + interval yang tersedia.
    
    Returns:
        Dictionary: {ticker: set(intervals)}
    """
    print("=" * 60)
    print("SCANNING AVAILABLE DATA")
    print("=" * 60)
    
    # Pattern: TICKER_INTERVAL_YYYY-MM-DD.json
    # Exclude file yang sudah MERGED/COMBINED/days
    pattern = os.path.join(data_dir, "*.json")
    all_files = glob.glob(pattern)
    
    # Filter: exclude MERGED, COMBINED, days
    exclude_keywords = ['MERGED', 'COMBINED', 'days', '_full_']
    raw_files = [
        f for f in all_files
        if not any(kw in os.path.basename(f) for kw in exclude_keywords)
    ]
    
    # Regex untuk ekstrak TICKER dan INTERVAL
    # Pattern: TICKER_INTERVAL_date.json
    file_pattern = re.compile(r'^([A-Z]+)_(\d+[mh])_\d{4}-\d{2}-\d{2}\.json$')
    
    data_map = defaultdict(set)
    
    for file_path in raw_files:
        basename = os.path.basename(file_path)
        match = file_pattern.match(basename)
        
        if match:
            ticker = match.group(1)
            interval = match.group(2)
            data_map[ticker].add(interval)
    
    # Sort untuk output yang rapi
    sorted_data = {k: sorted(v) for k, v in sorted(data_map.items())}
    
    print(f"\n✓ Ditemukan {len(sorted_data)} ticker dengan berbagai interval:\n")
    for ticker, intervals in sorted_data.items():
        intervals_str = ", ".join(intervals)
        print(f"  {ticker:10} → [ {intervals_str} ]")
    
    total_combinations = sum(len(v) for v in sorted_data.values())
    print(f"\n✓ Total kombinasi: {total_combinations}")
    print()
    
    return sorted_data


def run_merge_script(ticker: str, interval: str, data_dir: str, script_path: str):
    """
    Jalankan merge_stock_data.py untuk satu kombinasi ticker + interval.
    
    Args:
        ticker: Kode saham
        interval: Interval data
        data_dir: Direktori data
        script_path: Path ke script merge_stock_data.py
    """
    print(f"\n{'='*60}")
    print(f"PROCESSING: {ticker} @ {interval}")
    print(f"{'='*60}")
    
    cmd = [
        "python",
        script_path,
        ticker,
        interval,
        data_dir
    ]
    
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding='utf-8',
            timeout=300  # 5 menit timeout per script
        )
        
        # Tampilkan output
        if result.stdout:
            print(result.stdout)
        
        if result.returncode == 0:
            print(f"✓ SUCCESS: {ticker}_{interval}")
            return True
        else:
            print(f"✗ FAILED: {ticker}_{interval}")
            if result.stderr:
                print(f"Error: {result.stderr}")
            return False
            
    except subprocess.TimeoutExpired:
        print(f"✗ TIMEOUT: {ticker}_{interval} (took more than 5 minutes)")
        return False
    except Exception as e:
        print(f"✗ ERROR: {ticker}_{interval}")
        print(f"  {str(e)}")
        return False


def main():
    """Main execution"""
    
    # Parse arguments
    if len(sys.argv) > 1:
        data_dir = sys.argv[1]
    else:
        data_dir = "public/simulation-data"
    
    # Resolve paths
    data_dir = os.path.abspath(data_dir)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    merge_script = os.path.join(script_dir, "merge_stock_data.py")
    
    # Validasi
    if not os.path.exists(data_dir):
        print(f"✗ Error: Directory tidak ditemukan: {data_dir}")
        sys.exit(1)
    
    if not os.path.exists(merge_script):
        print(f"✗ Error: merge_stock_data.py tidak ditemukan di: {merge_script}")
        sys.exit(1)
    
    print("\n")
    print("=" * 62)
    print("  BATCH MERGE ALL STOCK DATA")
    print("=" * 62)
    print(f"\nData Directory    : {data_dir}")
    print(f"Merge Script      : {merge_script}")
    print()
    
    # Scan data yang tersedia
    data_map = scan_available_data(data_dir)
    
    if not data_map:
        print("✗ Tidak ada data yang ditemukan untuk di-merge.")
        sys.exit(0)
    
    # Konfirmasi dari user
    total_tasks = sum(len(intervals) for intervals in data_map.values())
    print(f"\n⚠ Akan memproses {total_tasks} kombinasi ticker+interval.")
    print(f"  Proses ini mungkin memakan waktu beberapa menit.\n")
    
    try:
        confirm = input("Lanjutkan? (y/n): ").strip().lower()
        if confirm != 'y':
            print("Dibatalkan oleh user.")
            sys.exit(0)
    except KeyboardInterrupt:
        print("\nDibatalkan oleh user.")
        sys.exit(0)
    
    print()
    
    # Jalankan merge untuk setiap kombinasi
    success_count = 0
    failed_count = 0
    failed_items = []
    
    for ticker, intervals in data_map.items():
        for interval in intervals:
            success = run_merge_script(ticker, interval, data_dir, merge_script)
            
            if success:
                success_count += 1
            else:
                failed_count += 1
                failed_items.append(f"{ticker}_{interval}")
    
    # Summary Report
    print("\n")
    print("=" * 62)
    print("  BATCH MERGE SUMMARY")
    print("=" * 62)
    print(f"\nTotal Processed  : {success_count + failed_count}")
    print(f"Success          : {success_count}")
    print(f"Failed           : {failed_count}")
    
    if failed_items:
        print("\nFailed Items:")
        for item in failed_items:
            print(f"  ✗ {item}")
    
    print("\n✅ Batch merge selesai!\n")


if __name__ == '__main__':
    main()
