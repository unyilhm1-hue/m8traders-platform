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
export const REPLAY_MODE = {
    LIVE: 'live',
    ONE_YEAR: '1y', // 1 year historical data (daily candles)
} as const;

/**
 * Mode labels for UI display
 */
export const REPLAY_MODE_LABELS: Record<ReplayMode, string> = {
    live: 'Live Trading',
    '1y': '1 Year Replay',
};

/**
 * Mode descriptions for tooltips
 */
export const REPLAY_MODE_DESCRIPTIONS: Record<ReplayMode, string> = {
    live: 'Real-time market data',
    '1y': 'Replay 1 year of historical daily data for practice',
};

/**
 * Calculate interval in milliseconds based on speed multiplier
 */
export function getIntervalForSpeed(speed: PlaybackSpeed): number {
    return BASE_INTERVAL_MS / speed;
}
