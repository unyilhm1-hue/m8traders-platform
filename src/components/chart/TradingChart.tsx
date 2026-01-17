'use client';

import { useEffect, useRef, memo, useState } from 'react';
import {
    createChart,
    ColorType,
    CrosshairMode,
    type IChartApi,
    type ISeriesApi,
    type CandlestickData,
    type Time,
} from 'lightweight-charts';
import { useSimulationStore, normalizeTimestamp } from '@/stores/useSimulationStore';
import { simTelemetry } from '@/lib/telemetry';
import { ChartProvider, useChartContext } from '@/contexts/ChartContext';
import { DrawingOverlay } from './DrawingOverlay';
import { useChartStore } from '@/stores';
import { calculateIndicator } from '@/lib/chart/indicators';
import { profiler, KPI_TARGETS } from '@/utils/profiler';

interface TradingChartProps {
    className?: string;
}

// 1. Bungkus memo agar tidak re-render oleh Parent
const TradingChartInner = memo(function TradingChartInner({ className = '' }: TradingChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const mainChartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

    // 🔥 NEW: Context for Overlay
    const { setChart, setMainSeries } = useChartContext();

    // Ref untuk mencegah reload history yang tidak perlu
    const historyLoadedRef = useRef<number>(0);
    const historyLoadedLengthRef = useRef<number>(0); // 🔥 New ref for length tracking
    const lastLoadedIntervalRef = useRef<string>('1m');
    const lastUpdateTimeRef = useRef<number>(0);
    const pendingUpdateRef = useRef<CandlestickData | null>(null);
    const isAtLiveEdgeRef = useRef<boolean>(true); // 🔥 Track if user is at the latest data

    // Ambil history & indicators dari store
    const candleHistory = useSimulationStore((state) => state.candleHistory);

    // Access Chart Store for active indicators
    const activeIndicators = useChartStore((state) => state.indicators);

    // Ref to track indicator series
    const indicatorSeriesRef = useRef<Map<string, ISeriesApi<any>>>(new Map());
    const activeIndicatorsRef = useRef(activeIndicators); // 🔥 Track indicators for Raf loop

    useEffect(() => {
        activeIndicatorsRef.current = activeIndicators;
    }, [activeIndicators]);

    // --- A. INITIALIZE CHART (Run Once) ---
    useEffect(() => {
        if (!chartContainerRef.current) return;

        // Setup Chart
        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: '#131722' }, // Dark Theme
                textColor: '#d1d5db',
            },
            grid: {
                vertLines: { color: '#1E222D' },
                horzLines: { color: '#1E222D' },
            },
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight, // 🔥 Responsive height
            crosshair: {
                mode: CrosshairMode.Normal,
            },
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
                borderColor: '#2B2B43',
                minBarSpacing: 8,
            },
            rightPriceScale: {
                borderColor: '#2B2B43',
                autoScale: true,
                // 🔥 MAIN PANE: Comfortable margins to prevent clipping
                scaleMargins: {
                    top: 0.1,     // 10% padding at top
                    bottom: 0.2,  // 20% for oscillators/volume
                },
            },
        });

        // Setup Main Series (Right Scale)
        const newSeries = chart.addCandlestickSeries({
            upColor: '#089981',
            downColor: '#F23645',
            borderVisible: false,
            wickVisible: true,
            wickUpColor: '#089981',
            wickDownColor: '#F23645',
        });

        mainChartRef.current = chart;
        candleSeriesRef.current = newSeries;

        // 🔥 Update Context
        setChart(chart);
        setMainSeries(newSeries);

        // 🔥 Resize Observer for Smooth Layout Transitions
        // Uses ResizeObserver instead of window.resize to catch sidebar toggles
        const resizeObserver = new ResizeObserver(entries => {
            if (!chart || !entries[0]) return;
            const { width, height } = entries[0].contentRect;
            chart.applyOptions({ width, height });
        });
        resizeObserver.observe(chartContainerRef.current);

        // 🔥 SMART AUTO-SCROLL LOGIC
        // Detect if user has scrolled back into history
        const timeScale = chart.timeScale();
        const checkLiveEdge = () => {
            // If the distance from the right edge is small, we are at live edge.
            // scrollPosition() returns dist from right edge (0 = reset).
            // Negative = scrolled back. Positive = scrolled past future.
            const pos = timeScale.scrollPosition();

            // Allow small buffer (e.g. -5 bars) to sticky snap
            isAtLiveEdgeRef.current = pos > -5;
        };
        timeScale.subscribeVisibleLogicalRangeChange(checkLiveEdge);

        return () => {
            timeScale.unsubscribeVisibleLogicalRangeChange(checkLiveEdge);
            resizeObserver.disconnect();

            // 🔥 CRITICAL FIX: Fully destroy chart to prevent ghosting / double labels
            if (mainChartRef.current) {
                mainChartRef.current.remove();
                mainChartRef.current = null;
            }
            candleSeriesRef.current = null;

            setChart(null);
            setMainSeries(null);

            // 🔥 CLEANUP: Clear indicator refs to prevent leaked series
            indicatorSeriesRef.current.clear();
        };
    }, []); // Run once

    // Helper: Smart Viewport Lookback
    const getSmartLookback = (interval: string): number => {
        if (interval === '1m') return 90;
        if (interval === '5m') return 120;
        if (interval.endsWith('h')) return 200;
        if (interval.endsWith('d')) return 250;
        return 100;
    };

    // --- B. LOAD HISTORY ---
    useEffect(() => {
        if (!candleHistory || candleHistory.length === 0) return;
        if (!candleSeriesRef.current || !mainChartRef.current) return;

        const currentInterval = useSimulationStore.getState().baseInterval;
        const lastCandleTime = candleHistory[candleHistory.length - 1].time;
        const total = candleHistory.length;

        // 🔥 FIX: Enhanced Guard
        // Check timestamp AND total count AND interval to detect silent updates (e.g. dedup/overwrite)
        if (historyLoadedRef.current === lastCandleTime &&
            historyLoadedLengthRef.current === total && // Added length check
            lastLoadedIntervalRef.current === currentInterval) {
            return;
        }

        try {
            console.log(`[Chart] 📥 Loading History (${candleHistory.length} candles, interval: ${currentInterval})...`);
            lastUpdateTimeRef.current = 0;

            // 🔥 PERFORMANCE: Windowed setData for large datasets
            // KPI Target: ≤15ms per update, avoid full setData for >5k candles
            const WINDOW_THRESHOLD = 5000;
            const WINDOW_SIZE = 2000; // Load last 2k candles + buffer

            let candleData;
            if (total > WINDOW_THRESHOLD) {
                // Large dataset: only load recent window
                const startIdx = Math.max(0, total - WINDOW_SIZE);
                const windowedHistory = candleHistory.slice(startIdx);
                candleData = windowedHistory.map((c) => ({
                    time: c.time as Time,
                    open: c.open,
                    high: c.high,
                    low: c.low,
                    close: c.close,
                }));
                console.log(`[Chart] 🪟 Windowed load: ${windowedHistory.length} of ${total} candles`);
            } else {
                // Small dataset: load all
                candleData = candleHistory.map((c) => ({
                    time: c.time as Time,
                    open: c.open,
                    high: c.high,
                    low: c.low,
                    close: c.close,
                }));
            }

            // 🔬 PROFILING: Measure setData duration
            profiler.start('chart_setData', {
                candles: candleData.length,
                windowed: total > WINDOW_THRESHOLD
            });

            candleSeriesRef.current.setData(candleData);

            const setDataDuration = profiler.end('chart_setData');

            // 🔬 KPI CHECK: Verify setData meets targets
            if (setDataDuration !== null) {
                const target = total <= 1000 ? KPI_TARGETS.CHART.SET_DATA_1K :
                    total <= 5000 ? KPI_TARGETS.CHART.SET_DATA_5K :
                        KPI_TARGETS.CHART.SET_DATA_10K;

                if (setDataDuration > target) {
                    console.warn(`[Chart] ⚠️ setData exceeded target for ${total} candles: ${setDataDuration.toFixed(2)}ms > ${target}ms`);
                }
            }

            // Viewport Logic: Only force snap if user is already at the edge
            // or if it's the very first load (historyLoadedRef.current === 0)
            const isFirstLoad = historyLoadedRef.current === 0;

            if (isAtLiveEdgeRef.current || isFirstLoad) {
                const lookback = getSmartLookback(currentInterval);
                const total = candleHistory.length;
                if (total > lookback) {
                    mainChartRef.current.timeScale().setVisibleLogicalRange({
                        from: total - lookback,
                        to: total - 1
                    });
                } else {
                    mainChartRef.current.timeScale().fitContent();
                }
            }


            historyLoadedRef.current = lastCandleTime as number;
            historyLoadedLengthRef.current = total; // Sync length
            lastLoadedIntervalRef.current = currentInterval;


        } catch (error) {
            console.error('[Chart] History Load Error:', error);
        }
    }, [candleHistory]);

    // --- B2. INTERVAL CHANGE ---
    const baseInterval = useSimulationStore((state) => state.baseInterval);
    useEffect(() => {
        lastUpdateTimeRef.current = 0;
    }, [baseInterval]);

    // --- C. REALTIME UPDATE ---
    useEffect(() => {
        let rafId: number | null = null;
        const flushUpdate = () => {
            rafId = null;
            if (!pendingUpdateRef.current || !candleSeriesRef.current) return;
            const update = pendingUpdateRef.current;

            // 🔥 DEFENSIVE: Verify timestamp is strictly a number
            if (typeof update.time !== 'number') {
                console.error('[Chart] ❌ Rejected update with non-numeric timestamp:', update);
                pendingUpdateRef.current = null;
                return;
            }

            if ((update.time as number) < lastUpdateTimeRef.current) return;

            try {
                candleSeriesRef.current.update(update);
                lastUpdateTimeRef.current = update.time as number;

                // 🔥 REAL-TIME INDICATOR UPDATES (Incremental)
                // Wiggle the indicators with the live price!
                if (indicatorSeriesRef.current.size > 0 && activeIndicatorsRef.current.length > 0) {
                    const history = useSimulationStore.getState().candleHistory;

                    // 🔬 PROFILING: Start total indicator time
                    profiler.start('indicators_total', {
                        count: activeIndicatorsRef.current.length,
                        candles: history.length
                    });

                    // 1. Create a "Tail Buffer" (Last 100 candles + Live Candle)
                    // We don't need full history, just enough for EMA/RSI convergence (100-200 is plenty)
                    const tail = history.slice(-200).map(c => ({
                        t: c.time,
                        o: c.open,
                        h: c.high,
                        l: c.low,
                        c: c.close,
                        v: 0 // Volume not strictly needed for Price Indicators
                    }));

                    // 2. Append the live candle to the tail
                    tail.push({
                        t: update.time as number,
                        o: update.open,
                        h: update.high,
                        l: update.low,
                        c: update.close,
                        v: 0
                    });

                    // 3. Recalculate indicators on tail (incremental, not full data)
                    activeIndicatorsRef.current.forEach(indicator => {
                        const series = indicatorSeriesRef.current.get(indicator.id);
                        if (!series) return;

                        // 🔬 PROFILING: Measure each indicator
                        profiler.start(`indicator_${indicator.type}`, { candles: tail.length });

                        try {
                            const result = calculateIndicator(indicator.type, tail, indicator.period);
                            const data = result;

                            if (data && data.length > 0) {
                                const latest = data[data.length - 1];
                                series.update(latest);
                            }
                        } catch (error) {
                            console.error(`[Chart] Indicator ${indicator.type} calculation failed:`, error);
                        }

                        const duration = profiler.end(`indicator_${indicator.type}`);

                        // 🔬 KPI CHECK: Verify ≤2ms per indicator
                        if (duration !== null && duration > KPI_TARGETS.INDICATOR.PER_INDICATOR) {
                            console.warn(`[Chart] ⚠️ Indicator ${indicator.type} exceeded target: ${duration.toFixed(2)}ms > ${KPI_TARGETS.INDICATOR.PER_INDICATOR}ms`);
                        }
                    });

                    // 🔬 PROFILING: End total indicator time
                    const totalDuration = profiler.end('indicators_total');

                    // 🔬 KPI CHECK: Verify ≤15ms total
                    if (totalDuration !== null && totalDuration > KPI_TARGETS.INDICATOR.TOTAL_ALL) {
                        console.warn(`[Chart] ⚠️ Total indicators exceeded target: ${totalDuration.toFixed(2)}ms > ${KPI_TARGETS.INDICATOR.TOTAL_ALL}ms`);
                    }
                }

            } catch (err) {
                console.error('[Chart] 💥 Update failed:', err, update);
            }

            pendingUpdateRef.current = null;
            simTelemetry.recordCandleUpdate();
        };

        const unsubscribe = useSimulationStore.subscribe((state) => {
            const currentCandle = state.currentCandle;
            if (!currentCandle) return;
            const time = normalizeTimestamp(currentCandle.time);

            // 🔥 FIX: Guard against invalid candles to prevent label dropout
            if (!currentCandle.open || !currentCandle.close || !currentCandle.high || !currentCandle.low) return;

            // 🔥 FIX: Detect Seek/Reset (Backwards time jump)
            // If we receive a timestamp OLDER than the last processed one, it means user seeked back.
            // We must allow this update by resetting the gatekeeper.
            if ((time as number) < lastUpdateTimeRef.current) {
                // console.log('[Chart] ⏪ Time reset detected, allowing update');
                lastUpdateTimeRef.current = 0;
            }

            pendingUpdateRef.current = {
                time: time as Time,
                open: currentCandle.open,
                high: currentCandle.high,
                low: currentCandle.low,
                close: currentCandle.close,
            };
            if (rafId === null) {
                rafId = requestAnimationFrame(flushUpdate);
            }
        });

        return () => {
            unsubscribe();
            if (rafId !== null) cancelAnimationFrame(rafId);
        };
    }, []);

    // --- D. INDICATORS MANAGEMENT ---
    useEffect(() => {
        if (!mainChartRef.current || !activeIndicators) return;
        if (!candleHistory || candleHistory.length === 0) return;

        // 1. Identify enabled indicators
        const enabledIndicators = activeIndicators.filter(i => i.enabled);
        const enabledIds = new Set(enabledIndicators.map(i => i.id));

        // 2. Remove disabled series
        indicatorSeriesRef.current.forEach((series, id) => {
            if (!enabledIds.has(id)) {
                mainChartRef.current!.removeSeries(series);
                indicatorSeriesRef.current.delete(id);
            }
        });

        // 3. Add/Update enabled indicators
        enabledIndicators.forEach(ind => {
            // Map ChartCandle (seconds, full keys) to Candle (t, o, h, l, c, v)
            const mapData = candleHistory.map(c => ({
                t: c.time,
                o: c.open,
                h: c.high,
                l: c.low,
                c: c.close,
                v: 0
            }));

            const data = calculateIndicator(ind.type, mapData, ind.period);
            if (!data.length) return;

            let series: ISeriesApi<any>;

            if (indicatorSeriesRef.current.has(ind.id)) {
                series = indicatorSeriesRef.current.get(ind.id)!;
            } else {
                if (['macd', 'rsi', 'volume'].includes(ind.type)) {
                    // 🔥 SEPARATE PANE (Bottom) - Unique Scale per Indicator
                    series = mainChartRef.current!.addLineSeries({
                        color: ind.color || '#2962FF',
                        lineWidth: 1,
                        priceScaleId: ind.id, // Use ID as Unique Scale ID
                    });

                    // Configure this specific scale to live in the bottom 20%
                    mainChartRef.current!.priceScale(ind.id).applyOptions({
                        borderColor: '#2B2B43',
                        scaleMargins: {
                            top: 0.8,
                            bottom: 0,
                        },
                    });
                } else if (ind.type === 'bollinger') {
                    // Overlay Main
                    series = mainChartRef.current!.addLineSeries({
                        color: ind.color || '#2962FF',
                        lineWidth: 1,
                        priceScaleId: 'right',
                    });
                } else {
                    // Overlay Main (MA, etc)
                    series = mainChartRef.current!.addLineSeries({
                        color: ind.color || '#2962FF',
                        lineWidth: 1,
                        priceScaleId: 'right',
                    });
                }
                indicatorSeriesRef.current.set(ind.id, series);
            }

            series.setData(data);
        });

    }, [activeIndicators, candleHistory]);

    // --- E. LEGEND STATE ---
    const [legendData, setLegendData] = useState<any>(null);
    const isCrosshairActiveRef = useRef(false);

    useEffect(() => {
        if (!mainChartRef.current || !candleSeriesRef.current) return;

        const updateLegend = (param: any) => {
            if (param.time) {
                isCrosshairActiveRef.current = true;
                const data = param.seriesData.get(candleSeriesRef.current!);
                if (data) {
                    setLegendData({ ...data, change: data.close - data.open });
                }
            } else {
                isCrosshairActiveRef.current = false;
                // Don't clear immediately, let the data loop take over
            }
        };

        mainChartRef.current.subscribeCrosshairMove(updateLegend);
        return () => mainChartRef.current?.unsubscribeCrosshairMove(updateLegend);
    }, []);

    // Sync Legend with Realtime Data (when crosshair idle)
    useEffect(() => {
        const syncLegend = () => {
            if (isCrosshairActiveRef.current) return;

            // Get latest from Store directly to avoid prop drilling lag
            const current = useSimulationStore.getState().currentCandle;
            if (current) {
                setLegendData({
                    ...current,
                    change: current.close - current.open
                });
            } else {
                // Fallback to last history item if no live candle
                const history = useSimulationStore.getState().candleHistory;
                if (history.length > 0) {
                    const last = history[history.length - 1];
                    setLegendData({
                        ...last,
                        change: last.close - last.open
                    });
                }
            }
        };

        // Hook into the store's high-freq updates
        // We can reuse the `raf` loop mechanism or just subscribe separately.
        // Since setLegendData triggers React Render, we should throttle this slightly?
        // Actually, React batching might handle it, but 60fps renders of text might be heavy.
        // Let's rely on the existing RAF loop (Effect C) to call a ref-based update?
        // No, Effect C is for Chart internal update().

        // Let's use a separate subscription for UI (Legend) with basic throttling (e.g. 100ms)
        // because User eye doesn't need 60fps text updates, and it saves Main Thread.

        let lastUpdate = 0;
        const unsub = useSimulationStore.subscribe((state) => {
            const now = performance.now();
            if (now - lastUpdate > 100) { // Limit UI updates to 10fps
                syncLegend();
                lastUpdate = now;
            }
        });

        return () => unsub();
    }, []);

    // Selectors
    const ticker = useSimulationStore((state) => state.currentTicker || 'BTCUSD');
    const interval = useSimulationStore((state) => state.baseInterval || '1m');

    return (
        <div className={`relative w-full h-full ${className} group`}>
            {/* 🔥 SEPARATED: Chart Container (Safe for innerHTML = '') */}
            <div ref={chartContainerRef} className="absolute inset-0 z-0" />

            {/* 🔥 DRAWING OVERLAY: z-index 10 */}
            <div className="absolute inset-0 z-10 pointer-events-none">
                <DrawingOverlay />
            </div>

            {/* LEGEND OVERLAY: z-20 but small and strictly top-left */}
            <div className="absolute top-4 left-4 z-20 font-sans pointer-events-none select-none flex flex-col gap-1">
                <div className="flex items-baseline gap-2">
                    <span className="text-lg font-bold text-[var(--text-primary)] tracking-wide drop-shadow-md">{ticker}</span>
                    <span className="text-xs font-semibold text-[var(--text-tertiary)] bg-[var(--bg-tertiary)] px-1 rounded shadow-sm">{interval}</span>
                    <span className="text-xs text-[var(--text-tertiary)] ml-2 drop-shadow-sm">M8 Market Simulation</span>
                </div>

                {legendData && (
                    <div className="flex items-center gap-4 text-xs font-mono tracking-tighter opacity-90 transition-opacity drop-shadow-md">
                        <span className={Math.abs(legendData.change) < Number.EPSILON ? "text-[var(--text-primary)]" : legendData.change > 0 ? "text-[var(--color-up)]" : "text-[var(--color-down)]"}>
                            {legendData.close?.toFixed(2)}
                            <span className="ml-1">
                                ({legendData.change > 0 ? '+' : ''}{legendData.change?.toFixed(2)})
                            </span>
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
});

// Wrapper to Provide Context
export const TradingChart = memo(function TradingChart(props: TradingChartProps) {
    return (
        <ChartProvider>
            <TradingChartInner {...props} />
        </ChartProvider>
    );
});
