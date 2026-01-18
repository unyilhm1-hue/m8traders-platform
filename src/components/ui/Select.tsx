'use client';

import React, { useState, useRef, useEffect } from 'react';

export interface SelectOption {
    label: string;
    value: string;
    icon?: React.ReactNode;
}

interface SelectProps {
    value: string;
    onChange: (value: string) => void;
    options: SelectOption[];
    placeholder?: string;
    className?: string; // for container
    triggerClassName?: string;
    disabled?: boolean;
}

/**
 * Custom Select Component
 * Replaces native <select> for a more premium, customizable look.
 */
export function Select({
    value,
    onChange,
    options,
    placeholder = 'Select...',
    className = '',
    triggerClassName = '',
    disabled = false
}: SelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });

    const selectedOption = options.find(opt => opt.value === value);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (disabled) return;
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                // Check if click is inside the portal dropdown
                const dropdown = document.getElementById(`select-dropdown-${placeholder.replace(/\s/g, '')}`);
                if (dropdown && dropdown.contains(event.target as Node)) {
                    return;
                }
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [placeholder, disabled]);

    // Calculate position when opening
    useEffect(() => {
        if (isOpen && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setPosition({
                top: rect.bottom + window.scrollY + 4, // 4px offset
                left: rect.left + window.scrollX,
                width: rect.width
            });
        }
    }, [isOpen]);

    // Handle scroll to update position or close
    useEffect(() => {
        if (!isOpen) return;
        const handleScroll = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setPosition({
                    top: rect.bottom + window.scrollY + 4,
                    left: rect.left + window.scrollX,
                    width: rect.width
                });
            }
        };
        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', handleScroll);
        return () => {
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', handleScroll);
        };
    }, [isOpen]);

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`
                    flex items-center justify-between gap-2 px-3 py-1.5 
                    bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] 
                    text-[var(--text-primary)] text-sm rounded transition-colors
                    border border-transparent focus:border-[var(--accent-primary)]
                    min-w-[100px] w-full
                    disabled:opacity-50 disabled:cursor-not-allowed
                    ${triggerClassName}
                `}
            >
                <div className="flex items-center gap-2 truncate">
                    {selectedOption?.icon && <span className="opacity-80">{selectedOption.icon}</span>}
                    <span className="truncate">{selectedOption?.label || placeholder}</span>
                </div>

                {/* Chevron */}
                <svg
                    width="10"
                    height="6"
                    viewBox="0 0 10 6"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className={`transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                >
                    <path
                        d="M1 1L5 5L9 1"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-[var(--text-secondary)]"
                    />
                </svg>
            </button>

            {/* Dropdown Menu via Portal */}
            {isOpen && (
                <div
                    id={`select-dropdown-${placeholder.replace(/\s/g, '')}`}
                    className="fixed z-[9999] rounded-lg border border-[var(--bg-subtle-border)] bg-[var(--bg-secondary)] shadow-xl animate-in fade-in zoom-in-95 duration-100 overflow-y-auto max-h-[300px]"
                    style={{
                        top: position.top - window.scrollY, // Adjust for fixed position relative to viewport
                        left: position.left - window.scrollX,
                        width: Math.max(position.width, 140) // Min width 140px
                    }}
                >
                    <div className="p-1">
                        {options.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => {
                                    onChange(option.value);
                                    setIsOpen(false);
                                }}
                                className={`
                                    w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md text-left transition-colors
                                    ${value === option.value
                                        ? 'bg-[var(--accent-primary)] text-white font-medium'
                                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                                    }
                                `}
                            >
                                {option.icon && <span className={value === option.value ? 'text-white' : 'opacity-70'}>{option.icon}</span>}
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
