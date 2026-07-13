/**
 * SkullGameState.ts - Standalone game engine for "Skull" (a.k.a. Skull & Roses).
 *
 * A pure bluffing / bidding game. Each player owns four discs — three flowers and
 * one skull. A round runs through four phases:
 *
 *   1. Placement  — every active player secretly lays one disc on their mat.
 *   2. Stacking   — clockwise, players either add a disc on top of their stack or
 *                   OPEN the bid, declaring how many flowers they can reveal.
 *   3. Bidding    — clockwise, players raise or pass (passing is permanent) until
 *                   only one bidder remains (the challenger) or someone bids the max.
 *   4. Challenge  — the challenger flips their ENTIRE own stack first, then flips
 *                   the top disc of any opponent's stack, one at a time, until they
 *                   reveal enough flowers (success) or hit a skull (failure).
 *
 * Winning: two successful challenges, OR being the last player with discs.
 *
 * This class is pure (no React / Multiplayr / network dependencies) and is
 * serialised to JSON between host ticks, so it exposes get_data / from_data
 * rehydration helpers exactly like the other decoupled game states.
 *
 * Hidden information: disc CONTENTS (flower vs skull) are private; disc COUNTS
 * (stack size, hand size, total owned, wins) are always public. A player always
 * knows their own owned flower/skull counts — that is how, after a random loss,
 * they "inspect their remaining discs" while opponents merely suspect.
 */

export enum Phase {
    Lobby = 'Lobby',
    Placement = 'Placement',   // simultaneous initial placement
    Stacking = 'Stacking',     // clockwise add-or-open
    Bidding = 'Bidding',       // clockwise raise-or-pass
    Challenge = 'Challenge',   // the reveal
    AwaitDiscard = 'AwaitDiscard', // challenger revealed their OWN skull, must choose a disc to lose
    Resolve = 'Resolve',       // outcome shown; host advances to the next round
    GameOver = 'GameOver'
}

export type DiscKind = 'flower' | 'skull';

export const START_FLOWERS = 3;
export const START_SKULLS = 1;

export interface PlayerState {
    ownedFlowers: number;   // persistent inventory (only shrinks on a failed challenge)
    ownedSkulls: number;
    // round-scoped:
    handFlowers: number;    // discs still in hand, available to place this round
    handSkulls: number;
    stack: DiscKind[];      // discs placed on the mat, ordered bottom(0) -> top(n-1)
    revealed: number;       // discs revealed from the top during the current challenge
    placedInitial: boolean; // has laid their mandatory Phase-1 disc this round
    passed: boolean;        // has passed during bidding (permanent for the round)
    wins: number;           // challenges won (mat flipped at 1; 2 wins the game)
    eliminated: boolean;
}

// One disc flipped during a challenge — always public (kind revealed).
export interface RevealEntry {
    ownerId: string;
    kind: DiscKind;
    fromOwnStack: boolean;  // true = the challenger's own stack
    seq: number;
}

export interface Bid {
    playerId: string;
    value: number;
}

// Frozen snapshot of the just-finished challenge, held on screen until the host
// advances the round. It never gates game logic.
export interface Resolution {
    kind: 'success' | 'failure';
    challengerId: string;
    bid: number;
    flowersRevealed: number;
    reveals: RevealEntry[];
    // failure only:
    skullOwnerId?: string;
    reason?: 'own' | 'other';
    // The discarded disc's kind is public ONLY when the challenger chose it? No —
    // the discard is always secret to opponents. It is exposed to the challenger
    // alone via their own owned counts, never in this public snapshot.
    eliminatedIds: string[];
    gameWon: boolean;
    winnerId?: string;
    resolveId: number;
}

export interface LastMove {
    playerId: string;
    kind: 'place' | 'add' | 'open' | 'raise' | 'pass' | 'reveal' | 'success' | 'failure' | 'discard' | 'eliminate' | 'win' | 'start';
    desc: string;
    moveId: number;
    targetId?: string;   // e.g. whose stack was flipped, or the skull's owner
    value?: number;
}

export interface GameStateData {
    status: Phase;
    playerIds: string[];
    numPlayers: number;
    players: Record<string, PlayerState>;

    round: number;
    roundStarterId: string;   // who starts the stacking phase this round
    currentPlayerId: string;  // whose turn it is (stacking / bidding / discard); '' when none

    // Bidding
    bid: Bid | null;
    bidOpen: boolean;
    discsOnTable: number;     // total discs on all mats — fixed the moment the bid opens

    // Challenge
    challengerId: string;
    bidTarget: number;        // N flowers to reveal
    flowersRevealed: number;
    revealSequence: RevealEntry[];

    // Resolution
    resolution: Resolution | null;

    winnerId: string | null;
    lastMove: LastMove | null;
    moveCounter: number;
    seqCounter: number;
}

function randInt(n: number): number {
    return Math.floor(Math.random() * n);
}

export class SkullGameState {
    private data: GameStateData;
    private readonly playerIds: string[];

    constructor(playerIds: string[]) {
        this.playerIds = [...playerIds];
        this.data = {
            status: Phase.Lobby,
            playerIds: [...playerIds],
            numPlayers: playerIds.length,
            players: {},
            round: 0,
            roundStarterId: '',
            currentPlayerId: '',
            bid: null,
            bidOpen: false,
            discsOnTable: 0,
            challengerId: '',
            bidTarget: 0,
            flowersRevealed: 0,
            revealSequence: [],
            resolution: null,
            winnerId: null,
            lastMove: null,
            moveCounter: 0,
            seqCounter: 0
        };
        for (const pid of playerIds) {
            this.data.players[pid] = this.freshPlayer();
        }
    }

    private freshPlayer(): PlayerState {
        return {
            ownedFlowers: START_FLOWERS,
            ownedSkulls: START_SKULLS,
            handFlowers: START_FLOWERS,
            handSkulls: START_SKULLS,
            stack: [],
            revealed: 0,
            placedInitial: false,
            passed: false,
            wins: 0,
            eliminated: false
        };
    }

    public static from_data(data: GameStateData, playerIds: string[]): SkullGameState {
        const state = new SkullGameState(playerIds);
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
        if (this.playerIds.length < 3 || this.playerIds.length > 6) {
            throw new Error('Skull supports 3 to 6 players');
        }
        for (const pid of this.playerIds) {
            this.data.players[pid] = this.freshPlayer();
        }
        this.data.round = 0;
        this.data.winnerId = null;
        this.data.moveCounter = 0;
        this.data.seqCounter = 0;

        const starter = firstPlayer && this.playerIds.includes(firstPlayer)
            ? firstPlayer
            : this.playerIds[randInt(this.playerIds.length)];
        this.begin_round(starter);
        this.data.lastMove = {
            playerId: starter,
            kind: 'start',
            desc: 'starts the game',
            moveId: ++this.data.moveCounter
        };
    }

    // Reset every active player's discs to hand and open a fresh round.
    private begin_round(starterId: string) {
        for (const pid of this.playerIds) {
            const p = this.data.players[pid];
            if (p.eliminated) continue;
            p.handFlowers = p.ownedFlowers;
            p.handSkulls = p.ownedSkulls;
            p.stack = [];
            p.revealed = 0;
            p.placedInitial = false;
            p.passed = false;
        }
        this.data.round += 1;
        this.data.roundStarterId = this.activeOrNext(starterId);
        this.data.currentPlayerId = this.data.roundStarterId;
        this.data.bid = null;
        this.data.bidOpen = false;
        this.data.discsOnTable = 0;
        this.data.challengerId = '';
        this.data.bidTarget = 0;
        this.data.flowersRevealed = 0;
        this.data.revealSequence = [];
        this.data.resolution = null;
        this.data.status = Phase.Placement;
    }

    // ==========================================================
    // Phase 1 — Placement (simultaneous)
    // ==========================================================

    public place_initial(playerId: string, kind: DiscKind) {
        if (this.data.status !== Phase.Placement) {
            throw new Error('Not in the placement phase');
        }
        const p = this.requirePlayer(playerId);
        if (p.eliminated) throw new Error('Eliminated players cannot place');
        if (p.placedInitial) throw new Error('You have already placed your disc');
        this.takeFromHand(p, kind);
        p.stack.push(kind);
        p.placedInitial = true;

        this.data.lastMove = {
            playerId,
            kind: 'place',
            desc: 'placed a disc',
            moveId: ++this.data.moveCounter
        };

        // Once every active player has placed, stacking begins with the round starter.
        const allPlaced = this.activePlayers().every(id => this.data.players[id].placedInitial);
        if (allPlaced) {
            this.data.status = Phase.Stacking;
            this.data.currentPlayerId = this.activeOrNext(this.data.roundStarterId);
        }
    }

    // ==========================================================
    // Phase 2 — Stacking (clockwise add-or-open)
    // ==========================================================

    public add_disc(playerId: string, kind: DiscKind) {
        if (this.data.status !== Phase.Stacking) {
            throw new Error('Not in the stacking phase');
        }
        this.requireTurn(playerId);
        const p = this.data.players[playerId];
        this.takeFromHand(p, kind);
        p.stack.push(kind);

        this.data.lastMove = {
            playerId,
            kind: 'add',
            desc: 'added a disc to their stack',
            moveId: ++this.data.moveCounter
        };
        this.data.currentPlayerId = this.nextActive(playerId);
    }

    public open_bid(playerId: string, value: number) {
        if (this.data.status !== Phase.Stacking) {
            throw new Error('The bid can only be opened during stacking');
        }
        this.requireTurn(playerId);

        const table = this.totalOnTable();
        if (table < 1) throw new Error('There are no discs to bid on');
        if (!Number.isInteger(value) || value < 1 || value > table) {
            throw new Error(`Bid must be between 1 and ${table}`);
        }

        this.data.discsOnTable = table;
        this.data.bidOpen = true;
        this.data.bid = { playerId, value };
        for (const id of this.playerIds) this.data.players[id].passed = false;
        this.data.status = Phase.Bidding;

        this.data.lastMove = {
            playerId,
            kind: 'open',
            desc: `opened the bid at ${value}`,
            moveId: ++this.data.moveCounter,
            value
        };

        // Max bid ends bidding instantly.
        if (value >= table) {
            this.begin_challenge(playerId);
            return;
        }
        const next = this.nextEligible(playerId);
        if (next === null || next === playerId) {
            this.begin_challenge(playerId);
        } else {
            this.data.currentPlayerId = next;
        }
    }

    // ==========================================================
    // Phase 3 — Bidding (clockwise raise-or-pass)
    // ==========================================================

    public raise_bid(playerId: string, value: number) {
        if (this.data.status !== Phase.Bidding) {
            throw new Error('Not in the bidding phase');
        }
        this.requireTurn(playerId);
        const cur = this.data.bid;
        if (!cur) throw new Error('No bid to raise');
        if (!Number.isInteger(value) || value <= cur.value) {
            throw new Error('You must raise higher than the current bid');
        }
        if (value > this.data.discsOnTable) {
            throw new Error(`Bid cannot exceed ${this.data.discsOnTable}`);
        }

        this.data.bid = { playerId, value };
        this.data.lastMove = {
            playerId,
            kind: 'raise',
            desc: `raised the bid to ${value}`,
            moveId: ++this.data.moveCounter,
            value
        };

        if (value >= this.data.discsOnTable) {
            this.begin_challenge(playerId);
            return;
        }
        const next = this.nextEligible(playerId);
        if (next === null || next === playerId) {
            this.begin_challenge(playerId);
        } else {
            this.data.currentPlayerId = next;
        }
    }

    public pass_bid(playerId: string) {
        if (this.data.status !== Phase.Bidding) {
            throw new Error('Not in the bidding phase');
        }
        this.requireTurn(playerId);
        const cur = this.data.bid;
        if (cur && cur.playerId === playerId) {
            throw new Error('The high bidder cannot pass');
        }
        const p = this.data.players[playerId];
        p.passed = true;
        this.data.lastMove = {
            playerId,
            kind: 'pass',
            desc: 'passed',
            moveId: ++this.data.moveCounter
        };

        // If only one eligible bidder remains, they are the challenger.
        const eligible = this.activePlayers().filter(id => !this.data.players[id].passed);
        if (eligible.length === 1) {
            this.begin_challenge(eligible[0]);
            return;
        }
        this.data.currentPlayerId = this.nextEligible(playerId) as string;
    }

    // ==========================================================
    // Phase 4 — Challenge (the reveal)
    // ==========================================================

    private begin_challenge(challengerId: string) {
        this.data.status = Phase.Challenge;
        this.data.challengerId = challengerId;
        this.data.bidTarget = this.data.bid ? this.data.bid.value : 0;
        this.data.flowersRevealed = 0;
        this.data.revealSequence = [];
        this.data.currentPlayerId = challengerId;
        for (const id of this.playerIds) this.data.players[id].revealed = 0;

        // 1. Flip the challenger's ENTIRE own stack first, top to bottom. Any skull
        //    anywhere in it fails the challenge — even a bid of 1 with a flower on
        //    top fails if a skull sits beneath.
        const me = this.data.players[challengerId];
        let ownFlowers = 0;
        let ownSkull = false;
        for (let i = me.stack.length - 1; i >= 0; i--) {
            const kind = me.stack[i];
            this.data.revealSequence.push({
                ownerId: challengerId,
                kind,
                fromOwnStack: true,
                seq: ++this.data.seqCounter
            });
            if (kind === 'skull') ownSkull = true;
            else ownFlowers++;
        }
        me.revealed = me.stack.length;
        this.data.flowersRevealed = ownFlowers;

        this.data.lastMove = {
            playerId: challengerId,
            kind: 'reveal',
            desc: `must reveal ${this.data.bidTarget} flowers`,
            moveId: ++this.data.moveCounter,
            value: this.data.bidTarget
        };

        if (ownSkull) {
            this.fail_challenge(challengerId, 'own');
            return;
        }
        if (ownFlowers >= this.data.bidTarget) {
            this.succeed_challenge();
        }
        // else: await opponent flips (currentPlayer stays the challenger).
    }

    // The challenger flips the top unrevealed disc of an opponent's stack.
    public flip_opponent(challengerId: string, targetId: string) {
        if (this.data.status !== Phase.Challenge) {
            throw new Error('Not in the challenge phase');
        }
        if (challengerId !== this.data.challengerId) {
            throw new Error('Only the challenger flips discs');
        }
        if (targetId === challengerId) {
            throw new Error('Your own stack is already fully revealed');
        }
        const target = this.requirePlayer(targetId);
        if (target.eliminated) throw new Error('That player is not in the round');
        if (target.revealed >= target.stack.length) {
            throw new Error('That stack has no discs left to flip');
        }

        const idx = target.stack.length - 1 - target.revealed;
        const kind = target.stack[idx];
        target.revealed += 1;
        this.data.revealSequence.push({
            ownerId: targetId,
            kind,
            fromOwnStack: false,
            seq: ++this.data.seqCounter
        });

        this.data.lastMove = {
            playerId: challengerId,
            kind: 'reveal',
            desc: kind === 'skull' ? 'flipped a skull!' : 'flipped a flower',
            moveId: ++this.data.moveCounter,
            targetId
        };

        if (kind === 'skull') {
            this.fail_challenge(targetId, 'other');
            return;
        }
        this.data.flowersRevealed += 1;
        if (this.data.flowersRevealed >= this.data.bidTarget) {
            this.succeed_challenge();
        }
    }

    private succeed_challenge() {
        const id = this.data.challengerId;
        const me = this.data.players[id];
        me.wins += 1;
        const gameWon = me.wins >= 2;

        const resolution: Resolution = {
            kind: 'success',
            challengerId: id,
            bid: this.data.bidTarget,
            flowersRevealed: this.data.flowersRevealed,
            reveals: this.data.revealSequence.map(r => ({ ...r })),
            eliminatedIds: [],
            gameWon,
            resolveId: ++this.data.moveCounter
        };

        if (gameWon) {
            resolution.winnerId = id;
            this.data.winnerId = id;
            this.data.status = Phase.GameOver;
            this.data.currentPlayerId = '';
            this.data.lastMove = {
                playerId: id,
                kind: 'win',
                desc: 'won the game with a second challenge!',
                moveId: ++this.data.moveCounter
            };
        } else {
            this.data.roundStarterId = id; // winner starts next round
            this.data.status = Phase.Resolve;
            this.data.currentPlayerId = '';
            this.data.lastMove = {
                playerId: id,
                kind: 'success',
                desc: `succeeded — revealed ${this.data.bidTarget} flowers!`,
                moveId: ++this.data.moveCounter,
                value: this.data.bidTarget
            };
        }
        this.data.resolution = resolution;
    }

    // A skull was revealed. The challenger loses exactly one disc, permanently.
    private fail_challenge(skullOwnerId: string, reason: 'own' | 'other') {
        const challengerId = this.data.challengerId;

        if (reason === 'own') {
            // The challenger chooses which of their own discs to discard.
            this.data.status = Phase.AwaitDiscard;
            this.data.currentPlayerId = challengerId;
            this.data.lastMove = {
                playerId: challengerId,
                kind: 'failure',
                desc: 'revealed their own skull — must discard a disc',
                moveId: ++this.data.moveCounter,
                targetId: challengerId
            };
            return;
        }

        // Another player's skull: one of the challenger's discs is removed at
        // random, unseen by everyone. The challenger learns it only by inspecting
        // their remaining discs.
        const removed = this.removeRandomDisc(challengerId);
        this.data.lastMove = {
            playerId: challengerId,
            kind: 'failure',
            desc: 'hit a skull and lost a disc',
            moveId: ++this.data.moveCounter,
            targetId: skullOwnerId
        };
        this.finalize_failure(challengerId, skullOwnerId, reason, removed);
    }

    // The challenger picks a disc to discard after revealing their OWN skull.
    public choose_discard(playerId: string, kind: DiscKind) {
        if (this.data.status !== Phase.AwaitDiscard) {
            throw new Error('No discard is pending');
        }
        if (playerId !== this.data.challengerId) {
            throw new Error('Only the challenger discards');
        }
        const p = this.data.players[playerId];
        if (kind === 'skull' && p.ownedSkulls <= 0) throw new Error('You have no skull to discard');
        if (kind === 'flower' && p.ownedFlowers <= 0) throw new Error('You have no flower to discard');
        if (kind === 'skull') p.ownedSkulls -= 1; else p.ownedFlowers -= 1;

        this.data.lastMove = {
            playerId,
            kind: 'discard',
            desc: 'discarded a disc',
            moveId: ++this.data.moveCounter
        };
        this.finalize_failure(playerId, playerId, 'own', kind);
    }

    // Shared failure tail: elimination check, win check, next-round setup.
    private finalize_failure(challengerId: string, skullOwnerId: string, reason: 'own' | 'other', _removed: DiscKind) {
        const challenger = this.data.players[challengerId];
        const eliminatedIds: string[] = [];
        if (challenger.ownedFlowers + challenger.ownedSkulls <= 0) {
            challenger.eliminated = true;
            eliminatedIds.push(challengerId);
        }

        // Next round's starter: the challenger, unless they were just eliminated,
        // in which case the skull's owner starts (or the next active player if the
        // owner is gone too — e.g. an own-skull elimination).
        let starter = challengerId;
        if (challenger.eliminated) {
            starter = !this.data.players[skullOwnerId].eliminated
                ? skullOwnerId
                : this.nextActive(challengerId);
        }

        const resolution: Resolution = {
            kind: 'failure',
            challengerId,
            bid: this.data.bidTarget,
            flowersRevealed: this.data.flowersRevealed,
            reveals: this.data.revealSequence.map(r => ({ ...r })),
            skullOwnerId,
            reason,
            eliminatedIds,
            gameWon: false,
            resolveId: ++this.data.moveCounter
        };

        // Last player standing wins.
        const alive = this.activePlayers();
        if (alive.length === 1) {
            resolution.gameWon = true;
            resolution.winnerId = alive[0];
            this.data.winnerId = alive[0];
            this.data.status = Phase.GameOver;
            this.data.currentPlayerId = '';
            this.data.lastMove = {
                playerId: alive[0],
                kind: 'win',
                desc: 'is the last player standing — wins the game!',
                moveId: ++this.data.moveCounter
            };
        } else {
            this.data.roundStarterId = starter;
            this.data.status = Phase.Resolve;
            this.data.currentPlayerId = '';
        }
        this.data.resolution = resolution;
    }

    // Host advances from the Resolve snapshot into the next round.
    public proceed_round(_playerId?: string) {
        if (this.data.status !== Phase.Resolve) return; // idempotent / race guard
        this.begin_round(this.data.roundStarterId);
    }

    // ==========================================================
    // Helpers
    // ==========================================================

    private takeFromHand(p: PlayerState, kind: DiscKind) {
        if (kind === 'flower') {
            if (p.handFlowers <= 0) throw new Error('No flowers left in hand');
            p.handFlowers -= 1;
        } else {
            if (p.handSkulls <= 0) throw new Error('No skull left in hand');
            p.handSkulls -= 1;
        }
    }

    private removeRandomDisc(playerId: string): DiscKind {
        const p = this.data.players[playerId];
        const total = p.ownedFlowers + p.ownedSkulls;
        if (total <= 0) return 'flower';
        const pick = randInt(total);
        if (pick < p.ownedSkulls) {
            p.ownedSkulls -= 1;
            return 'skull';
        }
        p.ownedFlowers -= 1;
        return 'flower';
    }

    private requirePlayer(playerId: string): PlayerState {
        const p = this.data.players[playerId];
        if (!p) throw new Error('Unknown player');
        return p;
    }

    private requireTurn(playerId: string) {
        if (playerId !== this.data.currentPlayerId) {
            throw new Error('It is not your turn');
        }
        const p = this.requirePlayer(playerId);
        if (p.eliminated) throw new Error('Eliminated players cannot act');
    }

    public activePlayers(): string[] {
        return this.playerIds.filter(id => !this.data.players[id].eliminated);
    }

    // The disc count that both bounds the bid and defines "on the table".
    private totalOnTable(): number {
        let n = 0;
        for (const id of this.playerIds) n += this.data.players[id].stack.length;
        return n;
    }

    // Next active player clockwise after `fromId` (skips eliminated). Returns
    // `fromId` if they are somehow the only active player.
    private nextActive(fromId: string): string {
        const n = this.playerIds.length;
        const start = this.playerIds.indexOf(fromId);
        for (let step = 1; step <= n; step++) {
            const id = this.playerIds[(start + step) % n];
            if (!this.data.players[id].eliminated) return id;
        }
        return fromId;
    }

    // Next active, non-passed bidder after `fromId`. null if none exist.
    private nextEligible(fromId: string): string | null {
        const n = this.playerIds.length;
        const start = this.playerIds.indexOf(fromId);
        for (let step = 1; step <= n; step++) {
            const id = this.playerIds[(start + step) % n];
            const p = this.data.players[id];
            if (!p.eliminated && !p.passed) return id;
        }
        return null;
    }

    // If `id` is eliminated, return the next active player instead.
    private activeOrNext(id: string): string {
        if (id && this.data.players[id] && !this.data.players[id].eliminated) return id;
        return this.nextActive(id || this.playerIds[0]);
    }

    // ==========================================================
    // Getters for the view layer
    // ==========================================================

    public get_status(): Phase {
        return this.data.status;
    }

    public get_player(playerId: string): PlayerState | undefined {
        return this.data.players[playerId];
    }

    // Which opponent stacks the challenger can still flip.
    public get_flippable(challengerId: string): string[] {
        if (this.data.status !== Phase.Challenge || challengerId !== this.data.challengerId) {
            return [];
        }
        return this.activePlayers().filter(id =>
            id !== challengerId && this.data.players[id].revealed < this.data.players[id].stack.length);
    }
}
