/**
 * PerformanceStats Component
 * Display comprehensive trading performance metrics
 */
'use client';

import { useTradingStore } from '@/stores';
import { formatIDR, formatPercent } from '@/lib/format';

export function PerformanceStats() {
    const stats = useTradingStore((s) => s.stats);
    const trades = useTradingStore((s) => s.trades);

    const completedTrades = trades.filter((t) => t.realizedPnL !== undefined);
    const winningTrades = completedTrades.filter((t) => (t.realizedPnL || 0) > 0);
    const losingTrades = completedTrades.filter((t) => (t.realizedPnL || 0) < 0);

    const totalPnL = completedTrades.reduce((sum, t) => sum + (t.realizedPnL || 0), 0);
    const largestWin = Math.max(...winningTrades.map((t) => t.realizedPnL || 0), 0);
    const largestLoss = Math.min(...losingTrades.map((t) => t.realizedPnL || 0), 0);

    const consecutiveWins = calculateConsecutive(completedTrades, true);
    const consecutiveLosses = calculateConsecutive(completedTrades, false);

    return (
        <div className="p-4 space-y-4 bg-[var(--bg-secondary)]">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Performance Analytics</h3>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-3">
                {/* Total P&L */}
                <div className="p-3 rounded bg-[var(--bg-tertiary)]">
                    <p className="text-xs text-[var(--text-tertiary)] mb-1">Total P&L</p>
                    <p
                        className={`text-2xl font-bold font-mono ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}
                    >
                        {formatIDR(totalPnL)}
                    </p>
                </div>

                {/* Return % */}
                <div className="p-3 rounded bg-[var(--bg-tertiary)]">
                    <p className="text-xs text-[var(--text-tertiary)] mb-1">Total Return</p>
                    <p
                        className={`text-2xl font-bold font-mono ${stats.totalReturn >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}
                    >
                        {formatPercent(stats.totalReturn / 100)}
                    </p>
                </div>

                {/* Win Rate */}
                <div className="p-3 rounded bg-[var(--bg-tertiary)]">
                    <p className="text-xs text-[var(--text-tertiary)] mb-1">Win Rate</p>
                    <p className="text-xl font-bold font-mono text-[var(--text-primary)]">
                        {stats.winRate.toFixed(1)}%
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">
                        {winningTrades.length}W / {losingTrades.length}L
                    </p>
                </div>

                {/* Profit Factor */}
                <div className="p-3 rounded bg-[var(--bg-tertiary)]">
                    <p className="text-xs text-[var(--text-tertiary)] mb-1">Profit Factor</p>
                    <p
                        className={`text-xl font-bold font-mono ${stats.profitFactor >= 2
                            ? 'text-green-400'
                            : stats.profitFactor >= 1
                                ? 'text-yellow-400'
                                : 'text-red-400'
                            }`}
                    >
                        {stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">
                        {stats.profitFactor >= 2 ? 'Excellent' : stats.profitFactor >= 1 ? 'Good' : 'Poor'}
                    </p>
                </div>
            </div>

            {/* Detailed Stats */}
            <div className="space-y-2">
                <h4 className="text-sm font-semibold text-[var(--text-primary)]">Detailed Breakdown</h4>

                <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between p-2 rounded bg-[var(--bg-tertiary)]">
                        <span className="text-[var(--text-tertiary)]">Avg Win:</span>
                        <span className="font-mono text-green-400">{formatIDR(stats.avgWin)}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-[var(--bg-tertiary)]">
                        <span className="text-[var(--text-tertiary)]">Avg Loss:</span>
                        <span className="font-mono text-red-400">{formatIDR(Math.abs(stats.avgLoss))}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-[var(--bg-tertiary)]">
                        <span className="text-[var(--text-tertiary)]">Largest Win:</span>
                        <span className="font-mono text-green-400">{formatIDR(largestWin)}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-[var(--bg-tertiary)]">
                        <span className="text-[var(--text-tertiary)]">Largest Loss:</span>
                        <span className="font-mono text-red-400">{formatIDR(Math.abs(largestLoss))}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-[var(--bg-tertiary)]">
                        <span className="text-[var(--text-tertiary)]">Best Streak:</span>
                        <span className="font-mono text-green-400">{consecutiveWins}W</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-[var(--bg-tertiary)]">
                        <span className="text-[var(--text-tertiary)]">Worst Streak:</span>
                        <span className="font-mono text-red-400">{consecutiveLosses}L</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Calculate longest consecutive wins/losses
 */
function calculateConsecutive(trades: Array<{ realizedPnL?: number }>, isWin: boolean): number {
    let maxStreak = 0;
    let currentStreak = 0;

    for (const trade of trades) {
        const pnl = trade.realizedPnL || 0;
        const matchesCondition = isWin ? pnl > 0 : pnl < 0;

        if (matchesCondition) {
            currentStreak++;
            maxStreak = Math.max(maxStreak, currentStreak);
        } else {
            currentStreak = 0;
        }
    }

    return maxStreak;
}
