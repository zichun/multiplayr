/**
 * ProjectLMethods.ts — RPC methods for Project L.
 *
 * Standard/solo games use one shared host-authoritative state (`gameState`).
 * The **speed contest** instead keeps one independent game per player
 * (`speedStates[clientId]`), all built from a single shared seed so every racer
 * gets the identical deck. A player's action only ever touches their own state,
 * so there is no interference — only lightweight telemetry is shared (computed
 * in `onDataChange`).
 */

import { MPType } from '../../common/interfaces';
import { ProjectLGameState, GameStateData } from './ProjectLGameState';
import { ShapeId, SoloDifficulty } from './ProjectLData';

interface Resolved {
    gs: ProjectLGameState;
    save: () => void;
    speed: boolean;
}

function rehydrate(raw: any): ProjectLGameState {
    return typeof raw.get_data === 'function'
        ? raw
        : ProjectLGameState.from_data(raw.data as GameStateData, raw.playerIds as string[]);
}

/** Resolve the game state the given player acts on (shared, or their own race). */
function resolveState(mp: MPType, clientId: string): Resolved {
    if (mp.getData('speedMode')) {
        const states = mp.getData('speedStates') || {};
        const raw = states[clientId];
        if (!raw) throw new Error('No speed game for this player');
        const gs = rehydrate(raw);
        const save = () => {
            const all = mp.getData('speedStates') || {};
            all[clientId] = gs;
            mp.setData('speedStates', all);
            if (gs.get_cleared()) {
                const clears = mp.getData('speedClears') || {};
                if (clears[clientId] == null) {
                    clears[clientId] = Date.now();
                    mp.setData('speedClears', clears);
                }
            }
        };
        return { gs, save, speed: true };
    }
    const raw = mp.getData('gameState');
    if (!raw) throw new Error('Game state not found');
    const gs = rehydrate(raw);
    return { gs, save: () => mp.setData('gameState', gs), speed: false };
}

/** Back-compat helper for anything still wanting the shared standard state. */
export const getGameState = (mp: MPType): ProjectLGameState => resolveState(mp, mp.hostId).gs;

const collectPlayers = (mp: MPType): string[] => {
    if (mp.getPlayers) {
        return mp.getPlayers();
    }
    const players = [mp.hostId];
    mp.playersForEach((clientId) => players.push(clientId));
    return players;
};

// ---- lifecycle ----

function startFresh(mp: MPType) {
    const players = collectPlayers(mp);
    if (players.length < 1 || players.length > 6) {
        throw new Error('Project L supports 1 to 6 players.');
    }
    const gamemode = (mp.getData('projectl_gamemode') as string) || 'standard';

    if (gamemode === 'speed') {
        const seed = Math.floor(Math.random() * 0x7fffffff);
        const states: Record<string, ProjectLGameState> = {};
        for (const id of players) {
            const gs = new ProjectLGameState([id]);
            gs.start_game({ mode: 'speed', seed });
            states[id] = gs;
        }
        mp.setData('speedMode', true);
        mp.setData('speedSeed', seed);
        mp.setData('speedStart', Date.now());
        mp.setData('speedStates', states);
        mp.setData('speedClears', {});
        mp.setData('gameState', null);
    } else {
        const difficulty = (mp.getData('projectl_difficulty') as SoloDifficulty) || 'normal';
        const gs = new ProjectLGameState(players);
        gs.start_game({ mode: players.length === 1 ? 'solo' : 'multiplayer', difficulty });
        mp.setData('speedMode', false);
        mp.setData('gameState', gs);
    }
}

export const ProjectLStartGame = (mp: MPType) => {
    startFresh(mp);
    mp.setData('lobby_started', true);
};

export const ProjectLSetDifficulty = (mp: MPType, clientId: string, difficulty: SoloDifficulty) => {
    if (clientId !== mp.hostId) throw new Error('Only the host can set difficulty');
    mp.setData('projectl_difficulty', difficulty);
};

export const ProjectLSetGameMode = (mp: MPType, clientId: string, gamemode: string) => {
    if (clientId !== mp.hostId) throw new Error('Only the host can set the game mode');
    mp.setData('projectl_gamemode', gamemode);
};

export const ProjectLRestartGame = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) throw new Error('Only the host can restart');
    startFresh(mp);
};

export const ProjectLBackToLobby = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) throw new Error('Only the host can return to the lobby');
    mp.setData('lobby_started', false);
};

// ---- actions (route to the caller's own state) ----

const act = (mp: MPType, clientId: string, fn: (gs: ProjectLGameState) => void) => {
    const { gs, save } = resolveState(mp, clientId);
    fn(gs);
    save();
};

export const ProjectLTakeRow = (mp: MPType, clientId: string, deck: 'white' | 'black', slot: number) =>
    act(mp, clientId, (gs) => gs.take_from_row(clientId, deck, slot));

export const ProjectLTakeDeck = (mp: MPType, clientId: string, deck: 'white' | 'black') =>
    act(mp, clientId, (gs) => gs.take_from_deck(clientId, deck));

export const ProjectLTakeSoloGrid = (mp: MPType, clientId: string, pos: number) =>
    act(mp, clientId, (gs) => gs.take_solo_grid(clientId, pos));

export const ProjectLTakeSoloDeck = (mp: MPType, clientId: string) =>
    act(mp, clientId, (gs) => gs.take_solo_deck(clientId));

export const ProjectLRecycle = (mp: MPType, clientId: string, deck: 'white' | 'black', order?: number[]) =>
    act(mp, clientId, (gs) => gs.recycle(clientId, deck, order));

export const ProjectLUpgradeTakeL1 = (mp: MPType, clientId: string) =>
    act(mp, clientId, (gs) => gs.upgrade_take_l1(clientId));

export const ProjectLUpgradeSwap = (mp: MPType, clientId: string, fromShape: ShapeId, toShape: ShapeId) =>
    act(mp, clientId, (gs) => gs.upgrade_swap(clientId, fromShape, toShape));

export const ProjectLPlace = (mp: MPType, clientId: string, puzzleIndex: number, shapeId: ShapeId, mask: number) =>
    act(mp, clientId, (gs) => gs.place(clientId, puzzleIndex, shapeId, mask));

export const ProjectLMaster = (
    mp: MPType,
    clientId: string,
    placements: { puzzleIndex: number; shapeId: ShapeId; mask: number }[]
) => act(mp, clientId, (gs) => gs.master(clientId, placements));

export const ProjectLPass = (mp: MPType, clientId: string) =>
    act(mp, clientId, (gs) => gs.pass(clientId));

// ---- finishing touches (standard game only) ----

export const ProjectLFinishingPlace = (mp: MPType, clientId: string, puzzleIndex: number, shapeId: ShapeId, mask: number) =>
    act(mp, clientId, (gs) => gs.finishing_place(clientId, puzzleIndex, shapeId, mask));

export const ProjectLFinishingDone = (mp: MPType, clientId: string) =>
    act(mp, clientId, (gs) => gs.finishing_done(clientId));
