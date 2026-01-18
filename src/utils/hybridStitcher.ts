/**
 * Smart Hybrid Data Stitcher (IDX-Optimized)
 * ============================================
 * Combines long-term historical data (60m, 2 years) with recent detailed data (1m, 30 days)
 * for optimal chart performance and accurate long-term technical analysis.
 * 
 * IDX Market Characteristics:
 * - Trading hours: 330 min/day (Mon-Thu), 270 min/day (Fri)
 * - Lunch break: 12:00-13:30 (Mon-Thu) or 11:30-14:00 (Fri)
 * - 30 days 1m data ≈ 6000 candles (only ~100 candles when resampled to 1h)
 * 
 * Philosophy (IDX-Specific):
 * - Small intervals (<30m): Use pure 1m resampling (fast, sufficient data)
 * - Large intervals (≥30m): Hybrid stitch 60m tail + 1m head (2-year history needed)
 * 
 * @see implementation_plan.md for architecture details
 */

import type { Interval } from './candleResampler';
import { intervalToMinutes, resampleCandles } from './candleResampler';
import type { ResampledCandle } from './candleResampler';

/**
 * Configuration for hybrid stitching
 */
export interface StitchConfig {
    ticker: string;
    targetInterval: Interval;
    stitchPoint?: Date; // Auto-detected from data if not provided
}

/**
 * Result of hybrid stitching with metadata
 */
export interface StitchedData {
    candles: ResampledCandle[];
    metadata: {
        historySource: 'resampled' | 'hybrid' | 'native';
        historicalDays: number;
        stitchPoint?: number; // Unix timestamp in seconds
        tailCandles: number;  // Number of candles from 60m file
        headCandles: number;  // Number of candles from 1m file
    };
}

/**
 * Merged JSON file structure from public/simulation-data
 */
interface MergedFileData {
    ticker: string;
    interval: string;
    metadata: {
        data_start: string;  // ISO 8601
        data_end: string;    // ISO 8601
        total_candles: number;
        duration_days: number;
    };
    candles: Array<{
        timestamp: string;
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
    }>;
}

/**
 * Load merged JSON file from public/simulation-data
 */
async function loadMergedFile(ticker: string, interval: Interval): Promise<MergedFileData> {
    // 🔥 FIX: Strip .JK suffix (BBRI.JK → BBRI)
    const cleanTicker = ticker.replace(/\.JK$/i, '');
    const filename = `${cleanTicker}_${interval}_MERGED.json`;
    const url = `/simulation-data/${filename}`;

    console.log(`[HybridStitcher] Loading ${filename}...`);

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load ${filename}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`[HybridStitcher] ✅ Loaded ${data.candles.length} candles from ${filename}`);

    return data;
}

/**
 * Convert merged file candles to ResamplerCandle format
 */
function convertToResamplerFormat(candles: MergedFileData['candles']): ResampledCandle[] {
    return candles.map(c => ({
        time: new Date(c.timestamp).getTime(), // Convert to ms timestamp
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume
    }));
}

/**
 * Check if interval requires hybrid stitching
 * 
 * IDX Market Constraint:
 * - Trading hours: 330 min/day (Mon-Thu) or 270 min/day (Fri)
 * - 30 days 1m data = ~6000 candles
 * - Resampled to 30m = 200 candles (CRITICAL: barely enough for MA200)
 * - Resampled to 60m = 100 candles (FAIL: not enough for indicators)
 * 
 * Threshold: ≥30m requires hybrid stitching for IDX
 * Small intervals (<30m) use pure resampling, large intervals (≥30m) use hybrid
 */
function needsHybridStitching(interval: Interval): boolean {
    return intervalToMinutes(interval) >= 30; // 🔥 IDX-specific threshold
}

/**
 * Stitch long-term (60m) and short-term (1m) data
 */
async function stitchLongAndShort(config: StitchConfig): Promise<StitchedData> {
    console.log(`[HybridStitcher] 🔗 Stitching ${config.ticker} for ${config.targetInterval}`);

    // 1. Load both data sources in parallel
    const [longData, shortData] = await Promise.all([
        loadMergedFile(config.ticker, '60m'),
        loadMergedFile(config.ticker, '1m')
    ]);

    // 🛡️ GUARD 2: Validate loaded data
    if (!longData || !longData.candles || longData.candles.length === 0) {
        console.warn(`[HybridStitcher] ⚠️ No 60m data, falling back to pure 1m resample`);
        return await loadPureResampled(config);
    }

    if (!shortData || !shortData.candles || shortData.candles.length === 0) {
        console.warn(`[HybridStitcher] ⚠️ No 1m data, using 60m only`);
        const longCandles = convertToResamplerFormat(longData.candles);
        const resampled = resampleCandles(longCandles, '60m', config.targetInterval);
        return {
            candles: resampled,
            metadata: {
                ticker: config.ticker,
                interval: config.targetInterval,
                totalCandles: resampled.length,
                historicalDays: 730,
                recentDays: 0,
                stitchPoint: 0,
                historySource: '60m',
                headSource: 'none'
            }
        };
    }

    // 2. Convert to resampler format
    const longCandles = convertToResamplerFormat(longData.candles);
    const shortCandles = convertToResamplerFormat(shortData.candles);

    // 3. Find stitch point (where 1m data begins)
    const stitchPointMs = new Date(shortData.metadata.data_start).getTime();
    const stitchPointSec = Math.floor(stitchPointMs / 1000);

    console.log(`[HybridStitcher] 📍 Stitch point: ${shortData.metadata.data_start} (${stitchPointSec})`);

    // 4. Trim tail: Remove 60m candles that overlap with 1m data
    // Ensure time is number for comparison
    const trimmedTail = longCandles.filter(c => {
        const candleTime = typeof c.time === 'number' ? c.time : new Date(c.time).getTime();
        return candleTime < stitchPointMs;
    });
    console.log(`[HybridStitcher] ✂️ Trimmed 60m: ${longCandles.length} → ${trimmedTail.length} candles`);

    // 5. Resample head (1m → target interval)
    const resampledHead = resampleCandles(shortCandles, '1m', config.targetInterval);
    console.log(`[HybridStitcher] 📊 Resampled 1m: ${shortCandles.length} → ${resampledHead.length} candles`);

    // 6. For target interval of exactly 60m, use native 60m tail (no resampling needed)
    // For other intervals, resample the tail as well
    let processedTail: ResampledCandle[];
    if (config.targetInterval === '60m' || config.targetInterval === '1h') {
        processedTail = trimmedTail;
        console.log(`[HybridStitcher] ✅ Using native 60m data for tail`);
    } else {
        processedTail = resampleCandles(trimmedTail, '60m', config.targetInterval);
        console.log(`[HybridStitcher] 📊 Resampled tail: ${trimmedTail.length} → ${processedTail.length} candles`);
    }

    // 7. Merge tail + head
    const stitched = [...processedTail, ...resampledHead];

    // 8. Calculate metadata
    const firstCandle = stitched[0];
    const firstCandleTime = firstCandle
        ? (typeof firstCandle.time === 'number' ? firstCandle.time : new Date(firstCandle.time).getTime())
        : Date.now();
    const historicalDays = Math.floor((Date.now() - firstCandleTime) / (1000 * 60 * 60 * 24));

    console.log(`[HybridStitcher] ✅ Stitched: ${stitched.length} candles, ${historicalDays} days of history`);

    return {
        candles: stitched,
        metadata: {
            historySource: 'hybrid',
            historicalDays,
            stitchPoint: stitchPointSec,
            tailCandles: processedTail.length,
            headCandles: resampledHead.length
        }
    };
}

/**
 * Load data using pure resampling (for small intervals)
 */
async function loadPureResampled(config: StitchConfig): Promise<StitchedData> {
    console.log(`[HybridStitcher] ⚡ Pure resample ${config.ticker} → ${config.targetInterval}`);

    // Load 1m data
    const data = await loadMergedFile(config.ticker, '1m');
    const candles = convertToResamplerFormat(data.candles);

    // Resample to target
    const resampled = config.targetInterval === '1m'
        ? candles
        : resampleCandles(candles, '1m', config.targetInterval);

    const firstCandle = resampled[0];
    const firstCandleTime = firstCandle
        ? (typeof firstCandle.time === 'number' ? firstCandle.time : new Date(firstCandle.time).getTime())
        : Date.now();
    const historicalDays = Math.floor((Date.now() - firstCandleTime) / (1000 * 60 * 60 * 24));

    console.log(`[HybridStitcher] ✅ Resampled: ${resampled.length} candles, ${historicalDays} days`);

    return {
        candles: resampled,
        metadata: {
            historySource: 'resampled',
            historicalDays,
            tailCandles: 0,
            headCandles: resampled.length
        }
    };
}

/**
 * Main entry point: Load data with smart hybrid/resample decision
 * 
 * Decision Logic (IDX-Optimized):
 * - Intervals < 30 minutes: Use pure 1m resampling (fast, 30 days sufficient)
 * - Intervals ≥ 30 minutes: Use hybrid stitching (60m tail + 1m head for 2-year history)
 * 
 * Rationale: IDX has short trading hours (330 min/day), so 30-day 1m data
 * is insufficient for intervals ≥30m to support long-term indicators (MA200)
 */
export async function loadHybridData(config: StitchConfig): Promise<StitchedData> {
    console.log(`[HybridStitcher] 🎯 Loading ${config.ticker} at ${config.targetInterval}`);

    try {
        // 🛡️ GUARD 1: Validate input config
        if (!config || !config.ticker || !config.targetInterval) {
            throw new Error('Invalid config: ticker and targetInterval are required');
        }

        if (needsHybridStitching(config.targetInterval)) {
            return await stitchLongAndShort(config);
        } else {
            return await loadPureResampled(config);
        }
    } catch (error) {
        // 🔥 FIX: Proper error logging (not empty {})
        const errorMsg = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;

        console.error(`[HybridStitcher] ❌ Error:`, errorMsg);
        if (errorStack) {
            console.error(`[HybridStitcher] Stack:`, errorStack);
        }

        throw error; // Re-throw for caller to handle
    }
}

/**
 * Pre-warm cache by loading both 1m and 60m files
 * Call during app initialization for instant interval switching
 */
export async function prewarmHybridCache(ticker: string): Promise<{
    shortData: MergedFileData;
    longData: MergedFileData;
}> {
    console.log(`[HybridStitcher] 🔥 Pre-warming cache for ${ticker}`);

    const [shortData, longData] = await Promise.all([
        loadMergedFile(ticker, '1m'),
        loadMergedFile(ticker, '60m')
    ]);

    console.log(`[HybridStitcher] ✅ Cache warmed: ${shortData.candles.length} (1m) + ${longData.candles.length} (60m)`);

    return { shortData, longData };
}
