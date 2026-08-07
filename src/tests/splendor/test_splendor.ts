/**
 * test_splendor.ts - Comprehensive tests for Splendor (base game, 2-4 players).
 */

import { describe, it } from 'mocha';
import { strict as assert } from 'assert';
import {
    SplendorGameState as GameState, GameStatus, Card, Noble, getAllCards, getAllNobles
} from '../../rules/splendor/SplendorGameState';
import { GameRuleTest } from '../GameRuleTest';

describe('Splendor Game Logic', () => {
    describe('Type A: SplendorGameState Unit Tests', () => {
        describe('Dataset integrity', () => {
            it('should contain 90 cards (40/30/20) and 10 nobles with the documented totals', () => {
                const cards = getAllCards();
                assert.strictEqual(cards.length, 90);
                assert.strictEqual(cards.filter(c => c.level === 1).length, 40);
                assert.strictEqual(cards.filter(c => c.level === 2).length, 30);
                assert.strictEqual(cards.filter(c => c.level === 3).length, 20);

                // Per-colour cost total = 117; total VP across all cards = 140.
                const colors = ['white', 'blue', 'green', 'red', 'black'] as const;
                for (const col of colors) {
                    const total = cards.reduce((s, c) => s + ((c.cost as any)[col] || 0), 0);
                    assert.strictEqual(total, 117, `Total ${col} cost across all cards must be 117`);
                }
                const totalVp = cards.reduce((s, c) => s + c.pts, 0);
                assert.strictEqual(totalVp, 140);

                // Each bonus colour has 8 / 6 / 4 cards at L1 / L2 / L3.
                for (const col of colors) {
                    assert.strictEqual(cards.filter(c => c.level === 1 && c.bonus === col).length, 8);
                    assert.strictEqual(cards.filter(c => c.level === 2 && c.bonus === col).length, 6);
                    assert.strictEqual(cards.filter(c => c.level === 3 && c.bonus === col).length, 4);
                }

                const nobles = getAllNobles();
                assert.strictEqual(nobles.length, 10);
                assert.strictEqual(nobles.reduce((s, n) => s + n.pts, 0), 30);
                for (const col of colors) {
                    const total = nobles.reduce((s, n) => s + ((n.req as any)[col] || 0), 0);
                    assert.strictEqual(total, 17, `Summed ${col} noble requirement must be 17`);
                }
            });
        });

        describe('Setup by player count', () => {
            it('should set supply, board and nobles by player count', () => {
                const configs: Array<[string[], number, number]> = [
                    [['a', 'b'], 4, 3],
                    [['a', 'b', 'c'], 5, 4],
                    [['a', 'b', 'c', 'd'], 7, 5]
                ];
                for (const [players, perColor, nobleCount] of configs) {
                    const g = new GameState(players);
                    g.start_game('a');
                    const d = g.get_data();
                    assert.strictEqual(d.status, GameStatus.Active);
                    assert.strictEqual(d.currentPlayerId, 'a');
                    for (const c of ['white', 'blue', 'green', 'red', 'black'] as const) {
                        assert.strictEqual(d.supply[c], perColor, `${players.length}p ${c} supply`);
                    }
                    assert.strictEqual(d.supply.gold, 5);
                    assert.strictEqual(d.nobles.length, nobleCount);
                    for (const lvl of [1, 2, 3] as const) {
                        assert.strictEqual(d.board[lvl].filter(c => c !== null).length, 4);
                    }
                }
            });
        });

        describe('Action A/B - Take tokens', () => {
            it('take3 removes one of each colour from the supply', () => {
                const g = new GameState(['a', 'b']);
                g.start_game('a');
                g.take3('a', ['white', 'blue', 'green']);
                const d = g.get_data();
                assert.strictEqual(d.players['a'].tokens.white, 1);
                assert.strictEqual(d.players['a'].tokens.blue, 1);
                assert.strictEqual(d.players['a'].tokens.green, 1);
                assert.strictEqual(d.supply.white, 3);
                assert.strictEqual(d.currentPlayerId, 'b', 'turn passes');
            });

            it('take3 rejects duplicate colours', () => {
                const g = new GameState(['a', 'b']);
                g.start_game('a');
                assert.throws(() => g.take3('a', ['white', 'white', 'green']), /different colours/);
            });

            it('take2 requires at least 4 in the supply', () => {
                const g = new GameState(['a', 'b']); // 2p => 4 of each
                g.start_game('a');
                g.take2('a', 'red'); // 4 available -> ok
                let d = g.get_data();
                assert.strictEqual(d.players['a'].tokens.red, 2);
                assert.strictEqual(d.supply.red, 2);

                // Now only 2 red left; a later take2 on red must fail.
                d.currentPlayerId = 'a';
                const g2 = GameState.from_data(d, ['a', 'b']);
                assert.throws(() => g2.take2('a', 'red'), /at least 4/);
            });

            it('cannot take gold via take actions', () => {
                const g = new GameState(['a', 'b']);
                g.start_game('a');
                assert.throws(() => g.take3('a', ['gold' as any]), /Invalid gem colour/);
            });
        });

        describe('Action C - Reserve', () => {
            it('reserves a board card, refills the slot and grants 1 gold', () => {
                const g = new GameState(['a', 'b']);
                g.start_game('a');
                const d = g.get_data();
                const target = d.board[1][0]!;
                const goldBefore = d.supply.gold;

                g.reserve('a', 'board', target.id, null);
                const nd = g.get_data();
                assert.strictEqual(nd.players['a'].reserved.length, 1);
                assert.strictEqual(nd.players['a'].reserved[0].id, target.id);
                assert.strictEqual(nd.players['a'].tokens.gold, 1);
                assert.strictEqual(nd.supply.gold, goldBefore - 1);
                assert.ok(nd.board[1][0] !== null, 'slot refilled');
                assert.notStrictEqual(nd.board[1][0]!.id, target.id);
            });

            it('blocks a 4th reserve', () => {
                const g = new GameState(['a', 'b']);
                g.start_game('a');
                const d = g.get_data();
                d.players['a'].reserved = [getAllCards()[0], getAllCards()[1], getAllCards()[2]];
                const g2 = GameState.from_data(d, ['a', 'b']);
                assert.throws(() => g2.reserve('a', 'deck', null, 1), /more than 3/);
            });
        });

        describe('Action D - Buy', () => {
            it('spends gems (after bonus discount) and returns them to the supply', () => {
                const g = new GameState(['a', 'b']);
                g.start_game('a');
                const d = g.get_data();
                d.players['a'].tokens = { white: 0, blue: 3, green: 0, red: 0, black: 0, gold: 0 };
                // one green bonus card discounts green by 1
                d.players['a'].cards = [{ id: 'BON', level: 1, bonus: 'green', pts: 0, cost: {} }];
                const target: Card = { id: 'TGT', level: 1, bonus: 'red', pts: 1, cost: { blue: 3, green: 1 } };
                d.board[1][0] = target;
                const blueSupplyBefore = d.supply.blue;

                const g2 = GameState.from_data(d, ['a', 'b']);
                g2.buy('a', 'board', 'TGT');
                const nd = g2.get_data();
                assert.strictEqual(nd.players['a'].tokens.blue, 0, 'spent 3 blue');
                assert.strictEqual(nd.supply.blue, blueSupplyBefore + 3, '3 blue returned to supply');
                assert.ok(nd.players['a'].cards.some(c => c.id === 'TGT'));
            });

            it('covers a shortfall with gold', () => {
                const g = new GameState(['a', 'b']);
                g.start_game('a');
                const d = g.get_data();
                d.players['a'].tokens = { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 1 };
                d.board[1][0] = { id: 'TGT', level: 1, bonus: 'red', pts: 1, cost: { red: 1 } };
                const g2 = GameState.from_data(d, ['a', 'b']);
                g2.buy('a', 'board', 'TGT');
                const nd = g2.get_data();
                assert.strictEqual(nd.players['a'].tokens.gold, 0, 'gold spent');
                assert.strictEqual(nd.supply.gold, d.supply.gold + 1);
            });

            it('rejects an unaffordable card', () => {
                const g = new GameState(['a', 'b']);
                g.start_game('a');
                const d = g.get_data();
                d.players['a'].tokens = { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 };
                d.board[1][0] = { id: 'TGT', level: 1, bonus: 'red', pts: 1, cost: { red: 1 } };
                const g2 = GameState.from_data(d, ['a', 'b']);
                assert.throws(() => g2.buy('a', 'board', 'TGT'), /cannot afford/);
            });
        });

        describe('Nobles', () => {
            it('awards a noble automatically when its bonus requirement is met', () => {
                const g = new GameState(['a', 'b']);
                g.start_game('a');
                const d = g.get_data();
                // Alice already has 3 blue + 3 green bonuses (via mock cards). Buying one
                // more will re-run the noble check; give her a matching noble N05 (u4 g4)? no,
                // use N08 (w3 u3 g3) after adding 3 white. Simpler: N02 blue/green/red 3 each.
                const mk = (bonus: any, i: number): Card => ({ id: `B${bonus}${i}`, level: 1, bonus, pts: 0, cost: {} });
                d.players['a'].cards = [
                    mk('blue', 1), mk('blue', 2), mk('blue', 3),
                    mk('green', 1), mk('green', 2), mk('green', 3),
                    mk('red', 1), mk('red', 2)
                ];
                d.players['a'].tokens = { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 1 };
                d.nobles = [{ id: 'N02', pts: 3, req: { blue: 3, green: 3, red: 3 } }];
                // Buy a red card (3rd red bonus) -> qualifies for N02.
                d.board[1][0] = { id: 'REDX', level: 1, bonus: 'red', pts: 0, cost: { black: 1 } };
                d.players['a'].tokens.gold = 1; // pay black:1 with gold

                const g2 = GameState.from_data(d, ['a', 'b']);
                g2.buy('a', 'board', 'REDX');
                const nd = g2.get_data();
                assert.strictEqual(nd.players['a'].nobles.length, 1);
                assert.strictEqual(nd.players['a'].nobles[0].id, 'N02');
                assert.strictEqual(nd.nobles.length, 0);
                assert.strictEqual(nd.currentPlayerId, 'b');
            });

            it('prompts a choice on a multi-noble tie', () => {
                const g = new GameState(['a', 'b']);
                g.start_game('a');
                const d = g.get_data();
                const mk = (bonus: any, i: number): Card => ({ id: `B${bonus}${i}`, level: 1, bonus, pts: 0, cost: {} });
                // 3 white, 2 blue, 3 green, 2 red bonuses; buying a card that grants blue AND
                // is impossible — instead give both nobles reachable by the same purchase.
                d.players['a'].cards = [
                    mk('white', 1), mk('white', 2), mk('white', 3),
                    mk('blue', 1), mk('blue', 2),
                    mk('green', 1), mk('green', 2), mk('green', 3)
                ];
                // N08 needs white3 blue3 green3; N01 needs white3 blue3 black3 (not reachable).
                // Use two nobles that a single blue purchase satisfies: N08 (w3 u3 g3) and
                // N10 (w4 u4) is not reachable. Use N08 and a custom-ish standard N05 (u4 g4)? no.
                // Simplest deterministic tie: two nobles both = white3 blue3 green3 shape variants.
                d.nobles = [
                    { id: 'NA', pts: 3, req: { white: 3, blue: 3, green: 3 } },
                    { id: 'NB', pts: 3, req: { blue: 3, green: 3 } }
                ];
                d.players['a'].tokens = { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 1 };
                d.board[1][0] = { id: 'BLUEX', level: 1, bonus: 'blue', pts: 0, cost: { black: 1 } };

                const g2 = GameState.from_data(d, ['a', 'b']);
                g2.buy('a', 'board', 'BLUEX');
                let nd = g2.get_data();
                assert.strictEqual(nd.status, GameStatus.PendingNoble);
                assert.deepStrictEqual(nd.pendingNobleIds.sort(), ['NA', 'NB']);

                g2.select_noble('a', 'NB');
                nd = g2.get_data();
                assert.strictEqual(nd.status, GameStatus.Active);
                assert.strictEqual(nd.players['a'].nobles.length, 1);
                assert.strictEqual(nd.players['a'].nobles[0].id, 'NB');
                assert.strictEqual(nd.nobles.length, 1, 'the other noble remains');
                assert.strictEqual(nd.currentPlayerId, 'b');
            });
        });

        describe('Token overflow', () => {
            it('forces a discard down to 10 at end of turn', () => {
                const g = new GameState(['a', 'b']);
                g.start_game('a');
                const d = g.get_data();
                // Alice holds 9 tokens; take3 => 12 total, must discard 2.
                d.players['a'].tokens = { white: 3, blue: 3, green: 3, red: 0, black: 0, gold: 0 };
                d.supply.red = 4; d.supply.black = 4; d.supply.white = 4;
                const g2 = GameState.from_data(d, ['a', 'b']);
                g2.take3('a', ['red', 'black', 'white']);
                let nd = g2.get_data();
                assert.strictEqual(nd.status, GameStatus.PendingDiscard);
                assert.strictEqual(nd.currentPlayerId, 'a', 'still Alice until she discards');

                g2.discard_tokens('a', ['white', 'white']);
                nd = g2.get_data();
                assert.strictEqual(nd.status, GameStatus.Active);
                assert.strictEqual(nd.currentPlayerId, 'b');
                let total = 0;
                for (const k in nd.players['a'].tokens) total += (nd.players['a'].tokens as any)[k];
                assert.strictEqual(total, 10);
            });
        });

        describe('End game', () => {
            it('triggers at 15 VP and finishes the round before ending', () => {
                const g = new GameState(['a', 'b']);
                g.start_game('a'); // a is first player; b takes the final turn
                const d = g.get_data();
                d.players['a'].cards = [{ id: 'MEGA', level: 3, bonus: 'blue', pts: 14, cost: {} }];
                d.players['a'].tokens = { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 1 };
                d.board[1][0] = { id: 'CHEAP', level: 1, bonus: 'red', pts: 1, cost: { red: 1 } };

                const g2 = GameState.from_data(d, ['a', 'b']);
                g2.buy('a', 'board', 'CHEAP'); // a reaches 15 -> end triggered, but b still plays
                let nd = g2.get_data();
                assert.strictEqual(nd.endTriggered, true);
                assert.strictEqual(nd.status, GameStatus.Active);
                assert.strictEqual(nd.currentPlayerId, 'b');

                g2.take3('b', ['white', 'blue', 'green']); // b finishes the round -> game over
                nd = g2.get_data();
                assert.strictEqual(nd.status, GameStatus.GameOver);
                assert.deepStrictEqual(nd.winnerIds, ['a']);
            });

            it('breaks ties by fewest cards purchased', () => {
                const g = new GameState(['a', 'b']);
                g.start_game('a');
                const d = g.get_data();
                // Both reach 15; a with 3 cards, b with 2 cards -> b wins.
                d.players['a'].cards = [
                    { id: 'a1', level: 3, bonus: 'blue', pts: 5, cost: {} },
                    { id: 'a2', level: 3, bonus: 'blue', pts: 5, cost: {} },
                    { id: 'a3', level: 3, bonus: 'blue', pts: 5, cost: {} }
                ];
                d.players['b'].cards = [
                    { id: 'b1', level: 3, bonus: 'red', pts: 7, cost: {} },
                    { id: 'b2', level: 3, bonus: 'red', pts: 8, cost: {} }
                ];
                d.endTriggered = true;
                d.currentPlayerId = 'b'; // b is last in round (a is first) -> finishing now ends game
                d.players['b'].tokens = { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 1 };
                d.board[1][0] = { id: 'x', level: 1, bonus: 'green', pts: 0, cost: { green: 1 } };
                d.supply.green = 4;

                const g2 = GameState.from_data(d, ['a', 'b']);
                g2.take3('b', ['white', 'blue', 'red']); // b ends the round
                const nd = g2.get_data();
                assert.strictEqual(nd.status, GameStatus.GameOver);
                assert.deepStrictEqual(nd.winnerIds, ['b'], 'b wins the 15-15 tie on fewer cards');
            });
        });
    });

    describe('Type B: Splendor Integration Tests (Multiplayr Room Simulation)', () => {
        it('runs a full take-tokens turn cycle across the room', () => {
            const t = new GameRuleTest('splendor', 2); // 3 players total: host + 2 clients
            t.invokeHostMethod('startGame');

            const state = t.getHostData('gameState');
            const activeId = state.data.currentPlayerId;
            const p0 = state.playerIds[0];
            const clientId0 = t.getPlayerClientId(0);
            const clientId1 = t.getPlayerClientId(1);

            const order = state.playerIds;
            const nextId = order[(order.indexOf(activeId) + 1) % order.length];

            const take = (id: string) => {
                if (id === p0) t.invokeHostMethod('take3', ['white', 'blue', 'green']);
                else if (id === clientId0) t.invokeClientMethod(0, 'take3', ['white', 'blue', 'green']);
                else if (id === clientId1) t.invokeClientMethod(1, 'take3', ['white', 'blue', 'green']);
            };

            take(activeId);
            const nd = t.getHostData('gameState');
            assert.strictEqual(nd.data.currentPlayerId, nextId, 'turn advances to the next player');
            assert.strictEqual(nd.data.players[activeId].tokens.white, 1);
        });
    });
});
