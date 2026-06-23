/**
 * jaipur.tsx - Main Jaipur game rule definition
 */

import Lobby from '../lobby/lobby';
import Shell from '../gameshell/gameshell';
import './jaipur.scss';

import {
    GameRuleInterface,
    MPType
} from '../../common/interfaces';

import {
    JaipurHostLobby,
    JaipurClientLobby,
    JaipurMainPage,
} from './views/JaipurViews';

import {
    JaipurStartGame,
    JaipurTakeSingleGood,
    JaipurTakeAllCamels,
    JaipurExchangeGoods,
    JaipurSellGoods,
    JaipurNextRound,
    JaipurRestartGame,
    JaipurBackToLobby
} from './JaipurMethods';

import { JaipurGameState, GameStatus } from './JaipurGameState';

export const JaipurRule: GameRuleInterface = {
    name: 'jaipur',
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
            gameState = JaipurGameState.from_data(gameState.data, gameState.playerIds);
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
            const pState = stateData.players[clientId] || { hand: [], herd: [], tokens: [], seals: 0, rupeesThisRound: 0 };
            const oppState = stateData.players[opponentId] || { hand: [], herd: [], tokens: [], seals: 0, rupeesThisRound: 0 };

            mp.setViewProps(clientId, 'gameStatus', stateData.status);
            mp.setViewProps(clientId, 'playerIds', stateData.playerIds);
            mp.setViewProps(clientId, 'currentPlayerId', stateData.currentPlayerId);
            mp.setViewProps(clientId, 'market', stateData.market);
            mp.setViewProps(clientId, 'deckSize', stateData.deck.length);
            mp.setViewProps(clientId, 'discardPile', stateData.discardPile);
            mp.setViewProps(clientId, 'goodsTokens', stateData.goodsTokens);
            mp.setViewProps(clientId, 'bonusTokensSizes', {
                '3': stateData.bonusTokens['3'].length,
                '4': stateData.bonusTokens['4'].length,
                '5': stateData.bonusTokens['5'].length
            });
            mp.setViewProps(clientId, 'camelTokenClaimedBy', stateData.camelTokenClaimedBy);
            mp.setViewProps(clientId, 'winnerId', stateData.winnerId);
            mp.setViewProps(clientId, 'roundNumber', stateData.roundNumber);
            mp.setViewProps(clientId, 'lastMove', stateData.lastMove);
            mp.setViewProps(clientId, 'roundResults', stateData.roundResults);
            
            // Client personal state
            mp.setViewProps(clientId, 'hand', pState.hand);
            mp.setViewProps(clientId, 'herd', pState.herd);
            mp.setViewProps(clientId, 'tokens', pState.tokens);
            mp.setViewProps(clientId, 'seals', pState.seals);
            mp.setViewProps(clientId, 'rupeesThisRound', pState.rupeesThisRound);

            // Opponent public/private state
            mp.setViewProps(clientId, 'opponentId', opponentId);
            mp.setViewProps(clientId, 'opponentHandSize', oppState.hand.length);
            
            // Opponent herd is hidden during play and revealed at round end / game over
            const isRevealed = stateData.status === GameStatus.RoundEnd || stateData.status === GameStatus.GameOver;
            mp.setViewProps(clientId, 'opponentHerdSize', isRevealed ? oppState.herd.length : null);
            mp.setViewProps(clientId, 'opponentTokensCount', oppState.tokens.length);
            mp.setViewProps(clientId, 'opponentTokens', oppState.tokens);
            mp.setViewProps(clientId, 'opponentSeals', oppState.seals);
            mp.setViewProps(clientId, 'opponentRupeesThisRound', oppState.rupeesThisRound);

            mp.setViewProps(clientId, 'isHost', clientId === mp.hostId);
            mp.setViewProps(clientId, 'playerNames', playerNames);
        };

        // Distribute props
        mp.playersForEach((clientId) => {
            setViewProps(clientId);
        });
        setViewProps(mp.hostId);

        // Push toast notification if moves happened
        const lastMove = stateData.lastMove;
        if (lastMove) {
            const idx = stateData.playerIds.indexOf(lastMove.playerId);
            const accents = stateData.playerIds.map(pid => {
                if (pid === mp.hostId) {
                    return (mp.getData('lobby_accent') as string) || '#F4C430';
                } else {
                    return (mp.getPlayerData(pid, 'lobby_accent') as string) || '#C25A3F';
                }
            });
            const playerAccent = accents[idx] || '#2c3e50';
            const text = `${playerNames[lastMove.playerId]} ${lastMove.desc}`;
            
            const notify = (clientId: string) => {
                mp.setViewProps(clientId, 'toastNotification', {
                    id: lastMove.moveId,
                    message: text,
                    bgColor: playerAccent,
                    duration: 4000
                });
            };
            mp.playersForEach(notify);
            notify(mp.hostId);
        }

        // Set the view routing
        mp.setView(mp.hostId, 'mainpage');
        mp.playersForEach((clientId) => {
            mp.setView(clientId, 'mainpage');
        });

        return true;
    },

    methods: {
        'startGame': JaipurStartGame,
        'takeSingleGood': JaipurTakeSingleGood,
        'takeAllCamels': JaipurTakeAllCamels,
        'exchangeGoods': JaipurExchangeGoods,
        'sellGoods': JaipurSellGoods,
        'nextRound': JaipurNextRound,
        'restartGame': JaipurRestartGame,
        'backToLobby': JaipurBackToLobby,
    },

    views: {
        'host-lobby': JaipurHostLobby,
        'client-lobby': JaipurClientLobby,
        'mainpage': JaipurMainPage,
    }
};

export default JaipurRule;
