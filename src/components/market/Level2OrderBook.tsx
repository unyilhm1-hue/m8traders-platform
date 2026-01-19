/**
 * Level2OrderBook Component
 * Display bid/ask depth with volume visualization
 * Connected to simulation store for real-time updates
 */
'use client';

import { useOrderbook } from '@/stores/useSimulationStore';
import { formatPrice, formatPercent } from '@/lib/format';

interface Level2OrderBookProps {
    currentPrice?: number; // Optional, for compatibility
}

export function Level2OrderBook({ currentPrice: priceOverride }: Level2OrderBookProps) {
    // ✅ Subscribe to synthetic orderbook from simulation store (now properly memoized)
    const { bids, asks } = useOrderbook();

    if (!bids.length || !asks.length) {
        return (
            <div className="h-full flex flex-col bg-[var(--bg-secondary)]">
                <div className="p-3 border-b border-[var(--bg-tertiary)]">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">Level 2</h3>
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">Waiting for data...</p>
                </div>
            </div>
        );
    }

    // Calculate max volume for visualization
    const maxBidVolume = Math.max(...bids.map((b) => b.volume));
    const maxAskVolume = Math.max(...asks.map((a) => a.volume));
    const maxVolume = Math.max(maxBidVolume, maxAskVolume);

    // Calculate spread
    const bestBid = bids[0]?.price || 0;
    const bestAsk = asks[0]?.price || 0;
    const spread = bestAsk - bestBid;
    const midPrice = (bestBid + bestAsk) / 2;
    const spreadPercent = midPrice > 0 ? (spread / midPrice) * 100 : 0;

    return (
        <div className="h-full flex flex-col bg-[var(--bg-secondary)]">
            {/* Header */}
            <div className="p-3 border-b border-[var(--bg-tertiary)]">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Level 2</h3>
                <div className="mt-1 flex items-baseline gap-2 text-xs">
                    <span className="text-[var(--text-tertiary)]">Spread:</span>
                    <span className="text-[var(--text-primary)] font-mono">
                        Rp {spread.toFixed(0)}
                    </span>
                    <span className="text-[var(--text-tertiary)]">
                        ({spreadPercent.toFixed(3)}%)
                    </span>
                </div>
            </div>

            {/* Order Book Content Wrapper */}
            <div className="flex-1 min-h-0 flex flex-col">

                {/* Asks (Top Half) */}
                <div className="flex-1 min-h-0 overflow-y-auto flex flex-col justify-end border-b border-[var(--bg-tertiary)]">
                    <div className="border-b border-[var(--bg-tertiary)] pb-1 sticky top-0 bg-[var(--bg-secondary)] z-10">
                        <div className="grid grid-cols-3 gap-2 px-3 py-1.5 text-xs font-semibold text-[var(--text-tertiary)]">
                            <div className="text-right">Price</div>
                            <div className="text-right">Size</div>
                            <div className="text-right">Orders</div>
                        </div>
                    </div>

                    <div>
                        {asks.slice(0, 8).reverse().map((ask, idx) => {
                            const percent = (ask.volume / maxVolume) * 100;
                            return (
                                <div
                                    key={`ask-${idx}`}
                                    className="relative grid grid-cols-3 gap-2 px-3 py-1 text-xs font-mono"
                                >
                                    <div
                                        className="absolute right-0 top-0 bottom-0 bg-red-500/10"
                                        style={{ width: `${percent}%` }}
                                    />
                                    <div className="relative text-right text-red-400">
                                        {ask.price.toLocaleString('id-ID')}
                                    </div>
                                    <div className="relative text-right text-[var(--text-primary)]">
                                        {ask.volume.toLocaleString()}
                                    </div>
                                    <div className="relative text-right text-[var(--text-secondary)]">
                                        {ask.count}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Spread Indicator (Middle - Fixed) */}
                <div className="py-2 px-3 bg-[var(--bg-tertiary)] flex items-center justify-between shrink-0 z-20 shadow-sm">
                    <span className="text-xs font-semibold text-[var(--text-primary)]">
                        Spread: Rp {spread.toFixed(0)}
                    </span>
                    <span className="text-xs text-[var(--text-tertiary)]">
                        Mid: Rp {midPrice.toFixed(0)}
                    </span>
                </div>

                {/* Bids (Bottom Half) */}
                <div className="flex-1 min-h-0 overflow-y-auto pt-1">
                    {bids.slice(0, 8).map((bid, idx) => {
                        const percent = (bid.volume / maxVolume) * 100;
                        return (
                            <div
                                key={`bid-${idx}`}
                                className="relative grid grid-cols-3 gap-2 px-3 py-1 text-xs font-mono"
                            >
                                <div
                                    className="absolute right-0 top-0 bottom-0 bg-green-500/10"
                                    style={{ width: `${percent}%` }}
                                />
                                <div className="relative text-right text-green-400">
                                    {bid.price.toLocaleString('id-ID')}
                                </div>
                                <div className="relative text-right text-[var(--text-primary)]">
                                    {bid.volume.toLocaleString()}
                                </div>
                                <div className="relative text-right text-[var(--text-secondary)]">
                                    {bid.count}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
