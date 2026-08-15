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
    // ---- brown: draw / gain food ----
    card({
        name: 'American Robin', sci: 'Turdus migratorius', vp: 2, egg: 2, color: 'brown', ws: 43, beak: 'R',
        cost: { egg: 1, food: { invertebrate: 1, fruit: 1 } },
        raw: '[tuck_bird] [arrow] [draw_bird]', effect: E.gated(E.tuck('bird'), E.drawBird()),
        rev: ['invertebrate', 'seed'], shape: 'songbird', pal: 'sunset',
        flavor: 'Robins roost in enormous winter flocks.'
    }),
    card({
        name: 'House Sparrow', sci: 'Passer domesticus', vp: 1, egg: 2, color: 'brown', ws: 24, beak: 'L',
        cost: { food: { seed: 1 } },
        raw: '[draw_seed]', effect: E.drawFood('seed'),
        rev: ['seed', 'invertebrate'], shape: 'finch', pal: 'slate'
    }),
    card({
        name: 'Blue Jay', sci: 'Cyanocitta cristata', vp: 3, egg: 2, color: 'brown', ws: 41, beak: 'R',
        cost: { food: { seed: 1, fruit: 1 } },
        raw: '[gain_seed] [gain_seed]', effect: E.sequence(E.gainFood('seed'), E.gainFood('seed')),
        rev: ['seed'], shape: 'parrot', pal: 'bluebird'
    }),
    card({
        name: 'Cedar Waxwing', sci: 'Bombycilla cedrorum', vp: 3, egg: 1, color: 'brown', ws: 30, beak: 'L',
        cost: { food: { fruit: 2 } },
        raw: '[draw_fruit]', effect: E.drawFood('fruit'),
        rev: ['fruit'], shape: 'songbird', pal: 'goldfinch'
    }),

    // ---- brown: lay eggs ----
    card({
        name: 'Mallard', sci: 'Anas platyrhynchos', vp: 1, egg: 3, color: 'brown', ws: 90, beak: 'R',
        cost: { food: { seed: 1, invertebrate: 1 } },
        raw: '[lay_egg] on this bird', effect: E.layEgg('this', 1),
        rev: ['seed', 'invertebrate'], shape: 'duck', pal: 'emerald'
    }),
    card({
        name: 'Canada Goose', sci: 'Branta canadensis', vp: 1, egg: 3, color: 'brown', ws: 152, beak: 'L',
        cost: { food: { seed: 2 } },
        raw: '[lay_egg] on any bird', effect: E.layEgg('any', 1),
        rev: ['seed'], shape: 'duck', pal: 'slate'
    }),
    card({
        name: 'Wild Turkey', sci: 'Meleagris gallopavo', vp: 5, egg: 3, color: 'brown', ws: 114, beak: 'R',
        cost: { food: { seed: 1, invertebrate: 1, fruit: 1 } },
        raw: '[lay_egg] [lay_egg] on this bird', effect: E.layEgg('this', 2),
        rev: ['seed'], shape: 'rooster', pal: 'sunset'
    }),

    // ---- brown: tuck ----
    card({
        name: 'Barn Swallow', sci: 'Hirundo rustica', vp: 2, egg: 1, color: 'brown', ws: 32, beak: 'L',
        cost: { food: { invertebrate: 1 } },
        raw: '[tuck_any_card] [arrow] [lay_egg] on this bird', effect: E.gated(E.tuck('any'), E.layEgg('this', 1)),
        rev: ['invertebrate'], shape: 'swallow', pal: 'teal'
    }),
    card({
        name: 'Chimney Swift', sci: 'Chaetura pelagica', vp: 4, egg: 1, color: 'brown', ws: 30, beak: 'R',
        cost: { food: { invertebrate: 1 } },
        raw: '[tuck_any_card]', effect: E.tuck('any'),
        rev: ['invertebrate'], shape: 'swallow', pal: 'orchid'
    }),

    // ---- brown: hunt ----
    card({
        name: 'Red-tailed Hawk', sci: 'Buteo jamaicensis', vp: 5, egg: 1, color: 'brown', ws: 114, beak: 'R',
        cost: { food: { rodent: 2 } },
        raw: '[hunt_100]', effect: E.hunt(100),
        rev: ['rodent'], shape: 'raptor', pal: 'sunset'
    }),
    card({
        name: 'Barn Owl', sci: 'Tyto alba', vp: 4, egg: 2, color: 'brown', ws: 105, beak: 'R',
        cost: { food: { rodent: 1 } },
        raw: '[hunt_75]', effect: E.hunt(75),
        rev: ['rodent'], shape: 'owl', pal: 'goldfinch'
    }),

    // ---- brown: draw bird (filters) ----
    card({
        name: 'Osprey', sci: 'Pandion haliaetus', vp: 3, egg: 1, color: 'brown', ws: 163, beak: 'R',
        cost: { food: { fish: 2 } },
        raw: '[draw_bird] with fish in cost', effect: E.drawBird({ cost_contains: 'fish' }),
        rev: ['fish'], shape: 'raptor', pal: 'teal'
    }),
    card({
        name: 'Great Egret', sci: 'Ardea alba', vp: 4, egg: 2, color: 'brown', ws: 130, beak: 'L',
        cost: { food: { fish: 1, invertebrate: 1 } },
        raw: '[draw_bird] with largest wingspan', effect: E.drawBird({ select: 'largest_wingspan' }),
        rev: ['fish'], shape: 'heron', pal: 'slate'
    }),
    card({
        name: 'Ruby-throated Hummingbird', sci: 'Archilochus colubris', vp: 3, egg: 1, color: 'brown', ws: 11, beak: 'L',
        cost: { food: { invertebrate: 1 } },
        raw: '[draw_bird] with egg limit of 1', effect: E.drawBird({ egg_limit: 1 }),
        rev: ['invertebrate', 'fruit'], shape: 'hummingbird', pal: 'emerald'
    }),

    // ---- brown: draw any card / gated draws ----
    card({
        name: 'Northern Mockingbird', sci: 'Mimus polyglottos', vp: 2, egg: 2, color: 'brown', ws: 36, beak: 'R',
        cost: { food: { invertebrate: 1, fruit: 1 } },
        raw: '[draw_any_card]', effect: E.drawCard(),
        rev: ['invertebrate', 'fruit'], shape: 'songbird', pal: 'slate'
    }),
    card({
        name: 'Belted Kingfisher', sci: 'Megaceryle alcyon', vp: 3, egg: 1, color: 'brown', ws: 51, beak: 'L',
        cost: { food: { fish: 1 } },
        raw: '[discard_fish] [arrow] [draw_2_food] from 1 deck', effect: E.gated(E.discard('food', 'fish'), E.allPlayers(E.none())),
        rev: ['fish'], shape: 'kingfisher', pal: 'teal'
    }),

    // ---- brown: all players ----
    card({
        name: 'American Crow', sci: 'Corvus brachyrhynchos', vp: 3, egg: 2, color: 'brown', ws: 99, beak: 'R',
        cost: { food: { seed: 1, invertebrate: 1 } },
        raw: '[all_players]: [draw_1_food] from 1 deck', effect: E.allPlayers(E.drawFood('any'), true),
        rev: ['seed', 'invertebrate'], shape: 'raptor', pal: 'slate'
    }),
    card({
        name: 'Snow Goose', sci: 'Anser caerulescens', vp: 3, egg: 3, color: 'brown', ws: 150, beak: 'L',
        cost: { food: { seed: 2 } },
        raw: '[all_players]: [lay_egg]', effect: E.allPlayers(E.layEgg('any', 1)),
        rev: ['seed'], shape: 'duck', pal: 'bluebird'
    }),

    // ---- brown: copy powers ----
    card({
        name: 'Gray Catbird', sci: 'Dumetella carolinensis', vp: 2, egg: 2, color: 'brown', ws: 28, beak: 'L',
        cost: { food: { invertebrate: 1, fruit: 1 } },
        raw: 'copy a brown power on 1 of your birds', effect: E.copyBrown('own'),
        rev: ['invertebrate', 'fruit'], shape: 'songbird', pal: 'orchid'
    }),

    // ---- brown: choose one ----
    card({
        name: 'Black-capped Chickadee', sci: 'Poecile atricapillus', vp: 1, egg: 2, color: 'brown', ws: 20, beak: 'R',
        cost: { food: { invertebrate: 1 } },
        raw: '[draw_seed] or [tuck_any_card]', effect: E.chooseOne(E.drawFood('seed'), E.tuck('any')),
        rev: ['seed', 'invertebrate'], shape: 'finch', pal: 'goldfinch'
    }),

    // ---- brown: any-food draws / big value ----
    card({
        name: 'Bald Eagle', sci: 'Haliaeetus leucocephalus', vp: 7, egg: 1, color: 'brown', ws: 203, beak: 'R',
        cost: { food: { fish: 2, rodent: 1 } },
        raw: '[hunt_100]', effect: E.hunt(100),
        rev: ['fish', 'rodent'], shape: 'raptor', pal: 'goldfinch'
    }),
    card({
        name: 'Brown Pelican', sci: 'Pelecanus occidentalis', vp: 5, egg: 1, color: 'brown', ws: 203, beak: 'L',
        cost: { food: { fish: 2 } },
        raw: '[draw_fish] [draw_fish]', effect: E.sequence(E.drawFood('fish'), E.drawFood('fish')),
        rev: ['fish'], shape: 'pelican', pal: 'sunset'
    }),
    card({
        name: 'Greater Flamingo', sci: 'Phoenicopterus roseus', vp: 4, egg: 2, color: 'brown', ws: 150, beak: 'L',
        cost: { food: { invertebrate: 1, seed: 1 } },
        raw: '[draw_any_food]', effect: E.drawFood('any'),
        rev: ['invertebrate'], shape: 'flamingo', pal: 'orchid'
    }),
    card({
        name: 'Downy Woodpecker', sci: 'Dryobates pubescens', vp: 2, egg: 2, color: 'brown', ws: 30, beak: 'R',
        cost: { food: { invertebrate: 1 } },
        raw: '[gain_invertebrate]', effect: E.gainFood('invertebrate'),
        rev: ['invertebrate', 'seed'], shape: 'woodpecker', pal: 'cardinal'
    }),
    card({
        name: 'Herring Gull', sci: 'Larus argentatus', vp: 2, egg: 2, color: 'brown', ws: 144, beak: 'L',
        cost: { food: {}, any: 2 },
        raw: '[draw_any_food]', effect: E.drawFood('any'),
        rev: ['fish', 'invertebrate'], shape: 'gull', pal: 'slate'
    }),
    card({
        name: 'Northern Cardinal', sci: 'Cardinalis cardinalis', vp: 3, egg: 2, color: 'brown', ws: 30, beak: 'R',
        cost: { food: { seed: 1, fruit: 1 } },
        raw: '[lay_egg] on any bird', effect: E.layEgg('any', 1),
        rev: ['seed', 'fruit'], shape: 'songbird', pal: 'cardinal'
    }),

    // ---- GREEN: passive modifiers ----
    card({
        name: 'Anna\'s Hummingbird', sci: 'Calypte anna', vp: 4, egg: 1, color: 'green', ws: 12, beak: 'L',
        cost: { food: { invertebrate: 1 } },
        raw: 'use fruit as [any] when playing birds', effect: E.useAsAny('fruit'),
        rev: ['invertebrate', 'fruit'], shape: 'hummingbird', pal: 'cardinal'
    }),
    card({
        name: 'American Goldfinch', sci: 'Spinus tristis', vp: 2, egg: 2, color: 'green', ws: 22, beak: 'R',
        cost: { food: { seed: 1 } },
        raw: 'ignore 1 seed in bird costs', effect: E.ignore1('seed'),
        rev: ['seed'], shape: 'finch', pal: 'goldfinch'
    }),
    card({
        name: 'Great Horned Owl', sci: 'Bubo virginianus', vp: 6, egg: 1, color: 'green', ws: 114, beak: 'R',
        cost: { food: { rodent: 2 } },
        raw: 'rodent in powers are [any]', effect: E.foodInPowersAny('rodent'),
        rev: ['rodent'], shape: 'owl', pal: 'slate'
    }),
    card({
        name: 'Superb Lyrebird', sci: 'Menura novaehollandiae', vp: 5, egg: 1, color: 'green', ws: 80, beak: 'L',
        cost: { food: { invertebrate: 2 } },
        raw: 'copy a green power in any flock (1 per turn)', effect: E.copyGreen(),
        rev: ['invertebrate'], shape: 'rooster', pal: 'emerald'
    }),
    card({
        name: 'Eastern Bluebird', sci: 'Sialia sialis', vp: 3, egg: 2, color: 'green', ws: 33, beak: 'R',
        cost: { food: { invertebrate: 1, fruit: 1 } },
        raw: 'use invertebrate as [any] when playing birds', effect: E.useAsAny('invertebrate'),
        rev: ['invertebrate', 'fruit'], shape: 'songbird', pal: 'bluebird'
    }),
    card({
        name: 'Pileated Woodpecker', sci: 'Dryocopus pileatus', vp: 5, egg: 1, color: 'green', ws: 74, beak: 'L',
        cost: { food: { invertebrate: 2 } },
        raw: 'ignore 1 invertebrate in bird costs', effect: E.ignore1('invertebrate'),
        rev: ['invertebrate'], shape: 'woodpecker', pal: 'cardinal'
    }),

    // ---- a few more brown to round out the deck / distributions ----
    card({
        name: 'Killdeer', sci: 'Charadrius vociferus', vp: 2, egg: 2, color: 'brown', ws: 46, beak: 'L',
        cost: { food: { invertebrate: 1 } },
        raw: '[draw_invertebrate]', effect: E.drawFood('invertebrate'),
        rev: ['invertebrate'], shape: 'heron', pal: 'goldfinch'
    }),
    card({
        name: 'Wood Duck', sci: 'Aix sponsa', vp: 4, egg: 3, color: 'brown', ws: 74, beak: 'R',
        cost: { food: { seed: 1, fruit: 1 } },
        raw: '[lay_egg] on this bird', effect: E.layEgg('this', 1),
        rev: ['seed', 'fruit'], shape: 'duck', pal: 'orchid'
    }),
    card({
        name: 'Spotted Towhee', sci: 'Pipilo maculatus', vp: 2, egg: 2, color: 'brown', ws: 28, beak: 'R',
        cost: { food: { invertebrate: 1, seed: 1 } },
        raw: '[draw_any_food]', effect: E.drawFood('any'),
        rev: ['seed', 'invertebrate'], shape: 'finch', pal: 'sunset'
    }),
    card({
        name: 'Sandhill Crane', sci: 'Antigone canadensis', vp: 6, egg: 2, color: 'brown', ws: 200, beak: 'L',
        cost: { food: { seed: 1, invertebrate: 1, fish: 1 } },
        raw: '[draw_bird] with smallest wingspan', effect: E.drawBird({ select: 'smallest_wingspan' }),
        rev: ['seed'], shape: 'flamingo', pal: 'teal'
    }),
    card({
        name: 'Peregrine Falcon', sci: 'Falco peregrinus', vp: 5, egg: 1, color: 'brown', ws: 100, beak: 'R',
        cost: { food: { rodent: 1, invertebrate: 1 } },
        raw: '[hunt_100]', effect: E.hunt(100),
        rev: ['rodent'], shape: 'raptor', pal: 'bluebird'
    }),
    card({
        name: 'Tree Swallow', sci: 'Tachycineta bicolor', vp: 3, egg: 1, color: 'brown', ws: 35, beak: 'L',
        cost: { food: { invertebrate: 1 } },
        raw: '[tuck_any_card] [arrow] [draw_any_food]', effect: E.gated(E.tuck('any'), E.drawFood('any')),
        rev: ['invertebrate'], shape: 'swallow', pal: 'bluebird'
    }),
    card({
        name: 'Purple Martin', sci: 'Progne subis', vp: 4, egg: 1, color: 'brown', ws: 39, beak: 'R',
        cost: { food: { invertebrate: 1 } },
        raw: '[draw_bird] with egg limit 2+', effect: E.drawBird({ egg_limit_min: 2 }),
        rev: ['invertebrate'], shape: 'swallow', pal: 'orchid'
    }),
    card({
        name: 'Ring-billed Gull', sci: 'Larus delawarensis', vp: 2, egg: 2, color: 'brown', ws: 120, beak: 'L',
        cost: { food: { fish: 1, seed: 1 } },
        raw: 'copy rightmost brown power of the player to your left', effect: E.copyBrown('left_rightmost'),
        rev: ['fish', 'seed'], shape: 'gull', pal: 'teal'
    }),
    card({
        name: 'Common Raven', sci: 'Corvus corax', vp: 5, egg: 2, color: 'brown', ws: 117, beak: 'R',
        cost: { food: { invertebrate: 1, rodent: 1 } },
        raw: 'copy a brown power of the player to your right', effect: E.copyBrown('right'),
        rev: ['invertebrate', 'rodent'], shape: 'raptor', pal: 'cardinal'
    }),
    card({
        name: 'Rose-breasted Grosbeak', sci: 'Pheucticus ludovicianus', vp: 3, egg: 1, color: 'brown', ws: 33, beak: 'L',
        cost: { food: { seed: 2 } },
        raw: '[draw_fruit] or [draw_seed]', effect: E.chooseOne(E.drawFood('fruit'), E.drawFood('seed')),
        rev: ['seed', 'fruit'], shape: 'finch', pal: 'cardinal'
    }),
    card({
        name: 'Least Sandpiper', sci: 'Calidris minutilla', vp: 2, egg: 2, color: 'brown', ws: 28, beak: 'L',
        cost: { food: { invertebrate: 1 } },
        raw: '[lay_egg] on another bird', effect: E.layEgg('another', 1),
        rev: ['invertebrate'], shape: 'heron', pal: 'sunset'
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
