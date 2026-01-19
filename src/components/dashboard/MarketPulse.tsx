'use client';

import { useEffect, useState } from 'react';

export function MarketPulse() {
    // Initial State: Indonesian Market Data
    const [markets, setMarkets] = useState([
        { symbol: 'COMPOSITE', name: 'IHSG', price: 7245.3, change: 0.45, up: true },
        { symbol: 'LQ45', name: 'Liquid 45', price: 984.2, change: -0.12, up: false },
        { symbol: 'BBCA', name: 'Bank Central Asia', price: 9850, change: 0.25, up: true }, // IDR prices usually integers or .00
        { symbol: 'BBRI', name: 'Bank Rakyat Ind', price: 5650, change: -0.50, up: false },
        { symbol: 'TLKM', name: 'Telkom Ind', price: 3980, change: 0.00, up: true },
        { symbol: 'ASII', name: 'Astra Intl', price: 5425, change: 1.10, up: true },
    ]);

    // ⚡ Simulation Effect: Make it feel "alive"
    useEffect(() => {
        const interval = setInterval(() => {
            setMarkets(current => current.map(m => {
                // Random micro-movement
                const isTickUp = Math.random() > 0.5;
                const changeAmount = (m.price * 0.0005) * (Math.random() * 0.5); // Small fluctuation
                const newPrice = isTickUp ? m.price + changeAmount : m.price - changeAmount;

                // Update change % slightly
                const newChange = m.change + (isTickUp ? 0.01 : -0.01);

                return {
                    ...m,
                    price: Number(newPrice.toFixed(0)), // Stocks in IDR no decimals usually
                    change: Number(newChange.toFixed(2)),
                    up: newChange >= 0
                };
            }));
        }, 3000); // Update every 3 seconds

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="bg-slate-900/30 border border-white/5 rounded-xl p-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Market Pulse (IDX)</h3>
            <div className="space-y-3">
                {markets.map((m) => (
                    <div key={m.symbol} className="flex items-center justify-between group cursor-pointer hover:bg-white/5 p-2 rounded transition-colors">
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-gray-200">{m.symbol}</span>
                            <span className="text-[10px] text-gray-500">{m.name}</span>
                        </div>
                        <div className="text-right">
                            <div className={`text-sm font-mono ${m.up ? 'text-emerald-400' : 'text-rose-400'} transition-colors duration-500`}>
                                {m.price.toLocaleString('id-ID')}
                            </div>
                            <div className={`text-[10px] font-medium ${m.up ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {m.change > 0 ? '+' : ''}{m.change}%
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <button className="w-full mt-3 py-2 text-xs text-center text-blue-400 hover:text-blue-300 transition-colors border-t border-white/5 pt-3">
                View All IDX Stocks →
            </button>
        </div>
    );
}
