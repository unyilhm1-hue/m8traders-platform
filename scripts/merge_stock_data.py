#!/usr/bin/env python3
"""
Adaptive Data Pipeline & Auto-Merging System
==============================================
Script untuk menggabungkan data saham harian mentah menjadi satu file master
dengan metadata otomatis. Mengikuti 5 Fase Blueprint:

FASE 1: Protokol Sanitasi (Pembersihan file lama)
FASE 2: Penemuan & Inventarisasi (Discovery)
FASE 3: Rekonstruksi Data (Transformation)
FASE 4: Pengukuran Metadata (Auto-Measure)
FASE 5: Pengemasan Output (Packaging)

Usage:
    python merge_stock_data.py TICKER INTERVAL [DATA_DIR]

Example:
    python merge_stock_data.py ADRO 1m ./data
    python merge_stock_data.py BBRI 5m
"""

import json
import os
import re
import glob
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Any, Tuple
import sys


def fase_1_sanitasi(ticker: str, interval: str, data_dir: str) -> None:
    """
    FASE 1: Protokol Sanitasi - Hapus file output lama
    
    Mencari dan menghapus file yang mengandung:
    - Nama ticker
    - Kata kunci: MERGED, COMBINED, atau 'days'
    
    Args:
        ticker: Kode saham (misal: ADRO)
        interval: Interval data (misal: 1m)
        data_dir: Direktori kerja
    """
    print("=" * 60)
    print("FASE 1: PROTOKOL SANITASI")
    print("=" * 60)
    
    # Pola untuk file yang harus dihapus
    patterns = [
        f"{ticker}_{interval}_*MERGED*.json",
        f"{ticker}_{interval}_*COMBINED*.json",
        f"{ticker}_{interval}_*days*.json",
    ]
    
    deleted_count = 0
    for pattern in patterns:
        search_path = os.path.join(data_dir, pattern)
        files_to_delete = glob.glob(search_path)
        
        for file_path in files_to_delete:
            try:
                os.remove(file_path)
                print(f"✓ Dihapus: {os.path.basename(file_path)}")
                deleted_count += 1
            except Exception as e:
                print(f"✗ Error menghapus {file_path}: {e}")
    
    if deleted_count == 0:
        print("✓ Tidak ada file lama yang perlu dihapus")
    else:
        print(f"✓ Total {deleted_count} file lama berhasil dihapus")
    print()


def fase_2_discovery(ticker: str, interval: str, data_dir: str) -> List[Tuple[str, str]]:
    """
    FASE 2: Penemuan & Inventarisasi
    
    Mencari file mentah, validasi, dan urutkan berdasarkan tanggal.
    
    Args:
        ticker: Kode saham
        interval: Interval data
        data_dir: Direktori kerja
        
    Returns:
        List of (file_path, date_string) tuples, sorted by date
    """
    print("=" * 60)
    print("FASE 2: PENEMUAN & INVENTARISASI")
    print("=" * 60)
    
    # Pola pencarian: [TICKER]_[INTERVAL]_*.json
    # Tapi EXCLUDE yang mengandung MERGED, COMBINED, days
    pattern = f"{ticker}_{interval}_*.json"
    search_path = os.path.join(data_dir, pattern)
    all_files = glob.glob(search_path)
    
    # Filter: exclude file output lama yang mungkin masih ada
    exclude_keywords = ['MERGED', 'COMBINED', 'days']
    raw_files = [
        f for f in all_files 
        if not any(kw in os.path.basename(f) for kw in exclude_keywords)
    ]
    
    if len(raw_files) == 0:
        print("✗ PERINGATAN: Data Mentah Tidak Ditemukan!")
        print(f"  Pattern: {pattern}")
        print(f"  Directory: {data_dir}")
        sys.exit(1)
    
    print(f"✓ Ditemukan {len(raw_files)} file mentah")
    
    # Ekstrak tanggal dari nama file untuk sorting
    # Expected pattern: TICKER_INTERVAL_YYYY-MM-DD.json
    date_pattern = re.compile(r'(\d{4}-\d{2}-\d{2})')
    
    file_date_pairs = []
    for file_path in raw_files:
        basename = os.path.basename(file_path)
        match = date_pattern.search(basename)
        
        if match:
            date_str = match.group(1)
            file_date_pairs.append((file_path, date_str))
        else:
            print(f"⚠ Warning: Tidak dapat ekstrak tanggal dari {basename}")
    
    # Urutkan berdasarkan tanggal (ascending: terlama ke terbaru)
    file_date_pairs.sort(key=lambda x: x[1])
    
    print("✓ File diurutkan kronologis (terlama → terbaru):")
    for file_path, date_str in file_date_pairs:
        print(f"  - {date_str}: {os.path.basename(file_path)}")
    print()
    
    return file_date_pairs


def fase_3_rekonstruksi(file_date_pairs: List[Tuple[str, str]]) -> List[Dict[str, Any]]:
    """
    FASE 3: Rekonstruksi Data
    
    Gabungkan tanggal dari nama file dengan jam di data candle
    untuk membuat timestamp ISO 8601 lengkap.
    
    Args:
        file_date_pairs: List of (file_path, date_string)
        
    Returns:
        List of reconstructed candles dengan timestamp lengkap
    """
    print("=" * 60)
    print("FASE 3: REKONSTRUKSI DATA")
    print("=" * 60)
    
    master_candles = []
    
    for file_path, date_str in file_date_pairs:
        print(f"Memproses: {os.path.basename(file_path)} (date: {date_str})")
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Data bisa punya struktur berbeda, coba beberapa kemungkinan
            candles = None
            if isinstance(data, dict):
                # Coba key 'candles' atau 'data' atau 'klines'
                candles = data.get('candles') or data.get('data') or data.get('klines')
            elif isinstance(data, list):
                candles = data
            
            if not candles:
                print(f"  ⚠ Warning: Tidak ada data candle di file ini, skip.")
                continue
            
            candle_count = 0
            for candle in candles:
                # Ekstrak jam dari candle
                # Bisa berupa 'time', 't', 'timestamp', atau langsung ada di candle
                time_value = (
                    candle.get('time') or 
                    candle.get('t') or 
                    candle.get('timestamp') or
                    candle.get('Time')
                )
                
                if not time_value:
                    continue
                
                # Jika time_value sudah ISO string lengkap, pakai langsung
                if isinstance(time_value, str) and 'T' in time_value:
                    full_timestamp = time_value
                else:
                    # Anggap time_value adalah jam saja (HH:MM atau HH:MM:SS)
                    time_str = str(time_value)
                    
                    # Gabungkan: YYYY-MM-DD + T + HH:MM:SS + Z
                    # Tambahkan :00 jika hanya HH:MM
                    if time_str.count(':') == 1:
                        time_str += ':00'
                    
                    full_timestamp = f"{date_str}T{time_str}Z"
                
                # Normalisasi volume (cek berbagai variasi key)
                volume = (
                    candle.get('volume') or 
                    candle.get('vol') or 
                    candle.get('Volume') or 
                    candle.get('v') or
                    0
                )
                
                # Buat candle yang sudah "disembuhkan"
                fixed_candle = {
                    'timestamp': full_timestamp,
                    'open': candle.get('open') or candle.get('o'),
                    'high': candle.get('high') or candle.get('h'),
                    'low': candle.get('low') or candle.get('l'),
                    'close': candle.get('close') or candle.get('c'),
                    'volume': volume
                }
                
                master_candles.append(fixed_candle)
                candle_count += 1
            
            print(f"  ✓ Berhasil rekonstruksi {candle_count} candles")
            
        except Exception as e:
            print(f"  ✗ Error membaca file: {e}")
            continue
    
    print(f"\n✓ Total {len(master_candles)} candles berhasil direkonstruksi")
    print()
    
    return master_candles


def fase_4_metadata(candles: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    FASE 4: Pengukuran Metadata
    
    Hitung metadata secara otomatis dari hasil rekonstruksi:
    - Start date (candle pertama)
    - End date (candle terakhir)
    - Total candles
    - Durasi (opsional)
    
    Args:
        candles: List of candles
        
    Returns:
        Metadata dictionary
    """
    print("=" * 60)
    print("FASE 4: PENGUKURAN METADATA")
    print("=" * 60)
    
    if len(candles) == 0:
        print("✗ Error: Tidak ada candle untuk dihitung metadata-nya")
        sys.exit(1)
    
    # Ambil timestamp pertama dan terakhir
    start_timestamp = candles[0]['timestamp']
    end_timestamp = candles[-1]['timestamp']
    total_candles = len(candles)
    
    # Hitung durasi
    start_dt = datetime.fromisoformat(start_timestamp.replace('Z', '+00:00'))
    end_dt = datetime.fromisoformat(end_timestamp.replace('Z', '+00:00'))
    duration_days = (end_dt - start_dt).days
    
    # Waktu generate file
    generated_at = datetime.now(timezone.utc).isoformat()
    
    metadata = {
        'data_start': start_timestamp,
        'data_end': end_timestamp,
        'total_candles': total_candles,
        'duration_days': duration_days,
        'generated_at': generated_at
    }
    
    print(f"✓ Start Date    : {start_timestamp}")
    print(f"✓ End Date      : {end_timestamp}")
    print(f"✓ Total Candles : {total_candles:,}")
    print(f"✓ Duration      : {duration_days} hari")
    print(f"✓ Generated At  : {generated_at}")
    print()
    
    return metadata


def fase_5_packaging(
    ticker: str, 
    interval: str, 
    metadata: Dict[str, Any],
    candles: List[Dict[str, Any]],
    file_count: int,
    data_dir: str
) -> str:
    """
    FASE 5: Pengemasan Output
    
    Simpan hasil akhir ke file JSON dengan struktur standar.
    
    Args:
        ticker: Kode saham
        interval: Interval data
        metadata: Metadata dari Fase 4
        candles: List of candles
        file_count: Jumlah file mentah yang digabung
        data_dir: Direktori output
        
    Returns:
        Path to output file
    """
    print("=" * 60)
    print("FASE 5: PENGEMASAN OUTPUT")
    print("=" * 60)
    
    # Struktur JSON final
    output_data = {
        'ticker': ticker,
        'interval': interval,
        'metadata': {
            **metadata,
            'source_file_count': file_count
        },
        'candles': candles
    }
    
    # Penamaan file: [TICKER]_[INTERVAL]_MERGED.json
    output_filename = f"{ticker}_{interval}_MERGED.json"
    output_path = os.path.join(data_dir, output_filename)
    
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)
        
        print(f"✓ File berhasil disimpan: {output_filename}")
        
        # Tampilkan ukuran file
        file_size = os.path.getsize(output_path)
        file_size_mb = file_size / (1024 * 1024)
        print(f"✓ Ukuran file: {file_size_mb:.2f} MB")
        
        # Laporan sukses
        print("\n" + "=" * 60)
        print("LAPORAN SUKSES")
        print("=" * 60)
        print(f"Ticker          : {ticker}")
        print(f"Interval        : {interval}")
        print(f"File diproses   : {file_count}")
        print(f"Rentang tanggal : {metadata['data_start']} → {metadata['data_end']}")
        print(f"Total candles   : {metadata['total_candles']:,}")
        print(f"Output file     : {output_path}")
        print("=" * 60)
        
        return output_path
        
    except Exception as e:
        print(f"✗ Error menyimpan file: {e}")
        sys.exit(1)


def main():
    """Main execution function"""
    
    # Parse command line arguments
    if len(sys.argv) < 3:
        print("Usage: python merge_stock_data.py TICKER INTERVAL [DATA_DIR]")
        print("\nExample:")
        print("  python merge_stock_data.py ADRO 1m ./data")
        print("  python merge_stock_data.py BBRI 5m")
        sys.exit(1)
    
    ticker = sys.argv[1].upper()
    interval = sys.argv[2]
    data_dir = sys.argv[3] if len(sys.argv) > 3 else '.'
    
    # Pastikan directory exists
    if not os.path.exists(data_dir):
        print(f"✗ Error: Directory tidak ditemukan: {data_dir}")
        sys.exit(1)
    
    print("\n")
    print("=" * 62)
    print("  ADAPTIVE DATA PIPELINE & AUTO-MERGING SYSTEM")
    print("=" * 62)
    print(f"\nTicker   : {ticker}")
    print(f"Interval : {interval}")
    print(f"Directory: {data_dir}")
    print()
    
    # FASE 1: Sanitasi
    fase_1_sanitasi(ticker, interval, data_dir)
    
    # FASE 2: Discovery
    file_date_pairs = fase_2_discovery(ticker, interval, data_dir)
    
    # FASE 3: Rekonstruksi
    master_candles = fase_3_rekonstruksi(file_date_pairs)
    
    # FASE 4: Metadata
    metadata = fase_4_metadata(master_candles)
    
    # FASE 5: Packaging
    output_path = fase_5_packaging(
        ticker=ticker,
        interval=interval,
        metadata=metadata,
        candles=master_candles,
        file_count=len(file_date_pairs),
        data_dir=data_dir
    )
    
    print("\n✅ Proses selesai dengan sukses!\n")


if __name__ == '__main__':
    main()
