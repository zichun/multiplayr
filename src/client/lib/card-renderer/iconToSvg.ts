/**
 * iconToSvg.ts
 * React-free SVG string serializer for the card-renderer icon engine.
 *
 * `ExpressiveIcon` (IconEngine.tsx) renders an `IconObject` as React nodes. When
 * there is no React runtime — a plain jQuery page, a `String`-built template, a
 * quick data URI, an email — `iconToSvg()` compiles the same layer stack to a
 * static `<svg>…</svg>` string, reproducing the IconEngine primitive geometry
 * exactly (same 0-100 viewBox, same local ±25 shape units, same transform order).
 *
 * Scope: painter's-order primitive layers — the common case, and everything a
 * flat negative-space glyph needs. Boolean ops (`subtract`/`intersect`/`union`),
 * `ref` embeds, and repeating patterns (`stripes`/`dots`/`grid`) are NOT compiled
 * here (they require SVG <defs>/masks/clip-paths). For those, render the real
 * `ExpressiveIcon` through `react-dom/server`'s `renderToStaticMarkup` instead
 * (see inspect-cli.tsx `iconSvg`), which never drifts from the live component.
 */

import { IconObject, PrimitiveShape } from './types';

/**
 * Colour map for the serializer. Palette keys used in a shape's `fill`/`stroke`
 * (`primary`, `background`, `accent`, …) resolve against this; unknown keys fall
 * through as literal colours. A full `Palette` satisfies this shape, so you can
 * pass one directly: `iconToSvg(icon, PALETTES.midCentury)`.
 */
export interface IconColors {
    primary: string;
    background: string;
    [key: string]: string;
}

export interface IconToSvgOptions {
    /** Force every layer to one colour (e.g. a single-tone silhouette / watermark). */
    colorOverride?: string;
    /** Extra classes on the root <svg> (defaults to `expressive-vector-icon`). */
    className?: string;
    /** viewBox size; primitives are authored in a 0-100 space, so keep 100. */
    size?: number;
}

function resolveColor(colorStr: string, colors: IconColors, override?: string): string {
    if (override) return override;
    if (!colorStr) return 'transparent';
    if (colorStr === 'none') return 'none';
    const key = colorStr.toLowerCase();
    if (colors[key]) return colors[key];
    return colorStr; // literal hex / named colour
}

function bezierPath(shape: PrimitiveShape): string {
    if (shape.customPath) return shape.customPath;
    const pts = shape.bezierPoints;
    if (!pts || !pts.length) return '';
    let d = `M ${pts[0].x - 25} ${pts[0].y - 25}`;
    for (let i = 1; i < pts.length; i++) {
        const p = pts[i];
        if (p.cx1 !== undefined && p.cy1 !== undefined) {
            if (p.cx2 !== undefined && p.cy2 !== undefined) {
                d += ` C ${p.cx1 - 25} ${p.cy1 - 25}, ${p.cx2 - 25} ${p.cy2 - 25}, ${p.x - 25} ${p.y - 25}`;
            } else {
                d += ` S ${p.cx1 - 25} ${p.cy1 - 25}, ${p.x - 25} ${p.y - 25}`;
            }
        } else {
            d += ` L ${p.x - 25} ${p.y - 25}`;
        }
    }
    return d + ' Z';
}

function primitiveGeometry(shape: PrimitiveShape, colors: IconColors, override?: string): string {
    const fill = resolveColor(shape.fill, colors, override);
    const stroke = shape.stroke ? resolveColor(shape.stroke, colors, override) : 'none';
    const sw = shape.strokeWidth ?? 0;
    const opacity = shape.opacity ?? 1;
    const common = `fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${opacity}"`;

    switch (shape.type) {
        case 'circle':
            return `<circle cx="0" cy="0" r="25" ${common}/>`;
        case 'rectangle':
            return `<rect x="-25" y="-25" width="50" height="50" ${common}/>`;
        case 'triangle':
            return `<polygon points="0,-25 25,22 -25,22" ${common}/>`;
        case 'semi-circle':
            return `<path d="M -25,0 A 25,25 0 0,1 25,0 Z" ${common}/>`;
        case 'quarter-circle':
            return `<path d="M 0,0 L 25,0 A 25,25 0 0,1 0,25 Z" ${common}/>`;
        case 'arch':
            return `<path d="M -25,25 L -25,0 A 25,25 0 0,1 25,0 L 25,25 Z" ${common}/>`;
        case 'zig-zag': {
            // Stroked line — matches IconEngine's fixed zig-zag path.
            const line = fill !== 'transparent' && fill !== 'none' ? fill : stroke;
            const w = sw > 0 ? sw : 4;
            return `<path d="M -25,-10 L -12.5,10 L 0,-10 L 12.5,10 L 25,-10" fill="none" ` +
                `stroke="${line}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"/>`;
        }
        case 'bezier': {
            const d = bezierPath(shape);
            return d ? `<path d="${d}" ${common}/>` : '';
        }
        default:
            // stripes / dots / grid need <defs><pattern> — use ExpressiveIcon for those.
            return '';
    }
}

/**
 * Serialize an `IconObject` to a static SVG string.
 *
 * @param icon    the icon definition (its `layers` are drawn in array order)
 * @param colors  palette-key → colour map (a `Palette` works directly)
 * @param opts    optional `colorOverride`, `className`, `size`
 */
export function iconToSvg(icon: IconObject, colors: IconColors, opts: IconToSvgOptions = {}): string {
    if (!icon || !icon.layers) return '';
    const { colorOverride, className = 'expressive-vector-icon', size = 100 } = opts;

    const body = icon.layers
        .map((layer) => {
            if (layer.type === 'boolean' || layer.type === 'ref') return '';
            const shape = layer as PrimitiveShape;
            const geom = primitiveGeometry(shape, colors, colorOverride);
            if (!geom) return '';
            const t = `translate(${shape.x}, ${shape.y}) scale(${shape.scaleX ?? 1}, ${shape.scaleY ?? 1}) rotate(${shape.rotation ?? 0})`;
            return `<g transform="${t}">${geom}</g>`;
        })
        .join('');

    return `<svg viewBox="0 0 ${size} ${size}" width="100%" height="100%" ` +
        `preserveAspectRatio="xMidYMid meet" class="${className}">${body}</svg>`;
}
