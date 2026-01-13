/**
 * Chart Store - Manages chart state (timeframe, indicators, drawings)
 * Uses persist middleware for localStorage persistence
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { Timeframe, Indicator, Drawing, IndicatorType, OverlayType, ChartOverlay, ReplayMode, PlaybackSpeed, Candle } from '@/types';

interface ChartState {
    // State
    ticker: string;
    timeframe: Timeframe;
    indicators: Indicator[];
    drawings: Drawing[];
    theme: 'dark' | 'light';
    isPlaying: boolean;
    playbackSpeed: PlaybackSpeed;
    loading: boolean;
    error: string | null;
    lastUpdate: number | null;
    // Overlay state
    activeDrawingTool: OverlayType | null;
    overlays: ChartOverlay[];
    drawingMode: boolean;
    // Replay state
    replayMode: ReplayMode;
    replayIndex: number;
    replayData: Candle[];
    replayStartTime: number | null;
    replayEndTime: number | null;

    // Actions
    setTicker: (ticker: string) => void;
    setTimeframe: (timeframe: Timeframe) => void;
    toggleIndicator: (id: string) => void;
    setIndicatorPeriod: (id: string, period: number) => void;
    addDrawing: (drawing: Drawing) => void;
    removeDrawing: (id: string) => void;
    clearDrawings: () => void;
    setTheme: (theme: 'dark' | 'light') => void;
    setPlaying: (playing: boolean) => void;
    setPlaybackSpeed: (speed: PlaybackSpeed) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    setLastUpdate: (timestamp: number) => void;
    // Overlay actions
    setActiveDrawingTool: (tool: OverlayType | null) => void;
    addOverlay: (overlay: ChartOverlay) => void;
    removeOverlay: (id: string) => void;
    clearOverlays: () => void;
    setDrawingMode: (enabled: boolean) => void;
    // Replay actions
    setReplayMode: (mode: ReplayMode) => void;
    setReplayIndex: (index: number) => void;
    setReplayData: (data: Candle[]) => void;
    incrementReplayIndex: () => void;
    resetReplay: () => void;
    reset: () => void;
}

const DEFAULT_INDICATORS: Indicator[] = [
    { id: 'sma-20', type: 'sma', period: 20, enabled: false, color: '#2196F3' },
    { id: 'sma-50', type: 'sma', period: 50, enabled: false, color: '#FF9800' },
    { id: 'ema-12', type: 'ema', period: 12, enabled: false, color: '#4CAF50' },
    { id: 'rsi-14', type: 'rsi', period: 14, enabled: false, color: '#9C27B0' },
    { id: 'macd', type: 'macd', enabled: false, color: '#00BCD4' },
    { id: 'bollinger-20', type: 'bollinger', period: 20, enabled: false, color: '#E91E63' },
    // Note: VWAP removed - not a built-in KLineChart indicator
    // Will be implemented as custom indicator in future
];

const initialState = {
    ticker: 'AAPL',
    timeframe: '5m' as Timeframe,
    indicators: DEFAULT_INDICATORS,
    drawings: [] as Drawing[],
    theme: 'dark' as const,
    isPlaying: false,
    playbackSpeed: 1 as PlaybackSpeed,
    loading: false,
    error: null,
    lastUpdate: null,
    activeDrawingTool: null as OverlayType | null,
    overlays: [] as ChartOverlay[],
    drawingMode: false,
    // Replay state
    replayMode: 'live' as ReplayMode,
    replayIndex: 0,
    replayData: [] as Candle[],
    replayStartTime: null,
    replayEndTime: null,
};

export const useChartStore = create<ChartState>()(
    persist(
        immer((set) => ({
            ...initialState,

            setTicker: (ticker) =>
                set((state) => {
                    state.ticker = ticker;
                }),

            setTimeframe: (timeframe) =>
                set((state) => {
                    state.timeframe = timeframe;
                }),

            toggleIndicator: (id) =>
                set((state) => {
                    const indicator = state.indicators.find((i) => i.id === id);
                    if (indicator) {
                        indicator.enabled = !indicator.enabled;
                    }
                }),

            setIndicatorPeriod: (id, period) =>
                set((state) => {
                    const indicator = state.indicators.find((i) => i.id === id);
                    if (indicator) {
                        indicator.period = period;
                    }
                }),

            addDrawing: (drawing) =>
                set((state) => {
                    state.drawings.push(drawing);
                }),

            removeDrawing: (id) =>
                set((state) => {
                    state.drawings = state.drawings.filter((d) => d.id !== id);
                }),

            clearDrawings: () =>
                set((state) => {
                    state.drawings = [];
                }),

            setTheme: (theme) =>
                set((state) => {
                    state.theme = theme;
                }),

            setPlaying: (playing) =>
                set((state) => {
                    state.isPlaying = playing;
                }),

            setPlaybackSpeed: (speed) =>
                set((state) => {
                    state.playbackSpeed = speed;
                }),

            setLoading: (loading) =>
                set((state) => {
                    state.loading = loading;
                }),

            setError: (error) =>
                set((state) => {
                    state.error = error;
                }),

            setLastUpdate: (timestamp) =>
                set((state) => {
                    state.lastUpdate = timestamp;
                }),

            setActiveDrawingTool: (tool) =>
                set((state) => {
                    state.activeDrawingTool = tool;
                    state.drawingMode = tool !== null;
                }),

            addOverlay: (overlay) =>
                set((state) => {
                    state.overlays.push(overlay);
                }),

            removeOverlay: (id) =>
                set((state) => {
                    state.overlays = state.overlays.filter((o) => o.id !== id);
                }),

            clearOverlays: () =>
                set((state) => {
                    state.overlays = [];
                }),

            setDrawingMode: (enabled) =>
                set((state) => {
                    state.drawingMode = enabled;
                    if (!enabled) {
                        state.activeDrawingTool = null;
                    }
                }),

            // Replay actions
            setReplayMode: (mode) =>
                set((state) => {
                    state.replayMode = mode;
                    // Reset replay position when changing modes
                    state.replayIndex = 0;
                    state.isPlaying = false;
                }),

            setReplayIndex: (index) =>
                set((state) => {
                    state.replayIndex = index;
                }),

            setReplayData: (data) =>
                set((state) => {
                    state.replayData = data;
                    state.replayIndex = 0;
                    if (data.length > 0) {
                        state.replayStartTime = data[0].t;
                        state.replayEndTime = data[data.length - 1].t;
                    }
                }),

            incrementReplayIndex: () =>
                set((state) => {
                    if (state.replayIndex < state.replayData.length - 1) {
                        state.replayIndex++;
                    }
                }),

            resetReplay: () =>
                set((state) => {
                    state.replayIndex = 0;
                    state.isPlaying = false;
                }),

            reset: () => set(initialState),
        })),
        {
            name: 'm8traders-chart',
            version: 1, // Bumped version for migration
            migrate: (persistedState: any, version: number) => {
                // Migrate from version 0 (old format) to version 1 (with IDs)
                if (version === 0 || !version) {
                    console.log('[useChartStore] Migrating from old format...');

                    if (persistedState?.indicators) {
                        persistedState.indicators = persistedState.indicators
                            .filter((ind: any) => ind.type !== 'vwap') // Remove old vwap
                            .map((ind: any) => {
                                // If indicator missing 'id', generate it
                                if (!ind.id) {
                                    const id = ind.period
                                        ? `${ind.type}-${ind.period}`
                                        : ind.type;
                                    return { ...ind, id };
                                }
                                return ind;
                            });
                        console.log('[useChartStore] Migration complete:', persistedState.indicators.length, 'indicators');
                    }
                }
                return persistedState;
            },
            partialize: (state) => ({
                ticker: state.ticker,
                timeframe: state.timeframe,
                indicators: state.indicators,
                theme: state.theme,
                playbackSpeed: state.playbackSpeed,
                overlays: state.overlays,
                replayMode: state.replayMode,
            }),
        }
    )
);
