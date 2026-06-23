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
import { CockroachRule } from './cockroach/cockroach';
import { JaipurRule } from './jaipur/jaipur';


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

const CockroachDebugger = NewDebuggerRule(
    'cockroach',
    CockroachRule,
    {
        HistoryBufferSize: 10,
        HistoryInSessionStorage: true
    });

const JaipurDebugger = NewDebuggerRule(
    'jaipur',
    JaipurRule,
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
        icon: '✊',
        minPlayers: 2,
        maxPlayers: 2
    },
    'theoddone': {
        description: 'Guess the odd one',
        rules: ['lobby', 'gameshell', 'theoddone'],
        rule: TheOddOneRule,
        icon: '🔍',
        minPlayers: 3,
        maxPlayers: 8
    },
    'coup': {
        description: 'Coup - Resistance',
        rules: ['lobby', 'gameshell', 'coup'],
        rule: CoupRule,
        icon: '⚔️',
        minPlayers: 2,
        maxPlayers: 6
    },
    'avalon': {
        description: 'The Resistance - Avalon',
        rules: ['lobby', 'gameshell', 'avalon'],
        rule: AvalonRule,
        icon: '👑',
        minPlayers: 5,
        maxPlayers: 10
    },
    'decrypto': {
        description: 'Decrypto',
        rules: ['lobby', 'gameshell', 'decrypto'],
        rule: DecryptoRule,
        icon: '🕵️',
        minPlayers: 4,
        maxPlayers: 4
    },
    'minesweeperflags': {
        description: 'Minesweeper Flags',
        rules: ['gameshell', 'minesweeperflags'],
        rule: MinesweeperFlagsRule,
        icon: '🚩',
        minPlayers: 2,
        maxPlayers: 2
    },
    'minesweeperflags-debug': {
        description: 'Minesweeper Flags (Debug)',
        debug: true,
        rules: ['gameshell', 'minesweeperflags', 'debugger'],
        rule: MinesweeperFlagsDebugger,
        icon: '🚩',
        minPlayers: 2,
        maxPlayers: 2
    },
    'tictactoepoker': {
        description: 'Tic-tac-toe Poker',
        rules: ['gameshell', 'tictactoepoker'],
        rule: TicTacToePokerRule,
        icon: '❌',
        minPlayers: 2,
        maxPlayers: 2
    },
    'tictactoepoker-debug': {
        description: 'Tic-tac-toe Poker (Debug)',
        debug: true,
        rules: ['gameshell', 'tictactoepoker', 'debugger'],
        rule: TicTacToePokerDebugger,
        icon: '❌',
        minPlayers: 2,
        maxPlayers: 2
    },
    'ito': {
        description: 'Ito - Cooperative Number Game',
        rules: ['lobby', 'gameshell', 'ito'],
        rule: ItoRule,
        icon: '🔢',
        minPlayers: 3,
        maxPlayers: 12
    },
    'ito-debug': {
        description: 'Ito (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'ito', 'debugger'],
        rule: ItoDebugger,
        icon: '🔢',
        minPlayers: 3,
        maxPlayers: 12
    },
    'catchsketch': {
        description: 'Catch Sketch - Speed Drawing Guessing Game',
        rules: ['lobby', 'gameshell', 'drawing', 'catchsketch'],
        rule: CatchSketchRule,
        icon: '📝',
        minPlayers: 3,
        maxPlayers: 8
    },
    'coup-debug': {
        description: 'Coup - Resistance (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'coup', 'debugger'],
        rule: CoupDebugger,
        icon: '⚔️',
        minPlayers: 2,
        maxPlayers: 6
    },
    'avalon-debug': {
        description: 'Avalon (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'avalon', 'debugger'],
        rule: AvalonDebugger,
        icon: '👑',
        minPlayers: 5,
        maxPlayers: 10
    },
    'theoddone-debug': {
        description: 'TheOddOne (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'theoddone', 'debugger'],
        rule: TheOddOneDebugger,
        icon: '🔍',
        minPlayers: 3,
        maxPlayers: 8
    },
    'decrypto-debug': {
        description: 'Decrypto (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'decrypto', 'debugger'],
        rule: DecryptoDebugger,
        icon: '🕵️',
        minPlayers: 4,
        maxPlayers: 4
    },
    'catchsketch-debug': {
        description: 'Catch Sketch (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'drawing', 'catchsketch', 'debugger'],
        rule: CatchSketchDebugger,
        icon: '📝',
        minPlayers: 3,
        maxPlayers: 8
    },
    'durian': {
        description: 'Durian - Shopkeeper & Inventory Crisis Game',
        rules: ['lobby', 'gameshell', 'durian'],
        rule: DurianRule,
        icon: '🍍',
        minPlayers: 2,
        maxPlayers: 7
    },
    'durian-debug': {
        description: 'Durian (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'durian', 'debugger'],
        rule: DurianDebugger,
        icon: '🍍',
        minPlayers: 2,
        maxPlayers: 7
    },
    'startups': {
        description: 'Startups - Competitive Investment Card Game',
        rules: ['lobby', 'gameshell', 'startups'],
        rule: StartupsRule,
        icon: '💼',
        minPlayers: 3,
        maxPlayers: 7
    },
    'startups-debug': {
        description: 'Startups (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'startups', 'debugger'],
        rule: StartupsDebugger,
        icon: '💼',
        minPlayers: 3,
        maxPlayers: 7
    },
    'clever': {
        description: 'Clever - Dice Drafting Roll and Write',
        rules: ['lobby', 'gameshell', 'clever'],
        rule: CleverRule,
        icon: '🧠',
        minPlayers: 1,
        maxPlayers: 4
    },
    'clever-debug': {
        description: 'Clever (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'clever', 'debugger'],
        rule: CleverDebugger,
        icon: '🧠',
        minPlayers: 1,
        maxPlayers: 4
    },
    'ttykm': {
        description: 'That Time You Killed Me - Abstract Time Travel Strategy',
        rules: ['gameshell', 'ttykm'],
        rule: TTYKMRule,
        icon: '⏳',
        minPlayers: 2,
        maxPlayers: 2
    },
    'ttykm-debug': {
        description: 'That Time You Killed Me (Debug)',
        debug: true,
        rules: ['gameshell', 'ttykm', 'debugger'],
        rule: TTYKMDebugger,
        icon: '⏳',
        minPlayers: 2,
        maxPlayers: 2
    },
    'maskmen': {
        description: 'Maskmen - Dynamic Wrestler Hierarchy Card Game',
        rules: ['lobby', 'gameshell', 'maskmen'],
        rule: MaskmenRule,
        icon: '🤼',
        minPlayers: 2,
        maxPlayers: 6
    },
    'maskmen-debug': {
        description: 'Maskmen (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'maskmen', 'debugger'],
        rule: MaskmenDebugger,
        icon: '🤼',
        minPlayers: 2,
        maxPlayers: 6
    },
    'cockroach': {
        description: 'Cockroach Poker: Royal - Bluffing Card Game',
        rules: ['lobby', 'gameshell', 'cockroach'],
        rule: CockroachRule,
        icon: '🪳',
        minPlayers: 2,
        maxPlayers: 6
    },
    'cockroach-debug': {
        description: 'Cockroach Poker: Royal (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'cockroach', 'debugger'],
        rule: CockroachDebugger,
        icon: '🪳',
        minPlayers: 2,
        maxPlayers: 6
    },
    'jaipur': {
        description: 'Jaipur - 2 Player Tactical Trading Card Game',
        rules: ['lobby', 'gameshell', 'jaipur'],
        rule: JaipurRule,
        icon: '🐫',
        minPlayers: 2,
        maxPlayers: 2
    },
    'jaipur-debug': {
        description: 'Jaipur (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'jaipur', 'debugger'],
        rule: JaipurDebugger,
        icon: '🐫',
        minPlayers: 2,
        maxPlayers: 2
    }
};

export default MPRULES;

