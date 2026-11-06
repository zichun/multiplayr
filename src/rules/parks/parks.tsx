/**
 * parks.tsx — main Parks rule definition.
 *
 * Composes the lobby + gameshell plugins and, on each host tick, rehydrates the
 * pure engine and hands every client its own projection. `view_for` is the only
 * thing that leaves the host, so decks and other players' Year cards stay secret.
 */

import Lobby from '../lobby/lobby';
import Shell from '../gameshell/gameshell';
import './parks.scss';

import { GameRuleInterface, MPType } from '../../common/interfaces';

import { ParksHostLobby, ParksClientLobby, ParksMainPage } from './views/ParksViews';
import {
    ParksStartGame, ParksSetFirstGame, ParksSetNightfall, ParksSetWildlife, ParksRestartGame, ParksBackToLobby,
    ParksPickYear, ParksMoveToSite, ParksMoveToEnd, ParksTent, ParksRespond
} from './ParksMethods';
import { ParksGameState, RANGER } from './ParksGameState';

function rehydrateGS(raw: any): ParksGameState {
    return typeof raw.get_data === 'function' ? raw : ParksGameState.from_data(raw.data, raw.playerIds);
}

export const ParksRule: GameRuleInterface = {
    name: 'parks',
    hostAsPlayer: true,
    plugins: {
        'lobby': Lobby,
        'gameshell': Shell
    },
    globalData: {
        gameState: null,
        parks_firstGame: false,
        parks_nightfall: false,
        parks_wildlife: false
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
            return r && String(r).trim().length > 0 ? r : '#4c9a6e';
        };
        const resolveIcon = (id: string) => {
            const r = id === mp.hostId ? mp.getData('lobby_icon') : mp.getPlayerData(id, 'lobby_icon');
            return typeof r === 'number' ? r : 0;
        };
        const playerNames: Record<string, string> = { [RANGER]: 'The Rangers' };
        const playerAccents: Record<string, string> = { [RANGER]: '#2c5a44' };
        const playerIcons: Record<string, number> = {};
        order.forEach((id, idx) => { playerNames[id] = resolveName(id, idx); playerAccents[id] = resolveAccent(id); playerIcons[id] = resolveIcon(id); });

        const lastMove = gs.get_last_move();

        const setProps = (clientId: string) => {
            mp.setViewProps(clientId, 'game', gs.view_for(clientId));
            mp.setViewProps(clientId, 'playerNames', playerNames);
            mp.setViewProps(clientId, 'playerAccents', playerAccents);
            mp.setViewProps(clientId, 'playerIcons', playerIcons);
            mp.setViewProps(clientId, 'isHost', clientId === mp.hostId);

            if (lastMove && lastMove.playerId && lastMove.playerId !== clientId) {
                mp.setViewProps(clientId, 'toastNotification', {
                    id: lastMove.moveId,
                    message: `${playerNames[lastMove.playerId] || 'Player'} ${lastMove.text}`,
                    bgColor: playerAccents[lastMove.playerId] || '#4c9a6e',
                    duration: 2400
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
        'startGame': ParksStartGame,
        'setFirstGame': ParksSetFirstGame,
        'setNightfall': ParksSetNightfall,
        'setWildlife': ParksSetWildlife,
        'restartGame': ParksRestartGame,
        'backToLobby': ParksBackToLobby,
        'pickYear': ParksPickYear,
        'moveToSite': ParksMoveToSite,
        'moveToEnd': ParksMoveToEnd,
        'useTent': ParksTent,
        'respond': ParksRespond
    },

    views: {
        'host-lobby': ParksHostLobby,
        'client-lobby': ParksClientLobby,
        'mainpage': ParksMainPage
    }
};

export default ParksRule;
