/**
 * offwiththeirheads.tsx - Main rule definition for "Off With Their Heads".
 *
 * The coordinator: composes the lobby + gameshell plugins, orchestrates the host
 * tick, and publishes each client's view. Sheets, the Wonderland Board, and the
 * revealed bout are PUBLIC (table convention). Hidden per client: your 9-card hand,
 * and — during selection — WHICH card you have secretly played (only the fact that
 * you have locked in is public). The acting player additionally receives their
 * current pending mark and its legal placements.
 */

import Lobby from '../lobby/lobby';
import Shell from '../gameshell/gameshell';
import './offwiththeirheads.scss';

import { GameRuleInterface, MPType } from '../../common/interfaces';

import {
    OffWithTheirHeadsHostLobby,
    OffWithTheirHeadsClientLobby,
    OffWithTheirHeadsMainPage
} from './views/OffWithTheirHeadsViews';

import {
    OWTHStartGame,
    OWTHSelectCard,
    OWTHUnselectCard,
    OWTHResolveMark,
    OWTHSkipMark,
    OWTHRestartGame,
    OWTHBackToLobby
} from './OffWithTheirHeadsMethods';

import {
    OffWithTheirHeadsGameState,
    SUIT_ORDER
} from './OffWithTheirHeadsGameState';

export const OffWithTheirHeadsRule: GameRuleInterface = {
    name: 'offwiththeirheads',
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
            gameState = OffWithTheirHeadsGameState.from_data(gameState.data, gameState.playerIds);
            mp.setData('gameState', gameState);
        }

        const s = gameState.get_data();
        const isOver = s.status === 'GameOver';

        // ---- player identity maps (never expose raw client ids) ----
        const playerNames: { [id: string]: string } = {};
        const playerAccents: { [id: string]: string } = {};
        const playerIcons: { [id: string]: number } = {};
        s.playerIds.forEach((id, idx) => {
            const rawName = id === mp.hostId ? mp.getData('lobby_name') : mp.getPlayerData(id, 'lobby_name');
            const rawAccent = id === mp.hostId ? mp.getData('lobby_accent') : mp.getPlayerData(id, 'lobby_accent');
            const rawIcon = id === mp.hostId ? mp.getData('lobby_icon') : mp.getPlayerData(id, 'lobby_icon');
            playerNames[id] = rawName && String(rawName).trim().length > 0 ? rawName : `Player ${idx + 1}`;
            playerAccents[id] = rawAccent && String(rawAccent).trim().length > 0 ? rawAccent : '#7c8aa5';
            playerIcons[id] = typeof rawIcon === 'number' ? rawIcon : 0;
        });

        // The current suit hierarchy (high -> low) derived from the Queen's index.
        const hierarchy = [0, 1, 2, 3].map(i => SUIT_ORDER[(s.queenIndex + i) % 4]);

        // Public: who has locked in a card this bout (not which card).
        const selectionReady: { [id: string]: boolean } = {};
        s.playerIds.forEach(id => { selectionReady[id] = !!s.selections[id]; });

        // Public: per-player marking progress.
        const marksState: { [id: string]: { hasPending: boolean; done: boolean } } = {};
        s.playerIds.forEach(id => {
            const ms = s.marks[id];
            marksState[id] = { hasPending: !!ms && !ms.done, done: !ms || !!ms.done };
        });

        // The revealed bout is public once we are marking / done.
        const revealView = s.reveal
            ? { playerCards: s.reveal.playerCards, extras: s.reveal.extras, positions: s.reveal.positions, rankedIds: s.reveal.rankedIds }
            : null;

        const setViewProps = (clientId: string) => {
            mp.setViewProps(clientId, 'gameStatus', s.status);
            mp.setViewProps(clientId, 'round', s.round);
            mp.setViewProps(clientId, 'bout', s.bout);
            mp.setViewProps(clientId, 'queenIndex', s.queenIndex);
            mp.setViewProps(clientId, 'queenSuit', hierarchy[0]);
            mp.setViewProps(clientId, 'hierarchy', hierarchy);
            mp.setViewProps(clientId, 'playerOrder', s.playerIds);
            mp.setViewProps(clientId, 'playerNames', playerNames);
            mp.setViewProps(clientId, 'playerAccents', playerAccents);
            mp.setViewProps(clientId, 'playerIcons', playerIcons);
            mp.setViewProps(clientId, 'sheets', s.sheets);
            mp.setViewProps(clientId, 'selectionReady', selectionReady);
            mp.setViewProps(clientId, 'marksState', marksState);
            mp.setViewProps(clientId, 'reveal', revealView);
            mp.setViewProps(clientId, 'lastMove', s.lastMove);
            mp.setViewProps(clientId, 'score', isOver ? s.score : null);
            mp.setViewProps(clientId, 'isHost', clientId === mp.hostId);

            // Private: this client's hand + secret selection.
            mp.setViewProps(clientId, 'myHand', s.hands[clientId] || []);
            mp.setViewProps(clientId, 'mySelection', s.selections[clientId] || null);

            // Private: the acting player's current pending mark + legal placements.
            const head = gameState.head_mark(clientId);
            const ms = s.marks[clientId];
            if (head && ms && !ms.done) {
                const sheet = s.sheets[clientId];
                mp.setViewProps(clientId, 'myMark', {
                    head,
                    card: ms.card,
                    position: ms.position,
                    legal: gameState.get_legal_targets(clientId),
                    teacupTargets: gameState.get_teacup_zone_targets(clientId),
                    teacupColorTargets: gameState.get_teacup_color_targets(clientId),
                    hasTeacup: sheet.teacups.some((t: number) => t === 1)
                });
            } else {
                mp.setViewProps(clientId, 'myMark', null);
            }
            mp.setViewProps(clientId, 'amDoneMarking', !ms || !!ms.done);
        };

        mp.playersForEach((clientId) => setViewProps(clientId));
        setViewProps(mp.hostId);

        mp.setView(mp.hostId, 'mainpage');
        mp.playersForEach((clientId) => mp.setView(clientId, 'mainpage'));

        return true;
    },

    methods: {
        'startGame': OWTHStartGame,
        'selectCard': OWTHSelectCard,
        'unselectCard': OWTHUnselectCard,
        'resolveMark': OWTHResolveMark,
        'skipMark': OWTHSkipMark,
        'restartGame': OWTHRestartGame,
        'backToLobby': OWTHBackToLobby
    },

    views: {
        'host-lobby': OffWithTheirHeadsHostLobby,
        'client-lobby': OffWithTheirHeadsClientLobby,
        'mainpage': OffWithTheirHeadsMainPage
    }
};

export default OffWithTheirHeadsRule;
