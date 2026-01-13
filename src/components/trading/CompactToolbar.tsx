/**
 * CompactToolbar Component
 * Professional single-row toolbar for all chart controls
 */
'use client';

import { useChartStore } from '@/stores';
import { AverageCalculator } from './AverageCalculator';
import { JumpToControls, TimelineSlider, MarketTimeSelector } from '@/components/replay';
import { Select } from '@/components/ui/Select';
import { UI_ICONS } from '@/lib/chart/icons';

export function CompactToolbar() {
    const {
        ticker,
        timeframe,
        indicators,
        replayMode,
        isPlaying,
        playbackSpeed,
        setTicker,
        setTimeframe,
        toggleIndicator,
        setReplayMode,
        setPlaying,
        setPlaybackSpeed,
    } = useChartStore();

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
            <div className="h-[56px] flex items-center gap-3 flex-wrap">
                {/* Symbol Selector */}
                <Select
                    value={ticker}
                    onChange={setTicker}
                    options={tickerOptions}
                    className="w-[120px]"
                    triggerClassName="font-bold text-[var(--text-primary)]"
                />

                <div className="w-px h-5 bg-[var(--bg-tertiary)] mx-1" />

                {/* Timeframe Selector */}
                <Select
                    value={timeframe}
                    onChange={(val) => setTimeframe(val as any)}
                    options={timeframeOptions}
                    className="w-[90px]"
                />

                {/* Indicators Dropdown (Custom implementation for multi-select) */}
                <div className="relative group">
                    <button className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] text-sm rounded transition-colors border border-transparent hover:border-[var(--bg-subtle-border)]">
                        <Layers size={14} className="text-[var(--text-secondary)]" />
                        <span>Indicators</span>
                        <Dropdown size={14} className="text-[var(--text-tertiary)]" />
                    </button>
                    <div className="hidden group-hover:block absolute top-full left-0 mt-1 bg-[var(--bg-secondary)] border border-[var(--bg-subtle-border)] rounded-lg shadow-xl py-2 min-w-[160px] z-50 animate-in fade-in zoom-in-95 duration-100">
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
                </div>

                {/* Average Calculator */}
                <AverageCalculator />

                {/* Separator */}
                <div className="w-px h-6 bg-[var(--bg-tertiary)]" />

                {/* Mode Selector */}
                <div className="flex items-center gap-1 bg-[var(--bg-tertiary)] rounded-lg p-1 border border-[var(--bg-subtle-border)]">
                    {['live', 'h7', 'h30'].map((mode) => (
                        <button
                            key={mode}
                            onClick={() => setReplayMode(mode as any)}
                            className={`px-3 py-1 text-xs rounded-md transition-all font-medium ${replayMode === mode
                                ? 'bg-[var(--bg-secondary)] text-[var(--accent-primary)] shadow-sm'
                                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]/50'
                                }`}
                        >
                            {mode === 'live' ? 'LIVE' : mode === 'h7' ? '7D' : '30D'}
                        </button>
                    ))}
                </div>

                {/* Enhanced Replay Controls */}
                {replayMode !== 'live' && (
                    <>
                        {/* Play/Pause Button */}
                        <button
                            onClick={() => setPlaying(!isPlaying)}
                            className={`
                                w-8 h-8 flex items-center justify-center rounded-full transition-all
                                ${isPlaying
                                    ? 'bg-[var(--accent-primary)] text-white glow-primary hover:bg-[var(--accent-primary)]/90'
                                    : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                                }
                            `}
                            title={isPlaying ? 'Pause [Space]' : 'Play [Space]'}
                        >
                            {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                        </button>

                        {/* Speed Selector */}
                        <Select
                            value={String(playbackSpeed)}
                            onChange={(val) => setPlaybackSpeed(Number(val) as any)}
                            options={speedOptions}
                            className="w-[80px]"
                        />

                        {/* Market Time Selector */}
                        <MarketTimeSelector />

                        {/* Separator */}
                        <div className="w-px h-6 bg-[var(--bg-tertiary)]" />

                        {/* Jump To Controls */}
                        <JumpToControls />
                    </>
                )}

                {/* Flexible Spacer */}
                <div className="flex-1" />

                {/* Timeline Slider (Compact) */}
                {replayMode !== 'live' && (
                    <div className="flex items-center gap-4 mr-4 w-[200px] xl:w-[300px]">
                        <TimelineSlider />
                    </div>
                )}
            </div>
        </div>
    );
}
