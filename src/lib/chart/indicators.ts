import {
    SMA,
    EMA,
    RSI,
    MACD,
    BollingerBands
} from 'technicalindicators';
import type { Candle, Indicator } from '@/types';
import type { Time } from 'lightweight-charts';

/**
 * Interface for calculated indicator data point
 */
export interface IndicatorResult {
    time: Time;
    value: number;
    [key: string]: any; // For multi-value indicators like MACD/BB
}

/**
 * Extracts close prices from candles
 */
const getCloses = (data: Candle[]) => data.map(d => d.c);

/**
 * Calculator Functions
 */

export const calculateSMA = (data: Candle[], period: number): IndicatorResult[] => {
    const closes = getCloses(data);
    const results = SMA.calculate({ period, values: closes });

    // SMA result is shorter than input by (period - 1)
    // We align it to the end of the data array
    const offset = data.length - results.length;

    return results.map((val, i) => ({
        time: data[i + offset].t as unknown as Time, // Cast needed if lightweight-charts types match
        value: val
    }));
};

export const calculateEMA = (data: Candle[], period: number): IndicatorResult[] => {
    const closes = getCloses(data);
    const results = EMA.calculate({ period, values: closes });
    const offset = data.length - results.length;

    return results.map((val, i) => ({
        time: data[i + offset].t as unknown as Time,
        value: val
    }));
};

export const calculateRSI = (data: Candle[], period: number): IndicatorResult[] => {
    const closes = getCloses(data);
    const results = RSI.calculate({ period, values: closes });
    const offset = data.length - results.length;

    return results.map((val, i) => ({
        time: data[i + offset].t as unknown as Time,
        value: val
    }));
};

export const calculateMACD = (data: Candle[]): IndicatorResult[] => {
    const closes = getCloses(data);
    // Default MACD settings: 12, 26, 9
    const results = MACD.calculate({
        values: closes,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
        SimpleMAOscillator: false,
        SimpleMASignal: false
    });

    const offset = data.length - results.length;

    return results.map((val, i) => ({
        time: data[i + offset].t as unknown as Time,
        value: val.MACD || 0,
        signal: val.signal,
        histogram: val.histogram
    }));
};

export const calculateBollinger = (data: Candle[], period: number = 20, stdDev: number = 2): IndicatorResult[] => {
    const closes = getCloses(data);
    const results = BollingerBands.calculate({
        period,
        stdDev,
        values: closes
    });

    const offset = data.length - results.length;

    return results.map((val, i) => ({
        time: data[i + offset].t as unknown as Time,
        value: val.middle, // Middle band usually main value
        upper: val.upper,
        lower: val.lower
    }));
};

/**
 * Calculate Volume (returns volume data for histogram)
 */
export const calculateVolume = (data: Candle[]): IndicatorResult[] => {
    return data.map(candle => ({
        time: candle.t as unknown as Time,
        value: candle.v || 0
    }));
};

/**
 * Main Dispatcher
 */
export const calculateIndicator = (type: string, data: Candle[], period: number = 14): IndicatorResult[] => {
    switch (type) {
        case 'sma': return calculateSMA(data, period);
        case 'ema': return calculateEMA(data, period);
        case 'rsi': return calculateRSI(data, period);
        case 'macd': return calculateMACD(data);
        case 'bollinger': return calculateBollinger(data, period);
        case 'volume': return calculateVolume(data);
        default:
            console.warn(`Indicator type ${type} not implemented`);
            return [];
    }
};
