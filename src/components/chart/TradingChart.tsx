/**
 * TradingChart Component
 * KLineChart wrapper with m8traders integration
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { init, dispose } from 'klinecharts';
import { useChartStore } from '@/stores';
import {
    getChartTheme,
    toKLineData,
    fetchStockData,
    type KLineData,
} from '@/lib/chart';
import { ReplayEngine } from '@/lib/replay';
import type { Candle } from '@/types';

interface TradingChartProps {
    data?: Candle[];
    onPriceChange?: (price: number) => void;
    className?: string;
}

export function TradingChart({ data, onPriceChange, className = '' }: TradingChartProps) {
    const chartRef = useRef<HTMLDivElement>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chartInstance = useRef<any>(null);
    const indicatorInstancesRef = useRef<
        Map<
            string,
            {
                indicatorId: string;
                paneId: string;
                signature: string;
            }
        >
    >(new Map());

    const {
        ticker,
        timeframe,
        indicators,
        theme,
        activeDrawingTool,
        overlays,
        replayMode,
        replayData,
        replayIndex,
        isPlaying,
        playbackSpeed,
        setLoading,
        setError,
        setLastUpdate,
        addOverlay,
        setActiveDrawingTool,
        setReplayData,
        setReplayIndex,
    } = useChartStore();

    const [chartData, setChartData] = useState<KLineData[]>([]);
    const replayEngineRef = useRef<ReplayEngine | null>(null);
    const isReplayActive = replayMode !== 'live';

    // Fetch data when ticker, timeframe, or replay mode changes
    useEffect(() => {
        let isCancelled = false;

        const loadData = async () => {
            if (data && data.length > 0) {
                // Use provided data
                if (isReplayActive) {
                    setReplayData(data);
                } else {
                    setChartData(toKLineData(data));
                }
                return;
            }

            // Fetch from data service
            setLoading(true);
            setError(null);

            try {
                const fetchedData = await fetchStockData(ticker, timeframe);

                if (!isCancelled) {
                    if (isReplayActive) {
                        // In replay mode, store full data for replay
                        setReplayData(fetchedData);
                        console.log(`[TradingChart] Loaded ${fetchedData.length} candles for replay mode: ${replayMode}`);
                    } else {
                        // In live mode, display all data
                        const klineData = toKLineData(fetchedData);
                        setChartData(klineData);
                    }
                    setLastUpdate(Date.now());
                }
            } catch (err) {
                if (!isCancelled) {
                    const errorMessage = err instanceof Error ? err.message : 'Failed to load data';
                    setError(errorMessage);
                    console.error('[TradingChart] Data load error:', err);
                }
            } finally {
                if (!isCancelled) {
                    setLoading(false);
                }
            }
        };

        loadData();

        return () => {
            isCancelled = true;
        };
    }, [ticker, timeframe, replayMode, data, isReplayActive, setLoading, setError, setLastUpdate, setReplayData]);

    // Initialize chart
    useEffect(() => {
        if (!chartRef.current || chartInstance.current) return;

        // Get theme styles
        const chartTheme = getChartTheme(theme);

        // Initialize KLineChart
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const chart: any = init(chartRef.current, {
            styles: chartTheme,
        } as any);

        if (chart) {
            chartInstance.current = chart;

            // Load data
            if (chartData.length > 0) {
                chart.applyNewData(chartData);
                console.log('[TradingChart] Chart initialized with data');
            }

            // Don't create volume pane automatically - let indicators handle it
        }

        // Cleanup
        return () => {
            if (chartRef.current) {
                dispose(chartRef.current);
                chartInstance.current = null;
                indicatorInstancesRef.current.clear();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [theme]);

    // Update data when chartData changes
    useEffect(() => {
        const chart = chartInstance.current;
        if (!chart || chartData.length === 0) return;

        // Debug logging
        console.log('[TradingChart] Applying new data:', {
            count: chartData.length,
            first: chartData[0],
            last: chartData[chartData.length - 1],
        });

        chart.applyNewData(chartData);
    }, [chartData]);

    // Initialize ReplayEngine when in replay mode
    useEffect(() => {
        if (!isReplayActive || replayData.length === 0) {
            // Clean up engine if switching to live mode
            if (replayEngineRef.current) {
                replayEngineRef.current.destroy();
                replayEngineRef.current = null;
            }
            return;
        }

        // Create new replay engine
        const engine = new ReplayEngine(replayData, {
            speed: playbackSpeed,
            onUpdate: (visibleData) => {
                // Update chart with visible candles
                const klineData = toKLineData(visibleData);
                setChartData(klineData);
            },
            onProgress: (index) => {
                setReplayIndex(index);
            },
            onComplete: () => {
                console.log('[ReplayEngine] Playback complete');
            },
        });

        replayEngineRef.current = engine;

        // Show initial candles
        const initialData = toKLineData(engine.getVisibleData());
        setChartData(initialData);

        return () => {
            engine.destroy();
        };
    }, [isReplayActive, replayData, playbackSpeed, setReplayIndex]);

    // Sync playback state with engine
    useEffect(() => {
        const engine = replayEngineRef.current;
        if (!engine) return;

        if (isPlaying) {
            engine.play();
        } else {
            engine.pause();
        }
    }, [isPlaying]);

    // Sync speed changes with engine
    useEffect(() => {
        const engine = replayEngineRef.current;
        if (!engine) return;

        engine.setSpeed(playbackSpeed);
    }, [playbackSpeed]);

    // Manual seek handling
    useEffect(() => {
        const engine = replayEngineRef.current;
        if (!engine || !isReplayActive) return;

        // Only seek if there's a significant difference (avoid loops)
        if (Math.abs(engine.getCurrentIndex() - replayIndex) > 1) {
            engine.seekTo(replayIndex);
        }
    }, [replayIndex, isReplayActive]);

    // Update indicators with stored indicator IDs/panes
    useEffect(() => {
        const chart = chartInstance.current;
        if (!chart) return;

        const enabledIndicators = new Map(
            indicators.filter((indicator) => indicator.enabled).map((indicator) => [indicator.id, indicator])
        );
        const indicatorInstances = indicatorInstancesRef.current;

        indicatorInstances.forEach((instance, indicatorId) => {
            if (!enabledIndicators.has(indicatorId)) {
                try {
                    chart.removeIndicator(instance.indicatorId, instance.paneId);
                } catch (e) {
                    console.warn('[TradingChart] Error removing indicator:', e);
                }
                indicatorInstances.delete(indicatorId);
            }
        });

        // STEP 2: Recreate ONLY enabled indicators
        const activeTypes: string[] = [];
        let hasRsi = false;
        let hasMacd = false;

        indicators.forEach((indicator) => {
            if (indicator.enabled) {
                try {
                    const signature = `${indicator.type}:${indicator.period ?? ''}`;
                    const existing = indicatorInstances.get(indicator.id);
                    if (existing && existing.signature === signature) {
                        activeTypes.push(existing.signature.toUpperCase());
                        if (indicator.type === 'rsi') hasRsi = true;
                        if (indicator.type === 'macd') hasMacd = true;
                        return;
                    }

                    if (existing) {
                        try {
                            chart.removeIndicator(existing.indicatorId, existing.paneId);
                        } catch (e) {
                            console.warn('[TradingChart] Error removing stale indicator:', e);
                        }
                        indicatorInstances.delete(indicator.id);
                    }

                    if (indicator.type === 'sma' || indicator.type === 'ema') {
                        // ✅ Overlay on main candle pane
                        const indicatorId = chart.createIndicator(
                            {
                                name: indicator.type === 'sma' ? 'MA' : 'EMA',
                                calcParams: [indicator.period],
                            },
                            false,
                            { id: 'candle_pane' }
                        );
                        if (indicatorId) {
                            indicatorInstances.set(indicator.id, {
                                indicatorId,
                                paneId: 'candle_pane',
                                signature,
                            });
                        }
                        activeTypes.push(`${indicator.type.toUpperCase()}(${indicator.period})`);
                    } else if (indicator.type === 'rsi') {
                        // Separate pane for RSI
                        const indicatorId = chart.createIndicator(
                            {
                                name: 'RSI',
                                calcParams: [indicator.period || 14],
                            },
                            false,
                            { id: 'rsi-pane' }
                        );
                        if (indicatorId) {
                            indicatorInstances.set(indicator.id, {
                                indicatorId,
                                paneId: 'rsi-pane',
                                signature,
                            });
                        }
                        hasRsi = true;
                        activeTypes.push('RSI(14)');
                    } else if (indicator.type === 'macd') {
                        // Separate pane for MACD
                        const indicatorId = chart.createIndicator(
                            'MACD',
                            false,
                            { id: 'macd-pane' }
                        );
                        if (indicatorId) {
                            indicatorInstances.set(indicator.id, {
                                indicatorId,
                                paneId: 'macd-pane',
                                signature,
                            });
                        }
                        hasMacd = true;
                        activeTypes.push('MACD');
                    } else if (indicator.type === 'bollinger') {
                        // ✅ Overlay on main pane
                        const indicatorId = chart.createIndicator(
                            {
                                name: 'BOLL',
                                calcParams: [indicator.period || 20, 2],
                            },
                            false,
                            { id: 'candle_pane' }
                        );
                        if (indicatorId) {
                            indicatorInstances.set(indicator.id, {
                                indicatorId,
                                paneId: 'candle_pane',
                                signature,
                            });
                        }
                        activeTypes.push('BOLL(20,2)');
                    } else if (indicator.type === 'sar') {
                        // ✅ SAR overlays on main pane
                        const indicatorId = chart.createIndicator(
                            'SAR',
                            false,
                            { id: 'candle_pane' }
                        );
                        if (indicatorId) {
                            indicatorInstances.set(indicator.id, {
                                indicatorId,
                                paneId: 'candle_pane',
                                signature,
                            });
                        }
                        activeTypes.push('SAR');
                    }
                } catch (e) {
                    console.error(`[TradingChart] Failed to create indicator ${indicator.id}:`, e);
                }
            }
        });

        if (!hasRsi) {
            try {
                chart.removeIndicator({ paneId: 'rsi-pane' });
            } catch (e) {
                console.warn('[TradingChart] Error clearing RSI pane:', e);
            }
        }

        if (!hasMacd) {
            try {
                chart.removeIndicator({ paneId: 'macd-pane' });
            } catch (e) {
                console.warn('[TradingChart] Error clearing MACD pane:', e);
            }
        }

        if (activeTypes.length > 0) {
            console.log('[TradingChart] Active indicators:', activeTypes);
        } else {
            console.log('[TradingChart] All indicators cleared');
        }
    }, [indicators]);

    // Price change callback
    useEffect(() => {
        if (!chartInstance.current || !onPriceChange) return;

        // Get last price from data
        if (chartData.length > 0) {
            const lastCandle = chartData[chartData.length - 1];
            onPriceChange(lastCandle.close);
        }
    }, [chartData, onPriceChange]);

    // Handle drawing tool selection
    useEffect(() => {
        const chart = chartInstance.current;
        if (!chart) return;

        if (activeDrawingTool) {
            // Start drawing mode
            try {
                chart.createOverlay({
                    name: activeDrawingTool,
                    lock: false,
                    visible: true,
                });
                console.log(`[TradingChart] Drawing mode enabled: ${activeDrawingTool}`);
            } catch (e) {
                console.warn(`Failed to create overlay ${activeDrawingTool}:`, e);
            }
        }
    }, [activeDrawingTool]);

    // Subscribe to overlay events
    useEffect(() => {
        const chart = chartInstance.current;
        if (!chart) return;

        // Subscribe to drawing complete
        // Note: KLineChart handles overlay creation internally
        // We can get overlays via chart.getOverlayById() after drawing

        // ESC key to cancel drawing
        const handleKeyPress = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && activeDrawingTool) {
                setActiveDrawingTool(null);
            }
        };

        window.addEventListener('keydown', handleKeyPress);

        return () => {
            window.removeEventListener('keydown', handleKeyPress);
        };
    }, [activeDrawingTool, setActiveDrawingTool]);

    // Handle overlay management (clearing)
    useEffect(() => {
        const chart = chartInstance.current;
        if (!chart) return;

        // When overlays array is empty, clear all overlays from chart
        if (overlays.length === 0) {
            try {
                chart.removeOverlay();
                console.log('[TradingChart] All overlays cleared');
            } catch (e) {
                console.warn('Failed to clear overlays:', e);
            }
        }
    }, [overlays]);

    return (
        <div
            ref={chartRef}
            data-testid="trading-chart"
            className={`w-full h-full bg-[var(--chart-bg)] rounded-lg overflow-hidden ${className}`}
        />
    );
}
