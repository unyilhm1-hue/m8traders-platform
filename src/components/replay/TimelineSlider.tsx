/**
 * TimelineSlider Component
 * Interactive timeline slider for precise replay navigation
 */
'use client';

import { useChartStore } from '@/stores';
import { useCallback } from 'react';

export function TimelineSlider() {
    const { replayMode, replayData, replayIndex, setReplayIndex, isPlaying, setPlaying } = useChartStore();

    const isReplayActive = replayMode !== 'live';
    const total = replayData.length;
    const progress = total > 0 ? (replayIndex / (total - 1)) * 100 : 0;

    const handleSliderChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const newIndex = parseInt(e.target.value, 10);
            setReplayIndex(newIndex);
        },
        [setReplayIndex]
    );

    const handleSliderMouseDown = useCallback(() => {
        // Pause playback when user starts dragging
        if (isPlaying) {
            setPlaying(false);
        }
    }, [isPlaying, setPlaying]);

    const formatTimestamp = (timestamp: number): string => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        });
    };

    const currentCandle = replayData[replayIndex];
    const currentTime = currentCandle ? formatTimestamp(currentCandle.t) : '--:--:--';

    if (!isReplayActive || total === 0) {
        return null;
    }

    return (
        <div className="flex-1 flex flex-col gap-1">
            {/* Timestamp Display */}
            <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-secondary)]">
                    {replayData[0] && formatTimestamp(replayData[0].t)}
                </span>
                <span className="text-[var(--text-primary)] font-mono font-semibold">{currentTime}</span>
                <span className="text-[var(--text-secondary)]">
                    {replayData[total - 1] && formatTimestamp(replayData[total - 1].t)}
                </span>
            </div>

            {/* Slider */}
            <div className="relative flex items-center">
                <input
                    type="range"
                    min={0}
                    max={total - 1}
                    value={replayIndex}
                    onChange={handleSliderChange}
                    onMouseDown={handleSliderMouseDown}
                    onTouchStart={handleSliderMouseDown}
                    className="w-full h-2 bg-[var(--bg-tertiary)] rounded-lg appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-[var(--accent-primary)]
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:transition-all
            [&::-webkit-slider-thumb]:hover:scale-110
            [&::-moz-range-thumb]:w-4
            [&::-moz-range-thumb]:h-4
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-[var(--accent-primary)]
            [&::-moz-range-thumb]:border-0
            [&::-moz-range-thumb]:cursor-pointer
            [&::-moz-range-thumb]:transition-all
            [&::-moz-range-thumb]:hover:scale-110"
                    style={{
                        background: `linear-gradient(to right, var(--accent-primary) 0%, var(--accent-primary) ${progress}%, var(--bg-tertiary) ${progress}%, var(--bg-tertiary) 100%)`,
                    }}
                />
            </div>

            {/* Progress Info */}
            <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)]">
                <span>
                    Candle {replayIndex + 1} / {total}
                </span>
                <span>{progress.toFixed(1)}%</span>
            </div>
        </div>
    );
}
