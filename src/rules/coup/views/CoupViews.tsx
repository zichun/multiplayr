/**
 * CoupViews.tsx - Collection of views for Coup
 */

import * as React from 'react';

import {
    MPType,
    ViewPropsInterface
} from '../../../common/interfaces';

import { CoupGameRule } from './CoupRules';
import { faHome, faUsers, faBook } from '@fortawesome/free-solid-svg-icons';

export class CoupHostLobby extends React.Component<ViewPropsInterface, {}> {
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
                        'view': CoupGameRule
                    }
                }
            });
    }
}

export { CoupGameRule } from './CoupRules';
export { CoupLastAction } from './CoupLastAction';
export { CoupActionsHistory } from './CoupActionsHistory';
export { CoupClientPlayAction, CoupHostPlayAction } from './CoupPlayAction';
export { CoupClientPlayReaction, CoupHostPlayReaction } from './CoupPlayReaction';
export { CoupWaitFor, CoupClientWaitForAction } from './CoupWait';
export { CoupPlayerCard, CoupPlayerCards, CoupPlayersCards } from './CoupCards';
export { CoupClientCoins } from './CoupClientCoins';
export { CoupClientChallengeReaction, CoupClientLoseInfluence } from './CoupChallengeReaction';
export { CoupAmbassadorCardChange } from './CoupAmbassador';
export { CoupClientDead, CoupClientShowWinner, CoupHostShowWinner } from './CoupWinLose';
