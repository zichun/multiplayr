/**
 * TrioMethods.ts - RPC methods for Trio.
 * Executed only on the host: rehydrate the game state, mutate it, persist it back.
 */

import { MPType } from '../../common/interfaces';
import { TrioGameState, GameStateData, GameMode, HandEnd } from './TrioGameState';

export const getGameState = (mp: MPType): TrioGameState => {
    let raw = mp.getData('gameState');
    if (!raw) {
        throw new Error('Game state not found');
    }
    if (typeof raw.get_data !== 'function') {
        const data = raw.data as GameStateData;
        const playerIds = raw.playerIds as string[];
        raw = TrioGameState.from_data(data, playerIds);
        mp.setData('gameState', raw);
    }
    return raw;
};

const sync = (mp: MPType, gameState: TrioGameState) => {
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

// Host chooses Simple / Spicy before starting (stored globally so the lobby can
// reflect the current choice).
export const TrioSetMode = (mp: MPType, clientId: string, mode: GameMode) => {
    if (clientId !== mp.hostId) {
        throw new Error('Only the host can choose the mode');
    }
    if (mode !== 'simple' && mode !== 'spicy') {
        throw new Error('Unknown mode');
    }
    mp.setData('trioMode', mode);
};

export const TrioStartGame = (mp: MPType) => {
    const players = collectPlayers(mp);

    if (players.length < 3 || players.length > 6) {
        throw new Error('Trio requires 3 to 6 players.');
    }

    const mode = (mp.getData('trioMode') as GameMode) || 'simple';
    const gameState = new TrioGameState(players, mode);
    gameState.start_game(mode, players[0]);

    sync(mp, gameState);
    mp.setData('lobby_started', true);
};

export const TrioRevealHand = (
    mp: MPType,
    clientId: string,
    fromPlayerId: string,
    end: HandEnd
) => {
    const gameState = getGameState(mp);
    gameState.reveal_from_hand(clientId, fromPlayerId, end);
    sync(mp, gameState);
};

export const TrioRevealMiddle = (mp: MPType, clientId: string, slotIndex: number) => {
    const gameState = getGameState(mp);
    gameState.reveal_from_middle(clientId, slotIndex);
    sync(mp, gameState);
};

// Advance past the mismatch memorise / flip-back animation. Host-driven (the host
// schedules this once the animation has played); idempotent on the state side.
export const TrioFinishMismatch = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) {
        return; // only the host advances the animation, to avoid races
    }
    const gameState = getGameState(mp);
    gameState.finish_mismatch(clientId);
    sync(mp, gameState);
};

export const TrioRestartGame = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) {
        throw new Error('Only the host can restart the game');
    }
    const players = collectPlayers(mp);
    const mode = (mp.getData('trioMode') as GameMode) || 'simple';
    const gameState = new TrioGameState(players, mode);
    gameState.start_game(mode, players[0]);
    sync(mp, gameState);
};

export const TrioBackToLobby = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) {
        throw new Error('Only the host can return to the lobby');
    }
    mp.setData('lobby_started', false);
};
