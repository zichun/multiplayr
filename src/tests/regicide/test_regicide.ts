/**
 * test_regicide.ts - Tests for Regicide.
 */

import { describe, it } from 'mocha';
import { strict as assert } from 'assert';
import {
    RegicideGameState as GameState,
    GameStateData,
    Phase,
    Card,
    Suit,
    attackValue,
    enemyStatsFor,
    maxHandSizeFor
} from '../../rules/regicide/RegicideGameState';
import { GameRuleTest } from '../GameRuleTest';

// ---- helpers ----------------------------------------------------------------

function card(suit: Suit | null, rank: number): Card {
    return { id: suit ? `${suit}${rank}` : `JOKER${rank || 1}`, suit, rank };
}

function setEnemy(d: GameStateData, suit: Suit, rank: number, overrides: Partial<any> = {}) {
    const stats = enemyStatsFor(rank);
    d.currentEnemy = {
        card: card(suit, rank),
        type: stats.type,
        suit,
        attack: stats.attack,
        health: stats.health,
        damage: 0,
        spadesTotal: 0,
        immunityCancelled: false,
        ...overrides
    };
}

// Build a controlled "Play" state, then mutate.
function mockGame(players: string[], mut: (d: GameStateData) => void): GameState {
    const g = new GameState(players);
    const d = g.get_data();
    d.status = Phase.Play;
    d.numPlayers = players.length;
    d.solo = players.length === 1;
    d.maxHandSize = maxHandSizeFor(players.length);
    d.hands = {};
    players.forEach(p => { d.hands[p] = []; });
    d.tavernDeck = [];
    d.discardPile = [];
    d.castleDeck = [];
    d.currentEnemy = null;
    d.playedCards = [];
    d.currentPlayerId = players[0];
    d.lastAction = {};
    players.forEach(p => { d.lastAction[p] = null; });
    d.pendingDamage = null;
    d.awaitingJesterChoice = null;
    d.soloJestersRemaining = players.length === 1 ? 2 : 0;
    d.jestersUsed = 0;
    mut(d);
    return GameState.from_data(d, players);
}

describe('Regicide Game Logic', () => {
    describe('Type A: RegicideGameState Unit Tests', () => {

        describe('Setup & Deal', () => {
            it('builds the right deck, hands and Jester counts per player count', () => {
                const cases: Array<[number, number, number]> = [
                    // [numPlayers, handSize, jestersInTavern]
                    [1, 8, 0], [2, 7, 0], [3, 6, 1], [4, 5, 2]
                ];
                for (const [n, handSize, jesters] of cases) {
                    const players = Array.from({ length: n }, (_, i) => 'p' + i);
                    const g = new GameState(players);
                    g.start_game('p0');
                    const d = g.get_data();

                    assert.strictEqual(d.status, Phase.Play);
                    assert.strictEqual(d.maxHandSize, handSize);
                    assert.strictEqual(d.currentPlayerId, 'p0');
                    for (const p of players) assert.strictEqual(d.hands[p].length, handSize);

                    // Castle deck: 12 royals total, minus the one revealed = 11 remain,
                    // and the first enemy is a Jack.
                    assert.strictEqual(d.castleDeck.length, 11);
                    assert.strictEqual(d.currentEnemy!.type, 'jack');

                    // Solo sets both Jesters aside; otherwise they live in the Tavern.
                    // Every non-castle card is either in a hand or still in the Tavern.
                    const totalCards = d.tavernDeck.length + d.discardPile.length
                        + Object.values(d.hands).reduce((s, h) => s + h.length, 0);
                    const dealt = handSize * n;
                    assert.strictEqual(totalCards, 40 + jesters, 'full 40 pips/aces + tavern jesters');
                    assert.strictEqual(d.tavernDeck.length, 40 + jesters - dealt, 'tavern holds the undealt remainder');
                    assert.strictEqual(d.solo, n === 1);
                    assert.strictEqual(d.soloJestersRemaining, n === 1 ? 2 : 0);
                }
            });

            it('layers the castle deck Jacks -> Queens -> Kings', () => {
                const g = new GameState(['a', 'b']);
                g.start_game('a');
                const d = g.get_data();
                const order = [d.currentEnemy!.card, ...d.castleDeck];
                const ranks = order.map(c => c.rank);
                // First four ranks are Jacks (11), next four Queens (12), last four Kings (13).
                assert.deepStrictEqual(ranks.slice(0, 4), [11, 11, 11, 11]);
                assert.deepStrictEqual(ranks.slice(4, 8), [12, 12, 12, 12]);
                assert.deepStrictEqual(ranks.slice(8, 12), [13, 13, 13, 13]);
            });

            it('rejects player counts outside 1-4', () => {
                assert.throws(() => new GameState(['a', 'b', 'c', 'd', 'e']).start_game(), /1 to 4/);
            });
        });

        describe('Card values', () => {
            it('scores Ace=1, pips=face, J=10, Q=15, K=20, Jester=0', () => {
                assert.strictEqual(attackValue(card('H', 1)), 1);
                assert.strictEqual(attackValue(card('H', 7)), 7);
                assert.strictEqual(attackValue(card('H', 11)), 10);
                assert.strictEqual(attackValue(card('H', 12)), 15);
                assert.strictEqual(attackValue(card('H', 13)), 20);
                assert.strictEqual(attackValue(card(null, 0)), 0);
            });
        });

        describe('Suit powers', () => {
            it('Clubs double the damage dealt', () => {
                const g = mockGame(['a', 'b'], d => {
                    setEnemy(d, 'H', 11, { health: 100 });        // Hearts Jack (clubs not immune)
                    d.hands['a'] = [card('C', 8), card('S', 13)]; // 8C + a spare to cover damage
                });
                g.play_cards('a', ['C8']);
                assert.strictEqual(g.get_data().currentEnemy!.damage, 16);
            });

            it('a Clubs enemy is immune to doubling until a Jester cancels it', () => {
                const immune = mockGame(['a', 'b'], d => {
                    setEnemy(d, 'C', 11, { health: 100 });
                    d.hands['a'] = [card('C', 8), card('S', 13)];
                });
                immune.play_cards('a', ['C8']);
                assert.strictEqual(immune.get_data().currentEnemy!.damage, 8, 'no double while immune');

                const cancelled = mockGame(['a', 'b'], d => {
                    setEnemy(d, 'C', 11, { health: 100, immunityCancelled: true });
                    d.hands['a'] = [card('C', 8), card('S', 13)];
                });
                cancelled.play_cards('a', ['C8']);
                assert.strictEqual(cancelled.get_data().currentEnemy!.damage, 16, 'doubles once cancelled');
            });

            it('Spades reduce the enemy attack, and retroactively count once a Jester cancels a Spade enemy', () => {
                // Non-spade enemy: spades always shield.
                const normal = mockGame(['a', 'b'], d => {
                    setEnemy(d, 'H', 12, { spadesTotal: 6 });
                });
                assert.strictEqual(normal.effective_shield(), 6);
                assert.strictEqual(normal.effective_attack(), 15 - 6);

                // Spades enemy: no shield until immunity cancelled, then the full
                // running total (incl. pre-Jester spades) counts.
                const spadeImmune = mockGame(['a', 'b'], d => {
                    setEnemy(d, 'S', 12, { spadesTotal: 6, immunityCancelled: false });
                });
                assert.strictEqual(spadeImmune.effective_shield(), 0, 'immune -> no shield');
                assert.strictEqual(spadeImmune.effective_attack(), 15);

                const spadeCancelled = mockGame(['a', 'b'], d => {
                    setEnemy(d, 'S', 12, { spadesTotal: 6, immunityCancelled: true });
                });
                assert.strictEqual(spadeCancelled.effective_shield(), 6, 'retroactive after cancel');
                assert.strictEqual(spadeCancelled.effective_attack(), 9);
            });

            it('Hearts shuffle cards from the discard to the bottom of the Tavern', () => {
                const g = mockGame(['a', 'b'], d => {
                    setEnemy(d, 'S', 11);                 // Spades Jack (hearts not immune)
                    d.discardPile = [card('D', 2), card('D', 3), card('D', 4), card('D', 5), card('D', 6)];
                    d.tavernDeck = [];
                    d.hands['a'] = [card('H', 5), card('S', 13)]; // heal 5, spare covers damage
                });
                g.play_cards('a', ['H5']);
                const d = g.get_data();
                assert.strictEqual(d.discardPile.length, 0, '5 of 5 discards healed');
                assert.strictEqual(d.tavernDeck.length, 5, 'healed cards under the tavern');
            });

            it('Diamonds draw cards for the team', () => {
                const g = mockGame(['a', 'b'], d => {
                    setEnemy(d, 'S', 11);                 // Spades Jack (diamonds not immune)
                    d.tavernDeck = [card('C', 2), card('C', 3), card('C', 4), card('C', 5)];
                    d.hands['a'] = [card('D', 3), card('S', 13)];
                    d.hands['b'] = [];
                });
                g.play_cards('a', ['D3']);
                const d = g.get_data();
                const drawnA = d.hands['a'].length - 1; // minus the spare left after playing D3
                const drawnB = d.hands['b'].length;
                assert.strictEqual(drawnA + drawnB, 3, 'drew 3 across the team');
                assert.strictEqual(d.tavernDeck.length, 1);
            });

            it('an enemy is immune to its own suit power (Diamonds enemy blocks the draw) but takes the damage', () => {
                const g = mockGame(['a', 'b'], d => {
                    setEnemy(d, 'D', 11, { health: 100 });     // Diamonds Jack
                    d.tavernDeck = [card('C', 2), card('C', 3), card('C', 4)];
                    d.hands['a'] = [card('D', 5), card('S', 13)];
                });
                g.play_cards('a', ['D5']);
                const d = g.get_data();
                assert.strictEqual(d.tavernDeck.length, 3, 'no draw while immune');
                assert.strictEqual(d.currentEnemy!.damage, 5, 'value still deals damage');
            });
        });

        describe('Combos & Companions', () => {
            it('accepts a same-number combo totalling <= 10', () => {
                const g = mockGame(['a', 'b'], d => {
                    setEnemy(d, 'H', 12, { health: 100 });
                    d.hands['a'] = [card('D', 3), card('S', 3), card('C', 3), card('H', 13)];
                });
                g.play_cards('a', ['D3', 'S3', 'C3']); // total 9
                const d = g.get_data();
                // Clubs double the full 9 -> 18 damage.
                assert.strictEqual(d.currentEnemy!.damage, 18);
                assert.strictEqual(d.currentEnemy!.spadesTotal, 9, 'spades shield at the combined value');
            });

            it('rejects a combo over 10 or of mixed numbers', () => {
                const g = mockGame(['a', 'b'], d => {
                    setEnemy(d, 'H', 12, { health: 100 });
                    d.hands['a'] = [card('D', 6), card('S', 6), card('C', 5)];
                });
                assert.throws(() => g.play_cards('a', ['D6', 'S6']), /10 or less/);
                assert.throws(() => g.play_cards('a', ['D6', 'C5']), /same number/);
            });

            it('lets an Animal Companion pair with exactly one other card', () => {
                const g = mockGame(['a', 'b'], d => {
                    setEnemy(d, 'H', 12, { health: 100 });
                    d.hands['a'] = [card('C', 1), card('D', 8), card('S', 13)];
                });
                g.play_cards('a', ['C1', 'D8']); // value 9, clubs double -> 18
                assert.strictEqual(g.get_data().currentEnemy!.damage, 18);
            });

            it('rejects three cards including an Ace', () => {
                const g = mockGame(['a', 'b'], d => {
                    setEnemy(d, 'H', 12, { health: 100 });
                    d.hands['a'] = [card('C', 1), card('D', 8), card('S', 8)];
                });
                assert.throws(() => g.play_cards('a', ['C1', 'D8', 'S8']), /exactly one/);
            });
        });

        describe('Defeat resolution', () => {
            it('places an exact-kill enemy on top of the Tavern deck and reveals the next', () => {
                const g = mockGame(['a', 'b'], d => {
                    setEnemy(d, 'D', 11);                 // Diamonds Jack (immune to its own draw)
                    d.castleDeck = [card('S', 11)];
                    d.hands['a'] = [card('D', 13)];       // K = 20 == 20 health -> exact
                });
                g.play_cards('a', ['D13']);
                const d = g.get_data();
                assert.strictEqual(d.tavernDeck[0].id, 'D11', 'exact kill to top of tavern');
                assert.strictEqual(d.currentEnemy!.suit, 'S', 'next enemy revealed');
                assert.strictEqual(d.currentPlayerId, 'a', 'defeating player keeps the turn');
                assert.strictEqual(d.pendingDamage, null, 'defeat skips suffering damage');
                assert.strictEqual(d.enemiesDefeated, 1);
            });

            it('discards a non-exact (overkill) kill and its played cards', () => {
                const g = mockGame(['a', 'b'], d => {
                    setEnemy(d, 'H', 11);                 // Hearts Jack, 20 health
                    d.castleDeck = [card('S', 11)];
                    d.playedCards = [card('H', 2)];       // a card already on the pile
                    d.hands['a'] = [card('C', 13)];       // K of Clubs -> 20, doubled to 40 (overkill)
                });
                g.play_cards('a', ['C13']);
                const d = g.get_data();
                assert.strictEqual(d.enemiesDefeated, 1);
                assert.ok(d.discardPile.some(c => c.id === 'H11'), 'overkill enemy to discard');
                assert.ok(d.discardPile.some(c => c.id === 'H2'), 'played cards discarded');
                assert.ok(!d.tavernDeck.some(c => c.id === 'H11'), 'not placed on the tavern');
            });

            it('wins when the last royal falls', () => {
                const g = mockGame(['a', 'b'], d => {
                    setEnemy(d, 'D', 13, { health: 20 });  // small-health King, castle empty
                    d.castleDeck = [];
                    d.hands['a'] = [card('D', 13)];        // 20 dmg -> exact kill
                });
                g.play_cards('a', ['D13']);
                assert.strictEqual(g.get_data().status, Phase.Won);
            });
        });

        describe('Suffer damage', () => {
            it('requires a discard covering the effective attack, then passes the turn', () => {
                const g = mockGame(['a', 'b'], d => {
                    setEnemy(d, 'H', 11);                 // Jack attack 10
                    d.hands['a'] = [card('D', 4), card('C', 9), card('S', 8)];
                });
                g.play_cards('a', ['D4']); // 4 dmg, not defeated -> suffer 10
                assert.deepStrictEqual(g.get_data().pendingDamage, { playerId: 'a', amount: 10 });

                assert.throws(() => g.discard_for_damage('a', ['C9']), /at least 10/);
                g.discard_for_damage('a', ['C9', 'S8']); // 17 >= 10
                const d = g.get_data();
                assert.strictEqual(d.pendingDamage, null);
                assert.strictEqual(d.currentPlayerId, 'b', 'turn passes clockwise');
                assert.strictEqual(d.discardPile.length, 2);
            });

            it('loses when the player cannot cover the damage', () => {
                const g = mockGame(['a', 'b'], d => {
                    setEnemy(d, 'H', 11);                 // attack 10
                    d.hands['a'] = [card('D', 2)];        // only a 2 left after playing it -> empty
                });
                g.play_cards('a', ['D2']);
                assert.strictEqual(g.get_data().status, Phase.Lost);
            });

            it('emits a hit event carrying the damage actually dealt (Clubs doubled)', () => {
                const g = mockGame(['a', 'b'], d => {
                    setEnemy(d, 'H', 11, { health: 100 });   // Clubs not immune
                    d.hands['a'] = [card('C', 8), card('S', 13)];
                });
                g.play_cards('a', ['C8']);
                const hit = g.get_data().lastHit!;
                assert.strictEqual(hit.playerId, 'a');
                assert.strictEqual(hit.amount, 16, 'reports dealt damage, not raw value');
            });

            it('emits a distinct hit event per blow, and none for a Jester', () => {
                const g = mockGame(['a', 'b'], d => {
                    setEnemy(d, 'H', 11, { health: 100 });
                    d.hands['a'] = [card('D', 4), card('C', 9), card('S', 8)];
                    d.hands['b'] = [card('D', 4), card('C', 9), card('S', 8)];
                });
                g.play_cards('a', ['D4']);
                const first = g.get_data().lastHit!;
                g.discard_for_damage('a', ['C9', 'S8']);
                g.play_cards('b', ['D4']);
                const second = g.get_data().lastHit!;
                assert.strictEqual(first.amount, 4);
                assert.strictEqual(second.amount, 4);
                assert.notStrictEqual(second.hitId, first.hitId, 'identical blows stay distinguishable');

                // A Jester deals no damage, so it lands no blow.
                const j = mockGame(['a', 'b'], d => {
                    setEnemy(d, 'S', 11);
                    d.hands['a'] = [card(null, 1)];
                });
                j.play_jester('a', 'JOKER1');
                assert.strictEqual(j.get_data().lastHit, null);
            });

            it('emits a distinct attack event for every landed strike', () => {
                const g = mockGame(['a', 'b'], d => {
                    setEnemy(d, 'H', 11, { health: 100 });   // Jack, attack 10
                    d.hands['a'] = [card('D', 4), card('C', 9), card('S', 8)];
                    d.hands['b'] = [card('D', 5), card('C', 9), card('S', 8)];
                });
                g.play_cards('a', ['D4']);
                const first = g.get_data().lastAttack!;
                assert.strictEqual(first.playerId, 'a');
                assert.strictEqual(first.amount, 10);

                g.discard_for_damage('a', ['C9', 'S8']);
                g.play_cards('b', ['D5']);
                const second = g.get_data().lastAttack!;
                assert.strictEqual(second.playerId, 'b');
                assert.strictEqual(second.amount, 10);
                // Identical attacks back-to-back must still be distinguishable.
                assert.notStrictEqual(second.attackId, first.attackId);
            });

            it('records the attack event even when the blow is fatal', () => {
                const g = mockGame(['a', 'b'], d => {
                    setEnemy(d, 'H', 11);
                    d.hands['a'] = [card('D', 2)];   // cannot cover 10
                });
                g.play_cards('a', ['D2']);
                const d = g.get_data();
                assert.strictEqual(d.status, Phase.Lost);
                assert.strictEqual(d.lastAttack!.playerId, 'a');
                assert.strictEqual(d.lastAttack!.amount, 10);
            });

            it('emits no attack event when fully shielded', () => {
                const g = mockGame(['a', 'b'], d => {
                    setEnemy(d, 'H', 11, { spadesTotal: 12 });
                    d.hands['a'] = [card('D', 3), card('C', 3)];
                });
                g.play_cards('a', ['D3']);
                assert.strictEqual(g.get_data().lastAttack, null, 'no blow landed');
            });

            it('skips the discard entirely when fully shielded', () => {
                const g = mockGame(['a', 'b'], d => {
                    setEnemy(d, 'H', 11, { spadesTotal: 12 }); // attack 10, shield 12 -> 0
                    d.hands['a'] = [card('D', 3), card('C', 3)];
                });
                g.play_cards('a', ['D3']);
                const d = g.get_data();
                assert.strictEqual(d.pendingDamage, null);
                assert.strictEqual(d.currentPlayerId, 'b');
            });
        });

        describe('Yielding', () => {
            it('is blocked when every other player has yielded', () => {
                const g = mockGame(['a', 'b'], d => {
                    setEnemy(d, 'H', 11);
                    d.lastAction = { a: null, b: 'yielded' };
                });
                assert.strictEqual(g.can_yield('a'), false);
                assert.throws(() => g.yield_turn('a'), /cannot yield/);
            });

            it('is allowed when another player still has a play on record', () => {
                const g = mockGame(['a', 'b', 'c'], d => {
                    setEnemy(d, 'H', 11, { spadesTotal: 20 }); // 0 effective attack -> no discard
                    d.lastAction = { a: null, b: 'yielded', c: 'played' };
                });
                assert.strictEqual(g.can_yield('a'), true);
                g.yield_turn('a');
                assert.strictEqual(g.get_data().currentPlayerId, 'b');
            });

            it('is never allowed in solo play', () => {
                const g = mockGame(['solo'], d => { setEnemy(d, 'H', 11); });
                assert.strictEqual(g.can_yield('solo'), false);
            });
        });

        describe('Jester (multiplayer)', () => {
            it('cancels immunity and lets the player choose who goes next', () => {
                const g = mockGame(['a', 'b', 'c'], d => {
                    setEnemy(d, 'S', 11);                 // Spades Jack
                    d.hands['a'] = [card(null, 1)];       // a Jester
                });
                g.play_jester('a', 'JOKER1');
                let d = g.get_data();
                assert.strictEqual(d.currentEnemy!.immunityCancelled, true);
                assert.deepStrictEqual(d.awaitingJesterChoice, { playerId: 'a' });

                g.choose_next_player('a', 'c');
                d = g.get_data();
                assert.strictEqual(d.awaitingJesterChoice, null);
                assert.strictEqual(d.currentPlayerId, 'c');
            });
        });

        describe('Solo play', () => {
            it('refills the hand and tracks Jesters used', () => {
                const g = mockGame(['solo'], d => {
                    setEnemy(d, 'H', 11);
                    d.hands['solo'] = [card('D', 2), card('D', 3)];
                    d.tavernDeck = Array.from({ length: 10 }, (_, i) => card('C', (i % 9) + 2));
                    d.maxHandSize = 8;
                    d.soloJestersRemaining = 2;
                });
                g.solo_refill('solo');
                const d = g.get_data();
                assert.strictEqual(d.hands['solo'].length, 8, 'refilled to 8');
                assert.strictEqual(d.soloJestersRemaining, 1);
                assert.strictEqual(d.jestersUsed, 1);
                assert.strictEqual(d.discardPile.length, 2, 'old hand discarded');
            });

            it('awards a victory tier by Jesters used', () => {
                const g = mockGame(['solo'], d => {
                    setEnemy(d, 'D', 13, { health: 20 });
                    d.castleDeck = [];
                    d.jestersUsed = 1;                    // -> silver
                    d.hands['solo'] = [card('D', 13)];
                });
                g.play_cards('solo', ['D13']);
                const d = g.get_data();
                assert.strictEqual(d.status, Phase.Won);
                assert.strictEqual(d.winTier, 'silver');
            });
        });
    });

    describe('Type B: Regicide Integration Tests', () => {
        it('starts a game and reveals the first Jack', () => {
            const test = new GameRuleTest('regicide', 1); // host + 1 client = 2 players
            test.invokeHostMethod('startGame');

            assert.strictEqual(test.getHostData('lobby_started'), true);
            const raw: any = test.getHostData('gameState');
            const data = typeof raw.get_data === 'function' ? raw.get_data() : raw.data;
            assert.strictEqual(data.status, Phase.Play);
            assert.strictEqual(data.numPlayers, 2);
            assert.ok(data.currentEnemy, 'an enemy is revealed');
            assert.strictEqual(data.currentEnemy.type, 'jack');
        });

        it('lets the current player play a card through the remote method', () => {
            const test = new GameRuleTest('regicide', 1);
            test.invokeHostMethod('startGame');

            const raw: any = test.getHostData('gameState');
            const data = typeof raw.get_data === 'function' ? raw.get_data() : raw.data;
            const current = data.currentPlayerId;

            // Find a non-Jester card in the current player's hand and play it.
            const hand: Card[] = data.hands[current];
            const playable = hand.find(c => c.suit !== null) as Card;

            // The current player is players[0] = the host in this setup.
            test.invokeHostMethod('playCards', [playable.id]);

            const raw2: any = test.getHostData('gameState');
            const data2 = typeof raw2.get_data === 'function' ? raw2.get_data() : raw2.data;
            assert.ok(
                data2.playedCards.length >= 1 || data2.enemiesDefeated >= 1,
                'the play was registered'
            );
        });
    });
});
