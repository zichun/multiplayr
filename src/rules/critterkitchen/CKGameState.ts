/**
 * CKGameState.ts — the pure, serialisable Critter Kitchen engine.
 *
 * Round = Start of Round (restock) → Planning (simultaneous, secret) →
 * Running (reveal + place) → Shopping (locations resolve left → right, chefs
 * pick in queue order) → End of Round (challenges after rounds 3 and 6, the
 * critic meal after round 7).
 *
 * Shopping is a step machine: `advance()` runs every automatic step until a
 * player must choose an item (`pending`). All randomness flows through a
 * seeded mulberry32 stored in the data, so a game replays deterministically.
 */

import {
    IngType, ING_TYPES, ING_VALUES, Item, RumorKind, RUMOR_SLOTS, SOUP_PICK, LocId, LOC_BY_ID, locationsFor,
    MIDNIGHT_SPACES_2P, ACADEMY_SPACES_2P, ChefKind, CHEFS, CHEF_CAP, CHALLENGES, CHALLENGE_BY_ID, CRITICS,
    CriticId, RUMORS, RumorId, RESTAURATEURS, RestId, REST_BY_ID, ZOUS_CHEFS, ZOUS_BY_ID, CKOptions,
    DEFAULT_OPTIONS, FRIDGE_LIMIT_DAY1, FRIDGE_LIMIT_DAY2, itemLabel, ING_NAMES
} from './CKData';
import {
    MealCtx, ChallengePlate, CriticPlate, evaluateChallenge, evaluateCritic, itemMap, plateItemIds,
    criticPlateIds, scoreFinal, FinalInput, FinalResult, suggestChallengePlate, suggestCriticPlate,
    ChallengeEval, baseValue, soupValue
} from './CKMeals';

export enum Phase {
    Restaurateur = 'restaurateur',
    Planning = 'planning',
    Shopping = 'shopping',
    Challenge = 'challenge',
    Fridge = 'fridge',
    Critic = 'critic',
    GameOver = 'gameover'
}

/** 'mouse' | 'lizard' | 'boar' | 'z_<zousId>' */
export type ChefKey = string;

export interface StarEntry { round: number; reason: string; n: number; }

export interface ChallengeResult {
    round: number;
    challengeId: string;
    quality: number;
    stars: number;
}

export interface PlayerState {
    storage: Item[];
    rumorSlots: (Item | null)[];
    known: boolean[];
    rumorTokens: number;
    stars: number;
    starLog: StarEntry[];
    rest: RestId | null;
    restOptions: RestId[];
    zous: string[];
    zousNext: string[];
    plan: Record<ChefKey, LocId> | null;
    ready: boolean;
    challengePlates: ChallengePlate[] | null;
    criticPlate: CriticPlate | null;
    fridgeDiscard: number[] | null;
    challengeResults: ChallengeResult[];
}

export interface Placement {
    pid: string;
    key: ChefKey;
    chef: ChefKind | 'zous';
    zous?: string;
    cap: number;
}

export interface ChefRun extends Placement {
    queueCap: number;
    picked: Item[];
    pickCount: number;
    done: boolean;
    beforeDone: boolean;
    extraUsed: boolean;
    newtonLow: boolean;
    starInstead: boolean;
}

export interface GroupSpec { keys: string[]; noPrio: boolean; }

export interface Pending {
    pid: string;
    key: ChefKey;
    loc: LocId;
    /** 'pick' at the location, 'penny' = bonus pick at the Soup Truck */
    kind: 'pick' | 'penny';
    canLeave: boolean;
    canStar: boolean;
    picksLeft: number;
}

export interface ShopState {
    locIdx: number;
    runs: ChefRun[];
    groups: GroupSpec[];
    groupIdx: number;
    order: string[];
    turn: number;
    noPrioLoc: boolean;
    firstPickKey: string | null;
    pending: Pending | null;
}

export interface LogEntry {
    id: number;
    round: number;
    pid?: string;
    kind: 'pick' | 'info' | 'star' | 'challenge' | 'phase' | 'priority' | 'soup';
    text: string;
    loc?: LocId;
    item?: Item;
}

export interface OfferedChallenge { id: string; req: IngType[]; hippo: boolean; }

export interface GameStateData {
    phase: Phase;
    round: number;
    rng: number;
    options: CKOptions;
    nextId: number;
    bag: Item[];
    challenges: string[];
    hippoChallenge: string | null;
    critic: CriticId;
    rumorCards: RumorId[];
    rumorPool: RumorId[];
    revealed: boolean[];
    jamieRumor: Record<string, RumorId>;
    zousDeck: string[];
    locations: LocId[];
    locItems: Record<string, Item[]>;
    priority: string[];
    players: Record<string, PlayerState>;
    placements: Record<string, Placement[]>;
    shop: ShopState | null;
    offered: OfferedChallenge[];
    log: LogEntry[];
    logSeq: number;
    final: FinalResult[] | null;
    winners: string[];
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function mulberry(state: number): [number, number] {
    const t = (state + 0x6D2B79F5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return [((r ^ (r >>> 14)) >>> 0) / 4294967296, t];
}

const SLOT_OF: Record<string, number> = { q: 0, dots: 1, excl: 2 };

export function zousKey(z: string): ChefKey { return `z_${z}`; }
export function isZousKey(k: string): boolean { return k.indexOf('z_') === 0; }

// ---------------------------------------------------------------------------
// engine
// ---------------------------------------------------------------------------

export class CKGameState {
    private data: GameStateData;
    private readonly playerIds: string[];

    constructor(playerIds: string[]) {
        this.playerIds = [...playerIds];
        this.data = null as any;
    }

    public static from_data(data: GameStateData, playerIds: string[]): CKGameState {
        const gs = new CKGameState(playerIds);
        gs.data = data;
        return gs;
    }

    public get_data(): GameStateData { return this.data; }
    public get playerIdsList(): string[] { return this.playerIds; }

    // ---- rng ----
    private rand(): number {
        const [v, s] = mulberry(this.data.rng);
        this.data.rng = s;
        return v;
    }
    private shuffle<T>(arr: T[]): T[] {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(this.rand() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }
    private mk(item: Omit<Item, 'id'>): Item {
        return { id: this.data.nextId++, ...item } as Item;
    }

    // ---- logging ----
    private log(kind: LogEntry['kind'], text: string, extra: Partial<LogEntry> = {}) {
        const e: LogEntry = { id: ++this.data.logSeq, round: this.data.round, kind, text, ...extra };
        this.data.log.push(e);
        if (this.data.log.length > 80) this.data.log.splice(0, this.data.log.length - 80);
    }
    private star(pid: string, n: number, reason: string) {
        if (!n) return;
        const p = this.data.players[pid];
        p.stars += n;
        p.starLog.push({ round: this.data.round, reason, n });
        this.log('star', `+${n}★ ${reason}`, { pid });
    }

    // =====================================================================
    // setup
    // =====================================================================

    public start_game(opts: Partial<CKOptions> & { seed?: number } = {}) {
        const n = this.playerIds.length;
        if (n < 2 || n > 5) throw new Error('Critter Kitchen supports 2 to 5 players.');
        const options: CKOptions = { ...DEFAULT_OPTIONS, ...opts } as CKOptions;
        delete (options as any).seed;
        const seed = typeof opts.seed === 'number' ? opts.seed : Math.floor(Math.random() * 2 ** 31);
        this.data = {
            phase: Phase.Planning, round: 0, rng: seed, options, nextId: 1, bag: [],
            challenges: [], hippoChallenge: null, critic: 'mouse', rumorCards: [], rumorPool: [], revealed: [false, false, false],
            jamieRumor: {}, zousDeck: [], locations: locationsFor(n), locItems: {}, priority: [],
            players: {}, placements: {}, shop: null, offered: [], log: [], logSeq: 0, final: null, winners: []
        };
        const d = this.data;
        // token bag
        ING_TYPES.forEach(t => ING_VALUES.forEach(v => d.bag.push(this.mk({ k: 'ing', t, v }))));
        ING_TYPES.forEach(t => { d.bag.push(this.mk({ k: 'spice', t })); d.bag.push(this.mk({ k: 'spice', t })); });
        d.bag.push(this.mk({ k: 'spice', t: 'all' }));
        d.bag.push(this.mk({ k: 'spice', t: 'all' }));
        (['q', 'dots', 'excl', 'wild'] as RumorKind[]).forEach(r => { for (let i = 0; i < 3; i++) d.bag.push(this.mk({ k: 'rumor', r })); });

        // cards
        const chal = this.shuffle(CHALLENGES.map(c => c.id));
        d.challenges = chal.slice(0, 6);
        const critics = CRITICS.filter(c => (options.expansion || !c.exp) && (!c.minPlayers || n >= c.minPlayers));
        d.critic = critics[Math.floor(this.rand() * critics.length)].id;
        d.hippoChallenge = d.critic === 'hippo' ? chal[6] : null;
        const rumorPool = this.shuffle(RUMORS.filter(r => options.advancedRumors || !r.advanced).map(r => r.id));
        d.rumorCards = rumorPool.slice(0, 3);
        d.rumorPool = rumorPool.slice(3);
        d.zousDeck = this.shuffle(ZOUS_CHEFS.filter(z => options.expansion || !z.exp).map(z => z.id));
        d.locations.forEach(l => { d.locItems[l] = []; });
        d.priority = this.shuffle(this.playerIds);

        const restPool = this.shuffle(RESTAURATEURS.filter(r => options.expansion || !r.exp).map(r => r.id));
        this.playerIds.forEach((pid) => {
            d.players[pid] = {
                storage: [this.mk({ k: 'soup' })], rumorSlots: [null, null, null], known: [false, false, false],
                rumorTokens: 0, stars: 0, starLog: [], rest: null,
                restOptions: options.restaurateurs ? [restPool.pop() as RestId, restPool.pop() as RestId] : [],
                zous: [], zousNext: [], plan: null, ready: false, challengePlates: null, criticPlate: null,
                fridgeDiscard: null, challengeResults: []
            };
        });

        this.start_round(1, !options.restaurateurs);
        if (options.restaurateurs) {
            d.phase = Phase.Restaurateur;
            this.log('phase', 'Choose your restaurateur');
        }
    }

    // ---- bag ----
    private drawRaw(): Item | null {
        const d = this.data;
        for (let guard = 0; guard < 200 && d.bag.length; guard++) {
            const i = Math.floor(this.rand() * d.bag.length);
            const it = d.bag.splice(i, 1)[0];
            if (it.k === 'rumor' && it.r !== 'wild' && d.revealed[SLOT_OF[it.r as string]]) {
                continue; // revealed rumor: removed from the game, draw again
            }
            return it;
        }
        return null;
    }

    /** Draw an item the player is allowed to hold (rumor duplicates go back). */
    private gainFromBag(pid: string, reason: string): Item | null {
        const returned: Item[] = [];
        let got: Item | null = null;
        for (let guard = 0; guard < 30; guard++) {
            const it = this.drawRaw();
            if (!it) break;
            if (it.k === 'rumor' && !this.canTakeRumor(pid, it)) { returned.push(it); continue; }
            got = it;
            break;
        }
        this.data.bag.push(...returned);
        if (got) {
            this.receive(pid, got, got.k === 'rumor' && got.r === 'wild' ? this.firstUnknownSlot(pid) : undefined);
            this.log('pick', `${reason}: gained ${itemLabel(got)}`, { pid, item: got });
        }
        return got;
    }

    private returnToBag(items: Item[]) {
        items.forEach(it => {
            if (it.k === 'ing' || it.k === 'spice' || it.k === 'rumor') this.data.bag.push(it);
        });
    }

    // ---- rumors ----
    public canTakeRumor(pid: string, it: Item): boolean {
        const p = this.data.players[pid];
        if (it.r === 'wild') return p.known.some(k => !k);
        return !p.known[SLOT_OF[it.r as string]];
    }
    private firstUnknownSlot(pid: string): number {
        const p = this.data.players[pid];
        return p.known.findIndex(k => !k);
    }
    private learnSlot(pid: string, slot: number, token: Item | null) {
        const p = this.data.players[pid];
        p.known[slot] = true;
        if (token) { p.rumorSlots[slot] = token; p.rumorTokens++; }
        if (!this.data.revealed[slot] && this.playerIds.every(id => this.data.players[id].known[slot])) {
            this.data.revealed[slot] = true;
            this.log('info', `Everyone knows rumor ${slot + 1}: it is flipped face up`);
        }
    }

    /** Hand an item to a player. */
    private receive(pid: string, it: Item, wildSlot?: number) {
        const p = this.data.players[pid];
        if (it.k === 'rumor') {
            const slot = it.r === 'wild' ? (wildSlot ?? this.firstUnknownSlot(pid)) : SLOT_OF[it.r as string];
            if (slot < 0 || p.known[slot]) throw new Error('You already know that rumor');
            this.learnSlot(pid, slot, it);
        } else if (it.k === 'zous') {
            p.zousNext.push(it.z as string);
        } else {
            p.storage.push(it);
        }
    }

    private giveSoup(pid: string, n: number) {
        for (let i = 0; i < n; i++) this.data.players[pid].storage.push(this.mk({ k: 'soup' }));
    }

    // =====================================================================
    // rounds
    // =====================================================================

    private start_round(r: number, toPlanning = true) {
        const d = this.data;
        d.round = r;
        // bisque
        const truck = d.locItems.soup;
        if (!truck.some(i => i.k === 'bisque')) truck.push(this.mk({ k: 'bisque' }));
        // restock regular locations
        d.locations.forEach(l => {
            const def = LOC_BY_ID[l];
            if (l === 'soup' || l === 'midnight' || l === 'academy') return;
            while (d.locItems[l].length < def.spaces) {
                const it = this.drawRaw();
                if (!it) break;
                d.locItems[l].push(it);
            }
        });
        // zous-chef / allspice at the academy
        if (r < 7) {
            const z = d.zousDeck.pop();
            if (z) d.locItems.academy.push(this.mk({ k: 'zous', z }));
        } else {
            d.locItems.academy.push(this.mk({ k: 'spice', t: 'all' }));
        }
        if (this.playerIds.length === 2) {
            for (let i = 0; i < ACADEMY_SPACES_2P; i++) {
                const it = this.drawRaw();
                if (it) d.locItems.academy.push(it);
            }
        }
        // players
        this.playerIds.forEach(pid => {
            const p = d.players[pid];
            p.zous = p.zousNext;
            p.zousNext = [];
            p.plan = null;
            p.ready = false;
        });
        if (toPlanning) this.begin_planning();
        this.log('phase', r < 7 ? `Round ${r} begins` : 'Round 7 — the critic is coming!');
    }

    private begin_planning() {
        const d = this.data;
        // Morimotter: a free zous-chef at the start of rounds 1, 4 and 7
        if (d.round === 1 || d.round === 4 || d.round === 7) {
            this.playerIds.forEach(pid => {
                if (d.players[pid].rest === 'morimotter') {
                    const z = d.zousDeck.pop();
                    if (z) { d.players[pid].zous.push(z); this.log('info', `Morimotter brings ${ZOUS_BY_ID[z].name}`, { pid }); }
                }
            });
        }
        d.phase = Phase.Planning;
    }

    // =====================================================================
    // restaurateurs
    // =====================================================================

    public choose_restaurateur(pid: string, rest: RestId, guySlot?: number) {
        const d = this.data;
        if (d.phase !== Phase.Restaurateur) throw new Error('Not choosing restaurateurs now');
        const p = d.players[pid];
        if (!p) throw new Error('Unknown player');
        if (p.restOptions.indexOf(rest) === -1) throw new Error('That restaurateur was not dealt to you');
        p.rest = rest;
        p.ready = true;
        (p as any).guySlot = typeof guySlot === 'number' ? guySlot : 0;
        if (this.playerIds.every(id => d.players[id].rest)) this.finish_restaurateurs();
    }

    private finish_restaurateurs() {
        const d = this.data;
        const pool: RumorId[] = d.rumorPool;
        this.playerIds.forEach(pid => {
            const p = d.players[pid];
            if (p.rest === 'jamie' && pool.length) d.jamieRumor[pid] = pool.pop() as RumorId;
            if (p.rest === 'guy') {
                const slot = Math.max(0, Math.min(2, (p as any).guySlot || 0));
                // take a wild rumor token from the bag if one is there
                const idx = d.bag.findIndex(i => i.k === 'rumor' && i.r === 'wild');
                const tok = idx >= 0 ? d.bag.splice(idx, 1)[0] : this.mk({ k: 'rumor', r: 'wild' });
                this.learnSlot(pid, slot, tok);
            }
            delete (p as any).guySlot;
            p.ready = false;
        });
        this.begin_planning();
    }

    // =====================================================================
    // planning
    // =====================================================================

    public chefKeysFor(pid: string): ChefKey[] {
        const p = this.data.players[pid];
        return [...CHEFS, ...p.zous.map(zousKey)];
    }

    public submit_plan(pid: string, plan: Record<ChefKey, LocId>) {
        const d = this.data;
        if (d.phase !== Phase.Planning) throw new Error('Not planning now');
        const p = d.players[pid];
        if (!p) throw new Error('Unknown player');
        const keys = this.chefKeysFor(pid);
        const used = new Set<LocId>();
        for (const k of keys) {
            const loc = plan[k];
            if (!loc || d.locations.indexOf(loc) === -1) throw new Error('Send every chef to a location');
            if (used.has(loc)) throw new Error('Each chef must go to a different location');
            used.add(loc);
        }
        p.plan = {};
        keys.forEach(k => { p.plan![k] = plan[k]; });
        p.ready = true;
        if (this.playerIds.every(id => d.players[id].plan)) this.run();
    }

    public unsubmit_plan(pid: string) {
        const d = this.data;
        if (d.phase !== Phase.Planning) return;
        d.players[pid].plan = null;
        d.players[pid].ready = false;
    }

    /** Running: reveal plans, place chefs, then shop. */
    private run() {
        const d = this.data;
        d.placements = {};
        d.locations.forEach(l => { d.placements[l] = []; });
        this.playerIds.forEach(pid => {
            const p = d.players[pid];
            Object.keys(p.plan!).forEach(k => {
                const loc = p.plan![k];
                if (isZousKey(k)) {
                    const z = k.slice(2);
                    d.placements[loc].push({ pid, key: k, chef: 'zous', zous: z, cap: ZOUS_BY_ID[z].cap });
                } else {
                    d.placements[loc].push({ pid, key: k, chef: k as ChefKind, cap: CHEF_CAP[k as ChefKind] });
                }
            });
        });
        this.log('phase', 'Chefs head out into Bistro Bay');
        if (d.critic === 'wolverine') {
            this.playerIds.forEach(pid => {
                const alone = d.locations.filter(l => d.placements[l].length > 0 && d.placements[l].every(c => c.pid === pid)).length;
                this.star(pid, alone, 'The Wolverine (alone)');
            });
        }
        d.phase = Phase.Shopping;
        d.shop = { locIdx: -1, runs: [], groups: [], groupIdx: 0, order: [], turn: 0, noPrioLoc: false, firstPickKey: null, pending: null };
        this.next_location();
    }

    // =====================================================================
    // shopping
    // =====================================================================

    private moveToBack(pid: string) {
        const pr = this.data.priority;
        pr.splice(pr.indexOf(pid), 1);
        pr.push(pid);
    }
    private moveToFront(pid: string) {
        const pr = this.data.priority;
        pr.splice(pr.indexOf(pid), 1);
        pr.unshift(pid);
    }
    private prioRank(pid: string): number { return this.data.priority.indexOf(pid); }

    private curLoc(): LocId { return this.data.locations[this.data.shop!.locIdx]; }

    private next_location() {
        const d = this.data;
        const s = d.shop!;
        s.locIdx++;
        if (s.locIdx >= d.locations.length) { this.end_round(); return; }
        const loc = this.curLoc();
        s.pending = null;
        s.firstPickKey = null;
        s.noPrioLoc = false;
        s.groupIdx = 0;
        s.order = [];
        s.turn = 0;
        if (loc === 'midnight') {
            const n = this.playerIds.length === 2 ? MIDNIGHT_SPACES_2P : LOC_BY_ID.midnight.spaces;
            while (d.locItems.midnight.length < n) {
                const it = this.drawRaw();
                if (!it) break;
                d.locItems.midnight.push(it);
            }
        }
        s.runs = (d.placements[loc] || []).map(pl => ({
            ...pl, queueCap: pl.cap, picked: [], pickCount: 0, done: false, beforeDone: false,
            extraUsed: false, newtonLow: false, starInstead: false
        }));
        this.start_of_location(loc);
        this.advance();
    }

    private zousRun(z: string): ChefRun | undefined {
        return this.data.shop!.runs.find(r => r.zous === z);
    }

    private start_of_location(loc: LocId) {
        const d = this.data;
        const s = d.shop!;
        const runs = s.runs;
        const alone = runs.length === 1;
        // abilities resolve in carrying-capacity, then priority order
        const ordered = runs.slice().sort((a, b) => a.queueCap - b.queueCap || this.prioRank(a.pid) - this.prioRank(b.pid));
        const firsts: string[] = [];
        let harriet = false, richard = false, stripes: ChefRun | null = null;
        for (const r of ordered) {
            switch (r.zous) {
                case 'dash': this.moveToFront(r.pid); this.log('priority', 'Dash Cheetah dashes to the front', { pid: r.pid }); break;
                case 'snooze':
                    for (let i = 0; i < 2; i++) { const it = this.drawRaw(); if (it) d.locItems[loc].push(it); }
                    this.log('info', 'Snooze Sloth adds 2 items', { pid: r.pid, loc });
                    break;
                case 'otto': {
                    const twos = runs.filter(x => x.queueCap === 2);
                    if (twos.length >= 2) {
                        const pids = Array.from(new Set(twos.map(x => x.pid)));
                        pids.forEach(pid => this.gainFromBag(pid, 'Otto Otter'));
                    }
                    break;
                }
                case 'chrissy': if (alone) r.cap = 3; break;
                case 'skeeter': runs.forEach(x => { if (x !== r) x.cap = 1; }); break;
                case 'harriet': {
                    harriet = true;
                    this.star(r.pid, runs.filter(x => x.queueCap === 2).length, 'Harriet Hare');
                    break;
                }
                case 'terry':
                    if (runs.some(x => x.queueCap === 1)) {
                        this.moveToBack(r.pid);
                        firsts.push(r.key + '@' + r.pid);
                    }
                    break;
                case 'hootly':
                    if (loc === 'midnight' && d.locItems.midnight.some(i => (i.k === 'ing' || i.k === 'spice') && i.t === 'fish')) {
                        firsts.push(r.key + '@' + r.pid);
                    }
                    break;
                case 'ming': firsts.unshift(r.key + '@' + r.pid); s.noPrioLoc = true; break;
                case 'richard': richard = true; break;
                case 'stripes': stripes = r; break;
            }
        }
        const id = (r: ChefRun) => r.key + '@' + r.pid;
        const placed = new Set<string>(firsts);
        const groups: GroupSpec[] = firsts.map(k => ({ keys: [k], noPrio: false }));
        const lastMice: string[] = [];
        if (richard) runs.filter(r => r.chef === 'mouse').forEach(r => { if (!placed.has(id(r))) { lastMice.push(id(r)); placed.add(id(r)); } });
        const capOrder = harriet ? [2, 1, 3] : [1, 2, 3];
        for (const c of capOrder) {
            let keys = runs.filter(r => r.queueCap === c && !placed.has(id(r))).map(id);
            if (!keys.length) continue;
            if (c === 3 && stripes && keys.indexOf(id(stripes)) !== -1) {
                groups.push({ keys: [id(stripes)], noPrio: true });
                keys = keys.filter(k => k !== id(stripes!));
                if (keys.length) groups.push({ keys, noPrio: true });
            } else {
                groups.push({ keys, noPrio: false });
            }
            keys.forEach(k => placed.add(k));
        }
        if (lastMice.length) groups.push({ keys: lastMice, noPrio: false });
        s.groups = groups;
    }

    private runById(rid: string): ChefRun {
        return this.data.shop!.runs.find(r => r.key + '@' + r.pid === rid)!;
    }

    /** What may this chef take right now? (ids; SOUP_PICK for endless soup) */
    public optionsFor(pid: string, loc: LocId): number[] {
        const items = this.data.locItems[loc] || [];
        const ids = items.filter(it => it.k !== 'rumor' || this.canTakeRumor(pid, it)).map(it => it.id);
        if (loc === 'soup') ids.push(SOUP_PICK);
        return ids;
    }

    /** Run automatic steps until a player must act or the phase ends. */
    private advance() {
        const d = this.data;
        for (let guard = 0; guard < 500; guard++) {
            if (d.phase !== Phase.Shopping) return;
            const s = d.shop!;
            if (s.pending) return;
            const loc = this.curLoc();
            // establish the current group's order
            if (!s.order.length) {
                if (s.groupIdx >= s.groups.length) {
                    this.cleanup_location(loc);
                    this.next_location();
                    return;
                }
                const g = s.groups[s.groupIdx];
                s.order = g.keys.slice().sort((a, b) => this.prioRank(this.runById(a).pid) - this.prioRank(this.runById(b).pid));
                s.turn = 0;
            }
            const live = s.order.filter(k => !this.runById(k).done);
            if (!live.length) { s.order = []; s.groupIdx++; continue; }
            // next chef in rotation that is not done
            let k = s.order[s.turn % s.order.length];
            let spins = 0;
            while (this.runById(k).done && spins < s.order.length) { s.turn++; k = s.order[s.turn % s.order.length]; spins++; }
            const r = this.runById(k);
            this.prepare_turn(r, loc);
            if (r.done) continue;
            const opts = this.optionsFor(r.pid, loc);
            if (r.pickCount >= r.cap || !opts.length) {
                this.finish_chef(r, loc);
                continue;
            }
            // only endless soup on offer: take it automatically
            if (opts.length === 1 && opts[0] === SOUP_PICK && r.pickCount > 0) {
                this.do_pick(r, loc, SOUP_PICK);
                continue;
            }
            const canStar = r.zous === 'marie' && s.runs.length > 1 && r.pickCount === 0;
            s.pending = { pid: r.pid, key: r.key, loc, kind: 'pick', canLeave: r.pickCount === 0, canStar, picksLeft: r.cap - r.pickCount };
            return;
        }
    }

    /** "Before your first pick" abilities. */
    private prepare_turn(r: ChefRun, loc: LocId) {
        if (r.beforeDone) return;
        r.beforeDone = true;
        const d = this.data;
        const alone = d.shop!.runs.length === 1;
        switch (r.zous) {
            case 'geoffrey': {
                const it = this.drawRaw();
                if (it) { d.locItems[loc].push(it); this.log('info', 'Geoffrey Giraffe adds an item', { pid: r.pid, loc }); }
                break;
            }
            case 'syd':
                if (alone) { this.gainFromBag(r.pid, 'Syd Platypus'); this.gainFromBag(r.pid, 'Syd Platypus'); }
                break;
            case 'peter':
                if (d.locItems[loc].some(i => i.k === 'spice')) r.cap += 1;
                break;
        }
    }

    private do_pick(r: ChefRun, loc: LocId, itemId: number, wildSlot?: number) {
        const d = this.data;
        const s = d.shop!;
        const items = d.locItems[loc];
        let it: Item;
        if (itemId === SOUP_PICK) {
            if (loc !== 'soup') throw new Error('Soup is only at the Soup Truck');
            it = this.mk({ k: 'soup' });
        } else {
            const idx = items.findIndex(i => i.id === itemId);
            if (idx < 0) throw new Error('That item is not here');
            it = items[idx];
            if (it.k === 'rumor') {
                if (!this.canTakeRumor(r.pid, it)) throw new Error('You already know that rumor');
                if (it.r === 'wild') {
                    const p = d.players[r.pid];
                    const slot = typeof wildSlot === 'number' ? wildSlot : this.firstUnknownSlot(r.pid);
                    if (slot < 0 || slot > 2 || p.known[slot]) throw new Error('Choose an unknown rumor slot');
                    wildSlot = slot;
                }
            }
            if (r.zous === 'newton' && it.k === 'ing') {
                const low = Math.min(...items.filter(i => i.k === 'ing').map(i => i.v || 0));
                r.newtonLow = (it.v || 0) <= low;
            }
            items.splice(idx, 1);
        }
        // first pick at the location: a tied leader loses priority
        if (!s.firstPickKey) {
            s.firstPickKey = r.key + '@' + r.pid;
            const g = s.groups[s.groupIdx];
            if (g && s.order.length > 1 && s.order[0] === s.firstPickKey && !g.noPrio && !s.noPrioLoc) {
                this.moveToBack(r.pid);
                this.log('priority', 'Won the tie — moves to the back of the priority track', { pid: r.pid, loc });
            }
        }
        // Finn Dolphin: a zous-chef picking a zous-chef
        if (it.k === 'zous' && r.chef === 'zous' && (r.zous === 'finn' || it.z === 'finn')) this.star(r.pid, 1, 'Finn Dolphin');
        this.receive(r.pid, it, wildSlot);
        r.picked.push(it);
        r.pickCount++;
        s.turn++;
        this.log('pick', `took ${itemLabel(it)}`, { pid: r.pid, loc, item: it });
    }

    private finish_chef(r: ChefRun, loc: LocId) {
        const d = this.data;
        const opts = () => this.optionsFor(r.pid, loc);
        // extra picks at this location first
        if (!r.extraUsed && (r.zous === 'mandy' || r.zous === 'shaggy')) {
            r.extraUsed = true;
            if (r.zous === 'mandy') {
                if (opts().length) { r.cap = r.pickCount + 1; return; }
                this.gainFromBag(r.pid, 'Mandy Panda');
            } else {
                const n = d.players[r.pid].rumorSlots.filter(x => x).length;
                if (n && opts().length) { r.cap = r.pickCount + n; return; }
            }
        }
        r.done = true;
        const items = r.picked;
        switch (r.zous) {
            case 'carol':
                if (d.priority[d.priority.length - 1] === r.pid) this.star(r.pid, 1, 'Carol Koala');
                break;
            case 'ginger': this.gainFromBag(r.pid, 'Ginger Fox'); break;
            case 'lily': {
                const truck = d.locItems.soup;
                const bi = truck.findIndex(i => i.k === 'bisque');
                if (bi >= 0) { this.receive(r.pid, truck.splice(bi, 1)[0]); this.log('pick', 'Lily Frog grabs the bisque', { pid: r.pid }); }
                else { this.giveSoup(r.pid, 1); this.log('soup', 'Lily Frog grabs a soup', { pid: r.pid }); }
                break;
            }
            case 'newton':
                if (r.newtonLow) { this.giveSoup(r.pid, 3); this.log('soup', 'Newton Yorkie: +3 soup', { pid: r.pid }); }
                break;
            case 'alexalpaca':
                if (items.some(i => i.k === 'ing' && i.t === 'bread')) this.star(r.pid, 1, 'Alex Alpaca');
                break;
            case 'cecilia':
                items.filter(i => i.k === 'ing' && i.t === 'meat').forEach(() => this.gainFromBag(r.pid, 'Cecilia Python'));
                break;
            case 'donna':
                if (items.length) { this.giveSoup(r.pid, items.length); this.log('soup', `Donna Donkey: +${items.length} soup`, { pid: r.pid }); }
                break;
            case 'hans': {
                const drawn: Item[] = [];
                for (let i = 0; i < 5; i++) { const it = this.drawRaw(); if (it) drawn.push(it); }
                const keep = drawn.filter(i => i.k === 'ing' && i.t === 'mushroom');
                keep.forEach(i => this.receive(r.pid, i));
                d.bag.push(...drawn.filter(i => keep.indexOf(i) === -1));
                this.log('info', `Hans Mole digs up ${keep.length} mushroom${keep.length === 1 ? '' : 's'}`, { pid: r.pid });
                break;
            }
            case 'queenie':
                if (d.shop!.firstPickKey === r.key + '@' + r.pid) this.gainFromBag(r.pid, 'Queenie Bee');
                break;
        }
        if (!items.length && !r.starInstead) this.consolation(r.pid, false);
        if (r.zous === 'penny') {
            d.shop!.pending = { pid: r.pid, key: r.key, loc: 'soup', kind: 'penny', canLeave: false, canStar: false, picksLeft: 1 };
        }
    }

    private consolation(pid: string, useBag: boolean) {
        const p = this.data.players[pid];
        if (p.rest === 'anthony' && useBag !== false) {
            if (this.gainFromBag(pid, 'Anthony Boardain')) return;
        }
        this.giveSoup(pid, 1);
        this.log('soup', 'came back empty-handed: consolation soup', { pid });
    }

    // ---- shopping actions ----

    public pick(pid: string, itemId: number, wildSlot?: number) {
        const d = this.data;
        if (d.phase !== Phase.Shopping || !d.shop?.pending) throw new Error('Nothing to pick right now');
        const pend = d.shop.pending;
        if (pend.pid !== pid) throw new Error('Not your pick');
        if (pend.kind === 'penny') {
            const truck = d.locItems.soup;
            let it: Item;
            if (itemId === SOUP_PICK) it = this.mk({ k: 'soup' });
            else {
                const idx = truck.findIndex(i => i.id === itemId);
                if (idx < 0) throw new Error('That item is not at the Soup Truck');
                it = truck[idx];
                if (it.k === 'rumor' && !this.canTakeRumor(pid, it)) throw new Error('You already know that rumor');
                truck.splice(idx, 1);
            }
            this.receive(pid, it, wildSlot);
            this.log('pick', `Penny Penguin takes ${itemLabel(it)} from the Soup Truck`, { pid, loc: 'soup', item: it });
            d.shop.pending = null;
            this.advance();
            return;
        }
        if (this.optionsFor(pid, pend.loc).indexOf(itemId) === -1) throw new Error('You cannot take that');
        const r = this.runById(pend.key + '@' + pid);
        d.shop.pending = null;
        this.do_pick(r, pend.loc, itemId, wildSlot);
        this.advance();
    }

    /** Return the chef early (only before picking anything) for consolation. */
    public leave_early(pid: string, useBag = false) {
        const d = this.data;
        const pend = d.shop?.pending;
        if (!pend || pend.pid !== pid || pend.kind !== 'pick') throw new Error('Nothing to do right now');
        if (!pend.canLeave) throw new Error('You already picked something here');
        const r = this.runById(pend.key + '@' + pid);
        d.shop!.pending = null;
        r.extraUsed = true;
        r.done = true;
        d.shop!.turn++;
        this.log('soup', 'left early', { pid, loc: pend.loc });
        this.consolation(pid, useBag);
        if (r.zous === 'penny') {
            d.shop!.pending = { pid: r.pid, key: r.key, loc: 'soup', kind: 'penny', canLeave: false, canStar: false, picksLeft: 1 };
        }
        this.advance();
    }

    /** Marie Butterfly: a star instead of an item. */
    public take_star(pid: string) {
        const d = this.data;
        const pend = d.shop?.pending;
        if (!pend || pend.pid !== pid || !pend.canStar) throw new Error('No star on offer');
        const r = this.runById(pend.key + '@' + pid);
        d.shop!.pending = null;
        r.starInstead = true;
        r.done = true;
        d.shop!.turn++;
        this.star(pid, 1, 'Marie Butterfly');
        this.advance();
    }

    private cleanup_location(loc: LocId) {
        const d = this.data;
        const left = d.locItems[loc];
        if (loc === 'soup') return; // leftovers stay on the truck
        const keepFood = left.filter(i => i.k === 'ing' || i.k === 'spice');
        if (loc === 'academy') {
            d.locItems.soup.push(...keepFood);
        } else {
            d.locItems.academy.push(...keepFood);
        }
        d.locItems[loc] = [];
    }

    private end_round() {
        const d = this.data;
        d.shop = null;
        d.placements = {};
        this.playerIds.forEach(pid => {
            const p = d.players[pid];
            p.zous = [];
            p.plan = null;
            p.ready = false;
        });
        // Marcus Roostersson
        d.priority.slice().forEach(pid => {
            if (d.players[pid].rest !== 'marcus') return;
            const i = d.priority.indexOf(pid);
            if (i === 0) this.gainFromBag(pid, 'Marcus Roostersson');
            else { d.priority.splice(i, 1); d.priority.splice(i - 1, 0, pid); this.log('priority', 'Marcus Roostersson steps forward', { pid }); }
        });
        if (d.round === 3 || d.round === 6 || (d.round === 7 && d.hippoChallenge)) {
            this.begin_challenges();
        } else if (d.round === 7) {
            this.begin_critic();
        } else {
            this.start_round(d.round + 1);
        }
    }

    // =====================================================================
    // challenges
    // =====================================================================

    public mealCtx(pid: string): MealCtx {
        const p = this.data.players[pid];
        return { critic: this.data.critic, rest: p.rest, rumorTokens: p.rumorSlots.filter(x => x).length };
    }

    private begin_challenges() {
        const d = this.data;
        const offered: OfferedChallenge[] = [];
        if (d.round === 3 || d.round === 6) {
            const base = d.round === 3 ? 0 : 3;
            for (let i = 0; i < 3; i++) {
                const id = d.challenges[base + i];
                const req = CHALLENGE_BY_ID[id].req.slice();
                offered.push({ id, req: i === 2 ? req.slice(0, 2) : req, hippo: false });
            }
        }
        if (d.hippoChallenge) offered.push({ id: d.hippoChallenge, req: CHALLENGE_BY_ID[d.hippoChallenge].req.slice(), hippo: true });
        d.offered = offered;
        this.playerIds.forEach(pid => { d.players[pid].challengePlates = null; d.players[pid].ready = false; });
        d.phase = Phase.Challenge;
        this.log('phase', d.round === 7 ? 'The Hippo\'s challenge' : `End of day ${d.round / 3}: challenge meals!`);
    }

    /** Validate a full challenge submission; returns per-plate evaluations. */
    public check_challenges(pid: string, plates: ChallengePlate[]): ChallengeEval[] {
        const d = this.data;
        const p = d.players[pid];
        const map = itemMap(p.storage);
        const ctx = this.mealCtx(pid);
        const seenSlots = new Set<number>();
        const used = new Set<number>();
        const out: ChallengeEval[] = [];
        for (const pl of plates) {
            if (!d.offered[pl.slot]) throw new Error('Unknown challenge');
            if (seenSlots.has(pl.slot)) throw new Error('One meal per challenge');
            seenSlots.add(pl.slot);
            // Herón Sanchez may share one spice across a single plate
            const raw = plateItemIds(pl);
            const ids = ctx.rest === 'heron' ? Array.from(new Set(raw)) : raw;
            for (const id of ids) {
                if (!map[id]) throw new Error('You do not have that item');
                if (used.has(id)) throw new Error('Each item can be served once');
                used.add(id);
            }
            const ev = evaluateChallenge(pl, d.offered[pl.slot].req, map, ctx);
            if (!ev.ok) throw new Error(`${CHALLENGE_BY_ID[d.offered[pl.slot].id].name}: ${ev.error}`);
            out.push(ev);
        }
        return out;
    }

    public submit_challenges(pid: string, plates: ChallengePlate[]) {
        const d = this.data;
        if (d.phase !== Phase.Challenge) throw new Error('Not serving challenges now');
        const cleaned = (plates || []).filter(pl => pl.ings.length || pl.soups.length);
        this.check_challenges(pid, cleaned);
        d.players[pid].challengePlates = cleaned;
        d.players[pid].ready = true;
        if (this.playerIds.every(id => d.players[id].challengePlates)) this.score_challenges();
    }

    public unsubmit(pid: string) {
        const d = this.data;
        const p = d.players[pid];
        if (d.phase === Phase.Challenge) { p.challengePlates = null; p.ready = false; }
        else if (d.phase === Phase.Critic) { p.criticPlate = null; p.ready = false; }
        else if (d.phase === Phase.Fridge && this.overLimit(pid) > 0) { p.fridgeDiscard = null; p.ready = false; }
        else if (d.phase === Phase.Planning) this.unsubmit_plan(pid);
    }

    private score_challenges() {
        const d = this.data;
        this.playerIds.forEach(pid => {
            const p = d.players[pid];
            const evs = this.check_challenges(pid, p.challengePlates!);
            let regular = 0;
            p.challengePlates!.forEach((pl, i) => {
                const ev = evs[i];
                const off = d.offered[pl.slot];
                const name = CHALLENGE_BY_ID[off.id].name;
                if (ev.baseStars > 0 && !off.hippo) regular++;
                p.challengeResults.push({ round: d.round, challengeId: off.id, quality: ev.quality, stars: ev.stars });
                if (ev.baseStars > 0) {
                    this.star(pid, ev.baseStars, `${name} (quality ${ev.quality})`);
                    ev.bonus.forEach(b => this.star(pid, b.n, b.reason));
                } else {
                    this.log('challenge', `${name}: quality ${ev.quality} is not good enough to present`, { pid });
                }
                // served items leave the kitchen
                const ids = new Set(plateItemIds(pl));
                const served = p.storage.filter(it => ids.has(it.id));
                p.storage = p.storage.filter(it => !ids.has(it.id));
                this.returnToBag(served);
            });
            const regularCount = d.offered.filter(o => !o.hippo).length;
            if (p.rest === 'martha' && regularCount === 3 && regular === 3) this.star(pid, 2, 'Martha Shrewart (all 3)');
            p.challengePlates = null;
            p.ready = false;
        });
        d.offered = [];
        if (d.round === 7) { this.begin_critic(); return; }
        this.begin_fridge();
    }

    // =====================================================================
    // refrigeration
    // =====================================================================

    public fridgeLimit(): number { return this.data.round <= 3 ? FRIDGE_LIMIT_DAY1 : FRIDGE_LIMIT_DAY2; }

    public countsForFridge(it: Item): boolean {
        const c = this.data.critic;
        if (it.k === 'ing') {
            if (c === 'raccoon' && it.v === 2) return false;
            if (c === 'hyena' && it.v === 3) return false;
            return true;
        }
        if (it.k === 'spice') return c !== 'pig';
        return false;
    }

    public overLimit(pid: string): number {
        const n = this.data.players[pid].storage.filter(it => this.countsForFridge(it)).length;
        return Math.max(0, n - this.fridgeLimit());
    }

    private begin_fridge() {
        const d = this.data;
        d.phase = Phase.Fridge;
        this.playerIds.forEach(pid => {
            const p = d.players[pid];
            const over = this.overLimit(pid);
            p.fridgeDiscard = over > 0 ? null : [];
            p.ready = over === 0;
        });
        this.log('phase', `Refrigerate: keep up to ${this.fridgeLimit()} ingredients & spices`);
        this.maybe_finish_fridge();
    }

    public submit_fridge(pid: string, discard: number[]) {
        const d = this.data;
        if (d.phase !== Phase.Fridge) throw new Error('Not refrigerating now');
        const p = d.players[pid];
        const over = this.overLimit(pid);
        const ids = Array.from(new Set(discard || []));
        for (const id of ids) {
            const it = p.storage.find(i => i.id === id);
            if (!it || !this.countsForFridge(it)) throw new Error('You can only return refrigerated items');
        }
        if (ids.length < over) throw new Error(`Return at least ${over} item${over > 1 ? 's' : ''}`);
        p.fridgeDiscard = ids;
        p.ready = true;
        this.maybe_finish_fridge();
    }

    private maybe_finish_fridge() {
        const d = this.data;
        if (!this.playerIds.every(id => d.players[id].fridgeDiscard)) return;
        this.playerIds.forEach(pid => {
            const p = d.players[pid];
            const ids = new Set(p.fridgeDiscard!);
            const out = p.storage.filter(i => ids.has(i.id));
            p.storage = p.storage.filter(i => !ids.has(i.id));
            this.returnToBag(out);
            if (out.length) this.log('info', `returned ${out.length} item${out.length > 1 ? 's' : ''} to the bag`, { pid });
            p.fridgeDiscard = null;
            p.ready = false;
        });
        this.start_round(d.round + 1);
    }

    // =====================================================================
    // critic meal & final scoring
    // =====================================================================

    /** Items a player may put on the critic plate (storage + Jerboa rumor tokens). */
    public criticPool(pid: string): Item[] {
        const p = this.data.players[pid];
        const pool = p.storage.slice();
        if (this.data.critic === 'jerboa') p.rumorSlots.forEach(t => { if (t) pool.push(t); });
        return pool;
    }

    private begin_critic() {
        const d = this.data;
        d.phase = Phase.Critic;
        this.playerIds.forEach(pid => { d.players[pid].criticPlate = null; d.players[pid].ready = false; });
        this.log('phase', 'The critic arrives — prepare the 7-course meal!');
    }

    public submit_critic(pid: string, plate: CriticPlate) {
        const d = this.data;
        if (d.phase !== Phase.Critic) throw new Error('Not preparing the critic meal now');
        const ev = evaluateCritic(plate || {}, itemMap(this.criticPool(pid)), this.mealCtx(pid));
        if (!ev.ok) throw new Error(ev.error);
        d.players[pid].criticPlate = plate;
        d.players[pid].ready = true;
        if (this.playerIds.every(id => d.players[id].criticPlate)) this.final_scoring();
    }

    public all_rumors(): RumorId[] {
        const d = this.data;
        return [...d.rumorCards, ...Object.keys(d.jamieRumor).map(k => d.jamieRumor[k])];
    }

    private final_scoring() {
        const d = this.data;
        const inputs: FinalInput[] = this.playerIds.map(pid => {
            const p = d.players[pid];
            const ctx = this.mealCtx(pid);
            const ev = evaluateCritic(p.criticPlate!, itemMap(this.criticPool(pid)), ctx);
            const served = new Set(criticPlateIds(p.criticPlate!));
            const leftovers = p.storage.filter(i => !served.has(i.id) && (i.k === 'ing' || i.k === 'spice'));
            const soup = p.storage.filter(i => !served.has(i.id)).reduce((a, i) => a + soupValue(i), 0);
            return {
                pid, ctx, courses: ev.courses, soup, rumorTokens: p.rumorTokens, leftovers,
                restStars: p.rest ? REST_BY_ID[p.rest].stars : 0
            };
        });
        const results = scoreFinal(inputs, this.all_rumors(), d.critic);
        d.final = results;
        results.forEach(res => {
            res.lines.forEach(l => this.star(res.pid, l.n, l.label));
        });
        d.revealed = [true, true, true];
        // winner: stars, then furthest on the score track (meal quality), then priority
        const ranked = this.playerIds.slice().sort((a, b) => {
            const sa = d.players[a].stars, sb = d.players[b].stars;
            if (sb !== sa) return sb - sa;
            const qa = results.find(x => x.pid === a)!.quality, qb = results.find(x => x.pid === b)!.quality;
            if (qb !== qa) return qb - qa;
            return this.prioRank(a) - this.prioRank(b);
        });
        d.winners = [ranked[0]];
        d.phase = Phase.GameOver;
        this.log('phase', 'The critic has spoken!');
    }

    // =====================================================================
    // queries
    // =====================================================================

    public phase(): Phase { return this.data.phase; }
    public round(): number { return this.data.round; }
    public player(pid: string): PlayerState { return this.data.players[pid]; }
    public pending(): Pending | null { return this.data.shop ? this.data.shop.pending : null; }

    /** Who still has to act in the current simultaneous phase. */
    public waitingOn(): string[] {
        const d = this.data;
        switch (d.phase) {
            case Phase.Restaurateur: return this.playerIds.filter(id => !d.players[id].rest);
            case Phase.Planning: return this.playerIds.filter(id => !d.players[id].plan);
            case Phase.Shopping: return d.shop?.pending ? [d.shop.pending.pid] : [];
            case Phase.Challenge: return this.playerIds.filter(id => !d.players[id].challengePlates);
            case Phase.Fridge: return this.playerIds.filter(id => !d.players[id].fridgeDiscard);
            case Phase.Critic: return this.playerIds.filter(id => !d.players[id].criticPlate);
            default: return [];
        }
    }

    public day(): number { return Math.min(3, Math.ceil(this.data.round / 3)); }

    // =====================================================================
    // auto-play (host "nudge" for a stalled player, and headless tests)
    // =====================================================================

    private itemScore(pid: string, it: Item): number {
        const ctx = this.mealCtx(pid);
        if (it.k === 'ing') return baseValue(it, ctx, 'critic') + 1;
        if (it.k === 'spice') return it.t === 'all' ? 9 : 6;
        if (it.k === 'zous') return 7;
        if (it.k === 'rumor') return 5;
        if (it.k === 'bisque') return 3.5;
        return 1;
    }

    public auto_act(pid: string) {
        const d = this.data;
        switch (d.phase) {
            case Phase.Restaurateur:
                if (!d.players[pid].rest) this.choose_restaurateur(pid, d.players[pid].restOptions[0]);
                return;
            case Phase.Planning: {
                if (d.players[pid].plan) return;
                const keys = this.chefKeysFor(pid);
                const locs = this.shuffle(d.locations.slice());
                const plan: Record<string, LocId> = {};
                keys.forEach((k, i) => { plan[k] = locs[i]; });
                this.submit_plan(pid, plan);
                return;
            }
            case Phase.Shopping: {
                const pend = d.shop?.pending;
                if (!pend || pend.pid !== pid) return;
                const opts = pend.kind === 'penny' ? this.optionsFor(pid, 'soup') : this.optionsFor(pid, pend.loc);
                const pool = d.locItems[pend.kind === 'penny' ? 'soup' : pend.loc];
                let best = opts[0];
                let bestS = -1;
                opts.forEach(id => {
                    const it = id === SOUP_PICK ? { id, k: 'soup' } as Item : pool.find(i => i.id === id)!;
                    const sc = this.itemScore(pid, it);
                    if (sc > bestS) { bestS = sc; best = id; }
                });
                this.pick(pid, best);
                return;
            }
            case Phase.Challenge: {
                if (d.players[pid].challengePlates) return;
                const pool = d.players[pid].storage;
                const ctx = this.mealCtx(pid);
                const taken = new Set<number>();
                const plates: ChallengePlate[] = [];
                d.offered.forEach((o, slot) => {
                    const pl = suggestChallengePlate(slot, o.req, pool, ctx, taken);
                    const ev = evaluateChallenge(pl, o.req, itemMap(pool), ctx);
                    if (ev.ok && ev.baseStars > 0) {
                        plates.push(pl);
                        plateItemIds(pl).forEach(id => taken.add(id));
                    }
                });
                try { this.submit_challenges(pid, plates); } catch (e) { this.submit_challenges(pid, []); }
                return;
            }
            case Phase.Fridge: {
                if (d.players[pid].fridgeDiscard) return;
                const over = this.overLimit(pid);
                const cands = d.players[pid].storage.filter(i => this.countsForFridge(i))
                    .sort((a, b) => this.itemScore(pid, a) - this.itemScore(pid, b));
                this.submit_fridge(pid, cands.slice(0, over).map(i => i.id));
                return;
            }
            case Phase.Critic: {
                if (d.players[pid].criticPlate) return;
                const plate = suggestCriticPlate(this.criticPool(pid), this.mealCtx(pid));
                try { this.submit_critic(pid, plate); } catch (e) { this.submit_critic(pid, {}); }
                return;
            }
        }
    }

    /** One-line helper used in logs/toasts. */
    public describeItem(it: Item): string { return itemLabel(it); }
}

export { ING_NAMES };
