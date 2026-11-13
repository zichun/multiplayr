/**
 * DecorumMethods.ts — RPC methods for Décorum. Executed on the host: each
 * rehydrates the shared `gameState`, mutates it through the engine and commits
 * it back (which triggers `onDataChange`).
 */

import { MPType } from '../../common/interfaces';
import { DecorumGameState, GameStateData } from './DecorumGameState';
import { Level, LEVELS, Move, Reaction, Mood, MIN_PLAYERS, MAX_PLAYERS, parseScenarioCode } from './DecorumData';

export interface DCOptions {
    level: Level;
    /** A scenario code to replay ("3H-1A2B"), or '' for a fresh scenario. */
    code: string;
    /** Draw house twists for fresh scenarios. */
    twists: boolean;
}

export const DEFAULT_OPTIONS: DCOptions = { level: 'easy', code: '', twists: true };

export function rehydrate(raw: any): DecorumGameState {
    return typeof raw.get_data === 'function'
        ? raw
        : DecorumGameState.from_data(raw.data as GameStateData, raw.playerIds as string[]);
}

const getGameState = (mp: MPType): DecorumGameState => {
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

const act = (mp: MPType, fn: (gs: DecorumGameState) => void) => {
    const gs = getGameState(mp);
    fn(gs);
    mp.setData('gameState', gs);
};

export function readOptions(mp: MPType): DCOptions {
    const o = mp.getData('dc_options');
    const merged = { ...DEFAULT_OPTIONS, ...(o || {}) };
    if (LEVELS.indexOf(merged.level) === -1) merged.level = DEFAULT_OPTIONS.level;
    merged.twists = merged.twists !== false;
    return merged;
}

const hostOnly = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) throw new Error('Only the host can do that');
};

/** Start a game. `seed` replays a specific scenario; otherwise the lobby code (if it fits) or a fresh one. */
function startFresh(mp: MPType, override?: { level: Level; seed: number; twists: boolean }) {
    const players = collectPlayers(mp);
    if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
        throw new Error(`Décorum needs ${MIN_PLAYERS} to ${MAX_PLAYERS} players.`);
    }
    const opts = readOptions(mp);
    let level = opts.level;
    let seed: number | undefined;
    let twists = opts.twists;
    if (override) {
        level = override.level;
        seed = override.seed;
        twists = override.twists;
    } else {
        const parsed = parseScenarioCode(opts.code);
        if (parsed && parsed.players === players.length) { level = parsed.level; seed = parsed.seed; twists = parsed.twists; }
    }
    const gs = new DecorumGameState(players);
    const prev = mp.getData('gameState');
    if (prev) {
        // keep game ids increasing so clients reset their per-game UI state
        try { (gs as any).data = { gameId: rehydrate(prev).get_data().gameId }; } catch (e) { /* ignore */ }
    }
    gs.start_game({ level, seed, twists });
    mp.setData('gameState', gs);
}

export const DCStartGame = (mp: MPType) => {
    startFresh(mp);
    mp.setData('lobby_started', true);
};

/** Host: a brand-new scenario at the same level. */
export const DCRestartGame = (mp: MPType, clientId: string) => {
    hostOnly(mp, clientId);
    const raw = mp.getData('gameState');
    const prev = raw ? rehydrate(raw).get_data().scenario : null;
    const level = prev ? prev.level : readOptions(mp).level;
    const twists = prev ? (parseScenarioCode(prev.code) || { twists: true }).twists : readOptions(mp).twists;
    startFresh(mp, { level, twists, seed: Math.floor(Math.random() * 0xffffffff) >>> 0 });
};

/** Host: the same scenario again (same code). */
export const DCReplayScenario = (mp: MPType, clientId: string) => {
    hostOnly(mp, clientId);
    const raw = mp.getData('gameState');
    if (!raw) throw new Error('No scenario to replay');
    const s = rehydrate(raw).get_data().scenario;
    if (s.players !== collectPlayers(mp).length) throw new Error('The player count has changed — start a new scenario');
    startFresh(mp, { level: s.level, seed: s.seed, twists: (parseScenarioCode(s.code) || { twists: true }).twists });
};

export const DCBackToLobby = (mp: MPType, clientId: string) => {
    hostOnly(mp, clientId);
    mp.setData('lobby_started', false);
};

export const DCSetOption = (mp: MPType, clientId: string, key: string, value: any) => {
    hostOnly(mp, clientId);
    const o = readOptions(mp);
    if (key === 'level' && LEVELS.indexOf(value) !== -1) o.level = value;
    else if (key === 'code') o.code = String(value || '').toUpperCase().slice(0, 12);
    else if (key === 'twists') o.twists = !!value;
    else return;
    mp.setData('dc_options', o);
};

export const DCAct = (mp: MPType, clientId: string, move: Move) => act(mp, gs => gs.act(clientId, move));
export const DCSwitch = (mp: MPType, clientId: string, kick: string | null) => act(mp, gs => gs.switch_rooms(clientId, kick ?? null));
export const DCPass = (mp: MPType, clientId: string) => act(mp, gs => gs.pass(clientId));
export const DCReact = (mp: MPType, clientId: string, logId: number, kind: Reaction) => act(mp, gs => gs.react(clientId, logId, kind));
export const DCVoteEarly = (mp: MPType, clientId: string, on: boolean) => act(mp, gs => gs.vote_early(clientId, !!on));
export const DCShare = (mp: MPType, clientId: string, cond: number | null, to?: string) => act(mp, gs => gs.meeting_share(clientId, cond, to));
export const DCMood = (mp: MPType, clientId: string, mood: Mood, target?: string | null) => act(mp, gs => gs.meeting_mood(clientId, mood, target));
