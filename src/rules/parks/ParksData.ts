/**
 * ParksData.ts — every printed component of Parks, as plain data.
 *
 * Provenance: seasons, years, canteens and gear are transcribed from the rules
 * spec. 41 parks are transcribed too; the spec's unreadable E.42 is assigned to
 * Big Bend and the 6 parks hidden in the source photos are reconstructed from
 * the deck's own cost formula (see `verified` on the park rows). The solo Event
 * deck was not supplied at all, so `EVENT_CARDS` are designed stand-ins.
 *
 * All of these are one-table edits: fix the row and the engine and art follow.
 */

export type Token = 'FOREST' | 'MOUNTAIN' | 'SUNSHINE' | 'WATER' | 'WILDLIFE';
/** The four symbols printed on Park costs (Wildlife is never printed). */
export type Sym = 'FOREST' | 'MOUNTAIN' | 'SUNSHINE' | 'WATER';
export type Bag = Partial<Record<Token, number>>;

export const TOKENS: Token[] = ['FOREST', 'MOUNTAIN', 'SUNSHINE', 'WATER', 'WILDLIFE'];
export const SYMS: Sym[] = ['FOREST', 'MOUNTAIN', 'SUNSHINE', 'WATER'];
export const TOKEN_NAME: Record<Token, string> = {
    FOREST: 'Forest', MOUNTAIN: 'Mountain', SUNSHINE: 'Sunshine', WATER: 'Water', WILDLIFE: 'Wildlife'
};

export const SUPPLY_START: Record<Token, number> = { FOREST: 15, MOUNTAIN: 15, SUNSHINE: 30, WATER: 30, WILDLIFE: 12 };
export const PHOTOS_START = 28;
export const TOKEN_LIMIT = 12;
export const SEASONS_PER_GAME = 4;
export const MIN_PLAYERS = 1;
export const MAX_PLAYERS = 5;

// ---------------------------------------------------------------------------
// Parks
// ---------------------------------------------------------------------------

export interface ParkCard {
    id: string;
    name: string;
    /** Printed name without its edition, for tight card headers. */
    short: string;
    points: number;
    cost: Partial<Record<Sym, number>>;
    states: string[];
    /** false = stats reconstructed, not read off the physical card. */
    verified: boolean;
    /** Nightfall: the brown square, paid with any tokens. Gear and Season discounts never cut it. */
    any?: number;
    /** Nightfall: the action right of the bolt, taken after the visit. Its icons count toward nothing. */
    instant?: NfAction;
    nightfall?: boolean;
}

/** What a Park costs once discounts apply: printed symbols, plus `ANY` for the brown square. */
export type Need = Partial<Record<Sym | 'ANY', number>>;

const COST_LETTER: Record<string, Sym> = { F: 'FOREST', M: 'MOUNTAIN', S: 'SUNSHINE', W: 'WATER' };

function parseCost(s: string): Partial<Record<Sym, number>> {
    const out: Partial<Record<Sym, number>> = {};
    for (const ch of s) {
        const sym = COST_LETTER[ch];
        out[sym] = (out[sym] || 0) + 1;
    }
    return out;
}

// id | name | short | points | cost (F M S W, one letter per printed icon) | states
const PARK_ROWS = `
congaree|Congaree|Congaree|2|FF|SC
dry_tortugas|Dry Tortugas|Dry Tortugas|2|WWWW|FL
denali|Denali|Denali|4|MMMM|AK
mammoth_cave|Mammoth Cave|Mammoth Cave|2|MM|KY
capitol_reef|Capitol Reef|Capitol Reef|4|FFFSS|UT
north_cascades|North Cascades|North Cascades|4|MMWWWW|WA
saguaro|Saguaro|Saguaro|2|FSS|AZ
shenandoah|Shenandoah|Shenandoah|2|FM|VA
sequoia|Sequoia|Sequoia|4|FFFF|CA
bryce_canyon|Bryce Canyon|Bryce Canyon|4|FMMM|UT
yellowstone|Yellowstone|Yellowstone|5|FFFSSSS|ID·MT·WY
biscayne|Biscayne|Biscayne|3|FFWW|FL
great_smoky_mountains|Great Smoky Mountains|Great Smoky Mtns|4|FFFM|NC·TN
joshua_tree|Joshua Tree|Joshua Tree|4|FFSSSS|CA
kings_canyon|Kings Canyon|Kings Canyon|3|FFM|CA
great_basin|Great Basin|Great Basin|3|FMM|NV
yosemite_night|Yosemite (night)|Yosemite Night|5|MMMSSSS|CA
black_canyon_gunnison|Black Canyon of the Gunnison|Black Canyon|3|MMWW|CO
american_samoa|National Park of American Samoa|American Samoa|4|FFSSWW|AS
mount_rainier|Mount Rainier|Mount Rainier|3|MMM|WA
zion|Zion|Zion|4|FMSSSS|UT
grand_canyon|Grand Canyon|Grand Canyon|4|MMSWWW|AZ
kenai_fjords|Kenai Fjords|Kenai Fjords|4|FFWWWW|AK
olympic|Olympic|Olympic|3|FFF|WA
glacier_bay|Glacier Bay|Glacier Bay|3|FMWW|AK
channel_islands|Channel Islands|Channel Islands|2|MWW|CA
lassen_volcanic|Lassen Volcanic|Lassen Volcanic|4|FFSSSW|CA
carlsbad_caverns|Carlsbad Caverns|Carlsbad Caverns|2|MSW|NM
haleakala|Haleakalā|Haleakalā|4|FMWWWW|HI
mesa_verde|Mesa Verde|Mesa Verde|3|FMSS|CO
badlands|Badlands|Badlands|4|MMSSSS|SD
great_sand_dunes|Great Sand Dunes|Great Sand Dunes|4|MMMSS|CO
arches_summer|Arches (summer)|Arches Summer|2|MSS|UT
guadalupe_mountains|Guadalupe Mountains|Guadalupe Mtns|3|MMSS|TX
theodore_roosevelt|Theodore Roosevelt|Theodore Roosevelt|4|FFMM|ND
acadia|Acadia|Acadia|3|FFSW|ME
yosemite_forest|Yosemite (forest)|Yosemite Forest|4|FFFWW|CA
arches_winter|Arches (winter)|Arches Winter|3|FFSS|UT
gates_arctic|Gates of the Arctic|Gates of the Arctic|5|MMMWWWW|AK
virgin_islands|Virgin Islands|Virgin Islands|5|FFFWWWW|VI
everglades|Everglades|Everglades|4|FFSWWW|FL
`;

// Not legible in the source. Costs follow the rule every transcribed card obeys:
// points = forest + mountain + (sunshine + water) / 2.
const PARK_ROWS_RECONSTRUCTED = `
big_bend|Big Bend|Big Bend|4|MMSSWW|TX
wrangell_st_elias|Wrangell-St. Elias|Wrangell-St. Elias|4|MMMWW|AK
isle_royale|Isle Royale|Isle Royale|2|FWW|MI
rocky_mountain|Rocky Mountain|Rocky Mountain|5|FFMMSW|CO
gateway_arch|Gateway Arch|Gateway Arch|2|FSW|MO
cuyahoga_valley|Cuyahoga Valley|Cuyahoga Valley|3|FSSWW|OH
grand_canyon_rim|Grand Canyon (rim)|Grand Canyon Rim|4|MMSSSW|AZ
`;

function parseParks(rows: string, verified: boolean): ParkCard[] {
    return rows.trim().split('\n').map((row) => {
        const [id, name, short, points, cost, states] = row.trim().split('|');
        return { id, name, short, points: Number(points), cost: parseCost(cost), states: states.split('·'), verified };
    });
}

export const PARK_CARDS: ParkCard[] = [...parseParks(PARK_ROWS, true), ...parseParks(PARK_ROWS_RECONSTRUCTED, false)];

/** A Nightfall Park; `any` is the brown any-token square. */
function nfPark(id: string, name: string, points: number, cost: Bag, any: number, states: string, instant: NfAction): ParkCard {
    return { id, name, short: name, points, cost, ...(any ? { any } : {}), states: states.split('·'), verified: true, nightfall: true, instant };
}

/** The 24 Nightfall Parks, transcribed from photos of the printed cards. Ids get a suffix where a base Park shares the name. */
export const NIGHTFALL_PARK_CARDS: ParkCard[] = [
    nfPark('grand_teton', 'Grand Teton', 2, { FOREST: 1, MOUNTAIN: 1, SUNSHINE: 1 }, 0, 'WY', { kind: 'RESERVE' }),
    nfPark('death_valley', 'Death Valley', 2, { SUNSHINE: 2 }, 2, 'CA·NV', { kind: 'PHOTO', pay: 'MOUNTAIN', times: 1 }),
    nfPark('hawaii_volcanoes', 'Hawaiʻi Volcanoes', 2, { MOUNTAIN: 2, WATER: 1 }, 0, 'HI', { kind: 'GAIN', gain: { SUNSHINE: 2 } }),
    nfPark('lake_clark', 'Lake Clark', 2, { MOUNTAIN: 1, WATER: 1 }, 2, 'AK', { kind: 'RESERVE' }),
    nfPark('katmai', 'Katmai', 2, { FOREST: 1, SUNSHINE: 1 }, 2, 'AK', { kind: 'RESERVE' }),
    nfPark('crater_lake', 'Crater Lake', 2, { FOREST: 1, MOUNTAIN: 1, WATER: 1 }, 0, 'OR', { kind: 'RESERVE' }),
    nfPark('glacier', 'Glacier', 3, { WATER: 2 }, 3, 'MT', { kind: 'CAMERA' }),
    nfPark('white_sands', 'White Sands', 3, { SUNSHINE: 2 }, 3, 'NM', { kind: 'CAMERA' }),
    nfPark('indiana_dunes', 'Indiana Dunes', 2, { WATER: 2 }, 2, 'IN', { kind: 'PHOTO', pay: 'FOREST', times: 1 }),
    nfPark('wind_cave', 'Wind Cave', 4, { SUNSHINE: 2 }, 4, 'SD', { kind: 'PHOTO', pay: 'SUNSHINE', times: 1 }),
    nfPark('big_bend_night', 'Big Bend', 4, { WATER: 2 }, 4, 'TX', { kind: 'PHOTO', pay: 'WATER', times: 1 }),
    nfPark('hot_springs', 'Hot Springs', 2, { FOREST: 2, SUNSHINE: 1 }, 0, 'AR', { kind: 'GAIN', gain: { WATER: 2 } }),
    nfPark('canyonlands_night', 'Canyonlands', 2, { MOUNTAIN: 2, SUNSHINE: 1 }, 0, 'UT', { kind: 'GAIN', gain: { WATER: 2 } }),
    nfPark('petrified_forest', 'Petrified Forest', 2, { FOREST: 2, WATER: 1 }, 0, 'AZ', { kind: 'GAIN', gain: { SUNSHINE: 2 } }),
    nfPark('kobuk_valley', 'Kobuk Valley', 2, { FOREST: 1, WATER: 1 }, 2, 'AK', { kind: 'GAIN', gain: { WILDLIFE: 1 } }),
    nfPark('denali_night', 'Denali', 3, { MOUNTAIN: 1, SUNSHINE: 1 }, 2, 'AK', { kind: 'GAIN', gain: { WILDLIFE: 1 } }),
    nfPark('canyonlands_day', 'Canyonlands', 3, { MOUNTAIN: 1 }, 4, 'UT', { kind: 'GAIN', gain: { WILDLIFE: 1 } }),
    nfPark('rocky_mountain_night', 'Rocky Mountain', 3, { FOREST: 1 }, 4, 'CO', { kind: 'GAIN', gain: { WILDLIFE: 1 } }),
    nfPark('pinnacles', 'Pinnacles', 3, { MOUNTAIN: 1, SUNSHINE: 1 }, 3, 'CA', { kind: 'CAMP' }),
    nfPark('voyageurs', 'Voyageurs', 3, { FOREST: 1, WATER: 1 }, 3, 'MN', { kind: 'CAMP' }),
    nfPark('arches_night', 'Arches', 3, { MOUNTAIN: 1, SUNSHINE: 1 }, 4, 'UT', { kind: 'YEAR_CARD' }),
    nfPark('redwood_grove', 'Redwood', 3, { FOREST: 1, WATER: 1 }, 4, 'CA', { kind: 'YEAR_CARD' }),
    nfPark('zion_night', 'Zion', 3, { MOUNTAIN: 2 }, 3, 'UT', { kind: 'GEAR_CARD' }),
    nfPark('redwood_elk', 'Redwood', 3, { FOREST: 2 }, 3, 'CA', { kind: 'GEAR_CARD' })
];

export const PARK_BY_ID: Record<string, ParkCard> = Object.fromEntries([...PARK_CARDS, ...NIGHTFALL_PARK_CARDS].map(p => [p.id, p]));

// ---------------------------------------------------------------------------
// Trail sites
// ---------------------------------------------------------------------------

export type SiteId = 'FOREST' | 'MOUNTAIN' | 'VALLEY' | 'OCEAN' | 'VISTA' | 'WATERFALL' | 'WILDLIFE' | 'LODGE' | 'LOOKOUT' | 'RIVER'
    // Wildlife expansion
    | 'LAKE' | 'PARKWAY' | 'SUMMIT' | 'CANYON';

export interface SiteDef {
    id: SiteId;
    name: string;
    advanced: boolean;
    /** Tokens the site simply hands over; absent for sites that take a decision. */
    gain?: Bag;
    /** One-line rule text for the reference panel. */
    text: string;
}

export const SITES: Record<SiteId, SiteDef> = {
    FOREST: { id: 'FOREST', name: 'Forest', advanced: false, gain: { FOREST: 1 }, text: 'Gain 1 Forest.' },
    MOUNTAIN: { id: 'MOUNTAIN', name: 'Mountain', advanced: false, gain: { MOUNTAIN: 1 }, text: 'Gain 1 Mountain.' },
    VALLEY: { id: 'VALLEY', name: 'Valley', advanced: false, gain: { SUNSHINE: 2 }, text: 'Gain 2 Sunshine.' },
    OCEAN: { id: 'OCEAN', name: 'Ocean', advanced: false, gain: { WATER: 2 }, text: 'Gain 2 Water.' },
    VISTA: { id: 'VISTA', name: 'Vista', advanced: false, text: 'Draw a Canteen, or pay 2 tokens for a Photo and the Camera (1 if you hold the Camera).' },
    WATERFALL: { id: 'WATERFALL', name: 'Waterfall', advanced: false, gain: { SUNSHINE: 1, WATER: 1 }, text: 'Gain 1 Sunshine and 1 Water. 4–5 players only.' },
    WILDLIFE: { id: 'WILDLIFE', name: 'Wildlife', advanced: true, text: 'Pay 1 token to gain 1 Wildlife.' },
    LODGE: { id: 'LODGE', name: 'Lodge', advanced: true, text: 'Trade 1 or 2 tokens for the same number of other types (no Wildlife).' },
    LOOKOUT: { id: 'LOOKOUT', name: 'Lookout', advanced: true, text: 'Reserve a Park, visit a Park, or buy Gear (no discount).' },
    RIVER: { id: 'RIVER', name: 'River', advanced: true, text: 'Pay 1 Water to copy another Site with a Hiker on it. Not a visit.' },
    LAKE: { id: 'LAKE', name: 'Lake', advanced: true, text: 'Take the reward of one of your filled Canteens again.' },
    PARKWAY: { id: 'PARKWAY', name: 'Parkway', advanced: true, text: 'Everyone else gains 1 Sunshine; you take the action of a Site with no Hiker on it. Not a visit.' },
    SUMMIT: { id: 'SUMMIT', name: 'Summit', advanced: true, text: 'Turn in a Photo to gain a Forest, Mountain, Sunshine or Water.' },
    CANYON: { id: 'CANYON', name: 'Canyon', advanced: true, text: 'Turn in a Wildlife to gain 2 Sunshine and 2 Water.' }
};

export const BASIC_SITES: SiteId[] = ['FOREST', 'MOUNTAIN', 'VALLEY', 'OCEAN', 'VISTA'];
export const ADVANCED_SITES: SiteId[] = ['WILDLIFE', 'LODGE', 'LOOKOUT', 'RIVER'];
/** Wildlife expansion: four more Advanced Sites, shuffled in with the base four. */
export const WL_SITES: SiteId[] = ['LAKE', 'PARKWAY', 'SUMMIT', 'CANYON'];

// ---------------------------------------------------------------------------
// Canteens (15 = 5 effects × 3, plus the Wildlife expansion's 12 = 4 × 3)
// ---------------------------------------------------------------------------

export type CanteenEffect = 'FOREST' | 'MOUNTAIN' | 'SUNSHINE' | 'EXCHANGE' | 'WILD_OR_RESERVE'
    | 'MOUNTAIN_PHOTO' | 'FOREST_PHOTO' | 'SUN_WATER' | 'WATER2';

export interface CanteenCard {
    id: string;
    effect: CanteenEffect;
}

export const CANTEEN_EFFECTS: CanteenEffect[] = ['FOREST', 'MOUNTAIN', 'SUNSHINE', 'EXCHANGE', 'WILD_OR_RESERVE'];
export const WL_CANTEEN_EFFECTS: CanteenEffect[] = ['MOUNTAIN_PHOTO', 'FOREST_PHOTO', 'SUN_WATER', 'WATER2'];
const threeEach = (effects: CanteenEffect[]): CanteenCard[] => effects.reduce<CanteenCard[]>((all, effect) => {
    for (let n = 1; n <= 3; n++) all.push({ id: `canteen_${effect.toLowerCase()}_${n}`, effect });
    return all;
}, []);
export const CANTEEN_CARDS: CanteenCard[] = threeEach(CANTEEN_EFFECTS);
export const WL_CANTEEN_CARDS: CanteenCard[] = threeEach(WL_CANTEEN_EFFECTS);
export const CANTEEN_BY_ID: Record<string, CanteenCard> = Object.fromEntries([...CANTEEN_CARDS, ...WL_CANTEEN_CARDS].map(c => [c.id, c]));

export const CANTEEN_TEXT: Record<CanteenEffect, string> = {
    FOREST: 'Gain 1 Forest',
    MOUNTAIN: 'Gain 1 Mountain',
    SUNSHINE: 'Gain 2 Sunshine',
    EXCHANGE: 'Trade 1 or 2 tokens for the same number of others',
    WILD_OR_RESERVE: 'Pay 1 for Wildlife, or reserve a Park',
    MOUNTAIN_PHOTO: 'Turn in a Mountain for a Photo',
    FOREST_PHOTO: 'Turn in a Forest for a Photo',
    SUN_WATER: 'Gain 1 Sunshine and 1 Water',
    WATER2: 'Gain 2 Water'
};

// ---------------------------------------------------------------------------
// Gear (36 = 13 types)
// ---------------------------------------------------------------------------

export type GearType = 'JOURNAL' | 'TRAIL_MAP' | 'COMPASS' | 'SUNSCREEN' | 'RAIN_GEAR' | 'BINOCULARS'
    | 'WATER_FILTER' | 'SLEEPING_BAG' | 'WATER_BOTTLE' | 'WIDE_ANGLE_LENS' | 'FLASHLIGHT' | 'PARK_PASS' | 'TENT'
    // Wildlife expansion
    | 'PLANNER' | 'MYSTERY_CACHE' | 'UPGRADED_SHUTTER' | 'FIELD_GUIDE' | 'FANNY_PACK' | 'LANTERN' | 'WATER_PAIL' | 'HIKING_POLES' | 'CAMPING_MUG';

/** Wildlife Gear: what spending your Campfire may also do. */
export type CampfireBonus = { kind: 'PHOTO'; pay: Sym } | { kind: 'WILD'; pay: Sym } | { kind: 'FILL' };

export interface GearCard {
    id: string;
    type: GearType;
    name: string;
    cost: number;
    /** Parks cost this much less. */
    discount?: Partial<Record<Sym, number>>;
    /** `to` tokens may be paid in place of the Park's `from` symbols. */
    substitute?: { from: Sym; to: Sym };
    /** On a direct visit to `site`, may gain this instead. */
    replace?: { site: SiteId; gain: Bag };
    /** On a direct visit to `site`, may free-fill a Canteen, buy a Photo, or pay 1 for another Wildlife. */
    onVisit?: { site: SiteId; effect: 'FILL' | 'PHOTO' | 'WILD' };
    /** One-time effect on purchase. */
    instant?: 'CANTEEN' | 'PHOTO' | 'GEAR_TOP';
    gearDiscount?: number;
    parkPass?: boolean;
    tent?: boolean;
    /** Planner: gained after you visit a reserved Park. */
    reservedVisitGain?: Bag;
    /** Upgraded Shutter: a Wildlife you gain may become a Photo. */
    shutter?: boolean;
    /** Field Guide: one Wildlife pays for two of this symbol on Parks. */
    wildPair?: Sym;
    onCampfire?: CampfireBonus;
    wildlife?: boolean;
}

function makeGear(): GearCard[] {
    const out: GearCard[] = [];
    const add = (id: string, copies: number, card: Omit<GearCard, 'id'>) => {
        for (let n = 1; n <= copies; n++) out.push({ id: `${id}_${n}`, ...card });
    };
    add('journal_forest', 3, { type: 'JOURNAL', name: 'Journal', cost: 3, discount: { FOREST: 1 } });
    add('journal_mountain', 3, { type: 'JOURNAL', name: 'Journal', cost: 3, discount: { MOUNTAIN: 1 } });
    add('trailmap_water', 2, { type: 'TRAIL_MAP', name: 'Trail Map', cost: 1, discount: { WATER: 1 } });
    add('trailmap_sunshine', 2, { type: 'TRAIL_MAP', name: 'Trail Map', cost: 1, discount: { SUNSHINE: 1 } });
    add('compass_ww', 1, { type: 'COMPASS', name: 'Compass', cost: 2, discount: { WATER: 2 } });
    add('compass_sw', 1, { type: 'COMPASS', name: 'Compass', cost: 2, discount: { SUNSHINE: 1, WATER: 1 } });
    add('compass_ss', 1, { type: 'COMPASS', name: 'Compass', cost: 2, discount: { SUNSHINE: 2 } });
    add('sunscreen_mountain', 1, { type: 'SUNSCREEN', name: 'Sunscreen', cost: 3, substitute: { from: 'MOUNTAIN', to: 'SUNSHINE' } });
    add('sunscreen_forest', 1, { type: 'SUNSCREEN', name: 'Sunscreen', cost: 3, substitute: { from: 'FOREST', to: 'SUNSHINE' } });
    add('raingear_mountain', 1, { type: 'RAIN_GEAR', name: 'Rain Gear', cost: 3, substitute: { from: 'MOUNTAIN', to: 'WATER' } });
    add('raingear_forest', 1, { type: 'RAIN_GEAR', name: 'Rain Gear', cost: 3, substitute: { from: 'FOREST', to: 'WATER' } });
    const binoculars: SiteId[] = ['MOUNTAIN', 'FOREST', 'VALLEY', 'OCEAN'];
    for (const site of binoculars) {
        add(`binoculars_${site.toLowerCase()}`, 1, { type: 'BINOCULARS', name: 'Binoculars', cost: 1, replace: { site, gain: { WILDLIFE: 1 } } });
    }
    const forestMountain: SiteId[] = ['MOUNTAIN', 'FOREST'];
    for (const site of forestMountain) {
        add(`waterfilter_${site.toLowerCase()}`, 1, { type: 'WATER_FILTER', name: 'Water Filter', cost: 2, replace: { site, gain: { WATER: 3 } } });
        add(`sleepingbag_${site.toLowerCase()}`, 1, { type: 'SLEEPING_BAG', name: 'Sleeping Bag', cost: 2, replace: { site, gain: { SUNSHINE: 3 } } });
    }
    const fourSites: SiteId[] = ['VALLEY', 'MOUNTAIN', 'OCEAN', 'FOREST'];
    for (const site of fourSites) {
        add(`waterbottle_${site.toLowerCase()}`, 1, { type: 'WATER_BOTTLE', name: 'Water Bottle', cost: 2, onVisit: { site, effect: 'FILL' }, instant: 'CANTEEN' });
        add(`lens_${site.toLowerCase()}`, 1, { type: 'WIDE_ANGLE_LENS', name: 'Wide Angle Lens', cost: 2, onVisit: { site, effect: 'PHOTO' }, instant: 'PHOTO' });
    }
    add('flashlight', 1, { type: 'FLASHLIGHT', name: 'Flashlight', cost: 1, gearDiscount: 1 });
    add('parkpass', 1, { type: 'PARK_PASS', name: 'Park Pass', cost: 2, parkPass: true });
    add('tent', 1, { type: 'TENT', name: 'Tent', cost: 3, tent: true });
    return out;
}

export const GEAR_CARDS: GearCard[] = makeGear();

/** The Wildlife expansion's 16 Gear cards, transcribed from photos of the printed cards. */
function makeWildlifeGear(): GearCard[] {
    const out: GearCard[] = [];
    const add = (id: string, copies: number, card: Omit<GearCard, 'id' | 'wildlife'>) => {
        for (let n = 1; n <= copies; n++) out.push({ id: `wl_${id}_${n}`, ...card, wildlife: true });
    };
    add('planner', 2, { type: 'PLANNER', name: 'Planner', cost: 2, reservedVisitGain: { WILDLIFE: 1 } });
    add('mystery_cache', 1, { type: 'MYSTERY_CACHE', name: 'Mystery Cache', cost: 1, instant: 'GEAR_TOP' });
    add('upgraded_shutter', 1, { type: 'UPGRADED_SHUTTER', name: 'Upgraded Shutter', cost: 1, shutter: true });
    const guides: Sym[] = ['WATER', 'SUNSHINE', 'FOREST', 'MOUNTAIN'];
    for (const sym of guides) add(`field_guide_${sym.toLowerCase()}`, 1, { type: 'FIELD_GUIDE', name: 'Field Guide', cost: 2, wildPair: sym });
    const packs: Sym[] = ['SUNSHINE', 'WATER'];
    for (const sym of packs) add(`fanny_pack_${sym.toLowerCase()}`, 1, { type: 'FANNY_PACK', name: 'Fanny Pack', cost: 2, onCampfire: { kind: 'PHOTO', pay: sym } });
    const lanterns: Sym[] = ['MOUNTAIN', 'FOREST'];
    for (const sym of lanterns) add(`lantern_${sym.toLowerCase()}`, 1, { type: 'LANTERN', name: 'Lantern', cost: 1, onCampfire: { kind: 'WILD', pay: sym } });
    add('water_pail', 1, { type: 'WATER_PAIL', name: 'Water Pail', cost: 2, onCampfire: { kind: 'FILL' } });
    add('hiking_poles', 1, { type: 'HIKING_POLES', name: 'Hiking Poles', cost: 3, onVisit: { site: 'WILDLIFE', effect: 'WILD' } });
    add('camping_mug', 2, { type: 'CAMPING_MUG', name: 'Camping Mug', cost: 2, onVisit: { site: 'WILDLIFE', effect: 'FILL' } });
    return out;
}

export const WL_GEAR_CARDS: GearCard[] = makeWildlifeGear();
export const GEAR_BY_ID: Record<string, GearCard> = Object.fromEntries([...GEAR_CARDS, ...WL_GEAR_CARDS].map(g => [g.id, g]));

/** Plain-language gear ability, for the card detail sheet and the rules tab. */
export function gearText(g: GearCard): string {
    const syms = (bag: Bag) => TOKENS.filter(t => bag[t]).map(t => `${bag[t]} ${TOKEN_NAME[t]}`).join(' + ');
    if (g.discount) return `Parks cost ${syms(g.discount)} less to visit.`;
    if (g.substitute) return `${TOKEN_NAME[g.substitute.to]} can pay for ${TOKEN_NAME[g.substitute.from]} on Parks.`;
    if (g.replace) return `At the ${SITES[g.replace.site].name}, you may gain ${syms(g.replace.gain)} instead.`;
    if (g.onVisit) {
        // "the Wildlife" alone reads as the token
        const at = `when you visit the ${SITES[g.onVisit.site].name}${g.onVisit.site === 'WILDLIFE' ? ' Site' : ''}`;
        if (g.onVisit.effect === 'WILD') return `You may pay 1 token for a Wildlife a second time ${at}.`;
        if (g.onVisit.effect === 'FILL') return `Fill a Canteen for free ${at}.${g.instant === 'CANTEEN' ? ' On purchase: draw a Canteen.' : ''}`;
        return `Pay 2 tokens for a Photo ${at}. On purchase: pay 2 for a Photo.`;
    }
    if (g.gearDiscount) return 'Gear costs 1 less Sunshine to buy.';
    if (g.parkPass) return 'When you visit a Park, you may visit another.';
    if (g.reservedVisitGain) return `Gain ${syms(g.reservedVisitGain)} after you visit a reserved Park.`;
    if (g.instant === 'GEAR_TOP') return 'On purchase: take the top card of the Gear deck.';
    if (g.shutter) return 'When you gain a Wildlife, you may take a Photo instead.';
    if (g.wildPair) return `One Wildlife can pay for 2 ${TOKEN_NAME[g.wildPair]} on Parks.`;
    if (g.onCampfire) {
        const c = g.onCampfire;
        const what = c.kind === 'FILL' ? 'fill a Canteen for free' : `turn in a ${TOKEN_NAME[c.pay]} for ${c.kind === 'PHOTO' ? 'a Photo' : 'a Wildlife'}`;
        return `When you spend your Campfire, you may ${what}.`;
    }
    return 'Spend your Campfire to have a Hiker take their current Site again.';
}

// ---------------------------------------------------------------------------
// Seasons (10)
// ---------------------------------------------------------------------------

export type SeasonEffect =
    | { kind: 'PARK_BONUS'; token: Sym }
    | { kind: 'ON_GAIN'; when: Sym; bonus: Sym }
    | { kind: 'ON_CANTEEN'; bonus: Sym }
    | { kind: 'PARK_DISCOUNT'; token: Sym }
    | { kind: 'GEAR_DISCOUNT' }
    // Wildlife expansion
    /** A token on each Trail End area, for the first Hiker there. */
    | { kind: 'END_BONUS'; token: Sym }
    /** Visit the Park deck's top card, unseen, for a fixed price. */
    | { kind: 'BLIND_VISIT'; cost: Partial<Record<Sym, number>> }
    /** Every Gear costs this much; the deck's top card can be bought too. */
    | { kind: 'GEAR_FLAT'; cost: number }
    /** Spending your Campfire at your own other Hiker's Site: pay 1 for a Photo. */
    | { kind: 'CAMPFIRE_SELF_PHOTO' }
    /** A token on each face-up Gear, for whoever takes it. */
    | { kind: 'GEAR_BONUS'; token: Sym }
    | { kind: 'ON_FILL'; bonus: Sym }
    | { kind: 'ON_RESERVE'; bonus: Sym }
    /** Reserved Parks cost these less. */
    | { kind: 'RESERVED_DISCOUNT'; tokens: Sym[] }
    /** Spending a Campfire gives everyone at that Site a token. */
    | { kind: 'CAMPFIRE_SHARE'; bonus: Sym }
    /** Buying Gear: pay 1 token for a Wildlife. */
    | { kind: 'ON_BUY_WILD' };

export interface SeasonCard {
    id: string;
    name: string;
    text: string;
    effect: SeasonEffect;
    weather: Sym[];
}

export const SEASON_CARDS: SeasonCard[] = [
    { id: 'splendor', name: 'Season of Splendor', text: 'Add Sunshine on the three current Parks', effect: { kind: 'PARK_BONUS', token: 'SUNSHINE' }, weather: ['WATER', 'SUNSHINE'] },
    { id: 'growth', name: 'Season of Growth', text: 'Gain Sunshine if you gain any Forest on a turn', effect: { kind: 'ON_GAIN', when: 'FOREST', bonus: 'SUNSHINE' }, weather: ['SUNSHINE', 'SUNSHINE', 'WATER'] },
    { id: 'rain', name: 'Season of Rain', text: 'Add Water on the three current Parks', effect: { kind: 'PARK_BONUS', token: 'WATER' }, weather: ['SUNSHINE', 'WATER'] },
    { id: 'reefs', name: 'Season of Reefs', text: 'Gain Water if you gain any Forest on a turn', effect: { kind: 'ON_GAIN', when: 'FOREST', bonus: 'WATER' }, weather: ['WATER', 'WATER', 'SUNSHINE'] },
    { id: 'waves', name: 'Season of Waves', text: 'Gain Water when you gain a Canteen', effect: { kind: 'ON_CANTEEN', bonus: 'WATER' }, weather: ['SUNSHINE', 'WATER'] },
    { id: 'flowers', name: 'Season of Flowers', text: 'Parks cost one less Water to visit', effect: { kind: 'PARK_DISCOUNT', token: 'WATER' }, weather: ['WATER', 'SUNSHINE', 'WATER'] },
    { id: 'starlight', name: 'Season of Starlight', text: 'Parks cost one less Sunshine to visit', effect: { kind: 'PARK_DISCOUNT', token: 'SUNSHINE' }, weather: ['SUNSHINE', 'WATER', 'SUNSHINE'] },
    { id: 'stone', name: 'Season of Stone', text: 'Gain Sunshine if you gain any Mountain on a turn', effect: { kind: 'ON_GAIN', when: 'MOUNTAIN', bonus: 'SUNSHINE' }, weather: ['WATER', 'SUNSHINE', 'SUNSHINE'] },
    { id: 'wind', name: 'Season of Wind', text: 'Gear costs one less Sunshine to buy', effect: { kind: 'GEAR_DISCOUNT' }, weather: ['WATER', 'SUNSHINE'] },
    { id: 'snow', name: 'Season of Snow', text: 'Gain Water if you gain any Mountain on a turn', effect: { kind: 'ON_GAIN', when: 'MOUNTAIN', bonus: 'WATER' }, weather: ['SUNSHINE', 'WATER', 'WATER'] }
];
/** The Wildlife expansion's 10 Seasons, transcribed from photos of the printed cards. Weather reads left to right. */
export const WL_SEASON_CARDS: SeasonCard[] = [
    { id: 'breeze', name: 'Season of Breeze', text: 'A Forest waits on each Trail End area; the first Hiker there takes it', effect: { kind: 'END_BONUS', token: 'FOREST' }, weather: ['SUNSHINE', 'SUNSHINE', 'WATER'] },
    { id: 'chance', name: 'Season of Chance', text: 'You may visit the top card of the Park deck for a Forest, Mountain, Sunshine and Water', effect: { kind: 'BLIND_VISIT', cost: { FOREST: 1, MOUNTAIN: 1, SUNSHINE: 1, WATER: 1 } }, weather: ['SUNSHINE', 'WATER', 'WATER'] },
    { id: 'clouds', name: 'Season of Clouds', text: 'Every Gear costs only 1 Sunshine, and you may buy the top card of the deck', effect: { kind: 'GEAR_FLAT', cost: 1 }, weather: ['SUNSHINE', 'WATER', 'SUNSHINE'] },
    { id: 'connecting', name: 'Season of Connecting', text: 'Spend your Campfire at your other Hiker’s Site and you may pay 1 token for a Photo', effect: { kind: 'CAMPFIRE_SELF_PHOTO' }, weather: ['WATER', 'SUNSHINE', 'WATER'] },
    { id: 'heights', name: 'Season of Heights', text: 'A Mountain on each face-up Gear, for whoever takes it', effect: { kind: 'GEAR_BONUS', token: 'MOUNTAIN' }, weather: ['WATER', 'SUNSHINE'] },
    { id: 'mists', name: 'Season of Mists', text: 'Gain Sunshine whenever you fill a Canteen', effect: { kind: 'ON_FILL', bonus: 'SUNSHINE' }, weather: ['WATER', 'SUNSHINE', 'SUNSHINE'] },
    { id: 'rain_checks', name: 'Season of Rain Checks', text: 'Gain Water when you reserve a Park', effect: { kind: 'ON_RESERVE', bonus: 'WATER' }, weather: ['WATER', 'SUNSHINE'] },
    { id: 'rain_or_shine', name: 'Season of Rain or Shine', text: 'Reserved Parks cost one less Sunshine and one less Water to visit', effect: { kind: 'RESERVED_DISCOUNT', tokens: ['SUNSHINE', 'WATER'] }, weather: ['SUNSHINE', 'WATER'] },
    { id: 'sunshine', name: 'Season of Sunshine', text: 'When you spend your Campfire, everyone at that Site gains Sunshine', effect: { kind: 'CAMPFIRE_SHARE', bonus: 'SUNSHINE' }, weather: ['WATER', 'WATER', 'SUNSHINE'] },
    { id: 'wonder', name: 'Season of Wonder', text: 'When you buy Gear you may pay 1 token for a Wildlife', effect: { kind: 'ON_BUY_WILD' }, weather: ['SUNSHINE', 'WATER'] }
];
export const SEASON_BY_ID: Record<string, SeasonCard> = Object.fromEntries([...SEASON_CARDS, ...WL_SEASON_CARDS].map(s => [s.id, s]));

// ---------------------------------------------------------------------------
// Years (12)
// ---------------------------------------------------------------------------

export type YearGoal =
    | { kind: 'SYMBOLS_AND_PHOTOS'; symbol: Sym }
    | { kind: 'SYMBOLS_ANY_ONE_TYPE' }
    | { kind: 'PARKS_WITH_SYMBOL'; symbol: Sym }
    | { kind: 'PARKS_IN_POINT_RANGE'; min: number; max: number }
    | { kind: 'GEAR_COST_TOTAL' }
    // Nightfall
    | { kind: 'SYMBOL_ICONS'; symbol: Sym }
    | { kind: 'POINT_SETS' }
    | { kind: 'TOKENS_HELD' }
    | { kind: 'PHOTOS' }
    | { kind: 'WILDLIFE_HELD' }
    | { kind: 'SYMBOL_SETS' }
    | { kind: 'INSTANT_PARKS' };

export interface YearTier { threshold: number; photos?: number; points: number; }

export interface YearCard {
    id: string;
    name: string;
    text: string;
    goal: YearGoal;
    /** Base game: the highest tier met scores. Empty on Nightfall cards. */
    tiers: YearTier[];
    /** Nightfall: `points` for every `per` of the goal, without limit. */
    rate?: { per: number; points: number };
    /** Copies of one Nightfall card share this; a player scores each kind once. */
    kind?: string;
}

const photoTiers: YearTier[] = [{ threshold: 6, photos: 3, points: 2 }, { threshold: 10, photos: 5, points: 3 }];
const tiers = (lo: number, hi: number): YearTier[] => [{ threshold: lo, points: 2 }, { threshold: hi, points: 3 }];

export const YEAR_CARDS: YearCard[] = [
    { id: 'peaks', name: 'Year of Peaks', text: 'Mountain icons on visited Parks, plus Photos', goal: { kind: 'SYMBOLS_AND_PHOTOS', symbol: 'MOUNTAIN' }, tiers: photoTiers },
    { id: 'woods', name: 'Year of Woods', text: 'Forest icons on visited Parks, plus Photos', goal: { kind: 'SYMBOLS_AND_PHOTOS', symbol: 'FOREST' }, tiers: photoTiers },
    { id: 'surf', name: 'Year of Surf', text: 'Water icons on visited Parks, plus Photos', goal: { kind: 'SYMBOLS_AND_PHOTOS', symbol: 'WATER' }, tiers: photoTiers },
    { id: 'sun', name: 'Year of Sun', text: 'Sunshine icons on visited Parks, plus Photos', goal: { kind: 'SYMBOLS_AND_PHOTOS', symbol: 'SUNSHINE' }, tiers: photoTiers },
    { id: 'plenty', name: 'Year of Plenty', text: 'Icons of any one type on visited Parks', goal: { kind: 'SYMBOLS_ANY_ONE_TYPE' }, tiers: tiers(12, 18) },
    { id: 'leaves', name: 'Year of Leaves', text: 'Visited Parks with a Forest icon', goal: { kind: 'PARKS_WITH_SYMBOL', symbol: 'FOREST' }, tiers: tiers(6, 8) },
    { id: 'heights', name: 'Year of Heights', text: 'Visited Parks with a Mountain icon', goal: { kind: 'PARKS_WITH_SYMBOL', symbol: 'MOUNTAIN' }, tiers: tiers(6, 8) },
    { id: 'tides', name: 'Year of Tides', text: 'Visited Parks with a Water icon', goal: { kind: 'PARKS_WITH_SYMBOL', symbol: 'WATER' }, tiers: tiers(5, 7) },
    { id: 'light', name: 'Year of Light', text: 'Visited Parks with a Sunshine icon', goal: { kind: 'PARKS_WITH_SYMBOL', symbol: 'SUNSHINE' }, tiers: tiers(5, 7) },
    { id: 'travel', name: 'Year of Travel', text: 'Visited Parks worth 2–3 points', goal: { kind: 'PARKS_IN_POINT_RANGE', min: 2, max: 3 }, tiers: tiers(6, 8) },
    { id: 'ascent', name: 'Year of Ascent', text: 'Visited Parks worth 4–5 points', goal: { kind: 'PARKS_IN_POINT_RANGE', min: 4, max: 5 }, tiers: tiers(3, 5) },
    { id: 'gear', name: 'Year of Gear', text: 'Total Sunshine cost of your Gear', goal: { kind: 'GEAR_COST_TOTAL' }, tiers: tiers(7, 10) }
];
/** Nightfall's 26 Year cards: 15 kinds, the dots on each card saying how many copies. */
const NIGHTFALL_YEAR_KINDS: { kind: string; name: string; copies: number; per: number; points: number; goal: YearGoal; text: string }[] = [
    { kind: 'canoer', name: 'Canoer', copies: 1, per: 3, points: 1, goal: { kind: 'SYMBOL_ICONS', symbol: 'WATER' }, text: '1 point per 3 Water on visited Parks' },
    { kind: 'climber', name: 'Climber', copies: 1, per: 2, points: 1, goal: { kind: 'SYMBOL_ICONS', symbol: 'MOUNTAIN' }, text: '1 point per 2 Mountains on visited Parks' },
    { kind: 'collector', name: 'Collector', copies: 2, per: 1, points: 2, goal: { kind: 'POINT_SETS' }, text: '2 points per set of 2, 3 and 4 point Parks visited' },
    { kind: 'conserver', name: 'Conserver', copies: 1, per: 2, points: 1, goal: { kind: 'SYMBOL_ICONS', symbol: 'FOREST' }, text: '1 point per 2 Forests on visited Parks' },
    { kind: 'forester', name: 'Forester', copies: 2, per: 3, points: 2, goal: { kind: 'PARKS_WITH_SYMBOL', symbol: 'FOREST' }, text: '2 points per 3 visited Parks with a Forest' },
    { kind: 'gatherer', name: 'Gatherer', copies: 2, per: 3, points: 2, goal: { kind: 'TOKENS_HELD' }, text: '2 points per 3 tokens held at the end' },
    { kind: 'kayaker', name: 'Kayaker', copies: 2, per: 3, points: 2, goal: { kind: 'PARKS_WITH_SYMBOL', symbol: 'WATER' }, text: '2 points per 3 visited Parks with a Water' },
    { kind: 'mountaineer', name: 'Mountaineer', copies: 2, per: 3, points: 2, goal: { kind: 'PARKS_WITH_SYMBOL', symbol: 'MOUNTAIN' }, text: '2 points per 3 visited Parks with a Mountain' },
    { kind: 'photographer', name: 'Photographer', copies: 2, per: 4, points: 1, goal: { kind: 'PHOTOS' }, text: '1 point per 4 Photos' },
    { kind: 'planner', name: 'Planner', copies: 2, per: 2, points: 1, goal: { kind: 'GEAR_COST_TOTAL' }, text: '1 point per 2 Sunshine of Gear cost' },
    { kind: 'preserver', name: 'Preserver', copies: 2, per: 1, points: 1, goal: { kind: 'WILDLIFE_HELD' }, text: '1 point per Wildlife held at the end' },
    { kind: 'stargazer', name: 'Stargazer', copies: 1, per: 3, points: 1, goal: { kind: 'SYMBOL_ICONS', symbol: 'SUNSHINE' }, text: '1 point per 3 Sunshine on visited Parks' },
    { kind: 'traveler', name: 'Traveler', copies: 2, per: 1, points: 1, goal: { kind: 'SYMBOL_SETS' }, text: '1 point per set of Forest, Mountain, Sunshine and Water on visited Parks' },
    { kind: 'trekker', name: 'Trekker', copies: 2, per: 3, points: 2, goal: { kind: 'PARKS_WITH_SYMBOL', symbol: 'SUNSHINE' }, text: '2 points per 3 visited Parks with a Sunshine' },
    { kind: 'voyager', name: 'Voyager', copies: 2, per: 1, points: 1, goal: { kind: 'INSTANT_PARKS' }, text: '1 point per visited Park with an Instant Action' }
];

export const NIGHTFALL_YEAR_CARDS: YearCard[] = NIGHTFALL_YEAR_KINDS.reduce<YearCard[]>((all, k) => {
    for (let n = 1; n <= k.copies; n++) {
        all.push({ id: `nf_${k.kind}_${n}`, name: k.name, text: k.text, goal: k.goal, tiers: [], rate: { per: k.per, points: k.points }, kind: k.kind });
    }
    return all;
}, []);

export const YEAR_BY_ID: Record<string, YearCard> = Object.fromEntries([...YEAR_CARDS, ...NIGHTFALL_YEAR_CARDS].map(y => [y.id, y]));

/** The goal in full, for the expanded card. The card face only has room for icons. */
export function yearDescription(y: YearCard): string {
    if (y.rate) {
        const pts = `${y.rate.points} point${y.rate.points === 1 ? '' : 's'}`;
        const per = y.rate.per;
        const g = y.goal;
        const tail = ' Copies of the same card score only once.';
        switch (g.kind) {
            case 'SYMBOL_ICONS': return `${pts} for every ${per} ${TOKEN_NAME[g.symbol]} icons across your visited Parks. Icons right of a bolt don’t count.${tail}`;
            case 'PARKS_WITH_SYMBOL': return `${pts} for every ${per} visited Parks with at least one ${TOKEN_NAME[g.symbol]} icon.${tail}`;
            case 'POINT_SETS': return `${pts} for every set of a 2, a 3 and a 4 point Park you visited.${tail}`;
            case 'TOKENS_HELD': return `${pts} for every ${per} tokens you hold at the end of the game.${tail}`;
            case 'PHOTOS': return `${pts} for every ${per} Photos you have taken.${tail}`;
            case 'GEAR_COST_TOTAL': return `${pts} for every ${per} Sunshine across the printed cost of your Gear.${tail}`;
            case 'WILDLIFE_HELD': return `${pts} for each Wildlife you hold at the end of the game.${tail}`;
            case 'SYMBOL_SETS': return `${pts} for each set of a Forest, Mountain, Sunshine and Water icon across your visited Parks.${tail}`;
            case 'INSTANT_PARKS': return `${pts} for each visited Park with an Instant Action.${tail}`;
            default: return y.text;
        }
    }
    const g = y.goal;
    switch (g.kind) {
        case 'SYMBOLS_AND_PHOTOS':
            return `Count the ${TOKEN_NAME[g.symbol]} icons on the Parks you have visited, and your Photos. A tier scores only when both numbers reach it.`;
        case 'SYMBOLS_ANY_ONE_TYPE':
            return 'Count the icons of each type on the Parks you have visited. Only your largest single type counts.';
        case 'PARKS_WITH_SYMBOL':
            return `Count the Parks you have visited with at least one ${TOKEN_NAME[g.symbol]} icon. Each Park counts once, however many it shows.`;
        case 'PARKS_IN_POINT_RANGE':
            return `Count the Parks you have visited worth ${g.min} to ${g.max} points.`;
        case 'GEAR_COST_TOTAL':
            return 'Add up the printed Sunshine cost of all your Gear. Discounts do not lower it.';
        default:
            return y.text;
    }
}

function yearUnit(y: YearCard, n: number): string {
    const g = y.goal;
    const s = n === 1 ? '' : 's';
    switch (g.kind) {
        case 'SYMBOLS_AND_PHOTOS':
        case 'SYMBOL_ICONS': return `${TOKEN_NAME[g.symbol]} icon${s}`;
        case 'SYMBOLS_ANY_ONE_TYPE': return `icon${s} of one type`;
        case 'PARKS_WITH_SYMBOL': return `Park${s} with a ${TOKEN_NAME[g.symbol]} icon`;
        case 'PARKS_IN_POINT_RANGE': return `Park${s} worth ${g.min} to ${g.max}`;
        case 'GEAR_COST_TOTAL': return 'Sunshine of Gear';
        case 'POINT_SETS': return `set${s} of 2, 3 and 4 point Parks`;
        case 'TOKENS_HELD': return `token${s}`;
        case 'PHOTOS': return `Photo${s}`;
        case 'WILDLIFE_HELD': return 'Wildlife';
        case 'SYMBOL_SETS': return `set${s} of all four icons`;
        case 'INSTANT_PARKS': return `Park${s} with an Instant Action`;
    }
}

/** Nightfall: what a Year card scores at this progress. */
export function yearRatePoints(y: YearCard, progress: number): number {
    return y.rate ? Math.floor(progress / y.rate.per) * y.rate.points : 0;
}

/** What it takes to reach the next tier, or null at the top. */
export function yearNextStep(y: YearCard, progress: number, photos: number): string | null {
    if (y.rate) {
        const more = y.rate.per - (progress % y.rate.per);
        return `${more} more ${yearUnit(y, more)} for ${yearRatePoints(y, progress) + y.rate.points} points`;
    }
    const met = (t: YearTier) => progress >= t.threshold && photos >= (t.photos || 0);
    const next = y.tiers.find(t => !met(t));
    if (!next) return null;
    const parts: string[] = [];
    const more = next.threshold - progress;
    if (more > 0) parts.push(`${more} more ${yearUnit(y, more)}`);
    const shots = (next.photos || 0) - photos;
    if (shots > 0) parts.push(`${shots} more Photo${shots === 1 ? '' : 's'}`);
    return `${parts.join(' and ')} to reach ${next.points} points`;
}

// ---------------------------------------------------------------------------
// Nightfall: Campsites and Instant Actions
// ---------------------------------------------------------------------------

/** One action a Campsite or a Nightfall Park offers. Wildlife may stand in for any token turned in. */
export type NfAction =
    /** Turn in one `pay` to gain `gain`, up to `times` times. */
    | { kind: 'TRADE'; pay: Sym; gain: Bag; times: number }
    /** Turn in one `pay` for a Photo (any token with the Camera), up to `times` times. */
    | { kind: 'PHOTO'; pay: Sym; times: number; /** Gear and Canteens: the printed token only, even with the Camera. */ exact?: boolean }
    | { kind: 'GAIN'; gain: Bag }
    | { kind: 'RESERVE' }
    | { kind: 'CANTEEN_WATER' }
    /** Pour every filled Canteen's Water into your supply (not gained), then gain a Water. */
    | { kind: 'DRAIN_CANTEENS' }
    /** Return a Gear or Year card, then take a top card or any face-up Gear. */
    | { kind: 'SWAP_CARD' }
    /** Pay 2 Sunshine: deal 3 fresh Gear, then take one of them or the deck's top card free. */
    | { kind: 'GEAR_REFRESH' }
    | { kind: 'RESERVE_RELIGHT'; gain: Sym }
    /** The Campsite board: pay 3 Sunshine, draw 2 Year cards, return 1 from your hand. */
    | { kind: 'YEAR_DRAW' }
    // Park-only Instant Actions
    | { kind: 'CAMERA' }
    /** Draw the top Year card and keep it. */
    | { kind: 'YEAR_CARD' }
    /** Take any face-up Gear or the deck's top card free. */
    | { kind: 'GEAR_CARD' }
    /** Pitch a Tent at any open Campsite and take its action. */
    | { kind: 'CAMP' };

export interface CampsiteSide { seasons: number[]; action: NfAction; }

export interface CampsiteTile {
    id: string;
    name: string;
    /** Only in 5 player games, and always in them. */
    fivePlayer?: boolean;
    sides: [CampsiteSide, CampsiteSide];
}

export const CAMPSITE_TILES: CampsiteTile[] = [
    { id: 'harvest', name: 'Harvest', sides: [{ seasons: [1, 3], action: { kind: 'TRADE', pay: 'MOUNTAIN', gain: { SUNSHINE: 5 }, times: 1 } }, { seasons: [2, 4], action: { kind: 'TRADE', pay: 'FOREST', gain: { WATER: 5 }, times: 1 } }] },
    { id: 'shutter', name: 'Photo Spot', sides: [{ seasons: [1, 3], action: { kind: 'PHOTO', pay: 'FOREST', times: 2 } }, { seasons: [2, 4], action: { kind: 'PHOTO', pay: 'MOUNTAIN', times: 2 } }] },
    { id: 'tracks', name: 'Animal Tracks', sides: [{ seasons: [1, 3], action: { kind: 'TRADE', pay: 'WATER', gain: { WILDLIFE: 1 }, times: 3 } }, { seasons: [2, 4], action: { kind: 'TRADE', pay: 'SUNSHINE', gain: { WILDLIFE: 1 }, times: 3 } }] },
    { id: 'spring', name: 'Spring', sides: [{ seasons: [1, 2], action: { kind: 'CANTEEN_WATER' } }, { seasons: [3, 4], action: { kind: 'DRAIN_CANTEENS' } }] },
    { id: 'outfitter', name: 'Outfitter', sides: [{ seasons: [1, 4], action: { kind: 'SWAP_CARD' } }, { seasons: [2, 3], action: { kind: 'GEAR_REFRESH' } }] },
    { id: 'ranger_station', name: 'Ranger Station', fivePlayer: true, sides: [{ seasons: [1, 3], action: { kind: 'RESERVE_RELIGHT', gain: 'WATER' } }, { seasons: [2, 4], action: { kind: 'RESERVE_RELIGHT', gain: 'SUNSHINE' } }] }
];
export const CAMPSITE_BY_ID: Record<string, CampsiteTile> = Object.fromEntries(CAMPSITE_TILES.map(t => [t.id, t]));
/** Nightfall's parts, each of which the host can add to the base game on its own. */
export type NfModule = 'campsites' | 'parks' | 'years' | 'wildlife';
export type NfModules = Record<NfModule, boolean>;
export const NF_MODULES: { id: NfModule; name: string; text: string }[] = [
    { id: 'campsites', name: 'Campsites', text: 'Tents on the Trail, Campsite tiles and the Campsite board.' },
    { id: 'parks', name: 'Nightfall Parks', text: '24 more Parks, with Instant Actions.' },
    { id: 'years', name: 'Nightfall Year cards', text: 'Replace the base Year deck; they score per step.' },
    { id: 'wildlife', name: 'Starting Wildlife', text: 'Everyone starts with a Wildlife, and 4 more join the supply.' }
];
export const NF_ALL: NfModules = { campsites: true, parks: true, years: true, wildlife: true };
export const NF_NONE: NfModules = { campsites: false, parks: false, years: false, wildlife: false };
/** `true` is the whole expansion, `false`/absent none of it; anything else picks parts. */
export function nfModulesOf(v: boolean | Partial<NfModules> | null | undefined): NfModules {
    if (v === true) return { ...NF_ALL };
    if (!v) return { ...NF_NONE };
    return { campsites: !!v.campsites, parks: !!v.parks, years: !!v.years, wildlife: !!v.wildlife };
}
export const nfAny = (m: NfModules): boolean => NF_MODULES.some(x => m[x.id]);
export const nfFull = (m: NfModules): boolean => NF_MODULES.every(x => m[x.id]);

/** The Wildlife expansion's parts, each added to the decks on its own. */
export type WlModule = 'gear' | 'seasons' | 'sites' | 'canteens';
export type WlModules = Record<WlModule, boolean>;
export const WL_MODULES: { id: WlModule; name: string; text: string }[] = [
    { id: 'gear', name: 'Wildlife Gear', text: '16 more Gear cards: Field Guides, Lanterns, Fanny Packs and more.' },
    { id: 'seasons', name: 'Wildlife Seasons', text: '10 more Seasons shuffled into the Season deck.' },
    { id: 'sites', name: 'Wildlife Sites', text: 'Lake, Parkway, Summit and Canyon join the Advanced Sites.' },
    { id: 'canteens', name: 'Wildlife Canteens', text: '12 more Canteens.' }
];
/** `true` is the whole expansion, `false`/absent none of it; anything else picks parts. */
export function wlModulesOf(v: boolean | Partial<WlModules> | null | undefined): WlModules {
    if (v === true) return { gear: true, seasons: true, sites: true, canteens: true };
    if (!v) return { gear: false, seasons: false, sites: false, canteens: false };
    return { gear: !!v.gear, seasons: !!v.seasons, sites: !!v.sites, canteens: !!v.canteens };
}
export const wlAny = (m: WlModules): boolean => WL_MODULES.some(x => m[x.id]);
export const wlFull = (m: WlModules): boolean => WL_MODULES.every(x => m[x.id]);

export const CAMPSITE_BOARD_ACTION: NfAction = { kind: 'YEAR_DRAW' };
export const YEAR_DRAW_COST = 3;
export const GEAR_REFRESH_COST = 2;
export const NIGHTFALL_WILDLIFE = 4;

export function campsideFor(tile: CampsiteTile, season: number): CampsiteSide {
    return tile.sides.find(s => s.seasons.includes(season)) || tile.sides[0];
}

/** Plain-language action text, for sheets, the detail popup and the rules tab. */
export function nfActionText(a: NfAction): string {
    const syms = (bag: Bag) => TOKENS.filter(t => bag[t]).map(t => `${bag[t]} ${TOKEN_NAME[t]}`).join(' and ');
    const times = (n: number) => n > 1 ? ` Up to ${n} times.` : '';
    switch (a.kind) {
        case 'TRADE': return `Turn in a ${TOKEN_NAME[a.pay]} to gain ${syms(a.gain)}.${times(a.times)}`;
        case 'PHOTO': return `Turn in a ${TOKEN_NAME[a.pay]} to take a Photo (any token with the Camera).${times(a.times)}`;
        case 'GAIN': return `Gain ${syms(a.gain)}.`;
        case 'RESERVE': return 'Reserve a Park.';
        case 'CANTEEN_WATER': return 'Gain a Canteen and a Water.';
        case 'DRAIN_CANTEENS': return 'Move the Water from your filled Canteens to your supply (it doesn’t count as gained), then gain a Water.';
        case 'SWAP_CARD': return 'Return one of your Gear or Year cards to the bottom of its deck, then take the top Year card, the top Gear card or any face-up Gear.';
        case 'GEAR_REFRESH': return `Turn in ${GEAR_REFRESH_COST} Sunshine to replace the 3 face-up Gear, then take one of them or the top Gear card free.`;
        case 'RESERVE_RELIGHT': return `Gain a ${TOKEN_NAME[a.gain]}, reserve a Park and relight your Campfire.`;
        case 'YEAR_DRAW': return `Turn in ${YEAR_DRAW_COST} Sunshine to draw 2 Year cards, then return one card from your hand.`;
        case 'CAMERA': return 'Take the Camera.';
        case 'YEAR_CARD': return 'Draw the top Year card and keep it.';
        case 'GEAR_CARD': return 'Take any face-up Gear or the top Gear card, free.';
        case 'CAMP': return 'Pitch a Tent at any open Campsite and take its action (no Weather).';
    }
}

// ---------------------------------------------------------------------------
// Solo Events — designed stand-ins (the printed deck was not in the source)
// ---------------------------------------------------------------------------

export type EventOp = 'ADVANCE_RANGER' | 'DISCARD_LEFT' | 'DISCARD_MIDDLE' | 'DISCARD_RIGHT' | 'LOSE_CAMERA'
    | 'DOUSE_CAMPFIRE' | 'ADVANCE_BACK_HIKER' | 'ADVANCE_FRONT_HIKER' | 'CLEAR_WEATHER' | 'REVEAL_GEAR';

export const EVENT_OP_TEXT: Record<EventOp, string> = {
    ADVANCE_RANGER: 'The active Ranger moves 1 Site',
    DISCARD_LEFT: 'Discard the left Park',
    DISCARD_MIDDLE: 'Discard the middle Park',
    DISCARD_RIGHT: 'Discard the right Park',
    LOSE_CAMERA: 'Return the Camera to the supply',
    DOUSE_CAMPFIRE: 'Your Campfire goes out',
    ADVANCE_BACK_HIKER: 'Your back Hiker moves 1 Site, no action',
    ADVANCE_FRONT_HIKER: 'Your front Hiker moves 1 Site, no action',
    CLEAR_WEATHER: 'All Weather leaves the Trail',
    REVEAL_GEAR: 'Reveal the next Gear card'
};

export interface EventCard {
    id: string;
    name: string;
    sunshine: EventOp;
    water: EventOp;
}

export const EVENT_CARDS: EventCard[] = [
    { id: 'trail_crew', name: 'Trail Crew', sunshine: 'ADVANCE_RANGER', water: 'REVEAL_GEAR' },
    { id: 'heat_wave', name: 'Heat Wave', sunshine: 'DISCARD_LEFT', water: 'DOUSE_CAMPFIRE' },
    { id: 'high_water', name: 'High Water', sunshine: 'REVEAL_GEAR', water: 'DISCARD_MIDDLE' },
    { id: 'fog_bank', name: 'Fog Bank', sunshine: 'LOSE_CAMERA', water: 'CLEAR_WEATHER' },
    { id: 'rockslide', name: 'Rockslide', sunshine: 'ADVANCE_BACK_HIKER', water: 'ADVANCE_RANGER' },
    { id: 'wildfire', name: 'Wildfire Watch', sunshine: 'DOUSE_CAMPFIRE', water: 'DISCARD_RIGHT' },
    { id: 'long_detour', name: 'Long Detour', sunshine: 'CLEAR_WEATHER', water: 'ADVANCE_FRONT_HIKER' },
    { id: 'crowds', name: 'Summer Crowds', sunshine: 'DISCARD_RIGHT', water: 'LOSE_CAMERA' }
];
export const EVENT_BY_ID: Record<string, EventCard> = Object.fromEntries(EVENT_CARDS.map(e => [e.id, e]));

export const soloRating = (score: number, nightfall = false): string => {
    if (nightfall) {
        if (score >= 35) return 'Memories for a lifetime';
        if (score >= 30) return 'Seasoned Hiker';
        if (score >= 25) return 'Casual enthusiast';
        return 'You definitely went hiking';
    }
    if (score >= 30) return 'Unforgettable experience';
    if (score >= 25) return 'Seasoned Hiker';
    if (score >= 20) return 'Casual enthusiast';
    return 'Missed some great Sites';
};
