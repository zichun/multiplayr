/**
 * CleverMethods.ts - Game methods for Clever
 */

import { MPType } from '../../common/interfaces';
import { CleverGameState as GameState, DieColor } from './CleverGameState';

const getGameState = (mp: MPType): GameState => {
    return mp.getData('gameState');
};

const syncGameStateToMP = (mp: MPType, gameState: GameState) => {
    mp.setData('gameState', gameState);
};

export const CleverStartGame = (mp: MPType) => {
    const playerCount = mp.playersCount() + 1; // Host is a player

    if (playerCount < 1) {
        alert('We need at least 1 player to play Clever');
        return;
    }

    if (playerCount > 4) {
        alert('Maximum 4 players allowed for Clever');
        return;
    }

    const players = [mp.hostId];
    mp.playersForEach((clientId) => players.push(clientId));
    const gameState = new GameState(players);
    gameState.start_game();
    syncGameStateToMP(mp, gameState);

    mp.setData('lobby_started', true);
};

export const CleverChooseRoundStartBonus = (mp: MPType, clientId: string, choice: 'X' | '6') => {
    const gameState = getGameState(mp);
    gameState.choose_round_start_bonus(clientId, choice);
    syncGameStateToMP(mp, gameState);
};

export const CleverSelectRound4Option = (mp: MPType, clientId: string, bonusType: 'yellow_X' | 'blue_X' | 'green_X' | 'orange_num' | 'purple_num') => {
    const gameState = getGameState(mp);
    gameState.push_round4_choice_result(clientId, bonusType);
    syncGameStateToMP(mp, gameState);
};

export const CleverRollActiveDice = (mp: MPType, clientId: string) => {
    const gameState = getGameState(mp);
    gameState.roll_active_dice(clientId);
    syncGameStateToMP(mp, gameState);
};

export const CleverRerollActiveDice = (mp: MPType, clientId: string) => {
    const gameState = getGameState(mp);
    gameState.reroll_active_dice(clientId);
    syncGameStateToMP(mp, gameState);
};

export const CleverPickActiveDie = (mp: MPType, clientId: string, color: DieColor, option?: any) => {
    const gameState = getGameState(mp);
    gameState.pick_active_die(clientId, color, option);
    syncGameStateToMP(mp, gameState);
};

export const CleverResolvePendingBonus = (mp: MPType, clientId: string, rOrIndex: number, c?: number) => {
    const gameState = getGameState(mp);
    gameState.resolve_pending_bonus(clientId, rOrIndex, c);
    syncGameStateToMP(mp, gameState);
};

export const CleverPickPassiveDie = (mp: MPType, clientId: string, color: DieColor, option?: any) => {
    const gameState = getGameState(mp);
    gameState.pick_passive_die(clientId, color, option);
    syncGameStateToMP(mp, gameState);
};

export const CleverSpendExtraDie = (mp: MPType, clientId: string, color: DieColor, option?: any) => {
    const gameState = getGameState(mp);
    gameState.spend_extra_die(clientId, color, option);
    syncGameStateToMP(mp, gameState);
};

export const CleverConfirmPassiveSelection = (mp: MPType, clientId: string) => {
    const gameState = getGameState(mp);
    gameState.confirm_passive_selection(clientId);
    syncGameStateToMP(mp, gameState);
};

export const CleverEndPlayerTurn = (mp: MPType, clientId: string) => {
    const gameState = getGameState(mp);
    gameState.end_player_turn(clientId);
    syncGameStateToMP(mp, gameState);
};

export const CleverRestartGame = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) {
        throw new Error('Only the host can restart the game');
    }

    const gameState = getGameState(mp);
    gameState.restart_game();
    syncGameStateToMP(mp, gameState);
};

export const CleverBackToLobby = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) {
        throw new Error('Only host can return to lobby');
    }

    mp.setData('lobby_started', false);
};
