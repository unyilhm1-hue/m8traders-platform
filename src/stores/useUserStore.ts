/**
 * User Store - Manages user preferences and settings
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { EmotionState } from '@/types';

interface UserPreferences {
    soundEnabled: boolean;
    notificationsEnabled: boolean;
    showTutorials: boolean;
    defaultTimeframe: string;
    defaultBalance: number;
}

interface EmotionEntry {
    emotion: EmotionState;
    note?: string;
    timestamp: number;
}

interface UserState {
    // State
    preferences: UserPreferences;
    emotionLog: EmotionEntry[];
    currentEmotion: EmotionState;
    dailyStreak: number;
    lastActiveDate: string | null;

    // Actions
    updatePreferences: (prefs: Partial<UserPreferences>) => void;
    logEmotion: (emotion: EmotionState, note?: string) => void;
    getCurrentEmotion: () => EmotionState;
    checkAndUpdateStreak: () => void;
    reset: () => void;
}

const DEFAULT_PREFERENCES: UserPreferences = {
    soundEnabled: true,
    notificationsEnabled: true,
    showTutorials: true,
    defaultTimeframe: '5m',
    defaultBalance: 100000,
};

const initialState = {
    preferences: DEFAULT_PREFERENCES,
    emotionLog: [] as EmotionEntry[],
    currentEmotion: 'neutral' as EmotionState,
    dailyStreak: 0,
    lastActiveDate: null as string | null,
};

export const useUserStore = create<UserState>()(
    persist(
        immer((set, get) => ({
            ...initialState,

            updatePreferences: (prefs) =>
                set((state) => {
                    state.preferences = { ...state.preferences, ...prefs };
                }),

            logEmotion: (emotion, note) =>
                set((state) => {
                    state.currentEmotion = emotion;
                    state.emotionLog.push({
                        emotion,
                        note,
                        timestamp: Date.now(),
                    });

                    // Keep only last 100 entries
                    if (state.emotionLog.length > 100) {
                        state.emotionLog = state.emotionLog.slice(-100);
                    }
                }),

            getCurrentEmotion: () => get().currentEmotion,

            checkAndUpdateStreak: () =>
                set((state) => {
                    const today = new Date().toISOString().split('T')[0];
                    const lastDate = state.lastActiveDate;

                    if (!lastDate) {
                        // First time
                        state.dailyStreak = 1;
                    } else if (lastDate === today) {
                        // Already active today, no change
                    } else {
                        const yesterday = new Date();
                        yesterday.setDate(yesterday.getDate() - 1);
                        const yesterdayStr = yesterday.toISOString().split('T')[0];

                        if (lastDate === yesterdayStr) {
                            // Continue streak
                            state.dailyStreak += 1;
                        } else {
                            // Streak broken
                            state.dailyStreak = 1;
                        }
                    }

                    state.lastActiveDate = today;
                }),

            reset: () => set(initialState),
        })),
        {
            name: 'm8traders-user',
        }
    )
);

// Selector hooks
export const usePreferences = () => useUserStore((s) => s.preferences);
export const useDailyStreak = () => useUserStore((s) => s.dailyStreak);
export const useCurrentEmotion = () => useUserStore((s) => s.currentEmotion);
