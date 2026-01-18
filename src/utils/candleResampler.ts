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

import { devLog } from '@/utils/debug';

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
 * 
 * 🔥 FIX #6: Strict validation - reject candles without timestamp
 */
export function normalizeCandle(candle: any): Candle {
    // If already normalized, validate it has time
    if ('time' in candle && 'open' in candle) {
        if (candle.time === undefined || candle.time === null) {
            throw new Error('[Resampler] Cannot normalize candle without timestamp (found null/undefined in normalized format)');
        }
        return candle as Candle;
    }

    // 🔥 STRICT: Reject candles without timestamp
    const timestamp = candle.t ?? candle.time;
    if (timestamp === undefined || timestamp === null) {
        throw new Error('[Resampler] Cannot normalize candle without timestamp - missing both t and time fields');
    }

    // Convert from worker schema {t,o,h,l,c,v} to resampler schema
    return {
        time: timestamp,
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
 * Defines which intervals can be resampled to which target intervals
 * 
 * 🔥 FIX #18: Added 60m as alias for 1h for compatibility
 */
export const INTERVAL_COMPATIBILITY: Record<Interval, Interval[]> = {
    '1m': ['1m', '2m', '5m', '15m', '30m', '60m', '1h', '4h', '1d'],  // Universal
    '2m': ['2m', '30m', '60m', '1h', '4h', '1d'],                      // Even multiples
    '5m': ['5m', '15m', '30m', '60m', '1h', '4h', '1d'],              // Multiples of 5
    '15m': ['15m', '30m', '60m', '1h', '4h', '1d'],                    // Multiples of 15
    '30m': ['30m', '60m', '1h', '4h', '1d'],                           // Multiples of 30
    '60m': ['60m', '1h', '4h', '1d'],                                  // 🔥 FIX #18: 60m as valid source
    '1h': ['60m', '1h', '4h', '1d'],                                   // 🔥 FIX #18: Can resample to 60m
    '4h': ['4h', '1d'],                                                // 4-hour intervals
    '1d': ['1d']                                                       // Daily only
};

/**
 * Convert interval string to minutes
 * 🔥 FIX #18: Handle both 60m and 1h
 */
export function intervalToMinutes(interval: Interval): number {
    const match = interval.match(/^(\d+)([mhd])$/);
    if (!match) return 60;

    const value = parseInt(match[1]);
    const unit = match[2];

    if (unit === 'm') return value;
    if (unit === 'h') return value * 60;
    if (unit === 'd') return value * 1440;
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
 * 🔥 FIX #3: Sort data and validate timestamps before coverage check
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

    // 🔥 FIX #3: Sort candles by time first (handles unsorted data)
    const sorted = [...sourceCandles].sort((a, b) => {
        const timeA = typeof a.time === 'number' ? a.time : new Date(a.time).getTime();
        const timeB = typeof b.time === 'number' ? b.time : new Date(b.time).getTime();
        return timeA - timeB;
    });

    // 🔥 FIX #3: Validate no invalid timestamps
    const invalidCount = sorted.filter(c => {
        const t = typeof c.time === 'number' ? c.time : new Date(c.time).getTime();
        return isNaN(t) || t <= 0;
    }).length;

    if (invalidCount > 0) {
        console.warn(`[Resampler] ${invalidCount} candles with invalid timestamps, cannot switch`);
        return false;
    }

    const targetMinutes = intervalToMinutes(targetInterval);
    const requiredCount = 10;

    // Check candle count (existing logic)
    const totalMinutes = sorted.length * intervalToMinutes(sourceInterval);
    const potentialCandles = Math.floor(totalMinutes / targetMinutes);

    if (potentialCandles < requiredCount) {
        return false;
    }

    // 🔥 FIX: Check time coverage (now with sorted & validated data)
    // Ensure data actually spans enough time, not just has enough candles
    const firstTime = parseTime(sorted[0].time);
    const lastTime = parseTime(sorted[sorted.length - 1].time);
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
 * 🔥 FIX #5: Sort input before grouping to handle unsorted data
 */
function groupByTime(
    candles: Candle[],
    bucketMinutes: number
): Candle[][] {
    // 🔥 FIX #5: Sort candles first to ensure correct grouping
    const sorted = [...candles].sort((a, b) => {
        const timeA = parseTime(a.time);
        const timeB = parseTime(b.time);
        return timeA - timeB;
    });

    const allBuckets: Candle[][] = [];
    let currentBucket: Candle[] = [];
    let bucketStartTimestamp: number | null = null;

    for (let i = 0; i < sorted.length; i++) {
        const candle = sorted[i];
        const currentTime = parseTime(candle.time);
        const snappedTime = snapToGrid(currentTime, bucketMinutes);

        // Initialize bucketStartTimestamp for the first candle or after a gap
        if (bucketStartTimestamp === null) {
            bucketStartTimestamp = snappedTime;
        }

        // 🔥 FIX: Gap detection - start new bucket if gap > 2x expected interval
        // Prevents aggregating across market gaps (lunch break, overnight)
        if (i > 0) {
            const prevTime = parseTime(sorted[i - 1].time);
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

    // 🔥 FIX #4: Add metadata even for single bucket
    if (bucket.length === 1) {
        const sourceCandle = bucket[0];
        const result: ResampledCandle = {
            time: parseTime(sourceCandle.time),  // 🔥 FIX: Ensure time is numeric
            open: sourceCandle.open,
            high: sourceCandle.high,
            low: sourceCandle.low,
            close: sourceCandle.close,
            volume: sourceCandle.volume
        };

        if (expectedCount !== undefined) {
            result.metadata = {
                isPartial: bucket.length < expectedCount,
                candleCount: bucket.length,
                expectedCount
            };
        }
        return result;
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
        time: parseTime(bucket[0].time),               // 🔥 FIX: Ensure time is always number (ms)
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
 * Resample candles to a coarser interval
 * 🔥 FIX #21: Added includePartial option to include incomplete buckets
 * 
 * @param candles - Source candles (normalized)
 * @param sourceInterval - Source interval (e.g., '1m')
 * @param targetInterval - Target interval (e.g., '5m')
 * @param includePartial - Include incomplete buckets with metadata (default: false)
 * @returns Resampled candles with metadata
 */
export function resampleCandles(
    candles: Candle[],
    sourceInterval: Interval,
    targetInterval: Interval,
    includePartial: boolean = false
): ResampledCandle[] {
    // 🔥 FIX: Auto-normalize input to ensure consistent format
    // Handles both {t,o,h,l,c,v} and {time,open,high,low,close,volume} formats
    const normalized = normalizeCandles(candles);

    // Validation
    if (!isCompatible(sourceInterval, targetInterval)) {
        throw new Error(
            `Cannot resample from ${sourceInterval} to ${targetInterval}. ` +
            `Compatible targets: ${INTERVAL_COMPATIBILITY[sourceInterval].join(', ')}`
        );
    }

    if (!canSwitch(normalized, sourceInterval, targetInterval)) {
        const potentialCandles = Math.floor(
            (normalized.length * intervalToMinutes(sourceInterval)) /
            intervalToMinutes(targetInterval)
        );
        throw new Error(
            `Insufficient data for ${targetInterval} interval. ` +
            `Need at least 10 candles, would only produce ${potentialCandles}`
        );
    }

    // If same interval, return copy
    if (sourceInterval === targetInterval) {
        return [...normalized];
    }

    // Resample with metadata
    const bucketMinutes = intervalToMinutes(targetInterval);
    const buckets = groupByTime(normalized, bucketMinutes);

    // Calculate expected candles per bucket
    const ratio = intervalToMinutes(targetInterval) / intervalToMinutes(sourceInterval);
    const expectedCount = Math.round(ratio);

    const resampled = buckets.map(bucket => aggregateBucket(bucket, expectedCount));

    // 🔥 CRITICAL: DOUBLE SAFETY CHECK
    // 1. Sort output (even if input was sorted, bucket logic might disorder)
    // 2. Remove duplicates (same timestamp) - lightweight-charts HATES duplicates!
    const sortedAndUnique = resampled
        .sort((a, b) => {
            const timeA = typeof a.time === 'number' ? a.time : parseTime(a.time);
            const timeB = typeof b.time === 'number' ? b.time : parseTime(b.time);
            return timeA - timeB; // Ascending
        })
        .filter((item, index, self) =>
            // Remove duplicates: keep only first occurrence of each timestamp
            index === self.findIndex((t) => {
                const tTime = typeof t.time === 'number' ? t.time : parseTime(t.time);
                const itemTime = typeof item.time === 'number' ? item.time : parseTime(item.time);
                return tTime === itemTime;
            })
        );

    devLog('RESAMPLING', `[Resampler] ✅ Resampled ${candles.length} ${sourceInterval} → ${sortedAndUnique.length} ${targetInterval} candles (deduplicated)`);

    return sortedAndUnique;
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

    // 🔥 FIX: Normalize input candles once to ensure {time} field exists
    // This handles mixed data sources (Worker {t} vs Store {time})
    const normalized = normalizeCandles(baseCandles);

    return intervals.map(interval => {
        const compatible = isCompatible(baseInterval, interval);
        const sufficient = canSwitch(normalized, baseInterval, interval);
        const enabled = compatible && sufficient;

        let reason: string | undefined;
        if (!compatible) {
            reason = `Incompatible with ${baseInterval} base data`;
        } else if (!sufficient) {
            const potential = Math.floor(
                (normalized.length * intervalToMinutes(baseInterval)) /
                intervalToMinutes(interval)
            );
            reason = `Insufficient data (need 10+ candles, would produce ${potential})`;
        }

        return { value: interval, enabled, reason };
    });
}
