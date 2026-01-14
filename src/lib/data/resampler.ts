/**
 * Resampler
 * Converts 1m candle data to higher timeframes (5m, 15m, 1h, etc.)
 */

import type { Candle, Timeframe } from '@/types';

/**
 * Resample 1m candles to target timeframe
 */
export function resample(candles1m: Candle[], targetTimeframe: Timeframe): Candle[] {
    if (candles1m.length === 0) {
        return [];
    }

    // If already at target timeframe, return as-is
    if (targetTimeframe === '1m') {
        return candles1m;
    }

    const intervalMs = getIntervalMs(targetTimeframe);
    const resampled: Candle[] = [];

    let currentGroup: Candle[] = [];
    let groupStartTime = Math.floor(candles1m[0].t / intervalMs) * intervalMs;

    for (const candle of candles1m) {
        const candleGroupStart = Math.floor(candle.t / intervalMs) * intervalMs;

        // If candle belongs to new group, process current group
        if (candleGroupStart !== groupStartTime) {
            if (currentGroup.length > 0) {
                resampled.push(aggregateCandles(currentGroup, groupStartTime));
            }
            currentGroup = [];
            groupStartTime = candleGroupStart;
        }

        currentGroup.push(candle);
    }

    // Process last group
    if (currentGroup.length > 0) {
        resampled.push(aggregateCandles(currentGroup, groupStartTime));
    }

    return resampled;
}

/**
 * Aggregate multiple 1m candles into a single candle
 */
function aggregateCandles(candles: Candle[], timestamp: number): Candle {
    return {
        t: timestamp,
        o: candles[0].o,                                    // Open  = first candle's open
        h: Math.max(...candles.map((c) => c.h)),            // High = max high
        l: Math.min(...candles.map((c) => c.l)),            // Low = min low
        c: candles[candles.length - 1].c,                   // Close = last candle's close
        v: candles.reduce((sum, c) => sum + c.v, 0),        // Volume = sum of all volumes
    };
}

/**
 * Get interval in milliseconds for timeframe
 */
function getIntervalMs(timeframe: Timeframe): number {
    const intervals: Record<Timeframe, number> = {
        '1m': 60 * 1000,
        '5m': 5 * 60 * 1000,
        '15m': 15 * 60 * 1000,
        '30m': 30 * 60 * 1000,
        '1h': 60 * 60 * 1000,
        '4h': 4 * 60 * 60 * 1000,
        '1d': 24 * 60 * 60 * 1000,
        '1w': 7 * 24 * 60 * 60 * 1000,
    };

    return intervals[timeframe] || 60 * 1000;
}

/**
 * Validate resampling result
 */
export function validateResample(
    original: Candle[],
    resampled: Candle[],
    targetTimeframe: Timeframe
): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check that resampled has fewer or equal candles
    if (resampled.length > original.length) {
        issues.push('Resampled data has more candles than original');
    }

    // Check timestamp alignment
    const intervalMs = getIntervalMs(targetTimeframe);
    for (const candle of resampled) {
        if (candle.t % intervalMs !== 0) {
            issues.push(`Candle timestamp ${candle.t} not aligned to ${targetTimeframe} interval`);
            break;
        }
    }

    // Check OHLC logic
    for (const candle of resampled) {
        if (candle.h < candle.o || candle.h < candle.c) {
            issues.push('High price is less than open or close');
            break;
        }
        if (candle.l > candle.o || candle.l > candle.c) {
            issues.push('Low price is greater than open or close');
            break;
        }
    }

    return {
        valid: issues.length === 0,
        issues,
    };
}

/**
 * Estimate candle count after resampling
 */
export function estimateResampledCount(
    originalCount: number,
    fromTimeframe: Timeframe,
    toTimeframe: Timeframe
): number {
    const fromMs = getIntervalMs(fromTimeframe);
    const toMs = getIntervalMs(toTimeframe);
    const ratio = toMs / fromMs;
    return Math.ceil(originalCount / ratio);
}
