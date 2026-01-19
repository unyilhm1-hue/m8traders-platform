'use client';

import { useChallengeStore } from '@/stores';
import { motion } from 'framer-motion';

export function ActiveChallenge() {
    const { activeChallenge } = useChallengeStore();

    if (!activeChallenge) {
        return (
            <div className="h-full min-h-[300px] flex flex-col items-center justify-center p-8 text-center bg-slate-900/20 border border-white/5 rounded-2xl border-dashed">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 text-2xl">
                    🚀
                </div>
                <h3 className="text-white font-medium mb-1">No Active Challenge</h3>
                <p className="text-gray-500 text-sm max-w-xs mx-auto mb-6">
                    Start a new challenge to earn funding and prove your trading skills.
                </p>
                <a href="#available-challenges" className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors">
                    Browse Challenges
                </a>
            </div>
        );
    }

    // Mock IDR data
    const profitTarget = 50000000; // 50 Juta
    const currentProfit = 12500000; // 12.5 Juta
    const progressPercent = (currentProfit / profitTarget) * 100;
    const daysLeft = 24;

    return (
        <div className="p-6 rounded-2xl bg-gradient-to-b from-slate-900/60 to-black/60 border border-white/10 backdrop-blur-md">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 mb-2 uppercase tracking-wide">
                        Active Mission
                    </span>
                    <h2 className="text-xl font-bold text-white">{activeChallenge.title}</h2>
                    <p className="text-sm text-gray-400">{activeChallenge.description}</p>
                    <div className="mt-1 text-xs text-gray-500 uppercase tracking-widest font-mono">ID: {activeChallenge.id.slice(0, 8)}</div>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-bold text-white">{daysLeft}</div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider">Days Left</div>
                </div>
            </div>

            {/* Main Progress Bar */}
            <div className="mb-8">
                <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Profit Target</span>
                    <span className="text-white font-medium">Rp {currentProfit.toLocaleString('id-ID')} / Rp {profitTarget.toLocaleString('id-ID')}</span>
                </div>
                <div className="h-4 bg-gray-800 rounded-full overflow-hidden relative">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        className="h-full bg-gradient-to-r from-blue-600 to-cyan-500"
                    />
                    {/* Tick marks */}
                    <div className="absolute top-0 bottom-0 left-1/4 w-px bg-white/5" />
                    <div className="absolute top-0 bottom-0 left-2/4 w-px bg-white/5" />
                    <div className="absolute top-0 bottom-0 left-3/4 w-px bg-white/5" />
                </div>
            </div>

            {/* Health Stats */}
            <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                    <div className="text-xs text-gray-500 mb-1">Max Drawdown</div>
                    <div className="text-lg font-mono text-emerald-400">1.2% <span className="text-gray-600 text-xs">/ 10%</span></div>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                    <div className="text-xs text-gray-500 mb-1">Daily Loss</div>
                    <div className="text-lg font-mono text-emerald-400">0.5% <span className="text-gray-600 text-xs">/ 5%</span></div>
                </div>
            </div>

            <button className="w-full mt-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2">
                <span>Continue Trading</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </button>
        </div>
    );
}
