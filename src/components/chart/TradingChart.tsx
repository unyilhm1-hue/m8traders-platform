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
import { useSimulationStore } from '@/stores/useSimulationStore';

interface TradingChartProps {
    className?: string;
}

// 1. Bungkus memo agar tidak re-render oleh Parent
export const TradingChart = memo(function TradingChart({ className = '' }: TradingChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const mainChartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

    // 2. Ref untuk mencegah reload history yang tidak perlu
    const historyLoadedRef = useRef<number>(0);

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

            const candleData: CandlestickData[] = candleHistory.map((c) => ({
                time: c.time as Time,
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close,
            }));

            // Bersihkan & Set Data Baru
            candleSeriesRef.current.setData(candleData);

            // Zoom Fit hanya saat load awal
            mainChartRef.current.timeScale().fitContent();

            // Tandai sudah dimuat
            historyLoadedRef.current = lastCandleTime as number;

        } catch (error) {
            console.error('[Chart] History Load Error:', error);
        }
    }, [candleHistory]);

    // --- C. REALTIME UPDATE (Direct Subscription) ---
    useEffect(() => {
        // Subscribe langsung ke perubahan currentCandle di Store
        // Ini bypass siklus render React sepenuhnya (Super Cepat)
        const unsubscribe = useSimulationStore.subscribe(
            (state) => {
                const currentCandle = state.currentCandle;
                if (!currentCandle || !candleSeriesRef.current) return;

                // 1. Sanitasi Waktu
                let time = currentCandle.time;

                // Pastikan format detik (bukan ms)
                if (typeof time === 'number' && time > 10000000000) {
                    time = Math.floor(time / 1000);
                } else if (typeof time === 'string') {
                    time = new Date(time).getTime() / 1000;
                }

                // 2. Update Chart (Ringan)
                candleSeriesRef.current.update({
                    time: time as Time,
                    open: currentCandle.open,
                    high: currentCandle.high,
                    low: currentCandle.low,
                    close: currentCandle.close,
                });
            }
        );

        return () => unsubscribe();
    }, []);

    return (
        <div ref={chartContainerRef} className={`relative w-full h-[400px] ${className}`} />
    );
});
