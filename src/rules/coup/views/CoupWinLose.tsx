/**
 * CoupWinLose.tsx - Views relating to winning / losing endstate.
 */

import * as React from 'react';

import {
    CoupViewPropsInterface,
} from '../CoupTypes';

import { CoupGameRule } from './CoupRules';
import { CoupActionsHistory } from './CoupActionsHistory';
import { CoupPlayersCards } from './CoupCards';
import { CoupClientCoins } from './CoupClientCoins';

function CoupShowWinnerPage(props: CoupViewPropsInterface) {
    const mp = props.MP;

    const player = props.MP.getPluginView(
        'lobby',
        'player-tag',
        {
            clientId: props.winner,
            invertColors: true
        }
    );

    return (
        <div>
            { player } has won!
        </div>
    );
}

export class CoupClientDead extends React.Component<CoupViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;

        return mp.getPluginView(
            'gameshell',
            'HostShell-Main',
            {
                'links': {
                    'home': {
                        'icon': 'exclamation-triangle',
                        'label': 'Coup',
                        'view': 'You Are Dead'
                    },
                    'cards': {
                        'icon': 'address-card',
                        'label': 'Cards',
                        'view': (<CoupPlayersCards { ...this.props } />)
                    },
                    'actionslist': {
                        'icon': 'list',
                        'label': 'Actions History',
                        'view': (<CoupActionsHistory { ...this.props } />)
                    },
                    'rules': {
                        'icon': 'book',
                        'label': 'Rules',
                        'view': CoupGameRule
                    }
                },
                'topBarContent': 'xxx'
            });
    }
}

export class CoupClientShowWinner extends React.Component<CoupViewPropsInterface, {}> {
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
                        'view': (<CoupShowWinnerPage { ...this.props } />)
                    },
                    'cards': {
                        'icon': 'address-card',
                        'label': 'Cards',
                        'view': (<CoupPlayersCards { ...this.props } />)
                    },
                    'actionslist': {
                        'icon': 'list',
                        'label': 'Actions History',
                        'view': (<CoupActionsHistory { ...this.props } />)
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

export class CoupHostShowWinner extends React.Component<CoupViewPropsInterface, {}> {
    private _newGame() {
        this.props.MP.newGame();
    }
    public render() {
        const mp = this.props.MP;

        const button = (
            <button className='coup-button'
                    onClick={ this._newGame.bind(this) }>
                New Game!
            </button>);

        return mp.getPluginView(
            'gameshell',
            'HostShell-Main',
            {
                'links': {
                    'home': {
                        'icon': 'home',
                        'label': 'Home',
                        'view': (
                            <div>
                                <CoupShowWinnerPage { ...this.props } />
                                { button }
                            </div>
                        )
                    },
                    'clients': {
                        'icon': 'users',
                        'label': 'Players',
                        'view': mp.getPluginView('lobby', 'host-roommanagement')
                    },
                    'actionslist': {
                        'icon': 'list',
                        'label': 'Actions History',
                        'view': (<CoupActionsHistory { ...this.props } />)
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

