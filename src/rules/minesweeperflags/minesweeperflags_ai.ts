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

            let total_empty = 0;
            for (let r = 0; r < rows; ++r) {
                for (let c = 0; c < cols; ++c) {
                    if (board[r][c].el === BoardEl.Unknown) {
                        total_empty += 1;
                    }
                }
            }
            const mines_left = props.mines - props.scores[0] - props.scores[1];
            const base_probability = total_empty === 0 ? 2 * rows * cols : mines_left / total_empty;
            const probability = Array.from(Array(rows), () => Array.from(Array(cols), () => base_probability));

            const cnt_around = (row: number, col: number) => {
                let mines = 0;
                const empties = [];
                for (let rd = -1; rd <= 1; ++rd) {
                    for (let cd = -1; cd <= 1; ++cd) {
                        const r = row + rd;
                        const c = col + cd;

                        if (r < 0 || r >= rows ||
                            c < 0 || c >= cols) {
                            continue;
                        }
                        if (board[r][c].el === BoardEl.Mine) {
                            ++mines;
                        } else if (board[r][c].el === BoardEl.Unknown && probability[r][c] > 0) {
                            empties.push([r, c]);
                        }
                    }
                }
                return {
                    mines: mines,
                    empties: empties
                };
            };

            const mark_around = (row: number, col: number, new_prob: number) => {
                for (let rd = -1; rd <= 1; ++rd) {
                    for (let cd = -1; cd <= 1; ++cd) {
                        if (row + rd < 0 || row + rd >= rows ||
                            col + cd < 0 || col + cd >= cols) {
                            continue;
                        }
                        if (rd === 0 && cd === 0) {
                            continue;
                        }
                        if (new_prob === 0 || probability[row + rd][col + cd] === 0) {
                            probability[row + rd][col + cd] = 0;
                        } else {
                            probability[row + rd][col + cd] = Math.max(new_prob, probability[row + rd][col + cd]);
                        }
                    }
                }
            };

            for (let r = 0; r < rows; ++r) {
                for (let c = 0; c < cols; ++c) {
                    if (board[r][c].el !== BoardEl.Unknown && board[r][c].el !== BoardEl.Empty &&
                        board[r][c].el !== BoardEl.Mine)
                    {
                        const around = cnt_around(r, c);
                        const mines_around = around.mines;
                        const empties = around.empties;

                        const left = (board[r][c].el as number) - mines_around;
                        let prob = base_probability;
                        if (empties.length === 0) {
                            prob = 0;
                        } else {
                            prob = left / empties.length;
                        }
                        mark_around(r, c, prob);
                    }
                }
            }

            // recount
            for (let r = 0; r < rows; ++r) {
                for (let c = 0; c < cols; ++c) {
                    if (board[r][c].el !== BoardEl.Unknown && board[r][c].el !== BoardEl.Empty &&
                        board[r][c].el !== BoardEl.Mine)
                    {
                        const around = cnt_around(r, c);
                        const mines_around = around.mines;
                        const empties = around.empties;

                        const left = (board[r][c].el as number) - mines_around;
                        let probability = base_probability;
                        if (empties.length === 0) {
                            probability = 0;
                        } else {
                            probability = left / empties.length;
                        }
                        mark_around(r, c, probability);
                    }
                }
            }

            // find best probability square
            let best_probability = 0;
            let br = 0;
            let bc = 0;

            for (let r = 0; r < rows; ++r) {
                for (let c = 0; c < cols; ++c) {
                    if (board[r][c].el === BoardEl.Unknown) {
                        if (probability[r][c] >= best_probability) {
/*                            if (best_probability === probability[r][c]) {
                                if (Math.floor(Math.random() * 4) > 0) {
                                    continue;
                                }
                            }*/

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
