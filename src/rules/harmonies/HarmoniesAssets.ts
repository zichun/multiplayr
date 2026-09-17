/**
 * HarmoniesAssets.ts
 *
 * Vector iconography, curated palettes, and card definitions for Harmonies.
 * - 7 Geometric Animal Shapes (Fox, Owl, Frog, Bear, Deer, Fish, Rabbit)
 *   authored with clean negative-space cutouts and geometric primitives.
 * - 5 Habitat Palettes (Water, Field, Mountain, Building, Tree).
 * - 35 Animal Cards (7 shapes x 5 palettes) with habitat patterns, cube tracks, and point ladders.
 * - Token & animal cube icons for boards, markets, and player aids.
 */

import { Palette, IconObject, CardDefinition, PrimitiveShape, IconLayer } from '../../client/lib/card-renderer/types';

// ============================================================================
// 1. Curated Habitat Palettes
// ============================================================================

export const HARMONIES_PALETTES: Record<string, Palette> = {
    harmonies_water: {
        id: 'harmonies_water',
        name: 'Harmonies Water',
        background: '#eaf4fc',  // Soft crystal water wash
        border: '#2980b9',      // Deep sapphire
        primary: '#3498db',     // Vibrant stream blue
        secondary: '#aed6f1',   // Pale sky
        accent: '#1abc9c',      // Reed teal
        charcoal: '#1a365d',    // Deep river charcoal
        text: '#1a365d',
        panelBg: '#d4ebf9',
        tertiary: '#7fb3d5',
        success: '#27ae60',
        danger: '#e74c3c'
    },
    harmonies_field: {
        id: 'harmonies_field',
        name: 'Harmonies Field',
        background: '#fef9e7',  // Warm sunlight cream
        border: '#d4ac0d',      // Warm golden border
        primary: '#f1c40f',     // Golden meadow yellow
        secondary: '#fcf3cf',   // Pale wheat
        accent: '#27ae60',      // Fresh grass blade
        charcoal: '#4a3b1a',    // Rich loam charcoal
        text: '#4a3b1a',
        panelBg: '#fef5d1',
        tertiary: '#f8c471',
        success: '#27ae60',
        danger: '#e74c3c'
    },
    harmonies_mountain: {
        id: 'harmonies_mountain',
        name: 'Harmonies Mountain',
        background: '#f2f4f4',  // Cloud mist
        border: '#566573',      // Slate border
        primary: '#7f8c8d',     // Granite gray
        secondary: '#d5dbdb',   // Pale limestone
        accent: '#8e44ad',      // Mountain wildflower
        charcoal: '#2c3e50',    // Basalt charcoal
        text: '#2c3e50',
        panelBg: '#e5e8e8',
        tertiary: '#90a4ae',
        success: '#27ae60',
        danger: '#e74c3c'
    },
    harmonies_building: {
        id: 'harmonies_building',
        name: 'Harmonies Building',
        background: '#fdf2e9',  // Warm terracotta plaster
        border: '#c0392b',      // Brick red border
        primary: '#e67e22',     // Hearth coral-orange
        secondary: '#edbb99',   // Soft sandstone
        accent: '#c0392b',      // Crimson roof
        charcoal: '#4e2213',    // Hearth ember charcoal
        text: '#4e2213',
        panelBg: '#fae5d3',
        tertiary: '#eb984e',
        success: '#27ae60',
        danger: '#c0392b'
    },
    harmonies_tree: {
        id: 'harmonies_tree',
        name: 'Harmonies Tree',
        background: '#eafaf1',  // Soft canopy wash
        border: '#1e8449',      // Deep forest border
        primary: '#27ae60',     // Emerald foliage
        secondary: '#a9dfbf',   // Spring leaf green
        accent: '#8e44ad',      // Wild forest berry
        charcoal: '#144222',    // Deep moss charcoal
        text: '#144222',
        panelBg: '#d5f5e3',
        tertiary: '#58d68d',
        success: '#27ae60',
        danger: '#e74c3c'
    }
};

export type HabitatType = 'water' | 'field' | 'mountain' | 'building' | 'tree';

export function getHabitatPalette(habitat: HabitatType): Palette {
    return HARMONIES_PALETTES[`harmonies_${habitat}`];
}

// ============================================================================
// 2. The 7 Geometric Animal Shapes (with clean negative-space layering)
// ============================================================================

// Helper shorthands for shape layers
const S = (
    id: string,
    type: PrimitiveShape['type'],
    x: number,
    y: number,
    sx: number,
    sy: number,
    rot = 0,
    fill = 'primary',
    extra: Partial<Pick<PrimitiveShape, 'stroke' | 'strokeWidth' | 'opacity' | 'customPath'>> = {}
): IconLayer => ({ id, type, x, y, scaleX: sx, scaleY: sy, rotation: rot, fill, ...extra });

const CUT = (
    id: string,
    type: PrimitiveShape['type'],
    x: number,
    y: number,
    sx: number,
    sy: number,
    rot = 0
): IconLayer => S(id, type, x, y, sx, sy, rot, 'background');

export const HARMONIES_ANIMAL_ICONS: Record<string, IconObject> = {
    // 1. Geometric Fox
    harmonies_fox: {
        id: 'harmonies_fox',
        name: 'Geometric Fox',
        layers: [
            // Head background disc for round silhouette
            S('bg_disc', 'circle', 50, 52, 1.6, 1.6, 0, 'secondary', { opacity: 0.35 }),
            // Ears
            S('ear_l', 'triangle', 32, 26, 0.45, 0.65, -20, 'primary'),
            S('ear_r', 'triangle', 68, 26, 0.45, 0.65, 20, 'primary'),
            // Inner ears (cutout)
            CUT('ear_in_l', 'triangle', 33, 27, 0.22, 0.35, -20),
            CUT('ear_in_r', 'triangle', 67, 27, 0.22, 0.35, 20),
            // Head base
            S('head', 'triangle', 50, 58, 1.4, 1.1, 180, 'primary'),
            // Cheeks
            S('cheek_l', 'circle', 34, 52, 0.4, 0.4, 0, 'primary'),
            S('cheek_r', 'circle', 66, 52, 0.4, 0.4, 0, 'primary'),
            // White muzzle mask
            CUT('muzzle', 'triangle', 50, 64, 0.75, 0.6, 180),
            // Eyes
            CUT('eye_l', 'rectangle', 38, 48, 0.16, 0.08, 15),
            CUT('eye_r', 'rectangle', 62, 48, 0.16, 0.08, -15),
            // Nose
            S('nose', 'circle', 50, 72, 0.14, 0.14, 0, 'charcoal')
        ]
    },

    // 2. Geometric Owl
    harmonies_owl: {
        id: 'harmonies_owl',
        name: 'Geometric Owl',
        layers: [
            S('bg_disc', 'circle', 50, 50, 1.6, 1.6, 0, 'secondary', { opacity: 0.35 }),
            // Ear tufts
            S('tuft_l', 'triangle', 30, 24, 0.35, 0.5, -25, 'primary'),
            S('tuft_r', 'triangle', 70, 24, 0.35, 0.5, 25, 'primary'),
            // Body / Head arch
            S('body', 'arch', 50, 58, 1.45, 1.35, 0, 'primary'),
            // Large circular eye frames
            CUT('eye_bg_l', 'circle', 36, 44, 0.62, 0.62, 0),
            CUT('eye_bg_r', 'circle', 64, 44, 0.62, 0.62, 0),
            // Iris / Pupils
            S('iris_l', 'circle', 36, 44, 0.38, 0.38, 0, 'primary'),
            S('iris_r', 'circle', 64, 44, 0.38, 0.38, 0, 'primary'),
            S('pupil_l', 'circle', 36, 44, 0.18, 0.18, 0, 'charcoal'),
            S('pupil_r', 'circle', 64, 44, 0.18, 0.18, 0, 'charcoal'),
            // Beak
            S('beak', 'triangle', 50, 56, 0.28, 0.38, 180, 'accent'),
            // Breast feather chevron
            CUT('feather', 'triangle', 50, 72, 0.45, 0.25, 180)
        ]
    },

    // 3. Geometric Frog
    harmonies_frog: {
        id: 'harmonies_frog',
        name: 'Geometric Frog',
        layers: [
            S('bg_disc', 'circle', 50, 54, 1.6, 1.5, 0, 'secondary', { opacity: 0.35 }),
            // Bulbous eye periscopes
            S('periscope_l', 'circle', 32, 34, 0.65, 0.65, 0, 'primary'),
            S('periscope_r', 'circle', 68, 34, 0.65, 0.65, 0, 'primary'),
            // Eye whites
            CUT('eye_w_l', 'circle', 32, 34, 0.42, 0.42, 0),
            CUT('eye_w_r', 'circle', 68, 34, 0.42, 0.42, 0),
            // Horizontal slit pupils
            S('pupil_l', 'rectangle', 32, 34, 0.28, 0.1, 0, 'charcoal'),
            S('pupil_r', 'rectangle', 68, 34, 0.28, 0.1, 0, 'charcoal'),
            // Broad frog head
            S('head', 'circle', 50, 58, 1.65, 1.25, 0, 'primary'),
            // Cheek spots
            S('cheek_l', 'circle', 24, 60, 0.24, 0.24, 0, 'accent'),
            S('cheek_r', 'circle', 76, 60, 0.24, 0.24, 0, 'accent'),
            // Wide smile cut
            CUT('mouth', 'rectangle', 50, 66, 0.85, 0.08, 0),
            // Nostril dots
            S('nos_l', 'circle', 46, 52, 0.06, 0.06, 0, 'charcoal'),
            S('nos_r', 'circle', 54, 52, 0.06, 0.06, 0, 'charcoal')
        ]
    },

    // 4. Geometric Bear
    harmonies_bear: {
        id: 'harmonies_bear',
        name: 'Geometric Bear',
        layers: [
            S('bg_disc', 'circle', 50, 50, 1.6, 1.6, 0, 'secondary', { opacity: 0.35 }),
            // Ears
            S('ear_l', 'circle', 27, 28, 0.52, 0.52, 0, 'primary'),
            S('ear_r', 'circle', 73, 28, 0.52, 0.52, 0, 'primary'),
            // Inner ears
            CUT('ear_in_l', 'circle', 27, 28, 0.28, 0.28, 0),
            CUT('ear_in_r', 'circle', 73, 28, 0.28, 0.28, 0),
            // Main round head
            S('head', 'circle', 50, 54, 1.5, 1.45, 0, 'primary'),
            // Muzzle oval
            CUT('muzzle', 'circle', 50, 66, 0.75, 0.55, 0),
            // Nose
            S('nose', 'triangle', 50, 62, 0.28, 0.22, 180, 'charcoal'),
            // Mouth line
            S('mouth', 'rectangle', 50, 70, 0.08, 0.16, 0, 'charcoal'),
            // Eyes
            CUT('eye_l', 'circle', 36, 46, 0.14, 0.14, 0),
            CUT('eye_r', 'circle', 64, 46, 0.14, 0.14, 0)
        ]
    },

    // 5. Geometric Deer (Stag)
    harmonies_deer: {
        id: 'harmonies_deer',
        name: 'Geometric Deer',
        layers: [
            S('bg_disc', 'circle', 50, 52, 1.6, 1.6, 0, 'secondary', { opacity: 0.35 }),
            // Symmetrical antlers (composed cleanly of geometric bars)
            S('antler_l1', 'rectangle', 38, 22, 0.1, 0.5, -25, 'primary'),
            S('antler_r1', 'rectangle', 62, 22, 0.1, 0.5, 25, 'primary'),
            S('antler_l2', 'rectangle', 29, 18, 0.1, 0.3, 30, 'primary'),
            S('antler_r2', 'rectangle', 71, 18, 0.1, 0.3, -30, 'primary'),
            S('antler_l3', 'rectangle', 40, 10, 0.1, 0.25, -45, 'primary'),
            S('antler_r3', 'rectangle', 60, 10, 0.1, 0.25, 45, 'primary'),
            // Ears
            S('ear_l', 'triangle', 25, 45, 0.3, 0.5, -55, 'primary'),
            S('ear_r', 'triangle', 75, 45, 0.3, 0.5, 55, 'primary'),
            // Slender diamond head
            S('head_up', 'triangle', 50, 50, 1.1, 0.7, 0, 'primary'),
            S('head_dn', 'triangle', 50, 65, 1.1, 0.9, 180, 'primary'),
            // White snout cut
            CUT('snout', 'triangle', 50, 73, 0.45, 0.4, 180),
            // Nose
            S('nose', 'circle', 50, 76, 0.12, 0.12, 0, 'charcoal'),
            // Gentle eyes
            CUT('eye_l', 'circle', 37, 52, 0.13, 0.13, 0),
            CUT('eye_r', 'circle', 63, 52, 0.13, 0.13, 0)
        ]
    },

    // 6. Geometric Fish
    harmonies_fish: {
        id: 'harmonies_fish',
        name: 'Geometric Fish',
        layers: [
            S('bg_disc', 'circle', 50, 50, 1.6, 1.6, 0, 'secondary', { opacity: 0.35 }),
            // Tail fins
            S('tail_top', 'triangle', 78, 38, 0.4, 0.5, -45, 'primary'),
            S('tail_bot', 'triangle', 78, 62, 0.4, 0.5, 45, 'primary'),
            // Dorsal & ventral fins
            S('fin_top', 'triangle', 45, 24, 0.35, 0.4, 15, 'primary'),
            S('fin_bot', 'triangle', 48, 76, 0.3, 0.35, 165, 'primary'),
            // Teardrop body
            S('body', 'circle', 45, 50, 1.6, 1.15, 0, 'primary'),
            // Head curve cut
            CUT('gill', 'rectangle', 38, 50, 0.08, 0.65, 0),
            // Eye
            CUT('eye_w', 'circle', 25, 46, 0.32, 0.32, 0),
            S('eye_pupil', 'circle', 25, 46, 0.16, 0.16, 0, 'charcoal'),
            // Scale pattern accent
            S('scale1', 'circle', 55, 45, 0.22, 0.22, 0, 'accent'),
            S('scale2', 'circle', 55, 55, 0.22, 0.22, 0, 'accent')
        ]
    },

    // 7. Geometric Rabbit
    harmonies_rabbit: {
        id: 'harmonies_rabbit',
        name: 'Geometric Rabbit',
        layers: [
            S('bg_disc', 'circle', 50, 52, 1.6, 1.6, 0, 'secondary', { opacity: 0.35 }),
            // Long upright ears
            S('ear_l', 'arch', 35, 22, 0.38, 1.05, -5, 'primary'),
            S('ear_r', 'arch', 65, 22, 0.38, 1.05, 5, 'primary'),
            // Inner ears (cutout)
            CUT('ear_in_l', 'arch', 35, 22, 0.2, 0.75, -5),
            CUT('ear_in_r', 'arch', 65, 22, 0.2, 0.75, 5),
            // Round head
            S('head', 'circle', 50, 62, 1.45, 1.35, 0, 'primary'),
            // Cheeks muzzle
            CUT('muzzle', 'circle', 50, 68, 0.65, 0.45, 0),
            // Twitchy nose
            S('nose', 'triangle', 50, 64, 0.18, 0.16, 180, 'accent'),
            // Friendly eyes
            CUT('eye_l', 'circle', 34, 54, 0.15, 0.15, 0),
            CUT('eye_r', 'circle', 66, 54, 0.15, 0.15, 0)
        ]
    }
};

// ============================================================================
// 3. Terrain Tokens & Cube Glyphs
// ============================================================================

export const HARMONIES_TOKEN_ICONS: Record<string, IconObject> = {
    // Water token: blue disc with concentric water rings
    token_blue: {
        id: 'token_blue',
        name: 'Water Token',
        layers: [
            S('disc', 'circle', 50, 50, 1.9, 1.9, 0, '#3498db'),
            S('ring1', 'circle', 50, 50, 1.2, 1.2, 0, 'none', { stroke: '#ffffff', strokeWidth: 3, opacity: 0.8 }),
            S('ring2', 'circle', 50, 50, 0.6, 0.6, 0, 'none', { stroke: '#ffffff', strokeWidth: 3, opacity: 0.8 })
        ]
    },
    // Mountain token: gray disc with peaked triangle
    token_gray: {
        id: 'token_gray',
        name: 'Mountain Token',
        layers: [
            S('disc', 'circle', 50, 50, 1.9, 1.9, 0, '#7f8c8d'),
            S('peak', 'triangle', 50, 48, 0.9, 0.9, 0, '#ffffff'),
            S('shadow', 'triangle', 58, 52, 0.6, 0.6, 0, '#566573')
        ]
    },
    // Tree trunk token: brown disc with wood ring
    token_brown: {
        id: 'token_brown',
        name: 'Tree Trunk Token',
        layers: [
            S('disc', 'circle', 50, 50, 1.9, 1.9, 0, '#8e5836'),
            S('bark_ring', 'circle', 50, 50, 1.3, 1.3, 0, 'none', { stroke: '#d7a177', strokeWidth: 4 }),
            S('heart', 'circle', 50, 50, 0.4, 0.4, 0, '#d7a177')
        ]
    },
    // Tree foliage token: vibrant green canopy
    token_green: {
        id: 'token_green',
        name: 'Tree Leaves Token',
        layers: [
            S('disc', 'circle', 50, 50, 1.9, 1.9, 0, '#27ae60'),
            S('leaf1', 'circle', 50, 36, 0.6, 0.6, 0, '#a9dfbf'),
            S('leaf2', 'circle', 38, 58, 0.6, 0.6, 0, '#a9dfbf'),
            S('leaf3', 'circle', 62, 58, 0.6, 0.6, 0, '#a9dfbf')
        ]
    },
    // Field token: sunny yellow with grain stalk
    token_yellow: {
        id: 'token_yellow',
        name: 'Field Token',
        layers: [
            S('disc', 'circle', 50, 50, 1.9, 1.9, 0, '#f1c40f'),
            S('grain_stem', 'rectangle', 50, 50, 0.08, 0.8, 0, '#7d6608'),
            S('seed1', 'circle', 42, 38, 0.22, 0.22, 0, '#7d6608'),
            S('seed2', 'circle', 58, 48, 0.22, 0.22, 0, '#7d6608'),
            S('seed3', 'circle', 42, 58, 0.22, 0.22, 0, '#7d6608')
        ]
    },
    // Building top: red disc with masonry house roof
    token_red: {
        id: 'token_red',
        name: 'Building Token',
        layers: [
            S('disc', 'circle', 50, 50, 1.9, 1.9, 0, '#e74c3c'),
            S('roof', 'triangle', 50, 38, 1.0, 0.6, 0, '#ffffff'),
            S('walls', 'rectangle', 50, 62, 0.65, 0.45, 0, '#ffffff'),
            S('door', 'arch', 50, 66, 0.22, 0.35, 0, '#c0392b')
        ]
    },
    // Amber Animal Cube (isometric faceted cube)
    animal_cube: {
        id: 'animal_cube',
        name: 'Animal Cube',
        layers: [
            // Top face
            S('top', 'triangle', 50, 32, 1.1, 0.65, 0, '#f9e79f'),
            // Left face
            S('left', 'rectangle', 36, 56, 0.48, 0.55, 30, '#f39c12'),
            // Right face
            S('right', 'rectangle', 64, 56, 0.48, 0.55, -30, '#d68910')
        ]
    }
};

export const ALL_HARMONIES_ICONS: Record<string, IconObject> = {
    ...HARMONIES_ANIMAL_ICONS,
    ...HARMONIES_TOKEN_ICONS
};

// ============================================================================
// 4. Animal Card Pattern & Card Definitions
// ============================================================================

export type Color = 'blue' | 'gray' | 'brown' | 'green' | 'yellow' | 'red';

export interface Axial {
    q: number;
    r: number;
}

export type FeatureKind = 'water' | 'field' | 'mountain' | 'tree' | 'building' | 'redToken';

export interface FeatureRequirement {
    kind: FeatureKind;
    height?: number; // for mountain (1..3) or tree (1..3)
}

export interface PatternCell {
    offset: Axial;
    require: FeatureRequirement;
    cube?: boolean; // true on the single cell that receives the cube
}

export interface AnimalCardSpec {
    id: string;
    animalKey: string;     // One of the 7 animal keys
    habitat: HabitatType;  // One of the 5 palettes
    animalName: string;
    cubeColor: Color;
    otherColor: Color;
    pattern: PatternCell[];
    cubeCount: number;
    pointTrack: number[];  // Index = cubes placed (0..cubeCount)
}

// ----------------------------------------------------------------------------
// The 35 Animal Cards Specification
// (7 animals x 5 habitat families = 35 unique cards)
// ----------------------------------------------------------------------------

export const ANIMAL_CARD_SPECS: AnimalCardSpec[] = [
    // ------------------------------------------------------------------------
    // Family 1: WATER (7 cards, cube on blue, W1 - W7)
    // ------------------------------------------------------------------------
    {
        id: 'W1',
        animalKey: 'harmonies_fox',
        habitat: 'water',
        animalName: 'Fox',
        cubeColor: 'blue',
        otherColor: 'yellow',
        pattern: [
            { offset: { q: 0, r: 0 }, require: { kind: 'water' }, cube: true },
            { offset: { q: 1, r: 0 }, require: { kind: 'field' } },
            { offset: { q: 0, r: 1 }, require: { kind: 'field' } }
        ],
        cubeCount: 3,
        pointTrack: [0, 4, 8, 13]
    },
    {
        id: 'W2',
        animalKey: 'harmonies_owl',
        habitat: 'water',
        animalName: 'Owl',
        cubeColor: 'blue',
        otherColor: 'gray',
        pattern: [
            { offset: { q: 0, r: 0 }, require: { kind: 'water' }, cube: true },
            { offset: { q: 1, r: 0 }, require: { kind: 'mountain', height: 3 } }
        ],
        cubeCount: 2,
        pointTrack: [0, 5, 11]
    },
    {
        id: 'W3',
        animalKey: 'harmonies_frog',
        habitat: 'water',
        animalName: 'Frog',
        cubeColor: 'blue',
        otherColor: 'gray',
        pattern: [
            { offset: { q: 0, r: 0 }, require: { kind: 'water' }, cube: true },
            { offset: { q: 1, r: 0 }, require: { kind: 'mountain', height: 2 } }
        ],
        cubeCount: 3,
        pointTrack: [0, 3, 7, 12]
    },
    {
        id: 'W4',
        animalKey: 'harmonies_bear',
        habitat: 'water',
        animalName: 'Bear',
        cubeColor: 'blue',
        otherColor: 'red',
        pattern: [
            { offset: { q: 0, r: 0 }, require: { kind: 'water' }, cube: true },
            { offset: { q: 1, r: 0 }, require: { kind: 'building' } }
        ],
        cubeCount: 3,
        pointTrack: [0, 4, 8, 14]
    },
    {
        id: 'W5',
        animalKey: 'harmonies_deer',
        habitat: 'water',
        animalName: 'Stag',
        cubeColor: 'blue',
        otherColor: 'green',
        pattern: [
            { offset: { q: 0, r: 0 }, require: { kind: 'water' }, cube: true },
            { offset: { q: 1, r: 0 }, require: { kind: 'water' } },
            { offset: { q: 0, r: 1 }, require: { kind: 'tree', height: 2 } }
        ],
        cubeCount: 3,
        pointTrack: [0, 3, 7, 12]
    },
    {
        id: 'W6',
        animalKey: 'harmonies_fish',
        habitat: 'water',
        animalName: 'Trout',
        cubeColor: 'blue',
        otherColor: 'green',
        pattern: [
            { offset: { q: 0, r: 0 }, require: { kind: 'water' }, cube: true },
            { offset: { q: 1, r: 0 }, require: { kind: 'tree', height: 1 } },
            { offset: { q: -1, r: 1 }, require: { kind: 'tree', height: 1 } }
        ],
        cubeCount: 4,
        pointTrack: [0, 2, 5, 9, 14]
    },
    {
        id: 'W7',
        animalKey: 'harmonies_rabbit',
        habitat: 'water',
        animalName: 'Hare',
        cubeColor: 'blue',
        otherColor: 'green',
        pattern: [
            { offset: { q: 0, r: 0 }, require: { kind: 'water' }, cube: true },
            { offset: { q: 1, r: 0 }, require: { kind: 'tree', height: 1 } }
        ],
        cubeCount: 2,
        pointTrack: [0, 4, 9]
    },

    // ------------------------------------------------------------------------
    // Family 2: FIELD (7 cards, cube on yellow, Y1 - Y7)
    // ------------------------------------------------------------------------
    {
        id: 'Y1',
        animalKey: 'harmonies_fox',
        habitat: 'field',
        animalName: 'Fox',
        cubeColor: 'yellow',
        otherColor: 'blue',
        pattern: [
            { offset: { q: 0, r: 0 }, require: { kind: 'field' }, cube: true },
            { offset: { q: 1, r: 0 }, require: { kind: 'water' } },
            { offset: { q: 0, r: 1 }, require: { kind: 'water' } },
            { offset: { q: 1, r: -1 }, require: { kind: 'water' } }
        ],
        cubeCount: 2,
        pointTrack: [0, 6, 13]
    },
    {
        id: 'Y2',
        animalKey: 'harmonies_owl',
        habitat: 'field',
        animalName: 'Owl',
        cubeColor: 'yellow',
        otherColor: 'gray',
        pattern: [
            { offset: { q: 0, r: 0 }, require: { kind: 'field' }, cube: true },
            { offset: { q: 1, r: 0 }, require: { kind: 'field' } },
            { offset: { q: 0, r: 1 }, require: { kind: 'mountain', height: 2 } }
        ],
        cubeCount: 3,
        pointTrack: [0, 3, 7, 12]
    },
    {
        id: 'Y3',
        animalKey: 'harmonies_frog',
        habitat: 'field',
        animalName: 'Toad',
        cubeColor: 'yellow',
        otherColor: 'red',
        pattern: [
            { offset: { q: 0, r: 0 }, require: { kind: 'field' }, cube: true },
            { offset: { q: 1, r: 0 }, require: { kind: 'redToken' } },
            { offset: { q: 0, r: 1 }, require: { kind: 'redToken' } }
        ],
        cubeCount: 3,
        pointTrack: [0, 4, 8, 13]
    },
    {
        id: 'Y4',
        animalKey: 'harmonies_bear',
        habitat: 'field',
        animalName: 'Bear',
        cubeColor: 'yellow',
        otherColor: 'green',
        pattern: [
            { offset: { q: 0, r: 0 }, require: { kind: 'field' }, cube: true },
            { offset: { q: 1, r: 0 }, require: { kind: 'tree', height: 2 } },
            { offset: { q: 2, r: 0 }, require: { kind: 'tree', height: 2 } }
        ],
        cubeCount: 3,
        pointTrack: [0, 4, 8, 14]
    },
    {
        id: 'Y5',
        animalKey: 'harmonies_deer',
        habitat: 'field',
        animalName: 'Gazelle',
        cubeColor: 'yellow',
        otherColor: 'green',
        pattern: [
            { offset: { q: 0, r: 0 }, require: { kind: 'field' }, cube: true },
            { offset: { q: -1, r: 0 }, require: { kind: 'tree', height: 2 } },
            { offset: { q: 1, r: 0 }, require: { kind: 'tree', height: 2 } }
        ],
        cubeCount: 3,
        pointTrack: [0, 4, 8, 13]
    },
    {
        id: 'Y6',
        animalKey: 'harmonies_fish',
        habitat: 'field',
        animalName: 'Carp',
        cubeColor: 'yellow',
        otherColor: 'green',
        pattern: [
            { offset: { q: 0, r: 0 }, require: { kind: 'field' }, cube: true },
            { offset: { q: 1, r: 0 }, require: { kind: 'tree', height: 2 } }
        ],
        cubeCount: 4,
        pointTrack: [0, 2, 5, 8, 12]
    },
    {
        id: 'Y7',
        animalKey: 'harmonies_rabbit',
        habitat: 'field',
        animalName: 'Jackrabbit',
        cubeColor: 'yellow',
        otherColor: 'green',
        pattern: [
            { offset: { q: 0, r: 0 }, require: { kind: 'field' }, cube: true },
            { offset: { q: 1, r: 0 }, require: { kind: 'field' } },
            { offset: { q: 0, r: 1 }, require: { kind: 'tree', height: 1 } }
        ],
        cubeCount: 3,
        pointTrack: [0, 3, 7, 11]
    },

    // ------------------------------------------------------------------------
    // Family 3: MOUNTAIN (7 cards, cube on gray, M1 - M7)
    // ------------------------------------------------------------------------
    {
        id: 'M1',
        animalKey: 'harmonies_fox',
        habitat: 'mountain',
        animalName: 'Fox',
        cubeColor: 'gray',
        otherColor: 'blue',
        pattern: [
            { offset: { q: 0, r: 0 }, require: { kind: 'mountain', height: 1 }, cube: true },
            { offset: { q: 1, r: 0 }, require: { kind: 'water' } },
            { offset: { q: 0, r: 1 }, require: { kind: 'water' } }
        ],
        cubeCount: 3,
        pointTrack: [0, 3, 7, 12]
    },
    {
        id: 'M2',
        animalKey: 'harmonies_owl',
        habitat: 'mountain',
        animalName: 'Owl',
        cubeColor: 'gray',
        otherColor: 'blue',
        pattern: [
            { offset: { q: 0, r: 0 }, require: { kind: 'mountain', height: 1 }, cube: true },
            { offset: { q: -1, r: 0 }, require: { kind: 'water' } },
            { offset: { q: 1, r: 0 }, require: { kind: 'water' } }
        ],
        cubeCount: 3,
        pointTrack: [0, 3, 7, 12]
    },
    {
        id: 'M3',
        animalKey: 'harmonies_frog',
        habitat: 'mountain',
        animalName: 'Treefrog',
        cubeColor: 'gray',
        otherColor: 'yellow',
        pattern: [
            { offset: { q: 0, r: 0 }, require: { kind: 'mountain', height: 3 }, cube: true },
            { offset: { q: 1, r: 0 }, require: { kind: 'field' } }
        ],
        cubeCount: 2,
        pointTrack: [0, 5, 11]
    },
    {
        id: 'M4',
        animalKey: 'harmonies_bear',
        habitat: 'mountain',
        animalName: 'Grizzly',
        cubeColor: 'gray',
        otherColor: 'yellow',
        pattern: [
            { offset: { q: 0, r: 0 }, require: { kind: 'mountain', height: 1 }, cube: true },
            { offset: { q: 1, r: 0 }, require: { kind: 'mountain', height: 1 } },
            { offset: { q: 0, r: 1 }, require: { kind: 'field' } }
        ],
        cubeCount: 3,
        pointTrack: [0, 4, 8, 13]
    },
    {
        id: 'M5',
        animalKey: 'harmonies_deer',
        habitat: 'mountain',
        animalName: 'Ibex',
        cubeColor: 'gray',
        otherColor: 'yellow',
        pattern: [
            { offset: { q: 0, r: 0 }, require: { kind: 'mountain', height: 2 }, cube: true },
            { offset: { q: 1, r: 0 }, require: { kind: 'field' } }
        ],
        cubeCount: 3,
        pointTrack: [0, 3, 7, 12]
    },
    {
        id: 'M6',
        animalKey: 'harmonies_fish',
        habitat: 'mountain',
        animalName: 'Loach',
        cubeColor: 'gray',
        otherColor: 'green',
        pattern: [
            { offset: { q: 0, r: 0 }, require: { kind: 'mountain', height: 1 }, cube: true },
            { offset: { q: 1, r: 0 }, require: { kind: 'tree', height: 2 } }
        ],
        cubeCount: 4,
        pointTrack: [0, 2, 5, 8, 12]
    },
    {
        id: 'M7',
        animalKey: 'harmonies_rabbit',
        habitat: 'mountain',
        animalName: 'Pika',
        cubeColor: 'gray',
        otherColor: 'green',
        pattern: [
            { offset: { q: 0, r: 0 }, require: { kind: 'mountain', height: 1 }, cube: true },
            { offset: { q: 1, r: 0 }, require: { kind: 'tree', height: 1 } },
            { offset: { q: 0, r: 1 }, require: { kind: 'tree', height: 1 } }
        ],
        cubeCount: 3,
        pointTrack: [0, 3, 7, 12]
    },

    // ------------------------------------------------------------------------
    // Family 4: BUILDING (7 cards, cube on red, B1 - B7)
    // ------------------------------------------------------------------------
    {
        id: 'B1',
        animalKey: 'harmonies_fox',
        habitat: 'building',
        animalName: 'Fox',
        cubeColor: 'red',
        otherColor: 'blue',
        pattern: [
            { offset: { q: 0, r: 0 }, require: { kind: 'building' }, cube: true },
            { offset: { q: -1, r: 0 }, require: { kind: 'water' } },
            { offset: { q: 1, r: 0 }, require: { kind: 'water' } }
        ],
        cubeCount: 3,
        pointTrack: [0, 4, 8, 13]
    },
    {
        id: 'B2',
        animalKey: 'harmonies_owl',
        habitat: 'building',
        animalName: 'Owl',
        cubeColor: 'red',
        otherColor: 'yellow',
        pattern: [
            { offset: { q: 0, r: 0 }, require: { kind: 'building' }, cube: true },
            { offset: { q: 1, r: 0 }, require: { kind: 'field' } },
            { offset: { q: 2, r: 0 }, require: { kind: 'field' } }
        ],
        cubeCount: 3,
        pointTrack: [0, 4, 8, 14]
    },
    {
        id: 'B3',
        animalKey: 'harmonies_frog',
        habitat: 'building',
        animalName: 'Frog',
        cubeColor: 'red',
        otherColor: 'yellow',
        pattern: [
            { offset: { q: 0, r: 0 }, require: { kind: 'building' }, cube: true },
            { offset: { q: -1, r: 0 }, require: { kind: 'field' } },
            { offset: { q: 1, r: 0 }, require: { kind: 'field' } }
        ],
        cubeCount: 3,
        pointTrack: [0, 3, 7, 12]
    },
    {
        id: 'B4',
        animalKey: 'harmonies_bear',
        habitat: 'building',
        animalName: 'Bear',
        cubeColor: 'red',
        otherColor: 'green',
        pattern: [
            { offset: { q: 0, r: 0 }, require: { kind: 'building' }, cube: true },
            { offset: { q: 1, r: 0 }, require: { kind: 'tree', height: 2 } }
        ],
        cubeCount: 4,
        pointTrack: [0, 2, 5, 9, 14]
    },
    {
        id: 'B5',
        animalKey: 'harmonies_deer',
        habitat: 'building',
        animalName: 'Deer',
        cubeColor: 'red',
        otherColor: 'green',
        pattern: [
            { offset: { q: 0, r: 0 }, require: { kind: 'building' }, cube: true },
            { offset: { q: 1, r: 0 }, require: { kind: 'tree', height: 2 } },
            { offset: { q: 0, r: 1 }, require: { kind: 'tree', height: 2 } }
        ],
        cubeCount: 3,
        pointTrack: [0, 4, 8, 13]
    },
    {
        id: 'B6',
        animalKey: 'harmonies_fish',
        habitat: 'building',
        animalName: 'Carp',
        cubeColor: 'red',
        otherColor: 'blue',
        pattern: [
            { offset: { q: 0, r: 0 }, require: { kind: 'building' }, cube: true },
            { offset: { q: 1, r: 0 }, require: { kind: 'water' } }
        ],
        cubeCount: 4,
        pointTrack: [0, 2, 5, 8, 12]
    },
    {
        id: 'B7',
        animalKey: 'harmonies_rabbit',
        habitat: 'building',
        animalName: 'Bunny',
        cubeColor: 'red',
        otherColor: 'yellow',
        pattern: [
            { offset: { q: 0, r: 0 }, require: { kind: 'building' }, cube: true },
            { offset: { q: 1, r: 0 }, require: { kind: 'field' } }
        ],
        cubeCount: 3,
        pointTrack: [0, 3, 7, 11]
    },

    // ------------------------------------------------------------------------
    // Family 5: TREE (7 cards, cube on green, T1 - T7)
    // ------------------------------------------------------------------------
    {
        id: 'T1',
        animalKey: 'harmonies_fox',
        habitat: 'tree',
        animalName: 'Fox',
        cubeColor: 'green',
        otherColor: 'blue',
        pattern: [
            { offset: { q: 0, r: 0 }, require: { kind: 'tree', height: 3 }, cube: true },
            { offset: { q: -1, r: 0 }, require: { kind: 'water' } },
            { offset: { q: 1, r: 0 }, require: { kind: 'water' } }
        ],
        cubeCount: 2,
        pointTrack: [0, 6, 13]
    },
    {
        id: 'T2',
        animalKey: 'harmonies_owl',
        habitat: 'tree',
        animalName: 'Owl',
        cubeColor: 'green',
        otherColor: 'blue',
        pattern: [
            { offset: { q: 0, r: 0 }, require: { kind: 'tree', height: 2 }, cube: true },
            { offset: { q: 1, r: 0 }, require: { kind: 'water' } },
            { offset: { q: 0, r: 1 }, require: { kind: 'water' } }
        ],
        cubeCount: 3,
        pointTrack: [0, 3, 7, 12]
    },
    {
        id: 'T3',
        animalKey: 'harmonies_frog',
        habitat: 'tree',
        animalName: 'Treefrog',
        cubeColor: 'green',
        otherColor: 'yellow',
        pattern: [
            { offset: { q: 0, r: 0 }, require: { kind: 'tree', height: 2 }, cube: true },
            { offset: { q: 1, r: 0 }, require: { kind: 'field' } },
            { offset: { q: 0, r: 1 }, require: { kind: 'field' } }
        ],
        cubeCount: 3,
        pointTrack: [0, 3, 7, 12]
    },
    {
        id: 'T4',
        animalKey: 'harmonies_bear',
        habitat: 'tree',
        animalName: 'Bear',
        cubeColor: 'green',
        otherColor: 'yellow',
        pattern: [
            { offset: { q: 0, r: 0 }, require: { kind: 'tree', height: 2 }, cube: true },
            { offset: { q: 1, r: 0 }, require: { kind: 'field' } },
            { offset: { q: 0, r: 1 }, require: { kind: 'field' } },
            { offset: { q: 1, r: -1 }, require: { kind: 'field' } }
        ],
        cubeCount: 2,
        pointTrack: [0, 5, 12]
    },
    {
        id: 'T5',
        animalKey: 'harmonies_deer',
        habitat: 'tree',
        animalName: 'Deer',
        cubeColor: 'green',
        otherColor: 'gray',
        pattern: [
            { offset: { q: 0, r: 0 }, require: { kind: 'tree', height: 2 }, cube: true },
            { offset: { q: 1, r: 0 }, require: { kind: 'mountain', height: 2 } },
            { offset: { q: 0, r: 1 }, require: { kind: 'mountain', height: 1 } }
        ],
        cubeCount: 3,
        pointTrack: [0, 4, 8, 14]
    },
    {
        id: 'T6',
        animalKey: 'harmonies_fish',
        habitat: 'tree',
        animalName: 'Archerfish',
        cubeColor: 'green',
        otherColor: 'red',
        pattern: [
            { offset: { q: 0, r: 0 }, require: { kind: 'tree', height: 2 }, cube: true },
            { offset: { q: 1, r: 0 }, require: { kind: 'tree', height: 2 } },
            { offset: { q: 0, r: 1 }, require: { kind: 'building' } }
        ],
        cubeCount: 3,
        pointTrack: [0, 4, 8, 13]
    },
    {
        id: 'T7',
        animalKey: 'harmonies_rabbit',
        habitat: 'tree',
        animalName: 'Bunny',
        cubeColor: 'green',
        otherColor: 'green',
        pattern: [
            { offset: { q: 0, r: 0 }, require: { kind: 'tree', height: 2 }, cube: true },
            { offset: { q: 1, r: 0 }, require: { kind: 'tree', height: 2 } }
        ],
        cubeCount: 4,
        pointTrack: [0, 2, 5, 9, 14]
    }
];

// Helper to look up a spec by ID
export function getAnimalCardSpec(id: string): AnimalCardSpec | undefined {
    return ANIMAL_CARD_SPECS.find(c => c.id === id);
}

/**
 * Returns the clean single-word animal name for display on cards, titles, and modals.
 * e.g. "Plains Jackrabbit" -> "Jackrabbit", "Stream Trout" -> "Trout".
 */
export function getShortAnimalName(cardSpec: AnimalCardSpec | null | undefined): string {
    if (!cardSpec) return '';
    const spec = getAnimalCardSpec(cardSpec.id);
    if (spec && spec.animalName) {
        return spec.animalName;
    }
    const words = (cardSpec.animalName || '').trim().split(/\s+/);
    return words[words.length - 1] || cardSpec.animalName;
}

// ============================================================================
// 5. CardDefinition Builder for PlayingCard
// ============================================================================

export function getHarmoniesCardDefinition(
    cardSpec: AnimalCardSpec,
    cubesPlaced = 0
): CardDefinition {
    const palette = getHabitatPalette(cardSpec.habitat);
    const totalCubes = cardSpec.cubeCount;
    const currentScore = cardSpec.pointTrack[cubesPlaced] || 0;
    const isComplete = cubesPlaced >= totalCubes;
    const animalName = getShortAnimalName(cardSpec);

    return {
        id: cardSpec.id,
        name: animalName,
        widthMm: 63,
        heightMm: 88,
        borderRadiusMm: 5,
        palette: palette,
        borderWidth: 0, // Flat borderless design by default per DESIGN_GUIDE
        header: {
            title: animalName,
            subtitle: cardSpec.habitat.toUpperCase(),
            stats: isComplete ? `★ ${currentScore}pts` : `◈ ${cubesPlaced}/${totalCubes}`,
            background: 'secondary'
        },
        mainArt: {
            iconId: cardSpec.animalKey,
            showFrame: false,
            scaling: 1.05
        },
        scoreStrip: {
            position: 'right',
            orientation: 'vertical',
            align: 'center',
            cellSize: 3.2,
            gap: 0.38,
            cells: cardSpec.pointTrack.slice(1).map((pts, i) => {
                const cubeNum = i + 1;
                const isAchieved = (cubeNum <= cubesPlaced);
                return {
                    value: `${pts}`,
                    active: isAchieved,
                    muted: !isAchieved && cubesPlaced > 0,
                    color: isAchieved ? 'primary' : 'text'
                };
            })
        }
    };
}

export function getHarmoniesCardById(cardId: string, cubesPlaced = 0): CardDefinition {
    const spec = getAnimalCardSpec(cardId) || ANIMAL_CARD_SPECS[0];
    return getHarmoniesCardDefinition(spec, cubesPlaced);
}

export const HARMONIES_SAMPLE_CARD: CardDefinition = getHarmoniesCardById('W1', 1);

