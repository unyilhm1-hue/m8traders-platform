/**
 * ChartControls Component
 * Ticker, timeframe selector and indicator toggles
 */
'use client';

import { useState, useEffect } from 'react';
import { useChartStore } from '@/stores';
import { Button, Select } from '@/components/ui';
import { TickerSelector } from './TickerSelector';
import { TimeframeSelector } from './TimeframeSelector';

interface ChartControlsProps {
    className?: string;
    showPlayback?: boolean;
}

export function ChartControls({ className = '', showPlayback = true }: ChartControlsProps) {
    // Prevent hydration mismatch by only rendering after mount
    const [mounted, setMounted] = useState(false);

    const {
        indicators,
        isPlaying,
        playbackSpeed,
        loading,
        toggleIndicator,
        setPlaying,
        setPlaybackSpeed,
    } = useChartStore();

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleSpeedChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const speed = parseInt(e.target.value) as import('@/types').PlaybackSpeed;
        setPlaybackSpeed(speed);
    };

    return (
        <div className={`flex items-center gap-4 flex-wrap ${className}`}>
            {/* Ticker Selector */}
            <TickerSelector />

            {/* Divider */}
            <span className="text-xs text-[var(--text-tertiary)]">•</span>

            {/* Timeframe Selector */}
            <TimeframeSelector />

            {/* Loading Indicator */}
            {loading && (
                <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                    <div className="w-3 h-3 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
                    <span>Loading...</span>
                </div>
            )}

            {/* Indicator Toggles */}
            <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-tertiary)]">Indicators:</span>
                <div className="flex items-center gap-1 flex-wrap">
                    {!mounted ? (
                        // Show loading state during hydration
                        <span className="text-xs text-[var(--text-tertiary)]">Loading...</span>
                    ) : (
                        indicators.map((indicator) => {
                            // Build label dengan period jika ada
                            const label = indicator.period
                                ? `${indicator.type.toUpperCase()}(${indicator.period})`
                                : indicator.type.toUpperCase();

                            return (
                                <button
                                    key={indicator.id}
                                    onClick={() => toggleIndicator(indicator.id)}
                                    title={`${label} - ${indicator.enabled ? 'Click to disable' : 'Click to enable'}`}
                                    className={`
                  px-2 py-1 text-xs font-medium rounded transition-colors
                  ${indicator.enabled
                                            ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] border border-[var(--accent-primary)]'
                                            : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] border border-transparent hover:text-[var(--text-secondary)]'
                                        }
                `}
                                >
                                    {label}
                                </button>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Playback Controls */}
            {showPlayback && (
                <div className="flex items-center gap-2 ml-auto">
                    <Button
                        variant={isPlaying ? 'loss' : 'profit'}
                        size="sm"
                        onClick={() => setPlaying(!isPlaying)}
                    >
                        {isPlaying ? '⏸ Pause' : '▶ Play'}
                    </Button>
                    <Select
                        size="sm"
                        value={playbackSpeed.toString()}
                        onChange={handleSpeedChange}
                        options={[
                            { value: '0.5', label: '0.5x' },
                            { value: '1', label: '1x' },
                            { value: '2', label: '2x' },
                            { value: '5', label: '5x' },
                            { value: '10', label: '10x' },
                        ]}
                    />
                </div>
            )}
        </div>
    );
}
