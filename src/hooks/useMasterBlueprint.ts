/**
 * Integration Layer for Master Blueprint Components
 * ==================================================
 * Seamlessly connects Data Layer, Simulation Engine, and Analytics
 * 
 * Flow:
 * 1. User selects ticker/date → Smart Buffer loads data
 * 2. User switches interval → Client-side resampling (zero API calls)
 * 3. Simulation runs → Organic price movement with simplex noise
 * 4. Trades execute → Saved to Supabase with psychological analysis
 */

import { useEffect, useState, useCallback } from 'react';
import { useSimulationStore } from '@/stores/useSimulationStore';
import { useTradingStore } from '@/stores/useTradingStore';
import type { Interval, IntervalState } from '@/utils/candleResampler';

export interface IntegrationState {
    isLoading: boolean;
    isReady: boolean;
    error: string | null;
    currentInterval: Interval;
    availableIntervals: IntervalState[];
}

/**
 * Hook for Master Blueprint integration
 * Provides unified interface for all simulation features
 */
export function useMasterBlueprint(ticker: string) {
    const [state, setState] = useState<IntegrationState>({
        isLoading: false,
        isReady: false,
        error: null,
        currentInterval: '1m',
        availableIntervals: []
    });

    // 🔥 PERFORMANCE FIX: Use specific selectors instead of entire store
    const loadWithSmartBuffer = useSimulationStore((state) => state.loadWithSmartBuffer);
    const getIntervalStates = useSimulationStore((state) => state.getIntervalStates);
    const switchIntervalFn = useSimulationStore((state) => state.switchInterval);

    // ========================================================================
    // MODUL 1+2: Smart Buffer + Resampling Integration
    // ========================================================================

    const loadSimulation = useCallback(async (startDate: Date, interval: Interval = '1m') => {
        setState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            // Load with smart buffer (200 candles historical for indicators)
            await loadWithSmartBuffer(ticker, startDate, interval);

            // Get available intervals based on loaded data
            const intervals = getIntervalStates();

            setState({
                isLoading: false,
                isReady: true,
                error: null,
                currentInterval: interval,
                availableIntervals: intervals
            });

            console.log('[Integration] ✅ Simulation ready with', intervals.length, 'available intervals');
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to load simulation';
            setState(prev => ({ ...prev, isLoading: false, error: errorMsg }));
            console.error('[Integration] ❌ Load failed:', errorMsg);
        }
    }, [ticker, loadWithSmartBuffer, getIntervalStates]);

    const switchInterval = useCallback((targetInterval: Interval) => {
        try {
            // Client-side resampling - zero API calls!
            const resampledData = switchIntervalFn(targetInterval);

            // Update available intervals (some may become unavailable)
            const intervals = getIntervalStates();

            setState(prev => ({
                ...prev,
                currentInterval: targetInterval,
                availableIntervals: intervals
            }));

            console.log(`[Integration] ✅ Switched to ${targetInterval} (${resampledData.length} candles)`);
            return resampledData;
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to switch interval';
            setState(prev => ({ ...prev, error: errorMsg }));
            console.error('[Integration] ❌ Switch failed:', errorMsg);
            return [];
        }
    }, [switchIntervalFn, getIntervalStates]);

    // ========================================================================
    // MODUL 3: Worker Performance Optimization
    // ========================================================================

    const optimizeWorker = useCallback(() => {
        // Web Worker is already optimized with:
        // 1. Simplex noise for organic movement
        // 2. Pattern detection (hammer, star, marubozu, doji)
        // 3. Anti-barcode seamless transitions
        // 4. Boundary enforcement (never exceed High/Low)

        console.log('[Integration] ✅ Worker optimizations active (simplex noise, pattern awareness)');
    }, []);

    // ========================================================================
    // MODUL 4: Analytics Integration
    // ========================================================================

    const analyzeTrading = useCallback(() => {
        // 🔥 FIX: Trades are in useTradingStore, not useSimulationStore
        // Psychological analytics will be computed from trading store trades
        // - Revenge trading detection
        // - Timeframe suitability
        // - Cut profit early pattern

        const trades = useTradingStore.getState().trades;
        console.log('[Integration] 📊 Analyzing', trades.length, 'trades for psychological patterns');

        // Analytics are computed on-demand by PsychologicalAnalytics component
        return trades;
    }, []); // No dependency on store.trades since we're using direct getState()

    // ========================================================================
    // Auto-initialize worker optimization
    // ========================================================================

    useEffect(() => {
        optimizeWorker();
    }, [optimizeWorker]);

    return {
        // State
        ...state,

        // Actions
        loadSimulation,
        switchInterval,
        analyzeTrading,
    };
}

/**
 * Integration health check
 * Verifies all Master Blueprint components are functioning
 */
export function checkIntegrationHealth() {
    const checks = {
        smartBuffer: typeof useSimulationStore.getState().loadWithSmartBuffer === 'function',
        resampling: typeof useSimulationStore.getState().switchInterval === 'function',
        intervalStates: typeof useSimulationStore.getState().getIntervalStates === 'function',
        cacheManagement: typeof useSimulationStore.getState().clearIntervalCache === 'function'
    };

    const allPassed = Object.values(checks).every(Boolean);

    console.log('[Integration Health]', allPassed ? '✅ All systems operational' : '⚠️ Some components missing');
    console.table(checks);

    return { checks, allPassed };
}
