/**
 * TrioAssets.ts
 * Soft pastel per-number palettes, a clean geometric "trio" glyph (three dots in
 * a triangle), and card-definition builders for the "Trio" number game.
 *
 * Each Trio card is a full-bleed mono tile carrying an oversized number, with the
 * trio glyph tucked into the corner as a lighter watermark — the same recipe as
 * CatInTheBox's `.cat-card`, driven entirely by the card-renderer.
 */

import { CardDefinition, Palette, IconObject } from '../../client/lib/card-renderer/types';

// ==========================================
// 1. Per-number mono card styling (soft rainbow, one hue per number 1-12)
// ==========================================
export interface TrioCardStyle {
    fill: string;       // whole-card mono colour
    ink: string;        // the (large) number, high-contrast against the fill
    watermark: string;  // the trio glyph tone — a lighter shade of the fill
}

export const TRIO_CARD_STYLE: Record<number, TrioCardStyle> = {
    1:  { fill: '#f2938c', ink: '#6e211b', watermark: '#f8c4bf' }, // coral
    2:  { fill: '#f2b184', ink: '#6e3a12', watermark: '#f9d8bf' }, // orange
    3:  { fill: '#f2cf6b', ink: '#6b520a', watermark: '#f9e6ab' }, // amber
    4:  { fill: '#cbdd7a', ink: '#4e5a17', watermark: '#e6efb9' }, // lime
    5:  { fill: '#8fce9b', ink: '#1f5a2c', watermark: '#c4e8cb' }, // green
    6:  { fill: '#79cbb8', ink: '#14544a', watermark: '#bce6dd' }, // teal
    7:  { fill: '#7ec4de', ink: '#10475b', watermark: '#bce0ee' }, // cyan (instant win)
    8:  { fill: '#8fb2e0', ink: '#1f3d67', watermark: '#c8def2' }, // sky
    9:  { fill: '#9aa2e0', ink: '#2b2f6b', watermark: '#cdd2f2' }, // indigo
    10: { fill: '#b79ae0', ink: '#402b6b', watermark: '#ddccf2' }, // violet
    11: { fill: '#d99ad9', ink: '#5f1f5f', watermark: '#eeccee' }, // orchid
    12: { fill: '#e895b6', ink: '#6e1f3e', watermark: '#f5c4d7' }  // rose
};

const NEUTRAL_STYLE: TrioCardStyle = { fill: '#b8c3d1', ink: '#2b3240', watermark: '#dbe1e9' };

export function getTrioCardStyle(number: number): TrioCardStyle {
    return TRIO_CARD_STYLE[number] || NEUTRAL_STYLE;
}

// Flat CSS colours (chips, badges, trio pills) matching the card fills above.
export function trioColorHex(number: number): string {
    return getTrioCardStyle(number).fill;
}
export function trioInkHex(number: number): string {
    return getTrioCardStyle(number).ink;
}

// ==========================================
// 2. Geometric "trio" iconography
// ==========================================
// The glyph is three dots arranged in a triangle — a clean, flat mark that reads
// as "a set of three". The watermark version fills the palette 'primary' tone so
// it re-themes per number; the back version uses fixed literal hex so every
// face-down card looks identical (hidden information must not leak by colour).
export const TRIO_ICONS: Record<string, IconObject> = {
    // Front watermark: three dots in the card's watermark tone.
    trio_dots: {
        id: 'trio_dots',
        name: 'Trio',
        layers: [
            { id: 'd_top', type: 'circle', x: 50, y: 30, scaleX: 0.52, scaleY: 0.52, fill: 'primary' },
            { id: 'd_bl', type: 'circle', x: 32, y: 64, scaleX: 0.52, scaleY: 0.52, fill: 'primary' },
            { id: 'd_br', type: 'circle', x: 68, y: 64, scaleX: 0.52, scaleY: 0.52, fill: 'primary' }
        ]
    },
    // Small solid single-tone trio mark for chips / legends (fills 'primary').
    trio_solid: {
        id: 'trio_solid',
        name: 'Trio Solid',
        layers: [
            { id: 'd_top', type: 'circle', x: 50, y: 28, scaleX: 0.5, scaleY: 0.5, fill: 'primary' },
            { id: 'd_bl', type: 'circle', x: 30, y: 66, scaleX: 0.5, scaleY: 0.5, fill: 'primary' },
            { id: 'd_br', type: 'circle', x: 70, y: 66, scaleX: 0.5, scaleY: 0.5, fill: 'primary' }
        ]
    },
    // Uniform card back: three light dots + a hairline ring, all literal hex so
    // the back is colour-identical for every hidden card.
    trio_back: {
        id: 'trio_back',
        name: 'Trio Back',
        layers: [
            { id: 'ring', type: 'circle', x: 50, y: 50, scaleX: 1.7, scaleY: 1.7, fill: 'none', stroke: '#5b6480', strokeWidth: 3 },
            { id: 'd_top', type: 'circle', x: 50, y: 32, scaleX: 0.46, scaleY: 0.46, fill: '#e8ecf5' },
            { id: 'd_bl', type: 'circle', x: 34, y: 63, scaleX: 0.46, scaleY: 0.46, fill: '#e8ecf5' },
            { id: 'd_br', type: 'circle', x: 66, y: 63, scaleX: 0.46, scaleY: 0.46, fill: '#e8ecf5' }
        ]
    }
};

export const TRIO_BACK_BG = '#3a4053';

// A palette whose keys map onto a mono card: background = fill, text = number
// ink, primary = watermark tone (the trio_dots glyph fills 'primary').
function trioCardPalette(number: number): Palette {
    const s = getTrioCardStyle(number);
    return {
        id: `trio_card_${number}`,
        name: `Trio ${number}`,
        background: s.fill,
        border: s.ink,       // native selection outline colour
        primary: s.watermark,
        secondary: s.watermark,
        accent: s.ink,
        charcoal: s.ink,
        text: s.ink,         // number colour
        panelBg: s.fill,
        tertiary: s.watermark,
        success: '#57b894',
        danger: '#e0554f'
    };
}

// Build the card-renderer definition for a Trio card (number + watermark trio).
// `withBack` adds the uniform flip back — used for the middle and reveal
// flip/peek animations. When rendering a genuinely hidden (face-down) card, pass
// a placeholder number: the front face is never visible while flipped, and the
// back is colour-identical, so nothing leaks.
export function getTrioCardDefinition(number: number, withBack = false): CardDefinition {
    const def: CardDefinition = {
        id: `trio-${number}`,
        name: 'Trio Card',
        widthMm: 63.5,
        heightMm: 88.9,
        borderRadiusMm: 6,
        palette: trioCardPalette(number),
        borderWidth: 0,
        header: {
            title: String(number),
            background: 'none'  // mono card: no separate header band
        },
        mainArt: {
            iconId: 'trio_dots',
            frameStyle: 'none'
        }
    };

    if (withBack) {
        def.backIconId = 'trio_back';
        def.backBgColor = TRIO_BACK_BG;
    }

    return def;
}
