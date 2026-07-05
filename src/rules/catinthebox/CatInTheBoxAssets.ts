/**
 * CatInTheBoxAssets.ts
 * Soft pastel palettes, a flat geometric cat glyph, and small card-definition
 * builders for the "Cat in the Box" trick-taking game.
 */

import { CardDefinition, Palette, IconObject } from '../../client/lib/card-renderer/types';
import { CatColor } from './CatInTheBoxGameState';

// ==========================================
// 1. Soft pastel palettes (one per declarable colour + a neutral "undeclared" card)
// ==========================================
export const CAT_PALETTES: Record<string, Palette> = {
    red: {
        id: 'cat_red',
        name: 'Soft Coral',
        background: '#ffffff',
        border: '#e88b86',
        primary: '#f08a86',   // soft coral band
        secondary: '#ffd9a0',
        accent: '#f08a86',
        charcoal: '#3a2320',
        text: '#7a2f2a',
        panelBg: '#fdecea',
        tertiary: '#ffc9c4',
        success: '#57b894',
        danger: '#e0554f'
    },
    blue: {
        id: 'cat_blue',
        name: 'Soft Sky',
        background: '#ffffff',
        border: '#8bb2e0',
        primary: '#83aee0',   // soft sky-blue band
        secondary: '#ffd9a0',
        accent: '#83aee0',
        charcoal: '#20293a',
        text: '#2b466e',
        panelBg: '#eaf1fb',
        tertiary: '#c4d9f4',
        success: '#57b894',
        danger: '#e0554f'
    },
    yellow: {
        id: 'cat_yellow',
        name: 'Soft Butter',
        background: '#ffffff',
        border: '#e8c766',
        primary: '#f2cf6b',   // warm butter band (dark text)
        secondary: '#ffe6a0',
        accent: '#f2cf6b',
        charcoal: '#3a3220',
        text: '#7a5f10',
        panelBg: '#fdf5e0',
        tertiary: '#ffe9b8',
        success: '#57b894',
        danger: '#e0554f'
    },
    green: {
        id: 'cat_green',
        name: 'Soft Sage',
        background: '#ffffff',
        border: '#7fc9a4',
        primary: '#76c4a0',   // soft sage band
        secondary: '#ffd9a0',
        accent: '#76c4a0',
        charcoal: '#203028',
        text: '#215941',
        panelBg: '#e8f6ef',
        tertiary: '#c1e8d5',
        success: '#57b894',
        danger: '#e0554f'
    },
    neutral: {
        id: 'cat_neutral',
        name: 'Undeclared',
        background: '#ffffff',
        border: '#c3cad4',
        primary: '#aab4c2',   // muted slate band for face-up but undeclared cards
        secondary: '#ffd9a0',
        accent: '#aab4c2',
        charcoal: '#2b3240',
        text: '#3a4453',
        panelBg: '#eef1f5',
        tertiary: '#d6dce4',
        success: '#57b894',
        danger: '#e0554f'
    }
};

// Flat CSS colours (for board cells, chips, backgrounds) matching the palettes above.
export const CAT_COLOR_HEX: Record<CatColor, string> = {
    red: '#f08a86',
    blue: '#83aee0',
    yellow: '#f2cf6b',
    green: '#76c4a0'
};

export const CAT_COLOR_TEXT: Record<CatColor, string> = {
    red: '#7a2f2a',
    blue: '#2b466e',
    yellow: '#7a5f10',
    green: '#215941'
};

export function getCatPalette(color: CatColor | 'neutral' | null | undefined): Palette {
    if (!color) return CAT_PALETTES.neutral;
    return CAT_PALETTES[color] || CAT_PALETTES.neutral;
}

// ==========================================
// 2. Flat geometric cat iconography
// ==========================================
// The cat glyph is drawn in the palette 'primary' colour with facial features
// knocked out in the card 'background' colour, so it re-themes for every colour.
export const CAT_ICONS: Record<string, IconObject> = {
    cat_face: {
        id: 'cat_face',
        name: 'Cat',
        layers: [
            // Ears (triangles poking above the head).
            { id: 'ear_l', type: 'triangle', x: 31, y: 29, scaleX: 0.34, scaleY: 0.44, fill: 'primary' },
            { id: 'ear_r', type: 'triangle', x: 69, y: 29, scaleX: 0.34, scaleY: 0.44, fill: 'primary' },
            // Head.
            { id: 'head', type: 'circle', x: 50, y: 57, scaleX: 1.44, scaleY: 1.32, fill: 'primary' },
            // Eyes.
            { id: 'eye_l', type: 'circle', x: 39, y: 54, scaleX: 0.13, scaleY: 0.17, fill: 'background' },
            { id: 'eye_r', type: 'circle', x: 61, y: 54, scaleX: 0.13, scaleY: 0.17, fill: 'background' },
            // Nose (little downward triangle).
            { id: 'nose', type: 'triangle', x: 50, y: 64, scaleX: 0.13, scaleY: 0.11, rotation: 180, fill: 'background' },
            // Whiskers.
            { id: 'wh_l', type: 'rectangle', x: 27, y: 66, scaleX: 0.24, scaleY: 0.025, fill: 'background' },
            { id: 'wh_r', type: 'rectangle', x: 73, y: 66, scaleX: 0.24, scaleY: 0.025, fill: 'background' }
        ]
    },
    // Solid single-colour cat (features same colour as body) — used as a small chip glyph.
    cat_solid: {
        id: 'cat_solid',
        name: 'Cat Solid',
        layers: [
            { id: 'ear_l', type: 'triangle', x: 31, y: 29, scaleX: 0.34, scaleY: 0.44, fill: 'primary' },
            { id: 'ear_r', type: 'triangle', x: 69, y: 29, scaleX: 0.34, scaleY: 0.44, fill: 'primary' },
            { id: 'head', type: 'circle', x: 50, y: 57, scaleX: 1.44, scaleY: 1.32, fill: 'primary' }
        ]
    },
    // Cat peeking out of a box — used for the logo / empty states.
    cat_box: {
        id: 'cat_box',
        name: 'Cat in the Box',
        layers: [
            // Box body.
            { id: 'box', type: 'rectangle', x: 50, y: 72, scaleX: 1.3, scaleY: 0.78, fill: 'primary' },
            // Box front flap (lighter).
            { id: 'flap_l', type: 'triangle', x: 30, y: 47, scaleX: 0.4, scaleY: 0.34, rotation: -20, fill: 'secondary' },
            { id: 'flap_r', type: 'triangle', x: 70, y: 47, scaleX: 0.4, scaleY: 0.34, rotation: 20, fill: 'secondary' },
            // Cat head peeking out.
            { id: 'ear_l', type: 'triangle', x: 40, y: 26, scaleX: 0.24, scaleY: 0.3, fill: 'charcoal' },
            { id: 'ear_r', type: 'triangle', x: 60, y: 26, scaleX: 0.24, scaleY: 0.3, fill: 'charcoal' },
            { id: 'head', type: 'circle', x: 50, y: 42, scaleX: 0.92, scaleY: 0.86, fill: 'charcoal' },
            { id: 'eye_l', type: 'circle', x: 43, y: 40, scaleX: 0.09, scaleY: 0.12, fill: 'background' },
            { id: 'eye_r', type: 'circle', x: 57, y: 40, scaleX: 0.09, scaleY: 0.12, fill: 'background' }
        ]
    }
};

// ==========================================
// 3. Mono card styling + card-renderer definition
// ==========================================
// Each cat card is a single flat colour carrying a big number, with the cat drawn
// as a large watermark silhouette (a lighter tone of the same hue) offset to the
// bottom-right. The card is produced entirely by the card-renderer: the number is
// the header title and the cat is the main-art icon; a scoped `.cat-card` wrapper
// (see catinthebox.scss) absolutely-positions both regions to overlap.
export interface CatCardStyle {
    fill: string;       // the whole-card mono colour (palette.background)
    ink: string;        // the (large) number, high-contrast against the fill
    watermark: string;  // the cat watermark tone — lighter than the fill, but clearly visible
}

export const CAT_CARD_STYLE: Record<CatColor | 'neutral', CatCardStyle> = {
    red:     { fill: '#ec9a95', ink: '#661d18', watermark: '#f8cecb' },
    blue:    { fill: '#8fb8df', ink: '#1f3d67', watermark: '#c8def2' },
    yellow:  { fill: '#eac85c', ink: '#66500a', watermark: '#f6e2a1' },
    green:   { fill: '#7cc8a2', ink: '#124b35', watermark: '#b4e0cb' },
    neutral: { fill: '#b8c3d1', ink: '#2b3240', watermark: '#dbe1e9' }
};

export function getCatCardStyle(color: CatColor | 'neutral'): CatCardStyle {
    return CAT_CARD_STYLE[color] || CAT_CARD_STYLE.neutral;
}

// A palette whose background carries the mono fill, `text` the number ink, and
// `primary` the cat watermark tone (cat_solid fills 'primary').
function catCardPalette(color: CatColor | 'neutral'): Palette {
    const s = getCatCardStyle(color);
    return {
        id: `cat_card_${color}`,
        name: `Cat ${color}`,
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

// Build the card-renderer definition for a cat card (number + watermark cat).
export function getCatCardDefinition(
    number: number,
    color: CatColor | 'neutral' = 'neutral'
): CardDefinition {
    return {
        id: `cat-${color}-${number}`,
        name: 'Cat Card',
        widthMm: 63.5,
        heightMm: 88.9,
        borderRadiusMm: 6,
        palette: catCardPalette(color),
        borderWidth: 0,
        header: {
            title: String(number),
            background: 'none'  // mono card: no separate header band
        },
        mainArt: {
            iconId: 'cat_solid',
            frameStyle: 'none'
        }
    };
}
