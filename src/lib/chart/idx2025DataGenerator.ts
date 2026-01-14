/**
 * IDX 2025 Data Generator
 * Generates realistic Jan-Dec 2025 trading data for Indonesian Stock Exchange
 */

import type { Candle, Timeframe } from '@/types';

interface IDXTickerProfile {
    basePrice: number;      // Starting price Jan 1, 2025
    volatility: number;     // Daily movement % (0.02 = 2%)
    trend: 'bullish' | 'bearish' | 'neutral';
    volumeProfile: number;  // Average daily volume
    sector: string;
}

const TICKER_PROFILES: Record<string, IDXTickerProfile> = {
    'BBCA': {
        basePrice: 9000,
        volatility: 0.02,
        trend: 'bullish',
        volumeProfile: 50_000_000,
        sector: 'Banking'
    },
    'BBRI': {
        basePrice: 5200,
        volatility: 0.025,
        trend: 'neutral',
        volumeProfile: 80_000_000,
        sector: 'Banking'
    },
    'ASII': {
        basePrice: 5400,
        volatility: 0.018,
        trend: 'bullish',
        volumeProfile: 40_000_000,
        sector: 'Automotive'
    },
    'TLKM': {
        basePrice: 3200,
        volatility: 0.015,
        trend: 'neutral',
        volumeProfile: 60_000_000,
        sector: 'Telecom'
    },
    'UNVR': {
        basePrice: 42000,
        volatility: 0.012,
        trend: 'neutral',
        volumeProfile: 20_000_000,
        sector: 'Consumer Goods'
    },
};

const DEFAULT_PROFILE: IDXTickerProfile = {
    basePrice: 5000,
    volatility: 0.02,
    trend: 'neutral',
    volumeProfile: 30_000_000,
    sector: 'General'
};

/**
 * IDX 2025 Public Holidays (excluding weekends)
 */
const IDX_HOLIDAYS_2025 = [
    new Date('2025-01-01'), // New Year
    new Date('2025-02-12'), // Chinese New Year
    new Date('2025-03-31'), // Eid al-Fitr
    new Date('2025-04-01'), // Eid al-Fitr (2nd day)
    new Date('2025-05-01'), // Labor Day
    new Date('2025-05-29'), // Ascension Day
    new Date('2025-06-01'), // Pancasila Day
    new Date('2025-06-07'), // Eid al-Adha
    new Date('2025-08-17'), // Independence Day
    new Date('2025-12-25'), // Christmas
];

/**
 * Check if date is trading day (not weekend or holiday)
 */
function isTradingDay(date: Date): boolean {
    const day = date.getDay();

    // Weekend
    if (day === 0 || day === 6) return false;

    // Holiday
    const dateStr = date.toISOString().split('T')[0];
    return !IDX_HOLIDAYS_2025.some(holiday =>
        holiday.toISOString().split('T')[0] === dateStr
    );
}

/**
 * Get all trading days in 2025
 */
function getTradingDays2025(): Date[] {
    const tradingDays: Date[] = [];
    const startDate = new Date('2025-01-01');
    const endDate = new Date('2025-12-31');

    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
        if (isTradingDay(currentDate)) {
            tradingDays.push(new Date(currentDate));
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }

    return tradingDays;
}

/**
 * Generate intraday candles for a single trading day
 */
function generateIntradayCandles(
    date: Date,
    dayOpenPrice: number,
    profile: IDXTickerProfile,
    timeframe: Timeframe
): Candle[] {
    const candles: Candle[] = [];

    // IDX trading hours (WIB)
    const sessions = [
        { startHour: 9, startMin: 0, endHour: 12, endMin: 0 },    // Session 1
        { startHour: 13, startMin: 30, endHour: 16, endMin: 0 },  // Session 2
    ];

    // Adjust for Friday
    const isFriday = date.getDay() === 5;
    if (isFriday) {
        sessions[0].endHour = 11;
        sessions[0].endMin = 30;
        sessions[1].startHour = 14;
    }

    const timeframeMinutes = getTimeframeMinutes(timeframe);
    let currentPrice = dayOpenPrice;

    sessions.forEach(session => {
        let sessionTime = new Date(date);
        sessionTime.setHours(session.startHour, session.startMin, 0, 0);

        const sessionEndTime = new Date(date);
        sessionEndTime.setHours(session.endHour, session.endMin, 0, 0);

        while (sessionTime < sessionEndTime) {
            const { o, h, l, c, v } = generateCandle(
                currentPrice,
                profile,
                sessionTime.getHours()
            );

            candles.push({
                t: sessionTime.getTime(),
                o,
                h,
                l,
                c,
                v
            });

            currentPrice = c; // Next candle starts at previous close
            sessionTime = new Date(sessionTime.getTime() + timeframeMinutes * 60 * 1000);
        }
    });

    return candles;
}

/**
 * Generate single candle OHLCV
 */
function generateCandle(
    openPrice: number,
    profile: IDXTickerProfile,
    hour: number
): { o: number; h: number; l: number; c: number; v: number } {
    const o = openPrice;

    // Price movement based on volatility
    const maxMove = o * profile.volatility;
    const move = (Math.random() - 0.5) * 2 * maxMove;

    let c = o + move;

    // Trend bias
    if (profile.trend === 'bullish') {
        c = c + Math.abs(move) * 0.2; // Slight upward bias
    } else if (profile.trend === 'bearish') {
        c = c - Math.abs(move) * 0.2; // Slight downward bias
    }

    // High and Low
    const range = Math.abs(c - o) * (1 + Math.random() * 0.5);
    const h = Math.max(o, c) + range * Math.random();
    const l = Math.min(o, c) - range * Math.random();

    // Volume (higher at market open/close, lower during lunch)
    let volumeMultiplier = 1.0;
    if (hour === 9 || hour === 15) {
        volumeMultiplier = 1.5; // Higher at open/close
    } else if (hour === 11 || hour === 12) {
        volumeMultiplier = 0.7; // Lower before lunch
    }

    const v = Math.floor(
        profile.volumeProfile * volumeMultiplier * (0.5 + Math.random())
    );

    return { o, h, l, c, v };
}

/**
 * Get timeframe duration in minutes
 */
function getTimeframeMinutes(timeframe: Timeframe): number {
    const minutes: Record<Timeframe, number> = {
        '1m': 1,
        '5m': 5,
        '15m': 15,
        '30m': 30,
        '1h': 60,
        '4h': 240,
        '1d': 1440,
        '1w': 10080,
    };
    return minutes[timeframe];
}

/**
 * Main function: Generate IDX 2025 data for ticker
 */
export function generateIDX2025Data(
    ticker: string,
    timeframe: Timeframe = '5m'
): Candle[] {
    const profile = TICKER_PROFILES[ticker] || DEFAULT_PROFILE;
    const tradingDays = getTradingDays2025();

    let dayOpenPrice = profile.basePrice;
    const allCandles: Candle[] = [];

    tradingDays.forEach((day, dayIndex) => {
        // Apply trend over year
        const yearProgress = dayIndex / tradingDays.length;

        if (profile.trend === 'bullish') {
            dayOpenPrice = profile.basePrice * (1 + yearProgress * 0.3); // +30% over year
        } else if (profile.trend === 'bearish') {
            dayOpenPrice = profile.basePrice * (1 - yearProgress * 0.2); // -20% over year
        } else {
            // Neutral: random walk
            const dailyMove = (Math.random() - 0.5) * 2 * profile.volatility;
            dayOpenPrice = dayOpenPrice * (1 + dailyMove);
        }

        const dayCandles = generateIntradayCandles(day, dayOpenPrice, profile, timeframe);
        allCandles.push(...dayCandles);

        // Update day open for next day (close of last candle)
        if (dayCandles.length > 0) {
            dayOpenPrice = dayCandles[dayCandles.length - 1].c;
        }
    });

    console.log(`[IDX2025] Generated ${allCandles.length} candles for ${ticker} (${tradingDays.length} trading days)`);

    return allCandles;
}

/**
 * Check if ticker is IDX ticker
 */
export function isIDXTicker(symbol: string): boolean {
    return symbol in TICKER_PROFILES;
}
