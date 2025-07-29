/**
 * ito.ts - Export Ito rule for webpack
 */

import { ItoRule } from './ito/ito';
import { NewDebuggerRule } from './debugger/debugger';

const ItoDebugger = NewDebuggerRule(
    'ito',
    ItoRule,
    {
        HistoryBufferSize: 10,
        HistoryInSessionStorage: true
});

export const MPRULES = {
    'ito': {
        description: 'Ito - Cooperative Number Game',
        rules: ['lobby', 'gameshell', 'ito'],
        rule: ItoRule
    },
    'ito-debug': {
        description: 'Ito (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'ito', 'debugger'],
        rule: ItoDebugger
    }
};

export default MPRULES;
