/**
 * test_faraway.ts — Faraway tests.
 *   Type A: the card tables + the pure FarawayGameState engine.
 *   Type B: end-to-end via GameRuleTest (remote methods + tick distribution).
 */

import { describe, it } from 'mocha';
import { strict as assert } from 'assert';

import { FarawayGameState, Phase, GameStateData } from '../../rules/faraway/FarawayGameState';
import {
    REGION_CARDS, REGION_BY_ID, SANCTUARY_CARDS, SANCTUARY_BY_ID,
    COLOURS, RESOURCES, ROUNDS, HAND_SIZE,
    prereqMet, evalQuest, ScorableCard, Colour, Resource
} from '../../rules/faraway/FarawayData';
import {
    FARAWAY_ICONS, getRegionCardDefinition, getSanctuaryCardDefinition, questIconId
} from '../../rules/faraway/FarawayAssets';
import { GameRuleTest } from '../GameRuleTest';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function freshGame(ids: string[] = ['a', 'b'], seed = 7, advanced = false): FarawayGameState {
    const gs = new FarawayGameState(ids);
    gs.start_game({ seed, advanced });
    return gs;
}

/** Force a controlled play area straight onto the raw state. */
function setArea(gs: FarawayGameState, id: string, tableau: number[], sanctuaries: string[] = []): void {
    const d = gs.get_data();
    d.players[id].tableau = [...tableau];
    d.players[id].sanctuaries = [...sanctuaries];
}

const scorable = (colour: Colour | null, night: boolean, clues: number, resources: Resource[]): ScorableCard =>
    ({ colour, night, clues, resources });

/** Drive a whole round: everybody commits their lowest card, then resolves. */
function playRound(gs: FarawayGameState): void {
    const order = gs.get_player_order();
    for (const id of order) {
        const hand = gs.get_player(id)!.hand;
        gs.commit(id, hand[0]);
    }
    let guard = 0;
    while (gs.get_phase() === Phase.EndExploration && guard++ < 50) {
        const cur = gs.currentPlayerId();
        if (!cur) break;
        const owed = gs.pendingActions(cur);
        // sanctuary first, then the market pick
        if (owed.sanctuary) gs.keep_sanctuary(cur, gs.get_player(cur)!.pendingSanctuaries[0]);
        else if (owed.market) gs.take_market(cur, 0);
        else break;
    }
}

describe('Faraway', () => {

    // ======================================================================
    describe('Type A: card data', () => {
        it('has 68 unique numbered regions with the printed distributions', () => {
            assert.equal(REGION_CARDS.length, 68);
            const ids = REGION_CARDS.map(c => c.id).sort((a, b) => a - b);
            assert.deepEqual(ids, Array.from({ length: 68 }, (_, i) => i + 1));

            for (const c of COLOURS) {
                assert.equal(REGION_CARDS.filter(r => r.colour === c).length, 17, `${c} region count`);
            }
            assert.equal(REGION_CARDS.filter(r => r.night).length, 21, 'night regions');
            assert.equal(REGION_CARDS.reduce((n, r) => n + r.clues, 0), 18, 'clues');
            assert.equal(REGION_CARDS.filter(r => r.quest).length, 61, 'regions with a quest');
        });

        it('night is exactly regions 20–40', () => {
            for (const r of REGION_CARDS) {
                assert.equal(r.night, r.id >= 20 && r.id <= 40, `region ${r.id} night flag`);
            }
        });

        it('has the printed wonder distribution 17 / 13 / 10', () => {
            const count = (res: Resource) =>
                REGION_CARDS.reduce((n, r) => n + r.resources.filter(x => x === res).length, 0);
            assert.equal(count('UDDU'), 17);
            assert.equal(count('OKIKO'), 13);
            assert.equal(count('GOLDLOG'), 10);
        });

        it('has 45 sanctuaries: 25 colourless + 5 of each colour', () => {
            assert.equal(SANCTUARY_CARDS.length, 45);
            assert.equal(SANCTUARY_CARDS.filter(s => s.colour === null).length, 25);
            for (const c of COLOURS) {
                assert.equal(SANCTUARY_CARDS.filter(s => s.colour === c).length, 5, `${c} sanctuaries`);
            }
            assert.equal(SANCTUARY_CARDS.filter(s => s.night).length, 4);
            assert.equal(SANCTUARY_CARDS.reduce((n, s) => n + s.clues, 0), 8);
            assert.equal(SANCTUARY_CARDS.filter(s => s.quest).length, 26);
            assert.equal(SANCTUARY_CARDS.filter(s => (s as any).prerequisite).length, 0);
        });

        it('every quest icon resolves to a real glyph', () => {
            const all = [
                ...REGION_CARDS.map(c => c.quest),
                ...SANCTUARY_CARDS.map(c => c.quest)
            ].filter(q => !!q);
            for (const q of all) {
                const iconId = questIconId(q!);
                if (iconId === null) {
                    assert.equal(q!.kind, 'FLAT');
                } else {
                    assert.ok(FARAWAY_ICONS[iconId], `missing icon ${iconId}`);
                }
            }
        });

        it('every card definition references only known icons', () => {
            const check = (def: any) => {
                const ids: string[] = [];
                if (def.mainArt && def.mainArt.iconId) ids.push(def.mainArt.iconId);
                (def.header?.icons || []).forEach((i: any) => ids.push(i.iconId));
                (def.overlays || []).forEach((o: any) => o.iconId && ids.push(o.iconId));
                (def.data?.rows || []).forEach((r: any) =>
                    (r.iconsList || []).forEach((i: any) => ids.push(i.iconId)));
                const inline = String(def.footer?.text || '').match(/\[icon:([a-zA-Z0-9_-]+)\]/g) || [];
                inline.forEach((m: string) => ids.push(m.slice(6, -1)));
                for (const id of ids) assert.ok(FARAWAY_ICONS[id], `unknown icon ${id} on ${def.id}`);
            };
            REGION_CARDS.forEach(c => check(getRegionCardDefinition(c)));
            SANCTUARY_CARDS.forEach(c => check(getSanctuaryCardDefinition(c)));
        });
    });

    // ======================================================================
    describe('Type A: quest evaluation', () => {
        it('counts every matching icon, and never consumes one', () => {
            const visible = [
                scorable('BLUE', false, 1, ['UDDU', 'UDDU']),
                scorable('RED', true, 0, ['OKIKO'])
            ];
            assert.equal(evalQuest({ kind: 'PER_RESOURCE', resource: 'UDDU', fame: 3 }, visible), 6);
            assert.equal(evalQuest({ kind: 'PER_NIGHT', fame: 3 }, visible), 3);
            assert.equal(evalQuest({ kind: 'PER_CLUE', fame: 2 }, visible), 2);
            assert.equal(evalQuest({ kind: 'FLAT', fame: 9 }, visible), 9);
            // the same two uddu satisfy a 2-uddu prerequisite AND still score
            assert.ok(prereqMet(['UDDU', 'UDDU'], visible));
            assert.ok(!prereqMet(['UDDU', 'UDDU', 'UDDU'], visible));
        });

        it('scores a colour pair once per card, not once per colour', () => {
            const visible = [
                scorable('YELLOW', false, 0, []),
                scorable('GREEN', false, 0, []),
                scorable('BLUE', false, 0, [])
            ];
            assert.equal(evalQuest({ kind: 'PER_COLOUR', colours: ['YELLOW', 'GREEN'], fame: 2 }, visible), 4);
        });

        it('scores a 4-colour set by the scarcest colour', () => {
            const visible = [
                scorable('BLUE', false, 0, []), scorable('BLUE', false, 0, []),
                scorable('RED', false, 0, []), scorable('RED', false, 0, []),
                scorable('GREEN', false, 0, []), scorable('YELLOW', false, 0, [])
            ];
            assert.equal(evalQuest({ kind: 'PER_SET_4_COLOURS', fame: 10 }, visible), 10);
            visible.push(scorable('GREEN', false, 0, []), scorable('YELLOW', false, 0, []));
            assert.equal(evalQuest({ kind: 'PER_SET_4_COLOURS', fame: 10 }, visible), 20);
        });
    });

    // ======================================================================
    describe('Type A: scoring the tableau', () => {
        it('only sees itself and the regions to its RIGHT', () => {
            const gs = freshGame();
            // 10 = "3 per night card". Put a night region to its left (30) and
            // one to its right (24): only the right-hand one may be counted.
            setArea(gs, 'a', [30, 10, 24]);
            const s = gs.computeScore('a');
            assert.equal(s.regions[1].fame, 3, 'sees only the night region on its right');
            assert.equal(s.regions[1].cardId, 10);
        });

        it('counts the quest card itself', () => {
            const gs = freshGame();
            // 22 is a night region with a clue, quest "1 per clue".
            setArea(gs, 'a', [22]);
            assert.equal(gs.computeScore('a').regions[0].fame, 1);
        });

        it('blocks a quest whose prerequisite is not visible', () => {
            const gs = freshGame();
            // 17 needs 2 okiko; 5 (1 okiko) alone is not enough.
            setArea(gs, 'a', [17, 5]);
            let s = gs.computeScore('a');
            assert.equal(s.regions[0].blocked, true);
            assert.equal(s.regions[0].fame, 0);

            // adding a second okiko to its right unblocks it; 17 then scores
            // "3 per uddu" over itself (1 uddu) → 3.
            setArea(gs, 'a', [17, 5, 16]);
            s = gs.computeScore('a');
            assert.equal(s.regions[0].blocked, false);
            assert.equal(s.regions[0].fame, 3);
        });

        it('reports exactly which wonder icons a blocked quest is short of', () => {
            const gs = freshGame();
            // 17 needs 2 okiko; only card 5 (1 okiko) sits to its right.
            setArea(gs, 'a', [17, 5]);
            let rs = gs.computeScore('a').regions[0];
            assert.equal(rs.blocked, true);
            assert.deepEqual(rs.missing, ['OKIKO']);

            // nothing to its right at all → both icons are missing
            setArea(gs, 'a', [17]);
            rs = gs.computeScore('a').regions[0];
            assert.deepEqual(rs.missing, ['OKIKO', 'OKIKO']);

            // satisfied → nothing missing
            setArea(gs, 'a', [17, 5, 16]);
            rs = gs.computeScore('a').regions[0];
            assert.equal(rs.blocked, false);
            assert.deepEqual(rs.missing, []);
        });

        it('lets a sanctuary satisfy a prerequisite from anywhere', () => {
            const gs = freshGame();
            setArea(gs, 'a', [17], ['S03', 'S11']);   // S03 + S11 each carry 1 okiko
            const s = gs.computeScore('a');
            assert.equal(s.regions[0].blocked, false);
            assert.equal(s.regions[0].fame, 3);       // 3 per uddu, 1 uddu on card 17
        });

        it('treats a coloured sanctuary as a region of that colour', () => {
            const gs = freshGame();
            // 25 = "1 per yellow/green card"; S18 is colourless, S31 is GREEN.
            setArea(gs, 'a', [25], ['S31']);
            assert.equal(gs.computeScore('a').regions[0].fame, 2, 'itself (yellow) + the green sanctuary');
        });

        it('scores sanctuary quests last, over the whole play area', () => {
            const gs = freshGame();
            // S45 = "1 per blue card". Two blue regions + itself (blue) = 3.
            setArea(gs, 'a', [9, 13], ['S45']);
            const s = gs.computeScore('a');
            assert.equal(s.sanctuaryFame, 3);
            assert.deepEqual(s.sanctuaries, [{ id: 'S45', hasQuest: true, fame: 3 }]);
            assert.equal(s.total, s.regions.reduce((n, r) => n + r.fame, 0) + 3);
        });

        it('reports each sanctuary separately, in shelf order', () => {
            const gs = freshGame();
            // S07 has no quest; S45 = "1 per blue card" (itself + 9 + 13 = 3);
            // S21 = flat 5.
            setArea(gs, 'a', [9, 13], ['S07', 'S45', 'S21']);
            const s = gs.computeScore('a');
            assert.deepEqual(s.sanctuaries, [
                { id: 'S07', hasQuest: false, fame: 0 },
                { id: 'S45', hasQuest: true, fame: 3 },
                { id: 'S21', hasQuest: true, fame: 5 }
            ]);
            assert.equal(s.sanctuaryFame, 8);
        });
    });

    // ======================================================================
    describe('Type A: round flow', () => {
        it('deals 3 regions each and reveals players + 1 market cards', () => {
            const gs = freshGame(['a', 'b', 'c']);
            assert.equal(gs.get_phase(), Phase.Commit);
            for (const id of ['a', 'b', 'c']) assert.equal(gs.get_player(id)!.hand.length, HAND_SIZE);
            assert.equal(gs.get_market().length, 4);
            assert.equal(gs.get_region_deck_count(), 68 - 9 - 4);
            assert.equal(gs.get_sanctuary_deck_count(), 45);
        });

        it('nobody finds a sanctuary in round 1', () => {
            const gs = freshGame();
            playRound(gs);
            for (const id of ['a', 'b']) assert.equal(gs.get_player(id)!.sanctuaries.length, 0);
            assert.equal(gs.get_round(), 2);
        });

        it('draws 1 + clues sanctuaries only when the new region is strictly higher', () => {
            const gs = freshGame();
            const d = gs.get_data();
            d.players['a'].tableau = [10];
            d.players['a'].hand = [5, 40, 12];      // 5 < 10, 40 > 10
            d.players['b'].tableau = [50];
            d.players['b'].hand = [20, 21, 22];     // all lower than 50

            assert.deepEqual(gs.sanctuaryPreview('a', 5), { qualifies: false, draws: 0 });
            // region 40 has no clue and the tableau has none → exactly 1 draw
            assert.deepEqual(gs.sanctuaryPreview('a', 40), { qualifies: true, draws: 1 });

            // a clue in the play area adds a draw
            d.players['a'].sanctuaries = ['S12'];   // 1 clue
            assert.deepEqual(gs.sanctuaryPreview('a', 40), { qualifies: true, draws: 2 });
            // ...and a clue on the played card counts too
            d.players['a'].hand = [5, 40, 49];      // 49 carries a clue
            assert.deepEqual(gs.sanctuaryPreview('a', 49), { qualifies: true, draws: 3 });

            gs.commit('a', 49);
            gs.commit('b', 20);
            assert.equal(gs.get_player('a')!.pendingSanctuaries.length, 3);
            assert.equal(gs.get_player('b')!.pendingSanctuaries.length, 0);
        });

        it('orders the end-of-exploration turns by ascending duration played', () => {
            const gs = freshGame(['a', 'b', 'c']);
            const d = gs.get_data();
            d.players['a'].hand = [40, 1, 2];
            d.players['b'].hand = [7, 8, 9];
            d.players['c'].hand = [20, 21, 22];
            gs.commit('a', 40);
            gs.commit('b', 7);
            gs.commit('c', 20);
            assert.equal(gs.get_phase(), Phase.EndExploration);
            assert.deepEqual(gs.get_turn_order(), ['b', 'c', 'a']);
            assert.equal(gs.currentPlayerId(), 'b');
        });

        it('keeps exactly 1 sanctuary and buries the rest at the bottom', () => {
            const gs = freshGame();
            const d = gs.get_data();
            d.players['a'].tableau = [10];
            d.players['a'].hand = [49, 1, 2];   // 49 > 10 and carries a clue → 2 draws
            d.players['b'].tableau = [60];
            d.players['b'].hand = [3, 4, 5];
            const deckBefore = gs.get_sanctuary_deck_count();

            gs.commit('b', 3);
            gs.commit('a', 49);
            const pending = [...gs.get_player('a')!.pendingSanctuaries];
            assert.equal(pending.length, 2);
            assert.equal(deckBefore - gs.get_sanctuary_deck_count(), 2);

            // b played the lower card, so b acts first
            assert.equal(gs.currentPlayerId(), 'b');
            gs.take_market('b', 0);
            assert.equal(gs.currentPlayerId(), 'a');
            // sanctuaries resolve before the market pick
            assert.throws(() => gs.take_market('a', 0), /sanctuary first/i);
            gs.keep_sanctuary('a', pending[1]);
            gs.take_market('a', 0);

            assert.deepEqual(gs.get_player('a')!.sanctuaries, [pending[1]]);
            assert.equal(gs.get_player('a')!.pendingSanctuaries.length, 0);
            assert.equal(gs.get_sanctuary_deck_count(), deckBefore - 1, 'the other card went back');
        });

        it('rejects acting out of turn and taking two market cards', () => {
            const gs = freshGame();
            const d = gs.get_data();
            d.players['a'].hand = [40, 1, 2];
            d.players['b'].hand = [7, 8, 9];
            gs.commit('a', 40);
            gs.commit('b', 7);
            assert.throws(() => gs.take_market('a', 0), /not your turn/i);
            gs.take_market('b', 0);
            assert.throws(() => gs.take_market('b', 0), /not your turn/i);
        });

        it('rejects committing a card that is not in hand, and double commits', () => {
            const gs = freshGame();
            assert.throws(() => gs.commit('a', 999), /not in your hand/i);
            gs.commit('a', gs.get_player('a')!.hand[0]);
            assert.throws(() => gs.commit('a', gs.get_player('a')!.hand[0]), /already committed/i);
        });

        it('removes the leftover market card and refills to players + 1', () => {
            const gs = freshGame(['a', 'b', 'c']);
            const before = gs.get_region_deck_count();
            playRound(gs);
            assert.equal(gs.get_market().length, 4, 'refilled for the next round');
            assert.equal(gs.get_removed().length, 1, 'one card left the game');
            assert.equal(gs.get_region_deck_count(), before - 4);
        });

        it('runs 8 rounds, skips the round-8 market, and ends in scoring', () => {
            const gs = freshGame(['a', 'b', 'c', 'd', 'e', 'f']);
            for (let r = 1; r <= ROUNDS; r++) {
                assert.equal(gs.get_round(), r, `round ${r}`);
                if (r <= 7) assert.equal(gs.get_market().length, 7, `market in round ${r}`);
                else assert.equal(gs.get_market().length, 0, 'no market in round 8');
                playRound(gs);
            }
            assert.equal(gs.get_phase(), Phase.Done);
            for (const id of gs.get_player_order()) {
                assert.equal(gs.get_player(id)!.tableau.length, ROUNDS);
                assert.equal(gs.get_player(id)!.hand.length, HAND_SIZE - 1);
            }
            assert.ok(gs.get_region_deck_count() >= 0, 'the 68-card deck was never overdrawn');
            assert.ok((gs.get_winners() || []).length >= 1);
        });

        it('breaks a tie on the lowest total exploration duration', () => {
            const gs = freshGame();
            const d = gs.get_data();
            // Two identical flat-fame areas built from different durations.
            d.players['a'].tableau = [3, 9];       // flat 4 + flat 5 = 9 fame, sum 12
            d.players['b'].tableau = [3, 9, 1];    // same 9 fame, sum 13 (1 has no quest)
            gs.score();
            assert.equal(d.scores!['a'].total, d.scores!['b'].total);
            assert.deepEqual(gs.get_winners(), ['a']);
        });
    });

    // ======================================================================
    describe('Type A: advanced draft', () => {
        it('keeps 3 of 5 and shuffles the rest back before the market appears', () => {
            const gs = freshGame(['a', 'b'], 11, true);
            assert.equal(gs.get_phase(), Phase.Draft);
            assert.equal(gs.get_market().length, 0);
            assert.equal(gs.get_player('a')!.draftPool.length, 5);

            const poolA = [...gs.get_player('a')!.draftPool];
            assert.throws(() => gs.draft_keep('a', poolA.slice(0, 2)), /exactly 3/i);
            gs.draft_keep('a', poolA.slice(0, 3));
            assert.equal(gs.get_phase(), Phase.Draft, 'still waiting for b');

            const poolB = [...gs.get_player('b')!.draftPool];
            gs.draft_keep('b', poolB.slice(0, 3));
            assert.equal(gs.get_phase(), Phase.Commit);
            assert.equal(gs.get_market().length, 3);
            assert.equal(gs.get_player('a')!.hand.length, 3);
            // 68 - 10 dealt + 4 returned - 3 market
            assert.equal(gs.get_region_deck_count(), 68 - 10 + 4 - 3);
        });
    });

    // ======================================================================
    describe('Type A: serialisation', () => {
        it('survives a JSON round trip', () => {
            const gs = freshGame(['a', 'b', 'c']);
            playRound(gs);
            const raw: GameStateData = JSON.parse(JSON.stringify(gs.get_data()));
            const back = FarawayGameState.from_data(raw, ['a', 'b', 'c']);
            assert.equal(back.get_round(), gs.get_round());
            assert.deepEqual(back.get_market(), gs.get_market());
            assert.equal(back.computeScore('a').total, gs.computeScore('a').total);
        });
    });

    // ======================================================================
    describe('Type B: integration (GameRuleTest)', () => {
        function gsFrom(test: GameRuleTest): FarawayGameState {
            const raw: any = test.getHostData('gameState');
            return typeof raw?.get_data === 'function' ? raw : FarawayGameState.from_data(raw.data, raw.playerIds);
        }

        it('starts a game and distributes hands privately', () => {
            const test = new GameRuleTest('faraway', 2);   // host + 2 clients = 3 players
            test.invokeHostMethod('startGame');

            const gs = gsFrom(test);
            assert.equal(gs.get_phase(), Phase.Commit);
            assert.equal(gs.get_player_order().length, 3);
            assert.equal(gs.get_market().length, 4);
            for (const id of gs.get_player_order()) {
                assert.equal(gs.get_player(id)!.hand.length, HAND_SIZE);
            }
        });

        it('routes commits and end-of-exploration actions through remote methods', () => {
            const test = new GameRuleTest('faraway', 1);   // host + 1 client = 2 players
            test.invokeHostMethod('startGame');

            let gs = gsFrom(test);
            const order = gs.get_player_order();
            const clientId = test.getPlayerClientId(0);
            const hostId = order.filter(id => id !== clientId)[0];

            const commitAs = (id: string, cardId: number) =>
                id === hostId ? test.invokeHostMethod('commitRegion', cardId)
                    : test.invokeClientMethod(0, 'commitRegion', cardId);

            commitAs(hostId, gs.get_player(hostId)!.hand[0]);
            gs = gsFrom(test);
            assert.equal(gs.get_phase(), Phase.Commit, 'still hidden until everybody commits');

            commitAs(clientId, gs.get_player(clientId)!.hand[0]);
            gs = gsFrom(test);
            assert.equal(gs.get_phase(), Phase.EndExploration);

            // resolve the round through the RPC surface
            let guard = 0;
            while (gsFrom(test).get_phase() === Phase.EndExploration && guard++ < 20) {
                const live = gsFrom(test);
                const cur = live.currentPlayerId()!;
                const owed = live.pendingActions(cur);
                if (owed.sanctuary) {
                    const pick = live.get_player(cur)!.pendingSanctuaries[0];
                    if (cur === hostId) test.invokeHostMethod('keepSanctuary', pick);
                    else test.invokeClientMethod(0, 'keepSanctuary', pick);
                } else if (owed.market) {
                    if (cur === hostId) test.invokeHostMethod('takeMarket', 0);
                    else test.invokeClientMethod(0, 'takeMarket', 0);
                } else break;
            }

            gs = gsFrom(test);
            assert.equal(gs.get_round(), 2);
            assert.equal(gs.get_phase(), Phase.Commit);
            for (const id of order) assert.equal(gs.get_player(id)!.hand.length, HAND_SIZE);
        });

        it('keeps every region card in exactly one place', () => {
            const test = new GameRuleTest('faraway', 2);
            test.invokeHostMethod('startGame');
            const gs = gsFrom(test);

            const seen: number[] = [
                ...gs.get_market(),
                ...gs.get_removed(),
                ...gs.get_data().regionDeck
            ];
            for (const id of gs.get_player_order()) {
                const p = gs.get_player(id)!;
                seen.push(...p.hand, ...p.draftPool, ...p.tableau);
            }
            assert.equal(seen.length, 68, 'every region is accounted for');
            assert.equal(new Set(seen).size, 68, 'and none is duplicated');
        });
    });
});
