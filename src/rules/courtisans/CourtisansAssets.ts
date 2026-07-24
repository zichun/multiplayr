/**
 * CourtisansAssets.ts
 * Flat, geometric, "light-but-royal" iconography for "Courtisans".
 *
 * Each of the six families is a heraldic MEDALLION crest drawn in a 0-100 viewBox
 * with the negative-space recipe used across the platform (Skull discs, Splendor
 * Duel coins): a solid coloured seal with the family animal knocked OUT of it in
 * warm ivory. Depth ("2.5D on a flat design") comes purely from tones, never from
 * blurred shadows:
 *   - a darker family tone forms the outer RIM (the bevel/shadow of an embossed seal)
 *   - an ivory SEAL RING separates rim from face (the classic wax-seal look)
 *   - the body tone is the lit FACE the animal is punched from
 *   - a single darker-tone accent inside each silhouette (a fold, a pupil, an
 *     antler shade) gives the glyph its raised, carved feel
 *
 * The six animals are deliberately distinct in silhouette so a crest reads at a
 * glance even at token size: butterfly (4 lobes), toad (wide + bulging eyes),
 * nightingale (perched songbird), hare (tall ears), stag (branching antlers),
 * carp (fish + fanned tail).
 *
 * Colours flow from each family's Palette, so the SAME crest geometry could be
 * retinted, and role glyphs / the face-down back reuse the same tonal language.
 */

import { Palette, IconObject, IconLayer } from '../../client/lib/card-renderer/types';

// ---------------------------------------------------------------------------
// Shared tokens
// ---------------------------------------------------------------------------

export const IVORY = '#f7f4ec';      // warm ivory — the negative-space glyph colour
export const PARCHMENT = '#fbf9f3';  // page / card background
export const INK = '#3a3a4a';        // neutral royal ink for text

export interface FamilyTheme {
    family: string;
    label: string;
    body: string;    // the lit medallion face
    light: string;   // highlight tone
    dark: string;    // rim / carved-shadow tone
    accent: string;  // small heraldic accent (a gilt touch)
}

// Soft, muted, courtly colours (Splendor-Duel-flat, never neon).
export const FAMILY_THEMES: Record<string, FamilyTheme> = {
    butterfly:   { family: 'butterfly',   label: 'Butterfly',   body: '#8b93a6', light: '#a8afbe', dark: '#6d7688', accent: '#d9c7a0' },
    toad:        { family: 'toad',        label: 'Toad',        body: '#7ba75c', light: '#96bd7b', dark: '#5d8544', accent: '#e6d59a' },
    nightingale: { family: 'nightingale', label: 'Nightingale', body: '#cf6d6d', light: '#dd8c8c', dark: '#ad5252', accent: '#f0cf9a' },
    hare:        { family: 'hare',        label: 'Hare',        body: '#d9ab4b', light: '#e7c274', dark: '#b78c30', accent: '#6d5a2c' },
    stag:        { family: 'stag',        label: 'Stag',        body: '#3f7a5c', light: '#579173', dark: '#2d5c45', accent: '#dcc489' },
    carp:        { family: 'carp',        label: 'Carp',        body: '#5b93c9', light: '#7dabd7', dark: '#4576ab', accent: '#e7d29a' }
};

// A full Palette (every key the renderer needs) tuned for one family crest, so
// glyph 'background' = ivory, rim/shadow 'charcoal' = the dark tone, face
// 'primary' = the body tone, 'accent' = the gilt touch.
export function familyPalette(theme: FamilyTheme): Palette {
    return {
        id: `courtisans_${theme.family}`,
        name: theme.label,
        background: IVORY,
        border: theme.dark,
        primary: theme.body,
        secondary: theme.light,
        accent: theme.accent,
        charcoal: theme.dark,
        text: INK,
        panelBg: theme.body,
        tertiary: theme.light,
        success: '#57a877',
        danger: '#d16a5f'
    };
}

export const FAMILY_PALETTES: Record<string, Palette> = Object.fromEntries(
    Object.values(FAMILY_THEMES).map(t => [t.family, familyPalette(t)])
) as Record<string, Palette>;

// ---------------------------------------------------------------------------
// Medallion frame (shared by every crest)
// ---------------------------------------------------------------------------

// rim (dark) → ivory seal ring → lit body face. The animal glyph is punched on top.
function medallion(glyph: IconLayer[]): IconLayer[] {
    return [
        { id: 'rim',  type: 'circle', x: 50, y: 50, scaleX: 1.98, scaleY: 1.98, fill: 'charcoal' },
        { id: 'ring', type: 'circle', x: 50, y: 50, scaleX: 1.78, scaleY: 1.78, fill: 'background' },
        { id: 'face', type: 'circle', x: 50, y: 50, scaleX: 1.62, scaleY: 1.62, fill: 'primary' },
        ...glyph
    ];
}

function crest(family: string, glyph: IconLayer[]): IconObject {
    return { id: `crest_${family}`, name: FAMILY_THEMES[family].label, layers: medallion(glyph) };
}

// convenience for a knocked-out (ivory) silhouette piece
const cut = (id: string, type: any, x: number, y: number, sx: number, sy: number, rot = 0): IconLayer =>
    ({ id, type, x, y, scaleX: sx, scaleY: sy, rotation: rot, fill: 'background' });
// convenience for a carved-shadow (dark tone) detail piece
const shade = (id: string, type: any, x: number, y: number, sx: number, sy: number, rot = 0, opacity = 1): IconLayer =>
    ({ id, type, x, y, scaleX: sx, scaleY: sy, rotation: rot, fill: 'charcoal', opacity });

// ---------------------------------------------------------------------------
// The six crests
// ---------------------------------------------------------------------------

export const CREST_ICONS: Record<string, IconObject> = {

    // BUTTERFLY — four wing lobes about a slim body, antennae, eye-spots for depth.
    butterfly: crest('butterfly', [
        cut('body', 'rectangle', 50, 50, 0.07, 0.62),
        cut('head', 'circle', 50, 30, 0.16, 0.16),
        cut('ant_l', 'rectangle', 42, 24, 0.05, 0.22, -28),
        cut('ant_r', 'rectangle', 58, 24, 0.05, 0.22, 28),
        cut('wing_ul', 'circle', 35, 40, 0.62, 0.62),
        cut('wing_ur', 'circle', 65, 40, 0.62, 0.62),
        cut('wing_ll', 'circle', 39, 63, 0.48, 0.48),
        cut('wing_lr', 'circle', 61, 63, 0.48, 0.48),
        shade('spot_ul', 'circle', 35, 40, 0.22, 0.22),
        shade('spot_ur', 'circle', 65, 40, 0.22, 0.22),
        shade('spot_ll', 'circle', 39, 63, 0.15, 0.15),
        shade('spot_lr', 'circle', 61, 63, 0.15, 0.15)
    ]),

    // TOAD — wide crouched body, two bulging eyes above, dark pupils + a wide mouth.
    toad: crest('toad', [
        cut('body', 'circle', 50, 60, 1.32, 0.98),
        cut('eye_l', 'circle', 36, 40, 0.56, 0.56),
        cut('eye_r', 'circle', 64, 40, 0.56, 0.56),
        shade('pupil_l', 'circle', 36, 40, 0.24, 0.24),
        shade('pupil_r', 'circle', 64, 40, 0.24, 0.24),
        shade('mouth', 'rectangle', 50, 66, 0.62, 0.045),
        shade('belly', 'semi-circle', 50, 62, 0.7, 0.4, 0, 0.28),
        cut('foot_l', 'circle', 30, 74, 0.2, 0.2),
        cut('foot_r', 'circle', 70, 74, 0.2, 0.2)
    ]),

    // NIGHTINGALE — perched songbird: round breast, tilted head, open beak, swept tail.
    nightingale: crest('nightingale', [
        cut('breast', 'circle', 45, 56, 0.92, 0.92),
        cut('head', 'circle', 61, 40, 0.5, 0.5),
        cut('beak', 'triangle', 73, 40, 0.26, 0.24, 96),
        cut('tail', 'rectangle', 29, 64, 0.5, 0.16, 38),
        shade('wing', 'semi-circle', 44, 56, 0.62, 0.5, 20, 0.32),
        shade('eye', 'circle', 63, 38, 0.12, 0.12),
        shade('song', 'circle', 82, 30, 0.1, 0.1, 0, 0.5)
    ]),

    // HARE — tall alert ears, round head, small muzzle; inner-ear shade for depth.
    hare: crest('hare', [
        cut('head', 'circle', 50, 60, 0.82, 0.82),
        cut('ear_l', 'circle', 41, 33, 0.22, 0.9, -10),
        cut('ear_r', 'circle', 59, 33, 0.22, 0.9, 10),
        shade('inner_l', 'circle', 41, 33, 0.09, 0.62, -10, 0.5),
        shade('inner_r', 'circle', 59, 33, 0.09, 0.62, 10, 0.5),
        shade('eye_l', 'circle', 43, 58, 0.1, 0.1),
        shade('eye_r', 'circle', 57, 58, 0.1, 0.1),
        shade('nose', 'triangle', 50, 66, 0.14, 0.12, 180)
    ]),

    // STAG — the branching antlers are the signature; long face, ears, dark eyes.
    stag: crest('stag', [
        cut('face', 'circle', 50, 62, 0.5, 0.72),
        cut('muzzle', 'circle', 50, 74, 0.3, 0.24),
        cut('ear_l', 'circle', 36, 52, 0.24, 0.16, -30),
        cut('ear_r', 'circle', 64, 52, 0.24, 0.16, 30),
        // antler beams
        cut('beam_l', 'rectangle', 40, 34, 0.07, 0.5, -18),
        cut('beam_r', 'rectangle', 60, 34, 0.07, 0.5, 18),
        // antler tines
        cut('tine_l1', 'rectangle', 31, 30, 0.06, 0.26, -62),
        cut('tine_l2', 'rectangle', 37, 20, 0.06, 0.24, -22),
        cut('tine_r1', 'rectangle', 69, 30, 0.06, 0.26, 62),
        cut('tine_r2', 'rectangle', 63, 20, 0.06, 0.24, 22),
        shade('eye_l', 'circle', 44, 60, 0.1, 0.11),
        shade('eye_r', 'circle', 56, 60, 0.1, 0.11),
        shade('snout', 'circle', 50, 77, 0.09, 0.08)
    ]),

    // CARP — horizontal fish body, fanned tail, top fin, dark gill arc + eye.
    carp: crest('carp', [
        cut('body', 'circle', 47, 53, 1.12, 0.72),
        cut('tail', 'triangle', 76, 53, 0.5, 0.66, 270),
        cut('fin_top', 'triangle', 46, 37, 0.42, 0.34),
        cut('fin_low', 'triangle', 44, 68, 0.3, 0.22, 180),
        shade('gill', 'semi-circle', 38, 53, 0.42, 0.5, 90, 0.34),
        shade('eye', 'circle', 30, 50, 0.14, 0.14),
        shade('scale', 'semi-circle', 56, 53, 0.44, 0.44, 90, 0.22)
    ])
};

// ---------------------------------------------------------------------------
// Role glyphs (small heraldic marks) + the face-down back
// ---------------------------------------------------------------------------

// A neutral slate palette for role glyphs and the card back (family-agnostic).
export const SLATE_THEME: FamilyTheme = { family: 'slate', label: 'Court', body: '#6b7488', light: '#8a92a4', dark: '#515a6e', accent: '#cdb884' };
export const SLATE_PALETTE = familyPalette(SLATE_THEME);
export const GOLD = '#caa24a';

// Role glyphs are drawn as ivory-on-face marks so they can sit as a small coin
// beside a crest, or be recoloured. Each is authored to read at ~16px.
export const ROLE_ICONS: Record<string, IconObject> = {

    // NOBLE — a three-point crown (counts double).
    noble: {
        id: 'role_noble', name: 'Noble',
        layers: [
            { id: 'base', type: 'rectangle', x: 50, y: 60, scaleX: 0.72, scaleY: 0.18, fill: 'background' },
            { id: 'p1', type: 'triangle', x: 27, y: 46, scaleX: 0.26, scaleY: 0.46, fill: 'background' },
            { id: 'p2', type: 'triangle', x: 50, y: 40, scaleX: 0.3, scaleY: 0.58, fill: 'background' },
            { id: 'p3', type: 'triangle', x: 73, y: 46, scaleX: 0.26, scaleY: 0.46, fill: 'background' },
            { id: 'gem', type: 'circle', x: 50, y: 58, scaleX: 0.13, scaleY: 0.13, fill: 'accent' }
        ]
    },

    // GUARD — an oval shield (immune; unremovable).
    guard: {
        id: 'role_guard', name: 'Guard',
        layers: [
            { id: 'body', type: 'circle', x: 50, y: 46, scaleX: 0.62, scaleY: 0.8, fill: 'background' },
            { id: 'tip', type: 'triangle', x: 50, y: 70, scaleX: 0.42, scaleY: 0.34, rotation: 180, fill: 'background' },
            { id: 'cross_v', type: 'rectangle', x: 50, y: 48, scaleX: 0.08, scaleY: 0.5, fill: 'charcoal', opacity: 0.38 },
            { id: 'cross_h', type: 'rectangle', x: 50, y: 40, scaleX: 0.38, scaleY: 0.08, fill: 'charcoal', opacity: 0.38 }
        ]
    },

    // SPY — a domino mask (face down / hidden identity).
    spy: {
        id: 'role_spy', name: 'Spy',
        layers: [
            { id: 'band', type: 'rectangle', x: 50, y: 48, scaleX: 0.78, scaleY: 0.34, rotation: -6, fill: 'background' },
            { id: 'eye_l', type: 'circle', x: 38, y: 47, scaleX: 0.2, scaleY: 0.16, fill: 'charcoal' },
            { id: 'eye_r', type: 'circle', x: 62, y: 49, scaleX: 0.2, scaleY: 0.16, fill: 'charcoal' }
        ]
    },

    // ASSASSIN — a dagger.
    assassin: {
        id: 'role_assassin', name: 'Assassin',
        layers: [
            { id: 'blade', type: 'triangle', x: 50, y: 40, scaleX: 0.2, scaleY: 0.7, fill: 'background' },
            { id: 'guard', type: 'rectangle', x: 50, y: 62, scaleX: 0.46, scaleY: 0.08, fill: 'background' },
            { id: 'grip', type: 'rectangle', x: 50, y: 72, scaleX: 0.1, scaleY: 0.22, fill: 'background' },
            { id: 'pommel', type: 'circle', x: 50, y: 80, scaleX: 0.16, scaleY: 0.16, fill: 'accent' }
        ]
    },

    // PLAIN — a simple courtly quatrefoil (no effect).
    plain: {
        id: 'role_plain', name: 'Courtier',
        layers: [
            { id: 'n', type: 'circle', x: 50, y: 38, scaleX: 0.34, scaleY: 0.34, fill: 'background' },
            { id: 's', type: 'circle', x: 50, y: 62, scaleX: 0.34, scaleY: 0.34, fill: 'background' },
            { id: 'e', type: 'circle', x: 62, y: 50, scaleX: 0.34, scaleY: 0.34, fill: 'background' },
            { id: 'w', type: 'circle', x: 38, y: 50, scaleX: 0.34, scaleY: 0.34, fill: 'background' },
            { id: 'c', type: 'circle', x: 50, y: 50, scaleX: 0.28, scaleY: 0.28, fill: 'accent' }
        ]
    }
};

// The face-down back: a neutral slate seal with a fleur-de-lis silhouette — royal,
// but leaks nothing about family or role (used for spies + hidden hands).
export const BACK_ICON: IconObject = {
    id: 'courtisans_back', name: 'Court Seal',
    layers: [
        ...medallion([
            { id: 'fleur_stem', type: 'rectangle', x: 50, y: 56, scaleX: 0.08, scaleY: 0.5, fill: 'background' },
            { id: 'fleur_top', type: 'triangle', x: 50, y: 34, scaleX: 0.3, scaleY: 0.5, fill: 'background' },
            { id: 'fleur_l', type: 'arch', x: 38, y: 52, scaleX: 0.3, scaleY: 0.5, rotation: -32, fill: 'background' },
            { id: 'fleur_r', type: 'arch', x: 62, y: 52, scaleX: 0.3, scaleY: 0.5, rotation: 32, fill: 'background' },
            { id: 'band', type: 'rectangle', x: 50, y: 60, scaleX: 0.44, scaleY: 0.08, fill: 'background' }
        ])
    ]
};

// ---------------------------------------------------------------------------
// Icon map export (for the inspector + customIcons) and helpers
// ---------------------------------------------------------------------------

export const COURTISANS_ICONS: Record<string, IconObject> = {
    ...CREST_ICONS,
    role_noble: ROLE_ICONS.noble,
    role_guard: ROLE_ICONS.guard,
    role_spy: ROLE_ICONS.spy,
    role_assassin: ROLE_ICONS.assassin,
    role_plain: ROLE_ICONS.plain,
    courtisans_back: BACK_ICON
};

export const ROLE_LABELS: Record<string, string> = {
    noble: 'Noble',
    guard: 'Guard',
    spy: 'Spy',
    assassin: 'Assassin',
    plain: 'Courtier'
};

export const FAMILY_LABELS: Record<string, string> = Object.fromEntries(
    Object.values(FAMILY_THEMES).map(t => [t.family, t.label])
);
