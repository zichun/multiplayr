/**
 * CoupTakeAction.ts
 *
 * Endpoint for player to play an action. This moves the gameState to the Challenge phase.
 * If the action taken was an Income action, it automatically succeeds and the next player gets to play.
 */

import {
    MPType
} from '../../../common/interfaces';

import {
    nextTurn,
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

export const CoupTakeAction = (
    mp: MPType,
    clientId: string,
    action: CoupAction,
    targetId?: string
) => {
    //
    // Verify validity of action.
    //
    if (mp.getData('gameState') !== CoupGameState.PlayAction) {
        throw(new Error('Action can only be taken in PlayAction state'));
    }

    const turn = mp.getData('playerTurn');
    mp.playersForEach(
        (cId, index) => {
            if (index === turn && clientId !== cId) {
                throw(new Error('Action can only be on the player\'s turn'));
            }
        });

    if (action === CoupAction.Assassin ||
        action === CoupAction.Captain ||
        action === CoupAction.Coup) {

        if (!targetId) {
            throw(new Error('TargetId not set for an action that requires it'));
        }
    } else {
        targetId = null;
    }

    if (targetId && mp.getPlayerData(targetId, 'isDead') === true) {
        throw(new Error('Cannot target a dead player'));
    }

    const coins = mp.getPlayerData(clientId, 'coins');
    if (coins >= 10 && action !== CoupAction.Coup) {
        throw(new Error('Coup action must be taken if player has more than 10 coins'));
    }

    if ((action === CoupAction.Coup && coins < 7) ||
        (action === CoupAction.Assassin && coins < 3)) {
        throw(new Error('Insufficient coins to perform action.'));
    }

    const actions = mp.getData('actions');
    const actionObj: CoupActionInterface = {
        action: action,
        clientId: clientId,
        targetId: targetId,
        challenge: null,
        block: null,
        outcomes: []
    };

    if (action === CoupAction.Income) {
        // Income action cannot be disputed, continue.
        mp.setPlayerData(clientId, 'coins', coins + 1);

        actionObj.outcomes.push({
            clientId: clientId,
            coins: 1
        });

        nextTurn(mp);
    } else if (action === CoupAction.Coup) {
        // Coup cannot be disputed.
        mp.setPlayerData(clientId, 'coins', coins - 7);

        actionObj.complete = true;

        actionObj.challengeLoser = targetId;
        if (challengeFailCauseDead(mp, targetId, CoupCardState.Couped)) {
            actionObj.challengeCauseDead = true;

            actionObj.outcomes.push({
                clientId: clientId,
                cards: -1
            });

            nextTurn(mp);
        } else {
            mp.setData('gameState', CoupGameState.ChallengeResult);
        }
    } else {
        mp.setData('gameState', CoupGameState.PlayReaction);
    }

    actions.push(actionObj);
    mp.setData('actions', actions);
};

export default CoupTakeAction;
