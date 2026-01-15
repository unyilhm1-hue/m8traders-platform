
const fs = require('fs');
const path = require('path');

const filePath = 'public/simulation-data/ASII_full_30days.json';
const rawData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

console.log(`Total records: ${rawData.length}`);

// Filter for 2025-12-18
// Time format: "2025-12-18 02:00:00"
const targetDate = "2025-12-18";
const dayCandles = rawData.filter(c => c.time.startsWith(targetDate));

console.log(`Records for ${targetDate}: ${dayCandles.length}`);

if (dayCandles.length === 0) {
    console.log("No candles found!");
    process.exit(1);
}

// Convert to timestamps
const timestamps = dayCandles.map(c => {
    // "2025-12-18 02:00:00" -> UTC
    return new Date(c.time.replace(' ', 'T') + 'Z').getTime();
});

timestamps.sort((a, b) => a - b);

// Check gaps
let maxGap = 0;
let gapStart = 0;

for (let i = 1; i < timestamps.length; i++) {
    const diff = timestamps[i] - timestamps[i - 1];
    const diffMinutes = diff / 60000;

    if (diffMinutes > 1) {
        console.log(`Gap detected: ${new Date(timestamps[i - 1]).toISOString()} -> ${new Date(timestamps[i]).toISOString()} (${diffMinutes} mins)`);
        if (diffMinutes > maxGap) {
            maxGap = diffMinutes;
            gapStart = timestamps[i - 1];
        }
    }
}

console.log(`Max gap: ${maxGap} minutes`);
if (maxGap > 60) {
    console.log("⚠️ LARGE GAP DETECTED!");
} else {
    console.log("✅ Data continuity OK");
}
