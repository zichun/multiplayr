/**
 * rules.ts - define all the rules that the service knows about.
 * This should be deprecated and changed to a json config instead.
 */
import './fontawesome';

import { RockScissorsPaperRule } from './rockscissorspaper/rockscissorspaper';
import { TheOddOneRule } from './theoddone/theoddone';
import { CoupRule } from './coup/coup';
import { NewDebuggerRule } from './debugger/debugger';
import { AvalonRule } from './avalon/avalon';
import { DecryptoRule } from './decrypto/decrypto';
import { MinesweeperFlagsRule } from './minesweeperflags/minesweeperflags';
import { TicTacToePokerRule } from './tictactoepoker/tictactoepoker_rule';
import { ItoRule } from './ito/ito';
import DrawingRule from './drawing/drawing';
import { CatchSketchRule } from './catchsketch/catchsketch';

const CoupDebugger = NewDebuggerRule(
    'coup',
    CoupRule,
    {
        HistoryBufferSize: 10,
        HistoryInSessionStorage: true
    });

const AvalonDebugger = NewDebuggerRule(
    'avalon',
    AvalonRule,
    {
        HistoryBufferSize: 10,
        HistoryInSessionStorage: true
    });

const TheOddOneDebugger = NewDebuggerRule(
    'theoddone',
    TheOddOneRule,
    {
        HistoryBufferSize: 10,
        HistoryInSessionStorage: true
    });

const DecryptoDebugger = NewDebuggerRule(
    'decrypto',
    DecryptoRule,
    {
        HistoryBufferSize: 10,
        HistoryInSessionStorage: true
    });

const CatchSketchDebugger = NewDebuggerRule(
    'catchsketch',
    CatchSketchRule,
    {
        HistoryBufferSize: 10,
        HistoryInSessionStorage: true
    });

export const MPRULES = {
    // 'bigger': {
    //     description: 'A luck-based game on who rolls the bigger value!',
    //     rules: ['lobby', 'gameshell', 'bigger'],
    //     onLoad: () => {
    //         return bigger;
    //     }
    // },
    'rockscissorspaper': {
        description: 'A classic 2 player game',
        rules: ['lobby', 'gameshell', 'rockscissorspaper'],
        rule: RockScissorsPaperRule
    },
    'theoddone': {
        description: 'Guess the odd one',
        rules: ['lobby', 'gameshell', 'theoddone'],
        rule: TheOddOneRule
    },
    'coup': {
        description: 'Coup - Resistance',
        rules: ['lobby', 'gameshell', 'coup'],
        rule: CoupRule
    },
    'avalon': {
        description: 'The Resistance - Avalon',
        rules: ['lobby', 'gameshell', 'avalon'],
        rule: AvalonRule
    },
    'decrypto': {
        description: 'Decrypto',
        rules: ['lobby', 'gameshell', 'decrypto'],
        rule: DecryptoRule
    },
    'minesweeperflags': {
        description: 'Minesweeper Flags',
        rules: ['gameshell', 'minesweeperflags'],
        rule: MinesweeperFlagsRule
    },
    'tictactoepoker': {
        description: 'Tic-tac-toe Poker',
        rules: ['gameshell', 'tictactoepoker'],
        rule: TicTacToePokerRule
    },
    'ito': {
        description: 'Ito - Cooperative Number Game',
        rules: ['lobby', 'gameshell', 'ito'],
        rule: ItoRule
    },
    'drawing': {
        description: 'Drawing Canvas - Collaborative Drawing Tool',
        rules: ['drawing'],
        rule: DrawingRule
    },
    'catchsketch': {
        description: 'Catch Sketch - Speed Drawing Guessing Game',
        rules: ['lobby', 'gameshell', 'drawing', 'catchsketch'],
        rule: CatchSketchRule
    },
    'coup-debug': {
        description: 'Coup - Resistance (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'coup', 'debugger'],
        rule: CoupDebugger
    },
    'avalon-debug': {
        description: 'Avalon (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'avalon', 'debugger'],
        rule: AvalonDebugger
    },
    'theoddone-debug': {
        description: 'TheOddOne (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'theoddone', 'debugger'],
        rule: TheOddOneDebugger
    },
    'decrypto-debug': {
        description: 'Decrypto (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'decrypto', 'debugger'],
        rule: DecryptoDebugger
    },
    'catchsketch-debug': {
        description: 'Catch Sketch (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'drawing', 'catchsketch', 'debugger'],
        rule: CatchSketchDebugger
    }
};

export default MPRULES;

