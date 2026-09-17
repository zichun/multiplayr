/**
 * test_harmonies.ts
 *
 * Type B Integration Tests for Harmonies via GameRuleTest.
 * Tests remote procedure calls, state mutations across ticks, and view updates.
 */

import { describe, it } from 'mocha';
import { strict as assert } from 'assert';
import { GameRuleTest } from '../GameRuleTest';

describe('Harmonies Integration Tests (GameRuleTest)', () => {
    const readState = (raw: any) => (typeof raw?.get_data === 'function' ? raw.get_data() : (raw?.data || raw));

    it('initializes and starts a 2-player Harmonies game through Host RPC', () => {
        const test = new GameRuleTest('harmonies', 1); // 1 client + 1 host = 2 players

        test.invokeHostMethod('startGame', 'A');
        assert.equal(test.getHostData('lobby_started'), true);

        const state = readState(test.getHostData('gameState'));
        assert.ok(state);
        assert.equal(state.playerIds.length, 2);
        assert.equal(state.boardSide, 'A');
        assert.equal(state.market.length, 5);
        assert.equal(state.animalDisplay.length, 5);
        assert.equal(state.ended, false);
    });

    it('carries the host board side choice from the lobby into the game', () => {
        const test = new GameRuleTest('harmonies', 1);

        // Host picks side B in the lobby, then starts without re-stating the choice.
        test.invokeHostMethod('setBoardSide', 'B');
        assert.equal(test.getHostData('harmonies_boardSide'), 'B');

        test.invokeHostMethod('startGame');
        const state = readState(test.getHostData('gameState'));
        assert.equal(state.boardSide, 'B');
        for (const pid of state.playerIds) {
            assert.equal(state.players[pid].board.side, 'B');
        }
    });

    it('allows active player to draft tokens, place tokens, and end turn via RPC', () => {
        const test = new GameRuleTest('harmonies', 1);
        test.invokeHostMethod('startGame', 'A');

        let state = readState(test.getHostData('gameState'));
        const hostId = state.playerIds[0];

        // 1. Host drafts 3 tokens from market space 0
        test.invokeHostMethod('takeMarketTokens', 0);
        state = readState(test.getHostData('gameState'));
        assert.equal(state.players[hostId].draftedTokens.length, 3);
        assert.equal(state.market[0].length, 0);

        // 2. Host places all 3 tokens on board at (0,0), (1,0), (2,0)
        test.invokeHostMethod('placeToken', 0, 0);
        state = readState(test.getHostData('gameState'));
        assert.equal(state.players[hostId].draftedTokens.length, 2);

        test.invokeHostMethod('placeToken', 1, 0);
        test.invokeHostMethod('placeToken', 2, 0);
        state = readState(test.getHostData('gameState'));
        assert.equal(state.players[hostId].draftedTokens.length, 0);

        // 3. Host takes an animal card from the display
        const cardToTake = state.animalDisplay[0].id;
        test.invokeHostMethod('takeCard', cardToTake);
        state = readState(test.getHostData('gameState'));
        assert.equal(state.players[hostId].hand.length, 1);
        assert.equal(state.players[hostId].hand[0].card.id, cardToTake);

        // 4. Host ends turn
        test.invokeHostMethod('endTurn');
        state = readState(test.getHostData('gameState'));

        // Turn advances to Player 1 (client), and market space 0 is refilled
        assert.equal(state.currentPlayerIndex, 1);
        assert.equal(state.market[0].length, 3);
    });

    it('allows client to execute client remote methods when it is client turn', () => {
        const test = new GameRuleTest('harmonies', 1);
        test.invokeHostMethod('startGame', 'A');

        // Pass host turn quickly
        test.invokeHostMethod('takeMarketTokens', 0);
        test.invokeHostMethod('placeToken', 0, 0);
        test.invokeHostMethod('placeToken', 1, 0);
        test.invokeHostMethod('placeToken', 2, 0);
        test.invokeHostMethod('endTurn');

        let state = readState(test.getHostData('gameState'));
        assert.equal(state.currentPlayerIndex, 1);
        const clientId = state.playerIds[1];

        // Client 0 (player index 0 in clients array) drafts tokens from market space 1
        test.invokeClientMethod(0, 'takeMarketTokens', 1);
        state = readState(test.getHostData('gameState'));
        assert.equal(state.players[clientId].draftedTokens.length, 3);

        // Client places token at (0, 1)
        test.invokeClientMethod(0, 'placeToken', 0, 1);
        state = readState(test.getHostData('gameState'));
        assert.equal(state.players[clientId].draftedTokens.length, 2);
    });
});
