/**
 * rules.ts - define all the rules that the service knows about.
 * This should be deprecated and changed to a json config instead.
 */

import { RockScissorsPaperRule } from './rockscissorspaper/rockscissorspaper';
import { TheOddOneRule } from './theoddone/theoddone';
import { CoupRule } from './coup/coup';

export const MPRULES = {
    // 'bigger': {
    //     description: 'A luck-based game on who rolls the bigger value!',
    //     rules: ['lobby', 'gameshell', 'bigger'],
    //     onLoad: () => {
    //         return bigger;
    //     }
    // },
    'rockscissorspaper': {
        description: 'A classic 2 player game',
        rules: ['lobby', 'gameshell', 'rockscissorspaper'],
        rule: RockScissorsPaperRule
    },
    'theoddone': {
        description: 'Guess the odd one',
        rules: ['lobby', 'gameshell', 'theoddone'],
        rule: TheOddOneRule
    },
    'coup': {
        description: 'Coup - Resistance',
        rules: ['lobby', 'gameshell', 'coup'],
        rule: CoupRule
    }

};

export default MPRULES;