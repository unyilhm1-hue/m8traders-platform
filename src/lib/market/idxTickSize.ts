/**
 * IDX Tick Size Calculator (Regulasi 2024)
 * 
 * Tick size rules dari Keputusan Direksi PT BEI No. II-A Kep-00196/BEI/12-2024
 * Efektif: 9 Desember 2024
 * 
 * Price Fraction Scale:
 * - < Rp 200      → Rp 1
 * - Rp 200-500    → Rp 2
 * - Rp 500-2,000  → Rp 5
 * - Rp 2,000-5,000 → Rp 10
 * - ≥ Rp 5,000    → Rp 25
 */

/**
 * Menghitung tick size berdasarkan harga saham (IDX 2024 rules)
 */
export function getTickSize(price: number): number {
    if (price < 200) return 1;
    if (price < 500) return 2;
    if (price < 2000) return 5;
    if (price < 5000) return 10;
    return 25;
}

/**
 * Membulatkan harga ke tick terdekat
 */
export function roundToTick(price: number): number {
    const tick = getTickSize(price);
    return Math.round(price / tick) * tick;
}

/**
 * Menghitung minimum spread (= 1 tick sesuai IDX rules)
 */
export function getMinimumSpread(price: number): number {
    return getTickSize(price);
}

/**
 * Validate apakah harga valid (kelipatan tick)
 */
export function isValidPrice(price: number): boolean {
    const tick = getTickSize(price);
    return price % tick === 0;
}

/**
 * Hitung jumlah ticks antara dua harga
 */
export function getTickDistance(price1: number, price2: number): number {
    const avgPrice = (price1 + price2) / 2;
    const tick = getTickSize(avgPrice);
    return Math.abs(price2 - price1) / tick;
}

/**
 * Get price tier info (untuk debugging/display)
 */
export function getPriceTier(price: number): {
    tier: number;
    tickSize: number;
    range: string;
} {
    if (price < 200) {
        return { tier: 1, tickSize: 1, range: '< Rp 200' };
    }
    if (price < 500) {
        return { tier: 2, tickSize: 2, range: 'Rp 200-500' };
    }
    if (price < 2000) {
        return { tier: 3, tickSize: 5, range: 'Rp 500-2,000' };
    }
    if (price < 5000) {
        return { tier: 4, tickSize: 10, range: 'Rp 2,000-5,000' };
    }
    return { tier: 5, tickSize: 25, range: '≥ Rp 5,000' };
}
