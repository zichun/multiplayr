/**
 * CatInTheBoxGameState.ts - Standalone game engine for "Cat in the Box".
 *
 * A trick-taking game (2-5 players) where cards have numbers but no printed
 * colour. Players DECLARE a colour when playing a card; a shared research board
 * enforces that each (colour, number) identity is claimed at most once. Running
 * out of legal plays causes a "paradox".
 *
 * This class is pure (no React / Multiplayr / network dependencies) and is
 * serialised to JSON between host ticks, so it exposes get_data / from_data
 * rehydration helpers exactly like the other decoupled game states.
 */

export type CatColor = 'red' | 'blue' | 'yellow' | 'green';

// Fixed row order of the research board (top -> bottom). Red is trump / strongest.
export const CAT_COLORS: CatColor[] = ['red', 'blue', 'yellow', 'green'];

// Sentinel stored in a board cell that is blocked by a neutral "observed" token.
export const OBSERVED = '__observed__';

export function colorName(color: CatColor): string {
    switch (color) {
        case 'red': return 'Red';
        case 'blue': return 'Blue';
        case 'yellow': return 'Yellow';
        case 'green': return 'Green';
        default: return String(color);
    }
}

export enum Phase {
    Lobby = 'Lobby',
    Discard = 'Discard',   // everyone simultaneously buries 1 card face-down
    Predict = 'Predict',   // sequential trick-count predictions (skipped in 2p)
    Play = 'Play',         // the trick phase
    RoundEnd = 'RoundEnd', // scoring shown, host advances
    GameOver = 'GameOver'
}

export interface TrickPlay {
    playerId: string;
    number: number;
    color: CatColor;
}

export interface PlayerState {
    hand: number[];
    discard: number | null;      // the buried card (private, never revealed)
    hasDiscarded: boolean;
    prediction: number | null;   // null == not yet predicted (or 2p, which has none)
    xSlots: Record<CatColor, boolean>; // colour eligibility; false == locked out this round
    tricksWon: number;
    isParadox: boolean;          // caused the paradox this round
    roundScore: number;          // score earned in the current/last round
    roundBonus: number;          // adjacency bonus component of roundScore
    totalScore: number;
    roundHistory: number[];      // score earned per completed round
}

export interface LastMove {
    playerId: string;
    desc: string;
    moveId: number;
    kind: 'discard' | 'predict' | 'play' | 'trick' | 'paradox' | 'round' | 'start';
    color?: CatColor;
    number?: number;
}

export interface GameStateData {
    status: Phase;
    playerIds: string[];
    numPlayers: number;
    maxNum: number;              // highest card number in play (5/6/8/9)
    handSize: number;            // cards in hand after the face-down discard
    totalTricks: number;         // tricks played per round (handSize - 1)
    totalRounds: number;         // == numPlayers
    round: number;               // 0-indexed
    roundStartIndex: number;     // index into playerIds of this round's start player

    // Research board: board[color][number-1] holds an owner playerId, OBSERVED, or null.
    board: Record<CatColor, (string | null)[]>;

    currentPlayerId: string;     // whose action we're waiting on
    trickStartPlayerId: string;  // leader of the current trick
    ledColor: CatColor | null;   // colour declared by the leader
    currentTrick: TrickPlay[];
    trickNumber: number;         // 1-indexed trick within the round
    completedTricks: number;

    predictionOrder: string[];   // clockwise from round start player
    players: Record<string, PlayerState>;

    paradoxPlayerId: string | null;
    lastTrickWinnerId: string | null;
    winnerId: string | null;     // set at GameOver (may be shared -> first of tie)
    revealedTwoPlayer: number[]; // the 3 revealed numbers used to seed 2p observed tokens

    lastMove: LastMove | null;
    moveCounter: number;
}

interface RoundConfig {
    maxNum: number;
    dealt: number;      // cards dealt to each player
    handSize: number;   // after burying 1
    predictions: number[] | null; // allowed prediction values; null == no prediction (2p)
}

export function getRoundConfig(numPlayers: number): RoundConfig {
    switch (numPlayers) {
        case 2: return { maxNum: 5, dealt: 10, handSize: 9, predictions: null };
        case 3: return { maxNum: 6, dealt: 10, handSize: 9, predictions: [1, 3, 4] };
        case 4: return { maxNum: 8, dealt: 10, handSize: 9, predictions: [0, 1, 2, 3, 4] };
        case 5: return { maxNum: 9, dealt: 9, handSize: 8, predictions: [0, 1, 2, 3, 4] };
        default:
            throw new Error('Cat in the Box supports 2 to 5 players');
    }
}

function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

export class CatInTheBoxGameState {
    private data: GameStateData;
    private readonly playerIds: string[];

    constructor(playerIds: string[]) {
        this.playerIds = [...playerIds];
        const numPlayers = playerIds.length;
        this.data = {
            status: Phase.Lobby,
            playerIds: [...playerIds],
            numPlayers,
            maxNum: 0,
            handSize: 0,
            totalTricks: 0,
            totalRounds: numPlayers,
            round: 0,
            roundStartIndex: 0,
            board: { red: [], blue: [], yellow: [], green: [] },
            currentPlayerId: '',
            trickStartPlayerId: '',
            ledColor: null,
            currentTrick: [],
            trickNumber: 0,
            completedTricks: 0,
            predictionOrder: [],
            players: {},
            paradoxPlayerId: null,
            lastTrickWinnerId: null,
            winnerId: null,
            revealedTwoPlayer: [],
            lastMove: null,
            moveCounter: 0
        };
    }

    public static from_data(data: GameStateData, playerIds: string[]): CatInTheBoxGameState {
        const state = new CatInTheBoxGameState(playerIds);
        state.data = JSON.parse(JSON.stringify(data));
        return state;
    }

    public get_data(): GameStateData {
        return JSON.parse(JSON.stringify(this.data));
    }

    // ==========================================================
    // Setup
    // ==========================================================

    public start_game(firstPlayer?: string) {
        if (this.playerIds.length < 2 || this.playerIds.length > 5) {
            throw new Error('Cat in the Box supports 2 to 5 players');
        }

        this.data.round = 0;
        for (const pid of this.playerIds) {
            this.data.players[pid] = this.freshPlayerState();
        }

        const startIdx = firstPlayer ? Math.max(0, this.playerIds.indexOf(firstPlayer)) : 0;
        this.data.roundStartIndex = startIdx;

        this.setup_round();
    }

    private freshPlayerState(): PlayerState {
        return {
            hand: [],
            discard: null,
            hasDiscarded: false,
            prediction: null,
            xSlots: { red: true, blue: true, yellow: true, green: true },
            tricksWon: 0,
            isParadox: false,
            roundScore: 0,
            roundBonus: 0,
            totalScore: 0,
            roundHistory: []
        };
    }

    // (Re)deal and prepare a fresh round without wiping accumulated totals.
    private setup_round() {
        const numPlayers = this.data.numPlayers;
        const cfg = getRoundConfig(numPlayers);

        this.data.maxNum = cfg.maxNum;
        this.data.handSize = cfg.handSize;
        this.data.totalTricks = cfg.handSize - 1;
        this.data.trickNumber = 1;
        this.data.completedTricks = 0;
        this.data.ledColor = null;
        this.data.currentTrick = [];
        this.data.paradoxPlayerId = null;
        this.data.lastTrickWinnerId = null;
        this.data.revealedTwoPlayer = [];

        // Reset the research board (4 colour rows x maxNum number columns).
        this.data.board = {
            red: Array(cfg.maxNum).fill(null),
            blue: Array(cfg.maxNum).fill(null),
            yellow: Array(cfg.maxNum).fill(null),
            green: Array(cfg.maxNum).fill(null)
        };

        // Build and shuffle the deck: 5 copies of each number 1..maxNum.
        const deck: number[] = [];
        for (let n = 1; n <= cfg.maxNum; n++) {
            for (let i = 0; i < 5; i++) deck.push(n);
        }
        const shuffled = shuffle(deck);

        // Reset per-round player fields (keep totals + history).
        for (const pid of this.playerIds) {
            const p = this.data.players[pid];
            p.hand = [];
            p.discard = null;
            p.hasDiscarded = false;
            p.prediction = null;
            p.xSlots = { red: true, blue: true, yellow: true, green: true };
            p.tricksWon = 0;
            p.isParadox = false;
            p.roundScore = 0;
            p.roundBonus = 0;
        }

        // Deal cfg.dealt cards to each player.
        let idx = 0;
        for (let d = 0; d < cfg.dealt; d++) {
            for (const pid of this.playerIds) {
                this.data.players[pid].hand.push(shuffled[idx++]);
            }
        }
        // Keep hands sorted ascending for a tidy UI.
        for (const pid of this.playerIds) {
            this.data.players[pid].hand.sort((a, b) => a - b);
        }

        // 2-player: reveal 3 cards from the leftover pile to seed observed tokens.
        if (numPlayers === 2) {
            const leftover = shuffled.slice(idx); // remaining undealt cards
            const revealed = leftover.slice(0, 3);
            this.data.revealedTwoPlayer = [...revealed];
            this.seed_two_player_observed(revealed);
        }

        this.data.status = Phase.Discard;
        this.data.currentPlayerId = '';
        this.data.trickStartPlayerId = this.playerIds[this.data.roundStartIndex];

        this.data.lastMove = {
            playerId: this.playerIds[this.data.roundStartIndex],
            desc: 'starts the round',
            moveId: ++this.data.moveCounter,
            kind: 'round'
        };
    }

    // 2p: each revealed number places an observed token on the Green row; a number
    // appearing twice also blocks Yellow; three times also blocks Blue.
    private seed_two_player_observed(revealed: number[]) {
        const counts: Record<number, number> = {};
        for (const n of revealed) counts[n] = (counts[n] || 0) + 1;
        for (const key of Object.keys(counts)) {
            const n = parseInt(key, 10);
            if (n < 1 || n > this.data.maxNum) continue;
            const c = counts[n];
            this.data.board.green[n - 1] = OBSERVED;
            if (c >= 2) this.data.board.yellow[n - 1] = OBSERVED;
            if (c >= 3) this.data.board.blue[n - 1] = OBSERVED;
        }
    }

    // ==========================================================
    // Discard phase
    // ==========================================================

    public discard_card(playerId: string, cardNumber: number) {
        this.require_status(Phase.Discard);
        const p = this.data.players[playerId];
        if (!p) throw new Error('Unknown player');
        if (p.hasDiscarded) throw new Error('You have already buried a card');

        const idx = p.hand.indexOf(cardNumber);
        if (idx === -1) throw new Error('That card is not in your hand');

        p.hand.splice(idx, 1);
        p.discard = cardNumber;
        p.hasDiscarded = true;

        this.data.lastMove = {
            playerId,
            desc: 'buried a card',
            moveId: ++this.data.moveCounter,
            kind: 'discard'
        };

        // When everyone has buried a card, advance to prediction (or straight to play in 2p).
        if (this.playerIds.every(pid => this.data.players[pid].hasDiscarded)) {
            const cfg = getRoundConfig(this.data.numPlayers);
            if (cfg.predictions === null) {
                this.begin_trick_phase();
            } else {
                this.begin_prediction_phase();
            }
        }
    }

    // ==========================================================
    // Prediction phase
    // ==========================================================

    private begin_prediction_phase() {
        this.data.status = Phase.Predict;
        // Clockwise from round start player.
        const order: string[] = [];
        for (let i = 0; i < this.data.numPlayers; i++) {
            order.push(this.playerIds[(this.data.roundStartIndex + i) % this.data.numPlayers]);
        }
        this.data.predictionOrder = order;
        this.data.currentPlayerId = order[0];
    }

    public get_allowed_predictions(): number[] {
        const cfg = getRoundConfig(this.data.numPlayers);
        return cfg.predictions ? [...cfg.predictions] : [];
    }

    public make_prediction(playerId: string, value: number) {
        this.require_status(Phase.Predict);
        if (playerId !== this.data.currentPlayerId) {
            throw new Error('It is not your turn to predict');
        }
        const allowed = this.get_allowed_predictions();
        if (!allowed.includes(value)) {
            throw new Error('Prediction not allowed for this player count');
        }

        this.data.players[playerId].prediction = value;
        this.data.lastMove = {
            playerId,
            desc: `predicts ${value} trick${value === 1 ? '' : 's'}`,
            moveId: ++this.data.moveCounter,
            kind: 'predict'
        };

        const pos = this.data.predictionOrder.indexOf(playerId);
        if (pos < this.data.numPlayers - 1) {
            this.data.currentPlayerId = this.data.predictionOrder[pos + 1];
        } else {
            this.begin_trick_phase();
        }
    }

    // ==========================================================
    // Trick phase
    // ==========================================================

    private begin_trick_phase() {
        this.data.status = Phase.Play;
        this.data.trickStartPlayerId = this.playerIds[this.data.roundStartIndex];
        this.data.currentPlayerId = this.data.trickStartPlayerId;
        this.data.ledColor = null;
        this.data.currentTrick = [];
        // Extremely unlikely at the very first play, but stay defensive.
        this.maybe_paradox();
    }

    private playerIndex(playerId: string): number {
        return this.playerIds.indexOf(playerId);
    }

    // Does the Red row already hold at least one PLAYER token ("red is broken")?
    private redBroken(): boolean {
        return this.data.board.red.some(cell => cell && cell !== OBSERVED);
    }

    private cellEmpty(color: CatColor, number: number): boolean {
        return this.data.board[color][number - 1] === null;
    }

    // All legal (number, color) plays available to a player right now, honouring the
    // leading-player red restriction. This drives both move validation and paradox
    // detection (empty list on your turn == paradox).
    public get_legal_plays(playerId: string): TrickPlay[] {
        const p = this.data.players[playerId];
        if (!p) return [];
        const isLeading = this.data.currentTrick.length === 0;
        const hand = Array.from(new Set(p.hand)); // distinct numbers suffice

        const nonRed: TrickPlay[] = [];
        const redCandidates: TrickPlay[] = [];

        for (const number of hand) {
            for (const color of CAT_COLORS) {
                if (!p.xSlots[color]) continue;
                if (!this.cellEmpty(color, number)) continue;
                if (color === 'red') {
                    redCandidates.push({ playerId, number, color });
                } else {
                    nonRed.push({ playerId, number, color });
                }
            }
        }

        if (!isLeading) {
            // Followers may declare any colour freely (including Red).
            return [...nonRed, ...redCandidates];
        }

        // Leader: Red only if it's already broken, or there is no legal non-Red lead.
        const redAllowed = this.redBroken() || nonRed.length === 0;
        return redAllowed ? [...nonRed, ...redCandidates] : nonRed;
    }

    public has_legal_play(playerId: string): boolean {
        return this.get_legal_plays(playerId).length > 0;
    }

    public play_card(playerId: string, cardNumber: number, color: CatColor) {
        this.require_status(Phase.Play);
        if (playerId !== this.data.currentPlayerId) {
            throw new Error('It is not your turn');
        }
        const p = this.data.players[playerId];
        if (p.hand.indexOf(cardNumber) === -1) {
            throw new Error('That card is not in your hand');
        }

        const legal = this.get_legal_plays(playerId);
        const isLegal = legal.some(m => m.number === cardNumber && m.color === color);
        if (!isLegal) {
            throw new Error(`Illegal play: ${cardNumber} declared ${colorName(color)}`);
        }

        const isLeading = this.data.currentTrick.length === 0;

        // Place the player's token onto the research board and remove the card from hand.
        this.data.board[color][cardNumber - 1] = playerId;
        p.hand.splice(p.hand.indexOf(cardNumber), 1);

        if (isLeading) {
            this.data.ledColor = color;
        } else if (this.data.ledColor && color !== this.data.ledColor) {
            // Follow-suit penalty: permanently lose the led colour's X slot this round.
            p.xSlots[this.data.ledColor] = false;
        }

        this.data.currentTrick.push({ playerId, number: cardNumber, color });
        this.data.lastMove = {
            playerId,
            desc: `played ${cardNumber} as ${colorName(color)}`,
            moveId: ++this.data.moveCounter,
            kind: 'play',
            color,
            number: cardNumber
        };

        if (this.data.currentTrick.length === this.data.numPlayers) {
            this.resolve_trick();
        } else {
            const nextIdx = (this.playerIndex(playerId) + 1) % this.data.numPlayers;
            this.data.currentPlayerId = this.playerIds[nextIdx];
            this.maybe_paradox();
        }
    }

    // Determine the winner of a completed trick and set up the next one.
    private resolve_trick() {
        const plays = this.data.currentTrick;
        const reds = plays.filter(pl => pl.color === 'red');
        const contenders = reds.length > 0
            ? reds
            : plays.filter(pl => pl.color === this.data.ledColor);

        let winner = contenders[0];
        for (const c of contenders) {
            if (c.number > winner.number) winner = c;
        }

        this.data.players[winner.playerId].tricksWon += 1;
        this.data.lastTrickWinnerId = winner.playerId;
        this.data.completedTricks += 1;

        this.data.lastMove = {
            playerId: winner.playerId,
            desc: `won trick ${this.data.trickNumber}`,
            moveId: ++this.data.moveCounter,
            kind: 'trick'
        };

        if (this.data.completedTricks >= this.data.totalTricks) {
            this.end_round();
            return;
        }

        // Winner leads the next trick.
        this.data.currentTrick = [];
        this.data.ledColor = null;
        this.data.trickNumber += 1;
        this.data.trickStartPlayerId = winner.playerId;
        this.data.currentPlayerId = winner.playerId;
        this.maybe_paradox();
    }

    // If the active player has no legal play, a paradox occurs.
    private maybe_paradox() {
        if (this.data.status !== Phase.Play) return;
        if (!this.has_legal_play(this.data.currentPlayerId)) {
            this.trigger_paradox(this.data.currentPlayerId);
        }
    }

    private trigger_paradox(playerId: string) {
        this.data.paradoxPlayerId = playerId;
        this.data.players[playerId].isParadox = true;
        // The interrupted trick simply does not resolve: cards played by earlier
        // players this trick are set aside (no winner), but the tokens already
        // placed on the research board remain. Proceed straight to scoring.
        this.data.lastMove = {
            playerId,
            desc: 'triggered a PARADOX',
            moveId: ++this.data.moveCounter,
            kind: 'paradox'
        };
        this.end_round();
    }

    // ==========================================================
    // Scoring & round transitions
    // ==========================================================

    private end_round() {
        const numPlayers = this.data.numPlayers;
        const cfg = getRoundConfig(numPlayers);

        for (const pid of this.playerIds) {
            const p = this.data.players[pid];
            const base = p.isParadox ? -p.tricksWon : p.tricksWon;

            let bonus = 0;
            if (!p.isParadox) {
                let bonusEligible: boolean;
                if (cfg.predictions === null) {
                    // 2p: bonus for winning 4 or fewer tricks.
                    bonusEligible = p.tricksWon <= 4;
                } else {
                    // Otherwise: bonus only if prediction matched exactly.
                    bonusEligible = p.prediction !== null && p.prediction === p.tricksWon;
                }
                if (bonusEligible) {
                    bonus = this.largest_connected_group(pid);
                }
            }

            p.roundBonus = bonus;
            p.roundScore = base + bonus;
            p.totalScore += p.roundScore;
            p.roundHistory.push(p.roundScore);
        }

        this.data.status = Phase.RoundEnd;
        this.data.currentPlayerId = '';
    }

    // Size of the largest orthogonally-connected group of a player's tokens on the board.
    public largest_connected_group(playerId: string): number {
        const rows = CAT_COLORS.length;
        const cols = this.data.maxNum;
        const owned: boolean[][] = CAT_COLORS.map(color =>
            this.data.board[color].map(cell => cell === playerId)
        );
        const seen: boolean[][] = CAT_COLORS.map(() => Array(cols).fill(false));

        let best = 0;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (!owned[r][c] || seen[r][c]) continue;
                // Iterative flood fill.
                let size = 0;
                const stack: [number, number][] = [[r, c]];
                seen[r][c] = true;
                while (stack.length) {
                    const [cr, cc] = stack.pop()!;
                    size++;
                    const neighbours: [number, number][] = [
                        [cr - 1, cc], [cr + 1, cc], [cr, cc - 1], [cr, cc + 1]
                    ];
                    for (const [nr, nc] of neighbours) {
                        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
                        if (owned[nr][nc] && !seen[nr][nc]) {
                            seen[nr][nc] = true;
                            stack.push([nr, nc]);
                        }
                    }
                }
                if (size > best) best = size;
            }
        }
        return best;
    }

    // Host advances from the round-end screen: either deal the next round or end the game.
    public next_round(playerId: string) {
        this.require_status(Phase.RoundEnd);
        if (this.data.round >= this.data.totalRounds - 1) {
            this.finish_game();
            return;
        }
        this.data.round += 1;
        this.data.roundStartIndex = (this.data.roundStartIndex + 1) % this.data.numPlayers;
        this.setup_round();
    }

    private finish_game() {
        this.data.status = Phase.GameOver;
        this.data.currentPlayerId = '';

        // Winner: highest total; tiebreak on final round score; else shared (first listed).
        let winner = this.playerIds[0];
        for (const pid of this.playerIds) {
            const p = this.data.players[pid];
            const w = this.data.players[winner];
            if (p.totalScore > w.totalScore) {
                winner = pid;
            } else if (p.totalScore === w.totalScore) {
                const pLast = p.roundHistory[p.roundHistory.length - 1] || 0;
                const wLast = w.roundHistory[w.roundHistory.length - 1] || 0;
                if (pLast > wLast) winner = pid;
            }
        }
        this.data.winnerId = winner;
        this.data.lastMove = {
            playerId: winner,
            desc: 'wins the game',
            moveId: ++this.data.moveCounter,
            kind: 'round'
        };
    }

    // ==========================================================
    // Helpers
    // ==========================================================

    private require_status(status: Phase) {
        if (this.data.status !== status) {
            throw new Error(`Action not allowed in phase ${this.data.status}`);
        }
    }

    public get_status(): Phase {
        return this.data.status;
    }

    public get_player_data(playerId: string): PlayerState | undefined {
        return this.data.players[playerId];
    }
}
