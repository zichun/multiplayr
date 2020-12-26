/**
 * CoupCards.tsx - Views relating to rendering players' cards
 */

import * as React from 'react';
import * as colorsys from 'colorsys';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDollarSign } from '@fortawesome/free-solid-svg-icons';

import {
    CoupViewPropsInterface,
    CoupCardState,
    CoupCard
} from '../CoupTypes';

import {
    forEach
} from '../../../common/utils';

export function CoupPlayerCard(props: CoupViewPropsInterface & {
    card: any,
    accent: string
}) {
    const card = props.card;
    const cardName = CoupCard[card.card];
    let footer = null;

    if (card.state !== CoupCardState.Active) {
        footer = (
            <footer className={ CoupCardState[card.state] }>
                { CoupCardState[card.state] }
            </footer>
        );
    }

    return (
        <div className={ 'coup-card ' + cardName }>
            <header style={{ backgroundColor: props.accent }}>
                { cardName }
            </header>
            { footer }
        </div>
    );
}

export function CoupPlayerCards(props: CoupViewPropsInterface & {
    accent: string,
    clientId: string
}) {
    const cards = props.cards;
    const coins = props.coins;
    const accentHsv = colorsys.hex_to_hsv(props.accent);
    const accent = props.accent;
    /* const accent = colorsys.hsv_to_hex({
     *     h: accentHsv.h,
     *     s: accentHsv.s / 1.5,
     *     v: accentHsv.v
     * });*/
    const accentLight = colorsys.hsv_to_hex({
        h: accentHsv.h,
        s: accentHsv.s / 4,
        v: 100
    });

    const cardsEl = [];
    const playerTag =  props.MP.getPluginView(
        'lobby',
        'player-tag',
        {
            clientId: props.clientId,
            size: 'medium',
            invertColors: true,
            className: 'coup-player-cards-tag'
        }
    );

    const coinsEl = (
        <div className='coup-player-coin'
             style={{ backgroundColor: accent }}>
            <FontAwesomeIcon icon={ faDollarSign } />
        &nbsp;
        { props.coins }
        </div>
    );


    for (let i = 0; i < cards.length; i = i + 1) {
        const cardName = CoupCard[cards[i].card];
        cardsEl.push(
            <CoupPlayerCard { ...props }
                            card={ cards[i] }
                            accent={ accentLight }
                            key={'card' + i} />);
    }

    return (
        <div className='coup-player-cards'
             key={ 'player-cards-' + props.clientId }>
            { playerTag }
            { coinsEl }
            <div />
            <div className='coup-player-cards-container'
                 style={{ borderColor: accent,
                          backgroundColor: accent }}>
                { cardsEl }
            </div>
        </div>
    );
}

export class CoupPlayersCards extends React.Component<CoupViewPropsInterface & {
    lobby: any
}, {}> {
    public render() {
        const mp = this.props.MP;
        const playersCards = this.props.playersCards;
        const playersCoins = this.props.playersCoins;

        let i = 0;
        for (i = 0; i < this.props.lobby.clientIds.length; i = i + 1) {
            if (this.props.MP.clientId === this.props.lobby.clientIds[i]) {
                break;
            }
        }

        const myCard = (<CoupPlayerCards { ...this.props }
                                         clientId={ this.props.MP.clientId }
                                         accent={ this.props.lobby.accents[i] } />)

        const separator = (<div className='coup-seperator'>&nbsp;</div>);

        const playersCardsEl = [];

        forEach(
            playersCards,
            (clientId, cards) => {
                let i = 0;
                for (i = 0; i < this.props.lobby.clientIds.length; i = i + 1) {
                    if (clientId === this.props.lobby.clientIds[i]) {
                        break;
                    }
                }

                playersCardsEl.push(
                    <CoupPlayerCards { ...this.props }
                                     clientId={ clientId }
                                     coins={ playersCoins[clientId] }
                                     cards={ cards }
                                     accent={ this.props.lobby.accents[i] }
                                     key={ 'player-card-' + clientId } />);
            });

        return (
            <div className='coup-players-cards'>
                { myCard }
                { separator }
                { playersCardsEl }
            </div>
        );
    }
}
