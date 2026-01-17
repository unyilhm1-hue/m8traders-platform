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
 * Parse time string (HH:MM or HH:MM:SS) or ISO 8601 timestamp to milliseconds
 * Handles both legacy time-only formats and modern full ISO timestamps
 */
function parseTimeToTimestamp(timeStr: string | number, dateContext?: string): number {
    // If already a number, return as-is (assuming it's already a timestamp)
    if (typeof timeStr === 'number') {
        return timeStr < 10000000000 ? timeStr * 1000 : timeStr;
    }

    // 🔥 OPTIMIZED: Strict ISO 8601 detection (fast path)
    // Supports: "2025-12-19T02:00:00Z" or "2026-01-14T10:30:00.000Z"
    if (timeStr.length >= 19 && timeStr[10] === 'T') {
        const timestamp = new Date(timeStr).getTime();
        if (!isNaN(timestamp)) {
            return timestamp;
        }
    }

    // Legacy support disabled for large datasets
    if (timeStr.length < 10) {
        // e.g. "09:00:00"
        if (dateContext) {
            return new Date(`${dateContext}T${timeStr}Z`).getTime();
        }
    }

    console.warn(`[SmartLoader] Invalid timestamp format: ${timeStr}`);
    return Date.now();

    // Legacy parsing removed
    /*
    // Parse legacy time-only string (HH:MM or HH:MM:SS)
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
    */
}

/**
 * Normalize candle schema from MERGED format to standard t/o/h/l/c/v
 * STRICT: Only accepts timestamp field (ISO 8601 format)
 * Rejects legacy formats without timestamp metadata
 */
/**
 * Normalize candle schema from MERGED format to standard t/o/h/l/c/v
 * STRICT: Only accepts timestamp field (ISO 8601 format)
 * Rejects legacy formats without timestamp metadata
 * 
 * 🔥 PRO UPDATE: Includes Data Integrity Check & Volume Normalization
 */
function normalizeCandle(raw: any, dateContext?: string, metadata?: any): Candle | null {
    // 🔥 FIX: Priority 1 - Zero Handling
    // If invalid candle (all zeros), return null to skip
    if (!raw.open && !raw.close && !raw.high && !raw.low) {
        return null;
    }

    // Timestamp parsing (same as before)
    let timestamp: number;
    if (raw.t !== undefined && typeof raw.t === 'number') {
        timestamp = raw.t;
    } else if (raw.timestamp) {
        timestamp = parseTimeToTimestamp(raw.timestamp, dateContext);
    } else {
        return null; // Skip invalid candles
    }

    // 🔥 FIX: OHLC Sanitization
    let o = raw.open ?? raw.o ?? 0;
    let h = raw.high ?? raw.h ?? 0;
    let l = raw.low ?? raw.l ?? 0;
    let c = raw.close ?? raw.c ?? 0;
    let v = raw.volume ?? raw.v ?? 0;

    // Sanity Check: High must be >= max(Open, Close)
    const maxOC = Math.max(o, c);
    if (h < maxOC) h = maxOC;

    // Sanity Check: Low must be <= min(Open, Close)
    const minOC = Math.min(o, c);
    if (l > minOC) l = minOC;

    // Sanity Check: High must be >= Low
    if (h < l) {
        const temp = h;
        h = l;
        l = temp;
    }

    // 🔥 FIX: Metadata-First Volume Sanitization
    // Goal: Detect if volume is in Shares (Millions) or Lots (Hundreds)
    if (v > 0) {
        let isShares = false;

        // 1. Check Metadata explicit flag (future proofing)
        if (metadata?.volume_type === 'shares' || metadata?.lot_size === 1) {
            isShares = true;
        } else if (metadata?.volume_type === 'lots' || metadata?.lot_size === 100) {
            isShares = false;
        }
        // 2. Heuristic Fallback (if no metadata)
        // If volume is massive (> 100,000 avg), it's likely Shares
        // Note: We check per single candle here, slightly aggressive but safe enough for ID Stocks
        else if (v > 500000) {
            isShares = true;
        }

        if (isShares) {
            v = Math.round(v / 100); // Convert to Lots
        }
    }

    return { t: timestamp, o, h, l, c, v };
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
    // 🔥 FIX: Remove .JK suffix for filename lookup
    const fileTicker = ticker.replace(/\.JK$/, '');
    const mergedFilename = `${fileTicker}_${interval}_MERGED.json`;
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
        const normalizedCandles = targetDateCandles
            .map((raw: any) => normalizeCandle(raw, date, data.metadata))
            .filter((c: any): c is Candle => c !== null);

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
 * 🔥 FIX: Use UTC timezone to match UTC timestamps in MERGED files
 * MERGED candles have timestamps like "2026-01-14T10:00:00Z" (UTC)
 * So we must filter using UTC day boundaries, not WIB
 * 
 * @param candles - Array of candles from MERGED file (can span multiple days)
 * @param targetDate - Date string in YYYY-MM-DD format
 * @returns Candles that fall within the target date (00:00:00 to 23:59:59 UTC)
 */
/**
 * Filter candles from MERGED file that belong to a specific date
 * 
 * 🔥 FIX: Use UTC timezone to match UTC timestamps in MERGED files
 * MERGED candles have timestamps like "2026-01-14T10:00:00Z" (UTC)
 * So we must filter using UTC day boundaries, not WIB
 * 
 * 🔥 FIX: Handle raw candles (timestamp string) vs normalized (t number)
 */
function filterCandlesByDate(candles: Candle[], targetDate: string): Candle[] {
    // 🔥 FIX: Use UTC boundaries since data timestamps are in UTC
    // "2026-01-14" → 2026-01-14 00:00:00 UTC to 2026-01-14 23:59:59.999 UTC
    const startOfDay = new Date(`${targetDate}T00:00:00Z`).getTime();
    const endOfDay = new Date(`${targetDate}T23:59:59.999Z`).getTime();

    console.log(`[SmartLoader] Filtering ${candles.length} candles for date ${targetDate}`);
    console.log(`[SmartLoader] UTC range: ${new Date(startOfDay).toISOString()} to ${new Date(endOfDay).toISOString()}`);

    // Check first candle safely
    const firstCandle = candles[0] as any;
    if (firstCandle) {
        const firstTs = firstCandle.t ?? (firstCandle.timestamp ? new Date(firstCandle.timestamp).getTime() : 'N/A');
        console.log(`[SmartLoader] First candle timestamp: ${firstTs} (${new Date(firstTs).toISOString()})`);
    }

    const filtered = candles.filter(candle => {
        // 🔥 Handle both normalized (t) and raw (timestamp) formats
        let ts: number;
        if ((candle as any).t !== undefined) {
            ts = (candle as any).t;
        } else if ((candle as any).timestamp) {
            ts = new Date((candle as any).timestamp).getTime();
        } else {
            return false;
        }

        // Verify we are comparing milliseconds
        return ts >= startOfDay && ts <= endOfDay;
    });

    console.log(`[SmartLoader] Filtered result: ${filtered.length} candles for ${targetDate}`);
    if (filtered.length > 0) {
        // Log first and last filtered candle to verify range
        const firstFiltered = filtered[0] as any;
        const lastFiltered = filtered[filtered.length - 1] as any;

        const firstTs = firstFiltered.t ?? new Date(firstFiltered.timestamp).getTime();
        const lastTs = lastFiltered.t ?? new Date(lastFiltered.timestamp).getTime();

        console.log(`[SmartLoader] First filtered: ${firstTs} (${new Date(firstTs).toISOString()})`);
        console.log(`[SmartLoader] Last filtered: ${lastTs} (${new Date(lastTs).toISOString()})`);
    } else {
        console.warn(`[SmartLoader] ⚠️ No candles found in UTC range for ${targetDate}`);
    }

    return filtered;
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
    // 🔥 FIX: Remove .JK suffix for filename lookup
    const fileTicker = ticker.replace(/\.JK$/, '');
    const mergedFilename = `${fileTicker}_${interval}_MERGED.json`;
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
            .map((raw: any) => normalizeCandle(raw, startDate, data.metadata))
            .filter((c: any): c is Candle => c !== null); // Filter out invalid candles

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
    // 🔥 FIX: Remove .JK suffix for filename lookup
    const fileTicker = ticker.replace(/\.JK$/, '');
    const mergedFilename = `${fileTicker}_${interval}_MERGED.json`;
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
