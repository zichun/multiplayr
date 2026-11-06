/**
 * test_quacks_herbwitches.ts — The Herb Witches expansion for Quacks.
 *   Type A: setup, the set 5/6 books, fool's herbs, the overflow bowl, every witch.
 *   Type B: switching the expansion on through the lobby methods.
 */

import { describe, it } from 'mocha';
import { strict as assert } from 'assert';

import { QuacksGameState, Phase, PlayerState } from '../../rules/quacks/QuacksGameState';
import {
    Chip, CHIP_COLORS, CHIP_SUPPLY, EXPANSION_SUPPLY, LAST_FIELD, SPOON_FIELD, fieldAt, ROUNDS,
    BOOKS, WITCHES, getBook, uniformBookSets, normalizeBookSets, presetOf, BookSets
} from '../../rules/quacks/QuacksData';
import { QUACKS_ICONS, getBookCardDefinition, getWitchCardDefinition, chipIconId, pipIconId } from '../../rules/quacks/QuacksAssets';
import { lintCardDefinition } from '../../client/lib/card-renderer/inspect';
import { GameRuleTest } from '../GameRuleTest';

const IDS = ['a', 'b', 'c', 'd', 'e'];

/**
 * An expansion game parked at the top of a quiet brewing phase (no fortune card,
 * no pending choices), whose RNG always takes the first chip in the bag.
 */
function hgame(opts: { players?: number; set?: number; books?: Partial<BookSets>; round?: number;
    witches?: { silver?: string; bronze?: string; gold?: string } } = {}): QuacksGameState {
    const gs = new QuacksGameState(IDS.slice(0, opts.players || 2));
    const bookSets = { ...uniformBookSets(opts.set || 5, true), ...(opts.books || {}) } as BookSets;
    gs.start_game({ seed: 3, herbWitches: true, bookSets });
    const d = gs.get_data();
    d.fortune = null;
    d.fortuneNotes = [];
    d.round = opts.round || 3;
    d.startIndex = 0;
    d.phase = Phase.Brew;
    d.witches = { silver: 's_six', bronze: 'b_double', gold: 'g_colors', ...(opts.witches || {}) };
    for (const id of d.playerOrder) {
        Object.assign(d.players[id], {
            prompts: [], vp: 0, rubies: 0, droplet: 0, origin: 0, ratTails: 0, flaskFull: true, rolled: [], notes: []
        });
    }
    gs.set_rng(() => 0);
    return gs;
}

const P = (gs: QuacksGameState, id: string): PlayerState => gs.get_player(id)!;
const bag = (gs: QuacksGameState, id: string, chips: Chip[]) => { P(gs, id).bag = [...chips]; };
const drawAll = (gs: QuacksGameState, id: string, n: number) => { for (let i = 0; i < n; i++) gs.draw(id); };
const positions = (gs: QuacksGameState, id: string) => P(gs, id).pot.map(c => c.pos);
const stopAll = (gs: QuacksGameState) => gs.get_player_order().forEach((id) => { if (!P(gs, id).stopped) gs.stop(id); });

/** Answer every pending prompt with its last option (always the "decline" one). */
function decline(gs: QuacksGameState): void {
    for (let guard = 0; guard < 200; guard++) {
        const id = gs.get_player_order().filter(x => P(gs, x).prompts.length)[0];
        if (!id) return;
        const opts = P(gs, id).prompts[0].options;
        gs.resolve_prompt(id, opts[opts.length - 1].id);
    }
}

/** Shop nothing and get ready, for everyone. */
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

describe('Quacks: The Herb Witches', () => {

    // ======================================================================
    describe('Type A: setup and data', () => {
        it('allows a fifth player only with the expansion', () => {
            assert.throws(() => new QuacksGameState(IDS).start_game({ seed: 1 }));
            const gs = new QuacksGameState(IDS);
            gs.start_game({ seed: 1, herbWitches: true });
            assert.equal(gs.get_player_order().length, 5);
            assert.throws(() => new QuacksGameState([...IDS, 'f']).start_game({ herbWitches: true }));
        });

        it('adds fool’s herbs and 6-pumpkins, deals one witch per metal and three pennies each', () => {
            const gs = new QuacksGameState(['a', 'b']);
            gs.start_game({ seed: 9, herbWitches: true, setNumber: 6 });
            const supply = gs.get_supply();
            assert.equal(supply['herb1'], 18);
            assert.equal(supply['orange6'], 8);
            assert.deepEqual(gs.witches().map(w => w.metal), ['silver', 'bronze', 'gold']);
            const pen = P(gs, 'a').pennies;
            assert.deepEqual([pen.silver, pen.bronze, pen.gold], [true, true, true]);
            assert.deepEqual(gs.book('orange')!.costs, { 1: 3, 6: 14 });
            assert.equal(gs.book('herb')!.effect, 'HERB_COPY_PREV');
            assert.ok(gs.revealed().indexOf('herb') !== -1, 'the herb book is open from round 1');
            const base = new QuacksGameState(['a', 'b']);
            base.start_game({ seed: 9 });
            assert.equal(base.witches().length, 0);
            assert.equal(base.get_supply()['herb1'] || 0, 0);
        });

        it('builds the set 5 and 6 presets, and drops them when the expansion is off', () => {
            assert.deepEqual(uniformBookSets(5, true), { green: 5, blue: 5, red: 5, yellow: 5, purple: 5, black: 5, herb: 5 });
            assert.deepEqual(uniformBookSets(6, true), { green: 6, blue: 6, red: 6, yellow: 6, purple: 6, black: 1, herb: 6 });
            assert.deepEqual(uniformBookSets(2, true), { green: 2, blue: 2, red: 2, yellow: 2, purple: 2, black: 1, herb: 0 });
            assert.deepEqual(normalizeBookSets({ green: 5, herb: 6, black: 5 }, 1, false),
                { green: 1, blue: 1, red: 1, yellow: 1, purple: 1, black: 1, herb: 0 });
            assert.equal(presetOf(uniformBookSets(6, true), true), 6);
            assert.equal(presetOf({ ...uniformBookSets(5, true), herb: 6 }, true), null);
            assert.equal(getBook('black', uniformBookSets(5, true), 3, true)!.effect, 'BLACK_GIFT_LEFT');
            assert.equal(getBook('black', uniformBookSets(5, true), 3, false)!.effect, 'BLACK_COMPARE_NEIGHBORS');
        });

        it('has art for every new chip and card text that lints clean', () => {
            assert.ok(QUACKS_ICONS[chipIconId('herb')] && QUACKS_ICONS[pipIconId('orange', 6)] && QUACKS_ICONS[pipIconId('herb', 1)]);
            const defs = [...BOOKS.filter(b => (b.set || 0) >= 5 || b.variant === 'hw').map(getBookCardDefinition),
                ...WITCHES.map(getWitchCardDefinition)];
            for (const def of defs) {
                const errors = lintCardDefinition(def, { widthPx: 150, customIcons: QUACKS_ICONS }).filter(w => w.level === 'error');
                assert.deepEqual(errors, [], `lint errors on ${def.id}`);
                const inline: string[] = String(def.footer?.text || '').match(/\[icon:([a-zA-Z0-9_-]+)\]/g) || [];
                inline.forEach(m => assert.ok(QUACKS_ICONS[m.slice(6, -1)], `${def.id}: ${m}`));
                if (def.mainArt?.iconId) assert.ok(QUACKS_ICONS[def.mainArt.iconId], `${def.id} art`);
            }
            const plain = (t: string) => t.replace(/\[icon:[a-zA-Z0-9_-]+\]/g, 'MM');
            [...BOOKS, ...WITCHES].forEach(x => assert.ok(plain(x.text).length <= 100, `${(x as any).id || (x as any).color}: too long`));
        });
    });

    // ======================================================================
    describe('Type A: the overflow bowl', () => {
        it('keeps brewing past space 33; later chips go to the bowl and score half their value', () => {
            const gs = hgame({ set: 1 });
            P(gs, 'a').origin = 31;
            bag(gs, 'a', ['green2', 'orange6', 'green4', 'orange1', 'white1']);
            drawAll(gs, 'a', 4);
            const a = P(gs, 'a');
            assert.equal(a.potFull, true);
            assert.equal(a.stopped, false, 'a full pot no longer stops you');
            assert.deepEqual(positions(gs, 'a'), [33]);
            assert.deepEqual(a.overflow, ['orange6', 'green4', 'orange1']);
            gs.stop('a'); gs.stop('b');
            assert.equal(gs.scoring_field('a').index, SPOON_FIELD);
            assert.ok(a.notes.some(n => /Overflow bowl: \+5 points/.test(n)), '(6 + 4 + 1) / 2 rounded down');
            assert.equal(a.rolled.length, 1, 'a full pot rolls the die');
        });

        it('still counts cherry bombs in the bowl towards the explosion', () => {
            const gs = hgame({ set: 1, witches: { silver: 's_whites' } });
            P(gs, 'a').origin = 32;
            bag(gs, 'a', ['green1', 'white3', 'white3', 'white2']);
            drawAll(gs, 'a', 4);
            assert.equal(P(gs, 'a').overflow.length, 3);
            assert.equal(P(gs, 'a').exploded, true);
        });

        it('lets the flask take back a chip that just fell into the bowl', () => {
            const gs = hgame({ set: 1 });
            P(gs, 'a').origin = 32;
            bag(gs, 'a', ['green1', 'white3', 'orange1']);
            drawAll(gs, 'a', 2);
            gs.use_flask('a');
            assert.deepEqual(P(gs, 'a').overflow, []);
            assert.ok(P(gs, 'a').bag.indexOf('white3') !== -1);
        });
    });

    // ======================================================================
    describe('Type A: fool’s herb', () => {
        it('set 5: moves 1 plus the rat tails, never more than 4', () => {
            const gs = hgame({ set: 5 });
            P(gs, 'a').ratTails = 2;
            bag(gs, 'a', ['herb1', 'herb1', 'white1']);
            gs.draw('a');
            assert.deepEqual(positions(gs, 'a'), [3]);
            P(gs, 'a').ratTails = 7;
            gs.draw('a');
            assert.deepEqual(positions(gs, 'a'), [3, 7]);
        });

        it('set 6: copies the move and power of the chip before it; after a cherry bomb it moves 1', () => {
            const gs = hgame({ set: 6 });
            bag(gs, 'a', ['green2', 'herb1', 'white1', 'herb1', 'orange1']);
            drawAll(gs, 'a', 4);
            assert.deepEqual(positions(gs, 'a'), [2, 4, 5, 6]);

            const g2 = hgame({ set: 6 });
            bag(g2, 'a', ['white1', 'blue2', 'herb1', 'orange1']);
            drawAll(g2, 'a', 3);
            assert.deepEqual(positions(g2, 'a'), [1, 3, 5]);
            assert.equal(P(g2, 'a').rubies, 2, 'the skull and its herb copy each see a cherry bomb behind them');
        });
    });

    // ======================================================================
    describe('Type A: set 5 and 6 books', () => {
        it('blue 5: scores its value with at least that many pumpkins already in the pot', () => {
            const gs = hgame({ set: 5 });
            bag(gs, 'a', ['orange1', 'orange1', 'blue2', 'blue4', 'white1']);
            drawAll(gs, 'a', 4);
            assert.equal(P(gs, 'a').vp, 2, 'the 2 scores, the 4 does not');
        });

        it('blue 6: a ruby for each cherry bomb among the chips it looks back over', () => {
            const gs = hgame({ set: 6 });
            bag(gs, 'a', ['white1', 'orange1', 'white2', 'blue2', 'orange1']);
            drawAll(gs, 'a', 4);
            assert.equal(P(gs, 'a').rubies, 1, 'looks back 2 chips: orange and a cherry bomb');
        });

        it('red 5: moves as far as the biggest toadstool already in the pot', () => {
            const gs = hgame({ set: 5 });
            bag(gs, 'a', ['red4', 'red1', 'red2', 'white1']);
            drawAll(gs, 'a', 3);
            assert.deepEqual(positions(gs, 'a'), [4, 8, 12]);
        });

        it('red 6: holds the next chip, which must be laid this round — and a held cherry bomb counts', () => {
            const gs = hgame({ set: 6 });
            bag(gs, 'a', ['red1', 'white3', 'orange1', 'white1']);
            gs.draw('a');
            const a = P(gs, 'a');
            assert.deepEqual(a.reserve, ['white3']);
            assert.equal(gs.white_sum('a'), 3);
            assert.ok(gs.needs_action('a'));
            gs.lay_reserve('a', 0);
            assert.deepEqual(positions(gs, 'a'), [1, 4]);
            assert.equal(gs.white_sum('a'), 3);

            const g2 = hgame({ set: 6 });
            bag(g2, 'a', ['red1', 'orange1', 'white1']);
            g2.draw('a');
            g2.stop('a');
            assert.equal(P(g2, 'a').prompts[0].kind, 'reserve');
            assert.deepEqual(P(g2, 'a').prompts[0].options.map(o => o.id), ['lay'], 'no way to skip it');
            g2.resolve_prompt('a', 'lay');
            assert.deepEqual(positions(g2, 'a'), [1, 2]);
        });

        it('yellow 5: also moves the value of a peeked chip, which goes back', () => {
            const gs = hgame({ set: 5, round: 3 });
            bag(gs, 'a', ['yellow1', 'green4', 'white1']);
            gs.draw('a');
            assert.deepEqual(positions(gs, 'a'), [5]);
            assert.ok(P(gs, 'a').bag.indexOf('green4') !== -1);
        });

        it('yellow 6: may pay a ruby for 3 more spaces', () => {
            const gs = hgame({ set: 6, round: 3 });
            P(gs, 'a').rubies = 1;
            bag(gs, 'a', ['yellow2', 'white1']);
            gs.draw('a');
            gs.resolve_prompt('a', 'yes');
            assert.deepEqual(positions(gs, 'a'), [5]);
            assert.equal(P(gs, 'a').rubies, 0);
        });

        it('green 5: keeps a chip that opens the next round', () => {
            const gs = hgame({ set: 5 });
            bag(gs, 'a', ['blue1', 'orange1', 'green2', 'white1']);
            drawAll(gs, 'a', 3);
            stopAll(gs);
            const a = P(gs, 'a');
            const pr = a.prompts[0];
            assert.equal(pr.kind, 'green_carry');
            assert.ok(pr.options.every(o => o.id === 'none' || ['blue1', 'orange1', 'green2'].indexOf(o.chip!) !== -1));
            gs.resolve_prompt('a', 'carry:0');
            assert.equal(a.carry, 'blue1');
            finishEval(gs);
            decline(gs);
            assert.equal(gs.get_round(), 4);
            assert.equal(P(gs, 'a').pot[0].chip, 'blue1', 'laid first');
            assert.equal(P(gs, 'a').carry, null);
        });

        it('green 6: rolls the bonus die once per late spider', () => {
            const gs = hgame({ set: 6, players: 3 });
            bag(gs, 'a', ['green1', 'green1', 'white1']);
            drawAll(gs, 'a', 2);
            bag(gs, 'b', ['green1', 'green1', 'green4', 'white1']);
            drawAll(gs, 'b', 3);
            stopAll(gs);
            assert.equal(P(gs, 'a').rolled.length, 2);
            assert.equal(P(gs, 'b').rolled.length, 3, '2 spiders + the bonus die for the best pot');
        });

        it('purple 5: a second shopping trip worth the points under the ghosts', () => {
            const gs = hgame({ set: 5 });
            P(gs, 'a').origin = 13;
            bag(gs, 'a', ['purple1', 'orange1', 'purple1', 'white1']);
            drawAll(gs, 'a', 3);
            stopAll(gs);
            const a = P(gs, 'a');
            const trip = fieldAt(14).vp + fieldAt(16).vp;
            assert.equal(a.stage, 'shop');
            gs.buy('a', []);
            assert.equal(a.stage, 'shop', 'second trip');
            assert.equal(a.coins, trip);
            gs.buy('a', ['orange1']);
            assert.equal(a.stage, 'rubies');
        });

        it('purple 6: scores the printed value of the chip after each ghost', () => {
            const gs = hgame({ set: 6 });
            bag(gs, 'a', ['purple1', 'green4', 'purple1', 'orange1', 'white1']);
            drawAll(gs, 'a', 4);
            stopAll(gs);
            assert.ok(P(gs, 'a').notes.some(n => /Ghost’s breath: \+5 points/.test(n)));
        });

        it('black 5: moths fly to the left neighbour, and pay out for the moths you gave', () => {
            const gs = hgame({ set: 5, players: 3 });
            P(gs, 'a').origin = 9;
            stopAll(gs);
            finishEval(gs);
            const g2 = hgame({ set: 5, players: 3 });
            P(g2, 'a').origin = 9;
            stopAll(g2);
            const a = P(g2, 'a');
            const before = P(g2, 'b').bag.length;
            g2.buy('a', ['black1']);
            assert.equal(P(g2, 'b').bag.length, before + 1, 'into b’s bag');
            assert.equal(a.bag.indexOf('black1'), -1);
            assert.equal(a.droplet, 1);

            const g3 = hgame({ set: 5, players: 3 });
            bag(g3, 'b', ['black1', 'orange1', 'white1']);
            drawAll(g3, 'b', 1);
            bag(g3, 'c', ['orange1', 'black1', 'white1']);
            drawAll(g3, 'c', 2);
            stopAll(g3);
            assert.ok(P(g3, 'a').notes.some(n => /\+1 ruby for the moths/.test(n)), 'a gave b a moth');
            assert.ok(P(g3, 'b').notes.some(n => /one of your last two/.test(n)));
            assert.ok(P(g3, 'c').notes.some(n => /the furthest moth/.test(n)));
            assert.ok(P(g3, 'b').notes.some(n => /second furthest/.test(n)));
        });
    });

    // ======================================================================
    describe('Type A: witches', () => {
        it('The Bottler: flasks the chip that blew the pot up, once', () => {
            const gs = hgame({ set: 1, witches: { silver: 's_flask' } });
            bag(gs, 'a', ['white3', 'white3', 'white2', 'orange1']);
            drawAll(gs, 'a', 3);
            const a = P(gs, 'a');
            assert.equal(a.prompts[0].kind, 'witch_boom');
            assert.equal(a.stopped, false, 'evaluation waits for the choice');
            gs.resolve_prompt('a', 'call');
            assert.equal(a.exploded, false);
            assert.equal(a.flaskFull, false);
            assert.equal(a.pennies.silver, false);
            assert.ok(a.bag.indexOf('white2') !== -1);
            gs.draw('a');
            assert.equal(a.pot.length, 3);
        });

        it('The Survivor: an explosion scores points, shop and die', () => {
            const gs = hgame({ set: 1, witches: { silver: 's_bonus' } });
            bag(gs, 'a', ['white3', 'white3', 'white2', 'orange1']);
            drawAll(gs, 'a', 3);
            gs.resolve_prompt('a', 'call');
            gs.stop('b');
            const a = P(gs, 'a');
            assert.equal(a.saved, true);
            assert.equal(a.rolled.length, 1);
            assert.equal(a.stage, 'shop', 'no points-or-shop choice');
            assert.equal(a.vp, gs.scoring_field('a').vp + 1, 'the space’s points plus the die’s +1');
        });

        it('The Sorter: draw 6 and lay any of them in any order', () => {
            const gs = hgame({ set: 1, witches: { silver: 's_six' } });
            bag(gs, 'a', ['orange1', 'green2', 'white3', 'blue1', 'red2', 'white1', 'white2']);
            assert.ok(gs.witch_usable('a', 'silver'));
            gs.use_witch('a', 'silver');
            assert.equal(P(gs, 'a').prompts[0].held.length, 6);
            gs.resolve_prompt('a', 'lay:1');        // green2
            gs.resolve_prompt('a', 'lay:0');        // orange1
            gs.resolve_prompt('a', 'done');
            assert.deepEqual(P(gs, 'a').pot.map(c => c.chip), ['green2', 'orange1']);
            assert.equal(P(gs, 'a').bag.length, 5);
            assert.equal(gs.witch_usable('a', 'silver'), false, 'one penny, one call');
        });

        it('The Defuser: returns up to two cherry bombs, leaving the gaps', () => {
            const gs = hgame({ set: 1, witches: { silver: 's_whites' } });
            bag(gs, 'a', ['white2', 'orange1', 'white3', 'orange1', 'white1']);
            drawAll(gs, 'a', 4);
            gs.use_witch('a', 'silver');
            gs.resolve_prompt('a', 'w:2');
            gs.resolve_prompt('a', 'w:6');
            assert.deepEqual(positions(gs, 'a'), [3, 7]);
            assert.equal(gs.white_sum('a'), 0);
        });

        it('The Defuser: can also take cherry bombs out of the overflow bowl', () => {
            const gs = hgame({ set: 1, witches: { silver: 's_whites' } });
            P(gs, 'a').origin = 32;
            bag(gs, 'a', ['green1', 'orange1', 'white3', 'white2', 'orange1']);
            drawAll(gs, 'a', 4);
            const a = P(gs, 'a');
            assert.deepEqual(a.overflow, ['orange1', 'white3', 'white2']);
            assert.ok(gs.witch_usable('a', 'silver'), 'only bowl bombs, no pot bombs');
            gs.use_witch('a', 'silver');
            const ids = a.prompts[0].options.map(o => o.id);
            assert.deepEqual(ids, ['o:1', 'o:2', 'done']);
            gs.resolve_prompt('a', 'o:1');
            gs.resolve_prompt('a', 'o:1');      // indices shift: the white 2 is now at 1
            assert.deepEqual(a.overflow, ['orange1']);
            assert.equal(gs.white_sum('a'), 0);
            assert.ok(a.bag.indexOf('white3') !== -1 && a.bag.indexOf('white2') !== -1);
        });

        it('The Refiner: upgrades the last two pot chips, never a pumpkin', () => {
            const gs = hgame({ set: 1, witches: { bronze: 'b_upgrade' } });
            bag(gs, 'a', ['red1', 'orange1', 'green2', 'white1']);
            drawAll(gs, 'a', 3);
            stopAll(gs);
            assert.ok(gs.witch_usable('a', 'bronze'));
            gs.use_witch('a', 'bronze');
            const ids = P(gs, 'a').prompts[0].options.map(o => o.id);
            assert.ok(ids.indexOf('last2') !== -1);
            assert.equal(ids.filter(i => i === 'one:1').length, 0, 'the pumpkin is not on offer');
            gs.resolve_prompt('a', 'last2');
            finishEval(gs);
            const col = gs.collection('a');
            assert.equal(col['green4'], 1);
            assert.equal(col['orange1'], 1, 'pumpkin untouched');
        });

        it('The Haggler and The Jeweller boost a shopping trip', () => {
            const gs = hgame({ set: 1, witches: { bronze: 'b_double' } });
            P(gs, 'a').origin = 9;
            stopAll(gs);
            const coins = P(gs, 'a').coins;
            gs.use_witch('a', 'bronze');
            assert.equal(P(gs, 'a').coins, 2 * coins);

            const g2 = hgame({ set: 1, witches: { bronze: 'b_ruby' } });
            P(g2, 'a').origin = 9;
            P(g2, 'a').rubies = 3;
            stopAll(g2);
            const c2 = P(g2, 'a').coins;
            const r2 = P(g2, 'a').rubies;
            g2.use_witch('a', 'bronze');
            assert.equal(P(g2, 'a').coins, c2 + 2 * r2);
            assert.equal(P(g2, 'a').rubies, r2, 'rubies kept');
        });

        it('The Twinner: a second copy of a chip you bought', () => {
            const gs = hgame({ set: 1, witches: { bronze: 'b_copy' } });
            P(gs, 'a').origin = 9;
            stopAll(gs);
            assert.equal(gs.witch_usable('a', 'bronze'), false, 'nothing bought yet');
            gs.buy('a', ['blue1']);
            gs.use_witch('a', 'bronze');
            gs.resolve_prompt('a', 'chip:blue1');
            assert.equal(P(gs, 'a').bag.filter(c => c === 'blue1').length, 2);
        });

        it('The Painter and The Rummager score the pot’s colours and the bag’s big chips', () => {
            const gs = hgame({ set: 1, witches: { gold: 'g_colors' } });
            bag(gs, 'a', ['orange1', 'green1', 'white1', 'red1', 'orange1']);
            drawAll(gs, 'a', 4);
            stopAll(gs);
            const before = P(gs, 'a').vp;
            gs.use_witch('a', 'gold');
            assert.equal(P(gs, 'a').vp - before, 3);

            const g2 = hgame({ set: 1, witches: { gold: 'g_bag' } });
            bag(g2, 'a', ['orange1', 'green2', 'red4', 'white2', 'orange6', 'blue1']);
            g2.draw('a');
            stopAll(g2);
            const b2 = P(g2, 'a').vp;
            g2.use_witch('a', 'gold');
            assert.equal(P(g2, 'a').vp - b2, 6, 'green 2, red 4, pumpkin 6');
        });

        it('The Miner: turns the scoring-space ruby into as many rubies as its points', () => {
            const gs = hgame({ set: 1, witches: { gold: 'g_rubies' } });
            P(gs, 'a').origin = 29;               // scoring space 30: ruby, 7 points
            stopAll(gs);
            const a = P(gs, 'a');
            assert.equal(a.prompts[0].kind, 'witch_miner');
            gs.resolve_prompt('a', 'call');
            assert.equal(a.rubies, fieldAt(30).vp);
            assert.equal(a.pennies.gold, false);
        });

        it('The Discounter: droplet and flask cost 1 ruby', () => {
            const gs = hgame({ set: 1, witches: { gold: 'g_cheap' } });
            stopAll(gs);
            gs.buy('a', []);
            P(gs, 'a').rubies = 2;
            P(gs, 'a').flaskFull = false;
            gs.use_witch('a', 'gold');
            gs.spend_rubies('a', 'droplet');
            gs.spend_rubies('a', 'flask');
            assert.equal(P(gs, 'a').rubies, 0);
            assert.equal(P(gs, 'a').droplet, 1);
        });

        it('pays 2 points per unspent penny at the end', () => {
            const gs = hgame({ set: 1, round: ROUNDS, witches: { gold: 'g_colors' } });
            gs.stop('a'); gs.stop('b');
            decline(gs);
            const a = P(gs, 'a');
            assert.equal(a.stage, 'rubies', 'a last stop to call witches in round 9');
            gs.use_witch('a', 'gold');
            const vp = a.vp;
            gs.ready('a');
            assert.equal(a.vp - vp, 4, 'silver and bronze pennies left');
            gs.ready('b');
            assert.equal(gs.get_phase(), Phase.Done);
        });
    });

    // ======================================================================
    describe('Type A: whole games', () => {
        function playOut(gs: QuacksGameState): void {
            let guard = 0;
            while (gs.get_phase() !== Phase.Done && guard++ < 9000) {
                const id = gs.get_player_order().filter(pid => gs.needs_action(pid))[0];
                assert.ok(id, `someone must be able to act (phase ${gs.get_phase()}, round ${gs.get_round()})`);
                const p = P(gs, id);
                const metal = ['silver', 'bronze', 'gold'].filter(m => gs.witch_usable(id, m))[0];
                if (p.prompts.length) {
                    gs.resolve_prompt(id, p.prompts[0].options[0].id);
                } else if (metal && guard % 3 === 0) {
                    gs.use_witch(id, metal);
                } else if (gs.get_phase() === Phase.Brew) {
                    if (p.reserve.length) gs.lay_reserve(id, 0);
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

        it('plays every set at 2–5 players to a finish, conserving chips', () => {
            for (const set of [1, 2, 3, 4, 5, 6]) {
                for (const players of [2, 3, 4, 5]) {
                    const gs = new QuacksGameState(IDS.slice(0, players));
                    gs.start_game({ seed: set * 31 + players, setNumber: set, herbWitches: true });
                    playOut(gs);
                    const total: Record<string, number> = { ...gs.get_supply() };
                    for (const id of gs.get_player_order()) {
                        const col = gs.collection(id);
                        Object.keys(col).forEach((c) => { total[c] = (total[c] || 0) + col[c]; });
                    }
                    for (const color of CHIP_COLORS) {
                        const counts: Record<number, number> = { ...CHIP_SUPPLY[color] };
                        const extra = EXPANSION_SUPPLY[color] || {};
                        Object.keys(extra).forEach((v) => { counts[Number(v)] = (counts[Number(v)] || 0) + extra[Number(v)]; });
                        Object.keys(counts).forEach((v) => {
                            assert.equal(total[`${color}${v}`] || 0, counts[Number(v)], `${color}${v} (set ${set}, ${players}p)`);
                        });
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

        it('lets the host switch the expansion on and seat five players', () => {
            const test = new GameRuleTest('quacks', 4);    // host + 4 clients
            assert.throws(() => test.invokeHostMethod('startGame'), /2 to 4/);
            test.invokeHostMethod('setOption', 'herb', true);
            test.invokeHostMethod('setOption', 'set', 6);
            test.invokeHostMethod('setOption', 'book', { color: 'herb', set: 5 });
            assert.throws(() => test.invokeClientMethod(0, 'setOption', 'herb', false), /Only the host/);
            test.invokeHostMethod('startGame');
            const gs = gsFrom(test);
            assert.equal(gs.expansion(), true);
            assert.equal(gs.get_player_order().length, 5);
            assert.equal(gs.book('herb')!.set, 5);
            assert.equal(gs.witches().length, 3);
        });

        it('turning the expansion off drops set 5 and 6 picks', () => {
            const test = new GameRuleTest('quacks', 1);
            test.invokeHostMethod('setOption', 'herb', true);
            test.invokeHostMethod('setOption', 'set', 5);
            test.invokeHostMethod('setOption', 'herb', false);
            assert.deepEqual(test.getHostData('quacks_books'), uniformBookSets(1, false));
            assert.throws(() => test.invokeHostMethod('setOption', 'book', { color: 'green', set: 5 }), /No such set/);
        });
    });
});
