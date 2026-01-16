/**
 * Trading Analytics Utilities - Psychological Pattern Detection
 * ==============================================================
 * Implements Master Blueprint psychological analysis:
 * - Revenge Trading detection
 * - Timeframe Suitability analysis
 * - Cut Profit Early detection
 * 
 * Based on behavioral finance and trading psychology research
 */

export interface Trade {
    id: string;
    type: 'BUY' | 'SELL';
    shares: number;
    price: number;
    timestamp: number;
    realizedPnL?: number;
    duration?: number; // Duration in seconds (for completed trades)
    symbol?: string;
    timeframe?: string;
}

export interface PsychologicalAnalysis {
    hasRevengeTradingPattern: boolean;
    bestTimeframe: string | null;
    hasCutProfitEarlyPattern: boolean;
    recommendations: string[];
}

// ============================================================================
// 1. Revenge Trading Detection
// ============================================================================

/**
 * Detect revenge trading pattern
 * 
 * Definition: 3+ consecutive losses within short timeframe (< 5 minutes)
 * Psychology: Trader is emotionally triggered, trying to "get revenge" on market
 * 
 * @param trades - All trades (chronologically sorted)
 * @returns True if revenge trading pattern detected
 */
export function detectRevengeTradingPattern(trades: Trade[]): boolean {
    if (trades.length < 3) return false;

    // Get completed trades only
    const completedTrades = trades.filter(t => t.realizedPnL !== undefined);

    // Check for 3 consecutive losses
    for (let i = 0; i <= completedTrades.length - 3; i++) {
        const trade1 = completedTrades[i];
        const trade2 = completedTrades[i + 1];
        const trade3 = completedTrades[i + 2];

        const allLosses =
            (trade1.realizedPnL || 0) < 0 &&
            (trade2.realizedPnL || 0) < 0 &&
            (trade3.realizedPnL || 0) < 0;

        if (!allLosses) continue;

        // Check if within 5 minutes
        const timespanMs = trade3.timestamp - trade1.timestamp;
        const within5Minutes = timespanMs < 5 * 60 * 1000;

        if (within5Minutes) {
            return true; // Revenge trading detected!
        }
    }

    return false;
}

// ============================================================================
// 2. Timeframe Suitability Analysis
// ============================================================================

interface TimeframeStats {
    timeframe: string;
    winRate: number;
    avgProfit: number;
    tradeCount: number;
}

/**
 * Analyze which timeframe suits the trader best
 * 
 * Psychology: Different traders have different temperaments
 * - Scalpers: thrive on 1m-5m (quick decisions)
 * - Swing traders: thrive on 15m-1h (patient, analytical)
 * 
 * @param trades - All trades with timeframe metadata
 * @returns Best timeframe and analysis string
 */
export function analyzeTimeframeSuitability(trades: Trade[]): {
    bestTimeframe: string | null;
    analysis: string;
    stats: TimeframeStats[];
} {
    const completedTrades = trades.filter(t => t.realizedPnL !== undefined && t.timeframe);

    if (completedTrades.length === 0) {
        return {
            bestTimeframe: null,
            analysis: 'Insufficient data for timeframe analysis',
            stats: []
        };
    }

    // Group by timeframe
    const byTimeframe = groupBy(completedTrades, 'timeframe');

    // Calculate stats per timeframe
    const stats: TimeframeStats[] = Object.entries(byTimeframe).map(([tf, tfTrades]) => {
        const wins = tfTrades.filter(t => (t.realizedPnL || 0) > 0);
        const winRate = (wins.length / tfTrades.length) * 100;
        const totalProfit = tfTrades.reduce((sum, t) => sum + (t.realizedPnL || 0), 0);
        const avgProfit = totalProfit / tfTrades.length;

        return {
            timeframe: tf as string,
            winRate,
            avgProfit,
            tradeCount: tfTrades.length
        };
    });

    // Filter out timeframes with < 5 trades (insufficient sample)
    const relevantStats = stats.filter(s => s.tradeCount >= 5);

    if (relevantStats.length === 0) {
        return {
            bestTimeframe: null,
            analysis: 'Need at least 5 trades per timeframe for analysis',
            stats
        };
    }

    // Find best timeframe (highest combined score: winRate * avgProfit)
    const bestStat = relevantStats.reduce((best, current) => {
        const currentScore = current.winRate * current.avgProfit;
        const bestScore = best.winRate * best.avgProfit;
        return currentScore > bestScore ? current : best;
    });

    // Generate analysis
    const isScalper = ['1m', '2m', '5m'].includes(bestStat.timeframe);
    const analysis = isScalper
        ? `Anda cocok sebagai Scalper (timeframe ${bestStat.timeframe}, winrate ${bestStat.winRate.toFixed(1)}%)`
        : `Anda lebih cocok sebagai Swing Trader (timeframe ${bestStat.timeframe}, winrate ${bestStat.winRate.toFixed(1)}%)`;

    return {
        bestTimeframe: bestStat.timeframe,
        analysis,
        stats: relevantStats
    };
}

// ============================================================================
// 3. Cut Profit Early Detection
// ============================================================================

/**
 * Detect if trader cuts profits early but lets losses run
 * 
 * Psychology: Fear of losing gains (premature exit) vs hope to recover (holding losses)
 * Classic amateur mistake - opposite of "cut losses, let profits run"
 * 
 * Rule: Average win duration < 50% of average loss duration
 * 
 * @param trades - Trades with duration metadata
 * @returns True if pattern detected
 */
export function detectCutProfitEarly(trades: Trade[]): boolean {
    const completedTrades = trades.filter(t => t.realizedPnL !== undefined && t.duration);

    if (completedTrades.length < 10) return false; // Need sufficient sample

    const wins = completedTrades.filter(t => (t.realizedPnL || 0) > 0);
    const losses = completedTrades.filter(t => (t.realizedPnL || 0) < 0);

    if (wins.length === 0 || losses.length === 0) return false;

    // Calculate average durations
    const avgWinDuration = avg(wins.map(t => t.duration || 0));
    const avgLossDuration = avg(losses.map(t => t.duration || 0));

    // Pattern: Win duration < 50% of loss duration
    return avgWinDuration < avgLossDuration * 0.5;
}

// ============================================================================
// 4. Comprehensive Psychological Analysis
// ============================================================================

/**
 * Run full psychological analysis and generate actionable recommendations
 * 
 * @param trades - All trader's trades
 * @returns Complete psychological profile with recommendations
 */
export function analyzeTradingPsychology(trades: Trade[]): PsychologicalAnalysis {
    const hasRevengeTradingPattern = detectRevengeTradingPattern(trades);
    const timeframeAnalysis = analyzeTimeframeSuitability(trades);
    const hasCutProfitEarlyPattern = detectCutProfitEarly(trades);

    const recommendations: string[] = [];

    // Revenge trading recommendation
    if (hasRevengeTradingPattern) {
        recommendations.push(
            '⚠️ Revenge Trading Detected: Anda melakukan 3+ loss beruntun dalam waktu < 5 menit. ' +
            'Dinginkan kepala Anda sebelum trading lagi.'
        );
    }

    // Timeframe recommendation
    if (timeframeAnalysis.bestTimeframe) {
        recommendations.push(
            `✅ ${timeframeAnalysis.analysis}`
        );
    }

    // Cut profit early recommendation
    if (hasCutProfitEarlyPattern) {
        recommendations.push(
            '⚠️ Cut Profit Early: Anda menutup profit terlalu cepat tetapi membiarkan loss berjalan. ' +
            'Coba set profit target yang lebih tinggi dan stop loss yang lebih ketat.'
        );
    }

    // General recommendation (if no issues)
    if (recommendations.length === 0) {
        recommendations.push(
            '✅ Tidak ada pola psikologi negatif terdeteksi. Trading discipline Anda baik!'
        );
    }

    return {
        hasRevengeTradingPattern,
        bestTimeframe: timeframeAnalysis.bestTimeframe,
        hasCutProfitEarlyPattern,
        recommendations
    };
}

// ============================================================================
// Utility Functions
// ============================================================================

function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
    return array.reduce((result, item) => {
        const group = String(item[key]);
        if (!result[group]) {
            result[group] = [];
        }
        result[group].push(item);
        return result;
    }, {} as Record<string, T[]>);
}

function avg(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}
