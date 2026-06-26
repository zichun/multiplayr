/**
 * SplendorDuelMethods.ts - RPC methods for Splendor Duel
 */

import { MPType } from '../../common/interfaces';
import { SplendorDuelGameState, GameStateData, TokenColor } from './SplendorDuelGameState';

export const getGameState = (mp: MPType): SplendorDuelGameState => {
    let raw = mp.getData('gameState');
    if (!raw) {
        throw new Error('Game state not found');
    }
    if (typeof raw.get_data !== 'function') {
        const data = raw.data as GameStateData;
        const playerIds = raw.playerIds as string[];
        raw = SplendorDuelGameState.from_data(data, playerIds);
        mp.setData('gameState', raw);
    }
    return raw;
};

const syncGameStateToMP = (mp: MPType, gameState: SplendorDuelGameState) => {
    mp.setData('gameState', gameState);
};

export const SplendorDuelStartGame = (mp: MPType) => {
    const playerCount = mp.playersCount() + 1; // Host is a player

    if (playerCount !== 2) {
        throw new Error('Splendor Duel is strictly a 2-player game. Ensure exactly 2 players are in the lobby.');
    }

    const players = [mp.hostId];
    mp.playersForEach((clientId) => players.push(clientId));

    const gameState = new SplendorDuelGameState(players);
    gameState.start_game();

    syncGameStateToMP(mp, gameState);
    mp.setData('lobby_started', true);
};

export const SplendorDuelUsePrivilege = (mp: MPType, clientId: string, coord: [number, number]) => {
    const gameState = getGameState(mp);
    gameState.use_privilege(clientId, coord);
    syncGameStateToMP(mp, gameState);
};

export const SplendorDuelReplenishBoard = (mp: MPType, clientId: string, isForced = false) => {
    const gameState = getGameState(mp);
    gameState.replenish_board(clientId, isForced);
    syncGameStateToMP(mp, gameState);
};

export const SplendorDuelTakeTokens = (mp: MPType, clientId: string, coords: [number, number][]) => {
    const gameState = getGameState(mp);
    gameState.take_tokens(clientId, coords);
    syncGameStateToMP(mp, gameState);
};

export const SplendorDuelReserveCard = (
    mp: MPType,
    clientId: string,
    cardId: string | null,
    deckLevel: number | null,
    boardGoldCoord: [number, number]
) => {
    const gameState = getGameState(mp);
    gameState.reserve_card(clientId, cardId, deckLevel, boardGoldCoord);
    syncGameStateToMP(mp, gameState);
};

export const SplendorDuelPurchaseCard = (
    mp: MPType,
    clientId: string,
    cardId: string,
    jokerColor?: TokenColor
) => {
    const gameState = getGameState(mp);
    gameState.purchase_card(clientId, cardId, jokerColor);
    syncGameStateToMP(mp, gameState);
};

export const SplendorDuelResolveSteal = (mp: MPType, clientId: string, color: TokenColor) => {
    const gameState = getGameState(mp);
    gameState.resolve_steal(clientId, color);
    syncGameStateToMP(mp, gameState);
};

export const SplendorDuelResolveMatchingToken = (mp: MPType, clientId: string, coord: [number, number]) => {
    const gameState = getGameState(mp);
    gameState.resolve_matching_token(clientId, coord);
    syncGameStateToMP(mp, gameState);
};

export const SplendorDuelSelectRoyal = (mp: MPType, clientId: string, royalId: string) => {
    const gameState = getGameState(mp);
    gameState.select_royal(clientId, royalId);
    syncGameStateToMP(mp, gameState);
};

export const SplendorDuelDiscardTokens = (mp: MPType, clientId: string, colorsToDiscard: TokenColor[]) => {
    const gameState = getGameState(mp);
    gameState.discard_tokens(clientId, colorsToDiscard);
    syncGameStateToMP(mp, gameState);
};

export const SplendorDuelRestartGame = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) {
        throw new Error('Only the host can restart the game');
    }
    const gameState = getGameState(mp);
    gameState.start_game();
    syncGameStateToMP(mp, gameState);
};

export const SplendorDuelBackToLobby = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) {
        throw new Error('Only the host can return to the lobby');
    }
    mp.setData('lobby_started', false);
};
