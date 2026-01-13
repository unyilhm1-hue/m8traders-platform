/**
 * CompactToolbar Component
 * Professional single-row toolbar for all chart controls
 */
'use client';

import { useChartStore } from '@/stores';
import { AverageCalculator } from './AverageCalculator';

export function CompactToolbar() {
    const {
        symbol,
        timeframe,
        indicators,
        replayMode,
        isPlaying,
        playbackSpeed,
        setSymbol,
        setTimeframe,
        toggleIndicator,
        setReplayMode,
        togglePlayback,
        setPlaybackSpeed,
    } = useChartStore();

    const speedOptions = [1, 2, 5, 10];

    return (
        <div className="h-[50px] bg-[var(--bg-secondary)] border-b border-[var(--bg-tertiary)] px-4 flex items-center gap-4">
            {/* Symbol Selector */}
            <select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="px-3 py-1.5 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded border-none text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
            >
                <option value="AAPL">AAPL</option>
                <option value="BBRI.JK">BBRI</option>
                <option value="BBCA.JK">BBCA</option>
                <option value="TLKM.JK">TLKM</option>
            </select>

            {/* Timeframe Selector */}
            <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value as any)}
                className="px-3 py-1.5 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded border-none text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
            >
                <option value="1m">1m</option>
                <option value="5m">5m</option>
                <option value="15m">15m</option>
                <option value="1h">1h</option>
                <option value="1d">1D</option>
            </select>

            {/* Indicators Dropdown */}
            <div className="relative group">
                <button className="px-3 py-1.5 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded text-sm hover:bg-[var(--bg-tertiary)]/80 flex items-center gap-1">
                    Indicators ▼
                </button>
                <div className="hidden group-hover:block absolute top-full left-0 mt-1 bg-[var(--bg-secondary)] border border-[var(--bg-tertiary)] rounded shadow-lg py-1 min-w-[140px] z-50">
                    {indicators.map((indicator) => (
                        <label
                            key={`${indicator.type}-${indicator.period || 'default'}`}
                            className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg-tertiary)] cursor-pointer text-sm"
                        >
                            <input
                                type="checkbox"
                                checked={indicator.enabled}
                                onChange={() => toggleIndicator(indicator.type)}
                                className="w-4 h-4"
                            />
                            <span className="text-[var(--text-primary)] uppercase">
                                {indicator.type}
                                {indicator.period ? ` (${indicator.period})` : ''}
                            </span>
                        </label>
                    ))}
                </div>
            </div>

            {/* Separator */}
            <div className="w-px h-6 bg-[var(--bg-tertiary)]" />

            {/* Mode Selector */}
            <div className="flex items-center gap-1 bg-[var(--bg-tertiary)] rounded p-1">
                {['live', 'h7', 'h30'].map((mode) => (
                    <button
                        key={mode}
                        onClick={() => setReplayMode(mode as any)}
                        className={`px-2 py-1 text-xs rounded transition-colors ${replayMode === mode
                            ? 'bg-[var(--accent-primary)] text-white'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                            }`}
                    >
                        {mode === 'live' ? 'Live' : mode === 'h7' ? '7D' : '30D'}
                    </button>
                ))}
            </div>

            {/* Playback Controls */}
            {replayMode !== 'live' && (
                <>
                    <button
                        onClick={togglePlayback}
                        className="px-3 py-1.5 bg-[var(--accent-primary)] text-white rounded text-sm hover:opacity-90 flex items-center gap-1"
                    >
                        {isPlaying ? '⏸' : '▶'}
                    </button>

                    {/* Speed Selector */}
                    <select
                        value={playbackSpeed}
                        onChange={(e) => setPlaybackSpeed(Number(e.target.value) as any)}
                        className="px-2 py-1.5 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded border-none text-sm focus:outline-none"
                    >
                        {speedOptions.map((speed) => (
                            <option key={speed} value={speed}>
                                {speed}x
                            </option>
                        ))}
                    </select>
                </>
            )}

            {/* Flexible Spacer */}
            <div className="flex-1" />

            {/* Average Calculator */}
            <AverageCalculator />

            {/* Current Price (compact) */}
            <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-tertiary)]">Price:</span>
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                    $144.25
                </span>
            </div>
        </div>
    );
}
