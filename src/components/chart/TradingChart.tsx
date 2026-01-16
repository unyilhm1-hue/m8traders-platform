'use client';

import { useEffect, useRef, memo } from 'react';
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

interface TradingChartProps {
    className?: string;
}

// 1. Bungkus memo agar tidak re-render oleh Parent
export const TradingChart = memo(function TradingChart({ className = '' }: TradingChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const mainChartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

    // Ref untuk mencegah reload history yang tidak perlu
    const historyLoadedRef = useRef<number>(0);

    // ✅ Refs for realtime update batching (must be at top-level)
    const lastUpdateTimeRef = useRef<number>(0);
    const pendingUpdateRef = useRef<CandlestickData | null>(null);

    // Ambil history dari store
    const candleHistory = useSimulationStore((state) => state.candleHistory);

    // --- A. INITIALIZE CHART (Run Once) ---
    useEffect(() => {
        if (!chartContainerRef.current) return;

        // Setup Chart
        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: '#000000' },
                textColor: '#d1d5db',
            },
            grid: {
                vertLines: { color: '#1f2937' },
                horzLines: { color: '#1f2937' },
            },
            width: chartContainerRef.current.clientWidth,
            height: 400,
            crosshair: {
                mode: CrosshairMode.Normal,
            },
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
                borderColor: '#374151',
            },
            rightPriceScale: {
                borderColor: '#374151',
            },
        });

        // Setup Series
        const newSeries = chart.addCandlestickSeries({
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderVisible: false,
            wickUpColor: '#26a69a',
            wickDownColor: '#ef5350',
        });

        mainChartRef.current = chart;
        candleSeriesRef.current = newSeries;

        // Resize Observer
        const handleResize = () => {
            if (chartContainerRef.current) {
                chart.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
            mainChartRef.current = null;
            candleSeriesRef.current = null;
        };
    }, []);

    // --- B. LOAD HISTORY (Hanya jika data berubah drastis) ---
    useEffect(() => {
        if (!candleHistory || candleHistory.length === 0) return;
        if (!candleSeriesRef.current || !mainChartRef.current) return;

        // Cek apakah data ini sudah pernah dimuat?
        // Jika timestamp terakhir sama, berarti ini data yang sama (cuma re-render React)
        const lastCandleTime = candleHistory[candleHistory.length - 1].time;
        if (historyLoadedRef.current === lastCandleTime) {
            return; // ⛔ STOP! Jangan load ulang.
        }

        try {
            console.log(`[Chart] 📥 Loading History (${candleHistory.length} candles)...`);

            // ✅ FIX: Reset time guard saat load history baru
            // Prevent rejection of first updates from new simulation
            lastUpdateTimeRef.current = 0;

            const candleData: CandlestickData[] = candleHistory.map((c) => ({
                time: c.time as Time,
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close,
            }));

            // Bersihkan & Set Data Baru
            candleSeriesRef.current.setData(candleData);

            // ✅ FIX: Auto-zoom to show last ~150 candles (not all 3000+!)
            // This ensures simulation candles are visible at readable zoom level
            const barCount = Math.min(150, candleHistory.length);
            mainChartRef.current.timeScale().setVisibleLogicalRange({
                from: candleHistory.length - barCount,
                to: candleHistory.length - 1
            });

            // Tandai sudah dimuat
            historyLoadedRef.current = lastCandleTime as number;
            console.log(`[Chart] ✅ History loaded, showing last ${barCount} candles`);

        } catch (error) {
            console.error('[Chart] History Load Error:', error);
        }
    }, [candleHistory]);

    // --- C. REALTIME UPDATE (rAF Batching for Stability) ---
    useEffect(() => {
        // RAF ID for cleanup
        let rafId: number | null = null;

        // Flush buffer to chart (called by rAF)
        const flushUpdate = () => {
            rafId = null;
            if (!pendingUpdateRef.current || !candleSeriesRef.current) return;

            const update = pendingUpdateRef.current;

            // ✅ TIME REGRESSION CHECK: Prevent backwards time updates
            if ((update.time as number) < lastUpdateTimeRef.current) {
                console.warn('[TradingChart] ⚠️ Time regression detected, skipping update', {
                    lastTime: lastUpdateTimeRef.current,
                    newTime: update.time
                });
                simTelemetry.recordTimeRegression(); // 📊 Track regression
                pendingUpdateRef.current = null;
                return;
            }

            // Apply update to chart
            candleSeriesRef.current.update(update);
            lastUpdateTimeRef.current = update.time as number;
            pendingUpdateRef.current = null;

            // 📊 Telemetry: Track candle update
            simTelemetry.recordCandleUpdate();
        };

        // Subscribe langsung ke perubahan currentCandle di Store
        const unsubscribe = useSimulationStore.subscribe(
            (state) => {
                const currentCandle = state.currentCandle;
                if (!currentCandle) return;

                // 🔥 FIX C: Use centralized time normalization
                const time = normalizeTimestamp(currentCandle.time);

                // 2. Buffer update (akan di-flush di next frame)
                pendingUpdateRef.current = {
                    time: time as Time,
                    open: currentCandle.open,
                    high: currentCandle.high,
                    low: currentCandle.low,
                    close: currentCandle.close,
                };

                // 3. Schedule rAF flush (jika belum scheduled)
                if (rafId === null) {
                    rafId = requestAnimationFrame(flushUpdate);
                }
            }
        );

        return () => {
            unsubscribe();
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
            }
        };
    }, []);

    return (
        <div ref={chartContainerRef} className={`relative w-full h-[400px] ${className}`} />
    );
});
