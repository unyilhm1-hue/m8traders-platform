/**
 * API Route: Load Simulation Data with Smart Buffering
 * GET /api/simulation/load?ticker=ADRO&date=2026-01-15&interval=5m
 * 
 * Returns historyBuffer (200 candles back) + simulationQueue (target date)
 */

import { NextRequest, NextResponse } from 'next/server';
import { loadWithSmartBuffering } from '@/utils/smartLoader';
import type { IntervalType } from '@/types/intervals';
import { INTERVALS } from '@/types/intervals';
import { networkLog } from '@/utils/structuredLogger';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        const ticker = searchParams.get('ticker');
        const date = searchParams.get('date');
        const interval = searchParams.get('interval');
        const warmupCount = searchParams.get('warmup') || '200';

        // Validation
        if (!ticker || !date || !interval) {
            networkLog.error('Missing required parameters', {
                status: 400,
                statusText: 'Bad Request',
                url: request.url
            });
            return NextResponse.json(
                {
                    success: false,
                    error: 'Missing required parameters: ticker, date, interval'
                },
                { status: 400 }
            );
        }

        // Validate interval
        if (!INTERVALS.includes(interval as IntervalType)) {
            networkLog.error('Invalid interval parameter', {
                status: 400,
                interval,
                validIntervals: INTERVALS
            });
            return NextResponse.json(
                {
                    success: false,
                    error: `Invalid interval: ${interval}. Valid: ${INTERVALS.join(', ')}`
                },
                { status: 400 }
            );
        }

        // Validate date format (YYYY-MM-DD)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(date)) {
            networkLog.error('Invalid date format', {
                status: 400,
                date
            });
            return NextResponse.json(
                {
                    success: false,
                    error: 'Invalid date format. Expected: YYYY-MM-DD'
                },
                { status: 400 }
            );
        }

        networkLog.info('Loading simulation data', { ticker, date, interval, warmupCount });

        // Load data with smart buffering
        const data = await loadWithSmartBuffering(
            ticker,
            date,
            interval as IntervalType,
            parseInt(warmupCount, 10)
        );

        if (!data) {
            networkLog.error('No data found', {
                status: 404,
                ticker,
                date,
                interval
            });
            return NextResponse.json(
                {
                    success: false,
                    error: `No data found for ${ticker} on ${date} at interval ${interval}`
                },
                { status: 404 }
            );
        }

        networkLog.info('📦 Data loaded successfully', {
            ticker: data.ticker,
            historyCount: data.historyBuffer.length,
            simCount: data.simulationQueue.length,
            totalCandles: data.totalCandles
        });

        return NextResponse.json({
            success: true,
            data: {
                ticker: data.ticker,
                date: data.date,
                interval: data.interval,
                sourceInterval: data.sourceInterval,
                wasAggregated: data.wasAggregated,

                // History buffer (for warm-up)
                historyBuffer: data.historyBuffer,
                historyCount: data.historyBuffer.length,

                // Simulation queue (to animate)
                simulationQueue: data.simulationQueue,
                simulationCount: data.simulationQueue.length,

                totalCandles: data.totalCandles
            }
        });

    } catch (error) {
        networkLog.critical('Load simulation API crashed', error);

        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            },
            { status: 500 }
        );
    }
}
