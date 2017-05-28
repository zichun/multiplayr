/**
 * AvalonHostMainPage.tsx
 */

import * as React from 'react';

import {
    AvalonViewPropsInterface,
    AvalonQuestStatus
} from '../AvalonTypes';

import {
    AvalonQuestMembers
} from '../AvalonUtils';

import {
    AvalonQuests
} from './AvalonCommonViews';

import {
    Notification
} from '../../../client/components/Notification';

export class AvalonHostMainPage extends React.Component<AvalonViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;
        const quests = this.props.quests;

        const leader = mp.getPluginView(
            'lobby',
            'player-tag',
            {
                clientIndex: this.props.leader,
                invertColors: false
            });

        const members = [];
        for (let i = 0; i < this.props.currentTeam.length; i = i + 1) {

            const member = mp.getPluginView(
                'lobby',
                'player-tag',
                {
                    clientIndex: this.props.currentTeam[i],
                    invertColors: false
                });

            members.push(
                <li key={ i }>{ member }</li>
            );
        }

        for (let i = 0; i < this.props.requiredMembers - this.props.currentTeam.length; i = i + 1) {
            members.push(<li key={ '?' + i }>?</li>);
        }

        //
        // Quest outcome popup.
        //

        let questOutcome = null;
        if (quests.length && this.props.notification === true) {
            if (quests[quests.length - 1].questStatus === AvalonQuestStatus.TeamRejected) {
                questOutcome = (
                    <Notification hideAfter={ 2000 }>
                        <h1 className="outcome rejected">Team was <strong>rejected</strong>!</h1>
                    </Notification>
                );
            } else if (quests[quests.length - 1].questStatus === AvalonQuestStatus.QuestFailed) {
                questOutcome = (
                    <Notification hideAfter={ 2000 }>
                        <h1 className="outcome failed">Quest <strong>failed</strong>!</h1>
                    </Notification>
                );
            } else if (quests[quests.length - 1].questStatus === AvalonQuestStatus.QuestSucceeded) {
                questOutcome = (
                    <Notification hideAfter={ 2000 }>
                        <h1 className="outcome succeeded">Quest <strong>succeeded</strong>!</h1>
                    </Notification>
                );
            }
        }

        //
        // Quest Grid.
        //

        const playersCount = this.props.lobby.playerCount;
        const required = AvalonQuestMembers[playersCount];
        const questGrid = [];
        const outcome = [];
        for (let i = 0; i < quests.length; i = i + 1) {
            if (quests[i].questStatus === AvalonQuestStatus.QuestFailed) {
                outcome.push(false);
            } else if (quests[i].questStatus === AvalonQuestStatus.QuestSucceeded) {
                outcome.push(true);
            }
        }

        for (let i = 0; i < required.length; i = i + 1) {
            let className = 'grid ';
            let extra = '';

            if (i < outcome.length) {
                className += (outcome[i] ? 'succeeded' : 'failed');
            } else if (i === this.props.currentQuest) {
                className += 'current';
            }

            if (playersCount >= 7 && i === 4) {
                extra = '*';
            }

            questGrid.push(
                <div className={ className } key={ i }>
                    { required[i] + extra }
                </div>
            );
        }

        const main = (
            <div className="avalon-hostmainpage">
                { questGrid }
                { questOutcome }
                <div className="status">{ this.props.status }</div>
                <div className="leader">Leader is { leader }</div>
                <ul className="">
                    { members }
                </ul>
            </div>
        );

        return mp.getPluginView(
            'gameshell',
            'HostShell-Main',
            {
                'links': {
                    'home': {
                        'icon': 'gamepad',
                        'label': 'Avalon',
                        'view': main
                    },
                    'quests': {
                        'icon': 'history',
                        'label': 'Quest History',
                        'view': AvalonQuests(this.props)
                    }
                },
                'topBarContent': 'Quest ' + (this.props.currentQuest + 1)
            });
    }
}
