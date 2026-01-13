/**
 * PendingOrders Component
 * Display list of active pending orders with cancel functionality
 */
'use client';

import { useTradingStore } from '@/stores';

export function PendingOrders() {
    const { pendingOrders, cancelPendingOrder } = useTradingStore();

    if (pendingOrders.length === 0) {
        return (
            <div className="px-4 py-8 text-center border-dashed border border-[var(--bg-tertiary)] rounded-lg mx-2 bg-[var(--bg-tertiary)]/10">
                <span className="text-xs text-[var(--text-tertiary)]">No pending orders</span>
            </div>
        );
    }

    return (
        <div className="px-2 space-y-4">
            <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                Pending ({pendingOrders.length})
            </h3>

            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {pendingOrders.map((order) => {
                    const isParent = !order.parentOrderId;
                    const isBracketChild = !!order.parentOrderId && !!order.ocoGroupId;
                    const isBuy = order.side === 'BUY';

                    return (
                        <div
                            key={order.id}
                            className={`
                                relative p-2.5 rounded-r-md border-l-2 bg-[var(--bg-tertiary)]/30 hover:bg-[var(--bg-tertiary)]/50 transition-colors
                                ${isBuy ? 'border-[var(--color-profit)]' : 'border-[var(--color-loss)]'}
                                ${isBracketChild ? 'ml-4 opacity-80 scale-95 border-l-[var(--text-tertiary)]' : ''}
                            `}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    {/* Order Header */}
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <span className={`text-[10px] font-bold uppercase ${isBuy ? 'text-[var(--color-profit)]' : 'text-[var(--color-loss)]'}`}>
                                            {order.side}
                                        </span>
                                        <span className="text-xs font-medium text-[var(--text-primary)]">
                                            {order.orderType}
                                        </span>
                                        {isBracketChild && <span className="text-[10px] bg-[var(--bg-tertiary)] px-1 rounded text-[var(--text-tertiary)]">OCO</span>}
                                    </div>

                                    {/* Order Details Grid */}
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[var(--text-tertiary)] text-[10px]">Shares</span>
                                            <span className="font-mono">{order.shares}</span>
                                        </div>

                                        {order.limitPrice && (
                                            <div className="flex items-center justify-between">
                                                <span className="text-[var(--text-tertiary)] text-[10px]">Px</span>
                                                <span className="font-mono">${order.limitPrice.toFixed(2)}</span>
                                            </div>
                                        )}

                                        {order.stopPrice && (
                                            <div className="flex items-center justify-between">
                                                <span className="text-[var(--text-tertiary)] text-[10px]">Stop</span>
                                                <span className="font-mono">${order.stopPrice.toFixed(2)}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Bracket Info (Compact) */}
                                    {isParent && (order.stopLoss || order.takeProfit) && (
                                        <div className="mt-2 pt-1 border-t border-[var(--bg-subtle-border)] flex gap-3 text-[10px]">
                                            {order.takeProfit && <span className="text-[var(--color-profit)]">TP: ${order.takeProfit}</span>}
                                            {order.stopLoss && <span className="text-[var(--color-loss)]">SL: ${order.stopLoss}</span>}
                                        </div>
                                    )}
                                </div>

                                {/* Cancel Button - Only for parent orders */}
                                {isParent && (
                                    <button
                                        onClick={() => cancelPendingOrder(order.id)}
                                        className="p-1 rounded opacity-50 hover:opacity-100 hover:bg-[var(--color-loss)]/10 text-[var(--text-secondary)] hover:text-[var(--color-loss)] transition-all"
                                        title="Cancel Order"
                                    >
                                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 1L11 11M1 11L11 1" /></svg>
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
