/**
 * Available Tickers for Trading
 * Indonesian (IDX) stocks only
 */
import type { Ticker } from '@/types';

export const IDX_TICKERS: Ticker[] = [
    // Banking
    { symbol: 'BBCA.JK', name: 'Bank Central Asia Tbk', market: 'IDX', category: 'Banking' },
    { symbol: 'BBRI.JK', name: 'Bank Rakyat Indonesia Tbk', market: 'IDX', category: 'Banking' },
    { symbol: 'BMRI.JK', name: 'Bank Mandiri Tbk', market: 'IDX', category: 'Banking' },
    { symbol: 'BBNI.JK', name: 'Bank Negara Indonesia Tbk', market: 'IDX', category: 'Banking' },

    // Telecommunications
    { symbol: 'TLKM.JK', name: 'Telkom Indonesia Tbk', market: 'IDX', category: 'Telecom' },
    { symbol: 'EXCL.JK', name: 'XL Axiata Tbk', market: 'IDX', category: 'Telecom' },

    // Consumer
    { symbol: 'UNVR.JK', name: 'Unilever Indonesia Tbk', market: 'IDX', category: 'Consumer' },
    { symbol: 'ICBP.JK', name: 'Indofood CBP Sukses Makmur Tbk', market: 'IDX', category: 'Consumer' },

    // Energy & Mining
    { symbol: 'ASII.JK', name: 'Astra International Tbk', market: 'IDX', category: 'Automotive' },
    { symbol: 'ADRO.JK', name: 'Adaro Energy Indonesia Tbk', market: 'IDX', category: 'Mining' },
];

export const ALL_TICKERS: Ticker[] = [...IDX_TICKERS];

export const POPULAR_TICKERS: Ticker[] = [
    IDX_TICKERS[0], // BBCA
    IDX_TICKERS[1], // BBRI
    IDX_TICKERS[2], // BMRI
    IDX_TICKERS[4], // TLKM
    IDX_TICKERS[6], // UNVR
];

export function getTickerBySymbol(symbol: string): Ticker | undefined {
    return ALL_TICKERS.find((t) => t.symbol === symbol);
}

export function getTickersByMarket(market: 'IDX'): Ticker[] {
    return IDX_TICKERS;
}

/**
 * Get random IDX ticker for auto-selection
 */
export function getRandomIDXTicker(): Ticker {
    const randomIndex = Math.floor(Math.random() * IDX_TICKERS.length);
    return IDX_TICKERS[randomIndex];
}

/**
 * Check if ticker symbol is IDX ticker
 */
export function isIDXTickerSymbol(symbol: string): boolean {
    return IDX_TICKERS.some(t => t.symbol === symbol);
}
