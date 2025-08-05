/**
 * CatchSketchGameState.ts - Standalone game state management for Catch Sketch
 *
 * This class represents the complete game state and logic for Catch Sketch,
 * independent of the multiplayr framework to enable comprehensive testing.
 */

import { Words } from './CatchSketchWords';

export interface PlayerState {
    id: string;
    score: number;
    hasLocked: boolean;
    tokenNumber?: number; // 1 or 2, undefined if no token
    turnOrder?: number; // 1, 2, 3, etc. for guessing order
}

export interface GuessData {
    playerId: string;
    guess: string;
    isCorrect: boolean;
}

export interface GameStateData {
    round: number;
    currentGuesserId: string;
    secretWord: string;
    players: { [playerId: string]: PlayerState };
    guesses: GuessData[];
    tokensClaimed: number; // 0, 1, or 2
    turnOrder: string[]; // player IDs in guessing turn order
    roundStartTimestamp: number;
    firstTokenTimeStamp: number;
}

export class CatchSketchGameState {
    private data: GameStateData;
    private readonly playerIds: string[];

    constructor(playerIds: string[]) {
        if (playerIds.length < 3) {
            throw new Error('Catch Sketch requires at least 3 players');
        }

        this.playerIds = [...playerIds];
        this.data = {
            round: 0,
            currentGuesserId: playerIds[0], // First player starts as guesser
            secretWord: '',
            players: {},
            guesses: [],
            tokensClaimed: 0,
            turnOrder: [],
            roundStartTimestamp: Date.now(),
            firstTokenTimeStamp: Date.now(),
        };

        // Initialize players
        for (const playerId of playerIds) {
            this.data.players[playerId] = {
                id: playerId,
                score: 0,
                hasLocked: false
            };
        }
    }

    public static from_data(data: GameStateData, playerIds: string[]): CatchSketchGameState {
        const gameState = new CatchSketchGameState(playerIds);
        gameState.data = { ...data };
        return gameState;
    }

    public get_data(): GameStateData {
        return { ...this.data };
    }

    public start_game(): void {
        this.start_new_round();
    }

    private start_new_round(): void {
        const secretWord = this.generate_secret_word();

        // Reset round state
        this.data.secretWord = secretWord;
        this.data.guesses = [];
        this.data.tokensClaimed = 0;
        this.data.turnOrder = [];
        this.data.roundStartTimestamp = Date.now();

        // Reset player round state (keep scores)
        for (const playerId of this.playerIds) {
            const player = this.data.players[playerId];
            player.hasLocked = false;
            delete player.tokenNumber;
            delete player.turnOrder;
        }
    }

    public lock_token(playerId: string, tokenNumber: 1 | 2): number {
        if (!this.is_drawing_phase()) {
            return 0;
        }
        if (playerId === this.data.currentGuesserId) {
            throw new Error('Guesser cannot draw or lock tokens');
        }

        const player = this.data.players[playerId];
        if (!player) {
            throw new Error('Invalid player ID');
        }

        if (player.hasLocked) {
            throw new Error('Player has already locked');
        }

        if (this.data.tokensClaimed >= 2) {
            throw new Error('All tokens have been claimed');
        }

        if (this.data.tokensClaimed === 0) {
            this.data.firstTokenTimeStamp = Date.now();
        }

        // Check if token is already taken
        for (const otherPlayer of Object.values(this.data.players)) {
            if (otherPlayer.tokenNumber === tokenNumber) {
                throw new Error(`Token ${tokenNumber} is already claimed`);
            }
        }

        // Lock the player and assign token
        player.hasLocked = true;
        player.tokenNumber = tokenNumber;
        player.turnOrder = tokenNumber;
        this.data.tokensClaimed++;

        // If both tokens are claimed, assign random order to remaining players
        if (this.data.tokensClaimed === 2) {
            this.assign_remaining_turn_order();
        }

        return this.data.tokensClaimed;
    }

    public get_token_ownership(): { [token: number]: string | null } {
        const tokenOwnership: { [token: number]: string | null } = { 1: null, 2: null };
        for (const playerId of this.get_player_ids()) {
            const player = this.get_player_data(playerId);
            if (player?.tokenNumber) {
                tokenOwnership[player.tokenNumber] = playerId;
            }
        }
        return tokenOwnership;
    }

    public force_assign_token(): boolean {
        if (!this.is_drawing_phase()) {
            return false;
        }

        if (this.data.tokensClaimed !== 1) {
            return false;
        }

        const drawers = this.get_drawers();
        const unlockedDrawers = drawers.filter(id => !this.data.players[id].hasLocked);
        const shuffled = [...unlockedDrawers].sort(() => Math.random() - 0.5);
        const tokenOwnership = this.get_token_ownership();

        if (shuffled.length > 0) {
            this.lock_token(shuffled[0], tokenOwnership[1] ? 2 : 1);
        }
        return true;
    }

    private assign_remaining_turn_order(): void {
        const drawers = this.get_drawers();
        const unlockedDrawers = drawers.filter(id => !this.data.players[id].hasLocked);

        // Shuffle remaining players for turn order 3+
        const shuffled = [...unlockedDrawers].sort(() => Math.random() - 0.5);

        let nextOrder = this.data.tokensClaimed + 1;
        for (const playerId of shuffled) {
            const player = this.data.players[playerId];
            player.hasLocked = true; // Mark as locked even without token
            player.turnOrder = nextOrder++;
        }

        // Create final turn order array
        this.create_turn_order();
    }

    private create_turn_order(): void {
        const drawers = this.get_drawers();
        const orderedDrawers = drawers
            .filter(id => this.data.players[id].turnOrder !== undefined)
            .sort((a, b) => this.data.players[a].turnOrder! - this.data.players[b].turnOrder!);

        this.data.turnOrder = orderedDrawers;
    }

    public submit_guess(playerId: string, guess: string): boolean {
        if (playerId !== this.data.currentGuesserId) {
            throw new Error('Only the current guesser can submit guesses');
        }

        if (!this.is_guessing_phase()) {
            throw new Error('Not in guessing phase');
        }

        const trimmedGuess = guess.trim().toLowerCase();
        const isCorrect = trimmedGuess === this.data.secretWord.toLowerCase();

        this.data.guesses.push({
            playerId,
            guess: trimmedGuess,
            isCorrect
        });

        if (isCorrect) {
            this.award_points();
            return true;
        }

        return false;
    }

    private award_points(): void {
        const guesser = this.data.players[this.data.currentGuesserId];
        const guess_cnt = this.data.guesses.length;
        const drawing_cnt = this.data.turnOrder.length;

        let score = 0;
        if (drawing_cnt === 2) {
            score = (guess_cnt === 1 ? 3 : 1);
        } else {
            score = guess_cnt === 1 ? 3 :
                    guess_cnt === 2 ? 2 : 1;
        }
        guesser.score += score;

        const currentDrawerIndex = this.data.guesses.length - 1;
        if (currentDrawerIndex < this.data.turnOrder.length) {
            const currentDrawerId = this.data.turnOrder[currentDrawerIndex];
            const drawer = this.data.players[currentDrawerId];
            drawer.score += score;
        }
    }

    public next_round(): boolean {
        if (!this.is_review_phase()) {
            // Can't start a round if not review phase
            return false;
        }

        this.data.round++;

        // Rotate guesser
        const currentGuesserIndex = this.playerIds.indexOf(this.data.currentGuesserId);
        const nextGuesserIndex = (currentGuesserIndex + 1) % this.playerIds.length;
        this.data.currentGuesserId = this.playerIds[nextGuesserIndex];

        this.start_new_round();
        return true;
    }

    private generate_secret_word(): string {
        return Words[Math.floor(Math.random() * Words.length)];
    }

    // Phase detection methods
    public is_drawing_phase(): boolean {
        return this.data.tokensClaimed < 2 || this.data.turnOrder.length === 0;
    }

    public is_guessing_phase(): boolean {
        return this.data.turnOrder.length > 0 &&
               this.data.guesses.length < this.data.turnOrder.length &&
               !this.has_correct_guess();
    }

    public is_review_phase(): boolean {
        return this.data.turnOrder.length > 0 &&
               (this.has_correct_guess() || this.data.guesses.length >= this.data.turnOrder.length);
    }

    private has_correct_guess(): boolean {
        return this.data.guesses.some(g => g.isCorrect);
    }

    // Getters
    public get_round(): number {
        return this.data.round;
    }

    public get_current_guesser(): string {
        return this.data.currentGuesserId;
    }

    public get_secret_word(): string {
        return this.data.secretWord;
    }

    public get_drawers(): string[] {
        return this.playerIds.filter(id => id !== this.data.currentGuesserId);
    }

    public get_player_data(playerId: string): PlayerState | undefined {
        return this.data.players[playerId];
    }

    public get_all_players(): PlayerState[] {
        return this.playerIds.map(id => this.data.players[id]);
    }

    public get_tokens_claimed(): number {
        return this.data.tokensClaimed;
    }

    public get_turn_order(): string[] {
        return [...this.data.turnOrder];
    }

    public get_guesses(): GuessData[] {
        return [...this.data.guesses];
    }

    public get_round_start_time(): number {
        return this.data.roundStartTimestamp;
    }

    public get_first_token_time(): number {
        return this.data.firstTokenTimeStamp;
    }

    public get_token_timer_ms(): number {
        const player_cnt = Object.keys(this.data.players).length;
        if (player_cnt <= 3) {
            return 10000;
        } else {
            return 30000;
        }
    }

    public get_current_drawing_player(): string | null {
        if (!this.is_guessing_phase()) {
            return null;
        }

        const currentGuessIndex = this.data.guesses.length;
        if (currentGuessIndex < this.data.turnOrder.length) {
            return this.data.turnOrder[currentGuessIndex];
        }

        return null;
    }

    public get_player_ids(): string[] {
        return [...this.playerIds];
    }

    public get_scores(): { [playerId: string]: number } {
        const scores: { [playerId: string]: number } = {};
        for (const playerId of this.playerIds) {
            scores[playerId] = this.data.players[playerId].score;
        }
        return scores;
    }
}
