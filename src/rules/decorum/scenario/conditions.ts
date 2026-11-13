/**
 * conditions.ts — the Décorum condition language.
 *
 * A condition is a small JSON object (safe to store in game data and send to
 * clients). `evaluate(cond, house)` decides it; `describe(cond)` renders it as
 * plain English split into segments, so a view can decorate the keywords
 * (zone and feature glyphs) without re-parsing text.
 *
 * Filters say *what is counted* in a room; conditions say *how many* of it a
 * zone must hold, or relate two filters / the walls of several rooms.
 *
 * Vocabulary (rule book glossary):
 *   object  = lamp, wall hanging or curio;  feature = object or wall colour
 *   warm    = red, yellow;                  cool    = blue, green
 *   identical objects  = same type + style (hence same colour)
 *   inseparable A & B  = in every room: the room has an A ⇔ it has a B
 *   most common X      = appears strictly more often than any other X
 *
 * Roommates board (3–4 players): conditions may be relative to their owner —
 * zones `mine` / `other` ("your bedroom", "the other bedroom") and the kinds
 * `with` / `apart` / `alone` (who you share a bedroom with). Those need a
 * `Ctx` (owner seat + where everyone sleeps); without one they read as false.
 *
 * Cat twist: `catIn` / `catOut` (where the cat must / must not be) and
 * `catNear` / `catAway` (what the cat's room must / must not contain). With no
 * cat in the house they read as false.
 */

import {
    Color, Style, ObjType, Zone, House, RoomState, COLORS, STYLES, TYPES, ROOMS, WARM, OBJECT_COLOR,
    TYPE_NAME, TYPE_PLURAL, isSingleRoom, article, Board, Ctx, zoneRooms, roomName
} from './model';

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export type Filter =
    | { f: 'object' }
    | { f: 'type'; type: ObjType }
    | { f: 'color'; color: Color }                 // objects of a colour
    | { f: 'style'; style: Style }
    | { f: 'specific'; type: ObjType; style: Style }
    | { f: 'temp'; warm: boolean }                 // warm / cool objects
    | { f: 'empty' }                               // empty object slots
    | { f: 'wall'; color: Color }                  // rooms painted a colour
    | { f: 'wallTemp'; warm: boolean }             // rooms painted warm / cool
    | { f: 'feature'; color: Color }               // objects + walls of a colour
    | { f: 'featureTemp'; warm: boolean };         // warm / cool objects + walls

export type Op = '>=' | '==' | '<=';

export type Condition =
    | { c: 'has'; zone: Zone; filter: Filter }
    | { c: 'not'; zone: Zone; filter: Filter }
    | { c: 'count'; zone: Zone; filter: Filter; op: Op; n: number }
    | { c: 'every'; zone: Zone; filter: Filter }
    | { c: 'more'; zone: Zone; a: Filter; b: Filter }
    | { c: 'wallsSame'; zone: Zone }
    | { c: 'wallsDiff' }
    | { c: 'most'; zone: Zone; color?: Color; style?: Style }
    | { c: 'insep'; a: Filter; b: Filter }
    | { c: 'noIdentical' }
    | { c: 'matchWall'; zone: Zone }
    // roommates board: relative to the owner
    | { c: 'with'; seat: number }                  // share a bedroom with that seat
    | { c: 'apart'; seat: number }                 // don't share a bedroom with that seat
    | { c: 'alone' }                               // have a bedroom to yourself
    // cat twist
    | { c: 'catIn'; zone: Zone }                   // the cat must be in the zone
    | { c: 'catOut'; zone: Zone }                  // the cat must not be in the zone
    | { c: 'catNear'; filter: Filter }             // the cat's room must contain …
    | { c: 'catAway'; filter: Filter };            // the cat's room must not contain any …

/** Does this condition care about the cat? */
export const isCatCond = (c: Condition) => c.c === 'catIn' || c.c === 'catOut' || c.c === 'catNear' || c.c === 'catAway';

/** Does this condition depend on who owns it / where people sleep? */
export function isRoommateCond(c: Condition): boolean {
    if (c.c === 'with' || c.c === 'apart' || c.c === 'alone') return true;
    const z = (c as any).zone as Zone | undefined;
    return z === 'mine' || z === 'other';
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

/** How many things matching `f` the room holds. */
export function countInRoom(room: RoomState, f: Filter): number {
    let n = 0;
    switch (f.f) {
        case 'object':
            TYPES.forEach(t => { if (room[t]) n++; });
            return n;
        case 'type':
            return room[f.type] ? 1 : 0;
        case 'color':
            TYPES.forEach(t => { const s = room[t]; if (s && OBJECT_COLOR[t][s] === f.color) n++; });
            return n;
        case 'style':
            TYPES.forEach(t => { if (room[t] === f.style) n++; });
            return n;
        case 'specific':
            return room[f.type] === f.style ? 1 : 0;
        case 'temp':
            TYPES.forEach(t => { const s = room[t]; if (s && WARM[OBJECT_COLOR[t][s]] === f.warm) n++; });
            return n;
        case 'empty':
            TYPES.forEach(t => { if (!room[t]) n++; });
            return n;
        case 'wall':
            return room.wall === f.color ? 1 : 0;
        case 'wallTemp':
            return WARM[room.wall] === f.warm ? 1 : 0;
        case 'feature':
            return countInRoom(room, { f: 'color', color: f.color }) + (room.wall === f.color ? 1 : 0);
        case 'featureTemp':
            return countInRoom(room, { f: 'temp', warm: f.warm }) + (WARM[room.wall] === f.warm ? 1 : 0);
    }
    return 0;
}

export function countInZone(h: House, zone: Zone, f: Filter, ctx?: Ctx | null): number {
    return zoneRooms(zone, ctx).reduce((s, r) => s + countInRoom(h[r], f), 0);
}

/**
 * Is `cond` true in house `h`? Roommate conditions also need `ctx` (the
 * owner's seat and everyone's bedroom); without it they are false.
 */
export function evaluate(cond: Condition, h: House, ctx?: Ctx | null): boolean {
    if (isRoommateCond(cond) && !(ctx && ctx.beds && ctx.beds[ctx.seat])) return false;
    switch (cond.c) {
        case 'has': return countInZone(h, cond.zone, cond.filter, ctx) > 0;
        case 'not': return countInZone(h, cond.zone, cond.filter, ctx) === 0;
        case 'count': {
            const n = countInZone(h, cond.zone, cond.filter, ctx);
            return cond.op === '>=' ? n >= cond.n : cond.op === '<=' ? n <= cond.n : n === cond.n;
        }
        case 'every': return zoneRooms(cond.zone, ctx).every(r => countInRoom(h[r], cond.filter) > 0);
        case 'more': return countInZone(h, cond.zone, cond.a, ctx) > countInZone(h, cond.zone, cond.b, ctx);
        case 'wallsSame': {
            const rs = zoneRooms(cond.zone, ctx);
            return rs.every(r => h[r].wall === h[rs[0]].wall);
        }
        case 'wallsDiff': {
            const seen = new Set<Color>();
            return ROOMS.every(r => { if (seen.has(h[r].wall)) return false; seen.add(h[r].wall); return true; });
        }
        case 'most': {
            if (cond.color) {
                const counts = COLORS.map(c => countInZone(h, cond.zone, { f: 'feature', color: c }, ctx));
                const mine = counts[COLORS.indexOf(cond.color)];
                return counts.every((n, i) => COLORS[i] === cond.color || n < mine);
            }
            if (cond.style) {
                const counts = STYLES.map(s => countInZone(h, cond.zone, { f: 'style', style: s }, ctx));
                const mine = counts[STYLES.indexOf(cond.style)];
                return counts.every((n, i) => STYLES[i] === cond.style || n < mine);
            }
            return false;
        }
        case 'insep':
            return ROOMS.every(r => (countInRoom(h[r], cond.a) > 0) === (countInRoom(h[r], cond.b) > 0));
        case 'noIdentical':
            return TYPES.every(t => {
                const seen = new Set<Style>();
                return ROOMS.every(r => {
                    const s = h[r][t];
                    if (!s) return true;
                    if (seen.has(s)) return false;
                    seen.add(s);
                    return true;
                });
            });
        case 'matchWall':
            return zoneRooms(cond.zone, ctx).every(r => countInRoom(h[r], { f: 'color', color: h[r].wall }) > 0);
        case 'with': return !!ctx && cond.seat !== ctx.seat && ctx.beds[cond.seat] === ctx.beds[ctx.seat];
        case 'apart': return !!ctx && cond.seat !== ctx.seat && !!ctx.beds[cond.seat] && ctx.beds[cond.seat] !== ctx.beds[ctx.seat];
        case 'alone': return !!ctx && ctx.beds.every((b, i) => i === ctx.seat || b !== ctx.beds[ctx.seat]);
        case 'catIn': return !!h.pet && zoneRooms(cond.zone, ctx).indexOf(h.pet) !== -1;
        case 'catOut': return !!h.pet && zoneRooms(cond.zone, ctx).indexOf(h.pet) === -1;
        case 'catNear': return !!h.pet && countInRoom(h[h.pet], cond.filter) > 0;
        case 'catAway': return !!h.pet && countInRoom(h[h.pet], cond.filter) === 0;
    }
    return false;
}

export const evaluateAll = (conds: Condition[], h: House, ctx?: Ctx | null): boolean[] => conds.map(c => evaluate(c, h, ctx));

/** Stable identity (conditions are always built with a fixed key order). */
export const condKey = (c: Condition): string => JSON.stringify(c);

// ---------------------------------------------------------------------------
// Description
// ---------------------------------------------------------------------------

/** A run of text; `zone`/`filter` mark a keyword a view may decorate with a glyph, `seat` a player's name, `pet` the cat. */
export interface Seg {
    t: string;
    pet?: boolean;
    zone?: Zone;
    filter?: Filter;
    color?: Color;
    style?: Style;
    seat?: number;
}

/**
 * How to word a condition: the board names the rooms; `owner` is whose card it
 * is from the reader's point of view (absent = the reader: "your bedroom",
 * "You must…"; a name: "Ada's bedroom", "Ada must…"); `seatName` names seats.
 */
export interface DescribeOpts {
    board?: Board;
    owner?: string | null;
    seatName?: (seat: number) => string;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const tempWord = (warm: boolean) => warm ? 'warm' : 'cool';

const possessive = (o: DescribeOpts) => o.owner ? `${o.owner}'s` : 'your';

/** "The house", "The upstairs", "The kitchen", "your bedroom"… */
function zoneSubject(z: Zone, o: DescribeOpts): string {
    switch (z) {
        case 'house': return 'the house';
        case 'up': return 'the upstairs';
        case 'down': return 'the downstairs';
        case 'left': return 'the left side';
        case 'right': return 'the right side';
        case 'mine': return `${possessive(o)} bedroom`;
        case 'other': return o.owner ? `the bedroom ${o.owner} is not in` : 'the other bedroom';
        default: return `the ${roomName(z, o.board)}`;
    }
}

/** "in the house", "upstairs", "on the left side", "in the kitchen" */
function zoneIn(z: Zone, o: DescribeOpts): string {
    switch (z) {
        case 'house': return 'in the house';
        case 'up': return 'upstairs';
        case 'down': return 'downstairs';
        case 'left': return 'on the left side';
        case 'right': return 'on the right side';
        default: return `in ${zoneSubject(z, o)}`;
    }
}

/** "Every room", "Both upstairs rooms"… for multi-room zones. */
function everyRoom(z: Zone, o: DescribeOpts): string {
    switch (z) {
        case 'house': return 'every room';
        case 'up': return o.board === 'roommates' ? 'both bedrooms' : 'both upstairs rooms';
        case 'down': return 'both downstairs rooms';
        case 'left': return 'both rooms on the left side';
        case 'right': return 'both rooms on the right side';
        default: return zoneSubject(z, o);
    }
}

const specificWords = (t: ObjType, s: Style) => `${OBJECT_COLOR[t][s]} ${s} ${TYPE_NAME[t]}`;

/** Singular with article: "a lamp", "a red object", "an empty slot". */
export function filterA(f: Filter): string {
    switch (f.f) {
        case 'object': return 'an object';
        case 'type': return article(TYPE_NAME[f.type]);
        case 'color': return `a ${f.color} object`;
        case 'style': return article(`${f.style} object`);
        case 'specific': return article(specificWords(f.type, f.style));
        case 'temp': return `a ${tempWord(f.warm)}-colored object`;
        case 'empty': return 'an empty slot';
        case 'wall': return `a room painted ${f.color}`;
        case 'wallTemp': return `a room painted a ${tempWord(f.warm)} color`;
        case 'feature': return `the color ${f.color} (as an object or wall color)`;
        case 'featureTemp': return `a ${tempWord(f.warm)} color (as an object or wall color)`;
    }
    return 'something';
}

/** Plural: "lamps", "red objects", "empty slots". */
export function filterPlural(f: Filter): string {
    switch (f.f) {
        case 'object': return 'objects';
        case 'type': return TYPE_PLURAL[f.type];
        case 'color': return `${f.color} objects`;
        case 'style': return `${f.style} objects`;
        case 'specific': return `${specificWords(f.type, f.style)}s`;
        case 'temp': return `${tempWord(f.warm)}-colored objects`;
        case 'empty': return 'empty slots';
        case 'wall': return `rooms painted ${f.color}`;
        case 'wallTemp': return `rooms painted ${tempWord(f.warm)} colors`;
        case 'feature': return `${f.color} features (objects and walls)`;
        case 'featureTemp': return `${tempWord(f.warm)} features (objects and walls)`;
    }
    return 'things';
}

/** Count phrase: "1 lamp" / "2 lamps". */
function filterN(f: Filter, n: number): string {
    if (n !== 1) return `${n} ${filterPlural(f)}`;
    if (f.f === 'feature') return `1 ${f.color} feature (object or wall)`;
    if (f.f === 'featureTemp') return `1 ${tempWord(f.warm)} feature (object or wall)`;
    return filterA(f).replace(/^an? /, '1 ');
}

const Z = (t: string, zone: Zone): Seg => ({ t, zone });
const F = (t: string, filter: Filter): Seg => ({ t, filter });
const T = (t: string): Seg => ({ t });
const P = (t: string, seat: number): Seg => ({ t, seat });
const CAT = (t: string): Seg => ({ t, pet: true });

/** Segments for a condition, starting with a capital letter and ending with a period. */
export function describe(cond: Condition, opts: DescribeOpts = {}): Seg[] {
    const segs = describeRaw(cond, opts);
    if (segs.length) segs[0] = { ...segs[0], t: cap(segs[0].t) };
    segs.push(T('.'));
    return segs;
}

function describeRaw(cond: Condition, o: DescribeOpts): Seg[] {
    const who = o.owner || 'you';
    const seatName = (seat: number) => (o.seatName ? o.seatName(seat) : `player ${seat + 1}`);
    switch (cond.c) {
        case 'with': return [T(`${who} must share a bedroom with `), P(seatName(cond.seat), cond.seat)];
        case 'apart': return [T(`${who} must not share a bedroom with `), P(seatName(cond.seat), cond.seat)];
        case 'alone': return [T(`${who} must have a bedroom to ${o.owner ? 'themselves' : 'yourself'}`)];
        case 'catIn': return [CAT('the cat'), T(' must be '), Z(zoneIn(cond.zone, o), cond.zone)];
        case 'catOut': return [CAT('the cat'), T(' must not be '), Z(zoneIn(cond.zone, o), cond.zone)];
        case 'catNear':
        case 'catAway': {
            const neg = cond.c === 'catAway';
            const f = cond.filter;
            if (f.f === 'wall') return [CAT('the cat'), T(neg ? ' must not be in a room painted ' : ' must be in a room painted '), F(f.color, f)];
            if (f.f === 'wallTemp') return [CAT('the cat'), T(neg ? ' must not be in a room painted a ' : ' must be in a room painted a '), F(`${tempWord(f.warm)} color`, f)];
            return neg
                ? [CAT("the cat's room"), T(' must not contain any '), F(filterPlural(f), f)]
                : [CAT("the cat's room"), T(' must contain '), F(filterA(f), f)];
        }
        case 'has':
            if (cond.filter.f === 'wall' && isSingleRoom(cond.zone)) {
                return [Z(zoneSubject(cond.zone, o), cond.zone), T(' must be painted '), F(cond.filter.color, cond.filter)];
            }
            if (cond.filter.f === 'wallTemp' && isSingleRoom(cond.zone)) {
                return [Z(zoneSubject(cond.zone, o), cond.zone), T(' must be painted a '), F(`${tempWord(cond.filter.warm)} color`, cond.filter)];
            }
            return [Z(zoneSubject(cond.zone, o), cond.zone), T(' must contain '), F(filterA(cond.filter), cond.filter)];
        case 'not':
            if (cond.filter.f === 'wall' && isSingleRoom(cond.zone)) {
                return [Z(zoneSubject(cond.zone, o), cond.zone), T(' must not be painted '), F(cond.filter.color, cond.filter)];
            }
            if (cond.filter.f === 'wallTemp' && isSingleRoom(cond.zone)) {
                return [Z(zoneSubject(cond.zone, o), cond.zone), T(' must not be painted a '), F(`${tempWord(cond.filter.warm)} color`, cond.filter)];
            }
            if (cond.filter.f === 'feature') {
                return [Z(zoneSubject(cond.zone, o), cond.zone), T(' must not contain '), F(`the color ${cond.filter.color}`, cond.filter), T(' (as objects or wall color)')];
            }
            if (cond.filter.f === 'featureTemp') {
                return [Z(zoneSubject(cond.zone, o), cond.zone), T(' must not contain any '), F(`${tempWord(cond.filter.warm)} colors`, cond.filter), T(' (as objects or wall color)')];
            }
            return [Z(zoneSubject(cond.zone, o), cond.zone), T(' must not contain any '), F(filterPlural(cond.filter), cond.filter)];
        case 'count': {
            const q = cond.op === '>=' ? 'at least' : cond.op === '<=' ? 'at most' : 'exactly';
            return [Z(zoneSubject(cond.zone, o), cond.zone), T(` must contain ${q} `), F(filterN(cond.filter, cond.n), cond.filter)];
        }
        case 'every':
            if (cond.filter.f === 'wallTemp') {
                return [Z(everyRoom(cond.zone, o), cond.zone), T(' must be painted a '), F(`${tempWord(cond.filter.warm)} color`, cond.filter)];
            }
            return [Z(everyRoom(cond.zone, o), cond.zone), T(' must contain '), F(filterA(cond.filter), cond.filter)];
        case 'more':
            return [Z(zoneSubject(cond.zone, o), cond.zone), T(' must contain more '), F(filterPlural(cond.a), cond.a), T(' than '), F(filterPlural(cond.b), cond.b)];
        case 'wallsSame':
            return cond.zone === 'house'
                ? [Z('every room', 'house'), T(' must be painted the same color')]
                : [Z(everyRoom(cond.zone, o), cond.zone), T(' must be painted the same color')];
        case 'wallsDiff':
            return [Z('every room', 'house'), T(' must be painted a different color')];
        case 'most':
            if (cond.color) {
                return [F(cond.color, { f: 'feature', color: cond.color }), T(' must be the most common color '), Z(zoneIn(cond.zone, o), cond.zone), T(' (objects and walls)')];
            }
            return [F(cond.style || '', { f: 'style', style: cond.style as Style }), T(' must be the most common style '), Z(zoneIn(cond.zone, o), cond.zone)];
        case 'insep':
            return [T('In every room, '), F(filterPlural(cond.a), cond.a), T(' and '), F(filterPlural(cond.b), cond.b), T(' must be inseparable')];
        case 'noIdentical':
            return [Z('the house', 'house'), T(' must not contain any '), T('identical objects')];
        case 'matchWall':
            return isSingleRoom(cond.zone)
                ? [Z(zoneSubject(cond.zone, o), cond.zone), T(' must contain an object matching its wall color')]
                : [Z(everyRoom(cond.zone, o), cond.zone), T(' must contain an object matching its wall color')];
    }
    return [T('???')];
}

export const describeText = (cond: Condition, opts: DescribeOpts = {}): string => describe(cond, opts).map(s => s.t).join('');

/** Rough "tier" of a condition kind, used for difficulty and for the rules glossary. */
export const COND_TIER: Record<Condition['c'], number> = {
    has: 1, not: 1, count: 1, every: 2, wallsSame: 2, matchWall: 2, more: 3, most: 3, wallsDiff: 3, insep: 3, noIdentical: 3,
    with: 2, apart: 2, alone: 2, catIn: 1, catOut: 1, catNear: 2, catAway: 2
};

export { COLORS, STYLES, TYPES, ROOMS };
