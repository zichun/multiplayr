/**
 * faraway.tsx — main Faraway rule definition.
 *
 * Composes the lobby + gameshell plugins and, on each host tick, rehydrates the
 * pure engine and distributes view props. Tableaux, sanctuary shelves, the
 * market and deck counts are public; a player's hand and their pending
 * sanctuary draw are framed per-client and never leave the host for anyone else.
 */

import Lobby from '../lobby/lobby';
import Shell from '../gameshell/gameshell';
import './faraway.scss';

import { GameRuleInterface, MPType } from '../../common/interfaces';

import { FarawayHostLobby, FarawayClientLobby, FarawayMainPage } from './views/FarawayViews';
import {
    FarawayStartGame, FarawaySetAdvanced, FarawayRestartGame, FarawayBackToLobby,
    FarawayDraftKeep, FarawayCommit, FarawayUncommit, FarawayTakeMarket, FarawayKeepSanctuary
} from './FarawayMethods';
import { FarawayGameState, Phase } from './FarawayGameState';

function rehydrateGS(raw: any): FarawayGameState {
    return typeof raw.get_data === 'function' ? raw : FarawayGameState.from_data(raw.data, raw.playerIds);
}

export const FarawayRule: GameRuleInterface = {
    name: 'faraway',
    hostAsPlayer: true,
    plugins: {
        'lobby': Lobby,
        'gameshell': Shell
    },
    globalData: {
        gameState: null,
        faraway_advanced: false
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
            return r && String(r).trim().length > 0 ? r : '#38a9dd';
        };
        const playerNames: Record<string, string> = {};
        const playerAccents: Record<string, string> = {};
        order.forEach((id, idx) => { playerNames[id] = resolveName(id, idx); playerAccents[id] = resolveAccent(id); });

        // Public per-player snapshot. Hands and pending draws are deliberately
        // reduced to counts here; the owner gets the real cards below.
        const publicPlayers: Record<string, any> = {};
        order.forEach((id) => {
            const p = gs.get_player(id)!;
            publicPlayers[id] = {
                tableau: [...p.tableau],
                sanctuaries: [...p.sanctuaries],
                handCount: p.hand.length,
                hasCommitted: p.committed !== null,
                pendingCount: p.pendingSanctuaries.length,
                tookMarket: p.tookMarket,
                clues: gs.clueCount(id),
                colours: gs.colourCounts(id),
                score: gs.computeScore(id)
            };
        });

        const phase = gs.get_phase();
        const currentPlayerId = gs.currentPlayerId();
        const lastMove = gs.get_last_move();

        const setProps = (clientId: string) => {
            mp.setViewProps(clientId, 'phase', phase);
            mp.setViewProps(clientId, 'round', gs.get_round());
            mp.setViewProps(clientId, 'advanced', gs.get_advanced());
            mp.setViewProps(clientId, 'playerOrder', order);
            mp.setViewProps(clientId, 'playerNames', playerNames);
            mp.setViewProps(clientId, 'playerAccents', playerAccents);
            mp.setViewProps(clientId, 'publicPlayers', publicPlayers);
            mp.setViewProps(clientId, 'market', gs.get_market());
            mp.setViewProps(clientId, 'marketActive', gs.marketActive());
            mp.setViewProps(clientId, 'turnOrder', gs.get_turn_order());
            mp.setViewProps(clientId, 'currentPlayerId', currentPlayerId);
            mp.setViewProps(clientId, 'revealed', gs.get_revealed());
            mp.setViewProps(clientId, 'regionDeckCount', gs.get_region_deck_count());
            mp.setViewProps(clientId, 'sanctuaryDeckCount', gs.get_sanctuary_deck_count());
            mp.setViewProps(clientId, 'scores', gs.get_scores());
            mp.setViewProps(clientId, 'winnerIds', gs.get_winners());
            mp.setViewProps(clientId, 'isHost', clientId === mp.hostId);

            const me = gs.get_player(clientId);
            mp.setViewProps(clientId, 'myHand', me ? [...me.hand] : []);
            mp.setViewProps(clientId, 'myDraftPool', me ? [...me.draftPool] : []);
            mp.setViewProps(clientId, 'myPending', me ? [...me.pendingSanctuaries] : []);
            mp.setViewProps(clientId, 'myCommitted', me ? me.committed : null);
            mp.setViewProps(clientId, 'myLastRegion', me ? gs.lastRegion(clientId) : null);
            mp.setViewProps(clientId, 'isMyTurn', clientId === currentPlayerId);
            mp.setViewProps(clientId, 'myPendingActions',
                me && clientId === currentPlayerId ? gs.pendingActions(clientId) : null);

            // How many sanctuaries each hand card would earn — the core tension
            // of the game, surfaced before the player commits.
            const previews: Record<number, { qualifies: boolean; draws: number }> = {};
            if (me && phase === Phase.Commit) {
                for (const cardId of me.hand) previews[cardId] = gs.sanctuaryPreview(clientId, cardId);
            }
            mp.setViewProps(clientId, 'myPreviews', previews);

            if (lastMove && lastMove.playerId !== clientId) {
                mp.setViewProps(clientId, 'toastNotification', {
                    id: lastMove.moveId,
                    message: lastMove.kind === 'reveal' || lastMove.kind === 'round'
                        ? lastMove.text
                        : `${playerNames[lastMove.playerId] || 'Player'} ${lastMove.text}`,
                    bgColor: playerAccents[lastMove.playerId] || '#38a9dd',
                    duration: 2600
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
        'startGame': FarawayStartGame,
        'setAdvanced': FarawaySetAdvanced,
        'restartGame': FarawayRestartGame,
        'backToLobby': FarawayBackToLobby,
        'draftKeep': FarawayDraftKeep,
        'commitRegion': FarawayCommit,
        'uncommitRegion': FarawayUncommit,
        'takeMarket': FarawayTakeMarket,
        'keepSanctuary': FarawayKeepSanctuary
    },

    views: {
        'host-lobby': FarawayHostLobby,
        'client-lobby': FarawayClientLobby,
        'mainpage': FarawayMainPage
    }
};

export default FarawayRule;
