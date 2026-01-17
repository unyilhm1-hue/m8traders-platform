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
 * Normalize candle schema from MERGED format to standard t/o/h/l/c/v
 * STRICT: Only accepts timestamp field (ISO 8601 format)
 * Rejects legacy formats without timestamp metadata
 */
function normalizeCandle(raw: any, dateContext?: string): Candle {
    // If already in correct format with numeric timestamp, return as-is
    if (raw.t !== undefined && raw.o !== undefined && typeof raw.t === 'number') {
        return raw as Candle;
    }
    // 🔥 Priority 1: timestamp (ISO 8601 format from MERGED files)
    if (!raw.timestamp) {
        throw new Error('[Loader] Cannot normalize candle without timestamp field');
    }

    const timestamp = parseTimeToTimestamp(raw.timestamp, dateContext);

    // 🔥 FIX #20: Use nullish coalescing to handle zero values correctly
    // e.g., if open=0 is valid, we don't want to fallback to raw.o
    return {
        t: timestamp,
        o: raw.open ?? raw.o ?? 0,
        h: raw.high ?? raw.h ?? 0,
        l: raw.low ?? raw.l ?? 0,
        c: raw.close ?? raw.c ?? 0,
        v: raw.volume ?? raw.v ?? 0
    };
}

/**
 * Load candles for a single date (MERGED files only)
 * 🔥 GATEKEEPER: Only loads _MERGED.json files with metadata
 */
async function loadSingleDayCandles(
    ticker: string,
    date: string,
    interval: IntervalType
): Promise<Candle[]> {
    // 🆕 MERGED file pattern (master multi-day file)
    const mergedFilename = `${ticker}_${interval}_MERGED.json`;
    const mergedPath = path.join(DATA_DIR, mergedFilename);

    try {
        const content = await fs.readFile(mergedPath, 'utf-8');
        const data = JSON.parse(content);

        // 🔥 GATEKEEPER: Validate metadata existence
        if (!data.metadata) {
            throw new Error(`Invalid Data Source: Raw file detected (missing metadata) in ${mergedFilename}`);
        }

        console.log(`[SmartLoader] 📦 Loaded ${mergedFilename}: ${data.candles.length} total candles, metadata: ${data.metadata.data_start} to ${data.metadata.data_end}`);

        // Filter candles for target date (MERGED files contain multi-day data)
        const targetDateCandles = filterCandlesByDate(data.candles, date);

        if (targetDateCandles.length === 0) {
            console.warn(`[SmartLoader] ⚠️ No candles found for ${ticker} on ${date} in MERGED file`);
            return [];
        }

        // Normalize to t/o/h/l/c/v format
        const normalizedCandles = targetDateCandles.map((raw: any) => normalizeCandle(raw, date));

        console.log(`[SmartLoader] ✅ Extracted ${normalizedCandles.length} candles for ${date} from MERGED file`);
        return normalizedCandles;

    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            console.error(`[SmartLoader] ❌ MERGED file not found: ${mergedFilename}. Only MERGED files are supported.`);
        } else {
            console.error(`[SmartLoader] ❌ Failed to load ${mergedFilename}:`, error);
        }
        return [];
    }
}

/**
 * Filter candles from MERGED file that belong to a specific date
 * 
 * 🔥 FIX #19: Use WIB timezone for consistency with store
 * Prevents off-by-one day errors when filtering local data
 * 
 * @param candles - Array of candles from MERGED file (can span multiple days)
 * @param targetDate - Date string in YYYY-MM-DD format
 * @returns Candles that fall within the target date (00:00:00 to 23:59:59 WIB)
 */
function filterCandlesByDate(candles: Candle[], targetDate: string): Candle[] {
    // 🔥 FIX #19: Use WIB timezone (+07:00) for consistency
    const startOfDay = new Date(`${targetDate}T00:00:00+07:00`).getTime();
    const endOfDay = new Date(`${targetDate}T23:59:59.999+07:00`).getTime();

    return candles.filter(candle => {
        const ts = candle.t;
        return ts >= startOfDay && ts <= endOfDay;
    });
}

/**
 * Load warmup buffer (historical candles before target date)
 * 
 * Strategy: Load MERGED file once and filter for candles BEFORE target date
 * This eliminates 404 errors from scanning individual daily files
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

    // 🔥 NEW APPROACH: Load from MERGED file instead of scanning daily files
    const mergedFilename = `${ticker}_${interval}_MERGED.json`;
    const mergedPath = path.join(DATA_DIR, mergedFilename);

    try {
        const content = await fs.readFile(mergedPath, 'utf-8');
        const data = JSON.parse(content);

        // Validate metadata
        if (!data.metadata) {
            console.error(`[SmartLoader] ❌ MERGED file missing metadata: ${mergedFilename}`);
            return [];
        }

        console.log(`[SmartLoader] 📦 Loading warmup from ${mergedFilename} (${data.candles.length} total candles)`);

        // Filter candles BEFORE startDate
        const startDateMs = new Date(startDate + 'T00:00:00Z').getTime();
        const warmupCandles = data.candles
            .filter((c: any) => {
                if (!c.timestamp) return false;
                const ts = new Date(c.timestamp).getTime();
                return ts < startDateMs; // Only candles BEFORE target date
            })
            .map((raw: any) => normalizeCandle(raw, startDate));

        // Take last N candles (most recent before startDate)
        const buffer = warmupCandles.slice(-warmupCount);

        // Cache the buffer
        if (buffer.length > 0) {
            warmupCache.set(ticker, interval, buffer);
        }

        console.log(`[SmartLoader] ✅ Warmup buffer: ${buffer.length} candles (target: ${warmupCount}, available: ${warmupCandles.length})`);

        return buffer;

    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            console.error(`[SmartLoader] ❌ MERGED file not found: ${mergedFilename}`);
        } else {
            console.error(`[SmartLoader] ❌ Failed to load warmup from ${mergedFilename}:`, error);
        }
        return [];
    }
}

/**
 * Quick check if data exists for a ticker+date+interval
 * Now checks MERGED files instead of individual date files
 */
export async function dataExists(
    ticker: string,
    date: string,
    interval: IntervalType
): Promise<boolean> {
    const mergedFilename = `${ticker}_${interval}_MERGED.json`;
    const mergedPath = path.join(DATA_DIR, mergedFilename);

    try {
        // Check if MERGED file exists
        await fs.access(mergedPath);

        // Read metadata to verify date is in range
        const content = await fs.readFile(mergedPath, 'utf-8');
        const data = JSON.parse(content);

        if (!data.metadata) {
            return false;
        }

        // Check if target date is within MERGED file's date range
        const targetDate = new Date(date);
        const startDate = new Date(data.metadata.data_start.split('T')[0]);
        const endDate = new Date(data.metadata.data_end.split('T')[0]);

        return targetDate >= startDate && targetDate <= endDate;

    } catch {
        return false;
    }
}
