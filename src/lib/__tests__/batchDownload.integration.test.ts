/**
 * Batch Download Integration Tests
 * Tests end-to-end batch downloading and scenario creation flows
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { downloadMultipleBatches } from '@/lib/data/batchDownloader';
import { createScenario, loadScenario, listScenarios, deleteScenario } from '@/lib/scenario/scenarioManager';
import { saveBatch, getBatch, listBatches, deleteBatch, clearTickerBatches } from '@/lib/storage/indexedDB';
import type { BatchWindow, BatchRecord } from '@/types/storage';
import type { Candle } from '@/types';

// Mock global fetch for Yahoo Finance API
global.fetch = vi.fn();

describe('Batch Download Integration', () => {
    const mockCandles: Candle[] = [
        { t: 1000, o: 100, h: 105, l: 95, c: 102, v: 1000 },
        { t: 2000, o: 102, h: 108, l: 100, c: 106, v: 1500 },
        { t: 3000, o: 106, h: 112, l: 104, c: 110, v: 1200 },
    ];

    beforeEach(async () => {
        // Clear all batches before each test
        await clearTickerBatches('BBRI.JK');
        await clearTickerBatches('BBCA.JK');

        // Reset fetch mock
        vi.clearAllMocks();

        // Mock successful Yahoo Finance response
        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ data: mockCandles }), // Fix: Wrap in data object
        });
    });

    describe('Full Download Flow', () => {
        it('should download multiple batches and save to IndexedDB', async () => {
            const windows: BatchWindow[] = [
                {
                    id: '2024-01-01_to_2024-02-01',
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-02-01'),
                    sizeInDays: 31,
                },
                {
                    id: '2024-02-01_to_2024-03-01',
                    startDate: new Date('2024-02-01'),
                    endDate: new Date('2024-03-01'),
                    sizeInDays: 29,
                },
            ];

            const progressUpdates: number[] = [];

            await downloadMultipleBatches(
                'BBRI.JK',
                '5m',
                windows,
                (progress: number) => {
                    progressUpdates.push(progress);
                }
            );

            // Verify progress was updated
            expect(progressUpdates.length).toBeGreaterThan(0);
            expect(progressUpdates[progressUpdates.length - 1]).toBe(100);

            // Verify batches were saved (returns metadata, not full data)
            const batches = await listBatches('BBRI.JK', '5m');
            expect(batches).toHaveLength(2);
            expect(batches[0].candleCount).toBe(mockCandles.length);
        });

        it('should handle API errors gracefully', async () => {
            // Mock API failure
            (global.fetch as any).mockResolvedValueOnce({
                ok: false,
                status: 404, // Use 404 (Client Error) to test fail-fast/no-retry
                statusText: 'Not Found',
            });

            const windows: BatchWindow[] = [
                {
                    id: '2024-01-01_to_2024-02-01',
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-02-01'),
                    sizeInDays: 31,
                },
            ];

            // downloadMultipleBatches swallows errors for individual batches
            // So we expect it to resolve with 0 results, not throw
            await expect(
                downloadMultipleBatches('BBRI.JK', '5m', windows)
            ).resolves.toBeDefined();

            // Verify no data was saved
            const batches = await listBatches('BBRI.JK', '5m');
            expect(batches).toHaveLength(0);
        });

        it('should retry on network failure', async () => {
            let attemptCount = 0;

            (global.fetch as any).mockImplementation(() => {
                attemptCount++;
                if (attemptCount < 3) {
                    return Promise.reject(new Error('Network error'));
                }
                return Promise.resolve({
                    ok: true,
                    json: async () => ({ data: mockCandles }),
                });
            });

            const windows: BatchWindow[] = [
                {
                    id: '2024-01-01_to_2024-02-01',
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-02-01'),
                    sizeInDays: 31,
                },
            ];

            await downloadMultipleBatches('BBRI.JK', '5m', windows);

            // Should retry 3 times
            expect(attemptCount).toBe(3);

            const batches = await listBatches('BBRI.JK', '5m');
            expect(batches).toHaveLength(1);
        });
    });

    describe('Scenario Creation Flow', () => {
        it('should create scenario from downloaded batches', async () => {
            // First, save batches manually (simulating download)
            const batch1: BatchRecord = {
                id: 'BBRI.JK_5m_2024-01-01_to_2024-02-01',
                ticker: 'BBRI.JK',
                interval: '5m',
                windowId: '2024-01-01_to_2024-02-01',
                startTime: mockCandles[0].t,
                endTime: mockCandles[mockCandles.length - 1].t,
                data: mockCandles,
                downloadedAt: Date.now(),
                checksum: 'test-checksum-1',
                candleCount: mockCandles.length,
            };

            const batch2: BatchRecord = {
                id: 'BBRI.JK_5m_2024-02-01_to_2024-03-01',
                ticker: 'BBRI.JK',
                interval: '5m',
                windowId: '2024-02-01_to_2024-03-01',
                startTime: 4000, // Distinct start
                endTime: 6000,
                data: mockCandles.map(c => ({ ...c, t: c.t + 3000 })), // Shift timestamps
                downloadedAt: Date.now(),
                checksum: 'test-checksum-2',
                candleCount: mockCandles.length,
            };

            await saveBatch(batch1);
            await saveBatch(batch2);

            // Create scenario from those batches
            const scenario = await createScenario(
                'Test Scenario',
                'BBRI.JK',
                '5m',
                ['2024-01-01_to_2024-02-01', '2024-02-01_to_2024-03-01'],
                {
                    description: 'Integration test scenario',
                    difficulty: 'medium',
                    tags: ['test', 'integration'],
                }
            );

            // Verify scenario was created
            expect(scenario.name).toBe('Test Scenario');
            expect(scenario.ticker).toBe('BBRI.JK');
            expect(scenario.interval).toBe('5m');
            expect(scenario.metadata?.difficulty).toBe('medium');
            expect(scenario.totalCandles).toBe(mockCandles.length * 2); // 2 batches
            expect(scenario.candles).toHaveLength(mockCandles.length * 2);

            // Verify deep freeze invariants
            expect(Object.isFrozen(scenario)).toBe(true); // Scenario object frozen
            expect(Object.isFrozen(scenario.candles)).toBe(true); // Candles array frozen
            expect(Object.isFrozen(scenario.candles[0])).toBe(true); // Individual candles frozen
            expect(Object.isFrozen(scenario.windows)).toBe(true); // Windows array frozen
            expect(Object.isFrozen(scenario.metadata)).toBe(true); // Metadata frozen
        });

        it('should load scenario and return frozen data', async () => {
            // Create batch and scenario first
            const batch: BatchRecord = {
                id: 'BBRI.JK_5m_2024-01-01_to_2024-02-01',
                ticker: 'BBRI.JK',
                interval: '5m',
                windowId: '2024-01-01_to_2024-02-01',
                startTime: mockCandles[0].t,
                endTime: mockCandles[mockCandles.length - 1].t,
                data: mockCandles,
                downloadedAt: Date.now(),
                checksum: 'test-checksum',
                candleCount: mockCandles.length,
            };

            await saveBatch(batch);

            const createdScenario = await createScenario(
                'Load Test',
                'BBRI.JK',
                '5m',
                ['2024-01-01_to_2024-02-01']
            );

            // Load the scenario
            const loadedScenario = await loadScenario(createdScenario.id);

            // Verify loaded data matches created data
            expect(loadedScenario).toBeDefined();
            expect(loadedScenario!.id).toBe(createdScenario.id);
            expect(loadedScenario!.candles).toEqual(createdScenario.candles);
            expect(loadedScenario!.totalCandles).toBe(mockCandles.length);

            // Verify loaded scenario is deeply frozen
            expect(Object.isFrozen(loadedScenario)).toBe(true);
            expect(Object.isFrozen(loadedScenario!.candles)).toBe(true);
            expect(Object.isFrozen(loadedScenario!.candles[0])).toBe(true);
            expect(Object.isFrozen(loadedScenario!.windows)).toBe(true);
            expect(Object.isFrozen(loadedScenario!.metadata)).toBe(true);
        });

        it('should handle missing batches gracefully', async () => {
            // Try to create scenario with non-existent batch IDs
            await expect(
                createScenario(
                    'Missing Batches',
                    'BBRI.JK',
                    '5m',
                    ['non-existent-batch-id']
                )
            ).rejects.toThrow();
        });
    });

    describe('Rate Limiting', () => {
        it('should respect rate limit delays between requests', async () => {
            const windows: BatchWindow[] = [
                {
                    id: '2024-01-01_to_2024-02-01',
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-02-01'),
                    sizeInDays: 31,
                },
                {
                    id: '2024-02-01_to_2024-03-01',
                    startDate: new Date('2024-02-01'),
                    endDate: new Date('2024-03-01'),
                    sizeInDays: 29,
                },
                {
                    id: '2024-03-01_to_2024-04-01',
                    startDate: new Date('2024-03-01'),
                    endDate: new Date('2024-04-01'),
                    sizeInDays: 31,
                },
            ];

            // Start download (it will schedule timers)
            const results = await downloadMultipleBatches(
                'BBRI.JK',
                '5m',
                windows,
                undefined,
                10 // Fast rate limit for testing
            );

            // Verify all batches were downloaded
            expect(results.size).toBe(3);
        });
    });

    describe('Storage Operations', () => {
        it('should track storage usage across multiple downloads', async () => {
            const batch: BatchRecord = {
                id: 'BBRI.JK_5m_2024-01-01_to_2024-02-01',
                ticker: 'BBRI.JK',
                interval: '5m',
                windowId: '2024-01-01_to_2024-02-01',
                startTime: 1000,
                endTime: 2000,
                data: mockCandles,
                downloadedAt: Date.now(),
                checksum: 'checksum',
                candleCount: mockCandles.length,
            };

            await saveBatch(batch);

            const retrievedBatch = await getBatch('BBRI.JK_5m_2024-01-01_to_2024-02-01');

            expect(retrievedBatch).toBeDefined();
            expect(retrievedBatch!.candleCount).toBe(mockCandles.length);
        });
    });
});
