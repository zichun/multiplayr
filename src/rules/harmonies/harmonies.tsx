/**
 * harmonies.tsx - Main Harmonies game rule definition for Multiplayr
 */

import Lobby from '../lobby/lobby';
import Shell from '../gameshell/gameshell';
import './harmonies.scss';

import {
    GameRuleInterface,
    MPType
} from '../../common/interfaces';

import {
    HarmoniesHostLobby,
    HarmoniesClientLobby,
    HarmoniesMainPage
} from './views/HarmoniesViews';

import {
    HarmoniesStartGame,
    HarmoniesSetBoardSide,
    HarmoniesTakeMarketTokens,
    HarmoniesPlaceToken,
    HarmoniesUndoTokenDraft,
    HarmoniesUndoTokenPlacement,
    HarmoniesTakeCard,
    HarmoniesPlaceCube,
    HarmoniesUndoTakeCard,
    HarmoniesUndoPlaceCube,
    HarmoniesEndTurn,
    HarmoniesRestartGame,
    HarmoniesBackToLobby
} from './HarmoniesMethods';

import { HarmoniesGameState } from './HarmoniesGameState';

export const HarmoniesRule: GameRuleInterface = {
    name: 'harmonies',
    hostAsPlayer: true,
    plugins: {
        'lobby': Lobby,
        'gameshell': Shell
    },
    globalData: {
        gameState: null,
        harmonies_boardSide: 'A'
    },
    playerData: {},
    onDataChange: (mp: MPType) => {
        const started = mp.getData('lobby_started');

        if (!started) {
            mp.setView(mp.hostId, 'host-lobby');
            mp.playersForEach((clientId) => {
                mp.setView(clientId, 'client-lobby');
            });
            return true;
        }

        // Rehydrate GameState to guarantee method access
        let gameState = mp.getData('gameState');
        if (!gameState) return true;
        if (!gameState.take_market_tokens) {
            gameState = HarmoniesGameState.from_data(gameState.data || gameState);
            mp.setData('gameState', gameState);
        }

        const data = gameState.get_data();

        // Handle toast notification if lastMove exists
        if (data.lastMove) {
            const playerAccent = '#2980b9';

            const toast = {
                id: data.lastMove.moveId,
                message: data.lastMove.message,
                bgColor: playerAccent,
                duration: 3500
            };

            mp.playersForEach((clientId) => {
                mp.setViewProps(clientId, 'toastNotification', toast);
            });
            mp.setViewProps(mp.hostId, 'toastNotification', toast);
        }

        // Set props and views
        const setProps = (clientId: string) => {
            mp.setViewProps(clientId, 'gameState', data);
            mp.setViewProps(clientId, 'isHost', clientId === mp.hostId);
            mp.setView(clientId, 'mainpage');
        };

        mp.playersForEach((clientId) => {
            setProps(clientId);
        });
        setProps(mp.hostId);

        return true;
    },

    methods: {
        'startGame': HarmoniesStartGame,
        'setBoardSide': HarmoniesSetBoardSide,
        'takeMarketTokens': HarmoniesTakeMarketTokens,
        'placeToken': HarmoniesPlaceToken,
        'undoTokenDraft': HarmoniesUndoTokenDraft,
        'undoTokenPlacement': HarmoniesUndoTokenPlacement,
        'takeCard': HarmoniesTakeCard,
        'placeCube': HarmoniesPlaceCube,
        'undoTakeCard': HarmoniesUndoTakeCard,
        'undoPlaceCube': HarmoniesUndoPlaceCube,
        'endTurn': HarmoniesEndTurn,
        'restartGame': HarmoniesRestartGame,
        'backToLobby': HarmoniesBackToLobby
    },

    views: {
        'host-lobby': HarmoniesHostLobby,
        'client-lobby': HarmoniesClientLobby,
        'mainpage': HarmoniesMainPage
    }
};

export default HarmoniesRule;
