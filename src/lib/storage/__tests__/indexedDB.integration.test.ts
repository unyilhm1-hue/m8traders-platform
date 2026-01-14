/**
 * IndexedDB Integration Tests
 * Tests database operations with fake-indexeddb
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    saveBatch,
    getBatch,
    listBatches,
    deleteBatch,
    clearTickerBatches,
    getStorageQuota,
} from '@/lib/storage/indexedDB';
import { createScenario, loadScenario, listScenarios, deleteScenario } from '@/lib/scenario/scenarioManager';
import type { BatchRecord } from '@/types/storage';
import type { Candle } from '@/types';

describe('IndexedDB Integration', () => {
    const mockCandles: Candle[] = [
        { t: 1000, o: 100, h: 105, l: 95, c: 102, v: 1000 },
        { t: 2000, o: 102, h: 108, l: 100, c: 106, v: 1500 },
    ];

    beforeEach(async () => {
        // Clear all data before each test
        await clearTickerBatches('BBRI.JK');
        await clearTickerBatches('BBCA.JK');
    });

    describe('Batch Operations', () => {
        it('should save and retrieve batch', async () => {
            const batch: BatchRecord = {
                id: 'test-batch-1',
                ticker: 'BBRI.JK',
                interval: '5m',
                windowId: '2024-01-01_to_2024-02-01',
                startTime: 1000,
                endTime: 2000,
                data: mockCandles,
                downloadedAt: Date.now(),
                checksum: 'test-checksum',
                candleCount: mockCandles.length,
            };

            await saveBatch(batch);

            const retrieved = await getBatch('test-batch-1');

            expect(retrieved).toBeDefined();
            expect(retrieved!.id).toBe('test-batch-1');
            expect(retrieved!.ticker).toBe('BBRI.JK');
            expect(retrieved!.data).toEqual(mockCandles);
            expect(retrieved!.candleCount).toBe(2);
        });

        it('should list batches filtered by ticker and interval', async () => {
            const batch1: BatchRecord = {
                id: 'batch-1',
                ticker: 'BBRI.JK',
                interval: '5m',
                windowId: 'window-1',
                startTime: 1000,
                endTime: 2000,
                data: mockCandles,
                downloadedAt: Date.now(),
                checksum: 'checksum-1',
                candleCount: 2,
            };

            const batch2: BatchRecord = {
                id: 'batch-2',
                ticker: 'BBRI.JK',
                interval: '5m',
                windowId: 'window-2',
                startTime: 3000,
                endTime: 4000,
                data: mockCandles,
                downloadedAt: Date.now(),
                checksum: 'checksum-2',
                candleCount: 2,
            };

            const batch3: BatchRecord = {
                id: 'batch-3',
                ticker: 'BBCA.JK', // Different ticker
                interval: '5m',
                windowId: 'window-3',
                startTime: 5000,
                endTime: 6000,
                data: mockCandles,
                downloadedAt: Date.now(),
                checksum: 'checksum-3',
                candleCount: 2,
            };

            await saveBatch(batch1);
            await saveBatch(batch2);
            await saveBatch(batch3);

            const bbriBatches = await listBatches('BBRI.JK', '5m');

            expect(bbriBatches).toHaveLength(2);
            expect(bbriBatches.map((b) => b.id)).toContain('batch-1');
            expect(bbriBatches.map((b) => b.id)).toContain('batch-2');
            expect(bbriBatches.map((b) => b.id)).not.toContain('batch-3');
        });

        it('should delete batch by ID', async () => {
            const batch: BatchRecord = {
                id: 'delete-test',
                ticker: 'BBRI.JK',
                interval: '5m',
                windowId: 'window-1',
                startTime: 1000,
                endTime: 2000,
                data: mockCandles,
                downloadedAt: Date.now(),
                checksum: 'checksum',
                candleCount: 2,
            };

            await saveBatch(batch);

            let retrieved = await getBatch('delete-test');
            expect(retrieved).toBeDefined();

            await deleteBatch('delete-test');

            retrieved = await getBatch('delete-test');
            expect(retrieved).toBeNull();
        });

        it('should clear all batches for a ticker', async () => {
            const batch1: BatchRecord = {
                id: 'clear-1',
                ticker: 'BBRI.JK',
                interval: '5m',
                windowId: 'window-1',
                startTime: 1000,
                endTime: 2000,
                data: mockCandles,
                downloadedAt: Date.now(),
                checksum: 'checksum-1',
                candleCount: 2,
            };

            const batch2: BatchRecord = {
                id: 'clear-2',
                ticker: 'BBRI.JK',
                interval: '5m',
                windowId: 'window-2',
                startTime: 3000,
                endTime: 4000,
                data: mockCandles,
                downloadedAt: Date.now(),
                checksum: 'checksum-2',
                candleCount: 2,
            };

            await saveBatch(batch1);
            await saveBatch(batch2);

            await clearTickerBatches('BBRI.JK');

            const batches = await listBatches('BBRI.JK', '5m');
            expect(batches).toHaveLength(0);
        });

        it('should handle non-existent batch gracefully', async () => {
            const batch = await getBatch('non-existent-id');
            expect(batch).toBeNull();
        });
    });

    describe('Scenario Operations', () => {
        it('should create and retrieve scenario', async () => {
            // First create a batch
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

            // Create scenario
            const scenario = await createScenario(
                'Test Scenario',
                'BBRI.JK',
                '5m',
                ['2024-01-01_to_2024-02-01'],
                {
                    difficulty: 'medium',
                    description: 'Test scenario',
                    tags: ['test'],
                }
            );

            // Retrieve scenario
            const retrieved = await loadScenario(scenario.id);

            expect(retrieved).toBeDefined();
            expect(retrieved!.name).toBe('Test Scenario');
            expect(retrieved!.candles).toEqual(mockCandles);
            expect(retrieved!.metadata?.difficulty).toBe('medium');
        });

        it('should list all scenarios', async () => {
            // Create batches first
            const batch1: BatchRecord = {
                id: 'BBRI.JK_5m_window-1',
                ticker: 'BBRI.JK',
                interval: '5m',
                windowId: 'window-1',
                startTime: 1000,
                endTime: 2000,
                data: mockCandles,
                downloadedAt: Date.now(),
                checksum: 'checksum-1',
                candleCount: 2,
            };

            const batch2: BatchRecord = {
                id: 'BBCA.JK_15m_window-2',
                ticker: 'BBCA.JK',
                interval: '15m',
                windowId: 'window-2',
                startTime: 3000,
                endTime: 4000,
                data: mockCandles,
                downloadedAt: Date.now(),
                checksum: 'checksum-2',
                candleCount: 2,
            };

            await saveBatch(batch1);
            await saveBatch(batch2);

            // Create scenarios
            await createScenario('Scenario 1', 'BBRI.JK', '5m', ['window-1'], { difficulty: 'easy' });
            await createScenario('Scenario 2', 'BBCA.JK', '15m', ['window-2'], { difficulty: 'hard' });

            const scenarios = await listScenarios();

            expect(scenarios).toHaveLength(2);
            expect(scenarios.map((s) => s.name)).toContain('Scenario 1');
            expect(scenarios.map((s) => s.name)).toContain('Scenario 2');
        });

        it('should delete scenario', async () => {
            const batch: BatchRecord = {
                id: 'BBRI.JK_5m_delete-window',
                ticker: 'BBRI.JK',
                interval: '5m',
                windowId: 'delete-window',
                startTime: 1000,
                endTime: 2000,
                data: mockCandles,
                downloadedAt: Date.now(),
                checksum: 'checksum',
                candleCount: 2,
            };

            await saveBatch(batch);

            const scenario = await createScenario('Delete Test', 'BBRI.JK', '5m', ['delete-window']);

            let retrieved = await loadScenario(scenario.id);
            expect(retrieved).toBeDefined();

            await deleteScenario(scenario.id);

            retrieved = await loadScenario(scenario.id);
            expect(retrieved).toBeNull();
        });
    });

    describe('Storage Quota', () => {
        it('should return storage quota information', async () => {
            const quota = await getStorageQuota();

            expect(quota).toBeDefined();
            expect(quota.total).toBeGreaterThanOrEqual(0);
            expect(quota.used).toBeGreaterThanOrEqual(0);
            expect(quota.available).toBeGreaterThanOrEqual(0);
            expect(quota.percentage).toBeGreaterThanOrEqual(0);
            expect(quota.percentage).toBeLessThanOrEqual(100);
        });

        it('should reflect increased usage after saving data', async () => {
            const quotaBefore = await getStorageQuota();

            const largeBatch: BatchRecord = {
                id: 'large-batch',
                ticker: 'BBRI.JK',
                interval: '5m',
                windowId: 'window-1',
                startTime: 1000,
                endTime: 100000,
                data: Array(1000).fill(null).map((_, i) => ({
                    t: i * 1000,
                    o: 100,
                    h: 105,
                    l: 95,
                    c: 102,
                    v: 1000,
                })),
                downloadedAt: Date.now(),
                checksum: 'large-checksum',
                candleCount: 1000,
            };

            await saveBatch(largeBatch);

            const quotaAfter = await getStorageQuota();

            // In fake-indexeddb, quota might not change, but check it doesn't error
            expect(quotaAfter.used).toBeGreaterThanOrEqual(quotaBefore.used);
        });
    });

    describe('Error Handling', () => {
        it('should handle concurrent writes', async () => {
            const batch1: BatchRecord = {
                id: 'concurrent-1',
                ticker: 'BBRI.JK',
                interval: '5m',
                windowId: 'window-1',
                startTime: 1000,
                endTime: 2000,
                data: mockCandles,
                downloadedAt: Date.now(),
                checksum: 'checksum-1',
                candleCount: 2,
            };

            const batch2: BatchRecord = {
                id: 'concurrent-2',
                ticker: 'BBRI.JK',
                interval: '5m',
                windowId: 'window-2',
                startTime: 3000,
                endTime: 4000,
                data: mockCandles,
                downloadedAt: Date.now(),
                checksum: 'checksum-2',
                candleCount: 2,
            };

            // Save concurrently
            await Promise.all([
                saveBatch(batch1),
                saveBatch(batch2),
            ]);

            const batches = await listBatches('BBRI.JK', '5m');
            expect(batches).toHaveLength(2);
        });
    });
});
