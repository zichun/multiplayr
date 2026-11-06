/**
 * ParksMethods.ts — RPC methods for Parks. Executed only on the host: each
 * rehydrates the shared `gameState`, mutates it through the pure engine, and
 * commits it back (which triggers `onDataChange`).
 */

import { MPType } from '../../common/interfaces';
import { ParksGameState, GameStateData, Area } from './ParksGameState';
import { MIN_PLAYERS, MAX_PLAYERS, NfModules, nfModulesOf, WlModules, wlModulesOf } from './ParksData';

function rehydrate(raw: any): ParksGameState {
    return typeof raw.get_data === 'function'
        ? raw
        : ParksGameState.from_data(raw.data as GameStateData, raw.playerIds as string[]);
}

export const getGameState = (mp: MPType): ParksGameState => {
    const raw = mp.getData('gameState');
    if (!raw) throw new Error('Game state not found');
    return rehydrate(raw);
};

const collectPlayers = (mp: MPType): string[] => {
    if (mp.getPlayers) return mp.getPlayers();
    const players = [mp.hostId as string];
    mp.playersForEach((clientId) => players.push(clientId));
    return players;
};

const act = (mp: MPType, fn: (gs: ParksGameState) => void) => {
    const gs = getGameState(mp);
    fn(gs);
    mp.setData('gameState', gs);
};

// ---- lifecycle ----

function startFresh(mp: MPType) {
    const players = collectPlayers(mp);
    if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
        throw new Error(`Parks supports ${MIN_PLAYERS} to ${MAX_PLAYERS} players.`);
    }
    const gs = new ParksGameState(players);
    gs.start_game({
        firstGame: !!mp.getData('parks_firstGame'),
        nightfall: nfModulesOf(mp.getData('parks_nightfall')),
        wildlife: wlModulesOf(mp.getData('parks_wildlife'))
    });
    mp.setData('gameState', gs);
}

export const ParksStartGame = (mp: MPType) => {
    startFresh(mp);
    mp.setData('lobby_started', true);
};

export const ParksSetFirstGame = (mp: MPType, clientId: string, firstGame: boolean) => {
    if (clientId !== mp.hostId) throw new Error('Only the host can change this');
    mp.setData('parks_firstGame', !!firstGame);
};

/** `on` is the whole expansion (true/false) or a pick of its parts. */
export const ParksSetNightfall = (mp: MPType, clientId: string, on: boolean | Partial<NfModules>) => {
    if (clientId !== mp.hostId) throw new Error('Only the host can change this');
    mp.setData('parks_nightfall', nfModulesOf(on));
};

/** `on` is the whole Wildlife expansion (true/false) or a pick of its parts. */
export const ParksSetWildlife = (mp: MPType, clientId: string, on: boolean | Partial<WlModules>) => {
    if (clientId !== mp.hostId) throw new Error('Only the host can change this');
    mp.setData('parks_wildlife', wlModulesOf(on));
};

export const ParksRestartGame = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) throw new Error('Only the host can restart');
    startFresh(mp);
};

export const ParksBackToLobby = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) throw new Error('Only the host can return to the lobby');
    mp.setData('lobby_started', false);
};

// ---- play ----

export const ParksPickYear = (mp: MPType, clientId: string, yearId: string) =>
    act(mp, (gs) => gs.pick_year(clientId, yearId));

export const ParksMoveToSite = (mp: MPType, clientId: string, hiker: number, slot: number) =>
    act(mp, (gs) => gs.move_to_site(clientId, hiker, slot));

export const ParksMoveToEnd = (mp: MPType, clientId: string, hiker: number, area: Area) =>
    act(mp, (gs) => gs.move_to_end(clientId, hiker, area));

export const ParksTent = (mp: MPType, clientId: string, hiker: number) =>
    act(mp, (gs) => gs.tent_revisit(clientId, hiker));

export const ParksRespond = (mp: MPType, clientId: string, answer: any) =>
    act(mp, (gs) => gs.respond(clientId, answer));
