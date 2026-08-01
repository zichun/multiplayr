/**
 * OffWithTheirHeadsAssets.ts
 * Soft-pastel palettes and flat, geometric, negative-space iconography for
 * "Off With Their Heads".
 *
 * The three private zones each own a colour and a single clean glyph so they read
 * instantly on a phone: the MEADOW is a spotted toadstool (soft green), the WOODS
 * a stacked pine (soft teal), the KEEP a crenellated castle with a knocked-out gate
 * (soft plum). Every glyph is drawn in a 0-100 viewBox filled with the palette's
 * 'primary' and details knocked out in 'background' — the same negative-space
 * recipe used across the platform (CatInTheBox cat, Courtisans crests) — so a glyph
 * re-themes just by swapping its palette. Depth is tonal, never blurred shadow.
 *
 * The vibe is light and whimsical (Wonderland tea-party), so colours are muted
 * pastels, gold accents, and rounded forms — no neon, no hard black borders.
 */

import { Palette, IconObject } from '../../client/lib/card-renderer/types';
import { Zone, Guest, Suit } from './OffWithTheirHeadsGameState';

// ---------------------------------------------------------------------------
// Colour system (flat pastels). Exported hexes double as the SCSS source values.
// ---------------------------------------------------------------------------

export const INK = '#4a4458';
export const IVORY = '#fbf7ef';
export const GOLD = '#e7c26b';

export const ZONE_HEX: Record<Zone, string> = {
    meadow: '#7cc08a',   // soft meadow green
    woods: '#57b0a6',    // soft woodland teal
    keep: '#b184cc'      // soft plum stone
};

export const ZONE_TEXT: Record<Zone, string> = {
    meadow: '#2f6b40',
    woods: '#1f6058',
    keep: '#5a3b73'
};

export const ZONE_SOFT: Record<Zone, string> = {
    meadow: '#e7f4ea',
    woods: '#e2f2ef',
    keep: '#f1e9f8'
};

export const ZONE_LABELS: Record<Zone, string> = {
    meadow: 'Meadow',
    woods: 'Woods',
    keep: 'Keep'
};

// The Red Queen's rosy accent + suit colours.
export const QUEEN_RED = '#e0798f';
export const SUIT_HEX: Record<Suit, string> = {
    H: '#d8637a', D: '#d8637a', C: '#4a4458', S: '#4a4458'
};
export const SUIT_GLYPH: Record<Suit, string> = { H: '♥', D: '♦', C: '♣', S: '♠' };
export const SUIT_LABEL: Record<Suit, string> = { H: 'Hearts', D: 'Diamonds', C: 'Clubs', S: 'Spades' };

// Build a full Palette from a primary tone (background = ivory for knockouts).
function palette(id: string, primary: string, accent: string = GOLD, bg: string = IVORY): Palette {
    return {
        id,
        name: id,
        background: bg,
        border: primary,
        primary,
        secondary: accent,
        accent,
        charcoal: INK,
        text: INK,
        panelBg: primary,
        tertiary: accent,
        success: '#57b894',
        danger: '#e0796f'
    };
}

export const ZONE_PALETTES: Record<Zone, Palette> = {
    meadow: palette('owth_meadow', ZONE_HEX.meadow),
    woods: palette('owth_woods', ZONE_HEX.woods),
    keep: palette('owth_keep', ZONE_HEX.keep)
};

export const GOLD_PALETTE = palette('owth_gold', GOLD, '#8a6a1f');
export const QUEEN_PALETTE = palette('owth_queen', QUEEN_RED, GOLD);
export const SLATE_PALETTE = palette('owth_slate', '#8a86a0', GOLD);

// ---------------------------------------------------------------------------
// Zone glyphs
// ---------------------------------------------------------------------------

// MEADOW — a spotted toadstool: domed cap + stem, three knocked-out spots.
export const MUSHROOM_ICON: IconObject = {
    id: 'owth_mushroom', name: 'Toadstool',
    layers: [
        { id: 'stem', type: 'rectangle', x: 50, y: 68, scaleX: 0.42, scaleY: 0.52, fill: 'primary' },
        { id: 'stem_foot', type: 'circle', x: 50, y: 80, scaleX: 0.5, scaleY: 0.3, fill: 'primary' },
        { id: 'cap', type: 'semi-circle', x: 50, y: 54, scaleX: 1.72, scaleY: 1.5, fill: 'primary' },
        { id: 'spot_c', type: 'circle', x: 50, y: 34, scaleX: 0.2, scaleY: 0.2, fill: 'background' },
        { id: 'spot_l', type: 'circle', x: 34, y: 44, scaleX: 0.26, scaleY: 0.26, fill: 'background' },
        { id: 'spot_r', type: 'circle', x: 66, y: 45, scaleX: 0.22, scaleY: 0.22, fill: 'background' }
    ]
};

// WOODS — a stacked geometric pine.
export const PINE_ICON: IconObject = {
    id: 'owth_pine', name: 'Pine',
    layers: [
        { id: 'trunk', type: 'rectangle', x: 50, y: 84, scaleX: 0.2, scaleY: 0.28, fill: 'primary' },
        { id: 't3', type: 'triangle', x: 50, y: 70, scaleX: 1.5, scaleY: 0.86, fill: 'primary' },
        { id: 't2', type: 'triangle', x: 50, y: 50, scaleX: 1.24, scaleY: 0.82, fill: 'primary' },
        { id: 't1', type: 'triangle', x: 50, y: 32, scaleX: 0.94, scaleY: 0.8, fill: 'primary' },
        // subtle carved notches for depth
        { id: 'n2', type: 'rectangle', x: 50, y: 61, scaleX: 0.9, scaleY: 0.03, fill: 'background', opacity: 0.5 },
        { id: 'n3', type: 'rectangle', x: 50, y: 79, scaleX: 1.14, scaleY: 0.03, fill: 'background', opacity: 0.5 }
    ]
};

// KEEP — a crenellated castle with a knocked-out gate.
export const CASTLE_ICON: IconObject = {
    id: 'owth_castle', name: 'Keep',
    layers: [
        { id: 'wall', type: 'rectangle', x: 50, y: 64, scaleX: 1.44, scaleY: 0.66, fill: 'primary' },
        { id: 'merlon_l', type: 'rectangle', x: 30, y: 44, scaleX: 0.22, scaleY: 0.3, fill: 'primary' },
        { id: 'merlon_c', type: 'rectangle', x: 50, y: 44, scaleX: 0.22, scaleY: 0.3, fill: 'primary' },
        { id: 'merlon_r', type: 'rectangle', x: 70, y: 44, scaleX: 0.22, scaleY: 0.3, fill: 'primary' },
        { id: 'gate', type: 'arch', x: 50, y: 78, scaleX: 0.52, scaleY: 0.78, rotation: 180, fill: 'background' },
        { id: 'window', type: 'circle', x: 50, y: 52, scaleX: 0.16, scaleY: 0.16, fill: 'background' }
    ]
};

export const ZONE_ICONS: Record<Zone, IconObject> = {
    meadow: MUSHROOM_ICON,
    woods: PINE_ICON,
    keep: CASTLE_ICON
};

// ---------------------------------------------------------------------------
// Board / status glyphs
// ---------------------------------------------------------------------------

// A three-point crown for the Red Queen / title.
export const CROWN_ICON: IconObject = {
    id: 'owth_crown', name: 'Crown',
    layers: [
        { id: 'base', type: 'rectangle', x: 50, y: 66, scaleX: 0.86, scaleY: 0.18, fill: 'primary' },
        { id: 'p1', type: 'triangle', x: 26, y: 50, scaleX: 0.3, scaleY: 0.44, fill: 'primary' },
        { id: 'p2', type: 'triangle', x: 50, y: 42, scaleX: 0.34, scaleY: 0.56, fill: 'primary' },
        { id: 'p3', type: 'triangle', x: 74, y: 50, scaleX: 0.3, scaleY: 0.44, fill: 'primary' },
        { id: 'g1', type: 'circle', x: 26, y: 46, scaleX: 0.13, scaleY: 0.13, fill: 'accent' },
        { id: 'g2', type: 'circle', x: 50, y: 38, scaleX: 0.15, scaleY: 0.15, fill: 'accent' },
        { id: 'g3', type: 'circle', x: 74, y: 46, scaleX: 0.13, scaleY: 0.13, fill: 'accent' }
    ]
};

// A teacup (bonus-stack marker): rounded body + saucer + handle ring.
export const TEACUP_ICON: IconObject = {
    id: 'owth_teacup', name: 'Teacup',
    layers: [
        { id: 'body', type: 'arch', x: 47, y: 46, scaleX: 0.78, scaleY: 0.66, rotation: 180, fill: 'primary' },
        { id: 'handle', type: 'circle', x: 71, y: 50, scaleX: 0.34, scaleY: 0.34, fill: 'none', stroke: 'primary', strokeWidth: 6 },
        { id: 'saucer', type: 'arch', x: 48, y: 74, scaleX: 1.0, scaleY: 0.22, rotation: 180, fill: 'primary' },
        { id: 'brew', type: 'rectangle', x: 47, y: 40, scaleX: 0.62, scaleY: 0.05, fill: 'background', opacity: 0.75 }
    ]
};

// A bitten biscuit (repeat-mark marker): disc with a bite + chips knocked out.
export const BISCUIT_ICON: IconObject = {
    id: 'owth_biscuit', name: 'Biscuit',
    layers: [
        { id: 'cookie', type: 'circle', x: 48, y: 52, scaleX: 1.5, scaleY: 1.5, fill: 'primary' },
        { id: 'bite', type: 'circle', x: 76, y: 34, scaleX: 0.62, scaleY: 0.62, fill: 'background' },
        { id: 'chip1', type: 'circle', x: 42, y: 48, scaleX: 0.16, scaleY: 0.16, fill: 'background' },
        { id: 'chip2', type: 'circle', x: 56, y: 62, scaleX: 0.14, scaleY: 0.14, fill: 'background' },
        { id: 'chip3', type: 'circle', x: 38, y: 66, scaleX: 0.12, scaleY: 0.12, fill: 'background' }
    ]
};

// ---------------------------------------------------------------------------
// Wonderlandian (Tea Party guest) glyphs — small, whimsical, geometric.
// ---------------------------------------------------------------------------

export const GUEST_ICONS: Record<Guest, IconObject> = {
    // Caterpillar — four stacked segments + antennae.
    caterpillar: {
        id: 'owth_caterpillar', name: 'Caterpillar',
        layers: [
            { id: 's1', type: 'circle', x: 28, y: 58, scaleX: 0.56, scaleY: 0.56, fill: 'primary' },
            { id: 's2', type: 'circle', x: 42, y: 54, scaleX: 0.6, scaleY: 0.6, fill: 'primary' },
            { id: 's3', type: 'circle', x: 57, y: 52, scaleX: 0.64, scaleY: 0.64, fill: 'primary' },
            { id: 'head', type: 'circle', x: 72, y: 50, scaleX: 0.7, scaleY: 0.7, fill: 'primary' },
            { id: 'ant_l', type: 'rectangle', x: 70, y: 34, scaleX: 0.045, scaleY: 0.26, rotation: -18, fill: 'primary' },
            { id: 'ant_r', type: 'rectangle', x: 78, y: 34, scaleX: 0.045, scaleY: 0.26, rotation: 18, fill: 'primary' },
            { id: 'eye', type: 'circle', x: 76, y: 48, scaleX: 0.12, scaleY: 0.12, fill: 'background' }
        ]
    },
    // Cheshire Cat — grinning head with ears and a wide smile.
    cheshire: {
        id: 'owth_cheshire', name: 'Cheshire Cat',
        layers: [
            { id: 'ear_l', type: 'triangle', x: 33, y: 30, scaleX: 0.34, scaleY: 0.4, fill: 'primary' },
            { id: 'ear_r', type: 'triangle', x: 67, y: 30, scaleX: 0.34, scaleY: 0.4, fill: 'primary' },
            { id: 'head', type: 'circle', x: 50, y: 54, scaleX: 1.4, scaleY: 1.24, fill: 'primary' },
            { id: 'eye_l', type: 'circle', x: 40, y: 48, scaleX: 0.14, scaleY: 0.18, fill: 'background' },
            { id: 'eye_r', type: 'circle', x: 60, y: 48, scaleX: 0.14, scaleY: 0.18, fill: 'background' },
            { id: 'grin', type: 'semi-circle', x: 50, y: 58, scaleX: 0.86, scaleY: 0.5, rotation: 180, fill: 'background' },
            { id: 'grin_line', type: 'rectangle', x: 50, y: 58, scaleX: 0.86, scaleY: 0.05, fill: 'primary' }
        ]
    },
    // Dormouse — round head with two big ears and a nose.
    dormouse: {
        id: 'owth_dormouse', name: 'Dormouse',
        layers: [
            { id: 'ear_l', type: 'circle', x: 32, y: 38, scaleX: 0.56, scaleY: 0.56, fill: 'primary' },
            { id: 'ear_r', type: 'circle', x: 68, y: 38, scaleX: 0.56, scaleY: 0.56, fill: 'primary' },
            { id: 'head', type: 'circle', x: 50, y: 58, scaleX: 1.3, scaleY: 1.2, fill: 'primary' },
            { id: 'eye_l', type: 'circle', x: 42, y: 54, scaleX: 0.1, scaleY: 0.12, fill: 'background' },
            { id: 'eye_r', type: 'circle', x: 58, y: 54, scaleX: 0.1, scaleY: 0.12, fill: 'background' },
            { id: 'nose', type: 'triangle', x: 50, y: 66, scaleX: 0.16, scaleY: 0.14, rotation: 180, fill: 'background' }
        ]
    },
    // March Hare — head with two tall ears.
    marchhare: {
        id: 'owth_marchhare', name: 'March Hare',
        layers: [
            { id: 'ear_l', type: 'circle', x: 41, y: 30, scaleX: 0.24, scaleY: 0.86, rotation: -12, fill: 'primary' },
            { id: 'ear_r', type: 'circle', x: 59, y: 30, scaleX: 0.24, scaleY: 0.86, rotation: 12, fill: 'primary' },
            { id: 'head', type: 'circle', x: 50, y: 62, scaleX: 1.02, scaleY: 1.0, fill: 'primary' },
            { id: 'inner_l', type: 'circle', x: 41, y: 30, scaleX: 0.1, scaleY: 0.58, rotation: -12, fill: 'background', opacity: 0.55 },
            { id: 'inner_r', type: 'circle', x: 59, y: 30, scaleX: 0.1, scaleY: 0.58, rotation: 12, fill: 'background', opacity: 0.55 },
            { id: 'eye_l', type: 'circle', x: 44, y: 60, scaleX: 0.1, scaleY: 0.1, fill: 'background' },
            { id: 'eye_r', type: 'circle', x: 56, y: 60, scaleX: 0.1, scaleY: 0.1, fill: 'background' }
        ]
    },
    // Humpty Dumpty — an egg with a belt and eyes.
    humpty: {
        id: 'owth_humpty', name: 'Humpty Dumpty',
        layers: [
            { id: 'egg', type: 'circle', x: 50, y: 52, scaleX: 1.16, scaleY: 1.52, fill: 'primary' },
            { id: 'eye_l', type: 'circle', x: 42, y: 44, scaleX: 0.11, scaleY: 0.13, fill: 'background' },
            { id: 'eye_r', type: 'circle', x: 58, y: 44, scaleX: 0.11, scaleY: 0.13, fill: 'background' },
            { id: 'belt', type: 'rectangle', x: 50, y: 64, scaleX: 0.9, scaleY: 0.1, fill: 'background' },
            { id: 'buckle', type: 'circle', x: 50, y: 64, scaleX: 0.14, scaleY: 0.14, fill: 'accent' }
        ]
    },
    // White Rabbit — hare head + a pocket-watch accent dot.
    rabbit: {
        id: 'owth_rabbit', name: 'White Rabbit',
        layers: [
            { id: 'ear_l', type: 'circle', x: 42, y: 28, scaleX: 0.22, scaleY: 0.82, rotation: -10, fill: 'primary' },
            { id: 'ear_r', type: 'circle', x: 58, y: 28, scaleX: 0.22, scaleY: 0.82, rotation: 10, fill: 'primary' },
            { id: 'head', type: 'circle', x: 48, y: 60, scaleX: 0.98, scaleY: 0.96, fill: 'primary' },
            { id: 'eye', type: 'circle', x: 44, y: 58, scaleX: 0.1, scaleY: 0.1, fill: 'background' },
            { id: 'watch', type: 'circle', x: 74, y: 70, scaleX: 0.36, scaleY: 0.36, fill: 'accent' },
            { id: 'watch_c', type: 'circle', x: 74, y: 70, scaleX: 0.12, scaleY: 0.12, fill: 'primary' }
        ]
    },
    // Mad Hatter — a top hat with a band.
    madhatter: {
        id: 'owth_madhatter', name: 'Mad Hatter',
        layers: [
            { id: 'brim', type: 'rectangle', x: 50, y: 74, scaleX: 1.4, scaleY: 0.16, fill: 'primary' },
            { id: 'crown', type: 'rectangle', x: 50, y: 48, scaleX: 0.86, scaleY: 0.86, fill: 'primary' },
            { id: 'band', type: 'rectangle', x: 50, y: 64, scaleX: 0.86, scaleY: 0.16, fill: 'accent' },
            { id: 'card', type: 'rectangle', x: 66, y: 40, scaleX: 0.16, scaleY: 0.26, fill: 'background', opacity: 0.85 }
        ]
    }
};

// ---------------------------------------------------------------------------
// Icon map export (for the inspector + customIcons)
// ---------------------------------------------------------------------------

export const OWTH_ICONS: Record<string, IconObject> = {
    meadow: MUSHROOM_ICON,
    woods: PINE_ICON,
    keep: CASTLE_ICON,
    crown: CROWN_ICON,
    teacup: TEACUP_ICON,
    biscuit: BISCUIT_ICON,
    caterpillar: GUEST_ICONS.caterpillar,
    cheshire: GUEST_ICONS.cheshire,
    dormouse: GUEST_ICONS.dormouse,
    marchhare: GUEST_ICONS.marchhare,
    humpty: GUEST_ICONS.humpty,
    rabbit: GUEST_ICONS.rabbit,
    madhatter: GUEST_ICONS.madhatter
};
