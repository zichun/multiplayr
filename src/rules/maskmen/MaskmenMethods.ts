/**
 * MaskmenMethods.ts - Game methods for Maskmen
 */

import { MPType } from '../../common/interfaces';
import { MaskmenGameState as GameState, WrestlerColor } from './MaskmenGameState';

const getGameState = (mp: MPType): GameState => {
    return mp.getData('gameState');
};

const syncGameStateToMP = (mp: MPType, gameState: GameState) => {
    mp.setData('gameState', gameState);
};

export const MaskmenStartGame = (mp: MPType) => {
    const playerCount = mp.playersCount() + 1; // Host is a player

    if (playerCount < 2) {
        alert('We need at least 2 players to play Maskmen');
        return;
    }

    if (playerCount > 6) {
        alert('Maximum 6 players allowed for Maskmen');
        return;
    }

    const players = [mp.hostId];
    mp.playersForEach((clientId) => players.push(clientId));

    const gameState = new GameState(players);
    gameState.start_game();
    syncGameStateToMP(mp, gameState);

    mp.setData('lobby_started', true);
};

export const MaskmenPlayCards = (mp: MPType, clientId: string, wrestler: WrestlerColor, count: number) => {
    const gameState = getGameState(mp);
    gameState.play_cards(clientId, wrestler, count);
    syncGameStateToMP(mp, gameState);
};

export const MaskmenPassTurn = (mp: MPType, clientId: string) => {
    const gameState = getGameState(mp);
    gameState.pass_turn(clientId);
    syncGameStateToMP(mp, gameState);
};

export const MaskmenStartNextSeason = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) {
        throw new Error('Only the host can start the next season');
    }

    const gameState = getGameState(mp);
    gameState.start_next_season();
    syncGameStateToMP(mp, gameState);
};

export const MaskmenRestartGame = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) {
        throw new Error('Only host can restart game');
    }

    const gameState = getGameState(mp);
    gameState.restart_game();
    syncGameStateToMP(mp, gameState);
};

export const MaskmenBackToLobby = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) {
        throw new Error('Only host can return to lobby');
    }

    mp.setData('lobby_started', false);
};
