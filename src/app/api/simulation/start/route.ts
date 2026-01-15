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
        // Format: TICKER_YYYY-MM-DD.json (single day) OR TICKER_full_30days.json (multi-day)
        let ticker: string;
        let date: string;

        const singleDayMatch = randomFile.match(/^(.+)_(\d{4}-\d{2}-\d{2})\.json$/);
        if (singleDayMatch) {
            // Single day file: BBRI_2025-12-18.json
            ticker = singleDayMatch[1];
            date = singleDayMatch[2];
        } else {
            // Multi-day file: BBRI_full_30days.json
            // Extract ticker and use LAST candle's date (so there's history before it)
            const multiDayMatch = randomFile.match(/^(.+?)_.*\.json$/);
            ticker = multiDayMatch ? multiDayMatch[1] : 'UNKNOWN';

            // Extract date from LAST candle's timestamp (for better history/sim split)
            if (candles.length > 0 && candles[candles.length - 1].time) {
                const lastCandleDate = new Date(candles[candles.length - 1].time);
                date = lastCandleDate.toISOString().split('T')[0];
            } else {
                date = 'UNKNOWN';
            }
        }

        // Convert time strings to timestamps (ms) for compatibility
        const candlesWithTimestamp = candles.map((candle, index) => {
            let timestamp: number;

            // Parse timestamp dengan timezone handling
            // Format JSON: "2025-12-18 02:00:00" (timezone-less)
            // Kita perlu append timezone untuk parsing yang reliable
            if (typeof candle.time === 'string') {
                // Append WIB timezone (+07:00) jika belum ada
                const timeStr = candle.time.includes('+') || candle.time.includes('Z')
                    ? candle.time
                    : candle.time + '+07:00';

                timestamp = new Date(timeStr).getTime();
            } else if (typeof candle.time === 'number') {
                // Jika sudah number, normalize ke milliseconds
                timestamp = candle.time < 10000000000 ? candle.time * 1000 : candle.time;
            } else {
                timestamp = 0;
            }

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
