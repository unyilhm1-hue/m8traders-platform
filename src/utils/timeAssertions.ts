/**
 * Time Validation Utilities
 * Enforce SSoT: Unix Seconds across the application
 * Phase 2: Feature-flagged strict validation
 */

import { FEATURE_FLAGS } from '@/config/featureFlags';

/**
 * Assert value is a valid Unix timestamp in SECONDS
 * 
 * @param time - Value to validate
 * @param context - Context string for error messages
 * @throws Error in strict mode if validation fails
 */
export function assertSeconds(time: unknown, context: string): asserts time is number {
    if (typeof time !== 'number') {
        const msg = `[TimeSSoT] ${context}: Expected number, got ${typeof time}`;
        if (FEATURE_FLAGS.TIME_SSOT_STRICT) {
            throw new Error(msg);
        }
        console.warn(msg);
        return;
    }

    if (!Number.isInteger(time)) {
        const msg = `[TimeSSoT] ${context}: Expected integer, got float ${time}`;
        if (FEATURE_FLAGS.TIME_SSOT_STRICT) {
            throw new Error(msg);
        }
        console.warn(msg);
        return;
    }

    // Reasonable range: 2001 to 2100 (946_684_800 to 4_102_444_800)
    if (time < 946_684_800 || time > 4_102_444_800) {
        const msg = `[TimeSSoT] ${context}: Invalid range for seconds: ${time} (expected 2001-2100)`;
        if (FEATURE_FLAGS.TIME_SSOT_STRICT) {
            throw new Error(msg);
        }
        console.warn(msg);
    }
}

/**
 * Assert value is a valid Unix timestamp in MILLISECONDS
 * 
 * @param time - Value to validate
 * @param context - Context string for error messages
 * @throws Error in strict mode if validation fails
 */
export function assertMilliseconds(time: unknown, context: string): asserts time is number {
    if (typeof time !== 'number') {
        const msg = `[TimeSSoT] ${context}: Expected number, got ${typeof time}`;
        if (FEATURE_FLAGS.TIME_SSOT_STRICT) {
            throw new Error(msg);
        }
        console.warn(msg);
        return;
    }

    if (!Number.isInteger(time)) {
        const msg = `[TimeSSoT] ${context}: Expected integer, got float ${time}`;
        if (FEATURE_FLAGS.TIME_SSOT_STRICT) {
            throw new Error(msg);
        }
        console.warn(msg);
        return;
    }

    // Reasonable range: 2001 to 2100 in milliseconds
    if (time < 946_684_800_000 || time > 4_102_444_800_000) {
        const msg = `[TimeSSoT] ${context}: Invalid range for milliseconds: ${time} (expected 2001-2100)`;
        if (FEATURE_FLAGS.TIME_SSOT_STRICT) {
            throw new Error(msg);
        }
        console.warn(msg);
    }
}

/**
 * Convert to seconds with validation
 * Auto-detects milliseconds vs seconds based on magnitude
 * 
 * @param time - Timestamp to convert (number or ISO string)
 * @param context - Context string for error messages
 * @returns Timestamp in seconds
 * @throws Error in strict mode if parsing fails
 */
export function toSeconds(time: number | string, context: string): number {
    if (typeof time === 'string') {
        const parsed = new Date(time).getTime() / 1000;
        if (isNaN(parsed)) {
            const msg = `[TimeSSoT] ${context}: Cannot parse date string: ${time}`;
            if (FEATURE_FLAGS.TIME_SSOT_STRICT) {
                throw new Error(msg);
            }
            console.warn(msg);
            return Math.floor(Date.now() / 1000);
        }
        const result = Math.floor(parsed);
        assertSeconds(result, `${context} (parsed from string)`);
        return result;
    }

    // Auto-detect: if > 10 billion, likely milliseconds
    if (time > 10_000_000_000) {
        return Math.floor(time / 1000);
    }

    assertSeconds(time, context);
    return time;
}

/**
 * Validate time-only string format (HH:MM or HH:MM:SS)
 * These are ambiguous without a date context
 * 
 * @param time - Time string to validate
 * @param context - Context string for error messages
 * @returns True if valid, throws/warns otherwise
 */
export function validateTimeOnlyString(time: string, context: string): boolean {
    // Check if it's a time-only format (no date, no T separator)
    if (time.includes(':') && !time.includes('T') && !time.includes('-')) {
        const msg = `[TimeSSoT] ${context}: Ambiguous time-only string "${time}" - use full ISO8601 or Unix timestamp`;
        if (FEATURE_FLAGS.TIME_SSOT_STRICT) {
            throw new Error(msg);
        }
        console.warn(msg);
        return false;
    }
    return true;
}
