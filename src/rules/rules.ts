/**
 * rules.ts - define all the rules that the service knows about.
 * This should be deprecated and changed to a json config instead.
 */

const MPRULES = {
    'bigger': {
        description: 'A luck-based game on who rolls the bigger value!',
        rules: ['lobby', 'bigger', 'gameshell'],
        onLoad: () => {
            Shell.plugins.child = BiggerRule;
            return Shell;
        }
    },
    'rockscissorspaper': {
        description: 'A classic 2 player game',
        rules: ['lobby', 'rockscissorspaper', 'gameshell'],
        onLoad: () => {
            Shell.plugins.child = RockScissorsPaperRule;
            return Shell;
        }
    },
    'theoddone': {
        description: 'Guess the odd one',
        rules: ['lobby', 'gameshell', 'theoddone'],
        onLoad: () => {
            return TheOddOneRule;
//            Shell.plugins['child'] = TheOddOneRule;
//            return Shell;
        }
    }

};

if (typeof module === 'object' && module.exports) {
    module.exports = MPRULES;
}
