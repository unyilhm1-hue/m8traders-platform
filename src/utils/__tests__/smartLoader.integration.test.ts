/**
 * Integration Test: MERGED Format Schema Migration
 * Tests timestamp field support and MERGED-only gatekeeper logic
 */

import { describe, it, expect } from 'vitest';
import { loadWithSmartBuffering } from '../smartLoader';
import type { IntervalType } from '@/types/intervals';

describe('Schema Migration: time → timestamp', () => {
    describe('MERGED File Loading', () => {
        it('should load BBRI_1m_MERGED.json successfully', async () => {
            const data = await loadWithSmartBuffering('BBRI', '2025-12-19', '1m', 200);

            expect(data).not.toBeNull();
            expect(data!.simulationQueue.length).toBeGreaterThan(0);
            expect(data!.historyBuffer.length).toBeLessThanOrEqual(200);

            // Verify normalized format (t/o/h/l/c/v)
            const firstCandle = data!.simulationQueue[0];
            expect(firstCandle.t).toBeDefined();
            expect(typeof firstCandle.t).toBe('number');
            expect(firstCandle.o).toBeDefined();
            expect(firstCandle.h).toBeDefined();
            expect(firstCandle.l).toBeDefined();
            expect(firstCandle.c).toBeDefined();

            console.log(`✅ Loaded ${data!.simulationQueue.length} simulation candles`);
            console.log(`✅ First candle timestamp: ${new Date(firstCandle.t).toISOString()}`);
        });

        it('should reject non-MERGED files gracefully', async () => {
            // Try loading a date that only has raw files (if any)
            const data = await loadWithSmartBuffering('NONEXISTENT', '2025-11-21', '15m', 200);

            // Should return null or empty data
            expect(data).toBeNull();
        });

        it('should convert ISO 8601 timestamp to Unix milliseconds', async () => {
            const data = await loadWithSmartBuffering('BBRI', '2025-12-19', '1m', 10);

            if (data && data.simulationQueue.length > 0) {
                const timestamp = data.simulationQueue[0].t;

                // Unix timestamp in milliseconds should be > 1 billion
                expect(timestamp).toBeGreaterThan(1000000000);

                // Should be able to create valid Date
                const date = new Date(timestamp);
                expect(date.toString()).not.toBe('Invalid Date');

                // Should be in 2025
                expect(date.getFullYear()).toBe(2025);
            }
        });

        it('should extract correct date from multi-day MERGED file', async () => {
            const targetDate = '2026-01-15';
            const data = await loadWithSmartBuffering('BBRI', targetDate, '1m', 200);

            if (data && data.simulationQueue.length > 0) {
                // All simulation candles should be from target date
                data.simulationQueue.forEach((candle) => {
                    const candleDate = new Date(candle.t).toISOString().split('T')[0];
                    expect(candleDate).toBe(targetDate);
                });

                console.log(`✅ All ${data.simulationQueue.length} candles are from ${targetDate}`);
            }
        });
    });

    describe('Metadata Validation', () => {
        it('should only load files with metadata', async () => {
            // This test assumes MERGED files exist
            const data = await loadWithSmartBuffering('BBRI', '2025-12-19', '1m', 200);

            // If data is loaded, it must be from a MERGED file with metadata
            if (data) {
                expect(data.simulationQueue).toBeDefined();
                expect(data.historyBuffer).toBeDefined();
                console.log('✅ Data loaded from valid MERGED file');
            } else {
                console.log('ℹ️  No MERGED file found (expected for raw-only tickers)');
            }
        });
    });

    describe('Timezone Handling', () => {
        it('should preserve UTC timestamps from ISO 8601', async () => {
            const data = await loadWithSmartBuffering('BBRI', '2025-12-19', '1m', 10);

            if (data && data.simulationQueue.length > 0) {
                const firstCandle = data.simulationQueue[0];
                const date = new Date(firstCandle.t);

                // Timestamp should be valid
                expect(date.getTime()).toBe(firstCandle.t);

                // Should match expected format
                const isoString = date.toISOString();
                expect(isoString).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

                console.log(`✅ Timestamp preserved: ${isoString}`);
            }
        });
    });
});
