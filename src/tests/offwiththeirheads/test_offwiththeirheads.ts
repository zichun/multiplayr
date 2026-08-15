/**
 * test_offwiththeirheads.ts - Tests for "Off With Their Heads".
 */

import { describe, it } from 'mocha';
import { strict as assert } from 'assert';
import {
    OffWithTheirHeadsGameState as GameState,
    GameStateData, PlayerSheet, Card, Position, Zone,
    buildDeck, bestPokerHand, teaPartyVP, extraCounts,
    POSITION_ZONE, TREE_IDS, WOODS_EDGES, WOODS_NODES, MEADOW_DEF,
    KEEP_CELLS, KEEP_EDGES, KEEP_RED_ENTRANCE, KEEP_BLACK_ENTRANCE,
    woodsNeighbors, keepNeighbors
} from '../../rules/offwiththeirheads/OffWithTheirHeadsGameState';
import { GameRuleTest } from '../GameRuleTest';

const C = (rank: any, suit: any): Card => ({ rank, suit });

function freshData(players: string[]): GameStateData {
    return new GameState(players).get_data();
}

// Build a game in the Marking phase with a single controlled pending mark for 'a'
// ('b' left inactive so the bout does not advance and 'a's sheet stays inspectable).
function marking(opts: { card: Card; position: Position; zone?: Zone; sheetMut?: (s: PlayerSheet) => void }): GameState {
    const d = freshData(['a', 'b']);
    d.status = 'Marking';
    if (opts.sheetMut) opts.sheetMut(d.sheets['a']);
    d.marks['a'] = {
        card: opts.card, position: opts.position,
        queue: [{ kind: 'rank', zone: opts.zone || POSITION_ZONE[opts.position] }], done: false
    };
    d.marks['b'] = null;
    return GameState.from_data(d, ['a', 'b']);
}

describe('Off With Their Heads Game Logic', () => {
    describe('Type A: GameState Unit Tests', () => {

        describe('Board data integrity', () => {
            it('builds a 52-card deck', () => {
                const deck = buildDeck();
                assert.strictEqual(deck.length, 52);
                assert.strictEqual(new Set(deck.map(c => c.rank + c.suit)).size, 52);
            });

            it('Meadow mushrooms are 27/15/3/15/27 and total 22 spaces', () => {
                const vps = MEADOW_DEF.map(m => m.vp);
                assert.deepStrictEqual(vps, [27, 15, 3, 15, 27]);
                assert.strictEqual(MEADOW_DEF.reduce((s, m) => s + m.size, 0), 22);
            });

            it('Woods has 18 trees, six starred nodes summing to 36, and a March Hare centre', () => {
                assert.strictEqual(TREE_IDS.length, 18);
                const starred = WOODS_NODES.filter(n => n.starred);
                assert.strictEqual(starred.length, 6);
                assert.strictEqual(starred.reduce((s, n) => s + n.vp, 0), 36);
                assert.strictEqual(WOODS_NODES.filter(n => n.center).length, 1);
                // Every node's surrounding trees are pairwise adjacent (a real triangle).
                for (const n of WOODS_NODES) {
                    for (const t of n.trees) assert.ok(TREE_IDS.includes(t as any), `tree ${t} exists`);
                }
            });

            it('Keep maze: both entrances reach every cell (no orphaned cells)', () => {
                const adj: Record<string, string[]> = {};
                KEEP_CELLS.forEach(c => { adj[c.id] = keepNeighbors(c.id); });
                const seen = new Set<string>([KEEP_RED_ENTRANCE, KEEP_BLACK_ENTRANCE]);
                const q = [KEEP_RED_ENTRANCE, KEEP_BLACK_ENTRANCE];
                while (q.length) {
                    const cur = q.shift()!;
                    for (const n of adj[cur]) if (!seen.has(n)) { seen.add(n); q.push(n); }
                }
                assert.strictEqual(seen.size, KEEP_CELLS.length, 'all keep cells reachable');
            });

            it('extra-card counts follow the player-count rules', () => {
                assert.deepStrictEqual(extraCounts(4), { faceUp: 0, faceDown: 0 });
                assert.deepStrictEqual(extraCounts(3), { faceUp: 1, faceDown: 0 });
                assert.deepStrictEqual(extraCounts(2), { faceUp: 1, faceDown: 1 });
            });
        });

        describe('Setup', () => {
            it('deals 9 cards each and opens round 1 / bout 1 with the Queen on Hearts', () => {
                for (const n of [2, 3, 4]) {
                    const players = Array.from({ length: n }, (_, i) => `p${i}`);
                    const g = new GameState(players);
                    g.start_game();
                    const d = g.get_data();
                    assert.strictEqual(d.status, 'Selecting');
                    assert.strictEqual(d.round, 1);
                    assert.strictEqual(d.bout, 1);
                    assert.strictEqual(d.queenIndex, 0);
                    for (const p of players) assert.strictEqual(d.hands[p].length, 9);
                    assert.strictEqual(d.deck.length, 52 - 9 * n);
                }
            });

            it('rejects player counts outside 2-4', () => {
                assert.throws(() => new GameState(['a']).start_game(), /2 to 4/);
                assert.throws(() => new GameState(['a', 'b', 'c', 'd', 'e']).start_game(), /2 to 4/);
            });
        });

        describe('Ranking & positions (Wonderland Board)', () => {
            it('maps High/Mid/Low to Meadow/Woods/Keep using the suit hierarchy', () => {
                const d = freshData(['a', 'b']);
                d.status = 'Selecting';
                d.round = 1; d.bout = 1; d.queenIndex = 0; // Queen on Hearts: H > C > D > S
                d.hands['a'] = [C('A', 'H'), C('3', 'C')];
                d.hands['b'] = [C('2', 'S'), C('4', 'C')];
                d.deck = [C('5', 'C'), C('5', 'D')]; // two mid extras revealed into the bout
                d.selections = { a: null, b: null };
                d.marks = { a: null, b: null };
                const g = GameState.from_data(d, ['a', 'b']);

                g.select_card('a', 'AH');
                g.select_card('b', '2S');
                const s = g.get_data();
                assert.strictEqual(s.status, 'Marking');
                assert.strictEqual(s.reveal!.positions['a'], 'high', 'Ace of the top suit is high');
                assert.strictEqual(s.reveal!.positions['b'], 'low', 'lowest suit/rank is low');
                assert.strictEqual(s.marks['a']!.queue[0].zone, 'meadow');
                assert.strictEqual(s.marks['b']!.queue[0].zone, 'keep');
            });

            it('a top-suit card beats a higher number of a lower suit', () => {
                const d = freshData(['a', 'b']);
                d.status = 'Selecting'; d.queenIndex = 0; // Hearts top
                d.hands['a'] = [C('3', 'H')];
                d.hands['b'] = [C('9', 'S')];
                d.deck = [C('4', 'D'), C('5', 'D')];
                d.selections = { a: null, b: null }; d.marks = { a: null, b: null };
                const g = GameState.from_data(d, ['a', 'b']);
                g.select_card('a', '3H');
                g.select_card('b', '9S');
                assert.strictEqual(g.get_data().reveal!.positions['a'], 'high');
            });
        });

        describe('Marking — Meadow', () => {
            it('fills the leftmost space, colour must match, numbers unique per mushroom', () => {
                const g = marking({ card: C('5', 'H'), position: 'high' }); // red, meadow
                const legal = g.get_legal_targets('a');
                assert.ok(legal.meadow.includes('red_big'));
                assert.ok(!legal.meadow.includes('black_big'), 'red card cannot use a black mushroom');
                assert.ok(legal.meadow.includes('center'), 'the both-colour centre is legal');

                g.resolve_mark('a', { zone: 'meadow', spaceId: 'red_big' });
                const sheet = g.get_sheet('a');
                assert.strictEqual(sheet.meadow.find(m => m.id === 'red_big')!.marks[0], 5);
            });

            it('J/Q/K mark as 10 and an Ace marks as the chosen value', () => {
                const gk = marking({ card: C('K', 'D'), position: 'high' });
                gk.resolve_mark('a', { zone: 'meadow', spaceId: 'red_small' });
                assert.strictEqual(gk.get_sheet('a').meadow.find(m => m.id === 'red_small')!.marks[0], 10);

                const ga = marking({ card: C('A', 'H'), position: 'high' });
                assert.throws(() => ga.resolve_mark('a', { zone: 'meadow', spaceId: 'red_big' }), /1 or 11/);
                ga.resolve_mark('a', { zone: 'meadow', spaceId: 'red_big', aceValue: 1 });
                assert.strictEqual(ga.get_sheet('a').meadow.find(m => m.id === 'red_big')!.marks[0], 1);
            });
        });

        describe('Marking — teacups & biscuits', () => {
            it('marking a teacup tree advances the teacup stack', () => {
                const g = marking({ card: C('5', 'H'), position: 'mid' }); // woods; tree A is a red teacup tree
                g.resolve_mark('a', { zone: 'woods', spaceId: 'A' });
                const sheet = g.get_sheet('a');
                assert.strictEqual(sheet.woods['A'], 5);
                assert.strictEqual(sheet.teacups[1], 1, 'a second teacup became available');
            });

            it('a biscuit repeats the exact mark in a different zone (chaining queue)', () => {
                const g = marking({ card: C('7', 'H'), position: 'mid' }); // woods; tree J is a red biscuit tree
                g.resolve_mark('a', { zone: 'woods', spaceId: 'J' });
                const head = g.head_mark('a');
                assert.ok(head && head.kind === 'biscuit', 'a biscuit bonus is queued');
                assert.strictEqual(head!.value, 7);
                // The repeat must go into a DIFFERENT zone.
                assert.throws(() => g.resolve_mark('a', { zone: 'woods', spaceId: 'B' }), /different zone/i);
                g.resolve_mark('a', { zone: 'meadow', spaceId: 'red_big' });
                assert.strictEqual(g.get_sheet('a').meadow.find(m => m.id === 'red_big')!.marks[0], 7);
            });

            it('a teacup can flip a card colour to reach the other mushrooms', () => {
                const g = marking({ card: C('5', 'H'), position: 'high' }); // red card
                const flipTargets = g.get_teacup_color_targets('a');
                assert.ok(flipTargets.meadow.includes('black_big'), 'flipped to black unlocks a black mushroom');
                g.resolve_mark('a', { zone: 'meadow', spaceId: 'black_big', teacup: { mode: 'color' } });
                const sheet = g.get_sheet('a');
                assert.strictEqual(sheet.meadow.find(m => m.id === 'black_big')!.marks[0], 5);
                assert.strictEqual(sheet.teacups[0], 2, 'the top teacup was consumed');
            });

            it('a teacup can move a mark into a different zone entirely', () => {
                const g = marking({ card: C('5', 'H'), position: 'high' }); // forced Meadow
                const zt = g.get_teacup_zone_targets('a');
                assert.ok(zt.woods.length > 0, 'the Woods becomes available via the teacup');
                g.resolve_mark('a', { zone: 'woods', spaceId: zt.woods[0], teacup: { mode: 'zone' } });
                assert.notStrictEqual(g.get_sheet('a').woods[zt.woods[0]], null);
            });
        });

        describe('Marking — Keep & the Red Keep centre', () => {
            it('seeds a colour at its entrance, then extends by adjacency', () => {
                const g = marking({ card: C('4', 'H'), position: 'low' }); // red -> keep
                const legal = g.get_legal_targets('a');
                assert.deepStrictEqual(legal.keep, [KEEP_RED_ENTRANCE], 'first red mark must seed the red entrance');
                g.resolve_mark('a', { zone: 'keep', spaceId: KEEP_RED_ENTRANCE });
                assert.strictEqual(g.get_sheet('a').keep[KEEP_RED_ENTRANCE], 4);
            });

            it('marking the centre grants a free Meadow and a free Woods mark', () => {
                const g = marking({
                    card: C('6', 'H'), position: 'low',
                    sheetMut: (s) => { s.keep['c11'] = 3; } // c11 is adjacent to the centre c12
                });
                assert.ok(g.get_legal_targets('a').keep.includes('c12'));
                g.resolve_mark('a', { zone: 'keep', spaceId: 'c12' });
                // Two free marks are now queued (Meadow then Woods).
                let head = g.head_mark('a');
                assert.strictEqual(head!.kind, 'freeMeadow');
                g.resolve_mark('a', { zone: 'meadow', spaceId: 'black_big' }); // free: any colour allowed
                head = g.head_mark('a');
                assert.strictEqual(head!.kind, 'freeWoods');
                g.resolve_mark('a', { zone: 'woods', spaceId: 'E' }); // free: any colour tree
                const sheet = g.get_sheet('a');
                assert.strictEqual(sheet.keep['c12'], 6);
                assert.strictEqual(sheet.meadow.find(m => m.id === 'black_big')!.marks[0], 6);
                assert.strictEqual(sheet.woods['E'], 6);
            });
        });

        describe('Wonderlandians', () => {
            it('checks Humpty Dumpty when its adjacent Keep cell is marked', () => {
                const g = marking({
                    card: C('5', 'S'), position: 'low', // black card
                    sheetMut: (s) => { s.keep['c10'] = 2; } // c10 is adjacent to c20 (Humpty)
                });
                g.resolve_mark('a', { zone: 'keep', spaceId: 'c20' });
                assert.ok(g.get_sheet('a').guests.includes('humpty'));
            });

            it('checks the Dormouse when all four both-colour trees are marked', () => {
                const g = marking({
                    card: C('4', 'H'), position: 'mid',
                    sheetMut: (s) => { s.woods['C'] = 2; s.woods['H'] = 3; s.woods['L'] = 4; } // P still open
                });
                g.resolve_mark('a', { zone: 'woods', spaceId: 'P' });
                assert.ok(g.get_sheet('a').guests.includes('dormouse'));
            });
        });

        describe('Scoring', () => {
            it('Meadow scores only completed mushrooms', () => {
                const g = new GameState(['a', 'b']);
                const s = g.get_sheet('a');
                const centre = s.meadow.find(m => m.id === 'center')!;
                centre.marks = [3, 5]; // full (size 2)
                const red = s.meadow.find(m => m.id === 'red_small')!;
                red.marks[0] = 4; // incomplete
                assert.strictEqual(g.scoreMeadow(s).total, 3);
            });

            it('Woods: a lit node doubles under Jabberwock, not when a neighbour clashes', () => {
                const g = new GameState(['a', 'b']);
                const ok = g.get_sheet('a');
                ok.woods['A'] = 2; ok.woods['B'] = 3; ok.woods['F'] = 4; // node n_abf, all distinct
                const r1 = g.scoreWoods(ok);
                assert.ok(r1.jabberwock);
                assert.strictEqual(r1.total, 10, '5 base + 5 doubling');

                const clash = g.get_sheet('a');
                clash.woods['A'] = 2; clash.woods['B'] = 2; clash.woods['F'] = 4; // A-B adjacent, equal
                const r2 = g.scoreWoods(clash);
                assert.ok(!r2.jabberwock);
                assert.strictEqual(r2.total, 5, 'node still lit, but no doubling');
            });

            it('Woods: all 18 trees with no neighbour clash scores the full 102', () => {
                const g = new GameState(['a', 'b']);
                const s = g.get_sheet('a');
                // Greedy proper colouring -> guaranteed no two adjacent trees share a value.
                const val: Record<string, number> = {};
                for (const t of TREE_IDS) {
                    const used = new Set(woodsNeighbors(t).map(n => val[n]).filter(v => v !== undefined));
                    let v = 2; while (used.has(v)) v++;
                    val[t] = v; s.woods[t] = v;
                }
                const r = g.scoreWoods(s);
                assert.ok(r.all18);
                assert.ok(r.jabberwock);
                assert.strictEqual(r.total, 102);
            });

            it('Keep: coins score their numbers and the centre adds 2', () => {
                const g = new GameState(['a', 'b']);
                const s = g.get_sheet('a');
                s.keep['c02'] = 7; // a coin
                s.keep['c12'] = 9; // the centre
                const r = g.scoreKeep(s);
                assert.strictEqual(r.coinTotal, 7);
                assert.ok(r.center);
                assert.strictEqual(r.total, 9); // 7 + 2
            });

            it('Tea Party follows (guests+1)^2', () => {
                assert.strictEqual(teaPartyVP(0), 0);
                assert.strictEqual(teaPartyVP(1), 4);
                assert.strictEqual(teaPartyVP(3), 16);
                assert.strictEqual(teaPartyVP(7), 64);
            });
        });

        describe('Poker showdown', () => {
            it('recognises a flush, a straight, and a full house from 6 cards', () => {
                const flush = bestPokerHand([C('2', 'H'), C('5', 'H'), C('9', 'H'), C('J', 'H'), C('K', 'H'), C('3', 'S')]);
                assert.strictEqual(flush.category, 'flush');
                assert.strictEqual(flush.vp, 15);

                const straight = bestPokerHand([C('5', 'H'), C('6', 'C'), C('7', 'D'), C('8', 'S'), C('9', 'H'), C('2', 'C')]);
                assert.strictEqual(straight.category, 'straight');

                const full = bestPokerHand([C('7', 'H'), C('7', 'C'), C('7', 'D'), C('K', 'S'), C('K', 'H'), C('2', 'C')]);
                assert.strictEqual(full.category, 'fullhouse');
                assert.strictEqual(full.vp, 18);
            });

            it('an Ace-low wheel counts as a straight', () => {
                const wheel = bestPokerHand([C('A', 'H'), C('2', 'C'), C('3', 'D'), C('4', 'S'), C('5', 'H')]);
                assert.strictEqual(wheel.category, 'straight');
            });
        });

        describe('Bout & round flow', () => {
            it('advances the bout and the Queen once both players finish marking', () => {
                const d = freshData(['a', 'b']);
                d.status = 'Selecting'; d.round = 1; d.bout = 1; d.queenIndex = 0;
                d.hands['a'] = [C('A', 'H')];
                d.hands['b'] = [C('2', 'S')];
                d.deck = [C('5', 'C'), C('5', 'D'), C('6', 'C'), C('6', 'D')];
                d.selections = { a: null, b: null }; d.marks = { a: null, b: null };
                const g = GameState.from_data(d, ['a', 'b']);
                g.select_card('a', 'AH');
                g.select_card('b', '2S'); // reveal -> Marking

                // a is high (Meadow), b is low (Keep). Resolve each mandatory mark
                // (a's card is an Ace, so it needs a chosen value).
                g.resolve_mark('a', { zone: 'meadow', spaceId: g.get_legal_targets('a').meadow[0], aceValue: 11 });
                g.resolve_mark('b', { zone: 'keep', spaceId: g.get_legal_targets('b').keep[0] });

                const s = g.get_data();
                assert.strictEqual(s.status, 'Selecting');
                assert.strictEqual(s.bout, 2, 'advanced to bout 2');
                assert.strictEqual(s.queenIndex, 1, 'the Queen advanced one suit');
            });
        });
    });

    describe('Type B: Integration Tests', () => {
        const hostGS = (test: GameRuleTest): GameState => {
            const raw = test.getHostData('gameState');
            return GameState.from_data(raw.data, raw.playerIds);
        };

        it('starts a 2-player game with 9-card hands and reveals on the second pick', () => {
            const test = new GameRuleTest('offwiththeirheads', 1); // host + 1 client
            test.invokeHostMethod('startGame');
            const gs = hostGS(test);
            let s = gs.get_data();
            assert.strictEqual(s.playerIds.length, 2);
            assert.strictEqual(s.status, 'Selecting');
            const [host, client] = s.playerIds;
            assert.strictEqual(s.hands[host].length, 9);

            const hostCard = s.hands[host][0];
            test.invokeHostMethod('selectCard', `${hostCard.rank}${hostCard.suit}`);
            s = hostGS(test).get_data();
            assert.ok(s.selections[host], 'host locked in');
            assert.strictEqual(s.status, 'Selecting', 'still waiting on the client');

            const clientCard = s.hands[client][0];
            test.invokeClientMethod(0, 'selectCard', `${clientCard.rank}${clientCard.suit}`);
            assert.strictEqual(hostGS(test).get_data().status, 'Marking', 'both picked -> reveal');
        });

        it('plays a full bout through to the next selection phase', () => {
            const test = new GameRuleTest('offwiththeirheads', 1);
            test.invokeHostMethod('startGame');
            let s = hostGS(test).get_data();
            const [host, client] = s.playerIds;

            test.invokeHostMethod('selectCard', `${s.hands[host][0].rank}${s.hands[host][0].suit}`);
            s = hostGS(test).get_data();
            test.invokeClientMethod(0, 'selectCard', `${s.hands[client][0].rank}${s.hands[client][0].suit}`);

            // Resolve every pending mark (one per iteration) until the bout advances.
            for (let guard = 0; guard < 40; guard++) {
                const gs = hostGS(test);
                s = gs.get_data();
                if (s.status !== 'Marking') break;
                const pid = s.playerIds.find(p => s.marks[p] && !s.marks[p]!.done);
                if (!pid) break;
                const isHost = pid === host;
                const head = gs.head_mark(pid)!;
                const legal = gs.get_legal_targets(pid);
                const zone: Zone = legal.meadow.length ? 'meadow' : legal.woods.length ? 'woods' : 'keep';
                const spaceId = (legal as any)[zone][0];
                const invoke = (...args: any[]) => isHost
                    ? test.invokeHostMethod('resolveMark', ...args)
                    : test.invokeClientMethod(0, 'resolveMark', ...args);
                if (!spaceId) {
                    if (isHost) test.invokeHostMethod('skipMark'); else test.invokeClientMethod(0, 'skipMark');
                } else {
                    const ace = head.kind === 'rank' && s.marks[pid]!.card.rank === 'A' ? 11 : undefined;
                    invoke(zone, spaceId, ace);
                }
            }

            s = hostGS(test).get_data();
            assert.strictEqual(s.status, 'Selecting', 'bout resolved back to selection');
            assert.strictEqual(s.bout, 2);
            assert.strictEqual(s.queenIndex, 1);
        });

        it('rejects selecting out of phase', () => {
            const test = new GameRuleTest('offwiththeirheads', 1);
            test.invokeHostMethod('startGame');
            const s = hostGS(test).get_data();
            const [host] = s.playerIds;
            // Lock the host in, then a second host select of a now-missing card should throw.
            test.invokeHostMethod('selectCard', `${s.hands[host][0].rank}${s.hands[host][0].suit}`);
            assert.throws(() => test.invokeHostMethod('selectCard', 'ZZ'));
        });
    });
});
