/**
 * CourtisansGameState.ts - Standalone game engine for "Courtisans".
 *
 * A "take that" set-collection / bluffing game. Every turn a player plays exactly
 * one card into EACH of three zones — the shared Queen's Table (which sways a
 * family up or down in the Queen's esteem), their OWN domain (which scores for
 * them), and an OPPONENT's domain (which scores for that opponent) — in any order.
 * When a family ends the game esteemed, each courtier of that family in your domain
 * is worth +1 (nobles +2); a fallen family costs -1 (-2). Fulfilled secret
 * missions add +3 each.
 *
 * Six families (butterfly, toad, nightingale, hare, stag, carp), each with 15
 * cards across five roles:
 *   - noble (4)    : counts as TWO cards everywhere (table tally + domain score)
 *   - guard (3)    : can never be eliminated by an assassin
 *   - spy (2)      : always face down; family hidden from everyone (incl. owner)
 *                    until end game, when it moves to its true family column
 *   - assassin (2) : on placement MAY eliminate one other card in the same area
 *   - plain (4)    : no effect
 *
 * This class is pure (no React / Multiplayr / network dependencies) and is
 * serialised to JSON between host ticks, so it exposes get_data / from_data
 * rehydration helpers exactly like the other decoupled game states.
 *
 * Hidden information: spy identities (family + role) are NEVER exposed while in
 * play, not even to the owner. Hands and secret missions are private to their
 * owner. The host is responsible for redacting the full state before pushing it
 * to clients — this class simply holds the truth.
 */

// ==========================================================
// Domain vocabulary
// ==========================================================

export type Family = 'butterfly' | 'toad' | 'nightingale' | 'hare' | 'stag' | 'carp';
export type Role = 'noble' | 'guard' | 'spy' | 'assassin' | 'plain';
export type Level = 'above' | 'below';
export type Zone = 'table' | 'ownDomain' | 'oppDomain';
export type Status = 'Setup' | 'Playing' | 'GameOver';
export type FamilyStatus = 'esteemed' | 'fallen' | 'neutral';

export const FAMILIES: Family[] = ['butterfly', 'toad', 'nightingale', 'hare', 'stag', 'carp'];
export const ROLES: Role[] = ['noble', 'guard', 'spy', 'assassin', 'plain'];

// Per-family role composition (sums to 15).
export const ROLE_COUNTS: Record<Role, number> = {
    noble: 4,
    guard: 3,
    spy: 2,
    assassin: 2,
    plain: 4
};

// Cards removed face-down at setup, by player count (§2.4).
export const REMOVE_BY_PLAYERS: Record<number, number> = { 2: 30, 3: 18, 4: 6, 5: 0 };

export const HAND_SIZE = 3;

export interface Card {
    id: string;       // e.g. "stag.noble.1"
    family: Family;
    role: Role;
}

export function weightOf(card: Card): number {
    return card.role === 'noble' ? 2 : 1;
}

// ==========================================================
// Secret missions
// ==========================================================

export type MissionColor = 'blue' | 'white';
export type MissionType =
    | 'family_status'                 // a named family is fallen from grace
    | 'table_family_count_threshold'  // >=1 family with >=5 (weighted) cards below
    | 'table_all_families_present'    // >=1 card of every family placed below
    | 'status_count'                  // count of families with a given status vs threshold
    | 'neighbor_family_compare'       // left neighbour has more of {family} than you
    | 'own_role_count';               // you hold >= N of a role in your domain

export interface Mission {
    id: string;
    color: MissionColor;
    type: MissionType;
    reward: number;             // always 3
    params: {
        family?: Family;
        requiredStatus?: FamilyStatus;
        level?: Level;
        minCardsInFamily?: number;
        minFamilies?: number;
        minPerFamily?: number;
        status?: FamilyStatus;
        comparator?: '<=' | '>=' | '>';
        threshold?: number;
        target?: 'left';
        role?: Role;
    };
}

// The full, canonical catalogue: 10 blue + 10 white (§7).
export function buildMissionCatalog(): { blue: Mission[]; white: Mission[] } {
    const blue: Mission[] = [];
    // B1-B6: "The {family} family is fallen from grace at court."
    FAMILIES.forEach((family, i) => {
        blue.push({
            id: `B${i + 1}`, color: 'blue', type: 'family_status', reward: 3,
            params: { family, requiredStatus: 'fallen' }
        });
    });
    blue.push({
        id: 'B7', color: 'blue', type: 'table_family_count_threshold', reward: 3,
        params: { level: 'below', minCardsInFamily: 5, minFamilies: 1 }
    });
    blue.push({
        id: 'B8', color: 'blue', type: 'table_all_families_present', reward: 3,
        params: { level: 'below', minPerFamily: 1 }
    });
    blue.push({
        id: 'B9', color: 'blue', type: 'status_count', reward: 3,
        params: { status: 'esteemed', comparator: '<=', threshold: 3 }
    });
    blue.push({
        id: 'B10', color: 'blue', type: 'status_count', reward: 3,
        params: { status: 'fallen', comparator: '>=', threshold: 2 }
    });

    const white: Mission[] = [];
    // W1-W6: "The player to your left has more {family} cards than you."
    FAMILIES.forEach((family, i) => {
        white.push({
            id: `W${i + 1}`, color: 'white', type: 'neighbor_family_compare', reward: 3,
            params: { family, target: 'left', comparator: '>' }
        });
    });
    white.push({ id: 'W7', color: 'white', type: 'own_role_count', reward: 3, params: { role: 'noble', comparator: '>=', threshold: 3 } });
    white.push({ id: 'W8', color: 'white', type: 'own_role_count', reward: 3, params: { role: 'assassin', comparator: '>=', threshold: 2 } });
    white.push({ id: 'W9', color: 'white', type: 'own_role_count', reward: 3, params: { role: 'spy', comparator: '>=', threshold: 3 } });
    white.push({ id: 'W10', color: 'white', type: 'own_role_count', reward: 3, params: { role: 'guard', comparator: '>=', threshold: 4 } });

    return { blue, white };
}

// ==========================================================
// State shapes
// ==========================================================

export interface Column {
    above: Card[];
    below: Card[];
}

// One column per family, plus a central "queen" column that holds face-down spies
// placed at the table until they are revealed at end game.
export type TableState = Record<Family | 'queen', Column>;

export interface PendingAssassin {
    playerId: string;        // who must choose whether to eliminate
    assassinCardId: string;  // the just-placed assassin (never a valid target)
    // The area whose cards are eligible targets.
    area: { kind: 'table' } | { kind: 'domain'; ownerId: string };
}

export interface LastMove {
    playerId: string;
    kind: 'place' | 'assassinate' | 'skipAssassin' | 'endTurn' | 'gameOver' | 'start';
    desc: string;
    moveId: number;
    zone?: Zone;
    family?: Family;
    level?: Level;
    role?: Role;
    targetOwnerId?: string;  // for oppDomain placements / assassin targets
}

export interface PlayerScore {
    domainScore: number;
    missionScore: number;
    total: number;
    fulfilledMissionIds: string[];
    // Per-family domain contribution (for a readable end screen).
    familyContribution: Record<Family, number>;
}

export interface ScoreResult {
    familyStatus: Record<Family, FamilyStatus>;
    weightedAbove: Record<Family, number>;
    weightedBelow: Record<Family, number>;
    players: Record<string, PlayerScore>;
    winnerIds: string[];
}

export interface GameStateData {
    status: Status;
    playerIds: string[];
    numPlayers: number;

    table: TableState;
    domains: Record<string, Card[]>;
    hands: Record<string, Card[]>;
    drawPile: Card[];
    removed: Card[];
    missions: Record<string, Mission[]>;

    currentPlayerId: string;
    // Which of the three zones the current player has already filled this turn.
    turnZones: { table: boolean; ownDomain: boolean; oppDomain: boolean };
    pendingAssassin: PendingAssassin | null;

    lastMove: LastMove | null;
    moveCounter: number;

    // The cards most recently played, by the player currently "holding the room".
    // Resets to just the newest card whenever a different player plays their first
    // card — driving the recently-played glow (public; content still redacted).
    highlight: { playerId: string; cardIds: string[] } | null;

    // Whether noble weighting extends into mission conditions (§7.6). Applied to
    // B7 (table) only; W1-W6 and role counts always use raw physical card counts.
    missionsUseNobleWeighting: boolean;

    score: ScoreResult | null;
    winnerIds: string[];
}

// ==========================================================
// Small utilities
// ==========================================================

function randInt(n: number): number {
    return Math.floor(Math.random() * n);
}

function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = randInt(i + 1);
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function emptyColumn(): Column {
    return { above: [], below: [] };
}

function freshTable(): TableState {
    const t = {} as TableState;
    for (const f of FAMILIES) t[f] = emptyColumn();
    t.queen = emptyColumn();
    return t;
}

// ==========================================================
// Game state
// ==========================================================

export class CourtisansGameState {
    private data: GameStateData;
    private readonly playerIds: string[];

    constructor(playerIds: string[]) {
        this.playerIds = [...playerIds];
        this.data = {
            status: 'Setup',
            playerIds: [...playerIds],
            numPlayers: playerIds.length,
            table: freshTable(),
            domains: {},
            hands: {},
            drawPile: [],
            removed: [],
            missions: {},
            currentPlayerId: '',
            turnZones: { table: false, ownDomain: false, oppDomain: false },
            pendingAssassin: null,
            lastMove: null,
            moveCounter: 0,
            highlight: null,
            missionsUseNobleWeighting: true,
            score: null,
            winnerIds: []
        };
        for (const pid of playerIds) {
            this.data.domains[pid] = [];
            this.data.hands[pid] = [];
            this.data.missions[pid] = [];
        }
    }

    public static from_data(data: GameStateData, playerIds: string[]): CourtisansGameState {
        const state = new CourtisansGameState(playerIds);
        state.data = JSON.parse(JSON.stringify(data));
        return state;
    }

    public get_data(): GameStateData {
        return JSON.parse(JSON.stringify(this.data));
    }

    // ==========================================================
    // Deck construction
    // ==========================================================

    public static buildDeck(): Card[] {
        const deck: Card[] = [];
        for (const family of FAMILIES) {
            for (const role of ROLES) {
                for (let i = 1; i <= ROLE_COUNTS[role]; i++) {
                    deck.push({ id: `${family}.${role}.${i}`, family, role });
                }
            }
        }
        return deck; // 6 * 15 = 90
    }

    // ==========================================================
    // Setup
    // ==========================================================

    public start_game(firstPlayer?: string) {
        const n = this.playerIds.length;
        if (n < 2 || n > 5) {
            throw new Error('Courtisans supports 2 to 5 players');
        }

        // Fresh zones.
        this.data.table = freshTable();
        for (const pid of this.playerIds) {
            this.data.domains[pid] = [];
            this.data.hands[pid] = [];
            this.data.missions[pid] = [];
        }
        this.data.removed = [];
        this.data.score = null;
        this.data.winnerIds = [];
        this.data.moveCounter = 0;
        this.data.pendingAssassin = null;
        this.data.highlight = null;

        // Shuffle 90, remove the random face-down count for this player count.
        let deck = shuffle(CourtisansGameState.buildDeck());
        const removeCount = REMOVE_BY_PLAYERS[n] ?? 0;
        this.data.removed = deck.slice(0, removeCount); // face down, never revealed
        deck = deck.slice(removeCount);

        // Deal 3 to each player; the rest is the draw pile.
        for (const pid of this.playerIds) {
            this.data.hands[pid] = deck.splice(0, HAND_SIZE);
        }
        this.data.drawPile = deck;

        // Deal 1 blue + 1 white mission each from separately-shuffled decks.
        const catalog = buildMissionCatalog();
        const blue = shuffle(catalog.blue);
        const white = shuffle(catalog.white);
        this.playerIds.forEach((pid, i) => {
            this.data.missions[pid] = [blue[i], white[i]];
        });

        const starter = firstPlayer && this.playerIds.includes(firstPlayer)
            ? firstPlayer
            : this.playerIds[randInt(n)];
        this.data.currentPlayerId = starter;
        this.data.turnZones = { table: false, ownDomain: false, oppDomain: false };
        this.data.status = 'Playing';
        this.data.lastMove = {
            playerId: starter,
            kind: 'start',
            desc: 'opens the court',
            moveId: ++this.data.moveCounter
        };
    }

    // ==========================================================
    // A turn: play one card per zone (in any order), resolving assassins.
    // ==========================================================

    public place_card(
        playerId: string,
        cardId: string,
        zone: Zone,
        opts: { level?: Level; targetPlayerId?: string } = {}
    ) {
        if (this.data.status !== 'Playing') throw new Error('The game is not in play');
        if (playerId !== this.data.currentPlayerId) throw new Error('It is not your turn');
        if (this.data.pendingAssassin) throw new Error('Resolve the assassin before playing another card');
        if (this.data.turnZones[zone]) throw new Error('You have already played a card into that zone');

        const hand = this.data.hands[playerId];
        const idx = hand.findIndex(c => c.id === cardId);
        if (idx < 0) throw new Error('That card is not in your hand');
        const card = hand[idx];

        // Resolve the destination player for domain placements.
        let domainOwner = '';
        if (zone === 'ownDomain') {
            domainOwner = playerId;
        } else if (zone === 'oppDomain') {
            const target = opts.targetPlayerId;
            if (!target || target === playerId) throw new Error('Choose an opponent for the opponent-domain card');
            if (!this.playerIds.includes(target)) throw new Error('Unknown opponent');
            domainOwner = target;
        } else {
            // table
            if (opts.level !== 'above' && opts.level !== 'below') {
                throw new Error('Choose above or below the Queen for a table card');
            }
        }

        // Commit the placement.
        hand.splice(idx, 1);
        if (zone === 'table') {
            const level = opts.level as Level;
            // Spies hide in the Queen's column; everyone else in their family column.
            const columnKey: Family | 'queen' = card.role === 'spy' ? 'queen' : card.family;
            this.data.table[columnKey][level].push(card);
            this.data.lastMove = {
                playerId, kind: 'place', zone, family: card.family, level, role: card.role,
                desc: `placed a ${card.role === 'spy' ? 'spy' : card.family} card ${level} the Queen`,
                moveId: ++this.data.moveCounter
            };
        } else {
            this.data.domains[domainOwner].push(card);
            this.data.lastMove = {
                playerId, kind: 'place', zone, family: card.family, role: card.role,
                targetOwnerId: domainOwner,
                desc: zone === 'ownDomain' ? 'placed a card in their domain' : 'placed a card in an opponent’s domain',
                moveId: ++this.data.moveCounter
            };
        }
        this.data.turnZones[zone] = true;

        // Track the recently-played glow: append to the current player's run, or
        // start a fresh run (stopping the previous player's glow) on a new player.
        if (this.data.highlight && this.data.highlight.playerId === playerId) {
            this.data.highlight.cardIds.push(card.id);
        } else {
            this.data.highlight = { playerId, cardIds: [card.id] };
        }

        // An assassin offers an optional elimination in the same area.
        if (card.role === 'assassin') {
            this.data.pendingAssassin = {
                playerId,
                assassinCardId: card.id,
                area: zone === 'table' ? { kind: 'table' } : { kind: 'domain', ownerId: domainOwner }
            };
            return;
        }

        this.maybeEndTurn();
    }

    // Resolve the pending assassin. `targetCardId === null` skips (elimination is optional).
    public resolve_assassin(playerId: string, targetCardId: string | null) {
        const pa = this.data.pendingAssassin;
        if (!pa) throw new Error('There is no assassin to resolve');
        if (pa.playerId !== playerId) throw new Error('Only the assassin’s owner resolves it');

        if (targetCardId === null || targetCardId === undefined) {
            this.data.pendingAssassin = null;
            this.data.lastMove = {
                playerId, kind: 'skipAssassin',
                desc: 'held the assassin’s blade',
                moveId: ++this.data.moveCounter
            };
            this.maybeEndTurn();
            return;
        }

        if (targetCardId === pa.assassinCardId) throw new Error('The assassin cannot target itself');

        const removed = this.removeCardFromArea(pa.area, targetCardId, pa.assassinCardId);
        if (!removed) throw new Error('That card is not a legal target');
        this.data.removed.push(removed);

        this.data.pendingAssassin = null;
        this.data.lastMove = {
            playerId, kind: 'assassinate',
            desc: 'eliminated a courtier',
            role: removed.role,
            family: removed.family,
            moveId: ++this.data.moveCounter
        };
        this.maybeEndTurn();
    }

    // Find, validate (guards are immune), and remove a target card from an area.
    private removeCardFromArea(
        area: PendingAssassin['area'],
        targetCardId: string,
        assassinCardId: string
    ): Card | null {
        const tryPull = (list: Card[]): Card | null => {
            const i = list.findIndex(c => c.id === targetCardId && c.id !== assassinCardId);
            if (i < 0) return null;
            if (list[i].role === 'guard') return null; // immune
            return list.splice(i, 1)[0];
        };

        if (area.kind === 'domain') {
            const dom = this.data.domains[area.ownerId];
            if (!dom) return null;
            return tryPull(dom);
        }

        // Table: any card in any column (family columns + queen), any level.
        const columnKeys: (Family | 'queen')[] = [...FAMILIES, 'queen'];
        for (const key of columnKeys) {
            const col = this.data.table[key];
            const above = tryPull(col.above);
            if (above) return above;
            const below = tryPull(col.below);
            if (below) return below;
        }
        return null;
    }

    // Legal targets for the pending assassin (ids only) — used to drive the UI.
    public get_assassin_targets(): string[] {
        const pa = this.data.pendingAssassin;
        if (!pa) return [];
        const eligible = (list: Card[]) =>
            list.filter(c => c.id !== pa.assassinCardId && c.role !== 'guard').map(c => c.id);

        if (pa.area.kind === 'domain') {
            return eligible(this.data.domains[pa.area.ownerId] || []);
        }
        const ids: string[] = [];
        for (const key of [...FAMILIES, 'queen'] as (Family | 'queen')[]) {
            ids.push(...eligible(this.data.table[key].above));
            ids.push(...eligible(this.data.table[key].below));
        }
        return ids;
    }

    // Once all three zones are filled and no assassin is pending: draw, then pass.
    private maybeEndTurn() {
        const z = this.data.turnZones;
        if (!(z.table && z.ownDomain && z.oppDomain)) return;
        if (this.data.pendingAssassin) return;

        // Draw back up to a full hand (the pile is divisible by 3, so this is
        // exactly 3 cards or the pile is already empty).
        const cur = this.data.currentPlayerId;
        const need = HAND_SIZE - this.data.hands[cur].length;
        const drawn = this.data.drawPile.splice(0, Math.min(need, this.data.drawPile.length));
        this.data.hands[cur].push(...drawn);

        // Find the next player (clockwise) who still holds cards. If nobody does,
        // the court is spent — resolve the game.
        const next = this.nextWithCards(cur);
        if (next === null) {
            this.finish_game();
            return;
        }
        this.data.currentPlayerId = next;
        this.data.turnZones = { table: false, ownDomain: false, oppDomain: false };
        this.data.lastMove = {
            playerId: cur, kind: 'endTurn',
            desc: 'ends their turn',
            moveId: ++this.data.moveCounter
        };
    }

    // Next player clockwise after `fromId` holding >=1 card; checks others first
    // and only falls back to `fromId` if they are the sole card-holder.
    private nextWithCards(fromId: string): string | null {
        const n = this.playerIds.length;
        const start = this.playerIds.indexOf(fromId);
        for (let step = 1; step <= n; step++) {
            const id = this.playerIds[(start + step) % n];
            if (this.data.hands[id].length > 0) return id;
        }
        return null;
    }

    // ==========================================================
    // End-game reveal & scoring
    // ==========================================================

    public finish_game() {
        this.revealSpies();
        this.data.score = this.computeScore();
        this.data.winnerIds = this.data.score.winnerIds;
        this.data.currentPlayerId = '';
        this.data.pendingAssassin = null;
        this.data.status = 'GameOver';
        this.data.lastMove = {
            playerId: this.data.winnerIds[0] || '',
            kind: 'gameOver',
            desc: 'the Queen renders her judgement',
            moveId: ++this.data.moveCounter
        };
    }

    // Move every face-down spy from the Queen's column to its true family column,
    // preserving its above/below level.
    private revealSpies() {
        const queen = this.data.table.queen;
        for (const level of ['above', 'below'] as Level[]) {
            for (const card of queen[level]) {
                this.data.table[card.family][level].push(card);
            }
            queen[level] = [];
        }
    }

    // Weighted above/below tally per family (nobles count 2). Assumes spies are
    // already revealed and re-slotted.
    private weightedTallies(): { above: Record<Family, number>; below: Record<Family, number> } {
        const above = {} as Record<Family, number>;
        const below = {} as Record<Family, number>;
        for (const f of FAMILIES) {
            above[f] = this.data.table[f].above.reduce((s, c) => s + weightOf(c), 0);
            below[f] = this.data.table[f].below.reduce((s, c) => s + weightOf(c), 0);
        }
        return { above, below };
    }

    private computeScore(): ScoreResult {
        const { above, below } = this.weightedTallies();
        const familyStatus = {} as Record<Family, FamilyStatus>;
        for (const f of FAMILIES) {
            familyStatus[f] = above[f] > below[f] ? 'esteemed'
                : below[f] > above[f] ? 'fallen'
                    : 'neutral';
        }

        const sign = (f: Family): number =>
            familyStatus[f] === 'esteemed' ? 1 : familyStatus[f] === 'fallen' ? -1 : 0;

        const players: Record<string, PlayerScore> = {};
        for (const pid of this.playerIds) {
            const contribution = {} as Record<Family, number>;
            for (const f of FAMILIES) contribution[f] = 0;
            let domainScore = 0;
            for (const card of this.data.domains[pid]) {
                const pts = weightOf(card) * sign(card.family);
                contribution[card.family] += pts;
                domainScore += pts;
            }

            const fulfilled: string[] = [];
            let missionScore = 0;
            for (const m of this.data.missions[pid]) {
                if (this.evaluateMission(m, pid, familyStatus)) {
                    fulfilled.push(m.id);
                    missionScore += m.reward;
                }
            }

            players[pid] = {
                domainScore,
                missionScore,
                total: domainScore + missionScore,
                fulfilledMissionIds: fulfilled,
                familyContribution: contribution
            };
        }

        // Highest total wins; ties shared.
        let best = -Infinity;
        for (const pid of this.playerIds) best = Math.max(best, players[pid].total);
        const winnerIds = this.playerIds.filter(pid => players[pid].total === best);

        return { familyStatus, weightedAbove: above, weightedBelow: below, players, winnerIds };
    }

    // ---- mission evaluation (§7.5) --------------------------------------------

    private countRawBelow(family: Family): number {
        return this.data.table[family].below.length;
    }
    private countWeightedBelow(family: Family): number {
        return this.data.table[family].below.reduce((s, c) => s + weightOf(c), 0);
    }
    private countDomainFamily(pid: string, family: Family): number {
        return this.data.domains[pid].filter(c => c.family === family).length;
    }
    private countDomainRole(pid: string, role: Role): number {
        return this.data.domains[pid].filter(c => c.role === role).length;
    }
    private leftNeighbor(pid: string): string {
        const i = this.playerIds.indexOf(pid);
        return this.playerIds[(i + 1) % this.playerIds.length];
    }

    public evaluateMission(m: Mission, pid: string, familyStatus: Record<Family, FamilyStatus>): boolean {
        const p = m.params;
        switch (m.type) {
            case 'family_status':
                return familyStatus[p.family as Family] === p.requiredStatus;

            case 'table_family_count_threshold': {
                const min = p.minCardsInFamily ?? 5;
                const need = p.minFamilies ?? 1;
                const count = FAMILIES.filter(f => {
                    const belowCount = this.data.missionsUseNobleWeighting
                        ? this.countWeightedBelow(f)
                        : this.countRawBelow(f);
                    return belowCount >= min;
                }).length;
                return count >= need;
            }

            case 'table_all_families_present':
                return FAMILIES.every(f => this.countRawBelow(f) >= (p.minPerFamily ?? 1));

            case 'status_count': {
                const count = FAMILIES.filter(f => familyStatus[f] === p.status).length;
                const t = p.threshold ?? 0;
                if (p.comparator === '<=') return count <= t;
                if (p.comparator === '>=') return count >= t;
                if (p.comparator === '>') return count > t;
                return false;
            }

            case 'neighbor_family_compare': {
                // Raw physical card count; strict greater (ties fail).
                const left = this.leftNeighbor(pid);
                return this.countDomainFamily(left, p.family as Family) > this.countDomainFamily(pid, p.family as Family);
            }

            case 'own_role_count': {
                const count = this.countDomainRole(pid, p.role as Role);
                const t = p.threshold ?? 0;
                if (p.comparator === '>=') return count >= t;
                if (p.comparator === '<=') return count <= t;
                if (p.comparator === '>') return count > t;
                return false;
            }

            default:
                return false;
        }
    }

    // ==========================================================
    // Getters for the view / test layers
    // ==========================================================

    public get_status(): Status {
        return this.data.status;
    }
    public get_current_player(): string {
        return this.data.currentPlayerId;
    }
    public get_hand(pid: string): Card[] {
        return [...(this.data.hands[pid] || [])];
    }
    public get_missions(pid: string): Mission[] {
        return [...(this.data.missions[pid] || [])];
    }
    public get_score(): ScoreResult | null {
        return this.data.score ? JSON.parse(JSON.stringify(this.data.score)) : null;
    }
}

export default CourtisansGameState;
