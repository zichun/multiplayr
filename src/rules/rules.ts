/**
 * rules.ts - define all the rules that the service knows about dynamically.
 * Static imports are removed to allow Webpack code splitting.
 */
import './fontawesome';
import { GAME_ICONS } from './host-icons';

export const MPRULES = {
    'rockscissorspaper': {
        description: 'A classic 2 player game',
        mechanics: ['Legacy'],
        glyph: GAME_ICONS.rockscissorspaper,
        enabled: false,
        rules: ['lobby', 'gameshell', 'rockscissorspaper'],
        rule: () => import('./rockscissorspaper/rockscissorspaper').then(m => m.RockScissorsPaperRule),
        icon: '✊',
        minPlayers: 2,
        maxPlayers: 2
    },
    'theoddone': {
        description: 'Guess the odd one',
        mechanics: ['Social Deduction', 'Legacy'],
        glyph: GAME_ICONS.theoddone,
        enabled: false,
        rules: ['lobby', 'gameshell', 'theoddone'],
        rule: () => import('./theoddone/theoddone').then(m => m.TheOddOneRule),
        icon: '🔍',
        minPlayers: 3,
        maxPlayers: 8
    },
    'coup': {
        description: 'Coup - Resistance',
        mechanics: ['Bluffing', 'Deduction', 'Take That', 'Legacy'],
        glyph: GAME_ICONS.coup,
        enabled: true,
        rules: ['lobby', 'gameshell', 'coup'],
        rule: () => import('./coup/coup').then(m => m.CoupRule),
        icon: '⚔️',
        minPlayers: 2,
        maxPlayers: 6
    },
    'avalon': {
        description: 'The Resistance - Avalon',
        mechanics: ['Bluffing', 'Team-Based', 'Legacy'],
        glyph: GAME_ICONS.avalon,
        enabled: true,
        rules: ['lobby', 'gameshell', 'avalon'],
        rule: () => import('./avalon/avalon').then(m => m.AvalonRule),
        icon: '👑',
        minPlayers: 5,
        maxPlayers: 10
    },
    'decrypto': {
        description: 'Decrypto',
        mechanics: ['Team-Based', 'Deduction', 'Word Game', 'Legacy'],
        glyph: GAME_ICONS.decrypto,
        enabled: true,
        rules: ['lobby', 'gameshell', 'decrypto'],
        rule: () => import('./decrypto/decrypto').then(m => m.DecryptoRule),
        icon: '🕵️',
        minPlayers: 4,
        maxPlayers: 4
    },
    'minesweeperflags': {
        description: 'Minesweeper Flags',
        mechanics: ['Deduction', 'Duel'],
        glyph: GAME_ICONS.minesweeperflags,
        enabled: true,
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
        mechanics: ['Abstract Strategy', 'Bluffing', 'Legacy'],
        glyph: GAME_ICONS.tictactoepoker,
        enabled: false,
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
        mechanics: ['Cooperative', 'Deduction'],
        glyph: GAME_ICONS.ito,
        enabled: true,
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
        mechanics: ['Drawing', 'Deduction'],
        glyph: GAME_ICONS.catchsketch,
        enabled: true,
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
        mechanics: ['Memory', 'Deduction', 'Bluffing'],
        glyph: GAME_ICONS.durian,
        enabled: true,
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
        mechanics: ['Set Collection', 'Push Your Luck'],
        glyph: GAME_ICONS.startups,
        enabled: true,
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
        mechanics: ['Dice', 'Roll & Write'],
        glyph: GAME_ICONS.clever,
        enabled: true,
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
        mechanics: ['Abstract Strategy', 'Duel'],
        glyph: GAME_ICONS.ttykm,
        enabled: true,
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
        mechanics: ['Card Shredding'],
        glyph: GAME_ICONS.maskmen,
        enabled: true,
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
        mechanics: ['Bluffing', 'Card Shredding'],
        glyph: GAME_ICONS.cockroach,
        enabled: true,
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
        mechanics: ['Set Collection', 'Duel'],
        glyph: GAME_ICONS.jaipur,
        enabled: true,
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
        mechanics: ['Engine Building', 'Set Collection', 'Duel'],
        glyph: GAME_ICONS.splendorduel,
        enabled: true,
        rules: ['lobby', 'gameshell', 'splendorduel'],
        rule: () => import('./splendorduel/splendorduel').then(m => m.SplendorDuelRule),
        icon: '💎',
        minPlayers: 2,
        maxPlayers: 2
    },
    'splendor': {
        description: 'Splendor - Renaissance Gem Engine Builder',
        mechanics: ['Engine Building', 'Set Collection'],
        glyph: GAME_ICONS.splendor,
        enabled: true,
        rules: ['lobby', 'gameshell', 'splendor'],
        rule: () => import('./splendor/splendor').then(m => m.SplendorRule),
        icon: '💠',
        minPlayers: 2,
        maxPlayers: 4
    },
    'splendor-debug': {
        description: 'Splendor (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'splendor', 'debugger'],
        rule: () => Promise.all([
            import('./debugger/debugger'),
            import('./splendor/splendor')
        ]).then(([dbg, orig]) => dbg.NewDebuggerRule('splendor', orig.SplendorRule, {
            HistoryBufferSize: 10,
            HistoryInSessionStorage: true
        })),
        icon: '💠',
        minPlayers: 2,
        maxPlayers: 4
    },
    'catinthebox': {
        description: 'Cat in the Box - Quantum Trick-Taking Game',
        mechanics: ['Trick-Taking', 'Deduction'],
        glyph: GAME_ICONS.catinthebox,
        enabled: true,
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
        mechanics: ['Memory', 'Set Collection', 'Deduction'],
        glyph: GAME_ICONS.trio,
        enabled: true,
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
        mechanics: ['Cooperative', 'Take That'],
        glyph: GAME_ICONS.regicide,
        enabled: true,
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
    'seasalt': {
        description: 'Sea Salt & Paper - Push-Your-Luck Set Collection',
        mechanics: ['Push Your Luck', 'Set Collection'],
        glyph: GAME_ICONS.seasalt,
        enabled: true,
        rules: ['lobby', 'gameshell', 'seasalt'],
        rule: () => import('./seasalt/seasalt').then(m => m.SeaSaltRule),
        icon: '🐚',
        minPlayers: 2,
        maxPlayers: 4
    },
    'seasalt-debug': {
        description: 'Sea Salt & Paper (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'seasalt', 'debugger'],
        rule: () => Promise.all([
            import('./debugger/debugger'),
            import('./seasalt/seasalt')
        ]).then(([dbg, orig]) => dbg.NewDebuggerRule('seasalt', orig.SeaSaltRule, {
            HistoryBufferSize: 10,
            HistoryInSessionStorage: true
        })),
        icon: '🐚',
        minPlayers: 2,
        maxPlayers: 4
    },
    'skull': {
        description: 'Skull - Bluffing & Bidding Game',
        mechanics: ['Bluffing', 'Deduction'],
        glyph: GAME_ICONS.skull,
        enabled: true,
        rules: ['lobby', 'gameshell', 'skull'],
        rule: () => import('./skull/skull').then(m => m.SkullRule),
        icon: '💀',
        minPlayers: 3,
        maxPlayers: 6
    },
    'courtisans': {
        description: 'Courtisans - Courtly Set Collection & Take-That',
        mechanics: ['Set Collection', 'Take That', 'Deduction'],
        glyph: GAME_ICONS.courtisans,
        enabled: true,
        rules: ['lobby', 'gameshell', 'courtisans'],
        rule: () => import('./courtisans/courtisans').then(m => m.CourtisansRule),
        icon: '🎭',
        minPlayers: 2,
        maxPlayers: 5
    },
    'courtisans-debug': {
        description: 'Courtisans (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'courtisans', 'debugger'],
        rule: () => Promise.all([
            import('./debugger/debugger'),
            import('./courtisans/courtisans')
        ]).then(([dbg, orig]) => dbg.NewDebuggerRule('courtisans', orig.CourtisansRule, {
            HistoryBufferSize: 10,
            HistoryInSessionStorage: true
        })),
        icon: '🎭',
        minPlayers: 2,
        maxPlayers: 5
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
    },
    'magicalathletes': {
        description: 'Magical Athletes - Push-Your-Luck Racing',
        mechanics: ['Push Your Luck', 'Racing', 'Dice'],
        glyph: GAME_ICONS.magicalathletes,
        enabled: true,
        rules: ['lobby', 'gameshell', 'magicalathletes'],
        rule: () => import('./magicalathletes/magicalathletes').then(m => m.MagicalAthletesRule),
        icon: '🏃',
        minPlayers: 2,
        maxPlayers: 6
    },
    'offwiththeirheads': {
        description: 'Off With Their Heads - Wonderland Roll-and-Write',
        mechanics: ['Roll & Write', 'Trick Taking'],
        glyph: GAME_ICONS.offwiththeirheads,
        enabled: true,
        rules: ['lobby', 'gameshell', 'offwiththeirheads'],
        rule: () => import('./offwiththeirheads/offwiththeirheads').then(m => m.OffWithTheirHeadsRule),
        icon: '👑',
        minPlayers: 2,
        maxPlayers: 4
    },
    'projectl': {
        description: 'Project L - Polyomino Puzzle Engine Builder',
        mechanics: ['Polyomino', 'Engine Building'],
        glyph: GAME_ICONS.projectl,
        enabled: true,
        rules: ['lobby', 'gameshell', 'projectl'],
        rule: () => import('./projectl/projectl').then(m => m.ProjectLRule),
        icon: '🧩',
        minPlayers: 1,
        maxPlayers: 6
    },
    'projectl-debug': {
        description: 'Project L (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'projectl', 'debugger'],
        rule: () => Promise.all([
            import('./debugger/debugger'),
            import('./projectl/projectl')
        ]).then(([dbg, orig]) => dbg.NewDebuggerRule('projectl', orig.ProjectLRule, {
            HistoryBufferSize: 10,
            HistoryInSessionStorage: true
        })),
        icon: '🧩',
        minPlayers: 1,
        maxPlayers: 6
    },
    'offwiththeirheads-debug': {
        description: 'Off With Their Heads (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'offwiththeirheads', 'debugger'],
        rule: () => Promise.all([
            import('./debugger/debugger'),
            import('./offwiththeirheads/offwiththeirheads')
        ]).then(([dbg, orig]) => dbg.NewDebuggerRule('offwiththeirheads', orig.OffWithTheirHeadsRule, {
            HistoryBufferSize: 10,
            HistoryInSessionStorage: true
        })),
        icon: '👑',
        minPlayers: 2,
        maxPlayers: 4
    },
    'magicalathletes-debug': {
        description: 'Magical Athletes (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'magicalathletes', 'debugger'],
        rule: () => Promise.all([
            import('./debugger/debugger'),
            import('./magicalathletes/magicalathletes')
        ]).then(([dbg, orig]) => dbg.NewDebuggerRule('magicalathletes', orig.MagicalAthletesRule, {
            HistoryBufferSize: 10,
            HistoryInSessionStorage: true
        })),
        icon: '🏃',
        minPlayers: 2,
        maxPlayers: 6
    },
    'moonrollers': {
        description: 'Moonrollers - Push-Your-Luck Dice & Crew Builder',
        mechanics: ['Push Your Luck', 'Dice', 'Set Collection'],
        glyph: GAME_ICONS.moonrollers,
        enabled: true,
        rules: ['lobby', 'gameshell', 'moonrollers'],
        rule: () => import('./moonrollers/moonrollers').then(m => m.MoonrollersRule),
        icon: '🎲',
        minPlayers: 2,
        maxPlayers: 5
    },
    'moonrollers-debug': {
        description: 'Moonrollers (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'moonrollers', 'debugger'],
        rule: () => Promise.all([
            import('./debugger/debugger'),
            import('./moonrollers/moonrollers')
        ]).then(([dbg, orig]) => dbg.NewDebuggerRule('moonrollers', orig.MoonrollersRule, {
            HistoryBufferSize: 10,
            HistoryInSessionStorage: true
        })),
        icon: '🎲',
        minPlayers: 2,
        maxPlayers: 5
    },
    'nightzoo': {
        description: 'Night at the Zoo - Tile-Drafting Routing Puzzle',
        mechanics: ['Tile Placement', 'Drafting', 'Puzzle'],
        glyph: GAME_ICONS.nightzoo,
        enabled: true,
        rules: ['lobby', 'gameshell', 'nightzoo'],
        rule: () => import('./nightzoo/nightzoo').then(m => m.NightZooRule),
        icon: '🐾',
        minPlayers: 1,
        maxPlayers: 4
    },
    'nightzoo-debug': {
        description: 'Night at the Zoo (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'nightzoo', 'debugger'],
        rule: () => Promise.all([
            import('./debugger/debugger'),
            import('./nightzoo/nightzoo')
        ]).then(([dbg, orig]) => dbg.NewDebuggerRule('nightzoo', orig.NightZooRule, {
            HistoryBufferSize: 10,
            HistoryInSessionStorage: true
        })),
        icon: '🐾',
        minPlayers: 1,
        maxPlayers: 4
    }
};

export default MPRULES;
