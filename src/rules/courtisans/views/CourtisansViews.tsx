/**
 * CourtisansViews.tsx - React components for "Courtisans".
 *
 * Clients are stateless except for ephemeral turn-building UI (which card is
 * selected, which zone sub-menu is open). Everything else is pushed from the host
 * already redacted: opponents' spies arrive as anonymous backs, and only the
 * client's own hand + missions are ever sent in the clear.
 */

import * as React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ViewPropsInterface } from '../../../common/interfaces';
import { icons as LOBBY_ICONS } from '../../lobby/LobbyView';
import { ExpressiveIcon } from '../../../client/lib/card-renderer/IconEngine';
import {
    Card, Mission, Family, Role, FAMILIES, ScoreResult, FamilyStatus, weightOf, LastMove, Zone
} from '../CourtisansGameState';
import {
    CREST_ICONS, ROLE_ICONS, BACK_ICON, FAMILY_PALETTES, SLATE_PALETTE,
    FAMILY_LABELS, ROLE_LABELS
} from '../CourtisansAssets';

import PlaceSound from '../../../sounds/softnotification.mp3';
import GiveSound from '../../../sounds/coin_few.mp3';
import AssassinSound from '../../../sounds/sword-swing.mp3';
import EndSound from '../../../sounds/connected.mp3';

function playSound(src: string) {
    if (typeof Audio === 'undefined' || !src) return;
    try {
        const audio = new Audio(src);
        const p = audio.play();
        if (p && typeof p.catch === 'function') p.catch(() => { /* blocked until interaction */ });
    } catch (e) { /* ignore */ }
}

// A card as it arrives at the client: either a public courtier (family+role) or an
// anonymous face-down back (hidden spy).
interface ViewCard { id: string; family?: Family; role?: Role; hidden?: boolean; }
interface ColumnView { above: ViewCard[]; below: ViewCard[]; }

interface CourtisansProps extends ViewPropsInterface {
    gameStatus: 'Setup' | 'Playing' | 'GameOver';
    playerOrder: string[];
    currentPlayerId: string;
    turnZones: { table: boolean; ownDomain: boolean; oppDomain: boolean };
    table: Record<string, ColumnView>;
    tableLean: Record<string, { above: number; below: number }>;
    domains: Record<string, ViewCard[]>;
    drawCount: number;
    removedCount: number;
    lastMove: LastMove | null;
    playerNames: Record<string, string>;
    playerAccents: Record<string, string>;
    playerIcons: Record<string, number>;
    isHost: boolean;
    score: ScoreResult | null;
    myHand: Card[];
    myMissions: Mission[];
    pendingAssassin: { playerId: string; area: any; targets: string[] } | null;
    highlight: { playerId: string; cardIds: string[] } | null;
}

const ROLE_BADGE_BG: Record<string, string> = {
    noble: '#caa24a',
    guard: '#6b7488',
    assassin: '#b25151',
    spy: '#515a6e'
};

// #rrggbb -> rgba(...) for soft, tinted glows.
function hexToRgba(hex: string, alpha: number): string {
    const h = (hex || '').replace('#', '');
    if (h.length !== 6) return `rgba(120,120,140,${alpha})`;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

// A single card that flies from a source point to a destination along a gentle
// arc, then fades — a transient hint shown to every client of what was just
// played. Self-cleaning via the Web Animations API.
interface FlyAnim {
    key: string;
    card: ViewCard;
    fromX: number; fromY: number;
    toX: number; toY: number;
    size: number;
}

class FlyingCard extends React.Component<{ anim: FlyAnim; onDone: (key: string) => void }, {}> {
    private ref = React.createRef<HTMLDivElement>();

    public componentDidMount() {
        const el = this.ref.current;
        const a = this.props.anim;
        if (!el || typeof el.animate !== 'function') {
            this.props.onDone(a.key);
            return;
        }
        const dx = a.toX - a.fromX;
        const dy = a.toY - a.fromY;
        const dist = Math.hypot(dx, dy);
        const arc = Math.min(110, 34 + dist * 0.14); // gentle upward bow
        const anim = el.animate(
            [
                { transform: 'translate(0px,0px) scale(0.92)', opacity: 0 },
                { transform: `translate(${dx * 0.18}px, ${dy * 0.18 - arc * 0.5}px) scale(0.82)`, opacity: 0.85, offset: 0.18 },
                { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - arc}px) scale(0.76)`, opacity: 0.85, offset: 0.5 },
                { transform: `translate(${dx}px, ${dy}px) scale(0.6)`, opacity: 0 }
            ],
            { duration: 640, easing: 'cubic-bezier(0.4, 0.05, 0.35, 1)' }
        );
        const finish = () => this.props.onDone(a.key);
        anim.onfinish = finish;
        anim.oncancel = finish;
    }

    public render() {
        const a = this.props.anim;
        const hidden = a.card.hidden || !a.card.family;
        const icon = hidden ? BACK_ICON : CREST_ICONS[a.card.family as Family];
        const palette = hidden ? SLATE_PALETTE : FAMILY_PALETTES[a.card.family as Family];
        return (
            <div ref={this.ref} className="fly-card" style={{ left: a.fromX, top: a.fromY, width: a.size, height: a.size }}>
                <ExpressiveIcon icon={icon} palette={palette} />
            </div>
        );
    }
}

// A card being assassinated: a red katana slash sweeps across a ghost of the card
// where it sat, then card + slash fade away. Shown to every client as a cue. A
// spy is slashed as an anonymous back (its family never leaks).
interface SlashAnim {
    key: string;
    card: ViewCard;
    x: number; y: number; w: number; h: number;
}

class SlashCard extends React.Component<{ anim: SlashAnim; onDone: (key: string) => void }, {}> {
    private timer?: ReturnType<typeof setTimeout>;

    public componentDidMount() {
        this.timer = setTimeout(() => this.props.onDone(this.props.anim.key), 720);
    }
    public componentWillUnmount() {
        if (this.timer) clearTimeout(this.timer);
    }

    public render() {
        const a = this.props.anim;
        const hidden = a.card.hidden || !a.card.family;
        const icon = hidden ? BACK_ICON : CREST_ICONS[a.card.family as Family];
        const palette = hidden ? SLATE_PALETTE : FAMILY_PALETTES[a.card.family as Family];
        return (
            <div className="slash-card" style={{ left: a.x, top: a.y, width: a.w, height: a.h }}>
                <span className="sc-ghost"><ExpressiveIcon icon={icon} palette={palette} /></span>
                <span className="sc-slash" />
            </div>
        );
    }
}

// ---- shared card / crest primitives ---------------------------------------------

function RoleBadge(props: { role: Role }) {
    if (props.role === 'plain') return null;
    return (
        <span className="role-badge" style={{ background: ROLE_BADGE_BG[props.role] || '#6b7488' }}>
            <ExpressiveIcon icon={ROLE_ICONS[props.role]} palette={SLATE_PALETTE} />
        </span>
    );
}

// One courtier token: a family crest (or an anonymous back) with a role badge.
function CardToken(props: {
    card: ViewCard;
    size: number;
    selectable?: boolean;
    selected?: boolean;
    target?: boolean;
    dimmed?: boolean;
    glow?: string;   // accent colour of the player who just played this card
    onClick?: () => void;
}) {
    const { card } = props;
    const hidden = card.hidden || !card.family;
    const icon = hidden ? BACK_ICON : CREST_ICONS[card.family as Family];
    const palette = hidden ? SLATE_PALETTE : FAMILY_PALETTES[card.family as Family];
    const cls = ['crest-token'];
    if (props.selectable) cls.push('selectable');
    if (props.selected) cls.push('selected');
    if (props.target) cls.push('target');
    if (props.dimmed) cls.push('dimmed');
    if (props.glow) cls.push('glowing');
    const clickable = props.selectable || props.target;
    const style: React.CSSProperties = { width: props.size, height: props.size };
    if (props.glow) {
        (style as any)['--glow'] = props.glow;
        (style as any)['--glow-soft'] = hexToRgba(props.glow, 0.45);
    }
    return (
        <div
            className={cls.join(' ')}
            style={style}
            data-cardid={card.id}
            onClick={clickable ? props.onClick : undefined}
            title={hidden ? 'Face-down spy' : `${FAMILY_LABELS[card.family as Family]} ${ROLE_LABELS[card.role as Role]}`}
        >
            <span className="crest-face"><ExpressiveIcon icon={icon} palette={palette} /></span>
            {!hidden && card.role && <RoleBadge role={card.role} />}
        </div>
    );
}

// Static crest (no badge), for headers / rules / verdicts.
function CrestGlyph(props: { family: Family; size: number; className?: string }) {
    return (
        <span className={props.className} style={{ width: props.size, height: props.size, display: 'inline-block', borderRadius: '50%', overflow: 'hidden' }}>
            <ExpressiveIcon icon={CREST_ICONS[props.family]} palette={FAMILY_PALETTES[props.family]} />
        </span>
    );
}

// Human-readable text for a secret mission.
export function missionText(m: Mission): string {
    const fam = m.params.family ? FAMILY_LABELS[m.params.family] : '';
    switch (m.type) {
        case 'family_status':
            return `The ${fam} family is fallen from grace at court.`;
        case 'table_family_count_threshold':
            return `At least one family has 5 or more cards below the Queen.`;
        case 'table_all_families_present':
            return `Every family has at least one card below the Queen.`;
        case 'status_count':
            return m.params.status === 'esteemed'
                ? `3 or fewer families are esteemed at court.`
                : `2 or more families are fallen from grace.`;
        case 'neighbor_family_compare':
            return `The player to your left holds more ${fam} cards than you.`;
        case 'own_role_count': {
            const label = ROLE_LABELS[m.params.role as Role];
            return `You hold ${m.params.threshold}+ ${label}s in your domain.`;
        }
        default:
            return 'Secret ambition.';
    }
}

// ================================================================================
// Lobby views
// ================================================================================
export class CourtisansHostLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;
        const playerCount = mp.playersCount() + 1;
        const ok = playerCount >= 2 && playerCount <= 5;

        const links = {
            'home': {
                'icon': 'home', 'label': 'Lobby',
                'view': (
                    <div>
                        {mp.getPluginView('lobby', 'SetNameWithLobby')}
                        {!ok && (
                            <p style={{ color: '#c56d63', fontWeight: 700, textAlign: 'center', marginTop: 20 }}>
                                Courtisans needs 2 to 5 players. Currently {playerCount}.
                            </p>
                        )}
                    </div>
                )
            },
            'clients': {
                'icon': 'users', 'label': 'Players',
                'view': mp.getPluginView('lobby', 'host-roommanagement')
            },
            'rules': { 'icon': 'book', 'label': 'Rules', 'view': <CourtisansRulesView /> }
        };

        return mp.getPluginView('gameshell', 'HostShell-Main', { 'gameName': 'Courtisans', 'links': links });
    }
}

export class CourtisansClientLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;
        const links = {
            'home': {
                'icon': 'id-card', 'label': 'Lobby',
                'view': (
                    <div>
                        {mp.getPluginView('lobby', 'SetNameWithLobby')}
                        <div className="courtisans-waiting">Waiting for the host to open the court…</div>
                    </div>
                )
            },
            'rules': { 'icon': 'book', 'label': 'Rules', 'view': <CourtisansRulesView /> }
        };
        return mp.getPluginView('gameshell', 'HostShell-Main', { 'gameName': 'Courtisans', 'links': links });
    }
}

// ================================================================================
// Rules reference
// ================================================================================
export class CourtisansRulesView extends React.Component<{}, {}> {
    public render() {
        const roles: Role[] = ['noble', 'guard', 'spy', 'assassin', 'plain'];
        const roleDesc: Record<Role, string> = {
            noble: 'Counts as two cards everywhere.',
            guard: 'Can never be assassinated.',
            spy: 'Face down; family hidden until the end.',
            assassin: 'On play, may eliminate a card in the same area.',
            plain: 'A courtier with no special effect.'
        };
        return (
            <div className="courtisans-rules">
                <div className="rules-section">
                    <h3>The Court</h3>
                    <p>
                        Six families vie for the Queen's favour. Each turn you play <strong>one card into
                        each of three places</strong>: the <strong>Queen's Table</strong> (sway a family up
                        or down), <strong>your own domain</strong>, and <strong>an opponent's domain</strong>.
                    </p>
                    <div className="rules-crests">
                        {FAMILIES.map(f => (
                            <div className="rc-item" key={f}>
                                <span className="rc-crest"><ExpressiveIcon icon={CREST_ICONS[f]} palette={FAMILY_PALETTES[f]} /></span>
                                <span className="rc-label">{FAMILY_LABELS[f]}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="rules-section">
                    <h3>The Five Roles</h3>
                    <div className="rules-roles">
                        {roles.map(r => (
                            <div className="rr-item" key={r}>
                                <span className="rr-badge" style={{ background: r === 'plain' ? '#9aa2b0' : (ROLE_BADGE_BG[r] || '#6b7488') }}>
                                    <ExpressiveIcon icon={ROLE_ICONS[r]} palette={SLATE_PALETTE} />
                                </span>
                                <span className="rr-text">
                                    <span className="rr-name">{ROLE_LABELS[r]}</span>
                                    <div className="rr-desc">{roleDesc[r]}</div>
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="rules-section">
                    <h3>Scoring</h3>
                    <ul>
                        <li>At game end each family is <strong>esteemed</strong> (more above), <strong>fallen</strong>
                            (more below), or <strong>neutral</strong> — nobles count as 2.</li>
                        <li>Each courtier in <strong>your</strong> domain scores <strong>+1</strong> if its family
                            is esteemed, <strong>−1</strong> if fallen (nobles ±2).</li>
                        <li>Each fulfilled <strong>secret mission</strong> is worth <strong>+3</strong>.</li>
                    </ul>
                </div>

                <div className="rules-section highlight">
                    <h3>Winning</h3>
                    <p>When the draw pile is spent and every hand is empty, the Queen judges. <strong>Highest
                        total wins</strong>; ties are shared.</p>
                </div>
            </div>
        );
    }
}

// ================================================================================
// Missions peek panel (private)
// ================================================================================
interface MissionsViewProps {
    missions: Mission[];
    fulfilled?: string[];
    MP?: any;                 // needed to render the lobby player-tag inline
    leftNeighborId?: string;  // the seat to this player's left (turn order)
}

export class CourtisansMissionsView extends React.Component<MissionsViewProps, {}> {
    // The badge shows the mission's subject as iconography: the family crest for a
    // family mission, the role glyph for a role mission, else a court-lean mark.
    private renderBadge(m: Mission) {
        if (m.params.family) {
            return (
                <span className="mc-badge crest">
                    <ExpressiveIcon icon={CREST_ICONS[m.params.family]} palette={FAMILY_PALETTES[m.params.family]} />
                </span>
            );
        }
        if (m.params.role) {
            return (
                <span className="mc-badge role" style={{ background: ROLE_BADGE_BG[m.params.role] || '#6b7488' }}>
                    <ExpressiveIcon icon={ROLE_ICONS[m.params.role]} palette={SLATE_PALETTE} />
                </span>
            );
        }
        // B7/B8/B9/B10 all pull the court downward — a shared disgrace mark.
        return <span className={`mc-badge court ${m.color}`}>▼</span>;
    }

    // Neighbour-comparison missions render the actual left-hand player's tag in
    // place of the words "the player to your left".
    private renderTitle(m: Mission) {
        if (m.type === 'neighbor_family_compare' && this.props.MP && this.props.leftNeighborId) {
            const tag = this.props.MP.getPluginView('lobby', 'player-tag', { clientId: this.props.leftNeighborId });
            return (
                <span className="mc-title">
                    {tag} holds more {FAMILY_LABELS[m.params.family as Family]} cards than you.
                </span>
            );
        }
        return <span className="mc-title">{missionText(m)}</span>;
    }

    public render() {
        const { missions, fulfilled } = this.props;
        return (
            <div className="missions-panel">
                <div className="mp-intro">
                    Your two secret ambitions. Each is worth <strong>+3</strong> if fulfilled at game end. Keep
                    them hidden — opponents can starve a mission they guess.
                </div>
                {missions.map(m => {
                    const done = fulfilled ? fulfilled.indexOf(m.id) >= 0 : false;
                    return (
                        <div className={`mission-card ${m.color} ${done ? 'done' : ''}`} key={m.id}>
                            {this.renderBadge(m)}
                            <div className="mc-body">
                                {this.renderTitle(m)}
                                {done ? <span className="mc-done">✓ Fulfilled · +3</span> : <span className="mc-reward">Reward +3</span>}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }
}

// ================================================================================
// Main page
// ================================================================================
interface MainState {
    selectedCardId: string | null;
    placeMode: null | 'table' | 'opp';
    flying: FlyAnim[];
    slashes: SlashAnim[];
}

export class CourtisansMainPage extends React.Component<CourtisansProps, MainState> {
    private flyCounter = 0;

    constructor(props: CourtisansProps) {
        super(props);
        this.state = { selectedCardId: null, placeMode: null, flying: [], slashes: [] };
    }

    // Every card currently on the board (table columns + Queen's column + all
    // domains), keyed by id — used to detect what an assassination removed.
    private boardCards(props: CourtisansProps): Map<string, ViewCard> {
        const m = new Map<string, ViewCard>();
        const add = (c: ViewCard) => { if (c) m.set(c.id, c); };
        const t = props.table || {};
        [...FAMILIES, 'queen' as any].forEach((k) => {
            const col = t[k];
            if (col) { (col.above || []).forEach(add); (col.below || []).forEach(add); }
        });
        const d = props.domains || {};
        Object.keys(d).forEach(pid => (d[pid] || []).forEach(add));
        return m;
    }

    // Just before React removes the assassinated card from the DOM, capture where
    // it sat so we can play the slash there. Runs on every client.
    public getSnapshotBeforeUpdate(prevProps: CourtisansProps): SlashAnim[] | null {
        if (typeof document === 'undefined') return null;
        const lm = this.props.lastMove;
        const prevId = prevProps.lastMove ? prevProps.lastMove.moveId : null;
        if (!lm || lm.kind !== 'assassinate' || lm.moveId === prevId) return null;

        const prevCards = this.boardCards(prevProps);
        const nowIds = this.boardCards(this.props);
        const anims: SlashAnim[] = [];
        prevCards.forEach((card, id) => {
            if (nowIds.has(id)) return;
            const el = document.querySelector(`[data-cardid="${id}"]`);
            if (!el) return;
            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) return;
            anims.push({ key: `slash-${lm.moveId}-${id}`, card, x: r.left, y: r.top, w: r.width, h: r.height });
        });
        return anims.length ? anims : null;
    }

    public componentDidUpdate(prev: CourtisansProps, _prevState: MainState, snapshot?: SlashAnim[] | null) {
        const lm = this.props.lastMove;
        const prevId = prev.lastMove ? prev.lastMove.moveId : null;
        if (lm && lm.moveId !== prevId) {
            switch (lm.kind) {
                case 'place': playSound(lm.zone === 'oppDomain' ? GiveSound : PlaceSound); break;
                case 'assassinate': playSound(AssassinSound); break;
                case 'gameOver': playSound(EndSound); break;
                default: break;
            }
            // Every client shows the fly animation of the card just played, so
            // even players not on turn get a hint of what happened.
            if (lm.kind === 'place') this.triggerFly(lm);
        }
        // Slash animations captured just before the DOM removed the victim card.
        if (snapshot && snapshot.length) {
            this.setState(st => ({ slashes: [...st.slashes, ...snapshot] }));
        }
        // If our hand changed (new turn / drew), clear a stale selection.
        if (prev.myHand !== this.props.myHand && this.state.selectedCardId
            && !this.props.myHand.some(c => c.id === this.state.selectedCardId)) {
            this.setState({ selectedCardId: null, placeMode: null });
        }
    }

    private removeSlash = (key: string) => {
        this.setState(st => ({ slashes: st.slashes.filter(s => s.key !== key) }));
    };

    // ---- fly animation ----
    private removeFly = (key: string) => {
        this.setState(st => ({ flying: st.flying.filter(f => f.key !== key) }));
    };

    // Launch a ghost card from the playing player's panel toward the destination
    // (a family row on the Queen's Table, or the receiving player's panel).
    private triggerFly(lm: LastMove) {
        if (typeof document === 'undefined') return;
        const srcEl = document.querySelector(`[data-cpanel="${lm.playerId}"]`);
        let destEl: Element | null = null;
        if (lm.zone === 'table') {
            const key = lm.role === 'spy' ? 'queen' : lm.family;
            destEl = key ? document.querySelector(`[data-famrow="${key}"]`) : null;
        } else if (lm.targetOwnerId) {
            destEl = document.querySelector(`[data-cpanel="${lm.targetOwnerId}"]`);
        }
        if (!srcEl || !destEl) return;

        const s = srcEl.getBoundingClientRect();
        const d = destEl.getBoundingClientRect();
        const size = 36;
        const center = (r: DOMRect, axis: 'x' | 'y') =>
            axis === 'x' ? r.left + r.width / 2 - size / 2 : r.top + r.height / 2 - size / 2;

        // A spy travels as a face-down back; everything else shows its family crest.
        const card: ViewCard = (lm.role === 'spy' || !lm.family) ? { id: 'fly', hidden: true } : { id: 'fly', family: lm.family };
        const key = `fly-${lm.moveId}-${this.flyCounter++}`;
        const anim: FlyAnim = {
            key, card, size,
            fromX: center(s, 'x'), fromY: center(s, 'y'),
            toX: center(d, 'x'), toY: center(d, 'y')
        };
        this.setState(st => ({ flying: [...st.flying, anim] }));
    }

    // Cards currently glowing (recently played) and the accent to glow them with.
    private glowFor(cardId: string): string | undefined {
        const h = this.props.highlight;
        if (!h || h.cardIds.indexOf(cardId) < 0) return undefined;
        return this.accent(h.playerId);
    }

    // The set of card ids the pending assassin may eliminate — but only shown to
    // the player who must resolve it. The engine already scopes these to the right
    // area (a domain, or the whole table incl. the Queen's column), and to
    // non-guards, so ANY placed card whose id is here is a legal target.
    private assassinTargets(): string[] {
        return this.myPendingAssassin() ? this.props.pendingAssassin!.targets : [];
    }

    // Render a placed courtier token, made clickable (red pulse) when it is a
    // legal assassin target. Used everywhere cards sit: table columns, the Queen's
    // column, and player domains — so spies and domain cards are all selectable.
    private placedToken(c: ViewCard, size: number) {
        const isTarget = this.assassinTargets().indexOf(c.id) >= 0;
        return (
            <CardToken
                key={c.id}
                card={c}
                size={size}
                target={isTarget}
                glow={this.glowFor(c.id)}
                onClick={isTarget ? () => this.resolveAssassin(c.id) : undefined}
            />
        );
    }

    private get me() { return this.props.MP.clientId; }
    private name(id: string) { return this.props.playerNames[id] || 'Player'; }
    private accent(id: string) { return this.props.playerAccents[id] || '#7c8aa5'; }

    private badge(id: string) {
        const iconName = LOBBY_ICONS[this.props.playerIcons[id] ?? 0] || 'circle';
        return (
            <span style={{ display: 'inline-flex', width: '1.15em', height: '1.15em' }}>
                <FontAwesomeIcon icon={iconName} style={{ color: this.accent(id), width: '100%', height: '100%' }} />
            </span>
        );
    }

    private amActing(): boolean {
        return this.props.gameStatus === 'Playing' && this.props.currentPlayerId === this.me;
    }
    private myPendingAssassin(): boolean {
        const pa = this.props.pendingAssassin;
        return !!pa && pa.playerId === this.me;
    }

    // ---- actions ----
    private selectCard = (id: string) => {
        if (!this.amActing() || this.myPendingAssassin()) return;
        this.setState({ selectedCardId: this.state.selectedCardId === id ? null : id, placeMode: null });
    };

    private place(zone: Zone, level?: 'above' | 'below', targetPlayerId?: string) {
        const id = this.state.selectedCardId;
        if (!id) return;
        this.props.MP.placeCard(id, zone, level, targetPlayerId);
        this.setState({ selectedCardId: null, placeMode: null });
    }

    private resolveAssassin(targetCardId?: string) {
        this.props.MP.resolveAssassin(targetCardId || '');
    }

    private opponents(): string[] {
        return this.props.playerOrder.filter(id => id !== this.me);
    }

    // Order a domain's cards by family, matching the Queen's Table row order.
    // Face-down spies (unknown family) trail at the end; stable within a family.
    private sortByFamily(cards: ViewCard[]): ViewCard[] {
        const rank = (c: ViewCard) => (c.hidden || !c.family) ? FAMILIES.length : FAMILIES.indexOf(c.family);
        return cards
            .map((c, i) => ({ c, i }))
            .sort((x, y) => (rank(x.c) - rank(y.c)) || (x.i - y.i))
            .map(o => o.c);
    }

    // ---- Queen's Table ----
    private renderTable() {
        const { table, tableLean, score, gameStatus } = this.props;
        const isOver = gameStatus === 'GameOver';
        const rows = FAMILIES.map(f => this.renderFamilyRow(f, table[f], tableLean[f], isOver ? (score ? score.familyStatus[f] : undefined) : undefined));

        // Queen's column: face-down spies awaiting the reveal.
        const queen = table.queen;
        const queenCount = (queen ? queen.above.length : 0) + (queen ? queen.below.length : 0);

        return (
            <div className="queens-table">
                {rows}
                {queenCount > 0 && (
                    <div className="fam-row queen-row" data-famrow="queen">
                        <div className="zone above">
                            <div className="zone-cards">
                                {queen.above.map(c => this.placedToken(c, 24))}
                                {queen.above.length === 0 && <span className="zone-empty">—</span>}
                            </div>
                        </div>
                        <div className="fam-id">
                            <span className="fam-crest"><ExpressiveIcon icon={BACK_ICON} palette={SLATE_PALETTE} /></span>
                            <div className="fam-text">
                                <div className="fam-name">Queen's Confidants</div>
                                <div className="fam-lean"><span className="neutral">{queenCount} hidden spy{queenCount === 1 ? '' : 'ies'}</span></div>
                            </div>
                        </div>
                        <div className="zone below">
                            <div className="zone-cards">
                                {queen.below.map(c => this.placedToken(c, 24))}
                                {queen.below.length === 0 && <span className="zone-empty">—</span>}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    private renderFamilyRow(f: Family, col: ColumnView, lean: { above: number; below: number }, status?: FamilyStatus) {
        const a = lean ? lean.above : 0;
        const b = lean ? lean.below : 0;
        // Favour (left) / Disgrace (right) is conveyed by zone colour alone.
        const renderZone = (cards: ViewCard[], which: 'above' | 'below') => (
            <div className={`zone ${which}`}>
                <div className="zone-cards">
                    {cards.map(c => this.placedToken(c, 24))}
                    {cards.length === 0 && <span className="zone-empty">—</span>}
                </div>
            </div>
        );
        return (
            <div className="fam-row" key={f} data-famrow={f}>
                {renderZone(col.above, 'above')}
                <div className="fam-id">
                    <CrestGlyph family={f} size={28} className="fam-crest" />
                    <div className="fam-text">
                        <div className="fam-name">{FAMILY_LABELS[f]}</div>
                        {status
                            ? <span className={`fam-status ${status}`}>{status}</span>
                            : <div className="fam-lean">
                                <span className="up">▲{a}</span>
                                <span className="down">▼{b}</span>
                            </div>}
                    </div>
                </div>
                {renderZone(col.below, 'below')}
            </div>
        );
    }

    // ---- domains ----
    private renderDomains() {
        const { playerOrder, domains, currentPlayerId, score } = this.props;
        const selecting = this.state.placeMode === 'opp' && this.state.selectedCardId && this.amActing();
        return (
            <div className="domains-grid">
                {playerOrder.map(id => {
                    const cards = this.sortByFamily(domains[id] || []);
                    const isMe = id === this.me;
                    const givable = !!selecting && !isMe && !this.props.turnZones.oppDomain;
                    const cls = ['domain-panel'];
                    if (id === currentPlayerId && this.props.gameStatus === 'Playing') cls.push('current');
                    if (isMe) cls.push('me');
                    if (givable) cls.push('givable');
                    const ps = score ? score.players[id] : null;
                    return (
                        <div className={cls.join(' ')} key={id} data-cpanel={id} onClick={givable ? () => this.place('oppDomain', undefined, id) : undefined}>
                            <div className="dp-head">
                                {this.badge(id)}
                                <span className="dp-name">{this.name(id)}{isMe ? ' (you)' : ''}</span>
                                {ps
                                    ? <span className="dp-score">{ps.total >= 0 ? '+' : ''}{ps.total}</span>
                                    : givable ? <span className="dp-tag give">Give</span>
                                        : id === currentPlayerId && this.props.gameStatus === 'Playing' ? <span className="dp-tag turn">Turn</span>
                                            : null}
                            </div>
                            <div className="dp-cards">
                                {cards.length === 0
                                    ? <span className="dp-empty">no courtiers yet</span>
                                    : cards.map(c => this.placedToken(c, 30))}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    // ---- hand + controls ----
    private renderDock() {
        if (this.props.gameStatus === 'GameOver') return null;

        if (this.myPendingAssassin()) return this.renderAssassinBar();

        if (!this.amActing()) {
            return <div className="waiting-note">Waiting for {this.name(this.props.currentPlayerId)} to hold court…</div>;
        }

        const { turnZones, myHand } = this.props;
        const selected = this.state.selectedCardId;
        const zoneChip = (label: string, done: boolean) => (
            <span className={`zp ${done ? 'done' : ''}`}>{done && <span>✓</span>}{label}</span>
        );

        return (
            <div className="hand-dock acting">
                <div className="dock-title">Your turn — place one card in each place</div>
                <div className="zone-progress">
                    {zoneChip("Queen's Table", turnZones.table)}
                    {zoneChip('Your Domain', turnZones.ownDomain)}
                    {zoneChip('Opponent', turnZones.oppDomain)}
                </div>

                <div className="hand-row">
                    {myHand.length === 0
                        ? <span className="hand-empty">Hand empty — passing…</span>
                        : myHand.map(c => (
                            <CardToken
                                key={c.id}
                                card={c}
                                size={54}
                                selectable
                                selected={selected === c.id}
                                onClick={() => this.selectCard(c.id)}
                            />
                        ))}
                </div>

                {selected && this.renderPlaceMenu(selected)}
            </div>
        );
    }

    private renderPlaceMenu(cardId: string) {
        const card = this.props.myHand.find(c => c.id === cardId);
        if (!card) return null;
        const { turnZones } = this.props;
        const opps = this.opponents();
        const isSpy = card.role === 'spy';

        return (
            <div className="place-menu">
                <div className="pm-label">
                    Placing {isSpy ? 'a spy' : `${FAMILY_LABELS[card.family]} ${ROLE_LABELS[card.role]}`} —
                    choose a destination:
                </div>

                <div className="pm-row">
                    <button className="favour-btn" disabled={turnZones.table} onClick={() => this.place('table', 'above')}>
                        <span className="btn-arrow">▲</span> Table · Favour
                    </button>
                    <button className="disgrace-btn" disabled={turnZones.table} onClick={() => this.place('table', 'below')}>
                        <span className="btn-arrow">▼</span> Table · Disgrace
                    </button>
                    {isSpy && <span className="dock-hint">Spies hide in the Queen's column until the end.</span>}
                </div>

                <div className="pm-row">
                    <button className="primary-btn" disabled={turnZones.ownDomain} onClick={() => this.place('ownDomain')}>
                        <FontAwesomeIcon icon="user-circle" /> My Domain
                    </button>

                    {turnZones.oppDomain
                        ? <button className="ghost-btn" disabled><FontAwesomeIcon icon="users" /> Opponent (done)</button>
                        : opps.length === 1
                            ? <button className="gold-btn" onClick={() => this.place('oppDomain', undefined, opps[0])}>
                                <FontAwesomeIcon icon="users" /> Give to {this.name(opps[0])}
                            </button>
                            : <button className="gold-btn" onClick={() => this.setState({ placeMode: this.state.placeMode === 'opp' ? null : 'opp' })}>
                                <FontAwesomeIcon icon="users" /> {this.state.placeMode === 'opp' ? 'Tap an opponent below' : 'Give to an opponent'}
                            </button>}
                </div>
            </div>
        );
    }

    private renderAssassinBar() {
        const pa = this.props.pendingAssassin!;
        const areaText = pa.area.kind === 'table' ? 'the Queen’s Table' : 'that domain';
        const has = pa.targets.length > 0;
        return (
            <div className="assassin-bar">
                <div className="ab-text">
                    <span className="role-badge" style={{ position: 'static', width: 24, height: 24, border: 'none', display: 'inline-block', borderRadius: '50%', overflow: 'hidden', background: '#b25151' }}>
                        <ExpressiveIcon icon={ROLE_ICONS.assassin} palette={SLATE_PALETTE} />
                    </span>
                    Assassin played — {has ? `tap a highlighted card in ${areaText} to eliminate it,` : `no legal targets in ${areaText};`} or hold the blade.
                </div>
                <button className="ghost-btn" onClick={() => this.resolveAssassin()}>Skip</button>
            </div>
        );
    }

    // ---- score / game over ----
    private renderScore() {
        const score = this.props.score;
        if (!score) return null;
        const { playerOrder } = this.props;
        const sorted = [...playerOrder].sort((a, b) => score.players[b].total - score.players[a].total);
        const winners = score.winnerIds;
        const shared = winners.length > 1;

        return (
            <div className="score-sheet">
                <div className="ss-crown">👑</div>
                <div className="ss-title">
                    {shared
                        ? 'A shared verdict!'
                        : `${this.name(winners[0])} wins the Queen's favour`}
                </div>
                <div className="ss-sub">
                    {shared ? `${winners.map(w => this.name(w)).join(' & ')} tie for the crown.` : 'The court has spoken.'}
                </div>

                <div className="fam-verdict">
                    {FAMILIES.map(f => (
                        <span className={`fv ${score.familyStatus[f]}`} key={f}>
                            <CrestGlyph family={f} size={20} className="fv-crest" />
                            {FAMILY_LABELS[f]} · {score.familyStatus[f]}
                        </span>
                    ))}
                </div>

                <table className="score-table">
                    <thead><tr><th>#</th><th>Player</th><th>Domain</th><th>Missions</th><th>Total</th></tr></thead>
                    <tbody>
                        {sorted.map((id, i) => {
                            const ps = score.players[id];
                            return (
                                <tr key={id} className={winners.indexOf(id) >= 0 ? 'winner-row' : ''}>
                                    <td>{i === 0 ? '🏆' : i + 1}</td>
                                    <td><span className="st-name">{this.badge(id)} {this.name(id)}{id === this.me ? ' (you)' : ''}</span></td>
                                    <td>{ps.domainScore >= 0 ? '+' : ''}{ps.domainScore}</td>
                                    <td>{ps.missionScore > 0 ? `+${ps.missionScore}` : '0'}</td>
                                    <td className="st-total">{ps.total >= 0 ? '+' : ''}{ps.total}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {this.props.isHost && (
                    <div className="ss-actions">
                        <button className="primary-btn" onClick={() => this.props.MP.restartGame()}>Play Again</button>
                        <button className="ghost-btn" onClick={() => this.props.MP.backToLobby()}>Back to Lobby</button>
                    </div>
                )}
            </div>
        );
    }

    // ---- top labels ----
    private phaseLabel(): string {
        if (this.props.gameStatus === 'GameOver') return 'Final Judgement';
        if (this.myPendingAssassin()) return 'Assassin';
        return 'The Court';
    }
    private turnLabel(): string {
        if (this.props.gameStatus === 'GameOver') {
            const w = this.props.score ? this.props.score.winnerIds : [];
            return w.indexOf(this.me) >= 0 ? 'Victory' : 'Game Over';
        }
        if (this.amActing()) return 'Your Turn';
        return `${this.name(this.props.currentPlayerId)}'s turn`;
    }

    public render() {
        const mp = this.props.MP;
        const over = this.props.gameStatus === 'GameOver';
        const myFulfilled = over && this.props.score ? this.props.score.players[this.me]?.fulfilledMissionIds : undefined;

        // The seat to this player's left (clockwise turn order) — the subject of the
        // W1-W6 neighbour missions.
        const order = this.props.playerOrder || [];
        const myIdx = order.indexOf(this.me);
        const leftNeighborId = myIdx >= 0 && order.length > 0 ? order[(myIdx + 1) % order.length] : undefined;

        const arena = (
            <div className="courtisans-arena">
                <div className="arena-topline">
                    <span className="phase-pill">{this.phaseLabel()}</span>
                    <span className="turn-pill">{this.turnLabel()}</span>
                </div>

                {over ? this.renderScore() : (
                    <React.Fragment>
                        <div className="section-label">
                            Queen's Table
                            <span className="draw-note">· {this.props.drawCount} in deck · {this.props.removedCount} sealed away</span>
                        </div>
                        {this.renderTable()}

                        <div className="section-label">Domains</div>
                        {this.renderDomains()}

                        {this.renderDock()}
                    </React.Fragment>
                )}

                <div className="fly-layer">
                    {this.state.flying.map(a => <FlyingCard key={a.key} anim={a} onDone={this.removeFly} />)}
                </div>
                <div className="slash-layer">
                    {this.state.slashes.map(a => <SlashCard key={a.key} anim={a} onDone={this.removeSlash} />)}
                </div>
            </div>
        );

        const links: any = {
            'home': { 'icon': 'gamepad', 'label': 'Court', 'view': arena },
            'missions': {
                'icon': 'scroll', 'label': 'Missions',
                'view': <CourtisansMissionsView missions={this.props.myMissions} fulfilled={myFulfilled} MP={mp} leftNeighborId={leftNeighborId} />
            },
            'rules': { 'icon': 'book', 'label': 'Rules', 'view': <CourtisansRulesView /> }
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

        return mp.getPluginView('gameshell', 'HostShell-Main', {
            'links': links,
            'gameName': 'Courtisans',
            'topBarContent': this.turnLabel(),
            'roomClassName': (this.amActing() || this.myPendingAssassin()) ? 'attention-bg' : ''
        });
    }
}
