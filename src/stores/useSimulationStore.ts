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

        loadSimulationDay: (dateStr, allCandles) => {
            console.log(`[Store] 🌏 Enforcing WIB Logic for Date: ${dateStr}`);

            // --- 1. SETTING BATAS WAKTU WIB (The WIB Enforcer) ---
            // Kita parsing tanggal string (YYYY-MM-DD)
            const [year, month, day] = dateStr.split('-').map(Number);

            // Buat objek Date seolah-olah di UTC, lalu kurangi offset agar pas di 00:00 WIB
            // WIB = UTC+7. Jadi 00:00 WIB = 17:00 UTC hari sebelumnya.
            // Cara paling aman: Pakai string comparison dengan Locale Jakarta.

            const marketOpenHour = 9;  // 09:00 WIB
            const marketCloseHour = 16; // 16:00 WIB

            const historyContext: ChartCandle[] = [];
            const simulationQueue: Candle[] = [];

            allCandles.forEach((c) => {
                // A. Normalisasi Timestamp (Pastikan Detik vs Milidetik aman)
                const rawT = c.t || (c as any).time; // Handle 't' atau 'time'
                let tsMs: number; // Timestamp dalam Milliseconds

                if (typeof rawT === 'number') {
                    // Jika < 10 Miliar berarti Detik, kali 1000
                    tsMs = rawT < 10000000000 ? rawT * 1000 : rawT;
                } else {
                    tsMs = new Date(rawT).getTime();
                }

                // B. CEK TANGGAL DENGAN ZONA WAKTU JAKARTA (WIB)
                // Ini inti dari ide Anda: Menggunakan 'Asia/Jakarta' secara eksplisit
                const candleDateObj = new Date(tsMs);

                // Konversi timestamp candle ke string tanggal WIB ("2026-01-15")
                const candleDateWIB = candleDateObj.toLocaleDateString('en-CA', {
                    timeZone: 'Asia/Jakarta'
                }); // en-CA formatnya YYYY-MM-DD, sangat presisi untuk sorting

                // C. LOGIKA FILTER (THE GREAT SPLIT)
                if (candleDateWIB < dateStr) {
                    // Jika tanggal candle < Tanggal Terpilih -> Masuk HISTORY
                    historyContext.push({
                        time: Math.floor(tsMs / 1000), // Chart butuh Detik
                        open: c.o || (c as any).open,
                        high: c.h || (c as any).high,
                        low: c.l || (c as any).low,
                        close: c.c || (c as any).close,
                    });
                } else if (candleDateWIB === dateStr) {
                    // Jika tanggal candle == Tanggal Terpilih -> Cek Jam Market
                    // Ambil jam candle dalam WIB (0-23)
                    const candleHourWIB = Number(candleDateObj.toLocaleString('en-US', {
                        hour: 'numeric',
                        hour12: false,
                        timeZone: 'Asia/Jakarta'
                    }));

                    // Masukkan ke SIMULASI (Queue)
                    // Opsional: Filter jam 09:00 - 16:00 biar rapi
                    if (candleHourWIB >= marketOpenHour && candleHourWIB <= marketCloseHour) {
                        simulationQueue.push({
                            ...c,
                            t: tsMs // Simpan dalam MS untuk Worker
                        });
                    }
                }
            });

            // Validasi
            if (simulationQueue.length === 0) {
                console.warn(`[Store] ⚠️ No data found for ${dateStr} in WIB timezone!`);
                return { historyCount: historyContext.length, simCount: 0, error: "No data in WIB range" };
            }

            // D. UPDATE STATE
            set((state) => {
                state.selectedDate = dateStr;
                state.simulationCandles = simulationQueue; // Data Future (WIB Only)

                // Sortir History & Simpan
                historyContext.sort((a, b) => a.time - b.time);
                state.candleHistory = historyContext;

                // Reset candle aktif
                state.currentCandle = null;
            });

            console.log(`[Store] ✅ WIB Split Success: ${historyContext.length} History, ${simulationQueue.length} Sim`);

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
