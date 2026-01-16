/**
 * AdvancedMetrics Component
 * Display ATR, RVOL, VWAP
 */
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useChartStore } from '@/stores';
import { generateAdvancedMetrics } from '@/lib/market';
import type { AdvancedMetrics } from '@/types/market';
import { formatPrice } from '@/lib/format';

interface AdvancedMetricsProps {
    currentPrice: number;
}

export function AdvancedMetricsDisplay({ currentPrice }: AdvancedMetricsProps) {
    const { replayData, currentCandle, ticker } = useChartStore();

    // 🔥 FIX: Use useMemo instead of useEffect to prevent O(n) per tick
    // Only recalculate when data length changes or new candle closes
    const metrics = useMemo(() => {
        if (replayData.length === 0) return null;

        // Convert replay data to format for metrics calculation
        const candles = replayData.map((candle) => ({
            h: candle.h,
            l: candle.l,
            c: candle.c,
            v: candle.v || 100000, // default volume if not present
        }));

        return generateAdvancedMetrics(candles);
    }, [replayData.length, currentCandle?.time]); // Recalc only on new candle or data change

    if (!metrics) {
        return (
            <div className="p-3 text-xs text-[var(--text-tertiary)]">
                Loading metrics...
            </div>
        );
    }

    const rvolColor =
        metrics.rvol >= 3
            ? 'text-red-400'
            : metrics.rvol >= 1.5
                ? 'text-yellow-400'
                : 'text-green-400';

    return (
        <div className="p-3 space-y-3 bg-[var(--bg-secondary)]">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Advanced Metrics</h3>

            {/* ATR */}
            <div>
                <div className="flex items-baseline justify-between mb-1">
                    <span className="text-xs text-[var(--text-tertiary)]">ATR (14)</span>
                    <span className="text-sm font-mono font-semibold text-[var(--text-primary)]">
                        {formatPrice(metrics.atr, ticker, { roundToTickSize: true })}
                    </span>
                </div>
                <p className="text-[10px] text-[var(--text-tertiary)]">
                    Average True Range: Volatility measure
                </p>
            </div>

            {/* RVOL */}
            <div>
                <div className="flex items-baseline justify-between mb-1">
                    <span className="text-xs text-[var(--text-tertiary)]">RVOL</span>
                    <span className={`text-sm font-mono font-semibold ${rvolColor}`}>
                        {metrics.rvol.toFixed(2)}x
                    </span>
                </div>
                <p className="text-[10px] text-[var(--text-tertiary)]">
                    Relative Volume vs average
                    {metrics.rvol >= 3 && <span className="text-red-400 ml-1">⚠️ High activity</span>}
                </p>
            </div>

            {/* VWAP */}
            <div>
                <div className="flex items-baseline justify-between mb-1">
                    <span className="text-xs text-[var(--text-tertiary)]">VWAP</span>
                    <span className="text-sm font-mono font-semibold text-[var(--text-primary)]">
                        {formatPrice(metrics.vwap, ticker, { roundToTickSize: true })}
                    </span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                    <span className="text-[var(--text-tertiary)]">Current vs VWAP:</span>
                    <span className={currentPrice > metrics.vwap ? 'text-green-400' : 'text-red-400'}>
                        {currentPrice > metrics.vwap ? '↑' : '↓'}
                        {formatPrice(Math.abs(currentPrice - metrics.vwap), ticker, { roundToTickSize: true })}
                    </span>
                </div>
            </div>

            {/* Info */}
            <div className="pt-2 border-t border-[var(--bg-tertiary)] text-[10px] text-[var(--text-tertiary)]">
                <p>💡 ATR helps size positions based on volatility</p>
                <p className="mt-1">💡 RVOL \u003e 1.5 indicates above-average activity</p>
                <p className="mt-1">💡 VWAP resets daily at market open</p>
            </div>
        </div>
    );
}
