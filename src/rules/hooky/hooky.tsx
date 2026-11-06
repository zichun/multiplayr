/**
 * hooky.tsx — main Hooky rule definition.
 *
 * Composes the lobby + gameshell plugins and, on each host tick, rehydrates the
 * engine and distributes view props. Secrets: hands, the Hooky cards, hidden
 * Playground cards, peeks and guesses never reach another client until Done.
 */

import Lobby from '../lobby/lobby';
import Shell from '../gameshell/gameshell';
import './hooky.scss';

import { GameRuleInterface, MPType } from '../../common/interfaces';

import { HKHostLobby, HKClientLobby, HKMainPage } from './views/HookyViews';
import {
    HKStartGame, HKRestartGame, HKBackToLobby, HKGiveClue, HKAsk, HKReveal, HKEndTurn, HKGuessHooky, HKSubmitFinal,
    rehydrate, collectPlayers
} from './HookyMethods';
import { Phase } from './HookyGameState';
import { HKPublic, HKPrivate, HKPlayer, HKLobbyInfo } from './HookyTypes';

function identity(mp: MPType, id: string, idx: number) {
    const read = (key: string) => id === mp.hostId ? mp.getData(key) : mp.getPlayerData(id, key);
    const name = read('lobby_name');
    const accent = read('lobby_accent');
    const icon = read('lobby_icon');
    return {
        id,
        name: name && String(name).trim() ? String(name) : `Player ${idx + 1}`,
        accent: accent && String(accent).trim() ? String(accent) : '#7c8aa5',
        icon: typeof icon === 'number' ? icon : 0
    };
}

export const HookyRule: GameRuleInterface = {
    name: 'hooky',
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
        const showLobby = () => {
            const info: HKLobbyInfo = { players: collectPlayers(mp).map((id, i) => identity(mp, id, i)) };
            mp.setViewProps(mp.hostId, 'hkLobby', info);
            mp.playersForEach((clientId) => mp.setViewProps(clientId, 'hkLobby', info));
            mp.setView(mp.hostId, 'host-lobby');
            mp.playersForEach((clientId) => mp.setView(clientId, 'client-lobby'));
            return true;
        };
        if (!mp.getData('lobby_started')) return showLobby();
        const raw = mp.getData('gameState');
        if (!raw) return showLobby();
        const gs = rehydrate(raw);
        if (typeof (raw as any).get_data !== 'function') mp.setData('gameState', gs);
        const d = gs.get_data();
        if (!d || !d.order) return showLobby();

        const seat = gs.get_player_order();
        const done = d.phase === Phase.Done;
        const players: HKPlayer[] = d.order.map(id => ({
            ...identity(mp, id, seat.indexOf(id)),
            revealed: [...d.revealed[id]],
            hiddenCount: gs.hidden(id).length
        }));

        const pub: HKPublic = {
            gameId: d.gameId,
            phase: d.phase,
            round: d.round,
            setup: d.setup,
            players,
            activeId: gs.activeId(),
            // copies: the host's own client would otherwise share (and diff) the engine's live arrays
            turn: { ...d.turn },
            log: [...d.log],
            playground: gs.playgroundShown(),
            playgroundHidden: d.playground.length - d.pgShown,
            lockedIn: d.phase === Phase.Guess ? gs.lockedIn() : [],
            finalSubmitted: gs.finalSubmitted(),
            hooky: done ? d.hooky : null,
            hands: done ? d.hands : null,
            results: done ? d.results : null,
            hookyGuesses: done ? d.hookyGuesses : null
        };

        const nameOf = (id: string | null) => (players.find(p => p.id === id) || { name: 'Someone' }).name;
        const last = d.log[d.log.length - 1];

        const setProps = (clientId: string) => {
            const isPlayer = d.order.indexOf(clientId) !== -1;
            const usedKeys: Record<string, string[]> = {};
            d.order.forEach(t => { usedKeys[t] = Array.from(gs.usedKeys(t)); });
            const my: HKPrivate = {
                me: clientId,
                isHost: clientId === mp.hostId,
                isPlayer,
                hand: isPlayer ? [...d.hands[clientId]] : [],
                peeks: isPlayer ? [...d.peeks[clientId]] : [],
                myGuesses: isPlayer ? { ...d.hookyGuesses[clientId] } : {},
                myFinal: isPlayer ? (d.finalGuesses[clientId] || null) : null,
                canReveal: isPlayer && gs.canReveal(clientId),
                peekTargets: isPlayer ? gs.peekTargets(clientId) : [],
                usedKeys
            };
            mp.setViewProps(clientId, 'hk', pub);
            mp.setViewProps(clientId, 'my', my);
            if (last && last.kind === 'ask' && last.by !== clientId) {
                const by = players.find(p => p.id === last.by);
                mp.setViewProps(clientId, 'toastNotification', {
                    id: last.id,
                    message: `${nameOf(last.by)} asked ${last.target === clientId ? 'you' : nameOf(last.target)}: ${last.word} → ${last.count}`,
                    bgColor: by ? by.accent : '#7c8aa5',
                    duration: 2600
                });
            }
        };
        d.order.forEach(setProps);
        if (d.order.indexOf(mp.hostId) === -1) setProps(mp.hostId);

        mp.setView(mp.hostId, 'mainpage');
        mp.playersForEach((clientId) => mp.setView(clientId, 'mainpage'));
        return true;
    },

    methods: {
        'startGame': HKStartGame,
        'restartGame': HKRestartGame,
        'backToLobby': HKBackToLobby,
        'giveClue': HKGiveClue,
        'ask': HKAsk,
        'reveal': HKReveal,
        'endTurn': HKEndTurn,
        'guessHooky': HKGuessHooky,
        'submitFinal': HKSubmitFinal
    },

    views: {
        'host-lobby': HKHostLobby,
        'client-lobby': HKClientLobby,
        'mainpage': HKMainPage
    }
};

export default HookyRule;
