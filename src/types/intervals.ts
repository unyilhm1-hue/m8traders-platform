/**
 * Interval Type Definitions
 * Auto-extensible - add new intervals here as data becomes available
 */

export const INTERVALS = ['1m', '2m', '5m', '15m', '30m', '1h', '1d'] as const;
export type IntervalType = typeof INTERVALS[number];

/**
 * Interval metadata for dynamic tick density calculation
 * Add new intervals here without modifying other code
 */
export const INTERVAL_METADATA: Record<IntervalType, {
    seconds: number;
    baseTicks: number;      // Recommended tick density
    maxLookbackDays: number; // yfinance historical limit
    displayName: string;
}> = {
    '1m': {
        seconds: 60,
        baseTicks: 60,
        maxLookbackDays: 30,
        displayName: '1 Minute'
    },
    '2m': {
        seconds: 120,
        baseTicks: 120,
        maxLookbackDays: 60,
        displayName: '2 Minutes'
    },
    '5m': {
        seconds: 300,
        baseTicks: 300,
        maxLookbackDays: 60,
        displayName: '5 Minutes'
    },
    '15m': {
        seconds: 900,
        baseTicks: 900,
        maxLookbackDays: 60,
        displayName: '15 Minutes'
    },
    '30m': {
        seconds: 1800,
        baseTicks: 1800,
        maxLookbackDays: 60,
        displayName: '30 Minutes'
    },
    '1h': {
        seconds: 3600,
        baseTicks: 3600,
        maxLookbackDays: 730,
        displayName: '1 Hour'
    },
    '1d': {
        seconds: 86400,
        baseTicks: 500,
        maxLookbackDays: 3650,
        displayName: '1 Day'
    }
};

/**
 * Parse interval string to seconds
 */
export function intervalToSeconds(interval: IntervalType): number {
    return INTERVAL_METADATA[interval].seconds;
}

/**
 * Get interval from seconds (reverse lookup)
 */
export function secondsToInterval(seconds: number): IntervalType | null {
    for (const [key, meta] of Object.entries(INTERVAL_METADATA)) {
        if (meta.seconds === seconds) {
            return key as IntervalType;
        }
    }
    return null;
}

/**
 * Calculate multiplier for interval conversion
 * Returns null if conversion impossible (downscaling)
 * 
 * @example
 * getIntervalMultiplier('1m', '5m') → 5 (aggregate 5x 1m candles)
 * getIntervalMultiplier('5m', '1m') → null (cannot disaggregate)
 */
export function getIntervalMultiplier(
    sourceInterval: IntervalType,
    targetInterval: IntervalType
): number | null {
    const sourceSeconds = intervalToSeconds(sourceInterval);
    const targetSeconds = intervalToSeconds(targetInterval);

    // Cannot downscale (create smaller intervals from larger ones)
    if (targetSeconds < sourceSeconds) {
        return null;
    }

    // Check if evenly divisible
    if (targetSeconds % sourceSeconds !== 0) {
        console.warn(`[Intervals] ${sourceInterval} → ${targetInterval} not evenly divisible`);
        return null;
    }

    return targetSeconds / sourceSeconds;
}

/**
 * Parse filename to extract metadata
 * Supports both legacy and MERGED formats:
 * - Legacy: TICKER_INTERVAL_DATE.json (e.g., ADRO_1m_2026-01-15.json)
 * - MERGED: TICKER_INTERVAL_MERGED.json (e.g., ADRO_1m_MERGED.json)
 * 
 * @example
 * parseFilename('ADRO_1m_2026-01-15.json') 
 * → { ticker: 'ADRO', interval: '1m', date: '2026-01-15', isMergedFile: false }
 * parseFilename('ADRO_1m_MERGED.json')
 * → { ticker: 'ADRO', interval: '1m', date: 'MERGED', isMergedFile: true }
 */
export interface FileMetadata {
    ticker: string;
    interval: IntervalType;
    date: string;  // Actual date for legacy files, 'MERGED' for merged files
    filename: string;
    isMergedFile: boolean;
}

export function parseFilename(filename: string): FileMetadata | null {
    // 🔥 FIX #17: Support ticker with dots (e.g., BBRI.JK)
    // Try MERGED format first: TICKER_INTERVAL_MERGED.json
    const mergedMatch = filename.match(/^([A-Z]+(?:\.[A-Z]+)?)_(\d+[mhd])_MERGED\.json$/);
    if (mergedMatch) {
        const [, ticker, interval] = mergedMatch;

        if (!INTERVALS.includes(interval as IntervalType)) {
            console.warn(`[Intervals] Unknown interval in MERGED file: ${interval}`);
            return null;
        }

        return {
            ticker,
            interval: interval as IntervalType,
            date: 'MERGED',
            filename,
            isMergedFile: true
        };
    }

    // Try legacy format: TICKER_INTERVAL_DATE.json
    // 🔥 FIX #17: Support ticker with dots
    const legacyMatch = filename.match(/^([A-Z]+(?:\.[A-Z]+)?)_(\d+[mhd])_(\d{4}-\d{2}-\d{2})\.json$/);
    if (legacyMatch) {
        const [, ticker, interval, date] = legacyMatch;

        if (!INTERVALS.includes(interval as IntervalType)) {
            console.warn(`[Intervals] Unknown interval: ${interval}`);
            return null;
        }

        return {
            ticker,
            interval: interval as IntervalType,
            date,
            filename,
            isMergedFile: false
        };
    }

    // Unrecognized format
    return null;
}

/**
 * Format interval for display
 */
export function formatInterval(interval: IntervalType): string {
    return INTERVAL_METADATA[interval].displayName;
}

/**
 * Sort intervals by duration (ascending)
 */
export function sortIntervals(intervals: IntervalType[]): IntervalType[] {
    return intervals.sort((a, b) =>
        intervalToSeconds(a) - intervalToSeconds(b)
    );
}
