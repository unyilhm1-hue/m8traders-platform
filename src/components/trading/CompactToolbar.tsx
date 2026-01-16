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

    const indicatorRef = useRef<HTMLButtonElement>(null);
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

                {/* Indicators Dropdown (Portal implementation) */}
                <div className="relative">
                    <button
                        ref={indicatorRef}
                        onClick={() => setIsIndicatorOpen(!isIndicatorOpen)}
                        className={`flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] text-sm rounded transition-colors border ${isIndicatorOpen ? 'border-[var(--accent-primary)]' : 'border-transparent hover:border-[var(--bg-subtle-border)]'}`}
                    >
                        <Layers size={14} className="text-[var(--text-secondary)]" />
                        <span>Indicators</span>
                        <Dropdown size={14} className="text-[var(--text-tertiary)]" />
                    </button>

                    {isIndicatorOpen && (
                        <Portal>
                            <div
                                id="indicators-dropdown"
                                className="fixed z-[9999] bg-[var(--bg-secondary)] border border-[var(--bg-subtle-border)] rounded-lg shadow-xl py-2 min-w-[200px] max-h-[60vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-100"
                                style={{
                                    top: indicatorPos.top - window.scrollY,
                                    left: indicatorPos.left - window.scrollX
                                }}
                            >
                                {indicators.map((indicator) => (
                                    <label
                                        key={indicator.id}
                                        className="flex items-center gap-3 px-4 py-2 hover:bg-[var(--bg-tertiary)] cursor-pointer text-sm transition-colors"
                                    >
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${indicator.enabled ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)]' : 'border-[var(--text-secondary)]'}`}>
                                            {indicator.enabled && <Check size={10} className="text-white" />}
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={indicator.enabled}
                                            onChange={() => toggleIndicator(indicator.id)}
                                            className="hidden"
                                        />
                                        <span className={indicator.enabled ? 'text-[var(--text-primary)] font-medium' : 'text-[var(--text-secondary)]'}>
                                            {indicator.type}
                                            {indicator.period ? ` (${indicator.period})` : ''}
                                        </span>
                                    </label>
                                ))}
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
