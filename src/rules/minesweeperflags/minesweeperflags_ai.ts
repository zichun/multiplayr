import { MinesweeperflagsViewPropsInterface } from './minesweeperflags_views';
import { BoardEl } from './minesweeper';

import { MultiplayrAI } from '../../common/interfaces';

export class MinesweeperflagsAI implements MultiplayrAI {
    constructor() {
    }

    public onPropsChange(props: MinesweeperflagsViewPropsInterface) {
        if (props.turn === props.player &&
            props.winner === -1) {

            const rows = props.board.length;
            const cols = props.board[0].length;

            let r = 0;
            let c = 0;

            do {
                console.log("randoming with " + rows + " " + cols);
                r = Math.floor(Math.random() * rows);
                c = Math.floor(Math.random() * cols);
                console.log(r + " " + c);
            } while (props.board[r][c].el !== BoardEl.Unknown)

            props.MP.make_move(r, c);
        }
    }
}
