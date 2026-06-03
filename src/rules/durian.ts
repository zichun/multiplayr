/**
 * durian.ts - Export Durian rule for webpack
 */

import { DurianRule } from './durian/durian';
import { NewDebuggerRule } from './debugger/debugger';

const DurianDebugger = NewDebuggerRule(
    'durian',
    DurianRule,
    {
        HistoryBufferSize: 10,
        HistoryInSessionStorage: true
});

export const MPRULES = {
    'durian': {
        description: 'Durian - Shopkeeper & Inventory Crisis Game',
        rules: ['lobby', 'gameshell', 'durian'],
        rule: DurianRule
    },
    'durian-debug': {
        description: 'Durian (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'durian', 'debugger'],
        rule: DurianDebugger
    }
};

export default MPRULES;
