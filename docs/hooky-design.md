# Hooky — consolidated rules & implementation notes

Source: Hooky (Rio Grande Games, 2023, James Miller). The official PDF
(riograndegames.com) refused automated fetch; rules below come from the
rulespal.com transcription and need a check against the PDF if available.

## Components
- 26 letter cards, A–Z, each exactly once (each is a "student").
- 6 round cards (just a round counter digitally).
- Per-player private worksheet (notes) — digital: a deduction grid.

## Setup
| Players | Hand | Playground (face-down) | Hooky (hidden) |
|---|---|---|---|
| 3 | 7 | 2 | 3 |
| 4 | 5 | 3 | 3 |
| 5 | 4 | 3 | 3 |

Start player is random and fixed for the whole game; turn order clockwise.

## Flow
1. **Initial clues** — each player in turn order says a 5-letter word containing
   ≥1 of their own letters, and announces their own count for it.
2. **Rounds 1–6** — each player takes one turn per round:
   - Pick another player + a 5-letter word; target's count is public.
   - **Count rule:** per position in the word, +1 if that letter is in the target's
     hand (repeats count each time: NEVER with {N,E} → 3). Revealed cards still count.
   - May not ask the same opponent the same word, or an anagram of a word already
     asked to that opponent. No passing.
   - **Reveal (round 2+), optional, once per turn, before or after the question:**
     flip one of your own unrevealed cards face up (stays in hand), then privately
     peek at one random card from a chosen opponent's hand (target doesn't learn which).
3. **End of rounds 1, 2, 3** — reveal one Playground card (3p: rounds 1–2 only).
4. **End of rounds 4, 5, 6** — every player secretly guesses 3 distinct Hooky letters
   (repeats across rounds allowed, mandatory).
5. **Final** — after round 6's Hooky guess, each player assigns letters to every
   opponent's hand (full hand size each). Then reveal everything and score.

## Scoring (no penalties)
- Hooky guess after round 4 or 5: 5 pts per correct letter.
- Hooky guess after round 6: 10 pts per correct letter.
- 1 pt per correct (letter, owner) in hand guesses.
- +1 per opponent whose whole hand is guessed exactly.
- Ties: (1) earliest round with a correct Hooky letter, (2) most correct Hooky
  letters in that earliest round, (3) fewest cards revealed.

## Design decisions (agreed with user, 2026-11-05)
- **Words:** bundled ~12k 5-letter list. An unknown word triggers an "Unrecognised
  word, use anyway?" prompt for the asker only. It is then flagged in the log, and
  the table challenges it verbally.
- **Initial clues:** the player types a word containing ≥1 of their own letters
  (enforced). The server computes the count and publishes it.
- **Repeat rule:** reject a word whose sorted letters match any word already asked
  to that same target, by any asker.
- **Reveal/peek:** target is chosen by the asker. The peek draws randomly from the
  target's *unrevealed* cards only. A target with none can't be chosen. A player
  with no unrevealed cards can't reveal.
- **Deduction aids:** (a) a public auto question log covering initial clues, asks,
  reveals and playground. (b) A private manual grid of letters × (each player +
  Hooky), auto-filled with first-level certainties only: own hand, revealed cards,
  playground cards, peeked cards, and the "not elsewhere" consequences of those.
  Everything else is left to the player.
- **Tie-breaks:** earliest round (4/5/6) with ≥1 correct Hooky letter, then the most
  correct letters in that round, then fewest reveals, then a shared win.
- **Players:** 3–6.
  - 6p (unofficial): hand 3, Hooky 3, Playground 5, and **5 rounds**.
  - 6p Playground: 3 face-up at setup, then 1 after each of rounds 1 and 2. All
    Playground cards are out before the first Hooky guess, as in the base game.
    (Claude chose this because "2 at start + 3 later" did not fit 5 rounds.)
  - 6p Hooky guesses: after rounds 3, 4 and 5. The round-5 guess is the final one
    and scores 10 per letter; earlier guesses score 5.
- Hand-guess at the end: per opponent, pick exactly hand-size letters. The bonus
  needs an exact match of that opponent's full hand.

## Implementation (2026-11-05)
- Code: `src/rules/hooky/` (engine `HookyGameState.ts`, data `HookyData.ts`, word list
  `HookyWords.ts`, views in `views/`), tests `src/tests/hooky/test_hooky.ts`, registry key `hooky`.
- Word list: 12,970 words, the union of the public Wordle answer and allowed-guess lists.
- Deduction sheet notes are client-side only (localStorage `hooky_notes_<gameId>_<clientId>`), not in
  the shared game state, so marking a cell costs no network round trip.
- Student names (Abby…Zed) and face doodles are original, not the published card art.
