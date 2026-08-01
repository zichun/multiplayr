/**
 * test_magicalathletes.ts - Tests for Magical Athletes.
 */

import { describe, it } from 'mocha';
import { strict as assert } from 'assert';
import {
    MagicalAthletesGameState as GameState,
    GameStateData,
    RacerState,
    GOLD_BY_RACE,
    SILVER_BY_RACE,
    WILD_WILDS,
    MILD_MILE,
    HAND_SIZE
} from '../../rules/magicalathletes/MagicalAthletesGameState';
import { GameRuleTest } from '../GameRuleTest';

// Build a controlled "Racing" state: place named racers (with an explicit power) at
// given positions on a given track, with the turn on `current`.
function racingState(
    players: string[],
    setup: Record<string, { racerId: string; powerId?: string; pos?: number }>,
    opts: { trackId?: 'mild' | 'wild'; current?: string; raceNo?: number } = {}
): GameState {
    const g = new GameState(players);
    const d = g.get_data();
    d.status = 'Racing';
    d.trackId = opts.trackId || 'mild';
    d.raceNo = opts.raceNo ?? 0;
    d.participants = [...players];
    d.finishers = [];
    d.eliminatedOrder = [];
    d.raceOver = false;
    d.racers = {};
    players.forEach(p => {
        const s = setup[p];
        d.racers[p] = {
            ownerId: p, racerId: s.racerId, powerId: s.powerId || s.racerId,
            pos: s.pos || 0, tripped: false, finished: false, finishRank: 0, eliminated: false, flags: {}
        };
    });
    d.currentId = opts.current || players[0];
    return GameState.from_data(d, players);
}

const R = (g: GameState, pid: string): RacerState => g.get_racers()[pid];

// Auto-run the snake draft to completion (always taking the first available card).
function runDraft(g: GameState) {
    let guard = 0;
    while (g.get_status() === 'Draft' && guard < 1000) {
        guard++;
        const drafter = g.get_current_drafter();
        const pool = g.get_draft_pool();
        g.draft_pick(drafter, pool[0]);
    }
}

describe('Magical Athletes Game Logic', () => {
    describe('Type A: MagicalAthletesGameState Unit Tests', () => {

        describe('Board', () => {
            it('has two 30-space tracks; only the wild one has special spaces', () => {
                assert.strictEqual(MILD_MILE.length, 30);
                assert.strictEqual(WILD_WILDS.length, 30);
                assert.strictEqual(MILD_MILE.spaces.filter(s => s.type !== 'normal').length, 0);
                assert.ok(WILD_WILDS.spaces.some(s => s.type === 'star'));
                assert.ok(WILD_WILDS.spaces.some(s => s.type === 'trip'));
                assert.ok(WILD_WILDS.spaces.some(s => s.type === 'arrow'));
            });
        });

        describe('Setup & the snake draft', () => {
            it('opens into a draft, revealing 2 x player-count cards', () => {
                const g = new GameState(['a', 'b', 'c']);
                g.start_game('a');
                assert.strictEqual(g.get_status(), 'Draft');
                assert.strictEqual(g.get_draft_pool().length, 6, '2 x 3 players revealed');
                assert.strictEqual(g.get_current_drafter(), 'a', 'roll-off winner drafts first');
            });

            it('drafts in snake order (down the table then back up)', () => {
                const g = new GameState(['a', 'b', 'c']);
                g.start_game('a');
                // Round 0 base order a,b,c -> snake a,b,c,c,b,a.
                const seen: string[] = [];
                for (let i = 0; i < 6; i++) {
                    seen.push(g.get_current_drafter());
                    g.draft_pick(g.get_current_drafter(), g.get_draft_pool()[0]);
                }
                assert.deepStrictEqual(seen, ['a', 'b', 'c', 'c', 'b', 'a']);
                // A fresh pool is revealed for round 2, starting one seat left (b).
                assert.strictEqual(g.get_current_drafter(), 'b');
                assert.strictEqual(g.get_draft_pool().length, 6);
            });

            it('gives everyone 4 distinct racers then moves to racer selection (2-6)', () => {
                for (const n of [2, 3, 6]) {
                    const players = Array.from({ length: n }, (_, i) => `p${i}`);
                    const g = new GameState(players);
                    g.start_game(players[0]);
                    runDraft(g);
                    const d = g.get_data();
                    assert.strictEqual(d.status, 'Choose', `-> Choose for ${n}p`);
                    for (const p of players) assert.strictEqual(d.hands[p].length, HAND_SIZE, `stable for ${n}p`);
                    const all = players.flatMap(p => d.hands[p]);
                    assert.strictEqual(new Set(all).size, all.length, 'no duplicate racers');
                }
            });

            it('rejects drafting out of turn or an unavailable racer', () => {
                const g = new GameState(['a', 'b']);
                g.start_game('a');
                assert.throws(() => g.draft_pick('b', g.get_draft_pool()[0]), /not your turn/);
                assert.throws(() => g.draft_pick('a', 'not-a-real-racer'), /not on offer/);
            });

            it('rejects player counts outside 2-6', () => {
                assert.throws(() => new GameState(['a']).start_game(), /2 to 6/);
                assert.throws(() => new GameState(Array.from({ length: 7 }, (_, i) => `p${i}`)).start_game(), /2 to 6/);
            });

            it('commits a racer per player then begins the race on Start', () => {
                const g = new GameState(['a', 'b']);
                g.start_game('a');
                runDraft(g);
                let d = g.get_data();
                const aPick = d.hands['a'][0];
                const bPick = d.hands['b'][1];
                g.choose_racer('a', aPick);
                assert.strictEqual(g.get_status(), 'Choose'); // still waiting for b
                g.choose_racer('b', bPick);
                d = g.get_data();
                assert.strictEqual(d.status, 'Racing');
                assert.strictEqual(d.racers['a'].racerId, aPick);
                assert.strictEqual(d.racers['a'].pos, 0);
                assert.ok(!d.hands['a'].includes(aPick), 'committed racer left the hand');
                assert.ok(d.used['a'].includes(aPick), 'committed racer marked used');
            });

            it('rejects committing a racer that is not in your stable', () => {
                const g = new GameState(['a', 'b']);
                g.start_game('a');
                runDraft(g);
                assert.throws(() => g.choose_racer('a', 'not-a-real-racer'), /stable/);
            });
        });

        describe('Movement & turn hand-off', () => {
            it('rolls, advances that many spaces, then passes clockwise', () => {
                const g = racingState(['a', 'b'], { a: { racerId: 'lackey', pos: 0 }, b: { racerId: 'lackey', pos: 20 } });
                g.take_turn('a', 3);
                assert.strictEqual(R(g, 'a').pos, 3);
                assert.strictEqual(g.get_current(), 'b');
            });

            it('rejects acting out of turn', () => {
                const g = racingState(['a', 'b'], { a: { racerId: 'lackey' }, b: { racerId: 'lackey' } });
                assert.throws(() => g.take_turn('b', 3), /not your turn/);
            });
        });

        describe('Powers', () => {
            it('Hare adds +2 to the main move (when not alone in the lead)', () => {
                const g = racingState(['a', 'b'], { a: { racerId: 'hare', pos: 0 }, b: { racerId: 'lackey', pos: 6 } });
                g.take_turn('a', 3);
                assert.strictEqual(R(g, 'a').pos, 5); // 3 + 2
            });

            it('Gunk saps -1 from every other racer', () => {
                const g = racingState(['a', 'b'], { a: { racerId: 'lackey', pos: 0 }, b: { racerId: 'gunk', pos: 15 } });
                g.take_turn('a', 3);
                assert.strictEqual(R(g, 'a').pos, 2); // 3 - 1
            });

            it('Centaur shoves a racer it passes back 2', () => {
                const g = racingState(['a', 'b'], { a: { racerId: 'centaur', pos: 0 }, b: { racerId: 'lackey', pos: 2 } });
                g.take_turn('a', 5);
                assert.strictEqual(R(g, 'a').pos, 5);
                assert.strictEqual(R(g, 'b').pos, 0); // 2 - 2
            });

            it('Banana trips whoever passes it', () => {
                const g = racingState(['a', 'b'], { a: { racerId: 'lackey', pos: 0 }, b: { racerId: 'banana', pos: 2 } });
                g.take_turn('a', 5);
                assert.strictEqual(R(g, 'a').tripped, true);
            });

            it('M.O.U.T.H. eliminates a lone racer it stops on', () => {
                const g = racingState(['a', 'b', 'c'], {
                    a: { racerId: 'mouth', pos: 0 }, b: { racerId: 'lackey', pos: 3 }, c: { racerId: 'lackey', pos: 20 }
                });
                g.take_turn('a', 3);
                assert.strictEqual(R(g, 'b').eliminated, true);
            });

            it('a Star space on the Wild Wilds grants a bronze point', () => {
                const g = racingState(['a', 'b'], { a: { racerId: 'lackey', pos: 1 }, b: { racerId: 'lackey', pos: 20 } }, { trackId: 'wild' });
                g.take_turn('a', 3); // 1 -> 4 == star
                assert.strictEqual(g.get_scores()['a'].bronze, 1);
            });

            it('Sisyphus rolling a 6 tumbles back to Start and skips the move', () => {
                const g = racingState(['a', 'b'], { a: { racerId: 'sisyphus', pos: 8 }, b: { racerId: 'lackey', pos: 20 } });
                g.take_turn('a', 6);
                assert.strictEqual(R(g, 'a').pos, 0);
            });

            it('Stickler stops others from overshooting the finish', () => {
                const g = racingState(['a', 'b'], { a: { racerId: 'lackey', pos: 28 }, b: { racerId: 'stickler', pos: 5 } });
                g.take_turn('a', 5); // needs exactly 2, so it stays put
                assert.strictEqual(R(g, 'a').pos, 28);
                assert.strictEqual(R(g, 'a').finished, false);
            });
        });

        describe('Human decisions (pause / resume)', () => {
            it('Legs asks the human whether to jog 5 or roll', () => {
                const jog = racingState(['a', 'b'], { a: { racerId: 'legs', pos: 0 }, b: { racerId: 'lackey', pos: 20 } });
                jog.take_turn('a', 3);
                const pd = jog.get_data().pendingDecision;
                assert.ok(pd, 'a decision is raised');
                assert.strictEqual(pd!.playerId, 'a');
                jog.resolve_decision('a', 'jog');
                assert.strictEqual(R(jog, 'a').pos, 5, 'jogged 5');
                assert.strictEqual(jog.get_data().pendingDecision, null);
                assert.strictEqual(jog.get_current(), 'b', 'turn passed on');

                const roll = racingState(['a', 'b'], { a: { racerId: 'legs', pos: 0 }, b: { racerId: 'lackey', pos: 20 } });
                roll.take_turn('a', 3);
                roll.resolve_decision('a', 'roll');
                assert.strictEqual(R(roll, 'a').pos, 3, 'rolled the forced 3 instead');
            });

            it('Alchemist lets the human choose to transmute a 1 into a 4', () => {
                const yes = racingState(['a', 'b'], { a: { racerId: 'alchemist', pos: 0 }, b: { racerId: 'lackey', pos: 20 } });
                yes.take_turn('a', 1);
                assert.ok(yes.get_data().pendingDecision, 'transmute is offered on a 1');
                yes.resolve_decision('a', 'yes');
                assert.strictEqual(R(yes, 'a').pos, 4);

                const no = racingState(['a', 'b'], { a: { racerId: 'alchemist', pos: 0 }, b: { racerId: 'lackey', pos: 20 } });
                no.take_turn('a', 1);
                no.resolve_decision('a', 'no');
                assert.strictEqual(R(no, 'a').pos, 1, 'kept the 1');
            });

            it('Rocket Scientist doubles only if the human opts in (and then trips)', () => {
                const g = racingState(['a', 'b'], { a: { racerId: 'rocket', pos: 0 }, b: { racerId: 'lackey', pos: 20 } });
                g.take_turn('a', 2);
                assert.ok(g.get_data().pendingDecision, 'double is offered');
                g.resolve_decision('a', 'yes');
                assert.strictEqual(R(g, 'a').pos, 4, 'doubled 2 -> 4');
                assert.strictEqual(R(g, 'a').tripped, true, 'trips after the blast');
            });

            it('routes an off-turn decision to the character owner (Duelist)', () => {
                // b lands on a's space; the Duelist a (not on turn) decides whether to duel.
                const g = racingState(['a', 'b'], { a: { racerId: 'duelist', pos: 5 }, b: { racerId: 'lackey', pos: 0 } }, { current: 'b' });
                g.take_turn('b', 5); // 0 -> 5, shares with a
                const pd = g.get_data().pendingDecision;
                assert.ok(pd, 'the duel is offered');
                assert.strictEqual(pd!.playerId, 'a', 'the Duelist owner decides, though it is b\'s turn');
                g.resolve_decision('a', 'no'); // decline; turn completes
                assert.strictEqual(g.get_data().pendingDecision, null);
            });

            it('rejects rolling while a decision is pending, and bad answers', () => {
                const g = racingState(['a', 'b'], { a: { racerId: 'legs', pos: 0 }, b: { racerId: 'lackey', pos: 20 } });
                g.take_turn('a', 3);
                assert.throws(() => g.take_turn('a', 3), /pending decision/);
                assert.throws(() => g.resolve_decision('b', 'jog'), /not yours/);
                assert.throws(() => g.resolve_decision('a', 'bogus'), /valid choice/);
            });

            it('Egg asks the human to keep one of three drawn powers (a pre-race decision)', () => {
                const g = new GameState(['a', 'b']);
                const d = g.get_data();
                d.status = 'Choose';
                d.hands = { a: ['egg', 'hare'], b: ['lackey', 'gunk'] };
                d.picks = { a: null, b: null };
                d.firstNextRace = 'a';
                const g2 = GameState.from_data(d, ['a', 'b']);

                g2.choose_racer('a', 'egg');
                g2.choose_racer('b', 'lackey'); // all picked -> beginRace runs the setup transaction
                const pd = g2.get_data().pendingDecision;
                assert.ok(pd, 'Egg raises a setup decision');
                assert.strictEqual(pd!.playerId, 'a');
                assert.strictEqual(pd!.racerId, 'egg');
                assert.strictEqual(pd!.options.length, 3, 'three drawn powers offered');

                const chosen = pd!.options[1].id;
                g2.resolve_decision('a', chosen);
                const after = g2.get_data();
                assert.strictEqual(after.pendingDecision, null);
                assert.strictEqual(after.status, 'Racing');
                assert.strictEqual(after.racers['a'].powerId, chosen, 'Egg took the chosen power');
                assert.strictEqual(after.racers['a'].racerId, 'egg', 'but keeps its own identity');
            });
        });

        describe('Finishing, race end & scoring', () => {
            it('ends when the 2nd racer crosses; 1st takes gold, 2nd takes silver', () => {
                const g = racingState(['a', 'b'], { a: { racerId: 'lackey', pos: 28 }, b: { racerId: 'lackey', pos: 28 } });
                g.take_turn('a', 5); // a finishes 1st
                assert.strictEqual(R(g, 'a').finished, true);
                assert.strictEqual(g.get_status(), 'Racing');
                g.take_turn('b', 5); // b finishes 2nd -> race over
                const d = g.get_data();
                assert.strictEqual(d.status, 'RaceOver');
                assert.strictEqual(d.scores['a'].gold, GOLD_BY_RACE[0]);
                assert.strictEqual(d.scores['b'].silver, SILVER_BY_RACE[0]);
            });

            it('advances to the next race, and finishes the season after four', () => {
                const g = racingState(['a', 'b'], { a: { racerId: 'lackey', pos: 28 }, b: { racerId: 'lackey', pos: 28 } }, { raceNo: 3 });
                // deal hands so later Choose phases have something (not needed for GameOver path)
                g.take_turn('a', 5);
                g.take_turn('b', 5);
                assert.strictEqual(g.get_status(), 'RaceOver');
                g.advance_race('a'); // raceNo 3 -> 4 -> season over
                const d = g.get_data();
                assert.strictEqual(d.status, 'GameOver');
                assert.ok(d.finalWinners.length >= 1);
                // a beat b (gold > silver)
                assert.deepStrictEqual(d.finalWinners, ['a']);
            });
        });
    });

    describe('Type B: Magical Athletes Integration Tests', () => {
        // Drive the whole snake draft via RPC (host or client, whoever is on the clock).
        const runDraftRPC = (test: GameRuleTest, playerIds: string[]) => {
            let guard = 0;
            while (test.getHostData('gameState').data.status === 'Draft' && guard < 1000) {
                guard++;
                const raw = test.getHostData('gameState');
                const drafter: string = raw.data.currentDrafter;
                const card: string = raw.data.draftPool[0];
                const idx = playerIds.indexOf(drafter);
                if (idx === 0) test.invokeHostMethod('draftPick', card);
                else test.invokeClientMethod(idx - 1, 'draftPick', card);
            }
        };

        it('runs the snake draft, commits racers, and runs a race turn', () => {
            const test = new GameRuleTest('magicalathletes', 2); // host + 2 clients
            test.invokeHostMethod('startGame');

            let raw = test.getHostData('gameState');
            const playerIds: string[] = raw.playerIds;
            assert.strictEqual(playerIds.length, 3);
            assert.strictEqual(raw.data.status, 'Draft');
            assert.strictEqual(raw.data.draftPool.length, 6);

            runDraftRPC(test, playerIds);

            raw = test.getHostData('gameState');
            assert.strictEqual(raw.data.status, 'Choose');
            for (const p of playerIds) assert.strictEqual(raw.data.hands[p].length, HAND_SIZE);

            // Every player commits their first stabled racer.
            test.invokeHostMethod('chooseRacer', raw.data.hands[playerIds[0]][0]);
            test.invokeClientMethod(0, 'chooseRacer', raw.data.hands[playerIds[1]][0]);
            test.invokeClientMethod(1, 'chooseRacer', raw.data.hands[playerIds[2]][0]);

            // Drain any pre-race (Egg/Twin) setup decisions.
            let safety = 0;
            while (test.getHostData('gameState').data.pendingDecision && safety < 50) {
                safety++;
                const pd = test.getHostData('gameState').data.pendingDecision;
                const idx = playerIds.indexOf(pd.playerId);
                if (idx === 0) test.invokeHostMethod('resolveDecision', pd.options[0].id);
                else test.invokeClientMethod(idx - 1, 'resolveDecision', pd.options[0].id);
            }

            raw = test.getHostData('gameState');
            assert.strictEqual(raw.data.status, 'Racing');
            for (const p of playerIds) assert.strictEqual(raw.data.racers[p].pos, 0);

            const current: string = raw.data.currentId;
            const currentIdx = playerIds.indexOf(current);
            if (currentIdx === 0) test.invokeHostMethod('rollDice');
            else test.invokeClientMethod(currentIdx - 1, 'rollDice');

            raw = test.getHostData('gameState');
            assert.ok(['Racing', 'RaceOver'].indexOf(raw.data.status) >= 0);
        });

        it('rejects a client drafting out of turn', () => {
            const test = new GameRuleTest('magicalathletes', 2);
            test.invokeHostMethod('startGame');
            const raw = test.getHostData('gameState');
            const playerIds: string[] = raw.playerIds;
            const drafter: string = raw.data.currentDrafter;
            const card: string = raw.data.draftPool[0];
            // find a client who is NOT the current drafter and assert their pick throws
            for (let i = 1; i < playerIds.length; i++) {
                if (playerIds[i] !== drafter) {
                    assert.throws(() => test.invokeClientMethod(i - 1, 'draftPick', card));
                    break;
                }
            }
        });
    });
});
