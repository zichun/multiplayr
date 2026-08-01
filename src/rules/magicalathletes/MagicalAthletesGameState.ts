/**
 * MagicalAthletesGameState.ts - Standalone game engine for "Magical Athletes".
 *
 * A push-your-luck racing game. Players run FOUR separate races. Each player is
 * dealt a small stable of racers and commits ONE racer per race (used once). On
 * your turn you roll a d6 and advance that many spaces (your "main move"). Every
 * racer has a wacky, board-breaking power; the depth lives in the interactions.
 * A race ends the instant the SECOND racer crosses the finish line — only 1st and
 * 2nd score. After 4 races, most points wins.
 *
 * This class is pure (no React / Multiplayr / network dependencies). It is
 * serialised to JSON between host ticks, so it exposes get_data / from_data
 * rehydration helpers exactly like the other decoupled game states.
 *
 * Scope note (digital adaptation): optional ("CAN") powers are AUTO-resolved with
 * sensible heuristics so a turn resolves from a single die tap — this keeps the
 * game fully playable and legible on a phone. The whole turn (before-move powers,
 * the roll, movement with passes/trips/stars, stop effects, finishing, and the
 * turn hand-off) is executed inside `take_turn`, emitting a readable event feed.
 *
 * Human choices ("CAN" powers) are handled by a generic pause/resume mechanism:
 * a character hook calls `ctx.decide(...)`, the engine suspends the turn, the
 * owning player answers, and the turn is replayed deterministically with the
 * cached answer. ALL per-character behaviour — mandatory and interactive alike —
 * lives in a separate registry (MagicalAthletesRacers.ts); this engine dispatches
 * to hooks generically and contains no per-character branches.
 */

import { RACER_HOOKS, RaceCtx, RacerHooks } from './MagicalAthletesRacers';

// ==========================================================
// Board
// ==========================================================

export type SpaceType = 'normal' | 'star' | 'trip' | 'arrow';

export interface Space {
    type: SpaceType;
    arrow?: number; // signed step count for an arrow space (wild only)
}

export interface Track {
    id: 'mild' | 'wild';
    name: string;
    length: number;          // number of spaces; Start = index 0, finish crossed at pos >= length
    cornerIndices: number[]; // indices where the serpentine bends (for Blimp)
    secondCorner: number;    // index of the 2nd corner (Blimp threshold)
    spaces: Space[];         // spaces[0..length-1]
    rowWidth: number;        // how many spaces per serpentine row (render hint)
}

function normalTrack(id: 'mild' | 'wild', name: string, length: number, rowWidth: number, specials: Record<number, Space>): Track {
    const spaces: Space[] = [];
    for (let i = 0; i < length; i++) spaces.push(specials[i] ? specials[i] : { type: 'normal' });
    const cornerIndices: number[] = [];
    for (let i = rowWidth; i < length; i += rowWidth) cornerIndices.push(i);
    return {
        id, name, length, rowWidth,
        cornerIndices,
        secondCorner: cornerIndices[1] !== undefined ? cornerIndices[1] : Math.floor(length / 2),
        spaces
    };
}

// Mild Mile — the plain track (no special spaces).
export const MILD_MILE: Track = normalTrack('mild', 'Mild Mile', 30, 6, {});

// Wild Wilds — arrows, trips and stars scattered along the way.
export const WILD_WILDS: Track = normalTrack('wild', 'Wild Wilds', 30, 6, {
    4:  { type: 'star' },
    6:  { type: 'arrow', arrow: 2 },
    9:  { type: 'trip' },
    13: { type: 'star' },
    15: { type: 'arrow', arrow: -3 },
    18: { type: 'trip' },
    21: { type: 'star' },
    24: { type: 'arrow', arrow: 2 },
    27: { type: 'star' }
});

export const TRACKS: Record<'mild' | 'wild', Track> = { mild: MILD_MILE, wild: WILD_WILDS };
export const RACE_SCHEDULE: ('mild' | 'wild')[] = ['mild', 'wild', 'mild', 'wild'];

// Chip stacks. Drawn top-first, so the smallest is awarded first — later races are
// worth more (the "save your best racer for last" incentive).
export const GOLD_BY_RACE = [3, 4, 5, 6];   // 1st place, race 1..4
export const SILVER_BY_RACE = [1, 2, 3, 4]; // 2nd place, race 1..4

// ==========================================================
// Racer roster (all 36)
// ==========================================================

export interface RacerDef {
    id: string;
    name: string;
    title: string;   // power title
    text: string;    // rules text (condensed)
    color: string;   // accent colour for the racer's icon / token
}

export const ROSTER: RacerDef[] = [
    { id: 'alchemist',   name: 'Alchemist',    title: "Transmute 'n' Scoot", text: 'Roll a 1 or 2 for your main move: move 4 instead.', color: '#b98cc9' },
    { id: 'babayaga',    name: 'Baba Yaga',    title: 'Leg It',              text: 'Trip any racer that stops on your space (or when you stop on theirs).', color: '#8a7a5c' },
    { id: 'banana',      name: 'Banana',       title: 'The Slip',            text: 'When a racer passes you, they trip.', color: '#f2cf6b' },
    { id: 'blimp',       name: 'Blimp',        title: 'Blow It',             text: 'Before the 2nd corner: +2 main move. On/after it: -1.', color: '#e39ab0' },
    { id: 'centaur',     name: 'Centaur',      title: 'Hoofwhack',           text: 'When you pass a racer, they move -2 (never past Start).', color: '#c98a5a' },
    { id: 'cheerleader', name: 'Cheerleader',  title: 'Rah Rah',             text: 'Before your move, last-place racers move 2 and you move 1.', color: '#f0a6c0' },
    { id: 'coach',       name: 'Coach',        title: 'Good Hustle',         text: 'Everyone on your space (incl. you) gets +1 main move.', color: '#6ea9b8' },
    { id: 'copycat',     name: 'Copycat',      title: 'Copy That',           text: 'You have the power of the current lead racer.', color: '#9aa6b8' },
    { id: 'dicemonger',  name: 'Dicemonger',   title: 'Dicey Deals',         text: 'Anyone may reroll once per turn; when another rerolls, you move 1.', color: '#c26a6a' },
    { id: 'duelist',     name: 'Duelist',      title: 'Duel!',               text: 'Share a space: both roll, higher moves 2 (you win ties).', color: '#b06a8a' },
    { id: 'egg',         name: 'Egg',          title: 'Scramble',            text: 'Before your race, take one of 3 drawn powers.', color: '#e6d59a' },
    { id: 'flipflop',    name: 'Flip Flop',    title: 'Flop Flip',           text: 'Skip rolling and swap spaces with another racer.', color: '#7fb0a0' },
    { id: 'genius',      name: 'Genius',       title: 'Think Good',          text: 'Predict your roll; if right, take another turn.', color: '#6f8fc9' },
    { id: 'gunk',        name: 'Gunk',         title: "Goop 'Em",            text: 'Other racers get -1 to their main move.', color: '#7c8f5c' },
    { id: 'hare',        name: 'Hare',         title: 'Hubris',              text: '+2 main move, but skip it if you start alone in the lead.', color: '#cbb7a0' },
    { id: 'heckler',     name: 'Heckler',      title: 'Schadenfreude',       text: 'When a racer ends within 1 space of where they started, you move 2.', color: '#b58ab0' },
    { id: 'hugebaby',    name: 'Huge Baby',    title: 'Really Huge',         text: 'No one may share your space; they are pushed behind you.', color: '#f0b6a0' },
    { id: 'hypnotist',   name: 'Hypnotist',    title: 'Hsssst',              text: 'Before your move, warp a racer to your space.', color: '#8f7fc9' },
    { id: 'inchworm',    name: 'Inchworm',     title: 'Wriggle',             text: 'When another rolls a 1, they skip that move and you move 1.', color: '#8fbf7a' },
    { id: 'lackey',      name: 'Lackey',       title: 'Very Good Sire',      text: 'When another rolls a 6, you move 2 first.', color: '#9a8fb0' },
    { id: 'leaptoad',    name: 'Leaptoad',     title: 'Jumpfrog',            text: 'While moving, skip over spaces that hold other racers.', color: '#6fbf8f' },
    { id: 'legs',        name: 'Legs',         title: 'Jog',                 text: 'Skip rolling and move 5 instead.', color: '#c98fa0' },
    { id: 'lovableloser',name: 'Lovable Loser',title: "D'aww",               text: 'Before your move, gain a point if alone in last place.', color: '#b8a6d0' },
    { id: 'magician',    name: 'Magician',     title: 'Poof',                text: 'Reroll your main move up to two times.', color: '#7a6fc9' },
    { id: 'mastermind',  name: 'Mastermind',   title: 'Know-It-All',         text: 'On turn 1, predict the winner; if right, end the race and finish 2nd.', color: '#8a6fb0' },
    { id: 'mouth',       name: 'M.O.U.T.H.',   title: 'Chomp',               text: 'Stop on a space with exactly one other racer: eliminate them.', color: '#d08a7a' },
    { id: 'partyanimal', name: 'Party Animal', title: 'Animal Magnetism',    text: 'Before your move, all racers move 1 toward you; +1 per racer on your space.', color: '#e6a06a' },
    { id: 'rocket',      name: 'Rocket Scientist', title: 'Kablooey',        text: 'Double your roll, then trip after moving.', color: '#e08a6a' },
    { id: 'romantic',    name: 'Romantic',     title: 'Ah, Love!',           text: 'When anyone stops on a space with exactly one other, you move 2.', color: '#e88aa0' },
    { id: 'scoocher',    name: 'Scoocher',     title: 'Scooch Scooch',       text: "When another racer's power happens, you move 1.", color: '#7ab0c9' },
    { id: 'sisyphus',    name: 'Sisyphus',     title: 'Keep Rollin\'',       text: 'Start with 4 points. Roll a 6: warp to Start and lose a point.', color: '#9a9a8a' },
    { id: 'skipper',     name: 'Skipper',      title: 'Salty Dog',           text: 'When anyone rolls a 1, you go next.', color: '#6f9ac9' },
    { id: 'stickler',    name: 'Stickler',     title: 'Actually...',         text: 'Others cross the finish only by the exact amount; overshoot stays put.', color: '#8a9aa6' },
    { id: 'suckerfish',  name: 'Suckerfish',   title: 'Sucker!',             text: 'When a racer on your space moves, follow them to their new space.', color: '#6fb0b8' },
    { id: 'thirdwheel',  name: 'Third Wheel',  title: 'Roll Through',        text: 'Before your move, warp to any space that holds exactly 2 racers.', color: '#a09ac9' },
    { id: 'twin',        name: 'Twin',         title: 'Double Dip',          text: 'Before your race, copy the abilities of a past race winner.', color: '#c9a06f' }
];

export const ROSTER_BY_ID: Record<string, RacerDef> = Object.fromEntries(ROSTER.map(r => [r.id, r]));
export const HAND_SIZE = 4;

// ==========================================================
// State shapes
// ==========================================================

export type Phase = 'Setup' | 'Draft' | 'Choose' | 'Racing' | 'RaceOver' | 'GameOver';

export interface RacerState {
    ownerId: string;    // player who owns this racer this race
    racerId: string;    // roster id (identity / icon)
    powerId: string;    // effective power (Copycat/Egg/Twin may differ from racerId)
    pos: number;        // 0..length ; == length means finished
    tripped: boolean;
    finished: boolean;
    finishRank: number; // 1,2,... (0 = not finished)
    eliminated: boolean;
    flags: Record<string, boolean>; // per-race scratch (e.g. mastermind predicted)
}

export interface GameEvent {
    id: number;
    text: string;
    kind: 'roll' | 'move' | 'power' | 'trip' | 'star' | 'eliminate' | 'finish' | 'race' | 'info';
    actor?: string;     // ownerId
}

// A single animatable movement/cue within one turn. Clients replay these in order
// (main move first, then effect-triggered moves) so every device shows the same
// motion.
export type MoveKind = 'main' | 'power' | 'arrow' | 'warp' | 'finish' | 'trip' | 'eliminate';
export interface MoveStep { ownerId: string; from: number; to: number; kind: MoveKind; }
export interface TurnStartSnap { pos: number; finished: boolean; eliminated: boolean; }

// The full timeline the host publishes for one turn: the die that was rolled (if
// any), a snapshot of where every racer stood at the start, and the ordered steps.
export interface TurnTimeline {
    id: number;
    playerId: string;
    die: number | null;
    start: Record<string, TurnStartSnap>;
    steps: MoveStep[];
}

// ---- human decisions (pause/resume) ----
export interface DecisionOption { id: string; label: string; }

// A question the engine is blocked on. Belongs to `playerId` (the character's
// owner — not necessarily the racer on turn). The whole turn is paused until it is
// answered via resolve_decision.
export interface PendingDecision {
    id: string;                 // stable key for this decision within the turn
    playerId: string;           // who must answer
    racerId: string;            // the deciding character (for the UI)
    prompt: string;
    options: DecisionOption[];
}

// The suspended-turn continuation. The engine re-runs the turn from `snapshot`,
// replaying the same die/random draws (randomLog) and feeding back the answers
// collected so far (decisions) — so a turn resolves deterministically once every
// decision is made. This is a generic mechanism with no character knowledge.
export interface PendingTurn {
    phase: 'turn' | 'setup';             // a normal turn, or the pre-race setup
    playerId: string;
    forcedDie: number | null;
    snapshot: string;                    // JSON of the game state at the phase start
    randomLog: number[];                 // seeded RNG draws, replayed in order
    decisions: Record<string, string>;   // decision id -> chosen option id
}

export interface PlayerScore {
    gold: number;
    silver: number;
    bronze: number;
    total: number;
}

export interface GameStateData {
    status: Phase;
    playerIds: string[];
    numPlayers: number;

    schedule: ('mild' | 'wild')[];
    raceNo: number;         // 0-based (0..3)

    hands: Record<string, string[]>;   // drafted stable per player (shrinks as raced)
    used: Record<string, string[]>;    // racers already spent
    picks: Record<string, string | null>; // this-race commitment (Choose phase)

    // ---- draft (snake) ----
    draftDeck: string[];        // undealt master pool the reveals are drawn from
    draftPool: string[];        // currently revealed, draftable cards
    draftSeq: string[];         // this round's snake pick order (ownerIds)
    draftSeqIndex: number;      // pointer into draftSeq
    draftRound: number;         // 0-based reveal round (two rounds -> 4 racers each)
    draftBaseOrder: string[];   // roll-off order (round 1 rotates one seat left)
    currentDrafter: string;     // whose pick it is

    // ---- active race ----
    trackId: 'mild' | 'wild';
    racers: Record<string, RacerState>; // keyed by ownerId (one racer each)
    participants: string[];             // ownerIds in seating order
    currentId: string;                  // whose turn
    lastRoll: number | null;
    finishers: string[];                // ownerIds in finish order
    eliminatedOrder: string[];
    raceOver: boolean;
    firstNextRace: string | null;
    extraTurn: boolean;
    skipperPending: string | null;
    dicemongerUsed: Record<string, boolean>;
    pastWinnerRacerIds: string[];       // for Twin
    raceTurns: number;                  // stall guard: force-ends a deadlocked race

    // ---- scoring ----
    scores: Record<string, PlayerScore>;

    // ---- feed ----
    events: GameEvent[];
    lastEvent: GameEvent | null;
    eventCounter: number;

    // ---- movement animation timeline (published per turn) ----
    turnSteps: MoveStep[];                     // accumulator for the current turn
    turnStart: Record<string, TurnStartSnap>;  // positions at the start of the turn
    turnDie: number | null;                    // die rolled this turn (or null)
    turnCounter: number;
    lastTurn: TurnTimeline | null;

    // ---- pending human decision (pause/resume) ----
    pendingDecision: PendingDecision | null;
    pendingTurn: PendingTurn | null;

    finalWinners: string[];
}

// ==========================================================
// Utilities
// ==========================================================

function randInt(n: number): number {
    return Math.floor(Math.random() * n);
}
function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = randInt(i + 1);
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// Thrown by ctx.decide to unwind the turn when a human choice is needed.
const SUSPEND: { __suspend: true } = { __suspend: true };

// ==========================================================
// Game state
// ==========================================================

export class MagicalAthletesGameState {
    private data: GameStateData;
    private readonly playerIds: string[];

    // Transient per-attempt scratch (never serialised; rebuilt each runAttempt).
    private _rngIdx = 0;
    private _suspend: PendingDecision | null = null;
    private _tripAfter = false;
    private _cancelMain = false;

    constructor(playerIds: string[]) {
        this.playerIds = [...playerIds];
        const scores: Record<string, PlayerScore> = {};
        const hands: Record<string, string[]> = {};
        const used: Record<string, string[]> = {};
        const picks: Record<string, string | null> = {};
        for (const p of playerIds) {
            scores[p] = { gold: 0, silver: 0, bronze: 0, total: 0 };
            hands[p] = [];
            used[p] = [];
            picks[p] = null;
        }
        this.data = {
            status: 'Setup',
            playerIds: [...playerIds],
            numPlayers: playerIds.length,
            schedule: [...RACE_SCHEDULE],
            raceNo: 0,
            hands, used, picks,
            draftDeck: [],
            draftPool: [],
            draftSeq: [],
            draftSeqIndex: 0,
            draftRound: 0,
            draftBaseOrder: [],
            currentDrafter: '',
            trackId: 'mild',
            racers: {},
            participants: [...playerIds],
            currentId: '',
            lastRoll: null,
            finishers: [],
            eliminatedOrder: [],
            raceOver: false,
            firstNextRace: null,
            extraTurn: false,
            skipperPending: null,
            dicemongerUsed: {},
            pastWinnerRacerIds: [],
            raceTurns: 0,
            scores,
            events: [],
            lastEvent: null,
            eventCounter: 0,
            turnSteps: [],
            turnStart: {},
            turnDie: null,
            turnCounter: 0,
            lastTurn: null,
            pendingDecision: null,
            pendingTurn: null,
            finalWinners: []
        };
    }

    public static from_data(data: GameStateData, playerIds: string[]): MagicalAthletesGameState {
        const g = new MagicalAthletesGameState(playerIds);
        g.data = JSON.parse(JSON.stringify(data));
        return g;
    }
    public get_data(): GameStateData {
        return JSON.parse(JSON.stringify(this.data));
    }

    // ---- small helpers ----
    private track(): Track { return TRACKS[this.data.trackId]; }

    private emit(kind: GameEvent['kind'], text: string, actor?: string) {
        const ev: GameEvent = { id: ++this.data.eventCounter, text, kind, actor };
        this.data.events.push(ev);
        if (this.data.events.length > 60) this.data.events = this.data.events.slice(-60);
        this.data.lastEvent = ev;
    }

    private name(racerId: string): string { return ROSTER_BY_ID[racerId] ? ROSTER_BY_ID[racerId].name : racerId; }

    // ---- movement-timeline recording ----
    // Move a racer to `to`, recording an animatable step (unless it's a no-op that
    // isn't a finish flourish). Every position change flows through here so the
    // published timeline is complete.
    private stepMove(r: RacerState, to: number, kind: MoveKind) {
        const from = r.pos;
        r.pos = to;
        if (from !== to || kind === 'finish') this.data.turnSteps.push({ ownerId: r.ownerId, from, to, kind });
    }
    // A zero-distance cue (a trip wobble, an elimination) at the racer's spot.
    private stepCue(r: RacerState, kind: MoveKind) {
        this.data.turnSteps.push({ ownerId: r.ownerId, from: r.pos, to: r.pos, kind });
    }
    private tripRacer(r: RacerState) {
        if (r.finished || r.eliminated) return;
        r.tripped = true;
        this.stepCue(r, 'trip');
    }

    private active(): RacerState[] {
        return this.data.participants
            .map(id => this.data.racers[id])
            .filter(r => r && !r.finished && !r.eliminated);
    }
    private allRacers(): RacerState[] {
        return this.data.participants.map(id => this.data.racers[id]).filter(r => !!r);
    }
    private othersOnSpace(pos: number, exceptOwner: string): RacerState[] {
        return this.active().filter(r => r.ownerId !== exceptOwner && r.pos === pos);
    }
    private occupiedByOther(pos: number, exceptOwner: string): boolean {
        return this.active().some(r => r.ownerId !== exceptOwner && r.pos === pos);
    }
    // Racers closest to the finish (the lead), and closest to Start (last).
    private leaders(): RacerState[] {
        const a = this.active();
        if (a.length === 0) return [];
        const max = Math.max(...a.map(r => r.pos));
        return a.filter(r => r.pos === max);
    }
    private lastPlace(): RacerState[] {
        const a = this.active();
        if (a.length === 0) return [];
        const min = Math.min(...a.map(r => r.pos));
        return a.filter(r => r.pos === min);
    }

    // ==========================================================
    // Setup / deal
    // ==========================================================

    public start_game(firstPlayer?: string) {
        const n = this.playerIds.length;
        if (n < 2 || n > 6) throw new Error('Magical Athletes supports 2 to 6 players');

        this.data.raceNo = 0;
        this.data.pastWinnerRacerIds = [];
        for (const p of this.playerIds) {
            this.data.hands[p] = [];
            this.data.used[p] = [];
            this.data.scores[p] = { gold: 0, silver: 0, bronze: 0, total: 0 };
        }

        // Roll-off: highest picks first. The winner also opens Race 1. When a
        // firstPlayer is provided we seed the order from their seat (deterministic
        // for tests); otherwise it's shuffled.
        this.data.draftDeck = shuffle(ROSTER.map(r => r.id));
        if (firstPlayer && this.playerIds.includes(firstPlayer)) {
            const i = this.playerIds.indexOf(firstPlayer);
            this.data.draftBaseOrder = [...this.playerIds.slice(i), ...this.playerIds.slice(0, i)];
        } else {
            this.data.draftBaseOrder = shuffle(this.playerIds);
        }

        this.startDraftRound(0);
        this.data.status = 'Draft';
        this.emit('info', 'Recruit your team — draft racers in snake order.');
    }

    // Reveal 2 x (player count) cards and lay out this round's snake pick order.
    // Round 0 uses the roll-off order; round 1 rotates one seat left. A round of
    // "down then back" gives every player exactly 2 racers; two rounds -> 4 each.
    private startDraftRound(round: number) {
        const n = this.playerIds.length;
        const reveal = 2 * n;
        this.data.draftPool = this.data.draftDeck.splice(0, Math.min(reveal, this.data.draftDeck.length));
        const base = round === 0
            ? [...this.data.draftBaseOrder]
            : [...this.data.draftBaseOrder.slice(round), ...this.data.draftBaseOrder.slice(0, round)];
        this.data.draftSeq = [...base, ...[...base].reverse()];
        this.data.draftSeqIndex = 0;
        this.data.draftRound = round;
        this.data.currentDrafter = this.data.draftSeq[0] || '';
        this.emit('info', `Round ${round + 1} of the draft — ${reveal} racers on offer.`);
    }

    // The full pool of racers on offer (revealed but not yet taken).
    public get_draft_pool(): string[] { return [...this.data.draftPool]; }
    public get_current_drafter(): string { return this.data.currentDrafter; }

    public draft_pick(playerId: string, racerId: string) {
        if (this.data.status !== 'Draft') throw new Error('Not in the draft phase');
        if (playerId !== this.data.currentDrafter) throw new Error('It is not your turn to draft');
        const i = this.data.draftPool.indexOf(racerId);
        if (i < 0) throw new Error('That racer is not on offer');

        this.data.draftPool.splice(i, 1);
        this.data.hands[playerId].push(racerId);
        this.emit('info', `Drafts ${this.name(racerId)}.`, playerId);

        this.data.draftSeqIndex += 1;
        if (this.data.draftSeqIndex >= this.data.draftSeq.length) {
            // round complete
            if (this.data.draftRound + 1 >= 2) {
                this.finishDraft();
                return;
            }
            this.startDraftRound(this.data.draftRound + 1);
        } else {
            this.data.currentDrafter = this.data.draftSeq[this.data.draftSeqIndex];
        }
    }

    private finishDraft() {
        this.data.currentDrafter = '';
        this.data.draftPool = [];
        this.data.draftSeq = [];
        this.data.firstNextRace = this.data.draftBaseOrder[0] || this.playerIds[0];
        this.beginChoose();
    }

    private beginChoose() {
        for (const p of this.playerIds) this.data.picks[p] = null;
        this.data.status = 'Choose';
        this.data.trackId = this.data.schedule[this.data.raceNo];
        this.emit('race', `Race ${this.data.raceNo + 1} of 4 — the ${this.track().name}. Choose your racer.`);
    }

    public choose_racer(playerId: string, racerId: string) {
        if (this.data.status !== 'Choose') throw new Error('Not in the racer-selection phase');
        if (!this.playerIds.includes(playerId)) throw new Error('Unknown player');
        if (!this.data.hands[playerId].includes(racerId)) throw new Error('That racer is not in your stable');
        this.data.picks[playerId] = racerId;
        if (this.playerIds.every(p => this.data.picks[p])) this.beginRace();
    }

    private beginRace() {
        const racers: Record<string, RacerState> = {};
        for (const p of this.playerIds) {
            const racerId = this.data.picks[p] as string;
            racers[p] = {
                ownerId: p, racerId, powerId: racerId,
                pos: 0, tripped: false, finished: false, finishRank: 0, eliminated: false, flags: {}
            };
            // commit: remove from hand, mark used
            this.data.hands[p] = this.data.hands[p].filter(id => id !== racerId);
            this.data.used[p].push(racerId);
        }
        this.data.racers = racers;
        this.data.participants = [...this.playerIds];
        this.data.finishers = [];
        this.data.eliminatedOrder = [];
        this.data.raceOver = false;
        this.data.extraTurn = false;
        this.data.skipperPending = null;
        this.data.lastRoll = null;
        this.data.dicemongerUsed = {};
        this.data.raceTurns = 0;
        this.data.lastTurn = null;
        this.data.turnSteps = [];
        this.data.pendingDecision = null;
        this.data.pendingTurn = null;

        const first = this.data.firstNextRace && this.playerIds.includes(this.data.firstNextRace)
            ? this.data.firstNextRace
            : this.playerIds[randInt(this.playerIds.length)];
        this.data.currentId = first;
        this.data.status = 'Racing';

        // Run the before-race hooks (Sisyphus chips, Egg/Twin power picks) as a
        // transaction — these may ask the human, pausing exactly like a turn does.
        this.data.pendingTurn = {
            phase: 'setup', playerId: '', forcedDie: null,
            snapshot: this.snapshotData(), randomLog: [], decisions: {}
        };
        this.runAttempt();
    }

    // Before-race hooks for every racer (Sisyphus chips, Egg/Twin power picks). Runs
    // inside the setup transaction, so ctx.decide / ctx.rnd behave like in a turn.
    private runSetup() {
        for (const p of this.data.participants) {
            const r = this.data.racers[p];
            const hook = this.hooksOf(r).beforeRace;
            if (hook) hook(this.ctxFor(r, r));
        }
    }

    // ==========================================================
    // A turn
    // ==========================================================

    // `forcedDie` lets tests drive a deterministic roll; production omits it.
    // Starts a turn "transaction": if a character asks the human something, the turn
    // suspends (pendingDecision) and is replayed once the answer arrives.
    public take_turn(playerId: string, forcedDie?: number) {
        if (this.data.status !== 'Racing') throw new Error('The race is not running');
        if (this.data.pendingDecision) throw new Error('Resolve the pending decision first');
        if (playerId !== this.data.currentId) throw new Error('It is not your turn');
        const r = this.data.racers[playerId];
        if (!r || r.finished || r.eliminated) throw new Error('This racer is not in the race');

        this.data.pendingTurn = {
            phase: 'turn',
            playerId,
            forcedDie: (typeof forcedDie === 'number' && forcedDie >= 1 && forcedDie <= 6) ? forcedDie : null,
            snapshot: this.snapshotData(),
            randomLog: [],
            decisions: {}
        };
        this.runAttempt();
    }

    // Answer the outstanding decision and resume (replay) the turn.
    public resolve_decision(playerId: string, optionId: string) {
        const pd = this.data.pendingDecision;
        if (!pd) throw new Error('No decision is pending');
        if (pd.playerId !== playerId) throw new Error('This decision is not yours to make');
        if (!pd.options.some(o => o.id === optionId)) throw new Error('That is not a valid choice');
        if (!this.data.pendingTurn) throw new Error('No suspended turn to resume');
        this.data.pendingTurn.decisions[pd.id] = optionId;
        this.data.pendingDecision = null;
        this.runAttempt();
    }

    // Serialise the state at turn start (minus the continuation) as a replay baseline.
    private snapshotData(): string {
        const pt = this.data.pendingTurn, pd = this.data.pendingDecision, lt = this.data.lastTurn;
        this.data.pendingTurn = null; this.data.pendingDecision = null; this.data.lastTurn = null;
        const s = JSON.stringify(this.data);
        this.data.pendingTurn = pt; this.data.pendingDecision = pd; this.data.lastTurn = lt;
        return s;
    }

    // Run (or re-run) the current turn from its start snapshot. Random draws and
    // decisions are replayed from the continuation, so the only new inputs are the
    // freshly-supplied answer and any not-yet-drawn randomness. On a decision the
    // turn's partial mutations are discarded and the question is exposed.
    private runAttempt() {
        const pt = this.data.pendingTurn!;
        const restore = () => {
            this.data = JSON.parse(pt.snapshot) as GameStateData;
            this.data.pendingTurn = pt;
            this.data.pendingDecision = null;
            this.data.lastTurn = null;
            this.data.turnSteps = [];
            this.data.turnDie = null;
            this.data.turnStart = {};
            for (const id of this.data.participants) {
                const rr = this.data.racers[id];
                if (rr) this.data.turnStart[id] = { pos: rr.pos, finished: rr.finished, eliminated: rr.eliminated };
            }
        };
        restore();
        this._rngIdx = 0;
        this._suspend = null;
        this._tripAfter = false;
        this._cancelMain = false;

        try {
            if (pt.phase === 'setup') {
                this.runSetup();
                this.data.pendingTurn = null;
                this.data.pendingDecision = null;
                this.data.lastTurn = null; // no movement to animate for setup
                const f = this.data.racers[this.data.currentId];
                if (f) this.emit('race', `They're off! ${this.name(f.racerId)} leads out.`, f.ownerId);
            } else {
                this.runTurn(pt.playerId);
                this.data.pendingTurn = null;
                this.data.pendingDecision = null;
                this.data.lastTurn = {
                    id: ++this.data.turnCounter,
                    playerId: pt.playerId,
                    die: this.data.turnDie,
                    start: this.data.turnStart,
                    steps: this.data.turnSteps
                };
            }
        } catch (e) {
            if (e === SUSPEND) {
                restore();
                this.data.pendingDecision = this._suspend;
            } else {
                throw e;
            }
        }
    }

    // ---- seeded randomness (replay-safe) ----
    private rnd(n: number): number {
        const pt = this.data.pendingTurn;
        if (!pt) return randInt(n);
        if (this._rngIdx < pt.randomLog.length) return pt.randomLog[this._rngIdx++];
        const v = randInt(n);
        pt.randomLog.push(v);
        this._rngIdx++;
        return v;
    }
    private rollDie(): number { return 1 + this.rnd(6); }

    // ---- decision request (suspends the turn) ----
    private decide(playerId: string, key: string, prompt: string, options: DecisionOption[]): string {
        const pt = this.data.pendingTurn!;
        if (key in pt.decisions) return pt.decisions[key];
        const dr = this.data.racers[playerId];
        this._suspend = { id: key, playerId, racerId: dr ? dr.racerId : '', prompt, options };
        throw SUSPEND;
    }

    // ---- character-hook plumbing (the only bridge between engine and characters) ----
    private hooksOf(r: RacerState): RacerHooks { return RACER_HOOKS[r.powerId] || {}; }

    private ctxFor(self: RacerState, mover: RacerState): RaceCtx {
        const g = this;
        return {
            self, mover, track: g.track(),
            active: () => g.active(),
            others: (of?: RacerState) => g.active().filter(x => x.ownerId !== (of || self).ownerId),
            leaders: () => g.leaders(),
            lastPlace: () => g.lastPlace(),
            onSpace: (pos: number, except?: string) => g.active().filter(x => x.pos === pos && x.ownerId !== except),
            othersOnSpaceOf: (r: RacerState) => g.othersOnSpace(r.pos, r.ownerId),
            twoRacerSpaces: (except: string) => {
                const counts: Record<number, number> = {};
                for (const o of g.active()) if (o.ownerId !== except) counts[o.pos] = (counts[o.pos] || 0) + 1;
                return Object.keys(counts).map(Number).filter(p => counts[p] === 2);
            },
            aloneInLead: (r: RacerState) => { const l = g.leaders(); return l.length === 1 && l[0].ownerId === r.ownerId; },
            aloneInLast: (r: RacerState) => { const l = g.lastPlace(); return l.length === 1 && l[0].ownerId === r.ownerId; },
            pos: (r: RacerState) => r.pos,
            trackLen: () => g.track().length,
            allPowerIds: () => ROSTER.map(d => d.id),
            pastWinners: () => [...g.data.pastWinnerRacerIds],
            move: (r: RacerState, steps: number, kind?: MoveKind) => g.moveRacer(r, steps, kind || 'power'),
            warp: (r: RacerState, to: number, kind?: MoveKind) => g.stepMove(r, to, kind || 'warp'),
            trip: (r: RacerState) => g.tripRacer(r),
            eliminate: (r: RacerState) => g.eliminateRacer(r),
            award: (r: RacerState, pts: number) => { g.data.scores[r.ownerId].bronze = Math.max(0, g.data.scores[r.ownerId].bronze + pts); },
            finish: (r: RacerState) => g.finishRacer(r),
            rollDie: () => g.rollDie(),
            rnd: (n: number) => g.rnd(n),
            setDie: (v: number) => { g.data.turnDie = v; },
            cancelMainMove: () => { g._cancelMain = true; },
            tripAfterMove: () => { g._tripAfter = true; },
            grantExtraTurn: () => { g.data.extraTurn = true; },
            endRaceNow: () => g.endRace(),
            goNext: (owner: string) => { g.data.skipperPending = owner; },
            rerolled: (by: string) => g.rerolled(by),
            fire: (by: string) => g.triggerScoocher(by),
            decide: (pid: string, key: string, prompt: string, options: DecisionOption[]) => g.decide(pid, key, prompt, options),
            answered: (key: string) => g.data.pendingTurn ? g.data.pendingTurn.decisions[key] : undefined,
            emit: (kind, text, actor) => g.emit(kind, text, actor),
            nm: (id: string) => g.name(id)
        };
    }

    // Broadcast a hook to every active racer (each becomes ctx.self).
    private broadcast(mover: RacerState, run: (h: RacerHooks, ctx: RaceCtx) => void) {
        for (const x of this.active()) {
            const h = this.hooksOf(x);
            run(h, this.ctxFor(x, mover));
        }
    }

    // A reroll happened: broadcast it (Dicemonger profits) and count it as a power.
    private rerolled(byOwner: string) {
        this.data.lastRoll = this.data.turnDie;
        this.broadcast(this.data.racers[byOwner], (h, ctx) => { if (h.onReroll) h.onReroll(ctx, byOwner); });
        this.triggerScoocher(byOwner);
    }

    // Route any available reroll to the roller: their own reroll power (Magician),
    // plus a racer that offers rerolls to others (Dicemonger). The engine only
    // detects the generic capability; the decision policy lives in the hooks.
    private offerRerolls(r: RacerState, die: number): number {
        const mh = this.hooksOf(r);
        if (mh.reroll) die = mh.reroll(this.ctxFor(r, r), die);
        const dm = this.active().find(x => x.ownerId !== r.ownerId && this.hooksOf(x).offersRerollToOthers);
        if (dm) { const dh = this.hooksOf(dm); if (dh.reroll) die = dh.reroll(this.ctxFor(dm, r), die); }
        return die;
    }

    private runTurn(playerId: string) {
        const pt = this.data.pendingTurn!;
        const r = this.data.racers[playerId];
        this.data.skipperPending = null;
        this.data.dicemongerUsed = {};

        // Recover from a trip: skip the main move entirely.
        if (r.tripped) {
            r.tripped = false;
            this.emit('trip', `${this.name(r.racerId)} rights themselves and skips their move.`, playerId);
            this.triggerHeckler(r, r.pos);
            this.endTurn(r);
            return;
        }

        // Copycat continually mirrors the current lead's power (and its hooks).
        const ep = this.hooksOf(r).effectivePower;
        if (ep) r.powerId = ep(this.ctxFor(r, r));

        const startPos = r.pos;
        const hooks = () => this.hooksOf(r);

        // Before-move powers (all self-driven: Party Animal, Lovable Loser, Cheerleader,
        // Hypnotist, Third Wheel, Genius, Mastermind).
        if (hooks().beforeMove) hooks().beforeMove!(this.ctxFor(r, r));
        if (r.finished || r.eliminated || this.data.raceOver) { this.afterTurn(r, startPos); return; }

        // An interactive power may replace the roll entirely (Legs, Flip Flop).
        let skipMove = false;
        if (hooks().chooseMove && hooks().chooseMove!(this.ctxFor(r, r))) skipMove = true;
        if (r.finished || r.eliminated || this.data.raceOver) { this.afterTurn(r, startPos); return; }

        let base = 0;
        if (!skipMove) {
            let die = pt.forcedDie != null ? pt.forcedDie : this.rollDie();
            die = this.offerRerolls(r, die);              // Magician / Dicemonger
            this.data.lastRoll = die;
            this.data.turnDie = die;
            this.emit('roll', `${this.name(r.racerId)} rolls a ${die}.`, playerId);
            // Broadcast die-face reactions (Sisyphus, Lackey, Inchworm, Skipper, Hare).
            this.broadcast(r, (h, ctx) => { if (h.onRoll) h.onRoll(ctx, die); });
            if (hooks().postRoll) hooks().postRoll!(this.ctxFor(r, r), die); // Alchemist / Genius
            skipMove = this._cancelMain;
            base = this.data.turnDie != null ? this.data.turnDie : die;
        }

        if (r.finished || r.eliminated || this.data.raceOver) { this.afterTurn(r, startPos); return; }

        if (!skipMove) {
            // Broadcast move-amount modifiers: other racers' auras first (Gunk / Coach),
            // then the mover's own (Hare / Blimp / Party Animal, then Rocket's double).
            for (const x of this.active()) {
                if (x.ownerId === r.ownerId) continue;
                const mm = this.hooksOf(x).moveMod;
                if (mm) base = mm(this.ctxFor(x, r), base);
            }
            const moverMod = this.hooksOf(r).moveMod;
            if (moverMod) base = moverMod(this.ctxFor(r, r), base);
            if (base < 0) base = 0;

            // Suckerfish sharing this racer's space MAY follow it (interactive).
            const riders = this.othersOnSpace(r.pos, playerId).filter(x => this.hooksOf(x).follow);

            if (base > 0) this.moveRacer(r, base, 'main');

            for (const sf of riders) {
                if (sf.finished || sf.eliminated) continue;
                const fh = this.hooksOf(sf).follow;
                if (fh) { fh(this.ctxFor(sf, r), r); if (!sf.finished && !sf.eliminated) this.resolveStop(sf); }
            }

            if (this._tripAfter && !r.finished && !r.eliminated) {
                this.tripRacer(r);
                this.emit('trip', `${this.name('rocket')} tumbles after the blast.`, playerId);
            }
        }

        this.afterTurn(r, startPos);
    }

    private afterTurn(r: RacerState, startPos: number) {
        if (!r.finished && !r.eliminated) this.resolveStop(r);
        if (!r.finished && !r.eliminated && r.pos >= this.track().length) this.finishRacer(r);
        this.triggerHeckler(r, startPos);
        this.endTurn(r);
    }

    // ==========================================================
    // Movement
    // ==========================================================

    // Move `steps` spaces (signed). Honours the Leaptoad "skip occupied" and Stickler
    // "exact finish" capabilities generically, resolves passes, then broadcasts an
    // after-move signal (Huge Baby's occupancy). Warps (stepMove) don't pass through here.
    private moveRacer(r: RacerState, steps: number, kindArg: MoveKind | boolean = 'power') {
        if (steps === 0 || r.finished || r.eliminated) return;
        const kind: MoveKind = kindArg === true ? 'main' : kindArg === false ? 'power' : kindArg;
        const track = this.track();
        const dir = steps > 0 ? 1 : -1;
        const oldPos = r.pos;

        // A racer with the "block others' overshoot" capability (Stickler) gates the finish.
        if (dir > 0 && this.active().some(x => x.ownerId !== r.ownerId && this.hooksOf(x).blocksOthersOvershoot)) {
            const needed = track.length - oldPos;
            if (steps > needed) {
                this.emit('info', `${this.name('stickler')} won't let ${this.name(r.racerId)} overshoot the line.`, r.ownerId);
                return;
            }
        }

        const leaps = this.hooksOf(r).leapsOverOccupied === true;
        let remaining = Math.abs(steps);
        let pos = oldPos;
        while (remaining > 0) {
            let next = pos + dir;
            if (next < 0) { pos = 0; break; }
            if (leaps && next < track.length && this.occupiedByOther(next, r.ownerId)) {
                pos = next;
                this.triggerScoocher(r.ownerId);
                continue; // skipped spaces don't consume a step
            }
            pos = next;
            remaining--;
            if (pos >= track.length) { pos = track.length; break; }
        }
        if (pos < 0) pos = 0;
        this.stepMove(r, pos, kind);

        if (dir > 0) this.resolvePasses(r, oldPos, pos);
        this.broadcast(r, (h, ctx) => { if (h.afterAnyMove) h.afterAnyMove(ctx, r, oldPos); });
    }

    // On each pass, the mover's onPass (Centaur) and the passed racer's onPassed (Banana) fire.
    private resolvePasses(mover: RacerState, oldPos: number, newPos: number) {
        for (const t of this.active()) {
            if (t.ownerId === mover.ownerId) continue;
            const passed = oldPos < t.pos && newPos > t.pos; // sharing (==) is not passing
            if (!passed) continue;
            const mh = this.hooksOf(mover).onPass;
            if (mh) mh(this.ctxFor(mover, mover), t);
            const th = this.hooksOf(t).onPassed;
            if (th && !mover.finished && !mover.eliminated) th(this.ctxFor(t, mover), mover);
        }
    }

    // ==========================================================
    // Stop effects
    // ==========================================================

    private resolveStop(r: RacerState, depth = 0) {
        if (r.finished || r.eliminated) return;
        const track = this.track();
        if (r.pos >= track.length) return; // finishing handled elsewhere

        // Special spaces (Wild Wilds).
        const sp = track.spaces[r.pos];
        if (sp && depth < 2) {
            if (sp.type === 'star') {
                this.data.scores[r.ownerId].bronze += 1;
                this.emit('star', `${this.name(r.racerId)} scoops a star point.`, r.ownerId);
            } else if (sp.type === 'trip') {
                this.tripRacer(r);
                this.emit('trip', `${this.name(r.racerId)} trips on the trail.`, r.ownerId);
            } else if (sp.type === 'arrow' && sp.arrow) {
                this.emit('move', `An arrow whisks ${this.name(r.racerId)} ${sp.arrow > 0 ? 'forward' : 'back'} ${Math.abs(sp.arrow)}.`, r.ownerId);
                this.moveRacer(r, sp.arrow, 'arrow');
                if (r.pos >= track.length) { this.finishRacer(r); return; }
                this.resolveStop(r, depth + 1); // resolve the new space (bounded)
                return;
            }
        }

        const sharers = this.othersOnSpace(r.pos, r.ownerId);

        // The stopper's own onStop (Baba Yaga, M.O.U.T.H.).
        const stopHook = this.hooksOf(r).onStop;
        if (stopHook) stopHook(this.ctxFor(r, r));

        // Duelist MAY duel a co-located racer (interactive — the owner decides).
        for (const d of [r, ...sharers]) {
            const onShare = this.hooksOf(d).onShare;
            if (!onShare) continue;
            const opp = d.ownerId === r.ownerId ? sharers[0] : r;
            if (opp && opp.ownerId !== d.ownerId) onShare(this.ctxFor(d, r), opp);
        }

        // Everyone else reacts to the stop (Baba Yaga's space, Romantic).
        this.broadcast(r, (h, ctx) => { if (h.onOtherStop) h.onOtherStop(ctx, r); });
    }

    // ==========================================================
    // Finishing / elimination / race end
    // ==========================================================

    private finishRacer(r: RacerState) {
        if (r.finished || r.eliminated) return;
        this.stepMove(r, this.track().length, 'finish');
        r.finished = true;
        r.finishRank = this.data.finishers.length + 1;
        this.data.finishers.push(r.ownerId);
        this.emit('finish', `${this.name(r.racerId)} crosses the line — ${r.finishRank === 1 ? '1st' : '2nd'} place!`, r.ownerId);
        this.checkRaceEnd();
    }

    private eliminateRacer(r: RacerState) {
        if (r.finished || r.eliminated) return;
        this.stepCue(r, 'eliminate');
        r.eliminated = true;
        this.data.eliminatedOrder.push(r.ownerId);
        this.checkRaceEnd();
    }

    private checkRaceEnd() {
        if (this.data.raceOver) return;
        const activeRemaining = this.active().length;
        if (this.data.finishers.length >= 2) { this.endRace(); return; }
        if (activeRemaining === 0) { this.endRace(); return; }
    }

    private endRace() {
        if (this.data.raceOver) return;
        this.data.raceOver = true;
        const raceNo = this.data.raceNo;
        const first = this.data.finishers[0];
        const second = this.data.finishers[1];
        if (first) {
            this.data.scores[first].gold += GOLD_BY_RACE[raceNo];
            this.data.pastWinnerRacerIds.push(this.data.racers[first].racerId);
            this.emit('race', `${this.name(this.data.racers[first].racerId)} wins Race ${raceNo + 1} (+${GOLD_BY_RACE[raceNo]}).`, first);
        }
        if (second) {
            this.data.scores[second].silver += SILVER_BY_RACE[raceNo];
            this.emit('race', `${this.name(this.data.racers[second].racerId)} takes 2nd (+${SILVER_BY_RACE[raceNo]}).`, second);
        }
        this.recomputeTotals();
        this.data.firstNextRace = this.worstStanding();
        this.data.status = 'RaceOver';
        this.data.currentId = '';
    }

    // Who runs first next race: eliminated-first, else farthest behind, else last finisher.
    private worstStanding(): string {
        if (this.data.eliminatedOrder.length) return this.data.eliminatedOrder[0];
        const unfinished = this.data.participants
            .map(id => this.data.racers[id])
            .filter(r => !r.finished && !r.eliminated);
        if (unfinished.length) {
            unfinished.sort((a, b) => a.pos - b.pos);
            return unfinished[0].ownerId;
        }
        // everybody finished — the last across goes first
        return this.data.finishers[this.data.finishers.length - 1] || this.playerIds[0];
    }

    private recomputeTotals() {
        for (const p of this.playerIds) {
            const s = this.data.scores[p];
            s.total = s.gold + s.silver + s.bronze;
        }
    }

    // Host advances from the results screen to the next race (or final scoring).
    public advance_race(playerId: string) {
        if (this.data.status !== 'RaceOver') throw new Error('The race is still running');
        this.data.raceNo += 1;
        if (this.data.raceNo >= this.data.schedule.length) {
            this.finishGame();
        } else {
            this.beginChoose();
        }
    }

    private finishGame() {
        this.recomputeTotals();
        let best = -Infinity;
        for (const p of this.playerIds) best = Math.max(best, this.data.scores[p].total);
        this.data.finalWinners = this.playerIds.filter(p => this.data.scores[p].total === best);
        this.data.status = 'GameOver';
        this.data.currentId = '';
        this.emit('race', `The season is over. ${this.data.finalWinners.map(w => `Player`).join(' & ')}`);
    }

    // ==========================================================
    // Reactive helpers (Scoocher / Heckler) + turn hand-off
    // ==========================================================

    // A power fired: broadcast it (Scoocher rides along). `exceptOwner` is the racer
    // whose power fired, so it doesn't scooch off its own action.
    private triggerScoocher(exceptOwner: string) {
        const src = this.data.racers[exceptOwner] || this.data.racers[this.data.currentId];
        for (const x of this.active()) {
            const h = this.hooksOf(x).onAnyPower;
            if (h) h(this.ctxFor(x, src || x), exceptOwner);
        }
    }

    // A racer ended its turn: broadcast it (Heckler pounces on a near-standstill).
    private triggerHeckler(mover: RacerState, startPos: number) {
        this.broadcast(mover, (h, ctx) => { if (h.onTurnEnd) h.onTurnEnd(ctx, startPos); });
    }

    private endTurn(r: RacerState) {
        if (this.data.raceOver) return;
        // Safety net (rulebook: a loop where no one can finish ends the race with
        // remaining chips unawarded). Bounds every race to a finite length.
        this.data.raceTurns += 1;
        if (this.data.raceTurns > this.data.participants.length * 150) {
            this.emit('race', 'The racers tangle in a hopeless knot — the officials call the race.');
            this.endRace();
            return;
        }
        this.advanceTurn();
    }

    private advanceTurn() {
        if (this.data.raceOver || this.data.status !== 'Racing') return;

        // Genius extra turn (auto-claimed) keeps the same actor if still racing.
        if (this.data.extraTurn) {
            this.data.extraTurn = false;
            const cur = this.data.racers[this.data.currentId];
            if (cur && !cur.finished && !cur.eliminated) return;
        }

        // Skipper hijack.
        if (this.data.skipperPending) {
            const sk = this.data.racers[this.data.skipperPending];
            this.data.skipperPending = null;
            if (sk && !sk.finished && !sk.eliminated) { this.data.currentId = sk.ownerId; return; }
        }

        const next = this.nextActive(this.data.currentId);
        if (next) this.data.currentId = next;
    }

    private nextActive(fromId: string): string | null {
        const order = this.data.participants;
        const start = order.indexOf(fromId);
        for (let step = 1; step <= order.length; step++) {
            const id = order[(start + step) % order.length];
            const r = this.data.racers[id];
            if (r && !r.finished && !r.eliminated) return id;
        }
        return null;
    }

    // ==========================================================
    // Getters for tests / views
    // ==========================================================

    public get_status(): Phase { return this.data.status; }
    public get_current(): string { return this.data.currentId; }
    public get_scores(): Record<string, PlayerScore> { return JSON.parse(JSON.stringify(this.data.scores)); }
    public get_racers(): Record<string, RacerState> { return JSON.parse(JSON.stringify(this.data.racers)); }
}

export default MagicalAthletesGameState;
