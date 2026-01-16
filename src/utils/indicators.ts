/**
 * Technical Indicators Calculator
 * Implements MA, RSI, ATR for multi-timeframe context analysis
 */

export interface IndicatorCandle {
    t: number;
    o: number;
    h: number;
    l: number;
    c: number;
    v: number;
}

/**
 * Calculate Simple Moving Average (SMA)
 * @param candles - Array of candles (should be length === period)
 * @param period - Number of candles to average
 */
export function calculateSMA(candles: IndicatorCandle[], period: number = 20): number | null {
    if (candles.length < period) {
        return null; // Not enough data
    }

    const closes = candles.slice(-period).map(c => c.c);
    const sum = closes.reduce((acc, val) => acc + val, 0);
    return sum / period;
}

/**
 * Calculate Exponential Moving Average (EMA)
 * @param candles - Array of candles
 * @param period - EMA period (common: 9, 12, 20, 50, 200)
 */
export function calculateEMA(candles: IndicatorCandle[], period: number = 20): number | null {
    if (candles.length < period) {
        return null;
    }

    const multiplier = 2 / (period + 1);
    const closes = candles.map(c => c.c);

    // Start with SMA as seed
    let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;

    // Apply EMA formula for remaining candles
    for (let i = period; i < closes.length; i++) {
        ema = (closes[i] - ema) * multiplier + ema;
    }

    return ema;
}

/**
 * Calculate Relative Strength Index (RSI)
 * Measures momentum: overbought (>70) vs oversold (<30)
 * 
 * @param candles - Array of candles (min: period + 1)
 * @param period - RSI period (common: 14)
 */
export function calculateRSI(candles: IndicatorCandle[], period: number = 14): number | null {
    if (candles.length < period + 1) {
        return null;
    }

    const closes = candles.map(c => c.c);
    const changes: number[] = [];

    // Calculate price changes
    for (let i = 1; i < closes.length; i++) {
        changes.push(closes[i] - closes[i - 1]);
    }

    // Separate gains and losses
    let avgGain = 0;
    let avgLoss = 0;

    // Initial averages (SMA for first period)
    for (let i = 0; i < period; i++) {
        if (changes[i] > 0) {
            avgGain += changes[i];
        } else {
            avgLoss += Math.abs(changes[i]);
        }
    }

    avgGain = avgGain / period;
    avgLoss = avgLoss / period;

    // Smoothed averages for remaining candles (Wilder's smoothing)
    for (let i = period; i < changes.length; i++) {
        const change = changes[i];

        if (change > 0) {
            avgGain = (avgGain * (period - 1) + change) / period;
            avgLoss = (avgLoss * (period - 1)) / period;
        } else {
            avgGain = (avgGain * (period - 1)) / period;
            avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
        }
    }

    // Prevent division by zero
    if (avgLoss === 0) {
        return 100;
    }

    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    return rsi;
}

/**
 * Calculate Average True Range (ATR)
 * Measures volatility (higher ATR = more volatile)
 * 
 * @param candles - Array of candles (min: period + 1)
 * @param period - ATR period (common: 14)
 */
export function calculateATR(candles: IndicatorCandle[], period: number = 14): number | null {
    if (candles.length < period + 1) {
        return null;
    }

    const trueRanges: number[] = [];

    // Calculate True Range for each candle
    for (let i = 1; i < candles.length; i++) {
        const current = candles[i];
        const previous = candles[i - 1];

        const tr = Math.max(
            current.h - current.l,                  // High - Low
            Math.abs(current.h - previous.c),       // High - Previous Close
            Math.abs(current.l - previous.c)        // Low - Previous Close
        );

        trueRanges.push(tr);
    }

    // First ATR is simple average
    let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;

    // Smoothed ATR for remaining candles (Wilder's smoothing)
    for (let i = period; i < trueRanges.length; i++) {
        atr = (atr * (period - 1) + trueRanges[i]) / period;
    }

    return atr;
}

/**
 * Calculate Bollinger Bands
 * Returns: { upper, middle, lower }
 * 
 * @param candles - Array of candles
 * @param period - SMA period (common: 20)
 * @param stdDev - Standard deviation multiplier (common: 2)
 */
export function calculateBollingerBands(
    candles: IndicatorCandle[],
    period: number = 20,
    stdDev: number = 2
): { upper: number; middle: number; lower: number } | null {
    if (candles.length < period) {
        return null;
    }

    const closes = candles.slice(-period).map(c => c.c);

    // Middle band = SMA
    const middle = closes.reduce((a, b) => a + b, 0) / period;

    // Calculate standard deviation
    const variance = closes.reduce((sum, close) => {
        return sum + Math.pow(close - middle, 2);
    }, 0) / period;

    const sd = Math.sqrt(variance);

    return {
        upper: middle + (stdDev * sd),
        middle: middle,
        lower: middle - (stdDev * sd)
    };
}

/**
 * Detect trend direction from moving averages
 * @returns 'bullish' | 'bearish' | 'sideways'
 */
export function detectTrendDirection(
    candles: IndicatorCandle[],
    fastPeriod: number = 20,
    slowPeriod: number = 50
): 'bullish' | 'bearish' | 'sideways' | null {
    const fastMA = calculateSMA(candles, fastPeriod);
    const slowMA = calculateSMA(candles, slowPeriod);

    if (fastMA === null || slowMA === null) {
        return null;
    }

    const diff = ((fastMA - slowMA) / slowMA) * 100;

    // Threshold for confirming trend (0.5% difference)
    if (diff > 0.5) {
        return 'bullish';
    } else if (diff < -0.5) {
        return 'bearish';
    } else {
        return 'sideways';
    }
}

/**
 * Calculate trend strength (0-100)
 * Based on slope of moving average and RSI
 */
export function calculateTrendStrength(
    candles: IndicatorCandle[],
    period: number = 20
): number | null {
    if (candles.length < period + 1) {
        return null;
    }

    // Calculate MA slope
    const currentMA = calculateSMA(candles.slice(-(period + 1)), period);
    const previousMA = calculateSMA(candles.slice(-(period + 2), -1), period);

    if (currentMA === null || previousMA === null) {
        return null;
    }

    const slopePercent = Math.abs(((currentMA - previousMA) / previousMA) * 100);

    // Normalize slope to 0-100 scale (0.5% = moderate, 2% = strong)
    const slopeScore = Math.min((slopePercent / 2) * 100, 100);

    // Also factor in RSI deviation from 50 (neutral)
    const rsi = calculateRSI(candles, 14);
    const rsiScore = rsi ? Math.abs(rsi - 50) * 2 : 0; // 0-100 scale

    // Combined score (weighted average)
    const strength = (slopeScore * 0.7) + (rsiScore * 0.3);

    return Math.min(strength, 100);
}

/**
 * Classify volatility regime
 * @returns 'low' | 'medium' | 'high'
 */
export function classifyVolatility(
    candles: IndicatorCandle[],
    period: number = 14
): 'low' | 'medium' | 'high' | null {
    const atr = calculateATR(candles, period);

    if (atr === null || candles.length === 0) {
        return null;
    }

    const currentPrice = candles[candles.length - 1].c;
    const atrPercent = (atr / currentPrice) * 100;

    // Classify based on ATR as % of price
    if (atrPercent < 0.5) {
        return 'low';
    } else if (atrPercent < 1.5) {
        return 'medium';
    } else {
        return 'high';
    }
}
