/**
 * CoupFunctions.ts - Helper functions for Coup.
 */

import * as React from 'react';

import {
    CoupGameState,
    CoupAction,
    CoupReaction,
    CoupCard,
    CoupCardState,
    CoupWaitContext,
    CoupActionInterface
} from './CoupTypes';

import {
    MPType
} from '../../common/interfaces';

import {
    shuffle,
} from '../../common/utils';

/**
 * Generate a new deck of cards - 3 of Duke, Assassin, Contessa, Captain, Ambassador.
 */
export function newDeck() {
    const deck: CoupCard[] = [];

    for (let i = 0; i < 3; i = i + 1) {
        deck.push(CoupCard.Duke);
        deck.push(CoupCard.Assassin);
        deck.push(CoupCard.Contessa);
        deck.push(CoupCard.Captain);
        deck.push(CoupCard.Ambassador);
    }

    shuffle(deck);

    return deck;
}

/**
 * Move state to the next player's turn
 */
export function nextTurn(
    mp: MPType
) {
    let currentPlayerTurn = mp.getData('playerTurn');
    const initPlayerTurn = currentPlayerTurn;
    const playersCount = mp.playersCount();
    let nextPlayerTurn = null;
    let firstNotDead = null;
    let meetInit = false;

    let aliveCount = 0;

    mp.playersForEach(
        (clientId, index) => {
            if (!mp.getPlayerData(clientId, 'isDead')) {
                aliveCount++;
            }
        });

    if (aliveCount === 1) {
        mp.setData('gameState', CoupGameState.GameOver);
        return;
    }

    mp.playersForEach(
        (clientId, index) => {
            const isDead = mp.getPlayerData(clientId, 'isDead');
            if (isDead) {
                return;
            }

            if (index === initPlayerTurn) {
                meetInit = true;
                return;
            }

            if (!meetInit && !isDead && firstNotDead === null) {
                firstNotDead = index;
            }

            if (meetInit && !isDead && nextPlayerTurn === null) {
                nextPlayerTurn = index;
            }
        });

    if (nextPlayerTurn === null && firstNotDead !== null) {
        nextPlayerTurn = firstNotDead;
    }

    if (nextPlayerTurn !== null) {
        mp.setData('gameState', CoupGameState.PlayAction);
        mp.setData('playerTurn', nextPlayerTurn);
    }
}

/**
 * Renders and add a given action to a list.
 */
export function addActions(
    mp: MPType,
    action: CoupActionInterface,
    actionsEl: any[],
    index: number = 0
) {
    const { clientId, targetId, challenge, block, challengeLoser, challengeResult, challengeWinner, challengeCauseDead, complete } = action;
    const playerTag = mp.getPluginView(
        'lobby',
        'player-tag',
        { clientId: clientId });

    let targetTag = null;
    if (targetId) {
        targetTag = mp.getPluginView(
            'lobby',
            'player-tag',
            { clientId: targetId });
    }

    if (action.action === CoupAction.Income) {
        actionsEl.push(
            <li className='coup-actionslist-item Income'
                key={ 'action-' + index }>
                { playerTag } played <strong>Income</strong>, +1 coin.
            </li>
        );
    } else {
        let against: any = '.';

        if (action.action === CoupAction.Captain ||
            action.action === CoupAction.Assassin ||
            action.action === CoupAction.Coup) {

            against = (
                <span>
                    &nbsp;against { targetTag }.
                </span>
            );
        }
        actionsEl.push(
            <li className='coup-actionslist-item { CoupAction[action.action] }'
                key={ 'action-' + index }>
                { playerTag } played <strong>{ CoupAction[action.action] }</strong>{ against }
            </li>
        );
    }

    let blockPlayerTag = null;

    if (block) {
        blockPlayerTag = mp.getPluginView(
            'lobby',
            'player-tag',
            {
                clientId: block
            }
        );
        actionsEl.push(
            <li className='coup-actionslist-item Block subitem'
                key={ 'action-block-' + index }>
                { blockPlayerTag } blocked the attempt.
            </li>
        );
    }

    let challengeLoserTag = null;
    if (challengeLoser) {
        challengeLoserTag = mp.getPluginView(
            'lobby',
            'player-tag',
            {
                clientId: challengeLoser
            }
        );
    }

    if (challenge) {
        const challengePlayerTag = mp.getPluginView(
            'lobby',
            'player-tag',
            {
                clientId: challenge
            }
        );

        let blockOrAction = 'action';
        if (block) {
            blockOrAction = 'block';
        }

        let challengeResultText: any = '.';
        if (challengeResult === false) {
            challengeResultText = (<span>, and <strong>failed</strong>!</span>);
        } else if (challengeResult === true) {
            challengeResultText = (<span>, and <strong>succeeded</strong>!</span>);
        }

        actionsEl.push(
            <li className='coup-actionslist-item Challenge subitem'
                key={ 'action-challenge-' + index }>
                { challengePlayerTag } challenged the { blockOrAction }{ challengeResultText }
            </li>);

        if (challengeWinner) {
            const challengeWinnerTag = mp.getPluginView(
                'lobby',
                'player-tag',
                {
                    clientId: challengeWinner
                }
            );

            actionsEl.push(
                <li className='coup-actionslist-item Challenge subitem'
                    key={ 'action-challengewinner-' + index }>
                    As a result of the challenge, { challengeWinnerTag } replaced the challenged card.
                </li>);
        }

        if (challengeLoser) {

            actionsEl.push(
                <li className='coup-actionslist-item ChallengeLoseCard subitem'
                    key={ 'action-challenge-lose-' + index }>
                    { challengeLoserTag } loses one character card.
                </li>
            );
        }
    }

    if (complete) {
        switch(action.action) {
            case CoupAction.Duke:
                actionsEl.push(
                    <li className='coup-actionslist-item Duke subitem'
                        key={ 'action-result-' + index }>
                        { playerTag } +3 coins.
                    </li>
                );
                break;

            case CoupAction.Assassin:
                actionsEl.push(
                    <li className='coup-actionslist-item Coup subitem'
                        key={ 'action-result-' + index }>
                        { targetTag } loses one character card to an assassination.
                    </li>
                );
                break;

            case CoupAction.Coup:
                actionsEl.push(
                    <li className='coup-actionslist-item Coup subitem'
                        key={ 'action-result-' + index }>
                        { targetTag } loses one character card to a coup.
                    </li>
                );
                break;

            case CoupAction.ForeignAid:
                actionsEl.push(
                    <li className='coup-actionslist-item ForeignAid subitem'
                        key={ 'action-result-' + index }>
                        { playerTag } +2 coins.
                    </li>
                );
                break;

            case CoupAction.Captain:
                actionsEl.push(
                    <li className='coup-actionslist-item Captain subitem'
                        key={ 'action-result-' + index }>
                        { playerTag } stole { action.coinStolen } coins from { targetTag }.
                    </li>
                );
                break;

            case CoupAction.Ambassador:
                actionsEl.push(
                    <li className='coup-actionslist-item Ambassador subitem'
                        key={ 'action-result-' + index }>
                        { playerTag } swapped cards.
                    </li>
                );
                break;
        }
    }

    if (challengeCauseDead) {
        actionsEl.push(
            <li className='coup-actionslist-item ChallengeDead subitem'
                key={ 'action-challenge-dead-' + index }>
                { challengeLoserTag } has no more character cards, and is out of the game!
            </li>
        );
    }
}

/**
 * When a challenge succeeded, this function places the revealed card back into the deck,
 * shuffles, and draws a replacement card.
 */
export function replaceChallengedCard(
    mp: MPType,
    clientId: string,
    cardNum: number
) {
    const cards = mp.getPlayerData(clientId, 'cards');
    const deck = mp.getData('deck');
    let found = false;
    let i = 0;

    if (cards[cardNum].state !== CoupCardState.Active) {
        throw(new Error('Challenge should have failed - ' + cardNum + ' is not active'));
    }

    deck.push(cards[cardNum].card);
    shuffle(deck);

    const draw = deck.splice(0, 1);
    cards[cardNum].card = draw[0];

    mp.setData('deck', deck);
    mp.setPlayerData(clientId, 'cards', cards);
}

/**
 * Checks if a players hand has a given card.
 */
export function hasCard(
    cards: any[],
    card: CoupCard
) {
    for (let i = 0; i < cards.length; i = i + 1) {
        if (cards[i].card === card &&
            cards[i].state === CoupCardState.Active) {

            return true;
        }
    }

    return false;
}

/**
 * Checks if a challenge failure causes player to lose, and update data accordingly.
 */
export function challengeFailCauseDead(
    mp: MPType,
    clientId: string,
    cardState = CoupCardState.Challenged
) {
    const cards = mp.getPlayerData(clientId, 'cards');
    let activeCards = 0;
    for (let i = 0; i < cards.length; i = i + 1) {
        if (cards[i].state === CoupCardState.Active) {
            activeCards = activeCards + 1;
        }
    }

    if (activeCards > 1) {
        return false;
    }

    for (let i = 0; i < cards.length; i = i + 1) {
        if (cards[i].state === CoupCardState.Active) {
            cards[i].state = cardState;
        }
    }

    mp.setPlayerData(clientId, 'cards', cards);
    mp.setPlayerData(clientId, 'isDead', true);

    return true;
}

export function distributeCards(
    mp: MPType
) {
    const deck = mp.getData('deck');

    mp.playersForEach((clientId) => {
        const draw = deck.splice(0, 2);
        const cards = [];

        [0, 1].forEach((i) => {
            cards.push({
                card: draw[i],
                state: CoupCardState.Active
            });
        });

        mp.setPlayerData(clientId, 'cards', cards);
    });

    mp.setData('deck', deck);
}
