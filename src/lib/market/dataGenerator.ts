/**
 * Market Data Generator
 * Simulated Level 2 Order Book and Time & Sales data
 */

import { nanoid } from 'nanoid';
import type { OrderBook, OrderBookLevel, TimeAndSalesEntry, TradeSide, AdvancedMetrics } from '@/types/market';

/**
 * Generate simulated Level 2 Order Book around current price
 */
export function generateOrderBook(currentPrice: number, depth: number = 10): OrderBook {
    const spread = currentPrice * 0.001; // 0.1% spread
    const midPrice = currentPrice;
    const bidPrice = midPrice - spread / 2;
    const askPrice = midPrice + spread / 2;

    const bids: OrderBookLevel[] = [];
    const asks: OrderBookLevel[] = [];

    // Generate bids (descending from best bid)
    for (let i = 0; i < depth; i++) {
        const price = bidPrice - i * (spread / depth);
        const quantity = Math.floor(Math.random() * 1000) + 100;
        const orders = Math.floor(Math.random() * 10) + 1;

        bids.push({ price, quantity, orders });
    }

    // Generate asks (ascending from best ask)
    for (let i = 0; i < depth; i++) {
        const price = askPrice + i * (spread / depth);
        const quantity = Math.floor(Math.random() * 1000) + 100;
        const orders = Math.floor(Math.random() * 10) + 1;

        asks.push({ price, quantity, orders });
    }

    return {
        bids,
        asks,
        spread: askPrice - bidPrice,
        spreadPercent: ((askPrice - bidPrice) / midPrice) * 100,
        midPrice,
        timestamp: Date.now(),
    };
}

/**
 * Generate Time & Sales entry
 */
export function generateTimeAndSalesEntry(
    currentPrice: number,
    prevPrice?: number
): TimeAndSalesEntry {
    const priceVariation = (Math.random() - 0.5) * currentPrice * 0.002;
    const price = currentPrice + priceVariation;
    const size = Math.floor(Math.random() * 500) + 10;

    // Determine side based on price movement
    let side: TradeSide = 'between';
    if (prevPrice) {
        if (price > prevPrice) {
            side = 'buy';
        } else if (price < prevPrice) {
            side = 'sell';
        }
    }

    // Condition: block trade if size > 10,000
    const condition = size > 10000 ? 'block' : size < 100 ? 'odd-lot' : 'regular';

    return {
        id: nanoid(),
        timestamp: Date.now(),
        price,
        size,
        side,
        condition,
    };
}

/**
 * Calculate ATR (Average True Range) from candle data
 * Typically uses 14-period average
 */
export function calculateATR(
    candles: Array<{ h: number; l: number; c: number }>,
    period: number = 14
): number {
    if (candles.length < period + 1) return 0;

    const trueRanges: number[] = [];

    for (let i = 1; i < candles.length; i++) {
        const current = candles[i];
        const prev = candles[i - 1];

        const tr = Math.max(
            current.h - current.l,
            Math.abs(current.h - prev.c),
            Math.abs(current.l - prev.c)
        );

        trueRanges.push(tr);
    }

    // Take last 'period' true ranges
    const recentTRs = trueRanges.slice(-period);
    const atr = recentTRs.reduce((sum, tr) => sum + tr, 0) / period;

    return atr;
}

/**
 * Calculate RVOL (Relative Volume)
 * Current volume vs average volume at this time
 */
export function calculateRVOL(
    currentVolume: number,
    avgVolume: number
): number {
    if (avgVolume === 0) return 1;
    return currentVolume / avgVolume;
}

/**
 * Calculate VWAP (Volume Weighted Average Price)
 * Σ(Price × Volume) / Σ(Volume)
 * NOTE: Should reset daily at market open per /trading-expert rules
 */
export function calculateVWAP(
    candles: Array<{ c: number; v: number }>
): number {
    if (candles.length === 0) return 0;

    let totalPriceVolume = 0;
    let totalVolume = 0;

    for (const candle of candles) {
        totalPriceVolume += candle.c * candle.v;
        totalVolume += candle.v;
    }

    if (totalVolume === 0) return candles[candles.length - 1].c;

    return totalPriceVolume / totalVolume;
}

/**
 * Generate Advanced Metrics from candle data
 */
export function generateAdvancedMetrics(
    candles: Array<{ h: number; l: number; c: number; v: number }>,
    avgVolume: number = 100000
): AdvancedMetrics {
    const atr = calculateATR(candles);
    const currentVolume = candles[candles.length - 1]?.v || 0;
    const rvol = calculateRVOL(currentVolume, avgVolume);
    const vwap = calculateVWAP(candles);

    return {
        atr,
        rvol,
        vwap,
        timestamp: Date.now(),
    };
}
