/**
 * CoupPlayReaction.tsx - Views relating to PlayReaction state. This is the state where
 * players react to an action with challenge or block.
 */

import * as React from 'react';

import {
    CoupAction,
    CoupReaction,
    CoupActionInterface,
    CoupViewPropsInterface
} from '../CoupTypes';

import {
    ChoiceList,
    Choice
} from '../../../client/components/ChoiceList';

import { CoupGameRule } from './CoupRules';
import { CoupLastAction } from './CoupLastAction';
import { CoupActionsHistory } from './CoupActionsHistory';
import { CoupClientCoins } from './CoupClientCoins';
import { CoupPlayersCards } from './CoupCards';

class CoupHostPlayReactionPage extends React.Component<CoupViewPropsInterface, { timeLeft: number }> {

    private _interval;

    constructor(props: CoupViewPropsInterface) {
        super(props);
        this.state = { timeLeft: 40 };
        this._tick = this._tick.bind(this);
    }

    private _tick() {
        if (this.state.timeLeft > 0) {
            this.setState({ timeLeft: this.state.timeLeft - 1});
        } else {
            this.props.MP.endChallengePhase();
        }
    }

    public componentWillUnmount() {
        if (this._interval) {
            clearInterval(this._interval);
        }
    }

    public componentDidMount() {
        this._interval = setInterval(this._tick, 1000);
    }

    private _endChallenge() {
        this.props.MP.endChallengePhase();
    }

    public render() {
        const mp = this.props.MP;
        const button = (
            <button className='coup-button'
                    onClick={ this._endChallenge.bind(this) }>
                End Challenge Phase ({ this.state.timeLeft })
            </button>);

        return (
            <div>
                <CoupLastAction { ...this.props } />
                { button }
            </div>
        );
    }
}

class CoupClientPlayReactionPage extends React.Component<CoupViewPropsInterface, { reaction: CoupReaction }> {
    constructor(props: CoupViewPropsInterface) {
        super(props);
        this.state = { reaction: null };
        this._selectReaction = this._selectReaction.bind(this);
    }

    private _selectReaction(choice: string, index: number) {
        this.setState({ reaction: CoupReaction[choice] });
        return true;
    }

    private _takeReaction() {
        this.props.MP.takeReaction(this.state.reaction);
    }

    public render() {
        const actions = this.props.actions;
        const { action, block, challenge, targetId } = actions[actions.length - 1];
        const choices = [];


        if (action === CoupAction.ForeignAid && !block) {
            choices.push(
                <Choice key={ CoupReaction[CoupReaction.Block] }>
                    Block
                </Choice>
            );
        } else {

            if (!challenge) {
                choices.push(
                    <Choice key={ CoupReaction[CoupReaction.Challenge] }>
                        Challenge
                    </Choice>
                );
            }

            if (targetId === this.props.MP.clientId &&
                !challenge &&
                !block) {

                choices.push(
                    <Choice key={ CoupReaction[CoupReaction.Block] }>
                        Block
                    </Choice>
                );
            }
        }

        const button = (
            <button className='coup-action-choicelist-button'
                    style={ this.state.reaction ? { display: 'block' } : { display: 'none' } }
                    onClick={ this._takeReaction.bind(this) }>
                Confirm { CoupReaction[this.state.reaction] } Reaction!
            </button>
        );

        return (
            <div>
                <CoupLastAction { ...this.props } />
                <header>Select your reaction</header>
                <ChoiceList onSelect={ this._selectReaction }
                            selectedKey={ CoupReaction[this.state.reaction] }>
                    { choices }
                </ChoiceList>
                { button }
            </div>
        );
    }
}

export class CoupHostPlayReaction extends React.Component<CoupViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;
        const playReactionPage = (<CoupHostPlayReactionPage { ...this.props }
                                                            key={ this.props.playerTurnId + Math.random() } />);

        return mp.getPluginView(
            'gameshell',
            'HostShell-Main',
            {
                'links': {
                    'home': {
                        'icon': 'home',
                        'label': 'Home',
                        'view': playReactionPage
                    },
                    'clients': {
                        'icon': 'users',
                        'label': 'Players',
                        'view': mp.getPluginView('lobby', 'host-roommanagement')
                    },
                    'actionslist': {
                        'icon': 'list',
                        'label': 'Actions History',
                        'view': CoupActionsHistory(this.props)
                    },
                    'rules': {
                        'icon': 'book',
                        'label': 'Rules',
                        'view': CoupGameRule
                    }
                }
            });
    }
}

export class CoupClientPlayReaction extends React.Component<CoupViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;

        return mp.getPluginView(
            'gameshell',
            'HostShell-Main',
            {
                'links': {
                    'home': {
                        'icon': 'gamepad',
                        'label': 'Coup',
                        'view': (<CoupClientPlayReactionPage { ...this.props } />)
                    },
                    'cards': {
                        'icon': 'address-card',
                        'label': 'Cards',
                        'view': (<CoupPlayersCards { ...this.props } />)
                    },
                    'actionslist': {
                        'icon': 'list',
                        'label': 'Actions History',
                        'view': CoupActionsHistory(this.props)
                    },
                    'rules': {
                        'icon': 'book',
                        'label': 'Rules',
                        'view': CoupGameRule
                    }
                },
                'topBarContent': (<CoupClientCoins { ...this.props } />)
            });
    }
}
