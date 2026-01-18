/**
 * useSimulationEngine Hook
 * Initializes Web Worker and connects it to Simulation Store
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useSimulationStore } from '@/stores/useSimulationStore';
import { useDebugStore } from '@/stores/useDebugStore'; // 🔥 NEW: Flight Recorder
import type { TickData } from '@/types/simulation';

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
    // ✅ Reactive playback state (Source of Truth)
    const [isPlaying, setIsPlaying] = useState(false);

    // Get store actions
    const pushTick = useSimulationStore((s) => s.pushTick);
    const updateCurrentCandle = useSimulationStore((s) => s.updateCurrentCandle);

    // 🔥 Flight Recorder Actions
    const { addLog, updateWorkerStatus } = useDebugStore();

    // 🔥 EPOCH SYNC: Prevent Zombie Ticks
    const currentEpoch = useSimulationStore((s) => s.epoch);
    const epochRef = useRef(currentEpoch);

    useEffect(() => {
        epochRef.current = currentEpoch;
    }, [currentEpoch]);

    // Initialize Worker
    useEffect(() => {
        if (typeof window === 'undefined' || isInitialized.current) {
            return; // Skip SSR and prevent double init
        }

        console.log('[useSimulationEngine] Initializing Worker...');

        try {
            // ✅ NEXT.JS WORKER PATTERN (Option 3)
            // 🚀 CACHE BUSTER: Renamed to chart.worker.ts to force fresh load
            const worker = new Worker(new URL('../workers/chart.worker.ts', import.meta.url), {
                type: 'module',
                name: 'PhysicsEngine',
            });
            workerRef.current = worker;

            // Message handler
            worker.onmessage = (event: MessageEvent) => {
                const { type, data, level, message, payload } = event.data;

                // 🩺 Flight Recorder Heartbeat
                updateWorkerStatus('physics', { status: 'working' });

                switch (type) {
                    case 'LOG':
                        addLog('WorkerA', level || 'info', message || 'Log received', payload);
                        break;

                    case 'ERROR':
                        addLog('WorkerA', 'error', message || 'Worker error', payload);
                        updateWorkerStatus('physics', { status: 'error' });
                        // Also log to console for dev visibility
                        console.error('[Worker Error]', message, payload);
                        break;

                    case 'READY':
                        addLog('WorkerA', 'info', 'Worker ready');
                        isInitialized.current = true;
                        setIsReady(true); // ✅ Trigger context update

                        // Auto-load data if enabled
                        if (autoLoad) {
                            loadData(worker);
                        }
                        break;

                    case 'DATA_READY':
                        addLog('WorkerA', 'info', `Data loaded: ${event.data.totalCandles} candles`);

                        // Auto-play if enabled
                        if (autoPlay) {
                            worker.postMessage({ type: 'PLAY', speed: playbackSpeed });
                        }
                        break;

                    case 'TICK':
                        // Push tick to store (for orderbook/tape simulation)
                        if (data) {
                            // 🔥 ZOMBIE CHECK: Drop ticks from old epochs
                            if (event.data.epoch !== undefined && event.data.epoch !== epochRef.current) {
                                return;
                            }
                            pushTick(data as TickData);
                        }
                        break;

                    case 'CANDLE_UPDATE':
                        // Update current live candle in store (for chart)
                        if (event.data.candle) {
                            // 🔥 ZOMBIE CHECK: Drop candles from old epochs
                            if (event.data.epoch !== undefined && event.data.epoch !== epochRef.current) {
                                return;
                            }
                            updateCurrentCandle(event.data.candle);
                        }
                        break;

                    case 'CANDLE_CHANGE':
                        // console.log(`[useSimulationEngine] Candle ${event.data.candleIndex}`);
                        break;

                    case 'PLAYBACK_STATE':
                        console.log(`[useSimulationEngine] Playback state: ${event.data.isPlaying ? 'Playing' : 'Paused'} at ${event.data.speed}x`);
                        setIsPlaying(event.data.isPlaying); // ✅ Sync state
                        break;

                    case 'COMPLETE':
                        addLog('WorkerA', 'info', 'Simulation complete');
                        console.log('[useSimulationEngine] Simulation complete');
                        break;

                    default:
                        console.warn('[useSimulationEngine] Unknown message type:', type);
                }
            };

            // ✅ ENHANCED ERROR HANDLING
            worker.onerror = (error: ErrorEvent) => {
                console.error('[useSimulationEngine] Worker initialization/runtime error:', error.message);

                addLog('WorkerA', 'error', `Runtime Error: ${error.message}`, {
                    filename: error.filename,
                    lineno: error.lineno
                });
                updateWorkerStatus('physics', { status: 'error' });
            };

            workerRef.current = worker;
            isInitialized.current = true;

        } catch (error) {
            console.error('[useSimulationEngine] Failed to initialize Worker:', error);
            addLog('System', 'error', 'Failed to initialize Worker', error);
        }

        // Cleanup
        return () => {
            if (workerRef.current) {
                workerRef.current.terminate();
                workerRef.current = null;
                isInitialized.current = false;
                console.log('[useSimulationEngine] Worker terminated');
                updateWorkerStatus('physics', { status: 'offline' });
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
            addLog('System', 'error', 'Failed to auto-load default data', error);
        }
    }, [addLog]);

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

            // 🕵️ PAYLOAD CHECK
            const lastHist = params.historyBuffer[params.historyBuffer.length - 1];
            const firstSim = params.simulationQueue[0];
            console.log(`[useSimulationEngine] 📦 Payload Check: Hist End=${lastHist?.t} (${new Date(lastHist?.t).toLocaleString()}) -> Sim Start=${firstSim?.t} (${new Date(firstSim?.t).toLocaleString()})`);

            workerRef.current.postMessage({
                type: 'INIT_DATA',
                historyBuffer: params.historyBuffer,
                simulationQueue: params.simulationQueue,
                interval: params.interval,
                epoch: currentEpoch, // 🔥 Pass Epoch
            });
        } else {
            console.warn('[useSimulationEngine] Worker not ready yet, cannot init with buffers');
        }
    }, []);

    // 🔥 NEW: Load Scenario Directly from IDB (Worker)
    const loadScenario = useCallback((scenarioId: string) => {
        if (workerRef.current) {
            console.log(`[useSimulationEngine] 📥 Instructing worker to load scenario: ${scenarioId}`);
            workerRef.current.postMessage({
                type: 'LOAD_SCENARIO',
                scenarioId,
            });
        }
    }, []);

    // 🔥 NEW: Sync Interval Method
    const setInterval = useCallback((interval: string) => {
        if (workerRef.current) {
            console.log(`[useSimulationEngine] 🔄 Syncing worker interval to ${interval}`);
            workerRef.current.postMessage({
                type: 'SET_INTERVAL',
                interval,
            });
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
        loadScenario,      // 🆕 Exposed method: Load from IDB
        setInterval,       // 🆕 Exposed method
        isReady,
        isPlaying,         // ✅ Exposed state
    };
}
