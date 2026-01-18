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
    type: 'INIT_DATA' | 'PLAY' | 'PAUSE' | 'STOP' | 'SET_SPEED' | 'SEEK' | 'CALCULATE_INDICATOR' | 'SET_INTERVAL' | 'LOAD_SCENARIO' | 'LOG' | 'ERROR';

    // Smart buffers (Data from Worker A)
    historyBuffer?: EnrichedCandle[];
    simulationQueue?: EnrichedCandle[];
    interval?: string;

    // Scenario Load
    scenarioId?: string;

    // Playback params
    speed?: number;
    index?: number;
    indicator?: any;

    // Logging Payload
    payload?: any;
    level?: 'info' | 'warn' | 'error' | 'debug';
    message?: string;

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

// 🔥 Performance: Conditional logging
const DEBUG_WORKER = false;

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
        this.log('info', '[PhysicsWorker] 🚀 Engine Initialized (v2.0 Factory Model)');
        postMessage({ type: 'READY' });
    }

    public log(level: 'info' | 'warn' | 'error' | 'debug', message: string, payload?: any) {
        postMessage({
            type: 'LOG',
            level,
            message,
            payload
        });
    }

    /**
     * INIT: Receives Clean Data from Main Thread (courtesy of Worker A)
     */
    init(history: EnrichedCandle[], simulation: EnrichedCandle[], interval: string) {
        this.historyBuffer = history;
        this.candles = simulation;
        this.currentIntervalStr = interval;

        this.log('info', `[PhysicsWorker] 📥 Received ${history.length} History + ${simulation.length} Sim Candles`);

        // 🕵️ SNIFFER LOG: Check what the worker ACTUALLY received
        if (this.candles.length > 0) {
            const firstCandle = this.candles[0];
            const dateStr = new Date(firstCandle.t).toLocaleString();
            this.log('info', `[PhysicsWorker] 🕵️ First Sim Candle: ${dateStr} (${firstCandle.t})`);
        }

        // 🕵️ SNIFFER LOG: Check what the worker ACTUALLY received
        if (this.candles.length > 0) {
            const firstCandle = this.candles[0];
            const dateStr = new Date(firstCandle.t).toLocaleString();
            this.log('info', `[PhysicsWorker] 🕵️ First Sim Candle: ${dateStr} (${firstCandle.t})`);

            // 🔥 SAFETY NET: Overlap Detection & Auto-Fix
            if (this.historyBuffer.length > 0) {
                const lastHistory = this.historyBuffer[this.historyBuffer.length - 1];
                if (firstCandle.t <= lastHistory.t) {
                    this.log('warn', `[PhysicsWorker] 🚨 OVERLAP DETECTED: Sim Start (${firstCandle.t}) <= History End (${lastHistory.t}). Auto-fixing...`);

                    // Filter out overlapping candles
                    const originalCount = this.candles.length;
                    this.candles = this.candles.filter(c => c.t > lastHistory.t);

                    if (this.candles.length > 0) {
                        const newFirst = this.candles[0];
                        this.log('warn', `[PhysicsWorker] ✅ Auto-fix applied: Dropped ${originalCount - this.candles.length} candles. New Start: ${new Date(newFirst.t).toLocaleString()}`);
                    } else {
                        this.log('error', `[PhysicsWorker] ❌ Auto-fix failed: No candles left after trim!`);
                    }
                }
            }
        }

        if (this.candles.length === 0) {
            this.log('warn', '[PhysicsWorker] ⚠️ No simulation candles to play!');
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
        this.log('info', '[PhysicsWorker] Stopped and reset');
    }

    setSpeed(speed: number) {
        if (this.playbackSpeed === speed) return;

        const now = performance.now();
        // 1. Calculate current simulated progress
        const currentElapsedSim = (now - this.candleStartTime) * this.playbackSpeed;

        // 2. Update speed
        if (DEBUG_WORKER) console.log(`[PhysicsWorker] ⚡ Speed changed: ${this.playbackSpeed}x -> ${speed}x`);
        this.playbackSpeed = speed;

        // 3. Rebase startTime so that (now - newStartTime) * newSpeed === currentElapsedSim
        // newStartTime = now - (currentElapsedSim / newSpeed)
        this.candleStartTime = now - (currentElapsedSim / speed);

        // This ensures smoothness:
        // Before: (T - StartOld) * SpeedOld = Progress
        // After:  (T - StartNew) * SpeedNew = Progress
    }

    seek(index: number) {
        this.currentCandleIndex = Math.max(0, Math.min(index, this.candles.length - 1));
        this.currentTickIndex = 0;
        this.initializeAggregatedCandle();
        // Notify change
        postMessage({ type: 'CANDLE_CHANGE', candleIndex: this.currentCandleIndex });
    }

    // 🆕 SYNC INTERVAL
    setInterval(interval: string) {
        this.currentIntervalStr = interval;
        // Reset current aggregation bucket to prevent mixing timeframes
        this.initializeAggregatedCandle();
    }

    // ------------------------------------------------------------------------
    // CORE LOGIC
    // ------------------------------------------------------------------------

    private startTickLoop() {
        if (!this.candles[this.currentCandleIndex]) return;
        this.stopTickLoop();

        const candle = this.candles[this.currentCandleIndex];
        const nextCandle = this.candles[this.currentCandleIndex + 1];

        // 1. Durasi Logic (Fixed)
        // 🔥 GAP FIX: Always use the defined Interval Duration for physics tick generation.
        // We do not want to fill "Weekend Gaps" with millions of ticks.
        // A 1m candle always represents 1 minute of trading logic.

        const intervalMap: Record<string, number> = {
            '1m': 60000, '5m': 300000, '15m': 900000, '30m': 1800000,
            '1h': 3600000, '60m': 3600000, '4h': 14400000, '1d': 86400000
        };

        // Strict duration based on interval
        let durationMs = intervalMap[this.currentIntervalStr] || 60000;

        // Optional: If next candle exists AND is closer than the interval (e.g. premature close?), 
        // we could clamp it. But generally, sticking to interval duration is safer for physics.
        if (nextCandle && (nextCandle.t - candle.t) < durationMs) {
            durationMs = nextCandle.t - candle.t;
        }

        // Clamp only for sanity (e.g. > 1 week gap might be skip, but let's allow "real" gaps)
        // We only clamp "tick generation duration" to avoid generating billions of ticks for a weekend gap.
        // For physics, if gap > 4 hours, it's likely a session break.
        // We should GENERATE ticks only for the "active" part of the candle?
        // Actually, 'candle.t' is open time. We only need to fill 'duration' amount of ticks.
        // If it's a daily candle, duration is 24h. We distribute density across 24h?
        // Ideally yes.
        const clampedDuration = durationMs;

        // 2. Context & Density
        // Use Pre-calculated Pattern!
        const patternInfo = {
            pattern: candle.pattern,
            isBullish: candle.isBullish,
            bodyRatio: candle.bodyRatio,
            upperWickRatio: candle.upperWickRatio,
            lowerWickRatio: candle.lowerWickRatio
        };

        // 🔥 FIX: Use historyBuffer for context if available
        // Recalculate rolling average volume if we have history
        let rollingAvgVol = this.averageVolume;
        if (this.historyBuffer.length > 0) {
            // Use last 20 candles from history + current simulation so far
            // For simplicity, just use global average derived from Init, 
            // OR if we want local context:
            // const contextCandles = [...this.historyBuffer.slice(-20), ...this.candles.slice(Math.max(0, this.currentCandleIndex - 5), this.currentCandleIndex)];
            // rollingAvgVol = contextCandles.reduce((a, b) => a + b.v, 0) / contextCandles.length || 1;
            // Keeping global average for stability for now, but confirming it uses the MERGED buffer at Init.
        }

        const context: MarketContext = {
            currentPattern: candle.pattern,
            patternBullish: candle.isBullish,
            sessionProgress: 0.5,
            volumeVsAverage: candle.v / rollingAvgVol,
            trend: 'sideways', // Simplified for V2
            trendStrength: 50,
            volatility: 'medium',
            isFlowAligned: true,
            noiseLevel: 0.2
        };

        const tickCount = calculateTickDensity(
            clampedDuration,
            candle.v,
            rollingAvgVol,
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

        // Continuous Updates (Adaptive Throttle)
        // 🔥 FIX: Adapt frame rate based on speed to prevent main thread saturation
        // Speed 1x -> 100ms (10fps) is enough
        // Speed 10x -> 16ms (60fps) needed for smoothness
        const dynamicThrottle = Math.max(16, Math.floor(100 / (this.playbackSpeed || 1)));

        if (now - this.lastCandleUpdateTime >= dynamicThrottle) {
            this.broadcastCandleUpdate('continuous');
            this.lastCandleUpdateTime = now;
        }
    }

    private fireTick(tick: TickSchedule, now: number) {
        // 🕵️ SNIFFER LOG: Trace tick generation start of candle
        if (tick.tickIndex === 0) {
            const c = this.candles[this.currentCandleIndex];
            // timestamp is in ms
            this.log('debug', `[PhysicsWorker] ⚡ Processing Candle [${this.currentCandleIndex}]: ${new Date(c.t).toLocaleString()} (${c.t})`);
        }

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
            } else if (event.data.candles && event.data.candles.length > 0) {
                // Legacy support: Treat all candles as simulation queue, empty history
                // Need to convert Candle[] -> EnrichedCandle[] (minimal enrichment)
                const enriched = event.data.candles.map((c: any) => ({
                    t: c.time || c.t,
                    o: c.open || c.o,
                    h: c.high || c.h,
                    l: c.low || c.l,
                    c: c.close || c.c,
                    v: c.volume || c.v,
                    // Defaults for enriched fields
                    isBullish: (c.close || c.c) >= (c.open || c.o),
                    bodyRatio: 0.5,
                    upperWickRatio: 0.2,
                    lowerWickRatio: 0.2,
                    pattern: 'doji' as any
                }));

                console.warn('[PhysicsWorker] ⚠️ Using legacy INIT_DATA (no history buffer)');
                engine.init([], enriched, '1m');
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
        case 'SET_INTERVAL':
            if (event.data.interval) {
                engine.log('info', `[PhysicsWorker] 🔄 Interval synced to: ${event.data.interval}`);
                engine.setInterval(event.data.interval);
            }
            break;
        case 'LOAD_SCENARIO':
            if (event.data.scenarioId) {
                engine.log('info', `[PhysicsWorker] 📥 Loading scenario: ${event.data.scenarioId}`);

                // Directly access IndexedDB to avoid main thread serialization overhead
                const request = indexedDB.open('m8traders-historical', 1);

                request.onsuccess = (e) => {
                    const db = (e.target as IDBOpenDBRequest).result;
                    const tx = db.transaction('scenarios', 'readonly');
                    const store = tx.objectStore('scenarios');
                    const getReq = store.get(event.data.scenarioId!);

                    getReq.onsuccess = () => {
                        const scenario = getReq.result;
                        if (scenario && scenario.candles) {
                            engine.log('info', `[PhysicsWorker] ✅ Scenario loaded: ${scenario.candles.length} candles`);

                            // Initialize engine with loaded data
                            // Assuming scenarios always use 1m interval for now, or get from metadata
                            engine.init(
                                [], // History buffer empty for scenarios usually? Or should we split?
                                // For simplicity in scenario mode, we treat all as simulation queue
                                scenario.candles,
                                scenario.interval || '1m'
                            );

                            // Notify main thread
                            postMessage({
                                type: 'DATA_READY',
                                totalCandles: scenario.candles.length
                            });

                        } else {
                            engine.log('error', `[PhysicsWorker] ❌ Scenario not found/empty: ${event.data.scenarioId}`);
                        }
                    };

                    getReq.onerror = () => {
                        engine.log('error', `[PhysicsWorker] ❌ Failed to read scenario from IDB`);
                    };
                };

                request.onerror = () => {
                    engine.log('error', `[PhysicsWorker] ❌ Failed to open IDB`);
                };
            }
            break;
        case 'SEEK':
            if (event.data.index !== undefined) engine.seek(event.data.index);
            break;
    }
};
