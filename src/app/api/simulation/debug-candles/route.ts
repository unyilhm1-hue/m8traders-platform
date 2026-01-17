/**
 * DEBUG API: Inspect raw candle data from MERGED file
 * GET /api/simulation/debug-candles?ticker=ADRO&interval=1m
 */

import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const ticker = searchParams.get('ticker') || 'ADRO';
        const interval = searchParams.get('interval') || '1m';

        const filename = `${ticker}_${interval}_MERGED.json`;
        const filepath = path.join(process.cwd(), 'public', 'simulation-data', filename);

        const content = await fs.readFile(filepath, 'utf-8');
        const data = JSON.parse(content);

        // Sample first 3 and last 3 candles
        const candles = data.candles || [];
        const sampleFirst = candles.slice(0, 3).map((c: any) => ({
            ...c,
            timestamp: c.timestamp || c.time || c.t,
            date: new Date(c.timestamp || c.time || c.t).toISOString()
        }));
        const sampleLast = candles.slice(-3).map((c: any) => ({
            ...c,
            timestamp: c.timestamp || c.time || c.t,
            date: new Date(c.timestamp || c.time || c.t).toISOString()
        }));

        return NextResponse.json({
            success: true,
            filename,
            metadata: data.metadata,
            totalCandles: candles.length,
            sampleFirst,
            sampleLast,
            candleSchema: Object.keys(candles[0] || {})
        });

    } catch (error) {
        console.error('[DEBUG] Error reading candles:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
