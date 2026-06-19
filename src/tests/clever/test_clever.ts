/**
 * test_clever.ts - Comprehensive unit tests for Clever (That's Pretty Clever) game logic
 */

import { describe, it } from 'mocha';
import { strict as assert } from 'assert';
import { CleverGameState, GameStatus, DieColor, BLUE_POINTS, GREEN_POINTS } from '../../rules/clever/CleverGameState';

describe('Clever Game Logic', () => {
    describe('Initialization & Setup', () => {
        it('should initialize a 3-player game correctly', () => {
            const players = ['alice', 'bob', 'charlie'];
            const game = new CleverGameState(players);
            const data = game.get_data();

            assert.equal(data.status, GameStatus.RoundStartBonus);
            assert.equal(data.round, 1);
            assert.equal(data.totalRounds, 5); // 3 players -> 5 rounds
            assert.equal(data.playerIds.length, 3);
            assert.equal(data.activePlayerIndex, 0);
            assert.equal(data.isSolo, false);

            for (const id of players) {
                const pState = data.players[id];
                assert.equal(pState.id, id);
                
                // Yellow opposite diagonal pre-marked (true)
                // Diagonal: [0][3], [1][2], [2][1], [3][0]
                assert.equal(pState.yellow[0][3], true);
                assert.equal(pState.yellow[1][2], true);
                assert.equal(pState.yellow[2][1], true);
                assert.equal(pState.yellow[3][0], true);
                // Others are false
                assert.equal(pState.yellow[0][0], false);

                // Other tracks are empty
                assert.equal(pState.blue.every(x => !x), true);
                assert.equal(pState.green, 0);
                assert.equal(pState.orange.every(x => x === null), true);
                assert.equal(pState.purple.every(x => x === null), true);

                // Check bonuses queue (starts empty, gets populated after round start bonus is processed)
                assert.equal(pState.bonusesToResolve.length, 0);
            }
        });

        it('should initialize a Solo game correctly with 6 rounds', () => {
            const players = ['alice'];
            const game = new CleverGameState(players);
            const data = game.get_data();

            assert.equal(data.isSolo, true);
            assert.equal(data.totalRounds, 6); // 1 player -> 6 rounds
        });
    });

    describe('Core Active Turn Flow', () => {
        it('should perform active player roll and dice picking with tray placement', () => {
            const players = ['alice', 'bob'];
            const game = new CleverGameState(players);
            
            // Start the game to trigger round start bonuses and active turn setup
            game.start_game();

            const data1 = game.get_data();
            // Round 1 start bonus is automatic, so it immediately starts active turn in ActiveRolling state
            assert.equal(data1.status, GameStatus.ActiveRolling);
            
            // For round 1: 
            // In 1-4 players: Round 1 gives a Reroll bonus.
            // Let's check if Alice has rerollsTotal = 1.
            assert.equal(data1.players['alice'].rerollsTotal, 1);
            
            // Let's mock a roll state to test deterministic dice drafting
            const mockData = { ...data1 };
            mockData.status = GameStatus.ActiveChoosing;
            mockData.rollCount = 1;
            mockData.poolDice = [
                { color: 'white', value: 1 },
                { color: 'yellow', value: 1 },
                { color: 'blue', value: 1 },
                { color: 'green', value: 1 },
                { color: 'orange', value: 1 },
                { color: 'purple', value: 1 }
            ];
            mockData.rolledDice = [
                { color: 'white', value: 4 },
                { color: 'yellow', value: 3 },
                { color: 'blue', value: 5 },
                { color: 'green', value: 2 },
                { color: 'orange', value: 6 },
                { color: 'purple', value: 1 }
            ];
            mockData.activePickedDice = [];
            mockData.trayDice = [];

            const gameMock = CleverGameState.from_data(mockData);

            // Alice picks yellow (value 3)
            gameMock.pick_active_die('alice', 'yellow');

            const afterPick = gameMock.get_data();
            
            // Active picked dice should contain yellow:3
            assert.equal(afterPick.activePickedDice.length, 1);
            assert.equal(afterPick.activePickedDice[0].color, 'yellow');
            assert.equal(afterPick.activePickedDice[0].value, 3);

            // Dice strictly lower than 3 are green:2 and purple:1. They should go to the silver tray.
            assert.equal(afterPick.trayDice.length, 2);
            assert(afterPick.trayDice.some(d => d.color === 'green' && d.value === 2));
            assert(afterPick.trayDice.some(d => d.color === 'purple' && d.value === 1));

            // Remaining available pool dice should exclude yellow, green, purple
            // So they should be white, blue, orange
            assert.equal(afterPick.poolDice.length, 3);
            assert(afterPick.poolDice.some(d => d.color === 'white'));
            assert(afterPick.poolDice.some(d => d.color === 'blue'));
            assert(afterPick.poolDice.some(d => d.color === 'orange'));
            assert(!afterPick.poolDice.some(d => d.color === 'yellow'));
            assert(!afterPick.poolDice.some(d => d.color === 'green'));
            assert(!afterPick.poolDice.some(d => d.color === 'purple'));

            // Yellow sheet box for 3 should be marked
            // The Yellow grid value at index [0][0] is 3. It should be true.
            assert.equal(afterPick.players['alice'].yellow[0][0], true);
        });
    });

    describe('Passive Turn Flow', () => {
        it('should allow passive player to choose a die from the silver tray', () => {
            const players = ['alice', 'bob'];
            const game = new CleverGameState(players);
            game.start_game();

            // Set up a mock state where alice (active) has finished picking her 3 dice
            const mockData = game.get_data();
            mockData.status = GameStatus.PassiveChoosing;
            mockData.activePlayerIndex = 0; // alice is active
            mockData.trayDice = [
                { color: 'green', value: 4 },
                { color: 'blue', value: 3 }
            ];
            mockData.activePickedDice = [
                { color: 'yellow', value: 5 },
                { color: 'white', value: 5 },
                { color: 'orange', value: 5 }
            ];
            mockData.players['bob'].extraDicePickedThisTurn = [];
            mockData.players['bob'].hasConfirmedPassiveSelection = false;

            const gameMock = CleverGameState.from_data(mockData);

            // Bob picks green die from silver tray
            gameMock.pick_passive_die('bob', 'green');

            const afterBobPick = gameMock.get_data();
            // Bob's green track should be updated to 1
            assert.equal(afterBobPick.players['bob'].green, 1);
            // Bob's extraDicePickedThisTurn should contain 'green'
            assert.deepEqual(afterBobPick.players['bob'].extraDicePickedThisTurn, ['green']);
        });

        it('should require independent passive confirmations and progress automatically once all confirmed', () => {
            const players = ['alice', 'bob', 'charlie'];
            const game = new CleverGameState(players);
            game.start_game();

            const mockData = game.get_data();
            mockData.status = GameStatus.PassiveChoosing;
            mockData.activePlayerIndex = 0; // alice active, bob & charlie passive
            mockData.trayDice = [
                { color: 'green', value: 4 },
                { color: 'blue', value: 3 }
            ];
            mockData.activePickedDice = [
                { color: 'yellow', value: 5 },
                { color: 'white', value: 5 },
                { color: 'orange', value: 5 }
            ];
            mockData.players['bob'].extraDicePickedThisTurn = [];
            mockData.players['bob'].hasConfirmedPassiveSelection = false;
            mockData.players['charlie'].extraDicePickedThisTurn = [];
            mockData.players['charlie'].hasConfirmedPassiveSelection = false;

            const gameMock = CleverGameState.from_data(mockData);

            // Bob picks green
            gameMock.pick_passive_die('bob', 'green');
            assert.equal(gameMock.get_data().players['bob'].hasConfirmedPassiveSelection, false);

            // Bob confirms his selection
            gameMock.confirm_passive_selection('bob');

            let currentData = gameMock.get_data();
            // Bob should be confirmed, Charlie not
            assert.equal(currentData.players['bob'].hasConfirmedPassiveSelection, true);
            assert.equal(currentData.players['charlie'].hasConfirmedPassiveSelection, false);
            // Game status should still be PassiveChoosing
            assert.equal(currentData.status, GameStatus.PassiveChoosing);

            // Charlie picks blue
            gameMock.pick_passive_die('charlie', 'blue');
            assert.equal(gameMock.get_data().players['charlie'].hasConfirmedPassiveSelection, false);

            // Charlie confirms his selection
            gameMock.confirm_passive_selection('charlie');

            const finalData = gameMock.get_data();
            // Since all passive players confirmed, game should automatically progress to Bob's active turn!
            assert.equal(finalData.activePlayerIndex, 1); // bob's index is 1
            assert.equal(finalData.status, GameStatus.ActiveRolling); // next active rolling
            
            // Check that confirmation flags were reset for all players
            for (const id of players) {
                assert.equal(finalData.players[id].hasConfirmedPassiveSelection, false);
                assert.equal(finalData.players[id].extraDicePickedThisTurn.length, 0);
            }
        });

        it('should allow passive player to change their selection before confirming, correctly restoring previous state', () => {
            const players = ['alice', 'bob'];
            const game = new CleverGameState(players);
            game.start_game();

            const mockData = game.get_data();
            mockData.status = GameStatus.PassiveChoosing;
            mockData.activePlayerIndex = 0; // alice is active
            mockData.trayDice = [
                { color: 'green', value: 4 },
                { color: 'blue', value: 3 }
            ];
            mockData.activePickedDice = [
                { color: 'yellow', value: 5 },
                { color: 'white', value: 5 },
                { color: 'orange', value: 5 }
            ];
            mockData.players['bob'].extraDicePickedThisTurn = [];
            mockData.players['bob'].hasConfirmedPassiveSelection = false;

            // Mock starting player state snapshot
            mockData.passiveStartPlayerStates = {
                'bob': JSON.parse(JSON.stringify(mockData.players['bob']))
            };

            const gameMock = CleverGameState.from_data(mockData);

            // Bob picks green die first
            gameMock.pick_passive_die('bob', 'green');
            
            let dataAfterFirstPick = gameMock.get_data();
            assert.equal(dataAfterFirstPick.players['bob'].green, 1);
            assert.deepEqual(dataAfterFirstPick.players['bob'].extraDicePickedThisTurn, ['green']);

            // Bob changes his mind and picks blue die
            gameMock.pick_passive_die('bob', 'blue');

            let dataAfterSecondPick = gameMock.get_data();
            // Bob's green track should be restored to 0!
            assert.equal(dataAfterSecondPick.players['bob'].green, 0);
            // Bob's blue track (sum: blue:3 + white:5 = 8 -> index 6) should be marked true!
            assert.equal(dataAfterSecondPick.players['bob'].blue[6], true);
            // Bob's extraDicePickedThisTurn should contain 'blue'
            assert.deepEqual(dataAfterSecondPick.players['bob'].extraDicePickedThisTurn, ['blue']);
        });

        it('should suppress log lines during passive selection changes and only log finalized picks once all confirmed', () => {
            const players = ['alice', 'bob', 'charlie'];
            const game = new CleverGameState(players);
            game.start_game();

            const mockData = game.get_data();
            mockData.status = GameStatus.PassiveChoosing;
            mockData.activePlayerIndex = 0; // alice active, bob & charlie passive
            mockData.trayDice = [
                { color: 'green', value: 4 },
                { color: 'blue', value: 3 }
            ];
            mockData.activePickedDice = [
                { color: 'yellow', value: 5 },
                { color: 'white', value: 5 },
                { color: 'orange', value: 5 }
            ];
            mockData.players['bob'].extraDicePickedThisTurn = [];
            mockData.players['bob'].hasConfirmedPassiveSelection = false;
            mockData.players['charlie'].extraDicePickedThisTurn = [];
            mockData.players['charlie'].hasConfirmedPassiveSelection = false;

            mockData.passiveStartPlayerStates = {
                'bob': JSON.parse(JSON.stringify(mockData.players['bob'])),
                'charlie': JSON.parse(JSON.stringify(mockData.players['charlie']))
            };

            const gameMock = CleverGameState.from_data(mockData);

            // Initially logs are empty or just start game log lines
            const initialLogCount = gameMock.get_data().gameLogs.length;

            // Bob drafts green
            gameMock.pick_passive_die('bob', 'green');
            assert.equal(gameMock.get_data().gameLogs.length, initialLogCount); // Suppressed!

            // Bob changes to blue
            gameMock.pick_passive_die('bob', 'blue');
            assert.equal(gameMock.get_data().gameLogs.length, initialLogCount); // Suppressed!

            // Bob confirms
            gameMock.confirm_passive_selection('bob');
            assert.equal(gameMock.get_data().gameLogs.length, initialLogCount); // Suppressed!

            // Charlie drafts green
            gameMock.pick_passive_die('charlie', 'green');
            assert.equal(gameMock.get_data().gameLogs.length, initialLogCount); // Suppressed!

            // Charlie confirms
            gameMock.confirm_passive_selection('charlie');

            const finalLogs = gameMock.get_data().gameLogs;
            // Now that all are confirmed, we expect:
            // 1. Bob's final choice logged
            // 2. Charlie's final choice logged
            // 3. "All passive players have confirmed their selections." logged
            // 4. "Active turn ended for alice." logged
            // 5. "It is bob's turn as Active Player!" logged
            assert.equal(finalLogs.length, initialLogCount + 5);
            assert(finalLogs[finalLogs.length - 5].includes('bob (passive) picked die blue:3'));
            assert(finalLogs[finalLogs.length - 4].includes('charlie (passive) picked die green:4'));
            assert(finalLogs[finalLogs.length - 3].includes('All passive players have confirmed their selections.'));
        });
    });

    describe('Scoring Logic', () => {
        it('should compute scores correctly for different track marks', () => {
            const players = ['alice'];
            const game = new CleverGameState(players);
            
            // Get state data to customize
            const data = game.get_data();
            const alice = data.players['alice'];

            // 1. Yellow: completed column 1 (indices [row][0])
            // Yellow has pre-marked diagonal: [0][3], [1][2], [2][1], [3][0]
            // Let's mark the rest of col 0: [0][0], [1][0], [2][0], [3][0] (already marked because of diagonal)
            alice.yellow[0][0] = true;
            alice.yellow[1][0] = true;
            alice.yellow[2][0] = true;
            alice.yellow[3][0] = true; // diagonal pre-marked

            // Column 0 completed -> colPoints[0] = 10 points

            // 2. Blue: mark 3 cells. 3 cells marked -> BLUE_POINTS[2] = 4 points
            alice.blue[0] = true; // sum 2
            alice.blue[1] = true; // sum 3
            alice.blue[2] = true; // sum 4

            // 3. Green: mark 4 cells. 4 cells marked -> GREEN_POINTS[3] = 10 points
            alice.green = 4;

            // 4. Orange: write [3, 4, 5, 2] (cell 4 has x2 multiplier, index 3).
            // Cells: orange[0]=3, orange[1]=4, orange[2]=5, orange[3]=4 (die value 2 * x2 multiplier = 4)
            // Sum = 3 + 4 + 5 + 4 = 16
            alice.orange[0] = 3;
            alice.orange[1] = 4;
            alice.orange[2] = 5;
            alice.orange[3] = 4;

            // 5. Purple: write [2, 3, 5, 6, 1]. strictly increasing, reset after 6.
            // Sum = 2 + 3 + 5 + 6 + 1 = 17
            alice.purple[0] = 2;
            alice.purple[1] = 3;
            alice.purple[2] = 5;
            alice.purple[3] = 6;
            alice.purple[4] = 1;

            // 6. Foxes: alice has 2 foxes.
            // Area scores:
            // Yellow: col 0 completed (10)
            // Blue: 3 cells (4)
            // Green: 4 cells (10)
            // Orange: 16
            // Purple: 17
            // Lowest scoring area = Blue (4)
            // Foxes score = 2 * 4 = 8
            alice.foxesTotal = 2;

            const customGame = CleverGameState.from_data(data);
            const scores = customGame.calculate_scores('alice');

            assert.equal(scores.yellow, 10);
            assert.equal(scores.blue, 4);
            assert.equal(scores.green, 10);
            assert.equal(scores.orange, 16);
            assert.equal(scores.purple, 17);
            assert.equal(scores.foxes, 8);
            assert.equal(scores.lowestAreaScore, 4);
            assert.equal(scores.total, 10 + 4 + 10 + 16 + 17 + 8);
        });
    });

    describe('Yellow Grid Coordinate Selection and Uniqueness', () => {
        it('should allow active player to pick a specific yellow cell with coordinates and enforce uniqueness constraint', () => {
            const players = ['alice', 'bob'];
            const game = new CleverGameState(players);
            game.start_game();

            const data = game.get_data();
            const mockData = { ...data };
            mockData.status = GameStatus.ActiveChoosing;
            mockData.rollCount = 1;
            mockData.poolDice = [
                { color: 'white', value: 1 },
                { color: 'yellow', value: 1 },
                { color: 'blue', value: 1 },
                { color: 'green', value: 1 },
                { color: 'orange', value: 1 },
                { color: 'purple', value: 1 }
            ];
            mockData.rolledDice = [
                { color: 'white', value: 4 },
                { color: 'yellow', value: 3 },
                { color: 'blue', value: 5 },
                { color: 'green', value: 2 },
                { color: 'orange', value: 6 },
                { color: 'purple', value: 1 }
            ];
            mockData.activePickedDice = [];
            mockData.trayDice = [];

            const gameMock = CleverGameState.from_data(mockData);

            // Alice wants to pick the yellow die with value 3.
            // There are two yellow cells with value 3: row 0, col 0 and row 3, col 1.
            // Alice picks the cell at row 3, col 1 (which is index [3][1]).
            gameMock.pick_active_die('alice', 'yellow', { r: 3, c: 1 });

            const afterPick = gameMock.get_data();
            // The selected cell should be marked true.
            assert.equal(afterPick.players['alice'].yellow[3][1], true);
            // The other cell at row 0, col 0 (value 3) should still be unmarked.
            assert.equal(afterPick.players['alice'].yellow[0][0], false);

            // Now, Alice tries to pick/spend another yellow selection with value 3.
            // It should be illegal because of the uniqueness constraint.
            // Let's verify by checking if pick_active_die throws an error if we try to mark another 3 (e.g. at [0][0]).
            const stateAfterPick = CleverGameState.from_data(JSON.parse(JSON.stringify(afterPick)));
            
            // Modify active choosing state so alice has yellow:3 available again (mocking it)
            const secondRollData = stateAfterPick.get_data();
            secondRollData.status = GameStatus.ActiveChoosing;
            secondRollData.rolledDice = [
                { color: 'yellow', value: 3 },
                { color: 'orange', value: 4 }
            ];
            const gameMock2 = CleverGameState.from_data(secondRollData);

            assert.throws(() => {
                gameMock2.pick_active_die('alice', 'yellow', { r: 0, c: 0 });
            }, /illegal|unusable/);
        });

        it('should enforce uniqueness constraint for yellow_X pending bonuses', () => {
            const players = ['alice'];
            const game = new CleverGameState(players);
            game.start_game();

            const data = game.get_data();
            // Give Alice a yellow_X pending bonus and mark one cell with value 3
            data.players['alice'].yellow[3][1] = true; // Mark the 3 at [3][1]
            data.players['alice'].bonusesToResolve = [{ type: 'yellow_X' }];

            const gameMock = CleverGameState.from_data(data);

            // Resolving the yellow_X bonus by trying to mark the other 3 at [0][0] should throw an error.
            assert.throws(() => {
                gameMock.resolve_pending_bonus('alice', 0, 0); // Row 0, Col 0 is value 3
            }, /already marked elsewhere/);
        });
    });

    describe('Deadlock Prevention & Bonus Auto-Skipping', () => {
        it('should automatically skip yellow_X bonus if all 6 unique numbers are already marked in Yellow', () => {
            const players = ['alice'];
            const game = new CleverGameState(players);
            game.start_game();

            const data = game.get_data();
            const player = data.players['alice'];

            // Mark all 6 unique numbers in yellow grid
            // Grid layout:
            // [3, 6, 5, null]
            // [2, 1, null, 5]
            // [1, null, 2, 4]
            // [null, 3, 4, 6]
            player.yellow[0][0] = true; // 3
            player.yellow[0][1] = true; // 6
            player.yellow[0][2] = true; // 5
            player.yellow[1][0] = true; // 2
            player.yellow[1][1] = true; // 1
            player.yellow[2][3] = true; // 4

            // Now, mock round 4 choice of yellow_X
            data.status = GameStatus.RoundStartBonus;
            player.bonusesToResolve = [{ type: 'choice_X_6' }];

            const gameMock = CleverGameState.from_data(data);
            gameMock.push_round4_choice_result('alice', 'yellow_X');

            const finalData = gameMock.get_data();
            // The yellow_X should be automatically skipped
            assert.equal(finalData.players['alice'].bonusesToResolve.length, 0);
            // Verify warning message is logged
            assert(finalData.gameLogs.some(log => log.includes("pending yellow_X bonus was skipped")));
        });

        it('should automatically skip blue_X bonus if all 11 sums are already marked in Blue', () => {
            const players = ['alice'];
            const game = new CleverGameState(players);
            game.start_game();

            const data = game.get_data();
            const player = data.players['alice'];

            // Mark all 11 sums in Blue
            player.blue = Array(11).fill(true);

            // Mock round 4 choice of blue_X
            data.status = GameStatus.RoundStartBonus;
            player.bonusesToResolve = [{ type: 'choice_X_6' }];

            const gameMock = CleverGameState.from_data(data);
            gameMock.push_round4_choice_result('alice', 'blue_X');

            const finalData = gameMock.get_data();
            // The blue_X should be automatically skipped
            assert.equal(finalData.players['alice'].bonusesToResolve.length, 0);
            // Verify warning message is logged
            assert(finalData.gameLogs.some(log => log.includes("pending blue_X bonus was skipped")));
        });

        it('should automatically skip choice_X_6 round 4 start bonus if all tracks are completely full/blocked', () => {
            const players = ['alice'];
            const game = new CleverGameState(players);
            
            // Set up a game state about to start round 4
            const data = game.get_data();

            const player = data.players['alice'];
            // Fill all tracks
            player.yellow[0][0] = true; // 3
            player.yellow[0][1] = true; // 6
            player.yellow[0][2] = true; // 5
            player.yellow[1][0] = true; // 2
            player.yellow[1][1] = true; // 1
            player.yellow[2][3] = true; // 4

            player.blue = Array(11).fill(true);
            player.green = 11;
            player.orange = Array(11).fill(6);
            player.purple = Array(11).fill(6);

            // Set up the state at the end of round 3 passive turn
            data.round = 3;
            data.status = GameStatus.PassiveChoosing;
            data.soloPassiveTurn = true;
            data.activePlayerIndex = 0;
            player.extraDicePickedThisTurn = ['green']; // mock passive selection done
            player.hasConfirmedPassiveSelection = false;

            const transitionGame = CleverGameState.from_data(data);
            transitionGame.confirm_passive_selection('alice');

            const finalData = transitionGame.get_data();
            // The round should have advanced to 4, but because choice_X_6 had no legal moves,
            // it was auto-skipped and active turn started directly!
            assert.equal(finalData.round, 4);
            assert.equal(finalData.status, GameStatus.ActiveRolling);
            assert.equal(finalData.players['alice'].bonusesToResolve.length, 0);
            assert(finalData.gameLogs.some(log => log.includes("pending choice_X_6 bonus was skipped")));
        });

        it('should automatically skip cascading yellow_X bonus earned from Orange path if Yellow is deadlocked', () => {
            const players = ['alice'];
            const game = new CleverGameState(players);
            game.start_game();

            const data = game.get_data();
            const player = data.players['alice'];

            // Deadlock Yellow
            player.yellow[0][0] = true; // 3
            player.yellow[0][1] = true; // 6
            player.yellow[0][2] = true; // 5
            player.yellow[1][0] = true; // 2
            player.yellow[1][1] = true; // 1
            player.yellow[2][3] = true; // 4

            // Fill Orange up to cell 4 (index 3) so that next orange entry (index 4) triggers Yellow X
            player.orange[0] = 1;
            player.orange[1] = 2;
            player.orange[2] = 3;
            player.orange[3] = 4;

            // Set choosing active die state
            data.status = GameStatus.ActiveChoosing;
            data.rolledDice = [{ color: 'orange', value: 5 }];
            data.poolDice = [{ color: 'orange', value: 1 }];

            const gameMock = CleverGameState.from_data(data);
            
            // Alice picks orange die. This marks Orange index 4, triggering Yellow X.
            gameMock.pick_active_die('alice', 'orange');

            const finalData = gameMock.get_data();
            // The yellow_X should be triggered and immediately auto-skipped, leaving bonusesToResolve empty!
            assert.equal(finalData.players['alice'].bonusesToResolve.length, 0);
            assert(finalData.gameLogs.some(log => log.includes("pending yellow_X bonus was skipped")));
            // Game should advance to simulated passive choosing since active pool is empty
            assert.equal(finalData.status, GameStatus.PassiveChoosing);
        });

        it('should cap the activity logs at 25 entries', () => {
            const players = ['alice'];
            const game = new CleverGameState(players);
            game.start_game();

            // Push 30 logs directly
            const data = game.get_data();
            for (let i = 0; i < 30; i++) {
                data.gameLogs.push(`Log Entry #${i}`);
            }

            // Verify count is capped at 25
            assert.equal(data.gameLogs.length, 25);
            // Verify it has the latest entries (Log Entry #5 to #29)
            assert.equal(data.gameLogs[0], 'Log Entry #5');
            assert.equal(data.gameLogs[24], 'Log Entry #29');
        });
    });
});
