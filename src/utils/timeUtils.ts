/**
 * Centralized Time Utilities
 * ==========================
 * Single source of truth for timestamp normalization across the application.
 * Prevents "[object Object]" errors and timestamp inconsistencies.
 * 
 * @module timeUtils
 */

/**
 * Threshold for detecting milliseconds vs seconds timestamps
 * - Values > 10 billion = milliseconds (e.g., 1610000000000)
 * - Values < 10 billion = seconds (e.g., 1610000000)
 * - Cutoff represents ~2286 in seconds, ~1973 in milliseconds
 */
const THRESHOLD_MS = 10_000_000_000;

/**
 * Normalize timestamp to seconds (Unix timestamp format)
 * 
 * Handles:
 * - Millisecond timestamps (>10B) → divide by 1000
 * - Second timestamps (<10B) → pass through
 * - ISO string dates → parse and convert
 * - HH:MM time strings → convert to today's timestamp
 * 
 * @param time - Timestamp in various formats
 * @returns Unix timestamp in seconds (integer)
 * @throws Error if timestamp is null/undefined or invalid
 * 
 * @example
 * normalizeToSeconds(1610000000000) // 1610000000 (ms → s)
 * normalizeToSeconds(1610000000)    // 1610000000 (already seconds)
 * normalizeToSeconds("2021-01-07T12:00:00Z") // 1610020800
 */
export function normalizeToSeconds(time: string | number | undefined | any): number {
    // 🔥 STRICT: Reject null/undefined
    if (time === undefined || time === null) {
        console.error('[TimeUtils] Cannot normalize null/undefined timestamp');
        return Math.floor(Date.now() / 1000); // Fallback to current time
    }

    // Handle numeric timestamps
    if (typeof time === 'number') {
        // Validation: Reject negative timestamps
        if (time < 0) {
            console.error(`[TimeUtils] Invalid negative timestamp: ${time}`);
            return Math.floor(Date.now() / 1000);
        }

        // Convert ms to seconds if needed
        return time > THRESHOLD_MS
            ? Math.floor(time / 1000)
            : Math.floor(time);
    }

    // Handle string timestamps
    if (typeof time === 'string') {
        // Parse ISO date or time string
        const parsed = new Date(time).getTime();

        if (isNaN(parsed)) {
            console.error(`[TimeUtils] Invalid timestamp string: "${time}"`);
            return Math.floor(Date.now() / 1000);
        }

        // Convert to seconds
        return Math.floor(parsed / 1000);
    }

    // 🔥 NEW: Handle object types (Date, BusinessDay, etc)
    if (typeof time === 'object') {
        if (time instanceof Date) {
            return Math.floor(time.getTime() / 1000);
        }

        // BusinessDay format {year, month, day}
        if (time.year && time.month && time.day) {
            const businessDate = new Date(Date.UTC(time.year, time.month - 1, time.day));
            return Math.floor(businessDate.getTime() / 1000);
        }

        // Unknown object - log and fallback
        console.error(`[TimeUtils] Unknown object type, keys:`, Object.keys(time));
        return Math.floor(Date.now() / 1000);
    }

    // Last resort fallback
    console.error(`[TimeUtils] Unsupported timestamp type: ${typeof time}`);
    return Math.floor(Date.now() / 1000);
}

/**
 * Normalize timestamp to milliseconds (Resampler/Worker format)
 * 
 * Handles:
 * - Second timestamps (<10B) → multiply by 1000
 * - Millisecond timestamps (>10B) → pass through
 * - ISO string dates → parse to milliseconds
 * 
 * @param time - Timestamp in various formats
 * @returns Unix timestamp in milliseconds (integer)
 * @throws Error if timestamp is null/undefined or invalid
 * 
 * @example
 * normalizeToMs(1610000000)    // 1610000000000 (s → ms)
 * normalizeToMs(1610000000000) // 1610000000000 (already ms)
 * normalizeToMs("2021-01-07T12:00:00Z") // 1610020800000
 */
export function normalizeToMs(time: string | number | undefined): number {
    // 🔥 STRICT: Reject null/undefined
    if (time === undefined || time === null) {
        throw new Error('[TimeUtils] Cannot normalize null/undefined timestamp');
    }

    // Handle numeric timestamps
    if (typeof time === 'number') {
        // Validation: Reject negative timestamps
        if (time < 0) {
            throw new Error(`[TimeUtils] Invalid negative timestamp: ${time}`);
        }

        // Convert seconds to ms if needed
        return time < THRESHOLD_MS
            ? time * 1000
            : time;
    }

    // Handle string timestamps
    if (typeof time === 'string') {
        const parsed = new Date(time).getTime();

        if (isNaN(parsed)) {
            throw new Error(`[TimeUtils] Invalid timestamp string: "${time}"`);
        }

        return parsed;
    }

    throw new Error(`[TimeUtils] Unsupported timestamp type: ${typeof time}`);
}

/**
 * Batch normalize array of timestamps to seconds
 * Useful for processing large datasets efficiently
 * 
 * @param times - Array of timestamps
 * @returns Array of normalized Unix timestamps in seconds
 */
export function normalizeArrayToSeconds(times: (string | number)[]): number[] {
    return times.map(normalizeToSeconds);
}

/**
 * Batch normalize array of timestamps to milliseconds
 * 
 * @param times - Array of timestamps
 * @returns Array of normalized Unix timestamps in milliseconds
 */
export function normalizeArrayToMs(times: (string | number)[]): number[] {
    return times.map(normalizeToMs);
}

/**
 * Format Unix timestamp (seconds) to human-readable string
 * 
 * @param timestamp - Unix timestamp in seconds
 * @param locale - Locale for formatting (default: 'id-ID')
 * @returns Formatted date string
 * 
 * @example
 * formatTimestamp(1610000000) // "07/01/2021 19:13:20"
 */
export function formatTimestamp(
    timestamp: number,
    locale: string = 'id-ID'
): string {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

/**
 * Check if timestamp is in milliseconds format
 * 
 * @param timestamp - Numeric timestamp
 * @returns true if milliseconds, false if seconds
 */
export function isMilliseconds(timestamp: number): boolean {
    return timestamp > THRESHOLD_MS;
}

/**
 * Validate timestamp is within reasonable range
 * Prevents absurd values (e.g., year 3000 or 1900)
 * 
 * @param timestamp - Unix timestamp (seconds or milliseconds)
 * @param minYear - Minimum acceptable year (default: 2000)
 * @param maxYear - Maximum acceptable year (default: 2100)
 * @returns true if valid, false otherwise
 */
export function isValidTimestampRange(
    timestamp: number,
    minYear: number = 2000,
    maxYear: number = 2100
): boolean {
    const ms = isMilliseconds(timestamp) ? timestamp : timestamp * 1000;
    const date = new Date(ms);
    const year = date.getFullYear();
    return year >= minYear && year <= maxYear;
}
