/**
 * test_seasalt.ts - Tests for Sea Salt & Paper.
 */

import { describe, it } from 'mocha';
import { strict as assert } from 'assert';
import {
    SeaSaltGameState as GameState,
    Phase,
    GameStateData,
    Card,
    scoreCards,
    isDuoPair,
    THRESHOLDS
} from '../../rules/seasalt/SeaSaltGameState';
import { SeaSaltType, SeaSaltColor } from '../../rules/seasalt/SeaSaltAssets';
import { GameRuleTest } from '../GameRuleTest';

let cardSeq = 0;
function card(type: SeaSaltType, color: SeaSaltColor = 'blue'): Card {
    return { id: `${type}-${color}-${cardSeq++}`, type, color };
}

// Build a controlled Play state with empty hands / deck, then mutate.
function mockPlay(players: string[], mut: (d: GameStateData) => void): GameState {
    const g = new GameState(players);
    g.start_game(players[0]);
    const d = g.get_data();
    d.status = Phase.Play;
    d.deck = [];
    d.discardA = [];
    d.discardB = [];
    players.forEach(p => { d.players[p] = { hand: [], tableau: [], score: 0, revealed: false }; });
    d.currentPlayerId = players[0];
    d.turnPhase = 'draw';
    d.drawnPair = null;
    d.pendingEffect = null;
    d.boatExtraTurns = 0;
    d.lastChance = null;
    d.roundResult = null;
    mut(d);
    return GameState.from_data(d, players);
}

describe('Sea Salt & Paper Game Logic', () => {
    describe('Type A: SeaSaltGameState Unit Tests', () => {

        describe('Deck composition (§5e)', () => {
            it('builds a 58-card deck with the right type totals', () => {
                const g = new GameState(['a', 'b']);
                g.start_game('a');
                const d = g.get_data();
                const all: Card[] = [...d.deck, ...d.discardA, ...d.discardB];
                // Hands are empty at round start, so deck + 2 discards = full deck.
                assert.strictEqual(all.length, 58, 'full deck is 58 cards');

                const byType: Record<string, number> = {};
                const byColor: Record<string, number> = {};
                for (const c of all) {
                    byType[c.type] = (byType[c.type] || 0) + 1;
                    byColor[c.color] = (byColor[c.color] || 0) + 1;
                }
                const expectType: Record<string, number> = {
                    fish: 7, boat: 8, crab: 9, swimmer: 5, shark: 5,
                    shell: 6, octopus: 5, penguin: 3, sailor: 2,
                    lighthouse: 1, shoal: 1, colony: 1, captain: 1, mermaid: 4
                };
                for (const t of Object.keys(expectType)) {
                    assert.strictEqual(byType[t], expectType[t], `${t} count`);
                }
                const expectColor: Record<string, number> = {
                    blue: 9, teal: 9, black: 8, yellow: 8, green: 6,
                    gray: 4, purple: 4, peach: 3, pink: 2, orange: 1, white: 4
                };
                for (const c of Object.keys(expectColor)) {
                    assert.strictEqual(byColor[c], expectColor[c], `${c} count`);
                }
            });

            it('picks the right point threshold per player count', () => {
                assert.strictEqual(THRESHOLDS[2], 40);
                assert.strictEqual(THRESHOLDS[3], 35);
                assert.strictEqual(THRESHOLDS[4], 30);
            });
        });

        describe('Scoring engine (§5, §9)', () => {
            it('scores duo pairs (1 pt each) and swimmer+shark combos', () => {
                assert.strictEqual(scoreCards([card('crab'), card('crab')]).duos, 1);
                assert.strictEqual(scoreCards([card('crab'), card('crab'), card('crab')]).duos, 1); // leftover scores 0
                assert.strictEqual(scoreCards([card('boat'), card('boat')]).duos, 1);
                assert.strictEqual(scoreCards([card('swimmer'), card('shark')]).duos, 1);
                assert.strictEqual(scoreCards([card('swimmer'), card('swimmer'), card('shark')]).duos, 1);
            });

            it('scores collectors on the non-linear tables, capped', () => {
                const shells = (n: number) => scoreCards(Array.from({ length: n }, () => card('shell'))).collectors;
                assert.deepStrictEqual([1, 2, 3, 4, 5, 6].map(shells), [0, 2, 4, 6, 8, 10]);

                const octo = (n: number) => scoreCards(Array.from({ length: n }, () => card('octopus'))).collectors;
                assert.deepStrictEqual([1, 2, 3, 4, 5].map(octo), [0, 3, 6, 9, 12]);
                assert.strictEqual(octo(6), 12, 'octopus caps at 5 cards (12 pts)');

                const peng = (n: number) => scoreCards(Array.from({ length: n }, () => card('penguin'))).collectors;
                assert.deepStrictEqual([1, 2, 3].map(peng), [1, 3, 5]);
                assert.strictEqual(peng(4), 5, 'penguin caps at 3');

                const sail = (n: number) => scoreCards(Array.from({ length: n }, () => card('sailor'))).collectors;
                assert.deepStrictEqual([1, 2].map(sail), [0, 5]);
            });

            it('scores multipliers off other cards, never themselves', () => {
                // 2 sailors + captain = 5 (collector) + 6 (captain 3×2) = 11 (rulebook example)
                const s = scoreCards([card('sailor'), card('sailor'), card('captain')]);
                assert.strictEqual(s.collectors, 5);
                assert.strictEqual(s.multipliers, 6);
                assert.strictEqual(s.cardPoints, 11);

                // Lighthouse +1 per boat; boats also score as duos.
                const lh = scoreCards([card('boat'), card('boat'), card('lighthouse')]);
                assert.strictEqual(lh.duos, 1);
                assert.strictEqual(lh.multipliers, 2);

                // Shoal +1 per fish; Penguin Colony +2 per penguin.
                assert.strictEqual(scoreCards([card('fish'), card('fish'), card('shoal')]).multipliers, 2);
                assert.strictEqual(scoreCards([card('penguin'), card('penguin'), card('colony')]).multipliers, 4);
            });

            it('scores mermaids on distinct most-abundant colours', () => {
                // 2 mermaids; colours blue×4, green×2 → 4 + 2 = 6 (rulebook example)
                const cards = [
                    card('mermaid', 'white'), card('mermaid', 'white'),
                    card('fish', 'blue'), card('boat', 'blue'), card('crab', 'blue'), card('shell', 'blue'),
                    card('fish', 'green'), card('crab', 'green')
                ];
                const s = scoreCards(cards);
                assert.strictEqual(s.mermaids, 6);
                // Colour bonus = size of most-common colour group (blue = 4).
                assert.strictEqual(s.colorBonus, 4);
                assert.strictEqual(s.colorBonusColor, 'blue');
            });

            it('isDuoPair recognises the four duos', () => {
                assert.ok(isDuoPair(card('crab'), card('crab')));
                assert.ok(isDuoPair(card('swimmer'), card('shark')));
                assert.ok(isDuoPair(card('shark'), card('swimmer')));
                assert.ok(!isDuoPair(card('crab'), card('boat')));
                assert.ok(!isDuoPair(card('swimmer'), card('swimmer')));
            });
        });

        describe('Draw phase', () => {
            it('reveals two from the deck, keeps one, discards the other', () => {
                const g = mockPlay(['a', 'b'], d => {
                    d.deck = [card('fish', 'blue'), card('crab', 'teal')]; // pop() takes crab then fish
                    d.discardA = [card('boat', 'black')];
                    d.discardB = [card('shell', 'gray')];
                });
                g.draw_from_deck('a');
                let d = g.get_data();
                assert.strictEqual(d.turnPhase, 'choose');
                assert.strictEqual(d.drawnPair!.length, 2);

                g.choose_drawn('a', 0, 'A'); // keep drawnPair[0]
                d = g.get_data();
                assert.strictEqual(d.turnPhase, 'play');
                assert.strictEqual(d.players['a'].hand.length, 1);
                assert.strictEqual(d.discardA.length, 2); // discarded card added
            });

            it('takes the top of a discard pile', () => {
                const g = mockPlay(['a', 'b'], d => {
                    d.discardA = [card('crab', 'blue'), card('fish', 'teal')];
                });
                g.take_discard('a', 'A');
                const d = g.get_data();
                assert.strictEqual(d.players['a'].hand.length, 1);
                assert.strictEqual(d.players['a'].hand[0].type, 'fish'); // top of pile
                assert.strictEqual(d.discardA.length, 1);
                assert.strictEqual(d.turnPhase, 'play');
            });

            it('forces a discard into an empty pile', () => {
                const g = mockPlay(['a', 'b'], d => {
                    d.deck = [card('fish'), card('crab')];
                    d.discardA = [];               // empty
                    d.discardB = [card('boat')];
                });
                g.draw_from_deck('a');
                g.choose_drawn('a', 0, 'B');        // ask for B, but A is empty → forced to A
                const d = g.get_data();
                assert.strictEqual(d.discardA.length, 1, 'discard forced into empty pile A');
                assert.strictEqual(d.discardB.length, 1);
            });
        });

        describe('Playing duos & effects', () => {
            it('plays a boat duo and grants an extra turn', () => {
                const b1 = card('boat', 'blue');
                const b2 = card('boat', 'teal');
                const g = mockPlay(['a', 'b'], d => {
                    d.players['a'].hand = [b1, b2];
                    d.turnPhase = 'play';
                });
                g.play_duo('a', b1.id, b2.id);
                const d = g.get_data();
                assert.strictEqual(d.players['a'].tableau.length, 2);
                // a's hand is now empty (no duo, below the gate), so the boat's extra
                // turn begins automatically: a stays current and returns to the draw
                // phase, with the extra turn already consumed.
                assert.strictEqual(d.currentPlayerId, 'a');
                assert.strictEqual(d.turnPhase, 'draw');
                assert.strictEqual(d.boatExtraTurns, 0);
            });

            it('holds the play phase while a further duo is still available', () => {
                // Boat + boat + fish + fish: after the boat duo, a still holds a fish
                // duo, so the turn does NOT auto-end — the extra turn stays pending.
                const b1 = card('boat', 'blue');
                const b2 = card('boat', 'teal');
                const f1 = card('fish', 'blue');
                const f2 = card('fish', 'teal');
                const g = mockPlay(['a', 'b'], d => {
                    d.players['a'].hand = [b1, b2, f1, f2];
                    d.turnPhase = 'play';
                });
                g.play_duo('a', b1.id, b2.id);
                let d = g.get_data();
                assert.strictEqual(d.turnPhase, 'play');
                assert.strictEqual(d.boatExtraTurns, 1);

                // Manually passing now consumes the extra turn (same player draws again).
                g.pass_turn('a');
                d = g.get_data();
                assert.strictEqual(d.currentPlayerId, 'a');
                assert.strictEqual(d.turnPhase, 'draw');
                assert.strictEqual(d.boatExtraTurns, 0);
            });

            it('plays a fish duo and draws the top of the deck', () => {
                const f1 = card('fish', 'blue');
                const f2 = card('fish', 'teal');
                const g = mockPlay(['a', 'b'], d => {
                    d.players['a'].hand = [f1, f2];
                    d.deck = [card('octopus', 'gray')];
                    d.turnPhase = 'play';
                });
                g.play_duo('a', f1.id, f2.id);
                const d = g.get_data();
                assert.strictEqual(d.players['a'].hand.length, 1);
                assert.strictEqual(d.players['a'].hand[0].type, 'octopus');
                assert.strictEqual(d.deck.length, 0);
            });

            it('plays a crab duo and takes a chosen card from a pile', () => {
                const c1 = card('crab', 'blue');
                const c2 = card('crab', 'teal');
                const g = mockPlay(['a', 'b'], d => {
                    d.players['a'].hand = [c1, c2];
                    d.discardA = [card('octopus', 'green'), card('shell', 'gray')];
                    d.turnPhase = 'play';
                });
                g.play_duo('a', c1.id, c2.id);
                let d = g.get_data();
                assert.strictEqual(d.turnPhase, 'effect');
                assert.strictEqual(d.pendingEffect!.kind, 'crab');

                g.resolve_crab('a', 'A', 0); // take the octopus (bottom of pile)
                d = g.get_data();
                assert.strictEqual(d.players['a'].hand.length, 1);
                assert.strictEqual(d.players['a'].hand[0].type, 'octopus');
                assert.strictEqual(d.turnPhase, 'play');
            });

            it('plays a swimmer+shark and steals a random card from a target', () => {
                const sw = card('swimmer', 'blue');
                const sh = card('shark', 'teal');
                const g = mockPlay(['a', 'b'], d => {
                    d.players['a'].hand = [sw, sh];
                    d.players['b'].hand = [card('shell', 'gray')];
                    d.turnPhase = 'play';
                });
                g.play_duo('a', sw.id, sh.id);
                let d = g.get_data();
                assert.strictEqual(d.pendingEffect!.kind, 'steal');

                g.resolve_steal('a', 'b');
                d = g.get_data();
                assert.strictEqual(d.players['a'].hand.length, 1);
                assert.strictEqual(d.players['b'].hand.length, 0);
                assert.strictEqual(d.turnPhase, 'play');
            });

            it('rejects stealing from a revealed (protected) hand', () => {
                const sw = card('swimmer');
                const sh = card('shark');
                const g = mockPlay(['a', 'b'], d => {
                    d.players['a'].hand = [sw, sh, card('shell')]; // extra card so no auto-win/pass issues
                    d.players['b'].hand = [card('shell')];
                    d.players['b'].revealed = true;
                    d.turnPhase = 'play';
                });
                // No stealable target (b is protected) → the effect resolves silently, no pending.
                g.play_duo('a', sw.id, sh.id);
                assert.strictEqual(g.get_data().pendingEffect, null);
            });
        });

        describe('Ending the round', () => {
            it('gates STOP / LAST CHANCE behind ≥ 7 points', () => {
                const g = mockPlay(['a', 'b'], d => {
                    d.players['a'].hand = [card('octopus'), card('octopus')]; // 3 pts (<7)
                    d.turnPhase = 'play';
                });
                assert.ok(!g.can_end_round('a'));
                assert.throws(() => g.declare_stop('a'), /at least 7/);
            });

            it('STOP scores card points for everyone, no colour bonus', () => {
                const g = mockPlay(['a', 'b'], d => {
                    // a: sailor×2 + captain = 11 pts
                    d.players['a'].hand = [card('sailor', 'pink'), card('sailor', 'orange'), card('captain', 'peach')];
                    // b: octopus×3 = 6 pts
                    d.players['b'].hand = [card('octopus', 'blue'), card('octopus', 'teal'), card('octopus', 'gray')];
                    d.turnPhase = 'play';
                });
                g.declare_stop('a');
                const d = g.get_data();
                assert.strictEqual(d.players['a'].score, 11);
                assert.strictEqual(d.players['b'].score, 6);
                assert.strictEqual(d.roundResult!.kind, 'stop');
            });

            it('LAST CHANCE won end-to-end (2p)', () => {
                const g = mockPlay(['a', 'b'], d => {
                    d.players['a'].hand = [
                        card('octopus', 'blue'), card('octopus', 'blue'),
                        card('octopus', 'blue'), card('octopus', 'blue')
                    ]; // 9 pts, bonus 4
                    d.players['b'].hand = [card('octopus', 'teal'), card('octopus', 'gray')]; // 3 pts, bonus 1
                    d.discardA = [card('shell', 'green')];
                    d.turnPhase = 'play';
                });
                g.declare_last_chance('a');
                // b's final turn: drawing is its only option (no duo, and Stop is blocked
                // during a Last Chance), so taking a discard auto-ends b's turn and resolves.
                g.take_discard('b', 'A');
                const d = g.get_data();
                assert.strictEqual(d.roundResult!.kind, 'last_chance_won');
                // a: 9 + 4 = 13
                assert.strictEqual(d.players['a'].score, 13);
                // b: only its colour bonus. b now holds octopus teal, octopus gray, shell green → each colour once → bonus 1.
                assert.strictEqual(d.players['b'].score, 1);
            });

            it('LAST CHANCE lost: opponent beats declarer → declarer only colour bonus, opponents card points', () => {
                const g = mockPlay(['a', 'b'], d => {
                    d.players['a'].hand = [
                        card('octopus', 'blue'), card('octopus', 'blue'),
                        card('octopus', 'blue'), card('octopus', 'blue')
                    ]; // 9 pts, bonus 4
                    // b already holds 12 pts (octopus×5) — beats the declarer.
                    d.players['b'].hand = [
                        card('octopus', 'teal'), card('octopus', 'gray'), card('octopus', 'green'),
                        card('octopus', 'yellow'), card('octopus', 'purple')
                    ];
                    d.discardA = [card('shell', 'green')];
                    d.turnPhase = 'play';
                });
                g.declare_last_chance('a');
                // b's only option is to draw; taking a discard auto-ends its final turn.
                g.take_discard('b', 'A');
                const d = g.get_data();
                assert.strictEqual(d.roundResult!.kind, 'last_chance_lost');
                assert.strictEqual(d.players['a'].score, 4);          // only colour bonus
                assert.ok(d.players['b'].score >= 12);                // its card points
            });
        });

        describe('Auto-ending a turn with no remaining options', () => {
            it('ends the turn automatically after a draw when nothing can be played', () => {
                // a draws its only option; the resulting hand has no duo and is below the
                // 7-point gate, so the turn ends automatically without a pass.
                const g = mockPlay(['a', 'b'], d => {
                    d.players['a'].hand = [card('octopus', 'blue')];
                    d.discardA = [card('shell', 'green')];
                    d.deck = [card('boat', 'blue'), card('crab', 'teal')]; // non-empty so the round doesn't end
                    d.currentPlayerId = 'a';
                    d.turnPhase = 'draw';
                });
                g.take_discard('a', 'A');
                const d = g.get_data();
                assert.strictEqual(d.currentPlayerId, 'b', 'turn passed to b automatically');
                assert.strictEqual(d.turnPhase, 'draw');
            });

            it('does NOT auto-end when a duo is still playable', () => {
                const g = mockPlay(['a', 'b'], d => {
                    d.players['a'].hand = [card('crab', 'blue')];
                    d.discardA = [card('crab', 'green')]; // draw makes a crab duo playable
                    d.currentPlayerId = 'a';
                    d.turnPhase = 'draw';
                });
                g.take_discard('a', 'A');
                const d = g.get_data();
                assert.strictEqual(d.currentPlayerId, 'a', 'a keeps the turn to play the duo');
                assert.strictEqual(d.turnPhase, 'play');
            });

            it('does NOT auto-end when the player can Stop / Last Chance (≥ 7 pts)', () => {
                const g = mockPlay(['a', 'b'], d => {
                    // sailor×2 + captain (drawn) = 11 pts, no duo — but the gate is open.
                    d.players['a'].hand = [card('sailor', 'pink'), card('sailor', 'orange')];
                    d.discardA = [card('captain', 'peach')];
                    d.currentPlayerId = 'a';
                    d.turnPhase = 'draw';
                });
                g.take_discard('a', 'A');
                const d = g.get_data();
                assert.strictEqual(d.currentPlayerId, 'a', 'a keeps the turn to decide Stop / Last Chance');
                assert.strictEqual(d.turnPhase, 'play');
            });
        });

        describe('Win conditions', () => {
            it('collecting all four mermaids wins instantly', () => {
                const m1 = card('mermaid', 'white');
                const m2 = card('mermaid', 'white');
                const m3 = card('mermaid', 'white');
                const g = mockPlay(['a', 'b'], d => {
                    d.players['a'].hand = [m1, m2, m3];
                    d.deck = [card('mermaid', 'white')];
                    d.turnPhase = 'play';
                    // Fish duo would let us draw; simpler: give a the 4th via a draw.
                    d.players['a'].hand.push(card('fish', 'blue'), card('fish', 'teal'));
                });
                // Playing the fish duo draws the mermaid → instant win.
                const hand = g.get_data().players['a'].hand;
                const fishes = hand.filter(c => c.type === 'fish');
                g.play_duo('a', fishes[0].id, fishes[1].id);
                const d = g.get_data();
                assert.strictEqual(d.status, Phase.GameOver);
                assert.strictEqual(d.winnerId, 'a');
                assert.strictEqual(d.winReason, 'mermaids');
            });

            it('crossing the threshold ends the game after a round', () => {
                const g = mockPlay(['a', 'b'], d => {
                    d.players['a'].score = 35;
                    d.players['b'].score = 10;
                    d.threshold = 40;
                    // a scores ~9 this round to cross 40.
                    d.players['a'].hand = [
                        card('octopus', 'blue'), card('octopus', 'blue'),
                        card('octopus', 'blue'), card('octopus', 'blue')
                    ];
                    d.turnPhase = 'play';
                });
                g.declare_stop('a');
                const d = g.get_data();
                assert.strictEqual(d.status, Phase.GameOver);
                assert.strictEqual(d.winnerId, 'a');
                assert.strictEqual(d.winReason, 'threshold');
            });

            it('exhausting the deck ends the round with no scoring', () => {
                const g = mockPlay(['a', 'b'], d => {
                    d.players['a'].hand = [card('octopus'), card('octopus')];
                    d.deck = [];               // empty
                    d.discardA = [card('shell')];
                    d.turnPhase = 'play';
                });
                g.pass_turn('a');              // end of turn, deck empty → round ends, no score
                const d = g.get_data();
                assert.strictEqual(d.roundResult!.kind, 'exhausted');
                assert.strictEqual(d.players['a'].score, 0);
            });
        });

        describe('Round rotation', () => {
            it('the player to the left of the round-ender starts the next round', () => {
                const g = mockPlay(['a', 'b', 'c'], d => {
                    d.players['b'].hand = [
                        card('octopus', 'blue'), card('octopus', 'blue'),
                        card('octopus', 'blue'), card('octopus', 'blue')
                    ];
                    d.currentPlayerId = 'b';
                    d.turnPhase = 'play';
                });
                g.declare_stop('b');
                assert.strictEqual(g.get_data().status, Phase.RoundEnd);
                g.next_round();
                // b ended → c starts the next round.
                assert.strictEqual(g.get_data().currentPlayerId, 'c');
                assert.strictEqual(g.get_data().status, Phase.Play);
            });
        });
    });

    describe('Type B: Sea Salt Integration Tests', () => {
        it('starts a 2-player game and draws from the deck', () => {
            const test = new GameRuleTest('seasalt', 1); // host + 1 client = 2 players
            test.invokeHostMethod('startGame');

            let raw = test.getHostData('gameState');
            const playerIds: string[] = raw.playerIds;
            assert.strictEqual(playerIds.length, 2);
            assert.strictEqual(raw.data.status, Phase.Play);
            assert.strictEqual(raw.data.deck.length + raw.data.discardA.length + raw.data.discardB.length, 58);

            const leader = raw.data.currentPlayerId;
            if (leader === playerIds[0]) {
                test.invokeHostMethod('drawFromDeck');
            } else {
                test.invokeClientMethod(0, 'drawFromDeck');
            }
            raw = test.getHostData('gameState');
            assert.strictEqual(raw.data.turnPhase, 'choose');
            assert.strictEqual(raw.data.drawnPair.length, 2);
        });
    });
});
