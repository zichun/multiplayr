/**
 * skull.tsx - Main "Skull" game rule definition.
 *
 * The coordinator: composes plugins, orchestrates the host tick, and — crucially
 * for a hidden-information bluffing game — publishes only what each client is
 * allowed to know. Disc COUNTS are public; disc CONTENTS are private to their
 * owner (plus any disc currently revealed on the table).
 */

import Lobby from '../lobby/lobby';
import Shell from '../gameshell/gameshell';
import './skull.scss';

import {
    GameRuleInterface,
    MPType
} from '../../common/interfaces';

import {
    SkullHostLobby,
    SkullClientLobby,
    SkullMainPage
} from './views/SkullViews';

import {
    SkullStartGame,
    SkullPlaceInitial,
    SkullAddDisc,
    SkullOpenBid,
    SkullRaiseBid,
    SkullPass,
    SkullFlip,
    SkullChooseDiscard,
    SkullProceed,
    SkullRestartGame,
    SkullBackToLobby
} from './SkullMethods';

import { SkullGameState, Phase, DiscKind, RevealEntry } from './SkullGameState';

export const SkullRule: GameRuleInterface = {
    name: 'skull',
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

        if (!started) {
            return showLobby();
        }

        let gameState = mp.getData('gameState');
        if (!gameState) {
            return showLobby();
        }
        if (typeof gameState.get_data !== 'function') {
            gameState = SkullGameState.from_data(gameState.data, gameState.playerIds);
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

        // Which disc kinds are currently revealed on each stack (top -> down, in
        // reveal order). Derived from the public reveal sequence, so it never
        // leaks unrevealed contents.
        const revealedKindsByPlayer: { [id: string]: DiscKind[] } = {};
        stateData.playerIds.forEach(id => { revealedKindsByPlayer[id] = []; });
        stateData.revealSequence.forEach((r: RevealEntry) => {
            revealedKindsByPlayer[r.ownerId].push(r.kind);
        });

        // Public per-player snapshot: counts only (never hidden contents).
        const publicPlayers: { [id: string]: any } = {};
        stateData.playerIds.forEach((id) => {
            const p = stateData.players[id];
            publicPlayers[id] = {
                wins: p.wins,
                eliminated: p.eliminated,
                passed: p.passed,
                placedInitial: p.placedInitial,
                ownedTotal: p.ownedFlowers + p.ownedSkulls,
                stackCount: p.stack.length,
                handCount: p.handFlowers + p.handSkulls,
                revealed: p.revealed,
                revealedKinds: revealedKindsByPlayer[id]
            };
        });

        const flippable = stateData.status === Phase.Challenge
            ? gameState.get_flippable(stateData.challengerId)
            : [];

        const setViewProps = (clientId: string) => {
            mp.setViewProps(clientId, 'gameStatus', stateData.status);
            mp.setViewProps(clientId, 'round', stateData.round);
            mp.setViewProps(clientId, 'playerOrder', stateData.playerIds);
            mp.setViewProps(clientId, 'currentPlayerId', stateData.currentPlayerId);
            mp.setViewProps(clientId, 'roundStarterId', stateData.roundStarterId);
            mp.setViewProps(clientId, 'bid', stateData.bid);
            mp.setViewProps(clientId, 'bidOpen', stateData.bidOpen);
            mp.setViewProps(clientId, 'discsOnTable', stateData.discsOnTable);
            mp.setViewProps(clientId, 'challengerId', stateData.challengerId);
            mp.setViewProps(clientId, 'bidTarget', stateData.bidTarget);
            mp.setViewProps(clientId, 'flowersRevealed', stateData.flowersRevealed);
            mp.setViewProps(clientId, 'revealSequence', stateData.revealSequence);
            mp.setViewProps(clientId, 'resolution', stateData.resolution);
            mp.setViewProps(clientId, 'winnerId', stateData.winnerId);
            mp.setViewProps(clientId, 'lastMove', stateData.lastMove);
            mp.setViewProps(clientId, 'publicPlayers', publicPlayers);
            mp.setViewProps(clientId, 'flippable', flippable);
            mp.setViewProps(clientId, 'playerNames', playerNames);
            mp.setViewProps(clientId, 'playerAccents', playerAccents);
            mp.setViewProps(clientId, 'playerIcons', playerIcons);
            mp.setViewProps(clientId, 'isHost', clientId === mp.hostId);

            // Private: only this client's own discs (owned counts, hand, and the
            // ordered kinds they placed in their stack — which they always know).
            const me = stateData.players[clientId];
            mp.setViewProps(clientId, 'myOwnedFlowers', me ? me.ownedFlowers : 0);
            mp.setViewProps(clientId, 'myOwnedSkulls', me ? me.ownedSkulls : 0);
            mp.setViewProps(clientId, 'myHandFlowers', me ? me.handFlowers : 0);
            mp.setViewProps(clientId, 'myHandSkulls', me ? me.handSkulls : 0);
            mp.setViewProps(clientId, 'myStack', me ? me.stack : []);
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
        'startGame': SkullStartGame,
        'placeInitial': SkullPlaceInitial,
        'addDisc': SkullAddDisc,
        'openBid': SkullOpenBid,
        'raiseBid': SkullRaiseBid,
        'passBid': SkullPass,
        'flipDisc': SkullFlip,
        'chooseDiscard': SkullChooseDiscard,
        'proceedRound': SkullProceed,
        'restartGame': SkullRestartGame,
        'backToLobby': SkullBackToLobby
    },

    views: {
        'host-lobby': SkullHostLobby,
        'client-lobby': SkullClientLobby,
        'mainpage': SkullMainPage
    }
};

export default SkullRule;
