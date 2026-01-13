/**
 * ReplayEngine - Core Replay System Logic
 * Manages progressive playback of historical candle data
 */

import type { Candle, PlaybackSpeed, ReplayOptions } from '@/types';
import { getIntervalForSpeed } from './config';

export class ReplayEngine {
    private data: Candle[];
    private currentIndex: number;
    private speed: PlaybackSpeed;
    private isPlaying: boolean;
    private intervalId: NodeJS.Timeout | null;
    private onUpdateCallback?: (data: Candle[]) => void;
    private onProgressCallback?: (index: number) => void;
    private onCompleteCallback?: () => void;

    constructor(data: Candle[], options: ReplayOptions = {}) {
        this.data = data;
        this.currentIndex = options.startIndex ?? 0;
        this.speed = options.speed ?? 1;
        this.isPlaying = false;
        this.intervalId = null;
        this.onUpdateCallback = options.onUpdate;
        this.onProgressCallback = options.onProgress;
        this.onCompleteCallback = options.onComplete;
    }

    /**
     * Start playback from current position
     */
    play(): void {
        if (this.isPlaying) return;
        if (this.currentIndex >= this.data.length - 1) {
            // If at the end, restart from beginning
            this.currentIndex = 0;
        }

        this.isPlaying = true;
        this.startInterval();
    }

    /**
     * Pause playback at current position
     */
    pause(): void {
        this.isPlaying = false;
        this.stopInterval();
    }

    /**
     * Stop playback and reset to beginning
     */
    stop(): void {
        this.isPlaying = false;
        this.stopInterval();
        this.currentIndex = 0;
        this.emitUpdate();
    }

    /**
     * Seek to specific candle index
     */
    seekTo(index: number): void {
        const wasPlaying = this.isPlaying;
        this.pause();

        this.currentIndex = Math.max(0, Math.min(index, this.data.length - 1));
        this.emitUpdate();

        if (wasPlaying) {
            this.play();
        }
    }

    /**
     * Change playback speed
     */
    setSpeed(speed: PlaybackSpeed): void {
        const wasPlaying = this.isPlaying;
        this.speed = speed;

        if (wasPlaying) {
            this.stopInterval();
            this.startInterval();
        }
    }

    /**
     * Get currently visible data (up to current index)
     */
    getVisibleData(): Candle[] {
        return this.data.slice(0, this.currentIndex + 1);
    }

    /**
     * Get current candle
     */
    getCurrentCandle(): Candle | null {
        return this.data[this.currentIndex] ?? null;
    }

    /**
     * Get playback progress (0-100)
     */
    getProgress(): number {
        if (this.data.length === 0) return 0;
        return (this.currentIndex / (this.data.length - 1)) * 100;
    }

    /**
     * Get total number of candles
     */
    getTotalCandles(): number {
        return this.data.length;
    }

    /**
     * Get current index
     */
    getCurrentIndex(): number {
        return this.currentIndex;
    }

    /**
     * Check if currently playing
     */
    getIsPlaying(): boolean {
        return this.isPlaying;
    }

    /**
     * Get current speed
     */
    getSpeed(): PlaybackSpeed {
        return this.speed;
    }

    /**
     * Load new data (resets playback)
     */
    loadData(data: Candle[]): void {
        this.stop();
        this.data = data;
        this.currentIndex = 0;
        this.emitUpdate();
    }

    /**
     * Cleanup resources
     */
    destroy(): void {
        this.stop();
        this.onUpdateCallback = undefined;
        this.onProgressCallback = undefined;
        this.onCompleteCallback = undefined;
    }

    /**
     * Start the interval for progressive playback
     */
    private startInterval(): void {
        const intervalMs = getIntervalForSpeed(this.speed);

        this.intervalId = setInterval(() => {
            this.tick();
        }, intervalMs);
    }

    /**
     * Stop the interval
     */
    private stopInterval(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    /**
     * Process one tick (reveal next candle)
     */
    private tick(): void {
        if (this.currentIndex >= this.data.length - 1) {
            // Reached the end
            this.pause();
            this.onCompleteCallback?.();
            return;
        }

        this.currentIndex++;
        this.emitUpdate();
    }

    /**
     * Emit update to callbacks
     */
    private emitUpdate(): void {
        this.onUpdateCallback?.(this.getVisibleData());
        this.onProgressCallback?.(this.currentIndex);
    }
}
