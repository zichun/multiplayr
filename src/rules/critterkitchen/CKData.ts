/**
 * CKData.ts — static data tables for Critter Kitchen.
 *
 * Sources: the official base rulebook (cardboardalchemy.com, 2024), the "À La
 * Cart" expansion rulebook and the Deluxe complete card list. Card text is
 * kept verbatim in `text` (shown in the detail view); `short` is the compact,
 * icon-rich summary printed on the card face. Icon tokens in `short` use the
 * card-renderer inline syntax `[icon:<id>]`.
 */

// ---------------------------------------------------------------------------
// Ingredients, items
// ---------------------------------------------------------------------------

export type IngType = 'bread' | 'carrot' | 'cheese' | 'fish' | 'meat' | 'mushroom' | 'wine';

/** Also the critic-plate course order (left → right). */
export const ING_TYPES: IngType[] = ['bread', 'carrot', 'cheese', 'fish', 'meat', 'mushroom', 'wine'];

export const ING_NAMES: Record<IngType, string> = {
    bread: 'Bread', carrot: 'Carrot', cheese: 'Cheese', fish: 'Fish',
    meat: 'Meat', mushroom: 'Mushroom', wine: 'Wine'
};

/** 13 tokens of each ingredient. */
export const ING_VALUES = [2, 2, 2, 3, 3, 3, 4, 4, 5, 5, 6, 6, 7];

export type ItemKind = 'ing' | 'spice' | 'rumor' | 'soup' | 'bisque' | 'zous';

/** Rumor token kinds. q / dots / excl map to rumor card slots 0 / 1 / 2. */
export type RumorKind = 'q' | 'dots' | 'excl' | 'wild';
export const RUMOR_SLOTS: RumorKind[] = ['q', 'dots', 'excl'];

export interface Item {
    id: number;
    k: ItemKind;
    /** ingredient type (ing), spice type or 'all' (spice) */
    t?: IngType | 'all';
    /** printed value (ing) */
    v?: number;
    /** rumor kind (rumor) */
    r?: RumorKind;
    /** zous-chef id (zous) */
    z?: string;
}

export const SOUP_PICK = -1; // pick id meaning "one bowl of endless soup"

export function itemLabel(it: Item): string {
    switch (it.k) {
        case 'ing': return `${it.v} ${ING_NAMES[it.t as IngType]}`;
        case 'spice': return it.t === 'all' ? 'Allspice' : `${ING_NAMES[it.t as IngType]} spice`;
        case 'rumor': return it.r === 'wild' ? 'Wild rumor' : 'Rumor';
        case 'soup': return 'Soup';
        case 'bisque': return 'Bisque';
        case 'zous': return ZOUS_BY_ID[it.z as string]?.name || 'Zous-chef';
    }
    return 'Item';
}

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------

export type LocId = 'soup' | 'garden' | 'desert' | 'water' | 'air' | 'lantern' | 'midnight' | 'academy';

export interface LocationDef {
    id: LocId;
    name: string;
    /** number of item spaces restocked from the bag (0 = special) */
    spaces: number;
    /** numbered boards are used when playerCount >= this */
    minPlayers: number;
}

// Item-space counts are read off the board art in the rulebook setup spreads.
export const LOCATIONS: LocationDef[] = [
    { id: 'soup', name: 'Soup Truck', spaces: 0, minPlayers: 1 },
    { id: 'garden', name: 'Garden Top Shop', spaces: 3, minPlayers: 1 },
    { id: 'desert', name: 'Desert Vendor', spaces: 4, minPlayers: 2 },
    { id: 'water', name: 'Water Market', spaces: 3, minPlayers: 3 },
    { id: 'air', name: 'Air Docks', spaces: 4, minPlayers: 4 },
    { id: 'lantern', name: 'Lantern Lake', spaces: 4, minPlayers: 5 },
    { id: 'midnight', name: 'Midnight Merchant', spaces: 5, minPlayers: 1 },
    { id: 'academy', name: 'Chef Academy', spaces: 0, minPlayers: 1 }
];
export const LOC_BY_ID: Record<LocId, LocationDef> =
    LOCATIONS.reduce((m, l) => { m[l.id] = l; return m; }, {} as Record<LocId, LocationDef>);

/** Midnight Merchant spaces on the 2-player side. */
export const MIDNIGHT_SPACES_2P = 4;
/** Chef Academy item spaces on the 2-player side. */
export const ACADEMY_SPACES_2P = 2;

export function locationsFor(playerCount: number): LocId[] {
    const n = Math.max(2, playerCount);
    return LOCATIONS.filter(l => l.minPlayers <= n).map(l => l.id);
}

// ---------------------------------------------------------------------------
// Chefs
// ---------------------------------------------------------------------------

export type ChefKind = 'mouse' | 'lizard' | 'boar';
export const CHEFS: ChefKind[] = ['mouse', 'lizard', 'boar'];
export const CHEF_CAP: Record<ChefKind, number> = { mouse: 1, lizard: 2, boar: 3 };
export const CHEF_NAMES: Record<ChefKind, string> = { mouse: 'Mouse', lizard: 'Lizard', boar: 'Boar' };

// ---------------------------------------------------------------------------
// Challenges
// ---------------------------------------------------------------------------

export interface ChallengeDef { id: string; name: string; req: IngType[]; }

export const CHALLENGES: ChallengeDef[] = [
    { id: 'coastal', name: 'Coastal Fusion', req: ['fish', 'cheese', 'carrot'] },
    { id: 'comfort', name: 'Comfort Food', req: ['wine', 'bread', 'meat'] },
    { id: 'savory', name: 'Savory Stack', req: ['cheese', 'meat', 'mushroom'] },
    { id: 'street', name: 'Street Eats', req: ['meat', 'carrot', 'wine'] },
    { id: 'tapas', name: 'Tasty Tapas', req: ['carrot', 'mushroom', 'bread'] },
    { id: 'melt', name: 'Ultimate Melt', req: ['bread', 'fish', 'cheese'] },
    { id: 'winedine', name: 'Wine & Dine', req: ['mushroom', 'wine', 'fish'] }
];
export const CHALLENGE_BY_ID: Record<string, ChallengeDef> =
    CHALLENGES.reduce((m, c) => { m[c.id] = c; return m; }, {} as Record<string, ChallengeDef>);

/** Stars awarded for a challenge meal of the given quality. */
export function challengeStars(quality: number): number {
    if (quality >= 21) return 4;
    if (quality >= 12) return 2;
    if (quality >= 6) return 1;
    return 0;
}

/** Final-score track: rows of 7, row N pays N stars; every lap past 70 pays 10. */
export function trackStars(quality: number): number {
    if (quality <= 0) return 0;
    const laps = Math.floor((quality - 1) / 70);
    const rem = ((quality - 1) % 70) + 1;
    return laps * 10 + Math.ceil(rem / 7);
}

export const FRIDGE_LIMIT_DAY1 = 5;
export const FRIDGE_LIMIT_DAY2 = 10;

// ---------------------------------------------------------------------------
// Critics
// ---------------------------------------------------------------------------

export type CriticId =
    | 'badger' | 'capybara' | 'cow' | 'fruitbat' | 'jerboa' | 'kangaroo' | 'mouse' | 'poodle'
    | 'rabbit' | 'raccoon' | 'stbernard' | 'treeshrew'
    | 'hippo' | 'hyena' | 'pig' | 'wolverine';

export interface CriticDef {
    id: CriticId;
    name: string;
    animal: string;
    /** which meals the rule affects */
    scope: 'challenge' | 'critic' | 'both' | 'shopping';
    exp?: boolean;
    minPlayers?: number;
    bonus?: boolean;
    text: string;
    short: string;
}

export const CRITICS: CriticDef[] = [
    { id: 'badger', name: 'The Badger', animal: 'badger', scope: 'both',
        text: 'Throughout the game, you may use mushrooms as any ingredient, and use any spice on mushrooms.',
        short: '[icon:ing_mushroom] counts as any ingredient · any [icon:spice_any] fits it' },
    { id: 'capybara', name: 'The Capybara', animal: 'capybara', scope: 'challenge',
        text: 'Each challenge meal is worth +1★.',
        short: 'Each challenge meal served: +1 [icon:star]' },
    { id: 'cow', name: 'The Cow', animal: 'cow', scope: 'critic',
        text: 'When preparing the critic meal, 1 course of your choice may include up to 4 ingredients of its type.',
        short: 'One critic course may hold up to 4 ingredients' },
    { id: 'fruitbat', name: 'The Fruit Bat', animal: 'fruitbat', scope: 'critic', bonus: true,
        text: 'When preparing the critic meal, each course may include an unspiced wine matching the course\'s highest value. Gain a ★ for each wine paired this way.',
        short: 'Pair an unspiced [icon:ing_wine] of equal value with any course: +1 [icon:star] each' },
    { id: 'jerboa', name: 'The Jerboa', animal: 'jerboa', scope: 'critic',
        text: 'When preparing the critic meal, Rumor Tokens may be used as allspice.',
        short: 'Critic meal: [icon:rumor_q] rumor tokens work as [icon:spice_all]' },
    { id: 'kangaroo', name: 'The Kangaroo', animal: 'kangaroo', scope: 'both',
        text: 'Throughout the game, treat 6-value ingredients as 9\'s.',
        short: 'Every printed 6 counts as 9' },
    { id: 'mouse', name: 'The Mouse', animal: 'mouse', scope: 'critic',
        text: 'When preparing the critic meal, your cheese course may include any amount of cheese. When scoring the best of each course, cheese earns +2★.',
        short: 'Any number of [icon:ing_cheese] in the cheese course · best cheese: +2 [icon:star]' },
    { id: 'poodle', name: 'The Poodle', animal: 'poodle', scope: 'critic', bonus: true,
        text: 'Gain a ★ for each ingredient worth 6 or more (before spice) served to the critic.',
        short: '+1 [icon:star] per critic ingredient worth 6+' },
    { id: 'rabbit', name: 'The Rabbit', animal: 'rabbit', scope: 'both',
        text: 'Throughout the game, treat the value on all carrots as doubled.',
        short: '[icon:ing_carrot] values are doubled' },
    { id: 'raccoon', name: 'The Raccoon', animal: 'raccoon', scope: 'both',
        text: 'Throughout the game, 2-value ingredients do not count towards your refrigeration limit. When preparing the critic meal, each course may also include any amount of 2-value ingredients of its type.',
        short: '2-value ingredients skip the [icon:fridge] · add any 2s to a matching course' },
    { id: 'stbernard', name: 'The Saint Bernard', animal: 'stbernard', scope: 'both',
        text: 'Throughout the game, wine ingredients may be used as allspice.',
        short: '[icon:ing_wine] may be used as [icon:spice_all]' },
    { id: 'treeshrew', name: 'The Tree Shrew', animal: 'treeshrew', scope: 'both',
        text: 'Throughout the game, spice multiplies the value of ingredients by 3 (instead of 2).',
        short: '[icon:spice_any] multiplies by 3' },
    { id: 'hippo', name: 'The Hippo', animal: 'hippo', scope: 'challenge', exp: true,
        text: 'Place the unused Challenge Card face up beside the Hippo for the duration of the game. You may serve this additional challenge at the end of each of the 3 days.',
        short: 'A 4th challenge stays open all game · serve it each day' },
    { id: 'hyena', name: 'The Hyena', animal: 'hyena', scope: 'both', exp: true,
        text: 'Throughout the game, 3-value ingredients do not count towards your refrigeration limit. When preparing the critic meal, your fish course may include 3-value ingredients up to your highest-valued fish (before spice).',
        short: '3-value ingredients skip the [icon:fridge] · [icon:ing_fish] course may add 3s' },
    { id: 'pig', name: 'The Pig', animal: 'pig', scope: 'both', exp: true,
        text: 'Throughout the game, spice does not count towards your refrigeration limit. When preparing the critic meal, each course may contain 2 ingredients of its type.',
        short: '[icon:spice_any] skips the [icon:fridge] · 2 ingredients per course' },
    { id: 'wolverine', name: 'The Wolverine', animal: 'wolverine', scope: 'shopping', exp: true, minPlayers: 3,
        text: 'Before Shopping each round, gain ★ for each location where you are alone.',
        short: 'Each round: +1 [icon:star] per location you have alone' }
];
export const CRITIC_BY_ID: Record<string, CriticDef> =
    CRITICS.reduce((m, c) => { m[c.id] = c; return m; }, {} as Record<string, CriticDef>);

// ---------------------------------------------------------------------------
// Rumors
// ---------------------------------------------------------------------------

export type RumorId =
    | 'bigcheese' | 'bigdipper' | 'f_bread' | 'f_carrot' | 'f_cheese' | 'pampered' | 'f_fish'
    | 'hibernator' | 'f_meat' | 'mercurial' | 'f_mushroom' | 'nocturnal' | 'oddtastes' | 'picky'
    | 'psychedelic' | 'shortsighted' | 'simplepalate' | 'sommelier' | 'spicelover' | 'subtle'
    | 'superchatty' | 'tender' | 'togo' | 'unsophisticated' | 'variedleftovers' | 'variedservings'
    | 'winecellar' | 'f_wine';

export interface RumorDef {
    id: RumorId;
    name: string;
    advanced?: boolean;
    /** Fanatic: doubles the named course in final scoring */
    fanatic?: IngType;
    /** the reward printed on the card ('★★★', '?★', 'x2') */
    reward: string;
    text: string;
    short: string;
}

export const RUMORS: RumorDef[] = [
    { id: 'bigcheese', name: 'Big Cheese', advanced: true, reward: '3',
        text: '3★ if your highest-valued cheese (before spice) is equal to or greater than the amount of courses you served.',
        short: 'Top [icon:ing_cheese] ≥ courses served' },
    { id: 'bigdipper', name: 'Big Dipper', advanced: true, reward: '2',
        text: '2★ if your remaining soup quality is equal to or higher than your highest-valued bread (before spice).',
        short: 'Leftover [icon:soup] ≥ top [icon:ing_bread]' },
    { id: 'f_bread', name: 'Bread Fanatic', fanatic: 'bread', reward: 'x2',
        text: 'During final scoring, double the quality of your bread course.', short: '[icon:ing_bread] course ×2' },
    { id: 'f_carrot', name: 'Carrot Fanatic', fanatic: 'carrot', reward: 'x2',
        text: 'During final scoring, double the quality of your carrot course.', short: '[icon:ing_carrot] course ×2' },
    { id: 'f_cheese', name: 'Cheese Fanatic', fanatic: 'cheese', reward: 'x2',
        text: 'During final scoring, double the quality of your cheese course.', short: '[icon:ing_cheese] course ×2' },
    { id: 'pampered', name: 'Extremely Pampered', advanced: true, reward: '2',
        text: '2★ if you serve 7 courses, each including an ingredient with a value of 5 or more (before spice).',
        short: '7 courses, each with a 5+' },
    { id: 'f_fish', name: 'Fish Fanatic', fanatic: 'fish', reward: 'x2',
        text: 'During final scoring, double the quality of your fish course.', short: '[icon:ing_fish] course ×2' },
    { id: 'hibernator', name: 'Hibernator', advanced: true, reward: '2',
        text: '2★ if your rightmost course is your highest-quality course.',
        short: 'Rightmost course is your best' },
    { id: 'f_meat', name: 'Meat Fanatic', fanatic: 'meat', reward: 'x2',
        text: 'During final scoring, double the quality of your meat course.', short: '[icon:ing_meat] course ×2' },
    { id: 'mercurial', name: 'Mercurial', advanced: true, reward: '?',
        text: 'Gain ★ equal to the difference between your highest and lowest ingredient values served (before spice).',
        short: '[icon:star] = highest − lowest value served' },
    { id: 'f_mushroom', name: 'Mushroom Fanatic', fanatic: 'mushroom', reward: 'x2',
        text: 'During final scoring, double the quality of your mushroom course.', short: '[icon:ing_mushroom] course ×2' },
    { id: 'nocturnal', name: 'Nocturnal', advanced: true, reward: '5',
        text: '5★ if the highest-valued ingredient in each course you serve (before spice) is equal to or greater than the one to its left.',
        short: 'Course values never step down' },
    { id: 'oddtastes', name: 'Odd Tastes', reward: '3',
        text: '3★ if your highest-valued ingredient in each course (before spice) is an odd number.',
        short: 'Every course tops out odd' },
    { id: 'picky', name: 'Picky', reward: '?',
        text: 'If you serve 7 courses, gain ★ equal to your lowest-valued ingredient served (before spice).',
        short: '7 courses: [icon:star] = lowest value served' },
    { id: 'psychedelic', name: 'Psychedelic Flavor', advanced: true, reward: '2',
        text: '2★ if your mushroom course is your highest-quality course.',
        short: '[icon:ing_mushroom] is your best course' },
    { id: 'shortsighted', name: 'Shortsighted', reward: '?',
        text: 'Gain ★ equal to 2 less than your highest-valued carrot served (before spice).',
        short: '[icon:star] = top [icon:ing_carrot] − 2' },
    { id: 'simplepalate', name: 'Simple Palate', advanced: true, reward: '3',
        text: '3★ for the player who serves the most ingredients of the same value (before spice).',
        short: 'Most ingredients of one value' },
    { id: 'sommelier', name: 'Sommelier', advanced: true, reward: '2+2',
        text: '2★ if the highest valued wine and fish you serve match (before spice). 2★ if the highest valued wine and meat you serve match (before spice).',
        short: 'Top [icon:ing_wine] = top [icon:ing_fish] · = top [icon:ing_meat]' },
    { id: 'spicelover', name: 'Spice Lover', reward: '2',
        text: '2★ to the player who serves the most spiced items.',
        short: 'Most [icon:spice_any] served' },
    { id: 'subtle', name: 'Subtle Flavors', advanced: true, reward: '3',
        text: '3★ for whoever serves the most ingredients with the same value as their highest value bread served (all before spice).',
        short: 'Most ingredients matching top [icon:ing_bread]' },
    { id: 'superchatty', name: 'Super Chatty', reward: '?',
        text: '1★ for each rumor token you\'ve collected.',
        short: '+1 [icon:star] per [icon:rumor_q] collected' },
    { id: 'tender', name: 'Tender', advanced: true, reward: '3',
        text: '3★ if the highest-valued ingredient served in your leftmost and rightmost course add up to exactly 10 (before spice).',
        short: 'Leftmost + rightmost = 10' },
    { id: 'togo', name: 'To Go', reward: '?',
        text: '1★ for every 2 unserved Ingredient or Spice Tokens. +1★ for whoever has the most.',
        short: '+1 [icon:star] per 2 leftovers · most +1' },
    { id: 'unsophisticated', name: 'Unsophisticated', advanced: true, reward: '?',
        text: '1★ for each unspiced single-ingredient course served. +1★ for whoever serves the most.',
        short: '+1 [icon:star] per plain one-item course · most +1' },
    { id: 'variedleftovers', name: 'Varied Leftovers', advanced: true, reward: '?',
        text: '1★ for each different value on unserved ingredients. +1★ for whoever has the most.',
        short: '+1 [icon:star] per leftover value · most +1' },
    { id: 'variedservings', name: 'Varied Servings', reward: '?',
        text: '1★ for each different value on served ingredients (before spice). +1★ for whoever served the most.',
        short: '+1 [icon:star] per served value · most +1' },
    { id: 'winecellar', name: 'Wine Cellar', advanced: true, reward: '?',
        text: '1★ for each unserved wine (not spice).',
        short: '+1 [icon:star] per leftover [icon:ing_wine]' },
    { id: 'f_wine', name: 'Wine Fanatic', fanatic: 'wine', reward: 'x2',
        text: 'During final scoring, double the quality of your wine course.', short: '[icon:ing_wine] course ×2' }
];
export const RUMOR_BY_ID: Record<string, RumorDef> =
    RUMORS.reduce((m, r) => { m[r.id] = r; return m; }, {} as Record<string, RumorDef>);

// ---------------------------------------------------------------------------
// Restaurateurs
// ---------------------------------------------------------------------------

export type RestId =
    | 'anthony' | 'bobcat' | 'falcoln' | 'goat' | 'graham' | 'heron' | 'jamie' | 'julia' | 'marcus' | 'martha'
    | 'alexg' | 'emeril' | 'guy' | 'morimotter' | 'wolfgang' | 'kitjoy';

export interface RestDef {
    id: RestId;
    name: string;
    animal: string;
    stars: number;
    exp?: boolean;
    text: string;
    short: string;
}

export const RESTAURATEURS: RestDef[] = [
    { id: 'anthony', name: 'Anthony Boardain', animal: 'boar', stars: 3,
        text: 'You may gain an item from the Token Bag instead of a consolation soup.',
        short: 'Consolation: a [icon:bag] item instead of [icon:soup]' },
    { id: 'bobcat', name: 'Bobcat Flay', animal: 'bobcat', stars: 2,
        text: 'Your meat and fish ingredients are worth +3 value for challenge meals (before spice).',
        short: 'Challenges: [icon:ing_meat] [icon:ing_fish] +3' },
    { id: 'falcoln', name: 'Falcoln Brown', animal: 'falcon', stars: 2,
        text: 'Gain +1★ for each challenge meal you served containing exactly 1 of each required ingredient and no soup.',
        short: 'Exact challenge meal, no [icon:soup]: +1 [icon:star]' },
    { id: 'goat', name: 'Goat\'n Ramsay', animal: 'goat', stars: 2,
        text: 'Your 2-value ingredients are each worth +2 for challenge meals (before spice).',
        short: 'Challenges: 2-value ingredients +2' },
    { id: 'graham', name: 'Graham Elephant', animal: 'elephant', stars: 2,
        text: 'Gain 1★ when serving a challenge meal of 25 or greater quality.',
        short: 'Challenge meal 25+: +1 [icon:star]' },
    { id: 'heron', name: 'Herón Sanchez', animal: 'heron', stars: 3,
        text: 'You may apply a single spice to any number of ingredients of the same type in challenge meals.',
        short: 'Challenges: one [icon:spice_any] spices every matching ingredient' },
    { id: 'jamie', name: 'Jamie Owliver', animal: 'owl', stars: 2,
        text: 'Immediately draw an additional Rumor Card that only you can see. It will apply to everyone.',
        short: 'See a 4th secret rumor (scores for all)' },
    { id: 'julia', name: 'Julia Wild', animal: 'cat', stars: 1,
        text: 'You can use any spice as allspice throughout the game.',
        short: 'Every [icon:spice_any] is [icon:spice_all]' },
    { id: 'marcus', name: 'Marcus Roostersson', animal: 'rooster', stars: 2,
        text: 'At the end of each round, move forward on the priority track once. If you\'re already at the front, gain an item from the Token Bag.',
        short: 'Round end: step up the [icon:hat] track (or a [icon:bag] item)' },
    { id: 'martha', name: 'Martha Shrewart', animal: 'shrew', stars: 2,
        text: 'Gain +2★ for serving all 3 challenge meals.',
        short: 'Serve all 3 challenges: +2 [icon:star]' },
    { id: 'alexg', name: 'Alex Guarnashellfish', animal: 'crab', stars: 2, exp: true,
        text: 'Throughout the game you may use 3-value ingredients as if they were any type of your choice.',
        short: '3-value ingredients count as any type' },
    { id: 'emeril', name: 'Emeril Llamasse', animal: 'llama', stars: 2, exp: true,
        text: 'You may treat spice as a 5-value ingredient of that type (instead of as spice). You may treat the allspice as a 5-value ingredient of any type.',
        short: '[icon:spice_any] may be served as a 5-value ingredient' },
    { id: 'guy', name: 'Guy Beari', animal: 'bear', stars: 2, exp: true,
        text: 'Gain a wild rumor from the Token Bag at the start of the game. For each Rumor Token you have, add 1 to the quality of challenge meals you serve.',
        short: 'Start with a [icon:rumor_wild] · challenges +1 per [icon:rumor_q]' },
    { id: 'morimotter', name: 'Morimotter', animal: 'otter', stars: 1, exp: true,
        text: 'At the start of rounds 1, 4, and 7, draw a zous-chef to use that round.',
        short: 'Rounds 1, 4, 7: a free [icon:hat] zous-chef' },
    { id: 'wolfgang', name: 'Wolfgang Duck', animal: 'duck', stars: 2, exp: true,
        text: 'You may treat wine as an ingredient of any type for challenge meals.',
        short: 'Challenges: [icon:ing_wine] counts as any type' },
    { id: 'kitjoy', name: 'Kit Joy', animal: 'kitfox', stars: 2, exp: true,
        text: 'Add 3 to the quality of each of the challenge meals you serve.',
        short: 'Each challenge meal +3 quality' }
];
export const REST_BY_ID: Record<string, RestDef> =
    RESTAURATEURS.reduce((m, r) => { m[r.id] = r; return m; }, {} as Record<string, RestDef>);

// ---------------------------------------------------------------------------
// Zous-chefs
// ---------------------------------------------------------------------------

export type ZousTiming = 'start' | 'before' | 'after';

export interface ZousDef {
    id: string;
    name: string;
    animal: string;
    cap: number;
    timing: ZousTiming;
    exp?: boolean;
    cutthroat?: boolean;
    text: string;
    short: string;
}

export const ZOUS_TIMING_LABEL: Record<ZousTiming, string> = {
    start: 'Start of location', before: 'Before first pick', after: 'After last pick'
};

export const ZOUS_CHEFS: ZousDef[] = [
    { id: 'carol', name: 'Carol Koala', animal: 'koala', cap: 2, timing: 'after',
        text: 'If you\'re at the back of the priority track, gain a ★.',
        short: 'Last on the [icon:hat] track: +1 [icon:star]' },
    { id: 'chrissy', name: 'Chrissy Chipmunk', animal: 'chipmunk', cap: 1, timing: 'start',
        text: 'If Chrissy is alone, pick three items (instead of 1).',
        short: 'Alone: pick 3 items' },
    { id: 'dash', name: 'Dash Cheetah', animal: 'cheetah', cap: 3, timing: 'start',
        text: 'Move to the front of the priority track.',
        short: 'Jump to the front of the [icon:hat] track' },
    { id: 'geoffrey', name: 'Geoffrey Giraffe', animal: 'giraffe', cap: 3, timing: 'before',
        text: 'Add 1 additional item from the Token Bag to Geoffrey\'s location.',
        short: 'Add 1 [icon:bag] item here' },
    { id: 'ginger', name: 'Ginger Fox', animal: 'fox', cap: 2, timing: 'after',
        text: 'Gain an item from the Token Bag.',
        short: 'Gain 1 [icon:bag] item' },
    { id: 'lily', name: 'Lily Frog', animal: 'frog', cap: 1, timing: 'after',
        text: 'Take the bisque from the Soup Truck. If the bisque is not available, take 1 soup instead.',
        short: 'Take the [icon:bisque] (or a [icon:soup])' },
    { id: 'mandy', name: 'Mandy Panda', animal: 'panda', cap: 3, timing: 'after',
        text: 'Mandy picks an additional item from this location. If an additional item is not available, gain 1 from the Token Bag.',
        short: 'Pick 1 more here (or a [icon:bag] item)' },
    { id: 'ming', name: 'Ming Hummingbird', animal: 'hummingbird', cap: 1, timing: 'start',
        text: 'Ming picks before any other chefs. No one changes position on the priority track at this location.',
        short: 'Picks first · no [icon:hat] track changes here' },
    { id: 'newton', name: 'Newton Yorkie', animal: 'yorkie', cap: 1, timing: 'after',
        text: 'If Newton picked the lowest valued ingredient available (not spice), gain 3 soup.',
        short: 'Took the lowest ingredient: +3 [icon:soup]' },
    { id: 'otto', name: 'Otto Otter', animal: 'otter', cap: 2, timing: 'start',
        text: 'If there\'s at least one other chef with a 2 carrying capacity at this location, each of you gains 1 item from the Token Bag.',
        short: 'Another 2-carry chef here: each gains a [icon:bag] item' },
    { id: 'penny', name: 'Penny Penguin', animal: 'penguin', cap: 2, timing: 'after',
        text: 'Pick an additional item from the Soup Truck (may include soup).',
        short: 'Pick 1 more at the [icon:loc_soup] Soup Truck' },
    { id: 'snooze', name: 'Snooze Sloth', animal: 'sloth', cap: 3, timing: 'start',
        text: 'Add 2 additional items from the Token Bag to this location.',
        short: 'Add 2 [icon:bag] items here' },
    // ---- À La Cart expansion (abilities that resolve without extra prompts) ----
    { id: 'alexalpaca', name: 'Alex Alpaca', animal: 'alpaca', cap: 3, timing: 'after', exp: true,
        text: 'If Alex picked any bread ingredients (not spice), gain a ★.',
        short: 'Picked [icon:ing_bread]: +1 [icon:star]' },
    { id: 'cecilia', name: 'Cecilia Python', animal: 'python', cap: 3, timing: 'after', exp: true,
        text: 'For each meat ingredient (not spice) that Cecilia picked from her location, also gain an item from the Token Bag.',
        short: 'Per [icon:ing_meat] picked: +1 [icon:bag] item' },
    { id: 'donna', name: 'Donna Donkey', animal: 'donkey', cap: 3, timing: 'after', exp: true,
        text: 'For each item Donna picked, gain 1 soup.',
        short: 'Per item picked: +1 [icon:soup]' },
    { id: 'finn', name: 'Finn Dolphin', animal: 'dolphin', cap: 2, timing: 'start', exp: true,
        text: 'If Finn is picked by a zous-chef or used to pick a zous-chef, gain 1★.',
        short: 'Zous picks zous: +1 [icon:star]' },
    { id: 'hans', name: 'Hans Mole', animal: 'mole', cap: 2, timing: 'after', exp: true,
        text: 'Draw 5 items from the Token Bag. Keep all mushroom ingredients (not spice) drawn and return all other items.',
        short: 'Draw 5 [icon:bag] items, keep the [icon:ing_mushroom]' },
    { id: 'hootly', name: 'Hootly Owl', animal: 'owl', cap: 2, timing: 'start', exp: true,
        text: 'If Hootly is at the Midnight Merchant and fish spice or ingredients are revealed, Hootly goes before all chefs at this location.',
        short: '[icon:loc_midnight] with [icon:ing_fish] showing: picks first' },
    { id: 'marie', name: 'Marie Butterfly', animal: 'butterfly', cap: 1, timing: 'start', exp: true,
        text: 'If Marie is not alone, you may gain a ★ instead of picking an item.',
        short: 'Not alone: may take +1 [icon:star] instead of an item' },
    { id: 'peter', name: 'Peter Parrot', animal: 'parrot', cap: 1, timing: 'before', exp: true,
        text: 'If there is spice at this location, Peter picks an additional item.',
        short: '[icon:spice_any] here: pick 1 extra item' },
    { id: 'queenie', name: 'Queenie Bee', animal: 'bee', cap: 1, timing: 'after', exp: true,
        text: 'If Queenie was the first to pick from this location, gain an item from the Token Bag.',
        short: 'First to pick here: +1 [icon:bag] item' },
    { id: 'richard', name: 'Richard Lion', animal: 'lion', cap: 3, timing: 'start', exp: true, cutthroat: true,
        text: 'Mouse chefs at Richard\'s location go after all other chefs.',
        short: 'Mouse chefs here pick last' },
    { id: 'shaggy', name: 'Shaggy Retriever', animal: 'retriever', cap: 2, timing: 'after', exp: true,
        text: 'Pick an additional item from this location for each Rumor Token you have in your kitchen.',
        short: 'Pick 1 more per [icon:rumor_q] you hold' },
    { id: 'skeeter', name: 'Skeeter Skunk', animal: 'skunk', cap: 1, timing: 'start', exp: true, cutthroat: true,
        text: 'Other chefs at Skeeter\'s location only pick 1 item each (regardless of carrying capacity).',
        short: 'Other chefs here pick only 1 item' },
    { id: 'stripes', name: 'Stripes Zebra', animal: 'zebra', cap: 3, timing: 'start', exp: true,
        text: 'Stripes picks all of his items before all other chefs of the same carrying capacity. None of these chefs (including Stripes) change position on the priority track.',
        short: 'Picks all before other 3-carry chefs · no [icon:hat] changes' },
    { id: 'syd', name: 'Syd Platypus', animal: 'platypus', cap: 1, timing: 'before', exp: true,
        text: 'If Syd is alone, gain 2 items from the Token Bag.',
        short: 'Alone: +2 [icon:bag] items' },
    { id: 'harriet', name: 'Harriet Hare', animal: 'hare', cap: 1, timing: 'start', exp: true, cutthroat: true,
        text: 'Chefs with a 2 carrying capacity go before chefs with a 1 carrying capacity here. Gain a ★ for each chef here with a 2 carrying capacity.',
        short: '2-carry chefs go first · +1 [icon:star] per 2-carry chef' },
    { id: 'terry', name: 'Terry Tortoise', animal: 'tortoise', cap: 2, timing: 'start', exp: true, cutthroat: true,
        text: 'If there are any chefs with a 1 carrying capacity here, move to the back of the priority track and take items before any other chef.',
        short: '1-carry chef here: drop back on [icon:hat] track, pick first' }
];
export const ZOUS_BY_ID: Record<string, ZousDef> =
    ZOUS_CHEFS.reduce((m, z) => { m[z.id] = z; return m; }, {} as Record<string, ZousDef>);

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface CKOptions {
    /** include À La Cart critics / restaurateurs / zous-chefs */
    expansion: boolean;
    /** include advanced rumors */
    advancedRumors: boolean;
    /** deal restaurateurs */
    restaurateurs: boolean;
}

export const DEFAULT_OPTIONS: CKOptions = { expansion: true, advancedRumors: true, restaurateurs: true };
