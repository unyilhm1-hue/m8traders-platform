/**
 * Sample chart data for development and testing
 * Real historical data will be loaded from API in production
 */
import type { Candle } from '@/types';

/**
 * Generate sample OHLCV data
 */
export function generateSampleData(
    count: number = 200,
    startPrice: number = 150,
    startTime?: number
): Candle[] {
    const data: Candle[] = [];
    let price = startPrice;
    let time = startTime || Date.now() - count * 5 * 60 * 1000; // 5 min intervals

    for (let i = 0; i < count; i++) {
        const volatility = 0.02; // 2% volatility
        const change = (Math.random() - 0.48) * volatility * price; // Slight upward bias
        const open = price;
        const close = price + change;
        const high = Math.max(open, close) + Math.random() * volatility * 0.5 * price;
        const low = Math.min(open, close) - Math.random() * volatility * 0.5 * price;
        const volume = Math.floor(50000 + Math.random() * 150000);

        data.push({
            t: time,
            o: parseFloat(open.toFixed(2)),
            h: parseFloat(high.toFixed(2)),
            l: parseFloat(low.toFixed(2)),
            c: parseFloat(close.toFixed(2)),
            v: volume,
        });

        price = close;
        time += 5 * 60 * 1000; // 5 minutes
    }

    return data;
}

/**
 * Convert our Candle to KLineChart format
 */
export interface KLineData {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
    turnover?: number;
}

export function toKLineData(candles: Candle[]): KLineData[] {
    return candles.map((c) => ({
        timestamp: c.t,
        open: c.o,
        high: c.h,
        low: c.l,
        close: c.c,
        volume: c.v,
    }));
}

/**
 * Sample ticker data for demo
 */
export const SAMPLE_TICKERS = [
    { symbol: 'BBCA.JK', name: 'Bank Central Asia', price: 9875 },
    { symbol: 'BBRI.JK', name: 'Bank Rakyat Indonesia', price: 5925 },
    { symbol: 'TLKM.JK', name: 'Telkom Indonesia', price: 4150 },
    { symbol: 'ASII.JK', name: 'Astra International', price: 5425 },
    { symbol: 'BMRI.JK', name: 'Bank Mandiri', price: 7100 },
    { symbol: 'ADRO.JK', name: 'Adaro Energy', price: 2380 },
    { symbol: 'GOTO.JK', name: 'GoTo Gojek Tokopedia', price: 84 },
    { symbol: 'UNTR.JK', name: 'United Tractors', price: 22450 },
    { symbol: 'MDKA.JK', name: 'Merdeka Copper Gold', price: 2600 },
    { symbol: 'BRPT.JK', name: 'Barito Pacific', price: 1040 },
    { symbol: 'PGAS.JK', name: 'Perusahaan Gas Negara', price: 1140 },
    { symbol: 'ANTM.JK', name: 'Aneka Tambang', price: 1650 },
    { symbol: 'INDF.JK', name: 'Indofood Sukses Makmur', price: 6450 },
    { symbol: 'ICBP.JK', name: 'Indofood CBP', price: 10900 },
    { symbol: 'BBNI.JK', name: 'Bank Negara Indonesia', price: 5325 },
];

/**
 * Get sample data for a specific ticker
 */
export function getSampleTickerData(symbol: string): Candle[] {
    const ticker = SAMPLE_TICKERS.find((t) => t.symbol === symbol);
    const startPrice = ticker?.price || 100;
    return generateSampleData(200, startPrice);
}
