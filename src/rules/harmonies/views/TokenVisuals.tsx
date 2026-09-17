/**
 * TokenVisuals.tsx
 *
 * Unified token iconography and rendering components for Harmonies:
 * - Red Building: Peaked house silhouette with roof overhang and doorway (distinct from mountain).
 * - Gray Mountain: Sharp granite triangle peak.
 * - Blue Water: Flowing aquatic water wave.
 * - Green Foliage: Concentric leaf canopy circle.
 * - Brown Trunk: Wood cross-section growth ring and core.
 * - Yellow Field: 4 wheat / meadow grain seeds.
 */

import * as React from 'react';
import { Color } from '../HarmoniesAssets';

export const TOKEN_COLORS: Record<Color, string> = {
    blue: '#3498db',
    yellow: '#f1c40f',
    gray: '#78909c',
    brown: '#8d6e63',
    green: '#43a047',
    red: '#e53935'
};

// ============================================================================
// 1. Unified Token Glyph Renderer
// ============================================================================

export interface TokenGlyphProps {
    color: Color;
    r: number;
    isTop?: boolean;
    doorColor?: string;
}

export const TokenGlyph: React.FC<TokenGlyphProps> = ({
    color,
    r,
    isTop = true,
    doorColor
}) => {
    if (color === 'red') {
        if (!isTop) return null;
        // Building: House with pitched roof, eaves, walls, and doorway
        const peakY = -(r * 0.52).toFixed(1);
        const eaveY = -(r * 0.08).toFixed(1);
        const eaveX = (r * 0.48).toFixed(1);
        const wallX = (r * 0.38).toFixed(1);
        const wallY = (r * 0.42).toFixed(1);
        const doorW = (r * 0.24).toFixed(1);
        const doorH = (r * 0.27).toFixed(1);
        const doorX = -(r * 0.12).toFixed(1);
        const doorY = (r * 0.15).toFixed(1);

        return (
            <g opacity="0.95">
                <polygon
                    points={`0,${peakY} ${eaveX},${eaveY} ${wallX},${wallY} -${wallX},${wallY} -${eaveX},${eaveY}`}
                    fill="#ffffff"
                />
                <rect
                    x={doorX}
                    y={doorY}
                    width={doorW}
                    height={doorH}
                    rx={(r * 0.04).toFixed(1)}
                    fill={doorColor || TOKEN_COLORS.red}
                />
            </g>
        );
    }

    if (color === 'gray') {
        // Mountain: Sharp granite triangle peak
        const topY = -(r * 0.50).toFixed(1);
        const bottomY = (r * 0.38).toFixed(1);
        const sideX = (r * 0.44).toFixed(1);

        return (
            <polygon
                points={`0,${topY} ${sideX},${bottomY} -${sideX},${bottomY}`}
                fill="#ffffff"
                opacity="0.9"
            />
        );
    }

    if (color === 'blue') {
        // Water: Aquatic ripple / wave
        const halfW = (r * 0.46).toFixed(1);
        const qW = (r * 0.23).toFixed(1);
        const qH = -(r * 0.28).toFixed(1);
        const strokeW = Math.max(1.3, r * 0.12);

        return (
            <path
                d={`M -${halfW} 0 Q -${qW} ${qH} 0 0 T ${halfW} 0`}
                fill="none"
                stroke="#ffffff"
                strokeWidth={strokeW}
                strokeLinecap="round"
                opacity="0.9"
            />
        );
    }

    if (color === 'green') {
        // Tree foliage / canopy
        return (
            <g opacity="0.85">
                <circle r={(r * 0.42).toFixed(1)} fill="#a5d6a7" />
                <circle r={(r * 0.22).toFixed(1)} fill="#ffffff" opacity="0.4" />
            </g>
        );
    }

    if (color === 'brown') {
        // Wood log cross section: growth ring and tree heart
        const ringR = (r * 0.45).toFixed(1);
        const heartR = (r * 0.18).toFixed(1);
        const strokeW = Math.max(1.1, r * 0.1);

        return (
            <g opacity="0.8">
                <circle
                    r={ringR}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth={strokeW}
                />
                <circle r={heartR} fill="#ffffff" />
            </g>
        );
    }

    if (color === 'yellow') {
        // Field meadow: 4 grain seeds
        const offset = (r * 0.20).toFixed(1);
        const seedR = Math.max(1.1, r * 0.12);

        return (
            <g opacity="0.85" fill="#78350f">
                <circle cx={-offset} cy={-offset} r={seedR} />
                <circle cx={offset} cy={-offset} r={seedR} />
                <circle cx={-offset} cy={offset} r={seedR} />
                <circle cx={offset} cy={offset} r={seedR} />
            </g>
        );
    }

    return null;
};

// ============================================================================
// 2. Token Disc (SVG <g> representation for boards and SVG charts)
// ============================================================================

export interface TokenDiscProps {
    cx: number;
    cy: number;
    color: Color;
    r?: number;
    isTop?: boolean;
    shadow?: boolean;
    strokeWidth?: number;
    filter?: string;
}

export const TokenDisc: React.FC<TokenDiscProps> = ({
    cx,
    cy,
    color,
    r = 18,
    isTop = true,
    shadow = true,
    strokeWidth = 1.6,
    filter
}) => {
    const fill = TOKEN_COLORS[color];

    return (
        <g transform={`translate(${cx}, ${cy})`}>
            {/* Soft token drop shadow */}
            {shadow && (
                <ellipse cx="0" cy="2" rx={r} ry={r * 0.95} fill="#000000" opacity="0.22" />
            )}

            {/* Token base disc */}
            <circle
                r={r}
                fill={fill}
                stroke="#ffffff"
                strokeWidth={strokeWidth}
                filter={filter}
            />

            {/* Precise feature glyph */}
            <TokenGlyph color={color} r={r} isTop={isTop} />
        </g>
    );
};

// ============================================================================
// 3. Standalone Token SVG Component (for HTML buttons, market, shelves)
// ============================================================================

export interface TokenSvgProps {
    color: Color;
    size?: number;
    r?: number;
    isTop?: boolean;
    shadow?: boolean;
    className?: string;
}

export const TokenSvg: React.FC<TokenSvgProps> = ({
    color,
    size = 36,
    r,
    isTop = true,
    shadow = true,
    className
}) => {
    const computedR = r !== undefined ? r : (size / 2) - 2;

    return (
        <svg
            width={size}
            height={size}
            viewBox={`-${size / 2} -${size / 2} ${size} ${size}`}
            style={{ overflow: 'visible', display: 'block', flexShrink: 0 }}
            className={className}
        >
            <TokenDisc
                cx={0}
                cy={0}
                color={color}
                r={computedR}
                isTop={isTop}
                shadow={shadow}
            />
        </svg>
    );
};
