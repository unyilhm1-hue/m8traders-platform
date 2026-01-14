import type { Candle, Timeframe } from '@/types';
import { getTimeframeDuration } from './tickTiming';

/**
 * Result of time jump search
 */
export interface JumpTarget {
    candleIndex: number;
    tickIndex: number; // position within candle (0-based)
    candle: Candle;
    exactMatch: boolean; // true if timestamp exactly matches candle start
}

/**
 * Find candle and tick position for given timestamp
 * Uses binary search for O(log n) performance
 *
 * @param data - Array of candles
 * @param targetTimestamp - Target timestamp to jump to
 * @param timeframe - Chart timeframe
 * @param numTicks - Number of ticks per candle
 * @returns Jump target or null if not found
 */
export function findJumpTarget(
    data: Candle[],
    targetTimestamp: number,
    timeframe: Timeframe,
    numTicks = 20
): JumpTarget | null {
    if (data.length === 0) return null;

    const candleDuration = getTimeframeDuration(timeframe);

    // 1. Binary search for candle that contains this timestamp
    let left = 0;
    let right = data.length - 1;
    let candleIndex = -1;

    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const candle = data[mid];
        const candleEnd = candle.t + candleDuration;

        if (targetTimestamp >= candle.t && targetTimestamp < candleEnd) {
            // Found the candle
            candleIndex = mid;
            break;
        } else if (targetTimestamp < candle.t) {
            right = mid - 1;
        } else {
            left = mid + 1;
        }
    }

    // If not found within any candle, find nearest
    if (candleIndex === -1) {
        // Target before first candle
        if (targetTimestamp < data[0].t) {
            candleIndex = 0;
        }
        // Target after last candle
        else if (targetTimestamp >= data[data.length - 1].t + candleDuration) {
            candleIndex = data.length - 1;
        }
        // Target between candles (gap) - find nearest
        else {
            candleIndex = left < data.length ? left : right;
        }
    }

    const candle = data[candleIndex];

    // 2. Calculate tick position within candle
    const elapsedInCandle = targetTimestamp - candle.t;
    const progress = Math.max(0, Math.min(1, elapsedInCandle / candleDuration));
    const tickIndex = Math.floor(progress * numTicks);

    // Exact match if timestamp equals candle start
    const exactMatch = targetTimestamp === candle.t;

    return {
        candleIndex,
        tickIndex: Math.max(0, Math.min(tickIndex, numTicks - 1)),
        candle,
        exactMatch,
    };
}

/**
 * Jump to nearest candle by index
 *
 * @param data - Array of candles
 * @param targetIndex - Target candle index
 * @returns Jump target
 */
export function jumpToIndex(
    data: Candle[],
    targetIndex: number,
    tickIndex = 0,
    numTicks = 20
): JumpTarget | null {
    if (data.length === 0) return null;

    const candleIndex = Math.max(0, Math.min(targetIndex, data.length - 1));
    const candle = data[candleIndex];

    return {
        candleIndex,
        tickIndex: Math.max(0, Math.min(tickIndex, numTicks - 1)),
        candle,
        exactMatch: true,
    };
}
