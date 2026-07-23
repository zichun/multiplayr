/**
 * SeaSaltAssets.ts
 * Flat, soft-pastel palettes, origami-inspired geometric iconography, and card
 * definition builders for "Sea Salt & Paper".
 *
 * Visual language (see the reference cards): each card is a full-bleed mono tile
 * in its background colour, carrying a large origami-style animal in a deeper
 * shade of that colour with a lit white facet. A rounded "chip" in the top-left
 * repeats the type glyph (the card type), a small category marker sits top-right,
 * and a left-edge score strip shows the set-collection threshold ladder, a duo's
 * action + points, or a multiplier's ratio.
 *
 * The domain taxonomy (types / colours / categories / scoring tables) lives here
 * so both the game engine and the views share one source of truth.
 */

import { CardDefinition, Palette, IconObject, ScoreCell } from '../../client/lib/card-renderer/types';

// ==========================================
// 1. Domain taxonomy
// ==========================================

export type SeaSaltColor =
    | 'blue' | 'teal' | 'black' | 'yellow' | 'green'
    | 'gray' | 'purple' | 'peach' | 'pink' | 'orange' | 'white';

export type SeaSaltType =
    // Duos
    | 'fish' | 'boat' | 'crab' | 'swimmer' | 'shark'
    // Collectors
    | 'shell' | 'octopus' | 'penguin' | 'sailor'
    // Multipliers
    | 'lighthouse' | 'shoal' | 'colony' | 'captain'
    // Mermaid
    | 'mermaid';

export type SeaSaltCategory = 'duo' | 'collector' | 'multiplier' | 'mermaid';

export type DuoEffect = 'peek' | 'extra_turn' | 'draw' | 'steal';

export interface TypeInfo {
    category: SeaSaltCategory;
    label: string;          // short display label
    // duo-only
    duoEffect?: DuoEffect;
    duoPartner?: SeaSaltType; // swimmer <-> shark
    actionIcon?: string;      // action glyph id for the score strip
    // collector-only: cumulative points at set sizes 1..N (index 0 => 1 card)
    thresholds?: number[];
    cap?: number;
    // multiplier-only
    perTarget?: number;       // points per target card
    target?: SeaSaltType;     // which type it multiplies
}

// Non-linear collector scoring tables (from the ruleset §5b).
export const COLLECTOR_THRESHOLDS: Record<string, number[]> = {
    shell: [0, 2, 4, 6, 8, 10],  // 1..6
    octopus: [0, 3, 6, 9, 12],   // 1..5
    penguin: [1, 3, 5],          // 1..3
    sailor: [0, 5]               // 1..2
};

export const TYPE_INFO: Record<SeaSaltType, TypeInfo> = {
    // --- Duos (1 pt per pair, one-time effect on play) ---
    crab: { category: 'duo', label: 'Crab', duoEffect: 'peek', actionIcon: 'act_peek' },
    boat: { category: 'duo', label: 'Boat', duoEffect: 'extra_turn', actionIcon: 'act_extra' },
    fish: { category: 'duo', label: 'Fish', duoEffect: 'draw', actionIcon: 'act_draw' },
    swimmer: { category: 'duo', label: 'Swimmer', duoEffect: 'steal', duoPartner: 'shark', actionIcon: 'act_steal' },
    shark: { category: 'duo', label: 'Shark', duoEffect: 'steal', duoPartner: 'swimmer', actionIcon: 'act_steal' },

    // --- Collectors (set-collection thresholds) ---
    shell: { category: 'collector', label: 'Shell', thresholds: COLLECTOR_THRESHOLDS.shell, cap: 6 },
    octopus: { category: 'collector', label: 'Octopus', thresholds: COLLECTOR_THRESHOLDS.octopus, cap: 5 },
    penguin: { category: 'collector', label: 'Penguin', thresholds: COLLECTOR_THRESHOLDS.penguin, cap: 3 },
    sailor: { category: 'collector', label: 'Sailor', thresholds: COLLECTOR_THRESHOLDS.sailor, cap: 2 },

    // --- Multipliers (score off OTHER cards; not their own type) ---
    lighthouse: { category: 'multiplier', label: 'Lighthouse', perTarget: 1, target: 'boat' },
    shoal: { category: 'multiplier', label: 'Shoal of Fish', perTarget: 1, target: 'fish' },
    colony: { category: 'multiplier', label: 'Penguin Colony', perTarget: 2, target: 'penguin' },
    captain: { category: 'multiplier', label: 'Captain', perTarget: 3, target: 'sailor' },

    // --- Mermaid (1 pt per card of one distinct colour) ---
    mermaid: { category: 'mermaid', label: 'Mermaid' }
};

export const DUO_EFFECT_LABEL: Record<DuoEffect, string> = {
    peek: 'LOOK & TAKE',
    extra_turn: 'PLAY AGAIN',
    draw: 'DRAW A CARD',
    steal: 'STEAL A CARD'
};

// ==========================================
// Deck composition (§5e) — 58 cards across 11 colours.
// Shared source of truth for the engine (deck build) and the rules reference.
// ==========================================
export const SEASALT_DECK_COMPOSITION: Record<SeaSaltColor, Partial<Record<SeaSaltType, number>>> = {
    blue:   { fish: 2, boat: 2, crab: 2, shell: 1, swimmer: 1, shark: 1 },
    teal:   { fish: 1, boat: 2, crab: 2, shell: 1, swimmer: 1, shark: 1, octopus: 1 },
    black:  { fish: 2, boat: 2, crab: 1, shell: 1, swimmer: 1, shark: 1 },
    yellow: { fish: 1, boat: 2, crab: 2, shell: 1, swimmer: 1, octopus: 1 },
    green:  { fish: 1, crab: 1, shell: 1, shark: 1, colony: 1, octopus: 1 },
    gray:   { shoal: 1, crab: 1, shell: 1, octopus: 1 },
    purple: { lighthouse: 1, shark: 1, octopus: 1, penguin: 1 },
    peach:  { swimmer: 1, penguin: 1, captain: 1 },
    pink:   { sailor: 1, penguin: 1 },
    orange: { sailor: 1 },
    white:  { mermaid: 4 }
};

export const SEASALT_COLOR_LABEL: Record<SeaSaltColor, string> = {
    blue: 'Blue', teal: 'Teal', black: 'Black', yellow: 'Yellow', green: 'Green',
    gray: 'Gray', purple: 'Purple', peach: 'Peach', pink: 'Pink', orange: 'Orange', white: 'White'
};

// Derived reference counts.
export const TYPE_COUNT: Record<SeaSaltType, number> = (() => {
    const m: Partial<Record<SeaSaltType, number>> = {};
    (Object.keys(SEASALT_DECK_COMPOSITION) as SeaSaltColor[]).forEach(col => {
        const comp = SEASALT_DECK_COMPOSITION[col];
        (Object.keys(comp) as SeaSaltType[]).forEach(t => { m[t] = (m[t] || 0) + (comp[t] || 0); });
    });
    return m as Record<SeaSaltType, number>;
})();

export const COLOR_COUNT: Record<SeaSaltColor, number> = (() => {
    const m: Partial<Record<SeaSaltColor, number>> = {};
    (Object.keys(SEASALT_DECK_COMPOSITION) as SeaSaltColor[]).forEach(col => {
        m[col] = Object.values(SEASALT_DECK_COMPOSITION[col]).reduce((a, b) => a + (b || 0), 0);
    });
    return m as Record<SeaSaltColor, number>;
})();

// ==========================================
// 2. Soft-pastel per-colour palettes
// ==========================================
// background = the whole-card mono colour; accent = a deeper shade of the same
// hue (origami body + type chip + score numbers); text = the number/label ink;
// secondary = white (chip glyph + origami facet).

function monoPalette(id: string, bg: string, ink: string, deep: string): Palette {
    return {
        id: `seasalt_${id}`,
        name: `Sea Salt ${id}`,
        background: bg,
        border: deep,
        primary: deep,
        secondary: '#ffffff',
        accent: deep,
        charcoal: ink,
        text: ink,
        panelBg: bg,
        tertiary: deep,
        success: '#57b894',
        danger: '#e0554f'
    };
}

export const SEASALT_PALETTES: Record<SeaSaltColor, Palette> = {
    blue: monoPalette('blue', '#86b6e8', '#153a63', '#2f6cab'),
    teal: monoPalette('teal', '#74c6bd', '#0f4f48', '#238b80'),
    black: monoPalette('black', '#626b7a', '#f2f5fa', '#333b48'),
    yellow: monoPalette('yellow', '#f2d06b', '#6b520a', '#c1901d'),
    green: monoPalette('green', '#8fce9b', '#1f5a2c', '#3f9b57'),
    gray: monoPalette('gray', '#b7c0cb', '#2b3240', '#69727f'),
    purple: monoPalette('purple', '#b79ae0', '#3c2a63', '#7d5cc0'),
    peach: monoPalette('peach', '#f2b184', '#6e3a12', '#d0763a'),
    pink: monoPalette('pink', '#efa8d0', '#6e1f4e', '#cf5c9f'),
    orange: monoPalette('orange', '#f0a860', '#6e3a12', '#d4772a'),
    // Mermaids: a pale card with a periwinkle silhouette so the figure still reads.
    white: monoPalette('white', '#eef2fa', '#34407a', '#6b76d6')
};

export function getSeaSaltPalette(color: SeaSaltColor): Palette {
    return SEASALT_PALETTES[color] || SEASALT_PALETTES.gray;
}

// ------------------------------------------------------------------
// Hand sorting — by card type (multipliers grouped with the type they
// score off: lighthouse↔boat, shoal↔fish, colony↔penguin, captain↔sailor)
// or by background colour.
// ------------------------------------------------------------------
export const TYPE_SORT_ORDER: SeaSaltType[] = [
    'fish', 'shoal',            // fish + its multiplier
    'boat', 'lighthouse',       // boat + its multiplier
    'crab',
    'swimmer', 'shark',
    'shell',
    'octopus',
    'penguin', 'colony',        // penguin + its multiplier
    'sailor', 'captain',        // sailor + its multiplier
    'mermaid'
];

export const COLOR_SORT_ORDER: SeaSaltColor[] = [
    'blue', 'teal', 'green', 'gray', 'black', 'yellow', 'purple', 'peach', 'pink', 'orange', 'white'
];

export type HandSortMode = 'type' | 'color';

export function sortSeaSaltHand<T extends { type: SeaSaltType; color: SeaSaltColor }>(
    cards: T[],
    mode: HandSortMode
): T[] {
    const typeRank = (c: T) => {
        const i = TYPE_SORT_ORDER.indexOf(c.type);
        return i < 0 ? 999 : i;
    };
    const colorRank = (c: T) => {
        const i = COLOR_SORT_ORDER.indexOf(c.color);
        return i < 0 ? 999 : i;
    };
    const arr = [...cards];
    if (mode === 'color') {
        arr.sort((a, b) => colorRank(a) - colorRank(b) || typeRank(a) - typeRank(b));
    } else {
        arr.sort((a, b) => typeRank(a) - typeRank(b) || colorRank(a) - colorRank(b));
    }
    return arr;
}

// Flat CSS colours for chips / badges / counters in the arena UI.
export function seaSaltBgHex(color: SeaSaltColor): string {
    return getSeaSaltPalette(color).background;
}
export function seaSaltDeepHex(color: SeaSaltColor): string {
    return getSeaSaltPalette(color).accent;
}
export function seaSaltInkHex(color: SeaSaltColor): string {
    return getSeaSaltPalette(color).text;
}

// ==========================================
// 3. Origami-inspired geometric iconography
// ==========================================
// Convention: the animal body fills 'accent' (the deep card hue); a lit facet is
// a translucent white overlay (origami fold); eyes knock out to 'background'.
// When placed on a chip we pass a colorOverride, flattening it to a clean white
// silhouette — so every glyph works both as card art and as a corner badge.

const FACET = '#ffffff';

export const SEASALT_ICONS: Record<string, IconObject> = {
    // ---------------- Duos ----------------
    sea_fish: {
        id: 'sea_fish', name: 'Fish',
        layers: [
            { id: 'tail', type: 'triangle', x: 24, y: 50, scaleX: 0.5, scaleY: 0.8, rotation: 90, fill: 'accent' },
            { id: 'body', type: 'circle', x: 56, y: 50, scaleX: 1.35, scaleY: 0.92, fill: 'accent' },
            { id: 'fin', type: 'triangle', x: 58, y: 30, scaleX: 0.34, scaleY: 0.32, fill: 'accent' },
            { id: 'belly', type: 'circle', x: 58, y: 60, scaleX: 1.0, scaleY: 0.4, fill: FACET, opacity: 0.28 },
            { id: 'eye', type: 'circle', x: 74, y: 45, scaleX: 0.12, scaleY: 0.12, fill: 'background' }
        ]
    },
    sea_shark: {
        id: 'sea_shark', name: 'Shark',
        layers: [
            { id: 'body', type: 'bezier', x: 0, y: 0, fill: 'accent',
                customPath: 'M 93 52 L 55 39 L 47 15 L 41 39 L 17 36 L 30 52 L 17 69 L 41 60 L 55 61 Z' },
            { id: 'pec', type: 'triangle', x: 52, y: 66, scaleX: 0.34, scaleY: 0.3, rotation: 200, fill: 'accent' },
            { id: 'belly', type: 'triangle', x: 60, y: 56, scaleX: 0.5, scaleY: 0.22, rotation: 180, fill: FACET, opacity: 0.24 },
            { id: 'eye', type: 'circle', x: 80, y: 50, scaleX: 0.08, scaleY: 0.08, fill: 'background' }
        ]
    },
    sea_boat: {
        id: 'sea_boat', name: 'Boat',
        layers: [
            { id: 'hull', type: 'bezier', x: 0, y: 0, fill: 'accent', customPath: 'M 18 64 L 82 64 L 72 80 L 28 80 Z' },
            { id: 'mast', type: 'rectangle', x: 50, y: 44, scaleX: 0.05, scaleY: 0.78, fill: 'accent' },
            { id: 'sail', type: 'bezier', x: 0, y: 0, fill: 'accent', customPath: 'M 52 16 L 52 58 L 80 58 Z' },
            { id: 'jib', type: 'bezier', x: 0, y: 0, fill: 'accent', customPath: 'M 48 22 L 48 58 L 26 58 Z' },
            { id: 'sail_facet', type: 'bezier', x: 0, y: 0, fill: FACET, opacity: 0.26, customPath: 'M 54 26 L 54 54 L 72 54 Z' }
        ]
    },
    sea_crab: {
        id: 'sea_crab', name: 'Crab',
        layers: [
            { id: 'legL1', type: 'rectangle', x: 26, y: 62, scaleX: 0.36, scaleY: 0.06, rotation: 28, fill: 'accent' },
            { id: 'legL2', type: 'rectangle', x: 27, y: 70, scaleX: 0.34, scaleY: 0.06, rotation: 8, fill: 'accent' },
            { id: 'legR1', type: 'rectangle', x: 74, y: 62, scaleX: 0.36, scaleY: 0.06, rotation: -28, fill: 'accent' },
            { id: 'legR2', type: 'rectangle', x: 73, y: 70, scaleX: 0.34, scaleY: 0.06, rotation: -8, fill: 'accent' },
            { id: 'clawL', type: 'circle', x: 23, y: 42, scaleX: 0.42, scaleY: 0.42, fill: 'accent' },
            { id: 'clawR', type: 'circle', x: 77, y: 42, scaleX: 0.42, scaleY: 0.42, fill: 'accent' },
            { id: 'clawLcut', type: 'circle', x: 18, y: 38, scaleX: 0.17, scaleY: 0.17, fill: 'background' },
            { id: 'clawRcut', type: 'circle', x: 82, y: 38, scaleX: 0.17, scaleY: 0.17, fill: 'background' },
            { id: 'body', type: 'circle', x: 50, y: 58, scaleX: 1.15, scaleY: 0.85, fill: 'accent' },
            { id: 'shine', type: 'circle', x: 50, y: 52, scaleX: 0.7, scaleY: 0.3, fill: FACET, opacity: 0.24 },
            { id: 'eyeL', type: 'circle', x: 42, y: 48, scaleX: 0.1, scaleY: 0.1, fill: 'background' },
            { id: 'eyeR', type: 'circle', x: 58, y: 48, scaleX: 0.1, scaleY: 0.1, fill: 'background' }
        ]
    },
    sea_swimmer: {
        id: 'sea_swimmer', name: 'Swimmer',
        layers: [
            { id: 'wave', type: 'rectangle', x: 50, y: 74, scaleX: 1.7, scaleY: 0.16, fill: FACET, opacity: 0.28 },
            { id: 'body', type: 'bezier', x: 0, y: 0, fill: 'accent', customPath: 'M 20 66 L 40 54 L 66 58 L 82 50 L 84 60 L 64 68 L 38 66 Z' },
            { id: 'arm', type: 'rectangle', x: 74, y: 40, scaleX: 0.1, scaleY: 0.5, rotation: 35, fill: 'accent' },
            { id: 'head', type: 'circle', x: 40, y: 46, scaleX: 0.32, scaleY: 0.32, fill: 'accent' },
            { id: 'splash', type: 'circle', x: 85, y: 30, scaleX: 0.12, scaleY: 0.12, fill: FACET, opacity: 0.5 }
        ]
    },

    // ---------------- Collectors ----------------
    sea_shell: {
        id: 'sea_shell', name: 'Shell',
        layers: [
            { id: 'fan', type: 'semi-circle', x: 50, y: 66, scaleX: 1.55, scaleY: 1.5, fill: 'accent' },
            { id: 'hinge', type: 'triangle', x: 50, y: 70, scaleX: 0.24, scaleY: 0.26, rotation: 180, fill: 'accent' },
            { id: 'r0', type: 'rectangle', x: 50, y: 50, scaleX: 0.035, scaleY: 0.62, fill: FACET, opacity: 0.32 },
            { id: 'rL1', type: 'rectangle', x: 36, y: 52, scaleX: 0.035, scaleY: 0.6, rotation: 24, fill: FACET, opacity: 0.32 },
            { id: 'rR1', type: 'rectangle', x: 64, y: 52, scaleX: 0.035, scaleY: 0.6, rotation: -24, fill: FACET, opacity: 0.32 },
            { id: 'rL2', type: 'rectangle', x: 25, y: 56, scaleX: 0.035, scaleY: 0.5, rotation: 46, fill: FACET, opacity: 0.32 },
            { id: 'rR2', type: 'rectangle', x: 75, y: 56, scaleX: 0.035, scaleY: 0.5, rotation: -46, fill: FACET, opacity: 0.32 }
        ]
    },
    sea_octopus: {
        id: 'sea_octopus', name: 'Octopus',
        layers: [
            { id: 'body', type: 'bezier', x: 0, y: 0, fill: 'accent',
                customPath: 'M 26 46 C 26 20 74 20 74 46 L 74 54 Q 80 60 77 72 Q 72 64 68 74 Q 63 62 58 75 Q 52 62 46 75 Q 40 62 36 74 Q 31 64 26 72 Q 22 60 26 54 Z' },
            { id: 'shine', type: 'circle', x: 44, y: 36, scaleX: 0.28, scaleY: 0.28, fill: FACET, opacity: 0.22 },
            { id: 'eyeL', type: 'circle', x: 42, y: 42, scaleX: 0.11, scaleY: 0.11, fill: 'background' },
            { id: 'eyeR', type: 'circle', x: 58, y: 42, scaleX: 0.11, scaleY: 0.11, fill: 'background' }
        ]
    },
    sea_penguin: {
        id: 'sea_penguin', name: 'Penguin',
        layers: [
            { id: 'footL', type: 'triangle', x: 42, y: 88, scaleX: 0.2, scaleY: 0.14, rotation: 180, fill: 'accent' },
            { id: 'footR', type: 'triangle', x: 58, y: 88, scaleX: 0.2, scaleY: 0.14, rotation: 180, fill: 'accent' },
            { id: 'body', type: 'arch', x: 50, y: 54, scaleX: 0.64, scaleY: 1.5, fill: 'accent' },
            { id: 'belly', type: 'circle', x: 50, y: 62, scaleX: 0.44, scaleY: 0.72, fill: FACET, opacity: 0.92 },
            { id: 'eyeL', type: 'circle', x: 44, y: 32, scaleX: 0.08, scaleY: 0.08, fill: 'background' },
            { id: 'eyeR', type: 'circle', x: 56, y: 32, scaleX: 0.08, scaleY: 0.08, fill: 'background' },
            { id: 'beak', type: 'triangle', x: 50, y: 38, scaleX: 0.14, scaleY: 0.13, rotation: 180, fill: 'background' }
        ]
    },
    sea_sailor: {
        id: 'sea_sailor', name: 'Sailor',
        layers: [
            { id: 'body', type: 'arch', x: 50, y: 74, scaleX: 0.66, scaleY: 0.7, fill: 'accent' },
            { id: 'collar', type: 'triangle', x: 50, y: 62, scaleX: 0.3, scaleY: 0.24, fill: FACET, opacity: 0.85 },
            { id: 'head', type: 'circle', x: 50, y: 46, scaleX: 0.34, scaleY: 0.34, fill: 'accent' },
            { id: 'hatBand', type: 'rectangle', x: 50, y: 30, scaleX: 0.5, scaleY: 0.1, fill: 'accent' },
            { id: 'hatTop', type: 'semi-circle', x: 50, y: 30, scaleX: 0.6, scaleY: 0.5, fill: 'accent' },
            { id: 'hatStripe', type: 'rectangle', x: 50, y: 33, scaleX: 0.48, scaleY: 0.05, fill: FACET, opacity: 0.85 }
        ]
    },

    // ---------------- Multipliers ----------------
    sea_lighthouse: {
        id: 'sea_lighthouse', name: 'Lighthouse',
        layers: [
            { id: 'rayL', type: 'triangle', x: 30, y: 24, scaleX: 0.34, scaleY: 0.2, rotation: -60, fill: FACET, opacity: 0.4 },
            { id: 'rayR', type: 'triangle', x: 70, y: 24, scaleX: 0.34, scaleY: 0.2, rotation: 60, fill: FACET, opacity: 0.4 },
            { id: 'tower', type: 'bezier', x: 0, y: 0, fill: 'accent', customPath: 'M 40 34 L 60 34 L 66 84 L 34 84 Z' },
            { id: 'lamp', type: 'rectangle', x: 50, y: 28, scaleX: 0.32, scaleY: 0.18, fill: 'accent' },
            { id: 'roof', type: 'triangle', x: 50, y: 17, scaleX: 0.3, scaleY: 0.24, fill: 'accent' },
            { id: 'lamp_glow', type: 'circle', x: 50, y: 28, scaleX: 0.16, scaleY: 0.18, fill: FACET, opacity: 0.6 },
            { id: 'band1', type: 'rectangle', x: 47, y: 48, scaleX: 0.6, scaleY: 0.08, rotation: 8, fill: FACET, opacity: 0.3 },
            { id: 'band2', type: 'rectangle', x: 49, y: 66, scaleX: 0.66, scaleY: 0.08, rotation: 8, fill: FACET, opacity: 0.3 }
        ]
    },
    sea_shoal: {
        id: 'sea_shoal', name: 'Shoal of Fish',
        layers: [
            // three little chevron fish
            { id: 'f1b', type: 'triangle', x: 36, y: 34, scaleX: 0.34, scaleY: 0.5, rotation: 90, fill: 'accent' },
            { id: 'f1t', type: 'triangle', x: 24, y: 34, scaleX: 0.2, scaleY: 0.34, rotation: -90, fill: 'accent' },
            { id: 'f2b', type: 'triangle', x: 66, y: 50, scaleX: 0.34, scaleY: 0.5, rotation: 90, fill: 'accent' },
            { id: 'f2t', type: 'triangle', x: 54, y: 50, scaleX: 0.2, scaleY: 0.34, rotation: -90, fill: 'accent' },
            { id: 'f3b', type: 'triangle', x: 40, y: 68, scaleX: 0.34, scaleY: 0.5, rotation: 90, fill: 'accent' },
            { id: 'f3t', type: 'triangle', x: 28, y: 68, scaleX: 0.2, scaleY: 0.34, rotation: -90, fill: 'accent' },
            { id: 'e1', type: 'circle', x: 44, y: 32, scaleX: 0.06, scaleY: 0.06, fill: 'background' },
            { id: 'e2', type: 'circle', x: 74, y: 48, scaleX: 0.06, scaleY: 0.06, fill: 'background' },
            { id: 'e3', type: 'circle', x: 48, y: 66, scaleX: 0.06, scaleY: 0.06, fill: 'background' }
        ]
    },
    sea_colony: {
        id: 'sea_colony', name: 'Penguin Colony',
        layers: [
            { id: 'pL', type: 'arch', x: 30, y: 60, scaleX: 0.4, scaleY: 1.0, fill: 'accent' },
            { id: 'pLb', type: 'circle', x: 30, y: 64, scaleX: 0.26, scaleY: 0.5, fill: FACET, opacity: 0.9 },
            { id: 'pR', type: 'arch', x: 70, y: 60, scaleX: 0.4, scaleY: 1.0, fill: 'accent' },
            { id: 'pRb', type: 'circle', x: 70, y: 64, scaleX: 0.26, scaleY: 0.5, fill: FACET, opacity: 0.9 },
            { id: 'pC', type: 'arch', x: 50, y: 52, scaleX: 0.46, scaleY: 1.15, fill: 'accent' },
            { id: 'pCb', type: 'circle', x: 50, y: 58, scaleX: 0.3, scaleY: 0.56, fill: FACET, opacity: 0.92 }
        ]
    },
    sea_captain: {
        id: 'sea_captain', name: 'Captain',
        layers: [
            // an anchor — the captain marshals the sailors
            { id: 'ring', type: 'circle', x: 50, y: 22, scaleX: 0.34, scaleY: 0.34, fill: 'none', stroke: 'accent', strokeWidth: 9 },
            { id: 'shaft', type: 'rectangle', x: 50, y: 54, scaleX: 0.08, scaleY: 0.82, fill: 'accent' },
            { id: 'cross', type: 'rectangle', x: 50, y: 36, scaleX: 0.46, scaleY: 0.08, fill: 'accent' },
            { id: 'flukes', type: 'bezier', x: 0, y: 0, fill: 'accent',
                customPath: 'M 22 58 Q 24 84 50 86 Q 76 84 78 58 L 68 58 Q 66 76 50 78 Q 34 76 32 58 Z' },
            { id: 'tipL', type: 'triangle', x: 22, y: 54, scaleX: 0.14, scaleY: 0.16, rotation: -30, fill: 'accent' },
            { id: 'tipR', type: 'triangle', x: 78, y: 54, scaleX: 0.14, scaleY: 0.16, rotation: 30, fill: 'accent' },
            { id: 'shine', type: 'circle', x: 50, y: 22, scaleX: 0.12, scaleY: 0.12, fill: 'background' }
        ]
    },

    // ---------------- Mermaid ----------------
    sea_mermaid: {
        id: 'sea_mermaid', name: 'Mermaid',
        layers: [
            { id: 'head', type: 'circle', x: 50, y: 26, scaleX: 0.26, scaleY: 0.26, fill: 'accent' },
            { id: 'torso', type: 'bezier', x: 0, y: 0, fill: 'accent', customPath: 'M 42 34 Q 50 29 58 34 L 56 56 L 44 56 Z' },
            { id: 'tail', type: 'bezier', x: 0, y: 0, fill: 'accent', customPath: 'M 44 54 Q 39 76 50 82 Q 61 76 56 54 Z' },
            { id: 'fluke', type: 'bezier', x: 0, y: 0, fill: 'accent', customPath: 'M 50 80 L 32 92 Q 50 82 50 88 Q 50 82 68 92 Z' },
            { id: 'hair', type: 'bezier', x: 0, y: 0, fill: FACET, opacity: 0.3, customPath: 'M 40 26 Q 34 44 44 52 L 46 40 Z' },
            { id: 'scales', type: 'circle', x: 50, y: 64, scaleX: 0.24, scaleY: 0.4, fill: FACET, opacity: 0.24 }
        ]
    },

    // ---------------- Duo action glyphs (score strip) ----------------
    act_draw: {
        id: 'act_draw', name: 'Draw',
        layers: [
            { id: 'shaft', type: 'rectangle', x: 50, y: 40, scaleX: 0.16, scaleY: 0.5, fill: 'accent' },
            { id: 'head', type: 'triangle', x: 50, y: 64, scaleX: 0.42, scaleY: 0.34, rotation: 180, fill: 'accent' },
            { id: 'deck', type: 'rectangle', x: 50, y: 84, scaleX: 0.7, scaleY: 0.14, fill: 'accent' }
        ]
    },
    act_extra: {
        id: 'act_extra', name: 'Extra Turn',
        layers: [
            { id: 'ring', type: 'circle', x: 50, y: 52, scaleX: 0.9, scaleY: 0.9, fill: 'none', stroke: 'accent', strokeWidth: 12 },
            { id: 'gap', type: 'rectangle', x: 74, y: 34, scaleX: 0.5, scaleY: 0.5, rotation: 30, fill: 'background' },
            { id: 'arrow', type: 'triangle', x: 68, y: 26, scaleX: 0.34, scaleY: 0.34, rotation: 120, fill: 'accent' }
        ]
    },
    act_steal: {
        id: 'act_steal', name: 'Steal',
        layers: [
            { id: 'palm', type: 'bezier', x: 0, y: 0, fill: 'accent', customPath: 'M 34 46 L 66 46 L 66 66 Q 50 78 34 66 Z' },
            { id: 'f1', type: 'rectangle', x: 39, y: 38, scaleX: 0.1, scaleY: 0.34, fill: 'accent' },
            { id: 'f2', type: 'rectangle', x: 50, y: 34, scaleX: 0.1, scaleY: 0.42, fill: 'accent' },
            { id: 'f3', type: 'rectangle', x: 61, y: 38, scaleX: 0.1, scaleY: 0.34, fill: 'accent' },
            { id: 'thumb', type: 'rectangle', x: 30, y: 54, scaleX: 0.24, scaleY: 0.1, rotation: 40, fill: 'accent' }
        ]
    },
    act_peek: {
        id: 'act_peek', name: 'Peek',
        layers: [
            { id: 'eye', type: 'bezier', x: 0, y: 0, fill: 'accent', customPath: 'M 16 50 Q 50 24 84 50 Q 50 76 16 50 Z' },
            { id: 'white', type: 'circle', x: 50, y: 50, scaleX: 0.52, scaleY: 0.52, fill: 'background' },
            { id: 'iris', type: 'circle', x: 50, y: 50, scaleX: 0.3, scaleY: 0.3, fill: 'accent' }
        ]
    },

    // ---------------- Category markers (top-right chip) ----------------
    mark_duo: {
        id: 'mark_duo', name: 'Duo',
        layers: [
            { id: 'para', type: 'bezier', x: 0, y: 0, fill: 'accent', customPath: 'M 34 30 L 74 30 L 66 70 L 26 70 Z' }
        ]
    },
    mark_collector: {
        id: 'mark_collector', name: 'Collector',
        layers: [
            { id: 'b1', type: 'rectangle', x: 50, y: 32, scaleX: 0.8, scaleY: 0.16, fill: 'accent' },
            { id: 'b2', type: 'rectangle', x: 50, y: 50, scaleX: 0.8, scaleY: 0.16, fill: 'accent' },
            { id: 'b3', type: 'rectangle', x: 50, y: 68, scaleX: 0.8, scaleY: 0.16, fill: 'accent' }
        ]
    },
    mark_multiplier: {
        id: 'mark_multiplier', name: 'Multiplier',
        layers: [
            { id: 'x1', type: 'rectangle', x: 50, y: 50, scaleX: 0.9, scaleY: 0.2, rotation: 45, fill: 'accent' },
            { id: 'x2', type: 'rectangle', x: 50, y: 50, scaleX: 0.9, scaleY: 0.2, rotation: -45, fill: 'accent' }
        ]
    },
    mark_mermaid: {
        id: 'mark_mermaid', name: 'Mermaid',
        layers: [
            { id: 'star', type: 'bezier', x: 0, y: 0, fill: 'accent', customPath: 'M 50 14 L 61 40 L 88 40 L 66 57 L 75 84 L 50 67 L 25 84 L 34 57 L 12 40 L 39 40 Z' }
        ]
    },

    // Uniform card back (hidden cards look identical — never leak info by colour).
    sea_back: {
        id: 'sea_back', name: 'Deck Back',
        layers: [
            { id: 'ring', type: 'circle', x: 50, y: 50, scaleX: 1.7, scaleY: 1.7, fill: 'none', stroke: '#cfe0e8', strokeWidth: 3 },
            { id: 'wave1', type: 'bezier', x: 0, y: 0, fill: '#cfe0e8', customPath: 'M 24 46 Q 34 38 44 46 Q 54 54 64 46 Q 74 38 78 46 L 78 52 Q 74 44 64 52 Q 54 60 44 52 Q 34 44 24 52 Z' },
            { id: 'wave2', type: 'bezier', x: 0, y: 0, fill: '#e8f1f5', customPath: 'M 24 58 Q 34 50 44 58 Q 54 66 64 58 Q 74 50 78 58 L 78 64 Q 74 56 64 64 Q 54 72 44 64 Q 34 56 24 64 Z' }
        ]
    }
};

export const SEASALT_BACK_BG = '#2b5566';

// ==========================================
// 4. Card definition builder
// ==========================================

export interface SeaSaltCardVisualOpts {
    withBack?: boolean;
    // For collectors: how many of the set the owner currently holds (highlights
    // the reached threshold). Omit for a neutral reference card.
    setCount?: number;
    // Small deck-count badge in the bottom-right (print reference, optional).
    deckCount?: number;
}

// Tune the on-card score-strip sizing here (in em, relative to the card base font).
// These flow to the card-renderer via ScoreStripRegion.cellSize / iconSize.
export const SEASALT_STRIP_CELL_SIZE = 2.6;   // threshold numbers / points / ratios
export const SEASALT_STRIP_ICON_SIZE = 1.9;   // action / multiplier-target glyph

function categoryMarker(cat: SeaSaltCategory): string {
    switch (cat) {
        case 'duo': return 'mark_duo';
        case 'collector': return 'mark_collector';
        case 'multiplier': return 'mark_multiplier';
        case 'mermaid': return 'mark_mermaid';
    }
}

// Build the left-edge score strip for a card, based on its category.
function buildScoreStrip(type: SeaSaltType, opts: SeaSaltCardVisualOpts): CardDefinition['scoreStrip'] {
    const info = TYPE_INFO[type];

    if (info.category === 'collector' && info.thresholds) {
        const held = opts.setCount ?? 0;
        const cells: ScoreCell[] = info.thresholds.map((pts, i) => {
            const size = i + 1;
            return {
                value: String(pts),
                active: held > 0 && held === size,
                muted: held > 0 && size > held
            };
        });
        return {
            cells, position: 'left', align: 'start', color: 'accent', gap: 0.35,
            cellSize: SEASALT_STRIP_CELL_SIZE, iconSize: SEASALT_STRIP_ICON_SIZE
        };
    }

    if (info.category === 'duo') {
        return {
            cells: [{ iconId: info.actionIcon, value: '1', color: 'accent' }],
            position: 'left', align: 'start', color: 'accent', gap: 0.35,
            cellSize: SEASALT_STRIP_CELL_SIZE, iconSize: SEASALT_STRIP_ICON_SIZE
        };
    }

    if (info.category === 'multiplier' && info.target) {
        return {
            cells: [{ iconId: `sea_${info.target}`, value: `×${info.perTarget}`, color: 'accent' }],
            position: 'left', align: 'start', color: 'accent', gap: 0.3,
            cellSize: SEASALT_STRIP_CELL_SIZE, iconSize: SEASALT_STRIP_ICON_SIZE
        };
    }

    if (info.category === 'mermaid') {
        return {
            cells: [{ iconId: 'mark_multiplier', value: '1', color: 'accent' }],
            position: 'left', align: 'start', color: 'accent', gap: 0.3,
            cellSize: SEASALT_STRIP_CELL_SIZE, iconSize: SEASALT_STRIP_ICON_SIZE
        };
    }

    return undefined;
}

/**
 * Build the card-renderer definition for a Sea Salt & Paper card.
 */
export function getSeaSaltCardDefinition(
    type: SeaSaltType,
    color: SeaSaltColor,
    opts: SeaSaltCardVisualOpts = {}
): CardDefinition {
    const info = TYPE_INFO[type];
    const palette = getSeaSaltPalette(color);

    const overlays: NonNullable<CardDefinition['overlays']> = [
        // Top-right: the category marker chip (duo / collector / multiplier / mermaid).
        {
            position: 'top-right',
            shape: 'chip',
            iconId: categoryMarker(info.category),
            backgroundColor: 'accent',
            color: 'secondary',
            size: 3.4,
            radius: 0.85,
            offsetX: 0.45,
            offsetY: 0.45,
            scaling: 1.0
        }
    ];

    if (opts.deckCount !== undefined) {
        overlays.push({
            position: 'bottom-right',
            shape: 'chip',
            value: `×${opts.deckCount}`,
            backgroundColor: 'accent',
            color: 'secondary',
            size: 3.0,
            radius: 0.8,
            offsetX: 0.45,
            offsetY: 0.45
        });
    }

    const def: CardDefinition = {
        id: `seasalt-${type}-${color}`,
        name: info.label,
        widthMm: 63.5,
        heightMm: 88.9,
        borderRadiusMm: 5,
        palette,
        borderWidth: 0,
        mainArt: {
            iconId: `sea_${type}`,
            frameStyle: 'none',
            scaling: 1.12
        },
        overlays,
        scoreStrip: buildScoreStrip(type, opts),
        // Footer band naming the card type ("Fish", "Mermaid", "Shoal of Fish"…).
        footer: {
            text: info.label,
            align: 'center',
            verticalAlign: 'center',
            size: 1.95,
            background: 'accent',
            color: 'secondary',
            italic: false,
            weight: 800
        }
    };

    if (opts.withBack) {
        def.backIconId = 'sea_back';
        def.backBgColor = SEASALT_BACK_BG;
    }

    return def;
}
