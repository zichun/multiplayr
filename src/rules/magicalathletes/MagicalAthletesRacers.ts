/**
 * MagicalAthletesRacers.ts
 *
 * The complete "character brain" for all 36 racers. The core race engine knows
 * NOTHING about any specific character — it exposes a generic `RaceCtx` of
 * primitives (move / warp / trip / roll / decide / …) and, at each well-defined
 * trigger point, invokes the matching hook for whichever racers are involved. All
 * per-character behaviour — mandatory and interactive alike — lives here, so the
 * engine contains no `if (powerId === 'x')` branches.
 *
 * Human choices ("CAN" powers) flow through `ctx.decide(...)`, which pauses the
 * turn until the owning player answers; the engine then replays the turn
 * deterministically with the cached answer. A hook is written as if the answer is
 * available synchronously.
 *
 * Trigger points (the engine calls these; `ctx.self` is the racer whose hook runs,
 * `ctx.mover` is the racer whose turn it is / who acted):
 *   beforeRace      once per racer at race start                     (self only)
 *   effectivePower  turn start: return the racer's live power id      (self=mover)
 *   beforeMove      before the main move                             (self=mover)
 *   chooseMove      may replace the roll; return true if it did       (self=mover)
 *   reroll          may reroll the die; return the (new) die          (self=mover / Dicemonger)
 *   onRoll          broadcast reaction to the rolled die              (self=each active)
 *   postRoll        mover's reaction to the final die                 (self=mover)
 *   moveMod         broadcast move-amount modifier                    (self=each active)
 *   onPass          self (the mover) passed `other`                   (self=mover)
 *   onPassed        self was passed by `mover`                        (self=passed)
 *   afterAnyMove    broadcast after any move                          (self=each active)
 *   onStop          self stopped                                      (self=stopper)
 *   onOtherStop     broadcast: someone else stopped                   (self=each other)
 *   onShare         self shares a space with `other` after a stop     (self=stopper/among)
 *   follow          a racer sharing self's space moved off it         (self=sharer)
 *   onTurnEnd       broadcast: `mover` ended its turn                 (self=each active)
 *   onAnyPower      broadcast: a power fired (byOwner)                 (self=each active)
 *   onReroll        broadcast: a reroll happened (byOwner)            (self=each active)
 */

import { RacerState, Track, MoveKind, DecisionOption, GameEvent, ROSTER_BY_ID } from './MagicalAthletesGameState';

export interface RaceCtx {
    self: RacerState;
    mover: RacerState;
    track: Track;

    // ---- queries ----
    active(): RacerState[];
    others(of?: RacerState): RacerState[];
    leaders(): RacerState[];
    lastPlace(): RacerState[];
    onSpace(pos: number, exceptOwner?: string): RacerState[];
    othersOnSpaceOf(r: RacerState): RacerState[];
    twoRacerSpaces(exceptOwner: string): number[];
    aloneInLead(r: RacerState): boolean;
    aloneInLast(r: RacerState): boolean;
    pos(r: RacerState): number;
    trackLen(): number;
    allPowerIds(): string[];
    pastWinners(): string[];

    // ---- movement / effect primitives (all recorded for the animation) ----
    move(r: RacerState, steps: number, kind?: MoveKind): void;
    warp(r: RacerState, to: number, kind?: MoveKind): void;
    trip(r: RacerState): void;
    eliminate(r: RacerState): void;
    award(r: RacerState, points: number): void;
    finish(r: RacerState): void;

    // ---- roll / move control ----
    rollDie(): number;                 // seeded (replay-safe)
    rnd(n: number): number;            // seeded (replay-safe)
    setDie(value: number): void;       // change the move's base amount
    cancelMainMove(): void;            // the mover skips its main move
    tripAfterMove(): void;             // schedule a trip once the move completes
    grantExtraTurn(): void;
    endRaceNow(): void;
    goNext(owner: string): void;       // that racer takes the next turn
    rerolled(byOwner: string): void;   // signal a reroll (feeds Dicemonger + Scoocher)
    fire(byOwner: string): void;       // signal a power fired (feeds Scoocher)

    // ---- decisions & flags ----
    decide(playerId: string, key: string, prompt: string, options: DecisionOption[]): string;
    answered(key: string): string | undefined;

    // ---- io ----
    emit(kind: GameEvent['kind'], text: string, actor?: string): void;
    nm(racerId: string): string;
}

export interface RacerHooks {
    // Passive capabilities the engine checks generically.
    leapsOverOccupied?: boolean;       // Leaptoad
    blocksOthersOvershoot?: boolean;   // Stickler
    offersRerollToOthers?: boolean;    // Dicemonger

    beforeRace?(ctx: RaceCtx): void;
    effectivePower?(ctx: RaceCtx): string;
    beforeMove?(ctx: RaceCtx): void;
    chooseMove?(ctx: RaceCtx): boolean;
    reroll?(ctx: RaceCtx, die: number): number;
    onRoll?(ctx: RaceCtx, die: number): void;
    postRoll?(ctx: RaceCtx, die: number): void;
    moveMod?(ctx: RaceCtx, amount: number): number;
    onPass?(ctx: RaceCtx, other: RacerState): void;
    onPassed?(ctx: RaceCtx, mover: RacerState): void;
    afterAnyMove?(ctx: RaceCtx, moved: RacerState, fromPos: number): void;
    onStop?(ctx: RaceCtx): void;
    onOtherStop?(ctx: RaceCtx, stopper: RacerState): void;
    onShare?(ctx: RaceCtx, other: RacerState): void;
    follow?(ctx: RaceCtx, mover: RacerState): void;
    onTurnEnd?(ctx: RaceCtx, startPos: number): void;
    onAnyPower?(ctx: RaceCtx, byOwner: string): void;
    onReroll?(ctx: RaceCtx, byOwner: string): void;
}

const YES: DecisionOption[] = [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }];

function shuffled<T>(arr: T[], ctx: RaceCtx): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = ctx.rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
}
function powerOptions(ctx: RaceCtx, ids: string[]): DecisionOption[] {
    return ids.map(id => {
        const def = ROSTER_BY_ID[id];
        return { id, label: def ? `${def.name} — ${def.title}` : id };
    });
}

// ============================================================================
// The 36 characters
// ============================================================================

export const RACER_HOOKS: Record<string, RacerHooks> = {

    // ---- mandatory: move-amount auras & self-modifiers ----
    hare: {
        onRoll(ctx, _die) {
            if (ctx.self.ownerId === ctx.mover.ownerId && ctx.active().length > 1 && ctx.aloneInLead(ctx.self)) {
                ctx.cancelMainMove();
                ctx.emit('power', `${ctx.nm('hare')} struts and skips the move (alone in front).`, ctx.self.ownerId);
            }
        },
        moveMod(ctx, amount) { return ctx.self.ownerId === ctx.mover.ownerId ? amount + 2 : amount; }
    },
    blimp: {
        moveMod(ctx, amount) {
            if (ctx.self.ownerId !== ctx.mover.ownerId) return amount;
            return amount + (ctx.pos(ctx.self) < ctx.track.secondCorner ? 2 : -1);
        }
    },
    coach: {
        // +1 to everyone on the coach's space, including the coach.
        moveMod(ctx, amount) { return ctx.pos(ctx.self) === ctx.pos(ctx.mover) ? amount + 1 : amount; }
    },
    gunk: {
        moveMod(ctx, amount) { return ctx.self.ownerId !== ctx.mover.ownerId ? amount - 1 : amount; }
    },
    partyanimal: {
        beforeMove(ctx) {
            for (const o of ctx.others(ctx.self)) {
                const dir = ctx.pos(o) < ctx.pos(ctx.self) ? 1 : ctx.pos(o) > ctx.pos(ctx.self) ? -1 : 0;
                if (dir !== 0) ctx.move(o, dir);
            }
            ctx.emit('power', `${ctx.nm('partyanimal')} draws the crowd in.`, ctx.self.ownerId);
            ctx.fire(ctx.self.ownerId);
        },
        moveMod(ctx, amount) {
            return ctx.self.ownerId === ctx.mover.ownerId ? amount + ctx.othersOnSpaceOf(ctx.self).length : amount;
        }
    },

    // ---- mandatory: die-face reactions ----
    lackey: {
        onRoll(ctx, die) {
            if (die === 6 && ctx.self.ownerId !== ctx.mover.ownerId) {
                ctx.move(ctx.self, 2);
                ctx.emit('power', `${ctx.nm('lackey')} scurries 2 on the 6.`, ctx.self.ownerId);
            }
        }
    },
    inchworm: {
        onRoll(ctx, die) {
            if (die === 1 && ctx.self.ownerId !== ctx.mover.ownerId) {
                ctx.cancelMainMove();
                ctx.emit('power', `${ctx.nm(ctx.mover.racerId)}'s 1 is wriggled away.`, ctx.mover.ownerId);
                ctx.move(ctx.self, 1);
            }
        }
    },
    skipper: {
        onRoll(ctx, die) {
            if (die === 1 && ctx.self.ownerId !== ctx.mover.ownerId) {
                ctx.goNext(ctx.self.ownerId);
                ctx.emit('power', `${ctx.nm('skipper')} cuts the line!`, ctx.self.ownerId);
            }
        }
    },
    sisyphus: {
        beforeRace(ctx) {
            ctx.award(ctx.self, 4);
            ctx.emit('power', `${ctx.nm('sisyphus')} pockets 4 points before the race.`, ctx.self.ownerId);
        },
        onRoll(ctx, die) {
            if (ctx.self.ownerId === ctx.mover.ownerId && die === 6) {
                ctx.warp(ctx.self, 0);
                ctx.award(ctx.self, -1);
                ctx.cancelMainMove();
                ctx.emit('power', `${ctx.nm('sisyphus')} rolls a 6 and tumbles back to Start.`, ctx.self.ownerId);
                ctx.fire(ctx.self.ownerId);
            }
        }
    },

    // ---- mandatory: passing / stopping / occupancy ----
    centaur: {
        onPass(ctx, other) {
            ctx.move(other, -2);
            ctx.emit('power', `${ctx.nm('centaur')} hoofwhacks ${ctx.nm(other.racerId)} back.`, ctx.self.ownerId);
            ctx.fire(ctx.self.ownerId);
        }
    },
    banana: {
        onPassed(ctx, mover) {
            ctx.trip(mover);
            ctx.emit('trip', `${ctx.nm(mover.racerId)} slips on ${ctx.nm('banana')}!`, mover.ownerId);
            ctx.fire(ctx.self.ownerId);
        }
    },
    hugebaby: {
        afterAnyMove(ctx) {
            if (ctx.pos(ctx.self) <= 0) return;
            const behind = Math.max(0, ctx.pos(ctx.self) - 1);
            for (const o of ctx.others(ctx.self)) {
                if (ctx.pos(o) === ctx.pos(ctx.self)) {
                    ctx.warp(o, behind);
                    ctx.emit('power', `${ctx.nm('hugebaby')} shoves ${ctx.nm(o.racerId)} back.`, ctx.self.ownerId);
                }
            }
        }
    },
    babayaga: {
        onStop(ctx) {
            for (const o of ctx.othersOnSpaceOf(ctx.self)) {
                ctx.trip(o);
                ctx.emit('trip', `${ctx.nm('babayaga')} trips ${ctx.nm(o.racerId)}.`, ctx.self.ownerId);
            }
        },
        onOtherStop(ctx, stopper) {
            if (ctx.pos(stopper) === ctx.pos(ctx.self)) {
                ctx.trip(stopper);
                ctx.emit('trip', `${ctx.nm(stopper.racerId)} stumbles onto ${ctx.nm('babayaga')}.`, ctx.self.ownerId);
            }
        }
    },
    mouth: {
        onStop(ctx) {
            const sharers = ctx.othersOnSpaceOf(ctx.self);
            if (sharers.length === 1) {
                ctx.eliminate(sharers[0]);
                ctx.emit('eliminate', `${ctx.nm('mouth')} chomps ${ctx.nm(sharers[0].racerId)}!`, ctx.self.ownerId);
                ctx.fire(ctx.self.ownerId);
            }
        }
    },
    romantic: {
        onOtherStop(ctx, stopper) {
            if (stopper.ownerId === ctx.self.ownerId) return;
            const sharers = ctx.othersOnSpaceOf(stopper);
            if (sharers.length === 1 && sharers[0].ownerId !== ctx.self.ownerId) {
                ctx.move(ctx.self, 2);
                ctx.emit('power', `${ctx.nm('romantic')} swoons and drifts 2.`, ctx.self.ownerId);
            }
        }
    },

    // ---- mandatory: reactive movers ----
    heckler: {
        onTurnEnd(ctx, startPos) {
            if (ctx.mover.ownerId === ctx.self.ownerId) return;
            if (Math.abs(ctx.pos(ctx.mover) - startPos) > 1) return;
            ctx.move(ctx.self, 2);
            ctx.emit('power', `${ctx.nm('heckler')} cackles and gains 2.`, ctx.self.ownerId);
            if (ctx.pos(ctx.self) >= ctx.trackLen()) ctx.finish(ctx.self);
        }
    },
    scoocher: {
        onAnyPower(ctx, byOwner) {
            if (byOwner === ctx.self.ownerId) return;
            const np = Math.min(ctx.trackLen(), ctx.pos(ctx.self) + 1);
            ctx.warp(ctx.self, np, 'power');
            if (np >= ctx.trackLen()) ctx.finish(ctx.self);
        }
    },

    // ---- mandatory: capabilities ----
    leaptoad: { leapsOverOccupied: true },
    stickler: { blocksOthersOvershoot: true },

    // ---- mandatory: dynamic power / pre-race pickers ----
    copycat: {
        effectivePower(ctx) {
            const lead = ctx.leaders().filter(x => x.ownerId !== ctx.self.ownerId)[0] || ctx.leaders()[0];
            return lead && lead.ownerId !== ctx.self.ownerId ? lead.powerId : 'copycat';
        }
    },
    egg: {
        // Draw 3 racers and let the human keep one of their powers.
        beforeRace(ctx) {
            const pool = ctx.allPowerIds().filter(id => id !== 'egg' && id !== 'twin' && id !== 'copycat');
            const three = shuffled(pool, ctx).slice(0, 3);
            const ans = ctx.decide(ctx.self.ownerId, 'egg', 'Scramble — draw three, keep one power:', powerOptions(ctx, three));
            ctx.self.powerId = ans;
            ctx.emit('power', `${ctx.nm('egg')} scrambles into ${ctx.nm(ans)}'s power.`, ctx.self.ownerId);
        }
    },
    twin: {
        // Copy a past race winner's power (or, in race 1 with no winners yet, draw
        // three like the Egg). Either way the human chooses.
        beforeRace(ctx) {
            const past = Array.from(new Set(ctx.pastWinners().filter(id => id !== 'twin')));
            let options: string[];
            let prompt: string;
            if (past.length > 0) {
                options = past;
                prompt = 'Double Dip — copy a past race winner:';
            } else {
                options = shuffled(ctx.allPowerIds().filter(id => id !== 'twin' && id !== 'egg' && id !== 'copycat'), ctx).slice(0, 3);
                prompt = 'Double Dip — no winners yet; draw three, keep one:';
            }
            const ans = ctx.decide(ctx.self.ownerId, 'twin', prompt, powerOptions(ctx, options));
            ctx.self.powerId = ans;
            ctx.emit('power', `${ctx.nm('twin')} mirrors ${ctx.nm(ans)}.`, ctx.self.ownerId);
        }
    },

    // ============================================================
    // interactive characters (human decisions)
    // ============================================================

    alchemist: {
        postRoll(ctx, die) {
            if (die !== 1 && die !== 2) return;
            const ans = ctx.decide(ctx.self.ownerId, 'alchemist',
                `You rolled a ${die}. Transmute it into a 4?`,
                [{ id: 'yes', label: 'Transmute to 4' }, { id: 'no', label: `Keep ${die}` }]);
            if (ans === 'yes') { ctx.setDie(4); ctx.emit('power', `${ctx.nm('alchemist')} transmutes it into a 4.`, ctx.self.ownerId); }
        }
    },

    lovableloser: {
        beforeMove(ctx) {
            if (ctx.aloneInLast(ctx.self)) {
                ctx.award(ctx.self, 1);
                ctx.emit('star', `${ctx.nm('lovableloser')} earns a pity point.`, ctx.self.ownerId);
            }
        }
    },

    cheerleader: {
        beforeMove(ctx) {
            const last = ctx.lastPlace().filter(x => x.ownerId !== ctx.self.ownerId);
            if (last.length === 0) return;
            const ans = ctx.decide(ctx.self.ownerId, 'cheerleader',
                'Rally the last-place racers? (they move 2, then you move 1)', YES);
            if (ans !== 'yes') return;
            for (const l of last) ctx.move(l, 2);
            ctx.move(ctx.self, 1);
            ctx.emit('power', `${ctx.nm('cheerleader')} rallies the stragglers.`, ctx.self.ownerId);
            ctx.fire(ctx.self.ownerId);
        }
    },

    dicemonger: {
        offersRerollToOthers: true,
        reroll(ctx, die) {
            if (ctx.self.ownerId === ctx.mover.ownerId) return die;
            const ans = ctx.decide(ctx.mover.ownerId, 'dicemonger:reroll',
                `Dicemonger offers a reroll of your ${die}. Take the deal?`,
                [{ id: 'yes', label: 'Reroll' }, { id: 'no', label: `Keep ${die}` }]);
            if (ans !== 'yes') return die;
            const nd = ctx.rollDie();
            ctx.emit('power', `${ctx.nm(ctx.mover.racerId)} takes Dicemonger's deal → ${nd}.`, ctx.mover.ownerId);
            ctx.rerolled(ctx.mover.ownerId);
            return nd;
        },
        onReroll(ctx, byOwner) {
            if (byOwner === ctx.self.ownerId) return;
            ctx.move(ctx.self, 1);
            ctx.emit('power', `${ctx.nm('dicemonger')} profits from the reroll.`, ctx.self.ownerId);
        }
    },

    duelist: {
        onShare(ctx, other) {
            const ans = ctx.decide(ctx.self.ownerId, `duelist:${other.ownerId}`,
                `Duel ${ctx.nm(other.racerId)}? (both roll; higher moves 2, you win ties)`, YES);
            if (ans !== 'yes') return;
            const dr = 1 + ctx.rnd(6), or = 1 + ctx.rnd(6);
            const winner = dr >= or ? ctx.self : other;
            ctx.emit('power', `${ctx.nm('duelist')} duels ${ctx.nm(other.racerId)} (${dr} vs ${or}).`, ctx.self.ownerId);
            ctx.move(winner, 2);
            ctx.fire(ctx.self.ownerId);
        }
    },

    flipflop: {
        chooseMove(ctx) {
            const ahead = ctx.others(ctx.self).filter(x => ctx.pos(x) > ctx.pos(ctx.self))
                .sort((a, b) => ctx.pos(b) - ctx.pos(a));
            if (ahead.length === 0) return false;
            const options: DecisionOption[] = [
                ...ahead.map(x => ({ id: x.ownerId, label: `Swap with ${ctx.nm(x.racerId)}` })),
                { id: 'roll', label: 'Roll the die instead' }
            ];
            const ans = ctx.decide(ctx.self.ownerId, 'flipflop', 'Skip your roll to swap places?', options);
            if (ans === 'roll') return false;
            const t = ahead.find(x => x.ownerId === ans);
            if (!t) return false;
            const a = ctx.pos(ctx.self), b = ctx.pos(t);
            ctx.warp(ctx.self, b);
            ctx.warp(t, a);
            ctx.emit('power', `${ctx.nm('flipflop')} swaps places with ${ctx.nm(t.racerId)}.`, ctx.self.ownerId);
            ctx.fire(ctx.self.ownerId);
            return true;
        }
    },

    genius: {
        beforeMove(ctx) {
            const options: DecisionOption[] = [1, 2, 3, 4, 5, 6].map(n => ({ id: `${n}`, label: `${n}` }));
            ctx.decide(ctx.self.ownerId, 'genius:predict', 'Predict your die roll:', options);
        },
        postRoll(ctx, die) {
            const guess = ctx.answered('genius:predict');
            if (guess && parseInt(guess, 10) === die) {
                ctx.grantExtraTurn();
                ctx.emit('power', `${ctx.nm('genius')} called the ${die} — another turn!`, ctx.self.ownerId);
                ctx.fire(ctx.self.ownerId);
            }
        }
    },

    hypnotist: {
        beforeMove(ctx) {
            const targets = ctx.others(ctx.self).filter(x => ctx.pos(x) !== ctx.pos(ctx.self));
            if (targets.length === 0) return;
            const options: DecisionOption[] = [
                ...targets.map(x => ({ id: x.ownerId, label: `Pull ${ctx.nm(x.racerId)}` })),
                { id: 'none', label: 'No one' }
            ];
            const ans = ctx.decide(ctx.self.ownerId, 'hypnotist', 'Hsssst — warp a racer to your space?', options);
            const t = targets.find(x => x.ownerId === ans);
            if (!t) return;
            ctx.warp(t, ctx.pos(ctx.self));
            ctx.emit('power', `${ctx.nm('hypnotist')} lures ${ctx.nm(t.racerId)} over.`, ctx.self.ownerId);
            ctx.fire(ctx.self.ownerId);
        }
    },

    legs: {
        chooseMove(ctx) {
            const ans = ctx.decide(ctx.self.ownerId, 'legs', 'Jog a steady 5, or roll the die?',
                [{ id: 'jog', label: 'Jog 5' }, { id: 'roll', label: 'Roll the die' }]);
            if (ans !== 'jog') return false;
            ctx.emit('power', `${ctx.nm('legs')} jogs a steady 5.`, ctx.self.ownerId);
            ctx.move(ctx.self, 5, 'main');
            return true;
        }
    },

    magician: {
        reroll(ctx, die) {
            let d = die;
            for (let i = 0; i < 2; i++) {
                const ans = ctx.decide(ctx.self.ownerId, `magician:reroll:${i + 1}`,
                    `You rolled a ${d}. Poof a reroll? (${2 - i} left)`,
                    [{ id: 'yes', label: 'Reroll' }, { id: 'no', label: `Keep ${d}` }]);
                if (ans !== 'yes') break;
                d = ctx.rollDie();
                ctx.emit('power', `${ctx.nm('magician')} poofs a reroll → ${d}.`, ctx.self.ownerId);
                ctx.rerolled(ctx.self.ownerId);
            }
            return d;
        }
    },

    mastermind: {
        beforeMove(ctx) {
            if (ctx.self.flags && ctx.self.flags.predicted) return;
            const field = ctx.others(ctx.self);
            const options: DecisionOption[] = [
                ...field.map(x => ({ id: x.ownerId, label: `${ctx.nm(x.racerId)}` })),
                { id: 'self', label: 'Myself' },
                { id: 'none', label: 'Do not predict' }
            ];
            const ans = ctx.decide(ctx.self.ownerId, 'mastermind', 'Know-It-All — predict the race winner:', options);
            ctx.self.flags.predicted = true;
            if (ans === 'none') { ctx.emit('power', `${ctx.nm('mastermind')} keeps their counsel.`, ctx.self.ownerId); return; }
            const target = ans === 'self' ? ctx.self : field.find(x => x.ownerId === ans);
            if (!target) return;
            if (ctx.rnd(ctx.active().length) === 0) {
                ctx.emit('power', `${ctx.nm('mastermind')} calls it for ${ctx.nm(target.racerId)}!`, ctx.self.ownerId);
                ctx.finish(target);
                ctx.finish(ctx.self);
                ctx.endRaceNow();
            } else {
                ctx.emit('power', `${ctx.nm('mastermind')} ponders the field...`, ctx.self.ownerId);
            }
        }
    },

    rocket: {
        moveMod(ctx, amount) {
            if (ctx.self.ownerId !== ctx.mover.ownerId || amount <= 0) return amount;
            const ans = ctx.decide(ctx.self.ownerId, 'rocket',
                `Kablooey — double your move to ${amount * 2}, then trip?`,
                [{ id: 'yes', label: `Double to ${amount * 2}` }, { id: 'no', label: `Keep ${amount}` }]);
            if (ans !== 'yes') return amount;
            ctx.tripAfterMove();
            ctx.emit('power', `${ctx.nm('rocket')} kabooms to a double ${amount * 2}!`, ctx.self.ownerId);
            return amount * 2;
        }
    },

    suckerfish: {
        follow(ctx, mover) {
            const ans = ctx.decide(ctx.self.ownerId, `suckerfish:${mover.ownerId}:${ctx.pos(mover)}`,
                `Hitch a ride with ${ctx.nm(mover.racerId)}?`, YES);
            if (ans !== 'yes') return;
            ctx.warp(ctx.self, ctx.pos(mover));
            ctx.emit('power', `${ctx.nm('suckerfish')} hitches a ride.`, ctx.self.ownerId);
            ctx.fire(ctx.self.ownerId);
        }
    },

    thirdwheel: {
        beforeMove(ctx) {
            const spots = ctx.twoRacerSpaces(ctx.self.ownerId).filter(p => p !== ctx.pos(ctx.self));
            if (spots.length === 0) return;
            const options: DecisionOption[] = [
                ...spots.sort((a, b) => b - a).map(p => ({ id: `${p}`, label: `Roll through to space ${p}` })),
                { id: 'none', label: 'Stay put' }
            ];
            const ans = ctx.decide(ctx.self.ownerId, 'thirdwheel', 'Roll through to a crowd?', options);
            if (ans === 'none') return;
            const p = parseInt(ans, 10);
            if (isNaN(p)) return;
            ctx.warp(ctx.self, p);
            ctx.emit('power', `${ctx.nm('thirdwheel')} rolls through to a crowd.`, ctx.self.ownerId);
            ctx.fire(ctx.self.ownerId);
        }
    }
};
