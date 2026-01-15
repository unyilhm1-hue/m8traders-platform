/**
 * MarketOverview Component
 * Displays a quick overview of key market indices/pairs
 */
'use client';

interface MarketItem {
    symbol: string;
    name: string;
    price: string;
    change: number;
    isCrypto?: boolean;
}

const MARKET_DATA: MarketItem[] = [
    { symbol: '^JKSE', name: 'IHSG', price: '7,321.54', change: 0.45 },
    { symbol: '^LQ45', name: 'LQ45', price: '984.21', change: -0.12 },
    { symbol: 'BTC-USD', name: 'Bitcoin', price: '$64,250', change: 1.25, isCrypto: true },
    { symbol: 'ETH-USD', name: 'Ethereum', price: '$3,450', change: 0.85, isCrypto: true },
    { symbol: 'BBRI.JK', name: 'BBRI', price: '5,400', change: -1.82 },
    { symbol: 'TLKM.JK', name: 'TLKM', price: '3,210', change: 0.31 },
];

export function MarketOverview() {
    return (
        <div className="glassmorphism rounded-lg p-5 border border-[var(--bg-tertiary)] bg-gradient-to-b from-[var(--bg-secondary)]/80 to-[var(--bg-primary)]/80">
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                <span className="text-[var(--accent-primary)]">📊</span> Market Pulse
            </h2>

            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {MARKET_DATA.map((item) => (
                    <div
                        key={item.symbol}
                        className="p-3 rounded-lg bg-[var(--bg-primary)]/50 border border-[var(--bg-tertiary)] hover:border-[var(--accent-primary)]/30 transition-colors group"
                    >
                        <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-bold text-[var(--text-secondary)]">
                                {item.name}
                            </span>
                            {item.isCrypto && (
                                <span className="text-[10px] bg-[var(--bg-tertiary)] px-1 rounded text-[var(--text-tertiary)]">
                                    24h
                                </span>
                            )}
                        </div>
                        <div className="text-sm font-mono font-medium text-[var(--text-primary)] mb-1">
                            {item.price}
                        </div>
                        <div
                            className={`text-xs font-bold flex items-center gap-1 ${item.change >= 0 ? 'text-[var(--color-profit)]' : 'text-[var(--color-loss)]'
                                }`}
                        >
                            <span>{item.change >= 0 ? '▲' : '▼'}</span>
                            {Math.abs(item.change)}%
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
