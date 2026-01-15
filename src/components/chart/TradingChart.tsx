/**
 * TradingChart Component - Lightweight Charts Edition
 * Complete refactor using TradingView Lightweight Charts
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import {
    createChart,
    ColorType,
    CrosshairMode,
    LineStyle,
    type IChartApi,
    type ISeriesApi,
    type CandlestickData,
    type Time,
} from 'lightweight-charts';
import { useCandleHistory, useCurrentCandle, type ChartCandle } from '@/stores/useSimulationStore';

interface TradingChartProps {
    onPriceChange?: (price: number) => void;
    className?: string;
}

interface OHLCData {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export function TradingChart({ onPriceChange, className = '' }: TradingChartProps) {
    // Refs
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const mainChartRef = useRef<IChartApi | null>(null);
    const volumeChartRef = useRef<IChartApi | null>(null);
    const rsiChartRef = useRef<IChartApi | null>(null);

    const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
    const vwapSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

    // Legend state
    const [legendData, setLegendData] = useState<OHLCData>({
        open: 0,
        high: 0,
        low: 0,
        close: 0,
        volume: 0
    });

    // Mobile detection
    const isTouchDevice = typeof window !== 'undefined' && 'ontouchstart' in window;

    // Subscribe to store (NO React re-renders on updates)
    const candleHistory = useCandleHistory();
    const currentCandle = useCurrentCandle();

    // Ref for throttling debug logs
    const lastLogTimeRef = useRef<number>(0);

    // Initialize charts
    useEffect(() => {
        if (!chartContainerRef.current) return;

        const container = chartContainerRef.current;

        // Theme colors (matching TradingView dark)
        const chartOptions = {
            layout: {
                background: { type: ColorType.Solid, color: '#0a0a0f' },
                textColor: '#d1d4dc',
            },
            grid: {
                vertLines: { color: 'rgba(42, 46, 57, 0.5)' },
                horzLines: { color: 'rgba(42, 46, 57, 0.5)' },
            },
            crosshair: {
                mode: CrosshairMode.Normal,
                vertLine: {
                    color: '#758696',
                    width: 1,
                    style: LineStyle.Dashed,
                },
                horzLine: {
                    color: '#758696',
                    width: 1,
                    style: LineStyle.Dashed,
                },
            },
            timeScale: {
                borderColor: '#2b2b43',
                timeVisible: true,
                secondsVisible: false,
            },
            rightPriceScale: {
                borderColor: '#2b2b43',
            },
        };

        // Main chart (candlesticks + VWAP overlay)
        const mainDiv = container.querySelector('#main-chart') as HTMLDivElement;
        if (mainDiv) {
            const mainChart = createChart(mainDiv, {
                ...chartOptions,
                height: 400,
            } as any); // Type compatibility with lightweight-charts
            mainChartRef.current = mainChart;

            // Candlestick series
            const candleSeries = mainChart.addCandlestickSeries({
                upColor: '#26a69a',
                downColor: '#ef5350',
                borderVisible: false,
                wickUpColor: '#26a69a',
                wickDownColor: '#ef5350',
            });
            candleSeriesRef.current = candleSeries;

            // VWAP overlay (default enabled)
            const vwapSeries = mainChart.addLineSeries({
                color: '#2962FF',
                lineWidth: 2,
                title: 'VWAP',
            });
            vwapSeriesRef.current = vwapSeries;

            // Crosshair move event for OHLC legend
            mainChart.subscribeCrosshairMove((param) => {
                if (!param.time || !param.seriesData.get(candleSeries)) {
                    return;
                }

                const data = param.seriesData.get(candleSeries) as CandlestickData;
                setLegendData({
                    open: data.open,
                    high: data.high,
                    low: data.low,
                    close: data.close,
                    volume: 0 // Volume from volume pane if needed
                });
            });
        }

        // Volume chart (separate pane, default enabled)
        const volumeDiv = container.querySelector('#volume-chart') as HTMLDivElement;
        if (volumeDiv) {
            const volumeChart = createChart(volumeDiv, {
                ...chartOptions,
                height: 100,
            } as any); // Type compatibility
            volumeChartRef.current = volumeChart;

            const volumeSeries = volumeChart.addHistogramSeries({
                color: '#26a69a',
                priceFormat: {
                    type: 'volume',
                },
            });
            volumeSeriesRef.current = volumeSeries;
        }

        // RSI chart (separate pane, default enabled)
        const rsiDiv = container.querySelector('#rsi-chart') as HTMLDivElement;
        if (rsiDiv) {
            const rsiChart = createChart(rsiDiv, {
                ...chartOptions,
                height: 150,
            } as any); // Type compatibility
            rsiChartRef.current = rsiChart;

            const rsiSeries = rsiChart.addLineSeries({
                color: '#AB47BC',
                lineWidth: 2,
                title: 'RSI(14)',
            });
            rsiSeriesRef.current = rsiSeries;

            // Add overbought/oversold lines (70/30)
            const upperBand = rsiChart.addLineSeries({
                color: 'rgba(239, 83, 80, 0.5)',
                lineWidth: 1,
                lineStyle: LineStyle.Dashed,
                priceLineVisible: false,
                lastValueVisible: false,
            });

            const lowerBand = rsiChart.addLineSeries({
                color: 'rgba(38, 166, 154, 0.5)',
                lineWidth: 1,
                lineStyle: LineStyle.Dashed,
                priceLineVisible: false,
                lastValueVisible: false,
            });

            // Set RSI scale (0-100)
            rsiChart.priceScale('right').applyOptions({
                scaleMargins: {
                    top: 0.1,
                    bottom: 0.1,
                },
            });
        }

        // Cleanup
        return () => {
            if (mainChartRef.current) mainChartRef.current.remove();
            if (volumeChartRef.current) volumeChartRef.current.remove();
            if (rsiChartRef.current) rsiChartRef.current.remove();
        };
    }, []);

    // ResizeObserver for responsive charts
    useEffect(() => {
        if (!chartContainerRef.current) return;

        const handleResize = () => {
            const container = chartContainerRef.current;
            if (!container) return;

            const width = container.clientWidth;

            if (mainChartRef.current) {
                mainChartRef.current.applyOptions({ width });
            }
            if (volumeChartRef.current) {
                volumeChartRef.current.applyOptions({ width });
            }
            if (rsiChartRef.current) {
                rsiChartRef.current.applyOptions({ width });
            }
        };

        const resizeObserver = new ResizeObserver(handleResize);
        resizeObserver.observe(chartContainerRef.current);

        return () => resizeObserver.disconnect();
    }, []);

    // Load historical data from store (IMPERATIVE - no React re-render)
    useEffect(() => {
        if (!candleHistory || !candleSeriesRef.current) return;

        // --- STEP 1: FLUSH DATA LAMA (PENTING!) ---
        // Ini akan menghapus error "last time=[object Object]" yang nyangkut
        if (candleHistory.length === 0) {
            candleSeriesRef.current.setData([]);
            return;
        }

        // --- STEP 2: SANITASI (Defensive timestamp cleaning) ---
        const sanitizeTimestamp = (time: any): number => {
            if (typeof time === 'number') return time > 10000000000 ? Math.floor(time / 1000) : time;
            if (time instanceof Date) return Math.floor(time.getTime() / 1000);
            if (typeof time === 'object' && time !== null && 'time' in time) return sanitizeTimestamp(time.time);
            if (typeof time === 'string') {
                const parsed = new Date(time).getTime() / 1000;
                return isNaN(parsed) ? Math.floor(Date.now() / 1000) : Math.floor(parsed);
            }
            return Math.floor(Date.now() / 1000);
        };

        const candleData: CandlestickData[] = candleHistory.map((c: ChartCandle) => ({
            time: sanitizeTimestamp(c.time) as Time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
        }));

        candleData.sort((a, b) => (a.time as number) - (b.time as number));

        try {
            // Reset dulu baru isi (Double Safety)
            candleSeriesRef.current.setData([]);
            candleSeriesRef.current.setData(candleData);

            console.log(`[TradingChart] ✅ History loaded cleanly: ${candleData.length} candles`);
            if (candleData.length > 0) {
                console.log(`[TradingChart]   First: ${candleData[0].time}, Last: ${candleData[candleData.length - 1].time}`);
            }
        } catch (error) {
            console.error('[TradingChart] ❌ Failed to set history:', error);
            console.error('[TradingChart] Sample data:', candleData.slice(0, 3));
        }

        // TODO: Calculate and set Volume, VWAP, RSI from worker messages
    }, [candleHistory]);

    // Update current live candle (IMPERATIVE - 60 FPS performance)
    useEffect(() => {
        if (!currentCandle) return;
        if (!candleSeriesRef.current) return;

        // CRITICAL: Sanitize timestamp to ensure it's a clean number (Unix seconds)
        // Lightweight Charts is VERY strict about timestamp format
        const sanitizeTimestamp = (time: any): number => {
            // Case 1: Already a number
            if (typeof time === 'number') {
                // If it's in milliseconds (>10 billion), convert to seconds
                return time > 10000000000 ? Math.floor(time / 1000) : time;
            }

            // Case 2: Date object
            if (time instanceof Date) {
                return Math.floor(time.getTime() / 1000);
            }

            // Case 3: Object with time property (nested structure bug)
            if (typeof time === 'object' && time !== null && 'time' in time) {
                return sanitizeTimestamp(time.time); // Recursive
            }

            // Case 4: String timestamp
            if (typeof time === 'string') {
                const parsed = new Date(time).getTime() / 1000;
                if (!isNaN(parsed)) return Math.floor(parsed);
            }

            // Fallback: Use current time (should never happen in production)
            return Math.floor(Date.now() / 1000);
        };

        const cleanTime = sanitizeTimestamp(currentCandle.time);

        // Log ONCE for debugging (throttled to avoid spam)
        const now = Date.now();
        if (now - lastLogTimeRef.current > 5000) {
            console.log('[TradingChart] currentCandle raw:', currentCandle);
            console.log('[TradingChart] Sanitized time:', cleanTime, 'from:', currentCandle.time);
            lastLogTimeRef.current = now;
        }

        // Update the latest candle in the chart (no setState!)
        const candleData: CandlestickData = {
            time: cleanTime as Time,
            open: currentCandle.open,
            high: currentCandle.high,
            low: currentCandle.low,
            close: currentCandle.close,
        };

        // Imperative update - this is FAST
        try {
            candleSeriesRef.current.update(candleData);
        } catch (error) {
            console.error('[TradingChart] Update error:', error);
            console.error('[TradingChart] Failed candleData:', candleData);
        }

        // Update price callback
        if (onPriceChange) {
            onPriceChange(currentCandle.close);
        }
    }, [currentCandle, onPriceChange]);

    // Sync crosshairs across panes
    useEffect(() => {
        const mainChart = mainChartRef.current;
        const volumeChart = volumeChartRef.current;
        const rsiChart = rsiChartRef.current;

        if (!mainChart || !volumeChart || !rsiChart) return;

        const syncCrosshair = (chart: IChartApi, point: any) => {
            if (point && point.time) {
                chart.timeScale().scrollToPosition(0, false);
            }
        };

        const handleMainCrosshair = (param: any) => {
            syncCrosshair(volumeChart, param);
            syncCrosshair(rsiChart, param);
        };

        mainChart.subscribeCrosshairMove(handleMainCrosshair);

        return () => {
            // Note: Lightweight Charts doesn't have unsubscribe, handled by chart.remove()
        };
    }, []);

    return (
        <div ref={chartContainerRef} className={`trading-chart-container ${className}`}>
            {/* OHLC Legend */}
            <div className="absolute top-2 left-2 z-10 bg-black/50 px-3 py-2 rounded text-xs font-mono text-white">
                <span className="mr-3">O: {legendData.open.toFixed(2)}</span>
                <span className="mr-3">H: <span className="text-green-400">{legendData.high.toFixed(2)}</span></span>
                <span className="mr-3">L: <span className="text-red-400">{legendData.low.toFixed(2)}</span></span>
                <span>C: {legendData.close.toFixed(2)}</span>
            </div>

            {/* Drawing Toolbar (hidden on mobile) */}
            {!isTouchDevice && (
                <div className="absolute top-2 right-2 z-10 bg-black/50 px-3 py-2 rounded text-xs text-white">
                    <span className="opacity-50">Drawing tools coming soon</span>
                </div>
            )}

            {/* Chart Panes (stacked vertically) */}
            <div className="flex flex-col h-full">
                <div id="main-chart" className="flex-1 min-h-[400px]" />
                <div id="volume-chart" className="h-[100px]" />
                <div id="rsi-chart" className="h-[150px]" />
            </div>
        </div>
    );
}
