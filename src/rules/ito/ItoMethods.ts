/**
 * ItoMethods.ts - Game methods for Ito
 */

import { MPType } from '../../common/interfaces';
import { ItoGameState as GameState, GameStatus } from './ItoGameState';

const getGameState = (mp: MPType): GameState => {
    return mp.getData('gameState');
};

const syncGameStateToMP = (mp: MPType, gameState: GameState) => {
    // Handle automatic round completion with delay for UI
    // if (data.status === GameStatus.Scoring && data.lockedPlayers.length === gameState.get_player_ids().length) {
    //     setTimeout(() => {
    //         gameState.force_round_completion();
    //         syncGameStateToMP(mp, gameState);
    //     }, 3000);
    // }
    //
    mp.setData('gameState', gameState);
};

export const ItoStartGame = (mp: MPType) => {
    const playerCount = mp.playersCount();

    if (playerCount < 3) {
        alert('We need at least 3 players to play Ito');
        return;
    }

    if (playerCount > 12) {
        alert('Maximum 12 players allowed for Ito');
        return;
    }

    let players = [];
    mp.playersForEach((clientId) => players.push(clientId));
    const gameState = new GameState(players);
    gameState.start_game();
    syncGameStateToMP(mp, gameState);

    mp.setData('lobby_started', true);
};

export const ItoSubmitClue = (mp: MPType, clientId: string, clue: string) => {
    const gameState = getGameState(mp);
    gameState.submit_clue(clientId, clue);
    syncGameStateToMP(mp, gameState);
};

export const ItoLockClue = (mp: MPType, clientId: string) => {
    const gameState = getGameState(mp);
    gameState.lock_clue(clientId);
    syncGameStateToMP(mp, gameState);
};

export const ItoNextRound = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) {
        throw new Error('Only host can start next round');
    }

    const gameState = getGameState(mp);
    const data = gameState.get_data();

    if (data.status !== GameStatus.Scoring) {
        throw new Error('Cannot start next round in current state');
    }
    gameState.next_round();
    // This is handled automatically by the GameState class
    // Just sync the current state
    syncGameStateToMP(mp, gameState);
};

export const ItoRestartGame = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) {
        throw new Error('Only host can restart game');
    }

    const gameState = getGameState(mp);
    gameState.restart_game();
    syncGameStateToMP(mp, gameState);
};

export const ItoBackToLobby = (mp: MPType, clientId: string) => {
   if (clientId !== mp.hostId) {
        throw new Error('Only host can return to lobby');
    }

    mp.setData('lobby_started', false);
}
