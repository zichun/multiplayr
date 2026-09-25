/**
 * FarawayAssets.ts — flat-vector iconography, palettes and card builders for
 * Faraway.
 *
 * Design language: bright, light and fun flat vector illustration. Every glyph
 * is built from a handful of primitives in the card-renderer 0–100 `IconObject`
 * DSL using only painter's-order layering (silhouette first, details punched
 * back in with the surface colour) — no boolean masks — so each icon renders
 * identically through React `ExpressiveIcon`, the React-free `iconToSvg`, and
 * the headless inspector (`npm run inspect`).
 *
 * Two shape families keep the card unambiguous at mobile sizes:
 *   • CIRCLES  = things you *have* — the three wonders, a clue, the moon.
 *   • SQUARES  = biome colours — the quest qualifier swatches.
 * so a resource coin can never be mistaken for a colour requirement.
 */

import { CardDefinition, Palette, IconObject, IconLayer, PrimitiveShape, DataRow } from '../../client/lib/card-renderer/types';
import { coinIcon } from '../../client/lib/card-renderer/presets';
import {
    Colour, COLOURS, Resource, RESOURCES, RegionCard, SanctuaryCard, Quest,
    COLOUR_BIOME, RESOURCE_NAME, describeQuest
} from './FarawayData';

// ---------------------------------------------------------------------------
// Authoring shorthand
// ---------------------------------------------------------------------------

type Extra = Partial<Pick<PrimitiveShape, 'stroke' | 'strokeWidth' | 'opacity' | 'customPath'>>;

const L = (
    id: string, type: PrimitiveShape['type'],
    x: number, y: number, sx: number, sy: number,
    rot = 0, fill = 'primary', extra: Extra = {}
): IconLayer => ({ id, type, x, y, scaleX: sx, scaleY: sy, rotation: rot, fill, ...extra });

const path = (id: string, d: string, fill: string, extra: Extra = {}): IconLayer =>
    ({ id, type: 'bezier', x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, fill, customPath: d, ...extra });

function icon(id: string, layers: IconLayer[]): IconObject {
    return { id, name: id, layers };
}

/**
 * Uniformly shrink a glyph towards `cx`/`cy` by factor `k`.
 *
 * Primitives are positioned by their centre, while a `customPath` is authored in
 * absolute 0–100 space, so the two need different (but equivalent) transforms —
 * both are applied here so callers just pass a factor. Every coin glyph runs
 * through this so the coloured disc always frames it with the same margin.
 */
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
            scaleY: (s.scaleY ?? 1) * k
        };
    });
}

const WHITE = '#ffffff';

// ===========================================================================
// Palette
// ===========================================================================

/**
 * Biome hues: vibrant but light, chosen so the four read apart instantly even
 * as 10px swatches, and so none of them collides with a wonder coin.
 */
export const COLOUR_HEX: Record<Colour, string> = {
    BLUE: '#38a9dd',     // rocky desert — bright sky cyan
    RED: '#f2605f',     // mushroom forest — coral red
    GREEN: '#33bd90',    // river — mint emerald
    YELLOW: '#f5b52e'   // cave city — golden amber
};

/** A darker tone of each biome, for text/ink that must sit on white. */
export const COLOUR_INK: Record<Colour, string> = {
    BLUE: '#11607f',
    RED: '#9e2f34',
    GREEN: '#116d55',
    YELLOW: '#8a5c05'
};

/** A very pale tint of each biome, for card grounds and panel fills. */
export const COLOUR_TINT: Record<Colour, string> = {
    BLUE: '#eaf7fd',
    RED: '#fdeeed',
    GREEN: '#e8f9f2',
    YELLOW: '#fdf3df'
};

/** Wonder hues, deliberately offset from all four biome hues. */
export const RESOURCE_HEX: Record<Resource, string> = {
    UDDU: '#5a6d8c',      // stone — cool slate
    OKIKO: '#8e5fc4',     // chimera — violet
    GOLDLOG: '#7fa32b'    // thistle — olive leaf
};

export const CLUE_HEX = '#1c7f92';     // teal compass
export const NIGHT_HEX = '#3a3f7d';    // indigo moon
export const DAY_HEX = '#f0c24a';      // soft gold sun
export const FAME_HEX = '#2f3a45';     // ink for the quest band
export const SANCTUARY_HEX = '#6d7f94'; // stone grey for colourless havens

const INK = '#2f3a45';
const PAPER = '#fffdf8';

function pal(id: string, name: string, background: string, primary: string, secondary: string, accent: string, panelBg: string): Palette {
    return {
        id: `faraway_${id}`, name,
        background, border: secondary, primary, secondary, accent,
        charcoal: INK, text: INK, panelBg,
        tertiary: accent, success: '#3fb984', danger: '#e0574f'
    };
}

export const FARAWAY_PALETTES: Record<string, Palette> = {
    BLUE: pal('blue', COLOUR_BIOME.BLUE, PAPER, COLOUR_HEX.BLUE, COLOUR_INK.BLUE, DAY_HEX, COLOUR_TINT.BLUE),
    RED: pal('red', COLOUR_BIOME.RED, PAPER, COLOUR_HEX.RED, COLOUR_INK.RED, DAY_HEX, COLOUR_TINT.RED),
    GREEN: pal('green', COLOUR_BIOME.GREEN, PAPER, COLOUR_HEX.GREEN, COLOUR_INK.GREEN, DAY_HEX, COLOUR_TINT.GREEN),
    YELLOW: pal('yellow', COLOUR_BIOME.YELLOW, PAPER, COLOUR_HEX.YELLOW, COLOUR_INK.YELLOW, DAY_HEX, COLOUR_TINT.YELLOW),
    HAVEN: pal('haven', 'Sanctuary', PAPER, SANCTUARY_HEX, '#4a5a6b', DAY_HEX, '#eef2f6')
};

export function getFarawayPalette(colour: Colour | null): Palette {
    return colour ? FARAWAY_PALETTES[colour] : FARAWAY_PALETTES.HAVEN;
}

// ===========================================================================
// 1. Wonder coins — a solid disc with the glyph punched out in white
// ===========================================================================

// Each wonder is one BOLD white silhouette so it survives at coin size (~7px
// of glyph inside an ~11px disc on a tableau card). The three read apart by
// outline alone: angular crystal · horned head · round bloom on a stem.

/** Uddu — a cut mineral: a brilliant-shaped crystal. */
const UDDU_COIN: IconObject = coinIcon('res_uddu', RESOURCE_HEX.UDDU, inset([
    path('u_body', 'M 30 22 L 70 22 L 88 46 L 50 90 L 12 46 Z', WHITE)
], 0.7));

/** Okiko — a chimera head: two swept horns over a tapering muzzle. */
const OKIKO_COIN: IconObject = coinIcon('res_okiko', RESOURCE_HEX.OKIKO, inset([
    path('o_head', 'M 20 12 L 38 36 L 62 36 L 80 12 L 77 46 L 66 70 L 50 86 L 34 70 L 23 46 Z', WHITE),
    L('o_eye_l', 'circle', 40, 50, 0.2, 0.2, 0, RESOURCE_HEX.OKIKO),
    L('o_eye_r', 'circle', 60, 50, 0.2, 0.2, 0, RESOURCE_HEX.OKIKO)
], 0.78));

/** Goldlog — a thistle: spiked bloom over a short stem and two swept leaves. */
const GOLDLOG_COIN: IconObject = coinIcon('res_goldlog', RESOURCE_HEX.GOLDLOG, inset([
    path('g_s1', 'M 50 6 L 57 26 L 43 26 Z', WHITE),
    path('g_s2', 'M 24 16 L 44 28 L 34 38 Z', WHITE),
    path('g_s3', 'M 76 16 L 56 28 L 66 38 Z', WHITE),
    L('g_bloom', 'circle', 50, 40, 1.08, 0.98, 0, WHITE),
    L('g_stem', 'rectangle', 50, 72, 0.12, 0.44, 0, WHITE),
    L('g_lf1', 'circle', 32, 70, 0.54, 0.24, 24, WHITE),
    L('g_lf2', 'circle', 68, 70, 0.54, 0.24, -24, WHITE)
], 0.76));

export const resourceIconId = (r: Resource): string => `res_${r.toLowerCase()}`;

/**
 * Prerequisite pips come in three states, so a card can show — on the icons
 * themselves — which of its requirements are already visible from where it sits:
 *   base   the neutral coin, used everywhere the tableau position is unknown
 *   _ok    greyed out: this icon is satisfied, nothing more to do
 *   _need  full colour inside a gold ring: this icon is still missing
 */
export const resourceIconIdOk = (r: Resource): string => `res_${r.toLowerCase()}_ok`;
export const resourceIconIdNeed = (r: Resource): string => `res_${r.toLowerCase()}_need`;

const SATISFIED_DISC = '#c6ced7';   // muted slate — 'this one is handled'
const NEED_RING = '#f0b429';        // gold ring — 'this one is still missing'

/** The same glyph on a grey disc: a requirement that is already met. */
function satisfiedCoin(r: Resource, base: IconObject): IconObject {
    return {
        id: resourceIconIdOk(r),
        name: resourceIconIdOk(r),
        layers: base.layers.map((l, i) => {
            const shape = l as PrimitiveShape;
            if (i === 0) return { ...shape, fill: SATISFIED_DISC };
            // details punched in the disc colour have to follow it
            return shape.fill === RESOURCE_HEX[r] ? { ...shape, fill: SATISFIED_DISC } : shape;
        }),
    };
}

/** The full-colour coin with a gold ring: a requirement still outstanding. */
function neededCoin(r: Resource, base: IconObject): IconObject {
    return {
        id: resourceIconIdNeed(r),
        name: resourceIconIdNeed(r),
        layers: [
            ...base.layers,
            L('ring', 'circle', 50, 50, 1.68, 1.68, 0, 'none', { stroke: NEED_RING, strokeWidth: 13 })
        ]
    };
}

// ===========================================================================
// 2. Clue, night and day
// ===========================================================================

/** Clue — a compass rose: one four-point star, drawn as a single bold outline. */
const CLUE_COIN: IconObject = coinIcon('clue', CLUE_HEX, inset([
    path('c_rose', 'M 50 4 L 61 39 L 96 50 L 61 61 L 50 96 L 39 61 L 4 50 L 39 39 Z', WHITE)
], 0.74));

/**
 * Night — an indigo disc with a white moon, then a second indigo disc laid over
 * it to bite out the crescent. Pure painter's-order negative space, so it
 * renders identically through every icon path.
 */
const MOON_COIN: IconObject = coinIcon('moon', NIGHT_HEX, [
    L('m_full', 'circle', 49, 52, 1.12, 1.12, 0, WHITE),
    L('m_bite', 'circle', 64, 40, 1.0, 1.0, 0, NIGHT_HEX)
]);

/** Day — a soft gold disc with a white sun and eight rays knocked into it. */
const SUN_COIN: IconObject = coinIcon('sun', DAY_HEX, inset([
    L('s_core', 'circle', 50, 50, 0.98, 0.98, 0, WHITE),
    L('s_r1', 'rectangle', 50, 17, 0.1, 0.34, 0, WHITE),
    L('s_r2', 'rectangle', 50, 83, 0.1, 0.34, 0, WHITE),
    L('s_r3', 'rectangle', 17, 50, 0.34, 0.1, 0, WHITE),
    L('s_r4', 'rectangle', 83, 50, 0.34, 0.1, 0, WHITE),
    L('s_r5', 'rectangle', 29, 29, 0.28, 0.1, 45, WHITE),
    L('s_r6', 'rectangle', 71, 71, 0.28, 0.1, 45, WHITE),
    L('s_r7', 'rectangle', 71, 29, 0.28, 0.1, -45, WHITE),
    L('s_r8', 'rectangle', 29, 71, 0.28, 0.1, -45, WHITE)
], 0.84));

// ===========================================================================
// 3. Biome glyphs — the shared shape language for art, swatches and badges
// ===========================================================================

/**
 * Each biome has ONE glyph, drawn as a `fg`-on-`bg` pair so the very same
 * geometry serves as (a) the big card illustration, (b) a small white knockout
 * inside a colour swatch, and (c) a lobby / rules badge.
 *
 * `k` uniformly insets the glyph inside the 0–100 box. Primitives are centred
 * at their `x`/`y`, while a `customPath` is authored in absolute 0–100 space, so
 * the two need different (but equivalent) transforms — both are applied here so
 * callers just pass a factor.
 */
function biomeGlyph(colour: Colour, fg: string, bg: string, prefix: string, k = 1): IconLayer[] {
    // centred primitive, inset about the box centre
    const R = (id: string, type: PrimitiveShape['type'], x: number, y: number, sx: number, sy: number, fill: string, rot = 0): IconLayer =>
        L(`${prefix}_${id}`, type, 50 + (x - 50) * k, 50 + (y - 50) * k, sx * k, sy * k, rot, fill);
    // absolute path, inset by scaling the whole 0–100 canvas about its centre
    const P = (id: string, d: string, fill: string): IconLayer =>
        ({ id: `${prefix}_${id}`, type: 'bezier', x: 50 * (1 - k), y: 50 * (1 - k), scaleX: k, scaleY: k, rotation: 0, fill, customPath: d });

    switch (colour) {
        // Rocky desert — two mesas with a canyon cut, under a low sun.
        // Rocky desert — two flat-topped buttes and a boulder on the sand.
        // Kept to a few silhouettes: at 10px anything finer turns to mush, and
        // a disc up in the sky would read as a head above shoulders.
        case 'BLUE': return [
            P('mesa_b', 'M 56 82 L 64 28 L 84 28 L 94 82 Z', fg),
            P('mesa_a', 'M 6 82 L 18 44 L 44 44 L 52 82 Z', fg),
            R('gap', 'rectangle', 54, 62, 0.08, 0.78, bg),
            R('boulder', 'circle', 30, 78, 0.5, 0.36, fg),
            R('ground', 'rectangle', 50, 88, 1.9, 0.14, fg)
        ];
        // Mushroom forest — one big capped mushroom plus a small companion.
        case 'RED': return [
            P('cap', 'M 14 54 C 14 30 30 16 50 16 C 70 16 86 30 86 54 Z', fg),
            R('dot_a', 'circle', 34, 38, 0.36, 0.36, bg),
            R('dot_b', 'circle', 60, 32, 0.3, 0.3, bg),
            R('dot_c', 'circle', 70, 46, 0.24, 0.24, bg),
            P('stem', 'M 40 54 L 60 54 L 58 84 L 42 84 Z', fg),
            R('gill', 'rectangle', 50, 58, 0.42, 0.05, bg),
            P('cap2', 'M 66 84 C 66 70 74 64 82 64 C 90 64 94 70 94 84 Z', fg),
            R('ground', 'rectangle', 50, 88, 1.8, 0.09, fg)
        ];
        // River — two flowing currents above a line of stepping stones.
        case 'GREEN': return [
            P('w1', 'M 4 18 C 26 2 42 32 62 16 C 76 5 86 10 96 18 L 96 34 C 84 27 76 25 64 34 C 42 50 24 20 4 34 Z', fg),
            P('w2', 'M 4 48 C 26 32 42 62 62 46 C 76 35 86 40 96 48 L 96 64 C 84 57 76 55 64 64 C 42 80 24 50 4 64 Z', fg),
            R('stone_a', 'circle', 22, 82, 0.62, 0.42, fg),
            R('stone_b', 'circle', 52, 88, 0.5, 0.34, fg),
            R('stone_c', 'circle', 79, 80, 0.44, 0.3, fg)
        ];
        // Cave city — a great arch with dwellings carved into the rock.
        case 'YELLOW': default: return [
            P('rock', 'M 10 86 L 10 44 C 10 22 30 10 50 10 C 70 10 90 22 90 44 L 90 86 Z', fg),
            P('mouth', 'M 34 86 L 34 60 C 34 50 42 44 50 44 C 58 44 66 50 66 60 L 66 86 Z', bg),
            R('win_a', 'rectangle', 22, 58, 0.16, 0.2, bg),
            R('win_b', 'rectangle', 78, 58, 0.16, 0.2, bg),
            R('win_c', 'rectangle', 50, 28, 0.18, 0.18, bg),
            R('win_d', 'rectangle', 30, 36, 0.14, 0.14, bg),
            R('win_e', 'rectangle', 70, 36, 0.14, 0.14, bg),
            R('lamp', 'circle', 50, 70, 0.26, 0.26, fg)
        ];
    }
}

export const biomeArtId = (c: Colour): string => `biome_${c.toLowerCase()}`;

/** The full-bleed card illustration: biome colour on the card ground. */
const BIOME_ART: Record<Colour, IconObject> = COLOURS.reduce((acc, c) => {
    acc[c] = icon(biomeArtId(c), biomeGlyph(c, COLOUR_HEX[c], PAPER, 'a'));
    return acc;
}, {} as Record<Colour, IconObject>);

// ===========================================================================
// 4. Colour swatches — the quest qualifier language (squares, never circles)
// ===========================================================================

const SQ = (id: string, fill: string): IconLayer => L(id, 'rectangle', 50, 50, 1.86, 1.86, 0, fill);

export const swatchId = (colours: Colour[]): string => `sw_${colours.map(c => c[0]).join('')}`;

/** One colour: the biome square with its glyph knocked out in white. */
function singleSwatch(c: Colour): IconObject {
    return icon(swatchId([c]), [
        SQ('bg', COLOUR_HEX[c]),
        // inset so the glyph never touches the square's edge
        ...biomeGlyph(c, WHITE, COLOUR_HEX[c], 's', 0.74)
    ]);
}

/**
 * Two colours: one square split on the diagonal. No glyphs — at quest size the
 * two hues alone are unmistakable, and the split reads as "either of these".
 */
function pairSwatch(a: Colour, b: Colour): IconObject {
    return icon(swatchId([a, b]), [
        SQ('bg', COLOUR_HEX[a]),
        path('half', 'M 93 7 L 93 93 L 7 93 Z', COLOUR_HEX[b]),
        path('seam', 'M 92 6 L 6 92 L 10 96 L 96 10 Z', WHITE)
    ]);
}

/** All four colours: a 2×2 quad — the "one of each" set quest. */
const SET4_SWATCH: IconObject = icon('sw_set4', [
    L('q1', 'rectangle', 29, 29, 0.82, 0.82, 0, COLOUR_HEX.BLUE),
    L('q2', 'rectangle', 71, 29, 0.82, 0.82, 0, COLOUR_HEX.RED),
    L('q3', 'rectangle', 29, 71, 0.82, 0.82, 0, COLOUR_HEX.GREEN),
    L('q4', 'rectangle', 71, 71, 0.82, 0.82, 0, COLOUR_HEX.YELLOW)
]);

/** Every ordered colour pair that appears on a printed card, plus the singles. */
const SWATCHES: Record<string, IconObject> = (() => {
    const out: Record<string, IconObject> = { sw_set4: SET4_SWATCH };
    COLOURS.forEach(c => { out[swatchId([c])] = singleSwatch(c); });
    for (const a of COLOURS) for (const b of COLOURS) {
        if (a === b) continue;
        out[swatchId([a, b])] = pairSwatch(a, b);
    }
    return out;
})();

// ===========================================================================
// 5. Emblems — sanctuary, fame, deck backs, market
// ===========================================================================

/** Sanctuary — a standing arch on a plinth, with a lit keystone. */
export const SANCTUARY_ICON: IconObject = icon('sanctuary', [
    path('arch', 'M 16 84 L 16 46 C 16 24 32 12 50 12 C 68 12 84 24 84 46 L 84 84 L 66 84 L 66 46 C 66 36 59 30 50 30 C 41 30 34 36 34 46 L 34 84 Z', 'primary'),
    L('plinth', 'rectangle', 50, 90, 1.9, 0.12, 0, 'primary'),
    L('key', 'circle', 50, 22, 0.28, 0.28, 0, 'background')
]);

/** A white-on-colour variant for a coloured sanctuary's badge. */
export const SANCTUARY_COIN: IconObject = coinIcon('sanctuary_coin', SANCTUARY_HEX, [
    path('arch', 'M 22 82 L 22 48 C 22 30 35 20 50 20 C 65 20 78 30 78 48 L 78 82 L 64 82 L 64 48 C 64 40 58 35 50 35 C 42 35 36 40 36 48 L 36 82 Z', WHITE)
]);

/**
 * Fame — a gold star for score readouts. The gold is a literal so the star
 * stays the same colour on a top bar, a panel heading and a score pad alike.
 */
export const FAME_ICON: IconObject = icon('fame', [
    path('star', 'M 50 10 L 61 39 L 92 40 L 68 59 L 76 89 L 50 71 L 24 89 L 32 59 L 8 40 L 39 39 Z', '#f0b429')
]);

/** Region deck back — the four biome colours fanned behind a compass. */
export const REGION_BACK_ICON: IconObject = icon('region_back', [
    L('b1', 'rectangle', 28, 50, 0.7, 1.4, -12, COLOUR_HEX.BLUE),
    L('b2', 'rectangle', 43, 48, 0.7, 1.4, -4, COLOUR_HEX.GREEN),
    L('b3', 'rectangle', 58, 48, 0.7, 1.4, 4, COLOUR_HEX.YELLOW),
    L('b4', 'rectangle', 73, 50, 0.7, 1.4, 12, COLOUR_HEX.RED)
]);

// ===========================================================================
// Combined icon map (passed to <PlayingCard customIcons={…}> / ExpressiveIcon)
// ===========================================================================

export const FARAWAY_ICONS: Record<string, IconObject> = (() => {
    const all: Record<string, IconObject> = {
        res_uddu: UDDU_COIN,
        res_okiko: OKIKO_COIN,
        res_goldlog: GOLDLOG_COIN,
        res_uddu_ok: satisfiedCoin('UDDU', UDDU_COIN),
        res_okiko_ok: satisfiedCoin('OKIKO', OKIKO_COIN),
        res_goldlog_ok: satisfiedCoin('GOLDLOG', GOLDLOG_COIN),
        res_uddu_need: neededCoin('UDDU', UDDU_COIN),
        res_okiko_need: neededCoin('OKIKO', OKIKO_COIN),
        res_goldlog_need: neededCoin('GOLDLOG', GOLDLOG_COIN),
        clue: CLUE_COIN,
        moon: MOON_COIN,
        sun: SUN_COIN,
        sanctuary: SANCTUARY_ICON,
        sanctuary_coin: SANCTUARY_COIN,
        fame: FAME_ICON,
        region_back: REGION_BACK_ICON
    };
    COLOURS.forEach(c => { all[biomeArtId(c)] = BIOME_ART[c]; });
    Object.keys(SWATCHES).forEach(k => { all[k] = SWATCHES[k]; });
    return all;
})();

export function getIcon(id: string): IconObject | undefined {
    return FARAWAY_ICONS[id];
}

// ===========================================================================
// Quest → iconography
// ===========================================================================

/** The single glyph that says *what* a quest counts (FLAT quests count nothing). */
export function questIconId(quest: Quest): string | null {
    switch (quest.kind) {
        case 'FLAT': return null;
        case 'PER_RESOURCE': return resourceIconId(quest.resource);
        case 'PER_NIGHT': return 'moon';
        case 'PER_CLUE': return 'clue';
        case 'PER_COLOUR': return swatchId(quest.colours);
        case 'PER_SET_4_COLOURS': return 'sw_set4';
        default: return null;
    }
}

/** Short one-line quest text with inline icons, for footers and logs. */
export function questText(quest: Quest | null): string {
    if (!quest) return '';
    if (quest.kind === 'FLAT') return String(quest.fame);
    return `${quest.fame}× [icon:${questIconId(quest)}]`;
}

// ===========================================================================
// Card definition builders
// ===========================================================================

const CARD_W_MM = 63.5;
const CARD_H_MM = 88.9;

/**
 * Everything a card contributes to the play area, as coins in the white pill
 * under the colour band: its clue (if any) first, then one coin per wonder.
 */
function contributesRow(clues: number, resources: Resource[]): DataRow {
    const list: NonNullable<DataRow['iconsList']> = [];
    for (let i = 0; i < clues; i++) list.push({ iconId: 'clue' });
    resources.forEach(r => list.push({ iconId: resourceIconId(r) }));
    return {
        iconsList: list,
        iconsListAlign: 'right',
        iconsListBg: 'none',
        iconsListIconSize: 3.3,
        iconsListGap: 0.2
    };
}

/** Prerequisite coins shown on the pale gate strip above the quest band. */
function prereqRow(prerequisite: Resource[], satisfied?: boolean[]): DataRow {
    return {
        iconsList: prerequisite.map((r, i) => ({
            iconId: satisfied === undefined
                ? resourceIconId(r)
                : (satisfied[i] ? resourceIconIdOk(r) : resourceIconIdNeed(r))
        })),
        iconsListAlign: 'center',
        iconsListBg: 'none',
        iconsListIconSize: 2.6,
        iconsListGap: 0.16
    };
}

export interface RegionCardOptions {
    /**
     * The wonder icons this card's quest is still short of, from wherever it
     * sits in the tableau (`RegionScore.missing`). Supplying it switches the
     * prerequisite pips from neutral to met/outstanding; leaving it out keeps
     * the neutral face used in hand, market and reference views.
     */
    missing?: Resource[];
}

/**
 * Mark each printed prerequisite pip met or outstanding. The shortfall is
 * counted per icon type, so with "needs 3 okiko, 1 missing" the first two pips
 * read as met and the last as outstanding.
 */
function prereqSatisfaction(prerequisite: Resource[], missing: Resource[]): boolean[] {
    const short: Partial<Record<Resource, number>> = {};
    for (const r of missing) short[r] = (short[r] || 0) + 1;
    // walk from the right so the outstanding pips are the trailing ones
    const out: boolean[] = new Array(prerequisite.length).fill(true);
    for (let i = prerequisite.length - 1; i >= 0; i--) {
        const r = prerequisite[i];
        if ((short[r] || 0) > 0) { out[i] = false; short[r] = short[r]! - 1; }
    }
    return out;
}

/**
 * A Faraway Region card.
 *
 *   ┌──────────────────────────────┐
 *   │ ⟨24⟩ 🌙 ◈        [U][U][O]   │  colour band: duration, day/night, clue, wonders
 *   ├──────────────────────────────┤
 *   │           biome art          │
 *   ├──────────────────────────────┤
 *   │  [U][U]   (gate strip)       │  prerequisite — only when the card has one
 *   │  8  or  3× 🌙                │  quest band
 *   └──────────────────────────────┘
 *
 * The gate strip sits flush on the quest band so the two read as a single
 * "condition → reward" block, and can never be confused with the wonders the
 * region *produces* up on the colour band.
 */
export function getRegionCardDefinition(card: RegionCard, opts: RegionCardOptions = {}): CardDefinition {
    const palette = getFarawayPalette(card.colour);
    const quest = card.quest;

    const satisfied = opts.missing === undefined
        ? undefined
        : prereqSatisfaction(card.prerequisite, opts.missing);

    const rows: DataRow[] = [contributesRow(card.clues, card.resources)];
    if (card.prerequisite.length > 0) rows.push(prereqRow(card.prerequisite, satisfied));

    // Day/night sits to the LEFT of the duration (the stylesheet reverses the
    // band), echoing the printed sun/moon badge around the number.
    const headerIcons: NonNullable<CardDefinition['header']>['icons'] = [
        { iconId: card.night ? 'moon' : 'sun' }
    ];

    const footerText = quest ? questText(quest) : '—';

    return {
        id: `region-${card.id}`,
        name: `${COLOUR_BIOME[card.colour]} ${card.id}`,
        widthMm: CARD_W_MM,
        heightMm: CARD_H_MM,
        borderRadiusMm: 4,
        palette,
        borderWidth: 0,
        borderColor: 'primary',
        header: {
            title: String(card.id),
            background: 'primary',
            icons: headerIcons
        },
        mainArt: { iconId: biomeArtId(card.colour), frameStyle: 'none' },
        data: { rows, background: 'none' },
        footer: {
            text: footerText,
            align: 'center',
            verticalAlign: 'center',
            background: quest ? FAME_HEX : '#c9d2da',
            color: '#ffffff',
            size: 2.7
        }
    };
}

/**
 * A Sanctuary card. Same skeleton as a Region so a tableau row and a sanctuary
 * shelf feel like one family, but with the duration replaced by the sanctuary
 * arch — an unmistakable "this has no number" cue — and no gate strip.
 */
export function getSanctuaryCardDefinition(card: SanctuaryCard): CardDefinition {
    // A tinted ground (rather than the Regions' paper white) marks the whole
    // sanctuary family at a glance, even in a crowded shelf.
    const base = getFarawayPalette(card.colour);
    const palette: Palette = {
        ...base,
        background: card.colour ? COLOUR_TINT[card.colour] : '#eaeff4'
    };

    const headerIcons: NonNullable<CardDefinition['header']>['icons'] = [];
    if (card.night) headerIcons.push({ iconId: 'moon' });

    return {
        id: `sanctuary-${card.id}`,
        name: card.colour ? `${COLOUR_BIOME[card.colour]} Sanctuary` : 'Sanctuary',
        widthMm: CARD_W_MM,
        heightMm: CARD_H_MM,
        borderRadiusMm: 4,
        palette,
        borderWidth: 0,
        borderColor: 'primary',
        header: {
            title: '',
            background: 'primary',
            icons: headerIcons
        },
        // The arch is the hero; a coloured sanctuary also carries its biome tint
        // through the band + palette, so "counts as this colour" stays visible.
        mainArt: { iconId: card.colour ? biomeArtId(card.colour) : 'sanctuary', frameStyle: 'none' },
        data: { rows: [contributesRow(card.clues, card.resources)], background: 'none' },
        footer: {
            text: card.quest ? questText(card.quest) : '—',
            align: 'center',
            verticalAlign: 'center',
            background: card.quest ? FAME_HEX : '#c9d2da',
            color: '#ffffff',
            size: 2.7
        },
        overlays: [
            { position: 'top-left', shape: 'chip', iconId: 'sanctuary', backgroundColor: '#ffffff', color: 'primary', size: 3.9, radius: 1.95 }
        ]
    };
}

/** Plain-language quest description used by tooltips and the rules tab. */
export function describeCardQuest(quest: Quest | null): string {
    return describeQuest(quest);
}

/** A compact "U U O" style label for prerequisites in text contexts. */
export function resourceListLabel(list: Resource[]): string {
    if (list.length === 0) return 'none';
    return RESOURCES
        .map(r => ({ r, n: list.filter(x => x === r).length }))
        .filter(x => x.n > 0)
        .map(x => `${x.n}× ${RESOURCE_NAME[x.r]}`)
        .join(', ');
}
