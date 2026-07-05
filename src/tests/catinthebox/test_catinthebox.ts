/**
 * test_catinthebox.ts - Tests for Cat in the Box.
 */

import { describe, it } from 'mocha';
import { strict as assert } from 'assert';
import {
    CatInTheBoxGameState as GameState,
    Phase,
    CatColor,
    OBSERVED,
    GameStateData,
    PlayerState,
    getRoundConfig
} from '../../rules/catinthebox/CatInTheBoxGameState';
import { GameRuleTest } from '../GameRuleTest';

function freshPlayer(overrides: Partial<PlayerState> = {}): PlayerState {
    return {
        hand: [],
        discard: null,
        hasDiscarded: false,
        prediction: null,
        xSlots: { red: true, blue: true, yellow: true, green: true },
        tricksWon: 0,
        isParadox: false,
        roundScore: 0,
        roundBonus: 0,
        totalScore: 0,
        roundHistory: [],
        ...overrides
    };
}

// Build a controlled 2-player "Play" state from scratch.
function mock2pPlay(mut: (d: GameStateData) => void): GameState {
    const players = ['alice', 'bob'];
    const g = new GameState(players);
    const d = g.get_data();
    d.status = Phase.Play;
    d.numPlayers = 2;
    d.maxNum = 5;
    d.handSize = 9;
    d.totalTricks = 8;
    d.totalRounds = 2;
    d.round = 0;
    d.roundStartIndex = 0;
    d.board = {
        red: Array(5).fill(null),
        blue: Array(5).fill(null),
        yellow: Array(5).fill(null),
        green: Array(5).fill(null)
    };
    d.players = { alice: freshPlayer(), bob: freshPlayer() };
    d.currentPlayerId = 'alice';
    d.trickStartPlayerId = 'alice';
    d.ledColor = null;
    d.currentTrick = [];
    d.trickNumber = 1;
    d.completedTricks = 0;
    mut(d);
    return GameState.from_data(d, players);
}

describe('Cat in the Box Game Logic', () => {
    describe('Type A: CatInTheBoxGameState Unit Tests', () => {

        describe('Setup & Deal', () => {
            it('deals the correct deck and hand sizes per player count', () => {
                const cases: Array<[number, number, number]> = [
                    // [numPlayers, maxNum, handSizeAfterBury]
                    [2, 5, 9],
                    [3, 6, 9],
                    [4, 8, 9],
                    [5, 9, 8]
                ];
                for (const [n, maxNum, handSize] of cases) {
                    const cfg = getRoundConfig(n);
                    const players = Array.from({ length: n }, (_, i) => 'p' + i);
                    const g = new GameState(players);
                    g.start_game('p0');
                    const d = g.get_data();

                    assert.strictEqual(d.status, Phase.Discard);
                    assert.strictEqual(d.maxNum, maxNum);
                    assert.strictEqual(d.handSize, handSize);
                    assert.strictEqual(d.totalTricks, handSize - 1);

                    // Each player was dealt cfg.dealt cards, all within 1..maxNum.
                    for (const pid of players) {
                        assert.strictEqual(d.players[pid].hand.length, cfg.dealt);
                        for (const c of d.players[pid].hand) {
                            assert.ok(c >= 1 && c <= maxNum, `card ${c} out of range`);
                        }
                    }
                    // Board is 4 rows x maxNum columns.
                    for (const color of ['red', 'blue', 'yellow', 'green'] as CatColor[]) {
                        assert.strictEqual(d.board[color].length, maxNum);
                    }
                }
            });

            it('seeds 2-player observed tokens on the board', () => {
                const g = new GameState(['alice', 'bob']);
                g.start_game('alice');
                const d = g.get_data();
                assert.strictEqual(d.revealedTwoPlayer.length, 3);
                // Every revealed number blocks at least the Green row.
                for (const n of d.revealedTwoPlayer) {
                    assert.strictEqual(d.board.green[n - 1], OBSERVED);
                }
            });
        });

        describe('Discard & Prediction phases', () => {
            it('moves to Predict after everyone buries (3p), enforcing allowed predictions', () => {
                const players = ['a', 'b', 'c'];
                const g = new GameState(players);
                g.start_game('a');
                let d = g.get_data();

                for (const pid of players) {
                    g.discard_card(pid, d.players[pid].hand[0]);
                    d = g.get_data();
                }
                assert.strictEqual(d.status, Phase.Predict);
                assert.strictEqual(d.currentPlayerId, 'a'); // round start predicts first

                // 3p prediction set is {1,3,4}. 0 and 2 are illegal.
                assert.throws(() => g.make_prediction('a', 0), /not allowed/);
                assert.throws(() => g.make_prediction('a', 2), /not allowed/);
                g.make_prediction('a', 1);
                g.make_prediction('b', 3);
                g.make_prediction('c', 4);
                d = g.get_data();
                assert.strictEqual(d.status, Phase.Play);
                assert.strictEqual(d.currentPlayerId, 'a'); // round start leads first trick
            });

            it('2-player skips prediction and goes straight to Play', () => {
                const g = new GameState(['alice', 'bob']);
                g.start_game('alice');
                let d = g.get_data();
                g.discard_card('alice', d.players['alice'].hand[0]);
                d = g.get_data();
                g.discard_card('bob', d.players['bob'].hand[0]);
                d = g.get_data();
                assert.strictEqual(d.status, Phase.Play);
            });
        });

        describe('Playing cards & validation', () => {
            it('places a token and records the led colour', () => {
                const g = mock2pPlay(d => {
                    d.players['alice'].hand = [3];
                    d.players['bob'].hand = [4];
                });
                g.play_card('alice', 3, 'blue');
                const d = g.get_data();
                assert.strictEqual(d.board.blue[2], 'alice');
                assert.strictEqual(d.ledColor, 'blue');
                assert.strictEqual(d.currentPlayerId, 'bob');
                assert.strictEqual(d.currentTrick.length, 1);
            });

            it('rejects a play onto an already-claimed (colour, number) cell', () => {
                const g = mock2pPlay(d => {
                    d.players['alice'].hand = [3];
                    d.board.blue[2] = 'bob'; // blue-3 already taken
                });
                assert.throws(() => g.play_card('alice', 3, 'blue'), /Illegal/);
            });

            it('rejects a play in a colour the player is locked out of', () => {
                const g = mock2pPlay(d => {
                    d.players['alice'].hand = [3];
                    d.players['alice'].xSlots.blue = false;
                });
                assert.throws(() => g.play_card('alice', 3, 'blue'), /Illegal/);
            });

            it('applies the follow-suit penalty when a follower goes off-colour', () => {
                const g = mock2pPlay(d => {
                    d.players['alice'].hand = [5];
                    d.players['bob'].hand = [4];
                });
                g.play_card('alice', 5, 'blue');       // led blue
                g.play_card('bob', 4, 'green');        // follows off-colour
                const d = g.get_data();
                assert.strictEqual(d.players['bob'].xSlots.blue, false, 'bob loses the led (blue) slot');
                assert.strictEqual(d.players['bob'].xSlots.green, true, 'other slots untouched');
            });

            it('forbids the leader from leading Red until it is broken', () => {
                const g = mock2pPlay(d => {
                    d.players['alice'].hand = [3]; // has legal non-red leads available
                });
                // Red not broken and non-red leads exist -> red lead illegal.
                assert.throws(() => g.play_card('alice', 3, 'red'), /Illegal/);

                // Once a red token exists on the board, leading red is allowed.
                const g2 = mock2pPlay(d => {
                    d.players['alice'].hand = [3];
                    d.board.red[0] = 'bob'; // red broken
                });
                g2.play_card('alice', 3, 'red');
                assert.strictEqual(g2.get_data().board.red[2], 'alice');
            });
        });

        describe('Trick resolution', () => {
            it('awards the trick to the highest led-colour card when no red is played', () => {
                const g = mock2pPlay(d => {
                    d.totalTricks = 8; // don't end the round
                    d.players['alice'].hand = [2, 3]; // numbers within the 2p range (1..5)
                    d.players['bob'].hand = [4, 5];
                });
                g.play_card('alice', 2, 'blue'); // led blue 2
                g.play_card('bob', 4, 'blue');   // blue 4 beats blue 2
                const d = g.get_data();
                assert.strictEqual(d.players['bob'].tricksWon, 1);
                assert.strictEqual(d.trickStartPlayerId, 'bob'); // winner leads next
            });

            it('lets Red trump the led colour regardless of number', () => {
                const g = mock2pPlay(d => {
                    d.totalTricks = 8;
                    d.board.red[0] = 'preexisting'; // red already broken
                    d.players['alice'].hand = [5];
                    d.players['bob'].hand = [2];
                });
                g.play_card('alice', 5, 'blue'); // led blue 5 (highest)
                g.play_card('bob', 2, 'red');    // red 2 trumps blue 5
                const d = g.get_data();
                assert.strictEqual(d.players['bob'].tricksWon, 1);
            });
        });

        describe('Adjacency bonus', () => {
            it('computes the largest orthogonally-connected group', () => {
                const g = mock2pPlay(d => {
                    // A vertical column of 3 for alice (blue,yellow,green at number 2),
                    // plus a detached single at green-5.
                    d.board.blue[1] = 'alice';
                    d.board.yellow[1] = 'alice';
                    d.board.green[1] = 'alice';
                    d.board.green[4] = 'alice';
                    // A diagonal for bob (should NOT connect).
                    d.board.red[0] = 'bob';
                    d.board.blue[1] = 'alice'; // keep alice's
                    d.board.yellow[2] = 'bob';
                });
                assert.strictEqual(g.largest_connected_group('alice'), 3);
                assert.strictEqual(g.largest_connected_group('bob'), 1);
            });
        });

        describe('Paradox & scoring', () => {
            it('ends the round on paradox: causer scores negative, other gets 2p bonus', () => {
                const g = mock2pPlay(d => {
                    d.totalTricks = 8; // not reached by trick count
                    d.ledColor = 'blue';
                    d.trickStartPlayerId = 'alice';
                    d.currentPlayerId = 'bob';
                    d.currentTrick = [{ playerId: 'alice', number: 1, color: 'blue' }];
                    d.board.blue[0] = 'alice';
                    // Strangle alice's next lead (card 2 -> every colour at number 2 taken).
                    d.board.red[1] = 'bob';
                    d.board.blue[1] = 'bob';
                    d.board.yellow[1] = 'bob';
                    d.board.green[1] = 'bob';
                    d.players['alice'].hand = [2];
                    d.players['bob'].hand = [4];
                });

                // Bob follows off-colour and loses; alice wins the trick, then leads next
                // with only card "2" and no legal play anywhere -> paradox.
                g.play_card('bob', 4, 'green');
                const d = g.get_data();

                assert.strictEqual(d.status, Phase.RoundEnd);
                assert.strictEqual(d.paradoxPlayerId, 'alice');
                assert.strictEqual(d.players['alice'].isParadox, true);
                assert.strictEqual(d.players['alice'].tricksWon, 1);
                // Paradox causer: -1 per trick, no bonus.
                assert.strictEqual(d.players['alice'].roundScore, -1);
                // Bob: 0 tricks (base 0) + adjacency bonus of his column-2 group (size 4).
                assert.strictEqual(d.players['bob'].roundBonus, 4);
                assert.strictEqual(d.players['bob'].roundScore, 4);
            });

            it('awards the prediction bonus only on an exact match (3p end of round)', () => {
                const players = ['a', 'b', 'c'];
                const g = new GameState(players);
                const d = g.get_data();
                d.status = Phase.Play;
                d.numPlayers = 3;
                d.maxNum = 6;
                d.handSize = 9;
                d.totalTricks = 3;      // final trick about to be played
                d.completedTricks = 2;
                d.trickNumber = 3;
                d.round = 0;
                d.totalRounds = 3;
                d.roundStartIndex = 0;
                d.board = {
                    red: Array(6).fill(null),
                    blue: Array(6).fill(null),
                    yellow: Array(6).fill(null),
                    green: Array(6).fill(null)
                };
                // 'a' already owns a connected blue pair from earlier tricks.
                d.board.blue[0] = 'a';
                d.board.blue[1] = 'a';
                d.players = {
                    a: freshPlayer({ tricksWon: 2, prediction: 3, hand: [6] }), // will win -> 3 == pred
                    b: freshPlayer({ tricksWon: 1, prediction: 3, hand: [2] }), // stays 1 != pred
                    c: freshPlayer({ tricksWon: 0, prediction: 4, hand: [3] })  // stays 0 != pred
                };
                d.currentPlayerId = 'a';
                d.trickStartPlayerId = 'a';
                d.ledColor = null;
                d.currentTrick = [];
                const g2 = GameState.from_data(d, players);

                g2.play_card('a', 6, 'blue');   // led blue 6
                g2.play_card('b', 2, 'green');  // off-colour, loses
                g2.play_card('c', 3, 'green');  // off-colour, loses -> a wins, round ends

                const nd = g2.get_data();
                assert.strictEqual(nd.status, Phase.RoundEnd);
                assert.strictEqual(nd.players['a'].tricksWon, 3);
                // 'a' matched prediction (3) -> bonus = largest group (blue 0,1 = 2).
                assert.strictEqual(nd.players['a'].roundBonus, 2);
                assert.strictEqual(nd.players['a'].roundScore, 5);
                // 'b' missed prediction -> base 1, no bonus.
                assert.strictEqual(nd.players['b'].roundScore, 1);
                assert.strictEqual(nd.players['b'].roundBonus, 0);
                // 'c' missed prediction -> base 0, no bonus.
                assert.strictEqual(nd.players['c'].roundScore, 0);
            });
        });
    });

    describe('Type B: Cat in the Box Integration Tests', () => {
        it('runs discard -> predict -> first play for 3 players', () => {
            const test = new GameRuleTest('catinthebox', 2); // host + 2 clients = 3 players
            test.invokeHostMethod('startGame');

            let raw = test.getHostData('gameState');
            const playerIds: string[] = raw.playerIds;
            assert.strictEqual(playerIds.length, 3);
            assert.strictEqual(raw.data.status, Phase.Discard);

            const clientIndexOf = (pid: string) => playerIds.indexOf(pid);

            // Everyone buries their first card.
            playerIds.forEach((pid) => {
                const card = raw.data.players[pid].hand[0];
                if (pid === raw.playerIds[0]) {
                    // host is playerIds[0]
                    test.invokeHostMethod('discardCard', card);
                } else {
                    test.invokeClientMethod(clientIndexOf(pid) - 1, 'discardCard', card);
                }
                raw = test.getHostData('gameState');
            });

            assert.strictEqual(raw.data.status, Phase.Predict);

            // Predict in order (3p allowed values: 1,3,4).
            const predValues: Record<number, number> = { 0: 1, 1: 3, 2: 4 };
            for (let i = 0; i < 3; i++) {
                raw = test.getHostData('gameState');
                const pid = raw.data.currentPlayerId;
                const val = predValues[i];
                if (pid === raw.playerIds[0]) {
                    test.invokeHostMethod('makePrediction', val);
                } else {
                    test.invokeClientMethod(clientIndexOf(pid) - 1, 'makePrediction', val);
                }
            }

            raw = test.getHostData('gameState');
            assert.strictEqual(raw.data.status, Phase.Play);

            // The leader makes one legal play (reconstruct the state to find a legal move).
            const leader = raw.data.currentPlayerId;
            const rebuilt = GameState.from_data(raw.data, raw.playerIds);
            const legal = rebuilt.get_legal_plays(leader);
            assert.ok(legal.length > 0, 'leader should have a legal play');
            const move = legal[0];

            if (leader === raw.playerIds[0]) {
                test.invokeHostMethod('playCard', move.number, move.color);
            } else {
                test.invokeClientMethod(clientIndexOf(leader) - 1, 'playCard', move.number, move.color);
            }

            raw = test.getHostData('gameState');
            assert.strictEqual(raw.data.currentTrick.length, 1);
            assert.strictEqual(raw.data.board[move.color][move.number - 1], leader);
            assert.strictEqual(raw.data.ledColor, move.color);
            assert.notStrictEqual(raw.data.currentPlayerId, leader, 'turn advances');
        });
    });
});
