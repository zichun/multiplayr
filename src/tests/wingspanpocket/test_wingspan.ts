/**
 * test_wingspan.ts — Wingspan (Pocket) tests.
 *   Type A: pure WingspanGameState engine logic.
 *   Type B: end-to-end via GameRuleTest (remote methods + tick distribution).
 */

import { describe, it } from 'mocha';
import { strict as assert } from 'assert';

import { WingspanGameState, Phase, PlayPayment } from '../../rules/wingspanpocket/WingspanGameState';
import {
    BIRD_CARDS, CARD_BY_ID, cardMatchesStaticGoal
} from '../../rules/wingspanpocket/WingspanData';
import { GameRuleTest } from '../GameRuleTest';

// ---- helpers ----
const byName = (name: string): number => {
    const c = BIRD_CARDS.find(x => x.common_name === name);
    if (!c) throw new Error('no card named ' + name);
    return c.id;
};
/** a card id whose reverse food includes `food` */
const foodCardId = (food: string, exclude: number[] = []): number => {
    const c = BIRD_CARDS.find(x => x.reverse_food.indexOf(food as any) !== -1 && exclude.indexOf(x.id) === -1);
    if (!c) throw new Error('no food card for ' + food);
    return c.id;
};

/** Force a controlled mid-game state for a fresh 2-player engine. */
function fresh(): WingspanGameState {
    const gs = new WingspanGameState(['a', 'b']);
    gs.start_game({ seed: 7 });
    return gs;
}

describe('Wingspan (Pocket)', () => {

    // ======================================================================
    describe('Type A: engine', () => {

        describe('Setup', () => {
            it('deals 6 cards (2 bird / 4 food), 1 nest egg, 4 supply birds & food decks', () => {
                const gs = fresh();
                const d = gs.get_data();
                for (const id of ['a', 'b']) {
                    const p = d.players[id];
                    assert.equal(p.reserve.length, 6);
                    assert.equal(p.reserve.filter(r => r.face === 'bird').length, 2);
                    assert.equal(p.reserve.filter(r => r.face === 'food').length, 4);
                    assert.equal(p.nestEggs, 1);
                }
                assert.equal(gs.get_supply_birds().filter(x => x != null).length, 4);
                assert.equal(gs.get_food_deck_counts().length, 4);
                assert.equal(gs.get_phase(), Phase.Nest);
            });

            it('picks 2 goals in advanced mode', () => {
                const gs = new WingspanGameState(['a', 'b']);
                gs.start_game({ seed: 1, advanced: true });
                assert.equal(gs.get_goals()!.length, 2);
            });
        });

        describe('Lay eggs', () => {
            it('lays eggs on the nest and rejects distinct-target / limit violations', () => {
                const gs = fresh();
                gs.lay_eggs('a', [-1]); // 1 egg on nest
                assert.equal(gs.get_player('a')!.nestEggs, 2);
                // that ended a's turn (no birds → activation auto-finished)
                assert.equal(gs.currentPlayerId(), 'b');
                assert.throws(() => gs.lay_eggs('b', [-1, -1]), /different card/);
            });

            it('cannot lay past the nest limit of 3', () => {
                const gs = fresh();
                const d = gs.get_data();
                d.players['a'].nestEggs = 3;
                assert.throws(() => gs.lay_eggs('a', [-1]), /egg limit/);
            });
        });

        describe('Play a bird', () => {
            it('pays food from reserve, appends to flock, discards spent food', () => {
                const gs = fresh();
                const d = gs.get_data();
                const bird = byName('Common Swift'); // cost invertebrate:1, egg:0
                const invertFood = foodCardId('invertebrate', [bird]);
                d.players['a'].reserve = [
                    { cardId: bird, face: 'bird' },
                    { cardId: invertFood, face: 'food' }
                ];
                d.players['a'].flock = [];
                const pay = gs.computeAutoPayment('a', bird)!;
                assert.ok(pay, 'affordable');
                gs.play_bird('a', bird, pay);
                const p = gs.get_player('a')!;
                assert.equal(p.flock.length, 1);
                assert.equal(p.flock[0].cardId, bird);
                assert.equal(p.reserve.length, 0, 'bird played + food spent');
                assert.equal(gs.get_discard_count(), 1);
            });

            it('pays an egg cost from the nest', () => {
                const gs = fresh();
                const d = gs.get_data();
                const bird = byName('American Robin'); // cost egg1 + invert + fruit
                d.players['a'].reserve = [
                    { cardId: bird, face: 'bird' },
                    { cardId: foodCardId('invertebrate', [bird]), face: 'food' },
                    { cardId: foodCardId('fruit', [bird]), face: 'food' }
                ];
                d.players['a'].flock = [];
                d.players['a'].nestEggs = 1;
                const pay = gs.computeAutoPayment('a', bird)!;
                assert.equal(pay.eggSources.length, 1);
                gs.play_bird('a', bird, pay);
                assert.equal(gs.get_player('a')!.nestEggs, 0, 'egg spent');
                assert.equal(gs.get_player('a')!.flock.length, 1);
            });

            it('uses a 2-for-1 conversion only when a matching food is missing', () => {
                const gs = fresh();
                const d = gs.get_data();
                const falcon = byName('Peregrine Falcon'); // cost egg:1, rodent:2
                const rodentCard = foodCardId('rodent', [falcon]);
                // reserve has 1 rodent food + two non-rodent foods (to cover the 2nd rodent 2-for-1)
                d.players['a'].reserve = [
                    { cardId: falcon, face: 'bird' },
                    { cardId: rodentCard, face: 'food' },
                    { cardId: foodCardId('seed', [falcon, rodentCard]), face: 'food' },
                    { cardId: foodCardId('fruit', [falcon, rodentCard]), face: 'food' }
                ];
                d.players['a'].flock = [];
                d.players['a'].nestEggs = 1;
                const pay = gs.computeAutoPayment('a', falcon)!;
                // rodent paid directly (1 card) + missing rodent via 2-for-1 (2 cards) = 3 cards
                assert.equal(pay.foods.length, 3, 'rodent + a 2-for-1 for the missing rodent');
                assert.equal(pay.eggSources.length, 1, 'egg paid');
                gs.play_bird('a', falcon, pay); // still a legal payment
                assert.equal(gs.get_player('a')!.flock.length, 1);
            });

            it('rejects an underpayment', () => {
                const gs = fresh();
                const d = gs.get_data();
                const bird = byName('Common Swift');
                d.players['a'].reserve = [{ cardId: bird, face: 'bird' }];
                d.players['a'].flock = [];
                const bad: PlayPayment = { foods: [], eggSources: [] };
                assert.throws(() => gs.play_bird('a', bird, bad), /cover the cost/);
            });

            it('covers a cost with two 2-food cards via proper matching (not greedy)', () => {
                // Bird cost: invertebrate + seed (Great Tit). Cards: [invert/seed] and [invert/fruit].
                // The only valid assignment is card1→seed, card2→invertebrate — a greedy
                // matcher grabs card1 for invertebrate first and wrongly reports "not enough".
                const gs = fresh();
                const d = gs.get_data();
                const bird = byName('Great Tit');             // cost invertebrate:1 + seed:1, egg:0
                const c1 = byName('American Robin');          // food: invertebrate / seed
                const c2 = byName('Common Bulbul');           // food: invertebrate / fruit
                d.players['a'].reserve = [
                    { cardId: bird, face: 'bird' },
                    { cardId: c1, face: 'food' },
                    { cardId: c2, face: 'food' }
                ];
                d.players['a'].flock = [];
                assert.equal(gs.can_pay('a', bird, { foods: [{ cardId: c1, as: 'seed' }, { cardId: c2, as: 'invertebrate' }], eggSources: [] }), true, 'both cards together cover invertebrate + seed');
                const auto = gs.computeAutoPayment('a', bird);
                assert.ok(auto && auto.foods.length === 2, 'auto-payment finds the valid 2-card assignment');
                gs.play_bird('a', bird, auto!);
                assert.equal(gs.get_player('a')!.flock.length, 1, 'bird played');
                assert.equal(gs.get_player('a')!.reserve.length, 0, 'both food cards spent');
            });

            it('can_pay validates a hand-picked payment without mutating (manual payment UI)', () => {
                const gs = fresh();
                const d = gs.get_data();
                const bird = byName('Common Swift'); // cost invertebrate:1
                const invertFood = foodCardId('invertebrate', [bird]);
                const otherFood = BIRD_CARDS.find(x => !x.reverse_food.includes('invertebrate') && x.id !== bird && x.id !== invertFood)!.id;
                d.players['a'].reserve = [
                    { cardId: bird, face: 'bird' },
                    { cardId: invertFood, face: 'food' },
                    { cardId: otherFood, face: 'food' }
                ];
                d.players['a'].flock = [];
                // paying with the invertebrate card covers it
                assert.equal(gs.can_pay('a', bird, { foods: [{ cardId: invertFood, as: 'invertebrate' }], eggSources: [] }), true);
                // paying with nothing does not
                assert.equal(gs.can_pay('a', bird, { foods: [], eggSources: [] }), false);
                // a single non-matching card does not (no 2-for-1 possible with 1 card)
                assert.equal(gs.can_pay('a', bird, { foods: [{ cardId: otherFood, as: 'seed' }], eggSources: [] }), false);
                // …but any two food cards do (2-for-1)
                assert.equal(gs.can_pay('a', bird, { foods: [{ cardId: invertFood, as: 'invertebrate' }, { cardId: otherFood, as: 'seed' }], eggSources: [] }), true);
                // can_pay did not mutate state
                assert.equal(gs.get_player('a')!.reserve.length, 3);
            });

            it('correctly validates 2 fruits + 1 rodent + 1 egg for [egg + invert + fruit] vs [egg + invert + seed]', () => {
                const gs = fresh();
                const d = gs.get_data();
                const oriole = byName('Baltimore Oriole'); // cost: 1 egg, 1 invertebrate, 1 fruit
                const pigeon = byName('Rock Pigeon');     // cost: 1 egg, 1 invertebrate, 1 seed
                const fruit1 = byName('Grey Go-away-bird'); // reverse: fruit
                const fruit2 = byName('Grey Go-away-bird'); // reverse: fruit
                const rodent = byName('Barn Owl');          // reverse: rodent
                d.players['a'].reserve = [
                    { cardId: oriole, face: 'bird' },
                    { cardId: pigeon, face: 'bird' },
                    { cardId: fruit1, face: 'food' },
                    { cardId: fruit2, face: 'food' },
                    { cardId: rodent, face: 'food' }
                ];
                d.players['a'].nestEggs = 1;

                // Baltimore Oriole needs: 1 egg + 1 fruit + 1 invertebrate
                // 1 egg is paid by nest. 1 fruit paid by fruit1. Missing 1 invertebrate is paid by (fruit2 + rodent) via 2-for-1.
                assert.ok(gs.computeAutoPayment('a', oriole) !== null, 'Baltimore Oriole can be played with 2 fruits, 1 rodent, 1 egg');

                // Rock Pigeon needs: 1 egg + 1 invertebrate + 1 seed
                // 1 egg is paid by nest. Both invertebrate and seed are missing (0 in reserve).
                // 2-for-1 requires 2 foods EACH (4 foods total). With only 3 foods, player cannot pay both.
                assert.strictEqual(gs.computeAutoPayment('a', pigeon), null, 'Rock Pigeon cannot be played because 2 missing foods require 4 cards (2-for-1)');
            });
        });

        describe('Draw 2', () => {
            it('draws a supply bird + a food; the bird slot empties then refills', () => {
                const gs = fresh();
                const before = gs.get_player('a')!.reserve.length;
                gs.draw_2('a', [{ kind: 'bird', index: 0 }, { kind: 'food', index: 1 }]);
                const p = gs.get_player('a')!;
                assert.equal(p.reserve.length, before + 2);
                assert.equal(p.reserve.filter(r => r.face === 'bird').length >= 3, true);
                // after the turn (no birds) the supply refilled
                assert.equal(gs.get_supply_birds().filter(x => x != null).length, 4);
            });

            it('replenishes empty food deck from bottom half of discard pile immediately', () => {
                const gs = fresh();
                const d = gs.get_data();
                d.foodDecks[0] = [100];
                d.discard = [1, 2, 3, 4, 5, 6];
                // drawing the last card from deck 0 empties it, which immediately triggers replenishment from discard
                const drawn = gs.drawFromFoodDeck(0);
                assert.equal(drawn, 100);
                // bottom half of discard [1, 2, 3] was taken into deck 0, remaining discard is [4, 5, 6]
                assert.equal(d.foodDecks[0].length, 3);
                assert.deepEqual(d.discard, [4, 5, 6]);
            });

            it('replenishes empty food deck from bottom half of largest food deck if no discard pile', () => {
                const gs = fresh();
                const d = gs.get_data();
                d.discard = [];
                d.foodDecks[0] = [100];
                d.foodDecks[1] = [1, 2, 3, 4, 5, 6, 7, 8];
                d.foodDecks[2] = [20, 21];
                d.foodDecks[3] = [30, 31];
                // drawing the last card from deck 0 empties it, replenishing from largest deck (deck 1)
                const drawn = gs.drawFromFoodDeck(0);
                assert.equal(drawn, 100);
                // bottom half of deck 1 (4 cards) taken into deck 0
                assert.equal(d.foodDecks[0].length, 4);
                assert.equal(d.foodDecks[1].length, 4);
            });

            it('replenishes immediately during draw_2 when a deck runs out on pick 1', () => {
                const gs = fresh();
                const d = gs.get_data();
                d.foodDecks[0] = [100];
                d.discard = [1, 2, 3, 4];
                // draw 2 foods from deck 0
                gs.draw_2('a', [{ kind: 'food', index: 0 }, { kind: 'food', index: 0 }]);
                const p = gs.get_player('a')!;
                // picked card 100, deck 0 immediately replenished with 2 cards [1, 2], then picked one of the new cards
                assert.equal(p.reserve.filter(r => r.face === 'food').length >= 2, true);
                assert.equal(d.foodDecks[0].length, 1);
                assert.deepEqual(d.discard, [3, 4]);
            });

            it('supports step-by-step draw_card revealing card 2 before committing card 2', () => {
                const gs = fresh();
                const d = gs.get_data();
                d.foodDecks[0] = [10, 20];
                const p = gs.get_player('a')!;
                const initialReserveLen = p.reserve.length;

                // Step 1: draw first card from deck 0
                gs.draw_card('a', { kind: 'food', index: 0 }, false);
                assert.equal(p.reserve.length, initialReserveLen + 1);
                assert.equal(p.reserve[p.reserve.length - 1].cardId, 20);
                assert.equal(d.foodDecks[0][d.foodDecks[0].length - 1], 10); // card 10 is now visible as the new top
                assert.equal(gs.get_pending_draw()?.count, 1);
                assert.equal(d.phase, Phase.Nest); // still in nest phase for pick 2

                // Step 2: draw second card from same deck 0 (the newly revealed card 10)
                gs.draw_card('a', { kind: 'food', index: 0 }, true);
                assert.equal(p.reserve.length, initialReserveLen + 2);
                assert.equal(p.reserve[p.reserve.length - 1].cardId, 10);
                assert.equal(gs.get_pending_draw(), null);
            });

            it('allows finishing draw after taking 1 card via finish_draw', () => {
                const gs = fresh();
                const d = gs.get_data();
                d.foodDecks[0] = [10, 20];
                const p = gs.get_player('a')!;
                const initialReserveLen = p.reserve.length;

                gs.draw_card('a', { kind: 'food', index: 0 }, false);
                assert.equal(p.reserve.length, initialReserveLen + 1);
                assert.equal(gs.get_pending_draw()?.count, 1);

                // Finish draw without taking a 2nd card
                gs.finish_draw('a');
                assert.equal(gs.get_pending_draw(), null);
            });
        });

        describe('Activation — brown powers', () => {
            const setActivate = (gs: WingspanGameState, flock: any[]) => {
                const d = gs.get_data();
                d.players['a'].flock = flock;
                d.phase = Phase.Activate;
                d.current = 0;
                d.players['a'].tokenIndex = 0;
            };

            it('honors the player-chosen deck for "draw any food"', () => {
                const gs = fresh();
                const d = gs.get_data();
                const gull = byName('Black-headed Gull'); // [draw_any_food]
                const fishCard = foodCardId('fish');
                const seedCard = foodCardId('seed', [fishCard]);
                d.players['a'].reserve = [];
                d.foodDecks = [[fishCard], [], [seedCard], []];
                setActivate(gs, [{ cardId: gull, eggs: 0, tucked: [] }]);
                gs.activate('a', { foodDeck: 2 }); // choose deck 2 (seed)
                const drawn = gs.get_player('a')!.reserve.map(r => r.cardId);
                assert.ok(drawn.indexOf(seedCard) !== -1, 'drew from the chosen deck');
                assert.ok(drawn.indexOf(fishCard) === -1, 'did not draw the other deck');
            });

            it('honors the chosen deck for a specific food when multiple decks show it', () => {
                const gs = fresh();
                const d = gs.get_data();
                const goose = byName('Egyptian Goose');            // [draw_seed]
                const seedInvert = byName('American Robin');       // reverse: invertebrate / seed
                const seedFruit = byName('Baltimore Oriole');      // reverse: seed / fruit
                d.players['a'].reserve = [];
                d.foodDecks = [[seedInvert], [], [seedFruit], []];
                setActivate(gs, [{ cardId: goose, eggs: 0, tucked: [] }]);
                gs.activate('a', { foodDeck: 2 }); // choose the seed/fruit deck
                const drawn = gs.get_player('a')!.reserve.map(r => r.cardId);
                assert.ok(drawn.indexOf(seedFruit) !== -1, 'drew the seed card from the chosen deck');
                assert.ok(drawn.indexOf(seedInvert) === -1, 'did not draw the other seed card');
            });

            it('honors the player-chosen deck for "draw fruit"', () => {
                const gs = fresh();
                const d = gs.get_data();
                const dove = byName('Many-colored Fruit-Dove'); // [draw_fruit]
                const fruitSeed = byName('Baltimore Oriole');    // reverse: seed / fruit
                const fruitInvert = byName('Mandarin Duck');     // reverse: invertebrate / fruit
                d.players['a'].reserve = [];
                d.foodDecks = [[fruitSeed], [fruitInvert], [], []];
                setActivate(gs, [{ cardId: dove, eggs: 0, tucked: [] }]);
                gs.activate('a', { foodDeck: 1 }); // choose deck 1 (invertebrate / fruit)
                const drawn = gs.get_player('a')!.reserve.map(r => r.cardId);
                assert.ok(drawn.indexOf(fruitInvert) !== -1, 'drew the fruit from chosen deck 1');
                assert.ok(drawn.indexOf(fruitSeed) === -1, 'did not draw deck 0');
            });

            it('honors the player-chosen card for "tuck fruit" or "tuck a card"', () => {
                const gs = fresh();
                const d = gs.get_data();
                const toucan = byName('Keel-billed Toucan'); // [draw_fruit] or [tuck_fruit]
                const f1 = byName('Baltimore Oriole');       // reverse: seed / fruit
                const f2 = byName('Mandarin Duck');          // reverse: invertebrate / fruit
                d.players['a'].reserve = [
                    { cardId: f1, face: 'food' },
                    { cardId: f2, face: 'food' }
                ];
                setActivate(gs, [{ cardId: toucan, eggs: 0, tucked: [] }]);
                // branch 1 = tuck_fruit, pick specific fruit card f2
                gs.activate('a', { branch: 1, tuckCardId: f2 });
                const p = gs.get_player('a')!;
                assert.equal(p.flock[0].tucked.length, 1);
                assert.equal(p.flock[0].tucked[0], f2, 'tucked chosen fruit card');
                assert.equal(p.reserve.length, 1);
                assert.equal(p.reserve[0].cardId, f1, 'other fruit remains in reserve');
            });

            it('resolves sequence [draw_fruit] [tuck_fruit] with chosen deck and chosen tuck card', () => {
                const gs = fresh();
                const d = gs.get_data();
                const hornbill = byName('Great Hornbill'); // [draw_fruit] [tuck_fruit]
                const fToDraw = byName('Mandarin Duck');    // fruit card in deck
                const fToTuck = byName('Baltimore Oriole'); // fruit card already in reserve
                d.foodDecks = [[], [fToDraw], [], []];
                d.players['a'].reserve = [{ cardId: fToTuck, face: 'food' }];
                setActivate(gs, [{ cardId: hornbill, eggs: 0, tucked: [] }]);
                gs.activate('a', { foodDeck: 1, tuckCardId: fToTuck });
                const p = gs.get_player('a')!;
                assert.equal(p.flock[0].tucked.length, 1);
                assert.equal(p.flock[0].tucked[0], fToTuck, 'tucked chosen fruit card');
                assert.equal(p.reserve.length, 1);
                assert.equal(p.reserve[0].cardId, fToDraw, 'drew the chosen fruit card from deck 1 into reserve');
            });

            it('does not draw when requested specific food is not visible on any deck in the supply', () => {
                const gs = fresh();
                const d = gs.get_data();
                const dove = byName('Many-colored Fruit-Dove'); // [draw_fruit]
                const rodentCard = byName('Barn Owl'); // reverse: rodent
                d.foodDecks = [[rodentCard], [], [], []];
                d.players['a'].reserve = [];
                setActivate(gs, [{ cardId: dove, eggs: 0, tucked: [] }]);
                gs.activate('a', {});
                const p = gs.get_player('a')!;
                assert.equal(p.reserve.length, 0, 'did not draw any card since no fruit was in supply');
            });

            it('resolves [draw_fruit] [tuck_fruit] when no fruit in supply but player has fruit in reserve', () => {
                const gs = fresh();
                const d = gs.get_data();
                const hornbill = byName('Great Hornbill'); // [draw_fruit] [tuck_fruit]
                const rodentCard = byName('Barn Owl');
                const fToTuck = byName('Baltimore Oriole'); // fruit card in reserve
                d.foodDecks = [[rodentCard], [], [], []];
                d.players['a'].reserve = [{ cardId: fToTuck, face: 'food' }];
                setActivate(gs, [{ cardId: hornbill, eggs: 0, tucked: [] }]);
                gs.activate('a', { tuckCardId: fToTuck });
                const p = gs.get_player('a')!;
                assert.equal(p.flock[0].tucked.length, 1);
                assert.equal(p.flock[0].tucked[0], fToTuck, 'tucked the fruit from reserve even though supply had no fruit');
                assert.equal(p.reserve.length, 0);
            });

            it('Red-billed Quelea describes power as "Tuck a bird (+1), Tuck a bird (+1)" and tucks selected birds', () => {
                const gs = fresh();
                const d = gs.get_data();
                const quelea = byName('Red-billed Quelea'); // [tuck_bird] [tuck_bird]
                const b1 = byName('American Robin');
                const b2 = byName('Mallard');
                const b3 = byName('Blue Jay');
                d.players['a'].reserve = [
                    { cardId: b1, face: 'bird' },
                    { cardId: b2, face: 'bird' },
                    { cardId: b3, face: 'bird' }
                ];
                setActivate(gs, [{ cardId: quelea, eggs: 0, tucked: [] }]);
                // Tuck only 1 bird and skip second
                gs.activate('a', { tuckCardIds: [b1] });
                const p = gs.get_player('a')!;
                assert.equal(p.flock[0].tucked.length, 1);
                assert.equal(p.flock[0].tucked[0], b1, 'first card is tucked even if second is skipped');
                assert.equal(p.reserve.length, 2);
                assert.ok(p.reserve.some(r => r.cardId === b2));
                assert.ok(p.reserve.some(r => r.cardId === b3));
            });

            it('Red-billed Quelea tucks both chosen birds when both steps are completed', () => {
                const gs = fresh();
                const d = gs.get_data();
                const quelea = byName('Red-billed Quelea');
                const b1 = byName('American Robin');
                const b2 = byName('Mallard');
                d.players['a'].reserve = [
                    { cardId: b1, face: 'bird' },
                    { cardId: b2, face: 'bird' }
                ];
                setActivate(gs, [{ cardId: quelea, eggs: 0, tucked: [] }]);
                gs.activate('a', { tuckCardIds: [b1, b2] });
                const p = gs.get_player('a')!;
                assert.equal(p.flock[0].tucked.length, 2);
                assert.deepEqual(p.flock[0].tucked, [b1, b2]);
                assert.equal(p.reserve.length, 0);
            });

            it('Pileated Woodpecker all_players lay_egg pauses for choices from all players and completes when all commit', () => {
                const gs = fresh();
                const d = gs.get_data();
                const woodpecker = byName('Pileated Woodpecker'); // [lay_egg] and [all_players]: [lay_egg]
                const robin = byName('American Robin');
                d.players['a'].flock = [{ cardId: woodpecker, eggs: 0, tucked: [] }];
                d.players['a'].nestEggs = 0;
                d.players['b'].flock = [{ cardId: robin, eggs: 0, tucked: [] }];
                d.players['b'].nestEggs = 0;
                d.phase = Phase.Activate;
                d.current = 0;
                d.players['a'].tokenIndex = 0;

                // Player A activates Pileated Woodpecker (personal egg target: nest = -1)
                gs.activate('a', { eggTargets: [-1] });

                // Player A received their personal egg immediately
                assert.equal(gs.get_player('a')!.nestEggs, 1);

                // An all_players pending action is created waiting for both 'a' and 'b'
                const pending = gs.get_pending_all_players();
                assert.ok(pending !== null);
                assert.equal(pending!.type, 'lay_egg');
                assert.deepEqual(pending!.pendingPlayers, ['a', 'b']);

                // Token has not advanced yet because choices are pending
                assert.equal(gs.get_player('a')!.tokenIndex, 0);

                // Player A chooses flock bird 0 for the all-players egg
                gs.respond_all_players('a', { eggTarget: 0 });
                assert.equal(gs.get_player('a')!.flock[0].eggs, 1);
                assert.deepEqual(gs.get_pending_all_players()!.pendingPlayers, ['b']);

                // Player B chooses nest (-1) for their all-players egg
                gs.respond_all_players('b', { eggTarget: -1 });
                assert.equal(gs.get_player('b')!.nestEggs, 1);

                // All players have responded: pending is cleared and token has advanced
                assert.strictEqual(gs.get_pending_all_players(), null);
                assert.equal(gs.get_player('a')!.tokenIndex, 1);
            });

            it('all_players lay_egg allows a player with no space to submit null choice', () => {
                const gs = fresh();
                const d = gs.get_data();
                const woodpecker = byName('Pileated Woodpecker');
                d.players['a'].flock = [{ cardId: woodpecker, eggs: 0, tucked: [] }];
                d.players['a'].nestEggs = 0;
                // Player B is completely full (nest = 3, bird at limit 1)
                d.players['b'].flock = [{ cardId: woodpecker, eggs: 1, tucked: [] }];
                d.players['b'].nestEggs = 3;
                d.phase = Phase.Activate;
                d.current = 0;
                d.players['a'].tokenIndex = 0;

                gs.activate('a', { eggTargets: [-1] });
                gs.respond_all_players('a', { eggTarget: -1 });

                // Player B acknowledges space constraint with null target
                gs.respond_all_players('b', { eggTarget: null });

                assert.strictEqual(gs.get_pending_all_players(), null);
                assert.equal(gs.get_player('b')!.nestEggs, 3);
            });

            it('Great Tit allows choosing whether to discard invertebrate or seed, discards the chosen card, and lays the egg', () => {
                const gs = fresh();
                const d = gs.get_data();
                const tit = byName('Great Tit'); // [discard_invertebrate] or [discard_seed] -> [lay_egg]
                const invertCard = foodCardId('invertebrate');
                const seedCard = foodCardId('seed');
                d.players['a'].reserve = [
                    { cardId: invertCard, face: 'food' },
                    { cardId: seedCard, face: 'food' }
                ];
                d.players['a'].nestEggs = 0;
                setActivate(gs, [{ cardId: tit, eggs: 0, tucked: [] }]);

                // Branch 0: discard invertebrate (specifically invertCard) -> lay egg on nest (-1)
                gs.activate('a', { branch: 0, payFoodCardId: invertCard, eggTargets: [-1] });
                const p = gs.get_player('a')!;
                assert.equal(p.nestEggs, 1, 'laid egg on nest');
                assert.equal(p.reserve.length, 1);
                assert.equal(p.reserve[0].cardId, seedCard, 'invertebrate was discarded, seed remains');
            });

            it('Great Tit does not lay an egg if the player cannot pay the discard cost', () => {
                const gs = fresh();
                const d = gs.get_data();
                const tit = byName('Great Tit');
                const fruitCard = foodCardId('fruit');
                d.players['a'].reserve = [{ cardId: fruitCard, face: 'food' }]; // only fruit, no invert or seed
                d.players['a'].nestEggs = 0;
                setActivate(gs, [{ cardId: tit, eggs: 0, tucked: [] }]);

                // Try branch 0 with missing food
                gs.activate('a', { branch: 0, payFoodCardId: fruitCard });
                const p = gs.get_player('a')!;
                assert.equal(p.nestEggs, 0, 'no egg laid');
                assert.equal(p.reserve.length, 1, 'reserve unaffected');
            });

            it('records moves in player turnLog and preserves them until that player\'s next turn', () => {
                const gs = fresh();
                const d = gs.get_data();
                const robin = byName('American Robin');
                d.supplyBirds = [robin, null, null, null];
                d.foodDecks = [[foodCardId('seed')], [], [], []];
                d.current = 0; // player 'a'
                d.phase = Phase.Nest;

                // Player A draws a bird + a food
                gs.draw_2('a', [{ kind: 'bird', index: 0 }, { kind: 'food', index: 0 }]);
                const logA = gs.get_turn_log('a');
                assert.equal(logA.length, 1);
                assert.equal(logA[0].type, 'draw');
                assert.ok(logA[0].items.some(it => it.kind === 'bird' && it.cardId === robin));
                assert.ok(logA[0].items.some(it => it.kind === 'food' && (it.food === 'seed' || (it.foods && it.foods.includes('seed')))));

                // Log remains on Player A after activation ends / turns pass
                assert.equal(gs.get_turn_log('a').length, 1);
            });

            it('records exact drawn food in turnLog for choose_one draw powers like American Redstart', () => {
                const gs = fresh();
                const d = gs.get_data();
                const redstart = byName('American Redstart'); // [draw_invertebrate] or [draw_fruit]
                const fruitCard = foodCardId('fruit');
                d.foodDecks = [[fruitCard], [], [], []];
                d.players['a'].reserve = [];
                setActivate(gs, [{ cardId: redstart, eggs: 0, tucked: [] }]);

                gs.activate('a', { branch: 1, foodDeck: 0 });
                const logA = gs.get_turn_log('a');
                assert.equal(logA.length, 1);
                assert.equal(logA[0].type, 'power');
                // Should show Redstart : Drew [food]
                assert.ok(logA[0].items.some(it => it.kind === 'bird' && it.cardId === redstart));
                assert.ok(logA[0].items.some(it => it.kind === 'food'));
            });

            it('records exact discard and egg lay in turnLog for gated powers like Great Tit', () => {
                const gs = fresh();
                const d = gs.get_data();
                const tit = byName('Great Tit');
                const seedCard = foodCardId('seed');
                d.players['a'].reserve = [{ cardId: seedCard, face: 'food' }];
                d.players['a'].nestEggs = 0;
                setActivate(gs, [{ cardId: tit, eggs: 0, tucked: [] }]);

                gs.activate('a', { branch: 1, payFoodCardId: seedCard });
                const logA = gs.get_turn_log('a');
                assert.equal(logA.length, 1);
                assert.equal(logA[0].type, 'power');
                assert.ok(logA[0].items.some(it => it.kind === 'food'));
                assert.ok(logA[0].items.some(it => it.kind === 'egg'));
            });

            it('records each player and their drawn food in turnLog for all_players draw food from 1 deck', () => {
                const gs = fresh();
                const d = gs.get_data();
                const hummer = byName('Ruby-throated Hummingbird'); // [all_players]: [draw_any_food] from 1 deck
                const fruitCard = foodCardId('fruit');
                const seedCard = foodCardId('seed');
                d.foodDecks = [[fruitCard, seedCard], [], [], []]; // top is seed, second is fruit
                d.players['a'].reserve = [];
                d.players['b'].reserve = [];
                setActivate(gs, [{ cardId: hummer, eggs: 0, tucked: [] }]);

                gs.activate('a', { foodDeck: 0 });
                const logA = gs.get_turn_log('a');
                assert.equal(logA.length, 1);
                assert.equal(logA[0].type, 'power');
                // Should show Ruby-throated Hummingbird : a: [seed], b: [fruit]
                assert.ok(logA[0].items.some(it => it.kind === 'bird' && it.cardId === hummer));
                assert.ok(logA[0].items.some(it => it.kind === 'player' && it.playerId === 'a'));
                assert.ok(logA[0].items.some(it => it.kind === 'player' && it.playerId === 'b'));
                assert.ok(logA[0].items.some(it => it.kind === 'food'));
            });

            it('resolves multi-step [draw_any_card] [draw_any_card] with sequential drawPicks', () => {
                const gs = fresh();
                const d = gs.get_data();
                const starling = byName('Common Starling'); // [discard_egg] -> [draw_any_card] [draw_any_card]
                const b0 = BIRD_CARDS[0].id;
                const b1 = BIRD_CARDS[1].id;
                d.supplyBirds = [b0, b1, null, null];
                d.foodDecks = [[foodCardId('fruit')], [], [], []];
                d.players['a'].nestEggs = 1;
                d.players['a'].reserve = [];
                setActivate(gs, [{ cardId: starling, eggs: 0, tucked: [] }]);

                // Pick 1: bird from slot 0. Pick 2: food from deck 0.
                gs.activate('a', {
                    discardEggFrom: -1,
                    drawPicks: [{ kind: 'bird', index: 0 }, { kind: 'food', index: 0 }]
                });
                const p = gs.get_player('a')!;
                assert.equal(p.nestEggs, 0, 'spent 1 egg');
                assert.ok(p.reserve.some(r => r.cardId === b0 && r.face === 'bird'), 'drew supply bird 0');
                assert.ok(p.reserve.some(r => r.face === 'food'), 'drew food from deck 0');
                assert.equal(gs.get_supply_birds()[0], null, 'slot 0 emptied');
                assert.equal(gs.get_supply_birds()[1], b1, 'slot 1 untouched');
            });

            it('honors the player-chosen supply bird for "draw a bird"', () => {
                const gs = fresh();
                const d = gs.get_data();
                const mallard = byName('Mallard'); // draw_bird with egg limit 2+
                const b1 = BIRD_CARDS.find(c => c.egg_limit >= 2)!.id;
                const b2 = BIRD_CARDS.find(c => c.egg_limit >= 2 && c.id !== b1)!.id;
                d.supplyBirds = [null, b1, b2, null];
                d.players['a'].reserve = [];
                setActivate(gs, [{ cardId: mallard, eggs: 0, tucked: [] }]);
                gs.activate('a', { supplyBird: 2 });
                assert.ok(gs.get_player('a')!.reserve.some(r => r.cardId === b2 && r.face === 'bird'), 'drew the chosen bird');
                assert.equal(gs.get_supply_birds().indexOf(b2), -1, 'chosen bird left the supply');
            });

            it('[draw_seed] gains a food card into reserve', () => {
                const gs = fresh();
                const d = gs.get_data();
                const goose = byName('Egyptian Goose');
                d.players['a'].reserve = [];
                d.foodDecks = [[foodCardId('seed')], [], [], []];
                setActivate(gs, [{ cardId: goose, eggs: 0, tucked: [] }]);
                gs.activate('a', {});
                assert.equal(gs.get_player('a')!.reserve.filter(r => r.face === 'food').length, 1);
            });

            it('lay_egg on this bird adds an egg', () => {
                const gs = fresh();
                const rhea = byName('Greater Rhea'); // lay_egg on this
                setActivate(gs, [{ cardId: rhea, eggs: 0, tucked: [] }]);
                gs.activate('a', {});
                assert.equal(gs.get_player('a')!.flock[0].eggs, 1);
            });

            it('gated tuck → draw: tucks a reserve card (1 pt) and draws a bird', () => {
                const gs = fresh();
                const d = gs.get_data();
                const robin = byName('American Robin'); // [tuck_bird] -> [draw_bird]
                const tuckable = foodCardId('seed'); // reserve bird to tuck
                d.players['a'].reserve = [{ cardId: tuckable, face: 'bird' }];
                d.supplyBirds = [byName('Blue Jay'), null, null, null];
                setActivate(gs, [{ cardId: robin, eggs: 0, tucked: [] }]);
                gs.activate('a', {});
                const p = gs.get_player('a')!;
                assert.equal(p.flock[0].tucked.length, 1, 'tucked one card');
                assert.equal(p.reserve.some(r => r.face === 'bird' && r.cardId === byName('Blue Jay')), true, 'drew the supply bird');
            });

            it('hunt tucks a small-wingspan card and discards a large one', () => {
                const small = BIRD_CARDS.find(c => c.wingspan_cm < 100)!.id;
                const large = BIRD_CARDS.find(c => c.wingspan_cm >= 100)!.id;
                // small → caught (tucked)
                let gs = fresh();
                let d = gs.get_data();
                d.foodDecks = [[small], [], [], []];
                d.players['a'].flock = [{ cardId: byName('Common Buzzard'), eggs: 0, tucked: [] }];
                d.phase = Phase.Activate; d.current = 0; d.players['a'].tokenIndex = 0;
                gs.activate('a', { foodDeck: 0 });
                assert.equal(gs.get_player('a')!.flock[0].tucked.length, 1, 'small bird caught');

                // large → escapes (discarded)
                gs = fresh();
                d = gs.get_data();
                d.foodDecks = [[large], [], [], []];
                d.players['a'].flock = [{ cardId: byName('Common Buzzard'), eggs: 0, tucked: [] }];
                d.phase = Phase.Activate; d.current = 0; d.players['a'].tokenIndex = 0;
                const discBefore = gs.get_discard_count();
                gs.activate('a', { foodDeck: 0 });
                assert.equal(gs.get_player('a')!.flock[0].tucked.length, 0, 'large bird escaped');
                assert.equal(gs.get_discard_count(), discBefore + 1);
            });

            it('choose_one resolves the selected branch', () => {
                const gs = fresh();
                const d = gs.get_data();
                const redstart = byName('American Redstart'); // draw_invertebrate OR draw_fruit
                d.players['a'].reserve = [];
                d.foodDecks = [[foodCardId('invertebrate')], [], [], []];
                d.phase = Phase.Activate; d.current = 0;
                d.players['a'].flock = [{ cardId: redstart, eggs: 0, tucked: [] }];
                d.players['a'].tokenIndex = 0;
                gs.activate('a', { branch: 0 }); // draw invertebrate
                assert.equal(gs.get_player('a')!.reserve.filter(r => r.face === 'food').length, 1);
            });

            it('green birds are skipped in the activation walk', () => {
                const gs = fresh();
                const d = gs.get_data();
                const green = byName('American White Pelican');
                d.players['a'].flock = [{ cardId: green, eggs: 0, tucked: [] }];
                d.phase = Phase.Nest; d.current = 0; d.nestActionTaken = false;
                // a nest action begins activation; an all-green flock has no brown
                // bird to activate, so the turn auto-finishes and passes to b.
                gs.lay_eggs('a', [-1]);
                assert.equal(gs.get_active_bird_index(), -1);
                assert.equal(gs.currentPlayerId(), 'b');
            });
        });

        describe('Green cost modifiers', () => {
            it('ignore_1_in_cost reduces a seed cost so the bird plays for free', () => {
                const gs = fresh();
                const d = gs.get_data();
                const avadavat = byName('Red Avadavat'); // ignore 1 seed
                const lark = byName('Crested Lark');    // cost seed:1, egg:0
                d.players['a'].flock = [{ cardId: avadavat, eggs: 0, tucked: [] }];
                d.players['a'].reserve = [{ cardId: lark, face: 'bird' }];
                const pay = gs.computeAutoPayment('a', lark)!;
                assert.equal(pay.foods.length, 0, 'seed pip ignored');
                gs.play_bird('a', lark, pay);
                assert.equal(gs.get_player('a')!.flock.length, 2);
            });

            it('use_as_any lets a different food pay a specific pip', () => {
                const gs = fresh();
                const d = gs.get_data();
                const pelican = byName('American White Pelican'); // use fish as any
                const swift = byName('Common Swift');             // cost invertebrate:1, egg:0
                const fishCard = foodCardId('fish', [swift]);
                d.players['a'].flock = [{ cardId: pelican, eggs: 0, tucked: [] }];
                d.players['a'].reserve = [
                    { cardId: swift, face: 'bird' },
                    { cardId: fishCard, face: 'food' }
                ];
                const pay = gs.computeAutoPayment('a', swift);
                assert.ok(pay && pay.foods.length === 1, 'fish can cover the invertebrate pip');
            });
        });

        describe('Goals & scoring', () => {
            it('scores vp + eggs + tucked, and 1 pt per egg on a goal-matching bird', () => {
                const gs = new WingspanGameState(['a', 'b']);
                gs.start_game({ seed: 3, advanced: true, goals: ['cost_seed', 'beak_right'] });
                const d = gs.get_data();
                const robin = CARD_BY_ID[byName('American Robin')]; // vp2, cost invert+fruit, beak R
                const jay = CARD_BY_ID[byName('Blue Jay')];         // vp4, cost seed+any, beak R
                d.players['a'].flock = [
                    { cardId: robin.id, eggs: 1, tucked: [999] }, // 1 egg, 1 tuck
                    { cardId: jay.id, eggs: 2, tucked: [] }        // 2 eggs
                ];
                d.players['a'].nestEggs = 0;
                const sc = gs.computeScore('a');
                // vp = 2+4 = 6; eggs = 3; tucked = 1
                assert.equal(sc.vp, 6);
                assert.equal(sc.eggs, 3);
                assert.equal(sc.tucked, 1);
                // goals: cost_seed → jay qualifies (2 eggs) ; beak_right → robin(1)+jay(2)=3 eggs
                assert.equal(sc.goals, 2 + 3);
                assert.equal(sc.total, 6 + 3 + 1 + 5);
            });

            it('positional goal: a bird only qualifies with more points than all to its left', () => {
                const gs = new WingspanGameState(['a', 'b']);
                gs.start_game({ seed: 4, advanced: true, goals: ['pos_more_points_than_left', 'beak_left'] });
                const d = gs.get_data();
                const low = CARD_BY_ID[byName('Barn Swallow')]; // vp1
                const high = CARD_BY_ID[byName('Bald Eagle')];   // vp6
                d.players['a'].flock = [
                    { cardId: low.id, eggs: 1, tucked: [] },  // leftmost auto-qualifies
                    { cardId: high.id, eggs: 1, tucked: [] }  // higher than left → qualifies
                ];
                d.players['a'].nestEggs = 0;
                // both qualify for pos_more_points_than_left → 1 + 1 = 2 goal eggs
                const sc = gs.computeScore('a');
                assert.ok(sc.goals >= 2, 'both birds qualify positionally');
            });

            it('static goal predicate matches the spec (wingspan / beak / cost)', () => {
                const kiwiLike = BIRD_CARDS.find(c => c.wingspan_cm <= 50)!;
                assert.equal(cardMatchesStaticGoal(kiwiLike, 'wingspan_le_50', { eggs: 0, tucked: 0 }), true);
                const big = BIRD_CARDS.find(c => c.wingspan_cm >= 66)!;
                assert.equal(cardMatchesStaticGoal(big, 'wingspan_ge_66', { eggs: 0, tucked: 0 }), true);
            });
        });

        describe('End game', () => {
            it('triggers when a flock reaches 6 birds and ends after the round', () => {
                const gs = new WingspanGameState(['a', 'b']);
                gs.start_game({ seed: 9 });
                const d = gs.get_data();
                // give a a 5-bird flock and a playable 6th
                const cheap = byName('Common Swift');
                const invert = foodCardId('invertebrate', [cheap]);
                d.players['a'].flock = [0, 1, 2, 3, 4].map(i => ({ cardId: BIRD_CARDS[i].id, eggs: 0, tucked: [] }));
                d.players['a'].reserve = [{ cardId: cheap, face: 'bird' }, { cardId: invert, face: 'food' }];
                d.phase = Phase.Nest; d.current = 0; d.nestActionTaken = false;
                const pay = gs.computeAutoPayment('a', cheap)!;
                gs.play_bird('a', cheap, pay);
                // walk a's activation to completion
                let guard = 0;
                while (gs.get_phase() === Phase.Activate && gs.currentPlayerId() === 'a' && guard++ < 10) gs.skip_activation('a');
                assert.equal(gs.get_end_triggered(), true, 'reaching 6 birds triggers the end');
                // b takes its final turn → round completes → scoring
                d.nestActionTaken = false;
                gs.lay_eggs('b', [-1]);
                assert.equal(gs.get_phase(), Phase.Scoring, 'game scores after equal turns');
                assert.ok(gs.get_winners() && gs.get_winners()!.length >= 1);
            });
        });
    });

    // ======================================================================
    describe('Type B: integration (GameRuleTest)', () => {
        const readState = (raw: any) => (typeof raw.get_data === 'function' ? raw.get_data() : raw.data);

        it('starts a 2-player game through the remote start method', () => {
            const test = new GameRuleTest('wingspanpocket', 1); // host + 1 client
            test.invokeHostMethod('startGame');
            assert.equal(test.getHostData('lobby_started'), true);
            const d = readState(test.getHostData('gameState'));
            assert.equal(d.phase, Phase.Nest);
            assert.equal(d.playerOrder.length, 2);
            assert.equal(d.players[d.playerOrder[0]].reserve.length, 6);
        });

        it('lets the current player draw 2 cards via the remote method', () => {
            const test = new GameRuleTest('wingspanpocket', 1);
            test.invokeHostMethod('startGame');
            let d = readState(test.getHostData('gameState'));
            const host = d.playerOrder[0];
            const before = d.players[host].reserve.length;
            test.invokeHostMethod('draw2', [{ kind: 'food', index: 0 }, { kind: 'food', index: 1 }]);
            d = readState(test.getHostData('gameState'));
            assert.equal(d.players[host].reserve.length, before + 2);
            // turn passed to the next player (no birds to activate)
            assert.equal(d.current, 1);
        });

        it('lets a player lay eggs on the nest via the remote method', () => {
            const test = new GameRuleTest('wingspanpocket', 1);
            test.invokeHostMethod('startGame');
            let d = readState(test.getHostData('gameState'));
            const host = d.playerOrder[0];
            test.invokeHostMethod('layEggs', [-1]);
            d = readState(test.getHostData('gameState'));
            assert.equal(d.players[host].nestEggs, 2);
        });
    });
});
