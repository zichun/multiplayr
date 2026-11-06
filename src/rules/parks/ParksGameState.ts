/**
 * ParksGameState.ts — the pure, framework-independent Parks engine.
 *
 * No React / Multiplayr dependencies; JSON-serialisable and rehydrated through
 * `from_data`. The RNG state lives in the data so a restored game continues
 * identically.
 *
 * A turn is a small program. `tasks` is a stack of work still owed, `prompt` is
 * the one decision the engine is waiting on, and `run()` pops tasks until a
 * prompt appears or the stack empties. Every player decision enters through
 * `respond`, so nested effects (River copying a Vista, a Canteen that reserves a
 * Park, Water gained mid-visit) need no special cases.
 */

import {
    Token, Sym, Bag, TOKENS, SYMS, SUPPLY_START, PHOTOS_START, TOKEN_LIMIT, SEASONS_PER_GAME,
    PARK_CARDS, PARK_BY_ID, ParkCard, SiteId, SITES, BASIC_SITES, ADVANCED_SITES,
    CANTEEN_CARDS, CANTEEN_BY_ID, GEAR_CARDS, GEAR_BY_ID, GearCard, SEASON_CARDS, SEASON_BY_ID, SeasonCard,
    YEAR_CARDS, YEAR_BY_ID, YearCard, YearTier, EVENT_CARDS, EVENT_BY_ID, EventOp, EVENT_OP_TEXT, TOKEN_NAME,
    MIN_PLAYERS, MAX_PLAYERS, Need, NIGHTFALL_PARK_CARDS, NIGHTFALL_YEAR_CARDS, NfAction, CAMPSITE_TILES, CAMPSITE_BY_ID,
    CAMPSITE_BOARD_ACTION, campsideFor, yearRatePoints, YEAR_DRAW_COST, GEAR_REFRESH_COST, NIGHTFALL_WILDLIFE,
    NfModules, nfModulesOf, nfAny, NF_ALL,
    WL_GEAR_CARDS, WL_CANTEEN_CARDS, WL_SEASON_CARDS, WL_SITES, WlModules, wlModulesOf, wlAny, CanteenEffect
} from './ParksData';

export enum Phase {
    Year = 'YEAR',
    Play = 'PLAY',
    Over = 'OVER'
}

/** Hiker / Ranger position once off the Sites. Slot 0 is the Trailhead. */
export const END = 99;
export const RANGER = 'RANGER';

export type Area = 'RESERVE' | 'GEAR' | 'VISIT';
export const AREAS: Area[] = ['RESERVE', 'GEAR', 'VISIT'];

/** SNAP: a 1-token Photo (Season of Connecting). */
export type PayPurpose = 'VISTA' | 'LENS' | 'CAMERA' | 'WILD' | 'SNAP';
export type ReserveSource = 0 | 1 | 2 | 'DECK';

export type Prompt =
    | { kind: 'CANTEEN'; playerId: string; free: boolean }
    | { kind: 'SITE_GAIN'; playerId: string; site: SiteId }
    | { kind: 'VISTA'; playerId: string }
    | { kind: 'LOOKOUT'; playerId: string }
    | { kind: 'CANTEEN_CHOICE'; playerId: string }
    | { kind: 'RIVER'; playerId: string }
    | { kind: 'PAY'; playerId: string; count: number; purpose: PayPurpose; optional: boolean }
    | { kind: 'EXCHANGE'; playerId: string; optional: boolean }
    | { kind: 'RESERVE'; playerId: string }
    | { kind: 'VISIT'; playerId: string; extra: boolean }
    | { kind: 'BUY'; playerId: string; discount: number }
    | { kind: 'DISCARD'; playerId: string; count: number }
    // Nightfall
    /** slot 0: a Park's Instant Action, which can be passed up */
    | { kind: 'CAMP'; playerId: string; slot: number }
    | { kind: 'NF_PAY'; playerId: string; action: NfAction; left: number; optional: boolean }
    | { kind: 'NF_SWAP'; playerId: string }
    | { kind: 'NF_GEAR_PICK'; playerId: string; fresh?: boolean }
    | { kind: 'NF_YEAR_RETURN'; playerId: string; drawn: string[] }
    | { kind: 'RANGER_CAMP'; playerId: string; ranger: number; slot: number }
    // Wildlife
    /** Upgraded Shutter: up to `count` freshly gained Wildlife may become Photos. */
    | { kind: 'SHUTTER'; playerId: string; count: number }
    | { kind: 'LAKE'; playerId: string }
    | { kind: 'PARKWAY'; playerId: string }
    | { kind: 'SUMMIT'; playerId: string };

/** Where a Tent can go: the Campsite board's Year slot, or a tile by its index. */
export type CampSpot = 'BOARD' | number;
export interface CampOption { spot: CampSpot; action: NfAction; }

type Task =
    | { t: 'SITE'; site: SiteId; direct: boolean }
    | { t: 'TRIGGERS'; site: SiteId }
    | { t: 'WINDOW'; fresh?: boolean }
    | { t: 'AREA'; area: Area; discount: number }
    | { t: 'PROMPT'; prompt: Prompt }
    | { t: 'PARK_PASS' }
    /** A Campsite's action must be taken; a Park's or Gear's may be passed up. */
    | { t: 'NF_ACTION'; action: NfAction; source: 'CAMP' | 'PARK' | 'GEAR' }
    | { t: 'TURN_END' }
    | { t: 'SEASON_FINISH' }
    /** Runs `task` only if its decision is still possible by the time it comes up. */
    | { t: 'CHECKED'; task: Task };

export interface PlayerState {
    id: string;
    hikers: [number, number];
    campfireLit: boolean;
    tokens: Record<Token, number>;
    photos: number;
    canteens: { id: string; filled: boolean }[];
    gear: string[];
    reserved: string[];
    visited: string[];
    year: string | null;
    yearOptions: string[];
    /** Nightfall: Year cards gained during play, face down until the end. */
    extraYears?: string[];
}

export interface NightfallState {
    /** Which parts are in play. Absent in saves from before parts could be picked: all of them. */
    modules?: NfModules;
    /** camps[i]: a Tent stands on trail[i]. */
    camps: boolean[];
    campsites: { tile: string; taken: boolean }[];
    boardSlots: number;
    boardTaken: number;
    /** Top card last; returned cards go to the front. */
    yearDeck: string[];
}

/** Wildlife expansion: which parts are in, and the Season tokens waiting on Trail End and the Gear. */
export interface WildlifeState {
    modules: WlModules;
    endBonus: Record<Area, Sym | null>;
    /** One per Gear slot, taken with the next card from it. */
    gearBonus: (Sym | null)[];
}

export interface TrailEndState {
    reserve: string[];
    gear: string[];
    visit: string[];
    /** Who took the First Hiker slot this Season. */
    firstSlot: string | null;
    rangerTop: boolean;
    rangerMiddle: boolean;
    rangerBottom: boolean;
    /** Solo: a Ranger is sitting in the Reserve area. */
    reserveBlocked: boolean;
}

export interface SoloState {
    rangers: [number, number];
    tracker: { SUNSHINE: number; WATER: number };
    eventDeck: string[];
    activeEvent: string;
    /** Cost of the Gear that moved the Ranger this turn (decides its Trail End slot). */
    lastCost: number;
}

/** One piece of a Journal row, drawn as a coin, an icon or a tappable mini card. */
export type LogItem =
    | { kind: 'bag'; bag: Bag }
    | { kind: 'site'; site: SiteId }
    | { kind: 'park'; id: string }
    | { kind: 'gear'; id: string }
    | { kind: 'canteen'; id: string; filled: boolean }
    | { kind: 'season'; id: string }
    | { kind: 'event'; id: string; op: EventOp; token: Token }
    | { kind: 'area'; area: Area }
    | { kind: 'icon'; id: string }
    | { kind: 'campsite'; spot: CampSpot; tile: string | null; season: number };

const logIcon = (id: string): LogItem => ({ kind: 'icon', id });
const LOG_THEN = logIcon('arrow');

/** What a move came to: one or two words, then the coins or cards they name. */
export interface LogResult {
    word: string;
    items: LogItem[];
    /** Came from arriving first or from the Season, on top of the action itself. */
    bonus?: boolean;
}

/** One Journal row: a player's move and everything it led to. */
export interface LogEntry {
    moveId: number;
    playerId: string | null;
    /** The latest sentence, for toasts. */
    text: string;
    /** Where they went. Null for anything outside a move, such as a Season-end Photo. */
    dest: LogItem[] | null;
    results: LogResult[];
    /** Set when the turn ends: nothing more belongs to this row. */
    closed?: boolean;
}

export interface GameStateData {
    phase: Phase;
    rng: number;
    firstGame: boolean;
    season: number;
    activeSeason: string;
    seasonDeck: string[];
    /** trail[0] is slot 1; a Hiker on slot s stands on trail[s - 1]. */
    trail: SiteId[];
    weather: (Sym | null)[];
    advancedPile: SiteId[];
    trailEnd: TrailEndState;
    supply: Record<Token, number>;
    photos: number;
    parksDeck: string[];
    parksBoard: (string | null)[];
    parkBonus: (Sym | null)[];
    gearDeck: string[];
    gearBoard: string[][];
    canteenDeck: string[];
    players: Record<string, PlayerState>;
    current: string;
    firstHikerOwner: string;
    cameraOwner: string | null;
    solo: SoloState | null;
    /** Absent in games saved before Nightfall existed. */
    nightfall?: NightfallState | null;
    /** Absent in games saved before the Wildlife expansion existed. */
    wildlife?: WildlifeState | null;
    tasks: Task[];
    prompt: Prompt | null;
    turn: { water: number; declined: boolean; seasonFired: boolean };
    moveId: number;
    log: LogEntry[];
    scores: Record<string, ScoreBreakdown> | null;
    winners: string[] | null;
}

export interface ScoreBreakdown {
    parks: number;
    photos: number;
    year: number;
    marker: number;
    total: number;
    parksVisited: number;
}

export interface DestInfo { ok: boolean; reason?: string; campfire?: boolean; /** Nightfall: a Tent here can be used. */ camp?: boolean; }

export interface HikerMoves {
    pos: number;
    /** slot → legality, for every Site strictly right of the Hiker. */
    sites: Record<number, DestInfo>;
    tent: boolean;
}

export interface MoveOptions {
    hikers: HikerMoves[];
    /** The Hiker must go straight to Trail End (last-Hiker rule / both Rangers home). */
    forcedEnd: boolean;
    areas: Record<Area, { ok: boolean; possible: boolean; discount: number; firstHiker: boolean; }>;
}

export interface VisitOption {
    /** 'DECK' for the Park deck's unseen top card (Season of Chance). */
    parkId: string;
    source: 'BOARD' | 'RESERVED' | 'DECK';
    slot: number;
    bonus: Sym | null;
    /** Cost after discounts. */
    need: Need;
    /** Cheapest legal payment, or null if unaffordable. */
    suggestion: Bag | null;
}

export interface BuyOption {
    /** 'DECK' buys the Gear deck's unseen top card (Season of Clouds). */
    slot: number | 'DECK';
    gearId: string | null;
    cost: number;
    ok: boolean;
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const emptyBag = (): Record<Token, number> => ({ FOREST: 0, MOUNTAIN: 0, SUNSHINE: 0, WATER: 0, WILDLIFE: 0 });
const bagTotal = (b: Bag): number => TOKENS.reduce((n, t) => n + (b[t] || 0), 0);

export function nextRng(seed: number): { value: number; seed: number } {
    // mulberry32, state threaded through the data
    const s = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, seed: s };
}

/** Does this exact set of tokens cover `need`, given the Gear owned? Shared with the view. */
export function coversPayment(need: Need, payment: Bag, gearIds: string[]): boolean {
    const any = need.ANY || 0;
    const left: Record<Token, number> = { ...emptyBag(), ...payment };
    const owed: Partial<Record<Sym, number>> = { ...need };
    for (const s of SYMS) {
        const n = Math.min(owed[s] || 0, left[s]);
        owed[s] = (owed[s] || 0) - n; left[s] -= n;
    }
    for (const id of gearIds) {
        const sub = GEAR_BY_ID[id].substitute;
        if (!sub) continue;
        const n = Math.min(owed[sub.from] || 0, left[sub.to]);
        owed[sub.from] = (owed[sub.from] || 0) - n; left[sub.to] -= n;
    }
    // Field Guides: one Wildlife covers two of its symbol
    for (const id of gearIds) {
        const pair = GEAR_BY_ID[id].wildPair;
        if (!pair) continue;
        const n = Math.min(Math.floor((owed[pair] || 0) / 2), left.WILDLIFE);
        owed[pair] = (owed[pair] || 0) - 2 * n; left.WILDLIFE -= n;
    }
    // printed symbols still owed take Wildlife; whatever is left over pays the brown square
    const rest = SYMS.reduce((n, s) => n + (owed[s] || 0), 0);
    const extras = TOKENS.filter(t => t !== 'WILDLIFE').reduce((n, t) => n + left[t], 0);
    return rest <= left.WILDLIFE && extras + left.WILDLIFE - rest === any;
}

export function bagText(b: Bag): string {
    return TOKENS.filter(t => b[t]).map(t => `${b[t]} ${TOKEN_NAME[t]}`).join(', ');
}

export class ParksGameState {
    private data: GameStateData;
    private readonly playerIds: string[];

    constructor(playerIds: string[]) {
        this.playerIds = [...playerIds];
        this.data = null as any;
    }

    public static from_data(data: GameStateData, playerIds: string[]): ParksGameState {
        const gs = new ParksGameState(playerIds);
        gs.data = data;
        return gs;
    }

    public get_data(): GameStateData { return this.data; }
    public get_player_order(): string[] { return [...this.playerIds]; }
    public get_phase(): Phase { return this.data.phase; }
    public get_player(id: string): PlayerState | undefined { return this.data.players[id]; }
    public get_prompt(): Prompt | null { return this.data.prompt; }
    public get_current(): string { return this.data.current; }
    public isSolo(): boolean { return this.data.solo !== null; }

    // -----------------------------------------------------------------------
    // Setup
    // -----------------------------------------------------------------------

    public start_game(opts: { seed?: number; firstGame?: boolean; nightfall?: boolean | Partial<NfModules>; wildlife?: boolean | Partial<WlModules> } = {}): void {
        const n = this.playerIds.length;
        if (n < MIN_PLAYERS || n > MAX_PLAYERS) throw new Error(`Parks supports ${MIN_PLAYERS} to ${MAX_PLAYERS} players.`);
        const solo = n === 1;
        const seed = opts.seed != null ? opts.seed : Math.floor(Math.random() * 2147483647);

        this.data = {
            phase: Phase.Year,
            rng: seed,
            firstGame: !!opts.firstGame,
            season: 1,
            activeSeason: '',
            seasonDeck: [],
            trail: [],
            weather: [],
            advancedPile: [],
            trailEnd: this.freshTrailEnd(),
            supply: { ...SUPPLY_START },
            photos: PHOTOS_START,
            parksDeck: [],
            parksBoard: [null, null, null],
            parkBonus: [null, null, null],
            gearDeck: [],
            gearBoard: [[], [], []],
            canteenDeck: [],
            players: {},
            current: this.playerIds[0],
            firstHikerOwner: this.playerIds[0],
            cameraOwner: null,
            solo: null,
            nightfall: null,
            wildlife: null,
            tasks: [],
            prompt: null,
            turn: { water: 0, declined: false, seasonFired: false },
            moveId: 0,
            log: [],
            scores: null,
            winners: null
        };
        const d = this.data;

        const mods = nfModulesOf(opts.nightfall);
        const wl = wlModulesOf(opts.wildlife);
        if (wlAny(wl)) d.wildlife = { modules: wl, endBonus: { RESERVE: null, GEAR: null, VISIT: null }, gearBonus: [null, null, null] };
        const parks = mods.parks ? [...PARK_CARDS, ...NIGHTFALL_PARK_CARDS] : PARK_CARDS;
        d.parksDeck = this.shuffled(parks.map(p => p.id));
        d.parksBoard = [d.parksDeck.pop()!, d.parksDeck.pop()!, d.parksDeck.pop()!];
        d.gearDeck = this.shuffled([...GEAR_CARDS, ...(wl.gear ? WL_GEAR_CARDS : [])].map(g => g.id));
        d.canteenDeck = this.shuffled([...CANTEEN_CARDS, ...(wl.canteens ? WL_CANTEEN_CARDS : [])].map(c => c.id));
        // Nightfall Year cards replace the base deck outright
        const yearDeck = this.shuffled((mods.years ? NIGHTFALL_YEAR_CARDS : YEAR_CARDS).map(y => y.id));
        d.seasonDeck = this.shuffled([...SEASON_CARDS, ...(wl.seasons ? WL_SEASON_CARDS : [])].map(s => s.id));
        d.activeSeason = d.seasonDeck.shift()!;
        d.advancedPile = this.shuffled([...ADVANCED_SITES, ...(wl.sites ? WL_SITES : [])]);

        for (const id of this.playerIds) {
            const yearOptions = opts.firstGame ? [yearDeck.pop()!] : [yearDeck.pop()!, yearDeck.pop()!];
            d.players[id] = {
                id,
                hikers: [0, 0],
                campfireLit: true,
                tokens: emptyBag(),
                photos: 0,
                canteens: [{ id: d.canteenDeck.pop()!, filled: false }],
                gear: [],
                reserved: [],
                visited: [],
                year: opts.firstGame ? yearOptions[0] : null,
                yearOptions,
                extraYears: []
            };
        }

        if (mods.wildlife) {
            // four more Wildlife come in the box, and everyone starts with one
            d.supply.WILDLIFE += NIGHTFALL_WILDLIFE;
            for (const id of this.playerIds) { d.supply.WILDLIFE -= 1; d.players[id].tokens.WILDLIFE += 1; }
        }
        if (nfAny(mods)) {
            // without Campsites there is nowhere to pitch: no tiles and no board slots
            const tiles = mods.campsites ? this.shuffled(CAMPSITE_TILES.filter(t => !t.fivePlayer).map(t => t.id)).slice(0, 3) : [];
            if (mods.campsites && n === 5) CAMPSITE_TILES.filter(t => t.fivePlayer).forEach(t => tiles.push(t.id));
            d.nightfall = {
                modules: mods,
                camps: [],
                campsites: tiles.map(tile => ({ tile, taken: false })),
                boardSlots: mods.campsites ? (n >= 4 ? 2 : 1) : 0,
                boardTaken: 0,
                yearDeck
            };
        }

        if (solo) {
            const you = this.playerIds[0];
            const events = this.shuffled(EVENT_CARDS.map(e => e.id));
            d.firstHikerOwner = you;
            d.cameraOwner = you;
            d.solo = {
                rangers: [0, 0],
                tracker: { SUNSHINE: 0, WATER: 0 },
                eventDeck: events,
                activeEvent: events.shift()!,
                lastCost: 1
            };
        } else {
            const firstIdx = Math.floor(this.random() * n);
            d.firstHikerOwner = this.playerIds[firstIdx];
            d.cameraOwner = this.playerIds[(firstIdx + n - 1) % n];
            for (let i = 0; i < 3; i++) this.refillGear(i);
        }

        // Season 1's Trail: the basics plus one advanced Site, shuffled.
        const basics = [...BASIC_SITES];
        if (n >= 4) basics.push('WATERFALL');
        d.trail = this.shuffled([...basics, d.advancedPile.shift()!]);
        this.beginSeason();

        if (opts.firstGame) d.phase = Phase.Play;
    }

    private freshTrailEnd(): TrailEndState {
        return {
            reserve: [], gear: [], visit: [], firstSlot: null,
            rangerTop: false, rangerMiddle: false, rangerBottom: false, reserveBlocked: false
        };
    }

    private random(): number {
        const r = nextRng(this.data.rng);
        this.data.rng = r.seed;
        return r.value;
    }

    private shuffled<T>(arr: T[]): T[] {
        const out = [...arr];
        for (let i = out.length - 1; i > 0; i--) {
            const j = Math.floor(this.random() * (i + 1));
            [out[i], out[j]] = [out[j], out[i]];
        }
        return out;
    }

    private pushLog(entry: Omit<LogEntry, 'moveId'>): void {
        const d = this.data;
        d.moveId += 1;
        d.log.push({ ...entry, moveId: d.moveId });
        if (d.log.length > 60) d.log.shift();
    }

    /** A rule-of-the-game row belonging to nobody. */
    private logEvent(text: string, items: LogItem[]): void {
        this.pushLog({ playerId: null, text, dest: null, results: [{ word: '', items }], closed: true });
    }

    /** Opens the row every later result this turn lands on. */
    private logMove(playerId: string, text: string, dest: LogItem[]): void {
        this.pushLog({ playerId, text, dest, results: [] });
    }

    private logResult(playerId: string, text: string, word: string, items: LogItem[], bonus = false): void {
        const d = this.data;
        const result: LogResult = bonus ? { word, items, bonus } : { word, items };
        const row = d.log[d.log.length - 1];
        if (row && !row.closed && row.playerId === playerId) {
            d.moveId += 1;
            row.moveId = d.moveId;
            row.text = text;
            row.results.push(result);
        } else {
            this.pushLog({ playerId, text, dest: null, results: [result] });
        }
    }

    private closeLogRow(): void {
        const l = this.data.log;
        if (l.length) l[l.length - 1].closed = true;
    }

    public get_last_move(): LogEntry | null {
        const l = this.data.log;
        return l.length ? l[l.length - 1] : null;
    }

    public get_log(): LogEntry[] { return this.data.log; }

    public season(): SeasonCard { return SEASON_BY_ID[this.data.activeSeason]; }

    // -----------------------------------------------------------------------
    // Season lifecycle
    // -----------------------------------------------------------------------

    private beginSeason(): void {
        const d = this.data;
        const season = this.season();

        // Weather from Site #2 onward, repeating the card's pattern.
        d.weather = d.trail.map(() => null);
        for (let i = 1; i < d.trail.length; i++) {
            const tok = season.weather[(i - 1) % season.weather.length];
            if (d.supply[tok] > 0) { d.supply[tok] -= 1; d.weather[i] = tok; }
        }

        // Rain / Splendor drop a token on each current Park.
        d.parkBonus = [null, null, null];
        if (season.effect.kind === 'PARK_BONUS') {
            const tok = season.effect.token;
            d.parksBoard.forEach((p, i) => {
                if (p && d.supply[tok] > 0) { d.supply[tok] -= 1; d.parkBonus[i] = tok; }
            });
        }

        // Breeze / Heights: a token on each Trail End area, or on each face-up Gear
        const wl = d.wildlife;
        if (wl) {
            const eff = season.effect;
            const put = (tok: Sym): Sym | null => {
                if (d.supply[tok] <= 0) return null;
                d.supply[tok] -= 1;
                return tok;
            };
            if (eff.kind === 'END_BONUS') AREAS.forEach((a) => { wl.endBonus[a] = put(eff.token); });
            if (eff.kind === 'GEAR_BONUS') wl.gearBonus = d.gearBoard.map(stack => stack.length ? put(eff.token) : null);
        }

        if (this.nfHas('campsites')) this.pitchCamps();

        d.current = this.isSolo() ? this.playerIds[0] : d.firstHikerOwner;
        this.resetTurn();
        this.logEvent(`${season.name} begins`, [{ kind: 'season', id: season.id }]);
    }

    /** Nightfall: Tents on the Site before Trail End and every other Site back, plus one more for 4-5. */
    private pitchCamps(): void {
        const nf = this.data.nightfall!;
        const len = this.data.trail.length;
        nf.camps = this.data.trail.map(() => false);
        const spots = [len - 1, len - 3, len - 5];
        if (this.playerIds.length >= 4) spots.push(len - 4);
        spots.forEach((i) => { if (i >= 0) nf.camps[i] = true; });
        nf.campsites.forEach((c) => { c.taken = false; });
        nf.boardTaken = 0;
    }

    private resetTurn(): void {
        this.data.turn = { water: 0, declined: false, seasonFired: false };
    }

    private startSeasonEnd(): void {
        const d = this.data;
        d.tasks.push({ t: 'SEASON_FINISH' });
        const cam = d.cameraOwner;
        if (cam && d.photos > 0 && bagTotal(d.players[cam].tokens) >= 1) {
            d.prompt = { kind: 'PAY', playerId: cam, count: 1, purpose: 'CAMERA', optional: true };
            return;
        }
        this.run();
    }

    private finishSeason(): void {
        const d = this.data;

        // Empty Canteens, clear Weather and Park tokens back to the supply.
        for (const id of this.playerIds) {
            for (const c of d.players[id].canteens) {
                if (c.filled) { c.filled = false; d.supply.WATER += 1; }
            }
        }
        d.weather.forEach((w) => { if (w) d.supply[w] += 1; });
        d.parkBonus.forEach((b) => { if (b) d.supply[b] += 1; });
        d.weather = [];
        d.parkBonus = [null, null, null];
        if (d.nightfall) d.nightfall.camps = [];
        if (d.wildlife) {
            const wl = d.wildlife;
            [...AREAS.map(a => wl.endBonus[a]), ...wl.gearBonus].forEach((b) => { if (b) d.supply[b] += 1; });
            wl.endBonus = { RESERVE: null, GEAR: null, VISIT: null };
            wl.gearBonus = [null, null, null];
        }

        if (d.season >= SEASONS_PER_GAME) {
            this.finishGame();
            return;
        }

        for (const id of this.playerIds) d.players[id].hikers = [0, 0];
        d.trailEnd = this.freshTrailEnd();
        if (d.solo) {
            d.solo.rangers = [0, 0];
            // Ranger-discarded Park slots come back at Season end.
            for (let i = 0; i < 3; i++) if (!d.parksBoard[i]) this.refillPark(i);
        }

        d.trail = this.shuffled([...d.trail, d.advancedPile.shift()!]);
        d.seasonDeck.push(d.activeSeason);
        d.activeSeason = d.seasonDeck.shift()!;
        d.season += 1;
        this.beginSeason();
    }

    private finishGame(): void {
        const d = this.data;
        d.phase = Phase.Over;
        d.prompt = null;
        d.tasks = [];
        d.scores = {};
        for (const id of this.playerIds) d.scores[id] = this.computeScore(id);
        const rank = (id: string) => [d.scores![id].total, d.scores![id].parksVisited];
        let best: number[] = [-1, -1];
        for (const id of this.playerIds) {
            const r = rank(id);
            if (r[0] > best[0] || (r[0] === best[0] && r[1] > best[1])) best = r;
        }
        d.winners = this.playerIds.filter(id => rank(id)[0] === best[0] && rank(id)[1] === best[1]);
        this.logEvent('The Year is over', [logIcon('year_glyph')]);
    }

    // -----------------------------------------------------------------------
    // Scoring
    // -----------------------------------------------------------------------

    /** Progress numbers a Year card is judged on: [goal count, photos]. */
    public yearProgress(playerId: string, year: YearCard): number {
        const p = this.data.players[playerId];
        const parks = p.visited.map(id => PARK_BY_ID[id]);
        // only icons left of the bolt count, and `cost` holds exactly those
        const symbols = (s: Sym) => parks.reduce((n, c) => n + (c.cost[s] || 0), 0);
        const worth = (pts: number) => parks.filter(c => c.points === pts).length;
        const g = year.goal;
        switch (g.kind) {
            case 'SYMBOLS_AND_PHOTOS':
            case 'SYMBOL_ICONS': return symbols(g.symbol);
            case 'SYMBOLS_ANY_ONE_TYPE': return Math.max(...SYMS.map(symbols));
            case 'PARKS_WITH_SYMBOL': return parks.filter(c => (c.cost[g.symbol] || 0) > 0).length;
            case 'PARKS_IN_POINT_RANGE': return parks.filter(c => c.points >= g.min && c.points <= g.max).length;
            case 'GEAR_COST_TOTAL': return p.gear.reduce((n, id) => n + GEAR_BY_ID[id].cost, 0);
            case 'POINT_SETS': return Math.min(worth(2), worth(3), worth(4));
            case 'TOKENS_HELD': return bagTotal(p.tokens);
            case 'PHOTOS': return p.photos;
            case 'WILDLIFE_HELD': return p.tokens.WILDLIFE;
            case 'SYMBOL_SETS': return Math.min(...SYMS.map(symbols));
            case 'INSTANT_PARKS': return parks.filter(c => !!c.instant).length;
        }
    }

    public yearPoints(playerId: string, yearId: string | null): number {
        if (!yearId) return 0;
        const year = YEAR_BY_ID[yearId];
        const p = this.data.players[playerId];
        const progress = this.yearProgress(playerId, year);
        if (year.rate) return yearRatePoints(year, progress);
        const met = (t: YearTier) => progress >= t.threshold && p.photos >= (t.photos || 0);
        return year.tiers.reduce((best, t) => met(t) ? Math.max(best, t.points) : best, 0);
    }

    /** Every Year card a player holds: the one chosen, then any gained in play. */
    public yearsOf(playerId: string): string[] {
        const p = this.data.players[playerId];
        return [p.year, ...(p.extraYears || [])].filter((y): y is string => !!y);
    }

    /** All Year cards together; copies of the same Nightfall card score once. */
    public totalYearPoints(playerId: string): number {
        const seen = new Set<string>();
        let total = 0;
        for (const id of this.yearsOf(playerId)) {
            const key = YEAR_BY_ID[id].kind || id;
            if (seen.has(key)) continue;
            seen.add(key);
            total += this.yearPoints(playerId, id);
        }
        return total;
    }

    public computeScore(playerId: string): ScoreBreakdown {
        const d = this.data;
        const p = d.players[playerId];
        const parks = p.visited.reduce((n, id) => n + PARK_BY_ID[id].points, 0);
        const year = this.totalYearPoints(playerId);
        const marker = d.firstHikerOwner === playerId ? 1 : 0;
        return {
            parks, photos: p.photos, year, marker,
            total: parks + p.photos + year + marker,
            parksVisited: p.visited.length
        };
    }

    /** Everything but the secret Year card: what the table can see during play. */
    public publicScore(playerId: string): number {
        const s = this.computeScore(playerId);
        return s.total - s.year;
    }

    // -----------------------------------------------------------------------
    // Queries: costs & feasibility
    // -----------------------------------------------------------------------

    private ownedGear(playerId: string): GearCard[] {
        return this.data.players[playerId].gear.map(id => GEAR_BY_ID[id]);
    }

    private hasCamera(playerId: string): boolean { return this.data.cameraOwner === playerId; }

    public photoCost(playerId: string): number { return this.hasCamera(playerId) ? 1 : 2; }

    public parkNeed(playerId: string, park: ParkCard, reserved = false): Need {
        const need: Need = { ...park.cost };
        const cut = (s: Sym, by: number) => { if (need[s]) need[s] = Math.max(0, need[s]! - by); };
        const eff = this.season().effect;
        if (eff.kind === 'PARK_DISCOUNT') cut(eff.token, 1);
        if (eff.kind === 'RESERVED_DISCOUNT' && reserved) eff.tokens.forEach(t => cut(t, 1));
        for (const g of this.ownedGear(playerId)) {
            if (g.discount) SYMS.forEach(s => { if (g.discount![s]) cut(s, g.discount![s]!); });
        }
        SYMS.forEach(s => { if (!need[s]) delete need[s]; });
        // discounts only cut printed symbols, never the brown square
        if (park.any) need.ANY = park.any;
        return need;
    }

    private substitutesFor(playerId: string, sym: Sym): Sym[] {
        return this.ownedGear(playerId).filter(g => g.substitute && g.substitute.from === sym).map(g => g.substitute!.to);
    }

    /** Cheapest payment: exact tokens, then substitutes, Wildlife only as a last resort. */
    public suggestPayment(playerId: string, need: Need, held: Record<Token, number>): Bag | null {
        const left: Record<Token, number> = { ...held };
        const owed: Partial<Record<Sym, number>> = { ...need };
        const pay: Bag = {};
        const take = (t: Token, n: number) => { left[t] -= n; pay[t] = (pay[t] || 0) + n; };
        for (const s of SYMS) {
            const n = Math.min(owed[s] || 0, left[s]);
            if (n > 0) { take(s, n); owed[s] = owed[s]! - n; }
        }
        for (const s of SYMS) {
            for (const sub of this.substitutesFor(playerId, s)) {
                const n = Math.min(owed[s] || 0, left[sub]);
                if (n > 0) { take(sub, n); owed[s] = owed[s]! - n; }
            }
        }
        for (const g of this.ownedGear(playerId)) {
            if (!g.wildPair) continue;
            const n = Math.min(Math.floor((owed[g.wildPair] || 0) / 2), left.WILDLIFE);
            if (n > 0) { take('WILDLIFE', n); owed[g.wildPair] = owed[g.wildPair]! - 2 * n; }
        }
        const rest = SYMS.reduce((n, s) => n + (owed[s] || 0), 0);
        if (rest > left.WILDLIFE) return null;
        if (rest > 0) take('WILDLIFE', rest);
        // the brown square: the most plentiful tokens first, Wildlife last
        for (let i = 0; i < (need.ANY || 0); i++) {
            const pick: Token | undefined = SYMS.filter(s => left[s] > 0).sort((a, b) => left[b] - left[a])[0] || (left.WILDLIFE > 0 ? 'WILDLIFE' : undefined);
            if (!pick) return null;
            take(pick, 1);
        }
        return pay;
    }

    public paymentCovers(playerId: string, need: Need, payment: Bag): boolean {
        return coversPayment(need, payment, this.data.players[playerId].gear);
    }

    public visitOptions(playerId: string, held?: Record<Token, number>): VisitOption[] {
        const d = this.data;
        const tokens = held || d.players[playerId].tokens;
        const out: VisitOption[] = [];
        const add = (parkId: string, source: 'BOARD' | 'RESERVED', slot: number, bonus: Sym | null) => {
            const need = this.parkNeed(playerId, PARK_BY_ID[parkId], source === 'RESERVED');
            const withBonus = { ...tokens };
            if (bonus) withBonus[bonus] += 1;
            out.push({ parkId, source, slot, bonus, need, suggestion: this.suggestPayment(playerId, need, withBonus) });
        };
        d.parksBoard.forEach((id, i) => { if (id) add(id, 'BOARD', i, d.parkBonus[i]); });
        d.players[playerId].reserved.forEach((id, i) => add(id, 'RESERVED', i, null));
        const blind = this.blindVisitNeed();
        if (blind && d.parksDeck.length) {
            out.push({ parkId: 'DECK', source: 'DECK', slot: -1, bonus: null, need: blind, suggestion: this.suggestPayment(playerId, blind, tokens) });
        }
        return out;
    }

    /** Season of Chance: the fixed price of the Park deck's top card, or null in any other Season. */
    private blindVisitNeed(): Need | null {
        const eff = this.season().effect;
        return eff.kind === 'BLIND_VISIT' ? { ...eff.cost } : null;
    }

    private canVisitAny(playerId: string, held?: Record<Token, number>): boolean {
        return this.visitOptions(playerId, held).some(o => o.suggestion !== null);
    }

    public canReserve(): boolean {
        const d = this.data;
        if (d.trailEnd.reserveBlocked) return false;
        return d.parksDeck.length > 0 || d.parksBoard.some(p => p !== null);
    }

    public gearPrice(playerId: string, gearId: string | null, slotDiscount: number): number {
        // Season of Clouds: one flat price, whatever the card or discounts
        const eff = this.season().effect;
        if (eff.kind === 'GEAR_FLAT' || !gearId) return eff.kind === 'GEAR_FLAT' ? eff.cost : 0;
        let cost = GEAR_BY_ID[gearId].cost - slotDiscount;
        if (this.season().effect.kind === 'GEAR_DISCOUNT') cost -= 1;
        for (const g of this.ownedGear(playerId)) if (g.gearDiscount) cost -= g.gearDiscount;
        return Math.max(0, cost);
    }

    public buyOptions(playerId: string, slotDiscount: number, held?: Record<Token, number>): BuyOption[] {
        const d = this.data;
        const tokens = held || d.players[playerId].tokens;
        const out: BuyOption[] = [];
        d.gearBoard.forEach((stack, slot) => {
            if (stack.length === 0) return;
            const gearId = stack[stack.length - 1];
            const cost = this.gearPrice(playerId, gearId, slotDiscount);
            out.push({ slot, gearId, cost, ok: tokens.SUNSHINE >= cost });
        });
        if (this.season().effect.kind === 'GEAR_FLAT' && d.gearDeck.length) {
            const cost = this.gearPrice(playerId, null, slotDiscount);
            out.push({ slot: 'DECK', gearId: null, cost, ok: tokens.SUNSHINE >= cost });
        }
        return out;
    }

    private canBuyAny(playerId: string, slotDiscount: number, held?: Record<Token, number>): boolean {
        return this.buyOptions(playerId, slotDiscount, held).some(o => o.ok);
    }

    private supplyHas(bag: Bag): boolean {
        return TOKENS.every(t => this.data.supply[t] >= (bag[t] || 0));
    }

    /** Gear replacements usable on a direct visit: gain instead of the printed action. */
    public replacements(playerId: string, site: SiteId): GearCard[] {
        return this.ownedGear(playerId).filter(g => g.replace && g.replace.site === site && this.supplyHas(g.replace.gain));
    }

    /** Can a Lodge-style trade happen from these tokens? */
    public canExchange(held: Record<Token, number>): boolean {
        const supply = this.data.supply;
        return TOKENS.some(t => held[t] >= 1 && SYMS.some(s => s !== t && supply[s] >= 1));
    }

    /** Slots with someone on them, optionally ignoring the Hiker about to leave. */
    private occupied(ignore?: { playerId: string; hiker: number }): Set<number> {
        const d = this.data;
        const slots = new Set<number>();
        for (const id of this.playerIds) {
            d.players[id].hikers.forEach((pos, i) => {
                if (ignore && ignore.playerId === id && ignore.hiker === i) return;
                if (pos > 0 && pos !== END) slots.add(pos);
            });
        }
        if (d.solo) d.solo.rangers.forEach(pos => { if (pos > 0 && pos !== END) slots.add(pos); });
        return slots;
    }

    /** Sites a River here could copy from `held`, paying the Water first. */
    public riverTargets(playerId: string, held: Record<Token, number>, ignore?: { playerId: string; hiker: number }): number[] {
        const d = this.data;
        const afterPay = { ...held, WATER: held.WATER - 1 };
        return Array.from(this.occupied(ignore)).filter((slot) => {
            const site = d.trail[slot - 1];
            // copying a copier could chain forever
            return site !== 'RIVER' && site !== 'PARKWAY' && this.siteLegal(playerId, site, afterPay, false);
        }).sort((a, b) => a - b);
    }

    /** Parkway: Sites with no Hiker or Ranger on them whose action could be taken. */
    public parkwayTargets(playerId: string, held: Record<Token, number>, ignore?: { playerId: string; hiker: number }): number[] {
        const d = this.data;
        const taken = this.occupied(ignore);
        const out: number[] = [];
        d.trail.forEach((site, i) => {
            const slot = i + 1;
            if (taken.has(slot) || site === 'PARKWAY' || site === 'RIVER') return;
            if (this.siteLegal(playerId, site, held, false)) out.push(slot);
        });
        return out;
    }

    private filledCanteens(playerId: string): number[] {
        return this.data.players[playerId].canteens.map((c, i) => c.filled ? i : -1).filter(i => i >= 0);
    }

    public siteLegal(
        playerId: string, site: SiteId, held: Record<Token, number>, direct: boolean,
        ignore?: { playerId: string; hiker: number }
    ): boolean {
        const d = this.data;
        const def = SITES[site];
        if (def.gain) {
            if (this.supplyHas(def.gain)) return true;
            return direct && this.replacements(playerId, site).length > 0;
        }
        switch (site) {
            case 'VISTA':
                return d.canteenDeck.length > 0 || (d.photos > 0 && bagTotal(held) >= this.photoCost(playerId));
            case 'WILDLIFE':
                return bagTotal(held) >= 1 && d.supply.WILDLIFE >= 1;
            case 'LODGE':
                return this.canExchange(held);
            case 'LOOKOUT':
                return this.canReserve() || this.canVisitAny(playerId, held) || this.canBuyAny(playerId, 0, held);
            case 'RIVER':
                return held.WATER >= 1 && this.riverTargets(playerId, held, ignore).length > 0;
            case 'LAKE':
                return this.filledCanteens(playerId).length > 0;
            case 'PARKWAY':
                return this.parkwayTargets(playerId, held, ignore).length > 0;
            case 'SUMMIT':
                return d.players[playerId].photos > 0 && SYMS.some(s => d.supply[s] > 0);
            case 'CANYON':
                return held.WILDLIFE >= 1 && (d.supply.SUNSHINE > 0 || d.supply.WATER > 0);
            default:
                return false;
        }
    }

    /** Hikers on Sites or the Trailhead, across the whole table. */
    private hikersOnTrail(): number {
        const d = this.data;
        return this.playerIds.reduce((n, id) => n + d.players[id].hikers.filter(p => p !== END).length, 0);
    }

    private forcedEnd(): boolean {
        const d = this.data;
        if (d.solo) return d.solo.rangers.every(p => p === END);
        return this.hikersOnTrail() === 1;
    }

    private gearDiscountFor(): number {
        const d = this.data;
        if (d.solo) return 0;
        const free = this.playerIds.length >= 4 ? 2 : 1;
        return d.trailEnd.gear.length < free ? 1 : 0;
    }

    public moveOptions(playerId: string): MoveOptions {
        const d = this.data;
        const p = d.players[playerId];
        const forcedEnd = this.forcedEnd();

        const hikers: HikerMoves[] = p.hikers.map((pos, hiker) => {
            const sites: Record<number, DestInfo> = {};
            if (pos !== END) {
                for (let slot = pos + 1; slot <= d.trail.length; slot++) {
                    sites[slot] = this.destInfo(playerId, hiker, slot, forcedEnd);
                }
            }
            const site = pos > 0 && pos !== END ? d.trail[pos - 1] : null;
            const tent = !!site && !forcedEnd && p.campfireLit && this.ownedGear(playerId).some(g => g.tent)
                && this.siteLegal(playerId, site, p.tokens, true);
            return { pos, sites, tent };
        });

        const discount = this.gearDiscountFor();
        return {
            hikers,
            forcedEnd,
            areas: {
                RESERVE: {
                    ok: !d.trailEnd.reserveBlocked, possible: this.canReserve(), discount: 0,
                    firstHiker: d.trailEnd.firstSlot === null
                },
                GEAR: { ok: true, possible: this.canBuyAny(playerId, discount), discount, firstHiker: false },
                VISIT: { ok: true, possible: this.canVisitAny(playerId), discount: 0, firstHiker: false }
            }
        };
    }

    private destInfo(playerId: string, hiker: number, slot: number, forcedEnd: boolean): DestInfo {
        const d = this.data;
        const p = d.players[playerId];
        if (forcedEnd) return { ok: false, reason: 'Must go to Trail End' };
        const ignore = { playerId, hiker };
        const taken = this.occupied(ignore).has(slot);
        if (taken && !p.campfireLit) return { ok: false, reason: 'Occupied, Campfire out' };
        const siteOk = this.siteActionOk(playerId, slot, ignore);
        // camping skips the Weather, so the Tent is judged on the tokens already held
        const camp = this.campHere(slot) && this.campOptions(playerId).length > 0;
        if (!siteOk && !camp) return { ok: false, reason: 'Can’t take its action' };
        return { ok: true, campfire: taken, camp };
    }

    /** Could the Site's own action be taken on arrival, counting its Weather token? */
    private siteActionOk(playerId: string, slot: number, ignore?: { playerId: string; hiker: number }): boolean {
        const d = this.data;
        const held = { ...d.players[playerId].tokens };
        const w = d.weather[slot - 1];
        if (w) held[w] += 1;
        return this.siteLegal(playerId, d.trail[slot - 1], held, true, ignore);
    }

    // -----------------------------------------------------------------------
    // Mutations: tokens, cards
    // -----------------------------------------------------------------------

    /** Take tokens from the supply, firing once-per-turn Season bonuses. */
    private gain(playerId: string, bag: Bag): void {
        const d = this.data;
        const p = d.players[playerId];
        const eff = this.season().effect;
        let triggered = false;
        for (const t of TOKENS) {
            const n = Math.min(bag[t] || 0, d.supply[t]);
            if (n <= 0) continue;
            d.supply[t] -= n;
            p.tokens[t] += n;
            if (t === 'WATER') { d.turn.water += n; d.turn.declined = false; }
            if (eff.kind === 'ON_GAIN' && eff.when === t) triggered = true;
        }
        if (triggered && eff.kind === 'ON_GAIN' && !d.turn.seasonFired) {
            d.turn.seasonFired = true;
            this.gainSeasonBonus(playerId, eff.bonus);
        }
        const wild = Math.min(bag.WILDLIFE || 0, p.tokens.WILDLIFE);
        if (wild > 0 && d.photos > 0 && this.ownedGear(playerId).some(g => g.shutter)) {
            this.push(this.whenUseful({ t: 'PROMPT', prompt: { kind: 'SHUTTER', playerId, count: wild } }));
        }
    }

    /** Straight from the supply, no Season bonus: tokens handed to players whose turn it isn't. */
    private give(playerId: string, token: Token, n: number): number {
        const d = this.data;
        const got = Math.min(n, d.supply[token]);
        d.supply[token] -= got;
        d.players[playerId].tokens[token] += got;
        return got;
    }

    private gainSeasonBonus(playerId: string, token: Sym): void {
        if (this.data.supply[token] > 0) this.logSeasonToken(playerId, token);
        this.gain(playerId, { [token]: 1 });
    }

    private logSeasonToken(playerId: string, token: Sym): void {
        this.logResult(playerId, `gained ${TOKEN_NAME[token]} from the Season`, 'season', [{ kind: 'bag', bag: { [token]: 1 } }], true);
    }

    /** `gain`, logged at what the supply could actually pay. */
    private gainLogged(playerId: string, bag: Bag, text: string, extra: LogItem[] = []): void {
        const got: Bag = {};
        for (const t of TOKENS) {
            const n = Math.min(bag[t] || 0, this.data.supply[t]);
            if (n > 0) got[t] = n;
        }
        this.gain(playerId, bag);
        if (bagTotal(got) > 0) this.logResult(playerId, text, 'gained', [{ kind: 'bag', bag: got }, ...extra]);
    }

    private spend(playerId: string, bag: Bag): void {
        const d = this.data;
        const p = d.players[playerId];
        for (const t of TOKENS) {
            const n = bag[t] || 0;
            if (n > p.tokens[t]) throw new Error(`Not enough ${TOKEN_NAME[t]}`);
        }
        for (const t of TOKENS) {
            const n = bag[t] || 0;
            p.tokens[t] -= n;
            d.supply[t] += n;
        }
    }

    private refillPark(slot: number): void {
        const d = this.data;
        d.parksBoard[slot] = d.parksDeck.length ? d.parksDeck.pop()! : null;
    }

    private refillGear(slot: number): void {
        const d = this.data;
        if (d.gearDeck.length) d.gearBoard[slot] = [d.gearDeck.pop()!];
        else d.gearBoard[slot] = [];
    }

    private drawCanteen(playerId: string): void {
        const d = this.data;
        if (!d.canteenDeck.length) return;
        const id = d.canteenDeck.pop()!;
        d.players[playerId].canteens.push({ id, filled: false });
        this.logResult(playerId, 'found a Canteen', 'found', [{ kind: 'canteen', id, filled: false }]);
        const eff = this.season().effect;
        if (eff.kind === 'ON_CANTEEN') this.gainSeasonBonus(playerId, eff.bonus);
    }

    private takePhoto(playerId: string): void {
        const d = this.data;
        if (d.photos <= 0) return;
        d.photos -= 1;
        d.players[playerId].photos += 1;
    }

    private push(...tasks: Task[]): void {
        // listed in the order they should run
        for (let i = tasks.length - 1; i >= 0; i--) this.data.tasks.push(tasks[i]);
    }

    private ask(prompt: Prompt): void {
        this.data.prompt = prompt;
    }

    /** A required payment with only one token type held has nothing to decide. */
    private askPay(playerId: string, count: number, purpose: PayPurpose, optional: boolean): void {
        const tokens = this.data.players[playerId].tokens;
        const types = TOKENS.filter(t => tokens[t] > 0);
        if (!optional && types.length === 1 && tokens[types[0]] >= count) {
            this.applyPay(playerId, { [types[0]]: count }, purpose);
            return;
        }
        this.ask({ kind: 'PAY', playerId, count, purpose, optional });
    }

    private applyPay(playerId: string, pay: Bag, purpose: PayPurpose): void {
        const d = this.data;
        this.spend(playerId, pay);
        switch (purpose) {
            case 'VISTA':
                this.takePhoto(playerId);
                d.cameraOwner = playerId;
                this.logResult(playerId, 'took a Photo and the Camera', 'paid', [{ kind: 'bag', bag: pay }, LOG_THEN, logIcon('photo'), logIcon('camera')]);
                break;
            case 'LENS':
                this.takePhoto(playerId);
                this.logResult(playerId, 'took a Photo', 'paid', [{ kind: 'bag', bag: pay }, LOG_THEN, logIcon('photo')]);
                break;
            case 'CAMERA':
                this.takePhoto(playerId);
                this.logResult(playerId, 'took a Season-end Photo', 'paid', [{ kind: 'bag', bag: pay }, LOG_THEN, logIcon('photo')]);
                break;
            case 'WILD':
                this.logResult(playerId, 'spotted Wildlife', 'paid', [{ kind: 'bag', bag: pay }, LOG_THEN, { kind: 'bag', bag: { WILDLIFE: 1 } }]);
                this.gain(playerId, { WILDLIFE: 1 });
                break;
            case 'SNAP':
                this.takePhoto(playerId);
                this.logResult(playerId, 'took a Photo', 'paid', [{ kind: 'bag', bag: pay }, LOG_THEN, logIcon('photo')]);
                break;
        }
    }

    private fillCanteen(playerId: string, index: number, free: boolean): void {
        const d = this.data;
        const p = d.players[playerId];
        const c = p.canteens[index];
        if (!c || c.filled) throw new Error('That Canteen cannot be filled');
        if (free) {
            if (d.supply.WATER < 1) throw new Error('No Water in the supply');
            d.supply.WATER -= 1;
        } else {
            if (this.canteenWater(playerId) < 1) throw new Error('No Water gained this turn');
            p.tokens.WATER -= 1;
            d.turn.water -= 1;
        }
        c.filled = true;
        const eff = this.season().effect;
        if (eff.kind === 'ON_FILL') this.gainSeasonBonus(playerId, eff.bonus);
        this.resolveCanteen(playerId, CANTEEN_BY_ID[c.id].effect);
    }

    private resolveCanteen(playerId: string, effect: CanteenEffect): void {
        const p = this.data.players[playerId];
        switch (effect) {
            case 'FOREST': this.gainLogged(playerId, { FOREST: 1 }, 'gained 1 Forest from a Canteen'); break;
            case 'MOUNTAIN': this.gainLogged(playerId, { MOUNTAIN: 1 }, 'gained 1 Mountain from a Canteen'); break;
            case 'SUNSHINE': this.gainLogged(playerId, { SUNSHINE: 2 }, 'gained 2 Sunshine from a Canteen'); break;
            case 'EXCHANGE':
                if (this.canExchange(p.tokens)) this.ask({ kind: 'EXCHANGE', playerId, optional: true });
                break;
            case 'WILD_OR_RESERVE':
                if (this.canteenChoices(playerId).length > 0) this.ask({ kind: 'CANTEEN_CHOICE', playerId });
                break;
            case 'MOUNTAIN_PHOTO':
            case 'FOREST_PHOTO': {
                const action: NfAction = { kind: 'PHOTO', pay: effect === 'MOUNTAIN_PHOTO' ? 'MOUNTAIN' : 'FOREST', times: 1, exact: true };
                if (this.nfLegal(playerId, action, p.tokens)) this.push({ t: 'NF_ACTION', action, source: 'GEAR' });
                break;
            }
            case 'SUN_WATER': this.gainLogged(playerId, { SUNSHINE: 1, WATER: 1 }, 'gained 1 Sunshine and 1 Water from a Canteen'); break;
            case 'WATER2': this.gainLogged(playerId, { WATER: 2 }, 'gained 2 Water from a Canteen'); break;
        }
    }

    public canteenChoices(playerId: string): ('WILD' | 'RESERVE')[] {
        const out: ('WILD' | 'RESERVE')[] = [];
        if (bagTotal(this.data.players[playerId].tokens) >= 1 && this.data.supply.WILDLIFE >= 1) out.push('WILD');
        if (this.canReserve()) out.push('RESERVE');
        return out;
    }

    public canteenWater(playerId: string): number {
        return Math.min(this.data.turn.water, this.data.players[playerId].tokens.WATER);
    }

    private unfilledCanteens(playerId: string): number[] {
        return this.data.players[playerId].canteens.map((c, i) => c.filled ? -1 : i).filter(i => i >= 0);
    }

    private applyExchange(playerId: string, pay: Bag, gain: Bag): void {
        const d = this.data;
        const count = bagTotal(pay);
        if ((count !== 1 && count !== 2) || bagTotal(gain) !== count) throw new Error('Trade 1 or 2 tokens for the same number of tokens');
        if (gain.WILDLIFE) throw new Error('You cannot trade for Wildlife');
        for (const t of TOKENS) {
            if ((pay[t] || 0) > 0 && (gain[t] || 0) > 0) throw new Error('Gained tokens must differ from those turned in');
            if ((gain[t] || 0) > d.supply[t] + (pay[t] || 0)) throw new Error(`Not enough ${TOKEN_NAME[t]} in the supply`);
        }
        this.spend(playerId, pay);
        this.gain(playerId, gain);
        this.logResult(playerId, `traded ${bagText(pay)} for ${bagText(gain)}`, 'traded', [{ kind: 'bag', bag: pay }, LOG_THEN, { kind: 'bag', bag: gain }]);
    }

    private reservePark(playerId: string, source: ReserveSource): void {
        const d = this.data;
        const p = d.players[playerId];
        if (source === 'DECK') {
            if (!d.parksDeck.length) throw new Error('The Parks deck is empty');
            const drawn = d.parksDeck.pop()!;
            p.reserved.push(drawn);
            this.logResult(playerId, `reserved ${PARK_BY_ID[drawn].name} from the deck`, 'reserved', [{ kind: 'park', id: drawn }]);
            this.reserveBonus(playerId);
            return;
        }
        const id = d.parksBoard[source];
        if (!id) throw new Error('That Park is gone');
        const bonus = d.parkBonus[source];
        if (bonus) { d.parkBonus[source] = null; this.bonusToken(playerId, bonus); }
        p.reserved.push(id);
        this.refillPark(source);
        this.logResult(playerId, `reserved ${PARK_BY_ID[id].name}`, 'reserved', [{ kind: 'park', id }]);
        if (bonus) this.logSeasonToken(playerId, bonus);
        this.reserveBonus(playerId);
    }

    /** Season of Rain Checks. */
    private reserveBonus(playerId: string): void {
        const eff = this.season().effect;
        if (eff.kind === 'ON_RESERVE') this.gainSeasonBonus(playerId, eff.bonus);
    }

    /** A Park's bonus token is already out of the supply, so it transfers directly. */
    private bonusToken(playerId: string, token: Sym): void {
        const d = this.data;
        d.players[playerId].tokens[token] += 1;
        if (token === 'WATER') { d.turn.water += 1; d.turn.declined = false; }
    }

    /** Returns the Park visited, which for a blind visit is only known once it's paid for. */
    private visitPark(playerId: string, parkId: string, payment: Bag): string {
        const d = this.data;
        const p = d.players[playerId];
        if (parkId === 'DECK') return this.visitBlind(playerId, payment);
        const slot = d.parksBoard.indexOf(parkId);
        const reservedIdx = p.reserved.indexOf(parkId);
        if (slot < 0 && reservedIdx < 0) throw new Error('That Park is not available to you');
        const reserved = slot < 0;
        const need = this.parkNeed(playerId, PARK_BY_ID[parkId], reserved);
        if (!this.paymentCovers(playerId, need, payment)) throw new Error('That payment does not cover this Park');

        // The bonus token is usable toward this very Park.
        const bonus = slot >= 0 ? d.parkBonus[slot] : null;
        const available = { ...p.tokens };
        if (bonus) available[bonus] += 1;
        for (const t of TOKENS) {
            if ((payment[t] || 0) > available[t]) throw new Error(`Not enough ${TOKEN_NAME[t]}`);
        }

        if (slot >= 0) {
            if (bonus) { d.parkBonus[slot] = null; this.bonusToken(playerId, bonus); }
            this.refillPark(slot);
        } else {
            p.reserved.splice(reservedIdx, 1);
        }
        this.spend(playerId, payment);
        p.visited.push(parkId);
        this.logResult(playerId, `visited ${PARK_BY_ID[parkId].name}`, 'visited', [{ kind: 'park', id: parkId }]);
        if (bonus) this.logSeasonToken(playerId, bonus);
        const eff = this.season().effect;
        if (eff.kind === 'PARK_DISCOUNT' && PARK_BY_ID[parkId].cost[eff.token]) {
            this.logResult(playerId, `saved 1 ${TOKEN_NAME[eff.token]} thanks to the Season`, 'season saved', [{ kind: 'bag', bag: { [eff.token]: 1 } }], true);
        }
        if (eff.kind === 'RESERVED_DISCOUNT' && reserved) {
            const saved: Bag = {};
            eff.tokens.forEach((t) => { if (PARK_BY_ID[parkId].cost[t]) saved[t] = 1; });
            if (bagTotal(saved)) this.logResult(playerId, `saved ${bagText(saved)} thanks to the Season`, 'season saved', [{ kind: 'bag', bag: saved }], true);
        }
        if (reserved) {
            for (const g of this.ownedGear(playerId)) {
                if (g.reservedVisitGain) this.gainLogged(playerId, g.reservedVisitGain, `gained ${bagText(g.reservedVisitGain)} with ${g.name}`, [{ kind: 'gear', id: g.id }]);
            }
        }
        return parkId;
    }

    /** Season of Chance: pay the fixed price, then turn the top card over; it's yours. */
    private visitBlind(playerId: string, payment: Bag): string {
        const d = this.data;
        const p = d.players[playerId];
        const need = this.blindVisitNeed();
        if (!need) throw new Error('Only the Season of Chance lets you visit the deck');
        if (!d.parksDeck.length) throw new Error('The Parks deck is empty');
        if (!this.paymentCovers(playerId, need, payment)) throw new Error('That payment does not cover the top card');
        for (const t of TOKENS) {
            if ((payment[t] || 0) > p.tokens[t]) throw new Error(`Not enough ${TOKEN_NAME[t]}`);
        }
        this.spend(playerId, payment);
        const parkId = d.parksDeck.pop()!;
        p.visited.push(parkId);
        this.logResult(playerId, `visited ${PARK_BY_ID[parkId].name} from the top of the deck`, 'visited', [{ kind: 'bag', bag: payment }, LOG_THEN, { kind: 'park', id: parkId }]);
        return parkId;
    }

    private buyGear(playerId: string, slot: number | 'DECK', slotDiscount: number): void {
        const d = this.data;
        const p = d.players[playerId];
        const eff = this.season().effect;
        let gearId: string;
        if (slot === 'DECK') {
            if (eff.kind !== 'GEAR_FLAT') throw new Error('Only the Season of Clouds lets you buy from the deck');
            if (!d.gearDeck.length) throw new Error('The Gear deck is empty');
            this.spend(playerId, { SUNSHINE: this.gearPrice(playerId, null, slotDiscount) });
            gearId = d.gearDeck.pop()!;
        } else {
            const stack = d.gearBoard[slot];
            if (!stack || !stack.length) throw new Error('No Gear in that slot');
            gearId = stack[stack.length - 1];
            this.spend(playerId, { SUNSHINE: this.gearPrice(playerId, gearId, slotDiscount) });
            stack.pop();
            if (!d.solo) this.refillGear(slot);
        }
        p.gear.push(gearId);
        const g = GEAR_BY_ID[gearId];
        this.logResult(playerId, `bought ${g.name}${slot === 'DECK' ? ' from the top of the deck' : ''}`, 'bought', [{ kind: 'gear', id: gearId }]);
        const sun: LogItem[] = [{ kind: 'bag', bag: { SUNSHINE: 1 } }];
        if (eff.kind !== 'GEAR_FLAT') {
            if (slotDiscount > 0 && g.cost > 0) this.logResult(playerId, 'saved 1 Sunshine by arriving first', 'first saved', sun, true);
            if (eff.kind === 'GEAR_DISCOUNT' && g.cost - slotDiscount > 0) this.logResult(playerId, 'saved 1 Sunshine thanks to the Season', 'season saved', sun, true);
        }
        if (slot !== 'DECK') this.gearSlotBonus(playerId, slot);
        // Season of Wonder: asked after the Gear's own effect
        if (eff.kind === 'ON_BUY_WILD' && bagTotal(p.tokens) >= 1 && d.supply.WILDLIFE >= 1) {
            this.push(this.whenUseful({ t: 'PROMPT', prompt: { kind: 'PAY', playerId, count: 1, purpose: 'WILD', optional: true } }));
        }
        this.gearInstant(playerId, g);
    }

    /** Season of Heights: the token on a Gear slot goes with the card taken from it. */
    private gearSlotBonus(playerId: string, slot: number): void {
        const wl = this.data.wildlife;
        const tok = wl ? wl.gearBonus[slot] : null;
        if (!wl || !tok) return;
        wl.gearBonus[slot] = null;
        this.bonusToken(playerId, tok);
        this.logSeasonToken(playerId, tok);
    }

    /** A Gear card's one-time effect, the moment it is gained. */
    private gearInstant(playerId: string, g: GearCard): void {
        const d = this.data;
        const p = d.players[playerId];
        if (g.instant === 'CANTEEN') {
            this.drawCanteen(playerId);
        } else if (g.instant === 'PHOTO' && d.photos > 0 && bagTotal(p.tokens) >= this.photoCost(playerId)) {
            this.askPay(playerId, this.photoCost(playerId), 'LENS', true);
        } else if (g.instant === 'GEAR_TOP' && d.gearDeck.length) {
            this.takeGear(playerId, 'DECK');
        }
    }

    // -----------------------------------------------------------------------
    // Task runner
    // -----------------------------------------------------------------------

    private run(): void {
        const d = this.data;
        while (!d.prompt && d.tasks.length) {
            this.exec(d.tasks.pop()!);
        }
    }

    private exec(task: Task): void {
        const d = this.data;
        const pid = d.current;
        switch (task.t) {
            case 'SITE': return this.execSite(pid, task.site, task.direct);
            case 'TRIGGERS': return this.execTriggers(pid, task.site);
            case 'WINDOW': {
                if (task.fresh) d.turn.declined = false;
                if (!d.turn.declined && this.canteenWater(pid) > 0 && this.unfilledCanteens(pid).length > 0) {
                    this.ask({ kind: 'CANTEEN', playerId: pid, free: false });
                }
                return;
            }
            case 'AREA': return this.execArea(pid, task.area, task.discount);
            case 'PROMPT': return this.ask(task.prompt);
            case 'PARK_PASS': {
                const hasPass = this.ownedGear(pid).some(g => g.parkPass);
                if (hasPass && this.canVisitAny(pid)) this.ask({ kind: 'VISIT', playerId: pid, extra: true });
                return;
            }
            case 'TURN_END': return this.execTurnEnd(pid);
            case 'SEASON_FINISH': return this.finishSeason();
            case 'NF_ACTION': return this.execNf(pid, task.action, task.source);
            case 'CHECKED': if (this.stillUseful(task.task)) this.exec(task.task); return;
        }
    }

    private stillUseful(task: Task): boolean {
        const d = this.data;
        // an NF_ACTION checks itself when it runs
        if (task.t !== 'PROMPT') return true;
        const pr = task.prompt;
        const p = d.players[pr.playerId];
        switch (pr.kind) {
            case 'CANTEEN': return this.unfilledCanteens(pr.playerId).length > 0 && d.supply.WATER > 0;
            case 'PAY':
                if (pr.purpose === 'WILD') return bagTotal(p.tokens) >= pr.count && d.supply.WILDLIFE > 0;
                return bagTotal(p.tokens) >= pr.count && d.photos > 0;
            case 'SHUTTER': return d.photos > 0 && p.tokens.WILDLIFE > 0;
            default: return true;
        }
    }

    private execSite(pid: string, site: SiteId, direct: boolean): void {
        const d = this.data;
        const p = d.players[pid];
        const def = SITES[site];
        if (def.gain) {
            if (direct && this.replacements(pid, site).length > 0) {
                this.ask({ kind: 'SITE_GAIN', playerId: pid, site });
                return;
            }
            this.gainLogged(pid, def.gain, `gained ${bagText(def.gain)} at the ${def.name}`);
            return;
        }
        switch (site) {
            case 'VISTA': {
                const canPhoto = d.photos > 0 && bagTotal(p.tokens) >= this.photoCost(pid);
                const canCanteen = d.canteenDeck.length > 0;
                if (canPhoto && canCanteen) this.ask({ kind: 'VISTA', playerId: pid });
                else if (canCanteen) this.drawCanteen(pid);
                else if (canPhoto) this.askPay(pid, this.photoCost(pid), 'VISTA', false);
                return;
            }
            case 'WILDLIFE':
                if (bagTotal(p.tokens) >= 1 && d.supply.WILDLIFE >= 1) this.askPay(pid, 1, 'WILD', false);
                return;
            case 'LODGE':
                if (this.canExchange(p.tokens)) this.ask({ kind: 'EXCHANGE', playerId: pid, optional: false });
                return;
            case 'LOOKOUT': {
                const options = this.lookoutOptions(pid);
                if (options.length === 1) this.chooseLookout(pid, options[0]);
                else if (options.length > 1) this.ask({ kind: 'LOOKOUT', playerId: pid });
                return;
            }
            case 'RIVER': {
                if (p.tokens.WATER < 1 || this.riverTargets(pid, p.tokens).length === 0) return;
                this.ask({ kind: 'RIVER', playerId: pid });
                return;
            }
            case 'LAKE': {
                const filled = this.filledCanteens(pid);
                const effects = new Set(filled.map(i => CANTEEN_BY_ID[p.canteens[i].id].effect));
                if (effects.size === 1) this.reuseCanteen(pid, filled[0]);
                else if (effects.size > 1) this.ask({ kind: 'LAKE', playerId: pid });
                return;
            }
            case 'PARKWAY': {
                const targets = this.parkwayTargets(pid, p.tokens);
                if (!targets.length) return;
                for (const id of this.playerIds) {
                    if (id !== pid && this.give(id, 'SUNSHINE', 1)) this.logResult(id, 'gained 1 Sunshine from the Parkway', 'gained', [{ kind: 'bag', bag: { SUNSHINE: 1 } }]);
                }
                if (targets.length === 1) this.parkwayTo(pid, targets[0]);
                else this.ask({ kind: 'PARKWAY', playerId: pid });
                return;
            }
            case 'SUMMIT':
                if (p.photos > 0 && SYMS.some(s => d.supply[s] > 0)) this.ask({ kind: 'SUMMIT', playerId: pid });
                return;
            case 'CANYON':
                if (p.tokens.WILDLIFE < 1) return;
                this.spend(pid, { WILDLIFE: 1 });
                this.logResult(pid, 'turned in a Wildlife at the Canyon', 'paid', [{ kind: 'bag', bag: { WILDLIFE: 1 } }]);
                this.gainLogged(pid, { SUNSHINE: 2, WATER: 2 }, 'gained 2 Sunshine and 2 Water at the Canyon');
                return;
        }
    }

    /** Lake: a filled Canteen's reward, once more. It stays filled. */
    private reuseCanteen(pid: string, index: number): void {
        const c = this.data.players[pid].canteens[index];
        if (!c || !c.filled) throw new Error('Choose one of your filled Canteens');
        this.logResult(pid, 'drank from a Canteen at the Lake', 'reused', [{ kind: 'canteen', id: c.id, filled: true }]);
        this.resolveCanteen(pid, CANTEEN_BY_ID[c.id].effect);
    }

    private parkwayTo(pid: string, slot: number): void {
        const site = this.data.trail[slot - 1];
        this.logResult(pid, `drove the Parkway to the ${SITES[site].name}`, 'copied', [LOG_THEN, { kind: 'site', site }]);
        this.push({ t: 'SITE', site, direct: false });
    }

    public lookoutOptions(pid: string): Area[] {
        const out: Area[] = [];
        if (this.canReserve()) out.push('RESERVE');
        if (this.canVisitAny(pid)) out.push('VISIT');
        if (this.canBuyAny(pid, 0)) out.push('GEAR');
        return out;
    }

    private chooseLookout(pid: string, area: Area): void {
        this.push({ t: 'AREA', area, discount: 0 });
    }

    private execTriggers(pid: string, site: SiteId): void {
        const d = this.data;
        // Pushed one at a time so each Gear gets its own decision, in card order.
        const gear = this.ownedGear(pid).filter(g => g.onVisit && g.onVisit.site === site);
        const tasks: Task[] = [];
        for (const g of gear) {
            if (g.onVisit!.effect === 'FILL') {
                if (this.unfilledCanteens(pid).length > 0 && d.supply.WATER > 0) {
                    tasks.push({ t: 'PROMPT', prompt: { kind: 'CANTEEN', playerId: pid, free: true } });
                }
            } else if (g.onVisit!.effect === 'WILD') {
                // Hiking Poles: decided once the first Wildlife is paid for
                tasks.push(this.whenUseful({ t: 'PROMPT', prompt: { kind: 'PAY', playerId: pid, count: 1, purpose: 'WILD', optional: true } }));
            } else if (d.photos > 0 && bagTotal(d.players[pid].tokens) >= this.photoCost(pid)) {
                tasks.push({ t: 'PROMPT', prompt: { kind: 'PAY', playerId: pid, count: this.photoCost(pid), purpose: 'LENS', optional: true } });
            }
        }
        this.push(...tasks);
    }

    /**
     * Spending a Campfire: Wildlife Gear and Seasons may add to it. `slot` is the Site it was spent at.
     * Everything here is pushed, so it runs after whatever the move itself asks first.
     */
    private campfireSpent(pid: string, hiker: number, slot: number): void {
        const d = this.data;
        const p = d.players[pid];
        const eff = this.season().effect;
        const tasks: Task[] = [];
        if (eff.kind === 'CAMPFIRE_SELF_PHOTO' && p.hikers[1 - hiker] === slot) {
            tasks.push({ t: 'PROMPT', prompt: { kind: 'PAY', playerId: pid, count: 1, purpose: 'SNAP', optional: true } });
        }
        if (eff.kind === 'CAMPFIRE_SHARE') {
            const here = this.playerIds.filter(id => d.players[id].hikers.includes(slot));
            for (const id of here) {
                if (this.give(id, eff.bonus, 1)) this.logResult(id, `gained ${TOKEN_NAME[eff.bonus]} from the Season`, 'season', [{ kind: 'bag', bag: { [eff.bonus]: 1 } }], true);
            }
        }
        for (const g of this.ownedGear(pid)) {
            const c = g.onCampfire;
            if (!c) continue;
            if (c.kind === 'FILL') tasks.push({ t: 'PROMPT', prompt: { kind: 'CANTEEN', playerId: pid, free: true } });
            else if (c.kind === 'PHOTO') tasks.push({ t: 'NF_ACTION', action: { kind: 'PHOTO', pay: c.pay, times: 1, exact: true }, source: 'GEAR' });
            else tasks.push({ t: 'NF_ACTION', action: { kind: 'TRADE', pay: c.pay, gain: { WILDLIFE: 1 }, times: 1 }, source: 'GEAR' });
        }
        this.push(...tasks.map(t => this.whenUseful(t)));
    }

    /** Wrap a pushed decision so it's only asked if it can still be taken when its turn comes. */
    private whenUseful(t: Task): Task {
        return { t: 'CHECKED', task: t };
    }

    private execArea(pid: string, area: Area, discount: number): void {
        switch (area) {
            case 'RESERVE':
                if (this.canReserve()) this.ask({ kind: 'RESERVE', playerId: pid });
                return;
            case 'GEAR':
                if (this.canBuyAny(pid, discount)) this.ask({ kind: 'BUY', playerId: pid, discount });
                return;
            case 'VISIT':
                if (this.canVisitAny(pid)) this.ask({ kind: 'VISIT', playerId: pid, extra: false });
                return;
        }
    }

    private execTurnEnd(pid: string): void {
        const p = this.data.players[pid];
        const over = bagTotal(p.tokens) - TOKEN_LIMIT;
        if (over > 0) {
            this.push({ t: 'TURN_END' });
            this.ask({ kind: 'DISCARD', playerId: pid, count: over });
            return;
        }
        this.endTurn();
    }

    private endTurn(): void {
        const d = this.data;
        this.resetTurn();
        this.closeLogRow();

        if (d.solo) {
            const you = d.players[d.current];
            if (you.hikers.every(h => h === END)) {
                // Rangers are pulled home without taking their slots.
                d.solo.rangers = [END, END];
                this.startSeasonEnd();
                return;
            }
            this.rangerTurn();
            return;
        }

        if (this.hikersOnTrail() === 0) {
            this.startSeasonEnd();
            return;
        }
        const n = this.playerIds.length;
        let idx = this.playerIds.indexOf(d.current);
        for (let step = 0; step < n; step++) {
            idx = (idx + 1) % n;
            const id = this.playerIds[idx];
            if (d.players[id].hikers.some(h => h !== END)) { d.current = id; return; }
        }
    }

    // -----------------------------------------------------------------------
    // Player actions
    // -----------------------------------------------------------------------

    public pick_year(playerId: string, yearId: string): void {
        const d = this.data;
        if (d.phase !== Phase.Year) throw new Error('Year cards have been chosen');
        const p = d.players[playerId];
        if (!p) throw new Error('Unknown player');
        if (!p.yearOptions.includes(yearId)) throw new Error('That Year card was not dealt to you');
        const nf = this.nf();
        if (nf) {
            if (p.year) throw new Error('You have already chosen');
            // Nightfall Year cards always go back face down, to the bottom
            p.yearOptions.filter(y => y !== yearId).forEach(y => nf.yearDeck.unshift(y));
        }
        p.year = yearId;
        if (this.playerIds.every(id => d.players[id].year)) d.phase = Phase.Play;
    }

    /** All-or-nothing: an illegal answer must leave a half-run turn untouched. */
    private atomic(fn: () => void): void {
        const snapshot = JSON.parse(JSON.stringify(this.data));
        try {
            fn();
        } catch (e) {
            Object.assign(this.data, snapshot);
            throw e;
        }
    }

    private assertTurn(playerId: string): void {
        const d = this.data;
        if (d.phase !== Phase.Play) throw new Error('The game is not in play');
        if (d.prompt) throw new Error('Finish the current decision first');
        if (d.current !== playerId) throw new Error('It is not your turn');
    }

    /** Move a Hiker to a Site, by slot number. */
    public move_to_site(playerId: string, hiker: number, slot: number): void {
        this.atomic(() => this.moveToSite(playerId, hiker, slot));
    }

    private moveToSite(playerId: string, hiker: number, slot: number): void {
        this.assertTurn(playerId);
        const d = this.data;
        const p = d.players[playerId];
        if (p.hikers[hiker] === undefined) throw new Error('No such Hiker');
        if (p.hikers[hiker] === END) throw new Error('That Hiker has finished the Trail');
        if (slot <= p.hikers[hiker] || slot > d.trail.length) throw new Error('Hikers only move forward along the Trail');
        const info = this.destInfo(playerId, hiker, slot, this.forcedEnd());
        if (!info.ok) throw new Error(info.reason || 'You cannot move there');

        if (info.campfire) p.campfireLit = false;
        p.hikers[hiker] = slot;
        const site = d.trail[slot - 1];
        this.logMove(playerId, `hiked to the ${SITES[site].name}`, [LOG_THEN, { kind: 'site', site }]);
        if (info.campfire) this.logResult(playerId, `used their Campfire to reach the ${SITES[site].name}`, 'used', [logIcon('campfire')]);

        this.push({ t: 'TURN_END' });
        // pushed first, so they come after the Site
        if (info.campfire) this.campfireSpent(playerId, hiker, slot);
        if (info.camp) this.ask({ kind: 'CAMP', playerId, slot });
        else this.arrive(playerId, slot);
        this.run();
    }

    /** Take the Site as usual: its Weather, its action, then Gear triggers and the Canteen window. */
    private arrive(playerId: string, slot: number): void {
        const d = this.data;
        const site = d.trail[slot - 1];
        const w = d.weather[slot - 1];
        if (w) {
            d.weather[slot - 1] = null;
            this.bonusToken(playerId, w);
            this.logResult(playerId, `was first to the ${SITES[site].name} and took its ${TOKEN_NAME[w]}`, 'first', [{ kind: 'bag', bag: { [w]: 1 } }], true);
        }
        const tasks: Task[] = [];
        if (w === 'WATER') tasks.push({ t: 'WINDOW' });
        tasks.push(
            { t: 'SITE', site, direct: true },
            { t: 'TRIGGERS', site },
            { t: 'WINDOW', fresh: true }
        );
        this.push(...tasks);
    }

    /** Move a Hiker to Trail End and take one of its three actions. */
    public move_to_end(playerId: string, hiker: number, area: Area): void {
        this.atomic(() => this.moveToEnd(playerId, hiker, area));
    }

    private moveToEnd(playerId: string, hiker: number, area: Area): void {
        this.assertTurn(playerId);
        const d = this.data;
        const p = d.players[playerId];
        if (p.hikers[hiker] === undefined) throw new Error('No such Hiker');
        if (p.hikers[hiker] === END) throw new Error('That Hiker has finished the Trail');
        if (!AREAS.includes(area)) throw new Error('Unknown Trail End area');
        if (area === 'RESERVE' && d.trailEnd.reserveBlocked) throw new Error('A Ranger has closed the Reserve area');

        const discount = area === 'GEAR' ? this.gearDiscountFor() : 0;
        this.logMove(playerId, 'reached Trail End', [LOG_THEN, { kind: 'area', area }]);
        p.hikers[hiker] = END;
        p.campfireLit = true;

        const key = area === 'RESERVE' ? 'reserve' : area === 'GEAR' ? 'gear' : 'visit';
        d.trailEnd[key].push(playerId);
        // Season of Breeze: the first Hiker to an area takes its token
        const wl = d.wildlife;
        const waiting = wl ? wl.endBonus[area] : null;
        if (wl && waiting) {
            wl.endBonus[area] = null;
            this.bonusToken(playerId, waiting);
            this.logSeasonToken(playerId, waiting);
        }
        if (area === 'RESERVE' && d.trailEnd.firstSlot === null) {
            d.trailEnd.firstSlot = playerId;
            d.firstHikerOwner = playerId;
            this.logResult(playerId, 'took the First Hiker Marker', 'first', [logIcon('marker')], true);
        }

        // Solo, both Rangers home: everyone left arrives together, one action only.
        if (d.solo && d.solo.rangers.every(r => r === END)) p.hikers = [END, END];

        this.push(
            { t: 'AREA', area, discount },
            { t: 'WINDOW', fresh: true },
            { t: 'TURN_END' }
        );
        this.run();
    }

    /** Tent: stay put, spend the Campfire, take the current Site's action again. */
    public tent_revisit(playerId: string, hiker: number): void {
        this.atomic(() => this.tentRevisit(playerId, hiker));
    }

    private tentRevisit(playerId: string, hiker: number): void {
        this.assertTurn(playerId);
        const d = this.data;
        const p = d.players[playerId];
        const options = this.moveOptions(playerId);
        if (!options.hikers[hiker] || !options.hikers[hiker].tent) throw new Error('You cannot use the Tent here');
        p.campfireLit = false;
        const site = d.trail[p.hikers[hiker] - 1];
        this.logMove(playerId, `camped at the ${SITES[site].name}`, [logIcon('campfire'), { kind: 'site', site }]);
        this.push({ t: 'TURN_END' });
        this.campfireSpent(playerId, hiker, p.hikers[hiker]);
        this.push(
            { t: 'SITE', site, direct: true },
            { t: 'TRIGGERS', site },
            { t: 'WINDOW', fresh: true }
        );
        this.run();
    }

    /** The answer to the pending prompt. `answer` is shaped by the prompt's kind. */
    public respond(playerId: string, answer: any): void {
        this.atomic(() => this.answerPrompt(playerId, answer || {}));
    }

    private answerPrompt(playerId: string, a: any): void {
        const d = this.data;
        const prompt = d.prompt;
        if (!prompt) throw new Error('Nothing to answer');
        if (prompt.playerId !== playerId) throw new Error('This decision belongs to another player');
        const skip = a.skip === true;
        d.prompt = null;

        switch (prompt.kind) {
            case 'CANTEEN': {
                if (skip) {
                    if (!prompt.free) d.turn.declined = true;
                } else {
                    if (!prompt.free) this.push({ t: 'WINDOW' });
                    const canteen = d.players[playerId].canteens[Number(a.index)];
                    if (canteen) this.logResult(playerId, 'filled a Canteen', 'filled', [{ kind: 'canteen', id: canteen.id, filled: true }]);
                    this.fillCanteen(playerId, Number(a.index), prompt.free);
                }
                break;
            }
            case 'SITE_GAIN': {
                const def = SITES[prompt.site];
                if (a.gearId) {
                    const g = this.replacements(playerId, prompt.site).find(x => x.id === a.gearId);
                    if (!g) throw new Error('You cannot use that Gear here');
                    this.gainLogged(playerId, g.replace!.gain, `gained ${bagText(g.replace!.gain)} with ${g.name}`, [{ kind: 'gear', id: g.id }]);
                } else {
                    if (!this.supplyHas(def.gain!)) throw new Error('The supply has run out');
                    this.gainLogged(playerId, def.gain!, `gained ${bagText(def.gain!)} at the ${def.name}`);
                }
                break;
            }
            case 'VISTA': {
                if (a.choice === 'PHOTO') {
                    this.askPay(playerId, this.photoCost(playerId), 'VISTA', false);
                } else {
                    this.drawCanteen(playerId);
                }
                break;
            }
            case 'LOOKOUT': {
                if (!this.lookoutOptions(playerId).includes(a.choice)) throw new Error('You cannot do that at the Lookout');
                this.chooseLookout(playerId, a.choice);
                break;
            }
            case 'CANTEEN_CHOICE': {
                if (skip) break;
                if (a.choice === 'WILD') this.askPay(playerId, 1, 'WILD', false);
                else if (a.choice === 'RESERVE') this.ask({ kind: 'RESERVE', playerId });
                else throw new Error('Choose Wildlife or Reserve');
                break;
            }
            case 'RIVER': {
                const slot = Number(a.slot);
                if (!this.riverTargets(playerId, d.players[playerId].tokens).includes(slot)) throw new Error('You cannot copy that Site');
                this.spend(playerId, { WATER: 1 });
                const site = d.trail[slot - 1];
                this.logResult(playerId, `followed the River to the ${SITES[site].name}`, 'copied', [{ kind: 'bag', bag: { WATER: 1 } }, LOG_THEN, { kind: 'site', site }]);
                this.push({ t: 'SITE', site, direct: false });
                break;
            }
            case 'PAY': {
                if (skip) {
                    if (!prompt.optional) throw new Error('This payment is required');
                    break;
                }
                const pay: Bag = a.pay || {};
                if (bagTotal(pay) !== prompt.count) throw new Error(`Pay exactly ${prompt.count} token${prompt.count === 1 ? '' : 's'}`);
                this.applyPay(playerId, pay, prompt.purpose);
                break;
            }
            case 'EXCHANGE': {
                if (skip) {
                    if (!prompt.optional) throw new Error('The Lodge trade is required');
                    break;
                }
                this.applyExchange(playerId, a.pay || {}, a.gain || {});
                break;
            }
            case 'RESERVE': {
                if (skip) break;
                const source: ReserveSource = a.source === 'DECK' ? 'DECK' : Number(a.source) as 0 | 1 | 2;
                this.reservePark(playerId, source);
                break;
            }
            case 'VISIT': {
                if (skip) break;
                const visited = this.visitPark(playerId, a.parkId, a.payment || {});
                const after: Task[] = [];
                // visit first, then the Park's Instant Action
                const instant = PARK_BY_ID[visited].instant;
                if (instant) after.push({ t: 'NF_ACTION', action: instant, source: 'PARK' });
                if (!prompt.extra) after.push({ t: 'PARK_PASS' });
                this.push(...after);
                break;
            }
            case 'BUY': {
                if (skip) break;
                this.buyGear(playerId, a.slot === 'DECK' ? 'DECK' : Number(a.slot), prompt.discount);
                break;
            }
            case 'DISCARD': {
                const bag: Bag = a.discard || {};
                if (bagTotal(bag) !== prompt.count) throw new Error(`Discard exactly ${prompt.count}`);
                this.spend(playerId, bag);
                this.logResult(playerId, `discarded down to ${TOKEN_LIMIT} tokens`, 'discarded', [{ kind: 'bag', bag }]);
                break;
            }
            case 'CAMP': {
                if (!prompt.slot && skip) break;
                if (a.choice === 'SITE') {
                    if (!prompt.slot) throw new Error('There is no Site here');
                    if (!this.siteActionOk(playerId, prompt.slot)) throw new Error('You cannot take this Site’s action');
                    this.arrive(playerId, prompt.slot);
                    break;
                }
                const spot: CampSpot = a.choice === 'BOARD' ? 'BOARD' : Number(a.choice);
                const opt = this.campOptions(playerId).find(o => o.spot === spot);
                if (!opt) throw new Error('That Campsite is not available');
                this.takeCamp(playerId, prompt.slot, opt);
                break;
            }
            case 'NF_PAY': {
                if (skip) {
                    if (!prompt.optional) throw new Error('Turn in at least one token here');
                    break;
                }
                this.applyNfPay(playerId, prompt, a.token);
                break;
            }
            case 'NF_SWAP': {
                this.applySwap(playerId, a.discard || {}, a.take);
                break;
            }
            case 'NF_GEAR_PICK': {
                if (skip) break;
                this.takeGear(playerId, a.take === 'DECK' ? 'DECK' : Number(a.take));
                break;
            }
            case 'NF_YEAR_RETURN': {
                this.returnYear(playerId, String(a.yearId));
                this.logResult(playerId, 'returned a Year card', 'returned', [logIcon('year_glyph')]);
                break;
            }
            case 'RANGER_CAMP': {
                if (a.choice === 'CAMP') this.rangerTakesCamp(prompt.slot);
                else if (a.choice === 'WEATHER') this.rangerWeather(prompt.ranger, prompt.slot);
                else throw new Error('Choose the Weather or the Tent');
                break;
            }
            case 'SHUTTER': {
                const n = skip ? 0 : Number(a.swap || 0);
                if (!(n >= 0 && n <= prompt.count)) throw new Error(`Swap 0 to ${prompt.count}`);
                const p = d.players[playerId];
                if (n > p.tokens.WILDLIFE || n > d.photos) throw new Error('Not that many to swap');
                for (let i = 0; i < n; i++) {
                    this.spend(playerId, { WILDLIFE: 1 });
                    this.takePhoto(playerId);
                }
                if (n) this.logResult(playerId, `swapped ${n} Wildlife for ${n === 1 ? 'a Photo' : `${n} Photos`}`, 'swapped', [{ kind: 'bag', bag: { WILDLIFE: n } }, LOG_THEN, logIcon('photo')]);
                break;
            }
            case 'LAKE':
                this.reuseCanteen(playerId, Number(a.index));
                break;
            case 'PARKWAY': {
                const slot = Number(a.slot);
                if (!this.parkwayTargets(playerId, d.players[playerId].tokens).includes(slot)) throw new Error('You cannot take that Site from the Parkway');
                this.parkwayTo(playerId, slot);
                break;
            }
            case 'SUMMIT': {
                const t = a.token as Sym;
                if (!SYMS.includes(t) || d.supply[t] < 1) throw new Error('Choose a token the supply still has');
                const p = d.players[playerId];
                if (p.photos < 1) throw new Error('You have no Photo to turn in');
                p.photos -= 1;
                d.photos += 1;
                this.logResult(playerId, 'turned in a Photo at the Summit', 'paid', [logIcon('photo')]);
                this.gainLogged(playerId, { [t]: 1 }, `gained 1 ${TOKEN_NAME[t]} at the Summit`);
                break;
            }
        }
        this.run();
    }

    // -----------------------------------------------------------------------
    // Nightfall: Campsites and Instant Actions
    // -----------------------------------------------------------------------

    private nf(): NightfallState | null { return this.data.nightfall || null; }

    public isNightfall(): boolean { return !!this.data.nightfall; }

    public nfModules(): NfModules {
        const nf = this.nf();
        return nf ? (nf.modules || { ...NF_ALL }) : nfModulesOf(false);
    }

    public nfHas(m: keyof NfModules): boolean { return this.nfModules()[m]; }

    private campHere(slot: number): boolean {
        const nf = this.nf();
        return !!nf && !!nf.camps[slot - 1];
    }

    /** Tokens that may be turned in for a TRADE or PHOTO: its symbol or Wildlife, any token for a Photo with the Camera. */
    public nfPayTokens(playerId: string, a: NfAction): Token[] {
        if (a.kind !== 'TRADE' && a.kind !== 'PHOTO') return [];
        const held = this.data.players[playerId].tokens;
        const ok: Token[] = a.kind === 'PHOTO' && !a.exact && this.hasCamera(playerId) ? TOKENS : [a.pay, 'WILDLIFE'];
        return ok.filter(t => held[t] > 0);
    }

    /** Face-up Gear anyone could take: the top of each slot. */
    public gearOnBoard(): { slot: number; gearId: string }[] {
        return this.data.gearBoard
            .map((stack, slot) => ({ slot, gearId: stack[stack.length - 1] }))
            .filter(g => !!g.gearId);
    }

    public nfLegal(playerId: string, a: NfAction, held: Record<Token, number>): boolean {
        const d = this.data;
        const p = d.players[playerId];
        const nf = this.nf();
        switch (a.kind) {
            case 'TRADE': return (held[a.pay] > 0 || held.WILDLIFE > 0) && TOKENS.some(t => (a.gain[t] || 0) > 0 && d.supply[t] > 0);
            case 'PHOTO': return d.photos > 0 && (this.hasCamera(playerId) && !a.exact ? bagTotal(held) > 0 : held[a.pay] > 0 || held.WILDLIFE > 0);
            case 'GAIN': return true;
            case 'RESERVE': return this.canReserve();
            case 'CANTEEN_WATER': return d.canteenDeck.length > 0 || d.supply.WATER > 0;
            case 'DRAIN_CANTEENS': return p.canteens.some(c => c.filled) || d.supply.WATER > 0;
            case 'SWAP_CARD':
                return (p.gear.length > 0 || this.yearsOf(playerId).length > 0)
                    && ((nf ? nf.yearDeck.length : 0) > 0 || d.gearDeck.length > 0 || this.gearOnBoard().length > 0);
            case 'GEAR_REFRESH': return held.SUNSHINE + held.WILDLIFE >= GEAR_REFRESH_COST && (d.gearDeck.length > 0 || this.gearOnBoard().length > 0);
            case 'RESERVE_RELIGHT': return true;
            case 'YEAR_DRAW': return held.SUNSHINE + held.WILDLIFE >= YEAR_DRAW_COST && !!nf && nf.yearDeck.length > 0;
            case 'CAMERA': return d.cameraOwner !== playerId;
            case 'YEAR_CARD': return !!nf && nf.yearDeck.length > 0;
            case 'GEAR_CARD': return d.gearDeck.length > 0 || this.gearOnBoard().length > 0;
            case 'CAMP': return this.campOptions(playerId).length > 0;
        }
    }

    /** Campsites this player could pitch a Tent at right now. A Campsite holds one Tent a Season. */
    public campOptions(playerId: string): CampOption[] {
        const nf = this.nf();
        if (!nf) return [];
        const held = this.data.players[playerId].tokens;
        const out: CampOption[] = [];
        if (nf.boardTaken < nf.boardSlots && this.nfLegal(playerId, CAMPSITE_BOARD_ACTION, held)) {
            out.push({ spot: 'BOARD', action: CAMPSITE_BOARD_ACTION });
        }
        nf.campsites.forEach((c, i) => {
            const action = campsideFor(CAMPSITE_BY_ID[c.tile], this.data.season).action;
            if (!c.taken && this.nfLegal(playerId, action, held)) out.push({ spot: i, action });
        });
        return out;
    }

    private campItem(spot: CampSpot): LogItem {
        const nf = this.nf()!;
        return { kind: 'campsite', spot, tile: spot === 'BOARD' ? null : nf.campsites[spot].tile, season: this.data.season };
    }

    /**
     * Move the Tent to a Campsite and take its action; no Weather, but Gear for this Site still fires.
     * Slot 0 is a Park's Instant Action: a Tent from the box, no Site involved.
     */
    private takeCamp(playerId: string, slot: number, opt: CampOption): void {
        const nf = this.nf()!;
        if (opt.spot === 'BOARD') nf.boardTaken += 1;
        else nf.campsites[opt.spot].taken = true;
        if (!slot) {
            this.logResult(playerId, 'pitched a Tent', 'camped', [logIcon('tent'), this.campItem(opt.spot)]);
            this.push({ t: 'NF_ACTION', action: opt.action, source: 'CAMP' });
            return;
        }
        nf.camps[slot - 1] = false;
        const site = this.data.trail[slot - 1];
        this.logResult(playerId, `camped by the ${SITES[site].name}`, 'camped', [logIcon('tent'), this.campItem(opt.spot)]);
        this.push(
            { t: 'NF_ACTION', action: opt.action, source: 'CAMP' },
            { t: 'TRIGGERS', site },
            { t: 'WINDOW', fresh: true }
        );
    }

    /** Sunshine first, Wildlife for the rest. */
    private paySunshine(playerId: string, n: number, text: string): void {
        const held = this.data.players[playerId].tokens;
        const sun = Math.min(n, held.SUNSHINE);
        const bag: Bag = sun === n ? { SUNSHINE: n } : sun > 0 ? { SUNSHINE: sun, WILDLIFE: n - sun } : { WILDLIFE: n };
        this.spend(playerId, bag);
        this.logResult(playerId, `paid ${bagText(bag)} and ${text}`, 'paid', [{ kind: 'bag', bag }]);
    }

    private execNf(pid: string, a: NfAction, source: 'CAMP' | 'PARK' | 'GEAR'): void {
        const d = this.data;
        const p = d.players[pid];
        switch (a.kind) {
            case 'TRADE':
            case 'PHOTO':
                // a Campsite chosen must be used at least once; a Park's action may be passed up
                if (this.nfLegal(pid, a, p.tokens)) this.ask({ kind: 'NF_PAY', playerId: pid, action: a, left: a.times, optional: source !== 'CAMP' });
                return;
            case 'GAIN':
                this.gainLogged(pid, a.gain, `gained ${bagText(a.gain)}`, [logIcon('bolt')]);
                return;
            case 'RESERVE':
                if (this.canReserve()) this.ask({ kind: 'RESERVE', playerId: pid });
                return;
            case 'CANTEEN_WATER':
                this.drawCanteen(pid);
                this.gainLogged(pid, { WATER: 1 }, 'gained 1 Water at camp');
                return;
            case 'DRAIN_CANTEENS': {
                let poured = 0;
                for (const c of p.canteens) {
                    if (c.filled) { c.filled = false; p.tokens.WATER += 1; poured += 1; }
                }
                if (poured) this.logResult(pid, `poured ${poured} Water out of their Canteens`, 'poured', [logIcon('canteen_full'), LOG_THEN, { kind: 'bag', bag: { WATER: poured } }]);
                this.gainLogged(pid, { WATER: 1 }, 'gained 1 Water at camp');
                return;
            }
            case 'SWAP_CARD':
                if (this.nfLegal(pid, a, p.tokens)) this.ask({ kind: 'NF_SWAP', playerId: pid });
                return;
            case 'GEAR_REFRESH':
                if (!this.nfLegal(pid, a, p.tokens)) return;
                this.paySunshine(pid, GEAR_REFRESH_COST, 'dealt fresh Gear');
                this.refreshGearBoard();
                if (this.gearOnBoard().length || d.gearDeck.length) this.ask({ kind: 'NF_GEAR_PICK', playerId: pid, fresh: true });
                return;
            case 'RESERVE_RELIGHT':
                this.gainLogged(pid, { [a.gain]: 1 }, `gained 1 ${TOKEN_NAME[a.gain]} at camp`);
                if (!p.campfireLit) {
                    p.campfireLit = true;
                    this.logResult(pid, 'relit their Campfire', 'relit', [logIcon('campfire')]);
                }
                if (this.canReserve()) this.ask({ kind: 'RESERVE', playerId: pid });
                return;
            case 'CAMERA':
                if (d.cameraOwner === pid) return;
                d.cameraOwner = pid;
                this.logResult(pid, 'took the Camera', 'took', [logIcon('bolt'), logIcon('camera')]);
                return;
            case 'YEAR_CARD': {
                const nf = this.nf();
                if (!nf || !nf.yearDeck.length) return;
                p.extraYears = [...(p.extraYears || []), nf.yearDeck.pop()!];
                this.logResult(pid, 'drew a Year card', 'drew', [logIcon('bolt'), logIcon('year_glyph')]);
                return;
            }
            case 'GEAR_CARD':
                if (this.nfLegal(pid, a, p.tokens)) this.ask({ kind: 'NF_GEAR_PICK', playerId: pid });
                return;
            case 'CAMP':
                if (this.nfLegal(pid, a, p.tokens)) this.ask({ kind: 'CAMP', playerId: pid, slot: 0 });
                return;
            case 'YEAR_DRAW': {
                if (!this.nfLegal(pid, a, p.tokens)) return;
                const nf = this.nf()!;
                this.paySunshine(pid, YEAR_DRAW_COST, 'drew Year cards');
                const drawn: string[] = [];
                for (let i = 0; i < 2 && nf.yearDeck.length; i++) drawn.push(nf.yearDeck.pop()!);
                p.extraYears = [...(p.extraYears || []), ...drawn];
                this.logResult(pid, `drew ${drawn.length} Year card${drawn.length === 1 ? '' : 's'}`, 'drew', drawn.map(() => logIcon('year_glyph')));
                this.ask({ kind: 'NF_YEAR_RETURN', playerId: pid, drawn });
                return;
            }
        }
    }

    private applyNfPay(playerId: string, prompt: Extract<Prompt, { kind: 'NF_PAY' }>, token: Token): void {
        const d = this.data;
        const a = prompt.action;
        if (a.kind !== 'TRADE' && a.kind !== 'PHOTO') throw new Error('Nothing to pay for');
        if (!this.nfPayTokens(playerId, a).includes(token)) throw new Error('That token can’t be turned in here');
        const paid: Bag = { [token]: 1 };
        this.spend(playerId, paid);
        if (a.kind === 'TRADE') {
            const got: Bag = {};
            TOKENS.forEach((t) => { const n = Math.min(a.gain[t] || 0, d.supply[t]); if (n > 0) got[t] = n; });
            this.gain(playerId, a.gain);
            this.logResult(playerId, `traded ${bagText(paid)} for ${bagText(got)}`, 'traded', [{ kind: 'bag', bag: paid }, LOG_THEN, { kind: 'bag', bag: got }]);
        } else {
            this.takePhoto(playerId);
            this.logResult(playerId, 'took a Photo', 'paid', [{ kind: 'bag', bag: paid }, LOG_THEN, logIcon('photo')]);
        }
        const left = prompt.left - 1;
        if (left > 0 && this.nfLegal(playerId, a, d.players[playerId].tokens)) {
            this.ask({ ...prompt, left, optional: true });
        }
    }

    /** Take a Gear card without paying: a face-up one (refilled as usual) or the deck's top card. */
    private takeGear(playerId: string, from: number | 'DECK'): void {
        const d = this.data;
        let gearId: string;
        if (from === 'DECK') {
            if (!d.gearDeck.length) throw new Error('The Gear deck is empty');
            gearId = d.gearDeck.pop()!;
        } else {
            const stack = d.gearBoard[from];
            if (!stack || !stack.length) throw new Error('No Gear in that slot');
            gearId = stack.pop()!;
            if (!d.solo) this.refillGear(from);
            this.gearSlotBonus(playerId, from);
        }
        const g = GEAR_BY_ID[gearId];
        d.players[playerId].gear.push(gearId);
        this.logResult(playerId, `took ${g.name}`, 'took', [{ kind: 'gear', id: gearId }]);
        this.gearInstant(playerId, g);
    }

    /** The three face-up Gear go to the bottom of the deck and three fresh ones are dealt. */
    private refreshGearBoard(): void {
        const d = this.data;
        d.gearBoard.forEach((stack) => { if (stack.length) d.gearDeck.unshift(stack.pop()!); });
        if (d.solo) {
            // solo Gear sits in piles by cost, the way the Rangers reveal it
            for (let i = 0; i < 3 && d.gearDeck.length; i++) {
                const id = d.gearDeck.pop()!;
                d.gearBoard[GEAR_BY_ID[id].cost - 1].push(id);
            }
        } else {
            for (let slot = 0; slot < 3; slot++) this.refillGear(slot);
        }
    }

    /** A Year card from the hand goes face down to the bottom of the deck. */
    private returnYear(playerId: string, yearId: string): void {
        const p = this.data.players[playerId];
        const nf = this.nf()!;
        const extra = p.extraYears || [];
        if (p.year === yearId) {
            p.year = null;
        } else {
            const i = extra.indexOf(yearId);
            if (i < 0) throw new Error('That Year card is not in your hand');
            extra.splice(i, 1);
        }
        // `year` stays the first card held
        if (!p.year && extra.length) p.year = extra.shift()!;
        p.extraYears = extra;
        nf.yearDeck.unshift(yearId);
    }

    private applySwap(playerId: string, discard: { type?: string; id?: string }, take: any): void {
        const d = this.data;
        const p = d.players[playerId];
        const nf = this.nf()!;
        if (discard.type === 'GEAR') {
            const i = p.gear.indexOf(String(discard.id));
            if (i < 0) throw new Error('You do not have that Gear');
            p.gear.splice(i, 1);
            d.gearDeck.unshift(String(discard.id));
            this.logResult(playerId, `returned ${GEAR_BY_ID[String(discard.id)].name}`, 'returned', [{ kind: 'gear', id: String(discard.id) }]);
        } else if (discard.type === 'YEAR') {
            this.returnYear(playerId, String(discard.id));
            this.logResult(playerId, 'returned a Year card', 'returned', [logIcon('year_glyph')]);
        } else {
            throw new Error('Choose a card to return');
        }
        if (take === 'YEAR') {
            if (!nf.yearDeck.length) throw new Error('The Year deck is empty');
            const y = nf.yearDeck.pop()!;
            if (p.year) p.extraYears = [...(p.extraYears || []), y];
            else p.year = y;
            this.logResult(playerId, 'took a Year card', 'took', [logIcon('year_glyph')]);
        } else if (take === 'GEAR_DECK') {
            this.takeGear(playerId, 'DECK');
        } else {
            this.takeGear(playerId, Number(take));
        }
    }

    private rangerTakesCamp(slot: number): void {
        const nf = this.nf();
        if (!nf || !nf.camps[slot - 1]) return;
        nf.camps[slot - 1] = false;
        this.logResult(RANGER, `packed up the Tent at the ${SITES[this.data.trail[slot - 1]].name}`, 'cleared', [logIcon('tent')]);
    }

    // -----------------------------------------------------------------------
    // Solo: the Rangers
    // -----------------------------------------------------------------------

    private rangerTurn(): void {
        const d = this.data;
        const solo = d.solo!;
        const you = d.players[d.current];
        if (solo.rangers.every(r => r === END)) return;

        let cost = 1;
        if (d.gearDeck.length) {
            const gearId = d.gearDeck.pop()!;
            cost = GEAR_BY_ID[gearId].cost;
            d.gearBoard[cost - 1].push(gearId);
        }
        solo.lastCost = cost;

        const front = Math.max(...you.hikers);
        const [a, b] = solo.rangers;
        const ahead = front > a && front > b;
        // Front Ranger if a Hiker leads, Back Ranger otherwise; a Ranger already home can't move.
        let active: number;
        if (a === END) active = 1;
        else if (b === END) active = 0;
        else if (ahead) active = a >= b ? 0 : 1;
        else active = a <= b ? 0 : 1;

        this.moveRanger(active, cost);
    }

    private moveRanger(index: number, steps: number): void {
        const d = this.data;
        const solo = d.solo!;
        const you = d.players[this.playerIds[0]];
        const from = solo.rangers[index];
        // Nightfall: the Ranger further back packs up every Tent it lands on or passes
        const sweeping = this.nfHas('campsites') && from <= solo.rangers[1 - index];
        let target = from + steps;
        while (target <= d.trail.length && you.hikers.includes(target)) target += 1;
        const sweepPast = () => {
            if (!sweeping) return;
            for (let s = from + 1; s < Math.min(target, d.trail.length + 1); s++) this.rangerTakesCamp(s);
        };

        if (target > d.trail.length) {
            solo.rangers[index] = END;
            this.logMove(RANGER, 'reached Trail End', [LOG_THEN, logIcon('reserve_glyph'), logIcon('gear_glyph'), logIcon('visit_glyph')]);
            sweepPast();
            this.rangerSlot(solo.lastCost);
            return;
        }
        solo.rangers[index] = target;
        this.logMove(RANGER, `moved to the ${SITES[d.trail[target - 1]].name}`, [LOG_THEN, { kind: 'site', site: d.trail[target - 1] }]);
        sweepPast();

        if (sweeping && this.campHere(target)) {
            // both a Tent and Weather: the player decides which the Ranger takes
            if (d.weather[target - 1] && !d.prompt) {
                this.ask({ kind: 'RANGER_CAMP', playerId: this.playerIds[0], ranger: index, slot: target });
                return;
            }
            this.rangerTakesCamp(target);
            if (d.weather[target - 1]) return;
        }
        this.rangerWeather(index, target);
    }

    private rangerWeather(index: number, target: number): void {
        const d = this.data;
        const solo = d.solo!;
        const w = d.weather[target - 1];
        if (w) {
            d.weather[target - 1] = null;
            this.logResult(RANGER, `took the ${TOKEN_NAME[w]} from the Trail`, 'first', [{ kind: 'bag', bag: { [w]: 1 } }], true);
            solo.tracker[w as 'SUNSHINE' | 'WATER'] += 1;
            if (solo.tracker[w as 'SUNSHINE' | 'WATER'] >= 3) this.fireEvent(w as 'SUNSHINE' | 'WATER', index);
        }
    }

    private discardPark(slot: number): void {
        const d = this.data;
        const id = d.parksBoard[slot];
        if (!id) return;
        d.parksBoard[slot] = null;
        const bonus = d.parkBonus[slot];
        if (bonus) { d.parkBonus[slot] = null; d.supply[bonus] += 1; }
        this.logResult(RANGER, `closed ${PARK_BY_ID[id].name}`, 'closed', [{ kind: 'park', id }]);
    }

    private rangerSlot(cost: number): void {
        const d = this.data;
        const te = d.trailEnd;
        if (cost === 1) {
            if (te.rangerTop) return;
            te.rangerTop = true;
            this.discardPark(0);
            if (te.firstSlot === null) {
                te.firstSlot = RANGER;
                d.firstHikerOwner = RANGER;
                this.logResult(RANGER, 'took the First Hiker Marker', 'first', [logIcon('marker')], true);
            } else {
                te.reserveBlocked = true;
                this.logResult(RANGER, 'closed the Reserve area', 'closed', [logIcon('reserve_glyph')]);
            }
        } else if (cost === 2) {
            if (te.rangerMiddle) return;
            te.rangerMiddle = true;
            this.discardPark(1);
            if (d.cameraOwner) {
                d.cameraOwner = null;
                this.logResult(RANGER, 'returned the Camera to the supply', 'returned', [logIcon('camera')]);
            }
        } else {
            if (te.rangerBottom) return;
            te.rangerBottom = true;
            this.discardPark(2);
            d.gearDeck = this.shuffled([...d.gearDeck, ...d.gearBoard[2]]);
            d.gearBoard[2] = [];
        }
    }

    private fireEvent(row: 'SUNSHINE' | 'WATER', activeRanger: number): void {
        const d = this.data;
        const solo = d.solo!;
        const card = EVENT_BY_ID[solo.activeEvent];
        solo.tracker[row] -= 3;
        d.supply[row] += 3;
        solo.eventDeck.push(solo.activeEvent);
        solo.activeEvent = solo.eventDeck.shift()!;
        const op = row === 'SUNSHINE' ? card.sunshine : card.water;
        this.logResult(RANGER, `${card.name}: ${EVENT_OP_TEXT[op]}`, 'event', [{ kind: 'event', id: card.id, op, token: row }]);
        this.applyEvent(op, activeRanger);
    }

    private applyEvent(op: EventOp, activeRanger: number): void {
        const d = this.data;
        const solo = d.solo!;
        const you = d.players[this.playerIds[0]];
        const nudgeHiker = (idx: number) => {
            if (idx >= 0 && you.hikers[idx] !== END && you.hikers[idx] < d.trail.length) you.hikers[idx] += 1;
        };
        const onTrail = you.hikers.map((pos, i) => ({ pos, i })).filter(h => h.pos !== END);
        switch (op) {
            case 'ADVANCE_RANGER':
                if (solo.rangers[activeRanger] !== END) this.moveRanger(activeRanger, 1);
                break;
            case 'DISCARD_LEFT': this.discardPark(0); break;
            case 'DISCARD_MIDDLE': this.discardPark(1); break;
            case 'DISCARD_RIGHT': this.discardPark(2); break;
            case 'LOSE_CAMERA': d.cameraOwner = null; break;
            case 'DOUSE_CAMPFIRE': you.campfireLit = false; break;
            case 'ADVANCE_BACK_HIKER':
                if (onTrail.length) nudgeHiker(onTrail.reduce((m, h) => h.pos < m.pos ? h : m).i);
                break;
            case 'ADVANCE_FRONT_HIKER':
                if (onTrail.length) nudgeHiker(onTrail.reduce((m, h) => h.pos > m.pos ? h : m).i);
                break;
            case 'CLEAR_WEATHER':
                d.weather = d.weather.map((w) => { if (w) d.supply[w] += 1; return null; });
                break;
            case 'REVEAL_GEAR':
                if (d.gearDeck.length) {
                    const id = d.gearDeck.pop()!;
                    d.gearBoard[GEAR_BY_ID[id].cost - 1].push(id);
                }
                break;
        }
    }

    // -----------------------------------------------------------------------
    // Client-facing projection
    // -----------------------------------------------------------------------

    /** The decision this player owes, with its options worked out for the view. */
    private promptView(viewer: string): any {
        const d = this.data;
        const prompt = d.prompt;
        if (!prompt || prompt.playerId !== viewer) return null;
        const p = d.players[viewer];
        switch (prompt.kind) {
            case 'CANTEEN':
                return { ...prompt, canteens: this.unfilledCanteens(viewer) };
            case 'SITE_GAIN':
                return {
                    ...prompt,
                    printed: SITES[prompt.site].gain,
                    printedOk: this.supplyHas(SITES[prompt.site].gain!),
                    gear: this.replacements(viewer, prompt.site).map(g => g.id)
                };
            case 'VISTA':
                return { ...prompt, photoCost: this.photoCost(viewer) };
            case 'LOOKOUT':
                return { ...prompt, options: this.lookoutOptions(viewer) };
            case 'CANTEEN_CHOICE':
                return { ...prompt, options: this.canteenChoices(viewer) };
            case 'RIVER':
                return { ...prompt, slots: this.riverTargets(viewer, p.tokens) };
            case 'RESERVE':
                return { ...prompt, deck: d.parksDeck.length };
            case 'VISIT':
                return { ...prompt, options: this.visitOptions(viewer) };
            case 'BUY':
                return { ...prompt, options: this.buyOptions(viewer, prompt.discount) };
            case 'CAMP':
                if (!prompt.slot) return { ...prompt, options: this.campOptions(viewer) };
                return { ...prompt, site: d.trail[prompt.slot - 1], siteOk: this.siteActionOk(viewer, prompt.slot), weather: d.weather[prompt.slot - 1], options: this.campOptions(viewer) };
            case 'NF_PAY':
                return { ...prompt, tokens: this.nfPayTokens(viewer, prompt.action) };
            case 'NF_SWAP':
            case 'NF_GEAR_PICK':
                return {
                    ...prompt, gear: p.gear, years: this.yearsOf(viewer), board: this.gearOnBoard(),
                    gearDeck: d.gearDeck.length, yearDeck: d.nightfall ? d.nightfall.yearDeck.length : 0
                };
            case 'NF_YEAR_RETURN':
                return { ...prompt, years: this.yearsOf(viewer) };
            case 'RANGER_CAMP':
                return { ...prompt, weather: d.weather[prompt.slot - 1], site: d.trail[prompt.slot - 1] };
            case 'LAKE':
                return { ...prompt, canteens: this.filledCanteens(viewer) };
            case 'PARKWAY':
                return { ...prompt, slots: this.parkwayTargets(viewer, p.tokens) };
            case 'SUMMIT':
                return { ...prompt, tokens: SYMS.filter(t => d.supply[t] > 0) };
            case 'SHUTTER':
                return { ...prompt, count: Math.min(prompt.count, p.tokens.WILDLIFE, d.photos) };
            default:
                return { ...prompt };
        }
    }

    /** Everything one client may see. Hidden: decks, other players' Year cards. */
    public view_for(viewer: string): any {
        const d = this.data;
        const over = d.phase === Phase.Over;
        const players: Record<string, any> = {};
        for (const id of this.playerIds) {
            const p = d.players[id];
            const mine = id === viewer;
            players[id] = {
                hikers: p.hikers,
                campfireLit: p.campfireLit,
                tokens: p.tokens,
                tokenCount: bagTotal(p.tokens),
                photos: p.photos,
                canteens: p.canteens,
                gear: p.gear,
                reserved: p.reserved,
                visited: p.visited,
                score: this.publicScore(id),
                year: mine || over ? p.year : null,
                yearOptions: mine && d.phase === Phase.Year ? p.yearOptions : [],
                yearChosen: !!p.year,
                yearProgress: (mine || over) && p.year ? this.yearProgress(id, YEAR_BY_ID[p.year]) : null,
                yearPoints: (mine || over) && p.year ? this.yearPoints(id, p.year) : null,
                yearCount: this.yearsOf(id).length,
                years: mine || over ? this.yearsOf(id).map(y => ({ id: y, progress: this.yearProgress(id, YEAR_BY_ID[y]), points: this.yearPoints(id, y) })) : [],
                yearTotal: mine || over ? this.totalYearPoints(id) : null
            };
        }
        const isTurn = d.phase === Phase.Play && d.current === viewer && !d.prompt;
        return {
            phase: d.phase,
            season: d.season,
            seasonsTotal: SEASONS_PER_GAME,
            activeSeason: d.activeSeason,
            trail: d.trail,
            weather: d.weather,
            trailEnd: d.trailEnd,
            supply: d.supply,
            photos: d.photos,
            parksBoard: d.parksBoard,
            parkBonus: d.parkBonus,
            parksDeck: d.parksDeck.length,
            gearBoard: d.gearBoard.map(s => s.length ? s[s.length - 1] : null),
            gearStacks: d.gearBoard.map(s => s.length),
            gearDeck: d.gearDeck.length,
            canteenDeck: d.canteenDeck.length,
            advancedLeft: d.advancedPile.length,
            nightfall: d.nightfall ? {
                modules: this.nfModules(),
                camps: d.nightfall.camps,
                campsites: d.nightfall.campsites.map(c => ({ ...c, action: campsideFor(CAMPSITE_BY_ID[c.tile], d.season).action })),
                boardSlots: d.nightfall.boardSlots,
                boardTaken: d.nightfall.boardTaken,
                yearDeck: d.nightfall.yearDeck.length
            } : null,
            wildlife: d.wildlife ? { modules: d.wildlife.modules, endBonus: d.wildlife.endBonus, gearBonus: d.wildlife.gearBonus } : null,
            players,
            order: this.playerIds,
            current: d.current,
            firstHikerOwner: d.firstHikerOwner,
            cameraOwner: d.cameraOwner,
            solo: d.solo ? {
                rangers: d.solo.rangers,
                tracker: d.solo.tracker,
                activeEvent: d.solo.activeEvent
            } : null,
            isTurn,
            waitingOn: d.prompt ? d.prompt.playerId : d.current,
            moves: isTurn ? this.moveOptions(viewer) : null,
            prompt: this.promptView(viewer),
            photoCost: this.photoCost(viewer),
            log: d.log.slice(-30),
            scores: d.scores,
            winners: d.winners
        };
    }
}
