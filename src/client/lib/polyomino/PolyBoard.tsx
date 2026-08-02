/**
 * PolyBoard.tsx — renders a polyomino puzzle board as flat SVG.
 *
 * Layers, bottom to top:
 *   1. wells   — the recessed (fillable) cells, drawn as soft light insets
 *   2. pieces  — committed placements, each a cohesive coloured polyomino
 *   3. ghost   — a live placement preview, tinted valid/invalid
 *
 * The component is presentational but forwards pointer events and an svg ref so
 * an interactive layer (PolyPlacer) can drive drag-to-place on top of it.
 */

import * as React from 'react';
import { Cell, maskToCells } from './geometry';
import { renderTiles } from './PolyShape';
import { alpha, shade } from './colors';

export interface BoardPlacement {
    mask: number;
    color: string;
    pending?: boolean; // staged (e.g. Master mode) — drawn slightly translucent
}

export interface PolyBoardProps {
    width: number;
    height: number;
    recessed: number;
    unit?: number;
    gap?: number;
    radius?: number;
    placements?: BoardPlacement[];
    /** live ghost preview (absolute cells) */
    ghostCells?: Cell[] | null;
    ghostColor?: string;
    ghostValid?: boolean;
    /** draw the small centre dot on empty wells (matches Project L's look) */
    showWellDots?: boolean;
    /** cells to softly highlight (e.g. legal drop target under the ghost) */
    highlightCells?: Cell[] | null;
    svgRef?: (el: SVGSVGElement | null) => void;
    onPointerDown?: (e: React.PointerEvent) => void;
    onPointerMove?: (e: React.PointerEvent) => void;
    onPointerUp?: (e: React.PointerEvent) => void;
    onPointerLeave?: (e: React.PointerEvent) => void;
    className?: string;
    style?: React.CSSProperties;
}

const OK = '#3fae7c';   // soft emerald — valid
const NO = '#e0715f';   // soft coral   — invalid

export const PolyBoard: React.FC<PolyBoardProps> = (props) => {
    const {
        width,
        height,
        recessed,
        unit = 46,
        gap = 0.06,
        radius = 0.26,
        placements = [],
        ghostCells,
        ghostColor = '#8aa0b6',
        ghostValid = true,
        showWellDots = true,
        highlightCells,
        svgRef,
        className,
        style
    } = props;

    const w = width * unit;
    const h = height * unit;
    const wells = maskToCells(recessed, width, height);
    const g = unit * gap;
    const size = unit - g * 2;
    const r = size * radius;

    const highlightSet = new Set(
        (highlightCells || []).map(([rr, cc]) => rr * width + cc)
    );

    return (
        <svg
            ref={svgRef}
            className={['poly-board', className].filter(Boolean).join(' ')}
            width={w}
            height={h}
            viewBox={`0 0 ${w} ${h}`}
            style={{ touchAction: 'none', ...style }}
            onPointerDown={props.onPointerDown}
            onPointerMove={props.onPointerMove}
            onPointerUp={props.onPointerUp}
            onPointerLeave={props.onPointerLeave}
        >
            {/* 1. wells */}
            {wells.map(([row, col], i) => {
                const x = col * unit + g;
                const y = row * unit + g;
                const hit = highlightSet.has(row * width + col);
                return (
                    <g key={`well-${i}`}>
                        <rect
                            x={x}
                            y={y}
                            width={size}
                            height={size}
                            rx={r}
                            ry={r}
                            className="poly-well"
                            fill={hit ? alpha(OK, 0.18) : undefined}
                        />
                        {showWellDots && (
                            <circle
                                cx={x + size / 2}
                                cy={y + size / 2}
                                r={Math.max(1.4, unit * 0.045)}
                                className="poly-well-dot"
                            />
                        )}
                    </g>
                );
            })}

            {/* 2. committed pieces */}
            {placements.map((p, i) => (
                <g key={`pc-${i}`} opacity={p.pending ? 0.82 : 1}>
                    {renderTiles(
                        maskToCells(p.mask, width, height),
                        p.color,
                        unit,
                        gap,
                        radius,
                        { keyPrefix: `pc${i}` }
                    )}
                </g>
            ))}

            {/* 3. live ghost */}
            {ghostCells && ghostCells.length > 0 && (
                <g className="poly-ghost">
                    {ghostCells.map(([row, col], i) => {
                        const x = col * unit + g;
                        const y = row * unit + g;
                        const c = ghostValid ? OK : NO;
                        return (
                            <rect
                                key={`gh-${i}`}
                                x={x}
                                y={y}
                                width={size}
                                height={size}
                                rx={r}
                                ry={r}
                                fill={alpha(c, 0.5)}
                                stroke={shade(c, 0.1)}
                                strokeWidth={Math.max(1.5, unit * 0.05)}
                                strokeLinejoin="round"
                            />
                        );
                    })}
                </g>
            )}
        </svg>
    );
};

export default PolyBoard;
