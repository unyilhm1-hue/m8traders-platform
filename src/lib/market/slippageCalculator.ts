import type { OrderBookLevel } from './depthGenerator';

export interface FillResult {
    totalFilled: number;
    avgFillPrice: number;
    slippagePercent: number;
    partialFill: boolean;
    fillDetails: Array<{ price: number; quantity: number }>;
}

/**
 * Calculate market order fill dengan slippage
 *
 * @param orderSize - Total shares to buy/sell
 * @param depthLevels - Available depth (asks for buy, bids for sell)
 * @param side - 'buy' or 'sell'
 */
export function calculateMarketOrderFill(
    orderSize: number,
    depthLevels: OrderBookLevel[],
    side: 'buy' | 'sell'
): FillResult {
    let remainingSize = orderSize;
    const fillDetails: Array<{ price: number; quantity: number }> = [];
    let totalCost = 0;
    let totalFilled = 0;

    // Expected price (best bid/ask)
    const expectedPrice = depthLevels[0]?.price || 0;

    // Walk through depth levels
    for (const level of depthLevels) {
        if (remainingSize <= 0) break;

        const fillQty = Math.min(level.quantity, remainingSize);

        fillDetails.push({
            price: level.price,
            quantity: fillQty,
        });

        totalCost += level.price * fillQty;
        totalFilled += fillQty;
        remainingSize -= fillQty;
    }

    // Calculate weighted average fill price
    const avgFillPrice = totalFilled > 0 ? totalCost / totalFilled : 0;

    // Calculate slippage
    const slippagePercent =
        expectedPrice > 0
            ? (Math.abs(avgFillPrice - expectedPrice) / expectedPrice) * 100
            : 0;

    // Partial fill if remaining > 0
    const partialFill = remainingSize > 0;

    return {
        totalFilled,
        avgFillPrice,
        slippagePercent,
        partialFill,
        fillDetails,
    };
}

/**
 * Estimate slippage tanpa execute (untuk preview)
 */
export function estimateSlippage(
    orderSize: number,
    depthLevels: OrderBookLevel[],
    expectedPrice: number
): number {
    const fill = calculateMarketOrderFill(orderSize, depthLevels, 'buy');
    return fill.slippagePercent;
}
