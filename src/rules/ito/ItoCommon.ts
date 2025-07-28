/**
 * ItoCommon.ts - Common utilities and game logic for Ito
 */

import { MPType } from '../../common/interfaces';
import { shuffle } from '../../common/utils';
import { ItoGameState, ItoCategories } from './ItoTypes';

export const generateUniqueNumbers = (count: number): number[] => {
    const numbers = [];
    const used = new Set<number>();
    
    while (numbers.length < count) {
        const num = Math.floor(Math.random() * 100) + 1; // 1-100
        if (!used.has(num)) {
            used.add(num);
            numbers.push(num);
        }
    }
    
    return numbers;
};

export const getRandomCategory = (): string => {
    return ItoCategories[Math.floor(Math.random() * ItoCategories.length)];
};

export const initializeNewRound = (mp: MPType) => {
    const playerCount = mp.playersCount();
    const numbers = generateUniqueNumbers(playerCount);
    const category = getRandomCategory();
    
    const playerNumbers = {};
    const clues = {};
    const cluesLocked = {};
    
    mp.playersForEach((clientId, index) => {
        playerNumbers[clientId] = numbers[index];
        clues[clientId] = '';
        cluesLocked[clientId] = false;
        
        // Set player data
        mp.setPlayerData(clientId, 'secretNumber', numbers[index]);
        mp.setPlayerData(clientId, 'clue', '');
        mp.setPlayerData(clientId, 'hasLockedClue', false);
    });
    
    mp.setData('playerNumbers', playerNumbers);
    mp.setData('clues', clues);
    mp.setData('cluesLocked', cluesLocked);
    mp.setData('category', category);
    mp.setData('sortOrder', []);
    mp.setData('sortLocked', false);
    mp.setData('gameState', ItoGameState.InputClues);
};

export const calculateScore = (mp: MPType): number => {
    const sortOrder = mp.getData('sortOrder') as string[];
    const playerNumbers = mp.getData('playerNumbers');
    
    let errors = 0;
    
    for (let i = 0; i < sortOrder.length - 1; i++) {
        const currentNum = playerNumbers[sortOrder[i]];
        const nextNum = playerNumbers[sortOrder[i + 1]];
        
        if (currentNum > nextNum) {
            errors++;
        }
    }
    
    return errors;
};

export const allCluesLocked = (mp: MPType): boolean => {
    const cluesLocked = mp.getData('cluesLocked');
    return Object.values(cluesLocked).every(locked => locked === true);
};

export const moveToNextPhase = (mp: MPType) => {
    const currentState = mp.getData('gameState');
    
    switch (currentState) {
        case ItoGameState.InputClues:
            if (allCluesLocked(mp)) {
                mp.setData('gameState', ItoGameState.Sorting);
            }
            break;
            
        case ItoGameState.Sorting:
            if (mp.getData('sortLocked')) {
                mp.setData('gameState', ItoGameState.Scoring);
                
                // Calculate score and update lives
                const errors = calculateScore(mp);
                const currentLives = mp.getData('lives');
                const newLives = currentLives - errors;
                mp.setData('lives', newLives);
                
                // Determine next state after scoring
                setTimeout(() => {
                    if (newLives <= 0) {
                        mp.setData('gameState', ItoGameState.Defeat);
                    } else {
                        const currentRound = mp.getData('round');
                        if (currentRound >= 2) { // 3 rounds total (0, 1, 2)
                            mp.setData('gameState', ItoGameState.Victory);
                        } else {
                            // Move to next round
                            mp.setData('round', currentRound + 1);
                            initializeNewRound(mp);
                        }
                    }
                }, 3000); // Show scoring for 3 seconds
            }
            break;
    }
};