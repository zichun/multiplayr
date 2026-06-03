/**
 * durian.tsx - Main Durian game rule definition
 */

import Lobby from '../lobby/lobby';
import Shell from '../gameshell/gameshell';
import './durian.scss';

import {
    GameRuleInterface,
    MPType
} from '../../common/interfaces';

import {
    DurianHostLobby,
    DurianClientLobby,
    DurianMainPage,
} from './views/DurianViews';

import {
    DurianStartGame,
    DurianDrawCard,
    DurianSubmitOrder,
    DurianRingBell,
    DurianNextRound,
    DurianRestartGame,
    DurianBackToLobby
} from './DurianMethods';

import { DurianGameState } from './DurianGameState';

export const DurianRule: GameRuleInterface = {
    name: 'durian',
    plugins: {
        'lobby': Lobby,
        'gameshell': Shell
    },
    globalData: {
        gameState: null,
    },
    playerData: {
    },
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

        // Game has started, set up main game views
        let gameState = mp.getData('gameState');
        if (!gameState.get_data) {
            // Deserialization check
            gameState = DurianGameState.from_data(gameState.data, gameState.playerIds);
            mp.setData('gameState', gameState);
        }

        const data = gameState.get_data();

        function setViewProps(mp: MPType, clientId: string) {
            const playerState = data.players[clientId];

            // Set general properties
            mp.setViewProps(clientId, 'isHost', clientId === mp.hostId);
            mp.setViewProps(clientId, 'gameStatus', data.status);
            mp.setViewProps(clientId, 'round', data.round);
            mp.setViewProps(clientId, 'currentPlayerId', data.currentPlayerId);
            mp.setViewProps(clientId, 'lastPlayerId', data.lastPlayerId);
            mp.setViewProps(clientId, 'players', data.players);
            mp.setViewProps(clientId, 'orders', data.orders);
            mp.setViewProps(clientId, 'deckCount', data.deck.length);
            mp.setViewProps(clientId, 'drawnCard', data.drawnCard);
            mp.setViewProps(clientId, 'bellRingerId', data.bellRingerId);
            mp.setViewProps(clientId, 'resolutionDetails', data.resolutionDetails);
        }

        // Set common props for all players
        mp.playersForEach((clientId) => {
            setViewProps(mp, clientId);
        });
        setViewProps(mp, mp.hostId);

        // Route screens
        mp.setView(mp.hostId, 'mainpage');
        mp.playersForEach((clientId) => {
            mp.setView(clientId, 'mainpage');
        });

        return true;
    },

    methods: {
        'startGame': DurianStartGame,
        'drawCard': DurianDrawCard,
        'submitOrder': DurianSubmitOrder,
        'ringBell': DurianRingBell,
        'nextRound': DurianNextRound,
        'restartGame': DurianRestartGame,
        'backToLobby': DurianBackToLobby,
    },

    views: {
        'host-lobby': DurianHostLobby,
        'client-lobby': DurianClientLobby,
        'mainpage': DurianMainPage,
    }
};

export default DurianRule;
