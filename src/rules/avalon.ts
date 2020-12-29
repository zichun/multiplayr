import { NewDebuggerRule } from './debugger/debugger';
import { AvalonRule } from './avalon/avalon';

const AvalonDebugger = NewDebuggerRule(
    'avalon',
    AvalonRule,
    {
        HistoryBufferSize: 10,
        HistoryInSessionStorage: true
    });

export const MPRULES = {
    'avalon': {
        description: 'Avalon',
        rules: ['lobby', 'gameshell', 'avalon'],
        rule: AvalonRule
    },
    'avalon-debug': {
        description: 'Avalon (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'avalon', 'debugger'],
        rule: AvalonDebugger
    }
};

export default MPRULES;
