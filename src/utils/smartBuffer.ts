/**
 * Smart Buffering System
 * ======================
 * Manages historical data buffering and client-side caching for indicator accuracy.
 * 
 * Features:
 * - Historical buffer loading (200-500 candles before start date)
 * - Client-side RAM cache (prevents redundant API calls)
 * - Cache freshness detection & auto-invalidation
 * - Efficient data loading strategy
 * 
 * @module smartBuffer
 */

import type { Candle, Interval } from './candleResampler';

export interface BufferConfig {
    ticker: string;
    startDate: Date;
    baseInterval: Interval;
    bufferSize?: number;  // Default: 200 candles
}

export interface CachedData {
    ticker: string;
    baseInterval: Interval;
    buffer: Candle[];      // Historical data (for indicators)
    active: Candle[];      // Future data (for simulation)
    timestamp: number;     // Cache creation time
    totalCandles: number;
}

// In-memory cache (RAM)
const dataCache = new Map<string, CachedData>();

// Cache TTL: 1 hour
const CACHE_TTL = 60 * 60 * 1000;

// Default buffer size: 200 candles for indicator warmup
const DEFAULT_BUFFER_SIZE = 200;

/**
 * Generate cache key
 */
function getCacheKey(ticker: string, interval: Interval): string {
    return `${ticker}_${interval}`;
}

/**
 * Check if cached data is still fresh
 */
function isCacheFresh(cachedData: CachedData): boolean {
    const age = Date.now() - cachedData.timestamp;
    return age < CACHE_TTL;
}

/**
 * Get cached data if available and fresh
 */
export function getCached(ticker: string, interval: Interval): CachedData | null {
    const key = getCacheKey(ticker, interval);
    const cached = dataCache.get(key);

    if (!cached) return null;

    if (!isCacheFresh(cached)) {
        dataCache.delete(key);
        return null;
    }

    return cached;
}

/**
 * Store data in cache
 */
function setCached(data: CachedData): void {
    const key = getCacheKey(data.ticker, data.baseInterval);
    dataCache.set(key, data);
}

/**
 * Invalidate cache for specific ticker/interval
 */
export function invalidateCache(ticker?: string, interval?: Interval): void {
    if (!ticker && !interval) {
        // Clear all cache
        dataCache.clear();
        return;
    }

    if (ticker && interval) {
        // Clear specific cache
        const key = getCacheKey(ticker, interval);
        dataCache.delete(key);
        return;
    }

    // Clear all cache for ticker or interval
    const keysToDelete: string[] = [];
    dataCache.forEach((_, key) => {
        if (ticker && key.startsWith(ticker)) {
            keysToDelete.push(key);
        }
        if (interval && key.endsWith(interval)) {
            keysToDelete.push(key);
        }
    });
    keysToDelete.forEach(key => dataCache.delete(key));
}

/**
 * Split candles into buffer (historical) and active (future) based on start date
 */
function splitByDate(
    candles: Candle[],
    startDate: Date,
    bufferSize: number
): { buffer: Candle[]; active: Candle[] } {
    const startTimestamp = startDate.getTime();

    // Find index where active data starts
    const activeStartIndex = candles.findIndex(candle => {
        const candleTime = typeof candle.time === 'number'
            ? candle.time
            : new Date(candle.time).getTime();
        return candleTime >= startTimestamp;
    });

    if (activeStartIndex === -1) {
        // All data is before start date - use last N as buffer, no active
        return {
            buffer: candles.slice(-bufferSize),
            active: []
        };
    }

    // Get buffer: N candles before start date
    const bufferStartIndex = Math.max(0, activeStartIndex - bufferSize);
    const buffer = candles.slice(bufferStartIndex, activeStartIndex);

    // Get active: from start date onwards
    const active = candles.slice(activeStartIndex);

    return { buffer, active };
}

/**
 * Load data with smart buffering
 * Returns cached data if available, otherwise fetches from API
 */
export async function loadWithBuffer(config: BufferConfig): Promise<CachedData> {
    const { ticker, startDate, baseInterval, bufferSize = DEFAULT_BUFFER_SIZE } = config;

    // Check cache first
    const cached = getCached(ticker, baseInterval);
    if (cached) {
        console.log(`✅ Cache hit: ${ticker} ${baseInterval}`);
        return cached;
    }

    console.log(`📥 Loading data: ${ticker} ${baseInterval} (buffer: ${bufferSize})`);

    // Fetch data from API (use consolidated files)
    const response = await fetch(`/simulation-data/${ticker}_${baseInterval}_*.json`);

    if (!response.ok) {
        throw new Error(`Failed to load data for ${ticker} ${baseInterval}`);
    }

    const data = await response.json();
    const allCandles: Candle[] = Array.isArray(data) ? data : data.candles || [];

    // Split into buffer and active
    const { buffer, active } = splitByDate(allCandles, startDate, bufferSize);

    // Create cached data
    const cachedData: CachedData = {
        ticker,
        baseInterval,
        buffer,
        active,
        timestamp: Date.now(),
        totalCandles: allCandles.length
    };

    // Store in cache
    setCached(cachedData);

    console.log(`✅ Loaded: ${buffer.length} buffer + ${active.length} active candles`);

    return cachedData;
}

/**
 * Get cache statistics for debugging
 */
export function getCacheStats() {
    return {
        size: dataCache.size,
        entries: Array.from(dataCache.keys()),
        totalCandles: Array.from(dataCache.values()).reduce(
            (sum, data) => sum + data.totalCandles,
            0
        )
    };
}

/**
 * Preload data for multiple intervals (optimization)
 */
export async function preloadIntervals(
    ticker: string,
    startDate: Date,
    intervals: Interval[],
    bufferSize = DEFAULT_BUFFER_SIZE
): Promise<void> {
    const promises = intervals.map(interval =>
        loadWithBuffer({ ticker, startDate, baseInterval: interval, bufferSize })
    );

    await Promise.all(promises);
    console.log(`✅ Preloaded ${intervals.length} intervals for ${ticker}`);
}
