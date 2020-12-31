import {
    MinesweeperFlagsGameState,
    MinesweeperFlagsGameStatus,
    MinesweeperBoard,
    BoardEl } from '../../rules/minesweeperflags/minesweeper';
import * as assert from 'assert';

describe('minesweeper_gamestate', () => {
    describe('minesweeper_board basic', () => {
        const state = new MinesweeperFlagsGameState(
            MinesweeperBoard.from_mines_board(
                [[false, false],
                 [false, false],
                 [true, false]]));

        const turn = state.get_turn();

        it('score is initially zero', () => {
            assert.strictEqual(state.get_score(0), 0);
            assert.strictEqual(state.get_score(1), 0);
        });

        it('open non-bomb - turn changes', () => {
            assert.strictEqual(state.move(0, 0), false);
            assert.strictEqual(turn, 1 - state.get_turn());
        });

        it('non-bomb tile reveal', () => {
            const revealed = state.get_revealed();

            assert.strictEqual(revealed[0][0], true);
            assert.strictEqual(revealed[0][1], true);
            assert.strictEqual(revealed[1][0], true);
            assert.strictEqual(revealed[1][1], true);
            assert.strictEqual(revealed[2][1], false);
            assert.strictEqual(revealed[2][0], false);
        });
    });

    describe('minesweeper_board basic 2', () => {
        const state = new MinesweeperFlagsGameState(
            MinesweeperBoard.from_mines_board(
                [[false, false],
                 [false, false],
                 [true, false]]));

        const turn = state.get_turn();

        it('open bomb adjacent', () => {
            assert.strictEqual(state.move(1, 1), false);
            assert.strictEqual(turn, 1 - state.get_turn());
        });

        it('non-bomb tile reveal', () => {
            const revealed = state.get_revealed();

            assert.strictEqual(revealed[0][0], false);
            assert.strictEqual(revealed[0][1], false);
            assert.strictEqual(revealed[1][0], false);
            assert.strictEqual(revealed[1][1], true);
            assert.strictEqual(revealed[2][1], false);
            assert.strictEqual(revealed[2][0], false);
        });
    });

    describe('minesweeper_board basic 3 - open bomb', () => {
        const state = new MinesweeperFlagsGameState(
            MinesweeperBoard.from_mines_board(
                [[false, false],
                 [false, false],
                 [true, false]]));
        const turn = state.get_turn();
        it('open bomb - turn doesn\'t change', () => {
            assert.strictEqual(state.move(2, 0), true);
            assert.strictEqual(turn, state.get_turn());
        });

        it('game is over', () => {
            assert.strictEqual(state.get_score(turn), 1);
            assert.strictEqual(state.get_score(1 - turn), 0);
            assert.strictEqual(state.get_status(), MinesweeperFlagsGameStatus.Gameover);
        });

        it('bomb tile reveal', () => {
            const revealed = state.get_revealed();
            assert.strictEqual(revealed[0][0], false);
            assert.strictEqual(revealed[0][1], false);
            assert.strictEqual(revealed[1][0], false);
            assert.strictEqual(revealed[1][1], false);
            assert.strictEqual(revealed[2][0], true);
            assert.strictEqual(revealed[2][1], false);
        });
    });
});
