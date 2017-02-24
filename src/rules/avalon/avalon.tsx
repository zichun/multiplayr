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
    AvalonStartGame,
    AvalonNewGame
} from './AvalonMethods';

import {
    AvalonHostLobby,
    AvalonHostMainPage,
    AvalonClientChooseQuestMembers,
    AvalonClientWaitChooseQuestMembers
} from './AvalonViews';

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
        const started = mp.getData('lobby_started');

        const showLobby = () => {
            mp.setView(mp.clientId, 'host-lobby');

            mp.playersForEach((clientId) => {
                mp.setView(clientId, 'lobby_SetName');
            });

            return true;
        }

        if (!started) {
            return showLobby();
        }

        return true;
    },

    methods: {
        'startGame': AvalonStartGame,
        'newGame': AvalonNewGame
    },

    views: {
        'host-lobby': AvalonHostLobby,
        'host-mainpage': AvalonHostMainPage,
        'client-choosequestmembers': AvalonClientChooseQuestMembers,
        'client-waitchoosequestmembers': AvalonClientWaitChooseQuestMembers
    }
};

export default AvalonRule;
