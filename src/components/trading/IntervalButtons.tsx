/**
 * Interval Buttons Component
 * Dynamic interval selector with Master Blueprint integration
 * Automatically enables/disables based on data compatibility
 */
'use client';

import { useSimulationStore } from '@/stores/useSimulationStore';
import { useMemo } from 'react';
import type { Interval } from '@/utils/candleResampler';

export function IntervalButtons() {
    const store = useSimulationStore();
    const currentInterval = store.baseInterval || '1m';

    // Get dynamic interval states from Master Blueprint
    const intervalStates = useMemo(() => {
        if (typeof store.getIntervalStates === 'function') {
            return store.getIntervalStates();
        }
        // Fallback: all intervals enabled if Blueprint not loaded
        return (['1m', '2m', '5m', '15m', '30m', '60m'] as Interval[]).map(interval => ({
            value: interval,
            enabled: true,
            reason: undefined
        }));
    }, [store, store.baseData, store.baseInterval]);

    const handleIntervalClick = (interval: Interval) => {
        if (typeof store.switchInterval === 'function') {
            try {
                store.switchInterval(interval);
            } catch (error) {
                console.error('[IntervalButtons] Switch failed:', error);
            }
        }
    };

    return (
        <div className="flex items-center gap-1 bg-[var(--bg-tertiary)] rounded p-0.5">
            {intervalStates.map((state) => {
                const isActive = state.value === currentInterval;
                const isDisabled = !state.enabled;

                return (
                    <button
                        key={state.value}
                        onClick={() => !isDisabled && handleIntervalClick(state.value)}
                        disabled={isDisabled}
                        title={state.reason || state.value}
                        className={`
                            px-2.5 py-1 text-xs font-medium rounded transition-all
                            ${isActive
                                ? 'bg-[var(--accent-primary)] text-white shadow-sm'
                                : isDisabled
                                    ? 'text-[var(--text-tertiary)] opacity-40 cursor-not-allowed'
                                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                            }
                        `}
                    >
                        {state.value}
                    </button>
                );
            })}
        </div>
    );
}
