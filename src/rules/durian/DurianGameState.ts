/**
 * DurianGameState.ts - Standalone game state management for Durian by Oink Games
 */

export enum GameStatus {
    PlayerTurn = 0,         // Player decides to draw or ring the bell
    CardDrawn = 1,          // Card drawn, deciding which side to play
    ManagerResolution = 2,  // Bell rung, manager reveals cards and calculates points
}

export interface FruitInfo {
    fruit: 'banana' | 'grape' | 'strawberry' | 'durian';
    count: number;
}

export interface Card {
    id: number;
    type: 'fruit';
    sideA: FruitInfo;
    sideB: FruitInfo;
}

export interface PlacedOrder {
    cardId: number;
    fruit: 'banana' | 'grape' | 'strawberry' | 'durian';
    count: number;
    otherSideFruit?: 'banana' | 'grape' | 'strawberry' | 'durian';
    otherSideCount?: number;
    flipped: boolean;
}

export interface PlayerState {
    id: string;
    inventoryCard: Card | null; // Card on their stand, hidden to them
    points: number;            // Total penalty points (Angry Manager points)
}

export interface ResolutionDetails {
    success: boolean;                // True if orders did NOT exceed inventory (bell ringer gets penalty)
    penalizedPlayerId: string;       // Player who receives the penalty
    penaltyAmount: number;           // Value of penalty given (always 1)
    ordersTotal: { [key: string]: number };
    inventoryTotal: { [key: string]: number };
    exceededFruits: string[];
}

export interface GameStateData {
    status: GameStatus;
    round: number;
    currentPlayerId: string;
    lastPlayerId: string | null;     // Player who placed the last order
    players: { [playerId: string]: PlayerState };
    orders: PlacedOrder[];
    deck: Card[];
    drawnCard: Card | null;
    bellRingerId: string | null;
    resolutionDetails: ResolutionDetails | null;
}

// 28 Custom Fruit cards satisfying:
// 1. One side has count = 1.
// 2. Other side has count = 2 or 3 of a DIFFERENT fruit.
// 3. Perfect Staircase Rarity Distribution across both sides:
//    Banana (18) > Grape (15) > Strawberry (13) > Durian (10)
const FRUIT_DECK_PRESETS: Omit<Card, 'id' | 'type'>[] = [
    // 9 Banana-primary cards (Side A has banana count 1, Side B has count >1 of different fruit)
    { sideA: { fruit: 'banana', count: 1 }, sideB: { fruit: 'grape', count: 2 } },
    { sideA: { fruit: 'banana', count: 1 }, sideB: { fruit: 'grape', count: 3 } },
    { sideA: { fruit: 'banana', count: 1 }, sideB: { fruit: 'strawberry', count: 2 } },
    { sideA: { fruit: 'banana', count: 1 }, sideB: { fruit: 'strawberry', count: 3 } },
    { sideA: { fruit: 'banana', count: 1 }, sideB: { fruit: 'durian', count: 2 } },
    { sideA: { fruit: 'banana', count: 1 }, sideB: { fruit: 'durian', count: 3 } },
    { sideA: { fruit: 'banana', count: 1 }, sideB: { fruit: 'grape', count: 2 } },
    { sideA: { fruit: 'banana', count: 1 }, sideB: { fruit: 'strawberry', count: 2 } },
    { sideA: { fruit: 'banana', count: 1 }, sideB: { fruit: 'durian', count: 2 } },

    // 8 Grape-primary cards
    { sideA: { fruit: 'grape', count: 1 }, sideB: { fruit: 'banana', count: 2 } },
    { sideA: { fruit: 'grape', count: 1 }, sideB: { fruit: 'banana', count: 3 } },
    { sideA: { fruit: 'grape', count: 1 }, sideB: { fruit: 'strawberry', count: 2 } },
    { sideA: { fruit: 'grape', count: 1 }, sideB: { fruit: 'strawberry', count: 3 } },
    { sideA: { fruit: 'grape', count: 1 }, sideB: { fruit: 'durian', count: 2 } },
    { sideA: { fruit: 'grape', count: 1 }, sideB: { fruit: 'durian', count: 3 } },
    { sideA: { fruit: 'grape', count: 1 }, sideB: { fruit: 'banana', count: 2 } },
    { sideA: { fruit: 'grape', count: 1 }, sideB: { fruit: 'strawberry', count: 2 } },

    // 7 Strawberry-primary cards
    { sideA: { fruit: 'strawberry', count: 1 }, sideB: { fruit: 'banana', count: 2 } },
    { sideA: { fruit: 'strawberry', count: 1 }, sideB: { fruit: 'banana', count: 3 } },
    { sideA: { fruit: 'strawberry', count: 1 }, sideB: { fruit: 'grape', count: 2 } },
    { sideA: { fruit: 'strawberry', count: 1 }, sideB: { fruit: 'grape', count: 3 } },
    { sideA: { fruit: 'strawberry', count: 1 }, sideB: { fruit: 'durian', count: 2 } },
    { sideA: { fruit: 'strawberry', count: 1 }, sideB: { fruit: 'durian', count: 3 } },
    { sideA: { fruit: 'strawberry', count: 1 }, sideB: { fruit: 'banana', count: 2 } },

    // 4 Durian-primary cards
    { sideA: { fruit: 'durian', count: 1 }, sideB: { fruit: 'banana', count: 2 } },
    { sideA: { fruit: 'durian', count: 1 }, sideB: { fruit: 'banana', count: 3 } },
    { sideA: { fruit: 'durian', count: 1 }, sideB: { fruit: 'grape', count: 2 } },
    { sideA: { fruit: 'durian', count: 1 }, sideB: { fruit: 'strawberry', count: 2 } }
];

export class DurianGameState {
    private data: GameStateData;
    private readonly playerIds: string[];

    constructor(playerIds: string[]) {
        this.playerIds = [...playerIds];
        this.data = {
            status: GameStatus.PlayerTurn,
            round: 0,
            currentPlayerId: playerIds[0] || '',
            lastPlayerId: null,
            players: {},
            orders: [],
            deck: [],
            drawnCard: null,
            bellRingerId: null,
            resolutionDetails: null
        };

        // Initialize players
        for (const pid of playerIds) {
            this.data.players[pid] = {
                id: pid,
                inventoryCard: null,
                points: 0
            };
        }
    }

    public static from_data(data: GameStateData, playerIds: string[]): DurianGameState {
        const state = new DurianGameState(playerIds);
        state.data = { ...data };
        return state;
    }

    public get_data(): GameStateData {
        return this.data;
    }

    public start_game(): void {
        this.data.round = 0;
        for (const pid of this.playerIds) {
            this.data.players[pid].points = 0;
        }
        this.start_new_round();
    }

    private generate_deck(): Card[] {
        const fullDeck: Card[] = [];
        let id = 1;

        // Add standard fruit cards
        for (const preset of FRUIT_DECK_PRESETS) {
            fullDeck.push({ id: id++, type: 'fruit', ...preset } as Card);
        }

        // Shuffle deck using Fisher-Yates algorithm
        for (let i = fullDeck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = fullDeck[i];
            fullDeck[i] = fullDeck[j];
            fullDeck[j] = temp;
        }

        return fullDeck;
    }

    private start_new_round(): void {
        const deck = this.generate_deck();

        // Deal 1 card to each player
        for (const pid of this.playerIds) {
            const card = deck.pop() || null;
            this.data.players[pid].inventoryCard = card;
        }

        this.data.deck = deck;
        this.data.orders = [];
        this.data.drawnCard = null;
        this.data.lastPlayerId = null;
        this.data.bellRingerId = null;
        this.data.resolutionDetails = null;

        this.data.currentPlayerId = this.playerIds[this.data.round % this.playerIds.length] || '';
        this.data.status = GameStatus.PlayerTurn;
    }

    public draw_card(playerId: string): void {
        if (this.data.status !== GameStatus.PlayerTurn) {
            throw new Error('Not the time to draw a card');
        }
        if (this.data.currentPlayerId !== playerId) {
            throw new Error('It is not your turn');
        }

        const card = this.data.deck.pop();
        if (!card) {
            // Deck is empty, reshuffle standard cards that are not in hands/orders
            const freshDeck = this.generate_deck().filter(c => {
                const isHeld = Object.values(this.data.players).some(p => p.inventoryCard?.id === c.id);
                const isOrdered = this.data.orders.some(o => o.cardId === c.id);
                return !isHeld && !isOrdered;
            });
            this.data.deck = freshDeck;
        }

        const drawn = this.data.deck.pop() || null;
        if (!drawn) {
            throw new Error('No cards left in the deck');
        }

        this.data.drawnCard = drawn;
        this.data.status = GameStatus.CardDrawn;
    }

    public submit_order(playerId: string, chosenSide: 'A' | 'B'): void {
        if (this.data.status !== GameStatus.CardDrawn || !this.data.drawnCard) {
            throw new Error('No card is currently drawn');
        }
        if (this.data.currentPlayerId !== playerId) {
            throw new Error('It is not your turn');
        }

        const card = this.data.drawnCard;
        const side = chosenSide === 'A' ? card.sideA! : card.sideB!;
        const otherSide = chosenSide === 'A' ? card.sideB! : card.sideA!;

        const order: PlacedOrder = {
            cardId: card.id,
            fruit: side.fruit,
            count: side.count,
            otherSideFruit: otherSide.fruit,
            otherSideCount: otherSide.count,
            flipped: false
        };

        this.data.orders.push(order);
        this.data.lastPlayerId = playerId;
        this.data.drawnCard = null;

        this.advance_turn();
    }

    private advance_turn(): void {
        const index = this.playerIds.indexOf(this.data.currentPlayerId);
        const nextIndex = (index + 1) % this.playerIds.length;
        this.data.currentPlayerId = this.playerIds[nextIndex];
        this.data.status = GameStatus.PlayerTurn;
    }

    public ring_bell(playerId: string): void {
        if (this.data.status !== GameStatus.PlayerTurn) {
            throw new Error('Cannot ring bell in current phase');
        }
        if (this.data.currentPlayerId !== playerId) {
            throw new Error('It is not your turn');
        }
        if (this.data.orders.length === 0) {
            throw new Error('Cannot ring bell on the first turn of the round');
        }

        this.data.bellRingerId = playerId;
        this.data.status = GameStatus.ManagerResolution;

        // Perform manager calculations
        this.calculate_manager_resolution();
    }

    private calculate_manager_resolution(): void {
        const ordersTotal: { [key: string]: number } = { banana: 0, grape: 0, strawberry: 0, durian: 0 };
        const inventoryTotal: { [key: string]: number } = { banana: 0, grape: 0, strawberry: 0, durian: 0 };

        // 1. Tally Orders
        for (const order of this.data.orders) {
            ordersTotal[order.fruit] += order.count;
        }

        // 2. Tally Inventory (Both Side A and Side B count towards stock!)
        for (const pid of this.playerIds) {
            const card = this.data.players[pid].inventoryCard;
            if (card) {
                const sideA = card.sideA;
                const sideB = card.sideB;
                inventoryTotal[sideA.fruit] += sideA.count;
                inventoryTotal[sideB.fruit] += sideB.count;
            }
        }

        // 3. Compare Orders vs Inventory
        const exceededFruits: string[] = [];
        const fruits: ('banana' | 'grape' | 'strawberry' | 'durian')[] = ['banana', 'grape', 'strawberry', 'durian'];

        for (const f of fruits) {
            if (ordersTotal[f] > inventoryTotal[f]) {
                exceededFruits.push(f);
            }
        }

        const isExceeded = exceededFruits.length > 0;
        let penalizedPlayerId = '';

        if (isExceeded) {
            // Manager is angry at the clerk who placed the last order!
            penalizedPlayerId = this.data.lastPlayerId || this.data.bellRingerId!;
        } else {
            // Manager is angry at the bell ringer for calling the manager unnecessarily!
            penalizedPlayerId = this.data.bellRingerId!;
        }

        // Flat 1 point penalty applied
        const penaltyAmount = 1;
        this.data.players[penalizedPlayerId].points += penaltyAmount;

        this.data.resolutionDetails = {
            success: !isExceeded, // Success means orders did not exceed inventory
            penalizedPlayerId,
            penaltyAmount,
            ordersTotal,
            inventoryTotal,
            exceededFruits
        };


    }

    public next_round(): void {
        if (this.data.status !== GameStatus.ManagerResolution) {
            throw new Error('Cannot start next round unless manager confrontation is complete');
        }
        this.data.round++;
        this.start_new_round();
    }

    public restart_game(): void {
        this.data.status = GameStatus.PlayerTurn;
        this.data.round = 0;
        for (const pid of this.playerIds) {
            this.data.players[pid].points = 0;
            this.data.players[pid].inventoryCard = null;
        }
        this.start_new_round();
    }
}
