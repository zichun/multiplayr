/**
 * magicalathletes.tsx - Main "Magical Athletes" game rule definition.
 *
 * The coordinator: composes the lobby + gameshell plugins, orchestrates the host
 * tick, and publishes the (fully public) race state to every client. The only
 * per-client redaction is the racer-selection phase: a player sees their own
 * stable and pick, but opponents' picks are only revealed as a locked/unlocked
 * status until the race begins (a simultaneous reveal).
 */

import Lobby from '../lobby/lobby';
import Shell from '../gameshell/gameshell';
import './magicalathletes.scss';

import { GameRuleInterface, MPType } from '../../common/interfaces';

import {
    MagicalAthletesHostLobby,
    MagicalAthletesClientLobby,
    MagicalAthletesMainPage
} from './views/MagicalAthletesViews';

import {
    MagicalAthletesStartGame,
    MagicalAthletesDraftPick,
    MagicalAthletesChooseRacer,
    MagicalAthletesRoll,
    MagicalAthletesResolveDecision,
    MagicalAthletesAdvanceRace,
    MagicalAthletesRestartGame,
    MagicalAthletesBackToLobby
} from './MagicalAthletesMethods';

import { MagicalAthletesGameState } from './MagicalAthletesGameState';

export const MagicalAthletesRule: GameRuleInterface = {
    name: 'magicalathletes',
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
            gameState = MagicalAthletesGameState.from_data(gameState.data, gameState.playerIds);
            mp.setData('gameState', gameState);
        }

        const s = gameState.get_data();

        // ---- player identity maps (never expose raw client ids) ----
        const playerNames: { [id: string]: string } = {};
        const playerAccents: { [id: string]: string } = {};
        const playerIcons: { [id: string]: number } = {};
        s.playerIds.forEach((id, idx) => {
            const rawName = id === mp.hostId ? mp.getData('lobby_name') : mp.getPlayerData(id, 'lobby_name');
            playerNames[id] = rawName && `${rawName}`.trim().length > 0 ? rawName : `Player ${idx + 1}`;
            const rawAccent = id === mp.hostId ? mp.getData('lobby_accent') : mp.getPlayerData(id, 'lobby_accent');
            playerAccents[id] = rawAccent && `${rawAccent}`.trim().length > 0 ? rawAccent : '#7c8aa5';
            const rawIcon = id === mp.hostId ? mp.getData('lobby_icon') : mp.getPlayerData(id, 'lobby_icon');
            playerIcons[id] = typeof rawIcon === 'number' ? rawIcon : 0;
        });

        // Who has locked in a racer this Choose phase (status only, not which racer).
        const pickedStatus: { [id: string]: boolean } = {};
        const draftCounts: { [id: string]: number } = {};
        s.playerIds.forEach((id) => {
            pickedStatus[id] = !!s.picks[id];
            draftCounts[id] = (s.hands[id] || []).length;
        });

        const setViewProps = (clientId: string) => {
            mp.setViewProps(clientId, 'status', s.status);
            mp.setViewProps(clientId, 'raceNo', s.raceNo);
            mp.setViewProps(clientId, 'schedule', s.schedule);
            mp.setViewProps(clientId, 'trackId', s.trackId);
            mp.setViewProps(clientId, 'racers', s.racers);
            mp.setViewProps(clientId, 'participants', s.participants);
            mp.setViewProps(clientId, 'currentId', s.currentId);
            mp.setViewProps(clientId, 'lastRoll', s.lastRoll);
            mp.setViewProps(clientId, 'lastTurn', s.lastTurn);
            mp.setViewProps(clientId, 'pendingDecision', s.pendingDecision);
            mp.setViewProps(clientId, 'finishers', s.finishers);
            mp.setViewProps(clientId, 'eliminatedOrder', s.eliminatedOrder);
            mp.setViewProps(clientId, 'raceOver', s.raceOver);
            mp.setViewProps(clientId, 'scores', s.scores);
            mp.setViewProps(clientId, 'events', s.events);
            mp.setViewProps(clientId, 'finalWinners', s.finalWinners);
            mp.setViewProps(clientId, 'playerNames', playerNames);
            mp.setViewProps(clientId, 'playerAccents', playerAccents);
            mp.setViewProps(clientId, 'playerIcons', playerIcons);
            mp.setViewProps(clientId, 'pickedStatus', pickedStatus);
            mp.setViewProps(clientId, 'draftPool', s.draftPool);
            mp.setViewProps(clientId, 'draftSeq', s.draftSeq);
            mp.setViewProps(clientId, 'draftRound', s.draftRound);
            mp.setViewProps(clientId, 'currentDrafter', s.currentDrafter);
            mp.setViewProps(clientId, 'draftCounts', draftCounts);
            mp.setViewProps(clientId, 'isHost', clientId === mp.hostId);

            // Private: your own remaining stable + your commitment this race.
            mp.setViewProps(clientId, 'myHand', s.hands[clientId] || []);
            mp.setViewProps(clientId, 'myUsed', s.used[clientId] || []);
            mp.setViewProps(clientId, 'myPick', s.picks[clientId] || null);
        };

        mp.playersForEach((clientId) => setViewProps(clientId));
        setViewProps(mp.hostId);

        mp.setView(mp.hostId, 'mainpage');
        mp.playersForEach((clientId) => mp.setView(clientId, 'mainpage'));

        return true;
    },

    methods: {
        'startGame': MagicalAthletesStartGame,
        'draftPick': MagicalAthletesDraftPick,
        'chooseRacer': MagicalAthletesChooseRacer,
        'rollDice': MagicalAthletesRoll,
        'resolveDecision': MagicalAthletesResolveDecision,
        'advanceRace': MagicalAthletesAdvanceRace,
        'restartGame': MagicalAthletesRestartGame,
        'backToLobby': MagicalAthletesBackToLobby
    },

    views: {
        'host-lobby': MagicalAthletesHostLobby,
        'client-lobby': MagicalAthletesClientLobby,
        'mainpage': MagicalAthletesMainPage
    }
};

export default MagicalAthletesRule;
