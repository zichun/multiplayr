/**
 * CKAssets.ts — flat-vector iconography, palettes and card builders for
 * Critter Kitchen.
 *
 * Design language: bright, soft, light-hearted flat illustration.
 *  - Ingredients are solid coloured coins with a white glyph knocked out
 *    (negative space): the same coin is used on cards, tokens, plates and
 *    in-line in card text, so every surface speaks one vocabulary.
 *  - Spices are rounded diamonds in their ingredient's colour carrying a
 *    white chili; allspice is a gold diamond with a starburst.
 *  - Rumors are ink speech bubbles (? … ! and a wild ✱).
 *  - Critters are geometric portraits built from one parametric face kit
 *    (head + ears + muzzle + eyes + markings), so ~45 animals share a style.
 *
 * Everything is authored in the card-renderer 0–100 `IconObject` DSL using
 * painter's-order layering only (no boolean masks).
 */

import { CardDefinition, Palette, IconObject, IconLayer, PrimitiveShape } from '../../client/lib/card-renderer/types';
import {
    IngType, ING_TYPES, LocId, CriticDef, RumorDef, RestDef, ZousDef, ChallengeDef, ZOUS_TIMING_LABEL,
    ChefKind, RumorKind
} from './CKData';

// ---------------------------------------------------------------------------
// shorthand
// ---------------------------------------------------------------------------

type Extra = Partial<Pick<PrimitiveShape, 'stroke' | 'strokeWidth' | 'opacity' | 'customPath'>>;
let uid = 0;
/**
 * The icon engine applies `rotate` inside the scaled frame, so a rotated
 * primitive with unequal scaleX/scaleY would shear. Those are emitted as exact
 * rotated paths instead, keeping every glyph crisp.
 */
function rotPath(type: PrimitiveShape['type'], x: number, y: number, sx: number, sy: number, rot: number): string | null {
    const a = rot * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    const tf = (px: number, py: number) => {
        const X = px * sx, Y = py * sy;
        return `${(x + X * c - Y * s).toFixed(2)} ${(y + X * s + Y * c).toFixed(2)}`;
    };
    if (type === 'rectangle') return `M ${tf(-25, -25)} L ${tf(25, -25)} L ${tf(25, 25)} L ${tf(-25, 25)} Z`;
    if (type === 'triangle') return `M ${tf(0, -25)} L ${tf(25, 22)} L ${tf(-25, 22)} Z`;
    if (type === 'circle') {
        const k = 0.5523 * 25;
        return `M ${tf(25, 0)} C ${tf(25, k)} ${tf(k, 25)} ${tf(0, 25)} C ${tf(-k, 25)} ${tf(-25, k)} ${tf(-25, 0)} ` +
            `C ${tf(-25, -k)} ${tf(-k, -25)} ${tf(0, -25)} C ${tf(k, -25)} ${tf(25, -k)} ${tf(25, 0)} Z`;
    }
    return null;
}
const L = (
    type: PrimitiveShape['type'], x: number, y: number, sx: number, sy: number,
    fill: string, rot = 0, extra: Extra = {}
): IconLayer => {
    if (rot % 360 !== 0 && sx !== sy) {
        const d = rotPath(type, x, y, sx, sy, rot);
        if (d) return { id: `l${uid++}`, type: 'bezier', x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, fill, customPath: d, ...extra };
    }
    return { id: `l${uid++}`, type, x, y, scaleX: sx, scaleY: sy, rotation: rot, fill, ...extra };
};
const P = (path: string, fill: string, extra: Extra = {}): IconLayer =>
    ({ id: `p${uid++}`, type: 'bezier', x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, fill, customPath: path, ...extra });
const SP = (path: string, stroke: string, w: number): IconLayer =>
    ({ id: `s${uid++}`, type: 'bezier', x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, fill: 'none', stroke, strokeWidth: w, customPath: path });
const icon = (id: string, layers: IconLayer[]): IconObject => ({ id, name: id, layers });
const disc = (color: string, s = 1.9): IconLayer => L('circle', 50, 50, s, s, color);

const W = '#ffffff';
export const INK = '#33313b';

// ===========================================================================
// colours
// ===========================================================================

export const ING_COLORS: Record<IngType, string> = {
    bread: '#e39a3b',
    carrot: '#f2733a',
    cheese: '#f0bd2e',
    fish: '#3e9ad6',
    meat: '#e2506a',
    mushroom: '#9a72cf',
    wine: '#3fae84'
};
/** Pale tints for plate / course backgrounds. */
export const ING_TINTS: Record<IngType, string> = {
    bread: '#fcefd9', carrot: '#fde6da', cheese: '#fdf4d4', fish: '#dfeffa',
    meat: '#fbe0e5', mushroom: '#ece4f8', wine: '#dcf3ea'
};

export const LOC_COLORS: Record<LocId, string> = {
    soup: '#ee6a4b', garden: '#ec74a6', desert: '#f2a24f', water: '#2aa39c',
    air: '#58ade3', lantern: '#4b5bb0', midnight: '#6a4c9c', academy: '#45bf9b'
};

export const TYPE_COLORS = {
    critic: '#df5583',
    rumor: '#46508f',
    fanatic: '#e8604c',
    rest: '#2f9aa6',
    zous: '#4bb780',
    challenge: '#f0853f',
    star: '#f5b82e',
    soup: '#efb46e',
    bisque: '#e2683a',
    allspice: '#f2b134'
};

// ===========================================================================
// ingredient glyphs (white, inside a 0–100 coin)
// ===========================================================================

function ingGlyph(t: IngType, g: string, bg: string): IconLayer[] {
    switch (t) {
        case 'bread': return [
            P('M 22 66 C 20 40 34 30 50 30 C 66 30 80 40 78 66 Q 78 72 72 72 L 28 72 Q 22 72 22 66 Z', g),
            L('rectangle', 38, 50, 0.07, 0.34, bg, 28),
            L('rectangle', 50, 50, 0.07, 0.34, bg, 28),
            L('rectangle', 62, 50, 0.07, 0.34, bg, 28)
        ];
        case 'carrot': return [
            P('M 36 40 Q 50 34 64 40 L 53 84 Q 50 88 47 84 Z', g),
            L('circle', 42, 28, 0.2, 0.42, g, -30),
            L('circle', 50, 24, 0.2, 0.46, g, 0),
            L('circle', 58, 28, 0.2, 0.42, g, 30),
            L('rectangle', 47, 52, 0.18, 0.05, bg, 8),
            L('rectangle', 53, 64, 0.16, 0.05, bg, -8)
        ];
        case 'cheese': return [
            P('M 20 70 L 80 70 L 80 46 L 30 30 Q 20 34 20 44 Z', g),
            L('circle', 36, 54, 0.22, 0.22, bg),
            L('circle', 60, 58, 0.16, 0.16, bg),
            L('circle', 66, 44, 0.12, 0.12, bg),
            L('circle', 46, 40, 0.1, 0.1, bg)
        ];
        case 'fish': return [
            L('circle', 44, 50, 1.12, 0.7, g),
            P('M 62 50 L 84 34 Q 80 50 84 66 Z', g),
            L('circle', 32, 46, 0.12, 0.12, bg),
            L('rectangle', 50, 50, 0.05, 0.44, bg, 0)
        ];
        case 'meat': return [
            L('rectangle', 62, 62, 0.22, 0.7, g, -45),
            L('circle', 80, 72, 0.17, 0.17, g),
            L('circle', 72, 80, 0.17, 0.17, g),
            L('circle', 42, 42, 0.96, 0.88, g, -20),
            L('circle', 38, 38, 0.36, 0.3, bg, -20)
        ];
        case 'mushroom': return [
            L('rectangle', 50, 64, 0.38, 0.5, g),
            L('circle', 50, 76, 0.38, 0.14, g),
            P('M 18 52 C 18 22 82 22 82 52 Q 82 56 78 56 L 22 56 Q 18 56 18 52 Z', g),
            L('circle', 36, 40, 0.16, 0.16, bg),
            L('circle', 58, 34, 0.12, 0.12, bg),
            L('circle', 64, 46, 0.1, 0.1, bg)
        ];
        case 'wine': return [
            P('M 32 22 L 68 22 C 70 46 62 56 50 56 C 38 56 30 46 32 22 Z', g),
            P('M 34 34 L 66 34 C 66 46 60 52 50 52 C 40 52 34 46 34 34 Z', bg, { opacity: 0.35 }),
            L('rectangle', 50, 66, 0.08, 0.42, g),
            L('rectangle', 50, 78, 0.48, 0.07, g)
        ];
    }
}

// ===========================================================================
// misc glyphs
// ===========================================================================

const chiliGlyph = (g: string, bg: string): IconLayer[] => [
    P('M 34 38 C 40 64 56 76 74 72 C 64 66 54 54 50 36 Z', g),
    P('M 32 30 Q 42 26 52 32 L 50 40 Q 42 36 34 40 Z', g),
    L('rectangle', 42, 24, 0.06, 0.18, g, 25),
    L('circle', 46, 48, 0.07, 0.07, bg, 0, { opacity: 0.4 })
];

const burstGlyph = (g: string): IconLayer[] => [
    P('M 50 18 L 57 40 L 80 34 L 64 51 L 80 68 L 57 61 L 50 84 L 43 61 L 20 68 L 36 51 L 20 34 L 43 40 Z', g)
];

const starPath = 'M 50 12 L 61 37 L 88 40 L 67 58 L 74 85 L 50 71 L 26 85 L 33 58 L 12 40 L 39 37 Z';

const bowlGlyph = (g: string, bg: string): IconLayer[] => [
    SP('M 40 34 C 36 28 44 24 40 18', g, 4.5),
    SP('M 52 34 C 48 28 56 24 52 18', g, 4.5),
    SP('M 64 34 C 60 28 68 24 64 18', g, 4.5),
    P('M 18 44 L 82 44 C 82 64 68 76 50 76 C 32 76 18 64 18 44 Z', g),
    L('rectangle', 50, 47, 1.28, 0.1, bg, 0, { opacity: 0.35 }),
    L('rectangle', 50, 80, 0.5, 0.08, g)
];

const hatGlyph = (g: string, bg: string): IconLayer[] => [
    L('circle', 34, 40, 0.5, 0.5, g),
    L('circle', 50, 32, 0.6, 0.6, g),
    L('circle', 66, 40, 0.5, 0.5, g),
    L('rectangle', 50, 56, 0.64, 0.42, g),
    L('rectangle', 50, 70, 0.7, 0.16, g),
    L('rectangle', 50, 64, 0.64, 0.04, bg, 0, { opacity: 0.45 })
];

const snowGlyph = (g: string): IconLayer[] => [
    L('rectangle', 50, 50, 0.08, 1.2, g, 0),
    L('rectangle', 50, 50, 0.08, 1.2, g, 60),
    L('rectangle', 50, 50, 0.08, 1.2, g, -60),
    L('circle', 50, 50, 0.22, 0.22, g)
];

const bagGlyph = (g: string, bg: string): IconLayer[] => [
    P('M 36 30 L 64 30 L 58 38 C 76 44 80 60 76 72 Q 74 80 64 80 L 36 80 Q 26 80 24 72 C 20 60 24 44 42 38 Z', g),
    L('rectangle', 50, 36, 0.4, 0.07, bg, 0, { opacity: 0.5 }),
    L('circle', 50, 62, 0.22, 0.22, bg, 0, { opacity: 0.5 })
];

function rumorGlyph(r: RumorKind, g: string): IconLayer[] {
    switch (r) {
        case 'q': return [SP('M 40 40 C 40 28 60 28 60 40 C 60 48 50 48 50 57', g, 7), L('circle', 50, 68, 0.17, 0.17, g)];
        case 'dots': return [L('circle', 34, 50, 0.2, 0.2, g), L('circle', 50, 50, 0.2, 0.2, g), L('circle', 66, 50, 0.2, 0.2, g)];
        case 'excl': return [L('rectangle', 50, 42, 0.16, 0.5, g), L('circle', 50, 68, 0.17, 0.17, g)];
        case 'wild': return [
            L('rectangle', 50, 50, 0.13, 0.62, g, 0),
            L('rectangle', 50, 50, 0.13, 0.62, g, 60),
            L('rectangle', 50, 50, 0.13, 0.62, g, -60)
        ];
    }
}

const bubble = (c: string): IconLayer[] => [
    P('M 14 30 Q 14 16 28 16 L 72 16 Q 86 16 86 30 L 86 62 Q 86 76 72 76 L 40 76 L 24 88 L 28 76 Q 14 76 14 62 Z', c)
];

// ===========================================================================
// location glyphs
// ===========================================================================

function locGlyph(l: LocId, g: string, bg: string): IconLayer[] {
    switch (l) {
        case 'soup': return [ // food truck
            P('M 16 34 Q 16 28 22 28 L 62 28 L 62 66 L 16 66 Z', g),
            P('M 62 38 L 74 38 L 84 52 L 84 66 L 62 66 Z', g),
            L('rectangle', 39, 42, 0.58, 0.18, bg, 0, { opacity: 0.5 }),
            L('rectangle', 70, 46, 0.14, 0.14, bg, 0, { opacity: 0.5 }),
            L('circle', 30, 68, 0.3, 0.3, g), L('circle', 30, 68, 0.12, 0.12, bg),
            L('circle', 72, 68, 0.3, 0.3, g), L('circle', 72, 68, 0.12, 0.12, bg)
        ];
        case 'garden': return [ // flower
            L('rectangle', 50, 70, 0.08, 0.5, g),
            L('circle', 40, 72, 0.28, 0.14, g, -30),
            ...[0, 72, 144, 216, 288].map(a => {
                const rad = (a - 90) * Math.PI / 180;
                return L('circle', 50 + Math.cos(rad) * 15, 40 + Math.sin(rad) * 15, 0.36, 0.36, g);
            }),
            L('circle', 50, 40, 0.3, 0.3, bg),
            L('circle', 50, 40, 0.18, 0.18, g)
        ];
        case 'desert': return [ // cactus + sun
            L('circle', 70, 30, 0.34, 0.34, g, 0, { opacity: 0.6 }),
            L('rectangle', 44, 56, 0.24, 0.84, g),
            L('circle', 44, 35, 0.24, 0.24, g),
            P('M 33 58 L 26 58 Q 22 58 22 54 L 22 40 Q 26 36 30 40 L 30 50 L 33 50 Z', g),
            P('M 55 52 L 62 52 L 62 42 Q 66 38 70 42 L 70 56 Q 70 60 66 60 L 55 60 Z', g),
            L('rectangle', 50, 79, 1.2, 0.08, g)
        ];
        case 'water': return [ // boat on waves
            P('M 20 54 L 80 54 L 70 68 L 30 68 Z', g),
            L('rectangle', 50, 38, 0.06, 0.6, g),
            P('M 53 24 L 72 48 L 53 48 Z', g),
            SP('M 14 78 Q 22 72 30 78 Q 38 84 46 78 Q 54 72 62 78 Q 70 84 78 78 Q 82 75 86 78', g, 5)
        ];
        case 'air': return [ // balloon
            P('M 50 16 C 72 16 78 36 70 50 L 58 64 L 42 64 L 30 50 C 22 36 28 16 50 16 Z', g),
            P('M 50 16 C 58 16 60 36 56 50 L 52 64 L 48 64 L 44 50 C 40 36 42 16 50 16 Z', bg, { opacity: 0.35 }),
            L('rectangle', 44, 70, 0.03, 0.18, g), L('rectangle', 56, 70, 0.03, 0.18, g),
            L('rectangle', 50, 80, 0.32, 0.18, g)
        ];
        case 'lantern': return [
            L('rectangle', 50, 22, 0.06, 0.16, g),
            P('M 38 28 L 62 28 L 66 34 L 34 34 Z', g),
            P('M 36 34 L 64 34 Q 70 52 64 70 L 36 70 Q 30 52 36 34 Z', g),
            L('circle', 50, 52, 0.26, 0.36, bg, 0, { opacity: 0.55 }),
            P('M 34 70 L 66 70 L 62 76 L 38 76 Z', g)
        ];
        case 'midnight': return [ // crescent moon + stars
            L('circle', 46, 50, 1.24, 1.24, g),
            L('circle', 60, 42, 1.04, 1.04, bg),
            P('M 72 22 L 74 28 L 80 30 L 74 32 L 72 38 L 70 32 L 64 30 L 70 28 Z', g),
            L('circle', 78, 56, 0.1, 0.1, g)
        ];
        case 'academy': return [ // mortarboard
            P('M 50 24 L 86 40 L 50 56 L 14 40 Z', g),
            P('M 30 48 L 70 48 L 70 64 Q 50 74 30 64 Z', g),
            L('rectangle', 80, 54, 0.04, 0.36, g),
            L('circle', 80, 64, 0.1, 0.1, g)
        ];
    }
}

// ===========================================================================
// critter portraits — one parametric face kit
// ===========================================================================

interface Face {
    fur: string;
    light?: string;
    dark?: string;
    inner?: string;
    nose?: string;
    head?: 'round' | 'wide' | 'tall' | 'pear' | 'small';
    ears?: 'round' | 'point' | 'long' | 'floppy' | 'small' | 'horns' | 'none' | 'tuft' | 'antler' | 'ossicone' | 'side';
    earColor?: string;
    muzzle?: 'round' | 'long' | 'none' | 'beak' | 'bill' | 'trunk' | 'snout' | 'wide';
    beak?: string;
    marks?: Array<'mask' | 'stripe' | 'spots' | 'patches' | 'blaze' | 'stripes' | 'cheeks' | 'brow' | 'belly'>;
    mane?: string;
    eyes?: 'dot' | 'big' | 'sleepy' | 'top' | 'side';
    extra?: IconLayer[];
    pre?: IconLayer[];
    bg?: string;
}

const HX = 50, HY = 56;

function headLayer(f: Face): IconLayer {
    switch (f.head) {
        case 'wide': return L('circle', HX, HY, 1.42, 1.14, f.fur);
        case 'tall': return L('circle', HX, HY, 1.08, 1.32, f.fur);
        case 'pear': return P('M 50 26 C 70 26 76 46 78 62 C 80 78 66 86 50 86 C 34 86 20 78 22 62 C 24 46 30 26 50 26 Z', f.fur);
        case 'small': return L('circle', HX, HY + 2, 1.06, 1.0, f.fur);
        default: return L('circle', HX, HY, 1.24, 1.18, f.fur);
    }
}

function earLayers(f: Face): IconLayer[] {
    const c = f.earColor || f.fur;
    const inn = f.inner || f.light || W;
    switch (f.ears) {
        case 'round': return [
            L('circle', 26, 32, 0.56, 0.56, c), L('circle', 74, 32, 0.56, 0.56, c),
            L('circle', 26, 32, 0.3, 0.3, inn), L('circle', 74, 32, 0.3, 0.3, inn)
        ];
        case 'small': return [L('circle', 30, 34, 0.32, 0.32, c), L('circle', 70, 34, 0.32, 0.32, c)];
        case 'point': return [
            L('triangle', 30, 28, 0.62, 0.72, c, -18), L('triangle', 70, 28, 0.62, 0.72, c, 18),
            L('triangle', 31, 31, 0.32, 0.4, inn, -18), L('triangle', 69, 31, 0.32, 0.4, inn, 18)
        ];
        case 'tuft': return [
            L('triangle', 30, 26, 0.46, 0.84, c, -14), L('triangle', 70, 26, 0.46, 0.84, c, 14),
            L('rectangle', 26, 10, 0.04, 0.16, f.dark || INK, -14), L('rectangle', 74, 10, 0.04, 0.16, f.dark || INK, 14)
        ];
        case 'long': return [
            L('circle', 38, 20, 0.34, 0.92, c, -10), L('circle', 62, 20, 0.34, 0.92, c, 10),
            L('circle', 38, 22, 0.16, 0.64, inn, -10), L('circle', 62, 22, 0.16, 0.64, inn, 10)
        ];
        case 'floppy': return [
            L('circle', 22, 54, 0.4, 0.82, c, 16), L('circle', 78, 54, 0.4, 0.82, c, -16)
        ];
        case 'side': return [
            L('circle', 20, 50, 0.44, 0.3, c, -20), L('circle', 80, 50, 0.44, 0.3, c, 20),
            L('circle', 21, 50, 0.24, 0.14, inn, -20), L('circle', 79, 50, 0.24, 0.14, inn, 20)
        ];
        case 'horns': return [
            P('M 30 34 C 18 30 14 20 18 12 C 22 20 28 24 38 26 Z', f.dark || '#f6e7c8'),
            P('M 70 34 C 82 30 86 20 82 12 C 78 20 72 24 62 26 Z', f.dark || '#f6e7c8')
        ];
        case 'antler': return [
            SP('M 36 30 L 26 12 M 30 20 L 18 18 M 28 16 L 32 6', f.dark || '#9b6b43', 5),
            SP('M 64 30 L 74 12 M 70 20 L 82 18 M 72 16 L 68 6', f.dark || '#9b6b43', 5)
        ];
        case 'ossicone': return [
            L('rectangle', 40, 24, 0.07, 0.3, c), L('rectangle', 60, 24, 0.07, 0.3, c),
            L('circle', 40, 16, 0.12, 0.12, f.dark || INK), L('circle', 60, 16, 0.12, 0.12, f.dark || INK)
        ];
        default: return [];
    }
}

function eyeLayers(f: Face, y = 50, dx = 13): IconLayer[] {
    const ink = INK;
    switch (f.eyes) {
        case 'sleepy': return [
            P(`M ${50 - dx - 6} ${y} Q ${50 - dx} ${y + 6} ${50 - dx + 6} ${y} Z`, ink),
            P(`M ${50 + dx - 6} ${y} Q ${50 + dx} ${y + 6} ${50 + dx + 6} ${y} Z`, ink)
        ];
        case 'big': return [
            L('circle', 50 - dx, y, 0.32, 0.32, W), L('circle', 50 + dx, y, 0.32, 0.32, W),
            L('circle', 50 - dx + 1, y + 1, 0.18, 0.18, ink), L('circle', 50 + dx - 1, y + 1, 0.18, 0.18, ink),
            L('circle', 50 - dx + 3, y - 2, 0.06, 0.06, W), L('circle', 50 + dx + 1, y - 2, 0.06, 0.06, W)
        ];
        case 'top': return [
            L('circle', 34, 32, 0.4, 0.4, f.fur), L('circle', 66, 32, 0.4, 0.4, f.fur),
            L('circle', 34, 32, 0.26, 0.26, W), L('circle', 66, 32, 0.26, 0.26, W),
            L('circle', 35, 33, 0.14, 0.14, ink), L('circle', 65, 33, 0.14, 0.14, ink)
        ];
        default: return [
            L('circle', 50 - dx, y, 0.15, 0.17, ink), L('circle', 50 + dx, y, 0.15, 0.17, ink),
            L('circle', 50 - dx + 1.5, y - 1.5, 0.05, 0.05, W), L('circle', 50 + dx + 1.5, y - 1.5, 0.05, 0.05, W)
        ];
    }
}

function markLayers(f: Face, which: 'under' | 'over'): IconLayer[] {
    const out: IconLayer[] = [];
    const d = f.dark || INK;
    (f.marks || []).forEach(m => {
        if (which === 'under') {
            if (m === 'mask') out.push(L('circle', 50, 50, 1.16, 0.36, d));
            if (m === 'stripe') out.push(P('M 45 30 Q 50 27 55 30 L 54 60 Q 50 62 46 60 Z', f.light || W));
            if (m === 'blaze') out.push(P('M 44 30 L 56 30 L 54 62 L 46 62 Z', f.light || W));
            if (m === 'patches') { out.push(L('circle', 36, 51, 0.32, 0.4, d, -30)); out.push(L('circle', 64, 51, 0.32, 0.4, d, 30)); }
            if (m === 'brow') { out.push(L('rectangle', 37, 42, 0.3, 0.06, d, -12)); out.push(L('rectangle', 63, 42, 0.3, 0.06, d, 12)); }
            if (m === 'belly') out.push(L('circle', 50, 64, 0.84, 0.72, f.light || W));
            if (m === 'stripes') {
                out.push(L('triangle', 50, 32, 0.24, 0.3, d, 180));
                out.push(L('triangle', 26, 52, 0.3, 0.16, d, 90));
                out.push(L('triangle', 74, 52, 0.3, 0.16, d, -90));
                out.push(L('triangle', 28, 64, 0.26, 0.12, d, 90));
                out.push(L('triangle', 72, 64, 0.26, 0.12, d, -90));
            }
            if (m === 'spots') {
                [[32, 38], [66, 36], [26, 60], [74, 62], [58, 30]].forEach(([x, y]) => out.push(L('circle', x, y, 0.09, 0.09, d)));
            }
        } else if (m === 'cheeks') {
            out.push(L('circle', 31, 62, 0.14, 0.1, '#f59aa8', 0, { opacity: 0.85 }));
            out.push(L('circle', 69, 62, 0.14, 0.1, '#f59aa8', 0, { opacity: 0.85 }));
        }
    });
    return out;
}

function muzzleLayers(f: Face): IconLayer[] {
    const light = f.light || W;
    const nose = f.nose || INK;
    switch (f.muzzle) {
        case 'none': return [L('circle', 50, 62, 0.08, 0.06, nose)];
        case 'long': return [
            L('circle', 50, 68, 0.56, 0.42, light),
            L('circle', 50, 61, 0.18, 0.12, nose),
            SP('M 50 64 L 50 70 M 44 72 Q 50 76 56 72', nose, 2)
        ];
        case 'wide': return [
            L('circle', 50, 68, 0.84, 0.46, light),
            L('circle', 44, 64, 0.06, 0.08, nose), L('circle', 56, 64, 0.06, 0.08, nose),
            SP('M 42 74 Q 50 78 58 74', nose, 2)
        ];
        case 'snout': return [
            L('circle', 50, 66, 0.44, 0.32, light),
            L('circle', 45, 66, 0.08, 0.1, nose), L('circle', 55, 66, 0.08, 0.1, nose)
        ];
        case 'beak': return [P('M 40 58 L 60 58 L 50 72 Z', f.beak || '#f4a640')];
        case 'bill': return [
            L('circle', 50, 68, 0.62, 0.28, f.beak || '#f4a640'),
            L('circle', 46, 66, 0.04, 0.04, INK), L('circle', 54, 66, 0.04, 0.04, INK)
        ];
        case 'trunk': return [
            P('M 44 58 L 56 58 L 56 76 Q 56 86 64 86 L 64 92 Q 46 92 44 78 Z', f.fur)
        ];
        default: return [
            L('circle', 44, 66, 0.3, 0.24, light), L('circle', 56, 66, 0.3, 0.24, light),
            L('circle', 50, 60, 0.13, 0.09, nose),
            SP('M 50 62 L 50 66', nose, 2)
        ];
    }
}

function critter(id: string, f: Face): IconObject {
    const layers: IconLayer[] = [];
    if (f.bg) layers.push(disc(f.bg, 1.96));
    if (f.pre) layers.push(...f.pre);
    if (f.mane) layers.push(L('circle', HX, HY - 2, 1.72, 1.66, f.mane));
    const ears = earLayers(f);
    const earsBehind = f.ears !== 'floppy' && f.ears !== 'side';
    if (earsBehind) layers.push(...ears);
    layers.push(headLayer(f));
    layers.push(...markLayers(f, 'under'));
    if (!earsBehind) layers.push(...ears);
    layers.push(...eyeLayers(f));
    layers.push(...muzzleLayers(f));
    layers.push(...markLayers(f, 'over'));
    if (f.extra) layers.push(...f.extra);
    return icon(id, layers);
}

/** Every critter on every card, keyed by `animal` id. */
const FACES: Record<string, Face> = {
    // ---- critics ----
    badger: { fur: '#8a8f9c', light: '#f3f1ec', dark: '#33313b', ears: 'small', marks: ['mask', 'stripe'], muzzle: 'round' },
    capybara: { fur: '#c08a5a', light: '#d9a77a', nose: '#5b3b26', head: 'wide', ears: 'small', muzzle: 'wide', eyes: 'sleepy' },
    cow: { fur: '#ffffff', light: '#f7b6bf', dark: '#3a3540', nose: '#c96b7c', ears: 'side', earColor: '#ffffff', inner: '#f7b6bf', muzzle: 'wide', marks: ['patches'], extra: [] },
    fruitbat: { fur: '#7a5a8c', light: '#c9a7d6', inner: '#f2a7b8', ears: 'point', muzzle: 'round', marks: ['cheeks'], eyes: 'big',
        pre: [P('M 6 50 Q 16 30 30 40 Q 20 56 6 50 Z', '#5d4470'), P('M 94 50 Q 84 30 70 40 Q 80 56 94 50 Z', '#5d4470')] },
    jerboa: { fur: '#e8c08c', light: '#fbecd5', inner: '#f6b8a6', head: 'small', ears: 'long', muzzle: 'round', eyes: 'big', marks: ['cheeks'] },
    kangaroo: { fur: '#d08a4e', light: '#f0c79c', inner: '#f2b493', head: 'tall', ears: 'long', muzzle: 'long' },
    mouse: { fur: '#a9a6b8', light: '#f1eef7', inner: '#f6b3c2', nose: '#f07c95', ears: 'round', muzzle: 'round', marks: ['cheeks'], eyes: 'big' },
    poodle: { fur: '#f4ecf7', light: '#ffffff', nose: '#3a3540', ears: 'floppy', earColor: '#e6d5ee', muzzle: 'round',
        pre: [L('circle', 50, 24, 0.6, 0.46, '#e6d5ee'), L('circle', 38, 28, 0.36, 0.36, '#e6d5ee'), L('circle', 62, 28, 0.36, 0.36, '#e6d5ee')] },
    rabbit: { fur: '#f3f0ea', light: '#ffffff', inner: '#f6b3c2', nose: '#f07c95', ears: 'long', muzzle: 'round', marks: ['cheeks'] },
    raccoon: { fur: '#9b9aa6', light: '#f1f0f2', dark: '#3a3540', ears: 'point', inner: '#3a3540', marks: ['mask'], muzzle: 'round' },
    stbernard: { fur: '#c9743c', light: '#ffffff', ears: 'floppy', earColor: '#8f4f26', marks: ['blaze'], muzzle: 'long' },
    treeshrew: { fur: '#9d6e4c', light: '#d9b48f', head: 'pear', ears: 'small', muzzle: 'long', eyes: 'big' },
    hippo: { fur: '#9f8fc4', light: '#c4b8e2', nose: '#5c4c86', head: 'wide', ears: 'small', muzzle: 'wide', eyes: 'dot', marks: ['cheeks'] },
    hyena: { fur: '#c8a46c', light: '#e8d3ac', dark: '#5a4632', ears: 'round', inner: '#5a4632', marks: ['spots'], muzzle: 'long' },
    pig: { fur: '#f4a6b4', light: '#f78ca0', nose: '#c95a72', ears: 'point', inner: '#f78ca0', muzzle: 'snout', marks: ['cheeks'] },
    wolverine: { fur: '#5b4436', light: '#d8b688', dark: '#2e2420', ears: 'small', marks: ['brow', 'stripe'], muzzle: 'round' },
    // ---- restaurateurs ----
    boar: { fur: '#8b5a3c', light: '#c99c7a', nose: '#5a3524', ears: 'point', inner: '#c99c7a', muzzle: 'snout',
        extra: [L('triangle', 38, 74, 0.08, 0.18, '#fff7e6', 0), L('triangle', 62, 74, 0.08, 0.18, '#fff7e6', 0)] },
    bobcat: { fur: '#d9a066', light: '#fbe7cf', dark: '#6b4a2e', ears: 'tuft', inner: '#fbe7cf', marks: ['spots'], muzzle: 'round' },
    falcon: { fur: '#6f7f99', light: '#f1ede4', ears: 'none', muzzle: 'beak', beak: '#f2b23a', marks: ['belly'], eyes: 'big' },
    goat: { fur: '#f2ece0', light: '#ffffff', dark: '#b39a7a', ears: 'horns', head: 'tall', muzzle: 'long',
        extra: [L('triangle', 50, 86, 0.16, 0.2, '#d9cfbd', 180)] },
    elephant: { fur: '#9aa6b8', light: '#c5cfdc', ears: 'side', earColor: '#8593a8', inner: '#f2b7c4', head: 'round', muzzle: 'trunk',
        pre: [L('circle', 18, 54, 0.62, 0.84, '#8593a8'), L('circle', 82, 54, 0.62, 0.84, '#8593a8')] },
    heron: { fur: '#c8d6e6', light: '#ffffff', ears: 'none', head: 'tall', muzzle: 'beak', beak: '#f2b23a',
        extra: [L('rectangle', 66, 26, 0.32, 0.05, '#45506a', -20)] },
    owl: { fur: '#a9805a', light: '#f2e1c4', ears: 'tuft', inner: '#f2e1c4', muzzle: 'beak', beak: '#f2b23a', eyes: 'big', marks: ['belly'] },
    cat: { fur: '#f2a65a', light: '#fff1de', inner: '#f6b3a6', nose: '#e86f7f', ears: 'point', muzzle: 'round', marks: ['cheeks'] },
    rooster: { fur: '#fff6ea', light: '#ffffff', ears: 'none', muzzle: 'beak', beak: '#f4a640',
        pre: [L('circle', 42, 22, 0.24, 0.24, '#e84a4a'), L('circle', 52, 18, 0.26, 0.26, '#e84a4a'), L('circle', 62, 24, 0.22, 0.22, '#e84a4a')],
        extra: [L('circle', 50, 78, 0.12, 0.2, '#e84a4a')] },
    shrew: { fur: '#7e7486', light: '#cfc6d6', head: 'pear', ears: 'small', muzzle: 'long', nose: '#f07c95', eyes: 'dot' },
    crab: { fur: '#f0644a', light: '#ffd0c4', ears: 'none', head: 'wide', muzzle: 'none', eyes: 'top', marks: ['cheeks'],
        pre: [L('circle', 14, 44, 0.36, 0.42, '#f0644a'), L('circle', 86, 44, 0.36, 0.42, '#f0644a'),
            L('triangle', 12, 36, 0.12, 0.18, '#fbe9dc', 30), L('triangle', 88, 36, 0.12, 0.18, '#fbe9dc', -30)] },
    llama: { fur: '#f1e3c8', light: '#ffffff', ears: 'long', inner: '#e3c79d', head: 'tall', muzzle: 'long',
        pre: [L('circle', 50, 28, 0.46, 0.28, '#e3c79d')] },
    bear: { fur: '#9a6a46', light: '#d4ac85', ears: 'round', inner: '#d4ac85', muzzle: 'round', head: 'wide' },
    otter: { fur: '#a67a52', light: '#ecd6bc', ears: 'small', muzzle: 'wide', head: 'wide', marks: ['cheeks'],
        extra: [SP('M 30 70 L 18 66 M 30 74 L 18 76 M 70 70 L 82 66 M 70 74 L 82 76', '#5a3e28', 1.6)] },
    duck: { fur: '#f7f3e8', light: '#ffffff', ears: 'none', muzzle: 'bill', beak: '#f59a3a',
        pre: [L('rectangle', 50, 20, 0.04, 0.16, '#e0d6c0')] },
    kitfox: { fur: '#f0a560', light: '#fff5e8', inner: '#fff5e8', ears: 'point', muzzle: 'long', head: 'pear', marks: ['cheeks'],
        pre: [L('triangle', 26, 26, 0.7, 0.86, '#f0a560', -22), L('triangle', 74, 26, 0.7, 0.86, '#f0a560', 22)] },
    // ---- zous-chefs ----
    koala: { fur: '#a8aebd', light: '#e8ebf2', inner: '#f3f4f8', ears: 'round', nose: '#3a3540', head: 'wide', muzzle: 'none',
        extra: [L('circle', 50, 62, 0.28, 0.36, '#3a3540')] },
    chipmunk: { fur: '#d39457', light: '#f8e3c6', dark: '#6e4a2c', ears: 'small', muzzle: 'round', marks: ['stripe', 'cheeks'] },
    cheetah: { fur: '#f2c25a', light: '#fff1d1', dark: '#4a3a2a', ears: 'small', marks: ['spots'], muzzle: 'round',
        extra: [L('rectangle', 35, 62, 0.04, 0.2, '#4a3a2a', 8), L('rectangle', 65, 62, 0.04, 0.2, '#4a3a2a', -8)] },
    giraffe: { fur: '#f2c25a', light: '#fae3a8', dark: '#c4813f', ears: 'side', head: 'tall', marks: ['spots'], muzzle: 'long', earColor: '#f2c25a', inner: '#c4813f',
        pre: [L('rectangle', 40, 22, 0.07, 0.28, '#f2c25a'), L('rectangle', 60, 22, 0.07, 0.28, '#f2c25a'),
            L('circle', 40, 15, 0.12, 0.12, '#c4813f'), L('circle', 60, 15, 0.12, 0.12, '#c4813f')] },
    fox: { fur: '#ef7d3c', light: '#fff4e6', inner: '#fff4e6', ears: 'point', muzzle: 'long', head: 'pear' },
    frog: { fur: '#6cc46a', light: '#c8edb4', ears: 'none', head: 'wide', muzzle: 'none', eyes: 'top', marks: ['cheeks'],
        extra: [SP('M 36 68 Q 50 76 64 68', '#2e6e3a', 3)] },
    panda: { fur: '#ffffff', light: '#ffffff', dark: '#33313b', ears: 'round', earColor: '#33313b', inner: '#33313b', marks: ['patches'], muzzle: 'round', eyes: 'dot' },
    hummingbird: { fur: '#3cbf9c', light: '#d8f4ea', ears: 'none', head: 'small', muzzle: 'none', eyes: 'big',
        extra: [L('rectangle', 76, 62, 0.62, 0.05, '#33313b', -10), L('circle', 50, 76, 0.4, 0.18, '#e2506a')] },
    yorkie: { fur: '#7d8597', light: '#e7c08a', ears: 'point', earColor: '#e7c08a', inner: '#f2d6aa', muzzle: 'round', marks: ['blaze'],
        pre: [L('circle', 50, 22, 0.16, 0.16, '#e2506a')] },
    penguin: { fur: '#3a3f55', light: '#ffffff', ears: 'none', muzzle: 'beak', beak: '#f4a640', marks: ['belly'], eyes: 'dot' },
    sloth: { fur: '#a58e72', light: '#e5d6bf', dark: '#5a4636', ears: 'none', muzzle: 'round', eyes: 'sleepy',
        marks: ['belly'], extra: [L('circle', 37, 51, 0.24, 0.12, '#5a4636', -15, { opacity: 0.4 }), L('circle', 63, 51, 0.24, 0.12, '#5a4636', 15, { opacity: 0.4 })] },
    alpaca: { fur: '#fbf4ea', light: '#ffffff', ears: 'long', inner: '#efd9bf', head: 'tall', muzzle: 'long',
        pre: [L('circle', 50, 26, 0.6, 0.4, '#efe2cf'), L('circle', 36, 30, 0.34, 0.34, '#efe2cf'), L('circle', 64, 30, 0.34, 0.34, '#efe2cf')] },
    python: { fur: '#7cbf4e', light: '#d3eeb5', dark: '#4f8a2c', ears: 'none', head: 'wide', muzzle: 'none', marks: ['spots'],
        extra: [L('rectangle', 50, 80, 0.04, 0.14, '#e2506a'), L('triangle', 47, 87, 0.06, 0.08, '#e2506a', 200), L('triangle', 53, 87, 0.06, 0.08, '#e2506a', 160)] },
    donkey: { fur: '#9b97a8', light: '#e5e2ec', ears: 'long', inner: '#5f5b6c', head: 'tall', muzzle: 'long',
        pre: [L('rectangle', 50, 24, 0.12, 0.26, '#5f5b6c')] },
    dolphin: { fur: '#5ca9de', light: '#d6ecfa', ears: 'none', head: 'round', muzzle: 'none', marks: ['belly'],
        pre: [P('M 46 22 L 58 8 L 60 28 Z', '#4a92c8')], extra: [L('circle', 50, 76, 0.42, 0.18, '#7dbfe8')] },
    mole: { fur: '#5e5468', light: '#f2a7b8', ears: 'none', head: 'wide', muzzle: 'snout', nose: '#c95a72', eyes: 'sleepy',
        extra: [L('circle', 26, 76, 0.26, 0.2, '#f2a7b8'), L('circle', 74, 76, 0.26, 0.2, '#f2a7b8')] },
    butterfly: { fur: '#33313b', light: '#ffffff', ears: 'none', head: 'small', muzzle: 'none', eyes: 'big',
        pre: [L('circle', 22, 40, 0.62, 0.62, '#f07aa8'), L('circle', 78, 40, 0.62, 0.62, '#f07aa8'),
            L('circle', 26, 72, 0.44, 0.44, '#9a72cf'), L('circle', 74, 72, 0.44, 0.44, '#9a72cf'),
            SP('M 44 34 Q 40 20 34 16 M 56 34 Q 60 20 66 16', '#33313b', 2.5)] },
    parrot: { fur: '#e84a4a', light: '#ffffff', ears: 'none', muzzle: 'beak', beak: '#f6d04d', eyes: 'big',
        pre: [L('triangle', 50, 20, 0.3, 0.4, '#3fae84', 0), L('triangle', 40, 24, 0.24, 0.34, '#f0bd2e', -20)] },
    bee: { fur: '#f6c63c', light: '#ffffff', dark: '#33313b', ears: 'none', muzzle: 'none', eyes: 'big', marks: ['cheeks'],
        pre: [L('circle', 26, 26, 0.44, 0.32, '#dff0fb', -30), L('circle', 74, 26, 0.44, 0.32, '#dff0fb', 30),
            SP('M 42 34 L 36 16 M 58 34 L 64 16', '#33313b', 2.5)],
        extra: [L('rectangle', 50, 76, 0.86, 0.1, '#33313b')] },
    lion: { fur: '#f2b44f', light: '#fff0d4', mane: '#d97a2b', ears: 'round', inner: '#fff0d4', muzzle: 'round' },
    retriever: { fur: '#eebd6f', light: '#fff1d9', ears: 'floppy', earColor: '#d9a050', muzzle: 'long' },
    skunk: { fur: '#3a3a48', light: '#ffffff', ears: 'small', marks: ['stripe'], muzzle: 'round', eyes: 'big' },
    zebra: { fur: '#ffffff', light: '#ffffff', dark: '#33313b', ears: 'point', inner: '#33313b', head: 'tall', marks: ['stripes'], muzzle: 'long',
        pre: [L('rectangle', 50, 22, 0.12, 0.3, '#33313b')] },
    platypus: { fur: '#a5734c', light: '#d9b48f', ears: 'none', muzzle: 'bill', beak: '#4a4458', eyes: 'dot' },
    hare: { fur: '#c9a37e', light: '#f5e7d6', inner: '#f2b7a8', ears: 'long', head: 'tall', muzzle: 'round', eyes: 'big' },
    tortoise: { fur: '#8fc06a', light: '#d6edc1', ears: 'none', head: 'round', muzzle: 'none', eyes: 'dot', marks: ['cheeks'],
        pre: [P('M 8 86 C 8 50 92 50 92 86 Z', '#6b8f4a'), L('circle', 30, 78, 0.18, 0.12, '#8fbf62'), L('circle', 70, 78, 0.18, 0.12, '#8fbf62')],
        extra: [SP('M 40 68 Q 50 74 60 68', '#3c5a28', 2.5)] },
    // ---- the three chefs (palette-tinted figure heads) ----
    chef_mouse: { fur: 'primary', light: '#ffffff', inner: '#ffffff', ears: 'round', muzzle: 'round', eyes: 'dot', nose: INK },
    chef_lizard: { fur: 'primary', light: '#ffffff', ears: 'none', head: 'wide', muzzle: 'none', eyes: 'top',
        extra: [SP('M 36 68 Q 50 74 64 68', INK, 3)] },
    chef_boar: { fur: 'primary', light: '#ffffff', ears: 'point', inner: '#ffffff', muzzle: 'snout', nose: INK,
        extra: [L('triangle', 38, 74, 0.08, 0.18, '#ffffff'), L('triangle', 62, 74, 0.08, 0.18, '#ffffff')] }
};

export const portraitId = (animal: string) => `critter_${animal}`;

// ===========================================================================
// icon registry
// ===========================================================================

export const CK_ICONS: Record<string, IconObject> = {};
const reg = (o: IconObject) => { CK_ICONS[o.id] = o; };

ING_TYPES.forEach(t => {
    reg(icon(`ing_${t}`, [disc(ING_COLORS[t]), ...ingGlyph(t, W, ING_COLORS[t])]));
    reg(icon(`glyph_${t}`, ingGlyph(t, ING_COLORS[t], W)));
    reg(icon(`spice_${t}`, [
        L('rectangle', 50, 50, 1.26, 1.26, ING_COLORS[t], 45),
        ...chiliGlyph(W, ING_COLORS[t])
    ]));
});
reg(icon('spice_all', [L('rectangle', 50, 50, 1.26, 1.26, TYPE_COLORS.allspice, 45), ...burstGlyph(W)]));
reg(icon('spice_any', [L('rectangle', 50, 50, 1.26, 1.26, '#e8604c', 45), ...chiliGlyph(W, '#e8604c')]));
reg(icon('soup', [disc(TYPE_COLORS.soup), ...bowlGlyph(W, TYPE_COLORS.soup)]));
reg(icon('bisque', [disc(TYPE_COLORS.bisque), ...bowlGlyph(W, TYPE_COLORS.bisque),
    P('M 42 58 L 46 52 L 50 58 L 54 52 L 58 58 Z', TYPE_COLORS.bisque)]));
reg(icon('star', [P(starPath, TYPE_COLORS.star)]));
reg(icon('star_coin', [disc(TYPE_COLORS.star), P('M 50 22 L 57 40 L 77 41 L 61 53 L 67 73 L 50 61 L 33 73 L 39 53 L 23 41 L 43 40 Z', W)]));
reg(icon('hat', [disc(TYPE_COLORS.zous), ...hatGlyph(W, TYPE_COLORS.zous)]));
reg(icon('fridge', [disc('#6cb8e8'), ...snowGlyph(W)]));
reg(icon('bag', [disc('#c49a6c'), ...bagGlyph(W, '#c49a6c')]));
reg(icon('plate_challenge', [disc('#ffffff'), L('circle', 50, 50, 1.9, 1.9, 'none', 0, { stroke: '#e0d6c8', strokeWidth: 6 }), L('circle', 50, 50, 1.2, 1.2, 'none', 0, { stroke: '#e0d6c8', strokeWidth: 4 })]));
reg(icon('plate_critic', [
    L('rectangle', 50, 50, 1.6, 0.9, '#ffffff'),
    L('rectangle', 50, 50, 1.6, 0.9, 'none', 0, { stroke: '#e0d6c8', strokeWidth: 5 }),
    L('rectangle', 8, 50, 0.06, 0.7, '#b9ad9c'), L('rectangle', 92, 50, 0.06, 0.7, '#b9ad9c')
]));
(['q', 'dots', 'excl', 'wild'] as RumorKind[]).forEach(r => {
    reg(icon(`rumor_${r}`, [...bubble(r === 'wild' ? '#7a5cc8' : TYPE_COLORS.rumor), ...rumorGlyph(r, W).map(x => ({ ...x, y: (x as any).y - 4 } as IconLayer))]));
});
(Object.keys(LOC_COLORS) as LocId[]).forEach(l => {
    reg(icon(`loc_${l}`, [disc(LOC_COLORS[l]), ...locGlyph(l, W, LOC_COLORS[l])]));
    reg(icon(`locglyph_${l}`, locGlyph(l, W, LOC_COLORS[l])));
});
Object.keys(FACES).forEach(a => reg(critter(portraitId(a), FACES[a])));
// card art: portrait on a soft disc
/** Uniformly scale a stack of layers about the icon centre (paths included). */
function scaleLayers(layers: IconLayer[], k: number, dy = 0): IconLayer[] {
    const map = (v: number, axis: 0 | 1) => (50 + (v - 50) * k + (axis ? dy : 0));
    return layers.map(l => {
        const sh = l as PrimitiveShape;
        if (sh.type === 'bezier' && sh.customPath) {
            let axis: 0 | 1 = 0;
            const path = sh.customPath.split(/\s+/).map(tok => {
                if (!/^-?\d/.test(tok)) { axis = 0; return tok; }
                const out = map(parseFloat(tok), axis).toFixed(2);
                axis = axis ? 0 : 1;
                return out;
            }).join(' ');
            return { ...sh, customPath: path, strokeWidth: sh.strokeWidth ? sh.strokeWidth * k : sh.strokeWidth } as IconLayer;
        }
        if (sh.type === 'boolean' as any || (l as any).type === 'ref') return l;
        return {
            ...sh, x: map(sh.x, 0), y: map(sh.y, 1),
            scaleX: (sh.scaleX ?? 1) * k, scaleY: (sh.scaleY ?? 1) * k,
            strokeWidth: sh.strokeWidth ? sh.strokeWidth * k : sh.strokeWidth
        } as IconLayer;
    });
}

Object.keys(FACES).forEach(a => {
    if (a.indexOf('chef_') === 0) return;
    reg(icon(`art_${a}`, [disc('secondary', 1.92), ...scaleLayers(CK_ICONS[portraitId(a)].layers, 0.84, 2)]));
});

export function chefIconId(chef: ChefKind): string { return portraitId(`chef_${chef}`); }

/** Palette used to tint a chef head in a player's accent colour. */
export function accentPalette(accent: string): Palette {
    return { ...CK_PALETTE, id: `ck_accent_${accent}`, primary: accent };
}

// ===========================================================================
// palettes
// ===========================================================================

export const CK_PALETTE: Palette = {
    id: 'ck_base', name: 'Critter Kitchen',
    // `secondary` is the soft disc behind critter portraits (palette keys are
    // resolved case-insensitively by lowercasing, so camelCase keys can't be used)
    background: '#fffaf3', border: '#efe4d4', primary: '#ef7a54', secondary: '#fbefe0', accent: '#f5b82e',
    charcoal: INK, text: INK, panelBg: '#fbf1e4', tertiary: '#46508f', success: '#4bb780', danger: '#e2506a'
};

function cardPalette(id: string, band: string, bg: string, panel: string): Palette {
    return { ...CK_PALETTE, id: `ck_${id}`, primary: band, border: band, background: bg, panelBg: panel, secondary: panel };
}

export const PALETTES = {
    critic: cardPalette('critic', TYPE_COLORS.critic, '#fff4f7', '#fde3ec'),
    rest: cardPalette('rest', TYPE_COLORS.rest, '#f2fafb', '#d9f0f2'),
    zous: cardPalette('zous', TYPE_COLORS.zous, '#f3fbf6', '#daf2e5'),
    rumor: cardPalette('rumor', TYPE_COLORS.rumor, '#f5f6fc', '#e3e6f6'),
    fanatic: cardPalette('fanatic', TYPE_COLORS.fanatic, '#fff6f3', '#fde3dc'),
    challenge: cardPalette('challenge', TYPE_COLORS.challenge, '#fff8f1', '#fde9d8')
};

// ===========================================================================
// card builders
// ===========================================================================

const CARD = { widthMm: 63, heightMm: 88, borderRadiusMm: 5 };

const SCOPE_LABEL: Record<CriticDef['scope'], string> = {
    challenge: 'CRITIC · CHALLENGES', critic: 'CRITIC · CRITIC MEAL', both: 'CRITIC · ALL MEALS', shopping: 'CRITIC · SHOPPING'
};

/** Critic card: berry band, critter portrait, icon-led rule. */
export function criticCard(c: CriticDef): CardDefinition {
    return {
        id: `critic_${c.id}`, name: c.name, ...CARD, palette: PALETTES.critic, borderWidth: 0,
        header: { title: c.name.replace(/^The /, ''), subtitle: SCOPE_LABEL[c.scope], background: 'primary' },
        mainArt: { iconId: `art_${c.animal}`, frameStyle: 'none', scaling: 1 },
        footer: { text: c.short, align: 'center', verticalAlign: 'center', size: 1.3, italic: false, weight: 600 }
    };
}

/** Gold bonus-star chip (restaurateur end-game stars, rumor rewards). */
const starChip = (value: string) => ({
    position: 'top-right' as const, shape: 'chip' as const, size: 3.6, radius: 1.8,
    iconId: 'star', value, backgroundColor: TYPE_COLORS.star, color: '#ffffff'
});

export function restCard(r: RestDef): CardDefinition {
    return {
        id: `rest_${r.id}`, name: r.name, ...CARD, palette: PALETTES.rest, borderWidth: 0,
        header: { title: r.name, subtitle: 'RESTAURATEUR', background: 'primary' },
        mainArt: { iconId: `art_${r.animal}`, frameStyle: 'none', scaling: 1 },
        overlays: [starChip(String(r.stars))],
        footer: { text: r.short, align: 'center', verticalAlign: 'center', size: 1.3, italic: false, weight: 600 }
    };
}

export function zousCard(z: ZousDef): CardDefinition {
    return {
        id: `zous_${z.id}`, name: z.name, ...CARD, palette: PALETTES.zous, borderWidth: 0,
        header: { title: z.name, subtitle: ZOUS_TIMING_LABEL[z.timing].toUpperCase(), background: 'primary' },
        mainArt: { iconId: `art_${z.animal}`, frameStyle: 'none', scaling: 1 },
        overlays: [{ position: 'top-right', shape: 'chip', size: 3.6, radius: 1.8, iconId: 'hat', value: String(z.cap), backgroundColor: '#ffffff', color: TYPE_COLORS.zous }],
        footer: { text: z.short, align: 'center', verticalAlign: 'center', size: 1.3, italic: false, weight: 600 }
    };
}

// ---------------------------------------------------------------------------
// rumor concept glyphs (navy coins) + per-rumor art rows
// ---------------------------------------------------------------------------

const NAVY = TYPE_COLORS.rumor;
const concept = (id: string, glyph: IconLayer[]) => reg(icon(id, [disc(NAVY), ...glyph]));
concept('c_steps', [L('rectangle', 32, 64, 0.32, 0.36, W), L('rectangle', 50, 56, 0.32, 0.68, W), L('rectangle', 68, 48, 0.32, 1.0, W)]);
concept('c_range', [L('rectangle', 50, 50, 0.1, 1.04, W), P('M 38 32 L 50 18 L 62 32 Z', W), P('M 38 68 L 50 82 L 62 68 Z', W)]);
concept('c_odd', [L('circle', 34, 34, 0.24, 0.24, W), L('circle', 50, 50, 0.24, 0.24, W), L('circle', 66, 66, 0.24, 0.24, W)]);
concept('c_equal', [L('rectangle', 50, 40, 1.0, 0.16, W), L('rectangle', 50, 60, 1.0, 0.16, W)]);
concept('c_lr', [
    P('M 30 28 L 22 28 L 22 72 L 30 72 L 30 66 L 28 66 L 28 34 L 30 34 Z', W),
    P('M 70 28 L 78 28 L 78 72 L 70 72 L 70 66 L 72 66 L 72 34 L 70 34 Z', W),
    L('rectangle', 50, 50, 0.6, 0.12, W)
]);
concept('c_right', [
    L('circle', 26, 58, 0.13, 0.13, W), L('circle', 42, 58, 0.13, 0.13, W), L('circle', 58, 58, 0.13, 0.13, W),
    L('circle', 76, 50, 0.32, 0.32, W), P('M 76 22 L 82 32 L 70 32 Z', W)
]);
concept('c_courses', [0, 1, 2, 3, 4, 5, 6].map(i => {
    const a = (200 + i * 23.3) * Math.PI / 180;
    return L('circle', 50 + Math.cos(a) * 26, 54 + Math.sin(a) * 26, 0.15, 0.15, W);
}).concat([L('rectangle', 50, 62, 0.56, 0.08, W)]));
concept('c_variety', [L('circle', 30, 50, 0.24, 0.24, W), L('rectangle', 50, 50, 0.36, 0.36, W), P('M 62 60 L 70 40 L 78 60 Z', W)]);
concept('c_plain', [L('circle', 50, 50, 0.8, 0.8, 'none', 0, { stroke: W, strokeWidth: 8 }), L('circle', 50, 50, 0.3, 0.3, W)]);
concept('c_most', [P('M 24 66 L 24 36 L 37 50 L 50 30 L 63 50 L 76 36 L 76 66 Z', W), L('rectangle', 50, 72, 1.04, 0.1, W)]);

const RUMOR_ART: Record<string, string[]> = {
    bigcheese: ['ing_cheese', 'c_courses'], bigdipper: ['soup', 'c_equal', 'ing_bread'], pampered: ['c_courses'],
    hibernator: ['c_right'], mercurial: ['c_range'], nocturnal: ['c_steps'], oddtastes: ['c_odd'],
    picky: ['c_courses', 'c_range'], psychedelic: ['ing_mushroom', 'c_most'], shortsighted: ['ing_carrot'],
    simplepalate: ['c_equal', 'c_most'], sommelier: ['ing_wine', 'ing_fish', 'ing_meat'], spicelover: ['spice_any', 'c_most'],
    subtle: ['ing_bread', 'c_equal', 'c_most'], superchatty: ['rumor_q', 'rumor_wild'], tender: ['c_lr'],
    togo: ['bag', 'c_most'], unsophisticated: ['c_plain', 'c_most'], variedleftovers: ['bag', 'c_variety'],
    variedservings: ['c_variety', 'c_most'], winecellar: ['ing_wine', 'bag']
};

export function rumorCard(r: RumorDef): CardDefinition {
    const fan = !!r.fanatic;
    const art = fan ? [`ing_${r.fanatic}`] : (RUMOR_ART[r.id] || ['star_coin']);
    return {
        id: `rumor_${r.id}`, name: r.name, ...CARD, palette: fan ? PALETTES.fanatic : PALETTES.rumor, borderWidth: 0,
        header: { title: r.name, subtitle: r.advanced ? 'ADVANCED RUMOR' : 'RUMOR', background: 'primary' },
        data: {
            background: 'none',
            rows: [{
                iconsList: art.map(iconId => ({ iconId })),
                iconsListAlign: 'center', iconsListBg: 'none',
                iconsListIconSize: art.length === 1 ? 7.4 : art.length === 2 ? 5.4 : 4.4, iconsListGap: 0.35
            }]
        },
        overlays: [fan
            ? { position: 'top-right', shape: 'chip', size: 3.6, radius: 1.8, value: '×2', backgroundColor: '#ffffff', color: TYPE_COLORS.fanatic }
            : starChip(r.reward)],
        footer: { text: r.short, align: 'center', verticalAlign: 'center', size: 1.35, italic: false, weight: 600 }
    };
}

export function challengeCard(c: ChallengeDef, held = false): CardDefinition {
    return {
        id: `challenge_${c.id}${held ? '_h' : ''}`, name: c.name, ...CARD, palette: PALETTES.challenge, borderWidth: 0,
        header: { title: c.name, subtitle: 'CHALLENGE', background: 'primary' },
        data: {
            background: 'none',
            rows: [{
                iconsList: c.req.map((t, i) => ({ iconId: held && i === 2 ? 'hold' : `ing_${t}` })),
                iconsListAlign: 'center', iconsListBg: 'none', iconsListIconSize: 4.4, iconsListGap: 0.3
            }]
        },
        footer: { text: '6+ [icon:star] · 12+ [icon:star][icon:star] · 21+ [icon:star]×4', align: 'center', verticalAlign: 'center', size: 1.25, italic: false, weight: 600 }
    };
}
reg(icon('hold', [disc('#efe6da'), L('rectangle', 50, 50, 1.0, 0.16, '#b9ad9c', 45), L('rectangle', 50, 50, 1.0, 0.16, '#b9ad9c', -45)]));

/** A face-down card back (rumor slot, deck). */
export function backCard(kind: 'rumor' | 'challenge', slot?: RumorKind): CardDefinition {
    const pal = kind === 'rumor' ? PALETTES.rumor : PALETTES.challenge;
    return {
        id: `back_${kind}_${slot || ''}`, name: 'back', ...CARD, palette: { ...pal, background: pal.primary }, borderWidth: 0,
        mainArt: { iconId: kind === 'rumor' ? `rumor_${slot || 'q'}` : 'plate_challenge', frameStyle: 'none', scaling: 0.6 }
    };
}
