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

export interface OrderRequest {
    type: 'BUY' | 'SELL';
    shares: number;
    price: number;
    stopLoss?: number;
    takeProfit?: number;
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
