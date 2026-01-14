/**
 * WindowCalculator Unit Tests
 * Tests for date range splitting and window management
 */

import { describe, it, expect } from 'vitest';
import {
    generateWindows,
    getWindowId,
    validateWindow,
    getRecommendedWindowSize,
    doWindowsOverlap,
} from '../windowCalculator';

describe('WindowCalculator', () => {
    describe('generateWindows', () => {
        it('should split 180-day range into 3 windows (60 days each)', () => {
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-06-30'); // ~180 days
            const windows = generateWindows(startDate, endDate, 60);

            expect(windows).toHaveLength(3);
            expect(windows[0].sizeInDays).toBe(60);
            expect(windows[1].sizeInDays).toBe(60);
            expect(windows[2].sizeInDays).toBeLessThanOrEqual(61); // Last window may vary
        });

        it('should handle partial last window (e.g., 70 days → 60 + 10)', () => {
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-03-12'); // 71 days
            const windows = generateWindows(startDate, endDate, 60);

            expect(windows).toHaveLength(2);
            expect(windows[0].sizeInDays).toBe(60);
            expect(windows[1].sizeInDays).toBeLessThanOrEqual(12);
        });

        it('should return single window for range smaller than window size', () => {
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-01-15'); // 14 days
            const windows = generateWindows(startDate, endDate, 60);

            expect(windows).toHaveLength(1);
            expect(windows[0].sizeInDays).toBe(14);
        });

        it('should handle same-day start/end', () => {
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-01-01');
            const windows = generateWindows(startDate, endDate, 60);

            expect(windows).toHaveLength(1);
            expect(windows[0].sizeInDays).toBe(0);
        });

        it('should generate consecutive non-overlapping windows', () => {
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-04-01'); // ~90 days
            const windows = generateWindows(startDate, endDate, 30);

            expect(windows).toHaveLength(3);

            // Verify windows are consecutive
            for (let i = 1; i < windows.length; i++) {
                expect(windows[i].startDate.getTime()).toBe(windows[i - 1].endDate.getTime());
            }
        });
    });

    describe('getWindowId', () => {
        it('should generate consistent IDs for same dates', () => {
            const start = new Date('2024-01-01');
            const end = new Date('2024-03-01');

            const id1 = getWindowId(start, end);
            const id2 = getWindowId(start, end);

            expect(id1).toBe(id2);
            expect(id1).toBe('2024-01-01_to_2024-03-01');
        });

        it('should use YYYY-MM-DD format', () => {
            const start = new Date('2024-01-05');
            const end = new Date('2024-02-15');

            const id = getWindowId(start, end);

            expect(id).toMatch(/^\d{4}-\d{2}-\d{2}_to_\d{4}-\d{2}-\d{2}$/);
            expect(id).toBe('2024-01-05_to_2024-02-15');
        });

        it('should include "to" separator', () => {
            const start = new Date('2024-01-01');
            const end = new Date('2024-03-01');

            const id = getWindowId(start, end);

            expect(id).toContain('_to_');
        });
    });

    describe('validateWindow', () => {
        it('should validate 1m windows ≤ 7 days', () => {
            const validWindow = {
                id: 'test',
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-07'),
                sizeInDays: 6,
            };

            const invalidWindow = {
                id: 'test',
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-10'),
                sizeInDays: 9,
            };

            expect(validateWindow(validWindow, '1m').valid).toBe(true);
            expect(validateWindow(invalidWindow, '1m').valid).toBe(false);
            expect(validateWindow(invalidWindow, '1m').reason).toContain('Window size 9 days exceeds limit');
        });

        it('should validate 5m windows ≤ 60 days', () => {
            const validWindow = {
                id: 'test',
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-03-01'),
                sizeInDays: 60,
            };

            const invalidWindow = {
                id: 'test',
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-04-01'),
                sizeInDays: 91,
            };

            expect(validateWindow(validWindow, '5m').valid).toBe(true);
            expect(validateWindow(invalidWindow, '5m').valid).toBe(false);
        });

        it('should validate 15m and 1h windows ≤ 90 days', () => {
            const validWindow = {
                id: 'test',
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-03-31'),
                sizeInDays: 90,
            };

            expect(validateWindow(validWindow, '15m').valid).toBe(true);
            expect(validateWindow(validWindow, '1h').valid).toBe(true);
        });

        it('should reject oversized windows with specific error', () => {
            const oversized = {
                id: 'test',
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-02-15'),
                sizeInDays: 45,
            };

            const result = validateWindow(oversized, '1m');

            expect(result.valid).toBe(false);
            expect(result.reason).toBeDefined();
            expect(result.reason).toMatch(/exceeds limit/);
        });
    });

    describe('getRecommendedWindowSize', () => {
        it('should return 7 days for 1m', () => {
            expect(getRecommendedWindowSize('1m')).toBe(7);
        });

        it('should return 30 days for 5m', () => {
            expect(getRecommendedWindowSize('5m')).toBe(30);
        });

        it('should return 60 days for 15m', () => {
            expect(getRecommendedWindowSize('15m')).toBe(60);
        });

        it('should return 90 days for 1h', () => {
            expect(getRecommendedWindowSize('1h')).toBe(90);
        });

        it('should default to 60 days for unknown intervals', () => {
            expect(getRecommendedWindowSize('4h' as any)).toBe(60);
        });
    });

    describe('doWindowsOverlap', () => {
        it('should detect overlapping windows', () => {
            const window1 = {
                id: 'w1',
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-02-01'),
                sizeInDays: 31,
            };

            const window2 = {
                id: 'w2',
                startDate: new Date('2024-01-15'),
                endDate: new Date('2024-02-15'),
                sizeInDays: 31,
            };

            expect(doWindowsOverlap(window1, window2)).toBe(true);
        });

        it('should return false for non-overlapping windows', () => {
            const window1 = {
                id: 'w1',
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-02-01'),
                sizeInDays: 31,
            };

            const window2 = {
                id: 'w2',
                startDate: new Date('2024-02-01'),
                endDate: new Date('2024-03-01'),
                sizeInDays: 29,
            };

            expect(doWindowsOverlap(window1, window2)).toBe(false);
        });

        it('should return false for adjacent windows (touching but not overlapping)', () => {
            const window1 = {
                id: 'w1',
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-02-01'),
                sizeInDays: 31,
            };

            const window2 = {
                id: 'w2',
                startDate: new Date('2024-02-01'),
                endDate: new Date('2024-03-01'),
                sizeInDays: 29,
            };

            expect(doWindowsOverlap(window1, window2)).toBe(false);
        });
    });
});
