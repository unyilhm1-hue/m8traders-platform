/**
 * Select Component
 * Dropdown select with m8traders styling
 */
'use client';

import { forwardRef, type SelectHTMLAttributes } from 'react';

interface SelectOption {
    value: string;
    label: string;
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
    options: SelectOption[];
    size?: 'sm' | 'md' | 'lg';
    label?: string;
    error?: string;
}

const sizeStyles = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base',
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
    ({ options, size = 'md', label, error, className = '', id, ...props }, ref) => {
        const selectId = id || `select-${Math.random().toString(36).substring(7)}`;

        return (
            <div className="flex flex-col gap-1">
                {label && (
                    <label
                        htmlFor={selectId}
                        className="text-xs font-medium text-[var(--text-secondary)]"
                    >
                        {label}
                    </label>
                )}
                <select
                    ref={ref}
                    id={selectId}
                    className={`
            bg-[var(--bg-tertiary)] 
            text-[var(--text-primary)]
            border border-[var(--bg-tertiary)] 
            rounded-lg
            cursor-pointer
            transition-colors
            hover:border-[var(--bg-hover)]
            focus:outline-none focus:border-[var(--accent-primary)]
            disabled:opacity-50 disabled:cursor-not-allowed
            ${sizeStyles[size]}
            ${error ? 'border-[var(--color-loss)]' : ''}
            ${className}
          `}
                    {...props}
                >
                    {options.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
                {error && (
                    <span className="text-xs text-[var(--color-loss)]">{error}</span>
                )}
            </div>
        );
    }
);

Select.displayName = 'Select';
