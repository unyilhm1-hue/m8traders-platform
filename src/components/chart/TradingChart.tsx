'use client';

import { useEffect, useRef, memo, useState } from 'react';
import {
    createChart,
    ColorType,
    CrosshairMode,
    type IChartApi,
    type ISeriesApi,
    type CandlestickData,
    type Time,
    type UTCTimestamp,
} from 'lightweight-charts';
import { useSimulationStore, normalizeTimestamp } from '@/stores/useSimulationStore';
import { simTelemetry } from '@/lib/telemetry';
import { ChartProvider, useChartContext } from '@/contexts/ChartContext';
import { DrawingOverlay } from './DrawingOverlay';
import { useChartStore } from '@/stores';
import { calculateIndicator } from '@/lib/chart/indicators';
import { profiler, KPI_TARGETS } from '@/utils/profiler';
import { formatError } from '@/utils/formatError';
import { sanitizeDataForChart } from '@/utils/chartSanitizer';

interface TradingChartProps {
    className?: string;
}

// 1. Bungkus memo agar tidak re-render oleh Parent
const TradingChartInner = memo(function TradingChartInner({ className = '' }: TradingChartProps) {
    const renderInterval = useSimulationStore((s) => s.baseInterval);
    const renderHistory = useSimulationStore((s) => s.candleHistory.length);
    console.log(`[TradingChart] 🔄 RENDER COMPONENT. Interval: ${renderInterval}, HistLen: ${renderHistory}`);

    const chartContainerRef = useRef<HTMLDivElement>(null);
    const mainChartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null); // 🔥 NEW: Volume Ref

    // 🔥 RACE CONDITION FIX: Guard against updates before chart is ready
    const isChartReady = useRef<boolean>(false);

    // 🔥 NEW: Context for Overlay
    const { setChart, setMainSeries } = useChartContext();

    // Ref untuk mencegah reload history yang tidak perlu
    const historyLoadedRef = useRef<number>(0);
    const historyLoadedLengthRef = useRef<number>(0); // 🔥 New ref for length tracking
    const lastLoadedIntervalRef = useRef<string>('1m');
    const lastUpdateTimeRef = useRef<number>(0);
    // 🔥 FIX: Allow extra properties (like volume/value) in pending update
    const pendingUpdateRef = useRef<(CandlestickData & { value?: number, color?: string }) | null>(null);
    const isAtLiveEdgeRef = useRef<boolean>(true); // 🔥 Track if user is at the latest data

    // 🛡️ LAYER 3 GUARD: Track active interval with Ref to prevent stale closure
    const activeIntervalRef = useRef<string>('1m');

    // 🔥 NEW: Grace period flag for interval changes
    // When true, timestamp guard is disabled until first successful worker update
    const intervalChangeGraceRef = useRef<boolean>(false);

    // Ambil history & indicators dari store
    const candleHistory = useSimulationStore((state) => state.candleHistory);

    // Access Chart Store for active indicators
    const activeIndicators = useChartStore((state) => state.indicators);

    // Ref to track indicator series
    const indicatorSeriesRef = useRef<Map<string, ISeriesApi<any>>>(new Map());
    const activeIndicatorsRef = useRef(activeIndicators); // 🔥 Track indicators for Raf loop

    useEffect(() => {
        activeIndicatorsRef.current = activeIndicators;
    }, [activeIndicators]);

    // --- A. INITIALIZE CHART (Run Once) ---
    useEffect(() => {
        if (!chartContainerRef.current) return;

        // Setup Chart
        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: '#131722' }, // Dark Theme
                textColor: '#d1d5db',
            },
            grid: {
                vertLines: { color: '#1E222D' },
                horzLines: { color: '#1E222D' },
            },
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight, // 🔥 Responsive height
            crosshair: {
                mode: CrosshairMode.Normal,
            },
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
                borderColor: '#2B2B43',
                minBarSpacing: 8,
                // 🔥 CRITICAL: Force UTC timestamp mode (prevents BusinessDay object conversion)
                // Without this, lightweight-charts may convert Unix timestamps to BusinessDay objects internally
                tickMarkFormatter: (time: UTCTimestamp) => {
                    const date = new Date(time * 1000);
                    return date.toLocaleString('id-ID', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                },
            },
            rightPriceScale: {
                borderColor: '#2B2B43',
                autoScale: true,
                // 🔥 MAIN PANE: Comfortable margins to prevent clipping
                scaleMargins: {
                    top: 0.1,     // 10% padding at top
                    bottom: 0.2,  // 20% for oscillators/volume
                },
            },
        });

        // Setup Main Series (Right Scale)
        const newSeries = chart.addCandlestickSeries({
            upColor: '#089981',
            downColor: '#F23645',
            borderVisible: false,
            wickVisible: true,
            wickUpColor: '#089981',
            wickDownColor: '#F23645',
        });

        // 🔥 NEW: Volume Series (Separate Scale at Bottom)
        const volumeSeries = chart.addHistogramSeries({
            color: '#26a69a',
            priceFormat: {
                type: 'volume',
            },
            priceScaleId: 'volume', // Use named scale for configuration
        });

        // Configure Volume Scale (Bottom 20%)
        chart.priceScale('volume').applyOptions({
            scaleMargins: {
                top: 0.8,
                bottom: 0,
            },
        });

        mainChartRef.current = chart;
        candleSeriesRef.current = newSeries;
        volumeSeriesRef.current = volumeSeries;

        // 🔥 Update Context
        setChart(chart);
        setMainSeries(newSeries);

        // 🔥 Resize Observer for Smooth Layout Transitions
        // Uses ResizeObserver instead of window.resize to catch sidebar toggles
        const resizeObserver = new ResizeObserver(entries => {
            if (!chart || !entries[0]) return;
            const { width, height } = entries[0].contentRect;
            chart.applyOptions({ width, height });
        });
        resizeObserver.observe(chartContainerRef.current);

        // 🔥 SMART AUTO-SCROLL LOGIC
        // Detect if user has scrolled back into history
        const timeScale = chart.timeScale();
        const checkLiveEdge = () => {
            // If the distance from the right edge is small, we are at live edge.
            // scrollPosition() returns dist from right edge (0 = reset).
            // Negative = scrolled back. Positive = scrolled past future.
            const pos = timeScale.scrollPosition();

            // Allow small buffer (e.g. -5 bars) to sticky snap
            isAtLiveEdgeRef.current = pos > -5;
        };
        timeScale.subscribeVisibleLogicalRangeChange(checkLiveEdge);

        return () => {
            timeScale.unsubscribeVisibleLogicalRangeChange(checkLiveEdge);
            resizeObserver.disconnect();

            // 🔥 CRITICAL FIX: Fully destroy chart to prevent ghosting / double labels
            if (mainChartRef.current) {
                mainChartRef.current.remove();
            }
            mainChartRef.current = null;
            candleSeriesRef.current = null;
            volumeSeriesRef.current = null;

            setChart(null);
            setMainSeries(null);

            // 🔥 CLEANUP: Clear indicator refs to prevent leaked series
            indicatorSeriesRef.current.clear();
        };
    }, []); // Run once

    // Helper: Smart Viewport Lookback
    const getSmartLookback = (interval: string): number => {
        if (interval === '1m') return 90;
        if (interval === '5m') return 120;
        if (interval.endsWith('h')) return 200;
        if (interval.endsWith('d')) return 250;
        return 100;
    };

    // --- B. LOAD HISTORY ---
    const currentInterval = useSimulationStore((s) => s.baseInterval);
    const prevIntervalRef = useRef<string>(currentInterval);

    // 🛡️ LAYER 3 GUARD: Sync activeIntervalRef whenever interval changes
    useEffect(() => {
        activeIntervalRef.current = currentInterval;
        console.log(`[Chart] 🛡️ Active interval ref updated: ${currentInterval}`);
    }, [currentInterval]);

    // --- B. HISTORY LOADING EFFECT (Load Chart Data) ---
    useEffect(() => {
        if (!candleHistory || candleHistory.length === 0) {
            console.warn('[Chart] ⚠️ Skip load: No history data');
            return;
        }
        if (!candleSeriesRef.current || !mainChartRef.current) {
            console.error('[Chart] ❌ Skip load: Series/Chart ref missing');
            return;
        }

        const lastCandleTime = candleHistory[candleHistory.length - 1]?.time;
        const total = candleHistory.length;

        // 🔥 FIX: Comprehensive interval change handling
        if (prevIntervalRef.current !== currentInterval) {
            console.log(`[Chart] 🔄 Interval changed: ${prevIntervalRef.current} → ${currentInterval}`);

            // 1. Reset timestamp tracking
            lastUpdateTimeRef.current = 0;
            historyLoadedRef.current = 0;
            historyLoadedLengthRef.current = 0;

            // 🔥 NEW: Activate grace period - disable guard until first successful update
            intervalChangeGraceRef.current = true;
            console.log(`[Chart] 🛡️ Grace period ACTIVATED - timestamp guard disabled`);

            // 2. CRITICAL: Remove ALL series to clear library state
            // Don't destroy chart (causes "Object is disposed" errors)
            // Just remove series and recreate them

            // Remove all indicator series
            indicatorSeriesRef.current.forEach((series) => {
                try {
                    mainChartRef.current?.removeSeries(series);
                } catch (err) {
                    // Series might already be removed, ignore
                }
            });
            indicatorSeriesRef.current.clear();

            // Remove volume series
            if (volumeSeriesRef.current && mainChartRef.current) {
                try {
                    mainChartRef.current.removeSeries(volumeSeriesRef.current);
                    console.log('[Chart] 🗑️ Removed volume series');
                } catch (err) {
                    console.warn('[Chart] ⚠️ Could not remove volume series:', err);
                }
            }

            // Remove candle series
            if (candleSeriesRef.current && mainChartRef.current) {
                try {
                    mainChartRef.current.removeSeries(candleSeriesRef.current);
                    console.log('[Chart] 🗑️ Removed candle series');
                } catch (err) {
                    console.warn('[Chart] ⚠️ Could not remove candle series:', err);
                }
            }

            // Recreate series with fresh library state
            if (mainChartRef.current) {
                candleSeriesRef.current = mainChartRef.current.addCandlestickSeries({
                    upColor: '#089981',
                    downColor: '#F23645',
                    borderVisible: false,
                    wickUpColor: '#089981',
                    wickDownColor: '#F23645',
                });

                volumeSeriesRef.current = mainChartRef.current.addHistogramSeries({
                    color: '#26a69a',
                    priceFormat: {
                        type: 'volume',
                    },
                    priceScaleId: '',
                });

                // Configure RIGHT scale for volume
                mainChartRef.current.priceScale('').applyOptions({
                    scaleMargins: {
                        top: 0.8,
                        bottom: 0,
                    },
                });

                // Update context
                setMainSeries(candleSeriesRef.current);

                console.log('[Chart] ✨ Recreated all series with clean state');
            }

            // 3. Clear pending updates
            pendingUpdateRef.current = null;

            // 4. Update interval ref
            prevIntervalRef.current = currentInterval;
            lastLoadedIntervalRef.current = ''; // Force reload

            console.log(`[Chart] ✅ Chart state reset for new interval`);
        }

        // 🔥 GUARD #1: Skip reload if chart is already at this exact point
        // Prevent redundant setData calls on same data
        const isIntervalChange = lastLoadedIntervalRef.current !== currentInterval;
        if (!isIntervalChange &&
            historyLoadedRef.current === lastCandleTime &&
            historyLoadedLengthRef.current === total &&
            lastLoadedIntervalRef.current === currentInterval) {
            // 🔥 FIX: Ensure chart is ready even when skipping reload
            // This prevents indefinite lock when interval changes but data hasn't refreshed yet
            if (!isChartReady.current) {
                console.log('[Chart] ⚡ Unlocking chart (skip reload but was locked)');
                isChartReady.current = true;
            }
            return;
        }

        try {
            console.log(`[Chart] 📥 Loading History (${candleHistory.length} candles, interval: ${currentInterval})...`);

            // 🔥 LOCK: Block updates while loading history
            isChartReady.current = false;
            pendingUpdateRef.current = null; // Kill ghosts
            lastUpdateTimeRef.current = 0;

            // 🔥 PERFORMANCE: Windowed setData for large datasets
            // KPI Target: ≤15ms per update, avoid full setData for >5k candles
            const WINDOW_THRESHOLD = 5000;
            const WINDOW_SIZE = 2000; // Load last 2k candles + buffer

            // 🔥 CRITICAL: Use sanitizer to handle ALL key formats and guarantee sort!
            // Manual sort was failing silently (accessing a.time when data has 'timestamp' key)
            // Sanitizer normalizes time/t/timestamp → guaranteed sorted & deduplicated output
            const rawSortedHistory = sanitizeDataForChart(candleHistory);

            // 🔬 DIAGNOSTIC: Check what sanitizer actually returned
            console.log('[Chart] 🧪 Sanitizer output type check:', {
                first: rawSortedHistory[0],
                firstTimeType: typeof rawSortedHistory[0]?.time,
                firstTimeValue: rawSortedHistory[0]?.time
            });

            // 🔥 PARANOID VALIDATION: Filter sortedHistory to ONLY numbers
            // Even though sanitizer should return clean data, double-check to be safe
            const sortedHistory = rawSortedHistory.filter((item, index) => {
                const isValid = typeof item.time === 'number' && Number.isFinite(item.time);
                if (!isValid) {
                    console.error(`[Chart] 🚨 Sanitizer returned BAD data at index ${index}:`, {
                        time: item.time,
                        type: typeof item.time,
                        isObject: typeof item.time === 'object',
                        fullItem: item
                    });
                }
                return isValid;
            });

            if (sortedHistory.length < rawSortedHistory.length) {
                console.warn(`[Chart] ⚠️ Filtered ${rawSortedHistory.length - sortedHistory.length} bad items from sanitizer output`);
            }

            if (sortedHistory.length === 0) {
                console.error('[Chart] ❌ NO VALID DATA after sanitizer validation! Aborting.');
                isChartReady.current = true; // Unlock to prevent deadlock
                return;
            }

            let candleData: any[]; // 🔥 FIX: Declare variable
            if (total > WINDOW_THRESHOLD) {
                // Large dataset: only load recent window
                const startIdx = Math.max(0, total - WINDOW_SIZE);
                const windowedHistory = sortedHistory.slice(startIdx);
                candleData = windowedHistory.map((c) => {
                    const timeValue = typeof c.time === 'number' ? c.time : Number(c.time);
                    return {
                        time: timeValue as UTCTimestamp,  // Use UTCTimestamp type
                        open: c.open,
                        high: c.high,
                        low: c.low,
                        close: c.close,
                    };
                });

                // Volume Data Map
                const volumeData = windowedHistory.map((c) => ({
                    time: (typeof c.time === 'number' ? c.time : Number(c.time)) as UTCTimestamp,
                    value: c.value,
                    color: c.close >= c.open ? '#089981' : '#F23645',
                }));
                volumeSeriesRef.current?.setData(volumeData);

                console.log(`[Chart] 🪟 Windowed load: ${windowedHistory.length} of ${total} candles`);
            } else {
                // Small dataset: load all
                candleData = sortedHistory.map((c) => {
                    const timeValue = typeof c.time === 'number' ? c.time : Number(c.time);
                    return {
                        time: timeValue as UTCTimestamp,  // Use UTCTimestamp type
                        open: c.open,
                        high: c.high,
                        low: c.low,
                        close: c.close,
                    };
                });

                // Volume Data Map
                const volumeData = sortedHistory.map((c) => ({
                    time: (typeof c.time === 'number' ? c.time : Number(c.time)) as UTCTimestamp,
                    value: c.value,
                    color: c.close >= c.open ? '#089981' : '#F23645',
                }));
                volumeSeriesRef.current?.setData(volumeData);
            }

            // 🔬 DIAGNOSTIC: Check candleData before setData
            console.log('[Chart] 🧪 CandleData before setData:', {
                first: candleData[0],
                firstTimeType: typeof candleData[0]?.time,
                firstTimeValue: candleData[0]?.time,
                firstTimeIsNumber: Number.isFinite(candleData[0]?.time)
            });

            // 🔥 PARANOID FILTER: Remove ANY candles with non-number time
            // This is the LAST line of defense before library sees data
            const validCandleData = candleData.filter((c, index) => {
                const timeIsNumber = typeof c.time === 'number' && Number.isFinite(c.time);
                if (!timeIsNumber) {
                    console.error(`[Chart] 🚨 BLOCKED invalid candle at index ${index}:`, {
                        time: c.time,
                        type: typeof c.time,
                        isObject: typeof c.time === 'object',
                        keys: typeof c.time === 'object' && c.time !== null ? Object.keys(c.time) : 'N/A'
                    });
                    return false; // REJECT
                }
                return true; // ACCEPT
            });

            if (validCandleData.length < candleData.length) {
                console.warn(`[Chart] ⚠️ Filtered out ${candleData.length - validCandleData.length} invalid candles`);
            }

            if (validCandleData.length === 0) {
                console.error('[Chart] ❌ NO VALID CANDLES after filtering! Aborting setData');
                return;
            }

            // 🔬 DEBUG: Log sample of sorted data to verify ordering
            if (sortedHistory.length > 0) {
                const first5 = sortedHistory.slice(0, 5).map(c => ({ time: c.time, close: c.close }));
                const last5 = sortedHistory.slice(-5).map(c => ({ time: c.time, close: c.close }));
                console.log('[Chart] 📊 Sorted data sample:', {
                    total: sortedHistory.length,
                    first5,
                    last5,
                    isAscending: sortedHistory.every((c, i, arr) =>
                        i === 0 || Number(arr[i - 1].time) <= Number(c.time)
                    )
                });
            }

            // 🔬 PROFILING: Measure setData duration
            profiler.start('chart_setData', {
                candles: validCandleData.length, // Use validated data
                windowed: total > WINDOW_THRESHOLD
            });

            candleSeriesRef.current.setData(validCandleData); // 🔥 Use validated data!

            // 🔥 CRITICAL FIX: NEVER update lastUpdateTimeRef in setData
            // Only flushUpdate (after successful chart.update()) should update this ref
            // Why: setData loads history which may end at a DIFFERENT time than where worker continues
            // Example: History ends at 15:40, but worker continues from anchor 15:36
            // If we set ref=15:40 here, library rejects 15:36 update as "going backwards"
            // Solution: Keep ref at whatever value it has (0 during interval change, or last update time)
            // This allows worker to send ANY timestamp and library will accept it

            console.log(`[Chart] 📊 History loaded via setData - NOT updating timestamp guard (current: ${lastUpdateTimeRef.current})`);

            // 🔥 CRITICAL: Mark chart as ready AFTER data is loaded
            isChartReady.current = true;
            console.log('[Chart] ✅ Chart ready. Updates now allowed.');

            const setDataDuration = profiler.end('chart_setData');

            // 🔬 KPI CHECK: Verify setData meets targets
            if (setDataDuration !== null) {
                const target = total <= 1000 ? KPI_TARGETS.CHART.SET_DATA_1K :
                    total <= 5000 ? KPI_TARGETS.CHART.SET_DATA_5K :
                        KPI_TARGETS.CHART.SET_DATA_10K;

                if (setDataDuration > target) {
                    console.warn(`[Chart] ⚠️ setData exceeded target for ${total} candles: ${setDataDuration.toFixed(2)}ms > ${target}ms`);
                }
            }

            // Viewport Logic: Only force snap if user is already at the edge
            // or if it's the very first load (historyLoadedRef.current === 0)
            const isFirstLoad = historyLoadedRef.current === 0;

            if (isAtLiveEdgeRef.current || isFirstLoad) {
                // 🔥 ZOOM FIX: Default to 100 candles (TradingView standard)
                // Prevents "Too Zoomed In" effect on load
                const visibleCandlesCount = 100;
                const total = candleHistory.length;

                if (total > visibleCandlesCount) {
                    mainChartRef.current.timeScale().setVisibleLogicalRange({
                        from: total - visibleCandlesCount,
                        to: total + 5 // Add some space to the right
                    });
                } else {
                    mainChartRef.current.timeScale().fitContent();
                }
            }


            historyLoadedRef.current = lastCandleTime as number;
            historyLoadedLengthRef.current = total; // Sync length
            lastLoadedIntervalRef.current = currentInterval;


        } catch (error) {
            console.error('[Chart] History Load Error:', error);
            // 🔥 UNLOCK ON ERROR: Don't leave chart frozen
            isChartReady.current = true;
        }
    }, [candleHistory, currentInterval]); // 🔥 Added currentInterval dependency

    // 🔥 NOTE: Effect B2 (separate interval change handler) was REMOVED
    // Its logic is now integrated into Effect B above to prevent race conditions
    // where isChartReady was set to false but Effect B didn't re-run

    // --- C. REALTIME UPDATE ---
    useEffect(() => {
        let rafId: number | null = null;
        let prevCandle: any = null; // Track previous candle to detect changes
        const flushUpdate = () => {
            rafId = null;
            // 🔥 GUARD: Block updates if chart is not ready or paused
            if (!isChartReady.current || !pendingUpdateRef.current || !candleSeriesRef.current) return;
            const update = pendingUpdateRef.current;

            // 🔥 DEFENSIVE: Verify timestamp is strictly a number
            if (typeof update.time !== 'number') {
                console.error('[Chart] ❌ Rejected update with non-numeric timestamp:', update);
                pendingUpdateRef.current = null;
                return;
            }

            // 🔥 VALIDATION: Check all OHLC values are valid numbers
            if (!update.open || !update.high || !update.low || !update.close) {
                console.error('[Chart] ❌ Rejected update with invalid OHLC:', update);
                pendingUpdateRef.current = null;
                return;
            }

            if (update.high < update.low) {
                console.error('[Chart] ❌ Rejected update: high < low', update);
                pendingUpdateRef.current = null;
                return;
            }

            // 🔥 NO TIMESTAMP VALIDATION: Store bucket logic handles this!
            // Bucket logic ensures timestamps are always correct for current interval

            // 🔥 TIMESTAMP GUARD DISABLED - Too many edge cases with interval switching
            // Store's updateCurrentCandle already handles bucketing and orderingrestrictions
            // OHLC validation above is sufficient to prevent invalid data
            // Keeping this code commented for reference:
            // if (!intervalChangeGraceRef.current && lastUpdateTimeRef.current > 0 && update.time < lastUpdateTimeRef.current) {
            //     console.warn(`[Chart] 🛡️ Ignoring past update: ${update.time} < ${lastUpdateTimeRef.current}. Skipping.`);
            //     pendingUpdateRef.current = null;
            //     return;
            // }

            try {
                console.log('[Chart] 🔄 Attempting update:', {
                    time: update.time,
                    close: update.close,
                    lastSuccessful: lastUpdateTimeRef.current
                });

                candleSeriesRef.current.update(update);

                // 🔥 NEW: Update Volume
                if (volumeSeriesRef.current && update.value !== undefined) {
                    volumeSeriesRef.current.update({
                        time: update.time,
                        value: update.value,
                        color: update.close >= update.open ? '#089981' : '#F23645'
                    });
                }

                lastUpdateTimeRef.current = update.time as number;

                // 🔥 DEACTIVATE GRACE: First successful update ends grace period
                if (intervalChangeGraceRef.current) {
                    intervalChangeGraceRef.current = false;
                    console.log(`[Chart] 🎫 Grace period DEACTIVATED - guard restored (lastUpdateTime: ${lastUpdateTimeRef.current})`);
                }

                console.log('[Chart] ✅ Update successful');
                // 🔥 REAL-TIME INDICATOR UPDATES (Incremental)
                // Wiggle the indicators with the live price!
                if (indicatorSeriesRef.current.size > 0 && activeIndicatorsRef.current.length > 0) {
                    const history = useSimulationStore.getState().candleHistory;

                    // 🔬 PROFILING: Start total indicator time
                    profiler.start('indicators_total', {
                        count: activeIndicatorsRef.current.length,
                        candles: history.length
                    });

                    // 1. Create a "Tail Buffer" (Last 100 candles + Live Candle)
                    // We don't need full history, just enough for EMA/RSI convergence (100-200 is plenty)
                    const tail = history.slice(-200).map(c => ({
                        t: c.time,
                        o: c.open,
                        h: c.high,
                        l: c.low,
                        c: c.close,
                        v: 0 // Volume not strictly needed for Price Indicators
                    }));

                    // 2. Append the live candle to the tail
                    tail.push({
                        t: update.time as number,
                        o: update.open,
                        h: update.high,
                        l: update.low,
                        c: update.close,
                        v: 0
                    });

                    // 3. Recalculate indicators on tail (incremental, not full data)
                    activeIndicatorsRef.current.forEach(indicator => {
                        const series = indicatorSeriesRef.current.get(indicator.id);
                        if (!series) return;

                        // 🔬 PROFILING: Measure each indicator
                        profiler.start(`indicator_${indicator.type}`, { candles: tail.length });

                        try {
                            const result = calculateIndicator(indicator.type, tail, indicator.period);
                            const data = result;

                            if (data && data.length > 0) {
                                const latest = data[data.length - 1];
                                series.update(latest);
                            }
                        } catch (error) {
                            console.error(`[Chart] Indicator ${indicator.type} calculation failed:`, error);
                        }

                        const duration = profiler.end(`indicator_${indicator.type}`);

                        // 🔬 KPI CHECK: Verify ≤2ms per indicator
                        if (duration !== null && duration > KPI_TARGETS.INDICATOR.PER_INDICATOR) {
                            console.warn(`[Chart] ⚠️ Indicator ${indicator.type} exceeded target: ${duration.toFixed(2)}ms > ${KPI_TARGETS.INDICATOR.PER_INDICATOR}ms`);
                        }
                    });

                    // 🔬 PROFILING: End total indicator time
                    const totalDuration = profiler.end('indicators_total');

                    // 🔬 KPI CHECK: Verify ≤15ms total
                    if (totalDuration !== null && totalDuration > KPI_TARGETS.INDICATOR.TOTAL_ALL) {
                        console.warn(`[Chart] ⚠️ Total indicators exceeded target: ${totalDuration.toFixed(2)}ms > ${KPI_TARGETS.INDICATOR.TOTAL_ALL}ms`);
                    }
                }

            } catch (err) {
                console.error('[Chart] ❌ Update failed:', formatError(err));
                console.error('[Chart] 📦 Failed update data:', update);
                console.error('[Chart] ⏰ Last successful time:', lastUpdateTimeRef.current);
                console.error('[Chart] ⏰ Attempted time:', update.time);
            }

            pendingUpdateRef.current = null;
            simTelemetry.recordCandleUpdate();
        };

        const unsubscribe = useSimulationStore.subscribe((state, prev) => {
            const currentCandle = state.currentCandle;

            // 🔥 OPTIMIZATION: Only update if currentCandle actually changed
            // Prevents unnecessary RAF scheduling when other state updates
            if (currentCandle === prevCandle) {
                return;
            }
            prevCandle = currentCandle;
            if (!currentCandle) return;

            // ⛔ SATPAM: Prevent updates before chart is initialized
            if (!isChartReady.current) {
                console.warn('[Chart] ⏸️ Update blocked: Chart not ready yet');
                return;
            }

            // 🛡️ LAYER 3 GUARD: Reject zombie ticks from old interval
            // Uses Ref instead of state to prevent stale closure issues
            // The subscription callback captures variables at creation time,
            // so using state directly would read old values. Ref always reads fresh.
            const tickInterval = state.baseInterval;
            const expectedInterval = activeIntervalRef.current;

            if (tickInterval !== expectedInterval) {
                console.warn(
                    `[Chart] 🛡️ GUARD: Rejected zombie tick from interval=${tickInterval} ` +
                    `(Active: ${expectedInterval})`
                );
                return;
            }

            // 🔥 FIX: currentCandle is already aggregated by bucket logic in store!
            // No need to validate timestamps - store handles UPDATE vs CREATE
            // 🔥 CRITICAL TIME CONVERSION: Normalize timestamp from ms/object to seconds
            let time: any = currentCandle.time; // Start as any to allow object detection

            // 🔥 DEBUG: Log original time value type
            console.log('[Chart] 📍 Original time value:', {
                value: time,
                type: typeof time,
                isObject: typeof time === 'object',
                keys: typeof time === 'object' && time !== null ? Object.keys(time) : 'N/A'
            });

            if (typeof time === 'number') {
                // Already number, just normalize
                if (time > 1e12) {
                    time = Math.floor(time / 1000); // Milliseconds to seconds
                }
            } else if (time && typeof time === 'object') {
                if (time instanceof Date) {
                    time = Math.floor(time.getTime() / 1000);
                    console.log('[Chart] 📅 Converted Date object to timestamp:', time);
                } else if ('year' in time && 'month' in time && 'day' in time) {
                    // BusinessDay format
                    const businessDate = new Date(Date.UTC(time.year, time.month - 1, time.day));
                    time = Math.floor(businessDate.getTime() / 1000);
                    console.log('[Chart] 📊 Converted BusinessDay object to timestamp:', time);
                } else {
                    console.error('[Chart] ❌ Unknown object type, keys:', Object.keys(time));
                    time = Number(time);
                }
            } else {
                // Try to extract number
                time = Number(time);
            }

            if (isNaN(time) || time <= 0) {
                console.error('[Chart] ❌ Cannot convert time to valid number, skipping update. Original:', currentCandle.time);
                return;
            }

            console.log('[Chart] ✅ Final converted time:', time);

            // 🔥 GUARD: Validate candle data
            if (!currentCandle.open || !currentCandle.close || !currentCandle.high || !currentCandle.low) {
                console.warn('[Chart] ⚠️ Invalid candle data, skipping:', currentCandle);
                return;
            }

            // Queue update for next RAF
            // 🔥 CRITICAL: Create CLEAN object with ONLY required fields
            // Lightweight-charts REJECTS updates with unknown fields!
            pendingUpdateRef.current = {
                time: time as UTCTimestamp,  // Match setData format
                open: currentCandle.open,
                high: currentCandle.high,
                low: currentCandle.low,
                close: currentCandle.close,
                value: (currentCandle as any).volume || (currentCandle as any).v, // 🔥 Capture volume
                // NO OTHER FIELDS! Chart library is strict
            };
            if (rafId === null) {
                rafId = requestAnimationFrame(flushUpdate);
            }
        });

        return () => {
            unsubscribe();
            if (rafId !== null) cancelAnimationFrame(rafId);
            prevCandle = null; // Reset tracking on cleanup
        };
    }, []);

    // --- D. INDICATORS MANAGEMENT ---
    useEffect(() => {
        if (!mainChartRef.current || !activeIndicators) return;
        if (!candleHistory || candleHistory.length === 0) return;

        // 1. Identify enabled indicators
        const enabledIndicators = activeIndicators.filter(i => i.enabled);
        const enabledIds = new Set(enabledIndicators.map(i => i.id));

        // 2. Remove disabled series
        indicatorSeriesRef.current.forEach((series, id) => {
            if (!enabledIds.has(id)) {
                mainChartRef.current!.removeSeries(series);
                indicatorSeriesRef.current.delete(id);
            }
        });

        // 3. Add/Update enabled indicators
        enabledIndicators.forEach(ind => {
            // Map ChartCandle (seconds, full keys) to Candle (t, o, h, l, c, v)
            const mapData = candleHistory.map(c => ({
                t: c.time,
                o: c.open,
                h: c.high,
                l: c.low,
                c: c.close,
                v: 0
            }));

            const data = calculateIndicator(ind.type, mapData, ind.period);
            if (!data.length) return;

            let series: ISeriesApi<any>;

            if (indicatorSeriesRef.current.has(ind.id)) {
                series = indicatorSeriesRef.current.get(ind.id)!;
            } else {
                if (['macd', 'rsi', 'volume'].includes(ind.type)) {
                    // 🔥 SEPARATE PANE (Bottom) - Unique Scale per Indicator
                    series = mainChartRef.current!.addLineSeries({
                        color: ind.color || '#2962FF',
                        lineWidth: 1,
                        priceScaleId: ind.id, // Use ID as Unique Scale ID
                    });

                    // Configure this specific scale to live in the bottom 20%
                    mainChartRef.current!.priceScale(ind.id).applyOptions({
                        borderColor: '#2B2B43',
                        scaleMargins: {
                            top: 0.8,
                            bottom: 0,
                        },
                    });
                } else if (ind.type === 'bollinger') {
                    // Overlay Main
                    series = mainChartRef.current!.addLineSeries({
                        color: ind.color || '#2962FF',
                        lineWidth: 1,
                        priceScaleId: 'right',
                    });
                } else {
                    // Overlay Main (MA, etc)
                    series = mainChartRef.current!.addLineSeries({
                        color: ind.color || '#2962FF',
                        lineWidth: 1,
                        priceScaleId: 'right',
                    });
                }
                indicatorSeriesRef.current.set(ind.id, series);
            }

            series.setData(data);
        });

    }, [activeIndicators, candleHistory]);

    // --- E. LEGEND STATE ---
    const [legendData, setLegendData] = useState<any>(null);
    const isCrosshairActiveRef = useRef(false);

    useEffect(() => {
        if (!mainChartRef.current || !candleSeriesRef.current) return;

        const updateLegend = (param: any) => {
            if (param.time) {
                isCrosshairActiveRef.current = true;
                const data = param.seriesData.get(candleSeriesRef.current!);
                if (data) {
                    setLegendData({ ...data, change: data.close - data.open });
                }
            } else {
                isCrosshairActiveRef.current = false;
                // Don't clear immediately, let the data loop take over
            }
        };

        mainChartRef.current.subscribeCrosshairMove(updateLegend);
        return () => mainChartRef.current?.unsubscribeCrosshairMove(updateLegend);
    }, []);

    // Sync Legend with Realtime Data (when crosshair idle)
    useEffect(() => {
        const syncLegend = () => {
            if (isCrosshairActiveRef.current) return;

            // Get latest from Store directly to avoid prop drilling lag
            const current = useSimulationStore.getState().currentCandle;
            if (current) {
                setLegendData({
                    ...current,
                    change: current.close - current.open
                });
            } else {
                // Fallback to last history item if no live candle
                const history = useSimulationStore.getState().candleHistory;
                if (history.length > 0) {
                    const last = history[history.length - 1];
                    setLegendData({
                        ...last,
                        change: last.close - last.open
                    });
                }
            }
        };

        // Hook into the store's high-freq updates
        // We can reuse the `raf` loop mechanism or just subscribe separately.
        // Since setLegendData triggers React Render, we should throttle this slightly?
        // Actually, React batching might handle it, but 60fps renders of text might be heavy.
        // Let's rely on the existing RAF loop (Effect C) to call a ref-based update?
        // No, Effect C is for Chart internal update().

        // Let's use a separate subscription for UI (Legend) with basic throttling (e.g. 100ms)
        // because User eye doesn't need 60fps text updates, and it saves Main Thread.

        let lastUpdate = 0;
        const unsub = useSimulationStore.subscribe((state) => {
            const now = performance.now();
            if (now - lastUpdate > 100) { // Limit UI updates to 10fps
                syncLegend();
                lastUpdate = now;
            }
        });

        return () => unsub();
    }, []);

    // Selectors
    const ticker = useSimulationStore((state) => state.currentTicker || 'BTCUSD');
    const interval = useSimulationStore((state) => state.baseInterval || '1m');

    return (
        <div className={`relative w-full h-full ${className} group`}>
            {/* 🔥 SEPARATED: Chart Container (Safe for innerHTML = '') */}
            <div ref={chartContainerRef} className="absolute inset-0 z-0" />

            {/* 🔥 DRAWING OVERLAY: z-index 10 */}
            <div className="absolute inset-0 z-10 pointer-events-none">
                <DrawingOverlay />
            </div>

            {/* LEGEND OVERLAY: z-20 but small and strictly top-left */}
            <div className="absolute top-4 left-4 z-20 font-sans pointer-events-none select-none flex flex-col gap-1">
                <div className="flex items-baseline gap-2">
                    <span className="text-lg font-bold text-[var(--text-primary)] tracking-wide drop-shadow-md">{ticker}</span>
                    <span className="text-xs font-semibold text-[var(--text-tertiary)] bg-[var(--bg-tertiary)] px-1 rounded shadow-sm">{interval}</span>
                    <span className="text-xs text-[var(--text-tertiary)] ml-2 drop-shadow-sm">M8 Market Simulation</span>
                </div>

                {legendData && (
                    <div className="flex items-center gap-4 text-xs font-mono tracking-tighter opacity-90 transition-opacity drop-shadow-md">
                        <span className={Math.abs(legendData.change) < Number.EPSILON ? "text-[var(--text-primary)]" : legendData.change > 0 ? "text-[var(--color-up)]" : "text-[var(--color-down)]"}>
                            {legendData.close?.toFixed(2)}
                            <span className="ml-1">
                                ({legendData.change > 0 ? '+' : ''}{legendData.change?.toFixed(2)})
                            </span>
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
});

// Wrapper to Provide Context
export const TradingChart = memo(function TradingChart(props: TradingChartProps) {
    return (
        <ChartProvider>
            <TradingChartInner {...props} />
        </ChartProvider>
    );
});
