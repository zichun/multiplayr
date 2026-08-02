/**
 * ProjectLGameState.ts — the pure, framework-independent Project L engine.
 *
 * No React / Socket.io / Multiplayr dependencies, so it is fully unit-testable
 * and serialisable. All board math is delegated to the shared polyomino
 * geometry core, so the host validates placements with the exact same code the
 * client UI uses to preview them.
 *
 * Supports the base multiplayer game (2–6) and the solo variant (1 player vs a
 * deterministic AI). The 5 actions, completion sweep, reserve substitution,
 * end-game / finishing-touches / scoring, and the solo opponent all live here.
 */

import {
    isPlacementValid,
    popcount
} from '../../client/lib/polyomino/geometry';
import {
    ShapeId, SHAPES, SHAPE_IDS, shapesAtLevel, MAX_LEVEL,
    PuzzleDef, PUZZLE_BY_ID, WHITE_PUZZLE_IDS, BLACK_PUZZLE_IDS,
    BLACK_COUNT_BY_PLAYERS, MAX_UNFINISHED_PUZZLES, ACTIONS_PER_TURN, ROW_SIZE,
    STARTING_SUPPLY, fullReserve, emptySupply,
    SoloDifficulty, SOLO_WHITE_COUNT, SOLO_BLACK_COUNT, SOLO_GRID_SIZE,
    SOLO_OPPONENT_SEED, SOLO_INITIAL_LOCKS, SOLO_COLUMNS,
    SPEED_WHITE_COUNT, SPEED_BLACK_COUNT
} from './ProjectLData';

export enum Phase {
    Setup = 'setup',
    Play = 'play',
    FinishingTouches = 'finishing',
    Scoring = 'scoring',
    Finished = 'finished'
}

export type GameMode = 'multiplayer' | 'solo' | 'speed';

export interface PlacementRec {
    shapeId: ShapeId;
    mask: number;
}

export interface PuzzleInstance {
    puzzleId: number;
    filled: number;
    placements: PlacementRec[];
}

export interface PlayerState {
    id: string;
    supply: Record<ShapeId, number>;
    puzzles: PuzzleInstance[];
    vpPile: { puzzleId: number; points: number }[];
    finishingTouchPieces: number;
    blackTakenThisTurn: number;
    masterUsedThisTurn: boolean;
    finishingDone: boolean;
}

export interface LastMove {
    moveId: number;
    playerId: string;
    kind: string;
    text: string;
}

export interface SoloState {
    difficulty: SoloDifficulty;
    puzzleDeck: number[];       // draw deck (top = end)
    grid: (number | null)[];    // length 9
    locks: number[];            // length 3, generic tokens above each column
    opponentSupply: number;     // generic tokens
    opponentVp: { puzzleId: number; points: number }[];
}

export interface GameStateData {
    mode: GameMode;
    phase: Phase;
    players: Record<string, PlayerState>;
    playerOrder: string[];
    reserve: Record<ShapeId, number>;
    whiteDeck: number[];
    blackDeck: number[];
    whiteRow: (number | null)[];
    blackRow: (number | null)[];
    current: number;
    round: number;
    actionsLeft: number;
    endTriggered: boolean;
    finalTurnsRemaining: number | null;
    lastMove: LastMove | null;
    moveCounter: number;
    solo: SoloState | null;
    scores: Record<string, number> | null;
    winnerIds: string[] | null;
    soloResult: 'win' | 'lose' | null;
    // ---- speed contest ----
    moveCount: number;   // count of player actions (each adds a time penalty)
    cleared: boolean;    // this player has emptied their black draw pile
}

/** Deterministic PRNG so every racer shuffles the same deck from one seed. */
function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return function () {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function shuffleWith<T>(arr: T[], rng: () => number): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

export interface StartOptions {
    mode?: GameMode;
    difficulty?: SoloDifficulty;
    /** shared seed → identical decks for all racers (speed mode) */
    seed?: number;
}

export class ProjectLGameState {
    private data: GameStateData;
    private readonly playerIds: string[];
    private rng: () => number = Math.random;

    constructor(playerIds: string[]) {
        this.playerIds = [...playerIds];
        this.data = ProjectLGameState.blankData(this.playerIds);
    }

    private shuffle<T>(arr: T[]): T[] {
        return shuffleWith(arr, this.rng);
    }

    private static blankData(playerIds: string[]): GameStateData {
        const players: Record<string, PlayerState> = {};
        for (const id of playerIds) {
            players[id] = {
                id,
                supply: emptySupply(),
                puzzles: [],
                vpPile: [],
                finishingTouchPieces: 0,
                blackTakenThisTurn: 0,
                masterUsedThisTurn: false,
                finishingDone: false
            };
        }
        return {
            mode: 'multiplayer',
            phase: Phase.Setup,
            players,
            playerOrder: [...playerIds],
            reserve: fullReserve(),
            whiteDeck: [],
            blackDeck: [],
            whiteRow: [null, null, null, null],
            blackRow: [null, null, null, null],
            current: 0,
            round: 0,
            actionsLeft: ACTIONS_PER_TURN,
            endTriggered: false,
            finalTurnsRemaining: null,
            lastMove: null,
            moveCounter: 0,
            solo: null,
            scores: null,
            winnerIds: null,
            soloResult: null,
            moveCount: 0,
            cleared: false
        };
    }

    public static from_data(data: GameStateData, playerIds: string[]): ProjectLGameState {
        const gs = new ProjectLGameState(playerIds);
        gs.data = { ...data };
        return gs;
    }

    public get_data(): GameStateData {
        return this.data;
    }

    // ========================================================================
    // Setup
    // ========================================================================

    public start_game(opts: StartOptions = {}): void {
        const mode: GameMode = opts.mode || (this.playerIds.length === 1 ? 'solo' : 'multiplayer');
        this.rng = opts.seed != null ? mulberry32(opts.seed) : Math.random;
        this.data = ProjectLGameState.blankData(this.playerIds);
        this.data.mode = mode;
        this.data.reserve = fullReserve();

        // deal starting pieces (1 L1 + 1 L2) from reserve
        for (const id of this.playerIds) {
            for (const shapeId of STARTING_SUPPLY) {
                this.data.players[id].supply[shapeId]++;
                this.data.reserve[shapeId]--;
            }
        }

        if (mode === 'solo') {
            this.setupSolo(opts.difficulty || 'normal');
        } else if (mode === 'speed') {
            this.setupSpeed();
        } else {
            this.setupMultiplayer();
        }

        this.data.phase = Phase.Play;
        this.data.current = 0;
        this.data.round = 0;
        this.data.actionsLeft = ACTIONS_PER_TURN;
        this.resetTurnFlags(this.currentPlayerId());
    }

    private setupMultiplayer(): void {
        const n = this.playerIds.length;
        const white = this.shuffle(WHITE_PUZZLE_IDS);
        const blackCount = BLACK_COUNT_BY_PLAYERS[n] ?? 16;
        const black = this.shuffle(BLACK_PUZZLE_IDS).slice(0, blackCount);

        // reveal 4 of each into the rows, remainder stays in deck (top = end)
        this.data.whiteRow = white.slice(0, ROW_SIZE);
        this.data.whiteDeck = white.slice(ROW_SIZE);
        this.data.blackRow = black.slice(0, ROW_SIZE);
        this.data.blackDeck = black.slice(ROW_SIZE);
    }

    /** Speed contest: a single racer on standard rows/decks, fixed black count. */
    private setupSpeed(): void {
        const white = this.shuffle(WHITE_PUZZLE_IDS).slice(0, SPEED_WHITE_COUNT);
        const black = this.shuffle(BLACK_PUZZLE_IDS).slice(0, SPEED_BLACK_COUNT);
        this.data.whiteRow = white.slice(0, ROW_SIZE);
        this.data.whiteDeck = white.slice(ROW_SIZE);
        this.data.blackRow = black.slice(0, ROW_SIZE);
        this.data.blackDeck = black.slice(ROW_SIZE);
    }

    private setupSolo(difficulty: SoloDifficulty): void {
        const white = this.shuffle(WHITE_PUZZLE_IDS).slice(0, SOLO_WHITE_COUNT);
        const black = this.shuffle(BLACK_PUZZLE_IDS).slice(0, SOLO_BLACK_COUNT);
        // Black on the bottom, white on top → single deck (top = end of array).
        const deck = [...black, ...white];
        const grid = deck.slice(deck.length - SOLO_GRID_SIZE); // top 9 → grid
        const rest = deck.slice(0, deck.length - SOLO_GRID_SIZE);
        this.data.solo = {
            difficulty,
            puzzleDeck: rest,
            grid: grid.slice(),
            locks: [...SOLO_INITIAL_LOCKS],
            opponentSupply: SOLO_OPPONENT_SEED[difficulty],
            opponentVp: []
        };
    }

    // ========================================================================
    // Small helpers
    // ========================================================================

    public currentPlayerId(): string {
        return this.data.playerOrder[this.data.current];
    }

    private player(id: string): PlayerState {
        const p = this.data.players[id];
        if (!p) throw new Error('Unknown player: ' + id);
        return p;
    }

    private requireTurn(id: string): PlayerState {
        if (this.data.phase !== Phase.Play) throw new Error('Not in the play phase');
        if (id !== this.currentPlayerId()) throw new Error('Not your turn');
        // Speed contest has no turn / action limit — race freely until cleared.
        if (this.data.mode !== 'speed' && this.data.actionsLeft <= 0) {
            throw new Error('No actions left this turn');
        }
        return this.player(id);
    }

    private resetTurnFlags(id: string): void {
        const p = this.player(id);
        p.masterUsedThisTurn = false;
        p.blackTakenThisTurn = 0;
    }

    private note(playerId: string, kind: string, text: string): void {
        this.data.moveCounter++;
        this.data.lastMove = { moveId: this.data.moveCounter, playerId, kind, text };
    }

    // ========================================================================
    // Reserve draw with substitution (§9)
    // ========================================================================

    /** Draw the wanted shape from reserve, applying substitution. May return null. */
    private drawFromReserve(want: ShapeId): ShapeId | null {
        const r = this.data.reserve;
        if (r[want] > 0) { r[want]--; return want; }
        const wantLevel = SHAPES[want].level;
        // same level
        for (const s of shapesAtLevel(wantLevel)) {
            if (r[s] > 0) { r[s]--; return s; }
        }
        // one level higher
        for (const s of shapesAtLevel(wantLevel + 1)) {
            if (r[s] > 0) { r[s]--; return s; }
        }
        // any lower level
        for (let L = wantLevel - 1; L >= 1; L--) {
            for (const s of shapesAtLevel(L)) {
                if (r[s] > 0) { r[s]--; return s; }
            }
        }
        return null;
    }

    // ========================================================================
    // Action 1 — Take
    // ========================================================================

    public take_from_row(id: string, deck: 'white' | 'black', slot: number): void {
        const p = this.requireTurn(id);
        this.assertCanTake(p);
        const row = deck === 'white' ? this.data.whiteRow : this.data.blackRow;
        if (slot < 0 || slot >= row.length || row[slot] == null) {
            throw new Error('No puzzle in that slot');
        }
        if (deck === 'black') this.assertBlackCap(p);

        const puzzleId = row[slot] as number;
        this.givePuzzle(p, puzzleId);
        if (deck === 'black') p.blackTakenThisTurn++;

        // refill from deck top — unless end rounds suppress black refills
        this.refillSlot(deck, slot);

        this.note(id, 'take', `took a ${deck} puzzle`);
        this.afterAction(id);
    }

    public take_from_deck(id: string, deck: 'white' | 'black'): void {
        const p = this.requireTurn(id);
        this.assertCanTake(p);
        const stack = deck === 'white' ? this.data.whiteDeck : this.data.blackDeck;
        if (stack.length === 0) throw new Error('That deck is empty');
        if (deck === 'black') this.assertBlackCap(p);

        const puzzleId = stack.pop() as number;
        this.givePuzzle(p, puzzleId);
        if (deck === 'black') p.blackTakenThisTurn++;

        this.maybeTriggerEnd(deck);
        this.note(id, 'take', `drew a ${deck} puzzle blind`);
        this.afterAction(id);
    }

    private assertCanTake(p: PlayerState): void {
        if (p.puzzles.length >= MAX_UNFINISHED_PUZZLES) {
            throw new Error('You already hold 4 unfinished puzzles');
        }
    }

    private assertBlackCap(p: PlayerState): void {
        if (this.data.endTriggered && p.blackTakenThisTurn >= 1) {
            throw new Error('Only 1 black puzzle may be taken per turn during the end rounds');
        }
    }

    private givePuzzle(p: PlayerState, puzzleId: number): void {
        p.puzzles.push({ puzzleId, filled: 0, placements: [] });
    }

    private refillSlot(deck: 'white' | 'black', slot: number): void {
        const stack = deck === 'white' ? this.data.whiteDeck : this.data.blackDeck;
        const row = deck === 'white' ? this.data.whiteRow : this.data.blackRow;
        // During end rounds black puzzles are not replaced.
        if (deck === 'black' && this.data.endTriggered) {
            row[slot] = null;
        } else {
            row[slot] = stack.length > 0 ? (stack.pop() as number) : null;
        }
        this.maybeTriggerEnd(deck);
    }

    private maybeTriggerEnd(deck: 'white' | 'black'): void {
        if (this.data.mode !== 'multiplayer') return;
        if (deck !== 'black') return;
        if (this.data.endTriggered) return;
        if (this.data.blackDeck.length === 0) {
            this.data.endTriggered = true;
            const n = this.data.playerOrder.length;
            // Finish the current round, then one full final round.
            this.data.finalTurnsRemaining = 2 * n - this.data.current;
        }
    }

    // ========================================================================
    // Action 2 — Recycle (multiplayer only)
    // ========================================================================

    public recycle(id: string, deck: 'white' | 'black', order?: number[]): void {
        const p = this.requireTurn(id);
        if (this.data.mode === 'solo') throw new Error('No Recycle action in the solo game');
        const row = deck === 'white' ? this.data.whiteRow : this.data.blackRow;
        const stack = deck === 'white' ? this.data.whiteDeck : this.data.blackDeck;
        const present = row.filter((x): x is number => x != null);
        if (present.length === 0) throw new Error('That row is empty');

        // place removed puzzles on the bottom of the deck (chosen order if given)
        let bottomOrder = present;
        if (order && order.length === present.length) {
            const set = new Set(present);
            if (order.every(x => set.has(x)) && new Set(order).size === order.length) {
                bottomOrder = order;
            }
        }
        // bottom of deck = front of array (top = end)
        this.data[deck === 'white' ? 'whiteDeck' : 'blackDeck'] = [...bottomOrder, ...stack];
        // refill row with 4 fresh from the top
        const refilled: (number | null)[] = [];
        const freshStack = deck === 'white' ? this.data.whiteDeck : this.data.blackDeck;
        for (let i = 0; i < ROW_SIZE; i++) {
            refilled.push(freshStack.length > 0 ? (freshStack.pop() as number) : null);
        }
        if (deck === 'white') this.data.whiteRow = refilled;
        else this.data.blackRow = refilled;

        this.note(id, 'recycle', `recycled the ${deck} row`);
        this.afterAction(id);
    }

    // ========================================================================
    // Action 3 — Upgrade
    // ========================================================================

    /** Upgrade A: take a new Level-1 piece from reserve. */
    public upgrade_take_l1(id: string): void {
        const p = this.requireTurn(id);
        const got = this.drawFromReserve('mono');
        if (!got) throw new Error('Reserve is empty');
        p.supply[got]++;
        this.note(id, 'upgrade', `took a level-1 piece`);
        this.afterAction(id);
    }

    /**
     * Upgrade B: return a supply piece and take a replacement that is the same
     * level, any lower level, or exactly one level higher.
     */
    public upgrade_swap(id: string, fromShape: ShapeId, toShape: ShapeId): void {
        const p = this.requireTurn(id);
        if (p.supply[fromShape] <= 0) throw new Error('You do not own that piece');
        const fromLevel = SHAPES[fromShape].level;
        const toLevel = SHAPES[toShape].level;
        if (toLevel > fromLevel + 1) {
            throw new Error('Can only upgrade by at most one level');
        }
        if (toLevel > MAX_LEVEL) throw new Error('No such level');
        // return the piece first, then draw the replacement (with substitution)
        p.supply[fromShape]--;
        this.data.reserve[fromShape]++;
        const got = this.drawFromReserve(toShape);
        if (!got) {
            // revert
            p.supply[fromShape]++;
            this.data.reserve[fromShape]--;
            throw new Error('Reserve cannot supply that piece');
        }
        p.supply[got]++;
        this.note(id, 'upgrade', `upgraded a piece`);
        this.afterAction(id);
    }

    // ========================================================================
    // Action 4 — Place
    // ========================================================================

    public place(id: string, puzzleIndex: number, shapeId: ShapeId, mask: number): void {
        const p = this.requireTurn(id);
        this.applyPlacement(p, puzzleIndex, shapeId, mask);
        this.note(id, 'place', `placed a piece`);
        this.afterAction(id);
    }

    /** Shared placement mutation used by Place, Master and Finishing Touches. */
    private applyPlacement(p: PlayerState, puzzleIndex: number, shapeId: ShapeId, mask: number): void {
        const inst = p.puzzles[puzzleIndex];
        if (!inst) throw new Error('No such puzzle');
        if (p.supply[shapeId] <= 0) throw new Error('You do not own that piece');
        const puzzle = PUZZLE_BY_ID[inst.puzzleId];
        // the mask must be exactly this shape's footprint (right number of cells)
        if (popcount(mask) !== SHAPES[shapeId].cells.length) {
            throw new Error('Placement does not match the piece');
        }
        if (!isPlacementValid(mask, puzzle.recessed, inst.filled)) {
            throw new Error('Illegal placement');
        }
        inst.filled |= mask;
        inst.placements.push({ shapeId, mask });
        p.supply[shapeId]--;
    }

    // ========================================================================
    // Action 5 — Master (≤ 1 per turn)
    // ========================================================================

    public master(
        id: string,
        placements: { puzzleIndex: number; shapeId: ShapeId; mask: number }[]
    ): void {
        const p = this.requireTurn(id);
        // Speed contest has no turns, so Master is not limited to once per turn.
        if (this.data.mode !== 'speed' && p.masterUsedThisTurn) throw new Error('Master already used this turn');
        if (placements.length === 0) throw new Error('Master needs at least one placement');
        const usedPuzzles = new Set<number>();
        for (const pl of placements) {
            if (usedPuzzles.has(pl.puzzleIndex)) {
                throw new Error('Master allows at most one piece per puzzle');
            }
            usedPuzzles.add(pl.puzzleIndex);
        }
        // Validate all before applying any (so a bad one aborts cleanly).
        // Apply sequentially — different puzzles never interact.
        for (const pl of placements) {
            this.applyPlacement(p, pl.puzzleIndex, pl.shapeId, pl.mask);
        }
        p.masterUsedThisTurn = true;
        this.note(id, 'master', `used Master on ${placements.length} puzzle(s)`);
        this.afterAction(id);
    }

    // ========================================================================
    // Completion sweep (after every action)
    // ========================================================================

    private sweepCompletions(p: PlayerState): void {
        let again = true;
        while (again) {
            again = false;
            for (let i = 0; i < p.puzzles.length; i++) {
                const inst = p.puzzles[i];
                const puzzle = PUZZLE_BY_ID[inst.puzzleId];
                if (inst.filled === puzzle.recessed) {
                    this.completePuzzle(p, i, puzzle);
                    again = true;
                    break; // list mutated
                }
            }
        }
    }

    private completePuzzle(p: PlayerState, index: number, puzzle: PuzzleDef): void {
        const inst = p.puzzles[index];
        // 1. return placed pieces to supply
        for (const pl of inst.placements) p.supply[pl.shapeId]++;
        // 2. take reward piece (with substitution)
        const got = this.drawFromReserve(puzzle.reward);
        if (got) p.supply[got]++;
        // 3. move puzzle to VP pile
        p.vpPile.push({ puzzleId: puzzle.id, points: puzzle.points });
        p.puzzles.splice(index, 1);
    }

    // ========================================================================
    // Turn flow
    // ========================================================================

    private afterAction(id: string): void {
        const p = this.player(id);
        this.sweepCompletions(p);
        this.data.moveCount++;

        if (this.data.mode === 'speed') {
            // No turns/action limit. The race ends when the black draw pile empties.
            if (this.data.blackDeck.length === 0) {
                this.data.cleared = true;
                this.data.phase = Phase.Finished;
            }
            return;
        }

        this.data.actionsLeft--;
        if (this.data.actionsLeft <= 0) {
            this.endTurn();
        }
    }

    /** Force end of the current turn (e.g. player chooses to pass remaining actions). */
    public pass(id: string): void {
        this.requireTurn(id);
        if (this.data.mode === 'speed') return; // no turns to pass in a race
        this.endTurn();
    }

    private endTurn(): void {
        if (this.data.mode === 'solo') {
            this.endSoloPlayerTurn();
            return;
        }
        this.advanceMultiplayerTurn();
    }

    private advanceMultiplayerTurn(): void {
        if (this.data.endTriggered && this.data.finalTurnsRemaining !== null) {
            this.data.finalTurnsRemaining--;
            if (this.data.finalTurnsRemaining <= 0) {
                this.beginFinishingTouches();
                return;
            }
        }
        const n = this.data.playerOrder.length;
        this.data.current = (this.data.current + 1) % n;
        if (this.data.current === 0) this.data.round++;
        this.data.actionsLeft = ACTIONS_PER_TURN;
        this.resetTurnFlags(this.currentPlayerId());
    }

    // ========================================================================
    // Solo opponent (deterministic)
    // ========================================================================

    /** Column index (0..2) a grid position belongs to. */
    private soloColumnOf(pos: number): number {
        return pos % 3;
    }

    /** Called when the human takes a puzzle from a grid column (moves a lock). */
    private soloOnTakeFromColumn(col: number): void {
        const solo = this.data.solo!;
        if (solo.locks[col] > 0) {
            solo.locks[col]--;
            solo.opponentSupply++;
        }
    }

    private soloRefillGrid(pos: number): void {
        const solo = this.data.solo!;
        solo.grid[pos] = solo.puzzleDeck.length > 0 ? (solo.puzzleDeck.pop() as number) : null;
    }

    /** Human takes a revealed grid puzzle (position 0..8). */
    public take_solo_grid(id: string, pos: number): void {
        const p = this.requireTurn(id);
        this.assertCanTake(p);
        const solo = this.data.solo!;
        if (pos < 0 || pos >= SOLO_GRID_SIZE || solo.grid[pos] == null) {
            throw new Error('No puzzle at that position');
        }
        const puzzleId = solo.grid[pos] as number;
        const col = this.soloColumnOf(pos);
        this.givePuzzle(p, puzzleId);
        this.soloOnTakeFromColumn(col);
        this.soloRefillGrid(pos);
        this.maybeTriggerSoloEnd();
        this.note(id, 'take', `took a grid puzzle`);
        this.afterAction(id);
    }

    /** Human takes the top of the solo draw deck blind (locks do not move). */
    public take_solo_deck(id: string): void {
        const p = this.requireTurn(id);
        this.assertCanTake(p);
        const solo = this.data.solo!;
        if (solo.puzzleDeck.length === 0) throw new Error('The draw deck is empty');
        const puzzleId = solo.puzzleDeck.pop() as number;
        this.givePuzzle(p, puzzleId);
        this.maybeTriggerSoloEnd();
        this.note(id, 'take', `drew from the deck`);
        this.afterAction(id);
    }

    private maybeTriggerSoloEnd(): void {
        const solo = this.data.solo!;
        if (!this.data.endTriggered && solo.puzzleDeck.length === 0) {
            this.data.endTriggered = true;
            // Finish current round + one more round: the player gets one more turn.
            this.data.finalTurnsRemaining = 1;
        }
    }

    private endSoloPlayerTurn(): void {
        // opponent always takes a turn after the player
        this.runOpponentTurn();

        if (this.data.endTriggered && this.data.finalTurnsRemaining !== null) {
            if (this.data.finalTurnsRemaining <= 0) {
                this.beginFinishingTouches();
                return;
            }
            this.data.finalTurnsRemaining--;
        }
        this.data.round++;
        this.data.actionsLeft = ACTIONS_PER_TURN;
        this.resetTurnFlags(this.currentPlayerId());
    }

    /** The deterministic opponent takes exactly one puzzle straight to its VP pile. */
    private runOpponentTurn(): void {
        const solo = this.data.solo!;

        // A column is locked if it has ≥1 token above it.
        const columnLocked = (col: number) => solo.locks[col] >= 1;
        const allLocked = [0, 1, 2].every(columnLocked);
        if (allLocked) {
            // remove one token from each column back to reserve, unlocking them
            for (let c = 0; c < 3; c++) if (solo.locks[c] > 0) solo.locks[c]--;
        }

        // pick target: highest points among unlocked columns; tie → lowest position
        let best: number | null = null;
        let bestPoints = -1;
        for (let pos = 0; pos < SOLO_GRID_SIZE; pos++) {
            const pid = solo.grid[pos];
            if (pid == null) continue;
            const col = this.soloColumnOf(pos);
            if (columnLocked(col)) continue;
            const points = PUZZLE_BY_ID[pid].points;
            if (points > bestPoints) {
                bestPoints = points;
                best = pos;
            }
        }
        if (best === null) {
            // nothing takeable (grid empty in all open columns) — opponent idles
            return;
        }

        const pos = best;
        const takenCol = this.soloColumnOf(pos);
        const pid = solo.grid[pos] as number;
        solo.opponentVp.push({ puzzleId: pid, points: PUZZLE_BY_ID[pid].points });

        // 1. all opponent-supply tokens → above the taken column
        solo.locks[takenCol] += solo.opponentSupply;
        solo.opponentSupply = 0;
        // 2. one token from each other column → above the taken column
        for (let c = 0; c < 3; c++) {
            if (c === takenCol) continue;
            if (solo.locks[c] > 0) {
                solo.locks[c]--;
                solo.locks[takenCol]++;
            }
        }
        // 3. refill the taken slot from the deck
        this.soloRefillGrid(pos);

        this.note('opponent', 'opponent', `opponent took a puzzle (${bestPoints} pts)`);
    }

    // ========================================================================
    // Finishing Touches
    // ========================================================================

    private beginFinishingTouches(): void {
        this.data.phase = Phase.FinishingTouches;
        for (const id of this.playerIds) {
            this.player(id).finishingDone = false;
        }
        // Solo: the opponent has no finishing touches.
    }

    /** Place a piece during Finishing Touches (−1 pt each). Completions deferred. */
    public finishing_place(id: string, puzzleIndex: number, shapeId: ShapeId, mask: number): void {
        if (this.data.phase !== Phase.FinishingTouches) throw new Error('Not finishing touches');
        const p = this.player(id);
        if (p.finishingDone) throw new Error('You already finished');
        this.applyPlacement(p, puzzleIndex, shapeId, mask);
        p.finishingTouchPieces++;
        this.note(id, 'finishing', `placed a finishing piece (−1)`);
    }

    /** A player declares they are done placing finishing pieces. */
    public finishing_done(id: string): void {
        if (this.data.phase !== Phase.FinishingTouches) throw new Error('Not finishing touches');
        this.player(id).finishingDone = true;
        if (this.playerIds.every(pid => this.player(pid).finishingDone)) {
            this.resolveFinishingTouches();
            this.scoreGame();
        }
    }

    /** After ALL finishing touches: resolve completions (no rewards). */
    private resolveFinishingTouches(): void {
        for (const id of this.playerIds) {
            const p = this.player(id);
            const keep: PuzzleInstance[] = [];
            for (const inst of p.puzzles) {
                const puzzle = PUZZLE_BY_ID[inst.puzzleId];
                if (inst.filled === puzzle.recessed) {
                    // completed during finishing touches → no reward piece
                    p.vpPile.push({ puzzleId: puzzle.id, points: puzzle.points });
                } else {
                    keep.push(inst);
                }
            }
            p.puzzles = keep;
        }
    }

    // ========================================================================
    // Scoring
    // ========================================================================

    private scoreGame(): void {
        const scores: Record<string, number> = {};
        for (const id of this.playerIds) {
            const p = this.player(id);
            let s = 0;
            for (const v of p.vpPile) s += v.points;
            for (const inst of p.puzzles) s -= PUZZLE_BY_ID[inst.puzzleId].points;
            s -= p.finishingTouchPieces;
            scores[id] = s;
        }
        this.data.scores = scores;

        if (this.data.mode === 'solo') {
            const solo = this.data.solo!;
            const oppScore = solo.opponentVp.reduce((a, v) => a + v.points, 0);
            const you = scores[this.playerIds[0]];
            // You win only if you beat the opponent; a tie goes to the opponent.
            this.data.soloResult = you > oppScore ? 'win' : 'lose';
            this.data.winnerIds = you > oppScore ? [this.playerIds[0]] : [];
            (scores as any)['opponent'] = oppScore;
        } else {
            // winner by score; tiebreak: most completed puzzles, then most pieces
            let winners: string[] = [];
            let best = -Infinity;
            for (const id of this.playerIds) {
                if (scores[id] > best) { best = scores[id]; winners = [id]; }
                else if (scores[id] === best) winners.push(id);
            }
            if (winners.length > 1) winners = this.breakTies(winners);
            this.data.winnerIds = winners;
        }
        this.data.phase = Phase.Scoring;
    }

    private breakTies(ids: string[]): string[] {
        const completed = (id: string) => this.player(id).vpPile.length;
        const pieces = (id: string) =>
            SHAPE_IDS.reduce((a, s) => a + this.player(id).supply[s], 0);
        let best = ids;
        // most completed puzzles
        const maxC = Math.max(...best.map(completed));
        best = best.filter(id => completed(id) === maxC);
        if (best.length === 1) return best;
        // most leftover pieces
        const maxP = Math.max(...best.map(pieces));
        best = best.filter(id => pieces(id) === maxP);
        return best; // remaining ties share victory
    }

    public finalize(): void {
        if (this.data.phase === Phase.Scoring) this.data.phase = Phase.Finished;
    }

    // ========================================================================
    // Getters (for view props / tests)
    // ========================================================================

    public get_phase(): Phase { return this.data.phase; }
    public get_mode(): GameMode { return this.data.mode; }
    public get_round(): number { return this.data.round; }
    public get_actions_left(): number { return this.data.actionsLeft; }
    public get_reserve(): Record<ShapeId, number> { return this.data.reserve; }
    public get_white_row(): (number | null)[] { return this.data.whiteRow; }
    public get_black_row(): (number | null)[] { return this.data.blackRow; }
    public get_white_deck_count(): number { return this.data.whiteDeck.length; }
    public get_black_deck_count(): number { return this.data.blackDeck.length; }
    public get_end_triggered(): boolean { return this.data.endTriggered; }
    public get_final_turns(): number | null { return this.data.finalTurnsRemaining; }
    public get_last_move(): LastMove | null { return this.data.lastMove; }
    public get_solo(): SoloState | null { return this.data.solo; }
    public get_move_count(): number { return this.data.moveCount; }
    public get_cleared(): boolean { return this.data.cleared; }
    public get_scores(): Record<string, number> | null { return this.data.scores; }
    public get_winners(): string[] | null { return this.data.winnerIds; }
    public get_solo_result(): 'win' | 'lose' | null { return this.data.soloResult; }
    public get_player(id: string): PlayerState | undefined { return this.data.players[id]; }
    public get_player_ids(): string[] { return [...this.playerIds]; }
    public get_player_order(): string[] { return [...this.data.playerOrder]; }
    public get_current_index(): number { return this.data.current; }
}

export default ProjectLGameState;
