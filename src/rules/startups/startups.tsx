/**
 * startups.tsx - Main Startups game rule definition
 */

import Lobby from '../lobby/lobby';
import Shell from '../gameshell/gameshell';
import './startups.scss';

import {
    GameRuleInterface,
    MPType
} from '../../common/interfaces';

import {
    StartupsHostLobby,
    StartupsClientLobby,
    StartupsMainPage,
} from './views/StartupsViews';

import {
    StartupsStartGame,
    StartupsDrawFromDeck,
    StartupsTakeFromMarket,
    StartupsInvestCard,
    StartupsDiscardCard,
    StartupsNextScoringCompany,
    StartupsRestartGame,
    StartupsBackToLobby
} from './StartupsMethods';

import { StartupsGameState } from './StartupsGameState';

export const StartupsRule: GameRuleInterface = {
    name: 'startups',
    hostAsPlayer: true,
    plugins: {
        'lobby': Lobby,
        'gameshell': Shell
    },
    globalData: {
        gameState: null,
    },
    playerData: {
    },
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

        // Game has started, set up main game views
        let gameState = mp.getData('gameState');
        if (!gameState.get_player_ids) {
            gameState = StartupsGameState.from_data(gameState.data, gameState.playerIds);
            mp.setData('gameState', gameState);
        }

        function setViewProps(mp: MPType, clientId: string) {
            const data = gameState.get_data();
            const playerState = data.players[clientId];

            // Set individual player data
            mp.setViewProps(clientId, 'gameStatus', data.status);
            mp.setViewProps(clientId, 'deckCount', data.deck.length);
            mp.setViewProps(clientId, 'market', data.market);
            mp.setViewProps(clientId, 'players', data.players);
            mp.setViewProps(clientId, 'playerIds', gameState.get_player_ids());
            mp.setViewProps(clientId, 'currentPlayerId', gameState.get_player_ids()[data.currentPlayerIndex]);
            mp.setViewProps(clientId, 'antiMonopolyTokens', data.antiMonopolyTokens);
            mp.setViewProps(clientId, 'scoringCompanyIndex', data.scoringCompanyIndex);
            mp.setViewProps(clientId, 'scoringLogs', data.scoringLogs);
            mp.setViewProps(clientId, 'isHost', clientId === mp.hostId);
            mp.setViewProps(clientId, 'lastTakenFromMarketCompany', data.lastTakenFromMarketCompany);
            mp.setViewProps(clientId, 'lastMove', data.lastMove || null);

            if (playerState) {
                mp.setViewProps(clientId, 'hand', playerState.hand);
                mp.setViewProps(clientId, 'portfolio', playerState.portfolio);
                mp.setViewProps(clientId, 'coins1', playerState.coins1);
                mp.setViewProps(clientId, 'coins3', playerState.coins3);
            }
        }

        // Set common props for all players
        mp.playersForEach((clientId) => {
            setViewProps(mp, clientId);
        });
        setViewProps(mp, mp.hostId);

        // Set views
        mp.setView(mp.hostId, 'mainpage');
        mp.playersForEach((clientId) => {
            mp.setView(clientId, 'mainpage');
        });

        return true;
    },

    methods: {
        'startGame': StartupsStartGame,
        'drawFromDeck': StartupsDrawFromDeck,
        'takeFromMarket': StartupsTakeFromMarket,
        'investCard': StartupsInvestCard,
        'discardCard': StartupsDiscardCard,
        'nextScoringCompany': StartupsNextScoringCompany,
        'restartGame': StartupsRestartGame,
        'backToLobby': StartupsBackToLobby,
    },

    views: {
        'host-lobby': StartupsHostLobby,
        'client-lobby': StartupsClientLobby,
        'mainpage': StartupsMainPage,
    }
};

export default StartupsRule;
