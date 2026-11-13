/**
 * SchadenfreudeViews.tsx - React components for "Seconds, Please!".
 * Card style and trick-resolution animation follow Cat in the Box.
 */

import * as React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ViewPropsInterface } from '../../../common/interfaces';
import { icons as LOBBY_ICONS } from '../../lobby/LobbyView';
import {
    Phase, Card, CardSuit, Suit, SUITS, TrickPlay, ResolvingTrick, CompletedTrick, LastMove,
    BUST_LIMIT, suitName, formatValue, getDealConfig, suitValues
} from '../SchadenfreudeGameState';
import { PlayingCard } from '../../../client/lib/card-renderer/PlayingCard';
import { ExpressiveIcon } from '../../../client/lib/card-renderer/IconEngine';
import {
    TREAT_ICONS, SUIT_ICON_ID, SUIT_TREAT_NAME, getTreatCardDefinition, treatStyle, chipPalette
} from '../SchadenfreudeAssets';
import PlaySound from '../../../sounds/softnotification.mp3';
import CollectSound from '../../../sounds/coin_few.mp3';
import PopSound from '../../../sounds/scratch.mp3';

function playSound(src: string) {
    if (typeof Audio === 'undefined' || !src) return;
    try {
        const audio = new Audio(src);
        const p = audio.play();
        if (p && typeof p.catch === 'function') p.catch(() => { /* blocked until interaction */ });
    } catch (e) { /* ignore */ }
}

interface PublicPlayer {
    plate: Card[];
    plateTotal: number;
    handCount: number;
    tricksWon: number;
    score: number;
    scoreBefore: number;
    roundPoints: number;
    history: number[];
}

interface SfProps extends ViewPropsInterface {
    gameStatus: Phase;
    round: number;
    numPlayers: number;
    handSize: number;
    setAsideCount: number;
    playerOrder: string[];
    roundLeaderId: string;
    leaderReason: 'random' | 'lowest';
    currentPlayerId: string;
    trickLeaderId: string;
    currentTrick: TrickPlay[];
    leadSuit: Suit | null;
    trickNumber: number;
    totalTricks: number;
    resolvingTrick: ResolvingTrick | null;
    trickHistory: CompletedTrick[];
    bustedIds: string[];
    winnerId: string | null;
    lastMove: LastMove | null;
    publicPlayers: Record<string, PublicPlayer>;
    playerNames: Record<string, string>;
    playerAccents: Record<string, string>;
    playerIcons: Record<string, number>;
    isHost: boolean;
    toastNotification: any;
    myHand: Card[];
    legalCardIds: number[];
}

type ResolveStage = 'rank' | 'sort' | 'collapse' | 'fade';

interface MainState {
    selectedCardId: number | null;
    resolveStage: ResolveStage | null;
    resolveKey: number | null;
}

// Resolution timeline (ms from the moment the last card lands).
const STAGE_SORT = 1900;      // rank badges + winner pulse, then split taken / discarded
const STAGE_COLLAPSE = 3100;  // taken cards slide together onto the winner's plate
const STAGE_FADE = 3600;
const STAGE_FINISH = 3950;    // host commits the trick

// ---- small vector helpers --------------------------------------------------------

export function treatChip(suit: CardSuit, size = '1.3em') {
    return (
        <span className="sf-chip" style={{ width: size, height: size }}>
            <ExpressiveIcon icon={TREAT_ICONS[SUIT_ICON_ID[suit]]} palette={chipPalette(suit)} />
        </span>
    );
}

function treatCard(
    card: Card,
    opts: { selected?: boolean; onClick?: () => void; selectable?: boolean; width?: number; flipped?: boolean; back?: boolean } = {}
) {
    return (
        <div className={`sf-card sf-suit-${card.suit}`}>
            <PlayingCard
                card={getTreatCardDefinition(card, opts.back)}
                customIcons={TREAT_ICONS}
                width={opts.width || 56}
                selectable={opts.selectable}
                selected={opts.selected}
                selectedStyle="outline"
                isFlipped={opts.flipped}
                onClick={opts.onClick}
            />
        </div>
    );
}

// Compact plate tile: suit colour + number + tiny glyph.
function plateTile(card: Card, extraCls = '') {
    const s = treatStyle(card.suit);
    return (
        <span
            key={card.id}
            className={`sf-plate-tile sf-suit-${card.suit} ${extraCls}`}
            style={{ background: s.fill, color: s.ink }}
            title={`${suitName(card.suit)} ${formatValue(card.value)}`}
        >
            {treatChip(card.suit, '0.95em')}
            <span className="pt-num">{formatValue(card.value)}</span>
        </span>
    );
}

function leadTag(suit: Suit | null) {
    if (!suit) return <span className="sf-lead-tag sf-lead-open">Lead: open</span>;
    const s = treatStyle(suit);
    return (
        <span className="sf-lead-tag" style={{ background: s.fill, color: s.ink }}>
            {treatChip(suit, '1.05em')} Lead: {SUIT_TREAT_NAME[suit]}
        </span>
    );
}

// ================================================================================
// Lobby views
// ================================================================================
const GAME_NAME = 'Seconds, Please!';

export class SchadenfreudeHostLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;
        const playerCount = mp.playersCount() + 1;
        const ok = playerCount >= 3 && playerCount <= 5;
        const links = {
            'home': {
                'icon': 'home',
                'label': 'Lobby',
                'view': (
                    <div>
                        {mp.getPluginView('lobby', 'SetNameWithLobby')}
                        {!ok && (
                            <p className="sf-lobby-warn">
                                {GAME_NAME} needs 3 to 5 players. Currently {playerCount}.
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
                'view': <SchadenfreudeRulesView />
            }
        };
        return mp.getPluginView('gameshell', 'HostShell-Main', { 'gameName': GAME_NAME, 'links': links });
    }
}

export class SchadenfreudeClientLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;
        const links = {
            'home': {
                'icon': 'id-card',
                'label': 'Lobby',
                'view': (
                    <div>
                        {mp.getPluginView('lobby', 'SetNameWithLobby')}
                        <div className="sf-waiting">Waiting for the host to start the picnic…</div>
                    </div>
                )
            },
            'rules': {
                'icon': 'book',
                'label': 'Rules',
                'view': <SchadenfreudeRulesView />
            }
        };
        return mp.getPluginView('gameshell', 'HostShell-Main', { 'gameName': GAME_NAME, 'links': links });
    }
}

// ================================================================================
// Rules reference
// ================================================================================
export class SchadenfreudeRulesView extends React.Component<{ players?: number }, {}> {
    public render() {
        const current = this.props.players;
        const rows = [3, 4, 5].map(n => {
            const cfg = getDealConfig(n);
            const vals = suitValues(n);
            return { n, deck: cfg.deckSize, hand: cfg.handSize, aside: cfg.setAside, range: `${formatValue(vals[0])} to ${vals[vals.length - 1]}` };
        });
        return (
            <div className="sf-rules-panel sf-root">
                <div className="rules-section">
                    <h3>The Idea</h3>
                    <p>
                        Everyone is at a dessert picnic, and every treat you win fills your
                        tummy. Fill up, but not too much: <strong>go over {BUST_LIMIT} and
                        you&rsquo;re too full</strong> to win. Cheer on your friends to grab one bite too many!
                    </p>
                </div>

                <div className="rules-section">
                    <h3>The Treats</h3>
                    <ul>
                        {SUITS.map(s => (
                            <li key={s}>{treatChip(s)} <strong>{SUIT_TREAT_NAME[s]}</strong> ({suitName(s)})</li>
                        ))}
                        <li>{treatChip('wild')} <strong>Rainbow 0</strong> and <strong>Rainbow 10</strong>: they go with every
                            flavour (see below).</li>
                    </ul>
                    <p className="setup-note">Each suit runs −3, −2, −1, 1–9. Negative treats are veggies in disguise and settle your tummy.</p>
                </div>

                <div className="rules-section">
                    <h3>Setup by Players</h3>
                    <div className="setup-table-wrap">
                        <table className="setup-table">
                            <thead><tr><th>Players</th><th>Suit values</th><th>Deck</th><th>Hand</th><th>Set aside</th></tr></thead>
                            <tbody>
                                {rows.map(r => (
                                    <tr key={r.n} className={current === r.n ? 'setup-current' : ''}>
                                        <td>{r.n}{current === r.n ? ' ◂' : ''}</td>
                                        <td>{r.range}{r.n === 3 ? ' (no −2, −1, 9)' : ''}</td>
                                        <td>{r.deck}</td>
                                        <td>{r.hand}</td>
                                        <td>{r.aside}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="rules-section">
                    <h3>Playing a Trick</h3>
                    <ul>
                        <li>The leader plays any card. Everyone else must <strong>follow the lead flavour</strong> if
                            they can; if not, they may play anything.</li>
                        <li><strong>Rainbow</strong> cards always count as the lead flavour and may be played any time,
                            even when you could follow. If a Rainbow is led, the next normal card sets the flavour.</li>
                        <li>The <strong>second-highest</strong> lead-flavour card (Rainbows included) wins the trick.
                            If only one card is in the lead flavour, it wins.</li>
                        <li>The winner leads the next trick.</li>
                    </ul>
                </div>

                <div className="rules-section">
                    <h3>Filling Your Plate</h3>
                    <ul>
                        <li>The winner takes <strong>their own card</strong> plus every <strong>off-flavour</strong> card.
                            Other lead-flavour cards and Rainbows go back to the kitchen.</li>
                        <li><strong>Twin treats cancel:</strong> if you take a number already on your plate, both are
                            removed. Three of a number leaves one.</li>
                    </ul>
                </div>

                <div className="rules-section">
                    <h3>Scoring &amp; Winning</h3>
                    <ul>
                        <li>When hands are empty, add up your plate and move your tummy meter (it never drops below 0).</li>
                        <li>If anyone is over <strong>{BUST_LIMIT}</strong>, the game ends. The highest score of {BUST_LIMIT} or
                            less wins. Tied players are eliminated, so it&rsquo;s possible nobody wins.</li>
                        <li>If everyone is over {BUST_LIMIT}, the highest score wins.</li>
                        <li>Otherwise, deal again. The player with the lowest score (ignoring ties) leads.</li>
                    </ul>
                </div>
            </div>
        );
    }
}

// ================================================================================
// Main page
// ================================================================================
export class SchadenfreudeMainPage extends React.Component<SfProps, MainState> {
    private timers: ReturnType<typeof setTimeout>[] = [];
    private finishScheduledKey: number | null = null;

    constructor(props: SfProps) {
        super(props);
        this.state = { selectedCardId: null, resolveStage: null, resolveKey: null };
    }

    public componentDidMount() {
        if (this.props.resolvingTrick) this.startResolveAnimation();
    }

    public componentDidUpdate(prev: SfProps) {
        if (prev.currentPlayerId !== this.props.currentPlayerId || prev.gameStatus !== this.props.gameStatus) {
            if (this.state.selectedCardId !== null) this.setState({ selectedCardId: null });
        }

        const lm = this.props.lastMove;
        if (lm && lm.kind === 'play' && lm.moveId !== (prev.lastMove ? prev.lastMove.moveId : null)) {
            playSound(PlaySound);
        }

        const rt = this.props.resolvingTrick;
        if (rt && rt.resolveId !== this.state.resolveKey) {
            this.startResolveAnimation();
        } else if (!rt && this.state.resolveStage !== null) {
            this.clearTimers();
            this.setState({ resolveStage: null, resolveKey: null });
        }
    }

    public componentWillUnmount() {
        this.clearTimers();
    }

    private clearTimers() {
        this.timers.forEach(t => clearTimeout(t));
        this.timers = [];
    }

    private startResolveAnimation() {
        const rt = this.props.resolvingTrick;
        if (!rt) return;
        this.clearTimers();
        this.setState({ resolveStage: 'rank', resolveKey: rt.resolveId });

        this.timers.push(setTimeout(() => {
            this.setState({ resolveStage: 'sort' });
            if (rt.cancelIds.length > 0) playSound(PopSound);
        }, STAGE_SORT));
        this.timers.push(setTimeout(() => {
            this.setState({ resolveStage: 'collapse' });
            playSound(CollectSound);
        }, STAGE_COLLAPSE));
        this.timers.push(setTimeout(() => this.setState({ resolveStage: 'fade' }), STAGE_FADE));

        if (this.props.isHost && this.finishScheduledKey !== rt.resolveId) {
            this.finishScheduledKey = rt.resolveId;
            this.timers.push(setTimeout(() => this.props.MP.finishTrick(), STAGE_FINISH));
        }
    }

    private name(id: string) {
        return this.props.playerNames[id] || 'Player';
    }
    private accent(id: string) {
        return this.props.playerAccents[id] || '#8a7f99';
    }
    private badge(id: string, className = 'sf-dot') {
        const iconName = LOBBY_ICONS[this.props.playerIcons[id] ?? 0] || 'circle';
        return (
            <span className={className}>
                <FontAwesomeIcon icon={iconName} style={{ color: this.accent(id) }} />
            </span>
        );
    }

    // ---- interactions ----
    private onHandCard(card: Card) {
        if (!this.props.legalCardIds.includes(card.id)) return;
        if (this.state.selectedCardId === card.id) {
            this.playSelected();
        } else {
            this.setState({ selectedCardId: card.id });
        }
    }

    private playSelected() {
        const id = this.state.selectedCardId;
        if (id === null) return;
        this.props.MP.playCard(id);
        this.setState({ selectedCardId: null });
    }

    // ---- sub-renders ----
    private renderTrick() {
        const { currentTrick, resolvingTrick, trickLeaderId } = this.props;
        const stage = this.state.resolveStage;
        const plays = resolvingTrick ? resolvingTrick.plays : currentTrick;

        if (plays.length === 0) {
            return <div className="trick-empty">Waiting for {this.name(trickLeaderId)} to lead…</div>;
        }

        const rt = resolvingTrick;
        const sorting = stage === 'sort' || stage === 'collapse' || stage === 'fade';
        const containerCls = [
            'trick-plays',
            rt ? 'resolving' : '',
            stage === 'collapse' || stage === 'fade' ? 'collapsing' : '',
            stage === 'fade' ? 'fading' : ''
        ].filter(Boolean).join(' ');

        return (
            <div className={containerCls}>
                {plays.map((p, i) => {
                    const id = p.card.id;
                    const rank = rt ? rt.rankedIds.indexOf(id) : -1;
                    const isWinner = rt ? rt.winnerCardId === id : false;
                    const taken = rt ? rt.takenIds.includes(id) : false;
                    const discarded = rt ? rt.discardIds.includes(id) : false;
                    const cancels = rt ? rt.cancelIds.includes(id) : false;
                    const cls = [
                        'trick-play',
                        isWinner && stage === 'rank' ? 'is-winner' : '',
                        sorting && taken ? 'is-taken' : '',
                        sorting && discarded ? 'is-discarded' : '',
                        sorting && cancels ? 'is-cancel' : ''
                    ].filter(Boolean).join(' ');

                    let tag: React.ReactNode = null;
                    if (rt && stage === 'rank' && rank >= 0) {
                        tag = <span className={`tp-rank ${isWinner ? 'rank-win' : ''}`}>{['1st', '2nd', '3rd', '4th', '5th'][rank]}</span>;
                    } else if (rt && sorting) {
                        tag = cancels
                            ? <span className="tp-rank rank-pop">Twin!</span>
                            : taken ? <span className="tp-rank rank-take">Plate</span> : null;
                    }

                    return (
                        <div className={cls} key={i}>
                            <div className="tp-tag">{tag}</div>
                            {treatCard(p.card, { width: 52, flipped: sorting && discarded, back: true })}
                            <div className="trick-play-name" style={{ color: this.accent(p.playerId) }}>
                                {this.name(p.playerId)}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    private renderMeter(p: PublicPlayer, showProjected: boolean) {
        const max = BUST_LIMIT + 8;
        const pct = (v: number) => `${Math.max(0, Math.min(v, max)) / max * 100}%`;
        const projected = Math.max(0, p.score + p.plateTotal);
        const over = projected > BUST_LIMIT;
        return (
            <div className="sf-meter" title={`Tummy ${p.score}${showProjected ? ` → ${projected}` : ''}`}>
                <div className="m-track">
                    <div className="m-danger" style={{ left: pct(BUST_LIMIT) }} />
                    {showProjected && projected !== p.score && (
                        <div
                            className={`m-proj ${projected < p.score ? 'down' : ''} ${over ? 'over' : ''}`}
                            style={{
                                left: pct(Math.min(projected, p.score)),
                                width: `calc(${pct(Math.max(projected, p.score))} - ${pct(Math.min(projected, p.score))})`
                            }}
                        />
                    )}
                    <div className={`m-fill ${p.score > BUST_LIMIT ? 'over' : ''}`} style={{ width: pct(p.score) }} />
                    <div className="m-limit" style={{ left: pct(BUST_LIMIT) }} />
                </div>
                <div className="m-label">
                    <strong>{p.score}</strong>
                    {showProjected && projected !== p.score && (
                        <span className={over ? 'm-over' : ''}> → {projected}</span>
                    )}
                    <span className="m-max">/ {BUST_LIMIT}</span>
                </div>
            </div>
        );
    }

    private renderPlayers() {
        const { playerOrder, publicPlayers, currentPlayerId, trickLeaderId, gameStatus, resolvingTrick } = this.props;
        const stage = this.state.resolveStage;
        const popping = resolvingTrick && (stage === 'sort' || stage === 'collapse' || stage === 'fade')
            ? resolvingTrick.cancelIds : [];
        return (
            <div className="sf-player-panels">
                {playerOrder.map(id => {
                    const p = publicPlayers[id];
                    if (!p) return null;
                    const active = gameStatus === Phase.Play && !resolvingTrick && id === currentPlayerId;
                    const sortedPlate = [...p.plate].sort((a, b) => a.value - b.value);
                    return (
                        <div className={`sf-player-panel ${active ? 'active' : ''}`} key={id}>
                            <div className="pp-head">
                                {this.badge(id)}
                                <span className="pp-name">{this.name(id)}</span>
                                {id === trickLeaderId && gameStatus === Phase.Play && <span className="pp-badge">lead</span>}
                                <span className="pp-hand" title="Cards in hand">{p.handCount} in hand</span>
                            </div>
                            {/* Once scored, the plate is already in the meter — no projection. */}
                            {this.renderMeter(p, gameStatus === Phase.Play)}
                            <div className="pp-plate">
                                <span className={`pp-plate-total ${p.plateTotal < 0 ? 'neg' : ''}`}>
                                    Plate {p.plateTotal >= 0 ? '+' : ''}{p.plateTotal}
                                </span>
                                <div className="pp-plate-tiles">
                                    {sortedPlate.length === 0 && <span className="pp-empty">empty</span>}
                                    {sortedPlate.map(c => plateTile(c, popping.includes(c.id) ? 'is-pop' : ''))}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    private renderPlayControls(myId: string) {
        const { currentPlayerId, myHand, legalCardIds, resolvingTrick, leadSuit, currentTrick } = this.props;
        const myTurn = currentPlayerId === myId && !resolvingTrick;
        const leading = myTurn && currentTrick.length === 0;
        const sel = this.state.selectedCardId;
        const selCard = myHand.find(c => c.id === sel) || null;
        const mustFollow = myTurn && leadSuit && myHand.some(c => c.suit === leadSuit);

        let note: React.ReactNode;
        if (resolvingTrick) {
            note = <div className="phase-note">{this.name(resolvingTrick.winnerId)} wins with the second-highest card…</div>;
        } else if (myTurn) {
            note = (
                <div className="phase-note turn-note">
                    {leading ? 'You lead — play any card.'
                        : mustFollow ? `Your turn — follow ${SUIT_TREAT_NAME[leadSuit!]} (or play a Rainbow).`
                            : 'Your turn — you can’t follow, so play anything.'}
                </div>
            );
        } else {
            note = <div className="phase-note">Waiting for {this.name(currentPlayerId)}…</div>;
        }

        return (
            <div className="phase-controls">
                <div className="phase-title">
                    Your Hand
                    {myTurn && sel === null && <span className="ph-hint">tap a card</span>}
                </div>
                {note}
                <div className="hand-row">
                    {myHand.map(card => {
                        const legal = myTurn && legalCardIds.includes(card.id);
                        return (
                            <div className={`hand-card ${myTurn && !legal ? 'is-illegal' : ''}`} key={card.id}>
                                {treatCard(card, {
                                    selectable: legal,
                                    selected: sel === card.id,
                                    onClick: legal ? () => this.onHandCard(card) : undefined
                                })}
                            </div>
                        );
                    })}
                </div>
                {myTurn && selCard && (
                    <div className="sf-play-bar">
                        <button className="primary-btn" onClick={() => this.playSelected()}>
                            Serve {suitName(selCard.suit)} {formatValue(selCard.value)}
                        </button>
                        <button className="ghost-btn" onClick={() => this.setState({ selectedCardId: null })}>Cancel</button>
                    </div>
                )}
            </div>
        );
    }

    private renderScoreTable(final: boolean) {
        const { playerOrder, publicPlayers, bustedIds, winnerId } = this.props;
        const sorted = [...playerOrder].sort((a, b) => publicPlayers[b].score - publicPlayers[a].score);
        return (
            <table className="re-table">
                <thead><tr><th>Player</th><th>Plate</th><th>Tummy</th></tr></thead>
                <tbody>
                    {sorted.map(id => {
                        const p = publicPlayers[id];
                        const busted = bustedIds.includes(id) || p.score > BUST_LIMIT;
                        const cls = busted ? 'busted-row' : (final && id === winnerId ? 'winner-row' : '');
                        return (
                            <tr key={id} className={cls}>
                                <td>{final && id === winnerId ? '🏆 ' : ''}{this.badge(id)} {this.name(id)}</td>
                                <td className={p.roundPoints < 0 ? 'neg' : ''}>{p.roundPoints >= 0 ? '+' : ''}{p.roundPoints}</td>
                                <td>
                                    {p.scoreBefore} → <strong>{p.score}</strong>
                                    {busted && <span className="too-full">too full</span>}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        );
    }

    private renderRoundEnd() {
        const { round, isHost } = this.props;
        return (
            <div className="round-end">
                <div className="re-title">Round {round + 1} Results</div>
                <div className="re-sub">Nobody is over {BUST_LIMIT} yet — the picnic continues.</div>
                {this.renderScoreTable(false)}
                {isHost ? (
                    <button className="primary-btn" onClick={() => this.props.MP.nextRound()}>Next Round</button>
                ) : (
                    <div className="phase-note">Waiting for the host to deal the next round…</div>
                )}
            </div>
        );
    }

    private renderGameOver() {
        const { winnerId, bustedIds, isHost } = this.props;
        const busted = bustedIds.map(id => this.name(id)).join(', ');
        return (
            <div className="game-over">
                <div className="go-icon">
                    <ExpressiveIcon icon={TREAT_ICONS.treat_cupcake} palette={chipPalette('berry')} />
                </div>
                <div className="go-title">{winnerId ? `${this.name(winnerId)} wins!` : 'Nobody wins this time'}</div>
                <div className="re-sub">{busted} {bustedIds.length === 1 ? 'is' : 'are'} too full to eat another bite.</div>
                {this.renderScoreTable(true)}
                {isHost && (
                    <div className="go-actions">
                        <button className="primary-btn" onClick={() => this.props.MP.restartGame()}>Play Again</button>
                        <button className="ghost-btn" onClick={() => this.props.MP.backToLobby()}>Back to Lobby</button>
                    </div>
                )}
            </div>
        );
    }

    private renderHistory() {
        const { trickHistory, playerOrder, publicPlayers } = this.props;
        const roundsPlayed = playerOrder.length > 0 && publicPlayers[playerOrder[0]]
            ? publicPlayers[playerOrder[0]].history.length : 0;

        const byRound: Record<number, CompletedTrick[]> = {};
        for (const t of trickHistory || []) (byRound[t.round] = byRound[t.round] || []).push(t);
        const rounds = Object.keys(byRound).map(Number).sort((a, b) => b - a);

        return (
            <div className="sf-history sf-root">
                {roundsPlayed > 0 && (
                    <div className="history-scores">
                        <div className="history-round-title">Tummy by Round</div>
                        <div className="setup-table-wrap">
                            <table className="re-table">
                                <thead>
                                    <tr>
                                        <th>Player</th>
                                        {Array.from({ length: roundsPlayed }, (_, i) => <th key={i}>R{i + 1}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {playerOrder.map(id => (
                                        <tr key={id}>
                                            <td>{this.badge(id)} {this.name(id)}</td>
                                            {publicPlayers[id].history.map((s, i) => (
                                                <td key={i} className={s > BUST_LIMIT ? 'neg' : ''}>{s}</td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                {rounds.length === 0 && <div className="phase-note">No tricks played yet.</div>}
                {rounds.map(r => (
                    <div className="history-round" key={r}>
                        <div className="history-round-title">Round {r + 1}</div>
                        {[...byRound[r]].sort((a, b) => b.trickNumber - a.trickNumber).map(t => (
                            <div className="history-trick" key={t.trickNumber}>
                                <div className="history-trick-head">
                                    <span className="ht-index">Trick {t.trickNumber}</span>
                                    {leadTag(t.leadSuit)}
                                    <span className="ht-winner">{this.badge(t.winnerId)} {this.name(t.winnerId)} won</span>
                                </div>
                                <div className="history-trick-cards">
                                    {t.plays.map((p, i) => {
                                        const taken = t.takenIds.includes(p.card.id);
                                        const cancelled = t.cancelIds.includes(p.card.id);
                                        return (
                                            <div className={`ht-card ${taken ? 'ht-taken' : 'ht-discard'}`} key={i}>
                                                {treatCard(p.card, { width: 40 })}
                                                <span className="ht-card-name" style={{ color: this.accent(p.playerId) }}>{this.name(p.playerId)}</span>
                                                {taken && <span className={`ht-flag ${cancelled ? 'pop' : ''}`}>{cancelled ? 'twin' : 'taken'}</span>}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        );
    }

    public render() {
        const mp = this.props.MP;
        const myId = mp.clientId;
        const { gameStatus, round, currentPlayerId, resolvingTrick, leadSuit, trickNumber, totalTricks } = this.props;
        const isMyTurn = gameStatus === Phase.Play && !resolvingTrick && currentPlayerId === myId;

        let controls: React.ReactNode = null;
        if (gameStatus === Phase.RoundEnd) controls = this.renderRoundEnd();
        else if (gameStatus === Phase.GameOver) controls = this.renderGameOver();

        const playing = gameStatus === Phase.Play;
        const shownLead = resolvingTrick ? resolvingTrick.leadSuit : leadSuit;

        const arena = (
            <div className="sf-arena sf-root">
                <div className="arena-topline">
                    <span className="round-pill">Round {round + 1}</span>
                    {playing && <span className="round-pill">Trick {resolvingTrick ? resolvingTrick.trickNumber : trickNumber} / {totalTricks}</span>}
                    <span className="phase-pill">{playing ? 'Second best wins' : gameStatus === Phase.RoundEnd ? 'Scoring' : 'Game Over'}</span>
                </div>

                {controls}

                {playing && (
                    <React.Fragment>
                        <div className="section-label sf-trick-label">
                            Current Trick {leadTag(shownLead)}
                        </div>
                        <div className="trick-zone">{this.renderTrick()}</div>
                        {this.renderPlayControls(myId)}
                    </React.Fragment>
                )}

                <div className="section-label">Picnic Table</div>
                {this.renderPlayers()}
            </div>
        );

        const links: any = {
            'home': { 'icon': 'gamepad', 'label': 'Picnic', 'view': arena },
            'history': { 'icon': 'history', 'label': 'History', 'view': this.renderHistory() },
            'rules': { 'icon': 'book', 'label': 'Rules', 'view': <SchadenfreudeRulesView players={this.props.numPlayers} /> }
        };

        if (this.props.isHost) {
            links['settings'] = {
                'icon': 'cogs',
                'label': 'Settings',
                'view': (
                    <div className="settings-panel sf-root">
                        <button className="primary-btn" onClick={() => mp.restartGame()}>Restart Game</button>
                        <button className="ghost-btn" onClick={() => mp.backToLobby()}>Back to Lobby</button>
                    </div>
                )
            };
        }

        return mp.getPluginView('gameshell', 'HostShell-Main', {
            'links': links,
            'gameName': GAME_NAME,
            'topBarContent': this.topBar(myId),
            'roomClassName': isMyTurn ? 'attention-bg' : '',
            'toastNotification': this.props.toastNotification
        });
    }

    private topBar(myId: string): string {
        const { gameStatus, currentPlayerId, publicPlayers } = this.props;
        const me = publicPlayers[myId];
        const tummy = me ? `Tummy ${me.score}/${BUST_LIMIT}` : '';
        if (gameStatus === Phase.GameOver) return this.props.winnerId === myId ? 'Victory' : 'Game Over';
        if (gameStatus === Phase.RoundEnd) return `Scoring · ${tummy}`;
        if (this.props.resolvingTrick) return 'Clearing trick…';
        if (currentPlayerId === myId) return `Your Turn · ${tummy}`;
        return `${this.name(currentPlayerId)}'s turn`;
    }
}
