/**
 * NightZooData.ts — pure, framework-independent static data for Night at the Zoo.
 *
 * Everything here is fixed reference data: the six animal definitions, the three
 * terrains and seven foods, the 75 Action tiles (the exact drafted deck), the
 * Bonus-tile supply, the printed 5×5 player-board configuration, the food
 * set-collection table, and the small helpers the engine and views share.
 *
 * The per-cell printed board config (§4.2 / §8.4 of the spec) is normally
 * transcribed from a high-res scan of the physical board. No scan was supplied,
 * so BOARD_CONFIG below is a balanced, symmetric designed approximation — it is
 * fixed and identical for every player, exactly as the physical board would be.
 */

// ============================================================================
// Terrains & foods
// ============================================================================

export type Terrain = 'grass' | 'rocks' | 'sand';
export const TERRAINS: Terrain[] = ['grass', 'rocks', 'sand'];

export type Food = 'meat' | 'fish' | 'carrot' | 'apple' | 'banana' | 'leaves' | 'honey';
export const FOODS: Food[] = ['meat', 'fish', 'carrot', 'apple', 'banana', 'leaves', 'honey'];

// Best-set-of-distinct-foods → VP (index by distinct count; 0/1 score nothing).
export const FOOD_SET_VP: Record<number, number> = { 2: 6, 3: 8, 4: 11, 5: 16, 6: 22, 7: 30 };

// ============================================================================
// Action symbols
// ============================================================================

export type ActionSymbol = 'move1' | 'move2' | 'discover' | 'bonus' | 'vp1' | 'vp2';

/** Human-readable label for an action symbol. */
export const ACTION_LABELS: Record<ActionSymbol, string> = {
    move1: 'Move 1',
    move2: 'Move 2',
    discover: 'Discover',
    bonus: 'Take Bonus',
    vp1: '+1 VP',
    vp2: '+2 VP'
};

// ============================================================================
// Animals
// ============================================================================

export type AnimalType = 'penguin' | 'cheetah' | 'wolf' | 'snake' | 'butterfly' | 'sloth';
export const ANIMAL_TYPES: AnimalType[] = ['penguin', 'cheetah', 'wolf', 'snake', 'butterfly', 'sloth'];

export interface AnimalDef {
    type: AnimalType;
    name: string;
    difficulty: number;         // ☾ moons — used only at setup (≥6 total across the 3)
    color: string;              // primary illustration colour
    /** flat Zoo VP per figure, or null when scoring is special (wolf / butterfly). */
    zooVP: number | null;
    /** per-figure mutable state keys. */
    state: ('heading' | 'pollen' | 'awake')[];
    blurb: string;
}

export const ANIMALS: Record<AnimalType, AnimalDef> = {
    penguin: {
        type: 'penguin', name: 'Penguin', difficulty: 1, color: '#3f5170', zooVP: 5, state: [],
        blurb: 'Slides in a straight line to the furthest walkable tile.'
    },
    cheetah: {
        type: 'cheetah', name: 'Cheetah', difficulty: 2, color: '#e0a02e', zooVP: 6, state: [],
        blurb: 'Normal 1-tile move — but +1 extra tile on a discard move.'
    },
    wolf: {
        type: 'wolf', name: 'Wolf', difficulty: 2, color: '#8a94a6', zooVP: null, state: [],
        blurb: 'Standard 1-tile move. Scores as a set: 1→7, 2→16, 3→27.'
    },
    snake: {
        type: 'snake', name: 'Snake', difficulty: 2, color: '#5cb87f', zooVP: 10, state: ['heading'],
        blurb: 'Moves 1 tile forward only; turning costs a movement point.'
    },
    butterfly: {
        type: 'butterfly', name: 'Butterfly', difficulty: 3, color: '#c07ac0', zooVP: null, state: ['pollen'],
        blurb: 'Standard move; gains pollen on discard moves. Scores by pollen.'
    },
    sloth: {
        type: 'sloth', name: 'Sloth', difficulty: 4, color: '#b79b82', zooVP: 15, state: ['awake'],
        blurb: 'Awake → move then sleep. Asleep → wake instead of moving.'
    }
};

// Wolf set-collection scoring (index by count of wolves in Zoo).
export const WOLF_SET_VP: Record<number, number> = { 0: 0, 1: 7, 2: 16, 3: 27 };
// Butterfly scoring by pollen on the figure in the Zoo.
export const BUTTERFLY_POLLEN_VP: Record<number, number> = { 0: 3, 1: 5, 2: 7, 3: 9, 4: 11 };
export const MAX_POLLEN = 4;

export const FIGURES_PER_TYPE = 3;      // each player gets 3 of each active type
export const ACTIVE_TYPES = 3;          // 3 of the 6 animals are in play per game
export const MIN_SETUP_MOONS = 6;

/** Zoo VP a single arrived figure is worth (context needed for wolf/butterfly). */
export function figureZooVP(type: AnimalType, opts: { wolfCount?: number; pollen?: number }): number {
    if (type === 'wolf') return 0; // scored as a set separately
    if (type === 'butterfly') return BUTTERFLY_POLLEN_VP[opts.pollen ?? 0] ?? 3;
    return ANIMALS[type].zooVP ?? 0;
}

// ============================================================================
// Board geometry (the private 5×5 Neighborhood)
// ============================================================================

export const GRID = 5;
export const ZOO: [number, number] = [2, 2];
export type Dir = 'N' | 'E' | 'S' | 'W';

/**
 * The 9 entrances, transcribed from the physical board. Each sits **outside** the
 * 5×5 board (an external coordinate just past an edge), carries a fixed terrain,
 * and feeds into one adjacent board `cell`. A discovered animal appears on an
 * entrance and can only move inward onto its adjacent cell (once that cell has a
 * tile); animals never move back out onto an entrance. `inward` is the direction
 * into the board (a Snake starts facing inward).
 */
export interface EntranceDef {
    pos: [number, number];   // external coordinate, just outside the board
    cell: [number, number];  // the adjacent board cell it feeds into
    terrain: Terrain;
    inward: Dir;
    side: 'N' | 'W' | 'E' | 'S';
}
export const ENTRANCES: EntranceDef[] = [
    { pos: [-1, 0], cell: [0, 0], terrain: 'sand', inward: 'S', side: 'N' },
    { pos: [-1, 2], cell: [0, 2], terrain: 'grass', inward: 'S', side: 'N' },
    { pos: [-1, 4], cell: [0, 4], terrain: 'rocks', inward: 'S', side: 'N' },
    { pos: [1, -1], cell: [1, 0], terrain: 'sand', inward: 'E', side: 'W' },
    { pos: [3, -1], cell: [3, 0], terrain: 'grass', inward: 'E', side: 'W' },
    { pos: [1, 5], cell: [1, 4], terrain: 'grass', inward: 'W', side: 'E' },
    { pos: [3, 5], cell: [3, 4], terrain: 'rocks', inward: 'W', side: 'E' },
    { pos: [5, 1], cell: [4, 1], terrain: 'rocks', inward: 'N', side: 'S' },
    { pos: [5, 3], cell: [4, 3], terrain: 'sand', inward: 'N', side: 'S' }
];
const ekey = (r: number, c: number) => `${r},${c}`;
const ENTRANCE_MAP: Record<string, EntranceDef> = ENTRANCES.reduce((m, e) => { m[ekey(e.pos[0], e.pos[1])] = e; return m; }, {} as Record<string, EntranceDef>);
/** Look up an entrance by its EXTERNAL coordinate. */
export function entranceAt(r: number, c: number): EntranceDef | null { return ENTRANCE_MAP[ekey(r, c)] || null; }
export function isEntrance(r: number, c: number): boolean { return !!ENTRANCE_MAP[ekey(r, c)]; }
/** Entrances grouped by terrain (for picking distinct-terrain starting entrances). */
export const ENTRANCES_BY_TERRAIN: Record<Terrain, EntranceDef[]> = ENTRANCES.reduce((m, e) => {
    (m[e.terrain] = m[e.terrain] || []).push(e); return m;
}, {} as Record<Terrain, EntranceDef[]>);

export type PrintedAction =
    | { kind: 'move'; amount: 1 | 2 }
    | { kind: 'discover' }
    | { kind: 'bonus' }
    | { kind: 'vp'; amount: number };

export type CellCondition =
    | { type: 'symbol'; requires: ActionSymbol }
    | { type: 'terrain'; requires: Terrain }
    | { type: 'paired'; group: string; reward: 'vp5' | 'move2' | 'bonus2' };

export interface CellConfig {
    printedActions: PrintedAction[];
    condition: CellCondition | null;
}

const move = (amount: 1 | 2): PrintedAction => ({ kind: 'move', amount });
const vp = (amount: number): PrintedAction => ({ kind: 'vp', amount });
const discover: PrintedAction = { kind: 'discover' };
const bonus: PrintedAction = { kind: 'bonus' };

/**
 * The fixed printed configuration of the 24 placeable board cells (`null` = the
 * Zoo (2,2) or an "empty" cell with no printed action). Entrances are external
 * (see ENTRANCES). Transcribed from the physical player board:
 *   - VP(2) cells that require the covering tile to show a **discover** symbol:
 *     (1,2),(2,1),(2,3),(3,2)
 *   - terrain-gated single-move cells: (1,1)=sand, (3,1)=grass, (3,3)=rocks
 *   - three paired groups (cover both cells with the same terrain):
 *     A (0,3)+(0,4)→move2, B (1,0)+(2,0)→2 bonus, C (4,2)+(4,3)→5 VP
 *   - the bottom corners print two actions: (4,0) = 2 VP + bonus, (4,4) = 2 VP + move
 *   - empty cells: (0,0),(0,2),(1,4),(3,0),(3,4),(4,1)
 */
export const BOARD_CONFIG: (CellConfig | null)[][] = (() => {
    const A = (printedActions: PrintedAction[], condition: CellCondition | null = null): CellConfig => ({ printedActions, condition });
    const paired = (group: string, reward: 'vp5' | 'move2' | 'bonus2'): CellConfig => ({ printedActions: [], condition: { type: 'paired', group, reward } });
    const sym = (requires: ActionSymbol): CellCondition => ({ type: 'symbol', requires });
    const terr = (requires: Terrain): CellCondition => ({ type: 'terrain', requires });
    const _ = null; // empty cell or zoo

    return [
        // row 0: (0,0)—  (0,1)>  (0,2)—  (0,3)+(0,4) pair A → >>
        [_, A([move(1)]), _, paired('A', 'move2'), paired('A', 'move2')],
        // row 1: (1,0)pairB  (1,1)>·sand  (1,2)2VP·discover  (1,3)+  (1,4)—
        [paired('B', 'bonus2'), A([move(1)], terr('sand')), A([vp(2)], sym('discover')), A([bonus]), _],
        // row 2: (2,0)pairB  (2,1)2VP·discover  ZOO  (2,3)2VP·discover  (2,4)>
        [paired('B', 'bonus2'), A([vp(2)], sym('discover')), _, A([vp(2)], sym('discover')), A([move(1)])],
        // row 3: (3,0)—  (3,1)>·grass  (3,2)2VP·discover  (3,3)>·rocks  (3,4)—
        [_, A([move(1)], terr('grass')), A([vp(2)], sym('discover')), A([move(1)], terr('rocks')), _],
        // row 4: (4,0)2VP+  (4,1)—  (4,2)+(4,3) pair C → 5VP  (4,4)2VP+>
        [A([vp(2), bonus]), _, paired('C', 'vp5'), paired('C', 'vp5'), A([vp(2), move(1)])]
    ];
})();

/** All paired-group members, for the "both covered same terrain" bonus. */
export const PAIRED_GROUPS: Record<string, { cells: [number, number][]; reward: 'vp5' | 'move2' | 'bonus2' }> = {
    A: { cells: [[0, 3], [0, 4]], reward: 'move2' },
    B: { cells: [[1, 0], [2, 0]], reward: 'bonus2' },
    C: { cells: [[4, 2], [4, 3]], reward: 'vp5' }
};

// ============================================================================
// Tiles
// ============================================================================

export type TileKind = 'action' | 'bonus';

export interface TileDef {
    id: string;
    kind: TileKind;
    terrain: Terrain;
    actions: ActionSymbol[];   // [] for bonus tiles; 1–2 for action tiles
    food: Food | null;
}

/**
 * The 75-card Action deck. A tile is exactly one of: one action, two actions, or
 * one food (never food + action). Balanced across the three terrains:
 *   - 18 single-action tiles  (6 actions × 3 terrains)      → A001–A018
 *   - 36 two-action tiles      (12 sensible pairs × 3)        → A019–A054
 *   - 21 food tiles            (7 foods × 3 terrains)         → A055–A075
 */
export const ACTION_TILES: TileDef[] = (() => {
    const tiles: TileDef[] = [];
    let n = 1;
    const terr: Terrain[] = ['rocks', 'grass', 'sand'];
    const mk = (terrain: Terrain, actions: ActionSymbol[], food: Food | null = null) =>
        tiles.push({ id: 'A' + String(n++).padStart(3, '0'), kind: 'action', terrain, actions, food });

    // 18 single-action tiles — every action on every terrain
    const singles: ActionSymbol[] = ['move1', 'move2', 'discover', 'bonus', 'vp1', 'vp2'];
    for (const a of singles) for (const t of terr) mk(t, [a]);

    // 36 two-action tiles — 12 pairs (movement × utility, plus a few utility×utility)
    const combos: ActionSymbol[][] = [
        ['move1', 'discover'], ['move1', 'bonus'], ['move1', 'vp1'], ['move1', 'vp2'],
        ['move2', 'discover'], ['move2', 'bonus'], ['move2', 'vp1'], ['move2', 'vp2'],
        ['discover', 'bonus'], ['discover', 'vp1'], ['bonus', 'vp1'], ['bonus', 'vp2']
    ];
    for (const c of combos) for (const t of terr) mk(t, [...c]);

    // 21 food tiles — every food on every terrain
    for (const food of FOODS) for (const t of terr) mk(t, [], food);

    return tiles;
})();

export const TILE_BY_ID: Record<string, TileDef> = ACTION_TILES.reduce((m, t) => { m[t.id] = t; return m; }, {} as Record<string, TileDef>);

/** Bonus tiles carry a terrain only (no actions, no food). Sorted by terrain. */
export const BONUS_PER_TERRAIN = 14; // 42 total across 3 piles

export function makeBonusTile(terrain: Terrain, serial: number): TileDef {
    return { id: `B-${terrain}-${serial}`, kind: 'bonus', terrain, actions: [], food: null };
}

// ============================================================================
// Terrain palette (soft pastel) — shared with the assets/views.
// ============================================================================

// Distinct hues so terrain reads at a glance: leaf green / periwinkle / gold.
export const TERRAIN_COLORS: Record<Terrain, string> = {
    grass: '#86c664',
    rocks: '#94a6c8',
    sand: '#f0bd57'
};
export const TERRAIN_INK: Record<Terrain, string> = {
    grass: '#356a2a',
    rocks: '#33415e',
    sand: '#8a5b16'
};

export const FOOD_COLORS: Record<Food, string> = {
    meat: '#d98c8c',
    fish: '#7cc0d6',
    carrot: '#efa25c',
    apple: '#e57f7f',
    banana: '#f0d873',
    leaves: '#8fc879',
    honey: '#edc147'
};

export const FOOD_LABELS: Record<Food, string> = {
    meat: 'Meat', fish: 'Fish', carrot: 'Carrot', apple: 'Apple',
    banana: 'Banana', leaves: 'Leaves', honey: 'Honey'
};
