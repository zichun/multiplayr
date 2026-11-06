/**
 * ParksAssets.ts — iconography, the 48 park compositions and every card builder.
 *
 * Icon rule of thumb: tokens are solid discs with a white glyph knocked out, so
 * the same coin works on a card, a trail tile and a player panel. Cards use the
 * card-renderer's regions, positioned in percentages by `parks.scss`.
 */

import { CardDefinition, Palette, IconObject, IconLayer, DataRow } from '../../client/lib/card-renderer/types';
import { coinIcon } from '../../client/lib/card-renderer/presets';
import {
    Token, Sym, TOKENS, SYMS, Bag, ParkCard, PARK_CARDS, GearCard, GearType, SiteId,
    SeasonCard, YearCard, CanteenEffect, SITES, Need, NfAction, NIGHTFALL_PARK_CARDS
} from './ParksData';
import * as S from './ParksScenes';
import { ScenePalette, SCENE_PALETTES as SP, poly, oval, box, shape, flat } from './ParksScenes';

const icon = (id: string, layers: IconLayer[]): IconObject => ({ id, name: id, layers });

const WHITE = '#ffffff';
export const INK = '#2e3b36';
export const PAPER = '#fbf7ee';
export const MUTED = '#7f8a82';

// ===========================================================================
// Token coins
// ===========================================================================

export const TOKEN_HEX: Record<Token, string> = {
    FOREST: '#4c9a6e',
    MOUNTAIN: '#7d7398',
    SUNSHINE: '#eda92c',
    WATER: '#46a6d3',
    WILDLIFE: '#d8674f'
};

const COIN_FOREST = coinIcon('tok_forest', TOKEN_HEX.FOREST, [
    poly([50, 16, 66, 42, 58, 42, 72, 62, 56, 62, 56, 82, 44, 82, 44, 62, 28, 62, 42, 42, 34, 42], WHITE)
]);

const COIN_MOUNTAIN = coinIcon('tok_mountain', TOKEN_HEX.MOUNTAIN, [
    poly([14, 74, 42, 24, 56, 48, 64, 36, 86, 74], WHITE),
    poly([42, 24, 50, 38, 44, 44, 40, 38, 34, 42], TOKEN_HEX.MOUNTAIN)
]);

const sunRays = (cx: number, cy: number, r0: number, r1: number, w: number, fill: string): IconLayer[] => {
    const out: IconLayer[] = [];
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const ca = Math.cos(a), sa = Math.sin(a);
        const f = (v: number) => +v.toFixed(2);
        out.push(poly([
            f(cx + ca * r0 - sa * w), f(cy + sa * r0 + ca * w),
            f(cx + ca * r1), f(cy + sa * r1),
            f(cx + ca * r0 + sa * w), f(cy + sa * r0 - ca * w)
        ], fill));
    }
    return out;
};

const COIN_SUNSHINE = coinIcon('tok_sunshine', TOKEN_HEX.SUNSHINE, [
    oval(50, 50, 16, 16, WHITE),
    ...sunRays(50, 50, 21, 34, 5, WHITE)
]);

const DROP = 'M 50 14 C 58 30 74 44 74 60 A 24 24 0 0 1 26 60 C 26 44 42 30 50 14 Z';
const COIN_WATER = coinIcon('tok_water', TOKEN_HEX.WATER, [
    shape(DROP, WHITE),
    shape('M 38 60 A 12 12 0 0 0 48 72 L 46 76 A 17 17 0 0 1 33 60 Z', TOKEN_HEX.WATER)
]);

const PAW: IconLayer[] = [
    oval(50, 62, 18, 15, WHITE),
    oval(27, 46, 7.4, 10, WHITE),
    oval(42, 32, 7.4, 10.4, WHITE),
    oval(58, 32, 7.4, 10.4, WHITE),
    oval(73, 46, 7.4, 10, WHITE)
];
const COIN_WILDLIFE = coinIcon('tok_wildlife', TOKEN_HEX.WILDLIFE, PAW);

export const tokenIconId = (t: Token): string => `tok_${t.toLowerCase()}`;

/** A printed cost icon already paid for by a discount: hollow, so it reads as gone. */
const ghostCoin = (s: Sym): IconObject => icon(`ghost_${s.toLowerCase()}`, [
    oval(50, 50, 44, 44, '#d9d6cb'),
    oval(50, 50, 33, 33, PAPER)
]);
export const ghostIconId = (s: Sym): string => `ghost_${s.toLowerCase()}`;

/** The "any token" square; the digit is drawn by whatever hosts it. */
const ANY_TOKEN = icon('tok_any', [
    shape('M 18 10 L 82 10 Q 92 10 92 20 L 92 80 Q 92 90 82 90 L 18 90 Q 8 90 8 80 L 8 20 Q 8 10 18 10 Z', '#8f6a4c'),
    poly([50, 26, 74, 50, 50, 74, 26, 50], WHITE)
]);

// ===========================================================================
// Table pieces
// ===========================================================================

/** Ranger: a figure in forest green, wearing the flat-brimmed hat. */
const RANGER_PAWN = icon('ranger', [
    oval(50, 26, 14, 14, '#2c5a44'),
    shape('M 50 42 C 70 42 76 62 80 92 L 20 92 C 24 62 30 42 50 42 Z', '#2c5a44'),
    box(22, 14, 56, 5, '#c7a35b'),
    poly([38, 14, 50, 2, 62, 14], '#c7a35b')
]);

const CAMPFIRE_LOGS: IconLayer[] = [
    poly([20, 78, 76, 66, 80, 74, 24, 86], '#7a5540'),
    poly([80, 78, 24, 66, 20, 74, 76, 86], '#94684e')
];
const CAMPFIRE_LIT = icon('campfire', [
    shape('M 50 8 C 54 26 72 34 72 52 A 22 22 0 0 1 28 52 C 28 42 34 36 38 30 C 40 38 44 40 46 40 C 44 28 46 18 50 8 Z', '#ea7b3f'),
    shape('M 50 34 C 54 42 62 46 62 56 A 12 12 0 0 1 38 56 C 38 48 46 44 50 34 Z', '#f8c64f'),
    ...CAMPFIRE_LOGS
]);
const CAMPFIRE_OUT = icon('campfire_out', [
    oval(40, 40, 8, 6, '#c8ccc6'),
    oval(54, 28, 10, 7, '#d7dad4'),
    oval(46, 14, 7, 5, '#e4e6e1'),
    ...CAMPFIRE_LOGS
]);

const CAMERA = icon('camera', [
    shape('M 16 30 L 34 30 L 40 20 L 60 20 L 66 30 L 84 30 Q 92 30 92 38 L 92 76 Q 92 84 84 84 L 16 84 Q 8 84 8 76 L 8 38 Q 8 30 16 30 Z', '#3c4a54'),
    oval(50, 56, 20, 20, WHITE),
    oval(50, 56, 13, 13, '#46a6d3'),
    oval(46, 52, 4, 4, WHITE),
    box(72, 38, 10, 6, '#f2c14e')
]);

/** A taken Photo: a white print with a little mountain view on it. */
const PHOTO = icon('photo', [
    box(10, 6, 80, 88, '#5c6a62'),
    box(16, 12, 68, 64, '#a9d6e6'),
    oval(66, 28, 8, 8, '#f7d26f'),
    poly([16, 76, 40, 36, 54, 56, 62, 46, 84, 76], '#4c9a6e'),
    box(16, 76, 68, 12, WHITE)
]);

/** First Hiker Marker: a trail flag on a cairn. */
const MARKER = icon('marker', [
    box(44, 8, 6, 68, '#5f4a3a'),
    poly([50, 10, 86, 24, 50, 38], '#d8674f'),
    oval(47, 80, 26, 10, '#a8a395'),
    oval(47, 70, 16, 8, '#c5c1b4')
]);

const CANTEEN_GLYPH = icon('canteen', [
    box(44, 8, 12, 12, '#6e5a48'),
    oval(50, 56, 37, 37, '#7b9a8c'),
    oval(50, 56, 28, 28, '#a7c2b5'),
    box(46, 18, 8, 6, '#54463a')
]);

/** Filled canteen: the same flask holding Water. */
const CANTEEN_FULL = icon('canteen_full', [
    box(44, 8, 12, 12, '#6e5a48'),
    oval(50, 56, 37, 37, '#7b9a8c'),
    oval(50, 56, 28, 28, TOKEN_HEX.WATER),
    shape('M 50 38 C 54 46 62 52 62 60 A 12 12 0 0 1 38 60 C 38 52 46 46 50 38 Z', WHITE),
    box(46, 18, 8, 6, '#54463a')
]);

const PARK_GLYPH = icon('park_glyph', [
    shape('M 18 8 L 82 8 Q 90 8 90 16 L 90 84 Q 90 92 82 92 L 18 92 Q 10 92 10 84 L 10 16 Q 10 8 18 8 Z', '#5b8a6f'),
    poly([20, 70, 42, 30, 54, 50, 62, 40, 80, 70], WHITE)
]);

/** Reserve: a Park with a bookmark held on it. */
const RESERVE_GLYPH = icon('reserve_glyph', [
    ...PARK_GLYPH.layers,
    poly([62, 0, 86, 0, 86, 40, 74, 30, 62, 40], '#d8882c')
]);

/** Visit: a Park with a tick, stamped done. */
const VISIT_GLYPH = icon('visit_glyph', [
    ...PARK_GLYPH.layers,
    oval(74, 26, 22, 22, '#eda92c'),
    poly([62, 26, 68, 20, 73, 25, 83, 14, 89, 20, 73, 38], WHITE)
]);

const GEAR_GLYPH = icon('gear_glyph', [
    shape('M 34 30 L 66 30 Q 80 30 80 44 L 80 84 Q 80 92 72 92 L 28 92 Q 20 92 20 84 L 20 44 Q 20 30 34 30 Z', '#c7804a'),
    shape('M 34 30 C 34 8 66 8 66 30 L 58 30 C 58 18 42 18 42 30 Z', '#9c5f34'),
    box(32, 56, 36, 7, WHITE)
]);

/** Arrow used inside effect rows: "this becomes that". */
const ARROW = icon('arrow', [poly([12, 42, 58, 42, 58, 24, 90, 50, 58, 76, 58, 58, 12, 58], '#5c6a62')]);
const OR_MARK = icon('or_mark', [poly([58, 14, 70, 14, 42, 86, 30, 86], '#7f8a82')]);
/** River: "the same again", two overlapping tiles. */
const COPY = icon('copy', [
    shape('M 14 10 L 60 10 Q 66 10 66 16 L 66 62 Q 66 68 60 68 L 14 68 Q 8 68 8 62 L 8 16 Q 8 10 14 10 Z', '#a8b3ac'),
    shape('M 40 32 L 86 32 Q 92 32 92 38 L 92 84 Q 92 90 86 90 L 40 90 Q 34 90 34 84 L 34 38 Q 34 32 40 32 Z', '#46a6d3')
]);
const BOLT = icon('bolt', [poly([58, 6, 22, 56, 46, 56, 38, 94, 78, 40, 54, 40], '#d8882c')]);

/** Nightfall's wooden Tent token: a gold disc with a pitched tent. */
const TENT_TOKEN = icon('tent', [
    oval(50, 50, 44, 44, '#f2b632'),
    oval(50, 50, 38, 38, '#f7c95a'),
    poly([50, 22, 78, 72, 22, 72], '#c98a22'),
    poly([50, 22, 60, 72, 40, 72], '#8f5f16'),
    poly([50, 44, 56, 72, 44, 72], '#f7c95a')
]);

const RIBBON_YEAR = icon('year_glyph', [
    oval(50, 40, 32, 32, '#8f6a4c'),
    oval(50, 40, 22, 22, PAPER),
    poly([32, 66, 26, 96, 50, 82, 74, 96, 68, 66], '#8f6a4c'),
    poly([50, 24, 55, 35, 67, 36, 58, 44, 61, 56, 50, 50, 39, 56, 42, 44, 33, 36, 45, 35], '#d8882c')
]);

// ===========================================================================
// Gear glyphs — one bold object per type, on the card's tinted ground
// ===========================================================================

const GEAR_GLYPHS: Record<GearType, IconLayer[]> = {
    JOURNAL: [
        shape('M 24 10 L 76 10 Q 82 10 82 16 L 82 90 L 24 90 Q 16 90 16 82 L 16 18 Q 16 10 24 10 Z', '#a0603f'),
        box(16, 78, 66, 12, '#f1e6cf'),
        box(26, 10, 6, 68, '#7f4a30'),
        poly([62, 10, 74, 10, 74, 40, 68, 34, 62, 40], '#e0a93f'),
        shape('M 46 60 C 40 44 48 32 60 26 C 62 42 58 54 46 60 Z', '#f1e6cf')
    ],
    TRAIL_MAP: [
        poly([10, 22, 38, 12, 62, 22, 90, 12, 90, 78, 62, 88, 38, 78, 10, 88], '#f3e6c6'),
        poly([38, 12, 62, 22, 62, 88, 38, 78], '#e0cfa6'),
        shape('M 20 70 L 30 56 L 42 62 L 54 44 L 66 50 L 76 30 L 78 32 L 67 54 L 55 48 L 43 66 L 31 60 L 22 72 Z', '#d8674f'),
        oval(76, 28, 7, 7, '#d8674f'),
        oval(76, 28, 3, 3, WHITE)
    ],
    COMPASS: [
        oval(50, 52, 40, 40, '#8a6a42'),
        oval(50, 52, 31, 31, '#f7efdc'),
        box(45, 4, 10, 10, '#8a6a42'),
        poly([50, 26, 58, 52, 42, 52], '#d8674f'),
        poly([50, 78, 58, 52, 42, 52], '#3c4a54'),
        oval(50, 52, 4, 4, WHITE)
    ],
    SUNSCREEN: [
        box(36, 6, 28, 16, '#d8674f'),
        shape('M 30 22 L 70 22 L 76 38 L 76 88 Q 76 94 70 94 L 30 94 Q 24 94 24 88 L 24 38 Z', '#fbf1d9'),
        oval(50, 58, 12, 12, TOKEN_HEX.SUNSHINE),
        ...sunRays(50, 58, 15, 22, 3, TOKEN_HEX.SUNSHINE)
    ],
    RAIN_GEAR: [
        shape('M 50 6 C 66 6 72 18 72 28 L 90 44 L 80 60 L 72 54 L 72 94 L 28 94 L 28 54 L 20 60 L 10 44 L 28 28 C 28 18 34 6 50 6 Z', '#e8b73a'),
        shape('M 50 14 C 60 14 64 22 64 30 L 36 30 C 36 22 40 14 50 14 Z', '#a87f1e'),
        box(48, 30, 4, 64, '#a87f1e'),
        oval(58, 46, 2.4, 2.4, '#a87f1e'),
        oval(58, 60, 2.4, 2.4, '#a87f1e'),
        oval(58, 74, 2.4, 2.4, '#a87f1e')
    ],
    BINOCULARS: [
        shape('M 16 40 L 28 18 L 44 18 L 46 40 L 46 84 Q 46 90 40 90 L 16 90 Q 10 90 10 84 L 10 50 Z', '#3c4a54'),
        shape('M 84 40 L 72 18 L 56 18 L 54 40 L 54 84 Q 54 90 60 90 L 84 90 Q 90 90 90 84 L 90 50 Z', '#4e5e6a'),
        box(44, 36, 12, 18, '#2a353d'),
        oval(28, 72, 11, 11, '#8fc6d6'),
        oval(72, 72, 11, 11, '#8fc6d6')
    ],
    WATER_FILTER: [
        box(40, 4, 20, 10, '#3c4a54'),
        poly([18, 14, 82, 14, 62, 50, 38, 50], '#d7ebf0'),
        poly([50, 14, 82, 14, 62, 50, 50, 50], '#b5d6df'),
        box(38, 50, 24, 12, '#3c4a54'),
        shape('M 50 66 C 54 74 62 78 62 86 A 12 12 0 0 1 38 86 C 38 78 46 74 50 66 Z', TOKEN_HEX.WATER)
    ],
    SLEEPING_BAG: [
        shape('M 16 44 A 34 34 0 0 1 84 44 L 84 76 A 34 18 0 0 1 16 76 Z', '#6c8fb2'),
        oval(50, 44, 34, 34, '#4d7096'),
        oval(50, 44, 24, 24, '#6c8fb2'),
        oval(50, 44, 14, 14, '#4d7096'),
        box(10, 62, 80, 8, '#e0a93f')
    ],
    WATER_BOTTLE: [
        shape('M 30 4 A 14 12 0 0 1 58 4 L 58 8 L 52 8 A 8 7 0 0 0 36 8 L 30 8 Z', '#3c4a54'),
        box(36, 8, 24, 12, '#3c4a54'),
        shape('M 30 20 L 66 20 Q 74 26 74 36 L 74 88 Q 74 96 66 96 L 30 96 Q 22 96 22 88 L 22 36 Q 22 26 30 20 Z', '#6fb6c7'),
        box(22, 48, 52, 26, '#d9eff2'),
        shape('M 48 50 C 51 56 56 58 56 63 A 8 8 0 0 1 40 63 C 40 58 45 56 48 50 Z', TOKEN_HEX.WATER)
    ],
    WIDE_ANGLE_LENS: [
        oval(50, 50, 44, 44, '#3c4a54'),
        oval(50, 50, 34, 34, '#2a353d'),
        oval(50, 50, 26, 26, '#46a6d3'),
        oval(50, 50, 16, 16, '#2b6f97'),
        shape('M 36 34 A 22 22 0 0 1 52 28 L 52 34 A 16 16 0 0 0 40 39 Z', WHITE)
    ],
    FLASHLIGHT: [
        poly([56, 38, 96, 12, 96, 68, 56, 52], '#fbe7a6'),
        box(8, 36, 34, 18, '#3c4a54'),
        poly([42, 36, 58, 28, 58, 62, 42, 54], '#4e5e6a'),
        box(22, 30, 10, 6, '#e0a93f')
    ],
    PARK_PASS: [
        shape('M 10 24 L 90 24 L 90 40 A 10 10 0 0 0 90 60 L 90 76 L 10 76 L 10 60 A 10 10 0 0 0 10 40 Z', '#4c9a6e'),
        box(28, 24, 2.6, 52, '#d8efe2'),
        poly([38, 66, 54, 38, 62, 50, 68, 44, 80, 66], WHITE)
    ],
    TENT: [
        poly([50, 12, 92, 84, 8, 84], '#d8674f'),
        poly([50, 12, 92, 84, 50, 84], '#b34f3a'),
        poly([50, 40, 66, 84, 34, 84], '#fbe7c6'),
        poly([50, 40, 58, 84, 50, 84], '#e7c999'),
        box(4, 84, 92, 5, '#7f5a42')
    ],
    // --- Wildlife expansion
    PLANNER: [
        box(12, 22, 76, 68, '#f7efdc'),
        box(12, 22, 76, 16, '#7f8a5a'),
        box(26, 12, 5, 18, '#4e5638'),
        box(69, 12, 5, 18, '#4e5638'),
        ...[0, 1, 2].reduce<IconLayer[]>((all, r) => all.concat([0, 1, 2, 3].map(c =>
            oval(25 + c * 16.5, 50 + r * 13, 5, 5, r === 0 && c < 2 ? '#5f6b3a' : '#ddd3bd'))), [])
    ],
    MYSTERY_CACHE: [
        box(14, 46, 72, 40, '#c99a5c'),
        box(14, 60, 72, 2.4, '#a87b45'),
        box(14, 73, 72, 2.4, '#a87b45'),
        poly([8, 48, 18, 30, 82, 30, 92, 48], '#deb878'),
        box(8, 44, 84, 5, '#a87b45'),
        box(45, 44, 10, 12, '#5f4a3a')
    ],
    UPGRADED_SHUTTER: [
        oval(50, 50, 44, 44, '#4e5c36'),
        oval(50, 50, 38, 38, '#a9bf78'),
        poly([50, 39, 59.5, 44.5, 82.6, 65.2, 56.3, 14.5], '#93aa62'),
        poly([59.5, 44.5, 59.5, 55.5, 53.1, 85.9, 83.8, 37.7], '#7d9450'),
        poly([59.5, 55.5, 50, 61, 20.5, 70.6, 77.6, 73.1], '#93aa62'),
        poly([50, 61, 40.5, 55.5, 17.4, 34.8, 43.7, 85.5], '#7d9450'),
        poly([40.5, 55.5, 40.5, 44.5, 46.9, 14.1, 16.2, 62.3], '#93aa62'),
        poly([40.5, 44.5, 50, 39, 79.5, 29.4, 22.4, 26.9], '#7d9450'),
        poly([50, 39, 59.5, 44.5, 59.5, 55.5, 50, 61, 40.5, 55.5, 40.5, 44.5], '#f4f7ea')
    ],
    FIELD_GUIDE: [
        box(18, 8, 66, 84, '#e8dcc0'),
        box(18, 8, 13, 84, '#5f6b3a'),
        box(40, 20, 34, 5, '#7a5236'),
        oval(58, 60, 11, 9.5, '#7a5236'),
        oval(46, 46, 3.6, 4.8, '#7a5236'),
        oval(53, 41, 3.6, 4.8, '#7a5236'),
        oval(62, 41, 3.6, 4.8, '#7a5236'),
        oval(70, 46, 3.6, 4.8, '#7a5236')
    ],
    FANNY_PACK: [
        box(2, 36, 96, 6, '#6b5f4a'),
        shape('M 22 34 L 78 34 Q 88 34 88 46 L 88 68 Q 88 82 74 82 L 26 82 Q 12 82 12 68 L 12 46 Q 12 34 22 34 Z', '#cdc6b2'),
        shape('M 20 54 L 80 54 L 80 66 Q 80 76 70 76 L 30 76 Q 20 76 20 66 Z', '#9e9782'),
        box(20, 46, 60, 2.4, '#6b5f4a'),
        box(43, 31, 14, 11, '#e0a93f')
    ],
    LANTERN: [
        shape('M 34 24 A 16 16 0 0 1 66 24 L 61 24 A 11 11 0 0 0 39 24 Z', '#4e5638'),
        poly([28, 32, 50, 18, 72, 32], '#5f6b3a'),
        box(32, 32, 36, 5, '#4e5638'),
        box(34, 37, 32, 38, '#fbe7a6'),
        shape('M 50 44 C 57 54 60 58 60 64 A 10 10 0 0 1 40 64 C 40 58 43 54 50 44 Z', '#f2a33a'),
        box(34, 37, 3.5, 38, '#4e5638'),
        box(62.5, 37, 3.5, 38, '#4e5638'),
        box(28, 75, 44, 9, '#5f6b3a')
    ],
    WATER_PAIL: [
        shape('M 12 42 C 12 4 88 4 88 42 L 83 42 C 83 12 17 12 17 42 Z', '#6b7a52'),
        poly([12, 42, 88, 42, 78, 90, 22, 90], '#dfe2d2'),
        poly([50, 42, 88, 42, 78, 90, 50, 90], '#c7cbb5'),
        box(9, 38, 82, 7, '#9aa07e'),
        box(24, 60, 52, 3, '#9aa07e')
    ],
    HIKING_POLES: [
        poly([12.4, 17.6, 84.4, 89.6, 87.6, 86.4, 15.6, 14.4], '#e9e4da'),
        poly([11.2, 18.8, 25.6, 33.2, 31.2, 27.6, 16.8, 13.2], '#5f6b3a'),
        poly([44.1, 50.7, 47.7, 54.3, 52.3, 49.7, 48.7, 46.1], '#5f6b3a'),
        poly([79.2, 83.3, 84.9, 89.1, 87.1, 86.9, 81.3, 81.2], '#3c4a54'),
        poly([84.4, 14.4, 12.4, 86.4, 15.6, 89.6, 87.6, 17.6], '#e9e4da'),
        poly([83.2, 13.2, 68.8, 27.6, 74.4, 33.2, 88.8, 18.8], '#5f6b3a'),
        poly([51.3, 46.1, 47.7, 49.7, 52.3, 54.3, 55.9, 50.7], '#5f6b3a'),
        poly([18.7, 81.2, 12.9, 86.9, 15.1, 89.1, 20.8, 83.3], '#3c4a54')
    ],
    CAMPING_MUG: [
        shape('M 34 28 C 27 20 39 15 33 6 L 37 6 C 43 15 31 20 38 28 Z', '#c9d7df'),
        shape('M 50 28 C 43 20 55 15 49 6 L 53 6 C 59 15 47 20 54 28 Z', '#c9d7df'),
        shape('M 66 28 C 59 20 71 15 65 6 L 69 6 C 75 15 63 20 70 28 Z', '#c9d7df'),
        shape('M 74 44 A 15 15 0 0 1 74 76 L 74 68 A 7 7 0 0 0 74 52 Z', '#ece6d8'),
        shape('M 20 34 L 76 34 L 76 82 Q 76 92 66 92 L 30 92 Q 20 92 20 82 Z', '#f6f2e8'),
        oval(48, 35, 28, 5.5, '#6b5f4a'),
        oval(34, 58, 1.8, 1.8, '#62b3d1'),
        oval(48, 64, 1.8, 1.8, '#d8a24a'),
        oval(62, 56, 1.8, 1.8, '#62b3d1')
    ]
};

const gearIconId = (type: GearType): string => `gearart_${type.toLowerCase()}`;

const GEAR_TINT: Record<GearType, string> = {
    JOURNAL: '#f3e8d6', TRAIL_MAP: '#e6f0e4', COMPASS: '#efe6d6', SUNSCREEN: '#dcedf4', RAIN_GEAR: '#e4eff4',
    BINOCULARS: '#e2eee8', WATER_FILTER: '#e0eef4', SLEEPING_BAG: '#e6ecf4', WATER_BOTTLE: '#deeff0',
    WIDE_ANGLE_LENS: '#e8eaf2', FLASHLIGHT: '#ecebe2', PARK_PASS: '#e4f1e6', TENT: '#f6e6dd',
    PLANNER: '#ece6dc', MYSTERY_CACHE: '#f6ead0', UPGRADED_SHUTTER: '#e7f0d6', FIELD_GUIDE: '#e1eef0', FANNY_PACK: '#f4ecd4',
    LANTERN: '#f6e1e1', WATER_PAIL: '#ddedf3', HIKING_POLES: '#ece8e0', CAMPING_MUG: '#ddedf3'
};

// ===========================================================================
// Trail Site tiles
// ===========================================================================

function siteScene(id: SiteId): IconLayer[] {
    switch (id) {
        case 'FOREST': {
            const P = SP.mist;
            return flat([S.sky(P), [S.hills(56, 8, P.far)], S.forestRow([12, 34, 56, 78, 96], 72, 40, P.mid, P.near, P.trunk),
                [S.hills(70, 4, P.ground, -1)], S.forestRow([24, 50, 76], 96, 44, P.leaf, P.leaf2, P.trunk)]);
        }
        case 'MOUNTAIN': {
            const P = SP.arctic;
            return flat([S.sky(P), S.peak(26, 74, 66, 44, P.far, P.mid, P.snow), S.peak(66, 80, 84, 66, P.mid, P.near, P.snow), [S.hills(78, 5, P.ground)]]);
        }
        case 'VALLEY': {
            const P = SP.autumn;
            return flat([S.sky(P), S.sun(P, 50, 34, 11), [S.ridge([-4, 44, 20, 58, 50, 72, 80, 56, 104, 42], P.far)],
                [S.ridge([-4, 58, 24, 72, 50, 82, 76, 70, 104, 56], P.mid)], [S.hills(84, 3, '#b9c26d')]]);
        }
        case 'OCEAN': {
            const P = SP.tropic;
            return flat([S.sky(P), S.sun(P, 72, 26, 9), S.cloud(P, 26, 28, 1.1, WHITE), S.waves(52, P.water, P.foam), S.waves(72, '#2f9db1', P.foam, 5)]);
        }
        case 'VISTA': {
            const P = SP.dusk;
            return flat([S.sky(P), S.sun(P, 62, 34, 10), S.peak(30, 70, 60, 34, P.far, P.mid), S.peak(78, 72, 56, 30, P.far, P.mid),
                [S.ridge([-4, 60, 26, 72, 54, 80, 54, 104, -4, 104], P.near), S.ridge([-4, 78, 40, 84, 70, 104], P.ground)]]);
        }
        case 'WATERFALL': {
            const P = SP.noon;
            return flat([S.sky(P), [box(-2, 18, 104, 90, P.rock2), box(-2, 18, 34, 90, P.rock)], S.falls(50, 18, 78, 26, P.water, P.foam),
                S.forestRow([12, 88], 82, 34, P.leaf, P.leaf2, P.trunk), S.lake(80, P.water, P.foam, [[12, 8, 14], [70, 12, 16]])]);
        }
        case 'WILDLIFE': {
            const P = SP.autumn;
            return flat([S.sky(P), [S.hills(62, 8, P.far)], [S.hills(74, 4, P.near, -1)],
                [oval(50, 58, 25, 25, '#d8674f'), oval(50, 66, 11, 9, WHITE), oval(36, 54, 4, 5.4, WHITE), oval(45, 47, 4, 5.6, WHITE), oval(55, 47, 4, 5.6, WHITE), oval(64, 54, 4, 5.4, WHITE)]]);
        }
        case 'LODGE': {
            const P = SP.dawn;
            return flat([S.sky(P), S.peak(50, 66, 90, 38, P.far, P.mid, P.snow), [S.hills(66, 3, P.near)],
                [poly([18, 58, 50, 30, 82, 58], '#6a4a3a'), box(24, 56, 52, 30, '#a0704f'), box(50, 56, 26, 30, '#8a5e42'), box(44, 66, 12, 20, '#46362c'),
                    box(28, 64, 10, 9, '#f8d67a'), box(62, 64, 10, 9, '#f8d67a'), box(66, 34, 7, 14, '#574036')], [S.hills(86, 2, P.ground)]]);
        }
        case 'LOOKOUT': {
            const P = SP.noon;
            return flat([S.sky(P), S.cloud(P, 28, 22, 0.9, WHITE), [S.ridge([-4, 66, 30, 54, 62, 66, 104, 52], P.far)], [S.hills(76, 5, P.near)],
                [box(38, 28, 24, 12, '#7f5a42'), poly([32, 28, 50, 12, 68, 28], '#a0603f'), box(42, 40, 4, 50, '#5f4a3a'), box(54, 40, 4, 50, '#5f4a3a'),
                    poly([46, 56, 54, 56, 58, 62, 42, 62], '#5f4a3a'), box(38, 39, 24, 3, '#5f4a3a')]]);
        }
        case 'RIVER': {
            const P = SP.mist;
            return flat([S.sky(P), [S.hills(46, 6, P.far), S.hills(54, 5, P.near, -1)], S.river(58, 50, 8, 16, P.water, P.foam),
                S.forestRow([12, 84], 72, 28, P.leaf, P.leaf2, P.trunk)]);
        }
        // --- Wildlife expansion
        case 'LAKE': {
            const P = SP.autumn;
            return flat([S.sky(P), [S.hills(40, 5, P.far)], S.broadleafRow([6, 24, 44, 64, 86], 54, 28, P.leaf, P.leaf2, P.trunk),
                S.lake(54, P.water, P.foam, [[10, 8, 18], [62, 18, 24]]),
                [poly([42, 76, 62, 72, 60, 77, 44, 79], '#d8674f'), box(51, 67, 1.6, 16, '#3c4a54'), oval(52, 73, 2.6, 2.6, '#f2c94c')]]);
        }
        case 'PARKWAY': {
            const P = SP.noon;
            return flat([S.sky(P), S.cloud(P, 30, 20, 1.3, WHITE), S.cloud(P, 76, 28, 0.9, WHITE), [S.ridge([-4, 52, 28, 42, 60, 50, 104, 40], P.far)],
                [box(18, 62, 4, 40, '#bdb6aa'), box(48, 56, 4, 46, '#bdb6aa'), box(78, 62, 4, 40, '#bdb6aa'),
                    shape('M -4 60 Q 50 46 104 62 L 104 69 Q 50 53 -4 67 Z', '#ece7dd'), shape('M -4 60 Q 50 46 104 62 L 104 63 Q 50 47 -4 61 Z', '#d8674f')],
                S.broadleafRow([6, 30, 70, 94], 96, 26, SP.autumn.leaf, SP.autumn.leaf2, SP.autumn.trunk)]);
        }
        case 'SUMMIT': {
            const P = SP.mist;
            return flat([S.sky(P), [S.hills(44, 8, P.far), S.hills(54, 6, P.mid, -1)], S.cloud(P, 26, 58, 1.4, WHITE),
                [poly([30, 104, 40, 76, 82, 72, 96, 104], '#8a5a46'), poly([62, 73, 82, 72, 96, 104, 70, 104], '#6e4636'),
                    box(58, 50, 7, 18, '#d8674f'), oval(61.5, 46, 3.4, 3.4, '#3c3c4a'), box(58.5, 67, 2.6, 7, '#3c4a54'), box(62, 67, 2.6, 7, '#3c4a54'),
                    box(70, 59, 5, 11, '#d8674f'), oval(72.5, 56, 2.6, 2.6, '#3c3c4a'), box(70.4, 69, 1.8, 5, '#3c4a54'), box(72.8, 69, 1.8, 5, '#3c4a54')],
                S.pine(14, 90, 34, P.leaf, P.leaf2, P.trunk)]);
        }
        case 'CANYON': {
            const P = SP.redrock;
            // Horseshoe Bend: the river loops round a rock tongue, seen from the rim
            return flat([S.sky(P), S.canyon(P, 60, 22, 78),
                [shape('M 22 60 C 20 104 80 104 78 60 L 68 60 C 70 92 30 92 32 60 Z', P.water),
                    poly([32, 60, 68, 60, 64, 80, 50, 86, 36, 80], P.rock), poly([50, 60, 68, 60, 64, 80, 50, 86], P.rock2)]]);
        }
    }
}

export const siteIconId = (id: SiteId): string => `site_${id.toLowerCase()}`;

const SITE_IDS: SiteId[] = ['FOREST', 'MOUNTAIN', 'VALLEY', 'OCEAN', 'VISTA', 'WATERFALL', 'WILDLIFE', 'LODGE', 'LOOKOUT', 'RIVER', 'LAKE', 'PARKWAY', 'SUMMIT', 'CANYON'];

const TRAILHEAD = (() => {
    const P = SP.noon;
    return flat([S.sky(P), [S.hills(60, 6, P.far), S.hills(74, 4, P.near, -1)], S.forestRow([14, 88], 74, 30, P.leaf, P.leaf2, P.trunk),
        [box(46, 34, 4, 50, '#7f5a42'), poly([28, 38, 70, 38, 78, 46, 70, 54, 28, 54], '#a0603f'), box(34, 44, 30, 3, PAPER)]]);
})();

// ===========================================================================
// Park scenes — one recipe per park. Palette first, then the stack back-to-front.
// ===========================================================================

type Recipe = [string, (P: ScenePalette) => IconLayer[][]];

const PARK_RECIPES: Record<string, Recipe> = {
    // --- forests & woods
    congaree: ['mist', P => [S.sky(P), [S.hills(52, 4, P.far)], S.broadleafRow([10, 30, 52, 74, 92], 72, 44, P.mid, P.near, P.trunk),
        S.lake(70, P.water, P.foam, [[8, 6, 18], [62, 12, 22]]), S.reeds([8, 16, 24, 80, 88], 92, 22, P.leaf2, P.trunk), S.lilies([[46, 88, 7], [62, 80, 5]], P.leaf, '#f2c9d6')]],
    olympic: ['mist', P => [S.sky(P, 40), S.peak(70, 50, 70, 34, P.far, P.mid, P.snow), S.forestRow([6, 26, 46, 66, 86], 78, 62, P.mid, P.near, P.trunk, 4, 0.34),
        [S.hills(78, 3, P.ground)], S.forestRow([16, 58, 94], 100, 60, P.leaf, P.leaf2, P.trunk, 4, 0.36)]],
    sequoia: ['autumn', P => [S.sky(P), S.sun(P, 76, 22, 8), [S.hills(64, 6, '#b9c26d')], S.sequoia(26, 90, 80, 11, '#5f9270', '#40745a', '#a8583a', '#86432d'),
        S.sequoia(72, 94, 92, 15, '#5f9270', '#40745a', '#b8623f', '#924a30'), [S.hills(90, 3, '#6f8a50')]]],
    yosemite_forest: ['noon', P => [S.sky(P), S.dome(50, 62, 66, 40, P.rock, P.rock2), S.forestRow([8, 26, 74, 92], 74, 38, P.mid, P.near, P.trunk, 3, 0.38),
        S.lake(72, P.water, P.foam, [[20, 6, 16], [60, 10, 22]]), S.forestRow([4, 96], 100, 50, P.leaf, P.leaf2, P.trunk, 4, 0.4)]],
    great_smoky_mountains: ['mist', P => [S.sky(P, 46), [S.ridge([-4, 40, 18, 32, 38, 42, 60, 30, 80, 38, 104, 28], P.far)], S.cloud(P, 30, 46, 1.6, P.sky2),
        [S.ridge([-4, 56, 24, 46, 46, 56, 70, 44, 104, 54], P.mid)], S.cloud(P, 72, 58, 1.4, P.sky2), [S.ridge([-4, 72, 30, 62, 62, 74, 104, 64], P.near)],
        S.forestRow([12, 32, 54, 76, 94], 100, 30, P.leaf, P.leaf2, P.trunk)]],
    shenandoah: ['autumn', P => [S.sky(P), S.sun(P, 24, 26, 8), [S.ridge([-4, 48, 22, 40, 48, 52, 74, 38, 104, 50], P.far)], [S.hills(62, 6, P.mid)],
        S.broadleafRow([12, 34, 58, 82], 86, 30, P.leaf, P.leaf2, P.trunk), [S.hills(84, 3, P.ground)], S.broadleafRow([24, 70], 104, 26, '#e6a64a', '#c98a36', P.trunk)]],
    kings_canyon: ['noon', P => [S.sky(P), S.canyon(P, 88, 40, 62), S.peak(50, 44, 40, 22, P.rock, P.rock2, P.snow), S.river(50, 76, 6, 6, P.water, P.foam),
        S.forestRow([8, 22, 80, 94], 94, 30, P.leaf, P.leaf2, P.trunk, 4, 0.36)]],
    great_basin: ['dusk', P => [S.sky(P), S.sun(P, 72, 30, 9), S.peak(36, 68, 80, 44, P.far, P.mid, P.snow), [S.ridge([-4, 66, 40, 72, 104, 58], P.near)],
        [S.hills(82, 3, '#c9a37c')], S.pine(22, 96, 34, '#6f7a5e', '#535f4c', P.trunk, 2, 0.8), S.pine(72, 100, 28, '#6f7a5e', '#535f4c', P.trunk, 2, 0.8)]],
    theodore_roosevelt: ['autumn', P => [S.sky(P), S.cloud(P, 66, 20, 1, WHITE), S.mesa(26, 66, 44, 24, P.mid, P.near, 0.6), S.mesa(74, 70, 50, 30, P.far, P.mid, 0.66),
        [S.hills(72, 5, '#c9b56c')], S.river(40, 72, 6, 10, P.water, P.foam), [S.hills(90, 2, '#a0985a')], S.broadleafRow([12, 88], 100, 20, '#7f9a56', '#61804a', P.trunk)]],
    capitol_reef: ['redrock', P => [S.sky(P), [S.ridge([-4, 40, 16, 36, 30, 42, 48, 34, 64, 40, 80, 32, 104, 38], P.far)], [S.ridge([-4, 56, 20, 50, 46, 58, 72, 48, 104, 56], P.mid)],
        [box(-2, 66, 104, 4, P.far)], [S.hills(74, 3, P.near)], S.forestRow([14, 34, 62, 84], 96, 24, P.leaf, P.leaf2, P.trunk, 2, 0.7)]],
    cuyahoga_valley: ['autumn', P => [S.sky(P), S.falls(50, 34, 74, 20, P.water, P.foam), [box(-2, 34, 40, 50, P.rock), box(62, 34, 42, 50, P.rock2)],
        S.broadleafRow([12, 34, 68, 90], 54, 28, P.leaf, P.leaf2, P.trunk), S.lake(74, P.water, P.foam, [[16, 10, 14], [66, 14, 16]]), S.broadleafRow([6, 94], 100, 26, '#e6a64a', '#c98a36', P.trunk)]],
    // --- high mountains
    denali: ['arctic', P => [S.sky(P), S.sun(P, 80, 20, 6), S.peak(24, 72, 60, 36, P.far, P.mid, P.snow), S.peak(58, 76, 94, 66, P.mid, P.near, P.snow), [S.hills(72, 4, P.ground)],
        S.forestRow([10, 30, 84], 96, 26, '#5a8f88', '#3e7270', P.trunk, 3, 0.4)]],
    mount_rainier: ['dawn', P => [S.sky(P), S.sun(P, 24, 26, 7), S.peak(54, 74, 118, 60, P.far, P.mid, P.snow), [S.hills(70, 4, P.near)],
        S.forestRow([8, 26, 44, 70, 92], 92, 28, P.leaf, P.leaf2, P.trunk, 3, 0.4)]],
    north_cascades: ['noon', P => [S.sky(P), S.peak(20, 58, 54, 40, P.rock, P.rock2, P.snow), S.peak(52, 60, 56, 52, P.mid, P.near, P.snow), S.peak(84, 58, 50, 36, P.rock, P.rock2, P.snow),
        S.forestRow([6, 94], 64, 24, P.leaf, P.leaf2, P.trunk), S.lake(60, '#3fb0b6', P.foam, [[20, 12, 18], [58, 22, 24]]), [poly([20, 100, 30, 76, 48, 84, 62, 100], P.foam, 0.3)]]],
    rocky_mountain: ['noon', P => [S.sky(P), S.cloud(P, 28, 20, 1, WHITE), S.peak(70, 60, 74, 46, P.rock, P.rock2, P.snow), S.peak(26, 62, 60, 36, P.rock2, '#6e6c67', P.snow),
        S.forestRow([6, 22, 40, 86], 76, 32, P.leaf, P.leaf2, P.trunk, 3, 0.38), [S.hills(76, 3, '#a9c478')], S.lake(88, P.water, P.foam, [[28, 6, 18]])]],
    wrangell_st_elias: ['arctic', P => [S.sky(P), S.peak(26, 50, 56, 30, P.mid, P.near, P.snow), S.peak(74, 50, 60, 34, P.mid, P.near, P.snow), S.glacier(50, 34, 92, 66, P.snow, '#c7e0ea'),
        S.lake(90, P.water, P.foam, [[14, 6, 14], [66, 8, 18]])]],
    gates_arctic: ['aurora', P => [S.sky(P), S.aurora(), S.stars(P, [[16, 44, 1.4], [84, 36, 1.8], [52, 44, 1.2]]), S.peak(26, 74, 62, 26, P.far, P.mid, P.snow), S.peak(70, 74, 74, 32, P.mid, P.near, P.snow),
        S.lake(72, P.water, P.foam, [[20, 8, 22], [60, 16, 18]]), S.forestRow([8, 90], 96, 22, P.leaf, P.leaf2, P.trunk)]],
    glacier_bay: ['arctic', P => [S.sky(P), S.peak(24, 54, 60, 30, P.mid, P.near, P.snow), S.peak(78, 56, 56, 26, P.far, P.mid, P.snow), S.glacier(52, 30, 66, 58, P.snow, '#bfdce8'),
        S.lake(64, P.water, P.foam, [[8, 8, 16], [72, 18, 18]]), [poly([18, 80, 26, 70, 36, 74, 42, 82], P.snow), poly([26, 70, 36, 74, 42, 82, 30, 82], '#bfdce8'), poly([60, 88, 66, 82, 74, 90], P.snow)]]],
    kenai_fjords: ['dawn', P => [S.sky(P), S.sun(P, 50, 34, 8), [poly([-4, 16, 22, 26, 36, 70, -4, 70], P.mid), poly([104, 22, 78, 30, 64, 70, 104, 70], P.mid), poly([12, 22, 22, 26, 34, 60, 22, 62], P.near), poly([88, 28, 78, 30, 66, 60, 78, 62], P.near)],
        S.lake(66, P.water, P.foam, [[34, 6, 30], [12, 16, 18], [64, 22, 20]]), S.forestRow([6, 92], 92, 28, P.leaf, P.leaf2, P.trunk)]],
    bryce_canyon: ['redrock', P => [S.sky(P), [S.ridge([-4, 44, 104, 40], P.far)], S.hoodoos([8, 22, 36, 50, 64, 78, 92], 78, 34, P.mid, P.near, P.far), S.hoodoos([0, 15, 30, 44, 58, 72, 86, 100], 98, 42, '#e08a60', P.rock2, '#f0b48c')]],
    yosemite_night: ['night', P => [S.sky(P), S.stars(P, S.STARFIELD), S.moon(P, 76, 22, 7), S.dome(40, 74, 90, 54, P.far, P.mid), S.forestRow([6, 22, 74, 92], 86, 34, P.near, P.ground, P.trunk, 3, 0.38),
        S.lake(82, P.water, P.foam, [[24, 6, 20], [52, 12, 22]])]],
    // --- canyons & red rock
    grand_canyon: ['redrock', P => [S.sky(P), S.sun(P, 76, 18, 7), S.canyon(P, 92, 36, 60), [poly([44, 38, 50, 28, 58, 36, 56, 92, 46, 92], P.far)], S.river(50, 84, 7, 3, P.water, P.foam)]],
    grand_canyon_rim: ['dusk', P => [S.sky(P), S.sun(P, 28, 26, 9), [S.ridge([-4, 40, 104, 36], P.far)], S.mesa(30, 62, 40, 20, P.mid, P.near), S.mesa(74, 66, 40, 24, P.mid, P.near),
        [poly([-4, 72, 22, 70, 44, 104, -4, 104], P.near), poly([104, 76, 78, 72, 58, 104, 104, 104], P.ground)], S.pine(84, 90, 26, P.leaf, P.leaf2, P.trunk, 2, 0.7)]],
    black_canyon_gunnison: ['night', P => [S.sky(P), S.stars(P, [[50, 10, 2.4], [40, 22, 1.5], [62, 24, 1.8], [54, 36, 1.2]]), [poly([-4, -2, 34, -2, 42, 92, -4, 92], P.near), poly([104, -2, 66, -2, 58, 92, 104, 92], P.ground), poly([12, -2, 26, -2, 32, 60, 10, 44], P.mid), poly([18, 50, 36, 60, 38, 92, 22, 92], P.far)],
        S.river(50, 76, 5, 3, P.water, P.foam)]],
    zion: ['redrock', P => [S.sky(P), [poly([-4, 16, 26, 22, 40, 78, -4, 78], P.mid), poly([104, 26, 78, 18, 62, 78, 104, 78], P.near), poly([10, 44, 26, 22, 40, 78, 20, 78], P.far)], [S.hills(76, 2, '#b9c26d')],
        S.river(50, 74, 8, 8, P.water, P.foam), S.broadleafRow([18, 84], 92, 24, P.leaf, P.leaf2, P.trunk)]],
    arches_summer: ['desert', P => [S.sky(P), S.sun(P, 50, 44, 9), S.arch(50, 80, 66, 58, 13, P.rock, P.rock2), [S.hills(80, 3, P.ground)], S.saguaro(90, 96, 20, P.leaf, P.leaf2)]],
    arches_winter: ['arctic', P => [S.sky(P), S.arch(46, 78, 62, 54, 12, '#c97f62', '#a8604e'), [poly([16, 78, 22, 40, 34, 26, 58, 22, 72, 36, 62, 30, 46, 30, 30, 38, 24, 56], P.snow)], [S.hills(78, 3, P.snow)],
        S.forestRow([84, 94], 90, 22, P.leaf, P.leaf2, P.trunk, 2, 0.6), S.forestRow([8], 94, 20, P.leaf, P.leaf2, P.trunk, 2, 0.6)]],
    mesa_verde: ['autumn', P => [S.sky(P), [box(-2, 26, 104, 24, P.far), poly([-2, 50, 102, 50, 102, 58, -2, 58], '#6b5238')], [box(-2, 58, 104, 22, '#8a6c4c')], S.cliffHouses(50, 80, '#dfc49a', '#c0a37a', '#4f3c2c'), [box(-2, 80, 104, 30, P.mid)],
        S.pine(14, 22, 14, P.leaf2, '#6e6f3c', P.trunk, 2, 0.8), S.pine(80, 24, 16, P.leaf2, '#6e6f3c', P.trunk, 2, 0.8)]],
    badlands: ['dusk', P => [S.sky(P), S.sun(P, 76, 26, 8), [S.ridge([-4, 56, 8, 40, 16, 52, 28, 30, 38, 54, 50, 38, 60, 56, 74, 34, 84, 52, 94, 42, 104, 58], P.far)], [box(-2, 58, 104, 3, P.rock)], [S.ridge([-4, 70, 12, 56, 26, 72, 42, 52, 54, 72, 70, 56, 84, 72, 104, 58], P.mid)], [box(-2, 78, 104, 3, P.rock2)], [S.hills(88, 3, P.near)]]],
    great_sand_dunes: ['desert', P => [S.sky(P), S.peak(30, 54, 66, 28, P.far, P.mid, P.snow), S.peak(78, 54, 58, 24, P.far, P.mid, P.snow), S.dune(66, 88, 92, 42, '#efcf96', P.near), S.dune(24, 96, 84, 36, '#f5dcab', P.mid)]],
    guadalupe_mountains: ['desert', P => [S.sky(P), S.sun(P, 24, 22, 7), S.mesa(62, 70, 90, 48, P.mid, P.near, 0.34), [S.hills(70, 3, P.ground)], S.joshua(16, 90, 30, P.leaf2, P.trunk), [S.bush(70, 90, 8, P.leaf), S.bush(88, 94, 6, P.leaf2)]]],
    big_bend: ['desert', P => [S.sky(P), S.sun(P, 74, 22, 8), [poly([-4, 34, 26, 40, 40, 76, -4, 76], P.mid), poly([104, 38, 74, 44, 58, 76, 104, 76], P.near)], S.lake(72, P.water, P.foam, [[34, 6, 22], [16, 14, 18], [58, 18, 16]]), [S.hills(90, 2, P.ground)], S.saguaro(82, 96, 24, P.leaf, P.leaf2)]],
    // --- deserts
    saguaro: ['dusk', P => [S.sky(P), S.sun(P, 62, 36, 12), [S.ridge([-4, 58, 26, 46, 54, 60, 78, 50, 104, 60], P.far)], [S.hills(70, 4, P.mid)], [S.hills(86, 3, P.near)],
        S.saguaro(26, 90, 56, '#4e8a6a', '#346b56'), S.saguaro(72, 96, 40, '#4e8a6a', '#346b56'), [S.bush(50, 92, 5, '#7f9a6a')]]],
    joshua_tree: ['desert', P => [S.sky(P), S.sun(P, 28, 26, 9), [S.ridge([-4, 58, 40, 50, 70, 60, 104, 48], P.far)], [S.hills(72, 3, P.ground)],
        S.joshua(66, 96, 66, P.leaf2, P.trunk), S.joshua(22, 88, 30, P.leaf, P.trunk), [oval(40, 88, 7, 4, P.mid), oval(88, 92, 6, 3.4, P.near)]]],
    carlsbad_caverns: ['night', P => [[box(0, 0, 100, 100, '#3a3350')], S.cave(50, 94, 92, 80, '#1d1a2c', '#584e74'), [poly([20, 94, 26, 74, 32, 94], '#584e74'), poly([66, 94, 74, 66, 80, 94], '#6e6390'), poly([42, 94, 46, 84, 50, 94], '#584e74')],
        S.lake(90, P.water, P.foam, [[36, 4, 22]]), S.stars(P, [[50, 44, 1.6], [38, 58, 1.1], [62, 62, 1.3]])]],
    mammoth_cave: ['autumn', P => [S.sky(P), [S.hills(40, 8, P.leaf)], S.broadleafRow([14, 38, 62, 86], 44, 22, P.leaf, P.leaf2, P.trunk), [box(-2, 42, 104, 62, P.rock)], S.cave(50, 100, 72, 50, '#3a2c28', P.rock2),
        [poly([10, 42, 26, 42, 22, 100, 8, 100], P.rock2, 0.5), poly([90, 42, 78, 42, 84, 100, 94, 100], P.rock2, 0.5)]]],
    // --- volcanic
    yellowstone: ['mist', P => [S.sky(P, 46), S.peak(78, 54, 56, 24, P.far, P.mid), S.plume(36, 74, 56, WHITE), S.forestRow([6, 56, 74, 92], 74, 32, P.leaf, P.leaf2, P.trunk), [S.hills(72, 2, '#e7d8b0')], [oval(38, 88, 36, 10, '#e8b057'), oval(38, 88, 27, 7, '#5fb3a8'), oval(38, 88, 16, 4, '#2c7f9e')]]],
    lassen_volcanic: ['dusk', P => [S.sky(P), S.plume(50, 40, 32, P.foam), S.volcano(50, 74, 104, 40, P.mid, P.near, '#ea7b3f'), S.forestRow([8, 26, 78, 94], 88, 26, P.leaf, P.leaf2, P.trunk), S.lake(84, P.water, P.foam, [[34, 6, 26]])]],
    haleakala: ['dusk', P => [S.sky(P), S.sun(P, 50, 46, 13), S.cloud(P, 22, 52, 1.6, P.sky2), S.cloud(P, 80, 54, 1.4, P.sky2), S.volcano(50, 90, 130, 30, P.rock, P.rock2), [oval(50, 66, 26, 4, P.near)], S.peak(40, 68, 12, 8, '#c56a5a', '#9c4e4e'), S.peak(60, 68, 10, 6, '#c56a5a', '#9c4e4e'), S.lake(92, P.water, P.foam, [[24, 4, 20]])]],
    // --- sea, islands, wetland
    dry_tortugas: ['tropic', P => [S.sky(P), S.sun(P, 76, 22, 8), S.cloud(P, 26, 24, 1, WHITE), S.waves(58, P.water, P.foam), [S.island(50, 66, 88, 8, P.ground)], S.fort(50, 66, 58, 18, '#c9744f', '#a8593c', '#6e3a2a'), S.waves(70, '#2f9db1', P.foam, 5)]],
    biscayne: ['lagoon', P => [S.sky(P), S.sun(P, 28, 26, 9), S.lake(52, P.water, P.foam, [[10, 6, 16], [40, 14, 24], [14, 26, 18]]), [S.island(74, 72, 62, 14, P.ground)], S.palm(66, 72, 34, 6, P.leaf, P.leaf2, P.trunk), S.palm(82, 74, 26, -4, P.mid, P.near, P.trunk), S.reeds([54, 92], 76, 12, P.leaf2, P.trunk)]],
    virgin_islands: ['tropic', P => [S.sky(P), S.sun(P, 78, 20, 8), S.lake(58, P.water, P.foam, [[8, 8, 14], [66, 22, 20]]), [S.island(24, 60, 44, 18, P.mid), S.island(66, 60, 34, 10, P.far)], [S.ridge([-4, 84, 28, 74, 60, 84, 60, 104, -4, 104], P.ground)], S.palm(26, 80, 44, 8, P.leaf, P.leaf2, P.trunk)]],
    american_samoa: ['lagoon', P => [S.sky(P), S.sun(P, 76, 22, 8), [poly([-4, 72, -4, 30, 16, 22, 34, 36, 50, 56, 66, 72], P.mid), poly([-4, 72, -4, 46, 22, 44, 44, 72], P.near)], S.lake(70, P.water, P.foam, [[52, 6, 24], [66, 16, 20]]), [S.ridge([-4, 88, 40, 84, 70, 104, -4, 104], P.ground)], S.palm(30, 88, 40, -6, P.leaf, P.leaf2, P.trunk)]],
    channel_islands: ['noon', P => [S.sky(P), S.cloud(P, 70, 24, 1, WHITE), S.lake(56, P.water, P.foam, [[8, 10, 18], [66, 26, 20]]), [S.ridge([12, 56, 26, 40, 40, 46, 54, 34, 74, 50, 90, 56], P.mid), poly([54, 34, 74, 50, 90, 56, 56, 56], P.near)], [poly([26, 74, 34, 62, 44, 74], P.rock), poly([34, 62, 44, 74, 36, 74], P.rock2)]]],
    isle_royale: ['mist', P => [S.sky(P, 44), S.lake(44, P.water, P.foam, [[6, 6, 14], [72, 40, 18]]), [S.island(50, 66, 104, 16, P.near)], S.forestRow([12, 28, 44, 60, 76, 92], 62, 26, P.leaf, P.leaf2, P.trunk), [S.island(84, 84, 30, 6, P.ground)], S.forestRow([84], 82, 14, P.leaf, P.leaf2, P.trunk)]],
    acadia: ['dawn', P => [S.sky(P), S.sun(P, 72, 34, 10), S.waves(58, P.water, P.foam), [poly([-4, 104, -4, 54, 14, 44, 34, 58, 50, 74, 62, 104], P.rock), poly([14, 44, 34, 58, 50, 74, 62, 104, 34, 104, 24, 70], P.rock2)], S.lighthouse(16, 48, 28, '#fff7ee', '#d8674f', '#f8d67a'), S.pine(40, 76, 18, P.leaf, P.leaf2, P.trunk)]],
    everglades: ['tropic', P => [S.sky(P), S.sun(P, 24, 24, 8), [S.hills(46, 3, P.far)], S.broadleafRow([60, 78, 94], 56, 24, P.leaf, P.leaf2, P.trunk), S.lake(52, '#6fb9a8', P.foam, [[6, 8, 16], [30, 22, 16]]), S.reeds([6, 13, 20, 28, 84, 92], 96, 30, P.leaf2, P.trunk), S.lilies([[50, 80, 8], [66, 90, 6], [38, 92, 5]], P.leaf, '#fbd0dc'), S.palm(74, 62, 20, 4, P.leaf, P.leaf2, P.trunk)]],
    // --- landmark
    // --- Nightfall
    grand_teton: ['dawn', P => [S.sky(P), S.peak(28, 64, 42, 30, P.far, P.mid, P.snow), S.peak(72, 64, 44, 34, P.far, P.mid, P.snow), S.peak(50, 64, 40, 48, P.rock, P.rock2, P.snow),
        S.lake(68, P.water, P.foam, [[18, 4, 18], [62, 8, 20]]), S.forestRow([6, 20, 82, 96], 92, 30, P.leaf, P.leaf2, P.trunk)]],
    death_valley: ['night', P => [S.sky(P), S.stars(P, S.STARFIELD), S.moon(P, 76, 18, 7), S.peak(26, 62, 70, 22, P.far, P.mid), S.peak(78, 62, 52, 16, P.far, P.mid),
        S.dune(62, 86, 96, 30, '#c9a56f', '#a8844f'), [S.hills(92, 2, '#e9e1cf')]]],
    hawaii_volcanoes: ['night', P => [S.sky(P), S.stars(P, S.STARFIELD), S.plume(56, 44, 30, '#8a7f8f'), S.volcano(50, 80, 112, 34, P.far, P.mid, '#ea7b3f'),
        [poly([47, 54, 53, 54, 64, 96, 36, 96], '#ea7b3f'), poly([49, 60, 51, 60, 56, 96, 44, 96], '#f8c64f')], S.waves(92, P.water, P.foam)]],
    lake_clark: ['noon', P => [S.sky(P), S.moon(P, 80, 14, 4), S.peak(24, 46, 60, 26, P.far, P.mid, P.snow), S.peak(70, 46, 70, 30, P.far, P.mid, P.snow),
        [poly([-4, 46, 30, 46, 10, 74, -4, 74], P.near), poly([104, 46, 66, 46, 92, 74, 104, 74], P.near)], S.lake(56, P.water, P.foam, [[30, 6, 22], [50, 16, 18]]),
        [box(30, 78, 30, 4, WHITE), box(36, 84, 22, 2, '#d8dde0'), poly([34, 78, 40, 70, 44, 70, 42, 78], WHITE)]]],
    katmai: ['mist', P => [S.sky(P, 30), S.forestRow([8, 30, 74, 94], 40, 24, P.leaf, P.leaf2, P.trunk), [box(-2, 40, 104, 20, P.rock)], S.falls(50, 40, 92, 70, P.water, P.foam),
        [oval(30, 56, 12, 8, '#a8673a'), oval(22, 50, 5, 5, '#a8673a'), oval(72, 70, 13, 9, '#93562f'), oval(82, 63, 5, 5, '#93562f')]]],
    crater_lake: ['night', P => [S.sky(P), S.stars(P, S.STARFIELD), [S.ridge([-4, 50, 20, 40, 40, 48, 60, 42, 80, 48, 104, 40], P.mid)], S.lake(62, '#3f9fc0', P.foam, [[24, 6, 18], [58, 12, 20]]),
        [S.island(64, 64, 18, 8, P.near)], [poly([-4, 104, -4, 76, 30, 84, 50, 104], P.ground), poly([104, 104, 104, 78, 70, 86, 56, 104], P.ground)], S.forestRow([8, 92], 98, 22, P.leaf, P.leaf2, P.trunk)]],
    glacier: ['dusk', P => [S.sky(P), S.peak(46, 74, 84, 62, '#e58f62', P.rock2, P.snow), S.peak(84, 74, 40, 28, P.mid, P.near, P.snow),
        [poly([-4, 104, -4, 70, 36, 76, 60, 104], P.near)], S.forestRow([6, 18, 30], 92, 22, P.leaf, P.leaf2, P.trunk), [oval(64, 82, 7, 4, WHITE), poly([60, 84, 62, 90, 63, 84], WHITE), poly([66, 84, 68, 90, 69, 84], WHITE)]]],
    white_sands: ['arctic', P => [S.sky(P), S.dune(30, 70, 90, 26, '#f6f4ef', '#d9e1e6'), S.dune(78, 86, 80, 30, WHITE, '#cfdbe2'), S.dune(36, 104, 104, 22, '#f2f5f7', '#d4dfe6'),
        [oval(60, 62, 4, 2.4, '#d98a46'), poly([62, 61, 66, 58, 64, 62], '#d98a46')]]],
    indiana_dunes: ['dusk', P => [[box(0, 0, 100, 100, '#c9504f'), box(0, 52, 100, 48, '#e07a5f')], S.sun(P, 70, 56, 7), S.waves(60, '#5e3c5c', '#a6788f'),
        [poly([60, 50, 64, 40, 66, 50], '#33213a')], S.dune(30, 104, 100, 34, '#3a2840', '#2a1d30'), [poly([22, 26, 44, 34, 62, 24, 46, 38, 30, 34], '#2b1d2c')]]],
    wind_cave: ['noon', P => [S.sky(P), S.cloud(P, 30, 22, 1, WHITE), [S.hills(56, 6, '#8bbf6a'), S.hills(72, 4, '#6fa457', -1)],
        [oval(48, 74, 18, 11, '#7a4f2e'), oval(34, 70, 8, 8, '#5e3a22'), box(38, 80, 4, 10, '#5e3a22'), box(56, 80, 4, 10, '#5e3a22')], [S.hills(92, 2, '#4f8a46')]]],
    big_bend_night: ['night', P => [S.sky(P), S.stars(P, S.STARFIELD), S.moon(P, 26, 20, 6), [poly([-4, 30, 30, 40, 42, 80, -4, 80], P.near), poly([104, 34, 72, 42, 58, 80, 104, 80], P.ground)],
        S.river(50, 78, 8, 6, '#5fb3c9', P.foam), S.saguaro(86, 98, 22, P.leaf, P.leaf2)]],
    hot_springs: ['lagoon', P => [S.sky(P), S.forestRow([8, 92], 46, 30, P.leaf, P.leaf2, P.trunk), [box(16, 30, 68, 40, '#f1ddd0'), box(16, 26, 68, 6, '#c76a5c'), box(22, 40, 8, 14, '#6d8c94'), box(38, 40, 8, 14, '#6d8c94'), box(54, 40, 8, 14, '#6d8c94'), box(70, 40, 8, 14, '#6d8c94')],
        [box(-2, 70, 104, 34, P.mid)], S.plume(30, 92, 20, WHITE), S.plume(70, 92, 18, WHITE)]],
    canyonlands_night: ['aurora', P => [S.sky(P), S.stars(P, S.STARFIELD), S.mesa(28, 60, 60, 18, P.far, P.mid), S.mesa(80, 64, 44, 22, P.mid, P.near),
        S.lake(66, '#3b7fb0', P.foam, [[30, 6, 20]]), [poly([-4, 104, -4, 78, 40, 84, 54, 104], P.ground)]]],
    petrified_forest: ['desert', P => [S.sky(P), [S.ridge([-4, 50, 20, 44, 50, 52, 80, 42, 104, 48], '#e8b6a4')], [box(-2, 52, 104, 4, '#c9907c'), box(-2, 60, 104, 4, '#d7a98f')],
        [S.hills(72, 3, P.ground)], [poly([18, 84, 70, 80, 72, 88, 20, 92], '#a86a52'), oval(70, 84, 3, 4, '#e8c49c'), oval(19, 88, 3, 4, '#e8c49c')], [oval(78, 66, 4, 3, '#4a3a30'), poly([80, 64, 88, 60, 82, 67], '#4a3a30')]]],
    kobuk_valley: ['arctic', P => [S.sky(P), [S.ridge([-4, 50, 30, 44, 60, 52, 104, 42], P.far)], S.dune(50, 76, 104, 18, '#f0e3c8', '#d8c7a6'), S.river(50, 76, 10, 4, P.water, P.foam),
        [oval(24, 66, 5, 3, '#9a7b5a'), oval(40, 64, 5, 3, '#9a7b5a'), oval(58, 66, 5, 3, '#9a7b5a'), oval(76, 64, 5, 3, '#9a7b5a')], S.forestRow([8, 92], 98, 24, P.leaf, P.leaf2, P.trunk)]],
    denali_night: ['aurora', P => [S.sky(P), S.aurora(), S.peak(52, 78, 110, 54, P.far, P.mid, P.snow), S.peak(20, 78, 40, 22, P.mid, P.near, P.snow), [S.hills(80, 3, P.snow)],
        [poly([24, 90, 34, 86, 44, 90, 34, 94], '#5c4630'), poly([60, 92, 70, 88, 80, 92, 70, 96], '#5c4630')]]],
    canyonlands_day: ['redrock', P => [S.sky(P), S.cloud(P, 70, 20, 1, WHITE), S.mesa(50, 62, 96, 22, P.mid, P.near, 0.86), S.arch(30, 92, 34, 30, 7, P.rock, P.rock2),
        [S.hills(94, 2, P.ground)], S.broadleafRow([80], 96, 14, P.leaf, P.leaf2, P.trunk)]],
    rocky_mountain_night: ['night', P => [S.sky(P), S.stars(P, S.STARFIELD), S.peak(36, 70, 70, 40, P.far, P.mid, P.snow), S.peak(78, 70, 54, 30, P.mid, P.near, P.snow),
        [poly([-4, 104, -4, 86, 30, 80, 70, 88, 104, 82, 104, 104], '#7c4f86')], [poly([50, 80, 46, 66, 52, 60, 56, 66, 52, 80], '#3b2a2f'), poly([46, 64, 40, 56, 44, 62], '#3b2a2f'), poly([56, 64, 62, 56, 58, 62], '#3b2a2f')]]],
    pinnacles: ['autumn', P => [[box(0, 0, 100, 100, '#3d2a2a')], S.cave(50, 100, 104, 96, '#3d2a2a', '#e07b45'), S.hoodoos([18, 34, 66, 82], 100, 40, '#e8a04c', '#c9703a', '#f4c060'),
        [oval(50, 50, 18, 26, '#f4c98a', 0.35)], [box(48, 70, 3, 10, '#2a1d1d')]]],
    voyageurs: ['tropic', P => [S.sky(P), S.lake(48, P.water, P.foam, [[12, 6, 18], [50, 12, 22], [20, 24, 16]]), [S.island(70, 58, 46, 10, P.near)],
        S.forestRow([56, 66, 76, 86], 58, 18, P.leaf, P.leaf2, P.trunk), [poly([24, 60, 46, 60, 42, 64, 28, 64], '#c95b3c')], S.broadleafRow([8, 30], 100, 28, '#e6a64a', '#c98a36', P.trunk)]],
    arches_night: ['aurora', P => [S.sky(P), S.stars(P, S.STARFIELD), [shape('M 54 -4 C 40 30 56 60 46 104 L 62 104 C 70 60 58 30 70 -4 Z', '#c6c9f0', 0.35)],
        S.arch(50, 92, 80, 66, 14, '#2a2346', '#1d1834'), [S.hills(94, 2, '#151230')]]],
    redwood_grove: ['autumn', P => [[box(0, 0, 100, 100, '#3f5b35')], [shape('M 40 -4 L 60 -4 L 74 104 L 26 104 Z', '#f8d27a', 0.35)],
        S.sequoia(16, 104, 110, 12, '#2f5a3a', '#244a30', '#b05a36', '#8a4428'), S.sequoia(84, 104, 110, 14, '#2f5a3a', '#244a30', '#b05a36', '#8a4428'),
        S.sequoia(50, 104, 110, 8, '#2f5a3a', '#244a30', '#c36a3c', '#9a4e2e'), [S.hills(98, 2, '#55703a')]]],
    zion_night: ['night', P => [S.sky(P), S.stars(P, [[50, 8, 2], [40, 16, 1.4], [60, 14, 1.6]]), [poly([-4, -2, 40, -2, 38, 104, -4, 104], '#7a3b3a'), poly([104, -2, 60, -2, 62, 104, 104, 104], '#5e2c30')],
        [poly([38, 30, 44, 20, 42, 104, 36, 104], '#a8523f')], S.river(50, 80, 6, 4, P.water, P.foam)]],
    redwood_elk: ['mist', P => [S.sky(P, 30), S.sequoia(18, 104, 110, 16, '#4f7a46', '#365e36', '#a65a38', '#7f4228'), S.sequoia(74, 104, 110, 18, '#4f7a46', '#365e36', '#a65a38', '#7f4228'),
        [S.hills(88, 3, '#6e8a4c')], [oval(46, 74, 12, 7, '#8a5634'), box(38, 78, 3, 12, '#6e4226'), box(52, 78, 3, 12, '#6e4226'), oval(56, 64, 4, 5, '#8a5634'), poly([56, 58, 52, 48, 56, 52, 60, 46, 58, 58], '#5e3a22')]]],
    gateway_arch: ['dawn', P => [S.sky(P), S.sun(P, 50, 58, 10), S.steelArch(50, 88, 66, 70, '#dfe3e6', '#b4bcc4'), [S.hills(86, 2, P.ground)], S.lake(92, P.water, P.foam, [[28, 3, 18]]), S.broadleafRow([8, 92], 88, 16, P.leaf, P.leaf2, P.trunk)]]
};

/** Stack a recipe into one full-bleed square icon. */
function parkScene(id: string): IconObject {
    const recipe = PARK_RECIPES[id];
    if (!recipe) throw new Error(`No scene for park ${id}`);
    const [paletteId, build] = recipe;
    return icon(parkIconId(id), flat(build(SP[paletteId])));
}

export const parkIconId = (id: string): string => `park_${id}`;
export const parkPaletteId = (id: string): string => PARK_RECIPES[id][0];

// ===========================================================================
// Icon registry
// ===========================================================================

export const PARKS_ICONS: Record<string, IconObject> = (() => {
    const all: Record<string, IconObject> = {};
    const add = (i: IconObject) => { all[i.id] = i; };
    [COIN_FOREST, COIN_MOUNTAIN, COIN_SUNSHINE, COIN_WATER, COIN_WILDLIFE, ANY_TOKEN, RANGER_PAWN,
        CAMPFIRE_LIT, CAMPFIRE_OUT, CAMERA, PHOTO, MARKER, CANTEEN_GLYPH, CANTEEN_FULL, PARK_GLYPH, RESERVE_GLYPH, VISIT_GLYPH, GEAR_GLYPH, ARROW, OR_MARK, COPY, BOLT, RIBBON_YEAR, TENT_TOKEN].forEach(add);
    SYMS.forEach(s => add(ghostCoin(s)));
    (Object.keys(GEAR_GLYPHS) as GearType[]).forEach(t => add(icon(gearIconId(t), GEAR_GLYPHS[t])));
    SITE_IDS.forEach(id => add(icon(siteIconId(id), siteScene(id))));
    add(icon('site_trailhead', TRAILHEAD));
    [...PARK_CARDS, ...NIGHTFALL_PARK_CARDS].forEach(p => add(parkScene(p.id)));
    return all;
})();

// ===========================================================================
// Palettes for the card frames
// ===========================================================================

function framePalette(id: string, primary: string, secondary: string, background = PAPER): Palette {
    return {
        id: `parks_${id}`, name: id, background, border: secondary, primary, secondary, accent: '#eda92c',
        charcoal: INK, text: INK, panelBg: background, tertiary: '#eda92c', success: '#4c9a6e', danger: '#d8674f'
    };
}

export const PARKS_UI_PALETTE = framePalette('ui', '#4c9a6e', '#2e3b36');


// ===========================================================================
// Card builders
// ===========================================================================

const CARD_W = 63.5;
const COST_ORDER: Sym[] = ['FOREST', 'MOUNTAIN', 'SUNSHINE', 'WATER'];

export interface ParkFaceOptions {
    /** Cost after this player's discounts; printed icons beyond it render hollow. */
    need?: Need;
}

/** A Nightfall action as a short run of icons, for card faces and the Campsite tiles. */
export function nfActionIcons(a: NfAction): string[] {
    const toks = (b: Bag) => bagList(b).map(tokenIconId);
    switch (a.kind) {
        case 'TRADE': {
            const gain = bagList(a.gain);
            // five of a kind reads better as one coin and a count
            return [tokenIconId(a.pay), 'arrow', ...(gain.length > 2 ? [tokenIconId(gain[0])] : gain.map(tokenIconId))];
        }
        case 'PHOTO': return [tokenIconId(a.pay), 'arrow', 'photo'];
        case 'GAIN': return toks(a.gain);
        case 'RESERVE': return ['reserve_glyph'];
        case 'CANTEEN_WATER': return ['canteen', tokenIconId('WATER')];
        case 'DRAIN_CANTEENS': return ['canteen_full', 'arrow', tokenIconId('WATER'), tokenIconId('WATER')];
        case 'SWAP_CARD': return ['gear_glyph', 'or_mark', 'year_glyph', 'copy'];
        case 'GEAR_REFRESH': return [tokenIconId('SUNSHINE'), tokenIconId('SUNSHINE'), 'arrow', 'gear_glyph'];
        case 'RESERVE_RELIGHT': return [tokenIconId(a.gain), 'reserve_glyph', 'campfire'];
        case 'YEAR_DRAW': return [tokenIconId('SUNSHINE'), tokenIconId('SUNSHINE'), tokenIconId('SUNSHINE'), 'arrow', 'year_glyph'];        case 'CAMERA': return ['camera'];
        case 'YEAR_CARD': return ['year_glyph'];
        case 'GEAR_CARD': return ['gear_glyph'];
        case 'CAMP': return ['tent'];
    }
}

/** The same, as an inline icon line; a TRADE's count is written out when the coins are folded. */
export function nfActionLine(a: NfAction): string {
    if (a.kind === 'TRADE') {
        const gain = bagList(a.gain);
        const reward = gain.length > 2 ? `${gain.length}${coin(gain[0])}` : gain.map(coin).join('');
        return `${coin(a.pay)}${fi('arrow')}${reward}${a.times > 1 ? ` ×${a.times}` : ''}`;
    }
    const line = nfActionIcons(a).map(fi).join('');
    return a.kind === 'PHOTO' && a.times > 1 ? `${line} ×${a.times}` : line;
}

/**
 *   ┌──────────────────┐
 *   │(4)               │  points on a dark disc, over the art
 *   │    full-bleed    │
 *   │    landscape     │
 *   ├──────────────────┤
 *   │ Name             │
 *   │ ●●●●●●●          │  cost: one coin per printed icon
 *   └──────────────────┘
 */
export function getParkCardDefinition(park: ParkCard, opts: ParkFaceOptions = {}): CardDefinition {
    const coins: NonNullable<DataRow['iconsList']> = [];
    for (const s of COST_ORDER) {
        const printed = park.cost[s] || 0;
        const payable = opts.need ? (opts.need[s] || 0) : printed;
        for (let i = 0; i < printed; i++) {
            coins.push({ iconId: i < payable ? tokenIconId(s) : ghostIconId(s) });
        }
    }
    for (let i = 0; i < (park.any || 0); i++) coins.push({ iconId: 'tok_any' });
    if (park.instant) [BOLT.id, ...nfActionIcons(park.instant)].forEach(iconId => coins.push({ iconId }));
    return {
        id: `park-${park.id}`,
        name: park.name,
        widthMm: CARD_W,
        heightMm: 88.9,
        borderRadiusMm: 3.4,
        palette: framePalette('park', '#3c5a4c', INK),
        borderWidth: 0,
        header: { title: park.short, background: PAPER },
        mainArt: { iconId: parkIconId(park.id), frameStyle: 'none' },
        data: {
            rows: [{ iconsList: coins, iconsListAlign: 'center', iconsListBg: 'none', iconsListIconSize: coins.length > 7 ? 2.1 : 2.5, iconsListGap: 0.1 }],
            background: 'none'
        },
        overlays: [
            { position: 'top-left', shape: 'chip', value: String(park.points), backgroundColor: '#22302b', color: '#ffffff', size: 4.1, radius: 2.05 }
        ]
    };
}

/** What a Site does, in icons, along the foot of its card. */
function siteActionIcons(site: SiteId): string[] {
    switch (site) {
        case 'VISTA': return ['canteen', 'or_mark', 'photo'];
        case 'WILDLIFE': return ['tok_any', 'arrow', tokenIconId('WILDLIFE')];
        case 'LODGE': return ['tok_any', 'arrow', 'tok_any'];
        case 'LOOKOUT': return ['park_glyph', 'or_mark', 'gear_glyph'];
        case 'RIVER': return [tokenIconId('WATER'), 'arrow', 'copy'];
        case 'LAKE': return ['canteen_full', 'copy'];
        case 'PARKWAY': return [tokenIconId('SUNSHINE'), 'or_mark', 'copy'];
        case 'SUMMIT': return ['photo', 'arrow', 'tok_any'];
        case 'CANYON': return [tokenIconId('WILDLIFE'), 'arrow', tokenIconId('SUNSHINE'), tokenIconId('SUNSHINE'), tokenIconId('WATER'), tokenIconId('WATER')];
        default: return bagList(SITES[site].gain!).map(tokenIconId);
    }
}

/** A Trail Site: a scene over what it does, with no words, so the Trail stays readable at phone width. */
export function getSiteCardDefinition(site: SiteId | null): CardDefinition {
    return {
        id: `site-${site || 'start'}`,
        name: site ? SITES[site].name : 'Start',
        widthMm: CARD_W,
        heightMm: 88.9,
        borderRadiusMm: 3.4,
        palette: framePalette('site', '#3c5a4c', '#eda92c'),
        borderWidth: 0,
        mainArt: { iconId: site ? siteIconId(site) : 'site_trailhead', frameStyle: 'none' },
        data: site ? {
            rows: [{
                iconsList: siteActionIcons(site).map(iconId => ({ iconId })),
                // the Canyon's six icons have to shrink to stay on the card
                iconsListAlign: 'center', iconsListBg: 'none', iconsListIconSize: siteActionIcons(site).length > 4 ? 2.9 : 4.8, iconsListGap: 0.12
            }],
            background: 'none'
        } : undefined
    };
}

/** The frame of the Trail End card; its three tappable areas are laid over it by the view. */
export function getTrailEndCardDefinition(): CardDefinition {
    return {
        id: 'site-trail-end',
        name: 'Trail End',
        widthMm: CARD_W,
        heightMm: 88.9,
        borderRadiusMm: 3.4,
        palette: framePalette('site', '#3c5a4c', '#eda92c'),
        borderWidth: 0
    };
}

const fi = (id: string): string => `[icon:${id}]`;
const coin = (t: Token): string => fi(tokenIconId(t));

/** Effect line for a Gear card: icons first, a word only where a shape can't say it. */
export function gearEffectText(g: GearCard): string {
    if (g.discount) {
        const parts = SYMS.reduce<string>((acc, s) => acc + coin(s).repeat(g.discount![s] || 0), '');
        return `${fi('park_glyph')} −${parts}`;
    }
    if (g.substitute) return `${coin(g.substitute.to)}${fi('arrow')}${coin(g.substitute.from)}`;
    if (g.replace) {
        const gain = TOKENS.reduce<string>((acc, t) => acc + coin(t).repeat(g.replace!.gain[t] || 0), '');
        return `${siteWord(g.replace.site)}${fi('arrow')}${gain}`;
    }
    if (g.onVisit) {
        if (g.onVisit.effect === 'WILD') return `${siteWord(g.onVisit.site)} ${fi('tok_any')}${fi('arrow')}${coin('WILDLIFE')} ×2`;
        const result = g.onVisit.effect === 'FILL' ? fi('canteen_full') : fi('photo');
        // the bolt marks what also happens once, the moment you buy it
        const instant = g.instant === 'CANTEEN' ? fi('bolt') + fi('canteen') : g.instant === 'PHOTO' ? fi('bolt') + fi('photo') : '';
        return `${siteWord(g.onVisit.site)}${fi('arrow')}${result}${instant}`;
    }
    if (g.gearDiscount) return `${fi('gear_glyph')} −${coin('SUNSHINE')}`;
    if (g.parkPass) return `${fi('park_glyph')}+${fi('park_glyph')}`;
    if (g.reservedVisitGain) return `${fi('reserve_glyph')}${fi('visit_glyph')}${fi('arrow')}+${coin('WILDLIFE')}`;
    if (g.instant === 'GEAR_TOP') return `${fi('bolt')}${fi('gear_glyph')}`;
    if (g.shutter) return `${coin('WILDLIFE')}${fi('arrow')}${fi('photo')}`;
    if (g.wildPair) return `${coin('WILDLIFE')} = ${coin(g.wildPair)}${coin(g.wildPair)}`;
    if (g.onCampfire) {
        const c = g.onCampfire;
        if (c.kind === 'FILL') return `${fi('campfire')}${fi('arrow')}${fi('canteen_full')}`;
        return `${fi('campfire')} ${coin(c.pay)}${fi('arrow')}${c.kind === 'PHOTO' ? fi('photo') : coin('WILDLIFE')}`;
    }
    return `${fi('campfire')}${fi('arrow')}Stay`;
}

/** A site on an effect line is its token, since that's how players know it. */
function siteWord(site: SiteId): string {
    if (site === 'WILDLIFE') return coin('WILDLIFE');
    if (site === 'FOREST') return coin('FOREST');
    if (site === 'MOUNTAIN') return coin('MOUNTAIN');
    if (site === 'VALLEY') return coin('SUNSHINE') + coin('SUNSHINE');
    return coin('WATER') + coin('WATER');
}

/** Gear lies on its side, so it can't be mistaken for an upright Park. */
const GEAR_H = 40;
export const GEAR_RATIO = GEAR_H / CARD_W;

/**
 *   ┌───────────────────────┐
 *   │ Name             ☀☀☀  │  name + Sunshine price
 *   │  ▣ object  [ effect ] │  object glyph, effect as icons
 *   └───────────────────────┘
 */
export function getGearCardDefinition(g: GearCard): CardDefinition {
    const price: NonNullable<DataRow['iconsList']> = [];
    for (let i = 0; i < g.cost; i++) price.push({ iconId: tokenIconId('SUNSHINE') });
    return {
        id: `gear-${g.id}`,
        name: g.name,
        widthMm: CARD_W,
        heightMm: GEAR_H,
        borderRadiusMm: 3.4,
        palette: framePalette('gear', '#c7804a', INK, GEAR_TINT[g.type]),
        borderWidth: 0,
        header: { title: g.name, background: 'none' },
        mainArt: { iconId: gearIconId(g.type), frameStyle: 'none' },
        data: {
            rows: [{ iconsList: price, iconsListAlign: 'right', iconsListBg: 'none', iconsListIconSize: 1.9, iconsListGap: 0.08 }],
            background: 'none'
        },
        footer: { text: gearEffectText(g), align: 'center', verticalAlign: 'center', background: 'none', color: INK, size: 2.9, italic: false, weight: 800 }
    };
}

const CANTEEN_EFFECT_LINE: Record<CanteenEffect, string> = {
    FOREST: `+${coin('FOREST')}`,
    MOUNTAIN: `+${coin('MOUNTAIN')}`,
    SUNSHINE: `+${coin('SUNSHINE')}${coin('SUNSHINE')}`,
    EXCHANGE: `${fi('tok_any')}${fi('tok_any')}${fi('arrow')}${fi('tok_any')}${fi('tok_any')}`,
    WILD_OR_RESERVE: `${fi('tok_any')}${fi('arrow')}${coin('WILDLIFE')} / ${fi('park_glyph')}`,
    MOUNTAIN_PHOTO: `${coin('MOUNTAIN')}${fi('arrow')}${fi('photo')}`,
    FOREST_PHOTO: `${coin('FOREST')}${fi('arrow')}${fi('photo')}`,
    SUN_WATER: `+${coin('SUNSHINE')}${coin('WATER')}`,
    WATER2: `+${coin('WATER')}${coin('WATER')}`
};

export function getCanteenCardDefinition(id: string, effect: CanteenEffect, filled: boolean): CardDefinition {
    return {
        id: `canteen-${id}`,
        name: 'Canteen',
        widthMm: CARD_W,
        heightMm: 64,
        borderRadiusMm: 3.4,
        palette: framePalette('canteen', '#7b9a8c', INK, filled ? '#d7ecf2' : '#ecf1e8'),
        borderWidth: 0,
        mainArt: { iconId: filled ? 'canteen_full' : 'canteen', frameStyle: 'none' },
        footer: { text: CANTEEN_EFFECT_LINE[effect], align: 'center', verticalAlign: 'center', background: 'none', color: INK, size: 2.9, italic: false, weight: 800 }
    };
}

/** The Year goal as icons. Tier thresholds are drawn by the view, under the card. */
export function yearGoalLine(y: YearCard): string {
    const g = y.goal;
    switch (g.kind) {
        case 'SYMBOLS_AND_PHOTOS': return `${coin(g.symbol)} + ${fi('photo')}`;
        case 'SYMBOLS_ANY_ONE_TYPE': return `${coin('FOREST')}${coin('MOUNTAIN')}${coin('SUNSHINE')}${coin('WATER')}`;
        case 'PARKS_WITH_SYMBOL': return `${fi('park_glyph')} with ${coin(g.symbol)}`;
        case 'PARKS_IN_POINT_RANGE': return `${fi('park_glyph')} worth ${g.min}–${g.max}`;
        case 'GEAR_COST_TOTAL': return `${fi('gear_glyph')} cost ${coin('SUNSHINE')}`;
        case 'SYMBOL_ICONS': return `${coin(g.symbol)} on ${fi('park_glyph')}`;
        case 'POINT_SETS': return `${fi('park_glyph')} 2 · 3 · 4`;
        case 'TOKENS_HELD': return `${fi('tok_any')} held`;
        case 'PHOTOS': return fi('photo');
        case 'WILDLIFE_HELD': return `${coin('WILDLIFE')} held`;
        case 'SYMBOL_SETS': return `${coin('FOREST')}${coin('MOUNTAIN')}${coin('SUNSHINE')}${coin('WATER')}`;
        case 'INSTANT_PARKS': return `${fi('park_glyph')} with ${fi('bolt')}`;
    }
}

/** The weather a Season arrives in: a sky, and one kind of drifting particle. */
export interface SeasonTheme {
    sky: string;
    particle: 'petal' | 'leaf' | 'drop' | 'flake' | 'bubble' | 'spark' | 'rock' | 'gust' | 'wave';
    motion: 'fall' | 'rise' | 'drift' | 'twinkle';
    colors: string[];
}

export const SEASON_THEMES: Record<string, SeasonTheme> = {
    splendor: { sky: 'linear-gradient(#ffd98a, #f6a55c)', particle: 'spark', motion: 'twinkle', colors: ['#fff6d6', '#ffffff', '#ffe08a'] },
    growth: { sky: 'linear-gradient(#cfe9b8, #6fae76)', particle: 'leaf', motion: 'rise', colors: ['#4c9a6e', '#347d5d', '#a5cf7f'] },
    rain: { sky: 'linear-gradient(#8fa6b8, #54708a)', particle: 'drop', motion: 'fall', colors: ['#d6e8f2', '#b5d6e8'] },
    reefs: { sky: 'linear-gradient(#5cc4c4, #1f7f9c)', particle: 'bubble', motion: 'rise', colors: ['#d6f4f2', '#ffffff'] },
    waves: { sky: 'linear-gradient(#a7dcef, #3f94c4)', particle: 'wave', motion: 'drift', colors: ['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.16)'] },
    flowers: { sky: 'linear-gradient(#fbe3ea, #f3b2c4)', particle: 'petal', motion: 'fall', colors: ['#ee7f9e', '#ffffff', '#f6c04e'] },
    starlight: { sky: 'linear-gradient(#1c2350, #3a2f6e)', particle: 'spark', motion: 'twinkle', colors: ['#ffffff', '#ffe9a8', '#bcd0ff'] },
    stone: { sky: 'linear-gradient(#c9c4d6, #7c7490)', particle: 'rock', motion: 'fall', colors: ['#5e5870', '#8a8399', '#46415a'] },
    wind: { sky: 'linear-gradient(#dcefe6, #9cc9bd)', particle: 'gust', motion: 'drift', colors: ['#ffffff', '#f2fbf6'] },
    snow: { sky: 'linear-gradient(#dde9f4, #a4bfd8)', particle: 'flake', motion: 'fall', colors: ['#ffffff'] },
    // Wildlife expansion
    breeze: { sky: 'linear-gradient(#f6e3b4, #d98f4e)', particle: 'leaf', motion: 'drift', colors: ['#e0a93f', '#d8674f', '#c9822f'] },
    chance: { sky: 'linear-gradient(#fbe1ea, #d7a6c4)', particle: 'petal', motion: 'drift', colors: ['#ffffff', '#f4c1d4', '#9fc78c'] },
    clouds: { sky: 'linear-gradient(#cfe6f5, #f3efe4)', particle: 'gust', motion: 'drift', colors: ['#ffffff', '#f7f3ea'] },
    connecting: { sky: 'linear-gradient(#f6d58c, #8a4a2c)', particle: 'leaf', motion: 'fall', colors: ['#6f9a4e', '#c26a3a', '#f2c260'] },
    heights: { sky: 'linear-gradient(#a8d6ee, #e6a056)', particle: 'leaf', motion: 'fall', colors: ['#d8674f', '#e0a93f', '#f2c260'] },
    mists: { sky: 'linear-gradient(#f3f0d6, #a8c789)', particle: 'gust', motion: 'drift', colors: ['#ffffff', '#eef4e2'] },
    rain_checks: { sky: 'linear-gradient(#9fd8e0, #2f8fa6)', particle: 'drop', motion: 'fall', colors: ['#e2f6f8', '#bfe6ee'] },
    rain_or_shine: { sky: 'linear-gradient(#f5c27a, #2f6f86)', particle: 'drop', motion: 'fall', colors: ['#ffe9a8', '#d6eef2'] },
    sunshine: { sky: 'linear-gradient(#ffd27a, #d0703a)', particle: 'spark', motion: 'twinkle', colors: ['#fff6d6', '#ffe08a', '#ffffff'] },
    wonder: { sky: 'linear-gradient(#f1b36a, #4a3a78)', particle: 'spark', motion: 'twinkle', colors: ['#ffffff', '#ffe9a8', '#f4c1d4'] }
};

/** The icon that labels a Year card's progress track. */
export function yearTrackIcon(y: YearCard): string {
    const g = y.goal;
    switch (g.kind) {
        case 'SYMBOLS_AND_PHOTOS': return tokenIconId(g.symbol);
        case 'SYMBOLS_ANY_ONE_TYPE': return 'tok_any';
        case 'PARKS_WITH_SYMBOL':
        case 'PARKS_IN_POINT_RANGE': return 'park_glyph';
        case 'GEAR_COST_TOTAL': return tokenIconId('SUNSHINE');
        case 'SYMBOL_ICONS': return tokenIconId(g.symbol);
        case 'POINT_SETS':
        case 'INSTANT_PARKS': return 'park_glyph';
        case 'TOKENS_HELD':
        case 'SYMBOL_SETS': return 'tok_any';
        case 'PHOTOS': return 'photo';
        case 'WILDLIFE_HELD': return tokenIconId('WILDLIFE');
    }
}

export function yearTierLabel(tier: { threshold: number; photos?: number }): string {
    return tier.photos ? `${tier.threshold} + ${tier.photos}` : String(tier.threshold);
}

/**
 *   ┌───────────────────────┐
 *   │     Year of Peaks     │
 *   │ (ribbon)   6 + 3  → 2 │  thresholds and the points they pay
 *   │           10 + 5  → 3 │
 *   │ [   goal, as icons  ] │
 *   └───────────────────────┘
 */
export function getYearCardDefinition(y: YearCard): CardDefinition {
    // Nightfall cards pay per step, without limit: one row says the rate
    const rows: DataRow[] = y.rate
        ? [{ label: `per ${y.rate.per}`, value: String(y.rate.points) }]
        : y.tiers.map(t => ({ label: yearTierLabel(t), value: String(t.points) }));
    return {
        id: `year-${y.id}`,
        name: y.name,
        widthMm: CARD_W,
        heightMm: 64,
        borderRadiusMm: 3.4,
        palette: framePalette('year', '#8f6a4c', INK, '#f5ead8'),
        borderWidth: 0,
        header: { title: y.name, background: '#8f6a4c' },
        mainArt: { iconId: 'year_glyph', frameStyle: 'none' },
        data: { rows, background: 'none' },
        footer: { text: yearGoalLine(y), align: 'center', verticalAlign: 'center', background: 'none', color: INK, size: 2.1, italic: false, weight: 800 }
    };
}

/** The Season effect as an icon line, for the banner and the card. */
export function seasonEffectLine(s: SeasonCard): string {
    const e = s.effect;
    switch (e.kind) {
        case 'PARK_BONUS': return `${fi('park_glyph')} +${coin(e.token)}`;
        case 'ON_GAIN': return `${coin(e.when)}${fi('arrow')}+${coin(e.bonus)}`;
        case 'ON_CANTEEN': return `${fi('canteen')}${fi('arrow')}+${coin(e.bonus)}`;
        case 'PARK_DISCOUNT': return `${fi('park_glyph')} −${coin(e.token)}`;
        case 'GEAR_DISCOUNT': return `${fi('gear_glyph')} −${coin('SUNSHINE')}`;
        case 'END_BONUS': return `${fi('reserve_glyph')}${fi('gear_glyph')}${fi('visit_glyph')} +${coin(e.token)}`;
        case 'BLIND_VISIT': return `${SYMS.map(t => coin(t).repeat(e.cost[t] || 0)).join('')}${fi('arrow')}${fi('park_glyph')}?`;
        case 'GEAR_FLAT': return `${fi('gear_glyph')} = ${coin('SUNSHINE').repeat(e.cost)}`;
        case 'CAMPFIRE_SELF_PHOTO': return `${fi('campfire')} ${fi('tok_any')}${fi('arrow')}${fi('photo')}`;
        case 'GEAR_BONUS': return `${fi('gear_glyph')} +${coin(e.token)}`;
        case 'ON_FILL': return `${fi('canteen_full')}${fi('arrow')}+${coin(e.bonus)}`;
        case 'ON_RESERVE': return `${fi('reserve_glyph')}${fi('arrow')}+${coin(e.bonus)}`;
        case 'RESERVED_DISCOUNT': return `${fi('reserve_glyph')} −${e.tokens.map(coin).join('')}`;
        case 'CAMPFIRE_SHARE': return `${fi('campfire')}${fi('arrow')}+${coin(e.bonus)} all`;
        case 'ON_BUY_WILD': return `${fi('gear_glyph')} ${fi('tok_any')}${fi('arrow')}${coin('WILDLIFE')}`;
    }
}

export const bagList = (b: Bag): Token[] => TOKENS.reduce<Token[]>((all, t) => {
    for (let i = 0; i < (b[t] || 0); i++) all.push(t);
    return all;
}, []);
