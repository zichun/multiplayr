/**
 * SplendorMethods.ts - RPC methods for Splendor (host-only execution).
 * Each method rehydrates the pure GameState, mutates it, and persists it back.
 */

import { MPType } from '../../common/interfaces';
import { SplendorGameState, GameStateData, GemColor, TokenColor } from './SplendorGameState';

export const getGameState = (mp: MPType): SplendorGameState => {
    let raw = mp.getData('gameState');
    if (!raw) {
        throw new Error('Game state not found');
    }
    if (typeof raw.get_data !== 'function') {
        const data = raw.data as GameStateData;
        const playerIds = raw.playerIds as string[];
        raw = SplendorGameState.from_data(data, playerIds);
        mp.setData('gameState', raw);
    }
    return raw;
};

const sync = (mp: MPType, gameState: SplendorGameState) => {
    mp.setData('gameState', gameState);
};

const collectPlayers = (mp: MPType): string[] => {
    const players = [mp.hostId];
    mp.playersForEach((clientId) => players.push(clientId));
    return players;
};

export const SplendorStartGame = (mp: MPType) => {
    const players = collectPlayers(mp);
    if (players.length < 2 || players.length > 4) {
        throw new Error('Splendor requires 2 to 4 players.');
    }
    const gameState = new SplendorGameState(players);
    gameState.start_game();
    sync(mp, gameState);
    mp.setData('lobby_started', true);
};

export const SplendorTake3 = (mp: MPType, clientId: string, colors: GemColor[]) => {
    const gameState = getGameState(mp);
    gameState.take3(clientId, colors);
    sync(mp, gameState);
};

export const SplendorTake2 = (mp: MPType, clientId: string, color: GemColor) => {
    const gameState = getGameState(mp);
    gameState.take2(clientId, color);
    sync(mp, gameState);
};

export const SplendorReserve = (
    mp: MPType,
    clientId: string,
    source: 'board' | 'deck',
    cardId: string | null,
    level: number | null
) => {
    const gameState = getGameState(mp);
    gameState.reserve(clientId, source, cardId, level);
    sync(mp, gameState);
};

export const SplendorBuy = (
    mp: MPType,
    clientId: string,
    source: 'board' | 'reserve',
    cardId: string
) => {
    const gameState = getGameState(mp);
    gameState.buy(clientId, source, cardId);
    sync(mp, gameState);
};

export const SplendorSelectNoble = (mp: MPType, clientId: string, nobleId: string) => {
    const gameState = getGameState(mp);
    gameState.select_noble(clientId, nobleId);
    sync(mp, gameState);
};

export const SplendorDiscardTokens = (mp: MPType, clientId: string, colors: TokenColor[]) => {
    const gameState = getGameState(mp);
    gameState.discard_tokens(clientId, colors);
    sync(mp, gameState);
};

export const SplendorRestartGame = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) {
        throw new Error('Only the host can restart the game');
    }
    const gameState = getGameState(mp);
    gameState.start_game();
    sync(mp, gameState);
};

export const SplendorBackToLobby = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) {
        throw new Error('Only the host can return to the lobby');
    }
    mp.setData('lobby_started', false);
};
