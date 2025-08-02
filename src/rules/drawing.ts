/**
 * drawing.ts - Export Drawing rule for webpack
 */

import DrawingRule from './drawing/drawing';
import { NewDebuggerRule } from './debugger/debugger';

const DrawingDebugger = NewDebuggerRule(
    'drawing',
    DrawingRule,
    {
        HistoryBufferSize: 10,
        HistoryInSessionStorage: true
});

export const MPRULES = {
    'drawing': {
        description: 'Drawing Canvas - Collaborative Drawing Tool',
        rules: ['drawing'],
        rule: DrawingRule
    },
    'drawing-debug': {
        description: 'Drawing Canvas (Debug)',
        debug: true,
        rules: ['drawing', 'debugger'],
        rule: DrawingDebugger
    }
};

export default MPRULES;