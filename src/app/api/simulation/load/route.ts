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

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        const ticker = searchParams.get('ticker');
        const date = searchParams.get('date');
        const interval = searchParams.get('interval');
        const warmupCount = searchParams.get('warmup') || '200';

        // Validation
        if (!ticker || !date || !interval) {
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
            return NextResponse.json(
                {
                    success: false,
                    error: 'Invalid date format. Expected: YYYY-MM-DD'
                },
                { status: 400 }
            );
        }

        console.log(`[API] Loading ${ticker} ${date} at ${interval} with ${warmupCount} warmup`);

        // Load data with smart buffering
        const data = await loadWithSmartBuffering(
            ticker,
            date,
            interval as IntervalType,
            parseInt(warmupCount, 10)
        );

        if (!data) {
            return NextResponse.json(
                {
                    success: false,
                    error: `No data found for ${ticker} on ${date} at interval ${interval}`
                },
                { status: 404 }
            );
        }

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
        console.error('[API] Load simulation data error:', error);

        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            },
            { status: 500 }
        );
    }
}
