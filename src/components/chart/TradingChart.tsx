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
    const lastLoadedIntervalRef = useRef<string>('');
    const lastUpdateTimeRef = useRef<number>(0);
    const pendingUpdateRef = useRef<CandlestickData | null>(null);

    // Ambil history & indicators dari store
    const candleHistory = useSimulationStore((state) => state.candleHistory);

    // Access Chart Store for active indicators
    const activeIndicators = useChartStore((state) => state.indicators);

    // Ref to track indicator series
    const indicatorSeriesRef = useRef<Map<string, ISeriesApi<any>>>(new Map());

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
            height: Math.max(chartContainerRef.current.clientHeight, 500), // 🔥 Safe minimum height
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

        return () => {
            resizeObserver.disconnect();
            chart.remove();
            mainChartRef.current = null;
            candleSeriesRef.current = null;
            setChart(null);
            setMainSeries(null);
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

        if (historyLoadedRef.current === lastCandleTime &&
            lastLoadedIntervalRef.current === currentInterval) {
            return;
        }

        try {
            console.log(`[Chart] 📥 Loading History (${candleHistory.length} candles, interval: ${currentInterval})...`);
            lastUpdateTimeRef.current = 0;
            const candleData = candleHistory.map((c) => ({
                time: c.time as Time,
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close,
            }));

            candleSeriesRef.current.setData(candleData);

            // Viewport Logic
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

            historyLoadedRef.current = lastCandleTime as number;
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
            if ((update.time as number) < lastUpdateTimeRef.current) return;
            candleSeriesRef.current.update(update);
            lastUpdateTimeRef.current = update.time as number;
            pendingUpdateRef.current = null;
            simTelemetry.recordCandleUpdate();
        };

        const unsubscribe = useSimulationStore.subscribe((state) => {
            const currentCandle = state.currentCandle;
            if (!currentCandle) return;
            const time = normalizeTimestamp(currentCandle.time);
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
    useEffect(() => {
        if (!mainChartRef.current || !candleSeriesRef.current) return;
        const updateLegend = (param: any) => {
            const data = param.seriesData.get(candleSeriesRef.current!);
            if (data) {
                setLegendData({ ...data, change: data.close - data.open });
            }
        };
        mainChartRef.current.subscribeCrosshairMove(updateLegend);
        return () => mainChartRef.current?.unsubscribeCrosshairMove(updateLegend);
    }, []);

    // Selectors
    const ticker = useSimulationStore((state) => state.currentTicker || 'BTCUSD');
    const interval = useSimulationStore((state) => state.baseInterval || '1m');

    return (
        <div ref={chartContainerRef} className={`relative w-full min-h-[500px] z-10 ${className} group`}>
            {/* 🔥 DRAWING OVERLAY */}
            <DrawingOverlay />

            {/* LEGEND OVERLAY */}
            <div className="absolute top-4 left-4 z-20 font-sans pointer-events-none select-none flex flex-col gap-1">
                <div className="flex items-baseline gap-2">
                    <span className="text-lg font-bold text-[var(--text-primary)] tracking-wide">{ticker}</span>
                    <span className="text-xs font-semibold text-[var(--text-tertiary)] bg-[var(--bg-tertiary)] px-1 rounded">{interval}</span>
                    <span className="text-xs text-[var(--text-tertiary)] ml-2">M8 Market Simulation</span>
                </div>

                {legendData && (
                    <div className="flex items-center gap-4 text-xs font-mono tracking-tighter opacity-90 transition-opacity">
                        <span className={legendData.change >= 0 ? "text-[var(--color-up)]" : "text-[var(--color-down)]"}>
                            {legendData.close?.toFixed(2)}
                            <span className="ml-1">
                                ({legendData.change >= 0 ? '+' : ''}{legendData.change?.toFixed(2)})
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
