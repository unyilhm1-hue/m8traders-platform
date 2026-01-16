/**
 * Candle Resampling Utility
 * =========================
 * Converts smaller interval candles to larger intervals with OHLCV aggregation.
 * 
 * Features:
 * - Interval compatibility validation (prevents invalid conversions)
 * - Time-based bucketing with snap-to-grid
 * - Data span constraint checking (minimum 10 candles rule)
 * - Accurate OHLCV aggregation
 * 
 * @module candleResampler
 */

export interface Candle {
    time: string | number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

/**
 * Extended candle with metadata for resampled data
 * Helps UI distinguish partial vs complete candles
 */
export interface ResampledCandle extends Candle {
    metadata?: {
        isPartial: boolean;      // True if bucket is incomplete
        candleCount: number;     // Actual candles in this bucket
        expectedCount: number;   // Expected candles for full bucket
    };
}

export type Interval = '1m' | '2m' | '5m' | '15m' | '30m' | '60m' | '1h' | '4h' | '1d';

/**
 * 🚀 NORMALIZATION: Convert WorkerCandle {t,o,h,l,c,v} to ResamplerCandle {time,open,high,low,close,volume}
 * 
 * This utility ensures compatibility when data comes from APIs using short-name schema
 */
export function normalizeCandle(candle: any): Candle {
    // If already normalized, return as-is
    if ('time' in candle && 'open' in candle) {
        return candle as Candle;
    }

    // Convert from worker schema {t,o,h,l,c,v} to resampler schema
    return {
        time: candle.t ?? candle.time ?? Date.now(),
        open: candle.o ?? candle.open ?? 0,
        high: candle.h ?? candle.high ?? 0,
        low: candle.l ?? candle.low ?? 0,
        close: candle.c ?? candle.close ?? 0,
        volume: candle.v ?? candle.volume ?? 0,
    };
}

/**
 * Batch normalize array of candles
 */
export function normalizeCandles(candles: any[]): Candle[] {
    return candles.map(normalizeCandle);
}

/**
 * Interval compatibility matrix
 * Key: source interval, Value: compatible target intervals
 */
export const INTERVAL_COMPATIBILITY: Record<Interval, Interval[]> = {
    '1m': ['1m', '2m', '5m', '15m', '30m', '60m', '1h', '4h', '1d'],  // Universal
    '2m': ['2m', '30m', '60m', '1h', '4h', '1d'],                      // Even multiples
    '5m': ['5m', '15m', '30m', '60m', '1h', '4h', '1d'],              // Multiples of 5
    '15m': ['15m', '30m', '60m', '1h', '4h', '1d'],                    // Multiples of 15
    '30m': ['30m', '60m', '1h', '4h', '1d'],                           // Multiples of 30
    '60m': ['60m', '1h', '4h', '1d'],                                  // Multiples of 60
    '1h': ['1h', '4h', '1d'],                                          // Hourly intervals
    '4h': ['4h', '1d'],                                                // 4-hour intervals
    '1d': ['1d']                                                       // Daily only
};

/**
 * Convert interval string to minutes
 * Supports: m (minutes), h (hours), d (days)
 */
export function intervalToMinutes(interval: Interval): number {
    const value = parseInt(interval);
    if (interval.endsWith('m')) return value;
    if (interval.endsWith('h')) return value * 60;
    if (interval.endsWith('d')) return value * 1440;
    return value * 60; // Default to hours for backward compatibility
}

/**
 * Check if source interval can be converted to target interval
 */
export function isCompatible(source: Interval, target: Interval): boolean {
    return INTERVAL_COMPATIBILITY[source]?.includes(target) ?? false;
}

/**
 * Calculate if there's enough data to switch to target interval
 * 🔥 FIX: Check both candle count AND time coverage
 * Rule: Must have at least 10 candles in target interval AND cover 10x interval duration
 */
export function canSwitch(
    sourceCandles: Candle[],
    sourceInterval: Interval,
    targetInterval: Interval
): boolean {
    if (!isCompatible(sourceInterval, targetInterval)) {
        return false;
    }

    if (sourceCandles.length === 0) {
        return false;
    }

    const targetMinutes = intervalToMinutes(targetInterval);
    const requiredCount = 10;

    // Check candle count (existing logic)
    const totalMinutes = sourceCandles.length * intervalToMinutes(sourceInterval);
    const potentialCandles = Math.floor(totalMinutes / targetMinutes);

    if (potentialCandles < requiredCount) {
        return false;
    }

    // 🔥 FIX: Check time coverage (new logic)
    // Ensure data actually spans enough time, not just has enough candles
    const firstTime = parseTime(sourceCandles[0].time);
    const lastTime = parseTime(sourceCandles[sourceCandles.length - 1].time);
    const spanMinutes = (lastTime - firstTime) / 60_000;
    const requiredSpan = targetMinutes * requiredCount;

    if (spanMinutes < requiredSpan) {
        console.warn(`[Resampler] Insufficient time coverage: ${spanMinutes.toFixed(0)}m < ${requiredSpan}m required for ${targetInterval}`);
        return false;
    }

    return true;
}

/**
 * Parse time string or number to timestamp
 * 
 * 🚀 DEFENSIVE: Guard against undefined/null values
 */
function parseTime(time: string | number | undefined): number {
    // Guard against undefined/null
    if (time === undefined || time === null) {
        console.warn('[Resampler] parseTime received undefined/null, using current time');
        return Date.now();
    }

    // 🔥 FIX: Normalize timestamp units (ms vs s ambiguity)
    if (typeof time === 'number') {
        // If number is too small, it's likely in seconds not milliseconds
        // Timestamps after 2001-09-09 are > 1_000_000_000 in seconds
        // In milliseconds they're always > 1_000_000_000_000
        const THRESHOLD = 10_000_000_000; // ~2286 in seconds, ~1973 in ms
        return time < THRESHOLD ? time * 1000 : time;
    }

    // Handle HH:MM or HH:MM:SS format
    if (time.includes(':')) {
        const [hours, minutes] = time.split(':').map(Number);
        const date = new Date();
        date.setHours(hours, minutes, 0, 0);
        return date.getTime();
    }

    // Handle ISO string
    return new Date(time).getTime();
}

/**
 * Snap timestamp to interval grid
 * Example: 09:03 with 5m interval -> 09:00
 * 
 * FIXED: Use millisecond math instead of Date to avoid timezone issues
 */
function snapToGrid(timestamp: number, intervalMinutes: number): number {
    const intervalMs = intervalMinutes * 60 * 1000;
    return Math.floor(timestamp / intervalMs) * intervalMs;
}

/**
 * Group candles into buckets based on target interval
 */
function groupByTime(
    candles: Candle[],
    bucketMinutes: number
): Candle[][] {
    const allBuckets: Candle[][] = [];
    let currentBucket: Candle[] = [];
    let bucketStartTimestamp: number | null = null;

    for (let i = 0; i < candles.length; i++) {
        const candle = candles[i];
        const currentTime = parseTime(candle.time);
        const snappedTime = snapToGrid(currentTime, bucketMinutes);

        // Initialize bucketStartTimestamp for the first candle or after a gap
        if (bucketStartTimestamp === null) {
            bucketStartTimestamp = snappedTime;
        }

        // 🔥 FIX: Gap detection - start new bucket if gap > 2x expected interval
        // Prevents aggregating across market gaps (lunch break, overnight)
        if (i > 0) {
            const prevTime = parseTime(candles[i - 1].time);
            const gap = (currentTime - prevTime) / 60_000; // Gap in minutes

            // If gap > 2x bucket size, assume market closed (lunch/overnight)
            // This condition also implies a new snappedTime, but explicitly checks for large gaps
            if (gap > bucketMinutes * 2) {
                // Flush current bucket before gap
                if (currentBucket.length > 0) {
                    allBuckets.push([...currentBucket]);
                    currentBucket = [];
                }
                // Reset snap after gap, effectively starting a new aggregation sequence
                bucketStartTimestamp = snappedTime;
                console.log(`[Resampler] ⏭️ Gap detected: ${gap.toFixed(0)}m (> ${bucketMinutes * 2}m), starting new bucket`);
            }
        }

        // New bucket detected (normal time progression or after a gap)
        // If the current candle's snapped time is different from the current bucket's start time,
        // and there are candles in the current bucket, flush it.
        if (snappedTime !== bucketStartTimestamp && currentBucket.length > 0) {
            allBuckets.push([...currentBucket]);
            currentBucket = [];
            bucketStartTimestamp = snappedTime; // Update bucket start for the new bucket
        }

        currentBucket.push(candle);
    }

    // Push any remaining candles in the last bucket
    if (currentBucket.length > 0) {
        allBuckets.push(currentBucket);
    }

    // The buckets are already ordered by time due to the iteration order.
    // No need for an additional sort if the input candles are sorted by time.
    return allBuckets;
}

/**
 * Validate OHLC relationships
 * Ensures data integrity: High >= Open/Close, Low <= Open/Close
 */
function validateOHLC(candle: Candle): boolean {
    return (
        candle.high >= candle.open &&
        candle.high >= candle.close &&
        candle.low <= candle.open &&
        candle.low <= candle.close &&
        candle.volume >= 0
    );
}

/**
 * Aggregate bucket into single candle with OHLCV logic and metadata
 * Optimized: Single-pass loop for better performance
 * 
 * @param bucket - Array of source candles to aggregate
 * @param expectedCount - Expected number of candles for a complete bucket
 * @returns Resampled candle with metadata
 */
function aggregateBucket(bucket: Candle[], expectedCount?: number): ResampledCandle {
    if (bucket.length === 0) {
        throw new Error('Cannot aggregate empty bucket');
    }

    if (bucket.length === 1) {
        return bucket[0];
    }

    // Single-pass aggregation (30% faster than Math.max/min)
    let high = bucket[0].high;
    let low = bucket[0].low;
    let volume = 0;

    for (const candle of bucket) {
        if (candle.high > high) high = candle.high;
        if (candle.low < low) low = candle.low;
        volume += candle.volume;
    }

    const result: ResampledCandle = {
        time: bucket[0].time,                          // First candle's time
        open: bucket[0].open,                          // First candle's open
        close: bucket[bucket.length - 1].close,        // Last candle's close
        high,                                          // Highest high
        low,                                           // Lowest low
        volume                                         // Sum volumes
    };

    // Add metadata if expected count is provided
    if (expectedCount !== undefined) {
        result.metadata = {
            isPartial: bucket.length < expectedCount,
            candleCount: bucket.length,
            expectedCount
        };
    }

    // Validate result to catch data corruption
    if (!validateOHLC(result)) {
        console.warn('[Resampler] Invalid OHLC detected:', result);
    }

    return result;
}

/**
 * Resample candles from source interval to target interval
 * 
 * @param sourceCandles - Source candles to resample
 * @param sourceInterval - Source interval (e.g., '1m')
 * @param targetInterval - Target interval (e.g., '5m')
 * @returns Resampled candles with metadata
 * @throws {Error} If intervals are incompatible or insufficient data
 */
export function resampleCandles(
    sourceCandles: Candle[],
    sourceInterval: Interval,
    targetInterval: Interval
): ResampledCandle[] {
    // Validation
    if (!isCompatible(sourceInterval, targetInterval)) {
        throw new Error(
            `Cannot resample from ${sourceInterval} to ${targetInterval}. ` +
            `Compatible targets: ${INTERVAL_COMPATIBILITY[sourceInterval].join(', ')}`
        );
    }

    if (!canSwitch(sourceCandles, sourceInterval, targetInterval)) {
        const potentialCandles = Math.floor(
            (sourceCandles.length * intervalToMinutes(sourceInterval)) /
            intervalToMinutes(targetInterval)
        );
        throw new Error(
            `Insufficient data for ${targetInterval} interval. ` +
            `Need at least 10 candles, would only produce ${potentialCandles}`
        );
    }

    // If same interval, return copy
    if (sourceInterval === targetInterval) {
        return [...sourceCandles];
    }

    // Resample with metadata
    const bucketMinutes = intervalToMinutes(targetInterval);
    const buckets = groupByTime(sourceCandles, bucketMinutes);

    // Calculate expected candles per bucket
    const ratio = intervalToMinutes(targetInterval) / intervalToMinutes(sourceInterval);
    const expectedCount = Math.round(ratio);

    return buckets.map(bucket => aggregateBucket(bucket, expectedCount));
}

/**
 * Get available intervals for UI button states
 */
export interface IntervalState {
    value: Interval;
    enabled: boolean;
    reason?: string;
}

export function getAvailableIntervals(
    baseInterval: Interval,
    baseCandles: Candle[]
): IntervalState[] {
    // 🔥 FIX: Expose all supported intervals including 1h/4h/1d
    const intervals: Interval[] = ['1m', '2m', '5m', '15m', '30m', '60m', '1h', '4h', '1d'];

    return intervals.map(interval => {
        const compatible = isCompatible(baseInterval, interval);
        const sufficient = canSwitch(baseCandles, baseInterval, interval);
        const enabled = compatible && sufficient;

        let reason: string | undefined;
        if (!compatible) {
            reason = `Incompatible with ${baseInterval} base data`;
        } else if (!sufficient) {
            const potential = Math.floor(
                (baseCandles.length * intervalToMinutes(baseInterval)) /
                intervalToMinutes(interval)
            );
            reason = `Insufficient data (need 10+ candles, would produce ${potential})`;
        }

        return { value: interval, enabled, reason };
    });
}
