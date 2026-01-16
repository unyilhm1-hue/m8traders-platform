import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

/**
 * GET /api/simulation/tickers
 * Auto-discover available stock tickers from simulation data directory
 */
export async function GET(request: NextRequest) {
    try {
        const dataDir = path.join(process.cwd(), 'public/simulation-data');

        // Read all files in simulation-data directory
        const files = await fs.readdir(dataDir);

        // Extract unique tickers from filenames
        // Format: TICKER_interval_date.json (e.g., ADRO_1m_2026-01-15.json)
        const tickerSet = new Set<string>();

        files.forEach(filename => {
            // Skip non-JSON files
            if (!filename.endsWith('.json')) return;

            // Extract ticker (first part before underscore)
            const parts = filename.split('_');
            if (parts.length >= 3) {
                const ticker = parts[0].toUpperCase();
                tickerSet.add(ticker);
            }
        });

        // Convert to sorted array
        const tickers = Array.from(tickerSet).sort();

        console.log(`[Tickers API] Found ${tickers.length} unique tickers:`, tickers);

        return NextResponse.json({
            success: true,
            tickers,
            count: tickers.length
        });

    } catch (error) {
        console.error('[Tickers API] Error scanning directory:', error);

        return NextResponse.json({
            success: false,
            error: 'Failed to scan simulation data directory',
            tickers: []
        }, { status: 500 });
    }
}
