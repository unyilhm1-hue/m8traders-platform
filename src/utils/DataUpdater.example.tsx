/**
 * 🔄 Example: Data Updater Integration
 * 
 * Contoh penggunaan DataUpdater di komponen UI dan store
 */

import { smartSyncStockData, getDataFreshness, type UpdateResult } from '@/utils/DataUpdater';
import { useSimulationStore } from '@/stores/useSimulationStore';
import type { Candle } from '@/types';

// ============================================================================
// Example 1: Manual Update Button
// ============================================================================

export function ManualUpdateButton() {
    const [isUpdating, setIsUpdating] = React.useState(false);
    const [updateResult, setUpdateResult] = React.useState<UpdateResult | null>(null);

    const handleUpdate = async () => {
        setIsUpdating(true);

        try {
            // 1. Get current data from store
            const store = useSimulationStore.getState();
            const currentCandles = store.baseData; // atau store.rawSources

            // 2. Define fetch function (adjust to your API)
            const fetchStockAPI = async (from: number, to: number): Promise<Candle[]> => {
                const ticker = store.currentTicker || 'BBRI';
                const interval = store.baseInterval || '1m';

                // Example API call
                const response = await fetch(
                    `/api/candles?symbol=${ticker}&interval=${interval}&from=${from}&to=${to}`
                );

                if (!response.ok) {
                    throw new Error(`API Error: ${response.statusText}`);
                }

                const json = await response.json();

                // Map API response to Candle format
                return json.data.map((item: any) => ({
                    t: item.timestamp, // Already in seconds
                    o: item.open,
                    h: item.high,
                    l: item.low,
                    c: item.close,
                    v: item.volume || 0
                }));
            };

            // 3. Run Smart Sync
            const result = await smartSyncStockData(
                currentCandles,
                fetchStockAPI,
                {
                    rewindStrategy: 'day', // Safe: rewind to midnight
                    minGapHours: 1,        // Only update if gap > 1 hour
                    debug: true            // Enable console logs
                }
            );

            // 4. Update store if successful
            if (result.status === 'success') {
                // Update baseData dengan data baru
                // store.setBaseData(result.updatedData);

                // Save to IndexedDB/LocalStorage
                // await saveToIndexedDB(ticker, interval, result.updatedData);

                console.log(`✅ Update sukses: +${result.addedCount} candles`);
            }

            setUpdateResult(result);

        } catch (error) {
            console.error('Update failed:', error);
            setUpdateResult({
                updatedData: [],
                addedCount: 0,
                removedCount: 0,
                status: 'error',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className="flex flex-col gap-2">
            <button
                onClick={handleUpdate}
                disabled={isUpdating}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded disabled:opacity-50"
            >
                {isUpdating ? '🔄 Updating...' : '🔄 Update Data'}
            </button>

            {updateResult && (
                <div className={`text-sm p-2 rounded ${updateResult.status === 'success' ? 'bg-green-900/30 text-green-300' :
                        updateResult.status === 'error' ? 'bg-red-900/30 text-red-300' :
                            'bg-yellow-900/30 text-yellow-300'
                    }`}>
                    {updateResult.message}
                </div>
            )}
        </div>
    );
}

// ============================================================================
// Example 2: Auto-Update Service (Background)
// ============================================================================

export class AutoUpdateService {
    private intervalId: NodeJS.Timeout | null = null;
    private updateFrequencyMs: number = 60 * 60 * 1000; // 1 hour

    /**
     * Start auto-update service
     * @param frequencyMs Update frequency in milliseconds
     */
    start(frequencyMs: number = this.updateFrequencyMs) {
        this.stop(); // Clear any existing interval

        this.intervalId = setInterval(async () => {
            await this.performUpdate();
        }, frequencyMs);

        console.log(`[AutoUpdate] Started (every ${frequencyMs / 1000 / 60} minutes)`);
    }

    /**
     * Stop auto-update service
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('[AutoUpdate] Stopped');
        }
    }

    /**
     * Perform update check and sync if needed
     */
    private async performUpdate() {
        try {
            const store = useSimulationStore.getState();
            const currentCandles = store.baseData;

            // Check freshness first
            const freshness = getDataFreshness(currentCandles);

            if (freshness.status === 'fresh') {
                console.log('[AutoUpdate] Data is fresh, skipping update');
                return;
            }

            console.log(`[AutoUpdate] Data is ${freshness.status}, initiating update...`);

            // Define fetch function (same as manual example)
            const fetchStockAPI = async (from: number, to: number): Promise<Candle[]> => {
                const ticker = store.currentTicker || 'BBRI';
                const interval = store.baseInterval || '1m';

                const response = await fetch(
                    `/api/candles?symbol=${ticker}&interval=${interval}&from=${from}&to=${to}`
                );

                if (!response.ok) throw new Error(`API Error: ${response.statusText}`);

                const json = await response.json();
                return json.data.map((item: any) => ({
                    t: item.timestamp,
                    o: item.open,
                    h: item.high,
                    l: item.low,
                    c: item.close,
                    v: item.volume || 0
                }));
            };

            // Run update
            const result = await smartSyncStockData(
                currentCandles,
                fetchStockAPI,
                {
                    rewindStrategy: 'day',
                    minGapHours: 1,
                    debug: false // Disable debug logs for auto-update
                }
            );

            if (result.status === 'success') {
                // Update store
                // store.setBaseData(result.updatedData);
                console.log(`[AutoUpdate] ✅ Success: +${result.addedCount} candles`);
            } else {
                console.log(`[AutoUpdate] ${result.message}`);
            }

        } catch (error) {
            console.error('[AutoUpdate] Failed:', error);
        }
    }
}

// ============================================================================
// Example 3: Data Freshness Indicator
// ============================================================================

export function DataFreshnessIndicator() {
    const [freshness, setFreshness] = React.useState<ReturnType<typeof getDataFreshness> | null>(null);

    React.useEffect(() => {
        const store = useSimulationStore.getState();
        const currentCandles = store.baseData;

        const result = getDataFreshness(currentCandles);
        setFreshness(result);

        // Update every minute
        const interval = setInterval(() => {
            const updated = getDataFreshness(currentCandles);
            setFreshness(updated);
        }, 60000);

        return () => clearInterval(interval);
    }, []);

    if (!freshness) return null;

    const getStatusColor = () => {
        switch (freshness.status) {
            case 'fresh': return 'text-green-400';
            case 'stale': return 'text-yellow-400';
            case 'very_stale': return 'text-red-400';
            case 'empty': return 'text-gray-400';
        }
    };

    return (
        <div className={`flex items-center gap-2 text-sm ${getStatusColor()}`}>
            <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
            <span>{freshness.message}</span>
        </div>
    );
}

// ============================================================================
// Example 4: Integration dengan useSimulationStore
// ============================================================================

/**
 * Tambahkan action ini ke useSimulationStore.ts:
 */

/*
export interface SimulationState {
    // ... existing state ...
    
    // Add:
    updateData: (ticker: string, interval: Interval) => Promise<UpdateResult>;
}

// In store implementation:
updateData: async (ticker, interval) => {
    const { baseData } = get();
    
    const fetchFunction = async (from: number, to: number): Promise<Candle[]> => {
        const response = await fetch(
            `/api/candles?symbol=${ticker}&interval=${interval}&from=${from}&to=${to}`
        );
        const json = await response.json();
        return json.data.map((item: any) => ({
            t: item.timestamp,
            o: item.open,
            h: item.high,
            l: item.low,
            c: item.close,
            v: item.volume || 0
        }));
    };
    
    const result = await smartSyncStockData(baseData, fetchFunction, {
        rewindStrategy: 'day',
        debug: true
    });
    
    if (result.status === 'success') {
        set((state) => {
            state.baseData = result.updatedData;
        });
    }
    
    return result;
}
*/
