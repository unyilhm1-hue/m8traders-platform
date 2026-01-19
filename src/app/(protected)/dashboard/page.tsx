/**
 * Premium Dashboard Page
 * High-density command center for traders
 */
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useChallengeStore } from '@/stores';

// New Premium Components
import { StatsHeader } from '@/components/dashboard/StatsHeader';
import { ActiveChallenge } from '@/components/dashboard/ActiveChallenge';
import { ChallengeGrid } from '@/components/dashboard/ChallengeGrid';
import { MarketPulse } from '@/components/dashboard/MarketPulse';
import { SystemStatus } from '@/components/dashboard/SystemStatus';
import { PerformanceAnalytics } from '@/components/dashboard/PerformanceAnalytics';

export default function DashboardPage() {
    const [userEmail, setUserEmail] = useState<string>('');
    const { loadUserStats, loadChallenges } = useChallengeStore();
    const [userId, setUserId] = useState<string | null>(null);

    // 🔥 Admin email check 
    const ADMIN_EMAILS = [
        'admin@m8traders.com',
        'laras@example.com',
    ];
    const TESTING_MODE = true;
    const isAdmin = TESTING_MODE || ADMIN_EMAILS.includes(userEmail.toLowerCase());

    // Init Data
    useEffect(() => {
        const supabase = createClient();
        supabase.auth.getUser().then(({ data }) => {
            if (data.user) {
                setUserId(data.user.id);
                setUserEmail(data.user.email || '');
            }
        });
    }, []);

    useEffect(() => {
        if (userId) {
            loadUserStats(userId);
        }
        loadChallenges();
    }, [userId, loadUserStats, loadChallenges]);

    return (
        <div className="min-h-screen bg-[#0B0E14] text-gray-200 p-6 font-sans selection:bg-blue-500/30">
            {/* Ambient Background */}
            <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
                <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-blue-900/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-purple-900/10 rounded-full blur-[120px]" />
            </div>

            <div className="relative z-10 max-w-[1400px] mx-auto">
                {/* 1. Header Stats (Hero) */}
                <header className="mb-8">
                    <div className="flex items-end justify-between mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-white tracking-tight">Command Center</h1>
                            <p className="text-gray-500 text-sm">Welcome back, Trader. Market is OPEN.</p>
                        </div>
                        <div className="hidden md:flex gap-3">
                            <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm border border-white/5 transition-colors">
                                📒 Journal
                            </button>
                            <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-blue-900/20">
                                + New Simulation
                            </button>
                        </div>
                    </div>

                    <StatsHeader />
                </header>

                {/* 2. Main Grid Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* LEFT COL: Focus (Active Challenge) - 66% width on large screens */}
                    <div className="lg:col-span-2 space-y-6">
                        <section>
                            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 px-1">Current Mission</h2>
                            <ActiveChallenge />
                        </section>

                        {/* Recent Activity / Performance Graph Placeholder */}
                        <section>
                            <PerformanceAnalytics />
                        </section>
                    </div>

                    {/* RIGHT COL: Secondary Info - 33% width */}
                    <div className="lg:col-span-1 space-y-6">

                        {/* Admin Tools (Priority Visibility) */}
                        <SystemStatus isAdmin={true} />

                        {/* Market Pulse */}
                        <MarketPulse />

                        {/* Available Challenges List */}
                        <ChallengeGrid />
                    </div>
                </div>
            </div>
        </div>
    );
}

