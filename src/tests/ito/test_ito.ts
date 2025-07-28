/**
 * test_ito.ts - Basic tests for Ito game logic
 */

import { describe, it } from 'mocha';
import { strict as assert } from 'assert';
import { ItoGameState, ItoCategories } from '../../rules/ito/ItoTypes';
import { generateUniqueNumbers, getRandomCategory } from '../../rules/ito/ItoCommon';

describe('Ito Game Logic', () => {
    describe('generateUniqueNumbers', () => {
        it('should generate unique numbers', () => {
            const numbers = generateUniqueNumbers(5);
            assert.equal(numbers.length, 5);
            
            // Check uniqueness
            const unique = new Set(numbers);
            assert.equal(unique.size, 5);
            
            // Check range
            numbers.forEach(num => {
                assert(num >= 1 && num <= 100, `Number ${num} should be between 1 and 100`);
            });
        });
        
        it('should handle edge cases', () => {
            const single = generateUniqueNumbers(1);
            assert.equal(single.length, 1);
            
            const none = generateUniqueNumbers(0);
            assert.equal(none.length, 0);
        });
    });
    
    describe('getRandomCategory', () => {
        it('should return a valid category', () => {
            const category = getRandomCategory();
            assert(typeof category === 'string');
            assert(ItoCategories.includes(category));
        });
    });
    
    describe('game state enum', () => {
        it('should have all required states', () => {
            assert.equal(ItoGameState.Lobby, 'lobby');
            assert.equal(ItoGameState.InputClues, 'input_clues');
            assert.equal(ItoGameState.Sorting, 'sorting');
            assert.equal(ItoGameState.Scoring, 'scoring');
            assert.equal(ItoGameState.Victory, 'victory');
            assert.equal(ItoGameState.Defeat, 'defeat');
        });
    });
});