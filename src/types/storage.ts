/**
 * Storage Types
 * Type definitions for batch data storage system
 */

import type { Candle } from './chart';

/**
 * Batch window representing a time range for data download
 */
export interface BatchWindow {
    id: string;              // Unique identifier (e.g., "2024-01-01_to_2024-03-01")
    startDate: Date;
    endDate: Date;
    sizeInDays: number;
}

/**
 * Batch record stored in IndexedDB
 */
export interface BatchRecord {
    id: string;              // `${ticker}_${interval}_${windowId}`
    ticker: string;          // e.g., "BBRI.JK"
    interval: '1m' | '5m' | '15m' | '1h';
    windowId: string;        // Window identifier
    startTime: number;       // Unix timestamp (ms)
    endTime: number;         // Unix timestamp (ms)
    data: Candle[];          // OHLCV candles
    downloadedAt: number;    // Download timestamp
    checksum: string;        // SHA-256 hash for data integrity
    candleCount: number;     // Total number of candles
}

/**
 * Download progress tracking
 */
export interface BatchDownloadProgress {
    windowId: string;
    status: 'pending' | 'downloading' | 'completed' | 'failed';
    downloadedCandles: number;
    totalCandles: number;
    error?: string;
    startedAt?: number;
    completedAt?: number;
}

/**
 * Storage quota information
 */
export interface StorageQuota {
    used: number;            // bytes used
    available: number;       // bytes available
    total: number;           // total quota
    percentage: number;      // 0-100
}

/**
 * Batch metadata for listing/management
 */
export interface BatchMetadata {
    id: string;
    ticker: string;
    interval: '1m' | '5m' | '15m' | '1h';
    windowId: string;
    startTime: number;
    endTime: number;
    candleCount: number;
    downloadedAt: number;
    sizeBytes: number;
}
