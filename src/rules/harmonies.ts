/**
 * harmonies.ts - Export Harmonies rule for webpack
 */

import { HarmoniesRule } from './harmonies/harmonies';
import { NewDebuggerRule } from './debugger/debugger';

const HarmoniesDebugger = NewDebuggerRule(
    'harmonies',
    HarmoniesRule,
    {
        HistoryBufferSize: 10,
        HistoryInSessionStorage: true
});

export const MPRULES = {
    'harmonies': {
        description: 'Harmonies - Nature Habitat Builder',
        rules: ['lobby', 'gameshell', 'harmonies'],
        rule: HarmoniesRule
    },
    'harmonies-debug': {
        description: 'Harmonies (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'harmonies', 'debugger'],
        rule: HarmoniesDebugger
    }
};

export default MPRULES;
