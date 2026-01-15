/**
 * Simulation Engine Context
 * Provides a single shared worker instance across all simulation components
 * Prevents duplicate worker initialization and ensures consistent state
 */
'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useSimulationEngine } from '@/hooks/useSimulationEngine';

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
