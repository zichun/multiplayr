/**
 * WingspanAssets.ts — flat-vector iconography, palettes, and card builders for
 * Wingspan (Pocket).
 *
 * Design language: light, fun, bright flat-vector illustration. Birds are clean
 * geometric silhouettes with a signature "target eye" (a bullseye of white +
 * ink) and use **palette keys** for their fills, so the *same* 15 silhouettes
 * recolour across the 8 vibrant palettes to produce the whole card gallery
 * (15 shapes × 8 palettes). The 5 food powers are distinct negative-space coins
 * that read the same on a card cost, in the reserve, and on a supply deck.
 *
 * Everything is authored in the card-renderer 0–100 `IconObject` DSL using only
 * painter's-order layering (no boolean masks), so glyphs render identically via
 * React `ExpressiveIcon` and the React-free `iconToSvg` path, and verify in the
 * headless inspector (`npm run inspect`).
 */

import { CardDefinition, Palette, IconObject, IconLayer, PrimitiveShape, DataRow } from '../../client/lib/card-renderer/types';
import {
    BirdCard, FoodType, FOOD_TYPES, PaletteId, ShapeId, SHAPE_IDS, PowerEffect
} from './WingspanData';

// ---------------------------------------------------------------------------
// Authoring shorthand
// ---------------------------------------------------------------------------

type Extra = Partial<Pick<PrimitiveShape, 'stroke' | 'strokeWidth' | 'opacity' | 'customPath'>>;

const L = (
    id: string, type: PrimitiveShape['type'],
    x: number, y: number, sx: number, sy: number,
    rot = 0, fill = 'primary', extra: Extra = {}
): IconLayer => ({ id, type, x, y, scaleX: sx, scaleY: sy, rotation: rot, fill, ...extra });

function icon(id: string, layers: IconLayer[]): IconObject {
    return { id, name: id, layers };
}

const WHITE = '#ffffff';

// Palette-key roles used by every bird silhouette:
//   BODY   = primary     (main plumage)
//   WING   = secondary   (wing / tail / darker plumage)
//   BEAK   = accent      (beak, legs, comb — warm)
//   BELLY  = background   (belly / negative space — the card ground)
//   INK    = charcoal    (eye pupil, outlines)
const BODY = 'primary', WING = 'secondary', BEAK = 'accent', BELLY = 'background', INK = 'charcoal';

/** The signature bullseye eye: ink ring, white ring, ink pupil. Reads on any body. */
function eye(cx: number, cy: number, s = 1): IconLayer[] {
    return [
        L(`eye_o_${cx}_${cy}`, 'circle', cx, cy, 0.24 * s, 0.24 * s, 0, INK),
        L(`eye_w_${cx}_${cy}`, 'circle', cx, cy, 0.17 * s, 0.17 * s, 0, WHITE),
        L(`eye_p_${cx}_${cy}`, 'circle', cx, cy, 0.085 * s, 0.085 * s, 0, INK)
    ];
}

// ===========================================================================
// 8 vibrant flat palettes
// ===========================================================================
// Each supplies a bird-appropriate primary/secondary/accent trio on a bright,
// near-white ground. `charcoal`/`text` are the ink used for the eye and body
// copy; `panelBg` tints the cost strip; `success`/`danger` stay conventional.

function pal(
    id: string, name: string,
    background: string, primary: string, secondary: string, accent: string,
    ink: string, panelBg: string
): Palette {
    return {
        id: `wingspan_${id}`, name,
        background, border: secondary, primary, secondary, accent,
        charcoal: ink, text: ink, panelBg,
        tertiary: accent, success: '#5cb87f', danger: '#e0574f'
    };
}

export const WINGSPAN_PALETTES: Record<PaletteId, Palette> = {
    cardinal: pal('cardinal', 'Cardinal', '#fffaf6', '#e8503a', '#b8342a', '#f4a63b', '#3a2320', '#fdeee9'),
    bluebird: pal('bluebird', 'Bluebird', '#f8fbff', '#4a90d9', '#2f6fb0', '#f4a63b', '#1f2b3a', '#e8f1fb'),
    goldfinch: pal('goldfinch', 'Goldfinch', '#fffdf3', '#f2c744', '#e2942a', '#3a3330', '#3a3020', '#fbf3d8'),
    emerald: pal('emerald', 'Emerald', '#f5fdf8', '#3fb984', '#2a8f66', '#f0a93f', '#1e3a2e', '#e4f6ec'),
    sunset: pal('sunset', 'Sunset', '#fffbf4', '#f2803a', '#d9532f', '#ffd15c', '#3a2418', '#fcecdb'),
    orchid: pal('orchid', 'Orchid', '#fdf9ff', '#b76bd0', '#8b46b0', '#f39ac4', '#331f3a', '#f3e7f9'),
    teal: pal('teal', 'Teal', '#f4fdfd', '#2fb1ab', '#1f8a8a', '#f4a63b', '#173636', '#e0f4f3'),
    slate: pal('slate', 'Slate', '#fafbfc', '#5b6b7c', '#37424f', '#f0a93f', '#22282f', '#eef1f4')
};

export function getWingspanPalette(id: PaletteId): Palette {
    return WINGSPAN_PALETTES[id] || WINGSPAN_PALETTES.slate;
}

// ===========================================================================
// 15 geometric bird silhouettes (facing right, beak on the right)
// ===========================================================================

export const birdIconId = (s: ShapeId): string => `bird_${s}`;

const legs = (x1: number, x2: number, y: number, h: number): IconLayer[] => [
    L(`leg_a_${x1}`, 'rectangle', x1, y, 0.05, h, 0, BEAK),
    L(`leg_b_${x2}`, 'rectangle', x2, y, 0.05, h, 0, BEAK)
];

const BIRD_ICONS: Record<ShapeId, IconObject> = {
    // Plump perching songbird — round body + head, short beak, cocked tail.
    songbird: icon('bird_songbird', [
        L('tail', 'triangle', 18, 50, 0.5, 0.42, -60, WING),
        L('body', 'circle', 44, 60, 1.34, 1.28, 0, BODY),
        L('wing', 'circle', 42, 62, 0.72, 0.86, 20, WING),
        L('head', 'circle', 64, 40, 0.92, 0.92, 0, BODY),
        L('beak', 'triangle', 80, 40, 0.34, 0.3, 90, BEAK),
        ...legs(44, 54, 84, 0.28),
        ...eye(66, 37, 1)
    ]),

    // Raptor — fierce brow, hooked beak, swept wing, talons.
    raptor: icon('bird_raptor', [
        L('wing', 'bezier', 0, 0, 1, 1, 0, WING, { customPath: 'M 20 30 C 8 52 20 78 46 78 L 46 46 Z' }),
        L('body', 'circle', 50, 60, 1.28, 1.44, 0, BODY),
        L('head', 'circle', 64, 38, 0.98, 0.94, 0, BODY),
        L('brow', 'triangle', 66, 30, 0.6, 0.34, 90, WING),
        L('beak_u', 'triangle', 82, 40, 0.36, 0.32, 90, BEAK),
        L('beak_hook', 'triangle', 82, 46, 0.2, 0.24, 180, BEAK),
        ...legs(46, 56, 86, 0.24),
        ...eye(68, 38, 1)
    ]),

    // Duck — broad body, flat bill, upturned tail on water.
    duck: icon('bird_duck', [
        L('tail', 'triangle', 16, 52, 0.44, 0.4, -50, WING),
        L('body', 'circle', 44, 62, 1.66, 1.14, 0, BODY),
        L('wing', 'circle', 40, 62, 0.86, 0.66, 0, WING),
        L('neck', 'rectangle', 66, 50, 0.34, 0.7, 0, BODY),
        L('head', 'circle', 70, 38, 0.82, 0.82, 0, BODY),
        L('bill', 'arch', 84, 40, 0.4, 0.26, 90, BEAK),
        ...eye(72, 36, 0.9)
    ]),

    // Heron — S-neck, dagger bill, long stilt legs.
    heron: icon('bird_heron', [
        L('body', 'circle', 40, 62, 1.18, 0.94, 0, BODY),
        L('wing', 'triangle', 34, 62, 0.7, 0.7, 30, WING),
        L('neck1', 'rectangle', 54, 50, 0.22, 0.7, 18, BODY),
        L('neck2', 'rectangle', 60, 34, 0.22, 0.56, -18, BODY),
        L('head', 'circle', 64, 24, 0.5, 0.5, 0, BODY),
        L('bill', 'triangle', 82, 24, 0.5, 0.22, 90, BEAK),
        L('crest', 'triangle', 60, 16, 0.34, 0.3, -50, WING),
        ...legs(38, 46, 88, 0.5),
        ...eye(66, 23, 0.7)
    ]),

    // Hummingbird — tiny body, needle bill, swept wing, fanned tail.
    hummingbird: icon('bird_hummingbird', [
        L('wing', 'bezier', 0, 0, 1, 1, 0, WING, { customPath: 'M 30 40 C 4 34 4 66 34 60 Z' }),
        L('tail', 'triangle', 22, 66, 0.4, 0.44, -40, WING),
        L('body', 'circle', 46, 54, 0.86, 0.78, 0, BODY),
        L('head', 'circle', 60, 44, 0.62, 0.62, 0, BODY),
        L('bill', 'rectangle', 82, 42, 0.42, 0.05, 8, BEAK),
        L('gorget', 'triangle', 58, 54, 0.3, 0.24, 180, BEAK),
        ...eye(62, 42, 0.7)
    ]),

    // Owl — front-facing, big head, two eyes, ear tufts, chevroned belly.
    owl: icon('bird_owl', [
        L('tuft_l', 'triangle', 34, 16, 0.4, 0.5, 0, WING),
        L('tuft_r', 'triangle', 66, 16, 0.4, 0.5, 0, WING),
        L('body', 'arch', 50, 58, 1.5, 1.34, 0, BODY),
        L('head', 'circle', 50, 34, 1.36, 1.2, 0, BODY),
        L('belly', 'circle', 50, 66, 0.86, 0.8, 0, BELLY),
        L('chev1', 'triangle', 50, 60, 0.3, 0.2, 180, WING),
        L('chev2', 'triangle', 50, 70, 0.3, 0.2, 180, WING),
        L('beak', 'triangle', 50, 40, 0.22, 0.26, 180, BEAK),
        ...eye(38, 34, 1.1),
        ...eye(62, 34, 1.1)
    ]),

    // Swallow — swept pointed wings, forked tail, in flight.
    swallow: icon('bird_swallow', [
        L('wing_l', 'bezier', 0, 0, 1, 1, 0, WING, { customPath: 'M 46 46 C 22 24 8 26 6 40 C 24 40 36 46 46 54 Z' }),
        L('wing_r', 'bezier', 0, 0, 1, 1, 0, WING, { customPath: 'M 54 46 C 78 24 92 26 94 40 C 76 40 64 46 54 54 Z' }),
        L('tail_l', 'triangle', 40, 82, 0.26, 0.5, 20, WING),
        L('tail_r', 'triangle', 52, 82, 0.26, 0.5, -20, WING),
        L('body', 'circle', 50, 52, 0.66, 1.02, 0, BODY),
        L('head', 'circle', 50, 34, 0.62, 0.58, 0, BODY),
        L('bib', 'triangle', 50, 44, 0.3, 0.24, 180, BEAK),
        ...eye(56, 33, 0.65),
        ...eye(44, 33, 0.65)
    ]),

    // Parrot — hooked beak, head crest, long down-sweeping tail.
    parrot: icon('bird_parrot', [
        L('tail', 'bezier', 0, 0, 1, 1, 0, WING, { customPath: 'M 40 58 C 30 78 26 92 34 96 C 44 86 48 72 50 62 Z' }),
        L('body', 'circle', 46, 56, 1.24, 1.36, 0, BODY),
        L('wing', 'circle', 42, 58, 0.72, 0.94, 10, WING),
        L('crest', 'triangle', 60, 22, 0.34, 0.5, 20, WING),
        L('head', 'circle', 62, 40, 0.88, 0.88, 0, BODY),
        L('beak_u', 'arch', 80, 40, 0.34, 0.3, 120, BEAK),
        L('beak_hook', 'triangle', 80, 47, 0.22, 0.26, 180, BEAK),
        ...legs(46, 54, 86, 0.22),
        ...eye(64, 38, 0.95)
    ]),

    // Flamingo — S-neck, down-curved bill with dark tip, long legs.
    flamingo: icon('bird_flamingo', [
        L('body', 'circle', 40, 54, 1.28, 1.02, 0, BODY),
        L('tail', 'triangle', 20, 50, 0.36, 0.4, -60, WING),
        L('wing', 'circle', 42, 56, 0.66, 0.6, 0, WING),
        L('neck1', 'rectangle', 56, 42, 0.18, 0.7, 30, BODY),
        L('neck2', 'rectangle', 64, 28, 0.18, 0.44, -46, BODY),
        L('head', 'circle', 58, 22, 0.44, 0.44, 0, BODY),
        L('bill', 'arch', 50, 24, 0.32, 0.26, 210, BEAK),
        L('bill_tip', 'triangle', 44, 30, 0.18, 0.2, 200, INK),
        ...legs(38, 46, 84, 0.6),
        ...eye(60, 21, 0.6)
    ]),

    // Woodpecker — upright, chisel bill, pointed crest, stiff tail.
    woodpecker: icon('bird_woodpecker', [
        L('tail', 'triangle', 40, 86, 0.32, 0.44, 0, WING),
        L('body', 'circle', 48, 60, 1.02, 1.5, -12, BODY),
        L('wing', 'bezier', 0, 0, 1, 1, 0, WING, { customPath: 'M 36 40 C 28 60 30 80 42 86 L 46 50 Z' }),
        L('head', 'circle', 58, 32, 0.86, 0.9, 0, BODY),
        L('crest', 'triangle', 54, 16, 0.34, 0.46, 10, BEAK),
        L('bill', 'triangle', 78, 32, 0.44, 0.2, 90, BEAK),
        ...eye(60, 30, 0.85)
    ]),

    // Rooster/fowl — comb, wattle, big sickle tail plumes.
    rooster: icon('bird_rooster', [
        L('tail1', 'bezier', 0, 0, 1, 1, 0, WING, { customPath: 'M 34 56 C 12 40 8 16 20 12 C 24 32 40 44 48 52 Z' }),
        L('tail2', 'bezier', 0, 0, 1, 1, 0, WING, { customPath: 'M 34 58 C 16 52 10 34 20 26 C 26 42 42 50 48 56 Z', opacity: 0.85 }),
        L('body', 'circle', 50, 62, 1.36, 1.32, 0, BODY),
        L('wing', 'circle', 48, 64, 0.82, 0.88, 10, WING),
        L('head', 'circle', 66, 42, 0.82, 0.86, 0, BODY),
        L('comb1', 'circle', 62, 28, 0.2, 0.2, 0, BEAK),
        L('comb2', 'circle', 70, 26, 0.2, 0.2, 0, BEAK),
        L('comb3', 'circle', 76, 30, 0.18, 0.18, 0, BEAK),
        L('beak', 'triangle', 82, 44, 0.3, 0.26, 90, BEAK),
        L('wattle', 'circle', 74, 52, 0.16, 0.22, 0, BEAK),
        ...legs(48, 58, 86, 0.3),
        ...eye(68, 42, 0.85)
    ]),

    // Gull — streamlined body, long swept wing, square tail.
    gull: icon('bird_gull', [
        L('wing', 'bezier', 0, 0, 1, 1, 0, WING, { customPath: 'M 46 46 C 22 30 8 34 8 48 C 26 46 38 50 48 56 Z' }),
        L('tail', 'rectangle', 20, 60, 0.28, 0.3, 0, WING),
        L('body', 'circle', 46, 58, 1.44, 1.0, 0, BODY),
        L('head', 'circle', 68, 44, 0.74, 0.74, 0, BODY),
        L('bill', 'triangle', 84, 46, 0.4, 0.22, 90, BEAK),
        L('bill_spot', 'circle', 84, 48, 0.08, 0.08, 0, '#e0574f'),
        ...eye(70, 42, 0.8)
    ]),

    // Kingfisher — big head, huge dagger bill, stubby body & tail.
    kingfisher: icon('bird_kingfisher', [
        L('tail', 'triangle', 20, 60, 0.34, 0.34, -70, WING),
        L('body', 'circle', 42, 60, 1.1, 1.14, 0, BODY),
        L('wing', 'circle', 40, 62, 0.66, 0.7, 0, WING),
        L('head', 'circle', 62, 40, 1.06, 1.02, 0, BODY),
        L('crest', 'triangle', 56, 22, 0.3, 0.34, -20, WING),
        L('bill', 'triangle', 88, 42, 0.66, 0.2, 90, BEAK),
        ...legs(44, 52, 84, 0.18),
        ...eye(64, 38, 1)
    ]),

    // Pelican — big body, long bill with a deep pouch.
    pelican: icon('bird_pelican', [
        L('tail', 'triangle', 16, 54, 0.4, 0.4, -60, WING),
        L('body', 'circle', 42, 58, 1.6, 1.28, 0, BODY),
        L('wing', 'circle', 40, 60, 0.9, 0.82, 0, WING),
        L('neck', 'rectangle', 64, 46, 0.34, 0.6, 0, BODY),
        L('head', 'circle', 68, 34, 0.66, 0.66, 0, BODY),
        L('bill', 'rectangle', 82, 36, 0.7, 0.12, 8, BEAK),
        L('pouch', 'arch', 80, 46, 0.5, 0.4, 180, BEAK),
        ...eye(70, 32, 0.7)
    ]),

    // Finch — chunky body, thick conical seed bill, wing bar, notched tail.
    finch: icon('bird_finch', [
        L('tail', 'triangle', 20, 54, 0.4, 0.4, -55, WING),
        L('body', 'circle', 46, 58, 1.4, 1.3, 0, BODY),
        L('wing', 'circle', 42, 60, 0.78, 0.7, 12, WING),
        L('wingbar', 'rectangle', 42, 66, 0.5, 0.08, 12, BEAK),
        L('head', 'circle', 66, 44, 0.86, 0.84, 0, BODY),
        L('beak_u', 'triangle', 82, 44, 0.4, 0.34, 90, BEAK),
        L('beak_l', 'triangle', 82, 50, 0.34, 0.24, 90, WING),
        ...legs(48, 58, 84, 0.24),
        ...eye(68, 42, 0.9)
    ])
};

// ===========================================================================
// 5 food-power coins (distinct negative-space glyphs on coloured discs)
// ===========================================================================

export const foodIconId = (f: FoodType): string => `food_${f}`;

// Distinct, vibrant disc hues, one per food type — a saturated green / yellow /
// blue / red / grey so the five foods are instantly identifiable.
export const FOOD_DISC_COLOR: Record<FoodType, string> = {
    invertebrate: '#2fb84c', // vibrant green (worm)
    seed: '#f5c211',         // vibrant yellow (seed)
    fish: '#2b8fe0',         // vibrant blue (fish)
    fruit: '#e63a46',        // vibrant red (fruit)
    rodent: '#8b939d'        // grey (rodent)
};

/** disc + white knockout glyph layers. */
function coin(id: string, disc: string, glyph: IconLayer[]): IconObject {
    return icon(id, [
        { id: 'disc', type: 'circle', x: 50, y: 50, scaleX: 1.9, scaleY: 1.9, fill: disc } as IconLayer,
        ...glyph
    ]);
}

const FOOD_ICONS: Record<FoodType, IconObject> = {
    // caterpillar/grub — an arc of white segments + two antennae
    invertebrate: coin('food_invertebrate', FOOD_DISC_COLOR.invertebrate, [
        L('s1', 'circle', 30, 62, 0.28, 0.28, 0, WHITE),
        L('s2', 'circle', 42, 54, 0.3, 0.3, 0, WHITE),
        L('s3', 'circle', 55, 50, 0.32, 0.32, 0, WHITE),
        L('s4', 'circle', 68, 52, 0.3, 0.3, 0, WHITE),
        L('ant1', 'rectangle', 74, 42, 0.03, 0.18, 30, WHITE),
        L('ant2', 'rectangle', 80, 42, 0.03, 0.18, 10, WHITE)
    ]),
    // two seeds — a pair of pointed teardrops
    seed: coin('food_seed', FOOD_DISC_COLOR.seed, [
        L('sd1', 'bezier', 0, 0, 1, 1, 0, WHITE, { customPath: 'M 40 28 C 56 40 56 60 40 72 C 30 60 30 40 40 28 Z' }),
        L('sd2', 'bezier', 0, 0, 1, 1, 0, WHITE, { customPath: 'M 62 34 C 74 44 74 62 62 72 C 54 62 54 44 62 34 Z', opacity: 0.9 })
    ]),
    // fish — teardrop body + triangular tail + eye dot
    fish: coin('food_fish', FOOD_DISC_COLOR.fish, [
        L('body', 'circle', 46, 50, 0.98, 0.66, 0, WHITE),
        L('tail', 'triangle', 74, 50, 0.42, 0.5, 90, WHITE),
        L('eye', 'circle', 34, 46, 0.09, 0.09, 0, FOOD_DISC_COLOR.fish)
    ]),
    // cherries — two berries on stems
    fruit: coin('food_fruit', FOOD_DISC_COLOR.fruit, [
        L('stem1', 'rectangle', 45, 40, 0.03, 0.3, 20, WHITE),
        L('stem2', 'rectangle', 58, 40, 0.03, 0.3, -20, WHITE),
        L('leaf', 'triangle', 52, 28, 0.24, 0.16, 90, WHITE),
        L('berry1', 'circle', 40, 62, 0.42, 0.42, 0, WHITE),
        L('berry2', 'circle', 62, 62, 0.42, 0.42, 0, WHITE)
    ]),
    // mouse — body + big ear + curled tail
    rodent: coin('food_rodent', FOOD_DISC_COLOR.rodent, [
        L('body', 'circle', 46, 56, 0.86, 0.72, 0, WHITE),
        L('ear', 'circle', 60, 40, 0.36, 0.36, 0, WHITE),
        L('nose', 'circle', 30, 58, 0.16, 0.16, 0, WHITE),
        L('tail', 'bezier', 0, 0, 1, 1, 0, 'none', { customPath: 'M 62 66 C 78 66 80 50 72 46', stroke: WHITE, strokeWidth: 5 })
    ])
};

// ===========================================================================
// Egg / feather (VP) / wingspan / beak glyphs
// ===========================================================================

// A warm brown/orange egg — chosen so it is clearly distinct from the yellow
// seed coin. Used for laid eggs and the egg cost/limit coin.
const EGG_COLOR = '#c67536';   // brown-orange egg
const EGG_DISC = '#eceef1';    // very faint grey disc it sits in
export const EGG_ICON: IconObject = icon('egg', [
    L('egg', 'bezier', 0, 0, 1, 1, 0, EGG_COLOR, {
        customPath: 'M 50 16 C 70 30 76 58 62 78 C 52 88 40 88 34 78 C 24 58 32 30 50 16 Z',
        stroke: '#9a561f', strokeWidth: 2
    })
]);
// Egg as a coin: a very faint grey disc with the brown-orange egg on top.
export const EGG_COIN: IconObject = coin('egg_coin', EGG_DISC, [
    L('egg', 'bezier', 0, 0, 1, 1, 0, EGG_COLOR, {
        customPath: 'M 50 24 C 66 36 70 58 60 74 C 52 82 44 82 38 74 C 28 58 34 36 50 24 Z'
    })
]);
// A wild "any food" coin — a rainbow-ish neutral disc with a star knockout.
export const ANY_COIN: IconObject = coin('any_coin', '#8a8f98', [
    L('star', 'bezier', 0, 0, 1, 1, 0, WHITE, {
        customPath: 'M 50 24 L 57 42 L 76 42 L 61 54 L 67 72 L 50 61 L 33 72 L 39 54 L 24 42 L 43 42 Z'
    })
]);

// Feather = victory points. Warm gold so it pops on any coloured header band.
export const FEATHER_ICON: IconObject = icon('feather', [
    L('quill', 'bezier', 0, 0, 1, 1, 0, '#ffe08a', {
        customPath: 'M 74 20 C 40 26 22 54 24 82 C 52 82 82 60 84 26 C 84 22 80 18 74 20 Z'
    }),
    L('rib', 'rectangle', 52, 54, 0.03, 0.62, 42, '#d9a520')
]);

// A small wing chevron used to label wingspan.
export const WING_ICON: IconObject = icon('wing', [
    L('w1', 'bezier', 0, 0, 1, 1, 0, 'charcoal', { customPath: 'M 10 62 C 34 40 60 38 90 42 C 60 52 40 60 30 74 Z' })
]);

export const beakIconId = (d: 'L' | 'R'): string => `beak_${d}`;
const BEAK_ICONS: Record<string, IconObject> = {
    beak_L: icon('beak_L', [L('t', 'triangle', 50, 50, 0.6, 0.44, -90, 'charcoal')]),
    beak_R: icon('beak_R', [L('t', 'triangle', 50, 50, 0.6, 0.44, 90, 'charcoal')])
};

// ===========================================================================
// Combined icon map (passed to <PlayingCard customIcons={…}> / ExpressiveIcon)
// ===========================================================================

export const WINGSPAN_ICONS: Record<string, IconObject> = (() => {
    const all: Record<string, IconObject> = {};
    SHAPE_IDS.forEach(s => { all[birdIconId(s)] = BIRD_ICONS[s]; });
    FOOD_TYPES.forEach(f => { all[foodIconId(f)] = FOOD_ICONS[f]; });
    all['egg'] = EGG_ICON;
    all['egg_coin'] = EGG_COIN;
    all['any_coin'] = ANY_COIN;
    all['feather'] = FEATHER_ICON;
    all['wing'] = WING_ICON;
    all['beak_L'] = BEAK_ICONS.beak_L;
    all['beak_R'] = BEAK_ICONS.beak_R;
    return all;
})();

export function getIcon(id: string): IconObject | undefined {
    return WINGSPAN_ICONS[id];
}

// ===========================================================================
// Human-readable power text (for the card footer + rules)
// ===========================================================================

const foodLabel = (f: FoodType | 'any'): string => f === 'any' ? 'any food' : f;

export function describePower(e: PowerEffect): string {
    switch (e.op) {
        case 'none': return 'No power';
        case 'draw_food': return `Draw ${foodLabel(e.food)}`;
        case 'gain_food': return `Gain ${foodLabel(e.food)}`;
        case 'draw_bird': {
            const f = e.filter;
            if (!f) return 'Draw a bird';
            if (f.cost_contains) return `Draw a bird with ${f.cost_contains} in cost`;
            if (f.egg_limit != null) return `Draw a bird (egg limit ${f.egg_limit})`;
            if (f.egg_limit_min != null) return `Draw a bird (egg limit ${f.egg_limit_min}+)`;
            if (f.select === 'largest_wingspan') return 'Draw the largest-wingspan bird';
            if (f.select === 'smallest_wingspan') return 'Draw the smallest-wingspan bird';
            return 'Draw a bird';
        }
        case 'draw_card': return 'Draw any card';
        case 'tuck': return e.food ? `Tuck a ${e.food} card (+1)` : 'Tuck a card (+1)';
        case 'lay_egg': {
            const n = e.count || 1;
            const where = e.target === 'this' ? ' on this bird' : e.target === 'another' ? ' on another bird' : '';
            return `Lay ${n} egg${n > 1 ? 's' : ''}${where}`;
        }
        case 'hunt': return `Hunt (wingspan < ${e.max})`;
        case 'discard': return e.what === 'egg' ? 'Discard an egg' : e.what === 'bird' ? 'Discard a bird' : `Discard ${foodLabel(e.food || 'any')}`;
        case 'gated': return `${describePower(e.pay)} → ${describePower(e.gain)}`;
        case 'choose_one': return e.options.map(describePower).join(' OR ');
        case 'sequence': return e.steps.map(describePower).join(', ');
        case 'copy_brown':
            return e.scope === 'own' ? 'Copy one of your brown powers'
                : e.scope === 'right' ? 'Copy a brown power on your right'
                : 'Copy left neighbour\'s rightmost brown power';
        case 'all_players': return `All players: ${describePower(e.effect)}${e.from_1_deck ? ' (from 1 deck)' : ''}`;
        case 'use_as_any': return `Use ${e.food} as any food when playing birds`;
        case 'ignore_1_in_cost': return `Pay 1 fewer ${e.food} on bird costs`;
        case 'food_in_powers_is_any': return `${e.food} in powers count as any food`;
        case 'copy_green_power': return 'Copy any green power (1/turn)';
        default: return '';
    }
}

// ===========================================================================
// Card definition builders
// ===========================================================================

// Icon sizes (em) for the bottom info panel.
const COST_ICON = 3.4;
const STAT_ICON = 2.7;

/**
 * The cost as a single compact horizontal row of coins. A count of 2/3 of the
 * same food is a horizontally overlapping stack (≈50% overlap, handled in scss)
 * rather than a number; different food types simply sit next to each other.
 */
function costList(card: BirdCard): NonNullable<DataRow['iconsList']> {
    const list: NonNullable<DataRow['iconsList']> = [];
    for (const f of FOOD_TYPES) for (let i = 0; i < (card.cost.food[f] || 0); i++) list.push({ iconId: foodIconId(f) });
    for (let i = 0; i < (card.cost.any || 0); i++) list.push({ iconId: 'any_coin' });
    for (let i = 0; i < (card.cost.egg || 0); i++) list.push({ iconId: 'egg_coin' });
    return list.length ? list : [{ iconId: 'any_coin' }];
}

/**
 * A Wingspan bird card. Composition (balanced: art on top, info panel below):
 *   top ~half  → the bird as the hero illustration + a VP feather chip (corner)
 *   panel      → a grouped bottom panel: cost coins, then the egg-limit /
 *                wingspan / beak stats, then the power text (tinted by class)
 * Layout is pinned by `.wingspan-card` in the scss.
 */
export function getWingspanCardDefinition(card: BirdCard, opts: { detail?: boolean } = {}): CardDefinition {
    const palette = getWingspanPalette(card.palette);
    const greenPower = card.color === 'green';
    const panelBg = greenPower ? '#eaf5ec' : '#f6ecdb';
    const panelInk = greenPower ? '#2b6b3a' : '#6b4f21';

    const rows: DataRow[] = [
        // cost — one compact row of overlapping coins (no numbers)
        { iconsList: costList(card), iconsListAlign: 'center', iconsListBg: 'none', iconsListIconSize: COST_ICON, iconsListGap: 0 },
        // stats — egg-limit · wingspan
        {
            iconsList: [
                { iconId: 'egg_coin', value: String(card.egg_limit) },
                { iconId: 'wing', value: `${card.wingspan_cm}` }
            ],
            iconsListAlign: 'center', iconsListBg: 'none', iconsListIconSize: STAT_ICON, iconsListGap: 0.5
        }
    ];

    return {
        id: `bird-${card.id}`,
        name: card.common_name,
        widthMm: 63.5,
        heightMm: 88.9,
        borderRadiusMm: 4,
        palette,
        borderWidth: 0,
        borderColor: 'border',
        // No name header (saves real-estate). VP sits in a corner feather chip.
        overlays: [
            { position: 'top-right', shape: 'chip', iconId: 'feather', value: String(card.victory_points), backgroundColor: 'primary', color: '#ffffff', size: 3.9 }
        ],
        mainArt: { iconId: birdIconId(card.shape), frameStyle: 'none', scaling: 1.0 },
        data: { rows, background: panelBg },
        footer: {
            text: describePower(card.power.effect),
            align: 'center',
            verticalAlign: 'center',
            background: panelBg,
            color: panelInk,
            size: 1.4,
            italic: false
        }
    };
}

/**
 * The reverse (food) face of a card — a clean neutral tile showing the 1–2 food
 * types it is worth as **fully-saturated** coins, sized so two fit comfortably
 * side by side. Rendered when a card sits food-side up (reserve / discard). This
 * face uses the plain stacked layout (wrapper class `.wingspan-food`, NOT the
 * `.wingspan-card` watermark layout), so the food coins are bold, not faint.
 */
export function getFoodCardDefinition(card: BirdCard): CardDefinition {
    const foods = card.reverse_food;
    const neutral: Palette = {
        id: 'wingspan_food', name: 'Food',
        background: '#fbf7ef', border: '#e4dcc9', primary: '#efe7d4', secondary: '#d8cdb2',
        accent: '#c9b98f', charcoal: '#5b5238', text: '#5b5238', panelBg: '#f4eede',
        tertiary: '#c9b98f', success: '#5cb87f', danger: '#e0574f'
    };
    return {
        id: `food-${card.id}`,
        name: 'Food',
        widthMm: 63.5,
        heightMm: 88.9,
        borderRadiusMm: 4,
        palette: neutral,
        borderWidth: 0,
        header: { title: 'FOOD', background: 'primary' },
        data: {
            rows: [{
                iconsList: foods.map(f => ({ iconId: foodIconId(f) })),
                iconsListAlign: 'center', iconsListBg: 'none',
                iconsListIconSize: foods.length > 1 ? 5.0 : 6.4,
                iconsListGap: 0.6
            }]
        },
        footer: {
            text: foods.length > 1 ? 'spend as either' : 'food',
            align: 'center', verticalAlign: 'center', size: 1.3, italic: true
        }
    };
}
