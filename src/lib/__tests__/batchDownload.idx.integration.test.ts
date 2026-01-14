/**
 * Batch Download Integration Tests - IDX Stocks
 * Tests batch downloading with real Indonesian stock tickers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { downloadMultipleBatches, downloadBatch } from '@/lib/data/batchDownloader';
import { createScenario } from '@/lib/scenario/scenarioManager';
import { saveBatch, listBatches, clearTickerBatches } from '@/lib/storage/indexedDB';
import type { BatchWindow, BatchRecord } from '@/types/storage';
import type { Candle } from '@/types';

// Mock global fetch
global.fetch = vi.fn();

describe('Batch Download - IDX Stocks Integration', () => {
    // Real IDX stock tickers
    const IDX_TICKERS = {
        banking: ['BBRI.JK', 'BBCA.JK', 'BMRI.JK', 'BBNI.JK'],
        automotive: ['ASII.JK', 'AUTO.JK'],
        telecommunication: ['TLKM.JK', 'EXCL.JK'],
        mining: ['ANTM.JK', 'INCO.JK'],
    };

    // Realistic mock data generator
    const generateRealisticCandles = (
        startTime: number,
        count: number,
        basePrice: number = 5000,
        volatility: number = 0.02
    ): Candle[] => {
        const candles: Candle[] = [];
        let price = basePrice;

        for (let i = 0; i < count; i++) {
            const change = (Math.random() - 0.5) * volatility * price;
            const open = price;
            const close = price + change;
            const high = Math.max(open, close) * (1 + Math.random() * volatility);
            const low = Math.min(open, close) * (1 - Math.random() * volatility);
            const volume = Math.floor(1000000 + Math.random() * 5000000);

            candles.push({
                t: startTime + i * 300000, // 5-minute intervals
                o: Math.round(open),
                h: Math.round(high),
                l: Math.round(low),
                c: Math.round(close),
                v: volume,
            });

            price = close;
        }

        return candles;
    };

    beforeEach(async () => {
        // Clear all test tickers
        for (const category of Object.values(IDX_TICKERS)) {
            for (const ticker of category) {
                await clearTickerBatches(ticker);
            }
        }

        vi.clearAllMocks();
    });

    describe('Banking Sector - BBRI.JK', () => {
        const ticker = 'BBRI.JK';
        const basePrice = 5200; // Typical BBRI price range

        beforeEach(() => {
            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => ({
                    data: generateRealisticCandles(
                        new Date('2024-01-01').getTime(),
                        100,
                        basePrice
                    ),
                }),
            });
        });

        it('should download and save BBRI.JK daily data', async () => {
            const windows: BatchWindow[] = [
                {
                    id: '2024-01-01_to_2024-02-01',
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-02-01'),
                    sizeInDays: 31,
                },
            ];

            await downloadMultipleBatches(ticker, '5m', windows);

            const batches = await listBatches(ticker, '5m');
            expect(batches).toHaveLength(1);
            expect(batches[0].ticker).toBe(ticker);
            expect(batches[0].candleCount).toBeGreaterThan(0);
        });

        it('should handle multiple banking stocks in parallel scenario', async () => {
            const bankingStocks = IDX_TICKERS.banking.slice(0, 2); // BBRI, BBCA
            const results: BatchRecord[] = [];

            for (const stock of bankingStocks) {
                const batch: BatchRecord = {
                    id: `${stock}_5m_2024-Q1`,
                    ticker: stock,
                    interval: '5m',
                    windowId: '2024-Q1',
                    startTime: new Date('2024-01-01').getTime(),
                    endTime: new Date('2024-04-01').getTime(),
                    data: generateRealisticCandles(
                        new Date('2024-01-01').getTime(),
                        100,
                        stock === 'BBRI.JK' ? 5200 : 8500 // Different base prices
                    ),
                    downloadedAt: Date.now(),
                    checksum: `checksum-${stock}`,
                    candleCount: 100,
                };

                await saveBatch(batch);
                results.push(batch);
            }

            expect(results).toHaveLength(2);

            // Verify both stocks are saved independently
            const bbriBatches = await listBatches('BBRI.JK', '5m');
            const bbcaBatches = await listBatches('BBCA.JK', '5m');

            expect(bbriBatches).toHaveLength(1);
            expect(bbcaBatches).toHaveLength(1);
        });
    });

    describe('Multi-Sector Portfolio', () => {
        it('should download diverse portfolio of IDX stocks', async () => {
            // Simulate portfolio: BBRI (banking), ASII (automotive), TLKM (telco)
            const portfolio = ['BBRI.JK', 'ASII.JK', 'TLKM.JK'];
            const basePrices = {
                'BBRI.JK': 5200,
                'ASII.JK': 5500,
                'TLKM.JK': 3200,
            };

            for (const ticker of portfolio) {
                (global.fetch as any).mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        data: generateRealisticCandles(
                            new Date('2024-01-01').getTime(),
                            50,
                            basePrices[ticker as keyof typeof basePrices]
                        ),
                    }),
                });

                const windows: BatchWindow[] = [
                    {
                        id: '2024-01-01_to_2024-01-15',
                        startDate: new Date('2024-01-01'),
                        endDate: new Date('2024-01-15'),
                        sizeInDays: 14,
                    },
                ];

                await downloadMultipleBatches(ticker, '5m', windows);
            }

            // Verify all stocks were downloaded
            for (const ticker of portfolio) {
                const batches = await listBatches(ticker, '5m');
                expect(batches).toHaveLength(1);
                expect(batches[0].ticker).toBe(ticker);
            }
        });
    });

    describe('Historical Data Scenarios', () => {
        const ticker = 'ASII.JK';

        it('should download quarterly data for scenario creation', async () => {
            const quarters: BatchWindow[] = [
                {
                    id: '2024-Q1',
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-04-01'),
                    sizeInDays: 90,
                },
                {
                    id: '2024-Q2',
                    startDate: new Date('2024-04-01'),
                    endDate: new Date('2024-07-01'),
                    sizeInDays: 91,
                },
            ];

            (global.fetch as any).mockImplementation(() =>
                Promise.resolve({
                    ok: true,
                    json: async () => ({
                        data: generateRealisticCandles(
                            Date.now(),
                            100,
                            5500
                        ),
                    }),
                })
            );

            await downloadMultipleBatches(ticker, '5m', quarters);

            const batches = await listBatches(ticker, '5m');
            expect(batches).toHaveLength(2);

            // Create scenario from quarterly data
            const scenario = await createScenario(
                'ASII Q1-Q2 2024',
                ticker,
                '5m',
                ['2024-Q1', '2024-Q2'],
                {
                    description: 'Astra International quarterly performance',
                    difficulty: 'medium',
                    tags: ['automotive', 'blue-chip', '2024'],
                }
            );

            expect(scenario.name).toBe('ASII Q1-Q2 2024');
            expect(scenario.ticker).toBe(ticker);
            expect(scenario.metadata?.tags).toContain('automotive');
        });

        it('should handle different timeframes for same ticker', async () => {
            const intervals: Array<'5m' | '15m' | '1h'> = ['5m', '15m', '1h'];
            const window: BatchWindow = {
                id: '2024-01-01_to_2024-01-15',
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-15'),
                sizeInDays: 14,
            };

            for (const interval of intervals) {
                (global.fetch as any).mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        data: generateRealisticCandles(
                            new Date('2024-01-01').getTime(),
                            interval === '5m' ? 100 : interval === '15m' ? 50 : 25,
                            5500
                        ),
                    }),
                });

                await downloadMultipleBatches(ticker, interval, [window]);
            }

            // Verify all timeframes are stored separately
            const batches5m = await listBatches(ticker, '5m');
            const batches15m = await listBatches(ticker, '15m');
            const batches1h = await listBatches(ticker, '1h');

            expect(batches5m).toHaveLength(1);
            expect(batches15m).toHaveLength(1);
            expect(batches1h).toHaveLength(1);
        });
    });

    describe('Error Handling - IDX Specific', () => {
        it('should handle suspended trading (no data available)', async () => {
            const ticker = 'SUSPENDED.JK'; // Simulated suspended stock

            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => ({ data: [] }), // Empty data
            });

            const windows: BatchWindow[] = [
                {
                    id: '2024-01-01_to_2024-02-01',
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-02-01'),
                    sizeInDays: 31,
                },
            ];

            await downloadMultipleBatches(ticker, '5m', windows);

            const batches = await listBatches(ticker, '5m');
            // Should save even with 0 candles
            expect(batches).toHaveLength(1);
            expect(batches[0].candleCount).toBe(0);
        });

        it('should handle ticker delisting gracefully', async () => {
            const ticker = 'DELISTED.JK';

            (global.fetch as any).mockResolvedValue({
                ok: false,
                status: 404,
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

            // Should not throw, but log error
            await downloadMultipleBatches(ticker, '5m', windows);

            const batches = await listBatches(ticker, '5m');
            expect(batches).toHaveLength(0);
        });
    });

    describe('Performance - Large Dataset', () => {
        it('should handle year-long data efficiently', async () => {
            const ticker = 'BBRI.JK';
            const monthlyWindows: BatchWindow[] = [];

            // Generate 12 monthly windows for a full year
            for (let month = 0; month < 12; month++) {
                const startDate = new Date(2024, month, 1);
                const endDate = new Date(2024, month + 1, 1);

                monthlyWindows.push({
                    id: `2024-${String(month + 1).padStart(2, '0')}`,
                    startDate,
                    endDate,
                    sizeInDays: Math.floor((endDate.getTime() - startDate.getTime()) / 86400000),
                });
            }

            (global.fetch as any).mockImplementation(() =>
                Promise.resolve({
                    ok: true,
                    json: async () => ({
                        data: generateRealisticCandles(Date.now(), 100, 5200),
                    }),
                })
            );

            const startTime = Date.now();
            await downloadMultipleBatches(ticker, '5m', monthlyWindows, undefined, { rateLimitMs: 10 });
            const duration = Date.now() - startTime;

            const batches = await listBatches(ticker, '5m');
            expect(batches).toHaveLength(12);
            expect(duration).toBeLessThan(5000); // Should complete within 5 seconds with fast rate limit

            console.log(`Downloaded 12 months of data in ${duration}ms`);
        });
    });
});
