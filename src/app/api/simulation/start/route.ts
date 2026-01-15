import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const dataDir = path.join(process.cwd(), 'public', 'simulation-data');

        if (!fs.existsSync(dataDir)) {
            return NextResponse.json({ error: 'Dir not found' }, { status: 404 });
        }

        const files = fs.readdirSync(dataDir).filter((file) => file.endsWith('.json'));
        if (files.length === 0) {
            return NextResponse.json({ error: 'No files' }, { status: 404 });
        }

        // Parse query params for specific ticker, date, and interval request
        const { searchParams } = new URL(request.url);

        // ✅ NEW: Accept ticker and date params (with smart defaults for backward compat)
        const requestedTicker = searchParams.get('ticker') || 'ASII'; // Default to ASII
        const requestedDate = searchParams.get('date'); // Optional (null = any date)
        const requestedInterval = searchParams.get('interval') || '1m'; // Default to 1m

        // Clean ticker (remove .JK suffix)
        const cleanTicker = requestedTicker.replace('.JK', '').replace('.', '_');

        console.log(`[API/Start] 🔍 Looking for: ${cleanTicker}, interval: ${requestedInterval}, date: ${requestedDate || 'any'}`);

        // Filter files based on ALL params: ticker, interval, and optionally date
        const matchedFiles = files.filter(f => {
            // Special case: Legacy full month file (always ASII 1m)
            if (f === 'ASII_full_30days.json') {
                return cleanTicker === 'ASII' && requestedInterval === '1m' && !requestedDate;
            }

            // Pattern 1: TICKER_INTERVAL_DATE.json (new format)
            const newMatch = f.match(/^([A-Z_.]+)_(\d+[md])_(\d{4}-\d{2}-\d{2})\.json$/);
            if (newMatch) {
                const [, fTicker, fInterval, fDate] = newMatch;
                const tickerMatch = fTicker === cleanTicker;
                const intervalMatch = fInterval === requestedInterval;
                const dateMatch = !requestedDate || fDate === requestedDate;
                return tickerMatch && intervalMatch && dateMatch;
            }

            // Pattern 2: TICKER_DATE.json (legacy 1m format)
            if (requestedInterval === '1m') {
                const legacyMatch = f.match(/^([A-Z_.]+)_(\d{4}-\d{2}-\d{2})\.json$/);
                if (legacyMatch) {
                    const [, fTicker, fDate] = legacyMatch;
                    const tickerMatch = fTicker === cleanTicker;
                    const dateMatch = !requestedDate || fDate === requestedDate;
                    return tickerMatch && dateMatch;
                }
            }

            return false;
        });

        // Select file: deterministic (first match) instead of random
        let selectedFile: string;

        if (matchedFiles.length > 0) {
            // Perfect match found! Take first (deterministic)
            selectedFile = matchedFiles[0];
            console.log(`[API/Start] ✅ Found ${matchedFiles.length} match(es), selected: ${selectedFile}`);
        } else {
            // No exact match - fallback to interval-only match
            console.warn(`[API/Start] ⚠️ No match for ${cleanTicker}_${requestedInterval}${requestedDate ? `_${requestedDate}` : ''}`);
            const intervalFiles = files.filter(f => f.includes(`_${requestedInterval}_`));
            selectedFile = intervalFiles.length > 0 ? intervalFiles[0] : files[0];
            console.warn(`[API/Start] 📁 Fallback to: ${selectedFile}`);
        }


        const filePath = path.join(dataDir, selectedFile);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const rawData = JSON.parse(fileContent);

        // Ambil ticker dari nama file
        const ticker = selectedFile.split('_')[0] || 'UNKNOWN';

        // ✅ Extract date from filename (for HH:MM-only format support)
        // Format: "TICKER_YYYY-MM-DD.json" or "TICKER_full_30days.json"
        const filenameParts = selectedFile.replace('.json', '').split('_');
        const dateFromFilename = filenameParts.length >= 2 && filenameParts[1].match(/^\d{4}-\d{2}-\d{2}$/)
            ? filenameParts[1]
            : null;

        // --- DATA PROCESSING WITH FORMAT DETECTION ---
        // ✅ Calculate interval multiplier for timestamp adjustment
        const intervalMultipliers: Record<string, number> = {
            '1m': 1,    // 60s
            '2m': 2,    // 120s
            '5m': 5,    // 300s
            '15m': 15,  // 900s
            '30m': 30,  // 1800s
            '60m': 60,  // 3600s
        };
        const baseIntervalMs = 60000; // 1 minute in ms
        const multiplier = intervalMultipliers[requestedInterval] || 1;

        console.log(`[API/Start] Applying ${multiplier}x timestamp multiplier for ${requestedInterval}`);

        const candlesWithTimestamp = rawData.map((candle: any, index: number) => {
            let timestamp: number;

            // ✅ Try to detect format and parse accordingly
            if (candle.time.includes(' ') || candle.time.includes('T')) {
                // Format 1: Full datetime "2025-12-18 02:00:00" or "2025-12-18T02:00:00"
                const timeString = candle.time.replace(' ', 'T') + (candle.time.includes('Z') ? '' : 'Z');
                timestamp = new Date(timeString).getTime();
            } else if (candle.time.match(/^\d{2}:\d{2}(:\d{2})?$/)) {
                // Format 2: Time-only "09:00" or "09:00:00"
                if (dateFromFilename) {
                    // Combine filename date with candle time
                    const timePart = candle.time.length === 5 ? `${candle.time}:00` : candle.time;
                    const fullDatetime = `${dateFromFilename}T${timePart}Z`;
                    timestamp = new Date(fullDatetime).getTime();

                    // ✅ Adjust timestamp based on interval
                    // For 5m: each candle should be 5 minutes apart
                    // So add index * 5 * 60000ms instead of just index * 60000ms
                    timestamp = timestamp + (index * baseIntervalMs * (multiplier - 1));
                } else {
                    // No date in filename - cannot parse reliably
                    console.warn(`[API] Time-only format "${candle.time}" but no date in filename "${selectedFile}"`);
                    timestamp = NaN;
                }
            } else {
                // Unknown format
                console.warn(`[API] Unknown time format: "${candle.time}"`);
                timestamp = NaN;
            }

            // Validation
            if (isNaN(timestamp)) {
                // Fallback: use current time + offset (last resort)
                console.warn(`[API] Using fallback timestamp for candle ${index}: "${candle.time}"`);
                return {
                    t: Date.now() + (index * baseIntervalMs * multiplier),
                    o: candle.open,
                    h: candle.high,
                    l: candle.low,
                    c: candle.close,
                    v: candle.volume,
                };
            }

            return {
                t: timestamp, // ✅ Now correct for both formats!
                o: candle.open,
                h: candle.high,
                l: candle.low,
                c: candle.close,
                v: candle.volume,
            };
        });

        // Urutkan data berdasarkan waktu (Wajib!)
        candlesWithTimestamp.sort((a: any, b: any) => a.t - b.t);

        return NextResponse.json({
            success: true,
            data: {
                ticker,
                candles: candlesWithTimestamp,
            },
        });

    } catch (error) {
        console.error('[API] Error:', error);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}
