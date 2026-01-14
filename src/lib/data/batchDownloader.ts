/**
 * Batch Downloader
 * Downloads historical data in chunks from Yahoo Finance API
 */

import type { Candle } from '@/types';
import type { BatchWindow, BatchDownloadProgress, BatchRecord } from '@/types/storage';
import { saveBatch, calculateChecksum } from '@/lib/storage/indexedDB';
import { getWindowId } from './windowCalculator';

/**
 * Download batch data for a single window
 */
export async function downloadBatch(
    ticker: string,
    interval: '1m' | '5m' | '15m' | '1h',
    window: BatchWindow,
    onProgress?: (progress: BatchDownloadProgress) => void
): Promise<Candle[]> {
    const startedAt = Date.now();

    // Initialize progress
    if (onProgress) {
        onProgress({
            windowId: window.id,
            status: 'downloading',
            downloadedCandles: 0,
            totalCandles: 0,
            startedAt,
        });
    }

    try {
        // Call Yahoo Finance API via our backend
        const response = await fetchWithRetry(
            `/api/stocks/${ticker}?interval=${interval}&period1=${window.startDate.toISOString()}&period2=${window.endDate.toISOString()}`,
            3, // max retries
            1000 // initial delay ms
        );

        if (!response.ok) {
            throw new Error(`API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const candles: Candle[] = data.data || [];

        // Update progress
        if (onProgress) {
            onProgress({
                windowId: window.id,
                status: 'completed',
                downloadedCandles: candles.length,
                totalCandles: candles.length,
                startedAt,
                completedAt: Date.now(),
            });
        }

        console.log(`[BatchDownloader] Downloaded ${candles.length} candles for ${ticker} ${interval} (${window.id})`);
        return candles;

    } catch (error: any) {
        // Update progress with error
        if (onProgress) {
            onProgress({
                windowId: window.id,
                status: 'failed',
                downloadedCandles: 0,
                totalCandles: 0,
                error: error.message,
                startedAt,
                completedAt: Date.now(),
            });
        }

        console.error(`[BatchDownloader] Failed to download ${ticker} ${interval} (${window.id}):`, error);
        throw error;
    }
}

/**
 * Download and save multiple batches sequentially
 */
export async function downloadMultipleBatches(
    ticker: string,
    interval: '1m' | '5m' | '15m' | '1h',
    windows: BatchWindow[],
    onProgress?: (overall: number, current: BatchDownloadProgress) => void,
    rateLimitMs: number = 1000 // Configurable rate limit
): Promise<Map<string, Candle[]>> {
    const results = new Map<string, Candle[]>();
    let completedCount = 0;

    for (const window of windows) {
        try {
            // Download batch
            const candles = await downloadBatch(
                ticker,
                interval,
                window,
                (progress) => {
                    // Report individual progress
                    const overallProgress = ((completedCount + (progress.status === 'completed' ? 1 : 0)) / windows.length) * 100;
                    if (onProgress) {
                        onProgress(overallProgress, progress);
                    }
                }
            );

            // Save to IndexedDB
            const checksum = await calculateChecksum(candles);
            const batchRecord: BatchRecord = {
                id: `${ticker}_${interval}_${window.id}`,
                ticker,
                interval,
                windowId: window.id,
                startTime: window.startDate.getTime(),
                endTime: window.endDate.getTime(),
                data: candles,
                downloadedAt: Date.now(),
                checksum,
                candleCount: candles.length,
            };

            await saveBatch(batchRecord);
            results.set(window.id, candles);

            completedCount++;
            console.log(`[BatchDownloader] Progress: ${completedCount}/${windows.length} batches completed`);

            // Rate limiting: wait configured time between requests
            if (completedCount < windows.length) {
                await sleep(rateLimitMs);
            }

        } catch (error: any) {
            console.error(`[BatchDownloader] Skipping failed batch ${window.id}:`, error);
            // Continue with next batch even if one fails
        }
    }

    return results;
}

/**
 * Fetch with retry logic and exponential backoff
 */
async function fetchWithRetry(
    url: string,
    maxRetries: number = 3,
    initialDelayMs: number = 1000
): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await fetch(url);

            // Return successful responses
            if (response.ok) {
                return response;
            }

            // Handle 429 (Too Many Requests) - Retryable
            if (response.status === 429) {
                const retryAfter = response.headers.get('Retry-After');
                const retryDelay = parseRetryAfterMs(retryAfter);
                console.warn(`[BatchDownloader] Rate limited (429). Retry-After: ${retryAfter || 'N/A'}`);

                // If Retry-After is present, throw special error to pass delay up
                if (retryDelay !== null) {
                    const error = new Error(`Rate limited: ${response.status}`);
                    (error as any).retryDelay = retryDelay;
                    throw error;
                }

                throw new Error(`Rate limited: ${response.status}`);
            }

            // Don't retry on other 4xx errors (client errors)
            if (response.status >= 400 && response.status < 500) {
                throw new Error(`Client error: ${response.status}`);
            }

            // Retry on 5xx errors
            lastError = new Error(`Server error: ${response.status}`);

        } catch (error: any) {
            // Immediately stop retrying if it's a client error (but not rate limited)
            if (error.message && error.message.startsWith('Client error')) {
                throw error;
            }
            lastError = error;
        }

        // Calculate delay
        let delay = initialDelayMs * Math.pow(2, attempt);

        // Use custom delay if available (from Retry-After)
        if (lastError && (lastError as any).retryDelay) {
            delay = (lastError as any).retryDelay;
        }

        if (attempt < maxRetries - 1) {
            console.log(`[BatchDownloader] Retry ${attempt + 1}/${maxRetries} after ${delay}ms...`);
            await sleep(delay);
        }
    }

    throw lastError || new Error('Max retries exceeded');
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Estimate download time
 */
export function estimateDownloadTime(
    windowCount: number,
    averageWindowSizeDays: number
): { seconds: number; formatted: string } {
    // Rough estimate: 2 seconds per request + 1 second rate limit
    // Rough estimate: 2 seconds per request + 1 second rate limit
    const secondsPerWindow = 3;
    const totalSeconds = windowCount * secondsPerWindow;

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    const formatted = minutes > 0
        ? `${minutes}m ${seconds}s`
        : `${seconds}s`;

    return { seconds: totalSeconds, formatted };
}

/**
 * Parse Retry-After header (seconds or HTTP-date) to milliseconds
 */
function parseRetryAfterMs(headerValue: string | null): number | null {
    if (!headerValue) return null;

    // Try parsing as seconds
    const seconds = parseInt(headerValue, 10);
    if (!isNaN(seconds)) {
        return seconds * 1000;
    }

    // Try parsing as HTTP-date
    const date = Date.parse(headerValue);
    if (!isNaN(date)) {
        const delta = date - Date.now();
        return Math.max(0, delta);
    }

    return null;
}
