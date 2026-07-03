/**
 * SplendorDuelAssets.ts
 * Custom iconography, pastel palettes, and playing card definition generators for SplendorDuel.
 */

import { CardDefinition, Palette, IconObject, DataRow } from '../../client/lib/card-renderer/types';
import { Card, RoyalCard, TokenColor } from './SplendorDuelGameState';

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

// Helper to resolve card visual color based on cost requirements if color is null (points-only)
export function getCardVisualColor(card: Card): TokenColor | 'wild' {
    if (card.color) return card.color;
    const costKeys = Object.keys(card.cost) as TokenColor[];
    if (costKeys.length > 0) {
        // Find the color with the maximum cost value
        let maxColor = costKeys[0];
        let maxVal = card.cost[maxColor] || 0;
        for (const col of costKeys) {
            const val = card.cost[col] || 0;
            if (val > maxVal) {
                maxVal = val;
                maxColor = col;
            }
        }
        return maxColor;
    }
    return 'white';
}

// Helper to get custom palette dynamically
export function getSplendorDuelPalette(color: TokenColor | 'wild' | null | undefined): Palette {
    if (!color) return SPLENDOR_PALETTES.gray;
    return SPLENDOR_PALETTES[color] || SPLENDOR_PALETTES.gray;
}

// ==========================================
// 2. Custom Flat Vector Geometric Iconography
// ==========================================
// Using literal hex color values to ensure color persistence across different card palettes.
export const SPLENDOR_DUEL_ICONS: Record<string, IconObject> = {
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
            { id: 'bg', type: 'circle', x: 50, y: 50, scaleX: 1.6, scaleY: 1.6, fill: 'primary', opacity: 0.22 },
            { id: 'w1', type: 'circle', x: 50, y: 50, scaleX: 0.8, scaleY: 0.8, fill: '#ffffff' }
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
            { id: 'disc', type: 'circle', x: 50, y: 50, scaleX: 1.9, scaleY: 1.9, fill: '#4a4363' },
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
            { id: 'disc', type: 'circle', x: 50, y: 50, scaleX: 1.9, scaleY: 1.9, fill: '#ffffff' },
            { id: 'st1', type: 'triangle', x: 50, y: 44, scaleX: 0.5, scaleY: 0.5, rotation: 0, fill: 'primary' },
            { id: 'st2', type: 'triangle', x: 50, y: 56, scaleX: 0.5, scaleY: 0.5, rotation: 180, fill: 'primary' }
        ]
    },

    // --- ABILITY SILHOUETTES (Faint accent circle + solid white flat glyph, matching the gems) ---
    ability_extra_turn_silhouette: {
        id: 'ability_extra_turn_silhouette',
        name: 'Extra Turn Silhouette',
        layers: [
            { id: 'bg', type: 'circle', x: 50, y: 50, scaleX: 1.6, scaleY: 1.6, fill: 'primary', opacity: 0.22 },
            { id: 'arr1_s', type: 'rectangle', x: 38, y: 50, scaleX: 0.25, scaleY: 0.12, fill: '#ffffff' },
            { id: 'arr1_h', type: 'triangle', x: 52, y: 50, scaleX: 0.28, scaleY: 0.28, rotation: 90, fill: '#ffffff' },
            { id: 'arr2_s', type: 'rectangle', x: 58, y: 50, scaleX: 0.25, scaleY: 0.12, fill: '#ffffff' },
            { id: 'arr2_h', type: 'triangle', x: 72, y: 50, scaleX: 0.28, scaleY: 0.28, rotation: 90, fill: '#ffffff' }
        ]
    },
    ability_steal_silhouette: {
        id: 'ability_steal_silhouette',
        name: 'Steal Silhouette',
        layers: [
            { id: 'bg', type: 'circle', x: 50, y: 50, scaleX: 1.6, scaleY: 1.6, fill: 'primary', opacity: 0.22 },
            { id: 'm_base', type: 'rectangle', x: 50, y: 50, scaleX: 0.72, scaleY: 0.32, fill: '#ffffff' },
            { id: 'eye_l', type: 'circle', x: 38, y: 50, scaleX: 0.12, scaleY: 0.12, fill: 'primary' },
            { id: 'eye_r', type: 'circle', x: 62, y: 50, scaleX: 0.12, scaleY: 0.12, fill: 'primary' }
        ]
    },
    ability_take_matching_silhouette: {
        id: 'ability_take_matching_silhouette',
        name: 'Take Matching Silhouette',
        layers: [
            { id: 'bg', type: 'circle', x: 50, y: 50, scaleX: 1.6, scaleY: 1.6, fill: 'primary', opacity: 0.22 },
            { id: 'a_shaft', type: 'rectangle', x: 50, y: 42, scaleX: 0.15, scaleY: 0.42, fill: '#ffffff' },
            { id: 'a_head', type: 'triangle', x: 50, y: 68, scaleX: 0.38, scaleY: 0.32, rotation: 180, fill: '#ffffff' }
        ]
    },
    ability_take_privilege_silhouette: {
        id: 'ability_take_privilege_silhouette',
        name: 'Scroll Silhouette',
        layers: [
            { id: 'bg', type: 'circle', x: 50, y: 50, scaleX: 1.6, scaleY: 1.6, fill: 'primary', opacity: 0.22 },
            { id: 's_body', type: 'rectangle', x: 50, y: 50, scaleX: 0.48, scaleY: 0.62, fill: '#ffffff' },
            { id: 's_top', type: 'rectangle', x: 50, y: 18, scaleX: 0.58, scaleY: 0.1, fill: '#ffffff' },
            { id: 's_bottom', type: 'rectangle', x: 50, y: 82, scaleX: 0.58, scaleY: 0.1, fill: '#ffffff' },
            { id: 's_ribbon', type: 'rectangle', x: 50, y: 50, scaleX: 0.52, scaleY: 0.1, fill: 'primary' }
        ]
    },

    // --- OTHERS ---
    crown: {
        id: 'crown',
        name: 'Crown',
        layers: [
            { id: 'cr_base', type: 'rectangle', x: 50, y: 70, scaleX: 0.7, scaleY: 0.1, fill: '#f6d32d' },
            { id: 'cr_p1', type: 'triangle', x: 25, y: 50, scaleX: 0.2, scaleY: 0.3, fill: '#f6d32d' },
            { id: 'cr_p2', type: 'triangle', x: 50, y: 40, scaleX: 0.25, scaleY: 0.5, fill: '#f6d32d' },
            { id: 'cr_p3', type: 'triangle', x: 75, y: 50, scaleX: 0.2, scaleY: 0.3, fill: '#f6d32d' },
            { id: 'cr_j2', type: 'circle', x: 50, y: 20, scaleX: 0.1, scaleY: 0.1, fill: '#258fb4' },
            { id: 'cr_j1', type: 'circle', x: 25, y: 38, scaleX: 0.08, scaleY: 0.08, fill: '#e01b24' },
            { id: 'cr_j3', type: 'circle', x: 75, y: 38, scaleX: 0.08, scaleY: 0.08, fill: '#e01b24' }
        ]
    },
    // Royal medallions: solid gold disc with a dark engraved glyph (regal + clearly visible).
    royal_crown: {
        id: 'royal_crown', name: 'Royal Crown',
        layers: [
            { id: 'disc', type: 'circle', x: 50, y: 50, scaleX: 1.9, scaleY: 1.9, fill: '#d9a520' },
            { id: 'cr_base', type: 'rectangle', x: 50, y: 64, scaleX: 0.46, scaleY: 0.1, fill: '#4a3608' },
            { id: 'cr_p1', type: 'triangle', x: 32, y: 54, scaleX: 0.16, scaleY: 0.26, fill: '#4a3608' },
            { id: 'cr_p2', type: 'triangle', x: 50, y: 46, scaleX: 0.2, scaleY: 0.44, fill: '#4a3608' },
            { id: 'cr_p3', type: 'triangle', x: 68, y: 54, scaleX: 0.16, scaleY: 0.26, fill: '#4a3608' }
        ]
    },
    royal_extra_turn: {
        id: 'royal_extra_turn', name: 'Royal Extra Turn',
        layers: [
            { id: 'disc', type: 'circle', x: 50, y: 50, scaleX: 1.9, scaleY: 1.9, fill: '#d9a520' },
            { id: 'arr1_s', type: 'rectangle', x: 37, y: 50, scaleX: 0.24, scaleY: 0.13, fill: '#4a3608' },
            { id: 'arr1_h', type: 'triangle', x: 51, y: 50, scaleX: 0.3, scaleY: 0.3, rotation: 90, fill: '#4a3608' },
            { id: 'arr2_s', type: 'rectangle', x: 57, y: 50, scaleX: 0.24, scaleY: 0.13, fill: '#4a3608' },
            { id: 'arr2_h', type: 'triangle', x: 71, y: 50, scaleX: 0.3, scaleY: 0.3, rotation: 90, fill: '#4a3608' }
        ]
    },
    royal_steal: {
        id: 'royal_steal', name: 'Royal Steal',
        layers: [
            { id: 'disc', type: 'circle', x: 50, y: 50, scaleX: 1.9, scaleY: 1.9, fill: '#d9a520' },
            { id: 'm_base', type: 'rectangle', x: 50, y: 50, scaleX: 0.74, scaleY: 0.34, fill: '#4a3608' },
            { id: 'eye_l', type: 'circle', x: 38, y: 50, scaleX: 0.13, scaleY: 0.13, fill: '#d9a520' },
            { id: 'eye_r', type: 'circle', x: 62, y: 50, scaleX: 0.13, scaleY: 0.13, fill: '#d9a520' }
        ]
    },
    royal_take_privilege: {
        id: 'royal_take_privilege', name: 'Royal Privilege',
        layers: [
            { id: 'disc', type: 'circle', x: 50, y: 50, scaleX: 1.9, scaleY: 1.9, fill: '#d9a520' },
            { id: 's_body', type: 'rectangle', x: 50, y: 50, scaleX: 0.44, scaleY: 0.58, fill: '#4a3608' },
            { id: 's_top', type: 'rectangle', x: 50, y: 24, scaleX: 0.52, scaleY: 0.1, fill: '#4a3608' },
            { id: 's_bottom', type: 'rectangle', x: 50, y: 76, scaleX: 0.52, scaleY: 0.1, fill: '#4a3608' },
            { id: 's_ribbon', type: 'rectangle', x: 50, y: 50, scaleX: 0.48, scaleY: 0.09, fill: '#d9a520' }
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
// 3. Dynamic Card Definition Builders
// ==========================================

export function getSplendorDuelCardDefinition(card: Card, bonuses: Partial<Record<TokenColor, number>>): CardDefinition {
    const visualColor = getCardVisualColor(card);
    const palette = getSplendorDuelPalette(visualColor);

    // Determine the icon to display in top-right for the permanent bonus
    const headerIcons = [];
    if (card.bonus_color && card.bonus_color !== 'wild') {
        const bonusIconId = `gem_${card.bonus_color}_bonus`;
        headerIcons.push({
            iconId: bonusIconId,
            value: card.bonus_count > 1 ? `x${card.bonus_count}` : undefined,
            scaling: 1.0
        });
    } else if (card.bonus_color === 'wild') {
        headerIcons.push({
            iconId: 'gem_wild_bonus',
            scaling: 1.0
        });
    }

    // Determine what goes in the central main art area
    let mainArtIconId: string = `gem_${visualColor}_silhouette`;
    if (card.ability) {
        // If it has an ability, show that ability icon
        mainArtIconId = `ability_${card.ability}_silhouette`;
    } else if (card.color === null) {
        // Points-only card: show a large star silhouette
        mainArtIconId = 'star_silhouette';
    }

    // Render costs as a vertical list in the data region
    const rows: DataRow[] = Object.keys(card.cost).map(colorKey => {
        const color = colorKey as TokenColor;
        const amt = card.cost[color] || 0;
        const discount = color === 'pearl' ? 0 : (bonuses[color] || 0);
        const effectiveCost = Math.max(0, amt - discount);

        return {
            iconId: `gem_${color}_coin`,
            label: '',
            value: String(amt),
            // Leave color undefined so that the cost number text is rendered in the dark palette text color (legible!)
            color: undefined,
            scaling: 1.0,
            // If discounted fully, make it look muted
            opacity: effectiveCost === 0 ? 0.25 : 1
        } as DataRow;
    });

    // Subtitle can hold crowns if any
    const subtitleVal = card.crowns === 1 ? 'c' : card.crowns === 2 ? 'cc' : undefined;

    // Footer text for abilities
    let footerText = '';
    if (card.ability) {
        footerText = card.ability.toUpperCase().replace('_', ' ');
    }

    return {
        id: card.id,
        name: card.color === 'wild' ? 'Joker' : card.bonus_color ? `${card.bonus_color.toUpperCase()} Card` : 'Points Card',
        widthMm: 63.5,
        heightMm: 88.9,
        borderRadiusMm: 4,
        palette: palette,
        borderColor: 'border',
        borderWidth: 0, // Turn off card border per user request
        header: {
            title: card.points > 0 ? String(card.points) : ' ',
            subtitle: subtitleVal,
            icons: headerIcons,
            background: 'primary' // Set to primary color (the header banner color!)
        },
        mainArt: {
            iconId: mainArtIconId,
            scaling: 1.15
        },
        data: {
            rows: rows
        },
        footer: footerText ? {
            text: footerText,
            align: 'center',
            verticalAlign: 'center',
            size: 0.7,
            background: 'panelBg'
        } : undefined
    };
}

// Single shared deck-back colour for every tier; the tier is read from the tower count.
const DECK_BACK_PALETTE: Palette = {
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
        borderWidth: 0 // Turn off card border per user request
    };
}

export function getRoyalCardDefinition(royal: RoyalCard): CardDefinition {
    const mainArtIconId = royal.ability ? `royal_${royal.ability}` : 'royal_crown';
    const label = royal.ability === 'extra_turn' ? 'EXTRA TURN'
        : royal.ability === 'steal' ? 'STEAL'
        : royal.ability === 'take_privilege' ? 'PRIVILEGE'
        : 'FAVOR';

    return {
        id: royal.id,
        name: 'Royal Favor',
        widthMm: 45,   // Portrait
        heightMm: 62,
        borderRadiusMm: 4,
        palette: {
            id: 'splendor_royal',
            name: 'Royal Gold',
            background: '#ffffff',
            border: '#e0be5a',
            primary: '#f4e3b0', // Light gold header band
            secondary: '#d9a520',
            accent: '#d9a520',
            charcoal: '#4a3608',
            text: '#4a3608',
            panelBg: '#faf1d6',
            tertiary: '#ffd3b6',
            success: '#2ec27e',
            danger: '#e01b24'
        },
        borderColor: 'border',
        borderWidth: 0.09, // thin lavender edge so the card reads on the white pool
        header: {
            title: royal.points > 0 ? String(royal.points) : ' ',
            background: 'primary'
        },
        mainArt: {
            iconId: mainArtIconId,
            scaling: 1.0
        },
        footer: {
            text: label,
            align: 'center',
            verticalAlign: 'center',
            size: 1.3,
            background: 'panelBg'
        }
    };
}
