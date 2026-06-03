/**
 * clever.tsx - Main Clever game rule definition
 */

import Lobby from '../lobby/lobby';
import Shell from '../gameshell/gameshell';
import './clever.scss';

import {
    GameRuleInterface,
    MPType
} from '../../common/interfaces';

import {
    CleverHostLobby,
    CleverClientLobby,
    CleverMainPage,
} from './views/CleverViews';

import {
    CleverStartGame,
    CleverChooseRoundStartBonus,
    CleverSelectRound4Option,
    CleverRollActiveDice,
    CleverRerollActiveDice,
    CleverPickActiveDie,
    CleverResolvePendingBonus,
    CleverPickPassiveDie,
    CleverSpendExtraDie,
    CleverConfirmPassiveSelection,
    CleverEndPlayerTurn,
    CleverRestartGame,
    CleverBackToLobby
} from './CleverMethods';

import { CleverGameState } from './CleverGameState';

export const CleverRule: GameRuleInterface = {
    name: 'clever',
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
            gameState = CleverGameState.from_data(gameState.data);
            mp.setData('gameState', gameState);
        }

        function setViewProps(mp: MPType, clientId: string) {
            const data = gameState.get_data();
            const playerState = data.players[clientId];

            // Set individual player data
            mp.setViewProps(clientId, 'gameStatus', data.status);
            mp.setViewProps(clientId, 'round', data.round);
            mp.setViewProps(clientId, 'totalRounds', data.totalRounds);
            mp.setViewProps(clientId, 'playerIds', data.playerIds);
            mp.setViewProps(clientId, 'activePlayerIndex', data.activePlayerIndex);
            mp.setViewProps(clientId, 'currentPlayerId', data.playerIds[data.activePlayerIndex]);
            mp.setViewProps(clientId, 'rollCount', data.rollCount);
            mp.setViewProps(clientId, 'activePickedDice', data.activePickedDice);
            mp.setViewProps(clientId, 'poolDice', data.poolDice);
            mp.setViewProps(clientId, 'trayDice', data.trayDice);
            mp.setViewProps(clientId, 'rolledDice', data.rolledDice);
            mp.setViewProps(clientId, 'isSolo', data.isSolo);
            mp.setViewProps(clientId, 'soloPassiveTurn', data.soloPassiveTurn);
            mp.setViewProps(clientId, 'players', data.players);
            mp.setViewProps(clientId, 'gameLogs', data.gameLogs);
            mp.setViewProps(clientId, 'isHost', clientId === mp.hostId);

            // Build the list of client IDs and names from the lobby
            const clientIds: string[] = [mp.hostId];
            mp.playersForEach(pid => {
                if (!clientIds.includes(pid)) {
                    clientIds.push(pid);
                }
            });

            const names = clientIds.map(pid => {
                if (pid === mp.hostId) {
                    return mp.getData('lobby_name') || 'Host';
                }
                return mp.getPlayerData(pid, 'lobby_name') || pid;
            });

            mp.setViewProps(clientId, 'clientIds', clientIds);
            mp.setViewProps(clientId, 'names', names);

            if (playerState) {
                mp.setViewProps(clientId, 'yellow', playerState.yellow);
                mp.setViewProps(clientId, 'blue', playerState.blue);
                mp.setViewProps(clientId, 'green', playerState.green);
                mp.setViewProps(clientId, 'orange', playerState.orange);
                mp.setViewProps(clientId, 'purple', playerState.purple);
                mp.setViewProps(clientId, 'rerollsTotal', playerState.rerollsTotal);
                mp.setViewProps(clientId, 'rerollsUsed', playerState.rerollsUsed);
                mp.setViewProps(clientId, 'extraDiceTotal', playerState.extraDiceTotal);
                mp.setViewProps(clientId, 'extraDiceUsed', playerState.extraDiceUsed);
                mp.setViewProps(clientId, 'foxesTotal', playerState.foxesTotal);
                mp.setViewProps(clientId, 'bonusesToResolve', playerState.bonusesToResolve);
                mp.setViewProps(clientId, 'extraDicePickedThisTurn', playerState.extraDicePickedThisTurn);
                mp.setViewProps(clientId, 'hasConfirmedPassiveSelection', playerState.hasConfirmedPassiveSelection);
            }
        }

        // Set common props for all players
        mp.playersForEach((clientId) => {
            setViewProps(mp, clientId);
        });
        setViewProps(mp, mp.hostId);

        // Set views
        mp.setView(mp.hostId, 'mainpage');
        mp.playersForEach((clientId) => {
            mp.setView(clientId, 'mainpage');
        });

        return true;
    },

    methods: {
        'startGame': CleverStartGame,
        'chooseRoundStartBonus': CleverChooseRoundStartBonus,
        'selectRound4Option': CleverSelectRound4Option,
        'rollActiveDice': CleverRollActiveDice,
        'rerollActiveDice': CleverRerollActiveDice,
        'pickActiveDie': CleverPickActiveDie,
        'resolvePendingBonus': CleverResolvePendingBonus,
        'pickPassiveDie': CleverPickPassiveDie,
        'spendExtraDie': CleverSpendExtraDie,
        'confirmPassiveSelection': CleverConfirmPassiveSelection,
        'endPlayerTurn': CleverEndPlayerTurn,
        'restartGame': CleverRestartGame,
        'backToLobby': CleverBackToLobby,
    },

    views: {
        'host-lobby': CleverHostLobby,
        'client-lobby': CleverClientLobby,
        'mainpage': CleverMainPage,
    }
};

export default CleverRule;
