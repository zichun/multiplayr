/**
 * test_moonrollers.ts - Tests for Moonrollers (2-5 players).
 * Type A: pure MoonrollersGameState logic. Type B: Multiplayr room simulation.
 *
 * Determinism: most tests inject a known rolling pool via get_data/from_data and never
 * re-roll. The few paths that re-roll (bust-on-reroll, turn-start auto-roll) stub
 * Math.random through `withRandom`.
 */

import { describe, it } from 'mocha';
import { strict as assert } from 'assert';
import {
    MoonrollersGameState as GameState, GameStatus, getAllCrew, ABILITIES, FACTIONS,
    CrewCard, DisplayCard, DieSymbol, ReqType, HazardToken, DIE_FACES
} from '../../rules/moonrollers/MoonrollersGameState';
import { GameRuleTest } from '../GameRuleTest';

// --- helpers ---------------------------------------------------------------
const FACE_INDEX: Record<DieSymbol, number> = {
    DAMAGE: DIE_FACES.indexOf('DAMAGE'), REACTOR: DIE_FACES.indexOf('REACTOR'),
    THRUSTER: DIE_FACES.indexOf('THRUSTER'), SHIELD: DIE_FACES.indexOf('SHIELD'),
    WILD: DIE_FACES.indexOf('WILD'), EXTRA: DIE_FACES.indexOf('EXTRA')
};
function withRandom<T>(face: DieSymbol, fn: () => T): T {
    const orig = Math.random;
    // Return the midpoint of the target face's 1/6 bucket so floor(r*6) hits it.
    Math.random = () => (FACE_INDEX[face] + 0.5) / DIE_FACES.length;
    try { return fn(); } finally { Math.random = orig; }
}

function mkCard(id: string, faction: any, reqs: Array<{ type: ReqType; count: number; hazard?: boolean }>, abilityId = '', starting = false): CrewCard {
    return {
        id, name: id, faction, isStartingCrew: starting, abilityId, abilityText: '',
        requirements: reqs.map((r, i) => ({ index: i, type: r.type, count: r.count, hazard: !!r.hazard }))
    };
}
function dcard(card: CrewCard): DisplayCard {
    return { card, reqStates: card.requirements.map(() => ({ status: 'OPEN', owner: null, placedThisTurn: false })) };
}
function pool(faces: DieSymbol[]) {
    return faces.map((f, i) => ({ id: `t${i}`, face: f }));
}

// Start a game, then overwrite the display + rolling pool for a deterministic turn.
function scenario(players: string[], opts: {
    display?: DisplayCard[]; faces: DieSymbol[]; current?: string;
    hired?: Record<string, CrewCard[]>; hazards?: Record<string, HazardToken[]>;
}): GameState {
    const g = new GameState(players);
    g.start_game(players[0]);
    const d = g.get_data();
    if (opts.display) d.display = opts.display;
    d.currentPlayerId = opts.current || d.currentPlayerId;
    d.rollingPool = pool(opts.faces);
    d.supplyCount = 12 - opts.faces.length;
    d.lockedCount = 0;
    d.step = 'CHOOSE';
    d.chosenCardIndex = null; d.committedReqIndex = null; d.committedProgress = 0;
    d.lockedThisRoll = 0; d.rolledOnce = false; d.pendingHazards = [];
    if (opts.hired) for (const pid in opts.hired) d.players[pid].hired = opts.hired[pid];
    if (opts.hazards) for (const pid in opts.hazards) d.players[pid].hazardTokens = opts.hazards[pid];
    return GameState.from_data(d, players);
}

const HAZ = (prestige: 1 | 2 | 5, hazards: 0 | 1 | 2, id = 'h'): HazardToken => ({ id, prestige, hazards });

describe('Moonrollers Game Logic', () => {
    describe('Type A: MoonrollersGameState Unit Tests', () => {

        describe('Dataset integrity', () => {
            it('has 30 crew across 5 factions of 6, with 5 converter starters', () => {
                const crew = getAllCrew();
                assert.strictEqual(crew.length, 30);
                for (const f of FACTIONS) {
                    assert.strictEqual(crew.filter(c => c.faction === f).length, 6, `${f} should have 6 crew`);
                }
                const starters = crew.filter(c => c.isStartingCrew);
                assert.strictEqual(starters.length, 5);
                // Exactly one starter per faction, each an extra-convert ability.
                for (const f of FACTIONS) {
                    const s = starters.filter(c => c.faction === f);
                    assert.strictEqual(s.length, 1, `${f} has one starter`);
                    assert.strictEqual(ABILITIES[s[0].abilityId].kind, 'extra_convert');
                }
                // Every crew has 3 or 4 requirements and a real ability entry.
                for (const c of crew) {
                    assert.ok(c.requirements.length === 3 || c.requirements.length === 4, `${c.id} req count`);
                    assert.ok(ABILITIES[c.abilityId], `${c.id} has an ability def`);
                }
            });
        });

        describe('Setup', () => {
            it('deals distinct-faction displays for 2p/3p and one starter each', () => {
                for (const [players, size] of [[['a', 'b'], 4], [['a', 'b', 'c'], 5]] as Array<[string[], number]>) {
                    const g = new GameState(players);
                    g.start_game('a');
                    const d = g.get_data();
                    assert.strictEqual(d.status, GameStatus.Active);
                    assert.strictEqual(d.display.length, size);
                    const factions = d.display.map(dc => dc.card.faction);
                    assert.strictEqual(new Set(factions).size, factions.length, 'no duplicate factions');
                    for (const pid of players) assert.strictEqual(d.players[pid].hired.length, 1, 'one starter each');
                    assert.strictEqual(d.hazardBag.length + 0, 45, 'hazard bag has 45 tokens');
                }
            });

            it('backfills activeByFaction/pendingAbilityFaction for states from an older build', () => {
                const g = new GameState(['p0', 'p1']);
                g.start_game('p0');
                const d = g.get_data();
                for (const pid of d.playerIds) delete (d.players[pid] as any).activeByFaction;
                delete (d as any).pendingAbilityFaction;
                const g2 = GameState.from_data(d, ['p0', 'p1']);
                const d2 = g2.get_data();
                for (const pid of d2.playerIds) assert.ok(d2.players[pid].activeByFaction, 'activeByFaction present');
                assert.strictEqual(d2.pendingAbilityFaction, null);
                assert.doesNotThrow(() => g2.active_abilities('p0'));
            });

            it('deals 6 cards with every faction present for 4-5p', () => {
                const g = new GameState(['a', 'b', 'c', 'd']);
                g.start_game('a');
                const d = g.get_data();
                assert.strictEqual(d.display.length, 6);
                const factions = new Set(d.display.map(dc => dc.card.faction));
                assert.strictEqual(factions.size, 5, 'all five factions represented');
            });
        });

        describe('Commit / lock / complete', () => {
            it('completes a requirement across locks and offers a decision', () => {
                const card = mkCard('c1', 'REACTOR', [{ type: 'REACTOR', count: 2 }, { type: 'SHIELD', count: 1 }]);
                const g = scenario(['p0', 'p1'], { display: [dcard(card)], faces: ['REACTOR', 'REACTOR'] });
                g.choose_card('p0', 0);
                g.commit('p0', 0);
                g.lock_die('p0', 0);
                g.lock_die('p0', 0); // second REACTOR (indices shift after splice)
                const d = g.get_data();
                assert.strictEqual(d.display[0].reqStates[0].status, 'COMPLETED');
                assert.strictEqual(d.display[0].reqStates[0].owner, 'p0');
                assert.strictEqual(d.committedReqIndex, null);
                assert.strictEqual(d.step, 'DECIDE');
            });

            it('rollId bumps on every full pool roll (drives the roll animation)', () => {
                const card = mkCard('c1', 'SHIELD', [{ type: 'SHIELD', count: 3 }]);
                const g = scenario(['p0', 'p1'], { display: [dcard(card)], faces: ['SHIELD', 'SHIELD'] });
                const before = g.get_data().rollId;
                g.choose_card('p0', 0);
                g.commit('p0', 0);
                g.lock_die('p0', 0);
                withRandom('SHIELD', () => g.roll_again('p0'));
                assert.ok(g.get_data().rollId > before, 'rollId increased on the re-roll');
            });

            it('a Wild face locks onto a normal requirement', () => {
                const card = mkCard('c1', 'SHIELD', [{ type: 'SHIELD', count: 1 }, { type: 'REACTOR', count: 1 }]);
                const g = scenario(['p0', 'p1'], { display: [dcard(card)], faces: ['WILD'] });
                g.choose_card('p0', 0);
                g.commit('p0', 0);
                g.lock_die('p0', 0);
                assert.strictEqual(g.get_data().display[0].reqStates[0].status, 'COMPLETED');
            });

            it('a Wild-type requirement only accepts a real Wild and pays double', () => {
                const card = mkCard('w1', 'WILD', [{ type: 'WILD', count: 2 }]);
                const g = scenario(['p0', 'p1'], { display: [dcard(card)], faces: ['WILD', 'WILD'] });
                g.choose_card('p0', 0);
                g.commit('p0', 0);
                g.lock_die('p0', 0);
                g.lock_die('p0', 0); // completes the only (last) req → resolve → hire + pay 2×2
                const d = g.get_data();
                assert.strictEqual(d.players['p0'].prestige, 4, 'WILD req pays 2× its count');
                assert.ok(d.players['p0'].hired.some(c => c.id === 'w1'), 'finisher hires the crew');
            });
        });

        describe('Re-selection before locking', () => {
            it('lets a player switch Crew before locking any die', () => {
                const a = mkCard('a', 'REACTOR', [{ type: 'REACTOR', count: 1 }]);
                const b = mkCard('b', 'SHIELD', [{ type: 'SHIELD', count: 1 }]);
                const g = scenario(['p0', 'p1'], { display: [dcard(a), dcard(b)], faces: ['REACTOR', 'SHIELD'] });
                g.choose_card('p0', 0);
                g.commit('p0', 0);      // token placed on card a
                g.choose_card('p0', 1); // switch Crew before any lock
                const d = g.get_data();
                assert.strictEqual(d.chosenCardIndex, 1);
                assert.strictEqual(d.step, 'COMMIT');
                assert.strictEqual(d.committedReqIndex, null);
                assert.strictEqual(d.display[0].reqStates[0].status, 'OPEN', 'the token on card a is returned');
            });

            it('lets a player re-pick the requirement before locking', () => {
                const c = mkCard('c', 'REACTOR', [{ type: 'REACTOR', count: 1 }, { type: 'SHIELD', count: 1 }]);
                const g = scenario(['p0', 'p1'], { display: [dcard(c)], faces: ['REACTOR', 'SHIELD'] });
                g.choose_card('p0', 0);
                g.commit('p0', 0);      // REACTOR req
                g.commit('p0', 1);      // switch to SHIELD req before locking
                const d = g.get_data();
                assert.strictEqual(d.display[0].reqStates[0].status, 'OPEN');
                assert.strictEqual(d.display[0].reqStates[1].status, 'COMMITTED');
                assert.strictEqual(d.committedReqIndex, 1);
            });

            it('locks in the Crew and requirement once a die is locked', () => {
                const a = mkCard('a', 'REACTOR', [{ type: 'REACTOR', count: 2 }]);
                const b = mkCard('b', 'SHIELD', [{ type: 'SHIELD', count: 1 }]);
                const g = scenario(['p0', 'p1'], { display: [dcard(a), dcard(b)], faces: ['REACTOR', 'REACTOR'] });
                g.choose_card('p0', 0);
                g.commit('p0', 0);
                g.lock_die('p0', 0); // progress 1/2 — now committed for real
                assert.throws(() => g.choose_card('p0', 1), /already started/);
                assert.throws(() => g.commit('p0', 0), /not choosing a requirement/);
            });
        });

        describe('Stop vs Bust asymmetry', () => {
            it('Stop keeps this-turn completions and passes the turn', () => {
                const card = mkCard('c1', 'REACTOR', [{ type: 'REACTOR', count: 1 }, { type: 'SHIELD', count: 1 }]);
                const g = scenario(['p0', 'p1'], { display: [dcard(card)], faces: ['REACTOR'] });
                g.choose_card('p0', 0);
                g.commit('p0', 0);
                g.lock_die('p0', 0); // completes REACTOR (not last — SHIELD open) → DECIDE
                withRandom('WILD', () => g.stop('p0'));
                const d = g.get_data();
                assert.strictEqual(d.display[0].reqStates[0].status, 'COMPLETED');
                assert.strictEqual(d.display[0].reqStates[0].owner, 'p0');
                assert.strictEqual(d.display[0].reqStates[0].placedThisTurn, false, 'flag cleared after turn');
                assert.strictEqual(d.currentPlayerId, 'p1');
            });

            it('Bust wipes this-turn tokens but keeps a prior player\'s completion', () => {
                // R:1 (p0 will complete), S:2 (p1 will bust on), D:1 (lets p0's next roll be playable).
                const card = mkCard('c1', 'REACTOR', [{ type: 'REACTOR', count: 1 }, { type: 'SHIELD', count: 2 }, { type: 'DAMAGE', count: 1 }]);
                let g = scenario(['p0', 'p1'], { display: [dcard(card)], faces: ['REACTOR'] });
                // p0 completes the REACTOR requirement and stops.
                g.choose_card('p0', 0);
                g.commit('p0', 0);
                g.lock_die('p0', 0);
                withRandom('WILD', () => g.stop('p0'));

                // p1's turn: commit the SHIELD req, lock 1, then bust on the re-roll.
                let d = g.get_data();
                d.currentPlayerId = 'p1'; d.rollingPool = pool(['SHIELD', 'SHIELD']); d.supplyCount = 10;
                d.step = 'CHOOSE'; d.chosenCardIndex = null; d.committedReqIndex = null;
                d.committedProgress = 0; d.lockedThisRoll = 0; d.rolledOnce = false;
                d.players['p1'].hired = []; // no rescue abilities
                g = GameState.from_data(d, ['p0', 'p1']);
                g.choose_card('p1', 0);
                g.commit('p1', 1);
                g.lock_die('p1', 0);      // SHIELD progress 1/2
                // Re-roll to DAMAGE: p1 can't lock SHIELD → bust; p0's opening roll (also
                // DAMAGE under the stub) can commit to the open DAMAGE requirement.
                withRandom('DAMAGE', () => g.roll_again('p1'));

                d = g.get_data();
                assert.strictEqual(d.display[0].reqStates[0].status, 'COMPLETED', 'p0 completion survives');
                assert.strictEqual(d.display[0].reqStates[0].owner, 'p0');
                assert.strictEqual(d.display[0].reqStates[1].status, 'OPEN', 'p1 committed token removed');
                assert.strictEqual(d.currentPlayerId, 'p0', 'turn passes back to p0');
            });

            it('Namari grants +2 Prestige after a bust', () => {
                // WILD:2 (p0 busts on after locking one real Wild), DAMAGE:1 (keeps p1's opening roll playable).
                const card = mkCard('c1', 'WILD', [{ type: 'WILD', count: 2 }, { type: 'DAMAGE', count: 1 }]);
                const namari = mkCard('namari', 'SHIELD', [{ type: 'SHIELD', count: 1 }], 'namari');
                const g = scenario(['p0', 'p1'], {
                    display: [dcard(card)], faces: ['WILD', 'DAMAGE'], hired: { p0: [namari] }
                });
                g.choose_card('p0', 0);
                g.commit('p0', 0);   // WILD requirement
                g.lock_die('p0', 0); // lock the real Wild → 1/2
                // Lone remaining die re-rolls to DAMAGE — a WILD req takes only real Wilds → bust.
                withRandom('DAMAGE', () => g.roll_again('p0'));
                const d = g.get_data();
                assert.strictEqual(d.players['p0'].prestige, 2);
                assert.strictEqual(d.currentPlayerId, 'p1');
            });
        });

        describe('Full card completion, hiring & prestige payout', () => {
            it('pays every contributor and hires to the finisher', () => {
                const card = mkCard('c1', 'REACTOR', [{ type: 'REACTOR', count: 1 }, { type: 'SHIELD', count: 1 }]);
                // Pre-seed p1 as owner of a completed REACTOR requirement (a prior turn).
                const dc = dcard(card);
                dc.reqStates[0] = { status: 'COMPLETED', owner: 'p1', placedThisTurn: false };
                const g = scenario(['p0', 'p1'], { display: [dc], faces: ['SHIELD'] });
                g.choose_card('p0', 0);
                g.commit('p0', 1);
                g.lock_die('p0', 0); // completes SHIELD (last open) → resolve
                const d = g.get_data();
                assert.strictEqual(d.players['p1'].prestige, 1, 'p1 scores their REACTOR:1');
                assert.strictEqual(d.players['p0'].prestige, 1, 'p0 scores their SHIELD:1');
                assert.ok(d.players['p0'].hired.some(c => c.id === 'c1'), 'p0 (finisher) hires');
            });
        });

        describe('Faction stacks (duplicate recruit)', () => {
            it('prompts an ability choice, honours it over the newer crew, and can return a Hazard', () => {
                const solo = mkCard('r_solo', 'REACTOR', [{ type: 'REACTOR', count: 1 }], 'salatar');       // newly recruited
                const prev = mkCard('r_prev', 'REACTOR', [{ type: 'REACTOR', count: 1 }], 'vila_noir');      // already held
                let g = scenario(['p0', 'p1'], {
                    display: [dcard(solo)], faces: ['REACTOR'],
                    hired: { p0: [prev] }, hazards: { p0: [HAZ(5, 2, 'hx')] }
                });
                // Make the previously-held Reactor crew the active one.
                let d = g.get_data();
                d.players['p0'].activeByFaction = { REACTOR: 'r_prev' };
                g = GameState.from_data(d, ['p0', 'p1']);

                g.choose_card('p0', 0);
                g.commit('p0', 0);
                g.lock_die('p0', 0); // completes solo → recruit 2nd Reactor → stack choice
                d = g.get_data();
                assert.strictEqual(d.step, 'CHOOSE_ABILITY');
                assert.strictEqual(d.pendingAbilityFaction, 'REACTOR');
                const bagBefore = d.hazardBag.length;

                // Keep the OLDER crew's ability (not the just-recruited one) and return a Hazard.
                withRandom('WILD', () => g.resolve_duplicate('p0', 'r_prev', 'hx'));
                d = g.get_data();
                assert.strictEqual(d.players['p0'].activeByFaction['REACTOR'], 'r_prev');
                const active = g.active_abilities('p0').map(a => a.id);
                assert.ok(active.includes('vila_noir'), 'the chosen (older) ability is active');
                assert.ok(!active.includes('salatar'), 'the newer ability is covered');
                assert.strictEqual(d.players['p0'].hazardTokens.length, 0, 'the Hazard token was returned');
                assert.strictEqual(d.hazardBag.length, bagBefore + 1);
                assert.strictEqual(d.currentPlayerId, 'p1', 'turn advances after the choice');
            });
        });

        describe('Win conditions', () => {
            it('ends immediately on a third crew of one faction', () => {
                const solo = mkCard('solo', 'REACTOR', [{ type: 'REACTOR', count: 1 }]);
                const r1 = mkCard('r1', 'REACTOR', [{ type: 'REACTOR', count: 1 }], 'salatar');
                const r2 = mkCard('r2', 'REACTOR', [{ type: 'REACTOR', count: 1 }], 'vila_noir');
                const g = scenario(['p0', 'p1'], { display: [dcard(solo)], faces: ['REACTOR'], hired: { p0: [r1, r2] } });
                g.choose_card('p0', 0);
                g.commit('p0', 0);
                g.lock_die('p0', 0);
                const d = g.get_data();
                assert.strictEqual(d.status, GameStatus.GameOver);
                assert.ok(d.winnerIds!.includes('p0'));
            });

            it('ends immediately on one crew of each of the five factions', () => {
                const wildSolo = mkCard('wsolo', 'WILD', [{ type: 'REACTOR', count: 1 }]);
                const four = [
                    mkCard('a', 'REACTOR', [{ type: 'REACTOR', count: 1 }], 'salatar'),
                    mkCard('b', 'SHIELD', [{ type: 'SHIELD', count: 1 }], 'namari'),
                    mkCard('c', 'DAMAGE', [{ type: 'DAMAGE', count: 1 }], 'kary_powalk'),
                    mkCard('d', 'THRUSTER', [{ type: 'THRUSTER', count: 1 }], 'kal_damar')
                ];
                const g = scenario(['p0', 'p1'], { display: [dcard(wildSolo)], faces: ['REACTOR'], hired: { p0: four } });
                g.choose_card('p0', 0);
                g.commit('p0', 0);
                g.lock_die('p0', 0);
                const d = g.get_data();
                assert.strictEqual(d.status, GameStatus.GameOver);
                assert.ok(d.winnerIds!.includes('p0'));
            });
        });

        describe('Hazards', () => {
            it('draws 2 and keeps 1 when a Hazard-flagged requirement completes', () => {
                const card = mkCard('c1', 'REACTOR', [{ type: 'REACTOR', count: 1, hazard: true }, { type: 'SHIELD', count: 1 }]);
                const g = scenario(['p0', 'p1'], { display: [dcard(card)], faces: ['REACTOR'] });
                g.choose_card('p0', 0);
                g.commit('p0', 0);
                g.lock_die('p0', 0); // completes hazard req → HAZARD step
                let d = g.get_data();
                assert.strictEqual(d.step, 'HAZARD');
                assert.strictEqual(d.pendingHazards.length, 2);
                const bagBefore = d.hazardBag.length;
                g.keep_hazard('p0', 0);
                d = g.get_data();
                assert.strictEqual(d.players['p0'].hazardTokens.length, 1, 'kept one token');
                assert.strictEqual(d.hazardBag.length, bagBefore + 1, 'the other returns to the bag');
                assert.strictEqual(d.step, 'DECIDE');
            });
        });

        describe('Abilities', () => {
            it('extra-convert (Ada Massa) locks an Extra Die as 2 Reactors', () => {
                const ada = getAllCrew().find(c => c.id === 'ada_massa')!;
                const card = mkCard('c1', 'REACTOR', [{ type: 'REACTOR', count: 2 }]);
                const g = scenario(['p0', 'p1'], { display: [dcard(card)], faces: ['EXTRA'], hired: { p0: [ada] } });
                const aff = g.affordances('p0');
                assert.ok(aff.committable.some(c => c.reqIndex === 0), 'req is committable via the converter');
                g.choose_card('p0', 0);
                g.commit('p0', 0);
                g.ability_extra_lock('p0', 0); // EXTRA → 2 REACTOR → completes count-2 → hire
                assert.ok(g.get_data().players['p0'].hired.some(c => c.id === 'c1'));
            });

            it('retag (Lee Van Cribb) locks a lone Reactor as a Wild onto another type', () => {
                const lee = getAllCrew().find(c => c.id === 'lee_van_cribb')!;
                const card = mkCard('c1', 'SHIELD', [{ type: 'SHIELD', count: 1 }]);
                const g = scenario(['p0', 'p1'], { display: [dcard(card)], faces: ['REACTOR'], hired: { p0: [lee] } });
                g.choose_card('p0', 0);
                g.commit('p0', 0);
                g.ability_retag('p0', 0); // lone REACTOR → Wild
                g.lock_die('p0', 0);      // Wild locks onto SHIELD:1 → hire
                assert.ok(g.get_data().players['p0'].hired.some(c => c.id === 'c1'));
            });
        });

        describe('Manual abilities', () => {
            const crewById = (id: string) => getAllCrew().find(c => c.id === id)!;

            it('pool doubler (Aponi): a lock counts double when the pool is 1–3 dice', () => {
                const card = mkCard('c', 'SHIELD', [{ type: 'REACTOR', count: 2 }]); // Reactor req on a Shield card (no duplicate)
                const g = scenario(['p0', 'p1'], { display: [dcard(card)], faces: ['REACTOR'], hired: { p0: [crewById('aponi')] } });
                g.choose_card('p0', 0);
                g.commit('p0', 0);
                withRandom('WILD', () => g.lock_die('p0', 0)); // pool size 1 ≤3 → +2 → completes count-2 in one die
                assert.ok(g.get_data().players['p0'].hired.some(c => c.id === 'c'), 'recruited via the doubled lock');
            });

            it('draw_hazard (Imdar Shade): rolling no Shields draws a Hazard token', () => {
                const card = mkCard('c', 'REACTOR', [{ type: 'REACTOR', count: 2 }]);
                const g = scenario(['p0', 'p1'], { display: [dcard(card)], faces: ['DAMAGE', 'REACTOR'], hired: { p0: [crewById('imdar_shade')] } });
                g.choose_card('p0', 0);
                g.commit('p0', 0);
                const bag = g.get_data().hazardBag.length;
                g.use_ability('p0', 'imdar_shade');
                const d = g.get_data();
                assert.strictEqual(d.players['p0'].hazardTokens.length, 1);
                assert.strictEqual(d.hazardBag.length, bag - 1);
            });

            it('pull_supply (Saghari): rolling no Damage pulls a die and keeps a Wild', () => {
                const card = mkCard('c', 'SHIELD', [{ type: 'SHIELD', count: 2 }]);
                const g = scenario(['p0', 'p1'], { display: [dcard(card)], faces: ['SHIELD', 'REACTOR'], hired: { p0: [crewById('saghari')] } });
                g.choose_card('p0', 0);
                g.commit('p0', 0);
                const b = g.get_data();
                withRandom('WILD', () => g.use_ability('p0', 'saghari'));
                const d = g.get_data();
                assert.strictEqual(d.rollingPool.length, b.rollingPool.length + 1);
                assert.strictEqual(d.supplyCount, b.supplyCount - 1);
                assert.ok(d.rollingPool.some(x => x.face === 'WILD'));
            });

            it('pull_supply: an unkept pull is a transient die that dismiss returns to supply', () => {
                const card = mkCard('c', 'SHIELD', [{ type: 'SHIELD', count: 2 }]);
                const g = scenario(['p0', 'p1'], { display: [dcard(card)], faces: ['SHIELD', 'REACTOR'], hired: { p0: [crewById('saghari')] } });
                g.choose_card('p0', 0);
                g.commit('p0', 0);
                const before = g.get_data();
                withRandom('DAMAGE', () => g.use_ability('p0', 'saghari')); // Damage isn't kept → transient
                let d = g.get_data();
                assert.strictEqual(d.rollingPool.filter(x => x.transient).length, 1, 'shown as a transient die');
                assert.strictEqual(d.supplyCount, before.supplyCount - 1, 'out of supply while shown');
                // The transient die is inert: it can't be locked and doesn't affect affordances.
                assert.ok(!g.affordances('p0').directLockDice.includes(d.rollingPool.length - 1));
                g.dismiss_transient('p0');
                d = g.get_data();
                assert.ok(!d.rollingPool.some(x => x.transient), 'transient die removed');
                assert.strictEqual(d.supplyCount, before.supplyCount, 'returned to supply');
            });

            it('reroll_select (Vila Noir): re-rolls chosen dice and caps at its max', () => {
                const card = mkCard('c', 'SHIELD', [{ type: 'SHIELD', count: 3 }]);
                const g = scenario(['p0', 'p1'], { display: [dcard(card)], faces: ['SHIELD', 'DAMAGE', 'THRUSTER'], hired: { p0: [crewById('vila_noir')] } });
                g.choose_card('p0', 0);
                g.commit('p0', 0);
                assert.throws(() => g.use_ability('p0', 'vila_noir', [0, 1, 2]), /at most 2/);
                withRandom('SHIELD', () => g.use_ability('p0', 'vila_noir', [1, 2]));
                const d = g.get_data();
                assert.strictEqual(d.rollingPool[1].face, 'SHIELD');
                assert.strictEqual(d.rollingPool[2].face, 'SHIELD');
            });

            it('convert_extra_select (Myla): turns a chosen die into an Extra', () => {
                const card = mkCard('c', 'SHIELD', [{ type: 'SHIELD', count: 3 }]);
                const g = scenario(['p0', 'p1'], { display: [dcard(card)], faces: ['THRUSTER', 'THRUSTER', 'SHIELD'], hired: { p0: [crewById('myla_dystra')] } });
                g.choose_card('p0', 0);
                g.commit('p0', 0);
                g.use_ability('p0', 'myla_dystra', [0]);
                assert.strictEqual(g.get_data().rollingPool[0].face, 'EXTRA');
            });

            it('retag_select (Vanta): a chosen die may lock as a Wild when no Extra is rolled', () => {
                const card = mkCard('c', 'SHIELD', [{ type: 'SHIELD', count: 1 }]);
                const g = scenario(['p0', 'p1'], { display: [dcard(card)], faces: ['DAMAGE'], hired: { p0: [crewById('vanta_sae')] } });
                g.use_ability('p0', 'vanta_sae', [0]); // Damage → Wild (usable before choosing)
                assert.ok(g.get_data().rollingPool[0].asWild);
                g.choose_card('p0', 0);
                g.commit('p0', 0);
                withRandom('WILD', () => g.lock_die('p0', 0));
                assert.ok(g.get_data().players['p0'].hired.some(c => c.id === 'c'));
            });

            it('wild_to_extra (FT-1000): converts the lone Wild into an Extra', () => {
                const card = mkCard('c', 'SHIELD', [{ type: 'SHIELD', count: 2 }]);
                const g = scenario(['p0', 'p1'], { display: [dcard(card)], faces: ['SHIELD', 'WILD'], hired: { p0: [crewById('ft_1000')] } });
                g.choose_card('p0', 0);
                g.commit('p0', 0);
                g.use_ability('p0', 'ft_1000');
                const d = g.get_data();
                assert.ok(d.rollingPool.some(x => x.face === 'EXTRA'));
                assert.ok(!d.rollingPool.some(x => x.face === 'WILD'));
            });

            it('save_wild (Meg Gallak): a saved Wild survives the next re-roll', () => {
                const card = mkCard('c', 'SHIELD', [{ type: 'SHIELD', count: 3 }]);
                const g = scenario(['p0', 'p1'], { display: [dcard(card)], faces: ['SHIELD', 'WILD'], hired: { p0: [crewById('meg_gallak')] } });
                g.choose_card('p0', 0);
                g.commit('p0', 0);
                g.lock_die('p0', 0);              // lock the Shield → pool = [WILD]
                g.use_ability('p0', 'meg_gallak', [0]); // save that Wild
                withRandom('DAMAGE', () => g.roll_again('p0')); // stub would make it Damage, but it's saved
                assert.ok(g.get_data().rollingPool.some(x => x.face === 'WILD'));
            });

            it('complete_committed (B3-AR): 3+ Thrusters instantly finishes the requirement', () => {
                const card = mkCard('c', 'SHIELD', [{ type: 'THRUSTER', count: 2 }, { type: 'SHIELD', count: 1 }]);
                const g = scenario(['p0', 'p1'], { display: [dcard(card)], faces: ['THRUSTER', 'THRUSTER', 'THRUSTER'], hired: { p0: [crewById('b3_ar')] } });
                g.choose_card('p0', 0);
                g.commit('p0', 0);
                g.use_ability('p0', 'b3_ar');
                assert.strictEqual(g.get_data().display[0].reqStates[0].status, 'COMPLETED');
            });

            it('bonus_next_roll (Avari): all Wilds adds 3 dice to the next re-roll', () => {
                const card = mkCard('c', 'SHIELD', [{ type: 'SHIELD', count: 5 }]);
                const g = scenario(['p0', 'p1'], { display: [dcard(card)], faces: ['WILD', 'WILD'], hired: { p0: [crewById('avari')] } });
                g.choose_card('p0', 0);
                g.commit('p0', 0);
                g.lock_die('p0', 0);            // pool = [WILD] (still all wild)
                g.use_ability('p0', 'avari');
                assert.strictEqual(g.get_data().bonusDiceNextRoll, 3);
                const before = g.get_data().rollingPool.length;
                withRandom('SHIELD', () => g.roll_again('p0'));
                assert.strictEqual(g.get_data().rollingPool.length, before + 3);
            });

            it('bust-safety lets you Stop without locking this roll', () => {
                const card = mkCard('c', 'SHIELD', [{ type: 'SHIELD', count: 3 }]);
                const g = scenario(['p0', 'p1'], { display: [dcard(card)], faces: ['SHIELD', 'SHIELD'] });
                g.choose_card('p0', 0);
                g.commit('p0', 0);
                g.lock_die('p0', 0);
                const d = g.get_data();
                d.rollingPool = pool(['DAMAGE']); d.lockedThisRoll = 0; d.step = 'LOCKING';
                const noSafe = GameState.from_data({ ...d, bustSafeThisRoll: false }, ['p0', 'p1']);
                assert.throws(() => noSafe.stop('p0'), /lock at least one/);
                const safe = GameState.from_data({ ...d, bustSafeThisRoll: true }, ['p0', 'p1']);
                assert.doesNotThrow(() => withRandom('WILD', () => safe.stop('p0')));
            });

            it('a triggered ability can only be used once per roll', () => {
                const card = mkCard('c', 'SHIELD', [{ type: 'SHIELD', count: 3 }]);
                const g = scenario(['p0', 'p1'], { display: [dcard(card)], faces: ['SHIELD', 'REACTOR'], hired: { p0: [crewById('saghari')] } });
                g.choose_card('p0', 0);
                g.commit('p0', 0);
                withRandom('REACTOR', () => g.use_ability('p0', 'saghari')); // pulled Reactor (not kept) — still counts as used
                assert.throws(() => g.use_ability('p0', 'saghari'), /already used this roll/);
            });
        });

        describe('Final scoring', () => {
            it('2-player: leader is disqualified only when 3+ Hazard symbols ahead', () => {
                const solo = mkCard('solo', 'REACTOR', [{ type: 'REACTOR', count: 1 }]);
                const r1 = mkCard('r1', 'REACTOR', [{ type: 'REACTOR', count: 1 }], 'salatar');
                const r2 = mkCard('r2', 'REACTOR', [{ type: 'REACTOR', count: 1 }], 'vila_noir');
                const g = scenario(['p0', 'p1'], {
                    display: [dcard(solo)], faces: ['REACTOR'], hired: { p0: [r1, r2] },
                    hazards: { p0: [HAZ(5, 2, 'a'), HAZ(5, 2, 'b')], p1: [HAZ(2, 1, 'c')] } // p0=4 sym, p1=1 sym → diff 3
                });
                g.choose_card('p0', 0);
                g.commit('p0', 0);
                g.lock_die('p0', 0); // p0 wins → finish
                const d = g.get_data();
                const p0 = d.finalScores!.find(r => r.playerId === 'p0')!;
                assert.strictEqual(p0.disqualified, true, 'p0 is 3 symbols ahead → disqualified');
                assert.strictEqual(p0.tokenPrestige, 10);
                assert.strictEqual(p0.total, p0.trackPrestige, 'no token prestige counted');
            });

            it('multiplayer: all players tied for most Hazard symbols are disqualified', () => {
                const solo = mkCard('solo', 'REACTOR', [{ type: 'REACTOR', count: 1 }]);
                const r1 = mkCard('r1', 'REACTOR', [{ type: 'REACTOR', count: 1 }], 'salatar');
                const r2 = mkCard('r2', 'REACTOR', [{ type: 'REACTOR', count: 1 }], 'vila_noir');
                const g = scenario(['p0', 'p1', 'p2'], {
                    display: [dcard(solo)], faces: ['REACTOR'], hired: { p0: [r1, r2] },
                    hazards: { p0: [HAZ(5, 2, 'a')], p1: [HAZ(5, 2, 'b')], p2: [HAZ(1, 0, 'c')] } // p0,p1 tie at 2
                });
                g.choose_card('p0', 0);
                g.commit('p0', 0);
                g.lock_die('p0', 0);
                const d = g.get_data();
                const byId = (id: string) => d.finalScores!.find(r => r.playerId === id)!;
                assert.strictEqual(byId('p0').disqualified, true);
                assert.strictEqual(byId('p1').disqualified, true);
                assert.strictEqual(byId('p2').disqualified, false);
            });
        });
    });

    describe('Type B: Moonrollers Integration (Multiplayr Room Simulation)', () => {
        it('starts a game, distributes state, and processes a choose→commit→lock', () => {
            const t = new GameRuleTest('moonrollers', 2); // host + 2 clients = 3 players
            t.invokeHostMethod('startGame');

            let raw = t.getHostData('gameState');
            assert.ok(raw, 'game state exists');
            let g = GameState.from_data(raw.data, raw.playerIds);
            let d = g.get_data();
            assert.strictEqual(d.status, GameStatus.Active);
            assert.strictEqual(d.display.length, 5, '3 players → 5 display cards');
            for (const pid of raw.playerIds) assert.strictEqual(d.players[pid].hired.length, 1);

            const current = d.currentPlayerId;
            const invoke = (method: string, ...args: any[]) => {
                if (current === raw.playerIds[0]) t.invokeHostMethod(method, ...args); // host is seat 0
                else t.invokeClientMethod(raw.playerIds.indexOf(current) - 1, method, ...args);
            };

            const aff = g.affordances(current);
            if (aff.committable.length === 0) {
                // Extremely rare opening bust — just assert the game remains coherent.
                assert.ok(d.status === GameStatus.Active);
                return;
            }
            const pick = aff.committable[0];
            invoke('chooseCard', pick.cardIndex);
            invoke('commit', pick.reqIndex);

            // Re-read, then lock via whichever affordance exists (direct / convert / retag) —
            // a requirement can be committable through an ability with no direct lock die.
            raw = t.getHostData('gameState');
            g = GameState.from_data(raw.data, raw.playerIds);
            const aff2 = g.affordances(current);
            let acted = false;
            if (aff2.directLockDice.length > 0) {
                invoke('lockDie', aff2.directLockDice[0]); acted = true;
            } else if (aff2.extraConvert) {
                invoke('abilityExtraLock', aff2.extraConvert.dieIndices[0]); acted = true;
            } else if (aff2.retagDice.length > 0) {
                invoke('abilityRetag', aff2.retagDice[0].dieIndex);
                raw = t.getHostData('gameState');
                const a3 = GameState.from_data(raw.data, raw.playerIds).affordances(current);
                if (a3.directLockDice.length > 0) invoke('lockDie', a3.directLockDice[0]);
                acted = true;
            }
            assert.ok(acted, 'a lock affordance exists after commit');

            raw = t.getHostData('gameState');
            d = GameState.from_data(raw.data, raw.playerIds).get_data();
            // Either progress advanced, or the (count-1) requirement completed outright.
            const chosen = d.display[pick.cardIndex];
            const completedSomething = chosen && chosen.reqStates[pick.reqIndex].status !== 'OPEN';
            assert.ok(d.committedProgress >= 1 || completedSomething || d.currentPlayerId !== current,
                'the lock registered');
        });
    });
});
