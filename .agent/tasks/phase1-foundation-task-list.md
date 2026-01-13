# Phase 1: Core Foundation Setup

## 🎯 Objective
Setup core dependencies, Zustand stores, dan basic chart component untuk foundation platform.

---

## 📋 Tasks Checklist

### Dependencies
- [/] Install core dependencies (klinecharts, zustand, immer, nanoid)
- [ ] Install testing dependencies (vitest, testing-library, playwright)
- [ ] Configure Vitest

### Stores (Zustand)
- [ ] Create `useChartStore.ts` - chart state (timeframe, indicators, drawings)
- [ ] Create `useTradingStore.ts` - trading session (balance, positions, trades)
- [ ] Create `useChallengeStore.ts` - challenge progress
- [ ] Create `useUserStore.ts` - user preferences

### Chart Foundation
- [ ] Create chart config & theme loader
- [ ] Create `TradingChart.tsx` - KLineChart wrapper  
- [ ] Create `ChartControls.tsx` - timeframe selector, indicators toggle
- [ ] Create sample data loader (for development)

### UI Components
- [ ] Create `Button.tsx` - base button component
- [ ] Create `Card.tsx` - card component
- [ ] Create `Select.tsx` - dropdown select

### Trading Panel (Basic)
- [ ] Create `OrderPanel.tsx` - buy/sell form placeholder
- [ ] Create `PositionDisplay.tsx` - position info placeholder

### Demo Page
- [ ] Create `/sim/demo` route with working chart

---

## 📁 Files to Create

```
src/
├── stores/
│   ├── useChartStore.ts
│   ├── useTradingStore.ts
│   ├── useChallengeStore.ts
│   └── useUserStore.ts
├── lib/
│   └── chart/
│       ├── config.ts
│       ├── theme.ts
│       └── sampleData.ts
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   └── Select.tsx
│   └── chart/
│       ├── TradingChart.tsx
│       └── ChartControls.tsx
└── app/
    └── (simulation)/
        └── sim/
            └── demo/
                └── page.tsx
```

---

## 🧪 Testing Checklist
- [ ] Chart renders without error
- [ ] Store hydration works
- [ ] Sample data displays correctly
- [ ] Mobile responsive

---

**Status**: 🔄 In Progress
**Started**: 2026-01-12
