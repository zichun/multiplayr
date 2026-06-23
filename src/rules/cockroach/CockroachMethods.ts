/**
 * CockroachMethods.ts - RPC methods for Cockroach Poker: Royal
 *
 * Dispatches client moves to the host-side state machine.
 */

import { MPType } from '../../common/interfaces';
import { CockroachGameState, GameStateData } from './CockroachGameState';

// Rehydrate utility to ensure the raw database object becomes a CockroachGameState instance
export const getGameState = (mp: MPType): CockroachGameState => {
    let raw = mp.getData('gameState');
    if (!raw) {
        throw new Error('Game state not found');
    }
    // Rehydrate if it's a plain JSON object without prototype methods
    if (typeof raw.get_data !== 'function') {
        const data = raw.data as GameStateData;
        const playerIds = raw.playerIds as string[];
        raw = CockroachGameState.from_data(data, playerIds);
        mp.setData('gameState', raw);
    }
    return raw;
};

const syncGameStateToMP = (mp: MPType, gameState: CockroachGameState) => {
    // We save the instance, but the framework serializes it
    mp.setData('gameState', gameState);
};

export const CockroachStartGame = (mp: MPType) => {
    const playerCount = mp.playersCount() + 1; // Host is a player

    if (playerCount < 2) {
        throw new Error('We need at least 2 players to play Cockroach Poker');
    }

    if (playerCount > 6) {
        throw new Error('Maximum 6 players allowed for Cockroach Poker');
    }

    const players = [mp.hostId];
    mp.playersForEach((clientId) => players.push(clientId));

    const gameState = new CockroachGameState(players);
    gameState.start_game();
    
    syncGameStateToMP(mp, gameState);
    mp.setData('lobby_started', true);
};

export const CockroachPassCard = (mp: MPType, clientId: string, receiverId: string, cardId: number, claim: any) => {
    const gameState = getGameState(mp);
    gameState.pass_card(clientId, receiverId, cardId, claim);
    syncGameStateToMP(mp, gameState);
};

export const CockroachDecideCard = (mp: MPType, clientId: string, guess: boolean) => {
    const gameState = getGameState(mp);
    gameState.decide_card(clientId, guess);
    syncGameStateToMP(mp, gameState);
};

export const CockroachResolveSpecial = (mp: MPType, clientId: string, substituteCardIds: number[]) => {
    const gameState = getGameState(mp);
    gameState.resolve_special(clientId, substituteCardIds);
    syncGameStateToMP(mp, gameState);
};

export const CockroachRestartGame = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) {
        throw new Error('Only the host can restart the game');
    }
    const gameState = getGameState(mp);
    gameState.start_game();
    syncGameStateToMP(mp, gameState);
};

export const CockroachBackToLobby = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) {
        throw new Error('Only the host can return to the lobby');
    }
    mp.setData('lobby_started', false);
};
