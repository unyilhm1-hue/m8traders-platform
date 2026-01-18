/**
 * Simulation Controls Component
 * Play/Pause, Speed, and Date Selection
 */
'use client';

import { useState } from 'react';
import { Calendar, Play, Pause } from 'lucide-react';
import { useSimulationEngineContext } from '@/contexts/SimulationEngineContext';
import { useSelectedDate } from '@/stores/useSimulationStore';
import { DateSelectorModal } from '../simulation/DateSelectorModal';
import { Select } from '../ui/Select';

export function SimulationControls() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    // const [isPlaying, setIsPlaying] = useState(false); // ❌ Removed local state
    const [speed, setSpeed] = useState(1);
    const selectedDate = useSelectedDate();

    // ✅ Get shared engine from context (no duplicate worker!)
    const { engine, isReady } = useSimulationEngineContext();

    const speedOptions = [
        { label: '1x', value: '1' },
        { label: '2x', value: '2' },
        { label: '5x', value: '5' },
        { label: '10x', value: '10' },
    ];

    const handleDateSelected = (date: string) => {
        console.log(`[SimulationControls] Date selected: ${date}`);
        // TODO: Initialize worker with simulation candles from store
    };

    const isControlsEnabled = !!selectedDate || isReady;

    const handlePlayPause = () => {
        if (!isControlsEnabled) {
            alert('Please select a date first');
            return;
        }

        if (engine.isPlaying) {
            engine.pause();
        } else {
            engine.play(speed);
        }
    };

    return (
        <>
            <div className="flex items-center gap-2">
                {/* Date Selector Button */}
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="
                        flex items-center gap-2 px-3 py-1.5
                        bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)]
                        text-[var(--text-primary)]
                        text-sm rounded
                        transition-colors
                        border border-transparent hover:border-[var(--bg-subtle-border)]
                    "
                >
                    <Calendar size={14} className="text-[var(--text-secondary)]" />
                    <span>{selectedDate || 'Select Date'}</span>
                </button>

                {/* Play/Pause */}
                <button
                    onClick={handlePlayPause}
                    disabled={!isControlsEnabled}
                    className={`
                        w-8 h-8 flex items-center justify-center rounded-full transition-all
                        ${engine.isPlaying
                            ? 'bg-[var(--accent-primary)] text-white glow-primary hover:bg-[var(--accent-primary)]/90'
                            : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                        }
                        disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                    title={engine.isPlaying ? 'Pause [Space]' : 'Play [Space]'}
                >
                    {engine.isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                </button>

                {/* Speed Selector */}
                <Select
                    value={String(speed)}
                    onChange={(val) => {
                        const newSpeed = Number(val);
                        setSpeed(newSpeed);
                        engine.setSpeed(newSpeed);
                    }}
                    options={speedOptions}
                    className="w-[80px]"
                    disabled={!isControlsEnabled}
                />
            </div>

            {/* Date Selector Modal */}
            <DateSelectorModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onDateSelected={handleDateSelected}
            />
        </>
    );
}
