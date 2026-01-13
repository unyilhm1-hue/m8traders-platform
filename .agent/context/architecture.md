# M8Traders Platform Architecture

> Quick reference for project structure and patterns

---

## System Overview

```mermaid
graph TB
    subgraph "Frontend (Next.js 16)"
        A[App Router Pages] --> B[Client Components]
        A --> C[Server Components]
        B --> D[Zustand Stores]
        B --> E[KLineChart]
    end
    
    subgraph "Stores (Zustand)"
        D --> F[useChartStore]
        D --> G[useTradingStore]
        D --> H[useChallengeStore]
    end
    
    subgraph "Core Modules"
        I[Trading Engine] --> G
        J[Challenge System] --> H
        K[Chart Manager] --> F
    end
    
    subgraph "Data Layer"
        L[(Historical Data)]
        M[API Routes]
    end
    
    M --> L
    A --> M
```

---

## Route Groups

| Group | Path | Purpose |
|-------|------|---------|
| `(auth)` | `/login`, `/register` | Authentication |
| `(dashboard)` | `/`, `/profile`, `/stats` | User dashboard |
| `(simulation)` | `/sim/*` | Trading simulator |
| `(learn)` | `/learn/*` | Learning modules |
| `(challenges)` | `/challenges/*` | Challenge system |

---

## Data Flow

### Trading Simulation Flow
```mermaid
sequenceDiagram
    participant U as User
    participant C as Chart
    participant T as TradingStore
    participant E as TradingEngine
    
    U->>C: Analyze chart
    U->>T: Submit order
    T->>E: Validate & execute
    E-->>T: Update state
    T-->>C: Sync position
    C-->>U: Show trade markers
```

### Challenge Flow
```mermaid
sequenceDiagram
    participant U as User
    participant S as ChallengeStore
    participant E as Evaluator
    
    U->>S: Start challenge
    S->>U: Load scenario
    U->>S: Submit answer
    S->>E: Evaluate
    E-->>S: Score & feedback
    S-->>U: Show results
```

---

## Key Components

### Chart (KLineChart)
- `TradingChart.tsx` - Main chart wrapper
- `ChartControls.tsx` - Timeframe, indicators
- `DrawingTools.tsx` - Line, fib, patterns

### Trading Panel
- `OrderPanel.tsx` - Buy/Sell form
- `PositionDisplay.tsx` - Current position
- `TradeHistory.tsx` - Past trades

### Challenge System
- `ChallengeCard.tsx` - Challenge preview
- `ChallengePlayer.tsx` - Active challenge
- `ScoreDisplay.tsx` - Results & feedback

---

## Store Schemas

### ChartStore
```typescript
{
  ticker: string;
  timeframe: Timeframe;
  indicators: Indicator[];
  drawings: Drawing[];
  theme: 'dark' | 'light';
}
```

### TradingStore
```typescript
{
  balance: number;
  position: Position | null;
  trades: Trade[];
  stats: TradingStats;
}
```

### ChallengeStore
```typescript
{
  activeChallengeId: string | null;
  progress: Map<string, ChallengeProgress>;
  scores: ChallengeScore[];
}
```

---

**Last Updated**: 2026-01-12
