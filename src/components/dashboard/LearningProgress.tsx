/**
 * LearningProgress Component
 * Displays user challenge progress and stats
 */
'use client';

import { useChallengeStore } from '@/stores';
import { LEVEL_CONFIGS } from '@/types';
import { Trophy, Flame, CheckCircle, XCircle } from 'lucide-react';

export function LearningProgress() {
    const { userStats } = useChallengeStore();

    if (!userStats) {
        return (
            <div className="p-8 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--bg-tertiary)] animate-pulse">
                <div className="h-8 bg-[var(--bg-tertiary)] rounded w-1/3 mb-6" />
                <div className="h-4 bg-[var(--bg-tertiary)] rounded w-2/3" />
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
        <div className="h-full flex flex-col justify-between p-8 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--bg-tertiary)] relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent-primary)] opacity-5 rounded-full blur-[40px] translate-x-1/2 -translate-y-1/2" />

            {/* Header */}
            <div className="relative z-10 flex justify-between items-start mb-8">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--bg-tertiary)] to-[var(--bg-secondary)] border border-[var(--bg-tertiary)] flex items-center justify-center text-3xl shadow-lg">
                        {currentLevel?.icon}
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-1">
                            {currentLevel?.name}
                        </h2>
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded textxs font-bold bg-[var(--accent-primary)] text-white">
                                LVL {userStats.current_level}
                            </span>
                            <span className="text-sm text-[var(--text-secondary)]">journey</span>
                        </div>
                    </div>
                </div>

                {/* Total XP Badge */}
                <div className="text-right">
                    <div className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Total XP</div>
                    <div className="text-2xl font-mono font-bold text-[var(--accent-purple)]">
                        {userStats.total_xp.toLocaleString()}
                    </div>
                </div>
            </div>

            {/* Main Progress Bar */}
            <div className="relative z-10 mb-8">
                <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium text-[var(--text-primary)]">Progress to Level {userStats.current_level + 1}</span>
                    <span className="font-mono text-[var(--text-tertiary)]">{Math.round(progress)}%</span>
                </div>
                <div className="h-3 bg-[var(--bg-tertiary)] rounded-full overflow-hidden p-0.5">
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-purple)] shadow-[0_0_10px_rgba(0,201,183,0.5)] transition-all duration-1000 ease-out"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                </div>
                {userStats.current_level < 5 && (
                    <p className="text-xs text-[var(--text-tertiary)] mt-2 text-right">
                        Needs <span className="text-[var(--text-primary)] font-semibold">{(nextLevelXP - userStats.total_xp).toLocaleString()} XP</span> more to rank up
                    </p>
                )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-4 border-t border-[var(--bg-tertiary)] pt-6">
                <div className="group p-3 rounded-xl hover:bg-[var(--bg-tertiary)]/30 transition-colors cursor-default">
                    <div className="flex items-center gap-2 mb-1 text-[var(--text-tertiary)] group-hover:text-[var(--color-warning)] transition-colors">
                        <Flame size={16} />
                        <span className="text-xs font-semibold uppercase tracking-wider">Streak</span>
                    </div>
                    <div className="text-2xl font-bold text-[var(--text-primary)]">
                        {userStats.current_streak} <span className="text-sm font-normal text-[var(--text-tertiary)]">days</span>
                    </div>
                </div>

                <div className="group p-3 rounded-xl hover:bg-[var(--bg-tertiary)]/30 transition-colors cursor-default">
                    <div className="flex items-center gap-2 mb-1 text-[var(--text-tertiary)] group-hover:text-[var(--color-profit)] transition-colors">
                        <CheckCircle size={16} />
                        <span className="text-xs font-semibold uppercase tracking-wider">Won</span>
                    </div>
                    <div className="text-2xl font-bold text-[var(--text-primary)]">
                        {userStats.challenges_completed}
                    </div>
                </div>

                <div className="group p-3 rounded-xl hover:bg-[var(--bg-tertiary)]/30 transition-colors cursor-default">
                    <div className="flex items-center gap-2 mb-1 text-[var(--text-tertiary)] group-hover:text-[var(--color-loss)] transition-colors">
                        <XCircle size={16} />
                        <span className="text-xs font-semibold uppercase tracking-wider">Lost</span>
                    </div>
                    <div className="text-2xl font-bold text-[var(--text-primary)]">
                        {userStats.challenges_failed}
                    </div>
                </div>
            </div>
        </div>
    );
}
