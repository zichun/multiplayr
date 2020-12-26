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

import { faExclamationTriangle, faAddressCard, faList, faBook, faGamepad, faHome, faUsers } from '@fortawesome/free-solid-svg-icons';

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
                        'icon': faExclamationTriangle,
                        'label': 'Coup',
                        'view': 'You Are Dead'
                    },
                    'cards': {
                        'icon': faAddressCard,
                        'label': 'Cards',
                        'view': (<CoupPlayersCards { ...this.props } />)
                    },
                    'actionslist': {
                        'icon': faList,
                        'label': 'Actions History',
                        'view': (<CoupActionsHistory { ...this.props } />)
                    },
                    'rules': {
                        'icon': faBook,
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
                        'icon': faGamepad,
                        'label': 'Coup',
                        'view': (<CoupShowWinnerPage { ...this.props } />)
                    },
                    'cards': {
                        'icon': faAddressCard,
                        'label': 'Cards',
                        'view': (<CoupPlayersCards { ...this.props } />)
                    },
                    'actionslist': {
                        'icon': faList,
                        'label': 'Actions History',
                        'view': (<CoupActionsHistory { ...this.props } />)
                    },
                    'rules': {
                        'icon': faBook,
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
                        'icon': faHome,
                        'label': 'Home',
                        'view': (
                            <div>
                                <CoupShowWinnerPage { ...this.props } />
                                { button }
                            </div>
                        )
                    },
                    'clients': {
                        'icon': faUsers,
                        'label': 'Players',
                        'view': mp.getPluginView('lobby', 'host-roommanagement')
                    },
                    'actionslist': {
                        'icon': faList,
                        'label': 'Actions History',
                        'view': (<CoupActionsHistory { ...this.props } />)
                    },
                    'rules': {
                        'icon': faBook,
                        'label': 'Rules',
                        'view': CoupGameRule
                    }
                }
            });
    }
}

