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

        // --- DATA PROCESSING YANG BENAR ---
        const candlesWithTimestamp = rawData.map((candle: any, index: number) => {
            // FIX TIMEZONE DI SINI:
            // Data JSON "02:00" adalah UTC. Tambahkan 'Z' agar dibaca sebagai UTC.
            // Ganti spasi dengan 'T' agar format ISO valid (YYYY-MM-DDTHH:mm:ssZ)
            const timeString = candle.time.replace(' ', 'T') + 'Z';

            const timestamp = new Date(timeString).getTime();

            // Validasi Timestamp
            if (isNaN(timestamp)) {
                // Fallback jika format error
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
                t: timestamp, // Ini sekarang adalah Timestamp UTC yang BENAR
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
