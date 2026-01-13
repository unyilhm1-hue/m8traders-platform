/**
 * Sample chart data for development and testing
 * Real historical data will be loaded from API in production
 */
import type { Candle } from '@/types';

/**
 * Generate sample OHLCV data
 */
export function generateSampleData(
    count: number = 200,
    startPrice: number = 150,
    startTime?: number
): Candle[] {
    const data: Candle[] = [];
    let price = startPrice;
    let time = startTime || Date.now() - count * 5 * 60 * 1000; // 5 min intervals

    for (let i = 0; i < count; i++) {
        const volatility = 0.02; // 2% volatility
        const change = (Math.random() - 0.48) * volatility * price; // Slight upward bias
        const open = price;
        const close = price + change;
        const high = Math.max(open, close) + Math.random() * volatility * 0.5 * price;
        const low = Math.min(open, close) - Math.random() * volatility * 0.5 * price;
        const volume = Math.floor(50000 + Math.random() * 150000);

        data.push({
            t: time,
            o: parseFloat(open.toFixed(2)),
            h: parseFloat(high.toFixed(2)),
            l: parseFloat(low.toFixed(2)),
            c: parseFloat(close.toFixed(2)),
            v: volume,
        });

        price = close;
        time += 5 * 60 * 1000; // 5 minutes
    }

    return data;
}

/**
 * Convert our Candle to KLineChart format
 */
export interface KLineData {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
    turnover?: number;
}

export function toKLineData(candles: Candle[]): KLineData[] {
    return candles.map((c) => ({
        timestamp: c.t,
        open: c.o,
        high: c.h,
        low: c.l,
        close: c.c,
        volume: c.v,
    }));
}

/**
 * Sample ticker data for demo
 */
export const SAMPLE_TICKERS = [
    { symbol: 'AAPL', name: 'Apple Inc.', price: 185.50 },
    { symbol: 'MSFT', name: 'Microsoft Corp.', price: 378.25 },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 141.80 },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', price: 178.50 },
    { symbol: 'TSLA', name: 'Tesla Inc.', price: 248.75 },
    { symbol: 'NVDA', name: 'NVIDIA Corp.', price: 495.20 },
    { symbol: 'BBCA', name: 'Bank Central Asia', price: 9875 },
    { symbol: 'BBRI', name: 'Bank Rakyat Indonesia', price: 5925 },
    { symbol: 'TLKM', name: 'Telkom Indonesia', price: 4150 },
    { symbol: 'ASII', name: 'Astra International', price: 5425 },
];

/**
 * Get sample data for a specific ticker
 */
export function getSampleTickerData(symbol: string): Candle[] {
    const ticker = SAMPLE_TICKERS.find((t) => t.symbol === symbol);
    const startPrice = ticker?.price || 100;
    return generateSampleData(200, startPrice);
}
