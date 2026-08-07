/**
 * SplendorGameState.ts - Standalone game engine for Splendor (base game, 2-4 players).
 *
 * Pure, frame-independent state machine (no React / Multiplayr / socket deps) per the
 * decoupled GameState architecture. Serializable via get_data / from_data.
 *
 * Colour model: five gems + gold (wild). Internally we use the full gem names
 * (white/blue/green/red/black) which map to the spec's canonical codes w/u/g/r/k so
 * the shared Splendor iconography (`gem_${color}_coin`, …) can be reused directly.
 */

export type GemColor = 'white' | 'blue' | 'green' | 'red' | 'black';
export type TokenColor = GemColor | 'gold';

// Canonical key order everywhere (matches spec: White, Blue, Green, Red, Black).
export const GEM_COLORS: GemColor[] = ['white', 'blue', 'green', 'red', 'black'];
export const TOKEN_COLORS: TokenColor[] = ['white', 'blue', 'green', 'red', 'black', 'gold'];

// Human-friendly gem names for logs / notifications.
export function gemName(color: TokenColor): string {
    switch (color) {
        case 'white': return 'Diamond';
        case 'blue': return 'Sapphire';
        case 'green': return 'Emerald';
        case 'red': return 'Ruby';
        case 'black': return 'Onyx';
        case 'gold': return 'Gold';
        default: return String(color);
    }
}

export interface Card {
    id: string;
    level: 1 | 2 | 3;
    bonus: GemColor;            // the permanent discount colour this card grants
    pts: number;               // prestige / VP
    cost: Partial<Record<GemColor, number>>; // gems only; gold never appears
}

export interface Noble {
    id: string;
    pts: number;               // always 3
    req: Partial<Record<GemColor, number>>; // required BONUS counts (not tokens)
}

export enum GameStatus {
    Lobby = 'Lobby',
    Active = 'Active',
    PendingNoble = 'PendingNoble',     // waiting for a player to choose among tied nobles
    PendingDiscard = 'PendingDiscard', // waiting for a player to discard down to 10 tokens
    GameOver = 'GameOver'
}

export type ActionPhase = 'Normal' | 'SelectNoble' | 'Discard';

export interface PlayerState {
    tokens: Record<TokenColor, number>;
    cards: Card[];
    reserved: Card[];
    nobles: Noble[];
}

export interface LastMove {
    playerId: string;
    desc: string;
    moveId: number;
    kind: 'take' | 'reserve' | 'buy' | 'noble' | 'discard' | 'start';
    colors?: TokenColor[];       // tokens taken / discarded
    card?: Card;                 // card bought / publicly reserved
    reservedBlind?: boolean;     // reserved face-down from a deck
    reservedLevel?: number;
    noble?: Noble;
    gotGold?: boolean;
}

export interface GameStateData {
    status: GameStatus;
    actionPhase: ActionPhase;
    playerIds: string[];
    firstPlayerId: string;
    currentPlayerId: string;
    supply: Record<TokenColor, number>;
    decks: { 1: Card[]; 2: Card[]; 3: Card[]; };
    board: { 1: (Card | null)[]; 2: (Card | null)[]; 3: (Card | null)[]; }; // 4 slots each
    nobles: Noble[];                 // available (uncaptured) nobles
    players: Record<string, PlayerState>;
    endTriggered: boolean;
    winnerIds: string[] | null;
    lastMove: LastMove | null;
    pendingNobleIds: string[];       // candidate nobles when tied (choose one)
    moveCounter: number;
}

// ==========================================
// Datasets (90 development cards, 10 nobles)
// ==========================================
const CARDS_DB: Card[] = [
    // Level 1 (C01–C40)
    { id: 'C01', level: 1, bonus: 'black', pts: 0, cost: { green: 2, red: 1 } },
    { id: 'C02', level: 1, bonus: 'black', pts: 0, cost: { green: 3 } },
    { id: 'C03', level: 1, bonus: 'black', pts: 0, cost: { white: 1, blue: 1, green: 1, red: 1 } },
    { id: 'C04', level: 1, bonus: 'black', pts: 0, cost: { white: 2, green: 2 } },
    { id: 'C05', level: 1, bonus: 'black', pts: 1, cost: { blue: 4 } },
    { id: 'C06', level: 1, bonus: 'black', pts: 0, cost: { white: 1, blue: 2, green: 1, red: 1 } },
    { id: 'C07', level: 1, bonus: 'black', pts: 0, cost: { white: 2, blue: 2, red: 1 } },
    { id: 'C08', level: 1, bonus: 'black', pts: 0, cost: { green: 1, red: 3, black: 1 } },
    { id: 'C09', level: 1, bonus: 'blue', pts: 0, cost: { white: 1, black: 2 } },
    { id: 'C10', level: 1, bonus: 'blue', pts: 0, cost: { black: 3 } },
    { id: 'C11', level: 1, bonus: 'blue', pts: 0, cost: { white: 1, green: 1, red: 1, black: 1 } },
    { id: 'C12', level: 1, bonus: 'blue', pts: 0, cost: { green: 2, black: 2 } },
    { id: 'C13', level: 1, bonus: 'blue', pts: 1, cost: { red: 4 } },
    { id: 'C14', level: 1, bonus: 'blue', pts: 0, cost: { white: 1, green: 1, red: 2, black: 1 } },
    { id: 'C15', level: 1, bonus: 'blue', pts: 0, cost: { white: 1, green: 2, red: 2 } },
    { id: 'C16', level: 1, bonus: 'blue', pts: 0, cost: { blue: 1, green: 3, red: 1 } },
    { id: 'C17', level: 1, bonus: 'green', pts: 0, cost: { white: 2, blue: 1 } },
    { id: 'C18', level: 1, bonus: 'green', pts: 0, cost: { red: 3 } },
    { id: 'C19', level: 1, bonus: 'green', pts: 0, cost: { white: 1, blue: 1, red: 1, black: 1 } },
    { id: 'C20', level: 1, bonus: 'green', pts: 0, cost: { blue: 2, red: 2 } },
    { id: 'C21', level: 1, bonus: 'green', pts: 1, cost: { black: 4 } },
    { id: 'C22', level: 1, bonus: 'green', pts: 0, cost: { white: 1, blue: 1, red: 1, black: 2 } },
    { id: 'C23', level: 1, bonus: 'green', pts: 0, cost: { blue: 1, red: 2, black: 2 } },
    { id: 'C24', level: 1, bonus: 'green', pts: 0, cost: { white: 1, blue: 3, green: 1 } },
    { id: 'C25', level: 1, bonus: 'red', pts: 0, cost: { blue: 2, green: 1 } },
    { id: 'C26', level: 1, bonus: 'red', pts: 0, cost: { white: 3 } },
    { id: 'C27', level: 1, bonus: 'red', pts: 0, cost: { white: 1, blue: 1, green: 1, black: 1 } },
    { id: 'C28', level: 1, bonus: 'red', pts: 0, cost: { white: 2, red: 2 } },
    { id: 'C29', level: 1, bonus: 'red', pts: 1, cost: { white: 4 } },
    { id: 'C30', level: 1, bonus: 'red', pts: 0, cost: { white: 2, blue: 1, green: 1, black: 1 } },
    { id: 'C31', level: 1, bonus: 'red', pts: 0, cost: { white: 2, green: 1, black: 2 } },
    { id: 'C32', level: 1, bonus: 'red', pts: 0, cost: { white: 1, red: 1, black: 3 } },
    { id: 'C33', level: 1, bonus: 'white', pts: 0, cost: { blue: 3 } },
    { id: 'C34', level: 1, bonus: 'white', pts: 0, cost: { red: 2, black: 1 } },
    { id: 'C35', level: 1, bonus: 'white', pts: 0, cost: { blue: 1, green: 1, red: 1, black: 1 } },
    { id: 'C36', level: 1, bonus: 'white', pts: 0, cost: { blue: 2, black: 2 } },
    { id: 'C37', level: 1, bonus: 'white', pts: 1, cost: { green: 4 } },
    { id: 'C38', level: 1, bonus: 'white', pts: 0, cost: { blue: 1, green: 2, red: 1, black: 1 } },
    { id: 'C39', level: 1, bonus: 'white', pts: 0, cost: { blue: 2, green: 2, black: 1 } },
    { id: 'C40', level: 1, bonus: 'white', pts: 0, cost: { white: 3, blue: 1, black: 1 } },
    // Level 2 (C41–C70)
    { id: 'C41', level: 2, bonus: 'black', pts: 2, cost: { white: 5 } },
    { id: 'C42', level: 2, bonus: 'black', pts: 3, cost: { black: 6 } },
    { id: 'C43', level: 2, bonus: 'black', pts: 1, cost: { white: 3, blue: 2, green: 2 } },
    { id: 'C44', level: 2, bonus: 'black', pts: 2, cost: { blue: 1, green: 4, red: 2 } },
    { id: 'C45', level: 2, bonus: 'black', pts: 1, cost: { white: 3, green: 3, black: 2 } },
    { id: 'C46', level: 2, bonus: 'black', pts: 2, cost: { green: 5, red: 3 } },
    { id: 'C47', level: 2, bonus: 'blue', pts: 2, cost: { blue: 5 } },
    { id: 'C48', level: 2, bonus: 'blue', pts: 3, cost: { blue: 6 } },
    { id: 'C49', level: 2, bonus: 'blue', pts: 1, cost: { blue: 2, green: 2, red: 3 } },
    { id: 'C50', level: 2, bonus: 'blue', pts: 2, cost: { white: 2, red: 1, black: 4 } },
    { id: 'C51', level: 2, bonus: 'blue', pts: 1, cost: { blue: 2, green: 3, black: 3 } },
    { id: 'C52', level: 2, bonus: 'blue', pts: 2, cost: { white: 5, blue: 3 } },
    { id: 'C53', level: 2, bonus: 'green', pts: 2, cost: { green: 5 } },
    { id: 'C54', level: 2, bonus: 'green', pts: 3, cost: { green: 6 } },
    { id: 'C55', level: 2, bonus: 'green', pts: 1, cost: { white: 2, blue: 3, black: 2 } },
    { id: 'C56', level: 2, bonus: 'green', pts: 2, cost: { white: 4, blue: 2, black: 1 } },
    { id: 'C57', level: 2, bonus: 'green', pts: 1, cost: { white: 3, green: 2, red: 3 } },
    { id: 'C58', level: 2, bonus: 'green', pts: 2, cost: { blue: 5, green: 3 } },
    { id: 'C59', level: 2, bonus: 'red', pts: 2, cost: { black: 5 } },
    { id: 'C60', level: 2, bonus: 'red', pts: 3, cost: { red: 6 } },
    { id: 'C61', level: 2, bonus: 'red', pts: 1, cost: { white: 2, red: 2, black: 3 } },
    { id: 'C62', level: 2, bonus: 'red', pts: 2, cost: { white: 1, blue: 4, green: 2 } },
    { id: 'C63', level: 2, bonus: 'red', pts: 1, cost: { blue: 3, red: 2, black: 3 } },
    { id: 'C64', level: 2, bonus: 'red', pts: 2, cost: { white: 3, black: 5 } },
    { id: 'C65', level: 2, bonus: 'white', pts: 2, cost: { red: 5 } },
    { id: 'C66', level: 2, bonus: 'white', pts: 3, cost: { white: 6 } },
    { id: 'C67', level: 2, bonus: 'white', pts: 1, cost: { green: 3, red: 2, black: 2 } },
    { id: 'C68', level: 2, bonus: 'white', pts: 2, cost: { green: 1, red: 4, black: 2 } },
    { id: 'C69', level: 2, bonus: 'white', pts: 1, cost: { white: 2, blue: 3, red: 3 } },
    { id: 'C70', level: 2, bonus: 'white', pts: 2, cost: { red: 5, black: 3 } },
    // Level 3 (C71–C90)
    { id: 'C71', level: 3, bonus: 'black', pts: 4, cost: { red: 7 } },
    { id: 'C72', level: 3, bonus: 'black', pts: 5, cost: { red: 7, black: 3 } },
    { id: 'C73', level: 3, bonus: 'black', pts: 4, cost: { green: 3, red: 6, black: 3 } },
    { id: 'C74', level: 3, bonus: 'black', pts: 3, cost: { white: 3, blue: 3, green: 5, red: 3 } },
    { id: 'C75', level: 3, bonus: 'blue', pts: 4, cost: { white: 7 } },
    { id: 'C76', level: 3, bonus: 'blue', pts: 5, cost: { white: 7, blue: 3 } },
    { id: 'C77', level: 3, bonus: 'blue', pts: 4, cost: { white: 6, blue: 3, black: 3 } },
    { id: 'C78', level: 3, bonus: 'blue', pts: 3, cost: { white: 3, green: 3, red: 3, black: 5 } },
    { id: 'C79', level: 3, bonus: 'green', pts: 4, cost: { blue: 7 } },
    { id: 'C80', level: 3, bonus: 'green', pts: 5, cost: { blue: 7, green: 3 } },
    { id: 'C81', level: 3, bonus: 'green', pts: 4, cost: { white: 3, blue: 6, green: 3 } },
    { id: 'C82', level: 3, bonus: 'green', pts: 3, cost: { white: 5, blue: 3, red: 3, black: 3 } },
    { id: 'C83', level: 3, bonus: 'red', pts: 4, cost: { green: 7 } },
    { id: 'C84', level: 3, bonus: 'red', pts: 5, cost: { green: 7, red: 3 } },
    { id: 'C85', level: 3, bonus: 'red', pts: 4, cost: { blue: 3, green: 6, red: 3 } },
    { id: 'C86', level: 3, bonus: 'red', pts: 3, cost: { white: 3, blue: 5, green: 3, black: 3 } },
    { id: 'C87', level: 3, bonus: 'white', pts: 4, cost: { black: 7 } },
    { id: 'C88', level: 3, bonus: 'white', pts: 5, cost: { white: 3, black: 7 } },
    { id: 'C89', level: 3, bonus: 'white', pts: 4, cost: { white: 3, red: 3, black: 6 } },
    { id: 'C90', level: 3, bonus: 'white', pts: 3, cost: { blue: 3, green: 3, red: 5, black: 3 } }
];

const NOBLES_DB: Noble[] = [
    { id: 'N01', pts: 3, req: { white: 3, blue: 3, black: 3 } },
    { id: 'N02', pts: 3, req: { blue: 3, green: 3, red: 3 } },
    { id: 'N03', pts: 3, req: { white: 3, red: 3, black: 3 } },
    { id: 'N04', pts: 3, req: { green: 4, red: 4 } },
    { id: 'N05', pts: 3, req: { blue: 4, green: 4 } },
    { id: 'N06', pts: 3, req: { red: 4, black: 4 } },
    { id: 'N07', pts: 3, req: { white: 4, black: 4 } },
    { id: 'N08', pts: 3, req: { white: 3, blue: 3, green: 3 } },
    { id: 'N09', pts: 3, req: { green: 3, red: 3, black: 3 } },
    { id: 'N10', pts: 3, req: { white: 4, blue: 4 } }
];

export const WIN_PRESTIGE = 15;
export const TOKEN_LIMIT = 10;

export function getAllCards(): Card[] { return CARDS_DB.map(c => ({ ...c, cost: { ...c.cost } })); }
export function getAllNobles(): Noble[] { return NOBLES_DB.map(n => ({ ...n, req: { ...n.req } })); }

function shuffle<T>(array: T[]): T[] {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function emptyTokens(): Record<TokenColor, number> {
    return { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 };
}

// Supply of gems per colour by player count (gold is always 5).
function gemsPerColor(playerCount: number): number {
    if (playerCount <= 2) return 4;
    if (playerCount === 3) return 5;
    return 7;
}

export class SplendorGameState {
    private data: GameStateData;
    private readonly playerIds: string[];

    constructor(playerIds: string[]) {
        this.playerIds = [...playerIds];
        this.data = {
            status: GameStatus.Lobby,
            actionPhase: 'Normal',
            playerIds: [...playerIds],
            firstPlayerId: playerIds[0] || '',
            currentPlayerId: '',
            supply: emptyTokens(),
            decks: { 1: [], 2: [], 3: [] },
            board: { 1: [], 2: [], 3: [] },
            nobles: [],
            players: {},
            endTriggered: false,
            winnerIds: null,
            lastMove: null,
            pendingNobleIds: [],
            moveCounter: 0
        };
    }

    public static from_data(data: GameStateData, playerIds: string[]): SplendorGameState {
        const state = new SplendorGameState(playerIds);
        state.data = JSON.parse(JSON.stringify(data));
        return state;
    }

    public get_data(): GameStateData {
        return JSON.parse(JSON.stringify(this.data));
    }

    public start_game(firstPlayer?: string) {
        const n = this.playerIds.length;
        if (n < 2 || n > 4) {
            throw new Error('Splendor requires 2 to 4 players');
        }

        this.data.status = GameStatus.Active;
        this.data.actionPhase = 'Normal';
        this.data.firstPlayerId = firstPlayer && this.playerIds.includes(firstPlayer)
            ? firstPlayer
            : this.playerIds[Math.floor(Math.random() * n)];
        this.data.currentPlayerId = this.data.firstPlayerId;
        this.data.endTriggered = false;
        this.data.winnerIds = null;
        this.data.pendingNobleIds = [];

        // Player states
        this.data.players = {};
        for (const pid of this.playerIds) {
            this.data.players[pid] = { tokens: emptyTokens(), cards: [], reserved: [], nobles: [] };
        }

        // Token supply
        const perColor = gemsPerColor(n);
        const supply = emptyTokens();
        for (const c of GEM_COLORS) supply[c] = perColor;
        supply.gold = 5;
        this.data.supply = supply;

        // Decks (shuffled per level)
        this.data.decks = {
            1: shuffle(CARDS_DB.filter(c => c.level === 1)).map(c => ({ ...c, cost: { ...c.cost } })),
            2: shuffle(CARDS_DB.filter(c => c.level === 2)).map(c => ({ ...c, cost: { ...c.cost } })),
            3: shuffle(CARDS_DB.filter(c => c.level === 3)).map(c => ({ ...c, cost: { ...c.cost } }))
        };

        // Board: 4 face-up per level
        this.data.board = { 1: [], 2: [], 3: [] };
        for (const lvl of [1, 2, 3] as const) {
            for (let i = 0; i < 4; i++) {
                this.data.board[lvl].push(this.data.decks[lvl].pop() || null);
            }
        }

        // Nobles: players + 1 revealed
        const nobleCount = n + 1;
        this.data.nobles = shuffle(NOBLES_DB).slice(0, nobleCount).map(nb => ({ ...nb, req: { ...nb.req } }));

        this.data.lastMove = {
            playerId: this.data.currentPlayerId,
            desc: 'started the game',
            moveId: ++this.data.moveCounter,
            kind: 'start'
        };
    }

    // ==========================================
    // Primary actions
    // ==========================================

    // Action A: take 3 gems of different colours (or fewer if not enough distinct colours).
    public take3(playerId: string, colors: GemColor[]) {
        this.validate_active_player(playerId);
        this.validate_action_phase('Normal');

        if (!colors || colors.length < 1 || colors.length > 3) {
            throw new Error('Take between 1 and 3 gems of different colours');
        }
        const seen = new Set<GemColor>();
        for (const c of colors) {
            if (!GEM_COLORS.includes(c)) throw new Error(`Invalid gem colour: ${c}`);
            if (seen.has(c)) throw new Error('Take-3 gems must all be different colours');
            seen.add(c);
            if ((this.data.supply[c] || 0) <= 0) throw new Error(`No ${gemName(c)} tokens left in the supply`);
        }

        const pState = this.data.players[playerId];
        for (const c of colors) {
            this.data.supply[c]--;
            pState.tokens[c]++;
        }

        this.log(playerId, `took ${colors.map(gemName).join(', ')}`, {
            kind: 'take',
            colors: [...colors]
        });
        this.run_post_action(playerId);
    }

    // Action B: take 2 gems of the same colour (supply of that colour must be >= 4 first).
    public take2(playerId: string, color: GemColor) {
        this.validate_active_player(playerId);
        this.validate_action_phase('Normal');

        if (!GEM_COLORS.includes(color)) throw new Error(`Invalid gem colour: ${color}`);
        if ((this.data.supply[color] || 0) < 4) {
            throw new Error(`You may only take 2 ${gemName(color)} when at least 4 remain in the supply`);
        }

        const pState = this.data.players[playerId];
        this.data.supply[color] -= 2;
        pState.tokens[color] += 2;

        this.log(playerId, `took 2 ${gemName(color)}`, { kind: 'take', colors: [color, color] });
        this.run_post_action(playerId);
    }

    // Action C: reserve 1 card (from board or blind from a deck) + take 1 gold if available.
    public reserve(playerId: string, source: 'board' | 'deck', cardId: string | null, level: number | null) {
        this.validate_active_player(playerId);
        this.validate_action_phase('Normal');

        const pState = this.data.players[playerId];
        if (pState.reserved.length >= 3) {
            throw new Error('You cannot reserve more than 3 cards');
        }

        let reserved: Card;
        let blind = false;
        let lvl: number;

        if (source === 'board') {
            if (!cardId) throw new Error('Must specify a board card to reserve');
            const loc = this.find_board_card(cardId);
            if (!loc) throw new Error(`Card ${cardId} is not available on the board`);
            reserved = this.data.board[loc.level][loc.index]!;
            lvl = loc.level;
            this.refill_slot(loc.level, loc.index);
        } else {
            if (level !== 1 && level !== 2 && level !== 3) throw new Error('Invalid deck level');
            const card = this.data.decks[level as 1 | 2 | 3].pop();
            if (!card) throw new Error(`Deck level ${level} is empty`);
            reserved = card;
            lvl = level;
            blind = true;
        }

        pState.reserved.push(reserved);

        // Take 1 gold if any remains
        let gotGold = false;
        if (this.data.supply.gold > 0) {
            this.data.supply.gold--;
            pState.tokens.gold++;
            gotGold = true;
        }

        this.log(playerId, `reserved a ${blind ? 'face-down' : ''} level ${lvl} card${gotGold ? ' and took 1 Gold' : ''}`.replace('  ', ' '), {
            kind: 'reserve',
            card: blind ? undefined : { ...reserved, cost: { ...reserved.cost } },
            reservedBlind: blind,
            reservedLevel: lvl,
            gotGold
        });
        this.run_post_action(playerId);
    }

    // Action D: purchase 1 card (from board or own reserve). Gold covers any shortfall.
    public buy(playerId: string, source: 'board' | 'reserve', cardId: string) {
        this.validate_active_player(playerId);
        this.validate_action_phase('Normal');

        const pState = this.data.players[playerId];

        let card: Card | null = null;
        let fromBoard: { level: 1 | 2 | 3; index: number } | null = null;
        let reserveIndex = -1;

        if (source === 'board') {
            const loc = this.find_board_card(cardId);
            if (!loc) throw new Error(`Card ${cardId} is not available on the board`);
            card = this.data.board[loc.level][loc.index]!;
            fromBoard = loc;
        } else {
            reserveIndex = pState.reserved.findIndex(c => c.id === cardId);
            if (reserveIndex === -1) throw new Error(`Card ${cardId} is not in your reserve`);
            card = pState.reserved[reserveIndex];
        }

        const plan = this.payment_plan(playerId, card);
        if (!plan) throw new Error('You cannot afford this card');

        // Spend tokens back to the supply
        for (const c of TOKEN_COLORS) {
            const amt = plan[c] || 0;
            if (amt > 0) {
                pState.tokens[c] -= amt;
                this.data.supply[c] += amt;
            }
        }

        // Remove from source
        if (fromBoard) {
            this.refill_slot(fromBoard.level, fromBoard.index);
        } else {
            pState.reserved.splice(reserveIndex, 1);
        }

        pState.cards.push({ ...card, cost: { ...card.cost } });

        this.log(playerId, `purchased a level ${card.level} ${gemName(card.bonus)} card`, {
            kind: 'buy',
            card: { ...card, cost: { ...card.cost } }
        });
        this.run_post_action(playerId);
    }

    // Interactive: choose one noble when qualifying for several at once.
    public select_noble(playerId: string, nobleId: string) {
        this.validate_active_player(playerId);
        if (this.data.status !== GameStatus.PendingNoble || this.data.actionPhase !== 'SelectNoble') {
            throw new Error('Not in the noble-selection phase');
        }
        if (!this.data.pendingNobleIds.includes(nobleId)) {
            throw new Error(`Noble ${nobleId} is not one of the tied candidates`);
        }
        this.award_noble(playerId, nobleId);
        this.data.pendingNobleIds = [];
        this.data.status = GameStatus.Active;
        this.data.actionPhase = 'Normal';
        this.after_nobles(playerId);
    }

    // Interactive: discard down to the 10-token limit.
    public discard_tokens(playerId: string, colors: TokenColor[]) {
        this.validate_active_player(playerId);
        if (this.data.status !== GameStatus.PendingDiscard || this.data.actionPhase !== 'Discard') {
            throw new Error('Not in the discard phase');
        }

        const pState = this.data.players[playerId];
        const excess = this.count_tokens(playerId) - TOKEN_LIMIT;
        if (colors.length !== excess) {
            throw new Error(`You must discard exactly ${excess} token(s)`);
        }

        const temp = { ...pState.tokens };
        for (const c of colors) {
            if ((temp[c] || 0) <= 0) throw new Error(`You do not have a ${gemName(c)} token to discard`);
            temp[c]--;
        }
        for (const c of colors) {
            pState.tokens[c]--;
            this.data.supply[c]++;
        }

        this.log(playerId, `discarded ${colors.map(gemName).join(', ')}`, { kind: 'discard', colors: [...colors] });

        this.data.status = GameStatus.Active;
        this.data.actionPhase = 'Normal';
        this.end_turn(playerId);
    }

    // ==========================================
    // Automatic end-of-turn steps: nobles -> discard -> win/advance
    // ==========================================
    private run_post_action(playerId: string) {
        this.resolve_nobles(playerId);
    }

    private resolve_nobles(playerId: string) {
        const qualifying = this.qualifying_nobles(playerId);
        if (qualifying.length === 0) {
            this.after_nobles(playerId);
        } else if (qualifying.length === 1) {
            this.award_noble(playerId, qualifying[0].id);
            this.after_nobles(playerId);
        } else {
            // Tie: player chooses exactly one.
            this.data.status = GameStatus.PendingNoble;
            this.data.actionPhase = 'SelectNoble';
            this.data.pendingNobleIds = qualifying.map(n => n.id);
        }
    }

    private after_nobles(playerId: string) {
        if (this.count_tokens(playerId) > TOKEN_LIMIT) {
            this.data.status = GameStatus.PendingDiscard;
            this.data.actionPhase = 'Discard';
        } else {
            this.end_turn(playerId);
        }
    }

    private award_noble(playerId: string, nobleId: string) {
        const idx = this.data.nobles.findIndex(n => n.id === nobleId);
        if (idx === -1) return;
        const noble = this.data.nobles[idx];
        this.data.nobles.splice(idx, 1);
        this.data.players[playerId].nobles.push(noble);
        this.log(playerId, `was visited by a Noble (+${noble.pts} prestige)`, { kind: 'noble', noble: { ...noble, req: { ...noble.req } } });
    }

    private end_turn(playerId: string) {
        // End-game trigger: any player ending their turn with >= 15 VP.
        if (!this.data.endTriggered && this.vp(playerId) >= WIN_PRESTIGE) {
            this.data.endTriggered = true;
        }

        const order = this.playerIds; // seat order; firstPlayer boundary tracked separately
        const idx = order.indexOf(playerId);
        const nextIdx = (idx + 1) % order.length;
        const nextPlayer = order[nextIdx];

        // The final turn belongs to the player seated immediately before the first player.
        const lastPlayerIndex = (order.indexOf(this.data.firstPlayerId) + order.length - 1) % order.length;
        const finishedRound = idx === lastPlayerIndex;

        if (this.data.endTriggered && finishedRound) {
            this.finish_game();
            return;
        }

        this.data.currentPlayerId = nextPlayer;
        this.data.status = GameStatus.Active;
        this.data.actionPhase = 'Normal';
    }

    private finish_game() {
        // Highest VP; tiebreak = fewest development cards purchased; else shared victory.
        let best: string[] = [];
        let bestVp = -1;
        let bestCards = Infinity;
        for (const pid of this.playerIds) {
            const vp = this.vp(pid);
            const cardsBought = this.data.players[pid].cards.length;
            if (vp > bestVp || (vp === bestVp && cardsBought < bestCards)) {
                best = [pid];
                bestVp = vp;
                bestCards = cardsBought;
            } else if (vp === bestVp && cardsBought === bestCards) {
                best.push(pid);
            }
        }
        this.data.winnerIds = best;
        this.data.status = GameStatus.GameOver;
        this.data.actionPhase = 'Normal';
        this.data.currentPlayerId = '';
    }

    // ==========================================
    // Derived computations (pure)
    // ==========================================
    public bonuses(playerId: string): Record<GemColor, number> {
        const b: Record<GemColor, number> = { white: 0, blue: 0, green: 0, red: 0, black: 0 };
        const pState = this.data.players[playerId];
        if (!pState) return b;
        for (const card of pState.cards) b[card.bonus]++;
        return b;
    }

    public vp(playerId: string): number {
        const pState = this.data.players[playerId];
        if (!pState) return 0;
        let pts = 0;
        for (const card of pState.cards) pts += card.pts;
        for (const noble of pState.nobles) pts += noble.pts;
        return pts;
    }

    public count_tokens(playerId: string): number {
        const pState = this.data.players[playerId];
        if (!pState) return 0;
        let sum = 0;
        for (const c of TOKEN_COLORS) sum += pState.tokens[c] || 0;
        return sum;
    }

    // Cheapest valid payment plan (matching gems first, gold for the shortfall) or null.
    public payment_plan(playerId: string, card: Card): Record<TokenColor, number> | null {
        const pState = this.data.players[playerId];
        const bonuses = this.bonuses(playerId);
        const plan = emptyTokens();
        let goldNeeded = 0;

        for (const c of GEM_COLORS) {
            const cost = card.cost[c] || 0;
            const effective = Math.max(0, cost - (bonuses[c] || 0));
            if (effective <= 0) continue;
            const owned = pState.tokens[c] || 0;
            if (owned >= effective) {
                plan[c] = effective;
            } else {
                plan[c] = owned;
                goldNeeded += effective - owned;
            }
        }
        if (goldNeeded > (pState.tokens.gold || 0)) return null;
        plan.gold = goldNeeded;
        return plan;
    }

    public can_afford(playerId: string, card: Card): boolean {
        return this.payment_plan(playerId, card) !== null;
    }

    public qualifies_for_noble(playerId: string, noble: Noble): boolean {
        const b = this.bonuses(playerId);
        for (const c of GEM_COLORS) {
            if ((b[c] || 0) < (noble.req[c] || 0)) return false;
        }
        return true;
    }

    public qualifying_nobles(playerId: string): Noble[] {
        return this.data.nobles.filter(n => this.qualifies_for_noble(playerId, n));
    }

    // ==========================================
    // Helpers
    // ==========================================
    private find_board_card(cardId: string): { level: 1 | 2 | 3; index: number } | null {
        for (const lvl of [1, 2, 3] as const) {
            const idx = this.data.board[lvl].findIndex(c => c?.id === cardId);
            if (idx !== -1) return { level: lvl, index: idx };
        }
        return null;
    }

    private refill_slot(level: 1 | 2 | 3, index: number) {
        this.data.board[level][index] = this.data.decks[level].pop() || null;
    }

    private validate_active_player(playerId: string) {
        if (this.data.status === GameStatus.GameOver) throw new Error('The game is over');
        if (this.data.currentPlayerId !== playerId) throw new Error(`It is not ${playerId}'s turn`);
    }

    private validate_action_phase(phase: ActionPhase) {
        if (this.data.status !== GameStatus.Active || this.data.actionPhase !== phase) {
            throw new Error(`Illegal action in the ${this.data.actionPhase} phase`);
        }
    }

    private log(playerId: string, desc: string, extra: Partial<LastMove>) {
        this.data.lastMove = {
            playerId,
            desc,
            moveId: ++this.data.moveCounter,
            kind: 'take',
            ...extra
        } as LastMove;
    }
}
