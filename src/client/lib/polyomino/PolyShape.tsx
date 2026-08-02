/**
 * PolyShape.tsx — renders a single polyomino as a flat, geometric glyph.
 *
 * Reusable across contexts: supply-tray pieces, reward chips on puzzle cards,
 * legends, rules screens. Purely presentational (no interaction). Cells are
 * drawn as soft rounded tiles separated by a hairline of negative space, so a
 * piece reads as one cohesive shape while its cell structure stays legible.
 */

import * as React from 'react';
import { Cell, normalize } from './geometry';
import { shade, tint } from './colors';

export interface PolyShapeProps {
    cells: Cell[];
    color: string;
    /** px size of one cell (tile pitch). Default 22. */
    unit?: number;
    /** gap between tiles as a fraction of `unit`. Default 0.06. */
    gap?: number;
    /** corner radius as a fraction of the tile size. Default 0.28. */
    radius?: number;
    /** faded outline-only rendering, for ghost previews. */
    ghost?: boolean;
    className?: string;
    style?: React.CSSProperties;
    title?: string;
}

/**
 * Draw the tiles of a normalised polyomino into an SVG group. Shared by the
 * standalone glyph, the board's placed pieces, and the interactive ghost.
 */
export function renderTiles(
    cells: Cell[],
    color: string,
    unit: number,
    gap: number,
    radius: number,
    opts: { ghost?: boolean; keyPrefix?: string } = {}
): React.ReactNode[] {
    const g = unit * gap;
    const size = unit - g * 2;
    const r = size * radius;
    const face = opts.ghost ? 'none' : color;
    const stroke = opts.ghost ? color : shade(color, 0.22);
    const strokeW = opts.ghost ? Math.max(1.5, unit * 0.09) : Math.max(0.75, unit * 0.03);
    const nodes: React.ReactNode[] = [];
    cells.forEach(([row, col], i) => {
        const x = col * unit + g;
        const y = row * unit + g;
        nodes.push(
            <rect
                key={`${opts.keyPrefix || 't'}-${i}`}
                x={x}
                y={y}
                width={size}
                height={size}
                rx={r}
                ry={r}
                fill={face}
                stroke={stroke}
                strokeWidth={strokeW}
                strokeLinejoin="round"
                opacity={opts.ghost ? 0.9 : 1}
            />
        );
        if (!opts.ghost) {
            // A soft inner highlight adds a light, modern lift without shadows.
            const inset = size * 0.18;
            nodes.push(
                <rect
                    key={`${opts.keyPrefix || 't'}-hl-${i}`}
                    x={x + inset}
                    y={y + inset}
                    width={size - inset * 2}
                    height={(size - inset * 2) * 0.55}
                    rx={r * 0.7}
                    ry={r * 0.7}
                    fill={tint(color, 0.35)}
                    opacity={0.5}
                />
            );
        }
    });
    return nodes;
}

export const PolyShape: React.FC<PolyShapeProps> = (props) => {
    const {
        color,
        unit = 22,
        gap = 0.06,
        radius = 0.28,
        ghost = false,
        className,
        style,
        title
    } = props;

    const cells = normalize(props.cells);
    let maxR = 0;
    let maxC = 0;
    for (const [r, c] of cells) {
        if (r > maxR) maxR = r;
        if (c > maxC) maxC = c;
    }
    const w = (maxC + 1) * unit;
    const h = (maxR + 1) * unit;

    return (
        <svg
            className={['poly-shape', className].filter(Boolean).join(' ')}
            width={w}
            height={h}
            viewBox={`0 0 ${w} ${h}`}
            style={style}
            role="img"
            aria-label={title}
        >
            {title ? <title>{title}</title> : null}
            {renderTiles(cells, color, unit, gap, radius, { ghost })}
        </svg>
    );
};

export default PolyShape;
