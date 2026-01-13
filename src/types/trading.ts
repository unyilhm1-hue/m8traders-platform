// Trading-related type definitions

export interface Position {
    shares: number;
    avgPrice: number;
    totalCost: number;
}

export interface Trade {
    id: string;
    type: 'BUY' | 'SELL';
    shares: number;
    price: number;
    total: number;
    realizedPnL?: number;
    timestamp: number;
}

export interface TradingSession {
    id: string;
    userId: string;
    ticker: string;
    balance: number;
    startingBalance: number;
    position: Position;
    trades: Trade[];
    createdAt: Date;
    updatedAt: Date;
}

// Order Types
export type OrderType = 'MARKET' | 'LIMIT' | 'STOP' | 'BRACKET' | 'OTO';
export type OrderSide = 'BUY' | 'SELL';
export type OrderStatus = 'PENDING' | 'FILLED' | 'CANCELLED' | 'REJECTED';

export interface OrderRequest {
    type: OrderSide;
    shares: number;
    price: number;
    stopLoss?: number;
    takeProfit?: number;
}

/**
 * Pending Order - Orders waiting to be filled
 * Supports: LIMIT, STOP, BRACKET (OCO), OTO
 */
export interface PendingOrder {
    id: string;
    orderType: OrderType;
    side: OrderSide;
    shares: number;

    // Price levels
    limitPrice?: number;      // For LIMIT orders: must reach this price to execute
    stopPrice?: number;       // For STOP orders: triggers Market order when reached

    // Stop Loss / Take Profit (for BRACKET orders)
    stopLoss?: number;
    takeProfit?: number;

    // OCO (One Cancels Other) - for BRACKET orders
    ocoGroupId?: string;      // If part of OCO, share same group ID

    // OTO (Order Triggers Order)
    parentOrderId?: string;   // If this is triggered by another order
    childOrders?: string[];   // Orders that will activate when this fills

    status: OrderStatus;
    createdAt: number;
    filledAt?: number;
}

export interface OrderResult {
    success: boolean;
    error?: string;
    trade?: Trade;
    newBalance?: number;
    newPosition?: Position;
}

export interface PnL {
    absolute: number;
    percentage: number;
}

export interface TradingStats {
    balance: number;
    position: Position;
    unrealizedPnL: PnL;
    totalEquity: number;
    totalReturn: number;
    totalTrades: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
}

export interface OrderbookLevel {
    price: number;
    quantity: number;
    total: number;
}

export interface Orderbook {
    bids: OrderbookLevel[];
    asks: OrderbookLevel[];
    spread: number;
    midPrice: number;
}
