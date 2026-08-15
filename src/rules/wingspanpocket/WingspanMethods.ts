/**
 * WingspanMethods.ts — RPC methods for Wingspan (Pocket). Executed only on the
 * host: each rehydrates the shared `gameState`, mutates it via the pure engine,
 * and commits it back (which triggers `onDataChange`).
 */

import { MPType } from '../../common/interfaces';
import {
    WingspanGameState, GameStateData, PlayPayment, DrawPick, ActivationChoices
} from './WingspanGameState';
import { GoalId } from './WingspanData';

function rehydrate(raw: any): WingspanGameState {
    return typeof raw.get_data === 'function'
        ? raw
        : WingspanGameState.from_data(raw.data as GameStateData, raw.playerIds as string[]);
}

export const getGameState = (mp: MPType): WingspanGameState => {
    const raw = mp.getData('gameState');
    if (!raw) throw new Error('Game state not found');
    return rehydrate(raw);
};

const collectPlayers = (mp: MPType): string[] => {
    const players = [mp.hostId as string];
    mp.playersForEach((clientId) => players.push(clientId));
    return players;
};

const act = (mp: MPType, fn: (gs: WingspanGameState) => void) => {
    const gs = getGameState(mp);
    fn(gs);
    mp.setData('gameState', gs);
};

// ---- lifecycle ----

function startFresh(mp: MPType) {
    const players = collectPlayers(mp);
    if (players.length < 2 || players.length > 5) {
        throw new Error('Wingspan Pocket supports 2 to 5 players.');
    }
    const advanced = !!mp.getData('wingspan_advanced');
    const gs = new WingspanGameState(players);
    gs.start_game({ advanced });
    mp.setData('gameState', gs);
}

export const WingspanStartGame = (mp: MPType) => {
    startFresh(mp);
    mp.setData('lobby_started', true);
};

export const WingspanSetAdvanced = (mp: MPType, clientId: string, advanced: boolean) => {
    if (clientId !== mp.hostId) throw new Error('Only the host can change the mode');
    mp.setData('wingspan_advanced', !!advanced);
};

export const WingspanRestartGame = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) throw new Error('Only the host can restart');
    startFresh(mp);
};

export const WingspanBackToLobby = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) throw new Error('Only the host can return to the lobby');
    mp.setData('lobby_started', false);
};

// ---- nest actions ----

export const WingspanPlayBird = (mp: MPType, clientId: string, cardId: number, payment: PlayPayment) =>
    act(mp, (gs) => gs.play_bird(clientId, cardId, payment));

export const WingspanDraw2 = (mp: MPType, clientId: string, picks: DrawPick[]) =>
    act(mp, (gs) => gs.draw_2(clientId, picks));

export const WingspanLayEggs = (mp: MPType, clientId: string, targets: number[]) =>
    act(mp, (gs) => gs.lay_eggs(clientId, targets));

// ---- activation ----

export const WingspanActivate = (mp: MPType, clientId: string, choices: ActivationChoices) =>
    act(mp, (gs) => gs.activate(clientId, choices || {}));

export const WingspanSkipActivation = (mp: MPType, clientId: string) =>
    act(mp, (gs) => gs.skip_activation(clientId));

export const WingspanEndActivation = (mp: MPType, clientId: string) =>
    act(mp, (gs) => gs.end_activation(clientId));

// ---- scoring ----

export const WingspanFinalize = (mp: MPType, clientId: string) =>
    act(mp, (gs) => gs.finalize());
