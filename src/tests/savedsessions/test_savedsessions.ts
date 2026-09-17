/**
 * test_savedsessions.ts - Tests for the saved-session LRU store and .mpsave format
 */

import { describe, it } from 'mocha';
import { strict as assert } from 'assert';
import {
    createSaveFile,
    MemorySessionBackend,
    parseSaveFile,
    saveFileName,
    selectEvictions,
    SESSION_CAPACITY,
    SessionStore,
    SAVE_FILE_FORMAT,
    SAVE_FILE_VERSION
} from '../../client/lib/savedsessions';

function session(id: string, ruleName = 'splendor') {
    return {
        sessionId: id,
        ruleName,
        roomId: id,
        clientId: id,
        gameState: JSON.stringify({ hostId: id, hostStore: { turn: id }, clientsStore: {}, pluginsStore: {} }),
        players: ['Alice', 'Bob']
    };
}

// Deterministic clock: each call advances by one tick.
function clock() {
    let t = 1000;
    return () => (t += 1);
}

describe('Saved sessions', () => {

    describe('selectEvictions', () => {
        it('keeps the most recently updated sessions up to capacity', () => {
            const evict = selectEvictions([
                { sessionId: 'a', updatedAt: 1 },
                { sessionId: 'b', updatedAt: 5 },
                { sessionId: 'c', updatedAt: 3 },
                { sessionId: 'd', updatedAt: 4 }
            ], 2);
            assert.deepEqual(evict.sort(), ['a', 'c']);
        });

        it('evicts nothing when under capacity', () => {
            assert.deepEqual(selectEvictions([{ sessionId: 'a', updatedAt: 1 }], 5), []);
        });
    });

    describe('SessionStore', () => {
        it('defaults to a capacity of 5', () => {
            assert.equal(SESSION_CAPACITY, 5);
        });

        it('lists sessions most recently used first', async () => {
            const store = new SessionStore(new MemorySessionBackend(), 5, clock());
            await store.save(session('a'));
            await store.save(session('b'));
            await store.save(session('c'));
            assert.deepEqual((await store.list()).map((s) => s.sessionId), ['c', 'b', 'a']);
        });

        it('evicts the least recently used session beyond capacity', async () => {
            const store = new SessionStore(new MemorySessionBackend(), 5, clock());
            for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) {
                await store.save(session(id));
            }
            assert.deepEqual((await store.list()).map((s) => s.sessionId), ['f', 'e', 'd', 'c', 'b']);
        });

        it('orders saves made within the same millisecond by save order', async () => {
            const store = new SessionStore(new MemorySessionBackend(), 5, () => 1000);
            for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) {
                await store.save(session(id));
            }
            assert.deepEqual((await store.list()).map((s) => s.sessionId), ['f', 'e', 'd', 'c', 'b']);
        });

        it('allows multiple sessions of the same game rule', async () => {
            const store = new SessionStore(new MemorySessionBackend(), 5, clock());
            await store.save(session('room1', 'skull'));
            await store.save(session('room2', 'skull'));
            const sessions = await store.list();
            assert.equal(sessions.length, 2);
            assert.ok(sessions.every((s) => s.ruleName === 'skull'));
        });

        it('updating a session replaces it and makes it most recent', async () => {
            const store = new SessionStore(new MemorySessionBackend(), 5, clock());
            await store.save(session('a'));
            await store.save(session('b'));
            await store.save({ ...session('a'), gameState: '{"hostStore":{"turn":2}}' });

            const sessions = await store.list();
            assert.deepEqual(sessions.map((s) => s.sessionId), ['a', 'b']);
            assert.equal(sessions[0].gameState, '{"hostStore":{"turn":2}}');
        });

        it('touch protects a session from eviction without changing its state', async () => {
            const store = new SessionStore(new MemorySessionBackend(), 3, clock());
            await store.save(session('a'));
            await store.save(session('b'));
            await store.save(session('c'));
            await store.touch('a');
            await store.save(session('d'));

            const sessions = await store.list();
            assert.deepEqual(sessions.map((s) => s.sessionId), ['d', 'a', 'c']);
            assert.equal(sessions[1].gameState, session('a').gameState);
        });

        it('removes a session', async () => {
            const store = new SessionStore(new MemorySessionBackend(), 5, clock());
            await store.save(session('a'));
            await store.save(session('b'));
            await store.remove('a');
            assert.deepEqual((await store.list()).map((s) => s.sessionId), ['b']);
            assert.equal(await store.get('a'), null);
        });

        it('coalesces queued autosaves so the latest state wins', async () => {
            const backend = new MemorySessionBackend();
            let puts = 0;
            const put = backend.put.bind(backend);
            backend.put = async (s) => { puts += 1; await put(s); };

            const store = new SessionStore(backend, 5, clock());
            for (let turn = 1; turn <= 10; turn++) {
                store.queue({ ...session('a'), gameState: '{"hostStore":{"turn":' + turn + '}}' });
            }
            await store.flush();

            const saved = await store.get('a');
            assert.equal(saved.gameState, '{"hostStore":{"turn":10}}');
            assert.ok(puts <= 2, 'expected queued writes to coalesce, got ' + puts);
        });

        it('queued autosaves still enforce capacity', async () => {
            const store = new SessionStore(new MemorySessionBackend(), 2, clock());
            store.queue(session('a'));
            store.queue(session('b'));
            store.queue(session('c'));
            assert.deepEqual((await store.list()).map((s) => s.sessionId), ['c', 'b']);
        });
    });

    describe('.mpsave files', () => {
        it('round-trips a session through the save file format', () => {
            const original = session('mp-123456', 'wingspanpocket');
            const file = createSaveFile(original, 42);

            assert.equal(file.format, SAVE_FILE_FORMAT);
            assert.equal(file.version, SAVE_FILE_VERSION);
            assert.equal(file.savedAt, 42);
            assert.equal(typeof file.gameState, 'object', 'state is stored as readable JSON');

            const restored = parseSaveFile(JSON.stringify(file));
            assert.deepEqual(restored, original);
        });

        it('rejects files that are not multiplayr saves', () => {
            assert.throws(() => parseSaveFile('not json'), /not a Multiplayr save/);
            assert.throws(() => parseSaveFile('{"hello":"world"}'), /not a Multiplayr save/);
        });

        it('rejects saves from a newer format version', () => {
            const file = { ...createSaveFile(session('a')), version: SAVE_FILE_VERSION + 1 };
            assert.throws(() => parseSaveFile(JSON.stringify(file)), /newer version/);
        });

        it('rejects incomplete saves', () => {
            const noRule = { ...createSaveFile(session('a')), ruleName: '' };
            assert.throws(() => parseSaveFile(JSON.stringify(noRule)), /missing ruleName/);

            const noState = { ...createSaveFile(session('a')), gameState: { clientsStore: {} } };
            assert.throws(() => parseSaveFile(JSON.stringify(noState)), /missing game state/);
        });

        it('builds a descriptive file name', () => {
            const file = createSaveFile(session('mp-123456', 'splendor'), new Date(2026, 8, 14, 9, 5).getTime());
            assert.equal(saveFileName(file), 'multiplayr-splendor-123456-20260914-0905.mpsave');
        });
    });
});
