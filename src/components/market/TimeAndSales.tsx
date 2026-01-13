/**
 * TimeAndSales Component  
 * Display real-time tape with buy/sell color coding
 */
'use client';

import { useEffect, useState } from 'react';
import { generateTimeAndSalesEntry } from '@/lib/market';
import type { TimeAndSalesEntry } from '@/types/market';

interface TimeAndSalesProps {
    currentPrice: number;
}

export function TimeAndSales({ currentPrice }: TimeAndSalesProps) {
    const [entries, setEntries] = useState<TimeAndSalesEntry[]>([]);

    useEffect(() => {
        // Generate initial entries
        const initial: TimeAndSalesEntry[] = [];
        let prevPrice = currentPrice;

        for (let i = 0; i < 20; i++) {
            const entry = generateTimeAndSalesEntry(prevPrice, i > 0 ? prevPrice : undefined);
            initial.unshift(entry);
            prevPrice = entry.price;
        }

        setEntries(initial);

        // Add new entry every 1-3 seconds
        const interval = setInterval(() => {
            setEntries((prev) => {
                const lastPrice = prev[0]?.price || currentPrice;
                const newEntry = generateTimeAndSalesEntry(currentPrice, lastPrice);

                // Keep only last 50 entries
                return [newEntry, ...prev.slice(0, 49)];
            });
        }, Math.random() * 2000 + 1000);

        return () => clearInterval(interval);
    }, [currentPrice]);

    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        });
    };

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
                                ${entry.price.toFixed(2)}
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
