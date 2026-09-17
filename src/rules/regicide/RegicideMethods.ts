/**
 * RegicideMethods.ts - RPC methods for Regicide.
 * Executed only on the host: rehydrate the game state, mutate it, persist it back.
 */

import { MPType } from '../../common/interfaces';
import { RegicideGameState, GameStateData } from './RegicideGameState';

export const getGameState = (mp: MPType): RegicideGameState => {
    let raw = mp.getData('gameState');
    if (!raw) {
        throw new Error('Game state not found');
    }
    if (typeof raw.get_data !== 'function') {
        const data = raw.data as GameStateData;
        const playerIds = raw.playerIds as string[];
        raw = RegicideGameState.from_data(data, playerIds);
        mp.setData('gameState', raw);
    }
    return raw;
};

const sync = (mp: MPType, gameState: RegicideGameState) => {
    mp.setData('gameState', gameState);
};

const collectPlayers = (mp: MPType): string[] => {
    if (mp.getPlayers) {
        return mp.getPlayers();
    }
    const players = [mp.hostId];
    mp.playersForEach((clientId) => players.push(clientId));
    return players;
};

export const RegicideStartGame = (mp: MPType) => {
    const players = collectPlayers(mp);
    if (players.length < 1 || players.length > 4) {
        throw new Error('Regicide supports 1 to 4 players.');
    }
    const gameState = new RegicideGameState(players);
    gameState.start_game(players[0]);
    sync(mp, gameState);
    mp.setData('lobby_started', true);
};

export const RegicidePlayCards = (mp: MPType, clientId: string, cardIds: string[]) => {
    const gameState = getGameState(mp);
    gameState.play_cards(clientId, cardIds);
    sync(mp, gameState);
};

export const RegicidePlayJester = (mp: MPType, clientId: string, cardId: string) => {
    const gameState = getGameState(mp);
    gameState.play_jester(clientId, cardId);
    sync(mp, gameState);
};

export const RegicideChooseNext = (mp: MPType, clientId: string, nextId: string) => {
    const gameState = getGameState(mp);
    gameState.choose_next_player(clientId, nextId);
    sync(mp, gameState);
};

export const RegicideYield = (mp: MPType, clientId: string) => {
    const gameState = getGameState(mp);
    gameState.yield_turn(clientId);
    sync(mp, gameState);
};

export const RegicideDiscardForDamage = (mp: MPType, clientId: string, cardIds: string[]) => {
    const gameState = getGameState(mp);
    gameState.discard_for_damage(clientId, cardIds);
    sync(mp, gameState);
};

export const RegicideSoloRefill = (mp: MPType, clientId: string) => {
    const gameState = getGameState(mp);
    gameState.solo_refill(clientId);
    sync(mp, gameState);
};

export const RegicideRestartGame = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) {
        throw new Error('Only the host can restart the game');
    }
    const players = collectPlayers(mp);
    const gameState = new RegicideGameState(players);
    gameState.start_game(players[0]);
    sync(mp, gameState);
};

export const RegicideBackToLobby = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) {
        throw new Error('Only the host can return to the lobby');
    }
    mp.setData('lobby_started', false);
};
