/**
 * QuacksMethods.ts — RPC methods for Quacks. Executed only on the host: each
 * rehydrates the shared `gameState`, mutates it through the pure engine, and
 * commits it back (which triggers `onDataChange`).
 */

import { MPType } from '../../common/interfaces';
import { QuacksGameState, GameStateData } from './QuacksGameState';
import { MIN_PLAYERS, maxPlayers, Chip, bookChoices, normalizeBookSets, uniformBookSets, ChipColor } from './QuacksData';

function rehydrate(raw: any): QuacksGameState {
    return typeof raw.get_data === 'function'
        ? raw
        : QuacksGameState.from_data(raw.data as GameStateData, raw.playerIds as string[]);
}

export const getGameState = (mp: MPType): QuacksGameState => {
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

const act = (mp: MPType, fn: (gs: QuacksGameState) => void) => {
    const gs = getGameState(mp);
    fn(gs);
    mp.setData('gameState', gs);
};

// ---- lifecycle ----

function startFresh(mp: MPType) {
    const players = collectPlayers(mp);
    const herb = !!mp.getData('quacks_herb');
    const alch = !!mp.getData('quacks_alch');
    if (players.length < MIN_PLAYERS || players.length > maxPlayers(herb)) {
        throw new Error(`Quacks supports ${MIN_PLAYERS} to ${maxPlayers(herb)} players.`);
    }
    const gs = new QuacksGameState(players);
    gs.start_game({
        bookSets: normalizeBookSets(mp.getData('quacks_books'), 1, herb, alch),
        stirAlways: !!mp.getData('quacks_stir'),
        herbWitches: herb,
        alchemists: alch
    });
    mp.setData('gameState', gs);
}

export const QuacksStartGame = (mp: MPType) => {
    startFresh(mp);
    mp.setData('lobby_started', true);
};

export const QuacksSetOption = (mp: MPType, clientId: string, key: string, value: any) => {
    if (clientId !== mp.hostId) throw new Error('Only the host can change the setup');
    const herb = !!mp.getData('quacks_herb');
    const alch = !!mp.getData('quacks_alch');
    if (key === 'set') {
        // a preset: every book from the same set (keeping the locoweed pick, which belongs to no set)
        const keep = normalizeBookSets(mp.getData('quacks_books'), 1, herb, alch).herb;
        const books = uniformBookSets(Number(value) || 1, herb, alch);
        if (alch && keep >= 7) books.herb = keep;
        mp.setData('quacks_books', books);
    } else if (key === 'book') {
        // one colour's book: { color, set }
        const choices = value ? bookChoices(value.color as ChipColor, herb, alch) : [];
        if (choices.length < 2) throw new Error('That book cannot be changed');
        const set = Math.round(Number(value.set));
        if (choices.indexOf(set) === -1) throw new Error('No such set');
        const books = normalizeBookSets(mp.getData('quacks_books'), 1, herb, alch);
        books[value.color] = set;
        mp.setData('quacks_books', books);
    } else if (key === 'herb') {
        // the Herb Witches expansion; switching it off drops any set 5/6 picks
        mp.setData('quacks_herb', !!value);
        mp.setData('quacks_books', normalizeBookSets(mp.getData('quacks_books'), 1, !!value, alch));
    } else if (key === 'alch') {
        // The Alchemists; a locoweed book becomes compulsory while it is on
        mp.setData('quacks_alch', !!value);
        mp.setData('quacks_books', normalizeBookSets(mp.getData('quacks_books'), 1, herb, !!value));
    } else if (key === 'stir') {
        mp.setData('quacks_stir', !!value);
    }
};

export const QuacksRestartGame = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) throw new Error('Only the host can restart');
    startFresh(mp);
};

export const QuacksBackToLobby = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) throw new Error('Only the host can return to the lobby');
    mp.setData('lobby_started', false);
};

// ---- play ----

export const QuacksDraw = (mp: MPType, clientId: string) => act(mp, (gs) => gs.draw(clientId));
export const QuacksStop = (mp: MPType, clientId: string) => act(mp, (gs) => gs.stop(clientId));
export const QuacksUseFlask = (mp: MPType, clientId: string) => act(mp, (gs) => gs.use_flask(clientId));

export const QuacksChoose = (mp: MPType, clientId: string, optionId: string) =>
    act(mp, (gs) => gs.resolve_prompt(clientId, optionId));

export const QuacksBuy = (mp: MPType, clientId: string, chips: Chip[]) =>
    act(mp, (gs) => gs.buy(clientId, Array.isArray(chips) ? chips : []));

export const QuacksSpendRubies = (mp: MPType, clientId: string, on: 'droplet' | 'flask') =>
    act(mp, (gs) => gs.spend_rubies(clientId, on));

export const QuacksReady = (mp: MPType, clientId: string) => act(mp, (gs) => gs.ready(clientId));

export const QuacksLayReserve = (mp: MPType, clientId: string, index: number) =>
    act(mp, (gs) => gs.lay_reserve(clientId, Number(index)));

export const QuacksUseWitch = (mp: MPType, clientId: string, metal: string) =>
    act(mp, (gs) => gs.use_witch(clientId, String(metal)));

export const QuacksLayHand = (mp: MPType, clientId: string, index: number) =>
    act(mp, (gs) => gs.lay_hand(clientId, Number(index)));

export const QuacksForget = (mp: MPType, clientId: string, index: number) =>
    act(mp, (gs) => gs.forget(clientId, Number(index)));

export const QuacksNeighbourBomb = (mp: MPType, clientId: string) =>
    act(mp, (gs) => gs.neighbour_bomb(clientId));
