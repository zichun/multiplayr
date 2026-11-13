/**
 * twists.ts — house twists: per-scenario rules that bend how Décorum plays.
 *
 * The generator draws a few (more on harder levels) and fixes their details
 * around its witness house, so a twisted scenario is still always solvable.
 * Every twist is public: it's printed on the scenario, not hidden on a card.
 *
 *   Things in the house
 *     cat       A house cat (house.pet). Instead of decorating you may walk it
 *               to a neighbouring room. Some cards care where it is ("The cat
 *               must be upstairs", "The cat's room must contain a red object").
 *               It may refuse to walk into rooms painted one colour.
 *   Locks & limits
 *     heirloom  One object can never be removed or swapped.
 *     keeper    One room may only be changed by one player.
 *     shortage  Never more than N objects of one style in the house.
 *     soldOut   Nobody may paint a wall one colour.
 *   Turn rules (they look at recent turns — the `Memo`)
 *     noRepeat  You may not change the same room on two of your turns in a row.
 *     wetPaint  You may not change the room the previous player just changed.
 *   Talking
 *     binary    Reactions are positive or negative only (no neutral face).
 *     whisper   Reactions are private: only the player who made the change sees them.
 *
 * Walking the cat is not "changing a room": the cat is exempt from the locks
 * and turn rules (except its own colour aversion), and it doesn't count as the
 * room you changed for `noRepeat` / `wetPaint`.
 */

import { Color, Style, ObjType, RoomId, House, Move, ROOMS, TYPES, roomName, Board, objectLabel, decorates } from './model';

export type TwistId = 'cat' | 'heirloom' | 'keeper' | 'shortage' | 'soldOut' | 'noRepeat' | 'wetPaint' | 'binary' | 'whisper';
export const TWIST_IDS: TwistId[] = ['cat', 'heirloom', 'keeper', 'shortage', 'soldOut', 'noRepeat', 'wetPaint', 'binary', 'whisper'];

export interface Twists {
    /** A house cat. `avoid`: it won't walk into a room painted this colour. */
    cat?: { avoid: Color | null };
    /** This object can never be removed or swapped. */
    heirloom?: { room: RoomId; type: ObjType; style: Style };
    /** Only `seat` may change anything in `room`. */
    keeper?: { room: RoomId; seat: number };
    /** At most `max` objects of `style` in the house. */
    shortage?: { style: Style; max: number };
    /** Nobody may paint a wall `color`. */
    soldOut?: { color: Color };
    noRepeat?: boolean;
    wetPaint?: boolean;
    binary?: boolean;
    whisper?: boolean;
}

export const twistList = (t: Twists | null | undefined): TwistId[] => t ? TWIST_IDS.filter(id => !!(t as any)[id]) : [];

/** Groups of twists that don't stack (at most one of each per scenario). */
export const TWIST_GROUP: Record<TwistId, string> = {
    cat: 'cat', heirloom: 'lock', keeper: 'keeper', shortage: 'limit', soldOut: 'paint',
    noRepeat: 'turn', wetPaint: 'turn', binary: 'talk', whisper: 'talk'
};

// ---------------------------------------------------------------------------
// Recent turns
// ---------------------------------------------------------------------------

/**
 * What the turn rules look at: `last[seat]` is the room that seat changed on
 * its latest turn (null after a pass, a bedroom switch or a cat walk);
 * `prev` is the room changed by the latest action of anyone.
 */
export interface Memo { last: (RoomId | null)[]; prev: RoomId | null; }

export const emptyMemo = (players: number): Memo => ({ last: new Array(players).fill(null), prev: null });

/** The memo after `seat` acts: `room` is what they changed (null when they changed no room). */
export function nextMemo(memo: Memo, seat: number, room: RoomId | null): Memo {
    const last = [...memo.last];
    last[seat] = room;
    return { last, prev: room };
}

export const changedRoom = (m: Move | null | undefined): RoomId | null => m && decorates(m) ? m.room : null;

// ---------------------------------------------------------------------------
// Legality
// ---------------------------------------------------------------------------

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function countStyle(h: House, style: Style): number {
    let n = 0;
    ROOMS.forEach(r => TYPES.forEach(t => { if (h[r][t] === style) n++; }));
    return n;
}

export interface RuleOpts {
    board?: Board;
    /** "Ada" / "you" for keeper messages. */
    seatName?: (seat: number) => string;
}

/**
 * Why a twist forbids `seat` from making move `m` on house `h` (null = allowed).
 * Assumes the move is otherwise legal (`moveError` is checked separately).
 * `memo` may be omitted to skip the turn rules (e.g. when just previewing).
 */
export function twistError(tw: Twists | null | undefined, h: House, m: Move, seat: number, memo?: Memo | null, o: RuleOpts = {}): string | null {
    if (!tw) return null;
    const rn = (r: RoomId) => roomName(r, o.board);
    if (m.kind === 'cat') {
        if (tw.cat && tw.cat.avoid && h[m.room].wall === tw.cat.avoid) return `The cat won't go into a ${tw.cat.avoid} room`;
        return null;
    }
    if (tw.heirloom && m.kind !== 'paint' && m.room === tw.heirloom.room && m.type === tw.heirloom.type) {
        return `The ${objectLabel(tw.heirloom.type, tw.heirloom.style)} is a family heirloom — it stays`;
    }
    if (tw.keeper && m.room === tw.keeper.room && seat !== tw.keeper.seat) {
        const who = o.seatName ? o.seatName(tw.keeper.seat) : `player ${tw.keeper.seat + 1}`;
        return `Only ${who} may change the ${rn(m.room)}`;
    }
    if (tw.shortage && (m.kind === 'add' || m.kind === 'swap') && m.style === tw.shortage.style
        && countStyle(h, tw.shortage.style) >= tw.shortage.max) {
        return `${cap(tw.shortage.style)} shortage: no more than ${tw.shortage.max} ${tw.shortage.style} object${tw.shortage.max === 1 ? '' : 's'}`;
    }
    if (tw.soldOut && m.kind === 'paint' && m.color === tw.soldOut.color) return `${cap(tw.soldOut.color)} paint is sold out`;
    if (memo) {
        if (tw.noRepeat && memo.last[seat] === m.room) return `You changed the ${rn(m.room)} on your last turn`;
        if (tw.wetPaint && memo.prev === m.room) return `Wet paint: the ${rn(m.room)} was just changed`;
    }
    return null;
}

/** Would every possible change in `room` be blocked for `seat`? (keeper and turn rules) — for greying a room out. */
export function roomBlocked(tw: Twists | null | undefined, room: RoomId, seat: number, memo?: Memo | null, o: RuleOpts = {}): string | null {
    if (!tw) return null;
    const probe: Move = { kind: 'paint', room, color: 'red' };
    if (tw.keeper && tw.keeper.room === room && seat !== tw.keeper.seat) return twistError({ keeper: tw.keeper }, null as any, probe, seat, null, o);
    if (memo && (tw.noRepeat || tw.wetPaint)) return twistError({ noRepeat: tw.noRepeat, wetPaint: tw.wetPaint }, null as any, probe, seat, memo, o);
    return null;
}

/** Is the house within the scenario's standing limits (shortage)? Used to validate setups. */
export function houseAllowed(tw: Twists | null | undefined, h: House): boolean {
    if (tw && tw.shortage && countStyle(h, tw.shortage.style) > tw.shortage.max) return false;
    return true;
}

// ---------------------------------------------------------------------------
// Wording
// ---------------------------------------------------------------------------

export interface TwistInfo { id: TwistId; title: string; text: string; }

/** Title + one-line rule for each active twist, worded for the reader. */
export function describeTwists(tw: Twists | null | undefined, o: RuleOpts & { catStart?: RoomId | null } = {}): TwistInfo[] {
    if (!tw) return [];
    const rn = (r: RoomId) => roomName(r, o.board);
    const name = (seat: number) => o.seatName ? o.seatName(seat) : `Player ${seat + 1}`;
    return twistList(tw).map((id): TwistInfo => {
        switch (id) {
            case 'cat': {
                const avoid = tw.cat!.avoid;
                return {
                    id, title: 'House cat',
                    text: `A cat lives here${o.catStart ? ` (it starts in the ${rn(o.catStart)})` : ''}. Instead of decorating, you may walk it to a neighbouring room (not diagonally).`
                        + (avoid ? ` It refuses to walk into a room painted ${avoid}.` : '')
                };
            }
            case 'heirloom': {
                const x = tw.heirloom!;
                return { id, title: 'Family heirloom', text: `The ${objectLabel(x.type, x.style)} in the ${rn(x.room)} can never be removed or swapped.` };
            }
            case 'keeper': {
                const k = tw.keeper!;
                const who = name(k.seat);
                const own = who === 'you' || who === 'You' ? 'Your' : `${who}'s`;
                return { id, title: `${own} ${rn(k.room)}`, text: `Only ${who} may change anything in the ${rn(k.room)} (walking the cat in is fine).` };
            }
            case 'shortage': {
                const x = tw.shortage!;
                return { id, title: `${cap(x.style)} shortage`, text: `There can never be more than ${x.max} ${x.style} object${x.max === 1 ? '' : 's'} in the house.` };
            }
            case 'soldOut':
                return { id, title: `${cap(tw.soldOut!.color)} paint sold out`, text: `Nobody can paint a room ${tw.soldOut!.color}.` };
            case 'noRepeat':
                return { id, title: 'Restless', text: 'You can\'t change the same room on two of your turns in a row.' };
            case 'wetPaint':
                return { id, title: 'Wet paint', text: 'You can\'t change the room the previous player just changed.' };
            case 'binary':
                return { id, title: 'Strong opinions', text: 'No neutral faces: react to every change positively or negatively.' };
            case 'whisper':
                return { id, title: 'Whispers', text: 'Reactions are private: only the player who made the change sees them.' };
        }
        return { id, title: id, text: '' };
    });
}
