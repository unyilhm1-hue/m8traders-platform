/**
 * Trading Simulator Demo Page - Professional Layout
 * TradingView-style interface with compact toolbar and vertical sidebar
 */
'use client';

import { useState, useCallback } from 'react';
import { TradingChart } from '@/components/chart';
import { DrawingSidebar } from '@/components/chart/DrawingSidebar';
import { CompactToolbar } from '@/components/trading/CompactToolbar';
import { OrderPanel, PositionDisplay } from '@/components/trading';
import { useChartStore, useTradingStore } from '@/stores';
import { useKeyboardShortcuts } from '@/hooks';

export default function SimDemoPage() {
    const [currentPrice, setCurrentPrice] = useState(185.5);
    const [activeTab, setActiveTab] = useState<'position' | 'trades'>('position');
    const { balance } = useTradingStore();

    // Enable keyboard shortcuts for replay
    useKeyboardShortcuts();

    const handlePriceChange = useCallback((price: number) => {
        setCurrentPrice(price);
    }, []);

    return (
        <div className="h-screen flex flex-col overflow-hidden">
            {/* Compact Toolbar */}
            <CompactToolbar />

            {/* Main Layout */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left: Drawing Sidebar */}
                <DrawingSidebar />

                {/* Center: Chart Area */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1">
                        <TradingChart onPriceChange={handlePriceChange} />
                    </div>
                </div>

                {/* Right: Trading Panel */}
                <aside className="w-[280px] bg-[var(--bg-secondary)] border-l border-[var(--bg-tertiary)] flex flex-col overflow-hidden">
                    {/* Account Summary (Condensed) */}
                    <div className="p-4 border-b border-[var(--bg-tertiary)]">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <div className="text-xs text-[var(--text-tertiary)]">Balance</div>
                                <div className="text-lg font-bold text-[var(--text-primary)]">
                                    ${balance.toLocaleString()}
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-xs text-[var(--text-tertiary)]">P/L</div>
                                <div className="text-lg font-bold text-green-500">+2.5%</div>
                            </div>
                        </div>

                        {/* Current Price */}
                        <div className="pt-3 border-t border-[var(--bg-tertiary)]">
                            <div className="text-xs text-[var(--text-tertiary)] mb-1">Current Price</div>
                            <div className="text-2xl font-bold text-[var(--text-primary)]">
                                ${currentPrice.toFixed(2)}
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-[var(--bg-tertiary)]">
                        <button
                            onClick={() => setActiveTab('position')}
                            className={`flex-1 py-2 text-sm font-medium transition-colors ${activeTab === 'position'
                                    ? 'text-[var(--accent-primary)] border-b-2 border-[var(--accent-primary)]'
                                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                }`}
                        >
                            Position
                        </button>
                        <button
                            onClick={() => setActiveTab('trades')}
                            className={`flex-1 py-2 text-sm font-medium transition-colors ${activeTab === 'trades'
                                    ? 'text-[var(--accent-primary)] border-b-2 border-[var(--accent-primary)]'
                                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                }`}
                        >
                            Trades
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 overflow-y-auto">
                        {activeTab === 'position' ? (
                            <div className="p-4">
                                <PositionDisplay currentPrice={currentPrice} />
                            </div>
                        ) : (
                            <div className="p-4">
                                <div className="text-xs text-[var(--text-tertiary)] text-center py-4">
                                    Recent trades will appear here
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Order Panel */}
                    <div className="border-t border-[var(--bg-tertiary)]">
                        <OrderPanel currentPrice={currentPrice} />
                    </div>
                </aside>
            </div>
        </div>
    );
}
