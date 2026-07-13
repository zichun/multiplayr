/**
 * TrioViews.tsx - React components for "Trio".
 */

import * as React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ViewPropsInterface } from '../../../common/interfaces';
import { icons as LOBBY_ICONS } from '../../lobby/LobbyView';
import {
    Phase, GameMode, RevealedCard, TurnOutcome, LastMove, HandEnd,
    CONNECTED_NUMBERS, getSetupConfig
} from '../TrioGameState';
import { PlayingCard } from '../../../client/lib/card-renderer/PlayingCard';
import { ExpressiveIcon } from '../../../client/lib/card-renderer/IconEngine';
import {
    TRIO_ICONS,
    getTrioCardDefinition,
    getTrioCardStyle,
    trioColorHex,
    trioInkHex
} from '../TrioAssets';
import RevealSound from '../../../sounds/softnotification.mp3';
import TrioSound from '../../../sounds/coin_many.mp3';
import MismatchSound from '../../../sounds/scratch.mp3';
import WinSound from '../../../sounds/connected.mp3';

// Fire-and-forget SFX. Guarded for non-browser (test) contexts, and swallows the
// autoplay-policy rejection until the first user interaction.
function playSound(src: string) {
    if (typeof Audio === 'undefined' || !src) return;
    try {
        const audio = new Audio(src);
        const p = audio.play();
        if (p && typeof p.catch === 'function') p.catch(() => { /* blocked until interaction */ });
    } catch (e) { /* ignore */ }
}

interface PublicPlayer {
    handCount: number;
    trios: number[];
}

interface MiddleSlotView {
    faceUp: boolean;
    empty: boolean;
    card: number | null;
}

interface AvailableReveals {
    hands: Record<string, { low: boolean; high: boolean; count: number }>;
    middleSlots: number[];
}

interface TrioProps extends ViewPropsInterface {
    gameStatus: Phase;
    mode: GameMode;
    numPlayers: number;
    playerOrder: string[];
    currentPlayerId: string;
    targetNumber: number | null;
    currentReveals: RevealedCard[];
    lastOutcome: TurnOutcome | null;
    resolvingMismatch: {
        reveals: RevealedCard[];
        number: number;
        playerId: string;
        resolveId: number;
    } | null;
    middle: MiddleSlotView[];
    publicPlayers: Record<string, PublicPlayer>;
    availableReveals: AvailableReveals;
    winnerId: string | null;
    winningTrios: number[] | null;
    winReason: 'seven' | 'count' | 'connected' | 'exhausted' | null;
    lastMove: LastMove | null;
    playerNames: Record<string, string>;
    playerAccents: Record<string, string>;
    playerIcons: Record<string, number>;
    isHost: boolean;
    myHand: number[];
}

// ---- shared small vector helpers -------------------------------------------------

// A small flat trio glyph (three dots) in a number's colour.
function trioChip(number: number, size = '1.3em') {
    const style = getTrioCardStyle(number);
    const palette = { ...getTrioCardDefinition(number).palette as any, primary: style.ink };
    return (
        <span className="trio-chip" style={{ width: size, height: size }}>
            <ExpressiveIcon icon={TRIO_ICONS.trio_solid} palette={palette} />
        </span>
    );
}

// A collected-trio pill: a rounded chip carrying the number in its colour.
function trioPill(number: number, opts: { win?: boolean } = {}) {
    return (
        <span
            className={`trio-pill ${opts.win ? 'win' : ''} ${number === 7 ? 'seven' : ''}`}
            style={{ background: trioColorHex(number), color: trioInkHex(number) }}
            title={number === 7 ? '7 — instant win' : `${number} trio`}
        >
            {number}
        </span>
    );
}

// A two-sided card whose flip is driven directly by the `flipped` prop (used for
// the frozen mismatch tape, where the flip-back timing is a parent-run stage).
function staticCard(number: number, flipped: boolean, width = 52) {
    return (
        <div className="trio-card">
            <PlayingCard
                card={getTrioCardDefinition(number, true)}
                customIcons={TRIO_ICONS}
                width={width}
                isFlipped={flipped}
            />
        </div>
    );
}

// A revealed card that flips face-up on mount (the "peek" animation).
class FlipInCard extends React.Component<{ number: number; width?: number }, { flipped: boolean }> {
    private t?: ReturnType<typeof setTimeout>;
    constructor(props: { number: number; width?: number }) {
        super(props);
        this.state = { flipped: true };
    }
    public componentDidMount() {
        this.t = setTimeout(() => this.setState({ flipped: false }), 60);
    }
    public componentWillUnmount() {
        if (this.t) clearTimeout(this.t);
    }
    public render() {
        return (
            <div className="trio-card">
                <PlayingCard
                    card={getTrioCardDefinition(this.props.number, true)}
                    customIcons={TRIO_ICONS}
                    width={this.props.width || 52}
                    isFlipped={this.state.flipped}
                />
            </div>
        );
    }
}

// A single middle slot. Face-down cards show the uniform back and flip in place
// when revealed, preserving positional memory. Empty slots leave a gap.
class MiddleCard extends React.Component<{
    card: number | null;
    ghost?: number;
    faceUp: boolean;
    empty: boolean;
    clickable: boolean;
    forceFlipped?: boolean;   // parent-driven flip-back during the mismatch stage
    onFlip: () => void;
}> {
    public render() {
        if (this.props.empty) {
            return <div className="trio-middle-slot empty" />;
        }
        // Front number: the live value while face-up, or the just-returned value
        // (`ghost`, from the mismatch snapshot) so the flip-BACK shows the real
        // number instead of a placeholder. Otherwise a placeholder that never
        // becomes visible behind the uniform back.
        const num = this.props.card ?? this.props.ghost ?? 1;
        // `forceFlipped` lets the mismatch animation turn an opened card back down
        // while its value is still in props (during the frozen resolution window).
        const flipped = this.props.forceFlipped ? true : !this.props.faceUp;
        const showsUp = this.props.faceUp && !this.props.forceFlipped;
        const cls = `trio-middle-slot ${this.props.clickable ? 'clickable' : ''} ${showsUp ? 'up' : ''}`;
        return (
            <div className={cls} onClick={this.props.clickable ? this.props.onFlip : undefined}>
                <div className="trio-card">
                    <PlayingCard
                        card={getTrioCardDefinition(num, true)}
                        customIcons={TRIO_ICONS}
                        width={54}
                        isFlipped={flipped}
                    />
                </div>
            </div>
        );
    }
}

// ================================================================================
// Lobby views
// ================================================================================
export class TrioHostLobby extends React.Component<ViewPropsInterface & { trioMode?: GameMode }, {}> {
    public render() {
        const mp = this.props.MP;
        const playerCount = mp.playersCount() + 1;
        const ok = playerCount >= 3 && playerCount <= 6;
        const mode = this.props.trioMode || 'simple';

        const modeToggle = (
            <div className="trio-mode-toggle">
                <div className="tmt-label">Win Mode</div>
                <div className="tmt-buttons">
                    <button
                        className={`tmt-btn ${mode === 'simple' ? 'active' : ''}`}
                        onClick={() => mp.setMode('simple')}
                    >
                        <span className="tmt-name">Simple</span>
                        <span className="tmt-desc">Collect any 3 trios</span>
                    </button>
                    <button
                        className={`tmt-btn ${mode === 'spicy' ? 'active' : ''}`}
                        onClick={() => mp.setMode('spicy')}
                    >
                        <span className="tmt-name">Spicy</span>
                        <span className="tmt-desc">2 connected trios</span>
                    </button>
                </div>
                <div className="tmt-note">The <strong>7 trio</strong> wins instantly in either mode.</div>
            </div>
        );

        const links = {
            'home': {
                'icon': 'home',
                'label': 'Lobby',
                'view': (
                    <div>
                        {mp.getPluginView('lobby', 'SetNameWithLobby')}
                        {modeToggle}
                        {!ok && (
                            <p style={{ color: '#e0554f', fontWeight: 700, textAlign: 'center', marginTop: 20 }}>
                                Trio needs 3 to 6 players. Currently {playerCount}.
                            </p>
                        )}
                    </div>
                )
            },
            'clients': {
                'icon': 'users',
                'label': 'Players',
                'view': mp.getPluginView('lobby', 'host-roommanagement')
            },
            'rules': {
                'icon': 'book',
                'label': 'Rules',
                'view': <TrioRulesView mode={mode} />
            }
        };

        return mp.getPluginView('gameshell', 'HostShell-Main', {
            'gameName': 'Trio',
            'links': links
        });
    }
}

export class TrioClientLobby extends React.Component<ViewPropsInterface & { trioMode?: GameMode }, {}> {
    public render() {
        const mp = this.props.MP;
        const mode = this.props.trioMode || 'simple';
        const links = {
            'home': {
                'icon': 'id-card',
                'label': 'Lobby',
                'view': (
                    <div>
                        {mp.getPluginView('lobby', 'SetNameWithLobby')}
                        <div className="trio-waiting">
                            Mode: <strong>{mode === 'spicy' ? 'Spicy' : 'Simple'}</strong> · Waiting for the host to start…
                        </div>
                    </div>
                )
            },
            'rules': {
                'icon': 'book',
                'label': 'Rules',
                'view': <TrioRulesView mode={mode} />
            }
        };
        return mp.getPluginView('gameshell', 'HostShell-Main', {
            'gameName': 'Trio',
            'links': links
        });
    }
}

// ================================================================================
// Rules reference
// ================================================================================
export class TrioRulesView extends React.Component<{ mode?: GameMode; numPlayers?: number }, {}> {
    private renderSetup() {
        const current = this.props.numPlayers;
        const rows = [3, 4, 5, 6].map(n => {
            const cfg = getSetupConfig(n);
            return { n, dealt: cfg.dealt, middle: cfg.middle };
        });
        return (
            <div className="rules-section">
                <h3>Setup by Players</h3>
                <div className="setup-table-wrap">
                    <table className="setup-table">
                        <thead>
                            <tr><th>Players</th><th>Cards each</th><th>Middle</th></tr>
                        </thead>
                        <tbody>
                            {rows.map(r => (
                                <tr key={r.n} className={current === r.n ? 'setup-current' : ''}>
                                    <td>{r.n}{current === r.n ? ' ◂' : ''}</td>
                                    <td>{r.dealt}</td>
                                    <td>{r.middle}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <p className="setup-note">
                    36 cards: numbers 1–12, three copies each. Deal per the table, the rest go
                    face-down in the middle. Hands are sorted low→high automatically.
                </p>
            </div>
        );
    }

    private renderConnections() {
        // Show the ring adjacency used by Spicy mode.
        return (
            <div className="rules-section">
                <h3>Connected Numbers (Spicy)</h3>
                <p style={{ marginTop: 0 }}>
                    Each number is connected to its two neighbours around the ring 1–12 (with
                    12 wrapping back to 1). Win by collecting <strong>two connected trios</strong>.
                </p>
                <div className="conn-list">
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                        <div className="conn-row" key={n}>
                            {trioPill(n)}
                            <span className="conn-arrow">↔</span>
                            {CONNECTED_NUMBERS[n].map(m => (
                                <React.Fragment key={m}>{trioPill(m)}</React.Fragment>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    public render() {
        const mode = this.props.mode || 'simple';
        return (
            <div className="trio-rules-panel">
                <div className="rules-section">
                    <h3>The Idea</h3>
                    <p>
                        A game of memory and deduction. On your turn you <strong>reveal cards one
                        at a time</strong> — you cannot stop early — until you either fail to
                        match or complete a set of three.
                    </p>
                </div>

                {this.renderSetup()}

                <div className="rules-section">
                    <h3>Revealing</h3>
                    <ul>
                        <li>Reveal the <strong>lowest or highest</strong> card from any player's hand (including your own).</li>
                        <li>Or flip <strong>any face-down card</strong> from the middle.</li>
                        <li>The <strong>first reveal</strong> sets the target number — no match needed.</li>
                        <li>Keep revealing the same number. Cards stay face-up and public.</li>
                    </ul>
                </div>

                <div className="rules-section">
                    <h3>Outcomes</h3>
                    <ul>
                        <li><strong>Mismatch:</strong> a revealed number differs from the target →
                            every card this turn returns face-down to where it came from. Turn ends.</li>
                        <li><strong>Trio:</strong> reveal the third matching card → take all three as a
                            scored trio. Turn ends.</li>
                        <li>Returned cards are hidden again — <strong>memory is everything</strong>.</li>
                    </ul>
                </div>

                <div className={`rules-section ${mode === 'simple' ? 'mode-active' : ''}`}>
                    <h3>Win — Simple</h3>
                    <p>Collect any <strong>3 trios</strong>.</p>
                </div>

                <div className={`rules-section ${mode === 'spicy' ? 'mode-active' : ''}`}>
                    <h3>Win — Spicy</h3>
                    <p>Collect <strong>2 connected trios</strong> (see below).</p>
                </div>

                <div className="rules-section highlight">
                    <h3>The 7 Trio</h3>
                    <p>Completing the <strong>7 trio</strong> wins the game instantly, in either mode.</p>
                </div>

                {this.renderConnections()}
            </div>
        );
    }
}

// ================================================================================
// Main page
// ================================================================================
type ResolveStage = 'hold' | 'flip' | 'fade';

interface MainState {
    resolveStage: ResolveStage | null;
    resolveKey: number | null; // resolveId of the mismatch currently animating
}

// Mismatch animation timeline (ms from the mismatch). Cards stay face-up to
// memorise, then flip back (the card-renderer flip is 0.6s), then the tape fades.
const MM_FLIP = 3000;    // after the memorise pause, flip everything back
const MM_FADE = 3650;    // fade the "This turn" cards away
const MM_FINISH = 4200;  // host returns the cards and advances the turn

export class TrioMainPage extends React.Component<TrioProps, MainState> {
    private resolveTimers: ReturnType<typeof setTimeout>[] = [];
    private finishScheduledKey: number | null = null;

    constructor(props: TrioProps) {
        super(props);
        this.state = { resolveStage: null, resolveKey: null };
    }

    public componentDidMount() {
        if (this.props.resolvingMismatch) this.startMismatchAnimation();
    }

    public componentDidUpdate(prev: TrioProps) {
        const lm = this.props.lastMove;
        const prevId = prev.lastMove ? prev.lastMove.moveId : null;
        if (lm && lm.moveId !== prevId) {
            switch (lm.kind) {
                case 'reveal': playSound(RevealSound); break;
                case 'trio': playSound(TrioSound); break;
                case 'mismatch': playSound(MismatchSound); break;
                case 'win': playSound(WinSound); break;
                default: break;
            }
        }

        const rm = this.props.resolvingMismatch;
        if (rm && rm.resolveId !== this.state.resolveKey) {
            // A new mismatch just froze — start the memorise → flip → fade timeline.
            this.startMismatchAnimation();
        } else if (!rm && this.state.resolveStage !== null) {
            // Resolution finished (state advanced) — reset the local animation.
            this.clearResolveTimers();
            this.setState({ resolveStage: null, resolveKey: null });
        }
    }

    public componentWillUnmount() {
        this.clearResolveTimers();
    }

    private clearResolveTimers() {
        this.resolveTimers.forEach(t => clearTimeout(t));
        this.resolveTimers = [];
    }

    private startMismatchAnimation() {
        const rm = this.props.resolvingMismatch;
        if (!rm) return;
        this.clearResolveTimers();
        this.setState({ resolveStage: 'hold', resolveKey: rm.resolveId });

        this.resolveTimers.push(setTimeout(() => this.setState({ resolveStage: 'flip' }), MM_FLIP));
        this.resolveTimers.push(setTimeout(() => this.setState({ resolveStage: 'fade' }), MM_FADE));

        // The host alone advances the game once the animation has played out.
        if (this.props.isHost && this.finishScheduledKey !== rm.resolveId) {
            this.finishScheduledKey = rm.resolveId;
            this.resolveTimers.push(setTimeout(() => this.props.MP.finishMismatch(), MM_FINISH));
        }
    }

    private name(id: string) {
        return this.props.playerNames[id] || 'Player';
    }
    private accent(id: string) {
        return this.props.playerAccents[id] || '#7c8aa5';
    }

    private badge(id: string, className = 'pp-dot') {
        const iconName = LOBBY_ICONS[this.props.playerIcons[id] ?? 0] || 'circle';
        return (
            <span className={className}>
                <FontAwesomeIcon icon={iconName} style={{ color: this.accent(id) }} />
            </span>
        );
    }

    private amActive(): boolean {
        return this.props.currentPlayerId === this.props.MP.clientId &&
            this.props.gameStatus === Phase.Play &&
            !this.props.winnerId;
    }

    // ---- interactions ----
    private revealHand(fromPlayerId: string, end: HandEnd) {
        if (!this.amActive()) return;
        this.props.MP.revealHand(fromPlayerId, end);
    }
    private revealMiddle(slotIndex: number) {
        if (!this.amActive()) return;
        this.props.MP.revealMiddle(slotIndex);
    }

    // ---- reveal tape (the current / just-resolved sequence) ----
    // Top strip of a reveal card: the owner's coloured lobby icon + name (hand
    // reveals only). Middle reveals reserve the strip but render nothing, so every
    // card face stays aligned.
    private revealTop(rev: RevealedCard): React.ReactNode {
        if (rev.source === 'middle') return <div className="rt-top" />;
        const pid = rev.playerId || '';
        return (
            <div className="rt-top">
                {this.badge(pid, 'rt-src-icon')}
                <span className="rt-src-name">{this.name(pid)}</span>
            </div>
        );
    }

    // Bottom strip: which end (low / high) the card came from (hand reveals only).
    private revealBottom(rev: RevealedCard): React.ReactNode {
        if (rev.source === 'middle') return <div className="rt-bottom" />;
        return (
            <div className="rt-bottom">
                <span className="rt-src-end">{rev.end === 'low' ? 'low' : 'high'}</span>
            </div>
        );
    }

    // The frozen mismatch: cards held face-up to memorise, then flipped back, then
    // faded. Timing is driven by the parent stage machine (resolveStage).
    private renderMismatchTape() {
        const rm = this.props.resolvingMismatch!;
        const stage = this.state.resolveStage;
        const flipped = stage === 'flip' || stage === 'fade';
        const fading = stage === 'fade';

        return (
            <div className={`reveal-tape outcome-mismatch ${fading ? 'fading' : ''}`}>
                <div className="rt-head">
                    <span className="rt-target">Target {trioPill(rm.number)}</span>
                    <span className="rt-progress">No match</span>
                </div>
                <div className="rt-cards">
                    {rm.reveals.map((rev, i) => (
                        <div className="rt-card" key={`${i}-${rev.source}-${rev.slotIndex ?? rev.playerId}-${rev.card}`}>
                            {this.revealTop(rev)}
                            {staticCard(rev.card, flipped, 50)}
                            {this.revealBottom(rev)}
                        </div>
                    ))}
                </div>
                <div className="rt-banner mismatch">
                    {stage === 'hold'
                        ? 'No match — memorise these! Returning face-down…'
                        : 'No match — cards returned face-down'}
                </div>
            </div>
        );
    }

    private renderRevealTape() {
        const { currentReveals, lastOutcome, targetNumber, currentPlayerId } = this.props;

        if (this.props.resolvingMismatch) {
            return this.renderMismatchTape();
        }

        const live = currentReveals.length > 0;
        const reveals = live ? currentReveals : (lastOutcome ? lastOutcome.reveals : []);
        const target = live ? targetNumber : (lastOutcome ? lastOutcome.number : null);

        if (reveals.length === 0) {
            const active = this.amActive();
            return (
                <div className="reveal-tape idle">
                    <div className="rt-prompt">
                        {active
                            ? 'Your turn — reveal a card to begin.'
                            : `Waiting for ${this.name(currentPlayerId)} to reveal…`}
                    </div>
                </div>
            );
        }

        const matched = live
            ? reveals.length
            : (lastOutcome && lastOutcome.kind === 'trio' ? 3 : reveals.length - 1);

        const outcomeCls = !live && lastOutcome
            ? (lastOutcome.kind === 'trio' ? 'outcome-trio' : 'outcome-mismatch')
            : '';

        return (
            <div className={`reveal-tape ${outcomeCls}`}>
                <div className="rt-head">
                    <span className="rt-target">
                        Target {target !== null ? trioPill(target) : '—'}
                    </span>
                    <span className="rt-progress">{Math.min(matched, 3)} / 3 matched</span>
                </div>
                <div className="rt-cards">
                    {reveals.map((rev, i) => {
                        const isMismatch = !live && lastOutcome && lastOutcome.kind === 'mismatch'
                            && i === reveals.length - 1 && rev.card !== lastOutcome.number;
                        return (
                            <div className={`rt-card ${isMismatch ? 'bad' : ''}`}
                                key={`${i}-${rev.source}-${rev.slotIndex ?? rev.playerId}-${rev.card}`}>
                                {this.revealTop(rev)}
                                <FlipInCard number={rev.card} width={50} />
                                {this.revealBottom(rev)}
                            </div>
                        );
                    })}
                </div>
                {!live && lastOutcome && (
                    <div className={`rt-banner ${lastOutcome.kind}`}>
                        {lastOutcome.kind === 'trio'
                            ? `TRIO! ${this.name(lastOutcome.playerId)} takes the ${lastOutcome.number}s`
                            : 'No match — cards returned face-down'}
                    </div>
                )}
            </div>
        );
    }

    // The middle is laid out as a fixed grid so each card keeps a stable
    // position for the whole game (positional memory matters): 9 → 3×3,
    // 8 → 2×4, 6 → 2×3.
    private middleColumns(n: number): number {
        if (n === 9) return 3;
        if (n === 8) return 4;
        if (n === 6) return 3;
        return Math.max(1, Math.ceil(Math.sqrt(n)));
    }

    // ---- middle grid ----
    private renderMiddle() {
        const { middle, lastOutcome, resolvingMismatch } = this.props;
        const active = this.amActive();
        if (middle.length === 0) {
            return <div className="trio-middle empty-note">No middle cards in this game.</div>;
        }

        // While a just-resolved sequence is on screen, remember which slot held
        // which number so returned cards flip back showing their real value.
        const ghost: Record<number, number> = {};
        if (lastOutcome) {
            for (const r of lastOutcome.reveals) {
                if (r.source === 'middle' && r.slotIndex !== undefined) ghost[r.slotIndex] = r.card;
            }
        }

        // Middle cards opened during the frozen mismatch flip back at the flip stage.
        const mismatchSlots = new Set<number>();
        if (resolvingMismatch) {
            for (const r of resolvingMismatch.reveals) {
                if (r.source === 'middle' && r.slotIndex !== undefined) mismatchSlots.add(r.slotIndex);
            }
        }
        const stage = this.state.resolveStage;
        const flipBack = !!resolvingMismatch && (stage === 'flip' || stage === 'fade');

        const cols = this.middleColumns(middle.length);
        return (
            <div className="trio-middle" style={{ gridTemplateColumns: `repeat(${cols}, 54px)` }}>
                {middle.map((slot, i) => (
                    <MiddleCard
                        key={i}
                        card={slot.card}
                        ghost={ghost[i]}
                        faceUp={slot.faceUp}
                        empty={slot.empty}
                        clickable={active && !slot.faceUp && !slot.empty}
                        forceFlipped={flipBack && mismatchSlots.has(i)}
                        onFlip={() => this.revealMiddle(i)}
                    />
                ))}
            </div>
        );
    }

    // ---- player panels (also the hand-reveal action source) ----
    private renderPlayers() {
        const { playerOrder, publicPlayers, currentPlayerId, availableReveals, winningTrios } = this.props;
        const active = this.amActive();
        const winSet = new Set(winningTrios || []);

        return (
            <div className="player-panels">
                {playerOrder.map(id => {
                    const p = publicPlayers[id];
                    if (!p) return null;
                    const isCurrent = id === currentPlayerId && this.props.gameStatus === Phase.Play;
                    const hand = availableReveals.hands[id] || { low: false, high: false, count: p.handCount };
                    const isMe = id === this.props.MP.clientId;

                    return (
                        <div className={`player-panel ${isCurrent ? 'current' : ''} ${isMe ? 'me' : ''}`} key={id}>
                            <div className="pp-head">
                                {this.badge(id)}
                                <span className="pp-name">{this.name(id)}{isMe ? ' (you)' : ''}</span>
                                {isCurrent && <span className="pp-badge">turn</span>}
                            </div>
                            <div className="pp-stats">
                                <span className="pp-stat" title="Cards in hand">🂠 {p.handCount}</span>
                                <span className="pp-stat" title="Trios collected">▲ {p.trios.length}</span>
                            </div>

                            {p.trios.length > 0 && (
                                <div className="pp-trios">
                                    {[...p.trios].sort((a, b) => a - b).map((n, k) => (
                                        <React.Fragment key={k}>
                                            {trioPill(n, { win: winSet.has(n) })}
                                        </React.Fragment>
                                    ))}
                                </div>
                            )}

                            {active && (
                                <div className="pp-actions">
                                    <button
                                        className="reveal-btn"
                                        disabled={!hand.low}
                                        onClick={() => this.revealHand(id, 'low')}
                                    >
                                        Lowest
                                    </button>
                                    <button
                                        className="reveal-btn"
                                        disabled={!hand.high}
                                        onClick={() => this.revealHand(id, 'high')}
                                    >
                                        Highest
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    }

    // ---- your own hand (private, always sorted low->high) ----
    private renderMyHand() {
        const { myHand } = this.props;
        if (!myHand || myHand.length === 0) {
            return <div className="trio-hand empty-note">Your hand is empty — you still take turns using the middle and opponents.</div>;
        }
        const lastIdx = myHand.length - 1;
        return (
            <div className="trio-hand">
                {myHand.map((num, idx) => {
                    const end = idx === 0 ? 'low' : (idx === lastIdx ? 'high' : '');
                    return (
                        <div className={`hand-card ${end ? 'end ' + end : ''}`} key={idx}>
                            <div className="trio-card">
                                <PlayingCard
                                    card={getTrioCardDefinition(num, false)}
                                    customIcons={TRIO_ICONS}
                                    width={54}
                                />
                            </div>
                            {end && <div className="hand-end-tag">{end === 'low' ? 'LOW' : 'HIGH'}</div>}
                        </div>
                    );
                })}
            </div>
        );
    }

    private renderGameOver() {
        const { playerOrder, publicPlayers, winnerId, winningTrios, winReason, isHost } = this.props;
        const sorted = [...playerOrder].sort((a, b) => publicPlayers[b].trios.length - publicPlayers[a].trios.length);
        const reasonText = (() => {
            switch (winReason) {
                case 'seven': return 'completed the 7 trio — instant win!';
                case 'connected': return `collected two connected trios (${(winningTrios || []).join(' & ')})`;
                case 'count': return 'collected 3 trios';
                case 'exhausted': return 'had the most trios when the cards ran out';
                default: return 'won the game';
            }
        })();

        return (
            <div className="game-over">
                <div className="go-mark">
                    <ExpressiveIcon icon={TRIO_ICONS.trio_solid} palette={getTrioCardDefinition(winningTrios && winningTrios[0] ? winningTrios[0] : 5).palette as any} />
                </div>
                <div className="go-title">{winnerId ? `${this.name(winnerId)} wins!` : 'Game Over'}</div>
                <div className="go-reason">{this.name(winnerId || '')} {reasonText}</div>

                {winningTrios && winningTrios.length > 0 && (
                    <div className="go-wintrios">
                        {winningTrios.map((n, k) => <React.Fragment key={k}>{trioPill(n, { win: true })}</React.Fragment>)}
                    </div>
                )}

                <table className="re-table">
                    <thead><tr><th>#</th><th>Player</th><th>Trios</th></tr></thead>
                    <tbody>
                        {sorted.map((id, i) => (
                            <tr key={id} className={id === winnerId ? 'winner-row' : ''}>
                                <td>{i === 0 ? '🏆' : i + 1}</td>
                                <td>{this.badge(id)} {this.name(id)}</td>
                                <td>
                                    <div className="row-trios">
                                        {[...publicPlayers[id].trios].sort((a, b) => a - b).map((n, k) =>
                                            <React.Fragment key={k}>{trioPill(n)}</React.Fragment>)}
                                        {publicPlayers[id].trios.length === 0 && <span className="none">—</span>}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {isHost && (
                    <div className="go-actions">
                        <button className="primary-btn" onClick={() => this.props.MP.restartGame()}>Play Again</button>
                        <button className="ghost-btn" onClick={() => this.props.MP.backToLobby()}>Back to Lobby</button>
                    </div>
                )}
            </div>
        );
    }

    public render() {
        const mp = this.props.MP;
        const { gameStatus, mode, currentPlayerId } = this.props;
        const over = gameStatus === Phase.GameOver || !!this.props.winnerId;

        const arena = (
            <div className="trio-arena">
                <div className="arena-topline">
                    <span className={`mode-pill ${mode}`}>{mode === 'spicy' ? 'Spicy' : 'Simple'}</span>
                    <span className="turn-pill">
                        {over
                            ? 'Game Over'
                            : (this.amActive() ? 'Your Turn' : `${this.name(currentPlayerId)}'s turn`)}
                    </span>
                </div>

                {over ? this.renderGameOver() : (
                    <React.Fragment>
                        <div className="section-label">This Turn</div>
                        {this.renderRevealTape()}

                        <div className="section-label">Middle</div>
                        {this.renderMiddle()}

                        <div className="section-label">Players</div>
                        {this.renderPlayers()}

                        <div className="section-label">Your Hand</div>
                        {this.renderMyHand()}
                    </React.Fragment>
                )}
            </div>
        );

        const links: any = {
            'home': {
                'icon': 'gamepad',
                'label': 'Arena',
                'view': arena
            },
            'rules': {
                'icon': 'book',
                'label': 'Rules',
                'view': <TrioRulesView mode={mode} numPlayers={this.props.numPlayers} />
            }
        };

        if (this.props.isHost) {
            links['settings'] = {
                'icon': 'cogs',
                'label': 'Settings',
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
            'gameName': 'Trio',
            'topBarContent': this.topBar(),
            'roomClassName': this.amActive() ? 'attention-bg' : ''
        });
    }

    private topBar(): string {
        const { gameStatus, currentPlayerId } = this.props;
        if (gameStatus === Phase.GameOver || this.props.winnerId) {
            return this.props.winnerId === this.props.MP.clientId ? 'Victory' : 'Game Over';
        }
        if (this.amActive()) return 'Your Turn';
        return `${this.name(currentPlayerId)}'s turn`;
    }
}
