/**
 * NightZooAssets.ts — flat, soft-pastel iconography + palette for Night at the Zoo.
 *
 * Design language: light, fun flat-vector illustration on a warm cream ground.
 * The six animals each get a distinct, appropriately-coloured geometric glyph
 * built from the card-renderer 0–100 `IconObject` DSL (negative space via
 * painter's-order layering, literal-hex fills so an animal's colours never shift
 * with the palette). Terrains, foods and action symbols share the same flat
 * vocabulary so the whole game reads as one system.
 */

import { IconObject, IconLayer, Palette, PrimitiveShape, CardDefinition } from '../../client/lib/card-renderer/types';
import {
    AnimalType, Terrain, Food, ActionSymbol, TileDef, ACTION_TILES,
    TERRAIN_COLORS, TERRAIN_INK, FOOD_COLORS, ANIMALS
} from './NightZooData';

// ---------------------------------------------------------------------------
// Authoring shorthand
// ---------------------------------------------------------------------------

type Extra = Partial<Pick<PrimitiveShape, 'stroke' | 'strokeWidth' | 'opacity' | 'customPath'>>;

const L = (
    id: string, type: PrimitiveShape['type'],
    x: number, y: number, sx: number, sy: number,
    rot = 0, fill = 'primary', extra: Extra = {}
): IconLayer => ({ id, type, x, y, scaleX: sx, scaleY: sy, rotation: rot, fill, ...extra });

const ring = (id: string, x: number, y: number, s: number, w: number, color: string): IconLayer =>
    L(id, 'circle', x, y, s, s, 0, 'none', { stroke: color, strokeWidth: w });

function icon(id: string, layers: IconLayer[]): IconObject {
    return { id, name: id, layers };
}

const WHITE = '#ffffff';
const INK = '#43404a';

// ---------------------------------------------------------------------------
// Palette (soft pastel)
// ---------------------------------------------------------------------------

export const NIGHTZOO_PALETTE: Palette = {
    id: 'nightzoo',
    name: 'Night at the Zoo',
    background: '#fdfbf6',
    border: '#e4ddcf',
    primary: '#5aa9a0',   // muted teal
    secondary: '#f2a65a', // warm apricot
    accent: '#f2a65a',
    charcoal: INK,
    text: '#4a4750',
    panelBg: '#fbf6ec',
    tertiary: '#efe7d7',
    success: '#7fbf7a',
    danger: '#e08a7d'
};

// ---------------------------------------------------------------------------
// Animals — distinct, appropriately-coloured flat glyphs
// ---------------------------------------------------------------------------

export const animalIconId = (t: AnimalType): string => `animal_${t}`;

const PENGUIN = ANIMALS.penguin.color; // slate navy
const CHEETAH = ANIMALS.cheetah.color; // amber
const WOLF = ANIMALS.wolf.color;       // cool grey
const SNAKE = ANIMALS.snake.color;     // green
const BUTTER = ANIMALS.butterfly.color;// orchid
const SLOTH = ANIMALS.sloth.color;     // taupe

const ANIMAL_ICONS: Record<AnimalType, IconObject> = {
    // Front-facing penguin: navy body, white belly, apricot beak & feet.
    penguin: icon('animal_penguin', [
        L('foot_l', 'circle', 42, 86, 0.24, 0.16, 0, '#f2a65a'),
        L('foot_r', 'circle', 58, 86, 0.24, 0.16, 0, '#f2a65a'),
        L('body', 'circle', 50, 58, 1.1, 1.42, 0, PENGUIN),
        L('head', 'circle', 50, 30, 0.82, 0.82, 0, PENGUIN),
        L('belly', 'circle', 50, 62, 0.64, 1.02, 0, WHITE),
        L('eye_l', 'circle', 43, 27, 0.12, 0.12, 0, INK),
        L('eye_r', 'circle', 57, 27, 0.12, 0.12, 0, INK),
        L('beak', 'triangle', 50, 35, 0.26, 0.24, 180, '#f2a65a')
    ]),

    // Cheetah face: amber, dark spots + tear lines, white muzzle.
    cheetah: icon('animal_cheetah', [
        L('ear_l', 'triangle', 28, 20, 0.52, 0.6, 0, CHEETAH),
        L('ear_r', 'triangle', 72, 20, 0.52, 0.6, 0, CHEETAH),
        L('face', 'circle', 50, 54, 1.62, 1.5, 0, CHEETAH),
        L('muzzle', 'circle', 50, 66, 0.66, 0.5, 0, WHITE),
        L('sp1', 'circle', 34, 36, 0.11, 0.11, 0, '#4a3113'),
        L('sp2', 'circle', 50, 30, 0.11, 0.11, 0, '#4a3113'),
        L('sp3', 'circle', 66, 36, 0.11, 0.11, 0, '#4a3113'),
        L('sp4', 'circle', 28, 52, 0.1, 0.1, 0, '#4a3113'),
        L('sp5', 'circle', 72, 52, 0.1, 0.1, 0, '#4a3113'),
        L('tear_l', 'rectangle', 41, 62, 0.05, 0.28, 0, '#4a3113'),
        L('tear_r', 'rectangle', 59, 62, 0.05, 0.28, 0, '#4a3113'),
        L('eye_l', 'circle', 41, 50, 0.14, 0.14, 0, '#4a3113'),
        L('eye_r', 'circle', 59, 50, 0.14, 0.14, 0, '#4a3113'),
        L('nose', 'triangle', 50, 62, 0.16, 0.14, 180, '#4a3113')
    ]),

    // Wolf head: cool grey, angular ears, lighter snout.
    wolf: icon('animal_wolf', [
        L('ear_l', 'triangle', 30, 20, 0.56, 0.72, 0, WOLF),
        L('ear_r', 'triangle', 70, 20, 0.56, 0.72, 0, WOLF),
        L('ear_li', 'triangle', 30, 24, 0.26, 0.34, 0, '#c9d0db'),
        L('ear_ri', 'triangle', 70, 24, 0.26, 0.34, 0, '#c9d0db'),
        L('face', 'circle', 50, 50, 1.5, 1.42, 0, WOLF),
        L('snout', 'triangle', 50, 70, 0.56, 0.66, 180, '#c9d0db'),
        L('eye_l', 'circle', 40, 46, 0.13, 0.16, 0, INK),
        L('eye_r', 'circle', 60, 46, 0.13, 0.16, 0, INK),
        L('nose', 'triangle', 50, 66, 0.16, 0.14, 180, INK)
    ]),

    // Snake: green coiled body (filled donut) with a head and a forked tongue.
    snake: icon('animal_snake', [
        L('coil', 'circle', 46, 58, 1.5, 1.5, 0, SNAKE),
        L('coil_hole', 'circle', 46, 58, 0.66, 0.66, 0, WHITE),
        L('head', 'circle', 74, 32, 0.56, 0.52, 0, SNAKE),
        L('eye', 'circle', 80, 28, 0.1, 0.1, 0, INK),
        L('tongue', 'triangle', 88, 26, 0.14, 0.18, 120, '#e0574f')
    ]),

    // Butterfly: four orchid wings, slim ink body + antennae.
    butterfly: icon('animal_butterfly', [
        L('w_tl', 'circle', 33, 37, 0.94, 0.82, 0, BUTTER),
        L('w_bl', 'circle', 35, 64, 0.78, 0.72, 0, BUTTER),
        L('w_tr', 'circle', 67, 37, 0.94, 0.82, 0, BUTTER),
        L('w_br', 'circle', 65, 64, 0.78, 0.72, 0, BUTTER),
        L('dot_l', 'circle', 32, 40, 0.2, 0.2, 0, WHITE),
        L('dot_r', 'circle', 68, 40, 0.2, 0.2, 0, WHITE),
        L('body', 'rectangle', 50, 52, 0.12, 0.92, 0, INK),
        L('head', 'circle', 50, 26, 0.16, 0.16, 0, INK),
        L('ant_l', 'rectangle', 44, 18, 0.03, 0.28, -28, INK),
        L('ant_r', 'rectangle', 56, 18, 0.03, 0.28, 28, INK)
    ]),

    // Sloth: taupe face, dark eye patches, sleepy smile.
    sloth: icon('animal_sloth', [
        L('face', 'circle', 50, 52, 1.52, 1.5, 0, SLOTH),
        L('patch_l', 'circle', 40, 48, 0.4, 0.5, 0, '#6f5844'),
        L('patch_r', 'circle', 60, 48, 0.4, 0.5, 0, '#6f5844'),
        L('eye_l', 'circle', 40, 49, 0.14, 0.14, 0, INK),
        L('eye_r', 'circle', 60, 49, 0.14, 0.14, 0, INK),
        L('nose', 'triangle', 50, 62, 0.2, 0.16, 180, '#6f5844'),
        L('smile', 'circle', 50, 66, 0.34, 0.3, 0, 'none', { stroke: '#6f5844', strokeWidth: 4 }),
        L('smile_mask', 'rectangle', 50, 60, 0.5, 0.3, 0, SLOTH)
    ])
};

// ---------------------------------------------------------------------------
// Terrain glyphs (soft chips)
// ---------------------------------------------------------------------------

export const terrainIconId = (t: Terrain): string => `terrain_${t}`;

const TERRAIN_ICONS: Record<Terrain, IconObject> = {
    // Grass: three blades.
    grass: icon('terrain_grass', [
        L('b1', 'triangle', 38, 56, 0.28, 0.8, -12, TERRAIN_INK.grass),
        L('b2', 'triangle', 50, 52, 0.3, 0.92, 0, TERRAIN_INK.grass),
        L('b3', 'triangle', 62, 56, 0.28, 0.8, 12, TERRAIN_INK.grass)
    ]),
    // Rocks: two stacked pebbles.
    rocks: icon('terrain_rocks', [
        L('r1', 'circle', 40, 58, 0.66, 0.5, 0, TERRAIN_INK.rocks),
        L('r2', 'circle', 62, 50, 0.56, 0.44, 0, TERRAIN_INK.rocks)
    ]),
    // Sand: dunes (two arches).
    sand: icon('terrain_sand', [
        L('d1', 'semi-circle', 38, 58, 1.0, 0.7, 0, TERRAIN_INK.sand),
        L('d2', 'semi-circle', 64, 60, 1.1, 0.8, 0, TERRAIN_INK.sand)
    ])
};

// ---------------------------------------------------------------------------
// Action-symbol glyphs
// ---------------------------------------------------------------------------

export const actionIconId = (a: ActionSymbol): string => `act_${a}`;

// A bold right-pointing arrow (shaft + head), rendered in 'primary' so it flips
// white (negative space on a coloured tile) or dark (on the board) via the palette.
const arrow = (id: string, cx: number, s = 1): IconLayer[] => [
    L(id + '_shaft', 'rectangle', cx - 6 * s, 50, 0.44 * s, 0.24 * s, 0, 'primary'),
    L(id + '_head', 'triangle', cx + 14 * s, 50, 0.5 * s, 0.66 * s, 90, 'primary')
];

// A five-point star sized/placed within the box (used for VP).
const star = (id: string, cx: number, cy: number, s: number): IconLayer =>
    L(id, 'bezier', 0, 0, 1, 1, 0, 'primary', {
        customPath: `M ${cx} ${cy - 30 * s} L ${cx + 9 * s} ${cy - 4 * s} L ${cx + 32 * s} ${cy - 4 * s} `
            + `L ${cx + 14 * s} ${cy + 12 * s} L ${cx + 21 * s} ${cy + 34 * s} L ${cx} ${cy + 20 * s} `
            + `L ${cx - 21 * s} ${cy + 34 * s} L ${cx - 14 * s} ${cy + 12 * s} L ${cx - 32 * s} ${cy - 4 * s} `
            + `L ${cx - 9 * s} ${cy - 4 * s} Z`
    });

const ACTION_ICONS: Record<ActionSymbol, IconObject> = {
    // single bold arrow
    move1: icon('act_move1', arrow('a', 50)),
    // two bold chevrons ">>" (solid right-pointing triangles)
    move2: icon('act_move2', [
        L('c1', 'triangle', 40, 50, 0.5, 0.78, 90, 'primary'),
        L('c2', 'triangle', 66, 50, 0.5, 0.78, 90, 'primary')
    ]),
    // discover: a bold paw print.
    discover: icon('act_discover', [
        L('pad', 'circle', 50, 62, 0.86, 0.72, 0, 'primary'),
        L('t1', 'circle', 30, 40, 0.34, 0.38, 0, 'primary'),
        L('t2', 'circle', 44, 28, 0.34, 0.38, 0, 'primary'),
        L('t3', 'circle', 58, 28, 0.34, 0.38, 0, 'primary'),
        L('t4', 'circle', 72, 40, 0.34, 0.38, 0, 'primary')
    ]),
    // bonus: a bold plus.
    bonus: icon('act_bonus', [
        L('v', 'rectangle', 50, 50, 0.32, 0.92, 0, 'primary'),
        L('h', 'rectangle', 50, 50, 0.92, 0.32, 0, 'primary')
    ]),
    // vp1: one star; vp2: two stars (the amount is encoded by doubling).
    vp1: icon('act_vp1', [star('s', 50, 50, 1.35)]),
    vp2: icon('act_vp2', [star('s1', 30, 50, 0.9), star('s2', 70, 50, 0.9)])
};

// Composite glyphs for the two-action tiles — the pair drawn side by side.
export const centralActionIconId = (actions: ActionSymbol[]): string =>
    actions.length === 1 ? actionIconId(actions[0]) : `acts_${actions.join('-')}`;

function buildActionComposite(actions: ActionSymbol[]): IconObject {
    const s = 0.54;
    const ref = (sym: ActionSymbol, cx: number): IconLayer => ({
        id: `r_${sym}`, type: 'ref', iconId: actionIconId(sym),
        x: cx - 50 * s, y: 50 - 50 * s, scale: s
    });
    return { id: centralActionIconId(actions), name: '', layers: [ref(actions[0], 30), ref(actions[1], 70)] };
}

// ---------------------------------------------------------------------------
// Food glyphs (simple flat single-colour shapes)
// ---------------------------------------------------------------------------

export const foodIconId = (f: Food): string => `food_${f}`;

const FOOD_ICONS: Record<Food, IconObject> = {
    // drumstick: a white bone with a forked knob, a rounded meat blob on the end
    meat: icon('food_meat', [
        L('bone', 'rectangle', 42, 42, 0.13, 0.7, 45, WHITE),
        L('knob1', 'circle', 24, 24, 0.22, 0.22, 0, WHITE),
        L('knob2', 'circle', 31, 17, 0.16, 0.16, 0, WHITE),
        L('knob3', 'circle', 17, 31, 0.16, 0.16, 0, WHITE),
        L('meat1', 'circle', 63, 63, 1.18, 1.08, 0, FOOD_COLORS.meat),
        L('meat2', 'circle', 51, 71, 0.62, 0.62, 0, FOOD_COLORS.meat)
    ]),
    fish: icon('food_fish', [
        L('body', 'circle', 46, 50, 1.1, 0.78, 0, FOOD_COLORS.fish),
        L('tail', 'triangle', 78, 50, 0.5, 0.6, 90, FOOD_COLORS.fish),
        L('eye', 'circle', 32, 44, 0.1, 0.1, 0, INK)
    ]),
    carrot: icon('food_carrot', [
        L('root', 'triangle', 50, 58, 0.7, 1.2, 180, FOOD_COLORS.carrot),
        L('leaf', 'triangle', 50, 22, 0.5, 0.5, 0, '#8fc879')
    ]),
    apple: icon('food_apple', [
        L('body', 'circle', 50, 56, 1.3, 1.25, 0, FOOD_COLORS.apple),
        L('leaf', 'triangle', 60, 26, 0.28, 0.3, 30, '#8fc879'),
        L('stem', 'rectangle', 50, 26, 0.05, 0.24, 0, '#7a5a3a')
    ]),
    // banana: a curved crescent with browned tips
    banana: icon('food_banana', [
        L('body', 'bezier', 0, 0, 1, 1, 0, FOOD_COLORS.banana, {
            customPath: 'M 30 16 C 6 40 10 74 44 88 C 34 72 27 46 43 24 Z'
        }),
        L('tip1', 'circle', 31, 18, 0.11, 0.11, 0, '#7a5a3a'),
        L('tip2', 'circle', 43, 86, 0.11, 0.11, 0, '#7a5a3a')
    ]),
    // leaf: a pointed blade with a central midrib + side veins
    leaves: icon('food_leaves', [
        L('blade', 'bezier', 0, 0, 1, 1, 0, FOOD_COLORS.leaves, {
            customPath: 'M 50 12 C 78 34 78 64 52 88 C 24 64 24 34 50 12 Z'
        }),
        L('midrib', 'rectangle', 51, 50, 0.035, 0.62, 6, '#3f6b45'),
        L('vein1', 'rectangle', 42, 40, 0.028, 0.22, -40, '#3f6b45'),
        L('vein2', 'rectangle', 60, 56, 0.028, 0.22, -40, '#3f6b45')
    ]),
    // honey: a honeycomb hexagon (with a comb cell) and a dripping drop
    honey: icon('food_honey', [
        L('comb', 'bezier', 0, 0, 1, 1, 0, FOOD_COLORS.honey, {
            customPath: 'M 50 12 L 77 28 L 77 58 L 50 74 L 23 58 L 23 28 Z'
        }),
        L('cell', 'bezier', 0, 0, 1, 1, 0, '#c99a1f', {
            customPath: 'M 50 28 L 64 36 L 64 52 L 50 60 L 36 52 L 36 36 Z'
        }),
        L('drip_t', 'triangle', 50, 76, 0.28, 0.4, 0, FOOD_COLORS.honey),
        L('drip_d', 'circle', 50, 87, 0.26, 0.26, 0, FOOD_COLORS.honey)
    ])
};

// A food glyph centred on a dark disc, so the colour pops on any terrain.
export const foodDiscIconId = (f: Food): string => `fooddisc_${f}`;
const FOOD_DISC = '#24242c';

function buildFoodDisc(food: Food): IconObject {
    return {
        id: foodDiscIconId(food), name: '',
        layers: [
            L('disc', 'circle', 50, 50, 1.94, 1.94, 0, FOOD_DISC),
            { id: 'glyph', type: 'ref', iconId: foodIconId(food), x: 50 - 50 * 0.64, y: 50 - 50 * 0.64, scale: 0.64 }
        ]
    };
}

// A chain-link glyph — marks the two cells of a paired group as one linked set.
export const LINK_ICON: IconObject = icon('link', [
    L('r1', 'circle', 39, 50, 0.5, 0.5, 0, 'none', { stroke: 'primary', strokeWidth: 10 }),
    L('r2', 'circle', 61, 50, 0.5, 0.5, 0, 'none', { stroke: 'primary', strokeWidth: 10 })
]);

// ---------------------------------------------------------------------------
// Combined icon map (passed to ExpressiveIcon / customIcons)
// ---------------------------------------------------------------------------

export const NIGHTZOO_ICONS: Record<string, IconObject> = (() => {
    const all: Record<string, IconObject> = {};
    (Object.keys(ANIMAL_ICONS) as AnimalType[]).forEach(t => { all[animalIconId(t)] = ANIMAL_ICONS[t]; });
    (Object.keys(TERRAIN_ICONS) as Terrain[]).forEach(t => { all[terrainIconId(t)] = TERRAIN_ICONS[t]; });
    (Object.keys(ACTION_ICONS) as ActionSymbol[]).forEach(a => { all[actionIconId(a)] = ACTION_ICONS[a]; });
    (Object.keys(FOOD_ICONS) as Food[]).forEach(f => {
        all[foodIconId(f)] = FOOD_ICONS[f];
        all[foodDiscIconId(f)] = buildFoodDisc(f);
    });
    all['link'] = LINK_ICON;
    // register the composite glyphs for every two-action tile in the deck
    for (const tile of ACTION_TILES) {
        if (tile.actions.length === 2) {
            const id = centralActionIconId(tile.actions);
            if (!all[id]) all[id] = buildActionComposite(tile.actions);
        }
    }
    return all;
})();

export function getIcon(id: string): IconObject | undefined {
    return NIGHTZOO_ICONS[id];
}

// ---------------------------------------------------------------------------
// Tile-as-card: per-terrain palettes + a square CardDefinition builder
// ---------------------------------------------------------------------------

/**
 * Palette for a tile card. `primary` drives the central action glyph: white so
 * it reads as negative space on a drafted/hand tile, dark ink when placed on the
 * neighborhood board.
 */
export function tilePalette(terrain: Terrain, onBoard: boolean): Palette {
    const glyph = onBoard ? '#26262b' : '#ffffff';
    return {
        id: `nztile_${terrain}_${onBoard ? 'b' : 't'}`,
        name: terrain,
        background: TERRAIN_COLORS[terrain],
        border: TERRAIN_INK[terrain],
        primary: glyph,
        secondary: glyph,
        accent: glyph,
        charcoal: TERRAIN_INK[terrain],
        text: TERRAIN_INK[terrain],
        panelBg: 'transparent',
        tertiary: TERRAIN_COLORS[terrain],
        success: '#7fbf7a',
        danger: '#e08a7d'
    };
}

/** Central icon id + scale for a tile: its action(s) or its food-on-disc.
 *  Bonus tiles (no food, no actions) are plain — they show no central icon. */
function tileCentral(tile: TileDef): { iconId: string; scaling: number } | null {
    if (tile.food) return { iconId: foodDiscIconId(tile.food), scaling: 0.94 };
    if (tile.actions.length > 0) return { iconId: centralActionIconId(tile.actions), scaling: 0.94 };
    return null; // plain bonus tile
}

/** Build a square CardDefinition for a tile (drafted/hand tile, or one on the board). */
export function buildTileCard(tile: TileDef, onBoard: boolean): CardDefinition {
    const central = tileCentral(tile);
    return {
        id: tile.id,
        name: '',
        widthMm: 30,
        heightMm: 30,
        borderRadiusMm: 4.5,
        palette: tilePalette(tile.terrain, onBoard),
        borderWidth: onBoard ? 0 : 0.1,
        borderColor: 'border',
        mainArt: central ? { iconId: central.iconId, frameStyle: 'none', scaling: central.scaling } : undefined
    };
}

export { TERRAIN_COLORS, FOOD_COLORS };
