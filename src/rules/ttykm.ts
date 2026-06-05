/**
 * ttykm.ts - Export TTYKM rule for webpack
 */

import { TTYKMRule } from './ttykm/ttykm';
import { NewDebuggerRule } from './debugger/debugger';

const TTYKMDebugger = NewDebuggerRule(
    'ttykm',
    TTYKMRule,
    {
        HistoryBufferSize: 10,
        HistoryInSessionStorage: true
});

export const MPRULES = {
    'ttykm': {
        description: 'That Time You Killed Me - Abstract Time Travel Strategy',
        rules: ['gameshell', 'ttykm'],
        rule: TTYKMRule
    },
    'ttykm-debug': {
        description: 'That Time You Killed Me (Debug)',
        debug: true,
        rules: ['gameshell', 'ttykm', 'debugger'],
        rule: TTYKMDebugger
    }
};

export default MPRULES;
