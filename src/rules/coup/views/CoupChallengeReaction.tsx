/**
 * CoupChallengeReaction.tsx - Views relating to Challenge outcomes - after a challenge, the challenged player
 * must pick a card to reveal. If the challenge fails, the challenge issuer must pick a card to discard.
 */

import * as React from 'react';

import {
    CoupAction,
    CoupReaction,
    CoupActionInterface,
    CoupViewPropsInterface,
    CoupCardState
} from '../CoupTypes';

import {
    ChoiceList,
    Choice
} from '../../../client/components/ChoiceList';

import { CoupGameRule } from './CoupRules';
import { CoupLastAction } from './CoupLastAction';
import { CoupActionsHistory } from './CoupActionsHistory';
import { CoupClientCoins } from './CoupClientCoins';
import { CoupPlayersCards, CoupPlayerCard } from './CoupCards';

class CoupClientChooseLoseInfluencePage extends React.Component<CoupViewPropsInterface & {
    additionalText?: string
}, {
    card: string
}> {
    constructor(props: CoupViewPropsInterface) {
        super(props);
        this.state = { card: null };
        this._selectCard = this._selectCard.bind(this);
    }

    private _selectCard(choice: string, index: number) {
        this.setState({ card: choice });
        return true;
    }

    private _revealCard() {
        this.props.MP.revealCard(this.state.card);
    }

    public render() {
        const mp = this.props.MP;
        const cards = this.props.cards;
        const choices = [];

        for (let i = 0; i < cards.length; i = i + 1) {
            if (cards[i].state !== CoupCardState.Active) {
                continue;
            }
            const card = (
                <CoupPlayerCard { ...this.props }
                                card={ cards[i] }
                                accent={ this.props.lobby.accent } />);
            choices.push(
                <Choice key={ i }>
                    { card }
                </Choice>
            );
        }

        const button = (
            <button className='coup-action-choicelist-button'
                    disabled={ this.state.card === null ? true : false }
                    onClick={ this._revealCard.bind(this) }>
                Reveal this card
            </button>
        );

        return (
            <div className='coup-chooseloseinfluence'>
                <CoupLastAction { ...this.props } />
                { this.props.additionalText }
                <ChoiceList onSelect={ this._selectCard }
                            selectedKey={ this.state.card }
                            className='coup-card-choicelist'
                            itemClassName='coup-card-choicelist-item'>
                    { choices }
                </ChoiceList>
                { button }
            </div>
        );
    }
}

export class CoupClientChallengeReaction extends React.Component<CoupViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;
        const additionalText = 'You have been challenged. If you choose to reveal the right card, you\'ll win the challenge and the card will be replaced. Otherwise, you\'ll lose the revealed card.';
        const chooseLoseInfluencePage = (<CoupClientChooseLoseInfluencePage { ...this.props }
                                                                            additionalText={ additionalText } />);
        return mp.getPluginView(
            'gameshell',
            'HostShell-Main',
            {
                'links': {
                    'home': {
                        'icon': 'gamepad',
                        'label': 'Coup',
                        'view': chooseLoseInfluencePage
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

export class CoupClientLoseInfluence extends React.Component<CoupViewPropsInterface & {}, {}> {
    public render() {
        const mp = this.props.MP;
        const additionalText = 'You have lost a challenge. Choose a card to reveal.';
        const chooseLoseInfluencePage = (<CoupClientChooseLoseInfluencePage { ...this.props }
                                                                            additionalText={ additionalText } />);

        return mp.getPluginView(
            'gameshell',
            'HostShell-Main',
            {
                'links': {
                    'home': {
                        'icon': 'gamepad',
                        'label': 'Coup',
                        'view': chooseLoseInfluencePage
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
