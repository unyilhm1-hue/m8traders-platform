'use client';

import { useChallengeStore } from '@/stores';
import { motion } from 'framer-motion';

export function ChallengeGrid() {
    const { challenges } = useChallengeStore();

    // Mock filtering if not in store yet
    // In real app, we filter based on level/prerequisites
    const available = challenges || [];

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Available Challenges
                <span className="text-xs font-normal text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">{available.length}</span>
            </h3>

            <div className="grid grid-cols-1 gap-3">
                {available.map((challenge, idx) => (
                    <motion.div
                        key={challenge.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="bg-slate-900/40 border border-white/5 hover:border-blue-500/30 rounded-xl p-4 transition-all cursor-pointer group relative overflow-hidden"
                    >
                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />

                        <div className="flex justify-between items-center">
                            <div>
                                <h4 className="font-bold text-gray-200 group-hover:text-blue-400 transition-colors">
                                    {challenge.title}
                                </h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                                        Gold Tier
                                    </span>
                                    <span className="text-xs text-gray-500">Entry: Free</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-sm font-bold text-emerald-400">
                                    Rp 50 Juta
                                </div>
                                <div className="text-[10px] text-gray-500">Funding Size</div>
                            </div>
                        </div>

                        {/* Hover Overlay Button */}
                        <div className="absolute inset-0 bg-blue-600/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[1px]">
                            <span className="bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-xl translate-y-2 group-hover:translate-y-0 transition-transform">
                                View Details
                            </span>
                        </div>
                    </motion.div>
                ))}

                {/* Coming Soon Placeholder */}
                <div className="bg-slate-900/20 border border-white/5 border-dashed rounded-xl p-4 flex items-center justify-center text-gray-600 text-sm">
                    More challenges comming soon...
                </div>
            </div>
        </div>
    );
}
