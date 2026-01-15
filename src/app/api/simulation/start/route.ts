import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const dataDir = path.join(process.cwd(), 'public', 'simulation-data');

        if (!fs.existsSync(dataDir)) {
            return NextResponse.json({ error: 'Dir not found' }, { status: 404 });
        }

        const files = fs.readdirSync(dataDir).filter((file) => file.endsWith('.json'));
        if (files.length === 0) {
            return NextResponse.json({ error: 'No files' }, { status: 404 });
        }

        // --- PAKSA FILE YANG BENAR (HARDCODE UNTUK DEBUG) ---
        // Agar tidak terpilih file tahun 2016
        const targetFile = 'ASII_full_30days.json';
        const randomFile = files.includes(targetFile) ? targetFile : files[0];

        const filePath = path.join(dataDir, randomFile);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const rawData = JSON.parse(fileContent);

        // Ambil ticker dari nama file
        const ticker = randomFile.split('_')[0] || 'UNKNOWN';

        // ✅ Extract date from filename (for HH:MM-only format support)
        // Format: "TICKER_YYYY-MM-DD.json" or "TICKER_full_30days.json"
        const filenameParts = randomFile.replace('.json', '').split('_');
        const dateFromFilename = filenameParts.length >= 2 && filenameParts[1].match(/^\d{4}-\d{2}-\d{2}$/)
            ? filenameParts[1]
            : null;

        // --- DATA PROCESSING WITH FORMAT DETECTION ---
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
                } else {
                    // No date in filename - cannot parse reliably
                    console.warn(`[API] Time-only format "${candle.time}" but no date in filename "${randomFile}"`);
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
                    t: Date.now() + (index * 60000),
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
