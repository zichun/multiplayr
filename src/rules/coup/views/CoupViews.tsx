/**
 * CoupViews.tsx - Collection of views for Coup
 */

import * as React from 'react';

import {
    MPType,
    ViewPropsInterface
} from '../../../common/interfaces';

import { CoupGameRule } from './CoupRules';
export { CoupGameRule } from './CoupRules';

export class CoupHostLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;

        return mp.getPluginView(
            'gameshell',
            'HostShell-Main',
            {
                'links': {
                    'home': {
                        'icon': 'home',
                        'label': 'Home',
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
                        'view': CoupGameRule
                    }
                }
            });
    }
}
