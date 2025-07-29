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

import {
    ItoHostLobby,
    ItoClientLobby,
    ItoMainPage,
} from './views/ItoViews';

import {
    ItoStartGame,
    ItoSubmitClue,
    ItoLockClue,
    ItoNextRound,
    ItoRestartGame
} from './ItoMethods';

import { ItoGameState } from './ItoGameState';

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
        let gameState = mp.getData('gameState');
        if (!gameState.get_player_data) {
            gameState = ItoGameState.from_data(gameState.data, gameState.playerIds);
            mp.setData('gameState', gameState);
        }

        function setViewProps(mp: MPType, clientId: string) {
            const player_data = gameState.get_player_data(clientId);

            // Set individual player data
            mp.setViewProps(clientId, 'clues', gameState.get_clues());
            mp.setViewProps(clientId, 'gameStatus', gameState.get_status());
            mp.setViewProps(clientId, 'category', gameState.get_category());
            mp.setViewProps(clientId, 'round', gameState.get_round());
            mp.setViewProps(clientId, 'lives', gameState.get_lives());
            mp.setViewProps(clientId, 'locked', gameState.get_locked_data());
            if (player_data) { // temp hack
                mp.setViewProps(clientId, 'clue', player_data.clue);
                mp.setViewProps(clientId, 'secretNumber', player_data.secretNumber);
                mp.setViewProps(clientId, 'hasLockedClue', player_data.hasLockedClue);
            }
        }

        // Set common props for all players
        mp.playersForEach((clientId) => {
            setViewProps(mp, clientId);
        });
        setViewProps(mp, mp.hostId);

        // Set views
        mp.setView(mp.hostId, 'mainpage');
        mp.playersForEach((clientId) => {
            mp.setView(clientId, 'mainpage');
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
        'mainpage': ItoMainPage,
    }
};

export default ItoRule;
