/**
 * Chart Store - Manages chart state (timeframe, indicators, drawings)
 * Uses persist middleware for localStorage persistence
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { Timeframe, Indicator, Drawing, IndicatorType, OverlayType, ChartOverlay, ReplayMode, PlaybackSpeed, Candle } from '@/types';
import { getRandomIDXTicker } from '@/lib/chart/tickers';

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
    // Current candle (for market data sync)
    currentCandle: Candle | null;

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
    setRandomIDXTicker: () => void;  // NEW: For auto-select on login
    // Current candle actions
    setCurrentCandle: (candle: Candle) => void;
}

const DEFAULT_INDICATORS: Indicator[] = [
    // Moving Averages
    { id: 'sma-20', type: 'sma', period: 20, enabled: false, color: '#2196F3' },
    { id: 'sma-50', type: 'sma', period: 50, enabled: false, color: '#FF9800' },
    { id: 'ema-12', type: 'ema', period: 12, enabled: false, color: '#4CAF50' },
    { id: 'wma-20', type: 'wma', period: 20, enabled: false, color: '#9C27B0' },

    // Oscillators & Trend
    { id: 'rsi-14', type: 'rsi', period: 14, enabled: false, color: '#E91E63' },
    { id: 'macd', type: 'macd', enabled: false, color: '#00BCD4' },
    { id: 'kdj-14', type: 'kdj', period: 14, enabled: false, color: '#673AB7' },
    { id: 'cci-20', type: 'cci', period: 20, enabled: false, color: '#FFC107' },
    { id: 'wr-14', type: 'wr', period: 14, enabled: false, color: '#795548' },
    { id: 'ao', type: 'ao', enabled: false, color: '#8BC34A' },
    { id: 'bias-24', type: 'bias', period: 24, enabled: false, color: '#009688' },
    { id: 'brar-26', type: 'brar', period: 26, enabled: false, color: '#3F51B5' },
    { id: 'mtm-12', type: 'mtm', period: 12, enabled: false, color: '#CDDC39' },
    { id: 'roc-12', type: 'roc', period: 12, enabled: false, color: '#FF5722' },
    { id: 'psy-12', type: 'psy', period: 12, enabled: false, color: '#607D8B' },
    { id: 'trix-12', type: 'trix', period: 12, enabled: false, color: '#9E9E9E' },

    // Volatility
    { id: 'bollinger-20', type: 'bollinger', period: 20, enabled: false, color: '#F44336' },
    { id: 'atr-14', type: 'atr', period: 14, enabled: false, color: '#9C27B0' },
    { id: 'dma-10', type: 'dma', period: 10, enabled: false, color: '#3F51B5' },

    // Trend
    { id: 'adx-14', type: 'adx', period: 14, enabled: false, color: '#2196F3' },
    { id: 'sar', type: 'sar', enabled: false, color: '#00BCD4' },

    // Volume
    { id: 'obv', type: 'obv', enabled: false, color: '#FF9800' },
    { id: 'vr-26', type: 'vr', period: 26, enabled: false, color: '#4CAF50' },
];

const initialState = {
    ticker: 'BBRI.JK',  // Default IDX ticker with .JK suffix
    timeframe: '1m' as Timeframe,  // 1-minute for intraday replay
    indicators: DEFAULT_INDICATORS,
    drawings: [] as Drawing[],
    theme: 'dark' as const,
    isPlaying: true,  // Auto-play enabled
    playbackSpeed: 2 as PlaybackSpeed,  // 2x speed
    loading: false,
    error: null,
    lastUpdate: null,
    activeDrawingTool: null as OverlayType | null,
    overlays: [] as ChartOverlay[],
    drawingMode: false,
    // Replay state
    replayMode: '1y' as ReplayMode,  // 1 year historical data
    replayIndex: 0,
    replayData: [] as Candle[],
    replayStartTime: null,
    replayEndTime: null,
    currentCandle: null,
};

/**
 * Helper: Find index of first candle on second day
 * For intraday data with single day, starts from 20% to show context
 */
function findSecondDayIndex(candles: Candle[]): number {
    if (candles.length === 0) return 0;

    // ✅ Get first candle's date in WIB (not UTC!)
    const firstDate = new Date(candles[0].t).toLocaleDateString('en-CA', {
        timeZone: 'Asia/Jakarta'
    }); // "YYYY-MM-DD" in WIB

    // Find first candle with different date (using WIB timezone)
    for (let i = 1; i < candles.length; i++) {
        const currentDate = new Date(candles[i].t).toLocaleDateString('en-CA', {
            timeZone: 'Asia/Jakarta'
        });

        if (currentDate !== firstDate) {
            console.log(`[ChartStore] Starting replay from day 2 (index ${i}, date ${currentDate} WIB)`);
            return i;
        }
    }

    // No second day found
    // For single-day intraday data, start from 20% to show context
    const contextStartIndex = Math.floor(candles.length * 0.2);
    if (contextStartIndex > 0) {
        const startTime = new Date(candles[contextStartIndex].t).toISOString();
        console.log(`[ChartStore] Single day intraday data, starting from 20% (index ${contextStartIndex}, time ${startTime})`);
        return contextStartIndex;
    }

    console.log(`[ChartStore] Starting from index 0`);
    return 0;
}

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
                    // Don't reset position/playing state when just changing mode
                }),

            setReplayIndex: (index) =>
                set((state) => {
                    // Clamp to valid range to prevent negative or out-of-bounds index
                    const maxIndex = Math.max(0, state.replayData.length - 1);
                    state.replayIndex = Math.max(0, Math.min(index, maxIndex));
                }),

            setReplayData: (data) =>
                set((state) => {
                    state.replayData = data;
                    // Start from second day to show historical context
                    state.replayIndex = findSecondDayIndex(data);
                    // Auto-set timeframe to 1m for replay
                    state.timeframe = '1m';
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

            // NEW: Set random IDX ticker (called on login)
            setRandomIDXTicker: () =>
                set((state) => {
                    const randomTicker = getRandomIDXTicker();
                    state.ticker = randomTicker.symbol;
                    console.log(`[ChartStore] Random IDX ticker selected: ${randomTicker.symbol}`);
                }),

            // Current candle setter
            setCurrentCandle: (candle) =>
                set((state) => {
                    state.currentCandle = candle;
                }),

            reset: () => set(initialState),
        })),
        {
            name: 'm8traders-chart',
            version: 2, // Bumped for new indicators
            migrate: (persistedState: any, version: number) => {
                // Initial migration (v0 -> v1)
                if (version === 0 || !version) {
                    if (persistedState?.indicators) {
                        persistedState.indicators = persistedState.indicators
                            .filter((ind: any) => ind.type !== 'vwap')
                            .map((ind: any) => {
                                if (!ind.id) {
                                    const id = ind.period
                                        ? `${ind.type}-${ind.period}`
                                        : ind.type;
                                    return { ...ind, id };
                                }
                                return ind;
                            });
                    }
                }

                // Migration v1 -> v2 (Add new KLineChart indicators)
                if (version < 2) {
                    const existingIndicators = persistedState.indicators || [];
                    const existingIds = new Set(existingIndicators.map((i: any) => i.id));

                    const newIndicators = DEFAULT_INDICATORS.filter(i => !existingIds.has(i.id));

                    persistedState.indicators = [...existingIndicators, ...newIndicators];
                    console.log(`[useChartStore] Migrated to v2: Added ${newIndicators.length} new indicators`);
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
