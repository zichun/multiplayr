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
                const bird = byName('House Sparrow'); // cost seed:1
                const seedFood = foodCardId('seed', [bird]);
                d.players['a'].reserve = [
                    { cardId: bird, face: 'bird' },
                    { cardId: seedFood, face: 'food' }
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
                const falcon = byName('Peregrine Falcon'); // cost invertebrate + rodent
                const invertOnly = foodCardId('invertebrate', [falcon]);
                // reserve has an invertebrate food + two non-rodent foods, but NO rodent
                d.players['a'].reserve = [
                    { cardId: falcon, face: 'bird' },
                    { cardId: invertOnly, face: 'food' },
                    { cardId: foodCardId('seed', [falcon, invertOnly]), face: 'food' },
                    { cardId: foodCardId('fruit', [falcon, invertOnly]), face: 'food' }
                ];
                d.players['a'].flock = [];
                const pay = gs.computeAutoPayment('a', falcon)!;
                // invertebrate paid directly (1 card) + rodent via 2-for-1 (2 cards) = 3 cards for a 2-pip cost
                assert.equal(pay.foods.length, 3, 'invertebrate + a 2-for-1 for the missing rodent');
                gs.play_bird('a', falcon, pay); // still a legal payment
                assert.equal(gs.get_player('a')!.flock.length, 1);
            });

            it('rejects an underpayment', () => {
                const gs = fresh();
                const d = gs.get_data();
                const bird = byName('House Sparrow');
                d.players['a'].reserve = [{ cardId: bird, face: 'bird' }];
                d.players['a'].flock = [];
                const bad: PlayPayment = { foods: [], eggSources: [] };
                assert.throws(() => gs.play_bird('a', bird, bad), /cover the cost/);
            });

            it('covers a cost with two 2-food cards via proper matching (not greedy)', () => {
                // Bird cost: invertebrate + seed. Cards: [invert/seed] and [invert/fruit].
                // The only valid assignment is card1→seed, card2→invertebrate — a greedy
                // matcher grabs card1 for invertebrate first and wrongly reports "not enough".
                const gs = fresh();
                const d = gs.get_data();
                const bird = byName('Spotted Towhee');       // cost invertebrate + seed
                const c1 = byName('House Sparrow');           // food: seed / invertebrate
                const c2 = byName('Northern Mockingbird');    // food: invertebrate / fruit
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
                const bird = byName('House Sparrow'); // cost seed:1
                const seedFood = foodCardId('seed', [bird]);
                const otherFood = foodCardId('fruit', [bird, seedFood]);
                d.players['a'].reserve = [
                    { cardId: bird, face: 'bird' },
                    { cardId: seedFood, face: 'food' },
                    { cardId: otherFood, face: 'food' }
                ];
                d.players['a'].flock = [];
                // paying with the seed card covers it
                assert.equal(gs.can_pay('a', bird, { foods: [{ cardId: seedFood, as: 'seed' }], eggSources: [] }), true);
                // paying with nothing does not
                assert.equal(gs.can_pay('a', bird, { foods: [], eggSources: [] }), false);
                // a single non-seed card does not (no 2-for-1 possible with 1 card)
                assert.equal(gs.can_pay('a', bird, { foods: [{ cardId: otherFood, as: 'fruit' }], eggSources: [] }), false);
                // …but any two food cards do (2-for-1)
                assert.equal(gs.can_pay('a', bird, { foods: [{ cardId: seedFood, as: 'seed' }, { cardId: otherFood, as: 'fruit' }], eggSources: [] }), true);
                // can_pay did not mutate state
                assert.equal(gs.get_player('a')!.reserve.length, 3);
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
                const flamingo = byName('Greater Flamingo'); // [draw_any_food]
                const fishCard = foodCardId('fish');
                const seedCard = foodCardId('seed', [fishCard]);
                d.players['a'].reserve = [];
                d.foodDecks = [[fishCard], [], [seedCard], []];
                setActivate(gs, [{ cardId: flamingo, eggs: 0, tucked: [] }]);
                gs.activate('a', { foodDeck: 2 }); // choose deck 2 (seed)
                const drawn = gs.get_player('a')!.reserve.map(r => r.cardId);
                assert.ok(drawn.indexOf(seedCard) !== -1, 'drew from the chosen deck');
                assert.ok(drawn.indexOf(fishCard) === -1, 'did not draw the other deck');
            });

            it('honors the chosen deck for a specific food when multiple decks show it', () => {
                const gs = fresh();
                const d = gs.get_data();
                const sparrow = byName('House Sparrow');            // [draw_seed]
                const seedInvert = byName('Spotted Towhee');        // reverse: seed / invertebrate
                const seedFruit = byName('Rose-breasted Grosbeak'); // reverse: seed / fruit
                d.players['a'].reserve = [];
                d.foodDecks = [[seedInvert], [], [seedFruit], []];
                setActivate(gs, [{ cardId: sparrow, eggs: 0, tucked: [] }]);
                gs.activate('a', { foodDeck: 2 }); // choose the seed/fruit deck
                const drawn = gs.get_player('a')!.reserve.map(r => r.cardId);
                assert.ok(drawn.indexOf(seedFruit) !== -1, 'drew the seed card from the chosen deck');
                assert.ok(drawn.indexOf(seedInvert) === -1, 'did not draw the other seed card');
            });

            it('honors the player-chosen supply bird for "draw a bird"', () => {
                const gs = fresh();
                const d = gs.get_data();
                const martin = byName('Purple Martin'); // draw_bird with egg limit 2+
                const b1 = BIRD_CARDS.find(c => c.egg_limit >= 2)!.id;
                const b2 = BIRD_CARDS.find(c => c.egg_limit >= 2 && c.id !== b1)!.id;
                d.supplyBirds = [null, b1, b2, null];
                d.players['a'].reserve = [];
                setActivate(gs, [{ cardId: martin, eggs: 0, tucked: [] }]);
                gs.activate('a', { supplyBird: 2 });
                assert.ok(gs.get_player('a')!.reserve.some(r => r.cardId === b2 && r.face === 'bird'), 'drew the chosen bird');
                assert.equal(gs.get_supply_birds().indexOf(b2), -1, 'chosen bird left the supply');
            });

            it('[draw_seed] gains a food card into reserve', () => {
                const gs = fresh();
                const d = gs.get_data();
                const sparrow = byName('House Sparrow');
                d.players['a'].reserve = [];
                d.foodDecks = [[foodCardId('seed')], [], [], []];
                setActivate(gs, [{ cardId: sparrow, eggs: 0, tucked: [] }]);
                gs.activate('a', {});
                assert.equal(gs.get_player('a')!.reserve.filter(r => r.face === 'food').length, 1);
            });

            it('lay_egg on this bird adds an egg', () => {
                const gs = fresh();
                const mallard = byName('Mallard'); // lay_egg on this
                setActivate(gs, [{ cardId: mallard, eggs: 0, tucked: [] }]);
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
                d.players['a'].flock = [{ cardId: byName('Red-tailed Hawk'), eggs: 0, tucked: [] }];
                d.phase = Phase.Activate; d.current = 0; d.players['a'].tokenIndex = 0;
                gs.activate('a', { foodDeck: 0 });
                assert.equal(gs.get_player('a')!.flock[0].tucked.length, 1, 'small bird caught');

                // large → escapes (discarded)
                gs = fresh();
                d = gs.get_data();
                d.foodDecks = [[large], [], [], []];
                d.players['a'].flock = [{ cardId: byName('Red-tailed Hawk'), eggs: 0, tucked: [] }];
                d.phase = Phase.Activate; d.current = 0; d.players['a'].tokenIndex = 0;
                const discBefore = gs.get_discard_count();
                gs.activate('a', { foodDeck: 0 });
                assert.equal(gs.get_player('a')!.flock[0].tucked.length, 0, 'large bird escaped');
                assert.equal(gs.get_discard_count(), discBefore + 1);
            });

            it('choose_one resolves the selected branch', () => {
                const gs = fresh();
                const d = gs.get_data();
                const chickadee = byName('Black-capped Chickadee'); // draw_seed OR tuck
                d.players['a'].reserve = [];
                d.foodDecks = [[foodCardId('seed')], [], [], []];
                d.phase = Phase.Activate; d.current = 0;
                d.players['a'].flock = [{ cardId: chickadee, eggs: 0, tucked: [] }];
                d.players['a'].tokenIndex = 0;
                gs.activate('a', { branch: 0 }); // draw seed
                assert.equal(gs.get_player('a')!.reserve.filter(r => r.face === 'food').length, 1);
            });

            it('green birds are skipped in the activation walk', () => {
                const gs = fresh();
                const d = gs.get_data();
                const green = byName('American Goldfinch');
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
                const goldfinch = byName('American Goldfinch'); // ignore 1 seed
                const sparrow = byName('House Sparrow');        // cost seed:1
                d.players['a'].flock = [{ cardId: goldfinch, eggs: 0, tucked: [] }];
                d.players['a'].reserve = [{ cardId: sparrow, face: 'bird' }];
                const pay = gs.computeAutoPayment('a', sparrow)!;
                assert.equal(pay.foods.length, 0, 'seed pip ignored');
                gs.play_bird('a', sparrow, pay);
                assert.equal(gs.get_player('a')!.flock.length, 2);
            });

            it('use_as_any lets a different food pay a specific pip', () => {
                const gs = fresh();
                const d = gs.get_data();
                const anna = byName("Anna's Hummingbird"); // use fruit as any
                const sparrow = byName('House Sparrow');    // cost seed:1
                const fruitCard = foodCardId('fruit', [sparrow]);
                d.players['a'].flock = [{ cardId: anna, eggs: 0, tucked: [] }];
                d.players['a'].reserve = [
                    { cardId: sparrow, face: 'bird' },
                    { cardId: fruitCard, face: 'food' }
                ];
                const pay = gs.computeAutoPayment('a', sparrow);
                assert.ok(pay && pay.foods.length === 1, 'fruit can cover the seed pip');
            });
        });

        describe('Goals & scoring', () => {
            it('scores vp + eggs + tucked, and 1 pt per egg on a goal-matching bird', () => {
                const gs = new WingspanGameState(['a', 'b']);
                gs.start_game({ seed: 3, advanced: true, goals: ['cost_seed', 'beak_right'] });
                const d = gs.get_data();
                const robin = CARD_BY_ID[byName('American Robin')]; // vp2, beak R
                const jay = CARD_BY_ID[byName('Blue Jay')];         // vp3, cost seed, beak R
                d.players['a'].flock = [
                    { cardId: robin.id, eggs: 1, tucked: [999] }, // 1 egg, 1 tuck
                    { cardId: jay.id, eggs: 2, tucked: [] }        // 2 eggs
                ];
                d.players['a'].nestEggs = 0;
                const sc = gs.computeScore('a');
                // vp = 2+3 = 5; eggs = 3; tucked = 1
                assert.equal(sc.vp, 5);
                assert.equal(sc.eggs, 3);
                assert.equal(sc.tucked, 1);
                // goals: cost_seed → jay qualifies (2 eggs) ; beak_right → robin(1)+jay(2)=3 eggs
                assert.equal(sc.goals, 2 + 3);
                assert.equal(sc.total, 5 + 3 + 1 + 5);
            });

            it('positional goal: a bird only qualifies with more points than all to its left', () => {
                const gs = new WingspanGameState(['a', 'b']);
                gs.start_game({ seed: 4, advanced: true, goals: ['pos_more_points_than_left', 'beak_left'] });
                const d = gs.get_data();
                const low = CARD_BY_ID[byName('House Sparrow')]; // vp1
                const high = CARD_BY_ID[byName('Bald Eagle')];   // vp7
                d.players['a'].flock = [
                    { cardId: low.id, eggs: 1, tucked: [] },  // leftmost auto-qualifies
                    { cardId: high.id, eggs: 1, tucked: [] }  // higher than left → qualifies
                ];
                d.players['a'].nestEggs = 0;
                // both qualify for pos_more_points_than_left → 1 + 1 = 2 goal eggs (beak_left adds sparrow's 0? sparrow beak L)
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
                const cheap = byName('House Sparrow');
                const seed = foodCardId('seed', [cheap]);
                d.players['a'].flock = [0, 1, 2, 3, 4].map(i => ({ cardId: BIRD_CARDS[i].id, eggs: 0, tucked: [] }));
                d.players['a'].reserve = [{ cardId: cheap, face: 'bird' }, { cardId: seed, face: 'food' }];
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
