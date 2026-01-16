/**
 * Master Blueprint Integration Tests
 * ==================================
 * Tests for all Master Blueprint components
 * 
 * Run: npm test src/utils/__tests__/masterBlueprint.integration.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { resampleCandles, getAvailableIntervals, INTERVAL_COMPATIBILITY } from '../candleResampler';
import type { Candle, Interval } from '../candleResampler';

describe('Master Blueprint: Phase 1 - Data Layer & Resampling', () => {
    describe('Resampling Algorithm', () => {
        // Create test data with sufficient candles (50 candles = 50 minutes)
        const testCandles: Candle[] = Array.from({ length: 50 }, (_, i) => ({
            time: (i + 1) * 60000, // Every minute
            open: 100 + (i % 10),
            high: 105 + (i % 10),
            low: 95 + (i % 10),
            close: 102 + (i % 10),
            volume: 1000 + (i * 10)
        }));

        it('should correctly aggregate OHLCV for 1m → 5m resampling', () => {
            const resampled = resampleCandles(testCandles, '1m', '5m');

            // 50 candles / 5 = 10 candles
            expect(resampled).toHaveLength(10);

            // Verify first resampled candle's OHLCV
            const first = resampled[0];
            const firstBucket = testCandles.slice(0, 5);

            expect(first.open).toBe(firstBucket[0].open);  // First candle's open
            expect(first.close).toBe(firstBucket[4].close);  // Last candle's close
            expect(first.high).toBe(Math.max(...firstBucket.map(c => c.high)));  // Max high
            expect(first.low).toBe(Math.min(...firstBucket.map(c => c.low)));  // Min low
            expect(first.volume).toBe(firstBucket.reduce((sum, c) => sum + c.volume, 0));  // Sum volume
        });

        it('should maintain candle count ratio (5:1 for 1m → 5m)', () => {
            const candles60m: Candle[] = Array.from({ length: 60 }, (_, i) => ({
                time: i * 60000,
                open: 100,
                high: 105,
                low: 95,
                close: 100,
                volume: 1000
            }));

            const resampled = resampleCandles(candles60m, '1m', '5m');

            // Verify correct candle count
            expect(resampled).toHaveLength(12); // 60 / 5 = 12

            // Verify OHLCV values for uniform data
            expect(resampled[0].open).toBe(100);
            expect(resampled[0].close).toBe(100);
            expect(resampled[0].high).toBe(105);
            expect(resampled[0].low).toBe(95);
            expect(resampled[0].volume).toBe(5000); // 1000 * 5
        });

        it('should throw error for incompatible interval pairs', () => {
            expect(() => {
                resampleCandles(testCandles, '2m', '5m');
            }).toThrow(/Cannot resample from 2m to 5m/); // 2m cannot resample to 5m (odd multiple)
        });

        it('should handle edge case: same interval (no resampling)', () => {
            const resampled = resampleCandles(testCandles, '1m', '1m');
            expect(resampled).toHaveLength(testCandles.length);
            expect(resampled[0].open).toBe(testCandles[0].open);
        });
    });

    describe('Interval Compatibility Matrix', () => {
        it('should allow 1m to resample to any interval (universal)', () => {
            const allowed = INTERVAL_COMPATIBILITY['1m'];
            expect(allowed).toContain('1m');
            expect(allowed).toContain('2m');
            expect(allowed).toContain('5m');
            expect(allowed).toContain('15m');
            expect(allowed).toContain('30m');
            expect(allowed).toContain('60m');
        });

        it('should restrict 2m to even multiples only', () => {
            const allowed = INTERVAL_COMPATIBILITY['2m'];
            expect(allowed).toContain('2m');
            expect(allowed).toContain('30m');  // 15 * 2m
            expect(allowed).toContain('60m');  // 30 * 2m
            expect(allowed).not.toContain('5m');  // Odd multiple
            expect(allowed).not.toContain('15m'); // Odd multiple
        });

        it('should restrict 5m to multiples of 5 only', () => {
            const allowed = INTERVAL_COMPATIBILITY['5m'];
            expect(allowed).toContain('5m');
            expect(allowed).toContain('15m');  // 3 * 5m
            expect(allowed).toContain('30m');  // 6 * 5m
            expect(allowed).toContain('60m');  // 12 * 5m
            expect(allowed).not.toContain('2m');
        });
    });

    describe('Data Span Validation', () => {
        it('should enable intervals with sufficient data (>= 10 candles)', () => {
            const candles: Candle[] = Array.from({ length: 60 }, (_, i) => ({
                time: (i + 1) * 60000,
                open: 100,
                high: 105,
                low: 95,
                close: 100,
                volume: 1000
            }));

            const states = getAvailableIntervals('1m', candles);

            // 60 * 1m = 60 minutes
            // Can make 12 candles at 5m (60 / 5) ✅
            const fiveMinState = states.find(s => s.value === '5m');
            expect(fiveMinState?.enabled).toBe(true);

            // Can make 2 candles at 30m (60 / 30) ❌ (< 10)
            const thirtyMinState = states.find(s => s.value === '30m');
            expect(thirtyMinState?.enabled).toBe(false);
            expect(thirtyMinState?.reason).toContain('need 10+ candles');
        });

        it('should disable intervals with insufficient data (< 10 candles)', () => {
            const candles: Candle[] = Array.from({ length: 30 }, (_, i) => ({
                time: (i + 1) * 60000,
                open: 100,
                high: 105,
                low: 95,
                close: 100,
                volume: 1000
            }));

            const states = getAvailableIntervals('1m', candles);

            // 30 * 1m = 30 minutes
            // Can make 0.5 candles at 60m ❌
            const sixtyMinState = states.find(s => s.value === '60m');
            expect(sixtyMinState?.enabled).toBe(false);
        });
    });
});

describe('Master Blueprint: Phase 2 - Organic Movement', () => {
    describe('Simplex Noise Integration', () => {
        it('should have simplex-noise package installed', async () => {
            // Check if package is available
            const packageJson = await import('../../../package.json');
            expect(packageJson.dependencies).toHaveProperty('simplex-noise');
        });

        // Note: Worker tests require more complex setup with worker mocking
        // For now, we verify package presence
    });
});

describe('Master Blueprint: Phase 3 - Analytics', () => {
    describe('Trade Analytics Utilities', () => {
        it('should be importable without errors', async () => {
            const analytics = await import('../tradeAnalytics');

            expect(analytics.detectRevengeTradingPattern).toBeDefined();
            expect(analytics.analyzeTimeframeSuitability).toBeDefined();
            expect(analytics.detectCutProfitEarly).toBeDefined();
            expect(analytics.analyzeTradingPsychology).toBeDefined();
        });
    });
});

describe('Master Blueprint: Integration Health', () => {
    it('should have all utility modules available', async () => {
        const smartBuffer = await import('../smartBuffer');
        const candleResampler = await import('../candleResampler');
        const tradeAnalytics = await import('../tradeAnalytics');

        expect(smartBuffer.loadWithBuffer).toBeDefined();
        expect(candleResampler.resampleCandles).toBeDefined();
        expect(tradeAnalytics.analyzeTradingPsychology).toBeDefined();
    });

    it('should have verification utilities available', async () => {
        const verify = await import('../verifyMasterBlueprint');

        expect(verify.verifyMasterBlueprint).toBeDefined();
        expect(verify.verifySmartBuffering).toBeDefined();
        expect(verify.verifyResamplingAccuracy).toBeDefined();
        expect(verify.verifyIntegration).toBeDefined();
    });
});
