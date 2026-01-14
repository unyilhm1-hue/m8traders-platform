/**
 * DataMerger Unit Tests
 * Tests for batch merging, deduplication, and validation
 */

import { describe, it, expect } from 'vitest';
import {
    mergeBatches,
    deduplicateCandles,
    detectGaps,
    validateMergedData,
    getDataStats,
} from '../dataMerger';
import type { Candle } from '@/types';
import type { BatchRecord } from '@/types/storage';

describe('DataMerger', () => {
    const createCandle = (timestamp: number, open: number = 100): Candle => ({
        t: timestamp,
        o: open,
        h: open + 5,
        l: open - 5,
        c: open + 2,
        v: 1000,
    });

    const createBatch = (id: string, candles: Candle[]): BatchRecord => ({
        id,
        ticker: 'BBRI.JK',
        interval: '5m',
        windowId: 'test-window',
        startTime: candles[0]?.t || 0,
        endTime: candles[candles.length - 1]?.t || 0,
        data: candles,
        downloadedAt: Date.now(),
        checksum: 'test-checksum',
        candleCount: candles.length,
    });

    describe('mergeBatches', () => {
        it('should merge multiple batches in chronological order', () => {
            const batch1 = createBatch('b1', [
                createCandle(1000),
                createCandle(2000),
            ]);

            const batch2 = createBatch('b2', [
                createCandle(3000),
                createCandle(4000),
            ]);

            const merged = mergeBatches([batch1, batch2]);

            expect(merged).toHaveLength(4);
            expect(merged[0].t).toBe(1000);
            expect(merged[3].t).toBe(4000);
        });

        it('should handle single batch', () => {
            const batch = createBatch('b1', [
                createCandle(1000),
                createCandle(2000),
            ]);

            const merged = mergeBatches([batch]);

            expect(merged).toHaveLength(2);
            expect(merged).toEqual(batch.data);
        });

        it('should handle empty batch array', () => {
            const merged = mergeBatches([]);

            expect(merged).toHaveLength(0);
            expect(merged).toEqual([]);
        });

        it('should sort batches by start time', () => {
            // Create batches in reverse order
            const batch1 = createBatch('b1', [createCandle(5000), createCandle(6000)]);
            const batch2 = createBatch('b2', [createCandle(1000), createCandle(2000)]);
            const batch3 = createBatch('b3', [createCandle(3000), createCandle(4000)]);

            const merged = mergeBatches([batch1, batch2, batch3]);

            expect(merged).toHaveLength(6);
            expect(merged[0].t).toBe(1000);
            expect(merged[5].t).toBe(6000);
        });
    });

    describe('deduplicateCandles', () => {
        it('should remove duplicate timestamps', () => {
            const candles = [
                createCandle(1000, 100),
                createCandle(2000, 110),
                createCandle(2000, 115), // Duplicate timestamp
                createCandle(3000, 120),
            ];

            const deduped = deduplicateCandles(candles);

            expect(deduped).toHaveLength(3);
            expect(deduped.map((c) => c.t)).toEqual([1000, 2000, 3000]);
        });

        it('should keep first occurrence of duplicate', () => {
            const candles = [
                createCandle(1000, 100),
                createCandle(1000, 200), // Duplicate - should be removed
            ];

            const deduped = deduplicateCandles(candles);

            expect(deduped).toHaveLength(1);
            expect(deduped[0].o).toBe(100); // First occurrence kept
        });

        it('should sort by timestamp ascending', () => {
            const candles = [
                createCandle(3000),
                createCandle(1000),
                createCandle(2000),
            ];

            const deduped = deduplicateCandles(candles);

            expect(deduped[0].t).toBe(1000);
            expect(deduped[1].t).toBe(2000);
            expect(deduped[2].t).toBe(3000);
        });

        it('should handle empty array', () => {
            const deduped = deduplicateCandles([]);

            expect(deduped).toEqual([]);
        });
    });

    describe('detectGaps', () => {
        it('should detect weekend gaps (daily data)', () => {
            const candles = [
                createCandle(new Date('2024-01-05').getTime()), // Friday
                createCandle(new Date('2024-01-08').getTime()), // Monday (gap: Sat-Sun)
            ];

            const gaps = detectGaps(candles, 24 * 60 * 60 * 1000); // 1 day in ms

            expect(gaps).toHaveLength(1);
            expect(gaps[0].sizeDays).toBeGreaterThan(1);
        });

        it('should detect missing candles (intraday)', () => {
            const oneMinute = 60 * 1000;
            const candles = [
                createCandle(1000),
                createCandle(1000 + oneMinute * 5), // 5-minute gap (should be 1 minute)
            ];

            const gaps = detectGaps(candles, oneMinute, 10000); // 1-min interval, 10s tolerance

            expect(gaps).toHaveLength(1);
        });

        it('should return empty for continuous data', () => {
            const oneMinute = 60 * 1000;
            const candles = [
                createCandle(1000),
                createCandle(1000 + oneMinute),
                createCandle(1000 + oneMinute * 2),
            ];

            const gaps = detectGaps(candles, oneMinute, 10000);

            expect(gaps).toHaveLength(0);
        });

        it('should handle single candle', () => {
            const gaps = detectGaps([createCandle(1000)], 60000);

            expect(gaps).toHaveLength(0);
        });
    });

    describe('validateMergedData', () => {
        it('should pass for valid sorted deduplicated data', () => {
            const candles = [
                createCandle(1000),
                createCandle(2000),
                createCandle(3000),
            ];

            const result = validateMergedData(candles);

            expect(result.valid).toBe(true);
            expect(result.duplicates).toBe(0);
            expect(result.issues).toHaveLength(0);
        });

        it('should fail for duplicates', () => {
            const candles = [
                createCandle(1000),
                createCandle(2000),
                createCandle(2000), // Duplicate
            ];

            const result = validateMergedData(candles);

            expect(result.valid).toBe(false);
            expect(result.duplicates).toBe(1);
            expect(result.issues).toContain('Found 1 duplicate timestamps');
        });

        it('should fail for unsorted data', () => {
            const candles = [
                createCandle(3000),
                createCandle(1000),
                createCandle(2000),
            ];

            const result = validateMergedData(candles);

            expect(result.valid).toBe(false);
            expect(result.issues).toContain('Data is not sorted by timestamp');
        });

        it('should allow gaps (expected for weekends/holidays)', () => {
            const candles = [
                createCandle(new Date('2024-01-05').getTime()), // Friday
                createCandle(new Date('2024-01-08').getTime()), // Monday
            ];

            const result = validateMergedData(candles);

            // Gaps are noted but don't invalidate data
            expect(result.gaps).toBeGreaterThan(0);
            expect(result.valid).toBe(true); // Still valid despite gaps
        });
    });

    describe('getDataStats', () => {
        it('should calculate correct statistics', () => {
            const candles = [
                { t: 1000, o: 100, h: 110, l: 95, c: 105, v: 1000 },
                { t: 2000, o: 105, h: 120, l: 100, c: 115, v: 1500 },
                { t: 3000, o: 115, h: 125, l: 110, c: 120, v: 2000 },
            ];

            const stats = getDataStats(candles);

            expect(stats.count).toBe(3);
            expect(stats.startTime).toBe(1000);
            expect(stats.endTime).toBe(3000);
            expect(stats.priceRange.min).toBe(95);
            expect(stats.priceRange.max).toBe(125);
            expect(stats.volumeTotal).toBe(4500);
        });

        it('should handle empty array', () => {
            const stats = getDataStats([]);

            expect(stats.count).toBe(0);
            expect(stats.duration).toBe('0 days');
            expect(stats.volumeTotal).toBe(0);
        });

        it('should calculate duration correctly', () => {
            const oneDay = 24 * 60 * 60 * 1000;
            const candles = [
                createCandle(0),
                createCandle(oneDay * 30), // 30 days later
            ];

            const stats = getDataStats(candles);

            expect(stats.duration).toMatch(/30 days/);
        });
    });
});
