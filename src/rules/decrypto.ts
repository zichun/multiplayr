import { NewDebuggerRule } from './debugger/debugger';
import { DecryptoRule } from './decrypto/decrypto';

const DecryptoDebugger = NewDebuggerRule(
    'decrypto',
    DecryptoRule,
    {
        HistoryBufferSize: 10,
        HistoryInSessionStorage: true
    });

export const MPRULES = {
    'decrypto': {
        description: 'Decrypto',
        rules: ['lobby', 'gameshell', 'decrypto'],
        rule: DecryptoRule
    },
    'decrypto-debug': {
        description: 'Decrypto (Debug)',
        debug: true,
        rules: ['lobby', 'gameshell', 'decrypto', 'debugger'],
        rule: DecryptoDebugger
    }
};

export default MPRULES;
