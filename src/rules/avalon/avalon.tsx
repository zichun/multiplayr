/**
 * Coup.tsx - Rule for The Resistance Avalon
 */

import * as React from 'react';
import Lobby from '../lobby/lobby';
import Shell from '../gameshell/gameshell';

import {
    GameRuleInterface,
    MPType,
    ViewPropsInterface
} from '../../common/interfaces';

import {
    AvalonGameState,
    AvalonCharacter
} from './AvalonTypes';

export const AvalonRule: GameRuleInterface = {
    name: 'avalon',
    css: [],
    plugins: {
        'lobby': Lobby,
        'gameshell': Shell
    },

    globalData: {
        state: null,
        quests: [],
        currentQuest: 0,
    },

    playerData: {
        character: null
    },

    onDataChange: (mp: MPType) => {
        return true;
    },

    methods: {},
    views: {}
};

export default AvalonRule;
