/**
 * JumpToDateTime Component
 * Precise jump to a specific date/time within replay data
 */
'use client';

import { useMemo } from 'react';
import { useChartStore } from '@/stores';
import { findClosestCandleIndex, formatDateTimeLocal } from '@/lib/replay';

export function JumpToDateTime() {
    const { replayMode, replayData, replayIndex, replayStartTime, replayEndTime, setReplayIndex } =
        useChartStore();

    const isReplayActive = replayMode !== 'live';

    const currentTimestamp = replayData[replayIndex]?.t;

    const { minValue, maxValue, currentValue } = useMemo(() => {
        return {
            minValue: replayStartTime ? formatDateTimeLocal(replayStartTime) : undefined,
            maxValue: replayEndTime ? formatDateTimeLocal(replayEndTime) : undefined,
            currentValue: currentTimestamp ? formatDateTimeLocal(currentTimestamp) : '',
        };
    }, [currentTimestamp, replayEndTime, replayStartTime]);

    if (!isReplayActive) {
        return null;
    }

    const handleChange = (value: string) => {
        if (!value || replayData.length === 0) return;
        const targetTimestamp = new Date(value).getTime();
        if (Number.isNaN(targetTimestamp)) return;
        const closestIdx = findClosestCandleIndex(replayData, targetTimestamp);
        setReplayIndex(closestIdx);
    };

    return (
        <div className="hidden lg:flex items-center gap-2 bg-[var(--bg-tertiary)] p-1 rounded-lg border border-[var(--bg-subtle-border)]">
            <span className="text-[10px] text-[var(--text-tertiary)] px-1">Jump</span>
            <input
                type="datetime-local"
                value={currentValue}
                min={minValue}
                max={maxValue}
                onChange={(event) => handleChange(event.target.value)}
                className="bg-transparent text-[11px] text-[var(--text-primary)] px-1.5 py-0.5 rounded focus:outline-none"
            />
        </div>
    );
}
