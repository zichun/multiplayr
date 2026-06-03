/**
 * DurianMethods.ts - Game methods for Durian
 */

import { MPType } from '../../common/interfaces';
import { DurianGameState as GameState, GameStatus } from './DurianGameState';

const getGameState = (mp: MPType): GameState => {
    return mp.getData('gameState');
};

const syncGameStateToMP = (mp: MPType, gameState: GameState) => {
    mp.setData('gameState', gameState);
};

export const DurianStartGame = (mp: MPType) => {
    const playerCount = mp.playersCount() + 1; // Host is a player

    if (playerCount < 2) {
        alert('We need at least 2 players to play Durian');
        return;
    }

    if (playerCount > 7) {
        alert('Maximum 7 players allowed for Durian (Oink Game specification)');
        return;
    }

    const players = [mp.hostId];
    mp.playersForEach((clientId) => players.push(clientId));
    
    const gameState = new GameState(players);
    gameState.start_game();
    syncGameStateToMP(mp, gameState);

    mp.setData('lobby_started', true);
};

export const DurianDrawCard = (mp: MPType, clientId: string) => {
    const gameState = getGameState(mp);
    gameState.draw_card(clientId);
    syncGameStateToMP(mp, gameState);
};

export const DurianSubmitOrder = (mp: MPType, clientId: string, chosenSide: 'A' | 'B') => {
    const gameState = getGameState(mp);
    gameState.submit_order(clientId, chosenSide);
    syncGameStateToMP(mp, gameState);
};



export const DurianRingBell = (mp: MPType, clientId: string) => {
    const gameState = getGameState(mp);
    gameState.ring_bell(clientId);
    syncGameStateToMP(mp, gameState);
};

export const DurianNextRound = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) {
        throw new Error('Only host can advance rounds');
    }
    const gameState = getGameState(mp);
    gameState.next_round();
    syncGameStateToMP(mp, gameState);
};

export const DurianRestartGame = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) {
        throw new Error('Only host can restart the game');
    }
    const gameState = getGameState(mp);
    gameState.restart_game();
    syncGameStateToMP(mp, gameState);
};

export const DurianBackToLobby = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) {
        throw new Error('Only host can return to lobby');
    }
    mp.setData('lobby_started', false);
};
