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
    AvalonFinishVoeQuestResult,
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
    IsClientMinion
} from './AvalonUtils';

import {
    AvalonGameState,
    AvalonCharacter,
    AvalonGameOutcome,
    AvalonQuestStatus
} from './AvalonTypes';

export const AvalonRule: GameRuleInterface = {
    name: 'avalon',

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
        'gameOutcome': null,
        'charactersInPlay': {
            'merlin': true,
            'mondred': true,
            'percival': true,
            'morgana': true
        },
        'remotePlay': false
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

        const state = mp.getData('state');
        const currentLeader = mp.getData('currentLeader');
        const currentQuest = mp.getData('currentQuest');
        const currentTeam = mp.getData('currentTeam');
        const requiredMembers = AvalonQuestMembers[mp.playersCount()][currentQuest];
        const quests = mp.getData('quests');
        const voteQuestMembers = mp.getPlayersData('voteQuestMembers');
        const voteQuest = mp.getPlayersData('voteQuest');

        mp.setViewProps(mp.hostId, 'state', state);
        mp.setViewProps(mp.hostId, 'leader', currentLeader);
        mp.setViewProps(mp.hostId, 'currentQuest', currentQuest);
        mp.setViewProps(mp.hostId, 'requiredMembers', requiredMembers);
        mp.setViewProps(mp.hostId, 'currentTeam', currentTeam);
        mp.setViewProps(mp.hostId, 'quests', quests);
        mp.setViewProps(mp.hostId, 'charactersInPlay', mp.getData('charactersInPlay'));

        mp.setViewProps(mp.hostId, 'voteQuestMembers', voteQuestMembers);
        mp.setViewProps(mp.hostId, 'voteQuest', voteQuest);
        mp.setViewProps(mp.hostId, 'remotePlay', mp.getData('remotePlay'));

        const charactersInPlay = {};

        const objValues = Object.keys(AvalonCharacter).map(k => AvalonCharacter[k]);
        const characters = objValues.filter(v => typeof v === "string") as string[];

        for (const character in characters) {
            charactersInPlay[character] = 0;
        }

        mp.playersForEach((clientId, index) => {
            mp.setViewProps(clientId, 'state', state);
            mp.setViewProps(clientId, 'leader', currentLeader);
            mp.setViewProps(clientId, 'currentQuest', currentQuest);
            mp.setViewProps(clientId, 'requiredMembers', requiredMembers);
            mp.setViewProps(clientId, 'currentTeam', currentTeam);
            mp.setViewProps(clientId, 'quests', quests);
            mp.setViewProps(clientId, 'charactersInPlay', mp.getData('charactersInPlay'));

            mp.setViewProps(clientId, 'voteQuestMembers', voteQuestMembers);
            mp.setViewProps(clientId, 'voteQuest', voteQuest);
            mp.setViewProps(clientId, 'remotePlay', mp.getData('remotePlay'));

            const character = mp.getPlayerData(clientId, 'character');
            charactersInPlay[character] = charactersInPlay[character] + 1;
            mp.setViewProps(clientId, 'character', character);

            mp.setViewProps(clientId, 'minions', null);
            mp.setViewProps(clientId, 'merlins', null);
            if (character === AvalonCharacter.Merlin) {
                const minions = [];
                mp.playersForEach((clientId, index) => {
                    if (mp.getPlayerData(clientId, 'character') === AvalonCharacter.Minion || mp.getPlayerData(clientId, 'character') === AvalonCharacter.Morgana) {
                        minions.push(index);
                    }
                });

                mp.setViewProps(clientId, 'minions', minions);
            } else if (IsClientMinion(mp, clientId)) {

                const minions = [];
                mp.playersForEach((clientId, index) => {
                    if (IsClientMinion(mp, clientId)) {

                        minions.push(index);
                    }
                });

                mp.setViewProps(clientId, 'minions', minions);
            } else if (character === AvalonCharacter.Percival) {
                const merlins = [];

                mp.playersForEach((clientId, index) => {
                    if (mp.getPlayerData(clientId, 'character') === AvalonCharacter.Merlin || mp.getPlayerData(clientId, 'character') === AvalonCharacter.Morgana) {
                        merlins.push(index);
                    }
                });

                mp.setViewProps(clientId, 'merlins', merlins);
            }
        });

        mp.playersForEach((clientId, index) => {
            mp.setViewProps(clientId, 'cardsInPlay', charactersInPlay);
        });

        switch(state)
        {
            case AvalonGameState.ChooseQuestMembers:
            {
                mp.setViewProps(mp.hostId, 'status', 'Choose Team');
                mp.setView(mp.hostId, 'host-mainpage');
                mp.playersForEach((clientId, index) => {
                    if (index === currentLeader) {
                        mp.setViewProps(clientId, 'chooseMerlin', false);
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
                const playersVote = voteQuestMembers;
                let voted = 0;

                for (let i = 0; i < mp.playersCount(); i = i + 1) {
                    if (playersVote[i] !== null) {
                        voted = voted + 1;
                    }
                }

                const voteCount = '(' + voted + '/' + mp.playersCount()  + ')';

                mp.setViewProps(mp.hostId, 'status', 'Waiting for team mandate ' + voteCount);
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

                mp.setViewProps(mp.hostId, 'status', 'Waiting for quest outcome ' + voteCount);
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

            case AvalonGameState.VoteQuestResult:
            {
                let status = '';

                if (quests[quests.length - 1].questStatus === AvalonQuestStatus.QuestFailed) {
                    status = 'Quest failed.';
                } else {
                    status = 'Quest passed!';
                }

                mp.setViewProps(mp.hostId, 'status', status);
                mp.setView(mp.hostId, 'host-mainpage');
                mp.playersForEach((clientId, index) => {
                    mp.setViewProps(clientId, 'status', status);
                    mp.setView(clientId, 'client-wait');
                });
                break;
            }

            case AvalonGameState.ChooseMerlin:
            {
                mp.setViewProps(mp.hostId, 'status', 'Minion of Mondred will attempt to identify Merlin');
                mp.setView(mp.hostId, 'host-mainpage');

                let foundMinion = false;
                mp.playersForEach((clientId, index) => {
                    if (foundMinion === false && IsClientMinion(mp, clientId)) {
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
        'finishVoteQuestResult': AvalonFinishVoeQuestResult,
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
