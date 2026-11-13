/**
 * CKMethods.ts — RPC methods for Critter Kitchen. Executed on the host: each
 * rehydrates the shared `gameState`, mutates it through the engine and commits
 * it back (which triggers `onDataChange`).
 */

import { MPType } from '../../common/interfaces';
import { CKGameState, GameStateData, ChefKey } from './CKGameState';
import { LocId, RestId, CKOptions, DEFAULT_OPTIONS } from './CKData';
import { ChallengePlate, CriticPlate } from './CKMeals';

export function rehydrate(raw: any): CKGameState {
    return typeof raw.get_data === 'function'
        ? raw
        : CKGameState.from_data(raw.data as GameStateData, raw.playerIds as string[]);
}

const getGameState = (mp: MPType): CKGameState => {
    const raw = mp.getData('gameState');
    if (!raw) throw new Error('Game state not found');
    return rehydrate(raw);
};

export const collectPlayers = (mp: MPType): string[] => {
    if (mp.getPlayers) return mp.getPlayers();
    const players = [mp.hostId as string];
    mp.playersForEach((clientId) => players.push(clientId));
    return players;
};

const act = (mp: MPType, fn: (gs: CKGameState) => void) => {
    const gs = getGameState(mp);
    fn(gs);
    mp.setData('gameState', gs);
};

export function readOptions(mp: MPType): CKOptions {
    const o = mp.getData('ck_options');
    return { ...DEFAULT_OPTIONS, ...(o || {}) };
}

function startFresh(mp: MPType) {
    const players = collectPlayers(mp);
    if (players.length < 2 || players.length > 5) throw new Error('Critter Kitchen needs 2 to 5 players.');
    const gs = new CKGameState(players);
    gs.start_game(readOptions(mp));
    mp.setData('gameState', gs);
}

const hostOnly = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) throw new Error('Only the host can do that');
};

export const CKStartGame = (mp: MPType) => {
    startFresh(mp);
    mp.setData('lobby_started', true);
};
export const CKRestartGame = (mp: MPType, clientId: string) => { hostOnly(mp, clientId); startFresh(mp); };
export const CKBackToLobby = (mp: MPType, clientId: string) => { hostOnly(mp, clientId); mp.setData('lobby_started', false); };

export const CKSetOption = (mp: MPType, clientId: string, key: keyof CKOptions, value: boolean) => {
    hostOnly(mp, clientId);
    const o = readOptions(mp);
    if (!(key in DEFAULT_OPTIONS)) throw new Error('Unknown option');
    (o as any)[key] = !!value;
    mp.setData('ck_options', o);
};

export const CKChooseRestaurateur = (mp: MPType, clientId: string, rest: RestId, guySlot?: number) =>
    act(mp, gs => gs.choose_restaurateur(clientId, rest, guySlot));
export const CKSubmitPlan = (mp: MPType, clientId: string, plan: Record<ChefKey, LocId>) =>
    act(mp, gs => gs.submit_plan(clientId, plan));
export const CKUnsubmit = (mp: MPType, clientId: string) =>
    act(mp, gs => gs.unsubmit(clientId));
export const CKPick = (mp: MPType, clientId: string, itemId: number, wildSlot?: number) =>
    act(mp, gs => gs.pick(clientId, itemId, wildSlot));
export const CKLeaveEarly = (mp: MPType, clientId: string, useBag?: boolean) =>
    act(mp, gs => gs.leave_early(clientId, !!useBag));
export const CKTakeStar = (mp: MPType, clientId: string) =>
    act(mp, gs => gs.take_star(clientId));
export const CKSubmitChallenges = (mp: MPType, clientId: string, plates: ChallengePlate[]) =>
    act(mp, gs => gs.submit_challenges(clientId, plates || []));
export const CKSubmitFridge = (mp: MPType, clientId: string, discard: number[]) =>
    act(mp, gs => gs.submit_fridge(clientId, discard || []));
export const CKSubmitCritic = (mp: MPType, clientId: string, plate: CriticPlate) =>
    act(mp, gs => gs.submit_critic(clientId, plate || {}));

/** Host nudge: let the engine act for a stalled player (or yourself). */
export const CKAutoAct = (mp: MPType, clientId: string, target?: string) => {
    const who = target || clientId;
    if (who !== clientId) hostOnly(mp, clientId);
    act(mp, gs => gs.auto_act(who));
};
