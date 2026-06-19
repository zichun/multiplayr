/**
 * maskmen.ts - Export Maskmen rule for webpack
 */

import { MaskmenRule } from './maskmen/maskmen';
import { NewDebuggerRule } from './debugger/debugger';

const MaskmenDebugger = NewDebuggerRule(
    'maskmen',
    MaskmenRule,
    {
        HistoryBufferSize: 10,
        HistoryInSessionStorage: true
    }
);

export const MPRULES = {
    'maskmen': {
        description: 'Maskmen - Dynamic Wrestler Hierarchy Card Game',
        rules: ['lobby', 'gameshell', 'maskmen'],
        rule: MaskmenRule
    },
    'maskmen-debug': {
        description: 'Maskmen (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'maskmen', 'debugger'],
        rule: MaskmenDebugger
    }
};

export default MPRULES;
