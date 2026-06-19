/**
 * maskmen.tsx - Main Maskmen game rule definition
 */

import Lobby from '../lobby/lobby';
import Shell from '../gameshell/gameshell';
import './maskmen.scss';

import {
    GameRuleInterface,
    MPType
} from '../../common/interfaces';

import {
    MaskmenHostLobby,
    MaskmenClientLobby,
    MaskmenMainPage,
} from './views/MaskmenViews';

import {
    MaskmenStartGame,
    MaskmenPlayCards,
    MaskmenPassTurn,
    MaskmenStartNextSeason,
    MaskmenRestartGame,
    MaskmenBackToLobby
} from './MaskmenMethods';

import { MaskmenGameState } from './MaskmenGameState';

export const MaskmenRule: GameRuleInterface = {
    name: 'maskmen',
    hostAsPlayer: true,
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
        if (!gameState.get_player_ids) {
            gameState = MaskmenGameState.from_data(gameState.data, gameState.playerIds);
            mp.setData('gameState', gameState);
        }

        const data = gameState.get_data();

        const clientIds = [mp.hostId];
        mp.playersForEach((clientId) => {
            clientIds.push(clientId);
        });

        const names = clientIds.map(id => {
            if (id === mp.hostId) {
                return mp.getData('lobby_name') || 'Host';
            }
            return mp.getPlayerData(id, 'lobby_name') || id;
        });

        const accents = clientIds.map(id => {
            if (id === mp.hostId) {
                return mp.getData('lobby_accent') || '#2ecc71';
            }
            return mp.getPlayerData(id, 'lobby_accent') || '#3498db';
        });

        function setViewProps(mp: MPType, clientId: string) {
            const playerState = data.players[clientId];

            // Set individual player data
            mp.setViewProps(clientId, 'gameStatus', data.status);
            mp.setViewProps(clientId, 'season', data.season);
            mp.setViewProps(clientId, 'players', data.players);
            mp.setViewProps(clientId, 'playerIds', data.playerIds);
            mp.setViewProps(clientId, 'currentPlayerId', data.playerIds[data.currentPlayerIndex]);
            mp.setViewProps(clientId, 'lastTrickWinnerId', data.lastTrickWinnerId);
            mp.setViewProps(clientId, 'currentTrick', data.currentTrick);
            mp.setViewProps(clientId, 'comparisonEdges', data.comparisonEdges);
            mp.setViewProps(clientId, 'cumulativeCounts', data.cumulativeCounts);
            mp.setViewProps(clientId, 'isHost', clientId === mp.hostId);
            mp.setViewProps(clientId, 'lastMove', data.lastMove || null);
            mp.setViewProps(clientId, 'clientIds', clientIds);
            mp.setViewProps(clientId, 'names', names);
            mp.setViewProps(clientId, 'accents', accents);

            if (playerState) {
                mp.setViewProps(clientId, 'hand', playerState.hand);
                mp.setViewProps(clientId, 'score', playerState.score);
                mp.setViewProps(clientId, 'outOrder', playerState.outOrder);
            }
        }

        // Set common props for all players
        clientIds.forEach((id) => {
            setViewProps(mp, id);
        });

        // Set views
        clientIds.forEach((id) => {
            mp.setView(id, 'mainpage');
        });

        return true;
    },

    methods: {
        'startGame': MaskmenStartGame,
        'playCards': MaskmenPlayCards,
        'passTurn': MaskmenPassTurn,
        'startNextSeason': MaskmenStartNextSeason,
        'restartGame': MaskmenRestartGame,
        'backToLobby': MaskmenBackToLobby,
    },

    views: {
        'host-lobby': MaskmenHostLobby,
        'client-lobby': MaskmenClientLobby,
        'mainpage': MaskmenMainPage,
    }
};

export default MaskmenRule;
