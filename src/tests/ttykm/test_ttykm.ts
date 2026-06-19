import { describe, it } from 'mocha';
import { strict as assert } from 'assert';
import { TTYKMGameState } from '../../rules/ttykm/ttykm_state';

describe('TTYKM Game State Logic', () => {
    // Helper to get coordinates
    const UP = { dx: 0, dy: -1 };
    const DOWN = { dx: 0, dy: 1 };
    const LEFT = { dx: -1, dy: 0 };
    const RIGHT = { dx: 1, dy: 0 };

    describe('Setup & Initialization', () => {
        it('should initialize game state with default configuration', () => {
            const state = new TTYKMGameState();
            assert.equal(state.turn, 0);
            assert.equal(state.turnStep, 0);
            assert.equal(state.winner, -1);
            assert.equal(state.status, 'playing');

            // 3 eras, 16 spaces each
            assert.equal(state.boards.length, 3);
            for (let era = 0; era < 3; era++) {
                assert.equal(state.boards[era].length, 16);
                // White starts on space 1 (index 0), Black on space 16 (index 15)
                assert.equal(state.boards[era][0].player, 0);
                assert.equal(state.boards[era][15].player, 1);
            }

            // Focus tokens: White on Past (0), Black on Future (2)
            assert.equal(state.focusTokens[0], 0);
            assert.equal(state.focusTokens[1], 2);

            // Supplies: 4 copies in reserve, 3 statues, 3 hats
            assert.deepEqual(state.supplies.playerCopies, [4, 4]);
            assert.deepEqual(state.supplies.statues, [3, 3]);
            assert.deepEqual(state.supplies.hats, [3, 3]);
            assert.equal(state.supplies.seeds, 5);
            assert.equal(state.supplies.shrubs, 5);
            assert.equal(state.supplies.trees, 5);
            assert.equal(state.supplies.fallenTrees, 5);
        });

        it('should correctly configure modules', () => {
            const state = new TTYKMGameState({
                growthModule: false,
                influenceModule: false,
                memoryModule: false
            });

            // Yellow statues should not be initialized
            for (let era = 0; era < 3; era++) {
                for (let s = 0; s < 16; s++) {
                    assert.equal(state.boards[era][s].statue, null);
                    assert.equal(state.boards[era][s].elephant, null);
                }
            }
        });

        it('should setup yellow statues when influenceModule is enabled', () => {
            const state = new TTYKMGameState({ influenceModule: true });
            for (let era = 0; era < 3; era++) {
                assert.equal(state.boards[era][6].statue, 10); // space 7 (index 6)
            }
        });

        it('should setup elephants when memoryModule is enabled', () => {
            const state = new TTYKMGameState({ memoryModule: true });
            for (let era = 0; era < 3; era++) {
                assert.equal(state.boards[era][3].elephant, 'dark');  // space 4 (index 3)
                assert.equal(state.boards[era][12].elephant, 'light'); // space 13 (index 12)
            }
        });
    });

    describe('Basic Actions & Turn Loop', () => {
        it('should allow active copy selection, movement, and focus token movement', () => {
            const state = new TTYKMGameState({ growthModule: false, influenceModule: false, memoryModule: false });
            
            // White player's turn. Focused era is Past (0). Copy at space 1 (index 0).
            assert.equal(state.turn, 0);
            assert.equal(state.turnStep, 0); // Choose active copy

            // Try invalid copy selection
            assert.throws(() => state.selectCopy(15)); // Black copy
            assert.throws(() => state.selectCopy(1));  // Empty space

            // Valid copy selection
            state.selectCopy(0);
            assert.equal(state.turnStep, 1); // Take Actions
            assert.equal(state.activeCopySpace, 0);
            assert.equal(state.actionsRemaining, 2);

            // Action 1: Move right
            state.performAction({ type: 'move', dir: RIGHT });
            assert.equal(state.activeCopySpace, 1);
            assert.equal(state.actionsRemaining, 1);
            assert.equal(state.boards[0][0].player, null);
            assert.equal(state.boards[0][1].player, 0);

            // Action 2: Move down
            state.performAction({ type: 'move', dir: DOWN });
            assert.equal(state.activeCopySpace, 5); // index 1 + 4 = 5
            assert.equal(state.actionsRemaining, 0);
            assert.equal(state.turnStep, 2); // Move focus token

            // Try invalid focus token move
            assert.throws(() => state.moveFocusToken(0)); // Cannot focus on same era
            
            // Move focus token to Present (1)
            state.moveFocusToken(1);
            assert.equal(state.turn, 1); // Now Black's turn
            assert.equal(state.turnStep, 0);
            assert.equal(state.focusTokens[0], 1); // White's focus is now Present
        });

        it('should allow skipping remaining actions', () => {
            const state = new TTYKMGameState({ growthModule: false, influenceModule: false, memoryModule: false });
            state.selectCopy(0);
            state.performAction({ type: 'move', dir: RIGHT });
            assert.equal(state.actionsRemaining, 1);

            state.skipActions();
            assert.equal(state.turnStep, 2);
            assert.equal(state.actionsRemaining, 0);
        });
    });

    describe('Pushes, Squishes & Paradoxes', () => {
        it('should push opponent copy', () => {
            const state = new TTYKMGameState({ growthModule: false, influenceModule: false, memoryModule: false });
            // Set up opponent on space 2 (index 1) of Past board
            state.boards[0][1].player = 1;
            
            state.selectCopy(0);
            // Move right, pushing opponent from index 1 to index 2
            state.performAction({ type: 'move', dir: RIGHT });
            assert.equal(state.boards[0][0].player, null);
            assert.equal(state.boards[0][1].player, 0);
            assert.equal(state.boards[0][2].player, 1);
        });

        it('should squish (eliminate) opponent copy if pushed off board', () => {
            const state = new TTYKMGameState({ growthModule: false, influenceModule: false, memoryModule: false });
            // White is at index 0, opponent at index 1, index 2, index 3
            state.boards[0][1].player = 1;
            state.boards[0][2].player = 1;
            state.boards[0][3].player = 1;

            state.selectCopy(0);
            // Move right, pushing opponent at index 3 off the board (squished)
            state.performAction({ type: 'move', dir: RIGHT });
            assert.equal(state.boards[0][0].player, null);
            assert.equal(state.boards[0][1].player, 0);
            assert.equal(state.boards[0][2].player, 1);
            assert.equal(state.boards[0][3].player, 1);
        });

        it('should trigger paradox (mutual destruction) when pushing opponent into opponent against blocked wall', () => {
            const state = new TTYKMGameState({ growthModule: false, influenceModule: false, memoryModule: false });
            // White is at index 0. Opponents are at index 1 and index 2.
            state.boards[0][1].player = 1;
            state.boards[0][2].player = 1;
            // Block index 3 by putting a White player copy there. White cannot push own pieces, so Opponent 2 cannot be pushed.
            state.boards[0][3].player = 0;

            state.selectCopy(0);
            // Move right: pushes Opponent 1 into Opponent 2. Opponent 2 cannot move because index 3 has White player copy.
            // This triggers Paradox. Both Opponent 1 and Opponent 2 are destroyed!
            state.performAction({ type: 'move', dir: RIGHT });
            assert.equal(state.boards[0][0].player, null);
            assert.equal(state.boards[0][1].player, 0); // White moved to index 1
            assert.equal(state.boards[0][2].player, null); // Opponent 1 destroyed
            assert.equal(state.boards[0][3].player, 0); // White copy remains
        });
    });

    describe('Time Travel', () => {
        it('should travel forward without spending copy', () => {
            const state = new TTYKMGameState({ growthModule: false, influenceModule: false, memoryModule: false });
            // Clear Present destination space index 0 so time travel forward is legal
            state.boards[1][0].player = null;
            // White focus is Past (0)
            state.selectCopy(0);
            state.performAction({ type: 'timeTravelForward' });

            assert.equal(state.boards[0][0].player, null); // Left Past
            assert.equal(state.boards[1][0].player, 0);    // Arrived at Present
            assert.equal(state.focusTokens[0], 1);          // Focus token moves to Present
            assert.equal(state.supplies.playerCopies[0], 4); // Supply is unchanged
        });

        it('should travel backward spending supply copy and leaving duplicate behind', () => {
            const state = new TTYKMGameState({ growthModule: false, influenceModule: false, memoryModule: false });
            // Move focus to Present first so we can travel backward to Past
            state.selectCopy(0);
            state.skipActions();
            state.moveFocusToken(1); // White focus is now Present (1)
            
            // Black's turn: skip to move focus to Past/Present
            state.selectCopy(15);
            state.skipActions();
            state.moveFocusToken(1); // Black focus is now Present (1)

            // Clear Past destination space index 0 so time travel backward is legal
            state.boards[0][0].player = null;

            // White's turn again. Focus is Present (1). Let's select copy at space 1 (index 0).
            state.selectCopy(0);
            state.performAction({ type: 'timeTravelBackward' });

            assert.equal(state.boards[1][0].player, 0);    // Original stays in Present
            assert.equal(state.boards[0][0].player, 0);    // New copy placed in Past
            assert.equal(state.focusTokens[0], 0);          // Focus token moves to Past
            assert.equal(state.supplies.playerCopies[0], 3); // Deducted one copy from reserve
        });
    });

    describe('Growth Module', () => {
        it('should propagate planting and removing seeds', () => {
            const state = new TTYKMGameState({ growthModule: true, influenceModule: false, memoryModule: false });
            state.selectCopy(0); // Past

            // Action 1: Plant seed at index 1 (space 2)
            state.performAction({ type: 'plantSeed', targetSpace: 1 });
            
            assert.equal(state.boards[0][1].seed, true);
            assert.equal(state.boards[1][1].shrub, true); // Propagated to Present as Shrub
            assert.equal(state.boards[2][1].tree, true);   // Propagated to Future as Tree
            assert.equal(state.supplies.seeds, 4);
            assert.equal(state.supplies.shrubs, 4);
            assert.equal(state.supplies.trees, 4);

            // Action 2: Remove seed
            state.performAction({ type: 'removeSeed', targetSpace: 1 });
            assert.equal(state.boards[0][1].seed, false);
            assert.equal(state.boards[1][1].shrub, false);
            assert.equal(state.boards[2][1].tree, false);
            assert.equal(state.supplies.seeds, 5);
            assert.equal(state.supplies.shrubs, 5);
            assert.equal(state.supplies.trees, 5);
        });

        it('should topple trees when pushed', () => {
            const state = new TTYKMGameState({ growthModule: true, influenceModule: false, memoryModule: false });
            
            // Set up a tree at index 1 on Past (0) board
            state.boards[0][1].tree = true;

            state.selectCopy(0);
            // Move right, pushing index 1 (tree) to index 2
            // The tree should topple and become a fallenTree trunk pointing to index 1
            state.performAction({ type: 'move', dir: RIGHT });

            assert.equal(state.boards[0][0].player, null);
            assert.equal(state.boards[0][1].player, 0); // Player occupies index 1 now
            assert.equal(state.boards[0][2].fallenTree, 1); // Fallen tree at index 2, pointing to trunk origin index 1
            assert.equal(state.supplies.trees, 6); // Tree returned to supply
            assert.equal(state.supplies.fallenTrees, 4); // Fallen tree taken from supply
        });

        it('should squish players and crush seeds when tree topples onto them', () => {
            const state = new TTYKMGameState({ growthModule: true, influenceModule: false, memoryModule: false });
            state.boards[0][1].tree = true;
            state.boards[0][2].player = 1; // Opponent at index 2
            state.boards[0][2].seed = true;  // Seed at index 2

            state.selectCopy(0);
            state.performAction({ type: 'move', dir: RIGHT });

            assert.equal(state.boards[0][2].player, null); // Opponent squished
            assert.equal(state.boards[0][2].seed, false);  // Seed crushed
            assert.equal(state.boards[0][2].fallenTree, 1);
        });
    });

    describe('Influence Module', () => {
        it('should build statue and propagate builds', () => {
            const state = new TTYKMGameState({ growthModule: false, influenceModule: true, memoryModule: false });
            state.selectCopy(0);

            // White builds statue at index 1 (space 2)
            state.performAction({ type: 'buildStatue', targetSpace: 1 });
            
            assert.equal(state.boards[0][1].statue, 0); // White statue on Past
            assert.equal(state.boards[1][1].statue, 0); // Propagated to Present
            assert.equal(state.boards[2][1].statue, 0); // Propagated to Future
            assert.equal(state.supplies.statues[0], 0); // All 3 statues of player 0 built
            assert.equal(state.statueBuilt[0], true);
        });

        it('should block build propagation under 2023 rules', () => {
            const state = new TTYKMGameState({ growthModule: false, influenceModule: true, memoryModule: false, reboundRule: '2023' });
            // Place absolute immovable obstacle (shrub) on Present space index 1
            state.boards[1][1].shrub = true;

            state.selectCopy(0);
            state.performAction({ type: 'buildStatue', targetSpace: 1 });

            assert.equal(state.boards[0][1].statue, 0); // Past has statue
            assert.equal(state.boards[1][1].statue, null); // Present blocked, did not build
            assert.equal(state.boards[2][1].statue, null); // Future blocked
        });

        it('should rebound build propagation under 2021 rules', () => {
            const state = new TTYKMGameState({ growthModule: false, influenceModule: true, memoryModule: false, reboundRule: '2021' });
            // Place absolute immovable obstacle (shrub) on Present space index 1
            state.boards[1][1].shrub = true;
            // Clear Present index 0 so the rebound target is empty
            state.boards[1][0].player = null;

            state.selectCopy(0);
            state.performAction({ type: 'buildStatue', targetSpace: 1 });

            assert.equal(state.boards[0][1].statue, 0); // Past built
            // Present index 1 blocked. Rebounds in opposite direction of RIGHT, i.e. LEFT.
            // Target is index 0.
            assert.equal(state.boards[1][0].statue, 0); // Rebounded build placed at index 0 on Present
        });

        it('should pull statues when moving away from them', () => {
            const state = new TTYKMGameState({ growthModule: false, influenceModule: true, memoryModule: false });
            // Set up White statue at index 0, White copy at index 1
            state.boards[0][0].statue = 0;
            state.boards[0][0].player = null;
            state.boards[0][1].player = 0;

            state.selectCopy(1);
            // Move right to index 2, and specify pulling statue from index 0
            state.performAction({ type: 'move', dir: RIGHT, pullStatueSpace: 0 });

            assert.equal(state.boards[0][0].statue, null);
            assert.equal(state.boards[0][1].statue, 0);    // Statue pulled to index 1
            assert.equal(state.boards[0][2].player, 0);    // Player at index 2
        });

        it('should recursively propagate statue movement from Past through to Future', () => {
            const state = new TTYKMGameState({ growthModule: false, influenceModule: true, memoryModule: false });
            // Set up White statues at index 5 on all three boards
            state.boards[0][5].statue = 0;
            state.boards[1][5].statue = 0;
            state.boards[2][5].statue = 0;
            state.supplies.statues[0] = 0;

            // Player copy at index 1 on Past (0)
            state.boards[0][1].player = 0;

            state.selectCopy(1);
            // Move from index 1 down (DOWN is index 1 + 4 = 5) pushing statue at index 5 to index 9
            // This statue push should propagate to Present (index 5 to 9) and Future (index 5 to 9)
            state.performAction({ type: 'move', dir: DOWN });

            assert.equal(state.boards[0][5].player, 0); // Player moved to index 5 on Past
            assert.equal(state.boards[0][9].statue, 0);  // Statue pushed to index 9 on Past
            assert.equal(state.boards[1][9].statue, 0);  // Pushed to index 9 on Present (propagated)
            assert.equal(state.boards[2][9].statue, 0);  // Pushed to index 9 on Future (propagated recursively)
            assert.equal(state.boards[1][5].statue, null); // Vacated Present space
            assert.equal(state.boards[2][5].statue, null); // Vacated Future space
        });
    });

    describe('Memory Module', () => {
        it('should train elephant and propagate hats', () => {
            const state = new TTYKMGameState({ growthModule: false, influenceModule: false, memoryModule: true });

            // Let's place White copy at index 2 first so it is adjacent to index 3 (dark elephant).
            state.boards[0][0].player = null;
            state.boards[0][2].player = 0;

            state.selectCopy(2);
            state.performAction({ type: 'trainElephant', targetSpace: 3 });

            assert.equal(state.boards[0][3].hat, 0); // Trained on Past
            assert.equal(state.boards[1][3].hat, 0); // Propagated to Present
            assert.equal(state.boards[2][3].hat, 0); // Propagated to Future
            assert.equal(state.supplies.hats[0], 0); // All 3 hats spent
        });

        it('should command trained elephant to move and push/trample', () => {
            const state = new TTYKMGameState({ growthModule: false, influenceModule: false, memoryModule: true });
            // Train dark elephant at index 3.
            state.boards[0][3].hat = 0;
            state.boards[1][3].hat = 0;
            state.boards[2][3].hat = 0;
            state.supplies.hats[0] = 0;

            // Put opponent copy at index 2
            state.boards[0][2].player = 1;

            state.selectCopy(0);
            // Command elephant to move LEFT from index 3 to index 2, trampling opponent at index 2
            state.performAction({ type: 'commandElephant', elephantSpace: 3, dir: LEFT });

            assert.equal(state.boards[0][3].elephant, null); // Left index 3
            assert.equal(state.boards[0][2].elephant, 'dark'); // Arrived at index 2
            assert.equal(state.boards[0][2].hat, 0);
            assert.equal(state.boards[0][2].player, null); // Opponent squished/trampled!
        });
    });

    describe('Win Conditions', () => {
        it('should detect when opponent is eliminated from all but one era', () => {
            const state = new TTYKMGameState({ growthModule: false, influenceModule: false, memoryModule: false });
            
            // White focus is Past (0)
            state.selectCopy(0);
            state.skipActions();

            // Opponent has copies on Past, Present, Future (initially).
            // Let's delete the opponent copies on Present (1) and Future (2)
            state.boards[1][15].player = null;
            state.boards[2][15].player = null;

            // Move focus token. This triggers win condition checks at end of turn.
            state.moveFocusToken(1);

            assert.equal(state.status, 'gameover');
            assert.equal(state.winner, 0); // White wins!
        });
    });
});
