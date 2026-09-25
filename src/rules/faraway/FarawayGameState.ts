/**
 * FarawayGameState.ts — the pure, framework-independent Faraway engine.
 *
 * No React / Socket.io / Multiplayr dependencies, so it is fully unit-testable
 * and JSON-serialisable (rehydrated via `from_data`).
 *
 * Implements the 8-round loop:
 *   SETUP → [ COMMIT (simultaneous, hidden) → reveal → sanctuary draw
 *           → END_EXPLORATION (turn by turn, ascending by played duration)
 *           → discard + refill ] × 8 → SCORING → DONE
 * plus the optional advanced draft (deal 5, keep 3) and the right-to-left
 * scoring pass in which a Region only ever sees itself, the Regions to its
 * right, and every Sanctuary.
 */

import {
    RegionCard, SanctuaryCard, ScorableCard, Colour, Resource,
    REGION_BY_ID, SANCTUARY_BY_ID, ALL_REGION_IDS, ALL_SANCTUARY_IDS,
    ROUNDS, HAND_SIZE, DRAFT_DEAL, MIN_PLAYERS, MAX_PLAYERS,
    LAST_MARKET_ROUND, LAST_REFILL_ROUND, TIEBREAK,
    prereqMet, evalQuest, missingResources
} from './FarawayData';

export enum Phase {
    Setup = 'setup',
    Draft = 'draft',                   // advanced variant only: keep 3 of 5
    Commit = 'commit',                 // simultaneous, secret region selection
    EndExploration = 'endexploration',  // sequential: take a market card, keep 1 sanctuary
    Scoring = 'scoring',
    Done = 'done'
}

export interface PlayerState {
    id: string;
    hand: number[];                 // Region ids — private
    draftPool: number[];            // advanced setup only — private
    tableau: number[];              // Region ids, ordered left → right
    sanctuaries: string[];          // Sanctuary ids — public, always visible
    pendingSanctuaries: string[];   // drawn this round, awaiting the keep-1 choice
    committed: number | null;       // this round's hidden pick
    tookMarket: boolean;            // this round's market step already done
}

export interface LastMove {
    moveId: number;
    playerId: string;
    kind: 'commit' | 'reveal' | 'market' | 'sanctuary' | 'round';
    text: string;
}

export interface RegionScore {
    cardId: number;
    fame: number;
    blocked: boolean;      // has a quest but its prerequisite was not met
    hasQuest: boolean;
    /** Wonder icons still missing from this card's view, when blocked. */
    missing: Resource[];
}

export interface ScoreBreakdown {
    regions: RegionScore[];      // left → right, same order as the tableau
    sanctuaryFame: number;
    total: number;
    durationSum: number;
}

export interface GameStateData {
    phase: Phase;
    advanced: boolean;
    round: number;                       // 1..ROUNDS
    players: Record<string, PlayerState>;
    playerOrder: string[];               // stable seating order
    regionDeck: number[];                // top = index 0
    sanctuaryDeck: string[];             // top = index 0; returns go to the bottom
    market: number[];
    removed: number[];                   // Regions removed from the game
    turnOrder: string[];                 // this round's end-exploration order
    turnIndex: number;
    revealed: Record<string, number> | null;  // what each player played this round
    scores: Record<string, ScoreBreakdown> | null;
    winnerIds: string[] | null;
    lastMove: LastMove | null;
    moveCounter: number;
}

export interface StartOptions {
    advanced?: boolean;
    seed?: number;
}

// ---------------------------------------------------------------------------
// Deterministic RNG (seeded for replay / tests)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------

export class FarawayGameState {
    private readonly playerIds: string[];
    private data: GameStateData;
    private rng: () => number;

    constructor(playerIds: string[], rng?: () => number) {
        this.playerIds = [...playerIds];
        this.rng = rng || Math.random;
        this.data = FarawayGameState.create_initial_state(this.playerIds);
    }

    public static create_initial_state(playerIds: string[]): GameStateData {
        const players: Record<string, PlayerState> = {};
        for (const id of playerIds) {
            players[id] = {
                id, hand: [], draftPool: [], tableau: [], sanctuaries: [],
                pendingSanctuaries: [], committed: null, tookMarket: false
            };
        }
        return {
            phase: Phase.Setup,
            advanced: false,
            round: 1,
            players,
            playerOrder: [...playerIds],
            regionDeck: [],
            sanctuaryDeck: [],
            market: [],
            removed: [],
            turnOrder: [],
            turnIndex: 0,
            revealed: null,
            scores: null,
            winnerIds: null,
            lastMove: null,
            moveCounter: 0
        };
    }

    public static from_data(data: GameStateData, playerIds: string[]): FarawayGameState {
        const gs = new FarawayGameState(playerIds);
        gs.data = { ...data };
        return gs;
    }

    public get_data(): GameStateData { return this.data; }

    // =======================================================================
    // Setup
    // =======================================================================

    public start_game(opts: StartOptions = {}): void {
        if (this.playerIds.length < MIN_PLAYERS || this.playerIds.length > MAX_PLAYERS) {
            throw new Error(`Faraway supports ${MIN_PLAYERS} to ${MAX_PLAYERS} players.`);
        }
        this.rng = opts.seed != null ? mulberry32(opts.seed) : Math.random;
        this.data = FarawayGameState.create_initial_state(this.playerIds);
        this.data.advanced = !!opts.advanced;

        this.data.regionDeck = shuffleWith(ALL_REGION_IDS, this.rng);
        this.data.sanctuaryDeck = shuffleWith(ALL_SANCTUARY_IDS, this.rng);

        const deal = this.data.advanced ? DRAFT_DEAL : HAND_SIZE;
        for (const id of this.playerIds) {
            const p = this.data.players[id];
            const cards = this.data.regionDeck.splice(0, deal);
            if (this.data.advanced) p.draftPool = cards; else p.hand = cards;
        }

        if (this.data.advanced) {
            this.data.phase = Phase.Draft;
        } else {
            this.refillMarket();
            this.data.phase = Phase.Commit;
        }
    }

    /**
     * Advanced variant: secretly keep exactly HAND_SIZE of the dealt pool; the
     * rest is shuffled back into the Region deck once everybody has chosen.
     */
    public draft_keep(playerId: string, keep: number[]): void {
        this.expect(Phase.Draft);
        const p = this.player(playerId);
        if (p.hand.length > 0) throw new Error('You have already kept your cards');
        if (keep.length !== HAND_SIZE) throw new Error(`Keep exactly ${HAND_SIZE} cards`);
        for (const c of keep) {
            if (p.draftPool.indexOf(c) === -1) throw new Error(`Card ${c} was not dealt to you`);
        }
        if (new Set(keep).size !== keep.length) throw new Error('Duplicate card in selection');

        p.hand = [...keep];
        const returned = p.draftPool.filter(c => keep.indexOf(c) === -1);
        p.draftPool = [];
        this.data.regionDeck.push(...returned);
        this.note(playerId, 'commit', 'kept their starting hand');

        if (this.data.playerOrder.every(id => this.data.players[id].hand.length === HAND_SIZE)) {
            this.data.regionDeck = shuffleWith(this.data.regionDeck, this.rng);
            this.refillMarket();
            this.data.phase = Phase.Commit;
        }
    }

    // =======================================================================
    // Phase 1 — Explore (simultaneous, hidden)
    // =======================================================================

    public commit(playerId: string, cardId: number): void {
        this.expect(Phase.Commit);
        const p = this.player(playerId);
        if (p.committed !== null) throw new Error('You have already committed this round');
        if (p.hand.indexOf(cardId) === -1) throw new Error(`Card ${cardId} is not in your hand`);
        p.committed = cardId;
        this.note(playerId, 'commit', 'chose a region');

        if (this.data.playerOrder.every(id => this.data.players[id].committed !== null)) {
            this.reveal();
        }
    }

    /** Undo a commit while the round is still hidden (nobody has seen it yet). */
    public uncommit(playerId: string): void {
        this.expect(Phase.Commit);
        const p = this.player(playerId);
        if (p.committed === null) throw new Error('Nothing to take back');
        p.committed = null;
    }

    // =======================================================================
    // Phase 2 — Reveal + find Sanctuaries
    // =======================================================================

    private reveal(): void {
        const revealed: Record<string, number> = {};

        for (const id of this.data.playerOrder) {
            const p = this.data.players[id];
            const cardId = p.committed!;
            const previous = p.tableau.length > 0 ? p.tableau[p.tableau.length - 1] : null;
            p.hand = p.hand.filter(c => c !== cardId);
            p.tableau.push(cardId);
            p.committed = null;
            p.tookMarket = false;
            revealed[id] = cardId;

            // A strictly higher duration than the Region immediately to its left
            // earns Sanctuaries — 1, plus 1 per clue anywhere in the play area.
            if (previous !== null && cardId > previous) {
                const draws = 1 + this.clueCount(id);
                p.pendingSanctuaries = this.drawSanctuaries(draws);
            } else {
                p.pendingSanctuaries = [];
            }
        }

        this.data.revealed = revealed;
        // Turn order for phase 3: ascending by the duration just played. Region
        // numbers are unique, so this is always a total order.
        this.data.turnOrder = [...this.data.playerOrder].sort((a, b) => revealed[a] - revealed[b]);
        this.data.turnIndex = 0;
        this.data.phase = Phase.EndExploration;
        this.bumpMove();
        this.data.lastMove = {
            moveId: this.data.moveCounter, playerId: this.data.turnOrder[0],
            kind: 'reveal', text: `Round ${this.data.round}: regions revealed`
        };
        this.skipIdleTurns();
    }

    private drawSanctuaries(n: number): string[] {
        // Returned cards go to the bottom, so running dry is rare; if it happens
        // the player simply draws whatever is left (rulebook is silent here).
        return this.data.sanctuaryDeck.splice(0, Math.min(n, this.data.sanctuaryDeck.length));
    }

    /** Clues on every Region in the tableau plus every kept Sanctuary. */
    public clueCount(playerId: string): number {
        const p = this.player(playerId);
        let n = 0;
        for (const c of p.tableau) n += REGION_BY_ID[c].clues;
        for (const s of p.sanctuaries) n += SANCTUARY_BY_ID[s].clues;
        return n;
    }

    // =======================================================================
    // Phase 3 — End of Exploration (sequential)
    // =======================================================================

    /** True while the market is still in play (round 8 uses no market at all). */
    public marketActive(): boolean {
        return this.data.round <= LAST_MARKET_ROUND;
    }

    public currentPlayerId(): string | null {
        if (this.data.phase !== Phase.EndExploration) return null;
        return this.data.turnOrder[this.data.turnIndex] ?? null;
    }

    /**
     * What the current player still owes before the turn can pass on.
     *
     * The two steps are resolved **sanctuary first, then market** (the rulebook
     * prints the opposite order, but the two are independent — keeping a
     * Sanctuary neither changes the market nor this round's draw, since a
     * Sanctuary's clues only count from the next draw onwards — so the order is
     * a UI choice, and picking the found card first reads better).
     */
    public pendingActions(playerId: string): { market: boolean; sanctuary: boolean } {
        const p = this.player(playerId);
        return {
            market: this.marketActive() && !p.tookMarket && this.data.market.length > 0,
            sanctuary: p.pendingSanctuaries.length > 0
        };
    }

    public take_market(playerId: string, marketIndex: number): void {
        this.expect(Phase.EndExploration);
        this.expectTurn(playerId);
        const p = this.player(playerId);
        if (!this.marketActive()) throw new Error('There is no market in the final round');
        if (p.tookMarket) throw new Error('You have already taken a region this round');
        if (p.pendingSanctuaries.length > 0) throw new Error('Keep a sanctuary first');
        if (marketIndex < 0 || marketIndex >= this.data.market.length) throw new Error('No such market card');

        const [cardId] = this.data.market.splice(marketIndex, 1);
        p.hand.push(cardId);
        p.tookMarket = true;
        this.note(playerId, 'market', `took region ${cardId} from the market`);
        this.skipIdleTurns();
    }

    public keep_sanctuary(playerId: string, sanctuaryId: string): void {
        this.expect(Phase.EndExploration);
        this.expectTurn(playerId);
        const p = this.player(playerId);
        if (p.pendingSanctuaries.length === 0) throw new Error('You have no sanctuaries to choose from');
        if (p.pendingSanctuaries.indexOf(sanctuaryId) === -1) throw new Error('That sanctuary was not drawn by you');
        // Take exactly one; everything else goes back under the deck. Shuffle the
        // returned set first so its order leaks nothing about what was seen.
        const returned = shuffleWith(p.pendingSanctuaries.filter(s => s !== sanctuaryId), this.rng);
        p.sanctuaries.push(sanctuaryId);
        p.pendingSanctuaries = [];
        this.data.sanctuaryDeck.push(...returned);
        this.note(playerId, 'sanctuary', 'kept a sanctuary');
        this.skipIdleTurns();
    }

    /** Pass the turn along while the player at the head of it owes nothing. */
    private skipIdleTurns(): void {
        while (this.data.phase === Phase.EndExploration && this.data.turnIndex < this.data.turnOrder.length) {
            const id = this.data.turnOrder[this.data.turnIndex];
            const owed = this.pendingActions(id);
            if (owed.market || owed.sanctuary) return;
            this.data.turnIndex++;
        }
        if (this.data.phase === Phase.EndExploration) this.endRound();
    }

    private endRound(): void {
        // The leftover market card is removed from the game, never reused.
        if (this.data.market.length > 0) {
            this.data.removed.push(...this.data.market);
            this.data.market = [];
        }

        if (this.data.round >= ROUNDS) {
            this.score();
            return;
        }

        if (this.data.round <= LAST_REFILL_ROUND) this.refillMarket();

        this.data.round++;
        this.data.revealed = null;
        this.data.turnOrder = [];
        this.data.turnIndex = 0;
        for (const id of this.data.playerOrder) {
            const p = this.data.players[id];
            p.committed = null;
            p.tookMarket = false;
        }
        this.data.phase = Phase.Commit;
        this.bumpMove();
        this.data.lastMove = {
            moveId: this.data.moveCounter, playerId: this.data.playerOrder[0],
            kind: 'round', text: `Round ${this.data.round} begins`
        };
    }

    private refillMarket(): void {
        const want = this.data.playerOrder.length + 1;
        this.data.market = this.data.regionDeck.splice(0, Math.min(want, this.data.regionDeck.length));
    }

    // =======================================================================
    // Scoring
    // =======================================================================

    private static asScorable(cards: (RegionCard | SanctuaryCard)[]): ScorableCard[] {
        return cards.map(c => ({ colour: c.colour, night: c.night, clues: c.clues, resources: c.resources }));
    }

    /**
     * Score one player's play area. Regions resolve **right to left**: Region i
     * sees itself, every Region to its right, and *all* Sanctuaries — never a
     * Region to its left. Sanctuary quests resolve last, with everything visible.
     *
     * Works on a partial tableau too, so the UI can show a live projection
     * mid-game.
     */
    public computeScore(playerId: string): ScoreBreakdown {
        const p = this.player(playerId);
        const sanctuaries = p.sanctuaries.map(s => SANCTUARY_BY_ID[s]);
        const sanctuaryScorables = FarawayGameState.asScorable(sanctuaries);

        const visible: ScorableCard[] = [...sanctuaryScorables];
        const regions: RegionScore[] = new Array(p.tableau.length);

        for (let i = p.tableau.length - 1; i >= 0; i--) {
            const card = REGION_BY_ID[p.tableau[i]];
            visible.push({ colour: card.colour, night: card.night, clues: card.clues, resources: card.resources });
            const hasQuest = !!card.quest;
            const met = prereqMet(card.prerequisite, visible);
            regions[i] = {
                cardId: card.id,
                fame: hasQuest && met ? evalQuest(card.quest!, visible) : 0,
                blocked: hasQuest && !met,
                hasQuest,
                missing: met ? [] : missingResources(card.prerequisite, visible)
            };
        }

        const everything: ScorableCard[] = [
            ...sanctuaryScorables,
            ...FarawayGameState.asScorable(p.tableau.map(id => REGION_BY_ID[id]))
        ];
        let sanctuaryFame = 0;
        for (const s of sanctuaries) if (s.quest) sanctuaryFame += evalQuest(s.quest, everything);

        const total = regions.reduce((n, r) => n + r.fame, 0) + sanctuaryFame;
        const durationSum = p.tableau.reduce((n, id) => n + id, 0);
        return { regions, sanctuaryFame, total, durationSum };
    }

    public score(): void {
        const scores: Record<string, ScoreBreakdown> = {};
        for (const id of this.data.playerOrder) scores[id] = this.computeScore(id);
        this.data.scores = scores;

        const best = Math.max(...this.data.playerOrder.map(id => scores[id].total));
        let tied = this.data.playerOrder.filter(id => scores[id].total === best);
        if (tied.length > 1) {
            // Lowest exploration duration wins the tie (see TIEBREAK).
            const key = (id: string) => TIEBREAK === 'LOWEST_SUM'
                ? scores[id].durationSum
                : Math.min(...this.data.players[id].tableau);
            const lowest = Math.min(...tied.map(key));
            tied = tied.filter(id => key(id) === lowest);
        }
        this.data.winnerIds = tied;
        this.data.phase = Phase.Done;
        this.bumpMove();
        this.data.lastMove = {
            moveId: this.data.moveCounter, playerId: tied[0],
            kind: 'round', text: 'the expedition is over'
        };
    }

    // =======================================================================
    // Read helpers (used by the rule tick and the views)
    // =======================================================================

    public get_phase(): Phase { return this.data.phase; }
    public get_round(): number { return this.data.round; }
    public get_advanced(): boolean { return this.data.advanced; }
    public get_player_order(): string[] { return [...this.data.playerOrder]; }
    public get_market(): number[] { return [...this.data.market]; }
    public get_turn_order(): string[] { return [...this.data.turnOrder]; }
    public get_revealed(): Record<string, number> | null { return this.data.revealed; }
    public get_scores(): Record<string, ScoreBreakdown> | null { return this.data.scores; }
    public get_winners(): string[] | null { return this.data.winnerIds; }
    public get_last_move(): LastMove | null { return this.data.lastMove; }
    public get_region_deck_count(): number { return this.data.regionDeck.length; }
    public get_sanctuary_deck_count(): number { return this.data.sanctuaryDeck.length; }
    public get_removed(): number[] { return [...this.data.removed]; }

    public get_player(playerId: string): PlayerState | undefined {
        return this.data.players[playerId];
    }

    /** The Region a new card must beat to earn Sanctuaries. */
    public lastRegion(playerId: string): number | null {
        const t = this.player(playerId).tableau;
        return t.length > 0 ? t[t.length - 1] : null;
    }

    /** Would playing `cardId` trigger a Sanctuary draw, and how many cards? */
    public sanctuaryPreview(playerId: string, cardId: number): { qualifies: boolean; draws: number } {
        const prev = this.lastRegion(playerId);
        const qualifies = prev !== null && cardId > prev;
        if (!qualifies) return { qualifies: false, draws: 0 };
        return { qualifies: true, draws: 1 + this.clueCount(playerId) + REGION_BY_ID[cardId].clues };
    }

    /** Colour counts across a player's whole play area (tableau + sanctuaries). */
    public colourCounts(playerId: string): Record<Colour, number> {
        const p = this.player(playerId);
        const out = { BLUE: 0, RED: 0, GREEN: 0, YELLOW: 0 } as Record<Colour, number>;
        for (const id of p.tableau) out[REGION_BY_ID[id].colour]++;
        for (const s of p.sanctuaries) {
            const c = SANCTUARY_BY_ID[s].colour;
            if (c) out[c]++;
        }
        return out;
    }

    // =======================================================================
    // Internals
    // =======================================================================

    private player(playerId: string): PlayerState {
        const p = this.data.players[playerId];
        if (!p) throw new Error(`Unknown player ${playerId}`);
        return p;
    }

    private expect(phase: Phase): void {
        if (this.data.phase !== phase) throw new Error(`Not allowed during the ${this.data.phase} phase`);
    }

    private expectTurn(playerId: string): void {
        if (this.currentPlayerId() !== playerId) throw new Error('It is not your turn');
    }

    private bumpMove(): void { this.data.moveCounter++; }

    private note(playerId: string, kind: LastMove['kind'], text: string): void {
        this.bumpMove();
        this.data.lastMove = { moveId: this.data.moveCounter, playerId, kind, text };
    }
}
