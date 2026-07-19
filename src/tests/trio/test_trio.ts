/**
 * test_trio.ts - Tests for Trio.
 */

import { describe, it } from 'mocha';
import { strict as assert } from 'assert';
import {
    TrioGameState as GameState,
    Phase,
    GameStateData,
    getSetupConfig,
    areConnected,
    CONNECTED_NUMBERS
} from '../../rules/trio/TrioGameState';
import { GameRuleTest } from '../GameRuleTest';

// Build a controlled "Play" state with empty hands / middle, then mutate.
function mockPlay(players: string[], mut: (d: GameStateData) => void, mode: 'simple' | 'spicy' = 'simple'): GameState {
    const g = new GameState(players, mode);
    const d = g.get_data();
    d.status = Phase.Play;
    d.numPlayers = players.length;
    d.mode = mode;
    d.players = {};
    players.forEach(p => { d.players[p] = { hand: [], trios: [] }; });
    d.middle = [];
    d.currentPlayerId = players[0];
    d.firstPlayerIndex = 0;
    d.targetNumber = null;
    d.currentReveals = [];
    d.lastOutcome = null;
    mut(d);
    return GameState.from_data(d, players);
}

describe('Trio Game Logic', () => {
    describe('Type A: TrioGameState Unit Tests', () => {

        describe('Setup & Deal', () => {
            it('deals the correct hand + middle sizes per player count', () => {
                const cases: Array<[number, number, number]> = [
                    // [numPlayers, cardsEach, middle]
                    [3, 9, 9],
                    [4, 7, 8],
                    [5, 6, 6],
                    [6, 5, 6]
                ];
                for (const [n, dealt, middle] of cases) {
                    const cfg = getSetupConfig(n);
                    assert.strictEqual(cfg.dealt, dealt);
                    assert.strictEqual(cfg.middle, middle);

                    const players = Array.from({ length: n }, (_, i) => 'p' + i);
                    const g = new GameState(players, 'simple');
                    g.start_game('simple', 'p0');
                    const d = g.get_data();

                    assert.strictEqual(d.status, Phase.Play);
                    assert.strictEqual(d.currentPlayerId, 'p0');
                    assert.strictEqual(d.middle.length, middle);
                    for (const pid of players) {
                        assert.strictEqual(d.players[pid].hand.length, dealt);
                        // Hands are sorted ascending.
                        const h = d.players[pid].hand;
                        for (let i = 1; i < h.length; i++) assert.ok(h[i] >= h[i - 1]);
                    }

                    // The full 36-card deck is exactly 3 copies of each number 1-12.
                    const counts: Record<number, number> = {};
                    for (const pid of players) for (const c of d.players[pid].hand) counts[c] = (counts[c] || 0) + 1;
                    for (const slot of d.middle) if (slot.card !== null) counts[slot.card] = (counts[slot.card] || 0) + 1;
                    for (let num = 1; num <= 12; num++) assert.strictEqual(counts[num], 3, `three copies of ${num}`);
                }
            });

            it('rejects player counts outside 3-6', () => {
                assert.throws(() => new GameState(['a', 'b'], 'simple').start_game(), /3 to 6/);
                assert.throws(() => getSetupConfig(2), /3 to 6/);
            });
        });

        describe('Revealing', () => {
            it('first reveal sets the target with no match check', () => {
                const g = mockPlay(['a', 'b', 'c'], d => {
                    d.players['a'].hand = [5];
                });
                g.reveal_from_hand('a', 'a', 'low');
                const d = g.get_data();
                assert.strictEqual(d.targetNumber, 5);
                assert.strictEqual(d.currentReveals.length, 1);
                assert.strictEqual(d.players['a'].hand.length, 0);
            });

            it('reveals only the lowest / highest of a hand and exposes the new end', () => {
                const g = mockPlay(['a', 'b', 'c'], d => {
                    d.players['b'].hand = [2, 6, 9];
                });
                // First reveal (from a's own hand would be empty) — use b as the source.
                g.reveal_from_hand('a', 'b', 'high'); // reveals 9
                let d = g.get_data();
                assert.strictEqual(d.currentReveals[0].card, 9);
                assert.deepStrictEqual(d.players['b'].hand, [2, 6]);

                g.reveal_from_hand('a', 'b', 'high'); // now the new highest, 6, but 6 !== 9 -> mismatch
                d = g.get_data();
                assert.strictEqual(d.resolvingMismatch!.number, 9);
                // Both cards are still out (held face-up to memorise) until finish.
                assert.deepStrictEqual(d.players['b'].hand, [2]);

                g.finish_mismatch();
                d = g.get_data();
                assert.strictEqual(d.resolvingMismatch, null);
                assert.deepStrictEqual(d.players['b'].hand, [2, 6, 9]); // returned & re-sorted
            });

            it('completes a trio from three hands, claims it, and advances the turn', () => {
                const g = mockPlay(['a', 'b', 'c'], d => {
                    d.players['a'].hand = [5];
                    d.players['b'].hand = [5, 9];
                    d.players['c'].hand = [5];
                });
                g.reveal_from_hand('a', 'a', 'low');
                g.reveal_from_hand('a', 'b', 'low');
                g.reveal_from_hand('a', 'c', 'low');
                const d = g.get_data();
                assert.deepStrictEqual(d.players['a'].trios, [5]);
                assert.strictEqual(d.lastOutcome!.kind, 'trio');
                assert.deepStrictEqual(d.players['b'].hand, [9]); // the matched 5 was consumed
                assert.strictEqual(d.currentPlayerId, 'b');       // turn advances clockwise
                assert.strictEqual(d.targetNumber, null);
                assert.strictEqual(d.status, Phase.Play);
            });

            it('freezes a mismatch face-up, then finish_mismatch returns everything and advances', () => {
                const g = mockPlay(['a', 'b', 'c'], d => {
                    d.players['a'].hand = [5];
                    d.players['b'].hand = [7];
                    d.middle = [{ card: 5, faceUp: false }];
                });
                g.reveal_from_hand('a', 'a', 'low');  // target 5
                g.reveal_from_middle('a', 0);         // 5, match
                g.reveal_from_hand('a', 'b', 'low');  // 7 -> mismatch (frozen)
                let d = g.get_data();
                assert.strictEqual(d.resolvingMismatch!.number, 5);
                assert.strictEqual(d.currentPlayerId, '');          // nobody acts while frozen
                assert.strictEqual(d.middle[0].faceUp, true);       // still face-up to memorise
                assert.deepStrictEqual(d.players['a'].hand, []);    // cards not yet returned

                // A stray reveal is rejected while frozen.
                assert.throws(() => g.reveal_from_hand('b', 'b', 'low'), /not your turn/);

                g.finish_mismatch();
                d = g.get_data();
                assert.strictEqual(d.resolvingMismatch, null);
                assert.deepStrictEqual(d.players['a'].hand, [5]);   // returned
                assert.deepStrictEqual(d.players['b'].hand, [7]);   // returned
                assert.strictEqual(d.middle[0].faceUp, false);      // flipped back down
                assert.strictEqual(d.middle[0].card, 5);            // still there
                assert.strictEqual(d.currentPlayerId, 'b');         // turn advanced
            });

            it('finish_mismatch is idempotent (guards against animation races)', () => {
                const g = mockPlay(['a', 'b', 'c'], d => {
                    d.players['a'].hand = [5];
                    d.players['b'].hand = [7];
                });
                g.reveal_from_hand('a', 'a', 'low');
                g.reveal_from_hand('a', 'b', 'low'); // mismatch
                g.finish_mismatch();
                const first = g.get_data();
                g.finish_mismatch();                 // no-op
                const second = g.get_data();
                assert.deepStrictEqual(second.players, first.players);
                assert.strictEqual(second.currentPlayerId, first.currentPlayerId);
            });

            it('empties middle slots when they are part of a trio', () => {
                const g = mockPlay(['a', 'b', 'c'], d => {
                    d.players['a'].hand = [8];
                    d.middle = [{ card: 8, faceUp: false }, { card: 8, faceUp: false }];
                });
                g.reveal_from_middle('a', 0);
                g.reveal_from_middle('a', 1);
                g.reveal_from_hand('a', 'a', 'low');
                const d = g.get_data();
                assert.deepStrictEqual(d.players['a'].trios, [8]);
                assert.strictEqual(d.middle[0].card, null);
                assert.strictEqual(d.middle[1].card, null);
            });
        });

        describe('Turn order & validation', () => {
            it('rotates clockwise and still gives an empty-handed player a turn', () => {
                const g = mockPlay(['a', 'b', 'c'], d => {
                    d.players['a'].hand = [5];
                    d.players['b'].hand = [7];
                    // c has no cards.
                });
                g.reveal_from_hand('a', 'a', 'low'); // target 5
                g.reveal_from_hand('a', 'b', 'low'); // 7 -> mismatch (frozen)
                g.finish_mismatch();                 // return, turn -> b
                assert.strictEqual(g.get_data().currentPlayerId, 'b');

                g.reveal_from_hand('b', 'b', 'low'); // b opens with 7
                g.reveal_from_hand('b', 'a', 'low'); // 5 != 7 -> mismatch (frozen)
                g.finish_mismatch();                 // return, turn -> c (empty hand)
                assert.strictEqual(g.get_data().currentPlayerId, 'c');
            });

            it('rejects out-of-turn, empty-hand, and already-revealed actions', () => {
                const g = mockPlay(['a', 'b', 'c'], d => {
                    d.players['a'].hand = [3];
                    d.middle = [{ card: 4, faceUp: true }];
                });
                assert.throws(() => g.reveal_from_hand('b', 'b', 'low'), /not your turn/);
                assert.throws(() => g.reveal_from_hand('a', 'b', 'low'), /no cards/);
                assert.throws(() => g.reveal_from_middle('a', 0), /already face-up/);
            });
        });

        describe('Win conditions', () => {
            it('the 7 trio wins instantly (simple mode)', () => {
                const g = mockPlay(['a', 'b', 'c'], d => {
                    d.players['a'].hand = [7];
                    d.players['b'].hand = [7];
                    d.players['c'].hand = [7];
                });
                g.reveal_from_hand('a', 'a', 'low');
                g.reveal_from_hand('a', 'b', 'low');
                g.reveal_from_hand('a', 'c', 'low');
                const d = g.get_data();
                assert.strictEqual(d.status, Phase.GameOver);
                assert.strictEqual(d.winnerId, 'a');
                assert.strictEqual(d.winReason, 'seven');
                assert.deepStrictEqual(d.winningTrios, [7]);
            });

            it('simple mode wins on the 3rd trio', () => {
                const g = mockPlay(['a', 'b', 'c'], d => {
                    d.players['a'].trios = [1, 2];
                    d.players['a'].hand = [3];
                    d.players['b'].hand = [3];
                    d.players['c'].hand = [3];
                });
                g.reveal_from_hand('a', 'a', 'low');
                g.reveal_from_hand('a', 'b', 'low');
                g.reveal_from_hand('a', 'c', 'low');
                const d = g.get_data();
                assert.strictEqual(d.status, Phase.GameOver);
                assert.strictEqual(d.winReason, 'count');
                assert.strictEqual(d.players['a'].trios.length, 3);
            });

            it('spicy mode wins on two connected trios but not on unconnected ones', () => {
                // Connected when sum or difference is 7: 3 + 4 = 7, but 3 & 6 are not.
                assert.ok(areConnected(3, 4));
                assert.ok(!areConnected(3, 6));

                const win = mockPlay(['a', 'b', 'c'], d => {
                    d.players['a'].trios = [3];
                    d.players['a'].hand = [4];
                    d.players['b'].hand = [4];
                    d.players['c'].hand = [4];
                }, 'spicy');
                win.reveal_from_hand('a', 'a', 'low');
                win.reveal_from_hand('a', 'b', 'low');
                win.reveal_from_hand('a', 'c', 'low');
                let d = win.get_data();
                assert.strictEqual(d.status, Phase.GameOver);
                assert.strictEqual(d.winReason, 'connected');
                assert.deepStrictEqual(d.winningTrios!.sort((x, y) => x - y), [3, 4]);

                const noWin = mockPlay(['a', 'b', 'c'], d => {
                    d.players['a'].trios = [3];
                    d.players['a'].hand = [6];
                    d.players['b'].hand = [6];
                    d.players['c'].hand = [6, 10]; // leftover card so cards aren't exhausted
                }, 'spicy');
                noWin.reveal_from_hand('a', 'a', 'low');
                noWin.reveal_from_hand('a', 'b', 'low');
                noWin.reveal_from_hand('a', 'c', 'low');
                d = noWin.get_data();
                assert.strictEqual(d.status, Phase.Play);      // no win
                assert.strictEqual(d.currentPlayerId, 'b');    // turn advanced
                assert.deepStrictEqual(d.players['a'].trios.sort((x, y) => x - y), [3, 6]);
            });

            it('connects trios whose sum or difference is 7', () => {
                // Sum-to-7 partners.
                assert.ok(areConnected(2, 5));   // 2 + 5 = 7
                assert.ok(areConnected(1, 6));   // 1 + 6 = 7
                assert.ok(areConnected(3, 4));   // 3 + 4 = 7
                // Difference-of-7 partners.
                assert.ok(areConnected(2, 9));   // 9 − 2 = 7
                assert.ok(areConnected(5, 12));  // 12 − 5 = 7
                assert.ok(areConnected(1, 8));   // 8 − 1 = 7
                // The example from the rules: a 12 trio and a 5 trio win.
                assert.ok(areConnected(12, 5));
                // Non-connections.
                assert.ok(!areConnected(3, 6));
                assert.ok(!areConnected(4, 4));  // a number is not connected to itself
                assert.ok(!areConnected(2, 10));

                // Symmetry, and 7 has no partner (it wins instantly on its own).
                for (let n = 1; n <= 12; n++) {
                    for (const m of CONNECTED_NUMBERS[n]) {
                        assert.ok(CONNECTED_NUMBERS[m].includes(n));
                    }
                }
                assert.strictEqual(CONNECTED_NUMBERS[7].length, 0);
            });
        });
    });

    describe('Type B: Trio Integration Tests', () => {
        it('starts a 3-player game and processes a first reveal', () => {
            const test = new GameRuleTest('trio', 2); // host + 2 clients = 3 players
            test.invokeHostMethod('startGame');

            let raw = test.getHostData('gameState');
            const playerIds: string[] = raw.playerIds;
            assert.strictEqual(playerIds.length, 3);
            assert.strictEqual(raw.data.status, Phase.Play);
            assert.strictEqual(raw.data.middle.length, 9);

            const leader = raw.data.currentPlayerId;
            const leaderHand: number[] = raw.data.players[leader].hand;
            const low = leaderHand[0];

            if (leader === playerIds[0]) {
                test.invokeHostMethod('revealHand', leader, 'low');
            } else {
                test.invokeClientMethod(playerIds.indexOf(leader) - 1, 'revealHand', leader, 'low');
            }

            raw = test.getHostData('gameState');
            assert.strictEqual(raw.data.currentReveals.length, 1);
            assert.strictEqual(raw.data.targetNumber, low);
            assert.strictEqual(raw.data.currentReveals[0].card, low);
        });

        it('lets the host pick the Spicy mode before starting', () => {
            const test = new GameRuleTest('trio', 2);
            test.invokeHostMethod('setMode', 'spicy');
            test.invokeHostMethod('startGame');
            const raw = test.getHostData('gameState');
            assert.strictEqual(raw.data.mode, 'spicy');
        });
    });
});
