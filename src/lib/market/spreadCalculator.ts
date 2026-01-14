import { getTickSize, getMinimumSpread } from './idxTickSize';

export interface SpreadConfig {
    price: number;
    volume: number;
    atr: number; // Average True Range
    timestamp: number; // untuk time-of-day logic
    baseSpreadTicks?: number; // default = 2.5
}

/**
 * Hitung volatility multiplier dari ATR
 * High volatility → spread melebar
 */
export function getVolatilityMultiplier(price: number, atr: number): number {
    const atrPercent = (atr / price) * 100;

    // Scale: ATR 0-5% → multiplier 1.0-2.5
    return 1 + Math.min(atrPercent / 10, 1.5);
}

/**
 * Hitung liquidity multiplier dari volume
 * Low volume → spread melebar
 */
export function getLiquidityMultiplier(volume: number): number {
    // Normalize volume (asumsi: avg daily volume ~1-10 juta shares)
    // Log scale agar tidak terlalu ekstrim
    const normalizedVolume = Math.max(volume, 1000); // avoid log(0)
    const liquidityFactor = Math.log10(normalizedVolume / 1000) / 3;

    // Inverse: low volume = high multiplier
    return 1 / Math.max(liquidityFactor, 0.5);
}

/**
 * Hitung time-of-day multiplier
 * Opening/Closing → spread lebih lebar
 */
export function getTimeOfDayMultiplier(timestamp: number): number {
    const date = new Date(timestamp);
    const hour = date.getHours();
    const minute = date.getMinutes();
    const totalMinutes = hour * 60 + minute;

    // IDX trading hours: 09:00 - 16:00 (WIB)
    const marketOpen = 9 * 60; // 09:00
    const marketClose = 16 * 60; // 16:00
    const openingEnd = 9 * 60 + 30; // 09:30
    const closingStart = 15 * 60 + 30; // 15:30

    // Before market open or after close
    if (totalMinutes < marketOpen || totalMinutes >= marketClose) {
        return 3.0; // Wide spread (pre/post market)
    }

    // Opening period (09:00-09:30)
    if (totalMinutes < openingEnd) {
        return 2.0;
    }

    // Closing period (15:30-16:00)
    if (totalMinutes >= closingStart) {
        return 1.8;
    }

    // Regular trading hours
    return 1.0;
}

/**
 * Calculate dynamic spread (main function)
 */
export function calculateSpread(config: SpreadConfig): number {
    const { price, volume, atr, timestamp, baseSpreadTicks = 2.5 } = config;

    const tickSize = getTickSize(price);
    const minimumSpread = getMinimumSpread(price);

    // Calculate multipliers
    const volMultiplier = getVolatilityMultiplier(price, atr);
    const liqMultiplier = getLiquidityMultiplier(volume);
    const todMultiplier = getTimeOfDayMultiplier(timestamp);

    // Base spread in price units
    const baseSpread = baseSpreadTicks * tickSize;

    // Apply multipliers
    const dynamicSpread =
        baseSpread * volMultiplier * liqMultiplier * todMultiplier;

    // Ensure minimum constraint
    const finalSpread = Math.max(dynamicSpread, minimumSpread);

    // Round to tick
    return Math.round(finalSpread / tickSize) * tickSize;
}
