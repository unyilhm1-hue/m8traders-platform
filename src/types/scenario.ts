/**
 * Scenario Types
 * Frozen historical scenarios for practice trading
 */

import type { Candle } from './chart';

export interface ScenarioDefinition {
    id: string;
    name: string;
    ticker: string;
    interval: '1m' | '5m' | '15m' | '1h';
    windows: string[];           // Window IDs used
    startTimestamp: number;
    endTimestamp: number;
    totalCandles: number;
    metadata?: {
        description?: string;
        tags?: string[];
        difficulty?: 'easy' | 'medium' | 'hard';
        createdAt?: number;
    };
}

export interface ScenarioData extends ScenarioDefinition {
    candles: Candle[];           // Frozen candle data
}
