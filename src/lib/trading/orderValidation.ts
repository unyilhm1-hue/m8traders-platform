/**
 * Order Management Utilities
 * Helper functions for advanced order validation and execution
 * All validations follow /trading-expert workflow rules
 */

import type { OrderSide, PendingOrder } from '@/types';

/**
 * Validate Limit Order price according to Trading Expert rules:
 * - Buy limit MUST be <= current price
 * - Sell limit MUST be >= current price
 */
export function validateLimitOrder(
    side: OrderSide,
    limitPrice: number,
    currentPrice: number
): { valid: boolean; error?: string } {
    if (side === 'BUY' && limitPrice > currentPrice) {
        return {
            valid: false,
            error: `Buy limit price ($${limitPrice}) must be <= current price ($${currentPrice})`,
        };
    }

    if (side === 'SELL' && limitPrice < currentPrice) {
        return {
            valid: false,
            error: `Sell limit price ($${limitPrice}) must be >= current price ($${currentPrice})`,
        };
    }

    return { valid: true };
}

/**
 * Validate Stop Order price according to Trading Expert rules:
 * - Sell stop MUST be < current price (for long positions)
 * - Buy stop MUST be > current price (for short positions - not supported yet)
 */
export function validateStopOrder(
    side: OrderSide,
    stopPrice: number,
    currentPrice: number
): { valid: boolean; error?: string } {
    if (side === 'SELL' && stopPrice >= currentPrice) {
        return {
            valid: false,
            error: `Sell stop price ($${stopPrice}) must be < current price ($${currentPrice})`,
        };
    }

    if (side === 'BUY' && stopPrice <= currentPrice) {
        return {
            valid: false,
            error: `Buy stop price ($${stopPrice}) must be > current price ($${currentPrice})`,
        };
    }

    return { valid: true };
}

/**
 * Check if a LIMIT order should be filled based on current price
 */
export function shouldFillLimitOrder(order: PendingOrder, currentPrice: number): boolean {
    if (!order.limitPrice) return false;

    if (order.side === 'BUY') {
        // Buy limit fills when price drops to or below limit price
        return currentPrice <= order.limitPrice;
    } else {
        // Sell limit fills when price rises to or above limit price
        return currentPrice >= order.limitPrice;
    }
}

/**
 * Check if a STOP order should be triggered based on current price
 */
export function shouldTriggerStopOrder(order: PendingOrder, currentPrice: number): boolean {
    if (!order.stopPrice) return false;

    if (order.side === 'SELL') {
        // Sell stop triggers when price drops to or below stop price
        return currentPrice <= order.stopPrice;
    } else {
        // Buy stop triggers when price rises to or above stop price
        return currentPrice >= order.stopPrice;
    }
}

/**
 * Calculate Risk/Reward Ratio
 * R:R = (Target - Entry) / (Entry - Stop Loss)
 */
export function calculateRiskReward(
    entryPrice: number,
    stopLoss: number,
    takeProfit: number
): number {
    const risk = Math.abs(entryPrice - stopLoss);
    const reward = Math.abs(takeProfit - entryPrice);

    if (risk === 0) return 0;
    return reward / risk;
}

/**
 * Validate Bracket Order (OCO - One Cancels Other)
 * Must have both SL and TP
 */
export function validateBracketOrder(
    entryPrice: number,
    stopLoss?: number,
    takeProfit?: number
): { valid: boolean; error?: string } {
    if (!stopLoss || !takeProfit) {
        return {
            valid: false,
            error: 'Bracket orders require both Stop Loss and Take Profit',
        };
    }

    // For long position:
    // SL must be below entry, TP must be above entry
    if (stopLoss >= entryPrice) {
        return {
            valid: false,
            error: `Stop Loss ($${stopLoss}) must be below entry price ($${entryPrice})`,
        };
    }

    if (takeProfit <= entryPrice) {
        return {
            valid: false,
            error: `Take Profit ($${takeProfit}) must be above entry price ($${entryPrice})`,
        };
    }

    // Check minimum R:R ratio (recommended 2:1 by Trading Expert)
    const rr = calculateRiskReward(entryPrice, stopLoss, takeProfit);
    if (rr < 1.0) {
        return {
            valid: false,
            error: `Risk/Reward ratio (${rr.toFixed(2)}:1) is too low. Minimum recommended: 1.0:1`,
        };
    }

    return { valid: true };
}
