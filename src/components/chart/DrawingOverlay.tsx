'use client';

import { useEffect, useRef, useState } from 'react';
import { useChartContext } from '@/contexts/ChartContext';
import { useChartStore } from '@/stores';
import type { MouseEvent as ReactMouseEvent } from 'react';

/**
 * Overlay component for drawing tools (Trendlines, etc.)
 * Sits on top of the chart and syncs via Time/Price coordinates.
 */
export function DrawingOverlay() {
    const { chart, mainSeries } = useChartContext();
    const { activeDrawingTool, setActiveDrawingTool } = useChartStore();

    // Local state for incomplete drawing
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPoint, setStartPoint] = useState<{ x: number, y: number } | null>(null);
    const [currentPoint, setCurrentPoint] = useState<{ x: number, y: number } | null>(null);

    // TODO: Store confirmed drawings in global store
    // For now, simple MVP of visual feedback

    const svgRef = useRef<SVGSVGElement>(null);

    // Sync logic would go here (converting time/price to xy)
    // For MVP interaction, we just use screen coordinates relative to container

    const handleMouseDown = (e: ReactMouseEvent) => {
        if (!activeDrawingTool || !svgRef.current) return;

        const rect = svgRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (!isDrawing) {
            setIsDrawing(true);
            setStartPoint({ x, y });
            setCurrentPoint({ x, y });
        } else {
            // Finish drawing
            setIsDrawing(false);
            setStartPoint(null);
            setCurrentPoint(null);
            setActiveDrawingTool(null); // Reset tool after one use (TradingView style default)
            // Save drawing to store...
        }
    };

    const handleMouseMove = (e: ReactMouseEvent) => {
        if (!isDrawing || !svgRef.current) return;

        const rect = svgRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        setCurrentPoint({ x, y });
    };

    if (!activeDrawingTool && !isDrawing) return null;

    return (
        <svg
            ref={svgRef}
            className="absolute inset-0 z-30 w-full h-full pointer-events-auto cursor-crosshair"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
        >
            {isDrawing && startPoint && currentPoint && (
                <line
                    x1={startPoint.x}
                    y1={startPoint.y}
                    x2={currentPoint.x}
                    y2={currentPoint.y}
                    stroke="#2962FF"
                    strokeWidth="2"
                />
            )}
        </svg>
    );
}
