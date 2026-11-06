/**
 * QuacksAssets.ts — flat-vector iconography, palettes and card builders for
 * The Quacks of Quedlinburg.
 *
 * Design language: bright, light flat vector with a storybook-magic slant. Every
 * glyph is a handful of primitives in the card-renderer 0–100 `IconObject` DSL,
 * layered in painter's order (silhouette first, details punched back in with the
 * disc colour) — no boolean masks — so each icon renders identically through
 * React `ExpressiveIcon`, the React-free `iconToSvg`, and `npm run inspect`.
 *
 * One visual grammar runs through the whole game:
 *   • a ROUND COLOURED DISC is always an ingredient chip — on the pot, in the
 *     shop, on a book and inline in card text;
 *   • PIPS on that disc are the chip's value (1, 2, 3 or 4);
 *   • a GOLD DISC WITH A NUMBER is always a price / coin value;
 *   • everything that is not a chip is deliberately not round — the ruby is a
 *     cut gem, the points are a star, the droplet a teardrop.
 */

import { CardDefinition, Palette, IconObject, IconLayer, PrimitiveShape } from '../../client/lib/card-renderer/types';
import { coinIcon } from '../../client/lib/card-renderer/presets';
import { DiceFaceset, DiceTheme } from '../../client/lib/dice-roller/types';
import {
    ChipColor, CHIP_COLORS, chipValues, INGREDIENT_NAME, Book, TRIGGER_LABEL, FortuneCard, DieFace, Witch, Metal, Patient
} from './QuacksData';

// ---------------------------------------------------------------------------
// Authoring shorthand
// ---------------------------------------------------------------------------

type Extra = Partial<Pick<PrimitiveShape, 'stroke' | 'strokeWidth' | 'opacity' | 'customPath'>>;

const L = (
    id: string, type: PrimitiveShape['type'],
    x: number, y: number, sx: number, sy: number,
    rot = 0, fill = '#ffffff', extra: Extra = {}
): IconLayer => ({ id, type, x, y, scaleX: sx, scaleY: sy, rotation: rot, fill, ...extra });

const path = (id: string, d: string, fill: string, extra: Extra = {}): IconLayer =>
    ({ id, type: 'bezier', x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, fill, customPath: d, ...extra });

const icon = (id: string, layers: IconLayer[]): IconObject => ({ id, name: id, layers });

/** Uniformly shrink a glyph towards the box centre so its disc always frames it. */
function inset(layers: IconLayer[], k: number, cx = 50, cy = 50): IconLayer[] {
    return layers.map((l) => {
        const s = l as PrimitiveShape;
        if (s.type === 'bezier' && s.customPath) {
            return { ...s, x: cx - 50 * k, y: cy - 50 * k, scaleX: k, scaleY: k };
        }
        return {
            ...s,
            x: cx + (s.x - 50) * k,
            y: cy + (s.y - 50) * k,
            scaleX: (s.scaleX ?? 1) * k,
            scaleY: (s.scaleY ?? 1) * k,
            strokeWidth: s.strokeWidth !== undefined ? s.strokeWidth * k : undefined
        };
    });
}

/** An n-pointed starburst as an SVG path. */
function burst(cx: number, cy: number, outer: number, inner: number, points: number, turn = 0): string {
    const pts: string[] = [];
    for (let i = 0; i < points * 2; i++) {
        const r = i % 2 === 0 ? outer : inner;
        const a = (Math.PI * i) / points - Math.PI / 2 + turn;
        pts.push(`${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`);
    }
    return `M ${pts.join(' L ')} Z`;
}

/**
 * A thick straight stroke and a tilted ellipse, as paths. The engine applies
 * `rotation` before a non-uniform scale, which shears a rotated bar or oval —
 * so anything slanted is authored as an explicit outline instead.
 */
function bar(id: string, x1: number, y1: number, x2: number, y2: number, w: number, fill: string): IconLayer {
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const nx = (-(y2 - y1) / len) * w / 2;
    const ny = ((x2 - x1) / len) * w / 2;
    const f = (n: number) => n.toFixed(1);
    return path(id, `M ${f(x1 + nx)} ${f(y1 + ny)} L ${f(x2 + nx)} ${f(y2 + ny)} L ${f(x2 - nx)} ${f(y2 - ny)} L ${f(x1 - nx)} ${f(y1 - ny)} Z`, fill);
}

function oval(id: string, cx: number, cy: number, rx: number, ry: number, deg: number, fill: string): IconLayer {
    const a = (deg * Math.PI) / 180;
    const dx = rx * Math.cos(a);
    const dy = rx * Math.sin(a);
    const f = (n: number) => n.toFixed(1);
    return path(id, `M ${f(cx - dx)} ${f(cy - dy)} A ${rx} ${ry} ${deg} 1 0 ${f(cx + dx)} ${f(cy + dy)} A ${rx} ${ry} ${deg} 1 0 ${f(cx - dx)} ${f(cy - dy)} Z`, fill);
}

// ---------------------------------------------------------------------------
// Colour system
// ---------------------------------------------------------------------------

export const INK = '#3b3553';

/** Chip disc colour. */
export const CHIP_HEX: Record<ChipColor, string> = {
    white: '#f4efe6',
    orange: '#ff9838',
    green: '#34c27b',
    blue: '#3a9cf0',
    red: '#f4566b',
    yellow: '#fbc82f',
    purple: '#a66bf2',
    black: '#4a4368',
    herb: '#ec6fb0'
};

/** Glyph / pip colour on that disc, chosen for contrast rather than by habit. */
export const CHIP_GLYPH: Record<ChipColor, string> = {
    white: '#4a4368',
    orange: '#ffffff',
    green: '#ffffff',
    blue: '#ffffff',
    red: '#ffffff',
    yellow: '#6a4700',
    purple: '#ffffff',
    black: '#ffffff',
    herb: '#ffffff'
};

/** Soft tint behind a book's rule text. */
export const CHIP_TINT: Record<ChipColor, string> = {
    white: '#f7f4ee',
    orange: '#fff1e0',
    green: '#e3f8ec',
    blue: '#e3f1fe',
    red: '#ffe8eb',
    yellow: '#fff6d6',
    purple: '#f2e9fe',
    black: '#eceaf3',
    herb: '#fde8f3'
};

/** The three witch metals (Herb Witches expansion). */
export const METAL_HEX: Record<Metal, string> = { silver: '#a3adbd', bronze: '#c9864f', gold: '#e5ad22' };
export const METAL_TINT: Record<Metal, string> = { silver: '#eef1f5', bronze: '#f8ece2', gold: '#fdf3d6' };

export const RUBY_HEX = '#e8246f';
export const COIN_HEX = '#f9bb2d';
export const COIN_INK = '#5b3d00';
export const VP_HEX = '#6a5be2';
export const DROPLET_HEX = '#17b6a7';
export const BOOM_HEX = '#ff5a48';
export const RAT_HEX = '#8f8aa8';
export const FORTUNE_NOW_HEX = '#a66bf2';
export const FORTUNE_ROUND_HEX = '#3a9cf0';

export const QUACKS_PALETTE: Palette = {
    id: 'quacks', name: 'Quacks',
    background: '#ffffff', border: '#e7e2f1', primary: VP_HEX, secondary: COIN_HEX,
    accent: DROPLET_HEX, charcoal: INK, text: INK, panelBg: '#f6f3fb',
    tertiary: '#a66bf2', success: '#34c27b', danger: BOOM_HEX
};

function bandPalette(id: string, band: string, bandText: string, tint: string): Palette {
    return { ...QUACKS_PALETTE, id, name: id, primary: band, text: bandText, panelBg: tint, border: band };
}

// ---------------------------------------------------------------------------
// Ingredient glyphs (drawn for a coloured disc, in `g` with details cut in `d`)
// ---------------------------------------------------------------------------

function ingredientGlyph(color: ChipColor): IconLayer[] {
    const g = CHIP_GLYPH[color];
    const d = CHIP_HEX[color];
    switch (color) {
        case 'white':   // cherry bomb: a round bomb with a lit fuse
            return [
                L('bomb', 'circle', 45, 59, 1.04, 1.04, 0, g),
                L('shine', 'circle', 36, 51, 0.24, 0.24, 0, d),
                bar('fuse', 59, 42, 72, 27, 7, g),
                path('spark', burst(75, 22, 14, 5, 4), '#ff8a3c')
            ];
        case 'orange':  // pumpkin: a squat ribbed gourd with a stem
            return [
                L('body', 'circle', 50, 57, 1.3, 1.0, 0, g),
                L('rib_l', 'rectangle', 39, 58, 0.1, 0.62, 0, d),
                L('rib_r', 'rectangle', 61, 58, 0.1, 0.62, 0, d),
                bar('stem', 49, 36, 52, 20, 9, g),
                oval('leaf', 64, 27, 10, 4.5, -20, g)
            ];
        case 'green':   // garden spider: round body, small head, eight legs
            return [
                bar('leg_a', 17, 42, 83, 70, 6.5, g),
                bar('leg_b', 17, 70, 83, 42, 6.5, g),
                bar('leg_c', 30, 28, 70, 84, 6.5, g),
                bar('leg_d', 30, 84, 70, 28, 6.5, g),
                L('body', 'circle', 50, 58, 0.7, 0.76, 0, g),
                L('head', 'circle', 50, 35, 0.4, 0.4, 0, g),
                L('mark', 'rectangle', 50, 59, 0.16, 0.16, 45, d)
            ];
        case 'blue':    // crow skull: a round cranium over a long beak
            return [
                L('skull', 'circle', 50, 40, 1.06, 1.0, 0, g),
                L('beak', 'triangle', 50, 68, 0.56, 0.62, 180, g),
                L('eye_l', 'circle', 40, 42, 0.28, 0.28, 0, d),
                L('eye_r', 'circle', 60, 42, 0.28, 0.28, 0, d)
            ];
        case 'red':     // toadstool: a spotted cap on a stubby stalk
            return [
                L('stalk', 'rectangle', 50, 66, 0.4, 0.5, 0, g),
                L('cap', 'semi-circle', 50, 54, 1.36, 1.36, 0, g),
                L('spot_a', 'circle', 38, 41, 0.22, 0.22, 0, d),
                L('spot_b', 'circle', 56, 33, 0.18, 0.18, 0, d),
                L('spot_c', 'circle', 65, 46, 0.14, 0.14, 0, d)
            ];
        case 'yellow':  // mandrake: a tapering root with a face and a tuft of leaves
            return [
                L('leaf_m', 'circle', 50, 24, 0.22, 0.52, 0, g),
                oval('leaf_l', 35, 29, 12, 5.5, 50, g),
                oval('leaf_r', 65, 29, 12, 5.5, -50, g),
                L('root', 'triangle', 50, 62, 0.8, 0.94, 180, g),
                L('eye_l', 'circle', 43, 51, 0.13, 0.13, 0, d),
                L('eye_r', 'circle', 57, 51, 0.13, 0.13, 0, d)
            ];
        case 'purple':  // ghost's breath: a little ghost with a scalloped hem
            return [
                L('body', 'arch', 50, 50, 1.04, 1.16, 0, g),
                L('hem_a', 'circle', 32.5, 79, 0.3, 0.3, 0, d),
                L('hem_b', 'circle', 50, 79, 0.3, 0.3, 0, d),
                L('hem_c', 'circle', 67.5, 79, 0.3, 0.3, 0, d),
                L('eye_l', 'circle', 41, 45, 0.2, 0.28, 0, d),
                L('eye_r', 'circle', 59, 45, 0.2, 0.28, 0, d)
            ];
        case 'herb':    // fool's herb: a curling sprig with three leaves and a bud
            return [
                bar('stem', 50, 86, 50, 36, 7, g),
                oval('leaf_l', 35, 60, 15, 7, 35, g),
                oval('leaf_r', 65, 50, 15, 7, -35, g),
                oval('leaf_t', 50, 26, 7, 13, 0, g),
                L('bud', 'circle', 50, 26, 0.16, 0.16, 0, d)
            ];
        default:        // hawkmoth: four angular wings around a slim body
            return [
                path('wing_ul', 'M50 47 L16 24 L23 56 Z', g),
                path('wing_ur', 'M50 47 L84 24 L77 56 Z', g),
                path('wing_ll', 'M50 51 L27 60 L37 79 Z', g),
                path('wing_lr', 'M50 51 L73 60 L63 79 Z', g),
                L('body', 'circle', 50, 50, 0.2, 0.92, 0, g),
                L('mark', 'circle', 50, 41, 0.1, 0.1, 0, d)
            ];
    }
}

/** A hairline rim so the cream chip still reads on a white card. */
const rim = (color: ChipColor): IconLayer[] => (color === 'white'
    ? [L('rim', 'circle', 50, 50, 1.84, 1.84, 0, 'none', { stroke: '#d8cfbf', strokeWidth: 3 })]
    : []);

export const chipIconId = (color: ChipColor): string => `chip_${color}`;
export const pipIconId = (color: ChipColor, value: number): string => `pip_${color}_${value}`;

const PIP_LAYOUT: Record<number, Array<[number, number]>> = {
    1: [[50, 50]],
    2: [[36, 36], [64, 64]],
    3: [[32, 32], [50, 50], [68, 68]],
    6: [[36, 28], [64, 28], [36, 50], [64, 50], [36, 72], [64, 72]],
    4: [[35, 35], [65, 35], [35, 65], [65, 65]]
};

function chipIcons(): Record<string, IconObject> {
    const out: Record<string, IconObject> = {};
    for (const color of CHIP_COLORS) {
        out[chipIconId(color)] = coinIcon(chipIconId(color), CHIP_HEX[color],
            [...rim(color), ...inset(ingredientGlyph(color), 0.82)]);
        // the bare glyph, for places that supply their own coloured ground
        out[`glyph_${color}`] = icon(`glyph_${color}`, ingredientGlyph(color));
        chipValues(color, true).forEach((v) => {
            const size = v === 1 ? 0.5 : v === 4 ? 0.36 : v === 6 ? 0.3 : 0.38;
            out[pipIconId(color, v)] = coinIcon(pipIconId(color, v), CHIP_HEX[color], [
                ...rim(color),
                ...PIP_LAYOUT[v].map(([x, y], i) => L(`pip${i}`, 'circle', x, y, size, size, 0, CHIP_GLYPH[color]))
            ]);
        });
    }
    return out;
}

// ---------------------------------------------------------------------------
// Currency, markers and tools
// ---------------------------------------------------------------------------

const RUBY: IconObject = icon('ruby', [
    path('gem', 'M50 6 L88 38 L50 94 L12 38 Z', RUBY_HEX),
    path('crown', 'M50 6 L88 38 L12 38 Z', '#ff7fae'),
    path('table', 'M50 6 L66 38 L34 38 Z', '#ffc2d8'),
    path('keel', 'M34 38 L66 38 L50 94 Z', '#f5488a')
]);

const COIN: IconObject = icon('coin', [
    L('disc', 'circle', 50, 50, 1.9, 1.9, 0, COIN_HEX),
    L('ring', 'circle', 50, 50, 1.44, 1.44, 0, '#ffdd7a'),
    L('mark', 'rectangle', 50, 50, 0.42, 0.42, 45, COIN_HEX)
]);

const VP: IconObject = icon('vp', [
    path('star', burst(50, 53, 47, 20, 5), VP_HEX),
    L('core', 'circle', 50, 53, 0.34, 0.34, 0, '#b9b0ff')
]);

const DROPLET: IconObject = icon('droplet', [
    path('drop', 'M50 6 C50 6 18 44 18 64 C18 81.7 32.3 96 50 96 C67.7 96 82 81.7 82 64 C82 44 50 6 50 6 Z', DROPLET_HEX),
    oval('shine', 37, 64, 10, 5, 70, '#9af0e4')
]);

const RAT: IconObject = icon('rat', [
    L('ear_l', 'circle', 27, 32, 0.6, 0.6, 0, RAT_HEX),
    L('ear_r', 'circle', 73, 32, 0.6, 0.6, 0, RAT_HEX),
    L('in_l', 'circle', 27, 32, 0.32, 0.32, 0, '#f6a9c4'),
    L('in_r', 'circle', 73, 32, 0.32, 0.32, 0, '#f6a9c4'),
    L('head', 'circle', 50, 58, 1.36, 1.3, 0, RAT_HEX),
    L('eye_l', 'circle', 39, 54, 0.16, 0.16, 0, '#ffffff'),
    L('eye_r', 'circle', 61, 54, 0.16, 0.16, 0, '#ffffff'),
    L('nose', 'circle', 50, 72, 0.22, 0.18, 0, '#f6a9c4')
]);

const TAIL: IconObject = icon('tail', [
    path('curl', 'M16 74 C36 96 78 84 72 54 C68 34 38 38 44 56 C47 64 58 62 57 55', 'none',
        { stroke: '#f08fb4', strokeWidth: 10 })
]);

const FLASK_BODY = 'M40 12 L60 12 L60 40 L84 80 Q88 92 76 92 L24 92 Q12 92 16 80 L40 40 Z';
const FLASK: IconObject = icon('flask', [
    path('glass', FLASK_BODY, '#dfe7f5'),
    path('potion', 'M32 58 L68 58 L82 80 Q86 90 76 90 L24 90 Q14 90 18 80 Z', '#e85bb7'),
    L('bubble', 'circle', 44, 74, 0.16, 0.16, 0, '#ffc4ea'),
    L('lip', 'rectangle', 50, 12, 0.56, 0.12, 0, INK)
]);
const FLASK_EMPTY: IconObject = icon('flask_empty', [
    path('glass', FLASK_BODY, '#e4e2ec'),
    L('lip', 'rectangle', 50, 12, 0.56, 0.12, 0, '#a7a2bb')
]);

const BAG: IconObject = icon('bag', [
    path('ruffle', 'M30 34 L22 12 L50 22 L78 12 L70 34 Z', '#b98152'),
    L('sack', 'circle', 50, 62, 1.44, 1.2, 0, '#b98152'),
    L('tie', 'rectangle', 50, 35, 0.82, 0.12, 0, '#7a4a25'),
    path('star', burst(50, 64, 15, 6, 4), '#ffd98a')
]);

const BOOM: IconObject = icon('boom', [
    path('outer', burst(50, 50, 48, 28, 9), BOOM_HEX),
    path('inner', burst(50, 50, 28, 15, 9, Math.PI / 9), '#ffd447')
]);

const DIE_BODY = 'M24 10 H76 Q90 10 90 24 V76 Q90 90 76 90 H24 Q10 90 10 76 V24 Q10 10 24 10 Z';
const DIE: IconObject = icon('die', [
    path('body', DIE_BODY, VP_HEX),
    L('p1', 'circle', 32, 32, 0.3, 0.3),
    L('p2', 'circle', 50, 50, 0.3, 0.3),
    L('p3', 'circle', 68, 68, 0.3, 0.3)
]);

const MOON: IconObject = icon('moon', [
    path('crescent', 'M64 8 A44 44 0 1 0 92 62 A34 34 0 1 1 64 8 Z', '#ffd447'),
    path('star_a', burst(74, 30, 11, 4, 4), '#ffd447'),
    path('star_b', burst(86, 46, 6, 2.4, 4), '#ffd447')
]);

const SHIELD: IconObject = icon('shield', [
    path('body', 'M50 6 L86 20 V48 C86 72 68 88 50 94 C32 88 14 72 14 48 V20 Z', CHIP_HEX.blue),
    path('half', 'M50 6 L86 20 V48 C86 72 68 88 50 94 Z', '#6fb8f7')
]);

const SPOON: IconObject = icon('spoon', [
    L('handle', 'rectangle', 50, 66, 0.16, 1.08, 0, '#d8a65a'),
    L('bowl', 'circle', 50, 30, 0.92, 1.08, 0, '#d8a65a'),
    L('dip', 'circle', 50, 31, 0.56, 0.72, 0, '#f4d596')
]);

/** The cauldron — the game's emblem, the fortune deck back and the lobby mark. */
const CAULDRON: IconObject = icon('cauldron', [
    L('bub_a', 'circle', 36, 24, 0.36, 0.36, 0, CHIP_HEX.green),
    L('bub_b', 'circle', 57, 14, 0.24, 0.24, 0, CHIP_HEX.purple),
    L('bub_c', 'circle', 68, 28, 0.28, 0.28, 0, CHIP_HEX.red),
    L('brew', 'circle', 50, 42, 1.44, 0.4, 0, CHIP_HEX.green),
    L('leg_l', 'rectangle', 30, 88, 0.14, 0.2, 0, INK),
    L('leg_r', 'rectangle', 70, 88, 0.14, 0.2, 0, INK),
    L('pot', 'semi-circle', 50, 44, 1.6, 1.6, 180, INK),
    L('rim', 'rectangle', 50, 44, 1.76, 0.14, 0, '#5d5680')
]);

const CRYSTAL: IconObject = icon('crystal', [
    L('base', 'semi-circle', 50, 92, 1.24, 0.72, 0, INK),
    L('ball', 'circle', 50, 44, 1.5, 1.5, 0, '#c9a8fb'),
    oval('glow', 38, 34, 12, 7, -50, '#efe3ff'),
    path('star', burst(56, 50, 15, 6, 4), '#ffffff')
]);

// ---------------------------------------------------------------------------
// Herb witches: a pointed hat on a metal penny
// ---------------------------------------------------------------------------

const witchIconId = (metal: Metal): string => `witch_${metal}`;

function witchIcon(metal: Metal): IconObject {
    return coinIcon(witchIconId(metal), METAL_HEX[metal], inset([
        path('cone', 'M30 72 L54 14 Q62 10 64 20 L72 72 Z', INK),
        path('tip', 'M54 14 Q66 4 76 14 Q66 12 60 22 Z', INK),
        L('brim', 'circle', 50, 74, 1.5, 0.3, 0, INK),
        L('band', 'rectangle', 51, 62, 0.82, 0.14, 0, '#ffffff'),
        path('star', burst(51, 40, 8, 3.2, 4), '#ffffff')
    ], 0.8));
}

/** The alchemist's flask: a round-bottomed alembic with a swirl of essence. */
export const ESSENCE_HEX = '#d1495b';
const ALEMBIC: IconObject = icon('alembic', [
    L('neck', 'rectangle', 50, 22, 0.36, 0.5, 0, '#dfe7f5'),
    L('lip', 'rectangle', 50, 9, 0.5, 0.1, 0, INK),
    L('bulb', 'circle', 50, 62, 1.44, 1.44, 0, '#dfe7f5'),
    L('essence', 'circle', 50, 66, 1.16, 1.16, 0, ESSENCE_HEX),
    path('swirl', 'M36 66 C36 52 64 52 62 66 C60 76 46 74 48 66', 'none', { stroke: '#ffd0d6', strokeWidth: 5 }),
    L('shine', 'circle', 36, 54, 0.14, 0.14, 0, '#ffffff')
]);

const WITCH_ICONS: Record<string, IconObject> = {
    alembic: ALEMBIC,
    witch_silver: witchIcon('silver'),
    witch_bronze: witchIcon('bronze'),
    witch_gold: witchIcon('gold')
};

export { witchIconId };

// ---------------------------------------------------------------------------
// Icon registry
// ---------------------------------------------------------------------------

export const QUACKS_ICONS: Record<string, IconObject> = {
    ...chipIcons(),
    ruby: RUBY, coin: COIN, vp: VP, droplet: DROPLET, rat: RAT, tail: TAIL,
    flask: FLASK, flask_empty: FLASK_EMPTY, bag: BAG, boom: BOOM, die: DIE, moon: MOON,
    shield: SHIELD, spoon: SPOON, cauldron: CAULDRON, crystal: CRYSTAL,
    ...WITCH_ICONS
};

export function getIcon(id: string): IconObject | undefined {
    return QUACKS_ICONS[id];
}

// ---------------------------------------------------------------------------
// Bonus die (dice-roller faces)
// ---------------------------------------------------------------------------

const face = (id: DieFace, iconId: string, label: string | undefined, color: string): DiceFaceset[string] =>
    ({ id, icon: label ? undefined : QUACKS_ICONS[iconId], label, color, glyphColor: '#ffffff' });

export const QUACKS_DIE_FACES: DiceFaceset = {
    vp1: face('vp1', 'vp', '+1', VP_HEX),
    vp2: face('vp2', 'vp', '+2', VP_HEX),
    ruby: face('ruby', 'ruby', undefined, RUBY_HEX),
    droplet: face('droplet', 'droplet', undefined, DROPLET_HEX),
    pumpkin: face('pumpkin', 'glyph_orange', undefined, CHIP_HEX.orange)
};

export const QUACKS_DIE_THEME: DiceTheme = { style: 'iso', size: 40, glyphScale: 0.62 };

// ---------------------------------------------------------------------------
// Card builders
// ---------------------------------------------------------------------------

export const CARD_W_MM = 63.5;
export const CARD_H_MM = 88.9;

/**
 * An ingredient book.
 *
 *   ┌──────────────────────────┐
 *   │        TOADSTOOL         │  colour band: name + when it fires
 *   │        when drawn        │
 *   │           (◉)            │  the chip itself
 *   │   (•)6   (••)10  (::)16  │  pips = chip value, gold disc = price
 *   │  rule text with inline   │  tinted rule panel
 *   │         icons            │
 *   └──────────────────────────┘
 */
export function getBookCardDefinition(book: Book): CardDefinition {
    const color = book.color;
    const bandText = color === 'yellow' ? '#5a3c00' : '#ffffff';
    const values = Object.keys(book.costs).map(Number).sort((a, b) => a - b);
    return {
        id: `book-${color}-${book.set ?? 'x'}${book.variant ? `-${book.variant}` : ''}`,
        name: INGREDIENT_NAME[color],
        widthMm: CARD_W_MM,
        heightMm: CARD_H_MM,
        borderRadiusMm: 4,
        palette: bandPalette(`book-${color}`, CHIP_HEX[color], bandText, CHIP_TINT[color]),
        borderWidth: 0,
        header: {
            title: INGREDIENT_NAME[color],
            subtitle: TRIGGER_LABEL[book.trigger],
            background: 'primary'
        },
        mainArt: { iconId: chipIconId(color), frameStyle: 'none' },
        data: {
            background: 'none',
            rows: [{
                iconsList: values.map(v => ({ iconId: pipIconId(color, v), value: String(book.costs[v]) })),
                iconsListBg: 'none',
                iconsListAlign: 'center',
                iconsListGap: 0.6
            }]
        },
        footer: {
            text: book.text,
            align: 'center',
            verticalAlign: 'center',
            background: CHIP_TINT[color],
            color: INK,
            italic: false,
            weight: 600,
            size: 1.72
        }
    };
}

/** A fortune-teller card: purple band = resolve now, blue band = lasts the round. */
export function getFortuneCardDefinition(card: FortuneCard): CardDefinition {
    const now = card.kind === 'now';
    return {
        id: `fortune-${card.id}`,
        name: card.name,
        widthMm: CARD_W_MM,
        heightMm: CARD_H_MM,
        borderRadiusMm: 4,
        palette: bandPalette(`fortune-${card.kind}`, now ? FORTUNE_NOW_HEX : FORTUNE_ROUND_HEX, '#ffffff',
            now ? CHIP_TINT.purple : CHIP_TINT.blue),
        borderWidth: 0,
        backIconId: 'crystal',
        backBgColor: INK,
        header: {
            title: card.name,
            subtitle: now ? 'resolve now' : 'all this round',
            background: 'primary'
        },
        mainArt: { iconId: card.art, frameStyle: 'none' },
        footer: {
            text: card.text,
            align: 'center',
            verticalAlign: 'center',
            background: now ? CHIP_TINT.purple : CHIP_TINT.blue,
            color: INK,
            italic: false,
            weight: 600,
            size: 1.7
        }
    };
}

/** A herb witch: metal band, her name and moment, the hat, and what she does. */
export function getWitchCardDefinition(witch: Witch): CardDefinition {
    return {
        id: `witch-${witch.id}`,
        name: witch.name,
        widthMm: CARD_W_MM,
        heightMm: CARD_H_MM,
        borderRadiusMm: 4,
        palette: bandPalette(`witch-${witch.metal}`, METAL_HEX[witch.metal],
            witch.metal === 'gold' ? '#4a3405' : '#ffffff', METAL_TINT[witch.metal]),
        borderWidth: 0,
        header: { title: witch.name, subtitle: witch.when, background: 'primary' },
        mainArt: { iconId: witchIconId(witch.metal), frameStyle: 'none' },
        footer: {
            text: witch.text,
            align: 'center',
            verticalAlign: 'center',
            background: METAL_TINT[witch.metal],
            color: INK,
            italic: false,
            weight: 600,
            size: 1.7
        }
    };
}

/** A patient chart (The Alchemists): crimson band, the ailment, its art, and what the essence does. */
export function getPatientCardDefinition(patient: Patient): CardDefinition {
    return {
        id: `patient-${patient.id}`,
        name: patient.name,
        widthMm: CARD_W_MM,
        heightMm: CARD_H_MM,
        borderRadiusMm: 4,
        palette: bandPalette('patient', ESSENCE_HEX, '#ffffff', '#fde8ea'),
        borderWidth: 0,
        header: { title: patient.name, subtitle: 'patient', background: 'primary' },
        mainArt: { iconId: patient.art, frameStyle: 'none' },
        footer: {
            text: patient.text,
            align: 'center',
            verticalAlign: 'center',
            background: '#fde8ea',
            color: INK,
            italic: false,
            weight: 600,
            size: 1.7
        }
    };
}
