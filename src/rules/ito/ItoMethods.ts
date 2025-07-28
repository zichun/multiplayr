/**
 * ItoMethods.ts - Game methods for Ito
 */

import { MPType } from '../../common/interfaces';
import { ItoGameState } from './ItoTypes';
import { initializeNewRound, moveToNextPhase } from './ItoCommon';

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
    
    // Initialize game state
    mp.setData('round', 0);
    mp.setData('lives', playerCount);
    mp.setData('gameState', ItoGameState.InputClues);
    
    // Start first round
    initializeNewRound(mp);
    
    mp.setData('lobby_started', true);
};

export const ItoSubmitClue = (mp: MPType, clientId: string, clue: string) => {
    if (clientId === mp.hostId) {
        throw new Error('Host cannot submit a clue');
    }
    
    const gameState = mp.getData('gameState');
    if (gameState !== ItoGameState.InputClues) {
        throw new Error('Cannot submit clue in current state');
    }
    
    const cluesLocked = mp.getData('cluesLocked');
    if (cluesLocked[clientId]) {
        throw new Error('Clue is already locked');
    }
    
    // Update clue
    const clues = mp.getData('clues');
    clues[clientId] = clue;
    mp.setData('clues', clues);
    mp.setPlayerData(clientId, 'clue', clue);
};

export const ItoLockClue = (mp: MPType, clientId: string) => {
    if (clientId === mp.hostId) {
        throw new Error('Host cannot lock a clue');
    }
    
    const gameState = mp.getData('gameState');
    if (gameState !== ItoGameState.InputClues) {
        throw new Error('Cannot lock clue in current state');
    }
    
    const clues = mp.getData('clues');
    if (!clues[clientId] || clues[clientId].trim() === '') {
        throw new Error('Cannot lock empty clue');
    }
    
    // Lock the clue
    const cluesLocked = mp.getData('cluesLocked');
    cluesLocked[clientId] = true;
    mp.setData('cluesLocked', cluesLocked);
    mp.setPlayerData(clientId, 'hasLockedClue', true);
    
    // Check if we can move to next phase
    moveToNextPhase(mp);
};

export const ItoUpdateSort = (mp: MPType, clientId: string, sortOrder: string[]) => {
    const gameState = mp.getData('gameState');
    if (gameState !== ItoGameState.Sorting) {
        throw new Error('Cannot update sort in current state');
    }
    
    if (mp.getData('sortLocked')) {
        throw new Error('Sort is already locked');
    }
    
    // Validate that sortOrder contains all players
    const expectedPlayers: string[] = [];
    mp.playersForEach((clientId) => {
        expectedPlayers.push(clientId);
    });
    
    const providedPlayers = new Set(sortOrder);
    if (expectedPlayers.length !== providedPlayers.size || 
        !expectedPlayers.every(id => providedPlayers.has(id))) {
        throw new Error('Invalid sort order');
    }
    
    mp.setData('sortOrder', sortOrder);
};

export const ItoLockSort = (mp: MPType, clientId: string) => {
    const gameState = mp.getData('gameState');
    if (gameState !== ItoGameState.Sorting) {
        throw new Error('Cannot lock sort in current state');
    }
    
    const sortOrder = mp.getData('sortOrder');
    if (sortOrder.length === 0) {
        throw new Error('Cannot lock empty sort order');
    }
    
    mp.setData('sortLocked', true);
    moveToNextPhase(mp);
};

export const ItoNextRound = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) {
        throw new Error('Only host can start next round');
    }
    
    const gameState = mp.getData('gameState');
    if (gameState !== ItoGameState.Scoring) {
        throw new Error('Cannot start next round in current state');
    }
    
    const currentRound = mp.getData('round');
    const lives = mp.getData('lives');
    
    if (lives <= 0) {
        mp.setData('gameState', ItoGameState.Defeat);
        return;
    }
    
    if (currentRound >= 2) {
        mp.setData('gameState', ItoGameState.Victory);
        return;
    }
    
    // Move to next round
    mp.setData('round', currentRound + 1);
    initializeNewRound(mp);
};

export const ItoRestartGame = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) {
        throw new Error('Only host can restart game');
    }
    
    const gameState = mp.getData('gameState');
    if (gameState !== ItoGameState.Defeat && gameState !== ItoGameState.Victory) {
        throw new Error('Cannot restart game in current state');
    }
    
    // Reset to lobby
    mp.setData('lobby_started', false);
    mp.setData('gameState', ItoGameState.Lobby);
};