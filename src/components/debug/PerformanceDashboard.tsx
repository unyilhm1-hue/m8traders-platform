'use client';

import { useEffect, useState, useRef } from 'react';
import { profiler, KPI_TARGETS } from '@/utils/profiler';

export function PerformanceDashboard() {
    const [isVisible, setIsVisible] = useState(false);
    const [stats, setStats] = useState<any>({});
    const [fps, setFps] = useState(0);

    // FPS Calculation
    const frameCountRef = useRef(0);
    const lastTimeRef = useRef(performance.now());
    const rafRef = useRef<number>();

    useEffect(() => {
        const updateFps = () => {
            const now = performance.now();
            frameCountRef.current++;

            if (now - lastTimeRef.current >= 1000) {
                setFps(Math.round((frameCountRef.current * 1000) / (now - lastTimeRef.current)));
                frameCountRef.current = 0;
                lastTimeRef.current = now;
            }

            rafRef.current = requestAnimationFrame(updateFps);
        };

        rafRef.current = requestAnimationFrame(updateFps);

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, []);

    useEffect(() => {
        if (!isVisible) return;

        const interval = setInterval(() => {
            const newStats = {
                indicators: profiler.getStats('indicators_total'),
                setData1k: profiler.getStats('chart_setData'), // We might need to differentiate sizes in naming later if needed
                seek: profiler.getStats('replay_seek'),
                ticks: profiler.getStats('tick_batch_duration') // Need to add this to store instrumentation if not named this way
            };
            setStats(newStats);
        }, 500);

        return () => clearInterval(interval);
    }, [isVisible]);

    // Keyboard shortcut to toggle (Ctrl+Shift+P)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'P') {
                setIsVisible(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    if (!isVisible) return null;

    const renderMetric = (label: string, stat: any, target: number, unit = 'ms') => {
        if (!stat) return <div className="text-xs text-gray-500">{label}: No Data</div>;

        const isOk = stat.last <= target;
        const color = isOk ? 'text-green-400' : 'text-red-400';

        return (
            <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-gray-400">{label}</span>
                <div className="flex gap-2">
                    <span className={color}>{stat.last.toFixed(2)}{unit}</span>
                    <span className="text-gray-600">Target: {target}{unit}</span>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed top-4 right-4 z-50 bg-black/80 backdrop-blur-md border border-gray-700 p-4 rounded-lg shadow-xl w-80 font-mono">
            <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
                <h3 className="text-sm font-bold text-white">Performance KPIs</h3>
                <div className={`text-lg font-bold ${fps >= 50 ? 'text-green-400' : 'text-yellow-400'}`}>
                    {fps} FPS
                </div>
            </div>

            <div className="space-y-4">
                {/* Indicators */}
                <div>
                    <h4 className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Indicators (Total)</h4>
                    {renderMetric('Calc Time', stats.indicators, KPI_TARGETS.INDICATOR.TOTAL_ALL)}
                </div>

                {/* Chart */}
                <div>
                    <h4 className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Chart Updates</h4>
                    {/* Assuming worst case target for display, ideally dynamic based on size */}
                    {renderMetric('setData', stats.setData1k, KPI_TARGETS.CHART.SET_DATA_5K)}
                </div>

                {/* Replay */}
                <div>
                    <h4 className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Replay Latency</h4>
                    {renderMetric('Seek Input', stats.seek, KPI_TARGETS.REPLAY.SEEK_LATENCY)}
                </div>
            </div>

            <div className="mt-4 pt-2 border-t border-gray-700 text-[10px] text-gray-500 text-center">
                Press Ctrl+Shift+P to toggle
            </div>
        </div>
    );
}
