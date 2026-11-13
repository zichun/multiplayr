/**
 * model.ts — the Décorum house model: rooms, features, objects and moves.
 *
 * Pure data + functions (no React, no Multiplayr), shared by the scenario
 * generator, the game engine, the views and the tests.
 *
 *   ┌──────────┬──────────┐   upstairs   = bath + bed
 *   │ bathroom │ bedroom  │   downstairs = living + kitchen
 *   ├──────────┼──────────┤   left side  = bath + living
 *   │ living   │ kitchen  │   right side = bed + kitchen
 *   └──────────┴──────────┘
 *
 * Every room has a wall colour (always) and three object slots — one wall
 * hanging, one lamp, one curio — each empty or holding one object. An object
 * is a type + style; its colour follows from those (12 combinations).
 *
 * Boards: 2 players use the classic board above. 3–4 players use the
 * roommates board, where both upstairs rooms are bedrooms ("left bedroom" =
 * the 'bath' slot, "right bedroom" = 'bed'). Each player sleeps in one of them
 * (at most two per bedroom) and may spend a turn switching bedrooms, kicking a
 * roommate out when the other bedroom is full. Room ids never change; only
 * their names do.
 *
 * Twists (see twists.ts) may add a house cat: `house.pet` is the room it is in.
 * Moving it to a neighbouring room is a move of its own (`kind: 'cat'`).
 */

export type Color = 'red' | 'yellow' | 'blue' | 'green';
export type Style = 'modern' | 'antique' | 'retro' | 'unusual';
export type ObjType = 'hanging' | 'lamp' | 'curio';
export type RoomId = 'bath' | 'bed' | 'living' | 'kitchen';

export const COLORS: Color[] = ['red', 'yellow', 'blue', 'green'];
export const STYLES: Style[] = ['modern', 'antique', 'retro', 'unusual'];
export const TYPES: ObjType[] = ['hanging', 'lamp', 'curio'];
/** Reading order: top-left, top-right, bottom-left, bottom-right. */
export const ROOMS: RoomId[] = ['bath', 'bed', 'living', 'kitchen'];

export const WARM: Record<Color, boolean> = { red: true, yellow: true, blue: false, green: false };

/** The 12 objects: colour by type and style (from the rule book's object board). */
export const OBJECT_COLOR: Record<ObjType, Record<Style, Color>> = {
    lamp: { modern: 'blue', antique: 'yellow', retro: 'red', unusual: 'green' },
    hanging: { modern: 'red', antique: 'green', retro: 'blue', unusual: 'yellow' },
    curio: { modern: 'green', antique: 'blue', retro: 'yellow', unusual: 'red' }
};

export const ROOM_NAME: Record<RoomId, string> = { bath: 'bathroom', bed: 'bedroom', living: 'living room', kitchen: 'kitchen' };

export type Board = 'classic' | 'roommates';
export const boardFor = (players: number): Board => players >= 3 ? 'roommates' : 'classic';

const ROOMMATE_ROOM_NAME: Record<RoomId, string> = { bath: 'left bedroom', bed: 'right bedroom', living: 'living room', kitchen: 'kitchen' };
/** A room's name on a board ("bathroom" on the classic board is the "left bedroom" on the roommates board). */
export const roomName = (room: RoomId, board: Board = 'classic'): string => (board === 'roommates' ? ROOMMATE_ROOM_NAME : ROOM_NAME)[room];
export const TYPE_NAME: Record<ObjType, string> = { hanging: 'wall hanging', lamp: 'lamp', curio: 'curio' };
export const TYPE_PLURAL: Record<ObjType, string> = { hanging: 'wall hangings', lamp: 'lamps', curio: 'curios' };

export interface RoomState {
    wall: Color;
    hanging: Style | null;
    lamp: Style | null;
    curio: Style | null;
}

/** The four rooms, plus (cat twist) the room the cat is in. */
export type House = Record<RoomId, RoomState> & { pet?: RoomId | null };

/** Rooms that share a wall or floor (the cat walks between these; never diagonally). */
export const ADJACENT: Record<RoomId, RoomId[]> = {
    bath: ['bed', 'living'],
    bed: ['bath', 'kitchen'],
    living: ['bath', 'kitchen'],
    kitchen: ['bed', 'living']
};

// ---------------------------------------------------------------------------
// Zones
// ---------------------------------------------------------------------------

/**
 * `mine` / `other` are relative (roommates board): the bedroom the condition's
 * owner sleeps in, and the other upstairs bedroom. They resolve per player and
 * per moment via `zoneRooms(zone, ctx)`.
 */
export type Zone = 'house' | 'up' | 'down' | 'left' | 'right' | RoomId | 'mine' | 'other';

export const ZONES: Zone[] = ['house', 'up', 'down', 'left', 'right', 'bath', 'bed', 'living', 'kitchen'];

export const ZONE_ROOMS: Record<Zone, RoomId[]> = {
    house: ['bath', 'bed', 'living', 'kitchen'],
    up: ['bath', 'bed'],
    down: ['living', 'kitchen'],
    left: ['bath', 'living'],
    right: ['bed', 'kitchen'],
    bath: ['bath'],
    bed: ['bed'],
    living: ['living'],
    kitchen: ['kitchen'],
    mine: [],      // relative: see zoneRooms
    other: []
};

export const isRoom = (z: Zone): z is RoomId => ROOMS.indexOf(z as RoomId) !== -1;
export const isRelativeZone = (z: Zone) => z === 'mine' || z === 'other';
/** A zone that is always exactly one room (a fixed room, or your / the other bedroom). */
export const isSingleRoom = (z: Zone) => isRoom(z) || isRelativeZone(z);

// ---------------------------------------------------------------------------
// Roommates (3–4 players)
// ---------------------------------------------------------------------------

/** The upstairs bedrooms on the roommates board. */
export const BEDROOMS: RoomId[] = ['bath', 'bed'];
export const BEDROOM_CAPACITY = 2;
export const otherBedroom = (r: RoomId): RoomId => r === 'bath' ? 'bed' : 'bath';

/** beds[seat] = the bedroom that seat sleeps in. */
export type Beds = RoomId[];

/** Who a condition belongs to, and where everyone sleeps — needed by roommate conditions. */
export interface Ctx { beds: Beds; seat: number; }

export function zoneRooms(z: Zone, ctx?: Ctx | null): RoomId[] {
    if (z === 'mine') return ctx && ctx.beds[ctx.seat] ? [ctx.beds[ctx.seat]] : [];
    if (z === 'other') return ctx && ctx.beds[ctx.seat] ? [otherBedroom(ctx.beds[ctx.seat])] : [];
    return ZONE_ROOMS[z];
}

export const occupants = (beds: Beds, room: RoomId): number[] =>
    beds.map((b, seat) => b === room ? seat : -1).filter(seat => seat !== -1);

/** A bedroom switch: `seat` moves to the other bedroom; `kick` (a seat) is sent the other way when it is full. */
export interface Switch { kind: 'switch'; seat: number; kick: number | null; }

/** Valid `kick` choices for `seat`'s switch: [null] when there is room, otherwise the occupants. */
export function switchOptions(beds: Beds, seat: number): (number | null)[] {
    const to = otherBedroom(beds[seat]);
    const there = occupants(beds, to);
    return there.length < BEDROOM_CAPACITY ? [null] : there;
}

export function switchError(beds: Beds | null, sw: Switch): string | null {
    if (!beds || !beds.length) return 'There are no bedrooms to switch on this board';
    if (!sw || sw.kind !== 'switch' || !(sw.seat >= 0 && sw.seat < beds.length)) return 'Unknown player';
    const opts = switchOptions(beds, sw.seat);
    if (opts.indexOf(sw.kick === undefined ? null : sw.kick) === -1) {
        return opts[0] === null ? 'There is room — nobody needs to be kicked out' : 'Pick a roommate to kick out';
    }
    return null;
}

export function applySwitch(beds: Beds, sw: Switch): Beds {
    const err = switchError(beds, sw);
    if (err) throw new Error(err);
    const out = [...beds];
    const from = beds[sw.seat];
    out[sw.seat] = otherBedroom(from);
    if (sw.kick !== null) out[sw.kick] = from;
    return out;
}

/** Every legal switch for `seat`. */
export const legalSwitches = (beds: Beds, seat: number): Switch[] =>
    switchOptions(beds, seat).map(kick => ({ kind: 'switch' as const, seat, kick }));

export const bedsDistance = (a: Beds | null, b: Beds | null): number =>
    a && b ? a.reduce((n, r, i) => n + (r !== b[i] ? 1 : 0), 0) : 0;

/** "moved to the right bedroom, kicking Ben out to the left bedroom" */
export function describeSwitch(before: Beds, sw: Switch, name: (seat: number) => string, board: Board = 'roommates'): string {
    const to = otherBedroom(before[sw.seat]);
    const base = `moved to the ${roomName(to, board)}`;
    return sw.kick === null ? base : `${base}, kicking ${name(sw.kick)} out to the ${roomName(before[sw.seat], board)}`;
}

// ---------------------------------------------------------------------------
// House helpers
// ---------------------------------------------------------------------------

export function cloneHouse(h: House): House {
    const out: any = {};
    ROOMS.forEach(r => { out[r] = { ...h[r] }; });
    if (h.pet) out.pet = h.pet;
    return out;
}

export function emptyHouse(wall: Color = 'yellow'): House {
    const out: any = {};
    ROOMS.forEach(r => { out[r] = { wall, hanging: null, lamp: null, curio: null }; });
    return out;
}

export function sameHouse(a: House, b: House): boolean {
    return (a.pet || null) === (b.pet || null) && ROOMS.every(r => a[r].wall === b[r].wall && TYPES.every(t => a[r][t] === b[r][t]));
}

/** Features that differ between two houses (each wall or slot counts 1). */
export function houseDistance(a: House, b: House): number {
    let n = 0;
    ROOMS.forEach(r => {
        if (a[r].wall !== b[r].wall) n++;
        TYPES.forEach(t => { if (a[r][t] !== b[r][t]) n++; });
    });
    if ((a.pet || null) !== (b.pet || null)) n++;
    return n;
}

/** A compact, stable key — handy for de-duplicating houses. */
export function houseKey(h: House): string {
    return ROOMS.map(r => h[r].wall[0] + TYPES.map(t => (h[r][t] || '-')[0]).join('')).join('|') + (h.pet ? `@${h.pet}` : '');
}

export const objectColor = (t: ObjType, s: Style): Color => OBJECT_COLOR[t][s];

// ---------------------------------------------------------------------------
// Moves (one per turn)
// ---------------------------------------------------------------------------

export type Move =
    | { kind: 'add'; room: RoomId; type: ObjType; style: Style }
    | { kind: 'remove'; room: RoomId; type: ObjType }
    | { kind: 'swap'; room: RoomId; type: ObjType; style: Style }
    | { kind: 'paint'; room: RoomId; color: Color }
    // cat twist: walk the cat into `room` (a neighbour of the room it is in)
    | { kind: 'cat'; room: RoomId };

/** Does this move change the decoration (rather than walking the cat)? */
export const decorates = (m: Move) => m.kind !== 'cat';

/** Why a move is illegal on `h`, or null when it is fine. */
export function moveError(h: House, m: Move): string | null {
    if (!m || ROOMS.indexOf(m.room) === -1) return 'Unknown room';
    const room = h[m.room];
    switch (m.kind) {
        case 'add':
            if (TYPES.indexOf(m.type) === -1 || STYLES.indexOf(m.style) === -1) return 'Unknown object';
            return room[m.type] ? 'That slot is not empty' : null;
        case 'remove':
            if (TYPES.indexOf(m.type) === -1) return 'Unknown object';
            return room[m.type] ? null : 'That slot is already empty';
        case 'swap':
            if (TYPES.indexOf(m.type) === -1 || STYLES.indexOf(m.style) === -1) return 'Unknown object';
            if (!room[m.type]) return 'Nothing to swap there';
            return room[m.type] === m.style ? 'That is the same object' : null;
        case 'paint':
            if (COLORS.indexOf(m.color) === -1) return 'Unknown colour';
            return room.wall === m.color ? 'The room is already that colour' : null;
        case 'cat':
            if (!h.pet) return 'There is no cat in this house';
            if (h.pet === m.room) return 'The cat is already there';
            return ADJACENT[h.pet].indexOf(m.room) === -1 ? 'The cat only walks to a neighbouring room' : null;
        default:
            return 'Unknown action';
    }
}

/** Returns a new house with the move applied (throws on an illegal move). */
export function applyMove(h: House, m: Move): House {
    const err = moveError(h, m);
    if (err) throw new Error(err);
    const out = cloneHouse(h);
    const room = out[m.room];
    if (m.kind === 'add' || m.kind === 'swap') room[m.type] = m.style;
    else if (m.kind === 'remove') room[m.type] = null;
    else if (m.kind === 'cat') out.pet = m.room;
    else room.wall = m.color;
    return out;
}

/** Every legal move from `h`. */
export function legalMoves(h: House): Move[] {
    const out: Move[] = [];
    ROOMS.forEach(room => {
        COLORS.forEach(color => { if (h[room].wall !== color) out.push({ kind: 'paint', room, color }); });
        TYPES.forEach(type => {
            const cur = h[room][type];
            if (cur) {
                out.push({ kind: 'remove', room, type });
                STYLES.forEach(style => { if (style !== cur) out.push({ kind: 'swap', room, type, style }); });
            } else {
                STYLES.forEach(style => out.push({ kind: 'add', room, type, style }));
            }
        });
    });
    if (h.pet) ADJACENT[h.pet].forEach(room => out.push({ kind: 'cat', room }));
    return out;
}

/** The single move turning `a` into `b`, if they differ in exactly one feature. */
export function moveBetween(a: House, b: House): Move | null {
    let found: Move | null = null;
    let diffs = 0;
    ROOMS.forEach(room => {
        if (a[room].wall !== b[room].wall) { diffs++; found = { kind: 'paint', room, color: b[room].wall }; }
        TYPES.forEach(type => {
            const x = a[room][type], y = b[room][type];
            if (x === y) return;
            diffs++;
            found = !y ? { kind: 'remove', room, type } : !x ? { kind: 'add', room, type, style: y } : { kind: 'swap', room, type, style: y };
        });
    });
    return diffs === 1 ? found : null;
}

const article = (w: string) => (/^[aeiou]/i.test(w) ? 'an ' : 'a ') + w;

/** "the modern lamp (blue)" style label. */
export function objectLabel(t: ObjType, s: Style, withArticle = false): string {
    const w = `${OBJECT_COLOR[t][s]} ${s} ${TYPE_NAME[t]}`;
    return withArticle ? article(w) : w;
}

/** Plain-English one-liner of a move, e.g. "painted the kitchen blue". */
export function describeMove(before: House, m: Move, board: Board = 'classic'): string {
    const rn = roomName(m.room, board);
    switch (m.kind) {
        case 'add': return `added ${objectLabel(m.type, m.style, true)} to the ${rn}`;
        case 'remove': {
            const s = before[m.room][m.type];
            return `removed the ${s ? objectLabel(m.type, s) : TYPE_NAME[m.type]} from the ${rn}`;
        }
        case 'swap': {
            const s = before[m.room][m.type];
            return `swapped the ${rn}'s ${s ? objectLabel(m.type, s) : TYPE_NAME[m.type]} for ${objectLabel(m.type, m.style, true)}`;
        }
        case 'paint': {
            const was = before[m.room].wall;
            return was && was !== m.color ? `painted the ${rn} from ${was} to ${m.color}` : `painted the ${rn} ${m.color}`;
        }
        case 'cat':
            return before.pet ? `walked the cat from the ${roomName(before.pet, board)} to the ${rn}` : `walked the cat to the ${rn}`;
    }
    return 'changed something';
}

export { article };
