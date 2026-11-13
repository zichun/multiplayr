/**
 * SchadenfreudeMethods.ts - RPC methods for "Seconds, Please!".
 * Executed only on the host: rehydrate the game state, mutate it, persist it back.
 */

import { MPType } from '../../common/interfaces';
import { SchadenfreudeGameState, GameStateData } from './SchadenfreudeGameState';

export const getGameState = (mp: MPType): SchadenfreudeGameState => {
    let raw = mp.getData('gameState');
    if (!raw) {
        throw new Error('Game state not found');
    }
    if (typeof raw.get_data !== 'function') {
        raw = SchadenfreudeGameState.from_data(raw.data as GameStateData, raw.playerIds as string[]);
        mp.setData('gameState', raw);
    }
    return raw;
};

const sync = (mp: MPType, gameState: SchadenfreudeGameState) => {
    mp.setData('gameState', gameState);
};

const collectPlayers = (mp: MPType): string[] => {
    if (mp.getPlayers) {
        return mp.getPlayers();
    }
    const players = [mp.hostId];
    mp.playersForEach((clientId) => players.push(clientId));
    return players;
};

const newGame = (mp: MPType) => {
    const players = collectPlayers(mp);
    if (players.length < 3 || players.length > 5) {
        throw new Error('Seconds, Please! needs 3 to 5 players.');
    }
    const gameState = new SchadenfreudeGameState(players);
    gameState.start_game();
    sync(mp, gameState);
};

export const SchadenfreudeStartGame = (mp: MPType) => {
    newGame(mp);
    mp.setData('lobby_started', true);
};

export const SchadenfreudePlayCard = (mp: MPType, clientId: string, cardId: number) => {
    const gameState = getGameState(mp);
    gameState.play_card(clientId, cardId);
    sync(mp, gameState);
};

// Advance past the trick-resolution animation. Host-driven to avoid races;
// idempotent on the game-state side.
export const SchadenfreudeFinishTrick = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) {
        return;
    }
    const gameState = getGameState(mp);
    gameState.finish_trick();
    sync(mp, gameState);
};

export const SchadenfreudeNextRound = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) {
        throw new Error('Only the host can start the next round');
    }
    const gameState = getGameState(mp);
    gameState.next_round();
    sync(mp, gameState);
};

export const SchadenfreudeRestartGame = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) {
        throw new Error('Only the host can restart the game');
    }
    newGame(mp);
};

export const SchadenfreudeBackToLobby = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) {
        throw new Error('Only the host can return to the lobby');
    }
    mp.setData('lobby_started', false);
};
