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

    if (mp.getData('gameState') !== CoupGameState.PlayReaction &&
        mp.getData('gameState') !== CoupGameState.ChallengeReaction &&
        mp.getData('gameState') !== CoupGameState.ChallengeResult) {
        throw(new Error('endChallengePhase can only be done in PlayReaction state'));
    }

    const actions = mp.getData('actions');
    const lastAction: CoupActionInterface = actions[actions.length - 1];
    const { action, challenge, block, targetId, challengeLoser } = lastAction;
    const coins = mp.getPlayerData(lastAction.clientId, 'coins');

    if (block) {
        if (!challenge) {
            // Block is not contested.

            if (action === CoupAction.Assassin) {
                // Player must still pay for the attempt.
                mp.setPlayerData(lastAction.clientId, 'coins', coins - 3);
                lastAction.outcomes.push({
                    clientId: lastAction.clientId,
                    coins: -3
                });
            }

            nextTurn(mp);
            return;
        }

        if (challengeLoser !== block) {
            // Block is successful. Move on to next player.

            if (action === CoupAction.Assassin) {
                // Player must still pay for the attempt.
                mp.setPlayerData(lastAction.clientId, 'coins', coins - 3);
                lastAction.outcomes.push({
                    clientId: lastAction.clientId,
                    coins: -3
                });
            }
            nextTurn(mp);
            return;
        }
    } else {
        if (challenge && challengeLoser !== challenge) {
            // Action was challenged, but failed.
            nextTurn(mp);
            return;
        }
    }

    lastAction.complete = true;

    switch (action) {
    case CoupAction.Duke:

        lastAction.outcomes.push({
            clientId: lastAction.clientId,
            coins: 3
        });

        mp.setPlayerData(lastAction.clientId, 'coins', coins + 3);
        nextTurn(mp);

        break;

    case CoupAction.Assassin:
        mp.setPlayerData(lastAction.clientId, 'coins', coins - 3);
        lastAction.outcomes.push({
            clientId: lastAction.clientId,
            coins: -3
        });

        lastAction.challengeLoser = targetId;
        lastAction.outcomes.push({
            clientId: targetId,
            cards: -1
        });

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

        lastAction.outcomes.push({
            clientId: targetId,
            coins: -stealCoin
        });

        lastAction.outcomes.push({
            clientId: lastAction.clientId,
            coins: stealCoin
        });

        mp.setPlayerData(targetId, 'coins', targetCoins - stealCoin);
        mp.setPlayerData(lastAction.clientId, 'coins', coins + stealCoin);
        nextTurn(mp);

        break;

    case CoupAction.ForeignAid:

        lastAction.outcomes.push({
            clientId: lastAction.clientId,
            coins: 2
        });

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
