/**
 * Worker A: Data Administrator 📘
 * Blueprint Implementation: Parsing, Sanitization, Validation, Static Analysis.
 * Lifecycle: One-off (Starts -> Process -> Returns -> Terminates).
 */

import {
    EnrichedCandle,
    analyzeCandle,
    Candle
} from './simulation.worker-helper';

interface MarketConfig {
    timezone: string;
    openHour: number;
    closeHour: number;
    filterEnabled: boolean;
}

interface WorkerInput {
    type: 'PROCESS_DATA';
    rawFileContent: string;  // Raw JSON string
    fileMetadata?: {         // Optional upload metadata
        name: string;
        size: number;
        type: string;
    };
    marketRules?: {          // Default rules (e.g. IDX)
        defaultLotSize: number;
    };
    params: {                // Context params
        targetDate: string;  // YYYY-MM-DD
        config: MarketConfig;
    };
}

interface ProcessedPayload {
    history: EnrichedCandle[];
    simulation: EnrichedCandle[];
    metadata: {
        appliedLotSize: number;
        dataRange: { start: string; end: string };
        totalCandles: number;
        skippedCount: number;
    };
}

interface WorkerOutput {
    status: 'SUCCESS' | 'ERROR';
    payload?: ProcessedPayload;
    error?: string;
}

// ----------------------------------------------------------------------------
// UTILITIES
// ----------------------------------------------------------------------------

function normalizeTimestamp(rawTime: any): number {
    if (typeof rawTime === 'number') {
        return rawTime < 10000000000 ? rawTime * 1000 : rawTime;
    }
    if (typeof rawTime === 'string') {
        const t = new Date(rawTime).getTime();
        return isNaN(t) ? Date.now() : t;
    }
    if (rawTime instanceof Date) return rawTime.getTime();
    return Date.now();
}

function toMarketTime(timestamp: number, timezone: string) {
    const date = new Date(timestamp);
    const hour = Number(date.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: timezone }));
    const minute = Number(date.toLocaleString('en-US', { minute: 'numeric', timeZone: timezone }));
    return { hour, minute, date };
}

function isWithinMarketHours(ts: number, config: MarketConfig): boolean {
    if (!config.filterEnabled) return true;
    const { hour, minute } = toMarketTime(ts, config.timezone);

    // Market Hours (09:00 - 16:00)
    if (hour < config.openHour) return false;
    if (hour > config.closeHour) return false;
    if (hour === config.closeHour && minute > 0) return false; // Strict 16:00 close

    // Lunch Break (IDX Specific: 11:30 - 13:30)
    // Legacy logic alignment
    if (hour > 11 && hour < 13) return false;       // 12:xx
    if (hour === 11 && minute >= 30) return false;  // 11:30+
    if (hour === 13 && minute < 30) return false;   // 13:00-13:29

    return true;
}

// ----------------------------------------------------------------------------
// MAIN PIPELINE
// ----------------------------------------------------------------------------

self.onmessage = (event: MessageEvent<WorkerInput>) => {
    const { type, rawFileContent, fileMetadata, marketRules, params } = event.data;

    if (type !== 'PROCESS_DATA') return;

    try {
        console.log('[Worker A] 📘 Starting Data Administrator Pipeline...');
        const startTime = performance.now();

        // ---------------------------------------------------------
        // LANGKAH A: Heavy Parsing (Pembongkaran)
        // ---------------------------------------------------------
        let rawData: any;
        try {
            rawData = JSON.parse(rawFileContent);
        } catch (e) {
            throw new Error('Format file tidak valid (Gagal Parsing JSON)');
        }

        // ---------------------------------------------------------
        // LANGKAH B: Metadata Intelligence (Deteksi LotSize)
        // ---------------------------------------------------------
        let candlesArray: any[] = [];
        let appliedLotSize = marketRules?.defaultLotSize || 100; // Default IDX

        if (Array.isArray(rawData)) {
            candlesArray = rawData;
            // No metadata in array root, rely on defaults or heuristics later
        } else if (typeof rawData === 'object' && rawData !== null) {
            // Check for structure { lotSize: 50, data: [...] } or { candles: [...] }
            if (rawData.lotSize && typeof rawData.lotSize === 'number') {
                appliedLotSize = rawData.lotSize;
                console.log(`[Worker A] 💡 LotSize detected in file header: ${appliedLotSize}`);
            }

            if (Array.isArray(rawData.data)) {
                candlesArray = rawData.data;
            } else if (Array.isArray(rawData.candles)) {
                candlesArray = rawData.candles;
            } else {
                // Fallback: try to find any array property
                const values = Object.values(rawData);
                const foundArray = values.find(v => Array.isArray(v));
                if (foundArray) {
                    candlesArray = foundArray as any[];
                } else {
                    throw new Error('Struktur file tidak dikenali (Tidak ada array candle)');
                }
            }
        } else {
            throw new Error('Format root JSON tidak valid');
        }

        if (candlesArray.length === 0) {
            throw new Error('Dataset kosong');
        }

        // ---------------------------------------------------------
        // LANGKAH C: The "Sanitization Loop" (Pembersihan)
        // ---------------------------------------------------------
        const processedList: EnrichedCandle[] = [];

        for (const raw of candlesArray) {
            // 1. Mapping Key & Normalization
            const t = normalizeTimestamp(raw.t || raw.time || raw.timestamp);
            let o = Number(raw.o || raw.open);
            let h = Number(raw.h || raw.high);
            let l = Number(raw.l || raw.low);
            let c = Number(raw.c || raw.close);
            let v = Number(raw.v || raw.volume || raw.vol || 0);

            // Skip invalid numbers
            if (isNaN(t) || isNaN(o) || isNaN(h) || isNaN(l) || isNaN(c)) continue;

            // 2. Auto-Correction (High/Low Logic)
            // Fix H < L
            if (h < l) {
                const temp = h; h = l; l = temp;
            }
            // Fix H < Max(O, C)
            const maxBody = Math.max(o, c);
            if (h < maxBody) h = maxBody;
            // Fix L > Min(O, C)
            const minBody = Math.min(o, c);
            if (l > minBody) l = minBody;

            // 3. Volume Normalization (LotSize Injection)
            // "Round(RawVolume / AppliedLotSize)"
            v = Math.round(v / appliedLotSize);

            // Construct Basic Candle
            const candle: Candle = { t, o, h, l, c, v };

            // 4. Static Analysis (Integrasi Helper)
            const analysis = analyzeCandle(candle);

            // Enrich
            processedList.push({
                ...candle,
                ...analysis
            });
        }

        // ---------------------------------------------------------
        // LANGKAH D: Sorting & Deduplication
        // ---------------------------------------------------------
        // Sort Ascending
        processedList.sort((a, b) => a.t - b.t);

        // Deduplication (Exact timestamp match)
        const uniqueList: EnrichedCandle[] = [];
        if (processedList.length > 0) {
            uniqueList.push(processedList[0]);
            for (let i = 1; i < processedList.length; i++) {
                if (processedList[i].t !== processedList[i - 1].t) {
                    uniqueList.push(processedList[i]);
                }
            }
        }

        // ---------------------------------------------------------
        // LANGKAH E: Segmentation (Pembagian Tugas)
        // ---------------------------------------------------------
        const historyBuffer: EnrichedCandle[] = [];
        const simulationQueue: EnrichedCandle[] = [];

        // Define Split Strategy:
        // Use params.targetDate to define "Future".
        // Everything before targetDate is History.
        // Everything on targetDate is Simulation.

        const { targetDate, config } = params;

        // Helper to get YYYY-MM-DD in Market Timezone
        const getDateStr = (ts: number) => {
            return toMarketTime(ts, config.timezone).date.toLocaleDateString('en-CA', { timeZone: config.timezone });
        };

        let skippedCount = 0;
        let minDate = '';
        let maxDate = '';

        if (uniqueList.length > 0) {
            minDate = getDateStr(uniqueList[0].t);
            maxDate = getDateStr(uniqueList[uniqueList.length - 1].t);
        }

        // Strategy A: Explicit Date Split (If targetDate is provided)
        // Usually useSimulationStore passes the selected 'Sim Date'.

        for (const candle of uniqueList) {
            const cDate = getDateStr(candle.t);

            if (cDate < targetDate) {
                historyBuffer.push(candle);
            } else if (cDate === targetDate) {
                // Apply Market Hours Filter for Simulation Data
                if (isWithinMarketHours(candle.t, config)) {
                    simulationQueue.push(candle);
                } else {
                    skippedCount++;
                }
            }
            // Ignore future dates > targetDate
        }

        // Optimization: "Ambil 100-200 candle terakhir (history)"
        // If history is too large, we trim it to save memory/transfer, 
        // BUT for a Chart, we often want more context.
        // Blueprint says: "Ambil 100-200 candle terakhir (untuk data awal chart agar tidak kosong)."
        // Let's cap it at 500 to be safe for 1m interval (approx 1 day +).
        // If user explicitly asks for 200, we use 200.
        const HISTORY_CAP = 300;
        const finalHistory = historyBuffer.length > HISTORY_CAP
            ? historyBuffer.slice(-HISTORY_CAP)
            : historyBuffer;

        // ---------------------------------------------------------
        // 3. OUTPUT (Data Keluar)
        // ---------------------------------------------------------
        const elapsed = performance.now() - startTime;
        console.log(`[Worker A] ✅ Job Complete (${elapsed.toFixed(0)}ms)`);
        console.log(`   - History: ${finalHistory.length} (Sliced from ${historyBuffer.length})`);
        console.log(`   - Simulation: ${simulationQueue.length}`);
        console.log(`   - LotSize: ${appliedLotSize}`);

        const response: WorkerOutput = {
            status: 'SUCCESS',
            payload: {
                history: finalHistory,
                simulation: simulationQueue,
                metadata: {
                    appliedLotSize,
                    dataRange: { start: minDate, end: maxDate },
                    totalCandles: uniqueList.length,
                    skippedCount
                }
            }
        };

        postMessage(response);

    } catch (err: any) {
        console.error('[Worker A] 💥 Validation Failed:', err);
        const response: WorkerOutput = {
            status: 'ERROR',
            error: err.message || 'Terjadi kesalahan internal pada Worker A'
        };
        postMessage(response);
    }
};
