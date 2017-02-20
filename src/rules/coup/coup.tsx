/**
 * Coup.tsx - Rule for Coup game
 */

import * as React from 'react';
import './coup.scss';

import Lobby from '../lobby/lobby';
import Shell from '../gameshell/gameshell';

import {
    ChoiceList,
    Choice
} from '../../client/components/ChoiceList';

import {
    GameRuleInterface,
    MPType,
    ViewPropsInterface
} from '../../common/interfaces';

import {
    addActions,
    hasCard
} from './CoupFunctions';

import {
    shuffle,
    forEach
} from '../../common/utils';

import {
    CoupGameState,
    CoupAction,
    CoupReaction,
    CoupCard,
    CoupCardState,
    CoupWaitContext,
    CoupActionInterface,
    CoupViewPropsInterface,
} from './CoupTypes';

import {
    CoupStartGame,
    CoupNewGame,
    CoupTakeAction,
    CoupTakeReaction,
    CoupRevealCard,
    CoupAmbassadorAction,
    CoupEndChallengePhase
} from './methods/CoupMethods';

import {
    CoupHostLobby,

    // CoupPlayAction
    CoupClientPlayAction,
    CoupHostPlayAction,

    // CoupPlayReaction
    CoupClientPlayReaction,
    CoupHostPlayReaction,

    // CoupWait
    CoupClientWaitForAction,

    // CoupChallengeReaction
    CoupClientChallengeReaction,
    CoupClientLoseInfluence,

    // CoupAmabassador
    CoupAmbassadorCardChange,

    // CoupWinLose
    CoupClientDead,
    CoupClientShowWinner,
    CoupHostShowWinner
} from './views/CoupViews';

export const CoupRule: GameRuleInterface = {

    name: 'coup',
    css: ['coup.css'],

    plugins: {
        'lobby': Lobby,
        'gameshell': Shell
    },

    globalData: {
        gameState: CoupGameState.PlayAction,
        playerTurn: -1,
        lastAction: {
            player: -1,
            action: CoupAction.Duke,
            challenge: -1,
            block: -1,
        },
        actions: [],
        deck: []
    },

    playerData: {
        coins: 0,
        cards: [],
        isDead: false
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

        //
        // Push props down to clients
        //

        const playersData = mp.getPlayersData(['coins', 'cards']);
        const playerTurn = mp.getData('playerTurn');
        let playerTurnId = null;
        const actions = mp.getData('actions');
        const alivePlayers = [];

        mp.setViewProps(mp.hostId, 'actions', actions);
        mp.setViewProps(mp.hostId, 'playerTurn', playerTurn);

        mp.playersForEach((clientId, index) => {
            if (index === playerTurn) {
                playerTurnId = clientId;
            }
            if (!mp.getPlayerData(clientId, 'isDead')) {
                alivePlayers.push(clientId);
            }
        });

        mp.setViewProps(mp.hostId, 'playerTurnId', playerTurnId);

        mp.playersForEach(
            (clientId, index) => {
                mp.setViewProps(clientId, 'coins', playersData[index].coins);
                mp.setViewProps(clientId, 'cards', playersData[index].cards);
                mp.setViewProps(clientId, 'actions', actions);
                mp.setViewProps(clientId, 'playerTurn', playerTurn);
                mp.setViewProps(clientId, 'playerTurnId', playerTurnId);
                mp.setViewProps(clientId, 'alivePlayers', alivePlayers);
                mp.setViewProps(clientId, 'waitAdditionalText', null);

                const playersCards = {};
                const playersCoins = {};

                mp.playersForEach(
                    (otherClientId, otherIndex) => {
                        if (index === otherIndex) {
                            return;
                        }

                        playersCards[otherClientId] = [];
                        playersCoins[otherClientId] = playersData[otherIndex].coins;

                        for (let i = 0; i < 2; i = i + 1) {
                            if (playersData[otherIndex].cards[i].state === CoupCardState.Active) {
                                playersCards[otherClientId].push({
                                    card: CoupCard.Unknown,
                                    state: CoupCardState.Active
                                });
                            } else {
                                playersCards[otherClientId].push(playersData[otherIndex].cards[i]);
                            }
                        }
                    });

                mp.setViewProps(clientId, 'playersCards', playersCards);
                mp.setViewProps(clientId, 'playersCoins', playersCoins);
            });

        //
        // Render views based on game state.
        //

        switch (mp.getData('gameState')) {

            case CoupGameState.PlayAction:

                mp.setViewProps(mp.hostId, 'waitForId', playerTurnId);
                mp.setView(mp.hostId, 'host-playaction');

                mp.playersForEach((clientId, index) => {
                    if (index === playerTurn) {
                        mp.setView(clientId, 'client-playaction');
                    } else {
                        mp.setViewProps(clientId, 'waitForId', playerTurnId);
                        mp.setViewProps(clientId, 'waitContext', CoupWaitContext.PlayAction);
                        mp.setView(clientId, 'client-waitforaction');
                    }
                });

                break;

            case CoupGameState.PlayReaction: {
                const lastAction = actions[actions.length - 1];

                mp.setView(mp.hostId, 'host-playreaction');

                if (!lastAction.block) {
                    mp.playersForEach((clientId, index) => {
                        if (index === playerTurn) {
                            mp.setViewProps(clientId, 'waitContext', CoupWaitContext.ChallengeOrBlock);
                            mp.setView(clientId, 'client-waitforaction');
                        } else {
                            mp.setView(clientId, 'client-playreaction');
                        }
                    });
                } else {
                    mp.playersForEach((clientId, index) => {
                        if (clientId === lastAction.block) {
                            mp.setViewProps(clientId, 'waitContext', CoupWaitContext.ChallengeOrBlock);
                            mp.setView(clientId, 'client-waitforaction');
                        } else {
                            mp.setView(clientId, 'client-playreaction');
                        }
                    });
                }

                break;
            }

            case CoupGameState.ChallengeReaction: {
                const lastAction = actions[actions.length - 1];
                const challenge = lastAction.challenge;
                let challengee = null;
                if (lastAction.block) {
                    challengee = lastAction.block;
                } else {
                    challengee = lastAction.clientId;
                }

                mp.setViewProps(mp.hostId, 'waitForId', challengee);
                mp.setView(mp.hostId, 'host-playaction');
                mp.playersForEach((clientId, index) => {
                    if (clientId === challengee) {
                        mp.setView(clientId, 'client-challengereaction');
                    } else {
                        mp.setViewProps(clientId, 'waitForId', challengee);
                        mp.setViewProps(clientId, 'waitContext', CoupWaitContext.ChallengeReaction);
                        mp.setView(clientId, 'client-waitforaction');
                    }
                });
                break;
            }

            case CoupGameState.ChallengeResult: {
                const lastAction = actions[actions.length - 1];
                const challengeLoser = lastAction.challengeLoser;
                const challengeWinner = lastAction.challengeWinner;

                mp.setViewProps(mp.hostId, 'waitForId', challengeLoser);
                mp.setView(mp.hostId, 'host-playaction');
                mp.playersForEach((clientId, index) => {
                    if (clientId === challengeLoser) {
                        mp.setView(clientId, 'client-chooseloseinfluence');
                    } else if (clientId === challengeWinner) {
                        mp.setViewProps(clientId, 'waitForId', challengeLoser);
                        mp.setViewProps(clientId, 'waitAdditionalText', 'Your challenged card has been replaced! ');
                        mp.setViewProps(clientId, 'waitContext', CoupWaitContext.ChallengeFail);
                        mp.setView(clientId, 'client-waitforaction');
                    } else {
                        mp.setViewProps(clientId, 'waitForId', challengeLoser);
                        mp.setViewProps(clientId, 'waitContext', CoupWaitContext.ChallengeFail);
                        mp.setView(clientId, 'client-waitforaction');
                    }
                });
                break;
            }

            case CoupGameState.AmbassadorCardChange: {
                const lastAction = actions[actions.length - 1];
                const deck = mp.getData('deck');
                const drawCards = [deck[0], deck[1]];

                mp.setView(mp.hostId, 'host-playaction');
                mp.playersForEach((clientId, index) => {
                    if (clientId === lastAction.clientId) {
                        mp.setViewProps(clientId, 'drawCards', drawCards);
                        mp.setView(clientId, 'client-ambassadorcardchange');
                    } else {
                        mp.setViewProps(clientId, 'waitForId', lastAction.clientId);
                        mp.setViewProps(clientId, 'waitContext', CoupWaitContext.AmbassadorChooseCard);
                        mp.setView(clientId, 'client-waitforaction');
                    }
                });

                break;
            }

            case CoupGameState.GameOver:
                let aliveCount = 0;
                let winnerId = null;

                mp.playersForEach(
                    (clientId, index) => {
                        if (!mp.getPlayerData(clientId, 'isDead')) {
                            aliveCount++;
                            winnerId = clientId;
                        }
                    });

                if (aliveCount !== 1) {
                    throw (new Error('Game should not be over with non-1 alive players'));
                }

                mp.playersForEach(
                    (clientId, index) => {
                        mp.setViewProps(clientId, 'winner', winnerId);
                        mp.setView(clientId, 'client-showWinner');
                    });

                mp.setViewProps(mp.hostId, 'winner', winnerId);
                mp.setView(mp.hostId, 'host-showWinner');

                break;
        }

        mp.playersForEach((clientId, index) => {
            if (mp.getPlayerData(clientId, 'isDead')) {
                mp.setView(clientId, 'client-dead');
            }
        });

        return true;
    },

    methods: {
        'startGame': CoupStartGame,
        'newGame': CoupNewGame,
        'takeAction': CoupTakeAction,
        'takeReaction': CoupTakeReaction,
        'revealCard': CoupRevealCard,
        'ambassadorAction': CoupAmbassadorAction,
        'endChallengePhase': CoupEndChallengePhase
    },

    views: {
        'host-lobby': CoupHostLobby,
        'client-playaction': CoupClientPlayAction,
        'client-waitforaction': CoupClientWaitForAction,
        'host-playaction': CoupHostPlayAction,
        'host-playreaction': CoupHostPlayReaction,
        'client-playreaction': CoupClientPlayReaction,
        'client-challengereaction': CoupClientChallengeReaction,
        'client-chooseloseinfluence': CoupClientLoseInfluence,
        'client-ambassadorcardchange': CoupAmbassadorCardChange,
        'client-dead': CoupClientDead,
        'client-showWinner': CoupClientShowWinner,
        'host-showWinner': CoupHostShowWinner
    }
};

export default CoupRule;
