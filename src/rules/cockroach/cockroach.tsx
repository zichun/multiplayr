/**
 * cockroach.tsx - Main Cockroach Poker: Royal game rule definition
 */

import Lobby from '../lobby/lobby';
import Shell from '../gameshell/gameshell';
import './cockroach.scss';

import {
    GameRuleInterface,
    MPType
} from '../../common/interfaces';

import {
    CockroachHostLobby,
    CockroachClientLobby,
    CockroachMainPage,
} from './views/CockroachViews';

import {
    CockroachStartGame,
    CockroachPassCard,
    CockroachDecideCard,
    CockroachResolveSpecial,
    CockroachRestartGame,
    CockroachBackToLobby
} from './CockroachMethods';

import { CockroachGameState } from './CockroachGameState';

export const CockroachRule: GameRuleInterface = {
    name: 'cockroach',
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
            gameState = CockroachGameState.from_data(gameState.data, gameState.playerIds);
            mp.setData('gameState', gameState);
        }

        const stateData = gameState.get_data();

        // Compute player name map for views (plain strings, not React elements)
        const playerNames: { [id: string]: string } = {};
        mp.playersForEach((clientId: string) => {
            playerNames[clientId] = (mp.getPlayerData(clientId, 'lobby_name') as string) || clientId;
        });
        playerNames[mp.hostId] = (mp.getData('lobby_name') as string) || mp.hostId;

        // Calculate top card of the penalty pile (always visible to everyone)
        const penaltyPile = stateData.penaltyPile;
        const penaltyTopCard = penaltyPile.length > 0 ? penaltyPile[penaltyPile.length - 1] : null;

        // Compute player hand sizes map
        const handSizes = Object.fromEntries(
            stateData.playerIds.map(id => [id, stateData.hands[id]?.length || 0])
        );

        const setViewProps = (clientId: string) => {
            // Determine if player has access to the card currently in transit (original sender or target receiver)
            const isSender = (clientId === stateData.lastSenderId);
            const isReceiver = (clientId === stateData.receiverId);
            const transitCard = (isSender || isReceiver) ? stateData.currentCard : null;

            mp.setViewProps(clientId, 'gameStatus', stateData.status);
            mp.setViewProps(clientId, 'playerIds', stateData.playerIds);
            mp.setViewProps(clientId, 'currentPlayerId', stateData.currentPlayerId);
            mp.setViewProps(clientId, 'lastSenderId', stateData.lastSenderId);
            mp.setViewProps(clientId, 'receiverId', stateData.receiverId);
            mp.setViewProps(clientId, 'currentCard', transitCard);
            mp.setViewProps(clientId, 'currentClaim', stateData.currentClaim);
            mp.setViewProps(clientId, 'passingChain', stateData.passingChain);
            mp.setViewProps(clientId, 'penaltyPileSize', penaltyPile.length);
            mp.setViewProps(clientId, 'penaltyTopCard', penaltyTopCard);
            mp.setViewProps(clientId, 'tableaus', stateData.tableaus);
            mp.setViewProps(clientId, 'hand', stateData.hands[clientId] || []);
            mp.setViewProps(clientId, 'handSizes', handSizes);
            mp.setViewProps(clientId, 'loserId', stateData.loserId);
            mp.setViewProps(clientId, 'resolutionDetails', stateData.resolutionDetails);
            mp.setViewProps(clientId, 'variant2Player', stateData.variant2Player);
            mp.setViewProps(clientId, 'isHost', clientId === mp.hostId);
            mp.setViewProps(clientId, 'playerNames', playerNames);
        };

        // Distribute props
        mp.playersForEach((clientId) => {
            setViewProps(clientId);
        });
        setViewProps(mp.hostId);

        // Set the view routing
        mp.setView(mp.hostId, 'mainpage');
        mp.playersForEach((clientId) => {
            mp.setView(clientId, 'mainpage');
        });

        return true;
    },

    methods: {
        'startGame': CockroachStartGame,
        'passCard': CockroachPassCard,
        'decideCard': CockroachDecideCard,
        'resolveSpecial': CockroachResolveSpecial,
        'restartGame': CockroachRestartGame,
        'backToLobby': CockroachBackToLobby,
    },

    views: {
        'host-lobby': CockroachHostLobby,
        'client-lobby': CockroachClientLobby,
        'mainpage': CockroachMainPage,
    }
};

export default CockroachRule;
