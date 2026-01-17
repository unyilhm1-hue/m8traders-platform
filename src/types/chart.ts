// Chart-related type definitions

export interface Candle {
    t: number; // timestamp in ms
    o: number; // open
    h: number; // high
    l: number; // low
    c: number; // close
    v: number; // volume
}

export interface ChartConfig {
    ticker: string;
    timeframe: Timeframe;
    theme: 'dark' | 'light';
}

export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w';

export interface Ticker {
    symbol: string;
    name: string;
    market: 'US' | 'IDX';
    category?: string;
}

export interface StockDataResponse {
    ticker: string;
    timeframe: Timeframe;
    data: Candle[];
    timestamp: number;
}

export interface Indicator {
    id: string; // Unique identifier for each indicator instance
    type: IndicatorType;
    period?: number;
    enabled: boolean;
    color?: string;
}

export type IndicatorType =
    // Moving Averages
    | 'sma'
    | 'ema'
    | 'wma'
    // Oscillators
    | 'rsi'
    | 'macd'
    | 'kdj' // Stochastic
    | 'cci'
    | 'wr' // Williams %R
    | 'ao' // Awesome Oscillator
    | 'bias'
    | 'brar'
    | 'mtm' // Momentum
    | 'roc' // Rate of Change
    | 'psy' // Psychological Line
    // Volatility
    | 'bollinger'
    | 'atr'
    | 'dma'
    // Trend
    | 'adx'
    | 'sar'
    | 'trix'
    // Volume
    // Note: vwap removed - will be implemented as custom indicator
    | 'volume'
    | 'obv'
    | 'vr'; // Volume Ratio

export interface Drawing {
    id: string;
    type: DrawingType;
    points: DrawingPoint[];
    style?: DrawingStyle;
}

export type DrawingType =
    | 'line'
    | 'horizontal'
    | 'vertical'
    | 'ray'
    | 'fibonacci'
    | 'rectangle'
    | 'riskReward';

export interface DrawingPoint {
    price: number;
    timestamp: number;
}

export interface DrawingStyle {
    color: string;
    lineWidth: number;
    lineStyle: 'solid' | 'dashed' | 'dotted';
}

// Overlay types (KLineChart built-in drawing tools)
export type OverlayType =
    // Line Tools
    | 'horizontalRayLine'
    | 'horizontalSegment'
    | 'horizontalStraightLine'
    | 'verticalRayLine'
    | 'verticalSegment'
    | 'verticalStraightLine'
    | 'rayLine'
    | 'segment'
    | 'straightLine'
    // Price Tools
    | 'priceLine'
    | 'priceChannelLine'
    // Advanced Tools
    | 'parallelStraightLine'
    | 'fibonacciLine'
    | 'fibonacciCircle'
    | 'fibonacciSegment'
    | 'fibonacciSpiral'
    | 'fibonacciSpeedResistanceFan'
    | 'fibonacciExtension'
    | 'gannBox'
    | 'gannSquare'
    | 'gannFan'
    // Geometric Shapes
    | 'circle'
    | 'rect'
    | 'triangle'
    | 'parallelogram'
    // Waves & Patterns
    | 'threeWaves'
    | 'fiveWaves'
    | 'xabcd'
    | 'headAndShoulders'
    // Annotations
    | 'simpleAnnotation'
    | 'simpleTag';

export interface OverlayPoint {
    timestamp: number;
    value: number;
}

export interface OverlayStyles {
    line?: {
        style?: 'solid' | 'dashed' | 'dotted';
        size?: number;
        color?: string;
        dashedValue?: number[];
    };
    text?: {
        style?: string;
        family?: string;
        size?: number;
        color?: string;
        weight?: string | number;
    };
    polygon?: {
        fill?: {
            color?: string;
        };
        stroke?: {
            style?: 'solid' | 'dashed';
            size?: number;
            color?: string;
        };
    };
}

export interface ChartOverlay {
    id: string;
    name: OverlayType;
    groupId?: string;
    points: OverlayPoint[];
    visible: boolean;
    lock: boolean;
    mode?: 'normal' | 'weak_magnet' | 'strong_magnet';
    styles?: OverlayStyles;
    extendData?: any;
}
