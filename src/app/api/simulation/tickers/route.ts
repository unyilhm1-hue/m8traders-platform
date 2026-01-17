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

        // Extract unique tickers from MERGED files only
        const tickerSet = new Set<string>();
        const tickerData = new Map<string, any>();

        for (const filename of files) {
            // Only process MERGED files
            if (!filename.endsWith('_MERGED.json')) continue;

            // Extract ticker and interval
            // Format: TICKER_INTERVAL_MERGED.json (e.g., ADRO_1m_MERGED.json)
            const match = filename.match(/^(.+?)_(\d+[mhd])_MERGED\.json$/);
            if (!match) continue;

            const [, ticker, interval] = match;
            tickerSet.add(ticker);

            // Read metadata from 1m file (canonical source)
            if (interval === '1m') {
                try {
                    const filePath = path.join(dataDir, filename);
                    const content = await fs.readFile(filePath, 'utf-8');
                    const data = JSON.parse(content);

                    tickerData.set(ticker, {
                        ticker,
                        metadata: data.metadata || {},
                        intervals: []
                    });
                } catch (err) {
                    console.error(`[Tickers API] Error reading ${filename}:`, err);
                }
            }
        }

        // Collect intervals for each ticker
        for (const filename of files) {
            if (!filename.endsWith('_MERGED.json')) continue;

            const match = filename.match(/^(.+?)_(\d+[mhd])_MERGED\.json$/);
            if (!match) continue;

            const [, ticker, interval] = match;
            const data = tickerData.get(ticker);
            if (data && !data.intervals.includes(interval)) {
                data.intervals.push(interval);
            }
        }

        // Convert to array and sort
        const tickers = Array.from(tickerData.values()).sort((a, b) =>
            a.ticker.localeCompare(b.ticker)
        );

        console.log(`[Tickers API] Found ${tickers.length} unique tickers:`, tickers.map(t => t.ticker));

        return NextResponse.json({
            success: true,
            data: {
                tickers,
                count: tickers.length
            }
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
