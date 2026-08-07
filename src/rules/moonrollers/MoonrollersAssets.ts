/**
 * MoonrollersAssets.ts
 * Flat, mid-century-modern iconography + palettes for Moonrollers.
 *
 * Design language: bold, high-contrast mid-century tones (teal, mustard, burnt
 * orange, avocado green, plum) on a clean white background. Every symbol is a
 * single-fill geometric glyph authored in the card-renderer 0–100 `IconObject`
 * DSL, so it recolours cleanly via `colorOverride` — white when knocked onto a
 * solid faction-coloured die tile, or the faction hue when shown on white. A few
 * display glyphs (prestige medal, hazard marker) are intentionally two-tone and
 * use literal hex.
 */

import { IconObject, Palette } from '../../client/lib/card-renderer/types';
import { DiceFaceset, DiceTheme } from '../../client/lib/dice-roller/types';
import { DieSymbol, ReqType, Faction } from './MoonrollersGameState';

// ==========================================
// 1. Mid-century palette
// ==========================================
export const INK = '#2b333c';
export const PAPER = '#ffffff';
export const CREAM = '#f6efe1';

// Bold face/faction hues. Deep enough for white glyphs, except mustard (uses ink).
export const SYMBOL_COLORS: Record<DieSymbol, string> = {
    DAMAGE: '#e0703a',   // burnt orange
    REACTOR: '#2b90b3',  // petrol teal
    THRUSTER: '#e0a51b', // mustard
    SHIELD: '#419a5e',   // avocado green
    WILD: '#8a5aa6',     // plum
    EXTRA: '#3d4b5c'     // slate
};

// Glyph colour to knock onto a solid die tile of that face (contrast-picked).
export const GLYPH_ON_DIE: Record<DieSymbol, string> = {
    DAMAGE: '#ffffff',
    REACTOR: '#ffffff',
    THRUSTER: '#2b333c', // ink on light mustard
    SHIELD: '#ffffff',
    WILD: '#ffffff',
    EXTRA: '#ffffff'
};

export const FACTION_COLORS: Record<Faction, string> = {
    DAMAGE: SYMBOL_COLORS.DAMAGE,
    REACTOR: SYMBOL_COLORS.REACTOR,
    THRUSTER: SYMBOL_COLORS.THRUSTER,
    SHIELD: SYMBOL_COLORS.SHIELD,
    WILD: SYMBOL_COLORS.WILD
};

function makePalette(id: string, primary: string): Palette {
    return {
        id: `moon_${id}`,
        name: id,
        background: PAPER,
        border: primary,
        primary,
        secondary: '#e0a51b',
        accent: primary,
        charcoal: INK,
        text: INK,
        panelBg: CREAM,
        tertiary: CREAM,
        success: '#419a5e',
        danger: '#d1495b'
    };
}

export const MOON_PALETTES: Record<string, Palette> = {
    damage: makePalette('damage', SYMBOL_COLORS.DAMAGE),
    reactor: makePalette('reactor', SYMBOL_COLORS.REACTOR),
    thruster: makePalette('thruster', SYMBOL_COLORS.THRUSTER),
    shield: makePalette('shield', SYMBOL_COLORS.SHIELD),
    wild: makePalette('wild', SYMBOL_COLORS.WILD),
    neutral: makePalette('neutral', INK),
    gold: makePalette('gold', '#e0a51b'),
    danger: makePalette('danger', '#d1495b')
};

export function getFactionPalette(faction: Faction): Palette {
    return MOON_PALETTES[faction.toLowerCase()] || MOON_PALETTES.neutral;
}

export const symbolIconId = (s: DieSymbol | ReqType): string => `sym_${s.toLowerCase()}`;

// ==========================================
// 2. Symbol glyphs (single-fill → recolour with colorOverride)
// ==========================================
const bez = (id: string, path: string, fill = 'primary'): IconObject['layers'][number] =>
    ({ id, type: 'bezier', x: 0, y: 0, scaleX: 1, scaleY: 1, fill, customPath: path });

export const MOONROLLERS_ICONS: Record<string, IconObject> = {
    // DAMAGE — a bold lightning bolt (impact / systems damage).
    sym_damage: {
        id: 'sym_damage', name: 'Damage',
        layers: [bez('bolt', 'M 60 8 L 28 52 L 46 52 L 38 92 L 74 44 L 54 44 Z')]
    },

    // REACTOR — the radioactive trefoil: three 60° blades around a central hub.
    sym_reactor: {
        id: 'sym_reactor', name: 'Reactor',
        layers: [
            bez('blade1', 'M 28.5 12.8 A 43 43 0 0 1 71.5 12.8 L 56.5 38.7 A 13 13 0 0 0 43.5 38.7 Z'),
            bez('blade2', 'M 93 50 A 43 43 0 0 1 71.5 87.2 L 56.5 61.3 A 13 13 0 0 0 63 50 Z'),
            bez('blade3', 'M 28.5 87.2 A 43 43 0 0 1 7 50 L 37 50 A 13 13 0 0 0 43.5 61.3 Z'),
            { id: 'hub', type: 'circle', x: 50, y: 50, scaleX: 0.36, scaleY: 0.36, fill: 'primary' }
        ]
    },

    // THRUSTER — two stacked upward chevrons (thrust).
    sym_thruster: {
        id: 'sym_thruster', name: 'Thruster',
        layers: [
            bez('chev_top', 'M 50 14 L 82 46 L 68 46 L 50 28 L 32 46 L 18 46 Z'),
            bez('chev_bot', 'M 50 46 L 82 78 L 68 78 L 50 60 L 32 78 L 18 78 Z')
        ]
    },

    // SHIELD — flat-topped crest with a curved base.
    sym_shield: {
        id: 'sym_shield', name: 'Shield',
        layers: [bez('crest', 'M 50 8 L 85 20 L 85 50 Q 85 82 50 94 Q 15 82 15 50 L 15 20 Z')]
    },

    // WILD — a four-point sparkle (matches "any / joker").
    sym_wild: {
        id: 'sym_wild', name: 'Wild',
        layers: [bez('spark', 'M 50 6 Q 55 45 94 50 Q 55 55 50 94 Q 45 55 6 50 Q 45 45 50 6 Z')]
    },

    // EXTRA DIE — a bold plus (adds a die to the pool).
    sym_extra: {
        id: 'sym_extra', name: 'Extra Die',
        layers: [
            { id: 'plus_v', type: 'rectangle', x: 50, y: 50, scaleX: 0.26, scaleY: 0.92, fill: 'primary' },
            { id: 'plus_h', type: 'rectangle', x: 50, y: 50, scaleX: 0.92, scaleY: 0.26, fill: 'primary' }
        ]
    },

    // ==========================================
    // 3. Two-tone display glyphs (literal hex)
    // ==========================================
    // PRESTIGE — a gold medal with a knocked-out white star.
    prestige: {
        id: 'prestige', name: 'Prestige',
        layers: [
            { id: 'disc', type: 'circle', x: 50, y: 50, scaleX: 1.9, scaleY: 1.9, fill: '#e0a51b' },
            { id: 'ring', type: 'circle', x: 50, y: 50, scaleX: 1.55, scaleY: 1.55, fill: 'none', stroke: '#ffffff', strokeWidth: 3 },
            bez('star', 'M 50 26 L 56 43 L 74 43 L 60 54 L 65 71 L 50 60 L 35 71 L 40 54 L 26 43 L 44 43 Z', '#ffffff')
        ]
    },

    // HAZARD — an ink warning triangle with a white exclamation.
    hazard: {
        id: 'hazard', name: 'Hazard',
        layers: [
            { id: 'tri', type: 'triangle', x: 50, y: 56, scaleX: 1.7, scaleY: 1.55, fill: '#3d4b5c' },
            { id: 'bar', type: 'rectangle', x: 50, y: 52, scaleX: 0.1, scaleY: 0.3, fill: '#ffffff' },
            { id: 'dot', type: 'circle', x: 50, y: 72, scaleX: 0.12, scaleY: 0.12, fill: '#ffffff' }
        ]
    },

    // HAZARD (soft) — a hairline triangle used as a small corner flag on cards.
    hazard_flag: {
        id: 'hazard_flag', name: 'Hazard Flag',
        layers: [
            { id: 'tri', type: 'triangle', x: 50, y: 56, scaleX: 1.7, scaleY: 1.55, fill: '#d1495b' },
            { id: 'bar', type: 'rectangle', x: 50, y: 52, scaleX: 0.11, scaleY: 0.3, fill: '#ffffff' },
            { id: 'dot', type: 'circle', x: 50, y: 72, scaleX: 0.13, scaleY: 0.13, fill: '#ffffff' }
        ]
    },

    // DOWN-ARROW — the "starting crew" marker.
    starter: {
        id: 'starter', name: 'Starting Crew',
        layers: [
            { id: 'stem', type: 'rectangle', x: 50, y: 42, scaleX: 0.24, scaleY: 0.5, fill: 'primary' },
            { id: 'head', type: 'triangle', x: 50, y: 72, scaleX: 0.7, scaleY: 0.5, rotation: 180, fill: 'primary' }
        ]
    }
};

// ==========================================
// 4. Dice faceset + theme for the dice-roller library
// ==========================================
const DIE_FACE_LIST: DieSymbol[] = ['DAMAGE', 'REACTOR', 'THRUSTER', 'SHIELD', 'WILD', 'EXTRA'];

export const MOON_DICE_FACES: DiceFaceset = DIE_FACE_LIST.reduce((m, s) => {
    m[s] = {
        id: s,
        icon: MOONROLLERS_ICONS[`sym_${s.toLowerCase()}`],
        color: SYMBOL_COLORS[s],
        glyphColor: GLYPH_ON_DIE[s]
    };
    return m;
}, {} as DiceFaceset);

export const MOON_DICE_THEME: DiceTheme = { style: 'flat', size: 46, glyphScale: 0.6 };
