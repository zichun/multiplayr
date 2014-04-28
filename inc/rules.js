var _MPRules = {
    'bigger': {
        description: "A luck-based game on who rolls the bigger value!",
        rules: ['lobby', 'bigger', 'gameshell'],
        onLoad: function() {
            Shell.plugins['child'] = BiggerRule;
            return Shell;
        }
    },
    'rockscissorspaper': {
        description: "A classic 2 player game",
        rules: ['lobby', 'rockscissorspaper', 'gameshell'],
        onLoad: function() {
            Shell.plugins['child'] = RockScissorsPaperRule;
            return Shell;
        }
    }
};


if (typeof module === 'object' && module.exports) module.exports = _MPRules;