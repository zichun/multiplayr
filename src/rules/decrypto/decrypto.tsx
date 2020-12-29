import * as React from 'react';
import Lobby from '../lobby/lobby';
import Shell from '../gameshell/gameshell';
import './decrypto.scss';

import {
    GameRuleInterface,
    MPType
} from '../../common/interfaces';

import { DecryptoGameState } from './DecryptoCommon';

import {
    DecryptoClientLobby,
    DecryptoHostLobby,
    DecryptoHostMainPage,
    DecyptoClientMainPage
} from './views/DecryptoViews';

import {
    DecryptoStartGame,
    DecryptoNewGame,
    DecryptoSubmitClue,
    DecryptoSubmitGuess
} from './DecryptoMethods';

export const DecryptoRule: GameRuleInterface = {
    name: 'decrypto',
    plugins: {
        'lobby': Lobby,
        'gameshell': Shell
    },
    globalData: {
        gameState: DecryptoGameState.InputClues,
        round: 0,    // Current round, starting from 0
        teams: [],   // Mapping of teams to clientIds
        words: [],   // Array of wordlist
        clueTurn: 0, // Which of the player is writing the clue,
        clueSet: [], // List of triplets to give clues for
        clues: [],   // Clues given for current round
        guesses: [], // Current guesses
        miscommunication: [], // Number of miscommunications
        interception: [],    // Number of interceptions
        history: [],
        notifications: []    // Notifications for each team
    },
    playerData: {
        words: [],
        team: 0
    },

    onDataChange: (mp: MPType) => {
        const started = mp.getData('lobby_started');

        const showLobby = () => {
            mp.setView(mp.clientId, 'host-lobby');
            mp.playersForEach((clientId) => {
                mp.setView(clientId, 'client-lobby');
            });
            return true;
        };

        if (!started) {
            return showLobby();
        }

        const state = mp.getData('gameState');
        mp.playersForEach((clientId, index) => {
            console.log(mp.getData('miscommunication'));
            mp.setViewProps(clientId, 'gameState', state);
            mp.setViewProps(clientId, 'words', mp.getPlayerData(clientId, 'words'));
            mp.setViewProps(clientId, 'team', mp.getPlayerData(clientId, 'team'));
            mp.setViewProps(clientId, 'history', mp.getData('history'));
            mp.setViewProps(clientId, 'interception', mp.getData('interception'));
            mp.setViewProps(clientId, 'miscommunication', mp.getData('miscommunication'));
            mp.setViewProps(clientId, 'round', mp.getData('round'));
            mp.setViewProps(clientId, 'guesses', mp.getData('guesses'));
        });

        const teams = mp.getData('teams');
        const clueTurn = mp.getData('clueTurn');
        const clues = mp.getData('clues');
        const clueSet = mp.getData('clueSet');
        const notifications = mp.getData('notifications');

        mp.setViewProps(mp.clientId, 'history', mp.getData('history'));

        for (let i = 0; i < teams.length; ++i) {
            for (let j = 0; j < teams[i].length; ++j) {
                mp.setViewProps(teams[i][j], 'guessing', j !== clueTurn);
                mp.setViewProps(teams[i][j], 'clues', clues);
                mp.setViewProps(teams[i][j], 'notifications', notifications[i]);

                if (j === clueTurn && clues[i].length === 0) {
                    mp.setViewProps(teams[i][j], 'clueSet', clueSet[i]);
                } else {
                    mp.setViewProps(teams[i][j], 'clueSet', []);
                }
            }
        }

        mp.setView(mp.hostId, 'host-mainpage');
        mp.playersForEach((clientId) => {
            mp.setView(clientId, 'client-mainpage');
        });

        return true;
    },

    methods: {
        'startGame': DecryptoStartGame,
        'newGame': DecryptoNewGame,
        'submitClue': DecryptoSubmitClue,
        'submitGuess': DecryptoSubmitGuess
    },

    views: {
        'host-lobby': DecryptoHostLobby,
        'client-lobby': DecryptoClientLobby,
        'host-mainpage': DecryptoHostMainPage,
        'client-mainpage': DecyptoClientMainPage
    }
};

export default DecryptoRule;
