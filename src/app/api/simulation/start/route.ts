/**
 * Simulation Start API Route
 * Returns a random trading day's data from local JSON files
 */

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic'; // Disable caching for randomness

interface Candle {
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export async function GET() {
    try {
        // Path to simulation data directory
        const dataDir = path.join(process.cwd(), 'public', 'simulation-data');

        // Check if directory exists
        if (!fs.existsSync(dataDir)) {
            return NextResponse.json(
                { error: 'Simulation data directory not found. Please run harvest_yfinance.py first.' },
                { status: 404 }
            );
        }

        // Read all JSON files
        const files = fs.readdirSync(dataDir).filter((file) => file.endsWith('.json'));

        if (files.length === 0) {
            return NextResponse.json(
                { error: 'No simulation data files found. Please run harvest_yfinance.py first.' },
                { status: 404 }
            );
        }

        // Randomly select one file
        const randomFile = files[Math.floor(Math.random() * files.length)];
        const filePath = path.join(dataDir, randomFile);

        // Read and parse JSON
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const candles: Candle[] = JSON.parse(fileContent);

        // Extract metadata from filename
        // Format: TICKER_YYYY-MM-DD.json
        const match = randomFile.match(/^(.+)_(\d{4}-\d{2}-\d{2})\.json$/);
        const ticker = match ? match[1] : 'UNKNOWN';
        const date = match ? match[2] : 'UNKNOWN';

        // Convert time strings to timestamps (ms) for compatibility
        const candlesWithTimestamp = candles.map((candle, index) => {
            const timestamp = new Date(candle.time).getTime();

            // Validate timestamp
            if (isNaN(timestamp) || timestamp === 0) {
                console.error(`[API] Invalid timestamp for candle ${index}: "${candle.time}"`);
                // Use index-based timestamp as fallback (1 minute apart)
                const fallbackTimestamp = Date.now() + (index * 60000);
                console.warn(`[API] Using fallback timestamp: ${fallbackTimestamp}`);

                return {
                    t: fallbackTimestamp,
                    o: candle.open,
                    h: candle.high,
                    l: candle.low,
                    c: candle.close,
                    v: candle.volume,
                };
            }

            return {
                t: timestamp,
                o: candle.open,
                h: candle.high,
                l: candle.low,
                c: candle.close,
                v: candle.volume,
            };
        });

        return NextResponse.json({
            success: true,
            data: {
                ticker,
                date,
                candles: candlesWithTimestamp,
                candleCount: candlesWithTimestamp.length,
                source: randomFile,
            },
        });
    } catch (error) {
        console.error('[API] Simulation start error:', error);
        return NextResponse.json(
            { error: 'Failed to load simulation data', details: (error as Error).message },
            { status: 500 }
        );
    }
}
