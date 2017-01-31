/**
 * CoupAmbassador.tsx - Views relating to ambassador move.
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

class CoupAmbassadorCardChangePage extends React.Component<CoupViewPropsInterface, {
    cards: string[]
}> {
    constructor(props: any) {
        super(props);
        this.state = { cards: [] };
        this._selectCard = this._selectCard.bind(this);
        this._unselectCard = this._unselectCard.bind(this);
    }

    private _selectCard(choice: string, index: Number) {
        let cards = this.state.cards;
        for (let i = 0; i < cards.length; i++) {
            if (cards[i] === choice) {
                return;
            }
        }
        cards.push(choice);
        this.setState({ cards: cards });
        return true;
    }

    private _unselectCard(choice: string, index: Number) {
        const tr = [];
        for (let i = 0; i < this.state.cards.length; i++) {
            if (this.state.cards[i] !== choice) {
                tr.push(this.state.cards[i]);
            }
        }
        this.setState({ cards: tr });
        return true;
    }

    private _ambassadorAction() {
        this.props.MP.ambassadorAction(this.state.cards);
    }

    public render() {
        const drawCards = this.props.drawCards;
        const cards = this.props.cards;
        const choices = [];
        let neededCount = 0;

        choices.push(
            <li key='your-card' className='seperator'>Your cards</li>
        );

        for (let i = 0; i < cards.length; i = i + 1) {
            if (cards[i].state === CoupCardState.Active) {
                const card = (<CoupPlayerCard { ...this.props }
                                              card={ cards[i] }
                                              accent={ this.props.lobby.accent } />);
                choices.push(
                    <Choice key={ i }>
                        { card }
                    </Choice>
                );
                neededCount = neededCount + 1;
            }
        }

        choices.push(
            <li key='drawn-cards' className='seperator'>Drawn cards</li>
        );

        for (let i = 0; i < drawCards.length; i = i + 1) {
            const card = (<CoupPlayerCard { ...this.props }
                                          card={{ card: drawCards[i], state: CoupCardState.Active }}
                                          accent='#ffffff' />);

            choices.push(
                <Choice key={ i + cards.length }>
                    { card }
                </Choice>
            );
        }

        const button = (
            <button className='coup-action-choicelist-button'
                    disabled={ this.state.cards.length === neededCount ? false : true }
                    onClick={ this._ambassadorAction.bind(this) }>
                Pick these cards
            </button>
        );

        return (
            <div className='coup-ambassadorchoosecard'>
                <ChoiceList onSelect={ this._selectCard }
                            onUnselect={ this._unselectCard }
                            multi={ true }
                            selectedKeys={ this.state.cards }
                            className='coup-card-choicelist'
                            itemClassName='coup-card-choicelist-item'>
                    { choices }
                </ChoiceList>
                { button }
            </div>
        );
    }
}

export class CoupAmbassadorCardChange extends React.Component<CoupViewPropsInterface, {}> {
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
                        'view': (<CoupAmbassadorCardChangePage { ...this.props } />)
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
