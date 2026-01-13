/**
 * Challenge Center Page
 * Main hub for browsing and starting challenges
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useChallengeStore } from '@/stores';
import { ProgressHeader, CategoryGrid, ChallengeCard } from '@/components/challenge';
import { createClient } from '@/lib/supabase/client';
import type { ChallengeType } from '@/types';

export default function ChallengeCenterPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const typeFilter = searchParams.get('type') as ChallengeType | null;

    const {
        challenges,
        completedChallenges,
        userStats,
        loading,
        error,
        loadChallenges,
        loadUserStats,
        loadCompletedChallenges,
    } = useChallengeStore();

    const [userId, setUserId] = useState<string | null>(null);

    // Get current user
    useEffect(() => {
        const supabase = createClient();
        supabase.auth.getUser().then(({ data }) => {
            if (data.user) {
                setUserId(data.user.id);
            }
        });
    }, []);

    // Load data
    useEffect(() => {
        loadChallenges();
    }, [loadChallenges]);

    useEffect(() => {
        if (userId) {
            loadUserStats(userId);
            loadCompletedChallenges(userId);
        }
    }, [userId, loadUserStats, loadCompletedChallenges]);

    // Filter challenges
    const filteredChallenges = typeFilter
        ? challenges.filter((c) => c.type === typeFilter)
        : challenges;

    // Group by level
    const challengesByLevel = filteredChallenges.reduce((acc, challenge) => {
        if (!acc[challenge.level]) {
            acc[challenge.level] = [];
        }
        acc[challenge.level].push(challenge);
        return acc;
    }, {} as Record<number, typeof challenges>);

    // Check if challenge is locked (based on user level)
    const isChallengeUnlocked = (challengeLevel: number) => {
        return userStats ? challengeLevel <= userStats.current_level : challengeLevel === 1;
    };

    if (loading && challenges.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-[var(--text-secondary)]">Loading challenges...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <p className="text-red-500 mb-4">❌ {error}</p>
                    <button
                        onClick={() => loadChallenges()}
                        className="px-4 py-2 bg-[var(--accent-primary)] text-white rounded hover:opacity-90"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--bg-primary)]">
            {/* Progress Header */}
            <ProgressHeader />

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Page Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
                        {typeFilter ? `${typeFilter} Challenges` : 'Challenge Center'}
                    </h1>
                    <p className="text-[var(--text-secondary)]">
                        {typeFilter
                            ? 'Complete challenges to earn XP and improve your skills'
                            : 'Choose a category to start learning'}
                    </p>

                    {/* Back Button */}
                    {typeFilter && (
                        <button
                            onClick={() => router.push('/challenges')}
                            className="mt-4 text-sm text-[var(--accent-primary)] hover:underline"
                        >
                            ← Back to all categories
                        </button>
                    )}
                </div>

                {/* Category Grid (shown when no filter) */}
                {!typeFilter && (
                    <div className="mb-12">
                        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">
                            Challenge Categories
                        </h2>
                        <CategoryGrid />
                    </div>
                )}

                {/* Challenge List (shown when filter or as default) */}
                {(typeFilter || challenges.length > 0) && (
                    <div>
                        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">
                            {typeFilter ? 'Available Challenges' : 'All Challenges'}
                        </h2>

                        {/* Group by level */}
                        {Object.keys(challengesByLevel)
                            .sort((a, b) => parseInt(a) - parseInt(b))
                            .map((level) => {
                                const levelNum = parseInt(level);
                                const levelChallenges = challengesByLevel[levelNum];
                                const isUnlocked = isChallengeUnlocked(levelNum);

                                return (
                                    <div key={level} className="mb-8">
                                        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                                            <span>Level {level}</span>
                                            {!isUnlocked && (
                                                <span className="text-xs text-[var(--text-tertiary)] px-2 py-0.5 bg-[var(--bg-tertiary)] rounded">
                                                    🔒 Locked
                                                </span>
                                            )}
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {levelChallenges.map((challenge) => (
                                                <ChallengeCard
                                                    key={challenge.id}
                                                    challenge={challenge}
                                                    isCompleted={completedChallenges.has(challenge.id)}
                                                    isLocked={!isUnlocked}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                )}

                {/* Empty State */}
                {filteredChallenges.length === 0 && (
                    <div className="text-center py-12">
                        <p className="text-[var(--text-tertiary)] mb-4">
                            No challenges found in this category yet.
                        </p>
                        <button
                            onClick={() => router.push('/challenges')}
                            className="px-4 py-2 bg-[var(--accent-primary)] text-white rounded hover:opacity-90"
                        >
                            Browse All Categories
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
