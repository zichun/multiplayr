/**
 * catchsketch.tsx - Main Catch Sketch game rule definition
 */

import Lobby from '../lobby/lobby';
import Shell from '../gameshell/gameshell';
import Drawing from '../drawing/drawing';
import './catchsketch.scss';

import {
    GameRuleInterface,
    MPType
} from '../../common/interfaces';

import {
    CatchSketchHostLobby,
    CatchSketchClientLobby,
    CatchSketchMainPage,
} from './views/CatchSketchViews';

import {
    CatchSketchStartGame,
    CatchSketchLockToken,
    CatchSketchSubmitGuess,
    CatchSketchNextRound,
    CatchSketchBackToLobby
} from './CatchSketchMethods';

import { CatchSketchGameState } from './CatchSketchGameState';

export const CatchSketchRule: GameRuleInterface = {
    name: 'catchsketch',
    plugins: {
        'lobby': Lobby,
        'gameshell': Shell,
        'drawing': Drawing
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
        if (!gameState || !gameState.get_player_data) {
            // If no game state or invalid state, go back to lobby
            if (!gameState) {
                return showLobby();
            }
            
            // Restore gameState instance
            gameState = CatchSketchGameState.from_data(gameState.data, gameState.playerIds);
            mp.setData('gameState', gameState);
        }

        function setViewProps(mp: MPType, clientId: string) {
            const playerData = gameState.get_player_data(clientId);
            const isGuesser = clientId === gameState.get_current_guesser();
            const isHost = clientId === mp.hostId;

            // Set common props
            mp.setViewProps(clientId, 'round', gameState.get_round());
            mp.setViewProps(clientId, 'currentGuesser', gameState.get_current_guesser());
            mp.setViewProps(clientId, 'isGuesser', isGuesser);
            mp.setViewProps(clientId, 'isHost', isHost);
            mp.setViewProps(clientId, 'scores', gameState.get_scores());
            mp.setViewProps(clientId, 'tokensClaimed', gameState.get_tokens_claimed());
            mp.setViewProps(clientId, 'turnOrder', gameState.get_turn_order());
            mp.setViewProps(clientId, 'guesses', gameState.get_guesses());
            mp.setViewProps(clientId, 'currentDrawingPlayer', gameState.get_current_drawing_player());
            
            // Phase flags
            mp.setViewProps(clientId, 'isDrawingPhase', gameState.is_drawing_phase());
            mp.setViewProps(clientId, 'isGuessingPhase', gameState.is_guessing_phase());
            mp.setViewProps(clientId, 'isReviewPhase', gameState.is_review_phase());

            // Token ownership information
            const tokenOwnership: { [token: number]: string | null } = { 1: null, 2: null };
            for (const playerId of gameState.get_player_ids()) {
                const player = gameState.get_player_data(playerId);
                if (player?.tokenNumber) {
                    tokenOwnership[player.tokenNumber] = playerId;
                }
            }
            mp.setViewProps(clientId, 'tokenOwnership', tokenOwnership);

            // Player-specific data
            if (playerData) {
                mp.setViewProps(clientId, 'playerData', playerData);
            }

            // Secret word (only for drawers in drawing phase, and everyone in review phase)
            if (!isGuesser || gameState.is_review_phase()) {
                mp.setViewProps(clientId, 'secretWord', gameState.get_secret_word());
            } else {
                mp.setViewProps(clientId, 'secretWord', '');
            }

            // Canvas data - get from drawing plugin
            const hostCanvas = mp.getData('drawing_canvas');
            mp.setViewProps(clientId, 'hostCanvas', hostCanvas);

            // Get all player canvases, but only propagate in guessing/review phases
            const allCanvases: { [playerId: string]: any } = {};
            if (gameState.is_guessing_phase() || gameState.is_review_phase()) {
                mp.playersForEach((playerId) => {
                    const playerCanvas = mp.getPlayerData(playerId, 'drawing_canvas');
                    if (playerCanvas) {
                        allCanvases[playerId] = playerCanvas;
                    }
                });
            }
            mp.setViewProps(clientId, 'allCanvases', allCanvases);

            // Current canvas for drawing
            let currentCanvas = null;
            if (clientId === mp.hostId) {
                currentCanvas = hostCanvas;
            } else {
                currentCanvas = mp.getPlayerData(clientId, 'drawing_canvas');
            }
            mp.setViewProps(clientId, 'currentCanvas', currentCanvas);
        }

        // Set props for all players
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
        'startGame': CatchSketchStartGame,
        'lockToken': CatchSketchLockToken,
        'submitGuess': CatchSketchSubmitGuess,
        'nextRound': CatchSketchNextRound,
        'backToLobby': CatchSketchBackToLobby,
    },

    views: {
        'host-lobby': CatchSketchHostLobby,
        'client-lobby': CatchSketchClientLobby,
        'mainpage': CatchSketchMainPage,
    }
};

export default CatchSketchRule;