/**
 * Detailed Debug - Check exact bucketing behavior
 */

// Scenario: 60 candles @ 1min should create 12 buckets @ 5min
const intervalMinutes = 5;
const intervalMs = intervalMinutes * 60 * 1000; // 300000ms = 5 minutes

console.log('=== Bucketing Analysis ===\n');
console.log('Interval:', intervalMinutes, 'minutes =', intervalMs, 'ms\n');

// Generate timestamps like test does
for (let i = 0; i < 60; i++) {
    const timestamp = (i + 1) * 60000; // 1min, 2min, ..., 60min
    const bucketKey = Math.floor(timestamp / intervalMs) * intervalMs;
    const bucketIndex = bucketKey / intervalMs;

    if (i < 10 || i >= 55) { // Show first 10 and last 5
        console.log(`Candle ${i + 1}: time=${timestamp}ms, bucket=${bucketKey}ms, bucketIndex=${bucketIndex}`);
    }

    if (i === 10) {
        console.log('... (candles 11-55 omitted) ...');
    }
}

// Now count unique buckets
const uniqueBuckets = new Set();
for (let i = 0; i < 60; i++) {
    const timestamp = (i + 1) * 60000;
    const bucketKey = Math.floor(timestamp / intervalMs) * intervalMs;
    uniqueBuckets.add(bucketKey);
}

console.log('\n=== RESULT ===');
console.log('Total unique buckets:', uniqueBuckets.size);
console.log('Expected buckets:', 12);
console.log('Difference:', uniqueBuckets.size - 12);
console.log('\nUnique bucket keys:', Array.from(uniqueBuckets));
