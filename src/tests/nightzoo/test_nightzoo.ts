/**
 * test_nightzoo.ts — Night at the Zoo tests.
 *   Type A: pure NightZooGameState engine logic (drafting, placement, the
 *           per-animal movement resolver, paired bonuses, scoring).
 *   Type B: end-to-end via GameRuleTest (remote methods + tick distribution).
 */

import { describe, it } from 'mocha';
import { strict as assert } from 'assert';

import { NightZooGameState, Figure, MoveOption } from '../../rules/nightzoo/NightZooGameState';
import { AnimalType, ACTION_TILES, entranceAt, TILE_BY_ID } from '../../rules/nightzoo/NightZooData';
import { GameRuleTest } from '../GameRuleTest';

// ---- test helpers ----------------------------------------------------------

function newGame(active: AnimalType[], ids: string[] = ['A']): NightZooGameState {
    const g = new NightZooGameState(ids);
    g.start_game({ activeTypes: active });
    return g;
}

/** Move every figure of a player off-board, then place one in the neighborhood. */
function placeOne(g: NightZooGameState, id: string, type: AnimalType, pos: [number, number], extra: Partial<Figure> = {}): Figure {
    const d = g.get_data();
    const p = d.players[id];
    for (const f of p.figures) { f.zone = 'notDiscovered'; f.pos = null; }
    const fig = p.figures.find(f => f.type === type)!;
    fig.zone = 'neighborhood';
    fig.pos = [pos[0], pos[1]];
    Object.assign(fig, extra);
    return fig;
}

function setTiles(g: NightZooGameState, id: string, cells: [number, number, string][]): void {
    const p = g.get_data().players[id];
    for (const [r, c, tileId] of cells) p.grid[r][c] = tileId;
}

function pushPoint(g: NightZooGameState, id: string, source: any, figureId: string | null): void {
    g.get_data().players[id].movementQueue.push({ source, figureId });
}

describe('Night at the Zoo', () => {
    // ======================================================================
    describe('Type A: engine', () => {

        describe('Deck', () => {
            it('has 18 single-action, 36 two-action and 21 food tiles, never mixing food + actions', () => {
                assert.equal(ACTION_TILES.length, 75);
                const single = ACTION_TILES.filter(t => t.actions.length === 1 && !t.food);
                const dbl = ACTION_TILES.filter(t => t.actions.length === 2 && !t.food);
                const food = ACTION_TILES.filter(t => t.food && t.actions.length === 0);
                assert.equal(single.length, 18);
                assert.equal(dbl.length, 36);
                assert.equal(food.length, 21);
                // no tile ever carries both a food and an action
                assert.ok(ACTION_TILES.every(t => !(t.food && t.actions.length > 0)));
                // balanced across terrains (25 each)
                for (const terr of ['rocks', 'grass', 'sand'] as const) {
                    assert.equal(ACTION_TILES.filter(t => t.terrain === terr).length, 25);
                }
            });
        });

        describe('Setup', () => {
            it('draws 3 active types totalling ≥ 6 moons', () => {
                for (let i = 0; i < 20; i++) {
                    const g = new NightZooGameState(['A', 'B']);
                    g.start_game();
                    const types = g.get_active_types();
                    assert.equal(types.length, 3);
                    const moons = types.reduce((a, t) => a + ({ penguin: 1, cheetah: 2, wolf: 2, snake: 2, butterfly: 3, sloth: 4 } as any)[t], 0);
                    assert.ok(moons >= 6, 'moons ≥ 6');
                }
            });

            it('deals a (players+1) market and gives each player 3 figures per type', () => {
                const g = newGame(['penguin', 'snake', 'sloth'], ['A', 'B', 'C']);
                assert.equal(g.get_market().length, 4);
                const p = g.get_player('A')!;
                assert.equal(p.figures.length, 9); // 3 types × 3
                // exactly one figure of each type starts discovered on an (external) entrance
                for (const t of g.get_active_types()) {
                    const discovered = p.figures.filter(f => f.type === t && f.zone === 'entrance');
                    assert.equal(discovered.length, 1);
                    assert.ok(discovered[0].pos, 'starts on an entrance');
                }
            });

            it('starts the 3 animals on entrances of 3 DIFFERENT terrains (random per player)', () => {
                for (let i = 0; i < 25; i++) {
                    const g = newGame(['penguin', 'snake', 'sloth'], ['A', 'B']);
                    for (const id of ['A', 'B']) {
                        const p = g.get_player(id)!;
                        const starts = p.figures.filter(f => f.zone === 'entrance');
                        assert.equal(starts.length, 3);
                        const terrains = starts.map(f => entranceAt(f.pos![0], f.pos![1])!.terrain);
                        assert.equal(new Set(terrains).size, 3, 'three distinct terrains');
                    }
                }
            });
        });

        describe('Drafting', () => {
            it('runs a clockwise round then pushes the last tile to leftover', () => {
                const g = newGame(['penguin', 'snake', 'sloth'], ['A', 'B']);
                assert.equal(g.get_phase(), 'draft');
                const first = g.currentDrafter();
                g.draft_take(first, 0);
                const second = g.currentDrafter();
                assert.notEqual(first, second);
                g.draft_take(second, 1);
                assert.equal(g.get_phase(), 'placement');
                assert.equal(g.get_leftover().length, 1);
                assert.equal(g.get_player('A')!.toPlace.length, 1);
                assert.equal(g.get_player('B')!.toPlace.length, 1);
            });

            it('rejects an out-of-turn pick', () => {
                const g = newGame(['penguin', 'snake', 'sloth'], ['A', 'B']);
                const other = g.get_player_order().find(id => id !== g.currentDrafter())!;
                assert.throws(() => g.draft_take(other, 0));
            });
        });

        describe('Placement & board actions', () => {
            function intoPlacement(g: NightZooGameState, id: string, hand: string[]): void {
                const d = g.get_data();
                d.phase = 'placement';
                const p = d.players[id];
                p.toPlace = [...hand];
                p.movementQueue = [];
                p.pendingDiscovers = 0;
                p.pendingBonuses = 0;
                p.placementDone = false;
            }

            it('awards a paired group when both cells are covered with the same terrain', () => {
                const g = newGame(['penguin', 'snake', 'sloth']);
                // Pair A = (0,3) + (0,4), both board cells → reward move2.
                intoPlacement(g, 'A', ['A001', 'A004']); // both rocks (move1, move2)
                g.place_tile('A', 'A001', 0, 3);
                assert.equal(g.get_player('A')!.awardedPairs.length, 0, 'not until both covered');
                g.place_tile('A', 'A004', 0, 4);
                const p = g.get_player('A')!;
                assert.deepEqual(p.awardedPairs, ['A']);
                assert.equal(p.vp, 0);
                assert.equal(p.movementQueue.length, 5, 'move1 (1) + move2 (2) + pair reward move2 (2)');
            });

            it('resolves a cell with two printed actions (2 VP + bonus)', () => {
                const g = newGame(['penguin', 'snake', 'sloth']);
                intoPlacement(g, 'A', ['A001']); // rocks move1
                g.place_tile('A', 'A001', 4, 0); // (4,0) prints [vp2, bonus], no condition
                const p = g.get_player('A')!;
                assert.equal(p.vp, 2, 'printed 2 VP');
                assert.equal(p.pendingBonuses, 1, 'printed bonus');
                assert.equal(p.movementQueue.length, 1, 'tile move1');
            });

            it('enforces cell placement restrictions (terrain / symbol)', () => {
                const g = newGame(['penguin', 'snake', 'sloth']);
                intoPlacement(g, 'A', ['A007', 'A001', 'A003']); // rocks discover, rocks move1, sand move1
                // (2,1) requires a discover-symbol tile
                assert.throws(() => g.place_tile('A', 'A001', 2, 1), /requirement/);
                g.place_tile('A', 'A007', 2, 1); // discover accepted → printed +2 VP fires
                assert.equal(g.get_player('A')!.vp, 2);
                // (1,1) requires a sand tile
                assert.throws(() => g.place_tile('A', 'A001', 1, 1), /requirement/); // rocks rejected
                g.place_tile('A', 'A003', 1, 1); // sand accepted
                assert.equal(g.get_player('A')!.movementQueue.length, 2, 'tile move1 + printed move1');
            });

            it('requires choosing one action on a two-action tile, then applies it plus the cell action', () => {
                const g = newGame(['penguin', 'snake', 'sloth']);
                intoPlacement(g, 'A', ['A019']); // rocks move1 + discover
                assert.throws(() => g.place_tile('A', 'A019', 0, 1), /Choose/); // no choice → rejected
                g.place_tile('A', 'A019', 0, 1, 'discover'); // choose discover; cell (0,1) prints move1
                const p = g.get_player('A')!;
                assert.equal(p.pendingDiscovers, 1, 'chosen tile action: discover');
                assert.equal(p.movementQueue.length, 1, 'plus the cell printed move1');
            });

            it('takes a Bonus tile of a chosen terrain into hand', () => {
                const g = newGame(['penguin', 'snake', 'sloth']);
                intoPlacement(g, 'A', ['A010']); // rocks bonus
                g.place_tile('A', 'A010', 2, 4); // (2,4) prints move1 (no condition)
                const p = g.get_player('A')!;
                assert.equal(p.pendingBonuses, 1);
                g.resolve_bonus('A', 'grass');
                assert.equal(p.pendingBonuses, 0);
                assert.equal(p.toPlace.length, 1, 'bonus tile now in hand');
                assert.equal(g.get_bonus_piles().grass, 13);
            });

            it('discovers an animal onto an external entrance', () => {
                const g = newGame(['penguin', 'snake', 'sloth']);
                intoPlacement(g, 'A', ['A007']); // rocks discover
                g.place_tile('A', 'A007', 2, 4);
                const p = g.get_player('A')!;
                assert.equal(p.pendingDiscovers, 1);
                const before = p.figures.filter(f => f.type === 'penguin' && f.zone === 'entrance').length;
                assert.throws(() => g.resolve_discover('A', 'penguin', 2, 4), /entrance/); // (2,4) is a board cell
                g.resolve_discover('A', 'penguin', -1, 2); // (-1,2) is the grass entrance above (0,2)
                const after = p.figures.filter(f => f.type === 'penguin' && f.zone === 'entrance');
                assert.equal(after.length, before + 1);
                assert.ok(after.some(f => f.pos && f.pos[0] === -1 && f.pos[1] === 2), 'placed on (-1,2)');
                assert.equal(p.pendingDiscovers, 0);
            });

            it('stores a tile in the warehouse (max 2)', () => {
                const g = newGame(['penguin', 'snake', 'sloth']);
                intoPlacement(g, 'A', ['A001']);
                g.warehouse_tile('A', 'A001');
                const p = g.get_player('A')!;
                assert.equal(p.warehouse.filter(x => x != null).length, 1);
                assert.equal(p.toPlace.length, 0);
            });
        });

        describe('Movement resolver', () => {
            function intoMove(g: NightZooGameState): void { g.get_data().phase = 'placement'; }

            it('penguin slides to the furthest walkable tile', () => {
                const g = newGame(['penguin', 'snake', 'sloth']);
                intoMove(g);
                setTiles(g, 'A', [[0, 0, 'A001'], [0, 1, 'A001'], [0, 2, 'A001']]);
                const fig = placeOne(g, 'A', 'penguin', [0, 0]);
                pushPoint(g, 'A', 'arrow', null);
                g.resolve_move('A', fig.id, { kind: 'slide', dir: 'E', to: [0, 2], arrives: false });
                assert.deepEqual(g.get_player('A')!.figures.find(f => f.id === fig.id)!.pos, [0, 2]);
            });

            it('penguin reaching the Zoo mid-slide arrives home', () => {
                const g = newGame(['penguin', 'snake', 'sloth']);
                intoMove(g);
                setTiles(g, 'A', [[2, 0, 'A001'], [2, 1, 'A001']]); // (2,2) is the Zoo
                const fig = placeOne(g, 'A', 'penguin', [2, 0]);
                pushPoint(g, 'A', 'arrow', null);
                g.resolve_move('A', fig.id, { kind: 'slide', dir: 'E', to: [2, 2], arrives: true });
                assert.equal(g.get_player('A')!.figures.find(f => f.id === fig.id)!.zone, 'arrived');
            });

            it('snake turns (costs a point) then advances forward only', () => {
                const g = newGame(['penguin', 'snake', 'sloth']);
                intoMove(g);
                setTiles(g, 'A', [[0, 0, 'A001'], [1, 0, 'A001']]);
                const fig = placeOne(g, 'A', 'snake', [0, 0], { heading: 'E' });
                pushPoint(g, 'A', 'arrow', null);
                pushPoint(g, 'A', 'arrow', null);
                // turn to face South (in-place)
                g.resolve_move('A', fig.id, { kind: 'rotate', heading: 'S' });
                assert.equal(g.get_player('A')!.figures.find(f => f.id === fig.id)!.heading, 'S');
                // advance forward (south) to (1,0)
                g.resolve_move('A', fig.id, { kind: 'step', to: [1, 0], arrives: false });
                assert.deepEqual(g.get_player('A')!.figures.find(f => f.id === fig.id)!.pos, [1, 0]);
            });

            it('sloth wakes instead of moving when asleep', () => {
                const g = newGame(['penguin', 'snake', 'sloth']);
                intoMove(g);
                setTiles(g, 'A', [[0, 0, 'A001'], [0, 1, 'A001']]);
                const fig = placeOne(g, 'A', 'sloth', [0, 0], { awake: false });
                pushPoint(g, 'A', 'arrow', null);
                g.resolve_move('A', fig.id, { kind: 'wake' });
                const f2 = g.get_player('A')!.figures.find(f => f.id === fig.id)!;
                assert.equal(f2.awake, true);
                assert.deepEqual(f2.pos, [0, 0], 'did not move while waking');
            });

            it('cheetah gets a +1 tile on a discard move', () => {
                const g = newGame(['cheetah', 'butterfly', 'wolf']);
                intoMove(g);
                setTiles(g, 'A', [[0, 0, 'A001'], [0, 1, 'A001'], [0, 2, 'A001']]);
                const fig = placeOne(g, 'A', 'cheetah', [0, 0]);
                pushPoint(g, 'A', 'discard', fig.id);
                g.resolve_move('A', fig.id, { kind: 'step', to: [0, 1], arrives: false });
                // the discard move granted a bonus step — spend it
                assert.ok(g.get_player('A')!.movementQueue.length >= 1, 'bonus step queued');
                g.resolve_move('A', fig.id, { kind: 'step', to: [0, 2], arrives: false });
                assert.deepEqual(g.get_player('A')!.figures.find(f => f.id === fig.id)!.pos, [0, 2]);
            });

            it('butterfly gains pollen on a discard move', () => {
                const g = newGame(['cheetah', 'butterfly', 'wolf']);
                intoMove(g);
                setTiles(g, 'A', [[0, 0, 'A001'], [0, 1, 'A001']]);
                const fig = placeOne(g, 'A', 'butterfly', [0, 0], { pollen: 0 });
                pushPoint(g, 'A', 'discard', fig.id);
                g.resolve_move('A', fig.id, { kind: 'step', to: [0, 1], arrives: false });
                assert.equal(g.get_player('A')!.figures.find(f => f.id === fig.id)!.pollen, 1);
            });

            it('moves an animal from an external entrance inward onto its adjacent cell', () => {
                const g = newGame(['cheetah', 'butterfly', 'wolf']);
                intoMove(g);
                const d = g.get_data();
                const p = d.players['A'];
                for (const f of p.figures) { f.zone = 'notDiscovered'; f.pos = null; }
                const fig = p.figures.find(f => f.type === 'wolf')!;
                fig.zone = 'entrance'; fig.pos = [-1, 0]; // sand entrance above (0,0)
                setTiles(g, 'A', [[0, 0, 'A001']]);       // give the adjacent cell a tile
                pushPoint(g, 'A', 'arrow', null);
                g.resolve_move('A', fig.id, { kind: 'step', to: [0, 0], arrives: false });
                const f2 = g.get_player('A')!.figures.find(f => f.id === fig.id)!;
                assert.equal(f2.zone, 'neighborhood');
                assert.deepEqual(f2.pos, [0, 0]);
            });

            it('never lets an animal step onto an empty (tile-less) space', () => {
                const g = newGame(['cheetah', 'butterfly', 'wolf']);
                intoMove(g);
                setTiles(g, 'A', [[0, 0, 'A001']]); // (0,1) is empty
                const fig = placeOne(g, 'A', 'wolf', [0, 0]);
                pushPoint(g, 'A', 'arrow', null);
                assert.throws(() => g.resolve_move('A', fig.id, { kind: 'step', to: [0, 1], arrives: false }));
            });
        });

        describe('Scoring', () => {
            it('totals zoo animals (wolf set + butterfly pollen), stranded and food', () => {
                const g = newGame(['wolf', 'butterfly', 'penguin']);
                const d = g.get_data();
                const p = d.players['A'];
                for (const f of p.figures) { f.zone = 'notDiscovered'; f.pos = null; }
                const byType = (t: AnimalType) => p.figures.filter(f => f.type === t);
                // 2 wolves home, 1 wolf stranded in the neighborhood
                byType('wolf')[0].zone = 'arrived';
                byType('wolf')[1].zone = 'arrived';
                byType('wolf')[2].zone = 'neighborhood'; byType('wolf')[2].pos = [1, 3];
                // 1 butterfly home with 3 pollen
                byType('butterfly')[0].zone = 'arrived'; byType('butterfly')[0].pollen = 3;
                // 1 penguin home
                byType('penguin')[0].zone = 'arrived';
                p.vp = 3; // immediate VP accrued in-game
                // two distinct foods in the neighborhood (placeable cells)
                p.grid[0][1] = 'A055'; // rocks meat
                p.grid[1][1] = 'A058'; // rocks fish

                g.scoreGame();
                const s = g.get_scores()!['A'];
                assert.equal(s.base, 3);
                assert.equal(s.zoo, 16 + 9 + 5, 'wolves(2)=16 + butterfly(p3)=9 + penguin=5');
                assert.equal(s.stranded, 1);
                assert.equal(s.food, 6, '2 distinct foods');
                assert.equal(s.total, 3 + 30 + 1 + 6);
                assert.equal(s.animalsInZoo, 4);
            });

            it('breaks a tie by most animals in the Zoo', () => {
                const g = newGame(['penguin', 'snake', 'sloth'], ['A', 'B']);
                const d = g.get_data();
                for (const id of ['A', 'B']) {
                    const p = d.players[id];
                    for (const f of p.figures) { f.zone = 'notDiscovered'; f.pos = null; }
                    p.vp = 10;
                }
                // A: one penguin home (5) → total 15, 1 in zoo
                d.players['A'].figures.find(f => f.type === 'penguin')!.zone = 'arrived';
                // B: reach 15 purely from VP → 0 in zoo
                d.players['B'].vp = 15;
                d.players['A'].vp = 10;
                g.scoreGame();
                assert.deepEqual(g.get_winners(), ['A'], 'A wins the tie on animals home');
            });
        });
    });

    // ======================================================================
    describe('Type B: integration (GameRuleTest)', () => {
        function gsFrom(test: GameRuleTest): NightZooGameState {
            const raw: any = test.getHostData('gameState');
            return typeof raw?.get_data === 'function' ? raw : NightZooGameState.from_data(raw.data, raw.playerIds);
        }

        it('starts, drafts a full round and enters placement', () => {
            const test = new GameRuleTest('nightzoo', 1); // host + 1 client = 2 players
            test.invokeHostMethod('startGame');

            let gs = gsFrom(test);
            assert.equal(gs.get_phase(), 'draft');
            assert.equal(gs.get_market().length, 3);

            const drafter1 = gs.currentDrafter();
            const hostId = test.getPlayerClientId(0) === gs.get_player_order()[0] ? gs.get_player_order()[1] : gs.get_player_order()[0];
            // host is player 0 in the order; drive picks by matching the current drafter
            const pickAs = (id: string, slot: number) => {
                if (id === hostId) test.invokeHostMethod('draft', slot);
                else test.invokeClientMethod(0, 'draft', slot);
            };
            pickAs(drafter1, 0);
            gs = gsFrom(test);
            pickAs(gs.currentDrafter(), 1);

            gs = gsFrom(test);
            assert.equal(gs.get_phase(), 'placement');
            assert.equal(gs.get_leftover().length, 1);
        });

        it('places tiles and advances the draft after everyone finishes', () => {
            const test = new GameRuleTest('nightzoo', 1);
            test.invokeHostMethod('startGame');
            let gs = gsFrom(test);
            const order = gs.get_player_order();
            const hostId = order[0];
            const clientId = order[1];

            const pickAs = (id: string, slot: number) => {
                if (id === hostId) test.invokeHostMethod('draft', slot);
                else test.invokeClientMethod(0, 'draft', slot);
            };
            pickAs(gs.currentDrafter(), 0);
            gs = gsFrom(test);
            pickAs(gs.currentDrafter(), 1);

            gs = gsFrom(test);
            assert.equal(gs.get_phase(), 'placement');

            // each player places their drafted tile on an unconditioned cell, then finishes
            // ((0,1) and (4,4) have no condition; pass a choice if the tile has two actions)
            const choiceFor = (id: string) => {
                const def = TILE_BY_ID[gsFrom(test).get_player(id)!.toPlace[0]];
                return def.actions.length > 1 ? def.actions[0] : undefined;
            };
            const hostTile = gs.get_player(hostId)!.toPlace[0];
            test.invokeHostMethod('placeTile', hostTile, 0, 1, choiceFor(hostId));
            const clientTile = gsFrom(test).get_player(clientId)!.toPlace[0];
            test.invokeClientMethod(0, 'placeTile', clientTile, 4, 4, choiceFor(clientId));

            test.invokeHostMethod('finishPlacement');
            test.invokeClientMethod(0, 'finishPlacement');

            gs = gsFrom(test);
            // draft 1 done → back to drafting (draft 2) with a fresh market
            assert.equal(gs.get_phase(), 'draft');
            assert.equal(gs.get_draft_number(), 2);
            assert.equal(gs.get_market().length, 3);
        });
    });
});
