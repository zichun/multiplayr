# Critter Kitchen — implementation notes

Rule key: `critterkitchen` (`src/rules/critterkitchen/`), tests in `src/tests/critterkitchen/`.

## Sources
- Base rulebook: official PDF from cardboardalchemy.com (`CritterKitchen_Rulebook.pdf`).
- À La Cart expansion rulebook + the Deluxe complete card list (xlsx) supplied by the user.

## Scope
Implemented: the base multiplayer game for **2–5 players** — restaurateur draft, secret planning,
shopping queues with the priority track, consolation soup / leaving early, rumors (incl. wilds and
reveal-when-everyone-knows), Midnight Merchant / Chef Academy / Soup Truck behaviour, challenge meals
with the hold token, refrigeration, the critic meal and full final scoring (all 28 rumors).

Cards: all 12 base + 4 expansion critics, 10 base + 6 expansion/promo restaurateurs, 12 base
zous-chefs and the 16 expansion zous-chefs whose abilities resolve without extra prompts.

**Not included:** carts, solo McDogald's, the 6–7 player mode (Break Time + Mystery Die), and the
expansion zous-chefs that need extra choices (Atticus, Billy, Dottie, Emma, Lenore, Lulu, Mack, Marty,
Pocket, Spike, Rudy, Cosmo).

## Interpretations / reconstructions
- **Item spaces** per board are read off the rulebook art: Garden 3, Desert 4, Water 3, Air Docks 4,
  Lantern Lake 4, Midnight Merchant 5 (4 on the 2-player side), Chef Academy +2 bag items in 2p.
- Course order on the critic plate: bread, carrot, cheese, fish, meat, mushroom, wine.
- "Value before spice" includes Kangaroo (6→9) and Rabbit (carrot ×2); restaurateur challenge
  bonuses (Bobcat, Goat'n Ramsay) apply before the Rabbit doubling (per the clarification).
- **Hyena**: the extra 3-value ingredients in the fish course may total no more than the printed
  value of your highest fish.
- Wild rumors drawn from the bag by an ability go to the first unknown slot; wilds picked at a
  location go to the slot the player chooses.
- Anthony Boardain: leaving early offers soup or a bag item; a forced empty return takes the bag item.
- Mandy / Shaggy extra picks happen right after the chef's normal picks; Penny's Soup Truck pick is a
  separate prompt.
- Martha's +2★ applies each day all 3 regular challenges are served.

## Architecture
- `CKData.ts` — tables + `[icon:…]`-rich short card texts.
- `CKMeals.ts` — pure meal maths shared by host validation and the live UI previews.
- `CKGameState.ts` — serialisable engine; shopping is a step machine (`advance()` runs until a pick is
  needed). Seeded mulberry32 RNG. `auto_act(pid)` powers the host "auto-play for a stalled player" and tests.
- `critterkitchen.tsx` — per-client props: storage, plans (until all lock in) and rumor texts stay private.
- `CKAssets.ts` — palettes, negative-space coins, a parametric critter-face kit (~50 animals),
  rumor concept glyphs, card builders. Rotated non-uniform primitives are emitted as exact paths
  (the icon engine rotates inside the scaled frame, which would shear them).
- Palette keys are resolved lower-cased by the icon engine, so camelCase keys like `panelBg` can't be
  used inside icons — portrait discs use `secondary`.
