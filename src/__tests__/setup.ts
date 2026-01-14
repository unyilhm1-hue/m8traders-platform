/**
 * Test Setup File
 * Configures global test environment
 */

import { vi } from 'vitest';
import 'fake-indexeddb/auto';

// Mock console methods to reduce noise in test output
global.console = {
    ...console,
    log: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    // Keep error for debugging
    error: console.error,
} as Console;
