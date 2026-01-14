import { roundToTick, getTickSize } from './idxTickSize';

export interface OrderBookLevel {
    price: number;
    quantity: number;
    orders: number; // number of orders at this price level
}

export interface DepthConfig {
    bestBid: number;
    bestAsk: number;
    volume: number;
    numLevels?: number; // default = 10
    decayRate?: number; // default = 0.3
}

/**
 * Apply random variance untuk realism
 */
function applyQuantityVariance(quantity: number, variance = 0.2): number {
    const min = 1 - variance;
    const max = 1 + variance;
    const multiplier = min + Math.random() * (max - min);
    return Math.round(quantity * multiplier);
}

/**
 * Calculate base quantity from volume
 */
function calculateBaseQuantity(
    volume: number,
    priceRange: number,
    numLevels: number,
    decayRate: number
): number {
    // Heuristic: total depth ≈ 10% of candle volume
    const totalDepth = volume * 0.1;

    // Distribute across levels (exponential sum correction)
    let sumExp = 0;
    for (let i = 0; i < numLevels; i++) {
        sumExp += Math.exp(-decayRate * i);
    }

    const baseQty = totalDepth / (sumExp * 2); // *2 untuk bid+ask

    // Round to lot size (1 lot = 100 shares di IDX)
    return Math.max(Math.round(baseQty / 100) * 100, 100);
}

/**
 * Generate depth levels dengan exponential decay
 */
export function generateDepthLevels(config: DepthConfig): {
    bids: OrderBookLevel[];
    asks: OrderBookLevel[];
} {
    const { bestBid, bestAsk, volume, numLevels = 10, decayRate = 0.3 } = config;

    const tickSize = getTickSize((bestBid + bestAsk) / 2);
    const priceRange = bestAsk - bestBid;

    // Calculate base quantity
    const baseQuantity = calculateBaseQuantity(
        volume,
        priceRange,
        numLevels,
        decayRate
    );

    // Generate bids (descending from bestBid)
    const bids: OrderBookLevel[] = [];
    for (let i = 0; i < numLevels; i++) {
        const price = roundToTick(bestBid - i * tickSize);
        const quantity = applyQuantityVariance(
            baseQuantity * Math.exp(-decayRate * i)
        );
        const orders = Math.max(Math.round(quantity / 100 / 5), 1); // ~5 lots per order

        bids.push({ price, quantity, orders });
    }

    // Generate asks (ascending from bestAsk)
    const asks: OrderBookLevel[] = [];
    for (let i = 0; i < numLevels; i++) {
        const price = roundToTick(bestAsk + i * tickSize);
        const quantity = applyQuantityVariance(
            baseQuantity * Math.exp(-decayRate * i)
        );
        const orders = Math.max(Math.round(quantity / 100 / 5), 1);

        asks.push({ price, quantity, orders });
    }

    return { bids, asks };
}
