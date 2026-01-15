/**
 * Simulation Telemetry Utility
 * Lightweight performance monitoring for debugging chart/worker issues
 */

interface TelemetryMetric {
    count: number;
    sum: number;
    min: number;
    max: number;
    avg: number;
}

interface TelemetrySnapshot {
    tickInterval: TelemetryMetric;
    candleUpdateRate: TelemetryMetric;
    timeRegressionCount: number;
    totalTicks: number;
    totalCandleUpdates: number;
    startTime: number;
    duration: number;
}

class SimulationTelemetry {
    private enabled: boolean = true;
    private tickTimestamps: number[] = [];
    private candleUpdateTimestamps: number[] = [];
    private timeRegressionCount: number = 0;
    private startTime: number = Date.now();
    private maxHistorySize: number = 1000;

    // Enable/disable telemetry
    setEnabled(enabled: boolean) {
        this.enabled = enabled;
        if (!enabled) {
            this.reset();
        }
    }

    // Record a tick event
    recordTick(timestamp: number = Date.now()) {
        if (!this.enabled) return;

        this.tickTimestamps.push(timestamp);

        // Auto-cleanup old data
        if (this.tickTimestamps.length > this.maxHistorySize) {
            this.tickTimestamps.shift();
        }
    }

    // Record a candle update event
    recordCandleUpdate(timestamp: number = Date.now()) {
        if (!this.enabled) return;

        this.candleUpdateTimestamps.push(timestamp);

        if (this.candleUpdateTimestamps.length > this.maxHistorySize) {
            this.candleUpdateTimestamps.shift();
        }
    }

    // Record a time regression event
    recordTimeRegression() {
        if (!this.enabled) return;
        this.timeRegressionCount++;
    }

    // Calculate metric stats
    private calculateMetric(timestamps: number[]): TelemetryMetric | null {
        if (timestamps.length < 2) return null;

        const intervals: number[] = [];
        for (let i = 1; i < timestamps.length; i++) {
            intervals.push(timestamps[i] - timestamps[i - 1]);
        }

        const sum = intervals.reduce((a, b) => a + b, 0);
        const count = intervals.length;
        const avg = sum / count;
        const min = Math.min(...intervals);
        const max = Math.max(...intervals);

        return { count, sum, min, max, avg };
    }

    // Get current telemetry snapshot
    getSnapshot(): TelemetrySnapshot | null {
        if (!this.enabled) return null;

        const tickMetric = this.calculateMetric(this.tickTimestamps);
        const candleMetric = this.calculateMetric(this.candleUpdateTimestamps);

        if (!tickMetric || !candleMetric) {
            return null; // Not enough data
        }

        const duration = Date.now() - this.startTime;

        return {
            tickInterval: tickMetric,
            candleUpdateRate: candleMetric,
            timeRegressionCount: this.timeRegressionCount,
            totalTicks: this.tickTimestamps.length,
            totalCandleUpdates: this.candleUpdateTimestamps.length,
            startTime: this.startTime,
            duration,
        };
    }

    // Print formatted report to console
    report() {
        const snapshot = this.getSnapshot();

        if (!snapshot) {
            console.log('[SimTelemetry] No data available yet');
            return;
        }

        console.group('📊 Simulation Telemetry Report');

        console.log(`Duration: ${(snapshot.duration / 1000).toFixed(1)}s`);
        console.log(`Total Ticks: ${snapshot.totalTicks}`);
        console.log(`Total Candle Updates: ${snapshot.totalCandleUpdates}`);

        console.group('⏱️ Tick Interval');
        console.log(`  Avg: ${snapshot.tickInterval.avg.toFixed(1)}ms`);
        console.log(`  Min: ${snapshot.tickInterval.min.toFixed(1)}ms`);
        console.log(`  Max: ${snapshot.tickInterval.max.toFixed(1)}ms`);
        console.groupEnd();

        console.group('📈 Candle Update Rate');
        console.log(`  Avg: ${snapshot.candleUpdateRate.avg.toFixed(1)}ms`);
        console.log(`  Min: ${snapshot.candleUpdateRate.min.toFixed(1)}ms`);
        console.log(`  Max: ${snapshot.candleUpdateRate.max.toFixed(1)}ms`);
        console.log(`  Frequency: ${(1000 / snapshot.candleUpdateRate.avg).toFixed(1)} updates/sec`);
        console.groupEnd();

        if (snapshot.timeRegressionCount > 0) {
            console.warn(`⚠️ Time Regressions: ${snapshot.timeRegressionCount}`);
        } else {
            console.log('✅ Time Regressions: 0');
        }

        console.groupEnd();

        return snapshot;
    }

    // Reset all telemetry data
    reset() {
        this.tickTimestamps = [];
        this.candleUpdateTimestamps = [];
        this.timeRegressionCount = 0;
        this.startTime = Date.now();
        console.log('[SimTelemetry] Reset');
    }
}

// Global singleton instance
export const simTelemetry = new SimulationTelemetry();

// Expose to window for console debugging
if (typeof window !== 'undefined') {
    (window as any).__simTelemetry = simTelemetry;
}

// Helper hook for React components
export function useSimulationTelemetry() {
    return simTelemetry;
}
