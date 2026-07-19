/**
 * CatInTheBoxMethods.ts - RPC methods for Cat in the Box.
 * Executed only on the host: rehydrate the game state, mutate it, persist it back.
 */

import { MPType } from '../../common/interfaces';
import { CatInTheBoxGameState, GameStateData, CatColor, CatMode } from './CatInTheBoxGameState';

export const getGameState = (mp: MPType): CatInTheBoxGameState => {
    let raw = mp.getData('gameState');
    if (!raw) {
        throw new Error('Game state not found');
    }
    if (typeof raw.get_data !== 'function') {
        const data = raw.data as GameStateData;
        const playerIds = raw.playerIds as string[];
        raw = CatInTheBoxGameState.from_data(data, playerIds);
        mp.setData('gameState', raw);
    }
    return raw;
};

const sync = (mp: MPType, gameState: CatInTheBoxGameState) => {
    mp.setData('gameState', gameState);
};

const getMode = (mp: MPType): CatMode => {
    return (mp.getData('catMode') as CatMode) === 'schrodinger' ? 'schrodinger' : 'normal';
};

// Host chooses Normal / Schrödinger before starting (stored globally so both the
// lobby and the in-game Settings tab reflect the pending choice; it is applied to
// the game on start / restart).
export const CatInTheBoxSetMode = (mp: MPType, clientId: string, mode: CatMode) => {
    if (clientId !== mp.hostId) {
        throw new Error('Only the host can choose the mode');
    }
    if (mode !== 'normal' && mode !== 'schrodinger') {
        throw new Error('Unknown mode');
    }
    mp.setData('catMode', mode);
};

export const CatInTheBoxStartGame = (mp: MPType) => {
    const players = [mp.hostId];
    mp.playersForEach((clientId) => players.push(clientId));

    if (players.length < 2 || players.length > 5) {
        throw new Error('Cat in the Box requires 2 to 5 players.');
    }

    const gameState = new CatInTheBoxGameState(players, getMode(mp));
    gameState.start_game(players[0]);

    sync(mp, gameState);
    mp.setData('lobby_started', true);
};

export const CatInTheBoxDiscardCard = (mp: MPType, clientId: string, cardNumber: number) => {
    const gameState = getGameState(mp);
    gameState.discard_card(clientId, cardNumber);
    sync(mp, gameState);
};

export const CatInTheBoxMakePrediction = (mp: MPType, clientId: string, value: number) => {
    const gameState = getGameState(mp);
    gameState.make_prediction(clientId, value);
    sync(mp, gameState);
};

export const CatInTheBoxPlayCard = (
    mp: MPType,
    clientId: string,
    cardNumber: number,
    color: CatColor
) => {
    const gameState = getGameState(mp);
    gameState.play_card(clientId, cardNumber, color);
    sync(mp, gameState);
};

// Advance past the trick-resolution animation. Host-driven (the host schedules
// this once the animation has played); idempotent on the game-state side.
export const CatInTheBoxFinishTrick = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) {
        return; // only the host advances the animation, to avoid races
    }
    const gameState = getGameState(mp);
    gameState.finish_trick(clientId);
    sync(mp, gameState);
};

export const CatInTheBoxNextRound = (mp: MPType, clientId: string) => {
    const gameState = getGameState(mp);
    gameState.next_round(clientId);
    sync(mp, gameState);
};

export const CatInTheBoxRestartGame = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) {
        throw new Error('Only the host can restart the game');
    }
    const players = [mp.hostId];
    mp.playersForEach((cid) => players.push(cid));
    // Restart picks up the currently selected mode (from lobby or the Settings tab).
    const gameState = new CatInTheBoxGameState(players, getMode(mp));
    gameState.start_game(players[0]);
    sync(mp, gameState);
};

export const CatInTheBoxBackToLobby = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) {
        throw new Error('Only the host can return to the lobby');
    }
    mp.setData('lobby_started', false);
};
