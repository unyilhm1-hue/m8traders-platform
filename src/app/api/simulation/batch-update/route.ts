import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { smartSyncStockData } from '@/utils/DataUpdater';
import { normalizeToSeconds } from '@/utils/timeUtils';

// 🔥 Critical: Node runtime for filesystem access
export const runtime = 'nodejs';

// Reusing types from DataUpdater
type Candle = any; // Loosely typed to avoid strict import issues, implementation handles validation

export async function POST(request: NextRequest) {
    try {
        console.log('[BatchUpdate] 🚀 Starting Server-Side Batch Update...');

        const publicDir = path.join(process.cwd(), 'public');
        const dataDir = path.join(publicDir, 'simulation-data');
        const serverDir = path.join(dataDir, 'server');

        // 1. Scan for baseline files (My Stocks)
        const files = await fs.readdir(dataDir);
        const baselineFiles = files.filter(f => f.match(/^.+_1m_MERGED\.json$/));

        console.log(`[BatchUpdate] 📋 Found ${baselineFiles.length} tickers to check.`);

        let successCount = 0;
        let failCount = 0;
        let noUpdateCount = 0;
        const results = [];

        for (const filename of baselineFiles) {
            const matches = filename.match(/^(.+?)_1m_MERGED\.json$/);
            if (!matches) continue;
            const ticker = matches[1];

            try {
                // 2. Read Local Baseline
                const localPath = path.join(dataDir, filename);
                const localContent = await fs.readFile(localPath, 'utf-8');
                const rawLocalData = JSON.parse(localContent);

                // 🔥 Normalize Local Data (ISO -> Seconds)
                // The MERGED files on disk might be in ISO format, but DataUpdater needs Seconds
                let localData: any[] = [];
                const rawArr = Array.isArray(rawLocalData) ? rawLocalData : (rawLocalData.candles || rawLocalData.data || []);

                localData = rawArr.map((c: any) => ({
                    t: normalizeToSeconds(c.t || c.time || c.timestamp),
                    o: c.o || c.open,
                    h: c.h || c.high,
                    l: c.l || c.low,
                    c: c.c || c.close,
                    v: c.v || c.volume || 0
                })).filter((c: any) => c.t !== undefined && !isNaN(c.t));

                // 3. Define Fetch Function (Read from Server Directory)
                const fetchFunction = async (from: number, to: number) => {
                    const serverPath = path.join(serverDir, `${ticker}_1m_SERVER.json`);
                    try {
                        const serverContent = await fs.readFile(serverPath, 'utf-8');
                        const serverJson = JSON.parse(serverContent);

                        // Handle formatting (Wrapped vs Flat, ISO vs Seconds)
                        // This logic is mirrored from `api/candles/route.ts`
                        let allData: any[] = [];
                        if (Array.isArray(serverJson)) allData = serverJson;
                        else if (Array.isArray(serverJson.candles)) allData = serverJson.candles;
                        else if (Array.isArray(serverJson.data)) allData = serverJson.data;

                        // Normalize
                        return allData.map((c: any) => ({
                            t: normalizeToSeconds(c.t || c.time || c.timestamp),
                            o: c.o || c.open,
                            h: c.h || c.high,
                            l: c.l || c.low,
                            c: c.c || c.close,
                            v: c.v || c.volume || 0
                        })).filter((c: any) => c.t >= from && c.t <= to);

                    } catch (err) {
                        console.warn(`[BatchUpdate] Missing server file for ${ticker}, returning empty.`);
                        return [];
                    }
                };

                // 4. Run Smart Sync
                const result = await smartSyncStockData(
                    localData,
                    fetchFunction,
                    {
                        minGapHours: 1,
                        rewindStrategy: 'day',
                        debug: false
                    }
                );

                // 5. Persist if updated
                if (result.status === 'success') {
                    // Normalize back to Milliseconds? 
                    // Store expects Milliseconds usually if it's ResamplerCandle
                    // But our file format on disk is usually flexible. 
                    // Let's stick to what we read. If we read seconds, we write seconds?
                    // SmartSync returns standardized Candle object (usually seconds internal).
                    // We should check what the file expects.
                    // Most 1m files (MERGED) are in milliseconds in the user's project?
                    // Let's check the first candle in localData.
                    const firstT = localData[0]?.t || localData[0]?.time;
                    const isMs = firstT > 10_000_000_000;

                    // 🔥 FIX: Convert to standard MERGED format
                    // Use ISO timestamps and full property names for consistency
                    const dataToWrite = result.updatedData.map(c => ({
                        timestamp: new Date(c.t * 1000).toISOString(),
                        open: c.o,
                        high: c.h,
                        low: c.l,
                        close: c.c,
                        volume: c.v
                    }));

                    // 🔥 FIX: Persist consistent structure (Wrapper + Metadata)
                    // Do not overwrite with flat array.
                    const finalData = {
                        ticker: ticker,
                        interval: '1m', // We are only processing 1m files here
                        metadata: {
                            data_start: dataToWrite.length > 0 ? dataToWrite[0].timestamp : new Date().toISOString(),
                            data_end: dataToWrite.length > 0 ? dataToWrite[dataToWrite.length - 1].timestamp : new Date().toISOString(),
                            total_candles: dataToWrite.length,
                            duration_days: Math.floor((new Date(dataToWrite[dataToWrite.length - 1]?.timestamp || 0).getTime() - new Date(dataToWrite[0]?.timestamp || 0).getTime()) / (1000 * 60 * 60 * 24)),
                            generated_at: new Date().toISOString()
                        },
                        candles: dataToWrite
                    };

                    await fs.writeFile(localPath, JSON.stringify(finalData, null, 2));
                    successCount++;
                    results.push({ ticker, status: 'updated', count: result.addedCount });
                } else if (result.status === 'no_update') {
                    noUpdateCount++;
                    results.push({ ticker, status: 'no_change' });
                } else {
                    failCount++;
                    results.push({ ticker, status: 'error', message: result.message });
                }

            } catch (err) {
                console.error(`[BatchUpdate] Failed ${ticker}:`, err);
                failCount++;
                results.push({ ticker, status: 'error', message: String(err) });
            }
        }

        console.log(`[BatchUpdate] 🏁 Complete. Updated: ${successCount}, No Change: ${noUpdateCount}, Failed: ${failCount}`);

        return NextResponse.json({
            success: true,
            summary: { successCount, noUpdateCount, failCount },
            results
        });

    } catch (error) {
        console.error('[BatchUpdate] Global Error:', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
