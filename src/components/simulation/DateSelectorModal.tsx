/**
 * DateSelectorModal Component
 * Modal popup for selecting simulation date
 */
'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { DateSelector } from './DateSelector';

interface DateSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onDateSelected: (date: string) => void;
}

export function DateSelectorModal({ isOpen, onClose, onDateSelected }: DateSelectorModalProps) {
    if (!isOpen) return null;

    const handleDateSelected = (date: string) => {
        onDateSelected(date);
        onClose();
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-0 flex items-center justify-center z-[101] p-4">
                <div
                    className="
                        bg-[var(--bg-secondary)] 
                        border border-[var(--bg-subtle-border)]
                        rounded-xl
                        shadow-2xl
                        w-full max-w-md
                        animate-in fade-in zoom-in-95 duration-200
                    "
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-[var(--bg-subtle-border)]">
                        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                            Select Simulation Date
                        </h2>
                        <button
                            onClick={onClose}
                            className="
                                w-8 h-8 flex items-center justify-center
                                rounded-lg
                                text-[var(--text-secondary)]
                                hover:text-[var(--text-primary)]
                                hover:bg-[var(--bg-tertiary)]
                                transition-colors
                            "
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        <p className="text-sm text-[var(--text-secondary)] mb-4">
                            Choose a date to replay intraday market movements. Historical context will be loaded automatically.
                        </p>
                        <DateSelector onDateSelected={handleDateSelected} />
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-[var(--bg-subtle-border)] bg-[var(--bg-tertiary)]/50 rounded-b-xl">
                        <p className="text-xs text-[var(--text-tertiary)]">
                            💡 <strong>Tip:</strong> Historical candles before the selected date will be shown for context.
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}
