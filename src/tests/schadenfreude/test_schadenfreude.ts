/**
 * test_schadenfreude.ts - Tests for "Seconds, Please!" (Schadenfreude rules).
 */

import { describe, it } from 'mocha';
import { strict as assert } from 'assert';
import {
    SchadenfreudeGameState as GameState,
    Phase,
    Card,
    CardSuit,
    TrickPlay,
    GameStateData,
    buildDeck,
    getDealConfig,
    rankTrick,
    applyToPlate,
    plateTotal
} from '../../rules/schadenfreude/SchadenfreudeGameState';
import { GameRuleTest } from '../GameRuleTest';

let nextId = 1000;
const c = (suit: CardSuit, value: number): Card => ({ id: nextId++, suit, value });
const play = (playerId: string, card: Card): TrickPlay => ({ playerId, card });

const PLAYERS = ['a', 'b', 'c', 'd'];

// Build a controlled mid-round Play state with explicit hands.
function mockPlay(hands: Record<string, Card[]>, mut?: (d: GameStateData) => void): GameState {
    const ids = Object.keys(hands);
    const g = new GameState(ids);
    g.start_game(ids[0]);
    const d = g.get_data();
    ids.forEach(id => {
        d.players[id].hand = hands[id];
        d.players[id].plate = [];
    });
    d.currentPlayerId = ids[0];
    d.trickLeaderId = ids[0];
    d.totalTricks = Math.max(...ids.map(id => hands[id].length));
    if (mut) mut(d);
    return GameState.from_data(d, ids);
}

// Play every player's single listed card in seat order, then commit the trick.
function playTrick(g: GameState, cards: Record<string, Card>) {
    let d = g.get_data();
    for (let i = 0; i < d.playerIds.length; i++) {
        d = g.get_data();
        const pid = d.currentPlayerId;
        g.play_card(pid, cards[pid].id);
    }
}

describe('Seconds, Please! (Schadenfreude) Game Logic', () => {
    describe('Type A: SchadenfreudeGameState Unit Tests', () => {

        describe('Setup & Deal', () => {
            it('builds the right deck and hands per player count', () => {
                const cases: Array<[number, number, number, number]> = [
                    // [players, deckSize, handSize, setAside]
                    [3, 38, 12, 2],
                    [4, 50, 12, 2],
                    [5, 50, 10, 0]
                ];
                for (const [n, deckSize, handSize, aside] of cases) {
                    const cfg = getDealConfig(n);
                    assert.deepStrictEqual(cfg, { handSize, setAside: aside, deckSize });
                    assert.strictEqual(buildDeck(n).length, deckSize);

                    const ids = Array.from({ length: n }, (_, i) => 'p' + i);
                    const g = new GameState(ids);
                    g.start_game();
                    const d = g.get_data();
                    assert.strictEqual(d.status, Phase.Play);
                    const all = new Set<number>();
                    ids.forEach(id => {
                        assert.strictEqual(d.players[id].hand.length, handSize);
                        d.players[id].hand.forEach(card => all.add(card.id));
                    });
                    assert.strictEqual(all.size, handSize * n, 'no duplicate card dealt');
                    assert.ok(ids.includes(d.currentPlayerId));
                }
            });

            it('removes −2, −1 and 9 of each suit with 3 players', () => {
                const deck = buildDeck(3);
                assert.ok(!deck.some(card => card.suit !== 'wild' && [-2, -1, 9].includes(card.value)));
                assert.strictEqual(deck.filter(card => card.suit === 'wild').length, 2);
            });

            it('rejects fewer than 3 or more than 5 players', () => {
                assert.throws(() => new GameState(['a', 'b']).start_game());
                assert.throws(() => new GameState(['a', 'b', 'c', 'd', 'e', 'f']).start_game());
            });
        });

        describe('Trick winner (second-highest)', () => {
            it('suit following example: red 4, 7, 9 + green 8 → the 7 wins', () => {
                const r = rankTrick([
                    play('a', c('berry', 4)), play('b', c('berry', 7)),
                    play('c', c('berry', 9)), play('d', c('mint', 8))
                ], 'berry');
                assert.strictEqual(r.winner.playerId, 'b');
            });

            it('a lone lead-suit card wins', () => {
                const r = rankTrick([
                    play('a', c('berry', 4)), play('b', c('mint', 9)),
                    play('c', c('lemon', 8)), play('d', c('blueberry', 7))
                ], 'berry');
                assert.strictEqual(r.winner.playerId, 'a');
            });

            it('the Rainbow 10 counts as the highest lead card', () => {
                const r = rankTrick([
                    play('a', c('berry', 4)), play('b', c('berry', 7)),
                    play('c', c('berry', 9)), play('d', c('wild', 10))
                ], 'berry');
                assert.strictEqual(r.winner.playerId, 'c');
            });

            it('the Rainbow 0 can be the second-highest and win', () => {
                const r = rankTrick([
                    play('a', c('berry', 4)), play('b', c('wild', 0)),
                    play('c', c('mint', 8))
                ], 'berry');
                assert.strictEqual(r.winner.playerId, 'b');
            });
        });

        describe('Plates & twin cancellation', () => {
            it('cancels a value already on the plate (rulebook example)', () => {
                const plate = [c('mint', 6), c('lemon', 9), c('blueberry', 7)];
                const r = applyToPlate(plate, [c('mint', 3), c('berry', 7)]);
                assert.deepStrictEqual(r.plate.map(x => x.value).sort(), [3, 6, 9]);
                assert.strictEqual(r.cancelIds.length, 2);
            });

            it('two of a value cancel; three of a value leave one', () => {
                assert.strictEqual(applyToPlate([], [c('mint', 5), c('lemon', 5)]).plate.length, 0);
                const three = applyToPlate([], [c('mint', 5), c('lemon', 5), c('berry', 5)]);
                assert.strictEqual(three.plate.length, 1);
                assert.strictEqual(three.cancelIds.length, 2);
            });
        });

        describe('Play flow', () => {
            it('enforces following suit, but Rainbows are always allowed', () => {
                const g = mockPlay({
                    a: [c('berry', 4), c('mint', 1)],
                    b: [c('berry', 7), c('mint', 2), c('wild', 10)],
                    c: [c('lemon', 3), c('mint', 3)],
                    d: [c('blueberry', 5), c('mint', 4)]
                });
                const d0 = g.get_data();
                g.play_card('a', d0.players.a.hand[0].id); // lead berry 4
                const b = g.get_data().players.b.hand;
                const legal = g.get_legal_card_ids('b');
                assert.deepStrictEqual(legal.sort(), [b[0].id, b[2].id].sort());
                assert.throws(() => g.play_card('b', b[1].id), /follow/);
                // c is void in berry → anything goes
                g.play_card('b', b[0].id);
                assert.strictEqual(g.get_legal_card_ids('c').length, 2);
                assert.throws(() => g.play_card('d', g.get_data().players.d.hand[0].id), /turn/);
            });

            it('a Rainbow lead lets the next standard card set the suit', () => {
                const w = c('wild', 10), r7 = c('berry', 7), r9 = c('berry', 9), r4 = c('berry', 4);
                const g = mockPlay({ a: [w, c('mint', 1)], b: [r7, c('mint', 2)], c: [r9, c('mint', 3)], d: [r4, c('mint', 4)] });
                g.play_card('a', w.id);
                assert.strictEqual(g.get_data().leadSuit, null);
                assert.strictEqual(g.get_legal_card_ids('b').length, 2, 'suit not yet set');
                g.play_card('b', r7.id);
                assert.strictEqual(g.get_data().leadSuit, 'berry');
                g.play_card('c', r9.id);
                g.play_card('d', r4.id);
                const rt = g.get_data().resolvingTrick!;
                assert.strictEqual(rt.winnerId, 'c', 'the red 9 is second behind the Rainbow 10');
            });

            it('winner takes own card + off-suit non-Rainbows; others are discarded', () => {
                const r5 = c('berry', 5), g3 = c('mint', 3), r9 = c('berry', 9), r7 = c('berry', 7);
                const g = mockPlay({ a: [r5, c('mint', 1)], b: [g3, c('lemon', 2)], c: [r9, c('lemon', 3)], d: [r7, c('lemon', 4)] });
                playTrick(g, { a: r5, b: g3, c: r9, d: r7 });
                let d = g.get_data();
                const rt = d.resolvingTrick!;
                assert.strictEqual(rt.winnerId, 'd');
                assert.deepStrictEqual(rt.takenIds.sort(), [r7.id, g3.id].sort());
                assert.deepStrictEqual(rt.discardIds.sort(), [r5.id, r9.id].sort());
                assert.throws(() => g.play_card('d', d.players.d.hand[0].id), /cleared/);

                g.finish_trick();
                g.finish_trick(); // idempotent
                d = g.get_data();
                assert.strictEqual(d.resolvingTrick, null);
                assert.deepStrictEqual(d.players.d.plate.map(x => x.value).sort(), [3, 7]);
                assert.strictEqual(d.currentPlayerId, 'd', 'winner leads next');
                assert.strictEqual(d.trickNumber, 2);
                assert.strictEqual(d.trickHistory.length, 1);
            });

            it('Rainbows are discarded unless they won', () => {
                const r5 = c('berry', 5), r2 = c('berry', 2), w10 = c('wild', 10), r7 = c('berry', 7);
                const g = mockPlay({ a: [r5], b: [r2], c: [w10], d: [r7] });
                playTrick(g, { a: r5, b: r2, c: w10, d: r7 });
                const rt = g.get_data().resolvingTrick!;
                assert.strictEqual(rt.winnerId, 'd');
                assert.deepStrictEqual(rt.takenIds, [r7.id]);
            });

            it('reports twin cancellations during resolution and applies them on finish', () => {
                const r5 = c('berry', 5), g7 = c('mint', 7), r9 = c('berry', 9), r7 = c('berry', 7);
                const g = mockPlay({ a: [r5, c('mint', 1)], b: [g7, c('lemon', 2)], c: [r9, c('lemon', 3)], d: [r7, c('lemon', 4)] });
                playTrick(g, { a: r5, b: g7, c: r9, d: r7 });
                const rt = g.get_data().resolvingTrick!;
                assert.strictEqual(rt.winnerId, 'd');
                assert.deepStrictEqual(rt.cancelIds.sort(), [g7.id, r7.id].sort());
                g.finish_trick();
                assert.strictEqual(g.get_data().players.d.plate.length, 0);
            });
        });

        describe('Round end & game end', () => {
            function endRoundWith(scores: Record<string, number>, plates: Record<string, Card[]>) {
                // One last trick left: each player holds a single card; a leads berry 1.
                const last = { a: c('berry', 1), b: c('lemon', 1), c: c('lemon', 2), d: c('lemon', 3) };
                const g = mockPlay({ a: [last.a], b: [last.b], c: [last.c], d: [last.d] }, d => {
                    PLAYERS.forEach(id => {
                        d.players[id].score = scores[id];
                        d.players[id].plate = plates[id] || [];
                    });
                });
                // a wins alone (only berry card) and takes lemon 1, 2, 3 → but a has berry 1, lemon 1 cancels.
                playTrick(g, last);
                g.finish_trick();
                return g;
            }

            it('scores plates, floors at 0, and goes to RoundEnd when nobody busts', () => {
                const g = endRoundWith({ a: 10, b: 2, c: 20, d: 5 }, {
                    b: [c('mint', -3), c('lemon', -2)],
                    c: [c('mint', 9), c('lemon', 8)]
                });
                const d = g.get_data();
                assert.strictEqual(d.status, Phase.RoundEnd);
                // a: berry1 + lemon1 cancel; lemon 2 + 3 kept → +5
                assert.strictEqual(d.players.a.roundPoints, 5);
                assert.strictEqual(d.players.a.score, 15);
                assert.strictEqual(d.players.b.score, 0, 'never below zero');
                assert.strictEqual(d.players.c.score, 37);
                assert.deepStrictEqual(d.players.c.history, [37]);
            });

            it('next round is led by the unique lowest score (ties skipped)', () => {
                const g = endRoundWith({ a: 10, b: 4, c: 4, d: 6 }, {});
                // a → 15, b → 4, c → 4, d → 6 : b/c tie, so d (6) leads
                g.next_round();
                const d = g.get_data();
                assert.strictEqual(d.status, Phase.Play);
                assert.strictEqual(d.round, 1);
                assert.strictEqual(d.currentPlayerId, 'd');
                assert.strictEqual(d.leaderReason, 'lowest');
                PLAYERS.forEach(id => {
                    assert.strictEqual(d.players[id].hand.length, 12);
                    assert.strictEqual(d.players[id].plate.length, 0);
                });
            });

            it('a bust ends the game; highest unique score ≤ 40 wins', () => {
                const g = endRoundWith({ a: 39, b: 30, c: 30, d: 20 }, { d: [c('mint', 4)] });
                const d = g.get_data();
                // a: 39 + 5 = 44 → too full. b, c tie at 30 → eliminated. d = 24 wins.
                assert.strictEqual(d.status, Phase.GameOver);
                assert.deepStrictEqual(d.bustedIds, ['a']);
                assert.strictEqual(d.winnerId, 'd');
            });

            it('nobody wins when every safe score is tied', () => {
                const g = endRoundWith({ a: 39, b: 30, c: 30, d: 26 }, { d: [c('mint', 4)] });
                assert.strictEqual(g.get_data().winnerId, null);
            });

            it('if everyone busts, the highest score wins', () => {
                const g = endRoundWith({ a: 39, b: 41, c: 45, d: 42 }, {});
                const d = g.get_data();
                assert.strictEqual(d.bustedIds.length, 4);
                assert.strictEqual(d.winnerId, 'c');
            });

            it('next_round is refused outside RoundEnd', () => {
                const g = new GameState(['a', 'b', 'c']);
                g.start_game();
                assert.throws(() => g.next_round(), /not over/);
            });
        });
    });

    describe('Type B: Seconds, Please! Integration Tests', () => {
        const actAs = (test: GameRuleTest, playerIds: string[], pid: string, method: string, ...args: any[]) => {
            const idx = playerIds.indexOf(pid);
            if (idx === 0) test.invokeHostMethod(method, ...args);
            else test.invokeClientMethod(idx - 1, method, ...args);
        };
        const state = (test: GameRuleTest): GameStateData => {
            const raw = test.getHostData('gameState');
            return (typeof raw.get_data === 'function' ? raw.get_data() : raw.data) as GameStateData;
        };

        it('plays a full 3-player round through the RPC layer', () => {
            const test = new GameRuleTest('schadenfreude', 2); // host + 2 clients
            test.invokeHostMethod('startGame');
            let d = state(test);
            assert.strictEqual(d.status, Phase.Play);
            assert.strictEqual(d.playerIds.length, 3);
            const ids = d.playerIds;

            let tricks = 0;
            while (d.status === Phase.Play) {
                if (d.resolvingTrick) {
                    // Only the host may advance the animation.
                    actAs(test, ids, ids[1], 'finishTrick');
                    assert.notStrictEqual(state(test).resolvingTrick, null, 'client cannot finish trick');
                    actAs(test, ids, ids[0], 'finishTrick');
                    tricks++;
                } else {
                    const g = GameState.from_data(d, ids);
                    const legal = g.get_legal_card_ids(d.currentPlayerId);
                    assert.ok(legal.length > 0);
                    actAs(test, ids, d.currentPlayerId, 'playCard', legal[legal.length - 1]);
                }
                d = state(test);
            }

            assert.strictEqual(tricks, 12);
            assert.ok(d.status === Phase.RoundEnd || d.status === Phase.GameOver);
            ids.forEach(id => {
                const p = d.players[id];
                assert.strictEqual(p.hand.length, 0);
                assert.strictEqual(p.score, Math.max(0, plateTotal(p.plate)));
                const values = p.plate.map(x => x.value);
                assert.strictEqual(new Set(values).size, values.length, 'no twins on a plate');
            });

            if (d.status === Phase.RoundEnd) {
                actAs(test, ids, ids[0], 'nextRound');
                d = state(test);
                assert.strictEqual(d.status, Phase.Play);
                assert.strictEqual(d.round, 1);
            }
        });

        it('rejects an illegal play without changing state', () => {
            const test = new GameRuleTest('schadenfreude', 2);
            test.invokeHostMethod('startGame');
            const d = state(test);
            const ids = d.playerIds;
            const notTurn = ids.find(id => id !== d.currentPlayerId)!;
            const card = d.players[notTurn].hand[0];
            try { actAs(test, ids, notTurn, 'playCard', card.id); } catch (e) { /* expected */ }
            assert.strictEqual(state(test).currentTrick.length, 0);
        });
    });
});
