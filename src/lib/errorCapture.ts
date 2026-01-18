/**
 * Global Error Capture System
 * MODUL 2: The Global Observer
 * 
 * This module sets up window-level error handlers to catch:
 * - Syntax errors and undefined variables
 * - Unhandled promise rejections
 * - Console errors from third-party libraries
 */

import { useDebugStore } from '@/stores/useDebugStore';

class GlobalErrorCapture {
    private originalConsoleError: typeof console.error;
    private originalConsoleWarn: typeof console.warn;
    private isInitialized = false;

    constructor() {
        this.originalConsoleError = console.error;
        this.originalConsoleWarn = console.warn;
    }

    /**
     * Initialize all error capture handlers
     */
    public initialize() {
        if (this.isInitialized) return;
        if (typeof window === 'undefined') return; // Skip SSR

        this.setupWindowErrorHandler();
        this.setupPromiseRejectionHandler();
        this.setupConsoleHijacker();

        this.isInitialized = true;
        console.log('[GlobalObserver] 🔭 Monitoring initialized');
    }

    /**
     * Window Error Handler
     * Catches syntax errors, undefined variables, etc.
     */
    private setupWindowErrorHandler() {
        window.onerror = (message, source, lineno, colno, error) => {
            const { addLog } = useDebugStore.getState();

            addLog('GlobalObserver', 'error', `Window Error: ${message}`, {
                source,
                line: lineno,
                column: colno,
                stack: error?.stack,
                type: 'window_error'
            });

            // Also log to original console for dev tools
            this.originalConsoleError('[GlobalObserver] Window Error:', {
                message,
                source,
                lineno,
                colno,
                error
            });

            // Don't suppress the error (return false)
            return false;
        };
    }

    /**
     * Promise Rejection Handler
     * Catches async errors that weren't caught with try-catch
     */
    private setupPromiseRejectionHandler() {
        window.addEventListener('unhandledrejection', (event) => {
            const { addLog } = useDebugStore.getState();

            const reason = event.reason;
            const message = reason?.message || String(reason);

            addLog('GlobalObserver', 'error', `Unhandled Promise Rejection: ${message}`, {
                reason: reason,
                promise: event.promise,
                stack: reason?.stack,
                type: 'promise_rejection'
            });

            this.originalConsoleError('[GlobalObserver] Unhandled Promise:', reason);
        });
    }

    /**
     * Console Hijacker
     * Intercepts console.error and console.warn to also send to Flight Recorder
     */
    private setupConsoleHijacker() {
        // Hijack console.error
        console.error = (...args: any[]) => {
            const { addLog } = useDebugStore.getState();

            // Check if this is already from our error handlers to prevent loops
            const isFromObserver = args[0]?.includes?.('[GlobalObserver]');

            if (!isFromObserver) {
                const message = args.map(arg =>
                    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                ).join(' ');

                addLog('Console', 'error', message.slice(0, 500), { // Limit length
                    args: args.slice(0, 3), // First 3 args only
                    type: 'console_error'
                });
            }

            // Call original console.error
            this.originalConsoleError.apply(console, args);
        };

        // Hijack console.warn
        console.warn = (...args: any[]) => {
            const { addLog } = useDebugStore.getState();

            const message = args.map(arg =>
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ');

            addLog('Console', 'warn', message.slice(0, 500), {
                args: args.slice(0, 3),
                type: 'console_warn'
            });

            this.originalConsoleWarn.apply(console, args);
        };
    }

    /**
     * Cleanup handlers (for hot reload)
     */
    public cleanup() {
        if (!this.isInitialized) return;

        window.onerror = null;
        console.error = this.originalConsoleError;
        console.warn = this.originalConsoleWarn;

        this.isInitialized = false;
    }
}

// Singleton instance
export const globalErrorCapture = new GlobalErrorCapture();
