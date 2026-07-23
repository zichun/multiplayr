/**
 * seasalt.tsx - Main "Sea Salt & Paper" game rule definition.
 */

import Lobby from '../lobby/lobby';
import Shell from '../gameshell/gameshell';
import './seasalt.scss';

import { GameRuleInterface, MPType } from '../../common/interfaces';

import {
    SeaSaltHostLobby,
    SeaSaltClientLobby,
    SeaSaltMainPage
} from './views/SeaSaltViews';

import {
    SeaSaltStartGame,
    SeaSaltRestartGame,
    SeaSaltBackToLobby,
    SeaSaltDrawFromDeck,
    SeaSaltChooseDrawn,
    SeaSaltTakeDiscard,
    SeaSaltPlayDuo,
    SeaSaltResolveCrab,
    SeaSaltResolveSteal,
    SeaSaltPassTurn,
    SeaSaltDeclareStop,
    SeaSaltDeclareLastChance,
    SeaSaltNextRound
} from './SeaSaltMethods';

import { SeaSaltGameState, Phase } from './SeaSaltGameState';

export const SeaSaltRule: GameRuleInterface = {
    name: 'seasalt',
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
            mp.playersForEach((clientId) => mp.setView(clientId, 'client-lobby'));
            return true;
        };

        if (!started) return showLobby();

        let gameState = mp.getData('gameState');
        if (!gameState) return showLobby();
        if (typeof gameState.get_data !== 'function') {
            gameState = SeaSaltGameState.from_data(gameState.data, gameState.playerIds);
            mp.setData('gameState', gameState);
        }

        const s = gameState.get_data();

        // ---- player name / accent / lobby-icon maps (never leak raw ids) ----
        const playerNames: Record<string, string> = {};
        const playerAccents: Record<string, string> = {};
        const playerIcons: Record<string, number> = {};
        const resolveName = (id: string, idx: number) => {
            const raw = id === mp.hostId ? mp.getData('lobby_name') : mp.getPlayerData(id, 'lobby_name');
            return raw && String(raw).trim().length > 0 ? raw : `Player ${idx + 1}`;
        };
        const resolveAccent = (id: string) => {
            const raw = id === mp.hostId ? mp.getData('lobby_accent') : mp.getPlayerData(id, 'lobby_accent');
            return raw && String(raw).trim().length > 0 ? raw : '#4a90c2';
        };
        const resolveIcon = (id: string) => {
            const raw = id === mp.hostId ? mp.getData('lobby_icon') : mp.getPlayerData(id, 'lobby_icon');
            return typeof raw === 'number' ? raw : 0;
        };
        s.playerIds.forEach((id, idx) => {
            playerNames[id] = resolveName(id, idx);
            playerAccents[id] = resolveAccent(id);
            playerIcons[id] = resolveIcon(id);
        });

        // ---- public per-player snapshot (hides hand CONTENTS; tableau is public) ----
        const publicPlayers: Record<string, any> = {};
        s.playerIds.forEach((id) => {
            const p = s.players[id];
            publicPlayers[id] = {
                handCount: p.hand.length,
                tableau: p.tableau,
                score: p.score,
                revealed: p.revealed,
                // When a hand is revealed (round end / last chance), it becomes public.
                revealedHand: p.revealed ? p.hand : null
            };
        });

        // ---- shared zones ----
        const top = (pile: any[]) => (pile.length > 0 ? pile[pile.length - 1] : null);
        const shared = {
            deckCount: s.deck.length,
            discardTop: { A: top(s.discardA), B: top(s.discardB) },
            discardCount: { A: s.discardA.length, B: s.discardB.length }
        };

        const setProps = (clientId: string) => {
            mp.setViewProps(clientId, 'gameStatus', s.status);
            mp.setViewProps(clientId, 'turnPhase', s.turnPhase);
            mp.setViewProps(clientId, 'playerOrder', s.playerIds);
            mp.setViewProps(clientId, 'currentPlayerId', s.currentPlayerId);
            mp.setViewProps(clientId, 'roundNumber', s.roundNumber);
            mp.setViewProps(clientId, 'threshold', s.threshold);
            mp.setViewProps(clientId, 'publicPlayers', publicPlayers);
            mp.setViewProps(clientId, 'shared', shared);
            mp.setViewProps(clientId, 'lastChance', s.lastChance);
            mp.setViewProps(clientId, 'roundResult', s.roundResult);
            mp.setViewProps(clientId, 'winnerId', s.winnerId);
            mp.setViewProps(clientId, 'winReason', s.winReason);
            mp.setViewProps(clientId, 'lastMove', s.lastMove);
            mp.setViewProps(clientId, 'playerNames', playerNames);
            mp.setViewProps(clientId, 'playerAccents', playerAccents);
            mp.setViewProps(clientId, 'playerIcons', playerIcons);
            mp.setViewProps(clientId, 'isHost', clientId === mp.hostId);

            // ---- private, per-client ----
            const mine = s.players[clientId];
            mp.setViewProps(clientId, 'myHand', mine ? mine.hand : []);
            mp.setViewProps(clientId, 'myScore', gameState.get_player_score(clientId));
            mp.setViewProps(clientId, 'myActions', gameState.get_available_actions(clientId));

            // Only the actor mid-draw sees the revealed pair.
            const isActor = clientId === s.currentPlayerId && s.status === Phase.Play;
            mp.setViewProps(clientId, 'drawnPair', isActor && s.turnPhase === 'choose' ? s.drawnPair : null);

            // Only the actor resolving a crab sees the full pile contents.
            const crabbing = isActor && s.turnPhase === 'effect' && s.pendingEffect && s.pendingEffect.kind === 'crab';
            mp.setViewProps(clientId, 'crabPiles', crabbing ? { A: s.discardA, B: s.discardB } : null);
            mp.setViewProps(clientId, 'pendingEffect', isActor ? s.pendingEffect : null);
        };

        mp.playersForEach((clientId) => setProps(clientId));
        setProps(mp.hostId);

        mp.setView(mp.hostId, 'mainpage');
        mp.playersForEach((clientId) => mp.setView(clientId, 'mainpage'));

        return true;
    },

    methods: {
        'startGame': SeaSaltStartGame,
        'restartGame': SeaSaltRestartGame,
        'backToLobby': SeaSaltBackToLobby,
        'drawFromDeck': SeaSaltDrawFromDeck,
        'chooseDrawn': SeaSaltChooseDrawn,
        'takeDiscard': SeaSaltTakeDiscard,
        'playDuo': SeaSaltPlayDuo,
        'resolveCrab': SeaSaltResolveCrab,
        'resolveSteal': SeaSaltResolveSteal,
        'passTurn': SeaSaltPassTurn,
        'declareStop': SeaSaltDeclareStop,
        'declareLastChance': SeaSaltDeclareLastChance,
        'nextRound': SeaSaltNextRound
    },

    views: {
        'host-lobby': SeaSaltHostLobby,
        'client-lobby': SeaSaltClientLobby,
        'mainpage': SeaSaltMainPage
    }
};

export default SeaSaltRule;
