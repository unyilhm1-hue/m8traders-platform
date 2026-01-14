/**
 * KLineChart Configuration
 */
import type { Timeframe, IndicatorType } from '@/types';

/**
 * Timeframe options with display labels
 */
export const TIMEFRAME_OPTIONS: { value: Timeframe; label: string; minutes: number }[] = [
    { value: '1m', label: '1m', minutes: 1 },
    { value: '5m', label: '5m', minutes: 5 },
    { value: '15m', label: '15m', minutes: 15 },
    { value: '30m', label: '30m', minutes: 30 },
    { value: '1h', label: '1H', minutes: 60 },
    { value: '4h', label: '4H', minutes: 240 },
    { value: '1d', label: '1D', minutes: 1440 },
    { value: '1w', label: '1W', minutes: 10080 },
];

/**
 * Indicator configurations
 */
export const INDICATOR_CONFIG: Record<IndicatorType, {
    name: string;
    description: string;
    defaultPeriod?: number;
    pane: 'main' | 'sub';
}> = {
    // Moving Averages
    sma: {
        name: 'SMA',
        description: 'Simple Moving Average',
        defaultPeriod: 20,
        pane: 'main',
    },
    ema: {
        name: 'EMA',
        description: 'Exponential Moving Average',
        defaultPeriod: 12,
        pane: 'main',
    },
    wma: {
        name: 'WMA',
        description: 'Weighted Moving Average',
        defaultPeriod: 20,
        pane: 'main',
    },
    // Oscillators
    rsi: {
        name: 'RSI',
        description: 'Relative Strength Index',
        defaultPeriod: 14,
        pane: 'sub',
    },
    macd: {
        name: 'MACD',
        description: 'Moving Average Convergence Divergence',
        pane: 'sub',
    },
    kdj: {
        name: 'KDJ',
        description: 'Stochastic Oscillator',
        defaultPeriod: 14,
        pane: 'sub',
    },
    cci: {
        name: 'CCI',
        description: 'Commodity Channel Index',
        defaultPeriod: 20,
        pane: 'sub',
    },
    wr: {
        name: 'WR',
        description: 'Williams %R',
        defaultPeriod: 14,
        pane: 'sub',
    },
    ao: {
        name: 'AO',
        description: 'Awesome Oscillator',
        pane: 'sub',
    },
    bias: {
        name: 'BIAS',
        description: 'Bias Ratio',
        defaultPeriod: 24,
        pane: 'sub',
    },
    brar: {
        name: 'BRAR',
        description: 'Sentiment Indicator',
        defaultPeriod: 26,
        pane: 'sub',
    },
    mtm: {
        name: 'MTM',
        description: 'Momentum',
        defaultPeriod: 12,
        pane: 'sub',
    },
    roc: {
        name: 'ROC',
        description: 'Rate of Change',
        defaultPeriod: 12,
        pane: 'sub',
    },
    psy: {
        name: 'PSY',
        description: 'Psychological Line',
        defaultPeriod: 12,
        pane: 'sub',
    },
    trix: {
        name: 'TRIX',
        description: 'Triple Exponential Average',
        defaultPeriod: 12,
        pane: 'sub',
    },
    // Volatility
    bollinger: {
        name: 'BOLL',
        description: 'Bollinger Bands',
        defaultPeriod: 20,
        pane: 'main',
    },
    atr: {
        name: 'ATR',
        description: 'Average True Range',
        defaultPeriod: 14,
        pane: 'sub',
    },
    dma: {
        name: 'DMA',
        description: 'Different of Moving Average',
        defaultPeriod: 10,
        pane: 'sub',
    },
    // Trend
    adx: {
        name: 'ADX',
        description: 'Average Directional Index',
        defaultPeriod: 14,
        pane: 'sub',
    },
    sar: {
        name: 'SAR',
        description: 'Parabolic SAR',
        pane: 'main',
    },
    // Volume
    // Note: VWAP not included - requires custom indicator implementation
    // Will be added via registerIndicator() in future update
    obv: {
        name: 'OBV',
        description: 'On-Balance Volume',
        pane: 'sub',
    },
    vr: {
        name: 'VR',
        description: 'Volume Ratio',
        defaultPeriod: 26,
        pane: 'sub',
    },
};

/**
 * Drawing tool configurations (KLineChart Overlays)
 */
export const DRAWING_TOOLS: Record<
    string,
    {
        name: string;
        icon: string;
        description: string;
        category: 'line' | 'price' | 'advanced' | 'annotation';
        totalStep: number;
    }
> = {
    // Horizontal Lines
    horizontalRayLine: {
        name: 'H Ray',
        icon: '→',
        description: 'Horizontal ray line',
        category: 'line',
        totalStep: 1,
    },
    horizontalSegment: {
        name: 'H Segment',
        icon: '⟷',
        description: 'Horizontal line segment',
        category: 'line',
        totalStep: 2,
    },
    horizontalStraightLine: {
        name: 'H Line',
        icon: '━',
        description: 'Horizontal infinite line',
        category: 'line',
        totalStep: 1,
    },

    // Vertical Lines
    verticalRayLine: {
        name: 'V Ray',
        icon: '↓',
        description: 'Vertical ray line',
        category: 'line',
        totalStep: 1,
    },
    verticalSegment: {
        name: 'V Segment',
        icon: '↕',
        description: 'Vertical line segment',
        category: 'line',
        totalStep: 2,
    },
    verticalStraightLine: {
        name: 'V Line',
        icon: '┃',
        description: 'Vertical infinite line',
        category: 'line',
        totalStep: 1,
    },

    // Trend Lines
    rayLine: {
        name: 'Ray',
        icon: '📈',
        description: 'Trend ray line',
        category: 'line',
        totalStep: 2,
    },
    segment: {
        name: 'Segment',
        icon: '/',
        description: 'Trend line segment',
        category: 'line',
        totalStep: 2,
    },
    straightLine: {
        name: 'Trendline',
        icon: '📊',
        description: 'Trend infinite line',
        category: 'line',
        totalStep: 2,
    },

    // Price Tools
    priceLine: {
        name: 'Price Line',
        icon: '💲',
        description: 'Price level line with label',
        category: 'price',
        totalStep: 1,
    },
    priceChannelLine: {
        name: 'Channel',
        icon: '📐',
        description: 'Price channel (parallel lines)',
        category: 'price',
        totalStep: 3,
    },

    // Advanced Tools
    parallelStraightLine: {
        name: 'Parallel',
        icon: '⫴',
        description: 'Parallel straight lines',
        category: 'advanced',
        totalStep: 3,
    },
    fibonacciLine: {
        name: 'Fib Retracement',
        icon: '🔢',
        description: 'Fibonacci retracement levels',
        category: 'advanced',
        totalStep: 2,
    },
    fibonacciCircle: {
        name: 'Fib Circle',
        icon: '⭕',
        description: 'Fibonacci Circles',
        category: 'advanced',
        totalStep: 2,
    },
    fibonacciSegment: {
        name: 'Fib Segment',
        icon: 'F',
        description: 'Fibonacci Segment',
        category: 'advanced',
        totalStep: 2,
    },
    fibonacciSpiral: {
        name: 'Fib Spiral',
        icon: '꩜',
        description: 'Fibonacci Spiral',
        category: 'advanced',
        totalStep: 2,
    },
    fibonacciSpeedResistanceFan: {
        name: 'Fib Fan',
        icon: 'F',
        description: 'Fibonacci Speed Resistance Fan',
        category: 'advanced',
        totalStep: 2,
    },
    fibonacciExtension: {
        name: 'Fib Extension',
        icon: 'F',
        description: 'Fibonacci Extension',
        category: 'advanced',
        totalStep: 3,
    },
    gannBox: {
        name: 'Gann Box',
        icon: 'G',
        description: 'Gann Box',
        category: 'advanced',
        totalStep: 2,
    },
    gannSquare: {
        name: 'Gann Square',
        icon: 'G',
        description: 'Gann Square',
        category: 'advanced',
        totalStep: 2,
    },
    gannFan: {
        name: 'Gann Fan',
        icon: 'G',
        description: 'Gann Fan',
        category: 'advanced',
        totalStep: 2,
    },

    // Geometric Shapes
    circle: {
        name: 'Circle',
        icon: '⚪',
        description: 'Circle shape',
        category: 'annotation',
        totalStep: 2,
    },
    rect: {
        name: 'Rectangle',
        icon: '⬜',
        description: 'Rectangle shape',
        category: 'annotation',
        totalStep: 2,
    },
    triangle: {
        name: 'Triangle',
        icon: '🔺',
        description: 'Triangle shape',
        category: 'annotation',
        totalStep: 3,
    },
    parallelogram: {
        name: 'Parallelogram',
        icon: '▱',
        description: 'Parallelogram shape',
        category: 'annotation',
        totalStep: 3,
    },

    // Waves & Patterns
    threeWaves: {
        name: 'Elliott 3',
        icon: '3',
        description: 'Elliott Wave (3 points)',
        category: 'advanced',
        totalStep: 3,
    },
    fiveWaves: {
        name: 'Elliott 5',
        icon: '5',
        description: 'Elliott Wave (5 points)',
        category: 'advanced',
        totalStep: 5,
    },
    xabcd: {
        name: 'XABCD',
        icon: 'X',
        description: 'XABCD Pattern',
        category: 'advanced',
        totalStep: 5,
    },
    headAndShoulders: {
        name: 'Head & Shoulders',
        icon: 'H',
        description: 'Head and Shoulders Pattern',
        category: 'advanced',
        totalStep: 5, // Check steps
    },

    // Annotations
    simpleAnnotation: {
        name: 'Note',
        icon: '📝',
        description: 'Text annotation',
        category: 'annotation',
        totalStep: 1,
    },
    simpleTag: {
        name: 'Tag',
        icon: '🏷️',
        description: 'Tag marker',
        category: 'annotation',
        totalStep: 1,
    },
} as const;

/**
 * Playback speed options
 */
export const PLAYBACK_SPEEDS = [
    { value: 0.5, label: '0.5x' },
    { value: 1, label: '1x' },
    { value: 2, label: '2x' },
    { value: 5, label: '5x' },
    { value: 10, label: '10x' },
];

/**
 * Chart defaults
 */
export const CHART_DEFAULTS = {
    visibleBars: 100,
    minVisibleBars: 20,
    maxVisibleBars: 500,
    volumeHeight: 60,
    indicatorHeight: 100,
};
