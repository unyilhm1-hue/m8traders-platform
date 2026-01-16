/**
 * TimeAndSales Component  
 * Display real-time trade tape with buy/sell color coding
 * Connected to simulation store for tick-level trade data
 */
'use client';

import { useRef, useEffect, useMemo } from 'react';
import { useRecentTrades } from '@/stores/useSimulationStore';

interface TimeAndSalesProps {
    currentPrice?: number; // Optional, for compatibility
}

export function TimeAndSales({ currentPrice: priceOverride }: TimeAndSalesProps) {
    // ✅ Subscribe to trade history from simulation store
    const trades = useRecentTrades();
    const containerRef = useRef<HTMLDivElement>(null);

    // 🔥 FIX: Virtualize rendering - limit to visible viewport (~30 rows)
    // Prevents full list re-render causing jank at high tick rates
    const visibleTrades = useMemo(() => trades.slice(0, 30), [trades]);

    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        });
    };

    if (visibleTrades.length === 0) {
        return (
            <div className="h-full flex flex-col bg-[var(--bg-secondary)]">
                <div className="p-3 border-b border-[var(--bg-tertiary)]">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">Time & Sales</h3>
                    <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Waiting for trades...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-[var(--bg-secondary)]">
            {/* Header */}
            <div className="p-3 border-b border-[var(--bg-tertiary)]">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Time & Sales</h3>
                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                    Tape Reading · {trades.length} trades ({visibleTrades.length} visible)
                </p>
            </div>

            {/* Column Headers */}
            <div className="grid grid-cols-4 gap-2 px-3 py-1.5 text-xs font-semibold text-[var(--text-tertiary)] border-b border-[var(--bg-tertiary)]">
                <div>Time</div>
                <div className="text-right">Price</div>
                <div className="text-right">Size</div>
                <div className="text-center">Side</div>
            </div>

            {/* Entries (scrollable) */}
            <div ref={containerRef} className="flex-1 overflow-y-auto" style={{ scrollSnapType: 'y proximity' }}>
                {visibleTrades.map((trade, idx) => {
                    const sideColor =
                        trade.side === 'buy'
                            ? 'text-green-400'
                            : trade.side === 'sell'
                                ? 'text-red-400'
                                : 'text-[var(--text-tertiary)]';

                    // Detect block trades (large volume)
                    const isBlockTrade = trade.volume > 5000;

                    return (
                        <div
                            key={`${trade.timestamp}-${idx}`}
                            className={`grid grid-cols-4 gap-2 px-3 py-1.5 text-xs font-mono border-b border-[var(--bg-tertiary)]/50 hover:bg-[var(--bg-tertiary)] transition-colors ${isBlockTrade ? 'bg-yellow-500/5' : ''
                                }`}
                        >
                            <div className="text-[var(--text-tertiary)] text-[10px]">
                                {formatTime(trade.timestamp)}
                            </div>
                            <div className={`text-right ${sideColor} font-semibold`}>
                                {trade.price.toLocaleString('id-ID')}
                            </div>
                            <div className="text-right text-[var(--text-primary)]">
                                {trade.volume.toLocaleString()}
                                {isBlockTrade && <span className="ml-1 text-yellow-400">📦</span>}
                            </div>
                            <div className={`text-center ${sideColor}`}>
                                {trade.side === 'buy' ? '↑' : trade.side === 'sell' ? '↓' : '•'}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
