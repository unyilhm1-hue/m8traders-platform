'use client';

import { useEffect } from 'react';
import { globalErrorCapture } from '@/lib/errorCapture';

/**
 * Error Capture Initializer
 * Client component that initializes the Global Observer on mount
 */
export function ErrorCaptureInit() {
    useEffect(() => {
        globalErrorCapture.initialize();

        return () => {
            globalErrorCapture.cleanup();
        };
    }, []);

    return null; // No UI, just side effects
}
