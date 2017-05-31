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

import {
    CharacterName
} from '../AvalonUtils';

export function AvalonPlayerProfile(props: AvalonViewPropsInterface) {
    const mp = props.MP;
    let character = '';
    let minionObj = null;
    let merlinObj = null;

    if (props.minions) {

        let minions = [];

        for (let i = 0; i < props.minions.length; i = i + 1) {

            const playerCard = mp.getPluginView(
                'lobby',
                'player-tag',
                {
                    clientIndex: props.minions[i],
                    invertColors: true
                });

            minions.push(
                (<span className="player-card" key={ 'minion-' + i }>
                     { playerCard }
                 </span>));
        }

        let minionText = '';
        if (minions.length > 1) {
            minionText = 'Minions are';
        } else {
            minionText = 'Minion is';
        }

        minionObj = (
            <div>{ minionText }: { minions }</div>
        );
    }

    if (props.merlins) {

        let merlins = [];

        for (let i = 0; i < props.merlins.length; i = i + 1) {

            const playerCard = mp.getPluginView(
                'lobby',
                'player-tag',
                {
                    clientIndex: props.merlins[i],
                    invertColors: true
                });

            merlins.push(
                (<span className="player-card" key={ 'merlin-' + i }>
                { playerCard }
                </span>));
        }

        let merlinText = '';
        if (merlins.length > 1) {
            merlinText = 'Merlins are';
        } else {
            merlinText = 'Merlin is';
        }

        merlinObj = (
            <div>{ merlinText }: { merlins }</div>
        );
    }

    character = CharacterName(props.character);

    let cardsInPlay = [];
    for (const character in props.cardsInPlay) {

        if (props.cardsInPlay[character] === 0) {
            continue;
        }

        const achar = AvalonCharacter[AvalonCharacter[character]];

        cardsInPlay.push(
            <li key={ character }>{ CharacterName(achar) }: { props.cardsInPlay[character] }</li>
        );
    }

    return (
        <div className="avalon-profile">
            Your role is: <strong className="character">{ character }</strong>
            { minionObj }
            { merlinObj }
            <hr />
            Cards in play:
            <ul>
                { cardsInPlay }
            </ul>
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

    if (quest.questStatus === AvalonQuestStatus.TeamApproved) {
        outcome = 'Team approved';
        questClass += ' rejected';
    } else if (quest.questStatus === AvalonQuestStatus.TeamRejected) {
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
    startingNewGame: boolean,
    merlin: boolean,
    percival: boolean,
    mondred: boolean,
    morgana: boolean
}> {

    constructor(props: AvalonViewPropsInterface) {
        super(props);
        this._setStartingNewGameFlag = this._setStartingNewGameFlag.bind(this);
        this._unsetStartingNewGameFlag = this._unsetStartingNewGameFlag.bind(this);
        this._startNewGame = this._startNewGame.bind(this);
        this._setCharInPlay = this._setCharInPlay.bind(this);
        this.state = {
            startingNewGame: false,
            merlin: this.props.charactersInPlay.merlin,
            percival: this.props.charactersInPlay.percival,
            mondred: this.props.charactersInPlay.mondred,
            morgana: this.props.charactersInPlay.morgana
        };
    }

    private _setStartingNewGameFlag() {
        this.setState({
            startingNewGame: true,
            merlin: this.state.merlin,
            percival: this.state.merlin && this.state.percival,
            mondred: this.state.merlin && this.state.mondred,
            morgana: this.state.merlin && this.state.percival && this.state.morgana
        });
    }

    private _unsetStartingNewGameFlag() {
        this.setState({
            startingNewGame: false,
            merlin: this.state.merlin,
            percival: this.state.percival,
            mondred: this.state.mondred,
            morgana: this.state.morgana
        });
    }

    private _setCharInPlay(character: string) {
        return () => {
            const prevState = this.state;
            prevState[character] = !prevState[character];
            this.setState(prevState);
        };
    }

    private _startNewGame() {
        this._unsetStartingNewGameFlag();
        this.props.MP.newGame({
            merlin: this.state.merlin,
            percival: this.state.percival,
            mondred: this.state.mondred,
            morgana: this.state.morgana
        });
    }

    public render() {
        const charactersSelect = (
            <div className="avalon-select-characters">
                Select characters in play:
                <ul>
                    <li>
                        <input type="checkbox" checked={ this.state.merlin } onClick={ this._setCharInPlay('merlin') } />
                        Merlin
                    </li>
                    <li>
                        <input type="checkbox" checked={ this.state.merlin && this.state.mondred } onClick={ this._setCharInPlay('mondred') } disabled={ !this.state.merlin } />
                        Mondred
                    </li>
                    <li>
                        <input type="checkbox" checked={ this.state.merlin && this.state.percival } onClick={ this._setCharInPlay('percival') } disabled={ !this.state.merlin } />
                        Percival
                    </li>
                    <li>
                        <input type="checkbox" checked={ this.state.percival && this.state.merlin && this.state.morgana } onClick={ this._setCharInPlay('morgana') } disabled={ !this.state.merlin || !this.state.percival } />
                        Morgana
                    </li>
                </ul>
            </div>
        );

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

        return (
            <div className='avalon-settings'>
                { charactersSelect}
                { avalonSettingsBody }
            </div>);
    }
}
