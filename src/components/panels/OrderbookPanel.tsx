'use client';

import { OrderbookDisplay } from '../trading/OrderbookDisplay';
import { useOrderbook } from '@/hooks/useOrderbook';
import type { Candle } from '@/types';

interface OrderbookPanelProps {
    currentCandle: Candle | null;
    atr: number;
    onPriceClick?: (price: number) => void;
}

export function OrderbookPanel({ currentCandle, atr, onPriceClick }: OrderbookPanelProps) {
    const { orderbook, loading } = useOrderbook(currentCandle, atr);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-pulse text-gray-400">Loading orderbook...</div>
            </div>
        );
    }

    return (
        <div className="h-full bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
            <OrderbookDisplay
                orderbook={orderbook}
                onPriceClick={onPriceClick}
            />
        </div>
    );
}
