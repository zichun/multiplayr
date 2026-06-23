/**
 * JaipurGameState.ts - Standalone game state management for Jaipur
 *
 * Jaipur is strictly a 2-player card game. Players trade in the marketplace,
 * collect goods, and sell them for rupees (represented by tokens).
 */

export type CardType = 'diamonds' | 'gold' | 'silver' | 'cloth' | 'spice' | 'leather' | 'camels';

export interface Card {
    id: number;
    type: CardType;
}

export enum GameStatus {
    Active = 'Active',
    RoundEnd = 'RoundEnd',
    GameOver = 'GameOver'
}

export interface Token {
    type: string; // 'diamonds' | 'gold' | 'silver' | 'cloth' | 'spice' | 'leather' | 'camel' | 'bonus3' | 'bonus4' | 'bonus5'
    value: number;
    isBonus?: boolean;
}

export interface PlayerState {
    hand: Card[];
    herd: Card[];
    tokens: Token[];
    seals: number;
    rupeesThisRound: number;
}

export interface MoveRecord {
    playerId: string;
    type: string;
    desc: string;
    moveId: string;
}

export interface RoundScore {
    rupees: number;
    camels: number;
    seals: number;
    bonusTokenCount: number;
    goodsTokenCount: number;
}

export interface RoundResult {
    roundNumber: number;
    winnerId: string | null;
    scores: { [playerId: string]: RoundScore };
    camelTokenWinner: string | null;
}

export interface GameStateData {
    status: GameStatus;
    playerIds: string[];
    currentPlayerId: string;
    market: Card[];
    deck: Card[];
    discardPile: Card[];
    goodsTokens: { [key in CardType]?: number[] };
    bonusTokens: { '3': number[]; '4': number[]; '5': number[] };
    camelTokenClaimedBy: string | null;
    winnerId: string | null;
    roundNumber: number;
    lastMove: MoveRecord | null;
    roundResults: RoundResult[];
    players: { [playerId: string]: PlayerState };
}

// Cards composition
const CARD_COUNTS: { [key in CardType]: number } = {
    diamonds: 6,
    gold: 6,
    silver: 6,
    cloth: 8,
    spice: 8,
    leather: 10,
    camels: 11
};

// Tokens distribution
const GOODS_TOKENS_VALUES: { [key in Exclude<CardType, 'camels'>]: number[] } = {
    diamonds: [7, 7, 5, 5, 5, 5],
    gold: [6, 6, 5, 5, 5, 5],
    silver: [5, 5, 5, 5, 5, 5],
    cloth: [5, 3, 3, 2, 2, 1, 1, 1],
    spice: [5, 3, 3, 2, 2, 1, 1, 1],
    leather: [4, 3, 2, 1, 1, 1, 1, 1, 1, 1]
};

export class JaipurGameState {
    private data: GameStateData;
    private readonly playerIds: string[];

    constructor(playerIds: string[]) {
        if (playerIds.length !== 2) {
            throw new Error('Jaipur is strictly a 2-player game.');
        }
        this.playerIds = [...playerIds];
        this.data = {
            status: GameStatus.Active,
            playerIds: [...playerIds],
            currentPlayerId: playerIds[0],
            market: [],
            deck: [],
            discardPile: [],
            goodsTokens: {},
            bonusTokens: { '3': [], '4': [], '5': [] },
            camelTokenClaimedBy: null,
            winnerId: null,
            roundNumber: 1,
            lastMove: null,
            roundResults: [],
            players: {}
        };

        for (const pid of playerIds) {
            this.data.players[pid] = {
                hand: [],
                herd: [],
                tokens: [],
                seals: 0,
                rupeesThisRound: 0
            };
        }
    }

    public static from_data(data: GameStateData, playerIds: string[]): JaipurGameState {
        const state = new JaipurGameState(playerIds);
        state.data = { ...data };
        state.data.players = {};
        for (const pid of playerIds) {
            state.data.players[pid] = {
                hand: [...(data.players[pid]?.hand || [])],
                herd: [...(data.players[pid]?.herd || [])],
                tokens: [...(data.players[pid]?.tokens || [])],
                seals: data.players[pid]?.seals || 0,
                rupeesThisRound: data.players[pid]?.rupeesThisRound || 0
            };
        }
        state.data.market = [...data.market];
        state.data.deck = [...data.deck];
        state.data.discardPile = [...data.discardPile];
        state.data.goodsTokens = {};
        for (const key of Object.keys(data.goodsTokens || {})) {
            const cardKey = key as CardType;
            state.data.goodsTokens[cardKey] = [...(data.goodsTokens[cardKey] || [])];
        }
        state.data.bonusTokens = {
            '3': [...(data.bonusTokens['3'] || [])],
            '4': [...(data.bonusTokens['4'] || [])],
            '5': [...(data.bonusTokens['5'] || [])]
        };
        state.data.roundResults = (data.roundResults || []).map(r => ({
            ...r,
            scores: Object.fromEntries(
                Object.entries(r.scores).map(([pid, score]) => [pid, { ...score }])
            )
        }));
        return state;
    }

    public get_data(): GameStateData {
        const playersCopy: { [playerId: string]: PlayerState } = {};
        for (const pid of this.playerIds) {
            playersCopy[pid] = {
                hand: [...this.data.players[pid].hand],
                herd: [...this.data.players[pid].herd],
                tokens: [...this.data.players[pid].tokens],
                seals: this.data.players[pid].seals,
                rupeesThisRound: this.data.players[pid].rupeesThisRound
            };
        }

        const goodsTokensCopy: { [key in CardType]?: number[] } = {};
        for (const key of Object.keys(this.data.goodsTokens)) {
            const cardKey = key as CardType;
            goodsTokensCopy[cardKey] = [...(this.data.goodsTokens[cardKey] || [])];
        }

        return {
            ...this.data,
            players: playersCopy,
            market: [...this.data.market],
            deck: [...this.data.deck],
            discardPile: [...this.data.discardPile],
            goodsTokens: goodsTokensCopy,
            bonusTokens: {
                '3': [...this.data.bonusTokens['3']],
                '4': [...this.data.bonusTokens['4']],
                '5': [...this.data.bonusTokens['5']]
            },
            roundResults: this.data.roundResults.map(r => ({
                ...r,
                scores: Object.fromEntries(
                    Object.entries(r.scores).map(([pid, score]) => [pid, { ...score }])
                )
            }))
        };
    }

    public start_game(firstPlayer?: string): void {
        this.data.status = GameStatus.Active;
        this.data.winnerId = null;
        this.data.camelTokenClaimedBy = null;
        this.data.lastMove = null;

        // Reset player hand/herd/tokens for the round (keeping Seals intact)
        for (const pid of this.playerIds) {
            this.data.players[pid].hand = [];
            this.data.players[pid].herd = [];
            this.data.players[pid].tokens = [];
            this.data.players[pid].rupeesThisRound = 0;
        }

        // Generate full deck
        const deck = this.generate_deck();

        // Separate out 3 camels to put immediately in the market
        const initialCamels: Card[] = [];
        const nonCamels: Card[] = [];
        for (const card of deck) {
            if (card.type === 'camels' && initialCamels.length < 3) {
                initialCamels.push(card);
            } else {
                nonCamels.push(card);
            }
        }

        // Shuffle remaining cards (which contains 8 camels + 44 goods = 52 cards)
        this.shuffle(nonCamels);

        // Deal 5 cards to each player
        let dealIdx = 0;
        for (const pid of this.playerIds) {
            const cardsDealt = nonCamels.slice(dealIdx, dealIdx + 5);
            dealIdx += 5;

            // Move camels directly to herd
            for (const card of cardsDealt) {
                if (card.type === 'camels') {
                    this.data.players[pid].herd.push(card);
                } else {
                    this.data.players[pid].hand.push(card);
                }
            }
        }

        // Draw cards to bring the market to 5 cards (currently has 3 camels)
        const marketCards = [...initialCamels];
        while (marketCards.length < 5 && dealIdx < nonCamels.length) {
            marketCards.push(nonCamels[dealIdx]);
            dealIdx++;
        }

        this.data.market = marketCards;
        this.data.deck = nonCamels.slice(dealIdx);
        this.data.discardPile = [];

        // Sort goods tokens
        this.data.goodsTokens = {};
        for (const key of Object.keys(GOODS_TOKENS_VALUES)) {
            const cardKey = key as Exclude<CardType, 'camels'>;
            this.data.goodsTokens[cardKey] = [...GOODS_TOKENS_VALUES[cardKey]];
        }

        // Shuffle bonus tokens
        this.data.bonusTokens = {
            '3': this.generate_bonus_tokens(3, 1, 3),
            '4': this.generate_bonus_tokens(4, 4, 6),
            '5': this.generate_bonus_tokens(5, 8, 10)
        };

        // Determine starting player
        if (firstPlayer && this.playerIds.includes(firstPlayer)) {
            this.data.currentPlayerId = firstPlayer;
        } else {
            this.data.currentPlayerId = this.playerIds[Math.floor(Math.random() * this.playerIds.length)];
        }
    }

    /**
     * Action B - Take 1 Single Good
     */
    public take_single_good(playerId: string, marketCardId: number): void {
        this.validate_turn(playerId);

        const marketCardIdx = this.data.market.findIndex(c => c.id === marketCardId);
        if (marketCardIdx === -1) {
            throw new Error('Card not found in the market.');
        }

        const card = this.data.market[marketCardIdx];
        if (card.type === 'camels') {
            throw new Error('Camels cannot be taken with a single good action. Use Take All Camels.');
        }

        const pState = this.data.players[playerId];
        // Validate hand limit check: can only hold up to 7 cards at end of turn
        if (pState.hand.length + 1 > 7) {
            throw new Error('Cannot take card: would exceed hand limit of 7 cards.');
        }

        // Take from market to hand
        this.data.market.splice(marketCardIdx, 1);
        pState.hand.push(card);

        // Refill market from deck
        let refillErrorOccurred = false;
        if (this.data.deck.length > 0) {
            const nextCard = this.data.deck.shift()!;
            this.data.market.push(nextCard);
        } else {
            refillErrorOccurred = true;
        }

        // Log move
        this.log_move(playerId, 'take_single', `took a ${card.type} from the market.`);

        // End of round triggers
        if (refillErrorOccurred) {
            this.resolve_round_end();
        } else {
            this.pass_turn();
        }
    }

    /**
     * Action C - Take All Camels
     */
    public take_all_camels(playerId: string): void {
        this.validate_turn(playerId);

        const camelCards = this.data.market.filter(c => c.type === 'camels');
        if (camelCards.length === 0) {
            throw new Error('No camels currently in the market.');
        }

        const pState = this.data.players[playerId];

        // Remove camels from market and put in player herd
        this.data.market = this.data.market.filter(c => c.type !== 'camels');
        for (const camel of camelCards) {
            pState.herd.push(camel);
        }

        // Refill market from deck
        let refillErrorOccurred = false;
        const camelsCount = camelCards.length;
        for (let i = 0; i < camelsCount; i++) {
            if (this.data.deck.length > 0) {
                const nextCard = this.data.deck.shift()!;
                this.data.market.push(nextCard);
            } else {
                refillErrorOccurred = true;
            }
        }

        // Log move
        this.log_move(playerId, 'take_camels', `took ${camelsCount} camel(s) from the market.`);

        // End of round triggers
        if (refillErrorOccurred) {
            this.resolve_round_end();
        } else {
            this.pass_turn();
        }
    }

    /**
     * Action A - Take Several Goods (Exchange)
     * takeIds: IDs of goods cards to take from market
     * returnCards: Array of cards to return to the market
     */
    public exchange_goods(
        playerId: string,
        takeIds: number[],
        returnCards: { id: number; from: 'hand' | 'herd' }[]
    ): void {
        this.validate_turn(playerId);

        if (takeIds.length < 2) {
            throw new Error('Exchange action requires taking at least 2 cards.');
        }

        if (takeIds.length !== returnCards.length) {
            throw new Error('Must return the exact same number of cards as you take.');
        }

        // Validate that all takeIds exist in market and are NOT camels
        const takenCards: Card[] = [];
        for (const tid of takeIds) {
            const card = this.data.market.find(c => c.id === tid);
            if (!card) {
                throw new Error('One of the requested market cards was not found.');
            }
            if (card.type === 'camels') {
                throw new Error('Cannot exchange to take camels from the market.');
            }
            takenCards.push(card);
        }

        const pState = this.data.players[playerId];

        // Validate that returned cards exist in hand/herd
        const returnedCards: Card[] = [];
        const handIndicesToRemove: number[] = [];
        const herdIndicesToRemove: number[] = [];

        for (const ret of returnCards) {
            if (ret.from === 'hand') {
                const idx = pState.hand.findIndex((c, i) => c.id === ret.id && !handIndicesToRemove.includes(i));
                if (idx === -1) {
                    throw new Error('Returned card not found in hand.');
                }
                handIndicesToRemove.push(idx);
                returnedCards.push(pState.hand[idx]);
            } else if (ret.from === 'herd') {
                const idx = pState.herd.findIndex((c, i) => c.id === ret.id && !herdIndicesToRemove.includes(i));
                if (idx === -1) {
                    throw new Error('Returned card not found in camel herd.');
                }
                herdIndicesToRemove.push(idx);
                returnedCards.push(pState.herd[idx]);
            } else {
                throw new Error('Invalid source for returned card.');
            }
        }

        // Constraint: You cannot exchange a card of the same type as one you just took
        // e.g., if you take a cloth, you cannot return a cloth.
        const takenTypes = new Set(takenCards.map(c => c.type));
        const returnedTypes = new Set(returnedCards.map(c => c.type));
        for (const type of returnedTypes) {
            if (takenTypes.has(type)) {
                throw new Error(`Cannot exchange: you are taking and returning the same card type: ${type}.`);
            }
        }

        // Validate final hand limit constraint (hand size <= 7)
        // Hand size will change by: + takenCards.length - number of hand cards returned
        const netHandChange = takenCards.length - handIndicesToRemove.length;
        if (pState.hand.length + netHandChange > 7) {
            throw new Error('Cannot exchange: final hand would exceed limit of 7 cards.');
        }

        // Perform the exchange
        // 1. Remove returned cards from hand/herd (sort indices descending to avoid shifting issues)
        handIndicesToRemove.sort((a, b) => b - a);
        for (const idx of handIndicesToRemove) {
            pState.hand.splice(idx, 1);
        }

        herdIndicesToRemove.sort((a, b) => b - a);
        for (const idx of herdIndicesToRemove) {
            pState.herd.splice(idx, 1);
        }

        // 2. Remove taken cards from market
        for (const takenCard of takenCards) {
            const idx = this.data.market.findIndex(c => c.id === takenCard.id);
            this.data.market.splice(idx, 1);
        }

        // 3. Add taken cards to player's hand
        for (const takenCard of takenCards) {
            pState.hand.push(takenCard);
        }

        // 4. Add returned cards back to market
        for (const returnedCard of returnedCards) {
            this.data.market.push(returnedCard);
        }

        // Log move
        const takenTypesStr = takenCards.map(c => c.type).join(', ');
        const returnedTypesStr = returnedCards.map(c => c.type).join(', ');
        this.log_move(
            playerId,
            'exchange',
            `exchanged [${returnedTypesStr}] for [${takenTypesStr}].`
        );

        this.pass_turn();
    }

    /**
     * Action D - Sell Cards
     */
    public sell_goods(playerId: string, sellCardType: CardType, cardIds: number[]): void {
        this.validate_turn(playerId);

        if (sellCardType === 'camels') {
            throw new Error('Camels cannot be sold.');
        }

        if (cardIds.length === 0) {
            throw new Error('Must select at least 1 card to sell.');
        }

        const pState = this.data.players[playerId];

        // Verify player actually has all these cards in hand and they match the sellCardType
        const cardsToSell: Card[] = [];
        const handIndicesToRemove: number[] = [];

        for (const cid of cardIds) {
            const idx = pState.hand.findIndex((c, i) => c.id === cid && !handIndicesToRemove.includes(i));
            if (idx === -1) {
                throw new Error('Selected card not found in hand.');
            }
            const card = pState.hand[idx];
            if (card.type !== sellCardType) {
                throw new Error('Selected card type does not match the sales category.');
            }
            handIndicesToRemove.push(idx);
            cardsToSell.push(card);
        }

        // Restrictions:
        // Expensive goods (diamonds, gold, silver) require a minimum of 2 cards.
        const isExpensive = sellCardType === 'diamonds' || sellCardType === 'gold' || sellCardType === 'silver';
        if (isExpensive && cardsToSell.length < 2) {
            throw new Error(`Selling expensive goods (${sellCardType}) requires selling at least 2 cards.`);
        }

        // Verify tokens remaining in the stack
        const stack = this.data.goodsTokens[sellCardType] || [];
        if (stack.length === 0) {
            throw new Error(`Cannot sell ${sellCardType}: token stack is completely empty.`);
        }

        // Remove cards from player's hand and move to discard pile
        handIndicesToRemove.sort((a, b) => b - a);
        for (const idx of handIndicesToRemove) {
            pState.hand.splice(idx, 1);
        }
        for (const card of cardsToSell) {
            this.data.discardPile.push(card);
        }

        // Distribute goods tokens (as many as available up to cardsToSell.length)
        const tokensAwarded: Token[] = [];
        const tokensToTake = Math.min(cardsToSell.length, stack.length);
        for (let i = 0; i < tokensToTake; i++) {
            const val = stack.shift()!;
            tokensAwarded.push({ type: sellCardType, value: val });
        }

        // Award bonus token if 3+ cards sold
        let bonusVal: number | null = null;
        let bonusTypeStr = '';
        if (cardsToSell.length >= 3) {
            let bonusPileKey: '3' | '4' | '5' = '3';
            if (cardsToSell.length === 4) {
                bonusPileKey = '4';
            } else if (cardsToSell.length >= 5) {
                bonusPileKey = '5';
            }

            const bonusPile = this.data.bonusTokens[bonusPileKey];
            if (bonusPile.length > 0) {
                bonusVal = bonusPile.shift()!;
                bonusTypeStr = `bonus${bonusPileKey}`;
                tokensAwarded.push({
                    type: bonusTypeStr,
                    value: bonusVal,
                    isBonus: true
                });
            }
        }

        // Add tokens to player and update their round rupees
        for (const token of tokensAwarded) {
            pState.tokens.push(token);
            pState.rupeesThisRound += token.value;
        }

        // Log move
        const bonusLog = bonusVal !== null ? ` + a ${bonusTypeStr} token (value ${bonusVal})` : '';
        this.log_move(
            playerId,
            'sell',
            `sold ${cardsToSell.length} ${sellCardType} for ${tokensAwarded.reduce((sum, t) => sum + t.value, 0)} rupees${bonusLog}.`
        );

        // Check if 3 stacks are depleted
        const depletedStacks = Object.entries(this.data.goodsTokens).filter(([_, list]) => list.length === 0).length;

        if (depletedStacks >= 3) {
            this.resolve_round_end();
        } else {
            this.pass_turn();
        }
    }

    /**
     * Resolves round end scoring, awards Seal of Excellence, and checks win state
     */
    public resolve_round_end(): void {
        this.data.status = GameStatus.RoundEnd;

        // 1. Award camel token (5 rupees) to player with strictly more camels in herd
        const p1 = this.playerIds[0];
        const p2 = this.playerIds[1];
        const p1Camels = this.data.players[p1].herd.length;
        const p2Camels = this.data.players[p2].herd.length;

        let camelTokenWinner: string | null = null;
        if (p1Camels > p2Camels) {
            camelTokenWinner = p1;
        } else if (p2Camels > p1Camels) {
            camelTokenWinner = p2;
        }

        if (camelTokenWinner) {
            this.data.camelTokenClaimedBy = camelTokenWinner;
            this.data.players[camelTokenWinner].tokens.push({ type: 'camel', value: 5 });
            this.data.players[camelTokenWinner].rupeesThisRound += 5;
        }

        // Calculate scores and details for both players
        const roundScores: { [playerId: string]: RoundScore } = {};
        for (const pid of this.playerIds) {
            const pState = this.data.players[pid];
            roundScores[pid] = {
                rupees: pState.rupeesThisRound,
                camels: pState.herd.length,
                seals: pState.seals,
                bonusTokenCount: pState.tokens.filter(t => t.isBonus).length,
                goodsTokenCount: pState.tokens.filter(t => !t.isBonus && t.type !== 'camel').length
            };
        }

        // 2. Richer player takes a Seal of Excellence
        const p1Score = roundScores[p1].rupees;
        const p2Score = roundScores[p2].rupees;

        let roundWinnerId: string | null = null;
        if (p1Score > p2Score) {
            roundWinnerId = p1;
        } else if (p2Score > p1Score) {
            roundWinnerId = p2;
        } else {
            // Tiebreaker 1: most bonus tokens
            const p1Bonus = roundScores[p1].bonusTokenCount;
            const p2Bonus = roundScores[p2].bonusTokenCount;
            if (p1Bonus > p2Bonus) {
                roundWinnerId = p1;
            } else if (p2Bonus > p1Bonus) {
                roundWinnerId = p2;
            } else {
                // Tiebreaker 2: most goods tokens
                const p1Goods = roundScores[p1].goodsTokenCount;
                const p2Goods = roundScores[p2].goodsTokenCount;
                if (p1Goods > p2Goods) {
                    roundWinnerId = p1;
                } else if (p2Goods > p1Goods) {
                    roundWinnerId = p2;
                } else {
                    // Still tied, no seal awarded or tie? Standard rules: share/none.
                    // We'll award to none or keep it a tie. Let's make it none (neither player takes it)
                    // but usually in Jaipur one player must win or we award no seal. Let's do no seal.
                    roundWinnerId = null;
                }
            }
        }

        if (roundWinnerId) {
            this.data.players[roundWinnerId].seals += 1;
            roundScores[roundWinnerId].seals += 1;
        }

        // Save round results
        this.data.roundResults.push({
            roundNumber: this.data.roundNumber,
            winnerId: roundWinnerId,
            scores: roundScores,
            camelTokenWinner: camelTokenWinner
        });

        // 3. Check for game end condition: First player to 2 Seals of Excellence wins
        const p1Seals = this.data.players[p1].seals;
        const p2Seals = this.data.players[p2].seals;

        if (p1Seals >= 2) {
            this.data.status = GameStatus.GameOver;
            this.data.winnerId = p1;
        } else if (p2Seals >= 2) {
            this.data.status = GameStatus.GameOver;
            this.data.winnerId = p2;
        } else if (this.data.roundNumber >= 3) {
            // Maximum of 3 rounds. If 3 rounds are done and nobody reached 2 (e.g. tie or shared seals),
            // the person with most seals wins.
            if (p1Seals > p2Seals) {
                this.data.status = GameStatus.GameOver;
                this.data.winnerId = p1;
            } else if (p2Seals > p1Seals) {
                this.data.status = GameStatus.GameOver;
                this.data.winnerId = p2;
            } else {
                // Completely tied after 3 rounds, select who won the last round, or player with higher total cumulative rupees.
                const p1TotalRupees = this.data.roundResults.reduce((sum, r) => sum + r.scores[p1].rupees, 0);
                const p2TotalRupees = this.data.roundResults.reduce((sum, r) => sum + r.scores[p2].rupees, 0);
                if (p1TotalRupees > p2TotalRupees) {
                    this.data.status = GameStatus.GameOver;
                    this.data.winnerId = p1;
                } else {
                    this.data.status = GameStatus.GameOver;
                    this.data.winnerId = p2;
                }
            }
        }
    }

    /**
     * Prepares next round
     */
    public next_round(): void {
        if (this.data.status !== GameStatus.RoundEnd) {
            throw new Error('Can only start next round when current round has ended.');
        }
        if (this.data.winnerId) {
            throw new Error('Game is over. Cannot start a new round.');
        }

        // Round increments
        this.data.roundNumber += 1;

        // Player who lost the previous round goes first.
        // Let's identify the round winner of the last round:
        const lastResult = this.data.roundResults[this.data.roundResults.length - 1];
        let nextStarter = this.playerIds[0];
        if (lastResult && lastResult.winnerId) {
            // Starters is the loser:
            nextStarter = this.playerIds.find(pid => pid !== lastResult.winnerId) || nextStarter;
        }

        // Start the game for the new round
        this.start_game(nextStarter);
    }

    private validate_turn(playerId: string): void {
        if (this.data.status !== GameStatus.Active) {
            throw new Error('Game is not currently active.');
        }
        if (playerId !== this.data.currentPlayerId) {
            throw new Error('It is not your turn to play.');
        }
    }

    private pass_turn(): void {
        const idx = this.playerIds.indexOf(this.data.currentPlayerId);
        this.data.currentPlayerId = this.playerIds[(idx + 1) % this.playerIds.length];
    }

    private log_move(playerId: string, type: string, desc: string): void {
        const moveId = Math.random().toString(36).substring(2, 9);
        this.data.lastMove = { playerId, type, desc, moveId };
    }

    private generate_deck(): Card[] {
        const deck: Card[] = [];
        let id = 1;

        for (const type of Object.keys(CARD_COUNTS)) {
            const cType = type as CardType;
            const count = CARD_COUNTS[cType];
            for (let i = 0; i < count; i++) {
                deck.push({ id: id++, type: cType });
            }
        }

        return deck;
    }

    private generate_bonus_tokens(cardsSold: 3 | 4 | 5, min: number, max: number): number[] {
        const count = 6;
        const tokens: number[] = [];
        for (let i = 0; i < count; i++) {
            const val = Math.floor(Math.random() * (max - min + 1)) + min;
            tokens.push(val);
        }
        // Shuffle the bonus pile
        this.shuffle_array(tokens);
        return tokens;
    }

    private shuffle(deck: Card[]): void {
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
    }

    private shuffle_array<T>(arr: T[]): void {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }
}
