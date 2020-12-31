import * as React from 'react';

import {
    ViewPropsInterface
} from '../../../common/interfaces';

import { DecryptoGameRule } from './DecryptoRules';
import { TeamColors } from '../DecryptoCommon';

export class DecryptoHostLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;

        return mp.getPluginView(
            'gameshell',
            'HostShell-Main',
            {
                'links': {
                    'home': {
                        'icon': 'home',
                        'label': 'Lobby',
                        'view': mp.getPluginView('lobby', 'Lobby')
                    },
                    'clients': {
                        'icon': 'users',
                        'label': 'Players',
                        'view': mp.getPluginView('lobby', 'host-roommanagement')
                    },
                    'rules': {
                        'icon': 'book',
                        'label': 'Rules',
                        'view': DecryptoGameRule
                    }
                }
            }
        );
    }
}

export class DecryptoClientLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;

        return mp.getPluginView(
            'gameshell',
            'HostShell-Main',
            {
                'links': {
                    'home': {
                        'icon': 'id-card',
                        'label': 'Lobby',
                        'view': mp.getPluginView('lobby', 'SetName', { colors: TeamColors })
                    },
                    'rules': {
                        'icon': 'book',
                        'label': 'Rules',
                        'view': DecryptoGameRule
                    }
                }
        });
    }
}
