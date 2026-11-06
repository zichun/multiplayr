/**
 * HookyMethods.ts — RPC methods for Hooky. Executed on the host: each
 * rehydrates the shared `gameState`, mutates it through the engine, and
 * commits it back (which triggers `onDataChange`).
 */

import { MPType } from '../../common/interfaces';
import { HookyGameState, GameStateData } from './HookyGameState';
import { MIN_PLAYERS, MAX_PLAYERS } from './HookyData';

export function rehydrate(raw: any): HookyGameState {
    return typeof raw.get_data === 'function'
        ? raw
        : HookyGameState.from_data(raw.data as GameStateData, raw.playerIds as string[]);
}

const getGameState = (mp: MPType): HookyGameState => {
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

const act = (mp: MPType, fn: (gs: HookyGameState) => void) => {
    const gs = getGameState(mp);
    fn(gs);
    mp.setData('gameState', gs);
};

function startFresh(mp: MPType) {
    const players = collectPlayers(mp);
    if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
        throw new Error(`Hooky needs ${MIN_PLAYERS} to ${MAX_PLAYERS} players.`);
    }
    const gs = new HookyGameState(players);
    gs.start_game();
    mp.setData('gameState', gs);
}

export const HKStartGame = (mp: MPType) => {
    startFresh(mp);
    mp.setData('lobby_started', true);
};

export const HKRestartGame = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) throw new Error('Only the host can restart');
    startFresh(mp);
};

export const HKBackToLobby = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) throw new Error('Only the host can return to the lobby');
    mp.setData('lobby_started', false);
};

export const HKGiveClue = (mp: MPType, clientId: string, word: string, force?: boolean) =>
    act(mp, gs => gs.give_clue(clientId, word, !!force));

export const HKAsk = (mp: MPType, clientId: string, target: string, word: string, force?: boolean) =>
    act(mp, gs => gs.ask(clientId, target, word, !!force));

export const HKReveal = (mp: MPType, clientId: string, letter: string, target: string) =>
    act(mp, gs => { gs.reveal(clientId, letter, target); });

export const HKEndTurn = (mp: MPType, clientId: string) =>
    act(mp, gs => gs.end_turn(clientId));

export const HKGuessHooky = (mp: MPType, clientId: string, letters: string[]) =>
    act(mp, gs => gs.guess_hooky(clientId, letters));

export const HKSubmitFinal = (mp: MPType, clientId: string, guesses: Record<string, string[]>) =>
    act(mp, gs => gs.submit_final(clientId, guesses));
