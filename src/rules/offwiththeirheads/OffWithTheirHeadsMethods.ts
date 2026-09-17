/**
 * OffWithTheirHeadsMethods.ts - RPC methods for "Off With Their Heads".
 * Executed only on the host: rehydrate the game state, mutate it, persist it back.
 */

import { MPType } from '../../common/interfaces';
import {
    OffWithTheirHeadsGameState as GameState,
    GameStateData,
    Zone
} from './OffWithTheirHeadsGameState';

export const getGameState = (mp: MPType): GameState => {
    let raw = mp.getData('gameState');
    if (!raw) throw new Error('Game state not found');
    if (typeof raw.get_data !== 'function') {
        raw = GameState.from_data(raw.data as GameStateData, raw.playerIds as string[]);
        mp.setData('gameState', raw);
    }
    return raw;
};

const sync = (mp: MPType, gs: GameState) => mp.setData('gameState', gs);

const collectPlayers = (mp: MPType): string[] => {
    if (mp.getPlayers) {
        return mp.getPlayers();
    }
    const players = [mp.hostId];
    mp.playersForEach((clientId) => players.push(clientId));
    return players;
};

export const OWTHStartGame = (mp: MPType) => {
    const players = collectPlayers(mp);
    if (players.length < 2 || players.length > 4) {
        throw new Error('Off With Their Heads requires 2 to 4 players.');
    }
    const gs = new GameState(players);
    gs.start_game();
    sync(mp, gs);
    mp.setData('lobby_started', true);
};

// Secretly pick a card for the current bout (revealed once everyone has picked).
export const OWTHSelectCard = (mp: MPType, clientId: string, cardId: string) => {
    const gs = getGameState(mp);
    gs.select_card(clientId, cardId);
    sync(mp, gs);
};

export const OWTHUnselectCard = (mp: MPType, clientId: string) => {
    const gs = getGameState(mp);
    gs.unselect_card(clientId);
    sync(mp, gs);
};

// Place the current pending mark. `zone`+`spaceId` name the destination; `aceValue`
// (1|11) is required for an Ace's rank mark; `teacupMode` consumes a teacup.
export const OWTHResolveMark = (
    mp: MPType,
    clientId: string,
    zone: Zone,
    spaceId: string,
    aceValue?: number,
    teacupMode?: 'zone' | 'color'
) => {
    const gs = getGameState(mp);
    gs.resolve_mark(clientId, {
        zone,
        spaceId,
        aceValue,
        teacup: teacupMode ? { mode: teacupMode } : null
    });
    sync(mp, gs);
};

// Forfeit the current mark when it has no legal placement.
export const OWTHSkipMark = (mp: MPType, clientId: string) => {
    const gs = getGameState(mp);
    gs.skip_mark(clientId);
    sync(mp, gs);
};

export const OWTHRestartGame = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) throw new Error('Only the host can restart the game');
    const players = collectPlayers(mp);
    const gs = new GameState(players);
    gs.start_game();
    sync(mp, gs);
};

export const OWTHBackToLobby = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) throw new Error('Only the host can return to the lobby');
    mp.setData('lobby_started', false);
};
