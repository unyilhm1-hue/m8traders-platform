'use client';

import { useState } from 'react';
import { useSimulationStore } from '@/stores/useSimulationStore';
import { getDataFreshness } from '@/utils/DataUpdater';
import type { UpdateResult } from '@/utils/DataUpdater';

/**
 * Data Updater Button Component
 * 
 * Simple UI for triggering data updates with visual feedback
 * Includes freshness indicator and update progress
 */
export function DataUpdaterButton() {
    const [isUpdating, setIsUpdating] = useState(false);
    const [result, setResult] = useState<UpdateResult | null>(null);
    const [batchResult, setBatchResult] = useState<{ successCount: number; failCount: number } | null>(null);

    // Get store state
    const updateData = useSimulationStore(state => state.updateData);
    const updateAllTickers = useSimulationStore(state => state.updateAllTickers); // 🔥 NEW
    const currentTicker = useSimulationStore(state => state.currentTicker);
    const baseInterval = useSimulationStore(state => state.baseInterval);
    const rawSources = useSimulationStore(state => state.rawSources);
    const lastUpdateTime = useSimulationStore(state => state.lastUpdateTime);
    const loadWithSmartBuffer = useSimulationStore(state => state.loadWithSmartBuffer);

    // Batch Update Handler
    const handleUpdateAll = async () => {
        if (isUpdating) return;
        if (!confirm('Update ALL 1m tickers? This might take a while.')) return;

        setIsUpdating(true);
        setBatchResult(null);
        setResult(null); // Clear single result

        try {
            console.log('[UI] Triggering Batch Update...');
            const res = await updateAllTickers();
            setBatchResult(res);
        } catch (error) {
            console.error('[UI] Batch update failed:', error);
        } finally {
            setIsUpdating(false);
        }
    };

    // Default ticker for initialization if none selected
    const targetTicker = currentTicker || 'BBRI';

    // Calculate data freshness
    const currentData = rawSources.get(targetTicker)?.['1m'] || [];
    const freshness = getDataFreshness(currentData as any[]);

    const handleUpdate = async () => {
        if (isUpdating) return;

        setIsUpdating(true);
        setResult(null);

        try {
            // Case 1: Initialize if empty
            if (freshness.status === 'empty') {
                console.log(`[UI] Initializing data for ${targetTicker}...`);
                await loadWithSmartBuffer(targetTicker, new Date(), '1m');
                setResult({
                    status: 'success',
                    updatedData: [],
                    addedCount: 0,
                    removedCount: 0,
                    message: 'Data initialized globally'
                });
            }
            // Case 2: Update existing data
            else {
                console.log(`[UI] Triggering update for ${targetTicker} ${baseInterval}`);
                const res = await updateData(targetTicker, baseInterval);
                setResult(res);
            }

            // Clear result after 5 seconds
            setTimeout(() => setResult(null), 5000);
        } catch (error) {
            console.error('[UI] Update/Init failed:', error);
            setResult({
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

    // Freshness indicator color
    const getFreshnessColor = () => {
        switch (freshness.status) {
            case 'fresh': return 'text-green-400';
            case 'stale': return 'text-yellow-400';
            case 'very_stale': return 'text-red-400';
            case 'empty': return 'text-gray-400';
        }
    };

    const getFreshnessIcon = () => {
        switch (freshness.status) {
            case 'fresh': return '✓';
            case 'stale': return '⚠';
            case 'very_stale': return '⨯';
            case 'empty': return '○';
        }
    };

    return (
        <div className="flex flex-col gap-2">
            {/* Freshness Indicator */}
            <div className={`flex items-center gap-2 text-xs ${getFreshnessColor()}`}>
                <span className="font-mono">{getFreshnessIcon()}</span>
                <span>{freshness.message}</span>
                {lastUpdateTime && (
                    <span className="text-gray-500 text-[10px]">
                        (last: {new Date(lastUpdateTime * 1000).toLocaleTimeString()})
                    </span>
                )}
            </div>

            {/* Update Button */}
            <button
                onClick={handleUpdate}
                disabled={isUpdating}
                className="
                    px-3 py-1.5 
                    bg-blue-600 hover:bg-blue-700 
                    text-white text-sm font-medium
                    rounded transition-colors
                    disabled:opacity-50 disabled:cursor-not-allowed
                    flex items-center justify-center gap-2
                "
            >
                {isUpdating ? (
                    <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                                fill="none"
                            />
                            <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                        </svg>
                        <span>{freshness.status === 'empty' ? 'Loading...' : 'Updating...'}</span>
                    </>
                ) : (
                    <>
                        <span>{freshness.status === 'empty' ? '📥' : '🔄'}</span>
                        <span>{freshness.status === 'empty' ? 'Initialize Data' : 'Update Data'}</span>
                    </>
                )}
            </button>

            {/* Result Feedback */}
            {result && (
                <div className={`
                    text-xs p-2 rounded
                    ${result.status === 'success' ? 'bg-green-900/30 text-green-300' :
                        result.status === 'error' ? 'bg-red-900/30 text-red-300' :
                            'bg-yellow-900/30 text-yellow-300'}
                `}>
                    <div className="font-medium">
                        {result.status === 'success' && `✓ Added ${result.addedCount} candles`}
                        {result.status === 'no_update' && 'ℹ No update needed'}
                        {result.status === 'error' && '✗ Update failed'}
                    </div>
                    <div className="text-[10px] mt-1 opacity-80">
                        {result.message}
                    </div>
                </div>
            )}

            {/* Batch Update Button (Admin Feature) */}
            <div className="pt-2 border-t border-gray-800">
                <button
                    onClick={handleUpdateAll}
                    disabled={isUpdating}
                    className="
                        w-full px-3 py-1.5 
                        bg-gray-800 hover:bg-gray-700 
                        text-gray-300 text-xs font-mono
                        rounded transition-colors
                        disabled:opacity-50 disabled:cursor-not-allowed
                        flex items-center justify-center gap-2
                    "
                >
                    {isUpdating && !result ? '⏳ Batch Updating...' : '⚡ Update All (1m)'}
                </button>

                {batchResult && (
                    <div className="mt-2 text-xs p-2 bg-gray-900 rounded border border-gray-700">
                        <div className="font-bold text-gray-300 mb-1">Batch Result:</div>
                        <div className="grid grid-cols-2 gap-x-2">
                            <span className="text-green-400">Success: {batchResult.successCount}</span>
                            <span className="text-red-400">Fail: {batchResult.failCount}</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
