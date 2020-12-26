import * as React from 'react';

import {
    ViewPropsInterface
} from '../../../common/interfaces';

import { DecryptoGameRule } from './DecryptoRules';
import { TeamColors } from '../DecryptoCommon';
import { faUsers, faHome, faBook, faIdCard } from '@fortawesome/free-solid-svg-icons';

export class DecryptoHostLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;

        return mp.getPluginView(
            'gameshell',
            'HostShell-Main',
            {
                'links': {
                    'home': {
                        'icon': faHome,
                        'label': 'Lobby',
                        'view': mp.getPluginView('lobby', 'Lobby')
                    },
                    'clients': {
                        'icon': faUsers,
                        'label': 'Players',
                        'view': mp.getPluginView('lobby', 'host-roommanagement')
                    },
                    'rules': {
                        'icon': faBook,
                        'label': 'Rules',
                        'view': DecryptoGameRule
                    }
                }
        });
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
                        'icon': faIdCard,
                        'label': 'Lobby',
                        'view': mp.getPluginView('lobby', 'SetName', { colors: TeamColors })
                    },
                    'rules': {
                        'icon': faBook,
                        'label': 'Rules',
                        'view': DecryptoGameRule
                    }
                }
        });
    }
}
