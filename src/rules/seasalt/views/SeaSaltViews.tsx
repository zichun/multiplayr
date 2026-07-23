/**
 * SeaSaltViews.tsx - React components for "Sea Salt & Paper".
 */

import * as React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ViewPropsInterface } from '../../../common/interfaces';
import { icons as LOBBY_ICONS } from '../../lobby/LobbyView';
import { PlayingCard } from '../../../client/lib/card-renderer/PlayingCard';
import {
    SEASALT_ICONS,
    getSeaSaltCardDefinition,
    sortSeaSaltHand,
    HandSortMode,
    TYPE_INFO,
    TYPE_COUNT,
    COLOR_COUNT,
    SEASALT_DECK_COMPOSITION,
    SEASALT_COLOR_LABEL,
    COLOR_SORT_ORDER,
    seaSaltBgHex,
    seaSaltInkHex,
    SeaSaltType,
    SeaSaltColor
} from '../SeaSaltAssets';
import { Card, Phase, TurnPhase, PileId, isDuoPair, ScoreBreakdown, RoundResult, PendingEffect, LastMove } from '../SeaSaltGameState';

import DrawSound from '../../../sounds/softnotification.mp3';
import DuoSound from '../../../sounds/coin_many.mp3';
import WinSound from '../../../sounds/connected.mp3';

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
    tableau: Card[];
    score: number;
    revealed: boolean;
    revealedHand: Card[] | null;
}

interface SharedZones {
    deckCount: number;
    discardTop: { A: Card | null; B: Card | null };
    discardCount: { A: number; B: number };
}

interface MyActions {
    canDrawDeck: boolean;
    canTakeA: boolean;
    canTakeB: boolean;
    canEndRound: boolean;
    pending: PendingEffect | null;
    turnPhase: TurnPhase;
}

interface SeaSaltProps extends ViewPropsInterface {
    gameStatus: Phase;
    turnPhase: TurnPhase;
    playerOrder: string[];
    currentPlayerId: string;
    roundNumber: number;
    threshold: number;
    publicPlayers: Record<string, PublicPlayer>;
    shared: SharedZones;
    lastChance: { declarerId: string; declarerCardPoints: number; remaining: string[] } | null;
    roundResult: RoundResult | null;
    winnerId: string | null;
    winReason: 'mermaids' | 'threshold' | null;
    lastMove: LastMove | null;
    playerNames: Record<string, string>;
    playerAccents: Record<string, string>;
    playerIcons: Record<string, number>;
    isHost: boolean;
    myHand: Card[];
    myScore: ScoreBreakdown;
    myActions: MyActions;
    drawnPair: Card[] | null;
    crabPiles: { A: Card[]; B: Card[] } | null;
    pendingEffect: PendingEffect | null;
}

// A rendered Sea Salt card. `setCount` highlights the reached collector threshold.
function seaCard(card: Card, opts: {
    width?: number;
    setCount?: number;
    selected?: boolean;
    selectable?: boolean;
    onClick?: () => void;
    faceDown?: boolean;
} = {}) {
    const def = getSeaSaltCardDefinition(card.type, card.color, {
        setCount: opts.setCount,
        withBack: !!opts.faceDown
    });
    return (
        <PlayingCard
            card={def}
            customIcons={SEASALT_ICONS}
            width={opts.width || 78}
            selectable={opts.selectable}
            selected={opts.selected}
            hoverable={opts.selectable && !opts.selected}
            onClick={opts.onClick}
            isFlipped={opts.faceDown}
            selectedStyle="outline"
        />
    );
}

// A face-down card back (deck / opponent hand).
function backCard(width = 78) {
    const def = getSeaSaltCardDefinition('fish', 'blue', { withBack: true });
    return <PlayingCard card={def} customIcons={SEASALT_ICONS} width={width} isFlipped={true} />;
}

// ================================================================================
// Lobby views
// ================================================================================
export class SeaSaltHostLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;
        const playerCount = mp.playersCount() + 1;
        const ok = playerCount >= 2 && playerCount <= 4;

        const links = {
            'home': {
                'icon': 'home',
                'label': 'Lobby',
                'view': (
                    <div>
                        {mp.getPluginView('lobby', 'SetNameWithLobby')}
                        {!ok && (
                            <p className="ss-warn">
                                Sea Salt &amp; Paper needs 2 to 4 players. Currently {playerCount}.
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
                'view': <SeaSaltRulesView />
            }
        };

        return mp.getPluginView('gameshell', 'HostShell-Main', {
            'gameName': 'Sea Salt & Paper',
            'links': links
        });
    }
}

export class SeaSaltClientLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;
        const links = {
            'home': {
                'icon': 'id-card',
                'label': 'Lobby',
                'view': (
                    <div>
                        {mp.getPluginView('lobby', 'SetNameWithLobby')}
                        <div className="ss-waiting">Waiting for the host to start…</div>
                    </div>
                )
            },
            'rules': {
                'icon': 'book',
                'label': 'Rules',
                'view': <SeaSaltRulesView />
            }
        };
        return mp.getPluginView('gameshell', 'HostShell-Main', {
            'gameName': 'Sea Salt & Paper',
            'links': links
        });
    }
}

// ================================================================================
// Rules reference
// ================================================================================
// A representative card of a given type (first colour in the deck that has it),
// so the reference shows a legit-looking card face.
function sampleCard(type: SeaSaltType): Card {
    for (const col of COLOR_SORT_ORDER) {
        if (SEASALT_DECK_COMPOSITION[col][type]) return { id: `sample-${type}`, type, color: col };
    }
    return { id: `sample-${type}`, type, color: 'gray' };
}

export class SeaSaltRulesView extends React.Component<{}, {}> {
    // One reference entry: the card illustration(s) + a "×N in the deck" badge + a description.
    private cardEntry(type: SeaSaltType, desc: React.ReactNode, opts: { label?: string; partner?: SeaSaltType } = {}) {
        const wrap = (t: SeaSaltType) => (
            <div className="ss-rule-cardwrap" key={t}>
                {seaCard(sampleCard(t), { width: 66 })}
                <span className="ss-rule-count">×{TYPE_COUNT[t]}</span>
            </div>
        );
        return (
            <div className="ss-rule-entry" key={opts.label || type}>
                <div className="ss-rule-cards">
                    {wrap(type)}
                    {opts.partner && wrap(opts.partner)}
                </div>
                <div className="ss-rule-text">
                    <strong>{opts.label || TYPE_INFO[type].label}</strong>
                    <span>{desc}</span>
                </div>
            </div>
        );
    }

    private thresholdText(type: SeaSaltType): string {
        const t = TYPE_INFO[type].thresholds || [];
        const sets = t.map((_, i) => i + 1).join(' / ');
        return `${sets} cards → ${t.join(' / ')} pts`;
    }

    private multiplierDesc(type: SeaSaltType): string {
        const info = TYPE_INFO[type];
        const target = info.target ? TYPE_INFO[info.target].label : '';
        return `Scores +${info.perTarget} point${(info.perTarget || 0) > 1 ? 's' : ''} for each ${target} card you hold (and never counts itself).`;
    }

    private renderColorBreakdown() {
        return (
            <div className="rules-section">
                <h3>Cards by Colour</h3>
                <div className="ss-color-list">
                    {COLOR_SORT_ORDER.map(col => {
                        const comp = SEASALT_DECK_COMPOSITION[col];
                        const types = Object.keys(comp) as SeaSaltType[];
                        return (
                            <div className="ss-color-row" key={col}>
                                <span className="ss-color-swatch" style={{ background: seaSaltBgHex(col), color: seaSaltInkHex(col) }}>
                                    {COLOR_COUNT[col]}
                                </span>
                                <span className="ss-color-name">{SEASALT_COLOR_LABEL[col]}</span>
                                <span className="ss-color-types">
                                    {types.map(t => `${comp[t]} ${TYPE_INFO[t].label}`).join(', ')}
                                </span>
                            </div>
                        );
                    })}
                </div>
                <p className="ss-color-note">
                    58 cards across 11 colours. Colour only matters for the <strong>colour bonus</strong> (Last Chance)
                    and <strong>mermaid</strong> scoring — never for a card's own type score.
                </p>
            </div>
        );
    }

    public render() {
        return (
            <div className="ss-rules-panel">
                <div className="rules-section">
                    <h3>The Idea</h3>
                    <p>
                        Build a hand over rounds. Each turn <strong>draw</strong> a card, then optionally
                        play <strong>duos</strong> for their effects. Once you hold <strong>≥ 7 points</strong>
                        you may end the round — safely (<strong>Stop</strong>) or by gambling
                        (<strong>Last Chance</strong>).
                    </p>
                </div>

                <div className="rules-section">
                    <h3>Your Turn</h3>
                    <ul>
                        <li><strong>Draw:</strong> reveal 2 from the deck, keep 1 and discard the other onto a
                            pile — or take the top card of a discard pile.</li>
                        <li><strong>Play duos:</strong> lay matched pairs for a one-time effect (below). Each pair
                            is worth 1 point whether played or just held.</li>
                        <li><strong>End the round</strong> if you have 7+ points.</li>
                    </ul>
                </div>

                <div className="rules-section">
                    <h3>Duos <span className="ss-rule-sub">(1 point per pair)</span></h3>
                    <div className="ss-rule-entries">
                        {this.cardEntry('crab', 'Look through one discard pile and take any card into your hand (secretly).')}
                        {this.cardEntry('boat', 'Immediately take another turn.')}
                        {this.cardEntry('fish', 'Draw the top card of the deck into your hand.')}
                        {this.cardEntry('swimmer',
                            'Steal a random card from another player. (One Swimmer + one Shark.)',
                            { label: 'Swimmer + Shark', partner: 'shark' })}
                    </div>
                </div>

                <div className="rules-section">
                    <h3>Collectors <span className="ss-rule-sub">(more per card)</span></h3>
                    <div className="ss-rule-entries">
                        {(['shell', 'octopus', 'penguin', 'sailor'] as SeaSaltType[]).map(t =>
                            this.cardEntry(t, <>The ladder down the card's left edge: <strong>{this.thresholdText(t)}</strong>.</>)
                        )}
                    </div>
                </div>

                <div className="rules-section">
                    <h3>Multipliers <span className="ss-rule-sub">(score off other cards)</span></h3>
                    <div className="ss-rule-entries">
                        {(['lighthouse', 'shoal', 'colony', 'captain'] as SeaSaltType[]).map(t =>
                            this.cardEntry(t, this.multiplierDesc(t))
                        )}
                    </div>
                    <p className="ss-color-note">
                        Multipliers stack with the base cards: e.g. 2 Boats score 1 (duo pair) <em>and</em> feed a
                        Lighthouse for +2 more.
                    </p>
                </div>

                <div className="rules-section highlight">
                    <h3>Mermaids</h3>
                    <div className="ss-rule-entries">
                        {this.cardEntry('mermaid',
                            <>Each mermaid scores <strong>1 point per card of a single colour</strong>. Assign every
                                mermaid a <strong>different</strong> colour — greedily, your most-abundant ones.</>)}
                    </div>
                    <ul className="ss-mermaid-notes">
                        <li>2 mermaids, and your top colours are blue (4 cards) and green (2) → <strong>4 + 2 = 6</strong> points.</li>
                        <li>3 mermaids → your top <strong>three</strong> distinct colours; a colour can't be counted twice.</li>
                        <li>White is a valid colour — a mermaid may be assigned white.</li>
                        <li><strong>Collect all 4 mermaids to win the game instantly.</strong></li>
                    </ul>
                </div>

                <div className="rules-section highlight">
                    <h3>Stop vs Last Chance</h3>
                    <ul>
                        <li><strong>Stop:</strong> everyone scores their card points. No colour bonus.</li>
                        <li><strong>Last Chance:</strong> each opponent takes one more turn, then totals are compared.
                            Win the bet and you add your card points <em>plus</em> a colour bonus; lose it and you keep
                            only the colour bonus.</li>
                    </ul>
                    <p className="ss-colorbonus-note">
                        Colour bonus = 1 point per card of the single colour you hold the most of.
                    </p>
                </div>

                {this.renderColorBreakdown()}
            </div>
        );
    }
}

// ================================================================================
// Main page
// ================================================================================
// A DOM anchor (viewport centre + size) for a fly-card source / target.
interface Anchor { cx: number; cy: number; w: number; h: number; }

// A single animated card flying between two anchors.
interface Flight {
    key: string;
    card: Card | null;   // null → a generic face-down back
    reveal: boolean;     // flip face-up on arrival (the discarded card)
    flipped: boolean;    // current flip state
    fade: boolean;       // shrink + fade to nothing on arrival (card entering a hand)
    from: Anchor;
    to: Anchor;
    w: number;           // render width in px
    started: boolean;    // false = at source, true = travelling to target
}

interface MainState {
    selected: string[]; // card ids selected in my hand (max 2, for a duo)
    keepIndex: number | null; // during draw-choose
    sortMode: HandSortMode;
    flights: Flight[];  // in-flight draw/take animations
}

export class SeaSaltMainPage extends React.Component<SeaSaltProps, MainState> {
    private animTimers: ReturnType<typeof setTimeout>[] = [];

    constructor(props: SeaSaltProps) {
        super(props);
        this.state = { selected: [], keepIndex: null, sortMode: 'type', flights: [] };
    }

    public componentDidUpdate(prev: SeaSaltProps) {
        const lm = this.props.lastMove;
        const prevId = prev.lastMove ? prev.lastMove.moveId : null;
        if (lm && lm.moveId !== prevId) {
            switch (lm.kind) {
                case 'draw': case 'take': playSound(DrawSound); break;
                case 'duo': case 'effect': playSound(DuoSound); break;
                case 'win': playSound(WinSound); break;
                default: break;
            }
            if (lm.animType && typeof document !== 'undefined') {
                this.launchDrawAnimation(lm);
            }
        }
        // Clear stale hand selection when my hand changes size.
        if (prev.myHand.length !== this.props.myHand.length && this.state.selected.length) {
            this.setState({ selected: [] });
        }
    }

    public componentWillUnmount() {
        this.clearAnimTimers();
    }

    private clearAnimTimers() {
        this.animTimers.forEach(t => clearTimeout(t));
        this.animTimers = [];
    }

    // ---- draw / take fly-card animation ----
    private anchor(name: string): Anchor | null {
        if (typeof document === 'undefined') return null;
        const el = document.querySelector(`[data-ss-anchor="${name}"]`) as HTMLElement | null;
        if (!el) return null;
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return null;
        return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, h: r.height };
    }

    private launchDrawAnimation(lm: LastMove) {
        const player = this.anchor(`player-${lm.playerId}`);
        if (!player) return;

        const flights: Flight[] = [];
        if (lm.animType === 'deck') {
            const deck = this.anchor('deck');
            if (!deck) return;
            // The kept card slides face-down into the player's panel, shrinking + fading.
            flights.push({ key: `keep-${lm.moveId}`, card: null, reveal: false, flipped: true, fade: true, from: deck, to: player, w: 78, started: false });
            // The discarded card flies to the chosen pile, then flips to reveal itself.
            if (lm.pile && lm.revealCard) {
                const pile = this.anchor(`pile-${lm.pile}`);
                if (pile) flights.push({ key: `disc-${lm.moveId}`, card: lm.revealCard, reveal: true, flipped: true, fade: false, from: deck, to: pile, w: 84, started: false });
            }
        } else if (lm.animType === 'take' && lm.pile) {
            const pile = this.anchor(`pile-${lm.pile}`);
            if (!pile) return;
            // The taken card slides face-down into the player's panel (the card below stays put).
            flights.push({ key: `take-${lm.moveId}`, card: null, reveal: false, flipped: true, fade: true, from: pile, to: player, w: 82, started: false });
        } else if (lm.animType === 'steal' && lm.fromPlayer) {
            const src = this.anchor(`player-${lm.fromPlayer}`);
            if (!src) return;
            // The stolen card slides face-down from the victim's panel into the thief's panel.
            flights.push({ key: `steal-${lm.moveId}`, card: null, reveal: false, flipped: true, fade: true, from: src, to: player, w: 78, started: false });
        }
        if (!flights.length) return;

        this.clearAnimTimers();
        this.setState({ flights });
        // Kick off travel on the next frame so the transition runs from source → target.
        this.animTimers.push(setTimeout(() => {
            this.setState(s => ({ flights: s.flights.map(f => ({ ...f, started: true })) }));
        }, 40));
        // Reveal the discarded card once it lands.
        this.animTimers.push(setTimeout(() => {
            this.setState(s => ({ flights: s.flights.map(f => (f.reveal ? { ...f, flipped: false } : f)) }));
        }, 820));
        // Clean up.
        this.animTimers.push(setTimeout(() => this.setState({ flights: [] }), 1750));
    }

    private flightCard(f: Flight) {
        const def = getSeaSaltCardDefinition(f.card ? f.card.type : 'fish', f.card ? f.card.color : 'blue', { withBack: true });
        return <PlayingCard card={def} customIcons={SEASALT_ICONS} width={f.w} isFlipped={f.flipped} />;
    }

    private renderFlights() {
        if (!this.state.flights.length) return null;
        return (
            <div className="ss-fly-layer">
                {this.state.flights.map(f => {
                    const c = f.started ? f.to : f.from;
                    const scale = f.started ? (f.fade ? 0.34 : 1) : 1;
                    const opacity = (f.started && f.fade) ? 0 : 1;
                    const h = f.w * 1.4;
                    return (
                        <div
                            key={f.key}
                            className="ss-fly-card"
                            style={{ left: c.cx - f.w / 2, top: c.cy - h / 2, width: f.w, transform: `scale(${scale})`, opacity }}
                        >
                            {this.flightCard(f)}
                        </div>
                    );
                })}
            </div>
        );
    }

    private name(id: string) { return this.props.playerNames[id] || 'Player'; }
    private accent(id: string) { return this.props.playerAccents[id] || '#4a90c2'; }

    private badge(id: string, className = 'ss-dot') {
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

    // ---- hand counting for collector-threshold highlight ----
    private myTypeCount(type: SeaSaltType): number {
        return this.props.myHand.filter(c => c.type === type).length;
    }

    // ---- interactions ----
    private toggleSelect(cardId: string) {
        if (!this.amActive() || this.props.turnPhase !== 'play') return;
        const sel = this.state.selected;
        if (sel.includes(cardId)) {
            this.setState({ selected: sel.filter(id => id !== cardId) });
        } else if (sel.length < 2) {
            this.setState({ selected: [...sel, cardId] });
        } else {
            this.setState({ selected: [sel[1], cardId] });
        }
    }

    private selectedDuo(): [Card, Card] | null {
        if (this.state.selected.length !== 2) return null;
        const [a, b] = this.state.selected.map(id => this.props.myHand.find(c => c.id === id));
        if (a && b && isDuoPair(a, b)) return [a, b];
        return null;
    }

    private playDuo() {
        const duo = this.selectedDuo();
        if (!duo) return;
        this.props.MP.playDuo(duo[0].id, duo[1].id);
        this.setState({ selected: [] });
    }

    // ---- draw / choose ----
    // The draw choice is an INLINE panel (not a blocking overlay) so the player can
    // still see their hand / score below it and switch to the Rules tab while deciding.
    private renderDrawChoice() {
        const pair = this.props.drawnPair;
        if (!pair) return null;
        const keep = this.state.keepIndex;
        const aCount = this.props.shared.discardCount.A;
        const bCount = this.props.shared.discardCount.B;

        return (
            <div className="ss-draw-panel">
                <div className="ss-draw-panel-title">You drew 2 — keep one, discard the other</div>
                <div className="ss-draw-pair">
                    {pair.map((c, i) => (
                        <div
                            key={c.id}
                            className={`ss-draw-card ${keep === i ? 'chosen' : ''}`}
                            onClick={() => this.setState({ keepIndex: i })}
                        >
                            {seaCard(c, { width: 92, selectable: true, selected: keep === i })}
                            <div className="ss-draw-tag">{keep === i ? 'KEEP' : 'tap to keep'}</div>
                        </div>
                    ))}
                </div>
                {keep !== null && (
                    <div className="ss-draw-discard">
                        <div className="ss-draw-hint">Discard the other onto:</div>
                        <div className="ss-pile-choice">
                            <button className="ss-btn primary" onClick={() => this.choose(keep, 'A')}>
                                Pile A <span className="ss-mini">({aCount})</span>
                            </button>
                            <button className="ss-btn primary" onClick={() => this.choose(keep, 'B')}>
                                Pile B <span className="ss-mini">({bCount})</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    private choose(keepIndex: number, pile: PileId) {
        this.props.MP.chooseDrawn(keepIndex, pile);
        this.setState({ keepIndex: null });
    }

    // ---- crab modal ----
    private renderCrab() {
        const piles = this.props.crabPiles;
        if (!piles) return null;
        const renderPile = (label: string, id: PileId, cards: Card[]) => (
            <div className="ss-crab-pile">
                <div className="ss-crab-pile-head">Pile {label} <span className="ss-mini">({cards.length})</span></div>
                <div className="ss-crab-cards">
                    {cards.length === 0 && <div className="ss-empty-note">empty</div>}
                    {cards.map((c, i) => (
                        <div key={c.id} className="ss-crab-card" onClick={() => this.props.MP.resolveCrab(id, i)}>
                            {seaCard(c, { width: 64, selectable: true })}
                        </div>
                    ))}
                </div>
            </div>
        );
        return (
            <div className="ss-modal-overlay">
                <div className="ss-modal wide">
                    <h3>Crab — look and take any one card</h3>
                    <div className="ss-crab-piles">
                        {renderPile('A', 'A', piles.A)}
                        {renderPile('B', 'B', piles.B)}
                    </div>
                </div>
            </div>
        );
    }

    // ---- steal modal ----
    private renderSteal() {
        if (!this.props.pendingEffect || this.props.pendingEffect.kind !== 'steal') return null;
        const targets = this.props.playerOrder.filter(id =>
            id !== this.props.MP.clientId &&
            !this.props.publicPlayers[id].revealed &&
            this.props.publicPlayers[id].handCount > 0);
        return (
            <div className="ss-modal-overlay">
                <div className="ss-modal">
                    <h3>Steal a random card</h3>
                    <div className="ss-steal-targets">
                        {targets.map(id => (
                            <button key={id} className="ss-btn steal" onClick={() => this.props.MP.resolveSteal(id)}>
                                {this.badge(id)} {this.name(id)}
                                <span className="ss-mini">{this.props.publicPlayers[id].handCount} cards</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // ---- shared zone (deck + discards) ----
    private renderSharedZone() {
        const { shared, myActions } = this.props;
        const active = this.amActive();
        const canDraw = active && myActions.canDrawDeck;
        return (
            <div className="ss-shared">
                <div className={`ss-deck ${canDraw ? 'clickable' : ''}`} data-ss-anchor="deck" onClick={canDraw ? () => this.props.MP.drawFromDeck() : undefined}>
                    {shared.deckCount > 0 ? backCard(84) : <div className="ss-deck-empty">empty</div>}
                    <div className="ss-deck-count">Deck · {shared.deckCount}</div>
                    {canDraw && <div className="ss-zone-hint">Draw 2</div>}
                </div>

                {(['A', 'B'] as PileId[]).map(pid => {
                    const topCard = shared.discardTop[pid];
                    const canTake = active && (pid === 'A' ? myActions.canTakeA : myActions.canTakeB);
                    return (
                        <div key={pid} className={`ss-discard ${canTake ? 'clickable' : ''}`} data-ss-anchor={`pile-${pid}`}
                            onClick={canTake ? () => this.props.MP.takeDiscard(pid) : undefined}>
                            {topCard ? seaCard(topCard, { width: 84 }) : <div className="ss-deck-empty">empty</div>}
                            <div className="ss-deck-count">Pile {pid} · {shared.discardCount[pid]}</div>
                            {canTake && <div className="ss-zone-hint">Take</div>}
                        </div>
                    );
                })}
            </div>
        );
    }

    // ---- players ----
    private renderPlayers() {
        const { playerOrder, publicPlayers, currentPlayerId } = this.props;
        return (
            <div className="ss-players">
                {playerOrder.map(id => {
                    const p = publicPlayers[id];
                    const isCurrent = id === currentPlayerId && this.props.gameStatus === Phase.Play;
                    const isMe = id === this.props.MP.clientId;
                    return (
                        <div className={`ss-player ${isCurrent ? 'current' : ''} ${isMe ? 'me' : ''}`} key={id} data-ss-anchor={`player-${id}`}>
                            <div className="ss-player-head">
                                {this.badge(id)}
                                <span className="ss-player-name">{this.name(id)}{isMe ? ' (you)' : ''}</span>
                                <span className="ss-player-score">{p.score}</span>
                                {isCurrent && <span className="ss-turn-pill">turn</span>}
                                {p.revealed && <span className="ss-revealed-pill">revealed</span>}
                            </div>
                            <div className="ss-player-meta">
                                <span className="ss-stat" title="Cards in hand">✋ {p.handCount}</span>
                            </div>
                            {p.tableau.length > 0 && (
                                <div className="ss-tableau">
                                    {p.tableau.map(c => (
                                        <div className="ss-tableau-card" key={c.id}>{seaCard(c, { width: 46 })}</div>
                                    ))}
                                </div>
                            )}
                            {p.revealedHand && p.revealedHand.length > 0 && (
                                <div className="ss-revealed-hand">
                                    {p.revealedHand.map(c => (
                                        <div className="ss-tableau-card" key={c.id}>{seaCard(c, { width: 46 })}</div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    }

    // ---- my hand + score + actions ----
    private renderSortToggle() {
        const set = (m: HandSortMode) => () => this.setState({ sortMode: m });
        return (
            <div className="ss-hand-sort">
                <span className="ss-sort-label">Sort</span>
                <button className={`ss-sort-btn ${this.state.sortMode === 'type' ? 'active' : ''}`} onClick={set('type')}>
                    By Type
                </button>
                <button className={`ss-sort-btn ${this.state.sortMode === 'color' ? 'active' : ''}`} onClick={set('color')}>
                    By Colour
                </button>
            </div>
        );
    }

    private renderMyHand() {
        const { myHand } = this.props;
        const active = this.amActive();
        const canPlay = active && this.props.turnPhase === 'play';
        const duo = this.selectedDuo();
        if (!myHand || myHand.length === 0) {
            return <div className="ss-hand empty-note">Your hand is empty.</div>;
        }
        const hand = sortSeaSaltHand(myHand, this.state.sortMode);
        return (
            <div className="ss-hand">
                {hand.map(c => {
                    const info = TYPE_INFO[c.type];
                    const setCount = info.category === 'collector' ? this.myTypeCount(c.type) : undefined;
                    const selected = this.state.selected.includes(c.id);
                    return (
                        <div className="ss-hand-card" key={c.id}>
                            {seaCard(c, {
                                width: 82,
                                setCount,
                                selectable: canPlay,
                                selected,
                                onClick: () => this.toggleSelect(c.id)
                            })}
                        </div>
                    );
                })}
                {canPlay && this.state.selected.length === 2 && (
                    <div className="ss-hand-play">
                        <button className="ss-btn primary" disabled={!duo} onClick={() => this.playDuo()}>
                            {duo ? 'Play Duo' : 'Not a matching duo'}
                        </button>
                    </div>
                )}
            </div>
        );
    }

    private renderScorePanel() {
        const s = this.props.myScore;
        const gate = s.cardPoints >= 7;
        return (
            <div className={`ss-score-panel ${gate ? 'gate-open' : ''}`}>
                <div className="ss-score-total">
                    <span className="ss-score-num">{s.cardPoints}</span>
                    <span className="ss-score-lbl">your points</span>
                </div>
                <div className="ss-score-break">
                    <span title="Duo pairs">◆ {s.duos}</span>
                    <span title="Collectors">▤ {s.collectors}</span>
                    <span title="Multipliers">✕ {s.multipliers}</span>
                    <span title="Mermaids">★ {s.mermaids}</span>
                    <span title="Colour bonus (Last Chance only)">✦ {s.colorBonus}</span>
                </div>
                <div className="ss-gate-hint">
                    {gate ? 'You can end the round.' : `${7 - s.cardPoints} more to end the round.`}
                </div>
            </div>
        );
    }

    private renderActionBar() {
        if (!this.amActive()) return null;
        const { myActions, turnPhase } = this.props;
        if (turnPhase !== 'play') return null;
        return (
            <div className="ss-actionbar">
                <button className="ss-btn" onClick={() => this.props.MP.passTurn()}>End turn</button>
                <button className="ss-btn stop" disabled={!myActions.canEndRound} onClick={() => this.props.MP.declareStop()}>
                    Stop
                </button>
                <button className="ss-btn lastchance" disabled={!myActions.canEndRound} onClick={() => this.props.MP.declareLastChance()}>
                    Last Chance
                </button>
            </div>
        );
    }

    private turnBanner() {
        const { gameStatus, currentPlayerId, lastChance } = this.props;
        if (gameStatus !== Phase.Play) return null;
        const active = this.amActive();
        let msg: string;
        if (lastChance) {
            msg = active ? 'Your final turn (Last Chance)!' : `${this.name(currentPlayerId)}'s final turn`;
        } else {
            msg = active ? 'Your turn' : `${this.name(currentPlayerId)}'s turn`;
        }
        const phaseHint = active
            ? (this.props.turnPhase === 'draw' ? ' — draw a card' :
                this.props.turnPhase === 'play' ? ' — play duos or end your turn' : '')
            : '';
        return (
            <div className={`ss-banner ${active ? 'mine' : ''} ${lastChance ? 'lc' : ''}`}>
                {msg}{phaseHint}
            </div>
        );
    }

    // ---- round end & game over ----
    private renderRoundEnd() {
        const rr = this.props.roundResult;
        if (!rr) return null;
        const title = (() => {
            switch (rr.kind) {
                case 'stop': return `${this.name(rr.endedBy)} called Stop`;
                case 'last_chance_won': return `${this.name(rr.endedBy)} won the Last Chance!`;
                case 'last_chance_lost': return `${this.name(rr.endedBy)} lost the Last Chance`;
                case 'exhausted': return 'Deck emptied — no scoring this round';
            }
        })();
        const sorted = [...rr.results].sort((a, b) => b.total - a.total);
        return (
            <div className="ss-roundend">
                <div className="ss-roundend-title">{title}</div>
                <table className="ss-score-table">
                    <thead>
                        <tr><th>Player</th><th>Card pts</th><th>Bonus</th><th>+ Round</th><th>Total</th></tr>
                    </thead>
                    <tbody>
                        {sorted.map(r => (
                            <tr key={r.playerId} className={r.playerId === rr.endedBy ? 'ender' : ''}>
                                <td>{this.badge(r.playerId)} {this.name(r.playerId)}</td>
                                <td>{r.breakdown.cardPoints}</td>
                                <td>{r.breakdown.colorBonus}</td>
                                <td className="gain">+{r.gained}</td>
                                <td className="total">{r.total}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="ss-threshold-note">First to {this.props.threshold} points wins the game.</div>
                {this.props.isHost && (
                    <button className="ss-btn primary" onClick={() => this.props.MP.nextRound()}>Next Round</button>
                )}
                {!this.props.isHost && <div className="ss-wait-host">Waiting for the host to deal the next round…</div>}
            </div>
        );
    }

    private renderGameOver() {
        const { winnerId, winReason, publicPlayers, playerOrder, isHost } = this.props;
        const sorted = [...playerOrder].sort((a, b) => publicPlayers[b].score - publicPlayers[a].score);
        const reason = winReason === 'mermaids'
            ? 'collected all four mermaids — instant win!'
            : `crossed ${this.props.threshold} points`;
        return (
            <div className="ss-gameover">
                <div className="ss-go-title">{winnerId ? `${this.name(winnerId)} wins!` : 'Game Over'}</div>
                <div className="ss-go-reason">{winnerId ? `${this.name(winnerId)} ${reason}` : ''}</div>
                <table className="ss-score-table">
                    <thead><tr><th>#</th><th>Player</th><th>Score</th></tr></thead>
                    <tbody>
                        {sorted.map((id, i) => (
                            <tr key={id} className={id === winnerId ? 'winner-row' : ''}>
                                <td>{i === 0 ? '🏆' : i + 1}</td>
                                <td>{this.badge(id)} {this.name(id)}</td>
                                <td className="total">{publicPlayers[id].score}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {isHost && (
                    <div className="ss-go-actions">
                        <button className="ss-btn primary" onClick={() => this.props.MP.restartGame()}>Play Again</button>
                        <button className="ss-btn" onClick={() => this.props.MP.backToLobby()}>Back to Lobby</button>
                    </div>
                )}
            </div>
        );
    }

    public render() {
        const mp = this.props.MP;
        const { gameStatus } = this.props;
        const over = gameStatus === Phase.GameOver || !!this.props.winnerId;
        const roundEnd = gameStatus === Phase.RoundEnd;

        const arena = (
            <div className="ss-arena">
                {this.turnBanner()}

                {over ? this.renderGameOver() : roundEnd ? this.renderRoundEnd() : (
                    <React.Fragment>
                        {this.renderDrawChoice()}

                        <div className="ss-section-label">Table</div>
                        {this.renderSharedZone()}

                        <div className="ss-section-label">Players</div>
                        {this.renderPlayers()}

                        <div className="ss-hand-header">
                            <span className="ss-section-label">Your Hand</span>
                            {this.props.myHand && this.props.myHand.length > 1 && this.renderSortToggle()}
                        </div>
                        {this.renderScorePanel()}
                        {this.renderMyHand()}
                        {this.renderActionBar()}

                        {this.renderCrab()}
                        {this.renderSteal()}
                    </React.Fragment>
                )}
                {this.renderFlights()}
            </div>
        );

        const links: any = {
            'home': { 'icon': 'gamepad', 'label': 'Arena', 'view': arena },
            'rules': { 'icon': 'book', 'label': 'Rules', 'view': <SeaSaltRulesView /> }
        };
        if (this.props.isHost) {
            links['settings'] = {
                'icon': 'cogs',
                'label': 'Settings',
                'view': (
                    <div className="ss-settings">
                        <button className="ss-btn primary" onClick={() => mp.restartGame()}>Restart Game</button>
                        <button className="ss-btn" onClick={() => mp.backToLobby()}>Back to Lobby</button>
                    </div>
                )
            };
        }

        return mp.getPluginView('gameshell', 'HostShell-Main', {
            'links': links,
            'gameName': `Round ${this.props.roundNumber}`,
            'topBarContent': this.topBar(),
            'roomClassName': this.amActive() ? 'attention-bg' : ''
        });
    }

    private topBar(): string {
        if (this.props.gameStatus === Phase.GameOver || this.props.winnerId) {
            return this.props.winnerId === this.props.MP.clientId ? 'Victory' : 'Game Over';
        }
        if (this.amActive()) return `Your Turn · ${this.props.myScore.cardPoints} pts`;
        return `${this.name(this.props.currentPlayerId)}'s turn`;
    }
}
