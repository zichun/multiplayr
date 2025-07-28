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
        gameState: ItoGameState.Lobby,
        round: 0,
        lives: 0,
        category: '',
        playerNumbers: {},
        clues: {},
        cluesLocked: {},
        currentTurnPlayer: undefined,
        lockedPlayers: [],
        livesLostThisRound: 0
    },
    playerData: {
        secretNumber: 0,
        clue: '',
        hasLockedClue: false
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
        const round = mp.getData('round');
        const lives = mp.getData('lives');
        const category = mp.getData('category');
        const clues = mp.getData('clues');
        const cluesLocked = mp.getData('cluesLocked');
        const currentTurnPlayer = mp.getData('currentTurnPlayer');
        const lockedPlayers = mp.getData('lockedPlayers');
        const livesLostThisRound = mp.getData('livesLostThisRound');
        const playerNumbers = mp.getData('playerNumbers');

        // Get player names and client IDs
        const names = mp.getPlayersData('lobby_name');
        const clientIds = [];
        mp.playersForEach((clientId) => {
            clientIds.push(clientId);
        });

        // Set common props for all players
        mp.playersForEach((clientId) => {
            mp.setViewProps(clientId, 'gameState', gameState);
            mp.setViewProps(clientId, 'round', round);
            mp.setViewProps(clientId, 'lives', lives);
            mp.setViewProps(clientId, 'category', category);
            mp.setViewProps(clientId, 'clues', clues);
            mp.setViewProps(clientId, 'cluesLocked', cluesLocked);
            mp.setViewProps(clientId, 'currentTurnPlayer', currentTurnPlayer);
            mp.setViewProps(clientId, 'lockedPlayers', lockedPlayers);
            mp.setViewProps(clientId, 'livesLostThisRound', livesLostThisRound);
            mp.setViewProps(clientId, 'names', names);
            mp.setViewProps(clientId, 'clientIds', clientIds);
            
            // Set individual player data
            mp.setViewProps(clientId, 'secretNumber', mp.getPlayerData(clientId, 'secretNumber'));
            mp.setViewProps(clientId, 'clue', mp.getPlayerData(clientId, 'clue'));
            mp.setViewProps(clientId, 'hasLockedClue', mp.getPlayerData(clientId, 'hasLockedClue'));
        });

        // Set host-specific props (includes player numbers for scoring)
        mp.setViewProps(mp.hostId, 'playerNumbers', playerNumbers);

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