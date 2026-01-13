/**
 * TradingChart Component
 * KLineChart wrapper with m8traders integration
 */
'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
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
    const previousDataLengthRef = useRef(0);
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
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [theme]);

    // Update data when chartData changes
    useEffect(() => {
        const chart = chartInstance.current;
        if (!chart || chartData.length === 0) return;

        const previousLength = previousDataLengthRef.current;
        const nextLength = chartData.length;

        // Debug logging
        console.log('[TradingChart] Applying new data:', {
            count: chartData.length,
            first: chartData[0],
            last: chartData[chartData.length - 1],
        });

        if (previousLength === 0 || nextLength <= 1) {
            chart.applyNewData(chartData);
        } else if (nextLength === previousLength + 1) {
            chart.updateData(chartData[nextLength - 1]);
        } else {
            chart.applyNewData(chartData);
        }

        previousDataLengthRef.current = nextLength;
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

    // Update indicators with FULL CLEAR approach    // Effect to handle indicator changes
    useEffect(() => {
        const chart = chartInstance.current;
        if (!chart) return;

        console.group('🔍 [TradingChart] Indicator Update Triggered');
        console.log('Current indicators state:', indicators);
        console.log('Enabled indicators:', indicators.filter(i => i.enabled));
        console.log('Disabled indicators:', indicators.filter(i => !i.enabled));

        // STEP 1: Clear ALL indicators AND their panes (v9 requires explicit paneId)
        try {
            console.log('📌 Step 1: Clearing all indicators...');

            // Method 1: Remove all indicators globally
            chart.removeIndicator();
            console.log('✅ Removed all indicators globally');

            // Method 2: Explicitly remove from custom panes (v9 workaround for ghost panes)
            // This ensures panes are actually removed, not just emptied
            try {
                chart.removeIndicator('rsi-pane', 'RSI');
                console.log('✅ Explicitly removed RSI from rsi-pane');
            } catch (e) {
                console.warn('Could not remove from rsi-pane:', e);
            }

            try {
                chart.removeIndicator('macd-pane', 'MACD');
                console.log('✅ Explicitly removed MACD from macd-pane');
            } catch (e) {
                console.warn('Could not remove from macd-pane:', e);
            }

            // Method 3: Explicitly remove overlay indicators from main pane
            // SMA and EMA are overlays on candle_pane, need explicit removal too
            try {
                chart.removeIndicator('candle_pane', 'MA');
                console.log('✅ Explicitly removed MA (SMA) from candle_pane');
            } catch (e) {
                console.warn('Could not remove MA from candle_pane:', e);
            }

            try {
                chart.removeIndicator('candle_pane', 'EMA');
                console.log('✅ Explicitly removed EMA from candle_pane');
            } catch (e) {
                console.warn('Could not remove EMA from candle_pane:', e);
            }


            // Debug: Check chart state after clear
            try {
                const panes = chart.getPanes();
                console.log('Panes after clear:', panes?.map((p: any) => ({
                    id: p.id,
                    state: p.state,
                    height: p.height
                })));
            } catch (e) {
                console.warn('Could not get panes info:', e);
            }
        } catch (e) {
            console.error('❌ Error clearing indicators:', e);
        }

        // STEP 2: Recreate ONLY enabled indicators
        console.log('📌 Step 2: Recreating enabled indicators...');
        const activeTypes: string[] = [];

        // ✅ CRITICAL FIX: Collect all SMA/EMA periods FIRST
        // KLineChart stores indicators by name per pane - multiple 'MA' creates overwrite!
        // Solution: Create ONE MA with calcParams: [20, 50] to show both periods
        const smaPeriods: number[] = [];
        const emaPeriods: number[] = [];

        indicators.forEach((indicator) => {
            if (indicator.enabled && indicator.period) {
                if (indicator.type === 'sma') {
                    smaPeriods.push(indicator.period);
                } else if (indicator.type === 'ema') {
                    emaPeriods.push(indicator.period);
                }
            }
        });

        // ✅ Sort periods in ascending order (KLineChart may expect this)
        smaPeriods.sort((a, b) => a - b);
        emaPeriods.sort((a, b) => a - b);

        // Create SINGLE MA indicator with all SMA periods
        if (smaPeriods.length > 0) {
            try {
                console.log(`Creating MA with periods: [${smaPeriods.join(', ')}]`);
                const result = chart.createIndicator(
                    {
                        name: 'MA',
                        calcParams: smaPeriods, // ✅ Multiple periods in ONE indicator!
                    },
                    true, // overlay
                    { id: 'candle_pane' }
                );
                console.log(`✅ Created MA with ${smaPeriods.length} period(s), result:`, result);
                smaPeriods.forEach(p => activeTypes.push(`SMA(${p})`));
            } catch (e) {
                console.error('❌ Failed to create MA:', e);
            }
        }

        // Create SINGLE EMA indicator with all EMA periods
        if (emaPeriods.length > 0) {
            try {
                console.log(`Creating EMA with periods: [${emaPeriods.join(', ')}]`);
                const result = chart.createIndicator(
                    {
                        name: 'EMA',
                        calcParams: emaPeriods, // ✅ Multiple periods in ONE indicator!
                    },
                    true, // overlay
                    { id: 'candle_pane' }
                );
                console.log(`✅ Created EMA with ${emaPeriods.length} period(s), result:`, result);
                emaPeriods.forEach(p => activeTypes.push(`EMA(${p})`));
            } catch (e) {
                console.error('❌ Failed to create EMA:', e);
            }
        }

        // Process other indicator types normally (one per type)
        indicators.forEach((indicator) => {
            if (indicator.enabled) {
                console.log(`Creating indicator: ${indicator.type}(${indicator.period})`);
                try {
                    if (indicator.type === 'rsi') {
                        // ✅ Separate pane for RSI
                        const result = chart.createIndicator(
                            {
                                name: 'RSI',
                                calcParams: [indicator.period],
                            },
                            false, // not overlay
                            { id: 'rsi-pane', height: 100 }
                        );
                        console.log('✅ Created RSI in separate pane, result:', result);
                        activeTypes.push('RSI');
                    } else if (indicator.type === 'macd') {
                        // ✅ Separate pane for MACD
                        const result = chart.createIndicator(
                            {
                                name: 'MACD',
                                calcParams: [12, 26, 9],
                            },
                            false, // not overlay
                            { id: 'macd-pane', height: 100 }
                        );
                        console.log('✅ Created MACD in separate pane, result:', result);
                        activeTypes.push('MACD');
                    } else if (indicator.type === 'bollinger') {
                        // ✅ Overlay Bollinger Bands
                        const result = chart.createIndicator(
                            {
                                name: 'BOLL',
                                calcParams: [indicator.period, 2],
                            },
                            true, // overlay
                            { id: 'candle_pane' }
                        );
                        console.log('✅ Created BOLLINGER overlay, result:', result);
                        activeTypes.push('BOLL');
                    } else if (indicator.type === 'sar') {
                        // ✅ Overlay SAR
                        const result = chart.createIndicator(
                            {
                                name: 'SAR',
                                calcParams: [2, 0.02, 0.2],
                            },
                            true, // overlay
                            { id: 'candle_pane' }
                        );
                        console.log('✅ Created SAR overlay, result:', result);
                        activeTypes.push('SAR');
                    }
                } catch (e) {
                    console.error(`❌ Failed to create indicator ${indicator.id}:`, e);
                }
            }
        });

        // Debug: Final check
        try {
            const finalPanes = chart.getPanes();
            console.log('📊 Final panes structure:', finalPanes?.map((p: any) => ({
                id: p.id,
                state: p.state,
                height: p.height,
                indicators: p.indicators?.length || 0
            })));
        } catch (e) {
            console.warn('Could not get final panes info:', e);
        }

        if (activeTypes.length > 0) {
            console.log('✅ Active indicators:', activeTypes);
        } else {
            console.log('ℹ️ All indicators cleared');
        }

        console.groupEnd();
    }, [indicators]); // TODO: Optimize to only rebuild when structure changes, not colors

    // 🔧 OPTIMIZATION: Track only structural changes (enabled status + periods)
    // Color-only changes should NOT trigger full rebuild
    const indicatorStructure = useMemo(() => {
        return indicators
            .filter(i => i.enabled)
            .map(i => `${i.type}-${i.period}`)
            .sort()
            .join(',');
    }, [indicators]);

    // FUTURE: Use indicatorStructure as dependency once we implement overrideIndicator for colors

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
