/**
 * Level2OrderBook Component
 * Display bid/ask depth with volume visualization
 */
'use client';

import { useEffect, useState } from 'react';
import { useChartStore } from '@/stores';
import { generateOrderbook, type OrderbookSnapshot } from '@/lib/market/orderbookGenerator';
import { calculateATR } from '@/lib/market/calculateATR';
import { formatPrice, formatPercent } from '@/lib/format';

interface Level2OrderBookProps {
    currentPrice?: number; // Optional, will use store if not provided
}

export function Level2OrderBook({ currentPrice: priceOverride }: Level2OrderBookProps) {
    const { currentCandle, replayData, ticker } = useChartStore();
    const [orderBook, setOrderBook] = useState<OrderbookSnapshot | null>(null);

    useEffect(() => {
        if (!currentCandle || replayData.length === 0) {
            setOrderBook(null);
            return;
        }

        // Calculate ATR from last 14 candles (or available candles)
        const atr = calculateATR(replayData.slice(-14), 14);

        // Generate orderbook from current candle
        const snapshot = generateOrderbook(currentCandle, {
            atr,
            numLevels: 10,
            baseSpreadTicks: 2.5,
        });

        setOrderBook(snapshot);
    }, [currentCandle, replayData]);

    if (!orderBook) {
        return (
            <div className="h-full flex flex-col bg-[var(--bg-secondary)]">
                <div className="p-3 border-b border-[var(--bg-tertiary)]">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">Level 2</h3>
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">Waiting for data...</p>
                </div>
            </div>
        );
    }

    const maxBidQty = Math.max(...orderBook.bids.map((b) => b.quantity));
    const maxAskQty = Math.max(...orderBook.asks.map((a) => a.quantity));
    const maxQty = Math.max(maxBidQty, maxAskQty);

    return (
        <div className="h-full flex flex-col bg-[var(--bg-secondary)]">
            {/* Header */}
            <div className="p-3 border-b border-[var(--bg-tertiary)]">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Level 2</h3>
                <div className="mt-1 flex items-baseline gap-2 text-xs">
                    <span className="text-[var(--text-tertiary)]">Spread:</span>
                    <span className="text-[var(--text-primary)] font-mono">
                        {formatPrice(orderBook.spread, ticker, { roundToTickSize: true })}
                    </span>
                    <span className="text-[var(--text-tertiary)]">
                        ({formatPercent(orderBook.spreadPercent / 100, 3)})
                    </span>
                </div>
            </div>

            {/* Order Book */}
            <div className="flex-1 overflow-y-auto">
                {/* Asks (sell orders - descending) */}
                <div className="border-b border-[var(--bg-tertiary)] pb-2">
                    <div className="grid grid-cols-3 gap-2 px-3 py-1.5 text-xs font-semibold text-[var(--text-tertiary)] border-b border-[var(--bg-tertiary)]">
                        <div className="text-right">Price</div>
                        <div className="text-right">Size</div>
                        <div className="text-right">Total</div>
                    </div>
                    {orderBook.asks.slice().reverse().map((ask, idx) => {
                        const percent = (ask.quantity / maxQty) * 100;
                        return (
                            <div
                                key={`ask-${idx}`}
                                className="relative grid grid-cols-3 gap-2 px-3 py-1 text-xs font-mono"
                            >
                                <div
                                    className="absolute right-0 top-0 bottom-0 bg-red-500/10"
                                    style={{ width: `${percent}%` }}
                                />
                                <div className="relative text-right text-red-400">{formatPrice(ask.price, ticker, { roundToTickSize: true })}</div>
                                <div className="relative text-right text-[var(--text-primary)]">
                                    {ask.quantity.toLocaleString()}
                                </div>
                                <div className="relative text-right text-[var(--text-secondary)]">
                                    {ask.orders}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Spread Indicator */}
                <div className="py-2 px-3 bg-[var(--bg-tertiary)] flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--text-primary)]">
                        Spread: {formatPrice(orderBook.spread, ticker, { roundToTickSize: true })}
                    </span>
                    <span className="text-xs text-[var(--text-tertiary)]">
                        Mid: {formatPrice(orderBook.midPrice, ticker, { roundToTickSize: true })}
                    </span>
                </div>

                {/* Bids (buy orders - descending) */}
                <div className="pt-2">
                    {orderBook.bids.map((bid, idx) => {
                        const percent = (bid.quantity / maxQty) * 100;
                        return (
                            <div
                                key={`bid-${idx}`}
                                className="relative grid grid-cols-3 gap-2 px-3 py-1 text-xs font-mono"
                            >
                                <div
                                    className="absolute right-0 top-0 bottom-0 bg-green-500/10"
                                    style={{ width: `${percent}%` }}
                                />
                                <div className="relative text-right text-green-400">{formatPrice(bid.price, ticker, { roundToTickSize: true })}</div>
                                <div className="relative text-right text-[var(--text-primary)]">
                                    {bid.quantity.toLocaleString()}
                                </div>
                                <div className="relative text-right text-[var(--text-secondary)]">
                                    {bid.orders}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
