/**
 * DrawingToolbar Component
 * Toolbar for KLineChart drawing tools/overlays
 */
'use client';

import { useState } from 'react';
import { useChartStore } from '@/stores';
import { DRAWING_TOOLS } from '@/lib/chart';
import type { OverlayType } from '@/types';

export function DrawingToolbar() {
    const { activeDrawingTool, setActiveDrawingTool, clearOverlays } = useChartStore();
    const [activeCategory, setActiveCategory] = useState<string | null>(null);

    // Group tools by category
    const toolsByCategory = Object.entries(DRAWING_TOOLS).reduce(
        (acc, [key, tool]) => {
            if (!acc[tool.category]) {
                acc[tool.category] = [];
            }
            acc[tool.category].push({ key: key as OverlayType, ...tool });
            return acc;
        },
        {} as Record<string, Array<{ key: OverlayType; name: string; icon: string; description: string }>>
    );

    const handleToolSelect = (tool: OverlayType) => {
        if (activeDrawingTool === tool) {
            // Deselect if clicking same tool
            setActiveDrawingTool(null);
        } else {
            setActiveDrawingTool(tool);
        }
        setActiveCategory(null);
    };

    const handleClearAll = () => {
        if (confirm('Clear all drawings?')) {
            clearOverlays();
        }
    };

    const categories = [
        { id: 'line', label: 'Lines', icon: '📏' },
        { id: 'price', label: 'Price', icon: '💲' },
        { id: 'advanced', label: 'Advanced', icon: '🔧' },
        { id: 'annotation', label: 'Annotate', icon: '📝' },
    ];

    return (
        <div className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] border-b border-[var(--bg-tertiary)]">
            {/* Category Buttons */}
            <div className="flex items-center gap-1">
                {categories.map((cat) => {
                    const hasTools = toolsByCategory[cat.id]?.length > 0;
                    if (!hasTools) return null;

                    return (
                        <div key={cat.id} className="relative">
                            <button
                                onClick={() =>
                                    setActiveCategory(activeCategory === cat.id ? null : cat.id)
                                }
                                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${activeCategory === cat.id
                                    ? 'bg-[var(--accent-primary)] text-white'
                                    : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                                    }`}
                                title={cat.label}
                            >
                                <span className="mr-1">{cat.icon}</span>
                                <span className="hidden sm:inline">{cat.label}</span>
                            </button>

                            {/* Tool Dropdown */}
                            {activeCategory === cat.id && (
                                <>
                                    {/* Backdrop */}
                                    <div
                                        className="fixed inset-0 z-10"
                                        onClick={() => setActiveCategory(null)}
                                    />

                                    {/* Dropdown Panel */}
                                    <div className="absolute top-full left-0 mt-1 bg-[var(--bg-secondary)] border border-[var(--bg-tertiary)] rounded-lg shadow-lg z-20 min-w-[200px]">
                                        <div className="p-1">
                                            {toolsByCategory[cat.id].map((tool) => (
                                                <button
                                                    key={tool.key}
                                                    onClick={() => handleToolSelect(tool.key)}
                                                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors flex items-center gap-2 ${activeDrawingTool === tool.key
                                                        ? 'bg-[var(--accent-primary)] text-white'
                                                        : 'hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                                                        }`}
                                                    title={tool.description}
                                                >
                                                    <span className="text-lg">{tool.icon}</span>
                                                    <div className="flex-1">
                                                        <div className="font-medium">{tool.name}</div>
                                                        <div
                                                            className={`text-xs ${activeDrawingTool === tool.key
                                                                ? 'text-white/80'
                                                                : 'text-[var(--text-tertiary)]'
                                                                }`}
                                                        >
                                                            {tool.description}
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Divider */}
            <div className="h-6 w-px bg-[var(--bg-tertiary)]" />

            {/* Active Tool Display */}
            {activeDrawingTool && (
                <div className="flex items-center gap-2 px-2 py-1 bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30 rounded text-xs">
                    <span className="text-[var(--accent-primary)] font-medium">
                        Drawing: {DRAWING_TOOLS[activeDrawingTool]?.name}
                    </span>
                    <button
                        onClick={() => setActiveDrawingTool(null)}
                        className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                        title="Cancel drawing (ESC)"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Clear All Button */}
            <button
                onClick={handleClearAll}
                className="ml-auto px-2 py-1 text-xs font-medium rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-red-500/20 hover:text-red-500 transition-colors"
                title="Clear all drawings"
            >
                🗑️ Clear All
            </button>
        </div>
    );
}
