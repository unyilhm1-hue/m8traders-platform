import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

/**
 * Availability Checker API
 * Returns which intervals are available for a given ticker and date
 * 
 * Query params:
 * - ticker: Stock ticker (e.g., "BBCA" or "BBCA.JK")
 * - date: Date in YYYY-MM-DD format (e.g., "2026-01-15")
 * 
 * Response:
 * {
 *   available: ['1m', '2m', '5m', ...],
 *   recommended: '1m',
 *   fileCount: 6
 * }
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const ticker = searchParams.get('ticker');
        const date = searchParams.get('date');

        // Validation
        if (!ticker || !date) {
            return NextResponse.json(
                { error: 'Missing required params: ticker, date' },
                { status: 400 }
            );
        }

        // Validate date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return NextResponse.json(
                { error: 'Invalid date format. Use YYYY-MM-DD' },
                { status: 400 }
            );
        }

        const dataDir = path.join(process.cwd(), 'public', 'simulation-data');

        if (!fs.existsSync(dataDir)) {
            return NextResponse.json(
                { error: 'Data directory not found' },
                { status: 404 }
            );
        }

        // Clean ticker (remove .JK suffix if present)
        const cleanTicker = ticker.replace('.JK', '').replace('.', '_');

        // Scan for files matching pattern: TICKER_INTERVAL_DATE.json or TICKER_DATE.json (legacy 1m)
        const files = fs.readdirSync(dataDir);

        const allIntervals = ['1m', '2m', '5m', '15m', '30m', '60m'];
        const availableIntervals: string[] = [];

        for (const interval of allIntervals) {
            // Check for new format: TICKER_INTERVAL_DATE.json
            const newFormatFile = `${cleanTicker}_${interval}_${date}.json`;

            if (files.includes(newFormatFile)) {
                availableIntervals.push(interval);
            }
        }

        // Determine recommended interval (smallest available = most detailed)
        const recommended = availableIntervals.length > 0
            ? availableIntervals[0]
            : null;

        return NextResponse.json({
            ticker: cleanTicker,
            date,
            available: availableIntervals,
            recommended,
            fileCount: availableIntervals.length,
        });

    } catch (error) {
        console.error('[AvailabilityAPI] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
