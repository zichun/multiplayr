/**
 * JaipurMethods.ts - RPC methods for Jaipur
 *
 * Dispatches client moves to the host-side state machine.
 */

import { MPType } from '../../common/interfaces';
import { JaipurGameState, GameStateData, CardType } from './JaipurGameState';

// Rehydrate utility to ensure the raw database object becomes a JaipurGameState instance
export const getGameState = (mp: MPType): JaipurGameState => {
    let raw = mp.getData('gameState');
    if (!raw) {
        throw new Error('Game state not found');
    }
    // Rehydrate if it's a plain JSON object without prototype methods
    if (typeof raw.get_data !== 'function') {
        const data = raw.data as GameStateData;
        const playerIds = raw.playerIds as string[];
        raw = JaipurGameState.from_data(data, playerIds);
        mp.setData('gameState', raw);
    }
    return raw;
};

const syncGameStateToMP = (mp: MPType, gameState: JaipurGameState) => {
    mp.setData('gameState', gameState);
};

export const JaipurStartGame = (mp: MPType) => {
    const playerCount = mp.playersCount() + 1; // Host is a player

    if (playerCount !== 2) {
        throw new Error('Jaipur is strictly a 2-player game. Ensure exactly 2 players are in the lobby.');
    }

    const players = [mp.hostId];
    mp.playersForEach((clientId) => players.push(clientId));

    const gameState = new JaipurGameState(players);
    gameState.start_game();

    syncGameStateToMP(mp, gameState);
    mp.setData('lobby_started', true);
};

export const JaipurTakeSingleGood = (mp: MPType, clientId: string, marketCardId: number) => {
    const gameState = getGameState(mp);
    gameState.take_single_good(clientId, marketCardId);
    syncGameStateToMP(mp, gameState);
};

export const JaipurTakeAllCamels = (mp: MPType, clientId: string) => {
    const gameState = getGameState(mp);
    gameState.take_all_camels(clientId);
    syncGameStateToMP(mp, gameState);
};

export const JaipurExchangeGoods = (
    mp: MPType,
    clientId: string,
    takeIds: number[],
    returnCards: { id: number; from: 'hand' | 'herd' }[]
) => {
    const gameState = getGameState(mp);
    gameState.exchange_goods(clientId, takeIds, returnCards);
    syncGameStateToMP(mp, gameState);
};

export const JaipurSellGoods = (
    mp: MPType,
    clientId: string,
    sellCardType: CardType,
    cardIds: number[]
) => {
    const gameState = getGameState(mp);
    gameState.sell_goods(clientId, sellCardType, cardIds);
    syncGameStateToMP(mp, gameState);
};

export const JaipurNextRound = (mp: MPType, clientId: string) => {
    const gameState = getGameState(mp);
    gameState.next_round();
    syncGameStateToMP(mp, gameState);
};

export const JaipurRestartGame = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) {
        throw new Error('Only the host can restart the game');
    }
    const gameState = getGameState(mp);
    gameState.start_game();
    syncGameStateToMP(mp, gameState);
};

export const JaipurBackToLobby = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) {
        throw new Error('Only the host can return to the lobby');
    }
    mp.setData('lobby_started', false);
};
