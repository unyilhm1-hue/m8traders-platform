/**
 * TradeHistory Component
 * Display chronological trade history with P&L
 */
'use client';

import { useTradingStore } from '@/stores';
import { formatIDR } from '@/lib/format';

export function TradeHistory() {
    const trades = useTradingStore((s) => s.trades);

    // Sort by timestamp descending (newest first)
    const sortedTrades = [...trades].sort((a, b) => b.timestamp - a.timestamp);

    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    if (trades.length === 0) {
        return (
            <div className="px-4 py-8 text-center border-dashed border border-[var(--bg-tertiary)] rounded-lg mx-2 bg-[var(--bg-tertiary)]/10">
                <span className="text-xs text-[var(--text-tertiary)]">No trades yet</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[var(--bg-secondary)]/30">
            {/* Header */}
            <div className="p-3 border-b border-[var(--bg-subtle-border)] flex items-center justify-between">
                <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">History</h3>
                <span className="text-[10px] text-[var(--text-tertiary)] bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded cursor-default">
                    {trades.length} Trades
                </span>
            </div>

            {/* Column Headers */}
            <div className="grid grid-cols-5 px-3 py-2 text-[10px] font-semibold text-[var(--text-tertiary)] border-b border-[var(--bg-tertiary)] uppercase tracking-wider">
                <div className="col-span-1">Time</div>
                <div className="col-span-1 text-center">Type</div>
                <div className="col-span-1 text-right">Qty</div>
                <div className="col-span-1 text-right">Price</div>
                <div className="col-span-1 text-right">P/L</div>
            </div>

            {/* Trade List */}
            <div className="flex-1 overflow-y-auto">
                {sortedTrades.map((trade) => {
                    const hasPnL = trade.realizedPnL !== undefined;
                    const pnl = trade.realizedPnL || 0;
                    const pnlColor = pnl >= 0 ? 'text-[var(--color-profit)]' : 'text-[var(--color-loss)]';
                    const typeColor = trade.type === 'BUY' ? 'text-[var(--color-profit)]' : 'text-[var(--color-loss)]';

                    return (
                        <div
                            key={trade.id}
                            className="grid grid-cols-5 px-3 py-2 text-[11px] font-mono border-b border-[var(--bg-subtle-border)] hover:bg-[var(--bg-tertiary)]/30 transition-colors cursor-default"
                        >
                            <div className="col-span-1 text-[var(--text-tertiary)] truncate">
                                {formatTime(trade.timestamp)}
                            </div>
                            <div className={`col-span-1 text-center font-bold ${typeColor}`}>
                                {trade.type}
                            </div>
                            <div className="col-span-1 text-right text-[var(--text-secondary)]">
                                {trade.shares}
                            </div>
                            <div className="col-span-1 text-right text-[var(--text-primary)]">
                                {formatIDR(trade.price, { roundToTickSize: true })}
                            </div>
                            <div className={`col-span-1 text-right font-medium ${pnlColor}`}>
                                {hasPnL ? (
                                    <>
                                        {formatIDR(pnl)}
                                    </>
                                ) : (
                                    <span className="text-[var(--text-tertiary)] opacity-30">—</span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
