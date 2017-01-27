/**
 * CoupTakeReaction.ts
 *
 * Endpoint for player to play a reaction (either challenge or block) to an action.
 * If a block was issued, other players may choose to challenge the block. Otherwise,
 * move the game state to ChallengeReaction (challenged player to pick a card to reveal).
 */

import {
    MPType
} from '../../../common/interfaces';

import {
    CoupGameState,
    CoupAction,
    CoupReaction,
    CoupCard,
    CoupCardState,
    CoupWaitContext,
    CoupActionInterface
} from '../CoupTypes';

export const CoupTakeReaction = (
    mp: MPType,
    clientId: string,
    reaction: CoupReaction
) => {
    //
    // Verify validity of action.
    //
    if (mp.getData('gameState') !== CoupGameState.PlayReaction) {
        throw(new Error('Reaction can only be taken in PlayReaction state'));
    }

    const actions = mp.getData('actions');
    const lastAction = actions[actions.length - 1];
    const { action, challenge, block, targetId } = lastAction;

    if (reaction === CoupReaction.Challenge && challenge) {
        throw(new Error('Challenge has already been performed by client:' + challenge));
    }

    if (reaction === CoupReaction.Block && (challenge || block)) {
        throw(new Error('Block cannot be performend, already challenged/block'));
    }

    if (reaction === CoupReaction.Block) {
        if (action !== CoupAction.ForeignAid && targetId !== clientId) {
            throw(new Error('Block reaction not allowed'));
        }
    }

    if (reaction === CoupReaction.Challenge) {
        //
        // Allow challenged player to choose a card to reveal.
        //

        lastAction.challenge = clientId;
        mp.setData('gameState', CoupGameState.ChallengeReaction);

    } else if (reaction === CoupReaction.Block) {
        //
        // Allow other players to contest block action.
        //

        lastAction.block = clientId;
        mp.setData('gameState', CoupGameState.PlayReaction);
    }

    mp.setData('actions', actions);
}

export default CoupTakeReaction;
