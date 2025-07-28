/**
 * ito.ts - Export Ito rule for webpack
 */

import { ItoRule } from './ito/ito';

export const MPRULES = {
    'ito': {
        description: 'Ito - Cooperative Number Game',
        rules: ['lobby', 'gameshell', 'ito'],
        rule: ItoRule
    }
};

export default MPRULES;