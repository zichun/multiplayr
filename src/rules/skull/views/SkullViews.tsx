/**
 * SkullViews.tsx - React components for "Skull".
 *
 * All game state is pushed down from the host; clients are stateless except for
 * ephemeral UI (the pending bid value, animation scheduling). Hidden information
 * is enforced upstream in skull.tsx — these views only ever receive counts for
 * opponents, plus the client's own private disc contents.
 */

import * as React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ViewPropsInterface } from '../../../common/interfaces';
import { icons as LOBBY_ICONS } from '../../lobby/LobbyView';
import { Phase, DiscKind, Bid, RevealEntry, Resolution, LastMove } from '../SkullGameState';
import { ExpressiveIcon } from '../../../client/lib/card-renderer/IconEngine';
import {
    SKULL_ICONS,
    FLOWER_PALETTE,
    SKULL_PALETTE,
    backPalette
} from '../SkullAssets';

import PlaceSound from '../../../sounds/softnotification.mp3';
import BidSound from '../../../sounds/coin_few.mp3';
import FlowerSound from '../../../sounds/coin_many.mp3';
import SkullSound from '../../../sounds/sword-swing.mp3';
import WinSound from '../../../sounds/connected.mp3';

// Fire-and-forget SFX. Guarded for non-browser (test) contexts.
function playSound(src: string) {
    if (typeof Audio === 'undefined' || !src) return;
    try {
        const audio = new Audio(src);
        const p = audio.play();
        if (p && typeof p.catch === 'function') p.catch(() => { /* blocked until interaction */ });
    } catch (e) { /* ignore */ }
}

interface PublicPlayer {
    wins: number;
    eliminated: boolean;
    passed: boolean;
    placedInitial: boolean;
    ownedTotal: number;
    stackCount: number;
    handCount: number;
    revealed: number;
    revealedKinds: DiscKind[];
}

interface SkullProps extends ViewPropsInterface {
    gameStatus: Phase;
    round: number;
    playerOrder: string[];
    currentPlayerId: string;
    roundStarterId: string;
    bid: Bid | null;
    bidOpen: boolean;
    discsOnTable: number;
    challengerId: string;
    bidTarget: number;
    flowersRevealed: number;
    revealSequence: RevealEntry[];
    resolution: Resolution | null;
    winnerId: string | null;
    lastMove: LastMove | null;
    publicPlayers: Record<string, PublicPlayer>;
    flippable: string[];
    playerNames: Record<string, string>;
    playerAccents: Record<string, string>;
    playerIcons: Record<string, number>;
    isHost: boolean;
    myOwnedFlowers: number;
    myOwnedSkulls: number;
    myHandFlowers: number;
    myHandSkulls: number;
    myStack: DiscKind[];
}

// ---- shared disc primitives -----------------------------------------------------

// A round disc token with a 3D flip. `revealed` shows the glyph face; otherwise
// the uniform accent-coloured back.
function Disc(props: {
    revealed: boolean;
    kind: DiscKind | 'hidden';
    accent: string;
    size: number;
    clickable?: boolean;
    onClick?: () => void;
}) {
    const glyphIcon = props.kind === 'skull' ? SKULL_ICONS.disc_skull : SKULL_ICONS.disc_flower;
    const glyphPal = props.kind === 'skull' ? SKULL_PALETTE : FLOWER_PALETTE;
    return (
        <div
            className={`disc ${props.revealed ? 'is-up' : ''} ${props.clickable ? 'clickable' : ''}`}
            style={{ width: props.size, height: props.size }}
            onClick={props.clickable ? props.onClick : undefined}
        >
            <div className="disc-flip">
                <div className="disc-face disc-back">
                    <ExpressiveIcon icon={SKULL_ICONS.disc_back} palette={backPalette(props.accent)} />
                </div>
                <div className="disc-face disc-front">
                    <ExpressiveIcon icon={glyphIcon} palette={glyphPal} />
                </div>
            </div>
        </div>
    );
}

// A small static (non-flipping) disc glyph, for hands, legends and buttons.
function DiscGlyph(props: { kind: DiscKind; size: number }) {
    const icon = props.kind === 'skull' ? SKULL_ICONS.disc_skull : SKULL_ICONS.disc_flower;
    const pal = props.kind === 'skull' ? SKULL_PALETTE : FLOWER_PALETTE;
    return (
        <span className="disc-pip" style={{ width: props.size, height: props.size }}>
            <ExpressiveIcon icon={icon} palette={pal} />
        </span>
    );
}

// ================================================================================
// Lobby views
// ================================================================================
export class SkullHostLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;
        const playerCount = mp.playersCount() + 1;
        const ok = playerCount >= 3 && playerCount <= 6;

        const links = {
            'home': {
                'icon': 'home',
                'label': 'Lobby',
                'view': (
                    <div>
                        {mp.getPluginView('lobby', 'SetNameWithLobby')}
                        {!ok && (
                            <p style={{ color: '#e0554f', fontWeight: 700, textAlign: 'center', marginTop: 20 }}>
                                Skull needs 3 to 6 players. Currently {playerCount}.
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
                'view': <SkullRulesView />
            }
        };

        return mp.getPluginView('gameshell', 'HostShell-Main', {
            'gameName': 'Skull',
            'links': links
        });
    }
}

export class SkullClientLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;
        const links = {
            'home': {
                'icon': 'id-card',
                'label': 'Lobby',
                'view': (
                    <div>
                        {mp.getPluginView('lobby', 'SetNameWithLobby')}
                        <div className="skull-waiting">Waiting for the host to start…</div>
                    </div>
                )
            },
            'rules': {
                'icon': 'book',
                'label': 'Rules',
                'view': <SkullRulesView />
            }
        };
        return mp.getPluginView('gameshell', 'HostShell-Main', {
            'gameName': 'Skull',
            'links': links
        });
    }
}

// ================================================================================
// Rules reference
// ================================================================================
export class SkullRulesView extends React.Component<{}, {}> {
    public render() {
        return (
            <div className="skull-rules-panel">
                <div className="rules-section">
                    <h3>The Idea</h3>
                    <p>
                        Each player owns four discs — <strong>three flowers</strong> and{' '}
                        <strong>one skull</strong>. Bluff about what you have hidden, then bid on how
                        many flowers can be flipped without hitting a skull.
                    </p>
                    <div className="rules-discs">
                        <div className="rd-item">
                            <span className="rd-disc"><ExpressiveIcon icon={SKULL_ICONS.disc_flower} palette={FLOWER_PALETTE} /></span>
                            <span className="rd-label">Flower — safe</span>
                        </div>
                        <div className="rd-item">
                            <span className="rd-disc"><ExpressiveIcon icon={SKULL_ICONS.disc_skull} palette={SKULL_PALETTE} /></span>
                            <span className="rd-label">Skull — deadly</span>
                        </div>
                    </div>
                </div>

                <div className="rules-section">
                    <h3>A Round</h3>
                    <ul>
                        <li><strong>Place:</strong> everyone secretly lays one disc on their mat.</li>
                        <li><strong>Stack or bid:</strong> going clockwise, add another disc on top, or open
                            the bid by declaring a number of flowers.</li>
                        <li><strong>Bid:</strong> raise higher or pass (passing is permanent). The last
                            bidder left — or anyone bidding the maximum — becomes the challenger.</li>
                    </ul>
                </div>

                <div className="rules-section">
                    <h3>The Challenge</h3>
                    <ul>
                        <li>The challenger flips their <strong>entire own stack first</strong> — a skull
                            anywhere in it fails, even on a bid of 1.</li>
                        <li>Then they flip the <strong>top disc</strong> of any opponent's stack, one at a
                            time, until they reach their number.</li>
                        <li><strong>Success:</strong> flip your mat. Win <strong>two challenges</strong> to
                            win the game.</li>
                        <li><strong>Skull:</strong> you lose one disc forever. If it was your own skull you
                            choose which disc to drop; otherwise one is taken at random.</li>
                    </ul>
                </div>

                <div className="rules-section highlight">
                    <h3>Winning</h3>
                    <p>Win <strong>two challenges</strong>, or be the <strong>last player with discs</strong>.</p>
                </div>
            </div>
        );
    }
}

// ================================================================================
// Main page
// ================================================================================
interface MainState {
    bidValue: number;
    peek: boolean;   // reveal my own hidden discs (hand + placed stack) locally
}

const RESOLVE_DELAY = 4200; // ms the host lingers on an outcome before advancing

export class SkullMainPage extends React.Component<SkullProps, MainState> {
    private proceededKey: number | null = null;
    private proceedTimer?: ReturnType<typeof setTimeout>;

    constructor(props: SkullProps) {
        super(props);
        this.state = { bidValue: 1, peek: false };
    }

    private togglePeek = () => this.setState({ peek: !this.state.peek });

    public componentDidMount() {
        this.maybeScheduleProceed();
    }

    public componentDidUpdate(prev: SkullProps) {
        // SFX keyed on the move id so every client reacts to opponents' actions.
        const lm = this.props.lastMove;
        const prevId = prev.lastMove ? prev.lastMove.moveId : null;
        if (lm && lm.moveId !== prevId) {
            switch (lm.kind) {
                case 'place':
                case 'add': playSound(PlaceSound); break;
                case 'open':
                case 'raise':
                case 'pass': playSound(BidSound); break;
                case 'reveal':
                    if (lm.desc.indexOf('skull') >= 0) playSound(SkullSound);
                    else playSound(FlowerSound);
                    break;
                case 'success': playSound(FlowerSound); break;
                case 'failure': playSound(SkullSound); break;
                case 'win': playSound(WinSound); break;
                default: break;
            }
        }
        this.maybeScheduleProceed();
    }

    public componentWillUnmount() {
        if (this.proceedTimer) clearTimeout(this.proceedTimer);
    }

    // The host alone advances out of the Resolve snapshot, after a pause so
    // everyone can read the outcome.
    private maybeScheduleProceed() {
        if (!this.props.isHost) return;
        const res = this.props.resolution;
        if (this.props.gameStatus === Phase.Resolve && res && this.proceededKey !== res.resolveId) {
            this.proceededKey = res.resolveId;
            if (this.proceedTimer) clearTimeout(this.proceedTimer);
            this.proceedTimer = setTimeout(() => this.props.MP.proceedRound(), RESOLVE_DELAY);
        }
    }

    // ---- small helpers ----
    private name(id: string) { return this.props.playerNames[id] || 'Player'; }
    private accent(id: string) { return this.props.playerAccents[id] || '#7c8aa5'; }

    private badge(id: string) {
        const iconName = LOBBY_ICONS[this.props.playerIcons[id] ?? 0] || 'circle';
        return (
            <span className="pp-dot" style={{ display: 'inline-flex', width: '1.2em', height: '1.2em' }}>
                <FontAwesomeIcon icon={iconName} style={{ color: this.accent(id), width: '100%', height: '100%' }} />
            </span>
        );
    }

    private get me() { return this.props.MP.clientId; }

    // Is it this client's moment to act?
    private amActing(): boolean {
        const { gameStatus, currentPlayerId, challengerId, publicPlayers } = this.props;
        const me = this.me;
        const mine = publicPlayers[me];
        if (!mine || mine.eliminated) return false;
        switch (gameStatus) {
            case Phase.Placement: return !mine.placedInitial;
            case Phase.Stacking: return currentPlayerId === me;
            case Phase.Bidding: return currentPlayerId === me;
            case Phase.Challenge: return challengerId === me;
            case Phase.AwaitDiscard: return challengerId === me;
            default: return false;
        }
    }

    private stackTotal(): number {
        let n = 0;
        for (const id of this.props.playerOrder) n += this.props.publicPlayers[id].stackCount;
        return n;
    }

    // ---- actions ----
    private place(kind: DiscKind) { if (this.amActing()) this.props.MP.placeInitial(kind); }
    private add(kind: DiscKind) { if (this.amActing()) this.props.MP.addDisc(kind); }
    private openBid(v: number) { if (this.amActing()) this.props.MP.openBid(v); }
    private raiseBid(v: number) { if (this.amActing()) this.props.MP.raiseBid(v); }
    private pass() { if (this.amActing()) this.props.MP.passBid(); }
    private flip(id: string) { this.props.MP.flipDisc(id); }
    private discard(kind: DiscKind) { if (this.amActing()) this.props.MP.chooseDiscard(kind); }

    private adjustBid(delta: number, min: number, max: number) {
        const cur = Math.max(min, Math.min(max, this.state.bidValue || min));
        this.setState({ bidValue: Math.max(min, Math.min(max, cur + delta)) });
    }

    // ---- bid banner ----
    private renderBidBanner() {
        const { bid, gameStatus, bidTarget, flowersRevealed, challengerId, resolution } = this.props;

        if (gameStatus === Phase.Challenge || gameStatus === Phase.AwaitDiscard) {
            return (
                <div className="bid-banner challenge">
                    <div className="bb-main">
                        <span className="bb-num">{flowersRevealed}<span style={{ color: '#b9c0cd' }}>/{bidTarget}</span></span>
                        <span className="bb-label">flowers</span>
                    </div>
                    <span className="bb-who">{this.badge(challengerId)} {this.name(challengerId)} is revealing</span>
                </div>
            );
        }

        if (gameStatus === Phase.Resolve && resolution) {
            const cls = resolution.kind === 'success' ? 'success' : 'failure';
            return (
                <div className={`bid-banner ${cls}`}>
                    <div className="bb-main">
                        <span className="bb-label">
                            {resolution.kind === 'success'
                                ? `${this.name(resolution.challengerId)} revealed ${resolution.bid} flowers!`
                                : `${this.name(resolution.challengerId)} hit a skull!`}
                        </span>
                    </div>
                </div>
            );
        }

        if (!bid) {
            return (
                <div className="bid-banner">
                    <div className="bb-main"><span className="bb-sub">No bid yet — place and stack your discs.</span></div>
                </div>
            );
        }

        return (
            <div className="bid-banner">
                <div className="bb-main">
                    <span className="bb-num">{bid.value}</span>
                    <span className="bb-label">flowers</span>
                    <span className="bb-sub">to beat</span>
                </div>
                <span className="bb-who">{this.badge(bid.playerId)} {this.name(bid.playerId)}</span>
            </div>
        );
    }

    // ---- reveal tape ----
    private renderRevealTape() {
        const { revealSequence, gameStatus, resolution } = this.props;
        const reveals = (resolution ? resolution.reveals : revealSequence) || [];
        if (reveals.length === 0) return null;

        const isResolve = gameStatus === Phase.Resolve;
        const cls = resolution
            ? (resolution.kind === 'success' ? 'success' : 'failure')
            : '';

        return (
            <div className={`reveal-tape ${cls}`}>
                <div className="rt-head">
                    <span>Revealed</span>
                    <span>{reveals.filter(r => r.kind === 'flower').length} flowers</span>
                </div>
                <div className="rt-cards">
                    {reveals.map((r, i) => (
                        <div className={`rt-card ${r.kind === 'skull' ? 'bad' : ''}`} key={r.seq}>
                            <Disc revealed={true} kind={r.kind} accent={this.accent(r.ownerId)} size={44} />
                            <span className="rt-owner">{this.name(r.ownerId)}</span>
                        </div>
                    ))}
                </div>
                {isResolve && resolution && (
                    <div className={`rt-banner ${resolution.kind}`}>
                        {this.resolutionText(resolution)}
                    </div>
                )}
            </div>
        );
    }

    private resolutionText(res: Resolution): string {
        if (res.kind === 'success') {
            return `Success! ${this.name(res.challengerId)} flipped ${res.bid} flowers.`;
        }
        const who = this.name(res.challengerId);
        const lost = res.eliminatedIds.indexOf(res.challengerId) >= 0
            ? ` ${who} is eliminated!`
            : ` ${who} loses a disc.`;
        if (res.reason === 'own') {
            return `${who} revealed their OWN skull.${lost}`;
        }
        return `${who} hit ${this.name(res.skullOwnerId || '')}'s skull.${lost}`;
    }

    // ---- player panels (also the flip surface during a challenge) ----
    private renderPanels() {
        const { playerOrder, publicPlayers, currentPlayerId, challengerId, gameStatus, flippable } = this.props;
        const me = this.me;
        const amChallenger = gameStatus === Phase.Challenge && challengerId === me;

        return (
            <div className="player-panels">
                {playerOrder.map(id => {
                    const p = publicPlayers[id];
                    if (!p) return null;
                    const isTurn = id === currentPlayerId &&
                        (gameStatus === Phase.Stacking || gameStatus === Phase.Bidding);
                    const isChallenger = id === challengerId &&
                        (gameStatus === Phase.Challenge || gameStatus === Phase.AwaitDiscard);
                    const canFlip = amChallenger && flippable.indexOf(id) >= 0;

                    const classes = ['player-panel'];
                    if (isTurn) classes.push('current');
                    if (isChallenger) classes.push('challenger');
                    if (id === me) classes.push('me');
                    if (p.eliminated) classes.push('eliminated');
                    if (canFlip) classes.push('flippable');

                    return (
                        <div className={classes.join(' ')} key={id}>
                            <div className="pp-head">
                                {this.badge(id)}
                                <span className="pp-name">{this.name(id)}{id === me ? ' (you)' : ''}</span>
                                {id === me && !p.eliminated && (
                                    <button
                                        className="peek-btn"
                                        onClick={this.togglePeek}
                                        title={this.state.peek ? 'Hide your discs' : 'Peek at your discs'}
                                    >
                                        <FontAwesomeIcon icon={this.state.peek ? 'eye-slash' : 'eye'} />
                                    </button>
                                )}
                                {p.eliminated
                                    ? <span className="pp-tag out">Out</span>
                                    : isChallenger ? <span className="pp-tag challenger">Challenger</span>
                                        : isTurn ? <span className="pp-tag turn">Turn</span>
                                            : p.passed && gameStatus === Phase.Bidding ? <span className="pp-tag passed">Passed</span>
                                                : null}
                            </div>

                            <div className="pp-meta">
                                <span className="pp-metric wins-pips" title="Challenges won">
                                    {[0, 1].map(k => (
                                        <span key={k} className={`win-star ${p.wins > k ? '' : 'empty'}`}>★</span>
                                    ))}
                                </span>
                                <span className="pp-metric" title="Discs owned">
                                    <DiscGlyph kind="flower" size={15} /> {p.ownedTotal}
                                </span>
                            </div>

                            <div className="pp-mat">
                                {this.renderPile(id, p, canFlip)}
                            </div>

                            {p.handCount > 0 && (
                                <div className="pp-hand">
                                    {id === me ? this.renderMyHandInline() : <>in hand: {p.handCount}</>}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    }

    // A player's mat stack. Revealed discs (top ones) show their glyph; the rest
    // are hidden backs. During a challenge the top-most hidden disc of a flippable
    // opponent is clickable.
    private renderPile(id: string, p: PublicPlayer, canFlip: boolean) {
        const me = this.me;
        if (p.stackCount === 0) {
            return <span className="mat-empty">no discs</span>;
        }
        // Own private knowledge: I placed these, so I MAY peek at them — but only
        // when the eye is toggled on, so a shared screen stays hidden by default.
        const iOwnThis = id === me;
        const canSeeOwn = iOwnThis && this.state.peek;
        const myStack = this.props.myStack; // bottom -> top

        const slots: React.ReactNode[] = [];
        for (let t = 0; t < p.stackCount; t++) {
            const revealed = t < p.revealed;
            let kind: DiscKind | 'hidden' = 'hidden';
            if (revealed) {
                kind = p.revealedKinds[t] || 'flower';
            } else if (canSeeOwn) {
                // Show myself what I placed (top t maps to stack index count-1-t).
                const idx = p.stackCount - 1 - t;
                kind = myStack[idx] || 'hidden';
            }
            const clickable = canFlip && t === p.revealed;
            const showFace = revealed || canSeeOwn;
            slots.push(
                <div className="pile-slot" key={t} style={{ zIndex: p.stackCount - t }}>
                    <Disc
                        revealed={showFace && kind !== 'hidden'}
                        kind={kind}
                        accent={this.accent(id)}
                        size={52}
                        clickable={clickable}
                        onClick={() => this.flip(id)}
                    />
                </div>
            );
        }
        return <div className="disc-pile">{slots}</div>;
    }

    private renderMyHandInline() {
        const flowers = this.props.myHandFlowers;
        const skulls = this.props.myHandSkulls;
        const total = flowers + skulls;
        if (total === 0) return <>hand empty</>;

        const pips: React.ReactNode[] = [];
        if (this.state.peek) {
            for (let i = 0; i < flowers; i++) pips.push(<DiscGlyph key={'f' + i} kind="flower" size={16} />);
            for (let i = 0; i < skulls; i++) pips.push(<DiscGlyph key={'s' + i} kind="skull" size={16} />);
        } else {
            // Hidden by default: show face-down backs (count is public anyway).
            const pal = backPalette(this.accent(this.me));
            for (let i = 0; i < total; i++) {
                pips.push(
                    <span className="disc-pip" key={'h' + i} style={{ width: 16, height: 16 }}>
                        <ExpressiveIcon icon={SKULL_ICONS.disc_back} palette={pal} />
                    </span>
                );
            }
        }
        return <>hand: {pips}</>;
    }

    // ---- controls (context-sensitive, only for the acting client) ----
    private renderControls() {
        const { gameStatus } = this.props;
        const acting = this.amActing();

        if (gameStatus === Phase.Resolve) {
            return this.props.isHost ? (
                <div className="controls">
                    <div className="ctrl-title">Outcome</div>
                    <div className="ctrl-hint">Showing the result to everyone…</div>
                    <div className="ctrl-row">
                        <button className="primary-btn" onClick={() => this.props.MP.proceedRound()}>Continue</button>
                    </div>
                </div>
            ) : <div className="waiting-note">Resolving the challenge…</div>;
        }

        if (!acting) {
            return <div className="waiting-note">{this.waitingText()}</div>;
        }

        switch (gameStatus) {
            case Phase.Placement: return this.renderPlacementControls();
            case Phase.Stacking: return this.renderStackingControls();
            case Phase.Bidding: return this.renderBiddingControls();
            case Phase.Challenge: return this.renderChallengeControls();
            case Phase.AwaitDiscard: return this.renderDiscardControls();
            default: return null;
        }
    }

    private waitingText(): string {
        const { gameStatus, currentPlayerId, challengerId, publicPlayers } = this.props;
        switch (gameStatus) {
            case Phase.Placement: {
                const waiting = this.props.playerOrder.filter(id =>
                    !publicPlayers[id].eliminated && !publicPlayers[id].placedInitial).length;
                return `Placing discs… waiting on ${waiting} player${waiting === 1 ? '' : 's'}.`;
            }
            case Phase.Stacking: return `Waiting for ${this.name(currentPlayerId)} to stack or bid…`;
            case Phase.Bidding: return `Waiting for ${this.name(currentPlayerId)} to bid…`;
            case Phase.Challenge: return `${this.name(challengerId)} is revealing discs…`;
            case Phase.AwaitDiscard: return `${this.name(challengerId)} is choosing a disc to lose…`;
            default: return 'Waiting…';
        }
    }

    private renderPlacementControls() {
        const f = this.props.myHandFlowers;
        const s = this.props.myHandSkulls;
        return (
            <div className="controls acting">
                <div className="ctrl-title">Place a disc face-down</div>
                <div className="ctrl-hint">Everyone places one disc at the same time. Bluff wisely.</div>
                <div className="ctrl-row">
                    <button className="disc-btn flower" disabled={f <= 0} onClick={() => this.place('flower')}>
                        <span className="db-disc"><ExpressiveIcon icon={SKULL_ICONS.disc_flower} palette={FLOWER_PALETTE} /></span>
                        Flower
                    </button>
                    <button className="disc-btn skull" disabled={s <= 0} onClick={() => this.place('skull')}>
                        <span className="db-disc"><ExpressiveIcon icon={SKULL_ICONS.disc_skull} palette={SKULL_PALETTE} /></span>
                        Skull
                    </button>
                </div>
            </div>
        );
    }

    private renderStackingControls() {
        const f = this.props.myHandFlowers;
        const s = this.props.myHandSkulls;
        const handEmpty = f + s === 0;
        const max = this.stackTotal();
        const shown = Math.max(1, Math.min(max, this.state.bidValue || 1));

        return (
            <div className="controls acting">
                <div className="ctrl-title">Your turn — stack or open the bid</div>
                {handEmpty
                    ? <div className="ctrl-hint">Your hand is empty, so you must open the bid.</div>
                    : <div className="ctrl-hint">Add a disc on top of your stack, or open the bid.</div>}
                {!handEmpty && (
                    <div className="ctrl-row">
                        <button className="disc-btn flower" disabled={f <= 0} onClick={() => this.add('flower')}>
                            <span className="db-disc"><ExpressiveIcon icon={SKULL_ICONS.disc_flower} palette={FLOWER_PALETTE} /></span>
                            Add Flower
                        </button>
                        <button className="disc-btn skull" disabled={s <= 0} onClick={() => this.add('skull')}>
                            <span className="db-disc"><ExpressiveIcon icon={SKULL_ICONS.disc_skull} palette={SKULL_PALETTE} /></span>
                            Add Skull
                        </button>
                    </div>
                )}
                <div className="ctrl-row">
                    <div className="bid-stepper">
                        <button className="step-btn" disabled={shown <= 1} onClick={() => this.adjustBid(-1, 1, max)}>−</button>
                        <span className="step-val">{shown}</span>
                        <button className="step-btn" disabled={shown >= max} onClick={() => this.adjustBid(1, 1, max)}>+</button>
                        <span className="step-max">of {max}</span>
                    </div>
                    <button className="primary-btn" disabled={max < 1} onClick={() => this.openBid(shown)}>Open Bid</button>
                </div>
            </div>
        );
    }

    private renderBiddingControls() {
        const cur = this.props.bid ? this.props.bid.value : 0;
        const min = cur + 1;
        const max = this.props.discsOnTable;
        const canRaise = min <= max;
        const shown = Math.max(min, Math.min(max, this.state.bidValue || min));

        return (
            <div className="controls acting">
                <div className="ctrl-title">Your turn — raise or pass</div>
                <div className="ctrl-hint">Current bid is {cur}. Raise higher, or pass for the rest of the round.</div>
                <div className="ctrl-row">
                    {canRaise && (
                        <>
                            <div className="bid-stepper">
                                <button className="step-btn" disabled={shown <= min} onClick={() => this.adjustBid(-1, min, max)}>−</button>
                                <span className="step-val">{shown}</span>
                                <button className="step-btn" disabled={shown >= max} onClick={() => this.adjustBid(1, min, max)}>+</button>
                                <span className="step-max">of {max}</span>
                            </div>
                            <button className="primary-btn" onClick={() => this.raiseBid(shown)}>Raise</button>
                        </>
                    )}
                    <button className="danger-btn" onClick={() => this.pass()}>Pass</button>
                </div>
            </div>
        );
    }

    private renderChallengeControls() {
        const { flowersRevealed, bidTarget, flippable } = this.props;
        const done = flowersRevealed >= bidTarget;
        return (
            <div className="controls acting">
                <div className="ctrl-title">Reveal {bidTarget} flowers</div>
                <div className="ctrl-hint">
                    Your own stack is flipped. {done
                        ? 'You have your flowers!'
                        : flippable.length > 0
                            ? 'Tap the highlighted top disc of an opponent to flip it.'
                            : 'No discs left to flip.'}
                </div>
            </div>
        );
    }

    private renderDiscardControls() {
        const f = this.props.myOwnedFlowers;
        const s = this.props.myOwnedSkulls;
        return (
            <div className="controls acting">
                <div className="ctrl-title">You revealed your own skull</div>
                <div className="ctrl-hint">Choose one of your discs to lose forever. No one sees which.</div>
                <div className="ctrl-row">
                    <button className="disc-btn flower" disabled={f <= 0} onClick={() => this.discard('flower')}>
                        <span className="db-disc"><ExpressiveIcon icon={SKULL_ICONS.disc_flower} palette={FLOWER_PALETTE} /></span>
                        Drop Flower
                    </button>
                    <button className="disc-btn skull" disabled={s <= 0} onClick={() => this.discard('skull')}>
                        <span className="db-disc"><ExpressiveIcon icon={SKULL_ICONS.disc_skull} palette={SKULL_PALETTE} /></span>
                        Drop Skull
                    </button>
                </div>
            </div>
        );
    }

    // ---- game over ----
    private renderGameOver() {
        const { playerOrder, publicPlayers, winnerId, isHost } = this.props;
        const sorted = [...playerOrder].sort((a, b) => {
            const pa = publicPlayers[a], pb = publicPlayers[b];
            if (pb.wins !== pa.wins) return pb.wins - pa.wins;
            return pb.ownedTotal - pa.ownedTotal;
        });

        return (
            <div className="game-over">
                <div className="go-mark"><ExpressiveIcon icon={SKULL_ICONS.disc_skull} palette={SKULL_PALETTE} /></div>
                <div className="go-title">{winnerId ? `${this.name(winnerId)} wins!` : 'Game Over'}</div>
                <div className="go-reason">
                    {winnerId && publicPlayers[winnerId] && publicPlayers[winnerId].wins >= 2
                        ? 'Won two challenges.'
                        : 'Last player standing.'}
                </div>

                <table className="re-table">
                    <thead><tr><th>#</th><th>Player</th><th>Wins</th><th>Discs</th></tr></thead>
                    <tbody>
                        {sorted.map((id, i) => (
                            <tr key={id} className={id === winnerId ? 'winner-row' : ''}>
                                <td>{i === 0 ? '🏆' : i + 1}</td>
                                <td>{this.badge(id)} {this.name(id)}</td>
                                <td>{publicPlayers[id].wins}</td>
                                <td>{publicPlayers[id].eliminated ? '—' : publicPlayers[id].ownedTotal}</td>
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
        const { gameStatus } = this.props;
        const over = gameStatus === Phase.GameOver || !!this.props.winnerId;

        const arena = (
            <div className="skull-arena">
                <div className="arena-topline">
                    <span className="phase-pill">{over ? 'Game Over' : this.phaseLabel()}</span>
                    <span className="turn-pill">{this.turnLabel()}</span>
                </div>

                {over ? this.renderGameOver() : (
                    <React.Fragment>
                        {this.renderBidBanner()}
                        {this.renderRevealTape()}

                        <div className="section-label">Players</div>
                        {this.renderPanels()}

                        {this.renderControls()}
                    </React.Fragment>
                )}
            </div>
        );

        const links: any = {
            'home': { 'icon': 'gamepad', 'label': 'Arena', 'view': arena },
            'rules': { 'icon': 'book', 'label': 'Rules', 'view': <SkullRulesView /> }
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
            'gameName': 'Skull · Round ' + this.props.round,
            'topBarContent': this.turnLabel(),
            'roomClassName': this.amActing() ? 'attention-bg' : ''
        });
    }

    private phaseLabel(): string {
        switch (this.props.gameStatus) {
            case Phase.Placement: return 'Placement';
            case Phase.Stacking: return 'Stacking';
            case Phase.Bidding: return 'Bidding';
            case Phase.Challenge: return 'Challenge';
            case Phase.AwaitDiscard: return 'Skull!';
            case Phase.Resolve: return 'Resolving';
            default: return '';
        }
    }

    private turnLabel(): string {
        const { gameStatus, currentPlayerId, challengerId, winnerId } = this.props;
        if (gameStatus === Phase.GameOver || winnerId) {
            return winnerId === this.me ? 'Victory' : 'Game Over';
        }
        if (this.amActing()) return 'Your Turn';
        if (gameStatus === Phase.Challenge || gameStatus === Phase.AwaitDiscard) {
            return `${this.name(challengerId)}'s reveal`;
        }
        if (gameStatus === Phase.Placement) return 'Placing…';
        return `${this.name(currentPlayerId)}'s turn`;
    }
}
