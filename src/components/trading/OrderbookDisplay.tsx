'use client';

import type { OrderbookSnapshot } from '@/types/market';

interface OrderbookDisplayProps {
    orderbook: OrderbookSnapshot | null;
    highlightPrice?: number; // untuk highlight current position
    onPriceClick?: (price: number) => void; // quick order entry
}

export function OrderbookDisplay({
    orderbook,
    highlightPrice,
    onPriceClick,
}: OrderbookDisplayProps) {
    if (!orderbook) {
        return (
            <div className="flex items-center justify-center h-full text-gray-400">
                No orderbook data
            </div>
        );
    }

    const { bids, asks, spread, spreadPercent, midPrice } = orderbook;

    // Find max quantity untuk scaling volume bars
    const maxQuantity = Math.max(
        ...bids.map((b) => b.quantity),
        ...asks.map((a) => a.quantity)
    );

    return (
        <div className="flex flex-col h-full text-sm">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700">
                <div className="text-xs text-gray-400">Order Book</div>
                <div className="flex items-center gap-3 text-xs">
                    <div className="text-gray-400">
                        Spread:{' '}
                        <span className="text-white font-medium">
                            {spread.toLocaleString('id-ID', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                            })}
                        </span>{' '}
                        ({spreadPercent.toFixed(2)}%)
                    </div>
                    <div className="text-gray-400">
                        Mid:{' '}
                        <span className="text-white font-medium">
                            {midPrice.toLocaleString('id-ID')}
                        </span>
                    </div>
                </div>
            </div>

            {/* Column Headers */}
            <div className="grid grid-cols-3 gap-2 px-3 py-1.5 bg-gray-800/50 text-xs text-gray-400 font-medium border-b border-gray-700">
                <div className="text-left">Price</div>
                <div className="text-right">Quantity</div>
                <div className="text-right">Orders</div>
            </div>

            {/* Orderbook Levels */}
            <div className="flex-1 overflow-y-auto">
                {/* Asks (descending order - highest to lowest) */}
                <div className="flex flex-col-reverse">
                    {asks.slice(0, 10).map((ask, idx) => (
                        <OrderbookRow
                            key={`ask-${idx}`}
                            price={ask.price}
                            quantity={ask.quantity}
                            orders={ask.orders}
                            side="ask"
                            maxQuantity={maxQuantity}
                            isHighlighted={
                                highlightPrice !== undefined && ask.price === highlightPrice
                            }
                            onClick={() => onPriceClick?.(ask.price)}
                        />
                    ))}
                </div>

                {/* Spread Separator */}
                <div className="py-2 px-3 bg-gray-900/50 border-y border-gray-700">
                    <div className="text-center text-xs text-gray-400">
                        ─── Spread: {spread.toLocaleString('id-ID')} ───
                    </div>
                </div>

                {/* Bids (ascending order - highest to lowest) */}
                <div>
                    {bids.slice(0, 10).map((bid, idx) => (
                        <OrderbookRow
                            key={`bid-${idx}`}
                            price={bid.price}
                            quantity={bid.quantity}
                            orders={bid.orders}
                            side="bid"
                            maxQuantity={maxQuantity}
                            isHighlighted={
                                highlightPrice !== undefined && bid.price === highlightPrice
                            }
                            onClick={() => onPriceClick?.(bid.price)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

interface OrderbookRowProps {
    price: number;
    quantity: number;
    orders: number;
    side: 'bid' | 'ask';
    maxQuantity: number;
    isHighlighted: boolean;
    onClick: () => void;
}

function OrderbookRow({
    price,
    quantity,
    orders,
    side,
    maxQuantity,
    isHighlighted,
    onClick,
}: OrderbookRowProps) {
    // Calculate bar width percentage
    const barWidth = (quantity / maxQuantity) * 100;

    // Color scheme
    const colors = {
        bid: {
            text: 'text-green-400',
            bg: 'bg-green-500/20',
            hover: 'hover:bg-green-500/30',
        },
        ask: {
            text: 'text-red-400',
            bg: 'bg-red-500/20',
            hover: 'hover:bg-red-500/30',
        },
    };

    const color = colors[side];

    return (
        <div
            className={`
                relative grid grid-cols-3 gap-2 px-3 py-1.5 cursor-pointer
                transition-colors duration-150
                ${color.hover}
                ${isHighlighted ? 'bg-blue-500/20' : ''}
            `}
            onClick={onClick}
        >
            {/* Volume Bar (background) */}
            <div
                className={`absolute inset-0 ${color.bg}`}
                style={{
                    width: `${barWidth}%`,
                    right: side === 'ask' ? 0 : 'auto',
                }}
            />

            {/* Content (foreground) */}
            <div className={`relative z-10 text-left font-medium ${color.text}`}>
                {price.toLocaleString('id-ID', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                })}
            </div>
            <div className="relative z-10 text-right text-gray-300">
                {quantity.toLocaleString('id-ID')}
            </div>
            <div className="relative z-10 text-right text-gray-400 text-xs">
                {orders}
            </div>
        </div>
    );
}
