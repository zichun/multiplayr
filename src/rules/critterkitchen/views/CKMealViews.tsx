/**
 * CKMealViews.tsx — the kitchen workbenches: challenge plates, the 7-course
 * critic plate and the fridge. Plates are drafted locally (UI-only state) and
 * previewed with the same pure maths the host validates with (CKMeals).
 */

import * as React from 'react';
import { Item, IngType, ING_TYPES, ING_NAMES, CHALLENGE_BY_ID, trackStars, RUMOR_BY_ID, RumorId } from '../CKData';
import {
    ChallengePlate, CriticPlate, PlateIng, evaluateChallenge, evaluateCritic, itemMap, plateItemIds, MealCtx,
    suggestChallengePlate, suggestCriticPlate, emptyCriticPlate, criticPlateIds, canServeAs, isSpiceLike,
    spiceFits, baseValue, isServableIngredient, criticQuality
} from '../CKMeals';
import { ING_TINTS, ING_COLORS } from '../CKAssets';
import { Tok, Icon, sortItems, CKCard } from './CKBits';
import sfx from '../CKSound';

// ---------------------------------------------------------------------------
// shared shelf
// ---------------------------------------------------------------------------

const Shelf: React.FC<{
    items: Item[];
    used: Set<number>;
    onTap: (it: Item) => void;
    disabled?: (it: Item) => boolean;
    label?: string;
}> = ({ items, used, onTap, disabled, label }) => {
    const free = sortItems(items.filter(i => !used.has(i.id)));
    return (
        <div className="ck-shelf">
            <div className="ck-shelf-label">{label || 'Your storage'} <span className="ck-muted">· tap to plate</span></div>
            <div className="ck-shelf-row">
                {free.map(it => (
                    <Tok key={it.id} item={it} size={38} onClick={() => onTap(it)} dim={disabled ? disabled(it) : false} />
                ))}
                {!free.length && <span className="ck-muted">Everything is plated.</span>}
            </div>
        </div>
    );
};

const Stars: React.FC<{ n: number }> = ({ n }) => (
    <span className="ck-stars-inline">{Array.from({ length: n }).map((_, i) => <Icon key={i} id="star" size={14} />)}</span>
);

// ---------------------------------------------------------------------------
// challenge builder
// ---------------------------------------------------------------------------

interface ChallengeProps {
    offered: { id: string; req: IngType[]; hippo: boolean }[];
    storage: Item[];
    ctx: MealCtx;
    submitted: ChallengePlate[] | null;
    waitingOn: string[];
    nameOf: (id: string) => string;
    onSubmit: (plates: ChallengePlate[]) => void;
    onEdit: () => void;
}

interface ChallengeState { plates: ChallengePlate[]; active: number; }

export class ChallengeBuilder extends React.Component<ChallengeProps, ChallengeState> {
    constructor(props: ChallengeProps) {
        super(props);
        this.state = {
            plates: props.submitted ? props.offered.map((_, slot) => props.submitted!.find(p => p.slot === slot) || { slot, ings: [], soups: [] })
                : props.offered.map((_, slot) => ({ slot, ings: [], soups: [] })),
            active: 0
        };
    }

    private used(): Set<number> {
        const s = new Set<number>();
        this.state.plates.forEach(p => plateItemIds(p).forEach(id => s.add(id)));
        return s;
    }

    private setPlate(i: number, fn: (p: ChallengePlate) => ChallengePlate) {
        this.setState(s => ({ plates: s.plates.map((p, j) => j === i ? fn(JSON.parse(JSON.stringify(p))) : p) }));
    }

    /** Season the best unspiced ingredient on plate `i`; false if nothing fits. */
    private season(i: number, it: Item): boolean {
        const { ctx } = this.props;
        const map = itemMap(this.props.storage);
        const plate = this.state.plates[i];
        const cands = plate.ings
            .map((pi, idx) => ({ pi, idx, ing: map[pi.id] }))
            .filter(x => (x.pi.spice === undefined || x.pi.spice === null) && spiceFits(it, x.ing, ctx, 'challenge'))
            .sort((a, b) => baseValue(b.ing, ctx, 'challenge') - baseValue(a.ing, ctx, 'challenge'));
        if (!cands.length) return false;
        const target = cands[0];
        this.setPlate(i, p => {
            p.ings[target.idx].spice = it.id;
            // Herón Sanchez: one spice covers every matching ingredient on the plate
            if (ctx.rest === 'heron') p.ings.forEach(x => { if ((x.spice === undefined || x.spice === null) && map[x.id].t === target.ing.t) x.spice = it.id; });
            return p;
        });
        return true;
    }

    private tap = (it: Item) => {
        const { ctx, offered } = this.props;
        const i = this.state.active;
        const req = offered[i].req;
        const fitsReq = isServableIngredient(it, ctx) && req.some(t => canServeAs(it, t, ctx, 'challenge'));
        let ok = false;
        if (it.k === 'soup' || it.k === 'bisque') {
            this.setPlate(i, p => { p.soups.push(it.id); return p; });
            ok = true;
        } else if (it.k === 'spice') {
            ok = this.season(i, it);
            if (!ok && fitsReq) { this.setPlate(i, p => { p.ings.push({ id: it.id }); return p; }); ok = true; } // Emeril
        } else if (fitsReq) {
            this.setPlate(i, p => { p.ings.push({ id: it.id }); return p; });
            ok = true;
        } else if (isSpiceLike(it, ctx, 'challenge')) {
            ok = this.season(i, it); // Saint Bernard: wine as allspice
        }
        if (ok) sfx.plate(); else sfx.buzz();
    };

    private removeIng(i: number, idx: number) {
        this.setPlate(i, p => { p.ings.splice(idx, 1); return p; });
    }
    private removeSpice(i: number, idx: number) {
        this.setPlate(i, p => { delete p.ings[idx].spice; return p; });
    }
    private removeSoup(i: number, idx: number) {
        this.setPlate(i, p => { p.soups.splice(idx, 1); return p; });
    }

    private suggest(i: number) {
        const used = this.used();
        plateItemIds(this.state.plates[i]).forEach(id => used.delete(id));
        const pl = suggestChallengePlate(i, this.props.offered[i].req, this.props.storage, this.props.ctx, used);
        this.setPlate(i, () => pl);
        sfx.plate();
    }

    public render() {
        const { offered, storage, ctx, submitted } = this.props;
        const map = itemMap(storage);
        const evs = this.state.plates.map((p, i) => (p.ings.length || p.soups.length) ? evaluateChallenge(p, offered[i].req, map, ctx) : null);
        const serving = evs.filter(e => e && e.ok && e.baseStars > 0).length;
        const invalid = evs.some(e => e && !e.ok);
        const total = evs.reduce((a, e) => a + (e && e.ok ? e.stars : 0), 0);
        if (submitted) {
            return (
                <div className="ck-bench done">
                    <div className="ck-bench-head">
                        <b>Meals served!</b>
                        <span className="ck-muted">Waiting for {this.props.waitingOn.map(this.props.nameOf).join(', ') || 'the kitchen'}…</span>
                        <button className="ck-btn ghost small" onClick={this.props.onEdit}>Edit plates</button>
                    </div>
                </div>
            );
        }
        return (
            <div className="ck-bench">
                <div className="ck-bench-head">
                    <b>Challenge meals</b>
                    <span className="ck-muted">Tap a plate, then tap ingredients. Soup fills a missing requirement.</span>
                </div>
                <div className="ck-plates">
                    {offered.map((o, i) => {
                        const p = this.state.plates[i];
                        const ev = evs[i];
                        const active = this.state.active === i;
                        const def = CHALLENGE_BY_ID[o.id];
                        return (
                            <div key={i} className={['ck-plate', active ? 'active' : '', ev && ev.ok && ev.baseStars ? 'scoring' : ''].join(' ')}
                                onClick={() => this.setState({ active: i })}>
                                <div className="ck-plate-head">
                                    <span className="ck-plate-name">{def.name}{o.hippo ? ' · Hippo' : ''}</span>
                                    <span className="ck-plate-req">
                                        {def.req.map((t, j) => (
                                            <span key={j} className={['ck-req', j >= o.req.length ? 'held' : '', ev && ev.covered[j] ? 'met' : ''].join(' ')}>
                                                <Icon id={j >= o.req.length ? 'hold' : `ing_${t}`} size={22} />
                                            </span>
                                        ))}
                                    </span>
                                </div>
                                <div className="ck-plate-dish">
                                    {p.ings.map((pi, idx) => (
                                        <span key={pi.id} className="ck-dish-item">
                                            <Tok item={map[pi.id]} size={36} onClick={() => this.removeIng(i, idx)}
                                                spice={pi.spice !== undefined && pi.spice !== null ? map[pi.spice] : null} />
                                            {pi.spice !== undefined && pi.spice !== null && (
                                                <button className="ck-unspice" onClick={e => { e.stopPropagation(); this.removeSpice(i, idx); }}>−spice</button>
                                            )}
                                        </span>
                                    ))}
                                    {p.soups.map((sid, idx) => (
                                        <Tok key={sid} item={map[sid]} size={32} onClick={() => this.removeSoup(i, idx)} />
                                    ))}
                                    {!p.ings.length && !p.soups.length && <span className="ck-plate-empty">empty plate</span>}
                                </div>
                                <div className="ck-plate-foot">
                                    {ev ? (ev.ok
                                        ? <span className={ev.baseStars ? 'ok' : 'warn'}>Quality <b>{ev.quality}</b> {ev.baseStars ? <Stars n={ev.stars} /> : '· needs 6+'}</span>
                                        : <span className="bad">{ev.error}</span>)
                                        : <span className="ck-muted">Skip, or plate a meal</span>}
                                    <span className="ck-plate-actions">
                                        <button className="ck-btn tiny ghost" onClick={e => { e.stopPropagation(); this.suggest(i); }}>Suggest</button>
                                        {(p.ings.length > 0 || p.soups.length > 0) && <button className="ck-btn tiny ghost" onClick={e => { e.stopPropagation(); this.setPlate(i, () => ({ slot: i, ings: [], soups: [] })); }}>Clear</button>}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <Shelf items={storage} used={this.used()} onTap={this.tap} label={`Plating for ${CHALLENGE_BY_ID[offered[this.state.active].id].name}`} />
                <div className="ck-bench-actions">
                    <span className="ck-muted">{serving} meal{serving === 1 ? '' : 's'} ready · {total} <Icon id="star" size={13} /></span>
                    <button className="ck-btn primary" disabled={invalid}
                        onClick={() => {
                            const plates = this.state.plates.filter((p, i) => evs[i] && evs[i]!.ok && evs[i]!.baseStars > 0);
                            sfx.lock();
                            this.props.onSubmit(plates);
                        }}>
                        {serving ? 'Serve meals' : 'Serve nothing'}
                    </button>
                </div>
            </div>
        );
    }
}

// ---------------------------------------------------------------------------
// critic builder
// ---------------------------------------------------------------------------

interface CriticProps {
    pool: Item[];
    ctx: MealCtx;
    critic: string;
    knownRumors: RumorId[];
    submitted: CriticPlate | null;
    waitingOn: string[];
    nameOf: (id: string) => string;
    onSubmit: (plate: CriticPlate) => void;
    onEdit: () => void;
}

interface CriticState { plate: CriticPlate; active: IngType; }

export class CriticBuilder extends React.Component<CriticProps, CriticState> {
    constructor(props: CriticProps) {
        super(props);
        const plate: CriticPlate = props.submitted ? JSON.parse(JSON.stringify(props.submitted)) : emptyCriticPlate();
        ING_TYPES.forEach(t => { if (!plate[t]) plate[t] = { ings: [] }; });
        this.state = { plate, active: 'bread' };
    }

    private mutate(fn: (p: CriticPlate) => void) {
        this.setState(s => { const p = JSON.parse(JSON.stringify(s.plate)); fn(p); return { plate: p }; });
        sfx.plate();
    }

    /** Season the best unspiced ingredient, active course first. */
    private season(it: Item): boolean {
        const { ctx } = this.props;
        const map = itemMap(this.props.pool);
        const val = (x: Item) => baseValue(x, ctx, 'critic');
        const order: IngType[] = [this.state.active, ...ING_TYPES.filter(t => t !== this.state.active)];
        for (const t of order) {
            const c = this.state.plate[t]!;
            const cands = c.ings.map((pi, idx) => ({ pi, idx, ing: map[pi.id] }))
                .filter(x => (x.pi.spice === undefined || x.pi.spice === null) && spiceFits(it, x.ing, ctx, 'critic'))
                .sort((a, b) => val(b.ing) - val(a.ing));
            if (cands.length) {
                this.mutate(p => { p[t]!.ings[cands[0].idx].spice = it.id; });
                return true;
            }
        }
        return false;
    }

    /** Add as an ingredient: natural course first, else the active course. */
    private plateIng(it: Item): boolean {
        const { ctx } = this.props;
        const map = itemMap(this.props.pool);
        const active = this.state.active;
        const natural = it.k === 'ing' ? it.t as IngType : null;
        const hyena = ctx.critic === 'hyena' && active === 'fish' && it.k === 'ing' && it.v === 3;
        const targets: IngType[] = [];
        if (natural && active === natural) targets.push(natural);
        if (canServeAs(it, active, ctx, 'critic') || hyena) targets.push(active);
        if (natural && targets.indexOf(natural) < 0) targets.push(natural);
        ING_TYPES.forEach(t => { if (targets.indexOf(t) < 0 && canServeAs(it, t, ctx, 'critic')) targets.push(t); });
        for (const t of targets) {
            const trial: CriticPlate = JSON.parse(JSON.stringify(this.state.plate));
            trial[t]!.ings.push({ id: it.id });
            if (evaluateCritic(trial, map, ctx).ok || !evaluateCritic(this.state.plate, map, ctx).ok) {
                this.mutate(p => { p[t]!.ings.push({ id: it.id }); });
                this.setState({ active: t });
                return true;
            }
        }
        return false;
    }

    private tap = (it: Item) => {
        const { ctx } = this.props;
        const map = itemMap(this.props.pool);
        const plate = this.state.plate;
        const active = this.state.active;
        // Fruit Bat: a wine matching the active course's top value pairs with it
        if (this.props.critic === 'fruitbat' && it.k === 'ing' && it.t === 'wine' && active !== 'wine') {
            const c = plate[active]!;
            const top = Math.max(0, ...c.ings.map(pi => baseValue(map[pi.id], ctx, 'critic')));
            if (c.ings.length && (c.bat === undefined || c.bat === null) && baseValue(it, ctx, 'critic') === top) {
                this.mutate(p => { p[active]!.bat = it.id; });
                return;
            }
        }
        let ok = false;
        if (it.k === 'spice' || it.k === 'rumor') {
            ok = this.season(it) || (it.k === 'spice' && isServableIngredient(it, ctx) && this.plateIng(it));
        } else if (it.k === 'ing') {
            ok = this.plateIng(it) || (isSpiceLike(it, ctx, 'critic') && this.season(it));
        }
        if (!ok) sfx.buzz();
    };

    private remove(t: IngType, idx: number) {
        this.mutate(p => { p[t]!.ings.splice(idx, 1); });
    }
    private unspice(t: IngType, idx: number) {
        this.mutate(p => { delete p[t]!.ings[idx].spice; });
    }
    private unbat(t: IngType) {
        this.mutate(p => { delete p[t]!.bat; });
    }

    public render() {
        const { pool, ctx, submitted, knownRumors } = this.props;
        const map = itemMap(pool);
        const ev = evaluateCritic(this.state.plate, map, ctx);
        const used = new Set(criticPlateIds(this.state.plate));
        const quality = ev.ok ? criticQuality(ev, knownRumors) : 0;
        const fanatics = new Set(knownRumors.map(r => RUMOR_BY_ID[r]?.fanatic).filter(Boolean));
        if (submitted) {
            return (
                <div className="ck-bench done">
                    <div className="ck-bench-head">
                        <b>Plate sent to the critic!</b>
                        <span className="ck-muted">Waiting for {this.props.waitingOn.map(this.props.nameOf).join(', ') || 'the kitchen'}…</span>
                        <button className="ck-btn ghost small" onClick={this.props.onEdit}>Edit plate</button>
                    </div>
                </div>
            );
        }
        return (
            <div className="ck-bench critic">
                <div className="ck-bench-head">
                    <b>The critic&rsquo;s 7-course meal</b>
                    <span className="ck-muted">One ingredient per course (plus one spice). No soup!</span>
                </div>
                <div className="ck-courses">
                    {ING_TYPES.map(t => {
                        const c = this.state.plate[t]!;
                        const ce = ev.ok ? ev.courses.find(x => x.type === t)! : null;
                        return (
                            <div key={t} className={['ck-course', this.state.active === t ? 'active' : '', c.ings.length ? 'filled' : ''].join(' ')}
                                style={{ ['--tint' as any]: ING_TINTS[t], ['--ing' as any]: ING_COLORS[t] }}
                                onClick={() => this.setState({ active: t })}>
                                <div className="ck-course-head"><Icon id={`ing_${t}`} size={18} /><span>{ING_NAMES[t]}</span>{fanatics.has(t) && <em>×2</em>}</div>
                                <div className="ck-course-dish">
                                    {c.ings.map((pi, idx) => (
                                        <span key={pi.id} className="ck-dish-item">
                                            <Tok item={map[pi.id]} size={34} onClick={() => this.remove(t, idx)}
                                                spice={pi.spice !== undefined && pi.spice !== null ? map[pi.spice] : null} />
                                            {pi.spice !== undefined && pi.spice !== null && (
                                                <button className="ck-unspice" onClick={e => { e.stopPropagation(); this.unspice(t, idx); }}>−</button>
                                            )}
                                        </span>
                                    ))}
                                    {c.bat !== undefined && c.bat !== null && <Tok item={map[c.bat]} size={26} onClick={() => this.unbat(t)} title="Paired wine (Fruit Bat)" />}
                                </div>
                                <div className="ck-course-q">{ce && ce.served ? ce.quality * (fanatics.has(t) ? 2 : 1) : '–'}</div>
                            </div>
                        );
                    })}
                </div>
                {!ev.ok && <div className="ck-bench-error">{ev.error}</div>}
                <Shelf items={pool} used={used} onTap={this.tap} label={`Adding to ${ING_NAMES[this.state.active]}`} />
                <div className="ck-bench-actions">
                    <span className="ck-muted">Quality <b>{quality}</b> → {trackStars(quality)} <Icon id="star" size={13} /> on the track</span>
                    <button className="ck-btn ghost" onClick={() => this.setState({ plate: Object.assign(emptyCriticPlate(), suggestCriticPlate(pool, ctx)) })}>Suggest</button>
                    <button className="ck-btn primary" disabled={!ev.ok} onClick={() => { sfx.lock(); this.props.onSubmit(this.state.plate); }}>Present to the critic</button>
                </div>
            </div>
        );
    }
}

// ---------------------------------------------------------------------------
// fridge
// ---------------------------------------------------------------------------

interface FridgeProps {
    storage: Item[];
    limit: number;
    over: number;
    counts: (it: Item) => boolean;
    submitted: number[] | null;
    waitingOn: string[];
    nameOf: (id: string) => string;
    onSubmit: (discard: number[]) => void;
}

export class FridgePanel extends React.Component<FridgeProps, { out: number[] }> {
    state = { out: [] as number[] };
    private toggle(id: number) {
        this.setState(s => ({ out: s.out.indexOf(id) >= 0 ? s.out.filter(x => x !== id) : [...s.out, id] }));
        sfx.tap();
    }
    public render() {
        const { storage, limit, over, counts, submitted } = this.props;
        if (submitted || over <= 0) {
            return (
                <div className="ck-bench done">
                    <div className="ck-bench-head">
                        <Icon id="fridge" size={26} />
                        <b>Fridge is packed.</b>
                        <span className="ck-muted">Waiting for {this.props.waitingOn.map(this.props.nameOf).join(', ') || 'the kitchen'}…</span>
                    </div>
                </div>
            );
        }
        const cold = sortItems(storage.filter(counts));
        const remaining = Math.max(0, over - this.state.out.length);
        return (
            <div className="ck-bench">
                <div className="ck-bench-head">
                    <Icon id="fridge" size={26} />
                    <b>Refrigerate: keep {limit}</b>
                    <span className="ck-muted">Tap ingredients or spices to return to the bag. Soup and rumors keep for free.</span>
                </div>
                <div className="ck-shelf-row big">
                    {cold.map(it => (
                        <Tok key={it.id} item={it} size={42} onClick={() => this.toggle(it.id)} marked={this.state.out.indexOf(it.id) >= 0} />
                    ))}
                </div>
                <div className="ck-bench-actions">
                    <span className={remaining ? 'ck-warn' : 'ck-ok'}>{remaining ? `Return ${remaining} more` : 'All set'}</span>
                    <button className="ck-btn primary" disabled={remaining > 0} onClick={() => { sfx.lock(); this.props.onSubmit(this.state.out); }}>Close the fridge</button>
                </div>
            </div>
        );
    }
}

export { CKCard };
