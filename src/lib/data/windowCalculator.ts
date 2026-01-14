/**
 * Window Calculator
 * Splits date ranges into downloadable windows based on data provider limits
 */

import type { BatchWindow } from '@/types/storage';

/**
 * Generate windows for batch download
 * 
 * @param startDate - Start date for data range
 * @param endDate - End date for data range
 * @param windowSizeDays - Window size in days (default: 60 for Yahoo Finance 1m/5m limits)
 * @returns Array of batch windows
 */
export function generateWindows(
    startDate: Date,
    endDate: Date,
    windowSizeDays: number = 60
): BatchWindow[] {
    const windows: BatchWindow[] = [];
    let currentStart = new Date(startDate);

    while (currentStart < endDate) {
        const currentEnd = new Date(currentStart);
        currentEnd.setDate(currentEnd.getDate() + windowSizeDays);

        // Don't exceed end date
        const actualEnd = currentEnd > endDate ? new Date(endDate) : currentEnd;

        // Calculate actual size
        const actualSize = Math.ceil((actualEnd.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24));

        windows.push({
            id: getWindowId(currentStart, actualEnd),
            startDate: new Date(currentStart),
            endDate: new Date(actualEnd),
            sizeInDays: actualSize,
        });

        // Move to next window
        currentStart = new Date(actualEnd);
    }

    return windows;
}

/**
 * Generate unique window ID from date range
 * Format: YYYY-MM-DD_to_YYYY-MM-DD
 */
export function getWindowId(start: Date, end: Date): string {
    return `${formatDate(start)}_to_${formatDate(end)}`;
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Parse window ID back to dates
 */
export function parseWindowId(windowId: string): { start: Date; end: Date } | null {
    const match = windowId.match(/^(\d{4}-\d{2}-\d{2})_to_(\d{4}-\d{2}-\d{2})$/);
    if (!match) {
        return null;
    }

    return {
        start: new Date(match[1]),
        end: new Date(match[2]),
    };
}

/**
 * Validate window doesn't exceed provider limits
 */
export function validateWindow(
    window: BatchWindow,
    interval: '1m' | '5m' | '15m' | '1h'
): { valid: boolean; reason?: string } {
    // Yahoo Finance limits
    const limits: Record<string, number> = {
        '1m': 30,    // Conservative estimate (can vary 7-30 days)
        '5m': 60,
        '15m': 60,
        '1h': 730,
    };

    const maxDays = limits[interval] || 60;

    if (window.sizeInDays > maxDays) {
        return {
            valid: false,
            reason: `Window size ${window.sizeInDays} days exceeds limit of ${maxDays} days for ${interval} interval`,
        };
    }

    return { valid: true };
}

/**
 * Get recommended window size for interval
 */
export function getRecommendedWindowSize(interval: '1m' | '5m' | '15m' | '1h'): number {
    const sizes: Record<string, number> = {
        '1m': 7,     // Very conservative for 1m
        '5m': 30,    // Half the limit for safety
        '15m': 60,
        '1h': 90,
    };

    return sizes[interval] || 60;
}

/**
 * Check if two windows overlap
 */
export function doWindowsOverlap(window1: BatchWindow, window2: BatchWindow): boolean {
    return (
        window1.startDate < window2.endDate &&
        window2.startDate < window1.endDate
    );
}

/**
 * Merge overlapping windows (for deduplication)
 */
export function mergeWindows(window1: BatchWindow, window2: BatchWindow): BatchWindow {
    const start = window1.startDate < window2.startDate ? window1.startDate : window2.startDate;
    const end = window1.endDate > window2.endDate ? window1.endDate : window2.endDate;
    const sizeInDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    return {
        id: getWindowId(start, end),
        startDate: start,
        endDate: end,
        sizeInDays,
    };
}
