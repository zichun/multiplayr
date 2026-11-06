/**
 * JJMethods.ts — RPC methods for Jibber Jabble. Executed on the host: each
 * rehydrates the shared `gameState`, mutates it through the engine, and
 * commits it back (which triggers `onDataChange`).
 */

import { MPType } from '../../common/interfaces';
import { JJGameState, GameStateData, SignalKind } from './JJGameState';
import {
    MIN_PLAYERS, MAX_PLAYERS, DEFAULT_ROUNDS, MIN_ROUNDS, MAX_ROUNDS, MIN_TEAM_SIZE, MIN_TEAM_PLAYERS, Tier
} from './JJData';

export function rehydrate(raw: any): JJGameState {
    return typeof raw.get_data === 'function'
        ? raw
        : JJGameState.from_data(raw.data as GameStateData, raw.playerIds as string[]);
}

const getGameState = (mp: MPType): JJGameState => {
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

/**
 * Team lists for the given players: explicit lobby assignments first, then
 * anyone unassigned joins the smaller team (ties → Team Jibber), in seat order.
 */
export function resolveTeams(players: string[], assigned: Record<string, number> | null | undefined): string[][] {
    const teams: string[][] = [[], []];
    const loose: string[] = [];
    players.forEach(id => {
        const t = assigned ? assigned[id] : undefined;
        if (t === 0 || t === 1) teams[t].push(id); else loose.push(id);
    });
    loose.forEach(id => { (teams[0].length <= teams[1].length ? teams[0] : teams[1]).push(id); });
    return teams;
}

export function teamModeOn(mp: MPType, playerCount: number): boolean {
    return mp.getData('jj_mode') === 'teams' && playerCount >= MIN_TEAM_PLAYERS;
}

const act = (mp: MPType, fn: (gs: JJGameState) => void) => {
    const gs = getGameState(mp);
    fn(gs);
    mp.setData('gameState', gs);
};

// ---- lifecycle ----

function startFresh(mp: MPType) {
    const players = collectPlayers(mp);
    if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
        throw new Error(`Jibber Jabble needs ${MIN_PLAYERS} to ${MAX_PLAYERS} players.`);
    }
    let teams: string[][] | undefined;
    if (mp.getData('jj_mode') === 'teams') {
        if (players.length < MIN_TEAM_PLAYERS) throw new Error(`Team mode needs at least ${MIN_TEAM_PLAYERS} players.`);
        teams = resolveTeams(players, mp.getData('jj_teams'));
        if (teams.some(t => t.length < MIN_TEAM_SIZE)) throw new Error(`Each team needs at least ${MIN_TEAM_SIZE} players.`);
    }
    const gs = new JJGameState(players);
    gs.start_game({
        rounds: Number(mp.getData('jj_rounds')) || DEFAULT_ROUNDS,
        cluesPerRound: Number(mp.getData('jj_clues')) === 2 ? 2 : 3,
        hints: mp.getData('jj_hints') !== false,
        cardMode: mp.getData('jj_cards') === 'mixed' ? 'mixed' : 'fixed',
        teams
    });
    mp.setData('gameState', gs);
}

export const JJStartGame = (mp: MPType) => {
    startFresh(mp);
    mp.setData('lobby_started', true);
};

export const JJSetOption = (mp: MPType, clientId: string, key: string, value: any) => {
    if (clientId !== mp.hostId) throw new Error('Only the host can change options');
    if (key === 'rounds') {
        const r = Math.max(MIN_ROUNDS, Math.min(MAX_ROUNDS, Math.round(Number(value) || DEFAULT_ROUNDS)));
        mp.setData('jj_rounds', r);
    } else if (key === 'clues') {
        mp.setData('jj_clues', Number(value) === 2 ? 2 : 3);
    } else if (key === 'hints') {
        mp.setData('jj_hints', !!value);
    } else if (key === 'cards') {
        mp.setData('jj_cards', value === 'mixed' ? 'mixed' : 'fixed');
    } else if (key === 'mode') {
        mp.setData('jj_mode', value === 'teams' ? 'teams' : 'coop');
    }
};

/** Host moves one player to team 0 / 1. */
export const JJSetTeam = (mp: MPType, clientId: string, playerId: string, team: number) => {
    if (clientId !== mp.hostId) throw new Error('Only the host can arrange teams');
    const players = collectPlayers(mp);
    const current = resolveTeams(players, mp.getData('jj_teams'));
    const next: Record<string, number> = {};
    current.forEach((t, i) => t.forEach(id => { next[id] = i; }));
    if (players.indexOf(playerId) !== -1) next[playerId] = team === 1 ? 1 : 0;
    mp.setData('jj_teams', next);
};

/** Host deals everybody into two random, balanced teams. */
export const JJShuffleTeams = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) throw new Error('Only the host can arrange teams');
    const players = [...collectPlayers(mp)];
    for (let i = players.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [players[i], players[j]] = [players[j], players[i]];
    }
    const next: Record<string, number> = {};
    players.forEach((id, i) => { next[id] = i % 2; });
    mp.setData('jj_teams', next);
};

export const JJRestartGame = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) throw new Error('Only the host can restart');
    startFresh(mp);
};

export const JJBackToLobby = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) throw new Error('Only the host can return to the lobby');
    mp.setData('lobby_started', false);
};

// ---- play ----

export const JJChooseTier = (mp: MPType, clientId: string, tier: Tier) =>
    act(mp, gs => gs.choose_tier(clientId, tier));

export const JJChooseWord = (mp: MPType, clientId: string, wordIdx: number) =>
    act(mp, gs => gs.choose_word(clientId, wordIdx));

export const JJAddLetter = (mp: MPType, clientId: string, ch: string) =>
    act(mp, gs => gs.add_letter(clientId, ch));

export const JJStopClue = (mp: MPType, clientId: string, ch?: string) =>
    act(mp, gs => gs.stop_clue(clientId, ch));

export const JJSignal = (mp: MPType, clientId: string, kind: SignalKind) =>
    act(mp, gs => gs.signal(clientId, kind));

export const JJSubmitGuess = (mp: MPType, clientId: string, text: string) =>
    act(mp, gs => gs.submit_guess(clientId, text));

export const JJAllowGuess = (mp: MPType, clientId: string) =>
    act(mp, gs => gs.allow_guess(clientId));

export const JJNextRound = (mp: MPType, clientId: string) =>
    act(mp, gs => gs.next_round(clientId));

export const JJUseHint = (mp: MPType, clientId: string, arg?: number) =>
    act(mp, gs => gs.use_hint(clientId, arg));
