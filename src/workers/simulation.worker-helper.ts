    /**
     * Send candle update to main thread
     * Centralized method to avoid code duplication
     */
    private sendCandleUpdate(source: 'tick' | 'continuous' | 'final') {
    if (!this.currentAggregatedCandle) return;

    // Debug logging (reduced verbosity)
    if (source === 'tick' && this.currentTickIndex < 5) {
        console.log(`[Worker] 📊 CANDLE_UPDATE (${source}): time=${this.currentAggregatedCandle.time}, C=${this.currentAggregatedCandle.close.toFixed(2)}`);
    }

    postMessage({
        type: 'CANDLE_UPDATE',
        candle: this.currentAggregatedCandle,
        metadata: {
            source,
            tickIndex: this.currentTickIndex,
            backlog: this.tickBacklog
        }
    });
}
