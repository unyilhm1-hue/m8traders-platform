/**
 * JumpToControls Component
 * Quick navigation to specific market session times
 */
'use client';

import { useChartStore } from '@/stores';
import { UI_ICONS } from '@/lib/chart/icons';
import { useMemo } from 'react';

type MarketSession = 'pre-market' | 'open' | 'noon' | 'close' | 'after-hours';

interface SessionTime {
    label: string;
    hour: number;
    minute: number;
    icon: string;
}

// Default US market times (Eastern Time)
const US_SESSIONS: Record<MarketSession, SessionTime> = {
    'pre-market': { label: 'Pre-Market', hour: 4, minute: 0, icon: '🌅' },
    'open': { label: 'Open', hour: 9, minute: 30, icon: '🔔' },
    'noon': { label: 'Noon', hour: 12, minute: 0, icon: '☀️' },
    'close': { label: 'Close', hour: 16, minute: 0, icon: '🔕' },
    'after-hours': { label: 'After Hours', hour: 16, minute: 1, icon: '🌙' },
};

export function JumpToControls() {
    const { replayMode, replayData, setReplayIndex } = useChartStore();
    const { Sunrise, Bell, Sun, Flag, Moon } = UI_ICONS;

    const isReplayActive = replayMode !== 'live';

    /**
     * Find the closest candle index for a specific time of day
     */
    const jumpToTime = (hour: number, minute: number) => {
        if (!replayData.length) return;

        const targetTime = new Date();
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

    const sessions: MarketSession[] = ['pre-market', 'open', 'noon', 'close', 'after-hours'];

    // Map sessions to icons
    const getSessionIcon = (session: MarketSession) => {
        switch (session) {
            case 'pre-market': return <Sunrise size={14} />;
            case 'open': return <Bell size={14} />;
            case 'noon': return <Sun size={14} />;
            case 'close': return <Flag size={14} />;
            case 'after-hours': return <Moon size={14} />;
        }
    };

    if (!isReplayActive) {
        return null;
    }

    return (
        <div className="flex items-center gap-0.5 bg-[var(--bg-tertiary)] p-0.5 rounded-lg border border-[var(--bg-subtle-border)]">
            {sessions.map((session) => {
                const sessionInfo = US_SESSIONS[session];
                return (
                    <button
                        key={session}
                        onClick={() => jumpToTime(sessionInfo.hour, sessionInfo.minute)}
                        className="w-7 h-7 flex items-center justify-center rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all relative group"
                        title={`${sessionInfo.label} (${String(sessionInfo.hour).padStart(2, '0')}:${String(sessionInfo.minute).padStart(2, '0')})`}
                    >
                        {getSessionIcon(session)}
                        {/* Tooltip */}
                        <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-[var(--bg-secondary)] border border-[var(--bg-subtle-border)] rounded text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-50">
                            {sessionInfo.label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
