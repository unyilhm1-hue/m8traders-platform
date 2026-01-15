import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
import requests

# --- KONFIGURASI ---
symbol = "BBCA.JK"  # Kita tes satu saham dulu
session = requests.Session()
session.headers.update({"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0"})

print(f"🕵️♂️ MEMULAI DIAGNOSA UNTUK {symbol}...\n")

# Coba ambil data HANYA 5 hari terakhir (Pasti aman dari limit 30 hari)
end_date = datetime.now()
start_date = end_date - timedelta(days=5)

print(f"1. Mencoba download periode: {start_date.date()} s/d {end_date.date()}")

try:
    # Kita coba download tanpa chunking dulu untuk tes koneksi
    df = yf.download(
        symbol, 
        start=start_date.strftime('%Y-%m-%d'), 
        end=end_date.strftime('%Y-%m-%d'), 
        interval="1m", 
        session=session,
        progress=True,  # Kita nyalakan progress bar bawaan
        auto_adjust=True
    )

    print("\n--- HASIL ---")
    
    if df.empty:
        print("❌ DataFrame KOSONG. Yahoo tidak mengembalikan data apa-apa.")
        print("Kemungkinan penyebab:")
        print("   - IP Anda diblokir sementara (Too Many Requests).")
        print("   - Yahoo sedang gangguan untuk data 1m.")
        print("   - Simbol saham salah (tapi BBCA.JK harusnya benar).")
    else:
        print(f"✅ Berhasil dapat {len(df)} baris data!")
        print("Contoh 5 baris pertama:")
        print(df.head())
        
        # Cek kolom
        print("\nNama Kolom:", df.columns)
        
        # Cek apakah tanggal terbaca
        print("\nCek Index (Waktu):")
        print(df.index[0], "sampai", df.index[-1])

except Exception as e:
    print(f"\n❌ TERJADI ERROR PROGRAM: {e}")

print("\n🏁 Diagnosa Selesai.")
