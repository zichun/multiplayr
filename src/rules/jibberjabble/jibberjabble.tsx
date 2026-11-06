/**
 * jibberjabble.tsx — main Jibber Jabble rule definition.
 *
 * Composes the lobby + gameshell plugins and, on each host tick, rehydrates the
 * engine and distributes view props. Each client's `jj` is built from their own
 * team's lane. Secrets: the word card and the word go to spellers only, and a
 * Guesser gets them once their team has guessed. In team mode the rival team's
 * clues and guesses stay hidden until your own team has finished guessing.
 */

import Lobby from '../lobby/lobby';
import Shell from '../gameshell/gameshell';
import './jibberjabble.scss';

import { GameRuleInterface, MPType } from '../../common/interfaces';

import { JJHostLobby, JJClientLobby, JJMainPage } from './views/JJViews';
import {
    JJStartGame, JJSetOption, JJRestartGame, JJBackToLobby, JJChooseTier, JJChooseWord, JJAddLetter,
    JJStopClue, JJSignal, JJSubmitGuess, JJAllowGuess, JJNextRound, JJUseHint, JJSetTeam, JJShuffleTeams,
    rehydrate, resolveTeams, collectPlayers
} from './JJMethods';
import { Phase } from './JJGameState';
import { TEAMS } from './JJData';
import { JJPublic, JJPrivate, JJPlayer, JJRival, JJTeamInfo, JJLobbyInfo } from './JJTypes';

function playerInfo(mp: MPType, ids: string[], teamOf: (id: string) => number | null): JJPlayer[] {
    const read = (id: string, key: string) => id === mp.hostId ? mp.getData(key) : mp.getPlayerData(id, key);
    return ids.map((id, idx) => {
        const name = read(id, 'lobby_name');
        const accent = read(id, 'lobby_accent');
        const icon = read(id, 'lobby_icon');
        return {
            id,
            name: name && String(name).trim() ? String(name) : `Player ${idx + 1}`,
            accent: accent && String(accent).trim() ? String(accent) : '#7c8aa5',
            icon: typeof icon === 'number' ? icon : 0,
            team: teamOf(id)
        };
    });
}

export const JibberJabbleRule: GameRuleInterface = {
    name: 'jibberjabble',
    hostAsPlayer: true,
    plugins: {
        'lobby': Lobby,
        'gameshell': Shell
    },
    globalData: {
        gameState: null,
        jj_rounds: 6,
        jj_clues: 3,
        jj_hints: true,
        jj_cards: 'fixed',
        jj_mode: 'coop',
        jj_teams: {}
    },
    playerData: {},

    onDataChange: (mp: MPType) => {
        const started = mp.getData('lobby_started');
        const showLobby = () => {
            const ids = collectPlayers(mp);
            const teams = resolveTeams(ids, mp.getData('jj_teams'));
            const info: JJLobbyInfo = {
                mode: mp.getData('jj_mode') === 'teams' ? 'teams' : 'coop',
                players: playerInfo(mp, ids, id => teams[0].indexOf(id) !== -1 ? 0 : 1),
                teams
            };
            mp.setViewProps(mp.hostId, 'jjLobby', info);
            mp.playersForEach((clientId) => mp.setViewProps(clientId, 'jjLobby', info));
            mp.setView(mp.hostId, 'host-lobby');
            mp.playersForEach((clientId) => mp.setView(clientId, 'client-lobby'));
            return true;
        };
        if (!started) return showLobby();

        const raw = mp.getData('gameState');
        if (!raw) return showLobby();
        const gs = rehydrate(raw);
        if (typeof (raw as any).get_data !== 'function') mp.setData('gameState', gs);

        const d = gs.get_data();
        if (!d || !d.lanes) return showLobby();     // a save from before team mode
        const order = gs.get_player_order();
        const players = playerInfo(mp, order, id => d.teamMode ? gs.laneOf(id) : null);
        const secret = gs.secretWord();
        const teams: JJTeamInfo[] | null = d.teamMode
            ? d.lanes.map((L, i) => ({ ...TEAMS[i], score: L.score, members: [...L.seats] }))
            : null;
        const choose = gs.choosePicker();
        const winner = gs.winner();

        const nameOf = (id: string) => (players.find(p => p.id === id) || { name: 'Someone' }).name;
        const accentOf = (id: string) => (players.find(p => p.id === id) || { accent: '#7c8aa5' }).accent;

        const setProps = (clientId: string) => {
            const li = Math.max(0, gs.laneOf(clientId));
            const L = gs.lane(li);
            const phase = gs.phase(li);
            const isGuesser = clientId === gs.guesserId(li);
            const myDone = phase === Phase.Watch || phase === Phase.Reveal || phase === Phase.Done;
            const canSee = !isGuesser || myDone;

            let rival: JJRival | null = null;
            if (d.teamMode) {
                const ri = 1 - li;
                const R = gs.lane(ri);
                rival = {
                    team: ri,
                    guesserId: gs.guesserId(ri),
                    spellerId: myDone ? gs.currentSpellerId(ri) : null,
                    status: gs.phase(ri),
                    clueCount: R.clues.length,
                    letterCount: R.clues.reduce((n, c) => n + c.letters.length, 0),
                    cluesTarget: R.cluesTarget,
                    visible: myDone,
                    clues: myDone ? R.clues : null,
                    guesses: myDone ? R.guesses : null,
                    guessesLeft: R.guessesLeft,
                    correct: myDone ? R.correct : null,
                    overruled: R.overruled
                };
            }
            // Finished rounds are public; the current round's records only once
            // this client's own team has guessed.
            const allHistory = d.lanes.flatMap(x => x.history)
                .filter(h => h.round < d.round || myDone)
                .sort((a, b) => a.round - b.round || a.team - b.team);

            const pub: JJPublic = {
                phase,
                round: d.round,
                rounds: d.rounds,
                score: L.score,
                cluesPerRound: d.cluesPerRound,
                players,
                guesserId: gs.guesserId(li),
                chooserId: gs.chooserId(li),
                spellerId: gs.currentSpellerId(li),
                lettersLeft: L.lettersLeft,
                cardId: d.cardId,
                wordIdx: d.wordIdx,
                clues: L.clues,
                cluesTarget: L.cluesTarget,
                guesses: L.guesses,
                guessesLeft: L.guessesLeft,
                correct: L.correct,
                overruled: L.overruled,
                wordLength: L.revealLength && secret ? secret.length : null,
                firstLetter: L.revealFirst && secret ? secret[0] : null,
                signals: L.signals,
                emotes: d.emotes,
                hintsEnabled: d.hintsEnabled,
                cardMode: d.cardMode === 'mixed' ? 'mixed' : 'fixed',
                hints: d.hints,
                history: L.history,
                tierCounts: gs.tierCountsSoFar(li),
                rank: gs.rank(li),
                challenges: gs.challenges(li),
                lastEvent: d.lastEvent,
                teamMode: d.teamMode,
                myTeam: d.teamMode ? li : null,
                teams,
                rival,
                choose,
                allHistory,
                winner
            };
            const my: JJPrivate = {
                me: clientId,
                isHost: clientId === mp.hostId,
                isGuesser,
                cardWords: canSee ? gs.currentCardWords() : null,
                secret: canSee ? secret : null,
                hintUsable: gs.hintUsable(clientId)
            };
            mp.setViewProps(clientId, 'jj', pub);
            mp.setViewProps(clientId, 'my', my);
            const ev = d.lastEvent;
            if (ev && ev.by !== clientId) {
                mp.setViewProps(clientId, 'toastNotification', {
                    id: ev.id,
                    message: `${nameOf(ev.by)} ${ev.text}`,
                    bgColor: accentOf(ev.by),
                    duration: 2400
                });
            }
        };

        order.forEach(setProps);
        if (order.indexOf(mp.hostId) === -1) setProps(mp.hostId);

        mp.setView(mp.hostId, 'mainpage');
        mp.playersForEach((clientId) => mp.setView(clientId, 'mainpage'));
        return true;
    },

    methods: {
        'startGame': JJStartGame,
        'setOption': JJSetOption,
        'setTeam': JJSetTeam,
        'shuffleTeams': JJShuffleTeams,
        'restartGame': JJRestartGame,
        'backToLobby': JJBackToLobby,
        'chooseTier': JJChooseTier,
        'chooseWord': JJChooseWord,
        'addLetter': JJAddLetter,
        'stopClue': JJStopClue,
        'signal': JJSignal,
        'submitGuess': JJSubmitGuess,
        'allowGuess': JJAllowGuess,
        'nextRound': JJNextRound,
        'useHint': JJUseHint
    },

    views: {
        'host-lobby': JJHostLobby,
        'client-lobby': JJClientLobby,
        'mainpage': JJMainPage
    }
};

export default JibberJabbleRule;
