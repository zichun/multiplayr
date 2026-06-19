/**
 * MaskmenGameState.ts - Standalone game state management for Maskmen
 */

import { shuffle } from '../../common/utils';

export enum WrestlerColor {
    Pink = 'Pink',
    Green = 'Green',
    Yellow = 'Yellow',
    Blue = 'Blue',
    Purple = 'Purple',
    Orange = 'Orange'
}

export enum GameStatus {
    Playing = 'Playing',
    SeasonEnd = 'SeasonEnd',
    GameOver = 'GameOver'
}

export interface PlayerState {
    id: string;
    hand: WrestlerColor[];
    score: number;
    outOrder: number;
    seasonsWon: number;
}

export interface PlayRecord {
    playerId: string;
    wrestler: WrestlerColor;
    cardCount: number;
    playType: 'Lead' | 'OptionA' | 'OptionB';
}

export interface GameStateData {
    status: GameStatus;
    season: number;
    players: { [playerId: string]: PlayerState };
    playerIds: string[];
    currentPlayerIndex: number;
    lastTrickWinnerId: string | null;
    startingPlayerForSeasonId: string | null;

    currentTrick: {
        leaderId: string;
        plays: PlayRecord[];
        passedPlayers: string[];
    };

    comparisonEdges: [WrestlerColor, WrestlerColor][];
    cumulativeCounts: { [key in WrestlerColor]: number };

    lastMove: {
        playerId: string;
        action: 'play' | 'pass' | 'startSeason';
        wrestler?: WrestlerColor;
        cardCount?: number;
        moveId: string;
    } | null;
}

/**
 * Computes transitive reachability between wrestlers based on comparison edges.
 * u -> v means u is directly established as stronger than v.
 */
export function computeReachability(
    edges: [WrestlerColor, WrestlerColor][]
): (u: WrestlerColor, v: WrestlerColor) => boolean {
    const adj = new Map<WrestlerColor, Set<WrestlerColor>>();
    const colors = Object.values(WrestlerColor);
    for (const c of colors) {
        adj.set(c, new Set<WrestlerColor>());
    }
    for (const [stronger, weaker] of edges) {
        adj.get(stronger)!.add(weaker);
    }

    const reachable = new Map<WrestlerColor, Set<WrestlerColor>>();
    for (const c of colors) {
        reachable.set(c, new Set<WrestlerColor>());
    }

    for (const start of colors) {
        const visited = new Set<WrestlerColor>();
        const queue: WrestlerColor[] = [start];
        visited.add(start);

        while (queue.length > 0) {
            const curr = queue.shift()!;
            for (const neighbor of adj.get(curr)!) {
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    reachable.get(start)!.add(neighbor);
                    queue.push(neighbor);
                }
            }
        }
    }

    return (u: WrestlerColor, v: WrestlerColor) => {
        return reachable.get(u)!.has(v);
    };
}

/**
 * Checks if wrestler u is known to be stronger than wrestler v.
 */
export function isStrongerThan(
    u: WrestlerColor,
    v: WrestlerColor,
    edges: [WrestlerColor, WrestlerColor][],
    counts: { [key in WrestlerColor]: number }
): boolean {
    if (u === v) return false;
    if (counts[u] === counts[v]) return false; // Equal counts = equal/parallel rank

    if (counts[u] > counts[v]) {
        const isReachable = computeReachability(edges);
        return isReachable(u, v);
    }

    return false;
}

export class MaskmenGameState {
    private data: GameStateData;
    private readonly playerIds: string[];

    constructor(playerIds: string[]) {
        this.playerIds = [...playerIds];
        this.data = {
            status: GameStatus.Playing,
            season: 1,
            players: {},
            playerIds: [...playerIds],
            currentPlayerIndex: 0,
            lastTrickWinnerId: null,
            startingPlayerForSeasonId: null,
            currentTrick: {
                leaderId: '',
                plays: [],
                passedPlayers: []
            },
            comparisonEdges: [],
            cumulativeCounts: {
                [WrestlerColor.Pink]: 0,
                [WrestlerColor.Green]: 0,
                [WrestlerColor.Yellow]: 0,
                [WrestlerColor.Blue]: 0,
                [WrestlerColor.Purple]: 0,
                [WrestlerColor.Orange]: 0
            },
            lastMove: null
        };

        for (const playerId of playerIds) {
            this.data.players[playerId] = {
                id: playerId,
                hand: [],
                score: 0,
                outOrder: 0,
                seasonsWon: 0
            };
        }
    }

    public static from_data(data: GameStateData, playerIds: string[]): MaskmenGameState {
        const gameState = new MaskmenGameState(playerIds);
        gameState.data = JSON.parse(JSON.stringify(data)); // Deep copy
        return gameState;
    }

    public get_data(): GameStateData {
        return JSON.parse(JSON.stringify(this.data));
    }

    public get_player_ids(): string[] {
        return [...this.playerIds];
    }

    public start_game(): void {
        for (const id of this.playerIds) {
            this.data.players[id].score = 0;
            this.data.players[id].seasonsWon = 0;
        }
        this.data.startingPlayerForSeasonId = null;
        this.start_season(1);
    }

    public start_season(seasonNumber: number): void {
        this.data.status = GameStatus.Playing;
        this.data.season = seasonNumber;
        this.data.lastTrickWinnerId = null;

        // Clear hands and out order
        for (const id of this.playerIds) {
            this.data.players[id].hand = [];
            this.data.players[id].outOrder = 0;
        }

        // Create 60 card deck
        const fullDeck: WrestlerColor[] = [];
        const colors = Object.values(WrestlerColor);
        for (const color of colors) {
            for (let i = 0; i < 10; i++) {
                fullDeck.push(color);
            }
        }

        shuffle(fullDeck);

        // Determine hand size
        const playerCount = this.playerIds.length;
        let handSize = 15;
        if (playerCount === 5) {
            handSize = 12;
        } else if (playerCount >= 6) {
            handSize = 10;
        }

        // Deal cards
        for (const id of this.playerIds) {
            const hand: WrestlerColor[] = [];
            for (let i = 0; i < handSize; i++) {
                hand.push(fullDeck.pop()!);
            }
            // Sort hand by color for ease of use
            this.data.players[id].hand = hand.sort();
        }

        // Reset season strength tracking
        this.data.comparisonEdges = [];
        this.data.cumulativeCounts = {
            [WrestlerColor.Pink]: 0,
            [WrestlerColor.Green]: 0,
            [WrestlerColor.Yellow]: 0,
            [WrestlerColor.Blue]: 0,
            [WrestlerColor.Purple]: 0,
            [WrestlerColor.Orange]: 0
        };

        // Determine who goes first
        let firstPlayerId = this.data.startingPlayerForSeasonId;
        if (!firstPlayerId || !this.playerIds.includes(firstPlayerId)) {
            firstPlayerId = this.playerIds[0];
        }

        this.data.currentTrick = {
            leaderId: firstPlayerId,
            plays: [],
            passedPlayers: []
        };
        this.data.currentPlayerIndex = this.playerIds.indexOf(firstPlayerId);
        this.data.lastMove = {
            playerId: firstPlayerId,
            action: 'startSeason',
            moveId: Math.random().toString(36).substring(2, 9)
        };
    }

    public is_stronger(u: WrestlerColor, v: WrestlerColor): boolean {
        return isStrongerThan(u, v, this.data.comparisonEdges, this.data.cumulativeCounts);
    }

    public play_cards(playerId: string, wrestler: WrestlerColor, count: number): void {
        this.validate_turn(playerId);

        if (this.data.status !== GameStatus.Playing) {
            throw new Error('Game is not in Playing status');
        }

        if (count < 1 || count > 3) {
            throw new Error('Must play between 1 and 3 cards');
        }

        const player = this.data.players[playerId];
        const handCount = player.hand.filter(c => c === wrestler).length;
        if (handCount < count) {
            throw new Error(`Not enough ${wrestler} cards in hand (Have: ${handCount}, Played: ${count})`);
        }

        const plays = this.data.currentTrick.plays;
        const isFirstPlay = plays.length === 0;
        const totalCumulativePlayed = Object.values(this.data.cumulativeCounts).reduce((a, b) => a + b, 0);
        const isFirstTrickOfSeason = totalCumulativePlayed === 0;

        let playType: 'Lead' | 'OptionA' | 'OptionB';

        if (isFirstPlay) {
            if (isFirstTrickOfSeason && count !== 1) {
                throw new Error('First trick of a season must be led with exactly 1 card');
            }
            playType = 'Lead';
        } else {
            const lastPlay = plays[plays.length - 1];
            const prevWrestler = lastPlay.wrestler;
            const X = lastPlay.cardCount;

            if (wrestler === prevWrestler) {
                throw new Error('Cannot play the same wrestler as the previous play');
            }

            if (this.is_stronger(prevWrestler, wrestler)) {
                throw new Error(`Cannot play a weaker wrestler (${wrestler} is weaker than ${prevWrestler})`);
            }

            const knownStronger = this.is_stronger(wrestler, prevWrestler);

            if (knownStronger) {
                if (count < X) {
                    throw new Error(`Must play at least ${X} cards of a known-stronger wrestler`);
                }
                playType = 'OptionB';
            } else {
                if (count < X + 1) {
                    throw new Error(`Must play at least ${X + 1} cards to introduce/promote this wrestler`);
                }
                playType = 'OptionA';
            }
        }

        // Deduct from player's hand
        let removed = 0;
        player.hand = player.hand.filter(c => {
            if (c === wrestler && removed < count) {
                removed++;
                return false;
            }
            return true;
        });

        // Record play
        plays.push({
            playerId,
            wrestler,
            cardCount: count,
            playType
        });

        // Update cumulative counts and comparison edges immediately
        this.data.cumulativeCounts[wrestler] += count;
        if (plays.length > 1) {
            const prevPlay = plays[plays.length - 2];
            if (playType === 'OptionA') {
                const exists = this.data.comparisonEdges.some(
                    ([s, w]) => s === wrestler && w === prevPlay.wrestler
                );
                if (!exists) {
                    this.data.comparisonEdges.push([wrestler, prevPlay.wrestler]);
                }
            }
        }

        this.data.lastMove = {
            playerId,
            action: 'play',
            wrestler,
            cardCount: count,
            moveId: Math.random().toString(36).substring(2, 9)
        };

        // Check if player went out
        if (player.hand.length === 0) {
            const outCount = this.get_out_players_count() + 1;
            player.outOrder = outCount;

            const activeCount = this.get_active_players_count();
            if (activeCount <= 1) {
                this.end_season();
                return;
            } else {
                this.end_trick();
                return;
            }
        }

        this.advance_turn();
    }

    public pass_turn(playerId: string): void {
        this.validate_turn(playerId);

        if (this.data.status !== GameStatus.Playing) {
            throw new Error('Game is not in Playing status');
        }

        if (this.data.currentTrick.plays.length === 0) {
            throw new Error('Cannot pass on a lead play');
        }

        if (this.data.currentTrick.passedPlayers.includes(playerId)) {
            throw new Error('Player has already passed this trick');
        }

        this.data.currentTrick.passedPlayers.push(playerId);

        this.data.lastMove = {
            playerId,
            action: 'pass',
            moveId: Math.random().toString(36).substring(2, 9)
        };

        this.advance_turn();
    }

    private advance_turn(): void {
        const activeNotPassed = this.playerIds.filter(id => {
            const p = this.data.players[id];
            const isOut = p.outOrder > 0;
            const passed = this.data.currentTrick.passedPlayers.includes(id);
            return !isOut && !passed;
        });

        if (activeNotPassed.length <= 1) {
            this.end_trick();
            return;
        }

        const total = this.playerIds.length;
        let index = this.data.currentPlayerIndex;

        for (let i = 0; i < total; i++) {
            index = (index + 1) % total;
            const nextId = this.playerIds[index];
            const nextPlayer = this.data.players[nextId];
            const hasPassed = this.data.currentTrick.passedPlayers.includes(nextId);
            const isOut = nextPlayer.outOrder > 0;

            if (!hasPassed && !isOut) {
                this.data.currentPlayerIndex = index;
                return;
            }
        }

        this.end_trick();
    }

    private end_trick(): void {
        const plays = this.data.currentTrick.plays;

        if (plays.length > 0) {
            const lastPlay = plays[plays.length - 1];
            this.data.lastTrickWinnerId = lastPlay.playerId;
        }

        this.data.currentTrick.plays = [];
        this.data.currentTrick.passedPlayers = [];

        let leaderId = this.data.lastTrickWinnerId;

        if (!leaderId || this.data.players[leaderId].outOrder > 0) {
            const lastPlayedIndex = leaderId ? this.playerIds.indexOf(leaderId) : this.data.currentPlayerIndex;
            let index = lastPlayedIndex;
            const total = this.playerIds.length;
            let found = false;

            for (let i = 0; i < total; i++) {
                index = (index + 1) % total;
                if (this.data.players[this.playerIds[index]].outOrder === 0) {
                    leaderId = this.playerIds[index];
                    found = true;
                    break;
                }
            }

            if (!found) {
                this.end_season();
                return;
            }
        }

        this.data.currentTrick.leaderId = leaderId!;
        this.data.currentPlayerIndex = this.playerIds.indexOf(leaderId!);
    }

    private end_season(): void {
        this.data.status = GameStatus.SeasonEnd;

        const activePlayers = this.playerIds.filter(id => this.data.players[id].outOrder === 0);
        let lastPlayerId = '';

        if (activePlayers.length === 1) {
            lastPlayerId = activePlayers[0];
            const outCount = this.get_out_players_count() + 1;
            this.data.players[lastPlayerId].outOrder = outCount;
        } else if (activePlayers.length === 0) {
            let maxOut = 0;
            for (const id of this.playerIds) {
                const outOrder = this.data.players[id].outOrder;
                if (outOrder > maxOut) {
                    maxOut = outOrder;
                    lastPlayerId = id;
                }
            }
        } else {
            lastPlayerId = activePlayers[0];
        }

        const playerCount = this.playerIds.length;

        for (const id of this.playerIds) {
            const p = this.data.players[id];
            let points = 0;

            if (p.outOrder === 1) {
                points = 2;
                p.seasonsWon++;
            } else if (id === lastPlayerId) {
                points = -1;
            } else if (p.outOrder === 2) {
                points = 1;
            } else {
                points = 0;
            }

            p.score += points;
        }

        this.data.startingPlayerForSeasonId = lastPlayerId;

        // Check game over
        const isTwoPlayer = playerCount === 2;
        let gameOver = false;

        if (isTwoPlayer) {
            for (const id of this.playerIds) {
                if (this.data.players[id].seasonsWon >= 3) {
                    gameOver = true;
                    break;
                }
            }
        } else {
            if (this.data.season >= 4) {
                gameOver = true;
            }
        }

        if (gameOver) {
            this.data.status = GameStatus.GameOver;
        }
    }

    private validate_turn(playerId: string): void {
        const expectedPlayerId = this.playerIds[this.data.currentPlayerIndex];
        if (playerId !== expectedPlayerId) {
            throw new Error(`It is not ${playerId}'s turn (Expected: ${expectedPlayerId})`);
        }
    }

    private get_out_players_count(): number {
        return this.playerIds.filter(id => this.data.players[id].outOrder > 0).length;
    }

    private get_active_players_count(): number {
        return this.playerIds.filter(id => this.data.players[id].outOrder === 0).length;
    }

    public start_next_season(): void {
        if (this.data.status !== GameStatus.SeasonEnd) {
            throw new Error('Can only start next season from SeasonEnd status');
        }
        this.start_season(this.data.season + 1);
    }

    public restart_game(): void {
        for (const id of this.playerIds) {
            this.data.players[id] = {
                id,
                hand: [],
                score: 0,
                outOrder: 0,
                seasonsWon: 0
            };
        }
        this.data.startingPlayerForSeasonId = null;
        this.start_season(1);
    }
}
