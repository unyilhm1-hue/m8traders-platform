/**
 * Replay System Configuration
 * Constants and configuration for the replay/playback engine
 */

import type { PlaybackSpeed, ReplayMode } from '@/types';

/**
 * Available playback speeds
 * 1x = 1 candle per second (realistic)
 * 2x = 2 candles per second
 * 5x = 5 candles per second
 * 10x = 10 candles per second (fast-forward)
 * 25x = 25 candles per second (very fast)
 * 50x = 50 candles per second (ultra fast)
 */
export const PLAYBACK_SPEEDS: readonly PlaybackSpeed[] = [1, 2, 5, 10, 25, 50] as const;

/**
 * Base interval in milliseconds for 1x speed
 * At 1x: 1 candle per second
 * At 2x: 2 candles per second (500ms interval)
 * At 5x: 5 candles per second (200ms interval)
 * At 10x: 10 candles per second (100ms interval)
 */
export const BASE_INTERVAL_MS = 1000;

/**
 * Replay mode definitions
 */
export const REPLAY_MODES: Record<string, ReplayMode> = {
    LIVE: 'live',
    H7: 'h7',
    H30: 'h30',
} as const;

/**
 * Mode labels for UI display
 */
export const MODE_LABELS: Record<ReplayMode, string> = {
    live: 'Live',
    h7: 'Last 7 Days',
    h30: 'Last 30 Days',
};

/**
 * Mode descriptions for tooltips
 */
export const MODE_DESCRIPTIONS: Record<ReplayMode, string> = {
    live: 'Real-time simulation with current data',
    h7: 'Replay last 7 days of historical data',
    h30: 'Replay last 30 days of historical data',
};

/**
 * Calculate interval in milliseconds based on speed multiplier
 */
export function getIntervalForSpeed(speed: PlaybackSpeed): number {
    return BASE_INTERVAL_MS / speed;
}
