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

            const { ticker, interval, date, isMergedFile } = metadata;

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
                    dateRange: { earliest: '', latest: '' }
                };
                index[ticker].intervals.push(intervalEntry);
            }

            // Handle MERGED files: read metadata to get date range
            if (isMergedFile) {
                try {
                    const filepath = path.join(DATA_DIR, file);
                    const content = await fs.readFile(filepath, 'utf-8');
                    const data = JSON.parse(content);

                    if (data.metadata && data.metadata.data_start && data.metadata.data_end) {
                        // Extract date from ISO 8601 timestamps
                        const startDate = data.metadata.data_start.split('T')[0];
                        const endDate = data.metadata.data_end.split('T')[0];

                        // Generate all dates in range (for availability checking)
                        const dates = generateDateRange(startDate, endDate);
                        dates.forEach(d => {
                            if (!intervalEntry!.dates.includes(d)) {
                                intervalEntry!.dates.push(d);
                            }
                        });

                        // Update date range
                        if (!intervalEntry.dateRange.earliest || startDate < intervalEntry.dateRange.earliest) {
                            intervalEntry.dateRange.earliest = startDate;
                        }
                        if (!intervalEntry.dateRange.latest || endDate > intervalEntry.dateRange.latest) {
                            intervalEntry.dateRange.latest = endDate;
                        }

                        console.log(`[DataScanner] Indexed MERGED file: ${file} (${startDate} to ${endDate}, ${dates.length} dates)`);
                    }
                } catch (error) {
                    console.error(`[DataScanner] Failed to read MERGED file ${file}:`, error);
                }
            } else {
                // Legacy file: single date
                if (!intervalEntry.dates.includes(date)) {
                    intervalEntry.dates.push(date);

                    // Update date range
                    if (!intervalEntry.dateRange.earliest || date < intervalEntry.dateRange.earliest) {
                        intervalEntry.dateRange.earliest = date;
                    }
                    if (!intervalEntry.dateRange.latest || date > intervalEntry.dateRange.latest) {
                        intervalEntry.dateRange.latest = date;
                    }
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
 * Generate array of dates between start and end (inclusive)
 * Helper for MERGED file date range expansion
 * 
 * 🔥 FIX: Use UTC parsing to avoid timezone-dependent date shifts
 * Metadata dates are in ISO 8601 format (YYYY-MM-DD), must be parsed as UTC
 */
function generateDateRange(startDate: string, endDate: string): string[] {
    const dates: string[] = [];

    // 🔥 FIX: Parse as UTC midnight to avoid local timezone shift
    // "2025-12-19" → parseFixed datetime in UTC, not local
    const current = new Date(startDate + 'T00:00:00Z');
    const end = new Date(endDate + 'T00:00:00Z');

    while (current <= end) {
        // Extract YYYY-MM-DD in UTC timezone
        dates.push(current.toISOString().split('T')[0]);
        current.setUTCDate(current.getUTCDate() + 1);
    }

    console.log(`[DataScanner] Generated ${dates.length} dates from ${startDate} to ${endDate}`);
    return dates;
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
    let tickerData = index[ticker];

    console.log(`[DataAvailability] getAvailableIntervals for ${ticker} on ${date}`);
    console.log(`[DataAvailability] tickerData exists:`, !!tickerData);

    if (!tickerData) {
        // 🔥 FIX: Retry with normalized ticker (remove .JK suffix)
        if (ticker.endsWith('.JK')) {
            const normalizedTicker = ticker.replace(/\.JK$/, '');
            console.log(`[DataAvailability] Ticker ${ticker} not found, trying ${normalizedTicker}`);
            tickerData = index[normalizedTicker];
        }

        if (!tickerData) {
            console.warn(`[DataAvailability] No index found for ticker: ${ticker}`);
            return [];
        }
    }

    console.log(`[DataAvailability] Available intervals for ${ticker}:`, tickerData.intervals.map(i => i.interval));

    const availableIntervals: IntervalType[] = [];

    for (const intervalEntry of tickerData.intervals) {
        console.log(`[DataAvailability] Checking ${intervalEntry.interval}: has ${intervalEntry.dates.length} dates`);
        console.log(`[DataAvailability] Date range: ${intervalEntry.dateRange.earliest} to ${intervalEntry.dateRange.latest}`);
        console.log(`[DataAvailability] First 5 dates:`, intervalEntry.dates.slice(0, 5));
        console.log(`[DataAvailability] Includes ${date}?`, intervalEntry.dates.includes(date));

        // Check if this interval has data for the target date
        if (intervalEntry.dates.includes(date)) {
            availableIntervals.push(intervalEntry.interval);
        }
    }

    console.log(`[DataAvailability] Final available intervals for ${ticker} ${date}:`, availableIntervals);
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
