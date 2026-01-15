/**
 * ModeSelector Component
 * Allows switching between Live, 1y, and Scenario replay modes
 */
'use client';

import { useChartStore } from '@/stores';
import { REPLAY_MODE_LABELS, REPLAY_MODE_DESCRIPTIONS } from '@/lib/replay';
import type { ReplayMode } from '@/types';

const MODES: ReplayMode[] = ['live', 'scenario'];

export function ModeSelector() {
    const { replayMode, setReplayMode, loading } = useChartStore();

    const handleModeChange = (mode: ReplayMode) => {
        if (loading) return; // Prevent mode change while loading
        // Don't allow switching to scenario mode directly - use ScenarioSelector instead
        if (mode === 'scenario') return;
        setReplayMode(mode);
    };

    return (
        <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-secondary)] font-medium">Mode:</span>
            <div className="flex items-center gap-1">
                {MODES.map((mode) => {
                    // Skip scenario mode button if not in scenario mode
                    // (Scenario mode is activated via ScenarioSelector component)
                    if (mode === 'scenario' && replayMode !== 'scenario') {
                        return null;
                    }

                    return (
                        <button
                            key={mode}
                            onClick={() => handleModeChange(mode)}
                            disabled={loading || mode === 'scenario'}
                            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 ${replayMode === mode
                                ? 'bg-[var(--accent-primary)] text-white'
                                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                                }`}
                            title={REPLAY_MODE_DESCRIPTIONS[mode] || 'Frozen historical scenario'}
                        >
                            {loading && replayMode === mode && (
                                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            )}
                            {mode === 'scenario' && (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                            )}
                            <span>{REPLAY_MODE_LABELS[mode] || 'Scenario'}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
