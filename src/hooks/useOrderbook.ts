import { useState, useEffect } from 'react';
import { generateOrderbook } from '@/lib/market/orderbookGenerator';
import type { OrderbookSnapshot, OrderbookConfig } from '@/types/market';
import type { Candle } from '@/types';

/**
 * Hook untuk generate dan manage orderbook state
 *
 * @param currentCandle - Candle data untuk generate orderbook
 * @param atr - Average True Range untuk volatility calculation
 * @param config - Optional configuration
 */
export function useOrderbook(
    currentCandle: Candle | null,
    atr: number,
    config?: Partial<OrderbookConfig>
) {
    const [orderbook, setOrderbook] = useState<OrderbookSnapshot | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!currentCandle) {
            setOrderbook(null);
            return;
        }

        setLoading(true);

        // Debounce untuk performa (avoid rapid regeneration)
        const timeout = setTimeout(() => {
            try {
                const ob = generateOrderbook(currentCandle, {
                    atr,
                    numLevels: config?.numLevels ?? 8,
                    baseSpreadTicks: config?.baseSpreadTicks ?? 2.5,
                });

                setOrderbook(ob);
            } catch (error) {
                console.error('Error generating orderbook:', error);
                setOrderbook(null);
            } finally {
                setLoading(false);
            }
        }, 100); // 100ms debounce

        return () => clearTimeout(timeout);
    }, [currentCandle?.t, atr, config?.numLevels, config?.baseSpreadTicks]);

    return { orderbook, loading };
}
