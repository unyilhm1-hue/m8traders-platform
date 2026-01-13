/**
 * Challenge Store
 * State management for challenge system using Zustand
 * Phase 5A: Challenge Infrastructure
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
    Challenge,
    ChallengeAttempt,
    UserChallengeStats,
    ChallengeResult,
    ChallengeType,
    ChallengeLevel,
} from '@/types';
import {
    fetchChallenges,
    fetchChallenge,
    fetchChallengesByType,
    fetchChallengesByLevel,
    createChallengeAttempt,
    completeChallengeAttempt,
    fetchUserStats,
    updateUserStats,
    addXP,
    updateStreak,
    hasChallengeBeenCompleted,
    fetchChallengeAttempts,
} from '@/lib/supabase/challenges';
import { ChallengeEngine } from '@/lib/challenge';

interface ChallengeState {
    // Challenge library
    challenges: Challenge[];
    challengesByType: Record<ChallengeType, Challenge[]>;
    completedChallenges: Set<string>;

    // Current session
    activeChallenge: Challenge | null;
    currentAttempt: ChallengeAttempt | null;
    challengeEngine: ChallengeEngine | null;
    startTime: number | null;

    // User progress
    userStats: UserChallengeStats | null;

    // UI state
    loading: boolean;
    error: string | null;

    // Actions - Data loading
    loadChallenges: () => Promise<void>;
    loadChallengesByType: (type: ChallengeType) => Promise<void>;
    loadUserStats: (userId: string) => Promise<void>;
    loadCompletedChallenges: (userId: string) => Promise<void>;

    // Actions - Challenge session
    startChallenge: (challengeId: string, userId: string) => Promise<void>;
    submitAnswer: (answer: any, userId: string) => Promise<ChallengeResult>;
    resetChallenge: () => void;

    // Actions - Progress
    refreshUserStats: (userId: string) => Promise<void>;

    // Helpers
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
}

export const useChallengeStore = create<ChallengeState>()(
    devtools(
        (set, get) => ({
            // Initial state
            challenges: [],
            challengesByType: {} as Record<ChallengeType, Challenge[]>,
            completedChallenges: new Set(),
            activeChallenge: null,
            currentAttempt: null,
            challengeEngine: null,
            startTime: null,
            userStats: null,
            loading: false,
            error: null,

            // ================================================================
            // Data Loading Actions
            // ================================================================

            loadChallenges: async () => {
                set({ loading: true, error: null });
                try {
                    const challenges = await fetchChallenges();
                    set({ challenges, loading: false });
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Failed to load challenges';
                    set({ error: errorMessage, loading: false });
                }
            },

            loadChallengesByType: async (type: ChallengeType) => {
                set({ loading: true, error: null });
                try {
                    const challenges = await fetchChallengesByType(type);
                    set((state) => ({
                        challengesByType: {
                            ...state.challengesByType,
                            [type]: challenges,
                        },
                        loading: false,
                    }));
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Failed to load challenges';
                    set({ error: errorMessage, loading: false });
                }
            },

            loadUserStats: async (userId: string) => {
                try {
                    const stats = await fetchUserStats(userId);
                    set({ userStats: stats });
                } catch (error) {
                    console.error('Failed to load user stats:', error);
                }
            },

            loadCompletedChallenges: async (userId: string) => {
                try {
                    const { challenges } = get();
                    const completed = new Set<string>();

                    // Check each challenge for completion
                    await Promise.all(
                        challenges.map(async (challenge) => {
                            const isCompleted = await hasChallengeBeenCompleted(userId, challenge.id);
                            if (isCompleted) {
                                completed.add(challenge.id);
                            }
                        })
                    );

                    set({ completedChallenges: completed });
                } catch (error) {
                    console.error('Failed to load completed challenges:', error);
                }
            },

            // ================================================================
            // Challenge Session Actions
            // ================================================================

            startChallenge: async (challengeId: string, userId: string) => {
                set({ loading: true, error: null });
                try {
                    // Fetch challenge details
                    const challenge = await fetchChallenge(challengeId);

                    // Create attempt record
                    const attempt = await createChallengeAttempt(challengeId, userId);

                    // Initialize challenge engine
                    const engine = new ChallengeEngine(challenge);

                    set({
                        activeChallenge: challenge,
                        currentAttempt: attempt,
                        challengeEngine: engine,
                        startTime: Date.now(),
                        loading: false,
                    });
                } catch (error) {
                    const errorMessage =
                        error instanceof Error ? error.message : 'Failed to start challenge';
                    set({ error: errorMessage, loading: false });
                    throw error;
                }
            },

            submitAnswer: async (answer: any, userId: string): Promise<ChallengeResult> => {
                const { challengeEngine, currentAttempt, userStats, activeChallenge } = get();

                if (!challengeEngine || !currentAttempt || !userStats || !activeChallenge) {
                    throw new Error('No active challenge');
                }

                try {
                    // Validate answer using engine
                    const result = challengeEngine.validateAnswer(answer);

                    // Check if this is first attempt for this challenge
                    const previousAttempts = await fetchChallengeAttempts(userId, activeChallenge.id);
                    const isFirstAttempt = previousAttempts.length === 1; // Only current attempt

                    // Calculate final score with multipliers
                    const finalScore = ChallengeEngine.calculateFinalScore(
                        result.score,
                        isFirstAttempt,
                        userStats.current_streak
                    );

                    // Update attempt record
                    await completeChallengeAttempt(currentAttempt.id, {
                        ...result,
                        score: finalScore,
                    }, answer);

                    // Update user stats
                    if (result.success) {
                        // Add XP
                        await addXP(userId, finalScore);

                        // Update streak
                        await updateStreak(userId, true);

                        // Add to completed set
                        set((state) => ({
                            completedChallenges: new Set([
                                ...state.completedChallenges,
                                activeChallenge.id,
                            ]),
                        }));

                        // Update challenges completed count
                        await updateUserStats(userId, {
                            challenges_completed: userStats.challenges_completed + 1,
                        });
                    } else {
                        // Failed - update streak and failed count
                        await updateStreak(userId, false);
                        await updateUserStats(userId, {
                            challenges_failed: userStats.challenges_failed + 1,
                        });
                    }

                    // Refresh user stats
                    await get().refreshUserStats(userId);

                    return { ...result, score: finalScore };
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Failed to submit answer';
                    set({ error: errorMessage });
                    throw error;
                }
            },

            resetChallenge: () => {
                set({
                    activeChallenge: null,
                    currentAttempt: null,
                    challengeEngine: null,
                    startTime: null,
                });
            },

            // ================================================================
            // Progress Actions
            // ================================================================

            refreshUserStats: async (userId: string) => {
                try {
                    const stats = await fetchUserStats(userId);
                    set({ userStats: stats });
                } catch (error) {
                    console.error('Failed to refresh user stats:', error);
                }
            },

            // ================================================================
            // Helper Actions
            // ================================================================

            setLoading: (loading: boolean) => set({ loading }),
            setError: (error: string | null) => set({ error }),
        }),
        { name: 'ChallengeStore' }
    )
);
