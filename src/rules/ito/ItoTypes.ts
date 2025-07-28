/**
 * ItoTypes.ts - Type definitions for Ito game
 */

export enum ItoGameState {
    Lobby = 'lobby',
    InputClues = 'input_clues',
    Sorting = 'sorting',
    Scoring = 'scoring',
    Victory = 'victory',
    Defeat = 'defeat'
}

export interface ItoPlayerData {
    secretNumber: number;
    clue: string;
    hasLockedClue: boolean;
}

export interface ItoGlobalData {
    gameState: ItoGameState;
    round: number;
    lives: number;
    category: string;
    playerNumbers: { [clientId: string]: number };
    clues: { [clientId: string]: string };
    cluesLocked: { [clientId: string]: boolean };
    sortOrder: string[]; // array of clientIds in sorted order
    sortLocked: boolean;
}

export interface ItoClueEntry {
    clientId: string;
    clue: string;
    actualNumber: number;
}

// Categories for the game
export const ItoCategories = [
    "Animal sizes (smallest to largest)",
    "Temperature (coldest to hottest)", 
    "Speed (slowest to fastest)",
    "Height of things (shortest to tallest)",
    "Age of things (youngest to oldest)",
    "Brightness (dimmest to brightest)",
    "Loudness (quietest to loudest)",
    "Weight (lightest to heaviest)",
    "Distance from Earth (closest to farthest)",
    "Popularity (least to most popular)"
];