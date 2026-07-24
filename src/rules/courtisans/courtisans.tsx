/**
 * courtisans.tsx - Main "Courtisans" game rule definition.
 *
 * The coordinator: composes plugins, orchestrates the host tick, and — crucially
 * for a hidden-information game — publishes only what each client is allowed to
 * know. Table family columns and face-up domain cards are PUBLIC; spies (whether
 * in the Queen's column or a domain) are redacted to anonymous backs for everyone,
 * INCLUDING their owner, until the end-game reveal. Hands and secret missions are
 * private to their owner.
 */

import Lobby from '../lobby/lobby';
import Shell from '../gameshell/gameshell';
import './courtisans.scss';

import {
    GameRuleInterface,
    MPType
} from '../../common/interfaces';

import {
    CourtisansHostLobby,
    CourtisansClientLobby,
    CourtisansMainPage
} from './views/CourtisansViews';

import {
    CourtisansStartGame,
    CourtisansPlaceCard,
    CourtisansResolveAssassin,
    CourtisansRestartGame,
    CourtisansBackToLobby
} from './CourtisansMethods';

import {
    CourtisansGameState,
    FAMILIES,
    Card,
    Family,
    weightOf
} from './CourtisansGameState';

export const CourtisansRule: GameRuleInterface = {
    name: 'courtisans',
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
            gameState = CourtisansGameState.from_data(gameState.data, gameState.playerIds);
            mp.setData('gameState', gameState);
        }

        const s = gameState.get_data();
        const isOver = s.status === 'GameOver';

        // ---- player identity maps (never expose raw client ids) ----
        const playerNames: { [id: string]: string } = {};
        const playerAccents: { [id: string]: string } = {};
        const playerIcons: { [id: string]: number } = {};
        const resolveName = (id: string, idx: number) => {
            const raw = id === mp.hostId
                ? (mp.getData('lobby_name') as string)
                : (mp.getPlayerData(id, 'lobby_name') as string);
            return raw && raw.trim().length > 0 ? raw : `Player ${idx + 1}`;
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
        s.playerIds.forEach((id, idx) => {
            playerNames[id] = resolveName(id, idx);
            playerAccents[id] = resolveAccent(id);
            playerIcons[id] = resolveIcon(id);
        });

        // ---- redaction helpers ----
        // A spy in play is anonymous to EVERYONE (incl. owner) until the reveal.
        const redactCard = (c: Card): any =>
            (c.role === 'spy' && !isOver) ? { id: c.id, hidden: true } : { id: c.id, family: c.family, role: c.role };

        // Table view: family columns are public; the Queen's column carries only
        // anonymous face-down spy backs (counts + ids, no family/role).
        const tableView: any = {};
        for (const f of FAMILIES) {
            tableView[f] = {
                above: s.table[f].above.map(redactCard),
                below: s.table[f].below.map(redactCard)
            };
        }
        tableView.queen = {
            above: s.table.queen.above.map((c) => ({ id: c.id, hidden: true })),
            below: s.table.queen.below.map((c) => ({ id: c.id, hidden: true }))
        };

        // Live weighted lean per family from the PUBLIC family columns only
        // (spies in the Queen's column are excluded — as they are hidden). This
        // leaks nothing that isn't already visible on the table.
        const tableLean: { [f in Family]?: { above: number; below: number } } = {};
        for (const f of FAMILIES) {
            tableLean[f] = {
                above: s.table[f].above.reduce((n, c) => n + weightOf(c), 0),
                below: s.table[f].below.reduce((n, c) => n + weightOf(c), 0)
            };
        }

        // Domains: face-up cards public; spy cards redacted to backs (until reveal).
        const domainsView: { [id: string]: any[] } = {};
        s.playerIds.forEach((id) => {
            domainsView[id] = s.domains[id].map(redactCard);
        });

        const drawCount = s.drawPile.length;
        const removedCount = s.removed.length;

        // Redact the move ticker so a spy's family never leaks through lastMove
        // (the fly animation only needs to know it was a spy → shows a back).
        let lastMoveView: any = s.lastMove;
        if (s.lastMove && s.lastMove.role === 'spy' && !isOver) {
            lastMoveView = { ...s.lastMove, family: undefined };
        }

        const setViewProps = (clientId: string) => {
            mp.setViewProps(clientId, 'gameStatus', s.status);
            mp.setViewProps(clientId, 'playerOrder', s.playerIds);
            mp.setViewProps(clientId, 'currentPlayerId', s.currentPlayerId);
            mp.setViewProps(clientId, 'turnZones', s.turnZones);
            mp.setViewProps(clientId, 'table', tableView);
            mp.setViewProps(clientId, 'tableLean', tableLean);
            mp.setViewProps(clientId, 'domains', domainsView);
            mp.setViewProps(clientId, 'drawCount', drawCount);
            mp.setViewProps(clientId, 'removedCount', removedCount);
            mp.setViewProps(clientId, 'lastMove', lastMoveView);
            mp.setViewProps(clientId, 'highlight', s.highlight);
            mp.setViewProps(clientId, 'playerNames', playerNames);
            mp.setViewProps(clientId, 'playerAccents', playerAccents);
            mp.setViewProps(clientId, 'playerIcons', playerIcons);
            mp.setViewProps(clientId, 'isHost', clientId === mp.hostId);
            mp.setViewProps(clientId, 'score', isOver ? s.score : null);

            // Private: own hand + own missions.
            mp.setViewProps(clientId, 'myHand', s.hands[clientId] || []);
            mp.setViewProps(clientId, 'myMissions', s.missions[clientId] || []);

            // Pending assassin: reveal legal targets only to the acting owner.
            const pa = s.pendingAssassin;
            if (pa) {
                mp.setViewProps(clientId, 'pendingAssassin', {
                    playerId: pa.playerId,
                    area: pa.area,
                    // targets only sent to the one who must decide
                    targets: pa.playerId === clientId ? gameState.get_assassin_targets() : []
                });
            } else {
                mp.setViewProps(clientId, 'pendingAssassin', null);
            }
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
        'startGame': CourtisansStartGame,
        'placeCard': CourtisansPlaceCard,
        'resolveAssassin': CourtisansResolveAssassin,
        'restartGame': CourtisansRestartGame,
        'backToLobby': CourtisansBackToLobby
    },

    views: {
        'host-lobby': CourtisansHostLobby,
        'client-lobby': CourtisansClientLobby,
        'mainpage': CourtisansMainPage
    }
};

export default CourtisansRule;
