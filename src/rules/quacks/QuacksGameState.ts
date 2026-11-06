/**
 * QuacksGameState.ts — the pure, framework-independent Quacks of Quedlinburg engine.
 *
 * No React / Socket.io / Multiplayr dependencies: fully unit-testable and
 * JSON-serialisable (rehydrated via `from_data`).
 *
 * Round loop:
 *   FORTUNE (card, rats, any card choices)
 *     → BREW  (everyone draws at once; free-paced, or lock-step "Stir!" ticks)
 *     → EVAL  (bonus die → chip actions → rubies → points / shop → ruby spending)
 *     → cleanup → next round … → DONE after round 9.
 *
 * Every decision a player owes is modelled as a `Prompt` at the head of their
 * own queue, so the views render one generic chooser and the engine keeps the
 * whole rule set. Evaluation is resolved per player in parallel rather than
 * strictly clockwise: no step depends on another player's choice, and the only
 * shared resource (the chip supply) is settled first come, first served.
 *
 * The Herb Witches expansion (`expansion: true`) layers on: sets 5 and 6, fool's
 * herbs, 6-pumpkins, a fifth player, the overflow bowl, and three herb witches
 * each player may call once per game by spending that metal's penny.
 *
 * The Alchemists expansion (`alch: true`) adds a patient per player, an essence
 * phase between brewing and scoring (Phase.Essence), locoweed books and twenty
 * fortune cards. Both expansions can be played together.
 */

import {
    Chip, ChipColor, makeChip, chipColor, chipValue, CHIP_SUPPLY, EXPANSION_SUPPLY, chipValues,
    STARTING_BAG, INGREDIENT_NAME,
    Book, getBook, revealedColors, BookSets, normalizeBookSets, presetOf,
    Metal, METALS, WITCHES, WITCH_BY_ID, Witch, maxPlayers, PENNY_VP,
    ALCHEMIST_SUPPLY, PATIENTS, PATIENT_BY_ID, Patient, Glass, glassLabel, CHICKEN_BONUS, ESSENCE_MAX, PATIENTS_DEALT,
    fortuneDeckFor,
    Field, fieldAt, LAST_FIELD, SPOON_FIELD,
    DieFace, DIE_FACES, DIE_FACE_LABEL, ratTailsBetween,
    FORTUNE_CARDS, FORTUNE_BY_ID,
    MIN_PLAYERS, ROUNDS, BASE_THRESHOLD, FLASK_COST, DROPLET_COST,
    COINS_PER_VP, RUBIES_PER_VP, EXTRA_WHITE_ROUND
} from './QuacksData';

export enum Phase {
    Setup = 'setup',
    Fortune = 'fortune',
    Brew = 'brew',
    Essence = 'essence',     // Alchemists only: between brewing and scoring
    Eval = 'eval',
    Done = 'done'
}

/** Where a player is in their own evaluation. */
export type EvalStage = 'actions' | 'shop' | 'rubies' | 'ready';

export interface PotChip { chip: Chip; pos: number; gone?: boolean; }

export interface PromptOption { id: string; label: string; chip?: Chip; }

export interface Prompt {
    kind: string;
    title: string;
    text: string;
    /** Chips drawn out of the bag for this decision; they go back unless used. */
    held: Chip[];
    options: PromptOption[];
    data?: any;
}

export interface PlayerState {
    id: string;
    vp: number;
    rubies: number;
    droplet: number;
    flaskFull: boolean;
    bag: Chip[];
    pot: PotChip[];
    aside: Chip[];            // set-aside toadstools (red, set 2) — persist across rounds
    ratTails: number;
    origin: number;           // where this round's first chip counts from
    stopped: boolean;
    exploded: boolean;
    potFull: boolean;
    shielded: boolean;        // exploded inside a crow-skull shield (blue, set 2)
    shieldSize: number;
    shieldUsed: number;
    doubleNext: boolean;      // mandrake (yellow, set 2)
    whiteReturned: boolean;   // Well Stirred used
    canFlask: boolean;
    intent: 'draw' | 'stop' | null;   // lock-step only
    prompts: Prompt[];
    stage: EvalStage | null;
    fieldScored: boolean;
    takeVp: boolean;
    takeShop: boolean;
    coins: number;
    rolled: DieFace[];
    notes: string[];          // what happened to this player this round
    lastReach: number;        // furthest chip in the final round (tie-break)
    rubyDone: boolean;        // phase C resolved this round

    // ---- Herb Witches expansion ----
    overflow: Chip[];         // chips drawn after the pot filled up
    lastOverflow: boolean;    // the newest chip went to the overflow bowl
    reserve: Chip[];          // held by a toadstool (red, set 6) — must be laid this round
    carry: Chip | null;       // kept by a garden spider (green, set 5) for next round
    pennies: Record<string, boolean>;   // metal → penny still unspent
    saved: boolean;           // The Survivor: this explosion scores as if it had not happened
    cheap: boolean;           // The Discounter: droplet / flask cost 1 ruby this round
    extraShops: number[];     // further shopping trips this round (ghost's breath, set 5)
    bought: Chip[];           // chips bought this round (The Twinner copies one)
    boomAt: 'pot' | 'overflow' | 'reserve' | null;   // where the exploding chip sits

    // ---- The Alchemists ----
    patient: string | null;   // the patient this player treats
    essence: number;          // essence marker: next round's budget for power patients
    essenceReach: number;     // how far the marker got in this round's essence phase
    extraRats: number;        // rat tails earned for next round
    pendingDraw: number;      // The Startles: chips to draw and hold at the next brew
    hand: Chip[];             // held chips (The Startles) — lay one instead of drawing
    neighbourUsed: boolean;   // fortune "Good Neighbours" spent this round
}

export interface LastMove { moveId: number; playerId: string | null; text: string; tone: 'info' | 'boom' | 'good'; }

export interface GameStateData {
    phase: Phase;
    round: number;
    bookSets: BookSets;          // which set's book each variable colour uses
    stirAlways: boolean;
    playerOrder: string[];
    startIndex: number;
    players: Record<string, PlayerState>;
    supply: Record<Chip, number>;
    fortuneDeck: string[];
    fortune: string | null;
    fortuneNotes: string[];
    winnerIds: string[] | null;
    lastMove: LastMove | null;
    moveCounter: number;
    expansion: boolean;                       // Herb Witches
    witches: Record<string, string> | null;   // metal → the witch dealt for this game
    alch: boolean;                            // The Alchemists
    patients: string[];                       // the three patients on the table
    guestWitch: string | null;                // fortune "A Witch Visits": a free extra witch this round
}

export interface StartOptions {
    setNumber?: number;          // every book from one set…
    bookSets?: BookSets;         // …or a per-colour mix (wins over setNumber)
    stirAlways?: boolean;
    herbWitches?: boolean;
    alchemists?: boolean;
    seed?: number;
}

export interface ShopOffer { chip: Chip; cost: number; left: number; }

function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return function () {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const rubyWord = (n: number) => (n === 1 ? '1 ruby' : `${n} rubies`);
const UPGRADE: Record<number, number> = { 1: 2, 2: 4 };
export const chipLabel = (c: Chip) => `${INGREDIENT_NAME[chipColor(c)]} ${chipValue(c)}`;

// ---------------------------------------------------------------------------

export class QuacksGameState {
    private readonly playerIds: string[];
    private data: GameStateData;
    private rng: () => number;

    constructor(playerIds: string[], rng?: () => number) {
        this.playerIds = [...playerIds];
        this.rng = rng || Math.random;
        this.data = QuacksGameState.create_initial_state(this.playerIds);
    }

    public static create_initial_state(playerIds: string[]): GameStateData {
        const supply: Record<Chip, number> = {};
        (Object.keys(CHIP_SUPPLY) as ChipColor[]).forEach((color) => {
            Object.keys(CHIP_SUPPLY[color]).forEach((v) => {
                supply[makeChip(color, Number(v))] = CHIP_SUPPLY[color][Number(v)];
            });
        });
        const players: Record<string, PlayerState> = {};
        for (const id of playerIds) {
            players[id] = {
                id, vp: 0, rubies: 0, droplet: 0, flaskFull: true,
                bag: [], pot: [], aside: [], ratTails: 0, origin: 0,
                stopped: false, exploded: false, potFull: false, shielded: false,
                shieldSize: 0, shieldUsed: 0, doubleNext: false, whiteReturned: false,
                canFlask: false, intent: null, prompts: [],
                stage: null, fieldScored: false, takeVp: false, takeShop: false, coins: 0,
                rolled: [], notes: [], lastReach: 0, rubyDone: false,
                overflow: [], lastOverflow: false, reserve: [], carry: null,
                pennies: { silver: true, bronze: true, gold: true },
                saved: false, cheap: false, extraShops: [], bought: [], boomAt: null,
                patient: null, essence: 0, essenceReach: 0, extraRats: 0, pendingDraw: 0, hand: [], neighbourUsed: false
            };
        }
        return {
            phase: Phase.Setup, round: 0, bookSets: normalizeBookSets(null), stirAlways: false,
            playerOrder: [...playerIds], startIndex: 0, players, supply,
            fortuneDeck: [], fortune: null, fortuneNotes: [],
            winnerIds: null, lastMove: null, moveCounter: 0,
            expansion: false, witches: null, alch: false, patients: [], guestWitch: null
        };
    }

    public static from_data(data: GameStateData, playerIds: string[]): QuacksGameState {
        const gs = new QuacksGameState(playerIds);
        gs.data = data;
        return gs;
    }

    public get_data(): GameStateData { return this.data; }
    public set_rng(rng: () => number): void { this.rng = rng; }

    // ---- read-only accessors ---------------------------------------------

    public get_phase(): Phase { return this.data.phase; }
    public get_round(): number { return this.data.round; }
    public get_book_sets(): BookSets { return { ...this.data.bookSets }; }
    /** The set number when all books share one, else 0 for a custom mix. */
    public get_set(): number { return presetOf(this.data.bookSets, this.data.expansion, this.data.alch) || 0; }
    public expansion(): boolean { return !!this.data.expansion; }
    /** The three witches in this game, by metal (empty without the expansion). */
    public witches(): Witch[] {
        const w = this.data.witches;
        return w ? METALS.map(m => WITCH_BY_ID[w[m]]).filter(x => !!x) : [];
    }
    /** The witch behind a penny; `guest` is the free visitor from "A Witch Visits". */
    private witchFor(metal: string): Witch | null {
        if (metal === 'guest') return this.data.guestWitch ? WITCH_BY_ID[this.data.guestWitch] || null : null;
        return this.data.witches ? WITCH_BY_ID[this.data.witches[metal]] || null : null;
    }
    private hasWitch(p: PlayerState, witchId: string): boolean {
        return this.pennyFor(p, witchId) !== null;
    }
    /** Which penny would call this witch: the free guest first, then her metal's penny. */
    private pennyFor(p: PlayerState, witchId: string): string | null {
        const w = WITCH_BY_ID[witchId];
        const d = this.data;
        if (!w || !d.expansion) return null;
        if (d.guestWitch === witchId && p.pennies.guest) return 'guest';
        if (d.witches && d.witches[w.metal] === witchId && p.pennies[w.metal]) return w.metal;
        return null;
    }
    private spendWitch(p: PlayerState, witchId: string): void {
        const penny = this.pennyFor(p, witchId);
        if (penny) p.pennies[penny] = false;
    }
    public alchemists(): boolean { return !!this.data.alch; }
    public patients(): Patient[] { return this.data.patients.map(id => PATIENT_BY_ID[id]).filter(x => !!x); }
    public guest_witch(): Witch | null { return this.data.guestWitch ? WITCH_BY_ID[this.data.guestWitch] : null; }
    private patientOf(p: PlayerState): Patient | null { return p.patient ? PATIENT_BY_ID[p.patient] || null : null; }
    private treats(p: PlayerState, id: string): boolean { return this.data.alch && p.patient === id; }
    /** An explosion that still counts after witches are taken into account. */
    private boomed(p: PlayerState): boolean { return p.exploded && !p.saved; }
    public get_player_order(): string[] { return [...this.data.playerOrder]; }
    public get_player(id: string): PlayerState | undefined { return this.data.players[id]; }
    public get_supply(): Record<Chip, number> { return this.data.supply; }
    public get_fortune(): string | null { return this.data.fortune; }
    public get_fortune_notes(): string[] { return this.data.fortuneNotes; }
    public get_winners(): string[] | null { return this.data.winnerIds; }
    public get_last_move(): LastMove | null { return this.data.lastMove; }
    public start_player(): string { return this.data.playerOrder[this.data.startIndex]; }
    public is_final_round(): boolean { return this.data.round >= ROUNDS; }
    /** Lock-step "Stir!" drawing: mandatory in the final round, optional before. */
    public lockstep(): boolean { return this.data.stirAlways || this.is_final_round(); }

    /** Start player first, then clockwise. */
    public turn_order(): string[] {
        const o = this.data.playerOrder;
        return o.map((_, i) => o[(this.data.startIndex + i) % o.length]);
    }

    public book(color: ChipColor): Book | null {
        return getBook(color, this.data.bookSets, this.data.playerOrder.length, this.data.expansion, this.data.alch);
    }
    private effect(color: ChipColor): string {
        const b = this.book(color);
        return b ? b.effect : 'NONE';
    }
    public revealed(): ChipColor[] { return revealedColors(this.data.round).filter(c => !!this.book(c)); }

    /** Cherry bombs count wherever they are: in the pot, the overflow bowl, or held by a toadstool. */
    public white_sum(id: string): number {
        const p = this.P(id);
        const w = (c: Chip) => (chipColor(c) === 'white' ? chipValue(c) : 0);
        return p.pot.reduce((n, c) => n + w(c.chip), 0)
            + p.overflow.reduce((n, c) => n + w(c), 0)
            + p.reserve.reduce((n, c) => n + w(c), 0);
    }

    public threshold(id: string): number {
        let t = BASE_THRESHOLD;
        if (this.data.fortune === 'living_in_luxury') t = 9;
        if (this.effect('yellow') === 'YELLOW_RAISE_THRESHOLD') {
            const n = this.count(this.P(id), 'yellow');
            if (n >= 3) t = Math.max(t, 9);
            else if (n >= 1) t = Math.max(t, 8);
        }
        return t;
    }

    public last_pos(id: string): number {
        const p = this.P(id);
        return p.pot.length ? p.pot[p.pot.length - 1].pos : p.origin;
    }

    /** The space directly after the last chip — the spoon once the pot is full. */
    public scoring_field(id: string): Field {
        const p = this.P(id);
        return fieldAt(p.potFull ? SPOON_FIELD : this.last_pos(id) + 1);
    }

    public max_buy(): number { return this.data.fortune === 'shop_spree' ? 3 : 2; }

    /** Everything on sale this round, cheapest book first. */
    public shop_offers(): ShopOffer[] {
        const offers: ShopOffer[] = [];
        for (const color of this.revealed()) {
            const b = this.book(color);
            if (!b) continue;
            Object.keys(b.costs).forEach((v) => {
                const chip = makeChip(color, Number(v));
                offers.push({ chip, cost: b.costs[Number(v)], left: this.data.supply[chip] || 0 });
            });
        }
        return offers;
    }

    /** Whether a player still owes the table something right now. */
    public needs_action(id: string): boolean {
        const p = this.P(id);
        if (this.data.phase === Phase.Brew && !p.stopped && p.reserve.length && !p.prompts.length) return true;
        if (p.prompts.length) return true;
        if (this.data.phase === Phase.Essence) return false;
        if (this.data.phase === Phase.Brew) return !p.stopped && p.intent === null;
        if (this.data.phase === Phase.Eval) return p.stage !== 'ready';
        return false;
    }

    // ---- lifecycle --------------------------------------------------------

    public start_game(opts: StartOptions = {}): void {
        const n = this.playerIds.length;
        const expansion = !!opts.herbWitches;
        const alch = !!opts.alchemists;
        if (n < MIN_PLAYERS || n > maxPlayers(expansion)) {
            throw new Error(`Quacks needs ${MIN_PLAYERS} to ${maxPlayers(expansion)} players.`);
        }
        if (opts.seed !== undefined) this.rng = mulberry32(opts.seed);
        this.data = QuacksGameState.create_initial_state(this.playerIds);
        const d = this.data;
        d.expansion = expansion;
        d.alch = alch;
        d.bookSets = normalizeBookSets(opts.bookSets, opts.setNumber || 1, expansion, alch);
        if (alch) {
            (Object.keys(ALCHEMIST_SUPPLY) as ChipColor[]).forEach((color) => {
                const extra = ALCHEMIST_SUPPLY[color] || {};
                Object.keys(extra).forEach((v) => {
                    const chip = makeChip(color, Number(v));
                    d.supply[chip] = (d.supply[chip] || 0) + extra[Number(v)];
                });
            });
            d.patients = this.shuffle(PATIENTS.map(x => x.id)).slice(0, PATIENTS_DEALT);
        }
        if (expansion) {
            (Object.keys(EXPANSION_SUPPLY) as ChipColor[]).forEach((color) => {
                const extra = EXPANSION_SUPPLY[color] || {};
                Object.keys(extra).forEach((v) => {
                    const chip = makeChip(color, Number(v));
                    d.supply[chip] = (d.supply[chip] || 0) + extra[Number(v)];
                });
            });
            d.witches = {};
            for (const metal of METALS) {
                const pool = WITCHES.filter(w => w.metal === metal);
                d.witches[metal] = pool[Math.floor(this.rng() * pool.length)].id;
            }
        }
        d.stirAlways = !!opts.stirAlways;
        d.startIndex = Math.floor(this.rng() * n);
        d.fortuneDeck = this.shuffle(fortuneDeckFor(expansion, alch).map(c => c.id));
        for (const id of d.playerOrder) {
            for (const chip of STARTING_BAG) this.addChip(d.players[id], chip);
        }
        this.startRound();
    }

    private startRound(): void {
        const d = this.data;
        d.round += 1;
        d.fortuneNotes = [];
        for (const p of this.all()) {
            p.pot = [];
            p.ratTails = 0;
            p.stopped = false; p.exploded = false; p.potFull = false; p.shielded = false;
            p.shieldSize = 0; p.shieldUsed = 0; p.doubleNext = false; p.whiteReturned = false;
            p.canFlask = false; p.intent = null; p.prompts = [];
            p.stage = null; p.fieldScored = false; p.takeVp = false; p.takeShop = false; p.coins = 0;
            p.rolled = []; p.notes = []; p.rubyDone = false;
            p.overflow = []; p.lastOverflow = false; p.reserve = []; p.saved = false; p.cheap = false;
            p.extraShops = []; p.bought = []; p.boomAt = null;
            p.hand = []; p.neighbourUsed = false; p.pennies.guest = false;
            if (d.round === EXTRA_WHITE_ROUND) this.addChip(p, 'white1');
        }

        d.fortune = d.fortuneDeck.shift() || null;

        // Rats: everyone behind the leader gets a head start.
        if (d.round >= 2) {
            const lead = Math.max(...this.all().map(p => p.vp));
            for (const p of this.all()) {
                p.ratTails = ratTailsBetween(p.vp, lead) * (d.fortune === 'rat_infestation' ? 2 : 1);
            }
        }
        // rat tails earned in last round's essence phase
        for (const p of this.all()) { p.ratTails += p.extraRats; p.extraRats = 0; }

        // A Witch Visits: one undealt witch everyone may call once, free, this round
        d.guestWitch = null;
        if (d.fortune === 'witch_visit' && d.expansion && d.witches) {
            const dealt = Object.keys(d.witches).map(m => d.witches![m]);
            const pool = WITCHES.filter(w => dealt.indexOf(w.id) === -1);
            if (pool.length) {
                d.guestWitch = pool[Math.floor(this.rng() * pool.length)].id;
                this.all().forEach(p => { p.pennies.guest = true; });
            }
        }

        d.phase = Phase.Fortune;
        if (d.fortune) {
            this.say(null, `Round ${d.round}: ${FORTUNE_BY_ID[d.fortune].name}`, 'info');
            this.applyFortuneNow(d.fortune);
        }
        // the Alchemists' first decision: which patient to treat
        if (d.alch && d.round === 1) {
            for (const p of this.all()) {
                p.prompts.unshift({
                    kind: 'patient', title: 'Choose your patient',
                    text: 'Each patient needs a different essence. Several players may treat the same one.',
                    held: [], data: { ids: [...d.patients] },
                    options: this.patients().map(x => ({ id: `pat:${x.id}`, label: x.name }))
                });
            }
        }
        this.settle();
    }

    private beginBrew(): void {
        for (const p of this.all()) p.origin = Math.min(LAST_FIELD - 1, p.droplet + p.ratTails);
        this.data.phase = Phase.Brew;
        // The Startles: draw and hold chips; cherry bombs go straight back
        for (const p of this.all()) {
            if (!p.pendingDraw) continue;
            const drawn = this.takeFromBag(p, p.pendingDraw);
            p.pendingDraw = 0;
            drawn.filter(c => chipColor(c) === 'white').forEach(c => p.bag.push(c));
            p.hand = drawn.filter(c => chipColor(c) !== 'white');
            p.notes.push(`The Startles: holding ${p.hand.length ? p.hand.map(chipLabel).join(', ') : 'nothing'}`);
        }
        // a chip kept by a garden spider (green, set 5) opens the new round, power and all
        for (const p of this.all()) {
            if (!p.carry) continue;
            const chip = p.carry;
            p.carry = null;
            p.notes.push(`Kept from last round: ${chipLabel(chip)} laid first`);
            this.layChip(p, chip, true);
        }
    }

    // ---- player actions ---------------------------------------------------

    public draw(id: string): void {
        const p = this.brewing(id);
        if (this.lockstep()) p.intent = 'draw';
        else this.drawChip(p);
        this.settle();
    }

    public stop(id: string): void {
        const p = this.brewing(id);
        if (this.lockstep()) p.intent = 'stop';
        else this.finishBrew(p, true);
        this.settle();
    }

    /** Put the chip just laid back in the bag. Once per round, never after an explosion. */
    public use_flask(id: string): void {
        const p = this.brewing(id);
        if (!p.flaskFull) throw new Error('Your flask is empty');
        if (!p.canFlask || (!p.pot.length && !p.overflow.length)) throw new Error('There is no fresh chip to put back');
        const last = p.lastOverflow && p.overflow.length ? { chip: p.overflow.pop()! } : p.pot.pop()!;
        p.lastOverflow = false;
        p.bag.push(last.chip);
        p.flaskFull = false;
        p.canFlask = false;
        p.notes.push(`Flask: ${chipLabel(last.chip)} went back in the bag`);
        this.settle();
    }

    /** Lay a chip a toadstool (red, set 6) is holding. */
    public lay_reserve(id: string, index: number): void {
        const p = this.brewing(id);
        if (!(index >= 0 && index < p.reserve.length)) throw new Error('No such held chip');
        const chip = p.reserve.splice(index, 1)[0];
        this.layChip(p, chip, true);
        p.canFlask = false;
        this.settle();
    }

    /** The Startles: lay a held chip instead of drawing one. */
    public lay_hand(id: string, index: number): void {
        const p = this.brewing(id);
        if (p.exploded) throw new Error('Your pot has exploded');
        if (!(index >= 0 && index < p.hand.length)) throw new Error('No such held chip');
        const chip = p.hand.splice(index, 1)[0];
        this.handleDrawn(p, chip);
        this.settle();
    }

    /** Forgetfulness: spend essence equal to a pot chip's value to put it back in the bag. */
    public forget(id: string, index: number): void {
        const p = this.brewing(id);
        if (!this.treats(p, 'forgetful')) throw new Error('Only Forgetfulness can do that');
        const slot = p.pot[index];
        if (!slot || ['white', 'herb'].indexOf(chipColor(slot.chip)) !== -1) throw new Error('That chip cannot go back');
        if (chipValue(slot.chip) > p.essence) throw new Error('Not enough essence');
        p.essence -= chipValue(slot.chip);
        p.pot.splice(index, 1);
        p.bag.push(slot.chip);
        p.canFlask = false;
        p.notes.push(`Forgetfulness: ${chipLabel(slot.chip)} back in the bag`);
        this.settle();
    }

    /** Fortune "Good Neighbours": bag a cherry bomb 3; the left neighbour takes 2 rubies. */
    public neighbour_bomb(id: string): void {
        const p = this.brewing(id);
        if (this.data.fortune !== 'good_neighbour' || p.neighbourUsed || p.exploded) throw new Error('Not possible now');
        const at = p.pot.map(c => c.chip).indexOf('white3');
        if (at === -1) throw new Error('No cherry bomb 3 in your pot');
        p.pot.splice(at, 1);
        p.bag.push('white3');
        p.neighbourUsed = true;
        p.canFlask = false;
        const left = this.leftOf(p);
        if (left !== p) { left.rubies += 2; left.notes.push('Good Neighbours: +2 rubies'); }
        p.notes.push('Good Neighbours: cherry bomb 3 back in the bag');
        this.settle();
    }

    /** What the player can do with their patient right now, for the UI. */
    public can_forget(id: string): number[] {
        const p = this.P(id);
        if (this.data.phase !== Phase.Brew || p.stopped || p.prompts.length || !this.treats(p, 'forgetful')) return [];
        return p.pot.map((c, k) => k).filter(k => ['white', 'herb'].indexOf(chipColor(p.pot[k].chip)) === -1
            && chipValue(p.pot[k].chip) <= p.essence);
    }

    /** Can this player call the witch of `metal` right now? */
    public witch_usable(id: string, metal: string): boolean {
        const d = this.data;
        const p = this.P(id);
        const w = this.witchFor(metal);
        if (!w || !d.expansion || !p.pennies[metal] || p.prompts.length) return false;
        if (metal !== 'guest' && d.guestWitch === w.id) return false;
        const shopping = d.phase === Phase.Eval && (p.stage === 'shop' || p.stage === 'rubies');
        switch (w.id) {
            case 's_six': return d.phase === Phase.Brew && !p.stopped && p.intent === null && p.bag.length > 0;
            case 's_whites': return d.phase === Phase.Brew && !p.stopped && !p.exploded
                && (p.pot.some(c => chipColor(c.chip) === 'white') || p.overflow.some(c => chipColor(c) === 'white'));
            case 'b_upgrade': return shopping && this.upgradeOptions(p).length > 0;
            case 'b_double': return p.coins > 0 && d.phase === Phase.Eval
                && (p.stage === 'shop' || (this.is_final_round() && p.stage === 'rubies'));
            case 'b_ruby': return p.rubies > 0 && d.phase === Phase.Eval
                && (p.stage === 'shop' || (this.is_final_round() && p.stage === 'rubies'));
            case 'b_copy': return d.phase === Phase.Eval && p.stage === 'rubies'
                && p.bought.some(c => (d.supply[c] || 0) > 0);
            case 'g_colors': case 'g_bag': return shopping;
            case 'g_cheap': return shopping && !this.is_final_round();
            default: return false;   // the others are offered automatically at their moment
        }
    }

    public use_witch(id: string, metal: string): void {
        const p = this.P(id);
        if (!this.witch_usable(id, metal)) throw new Error('You cannot call that witch right now');
        const w = this.witchFor(metal)!;
        const d = this.data;
        p.pennies[metal] = false;
        this.say(id, `called ${w.name}`, 'good');
        switch (w.id) {
            case 's_six': {
                const held = this.takeFromBag(p, 6);
                p.notes.push(`${w.name}: drew ${plural(held.length, 'chip')}`);
                this.pushSorter(p, held);
                break;
            }
            case 's_whites':
                this.pushDefuser(p, 2);
                break;
            case 'b_upgrade':
                p.prompts.push({
                    kind: 'witch_upgrade', title: w.name, text: 'Upgrade your last two pot chips, or any one of them.',
                    held: [], options: this.upgradeOptions(p)
                });
                break;
            case 'b_double':
                p.coins *= 2;
                p.notes.push(`${w.name}: coins doubled to ${p.coins}`);
                break;
            case 'b_ruby':
                p.coins += 2 * p.rubies;
                p.notes.push(`${w.name}: +${2 * p.rubies} coins for your rubies`);
                break;
            case 'b_copy': {
                const chips = p.bought.filter((c, i) => p.bought.indexOf(c) === i && (d.supply[c] || 0) > 0);
                p.prompts.push({
                    kind: 'witch_copy', title: w.name, text: 'Take a second copy of one chip you bought.',
                    held: [], options: chips.map(c => ({ id: `chip:${c}`, label: chipLabel(c), chip: c }))
                });
                break;
            }
            case 'g_colors': {
                const colors = p.pot.filter(c => !c.gone).map(c => chipColor(c.chip)).filter(c => c !== 'white');
                const n = colors.filter((c, i) => colors.indexOf(c) === i).length;
                p.vp += n;
                p.notes.push(`${w.name}: +${plural(n, 'point')} for ${plural(n, 'colour')}`);
                break;
            }
            case 'g_bag': {
                const n = p.bag.filter(c => chipColor(c) !== 'white' && [2, 4, 6].indexOf(chipValue(c)) !== -1).length;
                p.vp += 2 * n;
                p.notes.push(`${w.name}: +${plural(2 * n, 'point')}`);
                break;
            }
            case 'g_cheap':
                p.cheap = true;
                p.notes.push(`${w.name}: droplet and flask cost 1 ruby this round`);
                break;
            default:
                break;
        }
        this.settle();
    }

    public resolve_prompt(id: string, optionId: string): void {
        const p = this.P(id);
        const pr = p.prompts[0];
        if (!pr) throw new Error('Nothing to decide');
        const opt = pr.options.filter(o => o.id === optionId)[0];
        if (!opt) throw new Error('That is not one of the choices');
        p.prompts.shift();
        this.applyPrompt(p, pr, opt);
        this.settle();
    }

    public buy(id: string, chips: Chip[]): void {
        const p = this.P(id);
        if (this.data.phase !== Phase.Eval || p.stage !== 'shop' || p.prompts.length) {
            throw new Error('You cannot shop right now');
        }
        if (chips.length > this.max_buy()) throw new Error(`You may buy at most ${this.max_buy()} chips`);
        const colors = chips.map(chipColor);
        if (colors.some((c, i) => colors.indexOf(c) !== i)) throw new Error('Chips must be of different colours');
        const offers = this.shop_offers();
        let total = 0;
        for (const chip of chips) {
            const offer = offers.filter(o => o.chip === chip)[0];
            if (!offer) throw new Error('That chip is not for sale');
            if (offer.left < 1) throw new Error('That chip has sold out');
            total += offer.cost;
        }
        if (total > p.coins) throw new Error('You cannot afford that');
        for (const chip of chips) this.acquire(p, chip);
        p.bought.push(...chips);
        if (this.data.fortune === 'clearance' && chips.length === 2) {
            const cost = (c: Chip) => offers.filter(o => o.chip === c)[0].cost;
            const cheap = cost(chips[0]) <= cost(chips[1]) ? chips[0] : chips[1];
            if (this.acquire(p, cheap)) p.notes.push(`Clearance Sale: a free ${chipLabel(cheap)}`);
        }
        p.notes.push(chips.length ? `Bought ${chips.map(chipLabel).join(' and ')}` : 'Bought nothing');
        if (p.extraShops.length) {
            p.coins = p.extraShops.shift()!;     // another shopping trip this round
        } else {
            p.coins = 0;
            p.stage = 'rubies';
        }
        this.settle();
    }

    public spend_rubies(id: string, on: 'droplet' | 'flask'): void {
        const p = this.P(id);
        if (this.data.phase !== Phase.Eval || p.stage !== 'rubies') throw new Error('You cannot spend rubies right now');
        const cost = this.ruby_cost(id, on);
        if (on === 'droplet') {
            if (p.rubies < cost) throw new Error('Not enough rubies');
            p.rubies -= cost;
            this.moveDroplet(p, 1);
            p.notes.push(`Paid ${rubyWord(cost)}: droplet +1`);
        } else {
            if (p.flaskFull) throw new Error('Your flask is already full');
            if (p.rubies < cost) throw new Error('Not enough rubies');
            p.rubies -= cost;
            p.flaskFull = true;
            p.notes.push(`Paid ${rubyWord(cost)}: flask refilled`);
        }
        this.settle();
    }

    public ready(id: string): void {
        const p = this.P(id);
        if (this.data.phase !== Phase.Eval || p.stage !== 'rubies') throw new Error('You are not done yet');
        if (this.is_final_round()) this.finalTally(p);
        p.stage = 'ready';
        this.settle();
    }

    public ruby_cost(id: string, on: 'droplet' | 'flask'): number {
        return this.P(id).cheap ? 1 : (on === 'droplet' ? DROPLET_COST : FLASK_COST);
    }

    /** Round 9's last step: coins, rubies and (with the expansion) unspent pennies become points. */
    private finalTally(p: PlayerState): void {
        const fromCoins = Math.floor(p.coins / COINS_PER_VP);
        const fromRubies = Math.floor(p.rubies / RUBIES_PER_VP);
        const pennies = this.data.expansion ? METALS.filter(m => p.pennies[m]).length : 0;
        p.vp += fromCoins + fromRubies + pennies * PENNY_VP;
        p.rubies -= fromRubies * RUBIES_PER_VP;
        if (fromCoins) p.notes.push(`${p.coins} coins became ${plural(fromCoins, 'point')}`);
        if (fromRubies) p.notes.push(`Rubies became ${plural(fromRubies, 'point')}`);
        if (pennies) p.notes.push(`Unspent witch pennies: +${plural(pennies * PENNY_VP, 'point')}`);
        p.coins = 0;
    }

    // ---- brewing ----------------------------------------------------------

    private brewing(id: string): PlayerState {
        const p = this.P(id);
        if (this.data.phase !== Phase.Brew) throw new Error('Nobody is brewing right now');
        if (p.stopped) throw new Error('You have already stopped');
        if (p.prompts.length) throw new Error('Finish your current choice first');
        return p;
    }

    private drawChip(p: PlayerState): void {
        if (!p.bag.length) return;
        this.handleDrawn(p, this.takeFromBag(p, 1)[0]);
    }

    /** A chip has just come into the player's hand — drawn, or a held chip played instead. */
    private handleDrawn(p: PlayerState, chip: Chip): void {
        p.canFlask = false;
        const covered = p.shieldUsed < p.shieldSize;
        if (covered) p.shieldUsed += 1;

        if (this.data.fortune === 'well_stirred' && chipColor(chip) === 'white' && !p.whiteReturned) {
            p.whiteReturned = true;
            p.prompts.push({
                kind: 'well_stirred', title: 'Well Stirred',
                text: 'This is your first cherry bomb of the round. Put it back in the bag?',
                held: [chip], data: { covered },
                options: [{ id: 'back', label: 'Put it back' }, { id: 'keep', label: 'Lay it' }]
            });
            return;
        }

        // Sailing Ears: a cherry bomb that does not blow you up may move double, or go back
        if (this.treats(p, 'sailing') && chipColor(chip) === 'white' && p.essence >= 2
            && this.white_sum(p.id) + chipValue(chip) <= this.threshold(p.id)) {
            p.prompts.push({
                kind: 'sailing', title: 'Sailing Ears', text: `You drew ${chipLabel(chip)}. Spend essence on it?`,
                held: [chip], data: { covered },
                options: [
                    { id: 'double', label: `Spend 2: move it ${2 * chipValue(chip)} spaces` },
                    ...(p.essence >= 3 ? [{ id: 'back', label: 'Spend 3: put it back in the bag' }] : []),
                    { id: 'normal', label: 'Lay it as usual' }
                ]
            });
            return;
        }
        // Turnip Nose: a pumpkin may jump to the next free ruby space
        if (this.treats(p, 'turnip') && chipColor(chip) === 'orange' && p.essence >= 2 && this.nextRubyField(p) !== null) {
            p.prompts.push({
                kind: 'turnip', title: 'Turnip Nose',
                text: `You drew ${chipLabel(chip)}. Spend 2 essence to lay it on space ${this.nextRubyField(p)}, the next ruby space?`,
                held: [chip], data: { covered },
                options: [{ id: 'ruby', label: 'Spend 2: lay it on the ruby space' }, { id: 'normal', label: 'Lay it as usual' }]
            });
            return;
        }
        this.layChip(p, chip, true, covered);
    }

    private nextRubyField(p: PlayerState): number | null {
        for (let i = this.last_pos(p.id) + 1; i <= LAST_FIELD; i++) if (fieldAt(i).ruby) return i;
        return null;
    }

    private leftOf(p: PlayerState): PlayerState {
        const seats = this.data.playerOrder;
        return this.P(seats[(seats.indexOf(p.id) + 1) % seats.length]);
    }

    /**
     * Lay a chip after the last one and fire its on-draw action.
     * `drawn` is false for chips that come from beside the pot (set-aside toadstools).
     * `quiet` lays a chip with no power and no explosion (expansion: fortune-card draws).
     */
    private layChip(p: PlayerState, chip: Chip, drawn: boolean, covered = false, quiet = false,
        opts: { safe?: boolean; at?: number; move?: number } = {}): void {
        const d = this.data;
        const real = chipColor(chip);
        let color = real;
        let value = chipValue(chip);

        // the overflow bowl: once the pot is full, chips only count as cherry bombs
        if (d.expansion && p.potFull) {
            p.overflow.push(chip);
            p.canFlask = drawn;
            p.lastOverflow = true;
            if (!quiet && real === 'white') this.checkBoom(p, covered, 'overflow');
            return;
        }
        p.lastOverflow = false;

        if (drawn && color === 'red' && this.effect('red') === 'RED_SET_ASIDE') {
            p.aside.push(chip);
            p.notes.push(`${chipLabel(chip)} set aside`);
            return;
        }

        const prev = p.pot.length ? p.pot[p.pot.length - 1] : null;

        // fool's herb: no fixed value
        let move = value;
        if (real === 'herb') {
            const fx = this.effect('herb');
            move = 1;
            if (fx === 'HERB_RAT_MOVE') move = Math.min(4, 1 + p.ratTails);
            else if (fx === 'HERB_COLOR_MOVE') {
                const colors = p.pot.filter(c => !c.gone).map(c => chipColor(c.chip)).concat(['herb']).filter(c => c !== 'white');
                move = colors.filter((c, i) => colors.indexOf(c) === i).length;
            } else if (fx === 'HERB_WHITE_MOVE') {
                move = Math.max(1, p.pot.reduce((t, c) => t + (chipColor(c.chip) === 'white' ? chipValue(c.chip) : 0), 0));
            }
            else if (fx === 'HERB_COPY_PREV' && prev && ['white', 'herb'].indexOf(chipColor(prev.chip)) === -1) {
                color = chipColor(prev.chip);
                value = chipValue(prev.chip);
                move = value;
            }
        }

        if (chip === 'white1' && this.effect('red') === 'RED_WHITE1_MOVES_2' && this.count(p, 'red') > 0) move = 2;
        if (opts.move !== undefined) move = opts.move;
        if (p.doubleNext) { move *= 2; p.doubleNext = false; }

        if (color === 'orange' && d.fortune === 'pumpkin_party') move += 1;
        if (color === 'red' && !quiet) {
            if (this.effect('red') === 'RED_ORANGE_BOOST') {
                const oranges = this.count(p, 'orange');
                move += oranges >= 3 ? 2 : oranges >= 1 ? 1 : 0;
            }
            if (this.effect('red') === 'RED_ADD_PREV_WHITE' && prev && chipColor(prev.chip) === 'white') {
                move += chipValue(prev.chip);
            }
            if (this.effect('red') === 'RED_MATCH_BIGGEST') {
                const biggest = Math.max(0, ...p.pot.filter(c => chipColor(c.chip) === 'red').map(c => chipValue(c.chip)));
                move = Math.max(move, biggest);
            }
        }
        if (color === 'yellow' && !quiet) {
            if (this.effect('yellow') === 'YELLOW_ESCALATING_MOVE') {
                const nth = this.count(p, 'yellow') + 1;
                if (nth <= 3) move += nth;
            }
            if (this.effect('yellow') === 'YELLOW_PEEK_ADD' && p.bag.length) {
                const peek = p.bag[Math.floor(this.rng() * p.bag.length)];
                move += chipValue(peek);
                p.notes.push(`Mandrake peeked at ${chipLabel(peek)}: +${chipValue(peek)} spaces`);
            }
        }

        let pos = opts.at !== undefined ? opts.at : this.last_pos(p.id) + move;
        if (pos >= LAST_FIELD) { pos = LAST_FIELD; p.potFull = true; }
        p.pot.push({ chip, pos });
        p.canFlask = drawn;

        // ---- on-draw actions (a full pot forfeits anything that waits for the next chip) ----
        if (!quiet) {
            if (color === 'blue') this.blueAction(p, value, pos);
            if (color === 'yellow') {
                if (this.effect('yellow') === 'YELLOW_DOUBLE_NEXT_MOVE' && !p.potFull) p.doubleNext = true;
                if (this.effect('yellow') === 'YELLOW_RETURN_PREV_WHITE' && prev && chipColor(prev.chip) === 'white') {
                    p.prompts.push({
                        kind: 'yellow_return', title: 'Mandrake',
                        text: `Put the ${chipLabel(prev.chip)} you laid just before back in the bag?`,
                        held: [], data: { chip: prev.chip, pos: prev.pos },
                        options: [{ id: 'yes', label: 'Put it back', chip: prev.chip }, { id: 'no', label: 'Leave it' }]
                    });
                }
                if (this.effect('yellow') === 'YELLOW_PAY_RUBY_MOVE' && p.rubies >= 1 && !p.potFull) {
                    p.prompts.push({
                        kind: 'yellow_pay', title: 'Mandrake', text: 'Pay 1 ruby to move this mandrake 3 more spaces?',
                        held: [], data: { index: p.pot.length - 1 },
                        options: [{ id: 'yes', label: 'Pay 1 ruby: +3 spaces' }, { id: 'no', label: 'Keep my ruby' }]
                    });
                }
            }
            if (real === 'herb' && this.effect('herb') === 'HERB_RETURN_CHIP') {
                const options = p.pot.map((c, k) => ({ c, k })).filter(x => chipColor(x.c.chip) !== 'white' && !x.c.gone)
                    .map(x => ({ id: `ret:${x.k}`, label: `${chipLabel(x.c.chip)} on space ${x.c.pos}`, chip: x.c.chip }));
                if (options.length) {
                    p.prompts.push({
                        kind: 'herb_return', title: 'Locoweed',
                        text: 'Put one coloured chip from your pot back in the bag.', held: [], options
                    });
                }
            }
            if (this.treats(p, 'hunchback') && fieldAt(pos).ruby && p.essence >= 2) {
                p.prompts.push({
                    kind: 'hunchback', title: 'Hunchback',
                    text: `${chipLabel(chip)} landed on a ruby space. Spend 2 essence for ${this.hunchbackLabel(chip)}?`,
                    held: [], data: { chip },
                    options: [{ id: 'yes', label: `Spend 2: ${this.hunchbackLabel(chip)}` }, { id: 'no', label: 'Save my essence' }]
                });
            }
            if (color === 'red' && this.effect('red') === 'RED_RESERVE_NEXT' && p.bag.length && !p.potFull) {
                const held = this.takeFromBag(p, 1)[0];
                p.reserve.push(held);
                p.notes.push(`Toadstool: holding ${chipLabel(held)} to lay later`);
                if (chipColor(held) === 'white') this.checkBoom(p, false, 'reserve');
            }
        }

        if (!quiet && !opts.safe && real === 'white') this.checkBoom(p, covered, 'pot');
        if (p.potFull && !p.stopped && d.phase === Phase.Brew) {
            if (!d.expansion) {
                p.notes.push('The pot is full — you reach the spoon');
                this.say(p.id, 'filled the pot to the brim', 'good');
                this.finishBrew(p, false);
            } else if (p.overflow.length === 0 && !p.notes.some(n => /overflow bowl/.test(n))) {
                p.notes.push('The pot is full — further chips go to the overflow bowl');
                this.say(p.id, 'filled the pot to the brim', 'good');
            }
        }
    }

    /** Hunchback's reward for laying a chip on a ruby space, by its printed value (reconstruction). */
    private hunchbackLabel(chip: Chip): string {
        const v = chipValue(chip);
        if (v === 1) return '1 ruby';
        if (v === 2) return 'droplet +1';
        if (v === 3 || chipColor(chip) === 'white') return '3 points';
        return `a ${INGREDIENT_NAME[chipColor(chip)].toLowerCase()} 1`;
    }

    /** Explode if the cherry bombs are over the limit — unless a silver witch steps in. */
    private checkBoom(p: PlayerState, covered: boolean, where: 'pot' | 'overflow' | 'reserve'): void {
        if (p.exploded || this.white_sum(p.id) <= this.threshold(p.id)) return;
        p.exploded = true;
        p.shielded = covered;
        p.canFlask = false;
        p.boomAt = where;
        p.notes.push(covered ? 'Exploded — but the crow skull shielded you' : 'The pot exploded');
        this.say(p.id, 'exploded!', 'boom');

        const flaskWitch = this.hasWitch(p, 's_flask') && p.flaskFull;
        const bonusWitch = this.hasWitch(p, 's_bonus');
        if (!p.stopped && (flaskWitch || bonusWitch)) {
            const w = WITCH_BY_ID[flaskWitch ? 's_flask' : 's_bonus'];
            p.prompts.push({
                kind: 'witch_boom', title: w.name, data: { witch: w.id },
                text: flaskWitch
                    ? 'Your pot exploded. Spend your silver penny to flask the chip that blew it up?'
                    : 'Your pot exploded. Spend your silver penny to score as if it had not?',
                held: [], options: [{ id: 'call', label: `Call ${w.name}` }, { id: 'no', label: 'Accept the explosion' }]
            });
            return;
        }
        this.finishBrew(p, false);
    }

    private blueAction(p: PlayerState, value: number, pos: number): void {
        const fx = this.effect('blue');
        if (fx === 'BLUE_PEEK_PICK' && p.bag.length && !p.potFull) {
            const held = this.takeFromBag(p, value);
            p.prompts.push({
                kind: 'pick', title: 'Crow Skull',
                text: `You drew ${plural(held.length, 'chip')}. Lay one of them next, or put them all back.`,
                held,
                options: [
                    ...held.map((c, i) => ({ id: `pick:${i}`, label: chipLabel(c), chip: c })),
                    { id: 'none', label: 'Put them all back' }
                ]
            });
        } else if (fx === 'BLUE_EXPLOSION_SHIELD') {
            // Shields overlap, they never add: a new skull can only widen the
            // window that is already running, counted from the skull that opened it.
            if (p.shieldUsed >= p.shieldSize) { p.shieldSize = value; p.shieldUsed = 0; }
            else p.shieldSize = Math.max(p.shieldSize, value);
        } else if (fx === 'BLUE_RUBY_FIELD_RUBY' && fieldAt(pos).ruby) {
            p.rubies += 1;
            p.notes.push('Crow skull on a ruby space: +1 ruby');
        } else if (fx === 'BLUE_RUBY_FIELD_VP' && fieldAt(pos).ruby) {
            p.vp += value;
            p.notes.push(`Crow skull on a ruby space: +${plural(value, 'point')}`);
        } else if (fx === 'BLUE_ORANGE_VP' && this.count(p, 'orange') >= value) {
            p.vp += value;
            p.notes.push(`Crow skull: ${plural(this.count(p, 'orange'), 'pumpkin')} in the pot — +${plural(value, 'point')}`);
        } else if (fx === 'BLUE_WHITE_RUBY') {
            const back = p.pot.slice(Math.max(0, p.pot.length - 1 - value), p.pot.length - 1);
            const n = back.filter(c => chipColor(c.chip) === 'white').length;
            if (n) { p.rubies += n; p.notes.push(`Crow skull: +${rubyWord(n)} for cherry bombs behind it`); }
        }
    }

    public shield_left(id: string): number {
        const p = this.P(id);
        return Math.max(0, p.shieldSize - p.shieldUsed);
    }

    private finishBrew(p: PlayerState, voluntary: boolean): void {
        if (p.stopped) return;
        p.stopped = true;
        p.intent = null;
        p.canFlask = false;
        if (voluntary) this.say(p.id, 'stopped brewing', 'info');
        p.hand.forEach(c => p.bag.push(c));
        p.hand = [];

        if (this.data.fortune === 'white_blessing') {
            const last = p.pot[p.pot.length - 1];
            if (last && chipColor(last.chip) === 'white') {
                p.vp += chipValue(last.chip);
                p.notes.push(`The White Blessing: +${plural(chipValue(last.chip), 'point')}`);
            }
        }
        if (this.data.fortune === 'good_to_better') {
            const options = p.pot.map((c, k) => ({ c, k }))
                .filter(x => [2, 4].indexOf(chipValue(x.c.chip)) !== -1 && chipColor(x.c.chip) !== 'white' && this.betterChoices(x.c.chip).length)
                .map(x => ({ id: `i:${x.k}`, label: `${chipLabel(x.c.chip)} on space ${x.c.pos}`, chip: x.c.chip }));
            if (options.length) {
                p.prompts.push({
                    kind: 'better_pick', title: 'Good Gets Better', text: 'Swap a 2- or 4-chip in your pot for another colour?',
                    held: [], options: [...options, { id: 'none', label: 'Keep my pot as it is' }]
                });
            }
        }

        // a held chip (red, set 6) must be laid this round, explosion or not
        for (const chip of [...p.reserve]) {
            p.prompts.push({
                kind: 'reserve', title: 'Held chip',
                text: `Your toadstool is still holding ${chipLabel(chip)}. It must be laid this round.`,
                held: [], data: { chip }, options: [{ id: 'lay', label: 'Lay it now', chip }]
            });
        }
        for (const chip of [...p.aside]) {
            p.prompts.push({
                kind: 'aside', title: 'Set-aside toadstool',
                text: `Your ${chipLabel(chip)} is waiting beside the pot.`,
                held: [], data: { chip },
                options: [
                    { id: 'lay', label: 'Lay it now', chip },
                    { id: 'keep', label: 'Keep it aside' },
                    { id: 'bag', label: 'Back in the bag' }
                ]
            });
        }
        if (this.data.fortune === 'strong_ingredient' && !p.exploded && !p.potFull && p.bag.length) {
            const held = this.takeFromBag(p, 5);
            p.prompts.push({
                kind: 'pick', title: 'Strong Ingredient', data: { quiet: this.data.expansion },
                text: `You stopped safely and drew ${plural(held.length, 'chip')}. Lay one of them, or put them all back.`,
                held,
                options: [
                    ...held.map((c, i) => ({ id: `pick:${i}`, label: chipLabel(c), chip: c })),
                    { id: 'none', label: 'Put them all back' }
                ]
            });
        }
    }

    // ---- prompts ----------------------------------------------------------

    private applyPrompt(p: PlayerState, pr: Prompt, opt: PromptOption): void {
        const id = opt.id;
        // Several prompts simply hand over the chip named by the option.
        const grant = (note: string) => {
            if (id.indexOf('chip:') === 0) {
                const chip = id.slice(5);
                if (this.acquire(p, chip)) p.notes.push(`${note}: ${chipLabel(chip)}`);
            }
        };

        switch (pr.kind) {
            case 'well_stirred':
                if (id === 'back') { p.bag.push(pr.held[0]); p.notes.push('Well Stirred: cherry bomb returned'); }
                else this.layChip(p, pr.held[0], true, pr.data.covered);
                break;

            case 'pick': {
                const i = id === 'none' ? -1 : Number(id.split(':')[1]);
                pr.held.forEach((c, j) => { if (j !== i) p.bag.push(c); });
                if (i >= 0) this.layChip(p, pr.held[i], true, false, !!(pr.data && pr.data.quiet));
                break;
            }

            case 'reserve': {
                const at = p.reserve.indexOf(pr.data.chip);
                if (at !== -1) { p.reserve.splice(at, 1); this.layChip(p, pr.data.chip, true); }
                break;
            }

            case 'yellow_pay': {
                const slot = p.pot[pr.data.index];
                if (id === 'yes' && slot && p.rubies >= 1) {
                    p.rubies -= 1;
                    slot.pos = Math.min(LAST_FIELD, slot.pos + 3);
                    if (slot.pos >= LAST_FIELD) p.potFull = true;
                    p.notes.push('Mandrake: paid 1 ruby, +3 spaces');
                }
                break;
            }

            // ---- the Alchemists ----
            case 'patient': {
                const x = PATIENT_BY_ID[id.slice(4)];
                if (!x) break;
                p.patient = x.id;
                x.start.forEach(c => this.addChip(p, c));
                p.notes.push(`Treating ${x.name}${x.start.length ? ` \u2014 +${x.start.map(chipLabel).join(', ')}` : ''}`);
                break;
            }
            case 'essence': this.applyEssence(p, Number(id.split(':')[1])); break;
            case 'sailing': {
                const chip = pr.held[0];
                if (id === 'double') { p.essence -= 2; this.layChip(p, chip, true, pr.data.covered, false, { move: 2 * chipValue(chip) }); }
                else if (id === 'back') { p.essence -= 3; p.bag.push(chip); p.notes.push(`Sailing Ears: ${chipLabel(chip)} back in the bag`); }
                else this.layChip(p, chip, true, pr.data.covered);
                break;
            }
            case 'turnip': {
                const chip = pr.held[0];
                const at = this.nextRubyField(p);
                if (id === 'ruby' && at !== null) { p.essence -= 2; this.layChip(p, chip, true, pr.data.covered, false, { at }); }
                else this.layChip(p, chip, true, pr.data.covered);
                break;
            }
            case 'hunchback': {
                if (id !== 'yes' || p.essence < 2) break;
                p.essence -= 2;
                const chip: Chip = pr.data.chip;
                const v = chipValue(chip);
                if (v === 1) p.rubies += 1;
                else if (v === 2) this.moveDroplet(p, 1);
                else if (v === 3 || chipColor(chip) === 'white') p.vp += 3;
                else this.acquire(p, makeChip(chipColor(chip), 1));
                p.notes.push(`Hunchback: ${this.hunchbackLabel(chip)}`);
                break;
            }
            case 'herb_return': {
                const slot = p.pot[Number(id.split(':')[1])];
                if (slot && chipColor(slot.chip) !== 'white') {
                    p.pot.splice(p.pot.indexOf(slot), 1);
                    p.bag.push(slot.chip);
                    p.canFlask = false;
                    p.notes.push(`Locoweed: ${chipLabel(slot.chip)} back in the bag`);
                }
                break;
            }
            case 'chicken_up': {
                if (id === 'none') break;
                const slot = p.pot[Number(id.split(':')[1])];
                const to = slot ? makeChip(chipColor(slot.chip), pr.data.to) : null;
                if (slot && to && this.addChip(p, to)) {
                    slot.gone = true;
                    this.data.supply[slot.chip] += 1;
                    p.notes.push(`Chicken Eyes: ${chipLabel(slot.chip)} became ${chipLabel(to)}`);
                }
                break;
            }
            case 'free_chip': {
                // a chip from the supply, paid for by whatever the fortune card asked
                if (id.indexOf('chip:') !== 0) break;
                const pay = (pr.data && pr.data.pay) || {};
                if ((pay.rubies || 0) > p.rubies || (pay.rats || 0) > p.ratTails || (pay.droplet || 0) > p.droplet) break;
                if (pay.penny && !p.pennies[pay.penny]) break;
                if (!this.acquire(p, id.slice(5))) break;
                p.rubies -= pay.rubies || 0;
                p.ratTails -= pay.rats || 0;
                p.droplet -= pay.droplet || 0;
                if (pay.penny) p.pennies[pay.penny] = false;
                p.notes.push(`${pr.title}: ${chipLabel(id.slice(5))}`);
                break;
            }
            case 'fortune_pay': {
                // step one of a two-step fortune card: choose what to pay, then pick the chip
                if (id === 'skip') break;
                const choice = pr.data.choices[id];
                const chips = this.supplyChips(choice.value, choice.exclude || []);
                if (!chips.length) break;
                p.prompts.unshift({
                    kind: 'free_chip', title: pr.title, text: `Choose your ${choice.value === 0 ? '' : `${choice.value}-`}chip.`,
                    held: [], data: { pay: choice.pay },
                    options: chips.map(c => ({ id: `chip:${c}`, label: chipLabel(c), chip: c }))
                });
                break;
            }
            case 'rat_honour': {
                const k = Math.min(Number(id.split(':')[1]) || 0, p.rubies);
                p.rubies -= k;
                p.ratTails += 3 * k;
                if (k) p.notes.push(`A Rat in Honour: +${3 * k} rat tails`);
                break;
            }
            case 'neighbour_need': {
                const left = this.leftOf(p);
                if (id === 'white') {
                    if (this.removeFromBag(left, 'white1')) {
                        this.data.supply['white1'] += 1;
                        left.notes.push('Neighbour in Need: a cherry bomb 1 thrown away');
                    }
                } else {
                    const chips = this.supplyChips(1, ['white']);
                    if (chips.length) {
                        left.prompts.push({
                            kind: 'free_chip', title: 'Neighbour in Need', text: 'Your right neighbour lets you take any 1-chip.',
                            held: [], data: {}, options: chips.map(c => ({ id: `chip:${c}`, label: chipLabel(c), chip: c }))
                        });
                    }
                }
                break;
            }
            case 'rich_gifts':
                if (id === 'rats') { p.ratTails += 8; p.notes.push('Rich Gifts: +8 rat tails'); }
                else if (id === 'roll') { for (let k = 0; k < 4; k++) this.rollDie(p, 'Rich Gifts'); }
                else { this.moveDroplet(p, 3); p.notes.push('Rich Gifts: droplet +3'); }
                break;
            case 'who_chooses':
                if (id === 'pack') {
                    p.rubies += 1;
                    p.ratTails += 3;
                    p.notes.push('Whoever Has the Choice: +1 ruby, +3 rat tails');
                    this.rollDie(p, 'Whoever Has the Choice');
                } else grant('Whoever Has the Choice');
                break;
            case 'essential':
                if (id === 'refill') { p.flaskFull = true; p.notes.push('Essential Essence: flask refilled'); }
                else this.rollDie(p, 'Essential Essence');
                break;
            case 'reunion':
                if (id !== 'none') { p.pennies[id] = true; p.notes.push(`Happy Reunion: your ${id} penny is back`); }
                break;
            case 'better_pick': {
                if (id === 'none') break;
                const k = Number(id.split(':')[1]);
                const slot = p.pot[k];
                if (!slot) break;
                p.prompts.unshift({
                    kind: 'better_to', title: 'Good Gets Better', text: `Swap ${chipLabel(slot.chip)} for which colour?`,
                    held: [], data: { k },
                    options: [
                        ...this.betterChoices(slot.chip).map(c => ({ id: `chip:${c}`, label: chipLabel(c), chip: c })),
                        { id: 'none', label: 'Never mind' }
                    ]
                });
                break;
            }
            case 'better_to': {
                const slot = p.pot[pr.data.k];
                if (id === 'none' || !slot) break;
                const to = id.slice(5);
                if (!(this.data.supply[to] > 0)) break;
                this.data.supply[to] -= 1;
                this.data.supply[slot.chip] += 1;
                p.notes.push(`Good Gets Better: ${chipLabel(slot.chip)} became ${chipLabel(to)}`);
                slot.chip = to;
                break;
            }
            case 'vampire': grant('Vampirism'); break;

            // ---- herb witches ----
            case 'witch_boom': {
                const w = WITCH_BY_ID[(pr.data && pr.data.witch) || 's_flask'];
                if (id !== 'call') { this.finishBrew(p, false); break; }
                this.spendWitch(p, w.id);
                if (w.id === 's_flask' && p.flaskFull) {
                    const from = p.boomAt === 'overflow' ? p.overflow : p.boomAt === 'reserve' ? p.reserve : null;
                    const chip = from ? from.pop()! : p.pot.pop()!.chip;
                    p.bag.push(chip);
                    p.flaskFull = false;
                    p.exploded = false;
                    p.shielded = false;
                    p.notes.push(`${w.name}: flasked ${chipLabel(chip)} — keep brewing`);
                    this.say(p.id, `called ${w.name} and kept brewing`, 'good');
                } else {
                    p.saved = true;
                    p.notes.push(`${w.name}: this explosion scores as if it had not happened`);
                    this.say(p.id, `called ${w.name}`, 'good');
                    this.finishBrew(p, false);
                }
                break;
            }
            case 'witch_six': {
                if (id === 'done') { pr.held.forEach(c => p.bag.push(c)); break; }
                const i = Number(id.split(':')[1]);
                const rest = pr.held.filter((_, j) => j !== i);
                this.layChip(p, pr.held[i], true);
                if (p.stopped || p.exploded || !rest.length) rest.forEach(c => p.bag.push(c));
                else this.pushSorter(p, rest);
                break;
            }
            case 'witch_whites': {
                if (id === 'done') break;
                let chip: Chip | null = null;
                if (id.indexOf('o:') === 0) {
                    // a cherry bomb from the overflow bowl
                    const k = Number(id.split(':')[1]);
                    if (p.overflow[k] && chipColor(p.overflow[k]) === 'white') chip = p.overflow.splice(k, 1)[0];
                    if (chip && !p.overflow.length) p.lastOverflow = false;
                } else {
                    const pos = Number(id.split(':')[1]);
                    const at = p.pot.map((c, k) => (chipColor(c.chip) === 'white' && c.pos === pos ? k : -1)).filter(k => k >= 0)[0];
                    if (at !== undefined) chip = p.pot.splice(at, 1)[0].chip;
                }
                if (chip) {
                    p.bag.push(chip);
                    p.canFlask = false;
                    p.notes.push(`${WITCH_BY_ID.s_whites.name}: ${chipLabel(chip)} back in the bag`);
                }
                if (pr.data.left > 1) this.pushDefuser(p, pr.data.left - 1);
                break;
            }
            case 'witch_upgrade': {
                const targets = id === 'last2'
                    ? p.pot.slice(-2).map((_, k, arr) => p.pot.length - arr.length + k)
                    : [Number(id.split(':')[1])];
                for (const k of targets) {
                    const slot = p.pot[k];
                    if (!slot || !this.upgradable(slot)) continue;
                    const to = makeChip(chipColor(slot.chip), UPGRADE[chipValue(slot.chip)]);
                    if (this.addChip(p, to)) {
                        slot.gone = true;
                        this.data.supply[slot.chip] += 1;
                        p.notes.push(`${WITCH_BY_ID.b_upgrade.name}: ${chipLabel(slot.chip)} became ${chipLabel(to)}`);
                    }
                }
                break;
            }
            case 'witch_copy': grant(WITCH_BY_ID.b_copy.name); break;
            case 'witch_miner': {
                const field = this.scoring_field(p.id);
                if (id === 'call') {
                    this.spendWitch(p, 'g_rubies');
                    p.rubies += field.vp;
                    p.notes.push(`${WITCH_BY_ID.g_rubies.name}: +${rubyWord(field.vp)}`);
                } else {
                    p.rubies += pr.data.normal;
                    p.notes.push(`Scoring space: +${rubyWord(pr.data.normal)}`);
                }
                break;
            }
            case 'green_carry': {
                if (id === 'none') break;
                const slot = p.pot[Number(id.split(':')[1])];
                if (slot && !slot.gone) {
                    slot.gone = true;
                    p.carry = slot.chip;
                    p.notes.push(`Garden spider: keeping ${chipLabel(slot.chip)} to open next round`);
                }
                break;
            }

            case 'yellow_return':
                if (id === 'yes') {
                    const at = p.pot.map((c, i) => (c.chip === pr.data.chip && c.pos === pr.data.pos ? i : -1))
                        .filter(i => i >= 0)[0];
                    if (at !== undefined) {
                        p.pot.splice(at, 1);
                        p.bag.push(pr.data.chip);
                        p.notes.push(`Mandrake: ${chipLabel(pr.data.chip)} returned`);
                    }
                }
                break;

            case 'aside': {
                const at = p.aside.indexOf(pr.data.chip);
                if (at === -1 || id === 'keep') break;
                p.aside.splice(at, 1);
                if (id === 'bag') p.bag.push(pr.data.chip);
                else this.layChip(p, pr.data.chip, false);
                break;
            }

            // ---- fortune cards ----
            case 'just_in_time':
                if (id === 'vp') { p.vp += 4; p.notes.push('Just in Time: +4 points'); }
                else if (this.removeFromBag(p, 'white1')) {
                    this.data.supply['white1'] += 1;
                    p.notes.push('Just in Time: threw away a cherry bomb 1');
                }
                break;
            case 'choose_wisely':
                if (id === 'droplet') { this.moveDroplet(p, 2); p.notes.push('Choose Wisely: droplet +2'); }
                else grant('Choose Wisely');
                break;
            case 'wheel_and_deal':
                if (id !== 'skip' && p.rubies >= 1) { p.rubies -= 1; grant('Traded 1 ruby'); }
                break;
            case 'rats_friends':
                if (id === 'vp') { p.vp += p.ratTails; p.notes.push(`Rats: +${plural(p.ratTails, 'point')}`); }
                else grant('Rats');
                break;
            case 'opportunistic': {
                const from = id === 'none' ? null : id.slice(3);
                const to = from ? this.nextUp(from) : null;
                let swapped = false;
                for (const c of pr.held) {
                    if (!swapped && to && c === from && this.addChip(p, to)) {
                        this.data.supply[c] += 1;
                        swapped = true;
                        p.notes.push(`Swapped ${chipLabel(c)} for ${chipLabel(to)}`);
                    } else p.bag.push(c);
                }
                break;
            }

            // ---- evaluation ----
            case 'joy': grant('Malicious Joy'); break;
            case 'green2': grant('Garden spider'); break;
            case 'green4': {
                const n = Math.min(Number(id.split(':')[1]), p.rubies);
                if (n > 0) {
                    p.rubies -= n;
                    this.moveDroplet(p, n);
                    p.notes.push(`Garden spider: paid ${rubyWord(n)}, droplet +${n}`);
                }
                break;
            }
            case 'purple1': this.purpleTier(p, Number(id.split(':')[1])); break;
            case 'purple2': this.purpleTrade(p, id === 'none' ? 0 : Number(id.split(':')[1])); break;
            case 'purple4': {
                if (id === 'none') break;
                const from = id.split(':')[2];
                const tier = Number(id.split(':')[1]);
                const to = makeChip(chipColor(from), tier === 1 ? 2 : 4);
                const slot = p.pot.filter(c => c.chip === from && !c.gone)[0];
                if (slot && this.addChip(p, to)) {
                    slot.gone = true;
                    this.data.supply[from] += 1;
                    p.notes.push(`Ghost’s breath: ${chipLabel(from)} became ${chipLabel(to)}`);
                }
                break;
            }
            case 'exploded':
                p.takeVp = id === 'vp';
                p.takeShop = id === 'shop';
                break;
            default:
                break;
        }
    }

    // ---- fortune cards ----------------------------------------------------

    private applyFortuneNow(cardId: string): void {
        const d = this.data;
        const order = this.turn_order().map(id => d.players[id]);
        const revealed = this.revealed();
        const inStock = (chip: Chip) => (d.supply[chip] || 0) > 0;
        const chipOpt = (chip: Chip): PromptOption => ({ id: `chip:${chip}`, label: chipLabel(chip), chip });

        switch (cardId) {
            case 'pot_fills':
                order.forEach(p => this.moveDroplet(p, 1));
                d.fortuneNotes.push('Every droplet moved 1 space.');
                break;
            case 'beginners_bonus': {
                const low = Math.min(...order.map(p => p.rubies));
                order.filter(p => p.rubies === low).forEach(p => { p.rubies += 1; p.notes.push('Beginner’s Bonus: +1 ruby'); });
                break;
            }
            case 'ruby_rain':
                order.forEach(p => { p.rubies += 1; });
                d.fortuneNotes.push('Everyone took 1 ruby.');
                break;
            case 'fresh_flasks':
                order.forEach(p => {
                    if (p.flaskFull) { p.vp += 1; p.notes.push('Fresh Flasks: +1 point'); }
                    else { p.flaskFull = true; p.notes.push('Fresh Flasks: flask refilled'); }
                });
                break;
            case 'donations':
                order.forEach(p => this.rollDie(p, 'Donations'));
                break;
            case 'less_is_more': {
                const sums = order.map(p => {
                    const pool = [...p.bag];
                    let sum = 0;
                    for (let i = 0; i < 5 && pool.length; i++) {
                        sum += chipValue(pool.splice(Math.floor(this.rng() * pool.length), 1)[0]);
                    }
                    return sum;
                });
                const low = Math.min(...sums);
                order.forEach((p, i) => {
                    if (sums[i] === low) {
                        const got = this.addChip(p, 'blue2');
                        p.notes.push(`Less is More: drew ${sums[i]}, the lowest${got ? ' — took a blue 2' : ''}`);
                    } else {
                        p.rubies += 1;
                        p.notes.push(`Less is More: drew ${sums[i]} — +1 ruby`);
                    }
                });
                break;
            }
            case 'just_in_time':
                order.forEach(p => p.prompts.push({
                    kind: 'just_in_time', title: 'Just in Time', text: FORTUNE_BY_ID[cardId].text, held: [],
                    options: [
                        { id: 'vp', label: 'Score 4 points' },
                        ...(p.bag.indexOf('white1') !== -1 ? [{ id: 'white', label: 'Throw away a cherry bomb 1', chip: 'white1' }] : [])
                    ]
                }));
                break;
            case 'choose_wisely':
                order.forEach(p => {
                    if (revealed.indexOf('purple') === -1 || !inStock('purple1')) {
                        this.moveDroplet(p, 2);
                        p.notes.push('Choose Wisely: droplet +2');
                        return;
                    }
                    p.prompts.push({
                        kind: 'choose_wisely', title: 'Choose Wisely', text: FORTUNE_BY_ID[cardId].text, held: [],
                        options: [{ id: 'droplet', label: 'Droplet +2' }, chipOpt('purple1')]
                    });
                });
                break;
            case 'wheel_and_deal':
                order.forEach(p => {
                    if (p.rubies < 1) return;
                    const chips = revealed.filter(c => c !== 'purple' && c !== 'black')
                        .map(c => makeChip(c, 1)).filter(inStock);
                    p.prompts.push({
                        kind: 'wheel_and_deal', title: 'Wheel and Deal', text: FORTUNE_BY_ID[cardId].text, held: [],
                        options: [...chips.map(chipOpt), { id: 'skip', label: 'Keep my ruby' }]
                    });
                });
                break;
            case 'rats_friends':
                order.forEach(p => {
                    const chips = revealed.map(c => makeChip(c, 4)).filter(inStock);
                    p.prompts.push({
                        kind: 'rats_friends', title: 'Rats Are Your Friends', text: FORTUNE_BY_ID[cardId].text, held: [],
                        options: [...chips.map(chipOpt), { id: 'vp', label: `Score ${plural(p.ratTails, 'point')}` }]
                    });
                });
                break;
            // ---- The Alchemists box ----
            case 'give_take':
                order.forEach((p) => {
                    const c: any = {};
                    [1, 2, 4].filter(v => p.rubies >= v).forEach((v) => {
                        c[`v${v}`] = { label: `Pay ${rubyWord(v)} for a ${v}-chip`, value: v, pay: { rubies: v }, exclude: ['purple'] };
                    });
                    this.payPrompt(p, 'Give and Take', FORTUNE_BY_ID[cardId].text, c);
                });
                break;
            case 'rat_honour':
                order.forEach((p) => {
                    if (p.rubies < 1) return;
                    const options: PromptOption[] = [];
                    for (let k = Math.min(3, p.rubies); k >= 1; k--) options.push({ id: `pay:${k}`, label: `Pay ${rubyWord(k)}: +${3 * k} rat tails` });
                    options.push({ id: 'pay:0', label: 'Keep my rubies' });
                    p.prompts.push({ kind: 'rat_honour', title: 'A Rat in Honour', text: FORTUNE_BY_ID[cardId].text, held: [], options });
                });
                break;
            case 'neighbour_need':
                order.forEach((p) => {
                    const left = this.leftOf(p);
                    if (left === p) return;
                    p.prompts.push({
                        kind: 'neighbour_need', title: 'Neighbour in Need', text: 'Choose a gift for the player on your left.', held: [],
                        options: [
                            ...(left.bag.indexOf('white1') !== -1 ? [{ id: 'white', label: 'They throw away a cherry bomb 1', chip: 'white1' }] : []),
                            { id: 'chip', label: 'They take any 1-chip' }
                        ]
                    });
                });
                break;
            case 'rich_gifts':
                order.forEach(p => p.prompts.push({
                    kind: 'rich_gifts', title: 'Rich Gifts', text: FORTUNE_BY_ID[cardId].text, held: [],
                    options: [{ id: 'rats', label: '+8 rat tails this round' }, { id: 'roll', label: 'Roll the bonus die 4 times' }, { id: 'drop', label: 'Droplet +3' }]
                }));
                break;
            case 'swap_frenzy':
                order.forEach((p) => {
                    const c: any = {};
                    METALS.filter(m => p.pennies[m]).forEach((m) => {
                        c[m] = { label: `Spend your ${m} penny`, value: 0, pay: { penny: m } };
                    });
                    this.payPrompt(p, 'Swap Frenzy', FORTUNE_BY_ID[cardId].text, c);
                });
                break;
            case 'small_donation':
                order.filter(p => p.ratTails >= 2).forEach(p => this.rollDie(p, 'A Small Donation'));
                break;
            case 'strong_drop':
                order.forEach((p) => {
                    const c: any = {};
                    if (p.droplet >= 2) c.d2 = { label: 'Droplet back 2: a 2-chip', value: 2, pay: { droplet: 2 } };
                    if (p.droplet >= 4) c.d4 = { label: 'Droplet back 4: a 4-chip', value: 4, pay: { droplet: 4 } };
                    this.payPrompt(p, 'A Strong Drop', FORTUNE_BY_ID[cardId].text, c);
                });
                break;
            case 'useful_rodent':
                order.forEach((p) => {
                    const c: any = {};
                    [[2, 1], [4, 2], [6, 4]].filter(([k]) => p.ratTails >= k).forEach(([k, v]) => {
                        c[`r${k}`] = { label: `Give up ${k} rat tails: a ${v}-chip`, value: v, pay: { rats: k }, exclude: ['purple'] };
                    });
                    this.payPrompt(p, 'A Useful Rodent', FORTUNE_BY_ID[cardId].text, c);
                });
                break;
            case 'ruby_fever':
                order.forEach((p) => {
                    if (!p.bag.length) return;
                    const c = p.bag[Math.floor(this.rng() * p.bag.length)];
                    p.rubies += chipValue(c);
                    p.notes.push(`Ruby Fever: drew ${chipLabel(c)} \u2014 +${rubyWord(chipValue(c))}`);
                });
                break;
            case 'who_chooses':
                order.forEach(p => p.prompts.push({
                    kind: 'who_chooses', title: 'Whoever Has the Choice', text: FORTUNE_BY_ID[cardId].text, held: [],
                    options: [
                        { id: 'pack', label: '1 ruby, 3 rat tails and a bonus-die roll' },
                        ...(inStock('red2') ? [chipOpt('red2')] : [])
                    ]
                }));
                break;
            case 'opportunistic':
                order.forEach(p => {
                    const held = this.takeFromBag(p, 4);
                    const ups = held.filter((c, i) => held.indexOf(c) === i && this.nextUp(c));
                    if (!ups.length) {
                        held.forEach(c => p.bag.push(c));
                        if (this.addChip(p, 'green1')) p.notes.push('Opportune Moment: nothing to swap — took a green 1');
                        return;
                    }
                    p.prompts.push({
                        kind: 'opportunistic', title: 'An Opportune Moment',
                        text: 'You drew these chips. Swap one for the next value up, or keep them as they are.',
                        held,
                        options: [
                            ...ups.map(c => ({ id: `up:${c}`, label: `${chipLabel(c)} → ${chipValue(this.nextUp(c)!)}`, chip: this.nextUp(c)! })),
                            { id: 'none', label: 'Keep them all' }
                        ]
                    });
                });
                break;
            default:
                break;
        }
    }

    /** Every chip of a value the supply still has, from the colours in play (value 0 = any). */
    private supplyChips(value: number, exclude: string[]): Chip[] {
        const out: Chip[] = [];
        for (const color of this.revealed()) {
            if (exclude.indexOf(color) !== -1 || color === 'white') continue;
            for (const v of chipValues(color, this.data.expansion)) {
                const c = makeChip(color, v);
                if ((value === 0 || v === value) && (this.data.supply[c] || 0) > 0) out.push(c);
            }
        }
        return out;
    }

    /** Good Gets Better: same-value chips of other colours. */
    private betterChoices(chip: Chip): Chip[] {
        return this.supplyChips(chipValue(chip), [chipColor(chip), 'orange', 'herb']);
    }

    /** A two-step fortune card: pay something, then choose a chip. */
    private payPrompt(p: PlayerState, title: string, text: string, choices: Record<string, { label: string; value: number; pay: any; exclude?: string[] }>): void {
        const ids = Object.keys(choices).filter(k => this.supplyChips(choices[k].value, choices[k].exclude || []).length);
        if (!ids.length) return;
        p.prompts.push({
            kind: 'fortune_pay', title, text, held: [], data: { choices },
            options: [...ids.map(k => ({ id: k, label: choices[k].label })), { id: 'skip', label: 'No thanks' }]
        });
    }

    /** The next value up in a chip's colour, if the supply still has one. */
    private nextUp(chip: Chip): Chip | null {
        const color = chipColor(chip);
        if (color === 'orange' || color === 'herb') return null;   // pumpkins and herbs never upgrade
        const values = chipValues(color, this.data.expansion);
        const next = values.filter(v => v > chipValue(chip))[0];
        if (next === undefined) return null;
        const up = makeChip(color, next);
        return (this.data.supply[up] || 0) > 0 ? up : null;
    }

    // ---- evaluation -------------------------------------------------------

    private evaluate(): void {
        const d = this.data;
        d.phase = Phase.Eval;
        const order = this.turn_order().map(id => d.players[id]);

        // A — bonus die
        const safe = order.filter(p => !this.boomed(p));
        let rollers: PlayerState[] = [];
        if (safe.length) {
            const rank = (p: PlayerState) => this.scoring_field(p.id).coins * 100 + this.scoring_field(p.id).index;
            const best = Math.max(...safe.map(rank));
            rollers = safe.filter(p => rank(p) === best || p.potFull);
        }
        if (d.fortune === 'full_moon') rollers = safe;
        for (const p of rollers) {
            this.rollDie(p, 'Bonus die');
            if (d.fortune === 'magic_potion') this.rollDie(p, 'Bonus die');
        }

        // fortune cards that look at the whole table first
        if (d.fortune === 'essential_essence' && d.alch) {
            const top = Math.max(...order.map(p => p.essence));
            order.filter(p => p.essence === top).forEach(p => p.prompts.push({
                kind: 'essential', title: 'Essential Essence', text: 'Your essence is the highest this round.', held: [],
                options: [{ id: 'roll', label: 'Roll the bonus die' }, ...(p.flaskFull ? [] : [{ id: 'refill', label: 'Refill your flask' }])]
            }));
        }
        if (d.fortune === 'reunion' && d.expansion) {
            order.forEach((p) => {
                const spent = METALS.filter(m => !p.pennies[m]);
                if (!spent.length) return;
                p.prompts.push({
                    kind: 'reunion', title: 'Happy Reunion', text: 'Take back one spent witch penny.', held: [],
                    options: spent.map(m => ({ id: m, label: `My ${m} penny` }))
                });
            });
        }

        // B — chip actions: black, then green, then purple
        if (this.effect('black') === 'BLACK_GIFT_LEFT') this.blackGift();
        else order.forEach(p => this.blackAction(p));
        order.forEach(p => this.greenAction(p));
        order.forEach(p => this.purpleAction(p));

        if (d.fortune === 'malicious_joy') {
            const seats = d.playerOrder;
            order.filter(p => this.boomed(p)).forEach((p) => {
                const left = d.players[seats[(seats.indexOf(p.id) + 1) % seats.length]];
                const chips = this.revealed().map(c => makeChip(c, 2)).filter(c => (d.supply[c] || 0) > 0);
                if (!chips.length || left.id === p.id) return;
                left.prompts.push({
                    kind: 'joy', title: 'Malicious Joy', text: 'A pot exploded on your right. Take any one 2-chip.', held: [],
                    options: chips.map(c => ({ id: `chip:${c}`, label: chipLabel(c), chip: c }))
                });
            });
        }

        for (const p of order) {
            p.stage = 'actions';
            p.lastReach = p.potFull ? SPOON_FIELD : this.last_pos(p.id);
        }
    }

    // ---- the essence phase (The Alchemists) -------------------------------

    /** How far this round's potion pushes the essence marker. */
    public essence_reach(id: string): number {
        const p = this.P(id);
        const d = this.data;
        const colors = p.pot.filter(c => !c.gone).map(c => chipColor(c.chip)).filter(c => c !== 'white');
        let n = colors.filter((c, i) => colors.indexOf(c) === i).length;
        if (this.white_sum(id) === 7) n += 1;
        const seats = d.playerOrder;
        const i = seats.indexOf(id);
        const neighbours = seats.length === 2
            ? [seats[(i + 1) % 2]]
            : [seats[(i + 1) % seats.length], seats[(i + seats.length - 1) % seats.length]];
        n += neighbours.filter(x => this.P(x).exploded).length;
        if (this.effect('herb') === 'HERB_ESSENCE_PLUS') n += this.count(p, 'herb');
        if (d.fortune === 'all_good' && p.pot.length) n += chipValue(p.pot[p.pot.length - 1].chip);
        if (d.fortune === 'luck_misfortune' && p.exploded) n += 2;
        return Math.min(ESSENCE_MAX, n);
    }

    private essencePhase(): void {
        const d = this.data;
        d.phase = Phase.Essence;
        for (const id of this.turn_order()) {
            const p = d.players[id];
            const reach = this.essence_reach(id);
            p.essenceReach = reach;
            const patient = this.patientOf(p);
            if (this.is_final_round() || !patient) {
                // the last essence is worth a point per space instead of its glasses
                p.essence = 0;
                if (this.is_final_round() && reach) { p.vp += reach; p.notes.push(`Final essence: +${plural(reach, 'point')}`); }
                continue;
            }
            // Picking a lower glass can be worth it for patients whose glasses differ; power
            // patients only ever want the most essence.
            const lower = Object.keys(patient.track).map(Number).filter(f => f < reach).sort((a, b) => b - a);
            if (patient.kind === 'power' || !lower.length) { this.applyEssence(p, reach); continue; }
            p.prompts.push({
                kind: 'essence', title: patient.name,
                text: `Your essence reached ${reach}. Take that glass, or settle on a lower one.`,
                held: [], data: { reach },
                options: [reach, ...lower].map(f => ({ id: `f:${f}`, label: `Field ${f}: ${glassLabel(patient.track[f])}` }))
            });
        }
    }

    /** Set the essence marker and take whatever its glass gives. */
    private applyEssence(p: PlayerState, field: number): void {
        const patient = this.patientOf(p);
        p.essence = field;
        if (!patient) return;
        const g: Glass | undefined = patient.track[field];
        p.notes.push(`Essence ${field}${g ? `: ${glassLabel(g)}` : ''}`);
        if (!g) return;
        if (g.vp) p.vp += g.vp;
        if (g.rat) p.extraRats += g.rat;
        if (g.draw) p.pendingDraw = g.draw;
        if (g.earworm) {
            for (let k = 0; k < g.earworm && p.bag.length; k++) {
                this.layChip(p, this.takeFromBag(p, 1)[0], true, false, false, { safe: true });
            }
            p.canFlask = false;
        }
        if (g.coins) {
            const offers = this.shop_offers().filter(o => o.cost <= g.coins! && o.left > 0);
            if (offers.length) {
                p.prompts.push({
                    kind: 'vampire', title: 'Vampirism', text: `Buy one chip for up to ${g.coins} coins.`, held: [],
                    options: [...offers.map(o => ({ id: `chip:${o.chip}`, label: `${chipLabel(o.chip)} (${o.cost})`, chip: o.chip })),
                        { id: 'none', label: 'Buy nothing' }]
                });
            }
        }
        if (g.bonus) this.chickenBonus(p, g.bonus);
    }

    private chickenBonus(p: PlayerState, bonus: string): void {
        switch (bonus) {
            case 'ruby1': p.rubies += 1; break;
            case 'ruby3': p.rubies += 3; break;
            case 'pumpkin': this.acquire(p, 'orange1'); break;
            case 'red1': this.acquire(p, 'red1'); break;
            case 'refill': p.flaskFull = true; break;
            case 'drop2': this.moveDroplet(p, 2); break;
            case 'roll2': case 'roll4':
                for (let k = 0; k < (bonus === 'roll2' ? 2 : 4); k++) this.rollDie(p, 'Chicken Eyes');
                break;
            case 'up12': case 'up14': {
                const to = bonus === 'up12' ? 2 : 4;
                const seen: Chip[] = [];
                const options: PromptOption[] = [];
                p.pot.forEach((c, k) => {
                    const color = chipColor(c.chip);
                    const up = makeChip(color, to);
                    if (c.gone || chipValue(c.chip) !== 1 || ['orange', 'herb'].indexOf(color) !== -1 || seen.indexOf(c.chip) !== -1) return;
                    if (!(this.data.supply[up] > 0)) return;
                    seen.push(c.chip);
                    options.push({ id: `up:${k}`, label: `${chipLabel(c.chip)} \u2192 ${to}`, chip: up });
                });
                if (options.length) {
                    p.prompts.push({
                        kind: 'chicken_up', title: 'Chicken Eyes', text: CHICKEN_BONUS[bonus] + '.', held: [], data: { to },
                        options: [...options, { id: 'none', label: 'No swap' }]
                    });
                }
                break;
            }
            default: break;
        }
    }

    private rollDie(p: PlayerState, why: string): void {
        const face = DIE_FACES[Math.floor(this.rng() * DIE_FACES.length)];
        p.rolled.push(face);
        if (face === 'vp1') p.vp += 1;
        else if (face === 'vp2') p.vp += 2;
        else if (face === 'ruby') p.rubies += 1;
        else if (face === 'droplet') this.moveDroplet(p, 1);
        else this.addChip(p, 'orange1');
        p.notes.push(`${why}: ${DIE_FACE_LABEL[face]}`);
    }

    /** Hawkmoth, set 5: rubies for the moths you gave away, and a race for the furthest moth. */
    private blackGift(): void {
        const seats = this.data.playerOrder;
        const n = seats.length;
        seats.forEach((id, i) => {
            const p = this.P(id);
            const left = this.P(seats[(i + 1) % n]);
            if (left.id === p.id) return;
            const moths = left.pot.filter(c => chipColor(c.chip) === 'black');
            if (!moths.length) return;
            p.rubies += moths.length;
            p.notes.push(`Hawkmoth: +${rubyWord(moths.length)} for the moths in your left neighbour\u2019s pot`);
            const late = left.pot.slice(-2).filter(c => chipColor(c.chip) === 'black').length;
            if (late) { left.rubies += late; left.notes.push(`Hawkmoth: +${rubyWord(late)} — a moth is one of your last two chips`); }
        });
        const moths: Array<{ p: PlayerState; pos: number }> = [];
        this.all().forEach(p => p.pot.forEach(c => { if (chipColor(c.chip) === 'black') moths.push({ p, pos: c.pos }); }));
        const places = moths.map(m => m.pos).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => b - a);
        moths.filter(m => m.pos === places[0]).forEach(m => { this.moveDroplet(m.p, 1); m.p.notes.push('Hawkmoth: the furthest moth — droplet +1'); });
        if (places.length > 1) {
            moths.filter(m => m.pos === places[1]).forEach(m => { m.p.rubies += 1; m.p.notes.push('Hawkmoth: the second furthest moth — +1 ruby'); });
        }
    }

    private upgradable(slot: PotChip): boolean {
        const color = chipColor(slot.chip);
        const to = UPGRADE[chipValue(slot.chip)];
        return !slot.gone && color !== 'orange' && color !== 'herb' && !!to
            && (this.data.supply[makeChip(color, to)] || 0) > 0;
    }

    private upgradeOptions(p: PlayerState): PromptOption[] {
        const options: PromptOption[] = [];
        const lastTwo = p.pot.slice(-2);
        if (lastTwo.some(c => this.upgradable(c))) {
            options.push({ id: 'last2', label: `Last two: ${lastTwo.map(c => chipLabel(c.chip)).join(' and ')}` });
        }
        const seen: Chip[] = [];
        p.pot.forEach((c, k) => {
            if (!this.upgradable(c) || seen.indexOf(c.chip) !== -1) return;
            seen.push(c.chip);
            const to = makeChip(chipColor(c.chip), UPGRADE[chipValue(c.chip)]);
            options.push({ id: `one:${k}`, label: `${chipLabel(c.chip)} \u2192 ${chipValue(to)}`, chip: to });
        });
        return options;
    }

    private pushSorter(p: PlayerState, held: Chip[]): void {
        p.prompts.push({
            kind: 'witch_six', title: WITCH_BY_ID.s_six.name,
            text: 'Lay these chips one at a time, in any order. Stop whenever you like; the rest go back.',
            held,
            options: [
                ...held.map((c, i) => ({ id: `lay:${i}`, label: `Lay ${chipLabel(c)}`, chip: c })),
                { id: 'done', label: 'Put the rest back' }
            ]
        });
    }

    private pushDefuser(p: PlayerState, left: number): void {
        const whites = p.pot.filter(c => chipColor(c.chip) === 'white');
        const bowl = p.overflow.map((c, k) => ({ c, k })).filter(x => chipColor(x.c) === 'white');
        if (!whites.length && !bowl.length) return;
        p.prompts.push({
            kind: 'witch_whites', title: WITCH_BY_ID.s_whites.name,
            text: `Choose a cherry bomb to put back in the bag (${left} left).`,
            held: [], data: { left },
            options: [
                ...whites.map(c => ({ id: `w:${c.pos}`, label: `${chipLabel(c.chip)} on space ${c.pos}`, chip: c.chip })),
                ...bowl.map(x => ({ id: `o:${x.k}`, label: `${chipLabel(x.c)} in the overflow bowl`, chip: x.c })),
                { id: 'done', label: 'Done' }
            ]
        });
    }

    /** Gain a chip from the supply. A set-5 hawkmoth flies to your left neighbour instead. */
    private acquire(p: PlayerState, chip: Chip): boolean {
        if (chipColor(chip) === 'black' && this.effect('black') === 'BLACK_GIFT_LEFT') {
            const seats = this.data.playerOrder;
            const left = this.P(seats[(seats.indexOf(p.id) + 1) % seats.length]);
            if (!this.addChip(left, chip)) return false;
            this.moveDroplet(p, 1);
            p.notes.push('Hawkmoth flew to your left neighbour — droplet +1');
            if (left.id !== p.id) left.notes.push('A hawkmoth flew into your bag');
            return true;
        }
        return this.addChip(p, chip);
    }

    private blackAction(p: PlayerState): void {
        const mine = this.count(p, 'black');
        if (mine === 0) return;
        const seats = this.data.playerOrder;
        const i = seats.indexOf(p.id);
        const n = seats.length;
        const others = n === 2
            ? [seats[(i + 1) % n]]
            : [seats[(i + 1) % n], seats[(i + n - 1) % n]];
        const counts = others.map(id => this.count(this.P(id), 'black'));
        const beaten = counts.filter(c => mine > c).length;
        const droplet = n === 2 ? mine >= counts[0] : beaten >= 1;
        const ruby = n === 2 ? mine > counts[0] : beaten >= 2;
        if (droplet) this.moveDroplet(p, 1);
        if (ruby) p.rubies += 1;
        if (droplet) p.notes.push(`Hawkmoth: droplet +1${ruby ? ' and +1 ruby' : ''}`);
    }

    private greenAction(p: PlayerState): void {
        const fx = this.effect('green');
        const greens = p.pot.filter(c => chipColor(c.chip) === 'green');
        if (!greens.length) return;
        const qualifying = p.pot.slice(-2).filter(c => chipColor(c.chip) === 'green');
        const revealed = this.revealed();
        const stock = (c: Chip) => revealed.indexOf(chipColor(c)) !== -1 && (this.data.supply[c] || 0) > 0;

        if (fx === 'GREEN_RUBY_LAST2' && qualifying.length) {
            p.rubies += qualifying.length;
            p.notes.push(`Garden spider: +${rubyWord(qualifying.length)}`);
        } else if (fx === 'GREEN_CHIP_LAST2') {
            for (const g of qualifying) {
                const v = chipValue(g.chip);
                const choices = (v === 1 ? ['orange1'] : v === 2 ? ['blue1', 'red1'] : ['yellow1', 'purple1']).filter(stock);
                if (choices.length === 1) {
                    if (this.addChip(p, choices[0])) p.notes.push(`Garden spider: ${chipLabel(choices[0])}`);
                } else if (choices.length > 1) {
                    p.prompts.push({
                        kind: 'green2', title: 'Garden Spider',
                        text: `Your ${chipLabel(g.chip)} is one of your last two chips. Choose a chip for your bag.`,
                        held: [], options: choices.map(c => ({ id: `chip:${c}`, label: chipLabel(c), chip: c }))
                    });
                }
            }
        } else if (fx === 'GREEN_DOUBLE_IF_WHITE7' && this.white_sum(p.id) === 7 && !p.potFull) {
            const jump = greens.reduce((n, c) => n + chipValue(c.chip), 0);
            const last = p.pot[p.pot.length - 1];
            last.pos += jump;
            if (last.pos >= LAST_FIELD) { last.pos = LAST_FIELD; p.potFull = true; }
            p.notes.push(`Garden spider: cherry bombs total exactly 7 — last chip leaps ${plural(jump, 'space')}`);
        } else if (fx === 'GREEN_CARRY_CHIP' && qualifying.length && !this.is_final_round()) {
            const max = Math.max(...qualifying.map(c => chipValue(c.chip)));
            const seen: Chip[] = [];
            const options: PromptOption[] = [];
            p.pot.forEach((c, k) => {
                if (c.gone || chipValue(c.chip) > max || seen.indexOf(c.chip) !== -1) return;
                seen.push(c.chip);
                options.push({ id: `carry:${k}`, label: `Keep ${chipLabel(c.chip)}`, chip: c.chip });
            });
            options.push({ id: 'none', label: 'Keep nothing' });
            p.prompts.push({
                kind: 'green_carry', title: 'Garden Spider',
                text: `Keep one pot chip worth up to ${max}. It opens next round as your first chip.`,
                held: [], options
            });
        } else if (fx === 'GREEN_ROLL_DIE' && qualifying.length) {
            for (let k = 0; k < qualifying.length; k++) {
                this.rollDie(p, 'Garden spider');
                if (this.data.fortune === 'magic_potion') this.rollDie(p, 'Garden spider');
            }
        } else if (fx === 'GREEN_PAY_RUBY_DROPLET' && qualifying.length && !this.is_final_round()) {
            const max = qualifying.length;
            const options: PromptOption[] = [];
            for (let n = max; n >= 1; n--) options.push({ id: `pay:${n}`, label: `Pay ${n} — droplet +${n}` });
            options.push({ id: 'pay:0', label: 'Pay nothing' });
            p.prompts.push({
                kind: 'green4', title: 'Garden Spider',
                text: 'Pay 1 ruby per qualifying spider to move your droplet 1 space each.',
                held: [], options
            });
        }
    }

    private purpleAction(p: PlayerState): void {
        const fx = this.effect('purple');
        const n = this.count(p, 'purple');
        if (n === 0) return;

        if (fx === 'PURPLE_COUNT_TIERS') {
            if (n < 3) { this.purpleTier(p, n); return; }
            p.prompts.push({
                kind: 'purple1', title: 'Ghost’s Breath', text: `You have ${n} purple chips. Take one reward.`, held: [],
                options: [
                    { id: 'tier:3', label: '2 points and droplet +1' },
                    { id: 'tier:2', label: '1 point and 1 ruby' }
                ]
            });
        } else if (fx === 'PURPLE_DISCARD_TRADE') {
            const labels = [
                '', 'Trade 1: black chip, 1 point, 1 ruby',
                'Trade 2: green 1, blue 2, 3 points, droplet +1',
                'Trade 3: yellow 4, 6 points, 1 ruby, droplet +2'
            ];
            const options: PromptOption[] = [];
            for (let k = Math.min(3, n); k >= 1; k--) options.push({ id: `trade:${k}`, label: labels[k] });
            options.push({ id: 'none', label: 'Keep my purple chips' });
            p.prompts.push({
                kind: 'purple2', title: 'Ghost’s Breath',
                text: 'Hand purple chips back for a reward. Traded chips leave your bag for good.',
                held: [], options
            });
        } else if (fx === 'PURPLE_POSITION_VP') {
            const vp = p.pot.filter(c => chipColor(c.chip) === 'purple')
                .reduce((sum, c) => sum + Math.min(3, Math.floor(c.pos / 10)), 0);
            if (vp > 0) { p.vp += vp; p.notes.push(`Ghost’s breath: +${plural(vp, 'point')}`); }
        } else if (fx === 'PURPLE_EXTRA_SHOP') {
            const sum = p.pot.filter(c => chipColor(c.chip) === 'purple').reduce((t, c) => t + fieldAt(c.pos).vp, 0);
            if (sum <= 0) return;
            if (this.is_final_round()) {
                const vp = Math.floor(sum / COINS_PER_VP);
                p.vp += vp;
                p.notes.push(`Ghost\u2019s breath: ${sum} coins became ${plural(vp, 'point')}`);
            } else {
                p.extraShops.push(sum);
                p.notes.push(`Ghost\u2019s breath: a second shopping trip with ${sum} coins`);
            }
        } else if (fx === 'PURPLE_NEXT_CHIP_VP') {
            let vp = 0;
            p.pot.forEach((c, k) => { if (chipColor(c.chip) === 'purple' && p.pot[k + 1]) vp += chipValue(p.pot[k + 1].chip); });
            if (vp > 0) { p.vp += vp; p.notes.push(`Ghost\u2019s breath: +${plural(vp, 'point')}`); }
        } else if (fx === 'PURPLE_UPGRADE_CHIP') {
            const options: PromptOption[] = [];
            const tiers: Array<[number, number, number]> = [[3, 1, 4], [2, 2, 4], [1, 1, 2]];
            for (const [tier, from, to] of tiers) {
                if (n < tier) continue;
                const seen: Chip[] = [];
                for (const c of p.pot) {
                    const up = makeChip(chipColor(c.chip), to);
                    if (chipValue(c.chip) !== from || seen.indexOf(c.chip) !== -1) continue;
                    if (!(this.data.supply[up] > 0)) continue;
                    seen.push(c.chip);
                    options.push({ id: `up:${tier}:${c.chip}`, label: `${chipLabel(c.chip)} → ${to}`, chip: up });
                }
            }
            if (!options.length) return;
            options.push({ id: 'none', label: 'No upgrade' });
            p.prompts.push({
                kind: 'purple4', title: 'Ghost’s Breath',
                text: 'Swap one chip in your pot for a bigger one. It joins your bag for next round.',
                held: [], options
            });
        }
    }

    private purpleTier(p: PlayerState, tier: number): void {
        if (tier >= 3) { p.vp += 2; this.moveDroplet(p, 1); p.notes.push('Ghost’s breath: +2 points, droplet +1'); }
        else if (tier === 2) { p.vp += 1; p.rubies += 1; p.notes.push('Ghost’s breath: +1 point, +1 ruby'); }
        else { p.vp += 1; p.notes.push('Ghost’s breath: +1 point'); }
    }

    private purpleTrade(p: PlayerState, k: number): void {
        if (k <= 0) return;
        p.pot.filter(c => chipColor(c.chip) === 'purple' && !c.gone).slice(0, k).forEach((c) => {
            c.gone = true;
            this.data.supply[c.chip] += 1;
        });
        if (k === 1) { this.acquire(p, 'black1'); p.vp += 1; p.rubies += 1; }
        else if (k === 2) { this.addChip(p, 'green1'); this.addChip(p, 'blue2'); p.vp += 3; this.moveDroplet(p, 1); }
        else { this.addChip(p, 'yellow4'); p.vp += 6; p.rubies += 1; this.moveDroplet(p, 2); }
        p.notes.push(`Ghost’s breath: traded ${plural(k, 'chip')}`);
    }

    /** Walk one player through C (rubies), D (points) and E (shop) once their prompts are clear. */
    private advanceEval(p: PlayerState): void {
        if (p.prompts.length || p.stage !== 'actions') return;
        const d = this.data;
        const field = this.scoring_field(p.id);
        const final = this.is_final_round();

        // C — a ruby on the scoring space (The Miner may turn it into several)
        if (!p.rubyDone) {
            p.rubyDone = true;
            if (field.ruby) {
                const normal = d.fortune === 'lucky_devil' ? 2 : 1;
                if (this.hasWitch(p, 'g_rubies') && field.vp > normal) {
                    p.prompts.push({
                        kind: 'witch_miner', title: WITCH_BY_ID.g_rubies.name,
                        text: 'Your scoring space shows a ruby. Spend your gold penny for more?',
                        held: [], data: { normal },
                        options: [
                            { id: 'call', label: `Call her: take ${rubyWord(field.vp)}` },
                            { id: 'no', label: `Take ${rubyWord(normal)}` }
                        ]
                    });
                    return;
                }
                p.rubies += normal;
                p.notes.push(`Scoring space: +${rubyWord(normal)}`);
            }
        }

        if (!p.fieldScored) {
            p.fieldScored = true;
            if (d.fortune === 'shining_bright' && this.white_sum(p.id) === 7) {
                this.moveDroplet(p, 1);
                p.notes.push('Shining Extra Bright: droplet +1');
            }
            if (this.boomed(p) && !p.shielded) {
                p.prompts.push({
                    kind: 'exploded', title: 'Your pot exploded',
                    text: 'You only get one of the two rewards this round.', held: [],
                    options: [
                        { id: 'vp', label: `Score ${plural(field.vp, 'point')}` },
                        {
                            id: 'shop',
                            label: final
                                ? `Convert ${field.coins} coins to ${plural(Math.floor(field.coins / COINS_PER_VP), 'point')}`
                                : `Shop with ${field.coins} coins`
                        }
                    ]
                });
                return;
            }
            p.takeVp = true;
            p.takeShop = true;
        }

        if (p.takeVp) {
            let vp = field.vp;
            if (d.fortune === 'steady_hand' && !this.boomed(p)) vp += 2;
            p.vp += vp;
            p.notes.push(`Scoring space: +${plural(vp, 'point')}`);
            if (p.overflow.length) {
                const bonus = Math.floor(p.overflow.reduce((t, c) => t + chipValue(c), 0) / 2);
                if (bonus) { p.vp += bonus; p.notes.push(`Overflow bowl: +${plural(bonus, 'point')}`); }
            }
        }
        p.coins = p.takeShop
            ? field.coins + (d.fortune === 'bargain_day' ? 3 : 0) + (d.fortune === 'rat_blessing' ? 2 * p.ratTails : 0)
            : 0;

        if (final) {
            if (d.expansion) {
                // a last stop so bronze and gold witches can still be called; the tally runs on ready()
                p.stage = 'rubies';
                return;
            }
            this.finalTally(p);
            p.stage = 'ready';
            return;
        }
        const trips = [...(p.takeShop ? [p.coins] : []), ...p.extraShops];
        if (trips.length) {
            p.coins = trips[0];
            p.extraShops = trips.slice(1);
            p.stage = 'shop';
        } else {
            p.stage = 'rubies';
        }
    }

    private endRound(): void {
        const d = this.data;
        for (const p of this.all()) {
            for (const c of p.pot) if (!c.gone) p.bag.push(c.chip);
            p.overflow.forEach(c => p.bag.push(c));
            p.reserve.forEach(c => p.bag.push(c));
            p.hand.forEach(c => p.bag.push(c));
            p.hand = [];
            p.pot = [];
            p.overflow = [];
            p.reserve = [];
        }
        if (d.round >= ROUNDS) {
            const all = this.all();
            const top = Math.max(...all.map(p => p.vp));
            let winners = all.filter(p => p.vp === top);
            const far = Math.max(...winners.map(p => p.lastReach));
            winners = winners.filter(p => p.lastReach === far);
            d.winnerIds = winners.map(p => p.id);
            d.phase = Phase.Done;
            this.say(null, 'The bazaar is over!', 'good');
            return;
        }
        d.startIndex = (d.startIndex + 1) % d.playerOrder.length;
        this.startRound();
    }

    // ---- the settle loop --------------------------------------------------

    /** Advance everything that no longer waits on a player. Called after every action. */
    private settle(): void {
        const d = this.data;
        for (let guard = 0; guard < 200; guard++) {
            const all = this.all();
            const waiting = all.some(p => p.prompts.length > 0);

            if (d.phase === Phase.Fortune) {
                if (waiting) return;
                this.beginBrew();
                continue;
            }

            if (d.phase === Phase.Brew) {
                // an empty bag ends your brewing
                const dry = all.filter(p => !p.stopped && !p.prompts.length && !p.bag.length && !p.reserve.length);
                if (dry.length) { dry.forEach(p => this.finishBrew(p, false)); continue; }

                const active = all.filter(p => !p.stopped);
                if (this.lockstep() && active.length && active.every(p => p.intent !== null && !p.prompts.length)) {
                    for (const id of this.turn_order()) {
                        const p = d.players[id];
                        if (p.stopped) continue;
                        const intent = p.intent;
                        p.intent = null;
                        if (intent === 'stop') this.finishBrew(p, true);
                        else this.drawChip(p);
                    }
                    continue;
                }
                if (active.length || waiting) return;
                if (d.alch) this.essencePhase();
                else this.evaluate();
                continue;
            }

            if (d.phase === Phase.Essence) {
                if (waiting) return;
                this.evaluate();
                continue;
            }

            if (d.phase === Phase.Eval) {
                all.forEach(p => this.advanceEval(p));
                if (all.some(p => p.prompts.length > 0)) return;
                if (!all.every(p => p.stage === 'ready')) return;
                this.endRound();
                continue;
            }
            return;
        }
    }

    // ---- small helpers ----------------------------------------------------

    private P(id: string): PlayerState {
        const p = this.data.players[id];
        if (!p) throw new Error('Unknown player');
        return p;
    }
    private all(): PlayerState[] { return this.data.playerOrder.map(id => this.data.players[id]); }
    private count(p: PlayerState, color: ChipColor): number {
        return p.pot.filter(c => chipColor(c.chip) === color).length;
    }
    private moveDroplet(p: PlayerState, n: number): void {
        p.droplet = Math.min(LAST_FIELD - 1, p.droplet + n);
    }
    /** Move a chip from the supply into a bag; false if the supply has run dry. */
    private addChip(p: PlayerState, chip: Chip): boolean {
        if (!(this.data.supply[chip] > 0)) return false;
        this.data.supply[chip] -= 1;
        p.bag.push(chip);
        return true;
    }
    private removeFromBag(p: PlayerState, chip: Chip): boolean {
        const at = p.bag.indexOf(chip);
        if (at === -1) return false;
        p.bag.splice(at, 1);
        return true;
    }
    /** Draw up to `n` chips uniformly at random, without replacement. */
    private takeFromBag(p: PlayerState, n: number): Chip[] {
        const out: Chip[] = [];
        while (out.length < n && p.bag.length) {
            out.push(p.bag.splice(Math.floor(this.rng() * p.bag.length), 1)[0]);
        }
        return out;
    }
    private shuffle<T>(arr: T[]): T[] {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(this.rng() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }
    private say(playerId: string | null, text: string, tone: LastMove['tone']): void {
        this.data.moveCounter += 1;
        this.data.lastMove = { moveId: this.data.moveCounter, playerId, text, tone };
    }

    /** Every chip a player owns, wherever it currently is. */
    public collection(id: string): Record<Chip, number> {
        const p = this.P(id);
        const out: Record<Chip, number> = {};
        const add = (c: Chip) => { out[c] = (out[c] || 0) + 1; };
        p.bag.forEach(add);
        p.aside.forEach(add);
        p.pot.filter(c => !c.gone).forEach(c => add(c.chip));
        p.overflow.forEach(add);
        p.reserve.forEach(add);
        p.hand.forEach(add);
        if (p.carry) add(p.carry);
        p.prompts.forEach(pr => pr.held.forEach(add));
        return out;
    }
}
