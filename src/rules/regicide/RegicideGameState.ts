/**
 * RegicideGameState.ts - Standalone game engine for "Regicide".
 *
 * Regicide is a cooperative card game for 1-4 players. Players share the goal of
 * defeating twelve enemies in order (4 Jacks -> 4 Queens -> 4 Kings). Each turn a
 * player plays a card (or a valid combo) at the current enemy, resolves the
 * played suit powers, deals damage, then suffers the enemy's counter-attack by
 * discarding cards. The team wins when the last King falls; it loses the moment a
 * player cannot cover the damage or cannot take a legal turn.
 *
 * This class is pure (no React / Multiplayr / network dependencies). It is
 * serialised to JSON between host ticks, so it exposes get_data / from_data
 * rehydration helpers exactly like the other decoupled game states.
 */

export enum Phase {
    Lobby = 'Lobby',
    Play = 'Play',
    Won = 'Won',
    Lost = 'Lost'
}

// Suits carry the four powers. Jesters have no suit (suit === null).
export type Suit = 'H' | 'D' | 'C' | 'S';
export const SUITS: Suit[] = ['H', 'D', 'C', 'S'];

// rank: 0 = Jester, 1 = Ace (Animal Companion), 2-10 = pip, 11 = Jack,
// 12 = Queen, 13 = King.
export interface Card {
    id: string;
    suit: Suit | null;
    rank: number;
}

export type EnemyType = 'jack' | 'queen' | 'king';

export interface EnemyState {
    card: Card;
    type: EnemyType;
    suit: Suit;
    attack: number;             // base attack
    health: number;             // total health
    damage: number;             // cumulative damage dealt this fight
    spadesTotal: number;        // sum of all spade attack values played this fight
    immunityCancelled: boolean; // a Jester has cancelled this enemy's immunity
}

export type MoveKind =
    | 'start' | 'play' | 'combo' | 'jester' | 'yield'
    | 'damage' | 'defeat' | 'heal' | 'draw' | 'shield'
    | 'refill' | 'win' | 'lose';

export interface LastMove {
    playerId: string;
    desc: string;
    moveId: number;
    kind: MoveKind;
}

export interface PendingDamage {
    playerId: string;
    amount: number;   // effective attack still to be covered
}

// A discrete "the enemy struck a player" event. Purely presentational: it drives
// the shake / slash / damage-number animation on every client and never gates
// game logic. `attackId` is unique per strike so identical back-to-back attacks
// still animate.
export interface AttackEvent {
    playerId: string;
    amount: number;
    attackId: number;
}

// The mirror of AttackEvent: "a player struck the enemy". `amount` is the damage
// actually dealt (i.e. already doubled by Clubs), not the raw attack value.
export interface HitEvent {
    playerId: string;
    amount: number;
    hitId: number;
}

export interface GameStateData {
    status: Phase;
    playerIds: string[];
    numPlayers: number;
    solo: boolean;
    maxHandSize: number;

    hands: Record<string, Card[]>;
    tavernDeck: Card[];     // index 0 = top (next to draw)
    discardPile: Card[];
    castleDeck: Card[];     // index 0 = next enemy to reveal (Jacks first)

    currentEnemy: EnemyState | null;
    playedCards: Card[];    // every card played against the current enemy

    currentPlayerId: string;
    lastAction: Record<string, 'played' | 'yielded' | null>; // reset per enemy

    pendingDamage: PendingDamage | null;      // step 4: player must discard
    lastHit: HitEvent | null;                 // presentational: player -> enemy
    lastAttack: AttackEvent | null;           // presentational: enemy -> player
    awaitingJesterChoice: { playerId: string } | null; // Jester: pick next player

    soloJestersRemaining: number; // solo only
    jestersUsed: number;          // solo victory tier

    enemiesDefeated: number;
    winTier: 'gold' | 'silver' | 'bronze' | null; // solo win tier
    loseReason: string | null;

    lastMove: LastMove | null;
    moveCounter: number;
}

// ==========================================================
// Static tables
// ==========================================================

const HAND_SIZE: Record<number, number> = { 1: 8, 2: 7, 3: 6, 4: 5 };
const TAVERN_JESTERS: Record<number, number> = { 1: 0, 2: 0, 3: 1, 4: 2 };

export function maxHandSizeFor(numPlayers: number): number {
    return HAND_SIZE[numPlayers] || 5;
}

export function attackValue(card: Card): number {
    if (card.rank === 0) return 0;   // Jester
    if (card.rank <= 10) return card.rank; // Ace = 1, pips = face value
    if (card.rank === 11) return 10; // Jack
    if (card.rank === 12) return 15; // Queen
    return 20;                       // King
}

export function isJester(card: Card): boolean {
    return card.suit === null || card.rank === 0;
}

export function isAce(card: Card): boolean {
    return card.rank === 1;
}

export function enemyStatsFor(rank: number): { type: EnemyType; attack: number; health: number } {
    if (rank === 11) return { type: 'jack', attack: 10, health: 20 };
    if (rank === 12) return { type: 'queen', attack: 15, health: 30 };
    return { type: 'king', attack: 20, health: 40 };
}

export const SUIT_NAME: Record<Suit, string> = { H: 'Hearts', D: 'Diamonds', C: 'Clubs', S: 'Spades' };
export const SUIT_POWER: Record<Suit, string> = { H: 'Heal', D: 'Draw', C: 'Double Damage', S: 'Shield' };

export function rankLabel(rank: number): string {
    if (rank === 0) return 'Jester';
    if (rank === 1) return 'A';
    if (rank === 11) return 'J';
    if (rank === 12) return 'Q';
    if (rank === 13) return 'K';
    return String(rank);
}

export function cardLabel(card: Card): string {
    if (isJester(card)) return 'Jester';
    return `${rankLabel(card.rank)}${card.suit}`;
}

function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// ==========================================================
// Class
// ==========================================================

export class RegicideGameState {
    private data: GameStateData;
    private readonly playerIds: string[];

    constructor(playerIds: string[]) {
        this.playerIds = [...playerIds];
        const numPlayers = playerIds.length;
        this.data = {
            status: Phase.Lobby,
            playerIds: [...playerIds],
            numPlayers,
            solo: numPlayers === 1,
            maxHandSize: maxHandSizeFor(numPlayers),
            hands: {},
            tavernDeck: [],
            discardPile: [],
            castleDeck: [],
            currentEnemy: null,
            playedCards: [],
            currentPlayerId: '',
            lastAction: {},
            pendingDamage: null,
            lastHit: null,
            lastAttack: null,
            awaitingJesterChoice: null,
            soloJestersRemaining: 0,
            jestersUsed: 0,
            enemiesDefeated: 0,
            winTier: null,
            loseReason: null,
            lastMove: null,
            moveCounter: 0
        };
    }

    public static from_data(data: GameStateData, playerIds: string[]): RegicideGameState {
        const state = new RegicideGameState(playerIds);
        state.data = JSON.parse(JSON.stringify(data));
        return state;
    }

    public get_data(): GameStateData {
        return JSON.parse(JSON.stringify(this.data));
    }

    // ==========================================================
    // Setup
    // ==========================================================

    public start_game(firstPlayer?: string) {
        const n = this.playerIds.length;
        if (n < 1 || n > 4) {
            throw new Error('Regicide supports 1 to 4 players');
        }

        // Tavern deck: pips 2-10 in every suit, 4 Aces, and 0-2 Jesters.
        const tavern: Card[] = [];
        for (const suit of SUITS) {
            for (let rank = 1; rank <= 10; rank++) {
                tavern.push({ id: `${suit}${rank}`, suit, rank });
            }
        }
        const jestersInTavern = TAVERN_JESTERS[n] || 0;
        for (let j = 0; j < jestersInTavern; j++) {
            tavern.push({ id: `JOKER${j + 1}`, suit: null, rank: 0 });
        }
        this.data.tavernDeck = shuffle(tavern);

        // Castle deck: Jacks on top, then Queens, then Kings (each rank shuffled).
        const jacks = shuffle(SUITS.map(s => ({ id: `${s}11`, suit: s, rank: 11 })));
        const queens = shuffle(SUITS.map(s => ({ id: `${s}12`, suit: s, rank: 12 })));
        const kings = shuffle(SUITS.map(s => ({ id: `${s}13`, suit: s, rank: 13 })));
        this.data.castleDeck = [...jacks, ...queens, ...kings];

        // Deal hands up to max hand size.
        this.data.hands = {};
        this.data.lastAction = {};
        for (const pid of this.playerIds) {
            this.data.hands[pid] = this.draw_cards(this.data.maxHandSize);
            this.data.lastAction[pid] = null;
        }

        this.data.discardPile = [];
        this.data.playedCards = [];
        this.data.pendingDamage = null;
        this.data.lastHit = null;
        this.data.lastAttack = null;
        this.data.awaitingJesterChoice = null;
        this.data.enemiesDefeated = 0;
        this.data.winTier = null;
        this.data.loseReason = null;
        this.data.soloJestersRemaining = this.data.solo ? 2 : 0;
        this.data.jestersUsed = 0;
        this.data.moveCounter = 0;

        const startIdx = firstPlayer ? Math.max(0, this.playerIds.indexOf(firstPlayer)) : 0;
        this.data.currentPlayerId = this.playerIds[startIdx];

        this.data.status = Phase.Play;
        this.reveal_next_enemy();

        this.data.lastMove = {
            playerId: this.data.currentPlayerId,
            desc: 'The battle begins!',
            moveId: ++this.data.moveCounter,
            kind: 'start'
        };
    }

    private reveal_next_enemy() {
        const card = this.data.castleDeck.shift();
        if (!card) {
            // No enemies left -> victory.
            this.win();
            return;
        }
        const stats = enemyStatsFor(card.rank);
        this.data.currentEnemy = {
            card,
            type: stats.type,
            suit: card.suit as Suit,
            attack: stats.attack,
            health: stats.health,
            damage: 0,
            spadesTotal: 0,
            immunityCancelled: false
        };
        this.data.playedCards = [];
        // A new enemy is fresh context: yield tracking resets.
        for (const pid of this.playerIds) this.data.lastAction[pid] = null;
    }

    // ==========================================================
    // Deck helpers
    // ==========================================================

    private draw_cards(count: number): Card[] {
        const out: Card[] = [];
        for (let i = 0; i < count && this.data.tavernDeck.length > 0; i++) {
            out.push(this.data.tavernDeck.shift() as Card);
        }
        return out;
    }

    // ==========================================================
    // Effective enemy stats (public helpers for the view)
    // ==========================================================

    public effective_shield(enemy?: EnemyState | null): number {
        const e = enemy || this.data.currentEnemy;
        if (!e) return 0;
        // Only a Spades enemy is immune to the shield power (until a Jester cancels
        // it). For every other enemy, all spade values reduce its attack. The
        // Spades-enemy retroactivity falls out naturally: once cancelled, the full
        // running spadesTotal (including pre-Jester spades) counts.
        if (e.suit === 'S' && !e.immunityCancelled) return 0;
        return e.spadesTotal;
    }

    public effective_attack(enemy?: EnemyState | null): number {
        const e = enemy || this.data.currentEnemy;
        if (!e) return 0;
        return Math.max(0, e.attack - this.effective_shield(e));
    }

    // Whether a played suit power is active against the current enemy.
    private power_active(suit: Suit): boolean {
        const e = this.data.currentEnemy as EnemyState;
        return suit !== e.suit || e.immunityCancelled;
    }

    // ==========================================================
    // Turn: play cards
    // ==========================================================

    // Play a single card, a same-number combo (total <= 10), or an Animal
    // Companion (Ace) pairing. Jesters must use play_jester instead.
    public play_cards(activeId: string, cardIds: string[]) {
        this.require_active(activeId);
        if (this.data.pendingDamage) throw new Error('You must suffer damage first');
        if (this.data.awaitingJesterChoice) throw new Error('A Jester is choosing the next player');
        if (!cardIds || cardIds.length === 0) throw new Error('No cards selected');

        const hand = this.data.hands[activeId];
        const cards = cardIds.map(id => {
            const c = hand.find(h => h.id === id);
            if (!c) throw new Error('Card not in hand');
            return c;
        });
        if (cards.some(isJester)) throw new Error('Play a Jester on its own');

        this.validate_play(cards);

        // Remove from hand, place on the played pile.
        for (const c of cards) {
            const idx = hand.findIndex(h => h.id === c.id);
            hand.splice(idx, 1);
            this.data.playedCards.push(c);
        }
        this.data.lastAction[activeId] = 'played';

        const value = cards.reduce((s, c) => s + attackValue(c), 0);
        const suits = new Set<Suit>(cards.map(c => c.suit as Suit));

        const label = cards.length > 1
            ? cards.map(cardLabel).join(' + ')
            : cardLabel(cards[0]);
        this.data.lastMove = {
            playerId: activeId,
            desc: `played ${label} (value ${value})`,
            moveId: ++this.data.moveCounter,
            kind: cards.length > 1 ? 'combo' : 'play'
        };

        this.resolve_powers(suits, value, activeId);
        this.resolve_damage(suits, value, activeId);

        const enemy = this.data.currentEnemy as EnemyState;
        if (enemy.damage >= enemy.health) {
            this.defeat_enemy(activeId, enemy.damage === enemy.health);
            return;
        }

        // Not defeated -> the active player suffers the enemy's counter-attack.
        this.suffer_setup(activeId);
    }

    private validate_play(cards: Card[]) {
        if (cards.length === 1) return; // any single non-Jester card is legal

        const hasAce = cards.some(isAce);
        if (hasAce) {
            // Animal Companion pairing: an Ace + exactly one other non-Jester card,
            // or two Aces. Never part of a larger combo.
            if (cards.length !== 2) {
                throw new Error('An Animal Companion pairs with exactly one other card');
            }
            return;
        }

        // Combo: 2-4 cards of the same number, combined total <= 10.
        const rank = cards[0].rank;
        if (rank < 2 || rank > 10) throw new Error('Only number cards 2-10 form a combo');
        if (!cards.every(c => c.rank === rank)) {
            throw new Error('A combo must be the same number');
        }
        if (cards.length > 4) throw new Error('A combo is at most four cards');
        const total = cards.reduce((s, c) => s + attackValue(c), 0);
        if (total > 10) throw new Error('A combo total must be 10 or less');
    }

    // Resolve the immediate (Step 2) powers: Hearts (heal) before Diamonds (draw).
    private resolve_powers(suits: Set<Suit>, value: number, activeId: string) {
        const enemy = this.data.currentEnemy as EnemyState;

        // Spades accumulate their shield regardless of when they resolve; the
        // effective shield is derived later, so retroactivity is automatic.
        if (suits.has('S')) {
            enemy.spadesTotal += value;
        }

        if (suits.has('H') && this.power_active('H')) {
            this.do_heal(value, activeId);
        }
        if (suits.has('D') && this.power_active('D')) {
            this.do_draw(value, activeId);
        }
    }

    // Hearts: shuffle the discard, place N cards face-down under the Tavern deck.
    private do_heal(n: number, activeId: string) {
        if (n <= 0 || this.data.discardPile.length === 0) return;
        const shuffled = shuffle(this.data.discardPile);
        const healed = shuffled.slice(0, Math.min(n, shuffled.length));
        this.data.discardPile = shuffled.slice(healed.length);
        // Under the Tavern deck == bottom of the draw pile.
        this.data.tavernDeck.push(...healed);
        this.data.lastMove = {
            playerId: activeId,
            desc: `Hearts heal — ${healed.length} card(s) returned to the Tavern`,
            moveId: ++this.data.moveCounter,
            kind: 'heal'
        };
    }

    // Diamonds: draw N cards total, current player first then clockwise, skipping
    // any player already at max hand size, until N drawn or the Tavern is empty.
    private do_draw(n: number, activeId: string) {
        if (n <= 0) return;
        const order = this.rotated_order(activeId);
        let drawn = 0;
        let idx = 0;
        let guard = 0;
        const maxGuard = n * this.data.numPlayers + this.data.numPlayers;
        while (drawn < n && this.data.tavernDeck.length > 0 && guard < maxGuard) {
            const pid = order[idx % order.length];
            if (this.data.hands[pid].length < this.data.maxHandSize) {
                this.data.hands[pid].push(this.data.tavernDeck.shift() as Card);
                drawn++;
            } else {
                // Everyone full? bail out.
                if (order.every(p => this.data.hands[p].length >= this.data.maxHandSize)) break;
            }
            idx++;
            guard++;
        }
        if (drawn > 0) {
            this.data.lastMove = {
                playerId: activeId,
                desc: `Diamonds draw — ${drawn} card(s) drawn`,
                moveId: ++this.data.moveCounter,
                kind: 'draw'
            };
        }
    }

    // Clubs (Step 3): double the attack value when active.
    private resolve_damage(suits: Set<Suit>, value: number, activeId: string) {
        const enemy = this.data.currentEnemy as EnemyState;
        const clubs = suits.has('C') && this.power_active('C');
        const dealt = clubs ? value * 2 : value;
        enemy.damage += dealt;

        if (dealt > 0) {
            this.data.lastHit = { playerId: activeId, amount: dealt, hitId: ++this.data.moveCounter };
        }
    }

    // ==========================================================
    // Turn: yield
    // ==========================================================

    public yield_turn(activeId: string) {
        this.require_active(activeId);
        if (this.data.pendingDamage) throw new Error('You must suffer damage first');
        if (this.data.awaitingJesterChoice) throw new Error('A Jester is choosing the next player');
        if (!this.can_yield(activeId)) {
            throw new Error('You cannot yield right now');
        }
        this.data.lastAction[activeId] = 'yielded';
        this.data.lastMove = {
            playerId: activeId,
            desc: 'yielded',
            moveId: ++this.data.moveCounter,
            kind: 'yield'
        };
        // Skip Steps 2 & 3, go straight to suffering damage.
        this.suffer_setup(activeId);
    }

    public can_yield(activeId: string): boolean {
        if (this.data.solo) return false; // no other players -> never allowed
        // Blocked if every OTHER player's most recent action this enemy was a yield.
        const others = this.playerIds.filter(p => p !== activeId);
        const allYielded = others.every(p => this.data.lastAction[p] === 'yielded');
        return !allYielded;
    }

    // ==========================================================
    // Turn: Jester (multiplayer)
    // ==========================================================

    public play_jester(activeId: string, cardId: string) {
        this.require_active(activeId);
        if (this.data.solo) throw new Error('Use the solo Jester refill in solo play');
        if (this.data.pendingDamage) throw new Error('You must suffer damage first');
        if (this.data.awaitingJesterChoice) throw new Error('A Jester is choosing the next player');

        const hand = this.data.hands[activeId];
        const card = hand.find(h => h.id === cardId);
        if (!card || !isJester(card)) throw new Error('That is not a Jester');

        hand.splice(hand.findIndex(h => h.id === cardId), 1);
        this.data.playedCards.push(card);
        this.data.lastAction[activeId] = 'played';

        const enemy = this.data.currentEnemy as EnemyState;
        enemy.immunityCancelled = true;

        this.data.lastMove = {
            playerId: activeId,
            desc: `played a Jester — the ${enemy.type}'s immunity is cancelled`,
            moveId: ++this.data.moveCounter,
            kind: 'jester'
        };

        // Skip Steps 3 & 4; the Jester player chooses who goes next.
        this.data.awaitingJesterChoice = { playerId: activeId };
    }

    public choose_next_player(activeId: string, nextId: string) {
        const jc = this.data.awaitingJesterChoice;
        if (!jc || jc.playerId !== activeId) throw new Error('You are not choosing the next player');
        if (!this.playerIds.includes(nextId)) throw new Error('Unknown player');
        this.data.awaitingJesterChoice = null;
        this.data.currentPlayerId = nextId;
        this.begin_turn(nextId);
    }

    // ==========================================================
    // Turn: solo Jester refill
    // ==========================================================

    public solo_refill(activeId: string) {
        this.require_active(activeId);
        if (!this.data.solo) throw new Error('The refill Jester is a solo-only power');
        if (this.data.soloJestersRemaining <= 0) throw new Error('No Jesters remaining');
        if (this.data.awaitingJesterChoice) throw new Error('Unexpected state');

        // Discard the whole hand, then refill up to 8. Does NOT count as drawing
        // and does NOT cancel enemy immunity.
        const hand = this.data.hands[activeId];
        this.data.discardPile.push(...hand);
        this.data.hands[activeId] = this.draw_cards(this.data.maxHandSize);
        this.data.soloJestersRemaining--;
        this.data.jestersUsed++;

        this.data.lastMove = {
            playerId: activeId,
            desc: `flipped a Jester — discarded and refilled the hand`,
            moveId: ++this.data.moveCounter,
            kind: 'refill'
        };

        // Refilling can rescue a stuck pending-damage step: re-evaluate it.
        if (this.data.pendingDamage) {
            const required = this.data.pendingDamage.amount;
            const handTotal = this.hand_total(activeId);
            if (required > 0 && handTotal < required) {
                this.lose(`could not suffer ${required} damage`);
            }
        }
    }

    // ==========================================================
    // Step 4: suffer damage
    // ==========================================================

    private suffer_setup(activeId: string) {
        const required = this.effective_attack();
        if (required <= 0) {
            // Fully shielded (or enemy attack 0): the enemy never lands a blow.
            this.pass_turn(activeId);
            return;
        }
        // The enemy strikes. Recorded before the fatal-blow check so the event is
        // always a faithful record of every landed hit.
        this.data.lastAttack = { playerId: activeId, amount: required, attackId: ++this.data.moveCounter };

        const handTotal = this.hand_total(activeId);
        if (handTotal < required) {
            this.lose(`could not suffer ${required} damage`);
            return;
        }
        this.data.pendingDamage = { playerId: activeId, amount: required };
    }

    // Cover the enemy's counter-attack by discarding cards whose values sum to at
    // least the required damage.
    public discard_for_damage(activeId: string, cardIds: string[]) {
        const pd = this.data.pendingDamage;
        if (!pd || pd.playerId !== activeId) throw new Error('You are not suffering damage');
        const hand = this.data.hands[activeId];
        const cards = (cardIds || []).map(id => {
            const c = hand.find(h => h.id === id);
            if (!c) throw new Error('Card not in hand');
            return c;
        });
        const sum = cards.reduce((s, c) => s + attackValue(c), 0);
        if (sum < pd.amount) {
            throw new Error(`Discard at least ${pd.amount} (selected ${sum})`);
        }

        for (const c of cards) {
            hand.splice(hand.findIndex(h => h.id === c.id), 1);
            this.data.discardPile.push(c);
        }
        this.data.pendingDamage = null;
        this.data.lastMove = {
            playerId: activeId,
            desc: `suffered ${pd.amount} damage (discarded ${sum})`,
            moveId: ++this.data.moveCounter,
            kind: 'damage'
        };
        this.pass_turn(activeId);
    }

    private hand_total(playerId: string): number {
        return this.data.hands[playerId].reduce((s, c) => s + attackValue(c), 0);
    }

    // ==========================================================
    // Enemy defeat
    // ==========================================================

    private defeat_enemy(activeId: string, exact: boolean) {
        const enemy = this.data.currentEnemy as EnemyState;
        this.data.enemiesDefeated++;

        // Exact kill -> enemy goes face-down on TOP of the Tavern deck (drawable).
        // Otherwise -> to the discard pile.
        if (exact) {
            this.data.tavernDeck.unshift(enemy.card);
        } else {
            this.data.discardPile.push(enemy.card);
        }
        // All cards played against this enemy go to the discard pile.
        this.data.discardPile.push(...this.data.playedCards);
        this.data.playedCards = [];

        this.data.lastMove = {
            playerId: activeId,
            desc: `defeated the ${enemy.type} of ${SUIT_NAME[enemy.suit]}${exact ? ' (exact kill!)' : ''}`,
            moveId: ++this.data.moveCounter,
            kind: 'defeat'
        };

        this.data.currentEnemy = null;

        if (this.data.castleDeck.length === 0) {
            this.win();
            return;
        }

        // Reveal the next enemy; the defeating player immediately starts a new turn
        // (skipping Step 4) against it.
        this.reveal_next_enemy();
        this.data.currentPlayerId = activeId;
        this.begin_turn(activeId);
    }

    // ==========================================================
    // Turn advance & viability
    // ==========================================================

    private pass_turn(fromId: string) {
        const idx = this.playerIds.indexOf(fromId);
        const next = this.playerIds[(idx + 1) % this.data.numPlayers];
        this.data.currentPlayerId = next;
        this.begin_turn(next);
    }

    // At the start of a player's turn, verify they have at least one legal action.
    private begin_turn(playerId: string) {
        if (this.data.status !== Phase.Play) return;
        // Solo refill is always an option while a Jester remains.
        if (this.data.solo && this.data.soloJestersRemaining > 0) return;
        // A non-empty hand can always play something.
        if (this.data.hands[playerId].length > 0) return;
        // Empty hand: the only escape is yielding.
        if (this.can_yield(playerId)) return;
        this.lose('a player has no legal move');
    }

    // ==========================================================
    // End states
    // ==========================================================

    private win() {
        this.data.status = Phase.Won;
        this.data.currentEnemy = null;
        this.data.pendingDamage = null;
        this.data.awaitingJesterChoice = null;
        if (this.data.solo) {
            this.data.winTier = this.data.jestersUsed === 0 ? 'gold'
                : this.data.jestersUsed === 1 ? 'silver' : 'bronze';
        }
        this.data.lastMove = {
            playerId: this.data.currentPlayerId,
            desc: this.data.solo && this.data.winTier
                ? `Victory! (${this.data.winTier} — ${this.data.jestersUsed} Jester(s) used)`
                : 'Victory! All twelve royals defeated!',
            moveId: ++this.data.moveCounter,
            kind: 'win'
        };
    }

    private lose(reason: string) {
        this.data.status = Phase.Lost;
        this.data.loseReason = reason;
        this.data.pendingDamage = null;
        this.data.awaitingJesterChoice = null;
        this.data.lastMove = {
            playerId: this.data.currentPlayerId,
            desc: `Defeat — ${reason}`,
            moveId: ++this.data.moveCounter,
            kind: 'lose'
        };
    }

    // ==========================================================
    // Helpers
    // ==========================================================

    private rotated_order(startId: string): string[] {
        const idx = this.playerIds.indexOf(startId);
        const out: string[] = [];
        for (let i = 0; i < this.data.numPlayers; i++) {
            out.push(this.playerIds[(idx + i) % this.data.numPlayers]);
        }
        return out;
    }

    private require_active(activeId: string) {
        if (this.data.status !== Phase.Play) {
            throw new Error(`Action not allowed in phase ${this.data.status}`);
        }
        if (activeId !== this.data.currentPlayerId) {
            throw new Error('It is not your turn');
        }
    }

    // ---- getters ----
    public get_status(): Phase { return this.data.status; }
    public get_hand(playerId: string): Card[] { return this.data.hands[playerId] || []; }
    public get_current_enemy(): EnemyState | null { return this.data.currentEnemy; }
    public get_current_player(): string { return this.data.currentPlayerId; }
}
