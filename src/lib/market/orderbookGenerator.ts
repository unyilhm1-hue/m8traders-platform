import { roundToTick, getTickSize } from './idxTickSize';
import { calculateSpread } from './spreadCalculator';
import { generateDepthLevels } from './depthGenerator';
import type { OrderBookLevel } from './depthGenerator';
import type { Candle } from '@/types';

export interface OrderbookConfig {
    atr: number; // Average True Range
    numLevels?: number; // default = 10
    baseSpreadTicks?: number; // default = 2.5
}

export interface OrderbookSnapshot {
    bids: OrderBookLevel[];
    asks: OrderBookLevel[];
    spread: number;
    spreadPercent: number;
    midPrice: number;
    timestamp: number;
    lastUpdate?: number;
}

/**
 * Generate synthetic orderbook dari candle data
 *
 * Main function yang orchestrate semua komponen
 */
export function generateOrderbook(
    candle: Candle,
    config: OrderbookConfig
): OrderbookSnapshot {
    const { atr, numLevels = 10, baseSpreadTicks = 2.5 } = config;

    // 1. Calculate price anchors
    // Gunakan mid-price dari candle (high + low) / 2
    let midPrice = (candle.h + candle.l) / 2;

    // Jika candle gap besar, gunakan open sebagai anchor
    const gapPercent = (Math.abs(candle.o - candle.c) / candle.c) * 100;
    if (gapPercent > 5) {
        midPrice = candle.o;
    }

    const tickSize = getTickSize(midPrice);

    // 2. Calculate dynamic spread
    const spread = calculateSpread({
        price: midPrice,
        volume: candle.v,
        atr,
        timestamp: candle.t,
        baseSpreadTicks,
    });

    // 3. Determine best bid/ask
    const halfSpread = spread / 2;

    const bestBid = roundToTick(midPrice - halfSpread);
    const bestAsk = roundToTick(midPrice + halfSpread);

    // 4. Generate depth levels
    const { bids, asks } = generateDepthLevels({
        bestBid,
        bestAsk,
        volume: candle.v,
        numLevels,
    });

    // 5. Calculate spread percent
    const spreadPercent = (spread / midPrice) * 100;

    // 6. Construct orderbook snapshot
    return {
        bids,
        asks,
        spread,
        spreadPercent,
        midPrice,
        timestamp: candle.t,
        lastUpdate: Date.now(),
    };
}

/**
 * Update orderbook setelah trade execution
 * (Simplified - untuk realism bisa lebih complex)
 */
export function updateOrderbookFromTrade(
    orderbook: OrderbookSnapshot,
    executedPrice: number,
    executedQuantity: number,
    side: 'buy' | 'sell'
): OrderbookSnapshot {
    // Clone orderbook
    const updated = { ...orderbook };

    // Remove executed quantity from affected side
    if (side === 'buy') {
        // Trade executed on ask side
        updated.asks = updated.asks
            .map((level, idx) => {
                if (idx === 0 && level.price === executedPrice) {
                    return {
                        ...level,
                        quantity: Math.max(0, level.quantity - executedQuantity),
                    };
                }
                return level;
            })
            .filter((level) => level.quantity > 0);
    } else {
        // Trade executed on bid side
        updated.bids = updated.bids
            .map((level, idx) => {
                if (idx === 0 && level.price === executedPrice) {
                    return {
                        ...level,
                        quantity: Math.max(0, level.quantity - executedQuantity),
                    };
                }
                return level;
            })
            .filter((level) => level.quantity > 0);
    }

    updated.lastUpdate = Date.now();

    return updated;
}
