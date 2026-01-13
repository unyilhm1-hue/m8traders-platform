/**
 * PlaybackControls Component
 * Play/Pause/Stop controls with speed selection
 */
'use client';

import { useChartStore } from '@/stores';
import { PLAYBACK_SPEEDS } from '@/lib/replay';
import type { PlaybackSpeed } from '@/types';

export function PlaybackControls() {
    const {
        isPlaying,
        setPlaying,
        playbackSpeed,
        setPlaybackSpeed,
        resetReplay,
        replayMode
    } = useChartStore();

    const isReplayActive = replayMode !== 'live';

    const handlePlayPause = () => {
        setPlaying(!isPlaying);
    };

    const handleStop = () => {
        resetReplay();
    };

    const handleSpeedChange = (speed: PlaybackSpeed) => {
        setPlaybackSpeed(speed);
    };

    // Disable controls in Live mode
    if (!isReplayActive) {
        return (
            <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                <span>⚡ Live Mode</span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2">
            {/* Play/Pause Button */}
            <button
                onClick={handlePlayPause}
                className="px-3 py-1.5 text-sm font-medium rounded bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)] transition-colors flex items-center gap-1.5"
                title={isPlaying ? 'Pause [Space]' : 'Play [Space]'}
            >
                {isPlaying ? (
                    <>
                        <span>⏸</span>
                        <span className="hidden sm:inline">Pause</span>
                    </>
                ) : (
                    <>
                        <span>▶️</span>
                        <span className="hidden sm:inline">Play</span>
                    </>
                )}
            </button>

            {/* Stop Button */}
            <button
                onClick={handleStop}
                className="px-3 py-1.5 text-sm font-medium rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                title="Stop and Reset [R]"
            >
                ⏹
            </button>

            {/* Speed Selector */}
            <div className="flex items-center gap-1 ml-2">
                <span className="text-xs text-[var(--text-secondary)] mr-1">Speed:</span>
                {PLAYBACK_SPEEDS.map((speed) => (
                    <button
                        key={speed}
                        onClick={() => handleSpeedChange(speed)}
                        className={`px-2 py-1 text-xs font-medium rounded transition-colors min-w-[2.5rem] ${playbackSpeed === speed
                                ? 'bg-[var(--accent-primary)] text-white'
                                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                            }`}
                        title={`${speed}x speed [+/- to adjust]`}
                    >
                        {speed}x
                    </button>
                ))}
            </div>

            {/* Keyboard Hints */}
            <div className="ml-2 text-xs text-[var(--text-tertiary)] hidden lg:flex items-center gap-2">
                <span className="opacity-75">⌨️</span>
                <span className="opacity-75">Space: Play/Pause • R: Reset • ←→: Seek • Esc: Exit</span>
            </div>
        </div>
    );
}
