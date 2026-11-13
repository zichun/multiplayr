# Seconds, Please! — implementation notes

Rule key: `schadenfreude` (`src/rules/schadenfreude/`), tests in `src/tests/schadenfreude/`.
A family-friendly re-theme of **Schadenfreude** (Yoshiharu Nakahara / Office Dog Games): the same
trick-taking rules with a dessert-picnic skin and original flat geometric art.

## Source
- English rulebook PDF supplied by the user (`Schadenfreude_Rulebook_English.pdf`, 8 pages).

## Theme mapping
| Rulebook | Seconds, Please! |
| --- | --- |
| 4 coloured suits | Cupcakes (Strawberry), Ice Cream (Mint), Donuts (Blueberry), Lollipops (Lemon). Each suit has its own silhouette, so suits read without colour. |
| Jester 0 / Jester 10 | Rainbow 0 / Rainbow 10 (gradient cards, star glyph) |
| Score area | Your **plate** (face-up, visible to everyone) |
| Score tracker 0–40 | **Tummy meter**; the danger zone past 40 is striped red |
| Falling off the castle (> 40) | **Too full**: you can't win |
| Duplicate discard | **Twin treats cancel** |

## Rules as implemented
- 3–5 players (host plays). Deck: 4 suits × {−3, −2, −1, 1…9} + Rainbow 0 and 10 = 50 cards.
  3p removes −2, −1, 9 from each suit (38 cards) and deals 12 each. 4p deals 12, 5p deals 10.
  Leftovers are set aside unseen.
- The first leader is random. Follow the lead suit if able. Rainbows count as the lead suit and are
  always legal, but you're never forced to play one. After a Rainbow lead, the next standard card
  sets the suit.
- The winner is the **second-highest** card among lead-suit + Rainbow cards. A lone card in the lead
  suit wins by itself, so the Rainbow 0 can win as the second of two.
- The winner takes their own card plus every off-suit, non-Rainbow card; the rest are discarded.
  Taken cards are added to the plate one at a time, and a matching value cancels both. Three of a
  kind leaves one.
- Round end: the plate total moves the meter, which never goes below 0. If anyone is over 40, the
  game ends: the highest score ≤ 40 wins. Tied players are eliminated, so it's possible nobody wins.
  If everyone is over 40, the highest score wins, with the same tie rule.
- Next round: the lowest score leads; if players tie for lowest, they're skipped and the next
  lowest unique score leads. If no score is unique, the leader is random.

## Architecture
- `SchadenfreudeGameState.ts`: a pure engine. Card play is two-step: `play_card` → when the trick is
  full it stores `resolvingTrick` (winner, ranking, taken/discarded ids, twin `cancelIds`), and
  `finish_trick()` (host-only RPC, idempotent) commits it. This is the same pattern as Cat in the Box.
- `views/SchadenfreudeViews.tsx`: trick resolution animation adapted from Cat in the Box:
  `rank` (1st/2nd badges, winner pulses) → `sort` (discards flip face-down, taken cards lift,
  twins wobble with a "Twin!" tag, and the matching plate tile wobbles too) → `collapse` → `fade` →
  the host calls `finishTrick`.
- The meter shows the current score plus a striped projection of score + plate (green when the
  plate is negative, red when it would bust).
- Styles are scoped under `.sf-root` / `sf-*` to avoid Cat in the Box's global class names.
