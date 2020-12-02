/**
 * CoupAmbassadorAction.ts
 *
 * Endpoint for revealing card - this can come from either a ChallengeReaction, where a challenged player
 * picks a card to reveal, or from ChallengeResult, where the player who incorrectly challenges pick a card to reveal.
 */

import {
    MPType
} from '../../../common/interfaces';

import {
    shuffle
} from '../../../common/utils';

import {
    nextTurn
} from '../CoupFunctions';

import {
    CoupGameState,
    CoupAction,
    CoupReaction,
    CoupCard,
    CoupCardState,
    CoupWaitContext,
    CoupActionInterface
} from '../CoupTypes';

export const CoupAmbassadorAction = (
    mp: MPType,
    clientId: string,
    cardsChoice: string[]
) => {
    if (mp.getData('gameState') !== CoupGameState.AmbassadorCardChange) {
        throw(new Error('ambassadorAction can only be taken in AmbassadorCardChange state'));
    }

    const actions = mp.getData('actions');
    const lastAction = actions[actions.length - 1];
    const deck = mp.getData('deck');
    const cards = mp.getPlayerData(clientId, 'cards');
    const top2 = deck.splice(0, 2);
    let neededCount = 0;
    const newCards = [];

    for (let i = 0; i < cards.length; i = i + 1) {
        if (cards[i].state === CoupCardState.Active) {
            neededCount = neededCount + 1;
        } else {
            newCards.push({
                card: cards[i].card,
                state: cards[i].state
            });
        }
    }

    if (clientId !== lastAction.clientId) {
        throw(new Error('ambassadorAction can only be taken by the current player'));
    }

    if (cardsChoice.length !== neededCount) {
        throw(new Error('Can only draw two cards'));
    }

    const draw = [];
    for (let i = 0; i < cardsChoice.length; i = i + 1) {
        const card = parseInt(cardsChoice[i], 10);
        if (card < 0 || card >= 4) {
            throw(new Error('Invalid card drawn'));
        }
        draw.push(card);
    }

    if (neededCount === 2) {
        if (draw[0] === draw[1]) {
            throw(new Error('Invalid card drawn'));
        }
    }

    for (let i = 0; i < draw.length; i = i + 1) {
        if (draw[i] < 2) {
            if (cards[draw[i]].state !== CoupCardState.Active) {
                throw(new Error('Invalid card drawn'));
            }

            newCards.push({
                card: cards[draw[i]].card,
                state: CoupCardState.Active
            });
        } else {
            newCards.push({
                card: top2[draw[i] - 2],
                state: CoupCardState.Active
            });
        }
    }

    if (neededCount === 1) {
        draw.push(draw[0]);
    }

    for (let i = 0; i < cards.length; i = i + 1) {
        if (cards[i].state === CoupCardState.Active &&
            i !== draw[0] &&
            i !== draw[1]) {
            deck.push(cards[i].card);
        }
    }

    for (let i = 0; i < top2.length; i = i + 1) {
        if (i !== draw[0] - 2 &&
            i !== draw[1] - 2) {
            deck.push(top2[i]);
        }
    }

    shuffle(deck);

    lastAction.outcomes.push({
        clientId: clientId,
        cards: neededCount
    });

    mp.setData('deck', deck);
    mp.setPlayerData(clientId, 'cards', newCards);
    nextTurn(mp);
};

export default CoupAmbassadorAction;
