/**
 * Psychological Analytics Dashboard Component
 * Displays AI-powered trading psychology insights
 */
'use client';

import { useMemo } from 'react';
import { useTradingStore } from '@/stores';
import { analyzeTradingPsychology, type Trade } from '@/utils/tradeAnalytics';
import { AlertTriangle, TrendingUp, Brain, CheckCircle } from 'lucide-react';

export function PsychologicalAnalytics() {
    const trades = useTradingStore((s) => s.trades);

    // Convert store trades to analytics format
    const analyticsData: Trade[] = useMemo(() => {
        return trades.map(t => ({
            id: t.id,
            type: t.type,
            shares: t.shares,
            price: t.price,
            timestamp: t.timestamp,
            realizedPnL: t.realizedPnL,
            duration: t.duration,
            symbol: t.symbol || 'Unknown',
            timeframe: t.timeframe || '1m'
        }));
    }, [trades]);

    const analysis = useMemo(() => {
        return analyzeTradingPsychology(analyticsData);
    }, [analyticsData]);

    if (trades.length === 0) {
        return (
            <div className="p-6 text-center border-dashed border border-[var(--bg-tertiary)] rounded-lg bg-[var(--bg-tertiary)]/10">
                <Brain className="w-8 h-8 mx-auto mb-2 text-[var(--text-tertiary)] opacity-50" />
                <p className="text-sm text-[var(--text-tertiary)]">
                    Psychological analysis akan tersedia setelah Anda melakukan trading
                </p>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-4 bg-[var(--bg-secondary)]">
            {/* Header */}
            <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-400" />
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                    Psychological Analysis
                </h3>
            </div>

            {/* Pattern Indicators */}
            <div className="grid grid-cols-3 gap-3">
                {/* Revenge Trading */}
                <div className={`p-3 rounded ${analysis.hasRevengeTradingPattern
                        ? 'bg-red-500/10 border border-red-500/30'
                        : 'bg-green-500/10 border border-green-500/30'
                    }`}>
                    {analysis.hasRevengeTradingPattern ? (
                        <>
                            <AlertTriangle className="w-4 h-4 text-red-400 mb-1" />
                            <p className="text-xs font-semibold text-red-400">Revenge Trading</p>
                            <p className="text-[10px] text-red-300/70 mt-1">Detected</p>
                        </>
                    ) : (
                        <>
                            <CheckCircle className="w-4 h-4 text-green-400 mb-1" />
                            <p className="text-xs font-semibold text-green-400">Revenge Trading</p>
                            <p className="text-[10px] text-green-300/70 mt-1">Clear</p>
                        </>
                    )}
                </div>

                {/* Best Timeframe */}
                <div className="p-3 rounded bg-blue-500/10 border border-blue-500/30">
                    <TrendingUp className="w-4 h-4 text-blue-400 mb-1" />
                    <p className="text-xs font-semibold text-blue-400">Best Timeframe</p>
                    <p className="text-[10px] text-blue-300/70 mt-1">
                        {analysis.bestTimeframe || 'Analyzing...'}
                    </p>
                </div>

                {/* Cut Profit Early */}
                <div className={`p-3 rounded ${analysis.hasCutProfitEarlyPattern
                        ? 'bg-yellow-500/10 border border-yellow-500/30'
                        : 'bg-green-500/10 border border-green-500/30'
                    }`}>
                    {analysis.hasCutProfitEarlyPattern ? (
                        <>
                            <AlertTriangle className="w-4 h-4 text-yellow-400 mb-1" />
                            <p className="text-xs font-semibold text-yellow-400">Cut Profit Early</p>
                            <p className="text-[10px] text-yellow-300/70 mt-1">Detected</p>
                        </>
                    ) : (
                        <>
                            <CheckCircle className="w-4 h-4 text-green-400 mb-1" />
                            <p className="text-xs font-semibold text-green-400">Cut Profit Early</p>
                            <p className="text-[10px] text-green-300/70 mt-1">Not Detected</p>
                        </>
                    )}
                </div>
            </div>

            {/* AI Recommendations */}
            <div className="space-y-2">
                <h4 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                    <Brain className="w-4 h-4" />
                    AI Recommendations
                </h4>

                <div className="space-y-2">
                    {analysis.recommendations.map((rec, idx) => {
                        const isWarning = rec.includes('⚠️');
                        const isSuccess = rec.includes('✅');

                        return (
                            <div
                                key={idx}
                                className={`p-3 rounded text-xs ${isWarning
                                        ? 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-200'
                                        : isSuccess
                                            ? 'bg-green-500/10 border border-green-500/30 text-green-200'
                                            : 'bg-blue-500/10 border border-blue-500/30 text-blue-200'
                                    }`}
                            >
                                {rec}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Pro Tip */}
            <div className="mt-4 p-3 rounded bg-purple-500/10 border border-purple-500/30">
                <p className="text-xs text-purple-200">
                    💡 <span className="font-semibold">Pro Tip:</span> Trading psychology is as important as technical analysis.
                    Monitor these patterns to improve your discipline and profitability.
                </p>
            </div>
        </div>
    );
}
