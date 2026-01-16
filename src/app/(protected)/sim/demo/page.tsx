/**
 * Trading Simulator Demo Page - Professional Layout
 * TradingView-style interface with Web Worker simulation engine
 */
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { DrawingSidebar } from '@/components/chart/DrawingSidebar';
import { CompactToolbar } from '@/components/trading/CompactToolbar';
import { PositionDisplay, PendingOrders } from '@/components/trading';
import { EnhancedOrderPanel } from '@/components/trading/EnhancedOrderPanel';
import { MarketDataPanel } from '@/components/market/MarketDataPanel';
import { PerformanceStats, TradeHistory } from '@/components/analytics';
import { useTradingStore } from '@/stores';
import { SimulationEngineProvider, useSimulationEngineContext } from '@/contexts/SimulationEngineContext';
import { useCurrentPrice, useSimulationStore } from '@/stores/useSimulationStore';
import { formatPrice, formatIDR } from '@/lib/format';

// 🚀 PERFORMANCE FIX: Lazy-load TradingChart to prevent heavy bundle compilation on first load
const TradingChart = dynamic(
    () => import('@/components/chart').then(mod => ({ default: mod.TradingChart })),
    {
        ssr: false,
        loading: () => (
            <div className="h-full flex items-center justify-center bg-[var(--bg-secondary)]">
                <div className="text-[var(--text-secondary)]">Loading chart...</div>
            </div>
        )
    }
);


function SimDemoPageContent() {
    const [activeTab, setActiveTab] = useState<'position' | 'pending' | 'trades'>('position');
    const [isWorkerDataReady, setIsWorkerDataReady] = useState(false);
    const { balance, checkAndFillOrders } = useTradingStore();

    // ✅ Get shared engine from context (no duplicate worker!)
    const { engine, isReady } = useSimulationEngineContext();

    // ✅ Track initialization to prevent loop
    const hasInitialized = useRef(false);

    // 🔥 NEW: Dynamic ticker state (replaces hardcoded 'ADRO')
    const [selectedTicker, setSelectedTicker] = useState('ADRO');  // Default to ADRO for backward compatibility

    // ✅ Subscribe to real-time price from simulation store
    const currentPrice = useCurrentPrice();

    // 🚀 AUTO-LOAD DATA ON PAGE MOUNT WITH SMART BUFFERING
    useEffect(() => {
        const initSimulation = async () => {
            try {
                // 🔥 NEW: Use smart buffering API
                console.log('[SimDemoPage] Fetching simulation data with smart buffering...');

                // 🔥 UPDATED: Use dynamic selectedTicker instead of hardcoded 'ADRO'
                const ticker = selectedTicker;
                const targetDate = '2026-01-15';  // TODO: Support date selection
                const interval = '1m';             // TODO: Support interval switching

                const response = await fetch(
                    `/api/simulation/load?ticker=${ticker}&date=${targetDate}&interval=${interval}`
                );

                const result = await response.json();

                if (!result.success || !result.data) {
                    console.error('[SimDemoPage] Failed to load data:', result.error);
                    throw new Error(result.error || 'Failed to fetch simulation data');
                }

                const { historyBuffer, simulationQueue, interval: loadedInterval, wasAggregated } = result.data;

                console.log(`✅ [SimDemoPage] Smart buffering data loaded:`);
                console.log(`   - History: ${historyBuffer.length} candles (for context warm-up)`);
                console.log(`   - Simulation: ${simulationQueue.length} candles (to animate)`);
                console.log(`   - Interval: ${loadedInterval}`);
                console.log(`   - Aggregated: ${wasAggregated ? 'Yes' : 'No'}`);

                // 🚀 FIX 1: Hydrate baseData and baseInterval for Master Blueprint
                const store = useSimulationStore.getState();

                // Combine buffers for baseData (needed for resampling)
                const allBaseData = [...historyBuffer, ...simulationQueue];

                useSimulationStore.setState({
                    baseData: allBaseData,
                    baseInterval: loadedInterval as any,
                    currentTicker: ticker,
                    bufferData: historyBuffer
                });

                // Load history candles to chart (for visual context)
                if (historyBuffer && historyBuffer.length > 0) {
                    store.setCandleHistory(historyBuffer);
                    console.log(`📊 [SimDemoPage] Loaded ${historyBuffer.length} history + base data hydrated`);
                }

                // 🔥 NEW: Send split buffers to worker via initWithBuffers
                if (engine && simulationQueue.length > 0) {
                    console.log(`📨 [SimDemoPage] Sending split buffers to worker...`);
                    engine.initWithBuffers({
                        historyBuffer,
                        simulationQueue,
                        interval: loadedInterval
                    });

                    // Set ready state for auto-play
                    setIsWorkerDataReady(true);
                } else if (!engine) {
                    console.warn('⚠️ [SimDemoPage] Engine not ready yet');
                } else {
                    console.warn('⚠️ [SimDemoPage] No simulation candles to send');
                }

            } catch (err) {
                console.error('❌ [SimDemoPage] Simulation Init Error:', err);
            }
        };

        // ✅ Run only once, prevent loop
        if (hasInitialized.current) return;

        if (!engine || !isReady) {
            console.log('[SimDemoPage] Waiting for worker...');
            return;
        }

        console.log('[SimDemoPage] Worker ready, deferring initialization for better UX...');

        // 🚀 PERFORMANCE FIX: Defer heavy data loading until browser is idle
        // This prevents blocking initial render and makes UI feel more responsive
        if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(() => {
                initSimulation();
                hasInitialized.current = true;
            }, { timeout: 2000 }); // Fallback after 2s if browser stays busy
        } else {
            // Fallback for browsers without requestIdleCallback (Safari)
            setTimeout(() => {
                initSimulation();
                hasInitialized.current = true;
            }, 100);
        }
    }, [isReady, engine, selectedTicker]); // 🔥 UPDATED: Added selectedTicker dependency to reload when ticker changes

    // ✅ FIX: Event-driven auto-play (no race condition)
    // Trigger play ONLY after DATA_READY confirmed
    useEffect(() => {
        if (isWorkerDataReady && engine) {
            console.log('▶️ [SimDemoPage] Auto-starting playback (data ready)...');
            engine.play(1); // Start at 1x speed
            setIsWorkerDataReady(false); // Prevent re-trigger
        }
    }, [isWorkerDataReady, engine]);

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

// Wrap with context provider to share single engine instance
export default function SimDemoPage() {
    return (
        <SimulationEngineProvider>
            <SimDemoPageContent />
        </SimulationEngineProvider>
    );
}
