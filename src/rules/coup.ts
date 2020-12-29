import { NewDebuggerRule } from './debugger/debugger';
import { CoupRule } from './coup/coup';

const CoupDebugger = NewDebuggerRule(
    'coup',
    CoupRule,
    {
        HistoryBufferSize: 10,
        HistoryInSessionStorage: true
    });

export const MPRULES = {
    'coup': {
        description: 'Coup',
        rules: ['lobby', 'gameshell', 'coup'],
        rule: CoupRule
    },
    'coup-debug': {
        description: 'Coup (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'coup', 'debugger'],
        rule: CoupDebugger
    }
};

export default MPRULES;
