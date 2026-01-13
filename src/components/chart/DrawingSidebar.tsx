/**
 * DrawingSidebar Component
 * Vertical toolbar for drawing tools (TradingView-style)
 */
'use client';

import { DRAWING_TOOLS } from '@/lib/chart';
import { useChartStore } from '@/stores';
import type { OverlayType } from '@/types';

export function DrawingSidebar() {
    const { activeDrawingTool, setActiveDrawingTool, clearOverlays } = useChartStore();

    const toolIds: OverlayType[] = [
        'straightLine',
        'horizontalStraightLine',
        'fibonacciLine',
        'priceLine',
        'simpleAnnotation',
        'priceChannelLine',
        'parallelStraightLine',
    ];

    const tools = toolIds.map((id) => ({
        id,
        icon: DRAWING_TOOLS[id].icon,
        label: DRAWING_TOOLS[id].name,
    }));

    const handleToolSelect = (tool: OverlayType) => {
        if (activeDrawingTool === tool) {
            setActiveDrawingTool(null);
            return;
        }
        setActiveDrawingTool(tool);
    };

    const handleClearAll = () => {
        if (confirm('Clear all drawings?')) {
            clearOverlays();
        }
    };

    return (
        <div className="w-[40px] bg-[var(--bg-secondary)] border-r border-[var(--bg-tertiary)] flex flex-col">
            {tools.map((tool) => (
                <button
                    key={tool.id}
                    onClick={() => handleToolSelect(tool.id)}
                    className={`
                        w-10 h-10 flex items-center justify-center
                        transition-colors relative group
                        ${activeDrawingTool === tool.id
                            ? 'bg-[var(--accent-primary)] text-white'
                            : 'hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                        }
                    `}
                    title={tool.label}
                >
                    <span className="text-lg">{tool.icon}</span>

                    {/* Tooltip */}
                    <div className="absolute left-full ml-2 px-2 py-1 bg-[var(--bg-primary)] text-xs text-[var(--text-primary)] rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                        {tool.label}
                    </div>
                </button>
            ))}

            {/* Separator */}
            <div className="flex-1" />

            {/* Clear All Button */}
            <button
                onClick={handleClearAll}
                className="w-10 h-10 flex items-center justify-center hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] transition-colors"
                title="Clear All"
            >
                <span className="text-lg">🗑️</span>
            </button>
        </div>
    );
}
