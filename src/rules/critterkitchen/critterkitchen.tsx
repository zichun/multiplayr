/**
 * critterkitchen.tsx — main Critter Kitchen rule definition.
 *
 * Composes the lobby + gameshell plugins and, on each host tick, rehydrates the
 * engine and distributes view props. Secrets: each player's storage (behind the
 * restaurant shield), their plan until everyone has locked in, and the text of
 * rumor cards (only shown to players who know them) never reach other clients.
 */

import Lobby from '../lobby/lobby';
import Shell from '../gameshell/gameshell';
import './critterkitchen.scss';

import { GameRuleInterface, MPType } from '../../common/interfaces';

import { CKHostLobby, CKClientLobby, CKMainPage } from './views/CKViews';
import {
    CKStartGame, CKRestartGame, CKBackToLobby, CKSetOption, CKChooseRestaurateur, CKSubmitPlan, CKUnsubmit, CKPick,
    CKLeaveEarly, CKTakeStar, CKSubmitChallenges, CKSubmitFridge, CKSubmitCritic, CKAutoAct, rehydrate,
    collectPlayers, readOptions
} from './CKMethods';
import { Phase } from './CKGameState';
import { CKPublic, CKPrivate, CKPlayerPub } from './CKTypes';
import { SOUP_PICK } from './CKData';

function identity(mp: MPType, id: string, idx: number) {
    const read = (key: string) => id === mp.hostId ? mp.getData(key) : mp.getPlayerData(id, key);
    const name = read('lobby_name');
    const accent = read('lobby_accent');
    return {
        name: name && String(name).trim() ? String(name) : `Player ${idx + 1}`,
        accent: accent && String(accent).trim() ? String(accent) : '#ef7a54'
    };
}

function clone<T>(x: T): T { return JSON.parse(JSON.stringify(x)); }

export const CritterKitchenRule: GameRuleInterface = {
    name: 'critterkitchen',
    hostAsPlayer: true,
    plugins: {
        'lobby': Lobby,
        'gameshell': Shell
    },
    globalData: {
        gameState: null,
        ck_options: null
    },
    playerData: {},

    onDataChange: (mp: MPType) => {
        const showLobby = () => {
            const players = collectPlayers(mp).map((id, i) => ({ id, ...identity(mp, id, i) }));
            const opts = readOptions(mp);
            mp.setViewProps(mp.hostId, 'ckLobby', { players, options: opts });
            mp.playersForEach((clientId) => mp.setViewProps(clientId, 'ckLobby', { players, options: opts }));
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
        if (!d || !d.players) return showLobby();

        const order = gs.playerIdsList;
        const over = d.phase === Phase.GameOver;
        const players: Record<string, CKPlayerPub> = {};
        order.forEach((id, i) => {
            const p = d.players[id];
            players[id] = {
                id, ...identity(mp, id, i),
                stars: p.stars, starLog: clone(p.starLog), rest: p.rest, zous: [...p.zous], zousNext: [...p.zousNext],
                known: [...p.known], rumorTokens: p.rumorTokens, storageCount: p.storage.length, ready: p.ready,
                challengeResults: clone(p.challengeResults),
                ...(over ? { storage: clone(p.storage), criticPlate: clone(p.criticPlate) } : {})
            };
        });

        const shop = d.shop;
        const resolved = shop ? d.locations.slice(0, Math.max(0, shop.locIdx)) : [];
        const picked: Record<string, number> = {};
        if (shop) shop.runs.forEach(r => { picked[`${r.key}@${r.pid}`] = r.pickCount; });

        const pub: CKPublic = {
            phase: d.phase,
            round: d.round,
            day: gs.day(),
            options: { ...d.options },
            critic: d.critic,
            challenges: d.challenges.map((id, i) => {
                const revealed = i < Math.min(6, d.round) || over;
                return { id: revealed ? id : null, held: i === 2 || i === 5, revealed };
            }),
            hippo: d.hippoChallenge,
            revealed: [...d.revealed],
            rumorFaces: d.rumorCards.map((r, i) => d.revealed[i] ? r : null),
            locations: [...d.locations],
            locItems: clone(d.locItems),
            priority: [...d.priority],
            order: [...order],
            players,
            placements: d.phase === Phase.Shopping ? clone(d.placements) : {},
            shopLoc: shop && shop.locIdx >= 0 && shop.locIdx < d.locations.length ? d.locations[shop.locIdx] : null,
            resolved,
            pending: shop && shop.pending ? {
                pid: shop.pending.pid, key: shop.pending.key, loc: shop.pending.loc,
                kind: shop.pending.kind, picksLeft: shop.pending.picksLeft
            } : null,
            picked,
            offered: clone(d.offered),
            waitingOn: gs.waitingOn(),
            fridgeLimit: gs.fridgeLimit(),
            log: clone(d.log),
            final: d.final ? clone(d.final) : null,
            winners: [...d.winners],
            allRumors: over ? gs.all_rumors() : null
        };

        const nameOf = (id?: string) => (id && players[id] ? players[id].name : 'Someone');
        const last = d.log[d.log.length - 1];

        const setProps = (clientId: string) => {
            const isPlayer = order.indexOf(clientId) !== -1;
            const p = isPlayer ? d.players[clientId] : null;
            const pend = shop && shop.pending && shop.pending.pid === clientId ? shop.pending : null;
            let options: number[] = [];
            if (pend) options = pend.kind === 'penny' ? gs.optionsFor(clientId, 'soup') : gs.optionsFor(clientId, pend.loc);
            const me: CKPrivate = {
                me: clientId,
                isHost: clientId === mp.hostId,
                isPlayer,
                storage: p ? clone(p.storage) : [],
                criticPool: p ? clone(gs.criticPool(clientId)) : [],
                plan: p && p.plan ? { ...p.plan } : null,
                restOptions: p ? [...p.restOptions] : [],
                rumorTexts: p ? d.rumorCards.map((r, i) => (p.known[i] || d.revealed[i]) ? r : null) : [null, null, null],
                jamie: p ? (d.jamieRumor[clientId] || null) : null,
                options,
                canLeave: !!(pend && pend.canLeave),
                canStar: !!(pend && pend.canStar),
                challengePlates: p && p.challengePlates ? clone(p.challengePlates) : null,
                criticPlate: p && p.criticPlate ? clone(p.criticPlate) : null,
                fridgeDiscard: p && p.fridgeDiscard ? [...p.fridgeDiscard] : null,
                overLimit: p && d.phase === Phase.Fridge ? gs.overLimit(clientId) : 0,
                ctx: p ? gs.mealCtx(clientId) : null,
                chefKeys: p ? gs.chefKeysFor(clientId) : []
            };
            mp.setViewProps(clientId, 'ck', pub);
            mp.setViewProps(clientId, 'me', me);
            if (last && last.pid && last.pid !== clientId && (last.kind === 'pick' || last.kind === 'star')) {
                mp.setViewProps(clientId, 'toastNotification', {
                    id: last.id,
                    message: `${nameOf(last.pid)} ${last.text}`,
                    bgColor: players[last.pid] ? players[last.pid].accent : '#ef7a54',
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
        'startGame': CKStartGame,
        'restartGame': CKRestartGame,
        'backToLobby': CKBackToLobby,
        'setOption': CKSetOption,
        'chooseRestaurateur': CKChooseRestaurateur,
        'submitPlan': CKSubmitPlan,
        'unsubmit': CKUnsubmit,
        'pick': CKPick,
        'leaveEarly': CKLeaveEarly,
        'takeStar': CKTakeStar,
        'submitChallenges': CKSubmitChallenges,
        'submitFridge': CKSubmitFridge,
        'submitCritic': CKSubmitCritic,
        'autoAct': CKAutoAct
    },

    views: {
        'host-lobby': CKHostLobby,
        'client-lobby': CKClientLobby,
        'mainpage': CKMainPage
    }
};

export { SOUP_PICK };
export default CritterKitchenRule;
