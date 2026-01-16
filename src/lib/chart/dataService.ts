/**
 * Data Service - Hybrid approach for stock data loading
 * Supports file-based cache with future API integration capability
 */
import type { Candle, Timeframe, StockDataResponse } from '@/types';
import { getSampleTickerData } from './sampleData';
import { generateIDX2025Data, isIDXTicker } from './idx2025DataGenerator';

interface CacheEntry {
    data: Candle[];
    timestamp: number;
    timeframe: Timeframe;
}

// In-memory cache
const dataCache = new Map<string, CacheEntry>();

// Cache expiration time (15 minutes)
const CACHE_TTL = 15 * 60 * 1000;

// 🚀 PERFORMANCE FIX: In-flight request deduplication
// Prevents multiple simultaneous requests for the same data
const inflightRequests = new Map<string, Promise<Candle[]>>();

/**
 * Generate cache key
 */
function getCacheKey(ticker: string, timeframe: Timeframe): string {
    return `${ticker}_${timeframe}`;
}

/**
 * Check if cache entry is valid
 */
function isCacheValid(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp < CACHE_TTL;
}

/**
 * Get cached data if available and valid
 */
export function getCachedData(ticker: string, timeframe: Timeframe): Candle[] | null {
    const key = getCacheKey(ticker, timeframe);
    const entry = dataCache.get(key);

    if (entry && isCacheValid(entry)) {
        return entry.data;
    }

    return null;
}

/**
 * Update cache with new data
 */
export function updateCache(ticker: string, timeframe: Timeframe, data: Candle[]): void {
    const key = getCacheKey(ticker, timeframe);
    dataCache.set(key, {
        data,
        timestamp: Date.now(),
        timeframe,
    });
}

/**
 * Clear cache for specific ticker or all
 */
export function clearCache(ticker?: string): void {
    if (ticker) {
        // Clear all timeframes for this ticker
        const keysToDelete: string[] = [];
        dataCache.forEach((_, key) => {
            if (key.startsWith(`${ticker}_`)) {
                keysToDelete.push(key);
            }
        });
        keysToDelete.forEach((key) => dataCache.delete(key));
    } else {
        // Clear all cache
        dataCache.clear();
    }
}

/**
 * Fetch data from API endpoint (future implementation)
 */
async function fetchFromAPI(
    ticker: string,
    timeframe: Timeframe
): Promise<StockDataResponse | null> {
    try {
        // Adjust limit based on timeframe to prevent chart crowding
        // For 1m: need enough data to span 2 trading days for "day 2" start
        const limits: Record<Timeframe, number> = {
            '1m': 600,   // ~10 hours - ensures 2 trading days (IDX: 09:00-16:00 = 7h/day)
            '5m': 200,   // ~16 hours - can span 2+ days
            '15m': 150,  // ~1.5 days
            '30m': 150,  // ~3 days
            '1h': 200,   // ~1 week
            '4h': 200,   // ~1 month
            '1d': 200,   // ~200 days
            '1w': 200,   // ~4 years
        };

        const limit = limits[timeframe] || 100;
        const response = await fetch(`/api/stocks/${ticker}?timeframe=${timeframe}&limit=${limit}`);

        if (!response.ok) {
            console.warn(`API fetch failed: ${response.status}`);
            return null;
        }

        const data: StockDataResponse = await response.json();
        return data;
    } catch (error) {
        console.warn('API fetch error:', error);
        return null;
    }
}

/**
 * Generate sample data with timeframe adjustment
 * This simulates different timeframe data from the base sample
 */
function generateTimeframeData(ticker: string, timeframe: Timeframe): Candle[] {
    const baseData = getSampleTickerData(ticker);

    // Timeframe multipliers (how many base candles to combine)
    const multipliers: Record<Timeframe, number> = {
        '1m': 1,
        '5m': 5,
        '15m': 15,
        '30m': 30,
        '1h': 60,
        '4h': 240,
        '1d': 1440,
        '1w': 10080,
    };

    const multiplier = multipliers[timeframe] || 1;

    if (multiplier === 1) {
        return baseData;
    }

    // Combine candles for higher timeframes
    const combined: Candle[] = [];
    for (let i = 0; i < baseData.length; i += multiplier) {
        const slice = baseData.slice(i, i + multiplier);
        if (slice.length === 0) break;

        const combinedCandle: Candle = {
            t: slice[0].t,
            o: slice[0].o,
            h: Math.max(...slice.map((c) => c.h)),
            l: Math.min(...slice.map((c) => c.l)),
            c: slice[slice.length - 1].c,
            v: slice.reduce((sum, c) => sum + c.v, 0),
        };

        combined.push(combinedCandle);
    }

    return combined;
}

/**
 * Main data fetching function
 * Uses hybrid approach: cache → API → IDX 2025 → sample data fallback
 */
export async function fetchStockData(
    ticker: string,
    timeframe: Timeframe = '5m'
): Promise<Candle[]> {
    const key = getCacheKey(ticker, timeframe);

    // 1. Check cache first
    const cached = getCachedData(ticker, timeframe);
    if (cached) {
        console.log(`[DataService] Using cached data for ${ticker} ${timeframe}`);
        return cached;
    }

    // 🚀 PERFORMANCE FIX: Check if request is already in-flight
    const existing = inflightRequests.get(key);
    if (existing) {
        console.log(`[DataService] Deduping in-flight request for ${ticker} ${timeframe}`);
        return existing;
    }

    // Create new request promise
    const requestPromise = (async () => {
        try {
            // 2. Try API (will be null until API route is implemented)
            const apiData = await fetchFromAPI(ticker, timeframe);
            if (apiData && apiData.data.length > 0) {
                console.log(`[DataService] Fetched from API: ${ticker} ${timeframe}`);
                updateCache(ticker, timeframe, apiData.data);
                return apiData.data;
            }

            // 3. IDX 2025 Generated Data (if IDX ticker) - NEW
            if (isIDXTicker(ticker)) {
                console.log(`[DataService] Generating IDX 2025 data: ${ticker} ${timeframe}`);
                const idx2025 = generateIDX2025Data(ticker, timeframe);
                updateCache(ticker, timeframe, idx2025);
                return idx2025;
            }

            // 4. Fallback to generated sample data (for US tickers)
            console.log(`[DataService] Using generated sample data for ${ticker} ${timeframe}`);
            const sampleData = generateTimeframeData(ticker, timeframe);
            updateCache(ticker, timeframe, sampleData);
            return sampleData;
        } finally {
            // Clean up in-flight map
            inflightRequests.delete(key);
        }
    })();

    // Store in-flight request
    inflightRequests.set(key, requestPromise);

    return requestPromise;
}

/**
 * Prefetch data for multiple timeframes (performance optimization)
 */
export async function prefetchTimeframes(ticker: string, timeframes: Timeframe[]): Promise<void> {
    const promises = timeframes.map((tf) => fetchStockData(ticker, tf));
    await Promise.all(promises);
}

/**
 * Get data statistics
 */
export function getDataStats(data: Candle[]): {
    count: number;
    firstTimestamp: number;
    lastTimestamp: number;
    priceRange: { min: number; max: number };
} {
    if (data.length === 0) {
        return {
            count: 0,
            firstTimestamp: 0,
            lastTimestamp: 0,
            priceRange: { min: 0, max: 0 },
        };
    }

    return {
        count: data.length,
        firstTimestamp: data[0].t,
        lastTimestamp: data[data.length - 1].t,
        priceRange: {
            min: Math.min(...data.map((c) => c.l)),
            max: Math.max(...data.map((c) => c.h)),
        },
    };
}
