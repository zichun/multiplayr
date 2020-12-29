/**
 * CoupNotification.tsx - Views relating to notification
 */

import * as React from 'react';
import Sound from 'react-sound';

import {
    CoupViewPropsInterface,
    CoupWaitContext
} from '../CoupTypes';

import {
    Notification
} from '../../../client/components/Notification';

import Coin1Sound from '../sounds/coin1.mp3';
import Coin2Sound from '../sounds/coin2.mp3';
import Coin3Sound from '../sounds/coin3.mp3';
import CardSound from '../sounds/card.mp3';
import AmbassadorSound from '../sounds/ambassador.mp3';

const COIN_SOUNDS = {
    1: Coin1Sound,
    2: Coin2Sound,
    3: Coin3Sound
};

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
                        url={ COIN_SOUNDS[coins] }
                        playStatus="PLAYING" />);


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
                        url={ AmbassadorSound }
                        playStatus="PLAYING" />);
            } else {
                cardsDelta = '-' + (-cards);

                sound = (
                    <Sound
                        url={ CardSound }
                        playStatus="PLAYING" />);
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
