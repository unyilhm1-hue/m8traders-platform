/**
 * Challenge System Type Definitions
 * Phase 5A: Challenge Infrastructure
 */

import type { Candle } from './chart';

// ============================================================================
// Challenge Types
// ============================================================================

export type ChallengeType =
    | 'pattern'
    | 'indicator'
    | 'entry_exit'
    | 'risk'
    | 'psychology'
    | 'case_study';

export type ChallengeLevel = 1 | 2 | 3 | 4 | 5;

export interface Challenge {
    id: string;
    type: ChallengeType;
    level: ChallengeLevel;
    title: string;
    description: string;
    config: ChallengeConfig;
    points: number;
    time_limit?: number | null; // seconds
    created_at: string;
    updated_at?: string;
}

// ============================================================================
// Challenge Configuration (Type-specific)
// ============================================================================

export type ChallengeConfig =
    | PatternChallengeConfig
    | IndicatorChallengeConfig
    | EntryExitChallengeConfig
    | RiskChallengeConfig
    | PsychologyChallengeConfig
    | CaseStudyChallengeConfig;

export interface BaseChallengeConfig {
    type: ChallengeType;
    explanation?: string;
    hints?: string[];
}

export interface PatternChallengeConfig extends BaseChallengeConfig {
    type: 'pattern';
    pattern: string;
    tolerance_candles?: number;
    context_required?: 'uptrend' | 'downtrend' | 'sideways';
}

export interface IndicatorChallengeConfig extends BaseChallengeConfig {
    type: 'indicator';
    options: ChallengeOption[];
    correct_answer: string;
}

export interface EntryExitChallengeConfig extends BaseChallengeConfig {
    type: 'entry_exit';
    scenario: Scenario;
    options: ChallengeOption[];
    correct_answer: string;
}

export interface RiskChallengeConfig extends BaseChallengeConfig {
    type: 'risk';
    scenario: RiskScenario;
    calculation: Record<string, number>;
    options: ChallengeOption[];
    correct_answer: string;
}

export interface PsychologyChallengeConfig extends BaseChallengeConfig {
    type: 'psychology';
    options: ChallengeOption[];
    correct_answer: string;
}

export interface CaseStudyChallengeConfig extends BaseChallengeConfig {
    type: 'case_study';
    case_study: CaseStudy;
    questions: CaseStudyQuestion[];
}

// ============================================================================
// Supporting Types
// ============================================================================

export interface ChallengeOption {
    id: string;
    text: string;
    correct?: boolean;
    feedback?: string;
}

export interface Scenario {
    context: string;
    chart_config?: {
        ticker: string;
        timeframe: string;
        date_range?: string;
        indicators?: string[];
        markers?: Record<string, ScenarioMarker>;
    };
}

export interface ScenarioMarker {
    price: number;
    label: string;
}

export interface RiskScenario {
    account_balance: number;
    risk_per_trade: number; // percentage
    entry_price: number;
    stop_loss: number;
    lot_size?: number;
}

export interface CaseStudy {
    context: string;
    trader_profile?: Record<string, any>;
    timeline: TimelineEvent[];
    key_lessons?: string[];
}

export interface TimelineEvent {
    date: string;
    action: string;
    thought?: string;
    emotion?: string;
    decision?: string;
}

export interface CaseStudyQuestion {
    question: string;
    type?: 'multiple_choice' | 'calculation' | 'text';
    options?: ChallengeOption[];
    correct_answer: string | number;
    explanation: string;
}

// ============================================================================
// Challenge Attempts
// ============================================================================

export interface ChallengeAttempt {
    id: string;
    user_id: string;
    challenge_id: string;
    started_at: string;
    completed_at?: string | null;
    success?: boolean | null;
    score?: number | null;
    time_taken?: number | null;
    attempt_data?: Record<string, any>;
    feedback_viewed: boolean;
    created_at: string;
}

export interface ChallengeResult {
    success: boolean;
    score: number;
    feedback: string;
    explanation?: string;
    time_taken?: number;
}

// ============================================================================
// User Stats
// ============================================================================

export interface UserChallengeStats {
    user_id: string;
    total_xp: number;
    current_level: ChallengeLevel;
    challenges_completed: number;
    challenges_failed: number;
    current_streak: number;
    longest_streak: number;
    last_completed_at?: string | null;
    achievements: string[];
    updated_at: string;
}

// ============================================================================
// Level Configuration
// ============================================================================

export interface LevelConfig {
    level: ChallengeLevel;
    name: string;
    xp_min: number;
    xp_max: number;
    icon: string;
    description: string;
}

export const LEVEL_CONFIGS: LevelConfig[] = [
    {
        level: 1,
        name: 'Pemula',
        xp_min: 0,
        xp_max: 500,
        icon: '🌱',
        description: 'Seedling - Baru mulai belajar',
    },
    {
        level: 2,
        name: 'Dasar',
        xp_min: 500,
        xp_max: 1500,
        icon: '🌿',
        description: 'Growing - Memahami dasar-dasar',
    },
    {
        level: 3,
        name: 'Menengah',
        xp_min: 1500,
        xp_max: 3500,
        icon: '🌳',
        description: 'Mature - Siap praktik',
    },
    {
        level: 4,
        name: 'Mahir',
        xp_min: 3500,
        xp_max: 7000,
        icon: '🏆',
        description: 'Champion - Trader aktif',
    },
    {
        level: 5,
        name: 'Expert',
        xp_min: 7000,
        xp_max: Infinity,
        icon: '👑',
        description: 'Master - Master trader',
    },
];

// ============================================================================
// Category Configuration
// ============================================================================

export interface CategoryConfig {
    type: ChallengeType;
    name: string;
    icon: string;
    description: string;
    color: string;
}

export const CATEGORY_CONFIGS: CategoryConfig[] = [
    {
        type: 'pattern',
        name: 'Pattern Recognition',
        icon: '📊',
        description: 'Identify candlestick and chart patterns',
        color: '#2196F3',
    },
    {
        type: 'indicator',
        name: 'Indicator Mastery',
        icon: '📈',
        description: 'Master technical indicators',
        color: '#4CAF50',
    },
    {
        type: 'entry_exit',
        name: 'Entry & Exit Timing',
        icon: '⏱️',
        description: 'Perfect your timing',
        color: '#FF9800',
    },
    {
        type: 'risk',
        name: 'Risk Management',
        icon: '💰',
        description: 'Manage your risk effectively',
        color: '#F44336',
    },
    {
        type: 'psychology',
        name: 'Psychology & Discipline',
        icon: '🧠',
        description: 'Master your emotions',
        color: '#9C27B0',
    },
    {
        type: 'case_study',
        name: 'Case Study Analysis',
        icon: '📚',
        description: 'Learn from real scenarios',
        color: '#00BCD4',
    },
];
