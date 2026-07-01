/**
 * types.ts
 * Type definitions for the geometric minimalist playing card rendering library.
 */

export interface Palette {
    id: string;
    name: string;
    background: string;
    border: string;
    primary: string;
    secondary: string;
    accent: string;
    charcoal: string;
    text: string;
    panelBg?: string;
    // New versatile game-related colors
    tertiary: string;
    success: string;
    danger: string;
}

export type ShapeType =
    | 'circle'
    | 'semi-circle'
    | 'quarter-circle'
    | 'rectangle'
    | 'triangle'
    | 'arch'
    | 'zig-zag'
    | 'stripes'
    | 'dots'
    | 'grid'
    | 'bezier';

export interface BezierPoint {
    x: number; // 0 to 100
    y: number; // 0 to 100
    cx1?: number; // Control point 1 x
    cy1?: number; // Control point 1 y
    cx2?: number; // Control point 2 x
    cy2?: number; // Control point 2 y
}

export interface PrimitiveShape {
    id: string;
    type: ShapeType;
    x: number; // Percent of icon viewbox width (0-100)
    y: number; // Percent of icon viewbox height (0-100)
    scaleX?: number; // Scaling factor (default 1)
    scaleY?: number;
    rotation?: number; // Degrees (0-360)
    opacity?: number; // 0 to 1
    fill: string; // Hex color or palette key ('primary', 'accent', etc.)
    stroke?: string; // Hex color or palette key
    strokeWidth?: number; // Percentage width
    patternScale?: number; // Specifically for repeating patterns
    bezierPoints?: BezierPoint[]; // For custom curves
    customPath?: string; // Standard SVG path string for complex math curves
}

export type BooleanOpType = 'union' | 'intersect' | 'subtract';

export interface BooleanOperation {
    id: string;
    type: 'boolean';
    op: BooleanOpType;
    baseId: string;      // ID of the target layer
    operandId: string;   // ID of the layer acting as clip-path/mask
}

export interface IconRef {
    id: string;
    type: 'ref';
    iconId: string;      // ID of a saved reusable icon
    x: number;
    y: number;
    scale: number;
    rotation?: number;
    opacity?: number;
    colorOverride?: string; // Optional hex or palette key to paint all layers
}

export type IconLayer = PrimitiveShape | BooleanOperation | IconRef;

export interface IconObject {
    id: string;
    name: string;
    layers: IconLayer[];
}

export interface HeaderRegion {
    title?: string;
    subtitle?: string;
    stats?: string;
    background?: string; // Configurable background
    icons?: Array<{
        iconId: string;
        value?: string;
        color?: string;
        scaling?: number; // Custom scale factor for this icon
    }>;
}

export interface MainArtRegion {
    iconId?: string;
    showFrame?: boolean;
    frameStyle?: 'none' | 'thin' | 'thick' | 'double';
    scaling?: number; // Custom scale factor for the main art icon
}

export interface DataRow {
    iconId?: string;
    label?: string;
    value?: string;
    color?: string;
    scaling?: number; // Custom scale factor for the row-level icon
    // Configurable list attributes
    iconsList?: Array<{
        iconId: string;
        value?: string;
        color?: string;
        scaling?: number; // Custom scale factor for this list icon
    }>;
    iconsListBg?: string;          // Individual cost pill background
    iconsListAlign?: 'left' | 'center' | 'right'; // List alignment
    iconsListIconSize?: number;    // Icon size inside the pill (in em)
    iconsListGap?: number;         // Gap between pills (in em)
}

export interface DataRegion {
    rows: DataRow[];
    background?: string; // Configurable background
}

export interface FooterRegion {
    text: string;
    align: 'left' | 'center' | 'right';
    verticalAlign: 'top' | 'center' | 'bottom';
    background?: string; // Configurable background
    size?: number; // Optional size multiplier (default: 1)
}

export interface OverlayLeaf {
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    iconId?: string;
    value?: string;
    color?: string;
    scaling?: number; // Custom scale factor for the overlay icon
    // Configurable style and position options for overlays
    showBorder?: boolean;      // Enable or disable the border
    borderColor?: string;      // Color of the outer border/ribbon
    backgroundColor?: string;  // Color of the inner fill/ribbon
    borderWidth?: number;      // Width of the outer border (in em)
    offsetX?: number;          // Horizontal offset (in em)
    offsetY?: number;          // Vertical offset (in em)
}

export interface CardDefinition {
    id: string;
    name: string;
    widthMm: number;
    heightMm: number;
    borderRadiusMm: number;
    palette: Palette | string; // Palette object or ID of a preset palette
    borderWidth?: number;      // Card outer border width (in em), set to 0 to disable
    borderColor?: string;      // Card outer border color key
    backIconId?: string;       // Optional icon ID for the card's back face (i.e. flipped side)
    backIconScaling?: number;  // Optional custom scale factor for the back face icon
    backBgColor?: string;      // Optional background color key/hex for the back face
    header?: HeaderRegion;
    mainArt?: MainArtRegion;
    data?: DataRegion;
    footer?: FooterRegion;
    overlay?: OverlayLeaf;
}

export type InteractionStyle = 'offset' | 'border' | 'outline' | 'glow' | 'saturation' | 'none';

