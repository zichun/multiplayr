/**
 * test_undo.ts - Tests for the host's undo history in GameObject.
 */

import { describe, it } from 'mocha';
import { strict as assert } from 'assert';
import { GameRuleTest } from '../GameRuleTest';

function lobbyName(test: GameRuleTest, player: number) {
    const hostGo = (test as any).hostGameObject;
    return hostGo.plugins['lobby'].getPlayerData(test.getPlayerClientId(player), 'name');
}

function setClientName(test: GameRuleTest, player: number, name: string) {
    (test as any).clientsGameObjects[player].plugins['lobby'].getMPObject().setName(name);
}

describe('Undo history', () => {
    it('records moves with who made them, most recent first', () => {
        const test = new GameRuleTest('trio', 2);
        const hostMP = (test as any).hostGameObject.getMPObject();

        setClientName(test, 0, 'Alice');
        setClientName(test, 1, 'Bob');

        const history = hostMP.getUndoHistory();
        assert.equal(history.length, 2);
        assert.equal(history[0].steps, 1);
        assert.equal(history[0].clientId, test.getPlayerClientId(1));
        assert.equal(history[0].method, 'lobby_setName');
        assert.equal(history[1].steps, 2);
        assert.equal(history[1].clientId, test.getPlayerClientId(0));
    });

    it('undoes one or several states and discards the newer ones', () => {
        const test = new GameRuleTest('trio', 2);
        const hostMP = (test as any).hostGameObject.getMPObject();

        const originalName = lobbyName(test, 0);
        setClientName(test, 0, 'Alice');
        setClientName(test, 1, 'Bob');
        setClientName(test, 0, 'Alicia');

        assert.equal(hostMP.undo(1), true);
        assert.equal(lobbyName(test, 0), 'Alice');
        assert.equal(lobbyName(test, 1), 'Bob');
        assert.equal(hostMP.getUndoHistory().length, 2);

        assert.equal(hostMP.undo(2), true);
        assert.equal(lobbyName(test, 0), originalName);
        assert.equal(hostMP.getUndoHistory().length, 0);

        // The restore itself is not recorded as a new undoable change.
        assert.equal(hostMP.undo(1), false);
    });

    it('keeps at most 5 states', () => {
        const test = new GameRuleTest('trio', 1);
        const hostMP = (test as any).hostGameObject.getMPObject();

        for (let i = 0; i < 8; i++) {
            setClientName(test, 0, 'Name' + i);
        }

        assert.equal(hostMP.getUndoHistory().length, 5);
        assert.equal(hostMP.undo(6), false);
        assert.equal(hostMP.undo(5), true);
        assert.equal(lobbyName(test, 0), 'Name2');
    });

    it('clears history when the set of players changes', () => {
        const test = new GameRuleTest('trio', 2);
        const hostMP = (test as any).hostGameObject.getMPObject();

        setClientName(test, 0, 'Alice');
        assert.equal(hostMP.getUndoHistory().length, 1);

        hostMP.removeClient(test.getPlayerClientId(1));
        assert.equal(hostMP.getUndoHistory().length, 0);
    });
});
