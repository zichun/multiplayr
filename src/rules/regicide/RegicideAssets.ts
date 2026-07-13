/**
 * RegicideAssets.ts
 *
 * Flat, soft-pastel visual language for "Regicide" — clean geometric suit glyphs
 * (heart / diamond / club / spade) drawn from primitive shapes in negative-space,
 * a bold crown for the royal enemies, and card-renderer definitions for both the
 * player's number/companion cards and the royal enemy cards.
 *
 * The four suits each own a soft hue tied to their power:
 *   Hearts  -> Heal    (rose)
 *   Diamonds-> Draw     (amber)
 *   Clubs   -> Double   (teal)
 *   Spades  -> Shield   (indigo)
 */

import { CardDefinition, Palette, IconObject } from '../../client/lib/card-renderer/types';
import { Suit, Card, EnemyType, rankLabel, isJester } from './RegicideGameState';

// ==========================================================
// 1. Suit palette (soft, flat)
// ==========================================================
export interface SuitStyle {
    fill: string;   // saturated suit colour (rank ink, chips)
    tint: string;   // very light card background
    glyph: string;  // watermark glyph tone (a light-mid shade)
    ink: string;    // deep suit colour (headers, contrast text)
}

export const SUIT_STYLE: Record<Suit, SuitStyle> = {
    H: { fill: '#e26d7e', tint: '#fdeef1', glyph: '#f3c3cc', ink: '#8a2a3b' }, // Hearts
    D: { fill: '#dca23f', tint: '#fbf1dc', glyph: '#f0d9a6', ink: '#7c560f' }, // Diamonds
    C: { fill: '#3f9e86', tint: '#e4f2ed', glyph: '#b6ddd1', ink: '#1c4d3f' }, // Clubs
    S: { fill: '#5f77c6', tint: '#e8ecfa', glyph: '#c1cbee', ink: '#2c396f' }  // Spades
};

const NEUTRAL: SuitStyle = { fill: '#8b93a6', tint: '#eef0f4', glyph: '#d6dae2', ink: '#3a4152' };

export function suitStyle(suit: Suit | null): SuitStyle {
    return suit ? SUIT_STYLE[suit] : NEUTRAL;
}

export function suitFill(suit: Suit | null): string { return suitStyle(suit).fill; }
export function suitInk(suit: Suit | null): string { return suitStyle(suit).ink; }
export function suitTint(suit: Suit | null): string { return suitStyle(suit).tint; }

// ==========================================================
// 2. Geometric iconography (0-100 viewBox, centred primitives)
// ==========================================================
// Every glyph fills the palette 'primary' key so it re-themes with the card.

const heartLayers = (fill: string) => ([
    { id: 'h_l', type: 'circle' as const, x: 35, y: 40, scaleX: 0.58, scaleY: 0.58, fill },
    { id: 'h_r', type: 'circle' as const, x: 65, y: 40, scaleX: 0.58, scaleY: 0.58, fill },
    { id: 'h_b', type: 'triangle' as const, x: 50, y: 60, scaleX: 1.16, scaleY: 1.0, rotation: 180, fill }
]);

const diamondLayers = (fill: string) => ([
    { id: 'd_s', type: 'rectangle' as const, x: 50, y: 50, scaleX: 0.9, scaleY: 0.9, rotation: 45, fill }
]);

const clubLayers = (fill: string) => ([
    { id: 'c_t', type: 'circle' as const, x: 50, y: 33, scaleX: 0.5, scaleY: 0.5, fill },
    { id: 'c_l', type: 'circle' as const, x: 34, y: 56, scaleX: 0.5, scaleY: 0.5, fill },
    { id: 'c_r', type: 'circle' as const, x: 66, y: 56, scaleX: 0.5, scaleY: 0.5, fill },
    { id: 'c_stem', type: 'triangle' as const, x: 50, y: 74, scaleX: 0.34, scaleY: 0.5, rotation: 180, fill }
]);

const spadeLayers = (fill: string) => ([
    { id: 's_top', type: 'triangle' as const, x: 50, y: 42, scaleX: 1.0, scaleY: 1.05, fill },
    { id: 's_l', type: 'circle' as const, x: 36, y: 58, scaleX: 0.52, scaleY: 0.52, fill },
    { id: 's_r', type: 'circle' as const, x: 64, y: 58, scaleX: 0.52, scaleY: 0.52, fill },
    { id: 's_stem', type: 'triangle' as const, x: 50, y: 76, scaleX: 0.34, scaleY: 0.5, rotation: 180, fill }
]);

function suitIcon(id: string, fill: string, kind: Suit): IconObject {
    const layers = kind === 'H' ? heartLayers(fill)
        : kind === 'D' ? diamondLayers(fill)
        : kind === 'C' ? clubLayers(fill)
        : spadeLayers(fill);
    return { id, name: id, layers: layers as any };
}

// A bold three-point crown for the royal enemies.
const crownLayers = (fill: string) => ([
    { id: 'cr_base', type: 'rectangle' as const, x: 50, y: 68, scaleX: 0.78, scaleY: 0.16, fill },
    { id: 'cr_l', type: 'triangle' as const, x: 22, y: 48, scaleX: 0.3, scaleY: 0.5, fill },
    { id: 'cr_m', type: 'triangle' as const, x: 50, y: 40, scaleX: 0.34, scaleY: 0.66, fill },
    { id: 'cr_r', type: 'triangle' as const, x: 78, y: 48, scaleX: 0.3, scaleY: 0.5, fill },
    { id: 'cr_j1', type: 'circle' as const, x: 22, y: 44, scaleX: 0.16, scaleY: 0.16, fill },
    { id: 'cr_j2', type: 'circle' as const, x: 50, y: 34, scaleX: 0.18, scaleY: 0.18, fill },
    { id: 'cr_j3', type: 'circle' as const, x: 78, y: 44, scaleX: 0.16, scaleY: 0.16, fill }
]);

// A diamond-eyed jester cap (two peaks + bells).
const jesterLayers = (fill: string) => ([
    { id: 'js_l', type: 'triangle' as const, x: 32, y: 44, scaleX: 0.5, scaleY: 0.9, rotation: -18, fill },
    { id: 'js_r', type: 'triangle' as const, x: 68, y: 44, scaleX: 0.5, scaleY: 0.9, rotation: 18, fill },
    { id: 'js_band', type: 'rectangle' as const, x: 50, y: 64, scaleX: 0.86, scaleY: 0.16, fill },
    { id: 'js_b1', type: 'circle' as const, x: 22, y: 30, scaleX: 0.2, scaleY: 0.2, fill },
    { id: 'js_b2', type: 'circle' as const, x: 78, y: 30, scaleX: 0.2, scaleY: 0.2, fill }
]);

export const REGICIDE_ICONS: Record<string, IconObject> = {
    suit_H: suitIcon('suit_H', 'primary', 'H'),
    suit_D: suitIcon('suit_D', 'primary', 'D'),
    suit_C: suitIcon('suit_C', 'primary', 'C'),
    suit_S: suitIcon('suit_S', 'primary', 'S'),
    crown: { id: 'crown', name: 'Crown', layers: crownLayers('primary') as any },
    jester_cap: { id: 'jester_cap', name: 'Jester', layers: jesterLayers('primary') as any },
    // Uniform Tavern-deck back: a crown ring in a fixed neutral tone (never leaks
    // hidden info because every face-down card looks identical).
    card_back: {
        id: 'card_back',
        name: 'Card Back',
        layers: [
            { id: 'cb_ring', type: 'circle', x: 50, y: 50, scaleX: 1.7, scaleY: 1.7, fill: 'none', stroke: '#8a91b5', strokeWidth: 3 },
            ...crownLayers('#c9cfe6')
        ] as any
    }
};

export const CARD_BACK_BG = '#3c4468';

// Standalone glyph accessor for legends / chips (single flat colour).
export function suitGlyphIcon(suit: Suit): IconObject {
    return REGICIDE_ICONS[`suit_${suit}`];
}

// ==========================================================
// 3. Card-renderer definitions
// ==========================================================

function playerCardPalette(card: Card): Palette {
    const s = suitStyle(card.suit);
    return {
        id: `regicide_${card.id}`,
        name: card.id,
        background: s.tint,
        border: s.fill,
        primary: s.glyph,     // watermark suit glyph tone
        secondary: s.glyph,
        accent: s.fill,
        charcoal: s.ink,
        text: s.fill,         // the big rank, in saturated suit colour
        panelBg: s.tint,
        tertiary: s.glyph,
        success: '#57b894',
        danger: '#e0554f'
    };
}

// A player card: soft mono tile with a big rank and a corner suit watermark.
// Jesters render a neutral tile with the jester-cap glyph.
export function getRegicideCardDefinition(card: Card, withBack = false): CardDefinition {
    const jester = isJester(card);
    const s = suitStyle(card.suit);

    const def: CardDefinition = {
        id: `regicide-${card.id}`,
        name: 'Regicide Card',
        widthMm: 63.5,
        heightMm: 88.9,
        borderRadiusMm: 6,
        palette: jester
            ? {
                id: 'regicide_jester', name: 'Jester',
                background: '#f2e9fb', border: '#8a5fce', primary: '#d9c4f2',
                secondary: '#d9c4f2', accent: '#8a5fce', charcoal: '#4a2c74',
                text: '#7a4fc0', panelBg: '#f2e9fb', tertiary: '#d9c4f2',
                success: '#57b894', danger: '#e0554f'
            }
            : playerCardPalette(card),
        borderWidth: 0,
        header: {
            title: jester ? '' : rankLabel(card.rank),
            background: 'none'
        },
        mainArt: {
            iconId: jester ? 'jester_cap' : `suit_${card.suit}`,
            frameStyle: 'none'
        }
    };

    if (withBack) {
        def.backIconId = 'card_back';
        def.backBgColor = CARD_BACK_BG;
    }
    return def;
}

// The royal enemy card: a bold suit-coloured tile with a crown, the royal letter,
// and the suit glyph. Stats live in the surrounding panel, not on the card.
export function getEnemyCardDefinition(card: Card, type: EnemyType): CardDefinition {
    const s = suitStyle(card.suit);
    return {
        id: `regicide-enemy-${card.id}`,
        name: `${type} of ${card.suit}`,
        widthMm: 63.5,
        heightMm: 88.9,
        borderRadiusMm: 7,
        palette: {
            id: `regicide_enemy_${card.id}`,
            name: card.id,
            background: s.ink,       // deep suit colour tile
            border: s.fill,
            primary: '#ffffff',      // crown drawn in white
            secondary: s.tint,
            accent: s.fill,
            charcoal: '#ffffff',
            text: s.tint,            // pale letter on the deep tile
            panelBg: s.ink,
            tertiary: s.glyph,
            success: '#57b894',
            danger: '#f2a0a0'
        },
        borderWidth: 0,
        header: {
            title: rankLabel(card.rank),
            background: 'none'
        },
        mainArt: {
            iconId: 'crown',
            frameStyle: 'none'
        }
    };
}
