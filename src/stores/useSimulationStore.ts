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

        loadSimulationDay: (date, allCandles) => {
            console.log(`[SimulationStore] Loading simulation for date: ${date}`);

            // --- 1. LOGIKA HITUNGAN (Di luar 'set' agar bisa di-return) ---
            const selectedDate = new Date(date);

            // Market hours (WIB adjustment might be needed, but assuming local 09:00-16:00)
            const marketOpen = new Date(selectedDate);
            marketOpen.setHours(9, 0, 0, 0);
            const marketOpenTimestamp = Math.floor(marketOpen.getTime() / 1000);

            const marketClose = new Date(selectedDate);
            marketClose.setHours(16, 0, 0, 0);
            const marketCloseTimestamp = Math.floor(marketClose.getTime() / 1000);

            console.log(`[SimulationStore] Market hours: ${marketOpenTimestamp} (09:00) to ${marketCloseTimestamp} (16:00)`);

            // Filter Arrays
            const historyContext: Candle[] = [];
            const simulationQueue: Candle[] = [];

            allCandles.forEach((candle) => {
                // Normalisasi timestamp (ms -> s)
                const candleTime = candle.t > 10000000000 ? Math.floor(candle.t / 1000) : candle.t;

                if (candleTime < marketOpenTimestamp) {
                    historyContext.push(candle);
                } else if (candleTime >= marketOpenTimestamp && candleTime <= marketCloseTimestamp) {
                    simulationQueue.push(candle);
                }
            });

            console.log(`[SimulationStore] Split complete:`);
            console.log(`  - History Context: ${historyContext.length} candles`);
            console.log(`  - Simulation Queue: ${simulationQueue.length} candles`);

            // Validasi Data Kosong
            if (simulationQueue.length === 0) {
                console.error(`[SimulationStore] ❌ No data found for ${date}`);
                // Tetap return object error, jangan throw exception biar UI gak crash
                return { historyCount: historyContext.length, simCount: 0, error: `No data for ${date}` };
            }

            // --- 2. UPDATE STATE (Di dalam 'set') ---
            set((state) => {
                state.selectedDate = date;
                state.simulationCandles = simulationQueue;

                // Convert History ke Format Chart
                const convertedHistory: ChartCandle[] = historyContext.map(c => ({
                    time: c.t > 10000000000 ? Math.floor(c.t / 1000) : c.t,
                    open: c.o,
                    high: c.h,
                    low: c.l,
                    close: c.c
                })).sort((a, b) => a.time - b.time); // Wajib sort!

                state.candleHistory = convertedHistory;
            });

            console.log(`[SimulationStore] ✅ Ready for simulation!`);
            console.log(`  - Selected Date: ${date}`);
            console.log(`  - History: ${historyContext.length} candles`);
            console.log(`  - Simulation: ${simulationQueue.length} candles`);

            // --- 3. RETURN HASIL KE KOMPONEN ---
            return {
                historyCount: historyContext.length,
                simCount: simulationQueue.length,
                error: null
            };
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
