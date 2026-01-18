/**
 * MODUL 2: Structured Logger with Source Tags
 * Tags every log with its source layer: [UI]/[STORE]/[NETWORK]/[WORKER]
 */

import { useDebugStore } from '@/stores/useDebugStore';
import { translateError } from './errorTranslator';

export type LogSource = 'UI' | 'STORE' | 'NETWORK' | 'WORKER';
export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';

export interface StructuredLog {
    timestamp: number;
    source: LogSource;
    level: LogLevel;
    message: string;
    details?: any;
}

/**
 * Core logging function that routes to Debug Store
 */
function log(source: LogSource, level: LogLevel, message: string, details?: any) {
    const timestamp = Date.now();

    // Route to Debug Store
    const addLog = useDebugStore.getState().addLog;

    // Format message with source tag
    const taggedMessage = `[${source}] ${message}`;

    // Determine log type for Debug Store
    let logType: 'info' | 'warn' | 'error' | 'critical' = 'info';
    if (level === 'WARN') logType = 'warn';
    if (level === 'ERROR') logType = 'error';
    if (level === 'CRITICAL') logType = 'critical';

    addLog(taggedMessage, logType, details);

    // Also log to console with appropriate method
    const consoleMsg = `[${new Date(timestamp).toLocaleTimeString()}] ${taggedMessage}`;

    switch (level) {
        case 'CRITICAL':
        case 'ERROR':
            console.error(consoleMsg, details || '');
            break;
        case 'WARN':
            console.warn(consoleMsg, details || '');
            break;
        default:
            console.log(consoleMsg, details || '');
    }
}

/**
 * UI Layer Logger
 * Use for: React components, user interactions, visual errors
 */
export const uiLog = {
    info: (message: string, details?: any) => log('UI', 'INFO', message, details),
    warn: (message: string, details?: any) => log('UI', 'WARN', message, details),
    error: (message: string, error?: unknown) => {
        const translated = error ? translateError(error) : undefined;
        log('UI', 'ERROR', message, translated);
    },
    critical: (message: string, error?: unknown) => {
        const translated = error ? translateError(error) : undefined;
        log('UI', 'CRITICAL', message, translated);
    }
};

/**
 * Store Layer Logger
 * Use for: Zustand stores, state management, business logic
 */
export const storeLog = {
    info: (message: string, details?: any) => log('STORE', 'INFO', message, details),
    warn: (message: string, details?: any) => log('STORE', 'WARN', message, details),
    error: (message: string, error?: unknown) => {
        const translated = error ? translateError(error) : undefined;
        log('STORE', 'ERROR', message, translated);
    },
    critical: (message: string, error?: unknown) => {
        const translated = error ? translateError(error) : undefined;
        log('STORE', 'CRITICAL', message, translated);
    }
};

/**
 * Network Layer Logger
 * Use for: API calls, fetch requests, HTTP errors
 */
export const networkLog = {
    info: (message: string, details?: any) => log('NETWORK', 'INFO', message, details),
    warn: (message: string, details?: any) => log('NETWORK', 'WARN', message, details),
    error: (message: string, details?: any) => {
        // Network errors are often structured differently
        const errorDetails = details?.status
            ? `HTTP ${details.status}: ${details.statusText || 'Unknown'}\nURL: ${details.url || 'N/A'}`
            : translateError(details);
        log('NETWORK', 'ERROR', message, errorDetails);
    },
    critical: (message: string, details?: any) => {
        const errorDetails = details?.status
            ? `HTTP ${details.status}: ${details.statusText || 'Unknown'}\nURL: ${details.url || 'N/A'}`
            : translateError(details);
        log('NETWORK', 'CRITICAL', message, errorDetails);
    }
};

/**
 * Worker Layer Logger
 * Use for: Web Workers, background processing
 */
export const workerLog = {
    info: (message: string, details?: any) => log('WORKER', 'INFO', message, details),
    warn: (message: string, details?: any) => log('WORKER', 'WARN', message, details),
    error: (message: string, error?: unknown) => {
        const translated = error ? translateError(error) : undefined;
        log('WORKER', 'ERROR', message, translated);
    },
    critical: (message: string, error?: unknown) => {
        const translated = error ? translateError(error) : undefined;
        log('WORKER', 'CRITICAL', message, translated);
    }
};

/**
 * Convenience export for all loggers
 */
export const logger = {
    ui: uiLog,
    store: storeLog,
    network: networkLog,
    worker: workerLog
};
