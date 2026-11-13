/**
 * test_critterkitchen.ts — Critter Kitchen tests.
 *   Type A: data tables, meal maths (CKMeals) and the pure CKGameState engine.
 *   Type B: end-to-end via GameRuleTest (remote methods + per-client props).
 */

import { describe, it } from 'mocha';
import { strict as assert } from 'assert';

import { CKGameState, Phase, GameStateData } from '../../rules/critterkitchen/CKGameState';
import {
    Item, ING_TYPES, CRITICS, RUMORS, ZOUS_CHEFS, RESTAURATEURS, CHALLENGES, challengeStars, trackStars,
    SOUP_PICK, locationsFor
} from '../../rules/critterkitchen/CKData';
import {
    evaluateChallenge, evaluateCritic, itemMap, scoreFinal, MealCtx, suggestCriticPlate, FinalInput
} from '../../rules/critterkitchen/CKMeals';
import { GameRuleTest } from '../GameRuleTest';

const IDS = ['a', 'b', 'c'];

function fresh(ids = IDS, seed = 11, opts: any = {}): CKGameState {
    const gs = new CKGameState(ids);
    gs.start_game({ seed, ...opts });
    return gs;
}

function rehydrate(gs: CKGameState, mutate: (d: GameStateData) => void): CKGameState {
    const d = JSON.parse(JSON.stringify(gs.get_data()));
    mutate(d);
    return CKGameState.from_data(d, gs.playerIdsList);
}

/** Drive every waiting player with the engine's auto-player until `stop` or game over. */
function autoplay(gs: CKGameState, stop: (gs: CKGameState) => boolean = () => false, limit = 5000) {
    for (let i = 0; i < limit && gs.phase() !== Phase.GameOver && !stop(gs); i++) {
        const w = gs.waitingOn();
        if (!w.length) throw new Error(`stuck in ${gs.phase()}`);
        gs.auto_act(w[0]);
    }
}

let nid = 1000;
const ing = (t: any, v: number): Item => ({ id: nid++, k: 'ing', t, v });
const spice = (t: any): Item => ({ id: nid++, k: 'spice', t });
const soup = (): Item => ({ id: nid++, k: 'soup' });
const bisque = (): Item => ({ id: nid++, k: 'bisque' });
const ctx = (critic: any = 'mouse', rest: any = null, rumorTokens = 0): MealCtx => ({ critic, rest, rumorTokens });

describe('Critter Kitchen', () => {

    describe('Type A: data', () => {
        it('has the full card list', () => {
            assert.equal(CRITICS.filter(c => !c.exp).length, 12);
            assert.equal(CRITICS.filter(c => c.exp).length, 4);
            assert.equal(RUMORS.length, 28);
            assert.equal(RUMORS.filter(r => r.fanatic).length, 7);
            assert.equal(ZOUS_CHEFS.filter(z => !z.exp).length, 12);
            assert.equal(RESTAURATEURS.filter(r => !r.exp).length, 10);
            assert.equal(CHALLENGES.length, 7);
            CHALLENGES.forEach(c => assert.equal(c.req.length, 3));
        });

        it('challenge star thresholds and the score track', () => {
            assert.deepEqual([5, 6, 11, 12, 20, 21, 40].map(challengeStars), [0, 1, 1, 2, 2, 4, 4]);
            assert.equal(trackStars(0), 0);
            assert.equal(trackStars(7), 1);
            assert.equal(trackStars(8), 2);
            assert.equal(trackStars(70), 10);
            assert.equal(trackStars(76), 11); // rulebook example
        });

        it('uses numbered locations by player count', () => {
            assert.deepEqual(locationsFor(2), ['soup', 'garden', 'desert', 'midnight', 'academy']);
            assert.deepEqual(locationsFor(5), ['soup', 'garden', 'desert', 'water', 'air', 'lantern', 'midnight', 'academy']);
        });
    });

    describe('Type A: meal maths', () => {
        it('scores the rulebook\'s Ultimate Melt example (quality 21 → 4★)', () => {
            const b = ing('bread', 2), f = ing('fish', 7), sb = spice('bread'), sf = spice('fish'), bq = bisque();
            const map = itemMap([b, f, sb, sf, bq]);
            const ev = evaluateChallenge({ slot: 0, ings: [{ id: b.id, spice: sb.id }, { id: f.id, spice: sf.id }], soups: [bq.id] },
                ['bread', 'fish', 'cheese'], map, ctx());
            assert.ok(ev.ok, ev.error);
            assert.equal(ev.quality, 21);
            assert.equal(ev.stars, 4);
        });

        it('requires at least one real ingredient and soup for each gap', () => {
            const s1 = soup(), s2 = soup(), c = ing('carrot', 6);
            const map = itemMap([s1, s2, c]);
            assert.ok(!evaluateChallenge({ slot: 0, ings: [], soups: [s1.id, s2.id] }, ['carrot', 'bread'], map, ctx()).ok);
            assert.ok(!evaluateChallenge({ slot: 0, ings: [{ id: c.id }], soups: [] }, ['carrot', 'bread'], map, ctx()).ok);
            const ok = evaluateChallenge({ slot: 0, ings: [{ id: c.id }], soups: [s1.id] }, ['carrot', 'bread'], map, ctx());
            assert.ok(ok.ok);
            assert.equal(ok.quality, 7);
        });

        it('rejects ingredients outside the requirements and mismatched spice', () => {
            const m = ing('meat', 5), f = ing('fish', 3), sf = spice('fish');
            const map = itemMap([m, f, sf]);
            assert.ok(!evaluateChallenge({ slot: 0, ings: [{ id: f.id }], soups: [] }, ['meat'], map, ctx()).ok);
            assert.ok(!evaluateChallenge({ slot: 0, ings: [{ id: m.id, spice: sf.id }], soups: [] }, ['meat'], map, ctx()).ok);
        });

        it('applies critic and restaurateur value rules', () => {
            const c6 = ing('carrot', 6), sc = spice('carrot');
            const map = itemMap([c6, sc]);
            const plate = { slot: 0, ings: [{ id: c6.id, spice: sc.id }], soups: [] };
            assert.equal(evaluateChallenge(plate, ['carrot'], map, ctx('kangaroo')).quality, 18);
            assert.equal(evaluateChallenge(plate, ['carrot'], map, ctx('rabbit')).quality, 24);
            assert.equal(evaluateChallenge(plate, ['carrot'], map, ctx('treeshrew')).quality, 18);
            const two = ing('carrot', 2);
            const m2 = itemMap([two]);
            // Goat'n Ramsay + Rabbit: (2 + 2) × 2
            assert.equal(evaluateChallenge({ slot: 0, ings: [{ id: two.id }], soups: [] }, ['carrot'], m2, ctx('rabbit', 'goat')).quality, 8);
        });

        it('Badger lets mushrooms stand in anywhere', () => {
            const mu = ing('mushroom', 5), sm = spice('meat');
            const map = itemMap([mu, sm]);
            const ev = evaluateChallenge({ slot: 0, ings: [{ id: mu.id, spice: sm.id }], soups: [] }, ['meat'], map, ctx('badger'));
            assert.ok(ev.ok, ev.error);
            assert.equal(ev.quality, 10);
        });

        it('evaluates a critic plate with Cow and Mouse course limits', () => {
            const c1 = ing('cheese', 5), c2 = ing('cheese', 4), c3 = ing('cheese', 3);
            const map = itemMap([c1, c2, c3]);
            const plate = { cheese: { ings: [{ id: c1.id }, { id: c2.id }, { id: c3.id }] } };
            assert.ok(!evaluateCritic(plate, map, ctx('poodle')).ok);
            assert.ok(evaluateCritic(plate, map, ctx('mouse')).ok);
            assert.ok(evaluateCritic(plate, map, ctx('cow')).ok);
        });

        it('scores rumors: Tender, Nocturnal, fanatics', () => {
            const b = ing('bread', 3), w = ing('wine', 7), sw = spice('wine');
            const map = itemMap([b, w, sw]);
            const ev = evaluateCritic({ bread: { ings: [{ id: b.id }] }, wine: { ings: [{ id: w.id, spice: sw.id }] } }, map, ctx('poodle'));
            assert.ok(ev.ok);
            const inp: FinalInput = { pid: 'x', ctx: ctx('poodle'), courses: ev.courses, soup: 0, rumorTokens: 0, leftovers: [], restStars: 0 };
            const [res] = scoreFinal([inp], ['tender', 'nocturnal', 'f_wine'], 'poodle');
            const n = (k: string) => (res.lines.find(l => l.key === k) || { n: 0 }).n;
            assert.equal(n('rumor_tender'), 3);
            assert.equal(n('rumor_nocturnal'), 5);
            assert.equal(res.quality, 3 + 28); // wine 14 doubled by the fanatic
            assert.equal(n('poodle'), 1);
        });

        it('suggests a valid critic plate', () => {
            const pool = [ing('bread', 7), ing('bread', 3), ing('fish', 6), spice('fish'), spice('all'), ing('wine', 2)];
            const plate = suggestCriticPlate(pool, ctx('poodle'));
            const ev = evaluateCritic(plate, itemMap(pool), ctx('poodle'));
            assert.ok(ev.ok, ev.error);
            assert.equal(ev.courses.find(c => c.type === 'bread')!.quality, 14); // allspice on the 7
            assert.equal(ev.courses.find(c => c.type === 'fish')!.quality, 12);
        });
    });

    describe('Type A: engine', () => {
        it('sets up a game', () => {
            const gs = fresh();
            const d = gs.get_data();
            assert.equal(gs.phase(), Phase.Restaurateur);
            assert.equal(d.round, 1);
            assert.equal(d.challenges.length, 6);
            assert.equal(d.rumorCards.length, 3);
            assert.equal(d.locItems.garden.length, 3);
            assert.equal(d.locItems.academy.filter(i => i.k === 'zous').length, 1);
            assert.equal(d.locItems.soup.filter(i => i.k === 'bisque').length, 1);
            IDS.forEach(id => assert.equal(gs.player(id).restOptions.length, 2));
            // 91 ingredients + 16 spices + 12 rumors, minus the restocked items
            const onBoard = d.locations.reduce((a, l) => a + d.locItems[l].filter(i => i.k !== 'zous' && i.k !== 'bisque').length, 0);
            assert.equal(d.bag.length + onBoard, 119);
        });

        it('rejects duplicate locations in a plan', () => {
            const gs = fresh(IDS, 3, { restaurateurs: false });
            assert.throws(() => gs.submit_plan('a', { mouse: 'garden', lizard: 'garden', boar: 'soup' } as any));
            assert.throws(() => gs.submit_plan('a', { mouse: 'garden', lizard: 'soup' } as any));
        });

        it('resolves queues: capacity order, then priority with the tie-winner moving back', () => {
            let gs = fresh(['a', 'b'], 5, { restaurateurs: false });
            gs = rehydrate(gs, d => {
                d.priority = ['a', 'b'];
                d.critic = 'poodle';
                d.locItems.garden = [
                    { id: 9001, k: 'ing', t: 'fish', v: 7 }, { id: 9002, k: 'ing', t: 'meat', v: 6 }, { id: 9003, k: 'ing', t: 'wine', v: 2 }
                ];
            });
            gs.submit_plan('a', { mouse: 'garden', lizard: 'soup', boar: 'desert' });
            gs.submit_plan('b', { mouse: 'garden', lizard: 'midnight', boar: 'academy' });
            // soup truck first: a's lizard is alone there
            while (gs.pending()!.loc === 'soup') gs.auto_act(gs.pending()!.pid);
            const pend = gs.pending()!;
            assert.equal(pend.loc, 'garden');
            assert.equal(pend.pid, 'a', 'a is ahead on the priority track');
            gs.pick('a', 9001);
            assert.deepEqual(gs.get_data().priority, ['b', 'a'], 'tie winner who took the first pick moves back');
            assert.equal(gs.pending()!.pid, 'b');
            gs.pick('b', 9002);
            // location resolved: the leftover wine moved on to the Chef Academy
            assert.equal(gs.get_data().locItems.garden.length, 0);
            assert.ok(gs.get_data().locItems.academy.some(i => i.id === 9003));
        });

        it('gives consolation soup to an empty-handed chef', () => {
            let gs = fresh(['a', 'b'], 9, { restaurateurs: false });
            gs = rehydrate(gs, d => { d.critic = 'poodle'; d.locItems.garden = []; });
            const before = gs.player('a').storage.filter(i => i.k === 'soup').length;
            gs.submit_plan('a', { mouse: 'garden', lizard: 'desert', boar: 'academy' });
            gs.submit_plan('b', { mouse: 'soup', lizard: 'midnight', boar: 'desert' });
            // advance until garden is done
            while (gs.pending() && gs.pending()!.loc === 'soup') gs.auto_act(gs.pending()!.pid);
            assert.ok(gs.player('a').storage.filter(i => i.k === 'soup').length >= before + 1);
        });

        it('lets a chef leave early and blocks known rumors', () => {
            let gs = fresh(['a', 'b'], 21, { restaurateurs: false });
            gs = rehydrate(gs, d => {
                d.critic = 'poodle';
                d.priority = ['a', 'b'];
                d.players.a.known = [true, false, false];
                d.locItems.garden = [{ id: 9101, k: 'rumor', r: 'q' }, { id: 9102, k: 'ing', t: 'bread', v: 3 }];
            });
            gs.submit_plan('a', { mouse: 'garden', lizard: 'desert', boar: 'academy' });
            gs.submit_plan('b', { mouse: 'soup', lizard: 'midnight', boar: 'desert' });
            while (gs.pending()!.loc === 'soup') gs.auto_act(gs.pending()!.pid);
            assert.equal(gs.pending()!.pid, 'a');
            assert.ok(gs.optionsFor('a', 'garden').indexOf(9101) === -1, 'known rumor is not offered');
            assert.throws(() => gs.pick('a', 9101));
            const soups = gs.player('a').storage.filter(i => i.k === 'soup').length;
            gs.leave_early('a');
            assert.equal(gs.player('a').storage.filter(i => i.k === 'soup').length, soups + 1);
        });

        it('wild rumors go to a chosen unknown slot', () => {
            let gs = fresh(['a', 'b'], 23, { restaurateurs: false });
            gs = rehydrate(gs, d => {
                d.critic = 'poodle';
                d.priority = ['a', 'b'];
                d.locItems.garden = [{ id: 9201, k: 'rumor', r: 'wild' }];
            });
            gs.submit_plan('a', { mouse: 'garden', lizard: 'desert', boar: 'academy' });
            gs.submit_plan('b', { mouse: 'soup', lizard: 'midnight', boar: 'desert' });
            while (gs.pending()!.loc === 'soup') gs.auto_act(gs.pending()!.pid);
            gs.pick('a', 9201, 2);
            assert.deepEqual(gs.player('a').known, [false, false, true]);
            assert.equal(gs.player('a').rumorTokens, 1);
        });

        it('moves leftovers to the Chef Academy and then to the Soup Truck', () => {
            let gs = fresh(['a', 'b'], 31, { restaurateurs: false });
            gs = rehydrate(gs, d => { d.critic = 'poodle'; });
            const gardenIds = gs.get_data().locItems.garden.filter(i => i.k !== 'rumor').map(i => i.id);
            gs.submit_plan('a', { mouse: 'soup', lizard: 'desert', boar: 'midnight' });
            gs.submit_plan('b', { mouse: 'soup', lizard: 'desert', boar: 'midnight' });
            autoplay(gs, g => g.round() === 2 && g.phase() === Phase.Planning);
            const truck = gs.get_data().locItems.soup.map(i => i.id);
            gardenIds.forEach(id => assert.ok(truck.indexOf(id) !== -1, 'unvisited garden goods end up on the truck'));
        });

        it('applies the hold token on the third challenge of each day', () => {
            const gs = fresh(IDS, 41, { restaurateurs: false });
            autoplay(gs, g => g.phase() === Phase.Challenge);
            const offered = gs.get_data().offered;
            assert.equal(offered.filter(o => !o.hippo).length, 3);
            assert.equal(offered[2].req.length, 2);
            assert.equal(offered[0].req.length, 3);
        });

        it('enforces the fridge limit after day 1', () => {
            let gs = fresh(IDS, 43, { restaurateurs: false });
            autoplay(gs, g => g.phase() === Phase.Challenge);
            gs = rehydrate(gs, d => {
                d.critic = 'poodle';
                for (let i = 0; i < 8; i++) d.players.a.storage.push({ id: 9300 + i, k: 'ing', t: 'bread', v: 4 });
            });
            IDS.forEach(id => gs.submit_challenges(id, []));
            assert.equal(gs.phase(), Phase.Fridge);
            assert.ok(gs.overLimit('a') > 0);
            assert.throws(() => gs.submit_fridge('a', []));
            const keep = gs.player('a').storage.filter(i => gs.countsForFridge(i));
            gs.submit_fridge('a', keep.slice(5).map(i => i.id));
            autoplay(gs, g => g.phase() === Phase.Planning);
            assert.equal(gs.player('a').storage.filter(i => gs.countsForFridge(i)).length, 5);
        });

        it('plays complete games for 2–5 players across many seeds', () => {
            for (let n = 2; n <= 5; n++) {
                for (let seed = 1; seed <= 12; seed++) {
                    const ids = ['p1', 'p2', 'p3', 'p4', 'p5'].slice(0, n);
                    const gs = fresh(ids, seed * 97 + n, { expansion: seed % 2 === 0 });
                    autoplay(gs);
                    assert.equal(gs.phase(), Phase.GameOver, `n=${n} seed=${seed}`);
                    const d = gs.get_data();
                    assert.equal(d.final!.length, n);
                    assert.equal(d.winners.length, 1);
                    ids.forEach(id => assert.ok(gs.player(id).stars >= 0));
                }
            }
        });

        it('plays every critic to the end', () => {
            CRITICS.forEach((c, i) => {
                let gs = fresh(['a', 'b', 'c'], 500 + i, { restaurateurs: false });
                gs = rehydrate(gs, d => {
                    d.critic = c.id;
                    if (c.id === 'hippo') d.hippoChallenge = CHALLENGES.find(x => d.challenges.indexOf(x.id) === -1)!.id;
                });
                autoplay(gs);
                assert.equal(gs.phase(), Phase.GameOver, c.id);
            });
        });

        it('plays every zous-chef', () => {
            ZOUS_CHEFS.forEach((z, i) => {
                let gs = fresh(['a', 'b', 'c'], 700 + i, { restaurateurs: false });
                gs = rehydrate(gs, d => { d.critic = 'poodle'; d.players.a.zous = [z.id]; });
                autoplay(gs, g => g.round() === 2);
                assert.ok(gs.round() >= 2, z.id);
            });
        });

        it('every restaurateur survives a full game', () => {
            RESTAURATEURS.forEach((r, i) => {
                const gs = fresh(['a', 'b'], 900 + i, { restaurateurs: true });
                const d = gs.get_data();
                d.players.a.restOptions = [r.id, r.id];
                gs.choose_restaurateur('a', r.id, 1);
                gs.auto_act('b');
                autoplay(gs);
                assert.equal(gs.phase(), Phase.GameOver, r.id);
            });
        });

        it('the Soup Truck always offers soup', () => {
            const gs = fresh(['a', 'b'], 77, { restaurateurs: false });
            assert.ok(gs.optionsFor('a', 'soup').indexOf(SOUP_PICK) !== -1);
        });

        it('lists all 7 course types', () => {
            assert.equal(ING_TYPES.length, 7);
        });
    });

    describe('Type B: integration (GameRuleTest)', () => {
        function gsFrom(test: GameRuleTest): CKGameState {
            const raw: any = test.getHostData('gameState');
            return typeof raw?.get_data === 'function' ? raw : CKGameState.from_data(raw.data, raw.playerIds);
        }

        function rig(clients = 2) {
            const test = new GameRuleTest('critterkitchen', clients);
            const props: Record<string, any> = {};
            const ids: string[] = [];
            for (let i = 0; i < clients; i++) {
                const cid = test.getPlayerClientId(i);
                ids.push(cid);
                (test as any).clientsGameObjects[i].setViewCallback((_v: string, p: any) => { props[cid] = p; });
            }
            const as = (id: string, method: string, ...args: any[]) => {
                const i = ids.indexOf(id);
                if (i === -1) test.invokeHostMethod(method, ...args);
                else test.invokeClientMethod(i, method, ...args);
            };
            return { test, props, ids, as };
        }

        it('refuses to start with fewer than 2 players', () => {
            const test = new GameRuleTest('critterkitchen', 0);
            assert.throws(() => test.invokeHostMethod('startGame'));
        });

        it('runs restaurateur choice and planning through RPCs, keeping storage private', () => {
            const { test, props, ids, as } = rig(2);
            test.invokeHostMethod('startGame');
            let gs = gsFrom(test);
            assert.equal(gs.phase(), Phase.Restaurateur);
            const all = gs.playerIdsList;
            all.forEach(pid => as(pid, 'chooseRestaurateur', gs.player(pid).restOptions[0], 0));
            gs = gsFrom(test);
            assert.equal(gs.phase(), Phase.Planning);
            const c = ids[0];
            const p = props[c];
            assert.ok(p.ck && p.me);
            assert.equal(p.ck.phase, Phase.Planning);
            assert.deepEqual(p.me.storage.map((i: Item) => i.id), gs.player(c).storage.map(i => i.id));
            // other players' storage is only a count
            const other = all.find(x => x !== c)!;
            assert.equal(typeof p.ck.players[other].storageCount, 'number');
            assert.equal(p.ck.players[other].storage, undefined);
            // plans stay secret until everyone has submitted
            as(c, 'submitPlan', { mouse: 'soup', lizard: 'garden', boar: 'desert' });
            assert.equal(props[ids[1]].ck.players[c].plan, undefined);
            assert.equal(props[ids[1]].ck.players[c].ready, true);
        });

        it('plays a whole game through the host auto-act', () => {
            const { test } = rig(2);
            test.invokeHostMethod('startGame');
            for (let i = 0; i < 4000; i++) {
                const gs = gsFrom(test);
                if (gs.phase() === Phase.GameOver) break;
                const w = gs.waitingOn();
                test.invokeHostMethod('autoAct', w[0]);
            }
            assert.equal(gsFrom(test).phase(), Phase.GameOver);
        });
    });
});
