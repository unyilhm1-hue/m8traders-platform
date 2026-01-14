/**
 * Admin Page - Batch Downloader
 * Admin interface for downloading historical data and creating scenarios
 */
'use client';

import { BatchDownloaderUI } from '@/components/admin/BatchDownloaderUI';

export default function AdminBatchPage() {
    return (
        <div className="min-h-screen bg-[var(--bg-primary)] p-6">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
                        Historical Data Manager
                    </h1>
                    <p className="text-[var(--text-secondary)]">
                        Download historical stock data and create frozen scenarios for practice trading
                    </p>
                </div>

                <BatchDownloaderUI />

                {/* Usage Instructions */}
                <div className="mt-8 p-6 bg-[var(--bg-secondary)] rounded-lg border border-[var(--bg-tertiary)]">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
                        📚 How to Use
                    </h3>
                    <ol className="space-y-2 text-sm text-[var(--text-secondary)]">
                        <li className="flex gap-2">
                            <span className="font-medium text-[var(--accent-primary)]">1.</span>
                            <span>Select a ticker and interval (1m, 5m, 15m, or 1h)</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="font-medium text-[var(--accent-primary)]">2.</span>
                            <span>Choose a date range (system will split into optimal batch windows)</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="font-medium text-[var(--accent-primary)]">3.</span>
                            <span>Optionally create a scenario with name, difficulty, and description</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="font-medium text-[var(--accent-primary)]">4.</span>
                            <span>Click "Start Download" and wait for batches to complete</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="font-medium text-[var(--accent-primary)]">5.</span>
                            <span>Access scenarios from the demo page via Scenario Selector</span>
                        </li>
                    </ol>

                    <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded">
                        <p className="text-xs text-yellow-400">
                            <strong>⚠️ Yahoo Finance Limits:</strong> 1m max 7-30 days per window, 5m max 30-60 days.
                            The system automatically splits requests into safe batch sizes with rate limiting.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
