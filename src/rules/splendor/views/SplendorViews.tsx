/**
 * SplendorViews.tsx - React components for Splendor (2-4 players).
 */

import * as React from 'react';
import { ViewPropsInterface } from '../../../common/interfaces';
import {
    GameStatus, Card, Noble, GemColor, TokenColor, GEM_COLORS, TOKEN_COLORS, gemName
} from '../SplendorGameState';
import { PlayingCard } from '../../../client/lib/card-renderer/PlayingCard';
import { ExpressiveIcon } from '../../../client/lib/card-renderer/IconEngine';
import {
    SPLENDOR_ICONS,
    getSplendorCardDefinition,
    getNobleCardDefinition,
    getDeckBackDefinition,
    getSplendorPalette
} from '../SplendorAssets';
import MicrowaveBellSound from '../../../sounds/microwave_bell.mp3';
import CoinFewSound from '../../../sounds/coin_few.mp3';

type PublicPlayer = {
    id: string;
    name: string;
    vp: number;
    bonuses: Record<GemColor, number>;
    tokens: Record<TokenColor, number>;
    tokenCount: number;
    cards: Card[];
    nobles: Noble[];
    reservedCount: number;
};

// A shared inline vector glyph. Sizing is controlled via the `.spl-icon` class in
// SCSS unless an explicit `size` is passed. `color` selects the palette so
// palette-keyed fills ('primary'…) resolve; `colorOverride` forces one colour.
function Glyph(props: { iconId: string; size?: string; color?: string | null; colorOverride?: string }) {
    const icon = SPLENDOR_ICONS[props.iconId];
    if (!icon) return null;
    const style: React.CSSProperties = props.size
        ? { width: props.size, height: props.size, display: 'inline-flex', flex: '0 0 auto', alignItems: 'center', justifyContent: 'center', verticalAlign: 'middle' }
        : {};
    return (
        <span className={props.size ? undefined : 'spl-icon'} style={style}>
            <ExpressiveIcon icon={icon} palette={getSplendorPalette(props.color)} colorOverride={props.colorOverride} />
        </span>
    );
}

export const colorName = (color: TokenColor): string => gemName(color);

// ==========================================
// Lobby views
// ==========================================
export class SplendorHostLobby extends React.Component<ViewPropsInterface, {}> {
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
                        <div style={{ marginTop: '25px', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
                            {!ok && (
                                <p style={{ color: '#e01b24', fontWeight: 'bold', fontSize: '0.9em', textAlign: 'center' }}>
                                    Splendor is for 2&ndash;4 players. Currently {playerCount} in the lobby.
                                </p>
                            )}
                        </div>
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
                'view': <SplendorRulesView />
            }
        };

        return mp.getPluginView('gameshell', 'HostShell-Main', { 'gameName': 'Splendor', 'links': links });
    }
}

export class SplendorClientLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;
        const links = {
            'home': {
                'icon': 'id-card',
                'label': 'Lobby',
                'view': (
                    <div>
                        {mp.getPluginView('lobby', 'SetNameWithLobby')}
                        <div style={{
                            backgroundColor: '#fbeec2', color: '#7a5a00', padding: '15px',
                            border: 'none', borderRadius: '12px', fontWeight: 700, textAlign: 'center',
                            marginTop: '20px', textTransform: 'uppercase'
                        }}>
                            Waiting for the host to start&hellip;
                        </div>
                    </div>
                )
            },
            'rules': {
                'icon': 'book',
                'label': 'Rules',
                'view': <SplendorRulesView />
            }
        };
        return mp.getPluginView('gameshell', 'HostShell-Main', { 'gameName': 'Splendor', 'links': links });
    }
}

// ==========================================
// Rules reference
// ==========================================
export class SplendorRulesView extends React.Component<{}, {}> {
    public render() {
        const sampleCard: Card = { id: 'sample', level: 2, bonus: 'blue', pts: 2, cost: { white: 5, black: 2 } };
        const sampleNoble: Noble = { id: 'sample-n', pts: 3, req: { blue: 3, green: 3, red: 3 } };
        const section: React.CSSProperties = { backgroundColor: '#fff', border: '1px solid #e3ddee', boxShadow: 'none', padding: '15px', borderRadius: '12px' };
        return (
            <div className="spl-rules-panel" style={{ padding: '20px', overflowY: 'auto', maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div className="rules-section" style={section}>
                    <h3 style={{ marginTop: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Goal</h3>
                    <p style={{ margin: 0, lineHeight: 1.6 }}>
                        Build an engine of gem cards and be the first to reach <strong>15 prestige points</strong>.
                        When someone hits 15, the round is finished so everyone has taken the same number of turns; then the
                        highest total wins (tiebreak: fewest development cards purchased).
                    </p>
                </div>

                <div className="rules-section" style={section}>
                    <h3 style={{ marginTop: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>On Your Turn</h3>
                    <p style={{ margin: '0 0 10px 0' }}>Perform exactly <strong>one</strong> of these:</p>
                    <ol style={{ paddingLeft: '20px', lineHeight: 1.6, margin: 0 }}>
                        <li><strong>Take 3 gems</strong> of different colours.</li>
                        <li><strong>Take 2 gems</strong> of the same colour &mdash; only if at least <strong>4</strong> of that colour remain in the supply.</li>
                        <li><strong>Reserve a card</strong> (from the board or the top of a deck) and take <strong>1 Gold</strong> (wild). Max 3 reserved.</li>
                        <li><strong>Purchase a card</strong> from the board or your reserve, paying its cost.</li>
                    </ol>
                    <p style={{ margin: '10px 0 0 0', fontStyle: 'italic', color: '#5f5e6a' }}>
                        Gold is never taken with actions 1 or 2 &mdash; only by reserving. You may hold at most <strong>10 tokens</strong>;
                        discard down to 10 at the end of your turn.
                    </p>
                </div>

                <div className="rules-section" style={section}>
                    <h3 style={{ marginTop: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cards & Bonuses</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-start' }}>
                        <div className={`spl-card level-${sampleCard.level}`} style={{ width: '128px', height: '179px', flex: '0 0 auto' }}>
                            <PlayingCard card={getSplendorCardDefinition(sampleCard)} width="128px" customIcons={SPLENDOR_ICONS} />
                        </div>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px', flex: '1 1 240px', minWidth: '220px', lineHeight: 1.4 }}>
                            <li style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <Glyph iconId="star" size="1.7em" />
                                <span><strong>Prestige</strong> (top-left) &mdash; counts toward the 15 to win.</span>
                            </li>
                            <li style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <Glyph iconId="gem_blue_bonus" size="1.8em" color="blue" />
                                <span><strong>Bonus gem</strong> (top-right) &mdash; a permanent discount of that colour on every future purchase.</span>
                            </li>
                            <li style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <span style={{ display: 'inline-flex', gap: '3px' }}>
                                    <Glyph iconId="gem_white_coin" size="1.5em" />
                                    <Glyph iconId="gem_black_coin" size="1.5em" />
                                </span>
                                <span><strong>Cost</strong> (left column) &mdash; matching bonuses reduce it; Gold pays for any colour.</span>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="rules-section" style={section}>
                    <h3 style={{ marginTop: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Nobles</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center' }}>
                        <div className="spl-noble" style={{ width: '120px', height: '120px', flex: '0 0 auto' }}>
                            <PlayingCard card={getNobleCardDefinition(sampleNoble)} width="120px" customIcons={SPLENDOR_ICONS} />
                        </div>
                        <p style={{ flex: '1 1 240px', minWidth: '220px', margin: 0, lineHeight: 1.5 }}>
                            At the end of your turn, if your <strong>card bonuses</strong> meet a noble&rsquo;s requirement, that noble
                            visits you for <strong>3 prestige</strong>. Nobles check owned card bonuses, never tokens. At most one noble
                            per turn.
                        </p>
                    </div>
                </div>
            </div>
        );
    }
}

// ==========================================
// Tableau — every player's purchased cards stacked by colour
// ==========================================
const STACK_ORDER: GemColor[] = ['white', 'blue', 'green', 'red', 'black'];

export class SplendorTableauView extends React.Component<{ players: PublicPlayer[]; myId: string; currentPlayerId: string }, {}> {
    private renderStack(color: GemColor, cards: Card[]) {
        if (cards.length === 0) return null;
        return (
            <div key={color} className="spl-tab-stack">
                <div className="spl-tab-stack-head">
                    <Glyph iconId={`gem_${color}_coin`} size="1.3em" />
                    <span className="spl-stack-bonus">+{cards.length}</span>
                </div>
                <div className="spl-tab-stack-cards">
                    {cards.map((card, i) => (
                        <div key={card.id} className={`spl-card level-${card.level}`} style={{ width: '86px', height: '120px', marginTop: i === 0 ? 0 : '-74px' }}>
                            <PlayingCard card={getSplendorCardDefinition(card)} width="86px" customIcons={SPLENDOR_ICONS} />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    private renderPlayer(p: PublicPlayer) {
        const isYou = p.id === this.props.myId;
        const isActive = p.id === this.props.currentPlayerId;
        const byColor: Record<string, Card[]> = {};
        p.cards.forEach(c => { (byColor[c.bonus] = byColor[c.bonus] || []).push(c); });
        return (
            <div key={p.id} className={`spl-tab-player ${isYou ? 'is-you' : ''} ${isActive ? 'is-active' : ''}`}>
                <div className="spl-tab-head">
                    <span className="spl-tab-name">{p.name}{isYou ? ' (You)' : ''}</span>
                    <span className="spl-tab-badges">
                        <span className="spl-badge spl-prestige"><Glyph iconId="star" size="1.2em" /> {p.vp}</span>
                        <span className="spl-badge spl-cards">{p.cards.length} cards</span>
                        <span className="spl-badge spl-res">{p.reservedCount} reserved</span>
                    </span>
                </div>
                <div className="spl-tab-tokens">
                    {TOKEN_COLORS.map(c => (
                        <span key={c} className="spl-chip"><Glyph iconId={`gem_${c}_coin`} size="1.25em" /> {p.tokens[c] || 0}</span>
                    ))}
                </div>
                {(p.cards.length > 0 || p.nobles.length > 0) ? (
                    <div className="spl-tab-stacks">
                        {STACK_ORDER.map(c => this.renderStack(c, byColor[c] || []))}
                        {p.nobles.length > 0 && (
                            <div className="spl-tab-stack">
                                <div className="spl-tab-stack-head"><Glyph iconId="noble" size="1.3em" /></div>
                                <div className="spl-tab-stack-cards">
                                    {p.nobles.map((n, i) => (
                                        <div key={n.id} className="spl-noble" style={{ width: '84px', height: '84px', marginTop: i === 0 ? 0 : '-56px' }}>
                                            <PlayingCard card={getNobleCardDefinition(n)} width="84px" customIcons={SPLENDOR_ICONS} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <p style={{ fontStyle: 'italic', color: '#a0a0a0', margin: '4px 0 0' }}>No cards purchased yet.</p>
                )}
            </div>
        );
    }

    public render() {
        return <div className="spl-tableau">{this.props.players.map(p => this.renderPlayer(p))}</div>;
    }
}

// ==========================================
// Main page
// ==========================================
interface SplendorProps extends ViewPropsInterface {
    gameStatus: GameStatus;
    actionPhase: string;
    playerIds: string[];
    firstPlayerId: string;
    currentPlayerId: string;
    supply: Record<TokenColor, number>;
    board: { 1: (Card | null)[]; 2: (Card | null)[]; 3: (Card | null)[]; };
    deckSizes: { '1': number; '2': number; '3': number };
    nobles: Noble[];
    pendingNobleIds: string[];
    winnerIds: string[] | null;
    lastMove: any;
    publicPlayers: PublicPlayer[];
    playerNames: Record<string, string>;

    myId: string;
    myTokens: Record<TokenColor, number>;
    myBonuses: Record<GemColor, number>;
    myVp: number;
    myReserved: Card[];
    myTokenCount: number;

    isHost: boolean;
}

interface MainState {
    picked: GemColor[];           // gems picked from the supply for a take action
    discardSelections: TokenColor[];
}

export class SplendorMainPage extends React.Component<SplendorProps, MainState> {
    constructor(props: SplendorProps) {
        super(props);
        this.state = { picked: [], discardSelections: [] };
    }

    private isMyTurn(): boolean {
        return this.props.currentPlayerId === this.props.myId && this.props.gameStatus !== GameStatus.GameOver;
    }

    private canAct(): boolean {
        return this.isMyTurn() && this.props.gameStatus === GameStatus.Active && this.props.actionPhase === 'Normal';
    }

    // --- Token picking (take 3 different / take 2 same) ---
    private isPickedPair(): boolean {
        const p = this.state.picked;
        return p.length === 2 && p[0] === p[1];
    }

    private handlePickToken(color: GemColor) {
        if (!this.canAct()) return;
        const picked = [...this.state.picked];
        const cnt = picked.filter(c => c === color).length;
        const supply = this.props.supply[color] || 0;

        if (this.isPickedPair()) {
            // A take-2 is staged. Tapping that colour removes one; anything else is ignored.
            if (color === picked[0]) this.setState({ picked: [color] });
            return;
        }

        if (cnt === 1) {
            // Second tap of a colour → intent to take 2 (only colour picked, supply >= 4).
            if (picked.length === 1 && supply >= 4) {
                this.setState({ picked: [color, color] });
            } else {
                this.setState({ picked: picked.filter(c => c !== color) }); // toggle off
            }
            return;
        }

        // cnt === 0 → add a new distinct colour (max 3), if any in supply.
        if (supply <= 0) return;
        if (picked.length >= 3) return;
        picked.push(color);
        this.setState({ picked });
    }

    private confirmTake() {
        const mp = this.props.MP;
        const picked = this.state.picked;
        if (picked.length === 0) return;
        if (this.isPickedPair()) {
            mp.take2(picked[0]);
        } else {
            mp.take3(picked);
        }
        this.setState({ picked: [] });
    }

    // --- Discard ---
    private handleDiscardToggle(color: TokenColor) {
        const held = this.props.myTokens[color] || 0;
        const selected = this.state.discardSelections.filter(c => c === color).length;
        if (selected >= held) {
            const idx = this.state.discardSelections.indexOf(color);
            if (idx !== -1) {
                const s = [...this.state.discardSelections];
                s.splice(idx, 1);
                this.setState({ discardSelections: s });
            }
            return;
        }
        this.setState({ discardSelections: [...this.state.discardSelections, color] });
    }

    private removeDiscard(color: TokenColor) {
        const idx = this.state.discardSelections.indexOf(color);
        if (idx !== -1) {
            const s = [...this.state.discardSelections];
            s.splice(idx, 1);
            this.setState({ discardSelections: s });
        }
    }

    // --- Card rendering with buy / reserve affordances ---
    private renderBoardCard(card: Card, canInteract: boolean) {
        const mp = this.props.MP;
        const affordable = this.affordable(card);
        const canReserve = canInteract && this.props.myReserved.length < 3;
        const canBuy = canInteract && affordable;
        return (
            <div key={card.id} className={`spl-card level-${card.level} ${canBuy ? 'is-buyable' : ''}`} style={{ position: 'relative' }}>
                <PlayingCard
                    card={getSplendorCardDefinition(card, this.props.myBonuses, this.props.myTokens)}
                    width="112px"
                    height="156px"
                    customIcons={SPLENDOR_ICONS}
                    hoverable={canInteract}
                />
                {canInteract && (canBuy || canReserve) && (
                    <div className="spl-card-actions">
                        {canReserve && (
                            <button className="spl-card-btn reserve" title="Reserve card" aria-label="Reserve card"
                                onClick={() => mp.reserve('board', card.id, null)} />
                        )}
                        {canBuy && (
                            <button className="spl-card-btn buy" title="Buy card" aria-label="Buy card"
                                onClick={() => mp.buy('board', card.id)} />
                        )}
                    </div>
                )}
            </div>
        );
    }

    private renderReservedCard(card: Card, canInteract: boolean) {
        const mp = this.props.MP;
        const canBuy = canInteract && this.affordable(card);
        return (
            <div key={card.id} className={`spl-card level-${card.level} ${canBuy ? 'is-buyable' : ''}`} style={{ position: 'relative' }}>
                <PlayingCard
                    card={getSplendorCardDefinition(card, this.props.myBonuses, this.props.myTokens)}
                    width="104px"
                    height="145px"
                    customIcons={SPLENDOR_ICONS}
                    hoverable={canInteract}
                />
                {canBuy && (
                    <div className="spl-card-actions">
                        <button className="spl-card-btn buy" title="Buy card" aria-label="Buy card"
                            onClick={() => mp.buy('reserve', card.id)} />
                    </div>
                )}
            </div>
        );
    }

    private affordable(card: Card): boolean {
        const bonuses = this.props.myBonuses;
        const tokens = this.props.myTokens;
        let goldNeeded = 0;
        for (const c of GEM_COLORS) {
            const effective = Math.max(0, (card.cost[c] || 0) - (bonuses[c] || 0));
            const owned = tokens[c] || 0;
            if (owned < effective) goldNeeded += effective - owned;
        }
        return goldNeeded <= (tokens.gold || 0);
    }

    public render() {
        const mp = this.props.MP;
        const {
            gameStatus, actionPhase, currentPlayerId, supply, board, deckSizes,
            nobles, pendingNobleIds, winnerIds, lastMove, publicPlayers, playerNames,
            myId, myTokens, myBonuses, myVp, myReserved, myTokenCount
        } = this.props;

        const gameOver = gameStatus === GameStatus.GameOver;
        const iWon = !!(winnerIds && winnerIds.includes(myId));
        const isMyTurn = this.isMyTurn();
        const canAct = this.canAct();
        const excess = myTokenCount - 10;

        const me = publicPlayers.find(p => p.id === myId);
        const others = publicPlayers.filter(p => p.id !== myId);

        const links: any = {
            'home': {
                'icon': 'gamepad',
                'label': 'Arena',
                'view': (
                    <div className="splendor-game">
                        {gameOver && (
                            <div className={`spl-gameover ${iWon ? 'victory' : 'defeat'}`}>
                                <div className="go-title">{iWon ? 'Victory' : 'Game Over'}</div>
                                <div className="go-sub">
                                    {winnerIds && winnerIds.length === 1
                                        ? `${playerNames[winnerIds[0]]} wins!`
                                        : winnerIds ? `Shared victory: ${winnerIds.map(w => playerNames[w]).join(' & ')}` : 'The game has ended.'}
                                </div>
                                {this.props.isHost && (
                                    <div className="go-actions">
                                        <button className="spl-button primary" onClick={() => mp.restartGame()}>Play Again</button>
                                        <button className="spl-button" onClick={() => mp.backToLobby()}>Return to Lobby</button>
                                    </div>
                                )}
                            </div>
                        )}

                        {isMyTurn && gameStatus === GameStatus.PendingNoble && (
                            <div className="spl-banner noble-banner">
                                A Noble tie! Choose one Noble to visit you:
                                <div className="spl-banner-row">
                                    {nobles.filter(n => pendingNobleIds.includes(n.id)).map(n => (
                                        <div key={n.id} className="spl-noble spl-clickable" style={{ width: '84px', height: '84px' }} onClick={() => mp.selectNoble(n.id)}>
                                            <PlayingCard card={getNobleCardDefinition(n)} width="84px" customIcons={SPLENDOR_ICONS} hoverable />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {isMyTurn && gameStatus === GameStatus.PendingDiscard && (
                            <div className="spl-banner discard-banner">
                                Over the 10-token limit &mdash; discard exactly {excess} token{excess > 1 ? 's' : ''}:
                                <div className="spl-discard-area">
                                    <div className="spl-discard-hand">
                                        {TOKEN_COLORS.map(c => {
                                            const held = myTokens[c] || 0;
                                            if (held <= 0) return null;
                                            const sel = this.state.discardSelections.filter(x => x === c).length;
                                            return (
                                                <button key={c} className={`spl-button chip ${sel > 0 ? 'is-selected' : ''}`} onClick={() => this.handleDiscardToggle(c)}>
                                                    <Glyph iconId={`gem_${c}_coin`} size="1.3em" /> x{held}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="spl-discard-tray">
                                        {this.state.discardSelections.map((c, i) => (
                                            <span key={i} className="spl-discard-badge" title="Remove" onClick={() => this.removeDiscard(c)}>
                                                <Glyph iconId={`gem_${c}_coin`} size="1.3em" />
                                            </span>
                                        ))}
                                        {this.state.discardSelections.length === excess && (
                                            <button className="spl-button primary" onClick={() => { mp.discardTokens(this.state.discardSelections); this.setState({ discardSelections: [] }); }}>
                                                Confirm Discard
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Nobles strip */}
                        <div className="spl-nobles-strip">
                            <span className="spl-strip-label">Nobles</span>
                            <div className="spl-nobles-row">
                                {nobles.length === 0 ? (
                                    <span style={{ fontStyle: 'italic', color: '#a0a0a0' }}>None remaining</span>
                                ) : nobles.map(n => (
                                    <div key={n.id} className="spl-noble" style={{ width: '84px', height: '84px' }}>
                                        <PlayingCard card={getNobleCardDefinition(n)} width="84px" customIcons={SPLENDOR_ICONS} />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Card board: L3 / L2 / L1 */}
                        <div className="spl-board">
                            {[3, 2, 1].map(level => {
                                const row = board[level as 1 | 2 | 3] || [];
                                const deckSize = deckSizes[String(level) as '1' | '2' | '3'] || 0;
                                const canReserveDeck = canAct && myReserved.length < 3 && deckSize > 0;
                                return (
                                    <div key={level} className={`spl-board-row level-${level}`}>
                                        <div className="spl-board-cards">
                                            {row.map((card, idx) => card
                                                ? this.renderBoardCard(card, canAct)
                                                : <div key={idx} className="spl-empty-slot" />)}
                                        </div>
                                        <div className="spl-deck-stub">
                                            <PlayingCard card={getDeckBackDefinition(level)} width="96px" height="134px" customIcons={SPLENDOR_ICONS} isFlipped={true} />
                                            <span className="spl-deck-count">×{deckSize}</span>
                                            {canReserveDeck && (
                                                <button className="spl-button tiny reserve-deck" onClick={() => mp.reserve('deck', null, level)}>Reserve</button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Token supply + take action */}
                        <div className="spl-supply">
                            <span className="spl-strip-label">Gem Supply</span>
                            <div className="spl-supply-row">
                                {TOKEN_COLORS.map(c => {
                                    const count = supply[c] || 0;
                                    const isGem = c !== 'gold';
                                    const pickedCount = this.state.picked.filter(x => x === c).length;
                                    const disabled = !canAct || !isGem || count <= 0;
                                    // Hint that more can still be added: an incomplete take (started, not
                                    // yet 3 different / a full pair) softly pulses the still-pickable gems.
                                    const takeIncomplete = this.state.picked.length > 0 && !this.isPickedPair() && this.state.picked.length < 3;
                                    const canPickMore = canAct && isGem && count > 0 && pickedCount === 0 && takeIncomplete;
                                    return (
                                        <button
                                            key={c}
                                            className={`spl-supply-chip ${pickedCount > 0 ? 'is-picked' : ''} ${!isGem ? 'is-gold' : ''} ${canPickMore ? 'can-pick-more' : ''}`}
                                            disabled={disabled}
                                            onClick={() => isGem && this.handlePickToken(c as GemColor)}
                                        >
                                            <Glyph iconId={`gem_${c}_coin`} size="2.1em" />
                                            <span className="spl-supply-count">{count}</span>
                                            {pickedCount > 0 && <span className="spl-picked-badge">{pickedCount}</span>}
                                        </button>
                                    );
                                })}
                            </div>
                            {canAct && this.state.picked.length > 0 && (
                                <div className="spl-take-confirm">
                                    <button className="spl-button primary" onClick={() => this.confirmTake()}>Confirm</button>
                                    <button className="spl-button" onClick={() => this.setState({ picked: [] })}>Clear</button>
                                </div>
                            )}
                            {canAct && this.state.picked.length === 0 && (
                                <p className="spl-hint">Tap gems to take 3 different — or tap one gem twice to take 2 of it (needs 4+ in supply).</p>
                            )}
                        </div>

                        {/* My panel */}
                        <div className={`spl-panel ${isMyTurn ? 'is-active' : ''}`}>
                            <div className="spl-panel-head">
                                <span className="spl-panel-name">{playerNames[myId]} (You)</span>
                                {isMyTurn && !gameOver && <span className="spl-turn-tag">Your Turn</span>}
                                <span className="spl-panel-badges">
                                    <span className="spl-badge spl-prestige"><Glyph iconId="star" size="1.25em" /> {myVp}</span>
                                    <span className="spl-badge spl-tokens">{myTokenCount}/10</span>
                                </span>
                            </div>
                            <div className="spl-panel-tokens">
                                {TOKEN_COLORS.map(c => (
                                    <span key={c} className="spl-chip"><Glyph iconId={`gem_${c}_coin`} size="1.35em" /> <strong>{myTokens[c] || 0}</strong></span>
                                ))}
                            </div>
                            {GEM_COLORS.some(c => (myBonuses[c] || 0) > 0) && (
                                <div className="spl-panel-bonuses">
                                    <span className="spl-group-label">Bonuses</span>
                                    {GEM_COLORS.map(c => (myBonuses[c] || 0) > 0 && (
                                        <span key={c} className="spl-bonus-badge"><Glyph iconId={`gem_${c}_coin`} size="1.4em" /> +{myBonuses[c]}</span>
                                    ))}
                                </div>
                            )}
                            <div className="spl-reserved">
                                <span className="spl-group-label">Reserved ({myReserved.length}/3)</span>
                                <div className="spl-reserved-row">
                                    {myReserved.length === 0
                                        ? <span style={{ fontStyle: 'italic', color: '#a0a0a0' }}>None</span>
                                        : myReserved.map(card => this.renderReservedCard(card, canAct))}
                                </div>
                            </div>
                        </div>

                        {/* Opponent bars */}
                        <div className="spl-opponents">
                            {others.map(p => {
                                const active = p.id === currentPlayerId && !gameOver;
                                return (
                                    <div key={p.id} className={`spl-opp ${active ? 'is-active' : ''}`}>
                                        <div className="spl-opp-head">
                                            <span className="spl-opp-name">{p.name}{active ? ' • turn' : ''}</span>
                                            <span className="spl-badge spl-prestige"><Glyph iconId="star" size="1.15em" /> {p.vp}</span>
                                        </div>
                                        <div className="spl-opp-stats">
                                            {GEM_COLORS.map(c => (
                                                <span key={c} className="spl-opp-bonus"><Glyph iconId={`gem_${c}_coin`} size="1.15em" /> {p.bonuses[c] || 0}</span>
                                            ))}
                                            <span className="spl-opp-meta">{p.tokenCount} tok · {p.reservedCount} res</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )
            },
            'tableau': {
                'icon': 'address-card',
                'label': 'Tableau',
                'view': <SplendorTableauView players={publicPlayers} myId={myId} currentPlayerId={currentPlayerId} />
            },
            'rules': {
                'icon': 'book',
                'label': 'Rules',
                'view': <SplendorRulesView />
            }
        };

        if (this.props.isHost) {
            links['settings'] = {
                'icon': 'cogs',
                'label': 'Admin',
                'view': (
                    <div className="spl-rules-panel" style={{ padding: '20px', textAlign: 'center' }}>
                        <h3>Game Settings</h3>
                        <div style={{ marginTop: '30px', display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center' }}>
                            <button className="spl-button primary" onClick={() => mp.restartGame()}>Restart Game</button>
                            <button className="spl-button" onClick={() => mp.backToLobby()}>Back to Lobby</button>
                        </div>
                    </div>
                )
            };
        }

        // Toast for the latest move.
        let toastNotification = null;
        if (lastMove) {
            const actor = playerNames[lastMove.playerId] || 'Player';
            const message = `${actor} ${lastMove.desc}`;
            let sound = null;
            if (lastMove.kind === 'buy' || lastMove.kind === 'reserve' || lastMove.kind === 'noble') sound = CoinFewSound;
            else if (lastMove.kind === 'take' || lastMove.kind === 'discard') sound = MicrowaveBellSound;
            toastNotification = {
                id: lastMove.moveId,
                message,
                bgColor: lastMove.playerId === myId ? '#6c5ce7' : '#e25822',
                duration: 3500,
                sound
            };
        }

        return mp.getPluginView('gameshell', 'HostShell-Main', {
            'links': links,
            'gameName': 'Splendor',
            'topBarContent': gameOver ? (iWon ? 'Victory' : 'Game Over') : (isMyTurn ? 'Your Turn' : 'Waiting'),
            'roomClassName': isMyTurn ? 'attention-bg' : '',
            'toastNotification': toastNotification
        });
    }
}
