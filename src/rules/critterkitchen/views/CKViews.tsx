/**
 * CKViews.tsx — Critter Kitchen screens: lobby, the kitchen arena (menu board,
 * Bistro Bay town board, phase workbenches, your kitchen), rivals, log, rules.
 */

import * as React from 'react';
import { ViewPropsInterface } from '../../../common/interfaces';
import {
    Item, LocId, LOC_BY_ID, ING_TYPES, ING_NAMES, CHEF_NAMES, ZOUS_BY_ID, REST_BY_ID, CRITIC_BY_ID, RUMOR_BY_ID,
    SOUP_PICK, RUMOR_SLOTS, RumorId, itemLabel, CHALLENGE_BY_ID, ChefKind, FRIDGE_LIMIT_DAY1, FRIDGE_LIMIT_DAY2
} from '../CKData';
import { Phase, isZousKey } from '../CKGameState';
import { CKPublic, CKPrivate } from '../CKTypes';
import { LOC_COLORS, ING_COLORS } from '../CKAssets';
import { itemMap, CriticPlate } from '../CKMeals';
import {
    Icon, Tok, ChefHead, StarCount, CKCard, CardRef, CardDetail, Modal, sortItems, SOUP_ITEM
} from './CKBits';
import { ChallengeBuilder, CriticBuilder, FridgePanel } from './CKMealViews';
import { CKRulesView } from './CKRules';
import sfx, { isMuted, setMuted } from '../CKSound';

type Props = ViewPropsInterface & { ck: CKPublic; me: CKPrivate; ckLobby?: any };

const LOC_HINT: Record<LocId, string> = {
    soup: 'Endless soup + leftovers + bisque',
    garden: '', desert: '', water: '', air: '', lantern: '',
    midnight: 'Stocked when it opens — a gamble!',
    academy: 'Zous-chef + today’s leftovers'
};

// ===========================================================================
// lobby
// ===========================================================================

const Toggle: React.FC<{ on: boolean; label: string; hint: string; onChange?: (v: boolean) => void }> = ({ on, label, hint, onChange }) => (
    <button className={['ck-toggle', on ? 'on' : ''].join(' ')} disabled={!onChange} onClick={() => onChange && onChange(!on)}>
        <span className="ck-toggle-knob" />
        <span className="ck-toggle-text"><b>{label}</b><small>{hint}</small></span>
    </button>
);

function LobbyBody(props: Props & { host: boolean }) {
    const mp: any = props.MP;
    const info = props.ckLobby || { players: [], options: {} };
    const o = info.options || {};
    const set = props.host ? (k: string) => (v: boolean) => mp.setOption(k, v) : () => undefined;
    const n = info.players.length;
    return (
        <div className="ck-lobby">
            <div className="ck-lobby-hero">
                <div className="ck-hero-critters">
                    {['mouse', 'rabbit', 'capybara', 'fox', 'panda'].map((a, i) => (
                        <span key={a} className="ck-hero-face" style={{ animationDelay: `${i * 0.12}s` }}><Icon id={`critter_${a === 'mouse' ? 'mouse' : a}`} size={54} /></span>
                    ))}
                </div>
                <h2>Critter Kitchen</h2>
                <p>Send your mouse, lizard and boar chefs around Bistro Bay, cook challenge meals, and wow the critic with a 7-course feast.</p>
            </div>
            {mp.getPluginView('lobby', 'SetNameWithLobby')}
            <div className="ck-lobby-opts">
                <Toggle on={o.restaurateurs !== false} label="Restaurateurs" hint="Each player keeps 1 of 2 owners with a special ability" onChange={props.host ? set('restaurateurs') : undefined} />
                <Toggle on={o.advancedRumors !== false} label="Advanced rumors" hint="Off for a first game" onChange={props.host ? set('advancedRumors') : undefined} />
                <Toggle on={o.expansion !== false} label="À La Cart critters" hint="Expansion critics, restaurateurs & zous-chefs" onChange={props.host ? set('expansion') : undefined} />
            </div>
            <p className="ck-muted">{n} player{n === 1 ? '' : 's'} · Critter Kitchen supports 2–5.</p>
            {!props.host && <div className="ck-waiting">Waiting for the host to open the kitchen…</div>}
        </div>
    );
}

export class CKHostLobby extends React.Component<Props, {}> {
    public render() {
        const mp: any = this.props.MP;
        const links: any = {
            home: { icon: 'utensils', label: 'Lobby', view: <LobbyBody {...this.props} host={true} /> },
            clients: { icon: 'users', label: 'Players', view: mp.getPluginView('lobby', 'host-roommanagement') },
            rules: { icon: 'book', label: 'Rules', view: <CKRulesView /> }
        };
        return mp.getPluginView('gameshell', 'HostShell-Main', { gameName: 'Critter Kitchen', links });
    }
}

export class CKClientLobby extends React.Component<Props, {}> {
    public render() {
        const mp: any = this.props.MP;
        const links: any = {
            home: { icon: 'utensils', label: 'Lobby', view: <LobbyBody {...this.props} host={false} /> },
            rules: { icon: 'book', label: 'Rules', view: <CKRulesView /> }
        };
        return mp.getPluginView('gameshell', 'HostShell-Main', { gameName: 'Critter Kitchen', links });
    }
}

// ===========================================================================
// round track & menu board
// ===========================================================================

const RoundTrack: React.FC<{ round: number; phase: Phase }> = ({ round, phase }) => (
    <div className="ck-track">
        {[1, 2, 3, 4, 5, 6, 7].map(r => {
            const meal = r === 3 || r === 6 ? 'challenge' : r === 7 ? 'critic' : '';
            const state = r < round || phase === Phase.GameOver ? 'past' : r === round ? 'now' : 'next';
            return (
                <React.Fragment key={r}>
                    <span className={['ck-track-dot', state, meal].join(' ')} title={meal ? `Round ${r}: ${meal} meal` : `Round ${r}`}>
                        {meal ? <Icon id={meal === 'critic' ? 'plate_critic' : 'plate_challenge'} size={14} /> : null}
                        <b>{r}</b>
                    </span>
                    {r === 3 || r === 6 ? <span className="ck-track-day" /> : null}
                </React.Fragment>
            );
        })}
    </div>
);

const MenuBoard: React.FC<{ ck: CKPublic; me: CKPrivate; onInspect: (c: CardRef) => void }> = ({ ck, me, onInspect }) => {
    const w = 78;
    return (
        <div className="ck-menu">
            <div className="ck-menu-group">
                <div className="ck-menu-label">Critic</div>
                <CKCard card={{ kind: 'critic', id: ck.critic }} width={w} onClick={() => onInspect({ kind: 'critic', id: ck.critic })} />
            </div>
            <div className="ck-menu-group">
                <div className="ck-menu-label">Challenges <small>day 1 · day 2</small></div>
                <div className="ck-menu-cards">
                    {ck.challenges.map((c, i) => (
                        <React.Fragment key={i}>
                            {i === 3 && <span className="ck-menu-sep" />}
                            {c.revealed && c.id
                                ? <CKCard card={{ kind: 'challenge', id: c.id, held: c.held }} width={w} className="flip-in"
                                    onClick={() => onInspect({ kind: 'challenge', id: c.id!, held: c.held })} />
                                : <CKCard card={{ kind: 'back', of: 'challenge' }} width={w} className="is-back" />}
                        </React.Fragment>
                    ))}
                    {ck.hippo && (
                        <>
                            <span className="ck-menu-sep" />
                            <CKCard card={{ kind: 'challenge', id: ck.hippo }} width={w} className="hippo" onClick={() => onInspect({ kind: 'challenge', id: ck.hippo! })} />
                        </>
                    )}
                </div>
            </div>
            <div className="ck-menu-group">
                <div className="ck-menu-label">Rumors</div>
                <div className="ck-menu-cards">
                    {RUMOR_SLOTS.map((slot, i) => {
                        const id = me.rumorTexts[i] || ck.rumorFaces[i];
                        return id
                            ? <CKCard key={i} card={{ kind: 'rumor', id }} width={w} className={['flip-in', ck.revealed[i] ? 'public' : 'secret'].join(' ')} onClick={() => onInspect({ kind: 'rumor', id })} />
                            : <CKCard key={i} card={{ kind: 'back', of: 'rumor', slot }} width={w} className="is-back" />;
                    })}
                    {me.jamie && <CKCard card={{ kind: 'rumor', id: me.jamie }} width={w} className="secret jamie" onClick={() => onInspect({ kind: 'rumor', id: me.jamie! })} />}
                </div>
            </div>
        </div>
    );
};

// ===========================================================================
// town board
// ===========================================================================

interface TownProps {
    ck: CKPublic;
    me: CKPrivate;
    mode: 'idle' | 'plan' | 'shop';
    draft?: Record<string, LocId>;
    selChef?: string | null;
    onTile?: (l: LocId) => void;
    selItem?: number | null;
    onItem?: (id: number) => void;
}

const LocTile: React.FC<TownProps & { loc: LocId }> = (props) => {
    const { ck, me, loc, mode } = props;
    const def = LOC_BY_ID[loc];
    const items = ck.locItems[loc] || [];
    const isNow = ck.shopLoc === loc;
    const done = ck.resolved.indexOf(loc) >= 0;
    const myPend = ck.pending && ck.pending.pid === me.me;
    const pickHere = myPend && ck.pending!.loc === loc;
    const placements = mode === 'shop' ? (ck.placements[loc] || []) : [];
    const planned = mode === 'plan' && props.draft ? Object.keys(props.draft).filter(k => props.draft![k] === loc) : [];
    const queues = [1, 2, 3].map(cap => placements.filter(p => p.cap === cap));
    const opts = new Set(me.options);
    const tappable = mode === 'plan' && !!props.selChef;
    const accent = (pid: string) => ck.players[pid] ? ck.players[pid].accent : '#999';
    const showSoup = loc === 'soup';
    const midnightClosed = loc === 'midnight' && !done && !isNow;
    return (
        <div className={['ck-loc', isNow ? 'now' : '', done ? 'done' : '', pickHere ? 'mine' : '', tappable ? 'tappable' : ''].join(' ')}
            style={{ ['--loc' as any]: LOC_COLORS[loc] }}
            onClick={() => tappable && props.onTile && props.onTile(loc)}>
            <div className="ck-loc-head">
                <Icon id={`locglyph_${loc}`} size={22} />
                <span className="ck-loc-name">{def.name}</span>
                {done && <span className="ck-loc-done">✓</span>}
            </div>
            <div className="ck-loc-queues">
                {queues.map((q, i) => (
                    <div key={i} className="ck-queue">
                        <span className="ck-queue-cap">{i + 1}</span>
                        {q.map(p => {
                            const k = `${p.key}@${p.pid}`;
                            const active = !!ck.pending && ck.pending.pid === p.pid && ck.pending.key === p.key && ck.pending.loc === loc;
                            return (
                                <span key={k} className="ck-queue-chef">
                                    <ChefHead chefKey={p.key} accent={accent(p.pid)} size={26} active={active}
                                        title={`${ck.players[p.pid]?.name}'s ${isZousKey(p.key) ? ZOUS_BY_ID[p.key.slice(2)].name : CHEF_NAMES[p.key as ChefKind]}`} />
                                    {ck.picked[k] ? <span className="ck-queue-n">{ck.picked[k]}</span> : null}
                                </span>
                            );
                        })}
                    </div>
                ))}
                {planned.length > 0 && (
                    <div className="ck-planned">
                        {planned.map(k => <ChefHead key={k} chefKey={k} accent={accent(me.me)} size={30} ghost={false} />)}
                    </div>
                )}
            </div>
            <div className="ck-loc-items">
                {items.map(it => {
                    const can = pickHere && opts.has(it.id);
                    return (
                        <Tok key={it.id} item={it} size={34} selected={props.selItem === it.id}
                            dim={pickHere && !can}
                            onClick={can && props.onItem ? () => props.onItem!(it.id) : undefined} />
                    );
                })}
                {showSoup && (
                    <Tok item={SOUP_ITEM} size={34} selected={props.selItem === SOUP_PICK} pop={false}
                        onClick={pickHere && opts.has(SOUP_PICK) && props.onItem ? () => props.onItem!(SOUP_PICK) : undefined} />
                )}
                {midnightClosed && <span className="ck-loc-mystery">?</span>}
                {!items.length && !showSoup && !midnightClosed && <span className="ck-loc-empty">{done ? 'sold out' : 'empty'}</span>}
            </div>
            {LOC_HINT[loc] && <div className="ck-loc-hint">{LOC_HINT[loc]}</div>}
        </div>
    );
};

const TownBoard: React.FC<TownProps> = (props) => (
    <div className="ck-town">
        {props.ck.locations.map(l => <LocTile key={l} {...props} loc={l} />)}
    </div>
);

// ===========================================================================
// my kitchen
// ===========================================================================

const RumorSlots: React.FC<{ known: boolean[]; texts: (RumorId | null)[]; onInspect?: (id: RumorId) => void; size?: number }> =
    ({ known, texts, onInspect, size = 26 }) => (
        <span className="ck-rumorslots">
            {RUMOR_SLOTS.map((s, i) => (
                <span key={s} className={['ck-rslot', known[i] ? 'known' : ''].join(' ')}
                    onClick={() => known[i] && texts[i] && onInspect && onInspect(texts[i]!)}
                    title={known[i] && texts[i] ? RUMOR_BY_ID[texts[i]!].name : 'Unknown rumor'}>
                    <Icon id={`rumor_${s}`} size={size} />
                </span>
            ))}
        </span>
    );

function groupStorage(items: Item[]): { item: Item; count: number }[] {
    const out: { item: Item; count: number }[] = [];
    sortItems(items).forEach(it => {
        const prev = out[out.length - 1];
        if (prev && it.k === 'soup' && prev.item.k === 'soup') prev.count++;
        else out.push({ item: it, count: 1 });
    });
    return out;
}

const MyKitchen: React.FC<{ ck: CKPublic; me: CKPrivate; onInspect: (c: CardRef) => void }> = ({ ck, me, onInspect }) => {
    const p = ck.players[me.me];
    if (!p) return null;
    const soupVal = me.storage.reduce((a, i) => a + (i.k === 'soup' ? 1 : i.k === 'bisque' ? 3 : 0), 0);
    const cold = me.storage.filter(i => i.k === 'ing' || i.k === 'spice').length;
    const limit = ck.round <= 3 ? FRIDGE_LIMIT_DAY1 : FRIDGE_LIMIT_DAY2;
    return (
        <div className="ck-kitchen" style={{ ['--acc' as any]: p.accent }}>
            <div className="ck-kitchen-head">
                <span className="ck-kitchen-title">Your kitchen</span>
                <StarCount n={p.stars} size={20} />
                <span className="ck-kitchen-meta" title="Ingredients & spices vs. the next fridge limit">
                    <Icon id="fridge" size={16} /> {cold}/{limit}
                </span>
                <span className="ck-kitchen-meta" title="Soup value"><Icon id="soup" size={16} /> {soupVal}</span>
                <RumorSlots known={p.known} texts={me.rumorTexts} onInspect={id => onInspect({ kind: 'rumor', id })} />
            </div>
            <div className="ck-storage">
                {groupStorage(me.storage).map(g => <Tok key={g.item.id} item={g.item} size={36} count={g.count} />)}
                {!me.storage.length && <span className="ck-muted">Nothing behind your shield yet.</span>}
            </div>
            <div className="ck-kitchen-cards">
                {p.rest && <CKCard card={{ kind: 'rest', id: p.rest }} width={70} onClick={() => onInspect({ kind: 'rest', id: p.rest! })} />}
                {p.zous.map(z => <CKCard key={z} card={{ kind: 'zous', id: z }} width={70} onClick={() => onInspect({ kind: 'zous', id: z })} />)}
                {p.zousNext.map(z => (
                    <div key={z} className="ck-next-zous">
                        <CKCard card={{ kind: 'zous', id: z }} width={70} onClick={() => onInspect({ kind: 'zous', id: z })} />
                        <small>next round</small>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ===========================================================================
// main page
// ===========================================================================

interface MainState {
    inspect: CardRef | null;
    selChef: string | null;
    draft: Record<string, LocId>;
    selItem: number | null;
    restPick: string | null;
    guySlot: number;
    muted: boolean;
}

export class CKMainPage extends React.Component<Props, MainState> {
    constructor(props: Props) {
        super(props);
        this.state = { inspect: null, selChef: null, draft: {}, selItem: null, restPick: null, guySlot: 0, muted: isMuted() };
    }

    private mp(): any { return this.props.MP; }
    private nameOf = (id: string) => (this.props.ck.players[id] ? this.props.ck.players[id].name : 'Someone');

    componentDidUpdate(prev: Props) {
        const ck = this.props.ck, pk = prev.ck;
        if (!ck || !pk) return;
        const me = this.props.me.me;
        const myTurn = ck.pending && ck.pending.pid === me;
        const wasMyTurn = pk.pending && pk.pending.pid === me && pk.pending.key === ck.pending?.key && pk.pending.loc === ck.pending?.loc;
        if (myTurn && !wasMyTurn) sfx.turn();
        if (ck.phase !== pk.phase) {
            if (ck.phase === Phase.Shopping) sfx.run();
            if (ck.phase === Phase.Challenge || ck.phase === Phase.Critic) sfx.bell();
            if (ck.phase === Phase.GameOver) sfx.fanfare();
            if (ck.phase === Phase.Planning) this.setState({ draft: {}, selChef: 'mouse', selItem: null });
        }
        if (ck.round !== pk.round) this.setState({ draft: {}, selChef: 'mouse' });
        const newest = ck.log[ck.log.length - 1];
        const prevNewest = pk.log[pk.log.length - 1];
        if (newest && (!prevNewest || newest.id !== prevNewest.id)) {
            const fresh = ck.log.filter(e => !prevNewest || e.id > prevNewest.id);
            const myStars = fresh.filter(e => e.kind === 'star' && e.pid === me).length;
            if (myStars) sfx.star(myStars);
            else if (fresh.some(e => e.kind === 'soup')) sfx.soup();
            else if (fresh.some(e => e.kind === 'pick')) sfx.pick(fresh.length % 5);
        }
        if (ck.pending?.key !== pk.pending?.key || ck.pending?.loc !== pk.pending?.loc) {
            if (this.state.selItem !== null) this.setState({ selItem: null });
        }
    }

    // ---- planning ----
    private chefKeys(): string[] { return this.props.me.chefKeys; }

    private selChef(): string | null {
        if (this.state.selChef && this.chefKeys().indexOf(this.state.selChef) >= 0) return this.state.selChef;
        return this.chefKeys().find(x => !this.state.draft[x]) || null;
    }

    private assign = (loc: LocId) => {
        const k = this.selChef();
        if (!k) return;
        const draft = { ...this.state.draft };
        // a location holds only one of your chefs: swap if needed
        const other = Object.keys(draft).find(x => draft[x] === loc && x !== k);
        if (other) {
            if (draft[k]) draft[other] = draft[k]; else delete draft[other];
        }
        draft[k] = loc;
        const next = this.chefKeys().find(x => !draft[x]) || null;
        sfx.tap();
        this.setState({ draft, selChef: next });
    };

    private submitPlan = () => {
        sfx.lock();
        this.mp().submitPlan(this.state.draft);
    };

    private renderPlanning() {
        const { ck, me } = this.props;
        const p = ck.players[me.me];
        const keys = this.chefKeys();
        const submitted = !!me.plan;
        const draft = submitted ? me.plan! : this.state.draft;
        const complete = keys.every(k => draft[k]);
        return (
            <div className="ck-panel plan">
                <div className="ck-panel-title">
                    {submitted ? 'Plan locked in' : 'Plan your shopping run'}
                    <span className="ck-muted">{submitted ? `Waiting for ${ck.waitingOn.map(this.nameOf).join(', ')}…` : 'Pick a chef, then tap a location. One chef per location.'}</span>
                </div>
                <div className="ck-chefbar">
                    {keys.map(k => {
                        const loc = draft[k];
                        const sel = !submitted && this.selChef() === k;
                        return (
                            <button key={k} className={['ck-chefslot', sel ? 'sel' : '', loc ? 'set' : ''].join(' ')}
                                disabled={submitted}
                                onClick={() => this.setState({ selChef: k })}
                                style={{ ['--loc' as any]: loc ? LOC_COLORS[loc] : '#ddd' }}>
                                <ChefHead chefKey={k} accent={p.accent} size={34} />
                                <span className="ck-chefslot-name">{isZousKey(k) ? ZOUS_BY_ID[k.slice(2)].name.split(' ')[0] : CHEF_NAMES[k as ChefKind]}</span>
                                <span className="ck-chefslot-loc">
                                    {loc ? <><Icon id={`loc_${loc}`} size={18} />{LOC_BY_ID[loc].name.split(' ')[0]}</> : '—'}
                                </span>
                            </button>
                        );
                    })}
                    <div className="ck-chefbar-actions">
                        {submitted
                            ? <button className="ck-btn ghost" onClick={() => this.mp().unsubmit()}>Change plan</button>
                            : <button className="ck-btn primary" disabled={!complete} onClick={this.submitPlan}>Lock in</button>}
                    </div>
                </div>
                <ReadyChips ck={ck} />
            </div>
        );
    }

    // ---- shopping ----
    private take = () => {
        const id = this.state.selItem;
        if (id === null) return;
        const { ck, me } = this.props;
        const loc = ck.pending!.kind === 'penny' ? 'soup' : ck.pending!.loc;
        const it = id === SOUP_PICK ? SOUP_ITEM : (ck.locItems[loc] || []).find(i => i.id === id);
        if (!it) return;
        if (it.k === 'rumor' && it.r === 'wild') return; // handled by slot buttons
        this.mp().pick(id);
        this.setState({ selItem: null });
        void me;
    };

    private renderShopBanner() {
        const { ck, me } = this.props;
        const pend = ck.pending;
        if (!pend) return null;
        const mine = pend.pid === me.me;
        const who = ck.players[pend.pid];
        const chefName = isZousKey(pend.key) ? ZOUS_BY_ID[pend.key.slice(2)].name : CHEF_NAMES[pend.key as ChefKind];
        const where = pend.kind === 'penny' ? 'the Soup Truck (Penny Penguin)' : LOC_BY_ID[pend.loc].name;
        const loc = pend.kind === 'penny' ? 'soup' : pend.loc;
        const sel = this.state.selItem;
        const selItem = sel === null ? null : sel === SOUP_PICK ? SOUP_ITEM : (ck.locItems[loc] || []).find(i => i.id === sel) || null;
        const known = ck.players[me.me]?.known || [false, false, false];
        const isRest = (id: string) => ck.players[me.me]?.rest === id;
        return (
            <div className={['ck-shopbar', mine ? 'mine' : ''].join(' ')} style={{ ['--acc' as any]: who?.accent, ['--loc' as any]: LOC_COLORS[loc] }}>
                <ChefHead chefKey={pend.key} accent={who?.accent || '#999'} size={40} active={true} />
                <div className="ck-shopbar-text">
                    <b>{mine ? `Your ${chefName}` : `${who?.name}'s ${chefName}`}</b>
                    <span>{mine ? `is shopping at ${where}` : `is picking at ${where}`} · {pend.picksLeft} pick{pend.picksLeft === 1 ? '' : 's'} left</span>
                </div>
                {mine && (
                    <div className="ck-shopbar-actions">
                        {selItem && selItem.k === 'rumor' && selItem.r === 'wild' ? (
                            <span className="ck-wild">
                                <small>Wild rumor → slot</small>
                                {RUMOR_SLOTS.map((s, i) => (
                                    <button key={s} className="ck-btn tiny" disabled={known[i]} onClick={() => { this.mp().pick(sel, i); this.setState({ selItem: null }); }}>
                                        <Icon id={`rumor_${s}`} size={18} />
                                    </button>
                                ))}
                            </span>
                        ) : (
                            <button className="ck-btn primary" disabled={!selItem} onClick={this.take}>
                                {selItem ? <>Take {itemLabel(selItem)}</> : 'Tap an item'}
                            </button>
                        )}
                        {me.canLeave && (
                            <button className="ck-btn ghost" onClick={() => this.mp().leaveEarly(false)}>Leave for <Icon id="soup" size={16} /></button>
                        )}
                        {me.canLeave && isRest('anthony') && (
                            <button className="ck-btn ghost" onClick={() => this.mp().leaveEarly(true)}>Leave for <Icon id="bag" size={16} /></button>
                        )}
                        {me.canStar && <button className="ck-btn ghost" onClick={() => this.mp().takeStar()}>Take <Icon id="star" size={16} /></button>}
                    </div>
                )}
            </div>
        );
    }

    // ---- restaurateurs ----
    private renderRestaurateur() {
        const { ck, me } = this.props;
        const mine = ck.players[me.me];
        const chosen = mine && mine.rest;
        const pick = this.state.restPick;
        return (
            <div className="ck-panel rest">
                <div className="ck-panel-title">
                    {chosen ? 'Restaurateur hired' : 'Choose your restaurateur'}
                    <span className="ck-muted">{chosen ? `Waiting for ${ck.waitingOn.map(this.nameOf).join(', ')}…` : 'Keep one — their stars score at the end of the game.'}</span>
                </div>
                <div className="ck-rest-choices">
                    {(chosen ? [chosen] : me.restOptions).map(r => (
                        <div key={r} className="ck-rest-choice">
                            <CKCard card={{ kind: 'rest', id: r }} width={130} selected={pick === r}
                                onClick={chosen ? undefined : () => { sfx.tap(); this.setState({ restPick: r }); }} />
                            <p>{REST_BY_ID[r].text}</p>
                        </div>
                    ))}
                </div>
                {!chosen && pick === 'guy' && (
                    <div className="ck-guy">Place Guy&rsquo;s wild rumor on:
                        {RUMOR_SLOTS.map((s, i) => (
                            <button key={s} className={['ck-btn tiny', this.state.guySlot === i ? 'primary' : 'ghost'].join(' ')} onClick={() => this.setState({ guySlot: i })}>
                                <Icon id={`rumor_${s}`} size={18} />
                            </button>
                        ))}
                    </div>
                )}
                {!chosen && (
                    <div className="ck-bench-actions">
                        <button className="ck-btn primary" disabled={!pick} onClick={() => { sfx.lock(); this.mp().chooseRestaurateur(pick, this.state.guySlot); }}>Hire</button>
                    </div>
                )}
            </div>
        );
    }

    // ---- arena ----
    private inspect = (c: CardRef) => this.setState({ inspect: c });

    private phaseLine(): string {
        const { ck, me } = this.props;
        const waiting = ck.waitingOn.indexOf(me.me) >= 0;
        switch (ck.phase) {
            case Phase.Restaurateur: return waiting ? 'Hire a restaurateur' : 'Waiting for other kitchens';
            case Phase.Planning: return waiting ? 'Plan where your chefs go' : 'Waiting for plans';
            case Phase.Shopping: return ck.pending && ck.pending.pid === me.me ? 'Your pick!' : `Shopping · ${ck.shopLoc ? LOC_BY_ID[ck.shopLoc].name : ''}`;
            case Phase.Challenge: return waiting ? 'Cook challenge meals' : 'Waiting for meals';
            case Phase.Fridge: return waiting ? 'Pack the fridge' : 'Waiting for fridges';
            case Phase.Critic: return waiting ? 'Cook for the critic' : 'Waiting for the critic meal';
            case Phase.GameOver: return 'The critic has spoken';
        }
        return '';
    }

    private renderArena() {
        const { ck, me } = this.props;
        if (!me.isPlayer) return <div className="ck-arena"><p className="ck-muted">Spectating.</p></div>;
        const p = ck.players[me.me];
        const ctx = me.ctx!;
        let bench: React.ReactNode = null;
        let mode: 'idle' | 'plan' | 'shop' = 'idle';
        switch (ck.phase) {
            case Phase.Restaurateur: bench = this.renderRestaurateur(); break;
            case Phase.Planning: bench = this.renderPlanning(); mode = me.plan ? 'idle' : 'plan'; break;
            case Phase.Shopping: bench = this.renderShopBanner(); mode = 'shop'; break;
            case Phase.Challenge:
                bench = <ChallengeBuilder key={`ch${ck.round}${me.challengePlates ? 's' : 'd'}`} offered={ck.offered} storage={me.storage} ctx={ctx}
                    submitted={me.challengePlates} waitingOn={ck.waitingOn} nameOf={this.nameOf}
                    onSubmit={pl => this.mp().submitChallenges(pl)} onEdit={() => this.mp().unsubmit()} />;
                break;
            case Phase.Fridge:
                bench = <FridgePanel key={`fr${ck.round}`} storage={me.storage} limit={ck.fridgeLimit} over={me.overLimit}
                    counts={(it: Item) => countsForFridge(it, ck.critic)} submitted={me.fridgeDiscard}
                    waitingOn={ck.waitingOn} nameOf={this.nameOf} onSubmit={d => this.mp().submitFridge(d)} />;
                break;
            case Phase.Critic: {
                const knownRumors = [...me.rumorTexts.filter(Boolean) as RumorId[], ...(me.jamie ? [me.jamie] : [])];
                bench = <CriticBuilder key={`cr${me.criticPlate ? 's' : 'd'}`} pool={me.criticPool} ctx={ctx} critic={ck.critic}
                    knownRumors={knownRumors} submitted={me.criticPlate} waitingOn={ck.waitingOn} nameOf={this.nameOf}
                    onSubmit={pl => this.mp().submitCritic(pl)} onEdit={() => this.mp().unsubmit()} />;
                break;
            }
            case Phase.GameOver: bench = <Results ck={ck} me={me} />; break;
        }
        const meal = ck.phase === Phase.Challenge || ck.phase === Phase.Critic || ck.phase === Phase.Fridge;
        return (
            <div className="ck-arena">
                <div className="ck-statusbar" style={{ ['--acc' as any]: p.accent }}>
                    <RoundTrack round={ck.round} phase={ck.phase} />
                    <span className="ck-phase-line" key={this.phaseLine()}>{this.phaseLine()}</span>
                </div>
                {ck.phase !== Phase.GameOver && <MenuBoard ck={ck} me={me} onInspect={this.inspect} />}
                <div className="ck-bench-slot" key={ck.phase}>{bench}</div>
                {!meal && ck.phase !== Phase.GameOver && (
                    <TownBoard ck={ck} me={me} mode={mode} draft={this.state.draft} selChef={this.selChef()}
                        onTile={this.assign} selItem={this.state.selItem}
                        onItem={id => { sfx.tap(); this.setState({ selItem: id }); }} />
                )}
                {ck.phase !== Phase.GameOver && <PriorityTrack ck={ck} />}
                {!meal && ck.phase !== Phase.GameOver && <MyKitchen ck={ck} me={me} onInspect={this.inspect} />}
                {this.state.inspect && <CardDetail card={this.state.inspect} onClose={() => this.setState({ inspect: null })} />}
            </div>
        );
    }

    public render() {
        const { ck, me } = this.props;
        const mp: any = this.props.MP;
        if (!ck || !me) return null;
        const p = ck.players[me.me];
        const attention = ck.waitingOn.indexOf(me.me) >= 0;
        const links: any = {
            home: { icon: 'utensils', label: 'Kitchen', view: this.renderArena() },
            rivals: { icon: 'users', label: 'Rivals', view: <Rivals ck={ck} me={me} onInspect={this.inspect} /> },
            log: { icon: 'list', label: 'Log', view: <LogView ck={ck} /> },
            rules: { icon: 'book', label: 'Rules', view: <CKRulesView /> }
        };
        const settings = (
            <div className="ck-settings">
                <button className="ck-btn ghost" onClick={() => { setMuted(!this.state.muted); this.setState({ muted: !this.state.muted }); }}>
                    {this.state.muted ? 'Unmute sounds' : 'Mute sounds'}
                </button>
                {me.isHost && (
                    <>
                        <div className="ck-settings-note">Someone stuck? Let the kitchen act for them:</div>
                        {ck.waitingOn.map(id => (
                            <button key={id} className="ck-btn ghost" onClick={() => this.mp().autoAct(id)}>Auto-play for {this.nameOf(id)}</button>
                        ))}
                        <button className="ck-btn" onClick={() => this.mp().restartGame()}>Restart game</button>
                        <button className="ck-btn ghost" onClick={() => this.mp().backToLobby()}>Back to lobby</button>
                    </>
                )}
            </div>
        );
        links.settings = { icon: 'cogs', label: 'Settings', view: settings };
        return mp.getPluginView('gameshell', 'HostShell-Main', {
            links,
            gameName: ck.phase === Phase.GameOver ? 'Critter Kitchen' : `Round ${ck.round} · Day ${ck.day}`,
            topBarContent: p ? <span className="ck-topbar"><Icon id="star" size={16} />{p.stars}</span> : null,
            roomClassName: attention ? 'attention-bg' : ''
        });
    }
}

function countsForFridge(it: Item, critic: string): boolean {
    if (it.k === 'ing') {
        if (critic === 'raccoon' && it.v === 2) return false;
        if (critic === 'hyena' && it.v === 3) return false;
        return true;
    }
    if (it.k === 'spice') return critic !== 'pig';
    return false;
}

// ===========================================================================
// shared panels
// ===========================================================================

const ReadyChips: React.FC<{ ck: CKPublic }> = ({ ck }) => (
    <div className="ck-ready">
        {ck.order.map(id => {
            const p = ck.players[id];
            const ready = ck.waitingOn.indexOf(id) < 0;
            return (
                <span key={id} className={['ck-ready-chip', ready ? 'ready' : ''].join(' ')} style={{ ['--acc' as any]: p.accent }}>
                    <span className="dot" />{p.name}
                </span>
            );
        })}
    </div>
);

const PriorityTrack: React.FC<{ ck: CKPublic }> = ({ ck }) => (
    <div className="ck-priority">
        <span className="ck-priority-label">Priority</span>
        {ck.priority.map((id, i) => {
            const p = ck.players[id];
            return (
                <span key={id} className="ck-hat" style={{ ['--acc' as any]: p.accent }} title={`${i + 1}. ${p.name}`}>
                    <span className="ck-hat-n">{i + 1}</span>{p.name}
                </span>
            );
        })}
        <span className="ck-priority-hint">ties: leftmost picks first</span>
    </div>
);

const Rivals: React.FC<{ ck: CKPublic; me: CKPrivate; onInspect: (c: CardRef) => void }> = ({ ck, me, onInspect }) => (
    <div className="ck-rivals">
        {ck.order.map(id => {
            const p = ck.players[id];
            const challengeStarsSum = p.challengeResults.reduce((a, r) => a + r.stars, 0);
            return (
                <div key={id} className={['ck-rival', id === me.me ? 'me' : ''].join(' ')} style={{ ['--acc' as any]: p.accent }}>
                    <div className="ck-rival-head">
                        <span className="ck-rival-name">{p.name}{id === me.me ? ' (you)' : ''}</span>
                        <StarCount n={p.stars} size={18} />
                    </div>
                    <div className="ck-rival-row">
                        <span className="ck-kitchen-meta"><Icon id="bag" size={16} /> {p.storageCount} hidden</span>
                        <RumorSlots known={p.known} texts={[null, null, null]} size={22} />
                        <span className="ck-kitchen-meta">{challengeStarsSum} <Icon id="star" size={13} /> from challenges</span>
                    </div>
                    <div className="ck-kitchen-cards">
                        {p.rest && <CKCard card={{ kind: 'rest', id: p.rest }} width={66} onClick={() => onInspect({ kind: 'rest', id: p.rest! })} />}
                        {[...p.zous, ...p.zousNext].map(z => <CKCard key={z} card={{ kind: 'zous', id: z }} width={66} onClick={() => onInspect({ kind: 'zous', id: z })} />)}
                    </div>
                </div>
            );
        })}
    </div>
);

const LogView: React.FC<{ ck: CKPublic }> = ({ ck }) => (
    <div className="ck-log">
        {ck.log.slice().reverse().map(e => {
            const p = e.pid ? ck.players[e.pid] : null;
            return (
                <div key={e.id} className={['ck-log-row', e.kind].join(' ')} style={{ ['--acc' as any]: p ? p.accent : '#bbb' }}>
                    <span className="ck-log-round">R{e.round}</span>
                    {e.item ? <Tok item={e.item} size={22} pop={false} /> : e.loc ? <Icon id={`loc_${e.loc}`} size={22} /> : <span className="ck-log-dot" />}
                    <span>{p ? <b>{p.name} </b> : null}{e.text}{e.loc && e.kind === 'pick' ? ` · ${LOC_BY_ID[e.loc].name}` : ''}</span>
                </div>
            );
        })}
    </div>
);

// ===========================================================================
// results
// ===========================================================================

const Results: React.FC<{ ck: CKPublic; me: CKPrivate }> = ({ ck, me }) => {
    const final = ck.final || [];
    // same order as the engine: stars, then meal quality (score track), then priority
    const q = (id: string) => (final.find(x => x.pid === id) || { quality: 0 }).quality;
    const ranked = ck.order.slice().sort((a, b) =>
        (ck.players[b].stars - ck.players[a].stars) || (q(b) - q(a)) || (ck.priority.indexOf(a) - ck.priority.indexOf(b)));
    const [open, setOpen] = React.useState<string | null>(me.me);
    return (
        <div className="ck-results">
            <div className="ck-confetti" aria-hidden="true">{Array.from({ length: 18 }).map((_, i) => <i key={i} style={{ left: `${(i * 53) % 100}%`, animationDelay: `${(i % 6) * 0.25}s`, background: Object.values(ING_COLORS)[i % 7] }} />)}</div>
            <div className="ck-winner">
                <Icon id="star_coin" size={56} />
                <div>
                    <div className="ck-winner-label">Best restaurant in Bistro Bay</div>
                    <div className="ck-winner-name">{ck.winners.map(w => ck.players[w]?.name).join(' & ')}</div>
                </div>
            </div>
            {ck.allRumors && (
                <div className="ck-results-rumors">
                    {ck.allRumors.map(r => <CKCard key={r} card={{ kind: 'rumor', id: r }} width={74} />)}
                </div>
            )}
            {ranked.map((id, rank) => {
                const p = ck.players[id];
                const f = final.find(x => x.pid === id);
                const challengeStars = p.stars - (f ? f.total : 0);
                const plate: CriticPlate = p.criticPlate || {};
                const map = itemMap(p.storage || []);
                return (
                    <div key={id} className={['ck-result', rank === 0 ? 'first' : ''].join(' ')} style={{ ['--acc' as any]: p.accent, animationDelay: `${rank * 0.12}s` }}
                        onClick={() => setOpen(open === id ? null : id)}>
                        <div className="ck-result-head">
                            <span className="ck-result-rank">{rank + 1}</span>
                            <span className="ck-result-name">{p.name}</span>
                            <StarCount n={p.stars} size={20} />
                        </div>
                        <div className="ck-result-plate">
                            {ING_TYPES.map(t => {
                                const c = plate[t];
                                const first = c && c.ings[0] ? map[c.ings[0].id] : null;
                                const sp = c && c.ings[0] && c.ings[0].spice !== undefined ? map[c.ings[0].spice!] : null;
                                return (
                                    <span key={t} className="ck-result-course" style={{ ['--ing' as any]: ING_COLORS[t] }}>
                                        {first ? <Tok item={first} size={26} spice={sp} pop={false} /> : <span className="ck-result-empty" />}
                                        {c && c.ings.length > 1 ? <small>+{c.ings.length - 1}</small> : null}
                                    </span>
                                );
                            })}
                        </div>
                        {open === id && f && (
                            <div className="ck-result-lines">
                                <div className="ck-result-line"><span>Challenges &amp; shopping</span><b>{challengeStars}</b></div>
                                {f.lines.map(l => <div key={l.key} className="ck-result-line"><span>{l.label}</span><b>+{l.n}</b></div>)}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export { CRITIC_BY_ID, CHALLENGE_BY_ID, ING_NAMES };
