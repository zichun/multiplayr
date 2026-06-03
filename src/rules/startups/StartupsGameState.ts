/**
 * StartupsGameState.ts - Standalone game state management for Startups
 */

import { shuffle } from '../../common/utils';

export enum GameStatus {
    ActionPhase = 'ActionPhase',
    DiscardOrInvestPhase = 'DiscardOrInvestPhase',
    ScoringPhase = 'ScoringPhase',
    GameOver = 'GameOver'
}

export enum Company {
    Giraffe = 'Giraffe Beer',
    Bowwow = 'Bowwow Games',
    Flamingo = 'Flamingo Soft',
    Octo = 'Octo Coffee',
    Hippo = 'Hippo Powertech',
    Elephant = 'Elephant Mars Travel'
}

export const COMPANIES = [
    Company.Giraffe,
    Company.Bowwow,
    Company.Flamingo,
    Company.Octo,
    Company.Hippo,
    Company.Elephant
];

export const COMPANY_COUNTS: { [key in Company]: number } = {
    [Company.Giraffe]: 5,
    [Company.Bowwow]: 6,
    [Company.Flamingo]: 7,
    [Company.Octo]: 8,
    [Company.Hippo]: 9,
    [Company.Elephant]: 10
};

export const COMPANY_COLORS: { [key in Company]: string } = {
    [Company.Giraffe]: '#f39c12',  // Gold/Giraffe
    [Company.Bowwow]: '#2ecc71',   // Mint/Green
    [Company.Flamingo]: '#e74c3c', // Flamingo Pink/Red
    [Company.Octo]: '#9b59b6',     // Coffee/Purple
    [Company.Hippo]: '#f1c40f',    // Power/Yellow
    [Company.Elephant]: '#3498db'  // Mars/Blue
};

export interface MarketCard {
    id: string;
    company: Company;
    coins: number;
}

export interface PlayerState {
    id: string;
    hand: Company[];
    portfolio: { [key in Company]?: number };
    coins1: number; // 1-point coins in supply
    coins3: number; // 3-point coins in supply (received during scoring)
}

export interface GameStateData {
    status: GameStatus;
    deck: Company[];
    removedCards: Company[];
    market: MarketCard[];
    players: { [playerId: string]: PlayerState };
    currentPlayerIndex: number;
    lastTakenFromMarketCompany: Company | null;
    scoringCompanyIndex: number;
    scoringLogs: string[];
    antiMonopolyTokens: { [key in Company]?: string | null };
}

export class StartupsGameState {
    private data: GameStateData;
    private readonly playerIds: string[];

    constructor(playerIds: string[]) {
        this.playerIds = [...playerIds];
        this.data = {
            status: GameStatus.ActionPhase,
            deck: [],
            removedCards: [],
            market: [],
            players: {},
            currentPlayerIndex: 0,
            lastTakenFromMarketCompany: null,
            scoringCompanyIndex: 0,
            scoringLogs: [],
            antiMonopolyTokens: {}
        };

        // Initialize players
        for (const playerId of playerIds) {
            this.data.players[playerId] = {
                id: playerId,
                hand: [],
                portfolio: {},
                coins1: 10,
                coins3: 0
            };
        }

        // Initialize Anti-Monopoly tokens to empty
        for (const company of COMPANIES) {
            this.data.antiMonopolyTokens[company] = null;
        }
    }

    public static from_data(data: GameStateData, playerIds: string[]): StartupsGameState {
        const gameState = new StartupsGameState(playerIds);
        gameState.data = { ...data };
        return gameState;
    }

    public get_data(): GameStateData {
        return { ...this.data };
    }

    public get_player_ids(): string[] {
        return [...this.playerIds];
    }

    public start_game(): void {
        this.data.status = GameStatus.ActionPhase;
        this.data.market = [];
        this.data.currentPlayerIndex = 0;
        this.data.lastTakenFromMarketCompany = null;
        this.data.scoringCompanyIndex = 0;
        this.data.scoringLogs = [];

        // Build deck
        const fullDeck: Company[] = [];
        for (const company of COMPANIES) {
            const count = COMPANY_COUNTS[company];
            for (let i = 0; i < count; i++) {
                fullDeck.push(company);
            }
        }

        shuffle(fullDeck);

        // Deal 3 cards to each player
        for (const playerId of this.playerIds) {
            this.data.players[playerId] = {
                id: playerId,
                hand: [fullDeck.pop()!, fullDeck.pop()!, fullDeck.pop()!],
                portfolio: {},
                coins1: 10,
                coins3: 0
            };
        }

        // Remove 5 cards
        const removed: Company[] = [];
        for (let i = 0; i < 5; i++) {
            removed.push(fullDeck.pop()!);
        }
        this.data.removedCards = removed;

        // The rest is the deck
        this.data.deck = fullDeck;

        // Reassign anti monopoly tokens
        this.reassign_anti_monopoly_tokens();
    }

    public draw_from_deck(playerId: string): void {
        this.validate_turn(playerId);
        if (this.data.status !== GameStatus.ActionPhase) {
            throw new Error('Not in Action Phase');
        }
        if (this.data.deck.length === 0) {
            throw new Error('Deck is empty');
        }

        const player = this.data.players[playerId];

        // Calculate cost to draw
        let cost = 0;
        for (const marketCard of this.data.market) {
            const tokenHolder = this.data.antiMonopolyTokens[marketCard.company];
            if (tokenHolder !== playerId) {
                cost++;
            }
        }

        if (player.coins1 < cost) {
            throw new Error('Not enough coins to draw from deck. You are forced to take from the market instead.');
        }

        // 1. Pay into market first
        for (const marketCard of this.data.market) {
            const tokenHolder = this.data.antiMonopolyTokens[marketCard.company];
            if (tokenHolder === playerId) {
                // Exempt from paying for this company
                continue;
            }

            // Must pay 1 coin
            player.coins1--;
            marketCard.coins++;
        }

        // 2. Draw card
        const drawnCard = this.data.deck.pop()!;
        player.hand.push(drawnCard);

        // Transition to DiscardOrInvest
        this.data.lastTakenFromMarketCompany = null;
        this.data.status = GameStatus.DiscardOrInvestPhase;
    }

    public take_from_market(playerId: string, marketCardId: string): void {
        this.validate_turn(playerId);
        if (this.data.status !== GameStatus.ActionPhase) {
            throw new Error('Not in Action Phase');
        }

        const cardIndex = this.data.market.findIndex(c => c.id === marketCardId);
        if (cardIndex === -1) {
            throw new Error('Card not found in market');
        }

        const card = this.data.market[cardIndex];
        const tokenHolder = this.data.antiMonopolyTokens[card.company];
        if (tokenHolder === playerId) {
            throw new Error('Cannot take card from company you hold Anti-Monopoly token for');
        }

        // Remove from market
        this.data.market.splice(cardIndex, 1);

        // Add to hand and claim coins
        const player = this.data.players[playerId];
        player.hand.push(card.company);
        player.coins1 += card.coins;

        // Transition to DiscardOrInvest
        this.data.lastTakenFromMarketCompany = card.company;
        this.data.status = GameStatus.DiscardOrInvestPhase;
    }

    public invest_card(playerId: string, company: Company): void {
        this.validate_turn(playerId);
        if (this.data.status !== GameStatus.DiscardOrInvestPhase) {
            throw new Error('Not in Discard or Invest Phase');
        }

        const player = this.data.players[playerId];
        const cardIndex = player.hand.indexOf(company);
        if (cardIndex === -1) {
            throw new Error(`Player does not have ${company} in hand`);
        }

        // Remove from hand and add to portfolio
        player.hand.splice(cardIndex, 1);
        player.portfolio[company] = (player.portfolio[company] || 0) + 1;

        // Reassign anti monopoly
        this.reassign_anti_monopoly_tokens();

        this.check_end_turn();
    }

    public discard_card(playerId: string, company: Company): void {
        this.validate_turn(playerId);
        if (this.data.status !== GameStatus.DiscardOrInvestPhase) {
            throw new Error('Not in Discard or Invest Phase');
        }

        if (company === this.data.lastTakenFromMarketCompany) {
            throw new Error('Illegal move: Cannot immediately discard the same company took from the market');
        }

        const player = this.data.players[playerId];
        const cardIndex = player.hand.indexOf(company);
        if (cardIndex === -1) {
            throw new Error(`Player does not have ${company} in hand`);
        }

        // Remove from hand and place in market
        player.hand.splice(cardIndex, 1);
        this.data.market.push({
            id: Math.random().toString(36).substring(2, 9),
            company,
            coins: 0
        });

        this.check_end_turn();
    }

    public next_scoring_company(playerNames?: { [playerId: string]: string }): void {
        if (this.data.status !== GameStatus.ScoringPhase) {
            throw new Error('Not in Scoring Phase');
        }

        if (this.data.scoringCompanyIndex >= COMPANIES.length) {
            this.data.status = GameStatus.GameOver;
            return;
        }

        const company = COMPANIES[this.data.scoringCompanyIndex];
        const cardCounts: { [playerId: string]: number } = {};

        for (const playerId of this.playerIds) {
            cardCounts[playerId] = this.data.players[playerId].portfolio[company] || 0;
        }

        // Find max share count
        let maxShares = 0;
        for (const playerId of this.playerIds) {
            if (cardCounts[playerId] > maxShares) {
                maxShares = cardCounts[playerId];
            }
        }

        if (maxShares === 0) {
            this.data.scoringLogs.push(`--- ${company} --- \nNo shares were held by any player. No payouts.`);
            this.data.scoringCompanyIndex++;
            if (this.data.scoringCompanyIndex >= COMPANIES.length) {
                this.data.status = GameStatus.GameOver;
            }
            return;
        }

        // Find majority shareholders
        const majorityShareholders = this.playerIds.filter(id => cardCounts[id] === maxShares);

        if (majorityShareholders.length > 1) {
            const list = majorityShareholders.map(id => this.get_player_name(id, playerNames)).join(', ');
            this.data.scoringLogs.push(`--- ${company} --- \nTie for majority between: ${list} (${maxShares} cards each). No payouts for this company.`);
        } else {
            const majorityHolderId = majorityShareholders[0];
            const majorityHolder = this.data.players[majorityHolderId];
            const majorityName = this.get_player_name(majorityHolderId, playerNames);

            this.data.scoringLogs.push(`--- ${company} --- \nMajority Shareholder: ${majorityName} with ${maxShares} shares!`);

            // Every other player holding at least 1 card pays
            for (const playerId of this.playerIds) {
                if (playerId === majorityHolderId) {
                    continue;
                }

                const cShares = cardCounts[playerId];
                if (cShares > 0) {
                    const payer = this.data.players[playerId];
                    const payerName = this.get_player_name(playerId, playerNames);
                    const amount = cShares; // 1 coin per card

                    // Calculate strict payment math
                    const paid1 = Math.min(payer.coins1, amount);
                    payer.coins1 -= paid1;
                    majorityHolder.coins3 += paid1;

                    const rem = amount - paid1;
                    let covered = 0;
                    let uncovered = 0;

                    if (rem > 0) {
                        covered = Math.min(payer.coins3, rem);
                        majorityHolder.coins3 += covered;

                        uncovered = rem - covered;
                        // The bank pays the uncovered rest, but no debt is applied to the payer
                        majorityHolder.coins3 += uncovered;
                    }

                    let payLog = `${payerName} holds ${cShares} shares and pays ${amount} coins. `;
                    if (paid1 > 0) {
                        payLog += `Paid ${paid1} from supply. `;
                    }
                    if (covered > 0) {
                        payLog += `Covered ${covered} with 3-coins (from bank). `;
                    }
                    if (uncovered > 0) {
                        payLog += `Covered the remaining ${uncovered} (from bank). `;
                    }
                    this.data.scoringLogs.push(payLog);
                }
            }
        }

        this.data.scoringCompanyIndex++;
        if (this.data.scoringCompanyIndex >= COMPANIES.length) {
            this.data.status = GameStatus.GameOver;
        }
    }

    public restart_game(): void {
        this.start_game();
    }

    private validate_turn(playerId: string): void {
        const expectedPlayerId = this.playerIds[this.data.currentPlayerIndex];
        if (playerId !== expectedPlayerId) {
            throw new Error(`It is not ${playerId}'s turn (Current: ${expectedPlayerId})`);
        }
    }

    private reassign_anti_monopoly_tokens(): void {
        for (const company of COMPANIES) {
            let maxCount = 0;
            for (const playerId of this.playerIds) {
                const count = this.data.players[playerId].portfolio[company] || 0;
                if (count > maxCount) {
                    maxCount = count;
                }
            }

            if (maxCount === 0) {
                this.data.antiMonopolyTokens[company] = null;
                continue;
            }

            const topPlayers = this.playerIds.filter(
                id => (this.data.players[id].portfolio[company] || 0) === maxCount
            );

            if (topPlayers.length === 1) {
                // Strictly most
                this.data.antiMonopolyTokens[company] = topPlayers[0];
            } else {
                // Tie: goes back to center
                this.data.antiMonopolyTokens[company] = null;
            }
        }
    }

    private check_end_turn(): void {
        if (this.data.deck.length === 0) {
            // Deck is empty! Finish the current draw action, then immediately reveal hands and score!
            this.end_game_and_reveal_hands();
        } else {
            // Normal turn cycle
            this.data.currentPlayerIndex = (this.data.currentPlayerIndex + 1) % this.playerIds.length;
            this.data.lastTakenFromMarketCompany = null;
            this.data.status = GameStatus.ActionPhase;
        }
    }

    private end_game_and_reveal_hands(): void {
        this.data.status = GameStatus.ScoringPhase;
        this.data.scoringCompanyIndex = 0;
        this.data.scoringLogs = [];

        // All players reveal their hands and add to their face-up portfolios
        for (const playerId of this.playerIds) {
            const player = this.data.players[playerId];
            for (const card of player.hand) {
                player.portfolio[card] = (player.portfolio[card] || 0) + 1;
            }
            player.hand = [];
        }

        // Reassign one last time for correct visual representation
        this.reassign_anti_monopoly_tokens();
    }

    private get_player_name(playerId: string, playerNames?: { [playerId: string]: string }): string {
        if (playerNames && playerNames[playerId]) {
            return playerNames[playerId];
        }
        return playerId;
    }
}
