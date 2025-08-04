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

    const playerIds = mp.getPlayerList();
    if (playerIds.length < 3) {
        return; // Need at least 3 players
    }

    const gameState = new CatchSketchGameState(playerIds);
    gameState.start_game();
    
    mp.setData('gameState', gameState);
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
    // Only host can advance to next round
    if (clientId !== mp.hostId) {
        return;
    }

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
        gameState.next_round();
        mp.setData('gameState', gameState);
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