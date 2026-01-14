import type { Candle } from '@/types';

/**
 * Calculate Average True Range (ATR)
 *
 * ATR measures market volatility by averaging the true range over a period.
 * True Range = max(high - low, |high - previous_close|, |low - previous_close|)
 */
export function calculateATR(candles: Candle[], period = 14): number {
    if (candles.length < period + 1) {
        // Not enough data, fallback to average range
        const avgRange = candles.reduce((sum, c) => sum + (c.h - c.l), 0) / candles.length;
        return avgRange || 1; // fallback to 1 if nothing
    }

    const trueRanges: number[] = [];

    for (let i = 1; i < candles.length; i++) {
        const current = candles[i];
        const previous = candles[i - 1];

        const tr = Math.max(
            current.h - current.l,
            Math.abs(current.h - previous.c),
            Math.abs(current.l - previous.c)
        );

        trueRanges.push(tr);
    }

    // Calculate ATR as simple moving average of true ranges
    const recentTR = trueRanges.slice(-period);
    const atr = recentTR.reduce((sum, tr) => sum + tr, 0) / recentTR.length;

    return atr;
}

/**
 * Calculate Relative Volume (RVOL)
 *
 * RVOL = Current Volume / Average Volume
 */
export function calculateRVOL(candles: Candle[], period = 20): number {
    if (candles.length === 0) return 1;

    const recentCandles = candles.slice(-period);
    const avgVolume = recentCandles.reduce((sum, c) => sum + c.v, 0) / recentCandles.length;

    const currentVolume = candles[candles.length - 1]?.v || 0;

    return avgVolume > 0 ? currentVolume / avgVolume : 1;
}

/**
 * Calculate Volume Weighted Average Price (VWAP)
 *
 * VWAP for a period (typically intraday)
 */
export function calculateVWAP(candles: Candle[]): number {
    if (candles.length === 0) return 0;

    let totalPV = 0;
    let totalVolume = 0;

    for (const candle of candles) {
        const typicalPrice = (candle.h + candle.l + candle.c) / 3;
        totalPV += typicalPrice * candle.v;
        totalVolume += candle.v;
    }

    return totalVolume > 0 ? totalPV / totalVolume : 0;
}

