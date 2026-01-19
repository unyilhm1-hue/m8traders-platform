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
import { normalizeToSeconds } from '@/utils/timeUtils'; // 🔥 NEW: Centralized timestamp utils
import { assertSeconds } from '@/utils/timeAssertions'; // ✅ Phase 2: Boundary assertions

// 🚀 FIX: Enable MapSet plugin for Immer to support Map in store
enableMapSet();

// ============================================================================
// LRU Cache Configuration
// ============================================================================

/**
 * Maximum number of tickers to keep in memory simultaneously
 * Each ticker ~15MB (1m + 60m raw data), so 3 tickers = ~45MB total
 * 
 * Rationale: Prevents OOM crashes on low-end devices while allowing
 * quick switching between recent stocks (BBRI → BBCA → BBRI)
 */
const MAX_CACHED_TICKERS = 3;

/**
 * LRU Access Log: Tracks last access time per ticker
 * Used for eviction policy (Least Recently Used = first to be deleted)
 */
const TICKER_ACCESS_LOG = new Map<string, number>();

/**
 * Raw source data storage (per ticker)
 * Only stores 1m and 60m master files, all other intervals computed on-demand
 */
interface RawSources {
    '1m': ResamplerCandle[];   // Required: short-term precision data
    '60m'?: ResamplerCandle[]; // Optional: long-term context (hybrid mode)
}

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
    volume?: number; // 🔥 Standardized Volume field
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
    epoch: number; // 🔥 Epoch ID for zombie protection
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

    // 🆕 Master Blueprint: Data Layer & Resampling (MEMORY-OPTIMIZED)
    baseInterval: Interval;             // Currently displayed interval (e.g., '1m', '5m')
    sourceInterval: Interval;           // 🔥 FIX: Original data interval (immutable until reload)
    baseData: ResamplerCandle[];        // ⚠️ DEPRECATED: Use rawSources instead
    bufferData: ResamplerCandle[];      // Historical buffer for indicators

    // 🔥 NEW: LRU-managed raw data storage
    rawSources: Map<string, RawSources>;  // Ticker → {1m, 60m} raw candles

    // 🔥 NEW: Store Anchor Time for Interval Switching (Prevents Race Conditions)
    tempAnchorTime: number | null;

    // ❌ REMOVED: cachedIntervals (was causing 100MB memory bloat)
    // Now using compute-on-demand instead of caching resampled intervals

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
    clearTickQueue: () => void; // 🔥 FIX: Action to flush ghost ticks
    resetLiveState: () => void; // 🔥 NEW: Reset live candle/tick state on interval switch

    // 🆕 Master Blueprint: Memory-Aware Actions
    loadWithSmartBuffer: (ticker: string, startDate: Date, interval: Interval) => Promise<void>;
    switchInterval: (targetInterval: Interval) => ResamplerCandle[];
    getIntervalStates: () => IntervalState[];
    evictOldestTicker: () => void; // 🔥 NEW: Manual LRU eviction

    // 🆕 FIX 3: Metrics actions
    updateMetrics: (metrics: Partial<SimulationState['metrics']>) => void;
    resetMetrics: () => void;

    // 🔥 NEW: Data Updater Integration
    tickerFloors: Map<string, number>;  // ticker → oldest timestamp (Unix seconds)
    lastUpdateTime: number | null;
    setFloorTimestamp: (ticker: string, timestamp: number) => void; // 🔥 NEW: Actions
    updateData: (ticker: string, interval: Interval) => Promise<import('@/utils/DataUpdater').UpdateResult>;
    updateAllTickers: () => Promise<{ successCount: number; failCount: number; results: any[] }>;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState = {
    epoch: 0,
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

    // 🆕 Master Blueprint: Memory-optimized defaults
    baseInterval: '1m' as Interval,
    sourceInterval: '1m' as Interval,  // 🔥 FIX: Track original data interval
    baseData: [] as ResamplerCandle[], // ⚠️ DEPRECATED: Kept for backward compat
    bufferData: [] as ResamplerCandle[],
    rawSources: new Map<string, RawSources>(), // 🔥 NEW: LRU cache
    tempAnchorTime: null,
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

    // 🔥 NEW: Data Updater state
    tickerFloors: new Map<string, number>(),
    lastUpdateTime: null,
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
export function normalizeTimestamp(rawTime: number | Date | string | undefined | any): number {
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

    // 🔥 NEW: Handle BusinessDay objects {year, month, day}
    if (typeof rawTime === 'object' && 'year' in rawTime && 'month' in rawTime && 'day' in rawTime) {
        const businessDate = new Date(Date.UTC(rawTime.year, rawTime.month - 1, rawTime.day));
        const timestamp = Math.floor(businessDate.getTime() / 1000);
        console.log('[Time] 📊 Converted BusinessDay object:', rawTime, '→', timestamp);
        return timestamp;
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
// Helper: Get IDX Tick Size
function getIDXTickSize(price: number): number {
    if (price < 200) return 1;
    if (price < 500) return 2;
    if (price < 2000) return 5;
    if (price < 5000) return 10;
    return 25;
}

function generateOrderbook(
    price: number,
    depth: number = 10
): { bids: OrderbookLevel[]; asks: OrderbookLevel[] } {
    // 🚀 FIXED: Strictly use IDX Tick Logic
    // No more random spreads or floating point errors
    const tickSize = getIDXTickSize(price);

    // Spread is always at least 1 tick, but usually 1-2 ticks in liquid market
    // We place Best Bid at Price OR Price - Tick (depending on trade side logic, but simple is centered)
    // If Last Trade was at Price, then Best Bid = Price, Best Ask = Price + Tick?
    // Or Best Bid = Price - Tick, Best Ask = Price + Tick? (Gapped)
    // Detailed Simulation:
    // If Price is 1000. Last trade matched 1000.
    // If it was a BUY, 1000 was the ASK. So ASK is now 1000 (partially filled) or 1005 (cleared).
    // If it was a SELL, 1000 was the BID. So BID is now 1000 or 995.

    // Simplified Sync:
    // Best Bid = Price - Tick (Logic: Last price is center of action)
    // Best Ask = Price + Tick
    // (If Price = 1000, Bid=995, Ask=1005). Spread = 10.

    const bids: OrderbookLevel[] = [];
    const asks: OrderbookLevel[] = [];

    // 🚀 OPTIMIZATION: Pre-calculate base volume
    const baseVolume = 3000;
    const baseCount = 5;

    // Generate bids (descending from Price - Tick)
    // Start from 0 to depth-1
    for (let i = 0; i < depth; i++) {
        // Calculate price steps downwards
        let currentLevelPrice = price;
        // Step down i+1 times (accumulating tick sizes as price drops!)
        // IDX tick size changes at thresholds (e.g. 2000 -> 1995 -> ... -> 495 -> 490? No 500 boundary)
        // For simple robust simulation around current price, constant tick size is acceptable locally.
        // But crossing 2000/5000 boundary requires dynamic tick size.
        // We will assume local constant tick size for Depth=10 (unlikely to cross boundary significantly).

        currentLevelPrice = price - (tickSize * (i + 1));

        // Volume Decay
        const volumeDecay = 1 - (i * 0.05);
        const volume = Math.floor(baseVolume * volumeDecay * (0.8 + Math.random() * 0.4)); // Adding distinct noise

        bids.push({
            price: Math.floor(currentLevelPrice), // Ensure integer
            volume,
            count: baseCount + Math.floor(Math.random() * 3),
        });
    }

    // Generate asks (ascending from Price + Tick)
    for (let i = 0; i < depth; i++) {
        const currentLevelPrice = price + (tickSize * (i + 1));

        const volumeDecay = 1 - (i * 0.05);
        const volume = Math.floor(baseVolume * volumeDecay * (0.8 + Math.random() * 0.4));

        asks.push({
            price: Math.floor(currentLevelPrice),
            volume,
            count: baseCount + Math.floor(Math.random() * 3),
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
    immer((set, get) => ({
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
                        const profileTimes: Record<string, number> = {};

                        // Process ONLY the latest tick (most recent state)
                        const latestTick = batch[batch.length - 1];
                        profileTimes.tickExtract = performance.now() - startTime;

                        const setStartTime = performance.now();
                        set((state) => {
                            const stateStartTime = performance.now();
                            const lastPrice = state.currentPrice;
                            const currentPrice = latestTick.price;

                            // Update tick state (with latest)
                            state.currentTick = latestTick;
                            state.tickHistory.push(latestTick);

                            // Trim history
                            if (state.tickHistory.length > state.maxTickHistory) {
                                state.tickHistory.shift();
                            }
                            profileTimes.tickUpdate = performance.now() - stateStartTime;

                            // Update price state
                            const priceStartTime = performance.now();
                            state.lastPrice = lastPrice;
                            state.currentPrice = currentPrice;

                            if (lastPrice > 0) {
                                state.priceChange = currentPrice - lastPrice;
                                state.priceChangePercent = (state.priceChange / lastPrice) * 100;
                            }
                            profileTimes.priceCalc = performance.now() - priceStartTime;

                            // Update cumulative volume
                            state.cumulativeVolume += latestTick.volume;

                            // 🔥 BATCHED: Generate orderbook ONCE per frame
                            const orderbookStartTime = performance.now();
                            const { bids, asks } = generateOrderbook(currentPrice, state.orderbookDepth);
                            state.orderbookBids = bids;
                            state.orderbookAsks = asks;
                            profileTimes.orderbook = performance.now() - orderbookStartTime;

                            // 🔥 BATCHED: Add to time & sales ONCE per frame
                            const tradesStartTime = performance.now();
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
                            profileTimes.trades = performance.now() - tradesStartTime;

                            // Clear batch queue
                            state.tickBatchQueue = [];
                            state.tickBatchScheduled = false;
                        });
                        profileTimes.setState = performance.now() - setStartTime;

                        // 🔬 PROFILING: End measurement and check KPI
                        const duration = performance.now() - startTime;

                        // KPI_TARGETS.STORE.TICK_BATCH = 2ms, TICK_BATCH_PEAK = 5ms
                        if (duration > 2) { // 2ms target
                            console.warn(`[Store] ⚠️ Tick batch exceeded target: ${duration.toFixed(2)}ms > 2ms (batch size: ${batch.length})`);
                            console.log(`[Store] 📊 Breakdown:`, {
                                total: `${duration.toFixed(2)}ms`,
                                setState: `${profileTimes.setState.toFixed(2)}ms`,
                                orderbook: `${profileTimes.orderbook.toFixed(2)}ms`,
                                trades: `${profileTimes.trades.toFixed(2)}ms`,
                                tickUpdate: `${profileTimes.tickUpdate.toFixed(2)}ms`,
                                priceCalc: `${profileTimes.priceCalc.toFixed(2)}ms`,
                            });
                        }
                    });
                }
            });
        },

        // 🔥 FIX: Flush tick queue to prevent "Ghost Ticks" after interval change
        clearTickQueue: () => {
            set((state) => {
                state.tickBatchQueue = [];
                state.tickBatchScheduled = false; // Cancel pending frame
                console.log('[Store] 🧹 Tick queue flushed (preventing zombie ticks)');
            });
        },

        // 🔥 NEW: Reset live state (currentCandle/currentTick/queue) on interval switch
        resetLiveState: () => {
            set((state) => {
                state.currentCandle = null;
                state.currentTick = null;
                state.tickBatchQueue = [];
                state.tickBatchScheduled = false;
                console.log('[Store] 🔄 Live state reset (currentCandle/currentTick cleared)');
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

                    // ✅ Phase 2: Assert time is valid seconds before storing
                    assertSeconds(timeInSeconds, `setCandleHistory[${index}]`);

                    // 🔥 CRITICAL: Ensure time is PRIMITIVE NUMBER (not object wrapper)
                    if (typeof timeInSeconds !== 'number' || !Number.isFinite(timeInSeconds)) {
                        console.error(`[Store] ❌ REJECTED candle ${index}: time is not primitive number`, {
                            rawTime,
                            normalized: timeInSeconds,
                            type: typeof timeInSeconds
                        });
                        return; // Skip this candle
                    }

                    // Push data bersih
                    converted.push({
                        time: timeInSeconds,
                        open: c.o,
                        high: c.h,
                        low: c.l,
                        close: c.c,
                        volume: c.v || 0, // 🔥 PASS VOLUME (Worker normalizes to 'v')
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

                // ✅ CRITICAL: Force time to primitive number IMMEDIATELY
                // This prevents object time from propagating through the system
                let rawTime = candle.time;

                // Ensure rawTime is primitive number
                if (typeof rawTime !== 'number') {
                    if (typeof rawTime === 'object') {
                        console.error('[Store] ❌ REJECTED: candle.time is object, not primitive number', {
                            time: rawTime,
                            type: typeof rawTime,
                            keys: rawTime ? Object.keys(rawTime) : 'null'
                        });
                        return; // REJECT entirely
                    }
                    // Try to convert to number
                    rawTime = Number(rawTime);
                    if (!Number.isFinite(rawTime)) {
                        console.error('[Store] ❌ REJECTED: cannot convert time to finite number', candle.time);
                        return;
                    }
                }

                const sourceTime = normalizeTimestamp(rawTime);
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
                // 🔥 FIX: Ensure we work in SECONDS (Worker sends MS)
                const candleTime = normalizeToSeconds(rawTime);
                const snappedTime = Math.floor(candleTime / intervalSeconds) * intervalSeconds;

                // 3. Check if we need to start a new candle or update existing
                let current = state.currentCandle;


                // 🔥 CRITICAL FIX: Only create NEW candle if time bucket changed
                // Otherwise, MERGE with existing candle (preserving Open/High/Low)
                if (!current || current.time !== snappedTime) {
                    // 🚀 NEW FIX: Append previous completed candle to history
                    // This ensures indicators recalculate with new data!
                    if (current && current.time > 0) {
                        // 🔥 ORDER VALIDATION: Ensure new candle is AFTER last history candle
                        const lastHistoryTime = state.candleHistory.length > 0
                            ? state.candleHistory[state.candleHistory.length - 1].time
                            : 0;

                        if (current.time > lastHistoryTime) {
                            // ✅ Phase 2: Assert time is valid seconds before appending
                            assertSeconds(current.time, 'updateCurrentCandle:append');

                            // Previous candle is complete and in correct order, add it to history
                            state.candleHistory.push(current);
                        } else {
                            console.warn(
                                `[Store] ⚠️ Rejected out-of-order candle append:`,
                                `current.time=${current.time}, lastHistoryTime=${lastHistoryTime}`,
                                `This can happen when switching intervals. Candle discarded.`
                            );
                        }

                        // 🔥 FIX #2: Sync baseData with live candles during replay
                        // If we are on the SOURCE interval (base mode), capture this candle into baseData.
                        // This allows resampling to work correctly during live replay.
                        if (state.baseInterval === state.sourceInterval && current.time > lastHistoryTime) {
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
                    // New time bucket detected - start fresh candle
                    current = {
                        time: snappedTime,
                        open: candle.open,
                        high: candle.high,
                        low: candle.low,
                        close: candle.close,
                        volume: (candle as any).v || (candle as any).volume || 0, // 🔥 PASS VOLUME (Worker sends 'v')
                    };
                } else {
                    // Same time bucket - aggregate incoming data with existing
                    // This is critical for interval switching (e.g. 1m updates → 5m aggregation)
                    current = {
                        time: snappedTime,
                        open: current.open,  // Keep original open
                        high: Math.max(current.high, candle.high),  // Expand high if needed
                        low: Math.min(current.low, candle.low),    // Expand low if needed
                        close: candle.close,  // Always update to latest close
                        volume: (candle as any).v || (candle as any).volume || current.volume || 0, // 🔥 PASS VOLUME (Worker sends 'v')
                    };
                }

                // 4. Update state
                state.currentCandle = current;
            });
        },

        loadSimulationDay: async (dateStr, rawCandles) => {
            const { marketConfig, reset } = useSimulationStore.getState();

            // Import logger dynamically to avoid circular deps
            const { storeLog } = await import('@/utils/structuredLogger');

            set({ isPreparingData: true });

            storeLog.info('🏭 Starting data preparation', { date: dateStr, candleCount: rawCandles?.length || 0 });

            // 🔥 CRITICAL FIX: Reset store state to prevent "Ghost Candles" from previous session
            // This ensures no data pollution (e.g., ADRO candles appearing in INCO chart)
            storeLog.info('🧹 Clearing previous session state');
            reset();
            // Re-set isPreparingData because reset() clears it
            set({ isPreparingData: true, selectedDate: dateStr });


            return new Promise((resolve) => {
                // 1. Spawn Worker A (Data Administrator)
                const loaderWorker = new Worker(new URL('../workers/data-loader.worker.ts', import.meta.url));

                // 2. Setup Listeners
                loaderWorker.onmessage = (event) => {
                    const { status, payload, error } = event.data;

                    if (status === 'ERROR' || error) {
                        storeLog.error('❌ Worker A failed', { error });
                        set({ isPreparingData: false });
                        loaderWorker.terminate();
                        resolve({ historyCount: 0, simCount: 0, error: error || 'Worker A Error' });
                        return;
                    }

                    if (status === 'SUCCESS' && payload) {
                        const { history, simulation, metadata } = payload;
                        storeLog.info('📦 Data received from Worker A', {
                            historyCount: history.length,
                            simCount: simulation.length,
                            metadata
                        });

                        // 3. Update Store
                        set((state) => {
                            state.selectedDate = dateStr;

                            // 🔥 CRITICAL: Sort history by time BEFORE loading to chart!
                            // Source JSON files may have unsorted data
                            const sortedHistory = [...history].sort((a: any, b: any) => {
                                const timeA = typeof a.t === 'number' ? a.t : new Date(a.t).getTime();
                                const timeB = typeof b.t === 'number' ? b.t : new Date(b.t).getTime();
                                return timeA - timeB; // Ascending
                            });

                            // Load History
                            // Wrapper: EnrichedCandle -> ChartCandle
                            state.candleHistory = sortedHistory.map((c: any) => ({
                                time: c.t / 1000,
                                open: c.o,
                                high: c.h,
                                low: c.l,
                                close: c.c
                            }));

                            // Load Simulation (Keep enriched format for Physics Engine)
                            state.simulationCandles = simulation;

                            // Initialize Master Blueprint Data
                            // 🔥 FIX: Initialize baseData with FULL history + simulation for resampling
                            // This guarantees that even 5m/15m charts have data immediately
                            // Note: We need to convert WorkerCandle back to ResamplerCandle (ms timestamp)
                            const fullData = [...sortedHistory, ...simulation].map((c: any) => ({
                                time: c.t,
                                open: c.o,
                                high: c.h,
                                low: c.l,
                                close: c.c,
                                volume: c.v || 0,
                                metadata: { isPartial: false }
                            }));

                            // 🔥 CRITICAL: Sort baseData too! This is the master source for all resampling
                            const sortedBaseData = fullData.sort((a, b) => {
                                const timeA = typeof a.time === 'number' ? a.time : new Date(a.time).getTime();
                                const timeB = typeof b.time === 'number' ? b.time : new Date(b.time).getTime();
                                return timeA - timeB;
                            });

                            state.baseData = sortedBaseData;
                            // 🔥 NEW: No more cachedIntervals - using compute-on-demand

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

        // 🆕 Master Blueprint: Load data with smart buffering + LRU Memory Management
        async loadWithSmartBuffer(ticker, startDate, interval) {
            try {
                console.log(`[Store] 📥 Loading ${ticker} (LRU mode, max ${MAX_CACHED_TICKERS} tickers)...`);

                // 🔥 LRU Eviction: Check if cache is full
                const state = useSimulationStore.getState();
                const currentTickers = Array.from(state.rawSources.keys());

                if (!currentTickers.includes(ticker) && currentTickers.length >= MAX_CACHED_TICKERS) {
                    // Find least recently used ticker
                    let oldestTicker = currentTickers[0];
                    let oldestTime = TICKER_ACCESS_LOG.get(oldestTicker) || 0;

                    for (const t of currentTickers) {
                        const accessTime = TICKER_ACCESS_LOG.get(t) || 0;
                        if (accessTime < oldestTime) {
                            oldestTicker = t;
                            oldestTime = accessTime;
                        }
                    }

                    console.log(`🧹 [Store] Evicting ${oldestTicker} to free RAM for ${ticker}`);
                    set((state) => {
                        state.rawSources.delete(oldestTicker);
                    });
                    TICKER_ACCESS_LOG.delete(oldestTicker);
                }

                // Update access time
                TICKER_ACCESS_LOG.set(ticker, Date.now());

                // Load raw sources (1m only for now, 60m loaded on-demand for hybrid mode)
                const { loadHybridData } = await import('@/utils/hybridStitcher');
                const stitched = await loadHybridData({ ticker, targetInterval: '1m' });

                set((state) => {
                    // Store ONLY raw 1m data (no interval derivatives)
                    state.rawSources.set(ticker, {
                        '1m': stitched.candles,
                        // 60m will be lazy-loaded when user switches to >=1h intervals
                    });

                    state.currentTicker = ticker;
                    state.baseInterval = '1m';
                    state.sourceInterval = '1m';

                    // 🔥 Keep baseData for backward compatibility (some components may still use it)
                    state.baseData = stitched.candles;
                    state.bufferData = [];

                    // 🔥 CRITICAL: Update candleHistory with trimmed data
                    // ENSURE ALL TIMESTAMPS ARE PRIMITIVES before storing
                    state.candleHistory = stitched.candles.map((c, index) => {
                        // Convert time to primitive number (seconds)
                        let primitiveTime: number;
                        if (typeof c.time === 'number') {
                            primitiveTime = c.time > 10_000_000_000 ? Math.floor(c.time / 1000) : c.time;
                        } else if (typeof c.time === 'string') {
                            primitiveTime = Math.floor(new Date(c.time).getTime() / 1000);
                        } else {
                            console.error('[Store] Invalid time type in historySlice:', typeof c.time, c.time);
                            primitiveTime = Math.floor(Date.now() / 1000); // Fallback
                        }

                        return {
                            time: primitiveTime,  // GUARANTEED primitive
                            open: c.open,
                            high: c.high,
                            low: c.low,
                            close: c.close,
                            volume: c.volume || 0, // Changed 'value' to 'volume' to match original
                            metadata: {
                                isPartial: !!(c as any).metadata?.isPartial,
                                source: 'history',
                                rawIndex: index
                            }
                        };
                    });
                    // 🔥 REPLAY MODE: Trim candleHistory for tick-by-tick simulation
                    // Chart loads initial subset, worker fills rest dynamically
                    const REPLAY_HISTORY_SIZE = 200;
                    if (state.candleHistory.length > REPLAY_HISTORY_SIZE) {
                        console.log(`[Store] 🎬 Replay Mode: Trimming candleHistory ${state.candleHistory.length} → ${REPLAY_HISTORY_SIZE}`);
                        state.candleHistory = state.candleHistory.slice(0, REPLAY_HISTORY_SIZE);
                    }
                });

                const memoryUsageMB = (stitched.candles.length * 48 / 1024 / 1024).toFixed(1);
                console.log(`[Store] ✅ Loaded ${ticker}: ${stitched.candles.length} candles (~${memoryUsageMB}MB)`);
                console.log(`[Store] 📊 Cache status: ${state.rawSources.size}/${MAX_CACHED_TICKERS} tickers`);
            } catch (error) {
                // 🔥 FIX: Proper error logging
                const errorMsg = error instanceof Error ? error.message : String(error);
                const errorStack = error instanceof Error ? error.stack : undefined;

                console.error('[Store] ❌ Load failed:', errorMsg);
                if (errorStack) {
                    console.error('[Store] Stack:', errorStack);
                }

                throw error;
            }
        },

        // 🆕 Master Blueprint: Switch interval with CACHED resampling (OPTIMIZED)
        switchInterval(targetInterval): ResamplerCandle[] {
            const state = useSimulationStore.getState();
            const ticker = state.currentTicker;

            if (!ticker) {
                throw new Error('[Store] No ticker loaded');
            }

            // 1. Capture Anchor Time (Precise Snapshot)
            let anchorTime: number | null = null;
            if (state.candleHistory.length > 0) {
                anchorTime = state.candleHistory[state.candleHistory.length - 1].time; // Seconds
                console.log(`[Store] ⚓ Captured Anchor Time: ${new Date(anchorTime * 1000).toLocaleString()} (${anchorTime})`);
            }

            const rawSource = state.rawSources.get(ticker);
            if (!rawSource || !rawSource['1m']) {
                throw new Error(`[Store] No raw 1m data for ${ticker}`);
            }

            // 🚀 PERFORMANCE OPTIMIZATION: Cache Check
            const { resamplingCache } = require('@/utils/resamplingCache');
            const sourceData = rawSource['1m'];
            const dataHash = resamplingCache.generateDataHash(sourceData);

            // Try to get from cache first
            const cached = resamplingCache.get(ticker, '1m', targetInterval, dataHash);

            let resampled: ResamplerCandle[];
            let fromCache = false;

            if (cached) {
                resampled = cached;
                fromCache = true;
                console.log(`[Store] ⚡ Cache HIT: ${ticker} 1m → ${targetInterval} (instant)`);
            } else {
                // Cache miss - perform resampling with windowing
                const startTime = performance.now();

                // 🔥 WINDOWING: Limit to last 600 candles for performance
                // Full history kept for indicators that need it (handled by indicator compute)
                const MAX_WINDOW = 600;

                resampled = resampleCandles(
                    sourceData,
                    '1m',
                    targetInterval,
                    MAX_WINDOW  // Window parameter
                );

                const duration = performance.now() - startTime;
                console.log(`[Store] 🔄 Resampled ${ticker}: 1m → ${targetInterval} in ${duration.toFixed(1)}ms (${resampled.length} candles)`);

                // ⚠️ Performance guard
                if (duration > 50) {
                    console.warn(`[Store] ⚠️ Slow resample: ${duration.toFixed(2)}ms > 50ms target`);
                }

                // Store in cache for next time
                resamplingCache.set(ticker, '1m', targetInterval, dataHash, resampled);
            }

            // Update store state
            set((state) => {
                state.baseInterval = targetInterval;
                state.epoch += 1; // 🔥 NEW SESSION (increment only once)
                state.tempAnchorTime = anchorTime; // ✅ Save for UI consumption

                // 🔥 CRITICAL: Reset live state to prevent "past update" errors
                state.currentCandle = null;
                state.currentTick = null;
                state.tickBatchQueue = [];
                state.tickBatchScheduled = false;

                // 🔥 LOGIC: Dynamic History Trimming (Prevent Overlap)
                // 🔥 LOGIC: Dynamic History Trimming (Prevent Overlap & Starvation)
                const totalCandles = resampled.length;
                let cutOffIndex = 0; // Default to 0 if specific logic doesn't set it

                if (anchorTime) {
                    // Find the candle in new data that matches our Anchor Time
                    // anchorTime is in Seconds. resampled[].time is in MS.
                    const targetMs = anchorTime * 1000;
                    const idx = resampled.findIndex(c => {
                        const t = typeof c.time === 'string' ? new Date(c.time).getTime() : c.time;
                        return t >= targetMs;
                    });

                    if (idx !== -1) {
                        // We want History to INCLUDE this candle (so chart shows it)
                        // Worker will start from the NEXT candle.
                        cutOffIndex = idx + 1;
                        console.log(`[Store] ✂️ Trimmed History at Index ${cutOffIndex} (${new Date(resampled[idx].time).toLocaleString()})`);
                    }
                }

                // If anchor logic failed or didn't run (cutOffIndex is 0 or invalid)
                // Use Fallback Logic
                if (cutOffIndex === 0) {
                    const DEFAULT_HISTORY = 200;
                    if (totalCandles > DEFAULT_HISTORY) {
                        cutOffIndex = DEFAULT_HISTORY;
                    } else {
                        // Fallback for small datasets: Take 90% as history
                        cutOffIndex = Math.floor(totalCandles * 0.9);
                    }
                }

                // 🔥 CRITICAL SAFETY: Prevent Worker Starvation
                // We MUST leave at least 1 candle for the Simulation Queue.
                const MAX_ALLOWED_HISTORY = Math.max(0, totalCandles - 1);

                if (cutOffIndex > MAX_ALLOWED_HISTORY) {
                    cutOffIndex = MAX_ALLOWED_HISTORY;
                    console.warn(`[Store] ⚠️ Anti-Starvation: Capped History to ${cutOffIndex}/${totalCandles} candles`);
                }

                // Optimize for indicators (ensure minimum history if possible)
                const MIN_HISTORY_FOR_INDICATORS = Math.min(50, totalCandles - 1); // Try to get 50
                if (cutOffIndex < MIN_HISTORY_FOR_INDICATORS && totalCandles > 10) {
                    // If we cut too aggressively (e.g. anchor was very early), force some history context
                    // But only if we have enough data (e.g. > 10 candles)
                    cutOffIndex = MIN_HISTORY_FOR_INDICATORS;
                }

                // Slice History
                const historySlice = resampled.slice(0, cutOffIndex);

                // 🔥 ONE-STEP BACK FIX (Store Side)
                // Check overlap with Queue (rest of data)
                // We must ensure History End < Queue Start Timestamp
                const queueStartIdx = cutOffIndex;
                if (historySlice.length > 0 && queueStartIdx < resampled.length) {
                    const lastHist = historySlice[historySlice.length - 1];
                    const firstQueue = resampled[queueStartIdx];

                    // 🔥 CRITICAL FIX: Compare in SECONDS (Chart Precision)
                    // Candles might be distinct in MS but collide in Seconds
                    const tHistSec = normalizeToSeconds(lastHist.time);
                    const tQueueSec = normalizeToSeconds(firstQueue.time);

                    if (tHistSec >= tQueueSec) {
                        console.warn(`[Store] ⚠️ Overlap detected (Hist: ${tHistSec}s >= Queue: ${tQueueSec}s). Popping history.`);
                        historySlice.pop();
                    }
                }

                // Convert to chart format (ms → seconds)
                // 🔥 PARANOID: Ensure ALL timestamps are pure numbers, not objects
                state.candleHistory = historySlice.map((c, index) => {
                    const timeNormalized = normalizeToSeconds(c.time);

                    // Double-check: make sure it's a finite number
                    if (!Number.isFinite(timeNormalized)) {
                        console.error(`[Store] 🚨 Bad timestamp in resampled data at index ${index}:`, {
                            original: c.time,
                            normalized: timeNormalized,
                            type: typeof c.time
                        });
                        // Skip this candle (don't add to history)
                        return null;
                    }

                    return {
                        time: timeNormalized,
                        open: c.open,
                        high: c.high,
                        low: c.low,
                        close: c.close,
                        volume: c.volume || 0 // 🔥 PASS VOLUME (Resampled)
                    };
                }).filter(Boolean) as any[]; // Remove nulls

                // 🔥 FULL DATA for Worker (Page will slice it using history length)
                // workerQueue = baseData.slice(candleHistory.length)
                state.baseData = resampled;
            });

            return resampled;
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

        evictOldestTicker() {
            const state = useSimulationStore.getState();
            const currentTickers = Array.from(state.rawSources.keys());

            if (currentTickers.length === 0) {
                console.log('[Store] 🛡️ No tickers to evict');
                return;
            }

            // Find least recently used ticker
            let oldestTicker = currentTickers[0];
            let oldestTime = TICKER_ACCESS_LOG.get(oldestTicker) || 0;

            for (const t of currentTickers) {
                const accessTime = TICKER_ACCESS_LOG.get(t) || 0;
                if (accessTime < oldestTime) {
                    oldestTicker = t;
                    oldestTime = accessTime;
                }
            }

            console.log(`🧹 [Store] Manually evicting ${oldestTicker}`);
            set((state) => {
                state.rawSources.delete(oldestTicker);
            });
            TICKER_ACCESS_LOG.delete(oldestTicker);
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

        // ============================================================================
        // 🔥 NEW: Data Updater Actions
        // ============================================================================

        /**
         * Set floor timestamp for a ticker (oldest candle time)
         * This prevents re-downloading baseline data
         */
        setFloorTimestamp(ticker, timestamp) {
            set((state) => {
                state.tickerFloors.set(ticker, timestamp);
                console.log(`[Store] 🔒 Floor set for ${ticker}: ${new Date(timestamp * 1000).toLocaleString()}`);
            });
        },

        /**
         * Update data for a ticker/interval using Clean Cut & Stitch algorithm
         * Includes zombie protection via epoch bump and state rehydration
         */
        async updateData(ticker, interval) {
            const { rawSources, tickerFloors, epoch } = get();

            console.log(`[Store] 🔄 Starting data update for ${ticker} ${interval} (epoch ${epoch})`);

            // \ud83d\udd25 Get current data (Store uses MS)
            // But DataUpdater REQUIRES Seconds. So we convert.
            const currentDataMs = rawSources.get(ticker)?.['1m'] || [];
            const currentDataSeconds = currentDataMs.map((c: any) => ({
                ...c,
                t: normalizeToSeconds(c.time || c.t) // Ensure 't' is seconds
            }));

            if (currentDataSeconds.length === 0) {
                console.warn(`[Store] ⚠️ No local data for ${ticker}. Cannot update (load initial data first).`);
                return {
                    updatedData: [],
                    addedCount: 0,
                    removedCount: 0,
                    status: 'error' as const,
                    message: 'No local data found. Please load initial data first.'
                };
            }

            // \ud83d\udd25 Get floor timestamp (prevent re-downloading baseline)
            const floorTimestamp = tickerFloors.get(ticker) || undefined;

            // \ud83d\udd25 Define fetch function (mock API)
            const fetchFunction = async (from: number, to: number): Promise<import('@/types').Candle[]> => {
                const response = await fetch(
                    `/api/candles?symbol=${ticker}&interval=${interval}&from=${from}&to=${to}`
                );

                if (!response.ok) {
                    throw new Error(`API returned ${response.status}: ${response.statusText}`);
                }

                const json = await response.json();

                // \ud83d\udd25 CRITICAL: Validate that API returns seconds (not ms)
                // DataUpdater expects { t: number (seconds), o, h, l, c, v }
                return json.data.map((item: any) => {
                    const t = item.t || item.timestamp;
                    if (t > 10_000_000_000) {
                        throw new Error(`API returned milliseconds, expected seconds: ${t}`);
                    }
                    return {
                        t,  // Seconds
                        o: item.o || item.open,
                        h: item.h || item.high,
                        l: item.l || item.low,
                        c: item.c || item.close,
                        v: item.v || item.volume || 0
                    };
                });
            };

            // \ud83d\udd25 Import DataUpdater dynamically to avoid circular deps
            const { smartSyncStockData } = await import('@/utils/DataUpdater');

            // \ud83d\udd25 Run update with floor protection
            const result = await smartSyncStockData(
                currentDataSeconds as any[], // Pass Seconds version
                fetchFunction as any,
                {
                    rewindStrategy: 'day',
                    minGapHours: 1,
                    debug: true,
                    epoch  // Pass current epoch for logging
                },
                floorTimestamp  // Floor protection
            );

            // \ud83d\udd25 Update store if successful
            if (result.status === 'success') {
                // Convert back to Milliseconds for Store (Resampler format)
                const updatedDataMs = result.updatedData.map(c => ({
                    time: (c.t as number) * 1000, // Convert Seconds -> MS
                    open: c.o,
                    high: c.h,
                    low: c.l,
                    close: c.c,
                    volume: c.v
                }));

                set((state) => {
                    // 1. Update rawSources (store in 1m bucket)
                    if (!state.rawSources.has(ticker)) {
                        state.rawSources.set(ticker, { '1m': [] });
                    }
                    // Store as ResamplerCandle[] (MS)
                    state.rawSources.get(ticker)!['1m'] = updatedDataMs as any[];

                    // 2. Bump epoch (kill zombie ticks)
                    state.epoch += 1;

                    // 3. Reset live state
                    state.currentCandle = null;
                    state.currentTick = null;
                    state.tickBatchQueue = [];
                    state.tickBatchScheduled = false;

                    // 4. Update metadata
                    state.lastUpdateTime = Math.floor(Date.now() / 1000);

                    console.log(`[Store] ✅ Update successful (epoch now ${state.epoch})`);
                    console.log(`[Store]    - Added: ${result.addedCount} candles`);
                    console.log(`[Store]    - Removed: ${result.removedCount} candles`);
                });

                // 5. Rehydrate candleHistory if user viewing this ticker/interval
                const currentTicker = get().currentTicker;
                const currentInterval = get().baseInterval;

                if (ticker === currentTicker && interval === currentInterval) {
                    // Trigger interval switch to rebuild candleHistory
                    get().switchInterval(interval);
                    console.log('[Store] 🔄 Rehydrated candleHistory with updated data');
                }

                // TODO: Persist to IndexedDB if needed
                // await saveToIndexedDB(ticker, interval, result.updatedData);
            } else {
                console.log(`[Store] ℹ️ Update result: ${result.status} - ${result.message}`);
            }

            return result;
        },

        /**
         * Update ALL 1m tickers available in the system
         * Sequentially processes updates to avoid browser/network overload
         */
        async updateAllTickers() {
            const { epoch, rawSources, currentTicker } = get();
            console.log(`[Store] 🚀 Starting Batch Update (Epoch ${epoch})`);

            try {
                // 🔥 CALL SERVER-SIDE BATCH API
                // This bypasses client LRU limits and ensures persistence to disk
                const response = await fetch('/api/simulation/batch-update', { method: 'POST' });

                if (!response.ok) {
                    throw new Error(`Server returned ${response.status}: ${response.statusText}`);
                }

                const result = await response.json();

                if (!result.success) {
                    throw new Error(result.error || 'Unknown server error');
                }

                const summary = result.summary;
                console.log(`[Store] 🏁 Batch Update Complete.`, summary);

                // 🔥 CRITICAL: Reload CURRENT ticker if it was updated
                // The file on disk has changed, but our RAM cache might be stale OR empty
                if (currentTicker && rawSources.has(currentTicker)) {
                    console.log(`[Store] 🔄 Reloading active ticker ${currentTicker} to reflect batch update...`);
                    // Force reload by removing from cache and calling switchInterval (which triggers load)
                    set(state => {
                        state.rawSources.delete(currentTicker);
                    });

                    // Trigger reload logic
                    get().switchInterval('1m');
                }

                return {
                    successCount: summary.successCount,
                    failCount: summary.failCount + (summary.errorCount || 0),
                    results: result.results
                };

            } catch (error) {
                console.error('[Store] 💥 Batch Update Crashed:', error);
                return { successCount: 0, failCount: 1, results: [], error };
            }
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
