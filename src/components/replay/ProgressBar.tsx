/**
 * ProgressBar Component
 * Visual replay progress with scrubbing capability
 */
'use client';

import { useChartStore } from '@/stores';
import { useState, useRef, MouseEvent } from 'react';

export function ProgressBar() {
    const { replayMode, replayIndex, replayData, setReplayIndex, replayStartTime, replayEndTime } =
        useChartStore();
    const [isHovering, setIsHovering] = useState(false);
    const [hoverPosition, setHoverPosition] = useState(0);
    const progressBarRef = useRef<HTMLDivElement>(null);

    const isReplayActive = replayMode !== 'live';
    const totalCandles = replayData.length;
    const progress = totalCandles > 1 ? (replayIndex / (totalCandles - 1)) * 100 : 0;

    if (!isReplayActive) {
        return null;
    }

    // Empty state - no data loaded yet
    if (replayData.length === 0) {
        return (
            <div className="px-4 py-2 bg-[var(--bg-secondary)] border-b border-[var(--bg-tertiary)]">
                <div className="flex items-center justify-center gap-2 text-xs text-[var(--text-tertiary)]">
                    <div className="w-3 h-3 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
                    <span>Loading replay data...</span>
                </div>
            </div>
        );
    }

    const handleClick = (e: MouseEvent<HTMLDivElement>) => {
        if (!progressBarRef.current || replayData.length === 0) return;

        const rect = progressBarRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = (clickX / rect.width) * 100;
        const newIndex = Math.floor((percentage / 100) * (replayData.length - 1));

        setReplayIndex(Math.max(0, Math.min(newIndex, replayData.length - 1)));
    };

    const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
        if (!progressBarRef.current) return;

        const rect = progressBarRef.current.getBoundingClientRect();
        const hoverX = e.clientX - rect.left;
        const percentage = (hoverX / rect.width) * 100;
        setHoverPosition(Math.max(0, Math.min(percentage, 100)));
    };

    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getHoverTime = () => {
        if (replayData.length === 0) return '';
        const hoverIndex = Math.floor((hoverPosition / 100) * (replayData.length - 1));
        const candle = replayData[hoverIndex];
        return candle ? formatTime(candle.t) : '';
    };

    const getCurrentTime = () => {
        const candle = replayData[replayIndex];
        return candle ? formatTime(candle.t) : '';
    };

    return (
        <div className="px-4 py-2 bg-[var(--bg-secondary)] border-b border-[var(--bg-tertiary)]">
            {/* Progress Info */}
            <div className="flex items-center justify-between mb-1.5 text-xs">
                <div className="text-[var(--text-secondary)]">
                    {replayIndex + 1} / {replayData.length} candles
                </div>
                <div className="text-[var(--text-primary)] font-medium">{getCurrentTime()}</div>
            </div>

            {/* Progress Bar */}
            <div
                ref={progressBarRef}
                onClick={handleClick}
                onMouseMove={handleMouseMove}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
                className="relative h-2 bg-[var(--bg-tertiary)] rounded-full cursor-pointer group"
                title="Click to seek"
            >
                {/* Filled Progress */}
                <div
                    className="absolute h-full bg-[var(--accent-primary)] rounded-full transition-all duration-200"
                    style={{ width: `${progress}%` }}
                />

                {/* Progress Handle */}
                <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-[var(--accent-primary)] rounded-full shadow-md transition-all duration-200 group-hover:scale-125"
                    style={{ left: `${progress}%`, transform: 'translate(-50%, -50%)' }}
                />

                {/* Hover Indicator */}
                {isHovering && (
                    <div
                        className="absolute -top-8 bg-[var(--bg-primary)] border border-[var(--bg-tertiary)] px-2 py-1 rounded text-xs text-[var(--text-primary)] shadow-lg whitespace-nowrap"
                        style={{
                            left: `${hoverPosition}%`,
                            transform: 'translateX(-50%)',
                        }}
                    >
                        {getHoverTime()}
                    </div>
                )}
            </div>

            {/* Time Range */}
            {replayStartTime && replayEndTime && (
                <div className="flex items-center justify-between mt-1.5 text-xs text-[var(--text-tertiary)]">
                    <span>{formatTime(replayStartTime)}</span>
                    <span>{formatTime(replayEndTime)}</span>
                </div>
            )}
        </div>
    );
}
