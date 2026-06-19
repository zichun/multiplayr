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
import { DurianRule } from './durian/durian';
import { StartupsRule } from './startups/startups';
import { CleverRule } from './clever/clever';
import { TTYKMRule } from './ttykm/ttykm';
import { MaskmenRule } from './maskmen/maskmen';


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

const DurianDebugger = NewDebuggerRule(
    'durian',
    DurianRule,
    {
        HistoryBufferSize: 10,
        HistoryInSessionStorage: true
    });

const StartupsDebugger = NewDebuggerRule(
    'startups',
    StartupsRule,
    {
        HistoryBufferSize: 10,
        HistoryInSessionStorage: true
    });

const CleverDebugger = NewDebuggerRule(
    'clever',
    CleverRule,
    {
        HistoryBufferSize: 10,
        HistoryInSessionStorage: true
    });

const TTYKMDebugger = NewDebuggerRule(
    'ttykm',
    TTYKMRule,
    {
        HistoryBufferSize: 10,
        HistoryInSessionStorage: true
    });

const MaskmenDebugger = NewDebuggerRule(
    'maskmen',
    MaskmenRule,
    {
        HistoryBufferSize: 10,
        HistoryInSessionStorage: true
    });

const MinesweeperFlagsDebugger = NewDebuggerRule(
    'minesweeperflags',
    MinesweeperFlagsRule,
    {
        HistoryBufferSize: 10,
        HistoryInSessionStorage: true
    });

const TicTacToePokerDebugger = NewDebuggerRule(
    'tictactoepoker',
    TicTacToePokerRule,
    {
        HistoryBufferSize: 10,
        HistoryInSessionStorage: true
    });

const ItoDebugger = NewDebuggerRule(
    'ito',
    ItoRule,
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
        rule: RockScissorsPaperRule,
        icon: '✊'
    },
    'theoddone': {
        description: 'Guess the odd one',
        rules: ['lobby', 'gameshell', 'theoddone'],
        rule: TheOddOneRule,
        icon: '🔍'
    },
    'coup': {
        description: 'Coup - Resistance',
        rules: ['lobby', 'gameshell', 'coup'],
        rule: CoupRule,
        icon: '⚔️'
    },
    'avalon': {
        description: 'The Resistance - Avalon',
        rules: ['lobby', 'gameshell', 'avalon'],
        rule: AvalonRule,
        icon: '👑'
    },
    'decrypto': {
        description: 'Decrypto',
        rules: ['lobby', 'gameshell', 'decrypto'],
        rule: DecryptoRule,
        icon: '🕵️'
    },
    'minesweeperflags': {
        description: 'Minesweeper Flags',
        rules: ['gameshell', 'minesweeperflags'],
        rule: MinesweeperFlagsRule,
        icon: '🚩'
    },
    'minesweeperflags-debug': {
        description: 'Minesweeper Flags (Debug)',
        debug: true,
        rules: ['gameshell', 'minesweeperflags', 'debugger'],
        rule: MinesweeperFlagsDebugger,
        icon: '🚩'
    },
    'tictactoepoker': {
        description: 'Tic-tac-toe Poker',
        rules: ['gameshell', 'tictactoepoker'],
        rule: TicTacToePokerRule,
        icon: '❌'
    },
    'tictactoepoker-debug': {
        description: 'Tic-tac-toe Poker (Debug)',
        debug: true,
        rules: ['gameshell', 'tictactoepoker', 'debugger'],
        rule: TicTacToePokerDebugger,
        icon: '❌'
    },
    'ito': {
        description: 'Ito - Cooperative Number Game',
        rules: ['lobby', 'gameshell', 'ito'],
        rule: ItoRule,
        icon: '🔢'
    },
    'ito-debug': {
        description: 'Ito (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'ito', 'debugger'],
        rule: ItoDebugger,
        icon: '🔢'
    },
    'catchsketch': {
        description: 'Catch Sketch - Speed Drawing Guessing Game',
        rules: ['lobby', 'gameshell', 'drawing', 'catchsketch'],
        rule: CatchSketchRule,
        icon: '📝'
    },
    'coup-debug': {
        description: 'Coup - Resistance (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'coup', 'debugger'],
        rule: CoupDebugger,
        icon: '⚔️'
    },
    'avalon-debug': {
        description: 'Avalon (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'avalon', 'debugger'],
        rule: AvalonDebugger,
        icon: '👑'
    },
    'theoddone-debug': {
        description: 'TheOddOne (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'theoddone', 'debugger'],
        rule: TheOddOneDebugger,
        icon: '🔍'
    },
    'decrypto-debug': {
        description: 'Decrypto (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'decrypto', 'debugger'],
        rule: DecryptoDebugger,
        icon: '🕵️'
    },
    'catchsketch-debug': {
        description: 'Catch Sketch (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'drawing', 'catchsketch', 'debugger'],
        rule: CatchSketchDebugger,
        icon: '📝'
    },
    'durian': {
        description: 'Durian - Shopkeeper & Inventory Crisis Game',
        rules: ['lobby', 'gameshell', 'durian'],
        rule: DurianRule,
        icon: '🍍'
    },
    'durian-debug': {
        description: 'Durian (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'durian', 'debugger'],
        rule: DurianDebugger,
        icon: '🍍'
    },
    'startups': {
        description: 'Startups - Competitive Investment Card Game',
        rules: ['lobby', 'gameshell', 'startups'],
        rule: StartupsRule,
        icon: '💼'
    },
    'startups-debug': {
        description: 'Startups (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'startups', 'debugger'],
        rule: StartupsDebugger,
        icon: '💼'
    },
    'clever': {
        description: 'Clever - Dice Drafting Roll and Write',
        rules: ['lobby', 'gameshell', 'clever'],
        rule: CleverRule,
        icon: '🧠'
    },
    'clever-debug': {
        description: 'Clever (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'clever', 'debugger'],
        rule: CleverDebugger,
        icon: '🧠'
    },
    'ttykm': {
        description: 'That Time You Killed Me - Abstract Time Travel Strategy',
        rules: ['gameshell', 'ttykm'],
        rule: TTYKMRule,
        icon: '⏳'
    },
    'ttykm-debug': {
        description: 'That Time You Killed Me (Debug)',
        debug: true,
        rules: ['gameshell', 'ttykm', 'debugger'],
        rule: TTYKMDebugger,
        icon: '⏳'
    },
    'maskmen': {
        description: 'Maskmen - Dynamic Wrestler Hierarchy Card Game',
        rules: ['lobby', 'gameshell', 'maskmen'],
        rule: MaskmenRule,
        icon: '🤼'
    },
    'maskmen-debug': {
        description: 'Maskmen (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'maskmen', 'debugger'],
        rule: MaskmenDebugger,
        icon: '🤼'
    }
};

export default MPRULES;

