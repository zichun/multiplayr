/**
 * test_jibberjabble.ts — Jibber Jabble tests.
 *   Type A: the word/hint tables + the pure JJGameState engine.
 *   Type B: end-to-end via GameRuleTest (remote methods + per-client props).
 */

import { describe, it } from 'mocha';
import { strict as assert } from 'assert';

import { JJGameState, Phase } from '../../rules/jibberjabble/JJGameState';
import {
    WORD_CARDS, WORD_TIERS, CARD_BY_ID, dealMixedCard, HINT_CARDS, EMOTES, HintId, MAX_CLUE_LEN, tierOf, rankFor, guessMatches, normalise
} from '../../rules/jibberjabble/JJData';
import { GameRuleTest } from '../GameRuleTest';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const IDS = ['a', 'b', 'c', 'd'];

function fresh(ids = IDS, opts: any = {}): JJGameState {
    const gs = new JJGameState(ids);
    gs.start_game({ seed: 11, hints: false, ...opts });
    return gs;
}

/** Spell a whole clue: each current speller adds the next letter. */
function spell(gs: JJGameState, word: string) {
    for (const ch of word) gs.add_letter(gs.currentSpellerId()!, ch);
}

/** Choose word `idx`, spell `clues` (STOP between them), ending in the guess phase. */
function playToGuess(gs: JJGameState, clues = ['TUNA', 'SWIM', 'WAVE'], idx = 1) {
    gs.choose_word(gs.chooserId(), idx);
    clues.forEach((c, i) => {
        if (i === 0) spell(gs, c);
        else { gs.stop_clue(gs.currentSpellerId()!, c[0]); spell(gs, c.slice(1)); }
    });
    gs.stop_clue(gs.currentSpellerId()!);
}

function giveHint(gs: JJGameState, pid: string, hint: HintId) {
    const d = gs.get_data();
    d.hintsEnabled = true;
    d.hints[pid] = { hint, used: false };
}

describe('Jibber Jabble', () => {

    // ======================================================================
    describe('Type A: data', () => {
        it('has 150 cards of 6 unique words, 900 distinct overall', () => {
            assert.equal(WORD_CARDS.length, 150);
            const all = WORD_CARDS.flatMap(c => c.words);
            assert.equal(all.length, 900);
            assert.equal(new Set(all).size, 900);
            for (const c of WORD_CARDS) {
                assert.equal(c.words.length, 6);
                c.words.forEach(w => assert.match(w, /^[A-Z]+$/, `${w} is bare A–Z`));
            }
            assert.equal(WORD_TIERS.easy.length, 300);
            assert.equal(WORD_TIERS.medium.length, 300);
            assert.equal(WORD_TIERS.hard.length, 300);
        });

        it('no two words differ only by a forgiven plural (so a guess never matches the wrong word)', () => {
            const all = WORD_CARDS.flatMap(c => c.words);
            for (const a of all) for (const b of all) {
                if (a !== b) assert.ok(!guessMatches(a, b), `${a} would be accepted for ${b}`);
            }
        });

        it('dealMixedCard gives 2 easy + 2 medium + 2 hard, avoiding used words', () => {
            let seed = 1;
            const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
            const used = new Set<string>();
            for (let n = 0; n < 150; n++) {      // the whole pile, card by card
                const card = dealMixedCard(used, rand);
                assert.equal(card.length, 6);
                assert.ok(WORD_TIERS.easy.includes(card[0]) && WORD_TIERS.easy.includes(card[1]));
                assert.ok(WORD_TIERS.medium.includes(card[2]) && WORD_TIERS.medium.includes(card[3]));
                assert.ok(WORD_TIERS.hard.includes(card[4]) && WORD_TIERS.hard.includes(card[5]));
                card.forEach(w => { assert.ok(!used.has(w), `${w} repeated`); used.add(w); });
            }
            assert.equal(used.size, 900);
            // Once a tier is exhausted it is reused rather than failing.
            assert.equal(new Set(dealMixedCard(used, rand)).size, 6);
        });

        it('numbers 1–2 easy, 3–4 medium, 5–6 hard', () => {
            assert.deepEqual([0, 1, 2, 3, 4, 5].map(tierOf), ['easy', 'easy', 'medium', 'medium', 'hard', 'hard']);
            for (const c of WORD_CARDS) {
                assert.ok(WORD_TIERS.easy.includes(c.words[0]) && WORD_TIERS.easy.includes(c.words[1]));
                assert.ok(WORD_TIERS.hard.includes(c.words[5]));
            }
        });

        it('has 10 distinct hint cards', () => {
            assert.equal(HINT_CARDS.length, 10);
            assert.equal(new Set(HINT_CARDS.map(h => h.id)).size, 10);
        });

        it('ranks follow the printed table at 6 rounds and scale otherwise', () => {
            assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(s => rankFor(s, 6).title), [
                'Dizzy Dabbler', 'Dizzy Dabbler', 'Satisfactory Speller', 'Satisfactory Speller',
                'Glorious Guesser', 'Glorious Guesser', 'Legendary Letterer'
            ]);
            assert.equal(rankFor(12, 12).title, 'Legendary Letterer');
            assert.equal(rankFor(4, 12).title, 'Satisfactory Speller');
        });

        it('normalises guesses and forgives plurals only', () => {
            assert.equal(normalise(' ocean! '), 'OCEAN');
            assert.ok(guessMatches('ocean', 'OCEAN'));
            assert.ok(guessMatches('grape', 'GRAPES'));
            assert.ok(guessMatches('TAXE', 'TAXES'));
            assert.ok(!guessMatches('OCEANIC', 'OCEAN'));
            assert.ok(!guessMatches('', 'OCEAN'));
        });
    });

    // ======================================================================
    describe('Type A: round flow', () => {
        it('starts in Choose with the chooser left of the Guesser', () => {
            const gs = fresh();
            const order = gs.get_player_order();
            const g = order.indexOf(gs.guesserId());
            assert.equal(gs.phase(), Phase.Choose);
            assert.equal(gs.chooserId(), order[(g + 1) % order.length]);
            assert.ok(gs.get_data().cardId != null);
            assert.equal(gs.secretWord(), null);
        });

        it('only the chooser may choose, and only 1–6', () => {
            const gs = fresh();
            assert.throws(() => gs.choose_word(gs.guesserId(), 0));
            assert.throws(() => gs.choose_word(gs.chooserId(), 6));
            gs.choose_word(gs.chooserId(), 3);
            assert.equal(gs.phase(), Phase.Spell);
            assert.equal(gs.secretWord(), gs.currentCardWords()![3]);
        });

        it('spellers go clockwise from the chooser and skip the Guesser', () => {
            const gs = fresh();
            const order = gs.get_player_order();
            gs.choose_word(gs.chooserId(), 0);
            const g = order.indexOf(gs.guesserId());
            const seen: string[] = [];
            for (let i = 0; i < 6; i++) {
                const s = gs.currentSpellerId()!;
                seen.push(s);
                gs.add_letter(s, 'A');
            }
            const expected = [1, 2, 3, 1, 2, 3].map(k => order[(g + k) % 4]);
            assert.deepEqual(seen, expected);
            assert.ok(!seen.includes(gs.guesserId()));
        });

        it('rejects letters out of turn, non-letters, and overlong clues', () => {
            const gs = fresh();
            gs.choose_word(gs.chooserId(), 0);
            const s = gs.currentSpellerId()!;
            const other = gs.get_player_order().find(id => id !== s && id !== gs.guesserId())!;
            assert.throws(() => gs.add_letter(other, 'A'), /turn/);
            assert.throws(() => gs.add_letter(gs.guesserId(), 'A'), /turn/);
            assert.throws(() => gs.add_letter(s, '7'));
            assert.throws(() => gs.add_letter(s, 'AB'));
            spell(gs, 'X'.repeat(MAX_CLUE_LEN));
            assert.throws(() => gs.add_letter(gs.currentSpellerId()!, 'A'), /full/);
        });

        it('STOP closes the clue and the stopper starts the next one', () => {
            const gs = fresh();
            gs.choose_word(gs.chooserId(), 0);
            assert.throws(() => gs.stop_clue(gs.currentSpellerId()!, 'S'), /add a letter/);
            spell(gs, 'TRO');
            const stopper = gs.currentSpellerId()!;
            assert.throws(() => gs.stop_clue(stopper), /first letter/);
            gs.stop_clue(stopper, 's');
            const d = gs.get_data();
            assert.equal(gs.lane().clues.length, 2);
            assert.equal(gs.lane().clues[0].stoppedBy, stopper);
            assert.equal(gs.lane().clues[1].letters[0].ch, 'S');
            assert.equal(gs.lane().clues[1].letters[0].by, stopper);
            assert.notEqual(gs.currentSpellerId(), stopper);
            assert.deepEqual(gs.clueStrings(), ['TRO', 'S']);
        });

        it('stopping the 3rd clue moves straight to the guess', () => {
            const gs = fresh();
            playToGuess(gs);
            const d = gs.get_data();
            assert.equal(gs.phase(), Phase.Guess);
            assert.deepEqual(gs.clueStrings(), ['TUNA', 'SWIM', 'WAVE']);
            assert.equal(gs.lane().guessesLeft, 1);
            assert.equal(gs.currentSpellerId(), null);
        });

        it('Buzzer Beater mode ends after 2 clues', () => {
            const gs = fresh(IDS, { cluesPerRound: 2 });
            playToGuess(gs, ['TUNA', 'SWIM']);
            assert.equal(gs.phase(), Phase.Guess);
        });

        it('one correct guess scores; the card leaves the deck', () => {
            const gs = fresh();
            playToGuess(gs);
            const card = gs.get_data().cardId!;
            assert.throws(() => gs.submit_guess(gs.chooserId(), 'X'), /Guesser/);
            gs.submit_guess(gs.guesserId(), gs.secretWord()!.toLowerCase());
            const d = gs.get_data();
            assert.equal(gs.phase(), Phase.Reveal);
            assert.equal(gs.lane().score, 1);
            assert.ok(!d.deck.includes(card));
            assert.equal(gs.lane().history[0].correct, true);
            assert.deepEqual(gs.lane().history[0].clues, ['TUNA', 'SWIM', 'WAVE']);
        });

        it('a miss goes to the bottom of the deck; spellers can overrule it', () => {
            const gs = fresh();
            playToGuess(gs);
            const card = gs.get_data().cardId!;
            gs.submit_guess(gs.guesserId(), 'ZZZZ');
            let d = gs.get_data();
            assert.equal(gs.phase(), Phase.Reveal);
            assert.equal(gs.lane().score, 0);
            assert.equal(d.deck[d.deck.length - 1], card);
            assert.throws(() => gs.allow_guess(gs.guesserId()));
            gs.allow_guess(gs.chooserId());
            d = gs.get_data();
            assert.equal(gs.lane().score, 1);
            assert.ok(!d.deck.includes(card));
            assert.equal(gs.lane().history[0].overruled, true);
            assert.throws(() => gs.allow_guess(gs.chooserId()), /Nothing/);
        });

        it('the Guesser rotates left each round and the game ends after N rounds', () => {
            const gs = fresh(IDS, { rounds: 3 });
            const order = gs.get_player_order();
            const firstG = order.indexOf(gs.guesserId());
            for (let r = 0; r < 3; r++) {
                assert.equal(gs.guesserId(), order[(firstG + r) % 4]);
                playToGuess(gs, ['AB', 'CD', 'EF'], r % 6);
                gs.submit_guess(gs.guesserId(), gs.secretWord()!);
                gs.next_round(order[0]);
            }
            assert.equal(gs.phase(), Phase.Done);
            assert.equal(gs.lane().score, 3);
            assert.equal(gs.rank().title, 'Legendary Letterer');
        });

        it('fixed mode deals printed cards; mixed mode deals fresh ones with no repeated word', () => {
            const fixed = fresh();
            const fd = fixed.get_data();
            assert.equal(fd.cardMode, 'fixed');
            assert.deepEqual(fixed.currentCardWords(), CARD_BY_ID[fd.cardId!].words);

            const gs = fresh(IDS, { rounds: 12, cardMode: 'mixed', hints: true });
            const d = gs.get_data();
            assert.equal(d.cardMode, 'mixed');
            assert.equal(d.deck.length, 0);
            const order = gs.get_player_order();
            const seen: string[] = [];
            const note = () => seen.push(...gs.currentCardWords()!);
            note();
            // A Do-Over swaps the card mid-round: the new card is fresh too.
            gs.choose_word(gs.chooserId(), 2);
            giveHint(gs, 'a', 'doover');
            gs.use_hint('a');
            note();
            for (let r = 0; r < 12; r++) {
                playToGuess(gs, ['AB', 'CD', 'EF'], r % 6);
                const secret = gs.secretWord()!;
                assert.equal(secret, gs.currentCardWords()![r % 6]);
                // Alternate misses (which would return a fixed card) and hits.
                gs.submit_guess(gs.guesserId(), r % 2 ? secret : 'ZZZZ');
                assert.equal(gs.get_data().deck.length, 0);
                gs.next_round(order[0]);
                if (r < 11) note();
            }
            assert.equal(gs.phase(), Phase.Done);
            assert.equal(seen.length, 13 * 6);
            assert.equal(new Set(seen).size, seen.length, 'no word repeats across cards');
            assert.equal(gs.lane().score, 6);
            assert.deepEqual(gs.lane().history.map(h => h.cardId), [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
        });

        it('works with the minimum of 3 players (two spellers alternate)', () => {
            const gs = fresh(['x', 'y', 'z']);
            gs.choose_word(gs.chooserId(), 0);
            const a = gs.currentSpellerId()!;
            gs.add_letter(a, 'A');
            const b = gs.currentSpellerId()!;
            gs.add_letter(b, 'B');
            assert.notEqual(a, b);
            assert.equal(gs.currentSpellerId(), a);
        });

        it('signals are spelling-only and capped', () => {
            const gs = fresh();
            assert.throws(() => gs.signal('a', 'jibber'));
            gs.choose_word(gs.chooserId(), 0);
            for (let i = 0; i < 30; i++) gs.signal(IDS[i % 4], i % 2 ? 'jibber' : 'jabble');
            assert.equal(gs.lane().signals.length, 16);
            assert.throws(() => gs.signal('a', 'shout' as any));
        });

        it('accepts every emote face as a signal', () => {
            const gs = fresh();
            gs.choose_word(gs.chooserId(), 0);
            for (const e of EMOTES) gs.signal(gs.guesserId(), e.id);
            assert.deepEqual(gs.get_data().emotes.map(s => s.kind), EMOTES.map(e => e.id));
            assert.equal(gs.lane().signals.length, 0, 'faces are public, not team signals');
        });
    });

    // ======================================================================
    describe('Type A: hint cards', () => {
        it('deals one hint per player when enabled', () => {
            const gs = new JJGameState(IDS);
            gs.start_game({ seed: 3, hints: true });
            const hints = gs.get_data().hints;
            assert.deepEqual(Object.keys(hints).sort(), [...IDS].sort());
            assert.equal(new Set(Object.values(hints).map(h => h.hint)).size, 4);
        });

        it('is once per game', () => {
            const gs = fresh();
            gs.choose_word(gs.chooserId(), 0);
            giveHint(gs, 'a', 'encore');
            gs.use_hint('a');
            assert.throws(() => gs.use_hint('a'));
        });

        it('Lifeline grants an extra guess', () => {
            const gs = fresh();
            giveHint(gs, gs.chooserId(), 'lifeline');
            gs.choose_word(gs.chooserId(), 0);
            gs.use_hint(gs.chooserId());
            playToGuessFromSpell(gs);
            assert.equal(gs.lane().guessesLeft, 2);
            gs.submit_guess(gs.guesserId(), 'NOPE');
            assert.equal(gs.phase(), Phase.Guess, 'still guessing');
            gs.submit_guess(gs.guesserId(), gs.secretWord()!);
            assert.equal(gs.phase(), Phase.Reveal);
            assert.equal(gs.lane().score, 1);
        });

        it('Double Up keeps the turn for a second letter', () => {
            const gs = fresh();
            gs.choose_word(gs.chooserId(), 0);
            const s = gs.currentSpellerId()!;
            giveHint(gs, s, 'doubleup');
            gs.use_hint(s);
            gs.add_letter(s, 'A');
            assert.equal(gs.currentSpellerId(), s);
            gs.add_letter(s, 'B');
            assert.notEqual(gs.currentSpellerId(), s);
        });

        it('Rewind, Mulligan and Skip act on your own turn only', () => {
            const gs = fresh();
            gs.choose_word(gs.chooserId(), 0);
            spell(gs, 'CATS');
            const s = gs.currentSpellerId()!;
            const other = gs.get_player_order().find(id => id !== s && id !== gs.guesserId())!;
            giveHint(gs, other, 'rewind');
            assert.equal(gs.hintUsable(other), false);
            giveHint(gs, s, 'rewind');
            gs.use_hint(s);
            assert.deepEqual(gs.clueStrings(), ['CAT']);
            assert.equal(gs.currentSpellerId(), s, 'still your turn after rewinding');

            giveHint(gs, s, 'mulligan');
            gs.use_hint(s);
            assert.deepEqual(gs.clueStrings(), ['']);
            assert.throws(() => gs.stop_clue(s, 'A'), /add a letter/);

            giveHint(gs, s, 'skip');
            gs.use_hint(s);
            assert.notEqual(gs.currentSpellerId(), s);
        });

        it('Encore adds a clue; Spotlight and First Dibs set the reveal flags', () => {
            const gs = fresh();
            gs.choose_word(gs.chooserId(), 0);
            giveHint(gs, 'a', 'encore'); gs.use_hint('a');
            giveHint(gs, 'b', 'spotlight'); gs.use_hint('b');
            giveHint(gs, 'c', 'firstdibs'); gs.use_hint('c');
            const d = gs.get_data();
            assert.equal(gs.lane().cluesTarget, 4);
            assert.ok(gs.lane().revealLength && gs.lane().revealFirst);
            spell(gs, 'AA');
            gs.stop_clue(gs.currentSpellerId()!, 'B');
            gs.stop_clue(gs.currentSpellerId()!, 'C');
            gs.stop_clue(gs.currentSpellerId()!, 'D');
            assert.equal(gs.phase(), Phase.Spell, 'a 4th clue is allowed');
            gs.stop_clue(gs.currentSpellerId()!);
            assert.equal(gs.phase(), Phase.Guess);
        });

        it('Do-Over draws a fresh card back in Choose', () => {
            const gs = fresh();
            gs.choose_word(gs.chooserId(), 0);
            spell(gs, 'AB');
            const card = gs.get_data().cardId;
            giveHint(gs, 'a', 'doover');
            gs.use_hint('a');
            const d = gs.get_data();
            assert.equal(gs.phase(), Phase.Choose);
            assert.notEqual(d.cardId, card);
            assert.equal(gs.lane().clues.length, 0);
            assert.equal(d.deck[d.deck.length - 1], card);
        });

        it('Highlighter stars a chosen clue', () => {
            const gs = fresh();
            gs.choose_word(gs.chooserId(), 0);
            giveHint(gs, 'a', 'highlighter');
            assert.equal(gs.hintUsable('a'), false, 'nothing to star yet');
            spell(gs, 'AB');
            gs.stop_clue(gs.currentSpellerId()!, 'C');
            assert.throws(() => gs.use_hint('a', 7), /Pick/);
            gs.use_hint('a', 0);
            assert.equal(gs.lane().clues[0].starred, true);
            assert.ok(gs.get_data().lastEvent);
        });
    });

    // ======================================================================
    describe('Type A: challenges', () => {
        it('Alliterator and Buzzer Beater are detected', () => {
            const gs = fresh(IDS, { rounds: 3, cluesPerRound: 2 });
            for (let r = 0; r < 3; r++) {
                playToGuess(gs, ['CAT', 'COW']);
                gs.submit_guess(gs.guesserId(), 'nope');
                gs.next_round('a');
            }
            const ch = gs.challenges();
            assert.equal(ch.alliterator, true);
            assert.equal(ch.buzzer, true);
            assert.equal(ch.apprentice, false);
        });

        it('Apprentice needs 2 of each tier scored', () => {
            const gs = fresh(IDS, { rounds: 6 });
            [0, 1, 2, 3, 4, 5].forEach(idx => {
                playToGuess(gs, ['AB', 'CD', 'EF'], idx);
                gs.submit_guess(gs.guesserId(), gs.secretWord()!);
                gs.next_round('a');
            });
            assert.equal(gs.challenges().apprentice, true);
            assert.equal(gs.challenges().alliterator, false);
        });
    });

    // ======================================================================
    describe('Type A: team mode', () => {
        const SIX = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
        const TEAMS_OF = [['p1', 'p3', 'p5'], ['p2', 'p4', 'p6']];

        function teamGame(opts: any = {}): JJGameState {
            const gs = new JJGameState(SIX);
            gs.start_game({ seed: 5, teams: TEAMS_OF, ...opts });
            return gs;
        }

        /** Both pickers act: the band, then a word inside it. */
        function pick(gs: JJGameState, tier: 'easy' | 'medium' | 'hard' = 'medium') {
            gs.choose_tier(gs.choosePicker()!.pickerId, tier);
            const idx = tier === 'easy' ? 0 : tier === 'medium' ? 2 : 4;
            gs.choose_word(gs.choosePicker()!.pickerId, idx + 1);
        }

        /** Spell two short clues in lane `li`, then STOP into its guess. */
        function laneToGuess(gs: JJGameState, li: number) {
            const sp = () => gs.currentSpellerId(li)!;
            gs.add_letter(sp(), 'A');
            gs.stop_clue(sp(), 'B');
            gs.stop_clue(sp(), 'C');
            gs.stop_clue(sp());
        }

        it('validates the teams', () => {
            const gs = new JJGameState(SIX);
            assert.throws(() => gs.start_game({ teams: [['p1', 'p2'], ['p3', 'p4', 'p5', 'p6']] }), /at least 3/);
            assert.throws(() => gs.start_game({ teams: [['p1', 'p2', 'p3'], ['p4', 'p5', 'zz']] }), /exactly one team/);
            assert.throws(() => gs.start_game({ teams: [['p1', 'p2', 'p3'], ['p3', 'p4', 'p5', 'p6']] }), /exactly one team/);
        });

        it('builds two lanes, turns off hints, and keeps seats within a team', () => {
            const gs = teamGame({ hints: true });
            assert.equal(gs.lane_count(), 2);
            assert.equal(gs.get_data().hintsEnabled, false);
            assert.deepEqual(gs.lane(0).seats, TEAMS_OF[0]);
            assert.equal(gs.laneOf('p4'), 1);
            for (const li of [0, 1]) {
                assert.ok(TEAMS_OF[li].includes(gs.guesserId(li)));
                assert.ok(TEAMS_OF[li].includes(gs.chooserId(li)));
            }
        });

        it('one team picks the band, the other picks the word inside it', () => {
            const gs = teamGame();
            const tierLane = gs.get_data().tierLane;
            const first = gs.choosePicker()!;
            assert.equal(first.step, 'tier');
            assert.equal(first.pickerId, gs.chooserId(tierLane));
            assert.throws(() => gs.choose_tier(gs.chooserId(1 - tierLane), 'hard'), /other team/);
            assert.throws(() => gs.choose_word(first.pickerId, 0), /difficulty first/);
            gs.choose_tier(first.pickerId, 'hard');
            const second = gs.choosePicker()!;
            assert.equal(second.step, 'word');
            assert.equal(second.pickerId, gs.chooserId(1 - tierLane));
            assert.throws(() => gs.choose_word(second.pickerId, 0), /chosen difficulty/);
            assert.throws(() => gs.choose_word(first.pickerId, 4), /other team/);
            gs.choose_word(second.pickerId, 5);
            assert.equal(gs.get_data().phase, Phase.Spell);
            assert.equal(gs.secretWord(), gs.currentCardWords()![5]);
        });

        it('lanes spell concurrently and independently', () => {
            const gs = teamGame();
            pick(gs);
            const s0 = gs.currentSpellerId(0)!, s1 = gs.currentSpellerId(1)!;
            assert.equal(gs.laneOf(s0), 0);
            assert.equal(gs.laneOf(s1), 1);
            gs.add_letter(s1, 'Z');
            gs.add_letter(s0, 'Q');
            assert.deepEqual(gs.clueStrings(0), ['Q']);
            assert.deepEqual(gs.clueStrings(1), ['Z']);
            assert.throws(() => gs.add_letter(s0, 'X'), /turn/, 'turn moved on in lane 0');
        });

        it('a finished team watches until the other team guesses, then both reveal', () => {
            const gs = teamGame();
            pick(gs, 'easy');
            const word = gs.secretWord()!;
            laneToGuess(gs, 0);
            gs.submit_guess(gs.guesserId(0), word);
            assert.equal(gs.phase(0), Phase.Watch);
            assert.equal(gs.phase(1), Phase.Spell);
            assert.equal(gs.score(0), 1);
            laneToGuess(gs, 1);
            assert.throws(() => gs.submit_guess(gs.guesserId(0), word), /watch/, 'one guess per team per round');
            gs.submit_guess(gs.guesserId(1), 'NOPE');
            assert.equal(gs.get_data().phase, Phase.Reveal);
            assert.equal(gs.score(1), 0);
            assert.ok(!gs.get_data().deck.includes(gs.get_data().cardId!), 'scored by someone → card leaves');
        });

        it('only the rival team can overrule a near-miss', () => {
            const gs = teamGame();
            pick(gs);
            laneToGuess(gs, 0);
            laneToGuess(gs, 1);
            gs.submit_guess(gs.guesserId(0), 'NOPE');
            gs.submit_guess(gs.guesserId(1), 'NADA');
            const lane1Member = gs.lane(1).seats[0];
            gs.allow_guess(lane1Member);                // team 1 is generous to team 0
            assert.equal(gs.score(0), 2, 'a Medium word is worth 2');
            assert.equal(gs.score(1), 0);
            assert.equal(gs.lane(0).history[0].overruled, true);
        });

        it('rotates Guessers within each team, alternates the band picker, and names a winner', () => {
            const gs = teamGame({ rounds: 3 });
            const firstTierLane = gs.get_data().tierLane;
            const g0 = gs.lane(0).guesserIdx, g1 = gs.lane(1).guesserIdx;
            for (let r = 0; r < 3; r++) {
                assert.equal(gs.get_data().tierLane, r % 2 === 0 ? firstTierLane : 1 - firstTierLane);
                assert.equal(gs.lane(0).guesserIdx, (g0 + r) % 3);
                assert.equal(gs.lane(1).guesserIdx, (g1 + r) % 3);
                pick(gs);
                laneToGuess(gs, 0);
                laneToGuess(gs, 1);
                gs.submit_guess(gs.guesserId(0), gs.secretWord()!);
                gs.submit_guess(gs.guesserId(1), r === 0 ? gs.secretWord()! : 'NOPE');
                gs.next_round('p1');
            }
            assert.equal(gs.get_data().phase, Phase.Done);
            // Medium = 2 each; round 1 both right and team 0 locked in first → +0.5
            assert.equal(gs.score(0), 6.5);
            assert.equal(gs.score(1), 2);
            assert.equal(gs.winner(), 0);
        });

        it('scores the band: Easy 1, Medium 2, Hard 3', () => {
            for (const [tier, pts] of [['easy', 1], ['medium', 2], ['hard', 3]] as const) {
                const gs = teamGame();
                pick(gs, tier);
                laneToGuess(gs, 0);
                laneToGuess(gs, 1);
                gs.submit_guess(gs.guesserId(0), gs.secretWord()!);
                gs.submit_guess(gs.guesserId(1), 'NOPE');
                assert.equal(gs.score(0), pts, tier);
                assert.equal(gs.score(1), 0);
                assert.equal(gs.lane(0).history[0].bonus, 0, 'no bonus when only one team scores');
            }
        });

        it('when both teams get it, whoever guessed first earns +0.5', () => {
            const gs = teamGame();
            pick(gs, 'hard');
            laneToGuess(gs, 1);
            gs.submit_guess(gs.guesserId(1), gs.secretWord()!);   // team 1 first
            laneToGuess(gs, 0);
            gs.submit_guess(gs.guesserId(0), gs.secretWord()!);
            assert.equal(gs.score(1), 3.5);
            assert.equal(gs.score(0), 3);
            assert.equal(gs.lane(1).history[0].bonus, 0.5);
        });

        it('an overruled near-miss can still earn the speed bonus if that team was first', () => {
            const gs = teamGame();
            pick(gs, 'easy');
            laneToGuess(gs, 0);
            gs.submit_guess(gs.guesserId(0), 'CLOSEENOUGH');        // team 0 first, but wrong
            laneToGuess(gs, 1);
            gs.submit_guess(gs.guesserId(1), gs.secretWord()!);
            assert.equal(gs.score(1), 1);
            gs.allow_guess(gs.lane(1).seats[0]);
            assert.equal(gs.score(0), 1.5, 'team 0 locked in first');
            assert.equal(gs.score(1), 1, 'team 1 loses the bonus it never had');
        });

        it('a half-point decides the winner', () => {
            const gs = teamGame({ rounds: 3 });
            for (let r = 0; r < 3; r++) {
                pick(gs, 'medium');
                laneToGuess(gs, 0);
                laneToGuess(gs, 1);
                const first = r === 0 ? 1 : 0;
                gs.submit_guess(gs.guesserId(first), gs.secretWord()!);
                gs.submit_guess(gs.guesserId(1 - first), gs.secretWord()!);
                gs.next_round('p1');
            }
            assert.equal(gs.score(0), 7);
            assert.equal(gs.score(1), 6.5);
            assert.equal(gs.winner(), 0);
        });

        it('co-op still scores 1 per word, whatever the difficulty', () => {
            const gs = fresh();
            playToGuess(gs, ['AB', 'CD', 'EF'], 5);
            gs.submit_guess(gs.guesserId(), gs.secretWord()!);
            assert.equal(gs.score(), 1);
        });

        it('Jibber!/Jabble? stay in your lane; faces are public and work while watching', () => {
            const gs = teamGame();
            pick(gs);
            gs.signal('p2', 'jibber');
            assert.equal(gs.lane(1).signals.length, 1);
            assert.equal(gs.lane(0).signals.length, 0);
            laneToGuess(gs, 0);
            gs.submit_guess(gs.guesserId(0), 'NOPE');
            assert.throws(() => gs.signal('p1', 'jabble'), /watch/);
            gs.signal('p1', 'laugh');
            assert.deepEqual(gs.get_data().emotes.map(e => [e.by, e.kind]), [['p1', 'laugh']]);
        });
    });

    // ======================================================================
    describe('Type B: integration (GameRuleTest)', () => {
        function gsFrom(test: GameRuleTest): JJGameState {
            const raw: any = test.getHostData('gameState');
            return typeof raw?.get_data === 'function' ? raw : JJGameState.from_data(raw.data, raw.playerIds);
        }

        function rig(clients = 3) {
            const test = new GameRuleTest('jibberjabble', clients);
            const props: Record<string, any> = {};
            const ids: string[] = [];
            for (let i = 0; i < clients; i++) {
                const cid = test.getPlayerClientId(i);
                ids.push(cid);
                (test as any).clientsGameObjects[i].setViewCallback((_v: string, p: any) => { props[cid] = p; });
            }
            const as = (id: string, method: string, ...args: any[]) => {
                const i = ids.indexOf(id);
                if (i === -1) test.invokeHostMethod(method, ...args);
                else test.invokeClientMethod(i, method, ...args);
            };
            return { test, props, ids, as };
        }

        it('refuses to start with fewer than 3 players', () => {
            const test = new GameRuleTest('jibberjabble', 1);
            assert.throws(() => test.invokeHostMethod('startGame'));
        });

        it('plays a round through the RPC surface, hiding the word from the Guesser', () => {
            const { test, props, ids, as } = rig(3);
            test.invokeHostMethod('startGame');
            let gs = gsFrom(test);
            assert.equal(gs.get_player_order().length, 4);

            as(gs.chooserId(), 'chooseWord', 2);
            gs = gsFrom(test);
            const secret = gs.secretWord()!;
            const guesser = gs.guesserId();

            for (const cid of ids) {
                const p = props[cid];
                assert.ok(p && p.jj && p.my, 'client got props');
                assert.equal(p.jj.phase, Phase.Spell);
                if (cid === guesser) {
                    assert.equal(p.my.secret, null);
                    assert.equal(p.my.cardWords, null);
                    assert.ok(!JSON.stringify(p.jj).includes(`"${secret}"`), 'public props never carry the word');
                } else {
                    assert.equal(p.my.secret, secret);
                }
            }

            for (const ch of 'FISH') as(gsFrom(test).currentSpellerId()!, 'addLetter', ch);
            as(gsFrom(test).currentSpellerId()!, 'signal', 'jibber');
            as(gsFrom(test).currentSpellerId()!, 'stopClue', 'W');
            as(gsFrom(test).currentSpellerId()!, 'addLetter', 'E');
            as(gsFrom(test).currentSpellerId()!, 'stopClue', 'B');
            as(gsFrom(test).currentSpellerId()!, 'stopClue');
            gs = gsFrom(test);
            assert.equal(gs.phase(), Phase.Guess);
            assert.deepEqual(gs.clueStrings(), ['FISH', 'WE', 'B']);

            as(guesser, 'submitGuess', secret);
            gs = gsFrom(test);
            assert.equal(gs.phase(), Phase.Reveal);
            assert.equal(gs.lane().score, 1);
            if (ids.includes(guesser)) assert.equal(props[guesser].my.secret, secret, 'revealed to all');

            as(guesser, 'nextRound');
            gs = gsFrom(test);
            assert.equal(gs.get_data().round, 2);
            assert.notEqual(gs.guesserId(), guesser);
        });

        it('team mode: rival clues stay hidden until your own team has guessed', () => {
            const { test, props, ids, as } = rig(5);              // host + 5 = 6 players
            test.invokeHostMethod('setOption', 'mode', 'teams');
            test.invokeHostMethod('startGame');
            let gs = gsFrom(test);
            assert.equal(gs.is_team_mode(), true);
            assert.ok(gs.lane(0).seats.length >= 3 && gs.lane(1).seats.length >= 3);

            const pk = () => gsFrom(test).choosePicker()!;
            as(pk().pickerId, 'chooseTier', 'easy');
            as(pk().pickerId, 'chooseWord', 1);
            gs = gsFrom(test);
            const secret = gs.secretWord()!;

            // lane 0 spells & guesses; lane 1 has spelled one letter
            const sp = (li: number) => gsFrom(test).currentSpellerId(li)!;
            as(sp(1), 'addLetter', 'R');
            as(sp(0), 'addLetter', 'A');
            as(sp(0), 'stopClue', 'B');
            as(sp(0), 'stopClue', 'C');
            as(sp(0), 'stopClue');
            as(gsFrom(test).guesserId(0), 'submitGuess', 'NOPE');
            gs = gsFrom(test);
            assert.equal(gs.phase(0), Phase.Watch);

            for (const cid of ids) {
                const p = props[cid];
                const li = gs.laneOf(cid);
                assert.equal(p.jj.teamMode, true);
                assert.equal(p.jj.myTeam, li);
                if (li === 0) {
                    assert.equal(p.jj.phase, Phase.Watch);
                    assert.equal(p.jj.rival.visible, true);
                    assert.deepEqual(p.jj.rival.clues.map((c: any) => c.letters.map((l: any) => l.ch).join('')), ['R']);
                    assert.equal(p.my.secret, secret, 'a finished Guesser learns the word');
                } else {
                    assert.equal(p.jj.phase, Phase.Spell);
                    assert.equal(p.jj.rival.visible, false);
                    assert.equal(p.jj.rival.clues, null);
                    assert.equal(p.jj.rival.guesses, null);
                    assert.equal(p.jj.rival.status, Phase.Watch, 'progress is public');
                    assert.ok(!p.jj.allHistory.some((h: any) => h.round === gs.get_data().round), 'no current-round records leak');
                    if (cid === gs.guesserId(1)) assert.equal(p.my.secret, null);
                }
            }
        });
    });
});

/** From mid-Spell: three short clues then stop. */
function playToGuessFromSpell(gs: JJGameState) {
    spell(gs, 'AB');
    gs.stop_clue(gs.currentSpellerId()!, 'C');
    gs.stop_clue(gs.currentSpellerId()!, 'D');
    gs.stop_clue(gs.currentSpellerId()!);
}
