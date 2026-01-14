import type { Candle } from '@/types';

/**
 * Calculate Average True Range (ATR)
 * ATR measures market volatility by decomposing the entire range of an asset price for that period.
 * 
 * @param candles - Array of candles (must have at least 'period' candles)
 * @param period - Number of periods to calculate ATR over (default: 14)
 * @returns ATR value
 */
export function calculateATR(candles: Candle[], period = 14): number {
    if (candles.length < period + 1) {
        // Not enough data, return simple range of last candle
        const lastCandle = candles[candles.length - 1];
        return lastCandle ? lastCandle.h - lastCandle.l : 0;
    }

    // Calculate True Range for each candle
    const trueRanges: number[] = [];

    for (let i = 1; i < candles.length; i++) {
        const current = candles[i];
        const previous = candles[i - 1];

        // True Range = max of:
        // 1. Current High - Current Low
        // 2. |Current High - Previous Close|
        // 3. |Current Low - Previous Close|
        const tr = Math.max(
            current.h - current.l,
            Math.abs(current.h - previous.c),
            Math.abs(current.l - previous.c)
        );

        trueRanges.push(tr);
    }

    // Calculate Simple Moving Average of True Range (ATR)
    // Take the last 'period' true ranges
    const recentTR = trueRanges.slice(-period);
    const atr = recentTR.reduce((sum, tr) => sum + tr, 0) / period;

    return atr;
}

/**
 * Calculate ATR as percentage of current price
 * Useful for comparing volatility across different price levels
 */
export function calculateATRPercent(candles: Candle[], period = 14): number {
    const atr = calculateATR(candles, period);
    const lastCandle = candles[candles.length - 1];

    if (!lastCandle || lastCandle.c === 0) return 0;

    return (atr / lastCandle.c) * 100;
}
