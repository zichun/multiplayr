import {
    MinesweeperFlagsGameState,
    MinesweeperFlagsGameStatus,
    MinesweeperBoard
} from '../../rules/minesweeperflags/minesweeper';
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

        it('open non-mine - turn changes', () => {
            assert.strictEqual(state.move(0, 0), false);
            assert.strictEqual(turn, 1 - state.get_turn());
        });

        it('non-mine tile reveal', () => {
            assert.strictEqual(state.is_revealed(0, 0), turn + 1);
            assert.strictEqual(state.is_revealed(0, 1), turn + 1);
            assert.strictEqual(state.is_revealed(1, 0), turn + 1);
            assert.strictEqual(state.is_revealed(1, 1), turn + 1);
            assert.strictEqual(state.is_revealed(2, 1), 0);
            assert.strictEqual(state.is_revealed(2, 0), 0);
        });
    });

    describe('minesweeper_board basic 2', () => {
        const state = new MinesweeperFlagsGameState(
            MinesweeperBoard.from_mines_board(
                [[false, false],
                 [false, false],
                 [true, false]]));

        const turn = state.get_turn();

        it('open mine adjacent', () => {
            assert.strictEqual(state.move(1, 1), false);
            assert.strictEqual(turn, 1 - state.get_turn());
        });

        it('non-mine tile reveal', () => {
            assert.strictEqual(state.is_revealed(0, 0), 0);
            assert.strictEqual(state.is_revealed(0, 1), 0);
            assert.strictEqual(state.is_revealed(1, 0), 0);
            assert.strictEqual(state.is_revealed(1, 1), turn + 1);
            assert.strictEqual(state.is_revealed(2, 1), 0);
            assert.strictEqual(state.is_revealed(2, 0), 0);
        });
    });

    describe('minesweeper_board basic 3 - open mine', () => {
        const state = new MinesweeperFlagsGameState(
            MinesweeperBoard.from_mines_board(
                [[false, false],
                 [false, false],
                 [true, false]]));
        const turn = state.get_turn();
        it('open mine - turn doesn\'t change', () => {
            assert.strictEqual(state.move(2, 0), true);
            assert.strictEqual(turn, state.get_turn());
        });

        it('game is over', () => {
            assert.strictEqual(state.get_score(turn), 1);
            assert.strictEqual(state.get_score(1 - turn), 0);
            assert.strictEqual(state.get_status(), MinesweeperFlagsGameStatus.Gameover);
        });

        it('mine tile reveal', () => {
            assert.strictEqual(state.is_revealed(0, 0), 0);
            assert.strictEqual(state.is_revealed(0, 1), 0);
            assert.strictEqual(state.is_revealed(1, 0), 0);
            assert.strictEqual(state.is_revealed(1, 1), 0);
            assert.strictEqual(state.is_revealed(2, 0), turn + 1);
            assert.strictEqual(state.is_revealed(2, 1), 0);
        });
    });
});
