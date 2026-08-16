/**
 * WingspanData.ts — data model + representative card / goal catalog for
 * Wingspan (Pocket).
 *
 * This file is the single source of truth for the closed food-type set, the
 * power-effect grammar (§7 / §11.3 of the spec), the bird-card schema (§6), the
 * goal predicates (§8), and the flat-vector art vocabulary (15 bird silhouette
 * shapes × 8 vibrant palettes). The card list below is a *representative* deck
 * that exercises every power `op`; the full 106-card CSV drops straight into
 * `BIRD_CARDS` later without touching the engine, because the engine only reads
 * these structured fields.
 */

// ===========================================================================
// Food types (the closed set of 5)
// ===========================================================================

export type FoodType = 'invertebrate' | 'seed' | 'fish' | 'fruit' | 'rodent';
export const FOOD_TYPES: FoodType[] = ['invertebrate', 'seed', 'fish', 'fruit', 'rodent'];

export type BirdColor = 'brown' | 'green';
export type BeakDir = 'L' | 'R';

// ===========================================================================
// Power grammar (parsed effect trees — §7)
// ===========================================================================

export interface DrawBirdFilter {
    /** bird whose printed cost contains this food ([any] pip does NOT satisfy) */
    cost_contains?: FoodType;
    egg_limit?: number;        // exact egg limit
    egg_limit_min?: number;    // egg limit >= n
    select?: 'largest_wingspan' | 'smallest_wingspan';
}

export type PowerEffect =
    | { op: 'none' }
    // --- brown (active) ---
    | { op: 'draw_food'; food: FoodType | 'any' }
    | { op: 'gain_food'; food: FoodType | 'any' }
    | { op: 'draw_bird'; filter?: DrawBirdFilter }
    | { op: 'draw_card' }
    | { op: 'tuck'; from: 'bird' | 'food' | 'any'; food?: FoodType }
    | { op: 'lay_egg'; target?: 'this' | 'another' | 'any'; count?: number }
    | { op: 'hunt'; max: number }
    | { op: 'discard'; what: 'food' | 'egg' | 'bird'; food?: FoodType | 'any' }
    | { op: 'gated'; pay: PowerEffect; gain: PowerEffect }
    | { op: 'choose_one'; options: PowerEffect[] }
    | { op: 'sequence'; steps: PowerEffect[] }
    | { op: 'copy_brown'; scope: 'own' | 'right' | 'left_rightmost' }
    | { op: 'all_players'; effect: PowerEffect; from_1_deck?: boolean }
    // --- green (passive modifiers) ---
    | { op: 'use_as_any'; food: FoodType }
    | { op: 'ignore_1_in_cost'; food: FoodType }
    | { op: 'food_in_powers_is_any'; food: FoodType }
    | { op: 'copy_green_power' };

export interface PowerCard {
    raw: string;
    activation: BirdColor;
    effect: PowerEffect;
}

// ===========================================================================
// Cost
// ===========================================================================

export interface Cost {
    egg?: number;                              // 0–1
    food: Partial<Record<FoodType, number>>;   // exact food pips
    any?: number;                              // wild pips
    total: number;                             // sum of all pips (difficulty proxy)
}

// ===========================================================================
// Art vocabulary — 15 bird silhouette shapes × 8 palettes
// ===========================================================================

export type ShapeId =
    | 'songbird' | 'raptor' | 'duck' | 'heron' | 'hummingbird'
    | 'owl' | 'swallow' | 'parrot' | 'flamingo' | 'woodpecker'
    | 'rooster' | 'gull' | 'kingfisher' | 'pelican' | 'finch';

export const SHAPE_IDS: ShapeId[] = [
    'songbird', 'raptor', 'duck', 'heron', 'hummingbird',
    'owl', 'swallow', 'parrot', 'flamingo', 'woodpecker',
    'rooster', 'gull', 'kingfisher', 'pelican', 'finch'
];

export type PaletteId =
    | 'cardinal' | 'bluebird' | 'goldfinch' | 'emerald'
    | 'sunset' | 'orchid' | 'teal' | 'slate';

export const PALETTE_IDS: PaletteId[] = [
    'cardinal', 'bluebird', 'goldfinch', 'emerald',
    'sunset', 'orchid', 'teal', 'slate'
];

// ===========================================================================
// Bird card schema (§6)
// ===========================================================================

export interface BirdCard {
    id: number;
    common_name: string;
    scientific_name: string;
    victory_points: number;   // 0–7
    egg_limit: number;        // 0–3
    color: BirdColor;
    wingspan_cm: number;      // 5–303
    beak_direction: BeakDir;
    cost: Cost;
    power: PowerCard;
    reverse_food: FoodType[]; // 1–2 of the 5 types; spent as one
    flavor?: string;
    // --- art (which silhouette + which palette renders this card) ---
    shape: ShapeId;
    palette: PaletteId;
}

// ===========================================================================
// Goals (§8) — 16 static per-bird predicates + 2 runtime/positional
// ===========================================================================

export type GoalId =
    | 'beak_left' | 'beak_right'
    | 'points_even' | 'points_odd'
    | 'points_le_3' | 'points_ge_4'
    | 'egg_limit_1' | 'egg_capacity_not_full'
    | 'has_tucked'
    | 'wingspan_le_50' | 'wingspan_ge_66'
    | 'cost_fish' | 'cost_fruit' | 'cost_rodent' | 'cost_seed'
    | 'cost_invertebrate'
    | 'pos_more_points_than_left' | 'pos_larger_wingspan_than_left';

export interface GoalDef {
    id: GoalId;
    display_icon: string;
    description: string;
    /** true for the 2 runtime/positional goals (evaluated against flock order) */
    positional: boolean;
    /** kept in code for reference/tests, but excluded from the live goal pool */
    unused?: boolean;
}

export const GOALS: GoalDef[] = [
    // NOTE: beak-direction goals are kept in code but flagged `unused` — beak
    // direction is no longer shown on cards, so these never enter the live pool.
    { id: 'beak_left', display_icon: '◀', description: 'Beak pointing left', positional: false, unused: true },
    { id: 'beak_right', display_icon: '▶', description: 'Beak pointing right', positional: false, unused: true },
    { id: 'points_even', display_icon: '2·4', description: 'Even victory points', positional: false },
    { id: 'points_odd', display_icon: '1·3', description: 'Odd victory points', positional: false },
    { id: 'points_le_3', display_icon: '≤3', description: 'Worth 3 points or fewer', positional: false },
    { id: 'points_ge_4', display_icon: '≥4', description: 'Worth 4 points or more', positional: false },
    { id: 'egg_limit_1', display_icon: '1', description: 'Egg limit of exactly 1', positional: false },
    { id: 'egg_capacity_not_full', display_icon: '◔', description: 'Egg limit ≥2 with a free egg slot', positional: false },
    { id: 'has_tucked', display_icon: '⤵', description: 'Has at least 1 tucked card', positional: false },
    { id: 'wingspan_le_50', display_icon: '≤50', description: 'Wingspan ≤ 50 cm', positional: false },
    { id: 'wingspan_ge_66', display_icon: '≥66', description: 'Wingspan ≥ 66 cm', positional: false },
    { id: 'cost_fish', display_icon: '🐟', description: 'Cost contains fish (or [any])', positional: false },
    { id: 'cost_fruit', display_icon: '🍒', description: 'Cost contains fruit (or [any])', positional: false },
    { id: 'cost_rodent', display_icon: '🐭', description: 'Cost contains rodent (or [any])', positional: false },
    { id: 'cost_seed', display_icon: '🌾', description: 'Cost contains seed (or [any])', positional: false },
    { id: 'cost_invertebrate', display_icon: '🐛', description: 'Cost contains invertebrate ([any] does not count)', positional: false },
    { id: 'pos_more_points_than_left', display_icon: '↑pts', description: 'Worth more points than all birds to its left', positional: true },
    { id: 'pos_larger_wingspan_than_left', display_icon: '↑ws', description: 'Larger wingspan than all birds to its left', positional: true }
];

export const GOAL_BY_ID: Record<GoalId, GoalDef> =
    GOALS.reduce((m, g) => { m[g.id] = g; return m; }, {} as Record<GoalId, GoalDef>);

// ===========================================================================
// Gameplay constants
// ===========================================================================

export const HAND_SIZE = 6;              // cards dealt to each player at setup
export const RESERVE_FOOD_AT_SETUP = 4;  // of the 6, this many start food-side up
export const RESERVE_BIRD_AT_SETUP = 2;  // and this many start bird-side up
export const SUPPLY_BIRDS = 4;           // face-up supply birds
export const FOOD_DECKS = 4;             // face-down food decks
export const NEST_EGG_LIMIT = 3;
export const START_NEST_EGGS = 1;
export const FLOCK_TARGET = 6;           // reaching 6 birds triggers the end
export const MAX_LAY_EGGS = 3;

// ===========================================================================
// Card authoring shorthand
// ===========================================================================

let _uid = 1;
const nextId = () => _uid++;

function costTotal(c: Omit<Cost, 'total'>): number {
    let t = c.egg || 0;
    t += c.any || 0;
    const food = c.food || {};
    for (const f of FOOD_TYPES) t += food[f] || 0;
    return t;
}

interface CardSpec {
    name: string;
    sci: string;
    vp: number;
    egg: number;               // egg_limit
    color: BirdColor;
    ws: number;                // wingspan cm
    beak: BeakDir;
    cost: Omit<Cost, 'total'>;
    raw: string;
    effect: PowerEffect;
    rev: FoodType[];
    shape: ShapeId;
    pal: PaletteId;
    flavor?: string;
}

function card(s: CardSpec): BirdCard {
    return {
        id: nextId(),
        common_name: s.name,
        scientific_name: s.sci,
        victory_points: s.vp,
        egg_limit: s.egg,
        color: s.color,
        wingspan_cm: s.ws,
        beak_direction: s.beak,
        cost: { ...s.cost, total: costTotal(s.cost) },
        power: { raw: s.raw, activation: s.color, effect: s.effect },
        reverse_food: s.rev,
        flavor: s.flavor,
        shape: s.shape,
        palette: s.pal
    };
}

// convenient effect builders
const E = {
    none: (): PowerEffect => ({ op: 'none' }),
    drawFood: (food: FoodType | 'any'): PowerEffect => ({ op: 'draw_food', food }),
    gainFood: (food: FoodType | 'any'): PowerEffect => ({ op: 'gain_food', food }),
    drawBird: (filter?: DrawBirdFilter): PowerEffect => ({ op: 'draw_bird', filter }),
    drawCard: (): PowerEffect => ({ op: 'draw_card' }),
    tuck: (from: 'bird' | 'food' | 'any', food?: FoodType): PowerEffect => ({ op: 'tuck', from, food }),
    layEgg: (target: 'this' | 'another' | 'any' = 'any', count = 1): PowerEffect => ({ op: 'lay_egg', target, count }),
    hunt: (max: number): PowerEffect => ({ op: 'hunt', max }),
    discard: (what: 'food' | 'egg' | 'bird', food?: FoodType | 'any'): PowerEffect => ({ op: 'discard', what, food }),
    gated: (pay: PowerEffect, gain: PowerEffect): PowerEffect => ({ op: 'gated', pay, gain }),
    chooseOne: (...options: PowerEffect[]): PowerEffect => ({ op: 'choose_one', options }),
    sequence: (...steps: PowerEffect[]): PowerEffect => ({ op: 'sequence', steps }),
    copyBrown: (scope: 'own' | 'right' | 'left_rightmost'): PowerEffect => ({ op: 'copy_brown', scope }),
    allPlayers: (effect: PowerEffect, from_1_deck = false): PowerEffect => ({ op: 'all_players', effect, from_1_deck }),
    useAsAny: (food: FoodType): PowerEffect => ({ op: 'use_as_any', food }),
    ignore1: (food: FoodType): PowerEffect => ({ op: 'ignore_1_in_cost', food }),
    foodInPowersAny: (food: FoodType): PowerEffect => ({ op: 'food_in_powers_is_any', food }),
    copyGreen: (): PowerEffect => ({ op: 'copy_green_power' })
};

// ===========================================================================
// Representative deck (exercises every power op)
// ===========================================================================
// NOTE: This is a curated stand-in for the full 106-card CSV. Distributions
// roughly follow §6 (mostly brown, some green; egg limits 1–3; costs 1–4).

export const BIRD_CARDS: BirdCard[] = [
    card({
        name: 'American Redstart', sci: 'Setophaga ruticilla', vp: 4, egg: 1, color: 'brown', ws: 20, beak: 'L',
        cost: { egg: 1, food: { invertebrate: 1, fruit: 1 } },
        raw: '[draw_invertebrate] or [draw_fruit]', effect: E.chooseOne(E.drawFood('invertebrate'), E.drawFood('fruit')),
        rev: ['invertebrate'], shape: 'songbird', pal: 'cardinal',
        flavor: 'Redstarts get their name from the Old English word steart, meaning tail.'
    }),
    card({
        name: 'American Robin', sci: 'Turdus migratorius', vp: 2, egg: 2, color: 'brown', ws: 43, beak: 'R',
        cost: { egg: 1, food: { invertebrate: 1, fruit: 1 } },
        raw: '[tuck_bird] [arrow] [draw_bird]', effect: E.gated(E.tuck('bird'), E.drawBird()),
        rev: ['invertebrate', 'seed'], shape: 'songbird', pal: 'sunset',
        flavor: 'Robins have been known to roost in groups of a hundred thousand or more.'
    }),
    card({
        name: 'American White Pelican', sci: 'Pelecanus erythrorhynchos', vp: 5, egg: 1, color: 'green', ws: 274, beak: 'R',
        cost: { food: { fish: 2 } },
        raw: 'use [fish] as [any] when playing birds', effect: E.useAsAny('fish'),
        rev: ['seed'], shape: 'pelican', pal: 'teal',
        flavor: 'Pelicans work together to herd fish and then scoop them up.'
    }),
    card({
        name: 'Andean Cock-of-the-rock', sci: 'Rupicola peruvianus', vp: 6, egg: 1, color: 'brown', ws: 63, beak: 'L',
        cost: { egg: 1, food: { invertebrate: 1, fruit: 2 } },
        raw: 'copy rightmost brown bird power of the player to your left', effect: E.copyBrown('left_rightmost'),
        rev: ['invertebrate'], shape: 'songbird', pal: 'cardinal',
        flavor: 'This showy bird builds mud nests attached to a rock face.'
    }),
    card({
        name: 'Atlantic Puffin', sci: 'Fratercula arctica', vp: 4, egg: 1, color: 'green', ws: 53, beak: 'L',
        cost: { egg: 1, food: { fish: 1 } },
        raw: '[fish] in powers are [any]', effect: E.foodInPowersAny('fish'),
        rev: ['invertebrate', 'seed'], shape: 'gull', pal: 'teal',
        flavor: 'Puffins\' breeding areas are threatened by climate change.'
    }),
    card({
        name: 'Bald Eagle', sci: 'Haliaeetus leucocephalus', vp: 6, egg: 1, color: 'brown', ws: 203, beak: 'R',
        cost: { egg: 1, food: { fish: 1, rodent: 1 } },
        raw: '[discard_fish] [arrow] [lay_egg]', effect: E.gated(E.discard('food', 'fish'), E.layEgg('any', 1)),
        rev: ['invertebrate', 'seed'], shape: 'raptor', pal: 'goldfinch',
        flavor: 'Bald eagles steal fish. Benjamin Franklin thought this was a bad choice for the US national bird.'
    }),
    card({
        name: 'Baltimore Oriole', sci: 'Icterus galbula', vp: 4, egg: 1, color: 'brown', ws: 30, beak: 'R',
        cost: { egg: 1, food: { invertebrate: 1, fruit: 1 } },
        raw: '[draw_bird] with [fruit] in cost', effect: E.drawBird({ cost_contains: 'fruit' }),
        rev: ['seed', 'fruit'], shape: 'songbird', pal: 'goldfinch',
        flavor: 'Orioles weave pouch nests that hang from a tree branch.'
    }),
    card({
        name: 'Barn Owl', sci: 'Tyto alba', vp: 6, egg: 2, color: 'brown', ws: 107, beak: 'L',
        cost: { egg: 1, food: { rodent: 3 } },
        raw: '[draw_rodent] [tuck_rodent]', effect: E.sequence(E.drawFood('rodent'), E.tuck('food', 'rodent')),
        rev: ['rodent'], shape: 'owl', pal: 'goldfinch',
        flavor: 'Barn owls use their excellent hearing to catch prey in the dark and will cache surplus for later.'
    }),
    card({
        name: 'Barn Swallow', sci: 'Hirundo rustica', vp: 1, egg: 2, color: 'brown', ws: 38, beak: 'L',
        cost: { food: { invertebrate: 2 } },
        raw: '[draw_invertebrate] [tuck_bird]', effect: E.sequence(E.drawFood('invertebrate'), E.tuck('bird')),
        rev: ['invertebrate'], shape: 'swallow', pal: 'teal',
        flavor: 'Barn swallows once nested in caves but now favor human-made structures.'
    }),
    card({
        name: 'Bearded Reedling', sci: 'Panurus biarmicus', vp: 4, egg: 3, color: 'brown', ws: 17, beak: 'R',
        cost: { egg: 1, food: { invertebrate: 1, seed: 1 } },
        raw: '[discard_invertebrate] or [discard_seed] [arrow] [lay_egg]', effect: E.gated(E.chooseOne(E.discard('food', 'invertebrate'), E.discard('food', 'seed')), E.layEgg('any', 1)),
        rev: ['rodent'], shape: 'finch', pal: 'sunset',
        flavor: 'These birds have up to 4 broods per year, and sometimes breed the same year they were born.'
    }),
    card({
        name: 'Bee Hummingbird', sci: 'Mellisuga helenae', vp: 3, egg: 1, color: 'brown', ws: 6, beak: 'R',
        cost: { egg: 1, food: {  }, any: 2 },
        raw: '[draw_bird] smallest [wingspan]', effect: E.drawBird({ select: 'smallest_wingspan' }),
        rev: ['fish'], shape: 'hummingbird', pal: 'emerald',
        flavor: 'Weighing just 2 grams, the bee hummingbird is the smallest warm-blooded animal in the world.'
    }),
    card({
        name: 'Black Kite', sci: 'Milvus migrans', vp: 3, egg: 1, color: 'green', ws: 137, beak: 'R',
        cost: { egg: 1, food: { rodent: 1 } },
        raw: 'ignore 1 [rodent] in bird costs', effect: E.ignore1('rodent'),
        rev: ['seed', 'fruit'], shape: 'raptor', pal: 'slate',
        flavor: 'In wildfires, these kites catch fleeing animals; they even drop burning sticks to flush prey.'
    }),
    card({
        name: 'Black-crowned Night Heron', sci: 'Nycticorax nycticorax', vp: 5, egg: 1, color: 'green', ws: 112, beak: 'L',
        cost: { food: { fish: 1, rodent: 1 } },
        raw: '[rodent] in powers are [any]', effect: E.foodInPowersAny('rodent'),
        rev: ['fruit'], shape: 'heron', pal: 'slate',
        flavor: 'Night herons eat carrion and eggs in addition to fish, rodents, and invertebrates.'
    }),
    card({
        name: 'Black-headed Gull', sci: 'Chroicocephalus ridibundus', vp: 4, egg: 1, color: 'brown', ws: 102, beak: 'L',
        cost: { egg: 1, food: { invertebrate: 1 }, any: 2 },
        raw: '[draw_any_food]', effect: E.drawFood('any'),
        rev: ['fruit'], shape: 'gull', pal: 'slate',
        flavor: 'This species is an opportunistic feeder that will consume anything from scraps to fish.'
    }),
    card({
        name: 'Blue Jay', sci: 'Cyanocitta cristata', vp: 4, egg: 1, color: 'brown', ws: 41, beak: 'R',
        cost: { egg: 1, food: { seed: 1 }, any: 1 },
        raw: 'copy rightmost brown bird power of the player to your left', effect: E.copyBrown('left_rightmost'),
        rev: ['invertebrate'], shape: 'songbird', pal: 'bluebird',
        flavor: 'Blue jays can carry up to 5 acorns at a time and will store hundreds for winter.'
    }),
    card({
        name: 'Blue-Footed Booby', sci: 'Sula nebouxii', vp: 3, egg: 1, color: 'brown', ws: 152, beak: 'R',
        cost: { egg: 1, food: { fish: 2 } },
        raw: '[draw_any_food] or [tuck_fish]', effect: E.chooseOne(E.drawFood('any'), E.tuck('food', 'fish')),
        rev: ['invertebrate', 'rodent'], shape: 'gull', pal: 'teal',
        flavor: 'Boobies lift their bright blue feet up to show off for mates; better-fed boobies have bluer feet.'
    }),
    card({
        name: 'Bluethroat', sci: 'Luscinia svecica', vp: 2, egg: 3, color: 'brown', ws: 22, beak: 'R',
        cost: { food: { invertebrate: 1, seed: 1, fruit: 1 } },
        raw: '[draw_bird]', effect: E.drawBird(),
        rev: ['seed', 'fruit'], shape: 'songbird', pal: 'bluebird',
        flavor: 'The species name svecica comes from the male\'s colors matching the Swedish flag.'
    }),
    card({
        name: 'Cockatiel', sci: 'Nymphicus hollandicus', vp: 2, egg: 3, color: 'brown', ws: 32, beak: 'R',
        cost: { egg: 1, food: { seed: 1 } },
        raw: '[tuck_bird] [arrow] [draw_seed]', effect: E.gated(E.tuck('bird'), E.drawFood('seed')),
        rev: ['seed'], shape: 'parrot', pal: 'goldfinch',
        flavor: 'Australia banned the export of cockatiels and other birds in 1894 because of poaching for the pet trade.'
    }),
    card({
        name: 'Common Blackbird', sci: 'Turdus merula', vp: 3, egg: 3, color: 'brown', ws: 36, beak: 'L',
        cost: { food: { invertebrate: 1, fruit: 1 } },
        raw: '[discard_egg] [arrow] [draw_invertebrate] [draw_fruit]', effect: E.gated(E.discard('egg'), E.sequence(E.drawFood('invertebrate'), E.drawFood('fruit'))),
        rev: ['rodent'], shape: 'songbird', pal: 'goldfinch',
        flavor: 'This bird was made world-famous by the Beatles.'
    }),
    card({
        name: 'Common Bulbul', sci: 'Pycnonotus barbatus', vp: 2, egg: 2, color: 'brown', ws: 23, beak: 'L',
        cost: { food: { invertebrate: 1, fruit: 1 } },
        raw: '[tuck_bird] [arrow] [draw_any_food]', effect: E.gated(E.tuck('bird'), E.drawFood('any')),
        rev: ['invertebrate', 'rodent'], shape: 'songbird', pal: 'slate',
        flavor: 'Well-adapted to human habitats, this is one of the most common and widespread birds in Africa.'
    }),
    card({
        name: 'Common Buzzard', sci: 'Buteo buteo', vp: 4, egg: 1, color: 'brown', ws: 123, beak: 'R',
        cost: { egg: 1, food: { rodent: 1 }, any: 1 },
        raw: '[hunt_100]', effect: E.hunt(100),
        rev: ['invertebrate', 'fruit'], shape: 'raptor', pal: 'slate',
        flavor: 'Male buzzards make a spectacular breeding display, flying high then spiraling down over and over.'
    }),
    card({
        name: 'Common Chiffchaff', sci: 'Phylloscopus collybita', vp: 2, egg: 2, color: 'brown', ws: 20, beak: 'L',
        cost: { food: { invertebrate: 1, seed: 1, fruit: 1 } },
        raw: '[draw_any_food] or [tuck_bird]', effect: E.chooseOne(E.drawFood('any'), E.tuck('bird')),
        rev: ['invertebrate', 'rodent'], shape: 'songbird', pal: 'emerald',
        flavor: 'The chiffchaffs name comes from its song, said to announce the arrival of spring.'
    }),
    card({
        name: 'Common Cuckoo', sci: 'Cuculus canorus', vp: 2, egg: 0, color: 'brown', ws: 57, beak: 'L',
        cost: { food: { invertebrate: 2 } },
        raw: '[lay_egg] on another bird', effect: E.layEgg('another', 1),
        rev: ['invertebrate'], shape: 'songbird', pal: 'slate',
        flavor: 'As a brood parsite, the Common Cuckoo\'s eggs can match host species\' eggs in color and pattern.'
    }),
    card({
        name: 'Common Myna', sci: 'Acridotheres tristis', vp: 4, egg: 2, color: 'brown', ws: 35, beak: 'L',
        cost: { food: { invertebrate: 1, seed: 1 }, any: 2 },
        raw: 'copy a brown power on 1 of your birds', effect: E.copyBrown('own'),
        rev: ['rodent'], shape: 'songbird', pal: 'goldfinch',
        flavor: 'Mynas are skilled mimics and can imitate human speech.'
    }),
    card({
        name: 'Common Ostrich', sci: 'Struthio camelus', vp: 4, egg: 3, color: 'brown', ws: 201, beak: 'L',
        cost: { egg: 1, food: { seed: 1 }, any: 1 },
        raw: '[tuck_any_card]', effect: E.tuck('any'),
        rev: ['invertebrate', 'rodent'], shape: 'rooster', pal: 'slate',
        flavor: 'This flightless bird can run as fast as 70 km/h, using its wings for turning and stopping.'
    }),
    card({
        name: 'Common Raven', sci: 'Corvus corax', vp: 4, egg: 1, color: 'brown', ws: 135, beak: 'L',
        cost: { food: { invertebrate: 1, rodent: 1 }, any: 1 },
        raw: '[discard_egg] [arrow] [draw_any_food] [draw_any_food]', effect: E.gated(E.discard('egg'), E.sequence(E.drawFood('any'), E.drawFood('any'))),
        rev: ['fruit'], shape: 'raptor', pal: 'slate',
        flavor: 'Ravens are omnivores whose diet includes insects, rodents, eggs, birds, and carrion.'
    }),
    card({
        name: 'Common Ringed Plover', sci: 'Charadrius hiaticula', vp: 2, egg: 2, color: 'brown', ws: 53, beak: 'L',
        cost: { egg: 1, food: { invertebrate: 2 } },
        raw: '[draw_any_food] or [tuck_invertebrate]', effect: E.chooseOne(E.drawFood('any'), E.tuck('food', 'invertebrate')),
        rev: ['seed', 'fruit'], shape: 'heron', pal: 'slate',
        flavor: 'Plovers\' speckled eggs are protected from predators by blending in with the beach.'
    }),
    card({
        name: 'Common Sandpiper', sci: 'Actitis hypoleucos', vp: 3, egg: 1, color: 'brown', ws: 40, beak: 'L',
        cost: { food: { invertebrate: 2, fish: 1 } },
        raw: '[draw_bird] or [tuck_invertebrate]', effect: E.chooseOne(E.drawBird(), E.tuck('food', 'invertebrate')),
        rev: ['invertebrate', 'fish'], shape: 'heron', pal: 'teal',
        flavor: 'Common sandpipers often forage alone, but can be found roosting in large groups.'
    }),
    card({
        name: 'Common Starling', sci: 'Sturnus vulgaris', vp: 2, egg: 2, color: 'brown', ws: 38, beak: 'L',
        cost: { egg: 1, food: {  }, any: 2 },
        raw: '[discard_egg] [arrow] [draw_any_card] [draw_any_card]', effect: E.gated(E.discard('egg'), E.sequence(E.drawCard(), E.drawCard())),
        rev: ['invertebrate'], shape: 'songbird', pal: 'orchid',
        flavor: 'Large flocks of starlings move in unison; the flock is called a murmuration.'
    }),
    card({
        name: 'Common Swift', sci: 'Apus apus', vp: 3, egg: 1, color: 'brown', ws: 46, beak: 'L',
        cost: { food: { invertebrate: 1 } },
        raw: '[tuck_invertebrate]', effect: E.tuck('food', 'invertebrate'),
        rev: ['invertebrate', 'fish'], shape: 'swallow', pal: 'slate',
        flavor: 'Swifts stay in the air for months between breeding; the name Apus means (incorrectly) no feet.'
    }),
    card({
        name: 'Crested Lark', sci: 'Galerida cristata', vp: 3, egg: 2, color: 'brown', ws: 34, beak: 'R',
        cost: { food: { seed: 1 } },
        raw: '[discard_seed] [arrow] [lay_egg]', effect: E.gated(E.discard('food', 'seed'), E.layEgg('any', 1)),
        rev: ['invertebrate'], shape: 'finch', pal: 'goldfinch',
        flavor: 'This lark raises its crest when it sings, in territorial disputes, and in courtship displays.'
    }),
    card({
        name: 'Crested Oropendola', sci: 'Psarocolius decumanus', vp: 3, egg: 1, color: 'brown', ws: 65, beak: 'L',
        cost: { egg: 1, food: { invertebrate: 1, fruit: 1 } },
        raw: '[draw_any_food] [tuck_bird]', effect: E.sequence(E.drawFood('any'), E.tuck('bird')),
        rev: ['rodent'], shape: 'songbird', pal: 'sunset',
        flavor: 'In courtship displays male oropendolas hang upside down on a branch, calling loudly.'
    }),
    card({
        name: 'Egyptian Goose', sci: 'Alopochen aegyptiaca', vp: 3, egg: 1, color: 'brown', ws: 164, beak: 'L',
        cost: { food: { seed: 1 }, any: 1 },
        raw: '[draw_seed]', effect: E.drawFood('seed'),
        rev: ['invertebrate', 'rodent'], shape: 'duck', pal: 'sunset',
        flavor: 'An Egyptian text from 3,000 years ago called this bird evil because it stole grains and dates.'
    }),
    card({
        name: 'Emperor Penguin', sci: 'Aptenodytes forsteri', vp: 5, egg: 1, color: 'brown', ws: 80, beak: 'L',
        cost: { food: { invertebrate: 1, fish: 2 } },
        raw: '[draw_fish]', effect: E.drawFood('fish'),
        rev: ['invertebrate', 'seed'], shape: 'gull', pal: 'teal',
        flavor: 'March of the Penguins, a film about this bird\'s arduous breeding process, won an Oscar in 2006.'
    }),
    card({
        name: 'Eurasian Hoopoe', sci: 'Upupa epops', vp: 4, egg: 3, color: 'brown', ws: 46, beak: 'R',
        cost: { egg: 1, food: { invertebrate: 2, rodent: 1 } },
        raw: '[discard_invertebrate] [arrow] [draw_any_card] [draw_any_card]', effect: E.gated(E.discard('food', 'invertebrate'), E.sequence(E.drawCard(), E.drawCard())),
        rev: ['fish'], shape: 'kingfisher', pal: 'sunset',
        flavor: 'Hoopoes use their long bills to extract insect larvae from the ground or surface litter.'
    }),
    card({
        name: 'Eurasian Kestrel', sci: 'Falco tinnunculus', vp: 4, egg: 2, color: 'brown', ws: 68, beak: 'R',
        cost: { egg: 1, food: { rodent: 2 } },
        raw: '[hunt_75]', effect: E.hunt(75),
        rev: ['fish'], shape: 'raptor', pal: 'sunset',
        flavor: 'While looking for mice and similar prey, kestrels hover by flying into the wind or by using ridge lift.'
    }),
    card({
        name: 'Eurasian Magpie', sci: 'Pica pica', vp: 4, egg: 2, color: 'brown', ws: 56, beak: 'R',
        cost: { egg: 1, food: {  }, any: 3 },
        raw: 'copy a brown power on 1 of your birds', effect: E.copyBrown('own'),
        rev: ['seed'], shape: 'songbird', pal: 'bluebird',
        flavor: 'These birds are considered to have very high intelligence, similar to great apes.'
    }),
    card({
        name: 'European Goldfinch', sci: 'Carduelis carduelis', vp: 4, egg: 2, color: 'brown', ws: 23, beak: 'R',
        cost: { egg: 1, food: { seed: 1, fruit: 1 } },
        raw: 'copy any brown bird power of the player to your right', effect: E.copyBrown('right'),
        rev: ['invertebrate', 'seed'], shape: 'finch', pal: 'goldfinch',
        flavor: 'This goldfinch is depicted in hundreds of Italian Renaissance paintings.'
    }),
    card({
        name: 'European Robin', sci: 'Erithacus rubecula', vp: 2, egg: 2, color: 'brown', ws: 22, beak: 'R',
        cost: { egg: 1, food: { invertebrate: 1, fruit: 1 } },
        raw: '[draw_any_food]', effect: E.drawFood('any'),
        rev: ['rodent'], shape: 'songbird', pal: 'cardinal',
        flavor: 'Robins will follow gardeners around to eat unearthed worms and grubs.'
    }),
    card({
        name: 'Ferruginous Pygmy-Owl', sci: 'Glaucidium brasilianum', vp: 3, egg: 2, color: 'brown', ws: 39, beak: 'R',
        cost: { food: { invertebrate: 1, rodent: 1 } },
        raw: '[tuck_rodent] [arrow] [draw_any_food]', effect: E.gated(E.tuck('food', 'rodent'), E.drawFood('any')),
        rev: ['invertebrate'], shape: 'owl', pal: 'sunset',
        flavor: 'Bird guides often mimic this owls call to agitate songbirds into revealing themselves.'
    }),
    card({
        name: 'Galah', sci: 'Eolophus roseicapilla', vp: 3, egg: 1, color: 'brown', ws: 75, beak: 'R',
        cost: { egg: 1, food: { seed: 2 } },
        raw: '[draw_any_food] [tuck_bird]', effect: E.sequence(E.drawFood('any'), E.tuck('bird')),
        rev: ['seed'], shape: 'parrot', pal: 'orchid',
        flavor: 'In Australia, a person acting silly and playful is called a galah, named after this bird\'s clownish antics.'
    }),
    card({
        name: 'Great Cormorant', sci: 'Phalacrocorax carbo', vp: 5, egg: 1, color: 'brown', ws: 145, beak: 'R',
        cost: { egg: 1, food: { fish: 2 } },
        raw: '[tuck_fish] [arrow] [draw_any_food]', effect: E.gated(E.tuck('food', 'fish'), E.drawFood('any')),
        rev: ['invertebrate', 'fruit'], shape: 'gull', pal: 'slate',
        flavor: 'People in China and Japan have used cormorants to fish for over 2000 years.'
    }),
    card({
        name: 'Great Hornbill', sci: 'Buceros bicornis', vp: 6, egg: 1, color: 'brown', ws: 160, beak: 'L',
        cost: { egg: 1, food: { invertebrate: 1, fruit: 1, rodent: 1 } },
        raw: '[draw_fruit] [tuck_fruit]', effect: E.sequence(E.drawFood('fruit'), E.tuck('food', 'fruit')),
        rev: ['fish'], shape: 'parrot', pal: 'goldfinch',
        flavor: 'These birds gather at fruiting trees and can roost in flocks of up to 200 outside breeding season.'
    }),
    card({
        name: 'Great Kiskadee', sci: 'Pitangus sulphuratus', vp: 2, egg: 2, color: 'brown', ws: 38, beak: 'L',
        cost: { food: { invertebrate: 1 }, any: 2 },
        raw: '[discard_invertebrate] [arrow] [draw_any_food] [draw_any_food]', effect: E.gated(E.discard('food', 'invertebrate'), E.sequence(E.drawFood('any'), E.drawFood('any'))),
        rev: ['seed'], shape: 'songbird', pal: 'goldfinch',
        flavor: 'The black stripe around kiskadees eyes may reduce glare, aiding hunting in bright light.'
    }),
    card({
        name: 'Great Tit', sci: 'Parus major', vp: 3, egg: 3, color: 'brown', ws: 24, beak: 'L',
        cost: { food: { invertebrate: 1, seed: 1 } },
        raw: '[discard_invertebrate] or [discard_seed] [arrow] [lay_egg]', effect: E.gated(E.chooseOne(E.discard('food', 'invertebrate'), E.discard('food', 'seed')), E.layEgg('any', 1)),
        rev: ['rodent'], shape: 'finch', pal: 'emerald',
        flavor: 'Great tits have been known to use conifer needles as tools to pull insect larvae out of a tree'
    }),
    card({
        name: 'Greater Flamingo', sci: 'Phoenicopterus roseus', vp: 4, egg: 1, color: 'brown', ws: 152, beak: 'L',
        cost: { egg: 1, food: { invertebrate: 2 }, any: 1 },
        raw: '[tuck_bird] [arrow] [draw_bird]', effect: E.gated(E.tuck('bird'), E.drawBird()),
        rev: ['seed'], shape: 'flamingo', pal: 'sunset',
        flavor: 'A greater flamingo at the Adelaide Zoo in Australia lived to be at least 83 years old.'
    }),
    card({
        name: 'Greater Rhea', sci: 'Rhea americana', vp: 3, egg: 3, color: 'brown', ws: 150, beak: 'R',
        cost: { egg: 1, food: { seed: 1 }, any: 2 },
        raw: '[lay_egg] on this bird', effect: E.layEgg('this', 1),
        rev: ['invertebrate', 'rodent'], shape: 'rooster', pal: 'slate',
        flavor: 'South Americas largest bird cannot fly.'
    }),
    card({
        name: 'Greater Roadrunner', sci: 'Geococcyx californianus', vp: 4, egg: 1, color: 'green', ws: 56, beak: 'L',
        cost: { food: { invertebrate: 1, rodent: 1 } },
        raw: 'use [rodent] as [any] when playing birds', effect: E.useAsAny('rodent'),
        rev: ['invertebrate', 'fish'], shape: 'rooster', pal: 'sunset',
        flavor: 'Roadrunners rarely fly, but will jump up to snatch prey out of the air.'
    }),
    card({
        name: 'Green Bee-eater', sci: 'Merops orientalis', vp: 4, egg: 2, color: 'green', ws: 29, beak: 'R',
        cost: { food: { invertebrate: 2 } },
        raw: 'use [invertebrate] as [any] when playing birds', effect: E.useAsAny('invertebrate'),
        rev: ['invertebrate', 'rodent'], shape: 'kingfisher', pal: 'emerald',
        flavor: 'These insectivores often roost in large groups.'
    }),
    card({
        name: 'Green-backed Camaroptera', sci: 'Camaroptera brachyura', vp: 1, egg: 1, color: 'brown', ws: 15, beak: 'R',
        cost: { food: { invertebrate: 1 } },
        raw: '[draw_invertebrate] or [tuck_invertebrate]', effect: E.chooseOne(E.drawFood('invertebrate'), E.tuck('food', 'invertebrate')),
        rev: ['rodent'], shape: 'songbird', pal: 'emerald',
        flavor: 'This bird sews leaves together with spider webs or plant fibers and builds its nest inside.'
    }),
    card({
        name: 'Grey Go-away-bird', sci: 'Crinifer concolor', vp: 4, egg: 1, color: 'brown', ws: 73, beak: 'L',
        cost: { egg: 1, food: { fruit: 2 } },
        raw: '[discard_bird] [arrow] [gain_any_food] [gain_any_food]', effect: E.gated(E.discard('bird'), E.sequence(E.gainFood('any'), E.gainFood('any'))),
        rev: ['fruit'], shape: 'songbird', pal: 'slate',
        flavor: 'This bird\'s alarm call is said to sound like go away.'
    }),
    card({
        name: 'Grey Heron', sci: 'Ardea cinerea', vp: 5, egg: 1, color: 'brown', ws: 185, beak: 'R',
        cost: { food: { invertebrate: 1, fish: 1, rodent: 1 } },
        raw: '[draw_fish]', effect: E.drawFood('fish'),
        rev: ['seed'], shape: 'heron', pal: 'slate',
        flavor: 'These large herons have 19 vertebrae in their necks.'
    }),
    card({
        name: 'Helmeted Guineafowl', sci: 'Numida meleagris', vp: 4, egg: 3, color: 'green', ws: 100, beak: 'R',
        cost: { food: { invertebrate: 1, seed: 1 }, any: 1 },
        raw: '[seed] in powers are [any]', effect: E.foodInPowersAny('seed'),
        rev: ['invertebrate'], shape: 'rooster', pal: 'slate',
        flavor: 'The name Numida means wanderingthese birds can walk over 10 km in a day while foraging.'
    }),
    card({
        name: 'House Sparrow', sci: 'Passer domesticus', vp: 2, egg: 3, color: 'brown', ws: 22, beak: 'R',
        cost: { egg: 1, food: { seed: 1, fruit: 1 } },
        raw: '[lay_egg]', effect: E.layEgg('any', 1),
        rev: ['fish'], shape: 'finch', pal: 'slate',
        flavor: 'This bird diverged genetically around the time agriculture developed.'
    }),
    card({
        name: 'House Wren', sci: 'Troglodytes aedon', vp: 1, egg: 3, color: 'brown', ws: 15, beak: 'L',
        cost: { egg: 1, food: { invertebrate: 2 } },
        raw: '[lay_egg]', effect: E.layEgg('any', 1),
        rev: ['rodent'], shape: 'songbird', pal: 'slate',
        flavor: 'House wrens will remove the eggs of other birds and take over their nests.'
    }),
    card({
        name: 'Inca Tern', sci: 'Larosterna inca', vp: 3, egg: 1, color: 'brown', ws: 80, beak: 'L',
        cost: { food: { invertebrate: 1, fish: 1 } },
        raw: '[discard_fish] [arrow] [draw_any_card] [draw_any_card]', effect: E.gated(E.discard('food', 'fish'), E.sequence(E.drawCard(), E.drawCard())),
        rev: ['fruit'], shape: 'gull', pal: 'slate',
        flavor: 'These terns moustache feathers may signal fitnessthey are longer in healthier terns.'
    }),
    card({
        name: 'Indian Peafowl', sci: 'Pavo cristatus', vp: 5, egg: 2, color: 'brown', ws: 145, beak: 'L',
        cost: { food: { invertebrate: 1, seed: 1 } },
        raw: '[all_players]: [draw_bird] draw blind from 1 food deck', effect: E.allPlayers(E.drawBird(), true),
        rev: ['invertebrate', 'seed'], shape: 'rooster', pal: 'bluebird',
        flavor: 'This bird was designated the national bird of India in 1963.'
    }),
    card({
        name: 'Keel-billed Toucan', sci: 'Ramphastos sulfuratus', vp: 5, egg: 1, color: 'brown', ws: 130, beak: 'L',
        cost: { egg: 1, food: { fruit: 1, rodent: 1 } },
        raw: '[draw_fruit] or [tuck_fruit]', effect: E.chooseOne(E.drawFood('fruit'), E.tuck('food', 'fruit')),
        rev: ['invertebrate'], shape: 'parrot', pal: 'emerald',
        flavor: 'The beak makes up a third of a toucans length but only three percent of its weight.'
    }),
    card({
        name: 'King Vulture', sci: 'Sarcoramphus papa', vp: 0, egg: 1, color: 'brown', ws: 185, beak: 'L',
        cost: { egg: 1, food: {  } },
        raw: '[discard_any_food] [arrow] [draw_any_card] [draw_any_card]', effect: E.gated(E.discard('food', 'any'), E.sequence(E.drawCard(), E.drawCard())),
        rev: ['invertebrate', 'seed'], shape: 'raptor', pal: 'sunset',
        flavor: 'The king vulture follows other birds to a carcass, then uses its size and powerful bill to dominate.'
    }),
    card({
        name: 'Laughing Kookaburra', sci: 'Dacelo novaeguineae', vp: 5, egg: 2, color: 'brown', ws: 60, beak: 'R',
        cost: { egg: 1, food: { invertebrate: 1, fish: 1, rodent: 1 } },
        raw: '[draw_fish] or [draw_rodent]', effect: E.chooseOne(E.drawFood('fish'), E.drawFood('rodent')),
        rev: ['fruit'], shape: 'kingfisher', pal: 'bluebird',
        flavor: 'The name for this large kingfisher comes from guuguubarra in Wiradjuri, an Aboriginal language.'
    }),
    card({
        name: 'Lilac-breasted roller', sci: 'Coracias caudatus', vp: 3, egg: 2, color: 'green', ws: 54, beak: 'L',
        cost: { egg: 1, food: { invertebrate: 1 } },
        raw: '[invertebrate] in powers are [any]', effect: E.foodInPowersAny('invertebrate'),
        rev: ['fish'], shape: 'kingfisher', pal: 'orchid',
        flavor: 'During courtship, Rollers fly up high, then do an acrobatic dive with loops and twists.'
    }),
    card({
        name: 'Little Grebe', sci: 'Tachybaptus ruficollis', vp: 4, egg: 3, color: 'brown', ws: 42, beak: 'L',
        cost: { egg: 1, food: { invertebrate: 1, fish: 1 } },
        raw: '[discard_invertebrate] or [discard_fish] [arrow] [lay_egg]', effect: E.gated(E.chooseOne(E.discard('food', 'invertebrate'), E.discard('food', 'fish')), E.layEgg('any', 1)),
        rev: ['invertebrate', 'rodent'], shape: 'duck', pal: 'slate',
        flavor: 'Grebes are quick diverstheir scientific name comes from takhus, fast, and bapto, to sink.'
    }),
    card({
        name: 'Little Penguin', sci: 'Eudyptula minor', vp: 5, egg: 1, color: 'brown', ws: 12, beak: 'R',
        cost: { egg: 1, food: { fish: 2 } },
        raw: '[draw_fish] [tuck_fish]', effect: E.sequence(E.drawFood('fish'), E.tuck('food', 'fish')),
        rev: ['invertebrate', 'fruit'], shape: 'gull', pal: 'bluebird',
        flavor: 'These penguins dive to catch fish, sometimes as deep as 50 meters.'
    }),
    card({
        name: 'Loggerhead Shrike', sci: 'Lanius ludovicianus', vp: 4, egg: 2, color: 'brown', ws: 30, beak: 'R',
        cost: { egg: 1, food: { rodent: 2 } },
        raw: '[draw_rodent] [tuck_rodent]', effect: E.sequence(E.drawFood('rodent'), E.tuck('food', 'rodent')),
        rev: ['invertebrate', 'fish'], shape: 'songbird', pal: 'slate',
        flavor: 'Shrikes impale their prey on thorns or barbed wire and may save them for later.'
    }),
    card({
        name: 'Magnificent Frigatebird', sci: 'Fregata magnificens', vp: 5, egg: 1, color: 'brown', ws: 230, beak: 'L',
        cost: { egg: 1, food: { invertebrate: 2, fish: 1 } },
        raw: '[draw_fish] or [draw_invertebrate]', effect: E.chooseOne(E.drawFood('fish'), E.drawFood('invertebrate')),
        rev: ['invertebrate', 'fruit'], shape: 'raptor', pal: 'cardinal',
        flavor: 'In courtship, a male frigatebird forces air into its red gular sac, inflating it like a balloon.'
    }),
    card({
        name: 'Mallard', sci: 'Anas platyrhynchos', vp: 2, egg: 2, color: 'brown', ws: 89, beak: 'L',
        cost: { egg: 1, food: { invertebrate: 1, seed: 1 } },
        raw: '[draw_bird] with egg limit 2+', effect: E.drawBird({ egg_limit_min: 2 }),
        rev: ['invertebrate', 'fish'], shape: 'duck', pal: 'emerald',
        flavor: 'Mallards are among the most abundant ducks in the world.'
    }),
    card({
        name: 'Mandarin Duck', sci: 'Aix galericulata', vp: 1, egg: 3, color: 'brown', ws: 71, beak: 'R',
        cost: { egg: 1, food: { invertebrate: 1, seed: 1 } },
        raw: '[draw_bird] or [tuck_bird]', effect: E.chooseOne(E.drawBird(), E.tuck('bird')),
        rev: ['invertebrate', 'fruit'], shape: 'duck', pal: 'sunset',
        flavor: 'A Chinese saying describes loving couples as Two mandarin ducks playing in water.'
    }),
    card({
        name: 'Many-colored Fruit-Dove', sci: 'Ptilinopus perousii', vp: 3, egg: 1, color: 'brown', ws: 30, beak: 'R',
        cost: { egg: 1, food: { fruit: 1 } },
        raw: '[draw_fruit]', effect: E.drawFood('fruit'),
        rev: ['invertebrate', 'seed'], shape: 'songbird', pal: 'orchid',
        flavor: 'This dove depends on two species of fig trees for most of its diet.'
    }),
    card({
        name: 'Marabou Stork', sci: 'Leptoptilos crumenifer', vp: 1, egg: 1, color: 'brown', ws: 256, beak: 'R',
        cost: { egg: 1, food: {  } },
        raw: '[draw_bird] with [rodent] in its cost', effect: E.drawBird({ cost_contains: 'rodent' }),
        rev: ['fish'], shape: 'heron', pal: 'slate',
        flavor: 'These scavengers are sometimes referred to as undertaker birds.'
    }),
    card({
        name: 'Mute Swan', sci: 'Cygnus olor', vp: 5, egg: 2, color: 'brown', ws: 220, beak: 'L',
        cost: { food: { invertebrate: 1, seed: 1 }, any: 1 },
        raw: '[tuck_bird]', effect: E.tuck('bird'),
        rev: ['fruit'], shape: 'duck', pal: 'teal',
        flavor: 'The mute swan earned its name because it is less vocal than other species.'
    }),
    card({
        name: 'North Island Brown Kiwi', sci: 'Apteryx mantelli', vp: 5, egg: 1, color: 'brown', ws: 5, beak: 'L',
        cost: { egg: 1, food: { invertebrate: 2, seed: 1 } },
        raw: '[draw_any_card]', effect: E.drawCard(),
        rev: ['fruit'], shape: 'songbird', pal: 'slate',
        flavor: 'The brown kiwis egg grows to take up 20 percent of the mothers body mass before being laid.'
    }),
    card({
        name: 'Northern Cardinal', sci: 'Cardinalis cardinalis', vp: 3, egg: 3, color: 'brown', ws: 30, beak: 'R',
        cost: { food: { seed: 2, fruit: 1 } },
        raw: '[draw_seed] or [draw_fruit]', effect: E.chooseOne(E.drawFood('seed'), E.drawFood('fruit')),
        rev: ['invertebrate'], shape: 'finch', pal: 'cardinal',
        flavor: 'In most North American species, only males sing, but female cardinals break this rule.'
    }),
    card({
        name: 'Osprey', sci: 'Pandion haliaetus', vp: 3, egg: 1, color: 'green', ws: 160, beak: 'L',
        cost: { egg: 1, food: { fish: 1 } },
        raw: 'ignore 1 [fish] in bird costs', effect: E.ignore1('fish'),
        rev: ['seed', 'fruit'], shape: 'raptor', pal: 'teal',
        flavor: 'Ospreys are excellent hunters, catching a fish in at least 1 out of every 4 dives.'
    }),
    card({
        name: 'Paradise Tanager', sci: 'Tangara chilensis', vp: 3, egg: 1, color: 'green', ws: 20, beak: 'R',
        cost: { food: { fruit: 1 } },
        raw: '[fruit] in powers are [any]', effect: E.foodInPowersAny('fruit'),
        rev: ['rodent'], shape: 'songbird', pal: 'emerald',
        flavor: 'Both sexes of this species look similara sign that their colors might be camouflage, not display.'
    }),
    card({
        name: 'Peregrine Falcon', sci: 'Falco peregrinus', vp: 5, egg: 1, color: 'brown', ws: 104, beak: 'L',
        cost: { egg: 1, food: { rodent: 2 } },
        raw: '[hunt_100]', effect: E.hunt(100),
        rev: ['invertebrate', 'seed'], shape: 'raptor', pal: 'slate',
        flavor: 'Diving to attack, a peregrine falcon can reach speeds up to 320 kilometers per hour.'
    }),
    card({
        name: 'Pied Crow', sci: 'Corvus albus', vp: 5, egg: 1, color: 'brown', ws: 90, beak: 'R',
        cost: { egg: 1, food: {  }, any: 3 },
        raw: '[discard_egg] [arrow] [draw_any_food] [draw_any_food]', effect: E.gated(E.discard('egg'), E.sequence(E.drawFood('any'), E.drawFood('any'))),
        rev: ['invertebrate'], shape: 'songbird', pal: 'slate',
        flavor: 'The Pied Crow is Africa\'s most widespread corvid (the family of crows and ravens).'
    }),
    card({
        name: 'Pileated Woodpecker', sci: 'Dryocopus pileatus', vp: 3, egg: 1, color: 'brown', ws: 74, beak: 'R',
        cost: { egg: 1, food: { invertebrate: 1, fruit: 1 } },
        raw: '[lay_egg] and [all_players]: [lay_egg]', effect: E.sequence(E.layEgg('any', 1), E.allPlayers(E.layEgg('any', 1))),
        rev: ['seed'], shape: 'woodpecker', pal: 'cardinal',
        flavor: 'Other birds use these birds\' old nests and glean bugs where they\'ve been feeding.'
    }),
    card({
        name: 'Rainbow Lorikeet', sci: 'Trichoglossus moluccanus', vp: 4, egg: 1, color: 'green', ws: 46, beak: 'L',
        cost: { food: { invertebrate: 1, fruit: 1 } },
        raw: 'use [fruit] as [any] when playing birds', effect: E.useAsAny('fruit'),
        rev: ['invertebrate', 'fish'], shape: 'parrot', pal: 'goldfinch',
        flavor: 'Some wild lorikeets are so accustomed to humans, they can be hand-fed.'
    }),
    card({
        name: 'Red Avadavat', sci: 'Amandava amandava', vp: 2, egg: 2, color: 'green', ws: 13, beak: 'L',
        cost: { egg: 1, food: { seed: 1 } },
        raw: 'ignore 1 [seed] in bird costs', effect: E.ignore1('seed'),
        rev: ['invertebrate'], shape: 'finch', pal: 'cardinal',
        flavor: 'In courtship display, male avadavats hold a feather or stem in their bill and slowly bow.'
    }),
    card({
        name: 'Red Junglefowl', sci: 'Gallus gallus', vp: 3, egg: 3, color: 'brown', ws: 75, beak: 'L',
        cost: { egg: 1, food: { invertebrate: 1, seed: 2 } },
        raw: '[lay_egg] and [all_players]: [lay_egg]', effect: E.sequence(E.layEgg('any', 1), E.allPlayers(E.layEgg('any', 1))),
        rev: ['fruit'], shape: 'rooster', pal: 'cardinal',
        flavor: 'Chickens were domesticated from this species of junglefowl about 8,000 years ago.'
    }),
    card({
        name: 'Red-billed Quelea', sci: 'Quelea quelea', vp: 3, egg: 2, color: 'brown', ws: 19, beak: 'R',
        cost: { egg: 1, food: { seed: 1 } },
        raw: '[tuck_bird] [tuck_bird]', effect: E.sequence(E.tuck('bird'), E.tuck('bird')),
        rev: ['invertebrate', 'fish'], shape: 'finch', pal: 'cardinal',
        flavor: 'This is the most numerous wild bird, with an estimated population of 1.5 billion.'
    }),
    card({
        name: 'Red-crowned Crane', sci: 'Grus japonensis', vp: 3, egg: 1, color: 'brown', ws: 235, beak: 'R',
        cost: { egg: 1, food: { invertebrate: 1 }, any: 1 },
        raw: '[discard_egg] [arrow] [draw_any_card] [draw_any_card]', effect: E.gated(E.discard('egg'), E.sequence(E.drawCard(), E.drawCard())),
        rev: ['invertebrate'], shape: 'heron', pal: 'cardinal',
        flavor: 'This endangered crane is associated in different cultures with longevity, purity, and peace.'
    }),
    card({
        name: 'Red-headed Barbet', sci: 'Eubucco bourcierii', vp: 2, egg: 2, color: 'brown', ws: 26, beak: 'R',
        cost: { food: { invertebrate: 1, fruit: 1 } },
        raw: '[draw_fruit] or [tuck_any_food]', effect: E.chooseOne(E.drawFood('fruit'), E.tuck('food')),
        rev: ['seed'], shape: 'songbird', pal: 'cardinal',
        flavor: 'This species was Wingspan designer Elizabeth Hargraves spark birdit made her want to be a birder.'
    }),
    card({
        name: 'Resplendent Quetzal', sci: 'Pharomachrus mocinno', vp: 2, egg: 2, color: 'green', ws: 53, beak: 'R',
        cost: { egg: 1, food: { fruit: 1 } },
        raw: 'ignore 1 [fruit] in bird costs', effect: E.ignore1('fruit'),
        rev: ['invertebrate', 'fish'], shape: 'songbird', pal: 'emerald',
        flavor: 'Quetzals are important in Mayan mythology and are the namesake of Guatemalan currency.'
    }),
    card({
        name: 'Rock Pigeon', sci: 'Columba livia', vp: 2, egg: 2, color: 'brown', ws: 64, beak: 'L',
        cost: { egg: 1, food: { invertebrate: 1, seed: 1 } },
        raw: '[lay_egg] and [all_players]: [lay_egg]', effect: E.sequence(E.layEgg('any', 1), E.allPlayers(E.layEgg('any', 1))),
        rev: ['fish'], shape: 'songbird', pal: 'slate',
        flavor: 'These birds were domesticated before 3000 BC as message carriers and for food.'
    }),
    card({
        name: 'Roseate Spoonbill', sci: 'Platalea ajaja', vp: 5, egg: 1, color: 'brown', ws: 127, beak: 'R',
        cost: { egg: 1, food: { invertebrate: 1, seed: 1, fish: 1 } },
        raw: '[draw_invertebrate] [draw_fish]', effect: E.sequence(E.drawFood('invertebrate'), E.drawFood('fish')),
        rev: ['invertebrate', 'fish'], shape: 'heron', pal: 'orchid',
        flavor: 'This bird\'s unusually shaped bill helps it feel prey in the water.'
    }),
    card({
        name: 'Ruby-throated Hummingbird', sci: 'Archilochus colubris', vp: 5, egg: 1, color: 'brown', ws: 10, beak: 'R',
        cost: { egg: 1, food: {  }, any: 1 },
        raw: '[all_players]: [draw_any_food] from 1 deck', effect: E.allPlayers(E.drawFood('any'), true),
        rev: ['invertebrate', 'fruit'], shape: 'hummingbird', pal: 'emerald',
        flavor: 'Hummingbirds feed on nectarbut they also eat many small insects.'
    }),
    card({
        name: 'Scarlet Ibis', sci: 'Eudocimus ruber', vp: 3, egg: 1, color: 'brown', ws: 100, beak: 'R',
        cost: { egg: 1, food: { invertebrate: 1, fish: 1 } },
        raw: '[draw_bird] with egg limit of 1', effect: E.drawBird({ egg_limit: 1 }),
        rev: ['seed'], shape: 'heron', pal: 'cardinal',
        flavor: 'These birds will feed in both saltwater and freshwater, but the young need freshwater prey.'
    }),
    card({
        name: 'Scarlet Macaw', sci: 'Ara macao', vp: 6, egg: 1, color: 'brown', ws: 100, beak: 'R',
        cost: { food: { seed: 2, fruit: 1 } },
        raw: '[tuck_bird]', effect: E.tuck('bird'),
        rev: ['invertebrate'], shape: 'parrot', pal: 'cardinal',
        flavor: 'This is the national bird of Honduras, where it is featured in Mayan sculptures.'
    }),
    card({
        name: 'Scarlet-chested Sunbird', sci: 'Chalcomitra senegalensis', vp: 2, egg: 2, color: 'brown', ws: 22, beak: 'L',
        cost: { egg: 1, food: { invertebrate: 1 }, any: 1 },
        raw: '[draw_any_food]', effect: E.drawFood('any'),
        rev: ['fruit'], shape: 'songbird', pal: 'cardinal',
        flavor: 'This sunbird\'s curved beak is adapted for its mostly-nectar diet.'
    }),
    card({
        name: 'Scissor-tailed Flycatcher', sci: 'Tyrannus forficatus', vp: 7, egg: 1, color: 'brown', ws: 38, beak: 'R',
        cost: { egg: 1, food: { invertebrate: 2, fruit: 1 } },
        raw: '[all_players]: [draw_any_food] from 1 deck', effect: E.allPlayers(E.drawFood('any'), true),
        rev: ['rodent'], shape: 'songbird', pal: 'sunset',
        flavor: 'The mating display of these birds involves aerial acrobatics that show off their long tails.'
    }),
    card({
        name: 'Secretarybird', sci: 'Sagittarius serpentarius', vp: 6, egg: 1, color: 'brown', ws: 203, beak: 'R',
        cost: { food: { invertebrate: 1, rodent: 2 } },
        raw: '[discard_rodent] [arrow] [draw_any_card] [draw_any_card]', effect: E.gated(E.discard('food', 'rodent'), E.sequence(E.drawCard(), E.drawCard())),
        rev: ['fruit'], shape: 'raptor', pal: 'slate',
        flavor: 'These terrestrial raptors are known for stomping on their prey to kill it.'
    }),
    card({
        name: 'Shoebill', sci: 'Balaeniceps rex', vp: 6, egg: 1, color: 'brown', ws: 245, beak: 'L',
        cost: { egg: 1, food: { fish: 2, rodent: 1 } },
        raw: '[draw_fish] [draw_rodent]', effect: E.sequence(E.drawFood('fish'), E.drawFood('rodent')),
        rev: ['invertebrate', 'rodent'], shape: 'heron', pal: 'slate',
        flavor: 'These birds stand motionless until prety comes by, then they seize it with their razor-sharp bill.'
    }),
    card({
        name: 'Snowy Albatross', sci: 'Diomedea exulans', vp: 5, egg: 1, color: 'brown', ws: 303, beak: 'L',
        cost: { egg: 1, food: { invertebrate: 1, fish: 2 } },
        raw: '[draw_bird] largest [wingspan]', effect: E.drawBird({ select: 'largest_wingspan' }),
        rev: ['invertebrate'], shape: 'gull', pal: 'teal',
        flavor: 'The snowy albatross has the largest wingspan of any bird on earth.'
    }),
    card({
        name: 'Snowy Owl', sci: 'Bubo scandiacus', vp: 6, egg: 2, color: 'brown', ws: 138, beak: 'R',
        cost: { egg: 1, food: { rodent: 3 } },
        raw: '[hunt_100]', effect: E.hunt(100),
        rev: ['fish'], shape: 'owl', pal: 'slate',
        flavor: 'Snowy owls are rare among owls, in that they are active during the day.'
    }),
    card({
        name: 'Southern Cassowary', sci: 'Casuarius casuarius', vp: 6, egg: 2, color: 'brown', ws: 152, beak: 'R',
        cost: { food: { fruit: 2 }, any: 1 },
        raw: '[discard_bird] [arrow] [lay_egg]', effect: E.gated(E.discard('bird'), E.layEgg('any', 1)),
        rev: ['invertebrate', 'rodent'], shape: 'rooster', pal: 'bluebird',
        flavor: 'These aggressive birds are important for dispersing the seeds of large fruits in the rainforest.'
    }),
    card({
        name: 'Splendid Fairywren', sci: 'Malurus splendens', vp: 3, egg: 3, color: 'brown', ws: 15, beak: 'R',
        cost: { egg: 1, food: { invertebrate: 1 } },
        raw: '[discard_any_food] [arrow] [lay_egg]', effect: E.gated(E.discard('food', 'any'), E.layEgg('any', 1)),
        rev: ['invertebrate'], shape: 'songbird', pal: 'bluebird',
        flavor: 'These birds make dome-shaped nests with a side opening, often in a low bush.'
    }),
    card({
        name: 'Stork-billed Kingfisher', sci: 'Pelargopsis capensis', vp: 5, egg: 1, color: 'brown', ws: 56, beak: 'L',
        cost: { egg: 1, food: { fish: 1, rodent: 1 } },
        raw: '[tuck_fish] [draw_rodent]', effect: E.sequence(E.tuck('food', 'fish'), E.drawFood('rodent')),
        rev: ['fruit'], shape: 'kingfisher', pal: 'teal',
        flavor: 'Kingfishers use their strong bills to dig burrows in river banks, dead trees, or termite nests.'
    }),
    card({
        name: 'Superb Lyrebird', sci: 'Menura novaehollandiae', vp: 1, egg: 1, color: 'green', ws: 73, beak: 'L',
        cost: { food: { invertebrate: 1 }, any: 1 },
        raw: 'copy a green power in any flock (1 per turn)', effect: E.copyGreen(),
        rev: ['fish'], shape: 'rooster', pal: 'slate',
        flavor: 'Male lyrebirds attract mates with their huge tails and an extraordinary ability for mimicry.'
    }),
    card({
        name: 'Tawny Frogmouth', sci: 'Podargus strigoides', vp: 4, egg: 1, color: 'brown', ws: 82, beak: 'L',
        cost: { egg: 1, food: { invertebrate: 1, rodent: 1 } },
        raw: '[gain_invertebrate] or [tuck_any_food]', effect: E.chooseOne(E.gainFood('invertebrate'), E.tuck('food')),
        rev: ['invertebrate', 'seed'], shape: 'owl', pal: 'slate',
        flavor: 'These nocturnal birds are masters of camouflage and are often mistaken for broken tree branches.'
    }),
    card({
        name: 'Tropical Royal Flycatcher', sci: 'Onychorhynchus coronatus', vp: 3, egg: 2, color: 'brown', ws: 27, beak: 'R',
        cost: { egg: 1, food: { invertebrate: 2 } },
        raw: '[gain_invertebrate]', effect: E.gainFood('invertebrate'),
        rev: ['seed'], shape: 'songbird', pal: 'cardinal',
        flavor: 'Males of this species have a spectacular crest, but it is rarely displayed outside of courtship.'
    }),
    card({
        name: 'Turquoise-browed Motmot', sci: 'Eumomota superciliosa', vp: 4, egg: 2, color: 'brown', ws: 55, beak: 'R',
        cost: { food: { invertebrate: 2 } },
        raw: '[all_players]: [draw_bird] draw blind from 1 food deck', effect: E.allPlayers(E.drawBird(), true),
        rev: ['fish'], shape: 'kingfisher', pal: 'bluebird',
        flavor: 'The motmot often warns of possible danger by swinging its tail back and forth like a pendulum.'
    }),
    card({
        name: 'Village Weaver', sci: 'Ploceus cucullatus', vp: 4, egg: 1, color: 'brown', ws: 25, beak: 'L',
        cost: { food: { invertebrate: 1, seed: 1 } },
        raw: '[discard_seed] [arrow] [draw_any_card] [draw_any_card]', effect: E.gated(E.discard('food', 'seed'), E.sequence(E.drawCard(), E.drawCard())),
        rev: ['invertebrate', 'fish'], shape: 'finch', pal: 'goldfinch',
        flavor: 'These social birds weave hanging nests, often with up to hundreds in a single tree.'
    }),
    card({
        name: 'Western Cattle Egret', sci: 'Ardea ibis', vp: 2, egg: 1, color: 'green', ws: 92, beak: 'L',
        cost: { food: { invertebrate: 2 } },
        raw: 'ignore 1 [invertebrate] in bird costs', effect: E.ignore1('invertebrate'),
        rev: ['seed'], shape: 'heron', pal: 'goldfinch',
        flavor: 'These birds feed primarily on insects that jump away when distracted by large grazing animals.'
    }),
    card({
        name: 'White Wagtail', sci: 'Motacilla alba', vp: 3, egg: 3, color: 'brown', ws: 28, beak: 'L',
        cost: { egg: 1, food: { invertebrate: 3 } },
        raw: '[draw_bird] with [invertebrate] in cost', effect: E.drawBird({ cost_contains: 'invertebrate' }),
        rev: ['rodent'], shape: 'songbird', pal: 'slate',
        flavor: 'The white wagtail is the national bird of Latvia.'
    }),
    card({
        name: 'Wild Turkey', sci: 'Meleagris gallopavo', vp: 4, egg: 3, color: 'green', ws: 135, beak: 'R',
        cost: { egg: 1, food: { seed: 1, fruit: 1 } },
        raw: 'use [seed] as [any] when playing birds', effect: E.useAsAny('seed'),
        rev: ['fish'], shape: 'rooster', pal: 'sunset',
        flavor: 'Wild turkeys were domesticated in the Americas before European contact.'
    })
];

export const CARD_BY_ID: Record<number, BirdCard> =
    BIRD_CARDS.reduce((m, c) => { m[c.id] = c; return m; }, {} as Record<number, BirdCard>);

export const ALL_CARD_IDS: number[] = BIRD_CARDS.map(c => c.id);

// ===========================================================================
// Goal evaluation (§8)
// ===========================================================================

/** Does the card's printed cost contain this food type (as an exact pip)? */
export function costHasFood(card: BirdCard, food: FoodType): boolean {
    return (card.cost.food[food] || 0) > 0;
}
/** Cost contains this food OR an [any] wild pip (used for the fish/fruit/rodent/seed goals). */
export function costHasFoodOrAny(card: BirdCard, food: FoodType): boolean {
    return costHasFood(card, food) || (card.cost.any || 0) > 0;
}

/**
 * Evaluate a *static* (non-positional) goal against a card. `tucked`/`eggs` are
 * the live per-instance counts (needed for `egg_capacity_not_full` and
 * `has_tucked`). Positional goals are evaluated separately against flock order.
 */
export function cardMatchesStaticGoal(
    card: BirdCard, goal: GoalId, live: { eggs: number; tucked: number }
): boolean {
    switch (goal) {
        case 'beak_left': return card.beak_direction === 'L';
        case 'beak_right': return card.beak_direction === 'R';
        case 'points_even': return card.victory_points % 2 === 0;
        case 'points_odd': return card.victory_points % 2 === 1;
        case 'points_le_3': return card.victory_points <= 3;
        case 'points_ge_4': return card.victory_points >= 4;
        case 'egg_limit_1': return card.egg_limit === 1;
        case 'egg_capacity_not_full': return card.egg_limit >= 2 && live.eggs < card.egg_limit;
        case 'has_tucked': return live.tucked >= 1;
        case 'wingspan_le_50': return card.wingspan_cm <= 50;
        case 'wingspan_ge_66': return card.wingspan_cm >= 66;
        case 'cost_fish': return costHasFoodOrAny(card, 'fish');
        case 'cost_fruit': return costHasFoodOrAny(card, 'fruit');
        case 'cost_rodent': return costHasFoodOrAny(card, 'rodent');
        case 'cost_seed': return costHasFoodOrAny(card, 'seed');
        case 'cost_invertebrate': return costHasFood(card, 'invertebrate'); // [any] does NOT count
        default: return false;
    }
}
