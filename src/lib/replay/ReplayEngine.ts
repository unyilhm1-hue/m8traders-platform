/**
 * Enhanced ReplayEngine - Intra-Bar Tick Animation
 * Manages progressive playback dengan tick-by-tick animation
 */

import type { Candle, PlaybackSpeed, ReplayOptions, Timeframe } from '@/types';
import { getIntervalForSpeed } from './config';
import { generatePricePath, distributeVolume } from './pricePathGenerator';
import { getTickInterval, getTickTimestamp } from './tickTiming';
import { findJumpTarget, type JumpTarget } from './timeJump';

/**
 * Tick data (synthetic intra-candle point)
 */
export interface TickData {
    price: number;
    volume: number;
    timestamp: number;
    candleIndex: number;
    tickIndex: number;
}

/**
 * Enhanced replay options with intra-bar support
 */
export interface EnhancedReplayOptions extends ReplayOptions {
    timeframe?: Timeframe;
    numTicks?: number; // ticks per candle (default 20)
    onTickUpdate?: (tick: TickData) => void;
}

export class ReplayEngine {
    private data: Candle[];
    private currentCandleIndex: number;
    private currentTickIndex: number; // NEW: intra-candle position
    private pricePath: number[]; // NEW: current candle's tick prices
    private volumePath: number[]; // NEW: current candle's tick volumes
    private numTicks: number; // NEW: configurable tick count
    private timeframe: Timeframe;
    private speed: PlaybackSpeed;
    private isPlaying: boolean;
    private intervalId: NodeJS.Timeout | null;

    // Callbacks
    private onUpdateCallback?: (data: Candle[]) => void;
    private onProgressCallback?: (index: number) => void;
    private onCompleteCallback?: () => void;
    private onTickUpdateCallback?: (tick: TickData) => void;

    constructor(data: Candle[], options: EnhancedReplayOptions = {}) {
        this.data = data;
        this.currentCandleIndex = options.startIndex ?? 0;
        this.currentTickIndex = 0;
        this.pricePath = [];
        this.volumePath = [];
        this.numTicks = options.numTicks ?? 20;
        this.timeframe = options.timeframe ?? '5m';
        this.speed = options.speed ?? 1;
        this.isPlaying = false;
        this.intervalId = null;

        this.onUpdateCallback = options.onUpdate;
        this.onProgressCallback = options.onProgress;
        this.onCompleteCallback = options.onComplete;
        this.onTickUpdateCallback = options.onTickUpdate;

        // Generate initial paths
        if (data.length > 0) {
            this.regeneratePaths();
        }
    }

    /**
     * Start playback from current position
     */
    play(): void {
        if (this.isPlaying) return;

        if (
            this.currentCandleIndex >= this.data.length - 1 &&
            this.currentTickIndex >= this.numTicks - 1
        ) {
            // At the very end, restart from beginning
            this.currentCandleIndex = 0;
            this.currentTickIndex = 0;
            this.regeneratePaths();
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
        this.currentCandleIndex = 0;
        this.currentTickIndex = 0;
        this.regeneratePaths();
        this.emitUpdate();
    }

    /**
     * Seek to specific candle index (resets tick to 0)
     */
    seekTo(index: number): void {
        const wasPlaying = this.isPlaying;
        this.pause();

        this.currentCandleIndex = Math.max(0, Math.min(index, this.data.length - 1));
        this.currentTickIndex = 0;
        this.regeneratePaths();
        this.emitUpdate();

        if (wasPlaying) {
            this.play();
        }
    }

    /**
     * Jump to specific timestamp (precise jump with intra-candle position)
     */
    jumpToTimestamp(timestamp: number): void {
        const target = findJumpTarget(
            this.data,
            timestamp,
            this.timeframe,
            this.numTicks
        );

        if (!target) {
            console.warn('No candle found for timestamp:', timestamp);
            return;
        }

        this.jumpTo(target);
    }

    /**
     * Jump to specific candle + tick position
     */
    jumpTo(target: JumpTarget | { candleIndex: number; tickIndex?: number }): void {
        const wasPlaying = this.isPlaying;
        this.pause();

        this.currentCandleIndex = Math.max(
            0,
            Math.min(target.candleIndex, this.data.length - 1)
        );
        this.currentTickIndex = Math.max(
            0,
            Math.min(target.tickIndex ?? 0, this.numTicks - 1)
        );

        this.regeneratePaths();
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
     * Set timeframe (affects tick timing)
     */
    setTimeframe(timeframe: Timeframe): void {
        const wasPlaying = this.isPlaying;
        this.timeframe = timeframe;

        if (wasPlaying) {
            this.stopInterval();
            this.startInterval();
        }
    }

    /**
     * Get current tick data
     */
    getCurrentTick(): TickData | null {
        const candle = this.data[this.currentCandleIndex];
        if (!candle || this.pricePath.length === 0) return null;

        const price = this.pricePath[this.currentTickIndex] ?? candle.c;
        const volume = this.volumePath[this.currentTickIndex] ?? 0;
        const timestamp = getTickTimestamp(
            candle.t,
            this.currentTickIndex,
            this.timeframe,
            this.numTicks
        );

        return {
            price,
            volume,
            timestamp,
            candleIndex: this.currentCandleIndex,
            tickIndex: this.currentTickIndex,
        };
    }

    /**
     * Get visible data (up to current candle)
     */
    getVisibleData(): Candle[] {
        return this.data.slice(0, this.currentCandleIndex + 1);
    }

    /**
     * Get current candle (potentially partial if mid-tick)
     */
    getCurrentCandle(): Candle | null {
        const candle = this.data[this.currentCandleIndex];
        if (!candle) return null;

        // If we're mid-candle, return partial candle data
        if (this.currentTickIndex < this.numTicks - 1) {
            const currentPrice = this.pricePath[this.currentTickIndex] ?? candle.c;
            const accumulatedVolume = this.volumePath
                .slice(0, this.currentTickIndex + 1)
                .reduce((sum, v) => sum + v, 0);

            // Create partial candle with current progress
            return {
                t: candle.t,
                o: candle.o,
                h: Math.max(...this.pricePath.slice(0, this.currentTickIndex + 1)),
                l: Math.min(...this.pricePath.slice(0, this.currentTickIndex + 1)),
                c: currentPrice,
                v: accumulatedVolume,
            };
        }

        // Full candle
        return candle;
    }

    /**
     * Get playback progress (0-100, includes tick progress)
     */
    getProgress(): number {
        if (this.data.length === 0) return 0;

        const totalTicks = this.data.length * this.numTicks;
        const currentTick = this.currentCandleIndex * this.numTicks + this.currentTickIndex;

        return (currentTick / totalTicks) * 100;
    }

    /**
     * Get total number of candles
     */
    getTotalCandles(): number {
        return this.data.length;
    }

    /**
     * Get current candle index
     */
    getCurrentIndex(): number {
        return this.currentCandleIndex;
    }

    /**
     * Get current tick index
     */
    getCurrentTickIndex(): number {
        return this.currentTickIndex;
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
        this.currentCandleIndex = 0;
        this.currentTickIndex = 0;
        this.regeneratePaths();
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
        this.onTickUpdateCallback = undefined;
    }

    /**
     * Generate price & volume paths for current candle
     */
    private regeneratePaths(): void {
        const candle = this.data[this.currentCandleIndex];
        if (!candle) {
            this.pricePath = [];
            this.volumePath = [];
            return;
        }

        this.pricePath = generatePricePath(candle, this.numTicks);
        this.volumePath = distributeVolume(candle.v, this.numTicks);
    }

    /**
     * Start the interval for tick-by-tick playback
     */
    private startInterval(): void {
        const intervalMs = getTickInterval(this.timeframe, this.speed, this.numTicks);

        this.intervalId = setInterval(() => {
            this.tick();
        }, intervalMs);

        // Emit initial tick
        this.emitTickUpdate();
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
     * Process one tick
     */
    private tick(): void {
        if (this.currentTickIndex < this.numTicks - 1) {
            // Still within current candle
            this.currentTickIndex++;
            this.emitTickUpdate();
        } else {
            // Candle complete, move to next
            if (this.currentCandleIndex >= this.data.length - 1) {
                // Reached the end
                this.pause();
                this.onCompleteCallback?.();
                return;
            }

            this.currentCandleIndex++;
            this.currentTickIndex = 0;
            this.regeneratePaths();
            this.emitUpdate(); // Full candle change
            this.emitTickUpdate(); // First tick of new candle
        }
    }

    /**
     * Emit tick update to callback
     */
    private emitTickUpdate(): void {
        const tick = this.getCurrentTick();
        if (tick) {
            this.onTickUpdateCallback?.(tick);
        }
    }

    /**
     * Emit full update to callbacks (candle change)
     */
    private emitUpdate(): void {
        this.onUpdateCallback?.(this.getVisibleData());
        this.onProgressCallback?.(this.currentCandleIndex);
    }
}
