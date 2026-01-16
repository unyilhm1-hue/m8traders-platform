'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

interface TickerSelectorProps {
    selectedTicker: string;
    onTickerChange: (ticker: string) => void;
    disabled?: boolean;
}

export function TickerSelector({ selectedTicker, onTickerChange, disabled = false }: TickerSelectorProps) {
    const [availableTickers, setAvailableTickers] = useState<string[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Fetch available tickers on mount
    useEffect(() => {
        fetch('/api/simulation/tickers')
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setAvailableTickers(data.tickers);
                    console.log(`[TickerSelector] Loaded ${data.tickers.length} tickers`);
                }
            })
            .catch(err => console.error('[TickerSelector] Failed to load tickers:', err));
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchQuery('');
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // Filter tickers based on search query
    const filteredTickers = availableTickers.filter(ticker =>
        ticker.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleTickerSelect = (ticker: string) => {
        onTickerChange(ticker);
        setIsOpen(false);
        setSearchQuery('');
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Trigger Button */}
            <button
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`
                    flex items-center gap-2 px-3 py-1.5 rounded-lg
                    bg-[var(--bg-tertiary)] border border-[var(--bg-subtle-border)]
                    text-[var(--text-primary)] font-medium text-sm
                    transition-all hover:bg-[var(--bg-secondary)]
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    ${isOpen ? 'ring-2 ring-[var(--accent-primary)]' : ''}
                `}
            >
                <span className="text-xs text-[var(--text-tertiary)]">Ticker:</span>
                <span className="font-bold">{selectedTicker}</span>
                <ChevronDown
                    className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-48 z-50
                    bg-[var(--bg-secondary)] border border-[var(--bg-subtle-border)] rounded-lg shadow-xl
                    backdrop-blur-md overflow-hidden"
                >
                    {/* Search Input */}
                    <div className="p-2 border-b border-[var(--bg-subtle-border)]">
                        <input
                            type="text"
                            placeholder="Search ticker..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-3 py-1.5 rounded text-sm
                                bg-[var(--bg-tertiary)] border border-[var(--bg-subtle-border)]
                                text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]
                                focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                            autoFocus
                        />
                    </div>

                    {/* Ticker List */}
                    <div className="max-h-64 overflow-y-auto">
                        {filteredTickers.length > 0 ? (
                            filteredTickers.map(ticker => (
                                <button
                                    key={ticker}
                                    onClick={() => handleTickerSelect(ticker)}
                                    className={`
                                        w-full px-4 py-2 text-left text-sm transition-colors
                                        ${ticker === selectedTicker
                                            ? 'bg-[var(--accent-primary)] text-white font-bold'
                                            : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                                        }
                                    `}
                                >
                                    {ticker}
                                </button>
                            ))
                        ) : (
                            <div className="px-4 py-3 text-sm text-[var(--text-tertiary)] text-center">
                                {searchQuery ? 'No matching tickers' : 'No tickers available'}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
