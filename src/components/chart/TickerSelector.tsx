/**
 * TickerSelector Component
 * Dropdown for selecting different stock tickers
 */
'use client';

import { useState, useMemo } from 'react';
import { useChartStore } from '@/stores';
import { IDX_TICKERS, ALL_TICKERS, POPULAR_TICKERS } from '@/lib/chart';
import type { Ticker } from '@/types';

interface TickerSelectorProps {
    className?: string;
}

export function TickerSelector({ className = '' }: TickerSelectorProps) {
    const { ticker, setTicker } = useChartStore();
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Get current ticker info
    const currentTicker = useMemo(() => {
        return ALL_TICKERS.find((t) => t.symbol === ticker) || IDX_TICKERS[0];
    }, [ticker]);

    // Filter IDX tickers based on search
    const filteredIDX = useMemo(() => {
        if (!searchQuery) return IDX_TICKERS;
        const query = searchQuery.toLowerCase();
        return IDX_TICKERS.filter(
            (t) =>
                t.symbol.toLowerCase().includes(query) || t.name.toLowerCase().includes(query)
        );
    }, [searchQuery]);

    const handleSelect = (t: Ticker) => {
        setTicker(t.symbol);
        setIsOpen(false);
        setSearchQuery('');
    };

    return (
        <div className={`relative ${className}`}>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] border border-[var(--bg-tertiary)] rounded-md transition-colors text-sm"
            >
                <span className="font-medium text-[var(--text-primary)]">
                    {currentTicker.symbol}
                </span>
                <span className="text-[var(--text-tertiary)] hidden sm:inline max-w-[120px] truncate">
                    {currentTicker.name}
                </span>
                <svg
                    className={`w-4 h-4 text-[var(--text-secondary)] transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                    />
                </svg>
            </button>

            {/* Dropdown */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Dropdown Panel */}
                    <div className="absolute top-full left-0 mt-1 w-80 bg-[var(--bg-secondary)] border border-[var(--bg-tertiary)] rounded-lg shadow-lg z-20 max-h-96 flex flex-col">
                        {/* Search Box */}
                        <div className="p-2 border-b border-[var(--bg-tertiary)]">
                            <input
                                type="text"
                                placeholder="Search ticker or name..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full px-3 py-1.5 bg-[var(--bg-primary)] border border-[var(--bg-tertiary)] rounded text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-primary)]"
                                autoFocus
                            />
                        </div>

                        {/* Ticker List */}
                        <div className="overflow-y-auto">
                            {/* Popular Section */}
                            {!searchQuery && (
                                <div className="p-2">
                                    <div className="text-xs font-medium text-[var(--text-tertiary)] px-2 py-1">
                                        ⭐ Popular
                                    </div>
                                    {POPULAR_TICKERS.map((t) => (
                                        <TickerItem
                                            key={t.symbol}
                                            ticker={t}
                                            isActive={t.symbol === ticker}
                                            onClick={() => handleSelect(t)}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* IDX Stocks */}
                            {filteredIDX.length > 0 && (
                                <div className="p-2 border-t border-[var(--bg-tertiary)]">
                                    <div className="text-xs font-medium text-[var(--text-tertiary)] px-2 py-1">
                                        🇮🇩 IDX Stocks
                                    </div>
                                    {filteredIDX.map((t) => (
                                        <TickerItem
                                            key={t.symbol}
                                            ticker={t}
                                            isActive={t.symbol === ticker}
                                            onClick={() => handleSelect(t)}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* No Results */}
                            {filteredIDX.length === 0 && (
                                <div className="p-4 text-center text-sm text-[var(--text-tertiary)]">
                                    No tickers found
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

interface TickerItemProps {
    ticker: Ticker;
    isActive: boolean;
    onClick: () => void;
}

function TickerItem({ ticker, isActive, onClick }: TickerItemProps) {
    return (
        <button
            onClick={onClick}
            className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${isActive
                ? 'bg-[var(--accent-primary)] text-white'
                : 'hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                }`}
        >
            <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{ticker.symbol}</span>
                {ticker.category && (
                    <span
                        className={`text-xs px-1.5 py-0.5 rounded ${isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-[var(--bg-secondary)] text-[var(--text-tertiary)]'
                            }`}
                    >
                        {ticker.category}
                    </span>
                )}
            </div>
            <div
                className={`text-xs truncate ${isActive ? 'text-white/80' : 'text-[var(--text-tertiary)]'}`}
            >
                {ticker.name}
            </div>
        </button>
    );
}
