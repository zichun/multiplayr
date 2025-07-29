/**
 * ItoGameState.ts - Standalone game state management for Ito
 *
 * This class represents the complete game state and logic for Ito,
 * independent of the multiplayr framework to enable comprehensive testing.
 */

import { Categories } from './ItoCategories';

export enum GameStatus {
    InputClues,
    Scoring,
    Victory,
    Defeat
}

export interface PlayerState {
    id: string;
    secretNumber: number;
    clue: string;
    hasLockedClue: boolean;
    lockOrder?: number; // Order in which player locked their clue (0-based)
}

export interface GameStateData {
    status: GameStatus;
    round: number;
    lives: number;
    category: string;
    players: { [playerId: string]: PlayerState };
    lockedPlayers: string[]; // Array of player IDs in lock order
}

function get_lives_from_players(player_cnt: number): number {
    return 3 + Math.ceil((player_cnt - 3) * .5);
}

export class ItoGameState {
    private data: GameStateData;
    private readonly playerIds: string[];

    constructor(playerIds: string[]) {
        if (playerIds.length < 2 || playerIds.length > 8) {
            throw new Error('Ito requires 2-8 players');
        }

        this.playerIds = [...playerIds];
        this.data = {
            status: GameStatus.InputClues,
            round: 0,
            lives: get_lives_from_players(playerIds.length),
            category: '',
            players: {},
            lockedPlayers: [],
        };

        // Initialize players
        for (const playerId of playerIds) {
            this.data.players[playerId] = {
                id: playerId,
                secretNumber: 0,
                clue: '',
                hasLockedClue: false
            };
        }
    }

    public static from_data(data: GameStateData, playerIds: string[]): ItoGameState {
        const gameState = new ItoGameState(playerIds);
        gameState.data = { ...data };
        return gameState;
    }

    public get_data(): GameStateData {
        return { ...this.data };
    }

    public start_game(): void {
        this.data.status = GameStatus.InputClues;
        this.data.round = 0;
        this.start_new_round();
    }

    private start_new_round(): void {
        // Generate unique numbers for each player
        const numbers = this.generate_unique_numbers(this.playerIds.length);
        const category = this.get_random_category();

        // Reset player states
        for (let i = 0; i < this.playerIds.length; i++) {
            const playerId = this.playerIds[i];
            this.data.players[playerId] = {
                id: playerId,
                secretNumber: numbers[i],
                clue: '',
                hasLockedClue: false
            };
        }

        this.data.category = category;
        this.data.lockedPlayers = [];
        this.data.status = GameStatus.InputClues;
    }

    public submit_clue(playerId: string, clue: string): void {
        if (this.data.status !== GameStatus.InputClues) {
            throw new Error('Cannot submit clue in current state');
        }

        if (!(playerId in this.data.players)) {
            throw new Error('Invalid player ID');
        }

        if (this.data.players[playerId].hasLockedClue) {
            throw new Error('Player has already locked their clue');
        }

        if (clue === null || clue === undefined) {
            throw new Error('Clue cannot be null or undefined');
        }

        this.data.players[playerId].clue = clue.trim();
    }

    public lock_clue(playerId: string): void {
        if (this.data.status !== GameStatus.InputClues) {
            throw new Error('Cannot lock clue in current state');
        }

        if (!(playerId in this.data.players)) {
            throw new Error('Invalid player ID');
        }

        const player = this.data.players[playerId];
        if (player.hasLockedClue) {
            throw new Error('Player has already locked their clue');
        }

        // Lock the clue
        player.hasLockedClue = true;
        player.lockOrder = this.data.lockedPlayers.length;
        this.data.lockedPlayers.push(playerId);

        // Check for immediate scoring
        this.check_immediate_scoring();

        // Check if round is complete
        if (this.data.lockedPlayers.length === this.playerIds.length) {
            this.complete_round();
        }
    }

    private check_immediate_scoring(): void {
        if (this.data.lockedPlayers.length < 2) {
            return; // Need at least 2 locked numbers to compare
        }

        const currentPlayerIndex = this.data.lockedPlayers.length - 1;
        const currentPlayerId = this.data.lockedPlayers[currentPlayerIndex];
        const previousPlayerId = this.data.lockedPlayers[currentPlayerIndex - 1];

        const currentNumber = this.data.players[currentPlayerId].secretNumber;
        const previousNumber = this.data.players[previousPlayerId].secretNumber;

        if (currentNumber < previousNumber) {
            this.data.lives--;
        }

        if (this.data.lives <= 0) {
            this.data.status = GameStatus.Scoring;
        }
    }

    private complete_round(): void {
        this.data.status = GameStatus.Scoring;
        // Don't automatically process round completion - let tests/UI control timing
    }

    private process_round_completion(): void {
        if (this.data.lives <= 0) {
            this.data.status = GameStatus.Defeat;
        } else if (this.data.round >= 2) { // Completed 3 rounds (0, 1, 2)
            this.data.status = GameStatus.Victory;
        } else {
            this.data.round++;
            this.start_new_round();
        }
    }

    public next_round(): void {
        if (this.data.lives > 0) {
            this.data.round++;
            this.start_new_round();
        }
    }

    // Method to force round completion processing (for UI layer timing)
    public force_round_completion(): void {
        if (this.data.status === GameStatus.Scoring) {
            this.process_round_completion();
        }
    }

    public restart_game(): void {
        this.data.status = GameStatus.InputClues;
        this.data.round = 0;
        this.data.lives = get_lives_from_players(this.playerIds.length);
        this.start_new_round();
    }

    private generate_unique_numbers(count: number): number[] {
        const numbers = [];
        const used = new Set<number>();

        while (numbers.length < count) {
            const num = Math.floor(Math.random() * 100) + 1; // 1-100
            if (!used.has(num)) {
                used.add(num);
                numbers.push(num);
            }
        }

        return numbers;
    }

    private get_random_category(): string {
        return Categories[Math.floor(Math.random() * Categories.length)];
    }

    // Getters for accessing game state
    public get_status(): GameStatus {
        return this.data.status;
    }

    public get_round(): number {
        return this.data.round;
    }

    public get_lives(): number {
        return this.data.lives;
    }

    public get_category(): string {
        return this.data.category;
    }

    public get_player_data(playerId: string): PlayerState | undefined {
        return this.data.players[playerId];
    }

    public get_all_players(): PlayerState[] {
        return this.playerIds.map(id => this.data.players[id]);
    }

    public get_clues(): { [playerId: string]: string } {
        return Object.fromEntries(
            this.playerIds.map(id => [id, this.data.players[id].clue]));
    }

    public get_locked_data(): object[] {
        return this.data.lockedPlayers.map(id => {
            const data = this.get_player_data(id);
            return {
                "clientId": id,
                "clue": data.clue,
                "secretNumber": data.secretNumber
            };
        });
    }

    public get_locked_players(): string[] {
        return [...this.data.lockedPlayers];
    }

    public get_player_ids(): string[] {
        return [...this.playerIds];
    }
}
