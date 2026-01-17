/**
 * useSimulationEngine Hook
 * Initializes Web Worker and connects it to Simulation Store
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useSimulationStore } from '@/stores/useSimulationStore';
import type { TickData } from './useSimulationWorker';

interface SimulationEngineOptions {
    autoLoad?: boolean;
    autoPlay?: boolean;
    playbackSpeed?: number;
}

export function useSimulationEngine(options: SimulationEngineOptions = {}) {
    const {
        autoLoad = true,
        autoPlay = false,
        playbackSpeed = 1,
    } = options;

    const workerRef = useRef<Worker | null>(null);
    const isInitialized = useRef(false);
    // ✅ Reactive ready state
    const [isReady, setIsReady] = useState(false);

    // Get store actions
    const pushTick = useSimulationStore((s) => s.pushTick);
    const setCandleHistory = useSimulationStore((s) => s.setCandleHistory);
    const updateCurrentCandle = useSimulationStore((s) => s.updateCurrentCandle);

    // Initialize Worker
    useEffect(() => {
        if (typeof window === 'undefined' || isInitialized.current) {
            return; // Skip SSR and prevent double init
        }

        console.log('[useSimulationEngine] Initializing Worker...');

        try {
            // ✅ NEXT.JS WORKER PATTERN (Option 3)
            // This allows Webpack 5 to automatically compile the TypeScript worker
            // The worker will be bundled and transpiled by Next.js build process
            const worker = new Worker(
                new URL('@/workers/simulation.worker.ts', import.meta.url),
                { type: 'module' }
            );

            // Message handler
            worker.onmessage = (event: MessageEvent) => {
                const { type, data } = event.data;

                switch (type) {
                    case 'READY':
                        console.log('[useSimulationEngine] Worker ready');
                        isInitialized.current = true;
                        setIsReady(true); // ✅ Trigger context update

                        // Auto-load data if enabled
                        if (autoLoad) {
                            loadData(worker);
                        }
                        break;

                    // ✅ HISTORY_READY removed - History is managed by page.tsx via loadSimulationDay
                    // This prevents worker from overwriting history with future data

                    case 'DATA_READY':
                        console.log(`[useSimulationEngine] Data loaded: ${event.data.totalCandles} candles`);

                        // Auto-play if enabled
                        if (autoPlay) {
                            worker.postMessage({ type: 'PLAY', speed: playbackSpeed });
                        }
                        break;

                    case 'TICK':
                        // Push tick to store (for orderbook/tape simulation)
                        if (data) {
                            pushTick(data as TickData);
                        }
                        break;

                    case 'CANDLE_UPDATE':
                        // Update current live candle in store (for chart)
                        if (event.data.candle) {
                            updateCurrentCandle(event.data.candle);
                        }
                        break;

                    case 'CANDLE_CHANGE':
                        console.log(`[useSimulationEngine] Candle ${event.data.candleIndex}`);
                        break;

                    case 'PLAYBACK_STATE':
                        // ✅ NEW: Sync playback state from worker
                        console.log(`[useSimulationEngine] Playback state: ${event.data.isPlaying ? 'Playing' : 'Paused'} at ${event.data.speed}x`);
                        // Store can listen to this if needed for UI updates
                        break;

                    case 'COMPLETE':
                        console.log('[useSimulationEngine] Simulation complete');
                        break;

                    case 'ERROR':
                        console.error('[useSimulationEngine] Worker error:', event.data.message);
                        break;

                    default:
                        console.warn('[useSimulationEngine] Unknown message type:', type);
                }
            };

            // ✅ ENHANCED ERROR HANDLING
            // Logs specific compilation errors for debugging
            worker.onerror = (error: ErrorEvent) => {
                console.error('[useSimulationEngine] Worker initialization/runtime error:', {
                    message: error.message,
                    filename: error.filename,
                    lineno: error.lineno,
                    colno: error.colno,
                    error: error.error,
                });

                // Try to provide helpful debug info
                if (error.message.includes('Cannot find')) {
                    console.error('💡 Worker file not found. Ensure src/workers/simulation.worker.ts exists.');
                } else if (error.message.includes('syntax')) {
                    console.error('💡 Syntax error in worker. Check TypeScript compilation.');
                }
            };

            workerRef.current = worker;
            isInitialized.current = true;

        } catch (error) {
            console.error('[useSimulationEngine] Failed to initialize Worker:', error);

            // Additional debugging for common issues
            if (error instanceof TypeError) {
                console.error('💡 TypeError suggests Worker constructor failed. Check file path and module support.');
            }
        }

        // Cleanup
        return () => {
            if (workerRef.current) {
                workerRef.current.terminate();
                workerRef.current = null;
                isInitialized.current = false;
                console.log('[useSimulationEngine] Worker terminated');
            }
        };
    }, []); // Run once

    // Load simulation data from API
    const loadData = useCallback(async (worker: Worker) => {
        try {
            console.log('[useSimulationEngine] Loading simulation data from API...');

            const response = await fetch('/api/simulation/start');
            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to load data');
            }

            const { ticker, date, candles, candleCount } = result.data;
            console.log(`[useSimulationEngine] Loaded ${ticker} ${date}: ${candleCount} candles`);

            // Send data to Worker
            worker.postMessage({
                type: 'INIT_DATA',
                candles,
            });

        } catch (error) {
            console.error('[useSimulationEngine] Failed to load data:', error);
        }
    }, []);

    // Control methods
    const play = useCallback((speed: number = 1) => {
        if (workerRef.current) {
            workerRef.current.postMessage({ type: 'PLAY', speed });
        }
    }, []);

    const pause = useCallback(() => {
        if (workerRef.current) {
            workerRef.current.postMessage({ type: 'PAUSE' });
        }
    }, []);

    const stop = useCallback(() => {
        if (workerRef.current) {
            workerRef.current.postMessage({ type: 'STOP' });
        }
    }, []);

    const setSpeed = useCallback((speed: number) => {
        if (workerRef.current) {
            workerRef.current.postMessage({ type: 'SET_SPEED', speed });
        }
    }, []);

    const seek = useCallback((candleIndex: number) => {
        if (workerRef.current) {
            workerRef.current.postMessage({ type: 'SEEK', index: candleIndex });
        }
    }, []);

    const reload = useCallback(async () => {
        if (workerRef.current) {
            await loadData(workerRef.current);
        }
    }, [loadData]);

    // Initialize worker with pre-loaded data (for SimDemoPage auto-load)
    const initWithData = useCallback((candles: any[]) => {
        if (workerRef.current) {
            console.log(`[useSimulationEngine] Initializing worker with ${candles.length} candles`);
            workerRef.current.postMessage({
                type: 'INIT_DATA',
                candles,
            });
        } else {
            console.warn('[useSimulationEngine] Worker not ready yet, cannot init with data');
        }
    }, []);

    // 🔥 NEW: Initialize worker with smart buffering (historyBuffer + simulationQueue)
    const initWithBuffers = useCallback((params: {
        historyBuffer: any[];
        simulationQueue: any[];
        interval: string;
    }) => {
        if (workerRef.current) {
            console.log(`[useSimulationEngine] 🧊 Smart Buffering: ${params.historyBuffer.length} history + ${params.simulationQueue.length} simulation`);
            workerRef.current.postMessage({
                type: 'INIT_DATA',
                historyBuffer: params.historyBuffer,
                simulationQueue: params.simulationQueue,
                interval: params.interval,
            });
        } else {
            console.warn('[useSimulationEngine] Worker not ready yet, cannot init with buffers');
        }
    }, []);

    return {
        play,
        pause,
        stop,
        setSpeed,
        seek,
        reload,
        initWithData,      // Legacy method
        initWithBuffers,   // 🔥 NEW: Smart buffering method
        isReady,
    };
}
