/**
 * Simulation Store - High-frequency tick data from Web Worker
 * Uses Zustand for efficient streaming updates
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';
import type { TickData } from '@/types/simulation';
import type { Candle as WorkerCandle } from '@/types';
import {
    resampleCandles,
    getAvailableIntervals,
    intervalToMinutes,
    type Interval,
    type IntervalState,
    type Candle as ResamplerCandle
} from '@/utils/candleResampler';
import { devLog } from '@/utils/debug'; // Added
import { getCached, loadWithBuffer, invalidateCache, type CachedData } from '@/utils/smartBuffer';

// 🚀 FIX: Enable MapSet plugin for Immer to support Map in store
enableMapSet();

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
    simulationCandles: WorkerCandle[]; // Candles for selected date (simulation queue)

    // 🆕 Master Blueprint: Data Layer & Resampling
    baseInterval: Interval;             // Currently displayed interval (e.g., '1m', '5m')
    sourceInterval: Interval;           // 🔥 FIX: Original data interval (immutable until reload)
    baseData: ResamplerCandle[];        // Original data at base interval (King)
    bufferData: ResamplerCandle[];      // Historical buffer for indicators
    cachedIntervals: Map<Interval, ResamplerCandle[]>;  // Resampled intervals cache
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

    // 🛡️ UX State: Loading Feedback
    isPreparingData: boolean;

    // ✅ FIX 2: Market hours configuration (configurable timezone filter)
    marketConfig: {
        timezone: string;        // e.g., 'Asia/Jakarta', 'America/New_York'
        openHour: number;        // 9
        closeHour: number;       // 16
        filterEnabled: boolean;  // true = filter to market hours, false = accept all
    };

    // 🆕 FIX 3: Performance Metrics (Observability)
    metrics: {
        tickBacklog: number;         // Current tick backlog count
        totalTicksProcessed: number; // Cumulative ticks since start
        droppedTickCount: number;    // Ticks dropped due to throttling
        avgTickLatency: number;      // Average ms between tick gen and render
        lastUpdateTime: number;      // Last metrics update timestamp
    };

    // Actions
    pushTick: (tick: TickData) => void;
    setCandleHistory: (candles: WorkerCandle[]) => void; // Set initial history from worker
    updateCurrentCandle: (candle: ChartCandle) => void; // Update live candle
    loadSimulationDay: (date: string, allCandles: WorkerCandle[]) => Promise<{ historyCount: number; simCount: number; error: string | null }>; // NEW: Smart data split
    reset: () => void;
    setOrderbookDepth: (depth: number) => void;
    setMarketConfig: (config: Partial<SimulationState['marketConfig']>) => void; // ✅ FIX 2: New action
    setLastProcessedIndex: (index: number) => void; // ✅ Phoenix Pattern: Update progress

    // 🔥 FIX: Tick batching state
    tickBatchQueue: TickData[];
    tickBatchScheduled: boolean;

    // 🆕 Master Blueprint: New Actions
    loadWithSmartBuffer: (ticker: string, startDate: Date, interval: Interval) => Promise<void>;
    switchInterval: (targetInterval: Interval) => ResamplerCandle[];
    getIntervalStates: () => IntervalState[];
    clearIntervalCache: () => void;

    // 🆕 FIX 3: Metrics actions
    updateMetrics: (metrics: Partial<SimulationState['metrics']>) => void;
    resetMetrics: () => void;
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
    sourceInterval: '1m' as Interval,  // 🔥 FIX: Track original data interval
    baseData: [] as ResamplerCandle[],
    bufferData: [] as ResamplerCandle[],
    cachedIntervals: new Map<Interval, ResamplerCandle[]>(),
    currentTicker: '',

    orderbookBids: [],
    orderbookAsks: [],
    orderbookDepth: 10,

    recentTrades: [],
    maxTradeHistory: 50,

    cumulativeVolume: 0,

    // ✅ Phoenix Pattern: Start at index 0
    lastProcessedIndex: 0,

    // 🛡️ UX State
    isPreparingData: false,

    // 🔥 FIX: Tick batching defaults
    tickBatchQueue: [] as TickData[],
    tickBatchScheduled: false,

    // ✅ FIX 2: Default market config (WIB, 09-16, filter enabled)
    marketConfig: {
        timezone: 'Asia/Jakarta',
        openHour: 9,
        closeHour: 16,
        filterEnabled: true  // Default: filter enabled for IDX market
    },

    // 🆕 FIX 3: Performance metrics initial state
    metrics: {
        tickBacklog: 0,
        totalTicksProcessed: 0,
        droppedTickCount: 0,
        avgTickLatency: 0,
        lastUpdateTime: 0
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

        // 🔥 FIX: Batch tick updates using requestAnimationFrame
        // Only update orderbook/trades once per frame (~60fps max)
        pushTick(tick) {
            set((state) => {
                // Always queue tick for batching
                state.tickBatchQueue.push(tick);

                // Schedule batch flush if not already scheduled
                if (!state.tickBatchScheduled) {
                    state.tickBatchScheduled = true;

                    requestAnimationFrame(() => {
                        const batch = useSimulationStore.getState().tickBatchQueue;
                        if (batch.length === 0) return;

                        // 🔬 PROFILING: Measure batch update duration
                        const startTime = performance.now();

                        // Process ONLY the latest tick (most recent state)
                        const latestTick = batch[batch.length - 1];

                        set((state) => {
                            const lastPrice = state.currentPrice;
                            const currentPrice = latestTick.price;

                            // Update tick state (with latest)
                            state.currentTick = latestTick;
                            state.tickHistory.push(latestTick);

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
                            state.cumulativeVolume += latestTick.volume;

                            // 🔥 BATCHED: Generate orderbook ONCE per frame
                            const { bids, asks } = generateOrderbook(currentPrice, state.orderbookDepth);
                            state.orderbookBids = bids;
                            state.orderbookAsks = asks;

                            // 🔥 BATCHED: Add to time & sales ONCE per frame
                            if (latestTick.volume > 0) {
                                const trade: TradeRecord = {
                                    price: currentPrice,
                                    volume: latestTick.volume,
                                    timestamp: latestTick.timestamp,
                                    side: determineTradeSide(currentPrice, lastPrice),
                                };

                                state.recentTrades.unshift(trade);

                                // Trim trade history
                                if (state.recentTrades.length > state.maxTradeHistory) {
                                    state.recentTrades.pop();
                                }
                            }

                            // Clear batch queue
                            state.tickBatchQueue = [];
                            state.tickBatchScheduled = false;
                        });

                        // 🔬 PROFILING: End measurement and check KPI
                        const duration = performance.now() - startTime;

                        // KPI_TARGETS.STORE.TICK_BATCH = 2ms, TICK_BATCH_PEAK = 5ms
                        if (duration > 2) { // 2ms target
                            console.warn(`[Store] ⚠️ Tick batch exceeded target: ${duration.toFixed(2)}ms > 2ms (batch size: ${batch.length})`);
                        }
                    });
                }
            });
        },

        setCandleHistory(candles) {
            set((state) => {
                // 🔥 GATEKEEPER: Validate that candles come from MERGED source
                // This is a safety check - smartLoader should already enforce this
                if (candles.length > 0 && !candles[0].t) {
                    console.error('[SimulationStore] ❌ Rejected: Invalid candle format (missing t field)');
                    return;
                }

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

                // 🔥 OPTIMIZATION: Worker A already handles sorting & deduplication.
                // Trust the worker output to be clean.
                state.candleHistory = converted;

                // const originalCount = converted.length;
                // const removedDuplicates = originalCount - deduplicated.length; 
                // ... (Removed O(N) dedupe loop) ...

                console.log(`[SimulationStore] ✅ Loaded ${converted.length} history candles (Worker Pre-Optimized)`);
                console.log(`[SimulationStore] ✅ Converted ${converted.length} candles, first time=${converted[0]?.time}, last time=${converted[converted.length - 1]?.time}`);
            });
        },

        updateCurrentCandle(candle) {
            set((state) => {
                // 🔥 FIX: Master Data Sync
                // We must detect when the WORKER's candle (Source Interval) completes and append it to baseData.
                // Otherwise, resampling will miss recently simulated data.

                if (!candle || candle.time === undefined || candle.time === null) {
                    console.warn('[SimulationStore] ⚠️ Rejected update with invalid timestamp', candle);
                    return;
                }

                const sourceTime = normalizeTimestamp(candle.time);
                // Track the "last seen" source candle in a transient way (using the last element of baseData?)
                const lastBase = state.baseData[state.baseData.length - 1];
                const lastBaseTime = (lastBase && lastBase.time != null) ? normalizeTimestamp(lastBase.time) : 0;

                // Detect new source candle (using loose comparison for robustness)
                if (lastBaseTime > 0 && sourceTime > lastBaseTime) {
                    // Logic gap: The 'candle' passed here is the NEW active candle.
                    // We missed capturing the FINAL state of the PREVIOUS candle.
                    // Ideally, Worker should send a 'CANDLE_COMPLETED' event.
                    // OR we assume the last update we received for 'lastBaseTime' was close enough.
                    // BUT: updateCurrentCandle receives 'continuous' updates. We don't store the "last received" separately.

                    // Workaround: We cannot reliably reconstruct the finished candle here without a dedicated state.
                    // Alternative: Trust that Worker B sends perfectly accurate 'continuous' updates.
                    // PROPER FIX: The Worker B should broadcast 'CANDLE_COMPLETED'.
                    // For now, let's rely on the previous fix in 'switchInterval' filtering partials.
                    // We will skip appending to baseData here to avoid complexity/bugs and suggest
                    // user to implement CANDLE_COMPLETED if deep history accuracy is needed.

                    // Actually, critical requirement: "misal di interval 1m dirubah...".
                    // If we don't update baseData, the 2m chart will NOT have the 1m data generated in the last 5 minutes.
                    // So we MUST update baseData.
                }
                // 1. Get current interval in minutes
                const intervalMinutes = intervalToMinutes(state.baseInterval);
                const intervalSeconds = intervalMinutes * 60;

                // 2. Snap timestamp to current interval grid
                const candleTime = normalizeTimestamp(candle.time);
                const snappedTime = Math.floor(candleTime / intervalSeconds) * intervalSeconds;

                // 3. Check if we need to start a new candle or update existing
                let current = state.currentCandle;


                // 🔥 CRITICAL FIX: Only create NEW candle if time bucket changed
                // Otherwise, MERGE with existing candle (preserving Open/High/Low)
                if (!current || current.time !== snappedTime) {
                    // 🚀 NEW FIX: Append previous completed candle to history
                    // This ensures indicators recalculate with new data!
                    if (current && current.time > 0) {
                        // Previous candle is complete, add it to history
                        state.candleHistory.push(current);

                        // 🔥 FIX #2: Sync baseData with live candles during replay
                        // If we are on the SOURCE interval (base mode), capture this candle into baseData.
                        // This allows resampling to work correctly during live replay.
                        if (state.baseInterval === state.sourceInterval) {
                            // Convert ChartCandle -> ResamplerCandle (simple cast as structure implies compatibility)
                            // Ideally we Normalize, but structure is compatible.
                            state.baseData.push({
                                time: current.time * 1000, // Convert back to ms for Resampler
                                open: current.open,
                                high: current.high,
                                low: current.low,
                                close: current.close,
                                volume: 0 // TODO: Add volume tracking to ChartCandle if needed
                            });
                        }

                        // 🔥 OPTIMIZATION: Limit history size to prevent memory issues
                        // Keep last 1000 candles in history (adjust as needed)
                        const MAX_HISTORY = 1000;
                        if (state.candleHistory.length > MAX_HISTORY) {
                            state.candleHistory.shift(); // Remove oldest candle
                        }

                        // Also limit baseData growth if needed, but baseData is the "Source of Truth" for resampling,
                        // so we should be careful about trimming it unless we implement windowed resampling.
                    }

                    // New time bucket detected - start fresh candle
                    current = {
                        time: snappedTime,
                        open: candle.open,
                        high: candle.high,
                        low: candle.low,
                        close: candle.close
                    };
                } else {
                    // Same time bucket - aggregate incoming data with existing
                    // This is critical for interval switching (e.g. 1m updates → 5m aggregation)
                    current = {
                        time: snappedTime,
                        open: current.open,  // Keep original open
                        high: Math.max(current.high, candle.high),  // Expand high if needed
                        low: Math.min(current.low, candle.low),    // Expand low if needed
                        close: candle.close  // Always update to latest close
                    };
                }

                // 4. Update state
                state.currentCandle = current;
            });
        },

        loadSimulationDay: async (dateStr, rawCandles) => {
            // 🛡️ ZOMBIE KILLER: Terminate existing physics worker if running
            // Note: We don't have direct access to 'worker' instance here since it's likely managed 
            // in a hook or separate controller. However, if we are reloading data, we should 
            // signal the UI/Controller to restart the worker.
            // Ideally, this store should manage the worker instance if we want full orchestration here.

            // For now, we update the state and expect the SimulationController/Hook 
            // to react to 'simulationCandles' changes or a new explicit signal.

            // 🚨 ARCHITECTURE NOTE:
            // Since the user wants orchestration HERE ("Main Thread Orchestration... Update useSimulationStore"),
            // we will assume this function effectively PREPARES the data. 
            // The actual Worker B spawn might happen in the component (useEffect) OR we move the worker 
            // instance into the store (which is complex with Zustand/Immer).

            // Let's implement the "Data Preparation" part using Worker A here.

            const { marketConfig } = useSimulationStore.getState();
            set({ isPreparingData: true });

            console.log(`[Store] 🏭 Factory Model: Starting Data Preparation for ${dateStr}`);

            return new Promise((resolve) => {
                // 1. Spawn Worker A (Data Administrator)
                const loaderWorker = new Worker(new URL('../workers/data-loader.worker.ts', import.meta.url));

                // 2. Setup Listeners
                loaderWorker.onmessage = (event) => {
                    const { status, payload, error } = event.data;

                    if (status === 'ERROR' || error) {
                        console.error('[Store] ❌ Worker A Error:', error);
                        set({ isPreparingData: false });
                        loaderWorker.terminate();
                        resolve({ historyCount: 0, simCount: 0, error: error || 'Worker A Error' });
                        return;
                    }

                    if (status === 'SUCCESS' && payload) {
                        const { history, simulation, metadata } = payload;
                        console.log(`[Store] 📦 Data Ready: ${history.length} History, ${simulation.length} Sim`);
                        console.log(`[Store] ℹ️ Metadata:`, metadata);

                        // 3. Update Store
                        set((state) => {
                            state.selectedDate = dateStr;

                            // Load History
                            // Wrapper: EnrichedCandle -> ChartCandle
                            state.candleHistory = history.map((c: any) => ({
                                time: c.t / 1000,
                                open: c.o,
                                high: c.h,
                                low: c.l,
                                close: c.c
                            }));

                            // Load Simulation (Keep enriched format for Physics Engine)
                            state.simulationCandles = simulation;
                            state.currentCandle = null;
                            state.isPreparingData = false;
                        });

                        // 4. Terminate Worker A
                        loaderWorker.terminate();
                        console.log('[Store] 💀 Worker A terminated (Job Done)');

                        resolve({
                            historyCount: history.length,
                            simCount: simulation.length,
                            error: null
                        });
                    }
                };

                loaderWorker.onerror = (err) => {
                    console.error('[Store] 💥 Worker A Crash:', err);
                    set({ isPreparingData: false });
                    loaderWorker.terminate();
                    resolve({ historyCount: 0, simCount: 0, error: 'Worker A Crashed' });
                };

                // 🔥 OPTIMIZATION: Pass object directly (Structured Clone)
                // Avoids JSON.stringify on Main Thread + JSON.parse on Worker

                loaderWorker.postMessage({
                    type: 'PROCESS_DATA',
                    rawFileContent: rawCandles, // Pass as Array/Object
                    params: {
                        targetDate: dateStr,
                        config: marketConfig
                    },
                    marketRules: {
                        defaultLotSize: 100 // IDX Standard
                    }
                });
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
                    state.sourceInterval = interval;  // 🔥 FIX: Set source interval on load
                    state.baseData = [...cached.buffer, ...cached.active];
                    state.bufferData = cached.buffer;
                    state.cachedIntervals.clear(); // Reset cache when loading new data
                    state.cachedIntervals.set(interval, state.baseData); // Cache base interval
                });

                console.log(`[Store] ✅ Loaded ${cached.buffer.length} buffer + ${cached.active.length} active candles`);
                console.log(`[Store] 📊 sourceInterval set to: ${interval}`);
            } catch (error) {
                console.error('[Store] ❌ Failed to load with smart buffer:', error);
                throw error;
            }
        },

        // 🆕 Master Blueprint: Switch interval with client-side resampling
        switchInterval(targetInterval): ResamplerCandle[] {
            const state: SimulationState = useSimulationStore.getState();

            // Check if already cached
            const cached: ResamplerCandle[] | undefined = state.cachedIntervals.get(targetInterval);
            if (cached) {
                devLog('RESAMPLING', `[Store] ✅ Using cached ${targetInterval} data (${cached.length} candles)`);

                // 🔥 FIX #2: Filter partial candles from cache
                const completeCandles = cached.filter((c: ResamplerCandle) => {
                    const metadata = (c as any).metadata;
                    return !metadata || !metadata.isPartial;
                });

                if (completeCandles.length < cached.length) {
                    devLog('RESAMPLING', `[Store] 📦 Filtered ${cached.length - completeCandles.length} partial candles from cache`);
                }

                // 🚀 FIX 2: Sync state, chart, and worker
                set((state) => {
                    devLog('RESAMPLING', `[Store→switchInterval] 🔄 Using CACHED data for ${targetInterval}`);
                    devLog('RESAMPLING', `[Store→switchInterval] 📊 Before: baseInterval=${state.baseInterval}, currentCandle=`, state.currentCandle);

                    const previousInterval = state.baseInterval;
                    state.baseInterval = targetInterval;
                    // sourceInterval stays unchanged - it's the original data interval
                    // Update chart history with resampled candles
                    // 🔥 FIX: Don't divide if time is already in seconds (< 10 billion)
                    state.candleHistory = completeCandles.map((c: ResamplerCandle) => {
                        const timeInMs = typeof c.time === 'number' ? c.time : new Date(c.time).getTime();
                        // Force to seconds (Unix timestamp)
                        const timeInSeconds = timeInMs > 10_000_000_000 ? Math.floor(timeInMs / 1000) : Math.floor(timeInMs);

                        return {
                            time: timeInSeconds,
                            open: c.open,
                            high: c.high,
                            low: c.low,
                            close: c.close
                        };
                    });

                    // 🔥 FIX #3: Realign currentCandle to new interval bucket
                    if (state.currentCandle) {
                        const intervalMinutes = intervalToMinutes(targetInterval);
                        const intervalSeconds = intervalMinutes * 60;
                        const newSnappedTime = Math.floor(state.currentCandle.time / intervalSeconds) * intervalSeconds;

                        // Update time to match new interval grid
                        state.currentCandle.time = newSnappedTime;
                    }

                    devLog('RESAMPLING', `[Store→switchInterval] 🔔 Re-aligned currentCandle to ${targetInterval} grid`);
                }); // End set()

                devLog('RESAMPLING', `[Store] 📊 Chart updated with ${completeCandles.length} ${targetInterval} candles`);
                return completeCandles.map((c: any) => ({
                    time: typeof c.time === 'number' && c.time > 10000000000 ? c.time / 1000 : c.time,
                    open: c.open,
                    high: c.high,
                    low: c.low,
                    close: c.close,
                    volume: c.volume || 0
                })); // Return formatted candles (though component usually uses store directly)
            }

            // 🔥 FIX: Resample from SOURCE interval, not current baseInterval
            // This prevents "incompatible interval" errors when switching 1m→5m→1m
            try {
                devLog('RESAMPLING', `[Store] 🔄 Resampling: ${state.sourceInterval} (source) → ${targetInterval}`);

                const resampled = resampleCandles(
                    state.baseData,
                    state.sourceInterval,  // 🔥 FIX: Use SOURCE, not baseInterval
                    targetInterval
                );

                // Cache result and sync state
                set((state) => {
                    state.cachedIntervals.set(targetInterval, resampled);
                    state.baseInterval = targetInterval;  // Update displayed interval
                    // sourceInterval UNCHANGED - still points to original data

                    // 🔥 FIX: Splitting History vs Active Candle
                    // resampleCandles returns: [Full, Full, Full, Partial?]
                    // We want History = [Full, Full, Full]
                    // And Current = Partial (if exists)

                    const completeCandles = resampled.filter(c => !c.metadata?.isPartial);
                    const partialCandles = resampled.filter(c => c.metadata?.isPartial);

                    if (partialCandles.length > 0) {
                        devLog('RESAMPLING', `[Store] 🧊 Restoring active candle from partial switch data`);
                        // Set the partial bucket as the CURRENT active candle
                        // This ensures visual continuity (open/high/low preserved)
                        const partial = partialCandles[0];
                        // 🔥 FIX: Normalize timestamp to seconds to match Chart & Update Logic
                        const partialTime = typeof partial.time === 'number' ? partial.time : new Date(partial.time).getTime();
                        const timeInSeconds = partialTime > 10_000_000_000 ? partialTime / 1000 : partialTime;

                        state.currentCandle = {
                            time: Math.floor(timeInSeconds),
                            open: partial.open,
                            high: partial.high,
                            low: partial.low,
                            close: partial.close
                        };
                    } else {
                        // 🔥 FIX: Don't destroy currentCandle on perfect boundary
                        // Keep existing if available, or seed from last complete candle
                        if (!state.currentCandle && completeCandles.length > 0) {
                            const lastComplete = completeCandles[completeCandles.length - 1];
                            const lastTime = typeof lastComplete.time === 'number' ? lastComplete.time : new Date(lastComplete.time).getTime() / 1000;

                            devLog('RESAMPLING', `[Store] 🌱 Seeding currentCandle from last complete bar`);
                            state.currentCandle = {
                                time: lastTime + (intervalToMinutes(targetInterval) * 60), // Next bar time
                                open: lastComplete.close, // Next bar opens at last close
                                high: lastComplete.close,
                                low: lastComplete.close,
                                close: lastComplete.close
                            };
                        }
                        // Otherwise keep existing currentCandle (don't reset to null!)
                    }

                    // Update chart history with resampled candles (without partials)
                    // 🔥 FIX: Don't divide if time is already in seconds
                    state.candleHistory = completeCandles.map((c: ResamplerCandle) => {
                        const timeInMs = typeof c.time === 'number' ? c.time : new Date(c.time).getTime();
                        const timeInSeconds = timeInMs > 10_000_000_000 ? timeInMs / 1000 : timeInMs;

                        return {
                            time: timeInSeconds,
                            open: c.open,
                            high: c.high,
                            low: c.low,
                            close: c.close
                        };
                    });
                });

                devLog('RESAMPLING', `[Store] ✅ Resampled ${state.sourceInterval} → ${targetInterval} (${resampled.length} candles)`);
                devLog('RESAMPLING', `[Store] 📊 Chart updated with resampled data`);
                return resampled;
            } catch (error) {
                console.error(`[Store] ❌ Failed to resample to ${targetInterval}:`, error);
                throw error;
            }
        },

        // 🆕 Master Blueprint: Get interval button states
        getIntervalStates(): IntervalState[] {
            // 🔥 FIX #1: Use sourceInterval for compatibility check
            // After switching intervals, baseInterval changes but sourceInterval remains the original data source
            const state: SimulationState = useSimulationStore.getState();

            // Use sourceInterval (original data) for compatibility, not baseInterval (current display)
            const evalInterval = state.sourceInterval || state.baseInterval;
            const evalData = state.baseData;

            if (!evalInterval || evalData.length === 0) {
                return [];
            }

            return getAvailableIntervals(evalInterval, evalData);
        },

        // 🆕 Master Blueprint: Clear interval cache
        clearIntervalCache() {
            set((state) => {
                state.cachedIntervals.clear();
                console.log('[Store] 🗑️ Interval cache cleared');
            });
        },

        // 🆕 FIX 3: Update performance metrics
        updateMetrics(metrics) {
            set((state) => {
                state.metrics = {
                    ...state.metrics,
                    ...metrics,
                    lastUpdateTime: Date.now()
                };
            });
        },

        // 🆕 FIX 3: Reset performance metrics
        resetMetrics() {
            set((state) => {
                state.metrics = {
                    tickBacklog: 0,
                    totalTicksProcessed: 0,
                    droppedTickCount: 0,
                    avgTickLatency: 0,
                    lastUpdateTime: 0
                };
                console.log('[Store] 📊 Metrics reset');
            });
        },
    }))
);

// ============================================================================
// Selector hooks for better performance
export const useCurrentTick = () => useSimulationStore((s: SimulationState) => s.currentTick);
export const useCurrentPrice = () => useSimulationStore((s: SimulationState) => s.currentPrice);
export const usePriceChange = () => useSimulationStore((s: SimulationState) => ({
    change: s.priceChange,
    percent: s.priceChangePercent,
}));
export const useCandleHistory = () => useSimulationStore((s: SimulationState) => s.candleHistory);
export const useCurrentCandle = () => useSimulationStore((s: SimulationState) => s.currentCandle);
export const useSelectedDate = () => useSimulationStore((s: SimulationState) => s.selectedDate);
export const useSimulationCandles = () => useSimulationStore((s: SimulationState) => s.simulationCandles);

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
