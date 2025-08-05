/**
 * CatchSketch.test.ts - Tests for Catch Sketch game logic
 */

import { describe, it } from 'mocha';
import { strict as assert } from 'assert';
import { CatchSketchGameState } from '../../rules/catchsketch/CatchSketchGameState';

describe('Catch Sketch Game Logic', () => {
    describe('CatchSketchGameState class', () => {
        describe('initialization', () => {
            it('should create a game with minimum players', () => {
                const playerIds = ['player1', 'player2', 'player3'];
                const gameState = new CatchSketchGameState(playerIds);

                assert.deepEqual(gameState.get_player_ids(), playerIds);
                assert.equal(gameState.get_round(), 0);
                assert.equal(gameState.get_current_guesser(), 'player1');
                assert.equal(gameState.get_tokens_claimed(), 0);
                assert.equal(gameState.is_drawing_phase(), true);
            });

            it('should fail with insufficient players', () => {
                assert.throws(() => {
                    new CatchSketchGameState(['player1', 'player2']);
                }, /Catch Sketch requires at least 3 players/);
            });

            it('should initialize all players with zero scores', () => {
                const playerIds = ['player1', 'player2', 'player3', 'player4'];
                const gameState = new CatchSketchGameState(playerIds);

                const scores = gameState.get_scores();
                for (const playerId of playerIds) {
                    assert.equal(scores[playerId], 0);
                    const playerData = gameState.get_player_data(playerId);
                    assert.equal(playerData?.hasLocked, false);
                    assert.equal(playerData?.tokenNumber, undefined);
                }
            });
        });

        describe('token locking', () => {
            it('should allow drawers to lock tokens', () => {
                const playerIds = ['guesser', 'drawer1', 'drawer2', 'drawer3'];
                const gameState = new CatchSketchGameState(playerIds);
                gameState.start_game();

                // drawer1 locks token 1
                gameState.lock_token('drawer1', 1);

                const player = gameState.get_player_data('drawer1');
                assert.equal(player?.hasLocked, true);
                assert.equal(player?.tokenNumber, 1);
                assert.equal(player?.turnOrder, 1);
                assert.equal(gameState.get_tokens_claimed(), 1);
            });

            it('should prevent guesser from locking tokens', () => {
                const playerIds = ['guesser', 'drawer1', 'drawer2'];
                const gameState = new CatchSketchGameState(playerIds);
                gameState.start_game();

                assert.throws(() => {
                    gameState.lock_token('guesser', 1);
                }, /Guesser cannot draw or lock tokens/);
            });

            it('should prevent double locking', () => {
                const playerIds = ['guesser', 'drawer1', 'drawer2'];
                const gameState = new CatchSketchGameState(playerIds);
                gameState.start_game();

                gameState.lock_token('drawer1', 1);

                assert.throws(() => {
                    gameState.lock_token('drawer1', 2);
                }, /Player has already locked/);
            });

            it('should prevent claiming same token twice', () => {
                const playerIds = ['guesser', 'drawer1', 'drawer2', 'drawer3'];
                const gameState = new CatchSketchGameState(playerIds);
                gameState.start_game();

                gameState.lock_token('drawer1', 1);

                assert.throws(() => {
                    gameState.lock_token('drawer2', 1);
                }, /Token 1 is already claimed/);
            });

            it('should assign random order when both tokens claimed', () => {
                const playerIds = ['guesser', 'drawer1', 'drawer2', 'drawer3', 'drawer4'];
                const gameState = new CatchSketchGameState(playerIds);
                gameState.start_game();

                gameState.lock_token('drawer1', 1);
                gameState.lock_token('drawer2', 2);

                // All drawers should now be locked and have turn orders
                for (const drawerId of ['drawer1', 'drawer2', 'drawer3', 'drawer4']) {
                    const player = gameState.get_player_data(drawerId);
                    assert.equal(player?.hasLocked, true);
                    assert.equal(typeof player?.turnOrder, 'number');
                    assert.ok((player?.turnOrder || 0) > 0);
                }

                assert.equal(gameState.get_turn_order().length, 4);
                assert.equal(gameState.is_drawing_phase(), false);
                assert.equal(gameState.is_guessing_phase(), true);
            });
        });

        describe('guessing phase', () => {
            it('should accept guesses from guesser', () => {
                const playerIds = ['guesser', 'drawer1', 'drawer2', 'drawer3'];
                const gameState = new CatchSketchGameState(playerIds);
                gameState.start_game();

                // Set up tokens to enter guessing phase
                gameState.lock_token('drawer1', 1);
                gameState.lock_token('drawer2', 2);

                assert.equal(gameState.is_guessing_phase(), true);

                const isCorrect = gameState.submit_guess('guesser', 'wrongguess');
                assert.equal(isCorrect, false);

                const guesses = gameState.get_guesses();
                assert.equal(guesses.length, 1);
                assert.equal(guesses[0].guess, 'wrongguess');
                assert.equal(guesses[0].isCorrect, false);
            });

            it('should prevent non-guesser from guessing', () => {
                const playerIds = ['guesser', 'drawer1', 'drawer2', 'drawer3'];
                const gameState = new CatchSketchGameState(playerIds);
                gameState.start_game();

                gameState.lock_token('drawer1', 1);
                gameState.lock_token('drawer2', 2);

                assert.throws(() => {
                    gameState.submit_guess('drawer1', 'guess');
                }, /Only the current guesser can submit guesses/);
            });

            it('should award points for correct guess', () => {
                const playerIds = ['guesser', 'drawer1', 'drawer2', 'drawer3'];
                const gameState = new CatchSketchGameState(playerIds);
                gameState.start_game();

                gameState.lock_token('drawer1', 1);
                gameState.lock_token('drawer2', 2);

                // Get the secret word to make a correct guess
                const secretWord = gameState.get_secret_word();
                const isCorrect = gameState.submit_guess('guesser', secretWord);

                assert.equal(isCorrect, true);
                assert.equal(gameState.is_review_phase(), true);

                const scores = gameState.get_scores();
                assert.equal(scores['guesser'] >= 1, true);
                // First drawer (token 1) should also get a point
                assert.equal(scores['drawer1'] >= 1, true);
            });
        });

        describe('round progression', () => {
            it('should advance to next round and rotate guesser', () => {
                const playerIds = ['player1', 'player2', 'player3'];
                const gameState = new CatchSketchGameState(playerIds);
                gameState.start_game();

                assert.equal(gameState.get_current_guesser(), 'player1');
                assert.equal(gameState.get_round(), 0);

                // Can't move to the next round
                gameState.next_round();
                assert.equal(gameState.get_round(), 0);

                gameState.lock_token('player2', 1);
                gameState.lock_token('player3', 2);

                // Can't move to the next round
                gameState.next_round();
                assert.equal(gameState.get_round(), 0);

                gameState.submit_guess('player1', "-");
                gameState.submit_guess('player1', "-");

                gameState.next_round();
                assert.equal(gameState.get_round(), 1);

                assert.equal(gameState.get_current_guesser(), 'player2');
                assert.equal(gameState.get_round(), 1);
                assert.equal(gameState.get_tokens_claimed(), 0);
                assert.equal(gameState.is_drawing_phase(), true);
            });

            it('force_assign_token can assign tokens randomly with token 1 taken', () => {
                const playerIds = ['player1', 'player2', 'player3', 'player4'];
                const gameState = new CatchSketchGameState(playerIds);
                gameState.start_game();

                assert.equal(gameState.get_current_guesser(), 'player1');

                assert.equal(gameState.force_assign_token(), false);
                assert.equal(gameState.is_drawing_phase(), true);
                gameState.lock_token('player4', 1);

                assert.equal(gameState.force_assign_token(), true);
                assert.equal(gameState.is_guessing_phase(), true);
                assert.equal(gameState.get_turn_order()[0], 'player4');
            });

            it('force_assign_token can assign tokens randomly with token 2 taken', () => {
                const playerIds = ['player1', 'player2', 'player3', 'player4'];
                const gameState = new CatchSketchGameState(playerIds);
                gameState.start_game();

                assert.equal(gameState.get_current_guesser(), 'player1');

                assert.equal(gameState.force_assign_token(), false);
                assert.equal(gameState.is_drawing_phase(), true);
                gameState.lock_token('player3', 2);

                assert.equal(gameState.force_assign_token(), true);
                assert.equal(gameState.is_guessing_phase(), true);
                assert.equal(gameState.get_turn_order()[1], 'player3');
            });

            it('should maintain scores across rounds', () => {
                const playerIds = ['guesser', 'drawer1', 'drawer2'];
                const gameState = new CatchSketchGameState(playerIds);
                gameState.start_game();

                // Simulate scoring in round 1
                gameState.lock_token('drawer1', 1);
                gameState.lock_token('drawer2', 2);
                const secretWord = gameState.get_secret_word();
                gameState.submit_guess('guesser', secretWord);

                const scoresAfterRound1 = gameState.get_scores();
                assert.equal(scoresAfterRound1['guesser'] >= 1, true);
                const guesser_score = scoresAfterRound1['guesser'];
                const drawer_score = scoresAfterRound1['drawer1'];

                gameState.next_round();

                // Scores should be maintained
                const scoresAfterAdvance = gameState.get_scores();
                assert.equal(scoresAfterAdvance['guesser'], guesser_score);
                assert.equal(scoresAfterAdvance['drawer1'], drawer_score);
            });
        });

        describe('phase detection', () => {
            it('should correctly identify drawing phase', () => {
                const playerIds = ['guesser', 'drawer1', 'drawer2'];
                const gameState = new CatchSketchGameState(playerIds);
                gameState.start_game();

                assert.equal(gameState.is_drawing_phase(), true);
                assert.equal(gameState.is_guessing_phase(), false);
                assert.equal(gameState.is_review_phase(), false);

                gameState.lock_token('drawer1', 1);

                // Still drawing phase with only one token
                assert.equal(gameState.is_drawing_phase(), true);
            });

            it('should correctly identify guessing phase', () => {
                const playerIds = ['guesser', 'drawer1', 'drawer2'];
                const gameState = new CatchSketchGameState(playerIds);
                gameState.start_game();

                gameState.lock_token('drawer1', 1);
                gameState.lock_token('drawer2', 2);

                assert.equal(gameState.is_drawing_phase(), false);
                assert.equal(gameState.is_guessing_phase(), true);
                assert.equal(gameState.is_review_phase(), false);
            });

            it('should correctly identify review phase after correct guess', () => {
                const playerIds = ['guesser', 'drawer1', 'drawer2'];
                const gameState = new CatchSketchGameState(playerIds);
                gameState.start_game();

                gameState.lock_token('drawer1', 1);
                gameState.lock_token('drawer2', 2);

                const secretWord = gameState.get_secret_word();
                gameState.submit_guess('guesser', secretWord);

                assert.equal(gameState.is_drawing_phase(), false);
                assert.equal(gameState.is_guessing_phase(), false);
                assert.equal(gameState.is_review_phase(), true);
            });

            it('should correctly identify review phase after all wrong guesses', () => {
                const playerIds = ['guesser', 'drawer1', 'drawer2'];
                const gameState = new CatchSketchGameState(playerIds);
                gameState.start_game();

                gameState.lock_token('drawer1', 1);
                gameState.lock_token('drawer2', 2);

                // Make wrong guesses for all drawings
                gameState.submit_guess('guesser', 'wrong1');
                gameState.submit_guess('guesser', 'wrong2');

                assert.equal(gameState.is_review_phase(), true);
            });
        });
    });
});
