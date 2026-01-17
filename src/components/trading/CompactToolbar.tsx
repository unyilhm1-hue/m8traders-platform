/**
 * CompactToolbar Component
 * Professional single-row toolbar for all chart controls
 */
'use client';

import { SimulationControls } from '@/components/simulation/SimulationControls';
import { TickerSelector } from '@/components/simulation/TickerSelector';  // 🔥 NEW
import { AverageCalculator } from './AverageCalculator';
import { ScenarioSelector } from '@/components/replay/ScenarioSelector';
import { Select } from '@/components/ui/Select';
import { UI_ICONS } from '@/lib/chart/icons';
import { Portal } from '@/components/ui/Portal';
import { useRef, useState, useEffect } from 'react';
import { useChartStore } from '@/stores';
import { IntervalButtons } from './IntervalButtons';  // 🔥 MASTER BLUEPRINT


export function CompactToolbar() {
    // Chart state (for ticker, timeframe, indicators only)
    const { ticker, timeframe, indicators, setTicker, setTimeframe, toggleIndicator } = useChartStore();

    const indicatorRef = useRef<HTMLDivElement>(null);
    const [isIndicatorOpen, setIsIndicatorOpen] = useState(false);
    const [indicatorPos, setIndicatorPos] = useState({ top: 0, left: 0 });

    useEffect(() => {
        if (isIndicatorOpen && indicatorRef.current) {
            const rect = indicatorRef.current.getBoundingClientRect();
            setIndicatorPos({
                top: rect.bottom + window.scrollY + 4,
                left: rect.left + window.scrollX
            });
        }
    }, [isIndicatorOpen]);

    useEffect(() => {
        if (!isIndicatorOpen) return;
        const handleScroll = () => setIsIndicatorOpen(false);
        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', handleScroll);
        return () => {
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', handleScroll);
        };
    }, [isIndicatorOpen]);

    useEffect(() => {
        if (!isIndicatorOpen) return;
        function handleClickOutside(event: MouseEvent) {
            const dropdown = document.getElementById('indicators-dropdown');
            if (indicatorRef.current && !indicatorRef.current.contains(event.target as Node) && dropdown && !dropdown.contains(event.target as Node)) {
                setIsIndicatorOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isIndicatorOpen]);

    const speedOptions = [
        { label: '1x', value: '1' },
        { label: '2x', value: '2' },
        { label: '5x', value: '5' },
        { label: '10x', value: '10' },
        { label: '25x (MPS)', value: '25' },
        { label: '50x (MPS)', value: '50' },
    ];

    const timeframeOptions = [
        { label: '1m', value: '1m' },
        { label: '5m', value: '5m' },
        { label: '15m', value: '15m' },
        { label: '1H', value: '1h' },
        { label: '1D', value: '1d' },
    ];

    const tickerOptions = [
        { label: 'AAPL', value: 'AAPL' },
        { label: 'BBRI.JK', value: 'BBRI.JK' },
        { label: 'BBCA.JK', value: 'BBCA.JK' },
        { label: 'TLKM.JK', value: 'TLKM.JK' },
    ];

    // Icon components
    const { Play, Pause, Dropdown, Check, Layers } = UI_ICONS;

    return (
        <div className="glassmorphism border-b border-[var(--bg-subtle-border)] px-4 z-40 relative">
            {/* Single Row: All Controls */}
            <div className="h-[56px] flex items-center gap-2 overflow-x-auto no-scrollbar">
                {/* 🔥 NEW: Dynamic Ticker Selector (replaces hardcoded Select) */}
                <TickerSelector
                    selectedTicker={ticker}
                    onTickerChange={setTicker}
                />

                <div className="w-px h-5 bg-[var(--bg-tertiary)] mx-2" />

                {/* 🔥 MASTER BLUEPRINT: Dynamic Interval Buttons */}
                <IntervalButtons />

                {/* Indicators Dropdown */}
                <div className="relative" ref={indicatorRef}>
                    <button
                        onClick={() => setIsIndicatorOpen(!isIndicatorOpen)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${isIndicatorOpen
                            ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                            }`}
                    >
                        <Layers size={14} />
                        <span>Indicators</span>
                        <Dropdown size={10} className={`transform transition-transform ${isIndicatorOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isIndicatorOpen && (
                        <Portal>
                            <div
                                id="indicators-dropdown"
                                className="fixed z-50 w-56 bg-[var(--bg-secondary)] border border-[var(--bg-subtle-border)] rounded-lg shadow-xl py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
                                style={{ top: indicatorPos.top, left: indicatorPos.left }}
                            >
                                <div className="px-3 py-2 border-b border-[var(--bg-subtle-border)] bg-[var(--bg-tertiary)]/30">
                                    <h3 className="text-xs font-bold text-[var(--text-primary)]">Favorites</h3>
                                </div>
                                <div className="max-h-64 overflow-y-auto p-1">
                                    {indicators.slice(0, 10).map((ind) => (
                                        <button
                                            key={ind.id}
                                            onClick={() => toggleIndicator(ind.id)}
                                            className={`
                                                w-full text-left px-2 py-1.5 rounded text-xs flex items-center justify-between group
                                                ${ind.enabled ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'}
                                            `}
                                        >
                                            <span>{ind.id.toUpperCase()}</span>
                                            {ind.enabled && <Check size={12} />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </Portal>
                    )}
                </div>

                {/* Average Calculator */}
                <AverageCalculator />

                {/* Simulation Controls */}
                <SimulationControls />

                {/* Scenario Selector */}
                <ScenarioSelector />

                {/* Flexible Spacer */}
                <div className="flex-1" />
            </div>
        </div>
    );
}
