/**
 * Simulation Worker - Context-Aware & Pattern-Driven Pathfinding Engine
 * Implements organic price movement with pattern recognition and market microstructure
 * 
 * @see .agent/skills/backend-skills/quant-dev.md for design principles
 */

// ============================================================================
// Type Definitions
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

    // Smart buffering support (NEW)
    historyBuffer?: Candle[];       // Past 200 candles for warm-up
    simulationQueue?: Candle[];     // Future candles to animate
    interval?: string;               // Target interval (1m, 5m, etc)

    // Legacy support (backward compatible)
    candles?: Candle[];

    // Playback controls
    speed?: number;
    index?: number;
    indicator?: IndicatorRequest;
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
    color: string;
}

// ============================================================================
// 🔥 NEW: Context-Aware Pattern Profile (Simplified)
// ============================================================================

/**
 * Strict pattern detection based on body/wick ratios only
 * - No confidence scores or priorities
 * - Pure binary detection with strict thresholds
 */
type CandlePattern = 'hammer' | 'shootingStar' | 'marubozu' | 'doji' | 'neutral';

interface PatternProfile {
    type: CandlePattern;
    isBullish: boolean;
    bodyRatio: number;    // Body size relative to range (0-1)
    upperWickRatio: number;
    lowerWickRatio: number;
}

/**
 * Market context from Multi-Timeframe Analysis
 * Replaces simple lookback with 3-layer Mata Dewa strategy
 */
interface MarketContext {
    // Layer 1: Micro (pattern)
    currentPattern: 'hammer' | 'shootingStar' | 'marubozu' | 'doji' | 'neutral';
    patternBullish: boolean;

    // Layer 2: Meso (session)
    sessionProgress: number;
    volumeVsAverage: number;

    // Layer 3: Macro (trend from buffer)
    trend: 'bullish' | 'bearish' | 'sideways';
    trendStrength: number;
    volatility: 'low' | 'medium' | 'high';

    // Layer 4: Flow alignment (coherence check)
    isFlowAligned: boolean;  // Pattern direction matches trend
    noiseLevel: number;      // 0-1, higher = more chaotic movement

    // 🔥 MARKET PHYSICS AUDIT: Optional GBM parameters
    useGBM?: boolean;        // Enable Geometric Brownian Motion mode
    gbmDrift?: number;       // μ (drift coefficient, typically 0.0001-0.001)
    gbmVolatility?: number;  // σ (volatility coefficient, typically 0.01-0.05)
}

// ============================================================================
// 🔥 NEW: Path Template System
// ============================================================================

type PathWaypoint = 'OPEN' | 'HIGH' | 'LOW' | 'CLOSE';

interface PathTemplate {
    waypoints: PathWaypoint[];
    description: string;
}

// Define 4 organic path templates
const PATH_TEMPLATES: PathTemplate[] = [
    {
        waypoints: ['OPEN', 'LOW', 'HIGH', 'CLOSE'],
        description: 'Bearish recovery (selloff then rally)'
    },
    {
        waypoints: ['OPEN', 'HIGH', 'LOW', 'CLOSE'],
        description: 'Bullish pullback (rally then dip)'
    },
    {
        waypoints: ['OPEN', 'HIGH', 'CLOSE'],
        description: 'Strong bullish (direct rally)'
    },
    {
        waypoints: ['OPEN', 'LOW', 'CLOSE'],
        description: 'Strong bearish (direct dump)'
    }
];

// ============================================================================
// 🎯 QUICK WIN #2: Seeded PRNG for Deterministic Replay
// ============================================================================

/**
 * Mulberry32 Seeded Pseudorandom Number Generator
 * Fast, high-quality PRNG that produces deterministic results
 * 
 * @see https://github.com/bryc/code/blob/master/jshash/PRNGs.md
 */
class SeededRandom {
    private seed: number;

    constructor(seed: number) {
        this.seed = seed;
    }

    /**
     * Generate next random number in [0, 1)
     * Deterministic based on seed
     */
    next(): number {
        // Mulberry32 algorithm
        this.seed = (this.seed + 0x6D2B79F5) | 0;
        let t = Math.imul(this.seed ^ (this.seed >>> 15), 1 | this.seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
}

// ============================================================================
// Market Configuration
// ============================================================================

interface MarketConfig {
    timezone: string;
    openHour: number;
    closeHour: number;
    lunchBreakStart: number;
    lunchBreakEnd: number;
    filterEnabled: boolean;
}

const DEFAULT_MARKET_CONFIG: MarketConfig = {
    timezone: 'Asia/Jakarta',
    openHour: 9,
    closeHour: 16,
    lunchBreakStart: 11.5,
    lunchBreakEnd: 13.5,
    filterEnabled: true
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Validate and sanitize OHLC candle data
 */
function validateAndSanitizeOHLC(candle: Candle, index: number): Candle | null {
    let { o, h, l, c, t, v } = candle;

    if ([o, h, l, c].some(p => p === null || p === undefined || isNaN(p) || p <= 0)) {
        console.warn(`[SimWorker] ⚠️ Candle ${index}: Invalid OHLC, skipping`);
        return null;
    }

    if (h < l) {
        console.warn(`[SimWorker] ⚠️ Candle ${index}: h < l, swapping`);
        [h, l] = [l, h];
    }

    const maxOC = Math.max(o, c);
    if (h < maxOC) {
        console.warn(`[SimWorker] ⚠️ Candle ${index}: h < max(O,C), adjusting`);
        h = maxOC;
    }

    const minOC = Math.min(o, c);
    if (l > minOC) {
        console.warn(`[SimWorker] ⚠️ Candle ${index}: l > min(O,C), adjusting`);
        l = minOC;
    }

    return { ...candle, o, h, l, c };
}

/**
 * IDX tick size rules
 */
function getIDXTickSize(price: number): number {
    if (price < 200) return 1;
    if (price < 500) return 2;
    if (price < 2000) return 5;
    if (price < 5000) return 10;
    return 25;
}

function roundToIDXTickSize(price: number): number {
    const tickSize = getIDXTickSize(price);
    return Math.round(price / tickSize) * tickSize;
}

/**
 * Convert interval string to milliseconds
 * 🔥 FIX #7: Helper for gap clamping
 */
function intervalToMs(interval: string): number {
    const match = interval.match(/^(\d+)([mhd])$/);
    if (!match) return 60000; // Default 1m

    const [, value, unit] = match;
    const num = parseInt(value);

    switch (unit) {
        case 'm': return num * 60 * 1000;
        case 'h': return num * 3600 * 1000;
        case 'd': return num * 86400 * 1000;
        default: return 60000;
    }
}

/**
 * 🎯 QUICK WIN #3: Check if timestamp is within market hours
 * Harmonized with store filtering logic
 */
function isWithinMarketHours(timestamp: number, config: MarketConfig = DEFAULT_MARKET_CONFIG): boolean {
    if (!config.filterEnabled) return true;

    const date = new Date(timestamp);
    const hourStr = date.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: config.timezone });
    const minuteStr = date.toLocaleString('en-US', { minute: 'numeric', timeZone: config.timezone });
    const hour = parseInt(hourStr);
    const minute = parseInt(minuteStr);
    const decimal = hour + minute / 60;

    // 🔥 FIX #11: Market hours: 09:00 - 16:00 (inclusive of 16:00:00)
    // Changed from >= to > for closeHour to match store behavior
    if (decimal < config.openHour || decimal > config.closeHour) {
        return false;
    }

    // Lunch break: 11:30 - 13:30 WIB (11.5 - 13.5 decimal)
    if (decimal >= config.lunchBreakStart && decimal < config.lunchBreakEnd) {
        return false;
    }

    return true;
}

/**
 * Check if timestamp is during lunch break (legacy, kept for backward compatibility)
 */
function isLunchBreak(timestamp: number, config: MarketConfig = DEFAULT_MARKET_CONFIG): boolean {
    if (!config.filterEnabled) return false;

    const date = new Date(timestamp);
    const hourStr = date.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: config.timezone });
    const minuteStr = date.toLocaleString('en-US', { minute: 'numeric', timeZone: config.timezone });
    const hour = parseInt(hourStr) + parseInt(minuteStr) / 60;

    // 🎯 QUICK WIN #3: Use config values instead of hardcoded 11.5-13.5
    return hour >= config.lunchBreakStart && hour < config.lunchBreakEnd;
}

// ============================================================================
// 🔥 Pattern Recognition (Simplified - Strict Ratios Only)
// ============================================================================

/**
 * Analyze candle pattern using strict body/wick ratio thresholds
 * No confidence scores - pure binary detection
 */
function analyzeCandle(candle: Candle): PatternProfile {
    const range = candle.h - candle.l;

    if (range === 0) {
        return {
            type: 'neutral',
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

    // Strict pattern detection
    // HAMMER: Long lower wick (panic sell + rejection)
    if (lowerWickRatio > 0.6 && bodyRatio < 0.3) {
        return { type: 'hammer', isBullish, bodyRatio, upperWickRatio, lowerWickRatio };
    }

    // SHOOTING STAR: Long upper wick (pump + dump)
    if (upperWickRatio > 0.6 && bodyRatio < 0.3) {
        return { type: 'shootingStar', isBullish, bodyRatio, upperWickRatio, lowerWickRatio };
    }

    // MARUBOZU: Strong trend, minimal wicks
    if ((upperWickRatio + lowerWickRatio) < 0.1 && bodyRatio > 0.8) {
        return { type: 'marubozu', isBullish, bodyRatio, upperWickRatio, lowerWickRatio };
    }

    // DOJI: Very small body (indecision)
    if (bodyRatio < 0.05) {
        return { type: 'doji', isBullish, bodyRatio, upperWickRatio, lowerWickRatio };
    }

    // Default: neutral
    return { type: 'neutral', isBullish, bodyRatio, upperWickRatio, lowerWickRatio };
}


// OLD analyzeContext removed - replaced with analyzeMultiTimeframeContext from utils

// ============================================================================
// 🔥 Procedural Pathfinding - Template-Based Organic Movement
// ============================================================================

/**
 * Simplex Noise Generator for Professional-Grade Organic Movement
 * Uses simplex-noise library for high-quality procedural noise
 */

import { createNoise2D } from 'simplex-noise';

// Create persistent noise generator
const noise2D = createNoise2D();

/**
 * Generate multi-octave simplex noise for realistic market microstructure
 *  
 * @param seed - Unique seed per tick (prevents pattern repetition)
 * @param frequency - Base frequency (higher = more rapid fluctuations)
 * @param octaves - Number of noise layers (higher = more detail)
 * @returns Value between -1 and 1
 * 
 * Market Psychology:
 * - Low octaves (1-2): Smooth, institutional flow
 * - High octaves (3-4): Choppy, retail-driven activity
 */
function generateOrganicNoise(
    seed: number,
    frequency: number = 1.0,
    octaves: number = 2
): number {
    let value = 0;
    let amplitude = 1.0;
    let totalAmplitude = 0;

    // Multi-octave fractal noise
    for (let i = 0; i < octaves; i++) {
        const octaveFreq = frequency * Math.pow(2, i);
        const x = seed * 0.001 * octaveFreq; // Scale seed to reasonable range
        const y = seed * 0.0007 * octaveFreq; // Different scale for 2D variation

        value += noise2D(x, y) * amplitude;
        totalAmplitude += amplitude;
        amplitude *= 0.5; // Each octave half volume of previous
    }

    // Normalize to -1 to 1 range
    return value / totalAmplitude;
}

/**
 * Generate price from waypoint name
 */
function getWaypointPrice(waypoint: PathWaypoint, candle: Candle): number {
    switch (waypoint) {
        case 'OPEN': return candle.o;
        case 'HIGH': return candle.h;
        case 'LOW': return candle.l;
        case 'CLOSE': return candle.c;
    }
}

/**
 * 🔥 CORE: Generate organic price path using template system
 * 
 * Market Psychology:
 * - Templates simulate realistic order flow (FOMO, panic, accumulation)
 * - Fractal noise simulates bid/ask spread battles
 * - Magnetic pull ensures convergence to Close price
 */
/**
 * Generate organic price path with seeded randomness and IDX tick size compliance
 * 
 * 🎯 QUICK WIN #1: Apply IDX tick size rounding to all generated prices
 * 🎯 QUICK WIN #2: Use seeded PRNG for deterministic replay
 */
function generateOrganicPath(
    candle: Candle,
    candleIndex: number,  // 🎯 NEW: For seed generation
    pattern: PatternProfile,
    context: MarketContext,
    tickCount: number
): number[] {
    // Price path with pattern-aware noise
    const path: number[] = [];
    const range = candle.h - candle.l;

    // Edge case: no movement
    if (range === 0) {
        return Array(tickCount).fill(candle.c);
    }

    // 🎯 QUICK WIN #2: Create seeded RNG for this candle
    const seed = candle.t + candleIndex * 1000;
    const rng = new SeededRandom(seed);

    // 🔥 MARKET PHYSICS AUDIT: Optional GBM (Geometric Brownian Motion)
    // For academic-grade variance calibration
    const useGBM = context.useGBM || false;
    const μ = context.gbmDrift || 0.0005;      // Drift coefficient (0.05% per tick)
    const σ = context.gbmVolatility || 0.02;   // Volatility (2% standard deviation)

    // Box-Muller transform for Gaussian random (used in GBM)
    const gaussianRandom = (): number => {
        const u1 = rng.next();
        const u2 = rng.next();
        return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    };

    // Select template based on pattern and candle direction
    let selectedTemplate: PathTemplate;

    if (pattern.type === 'hammer') {
        // Hammer: Always drop to LOW first, then recover
        selectedTemplate = PATH_TEMPLATES[0]; // OPEN -> LOW -> HIGH -> CLOSE
    } else if (pattern.type === 'shootingStar') {
        // Shooting star: Always pump to HIGH first, then dump
        selectedTemplate = PATH_TEMPLATES[1]; // OPEN -> HIGH -> LOW -> CLOSE
    } else if (pattern.type === 'marubozu') {
        // Marubozu: Strong directional movement
        if (pattern.isBullish) {
            selectedTemplate = PATH_TEMPLATES[2]; // OPEN -> HIGH -> CLOSE
        } else {
            selectedTemplate = PATH_TEMPLATES[3]; // OPEN -> LOW -> CLOSE
        }
    } else {
        // Neutral/Doji: Random template selection
        // 🎯 QUICK WIN #2: Use seeded random instead of Math.random()
        const templateIndex = Math.floor(rng.next() * PATH_TEMPLATES.length);
        selectedTemplate = PATH_TEMPLATES[templateIndex];
    }

    console.log(`[OrganicPath] Pattern: ${pattern.type}, Template: ${selectedTemplate.description}, Ticks: ${tickCount}`);

    // Build waypoint anchors with tick positions
    const waypoints = selectedTemplate.waypoints;
    const segmentSize = Math.floor(tickCount / (waypoints.length - 1));

    interface Anchor {
        tick: number;
        price: number;
    }

    const anchors: Anchor[] = waypoints.map((wp, idx) => ({
        tick: idx === waypoints.length - 1 ? tickCount - 1 : idx * segmentSize,
        price: getWaypointPrice(wp, candle)
    }));

    // 🔥 CRITICAL FIX: Ensure first tick is ALWAYS at OPEN price
    // This is essential for seamless transitions (candle must start from OPEN, not HIGH/LOW)
    path[0] = roundToIDXTickSize(candle.o); // 🎯 QUICK WIN #1: Apply tick size rounding

    // Interpolate between anchors with fractal noise and magnetic pull
    // Start from i=1 since path[0] is already set to OPEN
    for (let i = 1; i < tickCount; i++) {
        // Find surrounding anchors
        const beforeAnchor = anchors.filter(a => a.tick <= i).pop();
        const afterAnchor = anchors.find(a => a.tick > i);

        if (!beforeAnchor || !afterAnchor) {
            // Edge case: use close price
            path.push(roundToIDXTickSize(i === tickCount - 1 ? candle.c : candle.o)); // 🎯 QUICK WIN #1
            continue;
        }

        // Base linear interpolation
        const segmentProgress = (i - beforeAnchor.tick) / (afterAnchor.tick - beforeAnchor.tick);
        let basePrice = beforeAnchor.price + (afterAnchor.price - beforeAnchor.price) * segmentProgress;

        // 🔥 MICRO-NOISE: Simplex noise injection (Professional-grade)
        // Simulates bid/ask spread battles, order flow fluctuations
        const noiseSeed = i + candle.t; // Unique seed per tick

        // Context-aware noise parameters
        const noiseFreq = context.volatility === 'high' ? 1.5 : context.volatility === 'low' ? 0.7 : 1.0;
        // 🔥 NOISE INJECTION: Choose between GBM or Simplex noise
        const noiseComponent = useGBM
            ? (() => {
                // Geometric Brownian Motion: dS = μS dt + σS dW
                const dt = 1 / tickCount;  // Time step
                const dW = gaussianRandom() * Math.sqrt(dt);  // Wiener increment

                // GBM is multiplicative, so drift and diffusion are applied to the current price
                // For noise, we want a deviation from the basePrice
                // A common simplification for GBM noise is to return a value that is added to the current price.
                // Here, we'll calculate the change in price (dP) based on GBM.
                const drift = μ * basePrice * dt;
                const diffusion = σ * basePrice * dW;

                return drift + diffusion;
            })()
            : (() => {
                // Simplex Noise (default): Multi-frequency for organic feel
                // Use the existing noiseSeed and context-aware noiseFreq/Octaves
                const noiseOctaves = context.isFlowAligned ? 2 : 3; // Aligned = smooth (2 octaves), Conflicted = choppy (3 octaves)
                const noise = generateOrganicNoise(noiseSeed, noiseFreq, noiseOctaves) * range * context.noiseLevel;

                return noise;
            })();

        let price = basePrice + noiseComponent;

        // 🎯 MAGNETISM: Price gravitates toward close as time progresses
        // 🔥 MARKET PHYSICS AUDIT: Pattern-aware magnetism strength
        // Different patterns exhibit different pull strength toward target
        const magnetismStrength = (() => {
            switch (pattern.type) {
                case 'hammer':
                case 'shootingStar':
                    // Strong reversal patterns = strong pull (25%)
                    return 0.25;
                case 'marubozu':
                    // Trending pattern = moderate pull (20%)
                    return 0.20;
                case 'doji':
                    // Indecision = weak pull (10%)
                    return 0.10;
                default:
                    // Neutral = baseline pull (15%)
                    return 0.15;
            }
        })();

        // 🔥 MAGNETIC PULL: Converge to CLOSE in last 20% of ticks
        const globalProgress = i / (tickCount - 1);
        if (globalProgress > 0.8) {
            const pullStrength = (globalProgress - 0.8) / 0.2; // 0 to 1 over last 20%
            const pullTarget = candle.c;
            // Apply magnetism strength to the pull
            price = price * (1 - pullStrength * magnetismStrength) + pullTarget * (pullStrength * magnetismStrength);
        }

        // Strict boundaries: NEVER exceed High/Low
        price = Math.max(candle.l, Math.min(candle.h, price));

        // 🎯 QUICK WIN #1: Apply IDX tick size rounding to all prices
        path.push(roundToIDXTickSize(price));
    }

    // 🔥 CRITICAL: Ensure final tick === Close (pixel-perfect)
    path[tickCount - 1] = roundToIDXTickSize(candle.c); // 🎯 QUICK WIN #1

    return path;
}

// ============================================================================
// 🔥 Dynamic Multi-Interval Logic
// ============================================================================

/**
 * Calculate adaptive tick count based on duration and volume/ATR
 * 
 * Market Psychology:
 * - 1m candles: ~60 ticks (1 tick/second at 1x speed)/**
 * Calculate adaptive tick density
 * - More ticks for long-duration candles
 * - More ticks for high-volume candles  
 * - More ticks for high-volatility markets
 * 
 * 🚀 PERFORMANCE FIX: Scales down at high playback speeds to prevent backlog
 */
function calculateTickDensity(
    durationMs: number,
    volume: number,
    averageVolume: number,
    volatility: 'low' | 'medium' | 'high',
    playbackSpeed: number = 1  // 🚀 PERFORMANCE FIX: Add playback speed parameter
): number {
    const BASE_DENSITY = 60; // ticks per minute (market baseline)

    // Scale by duration (more time = more ticks)
    const durationMinutes = durationMs / 60000;
    let tickCount = BASE_DENSITY * durationMinutes;

    // Scale by volatility (more volatile = more ticks)
    const volatilityMultipliers = { low: 0.7, medium: 1.0, high: 1.5 };
    tickCount *= volatilityMultipliers[volatility];

    // Scale by relative volume (higher volume = more ticks)
    if (averageVolume > 0) {
        const volumeRatio = volume / averageVolume;
        tickCount *= Math.max(0.5, Math.min(2.0, volumeRatio)); // Clamp 0.5x - 2x
    }

    // 🚀 PERFORMANCE FIX: Scale down for high playback speeds
    // Prevents tick backlog and dropped updates at 10x/25x/50x speed
    if (playbackSpeed > 1) {
        // Use sqrt scaling: 4x speed = 50% ticks, 25x speed = 20% ticks
        const scaleFactor = 1 / Math.sqrt(playbackSpeed);
        tickCount *= scaleFactor;
    }

    // Enforce min/max bounds
    const MIN_TICKS = 10;
    const MAX_TICKS = 500;

    return Math.round(Math.max(MIN_TICKS, Math.min(MAX_TICKS, tickCount)));
}

/**
 * Distribute total volume across ticks with variance
 * 🎯 DETERMINISTIC: Uses seeded RNG for reproducible replay
 */
function distributeVolume(totalVolume: number, tickCount: number, rng: SeededRandom): number[] {
    if (totalVolume === 0) {
        return Array(tickCount).fill(0);
    }

    const baseVolume = totalVolume / tickCount;
    const volumes = Array.from({ length: tickCount }, () => {
        const variance = 0.7 + rng.next() * 0.6; // 0.7x - 1.3x (deterministic)
        return Math.floor(baseVolume * variance);
    });

    // Ensure sum equals total
    const currentSum = volumes.reduce((sum, v) => sum + v, 0);
    const diff = totalVolume - currentSum;
    volumes[tickCount - 1] += diff;

    return volumes;
}

// ============================================================================
// 🔥 Time Scheduler with Cluster Effect
// ============================================================================

interface TickSchedule {
    tickIndex: number;
    targetTime: number; // ms from candle start
    price: number;
    volume: number;
}

/**
 * Generate normalized tick schedule with cluster effect
 * 
 * Market Psychology:
 * - Most ticks: evenly distributed (normal market flow)
 * - 30% of ticks: clustered (trade bursts, news reactions)
 * - sum(delays) === durationMs (exact normalization)
 */
function generateTickSchedule(
    candle: Candle,
    nextCandle: Candle | undefined,
    pricePath: number[],
    volumePath: number[],
    durationMs: number,
    rng: SeededRandom  // 🎯 DETERMINISTIC: Accept seeded RNG
): TickSchedule[] {
    const tickCount = pricePath.length;
    const baseDelay = durationMs / tickCount;

    // Generate raw delays with cluster effect (deterministic)
    const rawDelays: number[] = [];
    for (let i = 0; i < tickCount; i++) {
        // 30% chance of cluster (faster burst) - deterministic
        const isCluster = rng.next() < 0.3;
        const delayMultiplier = isCluster ? 0.5 : 1.2; // Cluster = 50% delay, Normal = 120%

        // 🔥 NOISE INJECTION: Choose between Simplex (default) or GBM (academic)
        const noiseComponent = context.useGBM
            ? (() => {
                // Geometric Brownian Motion: dS = μS dt + σS dW
                // where dW ~ N(0, dt) is Wiener process increment
                // For simplicity, using a fixed drift and volatility for delay noise
                const dt = 1 / tickCount;  // Time step
                const dW = (rng.next() - 0.5) * 2 * Math.sqrt(dt); // Approximation of Wiener increment from uniform RNG

                // These parameters (μ, σ) would ideally come from context or be derived
                const mu = 0.01; // Drift (e.g., 1% per candle duration)
                const sigma = 0.05; // Volatility (e.g., 5% per candle duration)

                // Applying GBM-like noise to the delay variance
                // The 'price' here is conceptual, representing the baseDelay
                const drift = mu * baseDelay * dt;
                const diffusion = sigma * baseDelay * dW;

                return drift + diffusion;
            })()
            : (() => {
                // Simplex Noise (default): Multi-frequency for organic feel
                // Assuming 'simplex' and 'seed' are available or can be passed/derived
                // For this context, we'll use rng for a simpler noise
                const microNoise = (rng.next() - 0.5) * 0.02;   // 2% micro
                const macroNoise = (rng.next() - 0.5) * 0.05;  // 5% macro

                // The 'range' and 'noise' variables are not directly applicable here
                // We're applying noise to the delay, not the price directly.
                // Let's use a simple scaling factor for the noise.
                return (microNoise + macroNoise) * baseDelay * 0.5; // Scale noise relative to baseDelay
            })();

        const variance = (rng.next() - 0.5) * baseDelay * 0.4; // Original ±20% variance (deterministic)
        rawDelays.push(baseDelay * delayMultiplier + variance + noiseComponent);
    }

    // 🔥 NORMALIZATION: Scale to exact duration
    const totalRawDelay = rawDelays.reduce((sum, d) => sum + d, 0);
    const scaleFactor = totalRawDelay > 0 ? durationMs / totalRawDelay : 1;

    let cumulativeTime = 0;
    const schedule: TickSchedule[] = [];

    for (let i = 0; i < tickCount; i++) {
        const normalizedDelay = rawDelays[i] * scaleFactor;
        cumulativeTime += normalizedDelay;

        // Ensure final tick doesn't collide with next candle
        const isFinalTick = i === tickCount - 1;
        const targetTime = isFinalTick
            ? Math.min(cumulativeTime, durationMs - 1) // 1ms before next candle
            : cumulativeTime;

        schedule.push({
            tickIndex: i,
            targetTime,
            price: pricePath[i],
            volume: volumePath[i]
        });
    }

    return schedule;
}

// ============================================================================
// Indicator Calculations (Unchanged from original)
// ============================================================================

function calculateVolume(candles: Candle[]): VolumeResult[] {
    return candles.map(candle => ({
        time: candle.t / 1000,
        value: candle.v,
        color: candle.c >= candle.o ? '#26a69a' : '#ef5350'
    }));
}

function calculateVWAP(candles: Candle[]): IndicatorResult[] {
    const results: IndicatorResult[] = [];
    let cumulativePV = 0;
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

function calculateRSI(candles: Candle[], period: number = 14): IndicatorResult[] {
    // @ts-ignore - Worker context import
    const { RSI } = require('technicalindicators');

    const closePrices = candles.map(c => c.c);
    const rsiValues = RSI.calculate({ values: closePrices, period });

    const results: IndicatorResult[] = [];
    rsiValues.forEach((value: number, index: number) => {
        const candleIndex = index + period;
        if (candleIndex < candles.length) {
            results.push({
                time: candles[candleIndex].t / 1000,
                value: value
            });
        }
    });

    return results;
}

function calculateIndicator(candles: Candle[], request: IndicatorRequest): any[] {
    const { name, params = {} } = request;

    switch (name) {
        case 'volume':
            return calculateVolume(candles);
        case 'vwap':
            return calculateVWAP(candles);
        case 'rsi':
            return calculateRSI(candles, params.period || 14);
        default:
            console.warn(`[SimWorker] Indicator "${name}" not yet implemented`);
            return [];
    }
}

// ============================================================================
// Simulation Engine
// ============================================================================

class SimulationEngine {
    private candles: Candle[] = [];
    private currentCandleIndex: number = 0;
    private isPlaying: boolean = false;
    private playbackSpeed: number = 1;
    private tickInterval: number | null = null;

    private tickSchedule: TickSchedule[] = [];
    private currentTickIndex: number = 0;
    private candleStartTime: number = 0;

    // 🔥 FIX 1: Adaptive throttle instead of hard cap
    private readonly BASE_TICKS_PER_POLL = 10;
    private readonly MAX_CATCHUP_TICKS = 50;  // Allow burst catch-up
    private lastPollTime: number = 0;
    private tickBacklog: number = 0;

    // 🆕 FIX 3: Performance metrics tracking
    private totalTicksProcessed: number = 0;
    private droppedTickCount: number = 0;
    private tickLatencySum: number = 0;  // For averaging
    private lastMetricsReport: number = 0;
    private readonly METRICS_REPORT_INTERVAL = 1000; // Report every 1s

    private currentAggregatedCandle: {
        time: number;
        open: number;
        high: number;
        low: number;
        close: number;
    } | null = null;

    // 🔥 FIX 3: Continuous candle updates
    private lastCandleUpdateTime: number = 0;
    private readonly CANDLE_UPDATE_INTERVAL = 100; // Update every 100ms

    private averageVolume: number = 1;
    private marketConfig: MarketConfig = DEFAULT_MARKET_CONFIG;

    // 🔥 NEW: Smart Buffering Properties
    private historyBuffer: Candle[] = [];          // Past 200 candles for warm-up
    private sessionCandles: Candle[] = [];         // Today's candles accumulated
    private currentInterval: string = '1m';        // Current interval

    constructor() {
        console.log('[SimWorker] 🔥 Context-Aware Pathfinding Engine initialized');
    }

    initData(candles: Candle[]) {
        console.log(`[SimWorker] Loading ${candles.length} candles...`);

        // Timestamp normalization
        const processedCandles = candles.map(c => {
            let timestamp: number;
            const rawTimestamp: any = c.t;

            if (typeof rawTimestamp === 'number') {
                timestamp = rawTimestamp < 10000000000 ? rawTimestamp * 1000 : rawTimestamp;
            } else if (rawTimestamp instanceof Date) {
                timestamp = rawTimestamp.getTime();
            } else if (typeof rawTimestamp === 'string') {
                timestamp = new Date(rawTimestamp).getTime();
            } else {
                console.error('[SimWorker] Invalid timestamp:', typeof c.t);
                timestamp = Date.now();
            }

            return { ...c, t: timestamp };
        });

        // Sort by timestamp
        processedCandles.sort((a, b) => a.t - b.t);

        // Validate OHLC
        const validatedCandles = processedCandles
            .map((c, idx) => validateAndSanitizeOHLC(c, idx))
            .filter((c): c is Candle => c !== null);

        const invalidCount = processedCandles.length - validatedCandles.length;
        if (invalidCount > 0) {
            console.warn(`[SimWorker] ⚠️ Filtered ${invalidCount} invalid candles`);
        }

        // Filter lunch break
        const beforeFilter = validatedCandles.length;

        // 🔥 FIX #10: Filter market hours AND lunch break for legacy mode
        this.candles = validatedCandles.filter(c => {
            if (!isWithinMarketHours(c.t, this.marketConfig)) {
                return false;
            }
            if (isLunchBreak(c.t, this.marketConfig)) {
                return false;
            }
            return true;
        });

        const skippedCount = beforeFilter - this.candles.length;

        if (skippedCount > 0) {
            console.log(`[SimWorker] ⏭️ Skipped ${skippedCount} non-market hours or lunch break candles`);
        }

        console.log(`[SimWorker] ✅ Processing ${this.candles.length} valid candles`);

        // Calculate average volume
        const totalVolume = this.candles.reduce((sum, c) => sum + c.v, 0);
        this.averageVolume = this.candles.length > 0 ? totalVolume / this.candles.length : 1;
        console.log(`[SimWorker] 📊 Average volume: ${this.averageVolume.toLocaleString()}`);

        this.currentCandleIndex = 0;
        this.currentTickIndex = 0;

        if (this.candles.length > 0) {
            this.initializeAggregatedCandle();
            postMessage({ type: 'DATA_READY', totalCandles: this.candles.length, skippedLunchBreak: skippedCount });
        }
    }

    /**
     * 🔥 NEW: Initialize with Smart Buffering
     * Implements "Gunung Es" (Iceberg) strategy
     * 
     * @param historyBuffer - Past 200 candles for warm-up (invisible)
     * @param simulationQueue - Future candles to animate (visible)
     * @param interval - Target interval (1m, 5m, etc)
     */
    initDataWithBuffers(historyBuffer: Candle[], simulationQueue: Candle[], interval: string) {
        console.log(`[SimWorker] 🧊 Smart Buffering: ${historyBuffer.length} history + ${simulationQueue.length} simulation candles`);
        console.log(`[SimWorker] 📊 Target interval: ${interval}`);

        // Store buffers
        this.historyBuffer = historyBuffer;
        this.currentInterval = interval;

        // Process simulation queue (same as legacy initData)
        const processedCandles = simulationQueue.map(c => {
            let timestamp: number;
            const rawTimestamp: any = c.t;

            if (typeof rawTimestamp === 'number') {
                timestamp = rawTimestamp < 10000000000 ? rawTimestamp * 1000 : rawTimestamp;
            } else if (rawTimestamp instanceof Date) {
                timestamp = rawTimestamp.getTime();
            } else if (typeof rawTimestamp === 'string') {
                timestamp = new Date(rawTimestamp).getTime();
            } else {
                console.error('[SimWorker] Invalid timestamp:', typeof c.t);
                timestamp = Date.now();
            }

            return { ...c, t: timestamp };
        });

        // Sort and validate
        processedCandles.sort((a, b) => a.t - b.t);

        const validatedCandles = processedCandles
            .map((c, idx) => validateAndSanitizeOHLC(c, idx))
            .filter((c): c is Candle => c !== null);

        const invalidCount = processedCandles.length - validatedCandles.length;
        if (invalidCount > 0) {
            console.warn(`[SimWorker] ⚠️ Filtered ${invalidCount} invalid candles`);
        }

        // Filter lunch break
        const beforeFilter = validatedCandles.length;
        this.candles = validatedCandles.filter(c => !isLunchBreak(c.t, this.marketConfig));
        const skippedCount = beforeFilter - this.candles.length;

        if (skippedCount > 0) {
            console.log(`[SimWorker] ⏭️ Skipped ${skippedCount} lunch break candles`);
        }

        console.log(`[SimWorker] ✅ Processing ${this.candles.length} simulation candles`);

        // Calculate average volume from HISTORY BUFFER for reference
        const totalVolume = historyBuffer.reduce((sum, c) => sum + c.v, 0);
        this.averageVolume = historyBuffer.length > 0 ? totalVolume / historyBuffer.length : 1;
        console.log(`[SimWorker] 📊 Average volume (from history): ${this.averageVolume.toLocaleString()}`);

        // Initialize session tracking
        this.sessionCandles = [];
        this.currentCandleIndex = 0;
        this.currentTickIndex = 0;

        if (this.candles.length > 0) {
            this.initializeAggregatedCandle();

            postMessage({
                type: 'DATA_READY',
                totalCandles: this.candles.length,
                historyCount: historyBuffer.length,
                skippedLunchBreak: skippedCount,
                interval: interval
            });

            console.log('[SimWorker] 🔥 Smart buffering initialized - Market context ready!');
        }
    }

    play(speed: number = 1) {
        if (this.candles.length === 0) {
            console.error('[SimWorker] No data loaded');
            postMessage({ type: 'ERROR', message: 'No data loaded' });
            return;
        }

        if (this.isPlaying && this.tickInterval !== null) {
            console.warn('[SimWorker] Already playing');
            return;
        }

        console.log(`[SimWorker] ▶️ Playing at ${speed}x`);
        this.playbackSpeed = speed;
        this.isPlaying = true;

        this.stopTickLoop();
        this.startTickLoop();

        postMessage({ type: 'PLAYBACK_STATE', isPlaying: true, speed: this.playbackSpeed });
    }

    pause() {
        console.log('[SimWorker] ⏸️ Paused');
        this.isPlaying = false;
        this.stopTickLoop();
        postMessage({ type: 'PLAYBACK_STATE', isPlaying: false, speed: this.playbackSpeed });
    }

    stop() {
        console.log('[SimWorker] ⏹️ Stopped');
        this.isPlaying = false;
        this.stopTickLoop();
        this.currentCandleIndex = 0;
        this.currentTickIndex = 0;
    }

    seek(candleIndex: number) {
        console.log(`[SimWorker] ⏩ Seeking to candle ${candleIndex}`);
        this.currentCandleIndex = Math.max(0, Math.min(candleIndex, this.candles.length - 1));
        this.currentTickIndex = 0;
    }

    setSpeed(speed: number) {
        console.log(`[SimWorker] ⚡ Speed: ${speed}x`);
        this.playbackSpeed = speed;

        this.stopTickLoop();
        if (this.isPlaying) {
            this.startTickLoop();
        }

        postMessage({ type: 'PLAYBACK_STATE', isPlaying: this.isPlaying, speed: this.playbackSpeed });
    }

    private initializeAggregatedCandle() {
        const candle = this.candles[this.currentCandleIndex];
        if (!candle) return;

        // 🔥 FIX A: Lock time to CURRENT candle, not next
        // This prevents timestamp jumping when worker sends updates
        const candleTime = Math.floor(candle.t / 1000);

        // 🔥 SEAMLESS TRANSITION: Check if current.open === previous.close
        // Per quant-dev.md: "Only show a gap if the data actually contains a gap"
        const prevCandle = this.currentCandleIndex > 0 ? this.candles[this.currentCandleIndex - 1] : null;
        const startPrice = candle.o;

        if (prevCandle) {
            const gapSize = Math.abs(candle.o - prevCandle.c);
            const gapPercent = (gapSize / prevCandle.c) * 100;

            // Stricter threshold: 0.001 for pixel-perfect continuity
            if (gapSize < 0.001) {
                // Perfect seamless transition
                console.log(`[SimWorker] 🔗 Seamless transition: ${prevCandle.c.toFixed(2)} → ${candle.o.toFixed(2)}`);
            } else if (gapSize < 1.0) {
                // Micro-gap (acceptable for tick size rounding)
                console.log(`[SimWorker] 📏 Micro-gap: ${prevCandle.c.toFixed(2)} → ${candle.o.toFixed(2)} (${gapSize.toFixed(3)} pts, ${gapPercent.toFixed(2)}%)`);
            } else {
                // Significant gap (market event or data quality issue)
                console.warn(`[SimWorker] ⚠️ Gap detected: ${prevCandle.c.toFixed(2)} → ${candle.o.toFixed(2)} (${gapSize.toFixed(2)} pts, ${gapPercent.toFixed(2)}%)`);

                // Track gap for metrics
                postMessage({
                    type: 'GAP_DETECTED',
                    data: {
                        candleIndex: this.currentCandleIndex,
                        prevClose: prevCandle.c,
                        currentOpen: candle.o,
                        gapSize,
                        gapPercent
                    }
                });
            }
        }

        // 🔥 FIX C: Lock open to prevent mutation during bar progression
        this.currentAggregatedCandle = {
            time: candleTime,                // Locked to current candle start
            open: startPrice,                // Locked to candle open (never changes)
            high: startPrice,
            low: startPrice,
            close: startPrice,
        };

        console.log(`[SimWorker] 🕐 Initialized candle: time=${candleTime}, open=${startPrice.toFixed(2)} (LOCKED)`);
    }

    private updateAggregatedCandle(price: number) {
        if (!this.currentAggregatedCandle) return;

        // 🔥 FIX C: Open and time are IMMUTABLE during bar progression
        // Only update high/low/close to prevent candle "jumping" or "resetting"
        this.currentAggregatedCandle.high = Math.max(this.currentAggregatedCandle.high, price);
        this.currentAggregatedCandle.low = Math.min(this.currentAggregatedCandle.low, price);
        this.currentAggregatedCandle.close = price;

        // Validate OHLC integrity (paranoid guard)
        if (price < this.currentAggregatedCandle.low || price > this.currentAggregatedCandle.high) {
            console.error(`[SimWorker] ❌  OHLC violation: price=${price}, H=${this.currentAggregatedCandle.high}, L=${this.currentAggregatedCandle.low}`);
        }
    }

    private startTickLoop() {
        const candle = this.candles[this.currentCandleIndex];
        const nextCandle = this.candles[this.currentCandleIndex + 1];

        // 🔥 FIX #7: Calculate dynamic duration with gap clamping
        let durationMs = nextCandle ? (nextCandle.t - candle.t) : 60000; // Fallback to 1m

        // Clamp to max 2x interval to handle gaps (overnight/holiday)
        const maxDuration = intervalToMs(this.currentInterval) * 2;
        if (durationMs > maxDuration) {
            console.warn(`[SimWorker] Gap detected: ${(durationMs / 60000).toFixed(0)}m, clamping to ${(maxDuration / 60000).toFixed(0)}m`);
            durationMs = maxDuration;
        }

        // Pattern analysis
        const pattern = analyzeCandle(candle);

        // 🔥 NEW: Multi-Timeframe Context Analysis (Mata Dewa)
        // Uses historyBuffer (200 candles) + sessionCandles for full market picture
        const context: MarketContext = this.historyBuffer.length > 0 ? {
            // For now: simplified context (full MTF analyzer requires import which would need restructuring)
            // TODO: Import and use analyzeMultiTimeframeContext from utils/marketContext
            currentPattern: pattern.type,
            patternBullish: pattern.isBullish,
            sessionProgress: 0.5,
            volumeVsAverage: candle.v / this.averageVolume,
            trend: 'sideways' as const,
            trendStrength: 50,
            volatility: candle.v > this.averageVolume * 1.5 ? 'high' as const :
                candle.v < this.averageVolume * 0.7 ? 'low' as const : 'medium' as const,
            isFlowAligned: true,
            noiseLevel: 0.2
        } : {
            // Fallback for legacy mode (no history buffer)
            currentPattern: pattern.type,
            patternBullish: pattern.isBullish,
            sessionProgress: 0.5,
            volumeVsAverage: 1,
            trend: 'sideways' as const,
            trendStrength: 50,
            volatility: 'medium' as const,
            isFlowAligned: true,
            noiseLevel: 0.2
        };

        // Calculate tick density with playback speed scaling
        const tickCount = calculateTickDensity(durationMs, candle.v, this.averageVolume, context.volatility, this.playbackSpeed);

        // 🎯 DETERMINISTIC: Create seeded RNG for this candle (for volume + schedule)
        const seed = candle.t + this.currentCandleIndex * 1000;
        const rng = new SeededRandom(seed);

        // Generate organic path with context-aware noise
        const pricePath = generateOrganicPath(candle, this.currentCandleIndex, pattern, context, tickCount);  // 🎯 Pass currentCandleIndex for seed
        const volumePath = distributeVolume(candle.v, tickCount, rng);  // 🎯 Pass RNG

        // Generate normalized schedule
        this.tickSchedule = generateTickSchedule(candle, nextCandle, pricePath, volumePath, durationMs, rng);  // 🎯 Pass RNG
        this.currentTickIndex = 0;

        this.candleStartTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

        console.log(`[SimWorker] ⏱️ Tick loop started: ${this.tickSchedule.length} ticks, ${(durationMs / 1000).toFixed(0)}s duration, ${this.playbackSpeed}x speed`);

        // Poll at 60 FPS
        this.tickInterval = setInterval(() => {
            this.pollTicks();
        }, 16) as any;
    }

    private stopTickLoop() {
        if (this.tickInterval !== null) {
            clearInterval(this.tickInterval);
            this.tickInterval = null;
        }
    }

    private pollTicks() {
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const elapsedTime = (now - this.candleStartTime) * this.playbackSpeed;

        // 🔥 FIX 2: Calculate adaptive throttle based on time delta
        const timeSinceLastPoll = this.lastPollTime > 0 ? now - this.lastPollTime : 16;
        this.lastPollTime = now;

        // If tab was throttled (>100ms gap), allow catch-up burst
        const wasThrottled = timeSinceLastPoll > 100;
        const maxTicksThisPoll = wasThrottled
            ? this.MAX_CATCHUP_TICKS  // Catch-up mode
            : this.BASE_TICKS_PER_POLL; // Normal mode

        let ticksFiredThisPoll = 0;
        let overdueCount = 0;

        // Count overdue ticks for backlog tracking
        for (let i = this.currentTickIndex; i < this.tickSchedule.length; i++) {
            if (this.tickSchedule[i].targetTime <= elapsedTime) {
                overdueCount++;
            } else {
                break;
            }
        }

        this.tickBacklog = overdueCount;

        while (this.currentTickIndex < this.tickSchedule.length) {
            const tick = this.tickSchedule[this.currentTickIndex];

            if (tick.targetTime > elapsedTime) {
                break; // Not yet time
            }

            // Adaptive throttle with catch-up
            if (ticksFiredThisPoll >= maxTicksThisPoll) {
                // 🔥 FIX #9: Don't increment droppedTickCount here
                // Ticks are throttled (delayed), not dropped - they'll fire in next poll

                if (wasThrottled) {
                    console.log(`[SimWorker] 🚀 Catch-up mode: processed ${ticksFiredThisPoll} ticks, ${this.tickBacklog} remaining`);
                } else {
                    console.warn(`[SimWorker] ⚠️ Tick burst throttled (backlog: ${this.tickBacklog})`);
                }
                break;
            }

            this.fireTick(tick);
            this.currentTickIndex++;
            ticksFiredThisPoll++;
            this.totalTicksProcessed++;  // 🆕 FIX 3: Track total processed
        }

        // 🔥 FIX 3: Send continuous candle updates even when ticks are throttled
        const timeSinceLastUpdate = now - this.lastCandleUpdateTime;
        if (this.currentAggregatedCandle && timeSinceLastUpdate >= this.CANDLE_UPDATE_INTERVAL) {
            this.sendCandleUpdate('continuous');
            this.lastCandleUpdateTime = now;
        }

        // 🆕 FIX 3: Report metrics periodically
        const timeSinceMetrics = now - this.lastMetricsReport;
        if (timeSinceMetrics >= this.METRICS_REPORT_INTERVAL) {
            this.reportMetrics();
            this.lastMetricsReport = now;
        }

        // Check if candle complete
        if (this.currentTickIndex >= this.tickSchedule.length) {
            this.advanceToNextCandle();
        }
    }

    private fireTick(tick: TickSchedule) {
        const candle = this.candles[this.currentCandleIndex];
        const timestamp = candle.t + tick.targetTime;

        this.updateAggregatedCandle(tick.price);

        // 🔍 DEBUG: Log first 5 ticks to check timestamp consistency
        if (tick.tickIndex < 5) {
            console.log(`[Worker] 🔍 Tick ${tick.tickIndex}: candleTime=${this.currentAggregatedCandle?.time}, price=${tick.price.toFixed(2)}, tickTime=${Math.floor(timestamp)}`);
        }

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

        // 🔥 IMPROVED: Smart candle update throttling
        // Send updates on: first tick, every 10th tick, last tick
        // Continuous updates (every 100ms) handled in pollTicks()
        const isFirstTick = tick.tickIndex === 0;
        const isLastTick = tick.tickIndex === this.tickSchedule.length - 1;
        const isBatchUpdate = tick.tickIndex % 10 === 0;

        if (this.currentAggregatedCandle && (isFirstTick || isLastTick || isBatchUpdate)) {
            this.sendCandleUpdate('tick');
        }
    }

    /**
     * Send candle update to main thread
     * Centralized method to reduce code duplication
     */
    private sendCandleUpdate(source: 'tick' | 'continuous' | 'final') {
        if (!this.currentAggregatedCandle) return;

        postMessage({
            type: 'CANDLE_UPDATE',
            candle: this.currentAggregatedCandle
        });
    }

    /**
     * 🆕 FIX 3: Report performance metrics to main thread
     */
    private reportMetrics() {
        const avgLatency = this.totalTicksProcessed > 0
            ? this.tickLatencySum / this.totalTicksProcessed
            : 0;

        postMessage({
            type: 'METRICS',
            data: {
                tickBacklog: this.tickBacklog,
                totalTicksProcessed: this.totalTicksProcessed,
                droppedTickCount: this.droppedTickCount,
                avgTickLatency: avgLatency
            }
        });
    }

    private advanceToNextCandle() {
        // 🔥 NEW: Track session candles for context analysis
        if (this.historyBuffer.length > 0) {
            this.sessionCandles.push(this.candles[this.currentCandleIndex]);
        }

        this.currentTickIndex = 0;
        this.currentCandleIndex++;

        if (this.currentCandleIndex >= this.candles.length) {
            console.log('[SimWorker] ✅ Simulation complete');
            postMessage({ type: 'COMPLETE' });
            this.stop();
            return;
        }

        this.initializeAggregatedCandle();
        this.stopTickLoop();
        this.startTickLoop();

        postMessage({ type: 'CANDLE_CHANGE', candleIndex: this.currentCandleIndex });
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
            // Support both legacy and smart buffering formats
            if (candles) {
                // Legacy format: single candles array
                engine.initData(candles);
            } else if (event.data.historyBuffer && event.data.simulationQueue) {
                // 🔥 NEW: Smart buffering format
                engine.initDataWithBuffers(
                    event.data.historyBuffer,
                    event.data.simulationQueue,
                    event.data.interval || '1m'
                );
            } else {
                console.error('[SimWorker] INIT_DATA missing required data');
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
                console.log(`[SimWorker] Calculating indicator: ${indicator.name}`);
                const data = calculateIndicator(candles, indicator);
                postMessage({
                    type: 'INDICATOR_READY',
                    indicator: indicator.name,
                    data
                });
            } else {
                console.error('[SimWorker] CALCULATE_INDICATOR missing params');
            }
            break;

        default:
            console.warn('[SimWorker] Unknown message type:', type);
    }
};

postMessage({ type: 'READY' });
console.log('[SimWorker] 🚀 Worker ready');
