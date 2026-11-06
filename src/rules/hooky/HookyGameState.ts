/**
 * HookyGameState.ts — the pure Hooky engine.
 *
 * One shared state, rehydrated by `from_data` on the host after every sync.
 * `order` is the seat order rotated so the (random, fixed) start player sits first.
 *
 *   Clue ─► Ask (round 1 … N) ─► … ─► Final ─► Done
 *              │  end of round: maybe turn up a Playground card,
 *              └─ and after the guess rounds: Guess (everyone secretly names 3 Hooky letters)
 *
 * Clue  : each player in turn gives one 5-letter word holding ≥1 of their own
 *         letters; the count of their own letters in it is published.
 * Ask   : the active player asks one opponent one word (count is public). From
 *         round 2 they may also, once per turn, before or after asking, reveal one
 *         of their own hidden cards and then peek at a random hidden card of a
 *         chosen opponent. A turn ends once the question is asked and no reveal is
 *         still available (or the player ends it).
 * Guess : simultaneous; each player locks in 3 distinct letters.
 * Final : simultaneous; each player names every opponent's whole hand.
 */

import {
    LETTERS, SETUPS, Setup, HOOKY_COUNT, MIN_PLAYERS, MAX_PLAYERS, WORD_LEN,
    normaliseWord, isWellFormed, isListed, anagramKey, countIn, hookyPointsFor
} from './HookyData';

export enum Phase {
    Clue = 'clue',
    Ask = 'ask',
    Guess = 'guess',
    Final = 'final',
    Done = 'done'
}

export type LogKind = 'clue' | 'ask' | 'reveal' | 'playground';

/** A public record. A reveal's peeked letter is never here (see `peeks`). */
export interface LogEntry {
    id: number;
    kind: LogKind;
    round: number;             // 0 = initial clues / setup
    by: string | null;         // null for playground
    target: string | null;     // ask: the questioned player; reveal: who was peeked at
    word: string | null;
    count: number | null;
    unlisted: boolean;         // the word was not in the list; the asker confirmed it
    letter: string | null;     // reveal: the card turned up; playground: the card
}

export interface Peek { logId: number; round: number; target: string; letter: string; }

export interface HookyResult {
    id: string;
    hooky: { round: number; letters: string[]; correct: string[]; points: number }[];
    hands: { target: string; guess: string[]; correct: string[]; exact: boolean }[];
    hookyPoints: number;
    handPoints: number;
    bonus: number;
    total: number;
    reveals: number;
    firstHit: number | null;   // earliest guess round with ≥1 correct Hooky letter
    firstHitCount: number;     // correct letters in that round
    rank: number;              // 1 = winner (shared ranks possible)
}

export interface GameStateData {
    gameId: number;
    rngState: number;
    setup: Setup;
    order: string[];
    phase: Phase;
    round: number;
    turnIdx: number;
    turn: { asked: boolean; revealed: boolean };

    hands: Record<string, string[]>;
    revealed: Record<string, string[]>;
    hooky: string[];
    playground: string[];
    pgShown: number;

    log: LogEntry[];
    peeks: Record<string, Peek[]>;
    hookyGuesses: Record<string, Record<number, string[]>>;
    finalGuesses: Record<string, Record<string, string[]>>;
    results: HookyResult[] | null;
    nextId: number;
}

export interface Options { seed?: number; }

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

const sorted = (a: string[]) => [...a].sort();

export class HookyGameState {
    private data: GameStateData;
    private playerIds: string[];

    constructor(playerIds: string[]) {
        this.playerIds = [...playerIds];
        this.data = null as any;
    }

    public static from_data(data: GameStateData, playerIds: string[]): HookyGameState {
        const gs = new HookyGameState(playerIds);
        gs.data = data;
        return gs;
    }

    public get_data(): GameStateData { return this.data; }
    public get_player_order(): string[] { return this.playerIds; }

    // ------------------------------------------------------------------
    // Setup
    // ------------------------------------------------------------------

    public start_game(opts: Options = {}) {
        const n = this.playerIds.length;
        if (n < MIN_PLAYERS || n > MAX_PLAYERS) throw new Error(`Hooky needs ${MIN_PLAYERS} to ${MAX_PLAYERS} players`);
        const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
        const setup = SETUPS[n];
        const d: GameStateData = {
            gameId: seed,
            rngState: seed | 0,
            setup,
            order: [],
            phase: Phase.Clue,
            round: 0,
            turnIdx: 0,
            turn: { asked: false, revealed: false },
            hands: {},
            revealed: {},
            hooky: [],
            playground: [],
            pgShown: 0,
            log: [],
            peeks: {},
            hookyGuesses: {},
            finalGuesses: {},
            results: null,
            nextId: 1
        };
        this.data = d;
        const start = Math.floor(nextRandom(d) * n);
        d.order = [...this.playerIds.slice(start), ...this.playerIds.slice(0, start)];

        const deck = shuffle(d, LETTERS);
        for (const id of d.order) {
            d.hands[id] = sorted(deck.splice(0, setup.hand));
            d.revealed[id] = [];
            d.peeks[id] = [];
            d.hookyGuesses[id] = {};
        }
        d.playground = deck.splice(0, setup.playground);
        d.hooky = sorted(deck.splice(0, HOOKY_COUNT));
        if (deck.length !== 0) throw new Error('Deal did not use all 26 cards');
        for (let i = 0; i < setup.pgAtStart; i++) this.showPlayground();
    }

    // ------------------------------------------------------------------
    // Queries
    // ------------------------------------------------------------------

    public phase(): Phase { return this.data.phase; }
    public order(): string[] { return this.data.order; }
    public setup(): Setup { return this.data.setup; }

    public activeId(): string | null {
        const d = this.data;
        return d.phase === Phase.Clue || d.phase === Phase.Ask ? d.order[d.turnIdx] : null;
    }

    public hand(id: string): string[] { return this.data.hands[id] || []; }
    public hidden(id: string): string[] {
        const rev = new Set(this.data.revealed[id] || []);
        return this.hand(id).filter(l => !rev.has(l));
    }
    public playgroundShown(): string[] { return this.data.playground.slice(0, this.data.pgShown); }

    /** Opponents this player may peek at after revealing (they still hold a hidden card). */
    public peekTargets(id: string): string[] {
        return this.data.order.filter(o => o !== id && this.hidden(o).length > 0);
    }

    /** May `id` reveal right now? */
    public canReveal(id: string): boolean {
        const d = this.data;
        return d.phase === Phase.Ask && this.activeId() === id && d.round >= 2 && !d.turn.revealed
            && this.hidden(id).length > 0 && this.peekTargets(id).length > 0;
    }

    /** Anagram keys already put to `target` (including their own initial clue). */
    public usedKeys(target: string): Set<string> {
        const keys = new Set<string>();
        this.data.log.forEach(e => {
            if ((e.kind === 'ask' && e.target === target) || (e.kind === 'clue' && e.by === target)) keys.add(anagramKey(e.word!));
        });
        return keys;
    }

    /** Who has locked in their Hooky guess for this round. */
    public lockedIn(): string[] {
        const d = this.data;
        return d.order.filter(id => !!d.hookyGuesses[id][d.round]);
    }

    public finalSubmitted(): string[] {
        return this.data.order.filter(id => !!this.data.finalGuesses[id]);
    }

    // ------------------------------------------------------------------
    // Actions
    // ------------------------------------------------------------------

    private checkWord(raw: string, force: boolean): { word: string; unlisted: boolean } {
        const word = normaliseWord(raw);
        if (!isWellFormed(word)) throw new Error(`Words must be exactly ${WORD_LEN} letters`);
        const listed = isListed(word);
        if (!listed && !force) throw new Error(`${word} isn't in the word list`);
        return { word, unlisted: !listed };
    }

    private push(e: Omit<LogEntry, 'id'>): LogEntry {
        const entry = { ...e, id: this.data.nextId++ };
        this.data.log.push(entry);
        return entry;
    }

    public give_clue(id: string, raw: string, force = false) {
        const d = this.data;
        if (d.phase !== Phase.Clue) throw new Error('Not the clue phase');
        if (this.activeId() !== id) throw new Error('Not your turn');
        const { word, unlisted } = this.checkWord(raw, force);
        const count = countIn(word, this.hand(id));
        if (count === 0) throw new Error('Your clue must use at least one of your own letters');
        this.push({ kind: 'clue', round: 0, by: id, target: id, word, count, unlisted, letter: null });
        d.turnIdx++;
        if (d.turnIdx >= d.order.length) this.beginRound(1);
    }

    public ask(id: string, target: string, raw: string, force = false) {
        const d = this.data;
        if (d.phase !== Phase.Ask) throw new Error('Not the question phase');
        if (this.activeId() !== id) throw new Error('Not your turn');
        if (d.turn.asked) throw new Error('You already asked this turn');
        if (target === id || d.order.indexOf(target) === -1) throw new Error('Ask another player');
        const { word, unlisted } = this.checkWord(raw, force);
        if (this.usedKeys(target).has(anagramKey(word))) throw new Error('That player has already been asked those letters');
        const count = countIn(word, this.hand(target));
        this.push({ kind: 'ask', round: d.round, by: id, target, word, count, unlisted, letter: null });
        d.turn.asked = true;
        this.maybeEndTurn();
    }

    /** Reveal one of your hidden cards, then peek at a random hidden card of `target`. */
    public reveal(id: string, letter: string, target: string): Peek {
        const d = this.data;
        if (!this.canReveal(id)) throw new Error('You cannot reveal right now');
        const L = String(letter || '').toUpperCase();
        if (this.hidden(id).indexOf(L) === -1) throw new Error('Reveal one of your own hidden cards');
        if (this.peekTargets(id).indexOf(target) === -1) throw new Error('Peek at another player with a hidden card');
        d.revealed[id].push(L);
        const pool = this.hidden(target);
        const seen = pool[Math.floor(nextRandom(d) * pool.length)];
        const e = this.push({ kind: 'reveal', round: d.round, by: id, target, word: null, count: null, unlisted: false, letter: L });
        const peek: Peek = { logId: e.id, round: d.round, target, letter: seen };
        d.peeks[id].push(peek);
        d.turn.revealed = true;
        this.maybeEndTurn();
        return peek;
    }

    /** Finish the turn after asking (skipping the optional reveal). */
    public end_turn(id: string) {
        const d = this.data;
        if (d.phase !== Phase.Ask || this.activeId() !== id) throw new Error('Not your turn');
        if (!d.turn.asked) throw new Error('Ask your question first');
        this.advance();
    }

    public guess_hooky(id: string, letters: string[]) {
        const d = this.data;
        if (d.phase !== Phase.Guess) throw new Error('Not time to guess the Hooky students');
        if (d.order.indexOf(id) === -1) throw new Error('Not a player');
        if (d.hookyGuesses[id][d.round]) throw new Error('Already locked in');
        const ls = (letters || []).map(l => String(l).toUpperCase());
        if (ls.length !== HOOKY_COUNT || new Set(ls).size !== HOOKY_COUNT || ls.some(l => LETTERS.indexOf(l) === -1)) {
            throw new Error(`Pick ${HOOKY_COUNT} different letters`);
        }
        d.hookyGuesses[id][d.round] = sorted(ls);
        if (this.lockedIn().length === d.order.length) {
            if (d.round >= d.setup.rounds) d.phase = Phase.Final;
            else this.beginRound(d.round + 1);
        }
    }

    public submit_final(id: string, guesses: Record<string, string[]>) {
        const d = this.data;
        if (d.phase !== Phase.Final) throw new Error('Not the final guess');
        if (d.order.indexOf(id) === -1) throw new Error('Not a player');
        if (d.finalGuesses[id]) throw new Error('Already submitted');
        const clean: Record<string, string[]> = {};
        for (const opp of d.order) {
            if (opp === id) continue;
            const g = ((guesses || {})[opp] || []).map(l => String(l).toUpperCase());
            if (g.length !== d.setup.hand || new Set(g).size !== g.length || g.some(l => LETTERS.indexOf(l) === -1)) {
                throw new Error(`Name exactly ${d.setup.hand} different letters for every opponent`);
            }
            clean[opp] = sorted(g);
        }
        d.finalGuesses[id] = clean;
        if (this.finalSubmitted().length === d.order.length) {
            d.phase = Phase.Done;
            d.results = this.score();
        }
    }

    // ------------------------------------------------------------------
    // Flow
    // ------------------------------------------------------------------

    private maybeEndTurn() {
        const d = this.data;
        const id = this.activeId()!;
        if (d.turn.asked && !this.canReveal(id)) this.advance();
    }

    private advance() {
        const d = this.data;
        d.turnIdx++;
        d.turn = { asked: false, revealed: false };
        if (d.turnIdx < d.order.length) return;
        // end of round
        if (d.setup.pgAfter.indexOf(d.round) !== -1) this.showPlayground();
        if (d.setup.guessAfter.indexOf(d.round) !== -1) d.phase = Phase.Guess;
        else this.beginRound(d.round + 1);
    }

    private beginRound(r: number) {
        const d = this.data;
        d.round = r;
        d.turnIdx = 0;
        d.turn = { asked: false, revealed: false };
        d.phase = Phase.Ask;
    }

    private showPlayground() {
        const d = this.data;
        if (d.pgShown >= d.playground.length) return;
        const letter = d.playground[d.pgShown++];
        this.push({ kind: 'playground', round: d.round, by: null, target: null, word: null, count: null, unlisted: false, letter });
    }

    // ------------------------------------------------------------------
    // Scoring
    // ------------------------------------------------------------------

    public score(): HookyResult[] {
        const d = this.data;
        const hooky = new Set(d.hooky);
        const res: HookyResult[] = d.order.map(id => {
            const hk = d.setup.guessAfter.map(round => {
                const letters = d.hookyGuesses[id][round] || [];
                const correct = letters.filter(l => hooky.has(l));
                return { round, letters, correct, points: correct.length * hookyPointsFor(d.setup, round) };
            });
            const fg = d.finalGuesses[id] || {};
            const hands = d.order.filter(o => o !== id).map(target => {
                const guess = fg[target] || [];
                const actual = new Set(d.hands[target]);
                const correct = guess.filter(l => actual.has(l));
                return { target, guess, correct, exact: correct.length === d.hands[target].length };
            });
            const first = hk.find(h => h.correct.length > 0);
            const hookyPoints = hk.reduce((n, h) => n + h.points, 0);
            const handPoints = hands.reduce((n, h) => n + h.correct.length, 0);
            const bonus = hands.filter(h => h.exact).length;
            return {
                id, hooky: hk, hands, hookyPoints, handPoints, bonus,
                total: hookyPoints + handPoints + bonus,
                reveals: d.revealed[id].length,
                firstHit: first ? first.round : null,
                firstHitCount: first ? first.correct.length : 0,
                rank: 0
            };
        });
        const cmp = (a: HookyResult, b: HookyResult) =>
            (b.total - a.total)
            || ((a.firstHit ?? 99) - (b.firstHit ?? 99))
            || (b.firstHitCount - a.firstHitCount)
            || (a.reveals - b.reveals);
        const ranked = [...res].sort(cmp);
        ranked.forEach((r, i) => { r.rank = i > 0 && cmp(ranked[i - 1], r) === 0 ? ranked[i - 1].rank : i + 1; });
        return ranked;
    }
}
