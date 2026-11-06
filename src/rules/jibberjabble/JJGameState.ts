/**
 * JJGameState.ts — the pure Jibber Jabble engine.
 *
 * One shared state, rehydrated by `from_data` on the host after every sync.
 * Players are grouped into LANES: co-op is one lane holding everybody; team
 * mode is two lanes (Team Jibber vs Team Jabber) racing on the same word.
 * Inside a lane, turn order is seat order; "left of the Guesser" is the next
 * seat in that lane.
 *
 *   Choose ─► Spell ─► Reveal ─► (next round: Choose) … ─► Done
 *               │
 *               └ per lane: Spell ─► Guess ─► Watch (finished; spectating)
 *
 * Choose : co-op — the seat after the Guesser picks 1 of the 6 words.
 *          teams — one team's picker sets the difficulty (alternating each
 *          round), then the other team's picker chooses 1 of the 2 words in
 *          that band. Both teams then spell the SAME word concurrently.
 * Spell  : spellers in a lane add one letter each, clockwise, starting with the
 *          lane's chooser. On their turn a speller may say STOP — closing the
 *          clue — and then starts the next clue. Closing the last clue moves
 *          that lane to its guess.
 * Guess  : the lane's Guesser has one chance (more with a Lifeline). A lane
 *          that has guessed sits in Watch until every lane has.
 * Reveal : the word is shown. A near-miss can be overruled ("We'll allow it!")
 *          — by fellow spellers in co-op, by the rival team in team mode.
 */

import {
    CARD_BY_ID, WORD_CARDS, HINT_CARDS, HINT_BY_ID, HintId,
    MAX_CLUE_LEN, MAX_SIGNALS, DEFAULT_ROUNDS, MIN_ROUNDS, MAX_ROUNDS, MIN_TEAM_SIZE,
    tierOf, Tier, CardMode, dealMixedCard, guessMatches, normalise, rankFor, ChallengeId, EmoteId, isEmote, TIER_POINTS, SPEED_BONUS
} from './JJData';

export enum Phase {
    Choose = 'choose',
    Spell = 'spell',
    Guess = 'guess',
    Watch = 'watch',      // lane only: guessed, waiting for the other team
    Reveal = 'reveal',
    Done = 'done'
}

export interface Letter { id: number; ch: string; by: string; }
export interface Clue { letters: Letter[]; stoppedBy: string | null; starred: boolean; }
export type SignalKind = 'jibber' | 'jabble' | EmoteId;
export interface Signal { id: number; by: string; kind: SignalKind; }

export interface HintSlot { hint: HintId; used: boolean; }

export interface RoundRecord {
    round: number;
    team: number;
    guesserId: string;
    chooserId: string;
    cardId: number;
    wordIdx: number;
    word: string;
    clues: string[];
    guesses: string[];
    correct: boolean;
    overruled: boolean;
    hints: { by: string; hint: HintId }[];
    finishSeq: number;           // when this team locked in its guess (lower = earlier)
    points: number;              // co-op: 1 per word; teams: the band (1 / 2 / 3)
    bonus: number;               // teams: +0.5 to the first of two correct teams
}

export interface GameEvent { id: number; by: string; kind: 'hint' | 'overrule' | 'doover'; text: string; }

export interface Options {
    rounds?: number;
    cluesPerRound?: number;
    hints?: boolean;
    seed?: number;
    /** Team mode: exactly two arrays of player ids (≥ MIN_TEAM_SIZE each). */
    teams?: string[][];
    /** 'mixed' deals every card fresh from the word tiers (no word repeats in a game). */
    cardMode?: CardMode;
}

export interface Lane {
    seats: string[];
    guesserIdx: number;          // into seats
    status: Phase;               // Spell | Guess | Watch while the round is in play
    clues: Clue[];
    cluesTarget: number;
    turnIdx: number;             // into seats
    lettersLeft: number;         // letters the current speller still owes (Double Up)
    bonusGuesses: number;
    guessesLeft: number;
    guesses: string[];
    correct: boolean;
    overruled: boolean;
    revealLength: boolean;
    revealFirst: boolean;
    roundHints: { by: string; hint: HintId }[];
    signals: Signal[];           // Jibber!/Jabble? — private to the lane
    score: number;
    history: RoundRecord[];
}

export interface GameStateData {
    rngState: number;
    rounds: number;
    cluesPerRound: number;
    hintsEnabled: boolean;
    teamMode: boolean;
    cardMode: CardMode;

    round: number;
    phase: Phase;                // Choose | Spell (in play) | Reveal | Done
    deck: number[];              // fixed mode: card ids still to draw
    cardId: number | null;       // fixed: printed card id; mixed: running card count
    cardWords: string[] | null;  // the six words on the current card
    usedWords: string[];         // mixed mode: every word dealt so far this game
    wordIdx: number | null;
    tier: Tier | null;           // team mode: band picked this round
    tierLane: number;            // team mode: which lane picks the band

    lanes: Lane[];
    emotes: Signal[];            // public faces, everybody sees them
    hints: Record<string, HintSlot>;
    nextId: number;
    lastEvent: GameEvent | null;
}

// ---------------------------------------------------------------------------
// Seeded RNG (mulberry32) — state lives in the data so replays are exact.
// ---------------------------------------------------------------------------

function nextRandom(d: { rngState: number }): number {
    let t = (d.rngState = (d.rngState + 0x6D2B79F5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function shuffle<T>(d: { rngState: number }, arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(nextRandom(d) * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function emptyLane(seats: string[], guesserIdx: number, cluesTarget: number): Lane {
    return {
        seats, guesserIdx, status: Phase.Spell, clues: [], cluesTarget, turnIdx: 0, lettersLeft: 1,
        bonusGuesses: 0, guessesLeft: 1, guesses: [], correct: false, overruled: false,
        revealLength: false, revealFirst: false, roundHints: [], signals: [], score: 0, history: []
    };
}

export class JJGameState {
    private data: GameStateData;
    private playerIds: string[];

    constructor(playerIds: string[]) {
        this.playerIds = [...playerIds];
        this.data = null as any;
    }

    public static from_data(data: GameStateData, playerIds: string[]): JJGameState {
        const gs = new JJGameState(playerIds);
        gs.data = data;
        return gs;
    }

    public get_data(): GameStateData { return this.data; }
    public get_player_order(): string[] { return this.playerIds; }

    // ------------------------------------------------------------------
    // Setup
    // ------------------------------------------------------------------

    public start_game(opts: Options = {}) {
        const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
        const rounds = clamp(Math.round(opts.rounds ?? DEFAULT_ROUNDS), MIN_ROUNDS, MAX_ROUNDS);
        const cluesPerRound = opts.cluesPerRound === 2 ? 2 : 3;
        const teamMode = !!opts.teams;
        if (teamMode) {
            const t = opts.teams!;
            if (t.length !== 2) throw new Error('Team mode needs exactly 2 teams');
            if (t.some(team => team.length < MIN_TEAM_SIZE)) throw new Error(`Each team needs at least ${MIN_TEAM_SIZE} players`);
            const all = [...t[0], ...t[1]];
            if (new Set(all).size !== all.length || all.some(id => this.playerIds.indexOf(id) === -1)
                || all.length !== this.playerIds.length) {
                throw new Error('Every player must be on exactly one team');
            }
        }
        const d: GameStateData = {
            rngState: seed | 0,
            rounds,
            cluesPerRound,
            hintsEnabled: !!opts.hints && !teamMode,
            teamMode,
            cardMode: opts.cardMode === 'mixed' ? 'mixed' : 'fixed',
            round: 1,
            phase: Phase.Choose,
            deck: [],
            cardId: null,
            cardWords: null,
            usedWords: [],
            wordIdx: null,
            tier: null,
            tierLane: 0,
            lanes: [],
            emotes: [],
            hints: {},
            nextId: 1,
            lastEvent: null
        };
        this.data = d;
        if (d.cardMode === 'fixed') d.deck = shuffle(d, WORD_CARDS.map(c => c.id));
        const groups = teamMode ? opts.teams!.map(t => [...t]) : [[...this.playerIds]];
        d.lanes = groups.map(seats => emptyLane(seats, Math.floor(nextRandom(d) * seats.length), cluesPerRound));
        d.tierLane = teamMode ? Math.floor(nextRandom(d) * 2) : 0;

        if (d.hintsEnabled) {
            // Each player gets one random hint; with more than 10 players the
            // hint deck is reshuffled and dealt again.
            let pool: HintId[] = [];
            for (const id of this.playerIds) {
                if (pool.length === 0) pool = shuffle(d, HINT_CARDS.map(h => h.id));
                d.hints[id] = { hint: pool.pop()!, used: false };
            }
        }
        this.beginRound();
    }

    private resetLane(L: Lane) {
        const d = this.data;
        L.status = Phase.Spell;
        L.clues = [];
        L.cluesTarget = d.cluesPerRound;
        L.turnIdx = (L.guesserIdx + 1) % L.seats.length;
        L.lettersLeft = 1;
        L.bonusGuesses = 0;
        L.guessesLeft = 1;
        L.guesses = [];
        L.correct = false;
        L.overruled = false;
        L.revealLength = false;
        L.revealFirst = false;
        L.roundHints = [];
        L.signals = [];
    }

    private beginRound() {
        const d = this.data;
        d.phase = Phase.Choose;
        this.drawCard();
        d.wordIdx = null;
        d.tier = null;
        d.emotes = [];
        d.lanes.forEach(L => this.resetLane(L));
    }

    /** Put a fresh card in front of everyone (sets cardId + cardWords). */
    private drawCard() {
        const d = this.data;
        if (d.cardMode === 'mixed') {
            if (!d.usedWords) d.usedWords = [];
            const words = dealMixedCard(new Set(d.usedWords), () => nextRandom(d));
            d.usedWords.push(...words);
            d.cardId = d.usedWords.length / 6;
            d.cardWords = words;
            return;
        }
        d.cardId = this.drawFixedId();
        d.cardWords = [...CARD_BY_ID[d.cardId].words];
    }

    /** Called when a card goes unguessed: fixed cards return under the deck. */
    private returnCard() {
        const d = this.data;
        if (d.cardMode !== 'mixed' && d.cardId != null) d.deck.push(d.cardId);
    }

    private drawFixedId(): number {
        const d = this.data;
        if (d.deck.length === 0) {
            const scored = new Set<number>();
            d.lanes.forEach(L => L.history.filter(h => h.correct).forEach(h => scored.add(h.cardId)));
            const fresh = WORD_CARDS.map(c => c.id).filter(id => !scored.has(id) && id !== d.cardId);
            d.deck = shuffle(d, fresh.length ? fresh : WORD_CARDS.map(c => c.id));
        }
        return d.deck.shift()!;
    }

    // ------------------------------------------------------------------
    // Lanes & seats
    // ------------------------------------------------------------------

    public is_team_mode(): boolean { return this.data.teamMode; }
    public lane(i = 0): Lane { return this.data.lanes[i]; }
    public lane_count(): number { return this.data.lanes.length; }

    public laneOf(pid: string): number {
        return this.data.lanes.findIndex(L => L.seats.indexOf(pid) !== -1);
    }

    private laneFor(pid: string): Lane {
        const i = this.laneOf(pid);
        if (i === -1) throw new Error('Unknown player');
        return this.data.lanes[i];
    }

    /** The phase as seen from lane `i` (Spell/Guess/Watch while in play). */
    public phase(i = 0): Phase {
        const d = this.data;
        return d.phase === Phase.Spell ? d.lanes[i].status : d.phase;
    }

    public guesserId(i = 0): string { const L = this.lane(i); return L.seats[L.guesserIdx]; }
    public chooserId(i = 0): string { const L = this.lane(i); return L.seats[(L.guesserIdx + 1) % L.seats.length]; }
    public currentSpellerId(i = 0): string | null {
        const L = this.lane(i);
        return this.phase(i) === Phase.Spell ? L.seats[L.turnIdx] : null;
    }

    /** Who acts in the Choose phase right now, and what they pick. */
    public choosePicker(): { step: 'any' | 'tier' | 'word'; pickerId: string; tier: Tier | null } | null {
        const d = this.data;
        if (d.phase !== Phase.Choose) return null;
        if (!d.teamMode) return { step: 'any', pickerId: this.chooserId(0), tier: null };
        if (d.tier == null) return { step: 'tier', pickerId: this.chooserId(d.tierLane), tier: null };
        return { step: 'word', pickerId: this.chooserId(1 - d.tierLane), tier: d.tier };
    }

    private nextSpellerIdx(L: Lane, idx: number): number {
        let i = (idx + 1) % L.seats.length;
        if (i === L.guesserIdx) i = (i + 1) % L.seats.length;
        return i;
    }

    // ------------------------------------------------------------------
    // Derived
    // ------------------------------------------------------------------

    public secretWord(): string | null {
        const d = this.data;
        if (d.cardId == null || d.wordIdx == null) return null;
        const words = this.currentCardWords();
        return words ? words[d.wordIdx] : null;
    }

    public currentCardWords(): string[] | null {
        const d = this.data;
        if (d.cardWords) return [...d.cardWords];
        // Saves from before card modes only stored the printed card id.
        return d.cardId == null || !CARD_BY_ID[d.cardId] ? null : [...CARD_BY_ID[d.cardId].words];
    }

    private currentClue(L: Lane): Clue | null {
        return L.clues.length ? L.clues[L.clues.length - 1] : null;
    }

    /** Spelled clue text for lane `i`, in order (the in-progress one included). */
    public clueStrings(i = 0): string[] {
        return this.lane(i).clues.map(c => c.letters.map(l => l.ch).join(''));
    }

    public tierCountsSoFar(i = 0): Record<Tier, number> {
        const counts: Record<Tier, number> = { easy: 0, medium: 0, hard: 0 };
        this.lane(i).history.forEach(h => { counts[tierOf(h.wordIdx)]++; });
        return counts;
    }

    public score(i = 0): number { return this.lane(i).score; }
    public rank(i = 0) { return rankFor(this.lane(i).score, this.data.rounds); }

    /** Team mode: winning lane index, or null on a tie / before the end. */
    public winner(): number | null {
        const d = this.data;
        if (!d.teamMode || d.phase !== Phase.Done) return null;
        const [a, b] = d.lanes.map(L => L.score);
        return a === b ? null : a > b ? 0 : 1;
    }

    public challenges(i = 0): Record<ChallengeId, boolean> {
        const d = this.data;
        const hist = this.lane(i).history;
        const scored = hist.filter(h => h.correct);
        const tiers = { easy: 0, medium: 0, hard: 0 } as Record<Tier, number>;
        scored.forEach(h => { tiers[tierOf(h.wordIdx)]++; });
        const played = hist.length > 0;
        const alliterator = played && hist.every(h => {
            const first = h.clues.filter(c => c.length > 0).map(c => c[0]);
            return first.length >= 2 && first.every(ch => ch === first[0]);
        });
        const buzzer = played && hist.length === d.rounds && hist.every(h => h.clues.length <= 2);
        return {
            apprentice: tiers.easy >= 2 && tiers.medium >= 2 && tiers.hard >= 2,
            adept: tiers.medium >= 6,
            expert: tiers.hard >= 6,
            alliterator,
            foniks: false,
            buzzer
        };
    }

    /** Can this player play their hint right now? (`arg` checked separately.) */
    public hintUsable(pid: string): boolean {
        const d = this.data;
        const slot = d.hints[pid];
        if (!d.hintsEnabled || !slot || slot.used) return false;
        const li = this.laneOf(pid);
        if (li === -1) return false;
        const L = d.lanes[li];
        const ph = this.phase(li);
        const card = HINT_BY_ID[slot.hint];
        const myTurn = ph === Phase.Spell && this.currentSpellerId(li) === pid;
        const clue = this.currentClue(L);
        switch (slot.hint) {
            case 'rewind':
            case 'mulligan':
                return myTurn && !!clue && clue.letters.length > 0;
            case 'highlighter':
                return (ph === Phase.Spell || ph === Phase.Guess) && L.clues.some(c => c.letters.length > 0 && !c.starred);
            case 'lifeline':
                return ph === Phase.Spell || (ph === Phase.Guess && L.guessesLeft > 0);
            default:
                break;
        }
        if (card.window === 'myturn') return myTurn;
        if (card.window === 'spelling') return ph === Phase.Spell;
        return ph === Phase.Spell || ph === Phase.Guess;
    }

    // ------------------------------------------------------------------
    // Actions
    // ------------------------------------------------------------------

    private requirePhase(p: Phase) {
        if (this.data.phase !== p) throw new Error(`Not allowed during ${this.data.phase}`);
    }

    private requirePlayer(pid: string) {
        if (this.playerIds.indexOf(pid) === -1) throw new Error('Unknown player');
    }

    /** Team mode, step 1: the band (easy / medium / hard) for this round. */
    public choose_tier(pid: string, tier: Tier) {
        this.requirePhase(Phase.Choose);
        const pick = this.choosePicker()!;
        if (pick.step !== 'tier') throw new Error('Not picking a difficulty now');
        if (pid !== pick.pickerId) throw new Error('The other team picks the difficulty this round');
        if (tier !== 'easy' && tier !== 'medium' && tier !== 'hard') throw new Error('Pick easy, medium or hard');
        this.data.tier = tier;
    }

    public choose_word(pid: string, wordIdx: number) {
        this.requirePhase(Phase.Choose);
        const pick = this.choosePicker()!;
        if (pick.step === 'tier') throw new Error('Pick the difficulty first');
        if (pid !== pick.pickerId) {
            throw new Error(this.data.teamMode ? 'The other team picks the word this round' : 'Only the player left of the Guesser chooses');
        }
        if (!Number.isInteger(wordIdx) || wordIdx < 0 || wordIdx > 5) throw new Error('Pick a word 1–6');
        if (pick.step === 'word' && tierOf(wordIdx) !== pick.tier) throw new Error('Pick a word from the chosen difficulty');
        const d = this.data;
        d.wordIdx = wordIdx;
        d.phase = Phase.Spell;
        d.lanes.forEach(L => {
            L.status = Phase.Spell;
            L.clues = [{ letters: [], stoppedBy: null, starred: false }];
            L.turnIdx = (L.guesserIdx + 1) % L.seats.length;
            L.lettersLeft = 1;
        });
    }

    private requireSpeller(pid: string): Lane {
        this.requirePhase(Phase.Spell);
        const li = this.laneOf(pid);
        if (li === -1 || pid !== this.currentSpellerId(li)) throw new Error('Not your turn');
        return this.data.lanes[li];
    }

    private advanceTurn(L: Lane) {
        L.turnIdx = this.nextSpellerIdx(L, L.turnIdx);
        L.lettersLeft = 1;
    }

    private makeLetter(ch: string, by: string): Letter {
        const c = normalise(ch);
        if (c.length !== 1) throw new Error('One letter, A–Z');
        return { id: this.data.nextId++, ch: c, by };
    }

    public add_letter(pid: string, ch: string) {
        const L = this.requireSpeller(pid);
        const clue = this.currentClue(L)!;
        if (clue.letters.length >= MAX_CLUE_LEN) throw new Error('That clue is full — say STOP!');
        clue.letters.push(this.makeLetter(ch, pid));
        L.lettersLeft -= 1;
        if (L.lettersLeft <= 0) this.advanceTurn(L);
    }

    /**
     * STOP: close the current clue. If more clues remain, `ch` starts the next
     * clue (required); closing the last clue moves the lane to its guess.
     */
    public stop_clue(pid: string, ch?: string) {
        const L = this.requireSpeller(pid);
        const clue = this.currentClue(L)!;
        if (clue.letters.length === 0) throw new Error('Nothing to stop yet — add a letter first');
        const last = L.clues.length >= L.cluesTarget;
        if (!last && !ch) throw new Error('Say the first letter of the next clue');
        const first = last ? null : this.makeLetter(ch!, pid);
        clue.stoppedBy = pid;
        if (last) {
            L.status = Phase.Guess;
            L.guessesLeft = 1 + L.bonusGuesses;
            L.lettersLeft = 1;
            return;
        }
        L.clues.push({ letters: [first!], stoppedBy: null, starred: false });
        this.advanceTurn(L);
    }

    /** Jibber!/Jabble? go to your own team only, while it spells; faces go to everyone. */
    public signal(pid: string, kind: SignalKind) {
        this.requirePlayer(pid);
        const d = this.data;
        if (isEmote(kind)) {
            if (d.phase === Phase.Done) throw new Error('The game is over');
            d.emotes.push({ id: d.nextId++, by: pid, kind });
            if (d.emotes.length > MAX_SIGNALS) d.emotes.splice(0, d.emotes.length - MAX_SIGNALS);
            return;
        }
        if (kind !== 'jibber' && kind !== 'jabble') throw new Error('Say Jibber!, Jabble? or pull a face');
        const li = this.laneOf(pid);
        if (this.phase(li) !== Phase.Spell) throw new Error(`Not allowed during ${this.phase(li)}`);
        const L = d.lanes[li];
        L.signals.push({ id: d.nextId++, by: pid, kind });
        if (L.signals.length > MAX_SIGNALS) L.signals.splice(0, L.signals.length - MAX_SIGNALS);
    }

    public submit_guess(pid: string, text: string) {
        this.requirePhase(Phase.Spell);
        const li = this.laneOf(pid);
        if (li === -1 || pid !== this.guesserId(li)) throw new Error('Only the Guesser guesses');
        const L = this.data.lanes[li];
        if (L.status !== Phase.Guess) throw new Error(`Not allowed during ${L.status}`);
        const g = normalise(text);
        if (!g) throw new Error('Type a guess');
        L.guesses.push(g);
        L.guessesLeft -= 1;
        if (guessMatches(g, this.secretWord()!)) {
            L.correct = true;
            this.finishLane(li);
        } else if (L.guessesLeft <= 0) {
            this.finishLane(li);
        }
    }

    private finishLane(li: number) {
        const d = this.data;
        const L = d.lanes[li];
        L.status = Phase.Watch;
        L.history.push({
            round: d.round,
            team: li,
            guesserId: this.guesserId(li),
            chooserId: this.chooserId(li),
            cardId: d.cardId!,
            wordIdx: d.wordIdx!,
            word: this.secretWord()!,
            clues: this.clueStrings(li),
            guesses: [...L.guesses],
            correct: L.correct,
            overruled: false,
            hints: [...L.roundHints],
            finishSeq: d.nextId++,
            points: 0,
            bonus: 0
        });
        this.rescore();
        if (d.lanes.every(x => x.status === Phase.Watch)) {
            d.phase = Phase.Reveal;
            // Nobody got it → the card goes back under the deck.
            if (!d.lanes.some(x => x.correct)) this.returnCard();
        }
    }

    /**
     * Recompute every record's points and each lane's total from history, so
     * overrules and the speed bonus always stay consistent.
     *   co-op : 1 point per word guessed (the rulebook's 0–6 rank scale)
     *   teams : Easy 1 · Medium 2 · Hard 3; if BOTH teams got the word, the
     *           team that locked in its guess first gets +0.5
     */
    private rescore() {
        const d = this.data;
        const byRound = new Map<number, RoundRecord[]>();
        d.lanes.forEach(L => L.history.forEach(h => {
            h.points = h.correct ? (d.teamMode ? TIER_POINTS[tierOf(h.wordIdx)] : 1) : 0;
            h.bonus = 0;
            if (!byRound.has(h.round)) byRound.set(h.round, []);
            byRound.get(h.round)!.push(h);
        }));
        if (d.teamMode) {
            byRound.forEach(recs => {
                if (recs.length === d.lanes.length && recs.every(h => h.correct)) {
                    const first = recs.reduce((a, b) => (b.finishSeq < a.finishSeq ? b : a));
                    first.bonus = SPEED_BONUS;
                }
            });
        }
        d.lanes.forEach(L => { L.score = L.history.reduce((n, h) => n + h.points + h.bonus, 0); });
    }

    /**
     * Overrule a near-miss so it counts. Co-op: any non-Guesser. Teams: only the
     * RIVAL team can be that generous.
     */
    public allow_guess(pid: string) {
        this.requirePhase(Phase.Reveal);
        this.requirePlayer(pid);
        const d = this.data;
        const mine = this.laneOf(pid);
        const target = d.teamMode ? 1 - mine : 0;
        if (!d.teamMode && pid === this.guesserId(0)) throw new Error('The Guesser can’t overrule themself');
        const L = d.lanes[target];
        if (L.correct || L.guesses.length === 0) throw new Error('Nothing to overrule');
        L.correct = true;
        L.overruled = true;
        const idx = d.deck.lastIndexOf(d.cardId!);
        if (idx !== -1) d.deck.splice(idx, 1);
        const rec = L.history[L.history.length - 1];
        rec.correct = true;
        rec.overruled = true;
        this.rescore();
        d.lastEvent = { id: d.nextId++, by: pid, kind: 'overrule', text: 'said “We’ll allow it!”' };
    }

    public next_round(pid: string) {
        this.requirePhase(Phase.Reveal);
        this.requirePlayer(pid);
        const d = this.data;
        if (d.round >= d.rounds) {
            d.phase = Phase.Done;
            return;
        }
        d.round += 1;
        d.lanes.forEach(L => { L.guesserIdx = (L.guesserIdx + 1) % L.seats.length; });
        if (d.teamMode) d.tierLane = 1 - d.tierLane;
        this.beginRound();
    }

    public use_hint(pid: string, arg?: number) {
        this.requirePlayer(pid);
        if (!this.hintUsable(pid)) throw new Error('You can’t play that hint right now');
        const d = this.data;
        const slot = d.hints[pid];
        const L = this.laneFor(pid);
        const ph = this.phase(this.laneOf(pid));
        const clue = this.currentClue(L);
        switch (slot.hint) {
            case 'lifeline':
                if (ph === Phase.Guess) L.guessesLeft += 1;
                else L.bonusGuesses += 1;
                break;
            case 'doubleup':
                L.lettersLeft += 1;
                break;
            case 'rewind':
                clue!.letters.pop();
                break;
            case 'skip':
                this.advanceTurn(L);
                break;
            case 'mulligan':
                clue!.letters = [];
                break;
            case 'encore':
                L.cluesTarget += 1;
                break;
            case 'spotlight':
                L.revealLength = true;
                break;
            case 'firstdibs':
                L.revealFirst = true;
                break;
            case 'doover': {
                this.returnCard();
                this.drawCard();
                d.wordIdx = null;
                d.phase = Phase.Choose;
                L.clues = [];
                L.status = Phase.Spell;
                L.turnIdx = (L.guesserIdx + 1) % L.seats.length;
                L.lettersLeft = 1;
                L.signals = [];
                break;
            }
            case 'highlighter': {
                const i = typeof arg === 'number' ? arg : -1;
                const target = L.clues[i];
                if (!target || target.letters.length === 0) throw new Error('Pick a clue to star');
                if (target.starred) throw new Error('Already starred');
                target.starred = true;
                break;
            }
        }
        slot.used = true;
        L.roundHints.push({ by: pid, hint: slot.hint });
        d.lastEvent = { id: d.nextId++, by: pid, kind: slot.hint === 'doover' ? 'doover' : 'hint', text: `played ${HINT_BY_ID[slot.hint].name}!` };
    }
}
