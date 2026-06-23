/**
 * CockroachGameState.ts - Standalone game state management for Cockroach Poker: Royal
 *
 * Handles rules for both 2 players and 3-6 players, including card distribution,
 * passing, peeking, challenges, special cards (Joker, Blank), Royal penalty draws,
 * and game loss detection.
 */

export type CardType = 'animal' | 'royal' | 'joker' | 'blank';
export type Species = 'bat' | 'fly' | 'cockroach' | 'toad' | 'rat' | 'scorpion' | 'stinkbug';
export type Claim = Species | 'royal';

export interface Card {
    id: number;
    type: CardType;
    species?: Species;
}

export enum GameStatus {
    NewRound = 'NewRound',
    CardPassed = 'CardPassed',
    SpecialResolution = 'SpecialResolution',
    GameOver = 'GameOver'
}

export interface PassRecord {
    senderId: string;
    receiverId: string;
    claim: Claim;
}

export interface ResolutionDetails {
    loserId: string;
    senderId: string;
    card: Card;
    claim: Claim;
    guess: boolean;
    guessedCorrectly: boolean;
    penaltyDrawn: Card[];
    specialSubstitute: Card[];
}

export interface GameStateData {
    status: GameStatus;
    playerIds: string[];
    currentPlayerId: string;
    lastSenderId: string | null;
    receiverId: string | null;
    currentCard: Card | null;
    currentClaim: Claim | null;
    passingChain: PassRecord[];
    penaltyPile: Card[];
    tableaus: { [playerId: string]: Card[] };
    hands: { [playerId: string]: Card[] };
    loserId: string | null;
    resolutionDetails: ResolutionDetails | null;
    variant2Player: boolean;
}

export const SPECIES_LIST: Species[] = ['bat', 'fly', 'cockroach', 'toad', 'rat', 'scorpion', 'stinkbug'];

export class CockroachGameState {
    private data: GameStateData;
    private readonly playerIds: string[];

    constructor(playerIds: string[]) {
        this.playerIds = [...playerIds];
        this.data = {
            status: GameStatus.NewRound,
            playerIds: [...playerIds],
            currentPlayerId: playerIds[0],
            lastSenderId: null,
            receiverId: null,
            currentCard: null,
            currentClaim: null,
            passingChain: [],
            penaltyPile: [],
            tableaus: {},
            hands: {},
            loserId: null,
            resolutionDetails: null,
            variant2Player: playerIds.length === 2
        };

        for (const pid of playerIds) {
            this.data.tableaus[pid] = [];
            this.data.hands[pid] = [];
        }
    }

    public static from_data(data: GameStateData, playerIds: string[]): CockroachGameState {
        const state = new CockroachGameState(playerIds);
        state.data = { ...data };
        // Ensure tableaus and hands arrays are deep copied
        state.data.tableaus = {};
        state.data.hands = {};
        for (const pid of playerIds) {
            state.data.tableaus[pid] = [...(data.tableaus[pid] || [])];
            state.data.hands[pid] = [...(data.hands[pid] || [])];
        }
        state.data.penaltyPile = [...data.penaltyPile];
        state.data.passingChain = [...data.passingChain];
        if (data.resolutionDetails) {
            state.data.resolutionDetails = {
                ...data.resolutionDetails,
                penaltyDrawn: [...data.resolutionDetails.penaltyDrawn],
                specialSubstitute: [...data.resolutionDetails.specialSubstitute]
            };
        }
        return state;
    }

    public get_data(): GameStateData {
        return {
            ...this.data,
            tableaus: Object.fromEntries(this.playerIds.map(pid => [pid, [...this.data.tableaus[pid]]])),
            hands: Object.fromEntries(this.playerIds.map(pid => [pid, [...this.data.hands[pid]]])),
            penaltyPile: [...this.data.penaltyPile],
            passingChain: [...this.data.passingChain],
            resolutionDetails: this.data.resolutionDetails ? {
                ...this.data.resolutionDetails,
                penaltyDrawn: [...this.data.resolutionDetails.penaltyDrawn],
                specialSubstitute: [...this.data.resolutionDetails.specialSubstitute]
            } : null
        };
    }

    public start_game(firstPlayer?: string): void {
        this.data.status = GameStatus.NewRound;
        this.data.loserId = null;
        this.data.resolutionDetails = null;
        this.data.currentCard = null;
        this.data.currentClaim = null;
        this.data.lastSenderId = null;
        this.data.receiverId = null;
        this.data.passingChain = [];
        this.data.variant2Player = this.playerIds.length === 2;

        const deck = this.generate_deck();
        this.shuffle(deck);

        // Penalty pile size: 16 for 2-player, 7 for 3-6 players
        const penaltyPileSize = this.data.variant2Player ? 16 : 7;
        this.data.penaltyPile = deck.slice(0, penaltyPileSize);
        const remaining = deck.slice(penaltyPileSize);

        // Deal remaining cards as evenly as possible
        const dealCount = Math.floor(remaining.length / this.playerIds.length);
        const leftovers = remaining.length % this.playerIds.length;

        let dealIdx = 0;
        for (const pid of this.playerIds) {
            this.data.hands[pid] = remaining.slice(dealIdx, dealIdx + dealCount);
            this.data.tableaus[pid] = [];
            dealIdx += dealCount;
        }

        const startPlayer = firstPlayer || this.playerIds[Math.floor(Math.random() * this.playerIds.length)];
        this.data.currentPlayerId = startPlayer;

        // Start player gets 1 extra card if leftovers exist
        let leftoverIdx = dealIdx;
        if (leftovers > 0) {
            this.data.hands[startPlayer].push(remaining[leftoverIdx]);
            leftoverIdx++;
        }

        // Remaining leftovers go to penalty pile
        while (leftoverIdx < remaining.length) {
            this.data.penaltyPile.push(remaining[leftoverIdx]);
            leftoverIdx++;
        }

        // Check if starting player has an empty hand (extremely unlikely, but for completeness)
        if (this.data.hands[startPlayer].length === 0) {
            this.data.status = GameStatus.GameOver;
            this.data.loserId = startPlayer;
        }
    }

    public pass_card(senderId: string, receiverId: string, cardId: number, claim: Claim): void {
        if (this.data.status === GameStatus.GameOver) {
            throw new Error('Game is already over');
        }

        if (senderId === receiverId) {
            throw new Error('Cannot pass to yourself');
        }

        if (!this.playerIds.includes(receiverId)) {
            throw new Error('Invalid receiver ID');
        }

        if (!SPECIES_LIST.includes(claim as Species) && claim !== 'royal') {
            throw new Error('Invalid claim');
        }

        if (this.data.status === GameStatus.NewRound) {
            if (senderId !== this.data.currentPlayerId) {
                throw new Error('It is not your turn to play');
            }

            const hand = this.data.hands[senderId];
            const cardIdx = hand.findIndex(c => c.id === cardId);
            if (cardIdx === -1) {
                throw new Error('Card not found in your hand');
            }

            const card = hand.splice(cardIdx, 1)[0];
            this.data.currentCard = card;
            this.data.lastSenderId = senderId;
            this.data.receiverId = receiverId;
            this.data.currentClaim = claim;
            this.data.passingChain = [{ senderId, receiverId, claim }];
            this.data.status = GameStatus.CardPassed;
            this.data.currentPlayerId = receiverId;

        } else if (this.data.status === GameStatus.CardPassed) {
            if (this.data.variant2Player) {
                throw new Error('Passing on is not allowed in 2-player mode');
            }

            if (senderId !== this.data.receiverId) {
                throw new Error('You are not the current receiver');
            }

            const alreadyHeld = this.data.passingChain.some(
                record => record.senderId === receiverId || record.receiverId === receiverId
            );
            if (alreadyHeld) {
                throw new Error('Cannot pass to someone who has already held the card in this passing chain');
            }

            // Move the in-transit card to the next target
            this.data.lastSenderId = senderId;
            this.data.receiverId = receiverId;
            this.data.currentClaim = claim;
            this.data.passingChain.push({ senderId, receiverId, claim });
            this.data.currentPlayerId = receiverId;

        } else {
            throw new Error('Cannot pass a card in the current phase');
        }
    }

    public decide_card(receiverId: string, guess: boolean): void {
        if (this.data.status !== GameStatus.CardPassed) {
            throw new Error('No card is currently passed for decision');
        }

        if (receiverId !== this.data.receiverId) {
            throw new Error('You are not the current receiver of the card');
        }

        const card = this.data.currentCard;
        const claim = this.data.currentClaim;
        const lastSender = this.data.lastSenderId;

        if (!card || !claim || !lastSender) {
            throw new Error('Invalid transit state');
        }

        // 1. Determine truth of the claim for the card
        let isClaimTrue = false;

        if (card.type === 'joker') {
            // Joker claimed as any species = True, claimed as Royal = False
            isClaimTrue = (claim !== 'royal');
        } else if (card.type === 'blank') {
            // Blank is always false
            isClaimTrue = false;
        } else if (card.type === 'royal') {
            // Royal matches if claim is 'royal' OR claim matches its species
            isClaimTrue = (claim === 'royal' || claim === card.species);
        } else {
            // Regular animal card matches its species
            isClaimTrue = (claim === card.species);
        }

        // 2. Guessed correctly means guess matches claim truth
        const guessedCorrectly = (guess === isClaimTrue);

        // 3. Challenge loser takes the card
        const loserId = guessedCorrectly ? lastSender : receiverId;

        this.data.resolutionDetails = {
            loserId,
            senderId: lastSender,
            card,
            claim,
            guess,
            guessedCorrectly,
            penaltyDrawn: [],
            specialSubstitute: []
        };

        // 4. Resolve card type placement
        if (card.type === 'joker' || card.type === 'blank') {
            // Special Card Tableaus resolution: Special card returns to hand
            this.data.hands[loserId].push(card);
            this.data.status = GameStatus.SpecialResolution;
            this.data.currentPlayerId = loserId;

            // Clear transit variables
            this.data.currentCard = null;
            this.data.currentClaim = null;
            this.data.lastSenderId = null;
            this.data.receiverId = null;
        } else {
            // Regular/Royal card goes to tableau
            this.data.tableaus[loserId].push(card);

            // Draw penalty cascade if it was a Royal card
            if (card.type === 'royal') {
                this.resolve_royal_cascade(loserId);
            }

            // Clear transit variables
            this.data.currentCard = null;
            this.data.currentClaim = null;
            this.data.lastSenderId = null;
            this.data.receiverId = null;

            // Check if game is over
            if (this.check_game_loss()) {
                this.data.status = GameStatus.GameOver;
            } else {
                // Next turn starts with the player who took the card
                this.data.currentPlayerId = loserId;
                if (this.data.hands[loserId].length === 0) {
                    // Empty hand loss condition check on turn start
                    this.data.status = GameStatus.GameOver;
                    this.data.loserId = loserId;
                } else {
                    this.data.status = GameStatus.NewRound;
                }
            }
        }
    }

    public resolve_special(playerId: string, substituteCardIds: number[]): void {
        if (this.data.status !== GameStatus.SpecialResolution) {
            throw new Error('Not in special resolution phase');
        }

        if (playerId !== this.data.currentPlayerId) {
            throw new Error('It is not your turn to resolve the special card');
        }

        const details = this.data.resolutionDetails;
        if (!details) {
            throw new Error('No resolution details found');
        }

        const lastClaim = details.claim;
        const hand = this.data.hands[playerId];

        // Determine if player has any regular animal card of the claimed species
        const hasMatchingSpecies = (lastClaim !== 'royal') && 
            hand.some(c => c.type === 'animal' && c.species === lastClaim);

        if (hasMatchingSpecies) {
            // Must place exactly 1 card of that species
            if (substituteCardIds.length !== 1) {
                throw new Error(`You must select exactly 1 card matching the species: ${lastClaim}`);
            }
            const cardId = substituteCardIds[0];
            const card = hand.find(c => c.id === cardId);
            if (!card) {
                throw new Error('Card not found in your hand');
            }
            if (card.type !== 'animal' || card.species !== lastClaim) {
                throw new Error(`The card must be a regular animal card of type: ${lastClaim}`);
            }

            // Remove from hand and add to tableau
            const idx = hand.findIndex(c => c.id === cardId);
            hand.splice(idx, 1);
            this.data.tableaus[playerId].push(card);
            details.specialSubstitute.push(card);

        } else {
            // Must place any 2 cards (or all remaining hand cards if < 2)
            const requiredCount = Math.min(2, hand.length);
            if (substituteCardIds.length !== requiredCount) {
                throw new Error(`You must select exactly ${requiredCount} card(s) from your hand`);
            }

            const cardsToPlace: Card[] = [];
            for (const cid of substituteCardIds) {
                const idx = hand.findIndex(c => c.id === cid);
                if (idx === -1) {
                    throw new Error('Card not found in your hand');
                }
                cardsToPlace.push(hand.splice(idx, 1)[0]);
            }

            for (const card of cardsToPlace) {
                this.data.tableaus[playerId].push(card);
                details.specialSubstitute.push(card);
            }
        }

        // Special cards cannot trigger royal cascade draw since they aren't royal
        // Check game loss conditions
        if (this.check_game_loss()) {
            this.data.status = GameStatus.GameOver;
        } else {
            // Next turn starts with the player who resolved
            this.data.currentPlayerId = playerId;
            if (this.data.hands[playerId].length === 0) {
                // Empty hand loss check on turn start
                this.data.status = GameStatus.GameOver;
                this.data.loserId = playerId;
            } else {
                this.data.status = GameStatus.NewRound;
            }
        }
    }

    private resolve_royal_cascade(loserId: string): void {
        const details = this.data.resolutionDetails;
        if (!details) return;

        let cascade = true;
        while (cascade && this.data.penaltyPile.length > 0) {
            // Pop the top card (last element in array)
            const drawnCard = this.data.penaltyPile.pop()!;
            this.data.tableaus[loserId].push(drawnCard);
            details.penaltyDrawn.push(drawnCard);

            if (drawnCard.type !== 'royal') {
                cascade = false;
            }
        }
    }

    private check_game_loss(): boolean {
        // Condition 1: 4 of a kind (5 for 2-player variant)
        const winThreshold = this.data.variant2Player ? 5 : 4;

        for (const pid of this.playerIds) {
            const counts: { [key: string]: number } = { royal: 0 };
            for (const sp of SPECIES_LIST) {
                counts[sp] = 0;
            }

            for (const card of this.data.tableaus[pid]) {
                if (card.type === 'royal') {
                    counts['royal']++;
                } else if (card.type === 'animal' && card.species) {
                    counts[card.species]++;
                }
            }

            for (const key of Object.keys(counts)) {
                if (counts[key] >= winThreshold) {
                    this.data.loserId = pid;
                    return true;
                }
            }
        }

        return false;
    }

    private generate_deck(): Card[] {
        const deck: Card[] = [];
        let id = 1;

        // 7 species x 8 animal cards
        for (const species of SPECIES_LIST) {
            for (let i = 0; i < 8; i++) {
                deck.push({ id: id++, type: 'animal', species });
            }
        }

        // 7 species x 1 royal card
        for (const species of SPECIES_LIST) {
            deck.push({ id: id++, type: 'royal', species });
        }

        // 1 Joker card
        deck.push({ id: id++, type: 'joker' });

        // 1 Blank card
        deck.push({ id: id++, type: 'blank' });

        return deck;
    }

    private shuffle(deck: Card[]): void {
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
    }
}
