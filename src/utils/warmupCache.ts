/**
 * Warm-Up Buffer Cache
 * Simple in-memory cache untuk menghindari 60-day file scan berulang
 * 
 * @see smartLoader.ts untuk consumer
 */

import type { Candle } from '@/utils/candleAggregation';
import type { IntervalType } from '@/types/intervals';

interface CacheEntry {
    candles: Candle[];
    timestamp: number;  // When cached
    ticker: string;
    interval: IntervalType;
}

interface CacheStats {
    hits: number;
    misses: number;
    evictions: number;
}

class WarmupBufferCache {
    private cache: Map<string, CacheEntry> = new Map();
    private readonly MAX_ENTRIES = 10;  // Cache up to 10 tickers
    private readonly MAX_AGE_MS = 5 * 60 * 1000;  // 5 minutes TTL
    private stats: CacheStats = { hits: 0, misses: 0, evictions: 0 };

    /**
     * Generate cache key from ticker + interval
     */
    private getCacheKey(ticker: string, interval: IntervalType): string {
        return `${ticker}:${interval}`;
    }

    /**
     * Get cached warm-up buffer
     * Returns null if cache miss or expired
     */
    get(ticker: string, interval: IntervalType): Candle[] | null {
        const key = this.getCacheKey(ticker, interval);
        const entry = this.cache.get(key);

        if (!entry) {
            this.stats.misses++;
            return null;
        }

        // Check if expired
        const age = Date.now() - entry.timestamp;
        if (age > this.MAX_AGE_MS) {
            console.log(`[WarmupCache] ⏰ Expired: ${key} (age: ${Math.floor(age / 1000)}s)`);
            this.cache.delete(key);
            this.stats.evictions++;
            this.stats.misses++;
            return null;
        }

        this.stats.hits++;
        console.log(`[WarmupCache] ✅ Hit: ${key} (${entry.candles.length} candles, age: ${Math.floor(age / 1000)}s)`);
        return entry.candles;
    }

    /**
     * Cache warm-up buffer
     * Implements LRU eviction if cache full
     */
    set(ticker: string, interval: IntervalType, candles: Candle[]): void {
        const key = this.getCacheKey(ticker, interval);

        // LRU eviction if cache full
        if (this.cache.size >= this.MAX_ENTRIES && !this.cache.has(key)) {
            // Find oldest entry
            let oldestKey: string | null = null;
            let oldestTime = Infinity;

            for (const [k, entry] of this.cache.entries()) {
                if (entry.timestamp < oldestTime) {
                    oldestTime = entry.timestamp;
                    oldestKey = k;
                }
            }

            if (oldestKey) {
                console.log(`[WarmupCache] 🗑️ Evicted (LRU): ${oldestKey}`);
                this.cache.delete(oldestKey);
                this.stats.evictions++;
            }
        }

        this.cache.set(key, {
            candles,
            timestamp: Date.now(),
            ticker,
            interval
        });

        console.log(`[WarmupCache] 💾 Cached: ${key} (${candles.length} candles)`);
    }

    /**
     * Clear cache for specific ticker or all
     */
    invalidate(ticker?: string): void {
        if (!ticker) {
            this.cache.clear();
            console.log('[WarmupCache] 🗑️ Cleared all cache');
            return;
        }

        // Remove all entries for this ticker
        const keysToDelete: string[] = [];
        for (const [key, entry] of this.cache.entries()) {
            if (entry.ticker === ticker) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(k => this.cache.delete(k));
        console.log(`[WarmupCache] 🗑️ Invalidated ${keysToDelete.length} entries for ${ticker}`);
    }

    /**
     * Get cache statistics
     */
    getStats(): CacheStats & { size: number; hitRate: number } {
        const total = this.stats.hits + this.stats.misses;
        const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;

        return {
            ...this.stats,
            size: this.cache.size,
            hitRate: Math.round(hitRate * 10) / 10  // Round to 1 decimal
        };
    }

    /**
     * Reset statistics
     */
    resetStats(): void {
        this.stats = { hits: 0, misses: 0, evictions: 0 };
        console.log('[WarmupCache] 📊 Stats reset');
    }
}

// Export singleton instance
export const warmupCache = new WarmupBufferCache();
