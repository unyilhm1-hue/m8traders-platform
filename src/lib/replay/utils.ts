/**
 * Replay utilities
 */
import type { Candle } from '@/types';

export const findClosestCandleIndex = (data: Candle[], targetTimestamp: number): number => {
    if (data.length === 0) return 0;

    let closestIdx = 0;
    let closestDiff = Math.abs(data[0].t - targetTimestamp);

    for (let i = 1; i < data.length; i++) {
        const diff = Math.abs(data[i].t - targetTimestamp);
        if (diff < closestDiff) {
            closestDiff = diff;
            closestIdx = i;
        }
    }

    return closestIdx;
};

export const formatDateTimeLocal = (timestamp: number): string => {
    const date = new Date(timestamp);
    const pad = (value: number) => String(value).padStart(2, '0');

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
