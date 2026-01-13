/**
 * MarketDataPanel Component
 * Tabbed panel for Level 2, Time & Sales, and Metrics
 */
'use client';

import { useState } from 'react';
import { Level2OrderBook, TimeAndSales, AdvancedMetricsDisplay } from '@/components/market';
import { UI_ICONS } from '@/lib/chart/icons';

interface MarketDataPanelProps {
    currentPrice: number;
}

type MarketDataTab = 'level2' | 'tape' | 'metrics';

export function MarketDataPanel({ currentPrice }: MarketDataPanelProps) {
    const [activeTab, setActiveTab] = useState<MarketDataTab>('level2');
    const [isCollapsed, setIsCollapsed] = useState(false);
    const { Prev, Next } = UI_ICONS;

    if (isCollapsed) {
        return (
            <div className="w-8 glassmorphism border-l border-[var(--bg-subtle-border)] flex items-center justify-center bg-[var(--bg-secondary)]/90 backdrop-blur-md">
                <button
                    onClick={() => setIsCollapsed(false)}
                    className="py-4 text-xs text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] transition-colors"
                    title="Show Market Data"
                >
                    <Prev size={16} />
                </button>
            </div>
        );
    }

    return (
        <aside className="w-[300px] glassmorphism border-l border-[var(--bg-subtle-border)] flex flex-col bg-[var(--bg-secondary)]/90 backdrop-blur-md box-border">
            {/* Header with Collapse */}
            <div className="h-[50px] px-4 border-b border-[var(--bg-subtle-border)] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <h2 className="text-sm font-bold text-[var(--text-primary)] tracking-wide">MARKET DATA</h2>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">Last</span>
                        <span className="text-sm font-bold text-[var(--color-profit)] font-mono">
                            ${currentPrice?.toFixed(2) ?? '144.25'}
                        </span>
                    </div>
                </div>
                <button
                    onClick={() => setIsCollapsed(true)}
                    className="p-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] transition-colors"
                    title="Hide Panel"
                >
                    <Next size={16} />
                </button>
            </div>

            {/* Tabs */}
            <div className="flex p-1 gap-1 border-b border-[var(--bg-subtle-border)] bg-[var(--bg-tertiary)]/30 shrink-0">
                {(['level2', 'tape', 'metrics'] as MarketDataTab[]).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`
                            flex-1 py-1.5 text-xs font-medium rounded transition-all
                            ${activeTab === tab
                                ? 'bg-[var(--bg-secondary)] text-[var(--accent-primary)] shadow-sm'
                                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]/50'
                            }
                        `}
                    >
                        {tab === 'level2' ? 'Level 2' : tab === 'tape' ? 'Tape' : 'Metrics'}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden relative">
                {activeTab === 'level2' && <Level2OrderBook currentPrice={currentPrice} />}
                {activeTab === 'tape' && <TimeAndSales currentPrice={currentPrice} />}
                {activeTab === 'metrics' && <AdvancedMetricsDisplay currentPrice={currentPrice} />}
            </div>
        </aside>
    );
}
