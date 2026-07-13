/**
 * SkullAssets.ts
 * Clean, flat, geometric disc iconography for "Skull".
 *
 * Every disc is a self-contained round token drawn in a 0-100 viewBox: a solid
 * coloured circle (the disc body, palette key `primary`) with a glyph knocked out
 * of it in negative space. The three faces share one recipe so the game reads as
 * a single system:
 *   - flower : a six-petal rosette (safe)
 *   - skull  : a friendly geometric skull (deadly)
 *   - back   : a uniform ring emblem in the owner's accent colour (hidden content,
 *              public ownership) — colour-identical for flowers and skulls so a
 *              face-down disc never leaks what it is.
 *
 * Colours flow from the palette so the SAME icon can be tinted per disc kind (and,
 * for the back, per player accent). `primary` = disc body, `background` = the white
 * glyph, `accent` = the flower's warm centre.
 */

import { Palette, IconObject } from '../../client/lib/card-renderer/types';

// Flat CSS colours (used for pills, banners, legends, and the disc bodies).
export const FLOWER_BODY = '#ef88a6';   // soft rose
export const FLOWER_CENTER = '#ffd36b'; // warm gold
export const SKULL_BODY = '#6d76a0';    // soft slate-indigo
export const SKULL_INK = '#3a3f5c';
export const GLYPH_WHITE = '#fbfcff';
export const BACK_EMBLEM = 'rgba(255,255,255,0.55)';

// A full Palette (all keys required by the renderer) tuned for a single disc.
function discPalette(id: string, body: string, glyph: string, center: string): Palette {
    return {
        id,
        name: id,
        background: glyph,
        border: body,
        primary: body,
        secondary: body,
        accent: center,
        charcoal: SKULL_INK,
        text: glyph,
        panelBg: body,
        tertiary: center,
        success: '#57b894',
        danger: '#e0554f'
    };
}

export const FLOWER_PALETTE = discPalette('skull_flower', FLOWER_BODY, GLYPH_WHITE, FLOWER_CENTER);
export const SKULL_PALETTE = discPalette('skull_skull', SKULL_BODY, GLYPH_WHITE, GLYPH_WHITE);

// The face-down back takes the player's accent colour as the disc body.
export function backPalette(accent: string): Palette {
    return discPalette('skull_back', accent, GLYPH_WHITE, accent);
}

// Six petals evenly around a radius-24 ring (r ≈ 16 each) → a tight rosette.
const PETALS = [0, 60, 120, 180, 240, 300].map((deg, i) => {
    const rad = (deg * Math.PI) / 180;
    return {
        id: `petal_${i}`,
        type: 'circle' as const,
        x: 50 + 24 * Math.cos(rad),
        y: 50 + 24 * Math.sin(rad),
        scaleX: 0.66,
        scaleY: 0.66,
        fill: 'background'
    };
});

export const SKULL_ICONS: Record<string, IconObject> = {
    // ---- Flower: rosette of white petals + a warm gold centre ----------------
    disc_flower: {
        id: 'disc_flower',
        name: 'Flower',
        layers: [
            { id: 'body', type: 'circle', x: 50, y: 50, scaleX: 2, scaleY: 2, fill: 'primary' },
            ...PETALS,
            { id: 'core', type: 'circle', x: 50, y: 50, scaleX: 0.52, scaleY: 0.52, fill: 'accent' }
        ]
    },

    // ---- Skull: white cranium + jaw, negative-space eyes / nose / teeth -------
    disc_skull: {
        id: 'disc_skull',
        name: 'Skull',
        layers: [
            { id: 'body', type: 'circle', x: 50, y: 50, scaleX: 2, scaleY: 2, fill: 'primary' },
            // white silhouette
            { id: 'cranium', type: 'circle', x: 50, y: 43, scaleX: 1.42, scaleY: 1.42, fill: 'background' },
            { id: 'jaw', type: 'rectangle', x: 50, y: 63, scaleX: 0.62, scaleY: 0.52, fill: 'background' },
            { id: 'jaw_l', type: 'circle', x: 35, y: 66, scaleX: 0.46, scaleY: 0.46, fill: 'background' },
            { id: 'jaw_r', type: 'circle', x: 65, y: 66, scaleX: 0.46, scaleY: 0.46, fill: 'background' },
            // eyes (negative space back to the disc body)
            { id: 'eye_l', type: 'circle', x: 38, y: 42, scaleX: 0.62, scaleY: 0.66, fill: 'primary' },
            { id: 'eye_r', type: 'circle', x: 62, y: 42, scaleX: 0.62, scaleY: 0.66, fill: 'primary' },
            // nose (inverted triangle)
            { id: 'nose', type: 'triangle', x: 50, y: 55, scaleX: 0.34, scaleY: 0.34, rotation: 180, fill: 'primary' },
            // teeth gaps
            { id: 'tooth_gap_mid', type: 'rectangle', x: 50, y: 66, scaleX: 0.05, scaleY: 0.34, fill: 'primary' },
            { id: 'tooth_gap_l', type: 'rectangle', x: 43, y: 66, scaleX: 0.05, scaleY: 0.3, fill: 'primary' },
            { id: 'tooth_gap_r', type: 'rectangle', x: 57, y: 66, scaleX: 0.05, scaleY: 0.3, fill: 'primary' }
        ]
    },

    // ---- Uniform back: accent disc + concentric white ring emblem ------------
    disc_back: {
        id: 'disc_back',
        name: 'Disc Back',
        layers: [
            { id: 'body', type: 'circle', x: 50, y: 50, scaleX: 2, scaleY: 2, fill: 'primary' },
            { id: 'ring', type: 'circle', x: 50, y: 50, scaleX: 1.32, scaleY: 1.32, fill: 'none', stroke: 'background', strokeWidth: 5, opacity: 0.5 },
            { id: 'dot', type: 'circle', x: 50, y: 50, scaleX: 0.42, scaleY: 0.42, fill: 'background', opacity: 0.5 }
        ]
    },

    // Small solid mark for legends / the game-over badge (a flat skull).
    skull_mark: {
        id: 'skull_mark',
        name: 'Skull Mark',
        layers: [
            { id: 'cranium', type: 'circle', x: 50, y: 43, scaleX: 1.5, scaleY: 1.5, fill: 'primary' },
            { id: 'jaw', type: 'rectangle', x: 50, y: 64, scaleX: 0.66, scaleY: 0.56, fill: 'primary' },
            { id: 'jaw_l', type: 'circle', x: 34, y: 67, scaleX: 0.5, scaleY: 0.5, fill: 'primary' },
            { id: 'jaw_r', type: 'circle', x: 66, y: 67, scaleX: 0.5, scaleY: 0.5, fill: 'primary' },
            { id: 'eye_l', type: 'circle', x: 38, y: 42, scaleX: 0.66, scaleY: 0.7, fill: 'background' },
            { id: 'eye_r', type: 'circle', x: 62, y: 42, scaleX: 0.66, scaleY: 0.7, fill: 'background' },
            { id: 'nose', type: 'triangle', x: 50, y: 56, scaleX: 0.36, scaleY: 0.36, rotation: 180, fill: 'background' }
        ]
    }
};
