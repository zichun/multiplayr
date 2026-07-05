/**
 * catinthebox.tsx - Main "Cat in the Box" game rule definition.
 */

import Lobby from '../lobby/lobby';
import Shell from '../gameshell/gameshell';
import './catinthebox.scss';

import {
    GameRuleInterface,
    MPType
} from '../../common/interfaces';

import {
    CatInTheBoxHostLobby,
    CatInTheBoxClientLobby,
    CatInTheBoxMainPage
} from './views/CatInTheBoxViews';

import {
    CatInTheBoxStartGame,
    CatInTheBoxDiscardCard,
    CatInTheBoxMakePrediction,
    CatInTheBoxPlayCard,
    CatInTheBoxNextRound,
    CatInTheBoxRestartGame,
    CatInTheBoxBackToLobby
} from './CatInTheBoxMethods';

import { CatInTheBoxGameState, Phase } from './CatInTheBoxGameState';

export const CatInTheBoxRule: GameRuleInterface = {
    name: 'catinthebox',
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
            gameState = CatInTheBoxGameState.from_data(gameState.data, gameState.playerIds);
            mp.setData('gameState', gameState);
        }

        const stateData = gameState.get_data();

        // Player name + accent maps (never expose raw client ids to the UI).
        const playerNames: { [id: string]: string } = {};
        const playerAccents: { [id: string]: string } = {};
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
        stateData.playerIds.forEach((id, idx) => {
            playerNames[id] = resolveName(id, idx);
            playerAccents[id] = resolveAccent(id);
        });

        // Public per-player snapshot (hides hands / buried cards from everyone).
        const publicPlayers: { [id: string]: any } = {};
        stateData.playerIds.forEach((id) => {
            const p = stateData.players[id];
            publicPlayers[id] = {
                xSlots: p.xSlots,
                tricksWon: p.tricksWon,
                prediction: p.prediction,
                hasDiscarded: p.hasDiscarded,
                isParadox: p.isParadox,
                roundScore: p.roundScore,
                roundBonus: p.roundBonus,
                totalScore: p.totalScore,
                handCount: p.hand.length,
                roundHistory: p.roundHistory
            };
        });

        const allowedPredictions = gameState.get_allowed_predictions();

        const setViewProps = (clientId: string) => {
            mp.setViewProps(clientId, 'gameStatus', stateData.status);
            mp.setViewProps(clientId, 'round', stateData.round);
            mp.setViewProps(clientId, 'totalRounds', stateData.totalRounds);
            mp.setViewProps(clientId, 'numPlayers', stateData.numPlayers);
            mp.setViewProps(clientId, 'maxNum', stateData.maxNum);
            mp.setViewProps(clientId, 'totalTricks', stateData.totalTricks);
            mp.setViewProps(clientId, 'trickNumber', stateData.trickNumber);
            mp.setViewProps(clientId, 'board', stateData.board);
            mp.setViewProps(clientId, 'playerOrder', stateData.playerIds);
            mp.setViewProps(clientId, 'currentPlayerId', stateData.currentPlayerId);
            mp.setViewProps(clientId, 'trickStartPlayerId', stateData.trickStartPlayerId);
            mp.setViewProps(clientId, 'roundStartId', stateData.playerIds[stateData.roundStartIndex]);
            mp.setViewProps(clientId, 'ledColor', stateData.ledColor);
            mp.setViewProps(clientId, 'currentTrick', stateData.currentTrick);
            mp.setViewProps(clientId, 'paradoxPlayerId', stateData.paradoxPlayerId);
            mp.setViewProps(clientId, 'winnerId', stateData.winnerId);
            mp.setViewProps(clientId, 'lastMove', stateData.lastMove);
            mp.setViewProps(clientId, 'allowedPredictions', allowedPredictions);
            mp.setViewProps(clientId, 'publicPlayers', publicPlayers);
            mp.setViewProps(clientId, 'playerNames', playerNames);
            mp.setViewProps(clientId, 'playerAccents', playerAccents);
            mp.setViewProps(clientId, 'isHost', clientId === mp.hostId);

            // Private: only this client's own hand + their legal plays (when active).
            const myState = stateData.players[clientId];
            mp.setViewProps(clientId, 'myHand', myState ? myState.hand : []);
            const legal = (stateData.status === Phase.Play && stateData.currentPlayerId === clientId)
                ? gameState.get_legal_plays(clientId)
                : [];
            mp.setViewProps(clientId, 'legalPlays', legal);
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
        'startGame': CatInTheBoxStartGame,
        'discardCard': CatInTheBoxDiscardCard,
        'makePrediction': CatInTheBoxMakePrediction,
        'playCard': CatInTheBoxPlayCard,
        'nextRound': CatInTheBoxNextRound,
        'restartGame': CatInTheBoxRestartGame,
        'backToLobby': CatInTheBoxBackToLobby,
    },

    views: {
        'host-lobby': CatInTheBoxHostLobby,
        'client-lobby': CatInTheBoxClientLobby,
        'mainpage': CatInTheBoxMainPage,
    }
};

export default CatInTheBoxRule;
