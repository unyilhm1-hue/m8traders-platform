/**
 * Resampler Unit Tests
 * Tests for OHLC aggregation and timeframe conversion
 */

import { describe, it, expect } from 'vitest';
import {
    resample,
    validateResample,
    estimateResampledCount,
} from '../resampler';
import type { Candle } from '@/types';

describe('Resampler', () => {
    const createCandle = (
        timestamp: number,
        open: number,
        high: number,
        low: number,
        close: number,
        volume: number = 1000
    ): Candle => ({
        t: timestamp,
        o: open,
        h: high,
        l: low,
        c: close,
        v: volume,
    });

    describe('resample', () => {
        it('should convert 5x 1m candles → 1x 5m candle', () => {
            const oneMin = 60 * 1000;
            const base = new Date('2024-01-01T09:00:00Z').getTime();

            const candles1m: Candle[] = [
                createCandle(base, 100, 105, 95, 102, 1000),
                createCandle(base + oneMin, 102, 108, 100, 106, 1500),
                createCandle(base + oneMin * 2, 106, 112, 104, 110, 1200),
                createCandle(base + oneMin * 3, 110, 115, 108, 112, 1300),
                createCandle(base + oneMin * 4, 112, 118, 110, 115, 1100),
            ];

            const candles5m = resample(candles1m, '5m');

            expect(candles5m).toHaveLength(1);
            expect(candles5m[0].o).toBe(100); // First candle's open
            expect(candles5m[0].h).toBe(118); // Max of all highs
            expect(candles5m[0].l).toBe(95); // Min of all lows
            expect(candles5m[0].c).toBe(115); // Last candle's close
            expect(candles5m[0].v).toBe(6100); // Sum of all volumes
        });

        it('should aggregate OHLC correctly', () => {
            const oneMin = 60 * 1000;
            const base = new Date('2024-01-01T09:00:00Z').getTime();

            const candles: Candle[] = [
                createCandle(base, 50, 55, 48, 52, 100),
                createCandle(base + oneMin, 52, 60, 50, 58, 150),
                createCandle(base + oneMin * 2, 58, 62, 56, 60, 120),
            ];

            const resampled = resample(candles, '5m');

            // Open = first's open (50)
            expect(resampled[0].o).toBe(50);
            // High = max(55, 60, 62) = 62
            expect(resampled[0].h).toBe(62);
            // Low = min(48, 50, 56) = 48
            expect(resampled[0].l).toBe(48);
            // Close = last's close (60)
            expect(resampled[0].c).toBe(60);
            // Volume = sum(100 + 150 + 120) = 370
            expect(resampled[0].v).toBe(370);
        });

        it('should return same data for target === source timeframe', () => {
            const candles: Candle[] = [
                createCandle(1000, 100, 105, 95, 102),
                createCandle(2000, 102, 108, 100, 106),
            ];

            const resampled = resample(candles, '1m');

            expect(resampled).toEqual(candles);
        });

        it('should handle partial groups at end', () => {
            const oneMin = 60 * 1000;
            const base = new Date('2024-01-01T09:00:00Z').getTime();

            // 7 candles: should create 2 groups (5 + 2)
            const candles: Candle[] = [
                createCandle(base, 100, 105, 95, 102, 1000),
                createCandle(base + oneMin, 102, 108, 100, 106, 1000),
                createCandle(base + oneMin * 2, 106, 112, 104, 110, 1000),
                createCandle(base + oneMin * 3, 110, 115, 108, 112, 1000),
                createCandle(base + oneMin * 4, 112, 118, 110, 115, 1000),
                createCandle(base + oneMin * 5, 115, 120, 113, 117, 1000),
                createCandle(base + oneMin * 6, 117, 122, 115, 120, 1000),
            ];

            const resampled = resample(candles, '5m');

            expect(resampled).toHaveLength(2);
            expect(resampled[0].v).toBe(5000); // First 5 candles
            expect(resampled[1].v).toBe(2000); // Last 2 candles
        });

        it('should handle empty array', () => {
            const resampled = resample([], '5m');

            expect(resampled).toEqual([]);
        });

        it('should resample 1m → 15m correctly', () => {
            const oneMin = 60 * 1000;
            const base = new Date('2024-01-01T09:00:00Z').getTime();

            // Create 15 candles (1m each)
            const candles: Candle[] = Array.from({ length: 15 }, (_, i) =>
                createCandle(base + oneMin * i, 100 + i, 105 + i, 95 + i, 102 + i, 1000)
            );

            const resampled = resample(candles, '15m');

            expect(resampled).toHaveLength(1);
            expect(resampled[0].o).toBe(100); // First
            expect(resampled[0].h).toBe(119); // Max high (105 + 14)
            expect(resampled[0].l).toBe(95); // Min low
            expect(resampled[0].c).toBe(116); // Last close (102 + 14)
            expect(resampled[0].v).toBe(15000); // Sum
        });

        it('should align timestamps to interval boundaries', () => {
            const fiveMin = 5 * 60 * 1000;
            const base = new Date('2024-01-01T09:00:00Z').getTime();

            const candles: Candle[] = [
                createCandle(base, 100, 105, 95, 102),
                createCandle(base + 60000, 102, 108, 100, 106),
                createCandle(base + 120000, 106, 112, 104, 110),
            ];

            const resampled = resample(candles, '5m');

            expect(resampled[0].t % fiveMin).toBe(0); // Aligned to 5m boundary
        });
    });

    describe('validateResample', () => {
        it('should validate timestamp alignment', () => {
            const fiveMin = 5 * 60 * 1000; // 300000ms
            // Use a timestamp that's guaranteed to be aligned to 5m boundary
            const base = Math.floor(new Date('2024-01-01T09:00:00Z').getTime() / fiveMin) * fiveMin;

            const validCandles: Candle[] = [
                createCandle(base, 100, 105, 95, 102),
                createCandle(base + fiveMin, 102, 108, 100, 106),
            ];

            const invalidCandles: Candle[] = [
                createCandle(base + 1000, 100, 105, 95, 102), // Not aligned
            ];

            // Original must have same or more candles than resampled
            const original = [
                createCandle(base, 100, 105, 95, 102),
                createCandle(base + fiveMin, 102, 108, 100, 106),
            ];

            expect(validateResample(original, validCandles, '5m').valid).toBe(true);
            expect(validateResample(original, invalidCandles, '5m').valid).toBe(false);
        });

        it('should validate OHLC logic (high ≥ open/close)', () => {
            const fiveMin = 5 * 60 * 1000; // 300000ms
            const validCandle = createCandle(fiveMin * 10, 100, 110, 95, 105); // Aligned timestamp
            const invalidCandle = createCandle(fiveMin * 10, 100, 95, 90, 105); // High < open/close

            expect(validateResample([validCandle], [validCandle], '5m').valid).toBe(true);
            expect(validateResample([invalidCandle], [invalidCandle], '5m').valid).toBe(false);
            expect(validateResample([invalidCandle], [invalidCandle], '5m').issues).toContain(
                'High price is less than open or close'
            );
        });

        it('should validate OHLC logic (low ≤ open/close)', () => {
            const fiveMin = 5 * 60 * 1000; // 300000ms
            const invalidCandle = createCandle(fiveMin * 10, 100, 110, 105, 102); // Low > open/close

            expect(validateResample([invalidCandle], [invalidCandle], '5m').valid).toBe(false);
            expect(validateResample([invalidCandle], [invalidCandle], '5m').issues).toContain(
                'Low price is greater than open or close'
            );
        });

        it('should validate candle count reduction', () => {
            const original = Array(10).fill(null).map((_, i) =>
                createCandle(i * 60000, 100, 105, 95, 102)
            );
            const resampled = Array(15).fill(null).map((_, i) =>
                createCandle(i * 300000, 100, 105, 95, 102)
            );

            const result = validateResample(original, resampled, '5m');

            expect(result.valid).toBe(false);
            expect(result.issues).toContain('Resampled data has more candles than original');
        });
    });

    describe('estimateResampledCount', () => {
        it('should estimate 5x reduction for 1m → 5m', () => {
            const original = 100;
            const estimated = estimateResampledCount(original, '1m', '5m');

            expect(estimated).toBe(20); // 100 / 5 = 20
        });

        it('should estimate 15x reduction for 1m → 15m', () => {
            const original = 150;
            const estimated = estimateResampledCount(original, '1m', '15m');

            expect(estimated).toBe(10); // 150 / 15 = 10
        });

        it('should estimate 60x reduction for 1m → 1h', () => {
            const original = 600;
            const estimated = estimateResampledCount(original, '1m', '1h');

            expect(estimated).toBe(10); // 600 / 60 = 10
        });

        it('should handle partial groups with ceil', () => {
            const original = 103; // Not evenly divisible by 5
            const estimated = estimateResampledCount(original, '1m', '5m');

            expect(estimated).toBe(21); // ceil(103 / 5) = 21
        });

        it('should return same count for same timeframe', () => {
            const original = 100;
            const estimated = estimateResampledCount(original, '5m', '5m');

            expect(estimated).toBe(100);
        });
    });
});
