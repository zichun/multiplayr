/**
 * ItoCommon.ts - Common utilities for Ito
 * 
 * Simplified to only contain utility functions since core game logic
 * has been moved to ItoGameState class.
 */

import { ItoCategories } from './ItoTypes';

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