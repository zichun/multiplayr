/**
 * clever.ts - Export Clever rule for webpack
 */

import { CleverRule } from './clever/clever';
import { NewDebuggerRule } from './debugger/debugger';

const CleverDebugger = NewDebuggerRule(
    'clever',
    CleverRule,
    {
        HistoryBufferSize: 10,
        HistoryInSessionStorage: true
});

export const MPRULES = {
    'clever': {
        description: 'Clever - Dice Drafting Roll and Write',
        rules: ['lobby', 'gameshell', 'clever'],
        rule: CleverRule
    },
    'clever-debug': {
        description: 'Clever (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'clever', 'debugger'],
        rule: CleverDebugger
    }
};

export default MPRULES;
