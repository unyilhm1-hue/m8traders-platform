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
import { useTradingStore, useChartStore } from '@/stores';
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



    // ✅ Subscribe to real-time price from simulation store
    const currentPrice = useCurrentPrice();

    // 🔥 STATE MIGRATION: Use ChartStore as Single Source of Truth
    // Alias to match existing variable names for minimal refactor impact
    const { ticker: selectedTicker, setTicker: setSelectedTicker } = useChartStore();

    // Restore missing local state for Data Loading
    const [targetDate, setTargetDate] = useState<string | null>(null);
    const [availableIntervals, setAvailableIntervals] = useState<string[]>(['1m']);

    // 🚀 AUTO-DETECT AVAILABLE TICKER & DATE FROM DATA
    useEffect(() => {
        const detectAvailableData = async () => {
            try {
                console.log('[SimDemoPage] Fetching available tickers...');

                const response = await fetch('/api/simulation/tickers');
                const result = await response.json();

                if (!result.success || !result.tickers?.length) {
                    console.error('[SimDemoPage] No tickers available');
                    return;
                }

                // Select first available ticker
                const firstTicker = result.tickers[0];
                console.log('[SimDemoPage] Auto-selected ticker:', firstTicker.ticker);

                // Only update if currently default/empty to respect manual selection
                if (!selectedTicker || selectedTicker === 'BTCUSD') {
                    setSelectedTicker(firstTicker.ticker);
                }

                // Extract latest available date from metadata
                if (firstTicker.metadata?.data_end) {
                    // Parse ISO date string and get day before (to ensure full day data)
                    const endDate = new Date(firstTicker.metadata.data_end);
                    endDate.setDate(endDate.getDate() - 1); // Use previous day for complete data

                    const latestDate = endDate.toISOString().split('T')[0]; // Format: YYYY-MM-DD
                    console.log('[SimDemoPage] Auto-selected date:', latestDate);

                    setTargetDate(latestDate);
                } else {
                    // Fallback to safe date
                    setTargetDate('2026-01-14');
                }

            } catch (err) {
                console.error('[SimDemoPage] Error detecting available data:', err);
                // Fallback to defaults
                if (!selectedTicker) setSelectedTicker('ADRO');
                setTargetDate('2026-01-14');
            }
        };

        detectAvailableData();
    }, []); // Run once on mount (updates store if needed)

    // 🔥 AUTO-PAUSE WORKER ON INTERVAL CHANGE
    // Prevents worker from sending 1m updates when chart displays 2m/5m/etc
    const currentInterval = useSimulationStore((s) => s.baseInterval);
    const prevInterval = useRef(''); // Start empty to prevent mount trigger
    const activeIntervalRef = useRef(currentInterval); // 🛡️ GUARD: Track active interval for validation

    // 🔥 Update active interval ref whenever interval changes
    useEffect(() => {
        activeIntervalRef.current = currentInterval;
    }, [currentInterval]);

    useEffect(() => {
        // 🛑 LAYER 1: KILL SWITCH - Stop worker BEFORE any processing
        // Guard: Only trigger on actual interval changes (not initial mount)
        if (prevInterval.current !== currentInterval && engine && hasInitialized.current) {
            console.log(
                `[SimDemoPage] 🛑 KILL SWITCH ACTIVATED\n` +
                `   Interval Change: ${prevInterval.current} → ${currentInterval}\n` +
                `   Action: Pausing worker to prevent zombie ticks...`
            );

            // 🛑 CRITICAL: Pause worker IMMEDIATELY before any other operations
            // This prevents the worker from sending stale interval data during transition
            engine.pause();

            // 🧹 LAYER 1.5: FLUSH QUEUE - Remove stale ticks from store queue
            // Any ticks sent by worker just before pause are now "zombies". Kill them.
            useSimulationStore.getState().clearTickQueue();

            console.log(`[SimDemoPage] ✅ Worker paused & queues flushed`);

            // 🧹 LAYER 2: CLEANUP - Reset chart state for clean transition
            const store = useSimulationStore.getState();
            const baseData = store.baseData;

            console.log(`[SimDemoPage] 🧹 Clearing chart state for clean transition...`);

            if (baseData && baseData.length > 0) {
                const toEnrichedCandle = (c: any) => ({
                    t: typeof c.time === 'string' ? new Date(c.time).getTime() : c.time, // 🔥 FIX: Ensure Number for Worker
                    o: c.open, h: c.high, l: c.low, c: c.close, v: c.volume || 0,
                    isBullish: c.close >= c.open,
                    bodyRatio: Math.abs(c.close - c.open) / (c.high - c.low || 1),
                    upperWickRatio: (c.high - Math.max(c.open, c.close)) / (c.high - c.low || 1),
                    lowerWickRatio: (Math.min(c.open, c.close) - c.low) / (c.high - c.low || 1),
                    pattern: 'doji' as const
                });

                // 🔥 LOGIC BARU: DYNAMIC TIME SPLIT (Single Source of Truth)
                // Store sudah memotong candleHistory tepat di anchorTime (via switchInterval).
                // Kita tinggal mengikuti titik potong tersebut agar tidak ada overlap.
                const splitIndex = store.candleHistory.length;

                console.log(`[SimDemoPage] 🔗 Syncing with Store History Length: ${splitIndex}`);

                // Safety bounds vs Data Length
                // splitIndex = Math.min(splitIndex, baseData.length - 1); 
                // Removed safety bounds that might desync history vs queue

                // 3. Lakukan Slicing dengan Index Dinamis
                // History gets everything BEFORE split
                // Queue gets everything FROM split onwards
                // 🔥 Optimization: Use store.candleHistory directly for history buffer to avoid re-mapping if possible
                // But for now, ensuring format consistency via toEnrichedCandle on baseData slice is safer.

                const historyBuffer = baseData.slice(0, splitIndex).map(toEnrichedCandle);
                const simulationQueue = baseData.slice(splitIndex).map(toEnrichedCandle);

                // 🔥 ONE-STEP BACK FIX (Avoid Territory War)
                // Check if History End overlaps with Queue Start
                if (historyBuffer.length > 0 && simulationQueue.length > 0) {
                    const lastHistory = historyBuffer[historyBuffer.length - 1];
                    const firstQueue = simulationQueue[0];

                    if (lastHistory.t >= firstQueue.t) {
                        console.warn(`[SimDemoPage] ⚠️ OVERLAP DETECTED (Hist End: ${lastHistory.t} >= Queue Start: ${firstQueue.t})`);
                        console.warn(`[SimDemoPage] ✂️ Popping last history candle to allow Worker to take over.`);
                        historyBuffer.pop();
                    }
                }

                console.log(
                    `[SimDemoPage] 🔄 Reinit Buffers:\n` +
                    `   Anchor Time: ${store.tempAnchorTime ? new Date(store.tempAnchorTime * 1000).toLocaleString() : 'N/A'}\n` +
                    `   Split Index: ${splitIndex}\n` +
                    `   History Size: ${historyBuffer.length}\n` +
                    `   Queue Size: ${simulationQueue.length}`
                );

                const queueStartPayload = simulationQueue.length > 0 ? simulationQueue[0].t : 0;
                console.log(`[SimDemoPage] ⏭ Queue Start: ${new Date(queueStartPayload).toLocaleString()}`);

                // ▶️ LAYER 3: RESTART - Reinitialize worker with new interval
                engine.initWithBuffers({ historyBuffer, simulationQueue, interval: currentInterval });
            }

            console.log(`[SimDemoPage] ✅ Worker reinitialized for ${currentInterval} - Ready for playback`);

            // 🔥 Update prevInterval AFTER successful reinit
            prevInterval.current = currentInterval;
        }
    }, [currentInterval, engine]);

    // 🚀 AUTO-LOAD DATA ON PAGE MOUNT WITH HYBRID STITCHING
    useEffect(() => {
        // Wait until ticker and date are detected
        if (!selectedTicker || !targetDate) {
            console.log('[SimDemoPage] Waiting for ticker/date detection...');
            return;
        }

        const initSimulation = async () => {
            try {
                console.log('[SimDemoPage] \ud83d\udd25 Initializing with hybrid stitcher (direct store method)...');

                // \ud83d\udd25 NEW: Use store method directly (includes hybrid stitching!)
                await useSimulationStore.getState().loadWithSmartBuffer(
                    selectedTicker,
                    new Date(targetDate),
                    '1m'
                );

                // 🔥 FIX: Get FRESH state after async load
                const { baseData, candleHistory } = useSimulationStore.getState();

                console.log(`✅ Hybrid data loaded:`);
                console.log(`   - Base data: ${baseData.length} candles`);
                console.log(`   - Chart history: ${candleHistory.length} candles`);

                // Extract buffers for worker
                // Split baseData into history (first 200) and simulation (rest)
                // 🔥 Convert to EnrichedCandle format for worker
                const toEnrichedCandle = (c: any) => ({
                    t: c.time, // 🔥 FIX: baseData.time is ALREADY in milliseconds (ResamplerCandle format)
                    o: c.open, h: c.high, l: c.low, c: c.close, v: c.volume || 0,
                    isBullish: c.close >= c.open,
                    bodyRatio: Math.abs(c.close - c.open) / (c.high - c.low || 1),
                    upperWickRatio: (c.high - Math.max(c.open, c.close)) / (c.high - c.low || 1),
                    lowerWickRatio: (Math.min(c.open, c.close) - c.low) / (c.high - c.low || 1),
                    pattern: 'doji' as const
                });

                const historyBuffer = baseData.slice(0, 200).map(toEnrichedCandle);
                const simulationQueue = baseData.slice(200).map(toEnrichedCandle);

                // 📊 Log date range for verification
                console.log(`[SimDemoPage] 📊 Data Summary:`);
                console.log(`   - Total candles: ${baseData.length}`);
                console.log(`   - Date range: ${new Date(baseData[0].time).toLocaleString('id-ID')} → ${new Date(baseData[baseData.length - 1].time).toLocaleString('id-ID')}`);
                console.log(`   - History buffer: ${historyBuffer.length} candles (chart initial load)`);
                console.log(`   - Simulation queue: ${simulationQueue.length} candles (worker playback)`);

                // Note: Replay mode trim happens in store (useSimulationStore.loadWithSmartBuffer)
                // Chart will automatically load trimmed candleHistory (200 candles)

                // Send to worker (always init, even if queue empty)
                if (engine) {
                    console.log(`📨 [SimDemoPage] Sending buffers to worker...`);
                    engine.initWithBuffers({
                        historyBuffer,
                        simulationQueue,
                        interval: '1m'
                    });
                    setIsWorkerDataReady(true);
                }

            } catch (err) {
                console.error('❌ [SimDemoPage] Init Error:', err);
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
                // 🔥 FIX: Set prevInterval AFTER initial load to prevent false reinit
                prevInterval.current = currentInterval;
            }, { timeout: 2000 }); // Fallback after 2s if browser stays busy
        } else {
            // Fallback for browsers without requestIdleCallback (Safari)
            setTimeout(() => {
                initSimulation();
                hasInitialized.current = true;
                // 🔥 FIX: Set prevInterval AFTER initial load to prevent false reinit
                prevInterval.current = currentInterval;
            }, 100);
        }

        // \ud83d\udd25 CLEANUP: Free memory when user leaves page
        return () => {
            console.log('\ud83d\udc4b [SimDemoPage] Unmounting...');
            // Note: Keep LRU cache intact for quick return to page
            // Only clear if implementing aggressive cleanup mode
        };
    }, [isReady, engine, selectedTicker, targetDate]); // 🔥 UPDATED: Added targetDate dependency

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
                <div className="flex-1 flex flex-col overflow-hidden min-h-0 min-w-0">
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
                                Rp {(currentPrice || 0).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
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
                <MarketDataPanel />
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
