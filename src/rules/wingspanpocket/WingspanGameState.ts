/**
 * WingspanGameState.ts — the pure, framework-independent Wingspan (Pocket)
 * engine. No React / Socket.io / Multiplayr dependencies, so it is fully
 * unit-testable and JSON-serialisable (rehydrated via `from_data`).
 *
 * Implements the full turn state machine (§4): NEST_ACTION → ACTIVATE_FLOCK
 * (brown powers, left→right, greens skipped) → REFILL, the 3 nest actions
 * (§5), the closed power grammar (§7) as a finite resolver, green cost/power
 * modifiers, the end-game trigger (§4/§9), and scoring with the two optional
 * goals (§8). Choices are supplied by the caller; every choice also has a legal
 * default so the engine can auto-resolve headlessly (tests + AI).
 */

import {
    BirdCard, CARD_BY_ID, ALL_CARD_IDS, FoodType, FOOD_TYPES, PowerEffect,
    GoalId, GOAL_BY_ID, cardMatchesStaticGoal, GOALS,
    HAND_SIZE, RESERVE_BIRD_AT_SETUP, SUPPLY_BIRDS, FOOD_DECKS,
    NEST_EGG_LIMIT, START_NEST_EGGS, FLOCK_TARGET, MAX_LAY_EGGS
} from './WingspanData';

export enum Phase {
    Setup = 'setup',
    Nest = 'nest',            // choose & resolve one nest action
    Activate = 'activate',    // walk flock, activate brown powers
    Scoring = 'scoring',
    Done = 'done'
}

export type Face = 'bird' | 'food';

export interface CardInPlay {
    cardId: number;
    eggs: number;
    tucked: number[];   // face-down tucked card ids (each worth 1 pt)
}

export interface ReserveCard {
    cardId: number;
    face: Face;         // LOCKED once in reserve
}

export interface PlayerState {
    id: string;
    nestEggs: number;
    flock: CardInPlay[];      // ordered L→R; the Nest is tracked separately (leftmost slot)
    reserve: ReserveCard[];
    tokenIndex: number;       // activation pointer during ACTIVATE_FLOCK
}

export interface LastMove {
    moveId: number;
    playerId: string;
    kind: string;
    text: string;
}

export interface FoodPayment { cardId: number; as: FoodType; }
export interface PlayPayment {
    foods: FoodPayment[];      // reserve food cards spent (+ the type each is spent as)
    eggSources: number[];      // one entry per egg pip: flock index, or -1 for the Nest
}

export interface DrawPick {
    kind: 'bird' | 'food';
    index: number;             // supply-bird slot (bird) or food-deck index (food)
}

/** Choices for resolving one brown activation. Every field has a legal default. */
export interface ActivationChoices {
    foodDeck?: number;         // deck to draw / peek / hunt from (and for from_1_deck)
    supplyBird?: number;       // supply-bird slot for draw_bird
    drawCardKind?: 'bird' | 'food';
    eggTargets?: number[];     // flock index (or -1 Nest) per egg
    tuckCardId?: number;       // reserve card to tuck
    branch?: number;           // choose_one option index
    copyIndex?: number;        // copy_brown: own flock index
    copyPlayer?: string;       // copy_brown: neighbour id
    payFoodCardId?: number;    // gated pay: reserve food card to discard
    discardEggFrom?: number;   // gated pay: flock index (or -1 Nest) to spend an egg
    allPlayersStart?: string;  // all_players: player to start the effect from
}

export interface GameStateData {
    phase: Phase;
    advanced: boolean;
    players: Record<string, PlayerState>;
    playerOrder: string[];
    current: number;           // index into playerOrder
    firstPlayer: number;
    turnCount: Record<string, number>;
    nestActionTaken: boolean;
    // supply
    foodDecks: number[][];     // 4 face-down decks (top = end)
    supplyBirds: (number | null)[];
    discard: number[];
    // goals
    goals: GoalId[] | null;
    // end game
    endTriggered: boolean;
    scores: Record<string, number> | null;
    winnerIds: string[] | null;
    lastMove: LastMove | null;
    moveCounter: number;
}

// deterministic-ish shuffle (uses injected rng)
function shuffleWith<T>(arr: T[], rng: () => number): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

export interface StartOptions { advanced?: boolean; seed?: number; goals?: GoalId[]; }

function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return function () {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export class WingspanGameState {
    private data: GameStateData;
    private readonly playerIds: string[];
    private rng: () => number = Math.random;

    constructor(playerIds: string[]) {
        this.playerIds = [...playerIds];
        this.data = WingspanGameState.blankData(this.playerIds);
    }

    private static blankData(ids: string[]): GameStateData {
        const players: Record<string, PlayerState> = {};
        const turnCount: Record<string, number> = {};
        for (const id of ids) {
            players[id] = { id, nestEggs: 0, flock: [], reserve: [], tokenIndex: 0 };
            turnCount[id] = 0;
        }
        return {
            phase: Phase.Setup,
            advanced: false,
            players,
            playerOrder: [...ids],
            current: 0,
            firstPlayer: 0,
            turnCount,
            nestActionTaken: false,
            foodDecks: [[], [], [], []],
            supplyBirds: [null, null, null, null],
            discard: [],
            goals: null,
            endTriggered: false,
            scores: null,
            winnerIds: null,
            lastMove: null,
            moveCounter: 0
        };
    }

    public static from_data(data: GameStateData, playerIds: string[]): WingspanGameState {
        const gs = new WingspanGameState(playerIds);
        gs.data = { ...data };
        return gs;
    }
    public get_data(): GameStateData { return this.data; }

    // ========================================================================
    // Setup (§3)
    // ========================================================================

    public start_game(opts: StartOptions = {}): void {
        this.rng = opts.seed != null ? mulberry32(opts.seed) : Math.random;
        this.data = WingspanGameState.blankData(this.playerIds);
        this.data.advanced = !!opts.advanced;

        const deck = shuffleWith(ALL_CARD_IDS, this.rng);
        let cursor = 0;

        // 1. deal HAND_SIZE to each player
        for (const id of this.playerIds) {
            const hand = deck.slice(cursor, cursor + HAND_SIZE);
            cursor += HAND_SIZE;
            const p = this.data.players[id];
            p.nestEggs = START_NEST_EGGS;
            // basic split: first RESERVE_BIRD_AT_SETUP as bird-side, rest food-side
            p.reserve = hand.map((cardId, i) => ({
                cardId,
                face: (i < RESERVE_BIRD_AT_SETUP ? 'bird' : 'food') as Face
            }));
        }

        // 2. build the supply from the remaining cards
        const rest = deck.slice(cursor);
        const decks: number[][] = [[], [], [], []];
        rest.forEach((cardId, i) => decks[i % FOOD_DECKS].push(cardId));
        this.data.foodDecks = decks;
        // flip the top of each deck to its bird side → face-up supply birds
        for (let i = 0; i < SUPPLY_BIRDS; i++) {
            this.data.supplyBirds[i] = decks[i].length > 0 ? (decks[i].pop() as number) : null;
        }
        this.data.discard = [];

        // 3. goals (advanced)
        if (this.data.advanced) {
            const chosen = opts.goals && opts.goals.length === 2
                ? opts.goals
                : shuffleWith(GOALS.filter(g => !g.unused).map(g => g.id), this.rng).slice(0, 2);
            this.data.goals = chosen;
        }

        // 4. begin play
        this.data.phase = Phase.Nest;
        this.data.current = this.data.firstPlayer = 0;
        this.data.nestActionTaken = false;
    }

    // ========================================================================
    // Small helpers
    // ========================================================================

    public currentPlayerId(): string { return this.data.playerOrder[this.data.current]; }
    private player(id: string): PlayerState {
        const p = this.data.players[id];
        if (!p) throw new Error('Unknown player: ' + id);
        return p;
    }
    private card(cardId: number): BirdCard { return CARD_BY_ID[cardId]; }
    private isGreen(cardId: number): boolean { return this.card(cardId).color === 'green'; }

    private requireNest(id: string): PlayerState {
        if (this.data.phase !== Phase.Nest) throw new Error('Not the nest-action phase');
        if (id !== this.currentPlayerId()) throw new Error('Not your turn');
        if (this.data.nestActionTaken) throw new Error('Nest action already taken this turn');
        return this.player(id);
    }
    private requireActivate(id: string): PlayerState {
        if (this.data.phase !== Phase.Activate) throw new Error('Not the activation phase');
        if (id !== this.currentPlayerId()) throw new Error('Not your turn');
        return this.player(id);
    }

    private note(playerId: string, kind: string, text: string): void {
        this.data.moveCounter++;
        this.data.lastMove = { moveId: this.data.moveCounter, playerId, kind, text };
    }

    private eggLimitOf(p: PlayerState, flockIdx: number): number {
        if (flockIdx === -1) return NEST_EGG_LIMIT;
        const c = p.flock[flockIdx];
        return c ? this.card(c.cardId).egg_limit : 0;
    }
    private eggsOn(p: PlayerState, flockIdx: number): number {
        return flockIdx === -1 ? p.nestEggs : (p.flock[flockIdx]?.eggs || 0);
    }
    private addEgg(p: PlayerState, flockIdx: number): boolean {
        if (this.eggsOn(p, flockIdx) >= this.eggLimitOf(p, flockIdx)) return false;
        if (flockIdx === -1) p.nestEggs++; else p.flock[flockIdx].eggs++;
        return true;
    }
    private removeEgg(p: PlayerState, flockIdx: number): boolean {
        if (this.eggsOn(p, flockIdx) <= 0) return false;
        if (flockIdx === -1) p.nestEggs--; else p.flock[flockIdx].eggs--;
        return true;
    }
    private totalEggs(p: PlayerState): number {
        return p.nestEggs + p.flock.reduce((a, c) => a + c.eggs, 0);
    }

    // ---- green modifiers for the active player ----
    private greenSets(p: PlayerState) {
        const useAsAny = new Set<FoodType>();
        const ignore: FoodType[] = [];
        const foodInPowersAny = new Set<FoodType>();
        for (const c of p.flock) {
            const e = this.card(c.cardId).power.effect;
            if (e.op === 'use_as_any') useAsAny.add(e.food);
            else if (e.op === 'ignore_1_in_cost') ignore.push(e.food);
            else if (e.op === 'food_in_powers_is_any') foodInPowersAny.add(e.food);
        }
        return { useAsAny, ignore, foodInPowersAny };
    }

    // ========================================================================
    // Supply / food-deck plumbing (§9)
    // ========================================================================

    /** Ensure a deck can be drawn from; reshuffle discard bottom-half if empty. */
    private ensureDeck(i: number): void {
        if (this.data.foodDecks[i].length > 0) return;
        // take the bottom half of the discard (or of the largest deck if no discard)
        let source = this.data.discard;
        if (source.length === 0) {
            let largest = 0;
            for (let d = 0; d < FOOD_DECKS; d++) if (this.data.foodDecks[d].length > this.data.foodDecks[largest].length) largest = d;
            source = this.data.foodDecks[largest];
        }
        if (source.length === 0) return; // truly exhausted
        const half = Math.max(1, Math.floor(source.length / 2));
        const taken = source.splice(0, half);
        this.data.foodDecks[i] = shuffleWith(taken, this.rng);
    }

    private anyDeckWithCards(prefer?: number): number {
        if (prefer != null && this.data.foodDecks[prefer] && this.data.foodDecks[prefer].length > 0) return prefer;
        for (let i = 0; i < FOOD_DECKS; i++) if (this.data.foodDecks[i].length > 0) return i;
        // try reshuffling one
        for (let i = 0; i < FOOD_DECKS; i++) { this.ensureDeck(i); if (this.data.foodDecks[i].length > 0) return i; }
        return -1;
    }

    /** Draw 1 food of `food` (or 'any') into a player's reserve. Returns cardId or null. */
    private drawFoodToReserve(p: PlayerState, food: FoodType | 'any', preferDeck?: number): number | null {
        let deckIdx = -1;
        if (food !== 'any') {
            // prefer a deck whose top card shows the wanted food
            const order = preferDeck != null ? [preferDeck, 0, 1, 2, 3] : [0, 1, 2, 3];
            for (const i of order) {
                const d = this.data.foodDecks[i];
                if (d && d.length > 0 && this.card(d[d.length - 1]).reverse_food.includes(food)) { deckIdx = i; break; }
            }
        }
        if (deckIdx === -1) deckIdx = this.anyDeckWithCards(preferDeck);
        if (deckIdx === -1) return null;
        this.ensureDeck(deckIdx);
        const d = this.data.foodDecks[deckIdx];
        if (d.length === 0) return null;
        const cardId = d.pop() as number;
        p.reserve.push({ cardId, face: 'food' });
        return cardId;
    }

    /** Refill emptied supply-bird slots from the adjacent food deck (phase 3). */
    private refillSupplyBirds(): void {
        for (let i = 0; i < SUPPLY_BIRDS; i++) {
            if (this.data.supplyBirds[i] != null) continue;
            this.ensureDeck(i);
            const d = this.data.foodDecks[i];
            this.data.supplyBirds[i] = d.length > 0 ? (d.pop() as number) : null;
        }
    }

    // ========================================================================
    // Cost / payment (§5.1)
    // ========================================================================

    /** The required specific food pips of a card, after green ignore-reductions. */
    private requiredPips(p: PlayerState, card: BirdCard): FoodType[] {
        const ignore = this.greenSets(p).ignore.slice();
        const req: FoodType[] = [];
        for (const f of FOOD_TYPES) {
            let n = card.cost.food[f] || 0;
            while (n > 0 && ignore.indexOf(f) !== -1) { n--; ignore.splice(ignore.indexOf(f), 1); }
            for (let k = 0; k < n; k++) req.push(f);
        }
        return req;
    }

    /** A reserve food card as a payable resource: the types it can be + wild (green). */
    private foodRes(p: PlayerState, cardId: number): { cardId: number; options: FoodType[]; wild: boolean } {
        const rf = this.card(cardId).reverse_food;
        const useAsAny = this.greenSets(p).useAsAny;
        return { cardId, options: rf, wild: rf.some(t => useAsAny.has(t)) };
    }

    /**
     * Maximum bipartite matching of specific pips → cards that can serve them.
     * A card serves a pip if the pip is one of its printed food types, or the
     * card is wild (a green `use_as_any`). This is what makes a 2-food card
     * flexibly cover *either* type — a greedy pass gets this wrong.
     */
    private matchPips(req: FoodType[], foods: { options: FoodType[]; wild: boolean }[]): number[] {
        const canServe = (c: { options: FoodType[]; wild: boolean }, pip: FoodType) => c.wild || c.options.indexOf(pip) !== -1;
        const cardPip = new Array(foods.length).fill(-1); // card index → matched pip index (or -1)
        const tryPip = (pipIdx: number, seen: boolean[]): boolean => {
            for (let c = 0; c < foods.length; c++) {
                if (!seen[c] && canServe(foods[c], req[pipIdx])) {
                    seen[c] = true;
                    if (cardPip[c] === -1 || tryPip(cardPip[c], seen)) { cardPip[c] = pipIdx; return true; }
                }
            }
            return false;
        };
        for (let pi = 0; pi < req.length; pi++) tryPip(pi, new Array(foods.length).fill(false));
        return cardPip;
    }

    /** Do these food cards (+ eggs) cover the cost? (2-for-1 allowed, proper matching). */
    private coverCost(p: PlayerState, card: BirdCard, foods: { options: FoodType[]; wild: boolean }[], eggCount: number): boolean {
        if (eggCount < (card.cost.egg || 0)) return false; // eggs are paid exactly, never converted
        const req = this.requiredPips(p, card);
        const wildPips = card.cost.any || 0;
        const S = req.length;
        const n = foods.length;
        const M = this.matchPips(req, foods).filter(x => x >= 0).length;
        // the M matched cards cover M specific pips; the remaining (n − M) cards must
        // cover the wild pips (1 card each) and the unmatched specifics (2-for-1, 2 each)
        return (n - M) >= wildPips + 2 * (S - M);
    }

    /**
     * Dry-run: does this exact payment legally cover the card's cost, given the
     * player's reserve foods / eggs / green modifiers? Used by the UI so a player
     * can hand-pick their payment and see live whether it is valid. Does not
     * check phase/turn and does not mutate state.
     */
    public can_pay(id: string, cardId: number, payment: PlayPayment): boolean {
        const p = this.player(id);
        const card = this.card(cardId);
        const foods = payment.foods || [];
        const seen = new Set<number>();
        const resolved: { options: FoodType[]; wild: boolean }[] = [];
        for (const f of foods) {
            if (seen.has(f.cardId)) return false;
            seen.add(f.cardId);
            const rc = p.reserve.find(r => r.cardId === f.cardId && r.face === 'food');
            if (!rc) return false;
            // a food card can be spent as ANY of its printed types — validate by matching
            resolved.push(this.foodRes(p, f.cardId));
        }
        const eggSources = payment.eggSources || [];
        if (eggSources.length < (card.cost.egg || 0)) return false;
        const eggUse: Record<number, number> = {};
        for (const s of eggSources) eggUse[s] = (eggUse[s] || 0) + 1;
        for (const k of Object.keys(eggUse)) {
            if (this.eggsOn(p, Number(k)) < eggUse[Number(k)]) return false;
        }
        return this.coverCost(p, card, resolved, eggSources.length);
    }

    /** Suggest the cheapest legal payment for a card (used by the UI). */
    public computeAutoPayment(id: string, cardId: number): PlayPayment | null {
        const p = this.player(id);
        const card = this.card(cardId);
        const greens = this.greenSets(p);
        // egg sources: prefer Nest, then flock birds with eggs
        const eggSources: number[] = [];
        const eggNeed = card.cost.egg || 0;
        const eggCandidates: number[] = [];
        if (p.nestEggs > 0) for (let k = 0; k < p.nestEggs; k++) eggCandidates.push(-1);
        p.flock.forEach((c, i) => { for (let k = 0; k < c.eggs; k++) eggCandidates.push(i); });
        for (let k = 0; k < eggNeed; k++) { if (k >= eggCandidates.length) return null; eggSources.push(eggCandidates[k]); }

        // Assign reserve food cards via proper bipartite matching (a 2-food card
        // can flexibly cover either of its types), then use leftovers for wild
        // pips and 2-for-1 conversions.
        const foodCards = p.reserve.filter(r => r.face === 'food');
        const res = foodCards.map(r => this.foodRes(p, r.cardId));
        const req = this.requiredPips(p, card);
        const wildPips = card.cost.any || 0;

        const cardPip = this.matchPips(req, res);
        const chosen: FoodPayment[] = [];
        const usedIdx = new Set<number>();
        // matched cards → the specific pip they serve (as a valid printed type)
        cardPip.forEach((pip, ci) => {
            if (pip < 0) return;
            usedIdx.add(ci);
            const rf = res[ci].options;
            const as = rf.indexOf(req[pip]) !== -1 ? req[pip] : rf[0];
            chosen.push({ cardId: res[ci].cardId, as });
        });
        const unmatchedPips = req.length - usedIdx.size;
        const leftover: number[] = [];
        res.forEach((_, ci) => { if (!usedIdx.has(ci)) leftover.push(ci); });
        // leftovers cover wild pips (1 each) then 2-for-1 for the unmatched specifics
        const need = wildPips + 2 * unmatchedPips;
        if (leftover.length < need) return null;
        for (let k = 0; k < need; k++) {
            const ci = leftover[k];
            chosen.push({ cardId: res[ci].cardId, as: res[ci].options[0] });
        }
        return { foods: chosen, eggSources };
    }

    // ========================================================================
    // Nest action 1 — PLAY A BIRD (§5.1)
    // ========================================================================

    public play_bird(id: string, cardId: number, payment: PlayPayment): void {
        const p = this.requireNest(id);
        const ri = p.reserve.findIndex(r => r.cardId === cardId && r.face === 'bird');
        if (ri === -1) throw new Error('That bird is not in your reserve');
        const card = this.card(cardId);

        // validate payment foods are in reserve (food-face); a food card can be
        // spent as ANY of its printed types, so covering is decided by matching.
        const foods = payment.foods || [];
        const seen = new Set<number>();
        const resolved: { options: FoodType[]; wild: boolean }[] = [];
        for (const f of foods) {
            if (seen.has(f.cardId)) throw new Error('Duplicate food card in payment');
            seen.add(f.cardId);
            const rc = p.reserve.find(r => r.cardId === f.cardId && r.face === 'food');
            if (!rc) throw new Error('Food card not in reserve');
            resolved.push(this.foodRes(p, f.cardId));
        }
        // validate egg sources
        const eggSources = payment.eggSources || [];
        if (eggSources.length < (card.cost.egg || 0)) throw new Error('Not enough eggs paid');
        const eggUse: Record<number, number> = {};
        for (const s of eggSources) eggUse[s] = (eggUse[s] || 0) + 1;
        for (const k of Object.keys(eggUse)) {
            const idx = Number(k);
            if (this.eggsOn(p, idx) < eggUse[idx]) throw new Error('Not enough eggs on that source');
        }

        if (!this.coverCost(p, card, resolved, eggSources.length)) {
            throw new Error('Payment does not cover the cost');
        }

        // commit: discard spent foods (food-side up), spend eggs
        for (const f of foods) {
            const idx = p.reserve.findIndex(r => r.cardId === f.cardId && r.face === 'food');
            if (idx >= 0) { p.reserve.splice(idx, 1); this.data.discard.push(f.cardId); }
        }
        for (const s of eggSources.slice(0, card.cost.egg || 0)) this.removeEgg(p, s);

        // move the bird from reserve to the right end of the flock
        p.reserve.splice(p.reserve.findIndex(r => r.cardId === cardId && r.face === 'bird'), 1);
        p.flock.push({ cardId, eggs: 0, tucked: [] });

        this.note(id, 'play', `played ${card.common_name}`);
        this.beginActivation(p);
    }

    // ========================================================================
    // Nest action 2 — DRAW 2 CARDS (§5.2)
    // ========================================================================

    public draw_2(id: string, picks: DrawPick[]): void {
        const p = this.requireNest(id);
        if (!picks || picks.length === 0 || picks.length > 2) throw new Error('Pick 1 or 2 cards');
        let birds = 0, foods = 0;
        for (const pick of picks) {
            if (pick.kind === 'bird') {
                if (birds >= 2) throw new Error('At most 2 birds');
                const slot = pick.index;
                const cardId = this.data.supplyBirds[slot];
                if (cardId == null) throw new Error('No supply bird there');
                this.data.supplyBirds[slot] = null; // refilled at end of turn
                p.reserve.push({ cardId, face: 'bird' });
                birds++;
            } else {
                if (foods >= 2) throw new Error('At most 2 food');
                const deckIdx = pick.index;
                this.ensureDeck(deckIdx);
                const d = this.data.foodDecks[deckIdx];
                if (!d || d.length === 0) throw new Error('That food deck is empty');
                const cardId = d.pop() as number;
                p.reserve.push({ cardId, face: 'food' });
                foods++;
            }
        }
        this.note(id, 'draw', `drew ${picks.length} card${picks.length > 1 ? 's' : ''}`);
        this.beginActivation(p);
    }

    // ========================================================================
    // Nest action 3 — LAY UP TO 3 EGGS (§5.3)
    // ========================================================================

    public lay_eggs(id: string, targets: number[]): void {
        const p = this.requireNest(id);
        if (!targets || targets.length === 0 || targets.length > MAX_LAY_EGGS) throw new Error('Lay 1–3 eggs');
        // each on a DIFFERENT card
        if (new Set(targets).size !== targets.length) throw new Error('Each egg must go on a different card');
        for (const t of targets) {
            if (this.eggsOn(p, t) >= this.eggLimitOf(p, t)) throw new Error('That card is at its egg limit');
        }
        for (const t of targets) this.addEgg(p, t);
        this.note(id, 'lay', `laid ${targets.length} egg${targets.length > 1 ? 's' : ''}`);
        this.beginActivation(p);
    }

    // ========================================================================
    // Phase 2 — ACTIVATE FLOCK (brown powers, left→right)
    // ========================================================================

    private nextBrownFrom(p: PlayerState, start: number): number {
        for (let i = start; i < p.flock.length; i++) {
            if (!this.isGreen(p.flock[i].cardId)) return i;
        }
        return p.flock.length;
    }

    private beginActivation(p: PlayerState): void {
        this.data.nestActionTaken = true;
        this.data.phase = Phase.Activate;
        p.tokenIndex = this.nextBrownFrom(p, 0);
        if (p.tokenIndex >= p.flock.length) this.finishTurn(p); // no brown birds → refill + advance
    }

    /** Activate the current (brown) bird's power. */
    public activate(id: string, choices: ActivationChoices = {}): void {
        const p = this.requireActivate(id);
        const idx = p.tokenIndex;
        if (idx >= p.flock.length) throw new Error('No bird to activate');
        if (this.isGreen(p.flock[idx].cardId)) throw new Error('Green birds are passive');
        const card = this.card(p.flock[idx].cardId);
        this.resolveEffect(p, idx, card.power.effect, choices, 0);
        this.note(id, 'activate', `activated ${card.common_name}`);
        this.advanceToken(p);
    }

    /** Skip the current brown bird (its power is optional). */
    public skip_activation(id: string): void {
        const p = this.requireActivate(id);
        this.advanceToken(p);
    }

    /** Skip all remaining brown birds and end the turn. */
    public end_activation(id: string): void {
        const p = this.requireActivate(id);
        this.finishTurn(p);
    }

    private advanceToken(p: PlayerState): void {
        const next = this.nextBrownFrom(p, p.tokenIndex + 1);
        p.tokenIndex = next;
        if (next >= p.flock.length) this.finishTurn(p);
    }

    private finishTurn(p: PlayerState): void {
        // phase 3 — refill supply birds
        this.refillSupplyBirds();
        // end-of-game trigger check (§9): any flock reaches FLOCK_TARGET
        for (const id of this.playerIds) {
            if (this.player(id).flock.length >= FLOCK_TARGET) this.data.endTriggered = true;
        }
        this.advanceTurn();
    }

    private advanceTurn(): void {
        const cur = this.currentPlayerId();
        this.data.turnCount[cur]++;
        const n = this.data.playerOrder.length;
        this.data.current = (this.data.current + 1) % n;
        this.data.nestActionTaken = false;
        this.data.phase = Phase.Nest;
        // end once the round completes after the trigger (equal turns for all)
        if (this.data.endTriggered && this.data.current === this.data.firstPlayer) {
            const counts = this.playerIds.map(id => this.data.turnCount[id]);
            if (counts.every(c => c === counts[0])) { this.scoreGame(); }
        }
    }

    // ========================================================================
    // Effect resolver (§7) — a finite switch over the closed op set
    // ========================================================================

    /** Returns true if the effect "did something" (used by gated pay). */
    private resolveEffect(p: PlayerState, birdIdx: number, e: PowerEffect, ch: ActivationChoices, depth: number): boolean {
        const greens = this.greenSets(p);
        const remap = (f: FoodType | 'any'): FoodType | 'any' =>
            (f !== 'any' && greens.foodInPowersAny.has(f)) ? 'any' : f;

        switch (e.op) {
            case 'none': return false;

            case 'draw_food':
            case 'gain_food': {
                const got = this.drawFoodToReserve(p, remap(e.food), ch.foodDeck);
                return got != null;
            }

            case 'draw_bird': {
                const slot = this.pickSupplyBird(e.filter, ch.supplyBird);
                if (slot === -1) return false;
                const cardId = this.data.supplyBirds[slot] as number;
                this.data.supplyBirds[slot] = null;
                p.reserve.push({ cardId, face: 'bird' });
                return true;
            }

            case 'draw_card': {
                // prefer a supply bird, else a food deck top
                const kind = ch.drawCardKind || (this.data.supplyBirds.some(s => s != null) ? 'bird' : 'food');
                if (kind === 'bird') {
                    const slot = ch.supplyBird != null && this.data.supplyBirds[ch.supplyBird] != null
                        ? ch.supplyBird : this.data.supplyBirds.findIndex(s => s != null);
                    if (slot >= 0) {
                        const cardId = this.data.supplyBirds[slot] as number;
                        this.data.supplyBirds[slot] = null;
                        p.reserve.push({ cardId, face: 'bird' });
                        return true;
                    }
                }
                return this.drawFoodToReserve(p, 'any', ch.foodDeck) != null;
            }

            case 'tuck': {
                const cardId = this.pickTuckCard(p, e.from, e.food, ch.tuckCardId);
                if (cardId == null) return false;
                const ri = p.reserve.findIndex(r => r.cardId === cardId);
                p.reserve.splice(ri, 1);
                p.flock[birdIdx].tucked.push(cardId);
                return true;
            }

            case 'lay_egg': {
                const n = e.count || 1;
                let laid = 0;
                const targets = (ch.eggTargets && ch.eggTargets.length) ? ch.eggTargets.slice() : this.autoEggTargets(p, birdIdx, e.target, n);
                for (const t of targets) {
                    if (laid >= n) break;
                    if (e.target === 'this' && t !== birdIdx) continue;
                    if (e.target === 'another' && t === birdIdx) continue;
                    if (this.addEgg(p, t)) laid++;
                }
                return laid > 0;
            }

            case 'hunt': {
                const deckIdx = this.anyDeckWithCards(ch.foodDeck);
                if (deckIdx === -1) return false;
                this.ensureDeck(deckIdx);
                const d = this.data.foodDecks[deckIdx];
                if (d.length === 0) return false;
                const cardId = d.pop() as number;
                if (this.card(cardId).wingspan_cm < e.max) {
                    p.flock[birdIdx].tucked.push(cardId); // caught → tuck (1 pt)
                    return true;
                }
                this.data.discard.push(cardId); // escaped → discard
                return false;
            }

            case 'discard': {
                if (e.what === 'egg') {
                    const from = ch.discardEggFrom != null ? ch.discardEggFrom : this.autoEggSource(p);
                    return from != null && this.removeEgg(p, from);
                }
                if (e.what === 'bird') {
                    const ri = p.reserve.findIndex(r => r.face === 'bird');
                    if (ri === -1) return false;
                    const cardId = p.reserve.splice(ri, 1)[0].cardId;
                    this.data.discard.push(cardId);
                    return true;
                }
                // food
                const want = e.food && e.food !== 'any' ? e.food : null;
                const ri = ch.payFoodCardId != null
                    ? p.reserve.findIndex(r => r.cardId === ch.payFoodCardId && r.face === 'food')
                    : p.reserve.findIndex(r => r.face === 'food' && (!want || this.card(r.cardId).reverse_food.includes(want)));
                if (ri === -1) return false;
                const cardId = p.reserve.splice(ri, 1)[0].cardId;
                this.data.discard.push(cardId);
                return true;
            }

            case 'gated': {
                const paid = this.resolveEffect(p, birdIdx, e.pay, ch, depth);
                if (!paid) return false;
                return this.resolveEffect(p, birdIdx, e.gain, ch, depth);
            }

            case 'choose_one': {
                const b = Math.min(Math.max(0, ch.branch || 0), e.options.length - 1);
                return this.resolveEffect(p, birdIdx, e.options[b], ch, depth);
            }

            case 'sequence': {
                let any = false;
                for (const s of e.steps) any = this.resolveEffect(p, birdIdx, s, ch, depth) || any;
                return any;
            }

            case 'copy_brown': {
                if (depth > 2) return false;
                const copied = this.pickBrownToCopy(p, e.scope, ch);
                if (!copied) return false;
                return this.resolveEffect(p, birdIdx, copied, ch, depth + 1);
            }

            case 'all_players': {
                const order = this.allPlayersOrder(ch.allPlayersStart);
                let any = false;
                for (const pid of order) {
                    const pp = this.player(pid);
                    if (e.from_1_deck && (e.effect.op === 'draw_food' || e.effect.op === 'gain_food')) {
                        const deckIdx = this.anyDeckWithCards(ch.foodDeck);
                        if (deckIdx !== -1) {
                            this.ensureDeck(deckIdx);
                            const d = this.data.foodDecks[deckIdx];
                            if (d.length > 0) { pp.reserve.push({ cardId: d.pop() as number, face: 'food' }); any = true; }
                        }
                    } else {
                        // resolve the effect for pp against their own last flock bird (best effort)
                        any = this.resolveEffect(pp, Math.max(0, pp.flock.length - 1), e.effect, {}, depth + 1) || any;
                    }
                }
                return any;
            }

            // green modifiers are passive — never resolved as a step
            case 'use_as_any':
            case 'ignore_1_in_cost':
            case 'food_in_powers_is_any':
            case 'copy_green_power':
                return false;

            default: return false;
        }
    }

    // ---- resolver helpers ----

    private pickSupplyBird(filter: any, prefer?: number): number {
        const matches = (cardId: number | null): boolean => {
            if (cardId == null) return false;
            const c = this.card(cardId);
            if (!filter) return true;
            if (filter.cost_contains) return (c.cost.food[filter.cost_contains] || 0) > 0; // [any] does NOT satisfy
            if (filter.egg_limit != null) return c.egg_limit === filter.egg_limit;
            if (filter.egg_limit_min != null) return c.egg_limit >= filter.egg_limit_min;
            return true;
        };
        const candidates: number[] = [];
        this.data.supplyBirds.forEach((cid, i) => { if (matches(cid)) candidates.push(i); });
        if (candidates.length === 0) return -1;
        if (filter && (filter.select === 'largest_wingspan' || filter.select === 'smallest_wingspan')) {
            candidates.sort((a, b) => {
                const wa = this.card(this.data.supplyBirds[a] as number).wingspan_cm;
                const wb = this.card(this.data.supplyBirds[b] as number).wingspan_cm;
                return filter.select === 'largest_wingspan' ? wb - wa : wa - wb;
            });
            return candidates[0];
        }
        if (prefer != null && candidates.indexOf(prefer) !== -1) return prefer;
        return candidates[0];
    }

    private pickTuckCard(p: PlayerState, from: 'bird' | 'food' | 'any', food: FoodType | undefined, prefer?: number): number | null {
        const ok = (r: ReserveCard): boolean => {
            if (from === 'bird') return r.face === 'bird';
            if (from === 'food') return r.face === 'food' && (!food || this.card(r.cardId).reverse_food.includes(food));
            return true;
        };
        if (prefer != null) { const r = p.reserve.find(x => x.cardId === prefer && ok(x)); if (r) return r.cardId; }
        const r = p.reserve.find(ok);
        return r ? r.cardId : null;
    }

    private autoEggTargets(p: PlayerState, birdIdx: number, target: 'this' | 'another' | 'any' | undefined, n: number): number[] {
        const out: number[] = [];
        const push = (i: number) => { if (out.indexOf(i) === -1 && this.eggsOn(p, i) < this.eggLimitOf(p, i)) out.push(i); };
        if (target === 'this') { for (let k = 0; k < n; k++) out.push(birdIdx); return out; }
        if (target !== 'another') push(-1); // nest first for 'any'
        p.flock.forEach((_, i) => { if (!(target === 'another' && i === birdIdx)) push(i); });
        return out;
    }
    private autoEggSource(p: PlayerState): number | null {
        if (p.nestEggs > 0) return -1;
        for (let i = 0; i < p.flock.length; i++) if (p.flock[i].eggs > 0) return i;
        return null;
    }

    private pickBrownToCopy(p: PlayerState, scope: 'own' | 'right' | 'left_rightmost', ch: ActivationChoices): PowerEffect | null {
        const brownEffect = (pl: PlayerState, idx: number): PowerEffect | null => {
            const c = pl.flock[idx]; if (!c || this.isGreen(c.cardId)) return null;
            const eff = this.card(c.cardId).power.effect;
            return eff.op === 'copy_brown' ? null : eff; // never copy a copy
        };
        if (scope === 'own') {
            if (ch.copyIndex != null) { const e = brownEffect(p, ch.copyIndex); if (e) return e; }
            for (let i = 0; i < p.flock.length; i++) { const e = brownEffect(p, i); if (e) return e; }
            return null;
        }
        const n = this.data.playerOrder.length;
        const myIdx = this.data.playerOrder.indexOf(p.id);
        if (scope === 'right') {
            const rightId = this.data.playerOrder[(myIdx + 1) % n];
            const rp = this.player(rightId);
            if (ch.copyIndex != null) { const e = brownEffect(rp, ch.copyIndex); if (e) return e; }
            for (let i = 0; i < rp.flock.length; i++) { const e = brownEffect(rp, i); if (e) return e; }
            return null;
        }
        // left_rightmost
        const leftId = this.data.playerOrder[(myIdx - 1 + n) % n];
        const lp = this.player(leftId);
        for (let i = lp.flock.length - 1; i >= 0; i--) { const e = brownEffect(lp, i); if (e) return e; }
        return null;
    }

    private allPlayersOrder(start?: string): string[] {
        const order = this.data.playerOrder;
        const s = start && order.indexOf(start) !== -1 ? order.indexOf(start) : this.data.current;
        const out: string[] = [];
        for (let k = 0; k < order.length; k++) out.push(order[(s + k) % order.length]);
        return out;
    }

    // ========================================================================
    // Scoring (§8)
    // ========================================================================

    /** Does a flock bird qualify for a goal (static or positional)? */
    private qualifiesForGoal(p: PlayerState, idx: number, goal: GoalId): boolean {
        const c = p.flock[idx];
        const card = this.card(c.cardId);
        const def = GOAL_BY_ID[goal];
        if (!def.positional) {
            return cardMatchesStaticGoal(card, goal, { eggs: c.eggs, tucked: c.tucked.length });
        }
        // positional: compare against all birds to the left
        if (goal === 'pos_more_points_than_left') {
            for (let i = 0; i < idx; i++) if (this.card(p.flock[i].cardId).victory_points >= card.victory_points) return false;
            return true; // leftmost auto-qualifies
        }
        if (goal === 'pos_larger_wingspan_than_left') {
            for (let i = 0; i < idx; i++) if (this.card(p.flock[i].cardId).wingspan_cm >= card.wingspan_cm) return false;
            return true;
        }
        return false;
    }

    public computeScore(id: string): { total: number; vp: number; eggs: number; tucked: number; goals: number } {
        const p = this.player(id);
        const eggs = this.totalEggs(p);
        let vp = 0, tucked = 0, goalPts = 0;
        for (const c of p.flock) { vp += this.card(c.cardId).victory_points; tucked += c.tucked.length; }
        if (this.data.goals) {
            for (const g of this.data.goals) {
                p.flock.forEach((c, i) => { if (this.qualifiesForGoal(p, i, g)) goalPts += c.eggs; });
            }
        }
        return { total: vp + eggs + tucked + goalPts, vp, eggs, tucked, goals: goalPts };
    }

    private scoreGame(): void {
        const scores: Record<string, number> = {};
        for (const id of this.playerIds) scores[id] = this.computeScore(id).total;
        this.data.scores = scores;
        // winner: most points; tie-break most cards in reserve
        let best = -Infinity; let winners: string[] = [];
        for (const id of this.playerIds) {
            if (scores[id] > best) { best = scores[id]; winners = [id]; }
            else if (scores[id] === best) winners.push(id);
        }
        if (winners.length > 1) {
            const reserveCount = (id: string) => this.player(id).reserve.length;
            const maxR = Math.max(...winners.map(reserveCount));
            winners = winners.filter(id => reserveCount(id) === maxR);
        }
        this.data.winnerIds = winners;
        this.data.phase = Phase.Scoring;
    }

    public finalize(): void { if (this.data.phase === Phase.Scoring) this.data.phase = Phase.Done; }

    // ========================================================================
    // Getters (view props / tests)
    // ========================================================================

    public get_phase(): Phase { return this.data.phase; }
    public get_advanced(): boolean { return this.data.advanced; }
    public get_goals(): GoalId[] | null { return this.data.goals; }
    public get_player(id: string): PlayerState | undefined { return this.data.players[id]; }
    public get_player_order(): string[] { return [...this.data.playerOrder]; }
    public get_current_index(): number { return this.data.current; }
    public get_turn_count(id: string): number { return this.data.turnCount[id] || 0; }
    public get_nest_taken(): boolean { return this.data.nestActionTaken; }
    public get_supply_birds(): (number | null)[] { return [...this.data.supplyBirds]; }
    public get_food_deck_counts(): number[] { return this.data.foodDecks.map(d => d.length); }
    /** The (visible) top card of each food deck — the food you would draw next. */
    public get_food_deck_tops(): (number | null)[] { return this.data.foodDecks.map(d => d.length > 0 ? d[d.length - 1] : null); }
    public get_discard_count(): number { return this.data.discard.length; }
    public get_end_triggered(): boolean { return this.data.endTriggered; }
    public get_scores(): Record<string, number> | null { return this.data.scores; }
    public get_winners(): string[] | null { return this.data.winnerIds; }
    public get_last_move(): LastMove | null { return this.data.lastMove; }
    public get_token_index(id: string): number { return this.player(id).tokenIndex; }

    /** The current activation target (flock index) if in the activate phase, else -1. */
    public get_active_bird_index(): number {
        if (this.data.phase !== Phase.Activate) return -1;
        const p = this.player(this.currentPlayerId());
        return p.tokenIndex < p.flock.length ? p.tokenIndex : -1;
    }
}

export default WingspanGameState;
