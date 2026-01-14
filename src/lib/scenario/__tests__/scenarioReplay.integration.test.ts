/**
 * Scenario Replay Integration Tests
 * Tests frozen scenario replay mechanics with batch data
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createScenario, loadScenario, deleteScenario } from '@/lib/scenario/scenarioManager';
import { saveBatch, clearTickerBatches } from '@/lib/storage/indexedDB';
import type { BatchRecord } from '@/types/storage';
import type { Candle } from '@/types';

describe('Frozen Scenario Replay Integration', () => {
    const ticker = 'BBRI.JK';
    const interval = '5m' as const;

    // Generate realistic sequential candles for replay testing
    const generateSequentialCandles = (
        startTime: number,
        count: number,
        basePrice: number = 5000
    ): Candle[] => {
        const candles: Candle[] = [];
        let price = basePrice;

        for (let i = 0; i < count; i++) {
            const timestamp = startTime + i * 300000; // 5 minutes apart
            const change = (Math.random() - 0.5) * 50; // ±25 price movement
            const open = price;
            const close = price + change;
            const high = Math.max(open, close) + Math.random() * 20;
            const low = Math.min(open, close) - Math.random() * 20;
            const volume = Math.floor(1000000 + Math.random() * 2000000);

            candles.push({
                t: timestamp,
                o: Math.round(open),
                h: Math.round(high),
                l: Math.round(low),
                c: Math.round(close),
                v: volume,
            });

            price = close; // Next candle starts where this one ended
        }

        return candles;
    };

    beforeEach(async () => {
        await clearTickerBatches(ticker);
    });

    describe('Scenario Creation from Batches', () => {
        it('should create frozen scenario from single batch', async () => {
            const startTime = new Date('2024-01-01T09:00:00Z').getTime();
            const candles = generateSequentialCandles(startTime, 50, 5200);

            // Save batch
            const batch: BatchRecord = {
                id: `${ticker}_${interval}_2024-01-01`,
                ticker,
                interval,
                windowId: '2024-01-01',
                startTime: candles[0].t,
                endTime: candles[candles.length - 1].t,
                data: candles,
                downloadedAt: Date.now(),
                checksum: 'test-checksum',
                candleCount: candles.length,
            };

            await saveBatch(batch);

            // Create scenario
            const scenario = await createScenario(
                'BBRI January Morning Session',
                ticker,
                interval,
                ['2024-01-01'],
                {
                    description: 'Morning trading session replay',
                    difficulty: 'easy',
                    tags: ['morning', 'banking'],
                }
            );

            // Verify scenario is frozen (immutable)
            expect(scenario.candles).toHaveLength(50);
            expect(scenario.candles[0].t).toBe(startTime);
            expect(scenario.totalCandles).toBe(50);
            expect(Object.isFrozen(scenario.candles)).toBe(true); // Deep freeze check
        });

        it('should create frozen scenario from multiple batches in chronological order', async () => {
            const baseTime = new Date('2024-01-01T09:00:00Z').getTime();

            // Morning session
            const morningCandles = generateSequentialCandles(baseTime, 30, 5200);

            // Afternoon session (starts after morning ends)
            const afternoonStart = morningCandles[morningCandles.length - 1].t + 300000;
            const afternoonCandles = generateSequentialCandles(afternoonStart, 20, morningCandles[morningCandles.length - 1].c);

            // Save both batches
            await saveBatch({
                id: `${ticker}_${interval}_morning`,
                ticker,
                interval,
                windowId: 'morning',
                startTime: morningCandles[0].t,
                endTime: morningCandles[morningCandles.length - 1].t,
                data: morningCandles,
                downloadedAt: Date.now(),
                checksum: 'morning-checksum',
                candleCount: morningCandles.length,
            });

            await saveBatch({
                id: `${ticker}_${interval}_afternoon`,
                ticker,
                interval,
                windowId: 'afternoon',
                startTime: afternoonCandles[0].t,
                endTime: afternoonCandles[afternoonCandles.length - 1].t,
                data: afternoonCandles,
                downloadedAt: Date.now(),
                checksum: 'afternoon-checksum',
                candleCount: afternoonCandles.length,
            });

            // Create scenario from both batches
            const scenario = await createScenario(
                'BBRI Full Day Trading',
                ticker,
                interval,
                ['morning', 'afternoon']
            );

            // Verify chronological order
            expect(scenario.totalCandles).toBe(50);
            expect(scenario.candles).toHaveLength(50);

            // First candle should be from morning
            expect(scenario.candles[0].t).toBe(morningCandles[0].t);

            // 30th candle should be last of morning
            expect(scenario.candles[29].t).toBe(morningCandles[29].t);

            // 31st candle should be first of afternoon
            expect(scenario.candles[30].t).toBe(afternoonCandles[0].t);

            // Last candle should be from afternoon
            expect(scenario.candles[49].t).toBe(afternoonCandles[19].t);

            // Verify timestamps are strictly increasing
            for (let i = 1; i < scenario.candles.length; i++) {
                expect(scenario.candles[i].t).toBeGreaterThan(scenario.candles[i - 1].t);
            }
        });
    });

    describe('Replay Mechanics', () => {
        let scenarioId: string;
        let originalCandles: Candle[];

        beforeEach(async () => {
            // Setup: Create a frozen scenario
            const startTime = new Date('2024-01-01T09:00:00Z').getTime();
            originalCandles = generateSequentialCandles(startTime, 100, 5200);

            const batch: BatchRecord = {
                id: `${ticker}_${interval}_replay-test`,
                ticker,
                interval,
                windowId: 'replay-test',
                startTime: originalCandles[0].t,
                endTime: originalCandles[originalCandles.length - 1].t,
                data: originalCandles,
                downloadedAt: Date.now(),
                checksum: 'replay-checksum',
                candleCount: originalCandles.length,
            };

            await saveBatch(batch);

            const scenario = await createScenario(
                'Replay Test Scenario',
                ticker,
                interval,
                ['replay-test']
            );

            scenarioId = scenario.id;
        });

        afterEach(async () => {
            if (scenarioId) {
                await deleteScenario(scenarioId);
            }
        });

        it('should load frozen scenario with immutable candles', async () => {
            const loadedScenario = await loadScenario(scenarioId);

            expect(loadedScenario).toBeDefined();
            expect(loadedScenario!.candles).toHaveLength(100);
            expect(loadedScenario!.totalCandles).toBe(100);

            // Candles should be deeply frozen
            expect(Object.isFrozen(loadedScenario!.candles)).toBe(true);

            // Individual candles should be frozen
            expect(Object.isFrozen(loadedScenario!.candles[0])).toBe(true);

            // Attempt to modify should fail silently (or throw in strict mode)
            expect(() => {
                (loadedScenario!.candles as any)[0] = { t: 999, o: 999, h: 999, l: 999, c: 999, v: 999 };
            }).not.toThrow(); // In non-strict mode, assignment is ignored

            // Verify data remains unchanged
            expect(loadedScenario!.candles[0].t).toBe(originalCandles[0].t);
        });

        it('should simulate progressive reveal (replay slice)', async () => {
            const loadedScenario = await loadScenario(scenarioId);
            expect(loadedScenario).toBeDefined();

            // Simulate replay: reveal candles progressively
            const replayStates: Candle[][] = [];

            // Start with 10 candles
            replayStates.push(loadedScenario!.candles.slice(0, 10));

            // Progress to 50 candles
            replayStates.push(loadedScenario!.candles.slice(0, 50));

            // Complete replay (100 candles)
            replayStates.push(loadedScenario!.candles.slice(0, 100));

            // Verify progressive states
            expect(replayStates[0]).toHaveLength(10);
            expect(replayStates[1]).toHaveLength(50);
            expect(replayStates[2]).toHaveLength(100);

            // Verify data integrity at each state
            expect(replayStates[0][0].t).toBe(originalCandles[0].t);
            expect(replayStates[1][49].t).toBe(originalCandles[49].t);
            expect(replayStates[2][99].t).toBe(originalCandles[99].t);
        });

        it('should support time-based replay progression', async () => {
            const loadedScenario = await loadScenario(scenarioId);
            expect(loadedScenario).toBeDefined();

            const allCandles = loadedScenario!.candles;
            const startTime = allCandles[0].t;
            const endTime = allCandles[allCandles.length - 1].t;

            // Simulate replay at 50% completion (time-wise)
            const midTime = startTime + (endTime - startTime) / 2;
            const visibleCandles = allCandles.filter(c => c.t <= midTime);

            // Should have roughly half the candles visible
            expect(visibleCandles.length).toBeGreaterThan(40);
            expect(visibleCandles.length).toBeLessThan(60);

            // All visible candles should be before mid-time
            visibleCandles.forEach(candle => {
                expect(candle.t).toBeLessThanOrEqual(midTime);
            });
        });

        it('should maintain data consistency across multiple loads', async () => {
            // Load scenario multiple times
            const load1 = await loadScenario(scenarioId);
            const load2 = await loadScenario(scenarioId);
            const load3 = await loadScenario(scenarioId);

            expect(load1).toBeDefined();
            expect(load2).toBeDefined();
            expect(load3).toBeDefined();

            // All loads should return identical data
            expect(load1!.candles).toEqual(load2!.candles);
            expect(load2!.candles).toEqual(load3!.candles);
            expect(load1!.totalCandles).toBe(load2!.totalCandles);
            expect(load2!.totalCandles).toBe(load3!.totalCandles);

            // Each load should be frozen independently
            expect(Object.isFrozen(load1!.candles)).toBe(true);
            expect(Object.isFrozen(load2!.candles)).toBe(true);
            expect(Object.isFrozen(load3!.candles)).toBe(true);
        });
    });

    describe('Replay Speed Simulation', () => {
        it('should calculate replay duration based on candle count and speed', async () => {
            const startTime = new Date('2024-01-01T09:00:00Z').getTime();
            const candles = generateSequentialCandles(startTime, 60, 5200); // 60 candles = 5 hours of 5m data

            const batch: BatchRecord = {
                id: `${ticker}_${interval}_speed-test`,
                ticker,
                interval,
                windowId: 'speed-test',
                startTime: candles[0].t,
                endTime: candles[candles.length - 1].t,
                data: candles,
                downloadedAt: Date.now(),
                checksum: 'speed-checksum',
                candleCount: candles.length,
            };

            await saveBatch(batch);

            const scenario = await createScenario(
                'Speed Test Scenario',
                ticker,
                interval,
                ['speed-test']
            );

            // Calculate actual time span of data
            const dataTimeSpanMs = candles[candles.length - 1].t - candles[0].t;
            const dataTimeSpanMinutes = dataTimeSpanMs / 60000;

            expect(dataTimeSpanMinutes).toBe(60 * 5 - 5); // 59 intervals = 295 minutes

            // Simulate different replay speeds
            const speeds = [1, 2, 5, 10]; // 1x, 2x, 5x, 10x
            const replayDurations = speeds.map(speed => dataTimeSpanMs / speed);

            // At 10x speed, 295 minutes of data should replay in ~29.5 minutes
            expect(replayDurations[3]).toBe(dataTimeSpanMs / 10);
            expect(replayDurations[3] / 60000).toBeCloseTo(29.5, 1);

            await deleteScenario(scenario.id);
        });

        it('should support pause and resume (state preservation)', async () => {
            const startTime = new Date('2024-01-01T09:00:00Z').getTime();
            const candles = generateSequentialCandles(startTime, 50, 5200);

            const batch: BatchRecord = {
                id: `${ticker}_${interval}_pause-test`,
                ticker,
                interval,
                windowId: 'pause-test',
                startTime: candles[0].t,
                endTime: candles[candles.length - 1].t,
                data: candles,
                downloadedAt: Date.now(),
                checksum: 'pause-checksum',
                candleCount: candles.length,
            };

            await saveBatch(batch);

            const scenario = await createScenario(
                'Pause Test Scenario',
                ticker,
                interval,
                ['pause-test']
            );

            // Simulate replay state
            let currentIndex = 0;
            const replaySpeed = 2; // 2x

            // Play to index 20
            currentIndex = 20;
            const visibleAtPause = scenario.candles.slice(0, currentIndex);
            expect(visibleAtPause).toHaveLength(20);

            // Pause (save state)
            const pausedState = {
                scenarioId: scenario.id,
                currentIndex,
                replaySpeed,
            };

            // Resume (restore state)
            const resumedScenario = await loadScenario(pausedState.scenarioId);
            expect(resumedScenario).toBeDefined();

            const visibleAfterResume = resumedScenario!.candles.slice(0, pausedState.currentIndex);
            expect(visibleAfterResume).toEqual(visibleAtPause);

            // Continue from paused index
            currentIndex = 40;
            const visibleAfterContinue = resumedScenario!.candles.slice(0, currentIndex);
            expect(visibleAfterContinue).toHaveLength(40);

            await deleteScenario(scenario.id);
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty scenario gracefully', async () => {
            const batch: BatchRecord = {
                id: `${ticker}_${interval}_empty`,
                ticker,
                interval,
                windowId: 'empty',
                startTime: Date.now(),
                endTime: Date.now(),
                data: [], // Empty
                downloadedAt: Date.now(),
                checksum: 'empty-checksum',
                candleCount: 0,
            };

            await saveBatch(batch);

            const scenario = await createScenario(
                'Empty Scenario',
                ticker,
                interval,
                ['empty']
            );

            expect(scenario.candles).toHaveLength(0);
            expect(scenario.totalCandles).toBe(0);

            await deleteScenario(scenario.id);
        });

        it('should handle single candle scenario', async () => {
            const singleCandle: Candle = {
                t: Date.now(),
                o: 5000,
                h: 5100,
                l: 4900,
                c: 5050,
                v: 1000000,
            };

            const batch: BatchRecord = {
                id: `${ticker}_${interval}_single`,
                ticker,
                interval,
                windowId: 'single',
                startTime: singleCandle.t,
                endTime: singleCandle.t,
                data: [singleCandle],
                downloadedAt: Date.now(),
                checksum: 'single-checksum',
                candleCount: 1,
            };

            await saveBatch(batch);

            const scenario = await createScenario(
                'Single Candle Scenario',
                ticker,
                interval,
                ['single']
            );

            expect(scenario.candles).toHaveLength(1);
            expect(scenario.candles[0]).toEqual(singleCandle);

            await deleteScenario(scenario.id);
        });
    });
});
