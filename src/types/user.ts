// User and authentication type definitions

export interface User {
    id: string;
    email: string;
    fullName?: string;
    avatarUrl?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface UserProgress {
    userId: string;
    totalXp: number;
    currentLevel: SkillLevel;
    challengesCompleted: number;
    currentStreak: number;
    longestStreak: number;
    achievements: Achievement[];
}

export type SkillLevel = 1 | 2 | 3 | 4 | 5;

export const SKILL_LEVEL_NAMES: Record<SkillLevel, string> = {
    1: 'Pemula',
    2: 'Dasar',
    3: 'Menengah',
    4: 'Mahir',
    5: 'Expert',
};

export const SKILL_LEVEL_XP: Record<SkillLevel, number> = {
    1: 0,
    2: 500,
    3: 1500,
    4: 3500,
    5: 7000,
};

export interface Achievement {
    id: string;
    name: string;
    description: string;
    icon: string;
    earnedAt: Date;
}

export interface EmotionCheckIn {
    id: string;
    userId: string;
    emotion: EmotionState;
    note?: string;
    timestamp: Date;
}

export type EmotionState =
    | 'calm'
    | 'neutral'
    | 'excited'
    | 'anxious'
    | 'fomo'
    | 'revenge';
