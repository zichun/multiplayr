/**
 * presets.ts
 * Predefined palettes, icons, and card templates.
 */

import { Palette, IconObject, CardDefinition, IconLayer } from './types';

// ==========================================
// 1. Color Palettes
// ==========================================

export const PALETTES: Record<string, Palette> = {
    midCentury: {
        id: 'midCentury',
        name: 'Mid-Century Modern',
        background: '#f5f2eb',  // Warm cream
        border: '#cbb26a',      // Muted gold
        primary: '#d95a2b',     // Earthy orange
        secondary: '#cbb26a',   // Muted gold
        accent: '#009bb4',      // Deep cyan
        charcoal: '#1e2022',    // Deep charcoal
        text: '#1e2022',
        panelBg: '#eae6dd',
        tertiary: '#8f9e8b',    // Muted sage green
        success: '#608066',     // Earthy forest green
        danger: '#b83d30'       // Terra cotta red
    },
    softPastel: {
        id: 'softPastel',
        name: 'Soft Pastel',
        background: '#ffffff',  // Pure white for card contrast
        border: '#e2e8f0',      // Muted border
        primary: '#ffd3b6',     // Soft peach
        secondary: '#fcf8cf',   // Pale yellow
        accent: '#c5b3e6',      // Muted lavender
        charcoal: '#3b4252',    // Slate charcoal
        text: '#3b4252',
        panelBg: '#b2f5d9',     // Mint green as accent panel
        tertiary: '#ffabe1',    // Soft pastel pink
        success: '#a1e3cd',     // Light mint green
        danger: '#fca1a1'       // Soft pastel red
    },
    duneSpice: {
        id: 'duneSpice',
        name: 'Dune Spice',
        background: '#111111',  // Basalt black
        border: '#c2a649',      // Sand gold
        primary: '#b23b2b',     // Spice red
        secondary: '#c2a649',   // Sand gold
        accent: '#45b6ca',      // Sky cyan
        charcoal: '#222222',    // Charcoal panel
        text: '#f5f2eb',        // Cream text
        panelBg: '#1a1a1a',
        tertiary: '#8a9a86',    // Oasis olive green
        success: '#3cb371',     // Desert spring green
        danger: '#d2691e'       // Siona cinnamon orange
    },
    neonSynth: {
        id: 'neonSynth',
        name: 'Neon Synthwave',
        background: '#0a0b10',  // Dark space
        border: '#ff007f',      // Hot pink
        primary: '#ff007f',     // Hot pink
        secondary: '#a8ff00',   // Acid lime
        accent: '#00f0ff',      // Electric cyan
        charcoal: '#161925',    // Dark panel
        text: '#ffffff',
        panelBg: '#12131c',
        tertiary: '#bd00ff',    // Ultraviolet neon
        success: '#00ff66',     // Cyber green
        danger: '#ff003c'       // Neon crimson
    }
};

// ==========================================
// 2. Predefined Expressive Icons
// ==========================================

export const PRESET_ICONS: Record<string, IconObject> = {
    // A geometric concentric water drop icon
    waterDrop: {
        id: 'waterDrop',
        name: 'Water Drop',
        layers: [
            {
                id: 'wd_bg',
                type: 'circle',
                x: 50,
                y: 55,
                scaleX: 0.9,
                scaleY: 0.9,
                fill: 'accent',
                opacity: 1
            },
            {
                id: 'wd_ring1',
                type: 'circle',
                x: 50,
                y: 55,
                scaleX: 0.75,
                scaleY: 0.75,
                fill: 'background',
                opacity: 1
            },
            {
                id: 'wd_ring2',
                type: 'circle',
                x: 50,
                y: 55,
                scaleX: 0.6,
                scaleY: 0.6,
                fill: 'accent',
                opacity: 1
            },
            {
                id: 'wd_ring3',
                type: 'circle',
                x: 50,
                y: 55,
                scaleX: 0.45,
                scaleY: 0.45,
                fill: 'background',
                opacity: 1
            },
            {
                id: 'wd_ring4',
                type: 'circle',
                x: 50,
                y: 55,
                scaleX: 0.3,
                scaleY: 0.3,
                fill: 'accent',
                opacity: 1
            },
            // Point of the water drop
            {
                id: 'wd_point',
                type: 'triangle',
                x: 50,
                y: 35,
                scaleX: 0.4,
                scaleY: 0.5,
                rotation: 180,
                fill: 'accent',
                opacity: 1
            }
        ]
    },

    // A large golden sun overlapping a cyan crescent moon (Mid-century style)
    duneSun: {
        id: 'duneSun',
        name: 'Dune Sun & Moon',
        layers: [
            // Large sun
            {
                id: 'ds_sun',
                type: 'circle',
                x: 50,
                y: 45,
                scaleX: 1.5,
                scaleY: 1.5,
                fill: 'secondary', // Muted gold
                opacity: 1
            },
            // Cyan moon overlapping
            {
                id: 'ds_moon',
                type: 'circle',
                x: 22,
                y: 72,
                scaleX: 0.5,
                scaleY: 0.5,
                fill: 'accent', // Deep cyan
                opacity: 1
            },
            // Red sun accent
            {
                id: 'ds_accent',
                type: 'circle',
                x: 78,
                y: 22,
                scaleX: 0.25,
                scaleY: 0.25,
                fill: 'primary', // Earthy orange
                opacity: 1
            }
        ]
    },

    // A minimalist, geometric silhouette of a Bene Gesserit Sister
    beneGesseritSister: {
        id: 'beneGesseritSister',
        name: 'Bene Gesserit Sister',
        layers: [
            // Large red circle background accent
            {
                id: 'bg_sun_accent',
                type: 'circle',
                x: 70,
                y: 40,
                scaleX: 1.1,
                scaleY: 1.1,
                fill: 'primary', // Earthy orange
                opacity: 1
            },
            // Small gold circle background accent
            {
                id: 'bg_gold_accent',
                type: 'circle',
                x: 25,
                y: 55,
                scaleX: 0.5,
                scaleY: 0.5,
                fill: 'secondary', // Muted gold
                opacity: 1
            },
            // Black cloak body (Arch shape)
            {
                id: 'bg_body',
                type: 'arch',
                x: 50,
                y: 78,
                scaleX: 0.6,
                scaleY: 1.6,
                fill: 'charcoal',
                opacity: 1
            },
            // Blue shoulders overlay (Cylinder/Arch)
            {
                id: 'bg_shoulders',
                type: 'arch',
                x: 50,
                y: 54,
                scaleX: 0.7,
                scaleY: 0.38,
                fill: 'accent', // Cyan
                opacity: 1
            },
            // Black hood outline
            {
                id: 'bg_hood',
                type: 'arch',
                x: 50,
                y: 32,
                scaleX: 0.38,
                scaleY: 0.45,
                fill: 'charcoal',
                opacity: 1
            },
            // Face (Cream circle)
            {
                id: 'bg_face',
                type: 'circle',
                x: 50,
                y: 35,
                scaleX: 0.25,
                scaleY: 0.25,
                fill: 'background', // Cream
                opacity: 1
            },
            // Gold vertical chest line
            {
                id: 'bg_chest_line',
                type: 'rectangle',
                x: 50,
                y: 72,
                scaleX: 0.08,
                scaleY: 1.0,
                fill: 'secondary',
                opacity: 1
            },
            // Red mask/lips element
            {
                id: 'bg_lips',
                type: 'semi-circle',
                x: 50,
                y: 40,
                scaleX: 0.12,
                scaleY: 0.06,
                rotation: 180,
                fill: 'primary',
                opacity: 1
            }
        ]
    },

    // A giant geometric Sandworm rising from the desert
    sandworm: {
        id: 'sandworm',
        name: 'Sandworm Rise',
        layers: [
            // Cyan background sky circle
            {
                id: 'sw_sky',
                type: 'circle',
                x: 50,
                y: 45,
                scaleX: 1.4,
                scaleY: 1.4,
                fill: 'accent',
                opacity: 1
            },
            // Giant worm outer body (Arch)
            {
                id: 'sw_body',
                type: 'arch',
                x: 50,
                y: 75,
                scaleX: 1.2,
                scaleY: 1.8,
                fill: 'charcoal',
                opacity: 1
            },
            // Segment lines (using stripes clipped to body)
            // For simplicity in pure layers, we'll stack smaller arches in contrasting colors
            {
                id: 'sw_segment1',
                type: 'arch',
                x: 50,
                y: 80,
                scaleX: 1.0,
                scaleY: 1.4,
                fill: 'secondary',
                opacity: 1
            },
            {
                id: 'sw_segment2',
                type: 'arch',
                x: 50,
                y: 85,
                scaleX: 0.8,
                scaleY: 1.0,
                fill: 'charcoal',
                opacity: 1
            },
            // The open mouth (Red inner circle)
            {
                id: 'sw_mouth_inner',
                type: 'circle',
                x: 50,
                y: 40,
                scaleX: 0.7,
                scaleY: 0.7,
                fill: 'primary', // Earthy orange / spice red
                opacity: 1
            },
            // Teeth structures (a white concentric circle, masked out)
            {
                id: 'sw_mouth_core',
                type: 'circle',
                x: 50,
                y: 40,
                scaleX: 0.5,
                scaleY: 0.5,
                fill: 'charcoal',
                opacity: 1
            },
            // Floating spice/stars (small gold circles)
            {
                id: 'sw_spice1',
                type: 'circle',
                x: 20,
                y: 20,
                scaleX: 0.15,
                scaleY: 0.15,
                fill: 'secondary',
                opacity: 1
            },
            {
                id: 'sw_spice2',
                type: 'circle',
                x: 80,
                y: 25,
                scaleX: 0.1,
                scaleY: 0.1,
                fill: 'secondary',
                opacity: 1
            }
        ]
    },

    // Splendor Duel Gem: Emerald (Green diamond)
    emerald: {
        id: 'emerald',
        name: 'Emerald Gem',
        layers: [
            // Green triangle pointing up
            {
                id: 'em_top',
                type: 'triangle',
                x: 50,
                y: 38,
                scaleX: 1.1,
                scaleY: 0.9,
                fill: 'panelBg', // Mint green
                opacity: 1
            },
            // Green triangle pointing down
            {
                id: 'em_bottom',
                type: 'triangle',
                x: 50,
                y: 62,
                scaleX: 1.1,
                scaleY: 0.9,
                rotation: 180,
                fill: 'panelBg',
                opacity: 0.85
            },
            // Inner core facet
            {
                id: 'em_core',
                type: 'rectangle',
                x: 50,
                y: 50,
                scaleX: 0.5,
                scaleY: 0.5,
                rotation: 45,
                fill: 'background',
                opacity: 0.9
            }
        ]
    },

    // Splendor Duel Gem: Ruby (Red hexagon/diamond)
    ruby: {
        id: 'ruby',
        name: 'Ruby Gem',
        layers: [
            // Red square rotated 45 degrees
            {
                id: 'rb_base',
                type: 'rectangle',
                x: 50,
                y: 50,
                scaleX: 1.1,
                scaleY: 1.1,
                rotation: 45,
                fill: 'primary', // Peach / soft red
                opacity: 1
            },
            // Light highlight facet
            {
                id: 'rb_facet',
                type: 'triangle',
                x: 50,
                y: 40,
                scaleX: 0.6,
                scaleY: 0.5,
                fill: 'secondary', // Pale yellow
                opacity: 0.8
            }
        ]
    },

    // Splendor Duel Gem: Pearl (Concentric white/gold arches)
    pearl: {
        id: 'pearl',
        name: 'Pearl',
        layers: [
            {
                id: 'pr_outer',
                type: 'circle',
                x: 50,
                y: 50,
                scaleX: 1.2,
                scaleY: 1.2,
                fill: 'secondary', // Yellow
                opacity: 0.3
            },
            {
                id: 'pr_body',
                type: 'circle',
                x: 50,
                y: 50,
                scaleX: 0.9,
                scaleY: 0.9,
                fill: 'background', // White
                opacity: 1
            },
            {
                id: 'pr_shadow',
                type: 'semi-circle',
                x: 50,
                y: 50,
                scaleX: 0.9,
                scaleY: 0.9,
                rotation: 135,
                fill: 'primary', // Peach
                opacity: 0.4
            },
            {
                id: 'pr_glow',
                type: 'circle',
                x: 40,
                y: 40,
                scaleX: 0.25,
                scaleY: 0.25,
                fill: 'background',
                opacity: 0.9
            }
        ]
    },

    costLeaf: {
        id: 'costLeaf',
        name: 'Cost Ribbon Ornament',
        layers: [
            // Outer Charcoal Ribbon (Base + Notch subtraction)
            {
                id: 'lf_base_rect',
                type: 'rectangle',
                x: 50,
                y: 40,
                scaleX: 1.2,
                scaleY: 1.6,
                fill: 'charcoal',
                opacity: 1
            },
            {
                id: 'lf_base_tri',
                type: 'triangle',
                x: 50,
                y: 80,
                scaleX: 1.2,
                scaleY: 0.8,
                rotation: 180,
                fill: '#000000',
                opacity: 1
            },
            {
                id: 'lf_base_sub',
                type: 'boolean',
                op: 'subtract',
                baseId: 'lf_base_rect',
                operandId: 'lf_base_tri'
            },
            // Inner Gold Ribbon (Base + Notch subtraction)
            {
                id: 'lf_gold_rect',
                type: 'rectangle',
                x: 50,
                y: 36,
                scaleX: 0.96,
                scaleY: 1.44,
                fill: 'secondary',
                opacity: 1
            },
            {
                id: 'lf_gold_tri',
                type: 'triangle',
                x: 50,
                y: 72,
                scaleX: 0.96,
                scaleY: 0.72,
                rotation: 180,
                fill: '#000000',
                opacity: 1
            },
            {
                id: 'lf_gold_sub',
                type: 'boolean',
                op: 'subtract',
                baseId: 'lf_gold_rect',
                operandId: 'lf_gold_tri'
            }
        ]
    },

    // A futuristic geometric starship (Space Ranger Theme)
    starship: {
        id: 'starship',
        name: 'Space Ranger Starship',
        layers: [
            // Dark circular space portal background
            {
                id: 'shp_bg',
                type: 'circle',
                x: 50,
                y: 50,
                scaleX: 1.5,
                scaleY: 1.5,
                fill: 'charcoal',
                opacity: 1
            },
            // Star fields
            {
                id: 'shp_star1',
                type: 'circle',
                x: 25,
                y: 30,
                scaleX: 0.08,
                scaleY: 0.08,
                fill: 'accent',
                opacity: 0.8
            },
            {
                id: 'shp_star2',
                type: 'circle',
                x: 72,
                y: 68,
                scaleX: 0.08,
                scaleY: 0.08,
                fill: 'secondary',
                opacity: 0.8
            },
            // Thruster fire (Orange triangle pointing down)
            {
                id: 'shp_fire',
                type: 'triangle',
                x: 50,
                y: 78,
                scaleX: 0.4,
                scaleY: 0.8,
                rotation: 180,
                fill: 'primary', // Hot pink/orange
                opacity: 0.9
            },
            // Wing structures (Rectangle)
            {
                id: 'shp_wings',
                type: 'rectangle',
                x: 50,
                y: 60,
                scaleX: 1.5,
                scaleY: 0.28,
                fill: 'secondary', // Lime/gold
                opacity: 1
            },
            // Main fuselage (Triangle pointing up)
            {
                id: 'shp_hull',
                type: 'triangle',
                x: 50,
                y: 40,
                scaleX: 0.6,
                scaleY: 1.2,
                fill: 'background', // White
                opacity: 1
            },
            // Cockpit glass (Cyan circle)
            {
                id: 'shp_glass',
                type: 'circle',
                x: 50,
                y: 38,
                scaleX: 0.2,
                scaleY: 0.35,
                fill: 'accent', // Cyan
                opacity: 0.95
            }
        ]
    },

    // --------------------------------------------------------------------
    // Generic flat game glyphs (single-colour, palette-keyed so they theme).
    // Override the colour per-use with `colorOverride` on the header/data icon.
    // --------------------------------------------------------------------

    // Five-point star (prestige / rating). Authored directly in 0-100 space.
    star: {
        id: 'star',
        name: 'Star',
        layers: [
            { id: 'star_shape', type: 'bezier', x: 0, y: 0, scaleX: 1, scaleY: 1, fill: 'secondary', customPath: 'M 50 8 L 63 37 L 94 37 L 69 57 L 79 88 L 50 68 L 21 88 L 31 57 L 6 37 L 37 37 Z' }
        ]
    },

    // Three-point crown (crowns / royalty milestones).
    crown: {
        id: 'crown',
        name: 'Crown',
        layers: [
            { id: 'cr_base', type: 'rectangle', x: 50, y: 66, scaleX: 0.66, scaleY: 0.12, fill: 'secondary' },
            { id: 'cr_p1', type: 'triangle', x: 22, y: 52, scaleX: 0.22, scaleY: 0.34, fill: 'secondary' },
            { id: 'cr_p2', type: 'triangle', x: 50, y: 44, scaleX: 0.26, scaleY: 0.5, fill: 'secondary' },
            { id: 'cr_p3', type: 'triangle', x: 78, y: 52, scaleX: 0.22, scaleY: 0.34, fill: 'secondary' }
        ]
    },

    // Padlock (reserved / hidden / locked state).
    lock: {
        id: 'lock',
        name: 'Lock',
        layers: [
            { id: 'lk_body', type: 'rectangle', x: 50, y: 62, scaleX: 0.5, scaleY: 0.34, fill: 'charcoal' },
            { id: 'lk_shackle', type: 'arch', x: 50, y: 42, scaleX: 0.3, scaleY: 0.34, fill: 'none', stroke: 'charcoal', strokeWidth: 7 },
            { id: 'lk_hole', type: 'circle', x: 50, y: 60, scaleX: 0.12, scaleY: 0.12, fill: 'background' }
        ]
    },

    // Rolled scroll (privilege / decree / parchment).
    scroll: {
        id: 'scroll',
        name: 'Scroll',
        layers: [
            { id: 'sc_body', type: 'rectangle', x: 50, y: 50, scaleX: 0.5, scaleY: 0.64, fill: 'background' },
            { id: 'sc_top', type: 'rectangle', x: 50, y: 20, scaleX: 0.6, scaleY: 0.12, fill: 'charcoal' },
            { id: 'sc_bottom', type: 'rectangle', x: 50, y: 80, scaleX: 0.6, scaleY: 0.12, fill: 'charcoal' },
            { id: 'sc_ribbon', type: 'rectangle', x: 50, y: 50, scaleX: 0.54, scaleY: 0.1, fill: 'danger' }
        ]
    }
};

// ==========================================
// 2b. Icon builders
// ==========================================

/**
 * Build a flat "coin / token" icon: a solid colour disc with a glyph knocked out
 * of it (negative space). This is the reusable pattern behind tableau tokens and
 * card-cost pips — a solid disc reads clearly at any size and the glyph, drawn in
 * the card background colour (or white), looks like a punched hole.
 *
 * @param id         unique icon id
 * @param discColor  hex or palette key for the disc (e.g. '#2f93c2' or 'primary')
 * @param glyph      the symbol layers, typically filled '#ffffff' / 'background'
 * @param name       optional display name
 */
export function coinIcon(id: string, discColor: string, glyph: IconLayer[], name?: string): IconObject {
    return {
        id,
        name: name ?? id,
        layers: [
            { id: `${id}_disc`, type: 'circle', x: 50, y: 50, scaleX: 1.9, scaleY: 1.9, fill: discColor },
            ...glyph
        ]
    };
}

// ==========================================
// 3. Card Presets
// ==========================================

export const PRESET_CARDS: CardDefinition[] = [
    // 1. Dune Theme: "Bene Gesserit"
    {
        id: 'beneGesserit',
        name: 'Bene Gesserit',
        widthMm: 63.5,
        heightMm: 88.9,
        borderRadiusMm: 3.5,
        palette: 'midCentury',
        header: {
            title: 'BENE GESSERIT',
            subtitle: 'THE LITANY AGAINST FEAR',
            stats: 'LEVEL IV',
            icons: [
                {
                    iconId: 'waterDrop',
                    value: '💧'
                }
            ]
        },
        mainArt: {
            iconId: 'beneGesseritSister',
            showFrame: true,
            frameStyle: 'none'
        },
        data: {
            rows: [
                {
                    label: 'VOICE INFLUENCE',
                    value: '100%'
                },
                {
                    label: 'OBSERVATION MATRIX',
                    value: 'ANALYTICAL'
                }
            ]
        },
        footer: {
            text: 'I must not fear. Fear is the mind-killer.',
            align: 'center',
            verticalAlign: 'center'
        },
        overlay: {
            position: 'top-left',
            iconId: 'costLeaf',
            value: '4'
        }
    },

    // 2. Dune Theme: "Dune"
    {
        id: 'dune',
        name: 'Dune Space',
        widthMm: 63.5,
        heightMm: 88.9,
        borderRadiusMm: 3.5,
        palette: 'midCentury',
        header: {
            title: 'DUNE',
            subtitle: 'ARRAKIS SECTOR',
            stats: 'DESERT',
            icons: []
        },
        mainArt: {
            iconId: 'duneSun',
            showFrame: false
        },
        data: {
            rows: [
                {
                    label: 'SPICE PRODUCTION',
                    value: 'MAXIMUM'
                },
                {
                    label: 'SURVIVAL INDEX',
                    value: '12%'
                }
            ]
        },
        footer: {
            text: 'The spice must flow.',
            align: 'center',
            verticalAlign: 'center'
        }
    },

    // 3. Dune Theme: "Sandworm"
    {
        id: 'sandwormCard',
        name: 'Shai-Hulud',
        widthMm: 63.5,
        heightMm: 88.9,
        borderRadiusMm: 3.5,
        palette: 'duneSpice',
        header: {
            title: 'SHAI-HULUD',
            subtitle: 'GREAT WORM OF DESERT',
            stats: 'ELDER V',
            icons: [
                {
                    iconId: 'waterDrop',
                    value: '0'
                }
            ]
        },
        mainArt: {
            iconId: 'sandworm',
            showFrame: true,
            frameStyle: 'thin'
        },
        data: {
            rows: [
                {
                    label: 'TERRITORIAL POWER',
                    value: 'INFINITE'
                },
                {
                    label: 'ATTRACTED BY',
                    value: 'RHYTHM'
                }
            ]
        },
        footer: {
            text: 'Bless the Maker and His water.',
            align: 'center',
            verticalAlign: 'center'
        },
        overlay: {
            position: 'top-left',
            iconId: 'costLeaf',
            value: '9'
        }
    },

    // 4. Splendor Duel Style: Emerald Card (Soft Pastel)
    {
        id: 'splendorEmerald',
        name: 'Pastel Emerald Card',
        widthMm: 44.0, // Smaller token card size
        heightMm: 68.0,
        borderRadiusMm: 2.0,
        palette: 'softPastel',
        header: {
            title: 'EMERALD MINE',
            stats: '3',
            icons: [
                {
                    iconId: 'emerald',
                    value: '💎'
                }
            ]
        },
        mainArt: {
            iconId: 'emerald',
            showFrame: true,
            frameStyle: 'double'
        },
        data: {
            rows: [
                {
                    // Cost grid
                    iconsList: [
                        { iconId: 'ruby', value: '4' },
                        { iconId: 'pearl', value: '2' }
                    ]
                }
            ]
        },
        footer: {
            text: 'LEVEL 1 DEVELOP',
            align: 'center',
            verticalAlign: 'center'
        }
    },

    // 5. Space Ranger Card (Neon Synthwave)
    {
        id: 'spaceRanger',
        name: 'Space Ranger Wing',
        widthMm: 63.5,
        heightMm: 88.9,
        borderRadiusMm: 5.0, // Highly rounded
        palette: 'neonSynth',
        header: {
            title: 'VOID REAPER',
            subtitle: 'CLASS II STRIKER',
            stats: '850 HP',
            icons: []
        },
        mainArt: {
            iconId: 'starship',
            showFrame: true,
            frameStyle: 'thick'
        },
        data: {
            rows: [
                {
                    label: 'THRUSTER DRIVE',
                    value: 'MACH 9'
                },
                {
                    label: 'SHIELD FREQUENCY',
                    value: '108.4 GHZ'
                }
            ]
        },
        footer: {
            text: 'ENGAGING HYPERDRIVE IN 3... 2...',
            align: 'left',
            verticalAlign: 'top'
        },
        overlay: {
            position: 'top-left',
            iconId: 'costLeaf',
            value: 'E'
        }
    }
];
