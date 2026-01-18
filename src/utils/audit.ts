/**
 * Auto-Audit Utility ("Data Police")
 * Provides automatic validation logic for data checkpoints.
 */

import { Candle, EnrichedCandle } from "@/types";

export const Audit = {
    /**
     * Checkpoint A: Raw Data Validation
     * Checks if JSON structure is valid and contains essential fields.
     */
    validateRawData: (data: any): { valid: boolean; error?: string } => {
        if (!data) return { valid: false, error: 'Data is null or undefined' };
        if (!Array.isArray(data)) return { valid: false, error: 'Data is not an array' };
        if (data.length === 0) return { valid: false, error: 'Data array is empty' };

        // Sample first items
        const sample = data[0];
        if (!sample.t || !sample.o || !sample.h || !sample.l || !sample.c || !sample.v) {
            return { valid: false, error: `Missing required OHLCV fields in sample: ${JSON.stringify(sample)}` };
        }

        return { valid: true };
    },

    /**
     * Checkpoint B: Candle Logic
     * Checks for impossible physics (High < Low, Low > High, NaN values).
     */
    validateCandleLogic: (candle: Candle, index: number): { valid: boolean; error?: string } => {
        // NaN check
        if (isNaN(candle.o) || isNaN(candle.h) || isNaN(candle.l) || isNaN(candle.c)) {
            return { valid: false, error: `NaN values detected at index ${index}` };
        }

        // Logic check
        if (candle.h < candle.l) {
            return { valid: false, error: `High < Low detected at index ${index} (H:${candle.h}, L:${candle.l})` };
        }
        if (candle.c > candle.h || candle.o > candle.h) {
            return { valid: false, error: `Close or Open > High at index ${index}` };
        }
        if (candle.c < candle.l || candle.o < candle.l) {
            return { valid: false, error: `Close or Open < Low at index ${index}` };
        }

        return { valid: true };
    },

    /**
     * Checkpoint C: Worker Output (Enriched)
     * Checks if Worker A successfully enriched the data.
     */
    validateEnrichedData: (candles: EnrichedCandle[]): { valid: boolean; error?: string } => {
        if (!candles || candles.length === 0) return { valid: false, error: 'No enriched candles produced' };

        const sample = candles[Math.floor(Math.random() * Math.min(candles.length, 100))];

        if (sample.isBullish === undefined) return { valid: false, error: 'Missing isBullish field' };
        if (sample.bodyRatio === undefined) return { valid: false, error: 'Missing bodyRatio field' };
        if (!sample.pattern) return { valid: false, error: 'Missing pattern field' };

        return { valid: true };
    },

    /**
     * Checkpoint D: Tick Consistency
     * Ensures generated ticks stay within their parent candle's range.
     */
    validateTickPhysics: (tickPrice: number, candle: Candle): boolean => {
        return tickPrice >= candle.l && tickPrice <= candle.h;
    }
};
