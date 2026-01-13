/**
 * Available Tickers for Trading
 * Organized by market (US / IDX)
 */
import type { Ticker } from '@/types';

export const US_TICKERS: Ticker[] = [
    // Tech Giants
    { symbol: 'AAPL', name: 'Apple Inc.', market: 'US', category: 'Technology' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', market: 'US', category: 'Technology' },
    { symbol: 'MSFT', name: 'Microsoft Corporation', market: 'US', category: 'Technology' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', market: 'US', category: 'Technology' },
    { symbol: 'META', name: 'Meta Platforms Inc.', market: 'US', category: 'Technology' },
    { symbol: 'NVDA', name: 'NVIDIA Corporation', market: 'US', category: 'Technology' },
    { symbol: 'TSLA', name: 'Tesla Inc.', market: 'US', category: 'Automotive' },

    // Finance
    { symbol: 'JPM', name: 'JPMorgan Chase & Co.', market: 'US', category: 'Finance' },
    { symbol: 'BAC', name: 'Bank of America Corp.', market: 'US', category: 'Finance' },
    { symbol: 'GS', name: 'Goldman Sachs Group Inc.', market: 'US', category: 'Finance' },

    // Consumer
    { symbol: 'WMT', name: 'Walmart Inc.', market: 'US', category: 'Retail' },
    { symbol: 'DIS', name: 'Walt Disney Company', market: 'US', category: 'Entertainment' },
    { symbol: 'NKE', name: 'Nike Inc.', market: 'US', category: 'Consumer' },
];

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

export const ALL_TICKERS: Ticker[] = [...US_TICKERS, ...IDX_TICKERS];

export const POPULAR_TICKERS: Ticker[] = [
    US_TICKERS[0], // AAPL
    US_TICKERS[1], // GOOGL
    US_TICKERS[2], // MSFT
    US_TICKERS[6], // TSLA
    IDX_TICKERS[0], // BBCA
    IDX_TICKERS[1], // BBRI
    IDX_TICKERS[4], // TLKM
];

export function getTickerBySymbol(symbol: string): Ticker | undefined {
    return ALL_TICKERS.find((t) => t.symbol === symbol);
}

export function getTickersByMarket(market: 'US' | 'IDX'): Ticker[] {
    return market === 'US' ? US_TICKERS : IDX_TICKERS;
}
