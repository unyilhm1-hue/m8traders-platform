/**
 * AverageCalculator Component
 * Simple calculator for average buy price
 */
'use client';

import { useState, useRef, useEffect } from 'react';
import { UI_ICONS } from '@/lib/chart/icons';
import { Portal } from '@/components/ui/Portal';

export function AverageCalculator() {
    const [isOpen, setIsOpen] = useState(false);
    const [entries, setEntries] = useState<Array<{ price: number; shares: number }>>([
        { price: 0, shares: 0 },
    ]);
    const { Calculator } = UI_ICONS;

    const triggerRef = useRef<HTMLButtonElement>(null);
    const [position, setPosition] = useState({ top: 0, left: 0 });

    const addEntry = () => {
        setEntries([...entries, { price: 0, shares: 0 }]);
    };

    const updateEntry = (index: number, field: 'price' | 'shares', value: string) => {
        const newEntries = [...entries];
        newEntries[index][field] = parseFloat(value) || 0;
        setEntries(newEntries);
    };

    const removeEntry = (index: number) => {
        if (entries.length > 1) {
            setEntries(entries.filter((_, i) => i !== index));
        }
    };

    const calculate = () => {
        const totalCost = entries.reduce((sum, entry) => sum + entry.price * entry.shares, 0);
        const totalShares = entries.reduce((sum, entry) => sum + entry.shares, 0);
        return totalShares > 0 ? totalCost / totalShares : 0;
    };

    const avgPrice = calculate();

    // Calculate position when opening
    useEffect(() => {
        if (isOpen && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setPosition({
                top: rect.bottom + window.scrollY + 4,
                left: rect.left + window.scrollX
            });
        }
    }, [isOpen]);

    // Handle scroll/resize to close or update
    useEffect(() => {
        if (!isOpen) return;
        const handleScroll = () => setIsOpen(false); // Close on scroll for simplicity
        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', handleScroll);
        return () => {
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', handleScroll);
        };
    }, [isOpen]);

    // Click outside to close
    useEffect(() => {
        if (!isOpen) return;
        function handleClickOutside(event: MouseEvent) {
            const dropdown = document.getElementById('calc-dropdown');
            if (triggerRef.current && !triggerRef.current.contains(event.target as Node) && dropdown && !dropdown.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    return (
        <div className="relative">
            {/* Toggle Button */}
            <button
                ref={triggerRef}
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    flex items-center gap-2 px-3 py-1.5 rounded transition-all border border-transparent
                    ${isOpen
                        ? 'bg-[var(--accent-primary)] text-white shadow-lg shadow-[var(--accent-primary)]/20'
                        : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] hover:border-[var(--bg-subtle-border)]'
                    }
                `}
                title="Average Calculator"
            >
                <Calculator size={14} className={isOpen ? 'text-white' : 'text-[var(--text-secondary)]'} />
                <span className="text-sm font-medium">Calc</span>
            </button>

            {/* Calculator Modal via Portal */}
            {isOpen && (
                <Portal>
                    <div
                        id="calc-dropdown"
                        className="fixed z-[9999] bg-[var(--bg-primary)] border border-[var(--bg-tertiary)] rounded-lg shadow-2xl p-4 min-w-[320px] animate-in fade-in zoom-in-95 duration-100"
                        style={{
                            top: position.top - window.scrollY,
                            left: position.left - window.scrollX
                        }}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-[var(--text-primary)]">
                                Average Calculator
                            </h3>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Entries */}
                        <div className="space-y-2 mb-4 max-h-[300px] overflow-y-auto pr-1">
                            {entries.map((entry, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        placeholder="Price"
                                        value={entry.price || ''}
                                        onChange={(e) => updateEntry(index, 'price', e.target.value)}
                                        className="flex-1 px-2 py-1.5 bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded text-sm border border-[var(--bg-tertiary)] focus:outline-none focus:border-[var(--accent-primary)]"
                                    />
                                    <span className="text-[var(--text-tertiary)]">×</span>
                                    <input
                                        type="number"
                                        placeholder="Shares"
                                        value={entry.shares || ''}
                                        onChange={(e) => updateEntry(index, 'shares', e.target.value)}
                                        className="flex-1 px-2 py-1.5 bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded text-sm border border-[var(--bg-tertiary)] focus:outline-none focus:border-[var(--accent-primary)]"
                                    />
                                    {entries.length > 1 && (
                                        <button
                                            onClick={() => removeEntry(index)}
                                            className="text-red-500 hover:text-red-400 text-sm"
                                        >
                                            🗑️
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Add Entry Button */}
                        <button
                            onClick={addEntry}
                            className="w-full py-1.5 mb-4 bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded text-sm hover:bg-[var(--bg-tertiary)] transition-colors"
                        >
                            + Add Entry
                        </button>

                        {/* Result */}
                        <div className="pt-4 border-t border-[var(--bg-tertiary)]">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-[var(--text-secondary)]">
                                    Average Price:
                                </span>
                                <span className="text-lg font-bold text-[var(--accent-primary)]">
                                    ${avgPrice.toFixed(2)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between mt-2 text-xs text-[var(--text-tertiary)]">
                                <span>Total Shares:</span>
                                <span>{entries.reduce((sum, e) => sum + e.shares, 0)}</span>
                            </div>
                        </div>
                    </div>
                </Portal>
            )}
        </div>
    );
}
