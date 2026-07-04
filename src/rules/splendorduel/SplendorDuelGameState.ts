/**
 * SplendorDuelGameState.ts - Standalone game engine for Splendor Duel
 */

export type TokenColor = 'blue' | 'white' | 'green' | 'black' | 'red' | 'pearl' | 'gold';

// Human-friendly gem names for logs / notifications (never expose raw colours to players).
export function gemName(color: TokenColor | 'wild'): string {
    switch (color) {
        case 'blue': return 'Sapphire';
        case 'white': return 'Diamond';
        case 'green': return 'Emerald';
        case 'black': return 'Onyx';
        case 'red': return 'Ruby';
        case 'pearl': return 'Pearl';
        case 'gold': return 'Gold';
        case 'wild': return 'Joker';
        default: return String(color);
    }
}

export interface Card {
    id: string;
    level: 1 | 2 | 3;
    color: TokenColor | 'wild' | null; // null for points-only cards
    points: number;
    crowns: number;
    bonus_color: TokenColor | 'wild' | null;
    bonus_count: number;
    ability: 'extra_turn' | 'take_matching' | 'steal' | 'take_privilege' | null;
    cost: Partial<Record<TokenColor, number>>;
    assigned_color?: TokenColor | null; // set on purchase for jokers
}

export interface RoyalCard {
    id: string;
    points: number;
    ability: 'extra_turn' | 'steal' | 'take_privilege' | null;
}

export enum GameStatus {
    Lobby = 'Lobby',
    Active = 'Active',
    PendingAbility = 'PendingAbility', // waiting for a player to resolve a card ability
    PendingRoyal = 'PendingRoyal',     // waiting for a player to choose a Royal card
    PendingDiscard = 'PendingDiscard', // waiting for a player to discard down to 10 tokens
    GameOver = 'GameOver'
}

export type ActionPhase =
    | 'Normal'
    | 'SelectMatchingToken' // take matching token ability
    | 'StealToken'          // steal ability
    | 'SelectRoyal'         // claim a Royal card
    | 'Discard';            // discard down to 10

export interface PlayerState {
    tokens: Record<TokenColor, number>;
    cards: Card[];
    royals: RoyalCard[];
    reserved: Card[];
    privileges: number;
    crossed3rd: boolean;
    crossed6th: boolean;
}

export interface GameStateData {
    status: GameStatus;
    actionPhase: ActionPhase;
    playerIds: string[];
    currentPlayerId: string;
    board: (TokenColor | null)[][]; // 5x5 grid
    bag: TokenColor[];
    decks: {
        1: Card[];
        2: Card[];
        3: Card[];
    };
    pyramid: {
        1: (Card | null)[]; // 5 slots
        2: (Card | null)[]; // 4 slots
        3: (Card | null)[]; // 3 slots
    };
    royalsPool: RoyalCard[];
    privilegesAboveBoard: number;
    players: Record<string, PlayerState>;
    winnerId: string | null;
    extraTurnPending: boolean;
    lastMove: {
        playerId: string;
        desc: string;
        moveId: number;
        card?: Card;                 // the card involved (e.g. purchased) for rich rendering
        assignedColor?: TokenColor;  // joker's assigned colour, if any
        reservedCard?: Card;         // a publicly-reserved pyramid card (safe to reveal)
        reservedLevel?: number;      // the level of a reserved card (both pyramid and blind)
        reservedBlind?: boolean;     // true when reserved face-down from a deck (hidden card)
    } | null;
    pendingAbilityInfo: {
        ability: 'take_matching' | 'steal';
        cardId: string;
        targetColor?: TokenColor; // for take_matching, the color they must take
    } | null;
    pendingRoyalCount: number; // number of Royal cards they must select
    moveCounter: number;
}

// 5x5 Clockwise Spiral Coordinates starting from center (2,2)
export const SPIRAL_COORDINATES: [number, number][] = [
    [2, 2], [2, 3], [3, 3], [3, 2], [3, 1], [2, 1], [1, 1], [1, 2], [1, 3], [1, 4],
    [2, 4], [3, 4], [4, 4], [4, 3], [4, 2], [4, 1], [4, 0], [3, 0], [2, 0], [1, 0],
    [0, 0], [0, 1], [0, 2], [0, 3], [0, 4]
];

// Jewel cards database
const JEWEL_CARDS_DB: Card[] = [
    { id: "L1-BLA-T1", level: 1, color: "black", points: 0, crowns: 0, bonus_color: "black", bonus_count: 1, ability: null, cost: { red: 1, green: 1, blue: 1, white: 1 } },
    { id: "L1-RED-T1", level: 1, color: "red", points: 0, crowns: 0, bonus_color: "red", bonus_count: 1, ability: null, cost: { green: 1, blue: 1, white: 1, black: 1 } },
    { id: "L1-GRE-T1", level: 1, color: "green", points: 0, crowns: 0, bonus_color: "green", bonus_count: 1, ability: null, cost: { blue: 1, white: 1, black: 1, red: 1 } },
    { id: "L1-BLU-T1", level: 1, color: "blue", points: 0, crowns: 0, bonus_color: "blue", bonus_count: 1, ability: null, cost: { white: 1, black: 1, red: 1, green: 1 } },
    { id: "L1-WHI-T1", level: 1, color: "white", points: 0, crowns: 0, bonus_color: "white", bonus_count: 1, ability: null, cost: { black: 1, red: 1, green: 1, blue: 1 } },

    { id: "L1-BLA-T2", level: 1, color: "black", points: 0, crowns: 0, bonus_color: "black", bonus_count: 1, ability: "extra_turn", cost: { pearl: 1, blue: 2, white: 2 } },
    { id: "L1-RED-T2", level: 1, color: "red", points: 0, crowns: 0, bonus_color: "red", bonus_count: 1, ability: "extra_turn", cost: { pearl: 1, white: 2, black: 2 } },
    { id: "L1-GRE-T2", level: 1, color: "green", points: 0, crowns: 0, bonus_color: "green", bonus_count: 1, ability: "extra_turn", cost: { pearl: 1, black: 2, red: 2 } },
    { id: "L1-BLU-T2", level: 1, color: "blue", points: 0, crowns: 0, bonus_color: "blue", bonus_count: 1, ability: "extra_turn", cost: { pearl: 1, red: 2, green: 2 } },
    { id: "L1-WHI-T2", level: 1, color: "white", points: 0, crowns: 0, bonus_color: "white", bonus_count: 1, ability: "extra_turn", cost: { pearl: 1, green: 2, blue: 2 } },

    { id: "L1-BLA-T3", level: 1, color: "black", points: 0, crowns: 0, bonus_color: "black", bonus_count: 1, ability: "take_matching", cost: { red: 2, green: 2 } },
    { id: "L1-RED-T3", level: 1, color: "red", points: 0, crowns: 0, bonus_color: "red", bonus_count: 1, ability: "take_matching", cost: { green: 2, blue: 2 } },
    { id: "L1-GRE-T3", level: 1, color: "green", points: 0, crowns: 0, bonus_color: "green", bonus_count: 1, ability: "take_matching", cost: { blue: 2, white: 2 } },
    { id: "L1-BLU-T3", level: 1, color: "blue", points: 0, crowns: 0, bonus_color: "blue", bonus_count: 1, ability: "take_matching", cost: { white: 2, black: 2 } },
    { id: "L1-WHI-T3", level: 1, color: "white", points: 0, crowns: 0, bonus_color: "white", bonus_count: 1, ability: "take_matching", cost: { black: 2, red: 2 } },

    { id: "L1-BLA-T4", level: 1, color: "black", points: 1, crowns: 0, bonus_color: "black", bonus_count: 1, ability: null, cost: { green: 3, blue: 2 } },
    { id: "L1-RED-T4", level: 1, color: "red", points: 1, crowns: 0, bonus_color: "red", bonus_count: 1, ability: null, cost: { blue: 3, white: 2 } },
    { id: "L1-GRE-T4", level: 1, color: "green", points: 1, crowns: 0, bonus_color: "green", bonus_count: 1, ability: null, cost: { white: 3, black: 2 } },
    { id: "L1-BLU-T4", level: 1, color: "blue", points: 1, crowns: 0, bonus_color: "blue", bonus_count: 1, ability: null, cost: { black: 3, red: 2 } },
    { id: "L1-WHI-T4", level: 1, color: "white", points: 1, crowns: 0, bonus_color: "white", bonus_count: 1, ability: null, cost: { red: 3, green: 2 } },

    { id: "L1-BLA-T5", level: 1, color: "black", points: 0, crowns: 1, bonus_color: "black", bonus_count: 1, ability: null, cost: { white: 3 } },
    { id: "L1-RED-T5", level: 1, color: "red", points: 0, crowns: 1, bonus_color: "red", bonus_count: 1, ability: null, cost: { black: 3 } },
    { id: "L1-GRE-T5", level: 1, color: "green", points: 0, crowns: 1, bonus_color: "green", bonus_count: 1, ability: null, cost: { red: 3 } },
    { id: "L1-BLU-T5", level: 1, color: "blue", points: 0, crowns: 1, bonus_color: "blue", bonus_count: 1, ability: null, cost: { green: 3 } },
    { id: "L1-WHI-T5", level: 1, color: "white", points: 0, crowns: 1, bonus_color: "white", bonus_count: 1, ability: null, cost: { blue: 3 } },

    { id: "L1-POINTS-1", level: 1, color: null, points: 3, crowns: 0, bonus_color: null, bonus_count: 0, ability: null, cost: { pearl: 1, red: 4 } },
    { id: "L1-JOKER-2", level: 1, color: "wild", points: 1, crowns: 0, bonus_color: "wild", bonus_count: 1, ability: null, cost: { pearl: 1, black: 4 } },
    { id: "L1-JOKER-3", level: 1, color: "wild", points: 0, crowns: 1, bonus_color: "wild", bonus_count: 1, ability: null, cost: { pearl: 1, white: 4 } },
    { id: "L1-JOKER-4", level: 1, color: "wild", points: 1, crowns: 0, bonus_color: "wild", bonus_count: 1, ability: null, cost: { pearl: 1, black: 1, green: 2, white: 2 } },
    { id: "L1-JOKER-5", level: 1, color: "wild", points: 1, crowns: 0, bonus_color: "wild", bonus_count: 1, ability: null, cost: { pearl: 1, black: 1, red: 2, blue: 2 } },

    // Level 2
    { id: "L2-BLA-T1", level: 2, color: "black", points: 1, crowns: 0, bonus_color: "black", bonus_count: 1, ability: "steal", cost: { green: 3, white: 4 } },
    { id: "L2-RED-T1", level: 2, color: "red", points: 1, crowns: 0, bonus_color: "red", bonus_count: 1, ability: "steal", cost: { blue: 3, black: 4 } },
    { id: "L2-GRE-T1", level: 2, color: "green", points: 1, crowns: 0, bonus_color: "green", bonus_count: 1, ability: "steal", cost: { white: 3, red: 4 } },
    { id: "L2-BLU-T1", level: 2, color: "blue", points: 1, crowns: 0, bonus_color: "blue", bonus_count: 1, ability: "steal", cost: { black: 3, green: 4 } },
    { id: "L2-WHI-T1", level: 2, color: "white", points: 1, crowns: 0, bonus_color: "white", bonus_count: 1, ability: "steal", cost: { red: 3, blue: 4 } },

    { id: "L2-BLA-T2", level: 2, color: "black", points: 1, crowns: 0, bonus_color: "black", bonus_count: 2, ability: null, cost: { blue: 2, white: 5 } },
    { id: "L2-RED-T2", level: 2, color: "red", points: 1, crowns: 0, bonus_color: "red", bonus_count: 2, ability: null, cost: { white: 2, black: 5 } },
    { id: "L2-GRE-T2", level: 2, color: "green", points: 1, crowns: 0, bonus_color: "green", bonus_count: 2, ability: null, cost: { black: 2, red: 5 } },
    { id: "L2-BLU-T2", level: 2, color: "blue", points: 1, crowns: 0, bonus_color: "blue", bonus_count: 2, ability: null, cost: { red: 2, green: 5 } },
    { id: "L2-WHI-T2", level: 2, color: "white", points: 1, crowns: 0, bonus_color: "white", bonus_count: 2, ability: null, cost: { green: 2, blue: 5 } },

    { id: "L2-BLA-T3", level: 2, color: "black", points: 2, crowns: 1, bonus_color: "black", bonus_count: 1, ability: null, cost: { pearl: 1, red: 2, green: 2, blue: 2 } },
    { id: "L2-RED-T3", level: 2, color: "red", points: 2, crowns: 1, bonus_color: "red", bonus_count: 1, ability: null, cost: { pearl: 1, green: 2, blue: 2, white: 2 } },
    { id: "L2-GRE-T3", level: 2, color: "green", points: 2, crowns: 1, bonus_color: "green", bonus_count: 1, ability: null, cost: { pearl: 1, blue: 2, white: 2, black: 2 } },
    { id: "L2-BLU-T3", level: 2, color: "blue", points: 2, crowns: 1, bonus_color: "blue", bonus_count: 1, ability: null, cost: { pearl: 1, white: 2, black: 2, red: 2 } },
    { id: "L2-WHI-T3", level: 2, color: "white", points: 2, crowns: 1, bonus_color: "white", bonus_count: 1, ability: null, cost: { pearl: 1, black: 2, red: 2, green: 2 } },

    { id: "L2-BLA-T4", level: 2, color: "black", points: 2, crowns: 0, bonus_color: "black", bonus_count: 1, ability: "take_privilege", cost: { pearl: 1, black: 4, red: 2 } },
    { id: "L2-RED-T4", level: 2, color: "red", points: 2, crowns: 0, bonus_color: "red", bonus_count: 1, ability: "take_privilege", cost: { pearl: 1, red: 4, green: 2 } },
    { id: "L2-GRE-T4", level: 2, color: "green", points: 2, crowns: 0, bonus_color: "green", bonus_count: 1, ability: "take_privilege", cost: { pearl: 1, green: 4, blue: 2 } },
    { id: "L2-BLU-T4", level: 2, color: "blue", points: 2, crowns: 0, bonus_color: "blue", bonus_count: 1, ability: "take_privilege", cost: { pearl: 1, blue: 4, white: 2 } },
    { id: "L2-WHI-T4", level: 2, color: "white", points: 2, crowns: 0, bonus_color: "white", bonus_count: 1, ability: "take_privilege", cost: { pearl: 1, white: 4, black: 2 } },

    { id: "L2-POINTS-1", level: 2, color: null, points: 5, crowns: 0, bonus_color: null, bonus_count: 0, ability: null, cost: { pearl: 1, blue: 6 } },
    { id: "L2-JOKER-2", level: 2, color: "wild", points: 2, crowns: 0, bonus_color: "wild", bonus_count: 1, ability: null, cost: { pearl: 1, green: 6 } },
    { id: "L2-JOKER-3", level: 2, color: "wild", points: 0, crowns: 2, bonus_color: "wild", bonus_count: 1, ability: null, cost: { pearl: 1, green: 6 } },
    { id: "L2-JOKER-4", level: 2, color: "wild", points: 0, crowns: 2, bonus_color: "wild", bonus_count: 1, ability: null, cost: { pearl: 1, blue: 6 } },

    // Level 3
    { id: "L3-BLA-T1", level: 3, color: "black", points: 3, crowns: 2, bonus_color: "black", bonus_count: 1, ability: null, cost: { pearl: 1, red: 3, green: 5, white: 3 } },
    { id: "L3-RED-T1", level: 3, color: "red", points: 3, crowns: 2, bonus_color: "red", bonus_count: 1, ability: null, cost: { pearl: 1, green: 3, blue: 5, black: 3 } },
    { id: "L3-GRE-T1", level: 3, color: "green", points: 3, crowns: 2, bonus_color: "green", bonus_count: 1, ability: null, cost: { pearl: 1, blue: 3, white: 5, red: 3 } },
    { id: "L3-BLU-T1", level: 3, color: "blue", points: 3, crowns: 2, bonus_color: "blue", bonus_count: 1, ability: null, cost: { pearl: 1, white: 3, black: 5, green: 3 } },
    { id: "L3-WHI-T1", level: 3, color: "white", points: 3, crowns: 2, bonus_color: "white", bonus_count: 1, ability: null, cost: { pearl: 1, black: 3, red: 5, blue: 3 } },

    { id: "L3-BLA-T2", level: 3, color: "black", points: 4, crowns: 0, bonus_color: "black", bonus_count: 1, ability: null, cost: { black: 6, red: 2, white: 2 } },
    { id: "L3-RED-T2", level: 3, color: "red", points: 4, crowns: 0, bonus_color: "red", bonus_count: 1, ability: null, cost: { red: 6, green: 2, black: 2 } },
    { id: "L3-GRE-T2", level: 3, color: "green", points: 4, crowns: 0, bonus_color: "green", bonus_count: 1, ability: null, cost: { green: 6, blue: 2, red: 2 } },
    { id: "L3-BLU-T2", level: 3, color: "blue", points: 4, crowns: 0, bonus_color: "blue", bonus_count: 1, ability: null, cost: { blue: 6, white: 2, green: 2 } },
    { id: "L3-WHI-T2", level: 3, color: "white", points: 4, crowns: 0, bonus_color: "white", bonus_count: 1, ability: null, cost: { white: 6, black: 2, blue: 2 } },

    { id: "L3-POINTS-1", level: 3, color: null, points: 6, crowns: 0, bonus_color: null, bonus_count: 0, ability: null, cost: { white: 8 } },
    { id: "L3-JOKER-2", level: 3, color: "wild", points: 0, crowns: 3, bonus_color: "wild", bonus_count: 1, ability: null, cost: { black: 8 } },
    { id: "L3-JOKER-3", level: 3, color: "wild", points: 3, crowns: 0, bonus_color: "wild", bonus_count: 1, ability: "extra_turn", cost: { red: 8 } }
];

const ROYALS_DB: RoyalCard[] = [
    { id: 'R-1', points: 2, ability: 'take_privilege' },
    { id: 'R-2', points: 2, ability: 'steal' },
    { id: 'R-3', points: 2, ability: 'extra_turn' },
    { id: 'R-4', points: 3, ability: null }
];

function shuffle<T>(array: T[]): T[] {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

export class SplendorDuelGameState {
    private data: GameStateData;
    private readonly playerIds: string[];

    constructor(playerIds: string[]) {
        this.playerIds = [...playerIds];
        this.data = {
            status: GameStatus.Lobby,
            actionPhase: 'Normal',
            playerIds: [...playerIds],
            currentPlayerId: '',
            board: Array(5).fill(null).map(() => Array(5).fill(null)),
            bag: [],
            decks: { 1: [], 2: [], 3: [] },
            pyramid: { 1: [], 2: [], 3: [] },
            royalsPool: [],
            privilegesAboveBoard: 3,
            players: {},
            winnerId: null,
            extraTurnPending: false,
            lastMove: null,
            pendingAbilityInfo: null,
            pendingRoyalCount: 0,
            moveCounter: 0
        };
    }

    public static from_data(data: GameStateData, playerIds: string[]): SplendorDuelGameState {
        const state = new SplendorDuelGameState(playerIds);
        state.data = JSON.parse(JSON.stringify(data)); // Deep clone
        return state;
    }

    public get_data(): GameStateData {
        return JSON.parse(JSON.stringify(this.data));
    }

    public start_game(firstPlayer?: string) {
        if (this.playerIds.length !== 2) {
            throw new Error('Splendor Duel requires exactly 2 players');
        }

        this.data.status = GameStatus.Active;
        this.data.actionPhase = 'Normal';
        this.data.currentPlayerId = firstPlayer || this.playerIds[Math.floor(Math.random() * 2)];

        // Setup player states
        for (const pid of this.playerIds) {
            this.data.players[pid] = {
                tokens: { blue: 0, white: 0, green: 0, black: 0, red: 0, pearl: 0, gold: 0 },
                cards: [],
                royals: [],
                reserved: [],
                privileges: 0,
                crossed3rd: false,
                crossed6th: false
            };
        }

        // Asymmetry: Opponent of first player starts with 1 Privilege scroll
        const secondPlayer = this.playerIds.find(pid => pid !== this.data.currentPlayerId)!;
        this.data.players[secondPlayer].privileges = 1;
        this.data.privilegesAboveBoard = 2;

        // Initialize bag with all 25 tokens
        const startingTokens: TokenColor[] = [];
        // 4 of each gem
        const gems: TokenColor[] = ['blue', 'white', 'green', 'black', 'red'];
        for (const gem of gems) {
            for (let i = 0; i < 4; i++) startingTokens.push(gem);
        }
        // 2 pearls
        for (let i = 0; i < 2; i++) startingTokens.push('pearl');
        // 3 gold
        for (let i = 0; i < 3; i++) startingTokens.push('gold');

        const shuffledTokens = shuffle(startingTokens);

        // Fill board spiral with all 25 shuffled tokens
        for (let i = 0; i < SPIRAL_COORDINATES.length; i++) {
            const [r, c] = SPIRAL_COORDINATES[i];
            this.data.board[r][c] = shuffledTokens[i];
        }
        this.data.bag = []; // empty at start

        // Setup Decks
        const l1Cards = shuffle(JEWEL_CARDS_DB.filter(c => c.level === 1));
        const l2Cards = shuffle(JEWEL_CARDS_DB.filter(c => c.level === 2));
        const l3Cards = shuffle(JEWEL_CARDS_DB.filter(c => c.level === 3));

        this.data.decks = {
            1: l1Cards,
            2: l2Cards,
            3: l3Cards
        };

        // Deal Pyramid
        this.data.pyramid = {
            1: [],
            2: [],
            3: []
        };
        for (let i = 0; i < 5; i++) this.data.pyramid[1].push(this.data.decks[1].pop() || null);
        for (let i = 0; i < 4; i++) this.data.pyramid[2].push(this.data.decks[2].pop() || null);
        for (let i = 0; i < 3; i++) this.data.pyramid[3].push(this.data.decks[3].pop() || null);

        // Setup Royals
        this.data.royalsPool = shuffle(ROYALS_DB);

        this.data.lastMove = {
            playerId: this.data.currentPlayerId,
            desc: 'started the game',
            moveId: ++this.data.moveCounter
        };
    }

    // Optional Action 1: Spend Privilege to take 1 non-gold token
    public use_privilege(playerId: string, coord: [number, number]) {
        this.validate_active_player(playerId);
        this.validate_action_phase('Normal');

        const pState = this.data.players[playerId];
        if (pState.privileges <= 0) {
            throw new Error('You do not have any Privilege scrolls to spend');
        }

        const [r, c] = coord;
        const token = this.data.board[r][c];
        if (!token) {
            throw new Error('Board space is empty');
        }
        if (token === 'gold') {
            throw new Error('Cannot take Gold with a Privilege scroll');
        }

        // Spend privilege
        pState.privileges--;
        this.data.privilegesAboveBoard++;

        // Take token
        this.data.board[r][c] = null;
        pState.tokens[token]++;

        this.log_move(playerId, `spent a Privilege scroll to take 1 ${gemName(token)}`);
    }

    // Optional Action 2: Replenish the board from the bag
    public replenish_board(playerId: string, isForced = false) {
        this.validate_active_player(playerId);
        this.validate_action_phase('Normal');

        if (this.data.bag.length === 0) {
            throw new Error('Cannot replenish the board because the bag is empty');
        }

        // Refill empty spots along the spiral
        const shuffledBag = shuffle(this.data.bag);
        let filledCount = 0;

        for (const [r, c] of SPIRAL_COORDINATES) {
            if (shuffledBag.length === 0) break;
            if (this.data.board[r][c] === null) {
                this.data.board[r][c] = shuffledBag.pop()!;
                filledCount++;
            }
        }
        this.data.bag = shuffledBag;

        // Opponent takes 1 Privilege scroll
        const opponentId = this.get_opponent_id(playerId);
        this.award_privilege_scroll(opponentId);

        this.log_move(playerId, `${isForced ? 'was forced to replenish' : 'replenished'} the board with ${filledCount} tokens; opponent gains 1 Privilege`);
    }

    // Mandatory Action A: Take 1, 2, or 3 adjacent tokens in a straight line
    public take_tokens(playerId: string, coords: [number, number][]) {
        this.validate_active_player(playerId);
        this.validate_action_phase('Normal');

        if (coords.length === 0 || coords.length > 3) {
            throw new Error('Must select between 1 and 3 tokens');
        }

        // 1. Validate that all selected board cells are occupied by non-Gold tokens
        const tokens: TokenColor[] = [];
        for (const [r, c] of coords) {
            if (r < 0 || r >= 5 || c < 0 || c >= 5) {
                throw new Error('Invalid board coordinates');
            }
            const t = this.data.board[r][c];
            if (!t) {
                throw new Error('Cannot take tokens from empty spaces');
            }
            if (t === 'gold') {
                throw new Error('Cannot take Gold tokens with the take tokens action');
            }
            tokens.push(t);
        }

        // 2. Validate geometric adjacency / straight line
        if (coords.length > 1) {
            // Sort points by row, then by col to simplify vector direction checking
            const sorted = [...coords].sort((p1, p2) => p1[0] - p2[0] || p1[1] - p2[1]);
            const [r1, c1] = sorted[0];
            const [r2, c2] = sorted[1];

            const dr = r2 - r1;
            const dc = c2 - c1;

            if (Math.abs(dr) > 1 || Math.abs(dc) > 1 || (dr === 0 && dc === 0)) {
                throw new Error('Tokens must be adjacent');
            }

            if (coords.length === 3) {
                const [r3, c3] = sorted[2];
                const dr2 = r3 - r2;
                const dc2 = c3 - c2;
                if (dr !== dr2 || dc !== dc2) {
                    throw new Error('Tokens must form an uninterrupted straight line (horizontal, vertical, or diagonal)');
                }
            }
        }

        // 3. Take tokens and empty spaces
        const pState = this.data.players[playerId];
        for (const [r, c] of coords) {
            const token = this.data.board[r][c]!;
            pState.tokens[token]++;
            this.data.board[r][c] = null;
        }

        // 4. Penalty Check:
        // - if you take 3 of the same colour OR 2 Pearls, your opponent takes 1 Privilege
        const opponentId = this.get_opponent_id(playerId);
        const pearlCount = tokens.filter(t => t === 'pearl').length;

        let triggersPenalty = false;
        let penaltyReason = '';

        if (tokens.length === 3) {
            const firstColor = tokens[0];
            const allSameColor = tokens.every(t => t === firstColor);
            if (allSameColor) {
                triggersPenalty = true;
                penaltyReason = `took 3 matching ${gemName(firstColor)} tokens`;
            }
        }

        if (pearlCount === 2) {
            triggersPenalty = true;
            penaltyReason = (penaltyReason ? penaltyReason + ' and ' : '') + 'took 2 Pearl tokens';
        }

        if (triggersPenalty) {
            this.award_privilege_scroll(opponentId);
        }

        const tokensDesc = tokens.map(t => gemName(t)).join(', ');
        const penaltyMsg = triggersPenalty ? `; opponent gains 1 Privilege (${penaltyReason})` : '';
        this.log_move(playerId, `took ${tokens.length} tokens [${tokensDesc}] from the board${penaltyMsg}`);

        this.complete_mandatory_action(playerId);
    }

    // Mandatory Action B: Take 1 Gold + reserve 1 card
    public reserve_card(
        playerId: string,
        cardId: string | null,
        deckLevel: number | null,
        boardGoldCoord: [number, number]
    ) {
        this.validate_active_player(playerId);
        this.validate_action_phase('Normal');

        const pState = this.data.players[playerId];

        // Gating 1: Max 3 reserved cards
        if (pState.reserved.length >= 3) {
            throw new Error('Cannot reserve more than 3 cards');
        }

        // Gating 2: Must take 1 Gold from the board
        const [gr, gc] = boardGoldCoord;
        if (gr < 0 || gr >= 5 || gc < 0 || gc >= 5) {
            throw new Error('Invalid Gold coordinates');
        }
        const goldToken = this.data.board[gr][gc];
        if (goldToken !== 'gold') {
            throw new Error('Must select a Gold token to take from the board');
        }

        // Reserve card target checking: must provide EITHER a cardId (pyramid) OR deckLevel (blind)
        let reservedCard: Card | null = null;

        if (cardId) {
            // Find in pyramid
            let foundLevel: 1 | 2 | 3 | null = null;
            let foundIndex = -1;
            for (const lvl of [1, 2, 3] as const) {
                const idx = this.data.pyramid[lvl].findIndex(c => c?.id === cardId);
                if (idx !== -1) {
                    foundLevel = lvl;
                    foundIndex = idx;
                    break;
                }
            }

            if (foundLevel === null || foundIndex === -1) {
                throw new Error(`Card with ID ${cardId} is not available in the pyramid`);
            }

            reservedCard = this.data.pyramid[foundLevel][foundIndex]!;

            // Remove from pyramid and replace
            this.data.pyramid[foundLevel][foundIndex] = this.data.decks[foundLevel].pop() || null;

        } else if (deckLevel) {
            if (deckLevel !== 1 && deckLevel !== 2 && deckLevel !== 3) {
                throw new Error('Invalid deck level');
            }
            const card = this.data.decks[deckLevel as 1 | 2 | 3].pop();
            if (!card) {
                throw new Error(`Deck Level ${deckLevel} is exhausted`);
            }
            reservedCard = card;
        } else {
            throw new Error('Must specify either a card to reserve from the pyramid, or a deck to draw from');
        }

        // Deduct gold from board and add to hand
        this.data.board[gr][gc] = null;
        pState.tokens['gold']++;

        // Add card to reserve
        pState.reserved.push(reservedCard);

        const cardDesc = cardId ? `pyramid card ${cardId}` : `a blind card from Deck Level ${deckLevel}`;
        if (cardId) {
            // Pyramid reserve: the card was face-up, so it is safe to reveal in the log.
            this.log_move(playerId, `took 1 Gold and reserved ${cardDesc}`, {
                reservedCard: { ...reservedCard },
                reservedLevel: reservedCard.level
            });
        } else {
            // Blind deck reserve: the card is hidden — only reveal its level.
            this.log_move(playerId, `took 1 Gold and reserved ${cardDesc}`, {
                reservedBlind: true,
                reservedLevel: deckLevel as number
            });
        }

        this.complete_mandatory_action(playerId);
    }

    // Mandatory Action C: Purchase 1 card
    public purchase_card(playerId: string, cardId: string, jokerColor?: TokenColor) {
        this.validate_active_player(playerId);
        this.validate_action_phase('Normal');

        const pState = this.data.players[playerId];

        // 1. Locate card in pyramid or reserve
        let card: Card | null = null;
        let isFromPyramid = false;
        let pLevel: 1 | 2 | 3 | null = null;
        let pIndex = -1;

        // Try pyramid first
        for (const lvl of [1, 2, 3] as const) {
            const idx = this.data.pyramid[lvl].findIndex(c => c?.id === cardId);
            if (idx !== -1) {
                card = this.data.pyramid[lvl][idx]!;
                isFromPyramid = true;
                pLevel = lvl;
                pIndex = idx;
                break;
            }
        }

        // Try reserve if not in pyramid
        let reserveIndex = -1;
        if (!card) {
            reserveIndex = pState.reserved.findIndex(c => c.id === cardId);
            if (reserveIndex !== -1) {
                card = pState.reserved[reserveIndex];
            }
        }

        if (!card) {
            throw new Error(`Card ${cardId} is not available for purchase`);
        }

        // 2. Joker purchase precondition
        // "If you own no bonus card, you cannot purchase this card."
        const ownedBonusesCount = this.calculate_player_bonuses(playerId);
        const hasAnyBonus = Object.values(ownedBonusesCount).some(count => count > 0);

        if (card.color === 'wild') {
            if (!hasAnyBonus) {
                throw new Error('Cannot purchase a wild/joker card if you own zero cards with bonuses');
            }
            if (!jokerColor) {
                throw new Error('Must specify an assigned color for the wild/joker card');
            }
            // Check that the player actually owns a bonus of that color
            if ((ownedBonusesCount[jokerColor] || 0) <= 0) {
                throw new Error(`Cannot assign joker to ${gemName(jokerColor)} because you own no cards providing that bonus color`);
            }
        }

        // 3. Cost calculation and affordability check
        const bonuses = this.calculate_player_bonuses(playerId);
        const costToPay: Partial<Record<TokenColor, number>> = {};

        let goldNeeded = 0;
        const requiredTokensToSpend: Record<TokenColor, number> = {
            blue: 0, white: 0, green: 0, black: 0, red: 0, pearl: 0, gold: 0
        };

        for (const cKey in card.cost) {
            const color = cKey as TokenColor;
            const cardCost = card.cost[color] || 0;
            const discount = color === 'pearl' ? 0 : (bonuses[color] || 0); // no pearl bonuses exist
            const effectiveCost = Math.max(0, cardCost - discount);

            if (effectiveCost > 0) {
                costToPay[color] = effectiveCost;
                const owned = pState.tokens[color] || 0;
                if (owned >= effectiveCost) {
                    requiredTokensToSpend[color] = effectiveCost;
                } else {
                    requiredTokensToSpend[color] = owned;
                    goldNeeded += (effectiveCost - owned);
                }
            }
        }

        if (goldNeeded > pState.tokens['gold']) {
            throw new Error('You cannot afford this card');
        }
        requiredTokensToSpend['gold'] = goldNeeded;

        // 4. Pay tokens (spent tokens go back into the bag, NOT the board)
        for (const cKey in requiredTokensToSpend) {
            const color = cKey as TokenColor;
            const amount = requiredTokensToSpend[color];
            if (amount > 0) {
                pState.tokens[color] -= amount;
                // Return one token to the bag per unit spent (not just a single token)
                for (let i = 0; i < amount; i++) {
                    this.data.bag.push(color);
                }
            }
        }

        // 5. Remove card from original location
        if (isFromPyramid && pLevel !== null && pIndex !== -1) {
            this.data.pyramid[pLevel][pIndex] = this.data.decks[pLevel].pop() || null;
        } else if (reserveIndex !== -1) {
            pState.reserved.splice(reserveIndex, 1);
        }

        // 6. Assign joker color if wild
        if (card.color === 'wild') {
            card.assigned_color = jokerColor!;
            card.bonus_color = jokerColor!;
        }

        // 7. Add card to player's front
        pState.cards.push(card);

        // 8. Log purchase
        const source = isFromPyramid ? 'pyramid' : 'reserve';
        const jokerDesc = card.color === 'wild' ? ` (assigned: ${gemName(jokerColor)})` : '';
        this.log_move(playerId, `purchased card ${cardId} from ${source}${jokerDesc}`, {
            card: { ...card },
            assignedColor: card.color === 'wild' ? jokerColor : undefined
        });

        // 9. Resolve immediate card ability (if any)
        if (card.ability) {
            this.resolve_card_ability(playerId, card);
        } else {
            // Check crowns crossings and complete action if no pending ability decision
            this.check_crown_crossings(playerId);
        }
    }

    // Spend Privilege scroll (optional action)
    private award_privilege_scroll(playerId: string) {
        const pState = this.data.players[playerId];
        if (this.data.privilegesAboveBoard > 0) {
            this.data.privilegesAboveBoard--;
            pState.privileges++;
        } else {
            // Take 1 from opponent if none in pool
            const opponentId = this.get_opponent_id(playerId);
            const oppState = this.data.players[opponentId];
            if (oppState.privileges > 0) {
                oppState.privileges--;
                pState.privileges++;
            }
            // else no-op: player already holds all 3
        }
    }

    // Resolve immediate card ability on acquisition
    private resolve_card_ability(playerId: string, card: Card) {
        const pState = this.data.players[playerId];
        const opponentId = this.get_opponent_id(playerId);
        const oppState = this.data.players[opponentId];

        switch (card.ability) {
            case 'extra_turn':
                // Chaining extra turns: simply set flag to true (resolved in end of turn)
                this.data.extraTurnPending = true;
                this.log_move(playerId, `triggered an Extra Turn ability`);
                this.check_crown_crossings(playerId);
                break;

            case 'take_privilege':
                // Take 1 privilege scroll automatically
                this.award_privilege_scroll(playerId);
                this.log_move(playerId, `triggered Take Privilege ability`);
                this.check_crown_crossings(playerId);
                break;

            case 'take_matching': {
                // Take 1 token from the board matching this card's bonus colour. If none left, ignore.
                const matchingColor = card.bonus_color as TokenColor;
                if (!matchingColor) {
                    // Safety fallback, should not happen as jewel cards with take_matching have a single bonus color
                    this.check_crown_crossings(playerId);
                    break;
                }

                // Check if there is at least one token of this color on the board
                let hasTokenOnBoard = false;
                for (let r = 0; r < 5; r++) {
                    for (let c = 0; c < 5; c++) {
                        if (this.data.board[r][c] === matchingColor) {
                            hasTokenOnBoard = true;
                            break;
                        }
                    }
                }

                if (!hasTokenOnBoard) {
                    this.log_move(playerId, `matching token ability ignored: no ${gemName(matchingColor)} tokens on the board`);
                    this.check_crown_crossings(playerId);
                } else {
                    // Switch to pending ability phase so player can choose which token to take
                    this.data.status = GameStatus.PendingAbility;
                    this.data.actionPhase = 'SelectMatchingToken';
                    this.data.pendingAbilityInfo = {
                        ability: 'take_matching',
                        cardId: card.id,
                        targetColor: matchingColor
                    };
                }
                break;
            }

            case 'steal': {
                // Take 1 Gem/Pearl token from your opponent. If they have none of a takeable type, ignore. Cannot steal Gold.
                const stealableColors: TokenColor[] = [];
                const colors: TokenColor[] = ['blue', 'white', 'green', 'black', 'red', 'pearl'];
                for (const color of colors) {
                    if ((oppState.tokens[color] || 0) > 0) {
                        stealableColors.push(color);
                    }
                }

                if (stealableColors.length === 0) {
                    this.log_move(playerId, `steal ability ignored: opponent has no stealable tokens`);
                    this.check_crown_crossings(playerId);
                } else {
                    // Switch to pending ability phase so player can choose what color to steal
                    this.data.status = GameStatus.PendingAbility;
                    this.data.actionPhase = 'StealToken';
                    this.data.pendingAbilityInfo = {
                        ability: 'steal',
                        cardId: card.id
                    };
                }
                break;
            }

            default:
                this.check_crown_crossings(playerId);
                break;
        }
    }

    // Steal ability interactive resolution
    public resolve_steal(playerId: string, color: TokenColor) {
        this.validate_active_player(playerId);
        if (this.data.status !== GameStatus.PendingAbility || this.data.actionPhase !== 'StealToken') {
            throw new Error('Not in the Steal Token phase');
        }

        if (color === 'gold') {
            throw new Error('Cannot steal Gold');
        }

        const opponentId = this.get_opponent_id(playerId);
        const oppState = this.data.players[opponentId];
        if ((oppState.tokens[color] || 0) <= 0) {
            throw new Error(`Opponent does not have any ${gemName(color)} tokens to steal`);
        }

        // Transfer token
        oppState.tokens[color]--;
        this.data.players[playerId].tokens[color]++;

        this.log_move(playerId, `stole 1 ${gemName(color)} token from opponent`);

        // Clear ability phase and check crowns
        this.data.status = GameStatus.Active;
        this.data.actionPhase = 'Normal';
        this.data.pendingAbilityInfo = null;

        this.check_crown_crossings(playerId);
    }

    // Take matching token ability interactive resolution
    public resolve_matching_token(playerId: string, coord: [number, number]) {
        this.validate_active_player(playerId);
        if (this.data.status !== GameStatus.PendingAbility || this.data.actionPhase !== 'SelectMatchingToken') {
            throw new Error('Not in the Select Matching Token phase');
        }

        const targetColor = this.data.pendingAbilityInfo?.targetColor;
        if (!targetColor) {
            throw new Error('Invalid pending ability info');
        }

        const [r, c] = coord;
        if (r < 0 || r >= 5 || c < 0 || c >= 5) {
            throw new Error('Invalid coordinates');
        }

        const token = this.data.board[r][c];
        if (token !== targetColor) {
            throw new Error(`Must select a ${gemName(targetColor)} token from the board`);
        }

        // Take token
        this.data.board[r][c] = null;
        this.data.players[playerId].tokens[targetColor]++;

        this.log_move(playerId, `took 1 matching ${gemName(targetColor)} token from the board`);

        // Clear ability phase and check crowns
        this.data.status = GameStatus.Active;
        this.data.actionPhase = 'Normal';
        this.data.pendingAbilityInfo = null;

        this.check_crown_crossings(playerId);
    }

    // Check crown thresholds reached (3rd and 6th crown)
    private check_crown_crossings(playerId: string) {
        const pState = this.data.players[playerId];
        const crowns = this.calculate_player_crowns(playerId);

        let pendingRoyals = 0;

        if (crowns >= 3 && !pState.crossed3rd) {
            pState.crossed3rd = true;
            pendingRoyals++;
        }

        if (crowns >= 6 && !pState.crossed6th) {
            pState.crossed6th = true;
            pendingRoyals++;
        }

        if (pendingRoyals > 0) {
            // Check if there are Royal cards left in the pool
            if (this.data.royalsPool.length === 0) {
                // Royal pool exhausted, do nothing
                this.complete_mandatory_action(playerId);
            } else {
                // Enter Select Royal phase
                this.data.status = GameStatus.PendingRoyal;
                this.data.actionPhase = 'SelectRoyal';
                // Accumulate pending royal counts
                this.data.pendingRoyalCount += pendingRoyals;
                this.log_move(playerId, `reached a crown milestone (${crowns} crowns) and must choose ${pendingRoyals} Royal card(s)`);
            }
        } else {
            this.complete_mandatory_action(playerId);
        }
    }

    // Interactive selection of a Royal card
    public select_royal(playerId: string, royalId: string) {
        this.validate_active_player(playerId);
        if (this.data.status !== GameStatus.PendingRoyal || this.data.actionPhase !== 'SelectRoyal') {
            throw new Error('Not in the Select Royal phase');
        }

        const idx = this.data.royalsPool.findIndex(r => r.id === royalId);
        if (idx === -1) {
            throw new Error(`Royal card ${royalId} is not available in the pool`);
        }

        const royal = this.data.royalsPool[idx];
        this.data.royalsPool.splice(idx, 1);

        const pState = this.data.players[playerId];
        pState.royals.push(royal);

        this.log_move(playerId, `claimed Royal card ${royalId} (+${royal.points} prestige)`);

        // Decrease pending royal selections
        this.data.pendingRoyalCount--;

        // 1. Resolve Royal card ability immediately
        if (royal.ability) {
            // Map Royal ability string to Card ability representation to reuse the resolver
            const mockCard: Card = {
                id: royal.id,
                level: 3,
                color: null,
                points: royal.points,
                crowns: 0,
                bonus_color: null,
                bonus_count: 0,
                ability: royal.ability,
                cost: {}
            };
            // Note: Since this is a Royal card, it doesn't trigger crown crossings recursive calls.
            // If the ability requires a player decision (steal, take_matching), the phase will update.
            this.resolve_card_ability_internal(playerId, mockCard);
        } else {
            this.check_next_royal_or_complete(playerId);
        }
    }

    // Resolve card ability for a Royal card without checking crowns recursively
    private resolve_card_ability_internal(playerId: string, card: Card) {
        const opponentId = this.get_opponent_id(playerId);
        const oppState = this.data.players[opponentId];

        switch (card.ability) {
            case 'extra_turn':
                this.data.extraTurnPending = true;
                this.log_move(playerId, `triggered an Extra Turn ability`);
                this.check_next_royal_or_complete(playerId);
                break;

            case 'take_privilege':
                this.award_privilege_scroll(playerId);
                this.log_move(playerId, `triggered Take Privilege ability`);
                this.check_next_royal_or_complete(playerId);
                break;

            case 'steal': {
                const stealableColors: TokenColor[] = [];
                const colors: TokenColor[] = ['blue', 'white', 'green', 'black', 'red', 'pearl'];
                for (const color of colors) {
                    if ((oppState.tokens[color] || 0) > 0) {
                        stealableColors.push(color);
                    }
                }

                if (stealableColors.length === 0) {
                    this.log_move(playerId, `steal ability ignored: opponent has no stealable tokens`);
                    this.check_next_royal_or_complete(playerId);
                } else {
                    // Go to Steal phase, but keep track of remaining pending royals
                    this.data.status = GameStatus.PendingAbility;
                    this.data.actionPhase = 'StealToken';
                    this.data.pendingAbilityInfo = {
                        ability: 'steal',
                        cardId: card.id
                    };
                }
                break;
            }

            default:
                this.check_next_royal_or_complete(playerId);
                break;
        }
    }

    private check_next_royal_or_complete(playerId: string) {
        if (this.data.pendingRoyalCount > 0 && this.data.royalsPool.length > 0) {
            this.data.status = GameStatus.PendingRoyal;
            this.data.actionPhase = 'SelectRoyal';
        } else {
            this.data.pendingRoyalCount = 0;
            this.data.status = GameStatus.Active;
            this.data.actionPhase = 'Normal';
            this.complete_mandatory_action(playerId);
        }
    }

    // Finishes a mandatory action, triggers discard gating, and ends the turn
    private complete_mandatory_action(playerId: string) {
        const pState = this.data.players[playerId];
        const totalTokens = this.calculate_player_tokens_count(playerId);

        if (totalTokens > 10) {
            this.data.status = GameStatus.PendingDiscard;
            this.data.actionPhase = 'Discard';
            this.log_move(playerId, `must discard down to 10 tokens (currently holds ${totalTokens})`);
        } else {
            this.end_turn(playerId);
        }
    }

    // Discards selected tokens down to 10
    public discard_tokens(playerId: string, colorsToDiscard: TokenColor[]) {
        this.validate_active_player(playerId);
        if (this.data.status !== GameStatus.PendingDiscard || this.data.actionPhase !== 'Discard') {
            throw new Error('Not in the Discard phase');
        }

        const pState = this.data.players[playerId];
        const totalTokens = this.calculate_player_tokens_count(playerId);
        const excess = totalTokens - 10;

        if (colorsToDiscard.length !== excess) {
            throw new Error(`Must select exactly ${excess} tokens to discard`);
        }

        // Validate player has these tokens to discard
        const tempCounts = { ...pState.tokens };
        for (const col of colorsToDiscard) {
            if ((tempCounts[col] || 0) <= 0) {
                throw new Error(`You do not have enough ${gemName(col)} tokens to discard`);
            }
            tempCounts[col]--;
        }

        // Apply discard (return to bag)
        for (const col of colorsToDiscard) {
            pState.tokens[col]--;
            this.data.bag.push(col);
        }

        const discardDesc = colorsToDiscard.map(c => gemName(c)).join(', ');
        this.log_move(playerId, `discarded ${colorsToDiscard.length} tokens [${discardDesc}]`);

        // Clear discard phase and end turn
        this.data.status = GameStatus.Active;
        this.data.actionPhase = 'Normal';
        this.end_turn(playerId);
    }

    // Finalize turn, check victory, and swap active player / trigger extra turn
    private end_turn(playerId: string) {
        // 1. Check Victory Conditions
        const victory = this.check_victory_for_player(playerId);
        if (victory.won) {
            this.data.status = GameStatus.GameOver;
            this.data.winnerId = playerId;
            this.data.actionPhase = 'Normal';
            this.log_move(playerId, `WON the game! (${victory.reason})`);
            return;
        }

        // Check if opponent won? (No, victory is only checked for the active player at the end of their turn).

        // 2. Turn Routing
        if (this.data.extraTurnPending) {
            this.data.extraTurnPending = false;
            // Current player retains active turn!
            // this.log_move(playerId, `starts their Extra Turn`);
        } else {
            const nextPlayer = this.get_opponent_id(playerId);
            this.data.currentPlayerId = nextPlayer;
            // this.log_move(nextPlayer, `starts their turn`);
        }

        this.data.status = GameStatus.Active;
        this.data.actionPhase = 'Normal';
    }

    // Victory Check details
    public check_victory_for_player(playerId: string): { won: boolean; reason: string } {
        const prestige = this.calculate_player_prestige(playerId);
        const crowns = this.calculate_player_crowns(playerId);
        const maxSingleColorPrestige = this.calculate_max_single_color_prestige(playerId);

        if (prestige >= 20) {
            return { won: true, reason: `${prestige} Prestige points reached (Condition 1)` };
        }
        if (crowns >= 10) {
            return { won: true, reason: `${crowns} Crowns reached (Condition 2)` };
        }
        if (maxSingleColorPrestige.points >= 10) {
            return { won: true, reason: `10+ Prestige points (${maxSingleColorPrestige.points}) reached on a single color group [${maxSingleColorPrestige.color}] (Condition 3)` };
        }

        return { won: false, reason: '' };
    }

    // Calculate total prestige points
    public calculate_player_prestige(playerId: string): number {
        const pState = this.data.players[playerId];
        if (!pState) return 0;
        let pts = 0;
        for (const card of pState.cards) pts += card.points;
        for (const royal of pState.royals) pts += royal.points;
        return pts;
    }

    // Calculate total crowns owned
    public calculate_player_crowns(playerId: string): number {
        const pState = this.data.players[playerId];
        if (!pState) return 0;
        let cr = 0;
        for (const card of pState.cards) cr += card.crowns;
        return cr;
    }

    // Calculate maximum prestige points belonging to a single color group
    public calculate_max_single_color_prestige(playerId: string): { color: TokenColor | 'none'; points: number } {
        const pState = this.data.players[playerId];
        if (!pState) return { color: 'none', points: 0 };

        const colorPts: Record<TokenColor, number> = {
            blue: 0, white: 0, green: 0, black: 0, red: 0, pearl: 0, gold: 0
        };

        for (const card of pState.cards) {
            // "Points" cards have prestige but no bonus colour (gem-less gray cards).
            // Consequence: they do not contribute to the same-colour victory condition.
            if (card.color === null) continue;

            const col = card.color === 'wild' ? card.assigned_color : card.color;
            if (col) {
                colorPts[col] += card.points;
            }
        }

        let maxColor: TokenColor | 'none' = 'none';
        let maxPts = 0;
        const colors: TokenColor[] = ['blue', 'white', 'green', 'black', 'red'];
        for (const color of colors) {
            if (colorPts[color] > maxPts) {
                maxPts = colorPts[color];
                maxColor = color;
            }
        }

        return { color: maxColor, points: maxPts };
    }

    // Calculate card bonuses for purchasing
    public calculate_player_bonuses(playerId: string): Record<TokenColor, number> {
        const pState = this.data.players[playerId];
        const bonuses: Record<TokenColor, number> = {
            blue: 0, white: 0, green: 0, black: 0, red: 0, pearl: 0, gold: 0
        };
        if (!pState) return bonuses;

        for (const card of pState.cards) {
            if (card.bonus_color && card.bonus_color !== 'wild') {
                bonuses[card.bonus_color] += card.bonus_count;
            }
        }
        return bonuses;
    }

    public calculate_player_tokens_count(playerId: string): number {
        const pState = this.data.players[playerId];
        if (!pState) return 0;
        let sum = 0;
        for (const col in pState.tokens) {
            sum += pState.tokens[col as TokenColor] || 0;
        }
        return sum;
    }

    // Gating helpers
    private validate_active_player(playerId: string) {
        if (this.data.status === GameStatus.GameOver) {
            throw new Error('Game is over');
        }
        if (this.data.currentPlayerId !== playerId) {
            throw new Error(`It is not ${playerId}'s turn`);
        }
    }

    private validate_action_phase(phase: ActionPhase) {
        if (this.data.actionPhase !== phase) {
            throw new Error(`Illegal action: game is in the ${this.data.actionPhase} phase`);
        }
    }

    private get_opponent_id(playerId: string): string {
        return this.playerIds.find(pid => pid !== playerId) || '';
    }

    private log_move(playerId: string, desc: string, extra?: { card?: Card; assignedColor?: TokenColor; reservedCard?: Card; reservedLevel?: number; reservedBlind?: boolean }) {
        this.data.lastMove = {
            playerId,
            desc,
            moveId: ++this.data.moveCounter,
            ...(extra || {})
        };
    }

    // Check if player is stuck (cannot legally make any mandatory action)
    public is_player_stuck(playerId: string): boolean {
        const pState = this.data.players[playerId];
        if (!pState) return false;

        // A. Can they take any tokens?
        // True if there is at least one non-gold token on the board
        let hasTakeableToken = false;
        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 5; c++) {
                const t = this.data.board[r][c];
                if (t && t !== 'gold') {
                    hasTakeableToken = true;
                    break;
                }
            }
        }
        if (hasTakeableToken) return false;

        // B. Can they reserve a card?
        // Must be able to take 1 Gold from the board AND have < 3 reserved AND cards left in pyramid/decks
        let hasGoldOnBoard = false;
        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 5; c++) {
                if (this.data.board[r][c] === 'gold') {
                    hasGoldOnBoard = true;
                    break;
                }
            }
        }

        const canReserve = hasGoldOnBoard && pState.reserved.length < 3 && (
            this.data.pyramid[1].some(c => c !== null) ||
            this.data.pyramid[2].some(c => c !== null) ||
            this.data.pyramid[3].some(c => c !== null) ||
            this.data.decks[1].length > 0 ||
            this.data.decks[2].length > 0 ||
            this.data.decks[3].length > 0
        );
        if (canReserve) return false;

        // C. Can they purchase any card?
        const bonuses = this.calculate_player_bonuses(playerId);
        const allBuyableCards = [
            ...pState.reserved,
            ...this.data.pyramid[1].filter(c => c !== null) as Card[],
            ...this.data.pyramid[2].filter(c => c !== null) as Card[],
            ...this.data.pyramid[3].filter(c => c !== null) as Card[]
        ];

        for (const card of allBuyableCards) {
            // Check joker precondition
            if (card.color === 'wild') {
                const hasAnyBonus = Object.values(bonuses).some(count => count > 0);
                if (!hasAnyBonus) continue; // cannot purchase joker
            }

            // Check affordability
            let goldNeeded = 0;
            let affordable = true;
            for (const cKey in card.cost) {
                const color = cKey as TokenColor;
                const cardCost = card.cost[color] || 0;
                const discount = color === 'pearl' ? 0 : (bonuses[color] || 0);
                const effectiveCost = Math.max(0, cardCost - discount);
                const owned = pState.tokens[color] || 0;
                if (owned < effectiveCost) {
                    goldNeeded += (effectiveCost - owned);
                }
            }
            if (goldNeeded > pState.tokens['gold']) {
                affordable = false;
            }
            if (affordable) return false; // can buy at least one card
        }

        // If they can't take, reserve, or buy, they are stuck!
        return true;
    }
}
