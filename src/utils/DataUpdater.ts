/**
 * 🔄 Smart Data Updater - Clean Cut & Stitch Algorithm
 * 
 * Algoritma ini menggunakan strategi "Potong Bersih & Jahit" untuk update data saham
 * tanpa risiko duplikasi atau data korup.
 * 
 * @author m8traders-platform
 * @version 2.0.0
 * 
 * ## Cara Kerja:
 * 1. **Identifikasi**: Cek data terakhir di lokal (misal: 15 Jan, jam 10:45)
 * 2. **Mundur (Safety Rewind)**: Tentukan titik potong di Awal Hari tanggal tersebut (15 Jan, jam 00:00:00)
 * 3. **Potong (Trim)**: Buang semua data lokal yang >= 15 Jan 00:00
 * 4. **Download**: Tarik data baru dari API mulai 15 Jan 00:00 sampai Sekarang
 * 5. **Merge**: Gabungkan [Data Lama s/d 14 Jan] + [Data Baru 15-19 Jan]
 * 
 * ## Keuntungan:
 * - ✅ Anti Duplikat: Timestamp tidak akan muncul dua kali
 * - ✅ Memperbaiki Data Korup: Data bolong-bolong di-replace dengan versi full
 * - ✅ Data Tumbuh (Expand): Data lama tetap aman, data baru terus bertambah
 */

import type { Candle } from '@/types';
import { normalizeToSeconds } from '@/utils/timeUtils';

/**
 * Helper to safely get timestamp from candle (handles both 't' and 'time' formats)
 */
function getTimestamp(c: any): number | undefined {
    return c.t ?? c.time;
}


// ============================================================================
// Types
// ============================================================================

export interface UpdateResult {
    updatedData: Candle[];
    addedCount: number;
    removedCount: number;
    status: 'success' | 'no_update' | 'error';
    message: string;
}

export interface UpdateOptions {
    /**
     * Minimum gap (in hours) before triggering update
     * Default: 1 hour (prevents unnecessary updates)
     */
    minGapHours?: number;

    /**
     * Current epoch for logging context (zombie protection)
     */
    epoch?: number;

    /**
     * Safety rewind strategy
     * - 'day': Rewind to start of last day (safest, default)
     * - 'hour': Rewind to start of last hour (faster, but riskier)
     * - 'minute': Rewind to start of last minute (risky, only for debugging)
     */
    rewindStrategy?: 'day' | 'hour' | 'minute';

    /**
     * Enable debug logging
     */
    debug?: boolean;
}

/**
 * Callback function interface for fetching new data from API
 * @param fromTimestamp Unix timestamp in SECONDS (start of range, inclusive)
 * @param toTimestamp Unix timestamp in SECONDS (end of range, inclusive)
 * @returns Promise resolving to array of Candle objects
 */
export type FetchFunction = (fromTimestamp: number, toTimestamp: number) => Promise<Candle[]>;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate cutoff timestamp based on rewind strategy
 * @param lastTimeSeconds Last candle timestamp in seconds
 * @param strategy Rewind strategy
 * @returns Cutoff timestamp in seconds
 */
function calculateCutoff(lastTimeSeconds: number, strategy: 'day' | 'hour' | 'minute'): number {
    const lastDate = new Date(lastTimeSeconds * 1000);

    switch (strategy) {
        case 'day':
            // Reset to midnight (00:00:00.000)
            lastDate.setHours(0, 0, 0, 0);
            break;

        case 'hour':
            // Reset to start of hour (XX:00:00.000)
            lastDate.setMinutes(0, 0, 0);
            break;

        case 'minute':
            // Reset to start of minute (XX:XX:00.000)
            lastDate.setSeconds(0, 0);
            break;
    }

    return Math.floor(lastDate.getTime() / 1000); // Return Unix seconds
}

/**
 * Format timestamp for logging
 */
function formatTimestamp(seconds: number): string {
    return new Date(seconds * 1000).toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

/**
 * Validate that candle timestamps are in Unix seconds (not milliseconds)
 * @throws Error if any candle has invalid timestamp
 */
function validateSecondsContract(candles: Candle[], context: string = 'data'): void {
    if (!candles || candles.length === 0) return;

    // Check first 10 candles for performance
    for (let i = 0; i < Math.min(candles.length, 10); i++) {
        const c = candles[i];
        const t = getTimestamp(c);

        if (t === undefined || t === null) {
            throw new Error(`[${context}] Validation failed at index ${i}: Missing timestamp (t or time)`);
        }

        if (!Number.isInteger(t)) {
            throw new Error(`[${context}] Invalid timestamp at index ${i}: ${t} is not an integer`);
        }

        if (t > 10_000_000_000) {
            throw new Error(
                `[${context}] Timestamp appears to be milliseconds: ${t} (expected seconds)\n` +
                `Date: ${new Date(t).toISOString()} (as ms) vs ${new Date(t * 1000).toISOString()} (as sec)`
            );
        }

        if (t < 1000000000) {
            throw new Error(`[${context}] Timestamp too old or invalid: ${t}`);
        }
    }
}

// ============================================================================

// ============================================================================
// Main Algorithm
// ============================================================================

/**
 * 🚀 Smart Sync Stock Data - Clean Cut & Stitch
 * 
 * @param localData Data yang sudah ada di IndexedDB/Store
 * @param fetchFunction Callback fungsi untuk request ke API
 * @param options Update options (optional)
 * @returns Update result dengan status dan statistik
 * 
 * @example
 * ```ts
 * const result = await smartSyncStockData(
 *   currentCandles,
 *   (from, to) => fetchAPI('/api/candles', { from, to }),
 *   { rewindStrategy: 'day', debug: true }
 * );
 * 
 * if (result.status === 'success') {
 *   console.log(`Added ${result.addedCount} new candles`);
 *   updateStore(result.updatedData);
 * }
 * ```
 */
export async function smartSyncStockData(
    localData: Candle[],
    fetchFunction: FetchFunction,
    options: UpdateOptions = {},
    floorTimestamp?: number  // 🔥 NEW: Prevent downloading before baseline
): Promise<UpdateResult> {

    // ========================================================================
    // 1. SETUP & VALIDATION
    // ========================================================================

    const {
        minGapHours = 1,
        rewindStrategy = 'day',
        debug = false,
        epoch
    } = options;

    const log = (msg: string, ...args: any[]) => {
        if (debug) console.log(`[DataUpdater] ${msg}`, ...args);
    };

    const warn = (msg: string, ...args: any[]) => {
        console.warn(`[DataUpdater] ⚠️  ${msg}`, ...args);
    };

    const error = (msg: string, ...args: any[]) => {
        console.error(`[DataUpdater] ❌ ${msg}`, ...args);
    };

    // Validate localData
    if (!localData || localData.length === 0) {
        warn('Data lokal kosong. Silakan download full initial data terlebih dahulu.');
        return {
            updatedData: [],
            addedCount: 0,
            removedCount: 0,
            status: 'no_update',
            message: 'Local data is empty. Please perform initial data load.'
        };
    }

    // 🔥 CRITICAL: Validate local data is in seconds
    try {
        validateSecondsContract(localData, 'localData');
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        error(`Local data validation failed: ${msg}`);
        return {
            updatedData: localData,
            addedCount: 0,
            removedCount: 0,
            status: 'error',
            message: `Invalid local data: ${msg}`
        };
    }

    // ========================================================================
    // 2. TENTUKAN TITIK POTONG (CUTOFF)
    // ========================================================================

    // Ambil candle terakhir
    const lastCandle = localData[localData.length - 1];
    const lastTimeSeconds = normalizeToSeconds(getTimestamp(lastCandle));

    // Hitung cutoff berdasarkan strategy
    const cutoffTimestamp = calculateCutoff(lastTimeSeconds, rewindStrategy);
    const nowTimestamp = Math.floor(Date.now() / 1000);

    // 🔥 CRITICAL: Clamp cutoff to floor (never go before baseline)
    const fromTimestamp = floorTimestamp
        ? Math.max(cutoffTimestamp, floorTimestamp)
        : cutoffTimestamp;

    // Check if update is needed (based on minGapHours)
    const gapHours = (nowTimestamp - lastTimeSeconds) / 3600;
    if (gapHours < minGapHours) {
        log(`Gap terlalu kecil: ${gapHours.toFixed(2)}h < ${minGapHours}h. Tidak perlu update.`);
        return {
            updatedData: localData,
            addedCount: 0,
            removedCount: 0,
            status: 'no_update',
            message: `Data is already up to date (gap: ${gapHours.toFixed(2)}h)`
        };
    }

    log(`🛠️  Update Analysis ${epoch !== undefined ? `(Epoch ${epoch})` : ''}`);
    log(`   - Data Lokal Terakhir: ${formatTimestamp(lastTimeSeconds)}`);
    log(`   - Titik Potong (${rewindStrategy}): ${formatTimestamp(cutoffTimestamp)}`);
    if (floorTimestamp) {
        log(`   - Floor Protection: ${formatTimestamp(floorTimestamp)}`);
        log(`   - From (clamped): ${formatTimestamp(fromTimestamp)}`);
    } else {
        log(`   - From: ${formatTimestamp(fromTimestamp)}`);
    }
    log(`   - Gap: ${gapHours.toFixed(2)} jam`);

    // ========================================================================
    // 3. FETCH DATA BARU (Incremental)
    // ========================================================================

    let newData: Candle[] = [];
    try {
        log(`📡 Fetching data dari API (${formatTimestamp(fromTimestamp)} → Sekarang)...`);
        newData = await fetchFunction(fromTimestamp, nowTimestamp);
    } catch (e) {
        error('Gagal fetch data baru:', e);
        return {
            updatedData: localData,
            addedCount: 0,
            removedCount: 0,
            status: 'error',
            message: `API fetch failed: ${e instanceof Error ? e.message : String(e)}`
        };
    }

    // Validate API response
    if (!newData || newData.length === 0) {
        log('Tidak ada data baru dari server (market mungkin libur atau belum buka).');
        return {
            updatedData: localData,
            addedCount: 0,
            removedCount: 0,
            status: 'no_update',
            message: 'No new data available from API'
        };
    }

    // 🔥 CRITICAL: Validate API response is in seconds
    try {
        validateSecondsContract(newData, 'API response');
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        error(`API response validation failed: ${msg}`);
        return {
            updatedData: localData,
            addedCount: 0,
            removedCount: 0,
            status: 'error',
            message: `Invalid API data: ${msg}`
        };
    }

    // ========================================================================

    // ========================================================================
    // 4. PROSES MERGE (Clean Cut & Stitch)
    // ========================================================================

    // A. Potong Data Lama (Keep only data BEFORE fromTimestamp)
    const cleanOldData = localData.filter(c => normalizeToSeconds(getTimestamp(c)) < fromTimestamp);
    const removedCount = localData.length - cleanOldData.length;

    log(`✂️  Memotong ${removedCount} candle lama (>= ${formatTimestamp(fromTimestamp)})`);

    // B. Gabungkan Data
    const mergedData = [...cleanOldData, ...newData];

    // C. Safety: Sort & Deduplication
    // Sort by timestamp (ascending)
    mergedData.sort((a, b) => normalizeToSeconds(getTimestamp(a)) - normalizeToSeconds(getTimestamp(b)));

    // Deduplicate (remove exact duplicate timestamps, keep last occurrence)
    const deduplicated: Candle[] = [];
    let lastTime = -1;

    for (const candle of mergedData) {
        const time = normalizeToSeconds(getTimestamp(candle));
        if (time !== lastTime) {
            deduplicated.push(candle);
            lastTime = time;
        } else {
            // Duplicate found, keep the newer one (overwrite last entry)
            deduplicated[deduplicated.length - 1] = candle;
        }
    }

    const duplicatesRemoved = mergedData.length - deduplicated.length;
    if (duplicatesRemoved > 0) {
        warn(`Removed ${duplicatesRemoved} duplicate candles during merge`);
    }

    // ========================================================================
    // 5. HASIL & STATISTIK
    // ========================================================================

    const growth = deduplicated.length - localData.length;

    log('✅ SUKSES!');
    log(`   - Sebelum: ${localData.length} candles`);
    log(`   - Sesudah: ${deduplicated.length} candles (${growth >= 0 ? '+' : ''}${growth})`);
    log(`   - Dihapus: ${removedCount} candles`);
    log(`   - Ditambah: ${newData.length} candles`);
    log(`   - Duplikat: ${duplicatesRemoved} candles`);
    log(`   - Rentang: ${formatTimestamp(normalizeToSeconds(getTimestamp(deduplicated[0])))} → ${formatTimestamp(normalizeToSeconds(getTimestamp(deduplicated[deduplicated.length - 1])))}`);

    return {
        updatedData: deduplicated,
        addedCount: newData.length,
        removedCount,
        status: 'success',
        message: `Successfully updated: +${growth} candles (removed ${removedCount}, added ${newData.length})`
    };
}

// ============================================================================
// Additional Utilities
// ============================================================================

/**
 * 🕐 Check when the next update should occur
 * @param localData Current local data
 * @param minGapHours Minimum gap in hours before update
 * @returns Timestamp when next update is recommended (in seconds)
 */
export function getNextUpdateTime(localData: Candle[], minGapHours: number = 1): number {
    if (!localData || localData.length === 0) {
        return Math.floor(Date.now() / 1000); // Update immediately
    }

    const lastCandle = localData[localData.length - 1];
    const lastTime = normalizeToSeconds(getTimestamp(lastCandle));
    const nextUpdate = lastTime + (minGapHours * 3600);

    return nextUpdate;
}

/**
 * 📊 Get data freshness status
 * @param localData Current local data
 * @returns Freshness status
 */
export function getDataFreshness(localData: Candle[]): {
    gapHours: number;
    status: 'fresh' | 'stale' | 'very_stale' | 'empty';
    message: string;
} {
    if (!localData || localData.length === 0) {
        return {
            gapHours: Infinity,
            status: 'empty',
            message: 'No data available'
        };
    }

    const lastCandle = localData[localData.length - 1];
    const ts = getTimestamp(lastCandle);

    if (ts === undefined || ts === null) {
        return { gapHours: Infinity, status: 'empty', message: 'Data invalid (missing timestamp)' };
    }

    const lastTime = normalizeToSeconds(ts);
    const nowSeconds = Math.floor(Date.now() / 1000);
    const gapHours = (nowSeconds - lastTime) / 3600;

    if (gapHours < 1) {
        return { gapHours, status: 'fresh', message: 'Data is up to date' };
    } else if (gapHours < 24) {
        return { gapHours, status: 'stale', message: `Data is ${gapHours.toFixed(1)}h old` };
    } else {
        return { gapHours, status: 'very_stale', message: `Data is ${(gapHours / 24).toFixed(1)} days old` };
    }
}
