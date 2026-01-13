/**
 * PositionDisplay Component
 * Shows current position details and PnL
 */
'use client';

import { useMemo } from 'react';
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
        <div className={`space-y-6 ${className}`}>
            {/* Equity Summary */}
            <div className="space-y-4 px-2">
                <div>
                    <div className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Total Equity</div>
                    <div className="text-2xl font-bold font-mono tracking-tight">
                        ${totalEquity.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <div className="text-[10px] text-[var(--text-tertiary)] uppercase mb-1">Return</div>
                        <div className={`font-mono text-sm font-medium ${totalReturn.absolute >= 0 ? 'text-[var(--color-profit)]' : 'text-[var(--color-loss)]'}`}>
                            {formatCurrency(totalReturn.absolute)}
                        </div>
                    </div>
                    <div>
                        <div className="text-[10px] text-[var(--text-tertiary)] uppercase mb-1">% Return</div>
                        <div className={`font-mono text-sm font-medium ${totalReturn.absolute >= 0 ? 'text-[var(--color-profit)]' : 'text-[var(--color-loss)]'}`}>
                            {formatPercent(totalReturn.percentage)}
                        </div>
                    </div>
                </div>
            </div>

            <div className="h-px bg-[var(--bg-tertiary)]/50 mx-2" />

            {/* Current Position */}
            {position.shares > 0 ? (
                <div className="px-2 space-y-3">
                    <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Active Position</h4>

                    <div className="grid grid-cols-2 gap-y-3 text-sm">
                        <div>
                            <div className="text-[10px] text-[var(--text-tertiary)]">Shares</div>
                            <div className="font-mono text-[var(--text-primary)]">{position.shares}</div>
                        </div>
                        <div>
                            <div className="text-[10px] text-[var(--text-tertiary)]">Avg Price</div>
                            <div className="font-mono text-[var(--text-primary)]">${position.avgPrice.toFixed(2)}</div>
                        </div>
                        <div>
                            <div className="text-[10px] text-[var(--text-tertiary)]">Market Value</div>
                            <div className="font-mono text-[var(--text-primary)]">
                                ${(position.shares * currentPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                        </div>
                        <div>
                            <div className="text-[10px] text-[var(--text-tertiary)]">Unrealized P&L</div>
                            <div className={`font-mono font-medium ${unrealizedPnL.absolute >= 0 ? 'text-[var(--color-profit)]' : 'text-[var(--color-loss)]'}`}>
                                {formatCurrency(unrealizedPnL.absolute)}
                            </div>
                        </div>
                    </div>

                    {/* Quick PnL Percentage Tag */}
                    <div className={`mt-2 py-1 px-2 rounded text-center text-xs font-bold ${unrealizedPnL.absolute >= 0
                            ? 'bg-[var(--color-profit)]/10 text-[var(--color-profit)]'
                            : 'bg-[var(--color-loss)]/10 text-[var(--color-loss)]'
                        }`}>
                        {formatPercent(unrealizedPnL.percentage)}
                    </div>
                </div>
            ) : (
                <div className="px-4 py-8 text-center border-dashed border border-[var(--bg-tertiary)] rounded-lg mx-2 bg-[var(--bg-tertiary)]/10">
                    <span className="text-xs text-[var(--text-tertiary)]">No active position</span>
                </div>
            )}
        </div>
    );
}
