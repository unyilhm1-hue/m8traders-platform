/**
 * Simulation Store - High-frequency tick data from Web Worker
 * Uses Zustand for efficient streaming updates
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { TickData } from '@/hooks/useSimulationWorker';
import type { Candle } from '@/types';
import { resampleCandles, getAvailableIntervals, type Interval, type IntervalState } from '@/utils/candleResampler';
import { getCached, loadWithBuffer, invalidateCache, type CachedData } from '@/utils/smartBuffer';

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

    // 🆕 Master Blueprint: Data Layer & Resampling
    baseInterval: Interval;             // Current base interval (e.g., '1m', '5m')
    baseData: Candle[];                 // Original data at base interval (King)
    bufferData: Candle[];               // Historical buffer for indicators
    cachedIntervals: Map<Interval, Candle[]>;  // Resampled intervals cache
    currentTicker: string;              // Current ticker symbol

    // Orderbook simulation (Level 2)
    orderbookBids: OrderbookLevel[];
    orderbookAsks: OrderbookLevel[];
    orderbookDepth: number;

    // Time & Sales
    recentTrades: TradeRecord[];
    maxTradeHistory: number;

    // Volume metrics
    cumulativeVolume: number;

    // ✅ Phoenix Pattern: Track last processed candle for crash recovery
    lastProcessedIndex: number;

    // ✅ FIX 2: Market hours configuration (configurable timezone filter)
    marketConfig: {
        timezone: string;        // e.g., 'Asia/Jakarta', 'America/New_York'
        openHour: number;        // 9
        closeHour: number;       // 16
        filterEnabled: boolean;  // true = filter to market hours, false = accept all
    };

    // Actions
    pushTick: (tick: TickData) => void;
    setCandleHistory: (candles: Candle[]) => void; // Set initial history from worker
    updateCurrentCandle: (candle: ChartCandle) => void; // Update live candle
    loadSimulationDay: (date: string, allCandles: Candle[]) => { historyCount: number; simCount: number; error: string | null }; // NEW: Smart data split
    reset: () => void;
    setOrderbookDepth: (depth: number) => void;
    setMarketConfig: (config: Partial<SimulationState['marketConfig']>) => void; // ✅ FIX 2: New action
    setLastProcessedIndex: (index: number) => void; // ✅ Phoenix Pattern: Update progress

    // 🆕 Master Blueprint: New Actions
    loadWithSmartBuffer: (ticker: string, startDate: Date, interval: Interval) => Promise<void>;
    switchInterval: (targetInterval: Interval) => Candle[];
    getIntervalStates: () => IntervalState[];
    clearIntervalCache: () => void;
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

    // 🆕 Master Blueprint: Data Layer defaults
    baseInterval: '1m' as Interval,
    baseData: [],
    bufferData: [],
    cachedIntervals: new Map<Interval, Candle[]>(),
    currentTicker: '',

    orderbookBids: [],
    orderbookAsks: [],
    orderbookDepth: 10,

    recentTrades: [],
    maxTradeHistory: 50,

    cumulativeVolume: 0,

    // ✅ Phoenix Pattern: Start at index 0
    lastProcessedIndex: 0,

    // ✅ FIX 2: Default market config (WIB, 09-16, filter enabled)
    marketConfig: {
        timezone: 'Asia/Jakarta',
        openHour: 9,
        closeHour: 16,
        filterEnabled: true  // Default: filter enabled for IDX market
    },
};

// ============================================================================
// 🆕 Phase 3: Timezone-Aware Market Hours Utilities
// ============================================================================

/**
 * Convert timestamp to market timezone and extract time components
 */
function toMarketTime(timestamp: number, timezone: string): { hour: number; minute: number; date: Date } {
    const date = new Date(timestamp);

    // Get hour and minute in market timezone
    const hour = Number(date.toLocaleString('en-US', {
        hour: 'numeric',
        hour12: false,
        timeZone: timezone
    }));

    const minute = Number(date.toLocaleString('en-US', {
        minute: 'numeric',
        timeZone: timezone
    }));

    return { hour, minute, date };
}

/**
 * Check if timestamp is within market hours (minute precision)
 * Market: 09:00 - 16:00
 * Accept: hour=9 minute>=0 OR hour 10-15 OR hour=16 minute=0
 */
function isWithinMarketHours(
    timestamp: number,
    config: { timezone: string; openHour: number; closeHour: number }
): boolean {
    const { hour, minute } = toMarketTime(timestamp, config.timezone);

    // Before market open (< 09:00)
    if (hour < config.openHour) return false;

    // After market close (> 16:00)
    if (hour > config.closeHour) return false;

    // Edge case: Exactly at close hour (16:xx)
    // Accept ONLY 16:00 (last trading minute), reject 16:01+
    if (hour === config.closeHour && minute > 0) return false;

    return true;
}

/**
 * Check if timestamp is during lunch break (IDX: 11:30-13:30 WIB)
 */
function isLunchBreak(timestamp: number, timezone: string): boolean {
    const { hour, minute } = toMarketTime(timestamp, timezone);

    // Lunch: 11:30 - 13:30
    if (hour > 11 && hour < 13) return true;          // 12:xx (all of hour 12)
    if (hour === 11 && minute >= 30) return true;     // 11:30-11:59
    if (hour === 13 && minute < 30) return true;      // 13:00-13:29

    return false;
}

// ============================================================================
// 🔥 FIX C: Centralized Time Conversion Utility
// ============================================================================

/**
 * Normalize any timestamp format to seconds (Unix timestamp)
 * Handles: milliseconds, Date objects, ISO strings
 * Ensures consistent conversion across entire pipeline
 */
export function normalizeTimestamp(rawTime: number | Date | string | undefined): number {
    if (rawTime === undefined || rawTime === null) {
        console.error('[Time] Invalid timestamp: undefined/null');
        return Math.floor(Date.now() / 1000);
    }

    if (typeof rawTime === 'number') {
        // If > 10 billion, it's milliseconds (e.g., 1736000000000)
        // Otherwise it's already seconds (e.g., 1736000000)
        return rawTime > 10000000000 ? Math.floor(rawTime / 1000) : rawTime;
    }

    if (rawTime instanceof Date) {
        return Math.floor(rawTime.getTime() / 1000);
    }

    if (typeof rawTime === 'string') {
        const parsed = new Date(rawTime).getTime() / 1000;
        if (isNaN(parsed)) {
            console.error('[Time] Failed to parse timestamp string:', rawTime);
            return Math.floor(Date.now() / 1000);
        }
        return Math.floor(parsed);
    }

    console.error('[Time] Unknown timestamp type:', typeof rawTime, rawTime);
    return Math.floor(Date.now() / 1000);
}

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
                // ✅ OPTIMIZATION: Prevent unnecessary array recreation
                // Check if new data is identical to current state
                if (state.candleHistory.length > 0 && candles.length > 0) {
                    const currentLastTime = state.candleHistory[state.candleHistory.length - 1]?.time;
                    const newLastTime = candles[candles.length - 1]?.t;

                    // If same length and same last timestamp, data hasn't changed
                    if (state.candleHistory.length === candles.length &&
                        currentLastTime === newLastTime) {
                        console.log('[SimulationStore] ⏭️ Skipping identical candleHistory update');
                        return; // Don't mutate state!
                    }
                }

                const converted: ChartCandle[] = [];

                // Konversi semua candle ke format ChartCandle
                candles.forEach((c, index) => {
                    const rawTime = c.t;

                    // 🔥 FIX C: Use centralized time normalization
                    const timeInSeconds = normalizeTimestamp(rawTime);

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

                // 🔥 FIX B: Deduplicate timestamps to prevent "barcode" effect
                // Merge candles with same timestamp (take last OHLC values)
                const deduplicated: ChartCandle[] = [];
                for (let i = 0; i < converted.length; i++) {
                    const current = converted[i];

                    // Check if next candle has same timestamp
                    if (i < converted.length - 1 && converted[i + 1].time === current.time) {
                        // Skip this, will be merged with next
                        continue;
                    }

                    // If previous had same time, this is the duplicate - use this one's OHLC
                    if (i > 0 && converted[i - 1].time === current.time) {
                        // Replace deduplicated's last entry (merge)
                        const merged = {
                            time: current.time,
                            open: converted[i - 1].open,  // Keep first open
                            high: Math.max(converted[i - 1].high, current.high),  // Max high
                            low: Math.min(converted[i - 1].low, current.low),      // Min low
                            close: current.close,                                   // Use last close
                        };
                        deduplicated[deduplicated.length - 1] = merged;
                    } else {
                        // No duplicate, add as-is
                        deduplicated.push(current);
                    }
                }

                const originalCount = converted.length;
                const removedDuplicates = originalCount - deduplicated.length;

                if (removedDuplicates > 0) {
                    console.log(`[SimulationStore] 🔧 Removed ${removedDuplicates} duplicate timestamps`);
                }

                state.candleHistory = deduplicated;
                console.log(`[SimulationStore] ✅ Converted ${deduplicated.length} candles, first time=${deduplicated[0]?.time}, last time=${deduplicated[deduplicated.length - 1]?.time}`);
            });
        },

        updateCurrentCandle(candle) {
            set((state) => {
                // 🔍 CHECKPOINT 3: Store update
                console.log(`[Store→] time=${candle.time}, C=${candle.close.toFixed(2)}`);
                state.currentCandle = candle;
            });
        },

        loadSimulationDay: (dateStr, allCandles) => {
            // ✅ FIX 2: Use configurable market config instead of hardcoded WIB
            const { marketConfig } = useSimulationStore.getState();

            console.log(`[Store] 🌏 Loading with timezone: ${marketConfig.timezone}, filter: ${marketConfig.filterEnabled ? `${marketConfig.openHour}-${marketConfig.closeHour}` : 'disabled'}`);

            // --- 1. SETTING BATAS WAKTU BASED ON CONFIGURED TIMEZONE ---
            const historyContext: ChartCandle[] = [];
            const simulationQueue: Candle[] = [];

            allCandles.forEach((c: any) => {
                // A. Normalisasi Timestamp (Pastikan Detik vs Milidetik aman)
                const rawT = c.t || c.time; // Handle 't' atau 'time'
                let tsMs: number; // Timestamp dalam Milliseconds

                if (typeof rawT === 'number') {
                    // Jika < 10 Miliar berarti Detik, kali 1000
                    tsMs = rawT < 10000000000 ? rawT * 1000 : rawT;
                } else {
                    tsMs = new Date(rawT).getTime();
                }

                // B. CEK TANGGAL DENGAN ZONA WAKTU YANG DIKONFIGURASI
                const candleDateObj = new Date(tsMs);

                // Convert timestamp candle to date string in configured timezone
                const candleDateLocal = candleDateObj.toLocaleDateString('en-CA', {
                    timeZone: marketConfig.timezone
                }); // en-CA format: YYYY-MM-DD

                // C. LOGIKA FILTER (THE GREAT SPLIT)
                if (candleDateLocal < dateStr) {
                    // If candle date < Selected Date -> Add to HISTORY
                    historyContext.push({
                        time: Math.floor(tsMs / 1000), // Chart needs seconds
                        open: c.o || c.open,
                        high: c.h || c.high,
                        low: c.l || c.low,
                        close: c.c || c.close,
                    });
                } else if (candleDateLocal === dateStr) {
                    // If candle date == Selected Date -> Check Market Hours (if filter enabled)

                    // ✅ FIX 2: Apply filter ONLY if enabled
                    if (marketConfig.filterEnabled) {
                        // 🆕 PHASE 3: Use minute-precision filtering with lunch break
                        const withinMarketHours = isWithinMarketHours(tsMs, marketConfig);
                        const duringLunchBreak = isLunchBreak(tsMs, marketConfig.timezone);

                        // Accept ONLY if within market hours AND NOT during lunch
                        if (withinMarketHours && !duringLunchBreak) {
                            simulationQueue.push({
                                ...c,
                                t: tsMs // Store in MS for Worker
                            });

                            // 🐛 DEBUG: Log first 10 accepted candles
                            if (simulationQueue.length <= 10) {
                                const { hour, minute } = toMarketTime(tsMs, marketConfig.timezone);
                                console.log(`[Store] ✅ Accepted ${simulationQueue.length}: ${hour}:${minute.toString().padStart(2, '0')} (market: true, lunch: false)`);
                            }
                        } else if (simulationQueue.length < 200) {
                            // Log first 200 rejections for debugging
                            const { hour, minute } = toMarketTime(tsMs, marketConfig.timezone);
                            const reason = !withinMarketHours ? 'outside market hours' : 'lunch break';
                            console.log(`[Store] ❌ Rejected ${hour}:${minute.toString().padStart(2, '0')} (${reason})`);
                        }
                    } else {
                        // No filtering - accept all candles on the selected date
                        simulationQueue.push({
                            ...c,
                            t: tsMs
                        });

                        if (simulationQueue.length < 10) {
                            console.log(`[Store] ✅ Accepted (filter disabled)`);
                        }
                    }
                }
            });

            // 🐛 DEBUG: Show filtering summary
            console.log(`[Store] 📊 Filtering Results for ${dateStr}:`);
            console.log(`  - Total candles processed: ${allCandles.length}`);
            console.log(`  - History (before ${dateStr}): ${historyContext.length}`);
            console.log(`  - Simulation (on ${dateStr}): ${simulationQueue.length}`);
            if (simulationQueue.length > 0) {
                const firstSim = new Date(simulationQueue[0].t);
                const lastSim = new Date(simulationQueue[simulationQueue.length - 1].t);
                console.log(`  - Sim range: ${firstSim.toISOString()} -> ${lastSim.toISOString()}`);
            }

            // Validasi
            if (simulationQueue.length === 0) {
                console.warn(`[Store] ⚠️ No data found for ${dateStr} in WIB timezone!`);
                return { historyCount: historyContext.length, simCount: 0, error: "No data in WIB range" };
            }

            // ✅ FIX: Sort simulation queue untuk ensure monotonic timestamps
            simulationQueue.sort((a, b) => a.t - b.t);
            console.log(`[Store] ✅ Sorted ${simulationQueue.length} simulation candles by time`);

            // D. UPDATE STATE
            set((state) => {
                state.selectedDate = dateStr;
                state.simulationCandles = simulationQueue; // Data Future (WIB Only)

                // ✅ OPTIMIZATION: Check before updating candleHistory
                // Prevent unnecessary array recreation if history hasn't changed
                if (state.candleHistory.length > 0 && historyContext.length > 0) {
                    const currentLastTime = state.candleHistory[state.candleHistory.length - 1]?.time;
                    const newLastTime = historyContext[historyContext.length - 1]?.time;

                    if (state.candleHistory.length === historyContext.length &&
                        currentLastTime === newLastTime) {
                        console.log('[Store] ⏭️ Skipping identical history update in loadSimulationDay');
                        // Still update selectedDate and simulationCandles, but skip history
                        state.currentCandle = null;
                        return;
                    }
                }

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

        // ✅ FIX 2: Set market configuration
        setMarketConfig(config) {
            set((state) => {
                state.marketConfig = {
                    ...state.marketConfig,
                    ...config
                };

                console.log(`[Store] 📊 Market config updated:`, state.marketConfig);
            });
        },

        // ✅ Phoenix Pattern: Update last processed index (for crash recovery)
        setLastProcessedIndex(index) {
            set((state) => {
                state.lastProcessedIndex = index;
            });
        },

        // 🆕 Master Blueprint: Load data with smart buffering
        async loadWithSmartBuffer(ticker, startDate, interval) {
            try {
                console.log(`[Store] 📥 Loading ${ticker} ${interval} with smart buffer...`);

                const cached = await loadWithBuffer({
                    ticker,
                    startDate,
                    baseInterval: interval,
                    bufferSize: 200
                });

                set((state) => {
                    state.currentTicker = ticker;
                    state.baseInterval = interval;
                    state.baseData = [...cached.buffer, ...cached.active];
                    state.bufferData = cached.buffer;
                    state.cachedIntervals.clear(); // Reset cache when loading new data
                    state.cachedIntervals.set(interval, state.baseData); // Cache base interval
                });

                console.log(`[Store] ✅ Loaded ${cached.buffer.length} buffer + ${cached.active.length} active candles`);
            } catch (error) {
                console.error('[Store] ❌ Failed to load with smart buffer:', error);
                throw error;
            }
        },

        // 🆕 Master Blueprint: Switch interval with client-side resampling
        switchInterval(targetInterval) {
            const state = useSimulationStore.getState();

            // Check if already cached
            const cached = state.cachedIntervals.get(targetInterval);
            if (cached) {
                console.log(`[Store] ✅ Using cached ${targetInterval} data (${cached.length} candles)`);
                return cached;
            }

            // Resample from base data
            try {
                const resampled = resampleCandles(
                    state.baseData,
                    state.baseInterval,
                    targetInterval
                );

                // Cache result
                set((state) => {
                    state.cachedIntervals.set(targetInterval, resampled);
                });

                console.log(`[Store] ✅ Resampled ${state.baseInterval} → ${targetInterval} (${resampled.length} candles)`);
                return resampled;
            } catch (error) {
                console.error(`[Store] ❌ Failed to resample to ${targetInterval}:`, error);
                throw error;
            }
        },

        // 🆕 Master Blueprint: Get interval button states
        getIntervalStates() {
            const state = useSimulationStore.getState();
            return getAvailableIntervals(state.baseInterval, state.baseData);
        },

        // 🆕 Master Blueprint: Clear interval cache
        clearIntervalCache() {
            set((state) => {
                state.cachedIntervals.clear();
                console.log('[Store] 🗑️ Interval cache cleared');
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

// ✅ Phoenix Pattern: Selector for last processed index
export const useLastProcessedIndex = () => useSimulationStore((state) => state.lastProcessedIndex);
