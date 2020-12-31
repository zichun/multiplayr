import Shell from '../gameshell/gameshell';

import {
    GameRuleInterface,
    MPType
} from '../../common/interfaces';

import { MinesweeperBoard } from './minesweeper';

export const MinesweeperFlagsRule: GameRuleInterface = {
    name: 'minesweeperflags',
    plugins: {
        'gameshell': Shell
    },
    globalData: {
        gamestate: null,
        width: 16,
        height: 16,
        bombs: 26,
        turn: 0
    },
    playerData: {
        last_move: (null, null)
    }
}
