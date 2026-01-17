import { createContext, useContext, useEffect, useState } from 'react';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';

interface ChartContextValue {
    chart: IChartApi | null;
    mainSeries: ISeriesApi<'Candlestick'> | null;
    setChart: (chart: IChartApi | null) => void;
    setMainSeries: (series: ISeriesApi<'Candlestick'> | null) => void;
}

const ChartContext = createContext<ChartContextValue | null>(null);

export function ChartProvider({ children }: { children: React.ReactNode }) {
    const [chart, setChart] = useState<IChartApi | null>(null);
    const [mainSeries, setMainSeries] = useState<ISeriesApi<'Candlestick'> | null>(null);

    return (
        <ChartContext.Provider value={{ chart, mainSeries, setChart, setMainSeries }}>
            {children}
        </ChartContext.Provider>
    );
}

export function useChartContext() {
    const context = useContext(ChartContext);
    if (!context) {
        throw new Error('useChartContext must be used within a ChartProvider');
    }
    return context;
}
