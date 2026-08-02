/**
 * ProjectLData.ts — static content for Project L: the 9 piece shapes and the
 * 52 base-game puzzles (transcribed from the official "All Puzzles" sheet), plus
 * derived helpers (orientations, level lookups) and setup constants.
 *
 * Puzzle geometry, point values, decks and reward pieces were read directly off
 * the reference sheet and cross-checked: the 32/20 white/black split, and every
 * recess is tileable by the 9 shapes (there is always ≥1 solution).
 *
 * Colours come from the reference sheet's own palette (softened for a flat,
 * modern look), NOT the spec's "indicative" table — e.g. the T-tetromino is
 * pink and the L-tetromino is teal on the real cards.
 */

import { Cell, Orientation, freeOrientations } from '../../client/lib/polyomino/geometry';

export const BOARD_W = 5;
export const BOARD_H = 5;
export const BOARD_CELLS = BOARD_W * BOARD_H;

export type ShapeId =
    | 'mono' | 'domino' | 'tri_I' | 'tri_V'
    | 'tet_O' | 'tet_I' | 'tet_T' | 'tet_L' | 'tet_S';

export interface ShapeDef {
    id: ShapeId;
    level: 1 | 2 | 3 | 4;
    cells: Cell[];
    color: string;
    totalCopies: number; // 15 per shape in the base game
}

export const SHAPES: Record<ShapeId, ShapeDef> = {
    mono:   { id: 'mono',   level: 1, cells: [[0, 0]],                          color: '#EFC65C', totalCopies: 15 },
    domino: { id: 'domino', level: 2, cells: [[0, 0], [0, 1]],                  color: '#6BCB92', totalCopies: 15 },
    tri_I:  { id: 'tri_I',  level: 3, cells: [[0, 0], [0, 1], [0, 2]],          color: '#5AA9E6', totalCopies: 15 },
    tri_V:  { id: 'tri_V',  level: 3, cells: [[0, 0], [1, 0], [1, 1]],          color: '#F0A759', totalCopies: 15 },
    tet_O:  { id: 'tet_O',  level: 4, cells: [[0, 0], [0, 1], [1, 0], [1, 1]],  color: '#E5576F', totalCopies: 15 },
    tet_I:  { id: 'tet_I',  level: 4, cells: [[0, 0], [0, 1], [0, 2], [0, 3]],  color: '#9481D6', totalCopies: 15 },
    tet_T:  { id: 'tet_T',  level: 4, cells: [[0, 0], [0, 1], [0, 2], [1, 1]],  color: '#DB6FB0', totalCopies: 15 },
    tet_L:  { id: 'tet_L',  level: 4, cells: [[0, 0], [1, 0], [2, 0], [2, 1]],  color: '#46C2C2', totalCopies: 15 },
    tet_S:  { id: 'tet_S',  level: 4, cells: [[0, 1], [0, 2], [1, 0], [1, 1]],  color: '#F07A54', totalCopies: 15 }
};

/** Canonical order (level ascending) — drives supply-tray layout. */
export const SHAPE_IDS: ShapeId[] = [
    'mono', 'domino', 'tri_I', 'tri_V', 'tet_O', 'tet_I', 'tet_T', 'tet_L', 'tet_S'
];

export const MAX_LEVEL = 4;

export function shapesAtLevel(level: number): ShapeId[] {
    return SHAPE_IDS.filter(id => SHAPES[id].level === level);
}

// Cache orientation sets (computed once).
const ORIENTATION_CACHE: Partial<Record<ShapeId, Orientation[]>> = {};
export function orientationsFor(id: ShapeId): Orientation[] {
    if (!ORIENTATION_CACHE[id]) {
        ORIENTATION_CACHE[id] = freeOrientations(SHAPES[id].cells);
    }
    return ORIENTATION_CACHE[id]!;
}

// ----------------------------------------------------------------------------
// Puzzles (id 1..52, matching the All-Puzzles sheet)
// recessed = 25-bit mask over the 5x5 grid, bit = row*5 + col
// ----------------------------------------------------------------------------

export interface PuzzleDef {
    id: number;
    deck: 'white' | 'black';
    points: number;
    reward: ShapeId;
    recessed: number;
}

export const PUZZLES: PuzzleDef[] = [
    { id: 1,  deck: 'white', points: 2, reward: 'domino', recessed: 135616 },
    { id: 2,  deck: 'white', points: 2, reward: 'tri_V',  recessed: 2562112 },
    { id: 3,  deck: 'white', points: 2, reward: 'tri_I',  recessed: 465088 },
    { id: 4,  deck: 'white', points: 2, reward: 'tet_S',  recessed: 13054080 },
    { id: 5,  deck: 'white', points: 2, reward: 'tet_I',  recessed: 13056064 },
    { id: 6,  deck: 'white', points: 2, reward: 'tet_L',  recessed: 4667520 },
    { id: 7,  deck: 'white', points: 2, reward: 'tet_O',  recessed: 998400 },
    { id: 8,  deck: 'white', points: 2, reward: 'tet_T',  recessed: 408672 },
    { id: 9,  deck: 'white', points: 1, reward: 'mono',   recessed: 135168 },
    { id: 10, deck: 'white', points: 1, reward: 'domino', recessed: 135296 },
    { id: 11, deck: 'white', points: 1, reward: 'domino', recessed: 401408 },
    { id: 12, deck: 'white', points: 1, reward: 'domino', recessed: 145408 },
    { id: 13, deck: 'white', points: 1, reward: 'tri_V',  recessed: 274624 },
    { id: 14, deck: 'white', points: 1, reward: 'tri_V',  recessed: 468992 },
    { id: 15, deck: 'white', points: 1, reward: 'tri_I',  recessed: 31744 },
    { id: 16, deck: 'white', points: 1, reward: 'tri_I',  recessed: 464896 },
    { id: 17, deck: 'white', points: 1, reward: 'tet_S',  recessed: 497664 },
    { id: 18, deck: 'white', points: 1, reward: 'tet_I',  recessed: 469056 },
    { id: 19, deck: 'white', points: 1, reward: 'tet_L',  recessed: 464960 },
    { id: 20, deck: 'white', points: 1, reward: 'tet_O',  recessed: 14747712 },
    { id: 21, deck: 'white', points: 1, reward: 'tet_T',  recessed: 211200 },
    { id: 22, deck: 'white', points: 0, reward: 'domino', recessed: 135168 },
    { id: 23, deck: 'white', points: 0, reward: 'domino', recessed: 135168 },
    { id: 24, deck: 'white', points: 0, reward: 'tri_V',  recessed: 198656 },
    { id: 25, deck: 'white', points: 0, reward: 'tri_V',  recessed: 135296 },
    { id: 26, deck: 'white', points: 0, reward: 'tri_I',  recessed: 137216 },
    { id: 27, deck: 'white', points: 0, reward: 'tri_I',  recessed: 14336 },
    { id: 28, deck: 'white', points: 0, reward: 'tet_S',  recessed: 399360 },
    { id: 29, deck: 'white', points: 0, reward: 'tet_I',  recessed: 2164800 },
    { id: 30, deck: 'white', points: 0, reward: 'tet_L',  recessed: 198720 },
    { id: 31, deck: 'white', points: 0, reward: 'tet_O',  recessed: 202752 },
    { id: 32, deck: 'white', points: 0, reward: 'tet_T',  recessed: 462848 },
    { id: 33, deck: 'black', points: 5, reward: 'mono',   recessed: 7305708 },
    { id: 34, deck: 'black', points: 5, reward: 'mono',   recessed: 16742880 },
    { id: 35, deck: 'black', points: 5, reward: 'mono',   recessed: 33553536 },
    { id: 36, deck: 'black', points: 5, reward: 'mono',   recessed: 16251840 },
    { id: 37, deck: 'black', points: 5, reward: 'mono',   recessed: 15728064 },
    { id: 38, deck: 'black', points: 4, reward: 'mono',   recessed: 15153540 },
    { id: 39, deck: 'black', points: 4, reward: 'domino', recessed: 32979008 },
    { id: 40, deck: 'black', points: 4, reward: 'domino', recessed: 33009920 },
    { id: 41, deck: 'black', points: 4, reward: 'tri_V',  recessed: 33536000 },
    { id: 42, deck: 'black', points: 4, reward: 'tri_V',  recessed: 32970948 },
    { id: 43, deck: 'black', points: 4, reward: 'tri_I',  recessed: 30408192 },
    { id: 44, deck: 'black', points: 4, reward: 'tri_I',  recessed: 33518336 },
    { id: 45, deck: 'black', points: 3, reward: 'domino', recessed: 32735232 },
    { id: 46, deck: 'black', points: 3, reward: 'tri_V',  recessed: 15964160 },
    { id: 47, deck: 'black', points: 3, reward: 'tri_I',  recessed: 15145024 },
    { id: 48, deck: 'black', points: 3, reward: 'tet_S',  recessed: 15961120 },
    { id: 49, deck: 'black', points: 3, reward: 'tet_I',  recessed: 6764736 },
    { id: 50, deck: 'black', points: 3, reward: 'tet_L',  recessed: 15145152 },
    { id: 51, deck: 'black', points: 3, reward: 'tet_O',  recessed: 15145156 },
    { id: 52, deck: 'black', points: 3, reward: 'tet_T',  recessed: 15153536 }
];

export const PUZZLE_BY_ID: Record<number, PuzzleDef> = Object.fromEntries(
    PUZZLES.map(p => [p.id, p])
) as Record<number, PuzzleDef>;

export const WHITE_PUZZLE_IDS = PUZZLES.filter(p => p.deck === 'white').map(p => p.id);
export const BLACK_PUZZLE_IDS = PUZZLES.filter(p => p.deck === 'black').map(p => p.id);

// ----------------------------------------------------------------------------
// Setup constants
// ----------------------------------------------------------------------------

/** How many of the 20 black puzzles enter the deck, by player count. */
export const BLACK_COUNT_BY_PLAYERS: Record<number, number> = {
    2: 12, 3: 14, 4: 16, 5: 20, 6: 20
};

export const MAX_UNFINISHED_PUZZLES = 4;
export const ACTIONS_PER_TURN = 3;
export const ROW_SIZE = 4;

// ---- Speed contest variant ----
// Each player races, on an identical (seeded) deck, to empty their black draw
// pile. Cards score no points; the score is wall-clock time + a per-move penalty.
export const SPEED_WHITE_COUNT = 32;
export const SPEED_BLACK_COUNT = 12;
export const SPEED_MOVE_PENALTY_SECONDS = 6;

/** Each player starts with one Level-1 and one Level-2 piece. */
export const STARTING_SUPPLY: ShapeId[] = ['mono', 'domino'];

// ---- Solo variant ----
export type SoloDifficulty = 'normal' | 'hard' | 'unbeatable';
export const SOLO_WHITE_COUNT = 15;
export const SOLO_BLACK_COUNT = 10;
export const SOLO_GRID_SIZE = 9; // 3x3
export const SOLO_OPPONENT_SEED: Record<SoloDifficulty, number> = {
    normal: 6, hard: 3, unbeatable: 0
};
/** Initial locks above the three columns: 1 above col1, 2 above col2, 1 above col3. */
export const SOLO_INITIAL_LOCKS: [number, number, number] = [1, 2, 1];
/** Grid columns (0-based positions) — col c contains positions {c, c+3, c+6}. */
export const SOLO_COLUMNS: number[][] = [[0, 3, 6], [1, 4, 7], [2, 5, 8]];

export function emptySupply(): Record<ShapeId, number> {
    return {
        mono: 0, domino: 0, tri_I: 0, tri_V: 0,
        tet_O: 0, tet_I: 0, tet_T: 0, tet_L: 0, tet_S: 0
    };
}

export function fullReserve(): Record<ShapeId, number> {
    const r = emptySupply();
    for (const id of SHAPE_IDS) r[id] = SHAPES[id].totalCopies;
    return r;
}
