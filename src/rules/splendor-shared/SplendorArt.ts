/**
 * SplendorArt.ts
 * Shared iconography, soft pastel palettes, and deck-back card definitions for the
 * Splendor family of games (SplendorDuel + Splendor). Keeping the gem/coin/bonus
 * glyphs, the star / crown / scroll / castle glyphs, and the palettes in one place
 * means both games render the exact same jewels platform-wide (see DESIGN_GUIDE §10.9)
 * and there is a single source of truth to maintain.
 *
 * Game-specific art (SplendorDuel's ability + royal medallions, Splendor's noble
 * medallion) lives in each game's own `*Assets.ts`, which spreads these shared
 * icons and adds its extras.
 */

import { CardDefinition, Palette, IconObject } from '../../client/lib/card-renderer/types';

// ==========================================
// 1. Color Palettes (Soft Pastel Variations)
// ==========================================
export const SPLENDOR_PALETTES: Record<string, Palette> = {
    blue: {
        id: 'splendor_blue',
        name: 'Bold Sapphire',
        background: '#ffffff',
        border: '#2f8bb0',
        primary: '#3d9dc4', // Bold Sapphire header band
        secondary: '#ffd062', // Gold accents
        accent: '#3d9dc4',
        charcoal: '#1e2530',
        text: '#12333f',
        panelBg: '#e4f2f8',
        tertiary: '#ffabe1',
        success: '#2ec27e',
        danger: '#e01b24'
    },
    red: {
        id: 'splendor_red',
        name: 'Bold Ruby',
        background: '#ffffff',
        border: '#e0504f',
        primary: '#ef6a6a', // Bold coral Ruby header band
        secondary: '#ffd062',
        accent: '#ef6a6a',
        charcoal: '#1e2530',
        text: '#4a1414',
        panelBg: '#fdeaea',
        tertiary: '#ffabe1',
        success: '#2ec27e',
        danger: '#e01b24'
    },
    green: {
        id: 'splendor_green',
        name: 'Bold Emerald',
        background: '#ffffff',
        border: '#20a978',
        primary: '#34c491', // Bold Emerald header band
        secondary: '#ffd062',
        accent: '#34c491',
        charcoal: '#1e2530',
        text: '#0f3b2a',
        panelBg: '#e6f7f0',
        tertiary: '#ffabe1',
        success: '#2ec27e',
        danger: '#e01b24'
    },
    white: {
        id: 'splendor_white',
        name: 'Bold Diamond',
        background: '#ffffff',
        border: '#aeb6c2',
        primary: '#d5dae2', // Cool steel Diamond header band
        secondary: '#ffd062',
        accent: '#aeb6c2',
        charcoal: '#1e2530',
        text: '#2b3340',
        panelBg: '#f2f4f7',
        tertiary: '#ffabe1',
        success: '#2ec27e',
        danger: '#e01b24'
    },
    black: {
        id: 'splendor_black',
        name: 'Bold Onyx',
        background: '#ffffff',
        border: '#835ec4',
        primary: '#9d7bd4', // Bold amethyst Onyx header band
        secondary: '#ffd062',
        accent: '#9d7bd4',
        charcoal: '#1e2530',
        text: '#2c1a45',
        panelBg: '#f0eafa',
        tertiary: '#ffabe1',
        success: '#2ec27e',
        danger: '#e01b24'
    },
    pearl: {
        id: 'splendor_pearl',
        name: 'Bold Pearl',
        background: '#ffffff',
        border: '#f0934f',
        primary: '#ffab6e', // Bold peach Pearl header band
        secondary: '#ffd062',
        accent: '#ffab6e',
        charcoal: '#1e2530',
        text: '#5a3010',
        panelBg: '#fff1e6',
        tertiary: '#ffabe1',
        success: '#2ec27e',
        danger: '#e01b24'
    },
    wild: {
        id: 'splendor_wild',
        name: 'Bold Joker',
        background: '#ffffff',
        border: '#c05fc0',
        primary: '#d878c8', // Bold magenta Joker header band
        secondary: '#ffd062',
        accent: '#d878c8',
        charcoal: '#1e2530',
        text: '#4a1245',
        panelBg: '#faeaf6',
        tertiary: '#ffabe1',
        success: '#2ec27e',
        danger: '#e01b24'
    },
    gold: {
        id: 'splendor_gold',
        name: 'Bold Gold',
        background: '#ffffff',
        border: '#d3a92f',
        primary: '#e3b52e',
        secondary: '#d9a520',
        accent: '#d9a520',
        charcoal: '#4a3608',
        text: '#3f2f06',
        panelBg: '#faf1d6',
        tertiary: '#ffd3b6',
        success: '#2ec27e',
        danger: '#e01b24'
    },
    gray: {
        id: 'splendor_gray',
        name: 'Bold Grey',
        background: '#ffffff',
        border: '#7f8c99',
        primary: '#9aa7b4', // Bold slate Grey header band
        secondary: '#ffd062',
        accent: '#9aa7b4',
        charcoal: '#1e2530',
        text: '#2b3440',
        panelBg: '#eef1f4',
        tertiary: '#f1f5f9',
        success: '#2ec27e',
        danger: '#e01b24'
    }
};

// Resolve a soft palette from a colour key; falls back to neutral grey.
export function getSplendorPalette(color: string | null | undefined): Palette {
    if (!color) return SPLENDOR_PALETTES.gray;
    return SPLENDOR_PALETTES[color] || SPLENDOR_PALETTES.gray;
}

// ==========================================
// 2. Custom Flat Vector Geometric Iconography (shared)
// ==========================================
// Literal hex fills keep the brand gem colours stable across every card palette;
// palette keys ('primary', 'border', …) follow the host card's palette.
export const SPLENDOR_SHARED_ICONS: Record<string, IconObject> = {
    // --- NATIVE GEM ICONS (Full Color) ---
    gem_blue: {
        id: 'gem_blue',
        name: 'Sapphire',
        layers: [
            { id: 'c1', type: 'circle', x: 50, y: 35, scaleX: 0.45, scaleY: 0.45, fill: '#258fb4' },
            { id: 'c2', type: 'circle', x: 35, y: 62, scaleX: 0.45, scaleY: 0.45, fill: '#258fb4' },
            { id: 'c3', type: 'circle', x: 65, y: 62, scaleX: 0.45, scaleY: 0.45, fill: '#258fb4' },
            { id: 'c_mid', type: 'circle', x: 50, y: 51, scaleX: 0.2, scaleY: 0.2, fill: '#ffd175' }
        ]
    },
    gem_white: {
        id: 'gem_white',
        name: 'Diamond',
        layers: [
            { id: 's1', type: 'rectangle', x: 50, y: 50, scaleX: 0.5, scaleY: 0.5, rotation: 0, fill: '#a0a1a5' },
            { id: 's2', type: 'rectangle', x: 50, y: 50, scaleX: 0.5, scaleY: 0.5, rotation: 45, fill: '#a0a1a5' },
            { id: 'mid', type: 'circle', x: 50, y: 50, scaleX: 0.3, scaleY: 0.3, fill: '#ffffff' },
            { id: 'mid2', type: 'circle', x: 50, y: 50, scaleX: 0.15, scaleY: 0.15, fill: '#a0a1a5' }
        ]
    },
    gem_green: {
        id: 'gem_green',
        name: 'Emerald',
        layers: [
            { id: 'c1', type: 'circle', x: 50, y: 32, scaleX: 0.4, scaleY: 0.4, fill: '#2ec27e' },
            { id: 'c2', type: 'circle', x: 50, y: 68, scaleX: 0.4, scaleY: 0.4, fill: '#2ec27e' },
            { id: 'c3', type: 'circle', x: 32, y: 50, scaleX: 0.4, scaleY: 0.4, fill: '#2ec27e' },
            { id: 'c4', type: 'circle', x: 68, y: 50, scaleX: 0.4, scaleY: 0.4, fill: '#2ec27e' },
            { id: 'mid', type: 'circle', x: 50, y: 50, scaleX: 0.35, scaleY: 0.35, fill: '#ffd175' },
            { id: 'mid2', type: 'circle', x: 50, y: 50, scaleX: 0.18, scaleY: 0.18, fill: '#2ec27e' }
        ]
    },
    gem_red: {
        id: 'gem_red',
        name: 'Ruby',
        layers: [
            { id: 'r1', type: 'rectangle', x: 50, y: 36, scaleX: 0.25, scaleY: 0.4, rotation: 45, fill: '#e01b24' },
            { id: 'r2', type: 'rectangle', x: 50, y: 64, scaleX: 0.25, scaleY: 0.4, rotation: 45, fill: '#e01b24' },
            { id: 'r3', type: 'rectangle', x: 36, y: 50, scaleX: 0.4, scaleY: 0.25, rotation: 45, fill: '#e01b24' },
            { id: 'r4', type: 'rectangle', x: 64, y: 50, scaleX: 0.4, scaleY: 0.25, rotation: 45, fill: '#e01b24' },
            { id: 'mid', type: 'circle', x: 50, y: 50, scaleX: 0.2, scaleY: 0.2, fill: '#ffd175' }
        ]
    },
    gem_black: {
        id: 'gem_black',
        name: 'Onyx',
        layers: [
            { id: 'd1', type: 'rectangle', x: 50, y: 50, scaleX: 0.6, scaleY: 0.8, rotation: 45, fill: '#241f31' },
            { id: 'd2', type: 'rectangle', x: 50, y: 50, scaleX: 0.4, scaleY: 0.6, rotation: 45, fill: '#ffffff' },
            { id: 'd3', type: 'rectangle', x: 50, y: 50, scaleX: 0.2, scaleY: 0.3, rotation: 45, fill: '#241f31' }
        ]
    },
    gem_pearl: {
        id: 'gem_pearl',
        name: 'Pearl',
        layers: [
            { id: 'p_base', type: 'circle', x: 50, y: 50, scaleX: 0.75, scaleY: 0.75, fill: '#e5b46e' },
            { id: 'p_inner1', type: 'circle', x: 50, y: 50, scaleX: 0.62, scaleY: 0.62, fill: '#ffffff' },
            { id: 'p_inner2', type: 'circle', x: 50, y: 40, scaleX: 0.4, scaleY: 0.2, fill: '#ffd175' },
            { id: 'p_inner3', type: 'circle', x: 50, y: 60, scaleX: 0.4, scaleY: 0.2, fill: '#ffd175' },
            { id: 'p_inner4', type: 'circle', x: 50, y: 50, scaleX: 0.32, scaleY: 0.32, fill: '#e5b46e' }
        ]
    },
    gem_gold: {
        id: 'gem_gold',
        name: 'Gold',
        layers: [
            { id: 'g_base', type: 'circle', x: 50, y: 50, scaleX: 0.78, scaleY: 0.78, fill: '#f6d32d' },
            { id: 'g_ring', type: 'circle', x: 50, y: 50, scaleX: 0.6, scaleY: 0.6, fill: '#ffffff' },
            { id: 'g_inner', type: 'rectangle', x: 50, y: 50, scaleX: 0.28, scaleY: 0.28, rotation: 45, fill: '#f6d32d' }
        ]
    },
    gem_wild: {
        id: 'gem_wild',
        name: 'Joker',
        layers: [
            { id: 'w1', type: 'circle', x: 50, y: 50, scaleX: 0.8, scaleY: 0.8, fill: '#fca1a1' },
            { id: 'w2', type: 'circle', x: 50, y: 50, scaleX: 0.6, scaleY: 0.6, fill: '#a1e3cd' },
            { id: 'w3', type: 'circle', x: 50, y: 50, scaleX: 0.4, scaleY: 0.4, fill: '#fcf8cf' },
            { id: 'w4', type: 'circle', x: 50, y: 50, scaleX: 0.2, scaleY: 0.2, fill: '#c5b3e6' }
        ]
    },

    // --- FAINT ART SILHOUETTE ICONS (Faint Colored Circle + Solid White Silhouette) ---
    gem_blue_silhouette: {
        id: 'gem_blue_silhouette',
        name: 'Sapphire Silhouette',
        layers: [
            { id: 'bg', type: 'circle', x: 50, y: 50, scaleX: 1.6, scaleY: 1.6, fill: 'primary', opacity: 0.22 },
            { id: 'c1', type: 'circle', x: 50, y: 35, scaleX: 0.45, scaleY: 0.45, fill: '#ffffff' },
            { id: 'c2', type: 'circle', x: 35, y: 62, scaleX: 0.45, scaleY: 0.45, fill: '#ffffff' },
            { id: 'c3', type: 'circle', x: 65, y: 62, scaleX: 0.45, scaleY: 0.45, fill: '#ffffff' }
        ]
    },
    gem_white_silhouette: {
        id: 'gem_white_silhouette',
        name: 'Diamond Silhouette',
        layers: [
            { id: 'bg', type: 'circle', x: 50, y: 50, scaleX: 1.6, scaleY: 1.6, fill: 'primary', opacity: 0.22 },
            { id: 's1', type: 'rectangle', x: 50, y: 50, scaleX: 0.5, scaleY: 0.5, rotation: 0, fill: '#ffffff' },
            { id: 's2', type: 'rectangle', x: 50, y: 50, scaleX: 0.5, scaleY: 0.5, rotation: 45, fill: '#ffffff' }
        ]
    },
    gem_green_silhouette: {
        id: 'gem_green_silhouette',
        name: 'Emerald Silhouette',
        layers: [
            { id: 'bg', type: 'circle', x: 50, y: 50, scaleX: 1.6, scaleY: 1.6, fill: 'primary', opacity: 0.22 },
            { id: 'c1', type: 'circle', x: 50, y: 32, scaleX: 0.4, scaleY: 0.4, fill: '#ffffff' },
            { id: 'c2', type: 'circle', x: 50, y: 68, scaleX: 0.4, scaleY: 0.4, fill: '#ffffff' },
            { id: 'c3', type: 'circle', x: 32, y: 50, scaleX: 0.4, scaleY: 0.4, fill: '#ffffff' },
            { id: 'c4', type: 'circle', x: 68, y: 50, scaleX: 0.4, scaleY: 0.4, fill: '#ffffff' }
        ]
    },
    gem_red_silhouette: {
        id: 'gem_red_silhouette',
        name: 'Ruby Silhouette',
        layers: [
            { id: 'bg', type: 'circle', x: 50, y: 50, scaleX: 1.6, scaleY: 1.6, fill: 'primary', opacity: 0.22 },
            { id: 'r1', type: 'rectangle', x: 50, y: 36, scaleX: 0.25, scaleY: 0.4, rotation: 45, fill: '#ffffff' },
            { id: 'r2', type: 'rectangle', x: 50, y: 64, scaleX: 0.25, scaleY: 0.4, rotation: 45, fill: '#ffffff' },
            { id: 'r3', type: 'rectangle', x: 36, y: 50, scaleX: 0.4, scaleY: 0.25, rotation: 45, fill: '#ffffff' },
            { id: 'r4', type: 'rectangle', x: 64, y: 50, scaleX: 0.4, scaleY: 0.25, rotation: 45, fill: '#ffffff' }
        ]
    },
    gem_black_silhouette: {
        id: 'gem_black_silhouette',
        name: 'Onyx Silhouette',
        layers: [
            { id: 'bg', type: 'circle', x: 50, y: 50, scaleX: 1.6, scaleY: 1.6, fill: 'primary', opacity: 0.22 },
            { id: 'd1', type: 'rectangle', x: 50, y: 50, scaleX: 0.6, scaleY: 0.8, rotation: 45, fill: '#ffffff' }
        ]
    },
    gem_pearl_silhouette: {
        id: 'gem_pearl_silhouette',
        name: 'Pearl Silhouette',
        layers: [
            { id: 'bg', type: 'circle', x: 50, y: 50, scaleX: 1.6, scaleY: 1.6, fill: 'primary', opacity: 0.22 },
            { id: 'p_base', type: 'circle', x: 50, y: 50, scaleX: 0.75, scaleY: 0.75, fill: '#ffffff' }
        ]
    },
    gem_wild_silhouette: {
        id: 'gem_wild_silhouette',
        name: 'Joker Silhouette',
        layers: [
            // Watermark: faint circle + a white jester-hat silhouette
            { id: 'bg', type: 'circle', x: 50, y: 50, scaleX: 1.6, scaleY: 1.6, fill: 'primary', opacity: 0.22 },
            { id: 'pt_l', type: 'triangle', x: 30, y: 49, scaleX: 0.22, scaleY: 0.56, rotation: -26, fill: '#ffffff' },
            { id: 'pt_r', type: 'triangle', x: 70, y: 49, scaleX: 0.22, scaleY: 0.56, rotation: 26, fill: '#ffffff' },
            { id: 'pt_c', type: 'triangle', x: 50, y: 47, scaleX: 0.26, scaleY: 0.62, rotation: 0, fill: '#ffffff' },
            { id: 'band', type: 'rectangle', x: 50, y: 66, scaleX: 0.66, scaleY: 0.14, fill: '#ffffff' },
            { id: 'bell_c', type: 'circle', x: 50, y: 27, scaleX: 0.1, scaleY: 0.1, fill: '#ffffff' },
            { id: 'bell_l', type: 'circle', x: 23, y: 33, scaleX: 0.09, scaleY: 0.09, fill: '#ffffff' },
            { id: 'bell_r', type: 'circle', x: 77, y: 33, scaleX: 0.09, scaleY: 0.09, fill: '#ffffff' }
        ]
    },
    star_silhouette: {
        id: 'star_silhouette',
        name: 'Star Silhouette',
        layers: [
            { id: 'bg', type: 'circle', x: 50, y: 50, scaleX: 1.6, scaleY: 1.6, fill: 'primary', opacity: 0.22 },
            { id: 'st1', type: 'triangle', x: 50, y: 43, scaleX: 0.5, scaleY: 0.5, rotation: 0, fill: '#ffffff' },
            { id: 'st2', type: 'triangle', x: 50, y: 57, scaleX: 0.5, scaleY: 0.5, rotation: 180, fill: '#ffffff' }
        ]
    },

    // --- COIN COST ICONS (Solid token-colored disc, gem glyph knocked out as white negative space) ---
    gem_blue_coin: {
        id: 'gem_blue_coin', name: 'Sapphire Coin',
        layers: [
            { id: 'disc', type: 'circle', x: 50, y: 50, scaleX: 1.9, scaleY: 1.9, fill: '#2f93c2' },
            { id: 's1', type: 'circle', x: 50, y: 36, scaleX: 0.42, scaleY: 0.42, fill: '#ffffff' },
            { id: 's2', type: 'circle', x: 36, y: 62, scaleX: 0.42, scaleY: 0.42, fill: '#ffffff' },
            { id: 's3', type: 'circle', x: 64, y: 62, scaleX: 0.42, scaleY: 0.42, fill: '#ffffff' }
        ]
    },
    gem_white_coin: {
        id: 'gem_white_coin', name: 'Diamond Coin',
        layers: [
            { id: 'disc', type: 'circle', x: 50, y: 50, scaleX: 1.9, scaleY: 1.9, fill: '#9ca3ad' },
            { id: 's1', type: 'rectangle', x: 50, y: 50, scaleX: 0.46, scaleY: 0.46, rotation: 0, fill: '#ffffff' },
            { id: 's2', type: 'rectangle', x: 50, y: 50, scaleX: 0.46, scaleY: 0.46, rotation: 45, fill: '#ffffff' }
        ]
    },
    gem_green_coin: {
        id: 'gem_green_coin', name: 'Emerald Coin',
        layers: [
            { id: 'disc', type: 'circle', x: 50, y: 50, scaleX: 1.9, scaleY: 1.9, fill: '#2eb87a' },
            { id: 's1', type: 'circle', x: 50, y: 33, scaleX: 0.37, scaleY: 0.37, fill: '#ffffff' },
            { id: 's2', type: 'circle', x: 50, y: 67, scaleX: 0.37, scaleY: 0.37, fill: '#ffffff' },
            { id: 's3', type: 'circle', x: 33, y: 50, scaleX: 0.37, scaleY: 0.37, fill: '#ffffff' },
            { id: 's4', type: 'circle', x: 67, y: 50, scaleX: 0.37, scaleY: 0.37, fill: '#ffffff' }
        ]
    },
    gem_red_coin: {
        id: 'gem_red_coin', name: 'Ruby Coin',
        layers: [
            { id: 'disc', type: 'circle', x: 50, y: 50, scaleX: 1.9, scaleY: 1.9, fill: '#e0433f' },
            { id: 'r1', type: 'rectangle', x: 50, y: 37, scaleX: 0.22, scaleY: 0.36, rotation: 45, fill: '#ffffff' },
            { id: 'r2', type: 'rectangle', x: 50, y: 63, scaleX: 0.22, scaleY: 0.36, rotation: 45, fill: '#ffffff' },
            { id: 'r3', type: 'rectangle', x: 37, y: 50, scaleX: 0.36, scaleY: 0.22, rotation: 45, fill: '#ffffff' },
            { id: 'r4', type: 'rectangle', x: 63, y: 50, scaleX: 0.36, scaleY: 0.22, rotation: 45, fill: '#ffffff' }
        ]
    },
    gem_black_coin: {
        id: 'gem_black_coin', name: 'Onyx Coin',
        layers: [
            { id: 'disc', type: 'circle', x: 50, y: 50, scaleX: 1.9, scaleY: 1.9, fill: '#7a5fb0' },
            { id: 'd1', type: 'rectangle', x: 50, y: 50, scaleX: 0.5, scaleY: 0.72, rotation: 45, fill: '#ffffff' }
        ]
    },
    gem_pearl_coin: {
        id: 'gem_pearl_coin', name: 'Pearl Coin',
        layers: [
            { id: 'disc', type: 'circle', x: 50, y: 50, scaleX: 1.9, scaleY: 1.9, fill: '#d8a35e' },
            { id: 'p1', type: 'circle', x: 50, y: 50, scaleX: 0.52, scaleY: 0.52, fill: '#ffffff' }
        ]
    },
    gem_gold_coin: {
        id: 'gem_gold_coin', name: 'Gold Coin',
        layers: [
            { id: 'disc', type: 'circle', x: 50, y: 50, scaleX: 1.9, scaleY: 1.9, fill: '#f2c419' },
            { id: 'ring', type: 'circle', x: 50, y: 50, scaleX: 1.1, scaleY: 1.1, fill: 'none', stroke: '#ffffff', strokeWidth: 5 },
            { id: 's1', type: 'rectangle', x: 50, y: 50, scaleX: 0.4, scaleY: 0.4, rotation: 45, fill: '#ffffff' }
        ]
    },

    // --- HEADER BONUS ICONS (White disc, gem glyph knocked out as accent-colored negative space) ---
    gem_blue_bonus: {
        id: 'gem_blue_bonus', name: 'Sapphire Bonus',
        layers: [
            { id: 'disc', type: 'circle', x: 50, y: 50, scaleX: 1.9, scaleY: 1.9, fill: '#ffffff' },
            { id: 's1', type: 'circle', x: 50, y: 36, scaleX: 0.42, scaleY: 0.42, fill: 'primary' },
            { id: 's2', type: 'circle', x: 36, y: 62, scaleX: 0.42, scaleY: 0.42, fill: 'primary' },
            { id: 's3', type: 'circle', x: 64, y: 62, scaleX: 0.42, scaleY: 0.42, fill: 'primary' }
        ]
    },
    gem_white_bonus: {
        id: 'gem_white_bonus', name: 'Diamond Bonus',
        layers: [
            { id: 'disc', type: 'circle', x: 50, y: 50, scaleX: 1.9, scaleY: 1.9, fill: '#ffffff' },
            { id: 'ring', type: 'circle', x: 50, y: 50, scaleX: 1.9, scaleY: 1.9, fill: 'none', stroke: 'border', strokeWidth: 2 },
            { id: 's1', type: 'rectangle', x: 50, y: 50, scaleX: 0.46, scaleY: 0.46, rotation: 0, fill: 'primary' },
            { id: 's2', type: 'rectangle', x: 50, y: 50, scaleX: 0.46, scaleY: 0.46, rotation: 45, fill: 'primary' }
        ]
    },
    gem_green_bonus: {
        id: 'gem_green_bonus', name: 'Emerald Bonus',
        layers: [
            { id: 'disc', type: 'circle', x: 50, y: 50, scaleX: 1.9, scaleY: 1.9, fill: '#ffffff' },
            { id: 's1', type: 'circle', x: 50, y: 33, scaleX: 0.37, scaleY: 0.37, fill: 'primary' },
            { id: 's2', type: 'circle', x: 50, y: 67, scaleX: 0.37, scaleY: 0.37, fill: 'primary' },
            { id: 's3', type: 'circle', x: 33, y: 50, scaleX: 0.37, scaleY: 0.37, fill: 'primary' },
            { id: 's4', type: 'circle', x: 67, y: 50, scaleX: 0.37, scaleY: 0.37, fill: 'primary' }
        ]
    },
    gem_red_bonus: {
        id: 'gem_red_bonus', name: 'Ruby Bonus',
        layers: [
            { id: 'disc', type: 'circle', x: 50, y: 50, scaleX: 1.9, scaleY: 1.9, fill: '#ffffff' },
            { id: 'r1', type: 'rectangle', x: 50, y: 37, scaleX: 0.22, scaleY: 0.36, rotation: 45, fill: 'primary' },
            { id: 'r2', type: 'rectangle', x: 50, y: 63, scaleX: 0.22, scaleY: 0.36, rotation: 45, fill: 'primary' },
            { id: 'r3', type: 'rectangle', x: 37, y: 50, scaleX: 0.36, scaleY: 0.22, rotation: 45, fill: 'primary' },
            { id: 'r4', type: 'rectangle', x: 63, y: 50, scaleX: 0.36, scaleY: 0.22, rotation: 45, fill: 'primary' }
        ]
    },
    gem_black_bonus: {
        id: 'gem_black_bonus', name: 'Onyx Bonus',
        layers: [
            { id: 'disc', type: 'circle', x: 50, y: 50, scaleX: 1.9, scaleY: 1.9, fill: '#ffffff' },
            { id: 'd1', type: 'rectangle', x: 50, y: 50, scaleX: 0.5, scaleY: 0.72, rotation: 45, fill: 'primary' }
        ]
    },
    gem_pearl_bonus: {
        id: 'gem_pearl_bonus', name: 'Pearl Bonus',
        layers: [
            { id: 'disc', type: 'circle', x: 50, y: 50, scaleX: 1.9, scaleY: 1.9, fill: '#ffffff' },
            { id: 'p1', type: 'circle', x: 50, y: 50, scaleX: 0.52, scaleY: 0.52, fill: 'primary' }
        ]
    },
    gem_wild_bonus: {
        id: 'gem_wild_bonus', name: 'Joker Bonus',
        layers: [
            // White coin + a multi-colour jester hat (three belled points) = "wild / joker"
            { id: 'disc', type: 'circle', x: 50, y: 50, scaleX: 1.9, scaleY: 1.9, fill: '#ffffff' },
            { id: 'pt_l', type: 'triangle', x: 30, y: 49, scaleX: 0.22, scaleY: 0.56, rotation: -26, fill: '#e0433f' },
            { id: 'pt_r', type: 'triangle', x: 70, y: 49, scaleX: 0.22, scaleY: 0.56, rotation: 26, fill: '#3d9dc4' },
            { id: 'pt_c', type: 'triangle', x: 50, y: 47, scaleX: 0.26, scaleY: 0.62, rotation: 0, fill: '#2eb87a' },
            { id: 'band', type: 'rectangle', x: 50, y: 66, scaleX: 0.66, scaleY: 0.14, fill: '#3a2b4d' },
            { id: 'bell_c', type: 'circle', x: 50, y: 27, scaleX: 0.1, scaleY: 0.1, fill: '#f6c026' },
            { id: 'bell_l', type: 'circle', x: 23, y: 33, scaleX: 0.09, scaleY: 0.09, fill: '#f6c026' },
            { id: 'bell_r', type: 'circle', x: 77, y: 33, scaleX: 0.09, scaleY: 0.09, fill: '#f6c026' }
        ]
    },

    // --- OTHERS ---
    // Flat, modern crown: one solid silhouette — three sharp points with deep V-notches
    // over a straight base — in a two-tone amber (light left face, darker right flank),
    // matching the reference. No jewels/band; reads cleanly at glyph sizes.
    crown: {
        id: 'crown',
        name: 'Crown',
        layers: [
            { id: 'cr_light', type: 'bezier', x: 0, y: 0, scaleX: 1, scaleY: 1, fill: '#ff9d21', customPath: 'M 12 84 L 88 84 L 88 20 L 66 52 L 50 30 L 34 52 L 12 20 Z' },
            { id: 'cr_shade', type: 'bezier', x: 0, y: 0, scaleX: 1, scaleY: 1, fill: '#f07d00', customPath: 'M 50 30 L 66 52 L 88 20 L 88 84 L 50 84 Z' }
        ]
    },

    // Solid flat badge glyphs (prestige / privilege), matching the crown icon style.
    star: {
        id: 'star',
        name: 'Star',
        layers: [
            { id: 'star_shape', type: 'bezier', x: 0, y: 0, scaleX: 1, scaleY: 1, fill: '#ffce4d', customPath: 'M 50 8 L 63 37 L 94 37 L 69 57 L 79 88 L 50 68 L 21 88 L 31 57 L 6 37 L 37 37 Z' }
        ]
    },
    scroll: {
        id: 'scroll',
        name: 'Scroll',
        layers: [
            { id: 'sc_body', type: 'rectangle', x: 50, y: 50, scaleX: 0.5, scaleY: 0.64, fill: '#f4e4c1' },
            { id: 'sc_top', type: 'rectangle', x: 50, y: 20, scaleX: 0.6, scaleY: 0.12, fill: '#c79a3f' },
            { id: 'sc_bottom', type: 'rectangle', x: 50, y: 80, scaleX: 0.6, scaleY: 0.12, fill: '#c79a3f' },
            { id: 'sc_ribbon', type: 'rectangle', x: 50, y: 50, scaleX: 0.54, scaleY: 0.1, fill: '#d64545' }
        ]
    },
    lock: {
        id: 'lock',
        name: 'Lock',
        layers: [
            { id: 'lk_body', type: 'rectangle', x: 50, y: 62, scaleX: 0.5, scaleY: 0.34, fill: '#8a6bd0' },
            { id: 'lk_shackle', type: 'arch', x: 50, y: 42, scaleX: 0.3, scaleY: 0.34, fill: 'none', stroke: '#8a6bd0', strokeWidth: 7 },
            { id: 'lk_hole', type: 'circle', x: 50, y: 60, scaleX: 0.12, scaleY: 0.12, fill: '#ffffff' }
        ]
    },

    // Tier castles: the number of towers encodes the pyramid level (1 / 2 / 3).
    // Towers overlap the wall body (no floating gaps); one flat white silhouette.
    castle_1: {
        id: 'castle_1',
        name: 'Castle I',
        layers: [
            { id: 'cas_base', type: 'rectangle', x: 50, y: 60, scaleX: 0.66, scaleY: 0.42, fill: '#ffffff' },
            { id: 'cas_t1', type: 'rectangle', x: 50, y: 42, scaleX: 0.18, scaleY: 0.5, fill: '#ffffff' }
        ]
    },
    castle_2: {
        id: 'castle_2',
        name: 'Castle II',
        layers: [
            { id: 'cas_base', type: 'rectangle', x: 50, y: 60, scaleX: 0.66, scaleY: 0.42, fill: '#ffffff' },
            { id: 'cas_t1', type: 'rectangle', x: 41, y: 42, scaleX: 0.15, scaleY: 0.48, fill: '#ffffff' },
            { id: 'cas_t2', type: 'rectangle', x: 59, y: 42, scaleX: 0.15, scaleY: 0.48, fill: '#ffffff' }
        ]
    },
    castle_3: {
        id: 'castle_3',
        name: 'Castle III',
        layers: [
            { id: 'cas_base', type: 'rectangle', x: 50, y: 60, scaleX: 0.66, scaleY: 0.42, fill: '#ffffff' },
            { id: 'cas_t1', type: 'rectangle', x: 38, y: 42, scaleX: 0.14, scaleY: 0.46, fill: '#ffffff' },
            { id: 'cas_t2', type: 'rectangle', x: 50, y: 42, scaleX: 0.14, scaleY: 0.46, fill: '#ffffff' },
            { id: 'cas_t3', type: 'rectangle', x: 62, y: 42, scaleX: 0.14, scaleY: 0.46, fill: '#ffffff' }
        ]
    }
};

// ==========================================
// 3. Shared deck-back card definition (single amethyst-slate back for every tier;
// the tier is read from the tower count on the castle glyph).
// ==========================================
export const DECK_BACK_PALETTE: Palette = {
    id: 'splendor_deck',
    name: 'Deck Back',
    background: '#ffffff',
    border: '#2a2340',
    primary: '#4a4363', // deep amethyst-slate, uniform across all tiers
    secondary: '#ffd062',
    accent: '#4a4363',
    charcoal: '#1e2530',
    text: '#ffffff',
    panelBg: '#ffffff',
    tertiary: '#ffabe1',
    success: '#2ec27e',
    danger: '#e01b24'
};

export function getDeckBackDefinition(level: number): CardDefinition {
    const castleId = level <= 1 ? 'castle_1' : level === 2 ? 'castle_2' : 'castle_3';

    return {
        id: `deck-back-L${level}`,
        name: `Deck Level ${level}`,
        widthMm: 63.5,
        heightMm: 88.9,
        borderRadiusMm: 4,
        palette: DECK_BACK_PALETTE,
        backIconId: castleId,
        backIconScaling: 1.2,
        backBgColor: 'primary',
        borderWidth: 0
    };
}
