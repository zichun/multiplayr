/**
 * decorum.tsx — main Décorum rule definition.
 *
 * Composes the lobby + gameshell plugins and, on each host tick, rehydrates the
 * engine and distributes view props. Secrets: each player's conditions (and the
 * generator's solution house) never reach another client until the game ends,
 * except conditions deliberately shared at a meeting — and only to the recipient.
 */

import Lobby from '../lobby/lobby';
import Shell from '../gameshell/gameshell';
import './decorum.scss';

import { GameRuleInterface, MPType } from '../../common/interfaces';

import { DCHostLobby, DCClientLobby, DCMainPage } from './views/DecorumViews';
import {
    DCStartGame, DCRestartGame, DCReplayScenario, DCBackToLobby, DCSetOption, DCAct, DCSwitch, DCPass, DCReact, DCVoteEarly,
    DCShare, DCMood, rehydrate, collectPlayers, readOptions
} from './DecorumMethods';
import { Phase } from './DecorumGameState';
import { DCPublic, DCPrivate, DCPlayer, DCLobbyInfo } from './DecorumTypes';
import { segmentsFor, heartsFor, describeSwitch } from './DecorumData';

function identity(mp: MPType, id: string, idx: number) {
    const read = (key: string) => id === mp.hostId ? mp.getData(key) : mp.getPlayerData(id, key);
    const name = read('lobby_name');
    const accent = read('lobby_accent');
    const icon = read('lobby_icon');
    return {
        id,
        name: name && String(name).trim() ? String(name) : `Player ${idx + 1}`,
        accent: accent && String(accent).trim() ? String(accent) : '#8f8aa6',
        icon: typeof icon === 'number' ? icon : 0
    };
}

function clone<T>(x: T): T { return JSON.parse(JSON.stringify(x)); }

export const DecorumRule: GameRuleInterface = {
    name: 'decorum',
    hostAsPlayer: true,
    plugins: {
        'lobby': Lobby,
        'gameshell': Shell
    },
    globalData: {
        gameState: null,
        dc_options: null
    },
    playerData: {},

    onDataChange: (mp: MPType) => {
        const showLobby = () => {
            const opts = readOptions(mp);
            const info: DCLobbyInfo = { players: collectPlayers(mp).map((id, i) => identity(mp, id, i)), level: opts.level, code: opts.code, twists: opts.twists };
            mp.setViewProps(mp.hostId, 'dcLobby', info);
            mp.playersForEach((clientId) => mp.setViewProps(clientId, 'dcLobby', info));
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

        const done = d.phase === Phase.Done;
        const players: DCPlayer[] = d.order.map((id, seat) => ({
            ...identity(mp, id, seat),
            seat,
            declared: !!d.declared[id],
            conditions: d.cards[id].length,
            votedEarly: d.earlyVotes.indexOf(id) !== -1,
            meetingDone: d.phase === Phase.Meeting ? gs.meetingDone(id) : false
        }));
        const m = d.meeting;

        // copies throughout: the host's own client would otherwise share (and diff) the engine's live objects
        const pub: DCPublic = {
            gameId: d.gameId,
            phase: d.phase,
            title: d.scenario.title,
            code: d.scenario.code,
            level: d.scenario.level,
            players,
            board: gs.board(),
            house: clone(d.house),
            beds: d.beds ? [...d.beds] : null,
            twists: clone(gs.twists()),
            memo: gs.memo(),
            activeId: gs.activeId(),
            segment: d.segment,
            round: d.round,
            segments: segmentsFor(d.order.length),
            hearts: d.hearts,
            totalHearts: heartsFor(d.order.length),
            log: clone(d.log),
            meeting: m ? {
                idx: m.idx, kind: m.kind, early: m.early,
                moods: d.order.filter(id => m.moods[id]).map(id => ({ by: id, mood: m.moods[id]!.mood, target: m.moods[id]!.target })),
                shares: d.order.filter(id => m.shares[id]).map(id => ({ from: id, to: m.shares[id]!.to }))
            } : null,
            canCallEarly: gs.canCallEarly(),
            result: done ? clone(d.result) : null,
            cards: done ? clone(d.cards) : null,
            solution: done ? clone(d.scenario.solution) : null,
            solutionBeds: done && d.scenario.solutionBeds ? [...d.scenario.solutionBeds] : null
        };

        const nameOf = (id: string | null) => (players.find(p => p.id === id) || { name: 'Someone' }).name;
        const last = d.log[d.log.length - 1];
        /** What happened, with real names (the engine only knows seats). */
        const lastText = (forId: string) => {
            if (!last) return '';
            if (last.kind === 'switch' && last.sw && last.bedsBefore) {
                const seatName = (seat: number) => d.order[seat] === forId ? 'you' : nameOf(d.order[seat]);
                return describeSwitch(last.bedsBefore, last.sw, seatName, gs.board());
            }
            return last.text;
        };

        const whisper = !!gs.twists().whisper && !done;
        const setProps = (clientId: string) => {
            const isPlayer = d.order.indexOf(clientId) !== -1;
            const my: DCPrivate = {
                me: clientId,
                isHost: clientId === mp.hostId,
                isPlayer,
                card: isPlayer ? clone(d.cards[clientId]) : [],
                known: gs.sharedWith(clientId).map(s => ({ from: s.from, idx: s.cond, cond: clone(d.cards[s.from][s.cond]), meeting: s.meeting })),
                given: gs.sharedBy(clientId).map(s => ({ to: s.to, idx: s.cond, meeting: s.meeting })),
                owesReaction: isPlayer && gs.owesReaction(clientId),
                canReact: isPlayer && gs.canReact(clientId),
                canPass: isPlayer && d.phase === Phase.Play && gs.activeId() === clientId && gs.isFulfilled(clientId),
                shareOptions: isPlayer && m ? gs.shareOptions(clientId) : [],
                myMeeting: isPlayer && m ? {
                    share: m.shares[clientId] ? { ...m.shares[clientId]! } : null,
                    mood: m.moods[clientId] ? m.moods[clientId]!.mood : null,
                    skipped: m.skipped.indexOf(clientId) !== -1
                } : null
            };
            // whispers: reactions only reach the player who made the change (and the reactor)
            const view = whisper ? { ...pub, log: pub.log.map(e => e.by === clientId ? e : { ...e, reactions: e.reactions[clientId] ? { [clientId]: e.reactions[clientId] } : {} }) } : pub;
            mp.setViewProps(clientId, 'dc', view);
            mp.setViewProps(clientId, 'my', my);
            if (last && (last.kind === 'move' || last.kind === 'switch' || last.kind === 'pass') && last.by !== clientId) {
                const by = players.find(p => p.id === last.by);
                mp.setViewProps(clientId, 'toastNotification', {
                    id: last.id,
                    message: `${nameOf(last.by)} ${lastText(clientId)}`,
                    bgColor: by ? by.accent : '#8f8aa6',
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
        'startGame': DCStartGame,
        'restartGame': DCRestartGame,
        'replayScenario': DCReplayScenario,
        'backToLobby': DCBackToLobby,
        'setOption': DCSetOption,
        'act': DCAct,
        'switchRooms': DCSwitch,
        'pass': DCPass,
        'react': DCReact,
        'voteEarly': DCVoteEarly,
        'share': DCShare,
        'mood': DCMood
    },

    views: {
        'host-lobby': DCHostLobby,
        'client-lobby': DCClientLobby,
        'mainpage': DCMainPage
    }
};

export default DecorumRule;
