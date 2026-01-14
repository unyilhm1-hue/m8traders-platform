import type { Candle } from '@/types';

/**
 * Price path anchor point untuk interpolation
 */
interface PriceAnchor {
    tick: number;
    price: number;
}

/**
 * Generate realistic price path untuk 1 candle
 * Menggunakan constrained random walk O→H→L→C
 *
 * @param candle - OHLCV candle data
 * @param numTicks - Number of ticks per candle (default 20)
 * @returns Array of prices for each tick
 */
export function generatePricePath(candle: Candle, numTicks = 20): number[] {
    const { o, h, l, c } = candle;

    // Edge case: no price movement
    if (h === l) {
        return Array(numTicks).fill(c);
    }

    // 1. Analyze candle characteristics
    const isBullish = c > o;
    const range = h - l;
    const bodySize = Math.abs(c - o);
    const bodyPercent = range > 0 ? bodySize / range : 0;
    const isChoppy = bodyPercent < 0.3; // small body relative to range

    // 2. Determine price path pattern
    let anchors: PriceAnchor[];

    if (isBullish && !isChoppy) {
        // Bullish pattern: O → H → pullback to L → C
        const highTick = Math.floor(numTicks * 0.35); // reach high early
        const lowTick = Math.floor(numTicks * 0.65); // pullback

        anchors = [
            { tick: 0, price: o },
            { tick: highTick, price: h },
            { tick: lowTick, price: l },
            { tick: numTicks - 1, price: c },
        ];
    } else if (!isBullish && !isChoppy) {
        // Bearish pattern: O → L → bounce to H → C
        const lowTick = Math.floor(numTicks * 0.35);
        const highTick = Math.floor(numTicks * 0.65);

        anchors = [
            { tick: 0, price: o },
            { tick: lowTick, price: l },
            { tick: highTick, price: h },
            { tick: numTicks - 1, price: c },
        ];
    } else {
        // Choppy/doji: random sequence touching H & L
        const firstExtreme = Math.random() > 0.5 ? h : l;
        const secondExtreme = firstExtreme === h ? l : h;

        anchors = [
            { tick: 0, price: o },
            { tick: Math.floor(numTicks * 0.25), price: firstExtreme },
            { tick: Math.floor(numTicks * 0.5), price: (h + l) / 2 },
            { tick: Math.floor(numTicks * 0.75), price: secondExtreme },
            { tick: numTicks - 1, price: c },
        ];
    }

    // 3. Interpolate between anchors dengan noise
    const path: number[] = [];

    for (let i = 0; i < numTicks; i++) {
        // Find surrounding anchor points
        const before = anchors.filter((a) => a.tick <= i).pop();
        const after = anchors.find((a) => a.tick > i);

        if (!before || !after) {
            // Last tick atau edge case
            path.push(i === numTicks - 1 ? c : o);
            continue;
        }

        // Linear interpolation
        const progress = (i - before.tick) / (after.tick - before.tick);
        const basePrice = before.price + (after.price - before.price) * progress;

        // Add gaussian noise (±0.3% of range untuk smoothness)
        const noiseAmplitude = range * 0.003;
        const noise = (Math.random() - 0.5) * 2 * noiseAmplitude;
        let price = basePrice + noise;

        // Clamp to H/L bounds
        price = Math.max(l, Math.min(h, price));

        path.push(price);
    }

    // Ensure critical constraints
    path[0] = o; // start at open
    path[numTicks - 1] = c; // end at close

    // Ensure H and L are touched at least once
    if (!path.some((p) => Math.abs(p - h) < range * 0.001)) {
        // Force high touch at appropriate position
        const highIdx = isBullish
            ? Math.floor(numTicks * 0.35)
            : Math.floor(numTicks * 0.65);
        path[highIdx] = h;
    }

    if (!path.some((p) => Math.abs(p - l) < range * 0.001)) {
        // Force low touch
        const lowIdx = isBullish
            ? Math.floor(numTicks * 0.65)
            : Math.floor(numTicks * 0.35);
        path[lowIdx] = l;
    }

    return path;
}

/**
 * Distribute candle volume across ticks
 *
 * @param totalVolume - Total candle volume
 * @param numTicks - Number of ticks
 * @returns Array of volume for each tick
 */
export function distributeVolume(totalVolume: number, numTicks = 20): number[] {
    if (totalVolume === 0) {
        return Array(numTicks).fill(0);
    }

    const baseVolume = totalVolume / numTicks;

    // Add variance (±30%) untuk realism
    const volumes = Array.from({ length: numTicks }, () => {
        const variance = 0.7 + Math.random() * 0.6; // 0.7x - 1.3x
        return Math.floor(baseVolume * variance);
    });

    // Ensure sum equals total (adjust last tick for rounding errors)
    const currentSum = volumes.reduce((sum, v) => sum + v, 0);
    const diff = totalVolume - currentSum;
    volumes[numTicks - 1] += diff;

    return volumes;
}
