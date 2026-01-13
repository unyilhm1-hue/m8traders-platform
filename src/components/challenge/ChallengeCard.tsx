/**
 * ChallengeCard Component
 * Individual challenge card with status and details
 */
'use client';

import Link from 'next/link';
import type { Challenge } from '@/types';
import { LEVEL_CONFIGS } from '@/types';

interface ChallengeCardProps {
    challenge: Challenge;
    isCompleted?: boolean;
    isLocked?: boolean;
}

export function ChallengeCard({ challenge, isCompleted = false, isLocked = false }: ChallengeCardProps) {
    const levelConfig = LEVEL_CONFIGS.find((l) => l.level === challenge.level);

    const CardContent = (
        <div
            className={`
                relative p-4 rounded-lg border transition-all duration-200
                ${isLocked
                    ? 'bg-[var(--bg-tertiary)] border-[var(--bg-tertiary)] opacity-50 cursor-not-allowed'
                    : isCompleted
                        ? 'bg-[var(--bg-secondary)] border-[var(--accent-primary)]/30 hover:border-[var(--accent-primary)] hover:shadow-lg'
                        : 'bg-[var(--bg-secondary)] border-[var(--bg-tertiary)] hover:border-[var(--accent-primary)] hover:shadow-lg cursor-pointer'
                }
            `}
        >
            {/* Completion Badge */}
            {isCompleted && (
                <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-white text-xs">
                    ✓
                </div>
            )}

            {/* Lock Badge */}
            {isLocked && (
                <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-xs">
                    🔒
                </div>
            )}

            {/* Header */}
            <div className="flex items-start gap-3 mb-3">
                <div className="text-2xl">{levelConfig?.icon}</div>
                <div className="flex-1">
                    <h3 className="font-semibold text-[var(--text-primary)] mb-1 line-clamp-1">
                        {challenge.title}
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                        {challenge.description}
                    </p>
                </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]">
                        Level {challenge.level}
                    </span>
                    {challenge.time_limit && (
                        <span className="text-[var(--text-tertiary)]">
                            ⏱ {Math.floor(challenge.time_limit / 60)}min
                        </span>
                    )}
                </div>
                <div className="font-semibold text-[var(--accent-primary)]">
                    +{challenge.points} XP
                </div>
            </div>
        </div>
    );

    if (isLocked) {
        return CardContent;
    }

    return (
        <Link href={`/challenges/${challenge.id}`}>
            {CardContent}
        </Link>
    );
}
