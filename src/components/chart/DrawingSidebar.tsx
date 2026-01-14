/**
 * DrawingSidebar Component
 * Vertical toolbar for drawing tools (TradingView-style)
 */
'use client';

import { useChartStore } from '@/stores';
import { DRAWING_TOOLS } from '@/lib/chart/config';
import { DRAWING_ICONS, UI_ICONS } from '@/lib/chart/icons';
import type { OverlayType } from '@/types';
import { Portal } from '@/components/ui/Portal';
import { useState } from 'react';

export function DrawingSidebar() {
    const { activeDrawingTool, setActiveDrawingTool, clearDrawings } = useChartStore();
    const { Trash } = UI_ICONS;

    // State for premium tooltip
    const [hoveredTool, setHoveredTool] = useState<OverlayType | 'clear' | null>(null);
    const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });

    // Group tools by category
    const toolsBySize = Object.entries(DRAWING_TOOLS).reduce((acc, [key, tool]) => {
        const category = tool.category;
        if (!acc[category]) acc[category] = [];
        acc[category].push({
            id: key as OverlayType,
            IconComponent: DRAWING_ICONS[key] || DRAWING_ICONS['segment'],
            ...tool
        });
        return acc;
    }, {} as Record<string, any[]>);

    // Define category order
    const categories = ['line', 'price', 'advanced', 'annotation'];

    const handleToolClick = (toolId: OverlayType) => {
        if (activeDrawingTool === toolId) {
            setActiveDrawingTool(null);
        } else {
            setActiveDrawingTool(toolId);
        }
    };

    const handleMouseEnter = (e: React.MouseEvent, id: OverlayType | 'clear') => {
        const rect = e.currentTarget.getBoundingClientRect();
        setTooltipPos({
            top: rect.top + rect.height / 2,
            left: rect.right + 12 // Offset from button
        });
        setHoveredTool(id);
    };

    const handleMouseLeave = () => {
        setHoveredTool(null);
    };

    return (
        <div className="w-[52px] flex flex-col bg-[var(--bg-secondary)] border-r border-[var(--bg-subtle-border)] z-30 h-full">
            <div className="flex-1 overflow-y-auto no-scrollbar py-3 flex flex-col gap-1">
                {categories.map((category, index) => (
                    <div key={category} className="flex flex-col gap-1">
                        {toolsBySize[category]?.map((tool) => {
                            const Icon = tool.IconComponent;
                            return (
                                <div key={tool.id} className="relative group flex justify-center px-1">
                                    <button
                                        onClick={() => handleToolClick(tool.id)}
                                        onMouseEnter={(e) => handleMouseEnter(e, tool.id)}
                                        onMouseLeave={handleMouseLeave}
                                        className={`
                                            w-9 h-9 flex items-center justify-center rounded-lg
                                            transition-all duration-200 relative
                                            ${activeDrawingTool === tool.id
                                                ? 'bg-[var(--accent-primary)] text-white shadow-lg shadow-[var(--accent-primary)]/20 scale-105'
                                                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] hover:scale-105'
                                            }
                                        `}
                                    >
                                        <Icon size={18} className="stroke-[1.5]" />
                                    </button>
                                </div>
                            );
                        })}
                        {/* Divider between categories (except last) */}
                        {index < categories.length - 1 && toolsBySize[category]?.length > 0 && (
                            <div className="my-1 mx-3 h-px bg-[var(--bg-tertiary)]/50" />
                        )}
                    </div>
                ))}
            </div>

            {/* Clear All Button (Sticky Bottom) */}
            <div className="py-2 border-t border-[var(--bg-subtle-border)] flex justify-center bg-[var(--bg-secondary)]">
                <div className="relative group flex justify-center px-1">
                    <button
                        onClick={clearDrawings}
                        onMouseEnter={(e) => handleMouseEnter(e, 'clear')}
                        onMouseLeave={handleMouseLeave}
                        className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--color-loss)] transition-colors"
                    >
                        <Trash size={18} className="stroke-[1.5]" />
                    </button>
                </div>
            </div>

            {/* Portal Tooltip */}
            {hoveredTool && (
                <Portal>
                    <div
                        className="fixed z-[9999] px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--bg-subtle-border)] rounded-md shadow-xl animate-in fade-in zoom-in-95 duration-100 pointer-events-none min-w-max"
                        style={{
                            top: tooltipPos.top,
                            left: tooltipPos.left,
                            transform: 'translateY(-50%)'
                        }}
                    >
                        {hoveredTool === 'clear' ? (
                            <div className="text-xs font-semibold text-[var(--text-primary)]">Clear Drawings</div>
                        ) : (
                            <>
                                <div className="text-xs font-semibold text-[var(--text-primary)]">
                                    {DRAWING_TOOLS[hoveredTool]?.name}
                                </div>
                                <div className="text-[10px] text-[var(--text-tertiary)]">
                                    {DRAWING_TOOLS[hoveredTool]?.description}
                                </div>
                            </>
                        )}
                        {/* Arrow pointing left */}
                        <div className="absolute top-1/2 -left-[4px] -translate-y-1/2 w-2 h-2 bg-[var(--bg-secondary)] border-l border-b border-[var(--bg-subtle-border)] transform rotate-45" />
                    </div>
                </Portal>
            )}
        </div>
    );
}
