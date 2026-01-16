/**
 * Smart Buffering Data Loader
 * Implements "Warm-Up Buffer" architecture for high-precision simulation
 * 
 * Philosophy:
 * - Market context (trend, volatility) requires historical lookback
 * - First candle shouldn't be "cold" - it needs to know market state
 * - Load extra 200 candles BEFORE start date for indicator warm-up
 * 
 * @see simulation.worker.ts for consumer logic
 */

import { promises as fs } from 'fs';  // 🔥 FIXED: was incorrectly importing from 'path' instead of 'fs'
import path from 'path';
import type { Candle } from '@/utils/candleAggregation';
import type { IntervalType } from '@/types/intervals';
import { aggregateCandles } from '@/utils/candleAggregation';
import { findBestSourceInterval } from '@/utils/dataAvailability';
import { warmupCache } from '@/utils/warmupCache';  // 🆕 FIX 1: Cache layer

const DATA_DIR = path.join(process.cwd(), 'public', 'simulation-data');

/**
 * Smart loader result with separated buffers
 */
export interface SmartLoadResult {
    ticker: string;
    date: string;
    interval: IntervalType;

    // History: Past 200 candles for warm-up (do NOT animate)
    historyBuffer: Candle[];

    // Simulation: Future candles to animate tick-by-tick
    simulationQueue: Candle[];

    // Metadata
    sourceInterval: IntervalType; // Original data interval
    wasAggregated: boolean;       // true if aggregation was performed
    totalCandles: number;         // historyBuffer.length + simulationQueue.length
}

/**
 * Load data with smart buffering
 * 
 * Algorithm:
 * 1. Scan backwards from target date to find 200 candles for warm-up
 * 2. Load target date candles for simulation
 * 3. Aggregate to target interval if needed
 * 4. Split into historyBuffer (warm-up) + simulationQueue (animate)
 * 
 * @param ticker - Stock ticker (e.g., 'ADRO')
 * @param startDate - Target simulation date (YYYY-MM-DD)
 * @param targetInterval - Desired candle interval
 * @param warmupCount - Number of candles for warm-up buffer (default: 200)
 * 
 * @example
 * const data = await loadWithSmartBuffering('ADRO', '2026-01-15', '5m', 200);
 * // data.historyBuffer → 200 candles BEFORE 2026-01-15 (for MA/RSI calculation)
 * // data.simulationQueue → All candles ON 2026-01-15 (animated)
 */
export async function loadWithSmartBuffering(
    ticker: string,
    startDate: string,
    targetInterval: IntervalType,
    warmupCount: number = 200
): Promise<SmartLoadResult | null> {
    console.log(`[SmartLoader] Loading ${ticker} ${startDate} at ${targetInterval} with ${warmupCount} candle warm-up`);

    // 1. Find best source interval for this date
    const sourceInterval = await findBestSourceInterval(ticker, startDate, targetInterval);

    if (!sourceInterval) {
        console.error(`[SmartLoader] No compatible data found for ${ticker} ${startDate}`);
        return null;
    }

    console.log(`[SmartLoader] Using source interval: ${sourceInterval}`);

    // 2. Load target date candles (simulationQueue)
    const simulationRaw = await loadSingleDayCandles(ticker, startDate, sourceInterval);

    if (!simulationRaw || simulationRaw.length === 0) {
        console.error(`[SmartLoader] No data for ${ticker} ${startDate}`);
        return null;
    }

    // 3. Load warm-up buffer (200 candles BEFORE startDate)
    const historyRaw = await loadWarmupBuffer(ticker, startDate, sourceInterval, warmupCount);

    console.log(`[SmartLoader] Loaded: ${historyRaw.length} history + ${simulationRaw.length} simulation candles`);

    // 4. Aggregate if needed
    let historyBuffer = historyRaw;
    let simulationQueue = simulationRaw;
    let wasAggregated = false;

    if (sourceInterval !== targetInterval) {
        historyBuffer = aggregateCandles(historyRaw, sourceInterval, targetInterval);
        simulationQueue = aggregateCandles(simulationRaw, sourceInterval, targetInterval);
        wasAggregated = true;
    }

    return {
        ticker,
        date: startDate,
        interval: targetInterval,
        historyBuffer,
        simulationQueue,
        sourceInterval,
        wasAggregated,
        totalCandles: historyBuffer.length + simulationQueue.length
    };
}

/**
 * Parse time string (HH:MM or HH:MM:SS) to timestamp in milliseconds
 * Assumes date context from surrounding data or uses current date
 */
function parseTimeToTimestamp(timeStr: string | number, dateContext?: string): number {
    // If already a number, return as-is (assuming it's already a timestamp)
    if (typeof timeStr === 'number') {
        return timeStr < 10000000000 ? timeStr * 1000 : timeStr;
    }

    // Parse time string (HH:MM or HH:MM:SS)
    const parts = timeStr.split(':');
    if (parts.length < 2) {
        console.warn(`[SmartLoader] Invalid time format: ${timeStr}`);
        return Date.now();
    }

    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parts[2] ? parseInt(parts[2], 10) : 0;

    // Use dateContext if provided, otherwise use current date
    const date = dateContext ? new Date(dateContext) : new Date();
    date.setHours(hours, minutes, seconds, 0);

    return date.getTime();
}

/**
 * Normalize candle schema from various formats to standard t/o/h/l/c/v
 * Handles both legacy (time/open/high/low/close) and new (t/o/h/l/c) formats
 */
function normalizeCandle(raw: any, dateContext?: string): Candle {
    // If already in correct format with numeric timestamp, return as-is
    if (raw.t !== undefined && raw.o !== undefined && typeof raw.t === 'number') {
        return raw as Candle;
    }

    // Convert legacy format (time/open/high/low/close/volume) to t/o/h/l/c/v
    const timeValue = raw.time || raw.t;

    return {
        t: parseTimeToTimestamp(timeValue, dateContext),  // 🔥 FIX: Convert time string to timestamp
        o: raw.open || raw.o,         // Support both 'open' and 'o'
        h: raw.high || raw.h,         // Support both 'high' and 'h'
        l: raw.low || raw.l,          // Support both 'low' and 'l'
        c: raw.close || raw.c,        // Support both 'close' and 'c'
        v: raw.volume || raw.v || 0   // Support both 'volume' and 'v', default to 0
    };
}

/**
 * Load candles for a single date
 */
async function loadSingleDayCandles(
    ticker: string,
    date: string,
    interval: IntervalType
): Promise<Candle[]> {
    const filename = `${ticker}_${interval}_${date}.json`;
    const filepath = path.join(DATA_DIR, filename);

    try {
        const content = await fs.readFile(filepath, 'utf-8');
        const data = JSON.parse(content);

        // Handle different JSON formats (array or object with candles property)
        const rawCandles = Array.isArray(data) ? data : data.candles || [];

        // 🔥 NORMALIZE: Convert all candles to t/o/h/l/c/v format with proper timestamp
        const normalizedCandles = rawCandles.map((raw: any) => normalizeCandle(raw, date));

        console.log(`[SmartLoader] Loaded ${filename}: ${normalizedCandles.length} candles (normalized)`);
        return normalizedCandles;

    } catch (error) {
        console.error(`[SmartLoader] Failed to load ${filename}:`, error);
        return [];
    }
}

/**
 * Load warm-up buffer by scanning backwards from start date
 * Collects candles from previous trading days until warmupCount is reached
 * 
 * @example
 * // Target: 2026-01-15, warmup: 200 candles
 * // Scans: 2026-01-14, 2026-01-13, 2026-01-12, ... until 200 candles collected
 */
async function loadWarmupBuffer(
    ticker: string,
    startDate: string,
    interval: IntervalType,
    warmupCount: number
): Promise<Candle[]> {
    // 🆕 FIX 1: Check cache first
    const cached = warmupCache.get(ticker, interval);
    if (cached && cached.length >= warmupCount) {
        console.log(`[SmartLoader] 🚀 Cache hit: ${ticker} ${interval} (${cached.length} candles)`);
        // Return exactly warmupCount (trim if cache has more)
        return cached.slice(-warmupCount);
    }

    const buffer: Candle[] = [];
    const startDateObj = new Date(startDate);

    // Scan backwards up to 60 days (should be more than enough)
    const maxDaysBack = 60;

    for (let daysBack = 1; daysBack <= maxDaysBack && buffer.length < warmupCount; daysBack++) {
        const scanDate = new Date(startDateObj);
        scanDate.setDate(scanDate.getDate() - daysBack);

        // Skip weekends for stock data
        const dayOfWeek = scanDate.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            continue; // Sunday or Saturday
        }

        const dateStr = scanDate.toISOString().split('T')[0];
        const candles = await loadSingleDayCandles(ticker, dateStr, interval);

        if (candles.length > 0) {
            // Prepend (newest first, so reverse order)
            buffer.unshift(...candles);
        }
    }

    // Trim to exactly warmupCount (take most recent)
    if (buffer.length > warmupCount) {
        buffer.splice(0, buffer.length - warmupCount);
    }

    // 🆕 FIX 1: Cache the loaded buffer
    if (buffer.length > 0) {
        warmupCache.set(ticker, interval, buffer);
    }

    console.log(`[SmartLoader] Warm-up buffer: ${buffer.length} candles (target: ${warmupCount})`);

    return buffer;
}

/**
 * Quick check if data exists for a ticker+date+interval
 */
export async function dataExists(
    ticker: string,
    date: string,
    interval: IntervalType
): Promise<boolean> {
    const filename = `${ticker}_${interval}_${date}.json`;
    const filepath = path.join(DATA_DIR, filename);

    try {
        await fs.access(filepath);
        return true;
    } catch {
        return false;
    }
}
