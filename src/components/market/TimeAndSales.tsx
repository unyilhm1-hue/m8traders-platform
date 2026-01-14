/**
 * TimeAndSales Component  
 * Display real-time tape with buy/sell color coding
 */
'use client';

import { useEffect, useState, useRef } from 'react';
import { useChartStore } from '@/stores';
import type { Candle } from '@/types';
import { formatPrice } from '@/lib/format';

interface TimeAndSalesProps {
    currentPrice?: number; // Optional, will use store if not provided
}

interface TimeAndSalesEntry {
    id: string;
    timestamp: number;
    price: number;
    size: number;
    side: 'buy' | 'sell' | 'neutral';
    condition?: 'block' | 'normal';
}

export function TimeAndSales({ currentPrice: priceOverride }: TimeAndSalesProps) {
    const { currentCandle, ticker } = useChartStore();
    const [entries, setEntries] = useState<TimeAndSalesEntry[]>([]);
    const previousCandleRef = useRef<Candle | null>(null);

    useEffect(() => {
        if (!currentCandle) return;

        const previousCandle = previousCandleRef.current;

        // Determine side based on price movement
        let side: 'buy' | 'sell' | 'neutral' = 'neutral';
        if (previousCandle) {
            if (currentCandle.c > previousCandle.c) {
                side = 'buy';
            } else if (currentCandle.c < previousCandle.c) {
                side = 'sell';
            }
        }

        // Calculate size from volume delta
        const volumeDelta = previousCandle
            ? Math.abs(currentCandle.v - previousCandle.v)
            : currentCandle.v;

        // Determine if this is a block trade (unusually large volume)
        const avgVolume = currentCandle.v / 20; // Assume 20 ticks per candle
        const isBlockTrade = volumeDelta > avgVolume * 5;

        // Create new entry
        const newEntry: TimeAndSalesEntry = {
            id: `${currentCandle.t}-${currentCandle.c}`,
            timestamp: currentCandle.t,
            price: currentCandle.c,
            size: Math.round(volumeDelta),
            side,
            condition: isBlockTrade ? 'block' : 'normal',
        };

        // Add new entry and keep only last 50
        setEntries((prev) => {
            // Avoid duplicates (same timestamp and price)
            if (prev.length > 0 && prev[0].id === newEntry.id) {
                return prev;
            }
            return [newEntry, ...prev.slice(0, 49)];
        });

        // Update reference
        previousCandleRef.current = currentCandle;
    }, [currentCandle]);

    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        });
    };

    if (entries.length === 0) {
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
                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Tape Reading</p>
            </div>

            {/* Column Headers */}
            <div className="grid grid-cols-4 gap-2 px-3 py-1.5 text-xs font-semibold text-[var(--text-tertiary)] border-b border-[var(--bg-tertiary)]">
                <div>Time</div>
                <div className="text-right">Price</div>
                <div className="text-right">Size</div>
                <div className="text-center">Side</div>
            </div>

            {/* Entries */}
            <div className="flex-1 overflow-y-auto">
                {entries.map((entry) => {
                    const sideColor =
                        entry.side === 'buy'
                            ? 'text-green-400'
                            : entry.side === 'sell'
                                ? 'text-red-400'
                                : 'text-[var(--text-tertiary)]';

                    const isBlockTrade = entry.condition === 'block';

                    return (
                        <div
                            key={entry.id}
                            className={`grid grid-cols-4 gap-2 px-3 py-1.5 text-xs font-mono border-b border-[var(--bg-tertiary)]/50 hover:bg-[var(--bg-tertiary)] ${isBlockTrade ? 'bg-yellow-500/5' : ''
                                }`}
                        >
                            <div className="text-[var(--text-tertiary)] text-[10px]">
                                {formatTime(entry.timestamp)}
                            </div>
                            <div className={`text-right ${sideColor} font-semibold`}>
                                {formatPrice(entry.price, ticker, { roundToTickSize: true })}
                            </div>
                            <div className="text-right text-[var(--text-primary)]">
                                {entry.size.toLocaleString()}
                                {isBlockTrade && <span className="ml-1 text-yellow-400">📦</span>}
                            </div>
                            <div className={`text-center ${sideColor}`}>
                                {entry.side === 'buy' ? '↑' : entry.side === 'sell' ? '↓' : '•'}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
