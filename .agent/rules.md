# M8Traders Platform - Project Agent Rules

> **Project Type**: Trading Education Platform (Hybrid Learning + Simulation)  
> **Stack**: Next.js 16 (App Router) + React 19 + TypeScript + Tailwind 4 + KLineChart

---

## 0) Project Identity

**M8Traders** adalah platform edukasi trading dengan fokus pada:
1. **Fundamental** - Pemahaman dasar market
2. **Technical Analysis** - Chart reading, patterns, indicators
3. **Emotional Control** - Psychology management, discipline training

**Tagline**: *"Learn Like a Pro, Trade Like a Machine"*

---

## 1) Tech Stack & Dependencies

### Core (Already Installed)
```json
{
  "next": "16.x",
  "react": "19.x",
  "typescript": "5.x",
  "tailwindcss": "4.x"
}
```

### To Install (Phase 1)
```json
{
  "klinecharts": "^10.x",       // Trading chart
  "zustand": "^5.x",            // State management
  "immer": "^10.x"              // Immutable state (zustand middleware)
}
```

### Testing (Phase 1)
```json
{
  "vitest": "^3.x",
  "@testing-library/react": "^16.x",
  "@testing-library/user-event": "^14.x",
  "@playwright/test": "^1.x"
}
```

---

## 2) Architecture Patterns

### 2.1 Directory Structure
```
src/
├── app/                     # Next.js App Router pages
│   ├── (auth)/              # Auth route group
│   ├── (dashboard)/         # Dashboard route group
│   ├── (simulation)/        # Trading simulation
│   └── (learn)/             # Learning modules
├── components/
│   ├── ui/                  # Reusable UI primitives
│   ├── chart/               # KLineChart components
│   ├── trading/             # Trading-specific components
│   └── learn/               # Learning module components
├── hooks/                   # Custom React hooks
├── lib/
│   ├── chart/               # KLineChart config & utilities
│   ├── trading/             # Trading engine logic
│   └── challenges/          # Challenge system logic
├── stores/                  # Zustand stores
├── types/                   # TypeScript types (already created)
└── utils/                   # General utilities
```

### 2.2 Component Patterns

**Server Components (default)**:
- Data fetching
- Static content
- SEO-critical pages

**Client Components ('use client')**:
- Interactive UI (buttons, forms)
- Chart components (KLineChart)
- Real-time state (trading panel)
- Hooks usage

```tsx
// ✅ Good: Client component for chart
'use client';
import { useEffect, useRef } from 'react';
import { init } from 'klinecharts';

export function TradingChart() {
  const chartRef = useRef<HTMLDivElement>(null);
  // ...
}

// ✅ Good: Server component for data
export default async function DashboardPage() {
  const challenges = await fetchChallenges();
  return <ChallengeList challenges={challenges} />;
}
```

### 2.3 State Management (Zustand)

**Store Structure**:
```
stores/
├── useChartStore.ts         # Chart state (timeframe, indicators, drawings)
├── useTradingStore.ts       # Trading session (balance, positions, trades)
├── useChallengeStore.ts     # Challenge progress & scores
└── useUserStore.ts          # User preferences & auth
```

**Store Pattern**:
```typescript
// ✅ Correct pattern
import { create } from 'zustand';
import { persist, immer } from 'zustand/middleware';

interface TradingState {
  balance: number;
  position: Position | null;
  trades: Trade[];
  // Actions
  executeTrade: (order: OrderRequest) => void;
  resetSession: () => void;
}

export const useTradingStore = create<TradingState>()(
  persist(
    immer((set) => ({
      balance: 100000,
      position: null,
      trades: [],
      
      executeTrade: (order) => set((state) => {
        // Immer allows direct mutations
        state.trades.push({ ...order, id: nanoid() });
      }),
      
      resetSession: () => set({ balance: 100000, position: null, trades: [] }),
    })),
    { name: 'trading-session' }
  )
);
```

---

## 3) KLineChart Integration

### 3.1 Chart Component Pattern

```tsx
'use client';

import { useEffect, useRef, useCallback } from 'react';
import { init, dispose, Chart, KLineData } from 'klinecharts';
import { useChartStore } from '@/stores/useChartStore';

export function TradingChart() {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<Chart | null>(null);
  const { timeframe, indicators } = useChartStore();
  
  useEffect(() => {
    if (!chartRef.current) return;
    
    // Initialize chart
    chartInstance.current = init(chartRef.current, {
      styles: getChartTheme(),
    });
    
    return () => {
      if (chartInstance.current) {
        dispose(chartRef.current!);
      }
    };
  }, []);
  
  // Update data when timeframe changes
  useEffect(() => {
    if (!chartInstance.current) return;
    loadChartData(timeframe).then(data => {
      chartInstance.current?.applyNewData(data);
    });
  }, [timeframe]);
  
  return <div ref={chartRef} className="w-full h-full" />;
}
```

### 3.2 Chart Data Format

KLineChart expects this format:
```typescript
interface KLineData {
  timestamp: number;    // Unix timestamp (ms)
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  turnover?: number;    // Optional
}
```

**Mapping from our types**:
```typescript
// Our Candle type → KLineData
const toKLineData = (candle: Candle): KLineData => ({
  timestamp: candle.t,
  open: candle.o,
  high: candle.h,
  low: candle.l,
  close: candle.c,
  volume: candle.v,
});
```

---

## 4) Coding Standards

### 4.1 TypeScript Strict Mode
- Enable all strict options in `tsconfig.json`
- No `any` without justification (use `unknown` + type guards)
- Prefer `interface` for object shapes, `type` for unions

### 4.2 Component Conventions
- **Naming**: PascalCase for components, camelCase for hooks
- **Files**: `ComponentName.tsx`, `useHookName.ts`
- **Props**: Define interface with `Props` suffix

```typescript
interface TradingPanelProps {
  ticker: string;
  onTrade: (order: OrderRequest) => void;
  disabled?: boolean;
}

export function TradingPanel({ ticker, onTrade, disabled = false }: TradingPanelProps) {
  // ...
}
```

### 4.3 Error Handling
- Use Result pattern for trading operations
- Never swallow errors silently
- Log errors with context

```typescript
type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

const executeTrade = (order: OrderRequest): Result<Trade> => {
  if (order.shares <= 0) {
    return { success: false, error: new Error('Invalid shares') };
  }
  // ...
};
```

---

## 5) Testing Protocol

### 5.1 Unit Tests (Vitest)
- Trading calculations (PnL, position sizing, risk management)
- Challenge scoring logic
- Utility functions

```typescript
// __tests__/trading/calculatePnL.test.ts
import { describe, it, expect } from 'vitest';
import { calculatePnL } from '@/lib/trading/calculations';

describe('calculatePnL', () => {
  it('calculates profit correctly for long position', () => {
    const result = calculatePnL({
      entryPrice: 100,
      exitPrice: 110,
      shares: 10,
      type: 'LONG'
    });
    expect(result.absolute).toBe(100);
    expect(result.percentage).toBe(10);
  });
});
```

### 5.2 Component Tests (Testing Library)
- User interactions (click, type, submit)
- State changes reflected in UI
- Error states displayed

### 5.3 E2E Tests (Playwright)
- Complete trading flow (load chart → analyze → trade → review)
- Challenge completion flow
- Authentication flows

---

## 6) Performance Guidelines

### 6.1 Chart Performance
- Use `requestAnimationFrame` for chart updates
- Limit visible data points (performance mode)
- Debounce resize handlers

### 6.2 State Performance
- Use Zustand selectors to prevent unnecessary re-renders
- Memoize expensive calculations

```typescript
// ✅ Good: Selective subscription
const balance = useTradingStore((state) => state.balance);

// ❌ Bad: Full store subscription
const store = useTradingStore();
```

### 6.3 Bundle Size
- Dynamic import for heavy components
- Lazy load chart on route

```tsx
import dynamic from 'next/dynamic';

const TradingChart = dynamic(
  () => import('@/components/chart/TradingChart'),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
```

---

## 7) Security Rules

### 7.1 API Keys
- NEVER expose API keys in client code
- Use Next.js API routes as proxy
- Store secrets in `.env.local` (never commit)

### 7.2 Data Validation
- Validate all user inputs (Zod recommended)
- Sanitize before storing/displaying
- Rate limit API endpoints

---

## 8) Debugging Protocol

### 8.1 Chart Issues
1. Check console for KLineChart errors
2. Verify data format matches `KLineData`
3. Check container has width/height
4. Verify dispose() called on cleanup

### 8.2 State Issues
1. Use Zustand DevTools
2. Check persist hydration
3. Verify selector usage

### 8.3 Trading Logic Issues
1. Log trade execution steps
2. Verify calculations with unit tests
3. Check position state consistency

---

## 9) Definition of Done

For any feature/fix to be complete:

- [ ] TypeScript compiles without errors
- [ ] All related tests pass
- [ ] No console errors/warnings
- [ ] Mobile responsive (360px+)
- [ ] Reduced motion supported
- [ ] Code follows project patterns
- [ ] Documentation updated if needed

---

**Last Updated**: 2026-01-12  
**Version**: 1.0
