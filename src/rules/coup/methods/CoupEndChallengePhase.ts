/**
 * CoupEndChallengePhase.ts
 *
 * Endpoint for host to end a challenge phase (before any challenge has been taken).
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

export const CoupEndChallengePhase = (
    mp: MPType,
    clientId: string
) => {

    if (clientId !== mp.hostId) {
        throw(new Error('Only host can end challenge phase'));
    }

    if (mp.getData('gameState') !== CoupGameState.PlayReaction) {
        throw(new Error('endChallengePhase can only be done in PlayReaction state'));
    }

    const actions = mp.getData('actions');
    const lastAction: CoupActionInterface = actions[actions.length - 1];
    const { action, challenge, block, targetId } = lastAction;

    if (challenge) {
        throw(new Error('endChallengePhase cannot be done when challenge is done'));
    }

    if (block) {
        //
        // Block is successful. Move on to next player.
        //
        nextTurn(mp);
        return;
    }

    lastAction.complete = true;
    const coins = mp.getPlayerData(lastAction.clientId, 'coins');

    switch (action) {
    case CoupAction.Duke:

        mp.setPlayerData(lastAction.clientId, 'coins', coins + 3);
        nextTurn(mp);

        break;

    case CoupAction.Assassin:
        mp.setPlayerData(lastAction.clientId, 'coins', coins - 3);

        lastAction.challengeLoser = targetId;
        if (challengeFailCauseDead(mp, targetId, CoupCardState.Assassinated)) {
            lastAction.challengeCauseDead = true;
            nextTurn(mp);
        } else {
            mp.setData('gameState', CoupGameState.ChallengeResult);
        }

        break;

    case CoupAction.Captain:

        const targetCoins = mp.getPlayerData(targetId, 'coins');
        const stealCoin = Math.min(targetCoins, 2);

        lastAction.coinStolen = stealCoin;

        mp.setPlayerData(targetId, 'coins', targetCoins - stealCoin);
        mp.setPlayerData(lastAction.clientId, 'coins', coins + stealCoin);
        nextTurn(mp);

        break;

    case CoupAction.ForeignAid:

        mp.setPlayerData(lastAction.clientId, 'coins', coins + 2);
        nextTurn(mp);

        break;

    case CoupAction.Ambassador:
        mp.setData('gameState', CoupGameState.AmbassadorCardChange);

        break;
    }

    mp.setData('actions', actions);
}

export default CoupEndChallengePhase;
