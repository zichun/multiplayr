/**
 * CatInTheBoxViews.tsx - React components for "Cat in the Box".
 */

import * as React from 'react';
import { ViewPropsInterface } from '../../../common/interfaces';
import {
    Phase, CatColor, CAT_COLORS, OBSERVED, TrickPlay, LastMove, colorName
} from '../CatInTheBoxGameState';
import { PlayingCard } from '../../../client/lib/card-renderer/PlayingCard';
import { ExpressiveIcon } from '../../../client/lib/card-renderer/IconEngine';
import {
    CAT_ICONS,
    getCatPalette,
    getCatCardDefinition,
    CAT_COLOR_HEX,
    CAT_COLOR_TEXT
} from '../CatInTheBoxAssets';
import BellSound from '../../../sounds/microwave_bell.mp3';
import CoinSound from '../../../sounds/coin_few.mp3';

interface PublicPlayer {
    xSlots: Record<CatColor, boolean>;
    tricksWon: number;
    prediction: number | null;
    hasDiscarded: boolean;
    isParadox: boolean;
    roundScore: number;
    roundBonus: number;
    totalScore: number;
    handCount: number;
    roundHistory: number[];
}

interface CatProps extends ViewPropsInterface {
    gameStatus: Phase;
    round: number;
    totalRounds: number;
    numPlayers: number;
    maxNum: number;
    totalTricks: number;
    trickNumber: number;
    board: Record<CatColor, (string | null)[]>;
    playerOrder: string[];
    currentPlayerId: string;
    trickStartPlayerId: string;
    roundStartId: string;
    ledColor: CatColor | null;
    currentTrick: TrickPlay[];
    paradoxPlayerId: string | null;
    winnerId: string | null;
    lastMove: LastMove | null;
    allowedPredictions: number[];
    publicPlayers: Record<string, PublicPlayer>;
    playerNames: Record<string, string>;
    playerAccents: Record<string, string>;
    isHost: boolean;
    myHand: number[];
    legalPlays: TrickPlay[];
}

interface MainState {
    selectedCardIdx: number | null;
}

// ---- shared small vector helpers -------------------------------------------------

// A small flat cat glyph in a given declared colour (or neutral).
function catChip(color: CatColor | 'neutral', size = '1.4em') {
    const icon = CAT_ICONS.cat_solid;
    return (
        <span className="cat-chip" style={{ width: size, height: size }}>
            <ExpressiveIcon icon={icon} palette={getCatPalette(color)} />
        </span>
    );
}

// Render a single small cat card via the card-renderer: a flat mono-colour tile
// with a big number (header) and a lighter watermark cat (main art) offset to the
// bottom-right. The `.cat-card` wrapper carries the scoped layout overrides.
function catCard(
    number: number,
    color: CatColor | 'neutral',
    opts: { selected?: boolean; onClick?: () => void; selectable?: boolean; width?: number } = {}
) {
    return (
        <div className="cat-card">
            <PlayingCard
                card={getCatCardDefinition(number, color)}
                customIcons={CAT_ICONS}
                width={opts.width || 54}
                selectable={opts.selectable}
                selected={opts.selected}
                selectedStyle="outline"
                onClick={opts.onClick}
            />
        </div>
    );
}

// ================================================================================
// Lobby views
// ================================================================================
export class CatInTheBoxHostLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;
        const playerCount = mp.playersCount() + 1;
        const ok = playerCount >= 2 && playerCount <= 5;

        const links = {
            'home': {
                'icon': 'home',
                'label': 'Lobby',
                'view': (
                    <div>
                        {mp.getPluginView('lobby', 'SetNameWithLobby')}
                        {!ok && (
                            <p style={{ color: '#e0554f', fontWeight: 700, textAlign: 'center', marginTop: 20 }}>
                                Cat in the Box needs 2 to 5 players. Currently {playerCount}.
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
                'view': <CatInTheBoxRulesView />
            }
        };

        return mp.getPluginView('gameshell', 'HostShell-Main', {
            'gameName': 'Cat in the Box',
            'links': links
        });
    }
}

export class CatInTheBoxClientLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;
        const links = {
            'home': {
                'icon': 'id-card',
                'label': 'Lobby',
                'view': (
                    <div>
                        {mp.getPluginView('lobby', 'SetNameWithLobby')}
                        <div className="cat-waiting">Waiting for the host to start…</div>
                    </div>
                )
            },
            'rules': {
                'icon': 'book',
                'label': 'Rules',
                'view': <CatInTheBoxRulesView />
            }
        };
        return mp.getPluginView('gameshell', 'HostShell-Main', {
            'gameName': 'Cat in the Box',
            'links': links
        });
    }
}

// ================================================================================
// Rules reference
// ================================================================================
export class CatInTheBoxRulesView extends React.Component<{}, {}> {
    public render() {
        return (
            <div className="cat-rules-panel">
                <div className="rules-section">
                    <h3>The Idea</h3>
                    <p>
                        A trick-taking game where cards show a <strong>number</strong> but no
                        colour. When you play a card you <strong>declare</strong> its colour.
                        The shared research board makes every (colour, number) identity unique —
                        no two cards can share one.
                    </p>
                </div>

                <div className="rules-section">
                    <h3>Colour Strength</h3>
                    <ul>
                        <li>{catChip('red')} <strong>Red</strong> is trump — always strongest.</li>
                        <li>The <strong>led colour</strong> (first card of the trick) is next.</li>
                        <li>Every other colour loses immediately.</li>
                        <li>Among the surviving cards, the <strong>highest number</strong> wins.</li>
                    </ul>
                </div>

                <div className="rules-section">
                    <h3>Declaring a Colour</h3>
                    <ul>
                        <li>The (colour, number) cell on the board must be <strong>empty</strong>.</li>
                        <li>You must still hold that colour&rsquo;s <strong>X token</strong>.</li>
                        <li><strong>Following off-colour is allowed</strong>, but you permanently
                            lose the led colour&rsquo;s X token for the round.</li>
                        <li>The leader may only lead Red once Red is broken (or has no other legal lead).</li>
                    </ul>
                </div>

                <div className="rules-section">
                    <h3>Paradox</h3>
                    <p>
                        If the active player has <strong>no legal play at all</strong>, a paradox
                        occurs: the round ends immediately and that player <strong>loses</strong> a
                        point per trick they won (and earns no bonus).
                    </p>
                </div>

                <div className="rules-section">
                    <h3>Scoring</h3>
                    <ul>
                        <li>+1 point per trick won (the paradox-causer scores −1 each instead).</li>
                        <li><strong>Prediction bonus:</strong> if your trick count exactly matches
                            your prediction, add the size of your largest orthogonally-connected
                            group of tokens on the board. (2-player: bonus for winning 4 or fewer
                            tricks, no prediction.)</li>
                    </ul>
                </div>
            </div>
        );
    }
}

// ================================================================================
// Main page
// ================================================================================
export class CatInTheBoxMainPage extends React.Component<CatProps, MainState> {
    constructor(props: CatProps) {
        super(props);
        this.state = { selectedCardIdx: null };
    }

    public componentDidUpdate(prev: CatProps) {
        // Clear a stale selection when the turn/phase moves on.
        if (prev.currentPlayerId !== this.props.currentPlayerId ||
            prev.gameStatus !== this.props.gameStatus) {
            if (this.state.selectedCardIdx !== null) {
                this.setState({ selectedCardIdx: null });
            }
        }
    }

    private name(id: string) {
        return this.props.playerNames[id] || 'Player';
    }
    private accent(id: string) {
        return this.props.playerAccents[id] || '#7c8aa5';
    }

    // ---- interactions ----
    private buryCard(idx: number) {
        const num = this.props.myHand[idx];
        this.props.MP.discardCard(num);
    }

    private predict(value: number) {
        this.props.MP.makePrediction(value);
    }

    private playSelected(color: CatColor) {
        const idx = this.state.selectedCardIdx;
        if (idx === null) return;
        const num = this.props.myHand[idx];
        this.props.MP.playCard(num, color);
        this.setState({ selectedCardIdx: null });
    }

    private legalColorsFor(number: number): CatColor[] {
        return this.props.legalPlays
            .filter(p => p.number === number)
            .map(p => p.color);
    }

    // ---- sub-renders ----
    private renderBoard() {
        const { board, maxNum, playerAccents } = this.props;
        const cols = [];
        for (let n = 1; n <= maxNum; n++) cols.push(n);

        return (
            <div className="research-board">
                <div className="board-row board-header">
                    <div className="board-corner" />
                    {cols.map(n => <div key={n} className="board-colhead">{n}</div>)}
                </div>
                {CAT_COLORS.map(color => (
                    <div className="board-row" key={color}>
                        <div className="board-rowhead" style={{ background: CAT_COLOR_HEX[color], color: CAT_COLOR_TEXT[color] }}>
                            {catChip(color, '1.1em')}
                        </div>
                        {cols.map(n => {
                            const cell = board[color][n - 1];
                            let inner = null;
                            let cls = 'board-cell';
                            const style: React.CSSProperties = {};
                            if (cell === OBSERVED) {
                                cls += ' cell-observed';
                            } else if (cell) {
                                cls += ' cell-owned';
                                style.background = playerAccents[cell] || '#7c8aa5';
                                inner = <span className="cell-token" />;
                            } else {
                                style.background = 'transparent';
                            }
                            return <div key={n} className={cls} style={style} title={`${colorName(color)} ${n}`}>{inner}</div>;
                        })}
                    </div>
                ))}
            </div>
        );
    }

    private renderTrick() {
        const { currentTrick, ledColor, trickStartPlayerId } = this.props;
        if (currentTrick.length === 0) {
            const leader = this.name(trickStartPlayerId);
            return <div className="trick-empty">Waiting for {leader} to lead…</div>;
        }
        return (
            <div className="trick-plays">
                {currentTrick.map((p, i) => (
                    <div className={`trick-play ${p.color === ledColor ? 'is-led' : ''}`} key={i}>
                        {catCard(p.number, p.color, { width: 48 })}
                        <div className="trick-play-name" style={{ color: this.accent(p.playerId) }}>
                            {this.name(p.playerId)}
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    private renderPlayers() {
        const {
            playerOrder, publicPlayers, currentPlayerId, roundStartId,
            paradoxPlayerId, gameStatus
        } = this.props;
        return (
            <div className="player-panels">
                {playerOrder.map(id => {
                    const p = publicPlayers[id];
                    if (!p) return null;
                    const active = id === currentPlayerId &&
                        (gameStatus === Phase.Play || gameStatus === Phase.Predict);
                    return (
                        <div className={`player-panel ${active ? 'active' : ''} ${id === paradoxPlayerId ? 'paradox' : ''}`} key={id}>
                            <div className="pp-head">
                                <span className="pp-dot" style={{ background: this.accent(id) }} />
                                <span className="pp-name">{this.name(id)}</span>
                                {id === roundStartId && <span className="pp-badge">lead</span>}
                            </div>
                            <div className="pp-stats">
                                <span className="pp-stat" title="Tricks won">🐾 {p.tricksWon}</span>
                                {p.prediction !== null && (
                                    <span className="pp-stat" title="Prediction">🎯 {p.prediction}</span>
                                )}
                                <span className="pp-stat" title="Total score">★ {p.totalScore}</span>
                            </div>
                            <div className="pp-xslots">
                                {CAT_COLORS.map(c => (
                                    <span
                                        key={c}
                                        className={`pp-x ${p.xSlots[c] ? '' : 'locked'}`}
                                        style={{ background: p.xSlots[c] ? CAT_COLOR_HEX[c] : '#d7dbe2' }}
                                        title={`${colorName(c)}${p.xSlots[c] ? '' : ' (locked out)'}`}
                                    >
                                        {p.xSlots[c] ? '' : '✕'}
                                    </span>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    private renderDiscardControls(myId: string) {
        const mine = this.props.publicPlayers[myId];
        const done = mine && mine.hasDiscarded;
        const remaining = this.props.playerOrder.filter(id => !this.props.publicPlayers[id].hasDiscarded).length;

        return (
            <div className="phase-controls">
                <div className="phase-title">Bury a Card</div>
                {done ? (
                    <div className="phase-note">Card buried. Waiting for {remaining} more player(s)…</div>
                ) : (
                    <div className="phase-note">Choose one card to bury face-down (removed from this round).</div>
                )}
                {!done && (
                    <div className="hand-row">
                        {this.props.myHand.map((num, idx) => (
                            <div className="hand-card" key={idx}>
                                {catCard(num, 'neutral', { selectable: true, onClick: () => this.buryCard(idx) })}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    private renderPredictControls(myId: string) {
        const { currentPlayerId, allowedPredictions } = this.props;
        const myTurn = currentPlayerId === myId;
        return (
            <div className="phase-controls">
                <div className="phase-title">Predictions</div>
                {myTurn ? (
                    <div>
                        <div className="phase-note">How many tricks will you win?</div>
                        <div className="predict-buttons">
                            {allowedPredictions.map(v => (
                                <button key={v} className="predict-btn" onClick={() => this.predict(v)}>{v}</button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="phase-note">Waiting for {this.name(currentPlayerId)} to predict…</div>
                )}
            </div>
        );
    }

    private renderPlayControls(myId: string) {
        const { currentPlayerId, ledColor, trickStartPlayerId, myHand } = this.props;
        const myTurn = currentPlayerId === myId;
        const isLeading = myTurn && this.props.currentTrick.length === 0;
        const selIdx = this.state.selectedCardIdx;
        const selNum = selIdx !== null ? myHand[selIdx] : null;
        const legalColors = selNum !== null ? this.legalColorsFor(selNum) : [];

        return (
            <div className="phase-controls">
                <div className="phase-title">
                    Trick {this.props.trickNumber} / {this.props.totalTricks}
                    {ledColor && <span className="led-tag" style={{ background: CAT_COLOR_HEX[ledColor], color: CAT_COLOR_TEXT[ledColor] }}>Led: {colorName(ledColor)}</span>}
                </div>

                {myTurn ? (
                    <div className="phase-note turn-note">
                        {isLeading ? 'You lead this trick — pick a card, then declare its colour.'
                            : 'Your turn — pick a card, then declare its colour.'}
                    </div>
                ) : (
                    <div className="phase-note">Waiting for {this.name(currentPlayerId)}…</div>
                )}

                <div className="hand-row">
                    {myHand.map((num, idx) => {
                        const selected = selIdx === idx;
                        return (
                            <div className="hand-card" key={idx}>
                                {catCard(num, 'neutral', {
                                    selectable: myTurn,
                                    selected,
                                    onClick: myTurn ? () => this.setState({ selectedCardIdx: selected ? null : idx }) : undefined
                                })}
                            </div>
                        );
                    })}
                </div>

                {myTurn && selNum !== null && (
                    <div className="color-picker">
                        <div className="cp-label">Declare colour for {selNum}:</div>
                        <div className="cp-buttons">
                            {CAT_COLORS.map(c => {
                                const enabled = legalColors.includes(c);
                                const penalty = !isLeading && ledColor && c !== ledColor && enabled;
                                return (
                                    <button
                                        key={c}
                                        className={`cp-btn ${enabled ? '' : 'disabled'}`}
                                        disabled={!enabled}
                                        style={{ background: enabled ? CAT_COLOR_HEX[c] : '#e6e8ec', color: enabled ? CAT_COLOR_TEXT[c] : '#a7adb8' }}
                                        onClick={() => enabled && this.playSelected(c)}
                                        title={penalty ? `Off-suit: you will lose your ${colorName(ledColor!)} token` : colorName(c)}
                                    >
                                        {colorName(c)}{penalty ? ' ⚠' : ''}
                                    </button>
                                );
                            })}
                        </div>
                        {legalColors.length === 0 && (
                            <div className="phase-note warn">No legal colour for that card — pick another.</div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    private renderRoundEnd() {
        const { playerOrder, publicPlayers, paradoxPlayerId, round, totalRounds, isHost } = this.props;
        const last = round >= totalRounds - 1;
        const sorted = [...playerOrder].sort((a, b) => publicPlayers[b].totalScore - publicPlayers[a].totalScore);
        return (
            <div className="round-end">
                <div className="re-title">Round {round + 1} Results</div>
                {paradoxPlayerId && (
                    <div className="re-paradox">{this.name(paradoxPlayerId)} triggered a paradox!</div>
                )}
                <table className="re-table">
                    <thead>
                        <tr><th>Player</th><th>Tricks</th><th>Pred.</th><th>Bonus</th><th>Round</th><th>Total</th></tr>
                    </thead>
                    <tbody>
                        {sorted.map(id => {
                            const p = publicPlayers[id];
                            return (
                                <tr key={id} className={id === paradoxPlayerId ? 'paradox-row' : ''}>
                                    <td><span className="pp-dot" style={{ background: this.accent(id) }} /> {this.name(id)}</td>
                                    <td>{p.tricksWon}</td>
                                    <td>{p.prediction === null ? '—' : p.prediction}</td>
                                    <td>{p.roundBonus > 0 ? `+${p.roundBonus}` : '—'}</td>
                                    <td className={p.roundScore < 0 ? 'neg' : ''}>{p.roundScore >= 0 ? '+' : ''}{p.roundScore}</td>
                                    <td><strong>{p.totalScore}</strong></td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {isHost ? (
                    <button className="primary-btn" onClick={() => this.props.MP.nextRound()}>
                        {last ? 'See Final Results' : 'Next Round'}
                    </button>
                ) : (
                    <div className="phase-note">Waiting for the host to continue…</div>
                )}
            </div>
        );
    }

    private renderGameOver() {
        const { playerOrder, publicPlayers, winnerId, isHost } = this.props;
        const sorted = [...playerOrder].sort((a, b) => publicPlayers[b].totalScore - publicPlayers[a].totalScore);
        return (
            <div className="game-over">
                <div className="go-cat">
                    <ExpressiveIcon icon={CAT_ICONS.cat_box} palette={getCatPalette('green')} />
                </div>
                <div className="go-title">{winnerId ? `${this.name(winnerId)} wins!` : 'Game Over'}</div>
                <table className="re-table">
                    <thead><tr><th>#</th><th>Player</th><th>Score</th></tr></thead>
                    <tbody>
                        {sorted.map((id, i) => (
                            <tr key={id} className={id === winnerId ? 'winner-row' : ''}>
                                <td>{i === 0 ? '🏆' : i + 1}</td>
                                <td><span className="pp-dot" style={{ background: this.accent(id) }} /> {this.name(id)}</td>
                                <td><strong>{publicPlayers[id].totalScore}</strong></td>
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
        const myId = mp.clientId;
        const { gameStatus, round, totalRounds, currentPlayerId, lastMove } = this.props;

        const isMyTurn = currentPlayerId === myId &&
            (gameStatus === Phase.Play || gameStatus === Phase.Predict);
        const needDiscard = gameStatus === Phase.Discard &&
            this.props.publicPlayers[myId] && !this.props.publicPlayers[myId].hasDiscarded;

        let controls: React.ReactNode = null;
        if (gameStatus === Phase.Discard) controls = this.renderDiscardControls(myId);
        else if (gameStatus === Phase.Predict) controls = this.renderPredictControls(myId);
        else if (gameStatus === Phase.Play) controls = this.renderPlayControls(myId);
        else if (gameStatus === Phase.RoundEnd) controls = this.renderRoundEnd();
        else if (gameStatus === Phase.GameOver) controls = this.renderGameOver();

        const showArena = gameStatus === Phase.Play || gameStatus === Phase.Predict ||
            gameStatus === Phase.Discard;

        const arena = (
            <div className="cat-arena">
                <div className="arena-topline">
                    <span className="round-pill">Round {round + 1} / {totalRounds}</span>
                    <span className="phase-pill">{this.phaseLabel(gameStatus)}</span>
                </div>

                {controls}

                {showArena && (
                    <React.Fragment>
                        <div className="section-label">Current Trick</div>
                        <div className="trick-zone">{this.renderTrick()}</div>

                        <div className="section-label">Research Board</div>
                        {this.renderBoard()}

                        <div className="section-label">Players</div>
                        {this.renderPlayers()}
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
                'view': <CatInTheBoxRulesView />
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

        // Toast for opponents' moves.
        let toastNotification = null;
        if (lastMove && lastMove.playerId !== myId) {
            const heavy = lastMove.kind === 'paradox' || lastMove.kind === 'trick';
            toastNotification = {
                id: lastMove.moveId,
                message: `${this.name(lastMove.playerId)} ${lastMove.desc}`,
                bgColor: this.accent(lastMove.playerId),
                sound: heavy ? BellSound : CoinSound,
                duration: 3200
            };
        }

        // isMyTurn / needDiscard are already false outside the active phases.
        const attention = isMyTurn || needDiscard;

        return mp.getPluginView('gameshell', 'HostShell-Main', {
            'links': links,
            'gameName': 'Cat in the Box',
            'topBarContent': this.topBar(myId),
            'roomClassName': attention ? 'attention-bg' : '',
            'toastNotification': toastNotification
        });
    }

    private phaseLabel(status: Phase): string {
        switch (status) {
            case Phase.Discard: return 'Bury a Card';
            case Phase.Predict: return 'Predictions';
            case Phase.Play: return 'Trick Phase';
            case Phase.RoundEnd: return 'Scoring';
            case Phase.GameOver: return 'Game Over';
            default: return '';
        }
    }

    private topBar(myId: string): string {
        const { gameStatus, currentPlayerId } = this.props;
        if (gameStatus === Phase.GameOver) {
            return this.props.winnerId === myId ? 'Victory' : 'Game Over';
        }
        if (gameStatus === Phase.RoundEnd) return 'Scoring';
        if (gameStatus === Phase.Discard) {
            const mine = this.props.publicPlayers[myId];
            return mine && mine.hasDiscarded ? 'Waiting' : 'Bury a card';
        }
        if (currentPlayerId === myId) return 'Your Turn';
        return `${this.name(currentPlayerId)}'s turn`;
    }
}
