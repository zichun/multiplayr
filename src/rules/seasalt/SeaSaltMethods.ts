/**
 * SeaSaltMethods.ts - RPC methods for Sea Salt & Paper.
 * Executed only on the host: rehydrate the game state, mutate it, persist it back.
 */

import { MPType } from '../../common/interfaces';
import { SeaSaltGameState, GameStateData, PileId } from './SeaSaltGameState';

export const getGameState = (mp: MPType): SeaSaltGameState => {
    let raw = mp.getData('gameState');
    if (!raw) throw new Error('Game state not found');
    if (typeof raw.get_data !== 'function') {
        raw = SeaSaltGameState.from_data(raw.data as GameStateData, raw.playerIds as string[]);
        mp.setData('gameState', raw);
    }
    return raw;
};

const sync = (mp: MPType, gameState: SeaSaltGameState) => {
    mp.setData('gameState', gameState);
};

const collectPlayers = (mp: MPType): string[] => {
    const players = [mp.hostId];
    mp.playersForEach((clientId) => players.push(clientId));
    return players;
};

export const SeaSaltStartGame = (mp: MPType) => {
    const players = collectPlayers(mp);
    if (players.length < 2 || players.length > 4) {
        throw new Error('Sea Salt & Paper requires 2 to 4 players.');
    }
    const gameState = new SeaSaltGameState(players);
    gameState.start_game(players[0]);
    sync(mp, gameState);
    mp.setData('lobby_started', true);
};

export const SeaSaltRestartGame = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) throw new Error('Only the host can restart the game');
    const players = collectPlayers(mp);
    const gameState = new SeaSaltGameState(players);
    gameState.start_game(players[0]);
    sync(mp, gameState);
};

export const SeaSaltBackToLobby = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) throw new Error('Only the host can return to the lobby');
    mp.setData('lobby_started', false);
};

export const SeaSaltDrawFromDeck = (mp: MPType, clientId: string) => {
    const gameState = getGameState(mp);
    gameState.draw_from_deck(clientId);
    sync(mp, gameState);
};

export const SeaSaltChooseDrawn = (mp: MPType, clientId: string, keepIndex: number, discardPile: PileId) => {
    const gameState = getGameState(mp);
    gameState.choose_drawn(clientId, keepIndex, discardPile);
    sync(mp, gameState);
};

export const SeaSaltTakeDiscard = (mp: MPType, clientId: string, pileId: PileId) => {
    const gameState = getGameState(mp);
    gameState.take_discard(clientId, pileId);
    sync(mp, gameState);
};

export const SeaSaltPlayDuo = (mp: MPType, clientId: string, cardId1: string, cardId2: string) => {
    const gameState = getGameState(mp);
    gameState.play_duo(clientId, cardId1, cardId2);
    sync(mp, gameState);
};

export const SeaSaltResolveCrab = (mp: MPType, clientId: string, pileId: PileId, cardIndex: number) => {
    const gameState = getGameState(mp);
    gameState.resolve_crab(clientId, pileId, cardIndex);
    sync(mp, gameState);
};

export const SeaSaltResolveSteal = (mp: MPType, clientId: string, targetId: string) => {
    const gameState = getGameState(mp);
    gameState.resolve_steal(clientId, targetId);
    sync(mp, gameState);
};

export const SeaSaltPassTurn = (mp: MPType, clientId: string) => {
    const gameState = getGameState(mp);
    gameState.pass_turn(clientId);
    sync(mp, gameState);
};

export const SeaSaltDeclareStop = (mp: MPType, clientId: string) => {
    const gameState = getGameState(mp);
    gameState.declare_stop(clientId);
    sync(mp, gameState);
};

export const SeaSaltDeclareLastChance = (mp: MPType, clientId: string) => {
    const gameState = getGameState(mp);
    gameState.declare_last_chance(clientId);
    sync(mp, gameState);
};

export const SeaSaltNextRound = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) throw new Error('Only the host can advance to the next round');
    const gameState = getGameState(mp);
    gameState.next_round(clientId);
    sync(mp, gameState);
};
