/**
 * test_decorum.ts — Décorum tests.
 *   Library: the house model, condition language and scenario generator.
 *   Type A: the pure DecorumGameState engine.
 *   Type B: end-to-end via GameRuleTest (remote methods + per-client props).
 */

import { describe, it } from 'mocha';
import { strict as assert } from 'assert';

import {
    House, Move, Condition, LEVELS, emptyHouse, cloneHouse, applyMove, moveError, legalMoves, moveBetween,
    houseDistance, evaluate, describeText, generateScenario, auditScenario, parseScenarioCode, scenarioCode, conditionsPerSeat,
    countInZone, segmentsFor, heartsFor, selfishPlay, rng, Beds, switchOptions, applySwitch, switchError, describeSwitch,
    isRoommateCond, boardFor, randomBeds, twistError, pickTwists, TWIST_IDS, TWIST_GROUP, TwistId, isCatCond, roomBlocked,
    emptyMemo, nextMemo, describeTwists, countStyle
} from '../../rules/decorum/DecorumData';
import { DecorumGameState, Phase } from '../../rules/decorum/DecorumGameState';
import { GameRuleTest } from '../GameRuleTest';

const IDS2 = ['a', 'b'];
const IDS3 = ['a', 'b', 'c'];
const IDS4 = ['a', 'b', 'c', 'd'];

function fresh(ids: string[], seed = 11, level: any = 'medium', twists = false): DecorumGameState {
    const gs = new DecorumGameState(ids);
    gs.start_game({ level, seed, seatSeed: 3, twists });
    return gs;
}

/** Some legal move that is not a no-op, for burning turns (obeying the twists when `gs` is given). */
function anyMove(h: House, i = 0, gs?: DecorumGameState): Move {
    let moves = legalMoves(h);
    if (gs) {
        const seat = gs.seatOf(gs.activeId()!);
        moves = moves.filter(m => !twistError(gs.twists(), h, m, seat, gs.memo()));
    }
    return moves[i % moves.length];
}

/** Take a turn as whoever is active, reacting first when required. */
function turn(gs: DecorumGameState, i = 0) {
    const id = gs.activeId()!;
    if (gs.owesReaction(id)) gs.react(id, gs.lastAction()!.id, gs.twists().binary ? 'love' : 'meh');
    gs.act(id, anyMove(gs.house(), i, gs));
}

describe('Décorum', () => {
    describe('house model', () => {
        it('applies the four kinds of change and rejects illegal ones', () => {
            let h = emptyHouse('red');
            h = applyMove(h, { kind: 'add', room: 'bath', type: 'lamp', style: 'retro' });
            assert.equal(h.bath.lamp, 'retro');
            assert.ok(moveError(h, { kind: 'add', room: 'bath', type: 'lamp', style: 'modern' }));
            h = applyMove(h, { kind: 'swap', room: 'bath', type: 'lamp', style: 'modern' });
            assert.equal(h.bath.lamp, 'modern');
            assert.ok(moveError(h, { kind: 'swap', room: 'bath', type: 'lamp', style: 'modern' }), 'same object');
            h = applyMove(h, { kind: 'remove', room: 'bath', type: 'lamp' });
            assert.equal(h.bath.lamp, null);
            assert.ok(moveError(h, { kind: 'remove', room: 'bath', type: 'lamp' }));
            assert.ok(moveError(h, { kind: 'paint', room: 'kitchen', color: 'red' }), 'already red');
            h = applyMove(h, { kind: 'paint', room: 'kitchen', color: 'blue' });
            assert.equal(h.kitchen.wall, 'blue');
        });

        it('lists every legal move and recovers a move from two houses', () => {
            const h = emptyHouse('red');
            // 4 rooms × (3 paints + 3 slots × 4 adds)
            assert.equal(legalMoves(h).length, 4 * (3 + 12));
            legalMoves(h).forEach(m => {
                const after = applyMove(h, m);
                assert.equal(houseDistance(h, after), 1);
                assert.deepEqual(moveBetween(h, after), m);
            });
        });
    });

    describe('conditions', () => {
        const h: House = emptyHouse('yellow');
        h.bath = { wall: 'blue', hanging: 'modern', lamp: 'antique', curio: null };   // red hanging, yellow lamp
        h.bed = { wall: 'red', hanging: null, lamp: 'retro', curio: 'unusual' };      // red lamp, red curio
        h.living = { wall: 'green', hanging: null, lamp: null, curio: 'modern' };     // green curio
        h.kitchen = { wall: 'yellow', hanging: 'retro', lamp: null, curio: null };    // blue hanging

        const yes = (c: Condition) => assert.ok(evaluate(c, h), describeText(c));
        const no = (c: Condition) => assert.ok(!evaluate(c, h), describeText(c));

        it('counts features per zone', () => {
            assert.equal(countInZone(h, 'house', { f: 'object' }), 6);
            assert.equal(countInZone(h, 'house', { f: 'empty' }), 6);
            assert.equal(countInZone(h, 'up', { f: 'color', color: 'red' }), 3);
            assert.equal(countInZone(h, 'up', { f: 'feature', color: 'red' }), 4);
            assert.equal(countInZone(h, 'down', { f: 'featureTemp', warm: true }), 1);
            assert.equal(countInZone(h, 'left', { f: 'wallTemp', warm: false }), 2);
        });

        it('evaluates presence, absence and counts', () => {
            yes({ c: 'has', zone: 'bath', filter: { f: 'specific', type: 'lamp', style: 'antique' } });
            no({ c: 'has', zone: 'kitchen', filter: { f: 'type', type: 'lamp' } });
            yes({ c: 'not', zone: 'down', filter: { f: 'type', type: 'lamp' } });
            no({ c: 'not', zone: 'up', filter: { f: 'featureTemp', warm: false } });
            yes({ c: 'has', zone: 'kitchen', filter: { f: 'wall', color: 'yellow' } });
            yes({ c: 'count', zone: 'house', filter: { f: 'color', color: 'red' }, op: '>=', n: 3 });
            yes({ c: 'count', zone: 'house', filter: { f: 'type', type: 'hanging' }, op: '==', n: 2 });
            no({ c: 'count', zone: 'house', filter: { f: 'empty' }, op: '<=', n: 5 });
        });

        it('evaluates every-room, comparisons and majorities', () => {
            no({ c: 'every', zone: 'house', filter: { f: 'type', type: 'lamp' } });
            yes({ c: 'every', zone: 'up', filter: { f: 'type', type: 'lamp' } });
            yes({ c: 'more', zone: 'up', a: { f: 'temp', warm: true }, b: { f: 'temp', warm: false } });
            no({ c: 'more', zone: 'house', a: { f: 'type', type: 'curio' }, b: { f: 'type', type: 'lamp' } });
            yes({ c: 'most', zone: 'house', color: 'red' });       // red 4 (3 objects + 1 wall)
            yes({ c: 'most', zone: 'down', color: 'green' });      // green 2 (wall + curio) vs yellow 1, blue 1
            no({ c: 'most', zone: 'down', color: 'yellow' });
        });

        it('evaluates walls, inseparables, identical objects and wall matching', () => {
            no({ c: 'wallsSame', zone: 'up' });
            yes({ c: 'wallsDiff' });
            // lamps and red objects: bath lamp(yellow) no red? bath has red hanging → both; bed both; living neither; kitchen neither
            yes({ c: 'insep', a: { f: 'type', type: 'lamp' }, b: { f: 'color', color: 'red' } });
            no({ c: 'insep', a: { f: 'type', type: 'curio' }, b: { f: 'empty' } });
            yes({ c: 'noIdentical' });
            yes({ c: 'matchWall', zone: 'bed' });
            no({ c: 'matchWall', zone: 'house' });
        });

        it('describes every kind in plain English', () => {
            const samples: Condition[] = [
                { c: 'has', zone: 'kitchen', filter: { f: 'wall', color: 'blue' } },
                { c: 'not', zone: 'up', filter: { f: 'featureTemp', warm: true } },
                { c: 'count', zone: 'house', filter: { f: 'feature', color: 'green' }, op: '==', n: 1 },
                { c: 'every', zone: 'down', filter: { f: 'type', type: 'curio' } },
                { c: 'more', zone: 'house', a: { f: 'type', type: 'lamp' }, b: { f: 'type', type: 'curio' } },
                { c: 'most', zone: 'left', style: 'antique' },
                { c: 'insep', a: { f: 'color', color: 'blue' }, b: { f: 'empty' } },
                { c: 'noIdentical' }, { c: 'wallsDiff' }, { c: 'wallsSame', zone: 'right' }, { c: 'matchWall', zone: 'house' }
            ];
            const texts = samples.map(c => describeText(c));
            assert.equal(texts[0], 'The kitchen must be painted blue.');
            assert.equal(texts[1], 'The upstairs must not contain any warm colors (as objects or wall color).');
            assert.equal(texts[2], 'The house must contain exactly 1 green feature (object or wall).');
            assert.equal(texts[3], 'Both downstairs rooms must contain a curio.');
            assert.equal(texts[4], 'The house must contain more lamps than curios.');
            assert.equal(texts[6], 'In every room, blue objects and empty slots must be inseparable.');
            texts.forEach(t => assert.ok(/^[A-Z].*\.$/.test(t) && t.indexOf('undefined') === -1 && t.indexOf('feature feature') === -1, t));
        });
    });

    describe('scenario generator', () => {
        it('round-trips scenario codes', () => {
            const code = scenarioCode(3, 'hard', 123456789);
            assert.deepEqual(parseScenarioCode(code), { players: 3, level: 'hard', seed: 123456789, twists: true });
            assert.equal(parseScenarioCode('5E-1'), null);
            assert.equal(parseScenarioCode('nonsense'), null);
            assert.equal(parseScenarioCode(' 2x-zz ')!.level, 'expert');
        });

        it('is deterministic for a seed', () => {
            const a = generateScenario({ players: 3, level: 'medium', seed: 99 });
            const b = generateScenario({ players: 3, level: 'medium', seed: 99 });
            assert.deepEqual(a, b);
            const c = generateScenario({ players: 3, level: 'medium', seed: 100 });
            assert.notDeepEqual(a.cards, c.cards);
        });

        it('builds contradiction-free scenarios for 2, 3 and 4 players at every level', function () {
            this.timeout(60000);
            [2, 3, 4].forEach(players => LEVELS.forEach(level => {
                for (let seed = 1; seed <= 12; seed++) {
                    // one candidate is enough here: the guarantees hold for every candidate built
                    const s = generateScenario({ players, level, seed: seed * 7919, candidates: 1 });
                    const where = `${s.code}`;
                    assert.deepEqual(auditScenario(s), [], where);
                    assert.equal(s.cards.length, players, where);
                    assert.deepEqual(s.cards.map(c => c.length), conditionsPerSeat(players, level), where);
                    // the witness satisfies everything …
                    // (roommate conditions are judged for their owner, with everyone's bedrooms)
                    const sol = (seat: number) => s.solutionBeds ? { beds: s.solutionBeds, seat } : null;
                    const start = (seat: number) => s.setupBeds ? { beds: s.setupBeds, seat } : null;
                    s.cards.forEach((card, i) => card.forEach(c => assert.ok(evaluate(c, s.solution, sol(i)), `${where}: ${describeText(c)}`)));
                    // … every seat has work to do at the start …
                    s.cards.forEach((card, i) => assert.ok(card.some(c => !evaluate(c, s.setup, start(i))), `${where} seat ${i} starts fulfilled`));
                    // … and the start differs from the witness
                    assert.ok(houseDistance(s.setup, s.solution) > 0 || JSON.stringify(s.setupBeds) !== JSON.stringify(s.solutionBeds), where);
                }
            }));
        });

        it('makes harder levels score higher on average', function () {
            this.timeout(30000);
            const avg = (level: any) => {
                let sum = 0;
                for (let seed = 1; seed <= 8; seed++) sum += generateScenario({ players: 3, level, seed }).stats.score;
                return sum / 8;
            };
            const scores = LEVELS.map(avg);
            for (let i = 1; i < scores.length; i++) assert.ok(scores[i] > scores[i - 1], `scores ${scores.join(', ')}`);
        });

        it('defeats selfish play more often at harder levels', function () {
            this.timeout(60000);
            // independent play-outs (fresh randomness) where everyone only fixes their own card
            const rate = (level: any) => {
                let wins = 0;
                for (let seed = 1; seed <= 6; seed++) {
                    const s = generateScenario({ players: 2, level, seed: seed * 31 });
                    wins += selfishPlay(rng.makeRng(seed), s.setup, s.cards, 6).wins;
                }
                return wins / 6;
            };
            const easy = rate('easy'), hard = rate('hard'), expert = rate('expert');
            assert.ok(hard < easy && expert < easy, `selfish win rates ${easy} / ${hard} / ${expert}`);
            assert.ok(expert <= 0.6, `expert is won by selfish play ${expert * 100}% of the time`);
        });

        it('never repeats a condition within a scenario and keeps tier-3 kinds unique per card', function () {
            this.timeout(60000);
            for (let seed = 1; seed <= 20; seed++) {
                const s = generateScenario({ players: 4, level: 'expert', seed, candidates: 1 });
                // "your bedroom…" on two cards means two different bedrooms, so key relative conditions by seat
                const keys = s.cards.reduce<string[]>((a, c, seat) => a.concat(c.map(x => (isRoommateCond(x) ? `${seat}:` : '') + JSON.stringify(x))), []);
                assert.equal(new Set(keys).size, keys.length);
                s.cards.forEach(card => {
                    const kinds = card.map(c => c.c).filter(k => ['more', 'most', 'insep', 'noIdentical', 'wallsDiff'].indexOf(k) !== -1);
                    assert.equal(new Set(kinds).size, kinds.length);
                });
            }
        });
    });

    describe('roommates (3–4 players)', () => {
        const names = ['Ada', 'Ben', 'Cy', 'Dee'];
        const seatName = (i: number) => names[i];

        it('switches bedrooms, kicking someone out only when the other bedroom is full', () => {
            const beds: Beds = ['bath', 'bath', 'bed'];
            // seat 0 moves to the right bedroom (1 person there): no kick
            assert.deepEqual(switchOptions(beds, 0), [null]);
            assert.deepEqual(applySwitch(beds, { kind: 'switch', seat: 0, kick: null }), ['bed', 'bath', 'bed']);
            assert.ok(switchError(beds, { kind: 'switch', seat: 0, kick: 2 }), 'nobody needs kicking');
            // seat 2 moves into the full left bedroom: must kick seat 0 or 1, who takes the right bedroom
            assert.deepEqual(switchOptions(beds, 2), [0, 1]);
            assert.ok(switchError(beds, { kind: 'switch', seat: 2, kick: null }), 'must pick someone');
            assert.deepEqual(applySwitch(beds, { kind: 'switch', seat: 2, kick: 1 }), ['bath', 'bed', 'bath']);
            assert.equal(describeSwitch(beds, { kind: 'switch', seat: 2, kick: 1 }, seatName),
                'moved to the left bedroom, kicking Ben out to the right bedroom');
            // 4 players: always 2 + 2, so every switch kicks someone
            const b4: Beds = ['bath', 'bed', 'bath', 'bed'];
            [0, 1, 2, 3].forEach(seat => assert.equal(switchOptions(b4, seat).length, 2));
            assert.ok(switchError(null, { kind: 'switch', seat: 0, kick: null }), 'classic board has no bedrooms');
        });

        it('random bedrooms never put more than two in a room', () => {
            const r = rng.makeRng(4);
            for (let i = 0; i < 50; i++) {
                [3, 4].forEach(n => {
                    const b = randomBeds(r, n);
                    assert.equal(b.length, n);
                    assert.ok(b.filter(x => x === 'bath').length <= 2 && b.filter(x => x === 'bed').length <= 2);
                });
            }
        });

        it('evaluates conditions relative to their owner', () => {
            const h = emptyHouse('red');
            h.bath.lamp = 'retro';   // red retro lamp in the left bedroom
            h.bed.wall = 'blue';
            const beds: Beds = ['bath', 'bath', 'bed'];
            const mine: Condition = { c: 'has', zone: 'mine', filter: { f: 'type', type: 'lamp' } };
            assert.ok(evaluate(mine, h, { beds, seat: 0 }));
            assert.ok(!evaluate(mine, h, { beds, seat: 2 }), 'seat 2 sleeps in the right bedroom');
            assert.ok(!evaluate(mine, h), 'no context: false');
            const other: Condition = { c: 'has', zone: 'other', filter: { f: 'wall', color: 'blue' } };
            assert.ok(evaluate(other, h, { beds, seat: 1 }));
            assert.ok(!evaluate(other, h, { beds, seat: 2 }));
            assert.ok(evaluate({ c: 'with', seat: 1 }, h, { beds, seat: 0 }));
            assert.ok(!evaluate({ c: 'with', seat: 2 }, h, { beds, seat: 0 }));
            assert.ok(evaluate({ c: 'apart', seat: 2 }, h, { beds, seat: 0 }));
            assert.ok(evaluate({ c: 'alone' }, h, { beds, seat: 2 }));
            assert.ok(!evaluate({ c: 'alone' }, h, { beds, seat: 0 }));
            // a kick flips a card without touching furniture
            const after = applySwitch(beds, { kind: 'switch', seat: 2, kick: 0 });
            assert.ok(!evaluate(mine, h, { beds: after, seat: 0 }), 'seat 0 was kicked out of the lamp room');
            assert.ok(evaluate(mine, h, { beds: after, seat: 2 }));
            assert.ok(isRoommateCond(mine) && isRoommateCond({ c: 'alone' }) && !isRoommateCond({ c: 'wallsDiff' }));
        });

        it('words roommate conditions for the owner and for others', () => {
            const opts = { board: 'roommates' as const, seatName };
            assert.equal(describeText({ c: 'not', zone: 'mine', filter: { f: 'style', style: 'retro' } }, opts), 'Your bedroom must not contain any retro objects.');
            assert.equal(describeText({ c: 'with', seat: 1 }, opts), 'You must share a bedroom with Ben.');
            assert.equal(describeText({ c: 'with', seat: 1 }, { ...opts, owner: 'Cy' }), 'Cy must share a bedroom with Ben.');
            assert.equal(describeText({ c: 'has', zone: 'mine', filter: { f: 'type', type: 'lamp' } }, { ...opts, owner: 'Cy' }), "Cy's bedroom must contain a lamp.");
            assert.equal(describeText({ c: 'alone' }, opts), 'You must have a bedroom to yourself.');
            assert.equal(describeText({ c: 'has', zone: 'bath', filter: { f: 'type', type: 'lamp' } }, opts), 'The left bedroom must contain a lamp.');
            assert.equal(describeText({ c: 'has', zone: 'bath', filter: { f: 'type', type: 'lamp' } }), 'The bathroom must contain a lamp.');
        });

        it('generates roommate scenarios for 3–4 players only, with a roommate condition on every card', function () {
            this.timeout(60000);
            assert.equal(boardFor(2), 'classic');
            [3, 4].forEach(players => LEVELS.forEach(level => {
                for (let seed = 1; seed <= 4; seed++) {
                    const s = generateScenario({ players, level, seed: seed * 101, candidates: 1 });
                    assert.equal(s.board, 'roommates');
                    assert.deepEqual(auditScenario(s), [], s.code);
                    s.cards.forEach((card, i) => assert.ok(card.some(isRoommateCond), `${s.code} seat ${i}`));
                }
            }));
            const two = generateScenario({ players: 2, level: 'hard', seed: 3, candidates: 1 });
            assert.equal(two.board, 'classic');
            assert.equal(two.setupBeds, null);
            assert.ok(two.cards.every(card => !card.some(isRoommateCond)));
        });

        it('engine: switching rooms is a turn, validates kicks, and can fulfil or break cards', () => {
            const gs = fresh(IDS3, 21);
            const d = gs.get_data();
            assert.equal(gs.board(), 'roommates');
            assert.deepEqual(d.beds, d.scenario.setupBeds);
            const [p1, p2, p3] = gs.order();
            d.beds = ['bath', 'bath', 'bed'];
            assert.throws(() => gs.switch_rooms(p2, null), /turn/);
            assert.throws(() => gs.switch_rooms(p1, p2), /room/, 'right bedroom has space');
            // p1 wants to sleep in the right bedroom, with p3
            d.cards[p1] = [{ c: 'with', seat: 2 }];
            d.cards[p2] = [{ c: 'with', seat: 0 }];
            assert.ok(!gs.isFulfilled(p1) && gs.isFulfilled(p2));
            gs.switch_rooms(p1, null);
            assert.deepEqual(d.beds, ['bed', 'bath', 'bed']);
            assert.ok(gs.isFulfilled(p1), 'moving fulfils p1');
            assert.ok(!gs.isFulfilled(p2), '… and breaks p2 without touching furniture');
            const e = d.log[d.log.length - 1];
            assert.equal(e.kind, 'switch');
            assert.deepEqual(e.bedsBefore, ['bath', 'bath', 'bed']);
            assert.equal(gs.lastAction()!.id, e.id, 'reactions attach to switches');
            gs.react(p3, e.id, 'love');
            assert.equal(gs.activeId(), p2);
            // p2 moves into the now-full right bedroom and must kick p1 or p3
            assert.throws(() => gs.switch_rooms(p2, null), /kick/);
            assert.throws(() => gs.switch_rooms(p2, 'nobody'), /Unknown/);
            gs.switch_rooms(p2, p3);
            assert.deepEqual(d.beds, ['bed', 'bed', 'bath']);
            assert.ok(gs.isFulfilled(p2));
        });

        it('engine: 2 players have no bedrooms to switch', () => {
            const gs = fresh(IDS2);
            assert.equal(gs.beds(), null);
            assert.throws(() => gs.switch_rooms(gs.activeId()!, null), /bedrooms/);
        });
    });

    describe('house twists', () => {
        it('draws twists from the seed: more on harder levels, gentle ones on Easy, never two of a kind', () => {
            const gentle: TwistId[] = ['cat', 'heirloom', 'soldOut', 'binary'];
            let easyNone = 0;
            for (let seed = 1; seed <= 60; seed++) {
                const easy = pickTwists(seed, 'easy');
                assert.ok(easy.length <= 1 && easy.every(t => gentle.indexOf(t) !== -1));
                if (!easy.length) easyNone++;
                assert.equal(pickTwists(seed, 'medium').length, 1);
                assert.ok(pickTwists(seed, 'expert').length >= 2);
                LEVELS.forEach(level => {
                    const t = pickTwists(seed, level);
                    assert.equal(new Set(t.map(x => TWIST_GROUP[x])).size, t.length, 'one per group');
                    assert.deepEqual(t, pickTwists(seed, level), 'deterministic');
                });
            }
            assert.ok(easyNone > 10 && easyNone < 50, 'about half of Easy scenarios have no twist');
        });

        it('codes carry the no-twists flag, and twist-free seeds build the same scenario either way', () => {
            assert.equal(scenarioCode(3, 'hard', 42, false), '3H-16-N');
            assert.deepEqual(parseScenarioCode('3h-16-n'), { players: 3, level: 'hard', seed: 42, twists: false });
            assert.equal(parseScenarioCode('3H-16')!.twists, true);
            let seed = 1;
            while (pickTwists(seed, 'easy').length) seed++;
            const a = generateScenario({ players: 2, level: 'easy', seed, candidates: 1 });
            const b = generateScenario({ players: 2, level: 'easy', seed, candidates: 1, twists: false });
            assert.deepEqual(a.cards, b.cards);
            assert.deepEqual(a.setup, b.setup);
            assert.deepEqual(a.twists, {});
            assert.equal(b.code, a.code + '-N');
        });

        it('builds sound scenarios for every twist and player count', function () {
            this.timeout(120000);
            TWIST_IDS.forEach((id, k) => [2, 3, 4].forEach(players => {
                const s = generateScenario({ players, level: 'hard', seed: 300 + k * 17 + players, candidates: 1, twists: [id] });
                assert.deepEqual(auditScenario(s), [], `${id} ${s.code}`);
                assert.ok((s.twists as any)[id], id);
                if (id === 'cat') {
                    assert.ok(s.setup.pet && s.solution.pet);
                    assert.ok(s.cards.some(card => card.some(isCatCond)), 'someone cares about the cat');
                } else {
                    assert.ok(!s.setup.pet && s.cards.every(card => !card.some(isCatCond)));
                }
                if (id === 'heirloom') {
                    const x = s.twists.heirloom!;
                    assert.equal(s.setup[x.room][x.type], x.style);
                }
                if (id === 'shortage') assert.ok(countStyle(s.setup, s.twists.shortage!.style) <= s.twists.shortage!.max);
            }));
        });

        it('the selfish play-out obeys the twists', () => {
            const s = generateScenario({ players: 2, level: 'medium', seed: 77, candidates: 1, twists: ['keeper', 'noRepeat'] });
            const v = selfishPlay(rng.makeRng(1), s.setup, s.cards, 2, s.setupBeds, s.twists);
            assert.ok(v.rounds > 0);
        });

        it('locks and limits', () => {
            const h = emptyHouse('red');
            h.kitchen.lamp = 'retro';
            h.bath.curio = 'retro';
            const swapLamp: Move = { kind: 'swap', room: 'kitchen', type: 'lamp', style: 'modern' };
            assert.match(twistError({ heirloom: { room: 'kitchen', type: 'lamp', style: 'retro' } }, h, swapLamp, 0)!, /heirloom/);
            assert.match(twistError({ heirloom: { room: 'kitchen', type: 'lamp', style: 'retro' } }, h, { kind: 'remove', room: 'kitchen', type: 'lamp' }, 0)!, /heirloom/);
            assert.equal(twistError({ heirloom: { room: 'kitchen', type: 'lamp', style: 'retro' } }, h, { kind: 'paint', room: 'kitchen', color: 'blue' }, 0), null, 'the walls are fine');
            const keeper = { keeper: { room: 'kitchen' as const, seat: 1 } };
            assert.equal(twistError(keeper, h, swapLamp, 0, null, { seatName: () => 'Ben' }), 'Only Ben may change the kitchen');
            assert.equal(twistError(keeper, h, swapLamp, 1), null);
            assert.equal(twistError(keeper, h, { kind: 'cat', room: 'kitchen' }, 0), null, 'the cat may walk in');
            const shortage = { shortage: { style: 'retro' as const, max: 2 } };
            assert.match(twistError(shortage, h, { kind: 'add', room: 'bed', type: 'lamp', style: 'retro' }, 0)!, /shortage/);
            assert.equal(twistError(shortage, h, { kind: 'swap', room: 'kitchen', type: 'lamp', style: 'antique' }, 0), null);
            assert.match(twistError({ soldOut: { color: 'blue' } }, h, { kind: 'paint', room: 'bed', color: 'blue' }, 0)!, /sold out/);
            assert.equal(twistError({ soldOut: { color: 'blue' } }, h, { kind: 'paint', room: 'bed', color: 'green' }, 0), null);
            assert.ok(roomBlocked(keeper, 'kitchen', 0));
            assert.equal(roomBlocked(keeper, 'bath', 0), null);
        });

        it('turn rules look at recent turns', () => {
            const h = emptyHouse('red');
            let memo = emptyMemo(2);
            memo = nextMemo(memo, 0, 'bath');        // seat 0 changed the bathroom
            const paintBath: Move = { kind: 'paint', room: 'bath', color: 'blue' };
            assert.match(twistError({ wetPaint: true }, h, paintBath, 1, memo)!, /Wet paint/);
            assert.equal(twistError({ noRepeat: true }, h, paintBath, 1, memo), null, 'seat 1 did not change it');
            memo = nextMemo(memo, 1, 'kitchen');
            assert.equal(twistError({ wetPaint: true }, h, paintBath, 0, memo), null, 'someone else acted since');
            assert.match(twistError({ noRepeat: true }, h, paintBath, 0, memo)!, /last turn/);
            assert.equal(twistError({ noRepeat: true }, h, paintBath, 0, null), null, 'no memo: no turn rules');
            memo = nextMemo(memo, 0, null);          // seat 0 walked the cat
            assert.equal(twistError({ noRepeat: true }, h, paintBath, 0, memo), null);
        });

        it('the cat walks between neighbouring rooms, and cat conditions follow it', () => {
            const h = emptyHouse('red');
            assert.ok(moveError(h, { kind: 'cat', room: 'bed' }), 'no cat yet');
            h.pet = 'bath';
            h.bed.lamp = 'retro';
            assert.ok(moveError(h, { kind: 'cat', room: 'kitchen' }), 'not diagonally');
            assert.ok(legalMoves(h).some(m => m.kind === 'cat' && m.room === 'living'));
            const near: Condition = { c: 'catNear', filter: { f: 'type', type: 'lamp' } };
            assert.ok(!evaluate(near, h));
            const h2 = applyMove(h, { kind: 'cat', room: 'bed' });
            assert.equal(h2.pet, 'bed');
            assert.equal(h.pet, 'bath', 'immutable');
            assert.ok(evaluate(near, h2));
            assert.ok(evaluate({ c: 'catIn', zone: 'up' }, h2) && !evaluate({ c: 'catOut', zone: 'right' }, h2));
            assert.ok(!evaluate({ c: 'catIn', zone: 'up' }, emptyHouse()), 'no cat: false');
            assert.equal(cloneHouse(h2).pet, 'bed');
            const beds: Beds = ['bed', 'bath', 'bath'];
            assert.ok(evaluate({ c: 'catIn', zone: 'mine' }, h2, { beds, seat: 0 }) && !evaluate({ c: 'catIn', zone: 'mine' }, h2, { beds, seat: 1 }));
            assert.match(twistError({ cat: { avoid: 'red' } }, h, { kind: 'cat', room: 'bed' }, 0)!, /won't go/);
            assert.equal(describeText({ c: 'catIn', zone: 'kitchen' }), 'The cat must be in the kitchen.');
            assert.equal(describeText({ c: 'catOut', zone: 'up' }), 'The cat must not be upstairs.');
            assert.equal(describeText(near), "The cat's room must contain a lamp.");
            assert.equal(describeText({ c: 'catAway', filter: { f: 'wall', color: 'blue' } }), 'The cat must not be in a room painted blue.');
            assert.equal(describeText({ c: 'catIn', zone: 'mine' }, { board: 'roommates', owner: 'Ada' }), "The cat must be in Ada's bedroom.");
        });

        it('describes each twist for the reader', () => {
            const info = describeTwists({ keeper: { room: 'kitchen', seat: 1 }, cat: { avoid: 'blue' }, binary: true }, { seatName: i => i === 1 ? 'you' : 'Ada' });
            assert.deepEqual(info.map(t => t.id), ['cat', 'keeper', 'binary']);
            assert.equal(info[1].title, 'Your kitchen');
            assert.match(info[0].text, /painted blue/);
        });

        it('engine: enforces twists, walks the cat, and logs it', () => {
            const gs = fresh(IDS2, 5);
            const d = gs.get_data();
            const [p1, p2] = gs.order();
            d.scenario.twists = { cat: { avoid: 'blue' }, keeper: { room: 'kitchen', seat: 1 }, wetPaint: true, binary: true };
            d.house.pet = 'bath';
            d.house.bed.wall = 'blue';
            d.house.living.wall = 'red';
            d.house.kitchen.wall = 'red';
            assert.throws(() => gs.act(p1, { kind: 'paint', room: 'kitchen', color: 'green' }), /Only player 2/);
            assert.throws(() => gs.act(p1, { kind: 'cat', room: 'bed' }), /won't go/);
            gs.act(p1, { kind: 'cat', room: 'living' });
            assert.equal(gs.house().pet, 'living');
            const e = gs.lastAction()!;
            assert.equal(e.text, 'walked the cat from the bathroom to the living room');
            assert.throws(() => gs.react(p2, e.id, 'meh'), /neutral/);
            gs.react(p2, e.id, 'hate');
            gs.act(p2, { kind: 'paint', room: 'kitchen', color: 'green' });
            assert.deepEqual(gs.memo().prev, 'kitchen');
            gs.react(p1, gs.lastAction()!.id, 'love');
            assert.throws(() => gs.act(p1, { kind: 'paint', room: 'kitchen', color: 'yellow' }), /Only|Wet/);
            gs.act(p1, { kind: 'cat', room: 'kitchen' });
            assert.equal(gs.house().pet, 'kitchen', 'the cat ignores wet paint and keepers');
            assert.equal(gs.memo().prev, null, 'a cat walk changes no room');
        });
    });

    describe('Type A: engine', () => {
        it('starts with the scenario setup, seat cards and hearts', () => {
            [IDS2, IDS3, IDS4].forEach(ids => {
                const gs = fresh(ids);
                const d = gs.get_data();
                assert.equal(d.phase, Phase.Play);
                assert.equal(d.hearts, heartsFor(ids.length));
                assert.deepEqual(d.house, d.scenario.setup);
                d.order.forEach((id, i) => assert.deepEqual(d.cards[id], d.scenario.cards[i]));
                assert.equal(gs.activeId(), d.order[0]);
                assert.deepEqual([...d.order].sort(), [...ids].sort());
            });
        });

        it('refuses out-of-turn moves, illegal moves and unearned passes', () => {
            const gs = fresh(IDS3);
            const [p1, p2] = gs.order();
            assert.throws(() => gs.act(p2, anyMove(gs.house())), /turn/);
            const h = gs.house();
            const bad: Move = h.bath.lamp ? { kind: 'swap', room: 'bath', type: 'lamp', style: h.bath.lamp } : { kind: 'remove', room: 'bath', type: 'lamp' };
            assert.throws(() => gs.act(p1, bad));
            assert.throws(() => gs.act(p1, { kind: 'paint', room: 'bath', color: h.bath.wall }), /already/);
            assert.ok(!gs.isFulfilled(p1));
            assert.throws(() => gs.pass(p1), /pass/);
        });

        it('rotates turns and rounds and logs each change', () => {
            const gs = fresh(IDS3);
            const order = gs.order();
            turn(gs, 0); turn(gs, 1);
            assert.equal(gs.activeId(), order[2]);
            turn(gs, 2);
            assert.equal(gs.get_data().round, 2);
            assert.equal(gs.activeId(), order[0]);
            assert.equal(gs.get_data().log.length, 3);
            assert.ok(gs.get_data().log[0].text.length > 5);
        });

        it('2 players: the partner must react before acting, and only to the latest change', () => {
            const gs = fresh(IDS2);
            const [p1, p2] = gs.order();
            gs.act(p1, anyMove(gs.house()));
            assert.ok(gs.owesReaction(p2));
            assert.throws(() => gs.act(p2, anyMove(gs.house())), /React/);
            assert.throws(() => gs.react(p1, gs.lastAction()!.id, 'love'), /cannot/);
            assert.throws(() => gs.react(p2, 999, 'love'), /latest/);
            gs.react(p2, gs.lastAction()!.id, 'hate');
            assert.throws(() => gs.react(p2, gs.lastAction()!.id, 'love'), /cannot/);
            gs.act(p2, anyMove(gs.house(), 3));
            assert.equal(gs.activeId(), p1);
        });

        it('3–4 players: reactions are optional', () => {
            const gs = fresh(IDS4);
            turn(gs); turn(gs);
            const last = gs.lastAction()!;
            const other = gs.order().find(id => id !== last.by)!;
            gs.react(other, last.id, 'love');
            assert.equal(gs.lastAction()!.reactions[other], 'love');
        });

        it('wins as soon as everyone is fulfilled after an action, scoring hearts', () => {
            const gs = fresh(IDS3);
            const d = gs.get_data();
            // put the house one change away from the solution, then make that change
            const sol = d.scenario.solution;
            d.house = cloneHouse(sol);
            d.beds = d.scenario.solutionBeds ? [...d.scenario.solutionBeds] : null;
            const m = anyMove(sol, 5);
            d.house = applyMove(sol, m);
            const back = moveBetween(d.house, sol)!;
            gs.act(gs.activeId()!, back);
            assert.equal(gs.phase(), Phase.Done);
            const r = d.result!;
            assert.ok(r.won);
            const total = d.order.reduce((s, id) => s + d.cards[id].length, 0);
            assert.equal(r.conditionPoints, total * 3);
            assert.equal(r.heartPoints, heartsFor(3) * 2);
            assert.equal(r.score, r.maxScore);
        });

        it('lets a fulfilled player pass', () => {
            const gs = fresh(IDS4);
            const d = gs.get_data();
            const p1 = gs.activeId()!;
            // satisfy only p1 by tweaking their card to something already true
            d.cards[p1] = [{ c: 'has', zone: 'house', filter: { f: 'wall', color: d.house.bath.wall } }];
            gs.pass(p1);
            assert.ok(d.declared[p1]);
            assert.equal(d.log[d.log.length - 1].kind, 'pass');
            assert.notEqual(gs.phase(), Phase.Done);
        });

        it('2 players: Heart-to-Heart after round 15, then every 5, then the end', () => {
            const gs = fresh(IDS2, 5, 'expert');
            const d = gs.get_data();
            const play = (rounds: number) => { for (let i = 0; i < rounds * 2; i++) turn(gs, i); };
            play(15);
            assert.equal(gs.phase(), Phase.Meeting);
            assert.equal(d.meeting!.kind, 'h2h');
            const [p1, p2] = d.order;
            gs.meeting_share(p1, 0);
            assert.equal(gs.sharedWith(p2).length, 1);
            assert.equal(gs.phase(), Phase.Meeting);
            assert.throws(() => gs.meeting_share(p1, 1), /already/);
            gs.meeting_share(p2, 1);
            assert.equal(gs.phase(), Phase.Play);
            assert.equal(d.hearts, 2);
            assert.equal(d.round, 1);
            assert.equal(gs.activeId(), d.order[0]);
            play(5);
            assert.equal(gs.phase(), Phase.Meeting);
            gs.meeting_share(p1, 1); gs.meeting_share(p2, 0);
            play(5);
            gs.meeting_share(p1, 2); gs.meeting_share(p2, 2);
            assert.equal(d.hearts, 0);
            play(5);
            assert.equal(gs.phase(), Phase.Done);
            assert.equal(segmentsFor(2).reduce((a, b) => a + b, 0), 30);
            assert.ok(!d.result!.won);
            assert.equal(d.result!.heartPoints, 0);
        });

        it('3–4 players: House Meetings every 5 rounds with moods and chosen recipients', () => {
            const gs = fresh(IDS3, 8);
            const d = gs.get_data();
            for (let i = 0; i < 15; i++) turn(gs, i);
            assert.equal(gs.phase(), Phase.Meeting);
            assert.equal(d.meeting!.kind, 'house');
            const [a, b, c] = d.order;
            assert.throws(() => gs.meeting_mood(a, 'blame'), /housemate/);
            gs.meeting_mood(a, 'blame', b);
            gs.meeting_share(a, 0, c);
            assert.ok(!gs.meetingDone(b));
            assert.throws(() => gs.meeting_share(b, 0, b), /housemate/);
            gs.meeting_share(b, 0, a); gs.meeting_mood(b, 'close');
            gs.meeting_mood(c, 'lost'); gs.meeting_share(c, 1, a);
            assert.equal(gs.phase(), Phase.Play);
            assert.equal(d.hearts, 4);
            assert.equal(gs.sharedWith(a).length, 2);
            assert.equal(gs.sharedWith(c).length, 1);
            const m = d.log[d.log.length - 1];
            assert.equal(m.kind, 'meeting');
            assert.equal(m.meeting!.moods.length, 3);
        });

        it('lets everyone agree to hold the first meeting early (once)', () => {
            const gs = fresh(IDS3);
            const d = gs.get_data();
            turn(gs);
            d.order.forEach((id, i) => { if (i < 2) gs.vote_early(id, true); });
            gs.vote_early(d.order[1], false);
            gs.vote_early(d.order[1], true);
            assert.equal(gs.phase(), Phase.Play);
            gs.vote_early(d.order[2], true);
            assert.equal(gs.phase(), Phase.Meeting);
            assert.ok(d.meeting!.early);
            d.order.forEach((id, i) => { gs.meeting_mood(id, 'far'); gs.meeting_share(id, 0, d.order[(i + 1) % 3]); });
            assert.equal(d.segment, 1);
            assert.throws(() => gs.vote_early(d.order[0], true), /already/);
        });

        it('allows skipping a share only when nothing is left to share', () => {
            const gs = fresh(IDS2);
            const d = gs.get_data();
            for (let i = 0; i < 30; i++) turn(gs, i);
            const [p1] = d.order;
            assert.throws(() => gs.meeting_share(p1, null), /Pick/);
            d.shares = d.cards[p1].map((_, cond) => ({ from: p1, to: d.order[1], cond, meeting: 0 }));
            gs.meeting_share(p1, null);
            assert.ok(gs.meetingDone(p1));
        });
    });

    describe('Type B: integration (GameRuleTest)', () => {
        function gsFrom(test: GameRuleTest): DecorumGameState {
            const raw: any = test.getHostData('gameState');
            return typeof raw?.get_data === 'function' ? raw : DecorumGameState.from_data(raw.data, raw.playerIds);
        }

        function rig(clients = 2) {
            const test = new GameRuleTest('decorum', clients);
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

        it('refuses to start alone or with too many players', () => {
            assert.throws(() => new GameRuleTest('decorum', 0).invokeHostMethod('startGame'));
            assert.throws(() => new GameRuleTest('decorum', 4).invokeHostMethod('startGame'));
        });

        it('starts from a lobby code and keeps conditions private', () => {
            const { test, props, ids } = rig(2);
            test.invokeHostMethod('setOption', 'code', '3H-ABC');
            test.invokeHostMethod('startGame');
            const gs = gsFrom(test);
            const d = gs.get_data();
            assert.equal(d.scenario.code, '3H-ABC');
            assert.equal(d.scenario.level, 'hard');
            const c = ids[0];
            const p = props[c];
            assert.ok(p.dc && p.my);
            assert.equal(p.dc.cards, null);
            assert.equal(p.dc.solution, null);
            assert.deepEqual(p.my.card, d.cards[c]);
            const blob = JSON.stringify({ dc: p.dc, my: p.my });
            d.order.filter(id => id !== c).forEach(id => {
                d.cards[id].forEach(cond => {
                    if (d.cards[c].some(x => JSON.stringify(x) === JSON.stringify(cond))) return;
                    assert.ok(blob.indexOf(JSON.stringify(cond)) === -1, 'another player\'s condition leaked');
                });
            });
        });

        it('plays a move, a reaction, and shares only with the recipient', () => {
            const { test, props, ids, as } = rig(3);
            test.invokeHostMethod('setOption', 'level', 'easy');
            test.invokeHostMethod('startGame');
            let gs = gsFrom(test);
            const order = gs.order();
            const first = order[0];
            as(first, 'act', anyMove(gs.house(), 0, gs));
            gs = gsFrom(test);
            assert.equal(gs.get_data().log.length, 1);
            const reactor = order[1];
            as(reactor, 'react', gs.lastAction()!.id, 'love');
            gs = gsFrom(test);
            assert.equal(gs.lastAction()!.reactions[reactor], 'love');
            // play to the first house meeting
            for (let i = 1; i < 20; i++) {
                gs = gsFrom(test);
                if (gs.phase() !== Phase.Play) break;
                as(gs.activeId()!, 'act', anyMove(gs.house(), i, gs));
            }
            gs = gsFrom(test);
            assert.equal(gs.phase(), Phase.Meeting);
            const a = order[0];
            const [b, c] = ids.filter(id => id !== a);
            as(a, 'mood', 'close');
            as(a, 'share', 0, b);
            assert.equal(props[b].my.known.length, 1);
            assert.equal(props[c].my.known.length, 0);
            assert.equal(props[c].dc.meeting.shares.length, 1, 'who shared with whom is public');
        });

        it('roommates: publishes the bedrooms and switches rooms through the remote method', () => {
            const { test, props, ids, as } = rig(2);   // host + 2 clients = 3 players
            test.invokeHostMethod('startGame');
            let gs = gsFrom(test);
            const d = gs.get_data();
            const client = ids[0];
            assert.equal(props[client].dc.board, 'roommates');
            assert.deepEqual(props[client].dc.beds, d.beds);
            assert.equal(props[client].dc.solutionBeds, null, 'the solution stays secret');
            const mover = gs.activeId()!;
            const seat = gs.seatOf(mover);
            const opts = switchOptions(d.beds!, seat);
            const kick = opts[0] === null ? null : d.order[opts[0] as number];
            const before = [...d.beds!];
            as(mover, 'switchRooms', kick);
            gs = gsFrom(test);
            const e = gs.get_data().log[gs.get_data().log.length - 1];
            assert.equal(e.kind, 'switch');
            assert.notEqual(gs.get_data().beds![seat], before[seat]);
            assert.deepEqual(props[client].dc.beds, gs.get_data().beds);
            // other players get a toast naming the move
            const watcher = ids.find(id => id !== mover)!;
            assert.ok(/moved to the (left|right) bedroom/.test(props[watcher].toastNotification.message), props[watcher].toastNotification.message);
        });

        it('lets the host replay the same scenario and start a new one', () => {
            const { test } = rig(1);
            test.invokeHostMethod('startGame');
            const s1 = gsFrom(test).get_data().scenario;
            test.invokeHostMethod('replayScenario');
            const s2 = gsFrom(test).get_data().scenario;
            assert.equal(s2.code, s1.code);
            assert.deepEqual(s2.cards, s1.cards);
            test.invokeHostMethod('restartGame');
            const s3 = gsFrom(test).get_data().scenario;
            assert.equal(s3.level, s1.level);
            assert.notEqual(s3.code, s1.code);
        });
    });
});

