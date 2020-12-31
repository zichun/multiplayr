import Shell from '../gameshell/gameshell';
import './minesweeperflags.scss';

import {
    GameRuleInterface,
    MPType
} from '../../common/interfaces';

import { BoardElWithRevealer, MinesweeperflagsView } from './minesweeperflags_views';

import { BoardEl, MinesweeperBoard, MinesweeperFlagsGameState, MinesweeperFlagsGameStatus } from './minesweeper';

const HEIGHT = 16;
const WIDTH = 16;
const BOMBS = 50;

function get_gamestate(mp: MPType) {
    let state = mp.getData('gamestate');
    if (state && state.constructor.name !== 'MinesweeperFlagsGameState') {
        state = MinesweeperFlagsGameState.from_object(state);
    }
    return state;
}

function make_move(mp: MPType, clientId: string, row: number, col: number) {
    const state = get_gamestate(mp);
    const turn = state.get_turn();

    if ((turn === 0 && clientId !== mp.hostId) ||
        (turn === 1 && clientId === mp.hostId)) {
        throw new Error("Move by invalid player");
    }
    state.move(row, col);

    mp.setData('gamestate', state);
}

function new_game(mp: MPType, clientId: string) {
    if (clientId !== mp.hostId) {
        throw new Error("New game can only be called by host");
    }
    const board =  MinesweeperBoard.from_parameters(HEIGHT, WIDTH, BOMBS);
    const state = new MinesweeperFlagsGameState(board);
    mp.setData('gamestate', state);
}

export const MinesweeperFlagsRule: GameRuleInterface = {
    name: 'minesweeperflags',
    plugins: {
        'gameshell': Shell
    },
    globalData: {
        gamestate: null,
    },
    playerData: {},
    onDataChange: (mp: MPType) => {
        let otherId = null;

        mp.setView(mp.hostId, 'main');
        mp.playersForEach((clientId) => {
            otherId = clientId;
            mp.setView(clientId, 'main');
        });

        if (mp.playersCount() === 0) {
            mp.setViewProps(mp.hostId, 'waiting', true);
            return;
        }

        mp.setViewProps(mp.hostId, 'waiting', false);
        const clientIds = [mp.hostId, otherId];

        let state = get_gamestate(mp);
        if (state === null) {
            const board =  MinesweeperBoard.from_parameters(HEIGHT, WIDTH, BOMBS);
            state = new MinesweeperFlagsGameState(board);
            mp.setData('gamestate', state);
        }

        const rows = state.get_height();
        const cols = state.get_width();
        const visibleBoard: BoardElWithRevealer[][] = new Array(rows);
        for (let r = 0; r < rows; ++r) {
            visibleBoard[r] = new Array(cols);
            for (let c = 0; c < cols; ++c) {
                const reveal = state.is_revealed(r, c);
                if (reveal === 0) {
                    visibleBoard[r][c] = {
                        el: BoardEl.Unknown,
                        r: 0
                    };
                } else {
                    visibleBoard[r][c] = {
                        el: state.get_board(r, c),
                        r: reveal - 1
                    };
                }
            }
        }

        let turn = state.get_turn();
        let winner = -1;
        if (state.get_status() === MinesweeperFlagsGameStatus.Gameover) {
            winner = turn;
            turn = -1;
        }

        clientIds.forEach((clientId, idx) => {
            mp.setViewProps(clientId, 'scores', [state.get_score(0), state.get_score(1)]);
            mp.setViewProps(clientId, 'turn', turn);
            mp.setViewProps(clientId, 'winner', winner);
            mp.setViewProps(clientId, 'last_moves', state.get_last_moves());
            mp.setViewProps(clientId, 'player', idx);
            mp.setViewProps(clientId, 'board', visibleBoard);
        });

        return true;
    },
    methods: {
        'make_move': make_move,
        'new_game': new_game
    },
    views: {
        'main': MinesweeperflagsView
    }
}

export default MinesweeperFlagsRule;
