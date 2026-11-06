/**
 * test_hooky.ts — Hooky tests.
 *   Type A: data tables + the pure HookyGameState engine.
 *   Type B: end-to-end via GameRuleTest (remote methods + per-client props).
 */

import { describe, it } from 'mocha';
import { strict as assert } from 'assert';

import { HookyGameState, Phase } from '../../rules/hooky/HookyGameState';
import {
    SETUPS, LETTERS, STUDENTS, countIn, isListed, anagramKey, wordSet, hookyPointsFor
} from '../../rules/hooky/HookyData';
import { GameRuleTest } from '../GameRuleTest';
import { nextMark, letterCounts, rowStatus, sheetIssues } from '../../rules/hooky/views/HookyNotes';

const IDS = ['a', 'b', 'c', 'd'];

function fresh(ids = IDS, seed = 7): HookyGameState {
    const gs = new HookyGameState(ids);
    gs.start_game({ seed });
    return gs;
}

/** A listed word holding at least one of `id`'s letters, for initial clues. */
function clueFor(gs: HookyGameState, id: string): string {
    const hand = gs.hand(id);
    for (const w of Array.from(wordSet())) if (countIn(w, hand) > 0) return w;
    throw new Error('no clue word');
}

/** Listed words never yet put to `target`. */
function freshWord(gs: HookyGameState, target: string, skip = 0): string {
    const used = gs.usedKeys(target);
    const all = Array.from(wordSet());
    let k = 0;
    for (const w of all) if (!used.has(anagramKey(w)) && k++ >= skip) return w;
    throw new Error('out of words');
}

function giveClues(gs: HookyGameState) {
    while (gs.phase() === Phase.Clue) {
        const id = gs.activeId()!;
        gs.give_clue(id, clueFor(gs, id));
    }
}

/** Play the current round: each player asks the next player; no reveals. */
function playRound(gs: HookyGameState) {
    const order = gs.order();
    const r = gs.get_data().round;
    while (gs.phase() === Phase.Ask && gs.get_data().round === r) {
        const id = gs.activeId()!;
        const target = order[(order.indexOf(id) + 1) % order.length];
        gs.ask(id, target, freshWord(gs, target));
        if (gs.activeId() === id) gs.end_turn(id);
    }
}

function guessAll(gs: HookyGameState, letters = ['A', 'B', 'C']) {
    gs.order().forEach(id => gs.guess_hooky(id, letters));
}

/** A final guess that names no correct letter for any opponent. */
function allWrong(gs: HookyGameState, id: string): Record<string, string[]> {
    const g: Record<string, string[]> = {};
    const n = gs.setup().hand;
    gs.order().filter(o => o !== id).forEach(o => { g[o] = LETTERS.filter(l => gs.hand(o).indexOf(l) === -1).slice(0, n); });
    return g;
}

function playToFinal(gs: HookyGameState) {
    giveClues(gs);
    while (gs.phase() !== Phase.Final) {
        if (gs.phase() === Phase.Ask) playRound(gs);
        else if (gs.phase() === Phase.Guess) guessAll(gs);
    }
}

describe('Hooky', () => {

    describe('Type A: data', () => {
        it('has 26 students and a big 5-letter word list', () => {
            assert.equal(LETTERS.length, 26);
            assert.equal(Object.keys(STUDENTS).length, 26);
            assert.ok(wordSet().size > 12000);
            assert.ok(isListed('plant') && isListed('NEVER') && !isListed('QZXWV'));
        });

        it('setups use all 26 cards', () => {
            for (const n of [3, 4, 5, 6]) {
                const s = SETUPS[n];
                assert.equal(n * s.hand + s.playground + 3, 26, `${n} players`);
                assert.equal(s.pgAtStart + s.pgAfter.length, s.playground, `${n}p playground reveals`);
                assert.equal(s.guessAfter[s.guessAfter.length - 1], s.rounds);
            }
        });

        it('counts each occurrence (rulebook examples)', () => {
            assert.equal(countIn('MIRTH', ['H', 'B', 'D']), 1);
            assert.equal(countIn('NEVER', ['N', 'E']), 3);
            assert.equal(countIn('DADDY', ['D', 'I', 'Q', 'R', 'S']), 3);
            assert.equal(countIn('AWARD', ['A']), 2);
        });

        it('scores 10 only for the final guess round', () => {
            assert.equal(hookyPointsFor(SETUPS[4], 4), 5);
            assert.equal(hookyPointsFor(SETUPS[4], 6), 10);
            assert.equal(hookyPointsFor(SETUPS[6], 3), 5);
            assert.equal(hookyPointsFor(SETUPS[6], 5), 10);
        });
    });

    describe('Type A: deduction sheet', () => {
        it('a tap cycles blank → has it → not it → maybe → blank', () => {
            assert.equal(nextMark(undefined), 'yes');
            assert.equal(nextMark('yes'), 'no');
            assert.equal(nextMark('no'), 'maybe');
            assert.equal(nextMark('maybe'), null);
        });

        it('focus grid counts every occurrence of a letter', () => {
            assert.deepEqual(letterCounts('NEVER'), { N: 1, E: 2, V: 1, R: 1 });
            assert.deepEqual(letterCounts('DADDY'), { D: 3, A: 1, Y: 1 });
        });

        // A 4-player view from 'me' (holds A–E); P1 has F face up; G is on the Playground.
        const stub = (pgHidden = 2): any => ({
            hk: {
                setup: SETUPS[4], playground: ['G'], playgroundHidden: pgHidden,
                players: ['me', 'p1', 'p2', 'p3'].map(id => ({ id, name: id.toUpperCase(), revealed: id === 'p1' ? ['F'] : [] }))
            },
            my: { me: 'me', hand: ['A', 'B', 'C', 'D', 'E'], peeks: [] }
        });

        it('sheet issues: a student ticked in two places', () => {
            const { hk, my } = stub();
            const r = sheetIssues(hk, my, { 'H|p2': 'yes', 'H|p3': 'yes' });
            assert.equal(r.rows.H, 'multi');
            assert.equal(r.messages.length, 1);
        });

        it('sheet issues: crossed off everywhere is fine while Playground cards are face down', () => {
            const cross = (l: string) => ({ [`${l}|p1`]: 'no', [`${l}|p2`]: 'no', [`${l}|p3`]: 'no', [`${l}|hooky`]: 'no' } as any);
            const { hk, my } = stub(2);
            const two = sheetIssues(hk, my, { ...cross('H'), ...cross('I') });
            assert.deepEqual(two.recess, ['H', 'I']);
            assert.equal(two.messages.length, 0);
            const three = sheetIssues(hk, my, { ...cross('H'), ...cross('I'), ...cross('J') });
            assert.equal(three.rows.J, 'none');
            assert.equal(three.messages.length, 1);
            const none = sheetIssues(stub(0).hk, my, cross('H'));
            assert.equal(none.rows.H, 'none');
        });

        it('sheet issues: too many ✓ or too many ✗ in a column', () => {
            const { hk, my } = stub();
            const over: any = {};
            'GHIJKLM'.split('').forEach(l => { over[`${l}|p2`] = 'yes'; });     // G is auto ✗ (Playground), so 6 ✓
            assert.equal(sheetIssues(hk, my, over).cols.p2, 'over');
            const under: any = {};
            'FGHIJKLMNOPQRSTUVWXY'.split('').forEach(l => { under[`${l}|p3`] = 'no'; });  // only Z left open (+ none mine)
            assert.equal(sheetIssues(hk, my, under).cols.p3, 'under');
            assert.equal(sheetIssues(hk, my, {}).messages.length, 0);
        });

        it('row status only reflects your own marks', () => {
            const marks: Record<string, any> = { N: 'yes', E: 'yes', V: 'no', R: 'no' };
            const m = (l: string) => marks[l] || null;
            assert.equal(rowStatus('NEVER', 3, m), 'done');      // N + E,E = 3, V/R ruled out
            assert.equal(rowStatus('NEVER', 2, m), 'bad');       // ✓s already make 3
            assert.equal(rowStatus('NEVER', 4, m), 'bad');       // only 3 letters left unruled
            assert.equal(rowStatus('NEVER', 3, (l: string) => (l === 'V' ? null : m(l))), '');   // V still blank
        });
    });

    describe('Type A: setup', () => {
        it('deals per player count without overlap', () => {
            for (const n of [3, 4, 5, 6]) {
                const ids = 'abcdef'.slice(0, n).split('');
                const gs = fresh(ids, n);
                const d = gs.get_data();
                const all = [...ids.flatMap(id => d.hands[id]), ...d.playground, ...d.hooky];
                assert.equal(new Set(all).size, 26);
                ids.forEach(id => assert.equal(d.hands[id].length, SETUPS[n].hand));
                assert.equal(d.pgShown, SETUPS[n].pgAtStart);
            }
        });

        it('6 players show 3 playground cards at setup', () => {
            const gs = fresh('abcdef'.split(''));
            assert.equal(gs.playgroundShown().length, 3);
            assert.equal(gs.get_data().log.filter(e => e.kind === 'playground').length, 3);
        });

        it('rejects too few or too many players', () => {
            assert.throws(() => fresh(['a', 'b']));
            assert.throws(() => fresh('abcdefg'.split('')));
        });
    });

    describe('Type A: clues & questions', () => {
        it('initial clue must hold an own letter and be a 5-letter word', () => {
            const gs = fresh();
            const id = gs.activeId()!;
            assert.throws(() => gs.give_clue(id, 'ABC'));
            const hand = new Set(gs.hand(id));
            const none = Array.from(wordSet()).find(w => w.split('').every(c => !hand.has(c)))!;
            assert.throws(() => gs.give_clue(id, none), /own letters/);
            assert.throws(() => gs.give_clue(gs.order()[1], clueFor(gs, gs.order()[1])), /turn/);
            gs.give_clue(id, clueFor(gs, id));
            const e = gs.get_data().log[0];
            assert.equal(e.count, countIn(e.word!, gs.hand(id)));
        });

        it('unlisted words need force, and are flagged', () => {
            const gs = fresh();
            const id = gs.activeId()!;
            const w = gs.hand(id)[0] + 'QQQQ';
            assert.throws(() => gs.give_clue(id, w), /word list/);
            gs.give_clue(id, w, true);
            assert.equal(gs.get_data().log[0].unlisted, true);
        });

        it('moves to round 1 after every clue', () => {
            const gs = fresh();
            giveClues(gs);
            assert.equal(gs.phase(), Phase.Ask);
            assert.equal(gs.get_data().round, 1);
            assert.equal(gs.activeId(), gs.order()[0]);
        });

        it('answers with the target count and blocks anagram repeats per target', () => {
            const gs = fresh();
            giveClues(gs);
            const [p0, p1, p2] = gs.order();
            gs.ask(p0, p1, 'NEVER');
            const e = gs.get_data().log[gs.get_data().log.length - 1];
            assert.equal(e.count, countIn('NEVER', gs.hand(p1)));
            assert.equal(gs.activeId(), p1);                     // round 1: turn ends after asking
            assert.throws(() => gs.ask(p1, p1, 'PLANT'), /another/);
            assert.throws(() => gs.ask(p2, p0, 'PLANT'), /turn/);
        });

        it('blocks anagrams to the same target by anyone', () => {
            const gs = fresh();
            giveClues(gs);
            const [p0, p1, p2] = gs.order();
            gs.ask(p0, p2, 'LEAST');                   // round 1: no reveal, turn auto-ends
            assert.equal(gs.activeId(), p1);
            assert.throws(() => gs.ask(p1, p2, 'STEAL'), /already/);
            gs.ask(p1, p2, 'PLANT');
        });
    });

    describe('Type A: reveal & peek', () => {
        it('is not available in round 1; turn auto-ends after asking', () => {
            const gs = fresh();
            giveClues(gs);
            const p0 = gs.activeId()!;
            assert.equal(gs.canReveal(p0), false);
            gs.ask(p0, gs.order()[1], 'PLANT');
            assert.notEqual(gs.activeId(), p0);
        });

        it('round 2+: reveal then ask, or ask then reveal / end turn', () => {
            const gs = fresh();
            giveClues(gs);
            playRound(gs);
            assert.equal(gs.get_data().round, 2);
            const [p0, p1, p2] = gs.order();
            assert.ok(gs.canReveal(p0));
            // ask first → turn waits for reveal or end
            gs.ask(p0, p1, freshWord(gs, p1));
            assert.equal(gs.activeId(), p0);
            const card = gs.hidden(p0)[0];
            const peek = gs.reveal(p0, card, p2);
            assert.ok(gs.hand(p2).indexOf(peek.letter) !== -1);
            assert.deepEqual(gs.get_data().revealed[p0], [card]);
            assert.equal(gs.activeId(), p1);                      // asked + revealed → next
            // reveal first → must still ask
            gs.reveal(p1, gs.hidden(p1)[0], p0);
            assert.equal(gs.activeId(), p1);
            assert.throws(() => gs.end_turn(p1), /Ask/);
            assert.throws(() => gs.reveal(p1, gs.hidden(p1)[0], p0), /cannot/);
            gs.ask(p1, p0, freshWord(gs, p0));
            assert.equal(gs.activeId(), p2);
            // ask then end turn
            gs.ask(p2, p0, freshWord(gs, p0));
            gs.end_turn(p2);
            assert.notEqual(gs.activeId(), p2);
        });

        it('peeks only at hidden cards; public log hides the peeked letter', () => {
            const gs = fresh();
            giveClues(gs);
            playRound(gs);
            const [p0, p1] = gs.order();
            const d = gs.get_data();
            d.revealed[p1] = gs.hand(p1).slice(0, gs.hand(p1).length - 1);   // leave one hidden
            const only = gs.hidden(p1)[0];
            gs.ask(p0, p1, freshWord(gs, p1));
            const card = gs.hidden(p0)[0];
            const peek = gs.reveal(p0, card, p1);
            assert.equal(peek.letter, only);
            const e = d.log[d.log.length - 1];
            assert.equal(e.kind, 'reveal');
            assert.equal(e.letter, card);                        // the revealed card, never the peeked one
            assert.equal(d.peeks[p0][0].letter, only);
        });

        it('cannot peek at someone with no hidden cards', () => {
            const gs = fresh();
            giveClues(gs);
            playRound(gs);
            const [p0, p1] = gs.order();
            gs.get_data().revealed[p1] = [...gs.hand(p1)];
            assert.equal(gs.peekTargets(p0).indexOf(p1), -1);
            assert.throws(() => gs.reveal(p0, gs.hidden(p0)[0], p1), /hidden/);
        });
    });

    describe('Type A: rounds, playground & guesses', () => {
        it('turns up playground cards after rounds 1–3 (4p)', () => {
            const gs = fresh();
            giveClues(gs);
            playRound(gs); assert.equal(gs.playgroundShown().length, 1);
            playRound(gs); assert.equal(gs.playgroundShown().length, 2);
            playRound(gs); assert.equal(gs.playgroundShown().length, 3);
            assert.equal(gs.get_data().round, 4);
            playRound(gs);
            assert.equal(gs.phase(), Phase.Guess);
            assert.equal(gs.playgroundShown().length, 3);
        });

        it('3 players: playground after rounds 1 and 2 only', () => {
            const gs = fresh(['a', 'b', 'c']);
            giveClues(gs);
            playRound(gs); playRound(gs); playRound(gs);
            assert.equal(gs.playgroundShown().length, 2);
        });

        it('hooky guesses need 3 distinct letters, once per round', () => {
            const gs = fresh();
            giveClues(gs);
            for (let i = 0; i < 4; i++) playRound(gs);
            const [p0] = gs.order();
            assert.throws(() => gs.guess_hooky(p0, ['A', 'A', 'B']));
            assert.throws(() => gs.guess_hooky(p0, ['A', 'B']));
            gs.guess_hooky(p0, ['a', 'b', 'c']);
            assert.throws(() => gs.guess_hooky(p0, ['D', 'E', 'F']), /locked/);
            assert.deepEqual(gs.lockedIn(), [p0]);
            gs.order().slice(1).forEach(id => gs.guess_hooky(id, ['A', 'B', 'C']));
            assert.equal(gs.phase(), Phase.Ask);
            assert.equal(gs.get_data().round, 5);
        });

        it('6 players: 5 rounds, guesses after rounds 3–5', () => {
            const gs = fresh('abcdef'.split(''));
            giveClues(gs);
            playRound(gs); playRound(gs);
            assert.equal(gs.playgroundShown().length, 5);
            playRound(gs);
            assert.equal(gs.phase(), Phase.Guess);
            assert.equal(gs.get_data().round, 3);
            playToFinal(gs);
            assert.equal(gs.get_data().round, 5);
        });
    });

    describe('Type A: final & scoring', () => {
        it('requires a full hand per opponent', () => {
            const gs = fresh();
            playToFinal(gs);
            const [p0, p1, p2, p3] = gs.order();
            assert.throws(() => gs.submit_final(p0, { [p1]: ['A'] }));
        });

        it('scores the rulebook way and ranks with tie-breaks', () => {
            const gs = fresh();
            giveClues(gs);
            const d = gs.get_data();
            const hk = d.hooky;
            const other = LETTERS.filter(l => hk.indexOf(l) === -1);
            while (gs.phase() !== Phase.Final) {
                if (gs.phase() === Phase.Ask) playRound(gs);
                else {
                    const r = d.round;
                    gs.order().forEach((id, i) => {
                        // player 0: 1 hit at round 4, 0 at 5, 2 at 6 → 5 + 0 + 20
                        if (i === 0) gs.guess_hooky(id, r === 4 ? [hk[0], other[0], other[1]] : r === 5 ? other.slice(0, 3) : [hk[0], hk[1], other[0]]);
                        else gs.guess_hooky(id, other.slice(0, 3));
                    });
                }
            }
            const [p0, p1, p2, p3] = gs.order();
            const exact = (id: string) => gs.hand(id);
            gs.submit_final(p0, { [p1]: exact(p1), [p2]: exact(p2), [p3]: [...exact(p3).slice(0, 4), hk[2]] });
            [p1, p2, p3].forEach(id => gs.submit_final(id, allWrong(gs, id)));
            assert.equal(gs.phase(), Phase.Done);
            const res = d.results!;
            const r0 = res.find(r => r.id === p0)!;
            assert.equal(r0.hookyPoints, 25);
            assert.equal(r0.handPoints, 14);
            assert.equal(r0.bonus, 2);
            assert.equal(r0.total, 41);
            assert.equal(r0.rank, 1);
            assert.equal(r0.firstHit, 4);
            // everyone else scored 0 and shares rank 2
            res.filter(r => r.id !== p0).forEach(r => { assert.equal(r.total, 0); assert.equal(r.rank, 2); });
        });

        it('tie-break: fewer reveals wins a dead heat', () => {
            const gs = fresh();
            playToFinal(gs);
            const d = gs.get_data();
            d.revealed[gs.order()[0]] = [gs.hand(gs.order()[0])[0]];
            gs.order().forEach(id => gs.submit_final(id, allWrong(gs, id)));
            const res = d.results!;
            // guesses were A,B,C for everyone, so Hooky points tie too
            const p0 = res.find(r => r.id === gs.order()[0])!;
            const others = res.filter(r => r.id !== gs.order()[0]);
            assert.ok(others.every(r => r.total === p0.total));
            assert.ok(others.every(r => r.rank < p0.rank));
        });
    });

    describe('Type B: integration (GameRuleTest)', () => {
        function gsFrom(test: GameRuleTest): HookyGameState {
            const raw: any = test.getHostData('gameState');
            return typeof raw?.get_data === 'function' ? raw : HookyGameState.from_data(raw.data, raw.playerIds);
        }

        function rig(clients = 3) {
            const test = new GameRuleTest('hooky', clients);
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

        it('refuses to start with fewer than 3 players', () => {
            const test = new GameRuleTest('hooky', 1);
            assert.throws(() => test.invokeHostMethod('startGame'));
        });

        it('plays a clue + question through RPCs and keeps hands private', () => {
            const { test, props, ids, as } = rig(3);
            test.invokeHostMethod('startGame');
            let gs = gsFrom(test);
            const first = gs.activeId()!;
            as(first, 'giveClue', clueFor(gs, first));
            gs = gsFrom(test);
            assert.equal(gs.get_data().log.length, 1);
            const c = ids[0];
            const p = props[c];
            assert.ok(p.hk && p.my);
            assert.deepEqual(p.my.hand, gs.hand(c));
            assert.equal(p.hk.hooky, null);
            assert.equal(p.hk.hands, null);
            const blob = JSON.stringify(p.hk);
            // no other player's hand leaks into the public props
            gs.order().filter(o => o !== c).forEach(o => {
                assert.ok(blob.indexOf(JSON.stringify(gs.hand(o))) === -1);
            });
        });
    });
});
