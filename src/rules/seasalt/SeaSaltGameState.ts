/**
 * SeaSaltGameState.ts — Standalone game engine for "Sea Salt & Paper".
 *
 * A hand-management / set-collection card game (Bruno Cathala & Théo Rivière).
 * Players build a private hand over rounds, play matched "duo" pairs for one-time
 * effects, and decide each turn — once they hold ≥ 7 points — whether to STOP
 * (safe) or gamble on a LAST CHANCE. Scores accumulate across rounds until a
 * player crosses the point threshold, or instantly wins by collecting all four
 * mermaids.
 *
 * This class is pure (no React / Multiplayr / network dependencies). It is
 * serialised to JSON between host ticks, so it exposes get_data / from_data
 * rehydration helpers exactly like the other decoupled game states.
 */

import {
    SeaSaltType, SeaSaltColor, SeaSaltCategory, TYPE_INFO, COLLECTOR_THRESHOLDS,
    SEASALT_DECK_COMPOSITION
} from './SeaSaltAssets';

export enum Phase {
    Lobby = 'Lobby',
    Play = 'Play',
    RoundEnd = 'RoundEnd',   // a round's scoring is on screen; host advances to next round
    GameOver = 'GameOver'
}

// Within a single player's turn.
export type TurnPhase =
    | 'draw'    // must draw (deck-of-2 or take-a-discard)
    | 'choose'  // drew 2 from the deck; must keep one and discard the other
    | 'play'    // may play duos, end the round, or pass
    | 'effect'; // a played duo needs input (crab pile pick / steal target)

export type PileId = 'A' | 'B';

export interface Card {
    id: string;
    type: SeaSaltType;
    color: SeaSaltColor;
}

export interface PlayerState {
    hand: Card[];       // private
    tableau: Card[];    // public (played duos)
    score: number;      // cumulative across rounds
    revealed: boolean;  // hand revealed & locked (during a Last Chance resolution)
}

export interface PendingEffect {
    kind: 'crab' | 'steal';
}

export interface LastChanceState {
    declarerId: string;
    declarerCardPoints: number;   // locked at declaration
    remaining: string[];          // opponents who still owe a final turn
}

// Per-player scoring breakdown, produced at round end (and for the live ≥7 gate).
export interface ScoreBreakdown {
    duos: number;
    collectors: number;
    multipliers: number;
    mermaids: number;
    cardPoints: number;        // duos + collectors + multipliers + mermaids
    colorBonus: number;        // size of the most-common colour group
    colorBonusColor: SeaSaltColor | null;
}

export interface RoundPlayerResult {
    playerId: string;
    breakdown: ScoreBreakdown;
    gained: number;            // points actually added this round
    total: number;             // cumulative after this round
}

export interface RoundResult {
    kind: 'stop' | 'last_chance_won' | 'last_chance_lost' | 'exhausted';
    endedBy: string;
    declarerId?: string;
    results: RoundPlayerResult[];
}

export interface LastMove {
    playerId: string;
    desc: string;
    moveId: number;
    kind: 'draw' | 'take' | 'duo' | 'effect' | 'stop' | 'lastchance' | 'roundend' | 'win' | 'start';
    duoType?: SeaSaltType;
    // Animation metadata (client-side fly-card effects):
    // 'deck' = card(s) from the deck (draw-2 keep+discard, single draw, or Fish bonus);
    // 'take' = card from a discard pile (draw or Crab); 'steal' = card from a player.
    animType?: 'deck' | 'take' | 'steal';
    pile?: PileId;                // deck: pile the discard went to; take: pile taken from
    revealCard?: Card;            // deck: the discarded card (public — flip-revealed on the pile)
    fromPlayer?: string;          // steal: the player the card was taken from
}

export interface GameStateData {
    status: Phase;
    playerIds: string[];
    numPlayers: number;

    deck: Card[];
    discardA: Card[];
    discardB: Card[];

    players: Record<string, PlayerState>;

    currentPlayerId: string;
    roundStarterIndex: number;

    turnPhase: TurnPhase;
    drawnPair: Card[] | null;        // the 2 revealed deck cards awaiting keep/discard
    pendingEffect: PendingEffect | null;
    boatExtraTurns: number;

    lastChance: LastChanceState | null;

    roundNumber: number;
    threshold: number;
    roundResult: RoundResult | null;

    winnerId: string | null;
    winReason: 'mermaids' | 'threshold' | null;

    lastMove: LastMove | null;
    moveCounter: number;
}

export const THRESHOLDS: Record<number, number> = { 2: 40, 3: 35, 4: 30 };

function buildDeck(): Card[] {
    const deck: Card[] = [];
    (Object.keys(SEASALT_DECK_COMPOSITION) as SeaSaltColor[]).forEach(color => {
        const comp = SEASALT_DECK_COMPOSITION[color];
        (Object.keys(comp) as SeaSaltType[]).forEach(type => {
            const n = comp[type] || 0;
            for (let i = 0; i < n; i++) {
                deck.push({ id: `${type}-${color}-${i}`, type, color });
            }
        });
    });
    return deck;
}

function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// ---- Pure scoring engine (§9) -----------------------------------------------

export function scoreCards(cards: Card[]): ScoreBreakdown {
    const byType: Partial<Record<SeaSaltType, number>> = {};
    const byColor: Partial<Record<SeaSaltColor, number>> = {};
    for (const c of cards) {
        byType[c.type] = (byType[c.type] || 0) + 1;
        byColor[c.color] = (byColor[c.color] || 0) + 1;
    }
    const n = (t: SeaSaltType) => byType[t] || 0;

    // 1. Duos — 1 pt per pair / combo.
    const duos =
        Math.floor(n('crab') / 2) +
        Math.floor(n('boat') / 2) +
        Math.floor(n('fish') / 2) +
        Math.min(n('swimmer'), n('shark'));

    // 2. Collectors — non-linear thresholds, capped.
    const collectorScore = (type: SeaSaltType) => {
        const table = COLLECTOR_THRESHOLDS[type];
        const count = n(type);
        if (!table || count === 0) return 0;
        const idx = Math.min(count, table.length) - 1;
        return table[idx];
    };
    const collectors =
        collectorScore('shell') +
        collectorScore('octopus') +
        collectorScore('penguin') +
        collectorScore('sailor');

    // 3. Multipliers — score off other cards, never themselves.
    const multipliers =
        n('lighthouse') * 1 * n('boat') +
        n('shoal') * 1 * n('fish') +
        n('colony') * 2 * n('penguin') +
        n('captain') * 3 * n('sailor');

    // 4. Mermaids — each takes a distinct, most-abundant colour (greedy).
    const nMermaid = n('mermaid');
    let mermaids = 0;
    if (nMermaid > 0) {
        const colorCounts = Object.values(byColor).sort((a, b) => b - a);
        for (let i = 0; i < nMermaid && i < colorCounts.length; i++) {
            mermaids += colorCounts[i];
        }
    }

    // 5. Colour bonus — size of the single most-common colour group.
    let colorBonus = 0;
    let colorBonusColor: SeaSaltColor | null = null;
    (Object.keys(byColor) as SeaSaltColor[]).forEach(col => {
        const cnt = byColor[col] || 0;
        if (cnt > colorBonus) { colorBonus = cnt; colorBonusColor = col; }
    });

    const cardPoints = duos + collectors + multipliers + mermaids;
    return { duos, collectors, multipliers, mermaids, cardPoints, colorBonus, colorBonusColor };
}

export function isDuoPair(a: Card, b: Card): boolean {
    if (a.type === 'crab' && b.type === 'crab') return true;
    if (a.type === 'boat' && b.type === 'boat') return true;
    if (a.type === 'fish' && b.type === 'fish') return true;
    if ((a.type === 'swimmer' && b.type === 'shark') || (a.type === 'shark' && b.type === 'swimmer')) return true;
    return false;
}

export class SeaSaltGameState {
    private data: GameStateData;
    private readonly playerIds: string[];

    constructor(playerIds: string[]) {
        this.playerIds = [...playerIds];
        this.data = {
            status: Phase.Lobby,
            playerIds: [...playerIds],
            numPlayers: playerIds.length,
            deck: [],
            discardA: [],
            discardB: [],
            players: {},
            currentPlayerId: '',
            roundStarterIndex: 0,
            turnPhase: 'draw',
            drawnPair: null,
            pendingEffect: null,
            boatExtraTurns: 0,
            lastChance: null,
            roundNumber: 0,
            threshold: THRESHOLDS[playerIds.length] || 40,
            roundResult: null,
            winnerId: null,
            winReason: null,
            lastMove: null,
            moveCounter: 0
        };
    }

    public static from_data(data: GameStateData, playerIds: string[]): SeaSaltGameState {
        const s = new SeaSaltGameState(playerIds);
        s.data = JSON.parse(JSON.stringify(data));
        return s;
    }

    public get_data(): GameStateData {
        return JSON.parse(JSON.stringify(this.data));
    }

    // ==========================================================
    // Setup
    // ==========================================================

    public start_game(firstPlayer?: string) {
        if (this.playerIds.length < 2 || this.playerIds.length > 4) {
            throw new Error('Sea Salt & Paper supports 2 to 4 players');
        }
        for (const pid of this.playerIds) {
            this.data.players[pid] = { hand: [], tableau: [], score: 0, revealed: false };
        }
        this.data.threshold = THRESHOLDS[this.playerIds.length] || 40;
        const startIdx = firstPlayer ? Math.max(0, this.playerIds.indexOf(firstPlayer)) : 0;
        this.data.roundStarterIndex = startIdx;
        this.data.roundNumber = 0;
        this.begin_round();
    }

    private begin_round() {
        this.data.roundNumber += 1;

        // Fresh deck; hands & tableaux cleared (scores persist).
        const deck = shuffle(buildDeck());
        // Seed the two discard piles with one card each.
        this.data.discardA = [deck.pop() as Card];
        this.data.discardB = [deck.pop() as Card];
        this.data.deck = deck;

        for (const pid of this.playerIds) {
            this.data.players[pid].hand = [];
            this.data.players[pid].tableau = [];
            this.data.players[pid].revealed = false;
        }

        this.data.status = Phase.Play;
        this.data.currentPlayerId = this.playerIds[this.data.roundStarterIndex];
        this.data.turnPhase = 'draw';
        this.data.drawnPair = null;
        this.data.pendingEffect = null;
        this.data.boatExtraTurns = 0;
        this.data.lastChance = null;
        this.data.roundResult = null;

        this.data.lastMove = {
            playerId: this.data.currentPlayerId,
            desc: `starts round ${this.data.roundNumber}`,
            moveId: ++this.data.moveCounter,
            kind: 'start'
        };
    }

    // ==========================================================
    // Phase 1 — DRAW
    // ==========================================================

    public draw_from_deck(actorId: string) {
        this.require_turn(actorId, 'draw');
        if (this.data.deck.length === 0) {
            throw new Error('The deck is empty — take a discard instead');
        }
        const first = this.data.deck.pop() as Card;
        if (this.data.deck.length === 0) {
            // Only one card left: keep it directly (nothing to discard against).
            this.data.players[actorId].hand.push(first);
            this.data.turnPhase = 'play';
            this.data.drawnPair = null;
            this.log(actorId, 'drew the last deck card', 'draw', { animType: 'deck' });
            this.check_mermaid_win(actorId);
            return;
        }
        const second = this.data.deck.pop() as Card;
        this.data.drawnPair = [first, second];
        this.data.turnPhase = 'choose';
        this.log(actorId, 'revealed two cards from the deck', 'draw');
    }

    public choose_drawn(actorId: string, keepIndex: number, discardPile: PileId) {
        this.require_turn(actorId, 'choose');
        if (!this.data.drawnPair || (keepIndex !== 0 && keepIndex !== 1)) {
            throw new Error('No drawn pair to choose from');
        }
        const keep = this.data.drawnPair[keepIndex];
        const toss = this.data.drawnPair[keepIndex === 0 ? 1 : 0];

        // Forced discard: an empty pile must receive the discard.
        const aEmpty = this.data.discardA.length === 0;
        const bEmpty = this.data.discardB.length === 0;
        let target = discardPile;
        if (aEmpty && !bEmpty) target = 'A';
        else if (bEmpty && !aEmpty) target = 'B';

        this.data.players[actorId].hand.push(keep);
        this.pile(target).push(toss);
        this.data.drawnPair = null;
        this.data.turnPhase = 'play';
        this.log(actorId, `kept a ${keep.type}, discarded a ${toss.type}`, 'draw', {
            animType: 'deck', pile: target, revealCard: toss
        });
        this.check_mermaid_win(actorId);
    }

    public take_discard(actorId: string, pileId: PileId) {
        this.require_turn(actorId, 'draw');
        const pile = this.pile(pileId);
        if (pile.length === 0) throw new Error('That discard pile is empty');
        const card = pile.pop() as Card;
        this.data.players[actorId].hand.push(card);
        this.data.turnPhase = 'play';
        this.log(actorId, `took a ${card.type} from a discard pile`, 'take', { animType: 'take', pile: pileId });
        this.check_mermaid_win(actorId);
    }

    // ==========================================================
    // Phase 2 — PLAY DUOS
    // ==========================================================

    public play_duo(actorId: string, cardId1: string, cardId2: string) {
        this.require_turn(actorId, 'play');
        if (cardId1 === cardId2) throw new Error('Pick two different cards');
        const hand = this.data.players[actorId].hand;
        const i1 = hand.findIndex(c => c.id === cardId1);
        const i2 = hand.findIndex(c => c.id === cardId2);
        if (i1 < 0 || i2 < 0) throw new Error('Both cards must be in your hand');
        const c1 = hand[i1];
        const c2 = hand[i2];
        if (!isDuoPair(c1, c2)) throw new Error('Those two cards are not a matching duo');

        // Move both to the tableau (public).
        const [a] = hand.splice(Math.max(i1, i2), 1);
        const [b] = hand.splice(Math.min(i1, i2), 1);
        this.data.players[actorId].tableau.push(a, b);

        const duoType: SeaSaltType = (c1.type === 'swimmer' || c1.type === 'shark') ? 'shark' : c1.type;
        const effect = TYPE_INFO[c1.type].duoEffect;
        this.log(actorId, `played a ${c1.type} + ${c2.type} duo`, 'duo', { duoType });

        switch (effect) {
            case 'extra_turn':
                this.data.boatExtraTurns += 1;
                break;
            case 'draw':
                // Draw the top of the deck into hand (nothing if empty).
                if (this.data.deck.length > 0) {
                    const drawn = this.data.deck.pop() as Card;
                    this.data.players[actorId].hand.push(drawn);
                    // Fly a face-down card from the deck into the player's panel.
                    if (this.data.lastMove) this.data.lastMove.animType = 'deck';
                    this.check_mermaid_win(actorId);
                }
                break;
            case 'peek':
                this.data.pendingEffect = { kind: 'crab' };
                this.data.turnPhase = 'effect';
                break;
            case 'steal':
                // Only worth prompting if some opponent has a stealable (unlocked) card.
                if (this.stealable_targets(actorId).length > 0) {
                    this.data.pendingEffect = { kind: 'steal' };
                    this.data.turnPhase = 'effect';
                }
                break;
        }
    }

    // Crab: look through a discard pile and take any one card.
    public resolve_crab(actorId: string, pileId: PileId, cardIndex: number) {
        this.require_turn(actorId, 'effect');
        if (!this.data.pendingEffect || this.data.pendingEffect.kind !== 'crab') {
            throw new Error('No crab effect to resolve');
        }
        const pile = this.pile(pileId);
        if (cardIndex < 0 || cardIndex >= pile.length) throw new Error('Invalid card selection');
        const [card] = pile.splice(cardIndex, 1);
        this.data.players[actorId].hand.push(card);
        this.data.pendingEffect = null;
        this.data.turnPhase = 'play';
        // Card kept secret from others (Crab is private) — desc & animation stay generic.
        this.log(actorId, 'took a card from a discard pile (crab)', 'effect', { animType: 'take', pile: pileId });
        this.check_mermaid_win(actorId);
    }

    // Swimmer + Shark: steal a random card from a chosen opponent.
    public resolve_steal(actorId: string, targetId: string) {
        this.require_turn(actorId, 'effect');
        if (!this.data.pendingEffect || this.data.pendingEffect.kind !== 'steal') {
            throw new Error('No steal effect to resolve');
        }
        if (targetId === actorId) throw new Error('You cannot steal from yourself');
        const target = this.data.players[targetId];
        if (!target) throw new Error('Unknown target');
        if (target.revealed) throw new Error('That hand is revealed and protected');
        if (target.hand.length === 0) throw new Error('That player has no cards to steal');

        const idx = Math.floor(Math.random() * target.hand.length);
        const [card] = target.hand.splice(idx, 1);
        this.data.players[actorId].hand.push(card);
        this.data.pendingEffect = null;
        this.data.turnPhase = 'play';
        this.log(actorId, 'stole a random card', 'effect', { animType: 'steal', fromPlayer: targetId });
        this.check_mermaid_win(actorId);
    }

    private stealable_targets(actorId: string): string[] {
        return this.playerIds.filter(pid =>
            pid !== actorId && !this.data.players[pid].revealed && this.data.players[pid].hand.length > 0);
    }

    // ==========================================================
    // Phase 3 — END TURN / END ROUND
    // ==========================================================

    // Pass: finish the play phase without ending the round.
    public pass_turn(actorId: string) {
        this.require_turn(actorId, 'play');
        this.advance_after_turn(actorId);
    }

    public declare_stop(actorId: string) {
        this.require_turn(actorId, 'play');
        this.require_gate(actorId);
        this.data.players[actorId].revealed = true;
        this.log(actorId, 'called STOP', 'stop');
        this.score_round('stop', actorId);
    }

    public declare_last_chance(actorId: string) {
        this.require_turn(actorId, 'play');
        this.require_gate(actorId);
        const points = scoreCards(this.all_cards(actorId)).cardPoints;
        this.data.players[actorId].revealed = true;
        this.data.lastChance = {
            declarerId: actorId,
            declarerCardPoints: points,
            remaining: this.playerIds.filter(p => p !== actorId)
        };
        this.log(actorId, 'called LAST CHANCE', 'lastchance');
        // Hand off to the first opponent for their final turn.
        this.begin_next_last_chance_turn();
    }

    // The ≥7 gate uses live card points (excluding colour bonus).
    public can_end_round(actorId: string): boolean {
        return scoreCards(this.all_cards(actorId)).cardPoints >= 7;
    }

    private require_gate(actorId: string) {
        if (!this.can_end_round(actorId)) {
            throw new Error('You need at least 7 points to end the round');
        }
        if (this.data.lastChance) {
            throw new Error('A Last Chance is already in progress');
        }
    }

    private advance_after_turn(actorId: string) {
        // Boats grant extra turns to the SAME player before anyone else acts.
        if (this.data.boatExtraTurns > 0) {
            this.data.boatExtraTurns -= 1;
            this.data.turnPhase = 'draw';
            this.data.drawnPair = null;
            return;
        }

        // A Last Chance final turn just ended — lock this opponent and move on.
        if (this.data.lastChance && this.data.lastChance.remaining[0] === actorId) {
            this.data.players[actorId].revealed = true;
            this.data.lastChance.remaining.shift();
            this.begin_next_last_chance_turn();
            return;
        }

        // Round ends immediately (no scoring) if the deck is exhausted (§7.1).
        if (this.data.deck.length === 0) {
            this.score_round('exhausted', actorId);
            return;
        }

        this.data.currentPlayerId = this.next_player(actorId);
        this.data.turnPhase = 'draw';
        this.data.drawnPair = null;
    }

    private begin_next_last_chance_turn() {
        const lc = this.data.lastChance!;
        if (lc.remaining.length === 0) {
            this.resolve_last_chance();
            return;
        }
        this.data.currentPlayerId = lc.remaining[0];
        this.data.turnPhase = 'draw';
        this.data.drawnPair = null;
        this.data.boatExtraTurns = 0;
        this.data.pendingEffect = null;
    }

    private next_player(actorId: string): string {
        const idx = this.playerIds.indexOf(actorId);
        return this.playerIds[(idx + 1) % this.data.numPlayers];
    }

    // ==========================================================
    // Scoring resolution
    // ==========================================================

    private all_cards(playerId: string): Card[] {
        const p = this.data.players[playerId];
        return [...p.hand, ...p.tableau];
    }

    // STOP / exhausted: everyone scores card points only (no colour bonus).
    private score_round(kind: 'stop' | 'exhausted', endedBy: string) {
        const results: RoundPlayerResult[] = [];
        for (const pid of this.playerIds) {
            const breakdown = scoreCards(this.all_cards(pid));
            const gained = kind === 'exhausted' ? 0 : breakdown.cardPoints;
            this.data.players[pid].score += gained;
            results.push({ playerId: pid, breakdown, gained, total: this.data.players[pid].score });
        }
        this.finish_round({ kind, endedBy, results });
    }

    private resolve_last_chance() {
        const lc = this.data.lastChance!;
        const declarer = lc.declarerId;
        const declarerBreak = scoreCards(this.all_cards(declarer));
        const declarerPoints = declarerBreak.cardPoints;

        // Declarer wins if their card total ≥ every opponent's (ties favour them).
        let won = true;
        for (const pid of this.playerIds) {
            if (pid === declarer) continue;
            if (scoreCards(this.all_cards(pid)).cardPoints > declarerPoints) { won = false; break; }
        }

        const results: RoundPlayerResult[] = [];
        for (const pid of this.playerIds) {
            const breakdown = scoreCards(this.all_cards(pid));
            let gained: number;
            if (pid === declarer) {
                gained = won ? breakdown.cardPoints + breakdown.colorBonus : breakdown.colorBonus;
            } else {
                gained = won ? breakdown.colorBonus : breakdown.cardPoints;
            }
            this.data.players[pid].score += gained;
            results.push({ playerId: pid, breakdown, gained, total: this.data.players[pid].score });
        }
        this.finish_round({
            kind: won ? 'last_chance_won' : 'last_chance_lost',
            endedBy: declarer,
            declarerId: declarer,
            results
        });
    }

    private finish_round(result: RoundResult) {
        this.data.roundResult = result;
        this.data.lastChance = null;
        this.data.pendingEffect = null;
        this.data.boatExtraTurns = 0;
        this.data.currentPlayerId = '';
        this.data.turnPhase = 'play';

        this.log(result.endedBy, this.round_desc(result), 'roundend');

        // Threshold win check: after full scoring, highest cumulative ≥ threshold.
        const leader = this.leader();
        if (this.data.players[leader].score >= this.data.threshold) {
            this.data.status = Phase.GameOver;
            this.data.winnerId = leader;
            this.data.winReason = 'threshold';
            this.log(leader, `won the game with ${this.data.players[leader].score} points`, 'win');
        } else {
            this.data.status = Phase.RoundEnd;
        }
    }

    // Highest cumulative score; ties broken toward whoever ended the round last
    // (the round-ender is the natural "last" actor).
    private leader(): string {
        let best = this.playerIds[0];
        for (const pid of this.playerIds) {
            if (this.data.players[pid].score > this.data.players[best].score) best = pid;
        }
        return best;
    }

    // Host advances to the next round after the RoundEnd summary has been shown.
    public next_round(actorId?: string) {
        if (this.data.status !== Phase.RoundEnd) return;
        // The player to the LEFT of whoever ended the previous round starts next.
        const enderId = this.data.roundResult ? this.data.roundResult.endedBy : this.playerIds[this.data.roundStarterIndex];
        const enderIdx = this.playerIds.indexOf(enderId);
        this.data.roundStarterIndex = (enderIdx + 1) % this.data.numPlayers;
        this.begin_round();
    }

    private round_desc(result: RoundResult): string {
        switch (result.kind) {
            case 'stop': return 'ended the round (STOP)';
            case 'last_chance_won': return 'won the Last Chance bet!';
            case 'last_chance_lost': return 'lost the Last Chance bet';
            case 'exhausted': return 'emptied the deck — round scores nothing';
        }
    }

    // ==========================================================
    // Instant win — all four mermaids
    // ==========================================================
    private check_mermaid_win(playerId: string) {
        const mermaids = this.all_cards(playerId).filter(c => c.type === 'mermaid').length;
        if (mermaids >= 4) {
            this.data.status = Phase.GameOver;
            this.data.winnerId = playerId;
            this.data.winReason = 'mermaids';
            this.data.currentPlayerId = '';
            this.data.pendingEffect = null;
            this.log(playerId, 'collected all four mermaids — instant win!', 'win');
        }
    }

    // ==========================================================
    // Helpers & getters
    // ==========================================================

    private pile(id: PileId): Card[] {
        return id === 'A' ? this.data.discardA : this.data.discardB;
    }

    private require_turn(actorId: string, phase: TurnPhase) {
        if (this.data.status !== Phase.Play) throw new Error(`Not in play (${this.data.status})`);
        if (actorId !== this.data.currentPlayerId) throw new Error('It is not your turn');
        if (this.data.turnPhase !== phase) throw new Error(`Cannot do that now (phase ${this.data.turnPhase})`);
    }

    private log(playerId: string, desc: string, kind: LastMove['kind'], extra: Partial<LastMove> = {}) {
        this.data.lastMove = { playerId, desc, moveId: ++this.data.moveCounter, kind, ...extra };
    }

    public get_status(): Phase {
        return this.data.status;
    }

    public get_player_score(playerId: string): ScoreBreakdown {
        return scoreCards(this.all_cards(playerId));
    }

    // What the current actor is allowed to do right now (public shape only).
    public get_available_actions(playerId: string): {
        canDrawDeck: boolean;
        canTakeA: boolean;
        canTakeB: boolean;
        canEndRound: boolean;
        pending: PendingEffect | null;
        turnPhase: TurnPhase;
    } {
        const isTurn = playerId === this.data.currentPlayerId && this.data.status === Phase.Play;
        return {
            canDrawDeck: isTurn && this.data.turnPhase === 'draw' && this.data.deck.length > 0,
            canTakeA: isTurn && this.data.turnPhase === 'draw' && this.data.discardA.length > 0,
            canTakeB: isTurn && this.data.turnPhase === 'draw' && this.data.discardB.length > 0,
            canEndRound: isTurn && this.data.turnPhase === 'play' && !this.data.lastChance && this.can_end_round(playerId),
            pending: isTurn ? this.data.pendingEffect : null,
            turnPhase: this.data.turnPhase
        };
    }
}

// Re-export domain types used across the module boundary.
export type { SeaSaltType, SeaSaltColor, SeaSaltCategory };
