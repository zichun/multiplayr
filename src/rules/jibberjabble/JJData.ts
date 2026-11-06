/**
 * JJData.ts — static tables for Jibber Jabble.
 *
 * Sources: the v12 rulebook (rounds, ranks, challenges, the hint-card concept).
 * NOT in the rulebook, so authored here (each is a one-table edit):
 *   • the 150 secret-word cards — the box's word lists aren't printed in the
 *     rules, so these are original lists, built from three tiers of 300 words
 *     (card N takes easy[2N..2N+1], medium[2N..2N+1], hard[2N..2N+1]); the
 *     second batch of 200 per tier lives in JJWords.ts. In "mixed" card mode
 *     cards are dealt fresh from the tiers instead (see dealMixedCard);
 *   • the 10 hint cards — the rulebook only says each gives "limited ways to
 *     communicate", once per game. One ("Lifeline … 1 extra guess") is legible
 *     in the box photo; the other nine are original designs for this port.
 */

import { EASY_MORE, MEDIUM_MORE, HARD_MORE } from './JJWords';

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 12;
export const DEFAULT_ROUNDS = 6;
export const MIN_ROUNDS = 3;
export const MAX_ROUNDS = 12;
export const MAX_CLUE_LEN = 16;
export const MAX_SIGNALS = 16;

// Team mode (2 teams racing on the same word)
export const MIN_TEAM_SIZE = 3;
export const MIN_TEAM_PLAYERS = MIN_TEAM_SIZE * 2;
export const TEAMS = [
    { name: 'Team Jibber', short: 'Jibber', colour: '#a8e6c4', deep: '#3fae7a' },
    { name: 'Team Jabber', short: 'Jabber', colour: '#ffc28f', deep: '#e0803a' }
];

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

const EASY_BASE = [
    'CAT', 'DOG', 'SUN', 'MOON', 'TREE', 'FISH', 'BOOK', 'CAKE', 'SHOE', 'BALL',
    'HAT', 'CAR', 'BED', 'CUP', 'EGG', 'PIG', 'COW', 'BEE', 'KEY', 'MILK',
    'RAIN', 'SNOW', 'STAR', 'BIRD', 'FROG', 'DUCK', 'LION', 'BEAR', 'APPLE', 'BANANA',
    'PIZZA', 'CHAIR', 'TABLE', 'DOOR', 'CLOCK', 'PHONE', 'HOUSE', 'TRAIN', 'BOAT', 'PLANE',
    'HORSE', 'MOUSE', 'CHEESE', 'BREAD', 'BEACH', 'OCEAN', 'RIVER', 'FLOWER', 'GRASS', 'CLOUD',
    'SPOON', 'FORK', 'KNIFE', 'PENCIL', 'PAPER', 'BRUSH', 'SOCK', 'GLOVE', 'SCARF', 'COAT',
    'DRESS', 'SHIRT', 'PANTS', 'WATCH', 'RING', 'CROWN', 'ROBOT', 'ROCKET', 'PIANO', 'DRUM',
    'GUITAR', 'BABY', 'KING', 'QUEEN', 'DOCTOR', 'TEACHER', 'NURSE', 'CLOWN', 'PIRATE', 'GHOST',
    'DRAGON', 'MONKEY', 'TIGER', 'ZEBRA', 'SNAKE', 'SHARK', 'WHALE', 'OWL', 'PENGUIN', 'RABBIT',
    'TURTLE', 'PUMPKIN', 'CARROT', 'LEMON', 'ORANGE', 'GRAPES', 'CANDY', 'COOKIE', 'HONEY', 'SOUP'
];

const MEDIUM_BASE = [
    'VOLCANO', 'CASTLE', 'DESERT', 'JUNGLE', 'ISLAND', 'BRIDGE', 'TUNNEL', 'LIBRARY', 'MUSEUM', 'HOSPITAL',
    'AIRPORT', 'CIRCUS', 'PICNIC', 'BIRTHDAY', 'WEDDING', 'VACATION', 'CAMPING', 'FIREWORKS', 'RAINBOW', 'THUNDER',
    'TORNADO', 'EARTHQUAKE', 'ICEBERG', 'CACTUS', 'MUSHROOM', 'SANDWICH', 'PANCAKE', 'POPCORN', 'SUSHI', 'BURRITO',
    'LAPTOP', 'CAMERA', 'MAGNET', 'LADDER', 'UMBRELLA', 'BACKPACK', 'SUITCASE', 'TELESCOPE', 'COMPASS', 'LANTERN',
    'SKELETON', 'VAMPIRE', 'WIZARD', 'MERMAID', 'UNICORN', 'ALIEN', 'ASTRONAUT', 'DETECTIVE', 'CHEF', 'FARMER',
    'SOLDIER', 'ATHLETE', 'MAGICIAN', 'LIBRARIAN', 'KANGAROO', 'GIRAFFE', 'OCTOPUS', 'FLAMINGO', 'PEACOCK', 'SQUIRREL',
    'SPIDER', 'BUTTERFLY', 'DINOSAUR', 'PARROT', 'CAMEL', 'SKATEBOARD', 'BICYCLE', 'HELICOPTER', 'SUBMARINE', 'TRACTOR',
    'AMBULANCE', 'KARATE', 'BALLET', 'SOCCER', 'TENNIS', 'BOWLING', 'SURFING', 'CHESS', 'PUZZLE', 'TREASURE',
    'PASSPORT', 'ENVELOPE', 'CALENDAR', 'MIRROR', 'PILLOW', 'BLANKET', 'CANDLE', 'BALLOON', 'KITE', 'TRUMPET',
    'VIOLIN', 'MICROPHONE', 'HEADPHONES', 'SCISSORS', 'TOOTHBRUSH', 'SHAMPOO', 'VACUUM', 'FRIDGE', 'OVEN', 'SNOWMAN'
];

const HARD_BASE = [
    'NOSTALGIA', 'GRAVITY', 'DEMOCRACY', 'JEALOUSY', 'FREEDOM', 'GOSSIP', 'HONESTY', 'PATIENCE', 'CURIOSITY', 'COURAGE',
    'LONELINESS', 'SARCASM', 'KARMA', 'DESTINY', 'INFINITY', 'ECHO', 'SHADOW', 'SILENCE', 'MIRAGE', 'PARADOX',
    'EVOLUTION', 'ELECTRICITY', 'PHOTOSYNTHESIS', 'HIBERNATION', 'MIGRATION', 'RECYCLING', 'INFLATION', 'ALLERGY', 'HICCUP', 'YAWN',
    'SNEEZE', 'HORIZON', 'HANGOVER', 'JETLAG', 'PROCRASTINATION', 'BRAINSTORM', 'DEADLINE', 'MONDAY', 'WEEKEND', 'MIDNIGHT',
    'ECLIPSE', 'AURORA', 'GALAXY', 'ATOM', 'FOSSIL', 'ALGEBRA', 'GEOMETRY', 'PHILOSOPHY', 'PSYCHOLOGY', 'ARCHAEOLOGY',
    'ORIGAMI', 'GRAFFITI', 'KARAOKE', 'MARATHON', 'AUCTION', 'BANKRUPTCY', 'LOTTERY', 'REFUND', 'WARRANTY', 'TAXES',
    'PASSWORD', 'ALGORITHM', 'PODCAST', 'SELFIE', 'HASHTAG', 'EMOJI', 'MEME', 'VIRUS', 'VACCINE', 'ANESTHESIA',
    'CAFFEINE', 'GLUTEN', 'PROTEIN', 'METABOLISM', 'ADRENALINE', 'INSOMNIA', 'NIGHTMARE', 'HYPNOSIS', 'TELEPATHY', 'CONSPIRACY',
    'PROPAGANDA', 'RUMOR', 'SECRET', 'MYSTERY', 'IRONY', 'METAPHOR', 'RHYTHM', 'HARMONY', 'SYMPHONY', 'APPLAUSE',
    'ENCORE', 'PYRAMID', 'SYMMETRY', 'CAMOUFLAGE', 'PERSPECTIVE', 'TRADITION', 'ANCESTOR', 'UTOPIA', 'EQUATOR', 'AVALANCHE'
];

const EASY = [...EASY_BASE, ...EASY_MORE];
const MEDIUM = [...MEDIUM_BASE, ...MEDIUM_MORE];
const HARD = [...HARD_BASE, ...HARD_MORE];

export const WORD_TIERS = { easy: EASY, medium: MEDIUM, hard: HARD };

export interface WordCard {
    id: number;          // 1..150
    words: string[];     // six words, index 0..5 = printed numbers 1..6
}

export const CARD_COUNT = Math.min(EASY.length, MEDIUM.length, HARD.length) / 2;

/** fixed = the printed cards; mixed = each card dealt fresh from the tiers. */
export type CardMode = 'fixed' | 'mixed';

/**
 * Mixed mode: deal a fresh card of 2 easy + 2 medium + 2 hard words, none of
 * which appear in `used` (every word already dealt this game). `rand` returns
 * [0, 1). If a tier ever runs dry its whole tier becomes available again.
 */
export function dealMixedCard(used: Set<string>, rand: () => number): string[] {
    const pick2 = (tier: string[]) => {
        let pool = tier.filter(w => !used.has(w));
        if (pool.length < 2) pool = [...tier];
        const a = pool[Math.floor(rand() * pool.length)];
        const rest = pool.filter(w => w !== a);
        const b = rest[Math.floor(rand() * rest.length)];
        return [a, b];
    };
    return [...pick2(EASY), ...pick2(MEDIUM), ...pick2(HARD)];
}

export const WORD_CARDS: WordCard[] = Array.from({ length: CARD_COUNT }, (_, i) => ({
    id: i + 1,
    words: [EASY[2 * i], EASY[2 * i + 1], MEDIUM[2 * i], MEDIUM[2 * i + 1], HARD[2 * i], HARD[2 * i + 1]]
}));

export const CARD_BY_ID: Record<number, WordCard> = {};
WORD_CARDS.forEach(c => { CARD_BY_ID[c.id] = c; });

export type Tier = 'easy' | 'medium' | 'hard';

/** Printed number 1..6 (or index 0..5 with `fromIndex`) → difficulty tier. */
export function tierOf(wordIdx: number): Tier {
    return wordIdx <= 1 ? 'easy' : wordIdx <= 3 ? 'medium' : 'hard';
}

/** Team mode: points for guessing a word of each band, plus a speed bonus. */
export const TIER_POINTS: Record<Tier, number> = { easy: 1, medium: 2, hard: 3 };
export const SPEED_BONUS = 0.5;

export const TIER_LABEL: Record<Tier, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
/** The nonsense sub-label shown under each tier pill. */
export const TIER_NONSENSE: Record<Tier, string> = { easy: 'easy-peasy', medium: 'medium-ish', hard: 'kerfuffle' };

// ---------------------------------------------------------------------------
// Hint cards (once per game each)
// ---------------------------------------------------------------------------

export type HintId =
    | 'lifeline' | 'doubleup' | 'rewind' | 'skip' | 'mulligan'
    | 'encore' | 'spotlight' | 'firstdibs' | 'doover' | 'highlighter';

/** When a hint may be played: on your own spelling turn, any time while
 *  spelling, or while spelling or guessing. */
export type HintWindow = 'myturn' | 'spelling' | 'spellOrGuess';

export interface HintCard {
    id: HintId;
    name: string;
    text: string;
    window: HintWindow;
    glyph: string;     // a tiny geometric glyph key, drawn by the views
}

export const HINT_CARDS: HintCard[] = [
    { id: 'lifeline', name: 'Lifeline', text: 'The Guesser gets 1 extra guess this round.', window: 'spellOrGuess', glyph: 'ring' },
    { id: 'doubleup', name: 'Double Up', text: 'On your turn, add 2 letters instead of 1.', window: 'myturn', glyph: 'two' },
    { id: 'rewind', name: 'Rewind', text: 'On your turn, erase the last letter of the current clue.', window: 'myturn', glyph: 'back' },
    { id: 'skip', name: 'Skip-a-doodle', text: 'Pass your turn without adding a letter.', window: 'myturn', glyph: 'skip' },
    { id: 'mulligan', name: 'Mulligan', text: 'On your turn, wipe the current clue and start it again yourself.', window: 'myturn', glyph: 'wipe' },
    { id: 'encore', name: 'Encore', text: 'Spell 1 extra clue this round.', window: 'spelling', glyph: 'plus' },
    { id: 'spotlight', name: 'Spotlight', text: 'Show the Guesser how many letters the secret word has.', window: 'spellOrGuess', glyph: 'dots' },
    { id: 'firstdibs', name: 'First Dibs', text: 'Show the Guesser the first letter of the secret word.', window: 'spellOrGuess', glyph: 'one' },
    { id: 'doover', name: 'Do-Over', text: 'Scrap this word and its clues — draw a fresh card and choose again.', window: 'spelling', glyph: 'swap' },
    { id: 'highlighter', name: 'Highlighter', text: 'Star one clue as the best one so far.', window: 'spellOrGuess', glyph: 'star' }
];

export const HINT_BY_ID: Record<string, HintCard> = {};
HINT_CARDS.forEach(h => { HINT_BY_ID[h.id] = h; });

// ---------------------------------------------------------------------------
// Ranks & challenges
// ---------------------------------------------------------------------------

export const RANKS = [
    { min: 0, title: 'Dizzy Dabbler' },
    { min: 2, title: 'Satisfactory Speller' },
    { min: 4, title: 'Glorious Guesser' },
    { min: 6, title: 'Legendary Letterer' }
];

/** Rank for a score, scaled to the rulebook's 6-round table. */
export function rankFor(score: number, rounds: number): { idx: number; title: string } {
    const scaled = rounds > 0 ? (score * 6) / rounds : 0;
    let idx = 0;
    RANKS.forEach((r, i) => { if (scaled >= r.min - 1e-9) idx = i; });
    return { idx, title: RANKS[idx].title };
}

export type ChallengeId = 'apprentice' | 'adept' | 'expert' | 'alliterator' | 'foniks' | 'buzzer';

export const CHALLENGES: { id: ChallengeId; name: string; text: string; auto: boolean }[] = [
    { id: 'apprentice', name: 'Apprentice', text: 'Score 2 Easy, 2 Medium and 2 Hard words in 1 game.', auto: true },
    { id: 'adept', name: 'Adept', text: 'Score 6 Medium words in 1 game.', auto: true },
    { id: 'expert', name: 'Expert', text: 'Score 6 Hard words in 1 game.', auto: true },
    { id: 'alliterator', name: 'Alliterator', text: 'Start the 2nd and 3rd clues each round with the 1st clue’s first letter.', auto: true },
    { id: 'foniks', name: 'Foniks Feend', text: 'Spell all clues incorrectly. (Honour system!)', auto: false },
    { id: 'buzzer', name: 'Buzzer Beater', text: 'Give only 2 clues each round.', auto: true }
];

// ---------------------------------------------------------------------------
// Emotes — expressive faces any player can pop over their avatar while
// spelling (a digital-only extra; the rulebook only allows Jibber!/Jabble?).
// ---------------------------------------------------------------------------

export type EmoteId = 'laugh' | 'love' | 'wow' | 'hmm' | 'nooo' | 'party';

export const EMOTES: { id: EmoteId; label: string; colour: string }[] = [
    { id: 'laugh', label: 'Ha!', colour: '#ffe38f' },
    { id: 'love', label: 'Love it', colour: '#ff9aa2' },
    { id: 'wow', label: 'Whoa', colour: '#9fd3f5' },
    { id: 'hmm', label: 'Hmm…', colour: '#c6b6f7' },
    { id: 'nooo', label: 'Nooo', colour: '#a8e6c4' },
    { id: 'party', label: 'Yay!', colour: '#ffc28f' }
];

export const isEmote = (k: string): k is EmoteId => EMOTES.some(e => e.id === k);

/** Silly lines for idle moments. */
export const NONSENSE = [
    'Flibbering the gibbets…',
    'Unjumbling the jumbles…',
    'Polishing the vowels…',
    'Wrangling loose consonants…',
    'Consulting the alpha-bet…',
    'Tickling the typewriter…',
    'Herding stray letters…',
    'Fluffing the syllables…'
];

/** Normalise free text to bare A–Z. */
export function normalise(s: string): string {
    return String(s || '').toUpperCase().replace(/[^A-Z]/g, '');
}

/** One-chance guess check: exact match, forgiving a trailing plural S/ES. */
export function guessMatches(guess: string, secret: string): boolean {
    const g = normalise(guess);
    const s = normalise(secret);
    if (!g || !s) return false;
    if (g === s) return true;
    return g === s + 'S' || s === g + 'S' || g === s + 'ES' || s === g + 'ES';
}
