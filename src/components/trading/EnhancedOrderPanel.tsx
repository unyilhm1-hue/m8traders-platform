/**
 * EnhancedOrderPanel Component
 * Advanced order entry with support for Market, Limit, Stop, and Bracket orders
 */
'use client';

import { useState, useCallback } from 'react';
import { Button, Input, Card } from '@/components/ui';
import { Select } from '@/components/ui/Select';
import { useTradingStore } from '@/stores';
import type { OrderType } from '@/types';
import { calculateRiskReward } from '@/lib/trading';

interface EnhancedOrderPanelProps {
    currentPrice: number;
    className?: string;
}

export function EnhancedOrderPanel({ currentPrice, className = '' }: EnhancedOrderPanelProps) {
    const [orderType, setOrderType] = useState<OrderType>('MARKET');
    const [shares, setShares] = useState('');
    const [limitPrice, setLimitPrice] = useState('');
    const [stopPrice, setStopPrice] = useState('');
    const [stopLoss, setStopLoss] = useState('');
    const [takeProfit, setTakeProfit] = useState('');
    const [error, setError] = useState<string | null>(null);

    const { balance, position, executeTrade, placePendingOrder } = useTradingStore();

    const sharesNum = parseInt(shares) || 0;
    const limitPriceNum = parseFloat(limitPrice) || currentPrice;
    const stopPriceNum = parseFloat(stopPrice) || 0;
    const stopLossNum = parseFloat(stopLoss) || 0;
    const takeProfitNum = parseFloat(takeProfit) || 0;

    const orderValue = sharesNum * (orderType === 'LIMIT' ? limitPriceNum : currentPrice);
    const maxBuyShares = Math.floor(balance / currentPrice);

    // Calculate R:R for bracket orders
    const riskReward =
        orderType === 'BRACKET' && stopLossNum && takeProfitNum
            ? calculateRiskReward(limitPriceNum, stopLossNum, takeProfitNum)
            : 0;

    const handlePlaceOrder = useCallback(() => {
        setError(null);

        if (sharesNum <= 0) {
            setError('Enter number of shares');
            return;
        }

        // Market order - immediate execution
        if (orderType === 'MARKET') {
            const result = executeTrade(
                { type: 'BUY', shares: sharesNum, price: currentPrice },
                currentPrice
            );

            if (!result.success) {
                setError(result.error || 'Failed to execute');
            } else {
                setShares('');
            }
            return;
        }

        // Pending orders
        if (orderType === 'LIMIT') {
            if (!limitPrice) {
                setError('Enter limit price');
                return;
            }

            const result = placePendingOrder('LIMIT', 'BUY', sharesNum, limitPriceNum);
            if (!result.success) {
                setError(result.error || 'Failed to place order');
            } else {
                setShares('');
                setLimitPrice('');
            }
            return;
        }

        if (orderType === 'STOP') {
            if (!stopPrice) {
                setError('Enter stop price');
                return;
            }

            const result = placePendingOrder('STOP', 'SELL', sharesNum, undefined, stopPriceNum);
            if (!result.success) {
                setError(result.error || 'Failed to place order');
            } else {
                setShares('');
                setStopPrice('');
            }
            return;
        }

        if (orderType === 'BRACKET') {
            if (!limitPrice || !stopLoss || !takeProfit) {
                setError('Bracket orders require Entry, SL, and TP prices');
                return;
            }

            const result = placePendingOrder(
                'BRACKET',
                'BUY',
                sharesNum,
                limitPriceNum,
                undefined,
                stopLossNum,
                takeProfitNum
            );
            if (!result.success) {
                setError(result.error || 'Failed to place bracket order');
            } else {
                setShares('');
                setLimitPrice('');
                setStopLoss('');
                setTakeProfit('');
            }
            return;
        }
    }, [
        orderType,
        sharesNum,
        limitPriceNum,
        stopPriceNum,
        stopLossNum,
        takeProfitNum,
        currentPrice,
        executeTrade,
        placePendingOrder,
        limitPrice,
        stopPrice,
        stopLoss,
        takeProfit,
    ]);

    const handleQuickSell = useCallback(() => {
        if (position.shares === 0) return;

        const result = executeTrade(
            { type: 'SELL', shares: position.shares, price: currentPrice },
            currentPrice
        );

        if (!result.success) {
            setError(result.error || 'Failed to sell');
        }
    }, [position.shares, currentPrice, executeTrade]);

    return (
        <Card className={className}>
            <div className="space-y-3">
                {/* Order Type Selector */}
                {/* Order Type Selector */}
                <div>
                    <label className="block text-xs text-[var(--text-tertiary)] mb-1.5">Order Type</label>
                    <Select
                        value={orderType}
                        onChange={(val) => setOrderType(val as OrderType)}
                        options={[
                            { label: 'Market Order', value: 'MARKET' },
                            { label: 'Limit Order', value: 'LIMIT' },
                            { label: 'Stop Order', value: 'STOP' },
                            { label: 'Bracket (OCO)', value: 'BRACKET' },
                        ]}
                        className="w-full"
                    />
                </div>

                {/* Shares Input */}
                <div>
                    <label className="block text-xs text-[var(--text-tertiary)] mb-1.5">Shares</label>
                    <div className="flex gap-2">
                        <Input
                            type="number"
                            placeholder="100"
                            value={shares}
                            onChange={(e) => setShares(e.target.value)}
                            className="flex-1"
                        />
                        <Button variant="ghost" size="sm" onClick={() => setShares(maxBuyShares.toString())}>
                            Max
                        </Button>
                    </div>
                </div>

                {/* Conditional Inputs based on Order Type */}
                {(orderType === 'LIMIT' || orderType === 'BRACKET') && (
                    <div>
                        <label className="block text-xs text-[var(--text-tertiary)] mb-1.5">
                            {orderType === 'BRACKET' ? 'Entry Price' : 'Limit Price'}
                        </label>
                        <Input
                            type="number"
                            placeholder={currentPrice.toFixed(2)}
                            value={limitPrice}
                            onChange={(e) => setLimitPrice(e.target.value)}
                            step="0.01"
                        />
                    </div>
                )}

                {orderType === 'STOP' && (
                    <div>
                        <label className="block text-xs text-[var(--text-tertiary)] mb-1.5">Stop Price</label>
                        <Input
                            type="number"
                            placeholder="Stop price"
                            value={stopPrice}
                            onChange={(e) => setStopPrice(e.target.value)}
                            step="0.01"
                        />
                    </div>
                )}

                {orderType === 'BRACKET' && (
                    <>
                        <div>
                            <label className="block text-xs text-[var(--text-tertiary)] mb-1.5">
                                Stop Loss (SL)
                            </label>
                            <Input
                                type="number"
                                placeholder="Stop loss price"
                                value={stopLoss}
                                onChange={(e) => setStopLoss(e.target.value)}
                                step="0.01"
                            />
                        </div>

                        <div>
                            <label className="block text-xs text-[var(--text-tertiary)] mb-1.5">
                                Take Profit (TP)
                            </label>
                            <Input
                                type="number"
                                placeholder="Take profit price"
                                value={takeProfit}
                                onChange={(e) => setTakeProfit(e.target.value)}
                                step="0.01"
                            />
                        </div>

                        {/* R:R Display */}
                        {riskReward > 0 && (
                            <div className="p-2 rounded bg-[var(--bg-tertiary)] text-xs">
                                <span className="text-[var(--text-tertiary)]">Risk/Reward: </span>
                                <span
                                    className={`font-semibold ${riskReward >= 2 ? 'text-green-400' : riskReward >= 1 ? 'text-yellow-400' : 'text-red-400'
                                        }`}
                                >
                                    {riskReward.toFixed(2)}:1
                                </span>
                                {riskReward < 1 && (
                                    <span className="text-red-400 ml-2">⚠️ Low R:R</span>
                                )}
                            </div>
                        )}
                    </>
                )}

                {/* Order Value */}
                {sharesNum > 0 && (
                    <div className="text-xs text-[var(--text-tertiary)]">
                        Order Value: ${orderValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <p className="text-xs text-[var(--color-loss)] bg-[var(--color-loss)]/10 px-3 py-2 rounded">
                        {error}
                    </p>
                )}

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3">
                    <Button
                        variant="profit"
                        fullWidth
                        onClick={handlePlaceOrder}
                        disabled={sharesNum <= 0 || (orderType === 'MARKET' && orderValue > balance)}
                    >
                        {orderType === 'MARKET' ? 'Buy' : 'Place Order'}
                    </Button>
                    <Button
                        variant="loss"
                        fullWidth
                        onClick={handleQuickSell}
                        disabled={position.shares === 0}
                    >
                        Sell All
                    </Button>
                </div>
            </div>
        </Card>
    );
}
