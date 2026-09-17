/**
 * MagicalAthletesMethods.ts - RPC methods for "Magical Athletes".
 * Executed only on the host: rehydrate the game state, mutate it, persist it back.
 */

import { MPType } from '../../common/interfaces';
import { MagicalAthletesGameState, GameStateData } from './MagicalAthletesGameState';

export const getGameState = (mp: MPType): MagicalAthletesGameState => {
    let raw = mp.getData('gameState');
    if (!raw) throw new Error('Game state not found');
    if (typeof raw.get_data !== 'function') {
        raw = MagicalAthletesGameState.from_data(raw.data as GameStateData, raw.playerIds as string[]);
        mp.setData('gameState', raw);
    }
    return raw;
};

const sync = (mp: MPType, gameState: MagicalAthletesGameState) => mp.setData('gameState', gameState);

const collectPlayers = (mp: MPType): string[] => {
    if (mp.getPlayers) {
        return mp.getPlayers();
    }
    const players = [mp.hostId];
    mp.playersForEach((clientId) => players.push(clientId));
    return players;
};

export const MagicalAthletesStartGame = (mp: MPType) => {
    const players = collectPlayers(mp);
    if (players.length < 2 || players.length > 6) {
        throw new Error('Magical Athletes requires 2 to 6 players.');
    }
    const gameState = new MagicalAthletesGameState(players);
    gameState.start_game(players[0]);
    sync(mp, gameState);
    mp.setData('lobby_started', true);
};

export const MagicalAthletesDraftPick = (mp: MPType, clientId: string, racerId: string) => {
    const gameState = getGameState(mp);
    gameState.draft_pick(clientId, racerId);
    sync(mp, gameState);
};

export const MagicalAthletesChooseRacer = (mp: MPType, clientId: string, racerId: string) => {
    const gameState = getGameState(mp);
    gameState.choose_racer(clientId, racerId);
    sync(mp, gameState);
};

export const MagicalAthletesRoll = (mp: MPType, clientId: string) => {
    const gameState = getGameState(mp);
    gameState.take_turn(clientId);
    sync(mp, gameState);
};

export const MagicalAthletesResolveDecision = (mp: MPType, clientId: string, optionId: string) => {
    const gameState = getGameState(mp);
    gameState.resolve_decision(clientId, optionId);
    sync(mp, gameState);
};

export const MagicalAthletesAdvanceRace = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) throw new Error('Only the host can advance the race');
    const gameState = getGameState(mp);
    gameState.advance_race(clientId);
    sync(mp, gameState);
};

export const MagicalAthletesRestartGame = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) throw new Error('Only the host can restart the game');
    const players = collectPlayers(mp);
    const gameState = new MagicalAthletesGameState(players);
    gameState.start_game(players[0]);
    sync(mp, gameState);
};

export const MagicalAthletesBackToLobby = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) throw new Error('Only the host can return to the lobby');
    mp.setData('lobby_started', false);
};
