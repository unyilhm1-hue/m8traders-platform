/**
 * Market Data Types
 * Level 2, Time & Sales, and Advanced Metrics
 */

// Level 2 Order Book
export interface OrderBookLevel {
    price: number;
    quantity: number;
    orders: number; // number of orders at this price level
}

export interface OrderBook {
    bids: OrderBookLevel[];
    asks: OrderBookLevel[];
    spread: number;
    spreadPercent: number;
    midPrice: number;
    timestamp: number;
}

// Time & Sales (Tape)
export type TradeCondition = 'regular' | 'block' | 'odd-lot';
export type TradeSide = 'buy' | 'sell' | 'between';

export interface TimeAndSalesEntry {
    id: string;
    timestamp: number;
    price: number;
    size: number;
    side: TradeSide;
    condition: TradeCondition;
}

// Advanced Metrics
export interface AdvancedMetrics {
    atr: number;        // Average True Range
    rvol: number;       // Relative Volume
    vwap: number;       // Volume Weighted Average Price
    timestamp: number;
}
