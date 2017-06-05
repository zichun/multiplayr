/**
 * AvalonCommonViews.tsx
 */

import * as React from 'react';
import {
    Checkbox,
    Header,
    Grid,
    Container
} from 'semantic-ui-react';

import {
    contains
} from '../../../common/utils';

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

        const className = quest.teamVote[i] ? 'accept' : 'reject';
        mandate.push(
            <li key={ i } className="teammandate">
                { member } -
                <div className={ className }>{ quest.teamVote[i] ? 'Accepted' : 'Rejected'}</div>
            </li>
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
            <Header size="medium">Quest: { quest.quest + 1 }</Header>
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

    for (let i = props.quests.length - 1; i >= 0; i = i - 1) {
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
    remotePlay: boolean,
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
            remotePlay: this.props.remotePlay,
            merlin: this.props.charactersInPlay.merlin,
            percival: this.props.charactersInPlay.percival,
            mondred: this.props.charactersInPlay.mondred,
            morgana: this.props.charactersInPlay.morgana
        };
    }

    private _setStartingNewGameFlag() {
        this.setState({
            startingNewGame: true,
            remotePlay: this.state.remotePlay,
            merlin: this.state.merlin,
            percival: this.state.merlin && this.state.percival,
            mondred: this.state.merlin && this.state.mondred,
            morgana: this.state.merlin && this.state.percival && this.state.morgana
        });
    }

    private _unsetStartingNewGameFlag() {
        this.setState({
            startingNewGame: false,
            remotePlay: this.state.remotePlay,
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
            remotePlay: this.state.remotePlay,
            merlin: this.state.merlin,
            percival: this.state.percival,
            mondred: this.state.mondred,
            morgana: this.state.morgana
        });
    }

    public render() {
        const charactersSelect = (
            <div className="avalon-select-characters">
                <ul>
                    <li>
                        <Checkbox toggle checked={ this.state.remotePlay } onClick={ this._setCharInPlay('remotePlay') } label="Remote Play" />
                    </li>
                </ul>
                Select characters in play:
                <ul>
                    <li>
                        <Checkbox toggle checked={ this.state.merlin } onClick={ this._setCharInPlay('merlin') } label="Merlin" />
                    </li>
                    <li>
                        <Checkbox toggle checked={ this.state.merlin && this.state.mondred } onClick={ this._setCharInPlay('mondred') } disabled={ !this.state.merlin } label="Mondred" />
                    </li>
                    <li>
                        <Checkbox toggle checked={ this.state.merlin && this.state.percival } onClick={ this._setCharInPlay('percival') } disabled={ !this.state.merlin } label="Percival" />
                    </li>
                    <li>
                        <Checkbox toggle checked={ this.state.percival && this.state.merlin && this.state.morgana } onClick={ this._setCharInPlay('morgana') } disabled={ !this.state.merlin || !this.state.percival } label="Morgana" />
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

export function AvalonTeamMembers(props: AvalonViewPropsInterface) {
    const currentTeam = props.currentTeam;
    const members = [];
    let currentTeamCount = 0;

    for (let i = 0; i < props.lobby.playerCount; i = i + 1) {

        if (!contains(currentTeam, i.toString())) {
            continue;
        }

        currentTeamCount = currentTeamCount + 1;

        const member = props.MP.getPluginView(
            'lobby',
            'player-tag',
            {
                clientIndex: i,
                invertColors: true
            });

        members.push(
            <Grid.Column key={ 'player-' + i }>
                { member }
            </Grid.Column>
        );
    }

    return (
        <Grid columns={ currentTeamCount as any }
              padded relaxed verticalAlign="middle">
            <Grid.Row centered>
                <Grid.Column stretched>
                    <Header size="medium">Team Members</Header>
                </Grid.Column>
            </Grid.Row>
            <Grid.Row centered>
                { members }
            </Grid.Row>
        </Grid>
    );

}

export function AvalonRules() {
    return (
        <div className="avalon-rule">
            <Container text textAlign="center"><Header size="large">Avalon</Header></Container>
            <Container text><Header size="medium">Objective</Header></Container>
            <Container text textAlign="justified">
                The Resistance:Avalon is a social deduction game with secret identities. Players play either on the side of the Loyal Servants of Arthur, attempting to complete honorable quests for Arthur, or on the side of Mondred trying to thwart the quests. The servants of Arthur wins the game if three quests are completed successfully; the minions of Mondred wins if three quests fails.
            </Container>
            <Container text textAlign="justified">
                A fundamental rule of the game is that players may say anything that they want, at anytime during the game. Discussions, deception, intuition, social interaction and logical deductions are all equally important to winning.
            </Container>
            <Container text><Header size="medium">Gameplay</Header></Container>
            <Container text textAlign="justified">
                At the start of the game, a fixed number of the group (approximatedly one third) are randomly and secretly chosen to be minions of Mondred, and the rest of the players are loyal servants of Arthur. The minions are made aware of each other without the loyal servants knowing their identity - the only thing the loyal servants know is how many other servants of Arthur exist, not who they are.
            </Container>
            <Container text><Header size="small">Rounds</Header></Container>
            <Container text textAlign="justified">
                At the start of the game, a player is randomly selected to be the quest leader. Subsequently, the next player will become the new leader of the round. The Leader selects a certain number of players to send out on a quest (the Leader may choose to go out on the mission himself/herself), starting with Quest 1. All of the players then discuss the Leader's choice and, simultaneous and in public, vote on whether to accept the team make-up or not. If a majority of players votes no to the proposal or if it's a tie, leadership passes on to the next player to the left, who proposes their own quest members. This continues until a majority of players agrees with the current Leader's mission assignment. After four rejected quest proposals in a row, the next proposed quest will <strong>automatically be accepted</strong>.
            </Container>
            <Container text textAlign="justified">
                Once a mission team is agreed on, the players then "go" on the quest. To "go" on a quest, players on the quest are given a set of Quest choice, one for indicating Success, the other indicating Fail. Player may either secretly submit a Sucess or Fail card. The cards are shuffled and then revealed. If all cards show Success, the loyal servants of Arthur earns one point. If even one card shows Fail, the quest has been sabotaged and the minions of Mondred earn one point (except for the an exceptions on Mission 4 with 7 or more players, where it may be necessary for 2 Fail cards to be played in order for the mission to fail).
            </Container>
            <Container text textAlign="justified">
                The game continues until one team accumulates 3 points.
            </Container>
            <Container text><Header size="medium">Special Characters</Header></Container>
            <Container text textAlign="justified">
                There are 4 special roles that may be configured to be included in the game or not. <strong>Merlin</strong>, playing on the side of Arthur, is told at the beginning of the game which player plays on the side of Mondred. If the minons of Mondred lose the game, however, they have one last chance of winning by correctly guessing Merlin's identity. If they can do this, they win.
            </Container>
            <Container text textAlign="justified">
                <strong>Percival</strong>, also on the side of Arthur, knows the identity of Merlin at the start of the game and is in a position to help protect Merlin's identity.
            </Container>
            <Container text textAlign="justified">
                <strong>Mondred</strong> (playing on his own side of course), does not reveal their identity to Merlin at the start of the game, leaving Merlin in the dark.
            </Container>
            <Container text textAlign="justified">
                <strong>Morgana</strong>, playing on the side of Mondred, reveal their identity to Percival as Merlin. When Morgana is in play, Percival will have to guess which of the player playing Morgana and Merlin is the true Merlin.
            </Container>

        </div>
    );
}
