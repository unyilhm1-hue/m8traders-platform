/**
 * Dashboard Page
 * Main landing page after login
 */
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useChallengeStore } from '@/stores';
import { WelcomeCard, LearningProgress, QuickAccessGrid } from '@/components/dashboard';

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
        <div className="min-h-screen bg-[var(--bg-primary)] py-8">
            <div className="max-w-7xl mx-auto px-6">
                {/* Page Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-[var(--text-primary)] mb-2">
                        Dashboard
                    </h1>
                    <p className="text-[var(--text-secondary)]">
                        Disiplin Dulu, Profit Kemudian
                    </p>
                </div>

                {/* Main Grid */}
                <div className="space-y-6">
                    {/* Row 1: Welcome + Progress */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <WelcomeCard userName={userName} />
                        <LearningProgress />
                    </div>

                    {/* Row 2: Quick Access */}
                    <div>
                        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">
                            Fitur Utama
                        </h2>
                        <QuickAccessGrid />
                    </div>

                    {/* Optional: Tagline/Tips */}
                    <div className="mt-8 p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--bg-tertiary)]">
                        <p className="text-sm text-[var(--text-secondary)] text-center italic">
                            💡 Tip: Konsistensi dalam latihan lebih penting daripada jumlah XP.
                            Fokus pada quality of learning, bukan quantity.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
