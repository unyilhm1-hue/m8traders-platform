/**
 * Trading Simulator Demo Page - Professional Layout
 * TradingView-style interface with Web Worker simulation engine
 */
'use client';

import { useState, useCallback, useEffect } from 'react';
import { TradingChart } from '@/components/chart';
import { DrawingSidebar } from '@/components/chart/DrawingSidebar';
import { CompactToolbar } from '@/components/trading/CompactToolbar';
import { PositionDisplay, PendingOrders } from '@/components/trading';
import { EnhancedOrderPanel } from '@/components/trading/EnhancedOrderPanel';
import { MarketDataPanel } from '@/components/market/MarketDataPanel';
import { PerformanceStats, TradeHistory } from '@/components/analytics';
import { useTradingStore } from '@/stores';
import { useSimulationEngine } from '@/hooks/useSimulationEngine';
import { useCurrentPrice, useSimulationStore } from '@/stores/useSimulationStore';
import { formatPrice, formatIDR } from '@/lib/format';

export default function SimDemoPage() {
    const [activeTab, setActiveTab] = useState<'position' | 'pending' | 'trades'>('position');
    const { balance, checkAndFillOrders } = useTradingStore();

    // ✅ Initialize simulation engine (manual control via DateSelector)
    const engine = useSimulationEngine({
        autoLoad: false,  // Manual load via auto-load logic below
        autoPlay: false,  // Manual play via SimulationControls
        playbackSpeed: 1,
    });

    // ✅ Subscribe to real-time price from simulation store
    const currentPrice = useCurrentPrice();

    // 🚀 AUTO-LOAD DATA ON PAGE MOUNT
    useEffect(() => {
        const autoLoadSimulation = async () => {
            try {
                console.log('🚀 [SimDemoPage] Auto-loading simulation data...');

                // Fetch data from API
                const response = await fetch('/api/simulation/start');
                const result = await response.json();

                if (!result.success) {
                    throw new Error(result.error || 'Failed to load data');
                }

                const { candles } = result.data;
                console.log(`📦 [SimDemoPage] Loaded ${candles.length} candles from API`);

                // Use today's date for simulation
                const today = new Date().toISOString().split('T')[0]; // 2026-01-15
                console.log(`📅 [SimDemoPage] Auto-selecting date: ${today}`);

                // Split data using store action
                const loadSimulationDay = useSimulationStore.getState().loadSimulationDay;
                const { historyCount, simCount, error } = loadSimulationDay(today, candles);

                if (error || simCount === 0) {
                    console.warn(`⚠️ [SimDemoPage] No simulation data for ${today}, simCount=${simCount}`);
                    console.log('💡 [SimDemoPage] Chart will show history only, Play button will be disabled');
                    return;
                }

                console.log(`✅ [SimDemoPage] Data split complete:`);
                console.log(`   - History: ${historyCount} candles (already in store)`);
                console.log(`   - Simulation: ${simCount} candles (ready for worker)`);

                // Get simulation candles from store
                const simulationCandles = useSimulationStore.getState().simulationCandles;

                // Send to worker via engine reload (which triggers INIT_DATA)
                if (engine && simulationCandles.length > 0) {
                    console.log(`📨 [SimDemoPage] Sending ${simulationCandles.length} candles to worker...`);
                    // We'll use engine.reload() which will call the worker's INIT_DATA
                    // But we need to modify it to use our simulation data instead of fetching again
                    // For now, let's directly post to worker if we have access
                    // TODO: Better integration - for now data is ready in store
                }

            } catch (error) {
                console.error('❌ [SimDemoPage] Auto-load failed:', error);
            }
        };

        autoLoadSimulation();
    }, []); // Run once on mount

    // Handle price updates for order filling
    useEffect(() => {
        if (currentPrice > 0) {
            checkAndFillOrders(currentPrice);
        }
    }, [currentPrice, checkAndFillOrders]);

    return (
        <div className="h-[100dvh] flex flex-col overflow-hidden">
            {/* Compact Toolbar */}
            <CompactToolbar />

            {/* Main Layout */}
            <div className="flex-1 flex overflow-hidden min-h-0">
                {/* Left: Drawing Sidebar */}
                <DrawingSidebar />

                {/* Center: Chart Area */}
                <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                    <div className="flex-1 min-h-0">
                        <TradingChart />
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
                                    {formatIDR(balance)}
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
                                Rp {currentPrice.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
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
