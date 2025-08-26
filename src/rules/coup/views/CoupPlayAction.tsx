/**
 * CoupPlayAction.tsx - Views relating to PlayAction state.
 */

import * as React from 'react';

import {
    CoupAction,
    CoupCard,
    CoupActionInterface,
    CoupViewPropsInterface,
    CoupWaitContext
} from '../CoupTypes';

import {
    ChoiceList,
    Choice
} from '../../../client/components/ChoiceList';

import { hasCard } from '../CoupFunctions';

import { CoupGameRule } from './CoupRules';
import { CoupLastAction } from './CoupLastAction';
import { CoupNotification } from './CoupNotification';
import { CoupActionsHistory } from './CoupActionsHistory';
import { CoupClientCoins } from './CoupClientCoins';
import { CoupPlayersCards } from './CoupCards';
import { CoupWaitFor } from './CoupWait';

class CoupClientSelectAction extends React.Component<CoupViewPropsInterface, {
    action: CoupAction,
    player: string
}> {
    constructor(props: CoupViewPropsInterface) {
        super(props);
        this.state = {
            action: null,
            player: null
        };
        this._selectAction = this._selectAction.bind(this);
        this._selectPlayer = this._selectPlayer.bind(this);
    }

    private _selectAction(choice: string, index: number) {
        this.setState({
            action: CoupAction[choice],
            player: this.state.player
        });
        return true;
    }

    private _selectPlayer(choice: string, index: number) {
        this.setState({
            action: this.state.action,
            player: choice
        });
        return true;
    }

    private _takeAction() {
        return this.props.MP.takeAction(this.state.action, this.state.player)
    }

    public render() {
        const mp = this.props.MP;
        const { cards, coins, alivePlayers } = this.props;
        const choices = [];
        const playerChoices = [];

        for (let i = 0; i < alivePlayers.length; i = i + 1) {
            if (alivePlayers[i] === this.props.MP.clientId) {
                continue;
            }

            const player = this.props.MP.getPluginView(
                'lobby',
                'player-tag',
                {
                    clientId: alivePlayers[i],
                    invertColors: false
                }
            );

            playerChoices.push(
                <Choice key={ alivePlayers[i] }>
                    { player }
                </Choice>
            );
        }
        let playerChoicesStyle = { display: 'none' };
        let disabled = true;

        if (this.state.action) {
            disabled = false;
        }

        if (this.state.action === CoupAction.Assassin ||
            this.state.action === CoupAction.Captain ||
            this.state.action === CoupAction.Coup) {
            playerChoicesStyle = { display: 'block' };
            if (!this.state.player) {
                disabled = true;
            }
        }

        if (coins >= 7) {
            choices.push(
                <Choice key={ CoupAction[CoupAction.Coup] }>
                    Coup - Spend 7 coins and assassinate an opponent
                </Choice>
            );
        }

        if (coins < 10) {
            choices.push(
                <Choice key={ CoupAction[CoupAction.Income] }>
                    Income - Take 1 coin from the treasury
                </Choice>
            );
        }

        if (coins < 10) {
            choices.push(
                <Choice key={ CoupAction[CoupAction.ForeignAid] }>
                    ForeignAid - Take 2 coins from the treasury
                </Choice>
            );
        }

        if (coins < 10) {
            choices.push(
                <Choice key={ CoupAction[CoupAction.Duke] }
                        className={ hasCard(cards, CoupCard.Duke) ? '' : 'coup-action-choicelist-lie'}>
                    Duke - Take 3 coins from the treasury
                </Choice>
            );
        }

        if (coins >= 3 && coins < 10) {
            choices.push(
                <Choice key={ CoupAction[CoupAction.Assassin] }
                        className={ hasCard(cards, CoupCard.Assassin) ? '' : 'coup-action-choicelist-lie'}>
                    Assassin - Spend 3 coins to assassinate another player
                </Choice>
            );
        }

        if (coins < 10) {
            choices.push(
                <Choice key={ CoupAction[CoupAction.Captain] }
                        className={ hasCard(cards, CoupCard.Captain) ? '' : 'coup-action-choicelist-lie'}>
                    Captain - Steal 2 coins from another player
                </Choice>
            );
        }

        if (coins < 10) {
            choices.push(
                <Choice key={ CoupAction[CoupAction.Ambassador] }
                        className={ hasCard(cards, CoupCard.Ambassador) ? '' : 'coup-action-choicelist-lie'}>
                    Ambassador - Draw 2 character cards and choose any to replace
                </Choice>
            );
        }

        const button = (
            <button className='coup-action-choicelist-button'
                    disabled={ disabled }
                    onClick={ this._takeAction.bind(this) }>
                Take Action!
            </button>
        );

        return (
            <div>
                <ChoiceList onSelect={ this._selectAction }
                            selectedKey={ CoupAction[this.state.action] }
                            className='coup-action-choicelist'
                            itemClassName='coup-action-choicelist-item'>
                    { choices }
                </ChoiceList>
                <ChoiceList onSelect={ this._selectPlayer }
                            selectedKey={ this.state.player }
                            className='coup-action-choicelist'
                            itemClassName='coup-action-choicelist-item'
                            style={ playerChoicesStyle }>
                    { playerChoices }
                </ChoiceList>
                { button }
            </div>
        );
    }
}

function CoupClientPlayActionPage(props: CoupViewPropsInterface) {
    return (
        <div className='coup-client-playaction'>
            <CoupLastAction { ...props } />
            <CoupNotification { ...props } />
            <header>Select your action</header>
            <CoupClientSelectAction { ...props } />
        </div>
    );
}

export class CoupClientPlayAction extends React.Component<CoupViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;
        const actionsPage = CoupActionsHistory(this.props);

        return mp.getPluginView(
            'gameshell',
            'HostShell-Main',
            {
                'links': {
                    'home': {
                        'icon': 'gamepad',
                        'label': 'Coup',
                        'view': (<CoupClientPlayActionPage { ...this.props } />)
                    },
                    'cards': {
                        'icon': 'address-card',
                        'label': 'Cards',
                        'view': (<CoupPlayersCards { ...this.props } />)
                    },
                    'actionslist': {
                        'icon': 'list',
                        'label': 'Actions History',
                        'view': actionsPage
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

export class CoupHostPlayAction extends React.Component<CoupViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;
        const actionsPage = CoupActionsHistory(this.props);
        const waitId = this.props.waitForId ? this.props.waitForId : this.props.playerTurnId;

        const waitActionPage = (<CoupWaitFor { ...this.props }
                                             waitForId={ waitId }
                                             waitContext={ CoupWaitContext.PlayAction } />);

        return mp.getPluginView(
            'gameshell',
            'HostShell-Main',
            {
                'links': {
                    'home': {
                        'icon': 'home',
                        'label': 'Home',
                        'view': waitActionPage
                    },
                    'clients': {
                        'icon': 'users',
                        'label': 'Players',
                        'view': mp.getPluginView('lobby', 'host-roommanagement')
                    },
                    'actionslist': {
                        'icon': 'list',
                        'label': 'Actions History',
                        'view': actionsPage
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
