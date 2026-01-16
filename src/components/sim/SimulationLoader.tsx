/**
 * Simulation Loader Component
 * Provides seamless data loading with progress feedback
 * Integrates Master Blueprint: Smart Buffer + Resampling
 */
'use client';

import { useState, useCallback } from 'react';
import { useSimulationStore } from '@/stores';
import { Loader2, CheckCircle, AlertCircle, Database } from 'lucide-react';

interface LoaderProps {
    ticker: string;
    onComplete?: () => void;
}

export function SimulationLoader({ ticker, onComplete }: LoaderProps) {
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [progress, setProgress] = useState<string>('');
    const [error, setError] = useState<string>('');

    const loadWithSmartBuffer = useSimulationStore(s => s.loadWithSmartBuffer);

    const handleLoad = useCallback(async () => {
        try {
            setStatus('loading');
            setError('');

            // Step 1: Fetch historical buffer
            setProgress('📥 Loading historical data for accurate indicators...');
            await new Promise(resolve => setTimeout(resolve, 500));  // Visual feedback

            // Step 2: Load with smart buffer (200 candles warmup)
            const startDate = new Date(); // Today
            const baseInterval = '1m' as const;

            await loadWithSmartBuffer(ticker, startDate, baseInterval);

            setProgress('✅ Data loaded successfully!');
            setStatus('success');

            // Notify parent
            setTimeout(() => {
                onComplete?.();
            }, 800);

        } catch (err) {
            console.error('[SimLoader] Error:', err);
            setError(err instanceof Error ? err.message : 'Failed to load simulation data');
            setStatus('error');
        }
    }, [ticker, loadWithSmartBuffer, onComplete]);

    if (status === 'idle') {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 space-y-4">
                <Database className="w-16 h-16 text-blue-400 opacity-50" />
                <div className="text-center">
                    <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                        Ready to Load Simulation
                    </h3>
                    <p className="text-sm text-[var(--text-tertiary)] mb-4">
                        Ticker: <span className="font-mono text-[var(--text-secondary)]">{ticker}</span>
                    </p>
                    <button
                        onClick={handleLoad}
                        className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                    >
                        Start Simulation
                    </button>
                </div>
            </div>
        );
    }

    if (status === 'loading') {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 space-y-4">
                <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
                <div className="text-center">
                    <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                        Loading Simulation Data
                    </h3>
                    <p className="text-sm text-[var(--text-tertiary)]">
                        {progress}
                    </p>

                    {/* Progress Indicator */}
                    <div className="mt-4 w-64 h-1 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 animate-pulse" style={{ width: '70%' }} />
                    </div>
                </div>
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 space-y-4">
                <AlertCircle className="w-12 h-12 text-red-400" />
                <div className="text-center">
                    <h3 className="text-lg font-semibold text-red-400 mb-2">
                        Error Loading Data
                    </h3>
                    <p className="text-sm text-[var(--text-tertiary)] mb-4">
                        {error}
                    </p>
                    <button
                        onClick={handleLoad}
                        className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    // Success
    return (
        <div className="flex flex-col items-center justify-center h-full p-8 space-y-4">
            <CheckCircle className="w-12 h-12 text-green-400" />
            <div className="text-center">
                <h3 className="text-lg font-semibold text-green-400 mb-2">
                    Ready to Trade!
                </h3>
                <p className="text-sm text-[var(--text-tertiary)]">
                    {progress}
                </p>
            </div>
        </div>
    );
}
