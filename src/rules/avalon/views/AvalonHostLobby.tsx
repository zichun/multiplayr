/**
 * AvalonHostLobby.tsx
 */

import * as React from 'react';

import {
    MPType,
    ViewPropsInterface
} from '../../../common/interfaces';

import { AvalonRules } from './AvalonCommonViews';

import { faHome, faUsers, faBook } from '@fortawesome/free-solid-svg-icons';

export class AvalonHostLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;

        return mp.getPluginView(
            'gameshell',
            'HostShell-Main',
            {
                'links': {
                    'home': {
                        'icon': faHome,
                        'label': 'Home',
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
                        'view': <AvalonRules />
                    }
                }
            });
    }
}

export default AvalonHostLobby;
