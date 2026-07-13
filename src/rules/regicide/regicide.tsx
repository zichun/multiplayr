/**
 * regicide.tsx - Main "Regicide" game rule definition.
 */

import Lobby from '../lobby/lobby';
import Shell from '../gameshell/gameshell';
import './regicide.scss';

import {
    GameRuleInterface,
    MPType
} from '../../common/interfaces';

import {
    RegicideHostLobby,
    RegicideClientLobby,
    RegicideMainPage
} from './views/RegicideViews';

import {
    RegicideStartGame,
    RegicidePlayCards,
    RegicidePlayJester,
    RegicideChooseNext,
    RegicideYield,
    RegicideDiscardForDamage,
    RegicideSoloRefill,
    RegicideRestartGame,
    RegicideBackToLobby
} from './RegicideMethods';

import { RegicideGameState } from './RegicideGameState';

export const RegicideRule: GameRuleInterface = {
    name: 'regicide',
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
            gameState = RegicideGameState.from_data(gameState.data, gameState.playerIds);
            mp.setData('gameState', gameState);
        }

        const stateData = gameState.get_data();

        // ---- player identity maps (never expose raw client ids) ----
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

        // ---- public per-player snapshot (hides hand contents) ----
        const publicPlayers: { [id: string]: any } = {};
        stateData.playerIds.forEach((id) => {
            publicPlayers[id] = {
                handCount: (stateData.hands[id] || []).length,
                lastAction: stateData.lastAction[id]
            };
        });

        // ---- enemy with derived effective stats ----
        let enemyView: any = null;
        if (stateData.currentEnemy) {
            const e = stateData.currentEnemy;
            enemyView = {
                card: e.card,
                type: e.type,
                suit: e.suit,
                attack: e.attack,
                health: e.health,
                damage: e.damage,
                shield: gameState.effective_shield(e),
                effectiveAttack: gameState.effective_attack(e),
                immunityCancelled: e.immunityCancelled
            };
        }

        const canYieldMap: { [id: string]: boolean } = {};
        stateData.playerIds.forEach((id) => {
            canYieldMap[id] = stateData.status === 'Play' ? gameState.can_yield(id) : false;
        });

        const setViewProps = (clientId: string) => {
            mp.setViewProps(clientId, 'gameStatus', stateData.status);
            mp.setViewProps(clientId, 'numPlayers', stateData.numPlayers);
            mp.setViewProps(clientId, 'solo', stateData.solo);
            mp.setViewProps(clientId, 'maxHandSize', stateData.maxHandSize);
            mp.setViewProps(clientId, 'playerOrder', stateData.playerIds);
            mp.setViewProps(clientId, 'currentPlayerId', stateData.currentPlayerId);
            mp.setViewProps(clientId, 'enemy', enemyView);
            mp.setViewProps(clientId, 'playedCards', stateData.playedCards);
            mp.setViewProps(clientId, 'tavernCount', stateData.tavernDeck.length);
            mp.setViewProps(clientId, 'discardCount', stateData.discardPile.length);
            mp.setViewProps(clientId, 'castleCount', stateData.castleDeck.length);
            mp.setViewProps(clientId, 'enemiesDefeated', stateData.enemiesDefeated);
            mp.setViewProps(clientId, 'publicPlayers', publicPlayers);
            mp.setViewProps(clientId, 'pendingDamage', stateData.pendingDamage);
            mp.setViewProps(clientId, 'lastHit', stateData.lastHit);
            mp.setViewProps(clientId, 'lastAttack', stateData.lastAttack);
            mp.setViewProps(clientId, 'awaitingJesterChoice', stateData.awaitingJesterChoice);
            mp.setViewProps(clientId, 'soloJestersRemaining', stateData.soloJestersRemaining);
            mp.setViewProps(clientId, 'jestersUsed', stateData.jestersUsed);
            mp.setViewProps(clientId, 'winTier', stateData.winTier);
            mp.setViewProps(clientId, 'loseReason', stateData.loseReason);
            mp.setViewProps(clientId, 'lastMove', stateData.lastMove);
            mp.setViewProps(clientId, 'canYield', canYieldMap[clientId] || false);
            mp.setViewProps(clientId, 'playerNames', playerNames);
            mp.setViewProps(clientId, 'playerAccents', playerAccents);
            mp.setViewProps(clientId, 'playerIcons', playerIcons);
            mp.setViewProps(clientId, 'isHost', clientId === mp.hostId);

            // Private: only this client's own hand.
            mp.setViewProps(clientId, 'myHand', stateData.hands[clientId] || []);
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
        'startGame': RegicideStartGame,
        'playCards': RegicidePlayCards,
        'playJester': RegicidePlayJester,
        'chooseNext': RegicideChooseNext,
        'yieldTurn': RegicideYield,
        'discardForDamage': RegicideDiscardForDamage,
        'soloRefill': RegicideSoloRefill,
        'restartGame': RegicideRestartGame,
        'backToLobby': RegicideBackToLobby
    },

    views: {
        'host-lobby': RegicideHostLobby,
        'client-lobby': RegicideClientLobby,
        'mainpage': RegicideMainPage
    }
};

export default RegicideRule;
