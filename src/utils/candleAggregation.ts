/**
 * Candle Aggregation Utilities
 * Aggregates fine-grained candles (e.g., 1m) into larger intervals (e.g., 5m)
 * 
 * @see types/intervals.ts for interval definitions
 */

import type { IntervalType } from '@/types/intervals';
import { getIntervalMultiplier } from '@/types/intervals';

export interface Candle {
    t: number; // timestamp (milliseconds)
    o: number; // open
    h: number; // high
    l: number; // low
    c: number; // close
    v: number; // volume
}

/**
 * Aggregate multiple candles into a single larger-interval candle
 * 
 * Rules:
 * - Open: First candle's open
 * - High: Maximum of all highs
 * - Low: Minimum of all lows
 * - Close: Last candle's close
 * - Volume: Sum of all volumes
 * - Timestamp: First candle's timestamp
 * 
 * @example
 * // Aggregate 5x 1m candles → 1x 5m candle
 * const fiveMinCandle = aggregateGroup([candle1m_1, candle1m_2, ...candle1m_5])
 */
export function aggregateGroup(candles: Candle[]): Candle {
    if (candles.length === 0) {
        throw new Error('[Aggregation] Cannot aggregate empty array');
    }

    if (candles.length === 1) {
        return candles[0];
    }

    return {
        t: candles[0].t,                                    // First timestamp
        o: candles[0].o,                                    // First open
        h: Math.max(...candles.map(c => c.h)),             // Max high
        l: Math.min(...candles.map(c => c.l)),             // Min low
        c: candles[candles.length - 1].c,                  // Last close
        v: candles.reduce((sum, c) => sum + c.v, 0)        // Sum volume
    };
}

/**
 * Aggregate array of candles from source interval to target interval
 * 
 * Market Psychology:
 * - Aggregation preserves price action "story" (OHLC integrity)
 * - Volume accumulation shows true market participation
 * - Timestamp alignment maintains temporal accuracy
 * 
 * @example
 * // 300x 1m candles → 60x 5m candles
 * const candles5m = aggregateCandles(candles1m, '1m', '5m')
 */
export function aggregateCandles(
    candles: Candle[],
    sourceInterval: IntervalType,
    targetInterval: IntervalType
): Candle[] {
    // No aggregation needed if same interval
    if (sourceInterval === targetInterval) {
        return candles;
    }

    // Get multiplier (how many source candles per target candle)
    const multiplier = getIntervalMultiplier(sourceInterval, targetInterval);

    if (multiplier === null) {
        throw new Error(
            `[Aggregation] Cannot convert ${sourceInterval} to ${targetInterval} (downscaling not supported)`
        );
    }

    const aggregated: Candle[] = [];

    // Group candles by target interval window
    for (let i = 0; i < candles.length; i += multiplier) {
        const group = candles.slice(i, i + multiplier);

        // Skip incomplete groups (e.g., last 3 candles when multiplier = 5)
        if (group.length < multiplier) {
            console.warn(
                `[Aggregation] Skipping incomplete group: ${group.length}/${multiplier} candles at index ${i}`
            );
            break;
        }

        aggregated.push(aggregateGroup(group));
    }

    console.log(
        `[Aggregation] ${sourceInterval} → ${targetInterval}: ${candles.length} → ${aggregated.length} candles (${multiplier}x aggregate)`
    );

    return aggregated;
}

/**
 * Validate candles are compatible for aggregation
 * Checks for:
 * - Consistent time intervals
 * - Chronological order
 * - No gaps
 */
export function validateCandlesForAggregation(
    candles: Candle[],
    expectedInterval: IntervalType
): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (candles.length < 2) {
        return { valid: true, errors: [] }; // No validation needed for single candle
    }

    // Import interval metadata
    const { intervalToSeconds } = require('@/types/intervals');
    const expectedDuration = intervalToSeconds(expectedInterval) * 1000; // Convert to ms

    // Check chronological order and intervals
    for (let i = 1; i < candles.length; i++) {
        const prev = candles[i - 1];
        const curr = candles[i];

        // Check order
        if (curr.t <= prev.t) {
            errors.push(`Candle ${i} not in chronological order: ${prev.t} → ${curr.t}`);
        }

        // Check interval consistency (allow 10% tolerance for market gaps)
        const actualDuration = curr.t - prev.t;
        const tolerance = expectedDuration * 0.1;

        if (Math.abs(actualDuration - expectedDuration) > tolerance) {
            const actualMinutes = Math.floor(actualDuration / 60000);
            const expectedMinutes = Math.floor(expectedDuration / 60000);
            errors.push(
                `Candle ${i} interval mismatch: expected ~${expectedMinutes}m, got ${actualMinutes}m`
            );
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}
