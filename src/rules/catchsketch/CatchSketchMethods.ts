/**
 * CatchSketchMethods.ts - Method implementations for Catch Sketch game
 */

import { MPType } from '../../common/interfaces';
import { CatchSketchGameState } from './CatchSketchGameState';

export function CatchSketchStartGame(mp: MPType, clientId: string): void {
    // Only host can start the game
    if (clientId !== mp.hostId) {
        return;
    }

    const playerCount = mp.playersCount() + 1; // Host is a player
    if (playerCount < 3) {
        alert('We need at least 3 players to play CatchSketch');
        return;
    }

    const players = [mp.hostId];
    mp.playersForEach((clientId) => players.push(clientId));
    const gameState = new CatchSketchGameState(players);
    gameState.start_game();

    mp.setData('gameState', gameState);
    mp.setData('lobby_started', true);
}

export function CatchSketchLockToken(mp: MPType, clientId: string, tokenNumber: 1 | 2): void {
    let gameState = mp.getData('gameState');
    if (!gameState || !gameState.lock_token) {
        return;
    }

    // Ensure we have the proper instance
    if (!gameState.get_player_data) {
        gameState = CatchSketchGameState.from_data(gameState.data, gameState.playerIds);
        mp.setData('gameState', gameState);
    }

    try {
        gameState.lock_token(clientId, tokenNumber);
        mp.setData('gameState', gameState);
    } catch (error) {
        // Silently fail - UI should prevent invalid actions
        console.warn('Lock token failed:', error.message);
    }
}

export function CatchSketchSubmitGuess(mp: MPType, clientId: string, guess: string): void {
    let gameState = mp.getData('gameState');
    if (!gameState || !gameState.submit_guess) {
        return;
    }

    // Ensure we have the proper instance
    if (!gameState.get_player_data) {
        gameState = CatchSketchGameState.from_data(gameState.data, gameState.playerIds);
        mp.setData('gameState', gameState);
    }

    try {
        gameState.submit_guess(clientId, guess);
        mp.setData('gameState', gameState);
    } catch (error) {
        // Silently fail - UI should prevent invalid actions
        console.warn('Submit guess failed:', error.message);
    }
}

export function CatchSketchNextRound(mp: MPType, clientId: string): void {
    let gameState = mp.getData('gameState');
    if (!gameState || !gameState.next_round) {
        return;
    }

    // Ensure we have the proper instance
    if (!gameState.get_player_data) {
        gameState = CatchSketchGameState.from_data(gameState.data, gameState.playerIds);
        mp.setData('gameState', gameState);
    }
    try {
        if (gameState.next_round()) {
            mp.plugins['drawing'].resetAllCanvases();
            mp.setData('gameState', gameState);
        }
    } catch (error) {
        console.warn('Next round failed:', error.message);
    }
}

export function CatchSketchBackToLobby(mp: MPType, clientId: string): void {
    // Only host can go back to lobby
    if (clientId !== mp.hostId) {
        return;
    }

    mp.setData('lobby_started', false);
    mp.setData('gameState', null);
}
