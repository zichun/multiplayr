/**
 * MoonrollersMethods.ts - RPC methods for Moonrollers (host-only execution).
 * Each method rehydrates the pure GameState, mutates it, and persists it back.
 */

import { MPType } from '../../common/interfaces';
import { MoonrollersGameState, GameStateData } from './MoonrollersGameState';

export const getGameState = (mp: MPType): MoonrollersGameState => {
    let raw = mp.getData('gameState');
    if (!raw) throw new Error('Game state not found');
    if (typeof raw.get_data !== 'function') {
        raw = MoonrollersGameState.from_data(raw.data as GameStateData, raw.playerIds as string[]);
        mp.setData('gameState', raw);
    }
    return raw;
};

const sync = (mp: MPType, gameState: MoonrollersGameState) => {
    mp.setData('gameState', gameState);
};

const collectPlayers = (mp: MPType): string[] => {
    const players = [mp.hostId];
    mp.playersForEach((clientId) => players.push(clientId));
    return players;
};

export const MoonrollersStartGame = (mp: MPType) => {
    const players = collectPlayers(mp);
    if (players.length < 2 || players.length > 5) {
        throw new Error('Moonrollers requires 2 to 5 players.');
    }
    const gameState = new MoonrollersGameState(players);
    gameState.start_game();
    sync(mp, gameState);
    mp.setData('lobby_started', true);
};

export const MoonrollersChooseCard = (mp: MPType, clientId: string, cardIndex: number) => {
    const gameState = getGameState(mp);
    gameState.choose_card(clientId, cardIndex);
    sync(mp, gameState);
};

export const MoonrollersCommit = (mp: MPType, clientId: string, reqIndex: number) => {
    const gameState = getGameState(mp);
    gameState.commit(clientId, reqIndex);
    sync(mp, gameState);
};

export const MoonrollersLockDie = (mp: MPType, clientId: string, dieIndex: number) => {
    const gameState = getGameState(mp);
    gameState.lock_die(clientId, dieIndex);
    sync(mp, gameState);
};

export const MoonrollersAbilityRetag = (mp: MPType, clientId: string, dieIndex: number) => {
    const gameState = getGameState(mp);
    gameState.ability_retag(clientId, dieIndex);
    sync(mp, gameState);
};

export const MoonrollersAbilityExtraLock = (mp: MPType, clientId: string, dieIndex: number) => {
    const gameState = getGameState(mp);
    gameState.ability_extra_lock(clientId, dieIndex);
    sync(mp, gameState);
};

export const MoonrollersAbilityRerollAll = (mp: MPType, clientId: string) => {
    const gameState = getGameState(mp);
    gameState.ability_reroll_all(clientId);
    sync(mp, gameState);
};

export const MoonrollersUseAbility = (mp: MPType, clientId: string, abilityId: string, dieIndices?: number[]) => {
    const gameState = getGameState(mp);
    gameState.use_ability(clientId, abilityId, dieIndices || []);
    sync(mp, gameState);
};

export const MoonrollersDismissTransient = (mp: MPType, clientId: string) => {
    const gameState = getGameState(mp);
    gameState.dismiss_transient(clientId);
    sync(mp, gameState);
};

export const MoonrollersRollAgain = (mp: MPType, clientId: string) => {
    const gameState = getGameState(mp);
    gameState.roll_again(clientId);
    sync(mp, gameState);
};

export const MoonrollersStop = (mp: MPType, clientId: string) => {
    const gameState = getGameState(mp);
    gameState.stop(clientId);
    sync(mp, gameState);
};

export const MoonrollersKeepHazard = (mp: MPType, clientId: string, tokenIndex: number) => {
    const gameState = getGameState(mp);
    gameState.keep_hazard(clientId, tokenIndex);
    sync(mp, gameState);
};

export const MoonrollersResolveDuplicate = (mp: MPType, clientId: string, keepCrewId: string, returnHazardId?: string | null) => {
    const gameState = getGameState(mp);
    gameState.resolve_duplicate(clientId, keepCrewId, returnHazardId || null);
    sync(mp, gameState);
};

export const MoonrollersRestartGame = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) throw new Error('Only the host can restart the game');
    const gameState = getGameState(mp);
    gameState.start_game();
    sync(mp, gameState);
};

export const MoonrollersBackToLobby = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) throw new Error('Only the host can return to the lobby');
    mp.setData('lobby_started', false);
};
