/**
 * SchadenfreudeGameState.ts - Standalone game engine for "Seconds, Please!"
 * (a family-friendly re-theme of the Schadenfreude trick-taking rules).
 *
 * Rules in brief (3-5 players):
 *  - 4 treat suits × values −3, −2, −1, 1..9, plus two Rainbow wild cards (0 and 10).
 *    3 players remove the −2, −1 and 9 of every suit.
 *  - Follow the lead suit if able. Rainbow cards always count as the lead suit and
 *    may be played at any time; a Rainbow lead lets the next standard card set the suit.
 *  - The SECOND-highest card of the lead suit (Rainbows included) wins the trick; a lone
 *    lead-suit card wins by itself.
 *  - The winner takes the card they played plus every non-Rainbow off-suit card; the
 *    rest are discarded. Taken cards go onto the winner's plate, where a card whose
 *    value is already on the plate cancels: both are removed ("twin treats").
 *  - At round end, each plate's total moves the player's tummy meter (never below 0).
 *    Anyone over 40 is "too full" and the game ends; the highest unique score ≤ 40 wins.
 *
 * Pure class (no React / Multiplayr deps); serialised between host ticks via
 * get_data / from_data, exactly like the other decoupled game states.
 */

export type Suit = 'berry' | 'mint' | 'blueberry' | 'lemon';
export type CardSuit = Suit | 'wild';

export const SUITS: Suit[] = ['berry', 'mint', 'blueberry', 'lemon'];
export const BUST_LIMIT = 40;
export const WILD_VALUES = [0, 10];

export function suitName(suit: CardSuit | null | undefined): string {
    switch (suit) {
        case 'berry': return 'Strawberry';
        case 'mint': return 'Mint';
        case 'blueberry': return 'Blueberry';
        case 'lemon': return 'Lemon';
        case 'wild': return 'Rainbow';
        default: return '';
    }
}

export function formatValue(value: number): string {
    return value < 0 ? `−${Math.abs(value)}` : String(value);
}

export enum Phase {
    Lobby = 'Lobby',
    Play = 'Play',
    RoundEnd = 'RoundEnd',
    GameOver = 'GameOver'
}

export interface Card {
    id: number;
    suit: CardSuit;
    value: number;
}

export interface TrickPlay {
    playerId: string;
    card: Card;
}

export interface ResolvingTrick {
    plays: TrickPlay[];
    leadSuit: Suit | null;
    winnerId: string;
    winnerCardId: number;
    rankedIds: number[];     // lead-suit (incl. Rainbow) card ids, highest first
    takenIds: number[];      // trick cards that move to the winner's plate
    discardIds: number[];    // trick cards that are discarded
    cancelIds: number[];     // card ids (trick or plate) cancelled as twins
    trickNumber: number;
    resolveId: number;
}

export interface CompletedTrick {
    round: number;
    trickNumber: number;
    leadSuit: Suit | null;
    plays: TrickPlay[];
    winnerId: string;
    takenIds: number[];
    cancelIds: number[];
}

export interface PlayerState {
    hand: Card[];
    plate: Card[];
    tricksWon: number;
    score: number;          // tummy meter (persisted across rounds)
    scoreBefore: number;    // score at the start of the last scored round
    roundPoints: number;    // plate total of the last scored round
    history: number[];      // score after each round
}

export interface LastMove {
    kind: 'start' | 'play' | 'trick' | 'round' | 'gameover';
    playerId: string | null;
    desc: string;
    moveId: number;
    card?: Card;
    cancelled?: number;     // number of cards cancelled by this trick
}

export interface GameStateData {
    status: Phase;
    playerIds: string[];
    numPlayers: number;
    round: number;                 // 0-indexed
    handSize: number;
    setAsideCount: number;         // face-down leftovers (never revealed)

    players: Record<string, PlayerState>;

    roundLeaderId: string;         // leads the first trick of the round
    leaderReason: 'random' | 'lowest';
    currentPlayerId: string;
    trickLeaderId: string;
    currentTrick: TrickPlay[];
    leadSuit: Suit | null;
    trickNumber: number;           // 1-indexed
    totalTricks: number;

    resolvingTrick: ResolvingTrick | null;
    trickHistory: CompletedTrick[];

    bustedIds: string[];
    winnerId: string | null;

    lastMove: LastMove | null;
    moveCounter: number;
}

export interface DealConfig {
    handSize: number;
    setAside: number;
    deckSize: number;
}

export function suitValues(numPlayers: number): number[] {
    const all = [-3, -2, -1, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    if (numPlayers === 3) {
        return all.filter(v => v !== -2 && v !== -1 && v !== 9);
    }
    return all;
}

export function getDealConfig(numPlayers: number): DealConfig {
    const deckSize = suitValues(numPlayers).length * SUITS.length + WILD_VALUES.length;
    const handSize = numPlayers === 5 ? 10 : 12;
    return { handSize, setAside: deckSize - handSize * numPlayers, deckSize };
}

export function buildDeck(numPlayers: number): Card[] {
    const deck: Card[] = [];
    let id = 0;
    for (const suit of SUITS) {
        for (const value of suitValues(numPlayers)) {
            deck.push({ id: id++, suit, value });
        }
    }
    for (const value of WILD_VALUES) {
        deck.push({ id: id++, suit: 'wild', value });
    }
    return deck;
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

const SUIT_ORDER: Record<CardSuit, number> = { berry: 0, mint: 1, blueberry: 2, lemon: 3, wild: 4 };

export function sortHand(hand: Card[]): Card[] {
    return [...hand].sort((a, b) =>
        SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit] || a.value - b.value);
}

export function plateTotal(plate: Card[]): number {
    return plate.reduce((s, c) => s + c.value, 0);
}

/**
 * Pick the trick winner: the second-highest card among lead-suit + Rainbow cards
 * (or the only one when there is just one). Exported for testing/preview.
 */
export function rankTrick(plays: TrickPlay[], leadSuit: Suit | null): { ranked: TrickPlay[]; winner: TrickPlay } {
    const ranked = plays
        .filter(p => p.card.suit === 'wild' || p.card.suit === leadSuit)
        .sort((a, b) => b.card.value - a.card.value);
    if (ranked.length === 0) {
        // Unreachable with ≥3 players (only 2 Rainbows exist); defensive fallback.
        return { ranked, winner: plays[0] };
    }
    return { ranked, winner: ranked.length === 1 ? ranked[0] : ranked[1] };
}

/**
 * Apply taken cards to a plate one at a time; a value already on the plate cancels
 * both cards. Returns the new plate and the cancelled card ids.
 */
export function applyToPlate(plate: Card[], taken: Card[]): { plate: Card[]; cancelIds: number[] } {
    const result = [...plate];
    const cancelIds: number[] = [];
    for (const card of taken) {
        const idx = result.findIndex(c => c.value === card.value);
        if (idx >= 0) {
            cancelIds.push(result[idx].id, card.id);
            result.splice(idx, 1);
        } else {
            result.push(card);
        }
    }
    return { plate: result, cancelIds };
}

export class SchadenfreudeGameState {
    private data: GameStateData;
    private readonly playerIds: string[];
    private rng: () => number = Math.random;

    constructor(playerIds: string[]) {
        this.playerIds = [...playerIds];
        const players: Record<string, PlayerState> = {};
        playerIds.forEach(id => { players[id] = SchadenfreudeGameState.freshPlayer(); });
        this.data = {
            status: Phase.Lobby,
            playerIds: [...playerIds],
            numPlayers: playerIds.length,
            round: 0,
            handSize: 0,
            setAsideCount: 0,
            players,
            roundLeaderId: playerIds[0],
            leaderReason: 'random',
            currentPlayerId: playerIds[0],
            trickLeaderId: playerIds[0],
            currentTrick: [],
            leadSuit: null,
            trickNumber: 1,
            totalTricks: 0,
            resolvingTrick: null,
            trickHistory: [],
            bustedIds: [],
            winnerId: null,
            lastMove: null,
            moveCounter: 0
        };
    }

    private static freshPlayer(): PlayerState {
        return { hand: [], plate: [], tricksWon: 0, score: 0, scoreBefore: 0, roundPoints: 0, history: [] };
    }

    public static from_data(data: GameStateData, playerIds: string[]): SchadenfreudeGameState {
        const g = new SchadenfreudeGameState(playerIds);
        g.data = { ...data };
        return g;
    }

    public get_data(): GameStateData {
        return { ...this.data };
    }

    public set_rng(rng: () => number) {
        this.rng = rng;
    }

    public get_status(): Phase {
        return this.data.status;
    }

    public get_player_data(playerId: string): PlayerState | undefined {
        return this.data.players[playerId];
    }

    // ------------------------------------------------------------------
    // Setup
    // ------------------------------------------------------------------
    public start_game(firstLeader?: string) {
        const n = this.playerIds.length;
        if (n < 3 || n > 5) {
            throw new Error('Seconds, Please! needs 3 to 5 players.');
        }
        this.data.round = 0;
        this.data.trickHistory = [];
        this.data.bustedIds = [];
        this.data.winnerId = null;
        this.playerIds.forEach(id => { this.data.players[id] = SchadenfreudeGameState.freshPlayer(); });

        const leader = firstLeader && this.playerIds.includes(firstLeader)
            ? firstLeader
            : this.playerIds[Math.floor(this.rng() * n)];
        this.deal_round(leader, 'random');
        this.data.lastMove = {
            kind: 'start',
            playerId: leader,
            desc: 'A new picnic begins',
            moveId: ++this.data.moveCounter
        };
    }

    private deal_round(leader: string, reason: 'random' | 'lowest') {
        const n = this.playerIds.length;
        const cfg = getDealConfig(n);
        const deck = shuffle(buildDeck(n), this.rng);

        this.playerIds.forEach((id, i) => {
            const p = this.data.players[id];
            p.hand = sortHand(deck.slice(i * cfg.handSize, (i + 1) * cfg.handSize));
            p.plate = [];
            p.tricksWon = 0;
        });

        this.data.status = Phase.Play;
        this.data.handSize = cfg.handSize;
        this.data.setAsideCount = cfg.setAside;
        this.data.totalTricks = cfg.handSize;
        this.data.trickNumber = 1;
        this.data.roundLeaderId = leader;
        this.data.leaderReason = reason;
        this.data.trickLeaderId = leader;
        this.data.currentPlayerId = leader;
        this.data.currentTrick = [];
        this.data.leadSuit = null;
        this.data.resolvingTrick = null;
    }

    // ------------------------------------------------------------------
    // Trick play
    // ------------------------------------------------------------------
    private nextPlayer(playerId: string): string {
        const idx = this.playerIds.indexOf(playerId);
        return this.playerIds[(idx + 1) % this.playerIds.length];
    }

    /** Card ids the player may legally play right now (empty if not their turn). */
    public get_legal_card_ids(playerId: string): number[] {
        if (this.data.status !== Phase.Play || this.data.resolvingTrick) return [];
        if (this.data.currentPlayerId !== playerId) return [];
        const p = this.data.players[playerId];
        if (!p) return [];
        const lead = this.data.leadSuit;
        if (lead && p.hand.some(c => c.suit === lead)) {
            return p.hand.filter(c => c.suit === lead || c.suit === 'wild').map(c => c.id);
        }
        return p.hand.map(c => c.id);
    }

    public play_card(playerId: string, cardId: number) {
        if (this.data.status !== Phase.Play) {
            throw new Error('Not in the trick phase');
        }
        if (this.data.resolvingTrick) {
            throw new Error('The last trick is still being cleared');
        }
        if (this.data.currentPlayerId !== playerId) {
            throw new Error('Not your turn');
        }
        const p = this.data.players[playerId];
        const idx = p.hand.findIndex(c => c.id === cardId);
        if (idx < 0) {
            throw new Error('Card not in hand');
        }
        if (!this.get_legal_card_ids(playerId).includes(cardId)) {
            throw new Error(`You must follow ${suitName(this.data.leadSuit)} if you can`);
        }

        const card = p.hand[idx];
        p.hand = p.hand.filter(c => c.id !== cardId);
        this.data.currentTrick = [...this.data.currentTrick, { playerId, card }];
        if (this.data.leadSuit === null && card.suit !== 'wild') {
            this.data.leadSuit = card.suit;
        }

        this.data.lastMove = {
            kind: 'play',
            playerId,
            desc: `played ${suitName(card.suit)} ${formatValue(card.value)}`,
            moveId: ++this.data.moveCounter,
            card
        };

        if (this.data.currentTrick.length >= this.playerIds.length) {
            this.begin_resolution();
        } else {
            this.data.currentPlayerId = this.nextPlayer(playerId);
        }
    }

    private begin_resolution() {
        const plays = this.data.currentTrick;
        const lead = this.data.leadSuit;
        const { ranked, winner } = rankTrick(plays, lead);

        const taken = plays
            .filter(p => p === winner || (p.card.suit !== 'wild' && p.card.suit !== lead))
            .map(p => p.card);
        const takenIds = taken.map(c => c.id);
        const discardIds = plays.map(p => p.card.id).filter(id => !takenIds.includes(id));
        const { cancelIds } = applyToPlate(this.data.players[winner.playerId].plate, taken);

        this.data.resolvingTrick = {
            plays,
            leadSuit: lead,
            winnerId: winner.playerId,
            winnerCardId: winner.card.id,
            rankedIds: ranked.map(p => p.card.id),
            takenIds,
            discardIds,
            cancelIds,
            trickNumber: this.data.trickNumber,
            resolveId: ++this.data.moveCounter
        };
    }

    /** Commit the resolving trick (host calls this after the animation). Idempotent. */
    public finish_trick() {
        const rt = this.data.resolvingTrick;
        if (!rt) return;
        this.data.resolvingTrick = null;

        const winner = this.data.players[rt.winnerId];
        const taken = rt.plays.map(p => p.card).filter(c => rt.takenIds.includes(c.id));
        winner.plate = applyToPlate(winner.plate, taken).plate;
        winner.tricksWon += 1;

        this.data.trickHistory = [...this.data.trickHistory, {
            round: this.data.round,
            trickNumber: rt.trickNumber,
            leadSuit: rt.leadSuit,
            plays: rt.plays,
            winnerId: rt.winnerId,
            takenIds: rt.takenIds,
            cancelIds: rt.cancelIds
        }];

        const cancelled = rt.cancelIds.length;
        this.data.lastMove = {
            kind: 'trick',
            playerId: rt.winnerId,
            desc: cancelled > 0
                ? `takes the trick — ${cancelled / 2} twin pair${cancelled > 2 ? 's' : ''} cancelled`
                : 'takes the trick',
            moveId: ++this.data.moveCounter,
            cancelled
        };

        this.data.currentTrick = [];
        this.data.leadSuit = null;
        this.data.trickLeaderId = rt.winnerId;
        this.data.currentPlayerId = rt.winnerId;

        const handsEmpty = this.playerIds.every(id => this.data.players[id].hand.length === 0);
        if (handsEmpty) {
            this.end_round();
        } else {
            this.data.trickNumber += 1;
        }
    }

    // ------------------------------------------------------------------
    // Round / game end
    // ------------------------------------------------------------------
    private end_round() {
        this.playerIds.forEach(id => {
            const p = this.data.players[id];
            p.scoreBefore = p.score;
            p.roundPoints = plateTotal(p.plate);
            p.score = Math.max(0, p.score + p.roundPoints);
            p.history = [...p.history, p.score];
        });

        const busted = this.playerIds.filter(id => this.data.players[id].score > BUST_LIMIT);
        if (busted.length > 0) {
            this.finish_game(busted);
        } else {
            this.data.status = Phase.RoundEnd;
            this.data.lastMove = {
                kind: 'round',
                playerId: null,
                desc: `Round ${this.data.round + 1} scored`,
                moveId: ++this.data.moveCounter
            };
        }
    }

    /** Highest score held by exactly one player among `pool`; ties are eliminated. */
    private unique_extreme(pool: string[], pickHighest: boolean): string | null {
        const scores = pool.map(id => this.data.players[id].score);
        const distinct = Array.from(new Set(scores)).sort((a, b) => pickHighest ? b - a : a - b);
        for (const s of distinct) {
            const holders = pool.filter(id => this.data.players[id].score === s);
            if (holders.length === 1) return holders[0];
        }
        return null;
    }

    public compute_winner(): string | null {
        const safe = this.playerIds.filter(id => this.data.players[id].score <= BUST_LIMIT);
        const pool = safe.length > 0 ? safe : this.playerIds;
        return this.unique_extreme(pool, true);
    }

    /** Next round's leader: the unique lowest score (ties skipped); otherwise random. */
    public compute_next_leader(): { leader: string; reason: 'random' | 'lowest' } {
        const lowest = this.unique_extreme(this.playerIds, false);
        if (lowest) return { leader: lowest, reason: 'lowest' };
        return { leader: this.playerIds[Math.floor(this.rng() * this.playerIds.length)], reason: 'random' };
    }

    private finish_game(busted: string[]) {
        this.data.status = Phase.GameOver;
        this.data.bustedIds = busted;
        this.data.winnerId = this.compute_winner();
        this.data.lastMove = {
            kind: 'gameover',
            playerId: this.data.winnerId,
            desc: 'The picnic is over',
            moveId: ++this.data.moveCounter
        };
    }

    public next_round() {
        if (this.data.status !== Phase.RoundEnd) {
            throw new Error('The round is not over yet');
        }
        this.data.round += 1;
        const { leader, reason } = this.compute_next_leader();
        this.deal_round(leader, reason);
        this.data.lastMove = {
            kind: 'start',
            playerId: leader,
            desc: `Round ${this.data.round + 1} begins`,
            moveId: ++this.data.moveCounter
        };
    }
}
