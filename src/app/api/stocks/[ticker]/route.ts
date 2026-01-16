import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2'; // v3: default export is the class
import type { Candle } from '@/types';
import {
    getIntervalConfig,
    calculatePeriodStart,
    mapToYahooInterval,
    type YahooInterval
} from '@/config/dataProviders';

// v3 requires instantiation (per UPGRADING.md)
const yahooFinance = new YahooFinance();

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
            yahooInterval = mapToYahooInterval(interval);

            console.log(`[API] Batch download: ${yahooTicker} ${interval} from ${period1.toISOString()} to ${period2.toISOString()}`);
        } else {
            // ✅ CONFIG-DRIVEN: Get interval config from centralized config
            const intervalConfig = getIntervalConfig(interval);
            yahooInterval = intervalConfig.yahooInterval;

            // Calculate period1 using config's safeDays (not hardcoded magic numbers)
            period1 = calculatePeriodStart(interval, true); // true = use safeDays
            period2 = new Date();

            console.log(`[API] Config-driven fetch: ${yahooTicker} ${yahooInterval} (${intervalConfig.safeDays} days - ${intervalConfig.description})`);
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
            .map((quote: any) => {
                // ✅ DATA SANITIZATION: Swap high/low if invalid
                let high = quote.high!;
                let low = quote.low!;
                if (high < low) {
                    [high, low] = [low, high];
                }

                return {
                    t: new Date(quote.date!).getTime(),
                    o: quote.open!,
                    h: high,
                    l: low,
                    c: quote.close!,
                    v: quote.volume || 0,
                };
            })
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

// ============================================================================
// NOTE: Helper functions mapTimeframeToInterval, getPeriodStart, getTimeframeMinutes
// have been moved to src/config/dataProviders.ts for centralized configuration.
// Use: mapToYahooInterval(), calculatePeriodStart(), getIntervalMs() from config.
// ============================================================================

