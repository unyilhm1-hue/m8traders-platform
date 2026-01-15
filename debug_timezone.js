
const marketOpenHour = 9;
const marketCloseHour = 16;
const dateStr = "2025-12-18";

// Test Data: 02:00 UTC (09:00 WIB)
const t1 = new Date("2025-12-18T02:00:00Z").getTime();
// Test Data: 02:59 UTC (09:59 WIB)
const t2 = new Date("2025-12-18T02:59:00Z").getTime();
// Test Data: 03:00 UTC (10:00 WIB) -> User says this might be missing?
const t3 = new Date("2025-12-18T03:00:00Z").getTime();
// Test Data: 09:00 UTC (16:00 WIB)
const t4 = new Date("2025-12-18T09:00:00Z").getTime();
// Test Data: 10:00 UTC (17:00 WIB) -> Should be excluded
const t5 = new Date("2025-12-18T10:00:00Z").getTime();

const testCandles = [t1, t2, t3, t4, t5];

testCandles.forEach(ts => {
    const d = new Date(ts);

    // Logic from store
    const candleDateWIB = d.toLocaleDateString('en-CA', {
        timeZone: 'Asia/Jakarta'
    });

    const candleHourWIB = Number(d.toLocaleString('en-US', {
        hour: 'numeric',
        hour12: false,
        timeZone: 'Asia/Jakarta'
    }));

    const included = candleDateWIB === dateStr &&
        candleHourWIB >= marketOpenHour &&
        candleHourWIB <= marketCloseHour;

    console.log(`Time: ${d.toISOString()}`);
    console.log(`  WIB Date: ${candleDateWIB}`);
    console.log(`  WIB Hour: ${candleHourWIB}`);
    console.log(`  Included: ${included}`);
    console.log('---');
});
