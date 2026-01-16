/**
 * Data Provider Configuration
 * 
 * Centralized configuration for data provider limits and rules.
 * Mengubah provider = update config, BUKAN refactor logic.
 * 
 * @reference Yahoo Finance API Limits:
 * - 1m data: max 7 days
 * - 5m-30m data: max 60 days  
 * - 1h data: max 730 days (2 years)
 * - 1d+ data: virtually unlimited
 */

// ============================================================================
// Types
// ============================================================================

export interface IntervalConfig {
    /** Maximum days allowed by the provider */
    maxDays: number;
    /** Safe limit (buffer for reliability) */
    safeDays: number;
    /** Yahoo Finance interval string */
    yahooInterval: YahooInterval;
    /** Human-readable description */
    description: string;
}

export type YahooInterval = '1m' | '2m' | '5m' | '15m' | '30m' | '60m' | '90m' | '1h' | '1d' | '5d' | '1wk' | '1mo' | '3mo';

export interface ProviderConfig {
    name: string;
    /** Interval to config mapping */
    intervals: Record<string, IntervalConfig>;
    /** Rate limiting */
    rateLimits: {
        requestsPerMinute: number;
        requestsPerDay: number;
    };
}

// ============================================================================
// Provider Configurations
// ============================================================================

export const DATA_PROVIDERS: Record<string, ProviderConfig> = {
    yahooFinance: {
        name: 'Yahoo Finance',
        intervals: {
            // Minute-level (max 7 days)
            '1m': {
                maxDays: 7,
                safeDays: 5,
                yahooInterval: '1m',
                description: '1 minute candles, max 7 days history'
            },
            '2m': {
                maxDays: 60,
                safeDays: 45,
                yahooInterval: '2m',
                description: '2 minute candles, max 60 days history'
            },
            '5m': {
                maxDays: 60,
                safeDays: 45,
                yahooInterval: '5m',
                description: '5 minute candles, max 60 days history'
            },
            '15m': {
                maxDays: 60,
                safeDays: 45,
                yahooInterval: '15m',
                description: '15 minute candles, max 60 days history'
            },
            '30m': {
                maxDays: 60,
                safeDays: 45,
                yahooInterval: '30m',
                description: '30 minute candles, max 60 days history'
            },
            // Hourly (max 730 days / 2 years)
            '1h': {
                maxDays: 730,
                safeDays: 365,
                yahooInterval: '60m',
                description: '1 hour candles, max 2 years history'
            },
            '60m': {
                maxDays: 730,
                safeDays: 365,
                yahooInterval: '60m',
                description: '1 hour candles (alias), max 2 years history'
            },
            // Daily+ (virtually unlimited)
            '1d': {
                maxDays: 3650, // 10 years
                safeDays: 1825, // 5 years
                yahooInterval: '1d',
                description: 'Daily candles, max 10 years history'
            },
            '1wk': {
                maxDays: 7300, // 20 years
                safeDays: 3650, // 10 years
                yahooInterval: '1wk',
                description: 'Weekly candles'
            },
            '1mo': {
                maxDays: 14600, // 40 years
                safeDays: 7300, // 20 years
                yahooInterval: '1mo',
                description: 'Monthly candles'
            }
        },
        rateLimits: {
            requestsPerMinute: 100,
            requestsPerDay: 2000
        }
    }
};

// ============================================================================
// Helper Functions
// ============================================================================

/** Currently active provider */
export const ACTIVE_PROVIDER = 'yahooFinance';

/**
 * Get interval configuration for the active provider
 */
export function getIntervalConfig(interval: string): IntervalConfig {
    const provider = DATA_PROVIDERS[ACTIVE_PROVIDER];
    const config = provider.intervals[interval];

    if (!config) {
        // Fallback to 5m if unknown interval
        console.warn(`[Config] Unknown interval "${interval}", falling back to 5m`);
        return provider.intervals['5m'];
    }

    return config;
}

/**
 * Calculate the optimal period1 (start date) based on interval config
 * Uses safeDays for reliability
 */
export function calculatePeriodStart(interval: string, useSafeDays = true): Date {
    const config = getIntervalConfig(interval);
    const days = useSafeDays ? config.safeDays : config.maxDays;

    const now = new Date();
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

/**
 * Map user-facing interval to Yahoo Finance interval
 */
export function mapToYahooInterval(interval: string): YahooInterval {
    const config = getIntervalConfig(interval);
    return config.yahooInterval;
}

/**
 * Get interval duration in milliseconds
 */
export function getIntervalMs(interval: string): number {
    const MINUTE = 60 * 1000;
    const HOUR = 60 * MINUTE;
    const DAY = 24 * HOUR;

    const map: Record<string, number> = {
        '1m': MINUTE,
        '2m': 2 * MINUTE,
        '5m': 5 * MINUTE,
        '15m': 15 * MINUTE,
        '30m': 30 * MINUTE,
        '1h': HOUR,
        '60m': HOUR,
        '1d': DAY,
        '1wk': 7 * DAY,
        '1mo': 30 * DAY,
    };

    return map[interval] || 5 * MINUTE;
}
