/**
 * test_parks.ts — Parks tests.
 *   Type A: the card tables + the pure ParksGameState engine.
 *   Type B: end-to-end via GameRuleTest (remote methods + tick distribution).
 */

import { describe, it } from 'mocha';
import { strict as assert } from 'assert';

import {
    ParksGameState, Phase, END, GameStateData, nextRng, Area, AREAS, coversPayment, LogItem
} from '../../rules/parks/ParksGameState';
import {
    PARK_CARDS, GEAR_CARDS, CANTEEN_CARDS, SEASON_CARDS, YEAR_CARDS, EVENT_CARDS, Token, TOKENS, Bag, SYMS, Sym,
    SUPPLY_START, PHOTOS_START, GEAR_BY_ID, SiteId, SITES, PARK_BY_ID, CANTEEN_BY_ID, SEASON_BY_ID, EVENT_BY_ID,
    yearDescription, yearNextStep, NIGHTFALL_PARK_CARDS, NIGHTFALL_YEAR_CARDS, NIGHTFALL_WILDLIFE, CAMPSITE_TILES, YEAR_BY_ID,
    NF_MODULES, NfModules, nfModulesOf, WL_GEAR_CARDS, WL_SEASON_CARDS, WL_CANTEEN_CARDS, WL_SITES, WL_MODULES, WlModules, wlModulesOf
} from '../../rules/parks/ParksData';
import {
    PARKS_ICONS, parkIconId, getParkCardDefinition, getGearCardDefinition, SEASON_THEMES, seasonEffectLine, getSiteCardDefinition, getCanteenCardDefinition
} from '../../rules/parks/ParksAssets';
import { GameRuleTest } from '../GameRuleTest';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function fresh(ids: string[] = ['a', 'b'], seed = 7): ParksGameState {
    const gs = new ParksGameState(ids);
    gs.start_game({ seed, firstGame: true });
    return gs;
}

/** A controlled table: a known Trail, no Weather, quiet Season, chosen Parks. */
function table(ids: string[] = ['a', 'b'], trail: SiteId[] = ['FOREST', 'MOUNTAIN', 'VALLEY', 'OCEAN', 'VISTA', 'RIVER'], season = 'splendor'): { gs: ParksGameState; d: GameStateData } {
    const gs = fresh(ids);
    const d = gs.get_data();
    for (const w of d.weather) if (w) d.supply[w] += 1;
    for (const b of d.parkBonus) if (b) d.supply[b] += 1;
    d.parkBonus = [null, null, null];
    d.trail = trail;
    d.weather = trail.map(() => null);
    d.current = ids[0];
    d.firstHikerOwner = ids[0];
    d.activeSeason = season;
    return { gs, d };
}

const give = (d: GameStateData, id: string, bag: Bag) => {
    for (const t of TOKENS) {
        const n = bag[t] || 0;
        d.players[id].tokens[t] += n;
        d.supply[t] -= n;
    }
};

const tokensInPlay = (gs: ParksGameState): Record<Token, number> => {
    const d = gs.get_data();
    const out: Record<Token, number> = { ...d.supply };
    for (const id of gs.get_player_order()) {
        const p = d.players[id];
        for (const t of TOKENS) out[t] += p.tokens[t];
        out.WATER += p.canteens.filter(c => c.filled).length;
    }
    d.weather.forEach((w) => { if (w) out[w] += 1; });
    d.parkBonus.forEach((b) => { if (b) out[b] += 1; });
    if (d.wildlife) [...AREAS.map(a => d.wildlife!.endBonus[a]), ...d.wildlife.gearBonus].forEach((b) => { if (b) out[b] += 1; });
    if (d.solo) { out.SUNSHINE += d.solo.tracker.SUNSHINE; out.WATER += d.solo.tracker.WATER; }
    return out;
};

// A seeded random bot that only ever plays legal moves through the public API.
function rnd(state: { s: number }): number {
    const r = nextRng(state.s);
    state.s = r.seed;
    return r.value;
}
const pick = <T>(arr: T[], state: { s: number }): T => arr[Math.floor(rnd(state) * arr.length)];

function pickBag(held: Record<Token, number>, count: number, state: { s: number }, tokens: Token[] = TOKENS): Bag {
    const pool: Token[] = [];
    tokens.forEach((t) => { for (let i = 0; i < held[t]; i++) pool.push(t); });
    const bag: Bag = {};
    for (let i = 0; i < count; i++) {
        const idx = Math.floor(rnd(state) * pool.length);
        const t = pool.splice(idx, 1)[0];
        bag[t] = (bag[t] || 0) + 1;
    }
    return bag;
}

function answerPrompt(gs: ParksGameState, state: { s: number }): void {
    const owner = gs.get_prompt()!.playerId;
    const v = gs.view_for(owner);
    const p = v.prompt;
    const me = v.players[owner];
    const answers: Record<string, () => any> = {
        CANTEEN: () => (rnd(state) < 0.8 ? { index: pick(p.canteens, state) } : { skip: true }),
        SITE_GAIN: () => (p.printedOk && rnd(state) < 0.5 ? {} : (p.gear.length ? { gearId: pick(p.gear, state) } : {})),
        VISTA: () => ({ choice: rnd(state) < 0.5 ? 'CANTEEN' : 'PHOTO' }),
        LOOKOUT: () => ({ choice: pick(p.options, state) }),
        CANTEEN_CHOICE: () => ({ choice: pick(p.options, state) }),
        RIVER: () => ({ slot: pick(p.slots, state) }),
        PAY: () => (p.optional && rnd(state) < 0.3 ? { skip: true } : { pay: pickBag(me.tokens, p.count, state) }),
        EXCHANGE: () => {
            for (let tries = 0; tries < 60; tries++) {
                const held = TOKENS.reduce((n, t) => n + me.tokens[t], 0);
                const count = held >= 2 && rnd(state) < 0.5 ? 2 : 1;
                const pay = pickBag(me.tokens, count, state);
                const offered = SYMS.filter(t => !pay[t]);
                const avail = offered.reduce((n, t) => n + v.supply[t], 0);
                if (avail >= count) return { pay, gain: pickBag(v.supply, count, state, offered) };
            }
            return { skip: true };
        },
        RESERVE: () => {
            const sources: any[] = [];
            v.parksBoard.forEach((id: string | null, i: number) => { if (id) sources.push(i); });
            if (p.deck > 0) sources.push('DECK');
            return { source: pick(sources, state) };
        },
        VISIT: () => {
            const ok = p.options.filter((o: any) => o.suggestion);
            const o = pick<any>(ok, state);
            return { parkId: o.parkId, payment: o.suggestion };
        },
        BUY: () => {
            const ok = p.options.filter((o: any) => o.ok);
            return { slot: pick<any>(ok, state).slot };
        },
        DISCARD: () => ({ discard: pickBag(me.tokens, p.count, state) }),
        CAMP: () => {
            const choices: any[] = p.options.map((o: any) => o.spot);
            if (p.siteOk) choices.push('SITE');
            return { choice: pick(choices, state) };
        },
        NF_PAY: () => (p.optional && rnd(state) < 0.3 ? { skip: true } : { token: pick(p.tokens, state) }),
        NF_SWAP: () => {
            const give: any[] = [...p.gear.map((id: string) => ({ type: 'GEAR', id })), ...p.years.map((id: string) => ({ type: 'YEAR', id }))];
            const take: any[] = p.board.map((g: any) => g.slot);
            if (p.yearDeck > 0) take.push('YEAR');
            if (p.gearDeck > 0) take.push('GEAR_DECK');
            return { discard: pick(give, state), take: pick(take, state) };
        },
        NF_GEAR_PICK: () => {
            const take: any[] = p.board.map((g: any) => g.slot);
            if (p.gearDeck > 0) take.push('DECK');
            return take.length && rnd(state) < 0.9 ? { take: pick(take, state) } : { skip: true };
        },
        NF_YEAR_RETURN: () => ({ yearId: pick(p.years, state) }),
        RANGER_CAMP: () => ({ choice: rnd(state) < 0.5 ? 'WEATHER' : 'CAMP' }),
        SHUTTER: () => (rnd(state) < 0.5 ? { swap: 1 + Math.floor(rnd(state) * p.count) } : { skip: true }),
        LAKE: () => ({ index: pick(p.canteens, state) }),
        PARKWAY: () => ({ slot: pick(p.slots, state) }),
        SUMMIT: () => ({ token: pick(p.tokens, state) })
    };
    gs.respond(owner, answers[p.kind]());
}

function playTurn(gs: ParksGameState, state: { s: number }): void {
    const id = gs.get_current();
    const moves = gs.moveOptions(id);
    const options: (() => void)[] = [];
    moves.hikers.forEach((h, i) => {
        if (h.pos === END) return;
        Object.keys(h.sites).forEach((slot) => {
            if (h.sites[Number(slot)].ok) {
                options.push(() => gs.move_to_site(id, i, Number(slot)));
                options.push(() => gs.move_to_site(id, i, Number(slot)));
            }
        });
        if (h.tent) options.push(() => gs.tent_revisit(id, i));
        AREAS.forEach((a: Area) => {
            if (moves.areas[a].ok) options.push(() => gs.move_to_end(id, i, a));
        });
    });
    assert.ok(options.length > 0, 'a player whose turn it is always has a legal move');
    pick(options, state)();
}

function playOut(gs: ParksGameState, seed: number): number {
    const state = { s: seed };
    let steps = 0;
    // Nightfall adds four Wildlife to the box
    const expected: Record<Token, number> = { ...SUPPLY_START, WILDLIFE: SUPPLY_START.WILDLIFE + (gs.nfHas('wildlife') ? NIGHTFALL_WILDLIFE : 0) };
    for (const id of gs.get_player_order()) {
        const p = gs.get_player(id)!;
        if (!p.year) gs.pick_year(id, pick(p.yearOptions, state));
    }
    while (gs.get_phase() !== Phase.Over) {
        assert.ok(steps++ < 5000, 'game must terminate');
        if (gs.get_prompt()) answerPrompt(gs, state);
        else playTurn(gs, state);
        const totals = tokensInPlay(gs);
        for (const t of TOKENS) assert.equal(totals[t], expected[t], `${t} token count is conserved (step ${steps})`);
        const d = gs.get_data();
        const photos = gs.get_player_order().reduce((n, id) => n + d.players[id].photos, d.photos);
        assert.equal(photos, PHOTOS_START, 'photo count is conserved');
    }
    return steps;
}

describe('Parks', () => {

    // ======================================================================
    describe('Type A: card data', () => {
        it('has the full component counts', () => {
            assert.equal(PARK_CARDS.length, 48);
            assert.equal(new Set(PARK_CARDS.map(p => p.id)).size, 48);
            assert.equal(GEAR_CARDS.length, 36);
            assert.equal(new Set(GEAR_CARDS.map(g => g.type)).size, 13);
            assert.equal(CANTEEN_CARDS.length, 15);
            assert.equal(SEASON_CARDS.length, 10);
            assert.equal(YEAR_CARDS.length, 12);
            assert.equal(EVENT_CARDS.length, 8);
        });

        it('gear cost totals match the solo table', () => {
            const count = (c: number) => GEAR_CARDS.filter(g => g.cost === c).length;
            assert.deepEqual([count(1), count(2), count(3)], [9, 16, 11]);
        });

        it('every park obeys points = forest + mountain + (sun + water) / 2', () => {
            for (const p of PARK_CARDS) {
                const c = p.cost;
                const expected = (c.FOREST || 0) + (c.MOUNTAIN || 0) + ((c.SUNSHINE || 0) + (c.WATER || 0)) / 2;
                assert.equal(p.points, expected, p.name);
            }
        });

        it('every park has its own scene and well-formed card faces', () => {
            const scenes = new Set<string>();
            for (const p of PARK_CARDS) {
                const art = PARKS_ICONS[parkIconId(p.id)];
                assert.ok(art && art.layers.length >= 4, `${p.id} has a scene`);
                scenes.add(JSON.stringify(art.layers.map((l: any) => [l.type, l.customPath, l.x, l.y, l.fill])));
                const def = getParkCardDefinition(p);
                const coins = def.data!.rows[0].iconsList!.length;
                assert.equal(coins, Object.values(p.cost).reduce((a, b) => a + (b || 0), 0), `${p.id} shows one coin per printed icon`);
            }
            assert.equal(scenes.size, 48, 'no two parks share a composition');
            for (const g of GEAR_CARDS) {
                const def = getGearCardDefinition(g);
                assert.ok(PARKS_ICONS[def.mainArt!.iconId!], `${g.id} has art`);
                const used: string[] = def.footer!.text.match(/\[icon:([a-z_]+)\]/g) || [];
                used.forEach((m) => {
                    assert.ok(PARKS_ICONS[m.slice(6, -1)], `${g.id} footer icon ${m}`);
                });
            }
        });
    });

    // ======================================================================
    describe('Type A: setup', () => {
        it('deals the table for two players', () => {
            const gs = fresh(['a', 'b']);
            const d = gs.get_data();
            assert.equal(d.parksBoard.filter(Boolean).length, 3);
            assert.equal(d.gearBoard.filter(s => s.length === 1).length, 3);
            assert.equal(d.trail.length, 6);
            assert.equal(d.players.a.canteens.length, 1);
            assert.equal(d.players.a.hikers.join(), '0,0');
            assert.ok(d.players.a.campfireLit);
        });

        it('adds the Waterfall and one more Site at 4–5 players', () => {
            const d = fresh(['a', 'b', 'c', 'd']).get_data();
            assert.equal(d.trail.length, 7);
            assert.ok(d.trail.includes('WATERFALL'));
        });

        it('places Weather from Site #2, never on the first Site', () => {
            const d = fresh(['a', 'b'], 3).get_data();
            assert.equal(d.weather[0], null);
            assert.ok(d.weather.slice(1).every(w => w === 'SUNSHINE' || w === 'WATER'));
        });

        it('the Camera starts one seat before the First Hiker', () => {
            const gs = fresh(['a', 'b', 'c']);
            const d = gs.get_data();
            const order = gs.get_player_order();
            const first = order.indexOf(d.firstHikerOwner);
            assert.equal(d.cameraOwner, order[(first + 2) % 3]);
        });

        it('keeps Year choices secret and waits for everyone', () => {
            const gs = new ParksGameState(['a', 'b']);
            gs.start_game({ seed: 4 });
            assert.equal(gs.get_phase(), Phase.Year);
            const optsA = gs.get_data().players.a.yearOptions;
            assert.equal(optsA.length, 2);
            assert.throws(() => gs.pick_year('a', 'nope'));
            gs.pick_year('a', optsA[0]);
            assert.equal(gs.get_phase(), Phase.Year);
            const viewB = gs.view_for('b');
            assert.equal(viewB.players.a.year, null, 'opponent cannot see the kept card');
            assert.deepEqual(viewB.players.a.yearOptions, []);
            assert.equal(viewB.parksDeck, 45, 'the deck is only a count');
            gs.pick_year('b', gs.get_data().players.b.yearOptions[0]);
            assert.equal(gs.get_phase(), Phase.Play);
        });
    });

    // ======================================================================
    describe('Type A: moving', () => {
        it('moves only forward and gains the Site reward', () => {
            const { gs, d } = table();
            gs.move_to_site('a', 0, 2);
            assert.equal(d.players.a.tokens.MOUNTAIN, 1);
            assert.equal(gs.get_current(), 'b');
            gs.move_to_site('b', 0, 1);
            assert.throws(() => gs.move_to_site('a', 0, 1), /forward/);
        });

        it('rejects a move out of turn and leaves the state untouched', () => {
            const { gs, d } = table();
            assert.throws(() => gs.move_to_site('b', 0, 1), /turn/);
            assert.equal(d.players.b.hikers[0], 0);
        });

        it('an occupied Site costs the Campfire; a second occupied Site is refused', () => {
            const { gs, d } = table();
            gs.move_to_site('a', 0, 2);
            assert.ok(gs.moveOptions('b').hikers[0].sites[2].campfire);
            gs.move_to_site('b', 0, 2);
            assert.equal(d.players.b.campfireLit, false);
            gs.move_to_site('a', 1, 3);
            const info = gs.moveOptions('b').hikers[1].sites[3];
            assert.equal(info.ok, false);
            assert.match(info.reason!, /Campfire/);
        });

        it('your own Hiker counts as an occupant', () => {
            const { gs, d } = table();
            gs.move_to_site('a', 0, 2);
            gs.move_to_site('b', 0, 1);
            assert.ok(gs.moveOptions('a').hikers[1].sites[2].campfire);
            gs.move_to_site('a', 1, 2);
            assert.equal(d.players.a.campfireLit, false);
        });

        it('reaching Trail End relights the Campfire', () => {
            const { gs, d } = table();
            d.players.a.campfireLit = false;
            gs.move_to_end('a', 0, 'RESERVE');
            assert.equal(d.players.a.campfireLit, true);
        });

        it('refuses a Site whose action cannot be taken', () => {
            const { gs } = table(['a', 'b'], ['WILDLIFE', 'LODGE', 'RIVER', 'VALLEY', 'OCEAN', 'FOREST']);
            const sites = gs.moveOptions('a').hikers[0].sites;
            assert.equal(sites[1].ok, false, 'no token to pay at Wildlife');
            assert.equal(sites[2].ok, false, 'no tokens to trade at the Lodge');
            assert.equal(sites[3].ok, false, 'no Water for the River');
        });

        it('Weather is collected first and can pay for the action', () => {
            const { gs, d } = table(['a', 'b'], ['FOREST', 'WILDLIFE', 'MOUNTAIN', 'VALLEY', 'OCEAN', 'VISTA']);
            d.weather[1] = 'SUNSHINE';
            d.supply.SUNSHINE -= 1;
            assert.ok(gs.moveOptions('a').hikers[0].sites[2].ok, 'the Weather token pays for it');
            gs.move_to_site('a', 0, 2);
            assert.equal(d.weather[1], null);
            assert.equal(d.players.a.tokens.WILDLIFE, 1);
            assert.equal(d.players.a.tokens.SUNSHINE, 0);
        });

        it('a supply running dry closes the Site', () => {
            const { gs, d } = table();
            d.supply.FOREST = 0;
            assert.equal(gs.moveOptions('a').hikers[0].sites[1].ok, false);
        });

        it('the last Hiker on the Trail must go to Trail End', () => {
            const { gs, d } = table();
            d.players.a.hikers = [END, END];
            d.players.b.hikers = [END, 0];
            d.current = 'b';
            const moves = gs.moveOptions('b');
            assert.ok(moves.forcedEnd);
            assert.throws(() => gs.move_to_site('b', 1, 1));
            gs.move_to_end('b', 1, 'VISIT');
        });

        it('a finished player is skipped', () => {
            const { gs, d } = table(['a', 'b', 'c']);
            d.players.b.hikers = [END, END];
            gs.move_to_site('a', 0, 1);
            assert.equal(gs.get_current(), 'c');
        });
    });

    // ======================================================================
    describe('Type A: sites with decisions', () => {
        it('Vista: a Photo costs 2 and takes the Camera, then costs its holder 1', () => {
            const { gs, d } = table(['a', 'b'], ['VISTA', 'FOREST', 'MOUNTAIN', 'VALLEY', 'OCEAN', 'LODGE']);
            d.cameraOwner = 'b';
            give(d, 'a', { FOREST: 1, SUNSHINE: 2 });
            gs.move_to_site('a', 0, 1);
            assert.equal(gs.get_prompt()!.kind, 'VISTA');
            gs.respond('a', { choice: 'PHOTO' });
            const p = gs.get_prompt()!;
            assert.equal(p.kind === 'PAY' && p.count, 2);
            assert.throws(() => gs.respond('a', { pay: { SUNSHINE: 1 } }));
            gs.respond('a', { pay: { SUNSHINE: 2 } });
            assert.equal(d.players.a.photos, 1);
            assert.equal(d.cameraOwner, 'a');
            assert.equal(gs.photoCost('a'), 1);
        });

        it('Vista can draw a Canteen', () => {
            const { gs, d } = table(['a', 'b'], ['VISTA', 'FOREST', 'MOUNTAIN', 'VALLEY', 'OCEAN', 'LODGE']);
            gs.move_to_site('a', 0, 1);
            assert.equal(d.players.a.canteens.length, 2, 'no tokens: the Canteen is the only option');
        });

        it('Lodge: gained types must differ from those turned in, and never Wildlife', () => {
            const { gs, d } = table(['a', 'b'], ['LODGE', 'FOREST', 'MOUNTAIN', 'VALLEY', 'OCEAN', 'VISTA']);
            give(d, 'a', { WATER: 2 });
            gs.move_to_site('a', 0, 1);
            assert.throws(() => gs.respond('a', { pay: { WATER: 2 }, gain: { WATER: 1, FOREST: 1 } }), /differ/);
            assert.throws(() => gs.respond('a', { pay: { WATER: 2 }, gain: { WILDLIFE: 2 } }), /Wildlife/);
            assert.equal(gs.get_prompt()!.kind, 'EXCHANGE', 'a refused answer keeps the decision open');
            gs.respond('a', { pay: { WATER: 2 }, gain: { FOREST: 2 } });
            assert.equal(d.players.a.tokens.FOREST, 2);
            assert.equal(d.players.a.tokens.WATER, 0);
        });

        it('Lodge: one token can be traded for one', () => {
            const { gs, d } = table(['a', 'b'], ['LODGE', 'FOREST', 'MOUNTAIN', 'VALLEY', 'OCEAN', 'VISTA']);
            give(d, 'a', { WATER: 2 });
            gs.move_to_site('a', 0, 1);
            gs.respond('a', { pay: { WATER: 1 }, gain: { FOREST: 1 } });
            assert.equal(d.players.a.tokens.FOREST, 1);
            assert.equal(d.players.a.tokens.WATER, 1);
        });

        it('Lodge: a player holding a single token can still trade it', () => {
            const { gs, d } = table(['a', 'b'], ['LODGE', 'FOREST', 'MOUNTAIN', 'VALLEY', 'OCEAN', 'VISTA']);
            give(d, 'a', { WATER: 1 });
            assert.equal(gs.moveOptions('a').hikers[0].sites[1].ok, true);
            gs.move_to_site('a', 0, 1);
            gs.respond('a', { pay: { WATER: 1 }, gain: { SUNSHINE: 1 } });
            assert.equal(d.players.a.tokens.SUNSHINE, 1);
            assert.equal(d.players.a.tokens.WATER, 0);
        });

        it('Lodge: the same number must come back, and at most 2', () => {
            const { gs, d } = table(['a', 'b'], ['LODGE', 'FOREST', 'MOUNTAIN', 'VALLEY', 'OCEAN', 'VISTA']);
            give(d, 'a', { WATER: 3 });
            gs.move_to_site('a', 0, 1);
            assert.throws(() => gs.respond('a', { pay: { WATER: 1 }, gain: { FOREST: 2 } }), /same number/);
            assert.throws(() => gs.respond('a', { pay: { WATER: 2 }, gain: { FOREST: 1 } }), /same number/);
            assert.throws(() => gs.respond('a', { pay: { WATER: 3 }, gain: { FOREST: 3 } }), /same number/);
            assert.throws(() => gs.respond('a', { pay: {}, gain: {} }), /same number/);
            assert.equal(gs.get_prompt()!.kind, 'EXCHANGE');
        });

        it('The exchange Canteen trades one token, or none', () => {
            const { gs, d } = table(['a', 'b'], ['OCEAN', 'FOREST', 'MOUNTAIN', 'VALLEY', 'VISTA', 'LODGE']);
            d.players.a.canteens = [{ id: 'canteen_exchange_1', filled: false }];
            gs.move_to_site('a', 0, 1);
            gs.respond('a', { index: 0 });
            assert.equal(gs.get_prompt()!.kind, 'EXCHANGE');
            const water = d.players.a.tokens.WATER;
            gs.respond('a', { pay: { WATER: 1 }, gain: { SUNSHINE: 1 } });
            assert.equal(d.players.a.tokens.SUNSHINE, 1);
            assert.equal(d.players.a.tokens.WATER, water - 1);
        });

        it('River copies an occupied Site, for 1 Water, without Gear triggers', () => {
            const { gs, d } = table(['a', 'b'], ['MOUNTAIN', 'RIVER', 'VALLEY', 'OCEAN', 'FOREST', 'VISTA']);
            d.players.a.gear = ['sleepingbag_mountain_1'];
            d.players.b.hikers = [1, 0];
            give(d, 'a', { WATER: 1 });
            gs.move_to_site('a', 0, 2);
            assert.equal(gs.get_prompt()!.kind, 'RIVER');
            gs.respond('a', { slot: 1 });
            assert.equal(d.players.a.tokens.WATER, 0);
            assert.equal(d.players.a.tokens.MOUNTAIN, 1, 'copied the printed reward');
            assert.equal(d.players.a.tokens.SUNSHINE, 0, 'replacement Gear is not offered on a copy');
            assert.equal(gs.get_prompt(), null);
        });

        it('River needs a target it can actually copy', () => {
            const { gs, d } = table(['a', 'b'], ['VALLEY', 'RIVER', 'FOREST', 'OCEAN', 'MOUNTAIN', 'VISTA']);
            give(d, 'a', { WATER: 1 });
            assert.equal(gs.moveOptions('a').hikers[0].sites[2].ok, false, 'nobody on any Site yet');
            d.players.b.hikers = [1, 0];
            assert.equal(gs.moveOptions('a').hikers[0].sites[2].ok, true);
        });

        it('River: the Hiker leaving a Site does not count as occupying it', () => {
            const { gs, d } = table(['a', 'b'], ['VALLEY', 'RIVER', 'FOREST', 'OCEAN', 'MOUNTAIN', 'VISTA']);
            give(d, 'a', { WATER: 1 });
            d.players.a.hikers = [1, 0];
            assert.equal(gs.moveOptions('a').hikers[0].sites[2].ok, false);
            assert.equal(gs.moveOptions('a').hikers[1].sites[2].ok, true, 'the other Hiker may copy it');
        });

        it('Lookout offers only what is legal, and buys with no slot discount', () => {
            const { gs, d } = table(['a', 'b'], ['LOOKOUT', 'FOREST', 'MOUNTAIN', 'VALLEY', 'OCEAN', 'VISTA']);
            d.gearBoard = [['flashlight_1'], ['tent_1'], ['journal_forest_1']];
            give(d, 'a', { SUNSHINE: 1 });
            gs.move_to_site('a', 0, 1);
            assert.equal(gs.get_prompt()!.kind, 'LOOKOUT');
            assert.deepEqual(gs.view_for('a').prompt.options, ['RESERVE', 'GEAR']);
            gs.respond('a', { choice: 'GEAR' });
            const view = gs.view_for('a').prompt;
            assert.equal(view.discount, 0);
            gs.respond('a', { slot: 0 });
            assert.equal(d.players.a.tokens.SUNSHINE, 0);
            assert.ok(d.players.a.gear.includes('flashlight_1'));
        });
    });

    // ======================================================================
    describe('Type A: Canteens', () => {
        it('only Water gained this turn can fill one, then the reward fires', () => {
            const { gs, d } = table(['a', 'b'], ['OCEAN', 'FOREST', 'MOUNTAIN', 'VALLEY', 'VISTA', 'LODGE']);
            d.players.a.canteens = [{ id: 'canteen_forest_1', filled: false }];
            give(d, 'a', { WATER: 3 });
            gs.move_to_site('a', 0, 2);
            assert.equal(gs.get_prompt(), null, 'old Water does not offer a fill');
            gs.move_to_site('b', 0, 2);
            gs.move_to_site('a', 1, 1);
            assert.equal(gs.get_prompt()!.kind, 'CANTEEN');
            gs.respond('a', { index: 0 });
            assert.ok(d.players.a.canteens[0].filled);
            assert.equal(d.players.a.tokens.FOREST, 2);
            assert.equal(d.players.a.tokens.WATER, 4);
        });

        it('declining keeps the Water and does not ask again this turn', () => {
            const { gs, d } = table(['a', 'b'], ['OCEAN', 'FOREST', 'MOUNTAIN', 'VALLEY', 'VISTA', 'LODGE']);
            d.players.a.canteens = [{ id: 'canteen_forest_1', filled: false }];
            gs.move_to_site('a', 0, 1);
            gs.respond('a', { skip: true });
            assert.equal(gs.get_prompt(), null);
            assert.equal(d.players.a.tokens.WATER, 2);
            assert.equal(gs.get_current(), 'b');
        });

        it('fills several Canteens with one trip to the Ocean', () => {
            const { gs, d } = table(['a', 'b'], ['OCEAN', 'FOREST', 'MOUNTAIN', 'VALLEY', 'VISTA', 'LODGE']);
            d.players.a.canteens = [{ id: 'canteen_forest_1', filled: false }, { id: 'canteen_mountain_1', filled: false }];
            gs.move_to_site('a', 0, 1);
            gs.respond('a', { index: 0 });
            gs.respond('a', { index: 1 });
            assert.equal(d.players.a.tokens.WATER, 0);
            assert.equal(d.players.a.tokens.FOREST, 1);
            assert.equal(d.players.a.tokens.MOUNTAIN, 1);
        });

        it('Water Bottle fills from the supply on a direct visit only', () => {
            const { gs, d } = table(['a', 'b'], ['FOREST', 'RIVER', 'MOUNTAIN', 'VALLEY', 'VISTA', 'LODGE']);
            d.players.a.gear = ['waterbottle_forest_1'];
            d.players.a.canteens = [{ id: 'canteen_mountain_1', filled: false }];
            const water = d.supply.WATER;
            gs.move_to_site('a', 0, 1);
            const p = gs.get_prompt()!;
            assert.ok(p.kind === 'CANTEEN' && p.free);
            gs.respond('a', { index: 0 });
            assert.equal(d.supply.WATER, water - 1);
            assert.equal(d.players.a.tokens.WATER, 0, 'never entered your tokens');
            assert.equal(d.players.a.tokens.MOUNTAIN, 1);
        });

        it('Season end empties Canteens back to the supply', () => {
            const { gs, d } = table(['a', 'b']);
            d.players.a.canteens = [{ id: 'canteen_forest_1', filled: true }];
            d.supply.WATER -= 1;
            d.cameraOwner = null;
            d.players.a.hikers = [END, END];
            d.players.b.hikers = [END, 0];
            d.current = 'b';
            gs.move_to_end('b', 1, 'VISIT');
            assert.equal(d.players.a.canteens[0].filled, false);
            assert.equal(d.season, 2);
        });
    });

    // ======================================================================
    describe('Type A: Parks', () => {
        it('Wildlife substitutes for any symbol and pays exactly', () => {
            const { gs, d } = table();
            d.parksBoard = ['olympic', 'zion', 'denali'];
            give(d, 'a', { FOREST: 2, WILDLIFE: 1 });
            gs.move_to_end('a', 0, 'VISIT');
            assert.throws(() => gs.respond('a', { parkId: 'olympic', payment: { FOREST: 2 } }), /cover/);
            gs.respond('a', { parkId: 'olympic', payment: { FOREST: 2, WILDLIFE: 1 } });
            assert.deepEqual(d.players.a.visited, ['olympic']);
            assert.ok(d.parksBoard[0] && d.parksBoard[0] !== 'olympic', 'the slot refills');
        });

        it('discounts stack but never go below zero, and Season discounts apply', () => {
            const { gs, d } = table(['a', 'b'], undefined, 'flowers');
            d.players.a.gear = ['compass_ww_1', 'trailmap_water_1'];
            const dry = PARK_CARDS.find(p => p.id === 'dry_tortugas')!;
            assert.deepEqual(gs.parkNeed('a', dry), {}, 'four Water minus 1 + 2 + 1');
            const sag = PARK_CARDS.find(p => p.id === 'saguaro')!;
            assert.deepEqual(gs.parkNeed('a', sag), { FOREST: 1, SUNSHINE: 2 }, 'a discount only removes symbols the Park has');
        });

        it('substitution Gear pays printed symbols, only after discounts', () => {
            const need = { FOREST: 2, SUNSHINE: 1 };
            assert.equal(coversPayment(need, { SUNSHINE: 3 }, []), false);
            assert.equal(coversPayment(need, { SUNSHINE: 3 }, ['sunscreen_forest_1']), true);
            assert.equal(coversPayment(need, { WATER: 2, SUNSHINE: 1 }, ['sunscreen_forest_1']), false);
            assert.equal(coversPayment(need, { WATER: 2, SUNSHINE: 1 }, ['raingear_forest_1']), true);
            assert.equal(coversPayment({ MOUNTAIN: 1 }, { WATER: 1 }, ['raingear_forest_1']), false, 'wrong symbol');
            assert.equal(coversPayment(need, { WILDLIFE: 3 }, []), true);
        });

        it('suggests exact tokens before substitutes before Wildlife', () => {
            const { gs, d } = table();
            d.players.a.gear = ['sunscreen_forest_1'];
            const held = { FOREST: 1, MOUNTAIN: 0, SUNSHINE: 1, WATER: 0, WILDLIFE: 1 };
            assert.deepEqual(gs.suggestPayment('a', { FOREST: 3 }, held), { FOREST: 1, SUNSHINE: 1, WILDLIFE: 1 });
            assert.equal(gs.suggestPayment('a', { MOUNTAIN: 2 }, held), null);
        });

        it('reserving from the deck is blind and the board stays put', () => {
            const { gs, d } = table();
            const board = [...d.parksBoard];
            const top = d.parksDeck[d.parksDeck.length - 1];
            gs.move_to_end('a', 0, 'RESERVE');
            gs.respond('a', { source: 'DECK' });
            assert.deepEqual(d.players.a.reserved, [top]);
            assert.deepEqual(d.parksBoard, board);
        });

        it('the first Reserve in a Season takes the First Hiker Marker, later ones do not', () => {
            const { gs, d } = table();
            d.firstHikerOwner = 'b';
            gs.move_to_end('a', 0, 'RESERVE');
            gs.respond('a', { source: 0 });
            assert.equal(d.firstHikerOwner, 'a');
            gs.move_to_end('b', 0, 'RESERVE');
            gs.respond('b', { source: 0 });
            assert.equal(d.firstHikerOwner, 'a');
        });

        it('a reserved Park can be visited later and only scores then', () => {
            const { gs, d } = table();
            d.parksBoard = ['zion', 'denali', 'olympic'];
            d.players.a.reserved = ['congaree'];
            give(d, 'a', { FOREST: 2 });
            assert.equal(gs.computeScore('a').parks, 0);
            gs.move_to_end('a', 0, 'VISIT');
            gs.respond('a', { parkId: 'congaree', payment: { FOREST: 2 } });
            assert.equal(gs.computeScore('a').parks, 2);
            assert.deepEqual(d.players.a.reserved, []);
        });

        it('Park Pass offers one more visit, once', () => {
            const { gs, d } = table();
            d.parksBoard = ['congaree', 'mammoth_cave', 'shenandoah'];
            d.players.a.gear = ['parkpass_1'];
            give(d, 'a', { FOREST: 4, MOUNTAIN: 2 });
            gs.move_to_end('a', 0, 'VISIT');
            gs.respond('a', { parkId: 'congaree', payment: { FOREST: 2 } });
            const p = gs.get_prompt()!;
            assert.ok(p.kind === 'VISIT' && p.extra);
            gs.respond('a', { parkId: 'mammoth_cave', payment: { MOUNTAIN: 2 } });
            assert.equal(d.players.a.visited.length, 2);
            assert.equal(gs.get_prompt(), null, 'no third visit');
        });

        it('Rain/Splendor tokens go to whoever takes that Park, and help pay for it', () => {
            const { gs, d } = table(['a', 'b'], undefined, 'rain');
            d.parksBoard = ['channel_islands', 'zion', 'denali'];
            d.parkBonus = ['WATER', 'WATER', 'WATER'];
            d.supply.WATER -= 3;
            give(d, 'a', { MOUNTAIN: 1, WATER: 1 });
            gs.move_to_end('a', 0, 'VISIT');
            const o = gs.view_for('a').prompt.options.find((x: any) => x.parkId === 'channel_islands');
            assert.ok(o.suggestion, 'affordable only with its own bonus');
            gs.respond('a', { parkId: 'channel_islands', payment: { MOUNTAIN: 1, WATER: 2 } });
            assert.equal(d.players.a.tokens.WATER, 0);
            assert.equal(d.parkBonus[0], null, 'the refilled Park gets no token');
        });
    });

    // ======================================================================
    describe('Type A: Gear', () => {
        it('slot discount: one Hiker at ≤3 players, two at 4–5', () => {
            const three = table(['a', 'b', 'c']);
            assert.equal(three.gs.moveOptions('a').areas.GEAR.discount, 1);
            three.d.trailEnd.gear = ['b'];
            assert.equal(three.gs.moveOptions('a').areas.GEAR.discount, 0);
            const four = table(['a', 'b', 'c', 'd']);
            four.d.trailEnd.gear = ['b'];
            assert.equal(four.gs.moveOptions('a').areas.GEAR.discount, 1);
            four.d.trailEnd.gear = ['b', 'c'];
            assert.equal(four.gs.moveOptions('a').areas.GEAR.discount, 0);
        });

        it('discounts stack, floor at 0, Flashlight applies, refill follows', () => {
            const { gs, d } = table(['a', 'b'], undefined, 'wind');
            d.gearBoard = [['trailmap_water_1'], ['tent_1'], ['journal_forest_1']];
            d.players.a.gear = ['flashlight_1'];
            gs.move_to_end('a', 0, 'GEAR');
            assert.equal(gs.gearPrice('a', 'tent_1', 1), 0);
            assert.equal(gs.gearPrice('a', 'trailmap_water_1', 1), 0, 'floors at zero');
            gs.respond('a', { slot: 1 });
            assert.ok(d.players.a.gear.includes('tent_1'));
            assert.equal(d.gearBoard[1].length, 1, 'the slot refills');
        });

        it('a replacement is offered at its Site and chooses what Season sees', () => {
            const { gs, d } = table(['a', 'b'], undefined, 'stone');
            d.players.a.gear = ['waterfilter_mountain_1'];
            gs.move_to_site('a', 0, 2);
            assert.equal(gs.get_prompt()!.kind, 'SITE_GAIN');
            gs.respond('a', { gearId: 'waterfilter_mountain_1' });
            assert.equal(d.players.a.tokens.WATER, 3);
            assert.equal(d.players.a.tokens.SUNSHINE, 0, 'no Mountain gained, so Stone stays quiet');
            assert.equal(d.players.a.tokens.MOUNTAIN, 0);
        });

        it('Water Bottle draws a Canteen on purchase; Lens offers a Photo', () => {
            const a = table();
            a.d.gearBoard = [['waterbottle_forest_1'], ['lens_forest_1'], ['tent_1']];
            give(a.d, 'a', { SUNSHINE: 4 });
            a.gs.move_to_end('a', 0, 'GEAR');
            a.gs.respond('a', { slot: 0 });
            assert.equal(a.d.players.a.canteens.length, 2);

            const b = table();
            b.d.gearBoard = [['waterbottle_forest_1'], ['lens_forest_1'], ['tent_1']];
            b.d.cameraOwner = 'b';
            give(b.d, 'a', { SUNSHINE: 4 });
            b.gs.move_to_end('a', 0, 'GEAR');
            b.gs.respond('a', { slot: 1 });
            const p = b.gs.get_prompt()!;
            assert.ok(p.kind === 'PAY' && p.purpose === 'LENS' && p.count === 2 && p.optional);
            b.gs.respond('a', { pay: { SUNSHINE: 2 } });
            assert.equal(b.d.players.a.photos, 1);
            assert.equal(b.d.cameraOwner, 'b', 'Gear Photos never move the Camera');
        });

        it('Tent: spend the Campfire to take the current Site again', () => {
            const { gs, d } = table();
            d.players.a.gear = ['tent_1'];
            d.players.a.hikers = [2, 0];
            assert.ok(gs.moveOptions('a').hikers[0].tent);
            assert.equal(gs.moveOptions('a').hikers[1].tent, false, 'not from the Trailhead');
            gs.tent_revisit('a', 0);
            assert.equal(d.players.a.tokens.MOUNTAIN, 1);
            assert.equal(d.players.a.campfireLit, false);
            assert.equal(d.players.a.hikers[0], 2);
        });
    });

    // ======================================================================
    describe('Type A: Seasons', () => {
        it('Stone fires once per turn however many Mountains arrive', () => {
            const { gs, d } = table(['a', 'b'], ['LODGE', 'FOREST', 'MOUNTAIN', 'VALLEY', 'OCEAN', 'VISTA'], 'stone');
            give(d, 'a', { WATER: 2 });
            gs.move_to_site('a', 0, 1);
            gs.respond('a', { pay: { WATER: 2 }, gain: { MOUNTAIN: 2 } });
            assert.equal(d.players.a.tokens.SUNSHINE, 1);
        });

        it('Growth bonus Water counts as gained this turn (Reefs → Canteen)', () => {
            const { gs, d } = table(['a', 'b'], undefined, 'reefs');
            d.players.a.canteens = [{ id: 'canteen_mountain_1', filled: false }];
            gs.move_to_site('a', 0, 1);
            assert.equal(d.players.a.tokens.WATER, 1);
            assert.equal(gs.get_prompt()!.kind, 'CANTEEN');
        });

        it('Waves pays Water when you gain a Canteen', () => {
            const { gs, d } = table(['a', 'b'], ['VISTA', 'FOREST', 'MOUNTAIN', 'VALLEY', 'OCEAN', 'LODGE'], 'waves');
            d.players.a.canteens = [];
            gs.move_to_site('a', 0, 1);
            assert.equal(d.players.a.canteens.length, 1);
            assert.equal(gs.get_prompt()!.kind, 'CANTEEN', 'the bonus can fill the new Canteen');
        });

        it('the Trail grows by one Site each Season, with all advanced by Season 4', () => {
            const { gs, d } = table();
            d.trail = ['FOREST', 'MOUNTAIN', 'VALLEY', 'OCEAN', 'VISTA', d.advancedPile[3] || 'RIVER'];
            d.advancedPile = ['WILDLIFE', 'LODGE', 'LOOKOUT'];
            d.trail[5] = 'RIVER';
            d.cameraOwner = null;
            for (let s = 2; s <= 4; s++) {
                for (const id of gs.get_player_order()) d.players[id].hikers = id === d.current ? [END, 0] : [END, END];
                gs.move_to_end(d.current, 1, 'VISIT');
                assert.equal(d.season, s);
                assert.equal(d.trail.length, 5 + s);
                assert.equal(d.weather[0], null);
            }
            assert.deepEqual([...d.trail].sort(), ['FOREST', 'LODGE', 'LOOKOUT', 'MOUNTAIN', 'OCEAN', 'RIVER', 'VALLEY', 'VISTA', 'WILDLIFE']);
        });

        it('the Camera holder is offered a 1-token Photo at Season end', () => {
            const { gs, d } = table();
            d.cameraOwner = 'a';
            give(d, 'a', { WILDLIFE: 1 });
            d.players.a.hikers = [END, END];
            d.players.b.hikers = [END, 0];
            d.current = 'b';
            gs.move_to_end('b', 1, 'VISIT');
            const p = gs.get_prompt()!;
            assert.ok(p.kind === 'PAY' && p.purpose === 'CAMERA' && p.count === 1 && p.playerId === 'a');
            assert.throws(() => gs.respond('b', { skip: true }), /another player/);
            gs.respond('a', { pay: { WILDLIFE: 1 } });
            assert.equal(d.players.a.photos, 1);
            assert.equal(d.season, 2);
        });

        it('the First Hiker starts the new Season', () => {
            const { gs, d } = table();
            d.cameraOwner = null;
            d.firstHikerOwner = 'b';
            d.players.a.hikers = [END, END];
            d.players.b.hikers = [END, END];
            d.players.a.hikers[1] = 0;
            d.current = 'a';
            gs.move_to_end('a', 1, 'VISIT');
            assert.equal(gs.get_current(), 'b');
        });
    });

    // ======================================================================
    describe('Type A: token limit', () => {
        it('discards down to 12 at the end of your own turn', () => {
            const { gs, d } = table();
            give(d, 'a', { SUNSHINE: 12 });
            gs.move_to_site('a', 0, 3);
            const p = gs.get_prompt()!;
            assert.ok(p.kind === 'DISCARD' && p.count === 2);
            assert.throws(() => gs.respond('a', { discard: { SUNSHINE: 1 } }));
            gs.respond('a', { discard: { SUNSHINE: 2 } });
            assert.equal(d.players.a.tokens.SUNSHINE, 12);
            assert.equal(gs.get_current(), 'b');
        });

        it('Water poured into a Canteen does not count', () => {
            const { gs, d } = table(['a', 'b'], ['OCEAN', 'FOREST', 'MOUNTAIN', 'VALLEY', 'VISTA', 'LODGE']);
            give(d, 'a', { SUNSHINE: 11 });
            d.players.a.canteens = [{ id: 'canteen_exchange_1', filled: false }];
            gs.move_to_site('a', 0, 1);
            gs.respond('a', { index: 0 });
            gs.respond('a', { skip: true });
            assert.equal(gs.get_prompt(), null, 'twelve in hand, no discard');
        });
    });

    // ======================================================================
    describe('Type A: scoring', () => {
        const year = (gs: ParksGameState, id: string, y: string) => { gs.get_data().players[id].year = y; };

        it('Year tiers award the highest met, not both', () => {
            const { gs, d } = table();
            year(gs, 'a', 'leaves');
            d.players.a.visited = PARK_CARDS.filter(p => p.cost.FOREST).slice(0, 5).map(p => p.id);
            assert.equal(gs.computeScore('a').year, 0);
            d.players.a.visited = PARK_CARDS.filter(p => p.cost.FOREST).slice(0, 6).map(p => p.id);
            assert.equal(gs.computeScore('a').year, 2);
            d.players.a.visited = PARK_CARDS.filter(p => p.cost.FOREST).slice(0, 8).map(p => p.id);
            assert.equal(gs.computeScore('a').year, 3);
        });

        it('symbols-and-Photos needs both', () => {
            const { gs, d } = table();
            year(gs, 'a', 'peaks');
            d.players.a.visited = ['denali', 'mount_rainier'];
            assert.equal(gs.yearProgress('a', YEAR_CARDS[0]), 7);
            d.players.a.photos = 2;
            assert.equal(gs.computeScore('a').year, 0);
            d.players.a.photos = 3;
            assert.equal(gs.computeScore('a').year, 2);
        });

        it('Year of Gear counts printed cost, Year of Plenty the best single type', () => {
            const { gs, d } = table();
            year(gs, 'a', 'gear');
            d.players.a.gear = ['tent_1', 'journal_forest_1', 'flashlight_1'];
            assert.equal(gs.computeScore('a').year, 2);
            const g2 = table();
            year(g2.gs, 'a', 'plenty');
            g2.d.players.a.visited = ['denali', 'mount_rainier', 'badlands', 'great_sand_dunes'];
            assert.equal(g2.gs.yearProgress('a', YEAR_CARDS[4]), 12);
        });

        it('Year progress uses printed icons regardless of discounts', () => {
            const { gs, d } = table();
            year(gs, 'a', 'surf');
            d.players.a.gear = ['compass_ww_1'];
            d.players.a.visited = ['dry_tortugas'];
            assert.equal(gs.yearProgress('a', YEAR_CARDS[2]), 4);
        });

        it('totals Parks, Photos, Year and the Marker; ties break on Parks visited', () => {
            const { gs, d } = table();
            d.players.a.year = 'gear'; d.players.b.year = 'gear';
            d.players.a.visited = ['denali'];                   // 4
            d.players.b.visited = ['congaree', 'mammoth_cave']; // 4
            d.firstHikerOwner = 'nobody';
            d.season = 4;
            d.cameraOwner = null;
            d.players.a.hikers = [END, END];
            d.players.b.hikers = [END, 0];
            d.current = 'b';
            gs.move_to_end('b', 1, 'VISIT');
            assert.equal(gs.get_phase(), Phase.Over);
            assert.equal(d.scores!.a.total, d.scores!.b.total);
            assert.deepEqual(d.winners, ['b']);
        });

        it('reveals Year cards at game end', () => {
            const { gs, d } = table();
            d.players.a.year = 'gear'; d.players.b.year = 'sun';
            assert.equal(gs.view_for('a').players.b.year, null);
            d.season = 4;
            d.cameraOwner = null;
            d.players.a.hikers = [END, END];
            d.players.b.hikers = [END, 0];
            d.current = 'b';
            gs.move_to_end('b', 1, 'RESERVE');
            gs.respond('b', { source: 'DECK' });
            assert.equal(gs.view_for('a').players.b.year, 'sun');
        });
    });

    // ======================================================================
    describe('Type A: solo', () => {
        const solo = (trail: SiteId[] = ['FOREST', 'MOUNTAIN', 'VALLEY', 'OCEAN', 'VISTA', 'RIVER']) => {
            const gs = fresh(['a'], 9);
            const d = gs.get_data();
            for (const w of d.weather) if (w) d.supply[w] += 1;
            d.trail = trail;
            d.weather = trail.map(() => null);
            d.activeSeason = 'wind';
            d.parkBonus.forEach((b) => { if (b) d.supply[b] += 1; });
            d.parkBonus = [null, null, null];
            return { gs, d, solo: d.solo! };
        };
        const stackDeck = (d: GameStateData, ...ids: string[]) => { d.gearDeck = [...ids].reverse(); };

        it('sets up with Camera, Marker, no Gear and no Waterfall', () => {
            const d = fresh(['a'], 2).get_data();
            assert.equal(d.cameraOwner, 'a');
            assert.equal(d.firstHikerOwner, 'a');
            assert.ok(d.gearBoard.every(s => s.length === 0));
            assert.ok(!d.trail.includes('WATERFALL'));
            assert.equal(d.trail.length, 6);
        });

        it('each player turn reveals Gear by cost and moves a Ranger that far', () => {
            const { gs, d, solo: s } = solo();
            stackDeck(d, 'tent_1', 'flashlight_1');
            gs.move_to_site('a', 0, 1);
            assert.deepEqual(d.gearBoard[2], ['tent_1']);
            assert.equal(s.rangers[0] + s.rangers[1], 3);
            assert.equal(gs.get_current(), 'a');
        });

        it('Hikers ahead: the Front Ranger moves. Otherwise the Back Ranger', () => {
            const a = solo();
            a.solo.rangers = [1, 2];
            a.d.players.a.hikers = [3, 0];
            a.d.players.a.canteens = [];
            stackDeck(a.d, 'flashlight_1');
            a.gs.move_to_site('a', 1, 4);
            assert.equal(a.solo.rangers[1], 5, 'Front Ranger moved, hopping the Hikers on 3 and 4');

            const b = solo();
            b.solo.rangers = [1, 5];
            b.d.players.a.hikers = [2, 0];
            stackDeck(b.d, 'flashlight_1');
            b.gs.move_to_site('a', 1, 1);
            assert.equal(b.solo.rangers[0], 3, 'Back Ranger moved, hopping over the Hiker');
        });

        it('a Ranger skips Sites with Hikers on them', () => {
            const { gs, d, solo: s } = solo();
            s.rangers = [0, 0];
            d.players.a.hikers = [1, 0];
            stackDeck(d, 'flashlight_1');
            gs.move_to_site('a', 1, 2);
            assert.equal(s.rangers[0], 3, 'landed past Hikers on 1 and 2');
        });

        it('your Campfire is needed to share a Site with a Ranger', () => {
            const { gs, solo: s } = solo();
            s.rangers = [2, 0];
            const info = gs.moveOptions('a').hikers[0].sites[2];
            assert.ok(info.ok && info.campfire);
        });

        it('three Weather on the tracker fires the Event, then it rotates', () => {
            const { gs, d, solo: s } = solo();
            s.activeEvent = 'heat_wave';
            s.eventDeck = EVENT_CARDS.map(e => e.id).filter(e => e !== 'heat_wave');
            s.tracker.SUNSHINE = 2;
            d.supply.SUNSHINE -= 2;
            d.weather[0] = 'SUNSHINE';
            d.supply.SUNSHINE -= 1;
            d.players.a.hikers = [3, 0];
            d.players.a.canteens = [];
            s.rangers = [0, 5];
            stackDeck(d, 'flashlight_1');
            const left = d.parksBoard[0];
            gs.move_to_site('a', 0, 4);
            assert.equal(s.rangers[0], 1, 'Ranger reached the Weather');
            assert.equal(s.tracker.SUNSHINE, 0);
            assert.notEqual(d.parksBoard[0], left, 'Heat Wave discarded the left Park');
            assert.equal(d.parksBoard[0], null, 'not refilled until Season end');
            assert.notEqual(s.activeEvent, 'heat_wave');
        });

        it('Ranger slots at Trail End: Marker or block, Camera, Gear shuffle', () => {
            const a = solo();
            a.solo.rangers = [6, 0];
            a.d.players.a.hikers = [6, 0];
            stackDeck(a.d, 'flashlight_1');
            a.gs.move_to_end('a', 0, 'VISIT');
            assert.equal(a.solo.rangers[0], END);
            assert.equal(a.d.trailEnd.firstSlot, 'RANGER');
            assert.equal(a.d.firstHikerOwner, 'RANGER');
            assert.equal(a.d.parksBoard[0], null);

            const b = solo();
            b.solo.rangers = [6, 0];
            b.d.players.a.hikers = [6, 0];
            stackDeck(b.d, 'parkpass_1');
            b.gs.move_to_end('a', 0, 'RESERVE');
            b.gs.respond('a', { skip: true });
            assert.equal(b.d.cameraOwner, null, 'the Camera goes back to the supply');
            assert.equal(b.d.parksBoard[1], null);

            const c = solo();
            c.solo.rangers = [6, 0];
            c.d.players.a.hikers = [6, 0];
            c.d.gearBoard[2] = ['journal_forest_1'];
            stackDeck(c.d, 'tent_1');
            c.gs.move_to_end('a', 0, 'RESERVE');
            c.gs.respond('a', { skip: true });
            assert.deepEqual(c.d.gearBoard[2], []);
            assert.ok(c.d.gearDeck.includes('tent_1') && c.d.gearDeck.includes('journal_forest_1'));

            const e = solo();
            e.solo.rangers = [6, 0];
            e.d.trailEnd.firstSlot = 'a';
            e.d.players.a.hikers = [6, 0];
            stackDeck(e.d, 'flashlight_1');
            e.gs.move_to_end('a', 0, 'VISIT');
            assert.ok(e.d.trailEnd.reserveBlocked, 'Ranger closes Reserve');
            assert.equal(e.gs.moveOptions('a').areas.RESERVE.ok, false);
            assert.throws(() => e.gs.move_to_end('a', 1, 'RESERVE'), /Ranger/);
        });

        it('both Hikers home: Rangers are pulled in without slot actions', () => {
            const { gs, d, solo: s } = solo();
            d.cameraOwner = null;
            d.players.a.hikers = [END, 2];
            s.rangers = [1, 1];
            const board = [...d.parksBoard];
            gs.move_to_end('a', 1, 'VISIT');
            assert.equal(d.season, 2);
            assert.deepEqual(s.rangers, [0, 0]);
            assert.ok(board.every(p => d.parksBoard.includes(p)), 'no Park was closed');
        });

        it('both Rangers home: remaining Hikers arrive together with one action', () => {
            const { gs, d, solo: s } = solo();
            d.cameraOwner = null;
            s.rangers = [END, END];
            d.players.a.hikers = [1, 2];
            assert.ok(gs.moveOptions('a').forcedEnd);
            give(d, 'a', { FOREST: 0 });
            gs.move_to_end('a', 0, 'RESERVE');
            gs.respond('a', { source: 'DECK' });
            assert.equal(d.players.a.reserved.length, 1, 'one action only');
            assert.equal(d.season, 2);
        });

        it('Season end refills Parks the Rangers closed', () => {
            const { gs, d, solo: s } = solo();
            d.parksBoard[0] = null;
            d.parksBoard[2] = null;
            d.cameraOwner = null;
            d.players.a.hikers = [END, 2];
            s.rangers = [1, 1];
            gs.move_to_end('a', 1, 'VISIT');
            assert.ok(d.parksBoard.every(Boolean));
        });

        it('a Ranger holding the Marker denies you its point', () => {
            const { gs, d } = solo();
            d.firstHikerOwner = 'RANGER';
            assert.equal(gs.computeScore('a').marker, 0);
        });
    });

    // ======================================================================
    describe('Type A: full games', () => {
        it('plays random legal games to the end at every player count, conserving every token', () => {
            for (let n = 1; n <= 5; n++) {
                const ids = ['p1', 'p2', 'p3', 'p4', 'p5'].slice(0, n);
                for (let seed = 1; seed <= 12; seed++) {
                    const gs = new ParksGameState(ids);
                    gs.start_game({ seed: seed * 97 + n, firstGame: true });
                    playOut(gs, seed * 13 + n);
                    assert.equal(gs.get_phase(), Phase.Over);
                    const d = gs.get_data();
                    assert.equal(d.season, 4);
                    assert.ok(d.winners!.length >= 1);
                    assert.equal(d.trail.length, n >= 4 ? 10 : 9, 'the last Trail holds every advanced Site');
                }
            }
        }).timeout(60000);

        it('survives a JSON round trip mid-game and continues identically', () => {
            const a = new ParksGameState(['x', 'y', 'z']);
            a.start_game({ seed: 42, firstGame: true });
            const state = { s: 5 };
            for (let i = 0; i < 25; i++) {
                if (a.get_prompt()) answerPrompt(a, state);
                else playTurn(a, state);
            }
            const copy = JSON.parse(JSON.stringify({ data: a.get_data(), playerIds: a.get_player_order() }));
            const b = ParksGameState.from_data(copy.data, copy.playerIds);
            const sa = { s: 777 }, sb = { s: 777 };
            for (let i = 0; i < 40 && a.get_phase() !== Phase.Over; i++) {
                if (a.get_prompt()) { answerPrompt(a, sa); answerPrompt(b, sb); } else { playTurn(a, sa); playTurn(b, sb); }
            }
            assert.deepEqual(JSON.parse(JSON.stringify(b.get_data())), JSON.parse(JSON.stringify(a.get_data())));
        });

        it('an illegal answer leaves the state exactly as it was', () => {
            const { gs, d } = table();
            d.parksBoard = ['olympic', 'zion', 'denali'];
            give(d, 'a', { FOREST: 3 });
            gs.move_to_end('a', 0, 'VISIT');
            const before = JSON.stringify(gs.get_data());
            assert.throws(() => gs.respond('a', { parkId: 'zion', payment: { FOREST: 3 } }));
            assert.equal(JSON.stringify(gs.get_data()), before);
        });
    });

    // ======================================================================
    describe('Type A: Nightfall', () => {
        /** A controlled Nightfall table: known Trail, no Weather, no Tents until a test places them. */
        function nfTable(ids: string[] = ['a', 'b'], trail: SiteId[] = ['FOREST', 'MOUNTAIN', 'VALLEY', 'OCEAN', 'VISTA', 'RIVER'], season = 'splendor') {
            const gs = new ParksGameState(ids);
            gs.start_game({ seed: 7, firstGame: true, nightfall: true });
            const d = gs.get_data();
            for (const w of d.weather) if (w) d.supply[w] += 1;
            for (const b of d.parkBonus) if (b) d.supply[b] += 1;
            d.parkBonus = [null, null, null];
            d.trail = trail;
            d.weather = trail.map(() => null);
            d.current = ids[0];
            d.firstHikerOwner = ids[0];
            d.activeSeason = season;
            d.nightfall!.camps = trail.map(() => false);
            return { gs, d, nf: d.nightfall! };
        }

        it('is off unless the host turns it on', () => {
            const gs = fresh();
            assert.equal(gs.get_data().nightfall, null);
            assert.ok(!gs.get_data().parksDeck.concat(gs.get_data().parksBoard as string[]).some(id => NIGHTFALL_PARK_CARDS.some(p => p.id === id)));
        });

        it('sets up: a Wildlife each, the Nightfall Year deck, Nightfall Parks, three Campsites and the board', () => {
            for (const n of [1, 2, 3, 4, 5]) {
                const ids = ['p1', 'p2', 'p3', 'p4', 'p5'].slice(0, n);
                const gs = new ParksGameState(ids);
                gs.start_game({ seed: 11, nightfall: true });
                const d = gs.get_data();
                const nf = d.nightfall!;
                ids.forEach(id => assert.equal(d.players[id].tokens.WILDLIFE, 1));
                assert.equal(d.supply.WILDLIFE, SUPPLY_START.WILDLIFE + NIGHTFALL_WILDLIFE - n);
                ids.forEach(id => d.players[id].yearOptions.forEach(y => assert.ok(y.startsWith('nf_'), y)));
                assert.equal(nf.yearDeck.length + 2 * n, NIGHTFALL_YEAR_CARDS.length);
                const all = [...d.parksDeck, ...(d.parksBoard as string[])];
                NIGHTFALL_PARK_CARDS.forEach(p => assert.ok(all.includes(p.id), p.id));
                assert.equal(nf.campsites.length, n === 5 ? 4 : 3);
                assert.equal(nf.campsites.some(c => c.tile === 'ranger_station'), n === 5);
                assert.equal(nf.boardSlots, n >= 4 ? 2 : 1);
            }
        });

        it('pitches Tents before Trail End and every other Site back, one more with 4–5 players', () => {
            const three = new ParksGameState(['a', 'b', 'c']);
            three.start_game({ seed: 3, nightfall: true });
            const len3 = three.get_data().trail.length;
            assert.deepEqual(three.get_data().nightfall!.camps.map((c, i) => c ? i : -1).filter(i => i >= 0), [len3 - 5, len3 - 3, len3 - 1]);
            const four = new ParksGameState(['a', 'b', 'c', 'd']);
            four.start_game({ seed: 3, nightfall: true });
            const len4 = four.get_data().trail.length;
            assert.deepEqual(four.get_data().nightfall!.camps.map((c, i) => c ? i : -1).filter(i => i >= 0), [len4 - 5, len4 - 4, len4 - 3, len4 - 1]);
        });

        it('a Tent offers a choice; camping skips the Weather and uses the Campsite up', () => {
            const { gs, d, nf } = nfTable();
            nf.camps[2] = true;
            nf.campsites = [{ tile: 'harvest', taken: false }];
            d.weather[2] = 'WATER'; d.supply.WATER -= 1;
            give(d, 'a', { MOUNTAIN: 1 });
            gs.move_to_site('a', 0, 3);
            assert.equal(gs.get_prompt()!.kind, 'CAMP');
            assert.deepEqual(gs.view_for('a').prompt.options.map((o: any) => o.spot), [0]);
            gs.respond('a', { choice: 0 });
            assert.equal(gs.get_prompt()!.kind, 'NF_PAY');
            assert.throws(() => gs.respond('a', { skip: true }), /at least one/, 'a Campsite chosen must be used');
            gs.respond('a', { token: 'MOUNTAIN' });
            assert.equal(d.players.a.tokens.SUNSHINE, 5);
            assert.equal(d.players.a.tokens.MOUNTAIN, 0);
            assert.equal(d.weather[2], 'WATER', 'the Weather stays for the next Hiker');
            assert.equal(nf.camps[2], false);
            assert.equal(nf.campsites[0].taken, true);
            assert.equal(gs.get_current(), 'b');
            assert.deepEqual(gs.campOptions('b'), [], 'a Campsite takes one Tent a Season');
        });

        it('choosing the Site instead takes its Weather and leaves the Tent', () => {
            const { gs, d, nf } = nfTable();
            nf.camps[2] = true;
            nf.campsites = [{ tile: 'harvest', taken: false }];
            d.weather[2] = 'WATER'; d.supply.WATER -= 1;
            give(d, 'a', { MOUNTAIN: 1 });
            gs.move_to_site('a', 0, 3);
            gs.respond('a', { choice: 'SITE' });
            // the Weather's Water opens the Canteen window before the Site pays out
            if (gs.get_prompt() && gs.get_prompt()!.kind === 'CANTEEN') gs.respond('a', { skip: true });
            assert.equal(d.players.a.tokens.SUNSHINE, 2);
            assert.equal(d.players.a.tokens.WATER, 1);
            assert.equal(nf.camps[2], true);
        });

        it('a Site whose action is impossible is still reachable to camp', () => {
            const { gs, d, nf } = nfTable(['a', 'b'], ['RIVER', 'FOREST', 'MOUNTAIN', 'VALLEY', 'OCEAN', 'VISTA']);
            nf.camps[0] = true;
            nf.campsites = [{ tile: 'spring', taken: false }];
            const info = gs.moveOptions('a').hikers[0].sites[1];
            assert.equal(info.ok, true);
            assert.equal(info.camp, true);
            gs.move_to_site('a', 0, 1);
            assert.equal(gs.view_for('a').prompt.siteOk, false);
            assert.throws(() => gs.respond('a', { choice: 'SITE' }));
            const canteens = d.players.a.canteens.length;
            gs.respond('a', { choice: 0 });
            assert.equal(d.players.a.canteens.length, canteens + 1, 'Spring: a Canteen');
            assert.equal(d.players.a.tokens.WATER, 1, 'and a Water');
        });

        it('Photo Spot: up to two Photos, any token with the Camera', () => {
            const { gs, d, nf } = nfTable();
            nf.camps[1] = true;
            nf.campsites = [{ tile: 'shutter', taken: false }];
            d.cameraOwner = 'a';
            give(d, 'a', { SUNSHINE: 3 });
            gs.move_to_site('a', 0, 2);
            gs.respond('a', { choice: 0 });
            assert.ok(gs.view_for('a').prompt.tokens.includes('SUNSHINE'), 'the Camera lets any token pay');
            gs.respond('a', { token: 'SUNSHINE' });
            assert.equal(gs.get_prompt()!.kind, 'NF_PAY');
            assert.equal((gs.get_prompt() as any).optional, true);
            gs.respond('a', { token: 'SUNSHINE' });
            assert.equal(d.players.a.photos, 2);
            assert.equal(gs.get_prompt(), null, 'two at most');
        });

        it('Animal Tracks: Water for Wildlife up to three times, stopping when you like', () => {
            const { gs, d, nf } = nfTable();
            nf.camps[1] = true;
            nf.campsites = [{ tile: 'tracks', taken: false }];
            give(d, 'a', { WATER: 3 });
            gs.move_to_site('a', 0, 2);
            gs.respond('a', { choice: 0 });
            assert.throws(() => gs.respond('a', { token: 'SUNSHINE' }));
            gs.respond('a', { token: 'WATER' });
            gs.respond('a', { token: 'WATER' });
            gs.respond('a', { skip: true });
            assert.equal(d.players.a.tokens.WILDLIFE, 3);
            assert.equal(d.players.a.tokens.WATER, 1);
        });

        it('the Campsite board: 3 Sunshine for two Year cards, then one goes back to the bottom', () => {
            const { gs, d, nf } = nfTable();
            nf.camps[1] = true;
            nf.campsites = [];
            give(d, 'a', { SUNSHINE: 3 });
            const top = [...nf.yearDeck].reverse().slice(0, 2);
            gs.move_to_site('a', 0, 2);
            gs.respond('a', { choice: 'BOARD' });
            assert.equal(d.players.a.tokens.SUNSHINE, 0);
            assert.deepEqual(gs.get_data().players.a.extraYears, top);
            assert.equal(gs.get_prompt()!.kind, 'NF_YEAR_RETURN');
            const chosen = d.players.a.year!;
            gs.respond('a', { yearId: chosen });
            assert.equal(nf.yearDeck[0], chosen, 'returned face down to the bottom');
            assert.equal(gs.yearsOf('a').length, 2);
            assert.equal(d.players.a.year, top[0], 'the next card held becomes the first');
            assert.equal(nf.boardTaken, 1);
        });

        it('the board pays with Wildlife when Sunshine runs short', () => {
            const { gs, d, nf } = nfTable();
            nf.camps[1] = true;
            nf.campsites = [];
            give(d, 'a', { SUNSHINE: 2 });
            gs.move_to_site('a', 0, 2);
            gs.respond('a', { choice: 'BOARD' });
            assert.equal(d.players.a.tokens.SUNSHINE, 0);
            assert.equal(d.players.a.tokens.WILDLIFE, 0);
        });

        it('Outfitter swap: return a Gear, take the top Year card', () => {
            const { gs, d, nf } = nfTable();
            nf.camps[1] = true;
            nf.campsites = [{ tile: 'outfitter', taken: false }];
            d.players.a.gear = ['flashlight_1'];
            const topYear = nf.yearDeck[nf.yearDeck.length - 1];
            gs.move_to_site('a', 0, 2);
            gs.respond('a', { choice: 0 });
            assert.equal(gs.get_prompt()!.kind, 'NF_SWAP');
            gs.respond('a', { discard: { type: 'GEAR', id: 'flashlight_1' }, take: 'YEAR' });
            assert.deepEqual(d.players.a.gear, []);
            assert.equal(d.gearDeck[0], 'flashlight_1');
            assert.ok(gs.yearsOf('a').includes(topYear));
        });

        it('Outfitter refresh (Seasons 2–3): 2 Sunshine for three fresh Gear, then one free', () => {
            const { gs, d, nf } = nfTable();
            d.season = 2;
            nf.camps[1] = true;
            nf.campsites = [{ tile: 'outfitter', taken: false }];
            give(d, 'a', { SUNSHINE: 2 });
            const old = d.gearBoard.map(s => s[s.length - 1]);
            gs.move_to_site('a', 0, 2);
            gs.respond('a', { choice: 0 });
            assert.equal(gs.get_prompt()!.kind, 'NF_GEAR_PICK');
            old.forEach(id => assert.ok(d.gearDeck.slice(0, 3).includes(id), 'old Gear went to the bottom'));
            const fresh0 = d.gearBoard[0][0];
            gs.respond('a', { take: 0 });
            assert.deepEqual(d.players.a.gear, [fresh0]);
            assert.equal(d.players.a.tokens.SUNSHINE, 0);
        });

        it('Spring (Seasons 3–4) pours Canteen Water back without it counting as gained', () => {
            const { gs, d, nf } = nfTable();
            d.season = 3;
            nf.camps[1] = true;
            nf.campsites = [{ tile: 'spring', taken: false }];
            d.players.a.canteens = [{ id: 'canteen_forest_1', filled: true }, { id: 'canteen_mountain_1', filled: false }];
            d.supply.WATER -= 1;
            gs.move_to_site('a', 0, 2);
            gs.respond('a', { choice: 0 });
            assert.equal(d.players.a.tokens.WATER, 2, 'one poured, one gained');
            assert.equal(d.players.a.canteens[0].filled, false);
            assert.equal(gs.get_prompt()!.kind, 'CANTEEN', 'only the gained Water may fill a Canteen');
        });

        it('the brown square takes any tokens and discounts never cut it', () => {
            assert.ok(coversPayment({ SUNSHINE: 2, ANY: 2 }, { SUNSHINE: 2, FOREST: 1, WATER: 1 }, []));
            assert.ok(coversPayment({ SUNSHINE: 2, ANY: 2 }, { SUNSHINE: 4 }, []));
            assert.ok(coversPayment({ SUNSHINE: 2, ANY: 2 }, { SUNSHINE: 1, WILDLIFE: 1, FOREST: 2 }, []));
            assert.ok(!coversPayment({ SUNSHINE: 2, ANY: 2 }, { SUNSHINE: 1, FOREST: 3 }, []));
            const { gs, d } = nfTable();
            d.players.a.gear = ['compass_ss_1'];
            assert.deepEqual(gs.parkNeed('a', PARK_BY_ID.death_valley), { ANY: 2 });
        });

        it('visit first, then the Instant Action, which may be passed up', () => {
            const { gs, d } = nfTable();
            d.parksBoard = ['death_valley', 'olympic', 'zion'];
            give(d, 'a', { SUNSHINE: 2, FOREST: 2, MOUNTAIN: 1 });
            gs.move_to_end('a', 0, 'VISIT');
            gs.respond('a', { parkId: 'death_valley', payment: { SUNSHINE: 2, FOREST: 2 } });
            assert.deepEqual(d.players.a.visited, ['death_valley']);
            assert.equal(gs.get_prompt()!.kind, 'NF_PAY');
            gs.respond('a', { token: 'MOUNTAIN' });
            assert.equal(d.players.a.photos, 1);
        });

        it('Grand Teton reserves a Park; Hawaiʻi Volcanoes gains 2 Sunshine', () => {
            const { gs, d } = nfTable();
            d.parksBoard = ['grand_teton', 'hawaii_volcanoes', 'zion'];
            give(d, 'a', { FOREST: 1, MOUNTAIN: 1, SUNSHINE: 1 });
            gs.move_to_end('a', 0, 'VISIT');
            gs.respond('a', { parkId: 'grand_teton', payment: { FOREST: 1, MOUNTAIN: 1, SUNSHINE: 1 } });
            assert.equal(gs.get_prompt()!.kind, 'RESERVE');
            gs.respond('a', { source: 1 });
            assert.deepEqual(d.players.a.reserved, ['hawaii_volcanoes']);

            const t2 = nfTable();
            t2.d.parksBoard = ['hawaii_volcanoes', 'olympic', 'zion'];
            give(t2.d, 'a', { MOUNTAIN: 2, WATER: 1 });
            t2.gs.move_to_end('a', 0, 'VISIT');
            t2.gs.respond('a', { parkId: 'hawaii_volcanoes', payment: { MOUNTAIN: 2, WATER: 1 } });
            assert.equal(t2.d.players.a.tokens.SUNSHINE, 2);
        });

        it('all 24 Nightfall Parks are printed cards with an Instant Action and a scene', () => {
            assert.equal(NIGHTFALL_PARK_CARDS.length, 24);
            assert.equal(new Set(NIGHTFALL_PARK_CARDS.map(p => p.id)).size, 24);
            NIGHTFALL_PARK_CARDS.forEach(p => {
                assert.ok(p.instant, p.id);
                assert.ok(PARK_BY_ID[p.id] === p, `${p.id} must not shadow a base Park`);
                assert.ok(PARKS_ICONS[parkIconId(p.id)], `${p.id} scene`);
            });
        });

        /** Visit `parkId` from the board with exactly its printed cost. */
        function visitInstant(parkId: string, pay: Bag, before?: (t: ReturnType<typeof nfTable>) => void) {
            const t = nfTable();
            if (before) before(t);
            t.d.parksBoard = [parkId, 'olympic', 'congaree'];
            give(t.d, 'a', pay);
            t.gs.move_to_end('a', 0, 'VISIT');
            t.gs.respond('a', { parkId, payment: pay });
            return t;
        }

        it('Glacier hands over the Camera', () => {
            const { d } = visitInstant('glacier', { WATER: 2, FOREST: 3 });
            assert.equal(d.cameraOwner, 'a');
        });

        it('Arches draws a Year card to keep', () => {
            let top = '';
            const { gs } = visitInstant('arches_night', { MOUNTAIN: 1, SUNSHINE: 1, FOREST: 4 }, t => { top = t.nf.yearDeck[t.nf.yearDeck.length - 1]; });
            assert.ok(gs.yearsOf('a').includes(top));
            assert.equal(gs.yearsOf('a').length, 2);
        });

        it('Zion takes a face-up Gear free, or may pass', () => {
            const { gs, d } = visitInstant('zion_night', { MOUNTAIN: 2, FOREST: 3 });
            assert.equal(gs.get_prompt()!.kind, 'NF_GEAR_PICK');
            const face = d.gearBoard[1][d.gearBoard[1].length - 1];
            gs.respond('a', { take: 1 });
            assert.deepEqual(d.players.a.gear, [face]);
        });

        it('Pinnacles pitches a Tent at an open Campsite, no Trail Site involved', () => {
            const pay = { MOUNTAIN: 1, SUNSHINE: 1, FOREST: 3 };
            const t = visitInstant('pinnacles', pay, x => {
                x.nf.campsites = [{ tile: 'harvest', taken: false }];
                give(x.d, 'a', { MOUNTAIN: 1 });
            });
            assert.equal(t.gs.get_prompt()!.kind, 'CAMP');
            const v = t.gs.view_for('a').prompt;
            assert.equal(v.site, undefined);
            assert.throws(() => t.gs.respond('a', { choice: 'SITE' }));
            t.gs.respond('a', { choice: 0 });
            t.gs.respond('a', { token: 'MOUNTAIN' });
            assert.equal(t.d.players.a.tokens.SUNSHINE, 5);
            assert.equal(t.gs.get_data().nightfall!.campsites[0].taken, true);
        });

        it('Year cards score per step, every card counts, copies once', () => {
            const { gs, d } = nfTable();
            const a = d.players.a;
            a.visited = ['grand_teton', 'death_valley', 'hawaii_volcanoes'];
            a.year = 'nf_voyager_1';
            a.extraYears = ['nf_voyager_2', 'nf_traveler_1'];
            assert.equal(gs.yearPoints('a', 'nf_voyager_1'), 3, 'three Parks with Instant Actions');
            // Forest 1, Mountain 3, Sunshine 3, Water 1: one full set
            assert.equal(gs.yearPoints('a', 'nf_traveler_1'), 1);
            assert.equal(gs.computeScore('a').year, 4, 'the second Voyager adds nothing');
        });

        it('Year progress reads every Nightfall goal', () => {
            const { gs, d } = nfTable();
            const a = d.players.a;
            a.visited = ['congaree', 'olympic', 'denali', 'zion', 'mammoth_cave'];
            a.photos = 9;
            give(d, 'a', { WATER: 4, SUNSHINE: 3 });
            a.gear = ['tent_1', 'flashlight_1'];
            const at = (kind: string) => gs.yearProgress('a', NIGHTFALL_YEAR_CARDS.find(y => y.kind === kind)!);
            // 2 points: Congaree, Mammoth Cave; 3: Olympic; 4: Denali, Zion
            assert.equal(at('collector'), 1, 'one full set of 2, 3 and 4 point Parks');
            assert.equal(at('photographer'), 9);
            assert.equal(gs.yearPoints('a', 'nf_photographer_1'), 2);
            assert.equal(at('gatherer'), 8, 'four Water, three Sunshine, the starting Wildlife');
            assert.equal(at('preserver'), 1);
            assert.equal(at('planner'), 4);
            // Mountains: Denali 4, Mammoth Cave 2, Zion 1. Forests: Congaree 2, Olympic 3, Zion 1
            assert.equal(at('climber'), 7);
            assert.equal(at('conserver'), 6);
            assert.equal(at('forester'), 3);
        });

        it('choosing a Year card sends the other to the bottom of the deck', () => {
            const gs = new ParksGameState(['a', 'b']);
            gs.start_game({ seed: 5, nightfall: true });
            const d = gs.get_data();
            const [keep, drop] = d.players.a.yearOptions;
            gs.pick_year('a', keep);
            assert.equal(d.nightfall!.yearDeck[0], drop);
            assert.throws(() => gs.pick_year('a', drop), /already/);
        });

        it('a new Season clears the Campsites and pitches fresh Tents', () => {
            const { gs, nf } = nfTable();
            nf.campsites.forEach(c => { c.taken = true; });
            nf.boardTaken = 1;
            (gs as any).pitchCamps();
            assert.ok(nf.campsites.every(c => !c.taken));
            assert.equal(nf.boardTaken, 0);
            assert.equal(nf.camps.filter(Boolean).length, 3);
        });

        it('solo: the back Ranger packs up Tents it passes, and asks when it stops on Weather and a Tent', () => {
            const { gs, d, nf } = nfTable(['solo']);
            d.solo!.rangers = [0, 0];
            nf.camps = [false, true, false, true, false, true];
            (gs as any).moveRanger(0, 3);
            assert.deepEqual(nf.camps, [false, false, false, true, false, true], 'passed over the Tent on Site 2');
            d.weather[3] = 'SUNSHINE'; d.supply.SUNSHINE -= 1;
            (gs as any).moveRanger(1, 4);
            assert.equal(gs.get_prompt()!.kind, 'RANGER_CAMP');
            gs.respond('solo', { choice: 'WEATHER' });
            assert.equal(d.solo!.tracker.SUNSHINE, 1);
            assert.equal(nf.camps[3], true, 'the Tent stays when the Ranger takes the Weather');
        });

        it('each part can be added to the base game on its own', () => {
            const parkIds = (d: GameStateData) => [...d.parksDeck, ...(d.parksBoard as string[])];
            for (const m of NF_MODULES) {
                const gs = new ParksGameState(['a', 'b', 'c', 'd']);
                gs.start_game({ seed: 13, nightfall: { [m.id]: true } });
                const d = gs.get_data();
                const nf = d.nightfall!;
                assert.deepEqual(nf.modules, { ...nfModulesOf(false), [m.id]: true });
                assert.equal(NIGHTFALL_PARK_CARDS.every(p => parkIds(d).includes(p.id)), m.id === 'parks', `${m.id}: Parks`);
                assert.equal(d.players.a.yearOptions.every(y => y.startsWith('nf_')), m.id === 'years', `${m.id}: Year cards`);
                assert.equal(d.players.a.tokens.WILDLIFE, m.id === 'wildlife' ? 1 : 0, `${m.id}: Wildlife`);
                assert.equal(nf.campsites.length > 0 && nf.boardSlots > 0, m.id === 'campsites', `${m.id}: Campsites`);
                assert.equal(nf.camps.some(Boolean), m.id === 'campsites', `${m.id}: Tents`);
            }
        });

        it('without Campsites a Park’s Tent action is never offered', () => {
            const gs = new ParksGameState(['a', 'b']);
            gs.start_game({ seed: 7, nightfall: { parks: true } });
            assert.ok(!gs.nfLegal('a', { kind: 'CAMP' }, gs.get_data().players.a.tokens));
            assert.ok(!gs.nfHas('campsites'));
        });

        it('a save from before parts existed plays all of Nightfall', () => {
            const gs = new ParksGameState(['a', 'b']);
            gs.start_game({ seed: 7, nightfall: true });
            delete gs.get_data().nightfall!.modules;
            assert.deepEqual(gs.nfModules(), nfModulesOf(true));
        });

        it('plays random games to the end with each part alone and in pairs', () => {
            const picks: Partial<NfModules>[] = [
                ...NF_MODULES.map(m => ({ [m.id]: true })),
                { campsites: true, years: true }, { parks: true, wildlife: true }, { campsites: true, parks: true }
            ];
            picks.forEach((pick, k) => {
                for (const n of [1, 2, 4, 5]) {
                    const ids = ['p1', 'p2', 'p3', 'p4', 'p5'].slice(0, n);
                    const gs = new ParksGameState(ids);
                    gs.start_game({ seed: k * 97 + n, nightfall: pick });
                    playOut(gs, k * 13 + n);
                    assert.equal(gs.get_phase(), Phase.Over, JSON.stringify(pick));
                }
            });
        }).timeout(60000);

        it('plays random Nightfall games to the end at every player count, conserving every token', () => {
            for (let n = 1; n <= 5; n++) {
                const ids = ['p1', 'p2', 'p3', 'p4', 'p5'].slice(0, n);
                for (let seed = 1; seed <= 8; seed++) {
                    const gs = new ParksGameState(ids);
                    gs.start_game({ seed: seed * 31 + n, nightfall: true });
                    playOut(gs, seed * 17 + n);
                    assert.equal(gs.get_phase(), Phase.Over);
                    const total = CAMPSITE_TILES.length;
                    assert.ok(total > 0);
                    ids.forEach(id => gs.yearsOf(id).forEach(y => assert.ok(YEAR_BY_ID[y].rate, 'only Nightfall Year cards')));
                }
            }
        }).timeout(60000);
    });

    // ======================================================================
    describe('Type A: Wildlife expansion', () => {
        /** A controlled table with all of Wildlife in the decks, and no Season tokens out yet. */
        function wlTable(ids: string[] = ['a', 'b'], trail: SiteId[] = ['FOREST', 'MOUNTAIN', 'VALLEY', 'OCEAN', 'VISTA', 'RIVER'], season = 'splendor') {
            const gs = new ParksGameState(ids);
            gs.start_game({ seed: 7, firstGame: true, wildlife: true });
            const d = gs.get_data();
            const wl = d.wildlife!;
            for (const w of d.weather) if (w) d.supply[w] += 1;
            for (const b of d.parkBonus) if (b) d.supply[b] += 1;
            [...AREAS.map(a => wl.endBonus[a]), ...wl.gearBonus].forEach((b) => { if (b) d.supply[b] += 1; });
            wl.endBonus = { RESERVE: null, GEAR: null, VISIT: null };
            wl.gearBonus = [null, null, null];
            d.parkBonus = [null, null, null];
            d.trail = trail;
            d.weather = trail.map(() => null);
            d.current = ids[0];
            d.firstHikerOwner = ids[0];
            d.activeSeason = season;
            return { gs, d, wl };
        }
        /** Take a token for a Season slot out of the supply, as setup would. */
        const place = (d: GameStateData, t: Sym): Sym => { d.supply[t] -= 1; return t; };

        it('has the component counts from the photos', () => {
            assert.equal(WL_GEAR_CARDS.length, 16);
            assert.equal(WL_SEASON_CARDS.length, 10);
            assert.equal(WL_CANTEEN_CARDS.length, 12);
            assert.equal(WL_SITES.length, 4);
            const count = (c: number) => WL_GEAR_CARDS.filter(g => g.cost === c).length;
            assert.deepEqual([count(1), count(2), count(3)], [4, 11, 1]);
            assert.equal(Object.keys(GEAR_BY_ID).length, GEAR_CARDS.length + 16, 'Gear ids never collide');
            assert.equal(Object.keys(SEASON_BY_ID).length, 20, 'Season ids never collide');
            assert.equal(Object.keys(CANTEEN_BY_ID).length, 27, 'Canteen ids never collide');
        });

        it('every Wildlife card has its art, theme and icons', () => {
            const iconsOk = (text: string, what: string) => (text.match(/\[icon:([a-z_]+)\]/g) || [])
                .forEach((m: string) => assert.ok(PARKS_ICONS[m.slice(6, -1)], `${what}: ${m}`));
            for (const g of WL_GEAR_CARDS) {
                const def = getGearCardDefinition(g);
                assert.ok(PARKS_ICONS[def.mainArt!.iconId!], `${g.id} has art`);
                iconsOk(def.footer!.text, g.id);
            }
            for (const season of WL_SEASON_CARDS) {
                assert.ok(SEASON_THEMES[season.id], `${season.id} has a theme`);
                iconsOk(seasonEffectLine(season), season.id);
            }
            for (const site of WL_SITES) {
                const def = getSiteCardDefinition(site);
                assert.ok(PARKS_ICONS[def.mainArt!.iconId!], `${site} has a scene`);
                def.data!.rows[0].iconsList!.forEach(i => assert.ok(PARKS_ICONS[i.iconId!], `${site}: ${i.iconId}`));
            }
            for (const c of WL_CANTEEN_CARDS) iconsOk(getCanteenCardDefinition(c.id, c.effect, false).footer!.text, c.id);
        });

        it('each part joins its own deck, and nothing else changes', () => {
            for (const m of WL_MODULES) {
                const gs = new ParksGameState(['a', 'b', 'c']);
                gs.start_game({ seed: 21, wildlife: { [m.id]: true } as Partial<WlModules> });
                const d = gs.get_data();
                assert.deepEqual(d.wildlife!.modules, { ...wlModulesOf(false), [m.id]: true });
                const gear = [...d.gearDeck, ...d.gearBoard.flat()];
                assert.equal(WL_GEAR_CARDS.every(g => gear.includes(g.id)), m.id === 'gear', `${m.id}: Gear`);
                const seasons = [d.activeSeason, ...d.seasonDeck];
                assert.equal(WL_SEASON_CARDS.every(x => seasons.includes(x.id)), m.id === 'seasons', `${m.id}: Seasons`);
                const sites = [...d.trail, ...d.advancedPile];
                assert.equal(WL_SITES.every(x => sites.includes(x)), m.id === 'sites', `${m.id}: Sites`);
                const canteens = [...d.canteenDeck, ...['a', 'b', 'c'].map(id => d.players[id].canteens[0].id)];
                assert.equal(WL_CANTEEN_CARDS.every(c => canteens.includes(c.id)), m.id === 'canteens', `${m.id}: Canteens`);
            }
            assert.equal(fresh().get_data().wildlife, null, 'off unless the host turns it on');
        });

        it('Field Guide: one Wildlife pays for two of its symbol, and never overpays', () => {
            const guide = ['wl_field_guide_water_1'];
            assert.ok(coversPayment({ WATER: 2, FOREST: 1 }, { WILDLIFE: 1, FOREST: 1 }, guide));
            assert.ok(!coversPayment({ WATER: 2, FOREST: 1 }, { WILDLIFE: 1, FOREST: 1 }, []), 'not without the Guide');
            assert.ok(coversPayment({ WATER: 3 }, { WILDLIFE: 2 }, guide), 'a pair, then one more');
            assert.ok(coversPayment({ WATER: 3 }, { WILDLIFE: 1, WATER: 1 }, guide));
            assert.ok(!coversPayment({ WATER: 3 }, { WILDLIFE: 2, WATER: 1 }, guide), 'overpaying is refused');
            assert.ok(!coversPayment({ FOREST: 2 }, { WILDLIFE: 1 }, guide), 'only its own symbol');
            const { gs, d } = wlTable();
            d.players.a.gear = guide;
            give(d, 'a', { WILDLIFE: 1 });
            assert.deepEqual(gs.suggestPayment('a', { WATER: 2 }, d.players.a.tokens), { WILDLIFE: 1 });
        });

        it('Planner: a Wildlife after visiting a reserved Park, not a board one', () => {
            const { gs, d } = wlTable();
            d.players.a.gear = ['wl_planner_1'];
            // one from the deck, so it can't also be face up
            const reserved = d.parksDeck.pop()!;
            d.players.a.reserved = [reserved];
            give(d, 'a', PARK_BY_ID[reserved].cost);
            gs.move_to_end('a', 0, 'VISIT');
            gs.respond('a', { parkId: reserved, payment: PARK_BY_ID[reserved].cost });
            if (gs.get_prompt()) gs.respond('a', { skip: true });
            assert.equal(gs.get_data().players.a.tokens.WILDLIFE, 1);
            const board = d.parksBoard[0]!;
            give(gs.get_data(), 'b', PARK_BY_ID[board].cost);
            gs.get_data().players.b.gear = ['wl_planner_2'];
            gs.move_to_end('b', 0, 'VISIT');
            gs.respond('b', { parkId: board, payment: PARK_BY_ID[board].cost });
            if (gs.get_prompt()) gs.respond('b', { skip: true });
            assert.equal(gs.get_data().players.b.tokens.WILDLIFE, 0, 'nothing for a board Park');
        });

        it('Mystery Cache takes the top Gear card as well', () => {
            const { gs, d } = wlTable();
            d.gearBoard = [['wl_mystery_cache_1'], ['tent_1'], ['journal_forest_1']];
            // the slot refills from the deck first, so the Cache takes the card after that
            const next = d.gearDeck[d.gearDeck.length - 2];
            gs.move_to_end('a', 0, 'GEAR');
            gs.respond('a', { slot: 0 });
            assert.ok(gs.get_data().players.a.gear.includes('wl_mystery_cache_1'));
            assert.ok(gs.get_data().players.a.gear.includes(next), 'and the deck’s top card');
        });

        it('Upgraded Shutter: a Wildlife gained may become a Photo', () => {
            const { gs, d } = wlTable(['a', 'b'], ['WILDLIFE', 'MOUNTAIN', 'VALLEY', 'OCEAN', 'VISTA', 'RIVER']);
            d.players.a.gear = ['wl_upgraded_shutter_1'];
            give(d, 'a', { FOREST: 1 });
            gs.move_to_site('a', 0, 1);
            assert.equal(gs.get_prompt()!.kind, 'SHUTTER');
            gs.respond('a', { swap: 1 });
            const a = gs.get_data().players.a;
            assert.equal(a.tokens.WILDLIFE, 0);
            assert.equal(a.photos, 1);
        });

        it('Lantern: spending your Campfire lets you trade a Mountain for a Wildlife', () => {
            const { gs, d } = wlTable();
            d.players.a.gear = ['wl_lantern_mountain_1'];
            d.players.b.hikers = [1, 0];
            give(d, 'a', { MOUNTAIN: 1 });
            gs.move_to_site('a', 0, 1);
            const pr = gs.get_prompt()!;
            assert.equal(pr.kind, 'NF_PAY');
            gs.respond('a', { token: 'MOUNTAIN' });
            const a = gs.get_data().players.a;
            assert.equal(a.tokens.WILDLIFE, 1);
            assert.equal(a.tokens.FOREST, 1, 'after taking the Site itself');
        });

        it('Hiking Poles: a second Wildlife at the Wildlife Site', () => {
            const { gs, d } = wlTable(['a', 'b'], ['WILDLIFE', 'MOUNTAIN', 'VALLEY', 'OCEAN', 'VISTA', 'RIVER']);
            d.players.a.gear = ['wl_hiking_poles_1'];
            give(d, 'a', { FOREST: 2 });
            gs.move_to_site('a', 0, 1);
            const pr = gs.get_prompt()!;
            assert.ok(pr.kind === 'PAY' && pr.purpose === 'WILD' && pr.optional);
            gs.respond('a', { pay: { FOREST: 1 } });
            assert.equal(gs.get_data().players.a.tokens.WILDLIFE, 2);
        });

        it('Breeze: the first Hiker to a Trail End area takes its Forest', () => {
            const { gs, d, wl } = wlTable(['a', 'b'], undefined, 'breeze');
            wl.endBonus = { RESERVE: place(d, 'FOREST'), GEAR: place(d, 'FOREST'), VISIT: place(d, 'FOREST') };
            gs.move_to_end('a', 0, 'RESERVE');
            if (gs.get_prompt()) gs.respond('a', { skip: true });
            assert.equal(gs.get_data().players.a.tokens.FOREST, 1);
            assert.equal(gs.get_data().wildlife!.endBonus.RESERVE, null);
            assert.equal(gs.get_data().wildlife!.endBonus.GEAR, 'FOREST', 'the others still wait');
        });

        it('Heights: the Mountain on a Gear goes with it', () => {
            const { gs, d, wl } = wlTable(['a', 'b'], undefined, 'heights');
            d.gearBoard = [['trailmap_water_1'], ['tent_1'], ['journal_forest_1']];
            wl.gearBonus = [place(d, 'MOUNTAIN'), place(d, 'MOUNTAIN'), null];
            gs.move_to_end('a', 0, 'GEAR');
            gs.respond('a', { slot: 0 });
            assert.equal(gs.get_data().players.a.tokens.MOUNTAIN, 1);
            assert.equal(gs.get_data().wildlife!.gearBonus[0], null, 'the refilled card arrives bare');
        });

        it('Chance: the Park deck’s top card can be visited, unseen, for one of each', () => {
            const { gs, d } = wlTable(['a', 'b'], undefined, 'chance');
            const top = d.parksDeck[d.parksDeck.length - 1];
            give(d, 'a', { FOREST: 1, MOUNTAIN: 1, SUNSHINE: 1, WATER: 1 });
            gs.move_to_end('a', 0, 'VISIT');
            const deck = gs.visitOptions('a').find(o => o.source === 'DECK')!;
            assert.ok(deck && deck.suggestion);
            gs.respond('a', { parkId: 'DECK', payment: { FOREST: 1, MOUNTAIN: 1, SUNSHINE: 1, WATER: 1 } });
            assert.deepEqual(gs.get_data().players.a.visited, [top]);
        });

        it('Clouds: every Gear costs 1, and the deck’s top card can be bought', () => {
            const { gs, d } = wlTable(['a', 'b'], undefined, 'clouds');
            assert.equal(gs.gearPrice('a', 'tent_1', 1), 1, 'flat, whatever the discounts');
            assert.equal(gs.gearPrice('a', 'trailmap_water_1', 0), 1);
            const top = d.gearDeck[d.gearDeck.length - 1];
            give(d, 'a', { SUNSHINE: 1 });
            gs.move_to_end('a', 0, 'GEAR');
            assert.ok(gs.buyOptions('a', 1).some(o => o.slot === 'DECK' && o.ok));
            gs.respond('a', { slot: 'DECK' });
            assert.ok(gs.get_data().players.a.gear.includes(top));
            assert.equal(gs.get_data().players.a.tokens.SUNSHINE, 0);
        });

        it('Rain or Shine: only reserved Parks cost a Sunshine and a Water less', () => {
            const { gs } = wlTable(['a', 'b'], undefined, 'rain_or_shine');
            const park = PARK_BY_ID.acadia;
            assert.deepEqual(gs.parkNeed('a', park, true), { FOREST: 2 });
            assert.deepEqual(gs.parkNeed('a', park, false), { FOREST: 2, SUNSHINE: 1, WATER: 1 });
        });

        it('Rain Checks and Mists hand out their tokens', () => {
            const rc = wlTable(['a', 'b'], undefined, 'rain_checks');
            rc.gs.move_to_end('a', 0, 'RESERVE');
            rc.gs.respond('a', { source: 0 });
            assert.equal(rc.gs.get_data().players.a.tokens.WATER, 1, 'a Water for reserving');
            const mi = wlTable(['a', 'b'], ['OCEAN', 'MOUNTAIN', 'VALLEY', 'FOREST', 'VISTA', 'RIVER'], 'mists');
            mi.d.players.a.canteens = [{ id: 'canteen_forest_1', filled: false }];
            mi.gs.move_to_site('a', 0, 1);
            mi.gs.respond('a', { index: 0 });
            assert.equal(mi.gs.get_data().players.a.tokens.SUNSHINE, 1, 'a Sunshine for filling');
        });

        it('Sunshine: spending a Campfire gives everyone at that Site a Sunshine', () => {
            const { gs, d } = wlTable(['a', 'b', 'c'], undefined, 'sunshine');
            d.players.b.hikers = [1, 0];
            gs.move_to_site('a', 0, 1);
            const after = gs.get_data();
            assert.equal(after.players.a.tokens.SUNSHINE, 1);
            assert.equal(after.players.b.tokens.SUNSHINE, 1);
            assert.equal(after.players.c.tokens.SUNSHINE, 0, 'not someone elsewhere');
        });

        it('Connecting: joining your own Hiker offers a 1-token Photo', () => {
            const { gs, d } = wlTable(['a', 'b'], undefined, 'connecting');
            d.players.a.hikers = [0, 1];
            gs.move_to_site('a', 0, 1);
            const pr = gs.get_prompt()!;
            assert.ok(pr.kind === 'PAY' && pr.purpose === 'SNAP' && pr.count === 1);
            gs.respond('a', { pay: { FOREST: 1 } });
            assert.equal(gs.get_data().players.a.photos, 1);
        });

        it('Wonder: buying Gear offers a Wildlife for 1 token', () => {
            const { gs, d } = wlTable(['a', 'b'], undefined, 'wonder');
            d.gearBoard = [['trailmap_water_1'], ['tent_1'], ['journal_forest_1']];
            give(d, 'a', { FOREST: 1 });
            gs.move_to_end('a', 0, 'GEAR');
            gs.respond('a', { slot: 0 });
            const pr = gs.get_prompt()!;
            assert.ok(pr.kind === 'PAY' && pr.purpose === 'WILD' && pr.optional);
            gs.respond('a', { pay: { FOREST: 1 } });
            assert.equal(gs.get_data().players.a.tokens.WILDLIFE, 1);
        });

        it('Canyon: a Wildlife for 2 Sunshine and 2 Water', () => {
            const { gs, d } = wlTable(['a', 'b'], ['CANYON', 'MOUNTAIN', 'VALLEY', 'OCEAN', 'VISTA', 'RIVER']);
            assert.ok(!gs.moveOptions('a').hikers[0].sites[1].ok, 'no Wildlife, no Canyon');
            give(d, 'a', { WILDLIFE: 1 });
            gs.move_to_site('a', 0, 1);
            if (gs.get_prompt()) gs.respond('a', { skip: true });
            const t = gs.get_data().players.a.tokens;
            assert.deepEqual([t.WILDLIFE, t.SUNSHINE, t.WATER], [0, 2, 2]);
        });

        it('Summit: a Photo for the token you choose', () => {
            const { gs, d } = wlTable(['a', 'b'], ['SUMMIT', 'MOUNTAIN', 'VALLEY', 'OCEAN', 'VISTA', 'RIVER']);
            assert.ok(!gs.moveOptions('a').hikers[0].sites[1].ok, 'no Photo, no Summit');
            d.players.a.photos = 1; d.photos -= 1;
            gs.move_to_site('a', 0, 1);
            gs.respond('a', { token: 'MOUNTAIN' });
            const a = gs.get_data().players.a;
            assert.equal(a.photos, 0);
            assert.equal(a.tokens.MOUNTAIN, 1);
        });

        it('Parkway: everyone else gains a Sunshine, and you take an empty Site', () => {
            const { gs, d } = wlTable(['a', 'b'], ['PARKWAY', 'FOREST', 'MOUNTAIN', 'VALLEY', 'OCEAN', 'VISTA']);
            d.players.b.hikers = [2, 0];
            gs.move_to_site('a', 0, 1);
            assert.equal(gs.get_data().players.b.tokens.SUNSHINE, 1);
            assert.equal(gs.get_data().players.a.tokens.SUNSHINE, 0, 'not you');
            const slots = gs.view_for('a').prompt.slots;
            assert.ok(!slots.includes(2), 'b is on the Forest');
            gs.respond('a', { slot: 3 });
            assert.equal(gs.get_data().players.a.tokens.MOUNTAIN, 1);
        });

        it('Lake: a filled Canteen pays out again, and stays filled', () => {
            const { gs, d } = wlTable(['a', 'b'], ['LAKE', 'MOUNTAIN', 'VALLEY', 'OCEAN', 'VISTA', 'RIVER']);
            d.players.a.canteens = [{ id: 'canteen_mountain_1', filled: true }];
            d.supply.WATER -= 1;
            gs.move_to_site('a', 0, 1);
            const a = gs.get_data().players.a;
            assert.equal(a.tokens.MOUNTAIN, 1);
            assert.ok(a.canteens[0].filled);
        });

        it('new Canteens: a Mountain for a Photo, or Water straight away', () => {
            const { gs, d } = wlTable(['a', 'b'], ['OCEAN', 'MOUNTAIN', 'VALLEY', 'FOREST', 'VISTA', 'RIVER']);
            d.players.a.canteens = [{ id: 'canteen_mountain_photo_1', filled: false }, { id: 'canteen_water2_1', filled: false }];
            give(d, 'a', { MOUNTAIN: 1 });
            gs.move_to_site('a', 0, 1);
            gs.respond('a', { index: 0 });
            assert.equal(gs.get_prompt()!.kind, 'NF_PAY');
            gs.respond('a', { token: 'MOUNTAIN' });
            assert.equal(gs.get_data().players.a.photos, 1);
            gs.respond('a', { index: 1 });
            assert.equal(gs.get_data().players.a.tokens.WATER, 2, 'both Ocean Water went into Canteens; these two came from one');
        });

        it('plays random games to the end with each part, all of it, and both expansions', () => {
            const picks: { wildlife: boolean | Partial<WlModules>; nightfall?: boolean }[] = [
                ...WL_MODULES.map(m => ({ wildlife: { [m.id]: true } as Partial<WlModules> })),
                { wildlife: true }, { wildlife: true, nightfall: true }
            ];
            picks.forEach((pick, k) => {
                for (const n of [1, 2, 4, 5]) {
                    for (let seed = 1; seed <= 3; seed++) {
                        const ids = ['p1', 'p2', 'p3', 'p4', 'p5'].slice(0, n);
                        const gs = new ParksGameState(ids);
                        gs.start_game({ seed: k * 131 + n * 7 + seed, ...pick });
                        playOut(gs, k * 17 + n + seed * 3);
                        assert.equal(gs.get_phase(), Phase.Over, JSON.stringify(pick));
                    }
                }
            });
        }).timeout(120000);
    });

    // ======================================================================
    describe('Type A: Year card text', () => {
        const year = (id: string) => YEAR_CARDS.find(y => y.id === id)!;

        it('every Season has weather to arrive in', () => {
            for (const s of SEASON_CARDS) assert.ok(SEASON_THEMES[s.id] && SEASON_THEMES[s.id].colors.length > 0, s.id);
        });

        it('every Year card has a full description', () => {
            for (const y of YEAR_CARDS) assert.ok(yearDescription(y).length > y.text.length, y.id);
        });

        it('the next step names both halves of a photo goal', () => {
            assert.equal(yearNextStep(year('peaks'), 2, 1), '4 more Mountain icons and 2 more Photos to reach 2 points');
            assert.equal(yearNextStep(year('peaks'), 6, 2), '1 more Photo to reach 2 points');
        });

        it('the next step moves on once a tier is met', () => {
            assert.equal(yearNextStep(year('ascent'), 3, 0), '2 more Parks worth 4 to 5 to reach 3 points');
            assert.equal(yearNextStep(year('gear'), 9, 0), '1 more Sunshine of Gear to reach 3 points');
        });

        it('a tier missing only its Photos is still the next step', () => {
            assert.equal(yearNextStep(year('sun'), 12, 3), '2 more Photos to reach 3 points');
        });

        it('there is no next step at the top', () => {
            assert.equal(yearNextStep(year('leaves'), 9, 0), null);
            assert.equal(yearNextStep(year('woods'), 10, 5), null);
        });
    });

    // ======================================================================
    describe('Type A: Journal', () => {
        const row = (gs: ParksGameState) => gs.get_last_move()!;
        const rowOf = (gs: ParksGameState, id: string) => [...gs.get_log()].reverse().find(e => e.playerId === id)!;
        const words = (e: { results: { word: string }[] }) => e.results.map(r => r.word);

        it('every hike opens a row on its Site, with the reward as a result', () => {
            const { gs } = table();
            gs.move_to_site('a', 0, 1);
            const e = rowOf(gs, 'a');
            assert.deepEqual(e.dest, [{ kind: 'icon', id: 'arrow' }, { kind: 'site', site: 'FOREST' }]);
            assert.deepEqual(e.results, [{ word: 'gained', items: [{ kind: 'bag', bag: SITES.FOREST.gain }] }]);
        });

        it('a Weather token is logged as the first Hiker\'s bonus', () => {
            const { gs, d } = table();
            d.weather[0] = 'SUNSHINE';
            d.supply.SUNSHINE -= 1;
            gs.move_to_site('a', 0, 1);
            const first = rowOf(gs, 'a').results.find(r => r.word === 'first')!;
            assert.equal(first.bonus, true);
            assert.deepEqual(first.items, [{ kind: 'bag', bag: { SUNSHINE: 1 } }]);
        });

        it('a Season bonus is logged on the same row', () => {
            const { gs } = table(['a', 'b'], ['FOREST', 'MOUNTAIN', 'VALLEY', 'OCEAN', 'VISTA', 'RIVER'], 'growth');
            gs.move_to_site('a', 0, 1);
            const season = rowOf(gs, 'a').results.find(r => r.word === 'season')!;
            assert.equal(season.bonus, true);
            assert.deepEqual(season.items, [{ kind: 'bag', bag: { SUNSHINE: 1 } }]);
        });

        it('a Season token on a Park comes with reserving it', () => {
            const { gs, d } = table();
            d.parksBoard = ['olympic', 'zion', 'denali'];
            d.parkBonus = ['WATER', null, null];
            d.supply.WATER -= 1;
            gs.move_to_end('a', 0, 'RESERVE');
            gs.respond('a', { source: 0 });
            const e = rowOf(gs, 'a');
            assert.deepEqual(e.dest, [{ kind: 'icon', id: 'arrow' }, { kind: 'area', area: 'RESERVE' }]);
            assert.deepEqual(words(e).sort(), ['first', 'reserved', 'season']);
        });

        it('filling a Canteen shows the Canteen and what it paid', () => {
            const { gs, d } = table(['a', 'b'], ['OCEAN', 'FOREST', 'MOUNTAIN', 'VALLEY', 'VISTA', 'RIVER']);
            d.players.a.canteens = [{ id: CANTEEN_CARDS.find(c => c.effect === 'SUNSHINE')!.id, filled: false }];
            gs.move_to_site('a', 0, 1);
            gs.respond('a', { index: 0 });
            const e = rowOf(gs, 'a');
            assert.ok(words(e).includes('filled'));
            assert.ok(e.results.some(r => r.word === 'gained' && r.items.some(i => i.kind === 'bag' && i.bag.SUNSHINE === 2)));
        });

        it('buying first shows the Gear and the Sunshine saved', () => {
            const { gs, d } = table();
            give(d, 'a', { SUNSHINE: 5 });
            d.gearBoard[0] = ['binoculars_forest_1'];
            gs.move_to_end('a', 0, 'GEAR');
            gs.respond('a', { slot: 0 });
            const e = rowOf(gs, 'a');
            assert.ok(e.results.some(r => r.word === 'bought' && r.items.some(i => i.kind === 'gear' && i.id === 'binoculars_forest_1')));
            assert.ok(e.results.some(r => r.word === 'first saved' && r.bonus === true));
        });

        it('a deck reserve shows the Park drawn', () => {
            const { gs, d } = table();
            const top = d.parksDeck[d.parksDeck.length - 1];
            gs.move_to_end('a', 0, 'RESERVE');
            gs.respond('a', { source: 'DECK' });
            const reserved = rowOf(gs, 'a').results.find(r => r.word === 'reserved')!;
            assert.deepEqual(reserved.items, [{ kind: 'park', id: top }]);
        });

        it('a new turn starts a new row', () => {
            const { gs } = table();
            gs.move_to_site('a', 0, 1);
            gs.move_to_site('b', 0, 2);
            const before = gs.get_log().length;
            gs.move_to_site('a', 1, 3);
            assert.equal(gs.get_log().length, before + 1);
            assert.equal(row(gs).playerId, 'a');
        });

        it('every row of every game can be drawn', () => {
            const check = (item: LogItem, text: string) => {
                switch (item.kind) {
                    case 'bag': assert.ok(Object.keys(item.bag).length > 0, text); break;
                    case 'site': assert.ok(SITES[item.site], text); break;
                    case 'park': assert.ok(PARK_BY_ID[item.id], text); break;
                    case 'gear': assert.ok(GEAR_BY_ID[item.id], text); break;
                    case 'canteen': assert.ok(CANTEEN_BY_ID[item.id], text); break;
                    case 'season': assert.ok(SEASON_BY_ID[item.id], text); break;
                    case 'event': assert.ok(EVENT_BY_ID[item.id], text); break;
                    case 'area': assert.ok(AREAS.includes(item.area), text); break;
                    case 'icon': assert.ok(PARKS_ICONS[item.id], text); break;
                }
            };
            for (let n = 1; n <= 5; n++) {
                const ids = ['p1', 'p2', 'p3', 'p4', 'p5'].slice(0, n);
                for (let seed = 1; seed <= 4; seed++) {
                    const gs = new ParksGameState(ids);
                    gs.start_game({ seed: seed * 31 + n, firstGame: true });
                    playOut(gs, seed * 7 + n);
                    for (const e of gs.get_log()) {
                        assert.ok(e.dest || e.results.length > 0, e.text);
                        (e.dest || []).forEach(i => check(i, e.text));
                        e.results.forEach(r => r.items.forEach(i => check(i, e.text)));
                    }
                }
            }
        }).timeout(60000);
    });

    // ======================================================================
    describe('Type A: projection', () => {
        it('only the owner sees their prompt, and moves only on their turn', () => {
            const { gs } = table();
            assert.ok(gs.view_for('a').moves);
            assert.equal(gs.view_for('b').moves, null);
            gs.move_to_end('a', 0, 'RESERVE');
            assert.ok(gs.view_for('a').prompt);
            assert.equal(gs.view_for('b').prompt, null);
        });

        it('never exposes deck orders', () => {
            const v = fresh(['a', 'b']).view_for('a');
            for (const key of ['parksDeck', 'gearDeck', 'canteenDeck']) assert.equal(typeof v[key], 'number');
            assert.equal(v.seasonDeck, undefined);
            assert.equal(GEAR_BY_ID[v.gearBoard[0]].id, v.gearBoard[0]);
        });
    });

    // ======================================================================
    describe('Type B: integration', () => {
        const start = (clients: number) => {
            const test = new GameRuleTest('parks', clients);
            test.invokeHostMethod('startGame');
            return test;
        };

        it('deals a game and pushes each client their own view', () => {
            const test = start(2);
            const raw = test.getHostData('gameState');
            const gs = raw.get_data ? raw : ParksGameState.from_data(raw.data, raw.playerIds);
            assert.equal(gs.get_player_order().length, 3);
            assert.equal(gs.get_phase(), Phase.Year);
        });

        it('runs a client action through the host', () => {
            const test = start(1);
            const gsOf = () => test.getHostData('gameState');
            const raw = gsOf();
            const ids: string[] = raw.playerIds;
            const hostId = ids[0];
            const clientId = ids[1];
            const d = () => gsOf().get_data ? gsOf().get_data() : gsOf().data;

            test.invokeHostMethod('pickYear', d().players[hostId].yearOptions[0]);
            test.invokeClientMethod(0, 'pickYear', d().players[clientId].yearOptions[0]);
            assert.equal(d().phase, Phase.Play);

            const current: string = d().current;
            const move = (name: string, ...args: any[]) => {
                if (current === hostId) test.invokeHostMethod(name, ...args);
                else test.invokeClientMethod(0, name, ...args);
            };
            move('moveToEnd', 0, 'RESERVE');
            assert.equal(d().players[current].hikers[0], END);
            assert.equal(d().prompt.kind, 'RESERVE');
            move('respond', { source: 'DECK' });
            assert.equal(d().players[current].reserved.length, 1);
            assert.notEqual(d().current, current, 'turn passed');
        });

        it('solo starts with one player', () => {
            const test = start(0);
            const raw = test.getHostData('gameState');
            const d = raw.get_data ? raw.get_data() : raw.data;
            assert.ok(d.solo);
        });

        it('only the host can restart', () => {
            const test = start(1);
            assert.throws(() => test.invokeClientMethod(0, 'restartGame'));
        });
    });
});
