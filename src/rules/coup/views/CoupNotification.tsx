/**
 * CoupNotification.tsx - Views relating to notification
 */

import * as React from 'react';
import * as Sound from 'react-sound';

import {
    CoupViewPropsInterface,
    CoupWaitContext
} from '../CoupTypes';

import {
    Notification
} from '../../../client/components/Notification';

export function CoupNotification(
    props: CoupViewPropsInterface
) {
    const actions = props.actions;

    if (actions.length === 0) {
        return null;
    } else {
        const lastAction = actions[actions.length - 1];

        let coins = 0;
        let cards = 0;

        for (let i = 0; i < lastAction.outcomes.length; i = i + 1) {
            if (lastAction.outcomes[i].clientId === props.MP.clientId) {
                coins = coins + (lastAction.outcomes[i].coins || 0);
                cards = cards + (lastAction.outcomes[i].cards || 0);
            }
        }

        if (coins) {
            let coinsDelta = '';
            let sound = null;

            if (coins > 0) {
                coinsDelta = '+' + coins;
                sound = (
                    <Sound
                        url={ 'gamerules/coup/sounds/coin' + coins + '.mp3' }
                        playStatus={ Sound.status.PLAYING } />);


            } else {
                coinsDelta = '-' + (-coins);
            }

            if (coins > 1 || coins < -1) {
                coinsDelta += ' coins';
            } else {
                coinsDelta += ' coin';
            }

            return (
                <Notification>
                    { sound }
                    <h1>{ coinsDelta }</h1>
                </Notification>
            );
        }

        if (cards) {
            let sound = null;
            let cardsDelta = '';
            if (cards > 0) {
                cardsDelta = '+' + cards;

                sound = (
                    <Sound
                        url='gamerules/coup/sounds/ambassador.mp3'
                        playStatus={ Sound.status.PLAYING } />);
            } else {
                cardsDelta = '-' + (-cards);

                sound = (
                    <Sound
                        url='gamerules/coup/sounds/card.mp3'
                        playStatus={ Sound.status.PLAYING } />);
            }

            if (cards > 1 || cards < -1) {
                cardsDelta += ' cards';
            } else {
                cardsDelta += ' card';
            }

            return (
                <Notification>
                    { sound }
                    <h1>{ cardsDelta }</h1>
                </Notification>
            );
        }

        return null;
    }
}

export default CoupNotification;
