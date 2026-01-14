/**
 * Input Component
 * Text input with m8traders styling
 */
'use client';

import { forwardRef, useState, useEffect, type InputHTMLAttributes } from 'react';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
    size?: 'sm' | 'md' | 'lg';
    label?: string;
    error?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

const sizeStyles = {
    sm: 'px-2 py-1.5 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
    (
        { size = 'md', label, error, leftIcon, rightIcon, className = '', id, ...props },
        ref
    ) => {
        // Generate stable ID only on client-side to avoid hydration mismatch
        const [generatedId, setGeneratedId] = useState<string>('');

        useEffect(() => {
            if (!id && !generatedId) {
                setGeneratedId(`input-${Math.random().toString(36).substring(7)}`);
            }
        }, [id, generatedId]);

        const inputId = id || generatedId;

        return (
            <div className="flex flex-col gap-1">
                {label && (
                    <label
                        htmlFor={inputId}
                        className="text-xs font-medium text-[var(--text-secondary)]"
                    >
                        {label}
                    </label>
                )}
                <div className="relative">
                    {leftIcon && (
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">
                            {leftIcon}
                        </span>
                    )}
                    <input
                        ref={ref}
                        id={inputId}
                        className={`
              w-full
              bg-[var(--bg-tertiary)] 
              text-[var(--text-primary)]
              border border-[var(--bg-tertiary)] 
              rounded-lg
              transition-colors
              placeholder:text-[var(--text-tertiary)]
              hover:border-[var(--bg-hover)]
              focus:outline-none focus:border-[var(--accent-primary)]
              disabled:opacity-50 disabled:cursor-not-allowed
              ${sizeStyles[size]}
              ${leftIcon ? 'pl-10' : ''}
              ${rightIcon ? 'pr-10' : ''}
              ${error ? 'border-[var(--color-loss)]' : ''}
              ${className}
            `}
                        {...props}
                    />
                    {rightIcon && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">
                            {rightIcon}
                        </span>
                    )}
                </div>
                {error && (
                    <span className="text-xs text-[var(--color-loss)]">{error}</span>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';
