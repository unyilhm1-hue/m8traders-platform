/**
 * MarketTimeSelector Component
 * Toggle between Regular Hours, Extended Hours, and 24 Hours market data
 */
'use client';

import { useState } from 'react';
import { UI_ICONS } from '@/lib/chart/icons';

export type MarketTimeMode = 'regular' | 'extended' | '24h';

interface MarketTimeModeInfo {
    label: string;
    description: string;
    hours: string;
}

const MARKET_TIME_MODES: Record<MarketTimeMode, MarketTimeModeInfo> = {
    regular: {
        label: 'Regular Hours',
        description: 'Standard market hours',
        hours: '9:30 AM - 4:00 PM',
    },
    extended: {
        label: 'Extended Hours',
        description: 'Pre-market + Regular + After-hours',
        hours: '4:00 AM - 8:00 PM',
    },
    '24h': {
        label: '24 Hours',
        description: 'Around-the-clock data',
        hours: 'UTC',
    },
};

interface MarketTimeSelectorProps {
    value?: MarketTimeMode;
    onChange?: (mode: MarketTimeMode) => void;
}

export function MarketTimeSelector({ value = 'regular', onChange }: MarketTimeSelectorProps) {
    const [selectedMode, setSelectedMode] = useState<MarketTimeMode>(value);
    const { Time } = UI_ICONS;

    const handleModeChange = (mode: MarketTimeMode) => {
        setSelectedMode(mode);
        onChange?.(mode);
    };

    const modes: { id: MarketTimeMode; label: string }[] = [
        { id: 'regular', label: 'RTH' },
        { id: 'extended', label: 'EXT' },
        { id: '24h', label: '24H' }
    ];

    return (
        <div className="flex items-center gap-2 bg-[var(--bg-tertiary)] p-0.5 rounded-lg border border-[var(--bg-subtle-border)]">
            <div className="px-1.5 text-[var(--text-tertiary)]" title="Market Time">
                <Time size={14} />
            </div>
            <div className="flex items-center">
                {modes.map((mode) => {
                    const modeInfo = MARKET_TIME_MODES[mode.id];
                    const isSelected = selectedMode === mode.id;

                    return (
                        <button
                            key={mode.id}
                            onClick={() => handleModeChange(mode.id)}
                            className={`px-2 py-1 text-[10px] font-bold rounded transition-all ${isSelected
                                ? 'bg-[var(--bg-secondary)] text-[var(--accent-primary)] shadow-sm'
                                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]/50'
                                }`}
                            title={`${modeInfo.description} (${modeInfo.hours})`}
                        >
                            {mode.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
