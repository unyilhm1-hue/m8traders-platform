'use client';

import { getSessionInfo } from '@/lib/replay';

interface MarketSessionIndicatorProps {
    timestamp: number;
    className?: string;
}

export function MarketSessionIndicator({
    timestamp,
    className = '',
}: MarketSessionIndicatorProps) {
    const sessionInfo = getSessionInfo(timestamp);

    const sessionColors = {
        'pre-market': 'bg-gray-600 text-gray-300',
        'session-1': 'bg-green-600 text-white',
        lunch: 'bg-yellow-600 text-white',
        'session-2': 'bg-green-600 text-white',
        closed: 'bg-red-600 text-white',
    };

    const sessionLabels = {
        'pre-market': 'Pre-Market',
        'session-1': 'Session 1',
        lunch: 'Lunch Break',
        'session-2': 'Session 2',
        closed: 'Market Closed',
    };

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <div
                className={`px-2 py-1 rounded text-xs font-medium ${sessionColors[sessionInfo.session]}`}
            >
                {sessionInfo.isOpen ? '🟢' : '🔴'} {sessionLabels[sessionInfo.session]}
            </div>
            {!sessionInfo.isOpen && (
                <span className="text-xs text-gray-400">
                    Next open:{' '}
                    {new Date(sessionInfo.nextChange).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                    })}
                </span>
            )}
        </div>
    );
}
