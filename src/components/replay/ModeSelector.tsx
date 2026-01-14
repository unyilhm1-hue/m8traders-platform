/**
 * ModeSelector Component
 * Allows switching between Live, H-7, and H-30 replay modes
 */
'use client';

import { useChartStore } from '@/stores';
import { REPLAY_MODE_LABELS, REPLAY_MODE_DESCRIPTIONS } from '@/lib/replay';
import type { ReplayMode } from '@/types';

const MODES: ReplayMode[] = ['live', '1y'];

export function ModeSelector() {
    const { replayMode, setReplayMode, loading } = useChartStore();

    const handleModeChange = (mode: ReplayMode) => {
        if (loading) return; // Prevent mode change while loading
        setReplayMode(mode);
    };

    return (
        <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-secondary)] font-medium">Mode:</span>
            <div className="flex items-center gap-1">
                {MODES.map((mode) => (
                    <button
                        key={mode}
                        onClick={() => handleModeChange(mode)}
                        disabled={loading}
                        className={`px-3 py-1.5 text-xs font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 ${replayMode === mode
                            ? 'bg-[var(--accent-primary)] text-white'
                            : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                            }`}
                        title={REPLAY_MODE_DESCRIPTIONS[mode]}
                    >
                        {loading && replayMode === mode && (
                            <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        )}
                        <span>{REPLAY_MODE_LABELS[mode]}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
