import { MinesweeperBoard, BoardEl } from '../../rules/minesweeperflags/minesweeper';
import * as assert from 'assert';

describe('minesweeper', () => {
    describe('minesweeper_board_construction', () => {
        it('should fail if board is too small', () => {
            assert.throws(() => {
                MinesweeperBoard.from_parameters(3, 3, 2)
            }, Error);
        });

        it('should fail if board is too big', () => {
            assert.throws(() => {
                MinesweeperBoard.from_parameters(3, 101, 2)
            }, Error);
        });

        it('should fail if board has no mines', () => {
            assert.throws(() => {
                MinesweeperBoard.from_parameters(10, 10, 0)
            }, Error);
        });

        it('should fail if board has too many mines', () => {
            assert.throws(() => {
                MinesweeperBoard.from_parameters(10, 10, 100)
            }, Error);
        });

        it('populated board correctly', () => {
            const board = MinesweeperBoard.from_parameters(9, 9, 10);

            let mineCnt = 0;
            for (let r = 0; r < 9; ++r) {
                for (let c = 0; c < 9; ++c) {
                    if (board.get_board(r, c) === BoardEl.Mine) {
                        ++mineCnt;
                    }
                }
            }

            assert.strictEqual(mineCnt, 10);
        });
    });

    describe('minesweeper_board_counting', () => {
        it('one mine', () => {
            const board = MinesweeperBoard.from_mines_board(
                [[false, true],
                 [false, false],
                 [false, false]]);

            assert.strictEqual(board.get_width(), 2)
            assert.strictEqual(board.get_height(), 3)
            assert.strictEqual(board.get_mines(), 1)

            assert.strictEqual(board.get_board(0, 1), BoardEl.Mine)

            assert.strictEqual(board.get_board(0, 0), BoardEl.Empty_1)
            assert.strictEqual(board.get_board(1, 0), BoardEl.Empty_1)
            assert.strictEqual(board.get_board(1, 1), BoardEl.Empty_1)
            assert.strictEqual(board.get_board(2, 0), BoardEl.Empty)
            assert.strictEqual(board.get_board(2, 1), BoardEl.Empty)
        });

        it('two mines', () => {
            const board = MinesweeperBoard.from_mines_board(
                [[true, false],
                 [false, true],
                 [false, false]]);

            assert.strictEqual(board.get_width(), 2)
            assert.strictEqual(board.get_height(), 3)
            assert.strictEqual(board.get_mines(), 2)

            assert.strictEqual(board.get_board(0, 0), BoardEl.Mine)
            assert.strictEqual(board.get_board(1, 1), BoardEl.Mine)

            assert.strictEqual(board.get_board(0, 1), BoardEl.Empty_2)
            assert.strictEqual(board.get_board(1, 0), BoardEl.Empty_2)
            assert.strictEqual(board.get_board(2, 0), BoardEl.Empty_1)
            assert.strictEqual(board.get_board(2, 1), BoardEl.Empty_1)
        });

    });
});
