/**
 * HarmoniesGameState.ts
 *
 * Decoupled state machine for Harmonies (Libellud, 2024).
 * Pure TypeScript, independent of React, Socket.io, or Multiplayr core.
 * Implements full stack grammar, 60-degree hex rotational pattern matching,
 * token pouch, market drafting, animal cards, and complete scoring.
 */

import {
    Color,
    Axial,
    FeatureKind,
    FeatureRequirement,
    PatternCell,
    AnimalCardSpec,
    ANIMAL_CARD_SPECS
} from './HarmoniesAssets';

export type Stack = Color[];

export interface Cell {
    coord: Axial;
    stack: Stack;
    cube?: 'animal' | null;
}

export type Feature =
    | { kind: 'empty' }
    | { kind: 'water' }
    | { kind: 'field' }
    | { kind: 'mountain'; height: 1 | 2 | 3 }
    | { kind: 'tree'; size: 1 | 2 | 3 }
    | { kind: 'building' }
    | { kind: 'redToken' }
    | { kind: 'trunk'; height: 1 | 2 };

export interface Board {
    side: 'A' | 'B';
    cells: Record<string, Cell>;
}

export interface HeldCard {
    card: AnimalCardSpec;
    cubesLeft: number;
}

export interface TokenPlacementRecord {
    q: number;
    r: number;
    color: Color;
    tokenIndex: number;
    cubeDepth?: number;  // cubes already placed this turn, so later cubes can't be orphaned
}

export interface CubePlacementRecord {
    cardId: string;
    q: number;
    r: number;
    handIndex: number;     // slot the card occupied in hand, for faithful restore
    completedCard: boolean; // this placement emptied the card and moved it to `completed`
}

export interface TakenCardRecord {
    cardId: string;
    displayIndex: number;  // slot the card occupied in the shared display
    cubesLoaded: number;   // cubes drawn from the reserve onto the card
}

export interface PlayerState {
    id: string;
    board: Board;
    hand: HeldCard[];        // <= 4 incomplete cards
    completed: AnimalCardSpec[];
    draftedTokens: Color[];  // tokens taken from market, awaiting placement (0..3)
    hasDraftedTokensThisTurn: boolean;
    hasTakenCardThisTurn: boolean;
    draftSourceSpaceIndex?: number | null;
    turnPlacements?: TokenPlacementRecord[];
    cubePlacements?: CubePlacementRecord[];
    takenCardRecord?: TakenCardRecord | null;
}

export interface HarmoniesScoreBreakdown {
    trees: number;
    mountains: number;
    fields: number;
    buildings: number;
    water: number;
    animals: number;
    total: number;
    cubesPlaced: number;
}

export interface HarmoniesGameStateData {
    playerIds: string[];
    boardSide: 'A' | 'B';
    pouch: Color[];
    market: Color[][];       // 5 spaces (solo: 3 spaces), each holds up to 3 tokens
    animalDisplay: AnimalCardSpec[]; // 5 face-up cards (solo: 3)
    animalDrawPile: AnimalCardSpec[];
    cubeReserve: number;
    currentPlayerIndex: number;
    firstPlayerIndex: number;
    turnCount: number;
    players: Record<string, PlayerState>;
    lastRound: boolean;
    ended: boolean;
    scores: Record<string, HarmoniesScoreBreakdown> | null;
    lastMove: { moveId: string; playerId: string; message: string } | null;
}

// ----------------------------------------------------------------------------
// Board Hex Masks (flat-top hexes, axial coordinates)
//
// Flat-top hexes tile in clean vertical COLUMNS: every cell in a column shares
// its q, and neighbouring columns sit half a hex lower/higher. Each mask below
// is written column by column, left to right, matching the rules booklet:
//
//   Side A - 5 columns of 5 / 4 / 5 / 4 / 5  = 23 spaces (roughly square)
//   Side B - 7 columns of 4 / 3 / 4 / 3 / 4 / 3 / 4 = 25 spaces (wide and short)
//
// The r ranges step up by one every two columns so that all columns stay
// vertically centred on each other once rendered (render y tracks r + q/2).
//
// Axial coordinates are orientation-agnostic: the six neighbour directions,
// 60-degree rotations, and therefore all habitat pattern matching are identical
// for flat-top and pointy-top. Only the pixel layout in the renderer differs.
// ----------------------------------------------------------------------------

/** Builds a column of `height` cells at `q`, starting at row `rStart`. */
function hexColumn(q: number, rStart: number, height: number): Axial[] {
    const column: Axial[] = [];
    for (let i = 0; i < height; i = i + 1) {
        column.push({ q, r: rStart + i });
    }
    return column;
}

export const BOARD_MASK_A: Axial[] = [
    ...hexColumn(0, 0, 5),
    ...hexColumn(1, 0, 4),
    ...hexColumn(2, -1, 5),
    ...hexColumn(3, -1, 4),
    ...hexColumn(4, -2, 5)
];

export const BOARD_MASK_B: Axial[] = [
    ...hexColumn(0, 0, 4),
    ...hexColumn(1, 0, 3),
    ...hexColumn(2, -1, 4),
    ...hexColumn(3, -1, 3),
    ...hexColumn(4, -2, 4),
    ...hexColumn(5, -2, 3),
    ...hexColumn(6, -3, 4)
];

export function boardMaskFor(side: 'A' | 'B'): Axial[] {
    return side === 'B' ? BOARD_MASK_B : BOARD_MASK_A;
}

/** @deprecated Use boardMaskFor(side); kept so callers without a side still work. */
export const BOARD_MASK: Axial[] = BOARD_MASK_A;

// The same six axial offsets serve both hex orientations; only the compass
// labels change. These are named for the flat-top board the game renders.
export const NEIGHBOR_DIRECTIONS: Axial[] = [
    { q: 1, r: 0 },   // SE
    { q: -1, r: 0 },  // NW
    { q: 1, r: -1 },  // NE
    { q: -1, r: 1 },  // SW
    { q: 0, r: -1 },  // N
    { q: 0, r: 1 }    // S
];

export function coordKey(coord: Axial): string {
    return `${coord.q},${coord.r}`;
}

export function parseCoordKey(key: string): Axial {
    const [q, r] = key.split(',').map(Number);
    return { q, r };
}

// ----------------------------------------------------------------------------
// Stack Grammar Helpers
// ----------------------------------------------------------------------------

export function featureOf(stack: Stack): Feature {
    if (!stack || stack.length === 0) return { kind: 'empty' };

    if (stack.length === 1) {
        switch (stack[0]) {
            case 'blue': return { kind: 'water' };
            case 'yellow': return { kind: 'field' };
            case 'gray': return { kind: 'mountain', height: 1 };
            case 'green': return { kind: 'tree', size: 1 };
            case 'brown': return { kind: 'trunk', height: 1 };
            case 'red': return { kind: 'redToken' };
        }
    }

    if (stack.length === 2) {
        const [bot, top] = stack;
        if (bot === 'gray' && top === 'gray') return { kind: 'mountain', height: 2 };
        if (bot === 'brown' && top === 'green') return { kind: 'tree', size: 2 };
        if (bot === 'brown' && top === 'brown') return { kind: 'trunk', height: 2 };
        if ((bot === 'red' || bot === 'brown' || bot === 'gray') && top === 'red') {
            return { kind: 'building' };
        }
    }

    if (stack.length === 3) {
        const [b1, b2, top] = stack;
        if (b1 === 'gray' && b2 === 'gray' && top === 'gray') return { kind: 'mountain', height: 3 };
        if (b1 === 'brown' && b2 === 'brown' && top === 'green') return { kind: 'tree', size: 3 };
    }

    return { kind: 'empty' };
}

export function canPlaceToken(currentStack: Stack, color: Color): boolean {
    if (!currentStack || currentStack.length === 0) {
        return true;
    }

    if (currentStack.length === 1) {
        const bot = currentStack[0];
        if (bot === 'blue' || bot === 'yellow') return false; // terminal height 1
        if (bot === 'gray') return color === 'gray' || color === 'red';
        if (bot === 'green') return false; // terminal
        if (bot === 'brown') return color === 'brown' || color === 'green' || color === 'red';
        if (bot === 'red') return color === 'red';
    }

    if (currentStack.length === 2) {
        const [b1, b2] = currentStack;
        if (b1 === 'gray' && b2 === 'gray') return color === 'gray';
        if (b1 === 'brown' && b2 === 'brown') return color === 'green';
        return false; // all other height 2 stacks are terminal
    }

    return false; // max height 3 reached
}

// ----------------------------------------------------------------------------
// Rotational Pattern Matcher
// ----------------------------------------------------------------------------

export function rotateAxial(coord: Axial, k: number): Axial {
    let q = coord.q;
    let r = coord.r;
    const steps = ((k % 6) + 6) % 6;
    for (let i = 0; i < steps; i++) {
        const nextQ = -r === 0 ? 0 : -r;
        const nextR = (q + r) === 0 ? 0 : q + r;
        q = nextQ;
        r = nextR;
    }
    return { q: q === 0 ? 0 : q, r: r === 0 ? 0 : r };
}


export function satisfiesRequirement(cell: Cell | undefined, req: FeatureRequirement): boolean {
    if (!cell) return false;
    const feat = featureOf(cell.stack);

    switch (req.kind) {
        case 'water':
            return feat.kind === 'water';
        case 'field':
            return feat.kind === 'field';
        case 'mountain':
            return feat.kind === 'mountain' && (req.height === undefined || feat.height === req.height);
        case 'tree':
            return feat.kind === 'tree' && (req.height === undefined || feat.size === req.height);
        case 'building':
            return feat.kind === 'building';
        case 'redToken':
            return feat.kind === 'redToken' || feat.kind === 'building';
        default:
            return false;
    }
}

export interface PatternMatch {
    cubeCoord: Axial;
    anchor: Axial;
    rotation: number;
}

export function findPatternMatches(board: Board, pattern: PatternCell[]): PatternMatch[] {
    const matches: PatternMatch[] = [];
    const seenCubeCoords = new Set<string>();

    const cubeCellIndex = pattern.findIndex(p => p.cube);
    if (cubeCellIndex === -1) return matches;

    for (const anchorKey of Object.keys(board.cells)) {
        const anchor = parseCoordKey(anchorKey);

        for (let rot = 0; rot < 6; rot++) {
            let allMatch = true;
            let targetCubeCoord: Axial | null = null;

            for (const p of pattern) {
                const rotatedOffset = rotateAxial(p.offset, rot);
                const targetQ = anchor.q + rotatedOffset.q;
                const targetR = anchor.r + rotatedOffset.r;
                const targetKey = `${targetQ},${targetR}`;
                const cell = board.cells[targetKey];

                if (!cell || !satisfiesRequirement(cell, p.require)) {
                    allMatch = false;
                    break;
                }

                if (p.cube) {
                    targetCubeCoord = { q: targetQ, r: targetR };
                }
            }

            if (allMatch && targetCubeCoord) {
                const targetCell = board.cells[coordKey(targetCubeCoord)];
                if (targetCell && !targetCell.cube) {
                    const cubeKey = coordKey(targetCubeCoord);
                    if (!seenCubeCoords.has(cubeKey)) {
                        seenCubeCoords.add(cubeKey);
                        matches.push({
                            cubeCoord: targetCubeCoord,
                            anchor,
                            rotation: rot
                        });
                    }
                }
            }
        }
    }

    return matches;
}

// ----------------------------------------------------------------------------
// Scoring Algorithms
// ----------------------------------------------------------------------------

export function calculateHarmoniesScore(board: Board, hand: HeldCard[], completed: AnimalCardSpec[]): HarmoniesScoreBreakdown {
    let treesScore = 0;
    let mountainsScore = 0;
    let fieldsScore = 0;
    let buildingsScore = 0;
    let waterScore = 0;
    let animalsScore = 0;
    let cubesPlacedCount = 0;

    // 1. Trees
    for (const key of Object.keys(board.cells)) {
        const cell = board.cells[key];
        const feat = featureOf(cell.stack);
        if (feat.kind === 'tree') {
            if (feat.size === 1) treesScore += 1;
            else if (feat.size === 2) treesScore += 3;
            else if (feat.size === 3) treesScore += 7;
        }
    }

    // 2. Mountains (Only scores if adjacent to at least one other mountain)
    for (const key of Object.keys(board.cells)) {
        const cell = board.cells[key];
        const feat = featureOf(cell.stack);
        if (feat.kind === 'mountain') {
            let hasAdjacentMountain = false;
            for (const dir of NEIGHBOR_DIRECTIONS) {
                const nKey = coordKey({ q: cell.coord.q + dir.q, r: cell.coord.r + dir.r });
                const nCell = board.cells[nKey];
                if (nCell && featureOf(nCell.stack).kind === 'mountain') {
                    hasAdjacentMountain = true;
                    break;
                }
            }

            if (hasAdjacentMountain) {
                if (feat.height === 1) mountainsScore += 1;
                else if (feat.height === 2) mountainsScore += 3;
                else if (feat.height === 3) mountainsScore += 7;
            }
        }
    }

    // 3. Fields (Groups of >= 2 contiguous yellow cells score 5 pts per field)
    const visitedFieldKeys = new Set<string>();
    for (const key of Object.keys(board.cells)) {
        const cell = board.cells[key];
        if (visitedFieldKeys.has(key)) continue;
        if (featureOf(cell.stack).kind === 'field') {
            // BFS component
            let groupSize = 0;
            const queue: string[] = [key];
            visitedFieldKeys.add(key);

            while (queue.length > 0) {
                const curKey = queue.shift()!;
                groupSize++;
                const curCoord = parseCoordKey(curKey);

                for (const dir of NEIGHBOR_DIRECTIONS) {
                    const nCoord = { q: curCoord.q + dir.q, r: curCoord.r + dir.r };
                    const nKey = coordKey(nCoord);
                    const nCell = board.cells[nKey];
                    if (nCell && !visitedFieldKeys.has(nKey) && featureOf(nCell.stack).kind === 'field') {
                        visitedFieldKeys.add(nKey);
                        queue.push(nKey);
                    }
                }
            }

            if (groupSize >= 2) {
                fieldsScore += 5;
            }
        }
    }

    // 4. Buildings (Height 2, top is red. Scores 5 if surrounded by >= 3 distinct colors among neighbor top tokens)
    for (const key of Object.keys(board.cells)) {
        const cell = board.cells[key];
        if (featureOf(cell.stack).kind === 'building') {
            const neighborColors = new Set<Color>();
            for (const dir of NEIGHBOR_DIRECTIONS) {
                const nKey = coordKey({ q: cell.coord.q + dir.q, r: cell.coord.r + dir.r });
                const nCell = board.cells[nKey];
                if (nCell && nCell.stack.length > 0) {
                    const topColor = nCell.stack[nCell.stack.length - 1];
                    neighborColors.add(topColor);
                }
            }
            if (neighborColors.size >= 3) {
                buildingsScore += 5;
            }
        }
    }

    // 5. Water - Side A (Longest simple river path) vs Side B (Islands)
    if (board.side === 'A') {
        const waterKeys = Object.keys(board.cells).filter(k => featureOf(board.cells[k].stack).kind === 'water');
        let maxRiverLength = 0;

        // Find longest simple path in water subgraph
        const dfs = (curKey: string, visited: Set<string>): number => {
            let maxSub = 1;
            const curCoord = parseCoordKey(curKey);
            for (const dir of NEIGHBOR_DIRECTIONS) {
                const nKey = coordKey({ q: curCoord.q + dir.q, r: curCoord.r + dir.r });
                if (!visited.has(nKey) && waterKeys.includes(nKey)) {
                    visited.add(nKey);
                    const length = 1 + dfs(nKey, visited);
                    if (length > maxSub) maxSub = length;
                    visited.delete(nKey);
                }
            }
            return maxSub;
        };

        for (const startKey of waterKeys) {
            const visited = new Set<string>([startKey]);
            const len = dfs(startKey, visited);
            if (len > maxRiverLength) maxRiverLength = len;
        }

        if (maxRiverLength === 1) waterScore = 0;
        else if (maxRiverLength === 2) waterScore = 2;
        else if (maxRiverLength === 3) waterScore = 5;
        else if (maxRiverLength === 4) waterScore = 8;
        else if (maxRiverLength === 5) waterScore = 11;
        else if (maxRiverLength === 6) waterScore = 15;
        else if (maxRiverLength > 6) waterScore = 15 + (maxRiverLength - 6) * 4;
    } else {
        // Side B: Non-water connected components separated by water (5 pts per island)
        const visitedIslandKeys = new Set<string>();
        let islandCount = 0;
        for (const key of Object.keys(board.cells)) {
            const cell = board.cells[key];
            if (visitedIslandKeys.has(key)) continue;
            if (featureOf(cell.stack).kind !== 'water') {
                islandCount++;
                const queue: string[] = [key];
                visitedIslandKeys.add(key);

                while (queue.length > 0) {
                    const curKey = queue.shift()!;
                    const curCoord = parseCoordKey(curKey);
                    for (const dir of NEIGHBOR_DIRECTIONS) {
                        const nKey = coordKey({ q: curCoord.q + dir.q, r: curCoord.r + dir.r });
                        const nCell = board.cells[nKey];
                        if (nCell && !visitedIslandKeys.has(nKey) && featureOf(nCell.stack).kind !== 'water') {
                            visitedIslandKeys.add(nKey);
                            queue.push(nKey);
                        }
                    }
                }
            }
        }
        waterScore = islandCount * 5;
    }

    // 6. Animal Cards
    // Completed cards
    for (const card of completed) {
        const score = card.pointTrack[card.cubeCount] || 0;
        animalsScore += score;
        cubesPlacedCount += card.cubeCount;
    }
    // Held cards in hand
    for (const held of hand) {
        const placed = held.card.cubeCount - held.cubesLeft;
        const score = held.card.pointTrack[placed] || 0;
        animalsScore += score;
        cubesPlacedCount += placed;
    }

    const total = treesScore + mountainsScore + fieldsScore + buildingsScore + waterScore + animalsScore;

    return {
        trees: treesScore,
        mountains: mountainsScore,
        fields: fieldsScore,
        buildings: buildingsScore,
        water: waterScore,
        animals: animalsScore,
        total,
        cubesPlaced: cubesPlacedCount
    };
}

// ----------------------------------------------------------------------------
// Pouch Generator (120 tokens canonical distribution)
// ----------------------------------------------------------------------------

export function createPouch(): Color[] {
    const counts: Record<Color, number> = {
        blue: 23,
        gray: 23,
        brown: 21,
        green: 19,
        yellow: 19,
        red: 15
    };
    const pouch: Color[] = [];
    for (const [col, count] of Object.entries(counts) as [Color, number][]) {
        for (let i = 0; i < count; i++) {
            pouch.push(col);
        }
    }
    // Fisher-Yates shuffle
    for (let i = pouch.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pouch[i], pouch[j]] = [pouch[j], pouch[i]];
    }
    return pouch;
}

export function createEmptyBoard(side: 'A' | 'B' = 'A'): Board {
    const cells: Record<string, Cell> = {};
    for (const coord of boardMaskFor(side)) {
        cells[coordKey(coord)] = {
            coord,
            stack: [],
            cube: null
        };
    }
    return { side, cells };
}

// ----------------------------------------------------------------------------
// The HarmoniesGameState Class
// ----------------------------------------------------------------------------

export class HarmoniesGameState {
    private data: HarmoniesGameStateData;

    constructor(playerIds: string[], boardSide: 'A' | 'B' = 'A') {
        const pouch = createPouch();
        const marketSpacesCount = playerIds.length === 1 ? 3 : 5;
        const market: Color[][] = [];

        for (let i = 0; i < marketSpacesCount; i++) {
            const spaceTokens: Color[] = [];
            for (let j = 0; j < 3 && pouch.length > 0; j++) {
                spaceTokens.push(pouch.pop()!);
            }
            market.push(spaceTokens);
        }

        // Shuffle animal cards
        const deck: AnimalCardSpec[] = [...ANIMAL_CARD_SPECS];
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }

        const displayCount = playerIds.length === 1 ? 3 : 5;
        const animalDisplay: AnimalCardSpec[] = [];
        for (let i = 0; i < displayCount && deck.length > 0; i++) {
            animalDisplay.push(deck.pop()!);
        }

        const players: Record<string, PlayerState> = {};
        for (const id of playerIds) {
            players[id] = {
                id,
                board: createEmptyBoard(boardSide),
                hand: [],
                completed: [],
                draftedTokens: [],
                hasDraftedTokensThisTurn: false,
                hasTakenCardThisTurn: false,
                draftSourceSpaceIndex: null,
                turnPlacements: [],
                cubePlacements: [],
                takenCardRecord: null
            };
        }

        this.data = {
            playerIds: [...playerIds],
            boardSide,
            pouch,
            market,
            animalDisplay,
            animalDrawPile: deck,
            cubeReserve: 66,
            currentPlayerIndex: 0,
            firstPlayerIndex: 0,
            turnCount: 0,
            players,
            lastRound: false,
            ended: false,
            scores: null,
            lastMove: null
        };
    }

    public static from_data(data: HarmoniesGameStateData): HarmoniesGameState {
        const game = new HarmoniesGameState(data.playerIds, data.boardSide);
        game.data = JSON.parse(JSON.stringify(data));
        return game;
    }

    public get_data(): HarmoniesGameStateData {
        return JSON.parse(JSON.stringify(this.data));
    }

    public get_current_player_id(): string {
        return this.data.playerIds[this.data.currentPlayerIndex];
    }

    public is_current_player(playerId: string): boolean {
        return this.get_current_player_id() === playerId;
    }

    public get_player(playerId: string): PlayerState | undefined {
        return this.data.players[playerId];
    }

    public is_ended(): boolean {
        return this.data.ended;
    }

    // ------------------------------------------------------------------------
    // Action 1: Draft tokens from market (with undo support)
    // ------------------------------------------------------------------------

    public take_market_tokens(playerId: string, spaceIndex: number): void {
        if (this.data.ended) throw new Error('Game has ended');
        if (!this.is_current_player(playerId)) throw new Error('Not your turn');

        const player = this.data.players[playerId];
        if (player.hasDraftedTokensThisTurn) {
            throw new Error('You may only draft one set of 3 tokens per turn');
        }
        if (player.draftedTokens.length > 0) {
            throw new Error('You already have drafted tokens waiting to be placed');
        }

        if (spaceIndex < 0 || spaceIndex >= this.data.market.length) {
            throw new Error('Invalid market space index');
        }

        const space = this.data.market[spaceIndex];
        if (space.length === 0) {
            throw new Error('Selected market space is empty');
        }

        // Take all tokens from space
        player.draftedTokens = [...space];
        player.hasDraftedTokensThisTurn = true;
        player.draftSourceSpaceIndex = spaceIndex;
        player.turnPlacements = [];
        this.data.market[spaceIndex] = [];

        this.data.lastMove = {
            moveId: `${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            playerId,
            message: `took 3 tokens from market space ${spaceIndex + 1}`
        };
    }

    public undo_token_draft(playerId: string): void {
        if (this.data.ended) throw new Error('Game has ended');
        if (!this.is_current_player(playerId)) throw new Error('Not your turn');

        const player = this.data.players[playerId];
        if (!player.hasDraftedTokensThisTurn) {
            throw new Error('No drafted tokens to undo');
        }
        if (player.draftSourceSpaceIndex === undefined || player.draftSourceSpaceIndex === null) {
            throw new Error('Cannot find draft source space to return tokens to');
        }
        if (player.turnPlacements && player.turnPlacements.length > 0) {
            throw new Error('Please undo placed tokens on your board before undoing draft');
        }
        if (player.draftedTokens.length !== 3) {
            throw new Error('Cannot undo draft: all 3 tokens must be in draft pool');
        }

        const spaceIndex = player.draftSourceSpaceIndex;
        this.data.market[spaceIndex] = [...player.draftedTokens];
        player.draftedTokens = [];
        player.hasDraftedTokensThisTurn = false;
        player.draftSourceSpaceIndex = null;
        player.turnPlacements = [];

        this.data.lastMove = {
            moveId: `${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            playerId,
            message: `undid token draft, returned 3 tokens to market space ${spaceIndex + 1}`
        };
    }

    // ------------------------------------------------------------------------
    // Action 2: Place a drafted token onto the personal board (selective & undoable)
    // ------------------------------------------------------------------------

    public place_token(playerId: string, q: number, r: number, tokenIndex: number = 0): void {
        if (this.data.ended) throw new Error('Game has ended');
        if (!this.is_current_player(playerId)) throw new Error('Not your turn');

        const player = this.data.players[playerId];
        if (player.draftedTokens.length === 0) {
            throw new Error('No drafted tokens available to place');
        }

        const validIndex = Math.max(0, Math.min(tokenIndex, player.draftedTokens.length - 1));
        const nextToken = player.draftedTokens[validIndex];

        const key = `${q},${r}`;
        const cell = player.board.cells[key];
        if (!cell) throw new Error(`Invalid board coordinate (${q}, ${r})`);
        if (cell.cube) throw new Error('Cannot place token on a cell with an animal cube');

        if (!canPlaceToken(cell.stack, nextToken)) {
            throw new Error(`Cannot place ${nextToken} token on stack [${cell.stack.join(',')}]`);
        }

        // Place token
        cell.stack.push(nextToken);
        player.draftedTokens.splice(validIndex, 1);

        if (!player.turnPlacements) {
            player.turnPlacements = [];
        }
        player.turnPlacements.push({
            q,
            r,
            color: nextToken,
            tokenIndex: validIndex,
            cubeDepth: player.cubePlacements ? player.cubePlacements.length : 0
        });

        this.data.lastMove = {
            moveId: `${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            playerId,
            message: `placed a ${nextToken} token at (${q}, ${r})`
        };
    }

    public undo_token_placement(playerId: string): void {
        if (this.data.ended) throw new Error('Game has ended');
        if (!this.is_current_player(playerId)) throw new Error('Not your turn');

        const player = this.data.players[playerId];
        if (!player.turnPlacements || player.turnPlacements.length === 0) {
            throw new Error('No placed tokens to undo');
        }

        // A cube placed after this token may be scoring off it, so that cube has
        // to come off the board before the token underneath it can move.
        const lastPlacement = player.turnPlacements[player.turnPlacements.length - 1];
        const cubesNow = player.cubePlacements ? player.cubePlacements.length : 0;
        if (cubesNow > (lastPlacement.cubeDepth || 0)) {
            throw new Error('Please undo animal cubes placed after this token first');
        }
        player.turnPlacements.pop();

        const key = `${lastPlacement.q},${lastPlacement.r}`;
        const cell = player.board.cells[key];
        if (!cell) {
            throw new Error(`Invalid board coordinate (${lastPlacement.q}, ${lastPlacement.r})`);
        }
        if (cell.cube) {
            player.turnPlacements.push(lastPlacement);
            throw new Error('Cannot undo placement: cell has an animal cube on it');
        }
        if (cell.stack.length === 0 || cell.stack[cell.stack.length - 1] !== lastPlacement.color) {
            player.turnPlacements.push(lastPlacement);
            throw new Error(`Top token does not match placed ${lastPlacement.color} token`);
        }

        // Remove token from board
        const removedToken = cell.stack.pop()!;

        // Restore token back into draftedTokens at its prior position
        const insertIdx = Math.min(lastPlacement.tokenIndex, player.draftedTokens.length);
        player.draftedTokens.splice(insertIdx, 0, removedToken);

        this.data.lastMove = {
            moveId: `${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            playerId,
            message: `undid placement of ${removedToken} token at (${lastPlacement.q}, ${lastPlacement.r})`
        };
    }

    // ------------------------------------------------------------------------
    // Action 3: Take 1 Animal Card (Optional, at most once per turn)
    // ------------------------------------------------------------------------

    public take_animal_card(playerId: string, cardId: string): void {
        if (this.data.ended) throw new Error('Game has ended');
        if (!this.is_current_player(playerId)) throw new Error('Not your turn');

        const player = this.data.players[playerId];
        if (player.hasTakenCardThisTurn) {
            throw new Error('You may only take one animal card per turn');
        }

        if (player.hand.length >= 4) {
            throw new Error('Hand limit reached: max 4 incomplete animal cards');
        }

        const cardIdx = this.data.animalDisplay.findIndex(c => c.id === cardId);
        if (cardIdx === -1) {
            throw new Error(`Animal card ${cardId} is not in the display`);
        }

        const card = this.data.animalDisplay[cardIdx];
        this.data.animalDisplay.splice(cardIdx, 1);

        // Load cubes onto card from reserve
        const cubesToLoad = Math.min(card.cubeCount, this.data.cubeReserve);
        this.data.cubeReserve -= cubesToLoad;

        player.hand.push({
            card,
            cubesLeft: cubesToLoad
        });
        player.hasTakenCardThisTurn = true;
        player.takenCardRecord = {
            cardId: card.id,
            displayIndex: cardIdx,
            cubesLoaded: cubesToLoad
        };

        this.data.lastMove = {
            moveId: `${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            playerId,
            message: `took card "${card.animalName}"`
        };
    }

    /**
     * Undo taking an animal card this turn: the card goes back to its slot in the
     * shared display and its cubes return to the reserve. Any cube already placed
     * from that card must be undone first.
     */
    public undo_take_animal_card(playerId: string): void {
        if (this.data.ended) throw new Error('Game has ended');
        if (!this.is_current_player(playerId)) throw new Error('Not your turn');

        const player = this.data.players[playerId];
        const record = player.takenCardRecord;
        if (!player.hasTakenCardThisTurn || !record) {
            throw new Error('No drafted animal card to undo');
        }

        const heldIdx = player.hand.findIndex(h => h.card.id === record.cardId);
        if (heldIdx === -1) {
            throw new Error('Please undo animal cubes placed from this card before undoing the draft');
        }

        const held = player.hand[heldIdx];
        if (held.cubesLeft !== record.cubesLoaded) {
            throw new Error('Please undo animal cubes placed from this card before undoing the draft');
        }

        player.hand.splice(heldIdx, 1);
        this.data.cubeReserve += record.cubesLoaded;

        const insertIdx = Math.min(record.displayIndex, this.data.animalDisplay.length);
        this.data.animalDisplay.splice(insertIdx, 0, held.card);

        player.hasTakenCardThisTurn = false;
        player.takenCardRecord = null;

        this.data.lastMove = {
            moveId: `${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            playerId,
            message: `returned card "${held.card.animalName}" to the display`
        };
    }

    // ------------------------------------------------------------------------
    // Action 4: Place 1 Animal Cube onto a matching habitat
    // ------------------------------------------------------------------------

    public place_animal_cube(playerId: string, cardId: string, q: number, r: number): void {
        if (this.data.ended) throw new Error('Game has ended');
        if (!this.is_current_player(playerId)) throw new Error('Not your turn');

        const player = this.data.players[playerId];
        if (player.draftedTokens.length > 0) {
            throw new Error('Place all drafted tokens before placing animal cubes');
        }

        const heldIdx = player.hand.findIndex(h => h.card.id === cardId);
        if (heldIdx === -1) {
            throw new Error(`You do not hold card ${cardId}`);
        }

        const held = player.hand[heldIdx];
        if (held.cubesLeft <= 0) {
            throw new Error('No cubes remaining on this card');
        }

        const key = `${q},${r}`;
        const cell = player.board.cells[key];
        if (!cell) throw new Error(`Invalid board coordinate (${q}, ${r})`);
        if (cell.cube) throw new Error('Cell already contains an animal cube');

        // Verify pattern match at (q, r)
        const matches = findPatternMatches(player.board, held.card.pattern);
        const match = matches.find(m => m.cubeCoord.q === q && m.cubeCoord.r === r);
        if (!match) {
            throw new Error(`No valid habitat pattern match for card ${cardId} with cube at (${q}, ${r})`);
        }

        // Place cube
        cell.cube = 'animal';
        held.cubesLeft -= 1;

        // If all cubes placed, card is completed
        const completedCard = held.cubesLeft === 0;
        if (completedCard) {
            player.completed.push(held.card);
            player.hand.splice(heldIdx, 1);
        }

        if (!player.cubePlacements) {
            player.cubePlacements = [];
        }
        player.cubePlacements.push({
            cardId: held.card.id,
            q,
            r,
            handIndex: heldIdx,
            completedCard
        });

        this.data.lastMove = {
            moveId: `${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            playerId,
            message: `placed an animal cube for "${held.card.animalName}" at (${q}, ${r})`
        };
    }

    /**
     * Undo the most recent animal cube placed this turn. A placement that completed
     * a card pulls that card back out of `completed` into its original hand slot.
     */
    public undo_animal_cube(playerId: string): void {
        if (this.data.ended) throw new Error('Game has ended');
        if (!this.is_current_player(playerId)) throw new Error('Not your turn');

        const player = this.data.players[playerId];
        if (!player.cubePlacements || player.cubePlacements.length === 0) {
            throw new Error('No animal cubes to undo');
        }

        const last = player.cubePlacements[player.cubePlacements.length - 1];

        const key = `${last.q},${last.r}`;
        const cell = player.board.cells[key];
        if (!cell || !cell.cube) {
            throw new Error('Cannot undo cube: board cell no longer holds a cube');
        }

        if (last.completedCard) {
            const completedIdx = player.completed.findIndex(c => c.id === last.cardId);
            if (completedIdx === -1) {
                throw new Error('Cannot undo cube: completed card is missing');
            }
            // The card leaves `completed` and rejoins the hand, so it has to fit.
            if (player.hand.length >= 4) {
                throw new Error('Hand is full: undo your drafted animal card before undoing this cube');
            }
            const card = player.completed[completedIdx];
            player.completed.splice(completedIdx, 1);
            const insertIdx = Math.min(last.handIndex, player.hand.length);
            player.hand.splice(insertIdx, 0, { card, cubesLeft: 1 });
        } else {
            const held = player.hand.find(h => h.card.id === last.cardId);
            if (!held) {
                throw new Error('Cannot undo cube: card is no longer in hand');
            }
            held.cubesLeft += 1;
        }

        delete cell.cube;
        player.cubePlacements.pop();

        this.data.lastMove = {
            moveId: `${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            playerId,
            message: `undid an animal cube at (${last.q}, ${last.r})`
        };
    }

    // ------------------------------------------------------------------------
    // End Turn & Cleanup
    // ------------------------------------------------------------------------

    public end_turn(playerId: string): void {
        if (this.data.ended) throw new Error('Game has ended');
        if (!this.is_current_player(playerId)) throw new Error('Not your turn');

        const player = this.data.players[playerId];
        if (!player.hasDraftedTokensThisTurn) {
            throw new Error('You must draft and place 3 tokens before ending your turn');
        }
        if (player.draftedTokens.length > 0) {
            throw new Error('You must place all 3 drafted tokens before ending your turn');
        }

        // Refill empty market spaces immediately at the end of the turn
        for (let i = 0; i < this.data.market.length; i++) {
            if (this.data.market[i].length === 0) {
                while (this.data.market[i].length < 3 && this.data.pouch.length > 0) {
                    this.data.market[i].push(this.data.pouch.pop()!);
                }
            }
        }

        // Refill animal card display
        const targetDisplay = this.data.playerIds.length === 1 ? 3 : 5;
        while (this.data.animalDisplay.length < targetDisplay && this.data.animalDrawPile.length > 0) {
            this.data.animalDisplay.push(this.data.animalDrawPile.pop()!);
        }

        // Reset turn flags and undo history
        player.hasDraftedTokensThisTurn = false;
        player.hasTakenCardThisTurn = false;
        player.draftSourceSpaceIndex = null;
        player.turnPlacements = [];
        player.cubePlacements = [];
        player.takenCardRecord = null;

        // Check end game triggers:
        // 1. Pouch is empty
        // 2. A player has <= 2 unoccupied cells
        let triggerEnd = false;
        if (this.data.pouch.length === 0) {
            triggerEnd = true;
        }

        for (const p of Object.values(this.data.players)) {
            let emptyCount = 0;
            for (const c of Object.values(p.board.cells)) {
                if (c.stack.length === 0) emptyCount++;
            }
            if (emptyCount <= 2) {
                triggerEnd = true;
                break;
            }
        }

        if (triggerEnd) {
            this.data.lastRound = true;
        }

        // Advance player index
        const nextIdx = (this.data.currentPlayerIndex + 1) % this.data.playerIds.length;
        this.data.currentPlayerIndex = nextIdx;
        this.data.turnCount++;

        // If last round was triggered and we looped back to first player, game is complete!
        if (this.data.lastRound && nextIdx === this.data.firstPlayerIndex) {
            this.finish_game();
        }
    }

    private finish_game(): void {
        this.data.ended = true;
        const scores: Record<string, HarmoniesScoreBreakdown> = {};
        for (const p of Object.values(this.data.players)) {
            scores[p.id] = calculateHarmoniesScore(p.board, p.hand, p.completed);
        }
        this.data.scores = scores;

        this.data.lastMove = {
            moveId: `${Date.now()}_end`,
            playerId: 'system',
            message: 'Game completed! Scores calculated.'
        };
    }
}
