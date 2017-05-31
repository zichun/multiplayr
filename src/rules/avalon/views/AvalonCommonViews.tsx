/**
 * AvalonCommonViews.tsx
 */

import * as React from 'react';

import {
    MPType
} from '../../../common/interfaces';

import {
    ChoiceList,
    Choice
} from '../../../client/components/ChoiceList';

import {
    AvalonViewPropsInterface,
    AvalonCharacter,
    AvalonQuest,
    AvalonQuestStatus
} from '../AvalonTypes';

export function AvalonPlayerProfile(props: AvalonViewPropsInterface) {
    const mp = props.MP;
    let character = '';
    let extra = null;

    let minions = [];
    if (props.minions) {
        for (let i = 0; i < props.minions.length; i = i + 1) {

            const playerCard = mp.getPluginView(
                'lobby',
                'player-tag',
                {
                    clientIndex: props.minions[i],
                    invertColors: true
                });

            minions.push(
                (<span key={ 'minion-' + i }>
                     { playerCard }
                 </span>));
        }

        extra = (
            <div>Minions are: { minions }</div>
        );
    }

    switch(props.character) {
        case AvalonCharacter.Merlin:
            character = 'Merlin';
            break;
        case AvalonCharacter.LoyalServant:
            character = 'Loyal Servant of Arthur';
            minions = null;
            break;
        case AvalonCharacter.Minion:
            character = 'Minion of Mordred';
            break;
    }

    return (
        <div className="avalon-profile">
            Your role is: <strong className="character">{ character }</strong>
            { extra }
        </div>
    );
}

export function AvalonQuestView(
    props: AvalonViewPropsInterface,
    quest: AvalonQuest
) {
    const mp = props.MP;

    const leader = mp.getPluginView(
        'lobby',
        'player-tag',
        {
            clientIndex: quest.leader,
            invertColors: false
        });

    const members = [];
    for (let i = 0; i < quest.teamMembers.length; i = i + 1) {
        const member = mp.getPluginView(
            'lobby',
            'player-tag',
            {
                clientIndex: quest.teamMembers[i],
                invertColors: false
            });

        members.push(
            <li key={ i }>{ member }</li>
        );
    }

    const mandate = [];
    for (let i = 0; i < props.lobby.playerCount; i = i + 1) {
        const member = mp.getPluginView(
            'lobby',
            'player-tag',
            {
                clientIndex: i,
                invertColors: false
            });

        mandate.push(
            <li key={ i }>{ member } - { quest.teamVote[i] ? 'Accept' : 'Reject'}</li>
        );
    }

    let outcome = null;
    let questClass = 'quest ';

    if (quest.questStatus === AvalonQuestStatus.TeamRejected) {
        outcome = 'Team rejected';
        questClass += ' rejected';
    } else if (quest.questStatus === AvalonQuestStatus.QuestFailed) {
        outcome = 'Quest failed!';

        let failCount = 0;
        for (let i = 0; i < props.lobby.playerCount; i = i + 1) {
            if (quest.questVote[i] === false) {
                failCount = failCount + 1;
            }
        }

        if (failCount === 1) {
            outcome += ' (' + failCount + ' failing vote)';
        } else {
            outcome += ' (' + failCount + ' failing votes)';
        }
        questClass += ' failed';
    } else {
        outcome = 'Quest passed!'
        questClass += ' passed';
    }

    return (
        <div className={ questClass }>
            <div>Quest: { quest.quest + 1 }</div>
            <div>Leader: { leader }</div>
            <div>Team:</div>
            <ul>{ members }</ul>
            <div>Team Mandate:</div>
            <ul>{ mandate }</ul>
            <div className="outcome">Outcome: { outcome }</div>
        </div>
    );
}

export function AvalonQuests(props: AvalonViewPropsInterface) {
    const quests = [];
    for (let i = 0; i < props.quests.length; i = i + 1) {
        const quest = AvalonQuestView(props, props.quests[i]);
        quests.push(
            <div key={ 'quest-' + i }>
                { quest }
            </div>
        );
    }

    let message = null;
    if (props.quests.length === 0) {
        message = 'No completed quests';
    }

    return (
        <div className="avalon-quests">
            { quests }
            { message }
        </div>
    );
}

export class AvalonSettings extends React.Component<AvalonViewPropsInterface, {
    startingNewGame: boolean
}> {

    constructor(props: AvalonViewPropsInterface) {
        super(props);
        this._setStartingNewGameFlag = this._setStartingNewGameFlag.bind(this);
        this._unsetStartingNewGameFlag = this._unsetStartingNewGameFlag.bind(this);
        this._startNewGame = this._startNewGame.bind(this);
        this.state = { startingNewGame: false };
    }

    private _setStartingNewGameFlag() {
        this.setState({ startingNewGame: true });
    }

    private _unsetStartingNewGameFlag() {
        this.setState({ startingNewGame: false });
    }

    private _startNewGame() {
        this._unsetStartingNewGameFlag();
        this.props.MP.newGame();
    }

    public render() {
        const avalonSettingsBody = this.state.startingNewGame ? (
            <div>
                <button onClick={ this._startNewGame }>Confirm starting new game</button>
                <button 
                    onClick={ this._unsetStartingNewGameFlag }
                    className='avalon-cancel-new-game'
                >
                    Cancel
                </button>
            </div>
        ) : (
            <button onClick={ this._setStartingNewGameFlag }>Start New Game</button>
        );
        return (<div className='avalon-settings'>
            { avalonSettingsBody }
        </div>);
    }
}
