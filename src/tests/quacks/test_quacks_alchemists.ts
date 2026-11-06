/**
 * test_quacks_alchemists.ts — The Alchemists expansion for Quacks.
 *   Type A: setup, the essence phase, every patient, the locoweed books, the new fortune cards.
 *   Type B: switching the expansion on through the lobby methods.
 */

import { describe, it } from 'mocha';
import { strict as assert } from 'assert';

import { QuacksGameState, Phase, PlayerState } from '../../rules/quacks/QuacksGameState';
import {
    Chip, CHIP_COLORS, CHIP_SUPPLY, EXPANSION_SUPPLY, ALCHEMIST_SUPPLY, ROUNDS, fieldAt,
    PATIENTS, PATIENT_BY_ID, FORTUNE_CARDS, fortuneDeckFor, bookChoices, uniformBookSets, BookSets, ESSENCE_MAX
} from '../../rules/quacks/QuacksData';
import { GameRuleTest } from '../GameRuleTest';

const IDS = ['a', 'b', 'c', 'd', 'e'];

/**
 * An Alchemists game parked at the top of a quiet brewing phase, patients already
 * chosen, RNG always taking the first chip in the bag.
 */
function agame(opts: { players?: number; herb?: number; set?: number; round?: number; hw?: boolean;
    patients?: string[] } = {}): QuacksGameState {
    const gs = new QuacksGameState(IDS.slice(0, opts.players || 2));
    const books = { ...uniformBookSets(opts.set || 1, !!opts.hw, true), herb: opts.herb || 7 } as BookSets;
    gs.start_game({ seed: 5, alchemists: true, herbWitches: !!opts.hw, bookSets: books });
    const d = gs.get_data();
    d.fortune = null;
    d.fortuneNotes = [];
    d.round = opts.round || 3;
    d.startIndex = 0;
    d.phase = Phase.Brew;
    d.playerOrder.forEach((id, i) => {
        Object.assign(d.players[id], {
            prompts: [], vp: 0, rubies: 0, droplet: 0, origin: 0, ratTails: 0, flaskFull: true, rolled: [], notes: [],
            patient: (opts.patients || [])[i] || 'chicken', essence: 0
        });
    });
    gs.set_rng(() => 0);
    return gs;
}

const P = (gs: QuacksGameState, id: string): PlayerState => gs.get_player(id)!;
const bag = (gs: QuacksGameState, id: string, chips: Chip[]) => { P(gs, id).bag = [...chips]; };
const drawAll = (gs: QuacksGameState, id: string, n: number) => { for (let i = 0; i < n; i++) gs.draw(id); };
const positions = (gs: QuacksGameState, id: string) => P(gs, id).pot.map(c => c.pos);
const stopAll = (gs: QuacksGameState) => gs.get_player_order().forEach((id) => { if (!P(gs, id).stopped) gs.stop(id); });

function decline(gs: QuacksGameState): void {
    for (let guard = 0; guard < 200; guard++) {
        const id = gs.get_player_order().filter(x => P(gs, x).prompts.length)[0];
        if (!id) return;
        const opts = P(gs, id).prompts[0].options;
        gs.resolve_prompt(id, opts[opts.length - 1].id);
    }
}

function finishEval(gs: QuacksGameState): void {
    let guard = 0;
    while (gs.get_phase() === Phase.Eval && guard++ < 80) {
        decline(gs);
        for (const id of gs.get_player_order()) {
            if (gs.get_phase() !== Phase.Eval) break;
            const p = P(gs, id);
            if (p.prompts.length) continue;
            if (p.stage === 'shop') gs.buy(id, []);
            else if (p.stage === 'rubies') gs.ready(id);
        }
    }
}

describe('Quacks: The Alchemists', () => {

    // ======================================================================
    describe('Type A: setup', () => {
        it('deals three patients, asks everyone to choose one, and gives the patient’s starting chips', () => {
            const gs = new QuacksGameState(['a', 'b']);
            gs.start_game({ seed: 2, alchemists: true });
            assert.equal(gs.patients().length, 3);
            assert.equal(new Set(gs.patients().map(x => x.id)).size, 3);
            assert.equal(gs.get_phase(), Phase.Fortune, 'waits for the patient choice');
            const pr = P(gs, 'a').prompts[0];
            assert.equal(pr.kind, 'patient');
            assert.equal(pr.options.length, 3);

            const d = gs.get_data();
            d.patients = ['turnip', 'forgetful', 'chicken'];
            P(gs, 'a').prompts[0].options = [{ id: 'pat:turnip', label: 'x' }];
            P(gs, 'b').prompts[0].options = [{ id: 'pat:forgetful', label: 'x' }];
            const a0 = P(gs, 'a').bag.length;
            const b0 = P(gs, 'b').bag.length;
            gs.resolve_prompt('a', 'pat:turnip');
            gs.resolve_prompt('b', 'pat:forgetful');
            assert.equal(P(gs, 'a').patient, 'turnip');
            assert.equal(P(gs, 'a').bag.length, a0 + 1, 'Turnip Nose starts with an extra pumpkin');
            assert.equal(P(gs, 'b').bag.length, b0 + 2, 'Forgetfulness starts with a hawkmoth and a crow skull');
        });

        it('makes a locoweed book compulsory and adds 30 locoweed chips', () => {
            assert.deepEqual(bookChoices('herb', false, true), [7, 8, 9, 10]);
            assert.deepEqual(bookChoices('herb', true, true), [5, 6, 7, 8, 9, 10]);
            const gs = new QuacksGameState(['a', 'b']);
            gs.start_game({ seed: 2, alchemists: true });
            assert.equal(gs.book('herb')!.set, 7);
            assert.equal(gs.get_supply()['herb1'], 30);
        });

        it('shuffles the Alchemists’ fortune cards in, minus the Herb Witches ones unless both are on', () => {
            const base = fortuneDeckFor(false, false).map(c => c.id);
            const alch = fortuneDeckFor(false, true).map(c => c.id);
            const both = fortuneDeckFor(true, true).map(c => c.id);
            assert.equal(base.length, 24);
            assert.equal(alch.length, 24 + 17);
            assert.equal(both.length, 44);
            assert.ok(alch.indexOf('witch_visit') === -1 && both.indexOf('witch_visit') !== -1);
            assert.ok(alch.indexOf('all_good') !== -1 && base.indexOf('all_good') === -1);
        });
    });

    // ======================================================================
    describe('Type A: the essence phase', () => {
        it('counts colours, exactly 7 white, and exploded neighbours', () => {
            const gs = agame({ players: 3 });
            P(gs, 'a').pot = ['red1', 'red2', 'orange1', 'blue1', 'white3', 'white2', 'white2'].map((chip, i) => ({ chip, pos: i + 1 }));
            assert.equal(gs.white_sum('a'), 7);
            assert.equal(gs.essence_reach('a'), 3 + 1, '3 colours + exactly 7');
            P(gs, 'b').exploded = true;
            assert.equal(gs.essence_reach('a'), 3 + 1 + 1, 'plus one exploded neighbour');
            P(gs, 'c').exploded = true;
            assert.equal(gs.essence_reach('a'), 3 + 1 + 2, 'plus two');
        });

        it('runs between brewing and scoring, and lets bonus patients settle for a lower glass', () => {
            const gs = agame({ patients: ['chicken', 'chicken'] });
            bag(gs, 'a', ['orange1', 'red1', 'green1', 'white1']);
            drawAll(gs, 'a', 3);
            stopAll(gs);
            assert.equal(gs.get_phase(), Phase.Essence);
            const pr = P(gs, 'a').prompts[0];
            assert.equal(pr.kind, 'essence');
            assert.deepEqual(pr.options.map(o => o.id), ['f:3', 'f:2', 'f:1']);
            gs.resolve_prompt('a', 'f:1');                      // field 1: +1 ruby
            decline(gs);
            assert.equal(gs.get_phase(), Phase.Eval);
            assert.equal(P(gs, 'a').essence, 1);
            assert.ok(P(gs, 'a').rubies >= 1);
        });

        it('in round 9 pays a point per space instead of glasses', () => {
            const gs = agame({ round: ROUNDS, patients: ['chicken', 'chicken'] });
            P(gs, 'a').pot = [{ chip: 'orange1', pos: 1 }, { chip: 'red1', pos: 2 }];
            gs.stop('a'); gs.stop('b');
            assert.ok(P(gs, 'a').notes.some(n => /Final essence: \+2 points/.test(n)));
            assert.equal(P(gs, 'a').prompts.filter(x => x.kind === 'essence').length, 0);
        });

        it('caps the essence at the top of the flask', () => {
            const gs = agame({ herb: 7 });
            const d = gs.get_data();
            d.fortune = 'all_good';
            P(gs, 'a').pot = ['orange1', 'green1', 'blue1', 'red1', 'yellow1', 'purple1', 'black1', 'herb1', 'herb1', 'orange6']
                .map((chip, i) => ({ chip, pos: i + 1 }));
            assert.equal(gs.essence_reach('a'), ESSENCE_MAX);
        });
    });

    // ======================================================================
    describe('Type A: patients', () => {
        const toEssence = (gs: QuacksGameState, id: string, essence: number) => {
            // jump straight to next round's brewing with this much essence banked
            stopAll(gs);
            decline(gs);
            finishEval(gs);
            decline(gs);
            P(gs, id).essence = essence;
        };

        it('Chicken Eyes: the glass reward arrives at once', () => {
            const gs = agame({ patients: ['chicken', 'chicken'] });
            bag(gs, 'a', ['orange1', 'red1', 'green1', 'blue1', 'yellow1', 'purple1', 'white1']);
            drawAll(gs, 'a', 3);
            stopAll(gs);
            gs.resolve_prompt('a', 'f:3');                      // swap a 1-chip for its 2
            const pr = P(gs, 'a').prompts[0];
            assert.equal(pr.kind, 'chicken_up');
            gs.resolve_prompt('a', pr.options.filter(o => o.id !== 'none')[0].id);
            decline(gs);
            finishEval(gs);
            assert.ok(Object.keys(gs.collection('a')).some(c => /2$/.test(c) && c !== 'white2'));
        });

        it('Vampirism: buys one chip with the glass’s coins', () => {
            const gs = agame({ patients: ['vampire', 'chicken'] });
            bag(gs, 'a', ['orange1', 'red1', 'green1', 'white1']);
            drawAll(gs, 'a', 3);
            stopAll(gs);
            gs.resolve_prompt('a', 'f:3');                      // 6 coins
            const pr = P(gs, 'a').prompts[0];
            assert.equal(pr.kind, 'vampire');
            assert.ok(pr.options.every(o => o.id === 'none' || gs.shop_offers().filter(x => x.chip === o.chip)[0].cost <= 6));
            gs.resolve_prompt('a', 'chip:blue1');
            assert.ok(P(gs, 'a').bag.indexOf('blue1') !== -1);
        });

        it('The Startles: holds chips next round; one can be laid instead of drawing', () => {
            const gs = agame({ patients: ['startles', 'chicken'] });
            P(gs, 'a').pendingDraw = 3;
            stopAll(gs);
            decline(gs);
            finishEval(gs);
            decline(gs);
            const a = P(gs, 'a');
            assert.equal(gs.get_round(), 4);
            assert.ok(a.hand.length <= 3);
            assert.ok(a.hand.every(c => !/^white/.test(c)), 'cherry bombs go straight back');
            if (a.hand.length) {
                const first = a.hand[0];
                gs.lay_hand('a', 0);
                assert.equal(a.pot[a.pot.length - 1].chip, first);
            }
        });

        it('Earworm: lays more chips at once, and cherry bombs laid that way never explode', () => {
            const gs = agame({ patients: ['earworm', 'chicken'] });
            bag(gs, 'a', ['white3', 'white3', 'orange1', 'white3', 'white2', 'green1']);
            drawAll(gs, 'a', 3);
            stopAll(gs);
            // reach: orange = 1 colour; pick the glass on field 1 is a rat; force field 5 directly
            (gs as any).applyEssence(P(gs, 'a'), 5);
            const a = P(gs, 'a');
            assert.deepEqual(a.pot.map(c => c.chip), ['white3', 'white3', 'orange1', 'white3', 'white2']);
            assert.equal(a.exploded, false, '11 white, but laid by the earworm');
        });

        it('Turnip Nose: spends 2 essence to put a pumpkin on the next ruby space', () => {
            const gs = agame({ patients: ['turnip', 'chicken'] });
            P(gs, 'a').essence = 4;
            bag(gs, 'a', ['orange1', 'white1']);
            gs.draw('a');
            assert.equal(P(gs, 'a').prompts[0].kind, 'turnip');
            gs.resolve_prompt('a', 'ruby');
            assert.deepEqual(positions(gs, 'a'), [5], 'space 5 shows the first ruby');
            assert.equal(P(gs, 'a').essence, 2);
        });

        it('Sailing Ears: a cherry bomb moves double for 2 essence, or goes back for 3', () => {
            const gs = agame({ patients: ['sailing', 'chicken'] });
            P(gs, 'a').essence = 5;
            bag(gs, 'a', ['white3', 'white2', 'orange1']);
            gs.draw('a');
            gs.resolve_prompt('a', 'double');
            assert.deepEqual(positions(gs, 'a'), [6]);
            gs.draw('a');
            gs.resolve_prompt('a', 'back');
            assert.equal(P(gs, 'a').essence, 0);
            assert.ok(P(gs, 'a').bag.indexOf('white2') !== -1);
        });

        it('Hunchback: a chip on a ruby space buys a reward by its value', () => {
            const gs = agame({ patients: ['hunchback', 'chicken'] });
            P(gs, 'a').essence = 2;
            P(gs, 'a').origin = 3;
            bag(gs, 'a', ['green2', 'white1']);
            gs.draw('a');                                       // lands on 5, a ruby space
            assert.equal(P(gs, 'a').prompts[0].kind, 'hunchback');
            gs.resolve_prompt('a', 'yes');
            assert.equal(P(gs, 'a').droplet, 1, 'a 2-chip moves the droplet');
            assert.equal(P(gs, 'a').essence, 0);
        });

        it('Forgetfulness: returns a coloured pot chip for its value in essence', () => {
            const gs = agame({ patients: ['forgetful', 'chicken'] });
            P(gs, 'a').essence = 3;
            bag(gs, 'a', ['white1', 'green2', 'orange1', 'white1']);
            drawAll(gs, 'a', 3);
            assert.deepEqual(gs.can_forget('a'), [1, 2]);
            gs.forget('a', 1);
            assert.deepEqual(positions(gs, 'a'), [1, 4], 'the gap stays');
            assert.equal(P(gs, 'a').essence, 1);
            assert.throws(() => gs.forget('a', 0), /cannot go back/);
        });

        it('every patient has a track within the flask', () => {
            for (const x of PATIENTS) {
                Object.keys(x.track).map(Number).forEach(f => assert.ok(f >= 1 && f <= ESSENCE_MAX, `${x.id} field ${f}`));
            }
            assert.equal(PATIENTS.length, 8);
            assert.ok(PATIENT_BY_ID.turnip.start.length === 1);
        });
    });

    // ======================================================================
    describe('Type A: locoweed books', () => {
        it('A1: every locoweed adds 1 essence', () => {
            const gs = agame({ herb: 7 });
            bag(gs, 'a', ['herb1', 'herb1', 'white1']);
            drawAll(gs, 'a', 2);
            assert.deepEqual(positions(gs, 'a'), [1, 2]);
            assert.equal(gs.essence_reach('a'), 1 + 2);
        });

        it('A2: moves one space per colour in the pot, counting itself', () => {
            const gs = agame({ herb: 8 });
            bag(gs, 'a', ['orange1', 'green1', 'herb1', 'herb1', 'white1']);
            drawAll(gs, 'a', 4);
            assert.deepEqual(positions(gs, 'a'), [1, 2, 5, 8]);
        });

        it('A3: sends a coloured pot chip back to the bag', () => {
            const gs = agame({ herb: 9 });
            bag(gs, 'a', ['white2', 'orange1', 'herb1', 'white1']);
            drawAll(gs, 'a', 3);
            const pr = P(gs, 'a').prompts[0];
            assert.equal(pr.kind, 'herb_return');
            assert.ok(pr.options.every(o => o.chip !== 'white2'));
            gs.resolve_prompt('a', 'ret:1');
            assert.deepEqual(P(gs, 'a').pot.map(c => c.chip), ['white2', 'herb1']);
        });

        it('A4: moves as far as the cherry bombs add up to, at least 1', () => {
            const gs = agame({ herb: 10 });
            bag(gs, 'a', ['herb1', 'white2', 'white3', 'herb1', 'orange1']);
            drawAll(gs, 'a', 4);
            assert.deepEqual(positions(gs, 'a'), [1, 3, 6, 11]);
        });
    });

    // ======================================================================
    describe('Type A: fortune cards', () => {
        function withCard(cardId: string, hw = true, players = 3): QuacksGameState {
            const gs = agame({ hw, players, round: 1 });
            const d = gs.get_data();
            d.fortuneDeck = [cardId, ...d.fortuneDeck.filter(c => c !== cardId)];
            stopAll(gs);
            decline(gs);
            finishEval(gs);
            assert.equal(gs.get_round(), 2);
            assert.equal(gs.get_fortune(), cardId);
            return gs;
        }

        it('resolves every Alchemists card without stalling the round', () => {
            for (const card of FORTUNE_CARDS.filter(c => c.box === 'alch')) {
                const gs = withCard(card.id);
                decline(gs);
                assert.equal(gs.get_phase(), Phase.Brew, `${card.id} should reach brewing`);
            }
        });

        it('A Rat in Honour: 3 rat tails per ruby', () => {
            const gs = agame({ round: 1 });
            const d = gs.get_data();
            d.fortuneDeck = ['rat_honour', ...d.fortuneDeck];
            stopAll(gs); decline(gs); finishEval(gs);
            P(gs, 'a').rubies = 2;
            // the card already resolved at round start with whatever rubies a had; re-ask with 2
            P(gs, 'a').prompts.unshift({ kind: 'rat_honour', title: '', text: '', held: [], options: [{ id: 'pay:2', label: '' }] });
            const before = P(gs, 'a').ratTails;
            gs.resolve_prompt('a', 'pay:2');
            assert.equal(P(gs, 'a').ratTails, before + 6);
            assert.equal(P(gs, 'a').rubies, 0);
        });

        it('Good Neighbours: bag a cherry bomb 3 and the left neighbour takes 2 rubies', () => {
            const gs = agame();
            gs.get_data().fortune = 'good_neighbour';
            bag(gs, 'a', ['white3', 'orange1']);
            gs.draw('a');
            gs.neighbour_bomb('a');
            assert.equal(P(gs, 'a').pot.length, 0);
            assert.equal(P(gs, 'b').rubies, 2);
            assert.throws(() => gs.neighbour_bomb('a'));
        });

        it('The White Blessing: a cherry bomb last scores its value when you stop', () => {
            const gs = agame();
            gs.get_data().fortune = 'white_blessing';
            bag(gs, 'a', ['orange1', 'white3', 'white1']);
            drawAll(gs, 'a', 2);
            gs.stop('a');
            assert.ok(P(gs, 'a').notes.some(n => /White Blessing: \+3 points/.test(n)));
        });

        it('Good Gets Better: swaps a 2-chip for another colour in place', () => {
            const gs = agame();
            gs.get_data().fortune = 'good_to_better';
            bag(gs, 'a', ['green2', 'white1']);
            gs.draw('a');
            gs.stop('a');
            gs.resolve_prompt('a', 'i:0');
            const pr = P(gs, 'a').prompts[0];
            assert.equal(pr.kind, 'better_to');
            gs.resolve_prompt('a', 'chip:red2');
            assert.deepEqual(P(gs, 'a').pot.map(c => [c.chip, c.pos]), [['red2', 2]]);
        });

        it('All’s Well and Luck in Misfortune feed the essence', () => {
            const gs = agame();
            gs.get_data().fortune = 'luck_misfortune';
            bag(gs, 'a', ['white3', 'white3', 'white2']);
            drawAll(gs, 'a', 3);
            assert.equal(gs.essence_reach('a'), 2);
            gs.get_data().fortune = 'all_good';
            assert.equal(gs.essence_reach('a'), 2, 'the last chip (a cherry bomb 2) adds its value');
        });

        it('Clearance Sale: two chips bought, the cheaper one twice', () => {
            const gs = agame();
            gs.get_data().fortune = 'clearance';
            P(gs, 'a').origin = 11;
            stopAll(gs); decline(gs);
            gs.buy('a', ['orange1', 'blue1']);
            assert.equal(P(gs, 'a').bag.filter(c => c === 'orange1').length, 3, 'starting pumpkin + bought + free');
        });

        it('A Witch Visits: an extra witch everyone may call once, free', () => {
            const gs = agame({ hw: true });
            const d = gs.get_data();
            d.witches = { silver: 's_flask', bronze: 'b_double', gold: 'g_cheap' };
            d.fortuneDeck = ['witch_visit', ...d.fortuneDeck];
            stopAll(gs); decline(gs); finishEval(gs);
            const guest = gs.guest_witch();
            assert.ok(guest);
            assert.ok(['s_flask', 'b_double', 'g_cheap'].indexOf(guest!.id) === -1);
            assert.equal(P(gs, 'a').pennies.guest, true);
        });
    });

    // ======================================================================
    describe('Type A: whole games', () => {
        function playOut(gs: QuacksGameState): void {
            let guard = 0;
            while (gs.get_phase() !== Phase.Done && guard++ < 12000) {
                const id = gs.get_player_order().filter(pid => gs.needs_action(pid))[0];
                assert.ok(id, `someone must be able to act (phase ${gs.get_phase()}, round ${gs.get_round()})`);
                const p = P(gs, id);
                const metal = ['silver', 'bronze', 'gold', 'guest'].filter(m => gs.witch_usable(id, m))[0];
                if (p.prompts.length) {
                    gs.resolve_prompt(id, p.prompts[0].options[0].id);
                } else if (metal && guard % 3 === 0) {
                    gs.use_witch(id, metal);
                } else if (gs.get_phase() === Phase.Brew) {
                    const forget = gs.can_forget(id);
                    if (p.reserve.length) gs.lay_reserve(id, 0);
                    else if (p.hand.length && !p.exploded) gs.lay_hand(id, 0);
                    else if (forget.length && guard % 5 === 0) gs.forget(id, forget[0]);
                    else if (gs.white_sum(id) < 5 && p.bag.length) gs.draw(id);
                    else gs.stop(id);
                } else if (p.stage === 'shop') {
                    const pick = gs.shop_offers().filter(o => o.cost <= p.coins && o.left > 0).sort((x, y) => y.cost - x.cost)[0];
                    gs.buy(id, pick ? [pick.chip] : []);
                } else if (p.stage === 'rubies') {
                    if (p.rubies >= gs.ruby_cost(id, 'droplet') && !gs.is_final_round()) gs.spend_rubies(id, 'droplet');
                    else gs.ready(id);
                }
            }
            assert.equal(gs.get_phase(), Phase.Done);
        }

        it('plays to a finish alone and with the Herb Witches, conserving chips', () => {
            for (const hw of [false, true]) {
                for (const set of hw ? [1, 3, 5, 6] : [1, 2, 3, 4]) {
                    for (const players of hw ? [2, 3, 5] : [2, 3, 4]) {
                        for (const herb of [7, 8, 9, 10]) {
                            const gs = new QuacksGameState(IDS.slice(0, players));
                            gs.start_game({
                                seed: set * 97 + players * 13 + herb, alchemists: true, herbWitches: hw,
                                bookSets: { ...uniformBookSets(set, hw, true), herb }
                            });
                            playOut(gs);
                            const total: Record<string, number> = { ...gs.get_supply() };
                            for (const id of gs.get_player_order()) {
                                const col = gs.collection(id);
                                Object.keys(col).forEach((c) => { total[c] = (total[c] || 0) + col[c]; });
                            }
                            for (const color of CHIP_COLORS) {
                                const counts: Record<number, number> = { ...CHIP_SUPPLY[color] };
                                const add = (src: any) => Object.keys((src && src[color]) || {}).forEach((v) => {
                                    counts[Number(v)] = (counts[Number(v)] || 0) + src[color][Number(v)];
                                });
                                if (hw) add(EXPANSION_SUPPLY);
                                add(ALCHEMIST_SUPPLY);
                                Object.keys(counts).forEach((v) => {
                                    assert.equal(total[`${color}${v}`] || 0, counts[Number(v)],
                                        `${color}${v} (hw ${hw}, set ${set}, ${players}p, A${herb - 6})`);
                                });
                            }
                        }
                    }
                }
            }
        });
    });

    // ======================================================================
    describe('Type B: integration (GameRuleTest)', () => {
        function gsFrom(test: GameRuleTest): QuacksGameState {
            const raw: any = test.getHostData('gameState');
            return typeof raw?.get_data === 'function' ? raw : QuacksGameState.from_data(raw.data, raw.playerIds);
        }

        it('switches the Alchemists on from the lobby and asks for patients', () => {
            const test = new GameRuleTest('quacks', 1);
            test.invokeHostMethod('setOption', 'alch', true);
            assert.equal(test.getHostData('quacks_books').herb, 7, 'a locoweed book is picked');
            test.invokeHostMethod('setOption', 'book', { color: 'herb', set: 9 });
            test.invokeHostMethod('setOption', 'set', 3);
            assert.equal(test.getHostData('quacks_books').herb, 9, 'presets keep the locoweed pick');
            assert.throws(() => test.invokeHostMethod('setOption', 'book', { color: 'herb', set: 0 }), /No such set/);
            test.invokeHostMethod('startGame');
            const gs = gsFrom(test);
            assert.equal(gs.alchemists(), true);
            assert.equal(gs.book('herb')!.effect, 'HERB_RETURN_CHIP');
            const clientId = test.getPlayerClientId(0);
            const pr = gs.get_player(clientId)!.prompts[0];
            assert.equal(pr.kind, 'patient');
            test.invokeClientMethod(0, 'choose', pr.options[0].id);
            assert.ok(gsFrom(test).get_player(clientId)!.patient);
        });
    });
});
