import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// 🔥 CRITICAL: Node runtime (untuk fs access, bukan Edge)
export const runtime = 'nodejs';

/**
 * Mock API Endpoint for Incremental Data Updates
 * 
 * CONTRACT:
 * - Input: from/to are Unix SECONDS
 * - Output: candle.t is Unix SECONDS
 * 
 * This endpoint simulates incremental data fetch by reading from
 * server/  directory (NOT the same as client baseline).
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');
    const interval = searchParams.get('interval');
    const from = parseInt(searchParams.get('from') || '0');  // Unix seconds
    const to = parseInt(searchParams.get('to') || String(Math.floor(Date.now() / 1000)));

    if (!symbol || !interval) {
        return NextResponse.json(
            { error: 'Missing required parameters: symbol, interval' },
            { status: 400 }
        );
    }

    // 🔥 CRITICAL: Read from SERVER directory (different from client baseline)
    const filePath = path.join(
        process.cwd(),
        'public',
        'simulation-data',
        'server',  // Server source (longer/more complete than client)
        `${symbol}_${interval}_SERVER.json`
    );

    try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const jsonContent: any = JSON.parse(fileContent);

        // 🔥 CRITICAL: Handle wrapped schema (MERGED format) vs flat array
        let allData: any[] = [];
        if (Array.isArray(jsonContent)) {
            allData = jsonContent;
        } else if (Array.isArray(jsonContent.candles)) {
            allData = jsonContent.candles;
        } else if (Array.isArray(jsonContent.data)) {
            allData = jsonContent.data;
        } else {
            throw new Error('Unknown JSON schema: neither array nor {candles: []}');
        }

        if (allData.length === 0) {
            return NextResponse.json({
                symbol,
                interval,
                from,
                to,
                count: 0,
                data: []
            });
        }

        // 🔥 CRITICAL: Time contract auto-detection
        // Check if file uses milliseconds, seconds, or ISO string
        const firstCandle = allData[0];
        let getTime: (c: any) => number;

        if (firstCandle.timestamp && typeof firstCandle.timestamp === 'string') {
            // ISO Date String: "2025-12-19T02:00:00Z"
            console.log('[API] Detected format: ISO STRING (converting to seconds)');
            getTime = (c) => Math.floor(new Date(c.timestamp).getTime() / 1000);
        } else {
            // Unix Timestamp (t or time)
            const rawT = firstCandle.t ?? firstCandle.time;
            const isMs = rawT > 10_000_000_000;
            console.log(`[API] Detected format: UNIX ${isMs ? 'MILLISECONDS' : 'SECONDS'}`);
            getTime = (c) => {
                const t = c.t ?? c.time;
                return isMs ? Math.floor(t / 1000) : t;
            };
        }

        console.log(`[API] /api/candles GET ${symbol} ${interval}`);
        console.log(`[API]   Range requested: ${new Date(from * 1000).toISOString()} → ${new Date(to * 1000).toISOString()}`);

        const filteredData = allData
            .map((candle: any) => ({
                t: getTime(candle), // Normalize to seconds
                o: candle.o ?? candle.open,
                h: candle.h ?? candle.high,
                l: candle.l ?? candle.low,
                c: candle.c ?? candle.close,
                v: candle.v ?? candle.volume ?? 0
            }))
            .filter((candle: any) => candle.t >= from && candle.t <= to);

        console.log(`[API]   Total in file: ${allData.length}, Filtered: ${filteredData.length}`);

        if (filteredData.length > 0) {
            console.log(`[API]   First: ${new Date(filteredData[0].t * 1000).toISOString()}`);
            console.log(`[API]   Last: ${new Date(filteredData[filteredData.length - 1].t * 1000).toISOString()}`);
        }

        return NextResponse.json({
            symbol,
            interval,
            from,
            to,
            count: filteredData.length,
            data: filteredData  // Already in seconds
        });
    } catch (error) {
        console.error('[API] Failed to read data:', error);

        // Provide helpful error message
        const isFileNotFound = (error as any)?.code === 'ENOENT';
        const message = isFileNotFound
            ? `Server file not found: ${filePath}. Please create server data files in public/simulation-data/server/`
            : error instanceof Error ? error.message : 'Unknown error';

        return NextResponse.json({
            error: 'Failed to read data',
            message,
            hint: isFileNotFound ? 'See testing_scenarios.md for setup instructions' : undefined
        }, { status: 500 });
    }
}
