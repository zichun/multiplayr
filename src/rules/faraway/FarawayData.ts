/**
 * FarawayData.ts — static card definitions and scoring vocabulary for Faraway
 * (Catch Up Games, 2023), base game only.
 *
 * 68 Region cards (numbered 1–68 = their exploration duration) and 45 Sanctuary
 * cards are transcribed from the rulebook card list as compact rows and parsed
 * once at module load, so the tables stay auditable against the printed cards.
 *
 * Nothing here knows about React, Multiplayr or the card renderer — it is pure
 * data plus the quest evaluator, shared by the engine, the views and the tests.
 */

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

export type Colour = 'BLUE' | 'RED' | 'GREEN' | 'YELLOW';
export const COLOURS: Colour[] = ['BLUE', 'RED', 'GREEN', 'YELLOW'];

/** Biome flavour behind each colour (used for art + rules text). */
export const COLOUR_BIOME: Record<Colour, string> = {
    BLUE: 'Rocky Desert',
    RED: 'Mushroom Forest',
    GREEN: 'River',
    YELLOW: 'Cave City'
};

export type Resource = 'UDDU' | 'OKIKO' | 'GOLDLOG';
export const RESOURCES: Resource[] = ['UDDU', 'OKIKO', 'GOLDLOG'];

export const RESOURCE_NAME: Record<Resource, string> = {
    UDDU: 'Uddu',
    OKIKO: 'Okiko',
    GOLDLOG: 'Goldlog'
};

/** What each wonder actually depicts — drives the iconography. */
export const RESOURCE_FLAVOUR: Record<Resource, string> = {
    UDDU: 'stone',
    OKIKO: 'chimera',
    GOLDLOG: 'thistle'
};

export type Quest =
    | { kind: 'FLAT'; fame: number }
    | { kind: 'PER_RESOURCE'; resource: Resource; fame: number }
    | { kind: 'PER_NIGHT'; fame: number }
    | { kind: 'PER_CLUE'; fame: number }
    | { kind: 'PER_COLOUR'; colours: Colour[]; fame: number }
    | { kind: 'PER_SET_4_COLOURS'; fame: number };

export interface RegionCard {
    id: number;                 // 1..68 — exploration duration, unique, also the turn-order key
    colour: Colour;
    night: boolean;
    clues: number;              // 0 or 1
    resources: Resource[];      // 0..3 icons, duplicates allowed
    prerequisite: Resource[];   // 0..5 icons that must be visible when the quest scores
    quest: Quest | null;
}

export interface SanctuaryCard {
    id: string;                 // S01..S45
    colour: Colour | null;      // a coloured Sanctuary COUNTS as a Region of that colour
    night: boolean;
    clues: number;
    resources: Resource[];
    quest: Quest | null;        // Sanctuaries never carry a prerequisite
}

/** Anything that can contribute icons to a quest's `visible` set. */
export interface ScorableCard {
    colour: Colour | null;
    night: boolean;
    clues: number;
    resources: Resource[];
}

// ---------------------------------------------------------------------------
// Table parsing
// ---------------------------------------------------------------------------

const RES_LETTER: Record<string, Resource> = { U: 'UDDU', O: 'OKIKO', G: 'GOLDLOG' };
const COLOUR_LETTER: Record<string, Colour> = { B: 'BLUE', R: 'RED', G: 'GREEN', Y: 'YELLOW' };

/** `'UUO'` → `[UDDU, UDDU, OKIKO]`; `'-'` / `''` → `[]`. */
function parseResources(s: string): Resource[] {
    if (!s || s === '-') return [];
    return s.split('').map((ch) => {
        const r = RES_LETTER[ch];
        if (!r) throw new Error(`Faraway: unknown resource letter "${ch}" in "${s}"`);
        return r;
    });
}

/**
 * Quest mini-language, one token per printed quest:
 *   `-`          no quest
 *   `flat:N`     N fame, unconditionally
 *   `res:U:N`    N fame per uddu / okiko (`O`) / goldlog (`G`) icon
 *   `night:N`    N fame per night card
 *   `clue:N`     N fame per clue icon
 *   `col:Y,G:N`  N fame per card whose colour is yellow OR green
 *   `set4:N`     N fame per complete set of all four colours
 */
function parseQuest(s: string): Quest | null {
    if (!s || s === '-') return null;
    const parts = s.split(':');
    switch (parts[0]) {
        case 'flat': return { kind: 'FLAT', fame: Number(parts[1]) };
        case 'res': return { kind: 'PER_RESOURCE', resource: RES_LETTER[parts[1]], fame: Number(parts[2]) };
        case 'night': return { kind: 'PER_NIGHT', fame: Number(parts[1]) };
        case 'clue': return { kind: 'PER_CLUE', fame: Number(parts[1]) };
        case 'col': return {
            kind: 'PER_COLOUR',
            colours: parts[1].split(',').map(c => COLOUR_LETTER[c]),
            fame: Number(parts[2])
        };
        case 'set4': return { kind: 'PER_SET_4_COLOURS', fame: Number(parts[1]) };
        default: throw new Error(`Faraway: unknown quest token "${s}"`);
    }
}

// ---------------------------------------------------------------------------
// Region table — `id colour night clues resources prerequisite quest`
// ---------------------------------------------------------------------------

const REGION_ROWS: string[] = [
    '1  RED    - -  UOG   -      -',
    '2  BLUE   - -  UU    -      -',
    '3  GREEN  - -  -     -      flat:4',
    '4  RED    - -  U     -      -',
    '5  GREEN  - -  O     -      flat:2',
    '6  BLUE   - 1  U     -      -',
    '7  RED    - -  OG    -      -',
    '8  GREEN  - 1  O     -      -',
    '9  BLUE   - -  -     -      flat:5',
    '10 RED    - -  -     -      night:3',
    '11 GREEN  - -  -     -      clue:2',
    '12 YELLOW - 1  G     -      -',
    '13 BLUE   - -  -     -      res:U:2',
    '14 RED    - -  G     -      night:2',
    '15 GREEN  - 1  -     -      res:O:2',
    '16 RED    - -  O     -      res:O:2',
    '17 BLUE   - -  U     OO     res:U:3',
    '18 GREEN  - -  O     -      set4:10',
    '19 RED    - -  G     -      res:G:2',
    '20 GREEN  Y 1  -     U      night:2',
    '21 BLUE   Y -  -     UU     flat:8',
    '22 GREEN  Y 1  -     -      clue:1',
    '23 RED    Y -  UO    -      set4:10',
    '24 BLUE   Y -  U     O      night:2',
    '25 YELLOW Y -  -     -      col:Y,G:1',
    '26 RED    Y -  O     -      res:G:3',
    '27 YELLOW Y -  -     -      col:Y,B:1',
    '28 RED    Y -  U     -      res:O:3',
    '29 YELLOW Y -  G     -      res:G:2',
    '30 RED    Y -  U     -      res:U:2',
    '31 YELLOW Y -  U     -      col:Y,R:1',
    '32 RED    Y -  O     UUU    flat:7',
    '33 YELLOW Y 1  -     -      res:G:3',
    '34 GREEN  Y -  -     UU     res:O:3',
    '35 YELLOW Y -  O     -      set4:10',
    '36 RED    Y -  -     OO     res:G:4',
    '37 YELLOW Y -  -     G      night:3',
    '38 GREEN  Y -  U     OG     clue:3',
    '39 RED    Y -  UG    OO     flat:9',
    '40 BLUE   Y -  -     UOG    night:3',
    '41 GREEN  - -  G     UUO    night:4',
    '42 YELLOW - -  -     UO     col:Y,G:2',
    '43 BLUE   - -  U     -      set4:10',
    '44 YELLOW - -  -     UG     col:Y,B:2',
    '45 GREEN  - -  U     OOO    flat:13',
    '46 BLUE   - 1  -     UUO    flat:10',
    '47 YELLOW - -  -     OG     col:Y,R:2',
    '48 RED    - -  O     -      res:U:3',
    '49 BLUE   - 1  -     UUG    flat:12',
    '50 YELLOW - -  U     GG     col:G:4',
    '51 BLUE   - -  U     UUUU   flat:14',
    '52 RED    - -  -     UUU    res:O:4',
    '53 YELLOW - -  O     GG     col:R:4',
    '54 GREEN  - -  O     GG     clue:4',
    '55 BLUE   - 1  -     OGG    res:U:3',
    '56 YELLOW - -  G     UOO    col:B:4',
    '57 RED    - -  -     GGG    res:U:4',
    '58 GREEN  - 1  -     OOO    clue:3',
    '59 YELLOW - 1  -     UOOO   col:Y,R:3',
    '60 BLUE   - 1  -     UUOO   flat:16',
    '61 GREEN  - -  G     OOOO   flat:17',
    '62 YELLOW - 1  -     GGG    col:Y,B:3',
    '63 GREEN  - 1  -     OOG    flat:15',
    '64 BLUE   - 1  -     UUGG   flat:18',
    '65 YELLOW - 1  -     GGG    col:Y,G:3',
    '66 BLUE   - -  -     UUUU   flat:20',
    '67 GREEN  - 1  -     OOGG   flat:19',
    '68 BLUE   - -  -     UUUUU  flat:24'
];

export const REGION_CARDS: RegionCard[] = REGION_ROWS.map((row) => {
    const [id, colour, night, clues, res, pre, quest] = row.trim().split(/\s+/);
    return {
        id: Number(id),
        colour: colour as Colour,
        night: night === 'Y',
        clues: clues === '-' ? 0 : Number(clues),
        resources: parseResources(res),
        prerequisite: parseResources(pre),
        quest: parseQuest(quest)
    };
});

export const REGION_BY_ID: Record<number, RegionCard> = {};
REGION_CARDS.forEach(c => { REGION_BY_ID[c.id] = c; });

export const ALL_REGION_IDS: number[] = REGION_CARDS.map(c => c.id);

// ---------------------------------------------------------------------------
// Sanctuary table — `id colour night clues resources quest`
// ---------------------------------------------------------------------------

const SANCTUARY_ROWS: string[] = [
    'S01 -      - -  U   res:U:1',
    'S02 -      - -  -   res:U:2',
    'S03 -      - -  O   res:O:1',
    'S04 -      - -  -   res:O:2',
    'S05 -      - -  G   res:G:1',
    'S06 -      - -  -   res:G:2',
    'S07 -      - 1  U   -',
    'S08 -      - 1  O   -',
    'S09 -      - 1  G   -',
    'S10 -      - -  U   clue:1',
    'S11 -      - -  O   clue:1',
    'S12 -      - 1  -   clue:1',
    'S13 -      - -  -   clue:2',
    'S14 -      - -  -   col:Y,R:1',
    'S15 -      - -  -   col:R,B:1',
    'S16 -      - -  -   col:G,B:1',
    'S17 -      - -  -   col:G,R:1',
    'S18 -      - -  -   col:Y,G:1',
    'S19 -      - -  -   col:Y,B:1',
    'S20 -      - 1  -   set4:4',
    'S21 -      - -  -   flat:5',
    'S22 -      - -  U   night:1',
    'S23 -      Y -  U   -',
    'S24 -      Y -  O   -',
    'S25 -      Y -  G   -',
    'S26 YELLOW - -  U   -',
    'S27 YELLOW - 1  -   -',
    'S28 YELLOW - -  -   set4:4',
    'S29 YELLOW - -  -   clue:1',
    'S30 YELLOW - -  -   col:Y:1',
    'S31 GREEN  - -  U   -',
    'S32 GREEN  - -  O   -',
    'S33 GREEN  - 1  -   -',
    'S34 GREEN  - -  -   night:1',
    'S35 GREEN  - -  -   col:G:1',
    'S36 RED    - -  U   -',
    'S37 RED    - -  O   -',
    'S38 RED    - -  G   -',
    'S39 RED    Y -  -   -',
    'S40 RED    - -  -   col:R:1',
    'S41 BLUE   - -  U   -',
    'S42 BLUE   - -  O   -',
    'S43 BLUE   - -  G   -',
    'S44 BLUE   - 1  -   -',
    'S45 BLUE   - -  -   col:B:1'
];

export const SANCTUARY_CARDS: SanctuaryCard[] = SANCTUARY_ROWS.map((row) => {
    const [id, colour, night, clues, res, quest] = row.trim().split(/\s+/);
    return {
        id,
        colour: colour === '-' ? null : (colour as Colour),
        night: night === 'Y',
        clues: clues === '-' ? 0 : Number(clues),
        resources: parseResources(res),
        quest: parseQuest(quest)
    };
});

export const SANCTUARY_BY_ID: Record<string, SanctuaryCard> = {};
SANCTUARY_CARDS.forEach(c => { SANCTUARY_BY_ID[c.id] = c; });

export const ALL_SANCTUARY_IDS: string[] = SANCTUARY_CARDS.map(c => c.id);

// ---------------------------------------------------------------------------
// Game constants
// ---------------------------------------------------------------------------

export const ROUNDS = 8;
export const HAND_SIZE = 3;
export const DRAFT_DEAL = 5;          // advanced variant: deal 5, keep HAND_SIZE
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;

/**
 * The market is refilled at the end of rounds 1..6 only: round 8 uses no market
 * at all, so the round-7 refill would be wasted (and with 6 players would
 * overdraw the 68-card deck).
 */
export const LAST_MARKET_ROUND = ROUNDS - 1;   // 7 — last round with a market pick
export const LAST_REFILL_ROUND = ROUNDS - 2;   // 6 — last round followed by a refill

/**
 * Rulebook tie-break wording is ambiguous; the common reading is the lowest
 * *sum* of the eight exploration durations. Kept as a constant so it can be
 * flipped to the "lowest single duration" reading without touching the engine.
 */
export const TIEBREAK: 'LOWEST_SUM' | 'LOWEST_SINGLE' = 'LOWEST_SUM';

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export function countResource(visible: ScorableCard[], resource: Resource): number {
    let n = 0;
    for (const c of visible) for (const r of c.resources) if (r === resource) n++;
    return n;
}

export function countClues(visible: ScorableCard[]): number {
    let n = 0;
    for (const c of visible) n += c.clues;
    return n;
}

export function countNights(visible: ScorableCard[]): number {
    let n = 0;
    for (const c of visible) if (c.night) n++;
    return n;
}

export function countColour(visible: ScorableCard[], colours: Colour[]): number {
    let n = 0;
    for (const c of visible) if (c.colour && colours.indexOf(c.colour) !== -1) n++;
    return n;
}

/**
 * Prerequisites are *not consumed*: each printed icon simply has to be visible
 * often enough, so this is a per-type "at least N" check.
 */
export function prereqMet(prerequisite: Resource[], visible: ScorableCard[]): boolean {
    if (prerequisite.length === 0) return true;
    for (const r of RESOURCES) {
        const need = prerequisite.filter(p => p === r).length;
        if (need > 0 && countResource(visible, r) < need) return false;
    }
    return true;
}

/**
 * Which prerequisite icons are still short, and by how many — one entry per
 * missing icon, so the UI can print them as coins. Empty when the prerequisite
 * is already satisfied.
 */
export function missingResources(prerequisite: Resource[], visible: ScorableCard[]): Resource[] {
    const out: Resource[] = [];
    for (const r of RESOURCES) {
        const need = prerequisite.filter(x => x === r).length;
        const short = need - countResource(visible, r);
        for (let i = 0; i < short; i++) out.push(r);
    }
    return out;
}

export function evalQuest(quest: Quest, visible: ScorableCard[]): number {
    switch (quest.kind) {
        case 'FLAT':
            return quest.fame;
        case 'PER_RESOURCE':
            return quest.fame * countResource(visible, quest.resource);
        case 'PER_NIGHT':
            return quest.fame * countNights(visible);
        case 'PER_CLUE':
            return quest.fame * countClues(visible);
        case 'PER_COLOUR':
            return quest.fame * countColour(visible, quest.colours);
        case 'PER_SET_4_COLOURS': {
            const sets = Math.min(...COLOURS.map(c => countColour(visible, [c])));
            return quest.fame * sets;
        }
        default:
            return 0;
    }
}

/** How many of each icon a quest still needs, for the "why 0?" UI hints. */
export function questCountLabel(quest: Quest): string {
    switch (quest.kind) {
        case 'FLAT': return 'fame';
        case 'PER_RESOURCE': return `per ${RESOURCE_NAME[quest.resource].toLowerCase()}`;
        case 'PER_NIGHT': return 'per night card';
        case 'PER_CLUE': return 'per clue';
        case 'PER_COLOUR': return `per ${quest.colours.map(c => COLOUR_BIOME[c]).join(' / ')} card`;
        case 'PER_SET_4_COLOURS': return 'per set of all 4 colours';
        default: return '';
    }
}

export function describeQuest(quest: Quest | null): string {
    if (!quest) return 'No quest';
    if (quest.kind === 'FLAT') return `${quest.fame} fame`;
    return `${quest.fame} fame ${questCountLabel(quest)}`;
}
