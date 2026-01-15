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

    // 🚀 AUTO-LOAD DATA ON PAGE MOUNT WITH RANDOM ENTRY POINT
    useEffect(() => {
        const initSimulation = async () => {
            try {
                console.log('� [SimDemoPage] Fetching simulation data...');
                const response = await fetch('/api/simulation/start');
                const result = await response.json();

                if (!result.success || !result.data) {
                    throw new Error('Failed to fetch');
                }

                const { candles, ticker } = result.data; // Data mentah (30 hari)
                console.log(`✅ [SimDemoPage] Loaded ${candles.length} candles for ${ticker}`);


                // --- LOGIKA RANDOM ENTRY POINT (WIB SYNCED) ---

                // 1. Ambil daftar tanggal unik dengan ZONA WAKTU JAKARTA (WIB)
                // Ini penting agar daftar tanggal di sini COCOK dengan filter di Store
                const uniqueDates: string[] = Array.from(
                    new Set(
                        candles.map((c: any) => {
                            // Normalisasi timestamp
                            const ts = c.t > 10000000000 ? c.t / 1000 : c.t;
                            const dateObj = new Date(ts * 1000);

                            // Force format YYYY-MM-DD sesuai WIB
                            return dateObj.toLocaleDateString('en-CA', {
                                timeZone: 'Asia/Jakarta'
                            });
                        })
                    )
                ).sort() as string[];

                console.log(`📅 [SimDemoPage] Total Data Tersedia (WIB): ${uniqueDates.length} hari`);
                console.log(`   Date Range (WIB): ${uniqueDates[0]} to ${uniqueDates[uniqueDates.length - 1]}`);

                // 2. Tentukan Buffer History (Misal: Wajib punya 5 hari ke belakang)
                const MIN_HISTORY_DAYS = 5;

                let randomTargetDate: string;

                if (uniqueDates.length <= MIN_HISTORY_DAYS) {
                    console.warn('⚠️ [SimDemoPage] Data too short for random entry, using middle date');
                    // Fallback ke hari tengah
                    randomTargetDate = uniqueDates[Math.floor(uniqueDates.length / 2)];
                } else {
                    // 3. Pilih Tanggal Acak (Mulai dari hari ke-6 sampai hari terakhir - 1)
                    // Ini menjamin chart selalu punya history minimal 5 hari ke belakang
                    const validStartIndex = MIN_HISTORY_DAYS;
                    const maxIndex = uniqueDates.length - 2; // Sisakan 1 hari di depan buat jaga-jaga

                    const randomIndex = Math.floor(Math.random() * (maxIndex - validStartIndex + 1)) + validStartIndex;
                    randomTargetDate = uniqueDates[randomIndex];

                    console.log(`🎲 [SimDemoPage] Random Start (WIB): ${randomTargetDate} (Hari ke-${randomIndex + 1}/${uniqueDates.length})`);
                }

                // 4. Load ke Store menggunakan Tanggal Acak tersebut
                // Store otomatis akan menjadikan semua data SEBELUM tanggal ini sebagai History
                const loadSimulationDay = useSimulationStore.getState().loadSimulationDay;
                const storeResult = loadSimulationDay(randomTargetDate, candles);

                if (storeResult.error || storeResult.simCount === 0) {
                    console.warn(`⚠️ [SimDemoPage] No simulation data for ${randomTargetDate}, simCount=${storeResult.simCount}`);
                    console.log('💡 [SimDemoPage] Chart will show history only, Play button will be disabled');
                    return;
                }

                console.log(`✅ [SimDemoPage] Data split complete:`);
                console.log(`   - History: ${storeResult.historyCount} candles (chart context)`);
                console.log(`   - Simulation: ${storeResult.simCount} candles (for playback)`);

                // 5. Load ke Worker (Hanya data market hours yang sudah difilter Store)
                const simulationCandles = useSimulationStore.getState().simulationCandles;

                // ✅ Send to worker via engine.initWithData
                if (engine && simulationCandles.length > 0) {
                    console.log(`📨 [SimDemoPage] Sending ${simulationCandles.length} candles to worker...`);
                    engine.initWithData(simulationCandles);

                    // Auto-play to start tick generation for orderbook
                    setTimeout(() => {
                        console.log('▶️ [SimDemoPage] Auto-starting playback...');
                        engine.play(1); // Start at 1x speed
                    }, 500); // Small delay to ensure worker processed INIT_DATA
                } else if (!engine) {
                    console.warn('⚠️ [SimDemoPage] Engine not ready yet');
                } else {
                    console.warn('⚠️ [SimDemoPage] No simulation candles to send');
                }

            } catch (err) {
                console.error('❌ [SimDemoPage] Simulation Init Error:', err);
            }
        };

        initSimulation();
    }, [engine]); // Run once on mount (engine dependency for safety)

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
