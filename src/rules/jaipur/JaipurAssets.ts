/**
 * JaipurAssets.ts
 * Custom palettes, geometric vector icons, and card generators for the Jaipur game.
 */

import { Palette, IconObject, CardDefinition } from '../../client/lib/card-renderer/types';
import { CardType } from './JaipurGameState';

// ==========================================
// 1. Commodity Tailored Palettes
// ==========================================
export const JAIPUR_PALETTES: Record<CardType, Palette> = {
    diamonds: {
        id: 'jaipur_diamonds',
        name: 'Diamonds (Cyan)',
        background: '#f5fbff',      // Pale cyan-white
        border: '#3498db',          // Cobalt blue border
        primary: '#00d2ff',         // Radiant cyan
        secondary: '#3498db',       // Cobalt blue
        accent: '#e74c3c',          // Red spark
        charcoal: '#1a2c3d',        // Deep indigo dark
        text: '#1a2c3d',
        panelBg: '#d6efff',         // Light blue panel tint
        tertiary: '#9b59b6',
        success: '#2ecc71',
        danger: '#e74c3c'
    },
    gold: {
        id: 'jaipur_gold',
        name: 'Gold (Yellow-Gold)',
        background: '#fffef5',      // Warm gold cream
        border: '#d4af37',          // Rich gold border
        primary: '#f1c40f',         // Bright saffron yellow
        secondary: '#d4af37',       // Metallic gold
        accent: '#e67e22',          // Copper orange
        charcoal: '#342c0d',        // Deep gold-charcoal
        text: '#342c0d',
        panelBg: '#fef9db',         // Soft gold panel tint
        tertiary: '#2ecc71',
        success: '#2ecc71',
        danger: '#e74c3c'
    },
    silver: {
        id: 'jaipur_silver',
        name: 'Silver (Slate-Silver)',
        background: '#f6f8f9',      // Sleek silver-white
        border: '#95a5a6',          // Silver gray border
        primary: '#bdc3c7',         // Cool light gray
        secondary: '#7f8c8d',       // Cool slate gray
        accent: '#3498db',          // Electric blue spark
        charcoal: '#2c3e50',        // Deep slate dark
        text: '#2c3e50',
        panelBg: '#ecf0f1',         // Soft slate panel tint
        tertiary: '#e74c3c',
        success: '#2ecc71',
        danger: '#e74c3c'
    },
    cloth: {
        id: 'jaipur_cloth',
        name: 'Cloth (Royal Purple)',
        background: '#fffbfd',      // Pale orchid
        border: '#9b59b6',          // Royal purple border
        primary: '#9b59b6',         // Rich violet
        secondary: '#e08283',       // Rose pink
        accent: '#f1c40f',          // Saffron yellow accent
        charcoal: '#2e1c3b',        // Deep eggplant dark
        text: '#2e1c3b',
        panelBg: '#f5e7f8',         // Soft purple panel tint
        tertiary: '#16a085',
        success: '#2ecc71',
        danger: '#e74c3c'
    },
    spice: {
        id: 'jaipur_spice',
        name: 'Spice (Saffron-Chili)',
        background: '#fffaf4',      // Pale cardamom cream
        border: '#c0392b',          // Chili red border
        primary: '#e67e22',         // Saffron orange
        secondary: '#c0392b',       // Chili red
        accent: '#27ae60',          // Cardamom green
        charcoal: '#3e1a11',        // Roasted cinnamon dark
        text: '#3e1a11',
        panelBg: '#fdf2e2',         // Soft sand panel tint
        tertiary: '#2980b9',
        success: '#2ecc71',
        danger: '#e74c3c'
    },
    leather: {
        id: 'jaipur_leather',
        name: 'Leather (Sienna-Brown)',
        background: '#faf6f0',      // Warm parchment
        border: '#a0522d',          // Sienna border
        primary: '#d2691e',         // Chocolate sienna
        secondary: '#cd853f',       // Peru tan
        accent: '#16a085',          // Oasis teal accent
        charcoal: '#3d2314',        // Mahogany dark
        text: '#3d2314',
        panelBg: '#f5ebd6',         // Soft tan panel tint
        tertiary: '#e67e22',
        success: '#2ecc71',
        danger: '#e74c3c'
    },
    camels: {
        id: 'jaipur_camels',
        name: 'Camels (Desert Sand)',
        background: '#fffdf6',      // Oasis cream
        border: '#d35400',          // Terracotta border
        primary: '#e67e22',         // Desert camel brown
        secondary: '#d35400',       // Terracotta sienna
        accent: '#1abc9c',          // Turquoise saddle accent
        charcoal: '#2c3e50',        // Deep desert-night dark
        text: '#2c3e50',
        panelBg: '#fdf4e7',         // Soft cream panel tint
        tertiary: '#f1c40f',
        success: '#2ecc71',
        danger: '#e74c3c'
    }
};

// ==========================================
// 2. Custom Flat Vector Geometric Icons
// ==========================================
export const JAIPUR_ICONS: Record<string, IconObject> = {
    jaipurIcon_diamonds: {
        id: 'jaipurIcon_diamonds',
        name: 'Diamonds Icon',
        layers: [
            // Left facet (bold primary cyan color)
            { id: 'dia_left', type: 'bezier', x: 50, y: 50, fill: 'primary', customPath: 'M 0 -22 L -18 -22 L -25 -5 L 0 25 Z' },
            // Right facet (bold secondary blue color for flat geometric contrast)
            { id: 'dia_right', type: 'bezier', x: 50, y: 50, fill: 'secondary', customPath: 'M 0 -22 L 18 -22 L 25 -5 L 0 25 Z' }
        ]
    },

    jaipurIcon_gold: {
        id: 'jaipurIcon_gold',
        name: 'Gold Icon',
        layers: [
            // Ingot 1 (bottom-left, flat 2D trapezoid)
            { id: 'gol_i1', type: 'bezier', x: 38, y: 62, fill: 'primary', customPath: 'M -18 8 L 18 8 L 13 -8 L -13 -8 Z' },
            // Ingot 2 (bottom-right, flat 2D trapezoid)
            { id: 'gol_i2', type: 'bezier', x: 62, y: 62, fill: 'primary', customPath: 'M -18 8 L 18 8 L 13 -8 L -13 -8 Z' },
            // Ingot 3 (top-center, flat 2D trapezoid, secondary color overlay)
            { id: 'gol_i3', type: 'bezier', x: 50, y: 44, fill: 'secondary', customPath: 'M -18 8 L 18 8 L 13 -8 L -13 -8 Z' }
        ]
    },

    jaipurIcon_silver: {
        id: 'jaipurIcon_silver',
        name: 'Silver Icon',
        layers: [
            // Coin 1 (bottom-left, concentric rings built using solid overlays)
            { id: 'sil_c1_base', type: 'circle', x: 40, y: 56, scaleX: 0.64, scaleY: 0.64, fill: 'primary' },
            { id: 'sil_c1_ring', type: 'circle', x: 40, y: 56, scaleX: 0.48, scaleY: 0.48, fill: 'secondary' },
            { id: 'sil_c1_inner', type: 'circle', x: 40, y: 56, scaleX: 0.40, scaleY: 0.40, fill: 'primary' },
            { id: 'sil_c1_dia', type: 'rectangle', x: 40, y: 56, scaleX: 0.14, scaleY: 0.14, rotation: 45, fill: 'accent' },
            // Coin 2 (top-right, concentric rings built using solid overlays)
            { id: 'sil_c2_base', type: 'circle', x: 60, y: 44, scaleX: 0.64, scaleY: 0.64, fill: 'secondary' },
            { id: 'sil_c2_ring', type: 'circle', x: 60, y: 44, scaleX: 0.48, scaleY: 0.48, fill: 'primary' },
            { id: 'sil_c2_inner', type: 'circle', x: 60, y: 44, scaleX: 0.40, scaleY: 0.40, fill: 'secondary' },
            { id: 'sil_c2_dia', type: 'rectangle', x: 60, y: 44, scaleX: 0.14, scaleY: 0.14, rotation: 45, fill: 'accent' }
        ]
    },

    jaipurIcon_cloth: {
        id: 'jaipurIcon_cloth',
        name: 'Cloth Icon',
        layers: [
            // Spindle core
            { id: 'clo_spindle', type: 'rectangle', x: 50, y: 50, scaleX: 0.16, scaleY: 1.1, fill: 'secondary' },
            // Thread body
            { id: 'clo_thread', type: 'rectangle', x: 50, y: 50, scaleX: 0.6, scaleY: 0.7, fill: 'primary' },
            // Bold central stripe
            { id: 'clo_stripe', type: 'rectangle', x: 50, y: 50, scaleX: 0.6, scaleY: 0.16, fill: 'accent' },
            // Top spool end
            { id: 'clo_top', type: 'rectangle', x: 50, y: 30, scaleX: 0.74, scaleY: 0.14, fill: 'secondary' },
            // Bottom spool end
            { id: 'clo_bottom', type: 'rectangle', x: 50, y: 70, scaleX: 0.74, scaleY: 0.14, fill: 'secondary' }
        ]
    },

    jaipurIcon_spice: {
        id: 'jaipurIcon_spice',
        name: 'Spice Icon',
        layers: [
            // Chili Pepper Body (curved red-chili body using secondary color, centered at 0,0)
            { id: 'spi_body', type: 'bezier', x: 50, y: 52, scaleX: 1.0, scaleY: 1.0, fill: 'secondary', customPath: 'M -12 -18 C -24 -2, -5 22, 20 22 C 10 12, -5 -8, 2 -18 Z' },
            // Green cap stem (neat, symmetrical circle sitting flush at the top)
            { id: 'spi_stem', type: 'circle', x: 44, y: 32, scaleX: 0.16, scaleY: 0.16, fill: 'accent' }
        ]
    },

    jaipurIcon_leather: {
        id: 'jaipurIcon_leather',
        name: 'Leather Icon',
        layers: [
            // Pouch handle (outer ring block)
            { id: 'lea_handle_out', type: 'circle', x: 50, y: 35, scaleX: 0.4, scaleY: 0.4, fill: 'charcoal' },
            // Pouch handle cutout (card background overlay to form a clean flat ring)
            { id: 'lea_handle_in', type: 'circle', x: 50, y: 35, scaleX: 0.28, scaleY: 0.28, fill: 'background' },
            // Pouch body
            { id: 'lea_body', type: 'arch', x: 50, y: 60, scaleX: 0.72, scaleY: 0.54, rotation: 180, fill: 'primary' },
            // Pouch flap
            { id: 'lea_flap', type: 'triangle', x: 50, y: 46, scaleX: 0.72, scaleY: 0.26, rotation: 180, fill: 'secondary' },
            // Clasp button
            { id: 'lea_clasp', type: 'circle', x: 50, y: 57, scaleX: 0.14, scaleY: 0.14, fill: 'accent' }
        ]
    },

    jaipurIcon_camels: {
        id: 'jaipurIcon_camels',
        name: 'Camel Icon',
        layers: [
            // Front leg
            { id: 'cam_leg1', type: 'rectangle', x: 42, y: 76, scaleX: 0.08, scaleY: 0.36, fill: 'primary' },
            // Back leg
            { id: 'cam_leg2', type: 'rectangle', x: 66, y: 76, scaleX: 0.08, scaleY: 0.36, fill: 'primary' },
            // Tail
            { id: 'cam_tail', type: 'rectangle', x: 74, y: 55, scaleX: 0.04, scaleY: 0.16, rotation: 30, fill: 'secondary' },
            // Torso body
            { id: 'cam_body', type: 'rectangle', x: 54, y: 58, scaleX: 0.76, scaleY: 0.38, fill: 'primary' },
            // Hump
            { id: 'cam_hump', type: 'semi-circle', x: 56, y: 49, scaleX: 0.38, scaleY: 0.38, fill: 'primary' },
            // Neck
            { id: 'cam_neck', type: 'rectangle', x: 34, y: 45, scaleX: 0.12, scaleY: 0.54, rotation: -25, fill: 'primary' },
            // Head
            { id: 'cam_head', type: 'rectangle', x: 26, y: 26, scaleX: 0.22, scaleY: 0.12, rotation: -10, fill: 'primary' },
            // Ear
            { id: 'cam_ear', type: 'triangle', x: 32, y: 20, scaleX: 0.04, scaleY: 0.08, rotation: 15, fill: 'secondary' },
            // Saddle blanket
            { id: 'cam_saddle', type: 'rectangle', x: 54, y: 50, scaleX: 0.28, scaleY: 0.16, fill: 'accent' }
        ]
    }
};

// ==========================================
// 3. Dynamic Card Definition Generator
// ==========================================
export function getJaipurCardDefinition(type: CardType, isHerd?: boolean): CardDefinition {
    const hasHeader = !isHerd || type !== 'camels';
    
    const labels: Record<CardType, string> = {
        diamonds: 'Diamonds',
        gold: 'Gold',
        silver: 'Silver',
        cloth: 'Cloth',
        spice: 'Spice',
        leather: 'Leather',
        camels: 'Camels'
    };

    return {
        id: `jaipur_card_${type}`,
        name: type,
        widthMm: 63.5,
        heightMm: 88.9,
        borderRadiusMm: 4.5,
        palette: JAIPUR_PALETTES[type],
        borderWidth: 0.25,
        borderColor: 'border',
        header: hasHeader ? {
            title: labels[type],
            background: 'none'
        } : undefined,
        mainArt: {
            iconId: `jaipurIcon_${type}`,
            showFrame: false,
            scaling: hasHeader ? 1.45 : 1.8 // Slightly scale down if header is present to ensure fit
        }
    };
}
