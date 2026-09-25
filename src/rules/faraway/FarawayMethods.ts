/**
 * FarawayMethods.ts — RPC methods for Faraway. Executed only on the host: each
 * rehydrates the shared `gameState`, mutates it through the pure engine, and
 * commits it back (which triggers `onDataChange`).
 */

import { MPType } from '../../common/interfaces';
import { FarawayGameState, GameStateData } from './FarawayGameState';
import { MIN_PLAYERS, MAX_PLAYERS } from './FarawayData';

function rehydrate(raw: any): FarawayGameState {
    return typeof raw.get_data === 'function'
        ? raw
        : FarawayGameState.from_data(raw.data as GameStateData, raw.playerIds as string[]);
}

export const getGameState = (mp: MPType): FarawayGameState => {
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

const act = (mp: MPType, fn: (gs: FarawayGameState) => void) => {
    const gs = getGameState(mp);
    fn(gs);
    mp.setData('gameState', gs);
};

// ---- lifecycle ----

function startFresh(mp: MPType) {
    const players = collectPlayers(mp);
    if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
        throw new Error(`Faraway supports ${MIN_PLAYERS} to ${MAX_PLAYERS} players.`);
    }
    const advanced = !!mp.getData('faraway_advanced');
    const gs = new FarawayGameState(players);
    gs.start_game({ advanced });
    mp.setData('gameState', gs);
}

export const FarawayStartGame = (mp: MPType) => {
    startFresh(mp);
    mp.setData('lobby_started', true);
};

export const FarawaySetAdvanced = (mp: MPType, clientId: string, advanced: boolean) => {
    if (clientId !== mp.hostId) throw new Error('Only the host can change the mode');
    mp.setData('faraway_advanced', !!advanced);
};

export const FarawayRestartGame = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) throw new Error('Only the host can restart');
    startFresh(mp);
};

export const FarawayBackToLobby = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) throw new Error('Only the host can return to the lobby');
    mp.setData('lobby_started', false);
};

// ---- play ----

export const FarawayDraftKeep = (mp: MPType, clientId: string, keep: number[]) =>
    act(mp, (gs) => gs.draft_keep(clientId, keep));

export const FarawayCommit = (mp: MPType, clientId: string, cardId: number) =>
    act(mp, (gs) => gs.commit(clientId, cardId));

export const FarawayUncommit = (mp: MPType, clientId: string) =>
    act(mp, (gs) => gs.uncommit(clientId));

export const FarawayTakeMarket = (mp: MPType, clientId: string, marketIndex: number) =>
    act(mp, (gs) => gs.take_market(clientId, marketIndex));

export const FarawayKeepSanctuary = (mp: MPType, clientId: string, sanctuaryId: string) =>
    act(mp, (gs) => gs.keep_sanctuary(clientId, sanctuaryId));
