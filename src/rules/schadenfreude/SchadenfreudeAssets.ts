/**
 * SchadenfreudeAssets.ts
 * Soft pastel treat palettes, flat geometric treat glyphs (one distinct silhouette
 * per suit so suits read without colour), and the card-renderer definition builder
 * for "Seconds, Please!". Card styling mirrors Cat in the Box's mono cards: a flat
 * suit-coloured tile, a big number, and a lighter watermark glyph bleeding off the
 * bottom-right corner.
 */

import { CardDefinition, Palette, IconObject, IconLayer } from '../../client/lib/card-renderer/types';
import { CardSuit, Card, formatValue } from './SchadenfreudeGameState';

export interface TreatStyle {
    fill: string;       // whole-card mono colour
    ink: string;        // number colour (high contrast on fill)
    watermark: string;  // glyph tone, lighter than the fill
}

export const TREAT_STYLE: Record<CardSuit, TreatStyle> = {
    berry:     { fill: '#f2a0b6', ink: '#6b1f38', watermark: '#fad3de' },
    mint:      { fill: '#86d2b3', ink: '#124c37', watermark: '#c6ecdc' },
    blueberry: { fill: '#9ab3e8', ink: '#1f3466', watermark: '#d0dcf5' },
    lemon:     { fill: '#f0d26a', ink: '#5e4c0a', watermark: '#f9e9ae' },
    wild:      { fill: '#fbf3ff', ink: '#4f3474', watermark: '#e3d0f2' }
};

// Rainbow wild cards get a soft multi-stop gradient (applied via scoped CSS).
export const RAINBOW_GRADIENT =
    'linear-gradient(160deg, #fbd0dc 0%, #fbe9b0 30%, #c9eedc 60%, #cfdcf7 85%, #e6d3f6 100%)';

export const SUIT_ICON_ID: Record<CardSuit, string> = {
    berry: 'treat_cupcake',
    mint: 'treat_icecream',
    blueberry: 'treat_donut',
    lemon: 'treat_lollipop',
    wild: 'treat_star'
};

export const SUIT_TREAT_NAME: Record<CardSuit, string> = {
    berry: 'Cupcakes',
    mint: 'Ice Cream',
    blueberry: 'Donuts',
    lemon: 'Lollipops',
    wild: 'Rainbow'
};

export function treatStyle(suit: CardSuit): TreatStyle {
    return TREAT_STYLE[suit] || TREAT_STYLE.wild;
}

// ==========================================
// Treat glyphs (0-100 viewBox). Silhouette in 'primary', details knocked out in
// 'background' so the glyph re-themes with whatever palette it is drawn with.
// ==========================================
const L = (
    id: string, type: IconLayer['type'], x: number, y: number,
    sx: number, sy: number, rot = 0, fill = 'primary'
): IconLayer => ({ id, type, x, y, scaleX: sx, scaleY: sy, rotation: rot, fill } as IconLayer);
const CUT = (id: string, type: IconLayer['type'], x: number, y: number, sx: number, sy: number, rot = 0) =>
    L(id, type, x, y, sx, sy, rot, 'background');
const PATH = (id: string, d: string, fill = 'primary'): IconLayer =>
    ({ id, type: 'bezier', x: 0, y: 0, scaleX: 1, scaleY: 1, fill, customPath: d } as IconLayer);

export const TREAT_ICONS: Record<string, IconObject> = {
    treat_cupcake: {
        id: 'treat_cupcake',
        name: 'Cupcake',
        layers: [
            PATH('wrapper', 'M 27 60 L 73 60 L 66 90 L 34 90 Z'),
            L('frost_l', 'circle', 33, 56, 0.56, 0.5),
            L('frost_r', 'circle', 67, 56, 0.56, 0.5),
            L('frost_m', 'circle', 50, 50, 0.92, 0.66),
            L('frost_t', 'circle', 50, 35, 0.6, 0.48),
            L('cherry', 'circle', 50, 16, 0.34, 0.34),
            CUT('cherry_gap', 'rectangle', 50, 24, 0.4, 0.06),
            CUT('band', 'rectangle', 50, 61, 0.96, 0.1),
            CUT('stripe_1', 'rectangle', 43, 78, 0.1, 0.4),
            CUT('stripe_2', 'rectangle', 57, 78, 0.1, 0.4)
        ]
    },
    treat_icecream: {
        id: 'treat_icecream',
        name: 'Ice Cream',
        layers: [
            PATH('cone', 'M 31 52 L 69 52 L 50 95 Z'),
            CUT('waffle_1', 'rectangle', 50, 64, 0.62, 0.04, 0),
            CUT('waffle_2', 'rectangle', 50, 76, 0.4, 0.04, 0),
            L('scoop', 'circle', 50, 37, 1.04, 0.92),
            L('drip_1', 'circle', 35, 51, 0.3, 0.32),
            L('drip_2', 'circle', 52, 54, 0.3, 0.36),
            L('drip_3', 'circle', 66, 50, 0.26, 0.28),
            CUT('shine', 'circle', 39, 29, 0.16, 0.12, -30)
        ]
    },
    treat_donut: {
        id: 'treat_donut',
        name: 'Donut',
        layers: [
            L('ring', 'circle', 50, 52, 1.6, 1.5),
            CUT('hole', 'circle', 50, 52, 0.5, 0.46),
            CUT('spr_1', 'rectangle', 30, 40, 0.16, 0.05, 30),
            CUT('spr_2', 'rectangle', 48, 26, 0.16, 0.05, -20),
            CUT('spr_3', 'rectangle', 69, 36, 0.16, 0.05, 60),
            CUT('spr_4', 'rectangle', 73, 60, 0.16, 0.05, -40),
            CUT('spr_5', 'rectangle', 55, 77, 0.16, 0.05, 15),
            CUT('spr_6', 'rectangle', 31, 68, 0.16, 0.05, -60)
        ]
    },
    treat_lollipop: {
        id: 'treat_lollipop',
        name: 'Lollipop',
        layers: [
            L('stick', 'rectangle', 50, 80, 0.1, 0.72),
            L('candy', 'circle', 50, 38, 1.36, 1.36),
            CUT('swirl_1', 'circle', 50, 38, 1.0, 1.0),
            L('swirl_2', 'circle', 50, 38, 0.78, 0.78),
            CUT('swirl_3', 'circle', 50, 38, 0.48, 0.48),
            L('swirl_4', 'circle', 50, 38, 0.26, 0.26)
        ]
    },
    treat_star: {
        id: 'treat_star',
        name: 'Rainbow Star',
        layers: [
            PATH('star', 'M 50 8 L 63 37 L 94 37 L 69 57 L 79 88 L 50 68 L 21 88 L 31 57 L 6 37 L 37 37 Z'),
            CUT('dot_1', 'circle', 50, 50, 0.22, 0.22)
        ]
    },
    // Tummy icon for the meter / logo: a round plate with a fork.
    treat_plate: {
        id: 'treat_plate',
        name: 'Plate',
        layers: [
            L('plate', 'circle', 50, 50, 1.8, 1.8),
            CUT('rim', 'circle', 50, 50, 1.36, 1.36),
            L('well', 'circle', 50, 50, 1.24, 1.24),
            L('cake', 'circle', 50, 50, 0.7, 0.7, 0, 'secondary')
        ]
    }
};

// ==========================================
// Palettes
// ==========================================
export function treatPalette(suit: CardSuit): Palette {
    const s = treatStyle(suit);
    return {
        id: `treat_${suit}`,
        name: `Treat ${suit}`,
        background: s.fill,
        border: s.ink,
        primary: s.watermark,
        secondary: s.ink,
        accent: s.ink,
        charcoal: s.ink,
        text: s.ink,
        panelBg: s.fill,
        tertiary: s.watermark,
        success: '#57b894',
        danger: '#e0554f'
    };
}

// A glyph palette for small chips: the silhouette in the solid suit fill, details in white.
export function chipPalette(suit: CardSuit): Palette {
    const s = treatStyle(suit);
    return {
        ...treatPalette(suit),
        primary: suit === 'wild' ? '#b58ad8' : s.fill,
        background: '#ffffff',
        secondary: s.ink
    };
}

// ==========================================
// Card definition (number + watermark treat). `withBack` adds a flip back face —
// ONLY for the trick-resolution animation: a back face forces a 3D flip context
// that breaks pointer hit-testing on small cards, so hand cards stay single-sided.
// ==========================================
export function getTreatCardDefinition(card: Card, withBack = false): CardDefinition {
    const def: CardDefinition = {
        id: `treat-${card.suit}-${card.value}`,
        name: 'Treat Card',
        widthMm: 63.5,
        heightMm: 88.9,
        borderRadiusMm: 6,
        palette: treatPalette(card.suit),
        borderWidth: 0,
        header: {
            title: formatValue(card.value),
            background: 'none'
        },
        mainArt: {
            iconId: SUIT_ICON_ID[card.suit],
            frameStyle: 'none'
        }
    };
    if (withBack) {
        def.backIconId = 'treat_plate';
        def.backIconScaling = 1.1;
        def.backBgColor = '#6e5a8f';
    }
    return def;
}
