import * as React from 'react';

import { ViewPropsInterface } from '../../common/interfaces';
import { BoardEl } from './minesweeper';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export interface BoardElWithRevealer {
    el: BoardEl;
    r: number;
}
export interface MinesweeperflagsViewPropsInterface extends ViewPropsInterface {
    waiting: boolean;
    player: number;
    turn: number;
    board: BoardElWithRevealer[][];
    scores: number[];
    last_moves: number[][];
    winner: number;
}

export class MinesweeperflagsView extends React.Component<MinesweeperflagsViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;
        const view = this.props.waiting ? waiting(this.props) : React.createElement(MinesweeperflagsMainView, this.props);

        return mp.getPluginView(
            'gameshell',
            'HostShell-Main',
            {
                'links': {
                    'home': {
                        'icon': 'bomb',
                        'label': 'Flags',
                        'view': view
                    }
                }
            }
        );
    }
}

class MinesweeperflagsScore extends React.Component<MinesweeperflagsViewPropsInterface, {}> {
    public render() {
        return (<div className="minesweeperflags-score">
            Score: {this.props.scores[0] + ' | ' + this.props.scores[1]}
        </div>);
    }
}

interface CellInterface extends MinesweeperflagsViewPropsInterface {
    row: number;
    col: number;
}
class MinesweeperflagsCell extends React.Component<CellInterface, {}> {
    private _click() {
        if (this.props.turn !== this.props.player) {
            return false;
        }
        this.props.MP.make_move(this.props.row, this.props.col);
    }

    public render() {
        const gen_class = (cell: BoardEl, reveal: number) => {
            let c = '';
            let r = 'reveal-' + reveal;

            if (cell === BoardEl.Unknown) {
                c = 'unknown';
                r = '';
            } else if (cell === BoardEl.Mine) {
                c = 'mine';
            } else if (cell === BoardEl.Empty) {
                c = 'empty'
            } else {
                c = 'empty ' + 'number-' + cell;
            }

            const row = this.props.row;
            const col = this.props.col;
            let lm = '';
            if (this.props.last_moves && this.props.last_moves[0] && row === this.props.last_moves[0][0] && col === this.props.last_moves[0][1]) {
                lm = 'last-move-0';
            } else if (this.props.last_moves && this.props.last_moves[1] && row === this.props.last_moves[1][0] && col === this.props.last_moves[1][1]) {
                lm = 'last-move-1';
            }

            return 'cell ' + c + ' ' + r + ' ' + lm;
        };

        const board = this.props.board[this.props.row][this.props.col];
        const cell = board.el;
        const reveal = board.r;

        let flag = null;
        if (cell === BoardEl.Mine) {
            flag = (<FontAwesomeIcon icon="flag" />);
        }

        return (<div onClick={ cell === BoardEl.Unknown ? this._click.bind(this) : null } className={ gen_class(cell, reveal) }>{ flag }</div>);
    }
}

class MinesweeperflagsBoard extends React.Component<MinesweeperflagsViewPropsInterface, {}> {
    public render() {
        const rows = this.props.board.length;
        const cols = this.props.board[0].length;

        const cells = [];
        let index = 0;
        for (let r = 0; r < rows; ++r) {
            for (let c = 0; c < cols; ++c) {
                cells.push(<MinesweeperflagsCell key={ index++ } row={ r } col={ c } {...this.props} />);
            }
            cells.push(<div key={ index++ } className="clearer"></div>);
        }
        let boardClass = 'minesweeperflags-board';
        if (this.props.player === this.props.turn) {
            boardClass += ' turn';
        }
        return (<div className={ boardClass }>
            { cells }
        </div>);
    }
}

class MinesweeperflagsShowWinner extends React.Component<MinesweeperflagsViewPropsInterface, {}> {
    private _new_game() {
        this.props.MP.new_game();
    }
    public render() {
        if (this.props.winner === -1) {
            return null;
        }

        let message = '';
        if (this.props.winner === this.props.player) {
            message = 'You have won!';
        } else {
            message = 'You have lost';
        }

        let btn = null;
        if (this.props.player === 0) {
            btn = (<div>
                <button onClick={ this._new_game.bind(this) }>New Game</button>
            </div>);
        }

        return (<div className="minesweeperflags-gameover">
            { message }
            { btn }
        </div>);
    }
}

class MinesweeperflagsMainView extends React.Component<MinesweeperflagsViewPropsInterface, {}> {
    public render() {
        return (<div className="minesweeperflags-main">
            <MinesweeperflagsScore {...this.props} />
            <MinesweeperflagsBoard {...this.props} />
            <MinesweeperflagsShowWinner {...this.props} />
        </div>);
    }
}

function waiting(_props: ViewPropsInterface) {
    return (<div>Waiting for opponent to join</div>);
}

export default MinesweeperflagsView;
