/**
 * OrderPanel Component
 * Buy/Sell order form
 */
'use client';

import { useState, useCallback } from 'react';
import { Button, Input, Card } from '@/components/ui';
import { useTradingStore } from '@/stores';

interface OrderPanelProps {
    currentPrice: number;
    className?: string;
}

export function OrderPanel({ currentPrice, className = '' }: OrderPanelProps) {
    const [shares, setShares] = useState('');
    const [error, setError] = useState<string | null>(null);

    const { balance, position, executeTrade } = useTradingStore();

    const sharesNum = parseInt(shares) || 0;
    const orderValue = sharesNum * currentPrice;
    const maxBuyShares = Math.floor(balance / currentPrice);

    const handleBuy = useCallback(() => {
        setError(null);

        if (sharesNum <= 0) {
            setError('Masukkan jumlah saham');
            return;
        }

        const result = executeTrade(
            { type: 'BUY', shares: sharesNum, price: currentPrice },
            currentPrice
        );

        if (!result.success) {
            setError(result.error || 'Gagal membeli');
        } else {
            setShares('');
        }
    }, [sharesNum, currentPrice, executeTrade]);

    const handleSell = useCallback(() => {
        setError(null);

        if (sharesNum <= 0) {
            setError('Masukkan jumlah saham');
            return;
        }

        const result = executeTrade(
            { type: 'SELL', shares: sharesNum, price: currentPrice },
            currentPrice
        );

        if (!result.success) {
            setError(result.error || 'Gagal menjual');
        } else {
            setShares('');
        }
    }, [sharesNum, currentPrice, executeTrade]);

    const handleMaxBuy = () => {
        setShares(maxBuyShares.toString());
    };

    const handleMaxSell = () => {
        setShares(position.shares.toString());
    };

    return (
        <Card className={className}>
            <div className="space-y-4">
                {/* Price Display */}
                <div className="text-center pb-3 border-b border-[var(--bg-tertiary)]">
                    <p className="text-xs text-[var(--text-tertiary)] mb-1">Current Price</p>
                    <p className="text-2xl font-bold font-mono text-[var(--text-primary)]">
                        ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                </div>

                {/* Balance & Position */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                        <p className="text-xs text-[var(--text-tertiary)]">Balance</p>
                        <p className="font-mono font-medium">
                            ${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-[var(--text-tertiary)]">Position</p>
                        <p className="font-mono font-medium">
                            {position.shares > 0 ? (
                                <>
                                    {position.shares} @ ${position.avgPrice.toFixed(2)}
                                </>
                            ) : (
                                'No position'
                            )}
                        </p>
                    </div>
                </div>

                {/* Shares Input */}
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Input
                            type="number"
                            placeholder="Shares"
                            value={shares}
                            onChange={(e) => setShares(e.target.value)}
                            data-testid="shares-input"
                            className="flex-1"
                        />
                        <Button variant="ghost" size="sm" onClick={handleMaxBuy}>
                            Max Buy
                        </Button>
                    </div>

                    {sharesNum > 0 && (
                        <p className="text-xs text-[var(--text-tertiary)]">
                            Order Value: ${orderValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                    )}
                </div>

                {/* Error Message */}
                {error && (
                    <p
                        data-testid="error-message"
                        className="text-xs text-[var(--color-loss)] bg-[var(--color-loss)]/10 px-3 py-2 rounded"
                    >
                        {error}
                    </p>
                )}

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3">
                    <Button
                        variant="profit"
                        fullWidth
                        onClick={handleBuy}
                        disabled={sharesNum <= 0 || orderValue > balance}
                        data-testid="buy-button"
                    >
                        Buy
                    </Button>
                    <Button
                        variant="loss"
                        fullWidth
                        onClick={handleSell}
                        disabled={sharesNum <= 0 || sharesNum > position.shares}
                        data-testid="sell-button"
                    >
                        Sell
                    </Button>
                </div>

                {/* Quick Actions */}
                {position.shares > 0 && (
                    <div className="pt-3 border-t border-[var(--bg-tertiary)]">
                        <Button
                            variant="outline"
                            size="sm"
                            fullWidth
                            onClick={handleMaxSell}
                        >
                            Close Position ({position.shares} shares)
                        </Button>
                    </div>
                )}
            </div>
        </Card>
    );
}
