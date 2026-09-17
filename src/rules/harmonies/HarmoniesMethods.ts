/**
 * HarmoniesMethods.ts
 *
 * Remote methods for Harmonies executed on the Host.
 */

import { MPType } from '../../common/interfaces';
import { HarmoniesGameState } from './HarmoniesGameState';

const getGameState = (mp: MPType): HarmoniesGameState => {
    let gameState = mp.getData('gameState');
    if (!gameState) return null;
    if (!gameState.take_market_tokens) {
        gameState = HarmoniesGameState.from_data(gameState.data || gameState);
    }
    return gameState;
};

const syncGameState = (mp: MPType, gameState: HarmoniesGameState) => {
    mp.setData('gameState', gameState);
};

const collectPlayers = (mp: MPType): string[] => {
    if (mp.getPlayers) {
        return mp.getPlayers();
    }
    const players: string[] = [mp.hostId];
    mp.playersForEach((clientId) => {
        if (!players.includes(clientId)) {
            players.push(clientId);
        }
    });
    return players;
};

export const HarmoniesSetBoardSide = (mp: MPType, clientId: string, boardSide: 'A' | 'B') => {
    if (clientId !== mp.hostId) throw new Error('Only the host can choose the board side');
    mp.setData('harmonies_boardSide', boardSide === 'B' ? 'B' : 'A');
};

export const HarmoniesStartGame = (mp: MPType, clientId: string, boardSide?: 'A' | 'B') => {
    const players = collectPlayers(mp);
    if (players.length < 1) {
        alert('Need at least 1 player to play Harmonies');
        return;
    }
    if (players.length > 4) {
        alert('Maximum 4 players allowed for Harmonies');
        return;
    }

    const side: 'A' | 'B' = boardSide || (mp.getData('harmonies_boardSide') as 'A' | 'B') || 'A';
    const gameState = new HarmoniesGameState(players, side);
    syncGameState(mp, gameState);
    mp.setData('harmonies_boardSide', side);
    mp.setData('lobby_started', true);
};

export const HarmoniesTakeMarketTokens = (mp: MPType, clientId: string, spaceIndex: number) => {
    const gameState = getGameState(mp);
    if (!gameState) return;
    gameState.take_market_tokens(clientId, spaceIndex);
    syncGameState(mp, gameState);
};

export const HarmoniesPlaceToken = (mp: MPType, clientId: string, q: number, r: number, tokenIndex?: number) => {
    const gameState = getGameState(mp);
    if (!gameState) return;
    gameState.place_token(clientId, q, r, tokenIndex ?? 0);
    syncGameState(mp, gameState);
};

export const HarmoniesUndoTokenDraft = (mp: MPType, clientId: string) => {
    const gameState = getGameState(mp);
    if (!gameState) return;
    try {
        gameState.undo_token_draft(clientId);
        syncGameState(mp, gameState);
    } catch (e: any) {
        console.warn('Undo token draft error:', e.message);
    }
};

export const HarmoniesUndoTokenPlacement = (mp: MPType, clientId: string) => {
    const gameState = getGameState(mp);
    if (!gameState) return;
    try {
        gameState.undo_token_placement(clientId);
        syncGameState(mp, gameState);
    } catch (e: any) {
        console.warn('Undo token placement error:', e.message);
    }
};

export const HarmoniesTakeCard = (mp: MPType, clientId: string, cardId: string) => {
    const gameState = getGameState(mp);
    if (!gameState) return;
    gameState.take_animal_card(clientId, cardId);
    syncGameState(mp, gameState);
};

export const HarmoniesPlaceCube = (mp: MPType, clientId: string, cardId: string, q: number, r: number) => {
    const gameState = getGameState(mp);
    if (!gameState) return;
    gameState.place_animal_cube(clientId, cardId, q, r);
    syncGameState(mp, gameState);
};

export const HarmoniesUndoTakeCard = (mp: MPType, clientId: string) => {
    const gameState = getGameState(mp);
    if (!gameState) return;
    try {
        gameState.undo_take_animal_card(clientId);
        syncGameState(mp, gameState);
    } catch (e: any) {
        console.warn('Undo take card error:', e.message);
    }
};

export const HarmoniesUndoPlaceCube = (mp: MPType, clientId: string) => {
    const gameState = getGameState(mp);
    if (!gameState) return;
    try {
        gameState.undo_animal_cube(clientId);
        syncGameState(mp, gameState);
    } catch (e: any) {
        console.warn('Undo place cube error:', e.message);
    }
};

export const HarmoniesEndTurn = (mp: MPType, clientId: string) => {
    const gameState = getGameState(mp);
    if (!gameState) return;
    gameState.end_turn(clientId);
    syncGameState(mp, gameState);
};

export const HarmoniesRestartGame = (mp: MPType, clientId: string) => {
    const players = collectPlayers(mp);
    const prev = getGameState(mp);
    const side = prev ? prev.get_data().boardSide : 'A';
    const gameState = new HarmoniesGameState(players, side);
    syncGameState(mp, gameState);
};

export const HarmoniesBackToLobby = (mp: MPType, clientId: string) => {
    mp.setData('lobby_started', false);
};
