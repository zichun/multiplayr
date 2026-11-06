/**
 * test_quacks.ts — The Quacks of Quedlinburg tests.
 *   Type A: the data tables, the card art, and the pure QuacksGameState engine.
 *   Type B: end-to-end via GameRuleTest (remote methods + tick distribution).
 */

import { describe, it } from 'mocha';
import { strict as assert } from 'assert';

import { QuacksGameState, Phase, PlayerState } from '../../rules/quacks/QuacksGameState';
import {
    CHIP_SUPPLY, CHIP_COLORS, ChipColor, Chip, STARTING_BAG, POT_TRACK, LAST_FIELD, SPOON_FIELD, fieldAt,
    BOOKS, BOOK_ORDER, getBook, FORTUNE_CARDS, ratTailsBetween, revealedColors, ROUNDS
} from '../../rules/quacks/QuacksData';
import {
    QUACKS_ICONS, getBookCardDefinition, getFortuneCardDefinition, chipIconId, pipIconId, QUACKS_DIE_FACES
} from '../../rules/quacks/QuacksAssets';
import { lintCardDefinition } from '../../client/lib/card-renderer/inspect';
import { GameRuleTest } from '../GameRuleTest';
import { QuacksRule } from '../../rules/quacks/quacks';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const IDS = ['a', 'b', 'c', 'd'];

/**
 * A started game parked at the top of a quiet brewing phase: no fortune card in
 * force, nobody owes a decision, and the RNG always takes the first chip in the
 * bag — so a test scripts a draw order simply by writing the bag.
 */
function game(players = 2, setNumber = 1, round = 1): QuacksGameState {
    const gs = new QuacksGameState(IDS.slice(0, players));
    gs.start_game({ seed: 11, setNumber });
    const d = gs.get_data();
    d.fortune = null;
    d.fortuneNotes = [];
    d.round = round;
    d.startIndex = 0;
    d.phase = Phase.Brew;
    for (const id of d.playerOrder) {
        const p = d.players[id];
        p.prompts = [];
        p.vp = 0; p.rubies = 0; p.droplet = 0; p.origin = 0; p.ratTails = 0;
        p.flaskFull = true; p.rolled = []; p.notes = [];
    }
    gs.set_rng(() => 0);
    return gs;
}

const P = (gs: QuacksGameState, id: string): PlayerState => gs.get_player(id)!;
const bag = (gs: QuacksGameState, id: string, chips: Chip[]) => { P(gs, id).bag = [...chips]; };
const drawAll = (gs: QuacksGameState, id: string, n: number) => { for (let i = 0; i < n; i++) gs.draw(id); };
const positions = (gs: QuacksGameState, id: string) => P(gs, id).pot.map(c => c.pos);

/** Answer every pending prompt with its last option (always the "decline" one). */
function decline(gs: QuacksGameState): void {
    // loop until nobody owes anything: one player's choice can hand another a prompt
    for (let guard = 0; guard < 200; guard++) {
        const id = gs.get_player_order().filter(x => P(gs, x).prompts.length)[0];
        if (!id) return;
        const opts = P(gs, id).prompts[0].options;
        gs.resolve_prompt(id, opts[opts.length - 1].id);
    }
}

/** Walk every player through shopping and ruby spending without buying anything. */
function finishEval(gs: QuacksGameState): void {
    let guard = 0;
    while (gs.get_phase() === Phase.Eval && guard++ < 50) {
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

describe('Quacks', () => {

    // ======================================================================
    describe('Type A: data tables', () => {
        it('has the printed 215 chips and the 9-chip starting bag', () => {
            const total = CHIP_COLORS.reduce((n, c) =>
                n + Object.keys(CHIP_SUPPLY[c]).reduce((m, v) => m + CHIP_SUPPLY[c][Number(v)], 0), 0);
            assert.equal(total, 215);
            assert.equal(STARTING_BAG.length, 9);
            assert.deepEqual(Object.keys(CHIP_SUPPLY.white), ['1', '2', '3']);
            for (const c of ['orange', 'purple', 'black'] as ChipColor[]) assert.deepEqual(Object.keys(CHIP_SUPPLY[c]), ['1']);
        });

        it('has a 33-space pot whose rulebook samples hold, ending in the spoon', () => {
            assert.equal(POT_TRACK.length, SPOON_FIELD + 1);
            assert.equal(LAST_FIELD, 33);
            assert.ok(POT_TRACK.some(f => f.coins === 15 && f.vp === 3 && f.ruby));
            assert.ok(POT_TRACK.some(f => f.coins === 19 && f.vp === 5));
            assert.ok(POT_TRACK.some(f => f.coins === 23 && f.vp === 7));
            assert.deepEqual({ coins: fieldAt(SPOON_FIELD).coins, vp: fieldAt(SPOON_FIELD).vp }, { coins: 35, vp: 15 });
            for (let i = 2; i < POT_TRACK.length; i++) {
                assert.ok(POT_TRACK[i].coins >= POT_TRACK[i - 1].coins, `coins never drop at ${i}`);
                assert.ok(POT_TRACK[i].vp >= POT_TRACK[i - 1].vp, `points never drop at ${i}`);
            }
        });

        it('has a book for every colour in every set, priced as printed', () => {
            for (const set of [1, 2, 3, 4]) {
                for (const players of [2, 3, 4]) {
                    for (const c of BOOK_ORDER.filter(x => x !== 'herb')) assert.ok(getBook(c, set, players), `${c} set ${set}`);
                    assert.equal(getBook('herb', set, players), null, 'no fool’s herb without the expansion');
                }
            }
            assert.equal(getBook('black', 1, 2)!.variant, '2p');
            assert.equal(getBook('black', 1, 4)!.variant, '3-4p');
            assert.deepEqual(getBook('orange', 3, 2)!.costs, { 1: 3 });
            assert.deepEqual(getBook('blue', 4, 2)!.costs, { 1: 5, 2: 10, 4: 20 });
            assert.deepEqual(getBook('green', 3, 2)!.costs, { 1: 6, 2: 11, 4: 21 });
            assert.deepEqual(getBook('purple', 2, 2)!.costs, { 1: 12 });
        });

        it('reveals yellow in round 2 and purple in round 3', () => {
            assert.ok(revealedColors(1).indexOf('yellow') === -1 && revealedColors(1).indexOf('purple') === -1);
            assert.ok(revealedColors(2).indexOf('yellow') !== -1 && revealedColors(2).indexOf('purple') === -1);
            assert.ok(revealedColors(3).indexOf('purple') !== -1);
        });

        it('has 24 distinct fortune cards and gives nobody tails when level', () => {
            const base = FORTUNE_CARDS.filter(c => c.box === 'base');
            assert.equal(base.length, 24);
            assert.equal(FORTUNE_CARDS.filter(c => c.box === 'alch').length, 20, 'the Alchemists box');
            assert.equal(new Set(FORTUNE_CARDS.map(c => c.id)).size, FORTUNE_CARDS.length);
            assert.equal(ratTailsBetween(10, 10), 0);
            assert.ok(ratTailsBetween(0, 10) > ratTailsBetween(5, 10));
        });
    });

    // ======================================================================
    describe('Type A: card art', () => {
        const iconsIn = (def: any): string[] => {
            const ids: string[] = [];
            if (def.mainArt?.iconId) ids.push(def.mainArt.iconId);
            if (def.backIconId) ids.push(def.backIconId);
            (def.data?.rows || []).forEach((r: any) => (r.iconsList || []).forEach((i: any) => ids.push(i.iconId)));
            (String(def.footer?.text || '').match(/\[icon:([a-zA-Z0-9_-]+)\]/g) || [])
                .forEach((m: string) => ids.push(m.slice(6, -1)));
            return ids;
        };

        it('every chip has a disc icon and a pip icon per value', () => {
            for (const c of CHIP_COLORS) {
                assert.ok(QUACKS_ICONS[chipIconId(c)], `chip icon ${c}`);
                Object.keys(CHIP_SUPPLY[c]).forEach(v => assert.ok(QUACKS_ICONS[pipIconId(c, Number(v))], `pip ${c}${v}`));
            }
            Object.keys(QUACKS_DIE_FACES).forEach(f => assert.ok(QUACKS_DIE_FACES[f].icon || QUACKS_DIE_FACES[f].label));
        });

        it('every book and fortune card references only known icons and lints clean', () => {
            const defs = [...BOOKS.map(getBookCardDefinition), ...FORTUNE_CARDS.map(getFortuneCardDefinition)];
            for (const def of defs) {
                for (const id of iconsIn(def)) assert.ok(QUACKS_ICONS[id], `unknown icon ${id} on ${def.id}`);
                const errors = lintCardDefinition(def, { widthPx: 150, customIcons: QUACKS_ICONS })
                    .filter(w => w.level === 'error');
                assert.deepEqual(errors, [], `lint errors on ${def.id}`);
            }
        });

        it('keeps card text short enough for its rule panel', () => {
            const plain = (t: string) => t.replace(/\[icon:[a-zA-Z0-9_-]+\]/g, 'MM');
            BOOKS.forEach(b => assert.ok(plain(b.text).length <= 100, `${b.color} ${b.set}: ${plain(b.text).length}`));
            FORTUNE_CARDS.forEach(c => assert.ok(c.text.length <= 100, `${c.id}: ${c.text.length}`));
        });
    });

    // ======================================================================
    describe('Type A: setup', () => {
        it('deals 9 chips each out of the shared supply', () => {
            const gs = new QuacksGameState(['a', 'b', 'c']);
            gs.start_game({ seed: 3 });
            assert.equal(gs.get_round(), 1);
            const d = gs.get_data();
            for (const id of d.playerOrder) {
                const p = d.players[id];
                const held = p.prompts.reduce((n, pr) => n + pr.held.length, 0);
                assert.ok(p.bag.length + held >= 9);
                assert.equal(p.flaskFull, true);
            }
            assert.ok(d.supply['white1'] <= 20 - 12);
            assert.equal(d.supply['white3'], 4 - 3);
            assert.equal(d.fortuneDeck.length, 23);
        });

        it('rejects illegal player counts', () => {
            assert.throws(() => new QuacksGameState(['a']).start_game());
            assert.throws(() => new QuacksGameState(['a', 'b', 'c', 'd', 'e']).start_game());
        });
    });

    // ======================================================================
    describe('Type A: brewing', () => {
        it('lays each chip its value beyond the last one (rulebook example)', () => {
            const gs = game(2, 1, 2);
            bag(gs, 'a', ['orange1', 'yellow2', 'green1', 'white1']);
            drawAll(gs, 'a', 3);
            assert.deepEqual(positions(gs, 'a'), [1, 3, 4]);
            assert.equal(gs.scoring_field('a').index, 5);
        });

        it('counts the first chip from the droplet plus rat tails', () => {
            const gs = game();
            P(gs, 'a').origin = 4;
            bag(gs, 'a', ['white2', 'white1']);
            gs.draw('a');
            assert.deepEqual(positions(gs, 'a'), [6]);
        });

        it('explodes above 7 white, keeps the chip, and forces a stop', () => {
            const gs = game();
            bag(gs, 'a', ['white3', 'white2', 'white2', 'white1', 'orange1']);
            drawAll(gs, 'a', 3);
            assert.equal(gs.white_sum('a'), 7);
            assert.equal(P(gs, 'a').exploded, false, 'exactly 7 is safe');
            gs.draw('a');
            assert.equal(gs.white_sum('a'), 8);
            assert.equal(P(gs, 'a').exploded, true);
            assert.equal(P(gs, 'a').stopped, true);
            assert.equal(P(gs, 'a').pot.length, 4, 'the exploding chip stays in the pot');
            assert.throws(() => gs.draw('a'));
        });

        it('lets the flask return the last chip once, but never after an explosion', () => {
            const gs = game();
            bag(gs, 'a', ['white3', 'white2', 'white3', 'white1']);
            gs.draw('a');
            gs.use_flask('a');
            assert.equal(P(gs, 'a').pot.length, 0);
            assert.equal(P(gs, 'a').bag.length, 4);
            assert.equal(P(gs, 'a').flaskFull, false);
            gs.draw('a');
            assert.throws(() => gs.use_flask('a'), /empty/);

            const g2 = game();
            bag(g2, 'a', ['white3', 'white3', 'white2']);
            drawAll(g2, 'a', 3);
            assert.equal(P(g2, 'a').exploded, true);
            assert.throws(() => g2.use_flask('a'));
        });

        it('fills the pot at space 33 and scores the spoon', () => {
            const gs = game();
            P(gs, 'a').origin = 31;
            bag(gs, 'a', ['green1', 'blue4', 'orange1']);
            drawAll(gs, 'a', 2);
            assert.deepEqual(positions(gs, 'a'), [32, 33]);
            assert.equal(P(gs, 'a').potFull, true);
            assert.equal(P(gs, 'a').stopped, true);
            assert.equal(gs.scoring_field('a').vp, 15);
            assert.equal(gs.scoring_field('a').coins, 35);
        });

        it('stops a player whose bag runs dry', () => {
            const gs = game();
            bag(gs, 'a', ['orange1']);
            gs.draw('a');
            assert.equal(P(gs, 'a').stopped, true);
            assert.equal(P(gs, 'a').exploded, false);
        });

        it('only evaluates once everybody has stopped', () => {
            const gs = game(3);
            gs.stop('a');
            gs.stop('b');
            assert.equal(gs.get_phase(), Phase.Brew);
            gs.stop('c');
            assert.equal(gs.get_phase(), Phase.Eval);
        });
    });

    // ======================================================================
    describe('Type A: lock-step stirring', () => {
        it('reveals nothing until every active player has chosen', () => {
            const gs = game(2, 1, ROUNDS);
            assert.equal(gs.lockstep(), true, 'round 9 is always stirred together');
            bag(gs, 'a', ['orange1', 'white1']);
            bag(gs, 'b', ['green1', 'white1']);
            gs.draw('a');
            assert.equal(P(gs, 'a').pot.length, 0);
            assert.equal(P(gs, 'a').intent, 'draw');
            gs.stop('a');
            assert.equal(P(gs, 'a').intent, 'stop', 'you may change your mind before the reveal');
            gs.draw('a');
            gs.draw('b');
            assert.equal(P(gs, 'a').pot.length, 1);
            assert.equal(P(gs, 'b').pot.length, 1);
            assert.equal(P(gs, 'a').intent, null);
        });

        it('can be switched on for every round', () => {
            const gs = new QuacksGameState(['a', 'b']);
            gs.start_game({ seed: 5, stirAlways: true });
            assert.equal(gs.lockstep(), true);
        });
    });

    // ======================================================================
    describe('Type A: blue — crow skull', () => {
        it('set 1: peek at N chips and lay one of them', () => {
            const gs = game(2, 1);
            bag(gs, 'a', ['blue2', 'white3', 'green1', 'orange1']);
            gs.draw('a');
            const pr = P(gs, 'a').prompts[0];
            assert.deepEqual(pr.held, ['white3', 'green1']);
            assert.throws(() => gs.draw('a'), /choice/);
            gs.resolve_prompt('a', 'pick:1');
            assert.deepEqual(P(gs, 'a').pot.map(c => c.chip), ['blue2', 'green1']);
            assert.deepEqual(positions(gs, 'a'), [2, 3]);
            assert.deepEqual(P(gs, 'a').bag.sort(), ['orange1', 'white3']);
        });

        it('set 1: may put every peeked chip back', () => {
            const gs = game(2, 1);
            bag(gs, 'a', ['blue1', 'white3', 'orange1']);
            gs.draw('a');
            gs.resolve_prompt('a', 'none');
            assert.equal(P(gs, 'a').pot.length, 1);
            assert.equal(P(gs, 'a').bag.length, 2);
        });

        it('set 2: shields overlap — a 4 drawn after a 2 leaves 3 draws covered', () => {
            const gs = game(2, 2);
            bag(gs, 'a', ['blue2', 'blue4', 'orange1']);
            gs.draw('a');
            assert.equal(gs.shield_left('a'), 2);
            gs.draw('a');
            assert.equal(gs.shield_left('a'), 3, 'not 5: the second skull only widens the running window');
            gs.draw('a');
            assert.equal(gs.shield_left('a'), 2);
        });

        it('set 2: a shielded explosion still scores and shops, but rolls no die', () => {
            const gs = game(2, 2);
            bag(gs, 'a', ['white3', 'white3', 'blue1', 'white2']);
            drawAll(gs, 'a', 4);
            const a = P(gs, 'a');
            assert.equal(a.exploded, true);
            assert.equal(a.shielded, true);
            gs.stop('b');
            assert.equal(gs.get_phase(), Phase.Eval);
            assert.equal(a.rolled.length, 0, 'no bonus die');
            assert.equal(a.prompts.length, 0, 'no points-or-shop choice');
            assert.equal(a.stage, 'shop');
            assert.equal(a.vp, gs.scoring_field('a').vp);
            assert.equal(a.coins, gs.scoring_field('a').coins);
        });

        it('set 2: an explosion outside the window is not shielded', () => {
            const gs = game(2, 2);
            bag(gs, 'a', ['blue1', 'white3', 'white3', 'white2']);
            drawAll(gs, 'a', 4);
            assert.equal(P(gs, 'a').exploded, true);
            assert.equal(P(gs, 'a').shielded, false);
        });

        it('sets 3 and 4: landing on a ruby space pays out at once', () => {
            const g3 = game(2, 3);
            P(g3, 'a').origin = 4;                      // space 5 shows a ruby
            bag(g3, 'a', ['blue1', 'blue2']);
            g3.draw('a');
            assert.equal(P(g3, 'a').rubies, 1);
            g3.draw('a');                               // space 7: no ruby
            assert.equal(P(g3, 'a').rubies, 1);

            const g4 = game(2, 4);
            P(g4, 'a').origin = 5;                      // a 4 lands on space 9: ruby
            bag(g4, 'a', ['blue4', 'orange1']);
            g4.draw('a');
            assert.equal(P(g4, 'a').vp, 4);
        });
    });

    // ======================================================================
    describe('Type A: red — toadstool', () => {
        it('set 1: moves further for the pumpkins already in the pot', () => {
            const gs = game(2, 1);
            bag(gs, 'a', ['red1', 'orange1', 'red1', 'orange1', 'orange1', 'red2', 'white1']);
            drawAll(gs, 'a', 6);
            // red (+0) → 1, orange → 2, red (+1) → 4, orange → 5, orange → 6, red2 (+2) → 10
            assert.deepEqual(positions(gs, 'a'), [1, 2, 4, 5, 6, 10]);
        });

        it('set 2: is set aside, then laid, kept or bagged after stopping', () => {
            const gs = game(2, 2);
            bag(gs, 'a', ['red2', 'orange1', 'red1', 'white1']);
            drawAll(gs, 'a', 3);
            assert.deepEqual(P(gs, 'a').aside, ['red2', 'red1']);
            assert.deepEqual(positions(gs, 'a'), [1]);
            gs.stop('a');
            assert.equal(P(gs, 'a').prompts.length, 2);
            gs.resolve_prompt('a', 'lay');              // red2 → space 3
            gs.resolve_prompt('a', 'keep');             // red1 stays beside the pot
            assert.deepEqual(positions(gs, 'a'), [1, 3]);
            assert.deepEqual(P(gs, 'a').aside, ['red1']);
            assert.equal(gs.get_phase(), Phase.Brew, 'evaluation waits for the other player');

            gs.stop('b');
            finishEval(gs);
            assert.equal(gs.get_round(), 2);
            assert.deepEqual(P(gs, 'a').aside, ['red1'], 'a kept toadstool survives the round');
            assert.equal(P(gs, 'a').bag.indexOf('red1'), -1, 'and is outside the bag');
        });

        it('set 3: adds the value of a white chip laid just before', () => {
            const gs = game(2, 3);
            bag(gs, 'a', ['white2', 'red1', 'red1', 'white1']);
            drawAll(gs, 'a', 3);
            assert.deepEqual(positions(gs, 'a'), [2, 5, 6]);
        });

        it('set 4: makes every later white 1 move two spaces', () => {
            const gs = game(2, 4);
            bag(gs, 'a', ['white1', 'red1', 'white1', 'white2', 'orange1']);
            drawAll(gs, 'a', 4);
            assert.deepEqual(positions(gs, 'a'), [1, 2, 4, 6]);
            assert.equal(gs.white_sum('a'), 4, 'it still only counts 1 towards the explosion');
        });
    });

    // ======================================================================
    describe('Type A: yellow — mandrake', () => {
        it('set 1: may return the white chip laid just before', () => {
            const gs = game(2, 1, 2);
            bag(gs, 'a', ['white3', 'yellow1', 'orange1', 'white1']);
            drawAll(gs, 'a', 2);
            assert.equal(P(gs, 'a').prompts[0].kind, 'yellow_return');
            gs.resolve_prompt('a', 'yes');
            assert.deepEqual(P(gs, 'a').pot.map(c => c.chip), ['yellow1']);
            assert.deepEqual(positions(gs, 'a'), [4], 'the mandrake does not fall back');
            assert.equal(gs.white_sum('a'), 0);
            assert.ok(P(gs, 'a').bag.indexOf('white3') !== -1);
        });

        it('set 2: doubles the next chip only', () => {
            const gs = game(2, 2, 2);
            bag(gs, 'a', ['yellow1', 'green2', 'green2', 'white1']);
            drawAll(gs, 'a', 3);
            assert.deepEqual(positions(gs, 'a'), [1, 5, 7]);
        });

        it('set 3: raises the explosion limit to 8, then 9', () => {
            const gs = game(2, 3, 2);
            assert.equal(gs.threshold('a'), 7);
            bag(gs, 'a', ['yellow1', 'yellow1', 'yellow1', 'white1']);
            gs.draw('a');
            assert.equal(gs.threshold('a'), 8);
            gs.draw('a');
            assert.equal(gs.threshold('a'), 8);
            gs.draw('a');
            assert.equal(gs.threshold('a'), 9);
        });

        it('set 4: the first three move +1, +2, +3', () => {
            const gs = game(2, 4, 2);
            bag(gs, 'a', ['yellow1', 'yellow1', 'yellow1', 'yellow1', 'white1']);
            drawAll(gs, 'a', 4);
            assert.deepEqual(positions(gs, 'a'), [2, 5, 9, 10]);
        });
    });

    // ======================================================================
    describe('Type A: chip actions after brewing', () => {
        const brew = (gs: QuacksGameState, chips: Chip[]) => {
            bag(gs, 'a', [...chips, 'white1']);
            drawAll(gs, 'a', chips.length);
            gs.stop('a');
            for (const id of gs.get_player_order()) if (id !== 'a') gs.stop(id);
        };

        it('green set 1: a ruby for each spider among the last two chips', () => {
            const gs = game(2, 1);
            brew(gs, ['green1', 'orange1', 'green1', 'green2']);
            assert.ok(P(gs, 'a').notes.some(n => /Garden spider: \+2 rubies/.test(n)));
        });

        it('green set 2: a new chip by the spider’s value', () => {
            const gs = game(2, 2);
            brew(gs, ['orange1', 'green1', 'green2']);
            const a = P(gs, 'a');
            assert.equal(a.bag.filter(c => c === 'orange1').length, 1, 'green 1 → a pumpkin, straight away');
            assert.equal(a.prompts[0].kind, 'green2');
            assert.deepEqual(a.prompts[0].options.map(o => o.id), ['chip:blue1', 'chip:red1']);
            gs.resolve_prompt('a', 'chip:red1');
            assert.ok(a.bag.indexOf('red1') !== -1);
        });

        it('green set 3: exactly 7 white moves the last chip on by every green value', () => {
            const gs = game(2, 3);
            brew(gs, ['white3', 'green2', 'white2', 'green4', 'white2']);
            // laid at 3, 5, 7, 11, 13 — then the last chip jumps 6
            assert.equal(gs.last_pos('a'), 19);
            assert.equal(gs.scoring_field('a').index, 20);
        });

        it('green set 4: may pay a ruby per spider to move the droplet', () => {
            const gs = game(2, 4);
            P(gs, 'a').rubies = 1;
            brew(gs, ['green1', 'green1']);
            const a = P(gs, 'a');
            assert.equal(a.prompts[0].kind, 'green4');
            gs.resolve_prompt('a', 'pay:2');
            assert.equal(a.rubies, 0, 'you can only pay the rubies you have');
            assert.equal(a.droplet, 1);
        });

        it('purple set 1: one tier only, and three chips may take the lower one', () => {
            const gs = game(2, 1, 3);
            brew(gs, ['purple1', 'purple1', 'purple1']);
            const a = P(gs, 'a');
            assert.deepEqual(a.prompts[0].options.map(o => o.id), ['tier:3', 'tier:2']);
            const before = a.vp;
            gs.resolve_prompt('a', 'tier:3');
            assert.equal(a.vp - before, 2 + gs.scoring_field('a').vp);
            assert.equal(a.droplet, 1);
        });

        it('purple set 2: trading chips removes them from the bag for good', () => {
            const gs = game(2, 2, 3);
            brew(gs, ['purple1', 'purple1', 'orange1']);
            const a = P(gs, 'a');
            const stock = gs.get_supply()['purple1'];
            gs.resolve_prompt('a', 'trade:2');
            assert.equal(gs.get_supply()['purple1'], stock + 2);
            assert.ok(a.bag.indexOf('green1') !== -1 && a.bag.indexOf('blue2') !== -1);
            assert.equal(a.droplet, 1);
            finishEval(gs);
            assert.equal(gs.collection('a')['purple1'], undefined);
        });

        it('purple set 3: scores each chip by the space it sits on', () => {
            const gs = game(2, 3, 3);
            P(gs, 'a').origin = 9;
            brew(gs, ['purple1', 'orange1', 'purple1']);       // spaces 10 and 12
            assert.ok(P(gs, 'a').notes.some(n => /Ghost’s breath: \+2 points/.test(n)));
        });

        it('purple set 4: upgrades a pot chip into the bag', () => {
            const gs = game(2, 4, 3);
            brew(gs, ['purple1', 'blue1', 'orange1']);
            const a = P(gs, 'a');
            const ids = a.prompts[0].options.map(o => o.id);
            assert.ok(ids.indexOf('up:1:blue1') !== -1);
            assert.equal(ids.filter(i => /orange|purple/.test(i)).length, 0, 'no 2-chip exists in those colours');
            gs.resolve_prompt('a', 'up:1:blue1');
            finishEval(gs);
            const col = gs.collection('a');
            assert.equal(col['blue2'], 1);
            assert.equal(col['blue1'], undefined);
        });

        it('black (2 players): a tie moves the droplet, a lead adds a ruby', () => {
            const tie = game(2, 1);
            bag(tie, 'b', ['black1', 'white1']);
            tie.draw('b');
            bag(tie, 'a', ['black1', 'white1']);
            tie.draw('a');
            tie.stop('a'); tie.stop('b');
            assert.equal(P(tie, 'a').droplet, 1);
            assert.equal(P(tie, 'b').droplet, 1);
            assert.ok(!P(tie, 'a').notes.some(n => /Hawkmoth.*ruby/.test(n)));

            const lead = game(2, 1);
            bag(lead, 'a', ['black1', 'white1']);
            lead.draw('a');
            lead.stop('a'); lead.stop('b');
            assert.ok(P(lead, 'a').notes.some(n => /Hawkmoth: droplet \+1 and \+1 ruby/.test(n)));
            assert.equal(P(lead, 'b').droplet, 0, 'no black chips, no reward');
        });

        it('black (3–4 players): compares with both neighbours', () => {
            const gs = game(4, 1);
            bag(gs, 'a', ['black1', 'black1', 'white1']);
            drawAll(gs, 'a', 2);
            bag(gs, 'b', ['black1', 'white1']);
            gs.draw('b');
            ['a', 'b', 'c', 'd'].forEach(id => gs.stop(id));
            assert.ok(P(gs, 'a').notes.some(n => /droplet \+1 and \+1 ruby/.test(n)), 'beats b and d');
            assert.ok(P(gs, 'b').notes.some(n => /Hawkmoth: droplet \+1$/.test(n)), 'beats only c');
            assert.equal(P(gs, 'c').droplet, 0);
        });
    });

    // ======================================================================
    describe('Type A: evaluation', () => {
        it('gives the bonus die to the best pot that did not explode', () => {
            const gs = game(3);
            bag(gs, 'a', ['white3', 'white3', 'white2']);   // explodes at space 8
            drawAll(gs, 'a', 3);
            bag(gs, 'b', ['green1', 'orange1', 'white1']);
            drawAll(gs, 'b', 2);
            gs.stop('b');
            gs.stop('c');
            assert.equal(gs.get_phase(), Phase.Eval);
            assert.equal(P(gs, 'a').rolled.length, 0);
            assert.equal(P(gs, 'b').rolled.length, 1);
            assert.equal(P(gs, 'c').rolled.length, 0);
        });

        it('makes an exploded player choose points or the shop', () => {
            const gs = game();
            bag(gs, 'a', ['white3', 'white3', 'white2']);
            drawAll(gs, 'a', 3);
            gs.stop('b');
            const a = P(gs, 'a');
            assert.equal(a.prompts[0].kind, 'exploded');
            const field = gs.scoring_field('a');
            assert.equal(field.index, 9);
            assert.equal(a.rubies, 1, 'the ruby on the scoring space is still collected');
            gs.resolve_prompt('a', 'vp');
            assert.equal(a.vp, field.vp);
            assert.equal(a.stage, 'rubies', 'no shopping after taking the points');

            const g2 = game();
            bag(g2, 'a', ['white3', 'white3', 'white2']);
            drawAll(g2, 'a', 3);
            g2.stop('b');
            g2.resolve_prompt('a', 'shop');
            assert.equal(P(g2, 'a').vp, 0);
            assert.equal(P(g2, 'a').stage, 'shop');
            assert.equal(P(g2, 'a').coins, 9);
        });

        it('sells at most two chips of different, revealed colours within budget', () => {
            const gs = game();
            P(gs, 'a').origin = 10;                     // scoring space 11: 11 coins
            gs.stop('a'); gs.stop('b');
            const a = P(gs, 'a');
            assert.equal(a.coins, 11);
            assert.throws(() => gs.buy('a', ['orange1', 'orange1']), /different colours/);
            assert.throws(() => gs.buy('a', ['yellow1']), /not for sale/);
            assert.throws(() => gs.buy('a', ['black1', 'green1']), /afford/);
            assert.throws(() => gs.buy('a', ['orange1', 'green1', 'blue1']), /at most 2/);
            const stock = gs.get_supply()['blue1'];
            gs.buy('a', ['blue1', 'red1']);             // 5 + 6
            assert.equal(gs.get_supply()['blue1'], stock - 1);
            assert.ok(a.bag.indexOf('blue1') !== -1 && a.bag.indexOf('red1') !== -1);
            assert.equal(a.coins, 0, 'unspent coins are forfeited');
            assert.equal(a.stage, 'rubies');
        });

        it('refuses a chip the supply has run out of', () => {
            const gs = game();
            P(gs, 'a').origin = 9;
            gs.stop('a'); gs.stop('b');
            gs.get_supply()['orange1'] = 0;
            assert.throws(() => gs.buy('a', ['orange1']), /sold out/);
        });

        it('spends rubies in pairs on the droplet or the flask', () => {
            const gs = game();
            gs.stop('a'); gs.stop('b');
            const a = P(gs, 'a');
            gs.buy('a', []);
            a.rubies = 5;
            a.flaskFull = false;
            gs.spend_rubies('a', 'droplet');
            gs.spend_rubies('a', 'flask');
            assert.equal(a.droplet, 1);
            assert.equal(a.flaskFull, true);
            assert.equal(a.rubies, 1);
            assert.throws(() => gs.spend_rubies('a', 'droplet'), /Not enough/);
            assert.throws(() => gs.spend_rubies('a', 'flask'), /already full/);
        });

        it('returns every chip to the bag, passes the start player and deals a new card', () => {
            const gs = game();
            bag(gs, 'a', ['orange1', 'green1', 'white1']);
            drawAll(gs, 'a', 2);
            gs.stop('a'); gs.stop('b');
            const first = gs.start_player();
            finishEval(gs);
            assert.equal(gs.get_round(), 2);
            assert.notEqual(gs.start_player(), first);
            assert.equal(P(gs, 'a').pot.length, 0);
            assert.equal(gs.collection('a')['orange1'] >= 1, true);
            assert.ok(gs.get_fortune());
        });
    });

    // ======================================================================
    describe('Type A: rounds, rats and the finish', () => {
        it('gives a rat-stone head start to everyone behind the leader', () => {
            const gs = game();
            P(gs, 'a').vp = 0;
            P(gs, 'b').vp = 9;
            gs.get_data().fortuneDeck = ['lucky_devil', ...gs.get_data().fortuneDeck.filter(c => c !== 'lucky_devil')];
            gs.stop('a'); gs.stop('b');
            finishEval(gs);
            assert.equal(gs.get_round(), 2);
            const tails = ratTailsBetween(P(gs, 'a').vp, P(gs, 'b').vp);
            assert.ok(tails > 0);
            assert.equal(P(gs, 'a').ratTails, tails);
            assert.equal(P(gs, 'a').origin, P(gs, 'a').droplet + tails);
            assert.equal(P(gs, 'b').ratTails, 0, 'the leader gets nothing');
        });

        it('adds a white 1-chip to every bag before round 6', () => {
            const gs = game(2, 1, 5);
            const whites = () => gs.collection('a')['white1'];
            const had = whites();
            gs.stop('a'); gs.stop('b');
            finishEval(gs);
            assert.equal(gs.get_round(), 6);
            assert.equal(whites(), had + 1);
        });

        it('converts coins and rubies to points after round 9 and names the winner', () => {
            const gs = game(2, 1, ROUNDS);
            P(gs, 'a').origin = 9;                      // scoring space 11: 11 coins, 2 points
            P(gs, 'a').rubies = 5;
            gs.draw('a'); gs.stop('b');                 // a draws white1 → space 10, scoring 11 …
            gs.stop('a');
            assert.equal(gs.get_phase(), Phase.Done);
            const a = P(gs, 'a');
            const rolled = a.notes.filter(n => /Bonus die/.test(n)).length;
            assert.equal(rolled, 1);
            assert.ok(a.notes.some(n => /coins became 2 points/.test(n)));
            assert.ok(a.notes.some(n => /Rubies became/.test(n)));
            assert.ok(a.rubies <= 1);
            assert.deepEqual(gs.get_winners(), ['a']);
        });

        it('breaks a tie on points by who filled their pot furthest', () => {
            const gs = game(2, 1, ROUNDS);
            const d = gs.get_data();
            d.phase = Phase.Eval;
            for (const id of ['a', 'b']) { P(gs, id).stage = 'ready'; P(gs, id).vp = 20; }
            P(gs, 'a').lastReach = 12;
            P(gs, 'b').lastReach = 15;
            P(gs, 'a').stage = 'rubies';
            gs.ready('a');
            assert.deepEqual(gs.get_winners(), ['b']);
        });
    });

    // ======================================================================
    describe('Type A: fortune cards', () => {
        /** Start round 2 with a chosen card on top of the deck. */
        function withCard(cardId: string, players = 2, setNumber = 1, prep?: (gs: QuacksGameState) => void): QuacksGameState {
            const gs = game(players, setNumber, 1);
            const d = gs.get_data();
            d.fortuneDeck = [cardId, ...d.fortuneDeck.filter(c => c !== cardId)];
            if (prep) prep(gs);
            for (const id of gs.get_player_order()) gs.stop(id);
            finishEval(gs);
            assert.equal(gs.get_round(), 2);
            assert.equal(gs.get_fortune(), cardId);
            return gs;
        }

        it('resolves every card without stalling the round', () => {
            for (const card of FORTUNE_CARDS.filter(c => c.box === 'base')) {
                const gs = withCard(card.id, 3);
                decline(gs);
                assert.equal(gs.get_phase(), Phase.Brew, `${card.id} should reach brewing`);
            }
        });

        it('Living in Luxury raises the limit to 9 for the round', () => {
            const gs = withCard('living_in_luxury');
            assert.equal(gs.threshold('a'), 9);
        });

        it('Pumpkin Patch Party moves pumpkins an extra space', () => {
            const gs = withCard('pumpkin_party');
            P(gs, 'a').origin = 0;
            bag(gs, 'a', ['orange1', 'white1']);
            gs.draw('a');
            assert.deepEqual(positions(gs, 'a'), [2]);
        });

        it('Well Stirred offers to return the first white chip', () => {
            const gs = withCard('well_stirred');
            bag(gs, 'a', ['white3', 'white2', 'orange1']);
            gs.draw('a');
            assert.equal(P(gs, 'a').prompts[0].kind, 'well_stirred');
            gs.resolve_prompt('a', 'back');
            assert.equal(P(gs, 'a').pot.length, 0);
            gs.draw('a');
            assert.equal(P(gs, 'a').prompts.length, 0, 'only the first white chip');
            assert.equal(P(gs, 'a').pot.length, 1);
        });

        it('Just in Time throws a white 1 out of the game', () => {
            const gs = withCard('just_in_time');
            const had = gs.collection('a')['white1'];
            gs.resolve_prompt('a', 'white');
            gs.resolve_prompt('b', 'vp');
            assert.equal(gs.collection('a')['white1'], had - 1);
            assert.equal(P(gs, 'b').vp >= 4, true);
            assert.equal(gs.get_phase(), Phase.Brew);
        });

        it('Rat Infestation doubles every rat tail', () => {
            const gs = withCard('rat_infestation', 2, 1, (g) => { P(g, 'b').vp = 9; });
            assert.equal(P(gs, 'a').ratTails, 2 * ratTailsBetween(P(gs, 'a').vp, P(gs, 'b').vp));
        });

        it('Strong Ingredient lets a safe stopper lay one of five drawn chips', () => {
            const gs = withCard('strong_ingredient');
            P(gs, 'a').origin = 0;
            bag(gs, 'a', ['orange1', 'green1', 'white1']);
            gs.draw('a');
            gs.stop('a');
            const pr = P(gs, 'a').prompts[0];
            assert.equal(pr.kind, 'pick');
            assert.equal(pr.held.length, 2);
            gs.resolve_prompt('a', 'pick:0');
            assert.deepEqual(positions(gs, 'a'), [1, 2]);
        });

        it('Shopping Spree allows a third colour', () => {
            const gs = withCard('shop_spree');
            assert.equal(gs.max_buy(), 3);
        });
    });

    // ======================================================================
    describe('Type A: whole games', () => {
        /** A crude bot: draws while under 5 white, takes the first option, buys the dearest chip. */
        function playOut(gs: QuacksGameState): void {
            let guard = 0;
            while (gs.get_phase() !== Phase.Done && guard++ < 6000) {
                const id = gs.get_player_order().filter(pid => gs.needs_action(pid))[0];
                assert.ok(id, `someone must be able to act (phase ${gs.get_phase()}, round ${gs.get_round()})`);
                const p = P(gs, id);
                if (p.prompts.length) {
                    gs.resolve_prompt(id, p.prompts[0].options[0].id);
                } else if (gs.get_phase() === Phase.Brew) {
                    if (gs.white_sum(id) < 5 && p.bag.length) gs.draw(id); else gs.stop(id);
                } else if (p.stage === 'shop') {
                    const pick = gs.shop_offers().filter(o => o.cost <= p.coins && o.left > 0)
                        .sort((x, y) => y.cost - x.cost)[0];
                    gs.buy(id, pick ? [pick.chip] : []);
                } else if (p.stage === 'rubies') {
                    if (p.rubies >= 2) gs.spend_rubies(id, 'droplet'); else gs.ready(id);
                }
            }
            assert.equal(gs.get_phase(), Phase.Done);
        }

        it('plays every set at every player count to a finish, conserving chips', () => {
            for (const setNumber of [1, 2, 3, 4]) {
                for (const players of [2, 3, 4]) {
                    for (const stirAlways of [false, true]) {
                        const gs = new QuacksGameState(IDS.slice(0, players));
                        gs.start_game({ seed: setNumber * 100 + players * 7 + (stirAlways ? 1 : 0), setNumber, stirAlways });
                        playOut(gs);
                        assert.equal(gs.get_round(), ROUNDS);
                        assert.ok(gs.get_winners()!.length >= 1);
                        // every chip is either in the supply or owned by somebody
                        const total: Record<string, number> = { ...gs.get_supply() };
                        for (const id of gs.get_player_order()) {
                            const col = gs.collection(id);
                            Object.keys(col).forEach((c) => { total[c] = (total[c] || 0) + col[c]; });
                        }
                        for (const color of CHIP_COLORS) {
                            Object.keys(CHIP_SUPPLY[color]).forEach((v) => {
                                assert.equal(total[`${color}${v}`], CHIP_SUPPLY[color][Number(v)],
                                    `${color}${v} conserved (set ${setNumber}, ${players}p)`);
                            });
                        }
                    }
                }
            }
        });

        it('survives a JSON round trip mid-game', () => {
            const gs = new QuacksGameState(['a', 'b']);
            gs.start_game({ seed: 42, setNumber: 2 });
            decline(gs);
            gs.draw('a');
            const copy = QuacksGameState.from_data(JSON.parse(JSON.stringify(gs.get_data())), ['a', 'b']);
            assert.deepEqual(copy.get_data(), gs.get_data());
            copy.stop('b');
            assert.equal(copy.get_player('b')!.stopped, true);
        });
    });

    // ======================================================================
    describe('Type B: integration (GameRuleTest)', () => {
        function gsFrom(test: GameRuleTest): QuacksGameState {
            const raw: any = test.getHostData('gameState');
            return typeof raw?.get_data === 'function' ? raw : QuacksGameState.from_data(raw.data, raw.playerIds);
        }

        it('starts a game for the host and its clients with the chosen set', () => {
            const test = new GameRuleTest('quacks', 2);    // host + 2 clients
            test.invokeHostMethod('setOption', 'set', 3);
            test.invokeHostMethod('startGame');
            const gs = gsFrom(test);
            assert.equal(gs.get_player_order().length, 3);
            assert.equal(gs.get_set(), 3);
            assert.equal(gs.get_round(), 1);
            assert.ok(gs.get_phase() === Phase.Fortune || gs.get_phase() === Phase.Brew);
        });

        it('shows the host’s book set and drawing mode in every lobby', () => {
            const props: Record<string, Record<string, any>> = {};
            const data: Record<string, any> = { lobby_started: false, quacks_books: { green: 3, blue: 3, red: 3, yellow: 3, purple: 3 }, quacks_stir: true };
            const mp: any = {
                hostId: 'host',
                getData: (k: string) => data[k],
                setViewProps: (id: string, k: string, v: any) => { (props[id] = props[id] || {})[k] = v; },
                setView: () => undefined,
                playersForEach: (fn: (id: string) => void) => ['c1', 'c2'].forEach(fn)
            };
            QuacksRule.onDataChange(mp);
            for (const id of ['host', 'c1', 'c2']) {
                assert.deepEqual(props[id].lobbyBooks, { green: 3, blue: 3, red: 3, yellow: 3, purple: 3, black: 1, herb: 0 }, `${id} sees set 3`);
                assert.equal(props[id].lobbyHerb, false);
                assert.equal(props[id].lobbyStir, true);
                assert.equal(props[id].lobbyPlayers, 3);
            }
        });

        it('lets the host mix books from different sets', () => {
            const test = new GameRuleTest('quacks', 1);
            test.invokeHostMethod('setOption', 'set', 2);
            test.invokeHostMethod('setOption', 'book', { color: 'blue', set: 4 });
            test.invokeHostMethod('setOption', 'book', { color: 'purple', set: 4 });
            assert.throws(() => test.invokeHostMethod('setOption', 'book', { color: 'red', set: 9 }), /No such set/);
            assert.throws(() => test.invokeHostMethod('setOption', 'book', { color: 'orange', set: 2 }), /cannot be changed/);
            test.invokeHostMethod('startGame');
            const gs = gsFrom(test);
            assert.deepEqual(gs.get_book_sets(), { green: 2, blue: 4, red: 2, yellow: 2, purple: 4, black: 1, herb: 0 });
            assert.equal(gs.get_set(), 0, 'a mix is not a preset');
            assert.equal(gs.book('blue')!.effect, 'BLUE_RUBY_FIELD_VP');
            assert.equal(gs.book('red')!.effect, 'RED_SET_ASIDE');
        });

        it('ignores setup changes from a client', () => {
            const test = new GameRuleTest('quacks', 1);
            assert.throws(() => test.invokeClientMethod(0, 'setOption', 'set', 4), /Only the host/);
            assert.equal(test.getHostData('quacks_books'), null);
        });

        it('routes a whole round through the remote methods', () => {
            const test = new GameRuleTest('quacks', 1);    // host + 1 client
            test.invokeHostMethod('startGame');

            const clientId = test.getPlayerClientId(0);
            const hostId = gsFrom(test).get_player_order().filter(id => id !== clientId)[0];
            const as = (id: string, method: string, ...args: any[]) =>
                (id === hostId ? test.invokeHostMethod(method, ...args) : test.invokeClientMethod(0, method, ...args));

            // clear whatever the first fortune card asks for, always declining
            let guard = 0;
            const bought: string[] = [];
            const settlePrompts = () => {
                for (const id of [hostId, clientId]) {
                    while (gsFrom(test).get_player(id)!.prompts.length && guard++ < 60) {
                        const opts = gsFrom(test).get_player(id)!.prompts[0].options;
                        as(id, 'choose', opts[opts.length - 1].id);
                    }
                }
            };
            settlePrompts();
            assert.equal(gsFrom(test).get_phase(), Phase.Brew);

            as(clientId, 'drawChip');
            settlePrompts();
            const afterDraw = gsFrom(test).get_player(clientId)!;
            assert.ok(afterDraw.pot.length + afterDraw.aside.length >= 1 || afterDraw.bag.length === 9,
                'the client’s draw reached the host engine');

            for (const id of [clientId, hostId]) {
                if (!gsFrom(test).get_player(id)!.stopped) as(id, 'stopBrewing');
                settlePrompts();
            }
            assert.equal(gsFrom(test).get_phase(), Phase.Eval);

            while (gsFrom(test).get_phase() === Phase.Eval && gsFrom(test).get_round() === 1 && guard++ < 60) {
                settlePrompts();
                for (const id of [hostId, clientId]) {
                    const live = gsFrom(test);
                    if (live.get_round() !== 1) break;
                    const p = live.get_player(id)!;
                    if (p.prompts.length) continue;
                    if (p.stage === 'shop') {
                        if (p.coins >= 3) bought.push(id);
                        as(id, 'buyChips', p.coins >= 3 ? ['orange1'] : []);
                    }
                    else if (p.stage === 'rubies') as(id, 'ready');
                }
            }

            const gs = gsFrom(test);
            assert.equal(gs.get_round(), 2);
            for (const id of bought) assert.ok(gs.collection(id)['orange1'] >= 2, 'the purchase landed in the bag');
        });
    });
});
