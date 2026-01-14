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
import { INDICATOR_CONFIG } from '@/lib/chart/config';
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
        setCurrentCandle,
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
        console.log(`[TradingChart] Engine useEffect triggered - isReplayActive: ${isReplayActive}, replayData: ${replayData.length}, isPlaying: ${isPlaying}`);

        if (!isReplayActive || replayData.length === 0) {
            // Clean up engine if switching to live mode
            if (replayEngineRef.current) {
                console.log('[TradingChart] Destroying engine - switching to live mode');
                replayEngineRef.current.destroy();
                replayEngineRef.current = null;
            }
            return;
        }

        // Create new replay engine with tick-by-tick support
        const engine = new ReplayEngine(replayData, {
            timeframe,
            speed: playbackSpeed,
            numTicks: 20, // 20 ticks per candle for smooth animation
            onTickUpdate: (tick) => {
                // ✅ FIX: Update ONLY the last candle, don't re-render entire chart
                const partialCandle = engine.getCurrentCandle();
                const chart = chartInstance.current;

                if (partialCandle && chart) {
                    try {
                        // Update store with current partial candle
                        setCurrentCandle(partialCandle);

                        // Convert to KLineData format
                        const klinePartial = toKLineData([partialCandle])[0];

                        // ✅ FIX: Ensure chart has initial data before updating
                        // On first tick, use applyNewData to set initial visible data
                        const visibleData = engine.getVisibleData();
                        if (tick.tickIndex === 0 && visibleData.length > 0) {
                            // First tick: apply all visible data including the partial candle
                            const initialData = [...visibleData.slice(0, -1), partialCandle];
                            chart.applyNewData(toKLineData(initialData));
                            console.log(`[TradingChart] Initial data applied: ${initialData.length} candles`);
                        } else {
                            // Subsequent ticks: update only last candle
                            chart.updateData(klinePartial);
                        }

                        if (tick.tickIndex % 5 === 0) { // Log every 5th tick to reduce noise
                            console.log(`[TradingChart] Tick ${tick.tickIndex + 1}/20, price: ${tick.price.toFixed(0)}`);
                        }
                    } catch (e) {
                        console.error('[TradingChart] Error updating tick:', e);
                    }
                }
            },
            onUpdate: (visibleData) => {
                // Candle completed → full data sync
                const klineData = toKLineData(visibleData);
                const chart = chartInstance.current;

                if (chart) {
                    // Use applyNewData for full candle completion
                    chart.applyNewData(klineData);
                    console.log(`[TradingChart] Candle completed, total: ${visibleData.length}`);
                }

                // Update store with completed candle
                if (visibleData.length > 0) {
                    setCurrentCandle(visibleData[visibleData.length - 1]);
                }

                // Keep state in sync for other components
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

        // Show initial candles (limit to last 150 to prevent barcode effect)
        // This ensures chart starts zoomed-in on Day 2 with readable candles
        const visibleData = engine.getVisibleData();
        const maxInitialCandles = 150; // Show max 150 candles initially
        const startIndex = Math.max(0, visibleData.length - maxInitialCandles);
        const limitedData = visibleData.slice(startIndex);

        const initialData = toKLineData(limitedData);
        setChartData(initialData);

        console.log(`[TradingChart] Engine created successfully with ${replayData.length} candles`);
        console.log(`[TradingChart] Showing last ${limitedData.length} of ${visibleData.length} candles initially`);

        // Auto-play if isPlaying is already true (race condition fix)
        // This handles case where user clicked Play before data loaded
        if (isPlaying) {
            console.log('[ReplayEngine] Auto-playing after data load (isPlaying was already true)');
            engine.play();
        } else {
            console.log('[ReplayEngine] Engine created but NOT playing (isPlaying = false)');
        }

        return () => {
            console.log('[TradingChart] Cleaning up engine');
            engine.destroy();
        };
    }, [isReplayActive, replayData, setReplayIndex, timeframe]); // playbackSpeed removed - handled by separate useEffect

    // Sync playback state with engine
    useEffect(() => {
        const engine = replayEngineRef.current;
        console.log(`[TradingChart] isPlaying changed to: ${isPlaying}, engine exists: ${!!engine}`);

        if (!engine) {
            console.warn('[TradingChart] Cannot sync play state - engine not created yet');
            return;
        }

        if (isPlaying) {
            console.log('[TradingChart] Calling engine.play()');
            engine.play();
        } else {
            console.log('[TradingChart] Calling engine.pause()');
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


            // Debug: indicators cleared successfully
            console.log('✅ All indicators cleared from chart');
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

        // Process other indicator types dynamically
        const processedTypes = new Set(['sma', 'ema']); // Already handled above

        indicators.forEach((indicator) => {
            if (indicator.enabled && !processedTypes.has(indicator.type)) {

                const config = INDICATOR_CONFIG[indicator.type];
                if (!config) {
                    console.warn(`⚠️ No config found for indicator type: ${indicator.type}`);
                    return;
                }

                console.log(`Creating indicator: ${indicator.type}(${indicator.period || 'default'})`);

                try {
                    // Determine pane and overlay settings
                    const isMainPane = config.pane === 'main';
                    const isOverlay = isMainPane;
                    const paneId = isMainPane ? 'candle_pane' : `${indicator.type}-pane`;

                    // Determine calcParams
                    // If indicator has a specific period, use it. Otherwise fall back to config default.
                    // Some indicators (MACD) might have fixed params in config, or multiple params.
                    // For now, we support single period override if the indicator has 'period' property.
                    let calcParams: number[] = [];

                    if (indicator.period) {
                        calcParams = [indicator.period];
                        // Special handling for Bollinger (needs stdDev)
                        if (indicator.type === 'bollinger') {
                            calcParams = [indicator.period, 2];
                        }
                    } else if (config.defaultPeriod) {
                        calcParams = [config.defaultPeriod];
                    }

                    // If specific calcParams are needed for complex indicators (MACD, SAR), 
                    // we might need to enhance the Indicator type or config.
                    // For now, preserving hardcoded defaults for complex ones if not simple period:
                    if (indicator.type === 'macd') calcParams = [12, 26, 9];
                    if (indicator.type === 'sar') calcParams = [2, 0.02, 0.2];
                    if (indicator.type === 'kdj') calcParams = [9, 3, 3];

                    const result = chart.createIndicator(
                        {
                            name: config.name,
                            calcParams: calcParams.length > 0 ? calcParams : undefined,
                        },
                        isOverlay,
                        { id: paneId, height: 100 }
                    );

                    console.log(`✅ Created ${config.name} in ${paneId}, result:`, result);
                    activeTypes.push(config.name);

                } catch (e) {
                    console.error(`❌ Failed to create indicator ${indicator.id}:`, e);
                }
            }
        });

        // Indicator application complete
        console.log('📊 Indicator application complete');

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

