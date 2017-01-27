/**
 * CoupStartGame.ts - starts a Coup game
 */

import {
    MPType
} from '../../../common/interfaces';

export const CoupStartGame = (mp: MPType) => {
    if (mp.playersCount() < 3) {
        alert('We need at least 3 players to play this game');
    } else {
        mp.newGame();
        mp.setData('lobby_started', true);
    }
}

export default CoupStartGame;
