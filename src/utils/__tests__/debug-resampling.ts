/**
 * Test Debug Script
 * Reproduce the exact test scenario to find root cause
 */

import { resampleCandles } from '../candleResampler';
import type { Candle } from '../candleResampler';

// Reproduce exact test scenario
const candles60m: Candle[] = Array.from({ length: 60 }, (_, i) => ({
    time: (i + 1) * 60000, // 1min, 2min, 3min, ..., 60min
    open: 100,
    high: 105,
    low: 95,
    close: 100,
    volume: 1000
}));

console.log('=== DEBUG: Resampling 60 x 1m candles to 5m ===\n');
console.log('Input candles:', candles60m.length);
console.log('First candle time:', candles60m[0].time, '(', new Date(candles60m[0].time).toISOString(), ')');
console.log('Last candle time:', candles60m[59].time, '(', new Date(candles60m[59].time).toISOString(), ')');
console.log('');

try {
    const resampled = resampleCandles(candles60m, '1m', '5m');

    console.log('Output candles:', resampled.length);
    console.log('Expected:', 12, '(60 / 5)');
    console.log('Actual:', resampled.length);
    console.log('Difference:', resampled.length - 12);
    console.log('');

    // Show each bucket
    console.log('Resampled candles:');
    resampled.forEach((candle, i) => {
        console.log(`  [${i}] time: ${candle.time} (${new Date(candle.time).toISOString()}), vol: ${candle.volume}`);
    });

} catch (error) {
    console.error('Error:', error);
}
