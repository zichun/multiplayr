/**
 * CourtisansMethods.ts - RPC methods for Courtisans.
 * Executed only on the host: rehydrate the game state, mutate it, persist it back.
 */

import { MPType } from '../../common/interfaces';
import { CourtisansGameState, GameStateData, Zone, Level } from './CourtisansGameState';

export const getGameState = (mp: MPType): CourtisansGameState => {
    let raw = mp.getData('gameState');
    if (!raw) {
        throw new Error('Game state not found');
    }
    if (typeof raw.get_data !== 'function') {
        const data = raw.data as GameStateData;
        const playerIds = raw.playerIds as string[];
        raw = CourtisansGameState.from_data(data, playerIds);
        mp.setData('gameState', raw);
    }
    return raw;
};

const sync = (mp: MPType, gameState: CourtisansGameState) => {
    mp.setData('gameState', gameState);
};

const collectPlayers = (mp: MPType): string[] => {
    const players = [mp.hostId];
    mp.playersForEach((clientId) => players.push(clientId));
    return players;
};

export const CourtisansStartGame = (mp: MPType) => {
    const players = collectPlayers(mp);
    if (players.length < 2 || players.length > 5) {
        throw new Error('Courtisans requires 2 to 5 players.');
    }
    const gameState = new CourtisansGameState(players);
    gameState.start_game(players[0]);
    sync(mp, gameState);
    mp.setData('lobby_started', true);
};

// Play one card from hand into one of the three zones. Table cards need a level
// (above/below); opponent-domain cards need targetPlayerId.
export const CourtisansPlaceCard = (
    mp: MPType,
    clientId: string,
    cardId: string,
    zone: Zone,
    level?: Level,
    targetPlayerId?: string
) => {
    const gameState = getGameState(mp);
    gameState.place_card(clientId, cardId, zone, { level, targetPlayerId });
    sync(mp, gameState);
};

// Resolve a pending assassin: pass a target card id, or null/empty to skip.
export const CourtisansResolveAssassin = (
    mp: MPType,
    clientId: string,
    targetCardId?: string
) => {
    const gameState = getGameState(mp);
    gameState.resolve_assassin(clientId, targetCardId && targetCardId.length > 0 ? targetCardId : null);
    sync(mp, gameState);
};

export const CourtisansRestartGame = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) {
        throw new Error('Only the host can restart the game');
    }
    const players = collectPlayers(mp);
    const gameState = new CourtisansGameState(players);
    gameState.start_game(players[0]);
    sync(mp, gameState);
};

export const CourtisansBackToLobby = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) {
        throw new Error('Only the host can return to the lobby');
    }
    mp.setData('lobby_started', false);
};
