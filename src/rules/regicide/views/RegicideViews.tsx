/**
 * RegicideViews.tsx - React components for "Regicide".
 */

import * as React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ViewPropsInterface } from '../../../common/interfaces';
import { icons as LOBBY_ICONS } from '../../lobby/LobbyView';
import {
    Phase, Card, Suit, EnemyType, AttackEvent, HitEvent,
    attackValue, isJester, cardLabel,
    SUIT_NAME, SUIT_POWER
} from '../RegicideGameState';
import { PlayingCard } from '../../../client/lib/card-renderer/PlayingCard';
import { ExpressiveIcon } from '../../../client/lib/card-renderer/IconEngine';
import {
    REGICIDE_ICONS,
    getRegicideCardDefinition,
    getEnemyCardDefinition,
    suitStyle,
    suitFill
} from '../RegicideAssets';

import PlaySound from '../../../sounds/softnotification.mp3';
import DefeatSound from '../../../sounds/coin_many.mp3';
import DamageSound from '../../../sounds/scratch.mp3';
import SwordSound from '../../../sounds/sword-swing.mp3';
import WinSound from '../../../sounds/connected.mp3';
import LoseSound from '../../../sounds/microwave_bell.mp3';

// Fire-and-forget SFX, guarded for non-browser (test) contexts.
function playSound(src: string) {
    if (typeof Audio === 'undefined' || !src) return;
    try {
        const audio = new Audio(src);
        const p = audio.play();
        if (p && typeof p.catch === 'function') p.catch(() => { /* blocked until interaction */ });
    } catch (e) { /* ignore */ }
}

interface EnemyView {
    card: Card;
    type: EnemyType;
    suit: Suit;
    attack: number;
    health: number;
    damage: number;
    shield: number;
    effectiveAttack: number;
    immunityCancelled: boolean;
}

interface PublicPlayer {
    handCount: number;
    lastAction: 'played' | 'yielded' | null;
}

interface LastMove {
    playerId: string;
    desc: string;
    moveId: number;
    kind: string;
}

interface RegicideProps extends ViewPropsInterface {
    gameStatus: Phase;
    numPlayers: number;
    solo: boolean;
    maxHandSize: number;
    playerOrder: string[];
    currentPlayerId: string;
    enemy: EnemyView | null;
    playedCards: Card[];
    tavernCount: number;
    discardCount: number;
    castleCount: number;
    enemiesDefeated: number;
    publicPlayers: Record<string, PublicPlayer>;
    pendingDamage: { playerId: string; amount: number } | null;
    lastHit: HitEvent | null;
    lastAttack: AttackEvent | null;
    awaitingJesterChoice: { playerId: string } | null;
    soloJestersRemaining: number;
    jestersUsed: number;
    winTier: 'gold' | 'silver' | 'bronze' | null;
    loseReason: string | null;
    lastMove: LastMove | null;
    canYield: boolean;
    playerNames: Record<string, string>;
    playerAccents: Record<string, string>;
    playerIcons: Record<string, number>;
    isHost: boolean;
    myHand: Card[];
}

// ---- small shared vector helpers -------------------------------------------

// A small flat suit glyph in the suit colour (for chips / legends).
function suitChip(suit: Suit, size = '1.2em') {
    const s = suitStyle(suit);
    const palette = { ...(getRegicideCardDefinition({ id: 't', suit, rank: 2 }).palette as any), primary: s.fill };
    return (
        <span className="suit-chip" style={{ width: size, height: size }}>
            <ExpressiveIcon icon={REGICIDE_ICONS[`suit_${suit}`]} palette={palette} />
        </span>
    );
}

// ================================================================================
// Lobby views
// ================================================================================
export class RegicideHostLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;
        const playerCount = mp.playersCount() + 1;
        const ok = playerCount >= 1 && playerCount <= 4;

        const links = {
            'home': {
                'icon': 'home',
                'label': 'Lobby',
                'view': (
                    <div>
                        {mp.getPluginView('lobby', 'SetNameWithLobby')}
                        <div className="regicide-lobby-note">
                            A <strong>cooperative</strong> battle for 1–4 players. Defeat all twelve
                            royals together — {playerCount === 1 ? 'solo run' : `${playerCount} players`}.
                        </div>
                        {!ok && (
                            <p style={{ color: '#e0554f', fontWeight: 700, textAlign: 'center', marginTop: 20 }}>
                                Regicide needs 1 to 4 players. Currently {playerCount}.
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
                'view': <RegicideRulesView numPlayers={playerCount} />
            }
        };

        return mp.getPluginView('gameshell', 'HostShell-Main', {
            'gameName': 'Regicide',
            'links': links
        });
    }
}

export class RegicideClientLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;
        const links = {
            'home': {
                'icon': 'id-card',
                'label': 'Lobby',
                'view': (
                    <div>
                        {mp.getPluginView('lobby', 'SetNameWithLobby')}
                        <div className="regicide-waiting">Waiting for the host to start…</div>
                    </div>
                )
            },
            'rules': {
                'icon': 'book',
                'label': 'Rules',
                'view': <RegicideRulesView />
            }
        };
        return mp.getPluginView('gameshell', 'HostShell-Main', {
            'gameName': 'Regicide',
            'links': links
        });
    }
}

// ================================================================================
// Rules reference
// ================================================================================
export class RegicideRulesView extends React.Component<{ numPlayers?: number }, {}> {
    private suitRow(suit: Suit, when: string, effect: string) {
        return (
            <div className="suit-row" key={suit}>
                {suitChip(suit, '1.5em')}
                <div className="suit-row-text">
                    <div className="suit-row-name">{SUIT_NAME[suit]} — {SUIT_POWER[suit]}</div>
                    <div className="suit-row-desc"><span className="when">{when}</span> {effect}</div>
                </div>
            </div>
        );
    }

    public render() {
        const rows: Array<[number, number, number]> = [
            [1, 0, 8], [2, 0, 7], [3, 1, 6], [4, 2, 5]
        ];
        const current = this.props.numPlayers;
        return (
            <div className="regicide-rules-panel">
                <div className="rules-section">
                    <h3>The Idea</h3>
                    <p>
                        A <strong>cooperative</strong> game. Together, defeat twelve royals in order —
                        four <strong>Jacks</strong>, then four <strong>Queens</strong>, then four
                        <strong> Kings</strong>. Win when the last King falls. Lose the moment anyone
                        cannot survive a royal's attack or take a legal turn.
                    </p>
                </div>

                <div className="rules-section">
                    <h3>Your Turn</h3>
                    <ol>
                        <li><strong>Play</strong> a card, a combo, or an Animal Companion (or yield).</li>
                        <li><strong>Activate</strong> the played suit power(s) at the total value.</li>
                        <li><strong>Deal damage</strong> equal to the value (Clubs double it).</li>
                        <li><strong>Suffer</strong> the royal's attack: discard cards worth at least its
                            attack. Can't cover it → the team loses.</li>
                    </ol>
                    <p className="small">Defeat the royal and you skip the damage and immediately fight the next one.</p>
                </div>

                <div className="rules-section">
                    <h3>Suit Powers</h3>
                    <div className="suit-powers">
                        {this.suitRow('H', 'Immediate.', 'Shuffle the discard; place that many cards under the Tavern deck.')}
                        {this.suitRow('D', 'Immediate.', 'Draw that many cards across the team (skipping full hands).')}
                        {this.suitRow('C', 'On damage.', 'Double the damage dealt this turn.')}
                        {this.suitRow('S', 'On defence.', 'Reduce the royal\'s attack by that much for the rest of the fight.')}
                    </div>
                    <p className="small">
                        Each royal is <strong>immune</strong> to the power of its own suit until a
                        <strong> Jester</strong> cancels it — but the card's value still counts as damage.
                    </p>
                </div>

                <div className="rules-section">
                    <h3>Combos & Companions</h3>
                    <ul>
                        <li><strong>Combo:</strong> 2–4 cards of the same number totalling ≤ 10. Every
                            suit power triggers at the combined value.</li>
                        <li><strong>Animal Companion (Ace):</strong> worth 1. Play alone or pair with one
                            other card, adding 1 to its value (same-suit powers trigger once).</li>
                        <li><strong>Jester:</strong> worth 0, played alone. Cancels the royal's immunity,
                            then you choose who plays next.</li>
                    </ul>
                </div>

                <div className="rules-section">
                    <h3>Cards &amp; Piles</h3>
                    <ul>
                        <li><strong>Your hand</strong> is private. It holds up to the max hand size for the
                            player count (see below) and can never go over it — draws that would overfill
                            are simply skipped.</li>
                        <li><strong>Tavern deck</strong> (face-down draw pile): you draw from the top.
                            Diamonds draw from it; Hearts return cards to its bottom; an exact-kill royal
                            is placed on top of it, so it can be drawn back into a hand later.</li>
                        <li><strong>Discard pile</strong> (face-up): cards you discard to suffer damage go
                            here, as do all cards played against a royal once it is defeated (and the royal
                            itself, unless it was an exact kill). Hearts shuffle this pile to refill the
                            Tavern.</li>
                    </ul>
                    <p className="small">
                        <strong>Empty hand?</strong> That's allowed. You simply have no card to play, so on
                        your turn you must <strong>yield</strong> (if yielding is available) and hope a
                        teammate's Diamonds or Hearts refills you. A drawn-back royal can also return to
                        your hand. You are only in trouble if you can neither play nor yield.
                    </p>
                    <p className="small">
                        Running the Tavern deck dry is <strong>not</strong> a loss — the team just stops
                        drawing, and Hearts do nothing while the discard is empty.
                    </p>
                </div>

                <div className="rules-section highlight">
                    <h3>Winning &amp; Losing</h3>
                    <p><strong>Win</strong> the moment the last King is defeated — all twelve royals down.</p>
                    <p style={{ marginTop: 6 }}><strong>Lose</strong> if any one of these happens:</p>
                    <ul>
                        <li>A player <strong>cannot discard enough</strong> to cover a royal's attack in
                            step 4.</li>
                        <li>A player <strong>cannot play a card and cannot yield</strong> (an empty hand with
                            yielding blocked).</li>
                    </ul>
                    <p className="small">
                        Solo grades the win by Jesters used — <strong>Gold</strong> (0), <strong>Silver</strong>
                        (1), <strong>Bronze</strong> (2) — and never allows yielding.
                    </p>
                </div>

                <div className="rules-section">
                    <h3>Enemy Stats</h3>
                    <div className="enemy-stats-grid">
                        <div className="es-cell head">Royal</div>
                        <div className="es-cell head">Attack</div>
                        <div className="es-cell head">Health</div>
                        <div className="es-cell">Jack</div><div className="es-cell">10</div><div className="es-cell">20</div>
                        <div className="es-cell">Queen</div><div className="es-cell">15</div><div className="es-cell">30</div>
                        <div className="es-cell">King</div><div className="es-cell">20</div><div className="es-cell">40</div>
                    </div>
                </div>

                <div className="rules-section">
                    <h3>Setup by Players</h3>
                    <div className="setup-table-wrap">
                        <table className="setup-table">
                            <thead><tr><th>Players</th><th>Jesters</th><th>Hand size</th></tr></thead>
                            <tbody>
                                {rows.map(([n, j, h]) => (
                                    <tr key={n} className={current === n ? 'setup-current' : ''}>
                                        <td>{n}{current === n ? ' ◂' : ''}</td>
                                        <td>{j}</td>
                                        <td>{h}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="small">
                        Solo play sets both Jesters aside as a “discard &amp; refill” power (usable twice)
                        and never allows yielding.
                    </p>
                </div>
            </div>
        );
    }
}

// ================================================================================
// Main page
// ================================================================================
// Every strike animates in two stages on every client, in both directions:
//   'shake' — the attacker rears up and down (SHAKE_MS)
//   'slash' — a red slash wipes across the target while the attacker's SFX fires
//             (sword swing for a player's blow, scratch for the royal's);
//             concurrently the damage number rises beside the slash, fading in
//             then out over 1s (SLASH_MS covers both)
type AttackStage = 'shake' | 'slash';
const SHAKE_MS = 500;
const SLASH_MS = 1000;
const STRIKE_MS = SHAKE_MS + SLASH_MS;

// A strike is symmetric: the attacker shakes, then a slash + damage number lands
// on the target. `source` says which way the blow travels.
//   'player' — the striking player's panel shakes, the enemy panel is slashed
//   'enemy'  — the enemy card shakes, the struck player's panel is slashed
interface StrikeAnim {
    key: number;        // the originating event's unique id
    source: 'player' | 'enemy';
    playerId: string;   // the player end of the blow (attacker or target)
    amount: number;
    stage: AttackStage;
}

interface MainState {
    selected: string[];       // cards selected to play
    damageSelected: string[]; // cards selected to discard for damage
    strike: StrikeAnim | null;
}

export class RegicideMainPage extends React.Component<RegicideProps, MainState> {
    private strikeTimers: ReturnType<typeof setTimeout>[] = [];
    // A single play emits BOTH a hit (step 3) and an attack (step 4) in one host
    // tick, so strikes are queued and animated one after another rather than
    // stomping on each other.
    private strikeQueue: StrikeAnim[] = [];
    private strikeRunning = false;

    // Events already animated. Seeded from the incoming props so a client that
    // joins or re-renders mid-fight never replays a strike that already happened.
    private handledHitId: number | null;
    private handledAttackId: number | null;

    constructor(props: RegicideProps) {
        super(props);
        this.state = { selected: [], damageSelected: [], strike: null };
        this.handledHitId = props.lastHit ? props.lastHit.hitId : null;
        this.handledAttackId = props.lastAttack ? props.lastAttack.attackId : null;
    }

    public componentDidUpdate(prev: RegicideProps) {
        const lm = this.props.lastMove;
        const prevId = prev.lastMove ? prev.lastMove.moveId : null;
        if (lm && lm.moveId !== prevId) {
            switch (lm.kind) {
                case 'defeat': playSound(DefeatSound); break;
                case 'win': playSound(WinSound); break;
                case 'lose': playSound(LoseSound); break;
                case 'play': case 'combo': case 'jester':
                case 'heal': case 'draw': case 'refill': playSound(PlaySound); break;
                default: break; // 'damage' is voiced by the slash stage below
            }
            // A new event means the turn context changed — clear local selections.
            this.setState({ selected: [], damageSelected: [] });
        }

        const queued: StrikeAnim[] = [];

        // Step 3 first: the player's blow lands on the enemy.
        const hit = this.props.lastHit;
        if (hit && hit.hitId !== this.handledHitId) {
            this.handledHitId = hit.hitId;
            // A killing blow swaps in the next royal on this same tick, so slashing
            // the enemy panel would slash the wrong card. The defeat cue covers it.
            const defeated = this.props.enemiesDefeated > prev.enemiesDefeated;
            if (!defeated) {
                queued.push({ key: hit.hitId, source: 'player', playerId: hit.playerId, amount: hit.amount, stage: 'shake' });
            }
        }

        // Step 4 second: the enemy strikes back.
        const atk = this.props.lastAttack;
        if (atk && atk.attackId !== this.handledAttackId) {
            this.handledAttackId = atk.attackId;
            queued.push({ key: atk.attackId, source: 'enemy', playerId: atk.playerId, amount: atk.amount, stage: 'shake' });
        }

        if (queued.length > 0) {
            this.strikeQueue.push(...queued);
            if (!this.strikeRunning) this.runNextStrike();
        }
    }

    public componentWillUnmount() {
        this.clearStrikeTimers();
    }

    private clearStrikeTimers() {
        this.strikeTimers.forEach(t => clearTimeout(t));
        this.strikeTimers = [];
    }

    private runNextStrike() {
        const next = this.strikeQueue.shift();
        if (!next) {
            this.strikeRunning = false;
            this.setState({ strike: null });
            return;
        }
        this.strikeRunning = true;
        this.clearStrikeTimers();
        this.setState({ strike: next });

        this.strikeTimers.push(setTimeout(() => {
            // The blow is voiced by whoever threw it, fired with the slash.
            playSound(next.source === 'player' ? SwordSound : DamageSound);
            this.setState(st => (st.strike ? { ...st, strike: { ...st.strike, stage: 'slash' } } : null));
        }, SHAKE_MS));

        this.strikeTimers.push(setTimeout(() => this.runNextStrike(), STRIKE_MS));
    }

    // ---- which element is shaking / being slashed right now ----
    private enemyShaking(): boolean {
        const s = this.state.strike;
        return !!s && s.source === 'enemy' && s.stage === 'shake';
    }
    private enemySlashed(): StrikeAnim | null {
        const s = this.state.strike;
        return s && s.source === 'player' && s.stage === 'slash' ? s : null;
    }
    private playerShaking(id: string): boolean {
        const s = this.state.strike;
        return !!s && s.source === 'player' && s.playerId === id && s.stage === 'shake';
    }
    private playerSlashed(id: string): StrikeAnim | null {
        const s = this.state.strike;
        return s && s.source === 'enemy' && s.playerId === id && s.stage === 'slash' ? s : null;
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

    private amCurrent(): boolean {
        return this.props.currentPlayerId === this.props.MP.clientId &&
            this.props.gameStatus === Phase.Play;
    }
    private myPendingDamage(): boolean {
        const pd = this.props.pendingDamage;
        return !!pd && pd.playerId === this.props.MP.clientId;
    }
    private myJesterChoice(): boolean {
        const jc = this.props.awaitingJesterChoice;
        return !!jc && jc.playerId === this.props.MP.clientId;
    }

    // ---- card selection ----
    private toggleSelect(id: string) {
        this.setState(st => ({
            selected: st.selected.includes(id)
                ? st.selected.filter(c => c !== id)
                : [...st.selected, id]
        }));
    }
    private toggleDamage(id: string) {
        this.setState(st => ({
            damageSelected: st.damageSelected.includes(id)
                ? st.damageSelected.filter(c => c !== id)
                : [...st.damageSelected, id]
        }));
    }

    // ---- actions ----
    private doPlay() {
        const cards = this.selectedCards();
        if (cards.length === 0) return;
        // A lone Jester routes to the Jester power.
        if (cards.length === 1 && isJester(cards[0])) {
            this.props.MP.playJester(cards[0].id);
            return;
        }
        this.props.MP.playCards(cards.map(c => c.id));
    }
    private doYield() {
        this.props.MP.yieldTurn();
    }
    private doRefill() {
        this.props.MP.soloRefill();
    }
    private doDiscard() {
        this.props.MP.discardForDamage(this.state.damageSelected);
    }
    private doChooseNext(id: string) {
        this.props.MP.chooseNext(id);
    }

    private selectedCards(): Card[] {
        return this.state.selected
            .map(id => this.props.myHand.find(c => c.id === id))
            .filter((c): c is Card => !!c);
    }

    // ================================================================
    // Enemy panel
    // ================================================================
    private renderEnemy() {
        const e = this.props.enemy;
        if (!e) return null;
        // Remaining health, not damage taken: the bar drains as the royal is worn down.
        const remaining = Math.max(0, e.health - e.damage);
        const pct = Math.max(0, Math.min(100, (remaining / e.health) * 100));
        const s = suitStyle(e.suit);
        const typeLabel = e.type.charAt(0).toUpperCase() + e.type.slice(1);

        const shaking = this.enemyShaking();
        const slashed = this.enemySlashed();

        return (
            <div className={`enemy-panel ${slashed ? 'struck' : ''}`} style={{ borderColor: s.fill }}>
                {/* The slash is anchored to the card itself so it sweeps the whole
                    royal, rather than being clipped by the wide panel. */}
                <div className={`enemy-card ${shaking ? 'striking' : ''}`}>
                    <PlayingCard
                        card={getEnemyCardDefinition(e.card, e.type)}
                        customIcons={REGICIDE_ICONS}
                        width={92}
                    />
                    {slashed && (
                        <React.Fragment>
                            <div className="attack-slash" aria-hidden="true" />
                            <div className="attack-damage">-{slashed.amount}</div>
                        </React.Fragment>
                    )}
                </div>
                <div className="enemy-info">
                    <div className="enemy-title">
                        <span className="enemy-name">{typeLabel} of {SUIT_NAME[e.suit]}</span>
                        {suitChip(e.suit, '1.3em')}
                    </div>

                    <div className="enemy-hp">
                        <div className="hp-bar">
                            <div className="hp-fill" style={{ width: `${pct}%`, background: s.fill }} />
                            <span className="hp-text">{remaining} / {e.health} HP</span>
                        </div>
                    </div>

                    <div className="enemy-stats">
                        <div className="es-stat">
                            <span className="es-label">Attack</span>
                            <span className="es-value">
                                {e.effectiveAttack}
                                {e.shield > 0 && <span className="es-base"> ({e.attack}−{e.shield})</span>}
                            </span>
                        </div>
                        <div className="es-stat">
                            <span className="es-label">Shield</span>
                            <span className="es-value">{e.shield}</span>
                        </div>
                    </div>

                    <div className={`enemy-immunity ${e.immunityCancelled ? 'cancelled' : ''}`}>
                        {e.immunityCancelled
                            ? <span>Immunity cancelled</span>
                            : <span>Immune: {SUIT_NAME[e.suit]} ({SUIT_POWER[e.suit]})</span>}
                    </div>
                </div>
            </div>
        );
    }

    // ================================================================
    // Castle progress + decks
    // ================================================================
    private renderStatusStrip() {
        const defeated = this.props.enemiesDefeated;
        const pips = Array.from({ length: 12 }, (_, i) => i);
        return (
            <div className="status-strip">
                <div className="castle-progress">
                    {pips.map(i => {
                        const tier = i < 4 ? 'jack' : i < 8 ? 'queen' : 'king';
                        return <span key={i} className={`castle-pip ${tier} ${i < defeated ? 'done' : ''}`} />;
                    })}
                    <span className="castle-count">{defeated} / 12</span>
                </div>
                <div className="deck-counts">
                    <span className="deck-count" title="Tavern deck">🂠 {this.props.tavernCount}</span>
                    <span className="deck-count" title="Discard pile">♺ {this.props.discardCount}</span>
                </div>
            </div>
        );
    }

    // ================================================================
    // Played cards this fight
    // ================================================================
    private renderPlayed() {
        const played = this.props.playedCards;
        if (!played || played.length === 0) {
            return <div className="played-cards empty-note">No cards played against this royal yet.</div>;
        }
        return (
            <div className="played-cards">
                {played.map((c, i) => (
                    <div className="mini-card" key={`${c.id}-${i}`}>
                        <PlayingCard card={getRegicideCardDefinition(c)} customIcons={REGICIDE_ICONS} width={44} />
                    </div>
                ))}
            </div>
        );
    }

    // ================================================================
    // Player panels
    // ================================================================
    private renderPlayers() {
        const { playerOrder, publicPlayers, currentPlayerId, gameStatus } = this.props;
        return (
            <div className="player-panels">
                {playerOrder.map(id => {
                    const p = publicPlayers[id];
                    if (!p) return null;
                    const isCurrent = id === currentPlayerId && gameStatus === Phase.Play;
                    const isMe = id === this.props.MP.clientId;
                    const struck = this.playerSlashed(id);
                    const shaking = this.playerShaking(id);
                    const cls = [
                        'player-panel',
                        isCurrent ? 'current' : '',
                        isMe ? 'me' : '',
                        struck ? 'struck' : '',
                        shaking ? 'striking' : ''
                    ].filter(Boolean).join(' ');
                    return (
                        <div className={cls} key={id}>
                            {struck && (
                                <React.Fragment>
                                    <div className="attack-slash" aria-hidden="true" />
                                    <div className="attack-damage">-{struck.amount}</div>
                                </React.Fragment>
                            )}
                            <div className="pp-head">
                                {this.badge(id)}
                                <span className="pp-name">{this.name(id)}{isMe ? ' (you)' : ''}</span>
                                {isCurrent && <span className="pp-badge">turn</span>}
                            </div>
                            <div className="pp-stats">
                                <span className="pp-stat" title="Cards in hand">🂠 {p.handCount}</span>
                                {p.lastAction === 'yielded' && <span className="pp-yielded">yielded</span>}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    // ================================================================
    // Your hand + actions
    // ================================================================
    private renderHand() {
        const { myHand } = this.props;
        const damageMode = this.myPendingDamage();
        const selectable = (this.amCurrent() && !this.props.pendingDamage && !this.props.awaitingJesterChoice) || damageMode;

        if (!myHand || myHand.length === 0) {
            return <div className="regicide-hand empty-note">Your hand is empty.</div>;
        }

        return (
            <div className="regicide-hand">
                {myHand.map((c) => {
                    const sel = damageMode
                        ? this.state.damageSelected.includes(c.id)
                        : this.state.selected.includes(c.id);
                    return (
                        <div className="hand-card" key={c.id}>
                            <PlayingCard
                                card={getRegicideCardDefinition(c)}
                                customIcons={REGICIDE_ICONS}
                                width={60}
                                selectable={selectable}
                                selected={sel}
                                hoverable={selectable}
                                onClick={selectable
                                    ? () => (damageMode ? this.toggleDamage(c.id) : this.toggleSelect(c.id))
                                    : undefined}
                            />
                        </div>
                    );
                })}
            </div>
        );
    }

    private renderActionBar() {
        // Priority: game over > jester choice > suffer damage > my turn > waiting.
        if (this.props.gameStatus === Phase.Won || this.props.gameStatus === Phase.Lost) {
            return null;
        }
        if (this.myJesterChoice()) return this.renderJesterChoice();
        if (this.props.pendingDamage) return this.renderDamageBar();
        if (this.amCurrent()) return this.renderTurnBar();
        return (
            <div className="action-bar waiting">
                Waiting for {this.name(this.props.currentPlayerId)}…
            </div>
        );
    }

    private renderTurnBar() {
        const cards = this.selectedCards();
        const value = cards.reduce((s, c) => s + attackValue(c), 0);
        const hasJesterSelected = cards.length === 1 && isJester(cards[0]);
        const canPlay = cards.length > 0;

        return (
            <div className="action-bar turn">
                <div className="ab-info">
                    {cards.length === 0
                        ? <span className="ab-hint">Select a card to play</span>
                        : <span className="ab-value">
                            Selected: <strong>{cards.map(cardLabel).join(' + ')}</strong>
                            {!hasJesterSelected && <> · value <strong>{value}</strong></>}
                        </span>}
                </div>
                <div className="ab-buttons">
                    <button className="primary-btn" disabled={!canPlay} onClick={() => this.doPlay()}>
                        {hasJesterSelected ? 'Play Jester' : 'Play'}
                    </button>
                    {!this.props.solo && (
                        <button className="ghost-btn" disabled={!this.props.canYield} onClick={() => this.doYield()}
                            title={this.props.canYield ? 'Skip your play and suffer damage' : 'Someone must play first'}>
                            Yield
                        </button>
                    )}
                    {this.props.solo && this.props.soloJestersRemaining > 0 && (
                        <button className="jester-btn" onClick={() => this.doRefill()}>
                            Refill ({this.props.soloJestersRemaining})
                        </button>
                    )}
                </div>
            </div>
        );
    }

    private renderDamageBar() {
        const pd = this.props.pendingDamage!;
        if (!this.myPendingDamage()) {
            return (
                <div className="action-bar waiting">
                    {this.name(pd.playerId)} must suffer <strong>{pd.amount}</strong> damage…
                </div>
            );
        }
        const sum = this.state.damageSelected.reduce((s, id) => {
            const c = this.props.myHand.find(h => h.id === id);
            return s + (c ? attackValue(c) : 0);
        }, 0);
        const enough = sum >= pd.amount;
        return (
            <div className="action-bar damage">
                <div className="ab-info">
                    <span className="ab-danger">Suffer {pd.amount} damage</span>
                    <span className="ab-sum">Discarding <strong className={enough ? 'ok' : 'low'}>{sum}</strong> / {pd.amount}</span>
                </div>
                <div className="ab-buttons">
                    <button className="danger-btn" disabled={!enough} onClick={() => this.doDiscard()}>
                        Confirm Discard
                    </button>
                    {this.props.solo && this.props.soloJestersRemaining > 0 && (
                        <button className="jester-btn" onClick={() => this.doRefill()}>
                            Refill ({this.props.soloJestersRemaining})
                        </button>
                    )}
                </div>
            </div>
        );
    }

    private renderJesterChoice() {
        return (
            <div className="action-bar jester-choice">
                <div className="ab-info"><span className="ab-hint">Choose who plays next</span></div>
                <div className="ab-buttons choose">
                    {this.props.playerOrder.map(id => (
                        <button key={id} className="choose-btn" onClick={() => this.doChooseNext(id)}>
                            {this.badge(id, 'choose-dot')}
                            {this.name(id)}{id === this.props.MP.clientId ? ' (you)' : ''}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // ================================================================
    // Game over
    // ================================================================
    private renderGameOver() {
        const won = this.props.gameStatus === Phase.Won;
        const tier = this.props.winTier;
        return (
            <div className={`game-over ${won ? 'won' : 'lost'}`}>
                <div className="go-mark">
                    <ExpressiveIcon
                        icon={REGICIDE_ICONS.crown}
                        palette={{ ...(getEnemyCardDefinition({ id: 'x', suit: 'S', rank: 13 }, 'king').palette as any), primary: won ? '#e0a23e' : '#98a0b3' }}
                    />
                </div>
                <div className="go-title">{won ? 'Victory!' : 'Defeat'}</div>
                <div className="go-reason">
                    {won
                        ? (tier
                            ? `Solo ${tier.toUpperCase()} — ${this.props.jestersUsed} Jester(s) used`
                            : 'All twelve royals have fallen.')
                        : (this.props.loseReason || 'The realm has fallen.')}
                </div>
                <div className="go-progress">Royals defeated: <strong>{this.props.enemiesDefeated} / 12</strong></div>

                {this.props.isHost && (
                    <div className="go-actions">
                        <button className="primary-btn" onClick={() => this.props.MP.restartGame()}>Play Again</button>
                        <button className="ghost-btn" onClick={() => this.props.MP.backToLobby()}>Back to Lobby</button>
                    </div>
                )}
            </div>
        );
    }

    // ================================================================
    public render() {
        const mp = this.props.MP;
        const over = this.props.gameStatus === Phase.Won || this.props.gameStatus === Phase.Lost;

        const arena = (
            <div className="regicide-arena">
                {over ? this.renderGameOver() : (
                    <React.Fragment>
                        {this.renderStatusStrip()}
                        {this.renderEnemy()}

                        <div className="section-label">This Fight</div>
                        {this.renderPlayed()}

                        <div className="section-label">Party</div>
                        {this.renderPlayers()}

                        <div className="action-dock">
                            {this.renderActionBar()}
                        </div>

                        <div className="section-label">Your Hand</div>
                        {this.renderHand()}
                    </React.Fragment>
                )}
            </div>
        );

        const links: any = {
            'home': { 'icon': 'gamepad', 'label': 'Battle', 'view': arena },
            'rules': { 'icon': 'book', 'label': 'Rules', 'view': <RegicideRulesView numPlayers={this.props.numPlayers} /> }
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

        const needsMe = this.amCurrent() || this.myPendingDamage() || this.myJesterChoice();

        return mp.getPluginView('gameshell', 'HostShell-Main', {
            'links': links,
            'gameName': 'Regicide',
            'topBarContent': this.topBar(),
            'roomClassName': needsMe && !over ? 'attention-bg' : ''
        });
    }

    private topBar(): string {
        if (this.props.gameStatus === Phase.Won) return 'Victory';
        if (this.props.gameStatus === Phase.Lost) return 'Defeat';
        if (this.myPendingDamage()) return 'Suffer Damage';
        if (this.myJesterChoice()) return 'Choose Next';
        if (this.amCurrent()) return 'Your Turn';
        const e = this.props.enemy;
        return e ? `${e.type.toUpperCase()} of ${SUIT_NAME[e.suit]}` : 'Regicide';
    }
}
