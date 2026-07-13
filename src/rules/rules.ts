/**
 * rules.ts - define all the rules that the service knows about dynamically.
 * Static imports are removed to allow Webpack code splitting.
 */
import './fontawesome';

export const MPRULES = {
    'rockscissorspaper': {
        description: 'A classic 2 player game',
        rules: ['lobby', 'gameshell', 'rockscissorspaper'],
        rule: () => import('./rockscissorspaper/rockscissorspaper').then(m => m.RockScissorsPaperRule),
        icon: '✊',
        minPlayers: 2,
        maxPlayers: 2
    },
    'theoddone': {
        description: 'Guess the odd one',
        rules: ['lobby', 'gameshell', 'theoddone'],
        rule: () => import('./theoddone/theoddone').then(m => m.TheOddOneRule),
        icon: '🔍',
        minPlayers: 3,
        maxPlayers: 8
    },
    'coup': {
        description: 'Coup - Resistance',
        rules: ['lobby', 'gameshell', 'coup'],
        rule: () => import('./coup/coup').then(m => m.CoupRule),
        icon: '⚔️',
        minPlayers: 2,
        maxPlayers: 6
    },
    'avalon': {
        description: 'The Resistance - Avalon',
        rules: ['lobby', 'gameshell', 'avalon'],
        rule: () => import('./avalon/avalon').then(m => m.AvalonRule),
        icon: '👑',
        minPlayers: 5,
        maxPlayers: 10
    },
    'decrypto': {
        description: 'Decrypto',
        rules: ['lobby', 'gameshell', 'decrypto'],
        rule: () => import('./decrypto/decrypto').then(m => m.DecryptoRule),
        icon: '🕵️',
        minPlayers: 4,
        maxPlayers: 4
    },
    'minesweeperflags': {
        description: 'Minesweeper Flags',
        rules: ['gameshell', 'minesweeperflags'],
        rule: () => import('./minesweeperflags/minesweeperflags').then(m => m.MinesweeperFlagsRule),
        icon: '🚩',
        minPlayers: 2,
        maxPlayers: 2
    },
    'minesweeperflags-debug': {
        description: 'Minesweeper Flags (Debug)',
        debug: true,
        rules: ['gameshell', 'minesweeperflags', 'debugger'],
        rule: () => Promise.all([
            import('./debugger/debugger'),
            import('./minesweeperflags/minesweeperflags')
        ]).then(([dbg, orig]) => dbg.NewDebuggerRule('minesweeperflags', orig.MinesweeperFlagsRule, {
            HistoryBufferSize: 10,
            HistoryInSessionStorage: true
        })),
        icon: '🚩',
        minPlayers: 2,
        maxPlayers: 2
    },
    'tictactoepoker': {
        description: 'Tic-tac-toe Poker',
        rules: ['gameshell', 'tictactoepoker'],
        rule: () => import('./tictactoepoker/tictactoepoker_rule').then(m => m.TicTacToePokerRule),
        icon: '❌',
        minPlayers: 2,
        maxPlayers: 2
    },
    'tictactoepoker-debug': {
        description: 'Tic-tac-toe Poker (Debug)',
        debug: true,
        rules: ['gameshell', 'tictactoepoker', 'debugger'],
        rule: () => Promise.all([
            import('./debugger/debugger'),
            import('./tictactoepoker/tictactoepoker_rule')
        ]).then(([dbg, orig]) => dbg.NewDebuggerRule('tictactoepoker', orig.TicTacToePokerRule, {
            HistoryBufferSize: 10,
            HistoryInSessionStorage: true
        })),
        icon: '❌',
        minPlayers: 2,
        maxPlayers: 2
    },
    'ito': {
        description: 'Ito - Cooperative Number Game',
        rules: ['lobby', 'gameshell', 'ito'],
        rule: () => import('./ito/ito').then(m => m.ItoRule),
        icon: '🔢',
        minPlayers: 3,
        maxPlayers: 12
    },
    'ito-debug': {
        description: 'Ito (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'ito', 'debugger'],
        rule: () => Promise.all([
            import('./debugger/debugger'),
            import('./ito/ito')
        ]).then(([dbg, orig]) => dbg.NewDebuggerRule('ito', orig.ItoRule, {
            HistoryBufferSize: 10,
            HistoryInSessionStorage: true
        })),
        icon: '🔢',
        minPlayers: 3,
        maxPlayers: 12
    },
    'catchsketch': {
        description: 'Catch Sketch - Speed Drawing Guessing Game',
        rules: ['lobby', 'gameshell', 'drawing', 'catchsketch'],
        rule: () => import('./catchsketch/catchsketch').then(m => m.CatchSketchRule),
        icon: '📝',
        minPlayers: 3,
        maxPlayers: 8
    },
    'coup-debug': {
        description: 'Coup - Resistance (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'coup', 'debugger'],
        rule: () => Promise.all([
            import('./debugger/debugger'),
            import('./coup/coup')
        ]).then(([dbg, orig]) => dbg.NewDebuggerRule('coup', orig.CoupRule, {
            HistoryBufferSize: 10,
            HistoryInSessionStorage: true
        })),
        icon: '⚔️',
        minPlayers: 2,
        maxPlayers: 6
    },
    'avalon-debug': {
        description: 'Avalon (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'avalon', 'debugger'],
        rule: () => Promise.all([
            import('./debugger/debugger'),
            import('./avalon/avalon')
        ]).then(([dbg, orig]) => dbg.NewDebuggerRule('avalon', orig.AvalonRule, {
            HistoryBufferSize: 10,
            HistoryInSessionStorage: true
        })),
        icon: '👑',
        minPlayers: 5,
        maxPlayers: 10
    },
    'theoddone-debug': {
        description: 'TheOddOne (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'theoddone', 'debugger'],
        rule: () => Promise.all([
            import('./debugger/debugger'),
            import('./theoddone/theoddone')
        ]).then(([dbg, orig]) => dbg.NewDebuggerRule('theoddone', orig.TheOddOneRule, {
            HistoryBufferSize: 10,
            HistoryInSessionStorage: true
        })),
        icon: '🔍',
        minPlayers: 3,
        maxPlayers: 8
    },
    'decrypto-debug': {
        description: 'Decrypto (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'decrypto', 'debugger'],
        rule: () => Promise.all([
            import('./debugger/debugger'),
            import('./decrypto/decrypto')
        ]).then(([dbg, orig]) => dbg.NewDebuggerRule('decrypto', orig.DecryptoRule, {
            HistoryBufferSize: 10,
            HistoryInSessionStorage: true
        })),
        icon: '🕵️',
        minPlayers: 4,
        maxPlayers: 4
    },
    'catchsketch-debug': {
        description: 'Catch Sketch (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'drawing', 'catchsketch', 'debugger'],
        rule: () => Promise.all([
            import('./debugger/debugger'),
            import('./catchsketch/catchsketch')
        ]).then(([dbg, orig]) => dbg.NewDebuggerRule('catchsketch', orig.CatchSketchRule, {
            HistoryBufferSize: 10,
            HistoryInSessionStorage: true
        })),
        icon: '📝',
        minPlayers: 3,
        maxPlayers: 8
    },
    'durian': {
        description: 'Durian - Shopkeeper & Inventory Crisis Game',
        rules: ['lobby', 'gameshell', 'durian'],
        rule: () => import('./durian/durian').then(m => m.DurianRule),
        icon: '🍍',
        minPlayers: 2,
        maxPlayers: 7
    },
    'durian-debug': {
        description: 'Durian (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'durian', 'debugger'],
        rule: () => Promise.all([
            import('./debugger/debugger'),
            import('./durian/durian')
        ]).then(([dbg, orig]) => dbg.NewDebuggerRule('durian', orig.DurianRule, {
            HistoryBufferSize: 10,
            HistoryInSessionStorage: true
        })),
        icon: '🍍',
        minPlayers: 2,
        maxPlayers: 7
    },
    'startups': {
        description: 'Startups - Competitive Investment Card Game',
        rules: ['lobby', 'gameshell', 'startups'],
        rule: () => import('./startups/startups').then(m => m.StartupsRule),
        icon: '💼',
        minPlayers: 3,
        maxPlayers: 7
    },
    'startups-debug': {
        description: 'Startups (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'startups', 'debugger'],
        rule: () => Promise.all([
            import('./debugger/debugger'),
            import('./startups/startups')
        ]).then(([dbg, orig]) => dbg.NewDebuggerRule('startups', orig.StartupsRule, {
            HistoryBufferSize: 10,
            HistoryInSessionStorage: true
        })),
        icon: '💼',
        minPlayers: 3,
        maxPlayers: 7
    },
    'clever': {
        description: 'Clever - Dice Drafting Roll and Write',
        rules: ['lobby', 'gameshell', 'clever'],
        rule: () => import('./clever/clever').then(m => m.CleverRule),
        icon: '🧠',
        minPlayers: 1,
        maxPlayers: 4
    },
    'clever-debug': {
        description: 'Clever (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'clever', 'debugger'],
        rule: () => Promise.all([
            import('./debugger/debugger'),
            import('./clever/clever')
        ]).then(([dbg, orig]) => dbg.NewDebuggerRule('clever', orig.CleverRule, {
            HistoryBufferSize: 10,
            HistoryInSessionStorage: true
        })),
        icon: '🧠',
        minPlayers: 1,
        maxPlayers: 4
    },
    'ttykm': {
        description: 'That Time You Killed Me - Abstract Time Travel Strategy',
        rules: ['gameshell', 'ttykm'],
        rule: () => import('./ttykm/ttykm').then(m => m.TTYKMRule),
        icon: '⏳',
        minPlayers: 2,
        maxPlayers: 2
    },
    'ttykm-debug': {
        description: 'That Time You Killed Me (Debug)',
        debug: true,
        rules: ['gameshell', 'ttykm', 'debugger'],
        rule: () => Promise.all([
            import('./debugger/debugger'),
            import('./ttykm/ttykm')
        ]).then(([dbg, orig]) => dbg.NewDebuggerRule('ttykm', orig.TTYKMRule, {
            HistoryBufferSize: 10,
            HistoryInSessionStorage: true
        })),
        icon: '⏳',
        minPlayers: 2,
        maxPlayers: 2
    },
    'maskmen': {
        description: 'Maskmen - Dynamic Wrestler Hierarchy Card Game',
        rules: ['lobby', 'gameshell', 'maskmen'],
        rule: () => import('./maskmen/maskmen').then(m => m.MaskmenRule),
        icon: '🤼',
        minPlayers: 2,
        maxPlayers: 6
    },
    'maskmen-debug': {
        description: 'Maskmen (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'maskmen', 'debugger'],
        rule: () => Promise.all([
            import('./debugger/debugger'),
            import('./maskmen/maskmen')
        ]).then(([dbg, orig]) => dbg.NewDebuggerRule('maskmen', orig.MaskmenRule, {
            HistoryBufferSize: 10,
            HistoryInSessionStorage: true
        })),
        icon: '🤼',
        minPlayers: 2,
        maxPlayers: 6
    },
    'cockroach': {
        description: 'Cockroach Poker: Royal - Bluffing Card Game',
        rules: ['lobby', 'gameshell', 'cockroach'],
        rule: () => import('./cockroach/cockroach').then(m => m.CockroachRule),
        icon: '🪳',
        minPlayers: 2,
        maxPlayers: 6
    },
    'cockroach-debug': {
        description: 'Cockroach Poker: Royal (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'cockroach', 'debugger'],
        rule: () => Promise.all([
            import('./debugger/debugger'),
            import('./cockroach/cockroach')
        ]).then(([dbg, orig]) => dbg.NewDebuggerRule('cockroach', orig.CockroachRule, {
            HistoryBufferSize: 10,
            HistoryInSessionStorage: true
        })),
        icon: '🪳',
        minPlayers: 2,
        maxPlayers: 6
    },
    'jaipur': {
        description: 'Jaipur - 2 Player Tactical Trading Card Game',
        rules: ['lobby', 'gameshell', 'jaipur'],
        rule: () => import('./jaipur/jaipur').then(m => m.JaipurRule),
        icon: '🐫',
        minPlayers: 2,
        maxPlayers: 2
    },
    'jaipur-debug': {
        description: 'Jaipur (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'jaipur', 'debugger'],
        rule: () => Promise.all([
            import('./debugger/debugger'),
            import('./jaipur/jaipur')
        ]).then(([dbg, orig]) => dbg.NewDebuggerRule('jaipur', orig.JaipurRule, {
            HistoryBufferSize: 10,
            HistoryInSessionStorage: true
        })),
        icon: '🐫',
        minPlayers: 2,
        maxPlayers: 2
    },
    'splendorduel': {
        description: 'Splendor Duel - 2 Player Tactical Jewel Game',
        rules: ['lobby', 'gameshell', 'splendorduel'],
        rule: () => import('./splendorduel/splendorduel').then(m => m.SplendorDuelRule),
        icon: '💎',
        minPlayers: 2,
        maxPlayers: 2
    },
    'catinthebox': {
        description: 'Cat in the Box - Quantum Trick-Taking Game',
        rules: ['lobby', 'gameshell', 'catinthebox'],
        rule: () => import('./catinthebox/catinthebox').then(m => m.CatInTheBoxRule),
        icon: '🐱',
        minPlayers: 2,
        maxPlayers: 5
    },
    'catinthebox-debug': {
        description: 'Cat in the Box (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'catinthebox', 'debugger'],
        rule: () => Promise.all([
            import('./debugger/debugger'),
            import('./catinthebox/catinthebox')
        ]).then(([dbg, orig]) => dbg.NewDebuggerRule('catinthebox', orig.CatInTheBoxRule, {
            HistoryBufferSize: 10,
            HistoryInSessionStorage: true
        })),
        icon: '🐱',
        minPlayers: 2,
        maxPlayers: 5
    },
    'splendorduel-debug': {
        description: 'Splendor Duel (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'splendorduel', 'debugger'],
        rule: () => Promise.all([
            import('./debugger/debugger'),
            import('./splendorduel/splendorduel')
        ]).then(([dbg, orig]) => dbg.NewDebuggerRule('splendorduel', orig.SplendorDuelRule, {
            HistoryBufferSize: 10,
            HistoryInSessionStorage: true
        })),
        icon: '💎',
        minPlayers: 2,
        maxPlayers: 2
    },
    'trio': {
        description: 'Trio - Memory & Deduction Number Game',
        rules: ['lobby', 'gameshell', 'trio'],
        rule: () => import('./trio/trio').then(m => m.TrioRule),
        icon: '🔺',
        minPlayers: 3,
        maxPlayers: 6
    },
    'trio-debug': {
        description: 'Trio (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'trio', 'debugger'],
        rule: () => Promise.all([
            import('./debugger/debugger'),
            import('./trio/trio')
        ]).then(([dbg, orig]) => dbg.NewDebuggerRule('trio', orig.TrioRule, {
            HistoryBufferSize: 10,
            HistoryInSessionStorage: true
        })),
        icon: '🔺',
        minPlayers: 3,
        maxPlayers: 6
    },
    'regicide': {
        description: 'Regicide - Cooperative Card Battle',
        rules: ['lobby', 'gameshell', 'regicide'],
        rule: () => import('./regicide/regicide').then(m => m.RegicideRule),
        icon: '🗡️',
        minPlayers: 1,
        maxPlayers: 4
    },
    'regicide-debug': {
        description: 'Regicide (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'regicide', 'debugger'],
        rule: () => Promise.all([
            import('./debugger/debugger'),
            import('./regicide/regicide')
        ]).then(([dbg, orig]) => dbg.NewDebuggerRule('regicide', orig.RegicideRule, {
            HistoryBufferSize: 10,
            HistoryInSessionStorage: true
        })),
        icon: '🗡️',
        minPlayers: 1,
        maxPlayers: 4
    },
    'skull': {
        description: 'Skull - Bluffing & Bidding Game',
        rules: ['lobby', 'gameshell', 'skull'],
        rule: () => import('./skull/skull').then(m => m.SkullRule),
        icon: '💀',
        minPlayers: 3,
        maxPlayers: 6
    },
    'skull-debug': {
        description: 'Skull (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'skull', 'debugger'],
        rule: () => Promise.all([
            import('./debugger/debugger'),
            import('./skull/skull')
        ]).then(([dbg, orig]) => dbg.NewDebuggerRule('skull', orig.SkullRule, {
            HistoryBufferSize: 10,
            HistoryInSessionStorage: true
        })),
        icon: '💀',
        minPlayers: 3,
        maxPlayers: 6
    }
};

export default MPRULES;
