/**
 * AvalonClientViews.tsx
 */

import * as React from 'react';

import {
    ChoiceList,
    Choice
} from '../../../client/components/ChoiceList';

import {
    AvalonViewPropsInterface
} from '../AvalonTypes';

import {
    AvalonPlayerProfile,
    AvalonQuests
} from './AvalonCommonViews';

export class AvalonClientChooseQuestMembers extends React.Component<AvalonViewPropsInterface, {
    members: string[]
}> {

    constructor(props: any) {
        super(props);
        this._selectMember = this._selectMember.bind(this);
        this._unselectMember = this._unselectMember.bind(this);
        this._commitTeam = this._commitTeam.bind(this);
        this.state = { members: [] };
    }

    private _commitTeam() {
        if (this.props.chooseMerlin === true) {
             this.props.MP.chooseMerlin(this.state.members[0]);
        } else if (this.state.members.length >= this.props.requiredMembers) {
            this.props.MP.commitTeam();
        }
    }

    private _selectMember(choice: string, index: Number) {
        let members = this.state.members;

        for (let i = 0; i < members.length; i++) {
            if (members[i] === choice) {
                return false;
            }
        }

        members.push(choice);

        this.setState({ members: members });
        if (!this.props.chooseMerlin) {
            this.props.MP.updateQuestMembers(members);
        }

        return true;
    }

    private _unselectMember(choice: string, index: Number) {
        const tr = [];

        for (let i = 0; i < this.state.members.length; i++) {
            if (this.state.members[i] !== choice) {
                tr.push(this.state.members[i]);
            }
        }

        this.setState({ members: tr });
        if (!this.props.chooseMerlin) {
            this.props.MP.updateQuestMembers(tr);
        }

        return true;
    }

    public render() {
        const mp = this.props.MP;
        const choices = [];

        for (let i = 0; i < this.props.lobby.playerCount; i = i + 1) {

            const player = mp.getPluginView(
                'lobby',
                'player-tag',
                {
                    clientIndex: i,
                    invertColors: true
                }
            );

            choices.push(
                <Choice key={ i }>
                    { player }
                </Choice>
            );
        }

        let required = this.props.requiredMembers;
        let chooseMessage = (<div>Choose { this.props.requiredMembers } members for the quest:</div>);

        if (this.props.chooseMerlin) {
            chooseMessage = (<div>Identify Merlin:</div>);
            required = 1;
        }

        const choiceList = (
            <ChoiceList onSelect={ this._selectMember }
                        onUnselect={ this._unselectMember }
                        multi={ required > 1 }
                        maximum={ required }
                        selectedKeys={ this.state.members }
                        className='avalon-member-choicelist'
                        itemClassName='avalon-member-choicelist-item'>
                { choices }
            </ChoiceList>
        );

        const fullTeam = (this.state.members.length >= required);
        const commitTeam = (
            <button disabled={ !fullTeam }
                    onClick={ this._commitTeam }>
                { this.props.chooseMerlin ? 'Identify Merlin' : 'Commit Team' }
            </button>
        );

        return mp.getPluginView(
            'gameshell',
            'HostShell-Main',
            {
                'links': {
                    'home': {
                        'icon': 'gamepad',
                        'label': 'Avalon',
                        'view': (
                            <div>
                                { chooseMessage }
                                { choiceList }
                                { commitTeam }
                            </div>
                        )
                    },
                    'profile': {
                        'icon': 'address-card',
                        'label': 'Profile',
                        'view': AvalonPlayerProfile(this.props)
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

export class AvalonClientVote extends React.Component<AvalonViewPropsInterface, {
    vote: string
}> {

    constructor(props: AvalonViewPropsInterface) {
        super(props);
        this.state = {
            vote: null
        };
        this._selectVote = this._selectVote.bind(this);
    }

    private _selectVote(choice: string, index: Number) {
        this.setState({
            vote: choice
        });
        return true;
    }

    private _commitVote() {
        if (this.props.voteType === 'team') {
            this.props.MP.commitTeamVote(this.state.vote);
        } else {
            this.props.MP.commitQuestVote(this.state.vote);
        }
    }

    public render() {
        const mp = this.props.MP;

        const choices = (
            <ChoiceList onSelect={ this._selectVote }
                        selectedKey={ this.state.vote }
                        className='coup-action-choicelist'
                        itemClassName='coup-action-choicelist-item'>
                <Choice key="Pass">
                    { this.props.voteType === 'team' ? 'Accept Team' : 'Pass Quest' }
                </Choice>
                <Choice key="Fail">
                    { this.props.voteType === 'team' ? 'Reject Team' : 'Fail Quest' }
                </Choice>
            </ChoiceList>
        );

        const commitVote = (
            <button className='coup-action-choicelist-button'
                    disabled={ !(this.state.vote) }
                    onClick={ this._commitVote.bind(this) }>
                Commit vote
            </button>
        );

        return mp.getPluginView(
            'gameshell',
            'HostShell-Main',
            {
                'links': {
                    'home': {
                        'icon': 'gamepad',
                        'label': 'Avalon',
                        'view': (
                            <div>
                                { choices }
                                { commitVote }
                            </div>
                        )
                    },
                    'profile': {
                        'icon': 'address-card',
                        'label': 'Profile',
                        'view': AvalonPlayerProfile(this.props)
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

export function AvalonWait(props: AvalonViewPropsInterface) {
    const mp = props.MP;

    return mp.getPluginView(
        'gameshell',
        'HostShell-Main',
        {
            'links': {
                'home': {
                    'icon': 'gamepad',
                    'label': 'Avalon',
                    'view': (
                        <div>
                            { props.status }
                        </div>
                    )
                },
                'profile': {
                    'icon': 'address-card',
                    'label': 'Profile',
                    'view': AvalonPlayerProfile(props)
                },
                'quests': {
                    'icon': 'history',
                    'label': 'Quest History',
                    'view': AvalonQuests(props)
                }
            },
            'topBarContent': 'Quest ' + (props.currentQuest + 1)
        });
}
