/**
 * TimeframeSelector Component
 * Button group for switching chart timeframes
 */
'use client';

import { useChartStore } from '@/stores';
import type { Timeframe } from '@/types';

interface TimeframeSelectorProps {
    className?: string;
}

const TIMEFRAMES: Array<{ value: Timeframe; label: string }> = [
    { value: '1m', label: '1m' },
    { value: '5m', label: '5m' },
    { value: '15m', label: '15m' },
    { value: '30m', label: '30m' },
    { value: '1h', label: '1h' },
    { value: '4h', label: '4h' },
    { value: '1d', label: '1D' },
];

export function TimeframeSelector({ className = '' }: TimeframeSelectorProps) {
    const { timeframe, setTimeframe, loading } = useChartStore();

    const handleChange = (tf: Timeframe) => {
        if (loading) return; // Prevent changes during loading
        setTimeframe(tf);
    };

    return (
        <div className={`inline-flex items-center gap-1 bg-[var(--bg-secondary)] border border-[var(--bg-tertiary)] rounded-md p-1 ${className}`}>
            {TIMEFRAMES.map((tf) => (
                <button
                    key={tf.value}
                    onClick={() => handleChange(tf.value)}
                    disabled={loading}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-all ${timeframe === tf.value
                            ? 'bg-[var(--accent-primary)] text-white shadow-sm'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                        } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                    {tf.label}
                </button>
            ))}
        </div>
    );
}
