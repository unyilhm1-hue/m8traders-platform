# Smart yfinance Harvester - Documentation

## Features

### 🎯 Smart Download Strategy
1. **30-Day Chunking**: Downloads in 4 × 7-day chunks (bypasses Yahoo limit)
2. **Single File Per Stock**: `BBCA_full_30days.json` (easier for frontend)
3. **Incremental Update**: Only downloads new data after first run
4. **Auto-Merge & Deduplicate**: No duplicate timestamps

---

## File Format

### Output Structure

One JSON file per stock containing **full 30-day history**:

```
public/simulation-data/
├── BBCA_full_30days.json (5,119 candles)
├── BBRI_full_30days.json
└── TLKM_full_30days.json
```

### JSON Schema

```json
[
  {
    "time": "2025-12-18 02:00:00",
    "open": 8050.0,
    "high": 8125.0,
    "low": 8050.0,
    "close": 8125.0,
    "volume": 0
  },
  ...
]
```

**Note**: Full timestamp format (`YYYY-MM-DD HH:MM:SS`) instead of time-only.

---

## Usage

### First Run (Full Download - 30 Days)

```bash
cd C:\Users\laras\.gemini\antigravity\scratch\m8traders-platform\scripts

# Download all default stocks (30 days)
python harvest_stocks.py

# Or specific stocks
python harvest_stocks.py --tickers BBCA.JK TLKM.JK
```

**What happens:**
- Downloads 4 × 7-day chunks
- Merges into single file per stock
- Removes duplicates
- Sorts by timestamp

**Output:**
```
📊 Processing: BBCA.JK
🔄 Mode: Full Download (30 days)
📦 Chunk 1/4: 2026-01-08 → 2026-01-15
   ✅ 1603 candles
📦 Chunk 2/4: 2026-01-01 → 2026-01-08
   ✅ 1273 candles
...
📊 Total candles: 5,119
💾 Saving: BBCA_full_30days.json
```

---

### Subsequent Runs (Incremental Update)

```bash
# Run again (only downloads NEW data since last run)
python harvest_stocks.py
```

**What happens:**
1. Loads existing `BBCA_full_30days.json`
2. Finds last timestamp: `2026-01-14 16:00:00`
3. Only downloads from `2026-01-14 16:01:00` to NOW
4. Merges new data with existing
5. Saves updated file

**Output:**
```
📊 Processing: BBCA.JK
📂 Found existing file: 5,119 candles
📅 Last timestamp: 2026-01-14 16:00:00
⚡ Incremental update: 1 days
📦 Single chunk: 2026-01-14 → 2026-01-15
   ✅ 390 candles
🔗 Merging new data with existing...
📊 Total candles: 5,509 (added 390 new)
```

---

### Force Full Re-download

```bash
# Force full download (ignore existing file)
python harvest_stocks.py --force-full
```

---

## Command Options

```bash
python harvest_stocks.py [OPTIONS]
```

### Options:

- `--tickers BBCA.JK TLKM.JK` - Specific tickers (default: all 6 IDX stocks)
- `--interval 5m` - Data interval (default: 1m)
- `--force-full` - Force full 30-day download
- `--delay 5.0` - Delay between tickers in seconds (default: 3.0)

---

## How Incremental Update Works

### First Run:
```
Timeline: [Today - 30d] ===============> [Today]
Download: [████████████████████████████]
Result:   BBCA_full_30days.json (5,119 candles)
```

### Second Run (Next Day):
```
Timeline: [Old Data ██████████████████] [New Data ██]
Already:  [Skip - already have this    ] 
Download: [                             ] [Download only this]
Result:   BBCA_full_30days.json (5,509 candles) ← merged
```

### Smart Detection:
```python
# Script reads existing file
last_timestamp = "2026-01-14 16:00:00"

# Only downloads from last_timestamp + 1 minute
start = "2026-01-14 16:01:00"
end = datetime.now()
```

---

## Best Practices

### Daily Update Workflow

```bash
# Run once per day (e.g., after market close 16:30 WIB)
python harvest_stocks.py
```

This will:
- Check all stocks
- Download only today's new data
- Keep rolling 30-day window

### Full Refresh (Weekly)

```bash
# Once per week, force full download
python harvest_stocks.py --force-full
```

This ensures data integrity and removes any gaps.

---

## API Integration

### Frontend Usage

Since each file now contains **full 30 days**, you can:

**Option A: Random Day Selection (Backend)**
```typescript
// API picks random timestamp range from full file
GET /api/simulation/start?duration=390 // 390 × 1min = 1 trading day
```

**Option B: Client-Side Slicing**
```typescript
// Frontend loads full file, slices desired range
const fullData = await fetch('/simulation-data/BBCA_full_30days.json');
const oneDayData = fullData.slice(0, 390); // First trading day
```

---

## Performance

### File Sizes (Approximate)

- **1 min candle**: ~100 bytes JSON
- **1 trading day** (390 min): ~39 KB
- **30 days full**: ~500 KB per stock

### Download Times

- **First run** (4 chunks): ~20 seconds per stock
- **Incremental** (1 day): ~3 seconds per stock

---

## Troubleshooting

### "Data is already up-to-date"

This is normal if you run the script multiple times on the same day. Wait for new market data.

### Corrupted existing file

```bash
# Force re-download
python harvest_stocks.py --force-full --tickers BBCA.JK
```

### Missing data gaps

The script auto-skips weekends. Gaps are normal.

---

## Comparison: Old vs New

| Feature | Old Script | New Script |
|---------|-----------|------------|
| **Output** | Multiple daily files | Single file per stock |
| **Update** | Always full download | Incremental smart update |
| **Frontend** | Load random daily file | Load single file, slice |
| **Timestamp** | Time only (`09:00`) | Full (`2026-01-14 09:00:00`) |
| **Size** | 15-20 files/stock | 1 file/stock |

---

## Example: Full Workflow

```bash
# Day 1: First run
python harvest_stocks.py --tickers BBCA.JK BBRI.JK TLKM.JK
# Output:
# - BBCA_full_30days.json (5,119 candles)
# - BBRI_full_30days.json (5,200 candles)
# - TLKM_full_30days.json (5,150 candles)

# Day 2: Incremental update
python harvest_stocks.py --tickers BBCA.JK BBRI.JK TLKM.JK
# Output:
# - BBCA_full_30days.json (5,509 candles) ← +390 new
# - BBRI_full_30days.json (5,590 candles) ← +390 new
# - TLKM_full_30days.json (5,540 candles) ← +390 new

# Week 1: Force full refresh
python harvest_stocks.py --force-full
# Re-downloads everything to ensure data quality
```
