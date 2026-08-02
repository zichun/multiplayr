/**
 * OffWithTheirHeadsViews.tsx - React components for "Off With Their Heads".
 *
 * Clients are stateless except for ephemeral turn-building UI (which zone tab is
 * open, a pending Ace value, an armed teacup). The host pushes every board already
 * public; only the client's own hand and secret card selection arrive privately,
 * plus — for the acting player — the current pending mark and its legal placements.
 */

import * as React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ViewPropsInterface } from '../../../common/interfaces';
import { icons as LOBBY_ICONS } from '../../lobby/LobbyView';
import { ExpressiveIcon } from '../../../client/lib/card-renderer/IconEngine';

import {
    Card, Suit, Zone, Position, Guest, PlayerSheet, ScoreResult, PokerResult, PendingMark,
    isRed, rankValue, defaultMarkValue, teaPartyVP, zoneLabel, SUIT_ORDER,
    MEADOW_DEF, TREE_IDS, TREE_POS, TREE_COLORS, WOODS_EDGES, WOODS_NODES,
    MARCH_HARE_TREES, DORMOUSE_TREES, WOODS_TEACUP_TREES, WOODS_BISCUIT_TREES,
    KEEP_CELLS, KEEP_EDGES, KEEP_RED_ENTRANCE, KEEP_BLACK_ENTRANCE, KEEP_HUMPTY_CELL, KEEP_RABBIT_CELL,
    GUESTS, GUEST_LABELS, POKER_LABELS, POSITION_ZONE, TEACUP_COUNT, MAD_HATTER_INDEX
} from '../OffWithTheirHeadsGameState';
import {
    ZONE_ICONS, GUEST_ICONS, ZONE_PALETTES, QUEEN_PALETTE, GOLD_PALETTE, SLATE_PALETTE,
    CROWN_ICON, TEACUP_ICON, BISCUIT_ICON, SUIT_GLYPH, SUIT_LABEL, ZONE_HEX, ZONE_LABELS
} from '../OffWithTheirHeadsAssets';

import PlaceSound from '../../../sounds/softnotification.mp3';
import RevealSound from '../../../sounds/connected.mp3';
import GuestSound from '../../../sounds/coin_few.mp3';

function playSound(src: string) {
    if (typeof Audio === 'undefined' || !src) return;
    try {
        const a = new Audio(src);
        const p = a.play();
        if (p && typeof p.catch === 'function') p.catch(() => { /* blocked */ });
    } catch (e) { /* ignore */ }
}

// ---- shared props ----

interface Legal { meadow: string[]; woods: string[]; keep: string[]; }
interface MarkProp {
    head: PendingMark;
    card: Card;
    position: Position;
    legal: Legal;
    teacupTargets: Legal;
    teacupColorTargets: Legal;
    hasTeacup: boolean;
}

interface OWTHProps extends ViewPropsInterface {
    gameStatus: 'Setup' | 'Selecting' | 'Marking' | 'GameOver';
    round: number;
    bout: number;
    queenIndex: number;
    queenSuit: Suit;
    hierarchy: Suit[];
    playerOrder: string[];
    playerNames: Record<string, string>;
    playerAccents: Record<string, string>;
    playerIcons: Record<string, number>;
    sheets: Record<string, PlayerSheet>;
    selectionReady: Record<string, boolean>;
    marksState: Record<string, { hasPending: boolean; done: boolean }>;
    reveal: { playerCards: Record<string, Card>; extras: Card[]; positions: Record<string, Position>; rankedIds: string[] } | null;
    lastMove: { kind: string; moveId: number; desc: string; playerId: string } | null;
    score: ScoreResult | null;
    isHost: boolean;
    myHand: Card[];
    mySelection: string | null;
    myMark: MarkProp | null;
    amDoneMarking: boolean;
    mySetAside: Card[];
    allSetAside: Record<string, Card[]> | null;
    zoneScores: Record<string, { meadow: number; woods: number; keep: number; tea: number }>;
}

const cid = (c: Card) => `${c.rank}${c.suit}`;

// ================================================================================
// Small primitives
// ================================================================================

function CardTile(props: {
    card: Card; selectable?: boolean; selected?: boolean; dim?: boolean; onClick?: () => void; small?: boolean;
}) {
    const { card } = props;
    const cls = ['owth-card', isRed(card.suit) ? 'red' : 'black'];
    if (props.selectable) cls.push('selectable');
    if (props.selected) cls.push('selected');
    if (props.dim) cls.push('dim');
    if (props.small) cls.push('small');
    return (
        <div className={cls.join(' ')} onClick={props.selectable ? props.onClick : undefined}>
            <span className="oc-rank">{card.rank}</span>
            <span className="oc-suit">{SUIT_GLYPH[card.suit]}</span>
        </div>
    );
}

// The accumulated set-aside cards (2 per round) that become the poker showdown.
// Shown to their owner during play for long-term planning, and to everyone at the
// end for review.
function SetAsideStrip(props: { cards: Card[]; label: string; poker?: PokerResult | null }) {
    if (!props.cards || props.cards.length === 0) return null;
    return (
        <div className="setaside-strip">
            <div className="sa-head">
                <span className="sa-label">{props.label}</span>
                {props.poker
                    ? <span className="sa-poker">{POKER_LABELS[props.poker.category]} · +{props.poker.vp}</span>
                    : <span className="sa-count">{props.cards.length}/6</span>}
            </div>
            <div className="sa-cards">
                {props.cards.map((c, i) => <CardTile key={i} card={c} small />)}
            </div>
        </div>
    );
}

// The Wonderland Board: the rotating suit hierarchy with the Red Queen's crown on
// the current top suit.
function BoardRing(props: { hierarchy: Suit[]; queenSuit: Suit; round: number; bout: number }) {
    return (
        <div className="wl-board">
            <div className="wl-left">
                <span className="wl-crown"><ExpressiveIcon icon={CROWN_ICON} palette={QUEEN_PALETTE} /></span>
                <div className="wl-meta">
                    <div className="wl-round">Round {props.round} · Bout {props.bout}/7</div>
                    <div className="wl-caption">Queen on {SUIT_LABEL[props.queenSuit]}</div>
                </div>
            </div>
            <div className="wl-hierarchy">
                {props.hierarchy.map((s, i) => (
                    <React.Fragment key={s}>
                        <span className={`wl-suit ${isRed(s) ? 'red' : 'black'} ${i === 0 ? 'top' : ''}`}>{SUIT_GLYPH[s]}</span>
                        {i < 3 && <span className="wl-gt">›</span>}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
}

// Colour palettes keyed by a mushroom / tree / cell colour requirement.
function colorPalette(color: 'red' | 'black' | 'both') {
    if (color === 'red') return QUEEN_PALETTE;
    if (color === 'black') return SLATE_PALETTE;
    return ZONE_PALETTES.meadow;
}

// Which Tea Party guests are earned in each zone, plus the exact Keep cells that
// physically trigger Humpty Dumpty / the White Rabbit.
const ZONE_GUESTS: Record<Zone, Guest[]> = {
    meadow: ['caterpillar', 'cheshire'],
    woods: ['dormouse', 'marchhare'],
    keep: ['humpty', 'rabbit']
};
const KEEP_GUEST_CELL: Record<string, Guest> = {
    [KEEP_HUMPTY_CELL]: 'humpty',
    [KEEP_RABBIT_CELL]: 'rabbit'
};

// A compact strip of the guests earned in a given zone, lit gold when achieved —
// shown at the top of each zone board so the Tea Party goals live where you work.
function ZoneGuests(props: { zone: Zone; sheet: PlayerSheet }) {
    return (
        <div className="zone-guests">
            {ZONE_GUESTS[props.zone].map(g => {
                const on = props.sheet.guests.indexOf(g) >= 0;
                return (
                    <span className={`zg-chip ${on ? 'on' : ''}`} key={g}>
                        <span className="zg-icon"><ExpressiveIcon icon={GUEST_ICONS[g]} palette={on ? GOLD_PALETTE : SLATE_PALETTE} /></span>
                        <span className="zg-text">
                            <span className="zg-name">{GUEST_LABELS[g]}{on && <span className="zg-check"> ✓</span>}</span>
                            <span className="zg-hint">{GUEST_UNLOCK[g]}</span>
                        </span>
                    </span>
                );
            })}
        </div>
    );
}

// ================================================================================
// Zone boards
// ================================================================================

function MeadowBoard(props: { sheet: PlayerSheet; interactive?: boolean; legal?: string[]; onPlace?: (id: string) => void }) {
    const legal = props.legal || [];
    return (
        <div className="zone-wrap">
            <ZoneGuests zone="meadow" sheet={props.sheet} />
            <div className="meadow-board">
            {MEADOW_DEF.map(def => {
                const m = props.sheet.meadow.find(x => x.id === def.id)!;
                const complete = m.marks.every(x => x !== null);
                const isLegal = !!props.interactive && legal.indexOf(def.id) >= 0;
                const cls = ['mushroom', `color-${def.color}`];
                if (complete) cls.push('complete');
                if (isLegal) cls.push('legal');
                return (
                    <div className={cls.join(' ')} key={def.id} onClick={isLegal ? () => props.onPlace!(def.id) : undefined}>
                        <div className="mush-head">
                            <span className="mush-crest"><ExpressiveIcon icon={ZONE_ICONS.meadow} palette={colorPalette(def.color)} /></span>
                            <span className="mush-name">{def.label}</span>
                            <span className="mush-vp">{def.vp}</span>
                        </div>
                        <div className="mush-spaces">
                            {m.marks.map((mk, i) => {
                                const scls = ['m-space'];
                                if (mk !== null) scls.push('filled');
                                const hasTc = def.teacupSpaces.indexOf(i) >= 0;
                                const hasBi = def.biscuitSpaces.indexOf(i) >= 0;
                                return (
                                    <span className={scls.join(' ')} key={i}>
                                        {mk !== null
                                            ? mk
                                            : hasTc ? <span className="sp-icon"><ExpressiveIcon icon={TEACUP_ICON} palette={GOLD_PALETTE} /></span>
                                                : hasBi ? <span className="sp-icon"><ExpressiveIcon icon={BISCUIT_ICON} palette={GOLD_PALETTE} /></span>
                                                    : ''}
                                    </span>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
            </div>
        </div>
    );
}

function WoodsBoard(props: { sheet: PlayerSheet; interactive?: boolean; legal?: string[]; onPlace?: (id: string) => void }) {
    const legal = props.legal || [];
    const marked = (t: string) => props.sheet.woods[t] !== null;
    return (
        <div className="zone-wrap">
            <ZoneGuests zone="woods" sheet={props.sheet} />
            <div className="woods-board">
            <svg className="wb-edges" viewBox="0 0 100 100" preserveAspectRatio="none">
                {WOODS_EDGES.map(([a, b], i) => (
                    <line key={i} x1={TREE_POS[a].x} y1={TREE_POS[a].y} x2={TREE_POS[b].x} y2={TREE_POS[b].y} />
                ))}
            </svg>
            {WOODS_NODES.map(n => {
                const lit = n.trees.every(t => marked(t));
                const cls = ['wb-node', n.center ? 'center' : 'star'];
                if (lit) cls.push('lit');
                return (
                    <div className={cls.join(' ')} key={n.id} style={{ left: `${n.x}%`, top: `${n.y}%` }}>
                        {n.center
                            ? <span className="wb-node-icon"><ExpressiveIcon icon={GUEST_ICONS.marchhare} palette={lit ? GOLD_PALETTE : SLATE_PALETTE} /></span>
                            : n.vp}
                    </div>
                );
            })}
            {TREE_IDS.map(t => {
                const mk = props.sheet.woods[t];
                const isLegal = !!props.interactive && legal.indexOf(t) >= 0;
                const cls = ['wb-tree', `color-${TREE_COLORS[t]}`];
                if (mk !== null) cls.push('filled');
                if (isLegal) cls.push('legal');
                const hasTc = WOODS_TEACUP_TREES.indexOf(t) >= 0;
                const hasBi = WOODS_BISCUIT_TREES.indexOf(t) >= 0;
                return (
                    <div className={cls.join(' ')} key={t} style={{ left: `${TREE_POS[t].x}%`, top: `${TREE_POS[t].y}%` }}
                        onClick={isLegal ? () => props.onPlace!(t) : undefined}>
                        {mk !== null
                            ? <span className="wt-mark">{mk}</span>
                            : hasTc ? <span className="wt-icon"><ExpressiveIcon icon={TEACUP_ICON} palette={GOLD_PALETTE} /></span>
                                : hasBi ? <span className="wt-icon"><ExpressiveIcon icon={BISCUIT_ICON} palette={GOLD_PALETTE} /></span>
                                    : <span className="wt-label">{t}</span>}
                    </div>
                );
            })}
            </div>
        </div>
    );
}

function KeepBoard(props: { sheet: PlayerSheet; interactive?: boolean; legal?: string[]; onPlace?: (id: string) => void }) {
    const legal = props.legal || [];
    return (
        <div className="zone-wrap">
            <ZoneGuests zone="keep" sheet={props.sheet} />
            <div className="keep-board">
            <svg className="kb-edges" viewBox="0 0 100 100" preserveAspectRatio="none">
                {KEEP_EDGES.map(([a, b], i) => {
                    const ca = KEEP_CELLS.find(c => c.id === a)!;
                    const cb = KEEP_CELLS.find(c => c.id === b)!;
                    return <line key={i} x1={ca.x} y1={ca.y} x2={cb.x} y2={cb.y} />;
                })}
            </svg>
            {KEEP_CELLS.map(c => {
                const mk = props.sheet.keep[c.id];
                const isLegal = !!props.interactive && legal.indexOf(c.id) >= 0;
                const cls = ['kb-cell'];
                if (c.isCoin) cls.push('coin');
                if (c.isCenter) cls.push('center');
                if (c.id === KEEP_RED_ENTRANCE) cls.push('ent-red');
                if (c.id === KEEP_BLACK_ENTRANCE) cls.push('ent-black');
                const guest = KEEP_GUEST_CELL[c.id];
                if (guest) cls.push('guest-cell');
                if (mk !== null) cls.push('filled');
                if (isLegal) cls.push('legal');
                return (
                    <div className={cls.join(' ')} key={c.id} style={{ left: `${c.x}%`, top: `${c.y}%` }}
                        onClick={isLegal ? () => props.onPlace!(c.id) : undefined}>
                        {mk !== null
                            ? <span className="kc-mark">{mk}</span>
                            : c.isCenter ? <span className="kc-center-icon"><ExpressiveIcon icon={CROWN_ICON} palette={QUEEN_PALETTE} /></span>
                                : guest ? <span className="kc-guest"><ExpressiveIcon icon={GUEST_ICONS[guest]} palette={SLATE_PALETTE} /></span>
                                    : c.teacup ? <span className="kc-icon"><ExpressiveIcon icon={TEACUP_ICON} palette={GOLD_PALETTE} /></span>
                                        : c.biscuit ? <span className="kc-icon"><ExpressiveIcon icon={BISCUIT_ICON} palette={GOLD_PALETTE} /></span>
                                            : (c.id === KEEP_RED_ENTRANCE ? <span className="kc-suit red">♥♦</span>
                                                : c.id === KEEP_BLACK_ENTRANCE ? <span className="kc-suit black">♠♣</span>
                                                    : '')}
                    </div>
                );
            })}
            </div>
        </div>
    );
}

// The Tea Party guests + teacup stack.
function TeaPartyBoard(props: { sheet: PlayerSheet }) {
    const guests = props.sheet.guests;
    const count = guests.length;
    return (
        <div className="tea-board">
            <div className="tea-vp">
                <span className="tv-num">{teaPartyVP(count)}</span>
                <span className="tv-label">Tea Party VP · {count}/7 guests</span>
            </div>
            <div className="guests-grid">
                {GUESTS.map(g => {
                    const on = guests.indexOf(g) >= 0;
                    return (
                        <div className={`guest-chip ${on ? 'on' : ''}`} key={g}>
                            <span className="gc-icon"><ExpressiveIcon icon={GUEST_ICONS[g]} palette={on ? GOLD_PALETTE : SLATE_PALETTE} /></span>
                            <span className="gc-label">{GUEST_LABELS[g]}</span>
                            {on && <span className="gc-check">✓</span>}
                        </div>
                    );
                })}
            </div>
            <div className="teacup-stack">
                <div className="ts-label">Teacups</div>
                <div className="ts-row">
                    {Array.from({ length: TEACUP_COUNT }).map((_, i) => {
                        const st = props.sheet.teacups[i];
                        const cls = ['teacup-tag', st === 1 ? 'available' : st === 2 ? 'consumed' : 'locked'];
                        if (i === MAD_HATTER_INDEX) cls.push('hatter');
                        return (
                            <span className={cls.join(' ')} key={i} title={i === MAD_HATTER_INDEX ? "Mad Hatter's teacup" : ''}>
                                <ExpressiveIcon icon={TEACUP_ICON} palette={st >= 1 ? GOLD_PALETTE : SLATE_PALETTE} />
                            </span>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// ================================================================================
// Rules reference
// ================================================================================
// Unlock condition for each Tea Party guest, shown in the rules.
const GUEST_UNLOCK: Record<Guest, string> = {
    caterpillar: 'Completely fill any one Meadow mushroom.',
    cheshire: 'Place a mark in three different Meadow mushrooms.',
    dormouse: 'Mark all four red-and-black (both-colour) trees in the Woods.',
    marchhare: 'Mark the three trees around the central March Hare node in the Woods.',
    humpty: 'Mark the Keep cell right beside Humpty Dumpty.',
    rabbit: 'Mark the Keep cell right beside the White Rabbit.',
    madhatter: 'Reach the 4th teacup from the top of your stack (no need to spend it).'
};

export class OWTHRulesView extends React.Component<{}, {}> {
    // A coloured suit pip.
    private suit(s: Suit, key?: React.Key) {
        return <span key={key} className={`rk ${isRed(s) ? 'red' : 'black'}`}>{SUIT_GLYPH[s]}</span>;
    }
    // The full high→low order for a given Queen suit (top suit + clockwise descent).
    private hierarchy(q: Suit): Suit[] {
        const idx = SUIT_ORDER.indexOf(q);
        return [0, 1, 2, 3].map(i => SUIT_ORDER[(idx + i) % 4]);
    }

    public render() {
        return (
            <div className="owth-rules">
                <div className="rules-section">
                    <h3>The Croquet Court</h3>
                    <p>Over <strong>3 rounds × 7 bouts</strong> (21 bouts total) you are dealt <strong>9 cards</strong> each
                        round. Every bout, all players <strong>secretly pick one card</strong> and reveal together. The cards
                        are ranked against each other, and where yours lands — <strong>High / Mid / Low</strong> — forces a
                        mark on your private sheet:</p>
                    <div className="rules-zones">
                        {(['meadow', 'woods', 'keep'] as Zone[]).map((z, i) => (
                            <div className="rz-item" key={z}>
                                <span className="rz-icon"><ExpressiveIcon icon={ZONE_ICONS[z]} palette={ZONE_PALETTES[z]} /></span>
                                <span className="rz-name">{['High', 'Mid', 'Low'][i]} → {ZONE_LABELS[z]}</span>
                            </div>
                        ))}
                    </div>
                    <p className="rz-foot">After the 7th bout you set aside your 2 leftover cards (6 by game end) for the
                        poker showdown, then re-deal for the next round.</p>
                </div>

                <div className="rules-section">
                    <h3>Card Ranking — the Red Queen</h3>
                    <p>The Wonderland Board is a ring of four suits in fixed clockwise order:</p>
                    <div className="rb-ring">
                        {SUIT_ORDER.map((s, i) => (
                            <React.Fragment key={s}>
                                {this.suit(s)}
                                {i < SUIT_ORDER.length - 1 ? <span className="rk-arrow">→</span> : <span className="rk-arrow">↺</span>}
                            </React.Fragment>
                        ))}
                    </div>
                    <ul>
                        <li><strong>Suit decides first.</strong> The suit the <strong>Red Queen</strong> sits on is the
                            <em> highest</em>; the others descend <em>clockwise</em> from her. A card of the Queen's suit beats
                            <strong> every</strong> other suit — a 2♥ beats a K♠ when the Queen is on Hearts.</li>
                        <li><strong>Then number.</strong> Within one suit, higher wins — <strong>Ace is high</strong>, then
                            K, Q, J, 10 … down to 2.</li>
                        <li>The single <strong>highest</strong> card is <strong>High</strong>, the single <strong>lowest</strong>
                            is <strong>Low</strong>, and everyone in between is <strong>Mid</strong>. With 2–3 players, extra
                            cards are dealt into the bout — they help decide the ranking but never make marks.</li>
                    </ul>
                    <p>At the <strong>end of every bout the Queen steps one suit clockwise</strong>, so the pecking order keeps
                        rotating. It <em>never resets</em> between rounds — over 21 bouts she laps the ring several times.</p>
                    <table className="rank-table">
                        <thead><tr><th>Queen on</th><th>Ranking — highest → lowest</th></tr></thead>
                        <tbody>
                            {SUIT_ORDER.map(q => (
                                <tr key={q}>
                                    <td>{this.suit(q)} {SUIT_LABEL[q]}</td>
                                    <td>{this.hierarchy(q).map((s, i) => (
                                        <React.Fragment key={s}>{this.suit(s)}{i < 3 && <span className="rk-arrow">›</span>}</React.Fragment>
                                    ))}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="rules-section">
                    <h3>Marking</h3>
                    <ul>
                        <li>The number you write = face value; <strong>J/Q/K = 10</strong>; <strong>Ace = 1 or 11</strong> (you choose each time).</li>
                        <li>Hearts/Diamonds are <strong>red</strong>; Clubs/Spades are <strong>black</strong>. A space's colour must match your card.</li>
                        <li>If your forced zone has no legal space, the mark is simply <strong>lost</strong>.</li>
                        <li><span className="ic"><ExpressiveIcon icon={TEACUP_ICON} palette={GOLD_PALETTE} /></span>
                            <strong>Teacups</strong> (spend one) let you mark in a <em>different zone</em>, or treat your card as the <em>other colour</em>.</li>
                        <li><span className="ic"><ExpressiveIcon icon={BISCUIT_ICON} palette={GOLD_PALETTE} /></span>
                            <strong>Biscuits</strong> immediately repeat the exact mark (same number &amp; colour) in a different zone — and a repeat landing on another biscuit chains again.</li>
                        <li>Marking the <strong>Red Keep</strong> centre grants a free Meadow <em>and</em> a free Woods mark (any space, any colour).</li>
                    </ul>
                </div>

                <div className="rules-section">
                    <h3>The Tea Party — Seven Guests</h3>
                    <p>Meet a guest's condition and they're seated for good. Only <strong>how many</strong> guests you gather
                        matters — your Tea Party score is <strong>(guests + 1)²</strong>, so each new guest is worth more than the last:</p>
                    <div className="tea-curve">
                        {[1, 2, 3, 4, 5, 6, 7].map(n => (
                            <span key={n}>{n} → {teaPartyVP(n)}</span>
                        ))}
                    </div>
                    <div className="guest-list">
                        {GUESTS.map(g => (
                            <div className="gl-item" key={g}>
                                <span className="gl-icon"><ExpressiveIcon icon={GUEST_ICONS[g]} palette={GOLD_PALETTE} /></span>
                                <div className="gl-text">
                                    <span className="gl-name">{GUEST_LABELS[g]}</span>
                                    <span className="gl-cond">{GUEST_UNLOCK[g]}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="rules-section">
                    <h3>Scoring &amp; Winning</h3>
                    <ul>
                        <li><strong>Meadow:</strong> only <em>completed</em> mushrooms score (27 / 15 / 3 VP).</li>
                        <li><strong>Woods:</strong> each fully-surrounded node scores; <strong>+30</strong> if all 18 trees are marked; the
                            <strong> Jabberwock rule</strong> doubles the starred nodes if no two neighbouring trees share a number.</li>
                        <li><strong>Keep:</strong> each coin space scores the number written in it; the Red Keep centre adds <strong>+2</strong>.</li>
                        <li><strong>Tea Party:</strong> (guests + 1)² — see above.</li>
                        <li><strong>Poker:</strong> your 6 set-aside cards form your best hand (One Pair 3 … Straight Flush 24); the single best hand at the table earns <strong>+5</strong>.</li>
                    </ul>
                    <p>Highest grand total wins; ties are broken by the best poker hand. Unspent teacups score nothing.</p>
                </div>
            </div>
        );
    }
}

// ================================================================================
// Lobby views
// ================================================================================
export class OffWithTheirHeadsHostLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;
        const playerCount = mp.playersCount() + 1;
        const ok = playerCount >= 2 && playerCount <= 4;
        const links = {
            'home': {
                'icon': 'home', 'label': 'Lobby',
                'view': (
                    <div>
                        {mp.getPluginView('lobby', 'SetNameWithLobby')}
                        {!ok && (
                            <p style={{ color: '#c56d63', fontWeight: 700, textAlign: 'center', marginTop: 20 }}>
                                Off With Their Heads needs 2 to 4 players. Currently {playerCount}.
                            </p>
                        )}
                    </div>
                )
            },
            'clients': { 'icon': 'users', 'label': 'Players', 'view': mp.getPluginView('lobby', 'host-roommanagement') },
            'rules': { 'icon': 'book', 'label': 'Rules', 'view': <OWTHRulesView /> }
        };
        return mp.getPluginView('gameshell', 'HostShell-Main', { 'gameName': 'Off With Their Heads', 'links': links });
    }
}

export class OffWithTheirHeadsClientLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;
        const links = {
            'home': {
                'icon': 'id-card', 'label': 'Lobby',
                'view': (
                    <div>
                        {mp.getPluginView('lobby', 'SetNameWithLobby')}
                        <div className="owth-waiting">Waiting for the host to start the croquet…</div>
                    </div>
                )
            },
            'rules': { 'icon': 'book', 'label': 'Rules', 'view': <OWTHRulesView /> }
        };
        return mp.getPluginView('gameshell', 'HostShell-Main', { 'gameName': 'Off With Their Heads', 'links': links });
    }
}

// ================================================================================
// Main page
// ================================================================================
interface MainState {
    activeZone: Zone | 'tea';
    aceValue: number;   // 1 or 11
    teacup: 'zone' | 'color' | null;
    lastMarkMoveId: number;
}

export class OffWithTheirHeadsMainPage extends React.Component<OWTHProps, MainState> {
    constructor(props: OWTHProps) {
        super(props);
        this.state = { activeZone: 'meadow', aceValue: 11, teacup: null, lastMarkMoveId: 0 };
    }

    private get me() { return this.props.MP.clientId; }
    private name(id: string) { return this.props.playerNames[id] || 'Player'; }
    private accent(id: string) { return this.props.playerAccents[id] || '#7c8aa5'; }
    private mySheet(): PlayerSheet { return this.props.sheets[this.me]; }

    // Hand order: by suit (Clubs, Diamonds, Spades, Hearts), then value ascending.
    private sortedHand(): Card[] {
        const suitOrder: Record<Suit, number> = { C: 0, D: 1, S: 2, H: 3 };
        return [...this.props.myHand].sort((a, b) =>
            (suitOrder[a.suit] - suitOrder[b.suit]) || (rankValue(a.rank) - rankValue(b.rank)));
    }

    // How many teacups this player currently has available to spend.
    private availableTeacups(): number {
        return this.mySheet().teacups.filter(t => t === 1).length;
    }

    public componentDidUpdate(prev: OWTHProps) {
        const lm = this.props.lastMove;
        const prevId = prev.lastMove ? prev.lastMove.moveId : -1;
        if (lm && lm.moveId !== prevId) {
            if (lm.kind === 'reveal') playSound(RevealSound);
            else if (lm.kind === 'mark') playSound(PlaceSound);
            else if (lm.kind === 'gameOver') playSound(GuestSound);
        }
        // When a new pending mark arrives, auto-focus the zone it can go to and
        // reset the ephemeral Ace/teacup controls.
        const mk = this.props.myMark;
        const prevMk = prev.myMark;
        const sig = (m: MarkProp | null) => m ? JSON.stringify(m.head) + (m.card.rank + m.card.suit) : '';
        if (mk && sig(mk) !== sig(prevMk)) {
            const focus = this.firstZoneWithTargets(mk.legal);
            this.setState({ aceValue: 11, teacup: null, activeZone: focus || this.state.activeZone });
        }
    }

    private firstZoneWithTargets(legal: Legal): Zone | null {
        if (legal.meadow.length) return 'meadow';
        if (legal.woods.length) return 'woods';
        if (legal.keep.length) return 'keep';
        return null;
    }

    // The legal set currently in force, given the armed teacup mode.
    private activeLegal(): Legal {
        const mk = this.props.myMark;
        if (!mk) return { meadow: [], woods: [], keep: [] };
        if (this.state.teacup === 'zone') return mk.teacupTargets;
        if (this.state.teacup === 'color') return mk.teacupColorTargets;
        return mk.legal;
    }

    private isMarkingMine(): boolean {
        return this.props.gameStatus === 'Marking' && !!this.props.myMark;
    }

    // ---- actions ----
    private selectCard = (card: Card) => {
        if (this.props.gameStatus !== 'Selecting') return;
        this.props.MP.selectCard(cid(card));
    };
    private unselect = () => this.props.MP.unselectCard();

    private placeAt = (zone: Zone, spaceId: string) => {
        const mk = this.props.myMark;
        if (!mk) return;
        const isAce = mk.head.kind === 'rank' && mk.card.rank === 'A';
        const aceValue = isAce ? this.state.aceValue : undefined;
        const teacupMode = mk.head.kind === 'rank' ? (this.state.teacup || undefined) : undefined;
        this.props.MP.resolveMark(zone, spaceId, aceValue, teacupMode);
    };

    private skipMark = () => this.props.MP.skipMark();

    // ---- rendering: zone segmented control ----
    private renderZoneTabs() {
        const legal = this.isMarkingMine() ? this.activeLegal() : null;
        const zones: (Zone | 'tea')[] = ['meadow', 'woods', 'keep', 'tea'];
        const zs = this.props.zoneScores ? this.props.zoneScores[this.me] : null;
        return (
            <div className="zone-tabs">
                {zones.map(z => {
                    const active = this.state.activeZone === z;
                    const hasTargets = legal && z !== 'tea' && (legal as any)[z].length > 0;
                    const cls = ['zt', active ? 'active' : ''];
                    if (hasTargets) cls.push('has-targets');
                    const pts = zs ? (z === 'tea' ? zs.tea : (zs as any)[z]) : 0;
                    return (
                        <button className={cls.join(' ')} key={z} onClick={() => this.setState({ activeZone: z })}>
                            {z === 'tea'
                                ? <span className="zt-icon"><ExpressiveIcon icon={CROWN_ICON} palette={QUEEN_PALETTE} /></span>
                                : <span className="zt-icon"><ExpressiveIcon icon={ZONE_ICONS[z]} palette={ZONE_PALETTES[z]} /></span>}
                            <span className="zt-label">{z === 'tea' ? 'Tea' : ZONE_LABELS[z]}</span>
                            <span className="zt-score">{pts}</span>
                            {hasTargets && <span className="zt-dot" />}
                        </button>
                    );
                })}
            </div>
        );
    }

    private renderActiveZone(sheet: PlayerSheet, interactive: boolean) {
        const legal = interactive ? this.activeLegal() : { meadow: [], woods: [], keep: [] };
        switch (this.state.activeZone) {
            case 'meadow': return <MeadowBoard sheet={sheet} interactive={interactive} legal={legal.meadow} onPlace={id => this.placeAt('meadow', id)} />;
            case 'woods': return <WoodsBoard sheet={sheet} interactive={interactive} legal={legal.woods} onPlace={id => this.placeAt('woods', id)} />;
            case 'keep': return <KeepBoard sheet={sheet} interactive={interactive} legal={legal.keep} onPlace={id => this.placeAt('keep', id)} />;
            default: return <TeaPartyBoard sheet={sheet} />;
        }
    }

    // ---- the action dock (select / mark) ----
    private renderDock() {
        if (this.props.gameStatus === 'Selecting') return this.renderSelectDock();
        if (this.props.gameStatus === 'Marking') return this.renderMarkDock();
        return null;
    }

    private renderSelectDock() {
        const selected = this.props.mySelection;
        return (
            <div className="action-dock">
                {selected
                    ? <div className="dock-title ready">Card played face-down — waiting for the others…</div>
                    : <div className="dock-title">Play a card face-down for this bout</div>}
                <div className="hand-row">
                    {this.sortedHand().map(c => (
                        <CardTile key={cid(c)} card={c} selectable={!selected} selected={selected === cid(c)} dim={!!selected && selected !== cid(c)} onClick={() => this.selectCard(c)} />
                    ))}
                </div>
                {selected && <button className="ghost-btn" onClick={this.unselect}>Change card</button>}
                <div className="ready-row">
                    {this.props.playerOrder.map(id => (
                        <span className={`ready-chip ${this.props.selectionReady[id] ? 'on' : ''}`} key={id}>
                            {this.badge(id)} {this.name(id)}{id === this.me ? ' (you)' : ''} {this.props.selectionReady[id] ? '✓' : '…'}
                        </span>
                    ))}
                </div>
            </div>
        );
    }

    private renderMarkDock() {
        const mk = this.props.myMark;
        if (!mk) {
            // I'm done; others still marking.
            const waiting = this.props.playerOrder.filter(id => this.props.marksState[id] && !this.props.marksState[id].done);
            return (
                <div className="action-dock">
                    <div className="dock-title ready">Marks placed — waiting for {waiting.map(w => this.name(w)).join(', ') || 'others'}…</div>
                </div>
            );
        }

        const legal = this.activeLegal();
        const total = legal.meadow.length + legal.woods.length + legal.keep.length;
        const isRank = mk.head.kind === 'rank';
        const isAce = isRank && mk.card.rank === 'A';
        const value = mk.head.kind === 'rank'
            ? (isAce ? this.state.aceValue : defaultMarkValue(mk.card.rank))
            : mk.head.value;

        const kindLabel =
            mk.head.kind === 'rank' ? `You are ${mk.position.toUpperCase()} → mark the ${zoneForcedLabel(mk.head)}`
                : mk.head.kind === 'biscuit' ? `Biscuit! Repeat ${value} in a different zone`
                    : mk.head.kind === 'freeMeadow' ? `Red Keep — free Meadow mark (${value})`
                        : `Red Keep — free Woods mark (${value})`;

        return (
            <div className="action-dock marking">
                <div className="mark-head">
                    <CardTile card={mk.card} small />
                    <div className="mark-prompt">
                        <div className="mp-title">{kindLabel}</div>
                        <div className="mp-sub">
                            Writing <strong>{value}</strong>
                            {total === 0 ? ' · no legal space — this mark is lost' : ` · tap a highlighted space in the ${this.state.activeZone === 'tea' ? 'board' : ZONE_LABELS[this.state.activeZone as Zone]}`}
                        </div>
                    </div>
                </div>

                {isAce && (
                    <div className="ace-row">
                        <span className="ar-label">Ace value:</span>
                        <button className={`pill ${this.state.aceValue === 1 ? 'on' : ''}`} onClick={() => this.setState({ aceValue: 1 })}>1</button>
                        <button className={`pill ${this.state.aceValue === 11 ? 'on' : ''}`} onClick={() => this.setState({ aceValue: 11 })}>11</button>
                    </div>
                )}

                {isRank && mk.hasTeacup && (
                    <div className="teacup-row">
                        <span className="tr-label"><span className="ic"><ExpressiveIcon icon={TEACUP_ICON} palette={GOLD_PALETTE} /></span> Teacup <span className="tr-count">×{this.availableTeacups()}</span>:</span>
                        <button className={`pill ${this.state.teacup === null ? 'on' : ''}`} onClick={() => this.setState({ teacup: null })}>None</button>
                        <button className={`pill ${this.state.teacup === 'zone' ? 'on' : ''}`} onClick={() => this.setState({ teacup: 'zone' })}>Any zone</button>
                        <button className={`pill ${this.state.teacup === 'color' ? 'on' : ''}`} onClick={() => this.setState({ teacup: 'color' })}>Flip colour</button>
                    </div>
                )}

                {total === 0 && <button className="danger-btn" onClick={this.skipMark}>Forfeit this mark</button>}
            </div>
        );
    }

    private renderRevealRow() {
        const rv = this.props.reveal;
        if (!rv) return null;
        return (
            <div className="reveal-row">
                {this.props.playerOrder.map(id => {
                    const c = rv.playerCards[id];
                    const pos = rv.positions[id];
                    return (
                        <span className="reveal-item" key={id}>
                            <CardTile card={c} small />
                            <span className={`pos-tag ${pos}`}>{pos}</span>
                        </span>
                    );
                })}
                {rv.extras.map((c, i) => (
                    <span className="reveal-item extra" key={`x${i}`}><CardTile card={c} small dim /><span className="pos-tag extra">extra</span></span>
                ))}
            </div>
        );
    }

    private badge(id: string) {
        const iconName = LOBBY_ICONS[this.props.playerIcons[id] ?? 0] || 'circle';
        return (
            <span style={{ display: 'inline-flex', width: '1em', height: '1em', verticalAlign: 'middle' }}>
                <FontAwesomeIcon icon={iconName} style={{ color: this.accent(id), width: '100%', height: '100%' }} />
            </span>
        );
    }

    // ---- boards tab (opponents during play; everyone at game over) ----
    private renderRivals() {
        const over = this.props.gameStatus === 'GameOver';
        // During play: opponents only (your own board is the Court tab). At game
        // over: everyone, so the whole table can be reviewed by all — including the
        // host, whose Court tab only holds the score + new-game controls.
        const list = over ? this.props.playerOrder : this.props.playerOrder.filter(id => id !== this.me);
        if (list.length === 0) return <div className="owth-waiting">No rivals to show.</div>;
        const score = this.props.score;
        const winners = score ? score.winnerIds : [];
        const allSetAside = this.props.allSetAside;

        return (
            <div className="rivals-wrap">
                {list.map(id => {
                    const ps = score ? score.players[id] : null;
                    const zs = this.props.zoneScores ? this.props.zoneScores[id] : null;
                    const zscore = (z: 'meadow' | 'woods' | 'keep' | 'tea') => zs ? <span className="rm-score">{zs[z]}</span> : null;
                    return (
                        <div className={`rival-panel ${over && winners.indexOf(id) >= 0 ? 'winner' : ''}`} key={id}>
                            <div className="rp-head">
                                {this.badge(id)} <span className="rp-name">{this.name(id)}{id === this.me ? ' (you)' : ''}</span>
                                {over && winners.indexOf(id) >= 0 && <span className="rp-crown">🏆</span>}
                                {ps
                                    ? <span className="rp-total">{ps.total}</span>
                                    : <span className="rp-state">{this.props.marksState[id] && !this.props.marksState[id].done ? 'marking…' : this.props.selectionReady[id] ? 'ready' : ''}</span>}
                            </div>
                            <div className="rival-mini">
                                <div className="rm-zone"><div className="rm-label">Meadow {zscore('meadow')}</div><MeadowBoard sheet={this.props.sheets[id]} /></div>
                                <div className="rm-zone"><div className="rm-label">Woods {zscore('woods')}</div><WoodsBoard sheet={this.props.sheets[id]} /></div>
                                <div className="rm-zone"><div className="rm-label">Keep {zscore('keep')}</div><KeepBoard sheet={this.props.sheets[id]} /></div>
                                <div className="rm-zone"><div className="rm-label">Tea {zscore('tea')}</div><TeaPartyBoard sheet={this.props.sheets[id]} /></div>
                            </div>
                            {over && allSetAside && (
                                <SetAsideStrip cards={allSetAside[id] || []} label={`${this.name(id)}'s showdown hand`} poker={ps ? ps.poker : null} />
                            )}
                        </div>
                    );
                })}
            </div>
        );
    }

    // ---- score ----
    private renderScore() {
        const score = this.props.score;
        if (!score) return null;
        const order = [...this.props.playerOrder].sort((a, b) => score.players[b].total - score.players[a].total);
        const winners = score.winnerIds;
        const shared = winners.length > 1;
        return (
            <div className="score-sheet">
                <div className="ss-crown"><ExpressiveIcon icon={CROWN_ICON} palette={QUEEN_PALETTE} /></div>
                <div className="ss-title">{shared ? 'A shared verdict!' : `${this.name(winners[0])} keeps their head — and wins!`}</div>
                <div className="ss-sub">{shared ? winners.map(w => this.name(w)).join(' & ') + ' tie.' : 'The Queen is (barely) pleased.'}</div>
                <table className="score-table">
                    <thead><tr><th>#</th><th>Player</th><th>Meadow</th><th>Woods</th><th>Keep</th><th>Tea</th><th>Poker</th><th>Total</th></tr></thead>
                    <tbody>
                        {order.map((id, i) => {
                            const p = score.players[id];
                            const pk = (p.poker ? POKER_LABELS[p.poker.category] : '—') + (p.pokerBonus ? ' +5' : '');
                            return (
                                <tr key={id} className={winners.indexOf(id) >= 0 ? 'winner-row' : ''}>
                                    <td>{i === 0 ? '🏆' : i + 1}</td>
                                    <td><span className="st-name">{this.badge(id)} {this.name(id)}{id === this.me ? ' (you)' : ''}</span></td>
                                    <td>{p.meadow}</td>
                                    <td>{p.woods}{p.woodsAll18 ? '★' : ''}</td>
                                    <td>{p.keep}</td>
                                    <td>{p.teaParty}</td>
                                    <td className="pk-cell">{pk}</td>
                                    <td className="st-total">{p.total}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                <div className="ss-note">Open the <strong>Boards</strong> tab to review every player's full tableau and showdown hand.</div>
                {this.props.isHost && (
                    <div className="ss-actions">
                        <button className="primary-btn" onClick={() => this.props.MP.restartGame()}>Play Again</button>
                        <button className="ghost-btn" onClick={() => this.props.MP.backToLobby()}>Back to Lobby</button>
                    </div>
                )}
            </div>
        );
    }

    private phaseLabel(): string {
        switch (this.props.gameStatus) {
            case 'Selecting': return this.props.mySelection ? 'Waiting' : 'Choose a Card';
            case 'Marking': return this.props.myMark ? 'Your Mark' : 'Marking';
            case 'GameOver': return 'Verdict';
            default: return 'The Court';
        }
    }

    public render() {
        const mp = this.props.MP;
        const over = this.props.gameStatus === 'GameOver';
        const interactive = this.isMarkingMine();

        const arena = over ? (
            <div className="owth-arena">{this.renderScore()}</div>
        ) : (
            <div className="owth-arena">
                <BoardRing hierarchy={this.props.hierarchy} queenSuit={this.props.queenSuit} round={this.props.round} bout={this.props.bout} />
                {this.props.gameStatus === 'Marking' && this.renderRevealRow()}
                {this.renderZoneTabs()}
                <div className="my-sheet">{this.renderActiveZone(this.mySheet(), interactive)}</div>
                {this.renderDock()}
                <SetAsideStrip cards={this.props.mySetAside} label="Your set-aside (poker showdown)" />
            </div>
        );

        const links: any = {
            'home': { 'icon': 'gamepad', 'label': 'Court', 'view': arena },
            'rivals': { 'icon': 'users', 'label': over ? 'Boards' : 'Rivals', 'view': <div className="owth-arena">{this.renderRivals()}</div> },
            'rules': { 'icon': 'book', 'label': 'Rules', 'view': <OWTHRulesView /> }
        };
        if (this.props.isHost) {
            links['settings'] = {
                'icon': 'cogs', 'label': 'Settings',
                'view': (
                    <div className="settings-panel">
                        <button className="primary-btn" onClick={() => mp.restartGame()}>Restart Game</button>
                        <button className="ghost-btn" onClick={() => mp.backToLobby()}>Back to Lobby</button>
                    </div>
                )
            };
        }

        const myTurn = interactive || (this.props.gameStatus === 'Selecting' && !this.props.mySelection);
        return mp.getPluginView('gameshell', 'HostShell-Main', {
            'links': links,
            'gameName': 'Off With Their Heads',
            'topBarContent': this.phaseLabel(),
            'roomClassName': myTurn ? 'attention-bg' : ''
        });
    }
}

// Label for the forced zone of a rank mark.
function zoneForcedLabel(head: PendingMark): string {
    const z = head.zone as Zone;
    return z ? ZONE_LABELS[z] : 'sheet';
}

// (imported constants referenced only for typing/no-ops kept tree-shakeable)
void POSITION_ZONE; void MARCH_HARE_TREES; void DORMOUSE_TREES; void ZONE_HEX;
