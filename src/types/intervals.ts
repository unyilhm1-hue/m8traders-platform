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
 * Format: TICKER_INTERVAL_DATE.json
 * 
 * @example
 * parseFilename('ADRO_1m_2026-01-15.json') 
 * → { ticker: 'ADRO', interval: '1m', date: '2026-01-15' }
 */
export interface FileMetadata {
    ticker: string;
    interval: IntervalType;
    date: string;
    filename: string;
}

export function parseFilename(filename: string): FileMetadata | null {
    const match = filename.match(/^([A-Z]+)_(\d+[mhd])_(\d{4}-\d{2}-\d{2})\.json$/);

    if (!match) {
        return null;
    }

    const [, ticker, interval, date] = match;

    // Validate interval is supported
    if (!INTERVALS.includes(interval as IntervalType)) {
        console.warn(`[Intervals] Unknown interval: ${interval}`);
        return null;
    }

    return {
        ticker,
        interval: interval as IntervalType,
        date,
        filename
    };
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
