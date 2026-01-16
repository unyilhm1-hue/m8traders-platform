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

export type Interval = '1m' | '2m' | '5m' | '15m' | '30m' | '60m';

/**
 * Interval compatibility matrix
 * Key: source interval, Value: compatible target intervals
 */
export const INTERVAL_COMPATIBILITY: Record<Interval, Interval[]> = {
    '1m': ['1m', '2m', '5m', '15m', '30m', '60m'],  // Universal
    '2m': ['2m', '30m', '60m'],                      // Even multiples only
    '5m': ['5m', '15m', '30m', '60m'],              // Multiples of 5
    '15m': ['15m', '30m', '60m'],                    // Multiples of 15
    '30m': ['30m', '60m'],                           // Multiples of 30
    '60m': ['60m']                                   // Self only
};

/**
 * Convert interval string to minutes
 */
export function intervalToMinutes(interval: Interval): number {
    const value = parseInt(interval);
    return interval.endsWith('m') ? value : value * 60;
}

/**
 * Check if source interval can be converted to target interval
 */
export function isCompatible(source: Interval, target: Interval): boolean {
    return INTERVAL_COMPATIBILITY[source]?.includes(target) ?? false;
}

/**
 * Calculate if there's enough data to switch to target interval
 * Rule: Must have at least 10 candles in target interval
 */
export function canSwitch(
    sourceCandles: Candle[],
    sourceInterval: Interval,
    targetInterval: Interval
): boolean {
    if (!isCompatible(sourceInterval, targetInterval)) {
        return false;
    }

    const totalMinutes = sourceCandles.length * intervalToMinutes(sourceInterval);
    const targetMinutes = intervalToMinutes(targetInterval);
    const potentialCandles = Math.floor(totalMinutes / targetMinutes);

    return potentialCandles >= 10;
}

/**
 * Parse time string or number to timestamp
 */
function parseTime(time: string | number): number {
    if (typeof time === 'number') return time;

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
    const buckets = new Map<number, Candle[]>();

    for (const candle of candles) {
        const timestamp = parseTime(candle.time);
        const bucketKey = snapToGrid(timestamp, bucketMinutes);

        if (!buckets.has(bucketKey)) {
            buckets.set(bucketKey, []);
        }
        buckets.get(bucketKey)!.push(candle);
    }

    // Sort buckets by time
    return Array.from(buckets.entries())
        .sort(([a], [b]) => a - b)
        .map(([, candles]) => candles);
}

/**
 * Aggregate bucket into single candle with OHLCV logic
 */
function aggregateBucket(bucket: Candle[]): Candle {
    if (bucket.length === 0) {
        throw new Error('Cannot aggregate empty bucket');
    }

    if (bucket.length === 1) {
        return bucket[0];
    }

    return {
        time: bucket[0].time,                          // First candle's time
        open: bucket[0].open,                          // First candle's open
        close: bucket[bucket.length - 1].close,        // Last candle's close
        high: Math.max(...bucket.map(c => c.high)),    // Highest high
        low: Math.min(...bucket.map(c => c.low)),      // Lowest low
        volume: bucket.reduce((sum, c) => sum + c.volume, 0)  // Sum volumes
    };
}

/**
 * Resample candles from source interval to target interval
 * 
 * @throws {Error} If intervals are incompatible or insufficient data
 */
export function resampleCandles(
    sourceCandles: Candle[],
    sourceInterval: Interval,
    targetInterval: Interval
): Candle[] {
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

    // Resample
    const bucketMinutes = intervalToMinutes(targetInterval);
    const buckets = groupByTime(sourceCandles, bucketMinutes);

    return buckets.map(aggregateBucket);
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
    const intervals: Interval[] = ['1m', '2m', '5m', '15m', '30m', '60m'];

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
