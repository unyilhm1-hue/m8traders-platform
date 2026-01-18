/**
 * Format error objects for better debugging
 * Handles different error types and makes them readable
 */
export const formatError = (error: any): string => {
    if (!error) return "Unknown Error";

    // If error is a string, return it directly
    if (typeof error === 'string') return error;

    // If error is a standard Error object
    if (error instanceof Error) {
        return error.message || error.toString();
    }

    // If error is a weird object (e.g., from chart library)
    try {
        // Try to stringify it
        const str = JSON.stringify(error, null, 2);
        // If it's just an empty object, be explicit
        if (str === '{}') return 'Empty Error Object (no details provided)';
        return str;
    } catch {
        // If can't stringify, return type info
        return `Unserializable Error (type: ${typeof error})`;
    }
};
