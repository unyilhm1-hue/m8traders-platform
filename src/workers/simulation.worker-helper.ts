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

    // Scale by duration
    const durationMinutes = durationMs / 60000;
    let tickCount = BASE_DENSITY * durationMinutes;

    // Scale by volatility
    const volatilityMultipliers = { low: 0.7, medium: 1.0, high: 1.5 };
    tickCount *= volatilityMultipliers[volatility];

    // Scale by volume
    if (averageVolume > 0) {
        const volumeRatio = volume / averageVolume;
        tickCount *= Math.max(0.5, Math.min(2.0, volumeRatio));
    }

    // Scale down for high playback speeds
    if (playbackSpeed > 1) {
        const scaleFactor = 1 / Math.sqrt(playbackSpeed);
        tickCount *= scaleFactor;
    }

    const MIN_TICKS = 10;
    const MAX_TICKS = 500;

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
     */
    private generateWaypoints(candle: Candle, pattern: PatternInfo): number[] {
        const { o, h, l, c } = candle;
        const waypoints: number[] = [o];
        const isBullish = c >= o;
        const invertLogic = this.rng.next() < 0.3;

        // Simplified routing logic
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

    /**
     * MODULE 2: The "Micro-Tick" Generator - Brownian Bridge
     */
    public generateTicks(candle: Candle, tickCount: number, pattern: PatternInfo, context: MarketContext): TickData[] {
        const waypoints = this.generateWaypoints(candle, pattern);
        const ticks: TickData[] = [];

        const pricePath: number[] = [candle.o];
        const segments = waypoints.length - 1;
        const ticksPerSegment = Math.floor(tickCount / segments);

        const noiseFactor = context.volatility === 'high' ? 1.5 : 0.8;
        const driftLookahead = 0.1;

        for (let i = 0; i < segments; i++) {
            const startPrice = waypoints[i];
            const endPrice = waypoints[i + 1];
            const isLastSegment = i === segments - 1;
            const count = isLastSegment ? tickCount - ticks.length : ticksPerSegment;

            let currentPrice = startPrice;

            for (let j = 1; j <= count; j++) {
                const progress = j / count;
                const linearTarget = startPrice + (endPrice - startPrice) * progress;
                const drift = (linearTarget - currentPrice) * driftLookahead;
                const noise = (this.rng.next() * 2 - 1) * getIDXTickSize(currentPrice) * noiseFactor;

                let nextPrice = currentPrice + drift + noise;

                // Hard Limits
                nextPrice = Math.max(candle.l, Math.min(candle.h, nextPrice));

                // Magnetism
                if (j === count) nextPrice = endPrice;

                // IDX Rounding
                nextPrice = roundToIDXTickSize(nextPrice);

                pricePath.push(nextPrice);
                currentPrice = nextPrice;
            }
        }

        // Volume Profile
        const volumeProfile = this.generateVolumeProfile(candle.v, tickCount);

        // Heartbeat Timing
        // Note: For simplicity in the helper, we just return ordered ticks. 
        // Timing logic is often handled by the Consumer (Worker B) to map to real-time.
        // But we can generate relative delays here if needed.
        // For now, we return TickData structure without timestamp offset filling, 
        // expecting Worker B to handle the scheduling.

        for (let i = 0; i < tickCount; i++) {
            ticks.push({
                tickIndex: i,
                candleIndex: 0,
                price: pricePath[i + 1] || pricePath[i],
                volume: volumeProfile[i],
                timestamp: 0 // Placeholder
            });
        }

        return ticks;
    }

    private generateVolumeProfile(totalVolume: number, tickCount: number): number[] {
        if (totalVolume <= 0) return new Array(tickCount).fill(0);

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
        for (let i = 0; i < tickCount; i++) {
            const v = Math.floor((profile[i] / totalWeight) * totalVolume);
            profile[i] = v;
            remaining -= v;
        }
        profile[tickCount - 1] += remaining;

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
