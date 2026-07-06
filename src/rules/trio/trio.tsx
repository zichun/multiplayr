/**
 * trio.tsx - Main "Trio" game rule definition.
 */

import Lobby from '../lobby/lobby';
import Shell from '../gameshell/gameshell';
import './trio.scss';

import {
    GameRuleInterface,
    MPType
} from '../../common/interfaces';

import {
    TrioHostLobby,
    TrioClientLobby,
    TrioMainPage
} from './views/TrioViews';

import {
    TrioSetMode,
    TrioStartGame,
    TrioRevealHand,
    TrioRevealMiddle,
    TrioFinishMismatch,
    TrioRestartGame,
    TrioBackToLobby
} from './TrioMethods';

import { TrioGameState } from './TrioGameState';

export const TrioRule: GameRuleInterface = {
    name: 'trio',
    hostAsPlayer: true,
    plugins: {
        'lobby': Lobby,
        'gameshell': Shell
    },
    globalData: {
        gameState: null,
        trioMode: 'simple'
    },
    playerData: {},

    onDataChange: (mp: MPType) => {
        const started = mp.getData('lobby_started');

        const showLobby = () => {
            const mode = mp.getData('trioMode') || 'simple';
            mp.setView(mp.hostId, 'host-lobby');
            mp.setViewProps(mp.hostId, 'trioMode', mode);
            mp.playersForEach((clientId) => {
                mp.setView(clientId, 'client-lobby');
                mp.setViewProps(clientId, 'trioMode', mode);
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
            gameState = TrioGameState.from_data(gameState.data, gameState.playerIds);
            mp.setData('gameState', gameState);
        }

        const stateData = gameState.get_data();

        // Player name / accent / lobby-icon maps (never expose raw client ids).
        const playerNames: { [id: string]: string } = {};
        const playerAccents: { [id: string]: string } = {};
        const playerIcons: { [id: string]: number } = {};
        const resolveName = (id: string, fallbackIndex: number) => {
            const raw = id === mp.hostId
                ? (mp.getData('lobby_name') as string)
                : (mp.getPlayerData(id, 'lobby_name') as string);
            return raw && raw.trim().length > 0 ? raw : `Player ${fallbackIndex + 1}`;
        };
        const resolveAccent = (id: string) => {
            const raw = id === mp.hostId
                ? (mp.getData('lobby_accent') as string)
                : (mp.getPlayerData(id, 'lobby_accent') as string);
            return raw && raw.trim().length > 0 ? raw : '#7c8aa5';
        };
        const resolveIcon = (id: string) => {
            const raw = id === mp.hostId
                ? (mp.getData('lobby_icon') as number)
                : (mp.getPlayerData(id, 'lobby_icon') as number);
            return typeof raw === 'number' ? raw : 0;
        };
        stateData.playerIds.forEach((id, idx) => {
            playerNames[id] = resolveName(id, idx);
            playerAccents[id] = resolveAccent(id);
            playerIcons[id] = resolveIcon(id);
        });

        // Public per-player snapshot (hides hand contents; exposes only counts + trios).
        const publicPlayers: { [id: string]: any } = {};
        stateData.playerIds.forEach((id) => {
            const p = stateData.players[id];
            publicPlayers[id] = {
                handCount: p.hand.length,
                trios: p.trios
            };
        });

        // Public middle: reveal a card value only while it is face-up.
        const publicMiddle = stateData.middle.map((slot) => ({
            faceUp: slot.faceUp,
            empty: slot.card === null,
            card: slot.faceUp ? slot.card : null
        }));

        const availableReveals = stateData.status === 'Play'
            ? gameState.get_available_reveals(stateData.currentPlayerId)
            : { hands: {}, middleSlots: [] };

        const setViewProps = (clientId: string) => {
            mp.setViewProps(clientId, 'gameStatus', stateData.status);
            mp.setViewProps(clientId, 'mode', stateData.mode);
            mp.setViewProps(clientId, 'numPlayers', stateData.numPlayers);
            mp.setViewProps(clientId, 'playerOrder', stateData.playerIds);
            mp.setViewProps(clientId, 'currentPlayerId', stateData.currentPlayerId);
            mp.setViewProps(clientId, 'targetNumber', stateData.targetNumber);
            mp.setViewProps(clientId, 'currentReveals', stateData.currentReveals);
            mp.setViewProps(clientId, 'lastOutcome', stateData.lastOutcome);
            mp.setViewProps(clientId, 'resolvingMismatch', stateData.resolvingMismatch);
            mp.setViewProps(clientId, 'middle', publicMiddle);
            mp.setViewProps(clientId, 'publicPlayers', publicPlayers);
            mp.setViewProps(clientId, 'availableReveals', availableReveals);
            mp.setViewProps(clientId, 'winnerId', stateData.winnerId);
            mp.setViewProps(clientId, 'winningTrios', stateData.winningTrios);
            mp.setViewProps(clientId, 'winReason', stateData.winReason);
            mp.setViewProps(clientId, 'lastMove', stateData.lastMove);
            mp.setViewProps(clientId, 'playerNames', playerNames);
            mp.setViewProps(clientId, 'playerAccents', playerAccents);
            mp.setViewProps(clientId, 'playerIcons', playerIcons);
            mp.setViewProps(clientId, 'isHost', clientId === mp.hostId);

            // Private: only this client's own hand.
            const myState = stateData.players[clientId];
            mp.setViewProps(clientId, 'myHand', myState ? myState.hand : []);
        };

        mp.playersForEach((clientId) => setViewProps(clientId));
        setViewProps(mp.hostId);

        mp.setView(mp.hostId, 'mainpage');
        mp.playersForEach((clientId) => {
            mp.setView(clientId, 'mainpage');
        });

        return true;
    },

    methods: {
        'setMode': TrioSetMode,
        'startGame': TrioStartGame,
        'revealHand': TrioRevealHand,
        'revealMiddle': TrioRevealMiddle,
        'finishMismatch': TrioFinishMismatch,
        'restartGame': TrioRestartGame,
        'backToLobby': TrioBackToLobby,
    },

    views: {
        'host-lobby': TrioHostLobby,
        'client-lobby': TrioClientLobby,
        'mainpage': TrioMainPage,
    }
};

export default TrioRule;
