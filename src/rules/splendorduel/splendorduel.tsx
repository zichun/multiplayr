/**
 * splendorduel.tsx - Main SplendorDuel game rule definition
 */

import Lobby from '../lobby/lobby';
import Shell from '../gameshell/gameshell';
import './splendorduel.scss';

import {
    GameRuleInterface,
    MPType
} from '../../common/interfaces';

import {
    SplendorDuelHostLobby,
    SplendorDuelClientLobby,
    SplendorDuelMainPage,
} from './views/SplendorDuelViews';

import {
    SplendorDuelStartGame,
    SplendorDuelUsePrivilege,
    SplendorDuelReplenishBoard,
    SplendorDuelTakeTokens,
    SplendorDuelReserveCard,
    SplendorDuelPurchaseCard,
    SplendorDuelResolveSteal,
    SplendorDuelResolveMatchingToken,
    SplendorDuelSelectRoyal,
    SplendorDuelDiscardTokens,
    SplendorDuelRestartGame,
    SplendorDuelBackToLobby
} from './SplendorDuelMethods';

import { SplendorDuelGameState, GameStatus } from './SplendorDuelGameState';

export const SplendorDuelRule: GameRuleInterface = {
    name: 'splendorduel',
    hostAsPlayer: true,
    plugins: {
        'lobby': Lobby,
        'gameshell': Shell
    },
    globalData: {
        gameState: null,
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

        // Game has started, set up game views and rehydrate state
        let gameState = mp.getData('gameState');
        if (!gameState) {
            return showLobby();
        }

        if (typeof gameState.get_data !== 'function') {
            gameState = SplendorDuelGameState.from_data(gameState.data, gameState.playerIds);
            mp.setData('gameState', gameState);
        }

        const stateData = gameState.get_data();

        // Compute player name map for views (plain strings, not React elements)
        const playerNames: { [id: string]: string } = {};
        mp.playersForEach((clientId: string) => {
            playerNames[clientId] = (mp.getPlayerData(clientId, 'lobby_name') as string) || clientId;
        });
        playerNames[mp.hostId] = (mp.getData('lobby_name') as string) || mp.hostId;

        // Sync view props function
        const setViewProps = (clientId: string) => {
            const opponentId = stateData.playerIds.find(pid => pid !== clientId) || '';
            const pState = stateData.players[clientId] || {
                tokens: { blue: 0, white: 0, green: 0, black: 0, red: 0, pearl: 0, gold: 0 },
                cards: [], royals: [], reserved: [], privileges: 0, crossed3rd: false, crossed6th: false
            };
            const oppState = stateData.players[opponentId] || {
                tokens: { blue: 0, white: 0, green: 0, black: 0, red: 0, pearl: 0, gold: 0 },
                cards: [], royals: [], reserved: [], privileges: 0, crossed3rd: false, crossed6th: false
            };

            // Calculate scores and metrics dynamically
            const prestige = gameState.calculate_player_prestige(clientId);
            const crowns = gameState.calculate_player_crowns(clientId);
            const bonuses = gameState.calculate_player_bonuses(clientId);
            const isStuck = gameState.is_player_stuck(clientId);

            const oppPrestige = gameState.calculate_player_prestige(opponentId);
            const oppCrowns = gameState.calculate_player_crowns(opponentId);
            const oppBonuses = gameState.calculate_player_bonuses(opponentId);

            mp.setViewProps(clientId, 'gameStatus', stateData.status);
            mp.setViewProps(clientId, 'actionPhase', stateData.actionPhase);
            mp.setViewProps(clientId, 'playerIds', stateData.playerIds);
            mp.setViewProps(clientId, 'currentPlayerId', stateData.currentPlayerId);
            mp.setViewProps(clientId, 'board', stateData.board);
            mp.setViewProps(clientId, 'bagSize', stateData.bag.length);
            
            mp.setViewProps(clientId, 'deckSizes', {
                '1': stateData.decks[1].length,
                '2': stateData.decks[2].length,
                '3': stateData.decks[3].length
            });
            mp.setViewProps(clientId, 'pyramid', stateData.pyramid);
            mp.setViewProps(clientId, 'royalsPool', stateData.royalsPool);
            mp.setViewProps(clientId, 'privilegesAboveBoard', stateData.privilegesAboveBoard);
            mp.setViewProps(clientId, 'winnerId', stateData.winnerId);
            mp.setViewProps(clientId, 'lastMove', stateData.lastMove);
            mp.setViewProps(clientId, 'pendingAbilityInfo', stateData.pendingAbilityInfo);
            mp.setViewProps(clientId, 'pendingRoyalCount', stateData.pendingRoyalCount);
            
            // Personal state
            mp.setViewProps(clientId, 'tokens', pState.tokens);
            mp.setViewProps(clientId, 'cards', pState.cards);
            mp.setViewProps(clientId, 'royals', pState.royals);
            mp.setViewProps(clientId, 'reserved', pState.reserved); // actual reserved cards (secret info, only visible to owner!)
            mp.setViewProps(clientId, 'privileges', pState.privileges);
            mp.setViewProps(clientId, 'prestige', prestige);
            mp.setViewProps(clientId, 'crowns', crowns);
            mp.setViewProps(clientId, 'bonuses', bonuses);
            mp.setViewProps(clientId, 'isStuck', isStuck);

            // Opponent state (enforces hidden information)
            mp.setViewProps(clientId, 'opponentId', opponentId);
            mp.setViewProps(clientId, 'opponentTokens', oppState.tokens);
            mp.setViewProps(clientId, 'opponentCards', oppState.cards);
            mp.setViewProps(clientId, 'opponentRoyals', oppState.royals);
            mp.setViewProps(clientId, 'opponentReservedCount', oppState.reserved.length); // hides the actual cards, only reveals size!
            mp.setViewProps(clientId, 'opponentPrivileges', oppState.privileges);
            mp.setViewProps(clientId, 'opponentPrestige', oppPrestige);
            mp.setViewProps(clientId, 'opponentCrowns', oppCrowns);
            mp.setViewProps(clientId, 'opponentBonuses', oppBonuses);

            mp.setViewProps(clientId, 'isHost', clientId === mp.hostId);
            mp.setViewProps(clientId, 'playerNames', playerNames);
        };

        // Distribute props to both players
        mp.playersForEach((clientId) => {
            setViewProps(clientId);
        });
        setViewProps(mp.hostId);

        // Note: the toast notification is built in the main-page view and passed to the
        // gameshell via getPluginView. Setting it here as a top-level viewProp would never
        // reach the gameshell plugin (it only receives its own namespaced props).

        // Set the view routing
        mp.setView(mp.hostId, 'mainpage');
        mp.playersForEach((clientId) => {
            mp.setView(clientId, 'mainpage');
        });

        return true;
    },

    methods: {
        'startGame': SplendorDuelStartGame,
        'usePrivilege': SplendorDuelUsePrivilege,
        'replenishBoard': SplendorDuelReplenishBoard,
        'takeTokens': SplendorDuelTakeTokens,
        'reserveCard': SplendorDuelReserveCard,
        'purchaseCard': SplendorDuelPurchaseCard,
        'resolveSteal': SplendorDuelResolveSteal,
        'resolveMatchingToken': SplendorDuelResolveMatchingToken,
        'selectRoyal': SplendorDuelSelectRoyal,
        'discardTokens': SplendorDuelDiscardTokens,
        'restartGame': SplendorDuelRestartGame,
        'backToLobby': SplendorDuelBackToLobby,
    },

    views: {
        'host-lobby': SplendorDuelHostLobby,
        'client-lobby': SplendorDuelClientLobby,
        'mainpage': SplendorDuelMainPage,
    }
};

export default SplendorDuelRule;
