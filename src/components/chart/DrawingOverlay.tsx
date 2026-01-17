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
    const {
        activeDrawingTool,
        setActiveDrawingTool,
        drawings,
        addDrawing
    } = useChartStore();

    // Local state for incomplete drawing (Anchored in Time/Price)
    const [isDrawing, setIsDrawing] = useState(false);
    const [anchorStart, setAnchorStart] = useState<{ timestamp: number, price: number } | null>(null);
    const [anchorEnd, setAnchorEnd] = useState<{ timestamp: number, price: number } | null>(null);

    // Force re-render on chart scroll/zoom
    const [version, setVersion] = useState(0);

    const svgRef = useRef<SVGSVGElement>(null);

    // Sync with Chart Updates (Scroll/Zoom)
    useEffect(() => {
        if (!chart) return;

        const handleUpdate = () => {
            // Force re-render to recalculate screen coordinates
            setVersion(v => v + 1);
        };

        chart.timeScale().subscribeVisibleLogicalRangeChange(handleUpdate);
        chart.timeScale().subscribeVisibleTimeRangeChange(handleUpdate);

        return () => {
            chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleUpdate);
            chart.timeScale().unsubscribeVisibleTimeRangeChange(handleUpdate);
        };
    }, [chart]);

    // Helper: Screen (x,y) -> Data (time, price)
    const coordinateToPoint = (x: number, y: number) => {
        if (!chart || !mainSeries) return null;

        const time = chart.timeScale().coordinateToTime(x);
        const price = mainSeries.coordinateToPrice(y); // 🔥 FIX: Use series method directly

        if (time === null || price === null) return null;

        return {
            timestamp: time as number,
            price
        };
    };

    // Helper: Data (time, price) -> Screen (x,y)
    const pointToCoordinate = (p: { timestamp: number, price: number }) => {
        if (!chart || !mainSeries) return null;

        const x = chart.timeScale().timeToCoordinate(p.timestamp as any);
        const y = mainSeries.priceToCoordinate(p.price); // 🔥 FIX: Use series method directly

        if (x === null || y === null) return null;
        return { x, y };
    };

    const handleMouseDown = (e: ReactMouseEvent) => {
        if (!activeDrawingTool || !svgRef.current) return;

        const rect = svgRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const point = coordinateToPoint(x, y);
        if (!point) return;

        if (!isDrawing) {
            setIsDrawing(true);
            setAnchorStart(point);
            setAnchorEnd(point); // Init end point
        } else {
            // Finish drawing
            if (anchorStart) {
                // Persist to store
                addDrawing({
                    id: crypto.randomUUID(),
                    type: activeDrawingTool as any, // TODO: Fix type
                    points: [anchorStart, point],
                    style: { color: '#2962FF', lineWidth: 2, lineStyle: 'solid' }
                });
            }

            setIsDrawing(false);
            setAnchorStart(null);
            setAnchorEnd(null);
            setActiveDrawingTool(null);
        }
    };

    const handleMouseMove = (e: ReactMouseEvent) => {
        if (!isDrawing || !svgRef.current) return;

        const rect = svgRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const point = coordinateToPoint(x, y);
        if (point) {
            setAnchorEnd(point);
        }
    };

    // Render Logic
    const renderDrawing = (d: { type: string, points: { timestamp: number, price: number }[], style?: any }) => {
        const p1 = d.points[0];
        const p2 = d.points[1];
        if (!p1 || !p2) return null;

        const start = pointToCoordinate(p1);
        const end = pointToCoordinate(p2);
        if (!start || !end) return null;

        const color = d.style?.color || '#2962FF';

        switch (d.type) {
            case 'horizontalRayLine': {
                // Ray extends to right infinity
                return (
                    <line
                        x1={start.x}
                        y1={start.y}
                        x2={10000} // Far right
                        y2={start.y}
                        stroke={color}
                        strokeWidth="2"
                    />
                );
            }
            case 'horizontalStraightLine': {
                return (
                    <line
                        x1={0}
                        y1={start.y}
                        x2={10000}
                        y2={start.y}
                        stroke={color}
                        strokeWidth="2"
                    />
                );
            }
            case 'verticalStraightLine': {
                return (
                    <line
                        x1={start.x}
                        y1={0}
                        x2={start.x}
                        y2={10000}
                        stroke={color}
                        strokeWidth="2"
                    />
                );
            }
            case 'rect': {
                const x = Math.min(start.x, end.x);
                const y = Math.min(start.y, end.y);
                const width = Math.abs(end.x - start.x);
                const height = Math.abs(end.y - start.y);
                return (
                    <rect
                        x={x}
                        y={y}
                        width={width}
                        height={height}
                        fill={color}
                        fillOpacity="0.2"
                        stroke={color}
                        strokeWidth="1"
                    />
                );
            }
            case 'fibonacciLine': {
                // Fibonacci Levels: 0, 0.236, 0.382, 0.5, 0.618, 0.786, 1
                const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
                const dy = end.y - start.y;

                return (
                    <g>
                        {/* Trendline */}
                        <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={color} strokeDasharray="4 4" opacity="0.5" />

                        {/* Levels */}
                        {levels.map(level => {
                            const y = start.y + (dy * level);
                            return (
                                <line
                                    key={level}
                                    x1={Math.min(start.x, end.x)}
                                    y1={y}
                                    x2={Math.max(start.x, end.x)} // Or extend to right? Typically Fib extends width of trendline or infinity.
                                    y2={y}
                                    stroke={color}
                                    strokeWidth="1"
                                    opacity={level === 0 || level === 1 ? "0.8" : "0.5"}
                                />
                            );
                        })}
                    </g>
                );
            }
            case 'straightLine':
            default: {
                return (
                    <line
                        x1={start.x}
                        y1={start.y}
                        x2={end.x}
                        y2={end.y}
                        stroke={color}
                        strokeWidth="2"
                    />
                );
            }
        }
    };

    return (
        <svg
            ref={svgRef}
            className={`absolute inset-0 z-30 w-full h-full pointer-events-auto ${activeDrawingTool ? 'cursor-crosshair' : 'cursor-default'}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
        >
            {/* Render Saved Drawings */}
            {drawings.map(d => (
                <g key={d.id}>
                    {renderDrawing(d)}
                </g>
            ))}

            {/* Render Active Drawing */}
            {isDrawing && anchorStart && anchorEnd && (
                renderDrawing({
                    type: activeDrawingTool as string,
                    points: [anchorStart, anchorEnd],
                    style: { color: '#2962FF' }
                } as any)
            )}
        </svg>
    );
}
