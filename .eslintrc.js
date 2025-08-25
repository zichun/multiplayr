module.exports = {
    "plugins": [ "react", "@typescript-eslint" ],
    "extends": [
        "eslint:recommended",
        "plugin:react/recommended",
        "plugin:@typescript-eslint/eslint-recommended",
        "plugin:@typescript-eslint/recommended"
    ],
    "parser": "@typescript-eslint/parser",
    "rules": {
        "no-useless-escape": 0,
        "no-prototype-builtins": 0,
        "react/display-name": 0,
        "prefer-rest-params": 0,
        "prefer-spread": 0,
        "react/jsx-key": 0,
        "@typescript-eslint/no-unused-vars": 0,
        "@typescript-eslint/explicit-module-boundary-types": 0,
        "@typescript-eslint/no-explicit-any": 0,
        "@typescript-eslint/no-empty-interface": 0,
        "@typescript-eslint/no-empty-object-type": 0,
        "@typescript-eslint/ban-types": 0
    },
    "settings": {
        "react": {
            "version": "detect"
        }
    }
};
