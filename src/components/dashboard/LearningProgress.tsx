/**
 * LearningProgress Component
 * Displays user challenge progress and stats
 */
'use client';

import { useChallengeStore } from '@/stores';
import { LEVEL_CONFIGS } from '@/types';

export function LearningProgress() {
    const { userStats } = useChallengeStore();

    if (!userStats) {
        return (
            <div className="p-6 rounded-lg bg-[var(--bg-secondary)] border border-[var(--bg-tertiary)]">
                <div className="animate-pulse">
                    <div className="h-6 bg-[var(--bg-tertiary)] rounded w-1/3 mb-4" />
                    <div className="h-4 bg-[var(--bg-tertiary)] rounded w-2/3" />
                </div>
            </div>
        );
    }

    const currentLevel = LEVEL_CONFIGS.find((l) => l.level === userStats.current_level);
    const nextLevel = LEVEL_CONFIGS.find((l) => l.level === userStats.current_level + 1);

    const currentLevelXP = currentLevel?.xp_min || 0;
    const nextLevelXP = nextLevel?.xp_min || currentLevel?.xp_max || 0;
    const xpInLevel = userStats.total_xp - currentLevelXP;
    const xpNeeded = nextLevelXP - currentLevelXP;
    const progress = xpNeeded > 0 ? (xpInLevel / xpNeeded) * 100 : 100;

    return (
        <div className="p-6 rounded-lg bg-[var(--bg-secondary)] border border-[var(--bg-tertiary)]">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                <div className="text-4xl">{currentLevel?.icon}</div>
                <div>
                    <h2 className="text-xl font-bold text-[var(--text-primary)]">
                        {currentLevel?.name}
                    </h2>
                    <p className="text-sm text-[var(--text-secondary)]">Level {userStats.current_level}</p>
                </div>
            </div>

            {/* XP Progress */}
            <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-[var(--text-primary)]">
                        {userStats.total_xp.toLocaleString()} XP
                    </span>
                    {userStats.current_level < 5 && (
                        <span className="text-xs text-[var(--text-tertiary)]">
                            {(nextLevelXP - userStats.total_xp).toLocaleString()} lagi ke Level {userStats.current_level + 1}
                        </span>
                    )}
                </div>
                <div className="h-3 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] transition-all duration-500"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-[var(--bg-tertiary)]">
                <div className="text-center">
                    <div className="text-2xl font-bold text-[var(--accent-primary)]">
                        {userStats.current_streak > 0 ? '🔥' : '💤'}
                    </div>
                    <div className="text-sm font-semibold text-[var(--text-primary)]">
                        {userStats.current_streak}
                    </div>
                    <div className="text-xs text-[var(--text-tertiary)]">Streak</div>
                </div>
                <div className="text-center">
                    <div className="text-2xl font-bold text-[var(--text-primary)]">
                        {userStats.challenges_completed}
                    </div>
                    <div className="text-xs text-[var(--text-tertiary)]">Selesai</div>
                </div>
                <div className="text-center">
                    <div className="text-2xl font-bold text-[var(--text-secondary)]">
                        {userStats.challenges_failed}
                    </div>
                    <div className="text-xs text-[var(--text-tertiary)]">Gagal</div>
                </div>
            </div>
        </div>
    );
}
