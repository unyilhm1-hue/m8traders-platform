/**
 * DrawingSidebar Component
 * Vertical toolbar for drawing tools (TradingView-style)
 */
'use client';

import { useState } from 'react';

type DrawingTool = 'trend' | 'horizontal' | 'fibonacci' | 'price' | 'text' | 'rectangle' | 'circle';

export function DrawingSidebar() {
    const [activeTool, setActiveTool] = useState<DrawingTool>('trend');

    const tools: Array<{ id: DrawingTool; icon: string; label: string }> = [
        { id: 'trend', icon: '📏', label: 'Trend Line' },
        { id: 'horizontal', icon: '📐', label: 'Horizontal' },
        { id: 'fibonacci', icon: '📊', label: 'Fibonacci' },
        { id: 'price', icon: '💰', label: 'Price Alert' },
        { id: 'text', icon: '📝', label: 'Text' },
        { id: 'rectangle', icon: '🔲', label: 'Rectangle' },
        { id: 'circle', icon: '⭕', label: 'Circle' },
    ];

    return (
        <div className="w-[40px] bg-[var(--bg-secondary)] border-r border-[var(--bg-tertiary)] flex flex-col">
            {tools.map((tool) => (
                <button
                    key={tool.id}
                    onClick={() => setActiveTool(tool.id)}
                    className={`
                        w-10 h-10 flex items-center justify-center
                        transition-colors relative group
                        ${activeTool === tool.id
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
                className="w-10 h-10 flex items-center justify-center hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] transition-colors"
                title="Clear All"
            >
                <span className="text-lg">🗑️</span>
            </button>
        </div>
    );
}
