/**
 * DecorumGameState.ts — the pure Décorum engine.
 *
 * One shared state, rehydrated by `from_data` on the host after every sync.
 * `order` is the seat order: order[0] is player one, and seat i holds
 * scenario card i.
 *
 *   Play ──(end of a segment)──► Meeting ──► Play … ──(last segment ends)──► Done (lost)
 *     └─(after any action, everyone fulfilled)──────────────────────────────► Done (won)
 *
 * Play    : the active player makes one change to the house (add, remove,
 *           swap, paint), or — roommates board (3–4 players) — switches
 *           bedrooms (kicking a roommate out of a full one), or passes (only
 *           when fulfilled). Their public
 *           "fulfilled" flag is refreshed — their fulfillment check. Others
 *           react positive / neutral / negative. With 2 players the partner
 *           must react before taking their own action.
 * Twists  : the scenario's house twists (scenario.twists) are enforced here —
 *           locks and limits on `act`, the turn rules via `memo()` (derived
 *           from the log), cat walks as moves of kind 'cat', no neutral
 *           reactions under `binary`. `whisper` is enforced by the rule's
 *           view props (reactions only reach the actor).
 * Meeting : 2 players — Heart-to-Heart: each shares one condition with the
 *           other. 3–4 players — House Meeting: each states a mood and shares
 *           one condition with one housemate. Then a heart flips, and the
 *           round track restarts at 1. Before the first meeting, everyone may
 *           vote to hold it early.
 */

import {
    House, Move, Condition, Level, Scenario, Reaction, Mood, REACTIONS, MOODS, Beds, Board, Ctx, Switch, Twists, Memo,
    emptyMemo, nextMemo, changedRoom, twistError,
    generateScenario, applyMove, cloneHouse, moveError, evaluate, describeMove, applySwitch, switchError, describeSwitch,
    segmentsFor, heartsFor, moodNeedsTarget, POINTS_PER_CONDITION, POINTS_PER_HEART, MIN_PLAYERS, MAX_PLAYERS, rng
} from './DecorumData';

export enum Phase {
    Play = 'play',
    Meeting = 'meeting',
    Done = 'done'
}

export type LogKind = 'move' | 'switch' | 'pass' | 'meeting';

export interface LogEntry {
    id: number;
    kind: LogKind;
    by: string | null;
    move: Move | null;
    /** The house before the move (for describing and animating it). */
    before: House | null;
    /** switch: the bedroom switch and where everyone slept before it. */
    sw?: Switch;
    bedsBefore?: Beds;
    text: string;
    segment: number;
    round: number;
    reactions: Record<string, Reaction>;
    /** meeting: public summary of who shared with whom, and moods. */
    meeting?: { idx: number; early: boolean; shares: { from: string; to: string }[]; moods: { by: string; mood: Mood; target: string | null }[] };
}

export interface Share { from: string; to: string; cond: number; meeting: number; }

export interface MeetingState {
    idx: number;
    kind: 'h2h' | 'house';
    early: boolean;
    shares: Record<string, { to: string; cond: number } | null>;
    /** null = not yet chosen; 3–4 players only. */
    moods: Record<string, { mood: Mood; target: string | null } | null>;
    /** Players who had nothing new left to share and skipped. */
    skipped: string[];
}

export interface Result {
    won: boolean;
    met: Record<string, boolean[]>;
    conditionPoints: number;
    heartPoints: number;
    score: number;
    maxScore: number;
}

export interface GameStateData {
    gameId: number;
    scenario: Scenario;
    order: string[];
    cards: Record<string, Condition[]>;
    house: House;
    /** Roommates board: beds[seat] = that seat's bedroom. null on the classic board. */
    beds: Beds | null;
    phase: Phase;
    segment: number;
    round: number;
    roundsPlayed: number;
    turnIdx: number;
    hearts: number;
    declared: Record<string, boolean>;
    log: LogEntry[];
    shares: Share[];
    meeting: MeetingState | null;
    meetingsHeld: number;
    earlyVotes: string[];
    result: Result | null;
    nextId: number;
}

export interface StartOptions {
    level?: Level;
    /** Scenario seed (the code's seed). Random when absent. */
    seed?: number;
    /** Seat-shuffle seed. Random when absent. */
    seatSeed?: number;
    /** House twists (default true). */
    twists?: boolean;
}

const randomSeed = () => Math.floor(Math.random() * 0xffffffff) >>> 0;

export class DecorumGameState {
    private data: GameStateData;
    private playerIds: string[];

    constructor(playerIds: string[]) {
        this.playerIds = [...playerIds];
        this.data = null as any;
    }

    public static from_data(data: GameStateData, playerIds: string[]): DecorumGameState {
        const gs = new DecorumGameState(playerIds);
        gs.data = data;
        return gs;
    }

    public get_data(): GameStateData { return this.data; }
    public get_player_order(): string[] { return this.playerIds; }

    // ---- setup ------------------------------------------------------------

    public start_game(opts: StartOptions = {}) {
        const n = this.playerIds.length;
        if (n < MIN_PLAYERS || n > MAX_PLAYERS) throw new Error(`Décorum needs ${MIN_PLAYERS} to ${MAX_PLAYERS} players.`);
        const level = opts.level || 'medium';
        const seed = (opts.seed ?? randomSeed()) >>> 0;
        const scenario = generateScenario({ players: n, level, seed, twists: opts.twists !== false });
        const order = rng.shuffle(rng.makeRng(opts.seatSeed ?? randomSeed()), this.playerIds);
        const cards: Record<string, Condition[]> = {};
        const declared: Record<string, boolean> = {};
        order.forEach((id, i) => { cards[id] = scenario.cards[i]; declared[id] = false; });
        const prevId = this.data ? this.data.gameId : 0;
        this.data = {
            gameId: prevId + 1 + Math.floor(Math.random() * 1000),
            scenario,
            order,
            cards,
            house: cloneHouse(scenario.setup),
            beds: scenario.setupBeds ? [...scenario.setupBeds] : null,
            phase: Phase.Play,
            segment: 0,
            round: 1,
            roundsPlayed: 0,
            turnIdx: 0,
            hearts: heartsFor(n),
            declared,
            log: [],
            shares: [],
            meeting: null,
            meetingsHeld: 0,
            earlyVotes: [],
            result: null,
            nextId: 1
        };
    }

    // ---- queries ----------------------------------------------------------

    public phase(): Phase { return this.data.phase; }
    public order(): string[] { return this.data.order; }
    public house(): House { return this.data.house; }
    public players(): number { return this.data.order.length; }
    public segments(): number[] { return segmentsFor(this.players()); }
    public segmentLength(): number { return this.segments()[this.data.segment]; }
    public isLastSegment(): boolean { return this.data.segment >= this.segments().length - 1; }

    public activeId(): string | null {
        return this.data.phase === Phase.Play ? this.data.order[this.data.turnIdx] : null;
    }

    public board(): Board { return this.data.scenario.board || 'classic'; }
    public beds(): Beds | null { return this.data.beds || null; }
    public seatOf(id: string): number { return this.data.order.indexOf(id); }

    /** What `id`'s conditions are judged against: their seat and everyone's bedroom. */
    public ctx(id: string, beds: Beds | null = this.beds()): Ctx | null {
        return beds ? { beds, seat: this.seatOf(id) } : null;
    }

    public twists(): Twists { return this.data.scenario.twists || {}; }

    /** Recent turns, for the turn-rule twists: who changed which room last. */
    public memo(): Memo {
        const memo = emptyMemo(this.players());
        this.data.log.forEach(e => {
            if (e.kind !== 'move' && e.kind !== 'switch' && e.kind !== 'pass') return;
            const seat = this.seatOf(e.by || '');
            const room = e.kind === 'move' ? changedRoom(e.move) : null;
            if (seat === -1) return;
            const next = nextMemo(memo, seat, room);
            memo.last = next.last;
            memo.prev = next.prev;
        });
        return memo;
    }

    public card(id: string): Condition[] { return this.data.cards[id] || []; }
    public met(id: string, house: House = this.data.house, beds: Beds | null = this.beds()): boolean[] {
        const ctx = this.ctx(id, beds);
        return this.card(id).map(c => evaluate(c, house, ctx));
    }
    public isFulfilled(id: string, house: House = this.data.house, beds: Beds | null = this.beds()): boolean { return this.met(id, house, beds).every(Boolean); }
    public allFulfilled(): boolean { return this.data.order.every(id => this.isFulfilled(id)); }

    /** The latest move / pass, which is what reactions attach to. */
    public lastAction(): LogEntry | null {
        for (let i = this.data.log.length - 1; i >= 0; i--) {
            const e = this.data.log[i];
            if (e.kind === 'move' || e.kind === 'switch' || e.kind === 'pass') return e;
            if (e.kind === 'meeting') return null;
        }
        return null;
    }

    public canReact(id: string): boolean {
        if (this.data.phase === Phase.Done || this.data.order.indexOf(id) === -1) return false;
        const last = this.lastAction();
        return !!last && last.by !== id && !last.reactions[id];
    }

    /** 2 players: the partner must comment on a change before acting. */
    public owesReaction(id: string): boolean {
        if (this.players() !== 2) return false;
        const last = this.lastAction();
        return !!last && (last.kind === 'move' || last.kind === 'switch') && last.by !== id && !last.reactions[id];
    }

    /** Conditions others have shared with `id`. */
    public sharedWith(id: string): Share[] { return this.data.shares.filter(s => s.to === id); }
    public sharedBy(id: string): Share[] { return this.data.shares.filter(s => s.from === id); }

    /** (condition, recipient) pairs `id` has not shared yet. */
    public shareOptions(id: string): { cond: number; to: string }[] {
        const out: { cond: number; to: string }[] = [];
        const others = this.data.order.filter(o => o !== id);
        this.card(id).forEach((_, cond) => others.forEach(to => {
            if (!this.data.shares.some(s => s.from === id && s.to === to && s.cond === cond)) out.push({ cond, to });
        }));
        return out;
    }

    public canCallEarly(): boolean {
        return this.data.phase === Phase.Play && this.data.meetingsHeld === 0 && this.data.segment === 0;
    }

    // ---- actions ------------------------------------------------------------

    private requireTurn(id: string) {
        if (this.data.phase !== Phase.Play) throw new Error('Not the time for that');
        if (this.activeId() !== id) throw new Error('Not your turn');
        if (this.owesReaction(id)) throw new Error('React to the last change first');
    }

    private pushLog(e: Omit<LogEntry, 'id' | 'segment' | 'round' | 'reactions'>): LogEntry {
        const entry: LogEntry = { ...e, id: this.data.nextId++, segment: this.data.segment, round: this.data.round, reactions: {} };
        this.data.log.push(entry);
        return entry;
    }

    /** Make one change to the house. */
    public act(id: string, move: Move) {
        this.requireTurn(id);
        const err = moveError(this.data.house, move)
            || twistError(this.twists(), this.data.house, move, this.seatOf(id), this.memo(), { board: this.board() });
        if (err) throw new Error(err);
        const before = cloneHouse(this.data.house);
        this.data.house = applyMove(this.data.house, move);
        this.pushLog({ kind: 'move', by: id, move: { ...move }, before, text: describeMove(before, move, this.board()) });
        this.afterAction(id);
    }

    /**
     * Roommates board: spend the turn moving to the other bedroom. When it is
     * full, `kick` (a player id) must name one of its occupants, who moves to
     * your old bedroom; otherwise `kick` must be null.
     */
    public switch_rooms(id: string, kick: string | null) {
        this.requireTurn(id);
        const beds = this.beds();
        if (!beds) throw new Error('There are no bedrooms to switch on this board');
        const seat = this.seatOf(id);
        const kickSeat = kick === null || kick === undefined ? null : this.seatOf(kick);
        if (kickSeat === -1) throw new Error('Unknown roommate');
        const sw: Switch = { kind: 'switch', seat, kick: kickSeat };
        const err = switchError(beds, sw);
        if (err) throw new Error(err);
        const bedsBefore = [...beds];
        this.data.beds = applySwitch(beds, sw);
        const text = describeSwitch(bedsBefore, sw, s => `player ${s + 1}`, this.board());
        this.pushLog({ kind: 'switch', by: id, move: null, before: null, sw, bedsBefore, text });
        this.afterAction(id);
    }

    /** Make no change (only when fulfilled). */
    public pass(id: string) {
        this.requireTurn(id);
        if (!this.isFulfilled(id)) throw new Error('You can only pass when all your conditions are met');
        this.pushLog({ kind: 'pass', by: id, move: null, before: null, text: 'passed' });
        this.afterAction(id);
    }

    private afterAction(id: string) {
        this.data.declared[id] = this.isFulfilled(id);
        if (this.data.declared[id] && this.allFulfilled()) {
            this.data.order.forEach(o => { this.data.declared[o] = true; });
            this.finish(true);
            return;
        }
        this.data.turnIdx++;
        if (this.data.turnIdx >= this.players()) {
            this.data.turnIdx = 0;
            this.endRound();
        }
    }

    private endRound() {
        this.data.roundsPlayed++;
        if (this.data.round >= this.segmentLength()) {
            if (this.isLastSegment()) this.finish(false);
            else this.startMeeting(false);
        } else {
            this.data.round++;
        }
    }

    public react(id: string, logId: number, kind: Reaction) {
        if (REACTIONS.indexOf(kind) === -1) throw new Error('Unknown reaction');
        if (kind === 'meh' && this.twists().binary) throw new Error('Strong opinions: no neutral faces in this house');
        const last = this.lastAction();
        if (!last || last.id !== logId) throw new Error('You can only react to the latest change');
        if (!this.canReact(id)) throw new Error('You cannot react to that');
        last.reactions[id] = kind;
    }

    public vote_early(id: string, on: boolean) {
        if (this.data.order.indexOf(id) === -1) throw new Error('Not a player');
        if (!this.canCallEarly()) throw new Error('The first meeting has already happened');
        const v = this.data.earlyVotes.filter(x => x !== id);
        if (on) v.push(id);
        this.data.earlyVotes = v;
        if (this.data.order.every(o => v.indexOf(o) !== -1)) {
            this.startMeeting(true);
        }
    }

    // ---- meetings -----------------------------------------------------------

    private startMeeting(early: boolean) {
        const shares: MeetingState['shares'] = {};
        const moods: MeetingState['moods'] = {};
        this.data.order.forEach(id => { shares[id] = null; moods[id] = null; });
        this.data.phase = Phase.Meeting;
        this.data.earlyVotes = [];
        this.data.meeting = { idx: this.data.meetingsHeld, kind: this.players() === 2 ? 'h2h' : 'house', early, shares, moods, skipped: [] };
    }

    /** Share condition `cond` (index in your card) with `to` (ignored with 2 players). `cond === null`: nothing left to share. */
    public meeting_share(id: string, cond: number | null, to?: string) {
        const m = this.data.meeting;
        if (this.data.phase !== Phase.Meeting || !m) throw new Error('No meeting right now');
        if (this.data.order.indexOf(id) === -1) throw new Error('Not a player');
        if (m.shares[id] || m.skipped.indexOf(id) !== -1) throw new Error('You have already shared');
        const options = this.shareOptions(id);
        if (cond === null) {
            if (options.length) throw new Error('Pick a condition to share');
            m.skipped.push(id);
        } else {
            const target = this.players() === 2 ? this.data.order.find(o => o !== id)! : to;
            if (!target || target === id || this.data.order.indexOf(target) === -1) throw new Error('Pick a housemate');
            if (!(cond >= 0 && cond < this.card(id).length)) throw new Error('Unknown condition');
            if (!options.some(o => o.cond === cond && o.to === target)) throw new Error('Already shared that with them');
            m.shares[id] = { to: target, cond };
            this.data.shares.push({ from: id, to: target, cond, meeting: m.idx });
        }
        this.maybeEndMeeting();
    }

    public meeting_mood(id: string, mood: Mood, target?: string | null) {
        const m = this.data.meeting;
        if (this.data.phase !== Phase.Meeting || !m || m.kind !== 'house') throw new Error('No house meeting right now');
        if (this.data.order.indexOf(id) === -1) throw new Error('Not a player');
        if (MOODS.indexOf(mood) === -1) throw new Error('Unknown mood');
        let t: string | null = null;
        if (moodNeedsTarget(mood)) {
            if (!target || this.data.order.indexOf(target) === -1) throw new Error('Pick a housemate');
            t = target;
        }
        m.moods[id] = { mood, target: t };
        this.maybeEndMeeting();
    }

    public meetingDone(id: string): boolean {
        const m = this.data.meeting;
        if (!m) return true;
        const shared = !!m.shares[id] || m.skipped.indexOf(id) !== -1;
        return shared && (m.kind === 'h2h' || !!m.moods[id]);
    }

    private maybeEndMeeting() {
        const m = this.data.meeting!;
        if (!this.data.order.every(id => this.meetingDone(id))) return;
        const summary = {
            idx: m.idx,
            early: m.early,
            shares: this.data.order.filter(id => m.shares[id]).map(id => ({ from: id, to: m.shares[id]!.to })),
            moods: m.kind === 'house' ? this.data.order.map(id => ({ by: id, mood: m.moods[id]!.mood, target: m.moods[id]!.target })) : []
        };
        this.pushLog({ kind: 'meeting', by: null, move: null, before: null, text: m.kind === 'h2h' ? 'Heart-to-Heart' : 'House Meeting', meeting: summary });
        this.data.hearts = Math.max(0, this.data.hearts - 1);
        this.data.meetingsHeld++;
        this.data.segment++;
        this.data.round = 1;
        this.data.turnIdx = 0;
        this.data.meeting = null;
        this.data.phase = Phase.Play;
    }

    // ---- end ----------------------------------------------------------------

    private finish(won: boolean) {
        const met: Record<string, boolean[]> = {};
        let count = 0, total = 0;
        this.data.order.forEach(id => {
            met[id] = this.met(id);
            count += met[id].filter(Boolean).length;
            total += met[id].length;
        });
        const allMet = count === total;
        const conditionPoints = count * POINTS_PER_CONDITION;
        const heartPoints = allMet ? this.data.hearts * POINTS_PER_HEART : 0;
        this.data.result = {
            won: won || allMet,
            met,
            conditionPoints,
            heartPoints,
            score: conditionPoints + heartPoints,
            maxScore: total * POINTS_PER_CONDITION + heartsFor(this.players()) * POINTS_PER_HEART
        };
        this.data.phase = Phase.Done;
        this.data.meeting = null;
    }
}
