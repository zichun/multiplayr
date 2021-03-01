import { NewDebuggerRule } from './debugger/debugger';
import { TicTacToePokerRule } from './tictactoepoker/tictactoepoker_rule';

const TicTacToePokerDebugger = NewDebuggerRule(
    'tictactoepoker',
    TicTacToePokerRule,
    {
        HistoryBufferSize: 10,
        HistoryInSessionStorage: true
    });

export const MPRULES = {
    'tictactoepoker': {
        description: 'TicTacToePoker',
        rule: TicTacToePokerRule,
    },
    'tictactoepoker-debug': {
        description: 'TicTacToePoker (Debug)',
        debug: true,
        rule: TicTacToePokerDebugger,
    }
};

export default MPRULES;
