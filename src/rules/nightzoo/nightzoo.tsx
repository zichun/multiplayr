/**
 * nightzoo.tsx — main Night at the Zoo game rule definition.
 *
 * Composes lobby + gameshell, and on each host tick rehydrates the pure engine
 * and distributes view props. The draft is a shared, contested step; each
 * player's placement puzzle is private, so every client receives their own full
 * board plus a light public snapshot of the others.
 */

import Lobby from '../lobby/lobby';
import Shell from '../gameshell/gameshell';
import './nightzoo.scss';

import { GameRuleInterface, MPType } from '../../common/interfaces';

import {
    NightZooHostLobby,
    NightZooClientLobby,
    NightZooMainPage
} from './views/NightZooViews';

import {
    NightZooStartGame, NightZooRestartGame, NightZooBackToLobby,
    NightZooDraft, NightZooPlaceTile, NightZooWarehouseTile, NightZooDeployWarehouse,
    NightZooDiscardTile, NightZooResolveDiscover, NightZooResolveBonus,
    NightZooResolveMove, NightZooSkipMove, NightZooFinishPlacement, NightZooFinishEndMove
} from './NightZooMethods';

import { NightZooGameState } from './NightZooGameState';

function rehydrate(raw: any): NightZooGameState {
    return typeof raw?.get_data === 'function'
        ? raw
        : NightZooGameState.from_data(raw.data, raw.playerIds);
}

export const NightZooRule: GameRuleInterface = {
    name: 'nightzoo',
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

        let raw = mp.getData('gameState');
        if (!raw) return showLobby();
        let gs = rehydrate(raw);
        if (typeof raw.get_data !== 'function') mp.setData('gameState', gs);

        const order = gs.get_player_order();

        // ---- names / accents (never leak raw ids) ----
        const resolveName = (id: string, idx: number) => {
            const v = id === mp.hostId ? mp.getData('lobby_name') : mp.getPlayerData(id, 'lobby_name');
            return v && String(v).trim() ? v : `Player ${idx + 1}`;
        };
        const resolveAccent = (id: string) => {
            const v = id === mp.hostId ? mp.getData('lobby_accent') : mp.getPlayerData(id, 'lobby_accent');
            return v && String(v).trim() ? v : '#5aa9a0';
        };
        const playerNames: Record<string, string> = {};
        const playerAccents: Record<string, string> = {};
        order.forEach((id, idx) => { playerNames[id] = resolveName(id, idx); playerAccents[id] = resolveAccent(id); });

        // ---- public per-player snapshot ----
        const publicPlayers: Record<string, any> = {};
        order.forEach((id) => {
            const p = gs.get_player(id)!;
            publicPlayers[id] = {
                grid: p.grid,
                figures: p.figures,
                warehouseCount: p.warehouse.filter(x => x != null).length,
                vp: p.vp,
                placementDone: p.placementDone,
                endMoveDone: p.endMoveDone,
                liveScore: gs.live_score(id)
            };
        });

        const phase = gs.get_phase();
        const currentDrafter = phase === 'draft' ? gs.currentDrafter() : null;
        const lastMove = gs.get_last_move();

        const shared = {
            phase,
            activeTypes: gs.get_active_types(),
            round: gs.get_round(),
            draftIndex: gs.get_draft_index(),
            draftNumber: gs.get_draft_number(),
            market: gs.get_market(),
            leftover: gs.get_leftover(),
            firstPlayer: gs.get_first_player(),
            currentDrafter,
            winningTerrain: gs.get_winning_terrain(),
            bonusPiles: gs.get_bonus_piles(),
            deckCount: gs.get_deck_count(),
            playerOrder: order,
            playerNames,
            playerAccents,
            publicPlayers,
            scores: gs.get_scores(),
            winnerIds: gs.get_winners()
        };

        const setProps = (clientId: string) => {
            const me = gs.get_player(clientId);
            mp.setViewProps(clientId, 'shared', shared);
            mp.setViewProps(clientId, 'me', me || null);
            mp.setViewProps(clientId, 'isHost', clientId === mp.hostId);
            mp.setViewProps(clientId, 'isMyDraftTurn', currentDrafter === clientId);

            if (lastMove && lastMove.playerId && lastMove.playerId !== clientId) {
                mp.setViewProps(clientId, 'toastNotification', {
                    id: lastMove.moveId,
                    message: `${playerNames[lastMove.playerId] || 'Player'} ${lastMove.text}`,
                    bgColor: playerAccents[lastMove.playerId] || '#5aa9a0',
                    duration: 2600
                });
            }
            mp.setView(clientId, 'mainpage');
        };

        order.forEach(setProps);
        return true;
    },

    methods: {
        'startGame': NightZooStartGame,
        'restartGame': NightZooRestartGame,
        'backToLobby': NightZooBackToLobby,
        'draft': NightZooDraft,
        'placeTile': NightZooPlaceTile,
        'warehouseTile': NightZooWarehouseTile,
        'deployWarehouse': NightZooDeployWarehouse,
        'discardTile': NightZooDiscardTile,
        'resolveDiscover': NightZooResolveDiscover,
        'resolveBonus': NightZooResolveBonus,
        'resolveMove': NightZooResolveMove,
        'skipMove': NightZooSkipMove,
        'finishPlacement': NightZooFinishPlacement,
        'finishEndMove': NightZooFinishEndMove
    },

    views: {
        'host-lobby': NightZooHostLobby,
        'client-lobby': NightZooClientLobby,
        'mainpage': NightZooMainPage
    }
};

export default NightZooRule;
