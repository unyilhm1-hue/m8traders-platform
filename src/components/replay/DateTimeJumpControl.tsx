'use client';

import { useState } from 'react';
import { isMarketOpen, getNextOpenTime, getSessionInfo } from '@/lib/replay';

interface DateTimeJumpControlProps {
    onJump: (timestamp: number) => void;
    minDate?: Date;
    maxDate?: Date;
    className?: string;
}

export function DateTimeJumpControl({
    onJump,
    minDate,
    maxDate,
    className = '',
}: DateTimeJumpControlProps) {
    const [date, setDate] = useState<string>(
        minDate ? minDate.toISOString().split('T')[0] : ''
    );
    const [time, setTime] = useState<string>('09:00');
    const [warning, setWarning] = useState<string>('');

    const handleJump = () => {
        if (!date) {
            setWarning('Please select a date');
            return;
        }

        const [hours, minutes] = time.split(':').map(Number);
        const jumpDate = new Date(date);
        jumpDate.setHours(hours, minutes, 0, 0);

        const timestamp = jumpDate.getTime();

        // Validate market hours
        if (!isMarketOpen(timestamp)) {
            const sessionInfo = getSessionInfo(timestamp);
            const nextOpen = getNextOpenTime(timestamp);
            const nextDate = new Date(nextOpen);

            setWarning(
                `Market is ${sessionInfo.session} at this time. Auto-adjusting to ${nextDate.toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                })}`
            );

            // Use next open time
            setTimeout(() => {
                onJump(nextOpen);
                setWarning('');
            }, 1500);
        } else {
            setWarning('');
            onJump(timestamp);
        }
    };

    const handleQuickJump = (preset: 'open' | 'close' | 'lunch') => {
        if (!date) {
            setWarning('Please select a date first');
            return;
        }

        const jumpDate = new Date(date);
        const day = jumpDate.getDay();
        const isFriday = day === 5;

        switch (preset) {
            case 'open':
                setTime('09:00');
                break;
            case 'lunch':
                setTime(isFriday ? '11:30' : '12:00');
                break;
            case 'close':
                setTime('16:00');
                break;
        }
    };

    // NEW: Month quick jump (jump to first trading day of month at 09:00)
    const handleMonthJump = (monthIndex: number) => {
        const firstDayOfMonth = new Date(2025, monthIndex, 1, 9, 0);
        setDate(firstDayOfMonth.toISOString().split('T')[0]);
        setTime('09:00');

        // Auto jump
        const timestamp = firstDayOfMonth.getTime();
        onJump(timestamp);
    };

    const MONTHS_2025 = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    return (
        <div className={`flex flex-col gap-2 ${className}`}>
            <div className="flex gap-2 items-center">
                <input
                    type="date"
                    value={date}
                    min={minDate?.toISOString().split('T')[0]}
                    max={maxDate?.toISOString().split('T')[0]}
                    onChange={(e) => setDate(e.target.value)}
                    className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
                />
                <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
                />
                <button
                    onClick={handleJump}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium transition-colors"
                >
                    Jump
                </button>
            </div>

            {/* Quick jump buttons */}
            <div className="flex gap-2">
                <button
                    onClick={() => handleQuickJump('open')}
                    className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors"
                    title="Market Open (09:00)"
                >
                    Open
                </button>
                <button
                    onClick={() => handleQuickJump('lunch')}
                    className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors"
                    title="Lunch Break"
                >
                    Lunch
                </button>
                <button
                    onClick={() => handleQuickJump('close')}
                    className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors"
                    title="Market Close (16:00)"
                >
                    Close
                </button>
            </div>

            {/* NEW: Month selector */}
            <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-400">Jump to Month (2025)</label>
                <select
                    onChange={(e) => handleMonthJump(parseInt(e.target.value))}
                    className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
                    defaultValue=""
                >
                    <option value="" disabled>Select month...</option>
                    {MONTHS_2025.map((month, idx) => (
                        <option key={idx} value={idx}>{month} 2025</option>
                    ))}
                </select>
            </div>

            {/* Warning message */}
            {warning && (
                <div className="text-xs text-yellow-400 bg-yellow-900/20 px-3 py-2 rounded border border-yellow-700/30">
                    ⚠️ {warning}
                </div>
            )}
        </div>
    );
}
