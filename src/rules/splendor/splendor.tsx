/**
 * splendor.tsx - Main Splendor game rule definition (2-4 players).
 */

import Lobby from '../lobby/lobby';
import Shell from '../gameshell/gameshell';
import './splendor.scss';

import { GameRuleInterface, MPType } from '../../common/interfaces';

import {
    SplendorHostLobby,
    SplendorClientLobby,
    SplendorMainPage
} from './views/SplendorViews';

import {
    SplendorStartGame,
    SplendorTake3,
    SplendorTake2,
    SplendorReserve,
    SplendorBuy,
    SplendorSelectNoble,
    SplendorDiscardTokens,
    SplendorRestartGame,
    SplendorBackToLobby
} from './SplendorMethods';

import { SplendorGameState } from './SplendorGameState';

export const SplendorRule: GameRuleInterface = {
    name: 'splendor',
    hostAsPlayer: true,
    plugins: {
        'lobby': Lobby,
        'gameshell': Shell
    },
    globalData: {
        gameState: null,
    },
    playerData: {},
    onDataChange: (mp: MPType) => {
        const started = mp.getData('lobby_started');

        const showLobby = () => {
            mp.setView(mp.hostId, 'host-lobby');
            mp.playersForEach((clientId) => {
                mp.setView(clientId, 'client-lobby');
            });
            return true;
        };

        if (!started) {
            return showLobby();
        }

        let gameState = mp.getData('gameState');
        if (!gameState) {
            return showLobby();
        }
        if (typeof gameState.get_data !== 'function') {
            gameState = SplendorGameState.from_data(gameState.data, gameState.playerIds);
            mp.setData('gameState', gameState);
        }

        const stateData = gameState.get_data();

        // Plain-string name map for the views.
        const playerNames: { [id: string]: string } = {};
        mp.playersForEach((clientId: string) => {
            playerNames[clientId] = (mp.getPlayerData(clientId, 'lobby_name') as string) || clientId;
        });
        playerNames[mp.hostId] = (mp.getData('lobby_name') as string) || mp.hostId;

        // Public per-player summary (tableau shows everyone's purchased cards & nobles;
        // reserved cards stay hidden — only the count is public).
        const publicPlayers = stateData.playerIds.map((pid) => ({
            id: pid,
            name: playerNames[pid] || pid,
            vp: gameState.vp(pid),
            bonuses: gameState.bonuses(pid),
            tokens: stateData.players[pid].tokens,
            tokenCount: gameState.count_tokens(pid),
            cards: stateData.players[pid].cards,
            nobles: stateData.players[pid].nobles,
            reservedCount: stateData.players[pid].reserved.length
        }));

        const setViewProps = (clientId: string) => {
            const myState = stateData.players[clientId];

            mp.setViewProps(clientId, 'gameStatus', stateData.status);
            mp.setViewProps(clientId, 'actionPhase', stateData.actionPhase);
            mp.setViewProps(clientId, 'playerIds', stateData.playerIds);
            mp.setViewProps(clientId, 'firstPlayerId', stateData.firstPlayerId);
            mp.setViewProps(clientId, 'currentPlayerId', stateData.currentPlayerId);
            mp.setViewProps(clientId, 'supply', stateData.supply);
            mp.setViewProps(clientId, 'board', stateData.board);
            mp.setViewProps(clientId, 'deckSizes', {
                '1': stateData.decks[1].length,
                '2': stateData.decks[2].length,
                '3': stateData.decks[3].length
            });
            mp.setViewProps(clientId, 'nobles', stateData.nobles);
            mp.setViewProps(clientId, 'pendingNobleIds', stateData.pendingNobleIds);
            mp.setViewProps(clientId, 'winnerIds', stateData.winnerIds);
            mp.setViewProps(clientId, 'lastMove', stateData.lastMove);
            mp.setViewProps(clientId, 'publicPlayers', publicPlayers);
            mp.setViewProps(clientId, 'playerNames', playerNames);

            // Personal (private) state
            mp.setViewProps(clientId, 'myId', clientId);
            mp.setViewProps(clientId, 'myTokens', myState ? myState.tokens : null);
            mp.setViewProps(clientId, 'myBonuses', gameState.bonuses(clientId));
            mp.setViewProps(clientId, 'myVp', gameState.vp(clientId));
            mp.setViewProps(clientId, 'myReserved', myState ? myState.reserved : []);
            mp.setViewProps(clientId, 'myTokenCount', gameState.count_tokens(clientId));

            mp.setViewProps(clientId, 'isHost', clientId === mp.hostId);
        };

        mp.playersForEach((clientId) => setViewProps(clientId));
        setViewProps(mp.hostId);

        mp.setView(mp.hostId, 'mainpage');
        mp.playersForEach((clientId) => mp.setView(clientId, 'mainpage'));

        return true;
    },

    methods: {
        'startGame': SplendorStartGame,
        'take3': SplendorTake3,
        'take2': SplendorTake2,
        'reserve': SplendorReserve,
        'buy': SplendorBuy,
        'selectNoble': SplendorSelectNoble,
        'discardTokens': SplendorDiscardTokens,
        'restartGame': SplendorRestartGame,
        'backToLobby': SplendorBackToLobby,
    },

    views: {
        'host-lobby': SplendorHostLobby,
        'client-lobby': SplendorClientLobby,
        'mainpage': SplendorMainPage,
    }
};

export default SplendorRule;
