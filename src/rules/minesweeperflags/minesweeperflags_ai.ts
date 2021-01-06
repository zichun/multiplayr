import { MinesweeperflagsViewPropsInterface } from './minesweeperflags_views';
import { BoardEl } from './minesweeper';

import { MultiplayrAI } from '../../common/interfaces';

export class MinesweeperflagsAI implements MultiplayrAI {

    public onPropsChange(props: MinesweeperflagsViewPropsInterface) {
        if (props.turn === props.player &&
            props.winner === -1) {

            const rows = props.board.length;
            const cols = props.board[0].length;

            let r = 0;
            let c = 0;

            do {
                r = Math.floor(Math.random() * rows);
                c = Math.floor(Math.random() * cols);
            } while (props.board[r][c].el !== BoardEl.Unknown)

            props.MP.make_move(r, c);
        }
    }
}


export class MinesweeperflagsAIBasic implements MultiplayrAI {

    public onPropsChange(props: MinesweeperflagsViewPropsInterface) {
        if (props.turn === props.player &&
            props.winner === -1) {

            const board = props.board;
            const rows = board.length;
            const cols = board[0].length;

            const cnt_around = (row: number, col: number) => {
                let mines = 0;
                let empty = 0;
                for (let rd = -1; rd <= 1; ++rd) {
                    for (let cd = -1; cd <= 1; ++cd) {
                        if (row + rd < 0 || row + rd >= rows ||
                            col + cd <= 0 || col + cd >= cols) {
                            continue;
                        }
                        if (board[row + rd][col + cd].el === BoardEl.Mine) {
                            ++mines;
                        } else if (board[row + rd][col + cd].el === BoardEl.Unknown) {
                            ++empty;
                        }
                    }
                }
                return [mines, empty];
            };
            const mark_around = (row: number, col: number, new_prob: number) => {
                for (let rd = -1; rd <= 1; ++rd) {
                    for (let cd = -1; cd <= 1; ++cd) {
                        if (row + rd < 0 || row + rd >= rows ||
                            col + cd <= 0 || col + cd >= cols) {
                            continue;
                        }
                        if (rd === 0 && cd === 0) {
                            continue;
                        }
                        probability[row + rd][col + cd] = Math.min(new_prob, probability[row + rd][col + cd]);
                    }
                }
            };


            const probability = Array.from(Array(rows), () => Array.from(Array(cols), () => 9));

            for (let r = 0; r < rows; ++r) {
                for (let c = 0; c < cols; ++c) {
                    if (board[r][c].el !== BoardEl.Unknown && board[r][c].el !== BoardEl.Empty &&
                        board[r][c].el !== BoardEl.Mine)
                    {
                        const [mines_around, empty] = cnt_around(r, c);
                        const left = (board[r][c].el as number) - mines_around;
                        let probability = 9;
                        if (left > 0) {
                            probability = empty - left;
                            mark_around(r, c, probability);
                        }
                        if (r === 3 && c === 12) {
                            console.log(board[r][c].el, mines_around, empty);
                        }
                    }
                }
            }
            console.log(probability);

            // find best probability square
            let best_probability = 10;
            let br = 0;
            let bc = 0;

            for (let r = 0; r < rows; ++r) {
                for (let c = 0; c < cols; ++c) {
                    if (board[r][c].el === BoardEl.Unknown) {
                        if (probability[r][c] <= best_probability) {
                            if (best_probability === probability[r][c]) {
                                if (Math.floor(Math.random() * 4) > 0) {
                                    continue;
                                }
                            }

                            best_probability = probability[r][c];
                            br = r;
                            bc = c;
                        }
                    }
                }
            }
            props.MP.make_move(br, bc);
        }
    }
}
