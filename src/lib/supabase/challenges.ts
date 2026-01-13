/**
 * Supabase Client Functions for Challenge System
 * Phase 5A: Challenge Infrastructure
 */

import { createClient } from '@/lib/supabase/client';
import type {
    Challenge,
    ChallengeAttempt,
    UserChallengeStats,
    ChallengeResult,
    ChallengeType,
    ChallengeLevel,
} from '@/types';

// ============================================================================
// Challenge Queries
// ============================================================================

/**
 * Fetch all available challenges
 */
export async function fetchChallenges() {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('challenges')
        .select('*')
        .order('level', { ascending: true })
        .order('type', { ascending: true });

    if (error) throw error;
    return data as Challenge[];
}

/**
 * Fetch challenges by type
 */
export async function fetchChallengesByType(type: ChallengeType) {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('challenges')
        .select('*')
        .eq('type', type)
        .order('level', { ascending: true });

    if (error) throw error;
    return data as Challenge[];
}

/**
 * Fetch challenges by level
 */
export async function fetchChallengesByLevel(level: ChallengeLevel) {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('challenges')
        .select('*')
        .eq('level', level)
        .order('type', { ascending: true });

    if (error) throw error;
    return data as Challenge[];
}

/**
 * Fetch single challenge by ID
 */
export async function fetchChallenge(id: string) {
    const supabase = createClient();

    const { data, error } = await supabase.from('challenges').select('*').eq('id', id).single();

    if (error) throw error;
    return data as Challenge;
}

// ============================================================================
// Challenge Attempts
// ============================================================================

/**
 * Create a new challenge attempt
 */
export async function createChallengeAttempt(challengeId: string, userId: string) {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('challenge_attempts')
        .insert({
            challenge_id: challengeId,
            user_id: userId,
            started_at: new Date().toISOString(),
        })
        .select()
        .single();

    if (error) throw error;
    return data as ChallengeAttempt;
}

/**
 * Complete a challenge attempt
 */
export async function completeChallengeAttempt(
    attemptId: string,
    result: ChallengeResult,
    attemptData?: Record<string, any>
) {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('challenge_attempts')
        .update({
            completed_at: new Date().toISOString(),
            success: result.success,
            score: result.score,
            time_taken: result.time_taken,
            attempt_data: attemptData,
        })
        .eq('id', attemptId)
        .select()
        .single();

    if (error) throw error;
    return data as ChallengeAttempt;
}

/**
 * Fetch user's challenge attempts
 */
export async function fetchUserAttempts(userId: string, limit = 50) {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('challenge_attempts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) throw error;
    return data as ChallengeAttempt[];
}

/**
 * Fetch attempts for a specific challenge
 */
export async function fetchChallengeAttempts(userId: string, challengeId: string) {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('challenge_attempts')
        .select('*')
        .eq('user_id', userId)
        .eq('challenge_id', challengeId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data as ChallengeAttempt[];
}

/**
 * Check if challenge has been completed successfully
 */
export async function hasChallengeBeenCompleted(userId: string, challengeId: string) {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('challenge_attempts')
        .select('id')
        .eq('user_id', userId)
        .eq('challenge_id', challengeId)
        .eq('success', true)
        .limit(1);

    if (error) throw error;
    return data && data.length > 0;
}

// ============================================================================
// User Stats
// ============================================================================

/**
 * Fetch user challenge stats
 */
export async function fetchUserStats(userId: string) {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('user_challenge_stats')
        .select('*')
        .eq('user_id', userId)
        .single();

    // If no stats exist yet, return default
    if (error && error.code === 'PGRST116') {
        return {
            user_id: userId,
            total_xp: 0,
            current_level: 1,
            challenges_completed: 0,
            challenges_failed: 0,
            current_streak: 0,
            longest_streak: 0,
            achievements: [],
            updated_at: new Date().toISOString(),
        } as UserChallengeStats;
    }

    if (error) throw error;
    return data as UserChallengeStats;
}

/**
 * Update user stats after challenge completion
 */
export async function updateUserStats(userId: string, updates: Partial<UserChallengeStats>) {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('user_challenge_stats')
        .upsert(
            {
                user_id: userId,
                ...updates,
                updated_at: new Date().toISOString(),
            },
            {
                onConflict: 'user_id',
            }
        )
        .select()
        .single();

    if (error) throw error;
    return data as UserChallengeStats;
}

/**
 * Add XP and update level
 */
export async function addXP(userId: string, xpGained: number) {
    const supabase = createClient();

    // Fetch current stats
    const currentStats = await fetchUserStats(userId);

    const newXP = currentStats.total_xp + xpGained;
    const newLevel = calculateLevel(newXP);

    return updateUserStats(userId, {
        total_xp: newXP,
        current_level: newLevel,
    });
}

/**
 * Update streak
 */
export async function updateStreak(userId: string, isSuccess: boolean) {
    const supabase = createClient();

    const currentStats = await fetchUserStats(userId);

    let newStreak = currentStats.current_streak;
    let longestStreak = currentStats.longest_streak;

    if (isSuccess) {
        newStreak += 1;
        if (newStreak > longestStreak) {
            longestStreak = newStreak;
        }
    } else {
        newStreak = 0;
    }

    return updateUserStats(userId, {
        current_streak: newStreak,
        longest_streak: longestStreak,
        last_completed_at: new Date().toISOString(),
    });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate user level based on total XP
 */
function calculateLevel(xp: number): ChallengeLevel {
    if (xp >= 7000) return 5;
    if (xp >= 3500) return 4;
    if (xp >= 1500) return 3;
    if (xp >= 500) return 2;
    return 1;
}

/**
 * Get XP required for next level
 */
export function getXPForNextLevel(currentXP: number): number {
    if (currentXP >= 7000) return 0; // Max level
    if (currentXP >= 3500) return 7000 - currentXP;
    if (currentXP >= 1500) return 3500 - currentXP;
    if (currentXP >= 500) return 1500 - currentXP;
    return 500 - currentXP;
}

/**
 * Get progress percentage to next level
 */
export function getLevelProgress(currentXP: number): number {
    const level = calculateLevel(currentXP);

    const levelThresholds: Record<ChallengeLevel, { min: number; max: number }> = {
        1: { min: 0, max: 500 },
        2: { min: 500, max: 1500 },
        3: { min: 1500, max: 3500 },
        4: { min: 3500, max: 7000 },
        5: { min: 7000, max: 7000 }, // Max level
    };

    const { min, max } = levelThresholds[level];

    if (level === 5) return 100; // Max level

    const progress = ((currentXP - min) / (max - min)) * 100;
    return Math.round(progress);
}
