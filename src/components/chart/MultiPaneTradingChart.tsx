'use client';

import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { useSimulationStore } from '@/stores/useSimulationStore';
import { useChartStore } from '@/stores';
import { UI_ICONS } from '@/lib/chart/icons';
import { PaneManager, PaneDefinition } from './panes/PaneManager';
import { useChartContext } from '@/contexts/ChartContext';
import { CandlestickData, HistogramData, ISeriesApi, UTCTimestamp, ColorType, IChartApi } from 'lightweight-charts';
import { sanitizeDataForChart } from '@/utils/chartSanitizer';
import { calculateIndicator } from '@/lib/chart/indicators';
import { simTelemetry } from '@/lib/telemetry';

import { DrawingOverlay } from './DrawingOverlay';
import { ChartProvider } from '@/contexts/ChartContext';

function MultiPaneTradingChartInner() {
    const { setChart, setMainSeries } = useChartContext();

    // Store & State
    const candleHistory = useSimulationStore((s) => s.candleHistory);
    const currentInterval = useSimulationStore((s) => s.baseInterval);
    const ticker = useSimulationStore((s) => s.currentTicker || 'CHART');
    const activeIndicators = useChartStore((s) => s.indicators);

    // Refs for API Access
    const priceChartRef = useRef<IChartApi | null>(null); // 🔥 Capture Price Chart Instance
    const priceSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
    const indicatorSeriesRef = useRef<Map<string, ISeriesApi<any>>>(new Map()); // Map IndID -> Series
    const overlaySeriesRef = useRef<Map<string, ISeriesApi<any>>>(new Map()); // 🔥 Overlay Series Map

    const isChartReady = useRef(false);
    const pendingUpdateRef = useRef<any>(null);

    const [isAtLiveEdge, setIsAtLiveEdge] = useState(true);
    const isAtLiveEdgeRef = useRef(true);
    const totalCandlesRef = useRef(0);

    // Helper: Scroll to Live
    const scrollToLive = useCallback(() => {
        if (priceChartRef.current) {
            priceChartRef.current.timeScale().scrollToRealTime();
            isAtLiveEdgeRef.current = true;
            setIsAtLiveEdge(true);
        }
    }, []);

    // --- A. Define Panes ---
    const panes: PaneDefinition[] = useMemo(() => {
        const definitions: PaneDefinition[] = [];

        // 1. Price Pane (Master)
        definitions.push({
            id: 'price',
            title: `${ticker} • ${currentInterval}`,
            type: 'price',
            heightWeight: 6,
            overlay: (
                <>
                    <div className="absolute inset-0 z-10 pointer-events-none">
                        <DrawingOverlay />
                    </div>
                    {/* Go to Live Button */}
                    {!isAtLiveEdge && (
                        <div className="absolute bottom-4 right-16 z-50 pointer-events-auto animate-in fade-in slide-in-from-bottom-2">
                            <button
                                onClick={scrollToLive}
                                className="bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--bg-subtle-border)] rounded-full px-3 py-1 text-xs shadow-lg flex items-center gap-1 transition-colors"
                            >
                                <UI_ICONS.Next size={12} />
                                <span>Go to Live</span>
                            </button>
                        </div>
                    )}
                </>
            ),
            render: (chart) => {
                priceChartRef.current = chart; // 🔥 Capture Ref
                // Main Series
                const series = chart.addCandlestickSeries({
                    upColor: '#089981',
                    downColor: '#F23645',
                    borderVisible: false,
                    wickUpColor: '#089981',
                    wickDownColor: '#F23645',
                });
                priceSeriesRef.current = series;
                setChart(chart);
                setMainSeries(series);

                // Initialize Overlays (SMA/EMA) attached to Price Pane
                // We do this dynamically later?
                // Better to have a separate effect that ADDS series to this chart if they exist.
                // For now, simpler: we assume overlays are handled in a separate Effect that checks `setChart` context?
                // No, existing TradingChart manages them internally.
                // We'll manage them via `indicatorSeriesRef`.
            }
        });

        // 2. Volume Pane
        definitions.push({
            id: 'volume',
            title: 'Volume',
            type: 'volume',
            heightWeight: 2,
            render: (chart) => {
                const series = chart.addHistogramSeries({
                    color: '#26a69a',
                    priceFormat: { type: 'volume' },
                });
                volumeSeriesRef.current = series;

                // Initialize Data immediately if available (safe?)
                // Actually safer to strictly do it in Effect B
            }
        });

        // 3. Separate Pane Indicators
        activeIndicators.forEach(ind => {
            if (['rsi', 'macd', 'stoch'].includes(ind.id) && ind.enabled) {
                definitions.push({
                    id: ind.id,
                    title: ind.id.toUpperCase(),
                    type: 'indicator',
                    heightWeight: 2,
                    render: (chart) => {
                        // Create Series based on type
                        if (ind.id === 'rsi') {
                            const s = chart.addLineSeries({ color: ind.color || '#9b59b6', lineWidth: 2 });
                            indicatorSeriesRef.current.set(ind.id, s);
                            // Pre-load data if available
                            if (candleHistory.length > 0) {
                                const clean = sanitizeDataForChart(candleHistory);
                                const valid = clean.filter(c => typeof c.time === 'number' && Number.isFinite(c.time));
                                // Re-calc
                                const hist = valid.map(c => ({ t: c.time as number, o: c.open, h: c.high, l: c.low, c: c.close, v: c.value || 0 }));
                                const computed = calculateIndicator(ind.type, hist, ind.period);
                                if (computed && computed.length) s.setData(computed);
                            }
                            // Add RSI bands? 70/30 lines
                            // LWC doesn't have "bands", we'd add extra line series or use priceLines
                        }
                        // MACD (Basic Histogram for MVP)
                        else if (ind.id === 'macd') {
                            const s = chart.addHistogramSeries({
                                color: ind.color || '#2962FF',
                                priceFormat: { type: 'volume' } // mimic volume-style centering? No, standard
                            });
                            indicatorSeriesRef.current.set(ind.id, s);
                            if (candleHistory.length > 0) {
                                const clean = sanitizeDataForChart(candleHistory);
                                const valid = clean.filter(c => typeof c.time === 'number' && Number.isFinite(c.time));
                                const hist = valid.map(c => ({ t: c.time as number, o: c.open, h: c.high, l: c.low, c: c.close, v: c.value || 0 }));
                                const computed = calculateIndicator(ind.type, hist, ind.period);
                                // MACD calc returns { value, histogram, signal }
                                // Map 'value' in indicator result matches 'MACD Line' usually.
                                // For HistogramSeries, we want 'histogram'.
                                // But `calculateIndicator` maps `value` to `val.MACD`.
                                // We should probably map `histogram` to `value` for LWC HistogramSeries.
                                // Quick hack: Remap data
                                const macdHist = computed.map(d => ({ ...d, value: d.histogram || 0, color: (d.histogram || 0) >= 0 ? '#089981' : '#F23645' }));
                                if (macdHist.length) s.setData(macdHist);
                            }
                        }
                        // TODO: MACD, Stoch
                    }
                });
            }
        });

        return definitions;
    }, [activeIndicators, setChart, setMainSeries, ticker, currentInterval, candleHistory, isAtLiveEdge, scrollToLive]); // Added candleHistory to allow immediate render init


    // --- D. Live Edge Subscription ---
    useEffect(() => {
        let cleanupFn: (() => void) | undefined;

        // Wait for chartRef to be populated
        const checkInterval = setInterval(() => {
            if (priceChartRef.current) {
                clearInterval(checkInterval);
                const ts = priceChartRef.current.timeScale();

                const onRangeChange = () => {
                    const range = ts.getVisibleLogicalRange();
                    if (!range) return;

                    const total = totalCandlesRef.current;
                    const dist = total - range.to;
                    const isLive = dist < 2; // Threshold 2 bars

                    if (isAtLiveEdgeRef.current !== isLive) {
                        isAtLiveEdgeRef.current = isLive;
                        setIsAtLiveEdge(isLive);
                    }
                };

                ts.subscribeVisibleLogicalRangeChange(onRangeChange);
                // Initial check
                onRangeChange();

                cleanupFn = () => {
                    ts.unsubscribeVisibleLogicalRangeChange(onRangeChange);
                };
            }
        }, 100);

        return () => {
            clearInterval(checkInterval);
            if (cleanupFn) {
                cleanupFn();
            }
        };
    }, [currentInterval]); // Re-sub on interval change (chart destroyed)


    // --- B. Load History (Main & Volume) ---
    useEffect(() => {
        if (!candleHistory.length || !priceSeriesRef.current) return;

        isChartReady.current = false;
        console.log('[MultiPane] Loading History...', candleHistory.length);

        const cleanData = sanitizeDataForChart(candleHistory);
        const validData = cleanData.filter(c => typeof c.time === 'number' && Number.isFinite(c.time));
        if (!validData.length) return;

        const priceData = validData.map(c => ({
            time: c.time as UTCTimestamp,
            open: c.open, high: c.high, low: c.low, close: c.close
        }));

        priceSeriesRef.current.setData(priceData);

        if (volumeSeriesRef.current) {
            const volumeData = validData.map(c => ({
                time: c.time as UTCTimestamp,
                value: c.value || 0,
                color: c.close >= c.open ? '#089981' : '#F23645'
            }));
            volumeSeriesRef.current.setData(volumeData);
        }

        // Indicator History (for separate panes) - this is now handled in the useMemo for panes
        // Overlay Indicator History - this is handled in a separate useEffect below

        isChartReady.current = true;
    }, [candleHistory, currentInterval]);


    // --- C. Manage All Indicators (Overlay & Pane) ---
    useEffect(() => {
        if (!candleHistory.length) return;

        const cleanData = sanitizeDataForChart(candleHistory);
        const validData = cleanData.filter(c => typeof c.time === 'number' && Number.isFinite(c.time));
        const histForCalc = validData.map(c => ({ t: c.time as number, o: c.open, h: c.high, l: c.low, c: c.close, v: c.value || 0 }));

        // 1. Add/Update Actions
        activeIndicators.forEach(ind => {
            if (!ind.enabled) return;

            const isOverlay = ['sma', 'ema', 'bollinger'].includes(ind.type);
            let series: ISeriesApi<any> | undefined;

            if (isOverlay) {
                // Handle Overlay (Main Chart)
                if (!priceChartRef.current) return;
                series = overlaySeriesRef.current.get(ind.id);
                if (!series) {
                    // Create Overlay Series
                    const color = ind.color || '#2962FF';
                    // Bollinger special case (Middle band only for now)
                    series = priceChartRef.current.addLineSeries({
                        color: color,
                        lineWidth: 2,
                        priceLineVisible: false,
                        crosshairMarkerVisible: false,
                    });
                    overlaySeriesRef.current.set(ind.id, series);
                }
            } else {
                // Handle Pane (Ref should be populated by render callback)
                series = indicatorSeriesRef.current.get(ind.id);
                // Note: If series is missing for Pane, it might be because Pane isn't mounted yet.
                // The 'render' callback will handle initial load.
                // This loop handles 'Updates' (History growth).
            }

            // Update Data (Common for both)
            if (series) {
                let data = calculateIndicator(ind.type, histForCalc, ind.period);

                // Special handling for MACD Histogram mapping
                if (ind.type === 'macd' && series.seriesType() === 'Histogram') {
                    data = data.map(d => ({ ...d, value: d.histogram || 0, color: (d.histogram || 0) >= 0 ? '#089981' : '#F23645' }));
                }

                if (data && data.length) series.setData(data);
            }
        });

        // 2. Removal Actions (Overlays only)
        overlaySeriesRef.current.forEach((series, id) => {
            const ind = activeIndicators.find(i => i.id === id);
            // Remove if not in list OR disabled
            if (!series) return;

            if (!ind || !ind.enabled) {
                console.log('[MultiPane] Removing Overlay:', id);
                priceChartRef.current?.removeSeries(series);
                overlaySeriesRef.current.delete(id);
            }
        });

    }, [activeIndicators, candleHistory]);


    // --- C. Realtime Updates ---
    useEffect(() => {
        let rafId: number;

        const handleUpdate = () => {
            if (!isChartReady.current || !pendingUpdateRef.current || !priceSeriesRef.current) return;
            const update = pendingUpdateRef.current;

            priceSeriesRef.current.update(update);

            if (volumeSeriesRef.current) {
                volumeSeriesRef.current.update({
                    time: update.time,
                    value: update.value,
                    color: update.close >= update.open ? '#089981' : '#F23645'
                });
            }

            // Auto-scroll logic (TradingView-like)
            if (isAtLiveEdgeRef.current && priceChartRef.current) {
                priceChartRef.current.timeScale().scrollToRealTime();
            }

            pendingUpdateRef.current = null;
            simTelemetry.recordCandleUpdate();
        };

        const unsubscribe = useSimulationStore.subscribe((state) => {
            const c = state.currentCandle;
            if (!c) return;

            // Simple validation
            let t = c.time;

            // ✅ CRITICAL: Reject non-primitive time (prevent [object Object] error)
            if (typeof t !== 'number') {
                console.error('[MultiPane] ❌ REJECTED update: time is not primitive number', {
                    time: t,
                    type: typeof t,
                    candle: c
                });
                return;
            }

            if (t > 1e12) t = Math.floor(t / 1000);

            pendingUpdateRef.current = {
                time: t as UTCTimestamp,
                open: c.open, high: c.high, low: c.low, close: c.close,
                value: (c as any).volume || (c as any).v
            };

            rafId = requestAnimationFrame(handleUpdate);
        });

        return () => {
            unsubscribe();
            cancelAnimationFrame(rafId);
        };
    }, []);

    return (
        <div className="w-full h-full">
            <PaneManager panes={panes} />
        </div>
    );
}

// Wrapper
export default function MultiPaneTradingChart() {
    return (
        <ChartProvider>
            <MultiPaneTradingChartInner />
        </ChartProvider>
    );
}
