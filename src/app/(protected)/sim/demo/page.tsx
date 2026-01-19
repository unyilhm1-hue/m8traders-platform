/**
 * Trading Simulator Demo Page - Professional Layout
 * TradingView-style interface with Web Worker simulation engine
 */
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { DrawingSidebar } from '@/components/chart/DrawingSidebar';
import { CompactToolbar } from '@/components/trading/CompactToolbar';
import { ChartStatusOverlay } from '@/components/chart/ChartStatusOverlay';
import MultiPaneTradingChart from '@/components/chart/MultiPaneTradingChart';
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

            // 🧹 LAYER 1.5: RESET LIVE STATE - Clear stale candle/ticks from store
            // Reset currentCandle, currentTick, and tick queue to prevent "past update" errors
            useSimulationStore.getState().resetLiveState();

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

    // Mobile Tab State
    const [mobileTab, setMobileTab] = useState<'chart' | 'trading'>('chart');

    return (
        <div className="h-full flex flex-col overflow-hidden bg-[var(--bg-primary)]">
            {/* Compact Toolbar */}
            <div className="shrink-0">
                <CompactToolbar />
            </div>

            {/* Main Layout */}
            <div className="flex-1 flex overflow-hidden min-h-0 relative">

                {/* Visual Feedback Overlay */}
                <ChartStatusOverlay />

                {/* Left: Drawing Sidebar (Desktop Only) */}
                <div className="hidden md:block shrink-0">
                    <DrawingSidebar />
                </div>

                {/* Center: Chart Area */}
                {/* On mobile, hidden if trading tab is active */}
                <div className={`flex-1 flex flex-col overflow-hidden min-h-0 min-w-0 relative 
                    ${mobileTab === 'trading' ? 'hidden md:flex' : 'flex'}`}>
                    <div className="flex-1 min-h-0 relative">
                        {/* <TradingChart /> */}
                        <MultiPaneTradingChart />

                        {/* Mobile Drawing Tools Trigger (Optional - keeping simple for now) */}
                    </div>
                </div>

                {/* Right: Trading Panel */}
                {/* On mobile, full width if trading tab is active */}
                <aside className={`
                    w-full md:w-[320px] h-full glassmorphism border-l border-[var(--bg-subtle-border)] 
                    flex flex-col overflow-hidden bg-[var(--bg-secondary)]/95 backdrop-blur-md
                    absolute md:relative z-20 inset-0 md:inset-auto
                    ${mobileTab === 'trading' ? 'flex' : 'hidden md:flex'}
                `}>
                    {/* Mobile Header for Trading Panel */}
                    <div className="md:hidden flex items-center justify-between p-3 border-b border-[var(--bg-tertiary)] bg-[var(--bg-secondary)]">
                        <span className="font-semibold text-[var(--text-primary)]">Trading Panel</span>
                        <button
                            onClick={() => setMobileTab('chart')}
                            className="p-1 px-3 text-xs bg-[var(--bg-tertiary)] rounded text-[var(--text-secondary)]"
                        >
                            Close
                        </button>
                    </div>

                    {/* Account Summary (Condensed) */}
                    <div className="p-3 border-b border-[var(--bg-tertiary)] shrink-0 flex flex-col gap-2 bg-[var(--bg-secondary)]">
                        {/* Row 1: Price & P/L */}
                        <div className="flex justify-between items-center">
                            <div className="flex items-baseline gap-2">
                                <span className="text-lg font-bold text-[var(--text-primary)] font-mono tracking-tight">
                                    {currentPrice ? `Rp ${currentPrice.toLocaleString('id-ID')}` : 'Rp 0'}
                                </span>
                                <span className="text-[10px] text-[var(--accent-primary)] font-semibold bg-[var(--accent-primary)]/10 px-1.5 py-0.5 rounded tracking-wide">LIVE</span>
                            </div>
                            <div className="text-right flex items-center gap-2">
                                <span className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider">Unrealized P/L</span>
                                <div className="text-sm font-bold text-green-500 font-mono">+2.5%</div>
                            </div>
                        </div>

                        {/* Row 2: Balance details (Tiny) */}
                        <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)] border-t border-[var(--bg-tertiary)]/50 pt-2">
                            <div className="flex items-center gap-1.5">
                                <span className="text-[var(--text-tertiary)] uppercase tracking-wider text-[10px]">Balance</span>
                                <span className="text-[var(--text-primary)] font-mono font-medium">{formatIDR(balance)}</span>
                            </div>
                            <div className="w-px h-3 bg-[var(--bg-tertiary)]" />
                            <div className="flex items-center gap-1.5">
                                <span className="text-[var(--text-tertiary)] uppercase tracking-wider text-[10px]">Equity</span>
                                <span className="text-[var(--text-primary)] font-mono font-medium">{formatIDR(balance)}</span>
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
                    <div className="border-t border-[var(--bg-tertiary)] shrink-0 pb-[env(safe-area-inset-bottom)]">
                        <EnhancedOrderPanel currentPrice={currentPrice} />
                    </div>
                </aside>

                {/* Market Data Panel (Hidden on mobile for simplicity, or could be another tab) */}
                <div className="hidden lg:block h-full">
                    <MarketDataPanel />
                </div>
            </div>

            {/* Mobile Bottom Navigation */}
            <div className="md:hidden border-t border-[var(--bg-subtle-border)] bg-[var(--bg-secondary)] flex items-center justify-around p-2 pb-[env(safe-area-inset-bottom)] shrink-0 z-50">
                <button
                    onClick={() => setMobileTab('chart')}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${mobileTab === 'chart'
                        ? 'text-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                        : 'text-[var(--text-tertiary)]'
                        }`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" /></svg>
                    <span className="text-[10px] font-medium">Chart</span>
                </button>
                <button
                    onClick={() => setMobileTab('trading')}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${mobileTab === 'trading'
                        ? 'text-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                        : 'text-[var(--text-tertiary)]'
                        }`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                    <span className="text-[10px] font-medium">Trading</span>
                </button>
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
