/**
 * rules_sync.ts - define all the rules that the service knows about synchronously.
 * This is used by unit tests running under Node.js/ts-mocha to avoid asynchronous import overhead.
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
import { SplendorDuelRule } from './splendorduel/splendorduel';
import { CatInTheBoxRule } from './catinthebox/catinthebox';
import { TrioRule } from './trio/trio';
import { SeaSaltRule } from './seasalt/seasalt';
import { RegicideRule } from './regicide/regicide';
import { SkullRule } from './skull/skull';
import { CourtisansRule } from './courtisans/courtisans';
import { MagicalAthletesRule } from './magicalathletes/magicalathletes';
import { OffWithTheirHeadsRule } from './offwiththeirheads/offwiththeirheads';


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

const SplendorDuelDebugger = NewDebuggerRule(
    'splendorduel',
    SplendorDuelRule,
    {
        HistoryBufferSize: 10,
        HistoryInSessionStorage: true
    });

const CatInTheBoxDebugger = NewDebuggerRule(
    'catinthebox',
    CatInTheBoxRule,
    {
        HistoryBufferSize: 10,
        HistoryInSessionStorage: true
    });

const TrioDebugger = NewDebuggerRule(
    'trio',
    TrioRule,
    {
        HistoryBufferSize: 10,
        HistoryInSessionStorage: true
    });

const SeaSaltDebugger = NewDebuggerRule(
    'seasalt',
    SeaSaltRule,
    {
        HistoryBufferSize: 10,
        HistoryInSessionStorage: true
    });

const RegicideDebugger = NewDebuggerRule(
    'regicide',
    RegicideRule,
    {
        HistoryBufferSize: 10,
        HistoryInSessionStorage: true
    });

const SkullDebugger = NewDebuggerRule(
    'skull',
    SkullRule,
    {
        HistoryBufferSize: 10,
        HistoryInSessionStorage: true
    });

const CourtisansDebugger = NewDebuggerRule(
    'courtisans',
    CourtisansRule,
    {
        HistoryBufferSize: 10,
        HistoryInSessionStorage: true
    });

const MagicalAthletesDebugger = NewDebuggerRule(
    'magicalathletes',
    MagicalAthletesRule,
    {
        HistoryBufferSize: 10,
        HistoryInSessionStorage: true
    });

const OffWithTheirHeadsDebugger = NewDebuggerRule(
    'offwiththeirheads',
    OffWithTheirHeadsRule,
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
    },
    'splendorduel': {
        description: 'Splendor Duel - 2 Player Tactical Jewel Game',
        rules: ['lobby', 'gameshell', 'splendorduel'],
        rule: SplendorDuelRule,
        icon: '💎',
        minPlayers: 2,
        maxPlayers: 2
    },
    'splendorduel-debug': {
        description: 'Splendor Duel (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'splendorduel', 'debugger'],
        rule: SplendorDuelDebugger,
        icon: '💎',
        minPlayers: 2,
        maxPlayers: 2
    },
    'catinthebox': {
        description: 'Cat in the Box - Quantum Trick-Taking Game',
        rules: ['lobby', 'gameshell', 'catinthebox'],
        rule: CatInTheBoxRule,
        icon: '🐱',
        minPlayers: 2,
        maxPlayers: 5
    },
    'catinthebox-debug': {
        description: 'Cat in the Box (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'catinthebox', 'debugger'],
        rule: CatInTheBoxDebugger,
        icon: '🐱',
        minPlayers: 2,
        maxPlayers: 5
    },
    'trio': {
        description: 'Trio - Memory & Deduction Number Game',
        rules: ['lobby', 'gameshell', 'trio'],
        rule: TrioRule,
        icon: '🔺',
        minPlayers: 3,
        maxPlayers: 6
    },
    'trio-debug': {
        description: 'Trio (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'trio', 'debugger'],
        rule: TrioDebugger,
        icon: '🔺',
        minPlayers: 3,
        maxPlayers: 6
    },
    'seasalt': {
        description: 'Sea Salt & Paper - Push-Your-Luck Set Collection',
        rules: ['lobby', 'gameshell', 'seasalt'],
        rule: SeaSaltRule,
        icon: '🐚',
        minPlayers: 2,
        maxPlayers: 4
    },
    'seasalt-debug': {
        description: 'Sea Salt & Paper (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'seasalt', 'debugger'],
        rule: SeaSaltDebugger,
        icon: '🐚',
        minPlayers: 2,
        maxPlayers: 4
    },
    'regicide': {
        description: 'Regicide - Cooperative Card Battle',
        rules: ['lobby', 'gameshell', 'regicide'],
        rule: RegicideRule,
        icon: '🗡️',
        minPlayers: 1,
        maxPlayers: 4
    },
    'regicide-debug': {
        description: 'Regicide (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'regicide', 'debugger'],
        rule: RegicideDebugger,
        icon: '🗡️',
        minPlayers: 1,
        maxPlayers: 4
    },
    'skull': {
        description: 'Skull - Bluffing & Bidding Game',
        rules: ['lobby', 'gameshell', 'skull'],
        rule: SkullRule,
        icon: '💀',
        minPlayers: 3,
        maxPlayers: 6
    },
    'skull-debug': {
        description: 'Skull (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'skull', 'debugger'],
        rule: SkullDebugger,
        icon: '💀',
        minPlayers: 3,
        maxPlayers: 6
    },
    'courtisans': {
        description: 'Courtisans - Courtly Set Collection & Take-That',
        rules: ['lobby', 'gameshell', 'courtisans'],
        rule: CourtisansRule,
        icon: '🎭',
        minPlayers: 2,
        maxPlayers: 5
    },
    'courtisans-debug': {
        description: 'Courtisans (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'courtisans', 'debugger'],
        rule: CourtisansDebugger,
        icon: '🎭',
        minPlayers: 2,
        maxPlayers: 5
    },
    'magicalathletes': {
        description: 'Magical Athletes - Push-Your-Luck Racing',
        rules: ['lobby', 'gameshell', 'magicalathletes'],
        rule: MagicalAthletesRule,
        icon: '🏃',
        minPlayers: 2,
        maxPlayers: 6
    },
    'magicalathletes-debug': {
        description: 'Magical Athletes (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'magicalathletes', 'debugger'],
        rule: MagicalAthletesDebugger,
        icon: '🏃',
        minPlayers: 2,
        maxPlayers: 6
    },
    'offwiththeirheads': {
        description: 'Off With Their Heads - Wonderland Roll-and-Write',
        rules: ['lobby', 'gameshell', 'offwiththeirheads'],
        rule: OffWithTheirHeadsRule,
        icon: '👑',
        minPlayers: 2,
        maxPlayers: 4
    },
    'offwiththeirheads-debug': {
        description: 'Off With Their Heads (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'offwiththeirheads', 'debugger'],
        rule: OffWithTheirHeadsDebugger,
        icon: '👑',
        minPlayers: 2,
        maxPlayers: 4
    }
};

export default MPRULES;
