/**
 * NightZooGameState.ts — the pure, framework-independent Night at the Zoo engine.
 *
 * No React / Socket.io / Multiplayr dependencies, so it is fully unit-testable
 * and serialisable (get_data / from_data). It models the whole game: the shared
 * clockwise draft, each player's private 5×5 placement puzzle, the per-animal
 * movement resolver, discard / end-of-round movement, and final scoring.
 *
 * Design notes (digital adaptations, all faithful to the routing puzzle):
 *  - Movement points earned during a player's placement are POOLED into a queue
 *    they spend freely (relaxing the double-arrow atomicity rule, which only ever
 *    mattered for warehouse timing). Points from discard / end-of-round moves are
 *    pre-locked to the specific figure that earned them.
 *  - The printed 5×5 board config lives in NightZooData.BOARD_CONFIG (a balanced
 *    designed board, identical for every player).
 */

import {
    AnimalType, ANIMALS, ANIMAL_TYPES, ACTIVE_TYPES, MIN_SETUP_MOONS, FIGURES_PER_TYPE,
    Terrain, TERRAINS, Food, ActionSymbol, Dir,
    TileDef, TILE_BY_ID, ACTION_TILES, makeBonusTile, BONUS_PER_TERRAIN,
    GRID, ZOO, EntranceDef, ENTRANCES, entranceAt, ENTRANCES_BY_TERRAIN,
    BOARD_CONFIG, PAIRED_GROUPS,
    PrintedAction, MAX_POLLEN, WOLF_SET_VP, BUTTERFLY_POLLEN_VP, figureZooVP,
    FOOD_SET_VP
} from './NightZooData';

export type { Dir };
export type Phase = 'setup' | 'draft' | 'placement' | 'endRoundMove' | 'scoring' | 'finished';
export type FigureZone = 'notDiscovered' | 'entrance' | 'neighborhood' | 'arrived';
export type MoveSource = 'arrow' | 'discard' | 'endRound' | 'bonusStep';

const DELTA: Record<Dir, [number, number]> = { N: [-1, 0], E: [0, 1], S: [1, 0], W: [0, -1] };
const DIRS: Dir[] = ['N', 'E', 'S', 'W'];

export interface Figure {
    id: string;
    type: AnimalType;
    owner: string;
    zone: FigureZone;                // notDiscovered → entrance → neighborhood → arrived
    pos: [number, number] | null;    // board cell (neighborhood) or external entrance coord (entrance)
    heading?: Dir;                   // snake
    pollen?: number;                 // butterfly
    awake?: boolean;                 // sloth
}

export interface MovementPoint {
    source: MoveSource;
    figureId: string | null;         // null = free (from an arrow); else locked
}

export type MoveOption =
    | { kind: 'slide'; dir: Dir; to: [number, number]; arrives: boolean }
    | { kind: 'step'; to: [number, number]; arrives: boolean }
    | { kind: 'rotate'; heading: Dir }
    | { kind: 'wake' };

export interface PlayerState {
    id: string;
    grid: (string | null)[][];       // 5×5 tileIds
    warehouse: (string | null)[];    // 2 slots
    figures: Figure[];
    vp: number;
    awardedPairs: string[];
    drafted: string | null;          // the tile drafted this draft (before placement)
    toPlace: string[];               // held tiles that must be placed/warehoused/discarded
    movementQueue: MovementPoint[];
    pendingDiscovers: number;
    pendingBonuses: number;
    placementDone: boolean;
    endMoveDone: boolean;
}

export interface LastMove { moveId: number; playerId: string; text: string; }

export interface ScoreBreakdown {
    base: number;      // immediate/printed VP accrued in-game
    zoo: number;       // VP from arrived animals (flat + wolf set + butterfly pollen)
    stranded: number;  // +1 per discovered-not-in-zoo
    food: number;      // best food set
    total: number;
    animalsInZoo: number;
}

export interface GameStateData {
    phase: Phase;
    activeTypes: AnimalType[];
    playerOrder: string[];
    players: Record<string, PlayerState>;
    market: (string | null)[];
    leftover: string[];
    actionDeck: string[];            // draw pile (top = end)
    bonusPiles: Record<Terrain, number>;
    bonusSerial: number;
    firstPlayer: number;             // index into playerOrder
    round: number;                   // 0..2
    draftIndex: number;              // 0..4 within the round
    draftPickIndex: number;          // picks taken this draft (0..n)
    winningTerrain: Terrain | null;  // set during end-of-round movement
    lastMove: LastMove | null;
    moveCounter: number;
    scores: Record<string, ScoreBreakdown> | null;
    winnerIds: string[] | null;
}

// ============================================================================
// Pure geometry helpers (shared with the views)
// ============================================================================

/** A cell an animal may move ONTO: the Zoo, or a board cell holding a tile.
 *  (Entrances are external and are departure-only — animals never move onto them.) */
export function walkable(grid: (string | null)[][], cell: [number, number]): boolean {
    const [r, c] = cell;
    if (r === ZOO[0] && c === ZOO[1]) return true;
    if (r < 0 || r >= GRID || c < 0 || c >= GRID) return false;
    return grid[r][c] !== null;
}

const isZoo = (cell: [number, number]) => cell[0] === ZOO[0] && cell[1] === ZOO[1];
const step = (cell: [number, number], dir: Dir): [number, number] =>
    [cell[0] + DELTA[dir][0], cell[1] + DELTA[dir][1]];

function slideStop(grid: (string | null)[][], from: [number, number], dir: Dir): { to: [number, number]; arrives: boolean } | null {
    let cur = from;
    let moved = false;
    // If we begin on the Zoo we cannot slide further out.
    while (true) {
        if (isZoo(cur) && moved) return { to: cur, arrives: true };
        const nxt = step(cur, dir);
        if (!walkable(grid, nxt)) break;
        cur = nxt; moved = true;
        if (isZoo(cur)) return { to: cur, arrives: true };
    }
    return moved ? { to: cur, arrives: false } : null;
}

/** All legal move options for a figure given its owner's grid. Pure. */
export function legalMoveOptions(fig: Figure, grid: (string | null)[][]): MoveOption[] {
    if ((fig.zone !== 'neighborhood' && fig.zone !== 'entrance') || !fig.pos) return [];

    // ---- from an external entrance: only inward, onto the adjacent board cell ----
    if (fig.zone === 'entrance') {
        const ent = entranceAt(fig.pos[0], fig.pos[1]);
        if (!ent) return [];
        if (fig.type === 'sloth' && fig.awake === false) return [{ kind: 'wake' }];
        const cell = ent.cell;
        if (!walkable(grid, cell)) return [];
        if (fig.type === 'penguin') {
            let cur = cell; let arrives = isZoo(cell);
            if (!arrives) { const res = slideStop(grid, cell, ent.inward); if (res) { cur = res.to; arrives = res.arrives; } }
            return [{ kind: 'slide', dir: ent.inward, to: cur, arrives }];
        }
        if (fig.type === 'snake') {
            const out: MoveOption[] = [{ kind: 'step', to: cell, arrives: isZoo(cell) }];
            for (const h of DIRS) if (h !== fig.heading) out.push({ kind: 'rotate', heading: h });
            return out;
        }
        return [{ kind: 'step', to: cell, arrives: isZoo(cell) }];
    }

    const opts: MoveOption[] = [];
    const pos = fig.pos as [number, number];

    if (fig.type === 'sloth' && fig.awake === false) return [{ kind: 'wake' }];

    if (fig.type === 'penguin') {
        for (const dir of DIRS) {
            const res = slideStop(grid, pos, dir);
            if (res) opts.push({ kind: 'slide', dir, to: res.to, arrives: res.arrives });
        }
        return opts;
    }

    if (fig.type === 'snake') {
        const heading = fig.heading as Dir;
        const fwd = step(pos, heading);
        if (walkable(grid, fwd)) opts.push({ kind: 'step', to: fwd, arrives: isZoo(fwd) });
        for (const h of DIRS) if (h !== heading) opts.push({ kind: 'rotate', heading: h });
        return opts;
    }

    // cheetah / wolf / butterfly / awake sloth: adjacent walkable steps
    for (const dir of DIRS) {
        const to = step(pos, dir);
        if (walkable(grid, to)) opts.push({ kind: 'step', to, arrives: isZoo(to) });
    }
    return opts;
}

/**
 * Whether `tile` is allowed to be placed on board cell (r,c). A cell's condition
 * is a hard **placement restriction**: a terrain-condition cell accepts only tiles
 * of that terrain; a symbol-condition cell accepts only Action tiles showing that
 * symbol. Empty, paired and unconditioned cells accept any tile. Pure.
 */
export function canPlaceOnCell(tile: TileDef, r: number, c: number): boolean {
    if (r < 0 || r >= GRID || c < 0 || c >= GRID) return false;
    if (r === ZOO[0] && c === ZOO[1]) return false;
    const cfg = BOARD_CONFIG[r][c];
    const cond = cfg && cfg.condition;
    if (!cond) return true;
    if (cond.type === 'terrain') return tile.terrain === cond.requires;
    if (cond.type === 'symbol') return tile.kind === 'action' && tile.actions.includes(cond.requires);
    return true; // paired cells have no placement restriction
}

// ============================================================================
// Small utils
// ============================================================================

function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function pickActiveTypes(): AnimalType[] {
    for (let attempt = 0; attempt < 200; attempt++) {
        const three = shuffle(ANIMAL_TYPES).slice(0, ACTIVE_TYPES);
        const moons = three.reduce((a, t) => a + ANIMALS[t].difficulty, 0);
        if (moons >= MIN_SETUP_MOONS) return three;
    }
    // fallback (guaranteed ≥6): snake+butterfly+sloth = 2+3+4
    return ['snake', 'butterfly', 'sloth'];
}

// ============================================================================
// The engine
// ============================================================================

export class NightZooGameState {
    private data: GameStateData;
    private readonly playerIds: string[];

    constructor(playerIds: string[]) {
        this.playerIds = [...playerIds];
        this.data = NightZooGameState.blank(this.playerIds);
    }

    private static blank(ids: string[]): GameStateData {
        return {
            phase: 'setup',
            activeTypes: [],
            playerOrder: [...ids],
            players: {},
            market: [],
            leftover: [],
            actionDeck: [],
            bonusPiles: { grass: 0, rocks: 0, sand: 0 },
            bonusSerial: 0,
            firstPlayer: 0,
            round: 0,
            draftIndex: 0,
            draftPickIndex: 0,
            winningTerrain: null,
            lastMove: null,
            moveCounter: 0,
            scores: null,
            winnerIds: null
        };
    }

    public static from_data(data: GameStateData, playerIds: string[]): NightZooGameState {
        const gs = new NightZooGameState(playerIds);
        gs.data = { ...data };
        return gs;
    }
    public get_data(): GameStateData { return this.data; }

    // ------------------------------------------------------------------
    // Setup
    // ------------------------------------------------------------------

    public start_game(opts: { activeTypes?: AnimalType[] } = {}): void {
        const ids = this.playerIds;
        this.data = NightZooGameState.blank(ids);
        this.data.activeTypes = opts.activeTypes && opts.activeTypes.length === ACTIVE_TYPES
            ? [...opts.activeTypes]
            : pickActiveTypes();

        this.data.actionDeck = shuffle(ACTION_TILES.map(t => t.id));
        this.data.bonusPiles = { grass: BONUS_PER_TERRAIN, rocks: BONUS_PER_TERRAIN, sand: BONUS_PER_TERRAIN };

        for (const id of ids) this.data.players[id] = this.blankPlayer(id);

        // deal the first market (players + 1)
        this.data.market = this.draw(ids.length + 1);
        this.data.phase = 'draft';
        this.beginDraft();
    }

    /** Pick 3 starting entrances on three DIFFERENT terrains, in random order. */
    private pickStartEntrances(): EntranceDef[] {
        const pick = (arr: EntranceDef[]) => arr[Math.floor(Math.random() * arr.length)];
        // one random entrance per terrain guarantees three distinct terrains
        const oneEach = TERRAINS.map(t => pick(ENTRANCES_BY_TERRAIN[t]));
        return shuffle(oneEach);
    }

    private blankPlayer(id: string): PlayerState {
        const grid: (string | null)[][] = Array.from({ length: GRID }, () => Array(GRID).fill(null));
        const figures: Figure[] = [];
        // random per-player starting entrances (each player may differ), all on distinct terrains
        const starts = this.pickStartEntrances();
        this.data.activeTypes.forEach((type, ti) => {
            for (let i = 0; i < FIGURES_PER_TYPE; i++) {
                const fig: Figure = {
                    id: `${id}~${type}~${i}`, type, owner: id,
                    zone: 'notDiscovered', pos: null
                };
                if (type === 'snake') fig.heading = 'E';
                if (type === 'butterfly') fig.pollen = 0;
                if (type === 'sloth') fig.awake = true;
                figures.push(fig);
            }
            // one figure of each active type starts discovered on a distinct-terrain entrance
            this.discoverOnto(figures[figures.length - FIGURES_PER_TYPE], starts[ti]);
        });
        return {
            id, grid, warehouse: [null, null], figures,
            vp: 0, awardedPairs: [], drafted: null, toPlace: [],
            movementQueue: [], pendingDiscovers: 0, pendingBonuses: 0,
            placementDone: false, endMoveDone: false
        };
    }

    /** Place a not-yet-discovered figure onto an (external) entrance (it becomes movable). */
    private discoverOnto(fig: Figure, ent: EntranceDef): void {
        fig.zone = 'entrance';
        fig.pos = [ent.pos[0], ent.pos[1]];
        if (fig.type === 'snake') fig.heading = ent.inward;
        if (fig.type === 'sloth') fig.awake = true;
    }

    private draw(n: number): string[] {
        const out: string[] = [];
        for (let i = 0; i < n; i++) {
            if (this.data.actionDeck.length === 0) this.replenishDeck();
            if (this.data.actionDeck.length === 0) break;
            out.push(this.data.actionDeck.pop() as string);
        }
        return out;
    }

    /** Reshuffle every Action tile not currently in play back into the deck. */
    private replenishDeck(): void {
        const used = new Set<string>();
        for (const id of this.playerIds) {
            const p = this.data.players[id];
            if (!p) continue;
            for (const row of p.grid) for (const t of row) if (t) used.add(t);
            for (const t of p.warehouse) if (t) used.add(t);
            for (const t of p.toPlace) used.add(t);
            if (p.drafted) used.add(p.drafted);
        }
        for (const t of this.data.market) if (t) used.add(t);
        for (const t of this.data.leftover) used.add(t);
        this.data.actionDeck = shuffle(ACTION_TILES.map(t => t.id).filter(id => !used.has(id)));
    }

    // ------------------------------------------------------------------
    // Accessors / small helpers
    // ------------------------------------------------------------------

    private player(id: string): PlayerState {
        const p = this.data.players[id];
        if (!p) throw new Error('Unknown player ' + id);
        return p;
    }
    private note(playerId: string, text: string): void {
        this.data.moveCounter++;
        this.data.lastMove = { moveId: this.data.moveCounter, playerId, text };
    }
    private n(): number { return this.playerIds.length; }

    public currentDrafter(): string {
        return this.data.playerOrder[(this.data.firstPlayer + this.data.draftPickIndex) % this.n()];
    }

    // ------------------------------------------------------------------
    // Drafting
    // ------------------------------------------------------------------

    private beginDraft(): void {
        this.data.phase = 'draft';
        this.data.draftPickIndex = 0;
        for (const id of this.playerIds) {
            const p = this.player(id);
            p.drafted = null;
            p.placementDone = false;
        }
    }

    public draft_take(id: string, slot: number): void {
        if (this.data.phase !== 'draft') throw new Error('Not the drafting phase');
        if (id !== this.currentDrafter()) throw new Error('Not your pick');
        const tileId = this.data.market[slot];
        if (tileId == null) throw new Error('No tile in that market slot');
        this.data.market[slot] = null;
        this.player(id).drafted = tileId;
        this.data.draftPickIndex++;
        this.note(id, 'drafted a tile');

        if (this.data.draftPickIndex >= this.n()) {
            // push the single remaining market tile to the leftover zone
            const rest = this.data.market.filter((x): x is string => x != null);
            if (rest.length > 0) this.data.leftover.push(rest[0]);
            this.data.market = [];
            this.enterPlacement();
        }
    }

    private enterPlacement(): void {
        this.data.phase = 'placement';
        for (const id of this.playerIds) {
            const p = this.player(id);
            p.toPlace = p.drafted ? [p.drafted] : [];
            p.drafted = null;
            p.movementQueue = [];
            p.pendingDiscovers = 0;
            p.pendingBonuses = 0;
            p.placementDone = false;
        }
    }

    // ------------------------------------------------------------------
    // Placement
    // ------------------------------------------------------------------

    private requirePlacing(id: string): PlayerState {
        if (this.data.phase !== 'placement') throw new Error('Not the placement phase');
        const p = this.player(id);
        if (p.placementDone) throw new Error('You have finished placing');
        return p;
    }

    private takeHeld(p: PlayerState, tileId: string): void {
        const i = p.toPlace.indexOf(tileId);
        if (i >= 0) { p.toPlace.splice(i, 1); return; }
        const w = p.warehouse.indexOf(tileId);
        if (w >= 0) { p.warehouse[w] = null; return; }
        throw new Error('You are not holding that tile');
    }

    public place_tile(id: string, tileId: string, r: number, c: number, actionChoice?: ActionSymbol): void {
        const p = this.requirePlacing(id);
        if (!p.toPlace.includes(tileId)) throw new Error('That tile is not ready to place');
        if (r < 0 || r >= GRID || c < 0 || c >= GRID) throw new Error('Off the board');
        if (r === ZOO[0] && c === ZOO[1]) throw new Error('The Zoo never takes a tile');
        if (p.grid[r][c] !== null) throw new Error('That cell is already covered');
        const def = TILE_BY_ID[tileId] || this.bonusDef(tileId);
        if (!canPlaceOnCell(def, r, c)) throw new Error('That tile does not meet this cell\'s requirement');
        if (def.kind === 'action' && def.actions.length > 1 && (!actionChoice || !def.actions.includes(actionChoice))) {
            throw new Error('Choose which of the two actions to use');
        }
        this.takeHeld(p, tileId);
        p.grid[r][c] = tileId;
        this.resolveCellActions(p, [r, c], def, actionChoice);
        this.note(id, 'placed a tile');
    }

    public warehouse_tile(id: string, tileId: string): void {
        const p = this.requirePlacing(id);
        if (!p.toPlace.includes(tileId)) throw new Error('That tile is not in hand');
        const slot = p.warehouse.indexOf(null);
        if (slot < 0) throw new Error('The warehouse is full (2)');
        this.takeHeld(p, tileId);
        p.warehouse[slot] = tileId;
        this.note(id, 'stored a tile in the warehouse');
    }

    public deploy_warehouse(id: string, slot: number): void {
        const p = this.requirePlacing(id);
        const tileId = p.warehouse[slot];
        if (tileId == null) throw new Error('Empty warehouse slot');
        p.warehouse[slot] = null;
        p.toPlace.push(tileId);
    }

    /** Discard a held (in-hand or warehoused) tile for a special move (§6.3). */
    public discard_tile(id: string, tileId: string): void {
        const p = this.requirePlacing(id);
        const def = TILE_BY_ID[tileId] || this.bonusDef(tileId);
        if (!def) throw new Error('Unknown tile');
        this.takeHeld(p, tileId);
        this.grantDiscardMoves(p, def.terrain);
        this.note(id, 'discarded a tile for a special move');
    }

    private bonusDef(tileId: string): TileDef {
        // reconstruct a bonus tile def from its id (B-<terrain>-<serial>)
        const m = /^B-(grass|rocks|sand)-(\d+)$/.exec(tileId);
        if (!m) return TILE_BY_ID[tileId];
        return makeBonusTile(m[1] as Terrain, parseInt(m[2], 10));
    }

    private grantDiscardMoves(p: PlayerState, terrain: Terrain): void {
        for (const fig of p.figures) {
            if ((fig.zone === 'neighborhood' || fig.zone === 'entrance') && fig.pos && this.terrainAt(p, fig.pos) === terrain) {
                p.movementQueue.push({ source: 'discard', figureId: fig.id });
            }
        }
    }

    /** Terrain of a position: an external entrance's terrain, else a placed tile's terrain, else null. */
    private terrainAt(p: PlayerState, pos: [number, number]): Terrain | null {
        const ent = entranceAt(pos[0], pos[1]);
        if (ent) return ent.terrain;
        const [r, c] = pos;
        if (r < 0 || r >= GRID || c < 0 || c >= GRID) return null;
        const tileId = p.grid[r][c];
        if (!tileId) return null;
        const def = TILE_BY_ID[tileId] || this.bonusDef(tileId);
        return def ? def.terrain : null;
    }

    // ---- action resolution -------------------------------------------

    private addPoints(p: PlayerState, count: number, source: MoveSource = 'arrow'): void {
        for (let i = 0; i < count; i++) p.movementQueue.push({ source, figureId: null });
    }

    private applyPrinted(p: PlayerState, a: PrintedAction): void {
        switch (a.kind) {
            case 'move': this.addPoints(p, a.amount); break;
            case 'discover': p.pendingDiscovers++; break;
            case 'bonus': p.pendingBonuses++; break;
            case 'vp': p.vp += a.amount; break;
        }
    }

    private applySymbol(p: PlayerState, s: ActionSymbol): void {
        switch (s) {
            case 'move1': this.addPoints(p, 1); break;
            case 'move2': this.addPoints(p, 2); break;
            case 'discover': p.pendingDiscovers++; break;
            case 'bonus': p.pendingBonuses++; break;
            case 'vp1': p.vp += 1; break;
            case 'vp2': p.vp += 2; break;
        }
    }

    private resolveCellActions(p: PlayerState, cell: [number, number], tile: TileDef, actionChoice?: ActionSymbol): void {
        const [r, c] = cell;

        // 1. the tile's own action (choose one if it shows two)
        if (tile.kind === 'action' && tile.actions.length > 0) {
            let chosen = tile.actions[0];
            if (tile.actions.length > 1) {
                if (actionChoice && tile.actions.includes(actionChoice)) chosen = actionChoice;
            }
            this.applySymbol(p, chosen);
        }

        // 2. the printed space action(s) / paired bonus
        const cfg = BOARD_CONFIG[r][c];
        if (!cfg) return;
        if (cfg.condition && cfg.condition.type === 'paired') {
            this.checkPaired(p, cfg.condition.group);
            return; // paired cells award only via the pairing
        }
        const cond = cfg.condition;
        let ok = true;
        if (cond && cond.type === 'symbol') ok = tile.kind === 'action' && tile.actions.includes(cond.requires);
        else if (cond && cond.type === 'terrain') ok = tile.terrain === cond.requires;
        if (ok) for (const a of cfg.printedActions) this.applyPrinted(p, a);
    }

    private checkPaired(p: PlayerState, group: string): void {
        if (p.awardedPairs.includes(group)) return;
        const g = PAIRED_GROUPS[group];
        // one member is a pre-terrained entrance cell; terrainAt covers both
        const terrains = g.cells.map(([r, c]) => this.terrainAt(p, [r, c]));
        if (terrains.every(t => t !== null) && terrains[0] === terrains[1]) {
            p.awardedPairs.push(group);
            if (g.reward === 'vp5') p.vp += 5;
            else if (g.reward === 'move2') this.addPoints(p, 2);
            else if (g.reward === 'bonus2') p.pendingBonuses += 2;
        }
    }

    // ---- discover / bonus pending choices -----------------------------

    public resolve_discover(id: string, type: AnimalType, r: number, c: number): void {
        const p = this.requirePlacing(id);
        if (p.pendingDiscovers <= 0) throw new Error('No discover to resolve');
        if (!this.data.activeTypes.includes(type)) throw new Error('That animal is not in play');
        const ent = entranceAt(r, c);
        if (!ent) throw new Error('Animals can only be discovered onto an entrance cell');
        const fig = p.figures.find(f => f.type === type && f.zone === 'notDiscovered');
        if (!fig) throw new Error('No undiscovered ' + type + ' remaining');
        this.discoverOnto(fig, ent);
        p.pendingDiscovers--;
        this.note(id, `discovered a ${type}`);
    }

    public resolve_bonus(id: string, terrain: Terrain): void {
        const p = this.requirePlacing(id);
        if (p.pendingBonuses <= 0) throw new Error('No bonus to take');
        if (this.data.bonusPiles[terrain] <= 0) throw new Error('That bonus pile is empty');
        this.data.bonusPiles[terrain]--;
        const tile = makeBonusTile(terrain, this.data.bonusSerial++);
        p.pendingBonuses--;
        p.toPlace.push(tile.id);
        this.note(id, `took a ${terrain} bonus tile`);
    }

    // ---- movement resolution -----------------------------------------

    private consumePoint(p: PlayerState, figureId: string): MovementPoint {
        let idx = p.movementQueue.findIndex(pt => pt.figureId === figureId);
        if (idx < 0) idx = p.movementQueue.findIndex(pt => pt.figureId === null);
        if (idx < 0) throw new Error('No movement point available for that animal');
        return p.movementQueue.splice(idx, 1)[0];
    }

    private optionsEqual(a: MoveOption, b: MoveOption): boolean {
        if (a.kind !== b.kind) return false;
        if (a.kind === 'rotate' && b.kind === 'rotate') return a.heading === b.heading;
        if (a.kind === 'wake') return true;
        if ((a.kind === 'step' || a.kind === 'slide') && (b.kind === 'step' || b.kind === 'slide')) {
            return a.to[0] === b.to[0] && a.to[1] === b.to[1];
        }
        return false;
    }

    public resolve_move(id: string, figureId: string, option: MoveOption): void {
        if (this.data.phase !== 'placement' && this.data.phase !== 'endRoundMove') {
            throw new Error('Not a movement phase');
        }
        const p = this.player(id);
        const fig = p.figures.find(f => f.id === figureId);
        if (!fig) throw new Error('Unknown figure');
        if (fig.zone !== 'neighborhood' && fig.zone !== 'entrance') throw new Error('That animal cannot move');

        const legal = legalMoveOptions(fig, p.grid);
        if (!legal.some(o => this.optionsEqual(o, option))) throw new Error('Illegal move');

        const point = this.consumePoint(p, figureId);
        this.applyMove(p, fig, option, point.source);
    }

    private applyMove(p: PlayerState, fig: Figure, option: MoveOption, source: MoveSource): void {
        let moved = false;
        let arrived = false;

        switch (option.kind) {
            case 'rotate':
                fig.heading = option.heading;
                break;
            case 'wake':
                fig.awake = true;
                break;
            case 'slide':
            case 'step': {
                const to = option.to;
                fig.zone = 'neighborhood';
                fig.pos = [to[0], to[1]];
                moved = true;
                if (fig.type === 'snake') fig.heading = option.kind === 'slide' ? option.dir : fig.heading;
                if (option.arrives || (to[0] === ZOO[0] && to[1] === ZOO[1])) arrived = true;
                break;
            }
        }

        // butterfly gains pollen on a discard move that actually moves it
        if (fig.type === 'butterfly' && source === 'discard' && moved) {
            fig.pollen = Math.min(MAX_POLLEN, (fig.pollen ?? 0) + 1);
        }
        // sloth falls asleep after moving while awake
        if (fig.type === 'sloth' && option.kind === 'step') fig.awake = false;

        if (arrived) {
            this.arrive(p, fig);
            return;
        }

        // cheetah gets a +1 tile on a discard move
        if (fig.type === 'cheetah' && source === 'discard' && moved) {
            p.movementQueue.unshift({ source: 'bonusStep', figureId: fig.id });
        }
    }

    private arrive(p: PlayerState, fig: Figure): void {
        fig.zone = 'arrived';
        fig.pos = null;
        // any remaining movement points locked to this figure are lost
        p.movementQueue = p.movementQueue.filter(pt => pt.figureId !== fig.id);
        this.note(p.id, `a ${fig.type} reached the Zoo`);
    }

    /** Forfeit one movement point (optionally the next one locked to a figure). */
    public skip_move(id: string, figureId?: string): void {
        const p = this.player(id);
        let idx = figureId ? p.movementQueue.findIndex(pt => pt.figureId === figureId) : -1;
        if (idx < 0) idx = p.movementQueue.findIndex(pt => figureId ? pt.figureId === null : true);
        if (idx >= 0) p.movementQueue.splice(idx, 1);
    }

    // ------------------------------------------------------------------
    // Finishing a placement / maintenance
    // ------------------------------------------------------------------

    public finish_placement(id: string): void {
        const p = this.requirePlacing(id);
        if (p.toPlace.length > 0) throw new Error('You still hold tiles to resolve');
        // optional pendings are forfeited
        p.movementQueue = [];
        p.pendingDiscovers = 0;
        p.pendingBonuses = 0;
        p.placementDone = true;
        this.note(id, 'finished placing');
        if (this.playerIds.every(pid => this.player(pid).placementDone)) this.maintenance();
    }

    private maintenance(): void {
        // refresh market and pass the first-player token
        this.data.market = this.draw(this.n() + 1);
        this.data.firstPlayer = (this.data.firstPlayer + 1) % this.n();

        if (this.data.draftIndex >= 4) {
            this.beginEndRoundMovement();
        } else {
            this.data.draftIndex++;
            this.beginDraft();
        }
    }

    // ------------------------------------------------------------------
    // End-of-round movement
    // ------------------------------------------------------------------

    private beginEndRoundMovement(): void {
        const terrain = this.mostFrequentLeftoverTerrain();
        this.data.winningTerrain = terrain;
        this.data.phase = 'endRoundMove';
        for (const id of this.playerIds) {
            const p = this.player(id);
            p.endMoveDone = false;
            p.movementQueue = [];
            if (terrain) {
                for (const fig of p.figures) {
                    if ((fig.zone === 'neighborhood' || fig.zone === 'entrance') && fig.pos && this.terrainAt(p, fig.pos) === terrain) {
                        p.movementQueue.push({ source: 'endRound', figureId: fig.id });
                    }
                }
            }
            // players with nothing to move are auto-done
            if (p.movementQueue.length === 0) p.endMoveDone = true;
        }
        this.note('', `end-of-round movement: ${terrain ?? 'no'} terrain`);
        if (this.playerIds.every(pid => this.player(pid).endMoveDone)) this.afterEndRound();
    }

    private mostFrequentLeftoverTerrain(): Terrain | null {
        if (this.data.leftover.length === 0) return null;
        const counts: Record<Terrain, number> = { grass: 0, rocks: 0, sand: 0 };
        for (const tileId of this.data.leftover) {
            const def = TILE_BY_ID[tileId] || this.bonusDef(tileId);
            if (def) counts[def.terrain]++;
        }
        // tie → the leftmost tile's terrain wins
        let best: Terrain | null = null;
        let bestCount = -1;
        for (const t of TERRAINS) {
            if (counts[t] > bestCount) { bestCount = counts[t]; best = t; }
        }
        const maxCount = bestCount;
        const tied = TERRAINS.filter(t => counts[t] === maxCount);
        if (tied.length > 1) {
            for (const tileId of this.data.leftover) {
                const def = TILE_BY_ID[tileId] || this.bonusDef(tileId);
                if (def && tied.includes(def.terrain)) return def.terrain;
            }
        }
        return best;
    }

    public finish_end_move(id: string): void {
        if (this.data.phase !== 'endRoundMove') throw new Error('Not the end-of-round movement');
        const p = this.player(id);
        p.movementQueue = [];
        p.endMoveDone = true;
        if (this.playerIds.every(pid => this.player(pid).endMoveDone)) this.afterEndRound();
    }

    private afterEndRound(): void {
        // discard the leftover zone
        this.data.leftover = [];
        this.data.winningTerrain = null;
        if (this.data.round >= 2) {
            this.scoreGame();
        } else {
            this.data.round++;
            this.data.draftIndex = 0;
            this.beginDraft();
        }
    }

    // ------------------------------------------------------------------
    // Scoring
    // ------------------------------------------------------------------

    public scoreGame(): void {
        const scores: Record<string, ScoreBreakdown> = {};
        for (const id of this.playerIds) {
            scores[id] = this.scorePlayer(id);
        }
        this.data.scores = scores;

        // winner: most total; tie → most animals in Zoo; else shared
        let best = -Infinity;
        let winners: string[] = [];
        for (const id of this.playerIds) {
            const t = scores[id].total;
            if (t > best) { best = t; winners = [id]; }
            else if (t === best) winners.push(id);
        }
        if (winners.length > 1) {
            const maxZoo = Math.max(...winners.map(id => scores[id].animalsInZoo));
            const filtered = winners.filter(id => scores[id].animalsInZoo === maxZoo);
            winners = filtered;
        }
        this.data.winnerIds = winners;
        this.data.phase = 'scoring';
    }

    private scorePlayer(id: string): ScoreBreakdown {
        const p = this.player(id);
        const base = p.vp;

        // arrived animals
        let zoo = 0;
        let wolves = 0;
        let animalsInZoo = 0;
        for (const fig of p.figures) {
            if (fig.zone !== 'arrived') continue;
            animalsInZoo++;
            if (fig.type === 'wolf') { wolves++; continue; }
            if (fig.type === 'butterfly') { zoo += figureZooVP('butterfly', { pollen: fig.pollen ?? 0 }); continue; }
            zoo += ANIMALS[fig.type].zooVP ?? 0;
        }
        zoo += WOLF_SET_VP[Math.min(wolves, 3)] ?? 0;

        // stranded discovered figures: +1 each
        let stranded = 0;
        for (const fig of p.figures) {
            if (fig.zone === 'neighborhood' || fig.zone === 'entrance') stranded++;
        }

        // best food set (neighborhood tiles only)
        const foods = new Set<Food>();
        for (let r = 0; r < GRID; r++) {
            for (let c = 0; c < GRID; c++) {
                const tileId = p.grid[r][c];
                if (!tileId) continue;
                const def = TILE_BY_ID[tileId];
                if (def && def.food) foods.add(def.food);
            }
        }
        const food = FOOD_SET_VP[foods.size] ?? 0;

        const total = base + zoo + stranded + food;
        return { base, zoo, stranded, food, total, animalsInZoo };
    }

    // ------------------------------------------------------------------
    // Getters for view props / tests
    // ------------------------------------------------------------------

    public get_phase(): Phase { return this.data.phase; }
    public get_active_types(): AnimalType[] { return [...this.data.activeTypes]; }
    public get_round(): number { return this.data.round; }
    public get_draft_index(): number { return this.data.draftIndex; }
    public get_draft_number(): number { return this.data.round * 5 + this.data.draftIndex + 1; }
    public get_market(): (string | null)[] { return [...this.data.market]; }
    public get_leftover(): string[] { return [...this.data.leftover]; }
    public get_first_player(): number { return this.data.firstPlayer; }
    public get_winning_terrain(): Terrain | null { return this.data.winningTerrain; }
    public get_last_move(): LastMove | null { return this.data.lastMove; }
    public get_scores(): Record<string, ScoreBreakdown> | null { return this.data.scores; }
    public get_winners(): string[] | null { return this.data.winnerIds; }
    public get_player(id: string): PlayerState | undefined { return this.data.players[id]; }
    public get_player_order(): string[] { return [...this.data.playerOrder]; }
    public get_bonus_piles(): Record<Terrain, number> { return { ...this.data.bonusPiles }; }
    public get_deck_count(): number { return this.data.actionDeck.length; }
    public live_score(id: string): ScoreBreakdown { return this.scorePlayer(id); }
}

export default NightZooGameState;
