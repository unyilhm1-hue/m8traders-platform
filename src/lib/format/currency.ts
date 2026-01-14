import { roundToTick } from '@/lib/market/idxTickSize';

/**
 * Currency formatter for Indonesian Rupiah (IDR)
 * Platform is focused on IDX stocks only
 */

// IDR (Indonesian Rupiah) formatter - no decimal places by default
const idrFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
});

// IDR formatter with 2 decimal places for precise values
const idrFormatterPrecise = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

/**
 * Format a price value as IDR with optional tick size rounding
 * @param value - Price value to format
 * @param options - Formatting options
 * @returns Formatted currency string (e.g., "Rp3.200")
 */
export function formatIDR(
    value: number,
    options: {
        /** Apply IDX tick size rounding before formatting */
        roundToTickSize?: boolean;
        /** Show 2 decimal places (for spreads, percentages) */
        precise?: boolean;
        /** Remove currency symbol, just show number */
        stripSymbol?: boolean;
    } = {}
): string {
    const { roundToTickSize = false, precise = false, stripSymbol = false } = options;

    // Apply tick size rounding if requested
    const rounded = roundToTickSize ? roundToTick(value) : value;

    // Format with appropriate formatter
    const formatter = precise ? idrFormatterPrecise : idrFormatter;
    let formatted = formatter.format(rounded);

    // Strip "Rp" symbol if requested
    if (stripSymbol) {
        formatted = formatted.replace(/Rp\s?/, '').trim();
    }

    return formatted;
}

/**
 * Format a price value (alias for formatIDR for consistency)
 * Platform only supports IDX stocks, so always uses IDR
 * @param value - Price value to format
 * @param _ticker - Ignored, kept for API compatibility
 * @param options - Formatting options
 * @returns Formatted currency string
 */
export function formatPrice(
    value: number,
    _ticker?: string,
    options: {
        roundToTickSize?: boolean;
        precise?: boolean;
        stripSymbol?: boolean;
    } = {}
): string {
    return formatIDR(value, options);
}

/**
 * Format a percentage value
 * @param value - Percentage value (e.g., 0.025 for 2.5%)
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted percentage string (e.g., "+2.50%")
 */
export function formatPercent(value: number, decimals = 2): string {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format a large number with K/M/B suffixes
 * @param value - Number to format
 * @returns Formatted string (e.g., "1.2M", "450K")
 */
export function formatCompact(value: number): string {
    if (value >= 1_000_000_000) {
        return `${(value / 1_000_000_000).toFixed(1)}B`;
    } else if (value >= 1_000_000) {
        return `${(value / 1_000_000).toFixed(1)}M`;
    } else if (value >= 1_000) {
        return `${(value / 1_000).toFixed(1)}K`;
    }
    return value.toFixed(0);
}
