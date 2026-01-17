/**
 * DEBUG API: Expose scanDataDirectory output for debugging
 * GET /api/simulation/debug-index
 */

import { NextResponse } from 'next/server';
import { scanDataDirectory, getAvailableIntervals, findBestSourceInterval } from '@/utils/dataAvailability';

export async function GET() {
    try {
        const index = await scanDataDirectory();

        // Test specific case: ADRO on 2026-01-14
        const adroIntervals = await getAvailableIntervals('ADRO', '2026-01-14');
        const adroBestSource = await findBestSourceInterval('ADRO', '2026-01-14', '1m');

        return NextResponse.json({
            success: true,
            fullIndex: index,
            test: {
                ticker: 'ADRO',
                date: '2026-01-14',
                availableIntervals: adroIntervals,
                bestSourceInterval: adroBestSource,
                adroIndexData: index['ADRO']
            }
        });
    } catch (error) {
        console.error('[DEBUG] Error scanning:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
