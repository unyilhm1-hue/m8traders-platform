/**
 * useSimulationWorker Hook
 * Manages Web Worker lifecycle for simulation engine
 * Updated to fetch data from local API (/api/simulation/start)
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import type { Candle } from '@/types';

export interface TickData {
    price: number;
    volume: number;
    timestamp: number;
    candleIndex: number;
    tickIndex: number;
}

interface WorkerMessage {
    type: 'TICK' | 'CANDLE_CHANGE' | 'COMPLETE' | 'READY' | 'DATA_READY' | 'ERROR';
    data?: TickData;
    candleIndex?: number;
    totalCandles?: number;
    message?: string;
}

interface UseSimulationWorkerOptions {
    onTick?: (tick: TickData) => void;
    onCandleChange?: (candleIndex: number) => void;
    onComplete?: () => void;
    onDataReady?: (totalCandles: number) => void;
    onError?: (message: string) => void;
}

interface SimulationData {
    ticker: string;
    date: string;
    candles: Candle[];
    candleCount: number;
    source: string;
}

export function useSimulationWorker(options: UseSimulationWorkerOptions = {}) {
    const workerRef = useRef<Worker | null>(null);
    const isInitialized = useRef(false);
    const [isDataLoaded, setIsDataLoaded] = useState(false);
    const [simulationInfo, setSimulationInfo] = useState<{
        ticker: string;
        date: string;
        candleCount: number;
    } | null>(null);

    // Initialize worker
    useEffect(() => {
        if (typeof window === 'undefined' || isInitialized.current) {
            return; // Skip SSR and prevent double init
        }

        try {
            // Load worker from public directory
            const worker = new Worker(
                new URL('/workers/simulation.worker.ts', window.location.origin),
                { type: 'module' }
            );

            // Setup message handler
            worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
                const { type, data, candleIndex, totalCandles, message } = event.data;

                switch (type) {
                    case 'READY':
                        console.log('[useSimulationWorker] Worker ready');
                        break;

                    case 'DATA_READY':
                        console.log(`[useSimulationWorker] Data ready: ${totalCandles} candles`);
                        setIsDataLoaded(true);
                        if (totalCandles !== undefined && options.onDataReady) {
                            options.onDataReady(totalCandles);
                        }
                        break;

                    case 'TICK':
                        if (data && options.onTick) {
                            options.onTick(data);
                        }
                        break;

                    case 'CANDLE_CHANGE':
                        if (candleIndex !== undefined && options.onCandleChange) {
                            options.onCandleChange(candleIndex);
                        }
                        break;

                    case 'COMPLETE':
                        if (options.onComplete) {
                            options.onComplete();
                        }
                        break;

                    case 'ERROR':
                        console.error('[useSimulationWorker] Worker error:', message);
                        if (message && options.onError) {
                            options.onError(message);
                        }
                        break;

                    default:
                        console.warn('[useSimulationWorker] Unknown message type:', type);
                }
            };

            worker.onerror = (error) => {
                console.error('[useSimulationWorker] Worker error:', error);
                if (options.onError) {
                    options.onError('Worker encountered an error');
                }
            };

            workerRef.current = worker;
            isInitialized.current = true;

            console.log('[useSimulationWorker] Worker initialized');
        } catch (error) {
            console.error('[useSimulationWorker] Failed to initialize worker:', error);
        }

        // Cleanup on unmount
        return () => {
            if (workerRef.current) {
                workerRef.current.terminate();
                workerRef.current = null;
                isInitialized.current = false;
                setIsDataLoaded(false);
                console.log('[useSimulationWorker] Worker terminated');
            }
        };
    }, []); // Empty deps - run once on mount

    // NEW: Load simulation data from local API
    const loadSimulationData = useCallback(async () => {
        try {
            console.log('[useSimulationWorker] Fetching simulation data from API...');

            const response = await fetch('/api/simulation/start');
            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to load simulation data');
            }

            const { ticker, date, candles, candleCount, source }: SimulationData = result.data;

            console.log(`[useSimulationWorker] Loaded ${source}: ${candleCount} candles`);

            // Store simulation info
            setSimulationInfo({ ticker, date, candleCount });

            // Send data to worker
            if (workerRef.current) {
                workerRef.current.postMessage({
                    type: 'INIT_DATA',
                    candles,
                });
            }

            return { ticker, date, candleCount };
        } catch (error) {
            console.error('[useSimulationWorker] Failed to load simulation data:', error);
            if (options.onError) {
                options.onError((error as Error).message);
            }
            throw error;
        }
    }, [options]);

    // Play simulation (after data loaded)
    const play = useCallback((speed: number = 1) => {
        if (!workerRef.current) {
            console.error('[useSimulationWorker] Worker not initialized');
            return;
        }

        if (!isDataLoaded) {
            console.error('[useSimulationWorker] No data loaded. Call loadSimulationData() first.');
            return;
        }

        workerRef.current.postMessage({
            type: 'PLAY',
            speed,
        });
    }, [isDataLoaded]);

    // Pause simulation
    const pause = useCallback(() => {
        if (!workerRef.current) {
            console.error('[useSimulationWorker] Worker not initialized');
            return;
        }

        workerRef.current.postMessage({ type: 'PAUSE' });
    }, []);

    // Stop simulation
    const stop = useCallback(() => {
        if (!workerRef.current) {
            console.error('[useSimulationWorker] Worker not initialized');
            return;
        }

        workerRef.current.postMessage({ type: 'STOP' });
    }, []);

    // Set playback speed
    const setSpeed = useCallback((speed: number) => {
        if (!workerRef.current) {
            console.error('[useSimulationWorker] Worker not initialized');
            return;
        }

        workerRef.current.postMessage({
            type: 'SET_SPEED',
            speed,
        });
    }, []);

    // Seek to candle index
    const seek = useCallback((index: number) => {
        if (!workerRef.current) {
            console.error('[useSimulationWorker] Worker not initialized');
            return;
        }

        workerRef.current.postMessage({
            type: 'SEEK',
            index,
        });
    }, []);

    return {
        loadSimulationData,
        play,
        pause,
        stop,
        setSpeed,
        seek,
        isReady: isInitialized.current,
        isDataLoaded,
        simulationInfo,
    };
}
