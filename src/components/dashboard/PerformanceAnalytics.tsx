'use client';

import { motion } from 'framer-motion';

export function PerformanceAnalytics() {
    // Dummy Data: 14 Days PnL (Green/Red bars)
    // Values roughly between -2M and +5M IDR
    const data = [
        1500000, 2200000, -800000, 3100000, 500000,
        -1200000, 4200000, 3800000, -500000, 1000000,
        2500000, 5500000, -200000, 4800000
    ];

    const maxVal = Math.max(...data.map(Math.abs));
    const height = 120;

    return (
        <div className="p-6 rounded-2xl bg-slate-900/20 border border-white/5 relative overflow-hidden">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Performance Analytics</h3>
                    <p className="text-xs text-gray-500">Last 14 Days PnL (Simulated)</p>
                </div>
                <div className="text-right">
                    <div className="text-xl font-bold text-emerald-400">+Rp 18.4 Juta</div>
                    <div className="text-[10px] text-gray-500">Net Profit</div>
                </div>
            </div>

            {/* Simple SVG Bar Chart */}
            <div className="h-[120px] w-full flex items-end justify-between gap-1">
                {data.map((val, i) => {
                    const isPositive = val >= 0;
                    const barHeight = (Math.abs(val) / maxVal) * 100;

                    return (
                        <div key={i} className="flex-1 flex flex-col justify-end items-center h-full group relative">
                            {/* Bar */}
                            <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: `${barHeight}%` }}
                                transition={{ delay: i * 0.05, duration: 0.5, type: 'spring' }}
                                className={`w-full max-w-[20px] rounded-t-sm opacity-80 group-hover:opacity-100 transition-opacity ${isPositive ? 'bg-emerald-500' : 'bg-rose-500'
                                    }`}
                            />
                            {/* Tooltip */}
                            <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] bg-black border border-white/10 px-2 py-1 rounded whitespace-nowrap z-10 pointer-events-none">
                                {isPositive ? '+' : ''}Rp {(val / 1000000).toFixed(1)}Jt
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* X-Axis Line */}
            <div className="w-full h-px bg-white/10 mt-1" />
        </div>
    );
}
