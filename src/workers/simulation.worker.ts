/**
 * Worker B: Physics Engine
 * Responsible for Game Loop, Tick Generation, and Broadcasting.
 * Uses 'simulation.worker-helper.ts' for core math.
 */

import {
    Candle,
    EnrichedCandle,
    MarketContext,
    SeededRandom,
    SyntheticTickGenerator,
    calculateTickDensity,
    getIDXTickSize,
    roundToIDXTickSize,
    analyzeCandle, // Still imported if fallback needed, but prefer pre-calc
    TickData
} from './simulation.worker-helper';

// --- Type Definitions ---
// Minimizing local types, relying on Helper where possible

interface WorkerMessage {
    type: 'INIT_DATA' | 'PLAY' | 'PAUSE' | 'STOP' | 'SET_SPEED' | 'SEEK' | 'CALCULATE_INDICATOR';
    // Smart buffers (Data from Worker A)
    historyBuffer?: EnrichedCandle[];
    simulationQueue?: EnrichedCandle[];
    interval?: string;

    // Playback params
    speed?: number;
    index?: number;
    indicator?: any;

    // Legacy support (optional, minimal maintenance)
    candles?: Candle[];
}

interface TickSchedule {
    tickIndex: number;
    targetTime: number; // ms from candle start
    price: number;
    volume: number;
}

// Indicator Helpers (Legacy)
function calculateVolume(candles: Candle[]) {
    return candles.map(c => ({ time: c.t / 1000, value: c.v, color: c.c >= c.o ? '#26a69a' : '#ef5350' }));
}
// Stub other indicators for now or import from a utils file if needed.
// For this refactor, I'll keep them minimal or TODO to avoid file bloat.
// The user prompt focuses on Architecture.

// ============================================================================
// ENGINE CLASS
// ============================================================================

class SimulationEngine {
    private candles: EnrichedCandle[] = [];
    private historyBuffer: EnrichedCandle[] = [];
    private currentCandleIndex: number = 0;

    private isPlaying: boolean = false;
    private playbackSpeed: number = 1;

    // Tick Loop
    private tickIntervalHandle: any = null;
    private tickSchedule: TickSchedule[] = [];
    private currentTickIndex: number = 0;
    private candleStartTime: number = 0;
    private lastLoopTime: number = 0;

    // Aggregation
    private currentAggregatedCandle: any = null;
    private currentIntervalStr: string = '1m';
    private lastCandleUpdateTime: number = 0;

    // Metrics
    private averageVolume: number = 1;

    constructor() {
        console.log('[PhysicsWorker] 🚀 Engine Initialized (v2.0 Factory Model)');
        postMessage({ type: 'READY' });
    }

    /**
     * INIT: Receives Clean Data from Main Thread (courtesy of Worker A)
     */
    init(history: EnrichedCandle[], simulation: EnrichedCandle[], interval: string) {
        this.historyBuffer = history;
        this.candles = simulation;
        this.currentIntervalStr = interval;

        console.log(`[PhysicsWorker] 📥 Received ${history.length} History + ${simulation.length} Sim Candles`);

        if (this.candles.length === 0) {
            console.warn('[PhysicsWorker] ⚠️ No simulation candles to play!');
            return;
        }

        // Calculate avg volume for density algo
        const refBuffer = history.length > 0 ? history : simulation;
        const totalVol = refBuffer.reduce((sum, c) => sum + c.v, 0);
        this.averageVolume = totalVol / refBuffer.length || 1;

        this.currentCandleIndex = 0;
        this.currentTickIndex = 0;

        this.initializeAggregatedCandle();

        postMessage({
            type: 'DATA_READY',
            totalCandles: this.candles.length
        });
    }

    play(speed: number) {
        if (this.isPlaying) return;
        this.playbackSpeed = speed;
        this.isPlaying = true;
        this.lastLoopTime = performance.now();
        this.startTickLoop();
        postMessage({ type: 'PLAYBACK_STATE', isPlaying: true, speed });
    }

    pause() {
        this.isPlaying = false;
        this.stopTickLoop();
        postMessage({ type: 'PLAYBACK_STATE', isPlaying: false, speed: this.playbackSpeed });
    }

    stop() {
        this.pause();
        this.currentCandleIndex = 0;
        this.currentTickIndex = 0;
        this.initializeAggregatedCandle();
    }

    setSpeed(speed: number) {
        this.playbackSpeed = speed;
        console.log(`[PhysicsWorker] ⚡ Speed changed to ${speed}x`);
        // Note: Speed affects elapsedSim calculation in poll()
        // Candle completion timing will adjust automatically
    }

    seek(index: number) {
        this.currentCandleIndex = Math.max(0, Math.min(index, this.candles.length - 1));
        this.currentTickIndex = 0;
        this.initializeAggregatedCandle();
        // Notify change
        postMessage({ type: 'CANDLE_CHANGE', candleIndex: this.currentCandleIndex });
    }

    // ------------------------------------------------------------------------
    // CORE LOGIC
    // ------------------------------------------------------------------------

    private startTickLoop() {
        if (!this.candles[this.currentCandleIndex]) return;
        this.stopTickLoop();

        const candle = this.candles[this.currentCandleIndex];
        const nextCandle = this.candles[this.currentCandleIndex + 1];

        // 1. Duration Logic (Dynamic)
        const durationMs = nextCandle ? (nextCandle.t - candle.t) : 60000;
        // Clamp logic (simplified)
        const clampedDuration = Math.min(durationMs, 5 * 60 * 1000); // Max 5m wait even if gap

        // 2. Context & Density
        // Use Pre-calculated Pattern!
        const patternInfo = {
            pattern: candle.pattern,
            isBullish: candle.isBullish,
            bodyRatio: candle.bodyRatio,
            upperWickRatio: candle.upperWickRatio,
            lowerWickRatio: candle.lowerWickRatio
        };

        const context: MarketContext = {
            currentPattern: candle.pattern,
            patternBullish: candle.isBullish,
            sessionProgress: 0.5,
            volumeVsAverage: candle.v / this.averageVolume,
            trend: 'sideways', // Simplified for V2
            trendStrength: 50,
            volatility: 'medium',
            isFlowAligned: true,
            noiseLevel: 0.2
        };

        const tickCount = calculateTickDensity(
            clampedDuration,
            candle.v,
            this.averageVolume,
            'medium',
            this.playbackSpeed
        );

        // 3. Generation (Delegated to Helper)
        const engine = new SyntheticTickGenerator(candle.t);
        const ticks = engine.generateTicks(candle, tickCount, patternInfo, context);
        const heartbeat = engine.generateHeartbeat(tickCount, clampedDuration);

        // Map to TickSchedule
        this.tickSchedule = ticks.map((t, i) => ({
            tickIndex: i,
            targetTime: heartbeat[i],
            price: t.price,
            volume: t.volume
        }));

        this.currentTickIndex = 0;
        this.candleStartTime = performance.now();

        // 4. Start Polling
        this.tickIntervalHandle = setInterval(() => this.poll(), 16);
    }

    private stopTickLoop() {
        if (this.tickIntervalHandle) clearInterval(this.tickIntervalHandle);
        this.tickIntervalHandle = null;
    }

    private poll() {
        if (!this.isPlaying) return;

        const now = performance.now();
        const elapsedReal = now - this.candleStartTime;
        const elapsedSim = elapsedReal * this.playbackSpeed;

        // Fire eligible ticks
        while (this.currentTickIndex < this.tickSchedule.length) {
            const tick = this.tickSchedule[this.currentTickIndex];
            if (tick.targetTime > elapsedSim) break; // Not time yet

            this.fireTick(tick, now); // Pass 'now' for precise timestamping? 
            // Actually fireTick uses candle.t + offset usually.

            this.currentTickIndex++;
        }

        // Candle Complete?
        if (this.currentTickIndex >= this.tickSchedule.length) {
            this.advanceCandle();
        }

        // Continuous Updates (Throttle)
        if (now - this.lastCandleUpdateTime > 100) {
            this.broadcastCandleUpdate('continuous');
            this.lastCandleUpdateTime = now;
        }
    }

    private fireTick(tick: TickSchedule, now: number) {
        const candle = this.candles[this.currentCandleIndex];
        const timestamp = candle.t + tick.targetTime;

        this.updateAggregatedCandle(tick.price);

        postMessage({
            type: 'TICK',
            data: {
                price: tick.price,
                volume: tick.volume,
                timestamp: Math.floor(timestamp),
                candleIndex: this.currentCandleIndex,
                tickIndex: tick.tickIndex
            }
        });
    }

    private advanceCandle() {
        this.currentCandleIndex++;
        if (this.currentCandleIndex >= this.candles.length) {
            this.pause();
            postMessage({ type: 'COMPLETE' });
            return;
        }

        // Prepare next
        this.initializeAggregatedCandle();
        this.startTickLoop();
        postMessage({ type: 'CANDLE_CHANGE', candleIndex: this.currentCandleIndex });
    }

    // --- Aggregation Logic (Simplified) ---

    private initializeAggregatedCandle() {
        const candle = this.candles[this.currentCandleIndex];

        // 🔥 DEFENSIVE GUARD: Ensure candle and timestamp exist
        if (!candle || typeof candle.t !== 'number') {
            console.error(`[PhysicsWorker] ❌ Failed to init aggregated candle: Index=${this.currentCandleIndex}, Candle=${!!candle}`);
            this.currentAggregatedCandle = null;
            return;
        }

        // Simple overwrite for now, complex bucketing logic can be re-added if strictly needed
        // For simplicity in V2 refactor, we start with the atomic candle's open

        this.currentAggregatedCandle = {
            time: Math.floor(candle.t / 1000), // Seconds for chart
            open: candle.o,
            high: candle.o,
            low: candle.o,
            close: candle.o
        };
    }

    private updateAggregatedCandle(price: number) {
        if (!this.currentAggregatedCandle) return;
        this.currentAggregatedCandle.high = Math.max(this.currentAggregatedCandle.high, price);
        this.currentAggregatedCandle.low = Math.min(this.currentAggregatedCandle.low, price);
        this.currentAggregatedCandle.close = price;
    }

    private broadcastCandleUpdate(source: string) {
        // 🔥 DEFENSIVE: Don't broadcast if aggregated candle is not initialized
        if (!this.currentAggregatedCandle) {
            console.warn('[PhysicsWorker] ⚠️ Attempted to broadcast null candle, skipping');
            return;
        }

        // 🔥 DEFENSIVE: Validate timestamp exists
        if (this.currentAggregatedCandle.time === undefined || this.currentAggregatedCandle.time === null) {
            console.error('[PhysicsWorker] ❌ Invalid candle timestamp:', this.currentAggregatedCandle);
            return;
        }

        postMessage({
            type: 'CANDLE_UPDATE',
            candle: this.currentAggregatedCandle,
            source
        });
    }
}

// ============================================================================
// MESSAGE HANDLER
// ============================================================================

const engine = new SimulationEngine();

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
    const { type } = event.data;

    switch (type) {
        case 'INIT_DATA':
            if (event.data.historyBuffer && event.data.simulationQueue) {
                engine.init(
                    event.data.historyBuffer,
                    event.data.simulationQueue,
                    event.data.interval || '1m'
                );
            } else {
                console.error('[PhysicsWorker] Invalid INIT_DATA payload');
            }
            break;
        case 'PLAY':
            engine.play(event.data.speed || 1);
            break;
        case 'PAUSE':
            engine.pause();
            break;
        case 'STOP':
            engine.stop();
            break;
        case 'SET_SPEED':
            if (event.data.speed) engine.setSpeed(event.data.speed);
            break;
        case 'SEEK':
            if (event.data.index !== undefined) engine.seek(event.data.index);
            break;
    }
};
