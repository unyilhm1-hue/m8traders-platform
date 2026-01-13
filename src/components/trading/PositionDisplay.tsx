/**
 * PositionDisplay Component
 * Shows current position details and PnL
 */
'use client';

import { useMemo } from 'react';
import { Card } from '@/components/ui';
import { useTradingStore } from '@/stores';

interface PositionDisplayProps {
    currentPrice: number;
    className?: string;
}

export function PositionDisplay({ currentPrice, className = '' }: PositionDisplayProps) {
    const { position, balance, startingBalance, trades } = useTradingStore();

    // Calculate unrealized PnL
    const unrealizedPnL = useMemo(() => {
        if (position.shares === 0) return { absolute: 0, percentage: 0 };

        const currentValue = position.shares * currentPrice;
        const costBasis = position.totalCost;
        const absolute = currentValue - costBasis;
        const percentage = (absolute / costBasis) * 100;

        return { absolute, percentage };
    }, [position, currentPrice]);

    // Calculate total equity
    const totalEquity = useMemo(() => {
        const positionValue = position.shares * currentPrice;
        return balance + positionValue;
    }, [balance, position, currentPrice]);

    // Total return
    const totalReturn = useMemo(() => {
        const absolute = totalEquity - startingBalance;
        const percentage = (absolute / startingBalance) * 100;
        return { absolute, percentage };
    }, [totalEquity, startingBalance]);

    // Recent trades (last 5)
    const recentTrades = useMemo(() => {
        return [...trades].reverse().slice(0, 5);
    }, [trades]);

    const formatCurrency = (value: number) => {
        const prefix = value >= 0 ? '+' : '';
        return `${prefix}$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const formatPercent = (value: number) => {
        const prefix = value >= 0 ? '+' : '';
        return `${prefix}${value.toFixed(2)}%`;
    };

    return (
        <div className={`space-y-4 ${className}`}>
            {/* Equity Card */}
            <Card>
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-[var(--text-tertiary)]">Total Equity</span>
                        <span className="font-mono font-bold text-lg">
                            ${totalEquity.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-[var(--text-tertiary)]">Total Return</span>
                        <span
                            className={`font-mono font-medium ${totalReturn.absolute >= 0 ? 'text-profit' : 'text-loss'
                                }`}
                        >
                            {formatCurrency(totalReturn.absolute)} ({formatPercent(totalReturn.percentage)})
                        </span>
                    </div>
                </div>
            </Card>

            {/* Position Card */}
            {position.shares > 0 && (
                <Card>
                    <h4 className="text-sm font-medium mb-3">Current Position</h4>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-[var(--text-tertiary)]">Shares</span>
                            <span data-testid="position-shares" className="font-mono">{position.shares}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[var(--text-tertiary)]">Avg Price</span>
                            <span className="font-mono">${position.avgPrice.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[var(--text-tertiary)]">Market Value</span>
                            <span className="font-mono">
                                ${(position.shares * currentPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="flex justify-between pt-2 border-t border-[var(--bg-tertiary)]">
                            <span className="text-[var(--text-tertiary)]">Unrealized P&L</span>
                            <span
                                className={`font-mono font-medium ${unrealizedPnL.absolute >= 0 ? 'text-profit' : 'text-loss'
                                    }`}
                            >
                                {formatCurrency(unrealizedPnL.absolute)} ({formatPercent(unrealizedPnL.percentage)})
                            </span>
                        </div>
                    </div>
                </Card>
            )}

            {/* Trade History */}
            {recentTrades.length > 0 && (
                <Card>
                    <h4 className="text-sm font-medium mb-3">Recent Trades</h4>
                    <ul data-testid="trade-history" className="space-y-2">
                        {recentTrades.map((trade) => (
                            <li
                                key={trade.id}
                                className="flex justify-between items-center text-xs"
                            >
                                <div className="flex items-center gap-2">
                                    <span
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${trade.type === 'BUY'
                                                ? 'bg-[var(--color-profit)]/20 text-[var(--color-profit)]'
                                                : 'bg-[var(--color-loss)]/20 text-[var(--color-loss)]'
                                            }`}
                                    >
                                        {trade.type}
                                    </span>
                                    <span className="text-[var(--text-secondary)]">
                                        {trade.shares} @ ${trade.price.toFixed(2)}
                                    </span>
                                </div>
                                {trade.realizedPnL !== undefined && (
                                    <span
                                        className={`font-mono ${trade.realizedPnL >= 0 ? 'text-profit' : 'text-loss'
                                            }`}
                                    >
                                        {formatCurrency(trade.realizedPnL)}
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                </Card>
            )}
        </div>
    );
}
