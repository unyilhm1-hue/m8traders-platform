/**
 * IndexedDB Storage Service
 * Handles batch data persistence for historical stock data
 */

import type { BatchRecord, BatchMetadata, StorageQuota } from '@/types/storage';
import type { Candle } from '@/types';

export const DB_NAME = 'm8traders-historical';
export const DB_VERSION = 1;

export const STORES = {
    BATCHES: 'batches',      // Raw batch data
    SCENARIOS: 'scenarios',   // Frozen scenarios (Phase 4)
    METADATA: 'metadata',     // Window metadata
} as const;

/**
 * Open IndexedDB connection
 */
export async function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            // Create batches store
            if (!db.objectStoreNames.contains(STORES.BATCHES)) {
                const batchStore = db.createObjectStore(STORES.BATCHES, { keyPath: 'id' });
                batchStore.createIndex('ticker', 'ticker', { unique: false });
                batchStore.createIndex('interval', 'interval', { unique: false });
                batchStore.createIndex('ticker_interval', ['ticker', 'interval'], { unique: false });
                batchStore.createIndex('downloadedAt', 'downloadedAt', { unique: false });
            }

            // Create scenarios store (for future use)
            if (!db.objectStoreNames.contains(STORES.SCENARIOS)) {
                db.createObjectStore(STORES.SCENARIOS, { keyPath: 'id' });
            }

            console.log('[IndexedDB] Database initialized successfully');
        };
    });
}

/**
 * Save batch to storage
 */
export async function saveBatch(batch: BatchRecord): Promise<void> {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORES.BATCHES, 'readwrite');
        const store = transaction.objectStore(STORES.BATCHES);
        const request = store.put(batch);

        request.onsuccess = () => {
            console.log(`[IndexedDB] Saved batch: ${batch.id} (${batch.candleCount} candles)`);
            resolve();
        };

        request.onerror = () => {
            reject(new Error(`Failed to save batch: ${request.error?.message}`));
        };

        transaction.oncomplete = () => {
            db.close();
        };
    });
}

/**
 * Get batch by ID
 */
export async function getBatch(id: string): Promise<BatchRecord | null> {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORES.BATCHES, 'readonly');
        const store = transaction.objectStore(STORES.BATCHES);
        const request = store.get(id);

        request.onsuccess = () => {
            resolve(request.result || null);
        };

        request.onerror = () => {
            reject(new Error(`Failed to get batch: ${request.error?.message}`));
        };

        transaction.oncomplete = () => {
            db.close();
        };
    });
}

/**
 * List batches for a specific ticker and interval
 */
export async function listBatches(
    ticker: string,
    interval?: '1m' | '5m' | '15m' | '1h'
): Promise<BatchMetadata[]> {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORES.BATCHES, 'readonly');
        const store = transaction.objectStore(STORES.BATCHES);

        let request: IDBRequest;
        if (interval) {
            const index = store.index('ticker_interval');
            request = index.getAll([ticker, interval]);
        } else {
            const index = store.index('ticker');
            request = index.getAll(ticker);
        }

        request.onsuccess = () => {
            const batches: BatchRecord[] = request.result || [];

            // Convert to metadata (exclude heavy data field)
            const metadata: BatchMetadata[] = batches.map((batch) => ({
                id: batch.id,
                ticker: batch.ticker,
                interval: batch.interval,
                windowId: batch.windowId,
                startTime: batch.startTime,
                endTime: batch.endTime,
                candleCount: batch.candleCount,
                downloadedAt: batch.downloadedAt,
                sizeBytes: estimateBatchSize(batch),
            }));

            resolve(metadata);
        };

        request.onerror = () => {
            reject(new Error(`Failed to list batches: ${request.error?.message}`));
        };

        transaction.oncomplete = () => {
            db.close();
        };
    });
}

/**
 * Delete batch by ID
 */
export async function deleteBatch(id: string): Promise<void> {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORES.BATCHES, 'readwrite');
        const store = transaction.objectStore(STORES.BATCHES);
        const request = store.delete(id);

        request.onsuccess = () => {
            console.log(`[IndexedDB] Deleted batch: ${id}`);
            resolve();
        };

        request.onerror = () => {
            reject(new Error(`Failed to delete batch: ${request.error?.message}`));
        };

        transaction.oncomplete = () => {
            db.close();
        };
    });
}

/**
 * Clear all batches for a ticker
 */
export async function clearTickerBatches(ticker: string): Promise<void> {
    const batches = await listBatches(ticker);
    await Promise.all(batches.map((b) => deleteBatch(b.id)));
    console.log(`[IndexedDB] Cleared ${batches.length} batches for ${ticker}`);
}

/**
 * Get storage quota information
 */
export async function getStorageQuota(): Promise<StorageQuota> {
    if (!navigator.storage || !navigator.storage.estimate) {
        // Fallback for unsupported browsers
        return {
            used: 0,
            available: 0,
            total: 0,
            percentage: 0,
        };
    }

    const estimate = await navigator.storage.estimate();
    const used = estimate.usage || 0;
    const total = estimate.quota || 0;
    const available = total - used;
    const percentage = total > 0 ? (used / total) * 100 : 0;

    return {
        used,
        available,
        total,
        percentage: Math.round(percentage * 100) / 100,
    };
}

/**
 * Estimate batch size in bytes
 */
function estimateBatchSize(batch: BatchRecord): number {
    // Rough estimation: each candle ~50 bytes (6 numbers) + overhead
    const candleSize = 50;
    const metadataSize = 200; // Overhead for keys, timestamps, etc.
    return batch.candleCount * candleSize + metadataSize;
}

/**
 * Calculate checksum for data integrity
 */
export async function calculateChecksum(data: Candle[]): Promise<string> {
    // Simple checksum: hash of first/last/middle candle timestamps + count
    const key = data.length > 0
        ? `${data[0].t}_${data[Math.floor(data.length / 2)].t}_${data[data.length - 1].t}_${data.length}`
        : '0';

    // Use Web Crypto API for SHA-256
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    return hashHex;
}

/**
 * Get all batches (for debugging/admin)
 */
export async function getAllBatches(): Promise<BatchMetadata[]> {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORES.BATCHES, 'readonly');
        const store = transaction.objectStore(STORES.BATCHES);
        const request = store.getAll();

        request.onsuccess = () => {
            const batches: BatchRecord[] = request.result || [];
            const metadata: BatchMetadata[] = batches.map((batch) => ({
                id: batch.id,
                ticker: batch.ticker,
                interval: batch.interval,
                windowId: batch.windowId,
                startTime: batch.startTime,
                endTime: batch.endTime,
                candleCount: batch.candleCount,
                downloadedAt: batch.downloadedAt,
                sizeBytes: estimateBatchSize(batch),
            }));

            resolve(metadata);
        };

        request.onerror = () => {
            reject(new Error(`Failed to get all batches: ${request.error?.message}`));
        };

        transaction.oncomplete = () => {
            db.close();
        };
    });
}
