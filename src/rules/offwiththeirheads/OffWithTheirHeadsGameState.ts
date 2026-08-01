/**
 * OffWithTheirHeadsGameState.ts - Standalone engine for "Off With Their Heads".
 *
 * A competitive card-driven roll-and-write. Over 3 Rounds of 7 Bouts (21 bouts),
 * every player secretly plays one card from a 9-card hand. All cards (plus extras
 * for 2-3 players) are ranked against each other using the Wonderland Board's
 * rotating suit hierarchy; each player's card lands HIGH / MID / LOW which forces a
 * mark into the Meadow / Woods / Keep on that player's private sheet.
 *
 * Marking cascades: teacup icons advance a bonus stack, biscuit icons repeat the
 * mark in another zone (chaining), and the Red Keep centre grants two free marks.
 * Seven Wonderlandians (checked continuously) feed the Tea Party scoring curve.
 *
 * At game end the 6 set-aside cards resolve as a poker hand, and every sheet system
 * is tallied. Highest total wins.
 *
 * This class is pure (no React / Multiplayr / network). It is serialised to JSON
 * between host ticks, exposing get_data / from_data rehydration like every other
 * decoupled Multiplayr game state. It holds the full truth; the host redacts hands
 * / hidden selections before pushing to clients.
 *
 * NOTE ON BOARD DATA: the physical sheet's exact geometry is only partially
 * transcribable from the source photos (see off-with-their-heads-data.json). This
 * file commits to a clean, self-consistent board that honours every confirmed
 * figure — Meadow 27/15/3/15/27, Woods 30 all-18 bonus + six starred nodes summing
 * to 36 (doubled to +36 under Jabberwock = 102 max), the Tea Party curve, and the
 * Keep's two entrances + 2-VP centre. The graphs below are authoritative for the
 * digital game.
 */

// ==========================================================
// Cards
// ==========================================================

export type Suit = 'H' | 'D' | 'C' | 'S';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
    suit: Suit;
    rank: Rank;
}

// Clockwise ring on the Wonderland Board. The Queen's suit is highest; suits
// descend clockwise from there.
export const SUIT_ORDER: Suit[] = ['H', 'C', 'D', 'S'];
export const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export function isRed(suit: Suit): boolean {
    return suit === 'H' || suit === 'D';
}
export function cardColor(card: Card): Color {
    return isRed(card.suit) ? 'red' : 'black';
}

// Ordering value (Ace high).
export function rankValue(rank: Rank): number {
    switch (rank) {
        case 'A': return 14;
        case 'K': return 13;
        case 'Q': return 12;
        case 'J': return 11;
        default: return parseInt(rank, 10);
    }
}

// Default mark value: face for numbers; J/Q/K = 10; Ace is chosen 1 or 11 at mark
// time (this returns 11 as a placeholder — callers resolve the Ace explicitly).
export function defaultMarkValue(rank: Rank): number {
    if (rank === 'A') return 11;
    if (rank === 'K' || rank === 'Q' || rank === 'J' || rank === '10') return 10;
    return parseInt(rank, 10);
}

export function cardId(card: Card): string {
    return `${card.rank}${card.suit}`;
}

export function buildDeck(): Card[] {
    const deck: Card[] = [];
    for (const suit of SUIT_ORDER) {
        for (const rank of RANKS) {
            deck.push({ suit, rank });
        }
    }
    return deck; // 52
}

// ==========================================================
// Board vocabulary
// ==========================================================

export type Color = 'red' | 'black' | 'both';
export type Zone = 'meadow' | 'woods' | 'keep';
export type Position = 'high' | 'mid' | 'low';
export type Status = 'Setup' | 'Selecting' | 'Marking' | 'GameOver';

export const POSITION_ZONE: Record<Position, Zone> = {
    high: 'meadow',
    mid: 'woods',
    low: 'keep'
};

// ---- Meadow -------------------------------------------------------------------

export interface MushroomDef {
    id: string;
    label: string;
    color: Color;
    vp: number;
    size: number;
    teacupSpaces: number[];   // space indices (0-based) carrying a teacup icon
    biscuitSpaces: number[];  // space indices carrying a biscuit icon
}

export const MEADOW_DEF: MushroomDef[] = [
    { id: 'red_big',     label: 'Crimson Grove', color: 'red',   vp: 27, size: 6, teacupSpaces: [2], biscuitSpaces: [4] },
    { id: 'red_small',   label: 'Rose Cap',      color: 'red',   vp: 15, size: 4, teacupSpaces: [],  biscuitSpaces: [] },
    { id: 'center',      label: 'Heart Toadstool', color: 'both', vp: 3, size: 2, teacupSpaces: [1], biscuitSpaces: [] },
    { id: 'black_small', label: 'Ink Cap',       color: 'black', vp: 15, size: 4, teacupSpaces: [],  biscuitSpaces: [] },
    { id: 'black_big',   label: 'Shadow Grove',  color: 'black', vp: 27, size: 6, teacupSpaces: [3], biscuitSpaces: [1] }
];

// ---- Woods --------------------------------------------------------------------

export type TreeId =
    'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' |
    'J' | 'K' | 'L' | 'M' | 'N' | 'O' | 'P' | 'Q' | 'R';

export const TREE_IDS: TreeId[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R'];

// Rendering positions on a 0-100 canvas (a tidy honeycomb of 5/4/5/4 rows).
export const TREE_POS: Record<TreeId, { x: number; y: number }> = {
    A: { x: 15, y: 12 }, B: { x: 32, y: 12 }, C: { x: 50, y: 12 }, D: { x: 68, y: 12 }, E: { x: 85, y: 12 },
    F: { x: 24, y: 37 }, G: { x: 41, y: 37 }, H: { x: 59, y: 37 }, I: { x: 76, y: 37 },
    J: { x: 15, y: 62 }, K: { x: 32, y: 62 }, L: { x: 50, y: 62 }, M: { x: 68, y: 62 }, N: { x: 85, y: 62 },
    O: { x: 24, y: 87 }, P: { x: 41, y: 87 }, Q: { x: 59, y: 87 }, R: { x: 76, y: 87 }
};

// Per-tree colour. The four 'both' trees (C, H, L, P) are the Dormouse set.
export const TREE_COLORS: Record<TreeId, Color> = {
    A: 'red',   B: 'red',   C: 'both',  D: 'black', E: 'black',
    F: 'red',   G: 'red',   H: 'both',  I: 'black',
    J: 'red',   K: 'red',   L: 'both',  M: 'black', N: 'black',
    O: 'red',   P: 'both',  Q: 'black', R: 'black'
};

export const DORMOUSE_TREES: TreeId[] = ['C', 'H', 'L', 'P'];

// Adjacency (undirected). Drives the Jabberwock rule and node surrounding.
export const WOODS_EDGES: [TreeId, TreeId][] = [
    // row0 horizontals
    ['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'E'],
    // row1 horizontals
    ['F', 'G'], ['G', 'H'], ['H', 'I'],
    // row2 horizontals
    ['J', 'K'], ['K', 'L'], ['L', 'M'], ['M', 'N'],
    // row3 horizontals
    ['O', 'P'], ['P', 'Q'], ['Q', 'R'],
    // row0-row1 diagonals
    ['A', 'F'], ['B', 'F'], ['B', 'G'], ['C', 'G'], ['C', 'H'], ['D', 'H'], ['D', 'I'], ['E', 'I'],
    // row1-row2 diagonals
    ['F', 'J'], ['F', 'K'], ['G', 'K'], ['G', 'L'], ['H', 'L'], ['H', 'M'], ['I', 'M'], ['I', 'N'],
    // row2-row3 diagonals
    ['J', 'O'], ['K', 'O'], ['K', 'P'], ['L', 'P'], ['L', 'Q'], ['M', 'Q'], ['M', 'R'], ['N', 'R']
];

export interface WoodsNodeDef {
    id: string;
    trees: TreeId[];   // the trees whose caps surround this node
    vp: number;
    starred: boolean;  // doublable under the Jabberwock rule
    center: boolean;   // the March Hare node (never doubles, vp scored separately)
    x: number; y: number;
}

// Six starred nodes (5+6+7+5+6+7 = 36) + the central March Hare node.
export const WOODS_NODES: WoodsNodeDef[] = [
    { id: 'n_abf', trees: ['A', 'B', 'F'], vp: 5, starred: true,  center: false, x: 24, y: 22 },
    { id: 'n_cdh', trees: ['C', 'D', 'H'], vp: 6, starred: true,  center: false, x: 59, y: 22 },
    { id: 'n_fjk', trees: ['F', 'J', 'K'], vp: 7, starred: true,  center: false, x: 24, y: 52 },
    { id: 'n_hlm', trees: ['H', 'L', 'M'], vp: 5, starred: true,  center: false, x: 59, y: 52 },
    { id: 'n_kop', trees: ['K', 'O', 'P'], vp: 6, starred: true,  center: false, x: 32, y: 74 },
    { id: 'n_mqr', trees: ['M', 'Q', 'R'], vp: 7, starred: true,  center: false, x: 68, y: 74 },
    { id: 'n_ghl', trees: ['G', 'H', 'L'], vp: 0, starred: false, center: true,  x: 50, y: 45 }
];

export const MARCH_HARE_TREES: TreeId[] = ['G', 'H', 'L'];
export const WOODS_ALL18_BONUS = 30;

export const WOODS_TEACUP_TREES: TreeId[] = ['A', 'I'];
export const WOODS_BISCUIT_TREES: TreeId[] = ['J'];

// ---- Keep ---------------------------------------------------------------------

export interface KeepCellDef {
    id: string;
    color: Color;
    isCoin: boolean;
    isCenter: boolean;
    teacup: boolean;
    biscuit: boolean;
    x: number; y: number;
}

// 3 rows × 5 columns. All interior cells accept either colour ('both'); only the
// two entrances are colour-locked, so colour matters exactly where the rules say:
// the first mark of each colour seeds that colour's entrance.
function keepCell(
    id: string, col: number, row: number,
    opts: { color?: Color; coin?: boolean; center?: boolean; teacup?: boolean; biscuit?: boolean } = {}
): KeepCellDef {
    return {
        id,
        color: opts.color || 'both',
        isCoin: !!opts.coin,
        isCenter: !!opts.center,
        teacup: !!opts.teacup,
        biscuit: !!opts.biscuit,
        x: 12 + col * 19,
        y: 22 + row * 28
    };
}

export const KEEP_CELLS: KeepCellDef[] = [
    keepCell('c00', 0, 0, { color: 'red' }),                 // red entrance (♥♦)
    keepCell('c01', 1, 0, { teacup: true }),
    keepCell('c02', 2, 0, { coin: true }),
    keepCell('c03', 3, 0, { biscuit: true }),
    keepCell('c04', 4, 0, { coin: true }),                   // White Rabbit adjacent
    keepCell('c10', 0, 1, {}),
    keepCell('c11', 1, 1, { coin: true }),
    keepCell('c12', 2, 1, { center: true }),                 // Red Keep centre (2 VP)
    keepCell('c13', 3, 1, { coin: true }),
    keepCell('c14', 4, 1, {}),
    keepCell('c20', 0, 2, { coin: true }),                   // Humpty Dumpty adjacent
    keepCell('c21', 1, 2, { teacup: true }),
    keepCell('c22', 2, 2, { coin: true }),
    keepCell('c23', 3, 2, { biscuit: true }),
    keepCell('c24', 4, 2, { color: 'black' })                // black entrance (♠♣)
];

export const KEEP_RED_ENTRANCE = 'c00';
export const KEEP_BLACK_ENTRANCE = 'c24';
export const KEEP_HUMPTY_CELL = 'c20';
export const KEEP_RABBIT_CELL = 'c04';

// Orthogonal grid adjacency minus a handful of walls (teal wall segments on the
// physical maze). Chosen so both entrances still reach every cell.
const KEEP_WALLS: [string, string][] = [
    ['c01', 'c02'], ['c13', 'c14'], ['c20', 'c21'], ['c03', 'c04']
];

export const KEEP_EDGES: [string, string][] = (() => {
    const edges: [string, string][] = [];
    const byPos: Record<string, KeepCellDef> = {};
    KEEP_CELLS.forEach(c => { byPos[c.id] = c; });
    const grid: (string | null)[][] = [
        ['c00', 'c01', 'c02', 'c03', 'c04'],
        ['c10', 'c11', 'c12', 'c13', 'c14'],
        ['c20', 'c21', 'c22', 'c23', 'c24']
    ];
    const isWall = (a: string, b: string) =>
        KEEP_WALLS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
    for (let r = 0; r < 3; r++) {
        for (let col = 0; col < 5; col++) {
            const id = grid[r][col];
            if (!id) continue;
            const right = col < 4 ? grid[r][col + 1] : null;
            const down = r < 2 ? grid[r + 1][col] : null;
            if (right && !isWall(id, right)) edges.push([id, right]);
            if (down && !isWall(id, down)) edges.push([id, down]);
        }
    }
    return edges;
})();

// ==========================================================
// Wonderlandians / Tea Party
// ==========================================================

export type Guest =
    'caterpillar' | 'cheshire' | 'dormouse' | 'marchhare' | 'humpty' | 'rabbit' | 'madhatter';

export const GUESTS: Guest[] = ['caterpillar', 'cheshire', 'dormouse', 'marchhare', 'humpty', 'rabbit', 'madhatter'];

export const GUEST_LABELS: Record<Guest, string> = {
    caterpillar: 'The Caterpillar',
    cheshire: 'Cheshire Cat',
    dormouse: 'The Dormouse',
    marchhare: 'The March Hare',
    humpty: 'Humpty Dumpty',
    rabbit: 'The White Rabbit',
    madhatter: 'The Mad Hatter'
};

// (guests + 1)^2 for guests >= 1; 0 guests -> 0.
export function teaPartyVP(guestCount: number): number {
    if (guestCount <= 0) return 0;
    return (guestCount + 1) * (guestCount + 1);
}

export const TEACUP_COUNT = 6;
export const MAD_HATTER_INDEX = 3; // 4th from the top (0-based)

// ==========================================================
// Poker
// ==========================================================

export type PokerCategory =
    'highcard' | 'pair' | 'twopair' | 'trips' | 'straight' | 'flush' | 'fullhouse' | 'quads' | 'straightflush';

export const POKER_VP: Record<PokerCategory, number> = {
    highcard: 0, pair: 3, twopair: 6, trips: 9, straight: 12,
    flush: 15, fullhouse: 18, quads: 21, straightflush: 24
};

export const POKER_LABELS: Record<PokerCategory, string> = {
    highcard: 'High Card', pair: 'One Pair', twopair: 'Two Pair', trips: 'Three of a Kind',
    straight: 'Straight', flush: 'Flush', fullhouse: 'Full House', quads: 'Four of a Kind',
    straightflush: 'Straight Flush'
};

export interface PokerResult {
    category: PokerCategory;
    vp: number;
    cards: Card[];       // the best 5
    strength: number;    // comparable score for tie-breaking
}

// ==========================================================
// Serialisable player sheet
// ==========================================================

export interface MushroomState {
    id: string;
    marks: (number | null)[]; // ordered left->right, length == size
}

export interface PlayerSheet {
    meadow: MushroomState[];
    woods: Record<string, number | null>;   // TreeId -> mark
    keep: Record<string, number | null>;    // cellId -> mark
    teacups: number[];                       // per-tag state: 0 unmarked / 1 available / 2 consumed
    guests: Guest[];                         // checked wonderlandians
    setAside: Card[];                        // 2 per round
}

// A pending mark awaiting the player's placement decision. The queue head is the
// active mark; biscuits/red-keep frees push to the front so cascades resolve first.
export interface PendingMark {
    kind: 'rank' | 'biscuit' | 'freeMeadow' | 'freeWoods';
    zone?: Zone;             // rank: forced zone; free: fixed zone
    originZone?: Zone;       // biscuit: the zone it repeats FROM (destination must differ)
    value?: number;          // biscuit / free: the exact value to write (frozen)
    color?: Color;           // biscuit: exact colour to repeat
    relaxed?: boolean;       // free marks bypass colour + leftmost/adjacency rules
}

export interface PlayerMarkState {
    card: Card;
    position: Position;
    queue: PendingMark[];
    done: boolean;
}

export interface PlayerScore {
    meadow: number;
    woods: number;
    woodsAll18: boolean;
    woodsJabberwock: boolean;
    keep: number;
    keepCenter: boolean;
    teaParty: number;
    guestCount: number;
    poker: PokerResult | null;
    pokerBonus: number;
    total: number;
}

export interface ScoreResult {
    players: Record<string, PlayerScore>;
    winnerIds: string[];
    topPokerIds: string[];
}

export interface LastMove {
    playerId: string;
    kind: 'select' | 'mark' | 'reveal' | 'bout' | 'round' | 'gameOver' | 'start';
    desc: string;
    moveId: number;
    zone?: Zone;
    guest?: Guest;
}

export interface GameStateData {
    status: Status;
    playerIds: string[];
    numPlayers: number;

    round: number;      // 1..3
    bout: number;       // 1..7 within the round
    queenIndex: number; // 0..3 over SUIT_ORDER, advances every bout (continuous)

    hands: Record<string, Card[]>;
    deck: Card[];                         // remainder after dealing; source of extras
    selections: Record<string, string | null>;  // hidden card picks for the current bout

    // The revealed bout: player cards, extra ranking-only cards, and positions.
    reveal: {
        playerCards: Record<string, Card>;
        extras: Card[];
        positions: Record<string, Position>;
        rankedIds: string[]; // ordered high->low, for display
    } | null;

    marks: Record<string, PlayerMarkState | null>; // per-player active marking
    sheets: Record<string, PlayerSheet>;

    lastMove: LastMove | null;
    moveCounter: number;

    score: ScoreResult | null;
    winnerIds: string[];
}

// ==========================================================
// Utilities
// ==========================================================

function randInt(n: number): number {
    return Math.floor(Math.random() * n);
}
function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = randInt(i + 1);
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function freshSheet(): PlayerSheet {
    const meadow = MEADOW_DEF.map(m => ({ id: m.id, marks: Array(m.size).fill(null) as (number | null)[] }));
    const woods: Record<string, number | null> = {};
    TREE_IDS.forEach(t => { woods[t] = null; });
    const keep: Record<string, number | null> = {};
    KEEP_CELLS.forEach(c => { keep[c.id] = null; });
    const teacups = Array(TEACUP_COUNT).fill(0) as number[];
    teacups[0] = 1; // top teacup starts available
    return { meadow, woods, keep, teacups, guests: [], setAside: [] };
}

// Extra ranking-only cards added to a bout, by player count.
export function extraCounts(numPlayers: number): { faceUp: number; faceDown: number } {
    if (numPlayers === 2) return { faceUp: 1, faceDown: 1 };
    if (numPlayers === 3) return { faceUp: 1, faceDown: 0 };
    return { faceUp: 0, faceDown: 0 };
}

// Adjacency maps built once from the edge lists.
const WOODS_ADJ: Record<string, string[]> = (() => {
    const m: Record<string, string[]> = {};
    TREE_IDS.forEach(t => { m[t] = []; });
    WOODS_EDGES.forEach(([a, b]) => { m[a].push(b); m[b].push(a); });
    return m;
})();

const KEEP_ADJ: Record<string, string[]> = (() => {
    const m: Record<string, string[]> = {};
    KEEP_CELLS.forEach(c => { m[c.id] = []; });
    KEEP_EDGES.forEach(([a, b]) => { m[a].push(b); m[b].push(a); });
    return m;
})();

export function woodsNeighbors(t: string): string[] { return WOODS_ADJ[t] || []; }
export function keepNeighbors(c: string): string[] { return KEEP_ADJ[c] || []; }

const KEEP_CELL_BY_ID: Record<string, KeepCellDef> = (() => {
    const m: Record<string, KeepCellDef> = {};
    KEEP_CELLS.forEach(c => { m[c.id] = c; });
    return m;
})();

const MUSHROOM_BY_ID: Record<string, MushroomDef> = (() => {
    const m: Record<string, MushroomDef> = {};
    MEADOW_DEF.forEach(d => { m[d.id] = d; });
    return m;
})();

function colorMatches(cardColor: Color, spaceColor: Color): boolean {
    if (spaceColor === 'both') return true;
    return cardColor === spaceColor;
}

// ==========================================================
// Game state
// ==========================================================

export class OffWithTheirHeadsGameState {
    private data: GameStateData;
    private readonly playerIds: string[];

    constructor(playerIds: string[]) {
        this.playerIds = [...playerIds];
        this.data = {
            status: 'Setup',
            playerIds: [...playerIds],
            numPlayers: playerIds.length,
            round: 0,
            bout: 0,
            queenIndex: 0,
            hands: {},
            deck: [],
            selections: {},
            reveal: null,
            marks: {},
            sheets: {},
            lastMove: null,
            moveCounter: 0,
            score: null,
            winnerIds: []
        };
        for (const pid of playerIds) {
            this.data.hands[pid] = [];
            this.data.selections[pid] = null;
            this.data.marks[pid] = null;
            this.data.sheets[pid] = freshSheet();
        }
    }

    public static from_data(data: GameStateData, playerIds: string[]): OffWithTheirHeadsGameState {
        const gs = new OffWithTheirHeadsGameState(playerIds);
        gs.data = JSON.parse(JSON.stringify(data));
        return gs;
    }

    public get_data(): GameStateData {
        return JSON.parse(JSON.stringify(this.data));
    }

    private touch(move: Omit<LastMove, 'moveId'>) {
        this.data.lastMove = { ...move, moveId: ++this.data.moveCounter };
    }

    // ==========================================================
    // Setup / rounds
    // ==========================================================

    public start_game() {
        const n = this.playerIds.length;
        if (n < 2 || n > 4) throw new Error('Off With Their Heads supports 2 to 4 players');
        for (const pid of this.playerIds) this.data.sheets[pid] = freshSheet();
        this.data.queenIndex = 0;
        this.data.score = null;
        this.data.winnerIds = [];
        this.data.moveCounter = 0;
        this.start_round(1);
        this.touch({ playerId: this.playerIds[0], kind: 'start', desc: 'The croquet begins' });
    }

    private start_round(round: number) {
        this.data.round = round;
        this.data.bout = 1;
        let deck = shuffle(buildDeck());
        for (const pid of this.playerIds) {
            this.data.hands[pid] = deck.splice(0, 9);
            this.data.selections[pid] = null;
            this.data.marks[pid] = null;
        }
        this.data.deck = deck;
        this.data.reveal = null;
        this.data.status = 'Selecting';
    }

    // ==========================================================
    // Wonderland Board helpers
    // ==========================================================

    public queenSuit(): Suit {
        return SUIT_ORDER[this.data.queenIndex % 4];
    }

    // 0 = highest suit; +1 clockwise.
    private suitRank(suit: Suit): number {
        return (SUIT_ORDER.indexOf(suit) - this.data.queenIndex % 4 + 4) % 4;
    }

    // >0 if a outranks b under the current hierarchy.
    private beats(a: Card, b: Card): number {
        const sa = this.suitRank(a.suit);
        const sb = this.suitRank(b.suit);
        if (sa !== sb) return sb - sa; // smaller suitRank is higher
        return rankValue(a.rank) - rankValue(b.rank);
    }

    // ==========================================================
    // Bout selection
    // ==========================================================

    public select_card(playerId: string, cid: string) {
        if (this.data.status !== 'Selecting') throw new Error('Not in the selection phase');
        if (!this.playerIds.includes(playerId)) throw new Error('Unknown player');
        const hand = this.data.hands[playerId];
        if (!hand.some(c => cardId(c) === cid)) throw new Error('That card is not in your hand');
        this.data.selections[playerId] = cid;
        this.touch({ playerId, kind: 'select', desc: 'played a card face-down' });

        if (this.playerIds.every(p => this.data.selections[p])) {
            this.reveal_bout();
        }
    }

    // A player may withdraw their pick while others are still deciding.
    public unselect_card(playerId: string) {
        if (this.data.status !== 'Selecting') throw new Error('Not in the selection phase');
        this.data.selections[playerId] = null;
    }

    private reveal_bout() {
        const playerCards: Record<string, Card> = {};
        for (const pid of this.playerIds) {
            const cid = this.data.selections[pid]!;
            const hand = this.data.hands[pid];
            const idx = hand.findIndex(c => cardId(c) === cid);
            playerCards[pid] = hand[idx];
            hand.splice(idx, 1);
        }

        const { faceUp, faceDown } = extraCounts(this.playerIds.length);
        const extras: Card[] = this.data.deck.splice(0, faceUp + faceDown);

        // Rank every card in the bout (players + extras); strict total order.
        const entries: { owner: string | null; card: Card }[] = [];
        this.playerIds.forEach(pid => entries.push({ owner: pid, card: playerCards[pid] }));
        extras.forEach(card => entries.push({ owner: null, card }));
        entries.sort((x, y) => this.beats(y.card, x.card)); // descending (high first)

        const positions: Record<string, Position> = {};
        const highOwner = entries[0].owner;
        const lowOwner = entries[entries.length - 1].owner;
        for (const pid of this.playerIds) {
            if (pid === highOwner) positions[pid] = 'high';
            else if (pid === lowOwner) positions[pid] = 'low';
            else positions[pid] = 'mid';
        }

        this.data.reveal = {
            playerCards,
            extras,
            positions,
            rankedIds: entries.map(e => cardId(e.card))
        };

        // Create each player's mandatory mark.
        for (const pid of this.playerIds) {
            const pos = positions[pid];
            this.data.marks[pid] = {
                card: playerCards[pid],
                position: pos,
                queue: [{ kind: 'rank', zone: POSITION_ZONE[pos] }],
                done: false
            };
        }
        this.data.status = 'Marking';
        this.data.selections = {};
        this.playerIds.forEach(p => { this.data.selections[p] = null; });
        this.touch({ playerId: highOwner || this.playerIds[0], kind: 'reveal', desc: 'the cards are revealed' });
    }

    // ==========================================================
    // Marking
    // ==========================================================

    // The active pending mark for a player (queue head), or null if done.
    public head_mark(playerId: string): PendingMark | null {
        const ms = this.data.marks[playerId];
        if (!ms || ms.done || ms.queue.length === 0) return null;
        return ms.queue[0];
    }

    // Resolve the current pending mark by placing it. `sel` names the destination.
    //   sel.zone     — target zone (rank marks: the forced zone unless a teacup
    //                  zone-override is used; free/biscuit: chosen zone).
    //   sel.spaceId  — mushroom id (meadow) / tree label (woods) / cell id (keep).
    //   sel.aceValue — 1 or 11, required when placing an Ace's rank mark.
    //   sel.teacup   — consume a teacup for this rank mark: {mode:'zone'|'color'}.
    public resolve_mark(playerId: string, sel: {
        zone: Zone;
        spaceId: string;
        aceValue?: number;
        teacup?: { mode: 'zone' | 'color' } | null;
    }) {
        if (this.data.status !== 'Marking') throw new Error('Not in the marking phase');
        const ms = this.data.marks[playerId];
        if (!ms || ms.done) throw new Error('You have no mark to place');
        const mark = ms.queue[0];
        if (!mark) throw new Error('You have no mark to place');

        const sheet = this.data.sheets[playerId];

        // Resolve value + colour + destination-zone constraint for this mark.
        let value: number;
        let color: Color;
        const relaxed = !!mark.relaxed;

        if (mark.kind === 'rank') {
            const card = ms.card;
            if (card.rank === 'A') {
                if (sel.aceValue !== 1 && sel.aceValue !== 11) throw new Error('Choose 1 or 11 for the Ace');
                value = sel.aceValue;
            } else {
                value = defaultMarkValue(card.rank);
            }
            color = cardColor(card);

            // Teacup application (rank marks only).
            let allowedZone: Zone | 'any' = mark.zone!;
            if (sel.teacup) {
                if (!this.hasAvailableTeacup(sheet)) throw new Error('No teacup available to consume');
                if (sel.teacup.mode === 'zone') allowedZone = 'any';
                else if (sel.teacup.mode === 'color') color = color === 'red' ? 'black' : 'red';
            }
            if (allowedZone !== 'any' && sel.zone !== allowedZone) {
                throw new Error('That mark must go in its forced zone (or spend a teacup to move it)');
            }
        } else if (mark.kind === 'biscuit') {
            value = mark.value!;
            color = mark.color!;
            if (sel.zone === mark.originZone) throw new Error('A biscuit repeats the mark in a DIFFERENT zone');
        } else {
            // freeMeadow / freeWoods
            value = mark.value!;
            color = 'both'; // any colour
            const fixed: Zone = mark.kind === 'freeMeadow' ? 'meadow' : 'woods';
            if (sel.zone !== fixed) throw new Error('This free mark is fixed to its zone');
        }

        // Validate the destination is a legal placement for this (zone,value,colour).
        const legal = this.legalForZone(sheet, sel.zone, value, color, relaxed);
        if (!legal.includes(sel.spaceId)) throw new Error('That is not a legal placement for this mark');

        // Place, collecting any icon/centre effects triggered.
        const effects = this.placeMark(sheet, sel.zone, sel.spaceId, value, color, relaxed);

        // Consume the teacup only after a successful rank placement that used one.
        if (mark.kind === 'rank' && sel.teacup) this.consumeTeacup(sheet);

        // Pop the resolved mark, then push triggered effects to the FRONT so a
        // cascade (biscuit -> biscuit, red-keep -> two frees) resolves before the
        // rest of the queue.
        ms.queue.shift();
        if (effects.length) ms.queue.unshift(...effects);

        this.refreshGuests(sheet);
        this.touch({ playerId, kind: 'mark', desc: `marked the ${zoneLabel(sel.zone)}`, zone: sel.zone });

        if (ms.queue.length === 0) ms.done = true;
        this.maybeEndBout();
    }

    // Skip the current mark (it is lost). Permitted only when the mark truly has no
    // legal placement anywhere it is allowed to go.
    public skip_mark(playerId: string) {
        if (this.data.status !== 'Marking') throw new Error('Not in the marking phase');
        const ms = this.data.marks[playerId];
        if (!ms || ms.done) throw new Error('You have no mark to skip');
        const targets = this.get_legal_targets(playerId);
        const total = targets.meadow.length + targets.woods.length + targets.keep.length;
        if (total > 0) throw new Error('You have a legal placement — you must mark it');
        ms.queue.shift();
        this.touch({ playerId, kind: 'mark', desc: 'lost a mark (no legal space)' });
        if (ms.queue.length === 0) ms.done = true;
        this.maybeEndBout();
    }

    // Enumerate legal placements for the player's current pending mark, per zone.
    // Meadow -> mushroom ids; Woods -> tree ids; Keep -> cell ids. Respects the
    // mark's zone constraint (rank forced zone, biscuit != origin, free fixed zone)
    // WITHOUT any teacup (the teacup-expanded set is computed by the view/legal
    // check on demand via `teacupTargets`).
    public get_legal_targets(playerId: string): { meadow: string[]; woods: string[]; keep: string[] } {
        const mark = this.head_mark(playerId);
        const empty = { meadow: [] as string[], woods: [] as string[], keep: [] as string[] };
        if (!mark) return empty;
        const ms = this.data.marks[playerId]!;
        const sheet = this.data.sheets[playerId];

        let value: number;
        let color: Color;
        const relaxed = !!mark.relaxed;
        const allowed: Record<Zone, boolean> = { meadow: false, woods: false, keep: false };

        if (mark.kind === 'rank') {
            const card = ms.card;
            value = card.rank === 'A' ? 11 : defaultMarkValue(card.rank);
            color = cardColor(card);
            allowed[mark.zone!] = true;
        } else if (mark.kind === 'biscuit') {
            value = mark.value!;
            color = mark.color!;
            (['meadow', 'woods', 'keep'] as Zone[]).forEach(z => { if (z !== mark.originZone) allowed[z] = true; });
        } else {
            value = mark.value!;
            color = 'both';
            allowed[mark.kind === 'freeMeadow' ? 'meadow' : 'woods'] = true;
        }

        return {
            meadow: allowed.meadow ? this.legalMeadow(sheet, value, color, relaxed) : [],
            woods: allowed.woods ? this.legalWoods(sheet, color, relaxed) : [],
            keep: allowed.keep ? this.legalKeep(sheet, color, relaxed) : []
        };
    }

    // Legal placements if the player spends a teacup to change zone (rank marks
    // only): the mark may go into ANY zone. Returns legal targets across all zones.
    public get_teacup_zone_targets(playerId: string): { meadow: string[]; woods: string[]; keep: string[] } {
        const mark = this.head_mark(playerId);
        const empty = { meadow: [] as string[], woods: [] as string[], keep: [] as string[] };
        if (!mark || mark.kind !== 'rank') return empty;
        const ms = this.data.marks[playerId]!;
        const sheet = this.data.sheets[playerId];
        const card = ms.card;
        const value = card.rank === 'A' ? 11 : defaultMarkValue(card.rank);
        const color = cardColor(card);
        return {
            meadow: this.legalMeadow(sheet, value, color, false),
            woods: this.legalWoods(sheet, color, false),
            keep: this.legalKeep(sheet, color, false)
        };
    }

    // Legal placements in the forced zone if the player spends a teacup to treat
    // their card as the OTHER colour (rank marks only).
    public get_teacup_color_targets(playerId: string): { meadow: string[]; woods: string[]; keep: string[] } {
        const mark = this.head_mark(playerId);
        const empty = { meadow: [] as string[], woods: [] as string[], keep: [] as string[] };
        if (!mark || mark.kind !== 'rank') return empty;
        const ms = this.data.marks[playerId]!;
        const sheet = this.data.sheets[playerId];
        const card = ms.card;
        const value = card.rank === 'A' ? 11 : defaultMarkValue(card.rank);
        const flipped: Color = cardColor(card) === 'red' ? 'black' : 'red';
        const zone = mark.zone!;
        return {
            meadow: zone === 'meadow' ? this.legalMeadow(sheet, value, flipped, false) : [],
            woods: zone === 'woods' ? this.legalWoods(sheet, flipped, false) : [],
            keep: zone === 'keep' ? this.legalKeep(sheet, flipped, false) : []
        };
    }

    // ---- legality per zone ----

    private legalForZone(sheet: PlayerSheet, zone: Zone, value: number, color: Color, relaxed: boolean): string[] {
        if (zone === 'meadow') return this.legalMeadow(sheet, value, color, relaxed);
        if (zone === 'woods') return this.legalWoods(sheet, color, relaxed);
        return this.legalKeep(sheet, color, relaxed);
    }

    private legalMeadow(sheet: PlayerSheet, value: number, color: Color, relaxed: boolean): string[] {
        const out: string[] = [];
        for (const m of sheet.meadow) {
            const def = MUSHROOM_BY_ID[m.id];
            if (!relaxed && !colorMatches(color, def.color)) continue;
            const open = m.marks.findIndex(x => x === null);
            if (open < 0) continue;                             // full
            if (m.marks.some(x => x === value)) continue;       // uniqueness within mushroom
            out.push(m.id);
        }
        return out;
    }

    private legalWoods(sheet: PlayerSheet, color: Color, relaxed: boolean): string[] {
        const out: string[] = [];
        for (const t of TREE_IDS) {
            if (sheet.woods[t] !== null) continue;
            if (!relaxed && !colorMatches(color, TREE_COLORS[t])) continue;
            out.push(t);
        }
        return out;
    }

    private legalKeep(sheet: PlayerSheet, color: Color, relaxed: boolean): string[] {
        // Keep marks always carry a concrete colour (rank cards are red or black;
        // biscuits inherit that colour). Free marks never target the Keep, so the
        // 'both'/relaxed path here is defensive only.
        const out: string[] = [];
        const redSeeded = sheet.keep[KEEP_RED_ENTRANCE] !== null;
        const blackSeeded = sheet.keep[KEEP_BLACK_ENTRANCE] !== null;

        for (const c of KEEP_CELLS) {
            if (sheet.keep[c.id] !== null) continue;
            if (!relaxed && !colorMatches(color, c.color)) continue;

            let ok = false;
            // Entrance seeding: the first mark of a colour lands on that colour's
            // entrance; subsequent marks extend from any existing mark.
            if (!relaxed && color === 'red' && c.id === KEEP_RED_ENTRANCE && !redSeeded) ok = true;
            if (!relaxed && color === 'black' && c.id === KEEP_BLACK_ENTRANCE && !blackSeeded) ok = true;
            if (keepNeighbors(c.id).some(n => sheet.keep[n] !== null)) ok = true;
            if (relaxed) ok = true;

            if (ok) out.push(c.id);
        }
        return out;
    }

    // ---- placement (assumes legality already validated by the caller path) ----

    // Returns any follow-up PendingMarks triggered (biscuit repeat, red-keep frees).
    private placeMark(sheet: PlayerSheet, zone: Zone, spaceId: string, value: number, color: Color, relaxed: boolean): PendingMark[] {
        const effects: PendingMark[] = [];
        if (zone === 'meadow') {
            const m = sheet.meadow.find(x => x.id === spaceId);
            if (!m) throw new Error('Unknown mushroom');
            const def = MUSHROOM_BY_ID[spaceId];
            if (!relaxed && !colorMatches(color, def.color)) throw new Error('Colour does not match this mushroom');
            const idx = m.marks.findIndex(x => x === null);
            if (idx < 0) throw new Error('That mushroom is full');
            if (m.marks.some(x => x === value)) throw new Error('That number is already in this mushroom');
            m.marks[idx] = value;
            if (def.teacupSpaces.includes(idx)) this.gainTeacup(sheet);
            if (def.biscuitSpaces.includes(idx)) effects.push(this.biscuitMark(value, color, 'meadow'));
        } else if (zone === 'woods') {
            if (!(spaceId in sheet.woods)) throw new Error('Unknown tree');
            if (sheet.woods[spaceId] !== null) throw new Error('That tree is already marked');
            if (!relaxed && !colorMatches(color, TREE_COLORS[spaceId as TreeId])) throw new Error('Colour does not match this tree');
            sheet.woods[spaceId] = value;
            if (WOODS_TEACUP_TREES.includes(spaceId as TreeId)) this.gainTeacup(sheet);
            if (WOODS_BISCUIT_TREES.includes(spaceId as TreeId)) effects.push(this.biscuitMark(value, color, 'woods'));
        } else {
            const def = KEEP_CELL_BY_ID[spaceId];
            if (!def) throw new Error('Unknown keep cell');
            if (sheet.keep[spaceId] !== null) throw new Error('That cell is already marked');
            if (!relaxed && !colorMatches(color, def.color)) throw new Error('Colour does not match this cell');
            sheet.keep[spaceId] = value;
            if (def.teacup) this.gainTeacup(sheet);
            if (def.biscuit) effects.push(this.biscuitMark(value, color, 'keep'));
            if (def.isCenter) {
                // Red Keep: one free Meadow mark and one free Woods mark (any).
                effects.push({ kind: 'freeMeadow', value, relaxed: true });
                effects.push({ kind: 'freeWoods', value, relaxed: true });
            }
        }
        return effects;
    }

    private biscuitMark(value: number, color: Color, origin: Zone): PendingMark {
        const c: Color = color === 'both' ? 'both' : color;
        return { kind: 'biscuit', value, color: c, originZone: origin };
    }

    // ---- teacups ----

    private hasAvailableTeacup(sheet: PlayerSheet): boolean {
        return sheet.teacups.some(s => s === 1);
    }
    private gainTeacup(sheet: PlayerSheet) {
        const idx = sheet.teacups.findIndex(s => s === 0);
        if (idx >= 0) sheet.teacups[idx] = 1;
    }
    private consumeTeacup(sheet: PlayerSheet) {
        const idx = sheet.teacups.findIndex(s => s === 1);
        if (idx >= 0) sheet.teacups[idx] = 2;
    }

    // ---- wonderlandians ----

    private refreshGuests(sheet: PlayerSheet) {
        const has = (g: Guest) => sheet.guests.includes(g);
        const add = (g: Guest) => { if (!has(g)) sheet.guests.push(g); };

        // Caterpillar — any mushroom fully marked.
        if (sheet.meadow.some(m => m.marks.every(x => x !== null))) add('caterpillar');
        // Cheshire Cat — a mark in 3 different mushrooms.
        if (sheet.meadow.filter(m => m.marks.some(x => x !== null)).length >= 3) add('cheshire');
        // Dormouse — all 4 'both' trees.
        if (DORMOUSE_TREES.every(t => sheet.woods[t] !== null)) add('dormouse');
        // March Hare — the 3 trees around the centre node.
        if (MARCH_HARE_TREES.every(t => sheet.woods[t] !== null)) add('marchhare');
        // Humpty Dumpty / White Rabbit — the named adjacent cells.
        if (sheet.keep[KEEP_HUMPTY_CELL] !== null) add('humpty');
        if (sheet.keep[KEEP_RABBIT_CELL] !== null) add('rabbit');
        // Mad Hatter — reached the 4th teacup (available or consumed).
        if (sheet.teacups[MAD_HATTER_INDEX] >= 1) add('madhatter');
    }

    // ==========================================================
    // Bout / round advancement
    // ==========================================================

    private maybeEndBout() {
        if (!this.playerIds.every(p => this.data.marks[p]?.done)) return;

        // Discard, advance the Queen, next bout.
        this.data.queenIndex = (this.data.queenIndex + 1) % 4;
        this.data.reveal = null;
        for (const pid of this.playerIds) this.data.marks[pid] = null;

        if (this.data.bout >= 7) {
            this.end_round();
            return;
        }
        this.data.bout += 1;
        this.data.status = 'Selecting';
        this.touch({ playerId: this.playerIds[0], kind: 'bout', desc: `Bout ${this.data.bout} of round ${this.data.round}` });
    }

    private end_round() {
        // Each player sets aside their 2 remaining hand cards.
        for (const pid of this.playerIds) {
            this.data.sheets[pid].setAside.push(...this.data.hands[pid]);
            this.data.hands[pid] = [];
        }
        if (this.data.round >= 3) {
            this.finish_game();
            return;
        }
        this.start_round(this.data.round + 1);
        this.touch({ playerId: this.playerIds[0], kind: 'round', desc: `Round ${this.data.round} begins` });
    }

    // ==========================================================
    // Final scoring
    // ==========================================================

    public finish_game() {
        this.data.score = this.computeScore();
        this.data.winnerIds = this.data.score.winnerIds;
        this.data.status = 'GameOver';
        this.data.reveal = null;
        this.touch({ playerId: this.data.winnerIds[0] || this.playerIds[0], kind: 'gameOver', desc: 'The Queen renders her verdict' });
    }

    private computeScore(): ScoreResult {
        const players: Record<string, PlayerScore> = {};
        const pokerResults: Record<string, PokerResult | null> = {};

        for (const pid of this.playerIds) {
            const sheet = this.data.sheets[pid];
            const meadow = this.scoreMeadow(sheet);
            const woods = this.scoreWoods(sheet);
            const keep = this.scoreKeep(sheet);
            const guestCount = sheet.guests.length;
            const teaParty = teaPartyVP(guestCount);
            const poker = sheet.setAside.length >= 5 ? bestPokerHand(sheet.setAside) : null;
            pokerResults[pid] = poker;

            players[pid] = {
                meadow: meadow.total,
                woods: woods.total,
                woodsAll18: woods.all18,
                woodsJabberwock: woods.jabberwock,
                keep: keep.total,
                keepCenter: keep.center,
                teaParty,
                guestCount,
                poker,
                pokerBonus: 0,
                total: meadow.total + woods.total + keep.total + teaParty + (poker ? poker.vp : 0)
            };
        }

        // Highest poker hand gets +5 (ties broken by strength; genuine ties share).
        let topPokerIds: string[] = [];
        let bestStrength = -1;
        for (const pid of this.playerIds) {
            const pr = pokerResults[pid];
            if (!pr) continue;
            if (pr.strength > bestStrength) { bestStrength = pr.strength; topPokerIds = [pid]; }
            else if (pr.strength === bestStrength) topPokerIds.push(pid);
        }
        for (const pid of topPokerIds) {
            players[pid].pokerBonus = 5;
            players[pid].total += 5;
        }

        let best = -Infinity;
        for (const pid of this.playerIds) best = Math.max(best, players[pid].total);
        let winnerIds = this.playerIds.filter(pid => players[pid].total === best);
        // Overall tie-break: best poker hand.
        if (winnerIds.length > 1) {
            let bs = -1;
            let tied: string[] = [];
            for (const pid of winnerIds) {
                const s = players[pid].poker ? players[pid].poker!.strength : -1;
                if (s > bs) { bs = s; tied = [pid]; }
                else if (s === bs) tied.push(pid);
            }
            winnerIds = tied;
        }

        return { players, winnerIds, topPokerIds };
    }

    public scoreMeadow(sheet: PlayerSheet): { total: number; completed: string[] } {
        let total = 0;
        const completed: string[] = [];
        for (const m of sheet.meadow) {
            if (m.marks.every(x => x !== null)) {
                total += MUSHROOM_BY_ID[m.id].vp;
                completed.push(m.id);
            }
        }
        return { total, completed };
    }

    public scoreWoods(sheet: PlayerSheet): {
        total: number; all18: boolean; jabberwock: boolean;
        scoredNodes: string[]; nodeBase: number; doublingBonus: number;
    } {
        const marked = (t: string) => sheet.woods[t] !== null;
        const all18 = TREE_IDS.every(t => marked(t));

        // Jabberwock: no two adjacent MARKED trees share the same mark value
        // (10/J/Q/K already collapse to 10 at mark time). Broken anywhere -> no
        // doubling at all.
        let jabberwock = true;
        for (const [a, b] of WOODS_EDGES) {
            if (marked(a) && marked(b) && sheet.woods[a] === sheet.woods[b]) { jabberwock = false; break; }
        }

        let nodeBase = 0;
        let doublingBonus = 0;
        const scoredNodes: string[] = [];
        for (const node of WOODS_NODES) {
            if (!node.trees.every(t => marked(t))) continue;
            scoredNodes.push(node.id);
            nodeBase += node.vp;
            if (node.starred && jabberwock) doublingBonus += node.vp; // doubled => +vp
        }

        const total = nodeBase + doublingBonus + (all18 ? WOODS_ALL18_BONUS : 0);
        return { total, all18, jabberwock, scoredNodes, nodeBase, doublingBonus };
    }

    public scoreKeep(sheet: PlayerSheet): { total: number; center: boolean; coinTotal: number } {
        let coinTotal = 0;
        for (const c of KEEP_CELLS) {
            if (c.isCoin && sheet.keep[c.id] !== null) coinTotal += sheet.keep[c.id] as number;
        }
        const center = sheet.keep['c12'] !== null;
        return { total: coinTotal + (center ? 2 : 0), center, coinTotal };
    }

    // ==========================================================
    // Getters
    // ==========================================================

    public get_status(): Status { return this.data.status; }
    public get_hand(pid: string): Card[] { return [...(this.data.hands[pid] || [])]; }
    public get_sheet(pid: string): PlayerSheet { return JSON.parse(JSON.stringify(this.data.sheets[pid])); }
    public get_score(): ScoreResult | null { return this.data.score ? JSON.parse(JSON.stringify(this.data.score)) : null; }
}

// ==========================================================
// Free helpers (also handy to unit test)
// ==========================================================

export function zoneLabel(z: Zone): string {
    return z === 'meadow' ? 'Meadow' : z === 'woods' ? 'Woods' : 'Keep';
}

// Best 5-card poker hand out of the given cards (usually 6). Returns category, VP,
// the chosen 5 cards, and a comparable strength for tie-breaking.
export function bestPokerHand(cards: Card[]): PokerResult {
    if (cards.length < 5) {
        return { category: 'highcard', vp: 0, cards: [...cards], strength: 0 };
    }
    let best: PokerResult | null = null;
    const combos = choose5(cards);
    for (const five of combos) {
        const r = evaluate5(five);
        if (!best || r.strength > best.strength) best = r;
    }
    return best!;
}

function choose5(cards: Card[]): Card[][] {
    const res: Card[][] = [];
    const n = cards.length;
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            for (let k = j + 1; k < n; k++) {
                for (let l = k + 1; l < n; l++) {
                    for (let m = l + 1; m < n; m++) {
                        res.push([cards[i], cards[j], cards[k], cards[l], cards[m]]);
                    }
                }
            }
        }
    }
    return res;
}

// Poker suit tie-break "as if the Queen were on Hearts": H>C>D>S.
const POKER_SUIT_RANK: Record<Suit, number> = { H: 3, C: 2, D: 1, S: 0 };

function evaluate5(cards: Card[]): PokerResult {
    const vals = cards.map(c => rankValue(c.rank)).sort((a, b) => b - a);
    const suits = cards.map(c => c.suit);
    const isFlush = suits.every(s => s === suits[0]);

    // Straight detection (Ace high or low).
    const uniq = Array.from(new Set(vals)).sort((a, b) => b - a);
    let straightHigh = 0;
    if (uniq.length === 5) {
        if (uniq[0] - uniq[4] === 4) straightHigh = uniq[0];
        // Ace-low: A,5,4,3,2 -> treat as high 5.
        else if (uniq[0] === 14 && uniq[1] === 5 && uniq[2] === 4 && uniq[3] === 3 && uniq[4] === 2) straightHigh = 5;
    }
    const isStraight = straightHigh > 0;

    // Rank multiplicities.
    const counts: Record<number, number> = {};
    vals.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
    const groups = Object.keys(counts).map(k => ({ v: parseInt(k, 10), c: counts[parseInt(k, 10)] }))
        .sort((a, b) => (b.c - a.c) || (b.v - a.v));

    let category: PokerCategory;
    if (isStraight && isFlush) category = 'straightflush';
    else if (groups[0].c === 4) category = 'quads';
    else if (groups[0].c === 3 && groups[1] && groups[1].c === 2) category = 'fullhouse';
    else if (isFlush) category = 'flush';
    else if (isStraight) category = 'straight';
    else if (groups[0].c === 3) category = 'trips';
    else if (groups[0].c === 2 && groups[1] && groups[1].c === 2) category = 'twopair';
    else if (groups[0].c === 2) category = 'pair';
    else category = 'highcard';

    // Strength: category rank dominates, then kicker values, then top-card suit.
    const CAT_ORDER: PokerCategory[] = ['highcard', 'pair', 'twopair', 'trips', 'straight', 'flush', 'fullhouse', 'quads', 'straightflush'];
    let strength = CAT_ORDER.indexOf(category) * 1e10;
    if (isStraight && !['fullhouse', 'quads'].includes(category)) {
        strength += straightHigh * 1e8;
    } else {
        // Group values weighted by multiplicity then descending value.
        let w = 1e8;
        for (const g of groups) { strength += g.v * w; w /= 100; }
    }
    // Top-card suit tiebreak.
    const topVal = groups[0].v;
    const topSuit = cards.filter(c => rankValue(c.rank) === topVal)
        .reduce((best, c) => Math.max(best, POKER_SUIT_RANK[c.suit]), 0);
    strength += topSuit;

    return { category, vp: POKER_VP[category], cards: [...cards], strength };
}

export default OffWithTheirHeadsGameState;
