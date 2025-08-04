/**
 * catchsketch.ts - Entry point for Catch Sketch game rule
 */

import { CatchSketchRule  } from './catchsketch/catchsketch';
import { NewDebuggerRule } from './debugger/debugger';

const CatchSketchDebugger = NewDebuggerRule(
    'catchsketch',
    CatchSketchRule,
    {
        HistoryBufferSize: 10,
        HistoryInSessionStorage: true
});

export const MPRULES = {
    'catchsketch': {
        description: 'CatchSketch - Speed Drawing Game',
        rules: ['lobby', 'gameshell', 'catchsketch', 'drawing'],
        rule: CatchSketchRule
    },
    'catchsketch-debug': {
        description: 'CatchSketch (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'catchsketch', 'drawing', 'debugger'],
        rule: CatchSketchDebugger
    }
};

export default MPRULES;
