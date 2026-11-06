/**
 * QuacksData.ts — static tables for The Quacks of Quedlinburg.
 *
 * Pure data + tiny helpers, no engine logic. Three tables here are NOT printed in
 * the rulebook and are reconstructions — edit them in place if you have the
 * physical components to hand, nothing else depends on their exact values:
 *   • POT_TRACK      — coin / VP / ruby per pot space
 *   • RAT_TAIL_MARKS — where the rat tails sit on the scoring track
 *   • FORTUNE_CARDS  — the 24 fortune-teller cards (`verified: false` = stand-in)
 *   • DIE_FACES      — the bonus die's six faces
 *
 * The Herb Witches expansion tables (EXPANSION_SUPPLY, the set 5/6 book prices,
 * the herb witches and their point values) come from a fan translation that
 * prints the effects but no numbers, so every number there is a stand-in too.
 *
 * The Alchemists tables (PATIENTS — each essence card's track — and the
 * hunchback reward table) are reconstructions too: the rulebook only shows the
 * cards as unreadable thumbnails. Its four locoweed books and twenty fortune
 * cards are transcribed. Locoweed is the same ingredient as the Herb Witches'
 * fool's herb, so both expansions share the `herb` chip.
 */

// ---------------------------------------------------------------------------
// Chips
// ---------------------------------------------------------------------------

export type ChipColor = 'white' | 'orange' | 'green' | 'blue' | 'red' | 'yellow' | 'purple' | 'black' | 'herb';

/** `herb` (fool's herb) only exists in the Herb Witches expansion. */
export const CHIP_COLORS: ChipColor[] = ['white', 'orange', 'green', 'blue', 'red', 'yellow', 'purple', 'black', 'herb'];

/** A chip is its colour + value, e.g. `blue2`. Chips of a kind are interchangeable. */
export type Chip = string;

export const makeChip = (color: ChipColor, value: number): Chip => `${color}${value}`;
export const chipColor = (c: Chip): ChipColor => c.slice(0, -1) as ChipColor;
export const chipValue = (c: Chip): number => Number(c.slice(-1));

export const INGREDIENT_NAME: Record<ChipColor, string> = {
    white: 'Cherry Bomb',
    orange: 'Pumpkin',
    green: 'Garden Spider',
    blue: 'Crow Skull',
    red: 'Toadstool',
    yellow: 'Mandrake',
    purple: 'Ghost’s Breath',
    black: 'Hawkmoth',
    herb: 'Fool’s Herb'
};

/** Total chips in the box, by colour and value (rulebook component list). */
export const CHIP_SUPPLY: Record<ChipColor, Record<number, number>> = {
    white: { 1: 20, 2: 8, 3: 4 },
    orange: { 1: 22 },
    green: { 1: 15, 2: 8, 4: 13 },
    blue: { 1: 12, 2: 8, 4: 10 },
    red: { 1: 12, 2: 8, 4: 10 },
    yellow: { 1: 13, 2: 8, 4: 10 },
    purple: { 1: 17 },
    black: { 1: 17 },
    herb: {}
};

/**
 * Chips the Herb Witches box adds: fool's herbs, the new 6-pumpkins, and a fifth
 * player's starting chips (plus their round-6 cherry bomb). Reconstruction.
 */
/** The Alchemists box: 30 locoweed (fool's herb) chips. Its spare cherry bombs only replace worn ones. */
export const ALCHEMIST_SUPPLY: Partial<Record<ChipColor, Record<number, number>>> = {
    herb: { 1: 30 }
};

export const EXPANSION_SUPPLY: Partial<Record<ChipColor, Record<number, number>>> = {
    herb: { 1: 18 },
    orange: { 1: 2, 6: 8 },
    white: { 1: 5, 2: 2, 3: 1 },
    green: { 1: 1 }
};

/** Every value a colour comes in, with or without the expansion. */
export function chipValues(color: ChipColor, expansion = false): number[] {
    const vals = Object.keys(CHIP_SUPPLY[color]).map(Number);
    if (expansion) Object.keys(EXPANSION_SUPPLY[color] || {}).map(Number).forEach(v => { if (vals.indexOf(v) === -1) vals.push(v); });
    return vals.sort((a, b) => a - b);
}

export const STARTING_BAG: Chip[] = [
    'white1', 'white1', 'white1', 'white1', 'white2', 'white2', 'white3', 'orange1', 'green1'
];

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;
export const MAX_PLAYERS_EXPANSION = 5;
export const maxPlayers = (expansion: boolean) => (expansion ? MAX_PLAYERS_EXPANSION : MAX_PLAYERS);
export const PENNY_VP = 2;        // each unspent witch penny at the end
export const ROUNDS = 9;
export const BASE_THRESHOLD = 7;
export const FLASK_COST = 2;      // rubies
export const DROPLET_COST = 2;    // rubies
export const COINS_PER_VP = 5;    // final conversion
export const RUBIES_PER_VP = 2;   // final conversion
export const YELLOW_REVEAL_ROUND = 2;
export const PURPLE_REVEAL_ROUND = 3;
export const EXTRA_WHITE_ROUND = 6;

// ---------------------------------------------------------------------------
// Pot track
// ---------------------------------------------------------------------------

export interface Field { index: number; coins: number; vp: number; ruby: boolean; }

/** `coins vp ruby?` for pot spaces 1..33 — reconstruction, see file header. */
const POT_ROWS = `
1 0 | 2 0 | 3 0 | 4 0 | 5 0 r | 6 1 | 7 1 | 8 1 | 9 1 r | 10 2 | 11 2 |
12 2 | 13 2 r | 14 3 | 15 3 | 15 3 r | 16 3 | 16 4 | 17 4 | 17 4 r | 18 4 | 18 5 |
19 5 | 19 5 r | 20 5 | 20 6 | 21 6 | 21 6 r | 22 7 | 22 7 r | 23 7 | 23 8 | 24 8
`;

/** The last space a chip can sit on. Landing on or passing it fills the pot. */
export const LAST_FIELD = 33;
/** The scoring space beyond the last chip space — the spoon. */
export const SPOON_FIELD = LAST_FIELD + 1;

export const POT_TRACK: Field[] = (() => {
    const fields: Field[] = [{ index: 0, coins: 0, vp: 0, ruby: false }];
    POT_ROWS.split('|').map(s => s.trim()).filter(Boolean).forEach((row, i) => {
        const [coins, vp, ruby] = row.split(/\s+/);
        fields.push({ index: i + 1, coins: Number(coins), vp: Number(vp), ruby: ruby === 'r' });
    });
    fields.push({ index: SPOON_FIELD, coins: 35, vp: 15, ruby: false });
    return fields;
})();

export const fieldAt = (index: number): Field =>
    POT_TRACK[Math.max(0, Math.min(SPOON_FIELD, index))];

// ---------------------------------------------------------------------------
// Scoring track rat tails
// ---------------------------------------------------------------------------

/** A rat tail sits just before every VP space matching this rule (reconstruction). */
export const hasRatTail = (vp: number): boolean => vp > 0 && (vp % 5 === 2 || vp % 5 === 4);

/** Rat tails strictly between a trailing marker and the leader's marker. */
export function ratTailsBetween(vp: number, leaderVp: number): number {
    let n = 0;
    for (let v = vp + 1; v <= leaderVp; v++) if (hasRatTail(v)) n++;
    return n;
}

// ---------------------------------------------------------------------------
// Bonus die
// ---------------------------------------------------------------------------

export type DieFace = 'vp1' | 'vp2' | 'ruby' | 'droplet' | 'pumpkin';
export const DIE_FACES: DieFace[] = ['vp1', 'vp1', 'vp2', 'ruby', 'droplet', 'pumpkin'];
export const DIE_FACE_LABEL: Record<DieFace, string> = {
    vp1: '+1 point', vp2: '+2 points', ruby: '+1 ruby', droplet: 'droplet +1', pumpkin: '+1 pumpkin chip'
};

// ---------------------------------------------------------------------------
// Ingredient books
// ---------------------------------------------------------------------------

export type Trigger = 'none' | 'draw' | 'end' | 'passive';

export const TRIGGER_LABEL: Record<Trigger, string> = {
    none: 'no effect', draw: 'when drawn', end: 'after brewing', passive: 'while in pot'
};

export interface Book {
    color: ChipColor;
    set: number | null;              // null = in every game
    variant?: '2p' | '3-4p' | 'hw';  // black pages; 'hw' = the expansion's pumpkin book
    costs: Record<number, number>;   // chip value → coins
    trigger: Trigger;
    effect: string;
    /** Card face text. `[icon:id]` embeds a glyph (see QuacksAssets). Keep it short. */
    text: string;
    /** Full wording, shown when a book is opened. */
    detail: string;
}

const B = (color: ChipColor, set: number | null, costs: number[], trigger: Trigger,
    effect: string, text: string, detail: string, variant?: '2p' | '3-4p'): Book => {
    const values = costs.length === 1 ? [1] : [1, 2, 4];
    const c: Record<number, number> = {};
    values.forEach((v, i) => { c[v] = costs[i]; });
    return { color, set, costs: c, trigger, effect, text, detail, variant };
};

export const BOOKS: Book[] = [
    B('orange', null, [3], 'none', 'NONE',
        'No power. A cheap chip that simply fills a space.',
        'Pumpkins have no action. They are the cheapest way to push your potion one space further.'),
    B('black', null, [10], 'end', 'BLACK_COMPARE_OPPONENT',
        'Tie your rival’s [icon:chip_black]: [icon:droplet]+1. Beat them: also +1[icon:ruby].',
        'After brewing, compare the black chips in your pot with your opponent’s. Equal (and at least one): move your droplet 1 space. More: move your droplet 1 space and take 1 ruby.',
        '2p'),
    B('black', null, [10], 'end', 'BLACK_COMPARE_NEIGHBORS',
        'More [icon:chip_black] than one neighbour: [icon:droplet]+1. Than both: also +1[icon:ruby].',
        'After brewing, compare the black chips in your pot with the players to your left and right. More than one of them: move your droplet 1 space. More than both: move your droplet 1 space and take 1 ruby.',
        '3-4p'),

    B('blue', 1, [5, 10, 19], 'draw', 'BLUE_PEEK_PICK',
        'Draw 1 / 2 / 4 more chips. You may lay one of them. The rest go back.',
        'Draw as many chips as the value of this chip (1, 2 or 4). You may lay one of them as your next chip — its own action counts. Put the others back in the bag.'),
    B('blue', 2, [5, 10, 19], 'draw', 'BLUE_EXPLOSION_SHIELD',
        'Your next 1 / 2 / 4 draws are safe: [icon:boom] still scores and shops. No die.',
        'For the next 1, 2 or 4 chips you draw, an explosion costs you nothing: you take both the points and the shopping trip. You do not roll the bonus die. Shields overlap, they never add up.'),
    B('blue', 3, [4, 8, 14], 'draw', 'BLUE_RUBY_FIELD_RUBY',
        'Lands on a [icon:ruby] space: take 1[icon:ruby] at once.',
        'If this chip lands on a space showing a ruby, take 1 ruby immediately. The chip’s value does not matter.'),
    B('blue', 4, [5, 10, 20], 'draw', 'BLUE_RUBY_FIELD_VP',
        'Lands on a [icon:ruby] space: score its value in [icon:vp] at once.',
        'If this chip lands on a space showing a ruby, immediately score 1, 2 or 4 points — the value of the chip.'),

    B('red', 1, [6, 10, 16], 'draw', 'RED_ORANGE_BOOST',
        '1–2 [icon:chip_orange] in the pot: moves +1. 3 or more: moves +2.',
        'Moves extra spaces for the pumpkins already in your pot: 1 or 2 pumpkins add 1 space, 3 or more add 2 spaces.'),
    B('red', 2, [4, 8, 14], 'draw', 'RED_SET_ASIDE',
        'Set it aside. When you stop: lay it last, keep it, or bag it.',
        'Do not lay this chip — set it beside your pot. After you stop, lay it after your last chip, keep it beside the pot for a later round, or put it back in the bag.'),
    B('red', 3, [5, 9, 15], 'draw', 'RED_ADD_PREV_WHITE',
        'Laid right after a [icon:chip_white]: add that chip’s value to this move.',
        'If the chip laid just before this one is a cherry bomb, this chip moves that many extra spaces (a toadstool 1 after a cherry bomb 2 moves 3).'),
    B('red', 4, [7, 11, 17], 'passive', 'RED_WHITE1_MOVES_2',
        'Every [icon:chip_white] 1 you draw from now on moves 2 spaces.',
        'Once at least one toadstool is in your pot, every cherry bomb 1 you draw moves 2 spaces instead of 1. It still only counts 1 towards the explosion.'),

    B('yellow', 1, [8, 12, 18], 'draw', 'YELLOW_RETURN_PREV_WHITE',
        'Laid right after a [icon:chip_white]: you may put that chip back in the bag.',
        'If the chip laid just before this one is a cherry bomb, you may return that cherry bomb to the bag. Its space stays empty; the mandrake stays where it is.'),
    B('yellow', 2, [9, 13, 19], 'draw', 'YELLOW_DOUBLE_NEXT_MOVE',
        'The next chip you lay moves twice as far.',
        'The next chip you lay moves twice its value. Other bonus movement is added afterwards and is not doubled.'),
    B('yellow', 3, [8, 12, 18], 'passive', 'YELLOW_RAISE_THRESHOLD',
        '[icon:boom] limit rises to 8 with one in the pot, to 9 with three.',
        'With 1 or 2 mandrakes in your pot it only explodes when your cherry bombs total more than 8. With 3 or more, more than 9.'),
    B('yellow', 4, [8, 12, 18], 'draw', 'YELLOW_ESCALATING_MOVE',
        'Your 1st / 2nd / 3rd this round moves +1 / +2 / +3 spaces.',
        'The first mandrake you lay each round moves 1 extra space, the second 2, the third 3. Later ones get nothing.'),

    B('green', 1, [4, 8, 14], 'end', 'GREEN_RUBY_LAST2',
        'If it is your last or 2nd-last chip: take 1[icon:ruby].',
        'After brewing, take 1 ruby for each green chip that is the last or next-to-last chip in your pot.'),
    B('green', 2, [6, 11, 18], 'end', 'GREEN_CHIP_LAST2',
        'Last or 2nd-last chip: 1 adds [icon:chip_orange]. 2: [icon:chip_blue] or [icon:chip_red]. 4: [icon:chip_yellow] or [icon:chip_purple].',
        'For each green chip that is your last or next-to-last chip, add a 1-chip to your bag: a green 1 gives a pumpkin, a green 2 a crow skull or toadstool, a green 4 a mandrake or ghost’s breath.'),
    B('green', 3, [6, 11, 21], 'end', 'GREEN_DOUBLE_IF_WHITE7',
        '[icon:chip_white] total exactly 7: your last chip leaps on by all your [icon:chip_green] values.',
        'If your cherry bombs add up to exactly 7, move your last chip forward by the total value of every garden spider in your pot.'),
    B('green', 4, [4, 8, 14], 'end', 'GREEN_PAY_RUBY_DROPLET',
        'Last or 2nd-last chip: pay 1[icon:ruby] to move your [icon:droplet]+1.',
        'For each green chip that is your last or next-to-last chip, you may pay 1 ruby to move your droplet 1 space.'),

    B('purple', 1, [9], 'end', 'PURPLE_COUNT_TIERS',
        '1 chip: 1[icon:vp]. 2: 1[icon:vp] 1[icon:ruby]. 3+: 2[icon:vp] and [icon:droplet]+1.',
        'Count the purple chips in your pot and take one reward: 1 chip scores 1 point; 2 chips score 1 point and 1 ruby; 3 or more score 2 points and move your droplet 1 space.'),
    B('purple', 2, [12], 'end', 'PURPLE_DISCARD_TRADE',
        'Trade in 1, 2 or 3 for chips, [icon:vp], [icon:ruby] and [icon:droplet].',
        'Hand in purple chips from your pot for one reward. 1 chip: a black chip, 1 point and 1 ruby. 2 chips: a green 1, a blue 2, 3 points and droplet +1. 3 chips: a yellow 4, 6 points, 1 ruby and droplet +2.'),
    B('purple', 3, [10], 'end', 'PURPLE_POSITION_VP',
        'Each scores by its space: 10+ is 1[icon:vp], 20+ is 2[icon:vp], 30+ is 3[icon:vp].',
        'Each purple chip scores for the space it sits on: spaces 10–19 score 1 point, 20–29 score 2, 30 and beyond score 3.'),
    B('purple', 4, [11], 'end', 'PURPLE_UPGRADE_CHIP',
        'Upgrade a pot chip. 1 chip: 1 to 2. 2: 2 to 4. 3+: 1 to 4.',
        'Swap one chip in your pot for a bigger one of the same colour. With 1 purple chip a 1 becomes a 2; with 2 a 2 becomes a 4; with 3 or more a 1 becomes a 4. The new chip goes into your bag.'),

    // ---- Herb Witches expansion (sets 5 and 6; prices are reconstructions) ----
    {
        color: 'orange', set: null, variant: 'hw', costs: { 1: 3, 6: 14 }, trigger: 'none', effect: 'NONE',
        text: 'No power. Comes as a 1 or a big 6 that fills six spaces.',
        detail: 'Pumpkins come as 1-chips and 6-chips and simply fill the pot. Nothing ever upgrades a pumpkin.'
    },
    B('blue', 5, [5, 10, 19], 'draw', 'BLUE_ORANGE_VP',
        'At least as many [icon:chip_orange] in the pot as its value: score that value in [icon:vp].',
        'When you draw a crow skull, if your pot already holds at least as many pumpkins (any value) as the skull\u2019s value, score that many points at once.'),
    B('blue', 6, [4, 8, 14], 'draw', 'BLUE_WHITE_RUBY',
        'Look back 1 / 2 / 4 chips: take 1[icon:ruby] per [icon:chip_white] among them.',
        'Look back at as many of your previously laid chips as the skull\u2019s value (gaps don\u2019t count). Take 1 ruby for each cherry bomb among them.'),
    B('red', 5, [6, 10, 16], 'draw', 'RED_MATCH_BIGGEST',
        'Moves at least as far as the biggest [icon:chip_red] already in your pot.',
        'A toadstool moves its own value, or the value of the biggest toadstool already in your pot if that is larger. With a red 4 in the pot, every later toadstool moves 4.'),
    B('red', 6, [5, 9, 15], 'draw', 'RED_RESERVE_NEXT',
        'Draw one more chip and hold it. You must lay it later this round.',
        'After laying the toadstool, draw another chip and hold it beside the pot. Lay it whenever you like this round, before or after stopping \u2014 it must be laid. A held cherry bomb already counts towards the explosion.'),
    B('yellow', 5, [8, 12, 18], 'draw', 'YELLOW_PEEK_ADD',
        'Peek at one more chip: this mandrake also moves its value. Then it goes back.',
        'When you draw a mandrake, draw one more chip: the mandrake moves its own value plus that chip\u2019s value (a fool\u2019s herb counts 1). Put the extra chip back in the bag.'),
    B('yellow', 6, [8, 12, 18], 'draw', 'YELLOW_PAY_RUBY_MOVE',
        'You may pay 1[icon:ruby]: this mandrake moves 3 more spaces.',
        'When you lay a mandrake you may pay 1 ruby to move it 3 extra spaces. Once per mandrake.'),
    B('green', 5, [6, 11, 18], 'end', 'GREEN_CARRY_CHIP',
        'Last or 2nd-last chip: keep a pot chip up to its value to start next round.',
        'If a garden spider is your last or next-to-last chip, keep one chip from your pot (value up to the spider\u2019s) out of the bag. It is laid as your first chip next round, and its power fires.'),
    B('green', 6, [4, 8, 14], 'end', 'GREEN_ROLL_DIE',
        'Last or 2nd-last chip: roll the bonus die [icon:die] once for each.',
        'For every garden spider that is your last or next-to-last chip, roll the bonus die and take the reward. Spider values do not matter.'),
    B('purple', 5, [10], 'end', 'PURPLE_EXTRA_SHOP',
        'Add up the [icon:vp] of every space with a [icon:chip_purple]: spend it on a second shopping trip.',
        'Add up the points printed on every space holding a ghost\u2019s breath. You get a separate shopping trip with that many coins (2 chips of different colours). In round 9 it becomes points, 5 coins each.'),
    B('purple', 6, [11], 'end', 'PURPLE_NEXT_CHIP_VP',
        'Score the printed value of the chip laid right after each [icon:chip_purple].',
        'For each ghost\u2019s breath, score points equal to the printed value of the chip laid right after it, however far that chip actually moved.'),
    B('black', 5, [10], 'end', 'BLACK_GIFT_LEFT',
        'Bought [icon:chip_black] go to your left neighbour; you move [icon:droplet]+1. Furthest one: [icon:droplet]+1.',
        'A hawkmoth you gain goes into your left neighbour\u2019s bag, and your droplet moves 1. After brewing: 1 ruby per hawkmoth in your left neighbour\u2019s pot (they get 1 ruby if it is their last or 2nd-last chip). The furthest hawkmoth on the table moves its owner\u2019s droplet 1; the second furthest earns 1 ruby.'),
    B('herb', 5, [9], 'draw', 'HERB_RAT_MOVE',
        'Moves 1 space plus 1 per rat tail you have this round, up to 4 spaces.',
        'A fool\u2019s herb has no fixed value: it moves 1 space plus one per rat tail on your rat stone this round, never more than 4.'),
    B('herb', 7, [11], 'draw', 'HERB_ESSENCE_PLUS',
        'Moves 1. In the essence phase, each [icon:chip_herb] in your pot adds 1 more essence.',
        'A locoweed moves 1 space. In the essence phase, after counting colours, move your essence marker 1 extra space for every locoweed in your pot.'),
    B('herb', 8, [16], 'draw', 'HERB_COLOR_MOVE',
        'Moves 1 space per ingredient colour in your pot, counting itself. Not [icon:chip_white].',
        'Before laying it, count the different ingredient colours already in your pot (cherry bombs aside). Your first locoweed counts itself. It moves that many spaces.'),
    B('herb', 9, [10], 'draw', 'HERB_RETURN_CHIP',
        'Moves 1. Then put any coloured chip from your pot back in the bag.',
        'A locoweed moves 1 space. After laying it, return any coloured chip (not a cherry bomb) from your pot to your bag. The other chips stay where they are.'),
    B('herb', 10, [12], 'draw', 'HERB_WHITE_MOVE',
        'Moves as far as the [icon:chip_white] in your pot add up to, at least 1.',
        'Before laying it, add up the printed values of the cherry bombs in your pot. The locoweed moves that many spaces \u2014 1 if there are none.'),
    B('herb', 6, [7], 'draw', 'HERB_COPY_PREV',
        'Copies the chip laid just before it: its move and its power. After a [icon:chip_white]: just 1.',
        'A fool\u2019s herb does exactly what the chip laid just before it did: it moves that chip\u2019s printed value and fires its power. After a cherry bomb (or as your first chip) it simply moves 1.')
];

export const SET_NAMES: Record<number, string> = {
    1: 'Set 1 — First brew',
    2: 'Set 2 — Shields & stashes',
    3: 'Set 3 — Rubies & risks',
    4: 'Set 4 — Slow burners',
    5: 'Set 5 — Herb witches I',
    6: 'Set 6 — Herb witches II'
};

/** Locoweed books are not part of a numbered set; the picker labels them A1–A4. */
export const LOCOWEED_BOOKS = [7, 8, 9, 10];
export const bookLabel = (color: ChipColor, n: number): string =>
    (color === 'herb' && n === 0 ? 'Off' : color === 'black' && n === 1 ? 'Base' : n >= 7 ? `A${n - 6}` : String(n));

/** Display order of the books on the table. */
export const BOOK_ORDER: ChipColor[] = ['orange', 'green', 'blue', 'red', 'yellow', 'purple', 'black', 'herb'];

/** The colours whose book can be swapped between sets 1–4. Orange and black never change. */
export const VARIABLE_BOOKS: ChipColor[] = ['green', 'blue', 'red', 'yellow', 'purple'];

/** With the Herb Witches, hawkmoth and fool's herb become choosable too. */
export const EXPANSION_BOOKS: ChipColor[] = [...VARIABLE_BOOKS, 'black', 'herb'];

export const pickableBooks = (expansion: boolean, alch = false): ChipColor[] =>
    (expansion ? EXPANSION_BOOKS : alch ? [...VARIABLE_BOOKS, 'herb'] : VARIABLE_BOOKS);

/**
 * Which set's book is on the table for each choosable colour. `black: 1` is the
 * base-game hawkmoth (the 2p or 3+ page); `herb: 0` means no fool's herb at all;
 * herb 7–10 are the Alchemists' locoweed books.
 */
export type BookSets = Record<string, number>;

/** The set numbers a colour's picker offers. With the Alchemists a locoweed book is compulsory. */
export function bookChoices(color: ChipColor, expansion: boolean, alch = false): number[] {
    if (color === 'herb') return [...(alch ? [] : [0]), ...(expansion ? [5, 6] : []), ...(alch ? LOCOWEED_BOOKS : [])];
    if (color === 'black') return expansion ? [1, 5] : [1];
    if (VARIABLE_BOOKS.indexOf(color) !== -1) return expansion ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4];
    return [];
}

/** A preset: each colour takes set `n` if it has one, otherwise its default. */
export function uniformBookSets(setNumber: number, expansion = false, alch = false): BookSets {
    const max = expansion ? 6 : 4;
    const n = Math.max(1, Math.min(max, Math.round(setNumber) || 1));
    const out: BookSets = {};
    VARIABLE_BOOKS.forEach((c) => { out[c] = n; });
    out.black = bookChoices('black', expansion).indexOf(n) !== -1 ? n : 1;
    const herb = bookChoices('herb', expansion, alch);
    out.herb = herb.indexOf(n) !== -1 ? n : herb[0];
    return out;
}

/** Fill in and clamp a (possibly partial or untrusted) book selection. */
export function normalizeBookSets(raw: any, fallback = 1, expansion = false, alch = false): BookSets {
    const out = uniformBookSets(fallback, expansion, alch);
    if (raw && typeof raw === 'object') {
        EXPANSION_BOOKS.forEach((c) => {
            const v = Math.round(Number(raw[c]));
            if (raw[c] !== undefined && bookChoices(c, expansion, alch).indexOf(v) !== -1) out[c] = v;
        });
    }
    return out;
}

/** The set number when the selection is exactly a preset, otherwise null (a custom mix). */
export function presetOf(sets: BookSets, expansion = false, alch = false): number | null {
    for (let n = 1; n <= (expansion ? 6 : 4); n++) {
        const u = uniformBookSets(n, expansion, alch);
        // a locoweed book belongs to no set, so any of them fits any preset
        const same = (c: ChipColor) => (c === 'herb' && alch && (sets.herb ?? 7) >= 7 && u.herb >= 7) || (sets[c] ?? u[c]) === u[c];
        if (EXPANSION_BOOKS.every(same)) return n;
    }
    return null;
}

/** A book by colour; `sets` is one set number for every colour, or a per-colour selection. */
export function getBook(color: ChipColor, sets: number | BookSets, playerCount: number, expansion = false, alch = false): Book | null {
    if (color === 'white') return null;
    const pick = typeof sets === 'number' ? uniformBookSets(sets, expansion, alch) : sets;
    if (color === 'orange') return expansion ? BOOKS.filter(b => b.variant === 'hw')[0] : BOOKS[0];
    if (color === 'black') {
        if (expansion && pick.black === 5) return BOOKS.filter(b => b.color === 'black' && b.set === 5)[0];
        return playerCount <= 2 ? BOOKS[1] : BOOKS[2];
    }
    if (color === 'herb') {
        const n = pick.herb || 0;
        const ok = bookChoices('herb', expansion, alch).indexOf(n) !== -1;
        return ok ? BOOKS.filter(b => b.color === 'herb' && b.set === n)[0] || null : null;
    }
    const setNumber = pick[color] || 1;
    return BOOKS.filter(b => b.color === color && b.set === setNumber)[0] || null;
}

/** The colours whose books are face up in a given round. */
export function revealedColors(round: number): ChipColor[] {
    return BOOK_ORDER.filter(c =>
        (c !== 'yellow' || round >= YELLOW_REVEAL_ROUND) && (c !== 'purple' || round >= PURPLE_REVEAL_ROUND));
}

// ---------------------------------------------------------------------------
// Herb witches (expansion)
// ---------------------------------------------------------------------------

export type Metal = 'silver' | 'bronze' | 'gold';
export const METALS: Metal[] = ['silver', 'bronze', 'gold'];

export interface Witch {
    id: string;
    metal: Metal;
    name: string;
    /** When she can be called, for the card band. */
    when: string;
    text: string;    // card face, `[icon:id]` allowed
    detail: string;
}

const W = (id: string, metal: Metal, name: string, when: string, text: string, detail: string): Witch =>
    ({ id, metal, name, when, text, detail });

/** One witch of each metal is dealt at random; each player may call each of them once. */
export const WITCHES: Witch[] = [
    W('s_flask', 'silver', 'The Bottler', 'when you explode',
        'Your pot just exploded: use your full [icon:flask] on that chip after all.',
        'Right after your pot explodes, if your flask is full, use it on the chip that blew you up. It goes back in the bag and you keep brewing.'),
    W('s_six', 'silver', 'The Sorter', 'while brewing',
        'Draw 6 chips. Lay as many as you like, in any order. The rest go back.',
        'While still brewing, draw 6 chips. Lay any of them, one at a time and in the order you choose \u2014 their powers fire as usual. Return the rest to the bag.'),
    W('s_whites', 'silver', 'The Defuser', 'while brewing',
        'Not exploded: put up to two [icon:chip_white] from your pot or overflow bowl back in the bag.',
        'While brewing and not exploded, return one or two cherry bombs from anywhere in your pot or your overflow bowl to the bag. The gaps they leave stay open.'),
    W('s_bonus', 'silver', 'The Survivor', 'when you explode',
        'Your pot just exploded: score as if it had not \u2014 points, shop and bonus die.',
        'Right after your pot explodes, call her and you score this round as if it had not: points, shopping and a chance at the bonus die.'),
    W('b_upgrade', 'bronze', 'The Refiner', 'when shopping',
        'Upgrade your last two pot chips one step, or any one pot chip. Not [icon:chip_orange].',
        'Upgrade your last two pot chips by one step each, or any single pot chip by one step (1 to 2, 2 to 4). The new chips go in your bag. Pumpkins never upgrade. Works even if you took points after exploding.'),
    W('b_double', 'bronze', 'The Haggler', 'when shopping',
        'Double the coins of this shopping trip. Still 2 chips, different colours.',
        'Double your coins for this shopping trip. You still buy at most 2 chips of different colours. In round 9 the doubled coins become points at 5 each.'),
    W('b_copy', 'bronze', 'The Twinner', 'after shopping',
        'Take a second copy of one chip you bought this round.',
        'After shopping, take another chip identical to one you just bought. That can make 3 new chips this round.'),
    W('b_ruby', 'bronze', 'The Jeweller', 'when shopping',
        'Shop with 2 extra coins for every [icon:ruby] you hold. Keep the rubies.',
        'For this shopping trip, add 2 coins for every ruby you own. You keep the rubies.'),
    W('g_colors', 'gold', 'The Painter', 'when scoring',
        'Score 1[icon:vp] for every ingredient colour in your pot, cherry bombs aside.',
        'Score 1 point for each different ingredient colour in your pot. Cherry bombs do not count.'),
    W('g_bag', 'gold', 'The Rummager', 'when scoring',
        'Score 2[icon:vp] for every 2, 4 or 6 chip still in your bag. Not [icon:chip_white].',
        'Look in your bag: score 2 points for every chip still there worth 2, 4 or 6. Cherry bombs do not count.'),
    W('g_rubies', 'gold', 'The Miner', 'on a ruby space',
        'Your scoring space shows a [icon:ruby]: take as many rubies as its [icon:vp] instead.',
        'If your scoring space shows a ruby, take as many rubies as the points printed on it instead of just one.'),
    W('g_cheap', 'gold', 'The Discounter', 'at round end',
        'This round, moving your [icon:droplet] or refilling your [icon:flask] costs 1[icon:ruby].',
        'For the rest of this round, moving your droplet or refilling your flask costs only 1 ruby each time.')
];

export const WITCH_BY_ID: Record<string, Witch> = WITCHES.reduce((m, w) => { m[w.id] = w; return m; }, {} as Record<string, Witch>);

// ---------------------------------------------------------------------------
// The Alchemists: patients and their essence tracks
// ---------------------------------------------------------------------------

/** The alchemist's flask runs 0..ESSENCE_MAX. */
export const ESSENCE_MAX = 12;
export const PATIENTS_DEALT = 3;

/**
 * One glass on an essence track — what landing on that field gives you.
 *   vp / rat           points now, extra rat tails next round
 *   draw               (startles) chips drawn to hold at the start of next round
 *   earworm            chips drawn and laid at once, safely
 *   coins              (vampirism) buy one chip for that many coins
 *   bonus              (chicken eyes) a one-off reward, see CHICKEN_BONUS
 */
export interface Glass { vp?: number; rat?: number; draw?: number; earworm?: number; coins?: number; bonus?: string; }

export type PatientKind = 'power' | 'bonus' | 'draw' | 'earworm' | 'buy';

export interface Patient {
    id: string;
    name: string;           // the ailment, as printed on the patient chart
    kind: PatientKind;
    art: string;            // icon id
    /** Chips this patient puts in your bag at the start of the game. */
    start: Chip[];
    text: string;           // card face, `[icon:id]` allowed
    detail: string;
    track: Record<number, Glass>;
}

/** The glass ladder shared by the four "power" patients: their real reward is the essence itself. */
const POWER_TRACK: Record<number, Glass> = { 2: { rat: 1 }, 4: { vp: 1 }, 6: { rat: 1 }, 8: { vp: 2 }, 10: { vp: 2 }, 12: { vp: 3 } };

export const CHICKEN_BONUS: Record<string, string> = {
    ruby1: '+1 ruby', pumpkin: 'a pumpkin 1', up12: 'swap a pot 1-chip for its 2', refill: 'refill your flask',
    red1: 'a toadstool 1', ruby3: '+3 rubies', roll2: 'roll the bonus die twice', drop2: 'droplet +2',
    up14: 'swap a pot 1-chip for its 4', roll4: 'roll the bonus die 4 times'
};

const PT = (id: string, name: string, kind: PatientKind, art: string, start: Chip[], text: string, detail: string,
    track: Record<number, Glass>): Patient => ({ id, name, kind, art, start, text, detail, track });

export const PATIENTS: Patient[] = [
    PT('startles', 'The Startles', 'draw', 'boom', [],
        'Next round, start with chips drawn and held: lay one instead of drawing.',
        'Field 1: an extra rat tail next round. Other glasses: at the start of your next brew, draw that many chips. Cherry bombs go straight back; hold the rest. Before any draw you may lay a held chip instead. Not after an explosion.',
        { 1: { rat: 1 }, 3: { draw: 2 }, 5: { draw: 3 }, 7: { draw: 4 }, 9: { draw: 5 }, 11: { draw: 6 } }),
    PT('earworm', 'Earworm', 'earworm', 'tail', [],
        'Right after the essence phase, draw and lay that many more chips. Safe from exploding.',
        'Field 1: an extra rat tail next round. Other glasses: straight after the essence phase, draw that many chips one by one and lay them as usual, powers and all. Cherry bombs laid this way never make the pot explode.',
        { 1: { rat: 1 }, 3: { earworm: 1 }, 5: { earworm: 2 }, 8: { earworm: 3 }, 11: { earworm: 4 } }),
    PT('turnip', 'Turnip Nose', 'power', 'chip_orange', ['orange1'],
        'Next round: spend 2 essence when you draw a [icon:chip_orange] to lay it on the next [icon:ruby] space.',
        'You start with an extra pumpkin 1. Next round, whenever you draw a pumpkin you may move your essence back 2 to lay it on the next free ruby space instead.',
        POWER_TRACK),
    PT('sailing', 'Sailing Ears', 'power', 'chip_white', [],
        'Next round, when you draw a [icon:chip_white]: spend 2 to move it double, or 3 to bag it.',
        'Next round, whenever you draw a cherry bomb you may spend 2 essence to move it twice its value, or 3 to put it back in the bag. Not if that bomb makes your pot explode.',
        POWER_TRACK),
    PT('chicken', 'Chicken Eyes', 'bonus', 'die', [],
        'Take the reward in your glass straight after the essence phase.',
        'At the end of the essence phase take the reward printed in your glass: rubies, chips, a chip upgrade, a flask refill, droplet moves or bonus-die rolls.',
        { 1: { bonus: 'ruby1' }, 2: { bonus: 'pumpkin' }, 3: { bonus: 'up12' }, 4: { bonus: 'refill' }, 5: { bonus: 'red1' },
          6: { bonus: 'ruby3' }, 7: { bonus: 'roll2' }, 8: { bonus: 'drop2' }, 10: { bonus: 'up14' }, 12: { bonus: 'roll4' } }),
    PT('hunchback', 'Hunchback', 'power', 'ruby', [],
        'Next round: lay a chip on a [icon:ruby] space and spend 2 essence for a reward by its value.',
        'Next round, whenever you lay a chip on a ruby space you may spend 2 essence for a reward by that chip\u2019s printed value: 1 a ruby, 2 droplet +1, 3 three points, 4 a 1-chip of its colour.',
        POWER_TRACK),
    PT('forgetful', 'Forgetfulness', 'power', 'bag', ['black1', 'blue1'],
        'Next round: spend essence equal to a pot chip\u2019s value to put it back in the bag.',
        'You start with an extra hawkmoth 1 and crow skull 1. Next round, at any time while brewing, return a coloured pot chip (not a cherry bomb or locoweed) to your bag by spending essence equal to its value. Its gap stays.',
        POWER_TRACK),
    PT('vampire', 'Vampirism', 'buy', 'coin', [],
        'Straight after the essence phase, buy one chip with the coins in your glass.',
        'Field 1: an extra rat tail next round. Other glasses: at the end of the essence phase buy one chip for up to that many coins. It does not count towards your shop limit.',
        { 1: { rat: 1 }, 3: { coins: 6 }, 5: { coins: 9 }, 7: { coins: 12 }, 9: { coins: 15 }, 11: { coins: 19 } })
];

export const PATIENT_BY_ID: Record<string, Patient> = PATIENTS.reduce((m, x) => { m[x.id] = x; return m; }, {} as Record<string, Patient>);

/** A short label for a glass, for choosers and the track strip. */
export function glassLabel(g: Glass | undefined): string {
    if (!g) return 'no glass';
    if (g.vp) return `${g.vp} point${g.vp > 1 ? 's' : ''}`;
    if (g.rat) return 'a rat tail next round';
    if (g.draw) return `hold ${g.draw} chips next round`;
    if (g.earworm) return `lay ${g.earworm} more chip${g.earworm > 1 ? 's' : ''} now`;
    if (g.coins) return `buy a chip for ${g.coins}`;
    if (g.bonus) return CHICKEN_BONUS[g.bonus];
    return 'no glass';
}

// ---------------------------------------------------------------------------
// Fortune-teller cards
// ---------------------------------------------------------------------------

export interface FortuneCard {
    id: string;
    name: string;
    /** `now` = purple card, resolved before the round. `round` = blue card, lasts the round. */
    kind: 'now' | 'round';
    text: string;
    art: string;       // icon id (QuacksAssets)
    /** false = a stand-in written for this implementation, not a transcription. */
    verified: boolean;
    /** Which box the card comes from, and which expansion it needs to be in play. */
    box?: 'base' | 'alch';
    requires?: 'hw' | 'alch';
}

const F = (id: string, name: string, kind: 'now' | 'round', art: string, text: string, verified = true): FortuneCard =>
    ({ id, name, kind, art, text, verified, box: 'base' });
const A = (id: string, name: string, kind: 'now' | 'round', art: string, text: string, requires?: 'hw' | 'alch'): FortuneCard =>
    ({ id, name, kind, art, text, verified: true, box: 'alch', requires });

export const FORTUNE_CARDS: FortuneCard[] = [
    F('pot_fills', 'The Pot Fills Up', 'now', 'droplet', 'Everyone moves their droplet 1 space forward.'),
    F('beginners_bonus', 'Beginner’s Bonus', 'now', 'ruby', 'Whoever has the fewest rubies takes 1 ruby.'),
    F('donations', 'Donations', 'now', 'die', 'Everyone rolls the bonus die once and takes the reward.'),
    F('just_in_time', 'Just in Time', 'now', 'vp', 'Choose: score 4 points, or throw away one cherry bomb 1 from your bag.'),
    F('choose_wisely', 'Choose Wisely', 'now', 'chip_purple', 'Choose: move your droplet 2 spaces, or take 1 purple chip.'),
    F('wheel_and_deal', 'Wheel and Deal', 'now', 'bag', 'You may trade 1 ruby for any 1-chip. Not purple or black.'),
    F('less_is_more', 'Less is More', 'now', 'chip_blue', 'All draw 5 chips. Lowest total takes a blue 2-chip, the others 1 ruby. Chips go back.'),
    F('opportunistic', 'An Opportune Moment', 'now', 'bag', 'Draw 4 chips. Swap one for the next value up in its colour. If you cannot, take a green 1.'),
    F('rats_friends', 'Rats Are Your Friends', 'now', 'rat', 'Choose: take any one 4-chip, or score 1 point per rat tail you have this round.'),
    F('ruby_rain', 'Ruby Rain', 'now', 'ruby', 'Everyone takes 1 ruby.', false),
    F('fresh_flasks', 'Fresh Flasks', 'now', 'flask', 'Refill your flask for free. Already full? Score 1 point instead.', false),

    F('rat_infestation', 'Rat Infestation', 'round', 'rat', 'This round every rat tail counts double.'),
    F('living_in_luxury', 'Living in Luxury', 'round', 'boom', 'This round pots only explode when cherry bombs total more than 9, not 7.'),
    F('pumpkin_party', 'Pumpkin Patch Party', 'round', 'chip_orange', 'This round every pumpkin moves 1 extra space.'),
    F('well_stirred', 'Well Stirred', 'round', 'chip_white', 'This round you may put the first cherry bomb you draw back in the bag.'),
    F('lucky_devil', 'Lucky Devil', 'round', 'ruby', 'A scoring space with a ruby gives you 1 extra ruby this round.'),
    F('shining_bright', 'Shining Extra Bright', 'round', 'droplet', 'Finish with cherry bombs totalling exactly 7: move your droplet 1 space.'),
    F('magic_potion', 'Magic Potion', 'round', 'die', 'Whoever rolls the bonus die this round rolls it twice.'),
    F('malicious_joy', 'Malicious Joy', 'round', 'boom', 'If your pot explodes, the player on your left takes any one 2-chip.'),
    F('strong_ingredient', 'Strong Ingredient', 'round', 'bag', 'Stop without exploding: draw up to 5 chips and you may lay one of them.'),
    F('shop_spree', 'Shopping Spree', 'round', 'coin', 'This round you may buy up to 3 chips, all of different colours.', false),
    F('bargain_day', 'Bargain Day', 'round', 'coin', 'Everyone shops with 3 extra coins this round.', false),
    F('steady_hand', 'Steady Hand', 'round', 'vp', 'Stop without exploding and score 2 extra points.', false),
    F('full_moon', 'Full Moon', 'round', 'moon', 'Everyone whose pot does not explode rolls the bonus die.', false),

    // ---- The Alchemists box (transcribed from the cards) ----
    A('give_take', 'Give and Take', 'now', 'ruby', 'You may trade 1, 2 or 4 rubies for a chip of that value, any colour but purple.'),
    A('rat_honour', 'A Rat in Honour', 'now', 'rat', 'You may spend up to 3 rubies. Each one gives you 3 extra rat tails this round.'),
    A('neighbour_need', 'Neighbour in Need', 'now', 'bag', 'Choose for your left neighbour: they throw away a cherry bomb 1, or take any 1-chip.'),
    A('rich_gifts', 'Rich Gifts', 'now', 'vp', 'Choose: 8 extra rat tails this round, roll the bonus die 4 times, or droplet +3.'),
    A('swap_frenzy', 'Swap Frenzy', 'now', 'witch_bronze', 'You may trade one of your witch pennies for any chip.', 'hw'),
    A('small_donation', 'A Small Donation', 'now', 'die', 'With 2 or more rat tails this round, roll the bonus die once.'),
    A('strong_drop', 'A Strong Drop', 'now', 'droplet', 'You may move your droplet back 2 or 4 spaces to take any 2- or 4-chip.'),
    A('useful_rodent', 'A Useful Rodent', 'now', 'rat', 'You may give up 2, 4 or 6 rat tails to take any non-purple 1-, 2- or 4-chip.'),
    A('ruby_fever', 'Ruby Fever', 'now', 'ruby', 'Everyone draws a chip from their bag and takes rubies equal to its value. It goes back.'),
    A('who_chooses', 'Whoever Has the Choice', 'now', 'chip_red', 'Choose: a ruby, 3 rat tails and a bonus-die roll \u2014 or a toadstool 2.'),
    A('clearance', 'Clearance Sale', 'round', 'coin', 'Buy 2 chips this round and take a second copy of the cheaper one free.'),
    A('rat_blessing', 'Blessing of the Rats', 'round', 'rat', 'When shopping, add twice your rat tails this round to your coins.'),
    A('good_neighbour', 'Good Neighbours', 'round', 'chip_white', 'Not exploded: you may bag a cherry bomb 3 from your pot. Your left neighbour takes 2 rubies.'),
    A('essential_essence', 'Essential Essence', 'round', 'flask', 'Highest essence this round: roll the bonus die once or refill your flask.', 'alch'),
    A('witch_visit', 'A Witch Visits', 'round', 'witch_silver', 'An extra herb witch joins this round. Everyone may call her once, free.', 'hw'),
    A('good_to_better', 'Good Gets Better', 'round', 'chip_blue', 'When you stop: swap a coloured 2- or 4-chip in your pot for one of another colour.'),
    A('white_blessing', 'The White Blessing', 'round', 'chip_white', 'When you stop: if your last chip is a cherry bomb, score its value in points.'),
    A('all_good', 'All\u2019s Well That Ends Well', 'round', 'flask', 'Your essence grows by the value of the last chip in your pot.', 'alch'),
    A('luck_misfortune', 'Luck in Misfortune', 'round', 'boom', 'If your pot explodes this round, your essence grows by 2.', 'alch'),
    A('reunion', 'Happy Reunion', 'round', 'witch_gold', 'At the end of the round, take back one spent witch penny.', 'hw')
];

/** The fortune deck for a game: the base cards, plus the Alchemists box when it is in play. */
export function fortuneDeckFor(hw: boolean, alch: boolean): FortuneCard[] {
    return FORTUNE_CARDS.filter(c => (c.box !== 'alch' || alch)
        && (c.requires !== 'hw' || hw) && (c.requires !== 'alch' || alch));
}

export const FORTUNE_BY_ID: Record<string, FortuneCard> = FORTUNE_CARDS.reduce((m, c) => {
    m[c.id] = c;
    return m;
}, {} as Record<string, FortuneCard>);

/** What the round marker itself triggers, for the UI. */
export function roundEvent(round: number): string | null {
    if (round === YELLOW_REVEAL_ROUND) return 'The Mandrake book opens.';
    if (round === PURPLE_REVEAL_ROUND) return 'The Ghost’s Breath book opens.';
    if (round === EXTRA_WHITE_ROUND) return 'Everyone adds a cherry bomb 1 to their bag.';
    if (round === ROUNDS) return 'Final round — everyone stirs together, chip by chip.';
    return null;
}
