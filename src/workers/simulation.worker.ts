/**
 * Simulation Worker
 * Background thread for tick-by-tick simulation
 * Ports existing pricePathGenerator logic to Web Worker context
 */

// ============================================================================
// Type Definitions (copied from main thread types)
// ============================================================================

interface Candle {
    t: number; // timestamp in ms
    o: number; // open
    h: number; // high
    l: number; // low
    c: number; // close
    v: number; // volume
}

interface TickData {
    price: number;
    volume: number;
    timestamp: number;
    candleIndex: number;
    tickIndex: number;
}

interface WorkerMessage {
    type: 'INIT_DATA' | 'PLAY' | 'PAUSE' | 'STOP' | 'SET_SPEED' | 'SEEK' | 'CALCULATE_INDICATOR';
    candles?: Candle[];
    speed?: number; // 1 = realtime, 2 = 2x speed, etc.
    index?: number; // for SEEK
    indicator?: IndicatorRequest; // for CALCULATE_INDICATOR
}

interface IndicatorRequest {
    name: 'volume' | 'vwap' | 'rsi' | 'sma' | 'ema' | 'macd' | 'bollinger';
    params?: {
        period?: number;
        [key: string]: any;
    };
}

interface IndicatorResult {
    time: number;
    value: number;
}

interface VolumeResult {
    time: number;
    value: number;
    color: string; // 'green' for bullish, 'red' for bearish
}

interface PriceAnchor {
    tick: number;
    price: number;
}

// ============================================================================
// Market Configuration (for gap handling)
// ============================================================================

interface MarketConfig {
    timezone: string;
    openHour: number;
    closeHour: number;
    lunchBreakStart: number;  // 11.5 = 11:30
    lunchBreakEnd: number;    // 13.5 = 13:30
    filterEnabled: boolean;
}

// Default IDX (Indonesia Stock Exchange) market config
const DEFAULT_MARKET_CONFIG: MarketConfig = {
    timezone: 'Asia/Jakarta',
    openHour: 9,
    closeHour: 16,
    lunchBreakStart: 11.5,  // 11:30 WIB
    lunchBreakEnd: 13.5,    // 13:30 WIB
    filterEnabled: true
};

/**
 * Validate and sanitize OHLC candle data
 * Ensures high >= max(open, close) and low <= min(open, close)
 * @returns null if candle is completely invalid (should be skipped)
 */
function validateAndSanitizeOHLC(candle: Candle, index: number): Candle | null {
    let { o, h, l, c, t, v } = candle;

    // 1. Basic null/NaN check
    if ([o, h, l, c].some(p => p === null || p === undefined || isNaN(p) || p <= 0)) {
        console.warn(`[SimulationWorker] ⚠️ Candle ${index}: Invalid OHLC values, skipping`);
        return null;
    }

    // 2. Fix high/low inversion (common data bug)
    if (h < l) {
        console.warn(`[SimulationWorker] ⚠️ Candle ${index}: high (${h}) < low (${l}), swapping`);
        [h, l] = [l, h];
    }

    // 3. Ensure high >= max(open, close)
    const maxOC = Math.max(o, c);
    if (h < maxOC) {
        console.warn(`[SimulationWorker] ⚠️ Candle ${index}: high (${h}) < max(O,C) (${maxOC}), adjusting`);
        h = maxOC;
    }

    // 4. Ensure low <= min(open, close)
    const minOC = Math.min(o, c);
    if (l > minOC) {
        console.warn(`[SimulationWorker] ⚠️ Candle ${index}: low (${l}) > min(O,C) (${minOC}), adjusting`);
        l = minOC;
    }

    return { ...candle, o, h, l, c };
}

/**
 * Get IDX tick size based on price
 * IDX (Indonesia Stock Exchange) tick size rules:
 * - Price < 200: tick size = 1
 * - 200 <= Price < 500: tick size = 2
 * - 500 <= Price < 2000: tick size = 5
 * - 2000 <= Price < 5000: tick size = 10
 * - Price >= 5000: tick size = 25
 */
function getIDXTickSize(price: number): number {
    if (price < 200) return 1;
    if (price < 500) return 2;
    if (price < 2000) return 5;
    if (price < 5000) return 10;
    return 25;
}

/**
 * Round price to nearest valid IDX tick size
 */
function roundToIDXTickSize(price: number): number {
    const tickSize = getIDXTickSize(price);
    return Math.round(price / tickSize) * tickSize;
}

/**
 * Generate realistic orderbook with IDX-compliant tick sizes
 * @param currentPrice - Current market price
 * @param spread - Bid-ask spread percentage (e.g., 0.001 = 0.1%)
 * @param depth - Number of price levels on each side
 */
function generateOrderbook(
    currentPrice: number,
    spread: number = 0.001,
    depth: number = 5
): { bids: Array<{ price: number; volume: number }>; asks: Array<{ price: number; volume: number }> } {
    const bids: Array<{ price: number; volume: number }> = [];
    const asks: Array<{ price: number; volume: number }> = [];

    const tickSize = getIDXTickSize(currentPrice);
    const halfSpread = currentPrice * spread / 2;

    // Best bid/ask with spread
    const bestBid = roundToIDXTickSize(currentPrice - halfSpread);
    const bestAsk = roundToIDXTickSize(currentPrice + halfSpread);

    // Generate bid levels (descending from best bid)
    for (let i = 0; i < depth; i++) {
        const price = bestBid - (i * tickSize);
        const volume = Math.floor(1000 + Math.random() * 9000); // 1k-10k random volume
        bids.push({ price, volume });
    }

    // Generate ask levels (ascending from best ask)
    for (let i = 0; i < depth; i++) {
        const price = bestAsk + (i * tickSize);
        const volume = Math.floor(1000 + Math.random() * 9000);
        asks.push({ price, volume });
    }

    return { bids, asks };
}

/**
 * Check if timestamp is during lunch break
 * @param timestamp - Unix timestamp in milliseconds
 * @param config - Market configuration
 * @returns true if during lunch break
 */
function isLunchBreak(timestamp: number, config: MarketConfig = DEFAULT_MARKET_CONFIG): boolean {
    if (!config.filterEnabled) return false;

    const date = new Date(timestamp);
    // Get hour in configured timezone
    const hourStr = date.toLocaleString('en-US', {
        hour: 'numeric',
        hour12: false,
        timeZone: config.timezone
    });
    const minuteStr = date.toLocaleString('en-US', {
        minute: 'numeric',
        timeZone: config.timezone
    });

    const hour = parseInt(hourStr) + parseInt(minuteStr) / 60;

    return hour >= config.lunchBreakStart && hour < config.lunchBreakEnd;
}

/**
 * Calculate average volume for volume-based pacing
 */
function calculateAverageVolume(candles: Candle[]): number {
    if (candles.length === 0) return 1;
    const total = candles.reduce((sum, c) => sum + c.v, 0);
    return total / candles.length;
}

// ============================================================================
// Price Path Generator (Brownian Bridge Logic)
// ============================================================================

function generatePricePath(candle: Candle, numTicks = 20): number[] {
    const { o, h, l, c } = candle;

    // Edge case: no price movement
    if (h === l) {
        return Array(numTicks).fill(c);
    }

    // 1. Analyze candle characteristics
    const isBullish = c > o;
    const range = h - l;
    const bodySize = Math.abs(c - o);
    const bodyPercent = range > 0 ? bodySize / range : 0;
    const isChoppy = bodyPercent < 0.3; // small body relative to range

    // 2. Determine price path pattern
    let anchors: PriceAnchor[];

    if (isBullish && !isChoppy) {
        // Bullish pattern: O → H → pullback to L → C
        const highTick = Math.floor(numTicks * 0.35); // reach high early
        const lowTick = Math.floor(numTicks * 0.65); // pullback

        anchors = [
            { tick: 0, price: o },
            { tick: highTick, price: h },
            { tick: lowTick, price: l },
            { tick: numTicks - 1, price: c },
        ];
    } else if (!isBullish && !isChoppy) {
        // Bearish pattern: O → L → bounce to H → C
        const lowTick = Math.floor(numTicks * 0.35);
        const highTick = Math.floor(numTicks * 0.65);

        anchors = [
            { tick: 0, price: o },
            { tick: lowTick, price: l },
            { tick: highTick, price: h },
            { tick: numTicks - 1, price: c },
        ];
    } else {
        // Choppy/doji: random sequence touching H & L
        const firstExtreme = Math.random() > 0.5 ? h : l;
        const secondExtreme = firstExtreme === h ? l : h;

        anchors = [
            { tick: 0, price: o },
            { tick: Math.floor(numTicks * 0.25), price: firstExtreme },
            { tick: Math.floor(numTicks * 0.5), price: (h + l) / 2 },
            { tick: Math.floor(numTicks * 0.75), price: secondExtreme },
            { tick: numTicks - 1, price: c },
        ];
    }

    // 3. Interpolate between anchors dengan noise
    const path: number[] = [];

    for (let i = 0; i < numTicks; i++) {
        // Find surrounding anchor points
        const before = anchors.filter((a) => a.tick <= i).pop();
        const after = anchors.find((a) => a.tick > i);

        if (!before || !after) {
            // Last tick atau edge case
            path.push(i === numTicks - 1 ? c : o);
            continue;
        }

        // Linear interpolation
        const progress = (i - before.tick) / (after.tick - before.tick);
        const basePrice = before.price + (after.price - before.price) * progress;

        // Add gaussian noise (±0.3% of range untuk smoothness)
        const noiseAmplitude = range * 0.003;
        const noise = (Math.random() - 0.5) * 2 * noiseAmplitude;
        let price = basePrice + noise;

        // Clamp to H/L bounds
        price = Math.max(l, Math.min(h, price));

        path.push(price);
    }

    // Ensure critical constraints
    path[0] = o; // start at open
    path[numTicks - 1] = c; // end at close

    // Ensure H and L are touched at least once
    if (!path.some((p) => Math.abs(p - h) < range * 0.001)) {
        // Force high touch at appropriate position
        const highIdx = isBullish
            ? Math.floor(numTicks * 0.35)
            : Math.floor(numTicks * 0.65);
        path[highIdx] = h;
    }

    if (!path.some((p) => Math.abs(p - l) < range * 0.001)) {
        // Force low touch
        const lowIdx = isBullish
            ? Math.floor(numTicks * 0.65)
            : Math.floor(numTicks * 0.35);
        path[lowIdx] = l;
    }

    return path;
}

function distributeVolume(totalVolume: number, numTicks = 20): number[] {
    if (totalVolume === 0) {
        return Array(numTicks).fill(0);
    }

    const baseVolume = totalVolume / numTicks;

    // Add variance (±30%) untuk realism
    const volumes = Array.from({ length: numTicks }, () => {
        const variance = 0.7 + Math.random() * 0.6; // 0.7x - 1.3x
        return Math.floor(baseVolume * variance);
    });

    // Ensure sum equals total (adjust last tick for rounding errors)
    const currentSum = volumes.reduce((sum, v) => sum + v, 0);
    const diff = totalVolume - currentSum;
    volumes[numTicks - 1] += diff;

    return volumes;
}

// ============================================================================
// Indicator Calculations (for Lightweight Charts)
// ============================================================================

/**
 * Calculate Volume indicator
 * Returns volume with color based on candle direction
 */
function calculateVolume(candles: Candle[]): VolumeResult[] {
    return candles.map(candle => ({
        time: candle.t / 1000, // Convert to seconds for Lightweight Charts
        value: candle.v,
        color: candle.c >= candle.o ? '#26a69a' : '#ef5350' // Green if bullish, red if bearish
    }));
}

/**
 * Calculate VWAP (Volume Weighted Average Price)
 * VWAP = Σ(Price × Volume) / Σ(Volume)
 * Typical Price = (High + Low + Close) / 3
 */
function calculateVWAP(candles: Candle[]): IndicatorResult[] {
    const results: IndicatorResult[] = [];
    let cumulativePV = 0; // Price × Volume
    let cumulativeVolume = 0;

    candles.forEach(candle => {
        const typicalPrice = (candle.h + candle.l + candle.c) / 3;
        cumulativePV += typicalPrice * candle.v;
        cumulativeVolume += candle.v;

        const vwap = cumulativeVolume > 0 ? cumulativePV / cumulativeVolume : typicalPrice;

        results.push({
            time: candle.t / 1000,
            value: vwap
        });
    });

    return results;
}

/**
 * Calculate RSI (Relative Strength Index)
 * Using technicalindicators library
 */
function calculateRSI(candles: Candle[], period: number = 14): IndicatorResult[] {
    // Import RSI from technicalindicators (will be available at runtime)
    // @ts-ignore - Worker context import
    const { RSI } = require('technicalindicators');

    const closePrices = candles.map(c => c.c);

    const rsiValues = RSI.calculate({
        values: closePrices,
        period: period
    });

    // RSI returns fewer values than input (period warmup)
    // Map back to original timestamps, skipping warmup period
    const results: IndicatorResult[] = [];

    rsiValues.forEach((value: number, index: number) => {
        const candleIndex = index + period; // Offset by warmup period
        if (candleIndex < candles.length) {
            results.push({
                time: candles[candleIndex].t / 1000,
                value: value
            });
        }
    });

    return results;
}

/**
 * Generic indicator calculator
 * Routes to specific implementation based on indicator name
 */
function calculateIndicator(candles: Candle[], request: IndicatorRequest): any[] {
    const { name, params = {} } = request;

    switch (name) {
        case 'volume':
            return calculateVolume(candles);

        case 'vwap':
            return calculateVWAP(candles);

        case 'rsi':
            return calculateRSI(candles, params.period || 14);

        // Future indicators can be added here
        case 'sma':
        case 'ema':
        case 'macd':
        case 'bollinger':
            console.warn(`[SimulationWorker] Indicator "${name}" not yet implemented`);
            return [];

        default:
            console.error(`[SimulationWorker] Unknown indicator: ${name}`);
            return [];
    }
}

// ============================================================================
// Simulation Engine State
// ============================================================================

class SimulationEngine {
    private candles: Candle[] = [];
    private currentCandleIndex: number = 0;
    private currentTickIndex: number = 0;
    private isPlaying: boolean = false;
    private playbackSpeed: number = 1; // 1 = realtime
    private tickInterval: number | null = null;

    // Current candle tick data
    private pricePath: number[] = [];
    private volumePath: number[] = [];
    private numTicks: number = 60; // ✅ Increased from 20 to 60 for smoother movement (1 tick/second at 1x)

    // ✅ Throttling for 60 FPS (16ms target)
    private lastMessageTime: number = 0;
    private readonly MESSAGE_THROTTLE_MS: number = 16; // ~60 FPS

    // ✅ CANDLE_UPDATE throttle (prevent UI flooding)
    private lastCandleUpdateTime: number = 0;
    private readonly CANDLE_UPDATE_THROTTLE_MS: number = 50; // 20 FPS max

    // Aggregated candle (for Lightweight Charts)
    private currentAggregatedCandle: {
        time: number;
        open: number;
        high: number;
        low: number;
        close: number;
    } | null = null;

    // ✅ NEW: Volume-based pacing
    private averageVolume: number = 1;

    // ✅ NEW: Market config for gap handling (configurable)
    private marketConfig: MarketConfig = DEFAULT_MARKET_CONFIG;

    // ✅ NEW: Expected candle duration for timeframe verification
    private expectedCandleDuration: number = 60000; // Will be calculated per candle

    constructor() {
        console.log('[SimulationWorker] Engine initialized');
    }

    // NEW: Initialize with data from main thread
    initData(candles: Candle[]) {
        console.log(`[SimulationWorker] Data initialized: ${candles.length} candles`);

        // PRE-PROCESS DATA DI WORKER
        // Pastikan candle.t dikonversi ke millisecond number yang valid SEBELUM masuk logic simulasi
        const processedCandles = candles.map(c => {
            let timestamp: number;
            const rawTimestamp: any = c.t; // Type as any first to allow instanceof check

            if (typeof rawTimestamp === 'number') {
                timestamp = rawTimestamp < 10000000000 ? rawTimestamp * 1000 : rawTimestamp;
            } else if (rawTimestamp instanceof Date) {
                timestamp = rawTimestamp.getTime();
            } else if (typeof rawTimestamp === 'string') {
                timestamp = new Date(rawTimestamp).getTime();
            } else {
                console.error('[SimulationWorker] Invalid timestamp type:', typeof c.t);
                timestamp = Date.now();
            }

            return {
                ...c,
                t: timestamp // SEKARANG PASTI MILLISECONDS
            };
        });

        // ✅ FIX: Sort candles by timestamp untuk ensure monotonic time
        processedCandles.sort((a, b) => a.t - b.t);

        // ✅ NEW: Validate and sanitize OHLC data
        const validatedCandles = processedCandles
            .map((c, idx) => validateAndSanitizeOHLC(c, idx))
            .filter((c): c is Candle => c !== null); // Remove invalid candles

        const invalidCount = processedCandles.length - validatedCandles.length;
        if (invalidCount > 0) {
            console.warn(`[SimulationWorker] ⚠️ Filtered out ${invalidCount} invalid candles`);
        }

        // ✅ NEW: Filter out lunch break candles (IDX: 11:30-13:30 WIB)
        const beforeFilter = validatedCandles.length;
        this.candles = validatedCandles.filter(c => !isLunchBreak(c.t, this.marketConfig));
        const skippedCount = beforeFilter - this.candles.length;

        if (skippedCount > 0) {
            console.log(`[SimulationWorker] ⏭️ Skipped ${skippedCount} lunch break candles (${this.marketConfig.lunchBreakStart}:00 - ${this.marketConfig.lunchBreakEnd}:00 ${this.marketConfig.timezone})`);
        }

        console.log(`[SimulationWorker] ✅ Processing ${this.candles.length} candles (sorted, filtered)`);

        // ✅ NEW: Calculate average volume for volume-based pacing
        this.averageVolume = calculateAverageVolume(this.candles);
        console.log(`[SimulationWorker] 📊 Average volume: ${this.averageVolume.toLocaleString()}`);

        // ✅ NEW: Calculate expected candle duration for timeframe verification
        if (this.candles.length >= 2) {
            const durations = [];
            for (let i = 0; i < Math.min(10, this.candles.length - 1); i++) {
                durations.push(this.candles[i + 1].t - this.candles[i].t);
            }
            this.expectedCandleDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
            console.log(`[SimulationWorker] ⏱️ Expected candle duration: ${(this.expectedCandleDuration / 1000).toFixed(0)}s`);
        }

        this.currentCandleIndex = 0;
        this.currentTickIndex = 0;

        if (this.candles.length > 0) {
            this.regeneratePaths();
            this.initializeAggregatedCandle(); // Initialize first candle

            // ✅ NO HISTORY_READY - History is managed by page.tsx via loadSimulationDay
            // Worker only handles simulation data (future candles)
            postMessage({ type: 'DATA_READY', totalCandles: this.candles.length, skippedLunchBreak: skippedCount });
        }
    }

    // UPDATED: play() with duplicate interval protection
    play(speed: number = 1) {
        if (this.candles.length === 0) {
            console.error('[SimulationWorker] No data loaded. Call INIT_DATA first.');
            postMessage({ type: 'ERROR', message: 'No data loaded' });
            return;
        }

        // ✅ FIX: Prevent duplicate intervals if already playing
        if (this.isPlaying && this.tickInterval !== null) {
            console.warn('[SimulationWorker] Already playing, ignoring duplicate play() call');
            return;
        }

        console.log(`[SimulationWorker] Playing at ${speed}x speed`);
        this.playbackSpeed = speed;
        this.isPlaying = true;

        // ✅ FIX: Always clean up before starting (safety measure)
        this.stopTickLoop();
        this.startTickLoop();

        // Notify frontend that playback has started
        postMessage({ type: 'PLAYBACK_STATE', isPlaying: true, speed: this.playbackSpeed });
    }

    pause() {
        console.log('[SimulationWorker] Paused');
        this.isPlaying = false;
        this.stopTickLoop();

        // ✅ FIX: Notify frontend immediately when paused
        postMessage({ type: 'PLAYBACK_STATE', isPlaying: false, speed: this.playbackSpeed });
    }

    stop() {
        console.log('[SimulationWorker] Stopped');
        this.isPlaying = false;
        this.stopTickLoop();
        this.currentCandleIndex = 0;
        this.currentTickIndex = 0;
    }

    seek(candleIndex: number) {
        console.log(`[SimulationWorker] Seeking to candle ${candleIndex}`);
        this.currentCandleIndex = Math.max(0, Math.min(candleIndex, this.candles.length - 1));
        this.currentTickIndex = 0;
        this.regeneratePaths();
    }

    setSpeed(speed: number) {
        console.log(`[SimulationWorker] Speed changed to ${speed}x`);
        this.playbackSpeed = speed;

        // ✅ FIX: Always stop first, then restart if playing (prevents race condition)
        this.stopTickLoop();

        if (this.isPlaying) {
            this.startTickLoop();
        }

        // Notify frontend of speed change
        postMessage({ type: 'PLAYBACK_STATE', isPlaying: this.isPlaying, speed: this.playbackSpeed });
    }

    private regeneratePaths() {
        const candle = this.candles[this.currentCandleIndex];
        if (!candle) return;

        this.pricePath = generatePricePath(candle, this.numTicks);
        this.volumePath = distributeVolume(candle.v, this.numTicks);

        // Reset aggregated candle for new candle
        this.initializeAggregatedCandle();
    }

    private initializeAggregatedCandle() {
        const candle = this.candles[this.currentCandleIndex];
        if (!candle) return;

        // Start with the open price
        this.currentAggregatedCandle = {
            time: Math.floor(candle.t / 1000), // Convert to seconds
            open: candle.o,
            high: candle.o,
            low: candle.o,
            close: candle.o,
        };
    }

    private updateAggregatedCandle(price: number, timestamp: number) {
        if (!this.currentAggregatedCandle) return;

        // ✅ FIX: Update timestamp to current tick's time (monotonically increasing!)
        // This ensures each CANDLE_UPDATE has a unique, increasing timestamp
        // Lightweight Charts silently ignores updates with duplicate timestamps
        this.currentAggregatedCandle.time = Math.floor(timestamp / 1000);

        // Update high/low/close as ticks come in
        this.currentAggregatedCandle.high = Math.max(this.currentAggregatedCandle.high, price);
        this.currentAggregatedCandle.low = Math.min(this.currentAggregatedCandle.low, price);
        this.currentAggregatedCandle.close = price;
    }

    private startTickLoop() {
        // ✅ REAL-TIME PLAYBACK MODE with VOLUME-BASED PACING
        // 1m candle at 1x speed = 60 seconds real-time
        // 5m candle at 1x speed = 300 seconds real-time
        // Speed multiplier: 10x makes 1m candle = 6 seconds
        // Volume modifier: high volume = faster ticks, low volume = slower ticks

        const candle = this.candles[this.currentCandleIndex];
        const nextCandle = this.candles[this.currentCandleIndex + 1];

        // Calculate actual candle duration from data
        const candleDuration = nextCandle
            ? (nextCandle.t - candle.t)
            : 60000; // Fallback to 1 minute

        // Calculate base tick duration for 1x speed
        const baseTickDuration = candleDuration / this.numTicks;

        // ✅ NEW: Volume-based dynamic pacing
        // High volume candles = faster ticks (more market activity)
        // Low volume candles = slower ticks (less activity)
        // Ratio clamped between 0.5x and 2x to prevent extreme speeds
        const volumeRatio = this.averageVolume > 0
            ? candle.v / this.averageVolume
            : 1;

        // Clamp between 0.5 (2x slower) and 2.0 (2x faster)
        const volumeModifier = Math.max(0.5, Math.min(2.0, volumeRatio));

        // Apply speed + volume modifiers
        // Higher volumeModifier = faster ticks, so we DIVIDE by it
        const tickDuration = baseTickDuration / (this.playbackSpeed * volumeModifier);

        // Ensure minimum tick duration (prevent CPU overload)
        const MIN_TICK_DURATION = 10; // 10ms minimum
        const finalTickDuration = Math.max(MIN_TICK_DURATION, tickDuration);

        console.log(`[SimulationWorker] ⏱️ Real-time mode: ${finalTickDuration.toFixed(1)}ms per tick (speed: ${this.playbackSpeed}x, volume: ${volumeModifier.toFixed(2)}x, candle: ${candleDuration}ms)`);

        this.tickInterval = setInterval(() => {
            this.processTick();
        }, finalTickDuration) as any;
    }

    private stopTickLoop() {
        if (this.tickInterval !== null) {
            clearInterval(this.tickInterval);
            this.tickInterval = null;
        }
    }

    private processTick() {
        const candle = this.candles[this.currentCandleIndex];
        if (!candle) {
            this.stop();
            return;
        }

        // Get current tick data
        const price = this.pricePath[this.currentTickIndex];
        const volume = this.volumePath[this.currentTickIndex];

        // ✅ FIX: Calculate ACTUAL candle duration from data (not hardcoded 60s)
        const nextCandle = this.candles[this.currentCandleIndex + 1];
        const candleDuration = nextCandle
            ? (nextCandle.t - candle.t) // Actual duration between candles
            : 60000; // Fallback to 1 minute if last candle

        const tickProgress = this.currentTickIndex / this.numTicks;
        const timestamp = candle.t + (tickProgress * candleDuration);

        // ✅ NEW: Timeframe verification - check for anomalies
        if (this.currentTickIndex === 0 && this.currentCandleIndex > 0) {
            const prevCandle = this.candles[this.currentCandleIndex - 1];
            const actualDuration = candle.t - prevCandle.t;
            const expectedDuration = this.expectedCandleDuration;

            // Allow 10% tolerance for timeframe drift
            const tolerance = expectedDuration * 0.1;
            if (Math.abs(actualDuration - expectedDuration) > tolerance) {
                console.warn(
                    `[SimulationWorker] ⚠️ Timeframe anomaly detected at candle ${this.currentCandleIndex}: ` +
                    `expected ${(expectedDuration / 1000).toFixed(0)}s, got ${(actualDuration / 1000).toFixed(0)}s`
                );
            }
        }

        // Create tick data
        const tick: TickData = {
            price,
            volume,
            timestamp: Math.floor(timestamp),
            candleIndex: this.currentCandleIndex,
            tickIndex: this.currentTickIndex,
        };

        // Update aggregated candle with current tick's price AND timestamp
        this.updateAggregatedCandle(price, timestamp);

        // ✅ FIX: Sync candle updates with tick tempo (speed-independent)
        const isFirstTick = this.currentTickIndex === 0;
        const isLastTick = this.currentTickIndex >= this.numTicks - 1;

        // TICK throttling (for orderbook/tape - keep 60 FPS limit)
        const now = Date.now();
        const timeSinceLastTick = now - this.lastMessageTime;
        const shouldSendTick =
            timeSinceLastTick >= this.MESSAGE_THROTTLE_MS ||
            isFirstTick ||
            isLastTick;

        if (shouldSendTick) {
            postMessage({ type: 'TICK', data: tick });
            this.lastMessageTime = now;
        }

        // ✅ CANDLE UPDATE: Send on every tick (no extra throttling needed!)
        // Ticks are already rate-limited (1/second at 1x), so no need for time-based throttle
        // This ensures chart never freezes while orderbook updates

        const shouldSendCandleUpdate =
            isFirstTick ||  // Always send on candle open
            isLastTick ||   // Always send on candle close  
            true;           // Send on EVERY tick for smooth growth

        if (shouldSendCandleUpdate && this.currentAggregatedCandle) {
            postMessage({
                type: 'CANDLE_UPDATE',
                candle: this.currentAggregatedCandle
            });
        }

        // Advance tick
        this.currentTickIndex++;

        // Check if candle is complete
        if (this.currentTickIndex >= this.numTicks) {
            this.currentTickIndex = 0;
            this.currentCandleIndex++;

            // Check if simulation is complete
            if (this.currentCandleIndex >= this.candles.length) {
                console.log('[SimulationWorker] Simulation complete');
                postMessage({ type: 'COMPLETE' });
                this.stop();
                return;
            }

            // Generate paths for next candle
            this.regeneratePaths();

            // ✅ NEW: Restart tick loop to apply new volume-based pacing
            // Each candle has different volume, so tick interval should change
            this.stopTickLoop();
            this.startTickLoop();

            postMessage({ type: 'CANDLE_CHANGE', candleIndex: this.currentCandleIndex });
        }
    }
}

// ============================================================================
// Worker Message Handler
// ============================================================================

const engine = new SimulationEngine();

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
    const { type, candles, speed, index, indicator } = event.data;

    switch (type) {
        case 'INIT_DATA':
            if (candles) {
                engine.initData(candles);
            }
            break;

        case 'PLAY':
            engine.play(speed ?? 1);
            break;

        case 'PAUSE':
            engine.pause();
            break;

        case 'STOP':
            engine.stop();
            break;

        case 'SET_SPEED':
            if (speed !== undefined) {
                engine.setSpeed(speed);
            }
            break;

        case 'SEEK':
            if (index !== undefined) {
                engine.seek(index);
            }
            break;

        case 'CALCULATE_INDICATOR':
            if (candles && indicator) {
                console.log(`[SimulationWorker] Calculating indicator: ${indicator.name}`);
                const data = calculateIndicator(candles, indicator);
                postMessage({
                    type: 'INDICATOR_READY',
                    indicator: indicator.name,
                    data
                });
            } else {
                console.error('[SimulationWorker] CALCULATE_INDICATOR missing candles or indicator config');
            }
            break;

        default:
            console.warn('[SimulationWorker] Unknown message type:', type);
    }
};

// Ready signal
postMessage({ type: 'READY' });
console.log('[SimulationWorker] Worker ready');
