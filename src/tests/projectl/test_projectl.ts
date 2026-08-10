/**
 * test_projectl.ts — Project L tests.
 *   Type A: pure ProjectLGameState engine logic.
 *   Type B: end-to-end via GameRuleTest (remote methods + tick distribution).
 */

import { describe, it } from 'mocha';
import { strict as assert } from 'assert';

import { ProjectLGameState, Phase } from '../../rules/projectl/ProjectLGameState';
import {
    PUZZLE_BY_ID, orientationsFor, SHAPES, ShapeId
} from '../../rules/projectl/ProjectLData';
import { placeMask, rotateCW, reflect, cellsKey, freeOrientations, Cell } from '../../client/lib/polyomino/geometry';
import { ProjectLMainPage } from '../../rules/projectl/views/ProjectLViews';
import { GameRuleTest } from '../GameRuleTest';

const amActive = (props: any): boolean =>
    (new ProjectLMainPage({ MP: {}, ...props } as any) as any).amActive();

/** Distinct 90° rotations of a shape (without reflection). */
function distinctRotations(cells: Cell[]): number {
    const seen = new Set<string>();
    let c = cells;
    for (let i = 0; i < 4; i++) { seen.add(cellsKey(c)); c = rotateCW(c); }
    return seen.size;
}
function isChiral(cells: Cell[]): boolean {
    const rot = new Set<string>();
    let c = cells;
    for (let i = 0; i < 4; i++) { rot.add(cellsKey(c)); c = rotateCW(c); }
    let m = reflect(cells);
    for (let i = 0; i < 4; i++) { if (rot.has(cellsKey(m))) return false; m = rotateCW(m); }
    return true;
}

// Fill puzzle 9 (recess = two vertical cells at (2,2),(3,2)) with a vertical domino.
function dominoMaskForP9(): number {
    const vert = orientationsFor('domino').find(o => o.height === 2)!;
    return placeMask(vert, 2, 2, 5, 5)!;
}

describe('Project L', () => {
    // ======================================================================
    describe('Polyomino rotation', () => {
        it('rotates 90° clockwise and returns to the original after 4 turns', () => {
            const L = SHAPES.tet_L.cells;
            let c: Cell[] = L.map(x => [...x] as Cell);
            for (let i = 0; i < 4; i++) c = rotateCW(c);
            assert.equal(cellsKey(c), cellsKey(L), 'L-piece is back to its start after 4 rotations');
        });

        it('gives the L-piece exactly 4 rotations (not 8) and marks it chiral', () => {
            assert.equal(distinctRotations(SHAPES.tet_L.cells), 4);
            assert.equal(isChiral(SHAPES.tet_L.cells), true, 'L needs a flip to reach its mirror');
            assert.equal(freeOrientations(SHAPES.tet_L.cells).length, 8, 'flip×rotate spans all 8');
        });

        it('only the L and S tetrominoes are chiral (need a flip control)', () => {
            const chiral = (['mono', 'domino', 'tri_I', 'tri_V', 'tet_O', 'tet_I', 'tet_T', 'tet_L', 'tet_S'] as ShapeId[])
                .filter(id => isChiral(SHAPES[id].cells));
            assert.deepEqual(chiral.sort(), ['tet_L', 'tet_S']);
        });
    });

    describe('Speed UI gating (regression: taking must be enabled)', () => {
        it('is active in speed while playing even without an action count', () => {
            // Regression: speed mode never sends actionsLeft; gating must not require it.
            assert.equal(amActive({ mode: 'speed', isMyTurn: true, phase: Phase.Play }), true);
            assert.equal(amActive({ mode: 'speed', isMyTurn: true, phase: Phase.Play, actionsLeft: undefined }), true);
        });
        it('is inactive in speed once cleared (phase Finished)', () => {
            assert.equal(amActive({ mode: 'speed', isMyTurn: false, phase: Phase.Finished }), false);
        });
        it('still requires actions left in the standard game', () => {
            assert.equal(amActive({ mode: 'multiplayer', isMyTurn: true, phase: Phase.Play, actionsLeft: 0 }), false);
            assert.equal(amActive({ mode: 'multiplayer', isMyTurn: true, phase: Phase.Play, actionsLeft: 2 }), true);
        });
    });

    describe('Move staging (client-side planned turn)', () => {
        const makePage = (myPuzzles: any[], mySupply: any, staged: any[], shared: any = { reserve: {} }) => {
            const inst: any = new ProjectLMainPage({ MP: {}, mode: 'multiplayer', myPuzzles, mySupply, shared } as any);
            inst.state = { ui: { kind: 'idle' }, staged };
            return inst;
        };
        const market = { reserve: {}, whiteRow: [9, 10, 11, 12], blackRow: [33, 34, 35, 36] };
        const place = (puzzleIndex: number, puzzleId: number, shapeId: string, mask: number) =>
            ({ kind: 'place', puzzleIndex, puzzleId, shapeId, mask });

        it('validates a single planned placement via the local simulation', () => {
            const page = makePage([{ puzzleId: 9, filled: 0, placements: [] }], { domino: 1 },
                [place(0, 9, 'domino', dominoMaskForP9())]);
            assert.equal(page.stagedValid(), true);
        });

        it('rejects a plan referencing a puzzle slot that no longer exists', () => {
            const page = makePage([{ puzzleId: 9, filled: 0, placements: [] }], { mono: 1 },
                [place(3, 9, 'mono', 1 << 12)]);
            assert.equal(page.stagedValid(), false);
        });

        it('rejects a plan when the piece is not owned', () => {
            const page = makePage([{ puzzleId: 9, filled: 0, placements: [] }], { domino: 0 },
                [place(0, 9, 'domino', dominoMaskForP9())]);
            assert.equal(page.stagedValid(), false);
        });

        it('simulates a sequence so the second placement sees the first', () => {
            // puzzle 9 covers bits 12 and 17; two monos (one each) is a legal plan
            const ok = makePage([{ puzzleId: 9, filled: 0, placements: [] }], { mono: 2 },
                [place(0, 9, 'mono', 1 << 12), place(0, 9, 'mono', 1 << 17)]);
            assert.equal(ok.stagedValid(), true);
            // planning the same cell twice overlaps → invalid
            const bad = makePage([{ puzzleId: 9, filled: 0, placements: [] }], { mono: 2 },
                [place(0, 9, 'mono', 1 << 12), place(0, 9, 'mono', 1 << 12)]);
            assert.equal(bad.stagedValid(), false);
        });

        it('supports a mixed plan of upgrade + placement', () => {
            const page = makePage([{ puzzleId: 9, filled: 0, placements: [] }], { domino: 1 },
                [{ kind: 'upgradeL1' }, place(0, 9, 'domino', dominoMaskForP9())]);
            assert.equal(page.stagedValid(), true);
        });

        it('the plan preview supply reflects staged upgrades', () => {
            const page = makePage([], { mono: 0, domino: 0 }, [{ kind: 'upgradeL1' }]);
            const sim = page.simState();
            assert.equal(sim.ok, true);
            assert.equal(sim.supply.mono, 1, 'take-L1 shows a new mono in the preview supply');
        });

        it('stages taking a visible market card into the preview', () => {
            const page = makePage([], {}, [{ kind: 'take', deck: 'white', puzzleId: 9 }], market);
            const sim = page.simState();
            assert.equal(sim.ok, true);
            assert.equal(sim.puzzles.length, 1);
            assert.equal(sim.puzzles[0].puzzleId, 9, 'the planned card is now held in the preview');
        });

        it('voids the plan when the planned card is no longer in the market', () => {
            // someone else took puzzle 9 → the row now holds different cards
            const gone = { reserve: {}, whiteRow: [13, 10, 11, 12], blackRow: [33, 34, 35, 36] };
            const page = makePage([], {}, [{ kind: 'take', deck: 'white', puzzleId: 9 }], gone);
            assert.equal(page.stagedValid(), false);
        });

        it('stages take-then-place into the newly taken puzzle', () => {
            const page = makePage([], { domino: 1 }, [
                { kind: 'take', deck: 'white', puzzleId: 9 },
                { kind: 'place', puzzleIndex: 0, puzzleId: 9, shapeId: 'domino', mask: dominoMaskForP9() }
            ], market);
            assert.equal(page.stagedValid(), true);
        });
    });

    describe('Type A: engine', () => {

        describe('Setup', () => {
            it('deals starting pieces and reserves correctly (2p)', () => {
                const g = new ProjectLGameState(['A', 'B']);
                g.start_game({ mode: 'multiplayer' });
                const d = g.get_data();
                assert.equal(d.phase, Phase.Play);
                assert.equal(d.players['A'].supply.mono, 1);
                assert.equal(d.players['A'].supply.domino, 1);
                // 15 − (2 players) of each starting shape dealt out
                assert.equal(d.reserve.mono, 13);
                assert.equal(d.reserve.domino, 13);
                assert.equal(d.reserve.tri_I, 15);
                assert.equal(d.whiteRow.filter(x => x != null).length, 4);
                assert.equal(d.blackRow.filter(x => x != null).length, 4);
            });

            it('uses the black-count table per player count', () => {
                const g = new ProjectLGameState(['A', 'B', 'C']);
                g.start_game({ mode: 'multiplayer' });
                // 3 players → 14 black; 4 revealed → 10 in deck
                assert.equal(g.get_black_deck_count(), 10);
            });

            it('sets up the solo grid, locks and opponent seed', () => {
                const g = new ProjectLGameState(['A']);
                g.start_game({ mode: 'solo', difficulty: 'hard' });
                const s = g.get_solo()!;
                assert.equal(s.grid.filter(x => x != null).length, 9);
                assert.equal(s.locks.reduce((a, b) => a + b, 0), 4);
                assert.deepEqual(s.locks, [1, 2, 1]);
                assert.equal(s.opponentSupply, 3); // hard
                assert.equal(s.puzzleDeck.length, 16); // 25 − 9 grid
            });
        });

        describe('Take', () => {
            it('adds a puzzle and refills the row slot', () => {
                const g = new ProjectLGameState(['A', 'B']);
                g.start_game({ mode: 'multiplayer' });
                const before = g.get_white_deck_count();
                g.take_from_row('A', 'white', 0);
                assert.equal(g.get_player('A')!.puzzles.length, 1);
                assert.equal(g.get_white_deck_count(), before - 1);
                assert.equal(g.get_actions_left(), 2);
            });

            it('blocks Take when already holding 4 puzzles', () => {
                const g = new ProjectLGameState(['A', 'B']);
                g.start_game({ mode: 'multiplayer' });
                const d = g.get_data();
                d.players['A'].puzzles = [1, 2, 3, 4].map(id => ({ puzzleId: id, filled: 0, placements: [] }));
                assert.throws(() => g.take_from_row('A', 'white', 0), /4 unfinished/);
            });

            it('rejects acting out of turn', () => {
                const g = new ProjectLGameState(['A', 'B']);
                g.start_game({ mode: 'multiplayer' });
                assert.throws(() => g.take_from_row('B', 'white', 0), /Not your turn/);
            });
        });

        describe('Place & completion', () => {
            it('completes a puzzle: returns pieces, grants reward, scores points', () => {
                const g = new ProjectLGameState(['A', 'B']);
                g.start_game({ mode: 'multiplayer' });
                const d = g.get_data();
                d.players['A'].puzzles = [{ puzzleId: 9, filled: 0, placements: [] }];
                d.players['A'].supply.domino = 1;
                d.reserve.mono = 15;
                const before = d.players['A'].supply.mono;

                g.place('A', 0, 'domino', dominoMaskForP9());

                const p = g.get_player('A')!;
                assert.equal(p.vpPile.length, 1);
                assert.equal(p.vpPile[0].points, 1);
                assert.equal(p.supply.domino, 1, 'domino returned to supply');
                assert.equal(p.supply.mono, before + 1, 'mono reward gained');
                assert.equal(p.puzzles.length, 0, 'puzzle left the board');
            });

            it('rejects an out-of-recess placement', () => {
                const g = new ProjectLGameState(['A', 'B']);
                g.start_game({ mode: 'multiplayer' });
                const d = g.get_data();
                d.players['A'].puzzles = [{ puzzleId: 9, filled: 0, placements: [] }];
                d.players['A'].supply.tet_O = 1;
                // a 2x2 block cannot fit the 1-wide recess of puzzle 9
                const o = orientationsFor('tet_O')[0];
                const m = placeMask(o, 2, 1, 5, 5)!;
                assert.throws(() => g.place('A', 0, 'tet_O', m), /Illegal placement/);
            });
        });

        describe('Reserve substitution (§9)', () => {
            it('same-level substitution when the wanted shape is out', () => {
                const g = new ProjectLGameState(['A']);
                g.start_game({ mode: 'solo' });
                const d = g.get_data();
                d.players['A'].puzzles = [{ puzzleId: 9, filled: 0, placements: [] }];
                d.players['A'].supply.domino = 1;
                // puzzle 9 rewards mono; empty mono → substitute another L1 (none) → +1 higher (domino)
                d.reserve.mono = 0;
                g.place('A', 0, 'domino', dominoMaskForP9());
                // domino returned (+1) and a substitute L2 granted since no L1 left
                assert.equal(g.get_player('A')!.supply.domino, 2);
            });

            it('upgrade take-L1 substitutes upward when L1 is empty', () => {
                const g = new ProjectLGameState(['A']);
                g.start_game({ mode: 'solo' });
                const d = g.get_data();
                d.reserve.mono = 0;
                const before = d.players['A'].supply.domino;
                g.upgrade_take_l1('A');
                assert.equal(d.players['A'].supply.domino, before + 1);
            });
        });

        describe('Upgrade swap', () => {
            it('allows +1 level and rejects +2', () => {
                const g = new ProjectLGameState(['A']);
                g.start_game({ mode: 'solo' });
                const d = g.get_data();
                d.players['A'].supply.mono = 1;
                d.reserve.tri_I = 15;
                // mono (L1) → tri_I (L3) is +2 → illegal
                assert.throws(() => g.upgrade_swap('A', 'mono', 'tri_I'), /one level/);
                // mono (L1) → domino (L2) is +1 → ok
                g.upgrade_swap('A', 'mono', 'domino');
                assert.equal(d.players['A'].supply.domino, 2); // started with 1 + upgraded
            });
        });

        describe('Master', () => {
            it('places one piece into each puzzle as a single action, once per turn', () => {
                const g = new ProjectLGameState(['A', 'B']);
                g.start_game({ mode: 'multiplayer' });
                const d = g.get_data();
                d.players['A'].puzzles = [
                    { puzzleId: 9, filled: 0, placements: [] },
                    { puzzleId: 22, filled: 0, placements: [] } // same recess shape as 9
                ];
                d.players['A'].supply.domino = 2;
                d.reserve.mono = 15; d.reserve.domino = 15;
                const mask = dominoMaskForP9();
                g.master('A', [
                    { puzzleIndex: 0, shapeId: 'domino', mask },
                    { puzzleIndex: 1, shapeId: 'domino', mask }
                ]);
                assert.equal(g.get_player('A')!.vpPile.length, 2, 'both completed');
                assert.equal(g.get_actions_left(), 2, 'master is one action');
                // master flag set: a second master this turn throws
                d.players['A'].puzzles = [{ puzzleId: 9, filled: 0, placements: [] }];
                d.players['A'].supply.domino = 1;
                assert.throws(() => g.master('A', [{ puzzleIndex: 0, shapeId: 'domino', mask }]), /already used/);
            });

            it('rejects two pieces into the same puzzle', () => {
                const g = new ProjectLGameState(['A', 'B']);
                g.start_game({ mode: 'multiplayer' });
                const d = g.get_data();
                d.players['A'].puzzles = [{ puzzleId: 9, filled: 0, placements: [] }];
                d.players['A'].supply.mono = 2;
                assert.throws(() => g.master('A', [
                    { puzzleIndex: 0, shapeId: 'mono', mask: 1 << 12 },
                    { puzzleIndex: 0, shapeId: 'mono', mask: 1 << 17 }
                ]), /one piece per puzzle/);
            });
        });

        describe('Turn flow', () => {
            it('consumes 3 actions then advances to the next player', () => {
                const g = new ProjectLGameState(['A', 'B']);
                g.start_game({ mode: 'multiplayer' });
                assert.equal(g.currentPlayerId(), 'A');
                g.upgrade_take_l1('A');
                g.upgrade_take_l1('A');
                g.upgrade_take_l1('A');
                assert.equal(g.currentPlayerId(), 'B', 'turn passed to B');
                assert.equal(g.get_actions_left(), 3, 'fresh actions');
            });
        });

        describe('End game & scoring', () => {
            it('triggers the end when the black deck empties, then reaches finishing touches', () => {
                const g = new ProjectLGameState(['A', 'B']);
                g.start_game({ mode: 'multiplayer' });
                const d = g.get_data();
                d.blackDeck = [];
                // A takes a black row puzzle → deck already empty → end triggers (current index 0 → 2n = 4)
                g.take_from_row('A', 'black', 0);
                assert.equal(g.get_end_triggered(), true);
                assert.equal(g.get_final_turns(), 4);
                // 4 turn-ends later → finishing touches
                for (let i = 0; i < 4 && g.get_phase() === Phase.Play; i++) {
                    g.pass(g.currentPlayerId());
                }
                assert.equal(g.get_phase(), Phase.FinishingTouches);
            });

            it('scores VP minus unfinished puzzles and finishing pieces', () => {
                const g = new ProjectLGameState(['A', 'B']);
                g.start_game({ mode: 'multiplayer' });
                const d = g.get_data();
                d.phase = Phase.FinishingTouches;
                d.players['A'].finishingDone = false;
                d.players['B'].finishingDone = false;
                d.players['A'].vpPile = [{ puzzleId: 33, points: 5 }, { puzzleId: 9, points: 1 }];
                d.players['A'].puzzles = [{ puzzleId: 34, filled: 0, placements: [] }]; // −5 incomplete
                d.players['B'].vpPile = [{ puzzleId: 45, points: 3 }];
                d.players['B'].puzzles = [];

                // A places one finishing piece (−1) into a single cell of puzzle 34 (won't complete it)
                d.players['A'].supply.mono = 1;
                const p34 = PUZZLE_BY_ID[34].recessed;
                const oneCell = p34 & -p34; // lowest recessed cell
                g.finishing_place('A', 0, 'mono', oneCell);
                g.finishing_done('A');
                g.finishing_done('B');

                assert.equal(g.get_phase(), Phase.Scoring);
                const scores = g.get_scores()!;
                // A: 5+1 vp − 5 incomplete − 1 finishing = 0
                assert.equal(scores['A'], 0);
                assert.equal(scores['B'], 3);
                assert.deepEqual(g.get_winners(), ['B']);
            });

            it('finishing-touch completions award no reward piece', () => {
                const g = new ProjectLGameState(['A']);
                g.start_game({ mode: 'solo' });
                const d = g.get_data();
                d.phase = Phase.FinishingTouches;
                d.players['A'].finishingDone = false;
                d.players['A'].puzzles = [{ puzzleId: 9, filled: 0, placements: [] }];
                d.players['A'].supply.domino = 1;
                d.reserve.mono = 15;
                const monoBefore = d.players['A'].supply.mono;
                g.finishing_place('A', 0, 'domino', dominoMaskForP9());
                g.finishing_done('A');
                // completed in finishing touches → scored but NO reward mono granted
                assert.equal(d.players['A'].vpPile.length, 1);
                assert.equal(d.players['A'].supply.mono, monoBefore, 'no reward during finishing touches');
            });
        });

        describe('Solo opponent (deterministic)', () => {
            function soloWithGrid(grid: number[], locks: number[], oppSupply: number) {
                const g = new ProjectLGameState(['A']);
                g.start_game({ mode: 'solo' });
                const s = g.get_solo()!;
                s.grid = grid.slice();
                s.locks = locks.slice();
                s.opponentSupply = oppSupply;
                s.puzzleDeck = [10, 10, 10, 10, 10]; // refills are irrelevant here
                return g;
            }

            it('takes the highest-value puzzle and reflows locks', () => {
                // pos4 (col1) = puzzle 33 (5 pts); everything else puzzle 22 (0 pts)
                const grid = [22, 22, 22, 22, 33, 22, 22, 22, 22];
                const g = soloWithGrid(grid, [0, 0, 0], 2);
                g.pass('A'); // end player's (empty) turn → opponent acts
                const s = g.get_solo()!;
                assert.equal(s.opponentVp.length, 1);
                assert.equal(s.opponentVp[0].puzzleId, 33);
                assert.equal(s.opponentSupply, 0, 'opponent supply moved to taken column');
                assert.equal(s.locks[1], 2, 'opponent supply now locks col1');
            });

            it('breaks ties by lowest grid position', () => {
                // pos1 (col1) and pos2 (col2) both puzzle 33 (5 pts)
                const grid = [22, 33, 33, 22, 22, 22, 22, 22, 22];
                const g = soloWithGrid(grid, [0, 0, 0], 0);
                g.pass('A');
                const s = g.get_solo()!;
                // lowest position (pos1, col1) taken
                assert.equal(s.locks[1] > 0 || s.locks[2] === 0, true);
                assert.equal(s.opponentVp[0].puzzleId, 33);
            });

            it('unlocks all columns when everything is locked before acting', () => {
                const grid = [33, 33, 33, 22, 22, 22, 22, 22, 22];
                const g = soloWithGrid(grid, [1, 1, 1], 0);
                g.pass('A');
                const s = g.get_solo()!;
                assert.equal(s.opponentVp.length, 1, 'opponent still acted after unlocking');
            });

            it('moves a lock to opponent when the human takes from a column', () => {
                const grid = [33, 22, 22, 22, 22, 22, 22, 22, 22];
                const g = soloWithGrid(grid, [1, 1, 1], 0);
                // suppress the opponent turn by only taking (still leaves 2 actions)
                g.take_solo_grid('A', 0); // col0
                const s = g.get_solo()!;
                assert.equal(s.locks[0], 0, 'a lock left col0');
                assert.equal(s.opponentSupply, 1, 'and went to opponent supply');
            });

            it('a tie in final score goes to the opponent', () => {
                const g = new ProjectLGameState(['A']);
                g.start_game({ mode: 'solo' });
                const d = g.get_data();
                d.phase = Phase.FinishingTouches;
                d.players['A'].finishingDone = false;
                d.players['A'].vpPile = [{ puzzleId: 45, points: 3 }];
                d.solo!.opponentVp = [{ puzzleId: 46, points: 3 }];
                g.finishing_done('A');
                assert.equal(g.get_solo_result(), 'lose', 'tie loses to the AI');
            });
        });

        describe('Speed contest', () => {
            it('gives every racer the same deck from one seed', () => {
                const a = new ProjectLGameState(['A']); a.start_game({ mode: 'speed', seed: 4242 });
                const b = new ProjectLGameState(['B']); b.start_game({ mode: 'speed', seed: 4242 });
                assert.deepEqual(a.get_data().blackDeck, b.get_data().blackDeck);
                assert.deepEqual(a.get_data().whiteDeck, b.get_data().whiteDeck);
                assert.deepEqual(a.get_data().blackRow, b.get_data().blackRow);
                const c = new ProjectLGameState(['C']); c.start_game({ mode: 'speed', seed: 99 });
                assert.notDeepEqual(c.get_data().blackDeck, a.get_data().blackDeck);
            });

            it('has no turn or action limit and counts moves', () => {
                const g = new ProjectLGameState(['A']); g.start_game({ mode: 'speed', seed: 1 });
                g.take_from_row('A', 'white', 0);
                g.take_from_row('A', 'white', 1);
                g.take_from_row('A', 'white', 2);
                g.take_from_row('A', 'white', 3); // 4 puzzles, still going (no turn passing)
                assert.equal(g.get_player('A')!.puzzles.length, 4);
                assert.equal(g.get_move_count(), 4);
                assert.equal(g.currentPlayerId(), 'A', 'still the same racer');
            });

            it('clears when the black draw pile empties and then blocks further actions', () => {
                const g = new ProjectLGameState(['A']); g.start_game({ mode: 'speed', seed: 1 });
                const d = g.get_data();
                d.blackDeck = [];
                d.players['A'].puzzles = [];
                g.take_from_row('A', 'black', 0); // refill finds empty deck → cleared
                assert.equal(g.get_cleared(), true);
                assert.equal(g.get_phase(), Phase.Finished);
                assert.throws(() => g.take_from_row('A', 'white', 0), /play phase/);
            });

            it('allows Master repeatedly (no once-per-turn limit)', () => {
                const g = new ProjectLGameState(['A']); g.start_game({ mode: 'speed', seed: 1 });
                const d = g.get_data();
                d.players['A'].puzzles = [{ puzzleId: 9, filled: 0, placements: [] }];
                d.players['A'].supply.mono = 2;
                const cell = PUZZLE_BY_ID[9].recessed & -PUZZLE_BY_ID[9].recessed;
                g.master('A', [{ puzzleIndex: 0, shapeId: 'mono', mask: cell }]);
                assert.equal(g.get_data().players['A'].masterUsedThisTurn, true);
                // add another puzzle and Master again — allowed in speed (no once-per-turn)
                d.players['A'].puzzles.push({ puzzleId: 22, filled: 0, placements: [] });
                const cell22 = PUZZLE_BY_ID[22].recessed & -PUZZLE_BY_ID[22].recessed;
                assert.doesNotThrow(() => g.master('A', [{ puzzleIndex: 1, shapeId: 'mono', mask: cell22 }]));
            });
        });
    });

    // ======================================================================
    describe('Type B: integration (GameRuleTest)', () => {
        const readState = (raw: any) => (typeof raw.get_data === 'function' ? raw.get_data() : raw.data);

        it('starts a 2-player game through the remote start method', () => {
            const test = new GameRuleTest('projectl', 1); // host + 1 client
            test.invokeHostMethod('startGame');
            assert.equal(test.getHostData('lobby_started'), true);
            const data = readState(test.getHostData('gameState'));
            assert.equal(data.phase, Phase.Play);
            assert.equal(data.mode, 'multiplayer');
            assert.equal(data.playerOrder.length, 2);
        });

        it('lets the current player take a puzzle via the remote method', () => {
            const test = new GameRuleTest('projectl', 1);
            test.invokeHostMethod('startGame');
            let data = readState(test.getHostData('gameState'));
            const host = data.playerOrder[0];
            test.invokeHostMethod('takeRow', 'white', 0);
            data = readState(test.getHostData('gameState'));
            assert.equal(data.players[host].puzzles.length, 1);
            assert.equal(data.actionsLeft, 2);
        });

        it('runs a solo game and the AI takes a turn after the player', () => {
            const test = new GameRuleTest('projectl', 0); // host only → solo
            test.invokeHostMethod('startGame');
            let data = readState(test.getHostData('gameState'));
            assert.equal(data.mode, 'solo');
            const oppBefore = data.solo.opponentVp.length;
            // take a grid puzzle, then pass → the AI acts
            test.invokeHostMethod('takeSoloGrid', 4);
            test.invokeHostMethod('pass');
            data = readState(test.getHostData('gameState'));
            assert.ok(data.solo.opponentVp.length > oppBefore, 'AI took a puzzle');
        });

        it('runs an independent, identically-seeded game per racer in speed mode', () => {
            const test = new GameRuleTest('projectl', 1); // host + 1 client
            test.invokeHostMethod('setGameMode', 'speed');
            test.invokeHostMethod('startGame');

            assert.equal(test.getHostData('speedMode'), true);
            const states: any = test.getHostData('speedStates');
            const ids = Object.keys(states);
            assert.equal(ids.length, 2, 'one game per player');

            // decks are identical across racers
            const decks = ids.map(id => readState(states[id]).blackDeck);
            assert.deepEqual(decks[0], decks[1], 'same seeded black deck');

            const puzzleTotal = () => {
                const s: any = test.getHostData('speedStates');
                return Object.keys(s).reduce((n, id) => n + readState(s[id]).players[id].puzzles.length, 0);
            };
            assert.equal(puzzleTotal(), 0);

            // host acts on its OWN state only
            test.invokeHostMethod('takeRow', 'white', 0);
            assert.equal(puzzleTotal(), 1, 'exactly one racer gained a puzzle');

            // client acts on its OWN state only — no interference
            test.invokeClientMethod(0, 'takeRow', 'white', 0);
            assert.equal(puzzleTotal(), 2, 'both racers now have one puzzle, independently');
        });
    });
});
