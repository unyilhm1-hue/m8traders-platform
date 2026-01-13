/**
 * Trading Simulator Demo Page - Professional Layout
 * TradingView-style interface with compact toolbar and vertical sidebar
 */
'use client';

import { useState, useCallback } from 'react';
import { TradingChart } from '@/components/chart';
import { DrawingSidebar } from '@/components/chart/DrawingSidebar';
import { CompactToolbar } from '@/components/trading/CompactToolbar';
import { PositionDisplay, PendingOrders } from '@/components/trading';
import { EnhancedOrderPanel } from '@/components/trading/EnhancedOrderPanel';
import { MarketDataPanel } from '@/components/market/MarketDataPanel';
import { PerformanceStats, TradeHistory } from '@/components/analytics';
import { useChartStore, useTradingStore } from '@/stores';
import { useKeyboardShortcuts } from '@/hooks';

export default function SimDemoPage() {
    const [currentPrice, setCurrentPrice] = useState(185.5);
    const [activeTab, setActiveTab] = useState<'position' | 'pending' | 'trades'>('position');
    const { balance } = useTradingStore();
    const { checkAndFillOrders } = useTradingStore();

    // Enable keyboard shortcuts for replay
    useKeyboardShortcuts();

    const handlePriceChange = useCallback((price: number) => {
        setCurrentPrice(price);
        // Check and fill pending orders when price changes
        checkAndFillOrders(price);
    }, [checkAndFillOrders]);

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
                <aside className="w-[300px] glassmorphism border-l border-[var(--bg-subtle-border)] flex flex-col overflow-hidden bg-[var(--bg-secondary)]/90 backdrop-blur-md">
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
                    <div className="flex p-1 gap-1 border-b border-[var(--bg-subtle-border)] bg-[var(--bg-tertiary)]/30 shrink-0">
                        {(['position', 'pending', 'trades'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`
                                    flex-1 py-1.5 text-xs font-medium rounded transition-all capitalize
                                    ${activeTab === tab
                                        ? 'bg-[var(--bg-secondary)] text-[var(--accent-primary)] shadow-sm'
                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]/50'
                                    }
                                `}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 overflow-y-auto">
                        {activeTab === 'position' ? (
                            <div className="p-4">
                                <PositionDisplay currentPrice={currentPrice} />
                            </div>
                        ) : activeTab === 'pending' ? (
                            <PendingOrders />
                        ) : (
                            <>
                                <PerformanceStats />
                                <div className="border-t border-[var(--bg-tertiary)]">
                                    <TradeHistory />
                                </div>
                            </>
                        )}
                    </div>

                    {/* Enhanced Order Panel */}
                    <div className="border-t border-[var(--bg-tertiary)]">
                        <EnhancedOrderPanel currentPrice={currentPrice} />
                    </div>
                </aside>

                {/* Market Data Panel */}
                <MarketDataPanel currentPrice={currentPrice} />
            </div>
        </div>
    );
}
