/**
 * Scenario Manager
 * Creates and manages frozen historical scenarios for practice trading
 */

import { nanoid } from 'nanoid';
import type { Candle } from '@/types';
import type { ScenarioDefinition, ScenarioData } from '@/types/scenario';
import type { BatchRecord } from '@/types/storage';
import { openDB, STORES } from '@/lib/storage/indexedDB';
import { listBatches, getBatch } from '@/lib/storage/indexedDB';
import { mergeBatches } from '@/lib/data/dataMerger';
import { resample } from '@/lib/data/resampler';

/**
 * Deep freeze utility for making scenario data truly immutable
 */
function deepFreeze<T>(obj: T): T {
    // Freeze the object itself
    Object.freeze(obj);

    // Recursively freeze all properties
    Object.getOwnPropertyNames(obj).forEach((prop) => {
        const value = (obj as any)[prop];
        if (value !== null && (typeof value === 'object' || typeof value === 'function')) {
            // Only freeze if not already frozen
            if (!Object.isFrozen(value)) {
                deepFreeze(value);
            }
        }
    });

    return obj;
}

/**
 * Create a new scenario from batch windows
 */
export async function createScenario(
    name: string,
    ticker: string,
    interval: '1m' | '5m' | '15m' | '1h',
    windowIds: string[],
    metadata?: {
        description?: string;
        tags?: string[];
        difficulty?: 'easy' | 'medium' | 'hard';
    }
): Promise<ScenarioData> {
    // Load all batches
    const batches: BatchRecord[] = [];
    for (const windowId of windowIds) {
        const batchId = `${ticker}_${interval}_${windowId}`;
        const batch = await getBatch(batchId);
        if (batch) {
            batches.push(batch);
        }
    }

    if (batches.length === 0) {
        throw new Error('No batches found for specified windows');
    }

    // Merge batches
    const mergedCandles = mergeBatches(batches);

    if (mergedCandles.length === 0) {
        throw new Error('No candles available after merge');
    }

    // Create scenario
    const scenario: ScenarioData = {
        id: nanoid(),
        name,
        ticker,
        interval,
        windows: windowIds,
        startTimestamp: mergedCandles[0].t,
        endTimestamp: mergedCandles[mergedCandles.length - 1].t,
        totalCandles: mergedCandles.length,
        candles: mergedCandles,
        metadata: {
            ...metadata,
            createdAt: Date.now(),
        },
    };

    // Save to IndexedDB (save unfrozen version)
    await saveScenario(scenario);

    console.log(`[ScenarioManager] Created scenario: ${scenario.name} (${scenario.totalCandles} candles)`);

    // Return deep-frozen copy for immutability
    return deepFreeze({ ...scenario });
}

/**
 * Load scenario by ID
 */
export async function loadScenario(scenarioId: string): Promise<ScenarioData | null> {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORES.SCENARIOS, 'readonly');
        const store = transaction.objectStore(STORES.SCENARIOS);
        const request = store.get(scenarioId);

        request.onsuccess = () => {
            const result = request.result;
            // Deep freeze loaded scenario for immutability
            resolve(result ? deepFreeze({ ...result }) : null);
        };

        request.onerror = () => {
            reject(new Error(`Failed to load scenario: ${request.error?.message}`));
        };

        transaction.oncomplete = () => {
            db.close();
        };
    });
}

/**
 * Save scenario to storage
 */
async function saveScenario(scenario: ScenarioData): Promise<void> {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORES.SCENARIOS, 'readwrite');
        const store = transaction.objectStore(STORES.SCENARIOS);
        const request = store.put(scenario);

        request.onsuccess = () => {
            console.log(`[ScenarioManager] Saved scenario: ${scenario.id}`);
            resolve();
        };

        request.onerror = () => {
            reject(new Error(`Failed to save scenario: ${request.error?.message}`));
        };

        transaction.oncomplete = () => {
            db.close();
        };
    });
}

/**
 * List all scenarios
 */
export async function listScenarios(filters?: {
    ticker?: string;
    interval?: '1m' | '5m' | '15m' | '1h';
    tags?: string[];
    difficulty?: 'easy' | 'medium' | 'hard';
}): Promise<ScenarioDefinition[]> {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORES.SCENARIOS, 'readonly');
        const store = transaction.objectStore(STORES.SCENARIOS);
        const request = store.getAll();

        request.onsuccess = () => {
            let scenarios: ScenarioData[] = request.result || [];

            // Apply filters
            if (filters) {
                if (filters.ticker) {
                    scenarios = scenarios.filter((s) => s.ticker === filters.ticker);
                }
                if (filters.interval) {
                    scenarios = scenarios.filter((s) => s.interval === filters.interval);
                }
                if (filters.difficulty) {
                    scenarios = scenarios.filter((s) => s.metadata?.difficulty === filters.difficulty);
                }
                if (filters.tags && filters.tags.length > 0) {
                    scenarios = scenarios.filter((s) =>
                        filters.tags!.some((tag) => s.metadata?.tags?.includes(tag))
                    );
                }
            }

            // Convert to definitions (exclude heavy candle data)
            const definitions: ScenarioDefinition[] = scenarios.map((s) => ({
                id: s.id,
                name: s.name,
                ticker: s.ticker,
                interval: s.interval,
                windows: s.windows,
                startTimestamp: s.startTimestamp,
                endTimestamp: s.endTimestamp,
                totalCandles: s.totalCandles,
                metadata: s.metadata,
            }));

            resolve(definitions);
        };

        request.onerror = () => {
            reject(new Error(`Failed to list scenarios: ${request.error?.message}`));
        };

        transaction.oncomplete = () => {
            db.close();
        };
    });
}

/**
 * Delete scenario
 */
export async function deleteScenario(scenarioId: string): Promise<void> {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORES.SCENARIOS, 'readwrite');
        const store = transaction.objectStore(STORES.SCENARIOS);
        const request = store.delete(scenarioId);

        request.onsuccess = () => {
            console.log(`[ScenarioManager] Deleted scenario: ${scenarioId}`);
            resolve();
        };

        request.onerror = () => {
            reject(new Error(`Failed to delete scenario: ${request.error?.message}`));
        };

        transaction.oncomplete = () => {
            db.close();
        };
    });
}

/**
 * Create scenario from auto-download
 * Downloads batches for date range, merges, and creates scenario
 */
export async function createScenarioFromDownload(
    name: string,
    ticker: string,
    interval: '1m' | '5m',
    startDate: Date,
    endDate: Date,
    metadata?: {
        description?: string;
        tags?: string[];
        difficulty?: 'easy' | 'medium' | 'hard';
    }
): Promise<ScenarioData> {
    // Import dynamically to avoid circular deps
    const { generateWindows } = await import('@/lib/data/windowCalculator');
    const { downloadMultipleBatches } = await import('@/lib/data/batchDownloader');
    const { getRecommendedWindowSize } = await import('@/lib/data/windowCalculator');

    // Generate windows
    const windowSize = getRecommendedWindowSize(interval);
    const windows = generateWindows(startDate, endDate, windowSize);

    console.log(`[ScenarioManager] Downloading ${windows.length} batches...`);

    // Download batches
    await downloadMultipleBatches(ticker, interval, windows);

    // Create scenario from downloaded batches
    const windowIds = windows.map((w) => w.id);
    return createScenario(name, ticker, interval, windowIds, metadata);
}
