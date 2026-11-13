# Décorum — design notes

Cooperative hidden-information decorating game for 2–4 players (Floodgate Games, 2022).
Implemented in `src/rules/decorum/`; registry key `decorum` (debug: `decorum-debug`);
tests in `src/tests/decorum/test_decorum.ts`.

## Files

| File | Role |
| --- | --- |
| `scenario/model.ts` | House model: rooms, zones, the 12 objects (type × style → colour), moves |
| `scenario/conditions.ts` | Condition language: filters, conditions, `evaluate`, `describe` (segments for glyphs) |
| `scenario/twists.ts` | House twists: definitions, `twistError` legality, turn memo, wording |
| `scenario/generator.ts` | Seeded, contradiction-free scenario generator + scenario codes |
| `scenario/rng.ts` | mulberry32 PRNG |
| `DecorumData.ts` | Round track, hearts, reactions, moods; re-exports the library |
| `DecorumGameState.ts` | Pure engine (turns, reactions, meetings, scoring) |
| `DecorumMethods.ts` / `decorum.tsx` | RPC methods and the rule (prop distribution, secrecy) |
| `views/DecorumArt.tsx` | Flat 2.5D vector art: dollhouse, 12 objects, glyphs, hearts, faces |
| `views/DecorumViews.tsx` / `DecorumBits.tsx` | Screens |
| `DecorumSound.ts` | WebAudio SFX (same synth core as Hooky) |

The `scenario/` folder has no React or Multiplayr dependencies.

## Rules as implemented

- House: bathroom (top-left), bedroom (top-right), living room (bottom-left), kitchen (bottom-right).
  Upstairs = bath + bed, downstairs = living + kitchen, left = bath + living, right = bed + kitchen.
- Objects: lamp M/A/R/U = blue/yellow/red/green; wall hanging = red/green/blue/yellow; curio = green/blue/yellow/red.
  Supply is unlimited (the physical game has 4 of each, which can never run out with 4 rooms).
- Turn: one change — add to an empty slot, remove, swap within the same slot (same type), paint a room
  (a different colour). Pass only when all your conditions are met (engine-enforced).
- Fulfillment check: after your own action, your public "fulfilled" badge is updated. The game is won the
  moment every player is fulfilled after any action.
- Comments: positive / neutral / negative reaction to the latest change. **2 players:** the partner must
  react before taking their own turn (engine-enforced). **3–4 players:** optional.
- Round track as segments: 2p `[15, 5, 5, 5]`, 3–4p `[5, 5, 5, 5, 5, 5]`. A meeting follows each segment but
  the last, flips one heart, and restarts the round count at 1 with player one. The final segment ending = game over.
- Early meeting: before the first meeting, if every player votes for it, it happens immediately.
- Heart-to-Heart (2p): each player reveals one condition to the partner (revealed as soon as submitted,
  so the second can react to the first).
- House Meeting (3–4p): each player picks a mood line (optionally naming a housemate) and shares one condition
  with one housemate. Recipient-only; *who shared with whom* is public (handing a card over is visible).
- Scoring: 3 points per condition met; if all are met, +2 per face-up heart.

## Roommates board (3–4 players)

3–4 player games always use the roommates board (`boardFor(players)`):

- Both upstairs rooms are bedrooms. Room ids don't change — `bath` is shown as the **left bedroom**, `bed` as the
  **right bedroom** (`roomName(room, board)`); everything that names a room takes the board.
- Each seat sleeps in one bedroom, at most two per bedroom (3 players: 2 + 1, 4 players: always 2 + 2).
  Engine state `beds[seat]`; public (the tokens are on the board), drawn as flat discs in the player's colour
  with their lobby icon (white inner ring = you).
- **Switch rooms** (`switch_rooms(id, kick)`): instead of decorating, move to the other bedroom. If it is full,
  name one of its occupants to kick out; they take your old bedroom. It is a turn like any other: logged
  (`kind: 'switch'`, with `bedsBefore`), reacted to, and in the UI staged + previewed before confirming. With
  4 players every switch kicks someone.
- Relative conditions (`isRoommateCond`): zones `mine` / `other` ("your bedroom", "the other bedroom") with the
  usual has / not / count / matchWall kinds, plus `with` / `apart` (share / don't share a bedroom with a seat)
  and `alone` (3 players only, in practice). `evaluate(cond, house, ctx)` takes `ctx = { beds, seat }` — the
  owner's seat — and relative conditions are false without it. Every condition check in the engine and views
  passes the owner's context; shared conditions are judged for their owner.
- Wording (`describe(cond, { board, owner, seatName })`): your own card says "Your bedroom…" / "You must share a
  bedroom with Ben"; shown to someone else it says "Ada's bedroom…" / "Ada must share a bedroom with you".
  Player names in conditions render with their icon and colour (`DCText` context in `DecorumBits`).

## House twists

Per-scenario rule modifiers (`Scenario.twists`, public). The seed draws them from a separate random stream
(`pickTwists`), so scenarios that draw none are identical to twist-free ones. Count by level: Easy 0–1 (gentle
ones only: cat, heirloom, sold-out paint, strong opinions), Medium 1, Hard 1–2, Expert 2–3. At most one per
group (`TWIST_GROUP`): turn rules and talking twists don't stack. The host can switch twists off in the lobby;
such codes end in `-N` (`3H-1A2B-N`).

| Twist | Kind | Rule | How the generator keeps it solvable |
| --- | --- | --- | --- |
| `cat` | special token | `house.pet`; a turn may walk it to a neighbouring room (`Move` kind `'cat'`, not diagonal). Optional `avoid` colour: it won't walk into rooms painted that. Conditions `catIn`/`catOut` (zone, incl. "your bedroom") and `catNear`/`catAway` (what its room holds). | Witness places the cat (never in an `avoid` room); one random seat's card, plus others with p = .45, get one cat condition; the setup usually moves the cat. |
| `heirloom` | lock | One object can never be removed or swapped. | Chosen from the witness's objects; the scramble never touches it. |
| `keeper` | restricted room | Only one seat may change a room. | Nothing needed — the keeper can always do it; the selfish play-out obeys it. |
| `shortage` | limit | At most N objects of a style in the house (add/swap blocked at the cap). | Style used ≤ 2× by the witness, N = its count (≥ 1); setups over the cap are rejected. |
| `soldOut` | limit | Nobody can paint a wall that colour. | Colour on ≤ 1 witness wall; those walls are locked in the scramble. |
| `noRepeat` | turn rule | You can't change the room you changed on your previous turn. | Selfish play-out tracks a `Memo`. |
| `wetPaint` | turn rule | You can't change the room the previous player just changed. | Same. |
| `binary` | talking | No neutral reaction. | — |
| `whisper` | talking | Reactions only reach the player who made the change (and the reactor); revealed in history at the end. | — (enforced in `decorum.tsx` props) |

Walking the cat isn't "changing a room": the cat ignores keeper/turn rules and resets your memo slot. The
engine derives the `Memo` from the log (`memo()`), checks `twistError` in `act`, and rejects `meh` under
`binary`. Views lock forbidden options in the change sheet with the reason, shade rooms you can't touch this
turn (keeper / turn rules), show twist chips under the round track, and add "Walk the cat" next to Pass.

Twists change difficulty through the selfish play-out (which obeys them). With the first tuning, twists on
gave selfish wins Easy 89–96%, Medium 66–70%, Hard 43–57%, Expert 19–21%; the level settings were then raised
a notch (see the generator section for current numbers).

**Ideas not implemented (yet).** Path-dependent goals ("the cat must visit a room with each colour at least
once") don't fit the witness-first method, which checks a final state; they would need the log and a
reachability argument. Others that would fit: a second pet with a different gait (a dog that moves two rooms,
or a fish bowl that is moved like an object); "sealed" rooms that unlock after the first meeting; a
renovation token that freezes the room it's in until someone moves it; actions you may only take on alternate
turns ("no painting two turns running" per player); seat-locked actions ("only Ben may paint"); a mute
housemate (one player can't react at all); delayed reactions (revealed one turn later); meetings where you
share with your neighbour instead of choosing; a public "house wish" all cards must also satisfy.

## Deliberate deviations

- **Generated scenarios instead of the campaign.** No fixed scenario cards are used.
- **Small cards:** in the box, 3–4p players hand physical small cards around and can take them back later.
  Here, sharing is knowledge: once shown, the recipient keeps seeing it. You can't share the same condition
  with the same person twice; with nothing new to share you skip.
- **3 players:** the box distributes a phantom 4th player's red cards. The generator instead gives each of
  the 3 players more conditions (see table).
- **Roommates board for every 3–4 player game** (not only special scenarios), with generated relative
  conditions instead of printed "your room" cards. No leftmost/rightmost conditions — the board's slot order
  isn't meaningful in this layout.
- **Digital aids:** your own conditions show live ticks; tapping any room lets *anyone* preview a change
  and see its effect on their own card (and on conditions shared with them). Only the active player can confirm.
- Communication is limited to the three reaction faces (with a canned line) and meeting mood lines.

## Scenario generator

`generateScenario({ players, level, seed })` — deterministic. Guarantees, all checked by `auditScenario` and tests:

1. **No contradictions.** A random *solution* house is rolled first; every condition is kept only if it is
   true in that house. The solution is a witness that all cards are jointly satisfiable. It is revealed at
   the end ("Show one house that works").
2. **Nobody starts fulfilled.** The setup is the solution with *k* distinct features changed, re-rolled until
   every seat has ≥ 1 unmet condition and enough are unmet overall.
3. **No dead weight.** Conditions with probability outside the level's band on random houses are rejected
   (trivial / near-impossible), as are duplicates, conditions equivalent to another on every sampled house,
   and conditions redundant with the rest of the card (no sampled house satisfies the rest but not it).
4. **At most two of a kind per card, one of each tier-3 kind.**

Condition kinds (tiers): has / not / count ≥ (1) · every-room, exactly / at most, same wall colour,
matches its wall (2) · more X than Y, most common colour/style, all walls different, inseparable,
no identical objects (3).

| Level | Tier weights | Conditions per seat (2p / 3p / 4p) | Setup changes | Tension pull | Selfish-play floor (rounds) |
| --- | --- | --- | --- | --- | --- |
| Easy | .7 / .3 / 0 | 4+4 / 3 / 3 | 5–7 | 0.4 | 4 |
| Medium | .25 / .5 / .25 | 5+5 / 4 / 4 | 8–9 | 0.7 | 9 |
| Hard | .15 / .45 / .4 | 6+6 / 5 / 4 | 9–11 | 0.9 | 11.5 |
| Expert | .05 / .4 / .55 | 6+6 / 5 / 5 | 10–12 | 0.95 | 13 |

"Tension pull" is the chance a slot insists on a condition negatively correlated (phi ≤ −0.04 over random
houses) with another seat's condition — the source of the game's compromises.

**Selfish play-out (the main difficulty signal).** `selfishPlay` simulates players who each turn make the
change that best improves *their own* card, blind to everyone else (fulfilled players pass), capped at
12 rounds. The original tuning only scored how obscure conditions were, and selfish play won ~95% of Hard
2p games in ~3 rounds — the "too easy" report (2026-11-09). Now harder levels try several starting houses
and keep the one selfish play finds hardest, build more candidates (6 / 8 / 10 / 10), and the score is
dominated by selfish rounds (`score = static·5/conditions + selfishRounds·5`, targets 42 / 74 / 94 / 108).
Second re-tune (2026-11-10, "still slightly easy"): every level moved up a notch — table above. Measured
with twists on, 24 seeds × 8 play-outs, selfish wins: Easy 81–90% (~5 rounds), Medium 53–58% (~9.6),
Hard 29–35% (~12), Expert 8–9% (~13.5); generation ≤ 0.2 s Medium, ≤ 0.6 s Expert.

First re-tune, independent re-check (fresh randomness, 24 seeds × 8 play-outs, before twists):

| Level | Selfish wins within 12 rounds | Mean rounds | Generation time |
| --- | --- | --- | --- |
| Easy | 91–97% | ~3.5 | ~25 ms |
| Medium | 69–78% | ~7.3 | 70–115 ms |
| Hard | 51–57% | ~10.3 | 250–290 ms |
| Expert | 27–40% | ~12 | 360–560 ms |

Measuring tension on near-solution houses instead of random ones was tried and dropped: no measurable gain,
twice the generation time. Changing the generator changes what every scenario code builds.

**Roommates board.** The witness also includes a bedroom assignment (`randomBeds`), samples pair random houses
with random assignments, and relative conditions are measured for their owner's seat. Each card gets at least
one roommate condition (the first slot) and at most two (later slots ask with p = 0.22), at most one of
`with` / `apart` / `alone`. The setup re-rolls the bedrooms 70% of the time, so people usually start in the
"wrong" rooms; `distance` counts moved seats too. The selfish play-out and `contested` include switches.
Measured at 16 seeds × 8 play-outs, the roommate levels land in the same bands as before (selfish wins: Easy
95–97%, Medium 76–80%, Hard 54–63%, Expert 21–26%) and generate faster (≤ 0.34 s for 4-player Expert).
2-player scenarios are unchanged (same codes, same scenarios).

**Scenario code:** `<players><E|M|H|X>-<seed base36>[-N]`, e.g. `3H-1A2B3C` (`-N` = no twists). Entering one in the lobby replays it
(ignored if the player count differs); the host can also "Replay this one" from the results.
