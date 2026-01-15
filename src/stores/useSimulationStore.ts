/**
 * Simulation Store - High-frequency tick data from Web Worker
 * Uses Zustand for efficient streaming updates
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { TickData } from '@/hooks/useSimulationWorker';
import type { Candle } from '@/types';

// ============================================================================
// Types
// ============================================================================

// Lightweight Charts compatible format
export interface ChartCandle {
    time: number; // Unix timestamp in SECONDS (Lightweight Charts requirement)
    open: number;
    high: number;
    low: number;
    close: number;
}

export interface OrderbookLevel {
    price: number;
    volume: number;
    count: number;
}

export interface TradeRecord {
    price: number;
    volume: number;
    timestamp: number;
    side: 'buy' | 'sell';
}

interface SimulationState {
    // Tick state
    currentTick: TickData | null;
    tickHistory: TickData[];
    maxTickHistory: number;

    // Price state
    currentPrice: number;
    lastPrice: number;
    priceChange: number;
    priceChangePercent: number;

    // Candle state (for Lightweight Charts)
    candleHistory: ChartCandle[]; // Full historical candles (pre-selected date)
    currentCandle: ChartCandle | null; // Live candle being built

    // Select Date Replay
    selectedDate: string | null; // YYYY-MM-DD format
    simulationCandles: Candle[]; // Candles for selected date (simulation queue)

    // Orderbook simulation (Level 2)
    orderbookBids: OrderbookLevel[];
    orderbookAsks: OrderbookLevel[];
    orderbookDepth: number;

    // Time & Sales
    recentTrades: TradeRecord[];
    maxTradeHistory: number;

    // Volume metrics
    cumulativeVolume: number;

    // Actions
    pushTick: (tick: TickData) => void;
    setCandleHistory: (candles: Candle[]) => void; // Set initial history from worker
    updateCurrentCandle: (candle: ChartCandle) => void; // Update live candle
    loadSimulationDay: (date: string, allCandles: Candle[]) => { historyCount: number; simCount: number; error: string | null }; // NEW: Smart data split
    reset: () => void;
    setOrderbookDepth: (depth: number) => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState = {
    currentTick: null,
    tickHistory: [],
    maxTickHistory: 100,

    currentPrice: 0,
    lastPrice: 0,
    priceChange: 0,
    priceChangePercent: 0,

    candleHistory: [],
    currentCandle: null,

    selectedDate: null,
    simulationCandles: [],

    orderbookBids: [],
    orderbookAsks: [],
    orderbookDepth: 10,

    recentTrades: [],
    maxTradeHistory: 50,

    cumulativeVolume: 0,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate synthetic orderbook from current price
 * Simulates realistic bid/ask spread and depth
 */
function generateOrderbook(
    price: number,
    depth: number = 10
): { bids: OrderbookLevel[]; asks: OrderbookLevel[] } {
    const bids: OrderbookLevel[] = [];
    const asks: OrderbookLevel[] = [];

    // Spread: 0.01% - 0.05%
    const spreadPercent = 0.0001 + Math.random() * 0.0004;
    const spread = price * spreadPercent;
    const tickSize = spread / 4; // 4 levels within spread

    // Generate bids (below current price)
    for (let i = 0; i < depth; i++) {
        const levelPrice = price - spread - (i * tickSize);
        const volume = Math.floor(1000 + Math.random() * 5000);
        const count = Math.floor(1 + Math.random() * 10);

        bids.push({
            price: Math.round(levelPrice * 100) / 100,
            volume,
            count,
        });
    }

    // Generate asks (above current price)
    for (let i = 0; i < depth; i++) {
        const levelPrice = price + spread + (i * tickSize);
        const volume = Math.floor(1000 + Math.random() * 5000);
        const count = Math.floor(1 + Math.random() * 10);

        asks.push({
            price: Math.round(levelPrice * 100) / 100,
            volume,
            count,
        });
    }

    return { bids, asks };
}

/**
 * Determine trade side based on price movement
 */
function determineTradeSide(currentPrice: number, lastPrice: number): 'buy' | 'sell' {
    if (currentPrice > lastPrice) {
        return 'buy';
    } else if (currentPrice < lastPrice) {
        return 'sell';
    } else {
        // No change, random
        return Math.random() > 0.5 ? 'buy' : 'sell';
    }
}

// ============================================================================
// Store
// ============================================================================

export const useSimulationStore = create<SimulationState>()(
    immer((set) => ({
        ...initialState,

        pushTick(tick) {
            set((state) => {
                const lastPrice = state.currentPrice;
                const currentPrice = tick.price;

                // Update tick state
                state.currentTick = tick;
                state.tickHistory.push(tick);

                // Trim history
                if (state.tickHistory.length > state.maxTickHistory) {
                    state.tickHistory.shift();
                }

                // Update price state
                state.lastPrice = lastPrice;
                state.currentPrice = currentPrice;

                if (lastPrice > 0) {
                    state.priceChange = currentPrice - lastPrice;
                    state.priceChangePercent = (state.priceChange / lastPrice) * 100;
                }

                // Update cumulative volume
                state.cumulativeVolume += tick.volume;

                // Generate synthetic orderbook
                const { bids, asks } = generateOrderbook(currentPrice, state.orderbookDepth);
                state.orderbookBids = bids;
                state.orderbookAsks = asks;

                // Add to time & sales
                if (tick.volume > 0) {
                    const trade: TradeRecord = {
                        price: currentPrice,
                        volume: tick.volume,
                        timestamp: tick.timestamp,
                        side: determineTradeSide(currentPrice, lastPrice),
                    };

                    state.recentTrades.unshift(trade); // Add to front

                    // Trim trade history
                    if (state.recentTrades.length > state.maxTradeHistory) {
                        state.recentTrades.pop();
                    }
                }
            });
        },

        setCandleHistory(candles) {
            set((state) => {
                const converted: ChartCandle[] = [];

                candles.forEach((c, index) => {
                    let timeInSeconds: number;

                    // --- SANITASI EXTREME ---
                    // Handle semua kemungkinan format timestamp dari JSON/API
                    const rawTime = c.t as any;

                    if (typeof rawTime === 'number') {
                        timeInSeconds = rawTime > 10000000000 ? Math.floor(rawTime / 1000) : rawTime;
                    } else if (rawTime instanceof Date) {
                        timeInSeconds = Math.floor(rawTime.getTime() / 1000);
                    } else if (typeof rawTime === 'string') {
                        // Parse string ISO "2025-..."
                        const parsed = new Date(rawTime).getTime() / 1000;
                        timeInSeconds = isNaN(parsed) ? 0 : Math.floor(parsed);
                    } else {
                        // Fallback safety
                        console.error(`[SimulationStore] Invalid timestamp at index ${index}:`, rawTime, typeof rawTime);
                        timeInSeconds = Math.floor(Date.now() / 1000);
                    }

                    // Push data bersih
                    converted.push({
                        time: timeInSeconds,
                        open: c.o,
                        high: c.h,
                        low: c.l,
                        close: c.c,
                    });
                });

                // Sortir paksa di store untuk menjamin urutan
                converted.sort((a, b) => a.time - b.time);

                state.candleHistory = converted;
                console.log(`[SimulationStore] ✅ Converted ${converted.length} candles, first time=${converted[0]?.time}, last time=${converted[converted.length - 1]?.time}`);
            });
        },

        updateCurrentCandle(candle) {
            set((state) => {
                state.currentCandle = candle;
            });
        },

        loadSimulationDay(date, allCandles) {
            return set((state) => {
                console.log(`[SimulationStore] Loading simulation for date: ${date}`);
                console.log(`[SimulationStore] Total candles available: ${allCandles.length}`);

                // Parse selected date
                const selectedDate = new Date(date);

                // Check if weekend
                const dayOfWeek = selectedDate.getDay();
                if (dayOfWeek === 0 || dayOfWeek === 6) {
                    console.warn(`[SimulationStore] ⚠️ Warning: ${date} is a weekend!`);
                    // Continue anyway - user might have weekend data
                }

                // Market hours: 09:00 AM - 04:00 PM
                const marketOpen = new Date(selectedDate);
                marketOpen.setHours(9, 0, 0, 0);
                const marketOpenTimestamp = Math.floor(marketOpen.getTime() / 1000);

                const marketClose = new Date(selectedDate);
                marketClose.setHours(16, 0, 0, 0);
                const marketCloseTimestamp = Math.floor(marketClose.getTime() / 1000);

                console.log(`[SimulationStore] Market hours: ${marketOpenTimestamp} (09:00) to ${marketCloseTimestamp} (16:00)`);

                // Split data into History Context and Simulation Queue
                const historyContext: Candle[] = [];
                const simulationQueue: Candle[] = [];

                allCandles.forEach((candle) => {
                    const candleTime = candle.t > 10000000000
                        ? Math.floor(candle.t / 1000)
                        : candle.t;

                    if (candleTime < marketOpenTimestamp) {
                        // Before market open → History Context
                        historyContext.push(candle);
                    } else if (candleTime >= marketOpenTimestamp && candleTime <= marketCloseTimestamp) {
                        // During market hours → Simulation Queue
                        simulationQueue.push(candle);
                    }
                    // After market close → Discard
                });

                // Sort both arrays by time (ascending)
                historyContext.sort((a, b) => {
                    const aTime = a.t > 10000000000 ? a.t / 1000 : a.t;
                    const bTime = b.t > 10000000000 ? b.t / 1000 : b.t;
                    return aTime - bTime;
                });

                simulationQueue.sort((a, b) => {
                    const aTime = a.t > 10000000000 ? a.t / 1000 : a.t;
                    const bTime = b.t > 10000000000 ? b.t / 1000 : b.t;
                    return aTime - bTime;
                });

                console.log(`[SimulationStore] Split complete:`);
                console.log(`  - History Context: ${historyContext.length} candles`);
                console.log(`  - Simulation Queue: ${simulationQueue.length} candles`);

                // ✅ SAFETY CHECK: Empty simulation data
                if (simulationQueue.length === 0) {
                    console.error(`[SimulationStore] ❌ FATAL: No simulation data for ${date}!`);
                    console.error(`  This could mean:`);
                    console.error(`  - Weekend/Holiday (no market activity)`);
                    console.error(`  - No data in market hours (09:00-16:00)`);
                    console.error(`  - Wrong date format or timezone issue`);

                    return {
                        historyCount: historyContext.length,
                        simCount: 0,
                        error: 'No simulation data available for this date. Try a different date or check if market was open.'
                    };
                }

                // Verify strict separation
                if (historyContext.length > 0 && simulationQueue.length > 0) {
                    const lastHistory = historyContext[historyContext.length - 1];
                    const firstSim = simulationQueue[0];
                    const lastHistTime = lastHistory.t > 10000000000 ? lastHistory.t / 1000 : lastHistory.t;
                    const firstSimTime = firstSim.t > 10000000000 ? firstSim.t / 1000 : firstSim.t;

                    console.log(`  - Validation: Last history=${lastHistTime}, First sim=${firstSimTime}`);
                    if (lastHistTime >= firstSimTime) {
                        console.error('❌ FATAL: History overlaps with simulation! This will cause chart errors.');
                        return {
                            historyCount: historyContext.length,
                            simCount: simulationQueue.length,
                            error: 'Data integrity error: timestamp overlap detected'
                        };
                    } else {
                        console.log('✅ Validation passed: History < Simulation');
                    }
                }

                // Update state
                state.selectedDate = date;
                state.simulationCandles = simulationQueue;

                // Convert history to ChartCandle format
                const converted: ChartCandle[] = [];
                historyContext.forEach((c) => {
                    const timeInSeconds = c.t > 10000000000
                        ? Math.floor(c.t / 1000)
                        : c.t;

                    converted.push({
                        time: timeInSeconds,
                        open: c.o,
                        high: c.h,
                        low: c.l,
                        close: c.c,
                    });
                });

                state.candleHistory = converted;

                console.log(`[SimulationStore] ✅ Ready for simulation!`);
                console.log(`  - Selected Date: ${date}`);
                console.log(`  - Full Day: 00:00 - 23:59`);
                console.log(`  - Simulation Candles: ${simulationQueue.length}`);

                // Return counts for caller confirmation
                return {
                    historyCount: historyContext.length,
                    simCount: simulationQueue.length,
                    error: null
                };
            });
        },

        reset() {
            set(() => ({ ...initialState }));
        },

        setOrderbookDepth(depth) {
            set((state) => {
                state.orderbookDepth = depth;
            });
        },
    }))
);

// ============================================================================
// Selector hooks for better performance
export const useCurrentTick = () => useSimulationStore((s) => s.currentTick);
export const useCurrentPrice = () => useSimulationStore((s) => s.currentPrice);
export const usePriceChange = () => useSimulationStore((s) => ({
    change: s.priceChange,
    percent: s.priceChangePercent,
}));
export const useCandleHistory = () => useSimulationStore((s) => s.candleHistory);
export const useCurrentCandle = () => useSimulationStore((s) => s.currentCandle);
export const useSelectedDate = () => useSimulationStore((s) => s.selectedDate);
export const useSimulationCandles = () => useSimulationStore((s) => s.simulationCandles);

// ✅ FIX: Use individual selectors to avoid object re-creation
export const useOrderbookBids = () => useSimulationStore((state) => state.orderbookBids);
export const useOrderbookAsks = () => useSimulationStore((state) => state.orderbookAsks);

// Alternative: Combined selector with shallow comparison (if you prefer single hook)
export const useOrderbook = () => {
    const bids = useSimulationStore((state) => state.orderbookBids);
    const asks = useSimulationStore((state) => state.orderbookAsks);
    return { bids, asks };
};
export const useRecentTrades = () => useSimulationStore((state) => state.recentTrades);
