/**
 * schadenfreude.tsx - "Seconds, Please!" game rule definition
 * (family-friendly re-theme of the Schadenfreude trick-taking rules).
 */

import Lobby from '../lobby/lobby';
import Shell from '../gameshell/gameshell';
import './schadenfreude.scss';

import { GameRuleInterface, MPType } from '../../common/interfaces';

import {
    SchadenfreudeHostLobby,
    SchadenfreudeClientLobby,
    SchadenfreudeMainPage
} from './views/SchadenfreudeViews';

import {
    SchadenfreudeStartGame,
    SchadenfreudePlayCard,
    SchadenfreudeFinishTrick,
    SchadenfreudeNextRound,
    SchadenfreudeRestartGame,
    SchadenfreudeBackToLobby
} from './SchadenfreudeMethods';

import { SchadenfreudeGameState, plateTotal } from './SchadenfreudeGameState';

export const SchadenfreudeRule: GameRuleInterface = {
    name: 'schadenfreude',
    hostAsPlayer: true,
    plugins: {
        'lobby': Lobby,
        'gameshell': Shell
    },
    globalData: {
        gameState: null
    },
    playerData: {},

    onDataChange: (mp: MPType) => {
        const showLobby = () => {
            mp.setView(mp.hostId, 'host-lobby');
            mp.playersForEach((clientId) => mp.setView(clientId, 'client-lobby'));
            return true;
        };

        if (!mp.getData('lobby_started')) {
            return showLobby();
        }

        let gameState = mp.getData('gameState');
        if (!gameState) {
            return showLobby();
        }
        if (typeof gameState.get_data !== 'function') {
            gameState = SchadenfreudeGameState.from_data(gameState.data, gameState.playerIds);
            mp.setData('gameState', gameState);
        }

        const d = gameState.get_data();

        // Player name / accent / lobby-icon maps (never expose raw client ids in the UI).
        const lobbyValue = (id: string, key: string) => id === mp.hostId
            ? mp.getData(`lobby_${key}`)
            : mp.getPlayerData(id, `lobby_${key}`);
        const playerNames: Record<string, string> = {};
        const playerAccents: Record<string, string> = {};
        const playerIcons: Record<string, number> = {};
        d.playerIds.forEach((id, idx) => {
            const name = lobbyValue(id, 'name') as string;
            const accent = lobbyValue(id, 'accent') as string;
            const icon = lobbyValue(id, 'icon');
            playerNames[id] = name && name.trim() ? name : `Player ${idx + 1}`;
            playerAccents[id] = accent && accent.trim() ? accent : '#8a7f99';
            playerIcons[id] = typeof icon === 'number' ? icon : 0;
        });

        // Public per-player snapshot: plates are face-up on the table; hands are private.
        const publicPlayers: Record<string, any> = {};
        d.playerIds.forEach((id) => {
            const p = d.players[id];
            publicPlayers[id] = {
                plate: p.plate,
                plateTotal: plateTotal(p.plate),
                handCount: p.hand.length,
                tricksWon: p.tricksWon,
                score: p.score,
                scoreBefore: p.scoreBefore,
                roundPoints: p.roundPoints,
                history: p.history
            };
        });

        // Toast for completed tricks / round transitions.
        const lm = d.lastMove;
        let toast: any = null;
        if (lm && (lm.kind === 'trick' || lm.kind === 'start')) {
            const who = lm.playerId ? playerNames[lm.playerId] : '';
            toast = {
                id: lm.moveId,
                message: lm.kind === 'trick'
                    ? `${who} ${lm.desc}`
                    : `${lm.desc} — ${who} leads`,
                bgColor: lm.playerId ? playerAccents[lm.playerId] : '#8a7f99',
                duration: 2500
            };
        }

        const setProps = (clientId: string) => {
            mp.setViewProps(clientId, 'gameStatus', d.status);
            mp.setViewProps(clientId, 'round', d.round);
            mp.setViewProps(clientId, 'numPlayers', d.numPlayers);
            mp.setViewProps(clientId, 'handSize', d.handSize);
            mp.setViewProps(clientId, 'setAsideCount', d.setAsideCount);
            mp.setViewProps(clientId, 'playerOrder', d.playerIds);
            mp.setViewProps(clientId, 'roundLeaderId', d.roundLeaderId);
            mp.setViewProps(clientId, 'leaderReason', d.leaderReason);
            mp.setViewProps(clientId, 'currentPlayerId', d.currentPlayerId);
            mp.setViewProps(clientId, 'trickLeaderId', d.trickLeaderId);
            mp.setViewProps(clientId, 'currentTrick', d.currentTrick);
            mp.setViewProps(clientId, 'leadSuit', d.leadSuit);
            mp.setViewProps(clientId, 'trickNumber', d.trickNumber);
            mp.setViewProps(clientId, 'totalTricks', d.totalTricks);
            mp.setViewProps(clientId, 'resolvingTrick', d.resolvingTrick);
            mp.setViewProps(clientId, 'trickHistory', d.trickHistory);
            mp.setViewProps(clientId, 'bustedIds', d.bustedIds);
            mp.setViewProps(clientId, 'winnerId', d.winnerId);
            mp.setViewProps(clientId, 'lastMove', d.lastMove);
            mp.setViewProps(clientId, 'publicPlayers', publicPlayers);
            mp.setViewProps(clientId, 'playerNames', playerNames);
            mp.setViewProps(clientId, 'playerAccents', playerAccents);
            mp.setViewProps(clientId, 'playerIcons', playerIcons);
            mp.setViewProps(clientId, 'isHost', clientId === mp.hostId);
            mp.setViewProps(clientId, 'toastNotification', toast);

            const mine = d.players[clientId];
            mp.setViewProps(clientId, 'myHand', mine ? mine.hand : []);
            mp.setViewProps(clientId, 'legalCardIds', gameState.get_legal_card_ids(clientId));
        };

        setProps(mp.hostId);
        mp.playersForEach((clientId) => setProps(clientId));

        mp.setView(mp.hostId, 'mainpage');
        mp.playersForEach((clientId) => mp.setView(clientId, 'mainpage'));
        return true;
    },

    methods: {
        'startGame': SchadenfreudeStartGame,
        'playCard': SchadenfreudePlayCard,
        'finishTrick': SchadenfreudeFinishTrick,
        'nextRound': SchadenfreudeNextRound,
        'restartGame': SchadenfreudeRestartGame,
        'backToLobby': SchadenfreudeBackToLobby
    },

    views: {
        'host-lobby': SchadenfreudeHostLobby,
        'client-lobby': SchadenfreudeClientLobby,
        'mainpage': SchadenfreudeMainPage
    }
};

export default SchadenfreudeRule;
