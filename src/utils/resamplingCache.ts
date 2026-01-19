/**
 * LRU Resampling Cache
 * 
 * Caches resampling results to avoid redundant computation when switching intervals.
 * Uses LRU eviction policy with configurable max size per ticker.
 * 
 * Key Format: `${ticker}_${fromInterval}_${toInterval}_${dataHash}`
 * 
 * Example:
 * - BBRI_1m_5m_abc123 → Cached 5m data from 1m source
 * - BBRI_1m_1h_abc123 → Cached 1h data from 1m source
 */

import type { ResampledCandle } from './candleResampler';
import type { Interval } from './candleResampler';

interface CacheEntry {
    data: ResampledCandle[];
    timestamp: number;
    hits: number;
}

interface CacheStats {
    hits: number;
    misses: number;
    evictions: number;
    size: number;
}

class ResamplingCache {
    private cache = new Map<string, CacheEntry>();
    private stats: CacheStats = {
        hits: 0,
        misses: 0,
        evictions: 0,
        size: 0
    };

    // Max entries per ticker (total cache size = MAX_PER_TICKER * number of tickers)
    private readonly MAX_PER_TICKER = 5;

    /**
     * Generate cache key from parameters
     */
    private generateKey(
        ticker: string,
        fromInterval: Interval,
        toInterval: Interval,
        dataHash: string
    ): string {
        return `${ticker}_${fromInterval}_${toInterval}_${dataHash}`;
    }

    /**
     * Generate a simple hash from data for cache key
     * Uses first/last candle timestamps + data length
     */
    generateDataHash(data: ResampledCandle[]): string {
        if (data.length === 0) return 'empty';

        const first = data[0].time;
        const last = data[data.length - 1].time;
        const len = data.length;

        return `${first}_${last}_${len}`;
    }

    /**
     * Get cached resampling result
     */
    get(
        ticker: string,
        fromInterval: Interval,
        toInterval: Interval,
        dataHash: string
    ): ResampledCandle[] | null {
        const key = this.generateKey(ticker, fromInterval, toInterval, dataHash);
        const entry = this.cache.get(key);

        if (entry) {
            entry.hits++;
            entry.timestamp = Date.now(); // Update LRU timestamp
            this.stats.hits++;
            return entry.data;
        }

        this.stats.misses++;
        return null;
    }

    /**
     * Store resampling result in cache (with timestamp normalization)
     */
    set(
        ticker: string,
        fromInterval: Interval,
        toInterval: Interval,
        dataHash: string,
        data: ResampledCandle[]
    ): void {
        const key = this.generateKey(ticker, fromInterval, toInterval, dataHash);

        // Evict LRU entries if ticker cache is full
        this.evictIfNeeded(ticker);

        // 🔥 CRITICAL: Normalize timestamps to primitive numbers
        // Prevents "[object Object]" errors in LWC
        const normalizedData = data.map(c => ({
            ...c,
            time: typeof c.time === 'number' ? c.time :
                typeof c.time === 'string' ? new Date(c.time).getTime() :
                    c.time instanceof Date ? c.time.getTime() :
                        c.time // Fallback (should not happen)
        }));

        this.cache.set(key, {
            data: normalizedData,
            timestamp: Date.now(),
            hits: 0
        });

        this.stats.size = this.cache.size;
    }

    /**
     * Evict least recently used entries for a ticker if limit exceeded
     */
    private evictIfNeeded(ticker: string): void {
        // Get all keys for this ticker
        const tickerKeys = Array.from(this.cache.keys()).filter(k => k.startsWith(`${ticker}_`));

        if (tickerKeys.length >= this.MAX_PER_TICKER) {
            // Sort by timestamp (oldest first)
            const sorted = tickerKeys
                .map(k => ({ key: k, entry: this.cache.get(k)! }))
                .sort((a, b) => a.entry.timestamp - b.entry.timestamp);

            // Remove oldest entry
            const toRemove = sorted[0];
            this.cache.delete(toRemove.key);
            this.stats.evictions++;
        }
    }

    /**
     * Clear all cache for a specific ticker (called on data update)
     */
    invalidateTicker(ticker: string): void {
        const tickerKeys = Array.from(this.cache.keys()).filter(k => k.startsWith(`${ticker}_`));
        tickerKeys.forEach(k => this.cache.delete(k));
        this.stats.size = this.cache.size;
    }

    /**
     * Clear entire cache
     */
    clear(): void {
        this.cache.clear();
        this.stats = {
            hits: 0,
            misses: 0,
            evictions: 0,
            size: 0
        };
    }

    /**
     * Get cache statistics
     */
    getStats(): CacheStats {
        return { ...this.stats };
    }

    /**
     * Get hit rate percentage
     */
    getHitRate(): number {
        const total = this.stats.hits + this.stats.misses;
        return total === 0 ? 0 : (this.stats.hits / total) * 100;
    }
}

// Singleton instance
export const resamplingCache = new ResamplingCache();

// Export for testing
export { ResamplingCache };
