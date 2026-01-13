# M8Traders Trading Platform

Platform edukasi dan simulasi trading saham berbasis web dengan fokus pada fundamental analysis, technical analysis, dan emotional control.

## 🚀 Features

### Phase 1: Foundation ✅
- ✅ Next.js 16 + React 19 + TypeScript
- ✅ Supabase Authentication 
- ✅ KLineChart Integration
- ✅ Zustand State Management
- ✅ Basic Trading Simulation
- ✅ UI Components Library

### Phase 2: Chart Enhancements ✅
- ✅ **Dynamic Ticker Selection** - 23 stocks (US + IDX)
  - Popular tickers (AAPL, GOOGL, MSFT, TSLA, BBCA, BBRI, TLKM)
  - US Stocks (13 tickers)
  - Indonesian Stocks (10 tickers)
  - Search/filter functionality
  
- ✅ **Flexible Timeframe Selection** - 7 intervals
  - 1 minute, 5 minutes, 15 minutes, 30 minutes
  - 1 hour, 4 hours, 1 day (+ 1 week)
  
- ✅ **Comprehensive Technical Indicators** - 14 indicators
  - Moving Averages: SMA, EMA, WMA
  - Oscillators: RSI, MACD, KDJ, CCI, Williams %R
  - Volatility: Bollinger Bands, ATR
  - Trend: ADX, Parabolic SAR
  - Volume: VWAP, OBV
  
- ✅ **Smart Data Service**
  - Hybrid architecture (API-ready + sample data)
  - In-memory caching (15min TTL)
  - Automatic timeframe aggregation
  - Loading states & error handling

### Phase 3: Advanced Tools (Coming Soon)
- [ ] Drawing Tools (trendlines, fibonacci, shapes)
- [ ] Pattern Recognition System
- [ ] Multi-timeframe Analysis
- [ ] Trade Replay Functionality
- [ ] Challenge System

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **UI**: React 19 + TailwindCSS 4
- **Charts**: KLineChart v9
- **State**: Zustand + Immer
- **Auth**: Supabase
- **Deployment**: Vercel

## 📦 Installation

```bash
# Clone repository
git clone <repo-url>
cd m8traders-platform

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## 🎯 Usage

### Demo Page
Visit `/sim/demo` to try the trading simulator:
1. **Select a ticker** from the dropdown (US or IDX stocks)
2. **Choose timeframe** (1m - 1d)
3. **Toggle indicators** (RSI, MACD, Bollinger Bands, etc.)
4. **Place trades** using the order panel
5. **Monitor position** and trading statistics

### Authentication
- Protected routes require login
- Magic link authentication via email
- Session persistence

## 📁 Project Structure

```
src/
├── app/                    # Next.js app router
│   ├── (auth)/            # Authentication pages
│   ├── (protected)/       # Protected routes
│   └── api/               # API routes
├── components/
│   ├── chart/             # Chart components
│   │   ├── TradingChart.tsx
│   │   ├── ChartControls.tsx
│   │   ├── TickerSelector.tsx
│   │   └── TimeframeSelector.tsx
│   ├── trading/           # Trading components
│   └── ui/                # Reusable UI components
├── lib/
│   ├── chart/             # Chart utilities
│   │   ├── dataService.ts
│   │   ├── tickers.ts
│   │   ├── config.ts
│   │   └── theme.ts
│   └── trading/           # Trading engine
├── stores/                # Zustand stores
│   ├── useChartStore.ts
│   ├── useTradingStore.ts
│   └── useUserStore.ts
└── types/                 # TypeScript types
```

## 🎨 Available Tickers

### US Stocks (🇺🇸)
AAPL, GOOGL, MSFT, AMZN, META, NVDA, TSLA, JPM, BAC, GS, WMT, DIS, NKE

### Indonesian Stocks (🇮🇩)
BBCA.JK, BBRI.JK, BMRI.JK, BBNI.JK, TLKM.JK, EXCL.JK, UNVR.JK, ICBP.JK, ASII.JK, ADRO.JK

## 📊 Supported Indicators

| Indicator | Code | Type | Default Period |
|-----------|------|------|----------------|
| Simple Moving Average | SMA | Overlay | 20 |
| Exponential Moving Average | EMA | Overlay | 12 |
| Weighted Moving Average | WMA | Overlay | 20 |
| Relative Strength Index | RSI | Oscillator | 14 |
| MACD | MACD | Oscillator | 12,26,9 |
| Stochastic (KDJ) | KDJ | Oscillator | 14 |
| Commodity Channel Index | CCI | Oscillator | 20 |
| Williams %R | WR | Oscillator | 14 |
| Bollinger Bands | BOLL | Overlay | 20 |
| Average True Range | ATR | Volatility | 14 |
| Average Directional Index | ADX | Trend | 14 |
| Parabolic SAR | SAR | Overlay | - |
| On-Balance Volume | OBV | Volume | - |

## 🧪 Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## 📝 Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 🤝 Contributing

This is a private educational platform. For questions or suggestions, contact the maintainer.

## 📜 License

Private - All Rights Reserved

## 🔗 Resources

- [KLineChart Documentation](https://klinecharts.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Zustand Documentation](https://zustand-demo.pmnd.rs/)

---

**Built with ❤️ for Indonesian traders**
