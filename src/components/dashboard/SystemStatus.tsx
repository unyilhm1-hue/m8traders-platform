'use client';

import { useState } from 'react';
import { DataUpdaterButton } from '@/components/data/DataUpdaterButton';
import { motion, AnimatePresence } from 'framer-motion';

export function SystemStatus({ isAdmin }: { isAdmin: boolean }) {
    // Open by default for easier access during testing
    const [isOpen, setIsOpen] = useState(true);

    if (!isAdmin) return null;

    return (
        <div className="bg-slate-900/30 border border-white/5 rounded-xl overflow-hidden mt-6">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-4 py-3 flex items-center justify-between text-xs text-gray-400 hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-medium">System Status: Operational</span>
                </div>
                <span className="text-gray-600">{isOpen ? 'Hide Admin Tools' : 'Show Admin Tools'} ▼</span>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-white/5 bg-black/20"
                    >
                        <div className="p-4 grid grid-cols-1 gap-4">
                            <div>
                                <h4 className="text-xs font-bold text-gray-500 mb-2 uppercase">Data Feeds</h4>
                                <DataUpdaterButton />
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-gray-500 mb-2 uppercase">Debug Info</h4>
                                <div className="text-[10px] text-gray-600 font-mono p-2 bg-black/40 rounded">
                                    Version: 2.1.0 (Beta)<br />
                                    Environment: Development<br />
                                    Next.js: 14.1.0
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
