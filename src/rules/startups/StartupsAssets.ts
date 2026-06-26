/**
 * StartupsAssets.ts
 * Custom palettes, geometric vector icons, and card generators for the Startups game.
 */

import { Palette, IconObject, CardDefinition } from '../../client/lib/card-renderer/types';
import { Company, COMPANY_COUNTS } from './StartupsGameState';

// ==========================================
// 1. Company Tailored Palettes
// ==========================================
export const STARTUPS_PALETTES: Record<Company, Palette> = {
    [Company.Giraffe]: {
        id: 'giraffeBeer',
        name: 'Giraffe Beer (Gold)',
        background: '#fffdf8',  // Warm cream/white
        border: '#f39c12',      // Giraffe gold
        primary: '#f39c12',     // Gold
        secondary: '#d35400',   // Earthy orange
        accent: '#2c3e50',      // Charcoal
        charcoal: '#2c3e50',
        text: '#2c3e50',
        panelBg: '#fdebd0',     // Soft gold tint
        tertiary: '#e67e22',
        success: '#2ecc71',
        danger: '#e74c3c'
    },
    [Company.Bowwow]: {
        id: 'bowwowGames',
        name: 'Bowwow Games (Mint)',
        background: '#f4fbf7',  // Soft mint white
        border: '#2ecc71',      // Bowwow mint green
        primary: '#2ecc71',     // Mint green
        secondary: '#27ae60',   // Forest green
        accent: '#e74c3c',      // Accent red
        charcoal: '#2c3e50',
        text: '#1a252f',
        panelBg: '#d4efdf',     // Soft green tint
        tertiary: '#f1c40f',
        success: '#2ecc71',
        danger: '#e74c3c'
    },
    [Company.Flamingo]: {
        id: 'flamingoSoft',
        name: 'Flamingo Soft (Red)',
        background: '#fff8f7',  // Soft peach white
        border: '#e74c3c',      // Flamingo red
        primary: '#e74c3c',     // Red
        secondary: '#ff8d85',   // Pastel pink/peach
        accent: '#3498db',      // Contrasting blue
        charcoal: '#2c3e50',
        text: '#1a252f',
        panelBg: '#f9d5d3',     // Soft red tint
        tertiary: '#9b59b6',
        success: '#2ecc71',
        danger: '#e74c3c'
    },
    [Company.Octo]: {
        id: 'octoCoffee',
        name: 'Octo Coffee (Purple)',
        background: '#fbf8fc',  // Soft lavender white
        border: '#9b59b6',      // Purple
        primary: '#9b59b6',     // Purple
        secondary: '#8e44ad',   // Deep purple
        accent: '#f1c40f',      // Contrast gold
        charcoal: '#2c3e50',
        text: '#1a252f',
        panelBg: '#ebdef0',     // Soft purple tint
        tertiary: '#34495e',
        success: '#2ecc71',
        danger: '#e74c3c'
    },
    [Company.Hippo]: {
        id: 'hippoPowertech',
        name: 'Hippo Powertech (Yellow)',
        background: '#fffef4',  // Light yellow-white
        border: '#d4ac0d',      // Ochre yellow border
        primary: '#f1c40f',     // Bright yellow
        secondary: '#e67e22',   // Power orange
        accent: '#2ecc71',      // Tech green
        charcoal: '#2c3e50',
        text: '#1a252f',
        panelBg: '#fef9e7',     // Soft yellow tint
        tertiary: '#e74c3c',
        success: '#2ecc71',
        danger: '#e74c3c'
    },
    [Company.Elephant]: {
        id: 'elephantMars',
        name: 'Elephant Mars Travel (Blue)',
        background: '#f6fafd',  // Soft sky white
        border: '#3498db',      // Blue
        primary: '#3498db',     // Blue
        secondary: '#2980b9',   // Deep blue
        accent: '#e74c3c',      // Mars red
        charcoal: '#2c3e50',
        text: '#1a252f',
        panelBg: '#d6eaf8',     // Soft blue tint
        tertiary: '#f1c40f',
        success: '#2ecc71',
        danger: '#e74c3c'
    }
};

// ==========================================
// 2. Custom Flat Vector Geometric Icons
// ==========================================
export const STARTUPS_ICONS: Record<string, IconObject> = {
    // 1. Giraffe Beer: stylized neck, head, spots, and beer mug
    [`companyIcon_${Company.Giraffe}`]: {
        id: `companyIcon_${Company.Giraffe}`,
        name: 'Giraffe Beer Icon',
        layers: [
            // Soft framing background circle
            { id: 'gir_bg_circle', type: 'circle', x: 50, y: 50, scaleX: 1.4, scaleY: 1.4, fill: 'primary', opacity: 0.15 },
            // Giraffe neck
            { id: 'gir_neck', type: 'arch', x: 35, y: 70, scaleX: 0.18, scaleY: 0.9, rotation: 10, fill: 'primary' },
            // Giraffe head
            { id: 'gir_head', type: 'arch', x: 45, y: 36, scaleX: 0.3, scaleY: 0.18, rotation: 40, fill: 'primary' },
            // Snout
            { id: 'gir_snout', type: 'circle', x: 52, y: 41, scaleX: 0.12, scaleY: 0.12, fill: 'secondary' },
            // Ear
            { id: 'gir_ear', type: 'triangle', x: 36, y: 28, scaleX: 0.08, scaleY: 0.18, rotation: -30, fill: 'primary' },
            // Horn
            { id: 'gir_horn', type: 'rectangle', x: 41, y: 25, scaleX: 0.04, scaleY: 0.12, rotation: 10, fill: 'accent' },
            { id: 'gir_horn_tip', type: 'circle', x: 43, y: 19, scaleX: 0.08, scaleY: 0.08, fill: 'accent' },
            // Spots on neck
            { id: 'gir_spot1', type: 'circle', x: 35, y: 60, scaleX: 0.07, scaleY: 0.07, fill: 'secondary' },
            { id: 'gir_spot2', type: 'circle', x: 38, y: 74, scaleX: 0.08, scaleY: 0.08, fill: 'secondary' },
            { id: 'gir_spot3', type: 'circle', x: 33, y: 85, scaleX: 0.06, scaleY: 0.06, fill: 'secondary' },
            // Eye
            { id: 'gir_eye', type: 'circle', x: 45, y: 34, scaleX: 0.04, scaleY: 0.04, fill: 'accent' },
            // Beer Mug
            { id: 'gir_beer_handle', type: 'rectangle', x: 78, y: 72, scaleX: 0.18, scaleY: 0.24, fill: 'charcoal' },
            { id: 'gir_beer_handle_inner', type: 'rectangle', x: 78, y: 72, scaleX: 0.08, scaleY: 0.14, fill: 'background' },
            { id: 'gir_beer_glass', type: 'rectangle', x: 68, y: 72, scaleX: 0.22, scaleY: 0.28, fill: 'charcoal' },
            { id: 'gir_beer_inside', type: 'rectangle', x: 68, y: 74, scaleX: 0.16, scaleY: 0.22, fill: 'primary' },
            { id: 'gir_beer_foam', type: 'rectangle', x: 68, y: 58, scaleX: 0.24, scaleY: 0.08, fill: 'background' },
            // Bubbles
            { id: 'gir_bubble1', type: 'circle', x: 66, y: 48, scaleX: 0.05, scaleY: 0.05, fill: 'background' },
            { id: 'gir_bubble2', type: 'circle', x: 73, y: 43, scaleX: 0.06, scaleY: 0.06, fill: 'background' }
        ]
    },

    // 2. Bowwow Games: dog-themed handheld console
    [`companyIcon_${Company.Bowwow}`]: {
        id: `companyIcon_${Company.Bowwow}`,
        name: 'Bowwow Games Icon',
        layers: [
            // Framing circle
            { id: 'bw_bg_circle', type: 'circle', x: 50, y: 50, scaleX: 1.4, scaleY: 1.4, fill: 'primary', opacity: 0.15 },
            // Dog ears on console sides
            { id: 'bw_ear_l', type: 'arch', x: 14, y: 32, scaleX: 0.18, scaleY: 0.45, rotation: -25, fill: 'secondary' },
            { id: 'bw_ear_r', type: 'arch', x: 86, y: 32, scaleX: 0.18, scaleY: 0.45, rotation: 25, fill: 'secondary' },
            // Console body
            { id: 'bw_console', type: 'rectangle', x: 50, y: 55, scaleX: 1.3, scaleY: 0.72, fill: 'primary' },
            // Screen frame and screen
            { id: 'bw_screen_frame', type: 'rectangle', x: 50, y: 50, scaleX: 0.78, scaleY: 0.48, fill: 'secondary' },
            { id: 'bw_screen', type: 'rectangle', x: 50, y: 50, scaleX: 0.7, scaleY: 0.42, fill: 'charcoal' },
            // D-Pad
            { id: 'bw_dpad_v', type: 'rectangle', x: 20, y: 55, scaleX: 0.04, scaleY: 0.12, fill: 'secondary' },
            { id: 'bw_dpad_h', type: 'rectangle', x: 20, y: 55, scaleX: 0.12, scaleY: 0.04, fill: 'secondary' },
            // Buttons
            { id: 'bw_btn1', type: 'circle', x: 80, y: 52, scaleX: 0.06, scaleY: 0.06, fill: 'accent' },
            { id: 'bw_btn2', type: 'circle', x: 74, y: 58, scaleX: 0.06, scaleY: 0.06, fill: 'accent' },
            // Dog face details overlaid at the bottom of the console
            { id: 'bw_snout', type: 'rectangle', x: 50, y: 74, scaleX: 0.22, scaleY: 0.14, fill: 'background' },
            { id: 'bw_nose', type: 'triangle', x: 50, y: 70, scaleX: 0.1, scaleY: 0.06, rotation: 180, fill: 'charcoal' },
            // Dog eyes on screen
            { id: 'bw_eye_l', type: 'circle', x: 42, y: 48, scaleX: 0.08, scaleY: 0.08, fill: 'primary' },
            { id: 'bw_eye_r', type: 'circle', x: 58, y: 48, scaleX: 0.08, scaleY: 0.08, fill: 'primary' },
            { id: 'bw_eye_l_shine', type: 'circle', x: 40, y: 46, scaleX: 0.03, scaleY: 0.03, fill: 'background' },
            { id: 'bw_eye_r_shine', type: 'circle', x: 56, y: 46, scaleX: 0.03, scaleY: 0.03, fill: 'background' }
        ]
    },

    // 3. Flamingo Soft: elegant flamingo silhouette and soft cloud background
    [`companyIcon_${Company.Flamingo}`]: {
        id: `companyIcon_${Company.Flamingo}`,
        name: 'Flamingo Soft Icon',
        layers: [
            // Framing circle
            { id: 'fl_bg_circle', type: 'circle', x: 50, y: 50, scaleX: 1.4, scaleY: 1.4, fill: 'primary', opacity: 0.15 },
            // Software cloud background details
            { id: 'fl_cloud1', type: 'circle', x: 74, y: 46, scaleX: 0.24, scaleY: 0.14, fill: 'accent', opacity: 0.35 },
            { id: 'fl_cloud2', type: 'circle', x: 22, y: 32, scaleX: 0.2, scaleY: 0.12, fill: 'accent', opacity: 0.35 },
            // Flamingo body
            { id: 'fl_body', type: 'semi-circle', x: 44, y: 68, scaleX: 0.65, scaleY: 0.45, rotation: 90, fill: 'primary' },
            // Flamingo neck
            { id: 'fl_neck_lower', type: 'rectangle', x: 36, y: 55, scaleX: 0.08, scaleY: 0.46, rotation: 8, fill: 'primary' },
            { id: 'fl_neck_upper', type: 'arch', x: 43, y: 34, scaleX: 0.2, scaleY: 0.28, rotation: -38, fill: 'primary' },
            // Flamingo head & beak
            { id: 'fl_head', type: 'circle', x: 53, y: 27, scaleX: 0.16, scaleY: 0.16, fill: 'primary' },
            { id: 'fl_beak_base', type: 'rectangle', x: 59, y: 29, scaleX: 0.09, scaleY: 0.09, fill: 'secondary' },
            { id: 'fl_beak_tip', type: 'triangle', x: 64, y: 34, scaleX: 0.08, scaleY: 0.08, rotation: 30, fill: 'charcoal' },
            // Flamingo wing
            { id: 'fl_wing', type: 'arch', x: 35, y: 68, scaleX: 0.38, scaleY: 0.22, rotation: -12, fill: 'secondary' },
            // Flamingo legs
            { id: 'fl_leg1', type: 'rectangle', x: 42, y: 86, scaleX: 0.02, scaleY: 0.3, fill: 'secondary' },
            { id: 'fl_leg2', type: 'rectangle', x: 48, y: 82, scaleX: 0.02, scaleY: 0.25, rotation: 45, fill: 'secondary' },
            // Eye
            { id: 'fl_eye', type: 'circle', x: 51, y: 25, scaleX: 0.03, scaleY: 0.03, fill: 'charcoal' }
        ]
    },

    // 4. Octo Coffee: octopus rising out of a neo-brutalist coffee cup
    [`companyIcon_${Company.Octo}`]: {
        id: `companyIcon_${Company.Octo}`,
        name: 'Octo Coffee Icon',
        layers: [
            // Framing circle
            { id: 'oc_bg_circle', type: 'circle', x: 50, y: 50, scaleX: 1.4, scaleY: 1.4, fill: 'primary', opacity: 0.15 },
            // Steam
            { id: 'oc_steam1', type: 'zig-zag', x: 42, y: 18, scaleX: 0.03, scaleY: 0.12, fill: 'accent', stroke: 'accent', strokeWidth: 3 },
            { id: 'oc_steam2', type: 'zig-zag', x: 58, y: 18, scaleX: 0.03, scaleY: 0.12, fill: 'accent', stroke: 'accent', strokeWidth: 3 },
            // Octopus head rising from cup
            { id: 'oc_octo_head', type: 'arch', x: 50, y: 40, scaleX: 0.44, scaleY: 0.44, fill: 'primary' },
            { id: 'oc_octo_eye_l', type: 'circle', x: 42, y: 40, scaleX: 0.08, scaleY: 0.08, fill: 'background' },
            { id: 'oc_octo_eye_r', type: 'circle', x: 58, y: 40, scaleX: 0.08, scaleY: 0.08, fill: 'background' },
            { id: 'oc_octo_pupil_l', type: 'circle', x: 42, y: 40, scaleX: 0.04, scaleY: 0.04, fill: 'charcoal' },
            { id: 'oc_octo_pupil_r', type: 'circle', x: 58, y: 40, scaleX: 0.04, scaleY: 0.04, fill: 'charcoal' },
            // Tentacles hanging over the rim
            { id: 'oc_tentacle1', type: 'arch', x: 32, y: 58, scaleX: 0.1, scaleY: 0.22, rotation: -20, fill: 'primary' },
            { id: 'oc_tentacle2', type: 'arch', x: 68, y: 58, scaleX: 0.1, scaleY: 0.22, rotation: 20, fill: 'primary' },
            { id: 'oc_tentacle3', type: 'arch', x: 50, y: 58, scaleX: 0.1, scaleY: 0.16, fill: 'primary' },
            // Coffee cup handle
            { id: 'oc_cup_handle', type: 'rectangle', x: 78, y: 72, scaleX: 0.18, scaleY: 0.24, fill: 'secondary' },
            { id: 'oc_cup_handle_inner', type: 'rectangle', x: 78, y: 72, scaleX: 0.08, scaleY: 0.14, fill: 'background' },
            // Coffee cup body
            { id: 'oc_cup_body', type: 'rectangle', x: 50, y: 72, scaleX: 0.6, scaleY: 0.42, fill: 'secondary' },
            { id: 'oc_cup_rim', type: 'rectangle', x: 50, y: 53, scaleX: 0.64, scaleY: 0.08, fill: 'charcoal' },
            { id: 'oc_cup_logo', type: 'circle', x: 50, y: 72, scaleX: 0.16, scaleY: 0.16, fill: 'background' }
        ]
    },

    // 5. Hippo Powertech: hippo face with industrial gear and glowing lightning bolt
    [`companyIcon_${Company.Hippo}`]: {
        id: `companyIcon_${Company.Hippo}`,
        name: 'Hippo Powertech Icon',
        layers: [
            // Framing circle
            { id: 'hp_bg_circle', type: 'circle', x: 50, y: 50, scaleX: 1.4, scaleY: 1.4, fill: 'primary', opacity: 0.15 },
            // Industrial background gear shadow
            { id: 'hp_gear_bg', type: 'circle', x: 50, y: 50, scaleX: 1.2, scaleY: 1.2, fill: 'secondary', opacity: 0.2 },
            // Hippo ears
            { id: 'hp_ear_l', type: 'circle', x: 28, y: 32, scaleX: 0.12, scaleY: 0.12, fill: 'primary' },
            { id: 'hp_ear_r', type: 'circle', x: 72, y: 32, scaleX: 0.12, scaleY: 0.12, fill: 'primary' },
            { id: 'hp_ear_in_l', type: 'circle', x: 28, y: 32, scaleX: 0.06, scaleY: 0.06, fill: 'secondary' },
            { id: 'hp_ear_in_r', type: 'circle', x: 72, y: 32, scaleX: 0.06, scaleY: 0.06, fill: 'secondary' },
            // Hippo face/head
            { id: 'hp_head', type: 'arch', x: 50, y: 44, scaleX: 0.52, scaleY: 0.32, fill: 'primary' },
            { id: 'hp_snout', type: 'rectangle', x: 50, y: 65, scaleX: 0.65, scaleY: 0.38, fill: 'primary' },
            // Nostrils
            { id: 'hp_nostril_l', type: 'circle', x: 40, y: 64, scaleX: 0.08, scaleY: 0.08, fill: 'charcoal' },
            { id: 'hp_nostril_r', type: 'circle', x: 60, y: 64, scaleX: 0.08, scaleY: 0.08, fill: 'charcoal' },
            // Eyes
            { id: 'hp_eye_l', type: 'circle', x: 38, y: 44, scaleX: 0.06, scaleY: 0.06, fill: 'charcoal' },
            { id: 'hp_eye_r', type: 'circle', x: 62, y: 44, scaleX: 0.06, scaleY: 0.06, fill: 'charcoal' },
            // Forehead glowing lightning bolt (composed of two rotated triangles)
            { id: 'hp_lightning1', type: 'triangle', x: 50, y: 36, scaleX: 0.12, scaleY: 0.28, rotation: 15, fill: 'accent' },
            { id: 'hp_lightning2', type: 'triangle', x: 48, y: 44, scaleX: 0.1, scaleY: 0.22, rotation: 195, fill: 'accent' }
        ]
    },

    // 6. Elephant Mars Travel: elephant astronaut wearing a glass dome space helmet in front of Mars
    [`companyIcon_${Company.Elephant}`]: {
        id: `companyIcon_${Company.Elephant}`,
        name: 'Elephant Mars Travel Icon',
        layers: [
            // Stars in background space
            { id: 'el_star1', type: 'circle', x: 12, y: 20, scaleX: 0.06, scaleY: 0.06, fill: 'background' },
            { id: 'el_star2', type: 'circle', x: 88, y: 25, scaleX: 0.04, scaleY: 0.04, fill: 'background' },
            // Red Mars planet planet sphere
            { id: 'el_mars', type: 'circle', x: 50, y: 50, scaleX: 1.4, scaleY: 1.4, fill: 'accent', opacity: 0.85 },
            { id: 'el_mars_shadow', type: 'semi-circle', x: 50, y: 50, scaleX: 1.4, scaleY: 1.4, rotation: 120, fill: 'charcoal', opacity: 0.25 },
            // Elephant ears
            { id: 'el_ear_l', type: 'circle', x: 24, y: 50, scaleX: 0.28, scaleY: 0.32, fill: 'primary' },
            { id: 'el_ear_r', type: 'circle', x: 76, y: 50, scaleX: 0.28, scaleY: 0.32, fill: 'primary' },
            { id: 'el_ear_in_l', type: 'circle', x: 26, y: 50, scaleX: 0.16, scaleY: 0.2, fill: 'secondary' },
            { id: 'el_ear_in_r', type: 'circle', x: 74, y: 50, scaleX: 0.16, scaleY: 0.2, fill: 'secondary' },
            // Elephant head
            { id: 'el_head', type: 'arch', x: 50, y: 54, scaleX: 0.42, scaleY: 0.36, fill: 'primary' },
            // Trunk
            { id: 'el_trunk_base', type: 'rectangle', x: 50, y: 70, scaleX: 0.12, scaleY: 0.3, fill: 'primary' },
            { id: 'el_trunk_tip', type: 'arch', x: 54, y: 84, scaleX: 0.14, scaleY: 0.08, rotation: 30, fill: 'primary' },
            // Eyes
            { id: 'el_eye_l', type: 'circle', x: 40, y: 48, scaleX: 0.05, scaleY: 0.05, fill: 'charcoal' },
            { id: 'el_eye_r', type: 'circle', x: 60, y: 48, scaleX: 0.05, scaleY: 0.05, fill: 'charcoal' },
            // Space Helmet Dome (large stroke circle + glass shine overlay)
            { id: 'el_helmet', type: 'circle', x: 50, y: 55, scaleX: 1.25, scaleY: 1.25, fill: 'none', stroke: 'background', strokeWidth: 3.5, opacity: 0.9 },
            { id: 'el_helmet_shine', type: 'quarter-circle', x: 30, y: 35, scaleX: 0.2, scaleY: 0.2, fill: 'background', opacity: 0.45 }
        ]
    },

    // 7. Startups Logo: abstract, professional geo design for card back
    startupsLogo: {
        id: 'startupsLogo',
        name: 'Startups Card Back Logo',
        layers: [
            // Dark base
            { id: 'sb_bg', type: 'rectangle', x: 50, y: 50, scaleX: 1.5, scaleY: 1.5, fill: 'charcoal' },
            // Repeating grid pattern in accent blue
            { id: 'sb_grid', type: 'grid', x: 50, y: 50, scaleX: 1.3, scaleY: 1.3, fill: '#3498db', patternScale: 1.2, opacity: 0.18 },
            // Concentric diamonds rotated 45 degrees
            { id: 'sb_diamond_outer', type: 'rectangle', x: 50, y: 50, scaleX: 0.9, scaleY: 0.9, rotation: 45, fill: 'secondary' },
            { id: 'sb_diamond_inner', type: 'rectangle', x: 50, y: 50, scaleX: 0.76, scaleY: 0.76, rotation: 45, fill: 'charcoal' },
            // Outer golden ring
            { id: 'sb_ring', type: 'circle', x: 50, y: 50, scaleX: 0.6, scaleY: 0.6, fill: 'none', stroke: 'secondary', strokeWidth: 4 },
            // Inner core star
            { id: 'sb_star_u', type: 'triangle', x: 50, y: 44, scaleX: 0.25, scaleY: 0.25, fill: 'primary' },
            { id: 'sb_star_d', type: 'triangle', x: 50, y: 56, scaleX: 0.25, scaleY: 0.25, rotation: 180, fill: 'primary' },
            // Central shining eye/bubble
            { id: 'sb_core_shine', type: 'circle', x: 50, y: 50, scaleX: 0.12, scaleY: 0.12, fill: 'background' }
        ]
    }
};

// ==========================================
// 3. Dynamic Card Definition Generator
// ==========================================
export function getCompanyCardDefinition(company: Company): CardDefinition {
    const totalCount = COMPANY_COUNTS[company];
    const companyShortName = company.split(' ')[0].toUpperCase();

    return {
        id: `startups_card_${company}`,
        name: company,
        widthMm: 63.5,
        heightMm: 88.9,
        borderRadiusMm: 4.5,
        palette: STARTUPS_PALETTES[company],
        borderWidth: 0.25,
        borderColor: 'border',
        header: {
            title: companyShortName,
        },
        mainArt: {
            iconId: `companyIcon_${company}`,
            showFrame: false,
            scaling: 1.35
        },
        overlay: {
            position: 'top-right',
            value: String(totalCount),
            showBorder: false,
            color: "secondary"
        }
    };
}
