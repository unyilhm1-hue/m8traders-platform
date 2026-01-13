/**
 * Icon mapping for Chart Tools and UI elements
 * Uses lucide-react for consistent, premium iconography
 */
import {
    TrendingUp,
    Minus,
    MoreVertical,
    SeparatorVertical,
    GalleryVerticalEnd,
    Type,
    Tag,
    ArrowRight,
    MoveHorizontal, // For segments
    MoveVertical,
    DollarSign,
    Ruler,
    Grid,
    Hash, // For Parallel
    Trash2,
    Play,
    Pause,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Check,
    Settings,
    Layers,
    Clock,
    Activity,
    Maximize2,
    Calculator,
    Sunrise,
    Sun,
    Moon,
    Bell,
    Flag
} from 'lucide-react';
import type { ElementType } from 'react';

// Map of drawing tool IDs to Lucide components
export const DRAWING_ICONS: Record<string, ElementType> = {
    // Horizontal
    horizontalRayLine: ArrowRight,
    horizontalSegment: MoveHorizontal,
    horizontalStraightLine: Minus,

    // Vertical
    verticalRayLine: MoveVertical, // Using MoveVertical as a proxy for V-Ray
    verticalSegment: SeparatorVertical,
    verticalStraightLine: MoreVertical,

    // Trend
    rayLine: TrendingUp,
    segment: TrendingUp, // Generic trend icon
    straightLine: TrendingUp,

    // Price
    priceLine: DollarSign,
    priceChannelLine: Grid,

    // Advanced
    parallelStraightLine: Hash,
    fibonacciLine: GalleryVerticalEnd,

    // Annotation
    simpleAnnotation: Type,
    simpleTag: Tag,
};

// UI Icons for general use
export const UI_ICONS = {
    Play,
    Pause,
    Next: ChevronRight,
    Prev: ChevronLeft,
    Dropdown: ChevronDown,
    Check,
    Trash: Trash2,
    Settings,
    Layers,
    Time: Clock,
    Activity,
    Maximize: Maximize2,
    Calculator,
    Sunrise,
    Sun,
    Moon,
    Bell,
    Flag,
};
