/**
 * NightZooMethods.ts — RPC methods for Night at the Zoo.
 *
 * Every method runs on the host. Lifecycle methods (start / restart / lobby)
 * are host-only; gameplay methods rehydrate the shared `gameState`, mutate it,
 * and save it back (which triggers the reconciliation tick in nightzoo.tsx).
 */

import { MPType } from '../../common/interfaces';
import { NightZooGameState, GameStateData, MoveOption } from './NightZooGameState';
import { AnimalType, Terrain, ActionSymbol } from './NightZooData';

function rehydrate(raw: any): NightZooGameState {
    return typeof raw?.get_data === 'function'
        ? raw
        : NightZooGameState.from_data(raw.data as GameStateData, raw.playerIds as string[]);
}

function getGS(mp: MPType): NightZooGameState {
    const raw = mp.getData('gameState');
    if (!raw) throw new Error('Game not started');
    return rehydrate(raw);
}

function collectPlayers(mp: MPType): string[] {
    const players = [mp.hostId as string];
    mp.playersForEach((clientId: string) => players.push(clientId));
    return players;
}

function startFresh(mp: MPType): void {
    const players = collectPlayers(mp);
    if (players.length < 1 || players.length > 4) {
        throw new Error('Night at the Zoo supports 1 to 4 players.');
    }
    const gs = new NightZooGameState(players);
    gs.start_game();
    mp.setData('gameState', gs);
}

// ---- lifecycle -------------------------------------------------------------

export const NightZooStartGame = (mp: MPType) => {
    startFresh(mp);
    mp.setData('lobby_started', true);
};

export const NightZooRestartGame = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) throw new Error('Only the host can restart');
    startFresh(mp);
};

export const NightZooBackToLobby = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) throw new Error('Only the host can return to the lobby');
    mp.setData('lobby_started', false);
};

// ---- gameplay --------------------------------------------------------------

const act = (mp: MPType, fn: (gs: NightZooGameState) => void) => {
    const gs = getGS(mp);
    fn(gs);
    mp.setData('gameState', gs);
};

export const NightZooDraft = (mp: MPType, clientId: string, slot: number) =>
    act(mp, gs => gs.draft_take(clientId, slot));

export const NightZooPlaceTile = (mp: MPType, clientId: string, tileId: string, r: number, c: number, actionChoice?: ActionSymbol) =>
    act(mp, gs => gs.place_tile(clientId, tileId, r, c, actionChoice));

export const NightZooWarehouseTile = (mp: MPType, clientId: string, tileId: string) =>
    act(mp, gs => gs.warehouse_tile(clientId, tileId));

export const NightZooDeployWarehouse = (mp: MPType, clientId: string, slot: number) =>
    act(mp, gs => gs.deploy_warehouse(clientId, slot));

export const NightZooDiscardTile = (mp: MPType, clientId: string, tileId: string) =>
    act(mp, gs => gs.discard_tile(clientId, tileId));

export const NightZooResolveDiscover = (mp: MPType, clientId: string, type: AnimalType, r: number, c: number) =>
    act(mp, gs => gs.resolve_discover(clientId, type, r, c));

export const NightZooResolveBonus = (mp: MPType, clientId: string, terrain: Terrain) =>
    act(mp, gs => gs.resolve_bonus(clientId, terrain));

export const NightZooResolveMove = (mp: MPType, clientId: string, figureId: string, option: MoveOption) =>
    act(mp, gs => gs.resolve_move(clientId, figureId, option));

export const NightZooSkipMove = (mp: MPType, clientId: string, figureId?: string) =>
    act(mp, gs => gs.skip_move(clientId, figureId));

export const NightZooFinishPlacement = (mp: MPType, clientId: string) =>
    act(mp, gs => gs.finish_placement(clientId));

export const NightZooFinishEndMove = (mp: MPType, clientId: string) =>
    act(mp, gs => gs.finish_end_move(clientId));
