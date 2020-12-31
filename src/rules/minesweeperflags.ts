import { NewDebuggerRule } from './debugger/debugger';
import { MinesweeperFlagsRule } from './minesweeperflags/minesweeperflags';

const MinesweeperFlagsDebugger = NewDebuggerRule(
    'minesweeperflags',
    MinesweeperFlagsRule,
    {
        HistoryBufferSize: 10,
        HistoryInSessionStorage: true
    });

export const MPRULES = {
    'minesweeperflags': {
        description: 'Minesweeperflags',
        rules: ['lobby','gameshell', 'minesweeperflags'],
        rule: MinesweeperFlagsRule
    },
    'minesweeperflags-debug': {
        description: 'Minesweeperflags (Debug)',
        debug: true,
        rules: ['lobby','gameshell', 'minesweeperflags', 'debugger'],
        rule: MinesweeperFlagsDebugger
    }
};

export default MPRULES;
