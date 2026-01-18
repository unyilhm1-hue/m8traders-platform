/**
 * MODUL 1: Error Translator
 * Converts any JavaScript error format into human-readable strings
 */

export interface TranslatedError {
    message: string;
    stack?: string;
    originalType: string;
}

/**
 * Translate any error type into a readable string with stack trace
 */
export function translateError(error: unknown): TranslatedError {
    // Case 1: Native Error object
    if (error instanceof Error) {
        return {
            message: error.message || 'Unknown error',
            stack: error.stack,
            originalType: 'Error'
        };
    }

    // Case 2: String
    if (typeof error === 'string') {
        return {
            message: error,
            originalType: 'string'
        };
    }

    // Case 3: Empty object {} or object with hidden properties
    if (typeof error === 'object' && error !== null) {
        try {
            // Try to extract all properties including non-enumerable ones
            const allProps = Object.getOwnPropertyNames(error);

            if (allProps.length === 0) {
                // Truly empty object
                return {
                    message: 'Empty error object {}',
                    originalType: 'object (empty)'
                };
            }

            // Try to get message from common error properties
            const errorObj = error as any;
            const message = errorObj.message || errorObj.error || errorObj.description;

            if (message) {
                return {
                    message: String(message),
                    stack: errorObj.stack,
                    originalType: 'object'
                };
            }

            // Fallback: stringify the entire object
            const stringified = JSON.stringify(error, allProps);
            return {
                message: stringified !== '{}' ? stringified : 'Error object with no readable properties',
                originalType: 'object'
            };
        } catch (e) {
            // JSON.stringify failed (circular reference, etc.)
            return {
                message: 'Complex error object (cannot stringify)',
                originalType: 'object (complex)'
            };
        }
    }

    // Case 4: undefined or null
    if (error === undefined) {
        return {
            message: 'Undefined error',
            originalType: 'undefined'
        };
    }

    if (error === null) {
        return {
            message: 'Null error',
            originalType: 'null'
        };
    }

    // Case 5: Other primitives (number, boolean, symbol, bigint)
    return {
        message: String(error),
        originalType: typeof error
    };
}

/**
 * Quick helper for console logging errors
 */
export function logError(error: unknown, context?: string): void {
    const translated = translateError(error);
    const prefix = context ? `[${context}]` : '';

    console.error(`${prefix} ${translated.message}`);
    if (translated.stack) {
        console.error('Stack trace:', translated.stack);
    }
}

/**
 * Format error for display in UI
 */
export function formatErrorForUI(error: unknown): string {
    const translated = translateError(error);

    if (translated.stack) {
        // Extract just the first line of stack for UI display
        const firstLine = translated.stack.split('\n')[0];
        return `${translated.message}\n${firstLine}`;
    }

    return translated.message;
}
