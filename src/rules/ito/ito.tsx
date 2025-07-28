/**
 * ito.tsx - Main Ito game rule definition
 */

import Lobby from '../lobby/lobby';
import Shell from '../gameshell/gameshell';
import './ito.scss';

import {
    GameRuleInterface,
    MPType
} from '../../common/interfaces';

import { ItoGameState } from './ItoTypes';

import {
    ItoHostLobby,
    ItoClientLobby,
    ItoHostMainPage,
    ItoClientMainPage
} from './views/ItoViews';

import {
    ItoStartGame,
    ItoSubmitClue,
    ItoLockClue,
    ItoNextRound,
    ItoRestartGame
} from './ItoMethods';

export const ItoRule: GameRuleInterface = {
    name: 'ito',
    plugins: {
        'lobby': Lobby,
        'gameshell': Shell
    },
    globalData: {
        gameState: null,
    },
    playerData: {
    },
    onDataChange: (mp: MPType) => {
        const started = mp.getData('lobby_started');

        const showLobby = () => {
            mp.setView(mp.hostId, 'host-lobby');
            mp.playersForEach((clientId) => {
                mp.setView(clientId, 'client-lobby');
            });
            return true;
        };

        if (!started) {
            return showLobby();
        }

        // Game has started, set up main game views
        const gameState = mp.getData('gameState');

        // Get player names and client IDs
        const names = mp.getPlayersData('lobby_name');
        const clientIds = [];
        mp.playersForEach((clientId) => {
            clientIds.push(clientId);
        });

        // Set common props for all players
        mp.playersForEach((clientId) => {
            // Set individual player data
            mp.setViewProps(clientId, 'secretNumber', mp.getPlayerData(clientId, gameState.get_player_number(clientId)));
            mp.setViewProps(clientId, 'category', mp.getPlayerData(clientId, gameState.get_category()));
            mp.setViewProps(clientId, 'hasLockedClue', mp.getPlayerData(clientId, 'hasLockedClue'));
        });

        // Set views
        mp.setView(mp.hostId, 'host-mainpage');
        mp.playersForEach((clientId) => {
            mp.setView(clientId, 'client-mainpage');
        });

        return true;
    },

    methods: {
        'startGame': ItoStartGame,
        'submitClue': ItoSubmitClue,
        'lockClue': ItoLockClue,
        'nextRound': ItoNextRound,
        'restartGame': ItoRestartGame
    },

    views: {
        'host-lobby': ItoHostLobby,
        'client-lobby': ItoClientLobby,
        'host-mainpage': ItoHostMainPage,
        'client-mainpage': ItoClientMainPage
    }
};

export default ItoRule;
