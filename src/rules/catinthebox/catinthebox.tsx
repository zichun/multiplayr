/**
 * catinthebox.tsx - Main "Cat in the Box" game rule definition.
 */

import Lobby from '../lobby/lobby';
import Shell from '../gameshell/gameshell';
import './catinthebox.scss';

import {
    GameRuleInterface,
    MPType
} from '../../common/interfaces';

import {
    CatInTheBoxHostLobby,
    CatInTheBoxClientLobby,
    CatInTheBoxMainPage
} from './views/CatInTheBoxViews';

import {
    CatInTheBoxSetMode,
    CatInTheBoxStartGame,
    CatInTheBoxDiscardCard,
    CatInTheBoxMakePrediction,
    CatInTheBoxPlayCard,
    CatInTheBoxFinishTrick,
    CatInTheBoxNextRound,
    CatInTheBoxRestartGame,
    CatInTheBoxBackToLobby
} from './CatInTheBoxMethods';

import { CatInTheBoxGameState, Phase, CatColor, CatMode, OBSERVED } from './CatInTheBoxGameState';

export const CatInTheBoxRule: GameRuleInterface = {
    name: 'catinthebox',
    hostAsPlayer: true,
    plugins: {
        'lobby': Lobby,
        'gameshell': Shell
    },
    globalData: {
        gameState: null,
        catMode: 'normal',
    },
    playerData: {},

    onDataChange: (mp: MPType) => {
        const started = mp.getData('lobby_started');
        const pendingMode: CatMode = (mp.getData('catMode') as CatMode) === 'schrodinger'
            ? 'schrodinger' : 'normal';

        const showLobby = () => {
            mp.setView(mp.hostId, 'host-lobby');
            mp.setViewProps(mp.hostId, 'catMode', pendingMode);
            mp.playersForEach((clientId) => {
                mp.setView(clientId, 'client-lobby');
                mp.setViewProps(clientId, 'catMode', pendingMode);
            });
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
            gameState = CatInTheBoxGameState.from_data(gameState.data, gameState.playerIds);
            mp.setData('gameState', gameState);
        }

        const stateData = gameState.get_data();

        // Schrödinger mode hides every derived hint (X-token lockouts, legal-move
        // highlighting) while the round is live — players track claimed identities from
        // memory. The research board is still SHOWN, but frozen at its initial seeded
        // state: pre-blocked spaces (the 2-player revealed cards) remain visible, while
        // player tokens placed during the round are withheld. The full board is revealed
        // once the round has ended, as the record of what actually happened.
        const roundLive = stateData.status === Phase.Discard ||
            stateData.status === Phase.Predict ||
            stateData.status === Phase.Play;
        const hideMemory = stateData.mode === 'schrodinger' && roundLive;

        // Keep only the pre-block (OBSERVED) tokens; drop every player-owned token.
        const preblock = (row: (string | null)[]) =>
            row.map(cell => (cell === OBSERVED ? OBSERVED : null));
        const preblockBoard: Record<CatColor, (string | null)[]> = {
            red: preblock(stateData.board.red),
            blue: preblock(stateData.board.blue),
            yellow: preblock(stateData.board.yellow),
            green: preblock(stateData.board.green)
        };
        const sharedBoard = hideMemory ? preblockBoard : stateData.board;

        // The trick history reconstructs the board, so hide the CURRENT round's tricks
        // while a Schrödinger round is live. Past (finished) rounds stay visible — the
        // board resets each round, so they don't help track the current one.
        const sharedHistory = hideMemory
            ? stateData.trickHistory.filter(t => t.round !== stateData.round)
            : stateData.trickHistory;

        // Player name / accent / lobby-icon maps (never expose raw client ids to the UI).
        const playerNames: { [id: string]: string } = {};
        const playerAccents: { [id: string]: string } = {};
        const playerIcons: { [id: string]: number } = {};
        const resolveName = (id: string, fallbackIndex: number) => {
            const raw = id === mp.hostId
                ? (mp.getData('lobby_name') as string)
                : (mp.getPlayerData(id, 'lobby_name') as string);
            return raw && raw.trim().length > 0 ? raw : `Player ${fallbackIndex + 1}`;
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
        stateData.playerIds.forEach((id, idx) => {
            playerNames[id] = resolveName(id, idx);
            playerAccents[id] = resolveAccent(id);
            playerIcons[id] = resolveIcon(id);
        });

        // Public per-player snapshot (hides hands / buried cards from everyone).
        const publicPlayers: { [id: string]: any } = {};
        stateData.playerIds.forEach((id) => {
            const p = stateData.players[id];
            publicPlayers[id] = {
                // Hide colour lockouts in Schrödinger while the round is live.
                xSlots: hideMemory
                    ? { red: true, blue: true, yellow: true, green: true }
                    : p.xSlots,
                tricksWon: p.tricksWon,
                prediction: p.prediction,
                hasDiscarded: p.hasDiscarded,
                isParadox: p.isParadox,
                roundScore: p.roundScore,
                roundBonus: p.roundBonus,
                totalScore: p.totalScore,
                handCount: p.hand.length,
                roundHistory: p.roundHistory
            };
        });

        const allowedPredictions = gameState.get_allowed_predictions();

        const setViewProps = (clientId: string) => {
            mp.setViewProps(clientId, 'gameStatus', stateData.status);
            mp.setViewProps(clientId, 'mode', stateData.mode);
            mp.setViewProps(clientId, 'pendingMode', pendingMode);
            mp.setViewProps(clientId, 'round', stateData.round);
            mp.setViewProps(clientId, 'totalRounds', stateData.totalRounds);
            mp.setViewProps(clientId, 'numPlayers', stateData.numPlayers);
            mp.setViewProps(clientId, 'maxNum', stateData.maxNum);
            mp.setViewProps(clientId, 'totalTricks', stateData.totalTricks);
            mp.setViewProps(clientId, 'trickNumber', stateData.trickNumber);
            mp.setViewProps(clientId, 'board', sharedBoard);
            mp.setViewProps(clientId, 'playerOrder', stateData.playerIds);
            mp.setViewProps(clientId, 'currentPlayerId', stateData.currentPlayerId);
            mp.setViewProps(clientId, 'trickStartPlayerId', stateData.trickStartPlayerId);
            mp.setViewProps(clientId, 'roundStartId', stateData.playerIds[stateData.roundStartIndex]);
            mp.setViewProps(clientId, 'ledColor', stateData.ledColor);
            mp.setViewProps(clientId, 'currentTrick', stateData.currentTrick);
            mp.setViewProps(clientId, 'resolvingTrick', stateData.resolvingTrick);
            mp.setViewProps(clientId, 'paradoxPlayerId', stateData.paradoxPlayerId);
            mp.setViewProps(clientId, 'paradoxTrick', stateData.paradoxTrick || null);
            mp.setViewProps(clientId, 'trickHistory', sharedHistory);
            mp.setViewProps(clientId, 'winnerId', stateData.winnerId);
            mp.setViewProps(clientId, 'lastMove', stateData.lastMove);
            mp.setViewProps(clientId, 'allowedPredictions', allowedPredictions);
            mp.setViewProps(clientId, 'publicPlayers', publicPlayers);
            mp.setViewProps(clientId, 'playerNames', playerNames);
            mp.setViewProps(clientId, 'playerAccents', playerAccents);
            mp.setViewProps(clientId, 'playerIcons', playerIcons);
            mp.setViewProps(clientId, 'isHost', clientId === mp.hostId);

            // Private: only this client's own hand + their legal plays (when active).
            const myState = stateData.players[clientId];
            mp.setViewProps(clientId, 'myHand', myState ? myState.hand : []);
            // In Schrödinger this returns every colour (no hints); in normal mode it is
            // the strict legal set that greys out unavailable colours.
            const legal = (stateData.status === Phase.Play && stateData.currentPlayerId === clientId)
                ? gameState.get_declarable_plays(clientId)
                : [];
            mp.setViewProps(clientId, 'legalPlays', legal);
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
        'setMode': CatInTheBoxSetMode,
        'startGame': CatInTheBoxStartGame,
        'discardCard': CatInTheBoxDiscardCard,
        'makePrediction': CatInTheBoxMakePrediction,
        'playCard': CatInTheBoxPlayCard,
        'finishTrick': CatInTheBoxFinishTrick,
        'nextRound': CatInTheBoxNextRound,
        'restartGame': CatInTheBoxRestartGame,
        'backToLobby': CatInTheBoxBackToLobby,
    },

    views: {
        'host-lobby': CatInTheBoxHostLobby,
        'client-lobby': CatInTheBoxClientLobby,
        'mainpage': CatInTheBoxMainPage,
    }
};

export default CatInTheBoxRule;
