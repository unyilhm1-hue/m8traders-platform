/**
 * JumpToControls Component
 * Quick navigation to specific market session times
 */
'use client';

import { useChartStore } from '@/stores';
import { UI_ICONS } from '@/lib/chart/icons';

type MarketSession = 'pre-market' | 'open' | 'lunch' | 'session-2' | 'close';

interface SessionTime {
    label: string;
    hour: number;
    minute: number;
    icon: string;
}

// IDX market times (WIB/GMT+7)
const IDX_SESSIONS: Record<MarketSession, SessionTime> = {
    'pre-market': { label: 'Pre-Market', hour: 8, minute: 45, icon: '🌅' },
    'open': { label: 'Open', hour: 9, minute: 0, icon: '🔔' },
    'lunch': { label: 'Lunch', hour: 12, minute: 0, icon: '🍱' },
    'session-2': { label: 'Session 2', hour: 13, minute: 30, icon: '📈' },
    'close': { label: 'Close', hour: 16, minute: 0, icon: '🔕' },
};

export function JumpToControls() {
    const { replayMode, replayData, setReplayIndex } = useChartStore();
    const { Sunrise, Bell, Sun, Activity, Flag } = UI_ICONS;

    const isReplayActive = replayMode !== 'live';

    /**
     * Find the closest candle index for a specific time of day
     * Uses the FIRST candle's date as base date (not today)
     */
    const jumpToTime = (hour: number, minute: number) => {
        if (!replayData.length) return;

        // Use first candle's date as base
        const firstCandleDate = new Date(replayData[0].t);
        const targetTime = new Date(firstCandleDate);
        targetTime.setHours(hour, minute, 0, 0);
        const targetTimestamp = targetTime.getTime();

        // Find closest candle by timestamp
        let closestIdx = 0;
        let closestDiff = Math.abs(replayData[0].t - targetTimestamp);

        for (let i = 1; i < replayData.length; i++) {
            const diff = Math.abs(replayData[i].t - targetTimestamp);
            if (diff < closestDiff) {
                closestDiff = diff;
                closestIdx = i;
            }
        }

        setReplayIndex(closestIdx);
    };

    const sessions: MarketSession[] = ['pre-market', 'open', 'lunch', 'session-2', 'close'];

    // Map sessions to icons
    const getSessionIcon = (session: MarketSession) => {
        switch (session) {
            case 'pre-market': return <Sunrise size={14} />;
            case 'open': return <Bell size={14} />;
            case 'lunch': return <Sun size={14} />;
            case 'session-2': return <Activity size={14} />;
            case 'close': return <Flag size={14} />;
        }
    };

    if (!isReplayActive) {
        return null;
    }

    return (
        <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-secondary)] font-medium hidden 2xl:block">Jump to:</span>
            <div className="flex items-center gap-1 bg-[var(--bg-tertiary)] p-0.5 rounded-lg border border-[var(--bg-subtle-border)]">
                {sessions.map((session) => {
                    const sessionInfo = IDX_SESSIONS[session];
                    return (
                        <button
                            key={session}
                            onClick={() => jumpToTime(sessionInfo.hour, sessionInfo.minute)}
                            className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] whitespace-nowrap font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all relative group"
                            title={`${sessionInfo.label} (${String(sessionInfo.hour).padStart(2, '0')}:${String(sessionInfo.minute).padStart(2, '0')} WIB)`}
                        >
                            {getSessionIcon(session)}
                            <span>{sessionInfo.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
