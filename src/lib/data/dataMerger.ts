/**
 * Data Merger
 * Combines multiple batch windows and handles deduplication
 */

import type { Candle } from '@/types';
import type { BatchRecord } from '@/types/storage';

/**
 * Merge multiple batches into a single sorted array
 * Handles deduplication at window boundaries
 */
export function mergeBatches(batches: BatchRecord[]): Candle[] {
    if (batches.length === 0) {
        return [];
    }

    if (batches.length === 1) {
        return batches[0].data;
    }

    // Sort batches by start time
    const sortedBatches = [...batches].sort((a, b) => a.startTime - b.startTime);

    // Combine all candles
    const allCandles: Candle[] = [];
    sortedBatches.forEach((batch) => {
        allCandles.push(...batch.data);
    });

    // Deduplicate and sort
    return deduplicateCandles(allCandles);
}

/**
 * Remove duplicate candles based on timestamp
 * Keeps the first occurrence
 */
export function deduplicateCandles(candles: Candle[]): Candle[] {
    const seen = new Set<number>();
    const unique: Candle[] = [];

    for (const candle of candles) {
        if (!seen.has(candle.t)) {
            seen.add(candle.t);
            unique.push(candle);
        }
    }

    // Sort by timestamp ascending
    return unique.sort((a, b) => a.t - b.t);
}

/**
 * Detect gaps in candle data
 * Returns array of gap ranges
 */
export function detectGaps(
    candles: Candle[],
    expectedIntervalMs: number,
    toleranceMs: number = 60000 // 1 minute tolerance
): Array<{ start: number; end: number; sizeDays: number }> {
    if (candles.length < 2) {
        return [];
    }

    const gaps: Array<{ start: number; end: number; sizeDays: number }> = [];

    for (let i = 1; i < candles.length; i++) {
        const timeDiff = candles[i].t - candles[i - 1].t;
        const expectedDiff = expectedIntervalMs;

        // If gap is significantly larger than expected interval
        if (timeDiff > expectedDiff + toleranceMs) {
            const gapSizeMs = timeDiff - expectedDiff;
            const gapSizeDays = gapSizeMs / (1000 * 60 * 60 * 24);

            gaps.push({
                start: candles[i - 1].t,
                end: candles[i].t,
                sizeDays: Math.round(gapSizeDays * 100) / 100,
            });
        }
    }

    return gaps;
}

/**
 * Validate continuity of merged data
 * Returns validation result with any issues found
 */
export function validateMergedData(candles: Candle[]): {
    valid: boolean;
    duplicates: number;
    gaps: number;
    issues: string[];
} {
    const issues: string[] = [];

    // Check for duplicates
    const timestamps = candles.map((c) => c.t);
    const uniqueTimestamps = new Set(timestamps);
    const duplicates = timestamps.length - uniqueTimestamps.size;

    if (duplicates > 0) {
        issues.push(`Found ${duplicates} duplicate timestamps`);
    }

    // Check for sorting
    let isSorted = true;
    for (let i = 1; i < candles.length; i++) {
        if (candles[i].t < candles[i - 1].t) {
            isSorted = false;
            break;
        }
    }

    if (!isSorted) {
        issues.push('Data is not sorted by timestamp');
    }

    // Detect gaps (assuming 1-minute interval for this check)
    const oneMinuteMs = 60 * 1000;
    const gaps = detectGaps(candles, oneMinuteMs);

    if (gaps.length > 0) {
        issues.push(`Found ${gaps.length} gaps in data (expected for weekends/holidays)`);
    }

    return {
        valid: issues.length === 0 || (issues.length === 1 && issues[0].includes('gaps')),
        duplicates,
        gaps: gaps.length,
        issues,
    };
}

/**
 * Get data statistics
 */
export function getDataStats(candles: Candle[]): {
    count: number;
    startTime: number;
    endTime: number;
    duration: string;
    priceRange: { min: number; max: number };
    volumeTotal: number;
} {
    if (candles.length === 0) {
        return {
            count: 0,
            startTime: 0,
            endTime: 0,
            duration: '0 days',
            priceRange: { min: 0, max: 0 },
            volumeTotal: 0,
        };
    }

    const startTime = candles[0].t;
    const endTime = candles[candles.length - 1].t;
    const durationMs = endTime - startTime;
    const durationDays = Math.round(durationMs / (1000 * 60 * 60 * 24));

    const allLows = candles.map((c) => c.l);
    const allHighs = candles.map((c) => c.h);
    const minPrice = Math.min(...allLows);
    const maxPrice = Math.max(...allHighs);

    const volumeTotal = candles.reduce((sum, c) => sum + c.v, 0);

    return {
        count: candles.length,
        startTime,
        endTime,
        duration: `${durationDays} days`,
        priceRange: { min: minPrice, max: maxPrice },
        volumeTotal,
    };
}
