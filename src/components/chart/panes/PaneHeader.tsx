'use client';

import { UI_ICONS } from '@/lib/chart/icons';
import { useChartStore } from '@/stores';
import { X, ChevronDown, ChevronRight } from 'lucide-react';

interface PaneHeaderProps {
    title: string;
    id: string; // 'price', 'volume', or indicator ID
    collapsed?: boolean;
    onToggleCollapse?: () => void;
    onRemove?: () => void;
    onSettings?: () => void;
}

export function PaneHeader({ title, id, collapsed, onToggleCollapse, onRemove, onSettings }: PaneHeaderProps) {
    const { Settings } = UI_ICONS;

    // Don't show controls for Price pane usually, maybe just settings
    const isPrice = id === 'price';
    const isVolume = id === 'volume';

    return (
        <div className="absolute top-1 left-1 z-20 flex items-center gap-2 px-2 py-0.5 
                      bg-[var(--bg-secondary)]/80 backdrop-blur-sm 
                      border border-[var(--bg-subtle-border)] rounded shadow-sm 
                      transition-opacity opacity-80 hover:opacity-100 group select-none cursor-default"
            onClick={(e) => {
                if (onToggleCollapse) {
                    e.stopPropagation();
                    onToggleCollapse();
                }
            }}
        >
            {/* Collapse Icon */}
            {onToggleCollapse && (
                <div className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer">
                    {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </div>
            )}

            <span className="text-xs font-semibold text-[var(--text-secondary)]">
                {title}
            </span>

            {/* Controls (Hidden until hover) */}
            <div className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${isPrice && !onSettings ? 'hidden' : 'flex'}`}>

                {/* Settings Button */}
                {onSettings && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onSettings(); }}
                        className="p-0.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded hover:bg-[var(--bg-tertiary)]"
                    >
                        <Settings size={12} />
                    </button>
                )}

                {/* Remove Button (Not for Price/Volume usually, depends on config) */}
                {onRemove && !isPrice && !isVolume && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onRemove(); }}
                        className="p-0.5 text-[var(--text-tertiary)] hover:text-[var(--color-loss)] rounded hover:bg-[var(--bg-tertiary)]"
                    >
                        <X size={12} />
                    </button>
                )}
            </div>
        </div>
    );
}
