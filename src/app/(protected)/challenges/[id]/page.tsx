/**
 * Challenge Session Page
 * Active challenge interface
 */
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useChallengeStore } from '@/stores';
import { createClient } from '@/lib/supabase/client';

export default function ChallengeSessionPage() {
    const params = useParams();
    const router = useRouter();
    const challengeId = params.id as string;

    const {
        activeChallenge,
        loading,
        error,
        startChallenge,
        submitAnswer,
        resetChallenge,
    } = useChallengeStore();

    const [userId, setUserId] = useState<string | null>(null);
    const [selectedAnswer, setSelectedAnswer] = useState<string>('');
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<{ success: boolean; score: number; feedback: string; explanation?: string } | null>(null);

    // Get user
    useEffect(() => {
        const supabase = createClient();
        supabase.auth.getUser().then(({ data }) => {
            if (data.user) {
                setUserId(data.user.id);
            }
        });
    }, []);

    // Start challenge
    useEffect(() => {
        if (userId && challengeId) {
            startChallenge(challengeId, userId).catch((err) => {
                console.error('Failed to start challenge:', err);
            });
        }

        return () => {
            resetChallenge();
        };
    }, [userId, challengeId, startChallenge, resetChallenge]);

    const handleSubmit = async () => {
        if (!userId || !selectedAnswer) return;

        setSubmitting(true);
        try {
            const challengeResult = await submitAnswer(
                { selectedOption: selectedAnswer },
                userId
            );
            setResult(challengeResult);
        } catch (err) {
            console.error('Failed to submit answer:', err);
        } finally {
            setSubmitting(false);
        }
    };

    const handleContinue = () => {
        router.push('/challenges');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-[var(--text-secondary)]">Loading challenge...</p>
                </div>
            </div>
        );
    }

    if (error || !activeChallenge) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <p className="text-red-500 mb-4">❌ {error || 'Challenge not found'}</p>
                    <button
                        onClick={() => router.push('/challenges')}
                        className="px-4 py-2 bg-[var(--accent-primary)] text-white rounded hover:opacity-90"
                    >
                        Back to Challenges
                    </button>
                </div>
            </div>
        );
    }

    // Result Modal
    if (result) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-[var(--bg-primary)] rounded-lg max-w-lg w-full p-6">
                    {/* Result Header */}
                    <div className="text-center mb-6">
                        <div className="text-6xl mb-4">
                            {result.success ? '🎉' : '😔'}
                        </div>
                        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
                            {result.success ? 'Correct!' : 'Not Quite'}
                        </h2>
                        <p className="text-lg text-[var(--accent-primary)] font-semibold">
                            +{result.score} XP
                        </p>
                    </div>

                    {/* Feedback */}
                    <div className="mb-6 p-4 bg-[var(--bg-secondary)] rounded">
                        <p className="text-[var(--text-primary)]">{result.feedback}</p>
                    </div>

                    {/* Explanation */}
                    {result.explanation && (
                        <div className="mb-6 p-4 bg-[var(--bg-tertiary)] rounded">
                            <h3 className="font-semibold text-[var(--text-primary)] mb-2">
                                Explanation:
                            </h3>
                            <p className="text-sm text-[var(--text-secondary)]">
                                {result.explanation}
                            </p>
                        </div>
                    )}

                    {/* Actions */}
                    <button
                        onClick={handleContinue}
                        className="w-full px-4 py-3 bg-[var(--accent-primary)] text-white rounded font-semibold hover:opacity-90 transition-opacity"
                    >
                        Continue
                    </button>
                </div>
            </div>
        );
    }

    // Challenge View
    const config = activeChallenge.config as any;
    const options = config.options || [];

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] py-8">
            <div className="max-w-3xl mx-auto px-6">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={() => router.push('/challenges')}
                        className="text-sm text-[var(--accent-primary)] hover:underline mb-4"
                    >
                        ← Back to Challenges
                    </button>
                    <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
                        {activeChallenge.title}
                    </h1>
                    <p className="text-[var(--text-secondary)]">
                        {activeChallenge.description}
                    </p>
                </div>

                {/* Challenge Details */}
                <div className="mb-8 p-4 bg-[var(--bg-secondary)] rounded-lg border border-[var(--bg-tertiary)]">
                    <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-4">
                            <span className="text-[var(--text-tertiary)]">
                                Level {activeChallenge.level}
                            </span>
                            {activeChallenge.time_limit && (
                                <span className="text-[var(--text-tertiary)]">
                                    ⏱ {Math.floor(activeChallenge.time_limit / 60)} minutes
                                </span>
                            )}
                        </div>
                        <span className="font-semibold text-[var(--accent-primary)]">
                            +{activeChallenge.points} XP
                        </span>
                    </div>
                </div>

                {/* Answer Options */}
                <div className="mb-8 space-y-3">
                    <h3 className="font-semibold text-[var(--text-primary)] mb-4">
                        Choose your answer:
                    </h3>
                    {options.map((option: any) => (
                        <button
                            key={option.id}
                            onClick={() => setSelectedAnswer(option.id)}
                            disabled={submitting}
                            className={`
                                w-full p-4 rounded-lg border-2 text-left transition-all
                                ${selectedAnswer === option.id
                                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                                    : 'border-[var(--bg-tertiary)] bg-[var(--bg-secondary)] hover:border-[var(--accent-primary)]/50'
                                }
                                ${submitting ? 'opacity-50 cursor-not-allowed' : ''}
                            `}
                        >
                            <div className="flex items-start gap-3">
                                <div className={`
                                    w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center
                                    ${selectedAnswer === option.id
                                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]'
                                        : 'border-[var(--bg-tertiary)]'
                                    }
                                `}>
                                    {selectedAnswer === option.id && (
                                        <div className="w-2 h-2 bg-white rounded-full" />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <span className="text-[var(--text-primary)]">
                                        {option.text}
                                    </span>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>

                {/* Submit Button */}
                <button
                    onClick={handleSubmit}
                    disabled={!selectedAnswer || submitting}
                    className={`
                        w-full px-6 py-3 rounded-lg font-semibold transition-all
                        ${selectedAnswer && !submitting
                            ? 'bg-[var(--accent-primary)] text-white hover:opacity-90'
                            : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] cursor-not-allowed'
                        }
                    `}
                >
                    {submitting ? 'Submitting...' : 'Submit Answer'}
                </button>
            </div>
        </div>
    );
}
