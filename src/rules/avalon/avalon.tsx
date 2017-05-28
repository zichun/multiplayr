/**
 * Avalon.tsx - Rule for The Resistance Avalon
 */

import * as React from 'react';
import './avalon.scss';
import Lobby from '../lobby/lobby';
import Shell from '../gameshell/gameshell';

import {
    GameRuleInterface,
    MPType,
    ViewPropsInterface
} from '../../common/interfaces';

import {
    contains
} from '../../common/utils';

import {
    AvalonStartGame,
    AvalonNewGame,
    AvalonUpdateQuestMembers,
    AvalonCommitTeam,
    AvalonCommitTeamVote,
    AvalonCommitQuestVote,
    AvalonChooseMerlin
} from './AvalonMethods';

import {
    AvalonHostLobby,
    AvalonHostMainPage,
    AvalonClientChooseQuestMembers,
    AvalonClientVote,
    AvalonWait
} from './AvalonViews';

import {
    AvalonQuestMembers,
    IsMinion
} from './AvalonUtils';

import {
    AvalonGameState,
    AvalonCharacter,
    AvalonGameOutcome
} from './AvalonTypes';

export const AvalonRule: GameRuleInterface = {
    name: 'avalon',
    css: [],

    plugins: {
        'lobby': Lobby,
        'gameshell': Shell
    },

    globalData: {
        'state': false,
        'quests': [],
        'currentQuest': 0,
        'currentLeader': 0,
        'currentTeam': [],
        'gameOutcome': null
    },

    playerData: {
        'character': false,
        'voteQuestMembers': null,
        'voteQuest': null
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

        const currentLeader = mp.getData('currentLeader');
        const currentQuest = mp.getData('currentQuest');
        const currentTeam = mp.getData('currentTeam');
        const requiredMembers = AvalonQuestMembers[mp.playersCount()][currentQuest];
        const quests = mp.getData('quests');

        mp.setViewProps(mp.hostId, 'leader', currentLeader);
        mp.setViewProps(mp.hostId, 'currentQuest', currentQuest);
        mp.setViewProps(mp.hostId, 'requiredMembers', requiredMembers);
        mp.setViewProps(mp.hostId, 'currentTeam', currentTeam);
        mp.setViewProps(mp.hostId, 'quests', quests);

        mp.playersForEach((clientId, index) => {
            mp.setViewProps(clientId, 'leader', currentLeader);
            mp.setViewProps(clientId, 'currentQuest', currentQuest);
            mp.setViewProps(clientId, 'requiredMembers', requiredMembers);
            mp.setViewProps(clientId, 'quests', quests);

            const character = mp.getPlayerData(clientId, 'character');
            mp.setViewProps(clientId, 'character', character);

            if (character === AvalonCharacter.Merlin || character === AvalonCharacter.Minion) {
                let minions = [];
                mp.playersForEach((clientId, index) => {
                    if (mp.getPlayerData(clientId, 'character') === AvalonCharacter.Minion) {
                        minions.push(index);
                    }
                });

                mp.setViewProps(clientId, 'minions', minions);
            }
        });

        switch(mp.getData('state'))
        {
            case AvalonGameState.ChooseQuestMembers:
            {
                mp.setViewProps(mp.hostId, 'status', 'Choose Team');
                mp.setViewProps(mp.hostId, 'notification', true);
                mp.setView(mp.hostId, 'host-mainpage');
                mp.playersForEach((clientId, index) => {
                    if (index === currentLeader) {
                        mp.setView(clientId, 'client-choosequestmembers');
                    } else {
                        mp.setViewProps(clientId, 'status', 'Waiting for quest members to be chosen');
                        mp.setView(clientId, 'client-wait');
                    }
                });
                break;
            }

            case AvalonGameState.VoteQuestMembers:
            {
                const playersVote = mp.getPlayersData('voteQuestMembers');
                let voted = 0;

                for (let i = 0; i < mp.playersCount(); i = i + 1) {
                    if (playersVote[i] !== null) {
                        voted = voted + 1;
                    }
                }

                const voteCount = '(' + voted + '/' + mp.playersCount()  + ')';

                mp.setViewProps(mp.hostId, 'playersVote', playersVote);
                mp.setViewProps(mp.hostId, 'status', 'Waiting for team mandate ' + voteCount);
                mp.setViewProps(mp.hostId, 'notification', false);
                mp.setView(mp.hostId, 'host-mainpage');
                mp.playersForEach((clientId, index) => {
                    if (playersVote[index] === null) {
                        mp.setViewProps(clientId, 'voteType', 'team');
                        mp.setView(clientId, 'client-vote');
                    } else {
                        mp.setViewProps(clientId, 'status', 'Waiting for team mandate');
                        mp.setView(clientId, 'client-wait');
                    }
                });
                break;
            }

            case AvalonGameState.VoteQuest:
            {
                const playersVote = mp.getPlayersData('voteQuest');
                let voted = 0;

                for (let i = 0; i < mp.playersCount(); i = i + 1) {
                    if (playersVote[i] !== null) {
                        voted = voted + 1;
                    }
                }

                const voteCount = '(' + voted + '/' + requiredMembers  + ')';

                mp.setViewProps(mp.hostId, 'playersVote', playersVote);
                mp.setViewProps(mp.hostId, 'status', 'Waiting for quest outcome ' + voteCount);
                mp.setViewProps(mp.hostId, 'notification', false);
                mp.setView(mp.hostId, 'host-mainpage');

                mp.playersForEach((clientId, index) => {
                    if (playersVote[index] === null && contains(currentTeam, index.toString())) {
                        mp.setViewProps(clientId, 'voteType', 'quest');
                        mp.setView(clientId, 'client-vote');
                    } else {
                        mp.setViewProps(clientId, 'status', 'Waiting for quest outcome');
                        mp.setView(clientId, 'client-wait');
                    }
                });
                break;
            }

            case AvalonGameState.ChooseMerlin:
            {
                mp.setViewProps(mp.hostId, 'status', 'Minion of Mondred will attempt to identify Merlin');
                mp.setViewProps(mp.hostId, 'notification', true);
                mp.setView(mp.hostId, 'host-mainpage');

                let foundMinion = false;
                mp.playersForEach((clientId, index) => {
                    if (foundMinion === false && IsMinion(mp, clientId)) {
                        foundMinion = true;
                        mp.setViewProps(clientId, 'chooseMerlin', true);
                        mp.setView(clientId, 'client-choosequestmembers');
                    } else {
                        mp.setViewProps(clientId, 'status', 'Waiting for Merlin to be identified');
                        mp.setView(clientId, 'client-wait');
                    }
                });
                break;
            }

            case AvalonGameState.GameOver:
            {
                let outcome = '';
                if (mp.getData('gameOutcome') === AvalonGameOutcome.MerlinFound) {
                    outcome = 'Minions of Mondred won by identifying Merlin!';
                } else if (mp.getData('gameOutcome') === AvalonGameOutcome.ArthurWin) {
                    outcome = 'Loyal Servant of Arthur won!';
                } else if (mp.getData('gameOutcome') === AvalonGameOutcome.MinionWin) {
                    outcome = 'Minions of Mondred won!';
                }

                mp.setViewProps(mp.hostId, 'status', 'Game Over! ' + outcome);
                mp.setViewProps(mp.hostId, 'notification', true);
                mp.setView(mp.hostId, 'host-mainpage');

                mp.playersForEach((clientId, index) => {
                    mp.setViewProps(clientId, 'status', outcome);
                    mp.setView(clientId, 'client-wait');
                });
                break;
            }
        }

        return true;
    },

    methods: {
        'startGame': AvalonStartGame,
        'newGame': AvalonNewGame,
        'updateQuestMembers': AvalonUpdateQuestMembers,
        'commitTeam': AvalonCommitTeam,
        'commitTeamVote': AvalonCommitTeamVote,
        'commitQuestVote': AvalonCommitQuestVote,
        'chooseMerlin': AvalonChooseMerlin
    },

    views: {
        'host-lobby': AvalonHostLobby,
        'host-mainpage': AvalonHostMainPage,
        'client-choosequestmembers': AvalonClientChooseQuestMembers,
        'client-vote': AvalonClientVote,
        'client-wait': AvalonWait
    }
};

export default AvalonRule;
