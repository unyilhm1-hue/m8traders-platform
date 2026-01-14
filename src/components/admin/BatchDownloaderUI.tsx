/**
 * BatchDownloaderUI Component
 * Admin UI for downloading historical data batches and creating scenarios
 */
'use client';

import { useState } from 'react';
import { generateWindows, getRecommendedWindowSize } from '@/lib/data/windowCalculator';
import { downloadMultipleBatches, estimateDownloadTime } from '@/lib/data/batchDownloader';
import { createScenario } from '@/lib/scenario/scenarioManager';
import { getStorageQuota } from '@/lib/storage/indexedDB';
import { IDX_TICKERS } from '@/lib/chart';
import type { BatchDownloadProgress, StorageQuota } from '@/types/storage';

export function BatchDownloaderUI() {
    const [ticker, setTicker] = useState('BBRI.JK');
    const [interval, setInterval] = useState<'1m' | '5m' | '15m' | '1h'>('5m');
    const [startDate, setStartDate] = useState('2024-01-01');
    const [endDate, setEndDate] = useState('2024-06-01');
    const [scenarioName, setScenarioName] = useState('');
    const [scenarioDifficulty, setScenarioDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
    const [scenarioDescription, setScenarioDescription] = useState('');

    const [downloading, setDownloading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentBatch, setCurrentBatch] = useState<BatchDownloadProgress | null>(null);
    const [storageQuota, setStorageQuota] = useState<StorageQuota | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Load storage quota on mount
    useState(() => {
        updateStorageQuota();
    });

    const updateStorageQuota = async () => {
        const quota = await getStorageQuota();
        setStorageQuota(quota);
    };

    const handleDownload = async () => {
        setDownloading(true);
        setError(null);
        setSuccess(null);
        setProgress(0);

        try {
            // Generate windows
            const windowSize = getRecommendedWindowSize(interval);
            const windows = generateWindows(
                new Date(startDate),
                new Date(endDate),
                windowSize
            );

            console.log(`[BatchDownloader] Starting download: ${windows.length} batches`);

            // Download batches
            await downloadMultipleBatches(
                ticker,
                interval,
                windows,
                (overallProgress, batchProgress) => {
                    setProgress(overallProgress);
                    setCurrentBatch(batchProgress);
                }
            );

            // Create scenario if name provided
            if (scenarioName.trim()) {
                console.log('[BatchDownloader] Creating scenario...');
                const scenario = await createScenario(
                    scenarioName.trim(),
                    ticker,
                    interval,
                    windows.map((w) => w.id),
                    {
                        description: scenarioDescription.trim() || undefined,
                        difficulty: scenarioDifficulty,
                    }
                );

                setSuccess(`Successfully created scenario: ${scenario.name} (${scenario.totalCandles.toLocaleString()} candles)`);
            } else {
                setSuccess(`Successfully downloaded ${windows.length} batches`);
            }

            // Update storage quota
            await updateStorageQuota();

            // Reset form
            setScenarioName('');
            setScenarioDescription('');

        } catch (err: any) {
            console.error('[BatchDownloader] Download failed:', err);
            setError(err.message || 'Download failed');
        } finally {
            setDownloading(false);
            setProgress(0);
            setCurrentBatch(null);
        }
    };

    // Calculate estimate
    const estimatedTime = (() => {
        const windowSize = getRecommendedWindowSize(interval);
        const windows = generateWindows(
            new Date(startDate),
            new Date(endDate),
            windowSize
        );
        return estimateDownloadTime(windows.length, windowSize);
    })();

    return (
        <div className="p-6 bg-[var(--bg-secondary)] rounded-lg border border-[var(--bg-tertiary)]">
            <div className="mb-6">
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                    Batch Downloader
                </h2>
                <p className="text-sm text-[var(--text-secondary)]">
                    Download historical data and create frozen scenarios for practice trading
                </p>
            </div>

            {/* Storage Quota */}
            {storageQuota && (
                <div className="mb-6 p-3 bg-[var(--bg-tertiary)] rounded border border-[var(--bg-subtle-border)]">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-[var(--text-secondary)]">Storage Usage</span>
                        <span className="text-xs text-[var(--text-tertiary)]">
                            {(storageQuota.used / 1024 / 1024).toFixed(2)} MB / {(storageQuota.total / 1024 / 1024).toFixed(0)} MB
                        </span>
                    </div>
                    <div className="w-full bg-[var(--bg-secondary)] rounded-full h-2">
                        <div
                            className="bg-[var(--accent-primary)] h-2 rounded-full transition-all"
                            style={{ width: `${storageQuota.percentage}%` }}
                        />
                    </div>
                </div>
            )}

            <div className="space-y-4">
                {/* Ticker Selection */}
                <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                        Ticker
                    </label>
                    <select
                        value={ticker}
                        onChange={(e) => setTicker(e.target.value)}
                        disabled={downloading}
                        className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--bg-subtle-border)] rounded text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] disabled:opacity-50"
                    >
                        {IDX_TICKERS.map((t) => (
                            <option key={t.symbol} value={t.symbol}>
                                {t.symbol} - {t.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Interval Selection */}
                <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                        Interval
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                        {(['1m', '5m', '15m', '1h'] as const).map((int) => (
                            <button
                                key={int}
                                onClick={() => setInterval(int)}
                                disabled={downloading}
                                className={`px-3 py-2 text-sm font-medium rounded transition-colors disabled:opacity-50 ${interval === int
                                        ? 'bg-[var(--accent-primary)] text-white'
                                        : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                                    }`}
                            >
                                {int}
                            </button>
                        ))}
                    </div>
                    <p className="text-xs text-[var(--text-tertiary)] mt-2">
                        Recommended window: {getRecommendedWindowSize(interval)} days
                    </p>
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                            Start Date
                        </label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            disabled={downloading}
                            className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--bg-subtle-border)] rounded text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] disabled:opacity-50"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                            End Date
                        </label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            disabled={downloading}
                            className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--bg-subtle-border)] rounded text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] disabled:opacity-50"
                        />
                    </div>
                </div>

                {/* Scenario Creation (Optional) */}
                <div className="border-t border-[var(--bg-tertiary)] pt-4">
                    <div className="flex items-center gap-2 mb-3">
                        <input
                            type="checkbox"
                            id="create-scenario"
                            checked={!!scenarioName}
                            onChange={(e) => setScenarioName(e.target.checked ? `${ticker} Practice ${startDate}` : '')}
                            disabled={downloading}
                            className="w-4 h-4"
                        />
                        <label htmlFor="create-scenario" className="text-sm font-medium text-[var(--text-primary)]">
                            Create Scenario
                        </label>
                    </div>

                    {scenarioName && (
                        <div className="space-y-3 pl-6">
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                                    Scenario Name
                                </label>
                                <input
                                    type="text"
                                    value={scenarioName}
                                    onChange={(e) => setScenarioName(e.target.value)}
                                    disabled={downloading}
                                    placeholder="e.g., BBRI Breakout Q1 2024"
                                    className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--bg-subtle-border)] rounded text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] disabled:opacity-50"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                                    Difficulty
                                </label>
                                <div className="flex gap-2">
                                    {(['easy', 'medium', 'hard'] as const).map((diff) => (
                                        <button
                                            key={diff}
                                            onClick={() => setScenarioDifficulty(diff)}
                                            disabled={downloading}
                                            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors disabled:opacity-50 capitalize ${scenarioDifficulty === diff
                                                    ? 'bg-[var(--accent-primary)] text-white'
                                                    : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                                                }`}
                                        >
                                            {diff}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                                    Description (Optional)
                                </label>
                                <textarea
                                    value={scenarioDescription}
                                    onChange={(e) => setScenarioDescription(e.target.value)}
                                    disabled={downloading}
                                    placeholder="Describe the trading scenario..."
                                    rows={2}
                                    className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--bg-subtle-border)] rounded text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] disabled:opacity-50 resize-none"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Download Info */}
                <div className="bg-[var(--bg-tertiary)] p-3 rounded text-xs space-y-1">
                    <div className="flex justify-between text-[var(--text-secondary)]">
                        <span>Estimated batches:</span>
                        <span className="font-medium text-[var(--text-primary)]">{generateWindows(new Date(startDate), new Date(endDate), getRecommendedWindowSize(interval)).length}</span>
                    </div>
                    <div className="flex justify-between text-[var(--text-secondary)]">
                        <span>Estimated time:</span>
                        <span className="font-medium text-[var(--text-primary)]">{estimatedTime.formatted}</span>
                    </div>
                </div>

                {/* Progress */}
                {downloading && currentBatch && (
                    <div className="bg-[var(--bg-tertiary)] p-3 rounded space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-[var(--text-secondary)]">
                                {currentBatch.status === 'completed' ? '✓' : '⟳'} {currentBatch.windowId}
                            </span>
                            <span className="text-[var(--text-primary)] font-medium">
                                {Math.round(progress)}%
                            </span>
                        </div>
                        <div className="w-full bg-[var(--bg-secondary)] rounded-full h-2">
                            <div
                                className="bg-[var(--accent-primary)] h-2 rounded-full transition-all"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Error/Success Messages */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded p-3">
                        <p className="text-sm text-red-400">{error}</p>
                    </div>
                )}

                {success && (
                    <div className="bg-green-500/10 border border-green-500/20 rounded p-3">
                        <p className="text-sm text-green-400">{success}</p>
                    </div>
                )}

                {/* Download Button */}
                <button
                    onClick={handleDownload}
                    disabled={downloading || !startDate || !endDate}
                    className="w-full px-4 py-3 bg-[var(--accent-primary)] text-white font-medium rounded hover:bg-[var(--accent-primary)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {downloading ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Downloading...</span>
                        </>
                    ) : (
                        <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            <span>Start Download</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
