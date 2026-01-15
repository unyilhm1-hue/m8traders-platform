# Yahoo Finance Integration - Usage Example

## Quick Start Guide

### 1. Download Stock Data

```bash
cd C:\Users\laras\.gemini\antigravity\scratch\m8traders-platform

# Install dependencies
pip install yfinance pandas

# Download data for all default IDX stocks (30 days)
python scripts/harvest_yfinance.py

# Or download specific stocks
python scripts/harvest_yfinance.py --tickers BBCA.JK TLKM.JK

# Custom period
python scripts/harvest_yfinance.py --period 5d
```

**Output**: Files saved to `public/simulation-data/`
- `BBCA_2025-01-10.json`
- `BBCA_2025-01-13.json`
- `TLKM_2025-01-10.json`
- etc.

---

### 2. Use in Your Component

```tsx
'use client';

import { useSimulationWorker } from '@/hooks/useSimulationWorker';
import { useSimulationStore, useCurrentPrice } from '@/stores/useSimulationStore';

export default function TradingSimulation() {
  const currentPrice = useCurrentPrice();
  const pushTick = useSimulationStore((s) => s.pushTick);

  const worker = useSimulationWorker({
    onTick: (tick) => {
      pushTick(tick); // Update store with each tick
    },
    onDataReady: (total) => {
      console.log(`Ready to simulate ${total} candles`);
    },
    onComplete: () => {
      console.log('Simulation finished!');
    },
  });

  const handleStart = async () => {
    try {
      // 1. Load random trading day data from API
      const info = await worker.loadSimulationData();
      console.log(`Loaded: ${info.ticker} on ${info.date}`);

      // 2. Start playback at 1x speed
      worker.play(1);
    } catch (error) {
      console.error('Failed to start simulation:', error);
    }
  };

  return (
    <div>
      <h1>Current Price: Rp {currentPrice.toLocaleString()}</h1>
      
      {worker.simulationInfo && (
        <p>
          {worker.simulationInfo.ticker} • {worker.simulationInfo.date} • 
          {worker.simulationInfo.candleCount} candles
        </p>
      )}

      <button onClick={handleStart} disabled={!worker.isReady}>
        Start Simulation
      </button>
      <button onClick={() => worker.pause()}>Pause</button>
      <button onClick={() => worker.setSpeed(2)}>2x Speed</button>
      <button onClick={() => worker.setSpeed(5)}>5x Speed</button>
    </div>
  );
}
```

---

## API Endpoints

### `GET /api/simulation/start`

Randomly selects one trading day from `public/simulation-data/`.

**Response:**
```json
{
  "success": true,
  "data": {
    "ticker": "BBCA",
    "date": "2025-01-13",
    "candles": [
      { "t": 1736726400000, "o": 9800, "h": 9850, "l": 9780, "c": 9820, "v": 150000 },
      ...
    ],
    "candleCount": 390,
    "source": "BBCA_2025-01-13.json"
  }
}
```

---

## Worker Messages

### Send to Worker

```typescript
// Initialize data
worker.postMessage({ type: 'INIT_DATA', candles });

// Start playback
worker.postMessage({ type: 'PLAY', speed: 1 });

// Control
worker.postMessage({ type: 'PAUSE' });
worker.postMessage({ type: 'SET_SPEED', speed: 2 });
worker.postMessage({ type: 'SEEK', index: 100 });
```

### Receive from Worker

```typescript
worker.onmessage = (event) => {
  switch (event.data.type) {
    case 'READY':
      // Worker initialized
      break;
    case 'DATA_READY':
      // Data loaded, ready to play
      break;
    case 'TICK':
      // New tick data
      console.log(event.data.data.price);
      break;
    case 'COMPLETE':
      // Simulation finished
      break;
  }
};
```

---

## Hook API

### `useSimulationWorker(options)`

**Options:**
- `onTick?: (tick: TickData) => void`
- `onDataReady?: (totalCandles: number) => void`
- `onCandleChange?: (candleIndex: number) => void`
- `onComplete?: () => void`
- `onError?: (message: string) => void`

**Returns:**
- `loadSimulationData(): Promise<{ticker, date, candleCount}>` - Fetch random trading day
- `play(speed?: number)` - Start playback (requires data loaded first)
- `pause()` - Pause at current position
- `stop()` - Stop and reset
- `setSpeed(speed: number)` - Change playback speed
- `seek(index: number)` - Jump to candle
- `isReady: boolean` - Worker initialized
- `isDataLoaded: boolean` - Data loaded and ready
- `simulationInfo: {ticker, date, candleCount} | null` - Current simulation metadata

---

## Troubleshooting

### No data files found

**Error**: `"No simulation data files found"`

**Fix**: Run the harvester first:
```bash
python scripts/harvest_yfinance.py
```

### Worker not loading data

**Error**: `"No data loaded. Call loadSimulationData() first"`

**Fix**: Call `loadSimulationData()` before `play()`:
```typescript
await worker.loadSimulationData();
worker.play();
```

### yfinance errors

**Error**: `No data returned`

**Causes**:
- Ticker format incorrect (must be `.JK` for IDX stocks)
- Market closed (1m data only available for recent days)
- Rate limiting

**Fix**:
- Use correct ticker format: `BBCA.JK`
- Download during/after market hours
- Add delays between requests
