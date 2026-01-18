/**
 * Simulation Worker Helper
 * Shared logic library for dual-worker architecture.
 * Contains: Types, RNG, and Physics Engine Core.
 */

// ============================================================================
// 1. SHARED INTERFACES (The Common Language)
// ============================================================================

export interface Candle {
    t: number; // timestamp in ms
    o: number; // open
    h: number; // high
    l: number; // low
    c: number; // close
    v: number; // volume
}

export type CandlePattern = 'hammer' | 'shootingStar' | 'marubozu' | 'doji' | 'neutral';

/**
 * 🔥 ENRICHED CANDLE to be used by both Worker A (Writer) and Worker B (Reader)
 * Includes pre-calculated analysis to save runtime cycles.
 */
export interface EnrichedCandle extends Candle {
    pattern: CandlePattern;
    isBullish: boolean;
    bodyRatio: number;
    upperWickRatio: number;
    lowerWickRatio: number;
}

export interface TickData {
    price: number;
    volume: number;
    timestamp: number;
    candleIndex: number;
    tickIndex: number;
}

export interface MarketContext {
    currentPattern: CandlePattern;
    patternBullish: boolean;
    sessionProgress: number;
    volumeVsAverage: number;
    trend: 'bullish' | 'bearish' | 'sideways';
    trendStrength: number;
    volatility: 'low' | 'medium' | 'high';
    isFlowAligned: boolean;
    noiseLevel: number;
    useGBM?: boolean;
    gbmDrift?: number;
    gbmVolatility?: number;
}


// ============================================================================
// 2. UTILITIES & STATIC ANALYSIS
// ============================================================================

export function getIDXTickSize(price: number): number {
    if (price < 200) return 1;
    if (price < 500) return 2;
    if (price < 2000) return 5;
    if (price < 5000) return 10;
    return 25;
}

export function roundToIDXTickSize(price: number): number {
    const tickSize = getIDXTickSize(price);
    return Math.round(price / tickSize) * tickSize;
}

/**
 * Static Pattern Analysis (Moved from Worker B to here)
 * Worker A runs this once per candle.
 */
export function analyzeCandle(candle: Candle): {
    pattern: CandlePattern;
    isBullish: boolean;
    bodyRatio: number;
    upperWickRatio: number;
    lowerWickRatio: number;
} {
    const range = candle.h - candle.l;

    if (range === 0) {
        return {
            pattern: 'neutral',
            isBullish: candle.c >= candle.o,
            bodyRatio: 0,
            upperWickRatio: 0,
            lowerWickRatio: 0
        };
    }

    const bodySize = Math.abs(candle.c - candle.o);
    const bodyRatio = bodySize / range;
    const isBullish = candle.c > candle.o;

    const upperWick = candle.h - Math.max(candle.o, candle.c);
    const lowerWick = Math.min(candle.o, candle.c) - candle.l;
    const upperWickRatio = upperWick / range;
    const lowerWickRatio = lowerWick / range;

    let pattern: CandlePattern = 'neutral';

    // Strict pattern detection
    if (lowerWickRatio > 0.6 && bodyRatio < 0.3) pattern = 'hammer';
    else if (upperWickRatio > 0.6 && bodyRatio < 0.3) pattern = 'shootingStar';
    else if ((upperWickRatio + lowerWickRatio) < 0.1 && bodyRatio > 0.8) pattern = 'marubozu';
    else if (bodyRatio < 0.05) pattern = 'doji';

    return { pattern, isBullish, bodyRatio, upperWickRatio, lowerWickRatio };
}

/**
 * Calculate adaptive tick density
 */
export function calculateTickDensity(
    durationMs: number,
    volume: number,
    averageVolume: number,
    volatility: 'low' | 'medium' | 'high',
    playbackSpeed: number = 1
): number {
    const BASE_DENSITY = 240; // ticks per minute

    // Safety: Prevent NaN propagation
    if (isNaN(durationMs) || durationMs <= 0) durationMs = 60000;
    if (isNaN(volume) || volume < 0) volume = 0;
    if (isNaN(averageVolume) || averageVolume <= 0) averageVolume = 1;
    if (isNaN(playbackSpeed) || playbackSpeed <= 0) playbackSpeed = 1;

    // Scale by duration
    const durationMinutes = durationMs / 60000;
    let tickCount = BASE_DENSITY * durationMinutes;

    // Scale by volatility
    const volatilityMultipliers = { low: 0.7, medium: 1.0, high: 1.5 };
    tickCount *= volatilityMultipliers[volatility];

    // Scale by volume
    if (averageVolume > 0) {
        const volumeRatio = volume / averageVolume;
        // Cap ratio to preventing exploding tick counts on outliers
        tickCount *= Math.max(0.5, Math.min(3.0, volumeRatio));
    }

    // Scale down for high playback speeds
    if (playbackSpeed > 1) {
        const scaleFactor = 1 / Math.sqrt(playbackSpeed);
        tickCount *= scaleFactor;
    }

    const MIN_TICKS = 10;
    const MAX_TICKS = 1000; // Increased cap for high granularity

    return Math.round(Math.max(MIN_TICKS, Math.min(MAX_TICKS, tickCount)));
}


// ============================================================================
// 3. CORE LOGIC CLASS: SEEDED RANDOM
// ============================================================================

export class SeededRandom {
    private seed: number;

    constructor(seed: number) {
        this.seed = seed;
    }

    next(): number {
        this.seed = (this.seed + 0x6D2B79F5) | 0;
        let t = Math.imul(this.seed ^ (this.seed >>> 15), 1 | this.seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
}


// ============================================================================
// 4. CORE LOGIC CLASS: SYNTHETIC ENGINE
// ============================================================================

interface PatternInfo {
    isBullish: boolean;
    bodyRatio: number;
    upperWickRatio: number;
    lowerWickRatio: number;
    pattern: CandlePattern;
}

export class SyntheticTickGenerator {
    private rng: SeededRandom;

    constructor(seed: number) {
        this.rng = new SeededRandom(seed);
    }

    /**
     * MODULE 1: The "Storyteller" - Derives strategic waypoints
     * 
     * MARKET PSYCHOLOGY: Each pattern tells a story that must be reflected in price movement.
     * - Hammer: Panic sell → Rejection → Strong recovery (底部反転の心理)
     * - Shooting Star: FOMO pump → Profit taking → Collapse (天井の心理)
     * - Marubozu: One-sided conviction, minimal hesitation (強いトレンド)
     * - Doji: Indecision, battle between bulls/bears (迷いと均衡)
     */
    private generateWaypoints(candle: Candle, pattern: PatternInfo): number[] {
        const { o, h, l, c } = candle;
        const isBullish = c >= o;

        // Pattern-Driven Pathfinding (QuantDev Law #5)
        switch (pattern.pattern) {
            case 'hammer':
                // Psychology: Panic sell → Capitulation → Rejection → Recovery
                // Path: Open → Low (panic) → Low+30% (testing) → Low (retest) → Close (strength)
                return [
                    o,
                    l,                              // First drop (panic)
                    l + (c - l) * 0.3,             // Partial recovery (testing)
                    l + (c - l) * 0.1,             // Retest low (shakeout)
                    c                               // Strong close
                ];

            case 'shootingStar':
                // Psychology: FOMO rally → Distribution → Aggressive selling
                // Path: Open → High (euphoria) → High-30% (warning) → High (bull trap) → Close (dump)
                return [
                    o,
                    h,                              // Initial pump (FOMO)
                    h - (h - c) * 0.3,             // First sign of weakness
                    h - (h - c) * 0.1,             // Bull trap (retest high)
                    c                               // Collapse
                ];

            case 'marubozu':
                // Psychology: Strong conviction, no hesitation
                // Path: Open → Close (direct path, minimal noise)
                return [o, c];

            case 'doji':
                // Psychology: Indecision, choppy ping-pong between bulls and bears
                // Path: Open → High → Low → High → Low → Close (chaotic)
                const mid = (h + l) / 2;
                return [
                    o,
                    h,                              // Bulls push up
                    l,                              // Bears push down
                    mid + (h - mid) * 0.5,         // Bulls try again
                    mid - (mid - l) * 0.5,         // Bears counter
                    c                               // Exhaustion close
                ];

            default:
                // Neutral pattern: Use probabilistic routing (original logic)
                const waypoints: number[] = [o];
                const invertLogic = this.rng.next() < 0.3;

                if (isBullish) {
                    if (!invertLogic && l < o) waypoints.push(l);
                    waypoints.push(h);
                    if (invertLogic && l < o) waypoints.push(l);
                } else {
                    if (!invertLogic && h > o) waypoints.push(h);
                    waypoints.push(l);
                    if (invertLogic && h > o) waypoints.push(h);
                }
                waypoints.push(c);
                return waypoints;
        }
    }

    /**
     * MODULE 2: The "Micro-Tick" Generator - Brownian Bridge
     * 
     * QuantDev Law #3: Organic Movement & Physics
     * - Fractal Noise: Inject micro-volatility at multiple scales
     * - Magnetic Pull: Progressive convergence toward waypoints (not instant snap)
     * - Anti-Barcode: First tick MUST equal Open for pixel-perfect transitions
     */
    public generateTicks(candle: Candle, tickCount: number, pattern: PatternInfo, context: MarketContext): TickData[] {
        const waypoints = this.generateWaypoints(candle, pattern);
        const ticks: TickData[] = [];

        const pricePath: number[] = [candle.o]; // ANTI-BARCODE: Start exactly at Open
        const segments = waypoints.length - 1;
        const ticksPerSegment = Math.floor(tickCount / segments);

        const noiseFactor = context.volatility === 'high' ? 1.5 : 0.8;

        for (let i = 0; i < segments; i++) {
            const startPrice = waypoints[i];
            const endPrice = waypoints[i + 1];
            const isLastSegment = i === segments - 1;
            const count = isLastSegment ? tickCount - ticks.length : ticksPerSegment;

            let currentPrice = startPrice;

            for (let j = 1; j <= count; j++) {
                const progress = j / count;

                // ===== PROGRESSIVE MAGNETIC PULL (QuantDev Law #3) =====
                // Instead of linear drift, use quadratic "gravity" that strengthens near waypoint
                const magnetStrength = Math.pow(progress, 2); // 0 → 1 quadratically
                const linearTarget = startPrice + (endPrice - startPrice) * progress;

                // Magnetic pull: Weak at start, strong at end
                const magnetPull = (linearTarget - currentPrice) * magnetStrength * 0.4;

                // Drift: Smooth movement toward target
                const drift = (linearTarget - currentPrice) * 0.1;

                // ===== FRACTAL NOISE (Multi-Scale) =====
                const baseTickSize = getIDXTickSize(currentPrice);
                const noise = (this.rng.next() * 2 - 1) * baseTickSize * noiseFactor;

                let nextPrice = currentPrice + drift + magnetPull + noise;

                // ===== STRICT BOUNDARIES (QuantDev Law #1) =====
                // NEVER exceed High or drop below Low (zero repainting)
                nextPrice = Math.max(candle.l, Math.min(candle.h, nextPrice));

                // ===== WAYPOINT SNAP (Final Tick Accuracy) =====
                // Force exact convergence to waypoint on last tick of segment
                if (j === count) nextPrice = endPrice;

                // ===== IDX TICK SIZE ROUNDING =====
                nextPrice = roundToIDXTickSize(nextPrice);

                pricePath.push(nextPrice);
                currentPrice = nextPrice;
            }
        }

        // ===== ANTI-BARCODE VALIDATION =====
        // Ensure first generated tick didn't deviate from Open
        // (Important when Open is near boundary and noise could push it)
        if (pricePath.length > 1 && pricePath[1] !== candle.o) {
            const tickSize = getIDXTickSize(candle.o);
            const deviation = Math.abs(pricePath[1] - candle.o);

            // If first tick deviated more than 1 tick size, force alignment
            if (deviation > tickSize) {
                pricePath[1] = candle.o;
                console.warn(`[QuantDev] Anti-Barcode: Forced first tick alignment (deviation: ${deviation})`);
            }
        }

        // Volume Profile
        const volumeProfile = this.generateVolumeProfile(candle.v, tickCount);

        // ===== CONSTRUCT TICK DATA =====
        for (let i = 0; i < tickCount; i++) {
            ticks.push({
                tickIndex: i,
                candleIndex: 0,
                price: pricePath[i + 1] || pricePath[i],
                volume: volumeProfile[i],
                timestamp: 0 // Placeholder (Worker B handles timing)
            });
        }

        return ticks;
    }

    private generateVolumeProfile(totalVolume: number, tickCount: number): number[] {
        if (totalVolume <= 0 || tickCount <= 0) return new Array(Math.max(0, tickCount)).fill(0);

        const profile: number[] = new Array(tickCount).fill(0);
        let remaining = totalVolume;

        const startPeak = Math.floor(tickCount * 0.15);
        const endPeak = Math.floor(tickCount * 0.85);

        for (let i = 0; i < tickCount; i++) {
            let weight = 1.0;
            if (i <= startPeak) weight = 3.0 + this.rng.next() * 2.0;
            else if (i >= endPeak) weight = 4.0 + this.rng.next() * 2.0;
            else weight = 0.5 + this.rng.next() * 0.5;

            profile[i] = weight;
        }

        const totalWeight = profile.reduce((a, b) => a + b, 0);

        // Safety: Prevent div by zero
        if (totalWeight === 0) return new Array(tickCount).fill(0);

        for (let i = 0; i < tickCount; i++) {
            // Safety: Ensure we don't produce NaNs
            const v = Math.floor((profile[i] / totalWeight) * totalVolume);
            profile[i] = isNaN(v) ? 0 : v;
            remaining -= profile[i];
        }

        // Distribute remainder to last tick
        if (tickCount > 0) {
            profile[tickCount - 1] += remaining;
        }

        return profile;
    }

    public generateHeartbeat(tickCount: number, durationMs: number): number[] {
        const delays: number[] = [];
        const baseDelay = durationMs / tickCount;
        let currentMood: 'FAST' | 'SLOW' | 'NORMAL' = 'NORMAL';
        let ticksInMood = 0;

        for (let i = 0; i < tickCount; i++) {
            if (ticksInMood <= 0) {
                const r = this.rng.next();
                if (r < 0.3) currentMood = 'FAST';
                else if (r < 0.6) currentMood = 'SLOW';
                else currentMood = 'NORMAL';
                ticksInMood = Math.floor(5 + this.rng.next() * 10);
            }

            let multiplier = 1.0;
            if (currentMood === 'FAST') multiplier = 0.4;
            if (currentMood === 'SLOW') multiplier = 1.8;

            const variance = 0.8 + this.rng.next() * 0.4;
            delays.push(baseDelay * multiplier * variance);
            ticksInMood--;
        }

        const totalDelay = delays.reduce((a, b) => a + b, 0);
        const scale = durationMs / totalDelay;

        let cumulative = 0;
        const normalized: number[] = [];
        for (let d of delays) {
            cumulative += d * scale;
            normalized.push(cumulative);
        }
        return normalized;
    }
}
