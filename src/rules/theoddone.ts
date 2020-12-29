import { NewDebuggerRule } from './debugger/debugger';
import { TheOddOneRule } from './theoddone/theoddone';

const TheOddOneDebugger = NewDebuggerRule(
    'theoddone',
    TheOddOneRule,
    {
        HistoryBufferSize: 10,
        HistoryInSessionStorage: true
    });

export const MPRULES = {
    'theoddone': {
        description: 'TheOddOne',
        rules: ['lobby', 'gameshell', 'theoddone'],
        rule: TheOddOneRule
    },
    'theoddone-debug': {
        description: 'TheOddOne (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'theoddone', 'debugger'],
        rule: TheOddOneDebugger
    }
};

export default MPRULES;
