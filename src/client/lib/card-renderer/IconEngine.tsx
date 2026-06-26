/**
 * IconEngine.tsx
 * Pure vector icon engine that renders geometric primitives and handles Boolean logic.
 */

import * as React from 'react';
import { useId } from 'react';
import { Palette, IconObject, IconLayer, PrimitiveShape, BooleanOperation, IconRef, ShapeType } from './types';

interface ExpressiveIconProps {
    icon: IconObject;
    palette: Palette;
    scale?: number;
    className?: string;
    style?: React.CSSProperties;
    savedIcons?: Record<string, IconObject>;
    colorOverride?: string;
}

/**
 * Helper to resolve palette colors or return the literal color.
 */
export function resolveColor(colorStr: string, palette: Palette, override?: string): string {
    if (override) return override;
    if (!colorStr) return 'transparent';
    const key = colorStr.toLowerCase() as keyof Palette;
    if (palette && palette[key]) {
        return palette[key] as string;
    }
    return colorStr;
}

export const ExpressiveIcon: React.FC<ExpressiveIconProps> = ({
    icon,
    palette,
    scale = 1,
    className = '',
    style = {},
    savedIcons = {},
    colorOverride
}) => {
    const uniqueId = useId().replace(/:/g, '_'); // SVG IDs cannot contain colons in some environments

    if (!icon || !icon.layers) {
        return null;
    }

    // Map to quickly find layers by ID
    const layersMap = new Map<string, IconLayer>();
    icon.layers.forEach(layer => {
        layersMap.set(layer.id, layer);
    });

    // Track which layers are consumed as operands in boolean operations
    // (so we don't render them as standalone visible layers)
    const consumedLayerIds = new Set<string>();
    icon.layers.forEach(layer => {
        if (layer.type === 'boolean') {
            consumedLayerIds.add((layer as BooleanOperation).operandId);
        }
    });

    // Lists of SVG Defs (masks, clipPaths, patterns) that we will collect during compilation
    const defs: React.ReactNode[] = [];

    /**
     * Renders a primitive shape centered at (0,0) with its local geometry.
     * The position, scaling, rotation are applied via transform.
     */
    const renderPrimitiveGeometry = (shape: PrimitiveShape, colorMod?: string): React.ReactElement | null => {
        const fillColor = resolveColor(shape.fill, palette, colorMod ?? colorOverride);
        const strokeColor = shape.stroke ? resolveColor(shape.stroke, palette, colorMod ?? colorOverride) : 'none';
        const strokeWidth = shape.strokeWidth ?? 0;

        const commonProps = {
            fill: fillColor,
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            opacity: shape.opacity ?? 1,
        };

        switch (shape.type) {
            case 'circle':
                return <circle cx="0" cy="0" r="25" {...commonProps} />;

            case 'semi-circle':
                // Upper semi-circle
                return <path d="M -25,0 A 25,25 0 0,1 25,0 Z" {...commonProps} />;

            case 'quarter-circle':
                // Bottom-left quarter circle
                return <path d="M 0,0 L 25,0 A 25,25 0 0,1 0,25 Z" {...commonProps} />;

            case 'rectangle':
                return <rect x="-25" y="-25" width="50" height="50" {...commonProps} />;

            case 'triangle':
                // Equilateral-ish triangle pointing up
                return <polygon points="0,-25 25,22 -25,22" {...commonProps} />;

            case 'arch':
                // Rectangle with rounded top
                return <path d="M -25,25 L -25,0 A 25,25 0 0,1 25,0 L 25,25 Z" {...commonProps} />;

            case 'zig-zag': {
                // Repeating zig-zag line
                return (
                    <path
                        d="M -25,-10 L -12.5,10 L 0,-10 L 12.5,10 L 25,-10"
                        fill="none"
                        stroke={fillColor !== 'transparent' ? fillColor : strokeColor}
                        strokeWidth={strokeWidth > 0 ? strokeWidth : 4}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={shape.opacity ?? 1}
                    />
                );
            }

            case 'stripes':
            case 'dots':
            case 'grid': {
                const patternId = `${uniqueId}_pattern_${shape.id}`;
                const pScale = shape.patternScale ?? 1;
                const size = 15 * pScale;

                let patternContent: React.ReactNode = null;
                if (shape.type === 'stripes') {
                    patternContent = (
                        <pattern
                            id={patternId}
                            width={size}
                            height={size}
                            patternTransform="rotate(45 0 0)"
                            patternUnits="userSpaceOnUse"
                        >
                            <line
                                x1="0"
                                y1="0"
                                x2="0"
                                y2={size}
                                stroke={fillColor}
                                strokeWidth={size / 3}
                            />
                        </pattern>
                    );
                } else if (shape.type === 'dots') {
                    patternContent = (
                        <pattern
                            id={patternId}
                            width={size}
                            height={size}
                            patternUnits="userSpaceOnUse"
                        >
                            <circle
                                cx={size / 2}
                                cy={size / 2}
                                r={size / 4}
                                fill={fillColor}
                            />
                        </pattern>
                    );
                } else {
                    // grid
                    patternContent = (
                        <pattern
                            id={patternId}
                            width={size}
                            height={size}
                            patternUnits="userSpaceOnUse"
                        >
                            <rect
                                x="0"
                                y="0"
                                width={size}
                                height={size}
                                fill="none"
                                stroke={fillColor}
                                strokeWidth={size / 10 || 1}
                            />
                        </pattern>
                    );
                }

                // Add pattern to defs
                defs.push(<React.Fragment key={patternId}>{patternContent}</React.Fragment>);

                return (
                    <rect
                        x="-25"
                        y="-25"
                        width="50"
                        height="50"
                        fill={`url(#${patternId})`}
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        opacity={shape.opacity ?? 1}
                    />
                );
            }

            case 'bezier': {
                let pathData = '';
                if (shape.customPath) {
                    pathData = shape.customPath;
                } else if (shape.bezierPoints && shape.bezierPoints.length > 0) {
                    // Compile points into SVG Path. Coordinate space is -25 to 25 local.
                    const pts = shape.bezierPoints;
                    pathData = `M ${pts[0].x - 25} ${pts[0].y - 25}`;
                    for (let i = 1; i < pts.length; i++) {
                        const pt = pts[i];
                        if (pt.cx1 !== undefined && pt.cy1 !== undefined) {
                            if (pt.cx2 !== undefined && pt.cy2 !== undefined) {
                                pathData += ` C ${pt.cx1 - 25} ${pt.cy1 - 25}, ${pt.cx2 - 25} ${pt.cy2 - 25}, ${pt.x - 25} ${pt.y - 25}`;
                            } else {
                                pathData += ` S ${pt.cx1 - 25} ${pt.cy1 - 25}, ${pt.x - 25} ${pt.y - 25}`;
                            }
                        } else {
                            pathData += ` L ${pt.x - 25} ${pt.y - 25}`;
                        }
                    }
                    pathData += ' Z';
                } else {
                    return null;
                }
                return <path d={pathData} {...commonProps} />;
            }

            default:
                return null;
        }
    };

    /**
     * Recursively compiles a layer node into a renderable React Element.
     */
    const compileLayer = (layer: IconLayer, colorMod?: string): React.ReactElement | null => {
        if (!layer) return null;

        // 1. Primitive Shape
        if (layer.type !== 'boolean' && layer.type !== 'ref') {
            const shape = layer as PrimitiveShape;
            const geom = renderPrimitiveGeometry(shape, colorMod);
            if (!geom) return null;

            const transform = `translate(${shape.x}, ${shape.y}) scale(${shape.scaleX ?? 1}, ${shape.scaleY ?? 1}) rotate(${shape.rotation ?? 0})`;

            return (
                <g key={shape.id} transform={transform}>
                    {geom}
                </g>
            );
        }

        // 2. Icon Reference
        if (layer.type === 'ref') {
            const ref = layer as IconRef;
            const targetIcon = savedIcons[ref.iconId];
            if (!targetIcon) return null;

            const transform = `translate(${ref.x}, ${ref.y}) scale(${ref.scale}) rotate(${ref.rotation ?? 0})`;
            const effectiveColor = ref.colorOverride ? resolveColor(ref.colorOverride, palette, colorMod ?? colorOverride) : colorMod;

            return (
                <g key={ref.id} transform={transform} opacity={ref.opacity ?? 1}>
                    <ExpressiveIcon
                        icon={targetIcon}
                        palette={palette}
                        scale={1}
                        savedIcons={savedIcons}
                        colorOverride={effectiveColor}
                    />
                </g>
            );
        }

        // 3. Boolean Operation
        if (layer.type === 'boolean') {
            const bool = layer as BooleanOperation;
            const base = layersMap.get(bool.baseId);
            const operand = layersMap.get(bool.operandId);

            if (!base) return null;

            // Render base element
            const baseEl = compileLayer(base, colorMod);
            if (!baseEl) return null;

            if (!operand) {
                // If no operand, just render base
                return baseEl;
            }

            const opKey = `${uniqueId}_bool_${bool.id}`;

            if (bool.op === 'subtract') {
                // Subtraction: Mask out the operand from the base
                const maskId = `mask_${opKey}`;

                // Compile operand inside mask, forcing it to be solid black
                const operandEl = compileLayer(operand, '#000000');

                defs.push(
                    <mask id={maskId} key={maskId}>
                        {/* White background: keeps everything */}
                        <rect x="-50" y="-50" width="200" height="200" fill="#ffffff" />
                        {/* Operand in black: cuts out this region */}
                        {operandEl}
                    </mask>
                );

                // Return base element wrapped with the mask
                return (
                    <g key={bool.id} mask={`url(#${maskId})`}>
                        {baseEl}
                    </g>
                );
            }

            if (bool.op === 'intersect') {
                // Intersection: Clip the base to the operand path
                const clipId = `clip_${opKey}`;
                const operandEl = compileLayer(operand);

                defs.push(
                    <clipPath id={clipId} key={clipId}>
                        {operandEl}
                    </clipPath>
                );

                return (
                    <g key={bool.id} clipPath={`url(#${clipId})`}>
                        {baseEl}
                    </g>
                );
            }

            if (bool.op === 'union') {
                // Union: Simply render both base and operand together
                const operandEl = compileLayer(operand, colorMod);
                return (
                    <g key={bool.id}>
                        {baseEl}
                        {operandEl}
                    </g>
                );
            }
        }

        return null;
    };

    // Compile visible layers
    const visibleElements: React.ReactNode[] = [];
    icon.layers.forEach(layer => {
        if (!consumedLayerIds.has(layer.id)) {
            const el = compileLayer(layer);
            if (el) visibleElements.push(el);
        }
    });

    // Calculate dimensions based on scale
    const containerStyle: React.CSSProperties = {
        width: '100%',
        height: '100%',
        display: 'block',
        transform: scale !== 1 ? `scale(${scale})` : undefined,
        transformOrigin: 'center center',
        ...style
    };

    return (
        <svg
            viewBox="0 0 100 100"
            className={`expressive-vector-icon ${className}`}
            style={containerStyle}
        >
            {defs.length > 0 && <defs>{defs}</defs>}
            <g className="icon-canvas">{visibleElements}</g>
        </svg>
    );
};
