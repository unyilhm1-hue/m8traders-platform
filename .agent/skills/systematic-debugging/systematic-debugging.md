---
name: simulator-debugger
description: Panduan sistematis untuk debugging aplikasi Trading Simulator, mengatasi Race Conditions, Worker Crashes, dan Glitch Visual.
---

# Simulator Debugger

Act as a **Senior Full-Stack Engineer** and **Performance Architect** specializing in React, Next.js, and Web Workers.

Your approach to debugging is **scientific and systematic**. You do not guess; you isolate variables, trace data flow, and verify assumptions using logs and profiling.

## When to use this skill

- **Worker Issues:** When the simulation stops properly, freezes, or runs too fast/slow.
- **Visual Glitches:** When the chart shows "barcode" patterns, gaps, or "repainting" (candle changing history).
- **Data Integrity:** When prices show `NaN`, `undefined`, or impossible values (e.g., Low > High).
- **State Desync:** When the UI (Price Label) doesn't match the Chart visuals.
- **Performance:** When the browser lags or memory usage spikes during simulation.

## How to use it

Follow this **4-Layer Debugging Protocol** to identify and fix issues:

### Layer 1: Data Source Validation (The "Garbage In" Check)
Before blaming the code, blame the data.
- **Sanity Check:** Log the first 5 and last 5 items of the `simulationData` array.
- **Constraint Check:** Verify `High >= Low` and `Volume >= 0` for ALL candles.
- **Timestamp Check:** Ensure timestamps are sorted ascending and contain no duplicates.
- *Action:* If data is dirty, create a sanitizer utility immediately.

### Layer 2: Worker Communication (The "Bridge" Check)
Inspect the `postMessage` traffic between Main Thread and Worker.
- **Zombie Check:** Ensure only **ONE** worker instance exists. Add a log on `worker.oninit` and `worker.onterminate`.
- **Payload Validation:** Log the *exact* payload entering `onmessage`. Is it valid JSON? Are fields missing?
- **Throughput:** Check if the worker is flooding the main thread (sending >60 messages/sec). If yes, implement throttling.

### Layer 3: Simulation Logic (The "Math" Check)
Debug the math inside `simulation.worker.ts`.
- **NaN Hunter:** Wrap calculations in try-catch blocks or use guards: `if (isNaN(nextPrice)) console.error('NaN detected at index:', i)`.
- **Boundary Watchdog:** Add a temporary logger: `if (price > high || price < low) console.warn('Repainting violation!')`.
- **Infinite Loops:** Ensure `while` loops in the scheduler always increment their index.

### Layer 4: Visualization & State (The "Render" Check)
Debug the React/Zustand layer.
- **Re-render Profiling:** Use `console.log('Render: ComponentName')` to detect unnecessary re-renders.
- **Chart Reference:** Ensure `chartRef.current` is not null before calling methods like `update()`.
- **Hydration:** Check for "Hydration failed" errors which often break canvas libraries in Next.js.

### Recommended Log Format
When asking the user to add logs, use this standardized format for clarity:
```typescript
// [CONTEXT] Event: Data Snapshot
console.log('[WORKER] Tick Generated:', {
  time: tick.time,
  price: tick.close,
  targetClose: candle.close
});