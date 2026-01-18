/**
 * Chart Data Sanitizer
 * ====================
 * Omnivorous data normalizer for lightweight-charts
 * 
 * Handles:
 * - Multiple key formats (time/t/timestamp, open/o, etc)
 * - String to Unix timestamp conversion
 * - Guaranteed ascending sort
 * - Duplicate removal
 * - Invalid data filtering
 */

export interface ChartDataPoint {
    time: number;  // Unix timestamp in seconds
    open: number;
    high: number;
    low: number;
    close: number;
    value?: number;  // Optional volume
}

/**
 * Sanitize raw data for lightweight-charts consumption
 * 
 * @param rawData - Array of candles in any format
 * @returns Clean, sorted, deduplicated array ready for chart
 */
export function sanitizeDataForChart(rawData: any[]): ChartDataPoint[] {
    if (!rawData || rawData.length === 0) return [];

    // TAHAP 1: NORMALISASI & MAPPING
    // Ubah semua variasi key menjadi format standar
    const mapped = rawData.map(d => {
        // Deteksi timestamp dari berbagai kemungkinan key
        const rawTime = d.time ?? d.t ?? d.timestamp;

        // Konversi ke Unix Timestamp (Seconds) jika masih String ISO
        let time: number;
        if (typeof rawTime === 'string') {
            time = Math.floor(new Date(rawTime).getTime() / 1000);
        } else if (typeof rawTime === 'number') {
            // Handle both seconds and milliseconds
            time = rawTime > 10_000_000_000 ? Math.floor(rawTime / 1000) : rawTime;
        } else {
            time = NaN; // Will be filtered out
        }

        return {
            time: time, // Wajib angka (Unix Seconds)
            open: Number(d.open ?? d.o),
            high: Number(d.high ?? d.h),
            low: Number(d.low ?? d.l),
            close: Number(d.close ?? d.c),
            value: Number(d.value ?? d.v ?? d.volume ?? 0),
        };
    });

    // Filter data sampah (time invalid)
    const validData = mapped.filter(d => !isNaN(d.time) && d.time > 0);

    if (validData.length === 0) {
        console.error('[Sanitizer] ❌ No valid data after filtering!');
        return [];
    }

    // TAHAP 2: SORTING ASCENDING (Wajib!)
    // Sekarang a.time pasti angka, jadi sort pasti berhasil
    validData.sort((a, b) => a.time - b.time);

    // TAHAP 3: DEDUPLIKASI (Hapus kembaran)
    const uniqueData: ChartDataPoint[] = [];
    if (validData.length > 0) {
        uniqueData.push(validData[0]);
        for (let i = 1; i < validData.length; i++) {
            // Hanya masukkan jika waktunya MAJU (strict ascending)
            if (validData[i].time > uniqueData[uniqueData.length - 1].time) {
                uniqueData.push(validData[i]);
            }
        }
    }

    console.log(`[Sanitizer] ✅ Raw: ${rawData.length} → Clean: ${uniqueData.length} (sorted & deduplicated)`);

    // Log sample untuk debugging
    if (uniqueData.length > 0) {
        console.log('[Sanitizer] 📊 Sample:', {
            first: { time: uniqueData[0].time, close: uniqueData[0].close },
            last: { time: uniqueData[uniqueData.length - 1].time, close: uniqueData[uniqueData.length - 1].close }
        });
    }

    return uniqueData;
}
