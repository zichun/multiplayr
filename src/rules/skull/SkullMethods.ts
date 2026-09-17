/**
 * SkullMethods.ts - RPC methods for Skull.
 * Executed only on the host: rehydrate the game state, mutate it, persist it back.
 */

import { MPType } from '../../common/interfaces';
import { SkullGameState, GameStateData, DiscKind } from './SkullGameState';

export const getGameState = (mp: MPType): SkullGameState => {
    let raw = mp.getData('gameState');
    if (!raw) {
        throw new Error('Game state not found');
    }
    if (typeof raw.get_data !== 'function') {
        const data = raw.data as GameStateData;
        const playerIds = raw.playerIds as string[];
        raw = SkullGameState.from_data(data, playerIds);
        mp.setData('gameState', raw);
    }
    return raw;
};

const sync = (mp: MPType, gameState: SkullGameState) => {
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

export const SkullStartGame = (mp: MPType) => {
    const players = collectPlayers(mp);
    if (players.length < 3 || players.length > 6) {
        throw new Error('Skull requires 3 to 6 players.');
    }
    const gameState = new SkullGameState(players);
    gameState.start_game(players[0]);
    sync(mp, gameState);
    mp.setData('lobby_started', true);
};

export const SkullPlaceInitial = (mp: MPType, clientId: string, kind: DiscKind) => {
    const gameState = getGameState(mp);
    gameState.place_initial(clientId, kind);
    sync(mp, gameState);
};

export const SkullAddDisc = (mp: MPType, clientId: string, kind: DiscKind) => {
    const gameState = getGameState(mp);
    gameState.add_disc(clientId, kind);
    sync(mp, gameState);
};

export const SkullOpenBid = (mp: MPType, clientId: string, value: number) => {
    const gameState = getGameState(mp);
    gameState.open_bid(clientId, value);
    sync(mp, gameState);
};

export const SkullRaiseBid = (mp: MPType, clientId: string, value: number) => {
    const gameState = getGameState(mp);
    gameState.raise_bid(clientId, value);
    sync(mp, gameState);
};

export const SkullPass = (mp: MPType, clientId: string) => {
    const gameState = getGameState(mp);
    gameState.pass_bid(clientId);
    sync(mp, gameState);
};

export const SkullFlip = (mp: MPType, clientId: string, targetId: string) => {
    const gameState = getGameState(mp);
    gameState.flip_opponent(clientId, targetId);
    sync(mp, gameState);
};

export const SkullChooseDiscard = (mp: MPType, clientId: string, kind: DiscKind) => {
    const gameState = getGameState(mp);
    gameState.choose_discard(clientId, kind);
    sync(mp, gameState);
};

// Advance from the resolution snapshot into the next round. Host-driven (the host
// schedules this once the outcome animation has played); idempotent on the state side.
export const SkullProceed = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) {
        return; // only the host advances the round, to avoid races
    }
    const gameState = getGameState(mp);
    gameState.proceed_round(clientId);
    sync(mp, gameState);
};

export const SkullRestartGame = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) {
        throw new Error('Only the host can restart the game');
    }
    const players = collectPlayers(mp);
    const gameState = new SkullGameState(players);
    gameState.start_game(players[0]);
    sync(mp, gameState);
};

export const SkullBackToLobby = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) {
        throw new Error('Only the host can return to the lobby');
    }
    mp.setData('lobby_started', false);
};
