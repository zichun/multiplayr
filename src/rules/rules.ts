/**
 * rules.ts - define all the rules that the service knows about.
 * This should be deprecated and changed to a json config instead.
 */

declare var BiggerRule;
declare var Shell;
declare var RockScissorsPaperRule;
declare var TheOddOneRule;

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
        onLoad: () => {
            return RockScissorsPaperRule;
        }
    },
    'theoddone': {
        description: 'Guess the odd one',
        rules: ['lobby', 'gameshell', 'theoddone'],
        onLoad: () => {
            return TheOddOneRule;
        }
    }

};

export default MPRULES;
