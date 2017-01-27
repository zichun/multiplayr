/**
 * CoupNewGame.ts
 *
 * Creates a new game
 * - resets and reshuffle the deck,
 * - Distribute 2 cards to each player
 * - Distribute 2 coins to each player
 * - Select a random player to start
 *
 */

import {
    MPType
} from '../../../common/interfaces';

import {
    newDeck,
    distributeCards
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

export const CoupNewGame = (mp: MPType) => {
    const deck = newDeck();
    mp.setData('deck', deck);
    mp.setData('actions', []);

    distributeCards(mp);

    mp.playersForEach((clientId) => {
        mp.setPlayerData(clientId, 'coins', 2);
        mp.setPlayerData(clientId, 'isDead', false);
    });

    mp.setData('playerTurn', Math.floor(Math.random() * mp.playersCount()));
    mp.setData('gameState', CoupGameState.PlayAction);
}

export default CoupNewGame;
