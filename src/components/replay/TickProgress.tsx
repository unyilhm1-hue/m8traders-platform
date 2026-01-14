'use client';

interface TickProgressProps {
    currentTick: number;
    totalTicks: number;
    className?: string;
}

export function TickProgress({
    currentTick,
    totalTicks,
    className = '',
}: TickProgressProps) {
    const progress = totalTicks > 0 ? (currentTick / totalTicks) * 100 : 0;

    return (
        <div className={`flex flex-col gap-1 ${className}`}>
            <div className="flex justify-between text-xs text-gray-400">
                <span>Intra-Candle Progress</span>
                <span>
                    {currentTick + 1} / {totalTicks} ticks
                </span>
            </div>
            <div className="relative h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-150"
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
    );
}
