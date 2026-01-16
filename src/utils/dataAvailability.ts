/**
 * Data Availability Scanner
 * Auto-discovers available intervals and dates from filesystem
 * Dynamic - handles new data files without code changes
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { IntervalType, FileMetadata } from '@/types/intervals';
import { parseFilename, sortIntervals } from '@/types/intervals';

const DATA_DIR = path.join(process.cwd(), 'public', 'simulation-data');

/**
 * Data availability map for a ticker
 */
export interface DataIndex {
    ticker: string;
    intervals: {
        interval: IntervalType;
        dates: string[];           // Available dates for this interval
        dateRange: {
            earliest: string;
            latest: string;
        };
    }[];
}

/**
 * Scan simulation-data directory and build index
 * **Dynamic**: Works with any new files added to the folder
 * 
 * @example
 * // Returns all tickers with their available intervals/dates
 * const index = await scanDataDirectory()
 * // {
 * //   'ADRO': {
 * //     '1m': { dates: ['2026-01-15', '2026-01-14', ...], ... },
 * //     '15m': { dates: ['2025-12-19', ...], ... }
 * //   }
 * // }
 */
export async function scanDataDirectory(): Promise<Record<string, DataIndex>> {
    try {
        const files = await fs.readdir(DATA_DIR);
        const jsonFiles = files.filter(f => f.endsWith('.json'));

        const index: Record<string, DataIndex> = {};

        for (const file of jsonFiles) {
            const metadata = parseFilename(file);
            if (!metadata) {
                console.warn(`[DataScanner] Skipping invalid filename: ${file}`);
                continue;
            }

            const { ticker, interval, date } = metadata;

            // Initialize ticker if not exists
            if (!index[ticker]) {
                index[ticker] = {
                    ticker,
                    intervals: []
                };
            }

            // Find or create interval entry
            let intervalEntry = index[ticker].intervals.find(i => i.interval === interval);
            if (!intervalEntry) {
                intervalEntry = {
                    interval,
                    dates: [],
                    dateRange: { earliest: date, latest: date }
                };
                index[ticker].intervals.push(intervalEntry);
            }

            // Add date (if not duplicate)
            if (!intervalEntry.dates.includes(date)) {
                intervalEntry.dates.push(date);

                // Update date range
                if (date < intervalEntry.dateRange.earliest) {
                    intervalEntry.dateRange.earliest = date;
                }
                if (date > intervalEntry.dateRange.latest) {
                    intervalEntry.dateRange.latest = date;
                }
            }
        }

        // Sort dates descending (newest first) and intervals ascending
        for (const ticker in index) {
            index[ticker].intervals.forEach(interval => {
                interval.dates.sort((a, b) => b.localeCompare(a)); // Newest first
            });

            // Sort intervals by duration (1m, 2m, 5m, ...)
            const sortedIntervals = sortIntervals(
                index[ticker].intervals.map(i => i.interval)
            );
            index[ticker].intervals.sort((a, b) =>
                sortedIntervals.indexOf(a.interval) - sortedIntervals.indexOf(b.interval)
            );
        }

        console.log(`[DataScanner] Indexed ${Object.keys(index).length} tickers`);
        return index;

    } catch (error) {
        console.error('[DataScanner] Failed to scan data directory:', error);
        return {};
    }
}

/**
 * Get available intervals for a ticker on a specific date
 * Accounts for date availability across intervals
 * 
 * @example
 * await getAvailableIntervals('ADRO', '2026-01-15')
 * // → ['1m', '2m', '5m', '15m'] (only intervals with data for this date)
 */
export async function getAvailableIntervals(
    ticker: string,
    date: string
): Promise<IntervalType[]> {
    const index = await scanDataDirectory();
    const tickerData = index[ticker];

    if (!tickerData) {
        return [];
    }

    const availableIntervals: IntervalType[] = [];

    for (const intervalEntry of tickerData.intervals) {
        // Check if this interval has data for the target date
        if (intervalEntry.dates.includes(date)) {
            availableIntervals.push(intervalEntry.interval);
        }
    }

    return sortIntervals(availableIntervals);
}

/**
 * Find best available source interval for a target interval
 * Prefers the finest granularity to allow upscaling
 * 
 * @example
 * // User wants 5m, but request date only has 1m and 15m
 * await findBestSourceInterval('ADRO', '2026-01-15', '5m')
 * // → '1m' (can aggregate 1m → 5m)
 */
export async function findBestSourceInterval(
    ticker: string,
    date: string,
    targetInterval: IntervalType
): Promise<IntervalType | null> {
    const availableIntervals = await getAvailableIntervals(ticker, date);

    if (availableIntervals.length === 0) {
        return null;
    }

    // If exact match exists, use it
    if (availableIntervals.includes(targetInterval)) {
        return targetInterval;
    }

    const { intervalToSeconds } = require('@/types/intervals');
    const targetSeconds = intervalToSeconds(targetInterval);

    // Find finest interval that can aggregate to target
    // (smallest interval that's ≤ target and evenly divisible)
    const compatibleIntervals = availableIntervals.filter(interval => {
        const sourceSeconds = intervalToSeconds(interval);
        return sourceSeconds <= targetSeconds && targetSeconds % sourceSeconds === 0;
    });

    if (compatibleIntervals.length === 0) {
        console.warn(
            `[DataScanner] No compatible source interval for ${ticker} ${date} → ${targetInterval}`
        );
        return null;
    }

    // Return finest (smallest) compatible interval
    return compatibleIntervals[0]; // Already sorted ascending
}

/**
 * Check if interval switching is possible given current loaded data
 * 
 * @example
 * // Loaded 1m data, can switch to 5m? → true (upscale)
 * // Loaded 15m data, can switch to 1m? → false (downscale impossible)
 */
export function canSwitchInterval(
    currentInterval: IntervalType,
    targetInterval: IntervalType
): boolean {
    const { getIntervalMultiplier } = require('@/types/intervals');
    return getIntervalMultiplier(currentInterval, targetInterval) !== null;
}
