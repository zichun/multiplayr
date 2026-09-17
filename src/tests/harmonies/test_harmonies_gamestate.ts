/**
 * test_harmonies_gamestate.ts
 *
 * Type A Unit Tests for HarmoniesGameState logic, stack grammar,
 * 60-degree hex rotational pattern matching, and scoring.
 */

import * as assert from 'assert';
import {
    HarmoniesGameState,
    canPlaceToken,
    featureOf,
    findPatternMatches,
    rotateAxial,
    calculateHarmoniesScore,
    createEmptyBoard,
    coordKey,
    BOARD_MASK_A,
    BOARD_MASK_B,
    NEIGHBOR_DIRECTIONS,
    Board,
    HeldCard
} from '../../rules/harmonies/HarmoniesGameState';
import { getAnimalCardSpec, ANIMAL_CARD_SPECS } from '../../rules/harmonies/HarmoniesAssets';

describe('Harmonies GameState Logic', () => {

    describe('Stack Grammar & Placement Validation', () => {
        it('allows placing any color onto an empty cell', () => {
            assert.strictEqual(canPlaceToken([], 'blue'), true);
            assert.strictEqual(canPlaceToken([], 'gray'), true);
            assert.strictEqual(canPlaceToken([], 'brown'), true);
            assert.strictEqual(canPlaceToken([], 'green'), true);
            assert.strictEqual(canPlaceToken([], 'yellow'), true);
            assert.strictEqual(canPlaceToken([], 'red'), true);
        });

        it('enforces terminal height 1 for Water and Field', () => {
            assert.strictEqual(canPlaceToken(['blue'], 'blue'), false);
            assert.strictEqual(canPlaceToken(['blue'], 'green'), false);
            assert.strictEqual(canPlaceToken(['yellow'], 'yellow'), false);
            assert.strictEqual(canPlaceToken(['yellow'], 'brown'), false);
        });

        it('validates Mountain stacking up to height 3 (pure gray)', () => {
            assert.strictEqual(canPlaceToken(['gray'], 'gray'), true);
            assert.strictEqual(canPlaceToken(['gray'], 'brown'), false);
            assert.strictEqual(canPlaceToken(['gray'], 'green'), false);

            assert.strictEqual(canPlaceToken(['gray', 'gray'], 'gray'), true);
            assert.strictEqual(canPlaceToken(['gray', 'gray'], 'red'), false);

            assert.strictEqual(canPlaceToken(['gray', 'gray', 'gray'], 'gray'), false); // max 3
        });

        it('validates Tree stacking (brown trunks topped with green leaves)', () => {
            // Lone green is tree size 1 (terminal)
            assert.strictEqual(canPlaceToken(['green'], 'green'), false);
            assert.strictEqual(canPlaceToken(['green'], 'brown'), false);

            // Brown base can take green (tree size 2), brown (trunk 2), or red (building)
            assert.strictEqual(canPlaceToken(['brown'], 'green'), true);
            assert.strictEqual(canPlaceToken(['brown'], 'brown'), true);
            assert.strictEqual(canPlaceToken(['brown'], 'red'), true);
            assert.strictEqual(canPlaceToken(['brown'], 'gray'), false);

            // [brown, green] is tree size 2 (terminal)
            assert.strictEqual(canPlaceToken(['brown', 'green'], 'green'), false);

            // [brown, brown] can only take green (tree size 3)
            assert.strictEqual(canPlaceToken(['brown', 'brown'], 'green'), true);
            assert.strictEqual(canPlaceToken(['brown', 'brown'], 'brown'), false);
            assert.strictEqual(canPlaceToken(['brown', 'brown'], 'red'), false);

            // [brown, brown, green] is tree size 3 (terminal)
            assert.strictEqual(canPlaceToken(['brown', 'brown', 'green'], 'green'), false);
        });

        it('validates Building stacking (height 2 with red on top)', () => {
            // Lone red base can take red (building)
            assert.strictEqual(canPlaceToken(['red'], 'red'), true);
            assert.strictEqual(canPlaceToken(['red'], 'brown'), false);
            // Gray and brown bases can also take red (building)
            assert.strictEqual(canPlaceToken(['gray'], 'red'), true);
            assert.strictEqual(canPlaceToken(['brown'], 'red'), true);

            // Building [red, red] or [brown, red] or [gray, red] is terminal height 2
            assert.strictEqual(canPlaceToken(['red', 'red'], 'red'), false);
            assert.strictEqual(canPlaceToken(['brown', 'red'], 'red'), false);
            assert.strictEqual(canPlaceToken(['gray', 'red'], 'red'), false);
        });

        it('identifies feature types correctly from stacks', () => {
            assert.deepStrictEqual(featureOf(['blue']), { kind: 'water' });
            assert.deepStrictEqual(featureOf(['yellow']), { kind: 'field' });
            assert.deepStrictEqual(featureOf(['green']), { kind: 'tree', size: 1 });
            assert.deepStrictEqual(featureOf(['brown', 'green']), { kind: 'tree', size: 2 });
            assert.deepStrictEqual(featureOf(['brown', 'brown', 'green']), { kind: 'tree', size: 3 });
            assert.deepStrictEqual(featureOf(['gray']), { kind: 'mountain', height: 1 });
            assert.deepStrictEqual(featureOf(['gray', 'gray']), { kind: 'mountain', height: 2 });
            assert.deepStrictEqual(featureOf(['gray', 'gray', 'gray']), { kind: 'mountain', height: 3 });
            assert.deepStrictEqual(featureOf(['brown', 'red']), { kind: 'building' });
            assert.deepStrictEqual(featureOf(['red', 'red']), { kind: 'building' });
        });
    });

    describe('Board Masks (flat-top columns)', () => {
        const columnHeights = (mask: { q: number; r: number }[]) => {
            const cols = [...new Set(mask.map(c => c.q))].sort((a, b) => a - b);
            return cols.map(q => mask.filter(c => c.q === q).length);
        };

        it('lays Side A out as 5 columns of 5/4/5/4/5', () => {
            assert.deepStrictEqual(columnHeights(BOARD_MASK_A), [5, 4, 5, 4, 5]);
            assert.strictEqual(BOARD_MASK_A.length, 23);
        });

        it('lays Side B out as 7 columns of 4/3/4/3/4/3/4', () => {
            assert.deepStrictEqual(columnHeights(BOARD_MASK_B), [4, 3, 4, 3, 4, 3, 4]);
            assert.strictEqual(BOARD_MASK_B.length, 25);
        });

        it('keeps every column vertically centred on its neighbours', () => {
            // Rendered y tracks r + q/2, so every column must share a midpoint.
            for (const mask of [BOARD_MASK_A, BOARD_MASK_B]) {
                const cols = [...new Set(mask.map(c => c.q))].sort((a, b) => a - b);
                const mids = cols.map((q) => {
                    const ys = mask.filter(c => c.q === q).map(c => c.r + q / 2);
                    return (Math.min(...ys) + Math.max(...ys)) / 2;
                });
                for (const mid of mids) {
                    assert.strictEqual(mid, mids[0]);
                }
            }
        });

        it('gives each side its own board geometry', () => {
            const a = createEmptyBoard('A');
            const b = createEmptyBoard('B');
            assert.strictEqual(Object.keys(a.cells).length, 23);
            assert.strictEqual(Object.keys(b.cells).length, 25);
            assert.strictEqual(a.side, 'A');
            assert.strictEqual(b.side, 'B');
        });

        it('has no isolated cells: every space touches at least two others', () => {
            for (const mask of [BOARD_MASK_A, BOARD_MASK_B]) {
                const present = new Set(mask.map(c => coordKey(c)));
                for (const c of mask) {
                    const touching = NEIGHBOR_DIRECTIONS
                        .filter(d => present.has(coordKey({ q: c.q + d.q, r: c.r + d.r })))
                        .length;
                    assert.ok(touching >= 2, `cell ${coordKey(c)} only touches ${touching}`);
                }
            }
        });
    });

    describe('Hex Rotations & Pattern Matching', () => {
        it('rotates axial coordinates by 60 degrees 6 times back to original', () => {
            const start = { q: 1, r: 0 };
            const r1 = rotateAxial(start, 1);
            const r2 = rotateAxial(start, 2);
            const r6 = rotateAxial(start, 6);

            assert.strictEqual(r1.q, 0);
            assert.strictEqual(r1.r, 1);
            assert.strictEqual(r2.q, -1);
            assert.strictEqual(r2.r, 1);
            assert.strictEqual(r6.q, start.q);
            assert.strictEqual(r6.r, start.r);
        });

        it('finds habitat pattern matches across all 6 rotations', () => {
            const board = createEmptyBoard('A');
            // Build W2 pattern: mountain(height 3) + water, cube on water
            // Put mountain(3) at (1, 1) and water at (2, 1) -> E(+1, 0) offset
            board.cells[coordKey({ q: 1, r: 1 })].stack = ['gray', 'gray', 'gray'];
            board.cells[coordKey({ q: 2, r: 1 })].stack = ['blue'];

            const w2Spec = getAnimalCardSpec('W2')!;
            const matches = findPatternMatches(board, w2Spec.pattern);

            assert.strictEqual(matches.length, 1);
            assert.strictEqual(matches[0].cubeCoord.q, 2);
            assert.strictEqual(matches[0].cubeCoord.r, 1);
        });

        it('respects exact tree and mountain heights in pattern matching', () => {
            const board = createEmptyBoard('A');
            // Put tree of size 1 at (0, 0) and water at (1, 0)
            board.cells[coordKey({ q: 0, r: 0 })].stack = ['green']; // tree size 1
            board.cells[coordKey({ q: 1, r: 0 })].stack = ['blue'];

            // W7 requires tree size 1 + water -> should match
            const w7Spec = getAnimalCardSpec('W7')!;
            const matchesW7 = findPatternMatches(board, w7Spec.pattern);
            assert.strictEqual(matchesW7.length, 1);

            // W5 requires tree size 2 -> should NOT match size 1 tree
            const w5Spec = getAnimalCardSpec('W5')!;
            const matchesW5 = findPatternMatches(board, w5Spec.pattern);
            assert.strictEqual(matchesW5.length, 0);
        });

        it('does not allow cube placement if cell already has an animal cube', () => {
            const board = createEmptyBoard('A');
            board.cells[coordKey({ q: 0, r: 0 })].stack = ['green'];
            board.cells[coordKey({ q: 1, r: 0 })].stack = ['blue'];
            board.cells[coordKey({ q: 1, r: 0 })].cube = 'animal'; // already occupied!

            const w7Spec = getAnimalCardSpec('W7')!;
            const matches = findPatternMatches(board, w7Spec.pattern);
            assert.strictEqual(matches.length, 0);
        });
    });

    describe('Scoring Algorithms', () => {
        it('scores trees correctly based on size', () => {
            const board = createEmptyBoard('A');
            board.cells[coordKey({ q: 0, r: 0 })].stack = ['green']; // size 1 = 1 pt
            board.cells[coordKey({ q: 2, r: 0 })].stack = ['brown', 'green']; // size 2 = 3 pts
            board.cells[coordKey({ q: 4, r: 0 })].stack = ['brown', 'brown', 'green']; // size 3 = 7 pts

            const score = calculateHarmoniesScore(board, [], []);
            assert.strictEqual(score.trees, 1 + 3 + 7);
        });

        it('only scores mountains when adjacent to at least one other mountain', () => {
            const board = createEmptyBoard('A');
            // Isolated mountain of height 3 at (0, 0) -> scores 0
            board.cells[coordKey({ q: 0, r: 0 })].stack = ['gray', 'gray', 'gray'];

            let score = calculateHarmoniesScore(board, [], []);
            assert.strictEqual(score.mountains, 0, 'Isolated mountain should score 0');

            // Add adjacent mountain of height 1 at (1, 0)
            board.cells[coordKey({ q: 1, r: 0 })].stack = ['gray'];

            score = calculateHarmoniesScore(board, [], []);
            assert.strictEqual(score.mountains, 7 + 1, 'Adjacent mountains should score 7 + 1 = 8');
        });

        it('scores fields in contiguous groups of 2 or more yellow tokens', () => {
            const board = createEmptyBoard('A');
            // Single yellow at (0, 0) -> 0 pts
            board.cells[coordKey({ q: 0, r: 0 })].stack = ['yellow'];
            let score = calculateHarmoniesScore(board, [], []);
            assert.strictEqual(score.fields, 0);

            // Connect another yellow at (1, 0) -> group of 2 = 5 pts
            board.cells[coordKey({ q: 1, r: 0 })].stack = ['yellow'];
            score = calculateHarmoniesScore(board, [], []);
            assert.strictEqual(score.fields, 5);

            // Add a 3rd contiguous yellow at (2, 0) -> still single field = 5 pts
            board.cells[coordKey({ q: 2, r: 0 })].stack = ['yellow'];
            score = calculateHarmoniesScore(board, [], []);
            assert.strictEqual(score.fields, 5);

            // Separate field of 2 yellow at (0, 3) and (1, 3) -> 2nd field = +5 pts -> total 10 pts
            board.cells[coordKey({ q: 0, r: 3 })].stack = ['yellow'];
            board.cells[coordKey({ q: 1, r: 3 })].stack = ['yellow'];
            score = calculateHarmoniesScore(board, [], []);
            assert.strictEqual(score.fields, 10);
        });

        it('scores buildings with at least 3 distinct adjacent colors', () => {
            const board = createEmptyBoard('A');
            const bCoord = { q: 1, r: 1 };
            board.cells[coordKey(bCoord)].stack = ['brown', 'red']; // Building

            // Surrounding neighbors with only 2 colors: blue and yellow
            board.cells[coordKey({ q: 2, r: 1 })].stack = ['blue'];
            board.cells[coordKey({ q: 0, r: 1 })].stack = ['yellow'];

            let score = calculateHarmoniesScore(board, [], []);
            assert.strictEqual(score.buildings, 0, 'Only 2 distinct colors -> 0 pts');

            // Add a 3rd distinct color: green
            board.cells[coordKey({ q: 1, r: 0 })].stack = ['green'];
            score = calculateHarmoniesScore(board, [], []);
            assert.strictEqual(score.buildings, 5, '3 distinct colors -> 5 pts');
        });

        it('scores Side A River water ladder correctly', () => {
            const board = createEmptyBoard('A');
            // River length 4: (0,0) -> (1,0) -> (2,0) -> (3,0)
            board.cells[coordKey({ q: 0, r: 0 })].stack = ['blue'];
            board.cells[coordKey({ q: 1, r: 0 })].stack = ['blue'];
            board.cells[coordKey({ q: 2, r: 0 })].stack = ['blue'];
            board.cells[coordKey({ q: 3, r: 0 })].stack = ['blue'];

            const score = calculateHarmoniesScore(board, [], []);
            assert.strictEqual(score.water, 8); // length 4 = 8 pts
        });

        it('scores animal cards by cubes placed', () => {
            const board = createEmptyBoard('A');
            const w1Spec = getAnimalCardSpec('W1')!; // cubeCount: 3, pointTrack: [0, 4, 8, 13]
            const held: HeldCard = {
                card: w1Spec,
                cubesLeft: 1 // 3 - 1 = 2 cubes placed -> pointTrack[2] = 8 pts
            };

            const score = calculateHarmoniesScore(board, [held], []);
            assert.strictEqual(score.animals, 8);
            assert.strictEqual(score.cubesPlaced, 2);
        });
    });

    describe('Game Flow & Turn Actions', () => {
        it('manages drafting tokens, placing tokens, taking card, and placing cubes', () => {
            const game = new HarmoniesGameState(['alice', 'bob'], 'A');
            const data = game.get_data();

            assert.strictEqual(data.currentPlayerIndex, 0);
            assert.strictEqual(data.market.length, 5);
            assert.strictEqual(data.animalDisplay.length, 5);

            // Alice drafts tokens from market space 0
            game.take_market_tokens('alice', 0);
            assert.strictEqual(game.get_data().players['alice'].draftedTokens.length, 3);
            assert.strictEqual(game.get_data().market[0].length, 0);

            // Alice takes an animal card from the display
            const cardToTake = game.get_data().animalDisplay[0].id;
            game.take_animal_card('alice', cardToTake);
            assert.strictEqual(game.get_data().players['alice'].hand.length, 1);
            assert.strictEqual(game.get_data().players['alice'].hasTakenCardThisTurn, true);

            // Cannot take a second card this turn
            assert.throws(() => {
                game.take_animal_card('alice', game.get_data().animalDisplay[0].id);
            }, /only take one animal card/);

            // Alice places all 3 tokens
            game.place_token('alice', 0, 0);
            game.place_token('alice', 1, 0);

            // Cannot end turn with 1 token remaining
            assert.throws(() => {
                game.end_turn('alice');
            }, /You must place all 3 drafted tokens/);

            // Cannot draft a second set of tokens
            assert.throws(() => {
                game.take_market_tokens('alice', 1);
            }, /You may only draft one set of 3 tokens per turn/);

            game.place_token('alice', 2, 0);
            assert.strictEqual(game.get_data().players['alice'].draftedTokens.length, 0);

            // Still cannot draft again after placing all 3
            assert.throws(() => {
                game.take_market_tokens('alice', 1);
            }, /You may only draft one set of 3 tokens per turn/);

            // During Alice's turn, market space 0 remained empty
            assert.strictEqual(game.get_data().market[0].length, 0);

            // Alice ends turn
            game.end_turn('alice');

            // Turn passed to Bob, and market space 0 immediately refilled with 3 tokens
            assert.strictEqual(game.get_data().currentPlayerIndex, 1);
            assert.strictEqual(game.get_data().market[0].length, 3);
        });

        it('disallows ending turn without drafting tokens', () => {
            const game = new HarmoniesGameState(['alice', 'bob'], 'A');
            assert.throws(() => {
                game.end_turn('alice');
            }, /You must draft and place 3 tokens before ending your turn/);
        });

        it('supports selective token placement and undoing placements', () => {
            const game = new HarmoniesGameState(['alice', 'bob'], 'A');
            game.take_market_tokens('alice', 0);
            const initialDraft = [...game.get_data().players['alice'].draftedTokens];
            assert.strictEqual(initialDraft.length, 3);

            // Select and place token at index 1 instead of default 0
            const secondToken = initialDraft[1];
            game.place_token('alice', 0, 0, 1);

            const afterFirstPlace = game.get_data().players['alice'].draftedTokens;
            assert.strictEqual(afterFirstPlace.length, 2);
            assert.deepStrictEqual(afterFirstPlace, [initialDraft[0], initialDraft[2]]);
            assert.strictEqual(game.get_data().players['alice'].board.cells['0,0'].stack[0], secondToken);

            // Cannot undo draft while placed tokens exist
            assert.throws(() => {
                game.undo_token_draft('alice');
            }, /Please undo placed tokens on your board before undoing draft/);

            // Undo the placement
            game.undo_token_placement('alice');
            assert.strictEqual(game.get_data().players['alice'].board.cells['0,0'].stack.length, 0);
            assert.deepStrictEqual(game.get_data().players['alice'].draftedTokens, initialDraft);

            // Cannot undo placement when none are placed
            assert.throws(() => {
                game.undo_token_placement('alice');
            }, /No placed tokens to undo/);
        });

        /**
         * Seeds a game where Alice already holds W2 (mountain height 3 + adjacent water,
         * cube lands on the water) with the matching habitat built at (1,1)/(2,1).
         */
        const seedCubeReadyGame = (): HarmoniesGameState => {
            const base = new HarmoniesGameState(['alice', 'bob'], 'A');
            const data = base.get_data();
            const w2 = getAnimalCardSpec('W2')!;

            data.players['alice'].board.cells[coordKey({ q: 1, r: 1 })].stack = ['gray', 'gray', 'gray'];
            data.players['alice'].board.cells[coordKey({ q: 2, r: 1 })].stack = ['blue'];
            data.animalDisplay[0] = w2;

            return HarmoniesGameState.from_data(data);
        };

        it('supports undoing an animal cube placement', () => {
            const game = seedCubeReadyGame();
            const w2Id = game.get_data().animalDisplay[0].id;

            game.take_animal_card('alice', w2Id);
            const cubesAfterTake = game.get_data().players['alice'].hand[0].cubesLeft;

            game.place_animal_cube('alice', w2Id, 2, 1);
            let alice = game.get_data().players['alice'];
            assert.strictEqual(alice.board.cells['2,1'].cube, 'animal');
            assert.strictEqual(alice.hand[0].cubesLeft, cubesAfterTake - 1);
            assert.strictEqual(alice.cubePlacements.length, 1);

            game.undo_animal_cube('alice');
            alice = game.get_data().players['alice'];
            assert.ok(!alice.board.cells['2,1'].cube);
            assert.strictEqual(alice.hand[0].cubesLeft, cubesAfterTake);
            assert.strictEqual(alice.cubePlacements.length, 0);

            assert.throws(() => {
                game.undo_animal_cube('alice');
            }, /No animal cubes to undo/);
        });

        it('pulls a completed card back into hand when undoing its final cube', () => {
            const game = seedCubeReadyGame();
            const w2Id = game.get_data().animalDisplay[0].id;
            game.take_animal_card('alice', w2Id);

            // Bring the card down to its last cube so this placement completes it.
            const primed = game.get_data();
            primed.players['alice'].hand[0].cubesLeft = 1;
            const game2 = HarmoniesGameState.from_data(primed);

            game2.place_animal_cube('alice', w2Id, 2, 1);
            let alice = game2.get_data().players['alice'];
            assert.strictEqual(alice.hand.length, 0);
            assert.strictEqual(alice.completed.length, 1);
            assert.strictEqual(alice.completed[0].id, w2Id);

            game2.undo_animal_cube('alice');
            alice = game2.get_data().players['alice'];
            assert.strictEqual(alice.completed.length, 0);
            assert.strictEqual(alice.hand.length, 1);
            assert.strictEqual(alice.hand[0].card.id, w2Id);
            assert.strictEqual(alice.hand[0].cubesLeft, 1);
            assert.ok(!alice.board.cells['2,1'].cube);
        });

        it('supports undoing an animal card draft back into the display', () => {
            const game = new HarmoniesGameState(['alice', 'bob'], 'A');
            const before = game.get_data();
            const cardId = before.animalDisplay[1].id;
            const reserveBefore = before.cubeReserve;

            game.take_animal_card('alice', cardId);
            let data = game.get_data();
            assert.strictEqual(data.players['alice'].hand.length, 1);
            assert.strictEqual(data.animalDisplay.length, 4);
            assert.ok(data.cubeReserve < reserveBefore);

            game.undo_take_animal_card('alice');
            data = game.get_data();
            assert.strictEqual(data.players['alice'].hand.length, 0);
            assert.strictEqual(data.players['alice'].hasTakenCardThisTurn, false);
            assert.strictEqual(data.cubeReserve, reserveBefore);
            assert.strictEqual(data.animalDisplay.length, 5);
            assert.strictEqual(data.animalDisplay[1].id, cardId);

            // Nothing left to undo, and a different card can now be drafted instead.
            assert.throws(() => {
                game.undo_take_animal_card('alice');
            }, /No drafted animal card to undo/);

            game.take_animal_card('alice', game.get_data().animalDisplay[3].id);
            assert.strictEqual(game.get_data().players['alice'].hand.length, 1);
        });

        it('blocks undoing a card draft until its cubes come off the board', () => {
            const game = seedCubeReadyGame();
            const w2Id = game.get_data().animalDisplay[0].id;

            game.take_animal_card('alice', w2Id);
            game.place_animal_cube('alice', w2Id, 2, 1);

            assert.throws(() => {
                game.undo_take_animal_card('alice');
            }, /undo animal cubes placed from this card/);

            game.undo_animal_cube('alice');
            game.undo_take_animal_card('alice');

            const data = game.get_data();
            assert.strictEqual(data.players['alice'].hand.length, 0);
            assert.strictEqual(data.animalDisplay.length, 5);
        });

        it('blocks undoing a token that a later animal cube was scored on', () => {
            // Same W2 habitat, but the water half is placed from Alice's draft this turn.
            const base = new HarmoniesGameState(['alice', 'bob'], 'A');
            const seed = base.get_data();
            const w2 = getAnimalCardSpec('W2')!;
            seed.players['alice'].board.cells[coordKey({ q: 1, r: 1 })].stack = ['gray', 'gray', 'gray'];
            seed.animalDisplay[0] = w2;
            const game = HarmoniesGameState.from_data(seed);

            game.take_animal_card('alice', w2.id);
            game.take_market_tokens('alice', 0);

            // Force a deterministic draft so the water token is available to place.
            const drafted = game.get_data();
            drafted.players['alice'].draftedTokens = ['blue', 'blue', 'blue'];
            const game2 = HarmoniesGameState.from_data(drafted);

            // All 3 drafted tokens must be down before a cube may be placed, so the
            // water half of the habitat goes last and is the placement under test.
            game2.place_token('alice', 0, 0, 0);
            game2.place_token('alice', 1, 0, 0);
            game2.place_token('alice', 2, 1, 0);
            assert.strictEqual(game2.get_data().players['alice'].draftedTokens.length, 0);

            game2.place_animal_cube('alice', w2.id, 2, 1);

            assert.throws(() => {
                game2.undo_token_placement('alice');
            }, /undo animal cubes placed after this token first/);

            game2.undo_animal_cube('alice');
            game2.undo_token_placement('alice');

            const alice = game2.get_data().players['alice'];
            assert.strictEqual(alice.board.cells['2,1'].stack.length, 0);
            assert.strictEqual(alice.draftedTokens.length, 1);
        });

        it('refuses animal cubes while drafted tokens are still unplaced', () => {
            const game = seedCubeReadyGame();
            const w2Id = game.get_data().animalDisplay[0].id;
            game.take_animal_card('alice', w2Id);
            game.take_market_tokens('alice', 0);

            assert.throws(() => {
                game.place_animal_cube('alice', w2Id, 2, 1);
            }, /Place all drafted tokens before placing animal cubes/);

            // Once the draft is emptied onto the board, the cube is allowed.
            game.place_token('alice', 0, 0, 0);
            game.place_token('alice', 1, 0, 0);
            game.place_token('alice', 0, 1, 0);
            assert.strictEqual(game.get_data().players['alice'].draftedTokens.length, 0);

            game.place_animal_cube('alice', w2Id, 2, 1);
            assert.strictEqual(game.get_data().players['alice'].board.cells['2,1'].cube, 'animal');
        });

        it('supports undoing token draft back to market space', () => {
            const game = new HarmoniesGameState(['alice', 'bob'], 'A');
            const marketSpaceTokens = [...game.get_data().market[2]];
            assert.strictEqual(marketSpaceTokens.length, 3);

            // Alice drafts space 2
            game.take_market_tokens('alice', 2);
            assert.strictEqual(game.get_data().market[2].length, 0);
            assert.strictEqual(game.get_data().players['alice'].hasDraftedTokensThisTurn, true);
            assert.deepStrictEqual(game.get_data().players['alice'].draftedTokens, marketSpaceTokens);

            // Alice changes her mind and undoes the draft
            game.undo_token_draft('alice');
            assert.strictEqual(game.get_data().players['alice'].draftedTokens.length, 0);
            assert.strictEqual(game.get_data().players['alice'].hasDraftedTokensThisTurn, false);
            assert.deepStrictEqual(game.get_data().market[2], marketSpaceTokens);

            // Alice can now draft space 1 instead
            game.take_market_tokens('alice', 1);
            assert.strictEqual(game.get_data().market[1].length, 0);
            assert.strictEqual(game.get_data().players['alice'].draftedTokens.length, 3);
        });
    });
});
