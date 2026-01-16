/**
 * useSimulationWorker Hook
 * Manages Web Worker lifecycle for simulation engine
 * Updated to fetch data from local API (/api/simulation/start)
 * 
 * ✅ Phoenix Pattern: Auto-respawn on crash with resume from last position
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import type { Candle } from '@/types';
import { useSimulationStore } from '@/stores/useSimulationStore';

export interface TickData {
    price: number;
    volume: number;
    timestamp: number;
    candleIndex: number;
    tickIndex: number;
}

interface WorkerMessage {
    type: 'TICK' | 'CANDLE_CHANGE' | 'COMPLETE' | 'READY' | 'DATA_READY' | 'ERROR' | 'PLAYBACK_STATE';
    data?: TickData;
    candleIndex?: number;
    totalCandles?: number;
    message?: string;
    isPlaying?: boolean;
    speed?: number;
}

interface UseSimulationWorkerOptions {
    onTick?: (tick: TickData) => void;
    onCandleChange?: (candleIndex: number) => void;
    onComplete?: () => void;
    onDataReady?: (totalCandles: number) => void;
    onError?: (message: string) => void;
    onRespawn?: (attemptCount: number) => void; // ✅ Phoenix Pattern: Callback for respawn
}

interface SimulationData {
    ticker: string;
    date: string;
    candles: Candle[];
    candleCount: number;
    source: string;
}

// ✅ Phoenix Pattern: Max respawn attempts before giving up
const MAX_RESPAWN_ATTEMPTS = 3;
const RESPAWN_DELAY_MS = 500;

export function useSimulationWorker(options: UseSimulationWorkerOptions = {}) {
    const workerRef = useRef<Worker | null>(null);
    const isInitialized = useRef(false);
    const [isDataLoaded, setIsDataLoaded] = useState(false);
    const [simulationInfo, setSimulationInfo] = useState<{
        ticker: string;
        date: string;
        candleCount: number;
    } | null>(null);

    // ✅ Phoenix Pattern: Track respawn attempts and cached data
    const respawnCountRef = useRef(0);
    const cachedCandlesRef = useRef<Candle[] | null>(null);
    const wasPlayingRef = useRef(false);
    const lastSpeedRef = useRef(1);

    // ✅ Phoenix Pattern: Create worker with message handlers
    const createWorker = useCallback(() => {
        try {
            console.log('[useSimulationWorker] 🐣 Creating worker...');

            const worker = new Worker(
                new URL('/workers/simulation.worker.ts', window.location.origin),
                { type: 'module' }
            );

            // Setup message handler
            worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
                const { type, data, candleIndex, totalCandles, message, isPlaying, speed } = event.data;

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
                        if (candleIndex !== undefined) {
                            // ✅ Phoenix Pattern: Track progress in store
                            useSimulationStore.getState().setLastProcessedIndex(candleIndex);

                            if (options.onCandleChange) {
                                options.onCandleChange(candleIndex);
                            }
                        }
                        break;

                    case 'COMPLETE':
                        if (options.onComplete) {
                            options.onComplete();
                        }
                        break;

                    case 'PLAYBACK_STATE':
                        // Track playback state for respawn
                        if (isPlaying !== undefined) wasPlayingRef.current = isPlaying;
                        if (speed !== undefined) lastSpeedRef.current = speed;
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

            // ✅ Phoenix Pattern: Enhanced error handler with respawn
            worker.onerror = (error) => {
                console.error('[useSimulationWorker] 💀 Worker crashed:', error);

                // Attempt respawn if under max attempts
                if (respawnCountRef.current < MAX_RESPAWN_ATTEMPTS) {
                    respawnCountRef.current++;
                    console.log(`[useSimulationWorker] 🔄 Respawning worker (attempt ${respawnCountRef.current}/${MAX_RESPAWN_ATTEMPTS})...`);

                    // Notify about respawn
                    if (options.onRespawn) {
                        options.onRespawn(respawnCountRef.current);
                    }

                    // Terminate crashed worker
                    worker.terminate();
                    workerRef.current = null;

                    // Respawn after short delay
                    setTimeout(() => {
                        const newWorker = createWorker();
                        if (newWorker) {
                            workerRef.current = newWorker;

                            // Re-init with cached data
                            if (cachedCandlesRef.current) {
                                console.log('[useSimulationWorker] 📦 Re-initializing with cached data...');
                                newWorker.postMessage({
                                    type: 'INIT_DATA',
                                    candles: cachedCandlesRef.current,
                                });

                                // Wait for data ready, then seek and resume
                                const handleReady = (event: MessageEvent<WorkerMessage>) => {
                                    if (event.data.type === 'DATA_READY') {
                                        const lastIndex = useSimulationStore.getState().lastProcessedIndex;
                                        console.log(`[useSimulationWorker] 🎯 Seeking to last position: ${lastIndex}`);

                                        newWorker.postMessage({ type: 'SEEK', index: lastIndex });

                                        // Resume if was playing
                                        if (wasPlayingRef.current) {
                                            console.log(`[useSimulationWorker] ▶️ Resuming playback at ${lastSpeedRef.current}x`);
                                            newWorker.postMessage({ type: 'PLAY', speed: lastSpeedRef.current });
                                        }

                                        newWorker.removeEventListener('message', handleReady);
                                    }
                                };
                                newWorker.addEventListener('message', handleReady);
                            }
                        }
                    }, RESPAWN_DELAY_MS);
                } else {
                    console.error('[useSimulationWorker] ❌ Max respawn attempts reached. Giving up.');
                    if (options.onError) {
                        options.onError('Worker crashed and could not be recovered');
                    }
                }
            };

            return worker;
        } catch (error) {
            console.error('[useSimulationWorker] Failed to create worker:', error);
            return null;
        }
    }, [options]);

    // Initialize worker
    useEffect(() => {
        if (typeof window === 'undefined' || isInitialized.current) {
            return; // Skip SSR and prevent double init
        }

        const worker = createWorker();
        if (worker) {
            workerRef.current = worker;
            isInitialized.current = true;
            console.log('[useSimulationWorker] ✅ Worker initialized');
        }

        // Cleanup on unmount
        return () => {
            if (workerRef.current) {
                workerRef.current.terminate();
                workerRef.current = null;
                isInitialized.current = false;
                setIsDataLoaded(false);
                respawnCountRef.current = 0;
                cachedCandlesRef.current = null;
                console.log('[useSimulationWorker] Worker terminated');
            }
        };
    }, [createWorker]);

    // Load simulation data from local API
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

            // ✅ Phoenix Pattern: Cache candles for potential respawn
            cachedCandlesRef.current = candles;
            respawnCountRef.current = 0; // Reset respawn count on fresh data load

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

        // ✅ Phoenix Pattern: Track playback state
        wasPlayingRef.current = true;
        lastSpeedRef.current = speed;

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

        // ✅ Phoenix Pattern: Track playback state
        wasPlayingRef.current = false;

        workerRef.current.postMessage({ type: 'PAUSE' });
    }, []);

    // Stop simulation
    const stop = useCallback(() => {
        if (!workerRef.current) {
            console.error('[useSimulationWorker] Worker not initialized');
            return;
        }

        // ✅ Phoenix Pattern: Track playback state
        wasPlayingRef.current = false;

        workerRef.current.postMessage({ type: 'STOP' });
    }, []);

    // Set playback speed
    const setSpeed = useCallback((speed: number) => {
        if (!workerRef.current) {
            console.error('[useSimulationWorker] Worker not initialized');
            return;
        }

        // ✅ Phoenix Pattern: Track speed
        lastSpeedRef.current = speed;

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
        respawnCount: respawnCountRef.current, // ✅ Phoenix Pattern: Expose respawn count
    };
}
