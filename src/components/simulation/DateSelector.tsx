/**
 * Date Selector Component
 * Select a specific date for intraday replay simulation
 */
'use client';

import { useState } from 'react';
import { useSimulationStore } from '@/stores/useSimulationStore';
import { Calendar } from 'lucide-react';

interface DateSelectorProps {
    onDateSelected?: (date: string) => void;
}

export function DateSelector({ onDateSelected }: DateSelectorProps) {
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const loadSimulationDay = useSimulationStore((s) => s.loadSimulationDay);

    const handleDateChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const date = e.target.value;
        setSelectedDate(date);
    };

    const handleLoadDate = async () => {
        if (!selectedDate) return;

        setIsLoading(true);
        try {
            // Fetch full dataset from API
            console.log(`[DateSelector] Fetching data for ${selectedDate}...`);
            const response = await fetch('/api/simulation/start');
            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to load data');
            }

            const { candles } = result.data;
            console.log(`[DateSelector] Loaded ${candles.length} candles from API`);

            // Split data using store action
            const { historyCount, simCount, error } = loadSimulationDay(selectedDate, candles);

            // Check for errors
            if (error) {
                alert(`❌ Error: ${error}\n\nPlease select a different date.`);
                return;
            }

            // Check for empty simulation
            if (simCount === 0) {
                const dayOfWeek = new Date(selectedDate).getDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                alert(
                    `❌ No simulation data available for ${selectedDate}\n\n` +
                    `${isWeekend ? '⚠️ This is a weekend day - market is closed.\n\n' : ''}` +
                    `Possible reasons:\n` +
                    `- Market was closed (holiday/weekend)\n` +
                    `- No data for this date in dataset\n` +
                    `- Data not available\n\n` +
                    `Try selecting a different date.`
                );
                return;
            }

            console.log(`[DateSelector] ✅ Date loaded successfully!`);
            console.log(`  - History Context: ${historyCount} candles`);
            console.log(`  - Simulation Queue: ${simCount} candles for ${selectedDate}`);

            // Notify parent
            if (onDateSelected) {
                onDateSelected(selectedDate);
            }
        } catch (error) {
            console.error('[DateSelector] Error loading date:', error);
            alert('Failed to load simulation data. Check console for details.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center gap-2 p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--bg-subtle-border)]">
            <Calendar className="w-4 h-4 text-[var(--text-secondary)]" />
            <input
                type="date"
                value={selectedDate}
                onChange={handleDateChange}
                disabled={isLoading}
                className="
                    flex-1 px-3 py-2 
                    bg-[var(--bg-tertiary)] 
                    border border-[var(--bg-subtle-border)] 
                    rounded-md
                    text-sm text-[var(--text-primary)]
                    focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]
                    disabled:opacity-50 disabled:cursor-not-allowed
                "
            />
            <button
                onClick={handleLoadDate}
                disabled={!selectedDate || isLoading}
                className="
                    px-4 py-2 
                    bg-[var(--color-primary)] 
                    text-white 
                    rounded-md 
                    text-sm font-medium
                    hover:bg-[var(--color-primary-hover)]
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-colors
                "
            >
                {isLoading ? 'Loading...' : 'Load Date'}
            </button>
        </div>
    );
}
