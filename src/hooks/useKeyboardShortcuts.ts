/**
 * useKeyboardShortcuts Hook
 * Global keyboard shortcuts for replay controls
 */

import { useEffect } from 'react';
import { useChartStore } from '@/stores';
import { PLAYBACK_SPEEDS } from '@/lib/replay';
import type { PlaybackSpeed } from '@/types';

interface KeyboardShortcutsOptions {
    enabled?: boolean;
}

export function useKeyboardShortcuts(options: KeyboardShortcutsOptions = {}) {
    const { enabled = true } = options;

    const {
        replayMode,
        isPlaying,
        playbackSpeed,
        replayIndex,
        replayData,
        setPlaying,
        setPlaybackSpeed,
        setReplayIndex,
        resetReplay,
        setReplayMode,
    } = useChartStore();

    const isReplayActive = replayMode !== 'live';

    useEffect(() => {
        if (!enabled) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore shortcuts when typing in input fields
            const target = e.target as HTMLElement;
            if (
                target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.isContentEditable
            ) {
                return;
            }

            // Only handle shortcuts when in replay mode (except Escape)
            if (!isReplayActive && e.key !== 'Escape') {
                return;
            }

            switch (e.key) {
                case ' ': // Space - Play/Pause
                    e.preventDefault();
                    setPlaying(!isPlaying);
                    break;

                case 'r':
                case 'R': // R - Reset
                    e.preventDefault();
                    resetReplay();
                    break;

                case '+':
                case '=':
                case ']': // Increase speed
                    e.preventDefault();
                    increaseSpeed();
                    break;

                case '-':
                case '_':
                case '[': // Decrease speed
                    e.preventDefault();
                    decreaseSpeed();
                    break;

                case 'ArrowLeft': // Rewind 10 candles
                    e.preventDefault();
                    rewind(10);
                    break;

                case 'ArrowRight': // Forward 10 candles
                    e.preventDefault();
                    forward(10);
                    break;

                case 'Escape': // Exit replay mode
                    e.preventDefault();
                    if (isReplayActive) {
                        setReplayMode('live');
                    }
                    break;
            }
        };

        const increaseSpeed = () => {
            const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackSpeed);
            if (currentIndex < PLAYBACK_SPEEDS.length - 1) {
                const newSpeed = PLAYBACK_SPEEDS[currentIndex + 1];
                setPlaybackSpeed(newSpeed);
                showToast(`Speed: ${newSpeed}x`);
            }
        };

        const decreaseSpeed = () => {
            const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackSpeed);
            if (currentIndex > 0) {
                const newSpeed = PLAYBACK_SPEEDS[currentIndex - 1];
                setPlaybackSpeed(newSpeed);
                showToast(`Speed: ${newSpeed}x`);
            }
        };

        const rewind = (candles: number) => {
            const newIndex = Math.max(0, replayIndex - candles);
            setReplayIndex(newIndex);
        };

        const forward = (candles: number) => {
            const newIndex = Math.min(replayData.length - 1, replayIndex + candles);
            setReplayIndex(newIndex);
        };

        const showToast = (message: string) => {
            // Simple toast - can be replaced with a proper toast system
            console.log(`[Keyboard Shortcut] ${message}`);
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [
        enabled,
        isReplayActive,
        isPlaying,
        playbackSpeed,
        replayIndex,
        replayData.length,
        setPlaying,
        setPlaybackSpeed,
        setReplayIndex,
        resetReplay,
        setReplayMode,
    ]);
}
