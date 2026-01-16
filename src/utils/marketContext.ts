/**
 * Multi-Timeframe Context Analysis Engine
 * Implements "Mata Dewa" (God's Eye) strategy
 * 3-Layer analysis: Micro → Meso → Macro
 */

import type { Candle } from '@/utils/candleAggregation';
import {
    calculateSMA,
    calculateRSI,
    calculateATR,
    detectTrendDirection,
    calculateTrendStrength,
    classifyVolatility,
    type IndicatorCandle
} from '@/utils/indicators';

/**
 * Multi-Timeframe Market Context
 * Combines 3 layers of analysis for realistic price movement
 */
export interface MarketContext {
    // Layer 1: MIKRO (Current Candle Pattern)
    currentPattern: 'hammer' | 'shootingStar' | 'marubozu' | 'doji' | 'neutral';
    patternBullish: boolean;
    bodyRatio: number;
    wickRatio: number;

    // Layer 2: MESO (Session Context)
    sessionProgress: number;      // 0.0-1.0 (how far into trading day)
    priceVsOpen: number;          // % diff from session open
    volumeVsAverage: number;      // ratio to average volume
    nearSessionHigh: boolean;     // within 1% of session high
    nearSessionLow: boolean;      // within 1% of session low

    // Layer 3: MAKRO (Trend from Buffer)
    trend: 'bullish' | 'bearish' | 'sideways';
    trendStrength: number;        // 0-100
    volatility: 'low' | 'medium' | 'high';
    rsi: number | null;           // RSI(14) value
    ma20: number | null;
    ma50: number | null;

    // Derived: Flow Alignment (Arus Sungai)
    isFlowAligned: boolean;       // Pattern direction === Trend direction
    noiseLevel: number;           // 0.1-0.5 (for fractal noise scaling)
}

/**
 * Analyze pattern on current candle (Layer 1: Micro)
 */
function analyzePattern(candle: Candle): {
    type: MarketContext['currentPattern'];
    isBullish: boolean;
    bodyRatio: number;
    upperWickRatio: number;
    lowerWickRatio: number;
} {
    const body = Math.abs(candle.c - candle.o);
    const range = candle.h - candle.l;
    const upperWick = candle.h - Math.max(candle.o, candle.c);
    const lowerWick = Math.min(candle.o, candle.c) - candle.l;

    const bodyRatio = range > 0 ? body / range : 0;
    const upperWickRatio = range > 0 ? upperWick / range : 0;
    const lowerWickRatio = range > 0 ? lowerWick / range : 0;

    const isBullish = candle.c >= candle.o;

    // Pattern detection (strict ratios)
    if (lowerWickRatio > 0.6 && bodyRatio < 0.3) {
        return { type: 'hammer', isBullish, bodyRatio, upperWickRatio, lowerWickRatio };
    }
    if (upperWickRatio > 0.6 && bodyRatio < 0.3) {
        return { type: 'shootingStar', isBullish, bodyRatio, upperWickRatio, lowerWickRatio };
    }
    if ((upperWickRatio + lowerWickRatio) < 0.1 && bodyRatio > 0.8) {
        return { type: 'marubozu', isBullish, bodyRatio, upperWickRatio, lowerWickRatio };
    }
    if (bodyRatio < 0.05) {
        return { type: 'doji', isBullish, bodyRatio, upperWickRatio, lowerWickRatio };
    }

    return { type: 'neutral', isBullish, bodyRatio, upperWickRatio, lowerWickRatio };
}

/**
 * Calculate session context (Layer 2: Meso)
 */
function analyzeSessionContext(
    currentCandle: Candle,
    sessionCandles: Candle[],
    historyBuffer: Candle[]
): {
    sessionProgress: number;
    priceVsOpen: number;
    volumeVsAverage: number;
    nearSessionHigh: boolean;
    nearSessionLow: boolean;
} {
    if (sessionCandles.length === 0) {
        return {
            sessionProgress: 0,
            priceVsOpen: 0,
            volumeVsAverage: 1,
            nearSessionHigh: false,
            nearSessionLow: false
        };
    }

    // Assume ~360 candles per trading day (1m interval, 6 hours)
    const EXPECTED_SESSION_CANDLES = 360;
    const sessionProgress = Math.min(sessionCandles.length / EXPECTED_SESSION_CANDLES, 1.0);

    // Price vs session open
    const sessionOpen = sessionCandles[0].o;
    const priceVsOpen = ((currentCandle.c - sessionOpen) / sessionOpen) * 100;

    // Volume vs average
    const avgVolume = historyBuffer.length > 0
        ? historyBuffer.reduce((sum, c) => sum + c.v, 0) / historyBuffer.length
        : currentCandle.v;
    const volumeVsAverage = avgVolume > 0 ? currentCandle.v / avgVolume : 1;

    // Session high/low proximity (1% threshold)
    const sessionHigh = Math.max(...sessionCandles.map(c => c.h));
    const sessionLow = Math.min(...sessionCandles.map(c => c.l));

    const nearSessionHigh = ((sessionHigh - currentCandle.c) / sessionHigh) < 0.01;
    const nearSessionLow = ((currentCandle.c - sessionLow) / sessionLow) < 0.01;

    return {
        sessionProgress,
        priceVsOpen,
        volumeVsAverage,
        nearSessionHigh,
        nearSessionLow
    };
}

/**
 * Analyze macro trend from history buffer (Layer 3: Macro)
 */
function analyzeMacroTrend(historyBuffer: Candle[]): {
    trend: MarketContext['trend'];
    trendStrength: number;
    volatility: 'low' | 'medium' | 'high';
    rsi: number | null;
    ma20: number | null;
    ma50: number | null;
} {
    const indicatorCandles: IndicatorCandle[] = historyBuffer.map(c => ({
        t: c.t,
        o: c.o,
        h: c.h,
        l: c.l,
        c: c.c,
        v: c.v
    }));

    // Calculate indicators
    const ma20 = calculateSMA(indicatorCandles, 20);
    const ma50 = calculateSMA(indicatorCandles, 50);
    const rsi = calculateRSI(indicatorCandles, 14);
    const trend = detectTrendDirection(indicatorCandles, 20, 50) || 'sideways';
    const trendStrength = calculateTrendStrength(indicatorCandles, 20) || 0;
    const volatility = classifyVolatility(indicatorCandles, 14) || 'medium';

    return {
        trend,
        trendStrength,
        volatility,
        rsi,
        ma20,
        ma50
    };
}

/**
 * **MAIN FUNCTION**: Analyze Multi-Timeframe Context
 * 
 * Combines all 3 layers + flow alignment detection
 * 
 * @param currentCandle - Candle being simulated
 * @param historyBuffer - Past 200 candles (from smart loader)
 * @param sessionCandles - Today's candles so far
 * 
 * @returns Complete market context for realistic path generation
 */
export function analyzeMultiTimeframeContext(
    currentCandle: Candle,
    historyBuffer: Candle[],
    sessionCandles: Candle[]
): MarketContext {
    // Layer 1: Micro
    const pattern = analyzePattern(currentCandle);

    // Layer 2: Meso
    const session = analyzeSessionContext(currentCandle, sessionCandles, historyBuffer);

    // Layer 3: Macro
    const macro = analyzeMacroTrend(historyBuffer);

    // Flow alignment detection (Arus Sungai logic)
    const isFlowAligned = pattern.isBullish === (macro.trend === 'bullish');

    // Dynamic noise level based on:
    // - Volatility regime (high vol = more noise)
    // - Flow alignment (conflict = more noise)
    // - Session position (early = more noise, late = settled)
    let noiseLevel = 0.2; // Base level

    // Adjust for volatility
    if (macro.volatility === 'high') {
        noiseLevel += 0.15;
    } else if (macro.volatility === 'low') {
        noiseLevel -= 0.05;
    }

    // Adjust for flow alignment
    if (!isFlowAligned) {
        noiseLevel += 0.15; // Fighting trend = choppy
    } else {
        noiseLevel -= 0.05; // With trend = smooth
    }

    // Clamp to valid range
    noiseLevel = Math.max(0.1, Math.min(0.5, noiseLevel));

    return {
        // Micro
        currentPattern: pattern.type,
        patternBullish: pattern.isBullish,
        bodyRatio: pattern.bodyRatio,
        wickRatio: pattern.upperWickRatio + pattern.lowerWickRatio,

        // Meso
        sessionProgress: session.sessionProgress,
        priceVsOpen: session.priceVsOpen,
        volumeVsAverage: session.volumeVsAverage,
        nearSessionHigh: session.nearSessionHigh,
        nearSessionLow: session.nearSessionLow,

        // Macro
        trend: macro.trend,
        trendStrength: macro.trendStrength,
        volatility: macro.volatility,
        rsi: macro.rsi,
        ma20: macro.ma20,
        ma50: macro.ma50,

        // Derived
        isFlowAligned,
        noiseLevel
    };
}
