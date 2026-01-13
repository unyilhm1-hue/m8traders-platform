/**
 * Replay System Types
 * Type definitions for the replay/playback system
 */

import type { Candle } from './chart';

export type ReplayMode = 'live' | 'h7' | 'h30';
export type PlaybackSpeed = 1 | 2 | 5 | 10 | 25 | 50;

export interface ReplayState {
    mode: ReplayMode;
    currentIndex: number;
    totalCandles: number;
    isPlaying: boolean;
    speed: PlaybackSpeed;
    startTime: number | null;
    endTime: number | null;
}

export interface ReplayOptions {
    speed?: PlaybackSpeed;
    startIndex?: number;
    onUpdate?: (data: Candle[]) => void;
    onProgress?: (index: number) => void;
    onComplete?: () => void;
}

export interface ReplayEngineConfig {
    baseIntervalMs: number;
    speeds: readonly PlaybackSpeed[];
    modes: Record<string, ReplayMode>;
}
