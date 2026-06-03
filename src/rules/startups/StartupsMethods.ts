/**
 * StartupsMethods.ts - Game methods for Startups
 */

import { MPType } from '../../common/interfaces';
import { StartupsGameState as GameState, Company } from './StartupsGameState';

const getGameState = (mp: MPType): GameState => {
    return mp.getData('gameState');
};

const syncGameStateToMP = (mp: MPType, gameState: GameState) => {
    mp.setData('gameState', gameState);
};

export const StartupsStartGame = (mp: MPType) => {
    const playerCount = mp.playersCount() + 1; // Host is a player

    if (playerCount < 3) {
        alert('We need at least 3 players to play Startups');
        return;
    }

    if (playerCount > 7) {
        alert('Maximum 7 players allowed for Startups');
        return;
    }

    const players = [mp.hostId];
    mp.playersForEach((clientId) => players.push(clientId));
    const gameState = new GameState(players);
    gameState.start_game();
    syncGameStateToMP(mp, gameState);

    mp.setData('lobby_started', true);
};

export const StartupsDrawFromDeck = (mp: MPType, clientId: string) => {
    const gameState = getGameState(mp);
    gameState.draw_from_deck(clientId);
    syncGameStateToMP(mp, gameState);
};

export const StartupsTakeFromMarket = (mp: MPType, clientId: string, marketCardId: string) => {
    const gameState = getGameState(mp);
    gameState.take_from_market(clientId, marketCardId);
    syncGameStateToMP(mp, gameState);
};

export const StartupsInvestCard = (mp: MPType, clientId: string, company: Company) => {
    const gameState = getGameState(mp);
    gameState.invest_card(clientId, company);
    syncGameStateToMP(mp, gameState);
};

export const StartupsDiscardCard = (mp: MPType, clientId: string, company: Company) => {
    const gameState = getGameState(mp);
    gameState.discard_card(clientId, company);
    syncGameStateToMP(mp, gameState);
};

export const StartupsNextScoringCompany = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) {
        throw new Error('Only the host can step through scoring');
    }

    const gameState = getGameState(mp);
    const playerNames: { [clientId: string]: string } = {};
    playerNames[mp.hostId] = mp.getData('lobby_name') || 'Host';
    mp.playersForEach((id) => {
        playerNames[id] = mp.getPlayerData(id, 'lobby_name') || id;
    });

    gameState.next_scoring_company(playerNames);
    syncGameStateToMP(mp, gameState);
};

export const StartupsRestartGame = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) {
        throw new Error('Only host can restart game');
    }

    const gameState = getGameState(mp);
    gameState.restart_game();
    syncGameStateToMP(mp, gameState);
};

export const StartupsBackToLobby = (mp: MPType, clientId: string) => {
    if (clientId !== mp.hostId) {
        throw new Error('Only host can return to lobby');
    }

    mp.setData('lobby_started', false);
};
