/**
 * projectl.tsx — Main Project L game rule definition.
 *
 * Coordinates the lobby/gameshell plugins and, on each host tick, rehydrates the
 * pure engine and distributes view props. Puzzles, piece supplies and VP piles
 * are public information in Project L, so most state is shared to every client;
 * only "whose turn / what can I do" is framed per-client.
 */

import Lobby from '../lobby/lobby';
import Shell from '../gameshell/gameshell';
import '../../client/lib/polyomino/polyomino.scss';
import './projectl.scss';

import { GameRuleInterface, MPType } from '../../common/interfaces';

import {
    ProjectLHostLobby,
    ProjectLClientLobby,
    ProjectLMainPage
} from './views/ProjectLViews';

import {
    ProjectLStartGame,
    ProjectLSetDifficulty,
    ProjectLSetGameMode,
    ProjectLRestartGame,
    ProjectLBackToLobby,
    ProjectLTakeRow,
    ProjectLTakeDeck,
    ProjectLTakeSoloGrid,
    ProjectLTakeSoloDeck,
    ProjectLRecycle,
    ProjectLUpgradeTakeL1,
    ProjectLUpgradeSwap,
    ProjectLPlace,
    ProjectLMaster,
    ProjectLPass,
    ProjectLFinishingPlace,
    ProjectLFinishingDone
} from './ProjectLMethods';

import { ProjectLGameState, Phase } from './ProjectLGameState';
import { SHAPE_IDS, SPEED_MOVE_PENALTY_SECONDS } from './ProjectLData';

function rehydrateGS(raw: any): ProjectLGameState {
    return typeof raw.get_data === 'function'
        ? raw
        : ProjectLGameState.from_data(raw.data, raw.playerIds);
}

export const ProjectLRule: GameRuleInterface = {
    name: 'projectl',
    hostAsPlayer: true,
    plugins: {
        'lobby': Lobby,
        'gameshell': Shell
    },
    globalData: {
        gameState: null,
        projectl_difficulty: 'normal',
        projectl_gamemode: 'standard',
        speedMode: false,
        speedStates: {},
        speedClears: {},
        speedSeed: 0,
        speedStart: 0
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

        // ---- name / accent / icon resolution (shared by both reconcilers) ----
        const resolveName = (id: string, idx: number) => {
            const raw = id === mp.hostId ? mp.getData('lobby_name') : mp.getPlayerData(id, 'lobby_name');
            return raw && String(raw).trim().length > 0 ? raw : `Player ${idx + 1}`;
        };
        const resolveAccent = (id: string) => {
            const raw = id === mp.hostId ? mp.getData('lobby_accent') : mp.getPlayerData(id, 'lobby_accent');
            return raw && String(raw).trim().length > 0 ? raw : '#5AA9E6';
        };

        // ==================== SPEED CONTEST reconciler ====================
        if (mp.getData('speedMode')) {
            const order = [mp.hostId as string];
            mp.playersForEach((c) => order.push(c));

            const names: Record<string, string> = {};
            const accents: Record<string, string> = {};
            order.forEach((id, idx) => { names[id] = resolveName(id, idx); accents[id] = resolveAccent(id); });

            const states = mp.getData('speedStates') || {};
            const clears = mp.getData('speedClears') || {};
            const startEpoch = mp.getData('speedStart');
            const rehydrated: Record<string, ProjectLGameState> = {};
            order.forEach((id) => { if (states[id]) rehydrated[id] = rehydrateGS(states[id]); });

            const telemetry = order.map((id) => {
                const g = rehydrated[id];
                return {
                    id,
                    name: names[id],
                    accent: accents[id],
                    moveCount: g ? g.get_move_count() : 0,
                    whiteDeck: g ? g.get_white_deck_count() : 0,
                    blackDeck: g ? g.get_black_deck_count() : 0,
                    cleared: g ? g.get_cleared() : false,
                    clearEpoch: clears[id] ?? null
                };
            });
            const allCleared = telemetry.length > 0 && telemetry.every((t) => t.cleared);

            order.forEach((clientId) => {
                const g = rehydrated[clientId];
                const me = g ? g.get_player(clientId) : undefined;
                mp.setViewProps(clientId, 'mode', 'speed');
                mp.setViewProps(clientId, 'phase', g ? g.get_phase() : Phase.Play);
                mp.setViewProps(clientId, 'actionsLeft', g ? g.get_actions_left() : 0);
                mp.setViewProps(clientId, 'round', g ? g.get_round() : 0);
                mp.setViewProps(clientId, 'mySupply', me ? me.supply : null);
                mp.setViewProps(clientId, 'myPuzzles', me ? me.puzzles : []);
                mp.setViewProps(clientId, 'myMasterUsed', false); // unlimited in speed
                mp.setViewProps(clientId, 'shared', g ? {
                    whiteRow: g.get_white_row(),
                    blackRow: g.get_black_row(),
                    whiteDeckCount: g.get_white_deck_count(),
                    blackDeckCount: g.get_black_deck_count(),
                    reserve: g.get_reserve()
                } : null);
                mp.setViewProps(clientId, 'speedBoard', telemetry);
                mp.setViewProps(clientId, 'serverNow', Date.now());
                mp.setViewProps(clientId, 'startEpoch', startEpoch);
                mp.setViewProps(clientId, 'movePenalty', SPEED_MOVE_PENALTY_SECONDS);
                mp.setViewProps(clientId, 'myMoves', g ? g.get_move_count() : 0);
                mp.setViewProps(clientId, 'myCleared', g ? g.get_cleared() : false);
                mp.setViewProps(clientId, 'allCleared', allCleared);
                mp.setViewProps(clientId, 'playerNames', names);
                mp.setViewProps(clientId, 'playerAccents', accents);
                mp.setViewProps(clientId, 'isHost', clientId === mp.hostId);
                // standard-only props zeroed out
                mp.setViewProps(clientId, 'solo', null);
                mp.setViewProps(clientId, 'publicPlayers', {});
                mp.setViewProps(clientId, 'currentPlayerId', clientId);
                mp.setViewProps(clientId, 'isMyTurn', !(g && g.get_cleared()));
                mp.setView(clientId, 'mainpage');
            });
            return true;
        }

        // ==================== STANDARD / SOLO reconciler ====================
        let gameState = mp.getData('gameState');
        if (!gameState) return showLobby();
        if (typeof gameState.get_data !== 'function') {
            gameState = ProjectLGameState.from_data(gameState.data, gameState.playerIds);
            mp.setData('gameState', gameState);
        }

        const gs: ProjectLGameState = gameState;
        const order = gs.get_player_order();

        // ---- name / accent / icon maps (never leak raw ids) ----
        const playerNames: Record<string, string> = {};
        const playerAccents: Record<string, string> = {};
        const playerIcons: Record<string, number> = {};
        const resolveIcon = (id: string) => {
            const raw = id === mp.hostId ? mp.getData('lobby_icon') : mp.getPlayerData(id, 'lobby_icon');
            return typeof raw === 'number' ? raw : 0;
        };
        order.forEach((id, idx) => {
            playerNames[id] = resolveName(id, idx);
            playerAccents[id] = resolveAccent(id);
            playerIcons[id] = resolveIcon(id);
        });

        // ---- public per-player snapshot (all open information) ----
        const publicPlayers: Record<string, any> = {};
        order.forEach((id) => {
            const p = gs.get_player(id)!;
            const pieceCount = SHAPE_IDS.reduce((a, s) => a + p.supply[s], 0);
            publicPlayers[id] = {
                puzzles: p.puzzles,
                vpPile: p.vpPile,
                vpPoints: p.vpPile.reduce((a, v) => a + v.points, 0),
                supply: p.supply,
                pieceCount,
                finishingTouchPieces: p.finishingTouchPieces,
                finishingDone: p.finishingDone
            };
        });

        const solo = gs.get_solo();
        const soloView = solo ? {
            difficulty: solo.difficulty,
            grid: solo.grid,
            locks: solo.locks,
            deckCount: solo.puzzleDeck.length,
            opponentSupply: solo.opponentSupply,
            opponentVpCount: solo.opponentVp.length,
            opponentVpPoints: solo.opponentVp.reduce((a, v) => a + v.points, 0)
        } : null;

        const shared = {
            whiteRow: gs.get_white_row(),
            blackRow: gs.get_black_row(),
            whiteDeckCount: gs.get_white_deck_count(),
            blackDeckCount: gs.get_black_deck_count(),
            reserve: gs.get_reserve()
        };

        const lastMove = gs.get_last_move();

        const setProps = (clientId: string) => {
            mp.setViewProps(clientId, 'mode', gs.get_mode());
            mp.setViewProps(clientId, 'phase', gs.get_phase());
            mp.setViewProps(clientId, 'round', gs.get_round());
            mp.setViewProps(clientId, 'actionsLeft', gs.get_actions_left());
            mp.setViewProps(clientId, 'currentPlayerId', gs.currentPlayerId());
            mp.setViewProps(clientId, 'playerOrder', order);
            mp.setViewProps(clientId, 'endTriggered', gs.get_end_triggered());
            mp.setViewProps(clientId, 'finalTurns', gs.get_final_turns());
            mp.setViewProps(clientId, 'playerNames', playerNames);
            mp.setViewProps(clientId, 'playerAccents', playerAccents);
            mp.setViewProps(clientId, 'playerIcons', playerIcons);
            mp.setViewProps(clientId, 'publicPlayers', publicPlayers);
            mp.setViewProps(clientId, 'shared', shared);
            mp.setViewProps(clientId, 'solo', soloView);
            mp.setViewProps(clientId, 'scores', gs.get_scores());
            mp.setViewProps(clientId, 'winnerIds', gs.get_winners());
            mp.setViewProps(clientId, 'soloResult', gs.get_solo_result());
            mp.setViewProps(clientId, 'isHost', clientId === mp.hostId);

            const me = gs.get_player(clientId);
            mp.setViewProps(clientId, 'mySupply', me ? me.supply : null);
            mp.setViewProps(clientId, 'myPuzzles', me ? me.puzzles : []);
            mp.setViewProps(clientId, 'myMasterUsed', me ? me.masterUsedThisTurn : false);
            mp.setViewProps(clientId, 'myFinishingDone', me ? me.finishingDone : false);
            mp.setViewProps(clientId, 'isMyTurn', clientId === gs.currentPlayerId());

            // toast for opponents' notable actions
            if (lastMove) {
                const actorName = lastMove.playerId === 'opponent'
                    ? 'AI'
                    : (playerNames[lastMove.playerId] || 'Player');
                const accent = lastMove.playerId === 'opponent'
                    ? '#2c3a4b'
                    : (playerAccents[lastMove.playerId] || '#5AA9E6');
                if (lastMove.playerId !== clientId) {
                    mp.setViewProps(clientId, 'toastNotification', {
                        id: lastMove.moveId,
                        message: `${actorName} ${lastMove.text}`,
                        bgColor: accent,
                        duration: 3200
                    });
                }
            }
        };

        order.forEach((clientId) => setProps(clientId));
        setProps(mp.hostId);

        mp.setView(mp.hostId, 'mainpage');
        mp.playersForEach((clientId) => mp.setView(clientId, 'mainpage'));

        return true;
    },

    methods: {
        'startGame': ProjectLStartGame,
        'setDifficulty': ProjectLSetDifficulty,
        'setGameMode': ProjectLSetGameMode,
        'restartGame': ProjectLRestartGame,
        'backToLobby': ProjectLBackToLobby,
        'takeRow': ProjectLTakeRow,
        'takeDeck': ProjectLTakeDeck,
        'takeSoloGrid': ProjectLTakeSoloGrid,
        'takeSoloDeck': ProjectLTakeSoloDeck,
        'recycle': ProjectLRecycle,
        'upgradeTakeL1': ProjectLUpgradeTakeL1,
        'upgradeSwap': ProjectLUpgradeSwap,
        'place': ProjectLPlace,
        'master': ProjectLMaster,
        'pass': ProjectLPass,
        'finishingPlace': ProjectLFinishingPlace,
        'finishingDone': ProjectLFinishingDone
    },

    views: {
        'host-lobby': ProjectLHostLobby,
        'client-lobby': ProjectLClientLobby,
        'mainpage': ProjectLMainPage
    }
};

export default ProjectLRule;
