/**
 * quacks.tsx — main Quacks of Quedlinburg rule definition.
 *
 * Composes the lobby + gameshell plugins and, on each host tick, rehydrates the
 * pure engine and distributes view props. Pots, scores and rubies are public;
 * so is what is still in each bag (as counts, never draw order), and a player's
 * pending decision (which may show chips drawn out of their bag) is framed
 * per-client.
 */

import Lobby from '../lobby/lobby';
import Shell from '../gameshell/gameshell';
import './quacks.scss';

import { GameRuleInterface, MPType } from '../../common/interfaces';

import { QuacksHostLobby, QuacksClientLobby, QuacksMainPage } from './views/QuacksViews';
import {
    QuacksStartGame, QuacksSetOption, QuacksRestartGame, QuacksBackToLobby,
    QuacksDraw, QuacksStop, QuacksUseFlask, QuacksChoose, QuacksBuy, QuacksSpendRubies, QuacksReady,
    QuacksLayReserve, QuacksUseWitch, QuacksLayHand, QuacksForget, QuacksNeighbourBomb
} from './QuacksMethods';
import { QuacksGameState, Phase } from './QuacksGameState';
import { normalizeBookSets } from './QuacksData';

function bagCounts(bag: string[]): Record<string, number> {
    const out: Record<string, number> = {};
    bag.forEach((c) => { out[c] = (out[c] || 0) + 1; });
    return out;
}

function rehydrateGS(raw: any): QuacksGameState {
    return typeof raw.get_data === 'function' ? raw : QuacksGameState.from_data(raw.data, raw.playerIds);
}

export const QuacksRule: GameRuleInterface = {
    name: 'quacks',
    hostAsPlayer: true,
    plugins: {
        'lobby': Lobby,
        'gameshell': Shell
    },
    globalData: {
        gameState: null,
        quacks_books: null,      // per-colour set choice; null = all set 1
        quacks_stir: false,
        quacks_herb: false,      // Herb Witches expansion
        quacks_alch: false       // The Alchemists expansion
    },
    playerData: {},

    onDataChange: (mp: MPType) => {
        const started = mp.getData('lobby_started');

        // The setup lives in host-only data, so push it to every lobby view:
        // clients see the chosen books too, they just cannot change them.
        const showLobby = () => {
            let players = 1;
            mp.playersForEach(() => { players += 1; });
            const setup = (clientId: string) => {
                const herb = mp.getData('quacks_herb') === true;
                const alch = mp.getData('quacks_alch') === true;
                mp.setViewProps(clientId, 'lobbyHerb', herb);
                mp.setViewProps(clientId, 'lobbyAlch', alch);
                mp.setViewProps(clientId, 'lobbyBooks', normalizeBookSets(mp.getData('quacks_books'), 1, herb, alch));
                mp.setViewProps(clientId, 'lobbyStir', mp.getData('quacks_stir') === true);
                mp.setViewProps(clientId, 'lobbyPlayers', players);
            };
            setup(mp.hostId);
            mp.setView(mp.hostId, 'host-lobby');
            mp.playersForEach((clientId) => { setup(clientId); mp.setView(clientId, 'client-lobby'); });
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
            return r && String(r).trim().length > 0 ? r : '#8a63d2';
        };
        const resolveIcon = (id: string) => {
            const r = id === mp.hostId ? mp.getData('lobby_icon') : mp.getPlayerData(id, 'lobby_icon');
            return typeof r === 'number' ? r : 0;
        };
        const playerNames: Record<string, string> = {};
        const playerAccents: Record<string, string> = {};
        const playerIcons: Record<string, number> = {};
        order.forEach((id, idx) => {
            playerNames[id] = resolveName(id, idx);
            playerAccents[id] = resolveAccent(id);
            playerIcons[id] = resolveIcon(id);
        });

        const phase = gs.get_phase();

        // Public per-player snapshot. The bag goes out as chip counts only, so
        // nobody can read the order chips will come out in.
        const publicPlayers: Record<string, any> = {};
        order.forEach((id) => {
            const p = gs.get_player(id)!;
            const field = gs.scoring_field(id);
            publicPlayers[id] = {
                vp: p.vp, rubies: p.rubies, droplet: p.droplet, flaskFull: p.flaskFull,
                bagCount: p.bag.length, bag: bagCounts(p.bag), pot: p.pot.map(c => ({ ...c })), aside: [...p.aside],
                ratTails: p.ratTails, origin: phase === Phase.Fortune ? p.droplet + p.ratTails : p.origin,
                stopped: p.stopped, exploded: p.exploded, potFull: p.potFull, shielded: p.shielded,
                shieldLeft: gs.shield_left(id),
                whiteSum: gs.white_sum(id), threshold: gs.threshold(id),
                field: { ...field },
                stage: p.stage, coins: p.coins, rolled: [...p.rolled], notes: [...p.notes],
                deciding: p.prompts.length > 0, intentSet: p.intent !== null,
                needsAction: gs.needs_action(id),
                // Herb Witches
                overflow: [...p.overflow], reserve: [...p.reserve], carry: p.carry,
                pennies: { ...p.pennies }, saved: p.saved, cheap: p.cheap,
                extraShops: p.extraShops.length,
                // The Alchemists
                patient: p.patient, essence: p.essence, essenceReach: p.essenceReach,
                extraRats: p.extraRats, pendingDraw: p.pendingDraw, hand: [...p.hand],
                essenceNow: gs.alchemists() ? gs.essence_reach(id) : 0
            };
        });

        const lastMove = gs.get_last_move();

        const setProps = (clientId: string) => {
            mp.setViewProps(clientId, 'phase', phase);
            mp.setViewProps(clientId, 'round', gs.get_round());
            mp.setViewProps(clientId, 'bookSets', gs.get_book_sets());
            mp.setViewProps(clientId, 'expansion', gs.expansion());
            mp.setViewProps(clientId, 'witchIds', gs.witches().map(w => w.id));
            mp.setViewProps(clientId, 'guestWitch', gs.guest_witch() ? gs.guest_witch()!.id : null);
            mp.setViewProps(clientId, 'alch', gs.alchemists());
            mp.setViewProps(clientId, 'patientIds', gs.patients().map(x => x.id));
            mp.setViewProps(clientId, 'lockstep', gs.lockstep());
            mp.setViewProps(clientId, 'playerOrder', order);
            mp.setViewProps(clientId, 'turnOrder', gs.turn_order());
            mp.setViewProps(clientId, 'playerNames', playerNames);
            mp.setViewProps(clientId, 'playerAccents', playerAccents);
            mp.setViewProps(clientId, 'playerIcons', playerIcons);
            mp.setViewProps(clientId, 'publicPlayers', publicPlayers);
            mp.setViewProps(clientId, 'fortune', gs.get_fortune());
            mp.setViewProps(clientId, 'fortuneNotes', gs.get_fortune_notes());
            mp.setViewProps(clientId, 'revealed', gs.revealed());
            mp.setViewProps(clientId, 'offers', gs.shop_offers());
            mp.setViewProps(clientId, 'maxBuy', gs.max_buy());
            mp.setViewProps(clientId, 'winnerIds', gs.get_winners());
            mp.setViewProps(clientId, 'isHost', clientId === mp.hostId);

            const me = gs.get_player(clientId);
            mp.setViewProps(clientId, 'myPrompt', me && me.prompts.length ? me.prompts[0] : null);
            mp.setViewProps(clientId, 'myIntent', me ? me.intent : null);
            mp.setViewProps(clientId, 'myCanFlask', !!me && me.canFlask && me.flaskFull && !me.stopped);
            const usable: Record<string, boolean> = {};
            if (me) gs.witches().forEach(w => { usable[w.metal] = gs.witch_usable(clientId, w.metal); });
            if (me && gs.guest_witch()) usable.guest = gs.witch_usable(clientId, 'guest');
            mp.setViewProps(clientId, 'myForget', me ? gs.can_forget(clientId) : []);
            mp.setViewProps(clientId, 'myWitchUsable', usable);
            mp.setViewProps(clientId, 'myRubyCost', me
                ? { droplet: gs.ruby_cost(clientId, 'droplet'), flask: gs.ruby_cost(clientId, 'flask') }
                : { droplet: 2, flask: 2 });
            // The full collection is only shown once the round is over and every
            // chip is on its way back to the bag anyway.
            mp.setViewProps(clientId, 'myCollection',
                me && (phase === Phase.Eval || phase === Phase.Done) ? gs.collection(clientId) : null);

            if (lastMove && lastMove.playerId !== clientId) {
                mp.setViewProps(clientId, 'toastNotification', {
                    id: lastMove.moveId,
                    message: lastMove.playerId
                        ? `${playerNames[lastMove.playerId] || 'A player'} ${lastMove.text}`
                        : lastMove.text,
                    bgColor: lastMove.playerId ? playerAccents[lastMove.playerId] : '#8a63d2',
                    duration: 2600
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
        'startGame': QuacksStartGame,
        'setOption': QuacksSetOption,
        'restartGame': QuacksRestartGame,
        'backToLobby': QuacksBackToLobby,
        'drawChip': QuacksDraw,
        'stopBrewing': QuacksStop,
        'useFlask': QuacksUseFlask,
        'choose': QuacksChoose,
        'buyChips': QuacksBuy,
        'spendRubies': QuacksSpendRubies,
        'ready': QuacksReady,
        'layReserve': QuacksLayReserve,
        'useWitch': QuacksUseWitch,
        'layHand': QuacksLayHand,
        'forget': QuacksForget,
        'neighbourBomb': QuacksNeighbourBomb
    },

    views: {
        'host-lobby': QuacksHostLobby,
        'client-lobby': QuacksClientLobby,
        'mainpage': QuacksMainPage
    }
};

export default QuacksRule;
