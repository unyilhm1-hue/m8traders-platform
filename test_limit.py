
import yfinance as yf
from datetime import datetime

tickers = ["BBCA.JK"]
# Test date: Nov 20, 2025 (Approx 57 days ago from Jan 16, 2026)
start_date = "2025-11-20"
end_date = "2025-11-21"

print(f"Testing 1m interval for {start_date}...")
df_1m = yf.download(tickers, start=start_date, end=end_date, interval="1m", progress=False)
print(f"1m Rows: {len(df_1m)}")
if not df_1m.empty:
    print(df_1m.head())

print(f"\nTesting 5m interval for {start_date}...")
df_5m = yf.download(tickers, start=start_date, end=end_date, interval="5m", progress=False)
print(f"5m Rows: {len(df_5m)}")

print(f"\nTesting 60m interval for {start_date}...")
df_60m = yf.download(tickers, start=start_date, end=end_date, interval="60m", progress=False)
print(f"60m Rows: {len(df_60m)}")
