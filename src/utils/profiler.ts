/**
 * Performance Profiling Utility
 * Measures execution time and tracks KPI compliance
 */

// KPI Targets (ms)
export const KPI_TARGETS = {
    INDICATOR: {
        PER_INDICATOR: 2,
        TOTAL_ALL: 15,
    },
    CHART: {
        SET_DATA_1K: 30,
        SET_DATA_5K: 60,
        SET_DATA_10K: 120,
    },
    REPLAY: {
        SEEK_LATENCY: 50,
        SLIDER_RENDER: 4,
        PROGRESS_RENDER: 4,
    },
    WORKER: {
        POLL_LOOP: 2,
        AVG_PER_SECOND: 10,
    },
    STORE: {
        TICK_BATCH: 2,
        TICK_BATCH_PEAK: 5,
    },
} as const;

interface PerformanceEntry {
    name: string;
    startTime: number;
    duration: number;
    timestamp: number;
    metadata?: Record<string, any>;
}

class PerformanceProfiler {
    private entries: PerformanceEntry[] = [];
    private activeTimers: Map<string, number> = new Map();
    private enabled: boolean = true;

    constructor() {
        // Only enable in development or when explicitly requested
        this.enabled = process.env.NODE_ENV === 'development' ||
            typeof window !== 'undefined' && (window as any).__ENABLE_PROFILING;
    }

    /**
     * Start timing an operation
     */
    start(name: string, metadata?: Record<string, any>): void {
        if (!this.enabled) return;

        const startTime = performance.now();
        this.activeTimers.set(name, startTime);

        if (metadata) {
            this.activeTimers.set(`${name}_metadata`, metadata as any);
        }
    }

    /**
     * End timing and record result
     */
    end(name: string): number | null {
        if (!this.enabled) return null;

        const startTime = this.activeTimers.get(name);
        if (!startTime) {
            console.warn(`[Profiler] No start time found for: ${name}`);
            return null;
        }

        const endTime = performance.now();
        const duration = endTime - startTime;
        const metadata = this.activeTimers.get(`${name}_metadata`) as Record<string, any> | undefined;

        const entry: PerformanceEntry = {
            name,
            startTime,
            duration,
            timestamp: Date.now(),
            metadata,
        };

        this.entries.push(entry);
        this.activeTimers.delete(name);
        this.activeTimers.delete(`${name}_metadata`);

        // Trim entries to last 1000
        if (this.entries.length > 1000) {
            this.entries.shift();
        }

        return duration;
    }

    /**
   * Measure a function execution
   * Returns both the function result and the duration
   */
    measure<T>(name: string, fn: () => T, metadata?: Record<string, any>): { result: T; duration: number | null } {
        if (!this.enabled) {
            return { result: fn(), duration: null };
        }

        this.start(name, metadata);
        try {
            const result = fn();
            const duration = this.end(name);
            return { result, duration };
        } catch (error) {
            this.end(name);
            throw error;
        }
    }

    /**
     * Measure an async function execution
     * Returns both the function result and the duration
     */
    async measureAsync<T>(name: string, fn: () => Promise<T>, metadata?: Record<string, any>): Promise<{ result: T; duration: number | null }> {
        if (!this.enabled) {
            return { result: await fn(), duration: null };
        }

        this.start(name, metadata);
        try {
            const result = await fn();
            const duration = this.end(name);
            return { result, duration };
        } catch (error) {
            this.end(name);
            throw error;
        }
    }

    /**
     * Get statistics for a specific operation
     */
    getStats(name: string): {
        count: number;
        avg: number;
        min: number;
        max: number;
        last: number;
        p50: number;
        p95: number;
        p99: number;
    } | null {
        const filtered = this.entries.filter(e => e.name === name);
        if (filtered.length === 0) return null;

        const durations = filtered.map(e => e.duration).sort((a, b) => a - b);
        const sum = durations.reduce((a, b) => a + b, 0);

        return {
            count: durations.length,
            avg: sum / durations.length,
            min: durations[0],
            max: durations[durations.length - 1],
            last: filtered[filtered.length - 1].duration,
            p50: durations[Math.floor(durations.length * 0.5)],
            p95: durations[Math.floor(durations.length * 0.95)],
            p99: durations[Math.floor(durations.length * 0.99)],
        };
    }

    /**
     * Check if a metric passes KPI target
     */
    checkKPI(name: string, target: number): {
        pass: boolean;
        actual: number;
        target: number;
        delta: number;
    } | null {
        const stats = this.getStats(name);
        if (!stats) return null;

        const actual = stats.last; // Use last measurement
        const pass = actual <= target;
        const delta = actual - target;

        return { pass, actual, target, delta };
    }

    /**
     * Get all entries (for debugging)
     */
    getEntries(): PerformanceEntry[] {
        return [...this.entries];
    }

    /**
     * Clear all entries
     */
    clear(): void {
        this.entries = [];
        this.activeTimers.clear();
    }

    /**
     * Log a summary report
     */
    report(filter?: string): void {
        const entries = filter
            ? this.entries.filter(e => e.name.includes(filter))
            : this.entries;

        if (entries.length === 0) {
            console.log('[Profiler] No entries found');
            return;
        }

        const byName = new Map<string, number[]>();
        entries.forEach(e => {
            if (!byName.has(e.name)) {
                byName.set(e.name, []);
            }
            byName.get(e.name)!.push(e.duration);
        });

        console.group(`[Profiler] Performance Report ${filter ? `(${filter})` : ''}`);
        byName.forEach((durations, name) => {
            const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
            const max = Math.max(...durations);
            const min = Math.min(...durations);
            console.log(`${name}: avg=${avg.toFixed(2)}ms, min=${min.toFixed(2)}ms, max=${max.toFixed(2)}ms, count=${durations.length}`);
        });
        console.groupEnd();
    }
}

// Global singleton instance
export const profiler = new PerformanceProfiler();

// Enable profiling in development console
if (typeof window !== 'undefined') {
    (window as any).__profiler = profiler;
    (window as any).__enableProfiling = () => {
        (window as any).__ENABLE_PROFILING = true;
        console.log('[Profiler] Profiling enabled. Use window.__profiler to access.');
    };
}
