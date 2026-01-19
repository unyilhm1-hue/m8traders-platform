'use client';

import { useChallengeStore } from '@/stores';
import { LEVEL_CONFIGS } from '@/types/challenge';
import { motion } from 'framer-motion';

export function StatsHeader() {
    const { userStats } = useChallengeStore();

    // Mock data if stats not loaded yet
    const balance = 100000; // Mock balance for dashboard visual
    const level = userStats?.current_level || 1;
    const xp = userStats?.total_xp || 0;
    const winRate = 68.5; // Mock winrate for visual impact

    const rankConfig = LEVEL_CONFIGS.find(c => c.level === level);
    const rankName = rankConfig?.name || 'Novice Trader';

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {/* Balance Card (Primary) */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="col-span-1 md:col-span-2 p-6 rounded-2xl bg-gradient-to-br from-blue-900/40 to-slate-900/40 border border-blue-500/20 backdrop-blur-md relative overflow-hidden group"
            >
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <svg className="w-24 h-24 text-blue-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.15-1.46-3.27-3.4h1.96c.1 1.05 1.18 1.91 2.53 1.91 1.29 0 2.13-.81 2.13-1.88 0-1.09-.86-1.72-2.46-2.09l-1.04-.25c-2.46-.57-3.47-2.18-3.47-3.81 0-1.58 1.15-2.77 2.92-3.11V4h2.67v1.93c1.38.35 2.58 1.54 2.7 3.07h-1.97c-.15-.79-1.03-1.45-2.08-1.45-1.12 0-1.86.73-1.86 1.59 0 1.11.89 1.68 2.48 2.05l1.04.25c2.69.6 3.57 2.38 3.57 3.98 0 1.58-1.15 2.8-2.92 3.16z" /></svg>
                </div>

                <h3 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-1">Total Balance</h3>
                <div className="text-4xl font-bold text-white tracking-tight">
                    Rp {balance.toLocaleString('id-ID')}
                </div>
                <div className="mt-4 flex items-center gap-2">
                    <span className="bg-green-500/20 text-green-400 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        +2.4% Today
                    </span>
                    <span className="text-gray-500 text-xs">vs yesterday</span>
                </div>
            </motion.div>

            {/* Rank & Level */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="p-6 rounded-2xl bg-slate-900/40 border border-white/5 backdrop-blur-md flex flex-col justify-between"
            >
                <div>
                    <h3 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-1">Current Rank</h3>
                    <div className="text-2xl font-bold text-white flex items-center gap-2">
                        {rankName}
                        <span className="text-yellow-500 text-lg">★</span>
                    </div>
                </div>
                <div className="mt-4">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Level {level}</span>
                        <span>{xp} XP</span>
                    </div>
                    <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: '45%' }}
                            className="h-full bg-blue-500 rounded-full"
                        />
                    </div>
                </div>
            </motion.div>

            {/* Win Rate */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="p-6 rounded-2xl bg-slate-900/40 border border-white/5 backdrop-blur-md flex flex-col justify-between"
            >
                <div>
                    <h3 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-1">Global Win Rate</h3>
                    <div className="text-3xl font-bold text-emerald-400">
                        {winRate}%
                    </div>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                    Based on last 50 trades
                </div>
            </motion.div>
        </div>
    );
}
