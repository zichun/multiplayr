/**
 * AvalonMethods.ts
 */

import {
    shuffle
} from '../../common/utils';

import {
    AvalonGameState,
    AvalonCharacter
} from './AvalonTypes';

import {
    AvalonQuestMembers,
    AvalonGoodEvilDistribution
} from './AvalonUtils';

import {
    MPType
} from '../../common/interfaces';

export const AvalonStartGame = (mp: MPType) => {
    if (mp.playersCount() < 5) {
        alert('We need at least 5 players to play this game');
    } else {
        mp.newGame();
        mp.setData('lobby_started', true);
    }
};

export const AvalonNewGame = (mp: MPType) => {
    mp.setData('state', AvalonGameState.ChooseQuestMembers);

    const playerDeck = [];
    playerDeck.push(AvalonCharacter.Merlin);

    for (let i = 0; i < AvalonGoodEvilDistribution[mp.playersCount()][0] - 1; i = i + 1) {
        playerDeck.push(AvalonCharacter.LoyalServant);
    }

    for (let i = 0; i < AvalonGoodEvilDistribution[mp.playersCount()][1] - 1; i = i + 1) {
        playerDeck.push(AvalonCharacter.Minion);
    }

    shuffle(playerDeck);

    mp.playersForEach((clientId, i) => {
        mp.setPlayerData(clientId, 'character', playerDeck[i]);
    });

};
