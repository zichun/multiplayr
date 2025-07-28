/**
 * ItoMethods.ts - Game methods for Ito
 */

import { MPType } from '../../common/interfaces';
import { ItoGameState } from './ItoTypes';
import { ItoGameState as GameState, GameStatus } from './ItoGameState';

// Store game state instances per room
const gameStates = new Map<string, GameState>();

const getGameState = (mp: MPType): GameState => {
    const roomId = mp.getRoomId();
    if (!gameStates.has(roomId)) {
        const playerIds: string[] = [];
        mp.playersForEach((clientId) => {
            playerIds.push(clientId);
        });
        gameStates.set(roomId, new GameState(playerIds));
    }
    return gameStates.get(roomId)!;
};

const syncGameStateToMP = (mp: MPType, gameState: GameState) => {
    const data = gameState.get_data();
    
    // Map GameState status to ItoGameState
    let mpGameState: ItoGameState;
    switch (data.status) {
        case GameStatus.Lobby:
            mpGameState = ItoGameState.Lobby;
            break;
        case GameStatus.InputClues:
            mpGameState = ItoGameState.InputClues;
            break;
        case GameStatus.Scoring:
            mpGameState = ItoGameState.Scoring;
            break;
        case GameStatus.Victory:
            mpGameState = ItoGameState.Victory;
            break;
        case GameStatus.Defeat:
            mpGameState = ItoGameState.Defeat;
            break;
    }
    
    mp.setData('gameState', mpGameState);
    mp.setData('round', data.round);
    mp.setData('lives', data.lives);
    mp.setData('category', data.category);
    mp.setData('currentTurnPlayer', data.currentTurnPlayer);
    mp.setData('lockedPlayers', data.lockedPlayers);
    mp.setData('livesLostThisRound', data.livesLostThisRound);
    
    // Sync player data
    const playerNumbers = {};
    const clues = {};
    const cluesLocked = {};
    
    for (const player of gameState.get_all_players()) {
        playerNumbers[player.id] = player.secretNumber;
        clues[player.id] = player.clue;
        cluesLocked[player.id] = player.hasLockedClue;
        
        mp.setPlayerData(player.id, 'secretNumber', player.secretNumber);
        mp.setPlayerData(player.id, 'clue', player.clue);
        mp.setPlayerData(player.id, 'hasLockedClue', player.hasLockedClue);
    }
    
    mp.setData('playerNumbers', playerNumbers);
    mp.setData('clues', clues);
    mp.setData('cluesLocked', cluesLocked);
    
    // Handle automatic round completion with delay for UI
    if (data.status === GameStatus.Scoring && data.lockedPlayers.length === gameState.get_player_ids().length) {
        setTimeout(() => {
            gameState.force_round_completion();
            syncGameStateToMP(mp, gameState);
        }, 3000);
    }
};

export const ItoStartGame = (mp: MPType) => {
    const playerCount = mp.playersCount();
    
    if (playerCount < 2) {
        alert('We need at least 2 players to play Ito');
        return;
    }
    
    if (playerCount > 8) {
        alert('Maximum 8 players allowed for Ito');
        return;
    }
    
    const gameState = getGameState(mp);
    gameState.start_game();
    syncGameStateToMP(mp, gameState);
    
    mp.setData('lobby_started', true);
};

export const ItoSubmitClue = (mp: MPType, clientId: string, clue: string) => {
    if (clientId === mp.hostId) {
        throw new Error('Host cannot submit a clue');
    }
    
    const gameState = getGameState(mp);
    gameState.submit_clue(clientId, clue);
    syncGameStateToMP(mp, gameState);
};

export const ItoLockClue = (mp: MPType, clientId: string) => {
    if (clientId === mp.hostId) {
        throw new Error('Host cannot lock a clue');
    }
    
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
    
    mp.setData('lobby_started', false);
};