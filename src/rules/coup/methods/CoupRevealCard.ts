/**
 * CoupRevealCard.ts
 *
 * Endpoint for revealing card - this can come from either a ChallengeReaction, where a challenged player
 * picks a card to reveal, or from ChallengeResult, where the player who incorrectly challenges pick a card to reveal.
 */

import {
    MPType
} from '../../../common/interfaces';

import {
    nextTurn,
    replaceChallengedCard,
    challengeFailCauseDead
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

export const CoupRevealCard = (
    mp: MPType,
    clientId: string,
    card: string
) => {

    if (mp.getData('gameState') !== CoupGameState.ChallengeResult &&
        mp.getData('gameState') !== CoupGameState.ChallengeReaction) {

        throw(new Error('revealCard can only be taken in ChallengeResult/ChallengeReaction state'));
    }

    const actions = mp.getData('actions');
    const lastAction = actions[actions.length - 1];
    const { action, challenge, block, targetId } = lastAction;
    const cards = mp.getPlayerData(clientId, 'cards');
    const cardNum = parseInt(card, 10);

    if (cards[cardNum].state !== CoupCardState.Active) {
        throw(new Error('Cannot pick non active card'));
    }

    if (mp.getData('gameState') === CoupGameState.ChallengeResult) {

        if (lastAction.challengeLoser !== clientId) {
            throw(new Error('Only challengeLoser can perform revealCard'));
        }

        if (!(cardNum >= 0 && cardNum < cards.length)) {
            throw(new Error('revealCard invalid card'));
        }

        if (lastAction.challenge) {
            cards[cardNum].state = CoupCardState.Challenged;
            mp.endChallengePhase();
        } else {
            cards[cardNum].state = (action === CoupAction.Coup ? CoupCardState.Couped : CoupCardState.Assassinated);
            nextTurn(mp);
        }
        mp.setPlayerData(clientId, 'cards', cards);

        return;
    }

    const pickedCard = cards[cardNum].card;
    const requiredCard = [];
    let challengee = null;

    if (block) {
        challengee = block;
        if (action === CoupAction.ForeignAid) {
            requiredCard.push(CoupCard.Duke);
        } else if (action === CoupAction.Assassin) {
            requiredCard.push(CoupCard.Contessa);
        } else if (action === CoupAction.Captain) {
            requiredCard.push(CoupCard.Captain);
            requiredCard.push(CoupCard.Ambassador);
        }
    } else {
        challengee = lastAction.clientId;
        if (action === CoupAction.Duke) {
            requiredCard.push(CoupCard.Duke);
        } else if (action === CoupAction.Assassin) {
            requiredCard.push(CoupCard.Assassin);
        } else if (action === CoupAction.Captain) {
            requiredCard.push(CoupCard.Captain);
        } else if (action === CoupAction.Ambassador) {
            requiredCard.push(CoupCard.Ambassador);
        }
    }

    if (clientId !== challengee) {
        throw(new Error('Only challengee can reveal card'));
    }

    let hasCard = false;
    for (let i = 0; i < requiredCard.length; i = i + 1) {
        if (pickedCard === requiredCard[i]) {
            hasCard = true;
        }
    }

    if (hasCard) {
        lastAction.challengeResult = false;
        lastAction.challengeWinner = challengee;
        lastAction.challengeLoser = challenge;
        replaceChallengedCard(mp, challengee, cardNum);

        lastAction.outcomes.push({
            clientId: lastAction.challengeWinner,
            cards: 1
        });

        if (challengeFailCauseDead(mp, lastAction.challengeLoser)) {
            lastAction.challengeCauseDead = true;
            if (action === CoupAction.Ambassador) {
                mp.setData('gameState', CoupGameState.AmbassadorCardChange);
            } else {
                nextTurn(mp);
            }

            lastAction.outcomes.push({
                clientId: lastAction.challengeLoser,
                cards: -1
            });

            return;
        } else {
            mp.setData('gameState', CoupGameState.ChallengeResult);
        }

    } else {
        lastAction.challengeResult = true;
        lastAction.challengeLoser = challengee;

        lastAction.outcomes.push({
            clientId: lastAction.challengeLoser,
            cards: -1
        });

        if (challengeFailCauseDead(mp, lastAction.challengeLoser)) {
            lastAction.challengeCauseDead = true;

            nextTurn(mp);
            return;
        } else {
            cards[cardNum].state = CoupCardState.Challenged;
            mp.endChallengePhase();
        }
    }

    mp.setPlayerData(clientId, 'cards', cards);
};

export default CoupRevealCard;
