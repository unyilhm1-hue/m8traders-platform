/**
 * Dashboard Page
 * Main landing page after login
 */
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useChallengeStore } from '@/stores';
import { WelcomeCard, LearningProgress, QuickAccessGrid, MarketOverview } from '@/components/dashboard';

export default function DashboardPage() {
    const [userName, setUserName] = useState<string>('Trader');
    const [userId, setUserId] = useState<string | null>(null);
    const { loadUserStats, loadChallenges } = useChallengeStore();

    // Get user data
    useEffect(() => {
        const supabase = createClient();
        supabase.auth.getUser().then(({ data }) => {
            if (data.user) {
                setUserId(data.user.id);
                // Extract name from email or metadata
                const email = data.user.email || '';
                const name = data.user.user_metadata?.full_name || email.split('@')[0];
                setUserName(name);
            }
        });
    }, []);

    // Load challenge stats
    useEffect(() => {
        if (userId) {
            loadUserStats(userId);
        }
        loadChallenges();
    }, [userId, loadUserStats, loadChallenges]);

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] py-8 relative overflow-hidden">
            {/* Background Ambience */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-[var(--accent-purple)] opacity-10 rounded-full blur-[128px] pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[var(--accent-primary)] opacity-5 rounded-full blur-[128px] pointer-events-none" />

            <div className="max-w-7xl mx-auto px-6 relative z-10">
                {/* Page Header */}
                <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                    <div>
                        <h1 className="text-4xl font-bold text-[var(--text-primary)] mb-2 tracking-tight">
                            Dashboard
                        </h1>
                        <p className="text-[var(--text-secondary)] font-medium">
                            Disiplin Dulu, Profit Kemudian 🚀
                        </p>
                    </div>
                    <div className="text-right hidden md:block">
                        <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Market Status</p>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[var(--color-profit)] animate-pulse" />
                            <span className="text-sm font-bold text-[var(--text-primary)]">OPEN</span>
                        </div>
                    </div>
                </div>

                {/* Main Grid */}
                <div className="space-y-8">
                    {/* Top Section: Welcome & Market Pulse */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2">
                            <WelcomeCard userName={userName} />
                        </div>
                        <div className="lg:col-span-1">
                            <MarketOverview />
                        </div>
                    </div>

                    {/* Middle Section: Progress & Stats */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-3">
                            <LearningProgress />
                        </div>
                    </div>

                    {/* Bottom Section: Quick Access */}
                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-[var(--text-primary)]">
                                Quick Access
                            </h2>
                        </div>
                        <QuickAccessGrid />
                    </div>
                </div>
            </div>
        </div>
    );
}
