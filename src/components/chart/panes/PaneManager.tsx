'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { ChartPane, ChartPaneHandle } from './ChartPane';
import { PaneHeader } from './PaneHeader';
import { MouseEventParams } from 'lightweight-charts';

export interface PaneDefinition {
    id: string;
    title: string; // Display title
    type: 'price' | 'volume' | 'indicator';
    heightWeight: number; // Initial Flex grow value
    render: (chart: any) => void;
    overlay?: React.ReactNode;
    onRemove?: () => void;
    onSettings?: () => void;
}

interface PaneManagerProps {
    panes: PaneDefinition[];
}

export function PaneManager({ panes }: PaneManagerProps) {
    const paneRefs = useRef<Map<string, ChartPaneHandle>>(new Map());
    const syncLock = useRef<string | null>(null);
    const unlockTimeout = useRef<NodeJS.Timeout | null>(null);

    // --- State Management for Layout ---
    // Price Pane is always 'flex-1'.
    // Other panes have explicit heights.
    // Map<id, { height: number, collapsed: boolean }>
    const [paneLayouts, setPaneLayouts] = useState<Record<string, { height: number; collapsed: boolean }>>({});

    // Defaults
    const DEFAULT_HEIGHTS: Record<string, number> = {
        volume: 140,
        rsi: 150,
        macd: 180,
        default: 150,
    };
    const COLLAPSED_HEIGHT = 40;
    const MIN_HEIGHT = 100;

    // Initialize layout state for new panes
    useEffect(() => {
        setPaneLayouts(prev => {
            const next = { ...prev };
            let changed = false;
            panes.forEach(p => {
                // Skip Price pane (managed by flex)
                if (p.id === 'price') return;

                if (!next[p.id]) {
                    next[p.id] = {
                        height: DEFAULT_HEIGHTS[p.type] || DEFAULT_HEIGHTS.default,
                        collapsed: false
                    };
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
    }, [panes]);

    const toggleCollapse = useCallback((id: string) => {
        setPaneLayouts(prev => ({
            ...prev,
            [id]: { ...prev[id], collapsed: !prev[id].collapsed }
        }));
    }, []);

    // Explicitly expose settings handler wrapper to toggle collapse or show menu
    const handleSettings = (id: string, originalSettings?: () => void) => {
        if (originalSettings) originalSettings();
        else toggleCollapse(id);
    };

    const setPaneRef = useCallback((id: string, ref: ChartPaneHandle | null) => {
        if (ref) paneRefs.current.set(id, ref);
        else paneRefs.current.delete(id);
    }, []);

    const handleTimeRangeChange = useCallback((range: { from: number; to: number } | null, sourceId: string) => {
        if (!range) return;
        if (syncLock.current && syncLock.current !== sourceId) return;
        syncLock.current = sourceId;
        paneRefs.current.forEach((handle, id) => {
            if (id !== sourceId) handle.setVisibleRange(range);
        });
        if (unlockTimeout.current) clearTimeout(unlockTimeout.current);
        unlockTimeout.current = setTimeout(() => { syncLock.current = null; }, 50);
    }, []);

    const handleCrosshairMove = useCallback((param: MouseEventParams, sourceId: string) => {
        // Future sync logic
    }, []);

    // --- Resize Logic ---
    const handleResize = useCallback((index: number, dy: number) => {
        const upperPane = panes[index];
        const lowerPane = panes[index + 1];
        if (!upperPane || !lowerPane) return;

        setPaneLayouts(prev => {
            const next = { ...prev };

            // Case 1: Upper is Price (Flexible), Lower is Fixed
            if (upperPane.id === 'price') {
                // Drag Down (dy > 0) -> Price Grows? No, split moves down -> Price grows.
                // If Wrapper is Flex-Column, Splitter position is relative?
                // Wait, if I drag splitter DOWN, the element ABOVE it grows.
                // So Price Grows. The Element BELOW it must SHRINK.
                // So Lower Pane Height -= dy.

                const currentH = next[lowerPane.id]?.height || DEFAULT_HEIGHTS.default;
                // Shrink lower pane
                const newH = Math.max(MIN_HEIGHT, currentH - dy);
                next[lowerPane.id] = { ...next[lowerPane.id], height: newH };
            }
            // Case 2: Upper is Fixed, Lower is Fixed
            else if (lowerPane.id !== 'price') {
                // Standard splitter logic
                const upperH = next[upperPane.id]?.height || DEFAULT_HEIGHTS.default;
                const lowerH = next[lowerPane.id]?.height || DEFAULT_HEIGHTS.default;

                // Drag Down -> Upper Grows, Lower Shrinks
                const newUpper = Math.max(MIN_HEIGHT, upperH + dy);
                const newLower = Math.max(MIN_HEIGHT, lowerH - dy);

                // Check if we can resize (don't push below min)
                // Actually simple approach: prioritize Upper change?
                // Let's allow Upper to grow up to available space? 
                // Simpler: Just apply dy if possible.

                next[upperPane.id] = { ...next[upperPane.id], height: newUpper };
                next[lowerPane.id] = { ...next[lowerPane.id], height: newLower };
            }
            // Case 3: Lower is Price (Flexible) - Unlikely in current sorting but possible
            else if (lowerPane.id === 'price') {
                // Drag Down -> Upper Grows. Price (Lower) Shrinks automatically.
                const currentH = next[upperPane.id]?.height || DEFAULT_HEIGHTS.default;
                const newH = Math.max(MIN_HEIGHT, currentH + dy);
                next[upperPane.id] = { ...next[upperPane.id], height: newH };
            }

            return next;
        });
    }, [panes]);

    return (
        <div id="pane-manager-container" className="flex flex-col w-full h-full bg-[var(--bg-primary)] select-none overflow-hidden">
            {panes.map((pane, index) => {
                const isPrice = pane.id === 'price';
                const layout = paneLayouts[pane.id];
                const isCollapsed = layout?.collapsed;
                const height = layout?.height;

                // Price Pane: flex-1
                // Others: fixed height (or collapsed height)
                // BUT we need 'style' for Others. Price uses class.

                return (
                    <div
                        key={pane.id}
                        className={`relative flex flex-col ${isPrice ? 'flex-1 min-h-[200px]' : 'shrink-0'} border-b border-[var(--bg-subtle-border)] transition-[height] duration-75`}
                        style={!isPrice ? { height: isCollapsed ? COLLAPSED_HEIGHT : height } : undefined}
                    >
                        <PaneHeader
                            title={pane.title}
                            id={pane.id}
                            collapsed={isCollapsed}
                            onToggleCollapse={!isPrice ? () => toggleCollapse(pane.id) : undefined}
                            onRemove={pane.onRemove}
                            onSettings={() => handleSettings(pane.id, pane.onSettings)}
                        />
                        {!isCollapsed && (
                            <div className="flex-1 min-h-0 relative">
                                <ChartPane
                                    ref={(r) => setPaneRef(pane.id, r)}
                                    id={pane.id}
                                    height={0} // Managed by Parent
                                    onVisibleTimeRangeChange={handleTimeRangeChange}
                                    onCrosshairMove={handleCrosshairMove}
                                    onChartReady={pane.render}
                                    overlay={pane.overlay}
                                />
                            </div>
                        )}

                        {/* Splitter (Bottom) - Only if not last */}
                        {index < panes.length - 1 && (
                            <PaneSplitter onDrag={(dy) => handleResize(index, dy)} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// --- Helper Components ---

function PaneSplitter({ onDrag }: { onDrag: (dy: number) => void }) {
    const isDragging = useRef(false);
    const startY = useRef(0);

    const handlePointerDown = (e: React.PointerEvent) => {
        isDragging.current = true;
        startY.current = e.clientY;
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        document.body.style.cursor = 'row-resize';
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging.current) return;
        const dy = e.clientY - startY.current;
        startY.current = e.clientY; // Reset for relative delta
        onDrag(dy);
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        isDragging.current = false;
        (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
        document.body.style.cursor = '';
    };

    const handlePointerCancel = (e: React.PointerEvent) => {
        isDragging.current = false;
        (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
        document.body.style.cursor = '';
    };

    return (
        <div
            className="absolute bottom-[-3px] left-0 w-full h-[6px] z-50 cursor-row-resize hover:bg-[var(--accent-primary)]/50 transition-colors"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
        />
    );
}
