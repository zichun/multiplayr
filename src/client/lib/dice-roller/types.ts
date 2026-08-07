/**
 * types.ts — type definitions for the dice-roller library.
 *
 * A small, standalone, framework-agnostic (React) library for rendering dice with
 * custom faces and playing roll animations. Faces reuse the card-renderer `IconObject`
 * vector DSL, so any game already using card-renderer can share its iconography.
 */

import { IconObject } from '../card-renderer/types';

// Flat 2D tile, or a readable "2.5D" raised tile with an extruded edge + ground shadow.
export type DiceRenderStyle = 'flat' | 'iso';

/** One face of a die: a vector glyph and/or a short label, plus its colours. */
export interface DiceFace {
    id: string;
    icon?: IconObject;    // vector glyph, rendered via card-renderer's ExpressiveIcon
    label?: string;       // or a short text / number (used when no icon, or alongside)
    color: string;        // die body colour for this face (hex)
    glyphColor?: string;  // icon / label colour (hex); defaults to white
}

/** A map of faceId → face definition. */
export type DiceFaceset = Record<string, DiceFace>;

export interface DiceTheme {
    style?: DiceRenderStyle; // default 'flat'
    size?: number;           // px, default 46
    radius?: number;         // corner radius px; default ≈ size * 0.24
    borderColor?: string;    // optional outline colour
    borderWidth?: number;    // px, default 0
    depth?: number;          // iso extrusion depth px; default ≈ size * 0.16
    glyphScale?: number;     // glyph size as a fraction of the die; default 0.62
}

// 'in-place'  — the die tumbles in its own slot, then settles.
// 'overlay'   — dice tumble on a full-viewport overlay (independent of the container),
//               reveal, then fly into their slots.
export type RollMode = 'in-place' | 'overlay';

export interface RollAnimation {
    enabled?: boolean;      // default true; false renders results immediately
    mode?: RollMode;        // default 'in-place'
    duration?: number;      // ms of the tumble, default 700
    stagger?: number;       // ms delay between successive dice in a pool, default 55
    tumbleInterval?: number;// ms between random face flips while tumbling, default 70
}

/** One die within a pool. `id` is stable and drives keying + change detection. */
export interface DieDatum {
    id: string;
    faceId: string; // the resulting face to display once settled
}

export const DEFAULT_ANIMATION: Required<RollAnimation> = {
    enabled: true, mode: 'in-place', duration: 700, stagger: 55, tumbleInterval: 70
};

export const DEFAULT_THEME: Required<Omit<DiceTheme, 'borderColor'>> & { borderColor?: string } = {
    style: 'flat', size: 46, radius: 11, borderColor: undefined, borderWidth: 0, depth: 7, glyphScale: 0.62
};
