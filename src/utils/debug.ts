/**
 * Development Debug Flag
 * Toggle verbose logging for performance optimization
 */

// Only enable in development mode
export const IS_DEV = process.env.NODE_ENV === 'development';

// Feature-specific debug flags
export const DEBUG = {
    WORKER: IS_DEV && false,        // Worker tick/candle updates
    STORE: IS_DEV && false,         // Store state changes
    CHART: IS_DEV && false,         // Chart updates
    INDICATORS: IS_DEV && false,    // Indicator calculations
    RESAMPLING: IS_DEV && false,    // Interval switching
};

/**
 * Conditional logger for hot paths
 */
export function devLog(category: keyof typeof DEBUG, ...args: any[]) {
    if (DEBUG[category]) {
        console.log(...args);
    }
}
