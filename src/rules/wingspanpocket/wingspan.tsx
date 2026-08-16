/**
 * wingspan.tsx — main Wingspan (Pocket) rule definition.
 *
 * Composes the lobby + gameshell plugins and, on each host tick, rehydrates the
 * pure engine and distributes view props. The supply, goals and every flock are
 * public information, so most state is shared to all clients; only a player's
 * own reserve is framed per-client (hidden hand).
 */

import Lobby from '../lobby/lobby';
import Shell from '../gameshell/gameshell';
import './wingspan.scss';

import { GameRuleInterface, MPType } from '../../common/interfaces';

import { WingspanHostLobby, WingspanClientLobby, WingspanMainPage } from './views/WingspanViews';
import {
    WingspanStartGame, WingspanSetAdvanced, WingspanRestartGame, WingspanBackToLobby,
    WingspanPlayBird, WingspanDraw2, WingspanDrawCard, WingspanFinishDraw, WingspanLayEggs,
    WingspanActivate, WingspanSkipActivation, WingspanEndActivation, WingspanRespondAllPlayers,
    WingspanFinalize
} from './WingspanMethods';
import { WingspanGameState, Phase } from './WingspanGameState';

function rehydrateGS(raw: any): WingspanGameState {
    return typeof raw.get_data === 'function' ? raw : WingspanGameState.from_data(raw.data, raw.playerIds);
}

export const WingspanRule: GameRuleInterface = {
    name: 'wingspanpocket',
    hostAsPlayer: true,
    plugins: {
        'lobby': Lobby,
        'gameshell': Shell
    },
    globalData: {
        gameState: null,
        wingspan_advanced: true
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

        const raw = mp.getData('gameState');
        if (!raw) return showLobby();
        const gs = rehydrateGS(raw);
        if (typeof (mp.getData('gameState') as any).get_data !== 'function') {
            mp.setData('gameState', gs);
        }

        const order = gs.get_player_order();

        const resolveName = (id: string, idx: number) => {
            const r = id === mp.hostId ? mp.getData('lobby_name') : mp.getPlayerData(id, 'lobby_name');
            return r && String(r).trim().length > 0 ? r : `Player ${idx + 1}`;
        };
        const resolveAccent = (id: string) => {
            const r = id === mp.hostId ? mp.getData('lobby_accent') : mp.getPlayerData(id, 'lobby_accent');
            return r && String(r).trim().length > 0 ? r : '#4a90d9';
        };
        const playerNames: Record<string, string> = {};
        const playerAccents: Record<string, string> = {};
        order.forEach((id, idx) => { playerNames[id] = resolveName(id, idx); playerAccents[id] = resolveAccent(id); });

        const isGameOver = gs.get_phase() === Phase.Scoring || gs.get_phase() === Phase.Done;
        // public per-player snapshot (all flocks and reserves are open information)
        const publicPlayers: Record<string, any> = {};
        order.forEach((id) => {
            const p = gs.get_player(id)!;
            publicPlayers[id] = {
                nestEggs: p.nestEggs,
                flock: p.flock,
                reserveCount: p.reserve.length,
                reserve: p.reserve,
                flockSize: p.flock.length,
                score: gs.computeScore(id),
                turnCount: gs.get_turn_count(id),
                turnLog: gs.get_turn_log(id)
            };
        });

        const supply = {
            supplyBirds: gs.get_supply_birds(),
            foodDeckCounts: gs.get_food_deck_counts(),
            foodDeckTops: gs.get_food_deck_tops(),
            foodDecks: gs.get_food_decks(),
            discardCount: gs.get_discard_count()
        };

        const lastMove = gs.get_last_move();
        const currentPlayerId = gs.currentPlayerId();

        const setProps = (clientId: string) => {
            mp.setViewProps(clientId, 'phase', gs.get_phase());
            mp.setViewProps(clientId, 'advanced', gs.get_advanced());
            mp.setViewProps(clientId, 'goals', gs.get_goals());
            mp.setViewProps(clientId, 'playerOrder', order);
            mp.setViewProps(clientId, 'currentPlayerId', currentPlayerId);
            mp.setViewProps(clientId, 'playerNames', playerNames);
            mp.setViewProps(clientId, 'playerAccents', playerAccents);
            mp.setViewProps(clientId, 'publicPlayers', publicPlayers);
            mp.setViewProps(clientId, 'supply', supply);
            mp.setViewProps(clientId, 'endTriggered', gs.get_end_triggered());
            mp.setViewProps(clientId, 'scores', gs.get_scores());
            mp.setViewProps(clientId, 'winnerIds', gs.get_winners());
            mp.setViewProps(clientId, 'nestTaken', gs.get_nest_taken());
            mp.setViewProps(clientId, 'isHost', clientId === mp.hostId);

            const me = gs.get_player(clientId);
            mp.setViewProps(clientId, 'myReserve', me ? me.reserve : []);
            // precompute the cheapest legal payment for each reserve bird (affordability UI)
            const myPlayable: Record<number, any> = {};
            if (me && clientId === currentPlayerId && gs.get_phase() === Phase.Nest && !gs.get_nest_taken()) {
                for (const r of me.reserve) if (r.face === 'bird') myPlayable[r.cardId] = gs.computeAutoPayment(clientId, r.cardId);
            }
            mp.setViewProps(clientId, 'myPlayable', myPlayable);
            mp.setViewProps(clientId, 'myTokenIndex', me ? me.tokenIndex : 0);
            mp.setViewProps(clientId, 'isMyTurn', clientId === currentPlayerId);
            mp.setViewProps(clientId, 'activeBirdIndex',
                clientId === currentPlayerId ? gs.get_active_bird_index() : -1);
            mp.setViewProps(clientId, 'pendingAllPlayers', gs.get_pending_all_players());
            mp.setViewProps(clientId, 'pendingDraw', gs.get_pending_draw());

            if (lastMove && lastMove.playerId !== clientId) {
                mp.setViewProps(clientId, 'toastNotification', {
                    id: lastMove.moveId,
                    message: `${playerNames[lastMove.playerId] || 'Player'} ${lastMove.text}`,
                    bgColor: playerAccents[lastMove.playerId] || '#4a90d9',
                    duration: 2800
                });
            }
        };

        order.forEach((clientId) => setProps(clientId));
        setProps(mp.hostId);

        mp.setView(mp.hostId, 'mainpage');
        mp.playersForEach((clientId) => mp.setView(clientId, 'mainpage'));
        return true;
    },

    methods: {
        'startGame': WingspanStartGame,
        'setAdvanced': WingspanSetAdvanced,
        'restartGame': WingspanRestartGame,
        'backToLobby': WingspanBackToLobby,
        'playBird': WingspanPlayBird,
        'draw2': WingspanDraw2,
        'drawCard': WingspanDrawCard,
        'finishDraw': WingspanFinishDraw,
        'layEggs': WingspanLayEggs,
        'activate': WingspanActivate,
        'skipActivation': WingspanSkipActivation,
        'endActivation': WingspanEndActivation,
        'respondAllPlayers': WingspanRespondAllPlayers,
        'finalize': WingspanFinalize
    },

    views: {
        'host-lobby': WingspanHostLobby,
        'client-lobby': WingspanClientLobby,
        'mainpage': WingspanMainPage
    }
};

export default WingspanRule;
