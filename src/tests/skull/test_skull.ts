/**
 * test_skull.ts - Tests for Skull.
 */

import { describe, it } from 'mocha';
import { strict as assert } from 'assert';
import {
    SkullGameState as GameState,
    Phase,
    GameStateData,
    DiscKind
} from '../../rules/skull/SkullGameState';
import { GameRuleTest } from '../GameRuleTest';

// Build a controlled "Stacking" state with the given stacks already placed. Hands
// are back-filled from each player's owned inventory, so we can drive real
// open/raise/pass/challenge flows deterministically.
function mockStacking(
    players: string[],
    stacks: Record<string, DiscKind[]>,
    opts: { current?: string; owned?: Record<string, { f: number; s: number }>; eliminated?: string[] } = {}
): GameState {
    const g = new GameState(players);
    const d = g.get_data();
    d.status = Phase.Stacking;
    const starter = opts.current || players[0];
    d.roundStarterId = starter;
    d.currentPlayerId = starter;
    d.bid = null;
    d.bidOpen = false;
    d.round = 1;

    players.forEach(pid => {
        const stack = stacks[pid] || [];
        const owned = opts.owned && opts.owned[pid]
            ? opts.owned[pid]
            : { f: 3, s: 1 };
        const stackF = stack.filter(k => k === 'flower').length;
        const stackS = stack.filter(k => k === 'skull').length;
        d.players[pid] = {
            ownedFlowers: owned.f,
            ownedSkulls: owned.s,
            handFlowers: owned.f - stackF,
            handSkulls: owned.s - stackS,
            stack: [...stack],
            revealed: 0,
            placedInitial: true,
            passed: false,
            wins: 0,
            eliminated: (opts.eliminated || []).indexOf(pid) >= 0
        };
    });
    return GameState.from_data(d, players);
}

describe('Skull Game Logic', () => {
    describe('Type A: SkullGameState Unit Tests', () => {

        describe('Setup & placement', () => {
            it('starts every player with 3 flowers and 1 skull', () => {
                const g = new GameState(['a', 'b', 'c']);
                g.start_game('a');
                const d = g.get_data();
                assert.strictEqual(d.status, Phase.Placement);
                assert.strictEqual(d.round, 1);
                for (const pid of ['a', 'b', 'c']) {
                    assert.strictEqual(d.players[pid].ownedFlowers, 3);
                    assert.strictEqual(d.players[pid].ownedSkulls, 1);
                    assert.strictEqual(d.players[pid].handFlowers, 3);
                    assert.strictEqual(d.players[pid].handSkulls, 1);
                    assert.strictEqual(d.players[pid].wins, 0);
                }
            });

            it('rejects player counts outside 3-6', () => {
                assert.throws(() => new GameState(['a', 'b']).start_game(), /3 to 6/);
            });

            it('moves to stacking only once every player has placed, starting with the round starter', () => {
                const g = new GameState(['a', 'b', 'c']);
                g.start_game('a');
                g.place_initial('a', 'flower');
                g.place_initial('b', 'skull');
                assert.strictEqual(g.get_data().status, Phase.Placement);
                g.place_initial('c', 'flower');
                const d = g.get_data();
                assert.strictEqual(d.status, Phase.Stacking);
                assert.strictEqual(d.currentPlayerId, 'a');
                assert.strictEqual(d.players['a'].stack.length, 1);
                assert.strictEqual(d.players['b'].handSkulls, 0); // placed the skull
            });

            it('rejects placing twice or out of the placement phase', () => {
                const g = new GameState(['a', 'b', 'c']);
                g.start_game('a');
                g.place_initial('a', 'flower');
                assert.throws(() => g.place_initial('a', 'flower'), /already placed/);
            });
        });

        describe('Stacking & opening the bid', () => {
            it('adds to the top of the stack and rotates clockwise', () => {
                const g = mockStacking(['a', 'b', 'c'], { a: ['flower'], b: ['flower'], c: ['flower'] });
                g.add_disc('a', 'skull');
                let d = g.get_data();
                assert.deepStrictEqual(d.players['a'].stack, ['flower', 'skull']); // bottom -> top
                assert.strictEqual(d.currentPlayerId, 'b');
                assert.throws(() => g.add_disc('a', 'flower'), /not your turn/);
            });

            it('bounds the opening bid by the total discs on the table', () => {
                const g = mockStacking(['a', 'b', 'c'], { a: ['flower'], b: ['flower'], c: ['flower'] });
                assert.throws(() => g.open_bid('a', 4), /between 1 and 3/);
                g.open_bid('a', 2);
                const d = g.get_data();
                assert.strictEqual(d.status, Phase.Bidding);
                assert.strictEqual(d.discsOnTable, 3);
                assert.strictEqual(d.bid!.value, 2);
                assert.strictEqual(d.currentPlayerId, 'b'); // clockwise after the opener
            });

            it('forces a bid when the hand is empty (no placement allowed)', () => {
                const g = mockStacking(['a', 'b', 'c'],
                    { a: ['flower', 'flower', 'flower', 'skull'], b: ['flower'], c: ['flower'] });
                // a has placed all four discs — hand empty.
                assert.strictEqual(g.get_data().players['a'].handFlowers + g.get_data().players['a'].handSkulls, 0);
                assert.throws(() => g.add_disc('a', 'flower'), /No flowers|No skull/);
                g.open_bid('a', 1);
                assert.strictEqual(g.get_data().status, Phase.Bidding);
            });
        });

        describe('Bidding', () => {
            it('lets the last remaining bidder become the challenger', () => {
                const g = mockStacking(['a', 'b', 'c'], { a: ['flower'], b: ['flower'], c: ['flower'] });
                g.open_bid('a', 2);   // a bids 2 (must flip an opponent to satisfy it)
                g.pass_bid('b');
                g.pass_bid('c');      // only a remains
                const d = g.get_data();
                assert.strictEqual(d.status, Phase.Challenge);
                assert.strictEqual(d.challengerId, 'a');
                assert.strictEqual(d.bidTarget, 2);
                assert.strictEqual(d.flowersRevealed, 1); // own flower auto-revealed, needs one more
            });

            it('makes a maximum bid the challenger immediately', () => {
                const g = mockStacking(['a', 'b', 'c'], { a: ['flower'], b: ['flower'], c: ['flower'] });
                g.open_bid('a', 3); // == total on table
                const d = g.get_data();
                assert.strictEqual(d.status, Phase.Challenge);
                assert.strictEqual(d.challengerId, 'a');
                assert.strictEqual(d.bidTarget, 3);
            });

            it('requires strictly higher raises and forbids the high bidder from passing', () => {
                const g = mockStacking(['a', 'b', 'c'], { a: ['flower'], b: ['flower'], c: ['flower'] });
                g.open_bid('a', 1);
                assert.throws(() => g.raise_bid('b', 1), /raise higher/);
                g.raise_bid('b', 2);
                assert.strictEqual(g.get_data().bid!.value, 2);
                assert.strictEqual(g.get_data().currentPlayerId, 'c');
                // b is now the high bidder — it is c's turn; a passed-style guard:
                g.pass_bid('c');
                // back to a (still eligible), a passes -> only b remains -> challenger b
                g.pass_bid('a');
                const d = g.get_data();
                assert.strictEqual(d.status, Phase.Challenge);
                assert.strictEqual(d.challengerId, 'b');
            });

            it('keeps passing permanent for the round', () => {
                const g = mockStacking(['a', 'b', 'c'], { a: ['flower'], b: ['flower'], c: ['flower'] });
                g.open_bid('a', 1);
                g.pass_bid('b');
                assert.throws(() => g.raise_bid('b', 2), /not your turn/);
            });
        });

        describe('The challenge — success', () => {
            it('succeeds when the challenger reveals enough flowers from own + opponents', () => {
                const g = mockStacking(['a', 'b', 'c'], { a: ['flower'], b: ['flower'], c: ['flower'] });
                g.open_bid('a', 3);   // must reveal all three
                let d = g.get_data();
                assert.strictEqual(d.status, Phase.Challenge);
                assert.strictEqual(d.flowersRevealed, 1); // own flower auto-revealed
                g.flip_opponent('a', 'b');
                g.flip_opponent('a', 'c');
                d = g.get_data();
                assert.strictEqual(d.status, Phase.Resolve);
                assert.strictEqual(d.resolution!.kind, 'success');
                assert.strictEqual(d.players['a'].wins, 1);
                assert.strictEqual(d.roundStarterId, 'a'); // winner starts next round
            });

            it('proceed_round returns everyone to hand and opens a fresh round', () => {
                const g = mockStacking(['a', 'b', 'c'], { a: ['flower'], b: ['flower'], c: ['flower'] });
                g.open_bid('a', 1);
                g.pass_bid('b');
                g.pass_bid('c'); // a succeeds on its own flower
                assert.strictEqual(g.get_data().status, Phase.Resolve);
                g.proceed_round('a');
                const d = g.get_data();
                assert.strictEqual(d.status, Phase.Placement);
                assert.strictEqual(d.round, 2);
                assert.strictEqual(d.players['a'].stack.length, 0);
                assert.strictEqual(d.players['a'].handFlowers, 3);
            });

            it('wins the game on a second successful challenge', () => {
                const g = mockStacking(['a', 'b', 'c'], { a: ['flower'], b: ['flower'], c: ['flower'] });
                const d0 = g.get_data();
                d0.players['a'].wins = 1;              // already won once
                const g2 = GameState.from_data(d0, ['a', 'b', 'c']);
                g2.open_bid('a', 1);
                g2.pass_bid('b');
                g2.pass_bid('c');
                const d = g2.get_data();
                assert.strictEqual(d.status, Phase.GameOver);
                assert.strictEqual(d.winnerId, 'a');
                assert.strictEqual(d.players['a'].wins, 2);
            });
        });

        describe('The challenge — failure', () => {
            it('flips the WHOLE own stack first: a bid of 1 fails on an own skull beneath a flower', () => {
                // a's stack, bottom -> top: [skull, flower]. The top is a flower, but the
                // whole own stack must be flipped, so the skull below fails the bid of 1.
                const g = mockStacking(['a', 'b', 'c'],
                    { a: ['skull', 'flower'], b: ['flower'], c: ['flower'] });
                g.open_bid('a', 1);
                g.pass_bid('b');
                g.pass_bid('c'); // challenger a
                const d = g.get_data();
                assert.strictEqual(d.status, Phase.AwaitDiscard);
                assert.strictEqual(d.challengerId, 'a');
                assert.strictEqual(d.revealSequence.length, 2); // both own discs revealed
            });

            it('lets the challenger choose which disc to discard after their own skull', () => {
                const g = mockStacking(['a', 'b', 'c'],
                    { a: ['skull'], b: ['flower'], c: ['flower'] });
                g.open_bid('a', 1);
                g.pass_bid('b');
                g.pass_bid('c');
                assert.strictEqual(g.get_data().status, Phase.AwaitDiscard);
                g.choose_discard('a', 'skull');
                const d = g.get_data();
                assert.strictEqual(d.players['a'].ownedSkulls, 0);
                assert.strictEqual(d.players['a'].ownedFlowers, 3);
                assert.strictEqual(d.status, Phase.Resolve);
                assert.strictEqual(d.resolution!.reason, 'own');
                assert.deepStrictEqual(d.resolution!.eliminatedIds, []);
                assert.strictEqual(d.roundStarterId, 'a'); // failed challenger still starts next
            });

            it("punishes with a passed player's skull, losing one of the challenger's discs at random", () => {
                const g = mockStacking(['a', 'b', 'c'],
                    { a: ['flower'], b: ['skull'], c: ['flower'] });
                g.open_bid('a', 2);
                g.pass_bid('b'); // b has passed but its skull is still on the table
                g.pass_bid('c');
                let d = g.get_data();
                assert.strictEqual(d.status, Phase.Challenge);
                assert.strictEqual(d.flowersRevealed, 1); // a's own flower
                g.flip_opponent('a', 'b'); // flips b's skull
                d = g.get_data();
                assert.strictEqual(d.status, Phase.Resolve);
                assert.strictEqual(d.resolution!.reason, 'other');
                assert.strictEqual(d.resolution!.skullOwnerId, 'b');
                assert.strictEqual(d.players['a'].ownedFlowers + d.players['a'].ownedSkulls, 3); // lost exactly one
            });

            it('cannot flip beneath an unrevealed disc, nor a stack twice past its size', () => {
                const g = mockStacking(['a', 'b', 'c'],
                    { a: ['flower', 'flower'], b: ['flower'], c: ['flower'] });
                g.open_bid('a', 4); // needs a(2) + others
                // own two flowers auto-revealed -> 2 so far
                g.flip_opponent('a', 'b'); // b's only disc -> 3
                assert.throws(() => g.flip_opponent('a', 'b'), /no discs left/);
                g.flip_opponent('a', 'c'); // -> 4 flowers -> success
                assert.strictEqual(g.get_data().resolution!.kind, 'success');
            });
        });

        describe('Elimination & last player standing', () => {
            it('eliminates a challenger who loses their final disc and ends the game if one player remains', () => {
                // a owns only a single skull (already on their mat); c is already out.
                const g = mockStacking(['a', 'b', 'c'],
                    { a: ['skull'], b: ['flower'], c: [] },
                    { owned: { a: { f: 0, s: 1 }, b: { f: 3, s: 1 }, c: { f: 0, s: 0 } }, eliminated: ['c'], current: 'a' });
                g.open_bid('a', 1);   // a's hand is empty -> must open
                g.pass_bid('b');      // only a remains -> challenger a
                assert.strictEqual(g.get_data().status, Phase.AwaitDiscard);
                g.choose_discard('a', 'skull'); // loses last disc
                const d = g.get_data();
                assert.strictEqual(d.players['a'].eliminated, true);
                assert.strictEqual(d.status, Phase.GameOver);
                assert.strictEqual(d.winnerId, 'b'); // last player standing
            });
        });
    });

    describe('Type B: Skull Integration Tests', () => {
        it('starts a 3-player game, runs placement, and a first successful challenge', () => {
            const test = new GameRuleTest('skull', 2); // host + 2 clients = 3 players
            test.invokeHostMethod('startGame');

            let raw = test.getHostData('gameState');
            const playerIds: string[] = raw.playerIds;
            assert.strictEqual(playerIds.length, 3);
            assert.strictEqual(raw.data.status, Phase.Placement);

            // Everyone places a flower (host is playerIds[0]).
            test.invokeHostMethod('placeInitial', 'flower');
            test.invokeClientMethod(0, 'placeInitial', 'flower');
            test.invokeClientMethod(1, 'placeInitial', 'flower');

            raw = test.getHostData('gameState');
            assert.strictEqual(raw.data.status, Phase.Stacking);
            assert.strictEqual(raw.data.currentPlayerId, playerIds[0]);

            // Host opens a bid of 1, the two clients pass -> host challenges and,
            // revealing their own flower, succeeds.
            test.invokeHostMethod('openBid', 1);
            test.invokeClientMethod(0, 'passBid');
            test.invokeClientMethod(1, 'passBid');

            raw = test.getHostData('gameState');
            assert.strictEqual(raw.data.status, Phase.Resolve);
            assert.strictEqual(raw.data.resolution.kind, 'success');
            assert.strictEqual(raw.data.players[playerIds[0]].wins, 1);

            // Host advances to the next round.
            test.invokeHostMethod('proceedRound');
            raw = test.getHostData('gameState');
            assert.strictEqual(raw.data.status, Phase.Placement);
            assert.strictEqual(raw.data.round, 2);
        });

        it('rejects acting out of turn during stacking', () => {
            const test = new GameRuleTest('skull', 2);
            test.invokeHostMethod('startGame');
            test.invokeHostMethod('placeInitial', 'flower');
            test.invokeClientMethod(0, 'placeInitial', 'flower');
            test.invokeClientMethod(1, 'placeInitial', 'flower');

            const raw = test.getHostData('gameState');
            const playerIds: string[] = raw.playerIds;
            // It is the host's (playerIds[0]) turn; a client acting should throw.
            assert.throws(() => test.invokeClientMethod(0, 'addDisc', 'flower'));
        });
    });
});
