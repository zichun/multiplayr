/**
 * CoupWait.tsx - Views relating to rendering [waiting for xyz to play]
 */

import * as React from 'react';

import {
    CoupViewPropsInterface,
    CoupWaitContext
} from '../CoupTypes';

import { CoupClientCoins } from './CoupClientCoins';
import { CoupLastAction } from './CoupLastAction';
import { CoupGameRule } from './CoupRules';
import { CoupActionsHistory } from './CoupActionsHistory';
import { CoupPlayersCards } from './CoupCards';

export function CoupWaitFor(props: CoupViewPropsInterface) {
    const mp = props.MP;

    if (props.waitContext === CoupWaitContext.ChallengeOrBlock) {
        return (
            <div>
                <CoupLastAction { ...props } />
                { props.waitAdditionalText }
                Waiting for other players to challenge or block.
            </div>
        );
    } else {
        const player = props.MP.getPluginView(
            'lobby',
            'player-tag',
            {
                clientId: props.waitForId,
                invertColors: true
            }
        );

        let waitingAction = null;
        if (props.waitContext === CoupWaitContext.PlayAction) {
            waitingAction = (<span>make a move</span>);
        } else if (props.waitContext === CoupWaitContext.ChallengeFail) {
            waitingAction = (<span>pick a character card to reveal</span>);
        } else if (props.waitContext === CoupWaitContext.AmbassadorChooseCard) {
            waitingAction = (<span>swap character cards (Ambassador)</span>);
        } else if (props.waitContext === CoupWaitContext.ChallengeReaction) {
            waitingAction = (<span>reveal challenged card</span>);
        }

        return (
            <div>
                <CoupLastAction { ...props } />
                { props.waitAdditionalText }
                Waiting for { player } to { waitingAction }.
            </div>
        );
    }
}

export class CoupClientWaitForAction extends React.Component<CoupViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;
        const cards = null;
        const actionsPage = CoupActionsHistory(this.props);

        return mp.getPluginView(
            'gameshell',
            'HostShell-Main',
            {
                'links': {
                    'home': {
                        'icon': 'gamepad',
                        'label': 'Coup',
                        'view': (<CoupWaitFor { ...this.props } />)
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
