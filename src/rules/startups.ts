/**
 * startups.ts - Export Startups rule for webpack
 */

import { StartupsRule } from './startups/startups';
import { NewDebuggerRule } from './debugger/debugger';

const StartupsDebugger = NewDebuggerRule(
    'startups',
    StartupsRule,
    {
        HistoryBufferSize: 10,
        HistoryInSessionStorage: true
});

export const MPRULES = {
    'startups': {
        description: 'Startups - Competitive Investment Card Game',
        rules: ['lobby', 'gameshell', 'startups'],
        rule: StartupsRule
    },
    'startups-debug': {
        description: 'Startups (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'startups', 'debugger'],
        rule: StartupsDebugger
    }
};

export default MPRULES;
