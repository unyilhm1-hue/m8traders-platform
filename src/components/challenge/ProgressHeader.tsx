/**
 * ProgressHeader Component
 * Displays user level, XP progress, and streak
 */
'use client';

import { useChallengeStore } from '@/stores';
import { LEVEL_CONFIGS } from '@/types';

export function ProgressHeader() {
    const { userStats } = useChallengeStore();

    if (!userStats) {
        return (
            <div className="bg-[var(--bg-secondary)] border-b border-[var(--bg-tertiary)] px-6 py-4">
                <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
                    Loading progress...
                </div>
            </div>
        );
    }

    const currentLevelConfig = LEVEL_CONFIGS.find((l) => l.level === userStats.current_level);
    const nextLevelConfig = LEVEL_CONFIGS.find((l) => l.level === userStats.current_level + 1);

    const currentLevelXP = currentLevelConfig?.xp_min || 0;
    const nextLevelXP = nextLevelConfig?.xp_min || currentLevelConfig?.xp_max || 0;
    const xpInLevel = userStats.total_xp - currentLevelXP;
    const xpNeeded = nextLevelXP - currentLevelXP;
    const progress = xpNeeded > 0 ? (xpInLevel / xpNeeded) * 100 : 100;

    return (
        <div className="bg-[var(--bg-secondary)] border-b border-[var(--bg-tertiary)] px-6 py-4">
            <div className="flex items-center justify-between gap-6">
                {/* Level Badge */}
                <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center text-3xl">
                        {currentLevelConfig?.icon}
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-[var(--text-primary)]">
                            Level {userStats.current_level}: {currentLevelConfig?.name}
                        </h2>
                        <p className="text-xs text-[var(--text-secondary)]">
                            {currentLevelConfig?.description}
                        </p>
                    </div>
                </div>

                {/* XP Progress */}
                <div className="flex-1 max-w-md">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-[var(--text-primary)]">
                            XP: {userStats.total_xp.toLocaleString()}
                        </span>
                        {userStats.current_level < 5 && (
                            <span className="text-xs text-[var(--text-tertiary)]">
                                {(nextLevelXP - userStats.total_xp).toLocaleString()} to next level
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

                {/* Streak */}
                <div className="text-center">
                    <div className="text-2xl font-bold text-[var(--accent-primary)]">
                        {userStats.current_streak > 0 ? '🔥' : '💤'}
                    </div>
                    <div className="text-sm font-medium text-[var(--text-primary)]">
                        {userStats.current_streak} Streak
                    </div>
                    <div className="text-xs text-[var(--text-tertiary)]">
                        Best: {userStats.longest_streak}
                    </div>
                </div>

                {/* Stats */}
                <div className="flex gap-6">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-[var(--text-primary)]">
                            {userStats.challenges_completed}
                        </div>
                        <div className="text-xs text-[var(--text-tertiary)]">Completed</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-[var(--text-secondary)]">
                            {userStats.challenges_failed}
                        </div>
                        <div className="text-xs text-[var(--text-tertiary)]">Failed</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
