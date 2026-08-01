/**
 * MagicalAthletesViews.tsx - React components for "Magical Athletes".
 *
 * The race track is the centrepiece: a compact vertical serpentine that fits a
 * phone, auto-following the active racer. Everything is stateless except a little
 * ephemeral selection UI (which racer you're about to commit). All game state is
 * pushed from the host.
 */

import * as React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ViewPropsInterface } from '../../../common/interfaces';
import { icons as LOBBY_ICONS } from '../../lobby/LobbyView';
import { ExpressiveIcon } from '../../../client/lib/card-renderer/IconEngine';
import {
    ROSTER, ROSTER_BY_ID, TRACKS, RacerState, GameEvent, PlayerScore, Phase, TurnTimeline, PendingDecision
} from '../MagicalAthletesGameState';
import {
    RACER_ICONS, ATH_PALETTE, START_ICON, FINISH_ICON, STAR_ICON, ARROW_ICON, TRIP_ICON, racerColor
} from '../MagicalAthletesAssets';

import RollSound from '../../../sounds/dice_roll.mp3';
import ChipSound from '../../../sounds/coin_few.mp3';
import RaceSound from '../../../sounds/connected.mp3';

function playSound(src: string) {
    if (typeof Audio === 'undefined' || !src) return;
    try {
        const a = new Audio(src);
        const p = a.play();
        if (p && typeof p.catch === 'function') p.catch(() => { /* blocked until interaction */ });
    } catch (e) { /* ignore */ }
}

// Auto mode is a per-player, client-local preference persisted across rounds (and
// reloads) via localStorage.
//   off  — nothing automatic
//   dice — auto-roll your turns, but YOU still make racer-power choices
//   full — auto-roll AND auto-resolve power choices (picks the first option)
// Neither mode ever advances past the race-completion screen — the host always
// clicks "Next Race" / "See Final Standings" explicitly.
type AutoMode = 'off' | 'dice' | 'full';
const AUTO_KEY = 'ma-automode';
function loadMode(): AutoMode {
    try {
        const v = typeof localStorage !== 'undefined' ? localStorage.getItem(AUTO_KEY) : null;
        return (v === 'dice' || v === 'full') ? v : 'off';
    } catch (e) { return 'off'; }
}
function saveMode(v: AutoMode) {
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(AUTO_KEY, v); } catch (e) { /* ignore */ }
}

// ---- die face -----------------------------------------------------------------
// pip positions as [col, row] in a 0..2 grid.
const DIE_PIPS: Record<number, Array<[number, number]>> = {
    1: [[1, 1]],
    2: [[0, 0], [2, 2]],
    3: [[0, 0], [1, 1], [2, 2]],
    4: [[0, 0], [2, 0], [0, 2], [2, 2]],
    5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
    6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]]
};

function Die(props: { value: number; rolling?: boolean }) {
    const on = DIE_PIPS[props.value] || [];
    const cells = [];
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
            const lit = on.some(p => p[0] === c && p[1] === r);
            cells.push(<span key={`${r}-${c}`} className={`ma-pip ${lit ? 'on' : ''}`} />);
        }
    }
    return <span className={`ma-die ${props.rolling ? 'rolling' : ''}`}>{cells}</span>;
}

// ---- animation view-model -------------------------------------------------------
interface AnimRacer { pos: number; finished: boolean; eliminated: boolean; tripped: boolean; }
interface Frame { racers: Record<string, AnimRacer>; active?: string; }
interface AnimState { frames: Frame[]; index: number; die: number | null; playerId: string; }
interface TrackTok { ownerId: string; racerId: string; tripped: boolean; finishRank: number; }

interface MAProps extends ViewPropsInterface {
    status: Phase;
    raceNo: number;
    schedule: ('mild' | 'wild')[];
    trackId: 'mild' | 'wild';
    racers: Record<string, RacerState>;
    participants: string[];
    currentId: string;
    lastRoll: number | null;
    lastTurn: TurnTimeline | null;
    pendingDecision: PendingDecision | null;
    finishers: string[];
    eliminatedOrder: string[];
    raceOver: boolean;
    scores: Record<string, PlayerScore>;
    events: GameEvent[];
    finalWinners: string[];
    playerNames: Record<string, string>;
    playerAccents: Record<string, string>;
    playerIcons: Record<string, number>;
    pickedStatus: Record<string, boolean>;
    draftPool: string[];
    draftSeq: string[];
    draftRound: number;
    currentDrafter: string;
    draftCounts: Record<string, number>;
    isHost: boolean;
    myHand: string[];
    myUsed: string[];
    myPick: string | null;
}

// ---- shared primitives ---------------------------------------------------------

// A racer coin, optionally with a coloured ring (active), a dimmed look, or a
// "tripped" tilt.
function RacerCoin(props: { racerId: string; size: number; ring?: string; dim?: boolean; tripped?: boolean; moving?: boolean; current?: boolean; title?: string }) {
    const icon = RACER_ICONS[props.racerId];
    const style: React.CSSProperties = { width: props.size, height: props.size };
    const cls = ['ma-coin'];
    // The active player's token pulses a bright halo so whose turn it is reads at a
    // glance; otherwise a plain accent ring.
    if (props.current && props.ring) {
        (style as any)['--glow'] = props.ring;
        cls.push('current-turn');
    } else if (props.ring) {
        style.boxShadow = `0 0 0 3px ${props.ring}`;
    }
    if (props.dim) cls.push('dim');
    if (props.tripped) cls.push('tripped');
    if (props.moving) cls.push('moving');
    return (
        <span className={cls.join(' ')} style={style} title={props.title || (ROSTER_BY_ID[props.racerId] ? ROSTER_BY_ID[props.racerId].name : props.racerId)}>
            {icon ? <ExpressiveIcon icon={icon} palette={ATH_PALETTE} /> : null}
        </span>
    );
}

// #rrggbb -> rgba for soft tints.
function hexToRgba(hex: string, alpha: number): string {
    const h = (hex || '').replace('#', '');
    if (h.length !== 6) return `rgba(124,138,165,${alpha})`;
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

// A full racer info card (coin + name + power) — used in the stable & choose UI.
function RacerCard(props: { racerId: string; selected?: boolean; used?: boolean; onClick?: () => void }) {
    const def = ROSTER_BY_ID[props.racerId];
    if (!def) return null;
    const cls = ['ma-racer-card'];
    if (props.selected) cls.push('selected');
    if (props.used) cls.push('used');
    if (props.onClick) cls.push('selectable');
    return (
        <div className={cls.join(' ')} onClick={props.onClick} style={props.selected ? { boxShadow: `inset 0 0 0 2px ${def.color}` } : undefined}>
            <RacerCoin racerId={props.racerId} size={46} />
            <div className="rc-body">
                <div className="rc-name">{def.name}{props.used ? ' · used' : ''}</div>
                <div className="rc-title">{def.title}</div>
                <div className="rc-text">{def.text}</div>
            </div>
        </div>
    );
}

// ================================================================================
// Lobby
// ================================================================================
export class MagicalAthletesHostLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;
        const playerCount = mp.playersCount() + 1;
        const ok = playerCount >= 2 && playerCount <= 6;
        const links = {
            'home': {
                'icon': 'home', 'label': 'Lobby',
                'view': (
                    <div>
                        {mp.getPluginView('lobby', 'SetNameWithLobby')}
                        {!ok && (
                            <p className="ma-lobby-warn">Magical Athletes needs 2 to 6 players. Currently {playerCount}.</p>
                        )}
                    </div>
                )
            },
            'clients': { 'icon': 'users', 'label': 'Players', 'view': mp.getPluginView('lobby', 'host-roommanagement') },
            'rules': { 'icon': 'book', 'label': 'Rules', 'view': <MagicalAthletesRulesView /> }
        };
        return mp.getPluginView('gameshell', 'HostShell-Main', { 'gameName': 'Magical Athletes', 'links': links });
    }
}

export class MagicalAthletesClientLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;
        const links = {
            'home': {
                'icon': 'id-card', 'label': 'Lobby',
                'view': (
                    <div>
                        {mp.getPluginView('lobby', 'SetNameWithLobby')}
                        <div className="ma-waiting">Waiting for the host to start the meet…</div>
                    </div>
                )
            },
            'rules': { 'icon': 'book', 'label': 'Rules', 'view': <MagicalAthletesRulesView /> }
        };
        return mp.getPluginView('gameshell', 'HostShell-Main', { 'gameName': 'Magical Athletes', 'links': links });
    }
}

// ================================================================================
// Rules
// ================================================================================
export class MagicalAthletesRulesView extends React.Component<{}, {}> {
    public render() {
        return (
            <div className="ma-rules">
                <div className="rules-section">
                    <h3>The Draft</h3>
                    <p>First, build a stable of <strong>4 racers</strong>. Each round reveals a pool of
                        <strong> 2 racers per player</strong>; you draft in <strong>snake order</strong> (down the
                        table, then back up) so everyone takes two, then a fresh pool is revealed for the second round.</p>
                </div>
                <div className="rules-section">
                    <h3>The Meet</h3>
                    <p>Run <strong>four races</strong>. Each race you commit <strong>one racer</strong> from your stable —
                        used once, so save a strong one for last (later races are worth more). On your turn, tap to roll
                        a die and hop that many spaces. Every racer has a wacky power that bends the track.</p>
                </div>
                <div className="rules-section">
                    <h3>Winning a Race</h3>
                    <p>A race ends the instant the <strong>second</strong> racer crosses the line. Only 1st and 2nd score
                        chips. Stars, powers and pity-points add small bronze points along the way.</p>
                </div>
                <div className="rules-section">
                    <h3>The Tracks</h3>
                    <div className="rules-tracks">
                        <span className="rt-chip"><RacerCoinStatic icon={STAR_ICON} /> Star · +1 point</span>
                        <span className="rt-chip"><RacerCoinStatic icon={ARROW_ICON} /> Arrow · shove</span>
                        <span className="rt-chip"><RacerCoinStatic icon={TRIP_ICON} /> Trip · skip a turn</span>
                    </div>
                    <p>Races alternate the calm <strong>Mild Mile</strong> and the chaotic <strong>Wild Wilds</strong>
                        (arrows, trips and stars).</p>
                </div>
                <div className="rules-section highlight">
                    <h3>The Season</h3>
                    <p>After four races, the most points wins. Ties are shared.</p>
                    <p className="rules-note">When a racer's power gives you a choice — jog or roll, double or not,
                        who to pull — the game pauses and asks <em>you</em>. Everyone waits while you decide.</p>
                </div>
            </div>
        );
    }
}

function RacerCoinStatic(props: { icon: any }) {
    return <span className="ma-coin small"><ExpressiveIcon icon={props.icon} palette={ATH_PALETTE} /></span>;
}

// ================================================================================
// Main page
// ================================================================================
interface MainState { selected: string | null; anim: AnimState | null; rosterOpen: boolean; autoMode: AutoMode; }

export class MagicalAthletesMainPage extends React.Component<MAProps, MainState> {
    private trackRef = React.createRef<HTMLDivElement>();
    private animTimer: any = null;
    private autoTimer: any = null;

    constructor(props: MAProps) {
        super(props);
        this.state = { selected: props.myPick || null, anim: null, rosterOpen: true, autoMode: loadMode() };
    }

    public componentDidUpdate(prev: MAProps) {
        // A fresh turn timeline arrived from the host — replay it (identically on
        // every client). Roll sound plays as the die is shown.
        const lt = this.props.lastTurn;
        if (lt && (!prev.lastTurn || prev.lastTurn.id !== lt.id)) {
            if (lt.die) playSound(RollSound);
            this.startAnim(lt);
        }

        // Non-movement sounds on new events (finish chime, race fanfare).
        const ev = this.props.events && this.props.events.length ? this.props.events[this.props.events.length - 1] : null;
        const prevEv = prev.events && prev.events.length ? prev.events[prev.events.length - 1] : null;
        if (ev && (!prevEv || ev.id !== prevEv.id)) {
            if (ev.kind === 'finish' || ev.kind === 'star') playSound(ChipSound);
            else if (ev.kind === 'race') playSound(RaceSound);
        }

        if (prev.myPick !== this.props.myPick && this.props.myPick) this.setState({ selected: this.props.myPick });
        if (prev.status !== this.props.status && (this.props.status === 'Choose' || this.props.status === 'Draft')) this.setState({ selected: null });
        this.scrollToFollow();
        this.maybeAuto();
    }

    public componentDidMount() { this.scrollToFollow(); this.maybeAuto(); }
    public componentWillUnmount() { this.clearAnim(); this.clearAuto(); }

    // ---- auto-roll ----
    private clearAuto() { if (this.autoTimer) { clearTimeout(this.autoTimer); this.autoTimer = null; } }

    private setAutoMode = (m: AutoMode) => {
        saveMode(m);
        this.setState({ autoMode: m });
    };

    // The single auto action to take right now, if any. In 'dice' mode a pending
    // racer-power choice is deliberately left to the human; only 'full' resolves it.
    private autoAction(): (() => void) | null {
        const mode = this.state.autoMode;
        if (mode === 'off') return null;
        const pd = this.props.pendingDecision;
        if (pd && pd.playerId === this.me) {
            return mode === 'full' ? () => this.props.MP.resolveDecision(pd.options[0].id) : null;
        }
        if (pd) return null; // someone else's decision — wait
        if (this.props.status === 'Racing' && this.props.currentId === this.me) return () => this.props.MP.rollDice();
        // The race-completion screen is never auto-advanced: the host must click
        // "Next Race" / "See Final Standings" explicitly.
        return null;
    }

    // Schedule the next auto action after a short pause — but never while an
    // animation is playing (so turns don't stack up), and re-validated at fire time.
    private maybeAuto() {
        if (this.autoTimer) return;
        if (this.state.autoMode === 'off' || this.state.anim) return;
        if (!this.autoAction()) return;
        this.autoTimer = window.setTimeout(() => {
            this.autoTimer = null;
            if (this.state.autoMode === 'off' || this.state.anim) return;
            const act = this.autoAction();
            if (act) act();
        }, 750);
    }

    // ---- movement animation ----
    private clearAnim() { if (this.animTimer) { clearTimeout(this.animTimer); this.animTimer = null; } }

    // Expand the host's step list into per-cell frames (a discrete hop per space)
    // so the same motion plays on every device, main move first then effects.
    private buildFrames(turn: TurnTimeline): Frame[] {
        const LEN = TRACKS[this.props.trackId].length;
        const cur: Record<string, AnimRacer> = {};
        Object.keys(turn.start).forEach(id => {
            const s = turn.start[id];
            cur[id] = { pos: s.pos, finished: s.finished, eliminated: s.eliminated, tripped: false };
        });
        const snap = (active?: string): Frame => ({ racers: JSON.parse(JSON.stringify(cur)), active });
        const frames: Frame[] = [snap()];
        for (const step of turn.steps) {
            const r = cur[step.ownerId];
            if (!r) continue;
            if (step.kind === 'trip') { r.tripped = true; frames.push(snap(step.ownerId)); r.tripped = false; }
            else if (step.kind === 'eliminate') { r.eliminated = true; frames.push(snap(step.ownerId)); }
            else {
                const dir = step.to > step.from ? 1 : step.to < step.from ? -1 : 0;
                if (dir === 0) {
                    r.pos = step.to;
                    if (step.kind === 'finish') r.finished = true;
                    frames.push(snap(step.ownerId));
                } else {
                    let p = step.from;
                    while (p !== step.to) {
                        p += dir; r.pos = p;
                        if (step.kind === 'finish' && p >= LEN) r.finished = true;
                        frames.push(snap(step.ownerId));
                    }
                }
            }
        }
        return frames;
    }

    private startAnim(turn: TurnTimeline) {
        this.clearAnim();
        const frames = this.buildFrames(turn);
        if (frames.length <= 1) { this.setState({ anim: null }); return; }
        const per = Math.max(45, Math.min(120, Math.round(1300 / frames.length)));
        this.setState({ anim: { frames, index: 0, die: turn.die, playerId: turn.playerId } });
        let i = 0;
        const advance = () => {
            i++;
            if (i >= frames.length) { this.animTimer = setTimeout(() => this.setState({ anim: null }), 280); return; }
            this.setState(st => (st.anim ? { anim: { ...st.anim, index: i } } as MainState : null as any));
            this.animTimer = setTimeout(advance, per);
        };
        // hold on the first frame to show the die, then start hopping
        this.animTimer = setTimeout(advance, turn.die ? 520 : 220);
    }

    // The racers as they should render right now: mid-animation frame, or the final
    // reconciled state when idle.
    private viewRacers(): Record<string, AnimRacer> {
        if (this.state.anim) return this.state.anim.frames[this.state.anim.index].racers;
        const out: Record<string, AnimRacer> = {};
        for (const id of this.props.participants) {
            const r = this.props.racers[id];
            if (r) out[id] = { pos: r.pos, finished: r.finished, eliminated: r.eliminated, tripped: r.tripped };
        }
        return out;
    }
    private activeMover(): string | undefined {
        const a = this.state.anim;
        return a ? a.frames[a.index].active : undefined;
    }

    private scrollToFollow() {
        if (typeof document === 'undefined') return;
        const followId = this.activeMover() || this.props.currentId;
        if (!followId) return;
        const vr = this.viewRacers()[followId];
        const pos = vr ? vr.pos : (this.props.racers[followId] ? this.props.racers[followId].pos : -1);
        if (pos < 0 || (vr && vr.finished)) return;
        const el = this.trackRef.current && this.trackRef.current.querySelector(`[data-cell="${pos}"]`);
        if (el && (el as any).scrollIntoView) (el as any).scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    private get me() { return this.props.MP.clientId; }
    private name(id: string) { return this.props.playerNames[id] || 'Player'; }
    private accent(id: string) { return this.props.playerAccents[id] || '#7c8aa5'; }

    private badge(id: string) {
        const iconName = LOBBY_ICONS[this.props.playerIcons[id] ?? 0] || 'circle';
        return (
            <span className="ma-badge" style={{ color: this.accent(id) }}>
                <FontAwesomeIcon icon={iconName as any} />
            </span>
        );
    }

    private amCurrent(): boolean {
        return this.props.status === 'Racing' && this.props.currentId === this.me;
    }

    // ---- Draft phase (snake) ----
    private doDraft(id: string) {
        this.props.MP.draftPick(id);
        this.setState({ selected: null });
    }

    private renderDraft() {
        const { draftPool, currentDrafter, draftRound, myHand, participants } = this.props;
        const myTurn = currentDrafter === this.me;
        return (
            <div className="ma-choose">
                <div className="ma-choose-head">
                    <div className="ch-title">Draft your team</div>
                    <div className="ch-sub">Round {draftRound + 1} of 2 · snake draft · {draftPool.length} on offer</div>
                </div>

                <div className="ma-pick-status">
                    {participants.map(id => (
                        <span key={id} className={`ps-chip ${id === currentDrafter ? 'ready' : ''}`}>
                            {this.badge(id)} {this.name(id)}{id === this.me ? ' (you)' : ''} · {(this.props.draftCounts && this.props.draftCounts[id]) || 0}/4
                        </span>
                    ))}
                </div>

                <div className={`ma-draft-turn ${myTurn ? 'mine' : ''}`}>
                    {myTurn ? 'Your pick — choose a racer from the pool below.' : `Waiting for ${this.name(currentDrafter)} to draft…`}
                </div>

                {draftPool.length === 0
                    ? <div className="ma-locked">Revealing the next round of racers…</div>
                    : (
                        <div className="ma-racer-list">
                            {draftPool.map(id => (
                                <RacerCard key={id} racerId={id}
                                    selected={myTurn && this.state.selected === id}
                                    onClick={myTurn ? () => this.setState({ selected: id }) : undefined} />
                            ))}
                        </div>
                    )}

                {myTurn && draftPool.length > 0 && (
                    <button className="ma-primary" disabled={!this.state.selected}
                        onClick={() => this.state.selected && this.doDraft(this.state.selected)}>
                        Draft {this.state.selected && ROSTER_BY_ID[this.state.selected] ? ROSTER_BY_ID[this.state.selected].name : 'Racer'}
                    </button>
                )}

                {myHand.length > 0 && (
                    <div className="ma-mystable">
                        <div className="section-label">Your stable · {myHand.length}/4</div>
                        <div className="ma-coin-row">
                            {myHand.map(id => (
                                <span key={id} className="ma-coin-chip">
                                    <RacerCoin racerId={id} size={30} />
                                    <span>{ROSTER_BY_ID[id] ? ROSTER_BY_ID[id].name : id}</span>
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ---- Choose phase ----
    private renderChoose() {
        const { myHand, myPick, myUsed } = this.props;
        const locked = !!myPick;
        return (
            <div className="ma-choose">
                <div className="ma-choose-head">
                    <div className="ch-title">Choose your racer</div>
                    <div className="ch-sub">Race {this.props.raceNo + 1} of 4 · {TRACKS[this.props.trackId].name}</div>
                </div>

                <div className="ma-pick-status">
                    {this.props.participants.map(id => (
                        <span key={id} className={`ps-chip ${this.props.pickedStatus[id] ? 'ready' : ''}`}>
                            {this.badge(id)} {this.name(id)}{id === this.me ? ' (you)' : ''} {this.props.pickedStatus[id] ? '✓' : '…'}
                        </span>
                    ))}
                </div>

                {locked ? (
                    <div className="ma-locked">
                        You committed <strong>{ROSTER_BY_ID[myPick!] ? ROSTER_BY_ID[myPick!].name : myPick}</strong>.
                        Waiting for the rest of the field…
                    </div>
                ) : (
                    <React.Fragment>
                        <div className="ma-racer-list">
                            {myHand.map(id => (
                                <RacerCard key={id} racerId={id} selected={this.state.selected === id}
                                    onClick={() => this.setState({ selected: id })} />
                            ))}
                        </div>
                        <button className="ma-primary" disabled={!this.state.selected}
                            onClick={() => this.state.selected && this.props.MP.chooseRacer(this.state.selected)}>
                            Commit {this.state.selected && ROSTER_BY_ID[this.state.selected] ? ROSTER_BY_ID[this.state.selected].name : 'Racer'}
                        </button>
                    </React.Fragment>
                )}

                {myUsed.length > 0 && (
                    <div className="ma-used-note">Already raced: {myUsed.map(id => ROSTER_BY_ID[id] ? ROSTER_BY_ID[id].name : id).join(', ')}</div>
                )}
            </div>
        );
    }

    // ---- The race track ----
    private renderTrack() {
        const track = TRACKS[this.props.trackId];
        const LEN = track.length;
        const vr = this.viewRacers();
        const activeMover = this.activeMover();
        const byPos: Record<number, TrackTok[]> = {};
        const finished: TrackTok[] = [];
        this.props.participants.forEach(id => {
            const a = vr[id];
            const base = this.props.racers[id];
            if (!a || !base) return;
            if (a.eliminated) return;
            const tok: TrackTok = { ownerId: id, racerId: base.racerId, tripped: a.tripped, finishRank: base.finishRank || 0 };
            if (a.finished || a.pos >= LEN) { finished.push(tok); return; }
            (byPos[a.pos] = byPos[a.pos] || []).push(tok);
        });

        const rows: number[][] = [];
        for (let i = 0; i < track.length; i += track.rowWidth) {
            const row = [];
            for (let j = i; j < Math.min(i + track.rowWidth, track.length); j++) row.push(j);
            rows.push(row);
        }

        const spaceIcon = (idx: number) => {
            const sp = track.spaces[idx];
            if (idx === 0) return START_ICON;
            if (!sp) return null;
            if (sp.type === 'star') return STAR_ICON;
            if (sp.type === 'arrow') return ARROW_ICON;
            if (sp.type === 'trip') return TRIP_ICON;
            return null;
        };

        const lastRow = rows.length - 1;
        return (
            <div className="ma-track" ref={this.trackRef}>
                {rows.map((row, ri) => {
                    const rev = ri % 2 === 1;
                    // even lanes run left→right and turn on the right; odd lanes are
                    // reversed and turn on the left — a snaking asphalt ribbon.
                    const bendSide = ri % 2 === 0 ? 'right' : 'left';
                    return (
                        <React.Fragment key={ri}>
                            <div className={`ma-lane ${rev ? 'rev' : ''}`}>
                                {row.map(idx => {
                                    const here = byPos[idx] || [];
                                    const glyph = spaceIcon(idx);
                                    const isCorner = track.cornerIndices.indexOf(idx) >= 0;
                                    return (
                                        <div className={`ma-cell ${isCorner ? 'corner' : ''} ${idx === 0 ? 'start' : ''} ${idx === track.length - 1 ? 'last' : ''}`} key={idx} data-cell={idx}>
                                            <span className="cell-idx">{idx === 0 ? 'GO' : idx}</span>
                                            {glyph && <span className="cell-glyph"><ExpressiveIcon icon={glyph} palette={ATH_PALETTE} /></span>}
                                            {here.length > 0 && (
                                                <div className="cell-racers">
                                                    {here.map(r => (
                                                        <RacerCoin key={r.ownerId} racerId={r.racerId} size={here.length > 2 ? 20 : 26}
                                                            ring={this.accent(r.ownerId)}
                                                            tripped={r.tripped}
                                                            moving={activeMover === r.ownerId}
                                                            current={!this.state.anim && this.props.status === 'Racing' && r.ownerId === this.props.currentId}
                                                            title={`${ROSTER_BY_ID[r.racerId] ? ROSTER_BY_ID[r.racerId].name : r.racerId} — ${this.name(r.ownerId)}`} />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            {ri < lastRow && <div className={`ma-bend ${bendSide}`}><span className="bend-curve" /></div>}
                        </React.Fragment>
                    );
                })}

                <div className="ma-finish-line">
                    <span className="fl-checker" />
                    <span className="fl-icon"><ExpressiveIcon icon={FINISH_ICON} palette={ATH_PALETTE} /></span>
                    <div className="fl-racers">
                        {finished.length === 0
                            ? <span className="fl-empty">Finish</span>
                            : finished.sort((a, b) => a.finishRank - b.finishRank).map(r => (
                                <span key={r.ownerId} className="fl-racer">
                                    <span className="fl-rank">{r.finishRank === 1 ? '🥇' : r.finishRank === 2 ? '🥈' : r.finishRank}</span>
                                    <RacerCoin racerId={r.racerId} size={24} ring={this.accent(r.ownerId)} />
                                </span>
                            ))}
                    </div>
                </div>
            </div>
        );
    }

    // ---- Turn dock ----
    private renderAnimDock() {
        const a = this.state.anim!;
        const racerId = this.props.racers[a.playerId] ? this.props.racers[a.playerId].racerId : '';
        const def = racerId ? ROSTER_BY_ID[racerId] : null;
        return (
            <div className="ma-dock anim">
                <div className="dock-racer">
                    {racerId && <RacerCoin racerId={racerId} size={38} ring={this.accent(a.playerId)} moving />}
                    <div className="dr-text">
                        <div className="dr-name">{this.name(a.playerId)}{def ? ` — ${def.name}` : ''}</div>
                        <div className="dr-power">{a.die ? `rolled a ${a.die} · on the move…` : 'on the move…'}</div>
                    </div>
                </div>
            </div>
        );
    }

    private renderDecision() {
        const pd = this.props.pendingDecision!;
        const mine = pd.playerId === this.me;
        const who = this.name(pd.playerId);
        return (
            <div className={`ma-decision ${mine ? 'mine' : ''}`}>
                <div className="dec-head">
                    {pd.racerId && <RacerCoin racerId={pd.racerId} size={34} ring={this.accent(pd.playerId)} />}
                    <div className="dec-prompt">
                        {mine ? '' : <span className="dec-who">{who} is deciding…</span>}
                        <span className="dec-text">{pd.prompt}</span>
                    </div>
                </div>
                {mine ? (
                    <div className="dec-options">
                        {pd.options.map(o => (
                            <button key={o.id} className="ma-primary dec-opt" onClick={() => this.props.MP.resolveDecision(o.id)}>
                                {o.label}
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="dec-waiting">Waiting for {who} to choose…</div>
                )}
            </div>
        );
    }

    private renderDock() {
        if (this.props.pendingDecision) return this.renderDecision();
        if (this.state.anim) return this.renderAnimDock();
        if (this.props.raceOver) return this.renderRaceOver();
        const cur = this.props.currentId;
        const curRacer = this.props.racers[cur];
        if (!curRacer) return null;

        if (this.amCurrent()) {
            const def = ROSTER_BY_ID[curRacer.racerId];
            return (
                <div className="ma-dock acting">
                    <div className="dock-racer">
                        <RacerCoin racerId={curRacer.racerId} size={40} ring={this.accent(cur)} />
                        <div className="dr-text">
                            <div className="dr-name">Your turn — {def ? def.name : ''}</div>
                            <div className="dr-power">{def ? def.text : ''}</div>
                        </div>
                    </div>
                    <button className="ma-roll" onClick={() => this.props.MP.rollDice()}>
                        <FontAwesomeIcon icon={this.state.autoMode !== 'off' ? 'bolt' : 'dice'} /> {this.state.autoMode !== 'off' ? 'Auto…' : 'Roll'}
                    </button>
                </div>
            );
        }
        return (
            <div className="ma-dock waiting">
                {this.badge(cur)} Waiting for <strong>{this.name(cur)}</strong> ({ROSTER_BY_ID[curRacer.racerId] ? ROSTER_BY_ID[curRacer.racerId].name : ''}) to roll…
            </div>
        );
    }

    private renderRaceOver() {
        const first = this.props.finishers[0];
        const second = this.props.finishers[1];
        return (
            <div className="ma-raceover">
                <div className="ro-title">Race {this.props.raceNo + 1} complete</div>
                <div className="ro-podium">
                    {first && <div className="ro-slot first"><span className="ro-medal">🥇</span><RacerCoin racerId={this.props.racers[first].racerId} size={40} ring={this.accent(first)} /><span className="ro-name">{this.name(first)}</span></div>}
                    {second && <div className="ro-slot second"><span className="ro-medal">🥈</span><RacerCoin racerId={this.props.racers[second].racerId} size={34} ring={this.accent(second)} /><span className="ro-name">{this.name(second)}</span></div>}
                </div>
                {this.props.isHost
                    ? <button className="ma-primary" onClick={() => this.props.MP.advanceRace()}>
                        {this.props.raceNo >= 3 ? 'See Final Standings' : 'Next Race'}
                    </button>
                    : <div className="ro-wait">Waiting for the host to continue…</div>}
            </div>
        );
    }

    // ---- Score bar ----
    private renderScoreBar() {
        const order = [...this.props.participants].sort((a, b) => (this.props.scores[b]?.total || 0) - (this.props.scores[a]?.total || 0));
        return (
            <div className="ma-scorebar">
                {order.map(id => {
                    const sc = this.props.scores[id] || { total: 0 } as PlayerScore;
                    return (
                        <span key={id} className={`sb-chip ${id === this.me ? 'me' : ''}`}>
                            {this.badge(id)}
                            <span className="sb-name">{this.name(id)}</span>
                            <span className="sb-total">{sc.total}</span>
                        </span>
                    );
                })}
            </div>
        );
    }

    // ---- Floating rolled die (prominent, on every screen, for the whole animation) ----
    private renderFloatingDie() {
        const a = this.state.anim;
        if (!a || !a.die) return null;
        return (
            <div className="ma-die-float">
                <Die value={a.die} />
                <span className="mdf-label">
                    <RacerCoin racerId={this.props.racers[a.playerId] ? this.props.racers[a.playerId].racerId : ''} size={20} ring={this.accent(a.playerId)} />
                    {this.name(a.playerId)} rolled a {a.die}
                </span>
            </div>
        );
    }

    // ---- Racers & powers roster (togglable) ----
    private renderRoster() {
        const withRacers = this.props.participants.filter(id => this.props.racers[id]);
        if (withRacers.length === 0) return null;
        const open = this.state.rosterOpen;
        const LEN = TRACKS[this.props.trackId].length;

        // Rank by progress along the track: finishers first (by place), then furthest
        // ahead, eliminated last.
        const rank = (r: RacerState) => r.eliminated ? -1 : r.finished ? (10000 - r.finishRank) : r.pos;
        const sorted = [...withRacers].sort((a, b) => rank(this.props.racers[b]) - rank(this.props.racers[a]));

        return (
            <div className="ma-roster">
                <button className="ma-roster-toggle" onClick={() => this.setState(s => ({ rosterOpen: !s.rosterOpen }))}>
                    <FontAwesomeIcon icon="users" /> Racers &amp; Powers
                    <span className="rt-caret">{open ? '▾' : '▸'}</span>
                </button>
                {open && (
                    <div className="ma-roster-list">
                        {sorted.map(id => {
                            const r = this.props.racers[id];
                            const idDef = ROSTER_BY_ID[r.racerId];
                            const powDef = ROSTER_BY_ID[r.powerId];
                            const copied = r.powerId !== r.racerId;
                            // Soft progress fill: the row is tinted in the player's colour
                            // up to the % of the track they've covered.
                            const pct = r.eliminated ? 0 : Math.round(Math.min(1, (r.finished ? LEN : r.pos) / LEN) * 100);
                            const fill = hexToRgba(this.accent(id), 0.22);
                            const rowStyle: React.CSSProperties = {
                                background: `linear-gradient(to right, ${fill} 0, ${fill} ${pct}%, transparent ${pct}%)`
                            };
                            return (
                                <div className={`ma-roster-row ${id === this.me ? 'me' : ''} ${id === this.props.currentId ? 'current' : ''} ${r.finished ? 'done' : ''} ${r.eliminated ? 'out' : ''}`} key={id} style={rowStyle}>
                                    <RacerCoin racerId={r.racerId} size={42} ring={this.accent(id)} dim={r.eliminated} />
                                    <div className="rr-info">
                                        <div className="rr-line">
                                            {this.badge(id)}
                                            <span className="rr-player">{this.name(id)}{id === this.me ? ' (you)' : ''}</span>
                                            <span className="rr-racer">{idDef ? idDef.name : r.racerId}</span>
                                            {r.finished && <span className="rr-tag">{r.finishRank === 1 ? '🥇' : r.finishRank === 2 ? '🥈' : 'done'}</span>}
                                            {r.eliminated && <span className="rr-tag out">out</span>}
                                            {!r.finished && !r.eliminated && <span className="rr-pct">{pct}%</span>}
                                        </div>
                                        <div className="rr-power">
                                            {copied && powDef && <em>as {powDef.name}: </em>}
                                            {powDef ? powDef.text : (idDef ? idDef.text : '')}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    // ---- Game over ----
    private renderGameOver() {
        const winners = this.props.finalWinners || [];
        const shared = winners.length > 1;
        const order = [...this.props.participants].sort((a, b) => (this.props.scores[b]?.total || 0) - (this.props.scores[a]?.total || 0));
        return (
            <div className="ma-gameover">
                <div className="go-crown">🏆</div>
                <div className="go-title">{shared ? 'A shared podium!' : `${this.name(winners[0])} wins the season`}</div>
                <table className="go-table">
                    <thead><tr><th>#</th><th>Player</th><th>🥇</th><th>🥈</th><th>★</th><th>Total</th></tr></thead>
                    <tbody>
                        {order.map((id, i) => {
                            const sc = this.props.scores[id] || { gold: 0, silver: 0, bronze: 0, total: 0 };
                            return (
                                <tr key={id} className={winners.indexOf(id) >= 0 ? 'win' : ''}>
                                    <td>{i === 0 ? '🏆' : i + 1}</td>
                                    <td className="go-name">{this.badge(id)} {this.name(id)}{id === this.me ? ' (you)' : ''}</td>
                                    <td>{sc.gold}</td><td>{sc.silver}</td><td>{sc.bronze}</td>
                                    <td className="go-total">{sc.total}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {this.props.isHost && (
                    <div className="go-actions">
                        <button className="ma-primary" onClick={() => this.props.MP.restartGame()}>Play Again</button>
                        <button className="ma-ghost" onClick={() => this.props.MP.backToLobby()}>Back to Lobby</button>
                    </div>
                )}
            </div>
        );
    }

    // ---- Event feed ----
    private renderFeed() {
        const evs = [...(this.props.events || [])].slice(-14).reverse();
        return (
            <div className="ma-feed">
                {evs.map(ev => (
                    <div className={`feed-row k-${ev.kind}`} key={ev.id}>
                        {ev.actor && <span className="feed-badge" style={{ background: this.accent(ev.actor) }} />}
                        <span className="feed-text">{ev.text}</span>
                    </div>
                ))}
            </div>
        );
    }

    private phaseLabel(): string {
        switch (this.props.status) {
            case 'Draft': return 'Draft';
            case 'Choose': return 'Selection';
            case 'Racing': return 'Racing';
            case 'RaceOver': return 'Race Result';
            case 'GameOver': return 'Season Over';
            default: return '';
        }
    }
    private topBar(): string {
        if (this.props.status === 'GameOver') return 'Season Over';
        if (this.props.pendingDecision && this.props.pendingDecision.playerId === this.me) return 'Your Choice';
        if (this.props.status === 'Draft') return this.props.currentDrafter === this.me ? 'Your Pick' : 'Draft';
        if (this.amCurrent()) return 'Your Turn';
        return `Race ${this.props.raceNo + 1}/4`;
    }
    private myAttention(): boolean {
        const pd = this.props.pendingDecision;
        if (pd) return pd.playerId === this.me;
        if (this.props.status === 'Draft') return this.props.currentDrafter === this.me;
        return this.amCurrent();
    }

    public render() {
        const mp = this.props.MP;
        const isOver = this.props.status === 'GameOver';

        const arena = (
            <div className="ma-arena">
                <div className="arena-topline">
                    <span className="race-pill">Race {this.props.raceNo + 1}/4 · {TRACKS[this.props.trackId].name}</span>
                    <span className="topline-right">
                        <span className="phase-pill">{this.phaseLabel()}</span>
                        <span className={`ma-auto-group ${this.state.autoMode !== 'off' ? 'active' : ''}`}
                            title="Auto: Off = manual · Dice = auto-roll but you make power choices · Full = fully automatic">
                            <span className="mag-label"><FontAwesomeIcon icon="bolt" /> Auto</span>
                            {(['off', 'dice', 'full'] as AutoMode[]).map(m => (
                                <button key={m} className={`mag-seg ${this.state.autoMode === m ? 'on' : ''}`} onClick={() => this.setAutoMode(m)}>
                                    {m === 'off' ? 'Off' : m === 'dice' ? 'Dice' : 'Full'}
                                </button>
                            ))}
                        </span>
                    </span>
                </div>

                {this.renderScoreBar()}

                {isOver ? this.renderGameOver()
                    : this.props.status === 'Draft' ? this.renderDraft()
                        : this.props.status === 'Choose' ? this.renderChoose() : (
                            <React.Fragment>
                                {this.renderTrack()}
                                {this.renderDock()}
                                {this.renderRoster()}
                                {this.renderFeed()}
                            </React.Fragment>
                        )}

                {this.renderFloatingDie()}
            </div>
        );

        const stable = (
            <div className="ma-stable">
                <div className="section-label">Your Stable</div>
                {this.props.myHand.map(id => <RacerCard key={id} racerId={id} />)}
                {this.props.myUsed.map(id => <RacerCard key={id} racerId={id} used />)}
                {(this.props.myHand.length + this.props.myUsed.length) === 0 &&
                    <div className="ma-empty">Your stable appears once the meet begins.</div>}
            </div>
        );

        const links: any = {
            'home': { 'icon': 'flag', 'label': 'Track', 'view': arena },
            'stable': { 'icon': 'paw', 'label': 'Stable', 'view': stable },
            'rules': { 'icon': 'book', 'label': 'Rules', 'view': <MagicalAthletesRulesView /> }
        };

        if (this.props.isHost) {
            links['settings'] = {
                'icon': 'cog', 'label': 'Settings',
                'view': (
                    <div className="ma-settings">
                        <button className="ma-primary" onClick={() => mp.restartGame()}>Restart Game</button>
                        <button className="ma-ghost" onClick={() => mp.backToLobby()}>Back to Lobby</button>
                    </div>
                )
            };
        }

        return mp.getPluginView('gameshell', 'HostShell-Main', {
            'links': links,
            'gameName': 'Magical Athletes',
            'topBarContent': this.topBar(),
            'roomClassName': this.myAttention() ? 'attention-bg' : ''
        });
    }
}
