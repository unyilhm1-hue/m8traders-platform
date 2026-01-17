import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

// 🔥 FIX: In-memory cache with LRU eviction
type CacheEntry = { data: ParsedCandle[]; timestamp: number };
const dataCache = new Map<string, CacheEntry>();
const MAX_CACHE_SIZE = 10;
const CACHE_TTL_MS = 60_000; // 1 minute TTL

// ============================================================================
// 🆕 Phase 2: Multi-Timeframe Aggregation Functions
// ============================================================================

type ParsedCandle = {
    t: number; // timestamp in ms
    o: number; // open
    h: number; // high
    l: number; // low
    c: number; // close
    v: number; // volume
};

/**
 * 🆕 Detect actual data interval from timestamps
 * 🔥 FIX: Use MEDIAN instead of average for robustness against gaps
 * Returns interval in minutes
 */
function detectDataInterval(candles: ParsedCandle[]): number {
    if (candles.length < 10) return 60; // Default 1h

    // Sample larger set for better accuracy
    const diffs: number[] = [];
    for (let i = 1; i < Math.min(50, candles.length); i++) {
        const diff = (candles[i].t - candles[i - 1].t) / 60_000; // Convert to minutes
        // Ignore overnight gaps (> 1 day)
        if (diff < 1440) {
            diffs.push(diff);
        }
    }

    if (diffs.length === 0) return 60;

    // Calculate MEDIAN (robust to outliers)
    diffs.sort((a, b) => a - b);
    const median = diffs[Math.floor(diffs.length / 2)];
    const intervalMinutes = Math.round(median);

    console.log(`[Aggregation] Detected interval: ${intervalMinutes}m (median of ${diffs.length} diffs, range: ${Math.min(...diffs).toFixed(0)}-${Math.max(...diffs).toFixed(0)}m)`);

    return intervalMinutes;
}

/**
 * 🆕 Create aggregated candle from bucket
 * 🔥 FIX E: Sort bucket before aggregating to ensure chronologically correct close
 * 🔥 FIX: Add partial flag for incomplete buckets
 */
function createAggregatedCandle(
    bucket: ParsedCandle[],
    startTime: number,
    isPartial: boolean = false
): ParsedCandle & { partial?: boolean } {
    // 🔥 FIX E: Sort bucket by timestamp to ensure OHLC chronological correctness
    // Prevents "close" being from middle of bucket if data is unordered
    const sortedBucket = [...bucket].sort((a, b) => a.t - b.t);

    // Validate bucket has no major gaps
    if (sortedBucket.length > 1) {
        const firstTime = sortedBucket[0].t;
        const lastTime = sortedBucket[sortedBucket.length - 1].t;
        const span = lastTime - firstTime;
        const avgInterval = sortedBucket.length > 1 ? span / (sortedBucket.length - 1) : 0;

        // Warn if bucket span is suspiciously large (possible gap)
        if (avgInterval > 60 * 60 * 1000) { // > 1 hour between candles
            console.warn(`[Aggregation] ⚠️ Large gap in bucket: span=${(span / 60000).toFixed(0)}m, count=${sortedBucket.length}`);
        }
    }

    const result: ParsedCandle & { partial?: boolean } = {
        t: startTime,
        o: sortedBucket[0].o,                             // FIRST open (chronological)
        h: Math.max(...sortedBucket.map(c => c.h)),       // Max high
        l: Math.min(...sortedBucket.map(c => c.l)),       // Min low
        c: sortedBucket[sortedBucket.length - 1].c,       // LAST close (chronological)
        v: sortedBucket.reduce((sum, c) => sum + c.v, 0)  // Sum volume
    };

    // 🔥 FIX: Add partial metadata
    if (isPartial) {
        result.partial = true;
    }

    return result;
}

/**
 * 🆕 Aggregate candles - timestamp-based bucketing
 * Handles missing candles and gaps correctly
 */
function aggregateCandles(
    candles: ParsedCandle[],
    targetIntervalMinutes: number
): ParsedCandle[] {
    if (targetIntervalMinutes === 1) return candles;

    // 🆕 FIX: Skip if data already at target interval or higher
    const dataInterval = detectDataInterval(candles);
    if (dataInterval >= targetIntervalMinutes) {
        console.log(`[Aggregation] ✅ Data already ${dataInterval}m, skipping aggregation`);
        return candles;
    }

    console.log(`[Aggregation] 🔄 Aggregating ${dataInterval}m → ${targetIntervalMinutes}m`);

    const aggregated: ParsedCandle[] = [];
    const targetIntervalSec = targetIntervalMinutes * 60;
    const targetIntervalMs = targetIntervalMinutes * 60000;

    // 🆕 FIX: Bucket by timestamp alignment (floor to interval boundary)
    let bucket: ParsedCandle[] = [];
    let bucketStartTime: number | null = null;

    // Calculate expected candles per bucket for partial detection
    const expectedCount = targetIntervalMinutes / dataInterval;

    candles.forEach((candle, idx) => {
        // Calculate which bucket this candle belongs to
        const candleBucket = Math.floor(candle.t / targetIntervalMs) * targetIntervalMs;

        // First candle or new bucket
        if (bucketStartTime === null) {
            bucketStartTime = candleBucket;
        }

        // New bucket detected
        if (candleBucket !== bucketStartTime && bucket.length > 0) {
            aggregated.push(createAggregatedCandle(bucket, bucketStartTime));
            bucket = [];
            bucketStartTime = candleBucket;
        }

        bucket.push(candle);

        // 🔥 FIX: Last candle - mark as partial if incomplete
        if (idx === candles.length - 1 && bucket.length > 0) {
            const isLastBucket = true;
            const isPartial = isLastBucket && (bucket.length < expectedCount * 0.9); // 90% threshold

            if (isPartial) {
                console.log(`[Aggregation] 🏷️ Marking last bucket as partial (${bucket.length}/${expectedCount.toFixed(0)} candles)`);
            }

            aggregated.push(createAggregatedCandle(bucket, bucketStartTime!, isPartial));
        }
    });

    console.log(`[Aggregation] ✅ Aggregated: ${candles.length} → ${aggregated.length} candles`);

    return aggregated;
}

// ============================================================================
// API Handler
// ============================================================================

export async function GET(request: Request) {
    try {
        // 🔥 FIX: Cache key based on ticker + interval
        const { searchParams } = new URL(request.url);
        const requestedTicker = searchParams.get('ticker') || 'ASII';
        const requestedInterval = searchParams.get('interval') || '1m';
        const requestedDate = searchParams.get('date');

        const cacheKey = `${requestedTicker}_${requestedInterval}_${requestedDate || 'any'}`;

        // 🔥 FIX: Check cache first
        const cached = dataCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
            console.log(`[API] ✅ Cache HIT for ${cacheKey}`);
            return NextResponse.json({
                success: true,
                data: {
                    ticker: requestedTicker,
                    candles: cached.data,
                    metadata: {
                        cached: true,
                        cacheAge: Math.floor((Date.now() - cached.timestamp) / 1000)
                    }
                }
            });
        }

        console.log(`[API] 🔍 Cache MISS for ${cacheKey}, loading from disk...`);

        const dataDir = path.join(process.cwd(), 'public', 'simulation-data');

        if (!fs.existsSync(dataDir)) {
            return NextResponse.json({ error: 'Dir not found' }, { status: 404 });
        }

        const files = fs.readdirSync(dataDir).filter((file) => file.endsWith('.json'));
        if (files.length === 0) {
            return NextResponse.json({ error: 'No files' }, { status: 404 });
        }

        // Clean ticker (remove .JK suffix)
        const cleanTicker = requestedTicker.replace('.JK', '').replace('.', '_');

        console.log(`[API/Start] 🔍 Looking for: ${cleanTicker}, interval: ${requestedInterval}, date: ${requestedDate || 'any'}`);

        // Filter files based on ALL params: ticker, interval, and optionally date
        const matchedFiles = files.filter(f => {
            // Special case: Legacy full month file (always ASII 1m)
            if (f === 'ASII_full_30days.json') {
                return cleanTicker === 'ASII' && requestedInterval === '1m' && !requestedDate;
            }

            // Pattern 1: TICKER_INTERVAL_DATE.json (new format)
            const newMatch = f.match(/^([A-Z_.]+)_(\d+[md])_(\d{4}-\d{2}-\d{2})\.json$/);
            if (newMatch) {
                const [, fTicker, fInterval, fDate] = newMatch;
                const tickerMatch = fTicker === cleanTicker;
                const intervalMatch = fInterval === requestedInterval;
                const dateMatch = !requestedDate || fDate === requestedDate;
                return tickerMatch && intervalMatch && dateMatch;
            }

            return false;
        });

        // Select file: deterministic (first match) instead of random
        let selectedFile: string;

        if (matchedFiles.length > 0) {
            // Perfect match found! Take first (deterministic)
            selectedFile = matchedFiles[0];
            console.log(`[API/Start] ✅ Found ${matchedFiles.length} match(es), selected: ${selectedFile}`);
        } else {
            // No exact match - fallback to interval-only match
            console.warn(`[API/Start] ⚠️ No match for ${cleanTicker}_${requestedInterval}${requestedDate ? `_${requestedDate}` : ''}`);
            const intervalFiles = files.filter(f => f.includes(`_${requestedInterval}_`));
            selectedFile = intervalFiles.length > 0 ? intervalFiles[0] : files[0];
            console.warn(`[API/Start] 📁 Fallback to: ${selectedFile}`);
        }


        const filePath = path.join(dataDir, selectedFile);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const rawData = JSON.parse(fileContent);

        // Ambil ticker dari nama file
        const ticker = selectedFile.split('_')[0] || 'UNKNOWN';

        // ✅ Extract date from filename (for HH:MM-only format support)
        // Supports BOTH patterns:
        //   - "TICKER_YYYY-MM-DD.json" (legacy) → date at index 1
        //   - "TICKER_INTERVAL_YYYY-MM-DD.json" (new) → date at index 2
        const filenameParts = selectedFile.replace('.json', '').split('_');
        let dateFromFilename: string | null = null;

        // Check each part for date pattern YYYY-MM-DD
        for (const part of filenameParts) {
            if (part.match(/^\d{4}-\d{2}-\d{2}$/)) {
                dateFromFilename = part;
                break;
            }
        }

        console.log(`[API/Start] 📅 Extracted date from filename: ${dateFromFilename || 'NONE'}`);


        // --- DATA PROCESSING WITH FORMAT DETECTION ---
        // ✅ Calculate interval multiplier for timestamp adjustment
        const intervalMultipliers: Record<string, number> = {
            '1m': 1,    // 60s
            '2m': 2,    // 120s
            '5m': 5,    // 300s
            '15m': 15,  // 900s
            '30m': 30,  // 1800s
            '60m': 60,  // 3600s
        };
        const baseIntervalMs = 60000; // 1 minute in ms
        const multiplier = intervalMultipliers[requestedInterval] || 1;
        const expectedIntervalMs = baseIntervalMs * multiplier;

        console.log(`[API/Start] Requested interval: ${requestedInterval} (${expectedIntervalMs}ms)`);

        /**
         * Deduplicate candles while maintaining interval grid alignment
         * 🔥 FIX #13: Snap to interval grid instead of +1ms
         */
        function deduplicateCandles(candles: any[], intervalMinutes: number): any[] {
            const intervalMs = intervalMinutes * 60 * 1000;
            const seen = new Set<number>();

            return candles.filter(candle => {
                // Use the 't' property for timestamp if it's already processed,
                // otherwise, assume 'time' property and parse it.
                const timestamp = candle.t || new Date(candle.time).getTime();

                // Snap to interval grid (e.g., 1m = :00, :01, :02...)
                const snappedTime = Math.floor(timestamp / intervalMs) * intervalMs;

                if (seen.has(snappedTime)) {
                    // Duplicate on same grid point - skip it
                    return false;
                }

                seen.add(snappedTime);
                return true;
            });
        }
        // ✅ FIX 1: Detect if data already has correct interval spacing
        // This prevents double-adjustment when time-only data is already properly spaced
        const detectInterval = (candles: any[], expectedMs: number, dateStr: string): boolean => {
            if (candles.length < 3) return false;

            const timestamps: number[] = [];

            // Sample first 5 candles (more reliable than 3)
            for (let i = 0; i < Math.min(5, candles.length); i++) {
                const timeStr = candles[i].time;

                // Only check time-only format (HH:MM or HH:MM:SS)
                if (!timeStr.match(/^\d{2}:\d{2}(:\d{2})?$/)) continue;

                const timePart = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
                const ts = new Date(`${dateStr}T${timePart}Z`).getTime();

                if (!isNaN(ts)) timestamps.push(ts);
            }

            if (timestamps.length < 2) return false;

            // Check intervals between consecutive candles
            const intervals = [];
            for (let i = 1; i < timestamps.length; i++) {
                intervals.push(timestamps[i] - timestamps[i - 1]);
            }

            // All intervals should match expected interval (within 1s tolerance)
            const allMatch = intervals.every(interval =>
                Math.abs(interval - expectedMs) < 1000
            );

            console.log(`[API/Start] Interval detection: ${allMatch ? '✅ Already spaced' : '❌ Needs multiplier'} (intervals: ${intervals.join(', ')}ms, expected: ${expectedMs}ms)`);

            return allMatch;
        };

        // Detect interval once before processing
        const isAlreadySpaced = detectInterval(rawData, expectedIntervalMs, dateFromFilename || '');

        const candlesWithTimestamp = rawData.map((candle: any, index: number) => {
            let timestamp: number;

            // ✅ Try to detect format and parse accordingly
            if (candle.time.includes(' ') || candle.time.includes('T')) {
                // Format 1: Full datetime "2025-12-18 02:00:00" or "2025-12-18T02:00:00"
                const timeString = candle.time.replace(' ', 'T') + (candle.time.includes('Z') ? '' : 'Z');
                timestamp = new Date(timeString).getTime();
            } else if (candle.time.match(/^\d{2}:\d{2}(:\d{2})?$/)) {
                // Format 2: Time-only "09:00" or "09:00:00"
                if (dateFromFilename) {
                    // Combine filename date with candle time
                    const timePart = candle.time.length === 5 ? `${candle.time}:00` : candle.time;
                    const fullDatetime = `${dateFromFilename}T${timePart}Z`;
                    timestamp = new Date(fullDatetime).getTime();

                    // ✅ FIX 1: ONLY apply multiplier if data does NOT already have correct spacing
                    // This prevents double-adjustment when data is already at correct interval
                    if (!isAlreadySpaced) {
                        // Data needs scaling (e.g., 1m data loaded as 5m)
                        timestamp = timestamp + (index * baseIntervalMs * (multiplier - 1));
                        if (index < 3) {
                            console.log(`[API/Start] Applied multiplier to index ${index}: +${index * baseIntervalMs * (multiplier - 1)}ms`);
                        }
                    }
                } else {
                    // No date in filename - cannot parse reliably
                    console.warn(`[API] Time-only format "${candle.time}" but no date in filename "${selectedFile}"`);
                    timestamp = NaN;
                }
            } else {
                // Unknown format
                console.warn(`[API] Unknown time format: "${candle.time}"`);
                timestamp = NaN;
            }

            // ✅ FIX 3: Strict validation - NO FALLBACK!
            if (isNaN(timestamp)) {
                console.error(`[API] ❌ SKIP candle ${index}: invalid timestamp "${candle.time}"`);
                return null; // Return null instead of fallback
            }

            // ✅ DATA SANITIZATION: Swap high/low if invalid
            let high = candle.high;
            let low = candle.low;
            if (high < low) {
                console.warn(`[API] ⚠️ Candle ${index}: high (${high}) < low (${low}), swapping values`);
                [high, low] = [low, high];
            }

            return {
                t: timestamp,
                o: candle.open,
                h: high,
                l: low,
                c: candle.close,
                v: candle.volume,
            };
        });

        // ✅ FIX 3: Filter out failed parses (null values)
        type CandleData = { t: number; o: number; h: number; l: number; c: number; v: number } | null;
        const validCandles = (candlesWithTimestamp as CandleData[]).filter((c): c is NonNullable<CandleData> => c !== null);

        const rejectedCount = rawData.length - validCandles.length;
        if (rejectedCount > 0) {
            console.warn(`[API/Start] ⚠️ Rejected ${rejectedCount}/${rawData.length} candles (${((rejectedCount / rawData.length) * 100).toFixed(1)}%) due to invalid timestamps`);
        }

        // Ensure monotonic timestamps
        validCandles.sort((a: any, b: any) => a.t - b.t);

        // ✅ FIX 3: Detect and fix duplicate timestamps
        const duplicates = validCandles.filter((c: any, i: number, arr: any[]) =>
            i > 0 && c.t === arr[i - 1].t
        );

        if (duplicates.length > 0) {
            console.warn(`[API/Start] ⚠️ Found ${duplicates.length} duplicate timestamps, de-duplicating...`);

            // De-duplicate by adding 1ms offset
            validCandles.forEach((c: any, i: number) => {
                if (i > 0 && c.t === validCandles[i - 1].t) {
                    c.t += 1; // Add 1ms to make unique
                }
            });
        }

        // 🆕 PHASE 2: Apply multi-timeframe aggregation if needed
        const requestedMinutes = requestedInterval === '5m' ? 5
            : requestedInterval === '15m' ? 15
                : requestedInterval === '30m' ? 30
                    : requestedInterval === '60m' || requestedInterval === '1h' ? 60
                        : 1;

        let processedCandles = validCandles;
        let aggregationInfo = 'none';

        if (requestedMinutes > 1) {
            const before = processedCandles.length;
            processedCandles = aggregateCandles(processedCandles as ParsedCandle[], requestedMinutes);
            const after = processedCandles.length;

            aggregationInfo = before === after
                ? 'skipped (already aggregated)'
                : `${before} → ${after} candles`;

            console.log(`[API/Start] 📊 Aggregation ${requestedInterval}: ${aggregationInfo}`);
        }

        return NextResponse.json({
            success: true,
            data: {
                ticker,
                candles: processedCandles,
                metadata: {
                    total: rawData.length,
                    valid: validCandles.length,
                    rejected: rejectedCount,
                    duplicatesFixed: duplicates.length,
                    interval: requestedInterval,
                    intervalDetected: isAlreadySpaced ? 'pre-spaced' : 'scaled',
                    aggregation: aggregationInfo // 🆕 Add aggregation info
                }
            },
        });

        // 🔥 FIX: Cache result before return (with LRU eviction)
        if (dataCache.size >= MAX_CACHE_SIZE) {
            // Find oldest entry and remove it
            const oldest = Array.from(dataCache.entries())
                .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
            dataCache.delete(oldest[0]);
            console.log(`[API] 🗑️ Cache evicted: ${oldest[0]}`);
        }

        dataCache.set(cacheKey, {
            data: processedCandles as ParsedCandle[],
            timestamp: Date.now()
        });
        console.log(`[API] 💾 Cached: ${cacheKey} (${dataCache.size}/${MAX_CACHE_SIZE})`);

    } catch (error) {
        console.error('[API] Error:', error);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}
