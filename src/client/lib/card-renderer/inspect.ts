/**
 * inspect.ts
 * Headless, dependency-free inspection helpers for the card-renderer.
 *
 * Motivation: card faces and vector icons are authored as numbers (0-100 viewBox
 * geometry, em-based text) and cannot be trusted from source alone. Historically
 * the only way to "see" them was to spin up webpack + a browser and screenshot.
 * These helpers let an agent (or a human) inspect a design from the terminal in a
 * few tokens: a monochrome ASCII raster of an icon, and a static lint of a card
 * definition that flags the exact legibility/layout traps documented in
 * docs/DESIGN_GUIDE.md §10.
 *
 * This module is pure TypeScript (no React, no DOM, no styles) so it runs under
 * ts-node/ts-mocha and can be imported from tests. Faithful SVG/HTML rendering
 * (which reuses the real React components) lives in inspect-cli.tsx.
 */

import {
    Palette, IconObject, IconLayer, PrimitiveShape, BooleanOperation, IconRef,
    CardDefinition
} from './types';

// ---------------------------------------------------------------------------
// Colour resolution (kept in sync with IconEngine.resolveColor, no React dep)
// ---------------------------------------------------------------------------

const PALETTE_KEYS: (keyof Palette)[] = [
    'background', 'border', 'primary', 'secondary', 'accent', 'charcoal', 'text',
    'panelBg', 'tertiary', 'success', 'danger'
];

export function resolveColor(colorStr: string | undefined, palette: Palette, override?: string): string {
    if (override) return override;
    if (!colorStr) return 'transparent';
    const key = colorStr.toLowerCase() as keyof Palette;
    if (palette && (palette as any)[key]) return (palette as any)[key] as string;
    return colorStr;
}

/** Rough perceptual luminance (0 dark .. 1 light) of a hex/rgb colour. */
function luminance(color: string): number {
    const c = parseColor(color);
    if (!c) return 0.5;
    return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
}

function parseColor(color: string): { r: number; g: number; b: number } | null {
    if (!color) return null;
    let s = color.trim().toLowerCase();
    const rgb = s.match(/rgba?\(([^)]+)\)/);
    if (rgb) {
        const parts = rgb[1].split(',').map(p => parseFloat(p));
        return { r: parts[0] || 0, g: parts[1] || 0, b: parts[2] || 0 };
    }
    if (s[0] === '#') s = s.slice(1);
    if (s.length === 3) s = s.split('').map(ch => ch + ch).join('');
    if (s.length >= 6) {
        return {
            r: parseInt(s.slice(0, 2), 16),
            g: parseInt(s.slice(2, 4), 16),
            b: parseInt(s.slice(4, 6), 16)
        };
    }
    return null;
}

// ---------------------------------------------------------------------------
// Icon ASCII rasteriser
// ---------------------------------------------------------------------------

interface Vec { x: number; y: number; }

/** Invert a shape's `translate(x,y) scale(sx,sy) rotate(rot)` transform. */
function toLocal(p: Vec, x: number, y: number, sx: number, sy: number, rotDeg: number): Vec {
    let qx = p.x - x;
    let qy = p.y - y;
    qx /= (sx || 1e-6);
    qy /= (sy || 1e-6);
    if (rotDeg) {
        const t = (-rotDeg * Math.PI) / 180;
        const c = Math.cos(t), s = Math.sin(t);
        return { x: qx * c - qy * s, y: qx * s + qy * c };
    }
    return { x: qx, y: qy };
}

function pointInPolygon(px: number, py: number, poly: Vec[]): boolean {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
        const intersect = ((yi > py) !== (yj > py)) &&
            (px < ((xj - xi) * (py - yi)) / ((yj - yi) || 1e-9) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

/** Parse an SVG path "d" string into its anchor points (curves flattened to endpoints). */
function pathAnchors(d: string): Vec[] {
    const pts: Vec[] = [];
    const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+/g);
    if (!tokens) return pts;
    let i = 0;
    let cmd = '';
    while (i < tokens.length) {
        if (/[a-zA-Z]/.test(tokens[i])) { cmd = tokens[i]; i++; }
        const c = cmd.toUpperCase();
        const take = (n: number) => tokens.slice(i, i + n).map(Number);
        if (c === 'M' || c === 'L' || c === 'T') { const [x, y] = take(2); pts.push({ x, y }); i += 2; }
        else if (c === 'H') { const [x] = take(1); pts.push({ x, y: pts.length ? pts[pts.length - 1].y : 0 }); i += 1; }
        else if (c === 'V') { const [y] = take(1); pts.push({ x: pts.length ? pts[pts.length - 1].x : 0, y }); i += 1; }
        else if (c === 'C') { const v = take(6); pts.push({ x: v[4], y: v[5] }); i += 6; }
        else if (c === 'S' || c === 'Q') { const v = take(4); pts.push({ x: v[2], y: v[3] }); i += 4; }
        else if (c === 'A') { const v = take(7); pts.push({ x: v[5], y: v[6] }); i += 7; }
        else if (c === 'Z') { /* close */ }
        else { i++; }
    }
    return pts;
}

/** Does a primitive shape cover world point p (in 0-100 space)? */
function primitiveCovers(shape: PrimitiveShape, p: Vec): boolean {
    // Bezier custom paths are authored directly in 0-100 space at x:0,y:0,scale:1.
    if (shape.type === 'bezier') {
        const poly = shape.customPath
            ? pathAnchors(shape.customPath)
            : (shape.bezierPoints || []).map(bp => ({ x: bp.x, y: bp.y }));
        if (poly.length < 3) return false;
        const L = toLocal(p, shape.x, shape.y, shape.scaleX ?? 1, shape.scaleY ?? 1, shape.rotation ?? 0);
        return pointInPolygon(L.x, L.y, poly);
    }
    const L = toLocal(p, shape.x, shape.y, shape.scaleX ?? 1, shape.scaleY ?? 1, shape.rotation ?? 0);
    const r2 = L.x * L.x + L.y * L.y;
    switch (shape.type) {
        case 'circle': return r2 <= 625;
        case 'rectangle': return Math.abs(L.x) <= 25 && Math.abs(L.y) <= 25;
        case 'triangle': return pointInPolygon(L.x, L.y, [{ x: 0, y: -25 }, { x: 25, y: 22 }, { x: -25, y: 22 }]);
        case 'semi-circle': return L.y <= 0 && r2 <= 625;
        case 'quarter-circle': return L.x >= 0 && L.y >= 0 && r2 <= 625;
        case 'arch':
            return (Math.abs(L.x) <= 25 && L.y >= 0 && L.y <= 25) || (L.y < 0 && r2 <= 625);
        // Repeating fills / lines: approximate by their 50x50 bounding box.
        case 'stripes': case 'dots': case 'grid': case 'zig-zag':
            return Math.abs(L.x) <= 25 && Math.abs(L.y) <= 25;
        default: return false;
    }
}

interface Sample { color: string; opacity: number; }

/** Topmost layer colour covering world point p, honouring boolean subtract and refs. */
function sampleLayers(
    layers: IconLayer[], p: Vec, palette: Palette, savedIcons: Record<string, IconObject>,
    override?: string
): Sample | null {
    const byId = new Map<string, IconLayer>();
    layers.forEach(l => byId.set(l.id, l));
    const consumed = new Set<string>();
    layers.forEach(l => { if (l.type === 'boolean') consumed.add((l as BooleanOperation).operandId); });

    let top: Sample | null = null;
    for (const layer of layers) {
        if (consumed.has(layer.id)) continue;
        const s = coverColor(layer, p, palette, savedIcons, byId, override);
        if (s) top = s; // later layers paint over earlier ones
    }
    return top;
}

function coverColor(
    layer: IconLayer, p: Vec, palette: Palette, savedIcons: Record<string, IconObject>,
    byId: Map<string, IconLayer>, override?: string
): Sample | null {
    if (layer.type === 'ref') {
        const ref = layer as IconRef;
        const target = savedIcons[ref.iconId];
        if (!target) return null;
        // Undo the ref transform, then the nested icon draws in 0-100 space.
        const L = toLocal(p, ref.x, ref.y, ref.scale, ref.scale, ref.rotation ?? 0);
        const childOverride = ref.colorOverride ? resolveColor(ref.colorOverride, palette, override) : override;
        const s = sampleLayers(target.layers, L, palette, savedIcons, childOverride);
        if (s) return { color: s.color, opacity: s.opacity * (ref.opacity ?? 1) };
        return null;
    }
    if (layer.type === 'boolean') {
        const bool = layer as BooleanOperation;
        const base = byId.get(bool.baseId);
        const operand = byId.get(bool.operandId);
        if (!base) return null;
        const baseS = coverColor(base, p, palette, savedIcons, byId, override);
        if (!operand) return baseS;
        const opCovers = coverColor(operand, p, palette, savedIcons, byId, override) != null;
        if (bool.op === 'subtract') return baseS && !opCovers ? baseS : null;
        if (bool.op === 'intersect') return baseS && opCovers ? baseS : null;
        if (bool.op === 'union') return baseS || coverColor(operand, p, palette, savedIcons, byId, override);
        return baseS;
    }
    const shape = layer as PrimitiveShape;
    if (!primitiveCovers(shape, p)) return null;
    const color = resolveColor(shape.fill, palette, override);
    if (color === 'transparent' || color === 'none') return null;
    return { color, opacity: shape.opacity ?? 1 };
}

export interface AsciiOptions {
    size?: number;       // grid resolution (cells per side), default 24
    savedIcons?: Record<string, IconObject>;
    override?: string;
}

const RAMP = ['█', '▓', '▒', '░'];

/**
 * Rasterise an icon to a monochrome ASCII grid. Each distinct resolved colour
 * gets one glyph (legend below). Cells are printed two chars wide to correct the
 * ~2:1 aspect of monospace terminal glyphs so shapes read true.
 */
export function iconToAscii(icon: IconObject, palette: Palette, opts: AsciiOptions = {}): string {
    if (!icon || !icon.layers) return '(empty icon)';
    const n = Math.max(8, Math.min(64, opts.size ?? 24));
    const savedIcons = opts.savedIcons ?? {};

    const colorChar = new Map<string, string>();
    const colorFaint = new Map<string, boolean>();
    const order: string[] = [];
    const rows: string[] = [];

    for (let gy = 0; gy < n; gy++) {
        let line = '';
        for (let gx = 0; gx < n; gx++) {
            // Sample the centre of each cell in 0-100 space.
            const p = { x: ((gx + 0.5) / n) * 100, y: ((gy + 0.5) / n) * 100 };
            const s = sampleLayers(icon.layers, p, palette, savedIcons, opts.override);
            if (!s) { line += '  '; continue; }
            if (!colorChar.has(s.color)) {
                const i = order.length;
                colorChar.set(s.color, i < RAMP.length ? RAMP[i] : String.fromCharCode(97 + i - RAMP.length));
                colorFaint.set(s.color, s.opacity < 0.4);
                order.push(s.color);
            } else if (s.opacity >= 0.4) {
                colorFaint.set(s.color, false);
            }
            const ch = colorChar.get(s.color)!;
            line += ch + ch;
        }
        rows.push(line);
    }

    const frameW = n * 2;
    const top = '┌' + '─'.repeat(frameW) + '┐';
    const bot = '└' + '─'.repeat(frameW) + '┘';
    const body = rows.map(r => '│' + r + '│').join('\n');

    const legend = order.map(color => {
        const keys = PALETTE_KEYS.filter(k => ((palette as any)[k] || '').toLowerCase() === color.toLowerCase());
        const label = keys.length ? ` ${keys.join('/')}` : '';
        const faint = colorFaint.get(color) ? '  (faint — may be near-invisible)' : '';
        return `  ${colorChar.get(color)} = ${color}${label}${faint}`;
    }).join('\n');

    return `${icon.name || icon.id} [${n}x${n}]\n${top}\n${body}\n${bot}\n${legend || '  (no visible layers)'}`;
}

// ---------------------------------------------------------------------------
// Card definition linter
// ---------------------------------------------------------------------------

export interface LintWarning {
    level: 'error' | 'warn' | 'info';
    where: string;
    message: string;
}

export interface LintOptions {
    /** Intended on-screen width in px (docs default 80). Drives legibility maths. */
    widthPx?: number;
    customIcons?: Record<string, IconObject>;
    palettes?: Record<string, Palette>;
}

// Effective em multiplier of each text element = product of the CSS `em` chain.
// Grounded in PlayingCard.css / PlayingCard.tsx (1em = width_px * 0.052).
const EM = {
    headerTitle: 1.6,
    headerSubtitle: 0.8,
    headerStats: 1.3,
    dataText: 1.0,
    dataIcon: 1.1,
    footerRegion: 0.9
};
const PX_PER_EM_FACTOR = 0.052; // 1em ≈ width_px * 0.052

/**
 * Statically lint a card definition for the traps in DESIGN_GUIDE §10:
 * illegible (em-compounded) text, dangling icon references, unknown palette keys,
 * and unusually small render widths. No rendering required.
 */
export function lintCardDefinition(card: CardDefinition, opts: LintOptions = {}): LintWarning[] {
    const out: LintWarning[] = [];
    const widthPx = opts.widthPx ?? 80;
    const pxPerEm = widthPx * PX_PER_EM_FACTOR;
    const customIcons = opts.customIcons ?? {};

    // 1. Palette resolves?
    let palette: Palette | null = null;
    if (typeof card.palette === 'string') {
        palette = opts.palettes?.[card.palette] ?? null;
        if (opts.palettes && !palette) {
            out.push({ level: 'error', where: 'palette', message: `Unknown palette id '${card.palette}'.` });
        }
    } else if (card.palette && typeof card.palette === 'object') {
        palette = card.palette as Palette;
    }

    // 2. Icon references exist? (only checkable when customIcons provided)
    const knownIcon = (id?: string) => !id || id in customIcons;
    const refWarn = (id: string | undefined, where: string) => {
        if (id && opts.customIcons && !knownIcon(id)) {
            out.push({ level: 'warn', where, message: `Icon '${id}' not found in customIcons (may be a PRESET_ICONS id).` });
        }
    };
    card.header?.icons?.forEach((ic, i) => refWarn(ic.iconId, `header.icons[${i}]`));
    refWarn(card.mainArt?.iconId, 'mainArt.iconId');
    card.data?.rows?.forEach((row, i) => {
        refWarn(row.iconId, `data.rows[${i}].iconId`);
        row.iconsList?.forEach((ic, j) => refWarn(ic.iconId, `data.rows[${i}].iconsList[${j}]`));
    });
    refWarn(card.overlay?.iconId, 'overlay.iconId');
    card.overlays?.forEach((ov, i) => refWarn(ov.iconId, `overlays[${i}].iconId`));
    card.scoreStrip?.cells?.forEach((cell, i) => refWarn(cell.iconId, `scoreStrip.cells[${i}].iconId`));
    refWarn(card.backIconId, 'backIconId');

    // 3. Legibility of text (the em-compounding trap, §10.5).
    // Judge by absolute rendered px, not em: the documented red line is "never ship
    // 4px labels". ILLEGIBLE_PX warns; SMALL_PX items fold into one advisory line so
    // the report stays skimmable instead of flagging every string on a dense card.
    const ILLEGIBLE_PX = 4.0; // the documented "never ship 4px labels" red line
    const SMALL_PX = 6.0;     // dense but acceptable if the text is short
    out.push({ level: 'info', where: 'scale', message: `base 1em ≈ ${pxPerEm.toFixed(1)}px @ ${widthPx}px.` });

    const small: string[] = [];
    const checkText = (text: string | undefined, em: number, where: string) => {
        if (!text) return;
        const effPx = em * pxPerEm;
        if (effPx < ILLEGIBLE_PX) {
            out.push({
                level: 'warn', where,
                message: `"${trunc(text)}" ≈ ${effPx.toFixed(1)}px (${em.toFixed(2)}em) — below the ~${ILLEGIBLE_PX.toFixed(1)}px floor. ` +
                    `Enlarge the card, boost the region size, or shorten the text (§10.5).`
            });
        } else if (effPx < SMALL_PX) {
            small.push(`${where} ≈ ${effPx.toFixed(1)}px`);
        }
    };

    checkText(card.header?.title, EM.headerTitle, 'header.title');
    checkText(card.header?.subtitle, EM.headerSubtitle, 'header.subtitle');
    checkText(card.header?.stats, EM.headerStats, 'header.stats');
    card.data?.rows?.forEach((row, i) => {
        checkText(row.label, EM.dataText, `data.rows[${i}].label`);
        checkText(row.value, EM.dataText, `data.rows[${i}].value`);
    });
    if (card.footer?.text) {
        checkText(card.footer.text, EM.footerRegion * (card.footer.size ?? 1), 'footer.text');
        if (card.footer.text.length > 40) {
            out.push({
                level: 'info', where: 'footer.text',
                message: `Footer is ${card.footer.text.length} chars — long strings compound the small footer em; keep labels short (§10.5).`
            });
        }
    }
    if (small.length) {
        out.push({ level: 'info', where: 'legibility', message: `small but ok (4.2–6px), verify at true size: ${small.join(', ')}.` });
    }

    // 4. Render size sanity.
    if (widthPx < 60) {
        out.push({ level: 'info', where: 'width', message: `Rendering at ${widthPx}px is very small; verify text at true size (§10.11).` });
    }

    return out;
}

function trunc(s: string, n = 32): string {
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

export function formatWarnings(warnings: LintWarning[]): string {
    if (!warnings.length) return '  ✓ no issues found';
    const sym = { error: '✗', warn: '!', info: 'i' };
    return warnings.map(w => `  ${sym[w.level]} [${w.where}] ${w.message}`).join('\n');
}
