/**
 * moonrollers.tsx - Main Moonrollers game rule definition (2-5 players).
 *
 * Coordinates the lobby/gameshell plugins and the reactive tick: rehydrates the pure
 * MoonrollersGameState, then distributes public table state to everyone and private
 * state (own Hazard tokens, own drawn-Hazard choice, own ability affordances) only to
 * the owning client.
 */

import Lobby from '../lobby/lobby';
import Shell from '../gameshell/gameshell';
import './moonrollers.scss';

import { GameRuleInterface, MPType } from '../../common/interfaces';

import {
    MoonrollersHostLobby,
    MoonrollersClientLobby,
    MoonrollersMainPage
} from './views/MoonrollersViews';

import {
    MoonrollersStartGame,
    MoonrollersChooseCard,
    MoonrollersCommit,
    MoonrollersLockDie,
    MoonrollersAbilityRetag,
    MoonrollersAbilityExtraLock,
    MoonrollersAbilityRerollAll,
    MoonrollersUseAbility,
    MoonrollersDismissTransient,
    MoonrollersRollAgain,
    MoonrollersStop,
    MoonrollersKeepHazard,
    MoonrollersResolveDuplicate,
    MoonrollersRestartGame,
    MoonrollersBackToLobby
} from './MoonrollersMethods';

import { MoonrollersGameState } from './MoonrollersGameState';

export const MoonrollersRule: GameRuleInterface = {
    name: 'moonrollers',
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

        let gameState = mp.getData('gameState');
        if (!gameState) return showLobby();
        if (typeof gameState.get_data !== 'function') {
            gameState = MoonrollersGameState.from_data(gameState.data, gameState.playerIds);
            mp.setData('gameState', gameState);
        }

        const d = gameState.get_data();

        // Plain-string name map.
        const playerNames: { [id: string]: string } = {};
        mp.playersForEach((clientId: string) => {
            playerNames[clientId] = (mp.getPlayerData(clientId, 'lobby_name') as string) || clientId;
        });
        playerNames[mp.hostId] = (mp.getData('lobby_name') as string) || mp.hostId;

        // Public per-player summary (hired crew + prestige are public; Hazard tokens are
        // hidden — only their count is public).
        const publicPlayers = d.playerIds.map((pid: string) => ({
            id: pid,
            name: playerNames[pid] || pid,
            prestige: d.players[pid].prestige,
            factionCounts: gameState.faction_counts(pid),
            hired: d.players[pid].hired.map((c: any) => ({ id: c.id, name: c.name, faction: c.faction, abilityText: c.abilityText, starting: c.isStartingCrew })),
            hazardCount: d.players[pid].hazardTokens.length
        }));

        const setFor = (clientId: string) => {
            // Public table state.
            mp.setViewProps(clientId, 'status', d.status);
            mp.setViewProps(clientId, 'step', d.step);
            mp.setViewProps(clientId, 'playerIds', d.playerIds);
            mp.setViewProps(clientId, 'firstPlayerId', d.firstPlayerId);
            mp.setViewProps(clientId, 'currentPlayerId', d.currentPlayerId);
            mp.setViewProps(clientId, 'display', d.display);
            mp.setViewProps(clientId, 'deckSize', d.deck.length);
            mp.setViewProps(clientId, 'rollingPool', d.rollingPool);
            mp.setViewProps(clientId, 'supplyCount', d.supplyCount);
            mp.setViewProps(clientId, 'lockedCount', d.lockedCount);
            mp.setViewProps(clientId, 'chosenCardIndex', d.chosenCardIndex);
            mp.setViewProps(clientId, 'committedReqIndex', d.committedReqIndex);
            mp.setViewProps(clientId, 'committedProgress', d.committedProgress);
            mp.setViewProps(clientId, 'lockedThisRoll', d.lockedThisRoll);
            mp.setViewProps(clientId, 'bustSafeThisRoll', d.bustSafeThisRoll);
            mp.setViewProps(clientId, 'rollId', d.rollId);
            mp.setViewProps(clientId, 'pendingAbilityFaction', d.pendingAbilityFaction);
            mp.setViewProps(clientId, 'publicPlayers', publicPlayers);
            mp.setViewProps(clientId, 'playerNames', playerNames);
            mp.setViewProps(clientId, 'winnerIds', d.winnerIds);
            mp.setViewProps(clientId, 'finalScores', d.finalScores);
            mp.setViewProps(clientId, 'lastMove', d.lastMove);

            // Private state.
            mp.setViewProps(clientId, 'myId', clientId);
            mp.setViewProps(clientId, 'isHost', clientId === mp.hostId);
            mp.setViewProps(clientId, 'myHazardTokens', d.players[clientId] ? d.players[clientId].hazardTokens : []);
            mp.setViewProps(clientId, 'myAbilities', gameState.active_abilities(clientId));
            mp.setViewProps(clientId, 'affordances', gameState.affordances(clientId));
            // The two drawn Hazard tokens are private to the active drawer.
            const showHazardChoice = d.step === 'HAZARD' && d.currentPlayerId === clientId;
            mp.setViewProps(clientId, 'pendingHazards', showHazardChoice ? d.pendingHazards : []);
        };

        mp.playersForEach((clientId) => setFor(clientId));
        setFor(mp.hostId);

        mp.setView(mp.hostId, 'mainpage');
        mp.playersForEach((clientId) => mp.setView(clientId, 'mainpage'));

        return true;
    },

    methods: {
        'startGame': MoonrollersStartGame,
        'chooseCard': MoonrollersChooseCard,
        'commit': MoonrollersCommit,
        'lockDie': MoonrollersLockDie,
        'abilityRetag': MoonrollersAbilityRetag,
        'abilityExtraLock': MoonrollersAbilityExtraLock,
        'abilityRerollAll': MoonrollersAbilityRerollAll,
        'useAbility': MoonrollersUseAbility,
        'dismissTransient': MoonrollersDismissTransient,
        'rollAgain': MoonrollersRollAgain,
        'stop': MoonrollersStop,
        'keepHazard': MoonrollersKeepHazard,
        'resolveDuplicate': MoonrollersResolveDuplicate,
        'restartGame': MoonrollersRestartGame,
        'backToLobby': MoonrollersBackToLobby
    },

    views: {
        'host-lobby': MoonrollersHostLobby,
        'client-lobby': MoonrollersClientLobby,
        'mainpage': MoonrollersMainPage
    }
};

export default MoonrollersRule;
