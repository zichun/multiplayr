/**
 * TrioGameState.ts - Standalone game engine for "Trio".
 *
 * Trio is a memory / deduction card game. The deck is numbers 1-12 with three
 * copies of each (36 cards). On your turn you REVEAL cards one at a time, each
 * either the lowest/highest card of any player's hand or a face-down card from
 * the middle. The first reveal sets a target number; keep revealing matching
 * numbers until you either mismatch (all cards return, face-down) or complete a
 * trio (take all three). Collecting trios wins the game; the 7-trio wins
 * instantly. Memory of returned cards is the core skill.
 *
 * This class is pure (no React / Multiplayr / network dependencies) and is
 * serialised to JSON between host ticks, so it exposes get_data / from_data
 * rehydration helpers exactly like the other decoupled game states.
 */

export enum Phase {
    Lobby = 'Lobby',
    Play = 'Play',
    GameOver = 'GameOver'
}

export type GameMode = 'simple' | 'spicy';

export type RevealSource = 'hand' | 'middle';
export type HandEnd = 'low' | 'high';

// One card revealed during the active player's turn. Face-up and public.
export interface RevealedCard {
    source: RevealSource;
    card: number;
    playerId?: string;   // hand reveals: whose hand the card came from
    end?: HandEnd;       // hand reveals: which end (lowest / highest) it was
    slotIndex?: number;  // middle reveals: which middle slot
}

// A single, independently-addressable face-down card in the middle. `card`
// becomes null once the card has been claimed as part of a trio.
export interface MiddleSlot {
    card: number | null;
    faceUp: boolean;     // revealed during the current turn's sequence
}

export interface PlayerState {
    hand: number[];      // kept sorted ascending; only the min/max are legal reveals
    trios: number[];     // numbers collected as completed trios (always distinct)
}

// The frozen result of the just-finished reveal sequence, used purely so every
// client can animate the outcome (flip / collect / return) before it clears on
// the next action. It never gates game logic.
export interface TurnOutcome {
    kind: 'mismatch' | 'trio';
    number: number;              // the target number of the sequence
    reveals: RevealedCard[];     // every card that was revealed this turn
    playerId: string;            // the active player who revealed them
    resolveId: number;
}

export interface LastMove {
    playerId: string;            // the active (revealing) player
    fromPlayerId?: string;       // hand reveals: whose hand
    desc: string;
    moveId: number;
    kind: 'reveal' | 'trio' | 'mismatch' | 'start' | 'win';
    card?: number;
    outcome?: 'first' | 'match' | 'mismatch' | 'trio';
}

export interface GameStateData {
    status: Phase;
    playerIds: string[];
    numPlayers: number;
    mode: GameMode;

    players: Record<string, PlayerState>;
    middle: MiddleSlot[];

    currentPlayerId: string;
    firstPlayerIndex: number;

    // The live reveal sequence of the current turn.
    targetNumber: number | null;   // set by the first reveal; null between turns
    currentReveals: RevealedCard[];

    // Snapshot of the last resolved sequence for animation; cleared on next reveal.
    lastOutcome: TurnOutcome | null;

    // Set the moment a mismatch happens: the revealed cards stay face-up (frozen,
    // nobody acts) so players can memorise them. Cards are NOT returned and the
    // turn does NOT advance until finish_mismatch() is called (host-driven, after
    // the memorise + flip-back animation has played).
    resolvingMismatch: {
        reveals: RevealedCard[];
        number: number;
        playerId: string;
        resolveId: number;
    } | null;

    winnerId: string | null;
    winningTrios: number[] | null; // the trio numbers that clinched the win
    winReason: 'seven' | 'count' | 'connected' | 'exhausted' | null;

    lastMove: LastMove | null;
    moveCounter: number;
    turnCounter: number;
}

interface SetupConfig {
    dealt: number;   // cards dealt to each player
    middle: number;  // cards laid face-down in the middle
}

export function getSetupConfig(numPlayers: number): SetupConfig {
    switch (numPlayers) {
        case 3: return { dealt: 9, middle: 9 };
        case 4: return { dealt: 7, middle: 8 };
        case 5: return { dealt: 6, middle: 6 };
        case 6: return { dealt: 5, middle: 6 };
        default:
            throw new Error('Trio supports 3 to 6 players');
    }
}

/**
 * Spicy-mode adjacency. In the physical game each number card prints its
 * "connected" neighbours in the corners; that data is not derivable from the
 * rules text. This encodes a clean, symmetric stand-in: the numbers 1-12 form a
 * ring, so every number is connected to the two numbers either side of it
 * (with 12 wrapping back to 1). Swap this table for the real card adjacency if
 * you have the physical cards to hand — nothing else needs to change.
 */
export const CONNECTED_NUMBERS: Record<number, number[]> = (() => {
    const map: Record<number, number[]> = {};
    for (let n = 1; n <= 12; n++) {
        const prev = n === 1 ? 12 : n - 1;
        const next = n === 12 ? 1 : n + 1;
        map[n] = [prev, next];
    }
    return map;
})();

export function areConnected(a: number, b: number): boolean {
    return (CONNECTED_NUMBERS[a] || []).includes(b);
}

function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

export class TrioGameState {
    private data: GameStateData;
    private readonly playerIds: string[];

    constructor(playerIds: string[], mode: GameMode = 'simple') {
        this.playerIds = [...playerIds];
        this.data = {
            status: Phase.Lobby,
            playerIds: [...playerIds],
            numPlayers: playerIds.length,
            mode,
            players: {},
            middle: [],
            currentPlayerId: '',
            firstPlayerIndex: 0,
            targetNumber: null,
            currentReveals: [],
            lastOutcome: null,
            resolvingMismatch: null,
            winnerId: null,
            winningTrios: null,
            winReason: null,
            lastMove: null,
            moveCounter: 0,
            turnCounter: 0
        };
    }

    public static from_data(data: GameStateData, playerIds: string[]): TrioGameState {
        const state = new TrioGameState(playerIds);
        state.data = JSON.parse(JSON.stringify(data));
        return state;
    }

    public get_data(): GameStateData {
        return JSON.parse(JSON.stringify(this.data));
    }

    // ==========================================================
    // Setup
    // ==========================================================

    public start_game(mode: GameMode = 'simple', firstPlayer?: string) {
        if (this.playerIds.length < 3 || this.playerIds.length > 6) {
            throw new Error('Trio supports 3 to 6 players');
        }

        const cfg = getSetupConfig(this.playerIds.length);
        this.data.mode = mode;

        // Deck: numbers 1-12, three copies of each.
        const deck: number[] = [];
        for (let n = 1; n <= 12; n++) {
            for (let i = 0; i < 3; i++) deck.push(n);
        }
        const shuffled = shuffle(deck);

        this.data.players = {};
        let idx = 0;
        for (const pid of this.playerIds) {
            const hand = shuffled.slice(idx, idx + cfg.dealt).sort((a, b) => a - b);
            idx += cfg.dealt;
            this.data.players[pid] = { hand, trios: [] };
        }

        // Remaining cards go individually face-down in the middle.
        this.data.middle = shuffled.slice(idx).map(card => ({ card, faceUp: false }));

        const startIdx = firstPlayer ? Math.max(0, this.playerIds.indexOf(firstPlayer)) : 0;
        this.data.firstPlayerIndex = startIdx;
        this.data.currentPlayerId = this.playerIds[startIdx];

        this.data.status = Phase.Play;
        this.data.targetNumber = null;
        this.data.currentReveals = [];
        this.data.lastOutcome = null;
        this.data.resolvingMismatch = null;
        this.data.winnerId = null;
        this.data.winningTrios = null;
        this.data.winReason = null;
        this.data.turnCounter = 0;
        this.data.moveCounter = 0;

        this.data.lastMove = {
            playerId: this.data.currentPlayerId,
            desc: 'starts the game',
            moveId: ++this.data.moveCounter,
            kind: 'start'
        };
    }

    // ==========================================================
    // Reveal actions
    // ==========================================================

    // Reveal the lowest or highest card from a player's hand (yours or an
    // opponent's). The card is pulled out and held face-up in the sequence.
    public reveal_from_hand(activeId: string, fromPlayerId: string, end: HandEnd) {
        this.require_active(activeId);
        const owner = this.data.players[fromPlayerId];
        if (!owner) throw new Error('Unknown player');
        if (owner.hand.length === 0) throw new Error('That player has no cards to reveal');

        // Hand is kept sorted, so lowest = first, highest = last.
        const cardIndex = end === 'low' ? 0 : owner.hand.length - 1;
        const card = owner.hand[cardIndex];
        owner.hand.splice(cardIndex, 1);

        this.process_reveal({ source: 'hand', card, playerId: fromPlayerId, end });
    }

    // Flip a specific face-down card in the middle.
    public reveal_from_middle(activeId: string, slotIndex: number) {
        this.require_active(activeId);
        const slot = this.data.middle[slotIndex];
        if (!slot || slot.card === null) throw new Error('That middle card is not available');
        if (slot.faceUp) throw new Error('That middle card is already face-up');

        slot.faceUp = true;
        this.process_reveal({ source: 'middle', card: slot.card, slotIndex });
    }

    private process_reveal(rev: RevealedCard) {
        // Any fresh reveal clears the previous turn's animation snapshot.
        this.data.lastOutcome = null;

        if (this.data.currentReveals.length === 0) {
            // First reveal of the turn sets the target; no match check.
            this.data.targetNumber = rev.card;
            this.data.currentReveals.push(rev);
            this.data.lastMove = {
                playerId: this.data.currentPlayerId,
                fromPlayerId: rev.playerId,
                desc: this.reveal_desc(rev, 'first'),
                moveId: ++this.data.moveCounter,
                kind: 'reveal',
                card: rev.card,
                outcome: 'first'
            };
            return;
        }

        const matches = rev.card === this.data.targetNumber;
        this.data.currentReveals.push(rev);

        if (!matches) {
            this.resolve_mismatch(rev);
            return;
        }

        if (this.data.currentReveals.length === 3) {
            this.complete_trio();
        } else {
            this.data.lastMove = {
                playerId: this.data.currentPlayerId,
                fromPlayerId: rev.playerId,
                desc: this.reveal_desc(rev, 'match'),
                moveId: ++this.data.moveCounter,
                kind: 'reveal',
                card: rev.card,
                outcome: 'match'
            };
        }
    }

    // Mismatch: freeze the turn. Every revealed card stays face-up and public so
    // players can memorise it; nobody may act. Cards are returned and the turn
    // advances only when finish_mismatch() runs (after the animation).
    private resolve_mismatch(mismatched: RevealedCard) {
        const snapshot = this.data.currentReveals.map(r => ({ ...r }));
        const target = this.data.targetNumber as number;

        this.data.resolvingMismatch = {
            reveals: snapshot,
            number: target,
            playerId: this.data.currentPlayerId,
            resolveId: ++this.data.moveCounter
        };
        this.data.lastMove = {
            playerId: this.data.currentPlayerId,
            fromPlayerId: mismatched.playerId,
            desc: `revealed a ${mismatched.card} — no match on ${target}`,
            moveId: ++this.data.moveCounter,
            kind: 'mismatch',
            card: mismatched.card,
            outcome: 'mismatch'
        };

        // No one acts while the mismatch is on screen.
        this.data.currentPlayerId = '';
    }

    // Apply the frozen mismatch: return every revealed card to exactly where it
    // came from (hands re-sort, middle cards flip back face-down) and advance the
    // turn. Idempotent — a second call once resolved is a no-op (animation races).
    public finish_mismatch(_playerId?: string) {
        const rm = this.data.resolvingMismatch;
        if (!rm) return;
        this.data.resolvingMismatch = null;

        for (const rev of rm.reveals) {
            if (rev.source === 'hand' && rev.playerId) {
                const owner = this.data.players[rev.playerId];
                owner.hand.push(rev.card);
                owner.hand.sort((a, b) => a - b);
            } else if (rev.source === 'middle' && rev.slotIndex !== undefined) {
                this.data.middle[rev.slotIndex].faceUp = false;
            }
        }

        this.end_turn(rm.playerId);
    }

    // Trio: the third matching card. Hand reveals are already out of their
    // hands; empty the middle slots. The active player claims the trio.
    private complete_trio() {
        const snapshot = this.data.currentReveals.map(r => ({ ...r }));
        const num = this.data.targetNumber as number;
        const active = this.data.currentPlayerId;

        for (const rev of this.data.currentReveals) {
            if (rev.source === 'middle' && rev.slotIndex !== undefined) {
                this.data.middle[rev.slotIndex].card = null;
                this.data.middle[rev.slotIndex].faceUp = false;
            }
        }

        this.data.players[active].trios.push(num);

        this.data.lastOutcome = {
            kind: 'trio',
            number: num,
            reveals: snapshot,
            playerId: active,
            resolveId: ++this.data.moveCounter
        };
        this.data.lastMove = {
            playerId: active,
            desc: `completed the ${num} trio`,
            moveId: ++this.data.moveCounter,
            kind: 'trio',
            card: num,
            outcome: 'trio'
        };

        // Win check happens immediately, before any turn advance.
        const win = this.evaluate_win(active, num);
        if (win) {
            this.data.winnerId = active;
            this.data.winningTrios = win.trios;
            this.data.winReason = win.reason;
            this.data.status = Phase.GameOver;
            this.data.currentPlayerId = '';
            this.data.targetNumber = null;
            this.data.currentReveals = [];
            this.data.lastMove = {
                playerId: active,
                desc: this.win_desc(win.reason, win.trios),
                moveId: ++this.data.moveCounter,
                kind: 'win'
            };
            return;
        }

        this.end_turn(active);
    }

    // Advance to the next player (clockwise) after `actorId`, resetting the
    // sequence. If no cards remain anywhere, end the game on trio count as a
    // graceful fallback.
    private end_turn(actorId: string) {
        this.data.targetNumber = null;
        this.data.currentReveals = [];
        this.data.turnCounter += 1;

        if (this.cards_remaining() === 0) {
            this.finish_by_count();
            return;
        }

        const curIdx = this.playerIds.indexOf(actorId);
        this.data.currentPlayerId = this.playerIds[(curIdx + 1) % this.data.numPlayers];
    }

    // ==========================================================
    // Win evaluation
    // ==========================================================

    private evaluate_win(playerId: string, lastTrio: number):
        { trios: number[]; reason: 'seven' | 'count' | 'connected' } | null {
        // The 7 trio wins instantly in both modes.
        if (lastTrio === 7) {
            return { trios: [7], reason: 'seven' };
        }

        const trios = this.data.players[playerId].trios;

        if (this.data.mode === 'simple') {
            if (trios.length >= 3) {
                return { trios: [...trios], reason: 'count' };
            }
            return null;
        }

        // Spicy: any two connected trios win.
        for (let i = 0; i < trios.length; i++) {
            for (let j = i + 1; j < trios.length; j++) {
                if (areConnected(trios[i], trios[j])) {
                    return { trios: [trios[i], trios[j]], reason: 'connected' };
                }
            }
        }
        return null;
    }

    private win_desc(reason: 'seven' | 'count' | 'connected' | 'exhausted', trios: number[]): string {
        switch (reason) {
            case 'seven': return 'won instantly with the 7 trio!';
            case 'count': return `won with ${trios.length} trios!`;
            case 'connected': return `won with the connected ${trios[0]} & ${trios[1]} trios!`;
            case 'exhausted': return 'won on trio count (cards exhausted)';
            default: return 'won the game';
        }
    }

    // Fallback: nobody met a win condition but all cards are gone. Most trios
    // wins (tie broken toward the earliest player in turn order).
    private finish_by_count() {
        let winner = this.playerIds[0];
        for (const pid of this.playerIds) {
            if (this.data.players[pid].trios.length > this.data.players[winner].trios.length) {
                winner = pid;
            }
        }
        this.data.winnerId = winner;
        this.data.winningTrios = [...this.data.players[winner].trios];
        this.data.winReason = 'exhausted';
        this.data.status = Phase.GameOver;
        this.data.currentPlayerId = '';
        this.data.lastMove = {
            playerId: winner,
            desc: this.win_desc('exhausted', this.data.players[winner].trios),
            moveId: ++this.data.moveCounter,
            kind: 'win'
        };
    }

    // ==========================================================
    // Helpers
    // ==========================================================

    private cards_remaining(): number {
        let n = 0;
        for (const pid of this.playerIds) n += this.data.players[pid].hand.length;
        for (const slot of this.data.middle) if (slot.card !== null) n++;
        return n;
    }

    private reveal_desc(rev: RevealedCard, kind: 'first' | 'match'): string {
        const where = rev.source === 'middle'
            ? 'from the middle'
            : `${rev.end === 'low' ? 'lowest' : 'highest'} from a hand`;
        if (kind === 'first') return `revealed a ${rev.card} (${where}) to open`;
        return `matched a ${rev.card} (${where})`;
    }

    private require_active(activeId: string) {
        if (this.data.status !== Phase.Play) {
            throw new Error(`Action not allowed in phase ${this.data.status}`);
        }
        if (activeId !== this.data.currentPlayerId) {
            throw new Error('It is not your turn');
        }
    }

    public get_status(): Phase {
        return this.data.status;
    }

    public get_player_data(playerId: string): PlayerState | undefined {
        return this.data.players[playerId];
    }

    // What the active player can currently do, derived only from public shape
    // (never leaks hidden card values). Hands expose which ends are revealable;
    // the middle exposes which face-down slots remain.
    public get_available_reveals(playerId: string): {
        hands: Record<string, { low: boolean; high: boolean; count: number }>;
        middleSlots: number[];
    } {
        const hands: Record<string, { low: boolean; high: boolean; count: number }> = {};
        for (const pid of this.playerIds) {
            const count = this.data.players[pid].hand.length;
            hands[pid] = { low: count > 0, high: count > 1, count };
        }
        const middleSlots: number[] = [];
        this.data.middle.forEach((slot, i) => {
            if (slot.card !== null && !slot.faceUp) middleSlots.push(i);
        });
        return { hands, middleSlots };
    }
}
