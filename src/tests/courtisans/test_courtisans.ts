/**
 * test_courtisans.ts - Tests for Courtisans.
 */

import { describe, it } from 'mocha';
import { strict as assert } from 'assert';
import {
    CourtisansGameState as GameState,
    GameStateData,
    Card,
    Family,
    Role,
    FAMILIES,
    ROLE_COUNTS,
    buildMissionCatalog,
    Mission
} from '../../rules/courtisans/CourtisansGameState';
import { GameRuleTest } from '../GameRuleTest';

const card = (family: Family, role: Role, i = 1): Card => ({ id: `${family}.${role}.${i}`, family, role });

// Build a controlled mid-game "Playing" state: explicit hands, empty board, a
// given draw pile, and the turn on `current`.
function mockGame(
    players: string[],
    hands: Record<string, Card[]>,
    opts: { drawPile?: Card[]; current?: string } = {}
): GameState {
    const g = new GameState(players);
    const d = g.get_data();
    d.status = 'Playing';
    d.currentPlayerId = opts.current || players[0];
    d.turnZones = { table: false, ownDomain: false, oppDomain: false };
    d.drawPile = opts.drawPile || [];
    players.forEach(p => {
        d.hands[p] = hands[p] ? [...hands[p]] : [];
        d.domains[p] = [];
        d.missions[p] = [];
    });
    return GameState.from_data(d, players);
}

const blueMission = (id: string): Mission => buildMissionCatalog().blue.find(m => m.id === id)!;
const whiteMission = (id: string): Mission => buildMissionCatalog().white.find(m => m.id === id)!;

describe('Courtisans Game Logic', () => {
    describe('Type A: CourtisansGameState Unit Tests', () => {

        describe('Deck & setup', () => {
            it('builds a 90-card deck of 6 families × 15 with the right role split', () => {
                const deck = GameState.buildDeck();
                assert.strictEqual(deck.length, 90);
                for (const f of FAMILIES) {
                    const fam = deck.filter(c => c.family === f);
                    assert.strictEqual(fam.length, 15);
                    for (const role of Object.keys(ROLE_COUNTS) as Role[]) {
                        assert.strictEqual(fam.filter(c => c.role === role).length, ROLE_COUNTS[role]);
                    }
                }
            });

            it('removes the right count and leaves a draw pile divisible by 3', () => {
                const cases: Record<number, { removed: number; draw: number }> = {
                    2: { removed: 30, draw: 54 },
                    3: { removed: 18, draw: 63 },
                    4: { removed: 6, draw: 72 },
                    5: { removed: 0, draw: 75 }
                };
                for (const n of [2, 3, 4, 5]) {
                    const players = Array.from({ length: n }, (_, i) => `p${i}`);
                    const g = new GameState(players);
                    g.start_game(players[0]);
                    const d = g.get_data();
                    assert.strictEqual(d.removed.length, cases[n].removed, `removed for ${n}p`);
                    assert.strictEqual(d.drawPile.length, cases[n].draw, `draw for ${n}p`);
                    assert.strictEqual(d.drawPile.length % 3, 0, `divisible by 3 for ${n}p`);
                    for (const p of players) {
                        assert.strictEqual(d.hands[p].length, 3, `hand size ${n}p`);
                        assert.strictEqual(d.missions[p].length, 2, 'two missions');
                        assert.strictEqual(d.missions[p].filter(m => m.color === 'blue').length, 1, 'one blue');
                        assert.strictEqual(d.missions[p].filter(m => m.color === 'white').length, 1, 'one white');
                    }
                }
            });

            it('rejects player counts outside 2-5', () => {
                assert.throws(() => new GameState(['a']).start_game(), /2 to 5/);
                assert.throws(() => new GameState(['a', 'b', 'c', 'd', 'e', 'f']).start_game(), /2 to 5/);
            });
        });

        describe('A turn: one card per zone', () => {
            it('places one card into each of the three zones then passes clockwise', () => {
                const g = mockGame(['a', 'b'], {
                    a: [card('carp', 'plain', 1), card('stag', 'plain', 1), card('toad', 'plain', 1)],
                    b: [card('hare', 'plain', 1), card('hare', 'plain', 2), card('hare', 'plain', 3)]
                });
                g.place_card('a', 'carp.plain.1', 'table', { level: 'above' });
                g.place_card('a', 'stag.plain.1', 'ownDomain');
                g.place_card('a', 'toad.plain.1', 'oppDomain', { targetPlayerId: 'b' });
                const d = g.get_data();
                assert.strictEqual(d.table.carp.above.length, 1);
                assert.strictEqual(d.domains['a'].length, 1);
                assert.strictEqual(d.domains['b'].length, 1);
                assert.strictEqual(d.domains['b'][0].id, 'toad.plain.1');
                assert.strictEqual(d.currentPlayerId, 'b'); // passed on
                assert.deepStrictEqual(d.turnZones, { table: false, ownDomain: false, oppDomain: false });
            });

            it('rejects reusing a zone, acting out of turn, and bad targets', () => {
                const g = mockGame(['a', 'b'], {
                    a: [card('carp', 'plain', 1), card('stag', 'plain', 1), card('toad', 'plain', 1)],
                    b: [card('hare', 'plain', 1)]
                });
                // A table card needs a level, and an opponent slot needs a real opponent.
                assert.throws(() => g.place_card('a', 'stag.plain.1', 'table', {}), /above or below/);
                assert.throws(() => g.place_card('a', 'stag.plain.1', 'oppDomain', { targetPlayerId: 'a' }), /opponent/);
                assert.throws(() => g.place_card('b', 'hare.plain.1', 'ownDomain'), /not your turn/);
                // Fill the table slot, then reusing it is rejected.
                g.place_card('a', 'carp.plain.1', 'table', { level: 'above' });
                assert.throws(() => g.place_card('a', 'stag.plain.1', 'table', { level: 'below' }), /already played/);
            });

            it('tracks the recently-played highlight, resetting when the next player plays', () => {
                const g = mockGame(['a', 'b'], {
                    a: [card('carp', 'plain', 1), card('stag', 'plain', 1), card('toad', 'plain', 1)],
                    b: [card('hare', 'plain', 1), card('hare', 'plain', 2), card('hare', 'plain', 3)]
                });
                g.place_card('a', 'carp.plain.1', 'table', { level: 'above' });
                assert.deepStrictEqual(g.get_data().highlight, { playerId: 'a', cardIds: ['carp.plain.1'] });
                g.place_card('a', 'stag.plain.1', 'ownDomain');
                assert.deepStrictEqual(g.get_data().highlight!.cardIds, ['carp.plain.1', 'stag.plain.1']);
                g.place_card('a', 'toad.plain.1', 'oppDomain', { targetPlayerId: 'b' });
                assert.strictEqual(g.get_data().highlight!.cardIds.length, 3);
                // b's first card resets the glow to b.
                g.place_card('b', 'hare.plain.1', 'table', { level: 'below' });
                assert.deepStrictEqual(g.get_data().highlight, { playerId: 'b', cardIds: ['hare.plain.1'] });
            });

            it('routes a spy to the Queen’s column, not its family column', () => {
                const g = mockGame(['a', 'b'], {
                    a: [card('stag', 'spy', 1), card('carp', 'plain', 1), card('toad', 'plain', 1)],
                    b: [card('hare', 'plain', 1)]
                });
                g.place_card('a', 'stag.spy.1', 'table', { level: 'below' });
                const d = g.get_data();
                assert.strictEqual(d.table.queen.below.length, 1);
                assert.strictEqual(d.table.stag.below.length, 0);
            });
        });

        describe('Assassin', () => {
            it('pends after placement, eliminates a same-area card, never a guard or itself', () => {
                const g = mockGame(['a', 'b'], {
                    a: [card('nightingale', 'assassin', 1), card('carp', 'plain', 1), card('toad', 'plain', 1)],
                    b: [card('hare', 'plain', 1)]
                });
                // Seed b's domain with a guard + a plain, then a assassinates into b's domain.
                let d = g.get_data();
                d.domains['b'] = [card('carp', 'guard', 1), card('stag', 'plain', 1)];
                const g2 = GameState.from_data(d, ['a', 'b']);

                g2.place_card('a', 'nightingale.assassin.1', 'oppDomain', { targetPlayerId: 'b' });
                d = g2.get_data();
                assert.ok(d.pendingAssassin, 'assassin pends');
                const targets = g2.get_assassin_targets();
                assert.ok(targets.indexOf('carp.guard.1') < 0, 'guard is not a target');
                assert.ok(targets.indexOf('nightingale.assassin.1') < 0, 'the assassin itself is not a target');
                assert.ok(targets.indexOf('stag.plain.1') >= 0, 'the plain is a target');

                assert.throws(() => g2.resolve_assassin('a', 'carp.guard.1'), /legal target/);
                assert.throws(() => g2.resolve_assassin('a', 'nightingale.assassin.1'), /itself/);

                g2.resolve_assassin('a', 'stag.plain.1');
                d = g2.get_data();
                assert.strictEqual(d.pendingAssassin, null);
                assert.strictEqual(d.domains['b'].some(c => c.id === 'stag.plain.1'), false);
                assert.strictEqual(d.removed.some(c => c.id === 'stag.plain.1'), true);
                // Only one zone used so far — the turn is not over.
                assert.strictEqual(d.turnZones.oppDomain, true);
                assert.strictEqual(d.currentPlayerId, 'a');
            });

            it('can eliminate a spy in a domain — only guards are immune', () => {
                const g = mockGame(['a', 'b'], {
                    a: [card('nightingale', 'assassin', 1), card('carp', 'plain', 1), card('toad', 'plain', 1)],
                    b: [card('hare', 'plain', 1)]
                });
                let d = g.get_data();
                d.domains['b'] = [card('carp', 'spy', 1), card('stag', 'guard', 1)];
                const g2 = GameState.from_data(d, ['a', 'b']);

                g2.place_card('a', 'nightingale.assassin.1', 'oppDomain', { targetPlayerId: 'b' });
                const targets = g2.get_assassin_targets();
                assert.ok(targets.indexOf('carp.spy.1') >= 0, 'a spy in the domain is a legal target');
                assert.ok(targets.indexOf('stag.guard.1') < 0, 'a guard is immune');

                g2.resolve_assassin('a', 'carp.spy.1');
                d = g2.get_data();
                assert.strictEqual(d.domains['b'].some(c => c.id === 'carp.spy.1'), false);
                assert.strictEqual(d.removed.some(c => c.id === 'carp.spy.1'), true);
            });

            it('may be skipped (elimination is optional)', () => {
                const g = mockGame(['a', 'b'], {
                    a: [card('nightingale', 'assassin', 1), card('carp', 'plain', 1), card('toad', 'plain', 1)],
                    b: [card('hare', 'plain', 1)]
                });
                g.place_card('a', 'nightingale.assassin.1', 'table', { level: 'above' });
                g.resolve_assassin('a', null);
                const d = g.get_data();
                assert.strictEqual(d.pendingAssassin, null);
                assert.strictEqual(d.table.nightingale.above.length, 1); // the assassin stays, nothing removed
                assert.strictEqual(d.removed.length, 0);
            });

            it('at the table may target any card regardless of family/level', () => {
                const g = mockGame(['a', 'b'], {
                    a: [card('nightingale', 'assassin', 1), card('carp', 'plain', 1), card('toad', 'plain', 1)],
                    b: [card('hare', 'plain', 1)]
                });
                const d = g.get_data();
                d.table.hare.below = [card('hare', 'plain', 9)];
                d.table.queen.above = [card('carp', 'spy', 1)]; // a face-down spy on the table
                const g2 = GameState.from_data(d, ['a', 'b']);
                g2.place_card('a', 'nightingale.assassin.1', 'table', { level: 'above' });
                const targets = g2.get_assassin_targets();
                assert.ok(targets.indexOf('hare.plain.9') >= 0, 'other-family card targetable');
                assert.ok(targets.indexOf('carp.spy.1') >= 0, 'a face-down spy is targetable');
                g2.resolve_assassin('a', 'carp.spy.1');
                assert.strictEqual(g2.get_data().table.queen.above.length, 0);
            });
        });

        describe('End-game reveal & family status', () => {
            it('reveals spies into their true family column, preserving level', () => {
                const g = mockGame(['a', 'b'], { a: [], b: [] });
                const d = g.get_data();
                d.table.queen.below = [card('stag', 'spy', 1)];
                d.table.stag.below = [card('stag', 'plain', 1)];
                const g2 = GameState.from_data(d, ['a', 'b']);
                g2.finish_game();
                const s = g2.get_data();
                assert.strictEqual(s.table.queen.below.length, 0, 'queen emptied');
                assert.strictEqual(s.table.stag.below.length, 2, 'spy slotted below with its family');
                assert.strictEqual(s.score!.familyStatus.stag, 'fallen');
            });

            it('weights nobles as 2 for status and treats ties as neutral', () => {
                const g = mockGame(['a', 'b'], { a: [], b: [] });
                const d = g.get_data();
                d.table.butterfly.above = [card('butterfly', 'noble', 1)]; // weight 2
                d.table.butterfly.below = [card('butterfly', 'plain', 1), card('butterfly', 'plain', 2)]; // weight 2
                d.table.toad.above = [card('toad', 'noble', 1)];   // 2 > 0
                const g2 = GameState.from_data(d, ['a', 'b']);
                g2.finish_game();
                const s = g2.get_data().score!;
                assert.strictEqual(s.familyStatus.butterfly, 'neutral'); // 2 vs 2
                assert.strictEqual(s.familyStatus.toad, 'esteemed');
                assert.strictEqual(s.familyStatus.carp, 'neutral');      // 0 vs 0
            });
        });

        describe('Domain scoring', () => {
            it('scores +1/-1 by family status with nobles doubled', () => {
                const g = mockGame(['a', 'b'], { a: [], b: [] });
                const d = g.get_data();
                // butterfly esteemed, nightingale fallen, carp neutral
                d.table.butterfly.above = [card('butterfly', 'plain', 1)];
                d.table.nightingale.below = [card('nightingale', 'plain', 1)];
                d.domains['a'] = [
                    card('butterfly', 'plain', 2),   // +1
                    card('butterfly', 'noble', 1),   // +2
                    card('nightingale', 'noble', 1), // -2
                    card('carp', 'plain', 1)         // 0
                ];
                const g2 = GameState.from_data(d, ['a', 'b']);
                g2.finish_game();
                const ps = g2.get_data().score!.players['a'];
                assert.strictEqual(ps.domainScore, 1); // +1 +2 -2 +0
            });
        });

        describe('Secret missions', () => {
            const setup = (mut: (d: GameStateData) => void, missions: Record<string, Mission[]>): GameState => {
                const g = mockGame(['a', 'b'], { a: [], b: [] });
                const d = g.get_data();
                mut(d);
                Object.keys(missions).forEach(p => { d.missions[p] = missions[p]; });
                const g2 = GameState.from_data(d, ['a', 'b']);
                g2.finish_game();
                return g2;
            };

            it('B-family-status: fulfilled when the named family is fallen', () => {
                const g = setup(d => { d.table.toad.below = [card('toad', 'plain', 1)]; },
                    { a: [blueMission('B2')] }); // B2 = toad fallen
                assert.deepStrictEqual(g.get_data().score!.players['a'].fulfilledMissionIds, ['B2']);
            });

            it('B7: 5+ (weighted) cards below counts a noble as 2', () => {
                const g = setup(d => {
                    d.table.hare.below = [
                        card('hare', 'noble', 1), card('hare', 'noble', 2), // 2+2 = 4
                        card('hare', 'plain', 1)                            // +1 = 5 weighted
                    ];
                }, { a: [blueMission('B7')] });
                assert.strictEqual(g.get_data().score!.players['a'].missionScore, 3);
            });

            it('B9: 3-or-fewer esteemed is trivially true in a quiet court', () => {
                const g = setup(() => { /* empty table */ }, { a: [blueMission('B9')] });
                assert.strictEqual(g.get_data().score!.players['a'].missionScore, 3);
            });

            it('W-neighbor: strict greater, ties fail; left neighbour is the next seat', () => {
                // a's left is b. b has 2 toad, a has 1 toad -> fulfilled for a.
                const g = setup(d => {
                    d.domains['b'] = [card('toad', 'plain', 1), card('toad', 'plain', 2)];
                    d.domains['a'] = [card('toad', 'plain', 3)];
                }, { a: [whiteMission('W2')] }); // W2 = toad neighbour compare
                assert.strictEqual(g.get_data().score!.players['a'].missionScore, 3);

                const tie = setup(d => {
                    d.domains['b'] = [card('toad', 'plain', 1)];
                    d.domains['a'] = [card('toad', 'plain', 2)];
                }, { a: [whiteMission('W2')] });
                assert.strictEqual(tie.get_data().score!.players['a'].missionScore, 0);
            });

            it('W-role: counts physical role cards in your own domain', () => {
                const g = setup(d => {
                    d.domains['a'] = [card('carp', 'guard', 1), card('toad', 'guard', 1), card('hare', 'guard', 1), card('stag', 'guard', 1)];
                }, { a: [whiteMission('W10')] }); // W10 = 4+ guards
                assert.strictEqual(g.get_data().score!.players['a'].missionScore, 3);
            });
        });

        describe('Depletion & winner', () => {
            it('ends when the pile is spent and every hand is empty; highest total wins', () => {
                // Two players, each one card in hand, empty pile. Each plays out; then over.
                const g = mockGame(['a', 'b'], {
                    a: [card('butterfly', 'plain', 1)],
                    b: [card('nightingale', 'plain', 1)]
                });
                // Give them a full trio so a legal turn can complete.
                const d = g.get_data();
                d.hands['a'] = [card('butterfly', 'plain', 1), card('butterfly', 'plain', 2), card('butterfly', 'plain', 3)];
                d.hands['b'] = [card('nightingale', 'plain', 1), card('nightingale', 'plain', 2), card('nightingale', 'plain', 3)];
                const g2 = GameState.from_data(d, ['a', 'b']);

                // a: push butterfly esteemed, stock own domain, dump on b.
                g2.place_card('a', 'butterfly.plain.1', 'table', { level: 'above' });
                g2.place_card('a', 'butterfly.plain.2', 'ownDomain');
                g2.place_card('a', 'butterfly.plain.3', 'oppDomain', { targetPlayerId: 'b' });
                assert.strictEqual(g2.get_data().currentPlayerId, 'b');

                // b plays out its trio.
                g2.place_card('b', 'nightingale.plain.1', 'table', { level: 'below' });
                g2.place_card('b', 'nightingale.plain.2', 'ownDomain');
                g2.place_card('b', 'nightingale.plain.3', 'oppDomain', { targetPlayerId: 'a' });

                const s = g2.get_data();
                assert.strictEqual(s.status, 'GameOver');
                // butterfly esteemed (a's own butterfly scores +1; the one dumped on b is
                // butterfly too and scores for b). nightingale fallen.
                assert.ok(s.score, 'scored');
                assert.ok(s.winnerIds.length >= 1);
            });
        });
    });

    describe('Type B: Courtisans Integration Tests', () => {
        it('starts a 2-player game and runs a full three-zone turn', () => {
            const test = new GameRuleTest('courtisans', 1); // host + 1 client = 2 players
            test.invokeHostMethod('startGame');

            let raw = test.getHostData('gameState');
            const playerIds: string[] = raw.playerIds;
            assert.strictEqual(playerIds.length, 2);
            assert.strictEqual(raw.data.status, 'Playing');
            assert.strictEqual(raw.data.currentPlayerId, playerIds[0]); // host acts first

            const hostHand: Card[] = raw.data.hands[playerIds[0]];
            assert.strictEqual(hostHand.length, 3);
            const clientId = test.getPlayerClientId(0);

            // Play each of the three hand cards into a distinct zone, skipping any
            // optional assassin that pops up.
            const zones: Array<[string, any[]]> = [
                [hostHand[0].id, ['table', 'above']],
                [hostHand[1].id, ['ownDomain']],
                [hostHand[2].id, ['oppDomain', undefined, clientId]]
            ];
            for (const [cardId, args] of zones) {
                test.invokeHostMethod('placeCard', cardId, ...args);
                raw = test.getHostData('gameState');
                if (raw.data.pendingAssassin) {
                    test.invokeHostMethod('resolveAssassin'); // skip
                    raw = test.getHostData('gameState');
                }
            }

            raw = test.getHostData('gameState');
            assert.strictEqual(raw.data.currentPlayerId, playerIds[1], 'turn passed to client');
            assert.strictEqual(raw.data.hands[playerIds[0]].length, 3, 'host redrew to 3');
            assert.strictEqual(raw.data.drawPile.length, 51, '54 - 3 drawn');
        });

        it('rejects a client acting out of turn', () => {
            const test = new GameRuleTest('courtisans', 1);
            test.invokeHostMethod('startGame');
            const raw = test.getHostData('gameState');
            const clientHand: Card[] = raw.data.hands[test.getPlayerClientId(0)];
            assert.throws(() => test.invokeClientMethod(0, 'placeCard', clientHand[0].id, 'ownDomain'));
        });
    });
});
