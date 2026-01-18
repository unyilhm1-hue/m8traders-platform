/**
 * Simulation Engine Context
 * Provides a single shared worker instance across all simulation components
 * Prevents duplicate worker initialization and ensures consistent state
 */
'use client';

import { createContext, useContext, ReactNode, useEffect } from 'react';
import { useSimulationEngine } from '@/hooks/useSimulationEngine';
import { useSimulationStore } from '@/stores/useSimulationStore';

interface SimulationEngineContextValue {
    engine: ReturnType<typeof useSimulationEngine>;
    isReady: boolean;
}

const SimulationEngineContext = createContext<SimulationEngineContextValue | null>(null);

interface SimulationEngineProviderProps {
    children: ReactNode;
}

export function SimulationEngineProvider({ children }: SimulationEngineProviderProps) {
    // ✅ Single worker instance for entire simulation page
    const engine = useSimulationEngine({
        autoLoad: false,  // Manual load via page logic
        autoPlay: false,  // Manual play via controls
        playbackSpeed: 1,
    });

    // 🔥 DISABLED: Interval sync now handled in demo page after data loads
    // This was triggering worker init BEFORE data ready, causing "Candle=false" error
    // const baseInterval = useSimulationStore((s) => s.baseInterval);
    // useEffect(() => {
    //     if (engine.isReady && baseInterval) {
    //         engine.setInterval(baseInterval);
    //     }
    // }, [engine.isReady, baseInterval, engine.setInterval]);

    const value: SimulationEngineContextValue = {
        engine,
        isReady: engine.isReady,
    };

    return (
        <SimulationEngineContext.Provider value={value}>
            {children}
        </SimulationEngineContext.Provider>
    );
}

/**
 * Hook to access the shared simulation engine
 * Must be used within SimulationEngineProvider
 */
export function useSimulationEngineContext() {
    const context = useContext(SimulationEngineContext);

    if (!context) {
        throw new Error(
            'useSimulationEngineContext must be used within SimulationEngineProvider'
        );
    }

    return context;
}
