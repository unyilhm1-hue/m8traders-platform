'use client';

import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { createChart, ColorType, CrosshairMode, IChartApi, ISeriesApi, MouseEventParams, Time } from 'lightweight-charts';

export interface ChartPaneProps {
    id: string;
    height: number; // Percent or pixel? Let's use flex-grow or fixed height logic in parent
    data?: any[];
    onCrosshairMove?: (param: MouseEventParams, sourceId: string) => void;
    onVisibleTimeRangeChange?: (range: { from: number; to: number } | null, sourceId: string) => void;
    onChartReady?: (chart: IChartApi) => void; // 🔥 Initialization callback
    children?: (chart: IChartApi) => void; // For adding series
    overlay?: React.ReactNode;
    className?: string;
}

export interface ChartPaneHandle {
    api: () => IChartApi | null;
    container: () => HTMLDivElement | null;
    setVisibleRange: (range: { from: number; to: number }) => void;
    setCrosshair: (t: number | null, p: number | null) => void; // Sync crosshair
}

export const ChartPane = forwardRef<ChartPaneHandle, ChartPaneProps>(({
    id,
    onCrosshairMove,
    onVisibleTimeRangeChange,
    onChartReady,
    overlay,
    className = ''
}, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);

    useImperativeHandle(ref, () => ({
        api: () => chartRef.current,
        container: () => containerRef.current,
        setVisibleRange: (range) => {
            if (chartRef.current) {
                chartRef.current.timeScale().setVisibleLogicalRange(range as any);
            }
        },
        setCrosshair: (x, y) => {
            // Emulating crosshair sync is tricky in LWC without data points
            // Usually we just sync Time Range. Crosshair sync is "nice to have" but complex.
            // We will focus on Time Range sync first.
        }
    }));

    useEffect(() => {
        if (!containerRef.current) return;

        const chart = createChart(containerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: '#131722' },
                textColor: '#d1d5db',
            },
            grid: {
                vertLines: { color: '#1E222D' },
                horzLines: { color: '#1E222D' },
            },
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
                borderColor: '#2B2B43',
                rightOffset: 5,
                // ✅ CRITICAL FIX: Force UTC timestamp mode (prevent BusinessDay object conversion)
                // Without this, LWC converts numeric timestamps to BusinessDay {year, month, day}
                // causing "[object Object]" errors during interval switching
                tickMarkFormatter: (time: Time) => {
                    // Force treating time as UTCTimestamp (number) instead of BusinessDay
                    const date = new Date((time as number) * 1000);
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const hours = String(date.getHours()).padStart(2, '0');
                    const minutes = String(date.getMinutes()).padStart(2, '0');
                    return `${month}/${day} ${hours}:${minutes}`;
                },
            },
            rightPriceScale: {
                borderColor: '#2B2B43',
            },
            crosshair: {
                mode: CrosshairMode.Normal,
            }
        });

        if (onChartReady) {
            onChartReady(chart);
        }

        chartRef.current = chart;

        // Resize observer
        const ro = new ResizeObserver(entries => {
            if (entries[0]) {
                const { width, height } = entries[0].contentRect;
                chart.applyOptions({ width, height });
            }
        });
        ro.observe(containerRef.current);

        // Sync Hooks
        const timeScale = chart.timeScale();
        const handleTimeChange = () => {
            const range = timeScale.getVisibleLogicalRange();
            if (range && onVisibleTimeRangeChange) {
                onVisibleTimeRangeChange(range, id);
            }
        };
        timeScale.subscribeVisibleLogicalRangeChange(handleTimeChange);

        const handleCrosshair = (param: MouseEventParams) => {
            if (onCrosshairMove) onCrosshairMove(param, id);
        };
        chart.subscribeCrosshairMove(handleCrosshair);

        return () => {
            timeScale.unsubscribeVisibleLogicalRangeChange(handleTimeChange);
            chart.unsubscribeCrosshairMove(handleCrosshair);
            ro.disconnect();
            chart.remove();
            chartRef.current = null;
        };
    }, []);

    return (
        <div ref={containerRef} className={`w-full h-full relative ${className}`}>
            {overlay}
        </div>
    );
});

ChartPane.displayName = 'ChartPane';
