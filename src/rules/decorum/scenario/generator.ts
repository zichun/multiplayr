/**
 * generator.ts — builds Décorum scenarios that are free of contradiction.
 *
 * Method ("witness first"):
 *   1. Roll a random *solution* house.
 *   2. For each player, draw candidate conditions from templates weighted by
 *      difficulty and keep only those TRUE in the solution. Every card is
 *      therefore jointly satisfiable — the solution is a witness — so no
 *      scenario can contain a contradiction, within a card or across players.
 *   3. Reject candidates that are trivial (almost always / almost never true
 *      on a random house), duplicates, or redundant with the player's other
 *      conditions (we search sampled houses for one where the rest of the card
 *      holds but this condition fails — if none exists it adds nothing).
 *   4. Scramble the solution by k distinct feature changes to get the setup.
 *      Every player must start with at least one unmet condition.
 *   5. Play it out with "selfish" simulated players — each turn the active
 *      player makes whichever change best improves their *own* card, blind to
 *      everyone else's. A scenario selfish play wins quickly is easy no matter
 *      how obscure its conditions read; hard ones need compromise to win.
 *   6. Score the result (selfish-play rounds, specificity of conditions,
 *      cross-player tension, distance from setup to solution) and keep the
 *      candidate whose score is closest to the level's target.
 *
 * Roommates board (3–4 players): the witness also fixes who sleeps in which
 * upstairs bedroom, cards may hold conditions relative to their owner ("your
 * bedroom…", "share a bedroom with…"), every card gets at least one, the setup
 * may also shuffle the bedrooms, and the selfish play-out can switch rooms.
 *
 * Twists (twists.ts): the seed also draws a few house twists (more on harder
 * levels; none when switched off). Their details are fitted to the witness —
 * the heirloom is one of its objects, a sold-out colour is never needed on a
 * wall that the setup must repaint, a shortage never binds the witness — and
 * locked features are left alone by the scramble, so the witness stays
 * reachable. The selfish play-out obeys every twist, so a twist's real effect
 * on difficulty is measured, and the cat (if any) appears in some conditions.
 *
 * Everything is seeded, so (players, level, seed) always rebuilds the same
 * scenario — that triple (plus "-N" for no twists) is the shareable "scenario code".
 */

import {
    House, ObjType, Zone, RoomId, COLORS, STYLES, TYPES, ROOMS, cloneHouse, houseDistance, ZONE_ROOMS, isSingleRoom,
    legalMoves, applyMove, Board, boardFor, Beds, BEDROOMS, BEDROOM_CAPACITY, Ctx, legalSwitches, applySwitch, bedsDistance, Color, Style
} from './model';
import { Condition, Filter, Op, evaluate, condKey, COND_TIER, isRoommateCond, isCatCond } from './conditions';
import { Twists, TwistId, TWIST_GROUP, Memo, emptyMemo, nextMemo, changedRoom, twistError, houseAllowed, countStyle, twistList } from './twists';
import { Rng, makeRng, next, int, between, pick, chance, shuffle, weighted } from './rng';

export type Level = 'easy' | 'medium' | 'hard' | 'expert';
export const LEVELS: Level[] = ['easy', 'medium', 'hard', 'expert'];
export const LEVEL_NAME: Record<Level, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Expert' };
export const LEVEL_STARS: Record<Level, number> = { easy: 1, medium: 2, hard: 3, expert: 4 };

export interface Scenario {
    seed: number;
    players: number;
    level: Level;
    code: string;
    title: string;
    /** 'roommates' for 3–4 players: both upstairs rooms are bedrooms. */
    board: Board;
    /** The house the game starts from. */
    setup: House;
    /** One house that satisfies every condition (the witness). Secret until the end. */
    solution: House;
    /** Roommates board: setupBeds[seat] / solutionBeds[seat] = that seat's bedroom. null on the classic board. */
    setupBeds: Beds | null;
    solutionBeds: Beds | null;
    /** cards[i] = conditions of the i-th seat. */
    cards: Condition[][];
    /** House twists in play (empty object = none). The cat's rooms are `setup.pet` / `solution.pet`. */
    twists: Twists;
    stats: ScenarioStats;
}

export interface ScenarioStats {
    conditions: number;
    /** Sum over conditions of −log2(probability a random house satisfies it). */
    specificity: number;
    /** Cross-player condition pairs that tend to exclude each other. */
    conflicts: number;
    /** Unmet-at-setup conditions whose quick fixes mostly hurt another seat. */
    contested: number;
    /** Features that differ between setup and solution. */
    distance: number;
    /** Conditions unmet at setup. */
    unmet: number;
    /** Mean rounds selfish simulated players need to win (unsolved counts as SELFISH_CAP + 2). */
    selfish: number;
    /** Share of selfish simulations that won within SELFISH_CAP rounds. */
    selfishWins: number;
    score: number;
    attempts: number;
}

interface LevelCfg {
    tiers: [number, number, number];
    /** Chance that a slot insists on a condition pulling against another seat's. */
    tension: number;
    pRange: [number, number];
    moves: [number, number];
    minConflicts: number;
    target: number;
    /** Selfish play should need at least this many rounds on average. */
    minSelfish: number;
    /** Candidate scenarios built per generation, and starting houses tried per candidate. */
    candidates: number;
    setups: number;
    perPlayer: Record<number, number[]>;   // players → conditions per seat
}

const CFG: Record<Level, LevelCfg> = {
    easy: {
        tension: 0.4,
        tiers: [0.7, 0.3, 0], pRange: [0.08, 0.72], moves: [5, 7], minConflicts: 1, target: 0, minSelfish: 4, candidates: 6, setups: 2,
        perPlayer: { 2: [4, 4], 3: [3, 3, 3], 4: [3, 3, 3, 3] }
    },
    medium: {
        tension: 0.7,
        tiers: [0.25, 0.5, 0.25], pRange: [0.04, 0.66], moves: [8, 9], minConflicts: 2, target: 0, minSelfish: 9, candidates: 8, setups: 2,
        perPlayer: { 2: [5, 5], 3: [4, 4, 4], 4: [4, 4, 4, 4] }
    },
    hard: {
        tension: 0.9,
        tiers: [0.15, 0.45, 0.4], pRange: [0.03, 0.62], moves: [9, 11], minConflicts: 3, target: 0, minSelfish: 11.5, candidates: 10, setups: 3,
        perPlayer: { 2: [6, 6], 3: [5, 5, 5], 4: [4, 4, 4, 4] }
    },
    expert: {
        tension: 0.95,
        tiers: [0.05, 0.4, 0.55], pRange: [0.02, 0.58], moves: [10, 12], minConflicts: 4, target: 0, minSelfish: 13, candidates: 10, setups: 3,
        perPlayer: { 2: [6, 6], 3: [5, 5, 5], 4: [5, 5, 5, 5] }
    }
};

/** Target difficulty scores (calibrated from the generator's own distribution; see tests). */
const TARGET: Record<Level, number> = { easy: 42, medium: 74, hard: 94, expert: 108 };

export const conditionsPerSeat = (players: number, level: Level): number[] => CFG[level].perPlayer[players] || [];

// ---------------------------------------------------------------------------
// Scenario codes: "3H-1A2B3C" = players · level letter (E/M/H/X) · seed (base 36),
// with "-N" appended when house twists are switched off ("3H-1A2B3C-N").
// ---------------------------------------------------------------------------

const LEVEL_LETTER: Record<Level, string> = { easy: 'E', medium: 'M', hard: 'H', expert: 'X' };

export function scenarioCode(players: number, level: Level, seed: number, twists = true): string {
    return `${players}${LEVEL_LETTER[level]}-${(seed >>> 0).toString(36).toUpperCase()}${twists ? '' : '-N'}`;
}

export function parseScenarioCode(code: string): { players: number; level: Level; seed: number; twists: boolean } | null {
    const m = /^\s*([234])([EMHX])-([0-9A-Z]{1,7})(-N)?\s*$/i.exec(code || '');
    if (!m) return null;
    const level = LEVELS.find(l => LEVEL_LETTER[l] === m[2].toUpperCase()) as Level;
    const seed = parseInt(m[3], 36);
    if (!isFinite(seed) || seed > 0xffffffff) return null;
    return { players: +m[1], level, seed: seed >>> 0, twists: !m[4] };
}

// ---------------------------------------------------------------------------
// Which twists (drawn from their own stream, so twist-free scenarios are unaffected)
// ---------------------------------------------------------------------------

const TWIST_WEIGHT: Record<TwistId, number> = {
    cat: 3, heirloom: 2, keeper: 2, shortage: 2, soldOut: 2, noRepeat: 1.5, wetPaint: 1.5, binary: 1.2, whisper: 1
};
/** Gentle twists for Easy. */
const EASY_TWISTS: TwistId[] = ['cat', 'heirloom', 'soldOut', 'binary'];

/** How many twists, and which, for this seed. */
export function pickTwists(seed: number, level: Level): TwistId[] {
    const r = makeRng((seed ^ 0x2c1b3c6d) >>> 0);
    const n = level === 'easy' ? (chance(r, 0.5) ? 1 : 0)
        : level === 'medium' ? 1
            : level === 'hard' ? (chance(r, 0.6) ? 2 : 1)
                : (chance(r, 0.3) ? 3 : 2);
    const out: TwistId[] = [];
    for (let i = 0; i < n; i++) {
        const pool = (level === 'easy' ? EASY_TWISTS : Object.keys(TWIST_WEIGHT) as TwistId[])
            .filter(id => !out.some(o => TWIST_GROUP[o] === TWIST_GROUP[id]));
        if (!pool.length) break;
        out.push(weighted(r, pool, pool.map(id => TWIST_WEIGHT[id])));
    }
    return out;
}

// ---------------------------------------------------------------------------
// Random houses
// ---------------------------------------------------------------------------

export function randomHouse(r: Rng, fill = 0.6, cat = false): House {
    const h: any = {};
    ROOMS.forEach(room => {
        h[room] = { wall: pick(r, COLORS), hanging: null, lamp: null, curio: null };
        TYPES.forEach(t => { if (chance(r, fill)) h[room][t] = pick(r, STYLES); });
    });
    if (cat) h.pet = pick(r, ROOMS);
    return h;
}

type Feature = { room: RoomId; type: ObjType | 'wall' };
const FEATURES: Feature[] = [];
ROOMS.forEach(room => { FEATURES.push({ room, type: 'wall' }); TYPES.forEach(type => FEATURES.push({ room, type })); });
const featureKey = (f: Feature) => `${f.room}:${f.type}`;

/** Change one feature to a different value. */
function mutate(r: Rng, h: House, f: Feature) {
    const room = h[f.room];
    if (f.type === 'wall') {
        room.wall = pick(r, COLORS.filter(c => c !== room.wall));
        return;
    }
    const cur = room[f.type];
    if (!cur) room[f.type] = pick(r, STYLES);
    else if (chance(r, 0.45)) room[f.type] = null;
    else room[f.type] = pick(r, STYLES.filter(s => s !== cur));
}

/** A house exactly `k` features away from `h`, never touching `locked` features ("room:type"). */
export function scramble(r: Rng, h: House, k: number, locked?: Set<string> | null): House {
    const out = cloneHouse(h);
    const feats = locked && locked.size ? FEATURES.filter(f => !locked.has(featureKey(f))) : FEATURES;
    shuffle(r, feats).slice(0, k).forEach(f => mutate(r, out, f));
    return out;
}

/** A random walk of `k` changes (may revisit features). */
function walk(r: Rng, h: House, k: number): House {
    const out = cloneHouse(h);
    for (let i = 0; i < k; i++) mutate(r, out, pick(r, FEATURES));
    return out;
}

/** A random bedroom assignment: at most two per bedroom (3 players: 2 + 1, 4 players: 2 + 2). */
export function randomBeds(r: Rng, players: number): Beds {
    const seats = shuffle(r, Array.from({ length: players }, (_, i) => i));
    const first = pick(r, BEDROOMS);
    const beds: Beds = new Array(players);
    seats.forEach((seat, i) => { beds[seat] = i < BEDROOM_CAPACITY ? first : (first === 'bath' ? 'bed' : 'bath'); });
    return beds;
}

/** A house plus (roommates board) who sleeps where, plus (turn-rule twists) recent turns. */
interface World { h: House; beds: Beds | null; memo?: Memo; }

const ctxOf = (w: World, seat: number): Ctx | null => w.beds ? { beds: w.beds, seat } : null;
const holds = (c: Condition, w: World, seat: number) => evaluate(c, w.h, ctxOf(w, seat));

/**
 * Every action `seat` could take in `w` under the twists: one change to the
 * house (or a cat walk), or (roommates board) a bedroom switch.
 */
function worldActions(w: World, seat: number, tw: Twists | null = null): World[] {
    const turnRules = !!tw && (!!tw.noRepeat || !!tw.wetPaint);
    const memo = turnRules ? (w.memo || emptyMemo(w.beds ? w.beds.length : 4)) : undefined;
    const out: World[] = [];
    for (const m of legalMoves(w.h)) {
        if (tw && twistError(tw, w.h, m, seat, memo)) continue;
        out.push({ h: applyMove(w.h, m), beds: w.beds, memo: memo && nextMemo(memo, seat, changedRoom(m)) });
    }
    if (w.beds) legalSwitches(w.beds, seat).forEach(sw => out.push({ h: w.h, beds: applySwitch(w.beds!, sw), memo: memo && nextMemo(memo, seat, null) }));
    return out;
}

// ---------------------------------------------------------------------------
// Condition templates
// ---------------------------------------------------------------------------

const MULTI_ZONES: Zone[] = ['house', 'up', 'down', 'left', 'right'];
const PAIR_ZONES: Zone[] = ['up', 'down', 'left', 'right'];
const ALL_ZONES: Zone[] = ['house', 'up', 'down', 'left', 'right', 'bath', 'bed', 'living', 'kitchen'];

function filterT1(r: Rng, zone: Zone): Filter {
    const kinds = ['type', 'type', 'color', 'color', 'specific', 'wall', 'empty'];
    if (zone === 'house') kinds.push('object');
    const k = pick(r, kinds);
    switch (k) {
        case 'type': return { f: 'type', type: pick(r, TYPES) };
        case 'color': return { f: 'color', color: pick(r, COLORS) };
        case 'specific': return { f: 'specific', type: pick(r, TYPES), style: pick(r, STYLES) };
        case 'wall': return { f: 'wall', color: pick(r, COLORS) };
        case 'empty': return { f: 'empty' };
        default: return { f: 'object' };
    }
}

function filterT2(r: Rng): Filter {
    const k = pick(r, ['style', 'style', 'temp', 'temp', 'wallTemp', 'feature', 'feature', 'featureTemp']);
    switch (k) {
        case 'style': return { f: 'style', style: pick(r, STYLES) };
        case 'temp': return { f: 'temp', warm: chance(r, 0.5) };
        case 'wallTemp': return { f: 'wallTemp', warm: chance(r, 0.5) };
        case 'feature': return { f: 'feature', color: pick(r, COLORS) };
        default: return { f: 'featureTemp', warm: chance(r, 0.5) };
    }
}

const anyFilter = (r: Rng, zone: Zone): Filter => chance(r, 0.5) ? filterT1(r, zone) : filterT2(r);

/** Filters that make sense inside one room for "inseparable". */
function roomFilter(r: Rng): Filter {
    const k = pick(r, ['type', 'color', 'style', 'empty', 'temp', 'wall']);
    switch (k) {
        case 'type': return { f: 'type', type: pick(r, TYPES) };
        case 'color': return { f: 'color', color: pick(r, COLORS) };
        case 'style': return { f: 'style', style: pick(r, STYLES) };
        case 'empty': return { f: 'empty' };
        case 'temp': return { f: 'temp', warm: chance(r, 0.5) };
        default: return { f: 'wall', color: pick(r, COLORS) };
    }
}

/** Two different filters of the same family, for "more X than Y". */
function comparablePair(r: Rng): [Filter, Filter] {
    const k = pick(r, ['type', 'color', 'temp', 'style', 'featureTemp', 'objEmpty']);
    switch (k) {
        case 'type': { const [a, b] = shuffle(r, TYPES); return [{ f: 'type', type: a }, { f: 'type', type: b }]; }
        case 'color': { const [a, b] = shuffle(r, COLORS); return [{ f: 'color', color: a }, { f: 'color', color: b }]; }
        case 'style': { const [a, b] = shuffle(r, STYLES); return [{ f: 'style', style: a }, { f: 'style', style: b }]; }
        case 'temp': { const w = chance(r, 0.5); return [{ f: 'temp', warm: w }, { f: 'temp', warm: !w }]; }
        case 'featureTemp': { const w = chance(r, 0.5); return [{ f: 'featureTemp', warm: w }, { f: 'featureTemp', warm: !w }]; }
        default: return chance(r, 0.5) ? [{ f: 'object' }, { f: 'empty' }] : [{ f: 'empty' }, { f: 'object' }];
    }
}

const sameFilter = (a: Filter, b: Filter) => JSON.stringify(a) === JSON.stringify(b);

function templateT1(r: Rng): Condition {
    const roll = next(r);
    if (roll < 0.42) { const zone = pick(r, ALL_ZONES); return { c: 'has', zone, filter: filterT1(r, zone) }; }
    if (roll < 0.8) { const zone = pick(r, ALL_ZONES); return { c: 'not', zone, filter: filterT1(r, zone) }; }
    const zone = pick(r, MULTI_ZONES);
    const filter = pick(r, [{ f: 'type', type: pick(r, TYPES) }, { f: 'color', color: pick(r, COLORS) }, { f: 'object' }, { f: 'empty' }] as Filter[]);
    return { c: 'count', zone, filter, op: '>=', n: between(r, 2, zone === 'house' ? 4 : 3) };
}

function templateT2(r: Rng): Condition {
    const roll = next(r);
    if (roll < 0.22) {
        const zone = pick(r, MULTI_ZONES);
        let filter = anyFilter(r, zone);
        if (filter.f === 'wall' || filter.f === 'specific') filter = filterT2(r);
        return { c: 'every', zone, filter };
    }
    if (roll < 0.42) {
        const zone = pick(r, ALL_ZONES);
        return chance(r, 0.5) ? { c: 'has', zone, filter: filterT2(r) } : { c: 'not', zone, filter: filterT2(r) };
    }
    if (roll < 0.66) {
        const zone = pick(r, MULTI_ZONES);
        const op: Op = chance(r, 0.55) ? '==' : '<=';
        return { c: 'count', zone, filter: anyFilter(r, zone), op, n: between(r, 1, zone === 'house' ? 4 : 2) };
    }
    if (roll < 0.83) return { c: 'wallsSame', zone: pick(r, PAIR_ZONES) };
    return { c: 'matchWall', zone: pick(r, ROOMS) };
}

function templateT3(r: Rng): Condition {
    const roll = next(r);
    if (roll < 0.24) { const [a, b] = comparablePair(r); return { c: 'more', zone: pick(r, ['house', 'house', 'up', 'down', 'left', 'right'] as Zone[]), a, b }; }
    if (roll < 0.42) {
        const zone = pick(r, ['house', 'house', 'up', 'down', 'left', 'right'] as Zone[]);
        return chance(r, 0.6) ? { c: 'most', zone, color: pick(r, COLORS) } : { c: 'most', zone, style: pick(r, STYLES) };
    }
    if (roll < 0.62) {
        const a = roomFilter(r);
        let b = roomFilter(r);
        for (let i = 0; i < 5 && (sameFilter(a, b) || (a.f === 'wall' && b.f === 'wall')); i++) b = roomFilter(r);
        return { c: 'insep', a, b };
    }
    if (roll < 0.72) return { c: 'wallsDiff' };
    if (roll < 0.82) return { c: 'noIdentical' };
    if (roll < 0.91) return { c: 'matchWall', zone: pick(r, MULTI_ZONES) };
    const zone = pick(r, MULTI_ZONES);
    return { c: 'every', zone, filter: filterT2(r) };
}

/** Conditions relative to their owner (roommates board). */
function templateRoommate(r: Rng, players: number, seat: number): Condition {
    const others = Array.from({ length: players }, (_, i) => i).filter(i => i !== seat);
    const roll = next(r);
    if (roll < 0.22) return { c: 'has', zone: 'mine', filter: chance(r, 0.6) ? filterT1(r, 'mine') : filterT2(r) };
    if (roll < 0.44) return { c: 'not', zone: 'mine', filter: chance(r, 0.6) ? filterT1(r, 'mine') : filterT2(r) };
    if (roll < 0.54) {
        const zone: Zone = chance(r, 0.5) ? 'other' : 'mine';
        return chance(r, 0.5) ? { c: 'has', zone, filter: filterT1(r, zone) } : { c: 'not', zone, filter: filterT1(r, zone) };
    }
    if (roll < 0.62) {
        const filter = pick(r, [{ f: 'object' }, { f: 'empty' }, { f: 'temp', warm: chance(r, 0.5) }, { f: 'style', style: pick(r, STYLES) }] as Filter[]);
        return { c: 'count', zone: 'mine', filter, op: pick(r, ['>=', '==', '<='] as Op[]), n: between(r, 1, 2) };
    }
    if (roll < 0.68) return { c: 'matchWall', zone: 'mine' };
    if (roll < 0.86) return { c: 'with', seat: pick(r, others) };
    if (roll < 0.96 || players < 3) return { c: 'apart', seat: pick(r, others) };
    return { c: 'alone' };
}

/** Conditions about the house cat. */
function templateCat(r: Rng, roommates: boolean): Condition {
    const zones: Zone[] = ['up', 'down', 'left', 'right', 'bath', 'bed', 'living', 'kitchen'];
    if (roommates) zones.push('mine', 'mine', 'other');
    const roll = next(r);
    if (roll < 0.3) return { c: 'catIn', zone: pick(r, zones) };
    if (roll < 0.48) return { c: 'catOut', zone: pick(r, zones) };
    const filter = chance(r, 0.6) ? filterT1(r, 'bath') : filterT2(r);
    return roll < 0.78 ? { c: 'catNear', filter } : { c: 'catAway', filter };
}

function randomCondition(r: Rng, tiers: [number, number, number]): Condition {
    const tier = weighted(r, [1, 2, 3], tiers);
    return tier === 1 ? templateT1(r) : tier === 2 ? templateT2(r) : templateT3(r);
}

/** Effective tier (counting "exactly / at most" as tier 2). */
export function conditionTier(c: Condition): number {
    if (c.c === 'count' && c.op !== '>=') return 2;
    return COND_TIER[c.c];
}

const zoneSize = (z: Zone) => isSingleRoom(z) ? 1 : ZONE_ROOMS[z].length;

/** Some combinations read badly or are near-trivial; skip them. */
function wellFormed(c: Condition): boolean {
    if (c.c === 'count' && (c.filter.f === 'wall' || c.filter.f === 'wallTemp') && isSingleRoom(c.zone)) return false;
    if (c.c === 'count' && (c.filter.f === 'wallTemp' || c.filter.f === 'wall') && c.n > zoneSize(c.zone)) return false;
    if (c.c === 'count' && isSingleRoom(c.zone) && (c.filter.f === 'feature' || c.filter.f === 'featureTemp') && c.n > 4) return false;
    if (c.c === 'count' && c.op === '<=' && c.n === 0) return false;
    if (c.c === 'every' && (c.filter.f === 'object')) return false;
    if ((c.c === 'catNear' || c.c === 'catAway') && c.filter.f === 'object') return false;
    return true;
}

// ---------------------------------------------------------------------------
// Sampling: a bit-vector per condition over a fixed set of houses
// ---------------------------------------------------------------------------

interface Samples { uniform: World[]; near: World[]; }

function makeSamples(r: Rng, solution: World, players: number): Samples {
    const uniform: World[] = [];
    const near: World[] = [];
    const beds = () => solution.beds ? randomBeds(r, players) : null;
    const cat = !!solution.h.pet;
    for (let i = 0; i < 360; i++) uniform.push({ h: randomHouse(r, 0.6, cat), beds: beds() });
    for (let i = 0; i < 360; i++) {
        const h = walk(r, solution.h, 1 + int(r, 8));
        if (cat && chance(r, 0.5)) h.pet = pick(r, ROOMS);
        near.push({ h, beds: solution.beds && chance(r, 0.5) ? solution.beds : beds() });
    }
    return { uniform, near };
}

interface Cand {
    cond: Condition;
    key: string;
    p: number;            // probability on uniform houses
    bits: Uint8Array;     // uniform ++ near
}

/** Bits of `cond` (owned by `seat`) over the samples. */
function measure(cond: Condition, seat: number, s: Samples): Cand {
    const n = s.uniform.length + s.near.length;
    const bits = new Uint8Array(n);
    let hit = 0;
    s.uniform.forEach((w, i) => { if (holds(cond, w, seat)) { bits[i] = 1; hit++; } });
    s.near.forEach((w, i) => { if (holds(cond, w, seat)) bits[s.uniform.length + i] = 1; });
    return { cond, key: condKey(cond), p: hit / s.uniform.length, bits };
}

/** True when some sampled house satisfies all of `others` but not `c`. */
function informative(c: Cand, others: Cand[]): boolean {
    const n = c.bits.length;
    for (let i = 0; i < n; i++) {
        if (c.bits[i]) continue;
        let ok = true;
        for (let j = 0; j < others.length && ok; j++) ok = others[j].bits[i] === 1;
        if (ok) return true;
    }
    return false;
}

/** Same verdict on every sample — effectively the same condition. */
function equivalent(a: Cand, b: Cand): boolean {
    for (let i = 0; i < a.bits.length; i++) if (a.bits[i] !== b.bits[i]) return false;
    return true;
}

/** Correlation (phi) of two conditions over the uniform samples; < 0 means they pull apart. */
function phi(a: Cand, b: Cand, nUniform: number): number {
    let pa = 0, pb = 0, pab = 0;
    for (let k = 0; k < nUniform; k++) {
        pa += a.bits[k]; pb += b.bits[k];
        if (a.bits[k] && b.bits[k]) pab++;
    }
    pa /= nUniform; pb /= nUniform; pab /= nUniform;
    const den = Math.sqrt(pa * (1 - pa) * pb * (1 - pb));
    return den > 0 ? (pab - pa * pb) / den : 0;
}

const TENSION_PHI = -0.04;

function conflictCount(cards: Cand[][], nUniform: number): number {
    let n = 0;
    for (let i = 0; i < cards.length; i++) {
        for (let j = i + 1; j < cards.length; j++) {
            cards[i].forEach(a => cards[j].forEach(b => { if (phi(a, b, nUniform) <= TENSION_PHI) n++; }));
        }
    }
    return n;
}

/**
 * Unmet conditions at setup whose one-move fixes mostly break another seat's
 * currently-met condition (or that no single move can fix): the moments where
 * players have to read each other rather than just fix their own card.
 */
function contested(setup: World, cards: Condition[][], tw: Twists | null = null): number {
    let n = 0;
    cards.forEach((card, seat) => {
        const after = worldActions(setup, seat, tw);
        card.forEach(c => {
            if (holds(c, setup, seat)) return;
            const fixes = after.filter(w => holds(c, w, seat));
            if (!fixes.length) { n++; return; }
            const others: { c: Condition; seat: number }[] = [];
            cards.forEach((o, s2) => { if (s2 !== seat) o.forEach(x => { if (holds(x, setup, s2)) others.push({ c: x, seat: s2 }); }); });
            const breaking = fixes.filter(w => others.some(x => !holds(x.c, w, x.seat))).length;
            if (breaking * 2 >= fixes.length) n++;
        });
    });
    return n;
}

// ---------------------------------------------------------------------------
// Selfish play-out
// ---------------------------------------------------------------------------

/** Rounds a selfish play-out may take before it counts as a loss. */
export const SELFISH_CAP = 12;

/**
 * Rounds needed when every player greedily improves only their own card (ties
 * broken at random; fulfilled players pass). Averaged over `trials` runs;
 * a run that hasn't won after SELFISH_CAP rounds scores SELFISH_CAP + 2.
 */
export function selfishPlay(r: Rng, setup: House, cards: Condition[][], trials = 4, beds: Beds | null = null, tw: Twists | null = null): { rounds: number; wins: number } {
    const met = (seat: number, w: World) => { let n = 0; for (const c of cards[seat]) if (holds(c, w, seat)) n++; return n; };
    const done = (w: World) => cards.every((c, seat) => met(seat, w) === c.length);
    const start: World = { h: setup, beds, memo: tw && (tw.noRepeat || tw.wetPaint) ? emptyMemo(cards.length) : undefined };
    let total = 0, wins = 0;
    for (let t = 0; t < trials; t++) {
        let w = start;
        let rounds = SELFISH_CAP + 2;
        if (done(w)) { rounds = 0; } else {
            outer: for (let round = 1; round <= SELFISH_CAP; round++) {
                for (let seat = 0; seat < cards.length; seat++) {
                    if (met(seat, w) === cards[seat].length) {
                        // a pass still clears this seat's room for the turn rules
                        if (w.memo) w = { ...w, memo: nextMemo(w.memo, seat, null) };
                        continue;
                    }
                    let best = -1;
                    let pool: World[] = [];
                    for (const a of worldActions(w, seat, tw)) {
                        const sc = met(seat, a);
                        if (sc > best) { best = sc; pool = [a]; } else if (sc === best) pool.push(a);
                    }
                    w = pool[int(r, pool.length)];
                    if (done(w)) { rounds = round; break outer; }
                }
            }
        }
        if (rounds <= SELFISH_CAP) wins++;
        total += rounds;
    }
    return { rounds: total / trials, wins: wins / trials };
}

// ---------------------------------------------------------------------------
// Titles
// ---------------------------------------------------------------------------

const TITLE_A = ['Velvet', 'Lukewarm', 'Polite', 'Cozy', 'Quiet', 'Pastel', 'Gentle', 'Awkward', 'Tidy', 'Restless', 'Sunday', 'Mellow', 'Tangled', 'Peaceful', 'Borrowed', 'Second-hand', 'Midnight', 'Fragile', 'Patchwork', 'Lopsided'];
const TITLE_B = ['Truce', 'Compromise', 'Housewarming', 'Makeover', 'Standoff', 'Accord', 'Rearrangement', 'Detente', 'Reunion', 'Renovation', 'Tug of War', 'Negotiation', 'Harmony', 'Feud', 'Agreement', 'Shuffle', 'Hideaway', 'Nest', 'Upgrade', 'Arrangement'];

function makeTitle(r: Rng): string { return `The ${pick(r, TITLE_A)} ${pick(r, TITLE_B)}`; }

// ---------------------------------------------------------------------------
// The generator
// ---------------------------------------------------------------------------

export interface GenerateOptions {
    players: number;
    level: Level;
    seed: number;
    /** Candidate scenarios to build and compare (default depends on the level). */
    candidates?: number;
    /** House twists: true (default) draws them from the seed, false = none, or an explicit list. */
    twists?: boolean | TwistId[];
}

interface Built { setup: World; solution: World; cards: Cand[][]; twists: Twists; stats: ScenarioStats; }

/**
 * Fix the twists' details around the witness (may add the heirloom object to
 * it). Returns the twists and the features the scramble must leave alone.
 */
function fitTwists(r: Rng, kinds: TwistId[], solution: World, players: number, level: Level): { tw: Twists; locked: Set<string> } {
    const tw: Twists = {};
    const locked = new Set<string>();
    const h = solution.h;
    kinds.forEach(id => {
        switch (id) {
            case 'cat': {
                h.pet = pick(r, ROOMS);
                const avoid = level !== 'easy' && chance(r, 0.6) ? pick(r, COLORS.filter(c => c !== h[h.pet!].wall)) : null;
                tw.cat = { avoid };
                break;
            }
            case 'heirloom': {
                const filled: { room: RoomId; type: ObjType }[] = [];
                ROOMS.forEach(room => TYPES.forEach(type => { if (h[room][type]) filled.push({ room, type }); }));
                const at = filled.length ? pick(r, filled) : { room: pick(r, ROOMS), type: pick(r, TYPES) };
                if (!h[at.room][at.type]) h[at.room][at.type] = pick(r, STYLES);
                tw.heirloom = { room: at.room, type: at.type, style: h[at.room][at.type] as Style };
                locked.add(`${at.room}:${at.type}`);
                break;
            }
            case 'keeper':
                tw.keeper = { room: pick(r, ROOMS), seat: int(r, players) };
                break;
            case 'shortage': {
                // a style the witness uses once or twice (or not at all): the limit never binds the witness
                const ok = STYLES.filter(st => countStyle(h, st) <= 2);
                const style = pick(r, ok.length ? ok : STYLES);
                tw.shortage = { style, max: Math.max(1, countStyle(h, style)) };
                break;
            }
            case 'soldOut': {
                const counts = COLORS.map(c => ROOMS.filter(room => h[room].wall === c).length);
                const ok = COLORS.filter((c, i) => counts[i] <= 1);
                const color: Color = pick(r, ok.length ? ok : COLORS);
                tw.soldOut = { color };
                // walls the witness paints that colour can't be repainted back: keep them as they are
                ROOMS.forEach(room => { if (h[room].wall === color) locked.add(`${room}:wall`); });
                break;
            }
            default:
                (tw as any)[id] = true;
        }
    });
    return { tw, locked };
}

/** Roommate conditions per card on the roommates board. */
const ROOMMATE_MIN = 1, ROOMMATE_MAX = 2;
/** Chance a later slot (after the first) asks for a roommate condition. */
const ROOMMATE_SHARE = 0.22;

/** Seats whose card gets a cat condition: one for sure, the others sometimes. */
const CAT_SHARE = 0.45;

function buildOne(r: Rng, players: number, level: Level, kinds: TwistId[]): Built | null {
    const cfg = CFG[level];
    const counts = cfg.perPlayer[players];
    const roommates = boardFor(players) === 'roommates';
    const solution: World = { h: randomHouse(r, 0.55 + next(r) * 0.25), beds: roommates ? randomBeds(r, players) : null };
    const { tw, locked } = kinds.length ? fitTwists(r, kinds, solution, players, level) : { tw: {} as Twists, locked: new Set<string>() };
    const catSeats = new Set<number>();
    if (tw.cat) {
        catSeats.add(int(r, players));
        for (let seat = 0; seat < players; seat++) if (chance(r, CAT_SHARE)) catSeats.add(seat);
    }
    const catSlot = roommates ? 1 : 0;
    const samples = makeSamples(r, solution, players);
    const [pLo, pHi] = cfg.pRange;

    const used = new Set<string>();
    const all: Cand[] = [];
    const cards: Cand[][] = counts.map(() => []);

    // deal round-robin so no seat gets all the easy picks
    const maxPer = Math.max(...counts);
    for (let slot = 0; slot < maxPer; slot++) {
        for (let seat = 0; seat < players; seat++) {
            if (cards[seat].length >= counts[seat]) continue;
            let placed = false;
            const rivals = all.filter(o => cards[seat].indexOf(o) === -1);
            const wantTension = rivals.length > 0 && chance(r, cfg.tension);
            const roomCount = cards[seat].filter(o => isRoommateCond(o.cond)).length;
            const wantCat = catSeats.has(seat) && slot === catSlot;
            const wantRoommate = !wantCat && roommates && roomCount < ROOMMATE_MAX && (roomCount < ROOMMATE_MIN && slot === 0 || chance(r, ROOMMATE_SHARE));
            for (let tries = 0; tries < 400 && !placed; tries++) {
                const cond = wantCat ? templateCat(r, roommates) : wantRoommate ? templateRoommate(r, players, seat) : randomCondition(r, cfg.tiers);
                if (!wellFormed(cond) || !holds(cond, solution, seat)) continue;
                // keys include the owner for relative conditions ("your bedroom…" differs per seat)
                const key = isRoommateCond(cond) ? `${seat}:${condKey(cond)}` : condKey(cond);
                if (used.has(key)) continue;
                const cand = measure(cond, seat, samples);
                if (cand.p < pLo || cand.p > pHi) continue;
                if (all.some(o => equivalent(o, cand))) continue;
                if (wantTension && tries < 300 && !rivals.some(o => phi(o, cand, samples.uniform.length) <= TENSION_PHI)) continue;
                const mine = cards[seat];
                // at most two of the same kind per card, at most one of each tier-3 kind
                const sameKind = mine.filter(o => o.cond.c === cond.c).length;
                if (sameKind >= (conditionTier(cond) === 3 ? 1 : 2)) continue;
                // at most one "who you sleep with" condition per card, and one about the cat
                const social = (c: Condition) => c.c === 'with' || c.c === 'apart' || c.c === 'alone';
                if (social(cond) && mine.some(o => social(o.cond))) continue;
                if (isCatCond(cond) && mine.some(o => isCatCond(o.cond))) continue;
                // must add information, and must not make an existing one redundant
                if (!informative(cand, mine)) continue;
                if (mine.some((o, i) => !informative(o, [...mine.filter((_, j) => j !== i), cand]))) continue;
                mine.push(cand);
                all.push(cand);
                used.add(key);
                placed = true;
            }
            if (!placed) return null;
        }
    }

    // setup: scramble until every seat has something to do; on harder levels try a few
    // and keep the one selfish play finds hardest
    const minUnmet = Math.ceil(all.length * (level === 'easy' ? 0.3 : 0.4));
    const condCards = cards.map(c => c.map(x => x.cond));
    let setup: World | null = null;
    let unmet = 0;
    let self = { rounds: -1, wins: 1 };
    let found = 0;
    for (let tries = 0; tries < 60 && found < cfg.setups; tries++) {
        const k = between(r, cfg.moves[0], cfg.moves[1]);
        // roommates board: usually people start in different bedrooms than the solution's
        const w: World = { h: scramble(r, solution.h, k, locked), beds: roommates ? (chance(r, 0.7) ? randomBeds(r, players) : solution.beds) : null };
        // the cat usually starts somewhere else
        if (tw.cat && chance(r, 0.75)) w.h.pet = pick(r, ROOMS.filter(x => x !== solution.h.pet));
        if (!houseAllowed(tw, w.h)) continue;
        const perSeat = cards.map((c, seat) => c.filter(x => !holds(x.cond, w, seat)).length);
        const total = perSeat.reduce((s, n) => s + n, 0);
        if (!perSeat.every(n => n > 0) || total < minUnmet) continue;
        found++;
        const sp = selfishPlay(r, w.h, condCards, 4, w.beds, kinds.length ? tw : null);
        if (sp.rounds > self.rounds) { setup = w; unmet = total; self = sp; }
    }
    if (!setup) return null;

    const specificity = all.reduce((s, c) => s + -Math.log2(Math.max(c.p, 0.005)), 0);
    const conflicts = conflictCount(cards, samples.uniform.length);
    const contest = contested(setup, condCards, kinds.length ? tw : null);
    const distance = houseDistance(setup.h, solution.h) + bedsDistance(setup.beds, solution.beds);
    const tierSum = all.reduce((s, c) => s + conditionTier(c.cond), 0);
    // static part normalised per condition (×10) so 2-, 3- and 4-player scenarios share one scale;
    // the selfish play-out (rounds, 0..14) is the dominant term
    const raw = specificity * 1.2 + (conflicts / (players - 1)) * 1.5 + contest * 2 + distance * 1.2 + unmet * 0.8 + (tierSum - all.length) * 1.5;
    const score = Math.round(raw * 5 / all.length + self.rounds * 5);
    return {
        setup, solution, cards, twists: tw,
        stats: {
            conditions: all.length, specificity: Math.round(specificity * 10) / 10, conflicts, contested: contest, distance, unmet,
            selfish: Math.round(self.rounds * 10) / 10, selfishWins: self.wins, score, attempts: 0
        }
    };
}

export function generateScenario(opts: GenerateOptions): Scenario {
    const players = opts.players;
    if (!(players >= 2 && players <= 4)) throw new Error('Décorum scenarios are for 2 to 4 players');
    const level = opts.level;
    if (!CFG[level]) throw new Error(`Unknown level ${level}`);
    const seed = opts.seed >>> 0;
    const r = makeRng(seed);
    const cfg = CFG[level];
    const want = opts.candidates ?? cfg.candidates;
    const withTwists = opts.twists !== false;
    const kinds: TwistId[] = Array.isArray(opts.twists) ? opts.twists : withTwists ? pickTwists(seed, level) : [];

    let best: Built | null = null;
    let bestCost = Infinity;
    let built = 0;
    let attempts = 0;
    while (built < want && attempts < 200) {
        attempts++;
        const b = buildOne(r, players, level, kinds);
        if (!b) continue;
        built++;
        const cost = Math.abs(b.stats.score - TARGET[level]) + (b.stats.conflicts < cfg.minConflicts ? 25 : 0)
            + Math.max(0, cfg.minSelfish - b.stats.selfish) * 12;
        if (cost < bestCost) { best = b; bestCost = cost; }
    }
    if (!best) throw new Error('Could not build a scenario');
    best.stats.attempts = attempts;

    const titleRng = makeRng(seed ^ 0x5bd1e995);
    return {
        seed, players, level,
        code: scenarioCode(players, level, seed, withTwists),
        title: makeTitle(titleRng),
        board: boardFor(players),
        setup: best.setup.h,
        solution: best.solution.h,
        setupBeds: best.setup.beds,
        solutionBeds: best.solution.beds,
        cards: best.cards.map(c => c.map(x => x.cond)),
        twists: best.twists,
        stats: best.stats
    };
}

/** Verifies the generator's guarantees; returns a list of problems (empty = sound). */
export function auditScenario(s: Scenario): string[] {
    const problems: string[] = [];
    const sol: World = { h: s.solution, beds: s.solutionBeds };
    const start: World = { h: s.setup, beds: s.setupBeds };
    s.cards.forEach((card, seat) => card.forEach(c => { if (!holds(c, sol, seat)) problems.push(`solution breaks seat ${seat}: ${condKey(c)}`); }));
    s.cards.forEach((card, i) => {
        if (card.every(c => holds(c, start, i))) problems.push(`seat ${i} starts fulfilled`);
    });
    if (s.board === 'roommates') {
        [s.setupBeds, s.solutionBeds].forEach(b => {
            if (!b || b.length !== s.players) { problems.push('missing bedrooms'); return; }
            BEDROOMS.forEach(room => { if (b.filter(x => x === room).length > BEDROOM_CAPACITY) problems.push(`too many in ${room}`); });
            if (b.some(x => BEDROOMS.indexOf(x) === -1)) problems.push('someone sleeps outside a bedroom');
        });
        s.cards.forEach((card, i) => {
            if (!card.some(isRoommateCond)) problems.push(`seat ${i} has no roommate condition`);
            card.forEach(c => { if ((c.c === 'with' || c.c === 'apart') && (c.seat === i || c.seat < 0 || c.seat >= s.players)) problems.push(`seat ${i} refers to a bad seat`); });
        });
    } else if (s.cards.some(card => card.some(isRoommateCond))) problems.push('roommate condition on the classic board');
    const keys = s.cards.reduce<string[]>((acc, card, seat) => acc.concat(card.map(c => isRoommateCond(c) ? `${seat}:${condKey(c)}` : condKey(c))), []);
    if (new Set(keys).size !== keys.length) problems.push('duplicate condition');
    // twists: the witness obeys them and stays reachable from the setup
    const tw = s.twists || {};
    if (tw.cat) {
        if (!s.setup.pet || !s.solution.pet) problems.push('the cat is missing');
        else if (tw.cat.avoid && s.solution[s.solution.pet].wall === tw.cat.avoid) problems.push('the cat would have to walk into a room it avoids');
    } else {
        if (s.setup.pet || s.solution.pet) problems.push('a cat without the cat twist');
        if (s.cards.some(card => card.some(isCatCond))) problems.push('cat condition without a cat');
    }
    if (tw.heirloom) {
        const x = tw.heirloom;
        if (s.setup[x.room][x.type] !== x.style || s.solution[x.room][x.type] !== x.style) problems.push('the heirloom moved');
    }
    if (tw.soldOut) {
        ROOMS.forEach(room => { if (s.solution[room].wall === tw.soldOut!.color && s.setup[room].wall !== tw.soldOut!.color) problems.push(`the ${room} needs sold-out paint`); });
    }
    if (tw.shortage && (!houseAllowed(tw, s.setup) || !houseAllowed(tw, s.solution))) problems.push('shortage exceeded');
    if (tw.keeper && !(tw.keeper.seat >= 0 && tw.keeper.seat < s.players)) problems.push('keeper is not a player');
    if (twistList(tw).some(id => TWIST_GROUP[id] && twistList(tw).filter(o => TWIST_GROUP[o] === TWIST_GROUP[id]).length > 1)) problems.push('clashing twists');
    return problems;
}

