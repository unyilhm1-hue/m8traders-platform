import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2'; // v3: default export is the class
import type { Candle } from '@/types';

// v3 requires instantiation (per UPGRADING.md)
const yahooFinance = new YahooFinance();

/**
 * Yahoo Finance supported intervals
 */
type YahooInterval = '1m' | '2m' | '5m' | '15m' | '30m' | '60m' | '90m' | '1h' | '1d' | '5d' | '1wk' | '1mo' | '3mo';

interface RouteParams {
    params: Promise<{
        ticker: string;
    }>;
}

/**
 * GET /api/stocks/[ticker]
 * Fetch real historical stock data from Yahoo Finance
 * 
 * Query params:
 * - timeframe: '1m' | '5m' | '15m' | '30m' | '1h' | '1d' | '1w'
 * - limit: number of candles to fetch (default: 200)
 */
export async function GET(request: NextRequest, context: RouteParams) {
    const { ticker } = await context.params;
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') || '5m';
    const interval = searchParams.get('interval') || timeframe; // Support both params
    const limit = parseInt(searchParams.get('limit') || '200');

    // Support custom date range for batch download
    const period1Param = searchParams.get('period1');
    const period2Param = searchParams.get('period2');

    try {
        // Convert ticker format for IDX stocks
        // BBRI → BBRI.JK, BBCA → BBCA.JK
        const yahooTicker = ticker.includes('.JK') ? ticker : `${ticker}.JK`;

        let period1: Date;
        let period2: Date;
        let yahooInterval: YahooInterval;

        // If custom period provided (batch download), use it
        if (period1Param && period2Param) {
            period1 = new Date(period1Param);
            period2 = new Date(period2Param);
            yahooInterval = mapTimeframeToInterval(interval);

            console.log(`[API] Batch download: ${yahooTicker} ${interval} from ${period1.toISOString()} to ${period2.toISOString()}`);
        } else {
            // Default: Use requested interval
            yahooInterval = mapTimeframeToInterval(interval);

            const now = new Date();

            // Adjust period based on timeframe
            // Intraday data: Yahoo limits to 7 days for 1m-30m, 60 days for 1h
            // Daily+ data: Use 1 year
            if (['1m', '5m', '15m', '30m'].includes(interval)) {
                // 7 days for minute-level data
                period1 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                console.log(`[API] Default fetch: ${yahooTicker} ${yahooInterval} (7 days)`);
            } else if (interval === '1h') {
                // 60 days for hourly
                period1 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
                console.log(`[API] Default fetch: ${yahooTicker} ${yahooInterval} (60 days)`);
            } else {
                // 1 year for daily+
                const oneYearAgo = new Date(now);
                oneYearAgo.setFullYear(now.getFullYear() - 1);
                period1 = oneYearAgo;
                console.log(`[API] Default fetch: ${yahooTicker} ${yahooInterval} (1 year)`);
            }

            period2 = now;
        }

        // Fetch from Yahoo Finance
        const result: any = await yahooFinance.chart(yahooTicker, {
            period1,
            period2,
            interval: yahooInterval,
        }, { validateResult: false }); // Disable strict validation

        if (!result.quotes || result.quotes.length === 0) {
            console.warn(`[API] No data returned for ${yahooTicker}`);
            return NextResponse.json(
                { error: 'No data available for this ticker' },
                { status: 404 }
            );
        }

        // Convert Yahoo Finance format to our Candle format
        const candles: Candle[] = result.quotes
            .filter((quote: any) =>
                quote.date &&
                quote.open !== null &&
                quote.high !== null &&
                quote.low !== null &&
                quote.close !== null
            )
            .map((quote: any) => ({
                t: new Date(quote.date!).getTime(),
                o: quote.open!,
                h: quote.high!,
                l: quote.low!,
                c: quote.close!,
                v: quote.volume || 0,
            }))
            .slice(-limit); // Return last 'limit' candles

        console.log(`[API] Successfully fetched ${candles.length} candles for ${yahooTicker} (from ${result.quotes.length} total)`);

        return NextResponse.json({
            ticker: yahooTicker,
            timeframe: yahooInterval === '1d' ? '1d' : interval,
            interval: yahooInterval,
            originalTimeframe: timeframe,
            data: candles,
            meta: {
                currency: result.meta.currency,
                symbol: result.meta.symbol,
                exchangeName: result.meta.exchangeName,
                dataType: yahooInterval === '1d' ? 'daily' : 'intraday',
                period: period1Param && period2Param ? 'custom' : '1y',
            },
        });
    } catch (error: any) {
        console.error(`[API] Error fetching ${ticker}:`, error.message);

        // Return 404 to trigger fallback to generated data
        return NextResponse.json(
            {
                error: 'Failed to fetch stock data',
                message: error.message,
                ticker,
            },
            { status: 404 }
        );
    }
}

/**
 * Map our timeframe to Yahoo Finance interval
 */
function mapTimeframeToInterval(timeframe: string): YahooInterval {
    const map: Record<string, YahooInterval> = {
        '1m': '1m',
        '5m': '5m',
        '15m': '15m',
        '30m': '30m',
        '1h': '1h',
        '4h': '1h', // Yahoo doesn't have 4h, use 1h
        '1d': '1d',
        '1w': '1wk',
    } as const satisfies Record<string, YahooInterval>;
    return map[timeframe] || '5m';
}

/**
 * Calculate start date based on timeframe and limit
 */
function getPeriodStart(timeframe: string, limit: number): Date {
    const now = new Date();
    const minutes = getTimeframeMinutes(timeframe) * limit;

    // Add buffer for weekends and market closed hours
    const bufferMultiplier = timeframe === '1m' || timeframe === '5m' ? 2.5 : 1.5;
    const adjustedMinutes = minutes * bufferMultiplier;

    return new Date(now.getTime() - adjustedMinutes * 60 * 1000);
}

/**
 * Get timeframe duration in minutes
 */
function getTimeframeMinutes(timeframe: string): number {
    const minutes: Record<string, number> = {
        '1m': 1,
        '5m': 5,
        '15m': 15,
        '30m': 30,
        '1h': 60,
        '4h': 240,
        '1d': 1440,
        '1w': 10080,
    };
    return minutes[timeframe] || 5;
}
