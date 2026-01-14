import type { Timeframe, PlaybackSpeed } from '@/types';

/**
 * Get duration of one candle in milliseconds
 */
export function getTimeframeDuration(timeframe: Timeframe): number {
    const durations: Record<Timeframe, number> = {
        '1m': 60_000, // 1 minute
        '5m': 300_000, // 5 minutes
        '15m': 900_000, // 15 minutes
        '30m': 1_800_000, // 30 minutes
        '1h': 3_600_000, // 1 hour
        '4h': 14_400_000, // 4 hours
        '1d': 86_400_000, // 1 day
        '1w': 604_800_000, // 1 week
    };

    return durations[timeframe];
}

/**
 * Calculate tick interval (ms per tick) based on timeframe and speed
 *
 * @param timeframe - Chart timeframe
 * @param speed - Playback speed multiplier
 * @param numTicks - Number of ticks per candle
 * @returns Milliseconds per tick
 */
export function getTickInterval(
    timeframe: Timeframe,
    speed: PlaybackSpeed,
    numTicks = 20
): number {
    // Real-time duration of 1 candle
    const candleDuration = getTimeframeDuration(timeframe);

    // Speed multiplier (higher speed = shorter duration)
    const speedMultipliers: Record<PlaybackSpeed, number> = {
        0.5: 2, // half speed (2x slower)
        1: 1, // normal
        2: 0.5, // 2x faster
        5: 0.2, // 5x faster
        10: 0.1, // 10x faster
    };

    const multiplier = speedMultipliers[speed] || 1;

    // Desired replay duration for this candle
    const replayDuration = candleDuration * multiplier;

    // Interval per tick
    const tickInterval = replayDuration / numTicks;

    // Clamp to reasonable bounds (min 50ms, max 10s)
    return Math.max(50, Math.min(tickInterval, 10_000));
}

/**
 * Calculate timestamp for a specific tick within a candle
 *
 * @param candleTimestamp - Start timestamp of the candle
 * @param tickIndex - Current tick index (0-based)
 * @param timeframe - Chart timeframe
 * @param numTicks - Total number of ticks per candle
 * @returns Timestamp for this tick
 */
export function getTickTimestamp(
    candleTimestamp: number,
    tickIndex: number,
    timeframe: Timeframe,
    numTicks = 20
): number {
    const candleDuration = getTimeframeDuration(timeframe);
    const tickDuration = candleDuration / numTicks;

    return candleTimestamp + tickIndex * tickDuration;
}
