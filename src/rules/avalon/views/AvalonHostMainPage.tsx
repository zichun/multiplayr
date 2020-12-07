/**
 * AvalonHostMainPage.tsx
 */

import * as React from 'react';
import * as ReactCSSTransitionGroup from 'react-addons-css-transition-group';
import FailSound from '../sounds/fail.mp3';
import PassSound from '../sounds/pass.mp3';

import {
    contains
} from '../../../common/utils';

import {
    AvalonViewPropsInterface,
    AvalonQuestStatus,
    AvalonGameState
} from '../AvalonTypes';

import {
    AvalonQuestMembers
} from '../AvalonUtils';

import {
    AvalonSettings,
    AvalonQuests,
    AvalonRules
} from './AvalonCommonViews';

import {
    Notification
} from '../../../client/components/Notification';

import {
    Segment,
    Rail,
    List,
    Card,
    Grid,
    Dimmer,
    Loader
} from 'semantic-ui-react'

import * as FontAwesome from 'react-fontawesome';
import Sound from 'react-sound';

const PlayerTeamVote = (
    props: AvalonViewPropsInterface & { playerIndex: number }
) => {
    const state = props.state;
    const quests = props.quests;
    let voteQuestMembers = props.voteQuestMembers;

    if (quests.length === 0 ||
        state === AvalonGameState.ChooseMerlin) {

        return null;
    }

    if (state === AvalonGameState.VoteQuestMembers || state === AvalonGameState.GameOver) {
        return null;
    }

    if (state === AvalonGameState.ChooseQuestMembers &&
        quests[quests.length - 1].questStatus !== AvalonQuestStatus.TeamRejected) {
        return null;
    }

    if (state === AvalonGameState.ChooseQuestMembers) {
        voteQuestMembers = quests[quests.length - 1].teamVote;
    }

    const vote = voteQuestMembers[props.playerIndex];
    const className = ['teamvote'];

    className.push(vote ? 'accept' : 'reject');

    return (
        <ReactCSSTransitionGroup
        transitionName='teamvote'
        transitionAppear={ true }
        transitionAppearTimeout={ 1000 }
        transitionLeaveTimeout={ 0 }
        transitionLeave={ false }
        transitionEnter={ false }>
            <div className={ className.join(' ') }>
                { vote ? 'Accepted' : 'Rejected' }
            </div>
        </ReactCSSTransitionGroup>
    );
}

const PlayerStatus = (
    props: AvalonViewPropsInterface & { playerIndex: number }
) => {
    if (props.state === AvalonGameState.VoteQuestMembers) {
        if (props.voteQuestMembers[props.playerIndex] === null) {
            return (
                <Dimmer active inverted>
                    <Loader inverted>Voting Team</Loader>
                </Dimmer>
            );
        }
    } else if (props.state === AvalonGameState.VoteQuest) {
        const quest = props.quests[props.quests.length - 1];
        if (contains(quest.teamMembers, props.playerIndex.toString()) && props.voteQuest[props.playerIndex] === null) {
            return (
                <Dimmer active inverted>
                    <Loader inverted>Voting Quest</Loader>
                </Dimmer>
            );
        }
    }

    return null;
};

const PlayersList = (
    props: AvalonViewPropsInterface
) => {
    const players = [];
    const mp = props.MP;

    for (let i = 0; i < props.lobby.playerCount; i = i + 1) {

        const playerTag = mp.getPluginView(
            'lobby',
            'player-tag',
            {
                clientIndex: i,
                invertColors: false,
                border: false
            });

        let inTeam = null;
        let className = 'ui ribbon label';

        if (i === props.leader) {
            className += ' red';
        }

        let teamIcon = null;
        if (contains(props.currentTeam, i.toString())) {
            teamIcon = (
                <FontAwesome name="bolt"
                             className="player-card-team" />);

            if (i !== props.leader) {
                className += ' blue';
            }

        } else {
            teamIcon = (<span>&nbsp;</span>);
        }

        inTeam = (
            <div className={ className }>
                { teamIcon }
            </div>
        );

        players.push(
            <Card centered raised key={ 'Card' + i }>
                <Card.Content>
                    <Card.Header>
                        { inTeam }
                        <PlayerTeamVote {...props}
                                  playerIndex={ i } />
                    </Card.Header>
                    <div className="player-tag">
                        { playerTag }
                    </div>
                    <PlayerStatus {...props}
                                  playerIndex={ i } />
                 </Card.Content>
            </Card>
        );
    }

    return (
        <Card.Group stackable className="players-list">
            { players }
        </Card.Group>
    );
};

const VoteQuestResultCard = (
    props: {
        result: boolean,
        flipped: boolean,
        hidden: boolean
    }
) => {
    const className = ["votequest-result-card"];
    const cardClassName = ["back"];

    if (props.flipped) {
        className.push('flip');
    }

    if (props.hidden) {
        className.push('hidden');
    }

    cardClassName.push(props.result ? 'pass' : 'fail');

    return (
        <div className={ className.join(' ') }>
		    <div className="flipper">
                <div className="front">
                    &nbsp;
                </div>
                <div className={ cardClassName.join(' ') }>
                    { props.result ? 'Pass' : 'Fail' }
                </div>
            </div>
        </div>
    );
};

export class VoteQuestResult extends React.Component<
    AvalonViewPropsInterface,
      {
          currentCardIndex: number,
          hiddenCardIndex: number
      }
> {
    constructor(props) {
        super(props);
        this.state = {
            currentCardIndex: 0,
            hiddenCardIndex: 0
        };
        this._nextCard = this._nextCard.bind(this);
        this._nextState = this._nextState.bind(this);
        this._hideCard = this._hideCard.bind(this);
    }

    private _nextCard() {
        const quest = this.props.quests[this.props.quests.length - 1];

        if (this.state.currentCardIndex <= quest.teamMembers.length) {
            this.setState({
                currentCardIndex: this.state.currentCardIndex + 1,
                hiddenCardIndex: this.state.hiddenCardIndex
            });

            setTimeout(
                this._nextCard,
                1000);
        } else {
            setTimeout(
                this._hideCard,
                1200);
        }
    }

    private _hideCard() {
        const quest = this.props.quests[this.props.quests.length - 1];

        if (this.state.hiddenCardIndex <= quest.teamMembers.length) {
            this.setState({
                currentCardIndex: this.state.currentCardIndex,
                hiddenCardIndex: this.state.hiddenCardIndex + 1
            });

            if (this.state.hiddenCardIndex > quest.teamMembers.length) {
                this._nextState();
            } else {
                setTimeout(
                    this._hideCard,
                    400);
            }
        }
    }

    private _nextState() {
        this.props.MP.finishVoteQuestResult();
    }

    public componentDidMount() {
        if (this.props.state !== AvalonGameState.VoteQuestResult) {
            return;
        }
        setTimeout(
            this._nextCard,
            500);
    }

    public render() {
        if (this.props.state !== AvalonGameState.VoteQuestResult) {
            return null;
        }

        const votes = [];
        const quest = this.props.quests[this.props.quests.length - 1];
        let pass = 0;

        for (let i = 0; i < this.props.lobby.playerCount; i = i + 1) {
            if (quest.questVote[i] === true) {
                pass = pass + 1;
            }
        }

        for (let i = 0; i < quest.teamMembers.length; i = i + 1) {
            let sound = null;
            if (this.state.hiddenCardIndex === 0 && this.state.currentCardIndex - 1 === i) {
                const result = this.state.currentCardIndex <= pass;
                sound = (<Sound
                             url={ '/js' + (result ? PassSound : FailSound ) }
                             playStatus="PLAYING" />);
            }
            votes.push(
                <Grid.Column key={ 'quest-' + quest.quest + '-vote-' + i }>
                    <VoteQuestResultCard
                        key={ 'quest-' + quest.quest + '-card-' + i }
                        result={ pass > i }
                        flipped={ this.state.currentCardIndex > i }
                        hidden={ this.state.hiddenCardIndex > i } />
                    { sound }
                </Grid.Column>
            );
        }

        return (
            <div className="votequest-result">
                <Grid columns={ this.props.lobby.playerCount }
                      relaxed stackable stretched centered container>
                    <Grid.Row stretched>
                        { votes }
                    </Grid.Row>
                </Grid>
            </div>
        );
    }
}

export function AvalonHostMainPageView(props: AvalonViewPropsInterface) {
    const mp = props.MP;
    const quests = props.quests;

    //
    // Quest outcome popup.
    //

    let questOutcome = null;
    /* if (quests.length && props.notification === true) {
     *     if (quests[quests.length - 1].questStatus === AvalonQuestStatus.TeamRejected) {
     *         questOutcome = (
     *             <Notification hideAfter={ 2000 }>
     *                 <h1 className="outcome rejected">Team was <strong>rejected</strong>!</h1>
     *             </Notification>
     *         );
     *     } else if (quests[quests.length - 1].questStatus === AvalonQuestStatus.QuestFailed) {
     *         questOutcome = (
     *             <Notification hideAfter={ 2000 }>
     *                 <h1 className="outcome failed">Quest <strong>failed</strong>!</h1>
     *             </Notification>
     *         );
     *     } else if (quests[quests.length - 1].questStatus === AvalonQuestStatus.QuestSucceeded) {
     *         questOutcome = (
     *             <Notification hideAfter={ 2000 }>
     *                 <h1 className="outcome succeeded">Quest <strong>succeeded</strong>!</h1>
     *             </Notification>
     *         );
     *     }
     * }
     */
    //
    // Quest Grid.
    //

    const playersCount = props.lobby.playerCount;
    const required = AvalonQuestMembers[playersCount];
    const questGrid = [];
    const outcome = [];
    const questNumber = quests.length;

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
        } else if (i === props.currentQuest) {
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
            <Segment>{ props.status }</Segment>
            <div className="quest-grid">
                { questGrid }
            </div>
            { questOutcome }
            <PlayersList { ...props } />
            <VoteQuestResult key={ questNumber + '-' + props.state } { ...props} />
        </div>
    );

    return main;
}

export class AvalonHostMainPage extends React.Component<AvalonViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;


        return mp.getPluginView(
            'gameshell',
            'HostShell-Main',
            {
                'links': {
                    'home': {
                        'icon': 'gamepad',
                        'label': 'Avalon',
                        'view': AvalonHostMainPageView(this.props)
                    },
                    'quests': {
                        'icon': 'history',
                        'label': 'Quest History',
                        'view': AvalonQuests(this.props)
                    },
                    'newgame': {
                        'icon': 'cog',
                        'label': 'Settings',
                        'view': (<AvalonSettings { ...this.props } />)
                    },
                    'rules': {
                        'icon': 'book',
                        'label': 'Rules',
                        'view': <AvalonRules />
                    }
                },
                'topBarContent': 'Quest ' + (this.props.currentQuest + 1)
            });
    }
}
