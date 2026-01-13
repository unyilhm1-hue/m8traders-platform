/**
 * CategoryGrid Component
 * Grid display of challenge categories with progress
 */
'use client';

import Link from 'next/link';
import { useChallengeStore } from '@/stores';
import { CATEGORY_CONFIGS } from '@/types';
import type { ChallengeType } from '@/types';

export function CategoryGrid() {
    const { challenges, completedChallenges } = useChallengeStore();

    const getCategoryStats = (type: ChallengeType) => {
        const categoryInChallenges = challenges.filter((c) => c.type === type);
        const completed = categoryInChallenges.filter((c) => completedChallenges.has(c.id)).length;
        const total = categoryInChallenges.length;
        const progress = total > 0 ? (completed / total) * 100 : 0;
        return { completed, total, progress };
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {CATEGORY_CONFIGS.map((category) => {
                const stats = getCategoryStats(category.type);

                return (
                    <Link
                        key={category.type}
                        href={`/challenges?type=${category.type}`}
                        className="block p-6 rounded-lg border border-[var(--bg-tertiary)] bg-[var(--bg-secondary)] hover:border-[var(--accent-primary)] hover:shadow-lg transition-all duration-200"
                    >
                        {/* Header */}
                        <div className="flex items-start gap-3 mb-4">
                            <div className="text-3xl">{category.icon}</div>
                            <div className="flex-1">
                                <h3 className="font-bold text-[var(--text-primary)] mb-1">
                                    {category.name}
                                </h3>
                                <p className="text-xs text-[var(--text-secondary)]">
                                    {category.description}
                                </p>
                            </div>
                        </div>

                        {/* Progress */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-[var(--text-secondary)]">
                                    {stats.completed} / {stats.total} Complete
                                </span>
                                <span className="font-semibold text-[var(--text-primary)]">
                                    {Math.round(stats.progress)}%
                                </span>
                            </div>
                            <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                                <div
                                    className="h-full transition-all duration-500"
                                    style={{
                                        width: `${stats.progress}%`,
                                        backgroundColor: category.color,
                                    }}
                                />
                            </div>
                        </div>
                    </Link>
                );
            })}
        </div>
    );
}
