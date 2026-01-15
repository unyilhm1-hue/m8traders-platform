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
    private numTicks: number = 20; // ticks per candle
    private baseTickDuration: number = 100; // ms per tick at 1x speed

    // Aggregated candle (for Lightweight Charts)
    private currentAggregatedCandle: {
        time: number;
        open: number;
        high: number;
        low: number;
        close: number;
    } | null = null;

    constructor() {
        console.log('[SimulationWorker] Engine initialized');
    }

    // NEW: Initialize with data from main thread
    initData(candles: Candle[]) {
        console.log(`[SimulationWorker] Data initialized: ${candles.length} candles`);

        // PRE-PROCESS DATA DI WORKER
        // Pastikan candle.t dikonversi ke millisecond number yang valid SEBELUM masuk logic simulasi
        this.candles = candles.map(c => {
            let timestamp: number;

            if (typeof c.t === 'number') {
                // --- PERBAIKAN DI SINI ---
                // Cek apakah angka ini Detik atau Ms?
                // Angka 10.000.000.000 (10 Miliar) adalah batas aman tahun 2286.
                // Jika < 10 Miliar, berarti pasti Detik -> Kali 1000 biar jadi MS.
                timestamp = c.t < 10000000000 ? c.t * 1000 : c.t;
            } else if (c.t instanceof Date) {
                timestamp = c.t.getTime();
            } else if (typeof c.t === 'string') {
                timestamp = new Date(c.t).getTime();
            } else {
                // Fallback: use current time
                console.error('[SimulationWorker] Invalid timestamp type:', typeof c.t);
                timestamp = Date.now();
            }

            return {
                ...c,
                t: timestamp // SEKARANG PASTI MILLISECONDS
            };
        });

        this.currentCandleIndex = 0;
        this.currentTickIndex = 0;

        if (this.candles.length > 0) {
            this.regeneratePaths();
            this.initializeAggregatedCandle(); // Initialize first candle

            // Emit HISTORY_READY with all historical candles
            postMessage({
                type: 'HISTORY_READY',
                candles: this.candles, // Full array for chart initialization
                totalCandles: candles.length
            });

            postMessage({ type: 'DATA_READY', totalCandles: candles.length });
        }
    }

    // UPDATED: play() now assumes data already loaded
    play(speed: number = 1) {
        if (this.candles.length === 0) {
            console.error('[SimulationWorker] No data loaded. Call INIT_DATA first.');
            postMessage({ type: 'ERROR', message: 'No data loaded' });
            return;
        }

        console.log(`[SimulationWorker] Playing at ${speed}x speed`);
        this.playbackSpeed = speed;
        this.isPlaying = true;
        this.startTickLoop();
    }

    pause() {
        console.log('[SimulationWorker] Paused');
        this.isPlaying = false;
        this.stopTickLoop();
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

        // Restart interval with new speed if playing
        if (this.isPlaying) {
            this.stopTickLoop();
            this.startTickLoop();
        }
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

    private updateAggregatedCandle(price: number) {
        if (!this.currentAggregatedCandle) return;

        // Update high/low/close as ticks come in
        this.currentAggregatedCandle.high = Math.max(this.currentAggregatedCandle.high, price);
        this.currentAggregatedCandle.low = Math.min(this.currentAggregatedCandle.low, price);
        this.currentAggregatedCandle.close = price;
    }

    private startTickLoop() {
        const tickDuration = this.baseTickDuration / this.playbackSpeed;

        this.tickInterval = setInterval(() => {
            this.processTick();
        }, tickDuration) as any;
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

        // Calculate tick timestamp (interpolate within candle duration)
        // Assuming 1min candles = 60000ms
        const candleDuration = 60000; // 1 minute in ms
        const tickProgress = this.currentTickIndex / this.numTicks;
        const timestamp = candle.t + (tickProgress * candleDuration);

        // Create tick data
        const tick: TickData = {
            price,
            volume,
            timestamp: Math.floor(timestamp),
            candleIndex: this.currentCandleIndex,
            tickIndex: this.currentTickIndex,
        };

        // Update aggregated candle
        this.updateAggregatedCandle(price);

        // Send tick to main thread
        postMessage({ type: 'TICK', data: tick });

        // Send aggregated candle update (for Lightweight Charts)
        if (this.currentAggregatedCandle) {
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
