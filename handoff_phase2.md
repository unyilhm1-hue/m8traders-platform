# Phase 2 Handoff: Chart Enhancements

**Date**: 2026-01-12  
**Phase**: 2 - Chart Enhancements  
**Status**: Ready for Implementation

---

## Context

The m8traders platform currently uses KLineChart with basic integration and sample data. Phase 1 successfully established:
- ✅ KLineChart component wrapper
- ✅ Zustand stores (chart, trading, challenge, user)
- ✅ Basic UI components (Button, Card, Select, Input)
- ✅ Demo page with trading panel
- ✅ Supabase authentication
- ✅ Basic indicator support (SMA, EMA, RSI, MACD, Bollinger, VWAP)

**Phase 2 Goal**: Transform the chart into a production-ready component with real stock data, dynamic ticker/timeframe selection, and comprehensive indicator integration.

---

## What Needs to Be Built

### 1. **Real Stock Data Integration**
Currently using `getSampleTickerData()` which returns hardcoded data. Need:
- API endpoint or file-based data loading
- Support for multiple tickers (US: AAPL, GOOGL, MSFT, TSLA / IDX: BBCA.JK, BBRI.JK, TLKM.JK)
- Multiple timeframes (1m, 5m, 15m, 30m, 1h, 4h, 1d)
- Caching strategy for performance

### 2. **Ticker Selection UI**
User needs ability to switch between different stocks:
- Dropdown/Select component with search
- Grouped by market (US / IDX)
- Display: Symbol + Company Name
- Persist selection in localStorage

### 3. **Timeframe Selection UI**
Currently locked to 5m timeframe. Need:
- Button group for quick switching
- Visual active state
- Trigger data refetch on change
- Persist in localStorage

### 4. **Comprehensive Indicator Integration**
Expand beyond basic indicators to include:
- All KLineChart built-in indicators
- Proper configuration (periods, colors, overlay vs separate pane)
- Settings panel for customization
- Toggle on/off functionality (already partially working)

---

## Technical Requirements

### Data Service Requirements
```typescript
// src/lib/chart/dataService.ts
interface DataService {
  fetchStockData(ticker: string, timeframe: Timeframe): Promise<Candle[]>;
  getCachedData(ticker: string, timeframe: Timeframe): Candle[] | null;
  updateCache(ticker: string, timeframe: Timeframe, data: Candle[]): void;
}
```

### API Endpoint (if using server-side)
```
GET /api/stocks/[ticker]?timeframe=5m&limit=200
Response: { ticker, timeframe, data: Candle[], timestamp }
```

### Component Requirements
```tsx
<TickerSelector 
  value={ticker} 
  onChange={setTicker} 
  tickers={AVAILABLE_TICKERS}
/>

<TimeframeSelector 
  value={timeframe} 
  onChange={setTimeframe}
  options={['1m', '5m', '15m', '30m', '1h', '4h', '1d']}
/>
```

---

## KLineChart Indicators Reference

Based on [KLineChart v9.0.0 docs](https://github.com/liihuu/KLineChart), supported indicators:

### Overlay Indicators (on main chart pane)
- `MA` - Simple Moving Average
- `EMA` - Exponential Moving Average
- `BOLL` - Bollinger Bands
- `SAR` - Parabolic SAR

### Separate Pane Indicators
- `VOL` - Volume (already implemented)
- `MACD` - Moving Average Convergence Divergence (already implemented)
- `RSI` - Relative Strength Index (already implemented)
- `KDJ` - Stochastic Oscillator
- `CCI` - Commodity Channel Index
- `DMI` / `ADX` - Directional Movement Index
- `CR` - Energy Index
- `PSY` - Psychological Line
- `DMA` - Different Moving Average
- `TRIX` - Triple Exponentially Smoothed Average
- `OBV` - On-Balance Volume
- `VR` - Volume Ratio
- `WR` - Williams %R
- `MTM` - Momentum
- `EMV` - Ease of Movement
- `AO` - Awesome Oscillator

### Custom Indicators
KLineChart also supports custom indicator creation if needed.

---

## Current File Structure

```
src/
├── app/
│   └── (protected)/sim/demo/page.tsx       # Demo page using chart
├── components/
│   ├── chart/
│   │   ├── TradingChart.tsx                # Main chart component
│   │   ├── ChartControls.tsx               # Controls (needs enhancement)
│   │   └── index.ts
│   ├── trading/
│   │   ├── OrderPanel.tsx
│   │   └── PositionDisplay.tsx
│   └── ui/                                  # Basic UI components
├── lib/
│   ├── chart/
│   │   ├── config.ts                        # Indicator configs
│   │   ├── theme.ts                         # Chart theme
│   │   ├── sampleData.ts                    # Sample data (to replace)
│   │   └── index.ts
│   └── trading/
│       └── engine.ts                        # Trading engine
├── stores/
│   ├── useChartStore.ts                     # Chart state
│   ├── useTradingStore.ts                   # Trading state
│   └── index.ts
└── types/
    └── index.ts                             # Type definitions
```

---

## Files to Create

1. `src/lib/chart/dataService.ts` - Data fetching service
2. `src/components/chart/TickerSelector.tsx` - Ticker dropdown
3. `src/components/chart/TimeframeSelector.tsx` - Timeframe buttons
4. `src/app/api/stocks/[ticker]/route.ts` - API endpoint (optional)
5. `src/lib/chart/tickers.ts` - Ticker list data

---

## Files to Modify

1. `src/components/chart/TradingChart.tsx` - Use real data service
2. `src/components/chart/ChartControls.tsx` - Add new selectors
3. `src/stores/useChartStore.ts` - Add loading/error states
4. `src/lib/chart/config.ts` - Expand indicator configs
5. `src/types/index.ts` - Add new types (Ticker, StockDataResponse)

---

## Questions to Resolve

> **CRITICAL DECISION NEEDED**: Data Source Strategy
> 
> Please choose one:
> 1. **API-based** (Alpha Vantage, Twelve Data, Yahoo Finance wrapper)
> 2. **File-based** (Pre-downloaded CSV/JSON in `/public/data`)
> 3. **Hybrid** (Local cache + API fallback) ← **Recommended**
> 
> This affects implementation approach significantly.

---

## Success Criteria

Phase 2 is complete when:

- ✅ User can select from 10+ different stock tickers
- ✅ User can switch between 1m, 5m, 15m, 30m, 1h, 4h, 1d timeframes
- ✅ Chart displays real historical data (not sample data)
- ✅ All major KLineChart indicators are available and functional
- ✅ Indicator settings can be adjusted (period, color)
- ✅ Data loading states are handled gracefully
- ✅ Selection persists across page reloads
- ✅ Performance is smooth (< 500ms data load time)

---

## Next Steps After Phase 2

**Phase 3 Preview**: Advanced Trading Tools
- Drawing tools (trendlines, fibonacci, rectangles)
- Pattern recognition system
- Multi-timeframe analysis
- Trade replay functionality

---

## Resources

- [KLineChart Documentation](https://klinecharts.com/)
- [KLineChart GitHub](https://github.com/liihuu/KLineChart)
- [Zustand Documentation](https://zustand-demo.pmnd.rs/)
- Current implementation: `/src/components/chart/TradingChart.tsx`

---

**Ready to proceed?** Review the [implementation_plan.md](cci:1://file:///C:/Users/laras/.gemini/antigravity/brain/53667341-2c81-4f71-b8f0-4d37c810c12e/implementation_plan.md:0:0-0:0) for detailed technical approach.
