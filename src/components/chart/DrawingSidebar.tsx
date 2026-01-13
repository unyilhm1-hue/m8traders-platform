/**
 * DrawingSidebar Component
 * Vertical toolbar for drawing tools (TradingView-style)
 */
'use client';

import { useChartStore } from '@/stores';
import { DRAWING_TOOLS } from '@/lib/chart/config';
import { DRAWING_ICONS, UI_ICONS } from '@/lib/chart/icons';
import type { OverlayType } from '@/types';

export function DrawingSidebar() {
    const { activeDrawingTool, setActiveDrawingTool, clearDrawings } = useChartStore();
    const { Trash } = UI_ICONS;

    // Select most commonly used tools from the config
    const selectedTools: OverlayType[] = [
        'segment',                  // Trend Line
        'horizontalStraightLine',  // Horizontal Line
        'fibonacciLine',           // Fibonacci
        'priceLine',               // Price Line
        'simpleAnnotation',        // Annotation
        'priceChannelLine',        // Price Channel
    ];

    const tools = selectedTools.map(toolId => ({
        id: toolId,
        IconComponent: DRAWING_ICONS[toolId] || DRAWING_ICONS['segment'], // Explicitly use Component
        ...DRAWING_TOOLS[toolId]
    }));

    const handleToolClick = (toolId: OverlayType) => {
        // Toggle: if clicking the same tool, deactivate it
        if (activeDrawingTool === toolId) {
            setActiveDrawingTool(null);
        } else {
            setActiveDrawingTool(toolId);
        }
    };

    return (
        <div className="w-[50px] flex flex-col py-3 gap-2 bg-[var(--bg-secondary)] border-r border-[var(--bg-subtle-border)] z-30">
            {tools.map((tool) => {
                const Icon = tool.IconComponent;
                return (
                    <div key={tool.id} className="relative group flex justify-center px-1">
                        <button
                            onClick={() => handleToolClick(tool.id)}
                            className={`
                                w-9 h-9 flex items-center justify-center rounded-lg
                                transition-all duration-200 relative
                                ${activeDrawingTool === tool.id
                                    ? 'bg-[var(--accent-primary)] text-white shadow-lg shadow-[var(--accent-primary)]/20 scale-105'
                                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] hover:scale-105'
                                }
                            `}
                        >
                            <Icon size={20} className="stroke-[1.5]" />
                        </button>

                        {/* Tooltip (Portal-like absolute positioning) */}
                        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 bg-[var(--bg-secondary)] border border-[var(--bg-subtle-border)] text-xs font-medium text-[var(--text-primary)] rounded-md shadow-xl opacity-0 translate-x-[-5px] group-hover:opacity-100 group-hover:translate-x-0 transition-all pointer-events-none whitespace-nowrap z-50">
                            {tool.name}
                            {/* Tiny arrow */}
                            <div className="absolute top-1/2 -left-[4px] -translate-y-1/2 w-2 h-2 bg-[var(--bg-secondary)] border-l border-b border-[var(--bg-subtle-border)] transform rotate-45" />
                        </div>
                    </div>
                );
            })}

            {/* Separator */}
            <div className="my-1 mx-3 h-px bg-[var(--bg-tertiary)]" />

            {/* Clear All Button */}
            <div className="relative group flex justify-center px-1">
                <button
                    onClick={clearDrawings}
                    className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--color-loss)] transition-colors"
                >
                    <Trash size={20} className="stroke-[1.5]" />
                </button>
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 bg-[var(--bg-secondary)] border border-[var(--bg-subtle-border)] text-xs font-medium text-[var(--text-primary)] rounded-md shadow-xl opacity-0 translate-x-[-5px] group-hover:opacity-100 group-hover:translate-x-0 transition-all pointer-events-none whitespace-nowrap z-50">
                    Clear Drawings
                    <div className="absolute top-1/2 -left-[4px] -translate-y-1/2 w-2 h-2 bg-[var(--bg-secondary)] border-l border-b border-[var(--bg-subtle-border)] transform rotate-45" />
                </div>
            </div>
        </div>
    );
}
