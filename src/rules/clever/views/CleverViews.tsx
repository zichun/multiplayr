/**
 * CleverViews.tsx - React components for Clever game
 */

import * as React from 'react';
import { ViewPropsInterface } from '../../../common/interfaces';
import { CleverGameRules } from './CleverRules';
import { GameStatus, DieColor, Die, PendingBonus, BLUE_SUMS, BLUE_POINTS, GREEN_MINIMUMS, GREEN_POINTS, ORANGE_MULTIPLIERS } from '../CleverGameState';

// Helper to map color to actual background/border color hex values
export const HEX_COLORS: { [key in DieColor]: string } = {
    white: '#ecf0f1',
    yellow: '#f1c40f',
    blue: '#3498db',
    green: '#2ecc71',
    orange: '#e67e22',
    purple: '#9b59b6'
};

// Lobby Views
export class CleverHostLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;

        return mp.getPluginView(
            'gameshell',
            'HostShell-Main',
            {
                'links': {
                    'home': {
                        'icon': 'home',
                        'label': 'Lobby',
                        'view': mp.getPluginView('lobby', 'SetNameWithLobby')
                    },
                    'clients': {
                        'icon': 'users',
                        'label': 'Players',
                        'view': mp.getPluginView('lobby', 'host-roommanagement')
                    },
                    'rules': {
                        'icon': 'book',
                        'label': 'Rules',
                        'view': <CleverGameRules />
                    }
                }
            }
        );
    }
}

export class CleverClientLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;

        return mp.getPluginView(
            'gameshell',
            'HostShell-Main',
            {
                'links': {
                    'home': {
                        'icon': 'id-card',
                        'label': 'Lobby',
                        'view': mp.getPluginView('lobby', 'SetNameWithLobby')
                    },
                    'rules': {
                        'icon': 'book',
                        'label': 'Rules',
                        'view': <CleverGameRules />
                    }
                }
            });
    }
}

// Main Coordinator View
interface CleverMainViewProps extends ViewPropsInterface {
    gameStatus: GameStatus;
    round: number;
    totalRounds: number;
    playerIds: string[];
    activePlayerIndex: number;
    currentPlayerId: string;
    rollCount: number;
    activePickedDice: Die[];
    poolDice: Die[];
    trayDice: Die[];
    rolledDice: Die[];
    isSolo: boolean;
    soloPassiveTurn: boolean;
    players: { [playerId: string]: any };
    gameLogs: string[];
    isHost: boolean;

    // Player specific props
    yellow: boolean[][];
    blue: boolean[];
    green: number;
    orange: (number | null)[];
    purple: (number | null)[];
    rerollsTotal: number;
    rerollsUsed: number;
    extraDiceTotal: number;
    extraDiceUsed: number;
    foxesTotal: number;
    bonusesToResolve: PendingBonus[];
    extraDicePickedThisTurn: DieColor[];
    hasConfirmedPassiveSelection?: boolean;
    names?: string[];
    clientIds?: string[];
}

interface CleverScreenState {
    viewingPlayerId: string; // for multiplayer sheet switching
    whiteWildTargetColor: string | null; // active dropdown for white die selection
    bonusCardMinimized: boolean;
    pendingPassiveYellowColor: 'yellow' | 'white' | null;
    pendingExtraYellowColor: 'yellow' | 'white' | null;
    pendingActiveYellowColor: 'yellow' | 'white' | null;
}

function MainPage(props: CleverMainViewProps) {
    return <CleverGameScreen {...props} />;
}

class CleverGameScreen extends React.Component<CleverMainViewProps, CleverScreenState> {
    constructor(props: CleverMainViewProps) {
        super(props);
        this.state = {
            viewingPlayerId: props.MP.clientId,
            whiteWildTargetColor: null,
            bonusCardMinimized: false,
            pendingPassiveYellowColor: null,
            pendingExtraYellowColor: null,
            pendingActiveYellowColor: null
        };
    }

    componentDidUpdate(prevProps: CleverMainViewProps) {
        // If the round or turn changed, reset sheet view back to ourselves
        if (prevProps.currentPlayerId !== this.props.currentPlayerId) {
            this.setState({ viewingPlayerId: this.props.MP.clientId });
        }
        // Expand card if new bonuses are received or the active bonus changes
        const prevBonuses = prevProps.bonusesToResolve || [];
        const currBonuses = this.props.bonusesToResolve || [];

        const hasNewBonus = currBonuses.length > prevBonuses.length;
        const activeBonusChanged = currBonuses.length > 0 && (
            prevBonuses.length === 0 ||
            JSON.stringify(currBonuses[0]) !== JSON.stringify(prevBonuses[0])
        );

        if (hasNewBonus || activeBonusChanged) {
            this.setState({ bonusCardMinimized: false });
        }
    }

    render() {
        const {
            MP,
            gameStatus,
            round,
            totalRounds,
            playerIds,
            currentPlayerId,
            rollCount,
            activePickedDice,
            poolDice,
            trayDice,
            rolledDice,
            isSolo,
            soloPassiveTurn,
            players,
            gameLogs,
            bonusesToResolve,
            extraDicePickedThisTurn,
            hasConfirmedPassiveSelection,
            rerollsTotal,
            rerollsUsed,
            extraDiceTotal,
            extraDiceUsed,
            names,
            clientIds
        } = this.props;

        const formatLogLine = (log: string) => {
            let formatted = log;
            const ids = clientIds || [];
            const nms = names || [];
            for (const id of playerIds) {
                const idx = ids.indexOf(id);
                const name = (idx !== -1 && idx < nms.length) ? nms[idx] : id;
                formatted = formatted.split(id).join(name);
            }
            return formatted;
        };

        const myId = MP.clientId;
        const isMyTurn = myId === currentPlayerId;

        // Active vs Passive roles
        const isActiveRole = isSolo ? !soloPassiveTurn : isMyTurn;
        const isPassiveRole = isSolo ? soloPassiveTurn : !isMyTurn;

        // Current viewing sheet state
        const viewingPlayerId = this.state.viewingPlayerId || myId;
        const isViewingSelf = viewingPlayerId === myId;
        const targetPlayerState = players[viewingPlayerId];

        // Rerolls & Extra Dice remaining
        const myRerollsLeft = targetPlayerState ? targetPlayerState.rerollsTotal - targetPlayerState.rerollsUsed : 0;
        const myExtraDiceLeft = targetPlayerState ? targetPlayerState.extraDiceTotal - targetPlayerState.extraDiceUsed : 0;

        // Determine if we have any pending bonuses in our queue
        const myBonuses = bonusesToResolve || [];
        const hasPendingBonus = myBonuses.length > 0;

        return (
            <div className="clever-game-container">
                {/* 1. Header indicators */}
                {gameStatus !== GameStatus.GameOver && (
                    <div className="game-header-bar">
                        <div className="turn-indicator">
                            {isSolo ? (
                                <span className="badge my-turn-badge">
                                    {soloPassiveTurn ? '🤖 Passive simulated turn' : '⚡ YOUR ACTIVE TURN'}
                                </span>
                            ) : isMyTurn ? (
                                <span className="badge my-turn-badge">⚡ YOUR ACTIVE TURN ⚡</span>
                            ) : (
                                <span className="badge other-turn-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    {MP.getPluginView('lobby', 'player-tag', { clientId: currentPlayerId })}&apos;s turn
                                </span>
                            )}
                            <div className="phase-subtitle">
                                {gameStatus === GameStatus.RoundStartBonus ? "Selecting Round-Start Bonus..."
                                    : gameStatus === GameStatus.ActiveRolling ? "Active Player rolls all available dice"
                                        : gameStatus === GameStatus.ActiveChoosing ? "Active Player chooses one die"
                                            : gameStatus === GameStatus.PassiveChoosing ? "Passive Players pick one die from Silver Tray"
                                                : "Turn end: spend remaining Extra Die actions"}
                            </div>
                        </div>

                        <div className="rounds-info">
                            <div className="round-badge">
                                ROUND {round}/{totalRounds}
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. Rolling Arena or Leaderboard */}
                {gameStatus === GameStatus.GameOver ? (
                    <CleverGameOverScreen {...this.props} />
                ) : (
                    <div className="arena-grid">
                        {/* Active Roll Zone */}
                        <div className="arena-card">
                            <h3>
                                <span>Dice Arena</span>
                                <span style={{ fontSize: '0.8em', color: '#a0aec0' }}>
                                    {isActiveRole ? `Rolls: ${rollCount}/3` : 'Read-only'}
                                </span>
                            </h3>

                            {/* Top Dice slots for Active Player */}
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center' }}>
                                {[0, 1, 2].map(idx => {
                                    const picked = activePickedDice[idx];
                                    return (
                                        <div
                                            key={idx}
                                            style={{
                                                width: '56px',
                                                height: '56px',
                                                border: '3px solid #000',
                                                borderRadius: '8px',
                                                backgroundColor: '#2d3748',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                boxShadow: 'inset 2px 2px 5px rgba(0,0,0,0.5)',
                                                fontWeight: 'bold',
                                                fontSize: '0.8em',
                                                color: '#4a5568'
                                            }}
                                        >
                                            {picked ? (
                                                <div className={`clever-die static ${picked.color} ${extraDicePickedThisTurn[0] === picked.color ? 'selected' : ''}`}>
                                                    {picked.value}
                                                    {extraDicePickedThisTurn[0] === picked.color && <span className="selected-check">✔</span>}
                                                </div>
                                            ) : (
                                                `Pick ${idx + 1}`
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Current rolled pool dice */}
                            <div className="dice-pool-list">
                                {gameStatus === GameStatus.ActiveChoosing && rolledDice.length > 0 ? (
                                    rolledDice.map((die) => {
                                        // Highlight if clickable
                                        const canPick = isActiveRole && !hasPendingBonus;
                                        return (
                                            <div key={die.color} style={{ position: 'relative' }}>
                                                <button
                                                    className={`clever-die ${die.color} ${canPick ? 'active-clickable' : ''}`}
                                                    onClick={() => {
                                                        if (canPick) {
                                                            if (die.color === 'white') {
                                                                // Wild die dropdown selection
                                                                this.setState({ whiteWildTargetColor: 'white' });
                                                            } else if (die.color === 'yellow') {
                                                                this.setState({ pendingActiveYellowColor: 'yellow' });
                                                            } else {
                                                                MP.pickActiveDie(die.color);
                                                            }
                                                        }
                                                    }}
                                                >
                                                    {die.value}
                                                </button>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <span style={{ color: '#718096', fontSize: '0.9em' }}>
                                        {gameStatus === GameStatus.ActiveRolling ? 'Waiting for roll...' : 'No rolled dice currently'}
                                    </span>
                                )}
                            </div>

                            {/* Controls (Roll, Reroll, End Turn) */}
                            {isActiveRole && !hasPendingBonus && (
                                <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                                    {gameStatus === GameStatus.ActiveRolling && (
                                        <button
                                            className="btn-roll"
                                            style={{ flexGrow: 1 }}
                                            onClick={() => MP.rollActiveDice()}
                                        >
                                            🎲 ROLL DICE
                                        </button>
                                    )}

                                    {gameStatus === GameStatus.ActiveChoosing && myRerollsLeft > 0 && (
                                        <button
                                            className="btn-reroll"
                                            style={{ flexGrow: 1 }}
                                            onClick={() => MP.rerollActiveDice()}
                                        >
                                            🔄 Reroll Pool ({myRerollsLeft} left)
                                        </button>
                                    )}

                                    {gameStatus === GameStatus.TurnEnd && (
                                        <button
                                            className="btn-roll"
                                            style={{ flexGrow: 1, backgroundColor: '#9b59b6', color: 'white' }}
                                            onClick={() => MP.endPlayerTurn()}
                                        >
                                            🏁 END TURN
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Silver Tray Zone */}
                        <div className="arena-card">
                            <h3>
                                <span>Silver Tray platter</span>
                                <span style={{ fontSize: '0.8em', color: '#a0aec0' }}>
                                    {(isPassiveRole && gameStatus === GameStatus.PassiveChoosing) ? 'Choose exactly ONE die' : 'Tray'}
                                </span>
                            </h3>

                            <div className="silver-tray-zone">
                                {trayDice.length === 0 ? (
                                    <span style={{ color: '#718096', fontSize: '0.9em' }}>Tray is currently empty</span>
                                ) : (
                                    trayDice.map((die) => {
                                        // Check if passive player can legally choose this die
                                        const alreadyConfirmed = hasConfirmedPassiveSelection;
                                        const isSelected = extraDicePickedThisTurn.length > 0 && extraDicePickedThisTurn[0] === die.color;
                                        const canPick = gameStatus === GameStatus.PassiveChoosing && isPassiveRole && !hasPendingBonus && !alreadyConfirmed && !isSelected;

                                        return (
                                            <button
                                                key={die.color}
                                                className={`clever-die ${die.color} ${canPick ? 'active-clickable' : ''} ${isSelected ? 'selected' : ''}`}
                                                onClick={() => {
                                                    if (canPick) {
                                                        if (die.color === 'white') {
                                                            this.setState({ whiteWildTargetColor: 'white' });
                                                        } else if (die.color === 'yellow') {
                                                            this.setState({ pendingPassiveYellowColor: 'yellow' });
                                                        } else {
                                                            MP.pickPassiveDie(die.color);
                                                        }
                                                    }
                                                }}
                                            >
                                                {die.value}
                                                {isSelected && <span className="selected-check">✔</span>}
                                            </button>
                                        );
                                    })
                                )}
                            </div>

                            {/* Passive confirmation control */}
                            {isPassiveRole && !hasPendingBonus && extraDicePickedThisTurn.length > 0 && gameStatus === GameStatus.PassiveChoosing && (
                                hasConfirmedPassiveSelection ? (
                                    <div
                                        className="btn-roll"
                                        style={{
                                            width: '100%',
                                            backgroundColor: '#2ecc71',
                                            color: 'white',
                                            textAlign: 'center',
                                            cursor: 'default',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px'
                                        }}
                                    >
                                        ✔ Selection Confirmed (Waiting for others...)
                                    </div>
                                ) : (
                                    <button
                                        className="btn-roll"
                                        style={{ width: '100%', backgroundColor: '#3182ce', color: 'white' }}
                                        onClick={() => MP.confirmPassiveSelection()}
                                    >
                                        👍 Confirm Passive Pick
                                    </button>
                                )
                            )}
                        </div>
                    </div>
                )}

                {/* 3. Sheet selector tabs (if multiplayer) */}
                {playerIds.length > 1 && (
                    <div className="sheet-selector-tabs">
                        {playerIds.map(id => (
                            <button
                                key={id}
                                className={`tab-btn ${viewingPlayerId === id ? 'active' : ''}`}
                                onClick={() => this.setState({ viewingPlayerId: id })}
                            >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                    {id === myId ? 'Your Sheet' : MP.getPluginView('lobby', 'player-tag', { clientId: id, border: false })}
                                </span>
                                {id === currentPlayerId && ' ⚡'}
                            </button>
                        ))}
                    </div>
                )}

                {/* Dropdown Wild Card selector for White Die */}
                {this.state.whiteWildTargetColor !== null && (
                    <div className="bonus-overlay">
                        <div className="bonus-card">
                            <h2>Select Track for Wild Die</h2>
                            <p>Choose which color area to apply the White die&apos;s value to:</p>
                            <div className="bonus-options">
                                {['yellow', 'blue', 'green', 'orange', 'purple'].map(color => (
                                    <button
                                        key={color}
                                        className={`btn-bonus-opt ${color}`}
                                        onClick={() => {
                                            const colorVal = color as DieColor;
                                            this.setState({ whiteWildTargetColor: null });
                                            if (isActiveRole) {
                                                if (colorVal === 'yellow') {
                                                    this.setState({ pendingActiveYellowColor: 'white' });
                                                } else {
                                                    MP.pickActiveDie('white', colorVal);
                                                }
                                            } else {
                                                if (colorVal === 'yellow') {
                                                    this.setState({ pendingPassiveYellowColor: 'white' });
                                                } else {
                                                    MP.pickPassiveDie('white', colorVal);
                                                }
                                            }
                                        }}
                                    >
                                        Mark in {color} Area
                                    </button>
                                ))}
                                <button
                                    className="btn-bonus-opt"
                                    style={{ backgroundColor: '#718096', color: 'white', marginTop: '10px' }}
                                    onClick={() => this.setState({ whiteWildTargetColor: null })}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 4. Score Sheet */}
                {targetPlayerState && (
                    <div className="score-sheet-wrapper">
                        {/* Pending Yellow Cell Choice Banner */}
                        {(this.state.pendingActiveYellowColor || this.state.pendingPassiveYellowColor || this.state.pendingExtraYellowColor) && (
                            <div className="yellow-selection-banner" style={{
                                backgroundColor: '#f1c40f',
                                color: '#000',
                                padding: '12px 16px',
                                borderRadius: '8px',
                                border: '3px solid #000',
                                marginBottom: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                fontWeight: 'bold',
                                boxShadow: '5px 5px 0px #000'
                            }}>
                                <span>
                                    💛 Select which box in your Yellow Grid you want to mark off (matching value: {this.get_pending_yellow_die_value()})
                                </span>
                                <button
                                    onClick={() => this.setState({
                                        pendingActiveYellowColor: null,
                                        pendingPassiveYellowColor: null,
                                        pendingExtraYellowColor: null
                                    })}
                                    style={{
                                        backgroundColor: '#000',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '4px',
                                        padding: '4px 8px',
                                        cursor: 'pointer',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        )}
                        <h2 className="sheet-title">
                            <span>
                                {isViewingSelf ? 'Your Scoresheet' : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>{MP.getPluginView('lobby', 'player-tag', { clientId: viewingPlayerId, border: false })}&apos;s Scoresheet</span>}
                                {!isViewingSelf && <span style={{ fontSize: '0.6em', color: '#e53e3e', marginLeft: '8px' }}> (Viewing)</span>}
                            </span>
                            {/* Stars score tracker */}
                            <span style={{ fontSize: '0.8em', color: '#2ecc71' }}>
                                Total: {this.calculate_live_score(viewingPlayerId)} pts
                            </span>
                        </h2>

                        <div className="tracks-grid">
                            {/* Yellow Block */}
                            <div className="color-block block-yellow">
                                <div className="block-header">
                                    <span>💛 Yellow Area</span>
                                    <span>Col Star points</span>
                                </div>
                                <div className="yellow-grid-layout">
                                    <div className="yellow-4x4">
                                        {[
                                            [3, 6, 5, null],
                                            [2, 1, null, 5],
                                            [1, null, 2, 4],
                                            [null, 3, 4, 6]
                                        ].map((row, rIdx) =>
                                            row.map((cellVal, cIdx) => {
                                                const isPremarked = cellVal === null;
                                                const isMarked = targetPlayerState.yellow[rIdx][cIdx];

                                                // Check if active player or bonus overlay can click it
                                                const canMark = this.is_yellow_cell_clickable(myId, rIdx, cIdx, cellVal);

                                                return (
                                                    <div
                                                        key={`${rIdx}-${cIdx}`}
                                                        className={`yellow-cell ${isPremarked ? 'premarked' : ''} ${isMarked && !isPremarked ? 'marked' : ''} ${canMark ? 'clickable' : ''}`}
                                                        onClick={() => {
                                                            if (canMark) {
                                                                this.handle_yellow_click(rIdx, cIdx, cellVal);
                                                            }
                                                        }}
                                                    >
                                                        {cellVal !== null && cellVal}
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                    <div className="yellow-row-bonuses">
                                        <div className="bonus-icon-badge blue" title="Row 1: Blue X">✕</div>
                                        <div className="bonus-icon-badge orange" title="Row 2: Orange 4">4</div>
                                        <div className="bonus-icon-badge green" title="Row 3: Green X">✕</div>
                                        <div className="bonus-icon-badge fox" title="Row 4: Fox multiplier">🦊</div>
                                    </div>
                                </div>
                                <div className="yellow-col-bonuses">
                                    <div className="yellow-col-bonus-cell">
                                        <span className="star-points">10</span>
                                    </div>
                                    <div className="yellow-col-bonus-cell">
                                        <span className="star-points">14</span>
                                    </div>
                                    <div className="yellow-col-bonus-cell">
                                        <span className="star-points">16</span>
                                    </div>
                                    <div className="yellow-col-bonus-cell">
                                        <span className="star-points" style={{ borderStyle: 'double' }}>20</span>
                                        <div className="bonus-icon-badge wild" style={{ scale: '0.8', marginTop: '2px' }} title="Diagonal completed: +1 Extra Die">⧉</div>
                                    </div>
                                </div>
                            </div>

                            {/* Blue Block */}
                            <div className="color-block block-blue">
                                <div className="block-header">
                                    <span>💙 Blue Area</span>
                                    <span>Coupled: 💙+🤍 sum</span>
                                </div>
                                <div className="blue-scale-row">
                                    {BLUE_SUMS.map((sum, idx) => (
                                        <div key={sum} className="blue-scale-cell">
                                            <div className="scale-label">{idx + 1}✕</div>
                                            <div className="scale-val">{BLUE_POINTS[idx]}</div>
                                        </div>
                                    ))}
                                </div>
                                <div className="blue-grid-layout">
                                    <div className="blue-grid">
                                        {/* Column 1: coupling icon, 5, 9 */}
                                        {/* Row 1 Col 1 coupling sum index is null (icon) */}
                                        <div className="blue-cell premarked" style={{ backgroundColor: '#e2e8f0' }} title="Coupling: Blue die + White die sum">
                                            <span className="blue-coupling-icon">💙+🤍</span>
                                        </div>
                                        {[2, 3, 4].map(sum => this.render_blue_cell(myId, sum))}

                                        {[5, 6, 7, 8].map(sum => this.render_blue_cell(myId, sum))}

                                        {[9, 10, 11, 12].map(sum => this.render_blue_cell(myId, sum))}
                                    </div>
                                    <div className="blue-row-bonuses">
                                        <div className="bonus-icon-badge orange" title="Row 1: Orange 5">5</div>
                                        <div className="bonus-icon-badge yellow" title="Row 2: Yellow X">✕</div>
                                        <div className="bonus-icon-badge fox" title="Row 3: Fox multiplier">🦊</div>
                                    </div>
                                </div>
                                <div className="blue-col-bonuses">
                                    <div className="bonus-icon-badge reroll" title="Col 1: Reroll slot">⟲</div>
                                    <div className="bonus-icon-badge green" title="Col 2: Green X">✕</div>
                                    <div className="bonus-icon-badge purple" title="Col 3: Purple 6">6</div>
                                    <div className="bonus-icon-badge wild" title="Col 4: +1 Extra Die">+1</div>
                                </div>
                            </div>

                            {/* Green Block */}
                            <div className="color-block block-green">
                                <div className="block-header">
                                    <span>💚 Green Path (left-to-right)</span>
                                </div>
                                <div className="linear-row">
                                    {GREEN_MINIMUMS.map((min, idx) => {
                                        const isMarked = targetPlayerState.green > idx;
                                        const isNext = targetPlayerState.green === idx;

                                        // Clickable if resolving green X bonus or picking green active/passive die
                                        const canMark = this.is_green_cell_clickable(myId, idx);

                                        // Stars point indicators above cells
                                        const starVal = GREEN_POINTS[idx];

                                        // Cell bonuses under cells
                                        let cellBonusText = '';
                                        if (idx === 3) cellBonusText = '+1';
                                        if (idx === 5) cellBonusText = '✕';
                                        if (idx === 6) cellBonusText = '🦊';
                                        if (idx === 8) cellBonusText = '6';
                                        if (idx === 9) cellBonusText = '⟲';

                                        return (
                                            <div key={idx} className="linear-cell-wrapper">
                                                <div className="green-star-score">{starVal}</div>
                                                <div
                                                    className={`linear-cell ${isMarked ? 'marked' : ''} ${canMark ? 'clickable' : ''}`}
                                                    style={isMarked ? { backgroundColor: HEX_COLORS.green, color: 'white' } : {}}
                                                    onClick={() => {
                                                        if (canMark) {
                                                            this.handle_green_click();
                                                        }
                                                    }}
                                                >
                                                    {isMarked ? (
                                                        <span style={{ fontSize: '1.4em', color: 'red', fontWeight: 'bold' }}>✕</span>
                                                    ) : (
                                                        <span className="req-label">≥{min}</span>
                                                    )}
                                                </div>
                                                {cellBonusText && (
                                                    <span className={`bonus-icon-badge ${idx === 3 ? 'wild' : idx === 5 ? 'green' : idx === 6 ? 'fox' : idx === 8 ? 'purple' : 'reroll'}`} style={{ scale: '0.7' }}>
                                                        {cellBonusText}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Orange Block */}
                            <div className="color-block block-orange">
                                <div className="block-header">
                                    <span>🧡 Orange Path (left-to-right)</span>
                                </div>
                                <div className="linear-row">
                                    {Array(11).fill(null).map((_, idx) => {
                                        const recordedVal = targetPlayerState.orange[idx];
                                        const isNext = targetPlayerState.orange.indexOf(null) === idx;

                                        // Clickable if resolving orange num bonus or active/passive orange die
                                        const canMark = this.is_orange_cell_clickable(myId, idx);

                                        const multiplier = ORANGE_MULTIPLIERS[idx];

                                        // Cell bonuses under cells
                                        let cellBonusText = '';
                                        if (idx === 2) cellBonusText = '⟲';
                                        if (idx === 4) cellBonusText = '✕';
                                        if (idx === 5) cellBonusText = '+1';
                                        if (idx === 7) cellBonusText = '🦊';
                                        if (idx === 9) cellBonusText = '6';

                                        return (
                                            <div key={idx} className="linear-cell-wrapper">
                                                <div
                                                    className={`linear-cell ${recordedVal !== null ? 'marked' : ''} ${canMark ? 'clickable' : ''}`}
                                                    style={recordedVal !== null ? { backgroundColor: HEX_COLORS.orange, color: 'white' } : {}}
                                                    onClick={() => {
                                                        if (canMark) {
                                                            this.handle_orange_click(idx);
                                                        }
                                                    }}
                                                >
                                                    {multiplier && <div className="multiplier-tag">x{multiplier}</div>}
                                                    {recordedVal !== null ? (
                                                        <span className="cell-val">{recordedVal}</span>
                                                    ) : (
                                                        <span style={{ fontSize: '0.8em', color: '#cbd5e0' }}>__</span>
                                                    )}
                                                </div>
                                                {cellBonusText && (
                                                    <span className={`bonus-icon-badge ${idx === 2 ? 'reroll' : idx === 4 ? 'yellow' : idx === 5 ? 'wild' : idx === 7 ? 'fox' : 'purple'}`} style={{ scale: '0.7' }}>
                                                        {cellBonusText}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Purple Block */}
                            <div className="color-block block-purple">
                                <div className="block-header">
                                    <span>💜 Purple Path (strictly increasing: &lt;)</span>
                                </div>
                                <div className="linear-row">
                                    {Array(11).fill(null).map((_, idx) => {
                                        const recordedVal = targetPlayerState.purple[idx];
                                        const isNext = targetPlayerState.purple.indexOf(null) === idx;

                                        // Clickable if resolving purple num bonus or active/passive purple die
                                        const canMark = this.is_purple_cell_clickable(myId, idx);

                                        // Cell bonuses under cells
                                        let cellBonusText = '';
                                        if (idx === 2) cellBonusText = '⟲';
                                        if (idx === 3) cellBonusText = '✕';
                                        if (idx === 4) cellBonusText = '+1';
                                        if (idx === 5) cellBonusText = '✕';
                                        if (idx === 6) cellBonusText = '🦊';
                                        if (idx === 7) cellBonusText = '⟲';
                                        if (idx === 8) cellBonusText = '✕';
                                        if (idx === 9) cellBonusText = '6';
                                        if (idx === 10) cellBonusText = '+1';

                                        return (
                                            <div key={idx} className="linear-cell-wrapper">
                                                <div
                                                    className={`linear-cell ${recordedVal !== null ? 'marked' : ''} ${canMark ? 'clickable' : ''}`}
                                                    style={recordedVal !== null ? { backgroundColor: HEX_COLORS.purple, color: 'white' } : {}}
                                                    onClick={() => {
                                                        if (canMark) {
                                                            this.handle_purple_click(idx);
                                                        }
                                                    }}
                                                >
                                                    {idx > 0 && <div style={{ position: 'absolute', left: '-6px', zIndex: 10, fontSize: '0.8em', color: '#a0aec0', fontWeight: 'bold' }}>&lt;</div>}
                                                    {recordedVal !== null ? (
                                                        <span className="cell-val">{recordedVal}</span>
                                                    ) : (
                                                        <span style={{ fontSize: '0.8em', color: '#cbd5e0' }}>__</span>
                                                    )}
                                                </div>
                                                {cellBonusText && (
                                                    <span className={`bonus-icon-badge ${[2, 7].includes(idx) ? 'reroll' : [3, 8].includes(idx) ? 'blue' : [4, 10].includes(idx) ? 'wild' : idx === 5 ? 'yellow' : idx === 6 ? 'fox' : idx === 9 ? 'orange' : 'green'}`} style={{ scale: '0.7' }}>
                                                        {cellBonusText}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* 5. Tracker section */}
                        <div className="trackers-section">
                            <div className="tracker-bar">
                                <div className="tracker-title">
                                    🔄 Rerolls:
                                </div>
                                <div className="tracker-slots">
                                    {Array(7).fill(null).map((_, idx) => {
                                        const isUnlocked = targetPlayerState.rerollsTotal > idx;
                                        const isUsed = targetPlayerState.rerollsUsed > idx;
                                        let slotClass = "slot-circle";
                                        if (isUsed) slotClass += " used";
                                        else if (isUnlocked) slotClass += " unlocked";

                                        return (
                                            <div key={idx} className={slotClass}>
                                                {isUnlocked && !isUsed && '⟲'}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="tracker-bar">
                                <div className="tracker-title">
                                    ➕ Extra Die (+1):
                                </div>
                                <div className="tracker-slots">
                                    {Array(7).fill(null).map((_, idx) => {
                                        const isUnlocked = targetPlayerState.extraDiceTotal > idx;
                                        const isUsed = targetPlayerState.extraDiceUsed > idx;
                                        let slotClass = "slot-circle";
                                        if (isUsed) slotClass += " used";
                                        else if (isUnlocked) slotClass += " unlocked";

                                        // Clickable to activate Extra Die!
                                        const canActivate = isViewingSelf && isUnlocked && !isUsed && !hasPendingBonus
                                            && (gameStatus === GameStatus.PassiveChoosing || gameStatus === GameStatus.TurnEnd);

                                        return (
                                            <div
                                                key={idx}
                                                className={slotClass}
                                                title={canActivate ? "Spend Extra Die Action!" : ""}
                                                style={canActivate ? { borderColor: '#3182ce', boxShadow: '0 0 6px #3182ce', cursor: 'pointer' } : {}}
                                                onClick={() => {
                                                    if (canActivate) {
                                                        // Show white die color track selection dropdown or let them click any die color!
                                                        // We can handle this by setting a state or prompting them to click a die!
                                                        // To keep it simple, let's show an overlay prompting them to pick which die to copy!
                                                        this.setState({ whiteWildTargetColor: 'extra_die' as any });
                                                    }
                                                }}
                                            >
                                                {isUnlocked && !isUsed && '+1'}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="tracker-bar">
                                <div className="tracker-title">
                                    🦊 Foxes:
                                </div>
                                <div className="tracker-slots">
                                    {Array(6).fill(null).map((_, idx) => {
                                        const isUnlocked = targetPlayerState.foxesTotal > idx;
                                        return (
                                            <div key={idx} className={`slot-circle ${isUnlocked ? 'unlocked' : ''}`} style={{ backgroundColor: isUnlocked ? '#e53e3e' : '#2d3748' }}>
                                                {isUnlocked && '🦊'}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 6. Pending Bonus Overlay (High Priority Resolution Dialog) */}
                {isViewingSelf && hasPendingBonus && (
                    this.state.bonusCardMinimized ? (
                        <div className="bonus-minimized-trigger" onClick={() => this.setState({ bonusCardMinimized: false })}>
                            <span className="pulse-dot"></span>
                            🎁 Pending Bonus (Tap to Expand)
                        </div>
                    ) : (
                        <div className={`bonus-overlay ${['yellow_X', 'blue_X'].includes(myBonuses[0].type) ? 'non-blocking' : ''}`}>
                            <div className="bonus-card">
                                <div className="bonus-card-header">
                                    <h2>Resolve Pending Bonus!</h2>
                                    {['yellow_X', 'blue_X'].includes(myBonuses[0].type) && (
                                        <button
                                            className="btn-minimize"
                                            title="Minimize instructions to see board"
                                            onClick={() => this.setState({ bonusCardMinimized: true })}
                                        >
                                            Minimize 🗗
                                        </button>
                                    )}
                                </div>
                                <p>{this.get_bonus_instructions(myId)}</p>

                                {/* Option selections for specific choice bonuses */}
                                {myBonuses[0].type === 'choice_X_6' && (
                                    <div className="bonus-options">
                                        <button
                                            className="btn-bonus-opt yellow"
                                            onClick={() => this.setState({ whiteWildTargetColor: 'round4_X' as any })}
                                        >
                                            Choose X-Bonus (Yellow, Blue, or Green)
                                        </button>
                                        <button
                                            className="btn-bonus-opt purple"
                                            onClick={() => this.setState({ whiteWildTargetColor: 'round4_6' as any })}
                                        >
                                            Choose 6-Bonus (Orange or Purple)
                                        </button>
                                    </div>
                                )}

                                {/* Automatic execution buttons for auto-place bonuses */}
                                {['green_X', 'orange_num', 'purple_num'].includes(myBonuses[0].type) && (
                                    <button
                                        className="btn-bonus-opt green"
                                        onClick={() => MP.resolvePendingBonus(0)}
                                    >
                                        Confirm Placement 👍
                                    </button>
                                )}
                            </div>
                        </div>
                    )
                )}

                {/* Round 4 specific X/6 wildcard popovers */}
                {this.state.whiteWildTargetColor === 'round4_X' && (
                    <div className="bonus-overlay">
                        <div className="bonus-card">
                            <h2>Round 4 X-Bonus choice</h2>
                            <p>Pick which color area to receive a free &quot;✕&quot; mark:</p>
                            <div className="bonus-options">
                                <button className="btn-bonus-opt yellow" onClick={() => { this.setState({ whiteWildTargetColor: null }); MP.selectRound4Option('yellow_X'); }}>Yellow X</button>
                                <button className="btn-bonus-opt blue" onClick={() => { this.setState({ whiteWildTargetColor: null }); MP.selectRound4Option('blue_X'); }}>Blue X</button>
                                <button className="btn-bonus-opt green" onClick={() => { this.setState({ whiteWildTargetColor: null }); MP.selectRound4Option('green_X'); }}>Green X</button>
                                <button className="btn-bonus-opt" style={{ backgroundColor: '#718096', color: 'white', marginTop: '10px' }} onClick={() => this.setState({ whiteWildTargetColor: null })}>Back</button>
                            </div>
                        </div>
                    </div>
                )}

                {this.state.whiteWildTargetColor === 'round4_6' && (
                    <div className="bonus-overlay">
                        <div className="bonus-card">
                            <h2>Round 4 6-Bonus choice</h2>
                            <p>Pick which color area to receive a free &quot;6&quot; number:</p>
                            <div className="bonus-options">
                                <button className="btn-bonus-opt orange" onClick={() => { this.setState({ whiteWildTargetColor: null }); MP.selectRound4Option('orange_num'); }}>Orange 6</button>
                                <button className="btn-bonus-opt purple" onClick={() => { this.setState({ whiteWildTargetColor: null }); MP.selectRound4Option('purple_num'); }}>Purple 6</button>
                                <button className="btn-bonus-opt" style={{ backgroundColor: '#718096', color: 'white', marginTop: '10px' }} onClick={() => this.setState({ whiteWildTargetColor: null })}>Back</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Extra Die copying color selection popover */}
                {this.state.whiteWildTargetColor === 'extra_die' && (
                    <div className="bonus-overlay">
                        <div className="bonus-card">
                            <h2>Choose Die to copy (+1)</h2>
                            <p>Select which die color in play you want to copy and record:</p>
                            <div className="bonus-options">
                                {['white', 'yellow', 'blue', 'green', 'orange', 'purple'].map(color => {
                                    // Verify color hasn't already been spent this turn
                                    const isActive = playerId => playerId === myId;
                                    const extraDiceSpentColors = myId === currentPlayerId
                                        ? extraDicePickedThisTurn
                                        : extraDicePickedThisTurn.slice(1);

                                    const isSpent = extraDiceSpentColors.includes(color as DieColor);

                                    return (
                                        <button
                                            key={color}
                                            className={`btn-bonus-opt ${color}`}
                                            disabled={isSpent}
                                            style={isSpent ? { opacity: 0.4, cursor: 'not-allowed', textDecoration: 'line-through' } : {}}
                                            onClick={() => {
                                                const colorVal = color as DieColor;
                                                this.setState({ whiteWildTargetColor: null });
                                                if (colorVal === 'white') {
                                                    // Prompt which track
                                                    this.setState({ whiteWildTargetColor: 'extra_die_white_wild' as any });
                                                } else if (colorVal === 'yellow') {
                                                    this.setState({ pendingExtraYellowColor: 'yellow' });
                                                } else {
                                                    MP.spendExtraDie(colorVal);
                                                }
                                            }}
                                        >
                                            Copy {color} die {isSpent && '(Spent)'}
                                        </button>
                                    );
                                })}
                                <button
                                    className="btn-bonus-opt"
                                    style={{ backgroundColor: '#718096', color: 'white', marginTop: '10px' }}
                                    onClick={() => this.setState({ whiteWildTargetColor: null })}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {this.state.whiteWildTargetColor === 'extra_die_white_wild' && (
                    <div className="bonus-overlay">
                        <div className="bonus-card">
                            <h2>Select Track for White Wild (+1)</h2>
                            <p>Choose which color area to apply the copied White wild die to:</p>
                            <div className="bonus-options">
                                {['yellow', 'blue', 'green', 'orange', 'purple'].map(color => (
                                    <button
                                        key={color}
                                        className={`btn-bonus-opt ${color}`}
                                        onClick={() => {
                                            const colorVal = color as DieColor;
                                            this.setState({ whiteWildTargetColor: null });
                                            if (colorVal === 'yellow') {
                                                this.setState({ pendingExtraYellowColor: 'white' });
                                            } else {
                                                MP.spendExtraDie('white', colorVal);
                                            }
                                        }}
                                    >
                                        Mark in {color} Area
                                    </button>
                                ))}
                                <button
                                    className="btn-bonus-opt"
                                    style={{ backgroundColor: '#718096', color: 'white', marginTop: '10px' }}
                                    onClick={() => this.setState({ whiteWildTargetColor: null })}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 7. Logs section */}
                <div className="logs-section">
                    <h3>Game Activity</h3>
                    <div className="logs-scroller">
                        {gameLogs.map((log, index) => (
                            <div key={index} className="log-line">
                                {formatLogLine(log)}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // --- Interactive click validation helpers ---

    private is_yellow_cell_clickable(myId: string, r: number, c: number, cellVal: number | null): boolean {
        if (cellVal === null) return false; // premarked
        const { bonusesToResolve, rolledDice, gameStatus, currentPlayerId } = this.props;

        const isViewingSelf = this.state.viewingPlayerId === myId;
        if (!isViewingSelf) return false;

        const playerState = this.props.players[myId];

        // 1. Uniqueness check: cannot choose the same number twice for yellow
        const grid = [
            [3, 6, 5, null],
            [2, 1, null, 5],
            [1, null, 2, 4],
            [null, 3, 4, 6]
        ];
        let alreadyMarkedCount = 0;
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                if (grid[row][col] === cellVal && playerState.yellow[row][col]) {
                    alreadyMarkedCount++;
                }
            }
        }
        if (alreadyMarkedCount > 0) {
            return false;
        }

        // 2. Cell must not be already marked
        if (playerState.yellow[r][c]) return false;

        // 3. Check pending yellow selection states
        const { pendingActiveYellowColor, pendingPassiveYellowColor, pendingExtraYellowColor } = this.state;
        if (pendingActiveYellowColor || pendingPassiveYellowColor || pendingExtraYellowColor) {
            const requiredVal = this.get_pending_yellow_die_value();
            return cellVal === requiredVal;
        }

        // 4. Overlay pending bonus: Yellow X
        const currentBonus = bonusesToResolve && bonusesToResolve.length > 0 ? bonusesToResolve[0] : null;
        if (currentBonus && currentBonus.type === 'yellow_X') {
            return true;
        }

        // 5. Standard active choose
        if (gameStatus === GameStatus.ActiveChoosing && myId === currentPlayerId && !currentBonus) {
            // Did we roll a yellow die or white die matching cellVal?
            const hasYellow = rolledDice.some(d => d.color === 'yellow' && d.value === cellVal);
            const hasWhite = rolledDice.some(d => d.color === 'white'); // White can copy yellow
            return hasYellow || hasWhite;
        }

        return false;
    }

    private get_pending_yellow_die_value(): number {
        const { rolledDice, trayDice, activePickedDice, poolDice } = this.props;
        const { pendingActiveYellowColor, pendingPassiveYellowColor, pendingExtraYellowColor } = this.state;

        const sourceColor = pendingActiveYellowColor || pendingPassiveYellowColor || pendingExtraYellowColor;
        if (!sourceColor) return 0;

        if (pendingActiveYellowColor) {
            const die = rolledDice.find(d => d.color === pendingActiveYellowColor);
            return die ? die.value : 0;
        }

        if (pendingPassiveYellowColor) {
            const die = trayDice.find(d => d.color === pendingPassiveYellowColor)
                || activePickedDice.find(d => d.color === pendingPassiveYellowColor);
            return die ? die.value : 0;
        }

        if (pendingExtraYellowColor) {
            const die = trayDice.find(d => d.color === pendingExtraYellowColor)
                || activePickedDice.find(d => d.color === pendingExtraYellowColor)
                || rolledDice.find(d => d.color === pendingExtraYellowColor)
                || poolDice.find(d => d.color === pendingExtraYellowColor);
            return die ? die.value : 0;
        }

        return 0;
    }

    private handle_yellow_click(r: number, c: number, cellVal: number) {
        const { bonusesToResolve, rolledDice, MP } = this.props;
        const currentBonus = bonusesToResolve && bonusesToResolve.length > 0 ? bonusesToResolve[0] : null;
        const { pendingActiveYellowColor, pendingPassiveYellowColor, pendingExtraYellowColor } = this.state;

        // 1. If we are in a pending selection state
        if (pendingActiveYellowColor) {
            const color = pendingActiveYellowColor;
            this.setState({ pendingActiveYellowColor: null });
            if (color === 'white') {
                MP.pickActiveDie('white', { targetColor: 'yellow', r, c });
            } else {
                MP.pickActiveDie('yellow', { r, c });
            }
            return;
        }

        if (pendingPassiveYellowColor) {
            const color = pendingPassiveYellowColor;
            this.setState({ pendingPassiveYellowColor: null });
            if (color === 'white') {
                MP.pickPassiveDie('white', { targetColor: 'yellow', r, c });
            } else {
                MP.pickPassiveDie('yellow', { r, c });
            }
            return;
        }

        if (pendingExtraYellowColor) {
            const color = pendingExtraYellowColor;
            this.setState({ pendingExtraYellowColor: null });
            if (color === 'white') {
                MP.spendExtraDie('white', { targetColor: 'yellow', r, c });
            } else {
                MP.spendExtraDie('yellow', { r, c });
            }
            return;
        }

        // 2. If it is a Yellow X bonus
        if (currentBonus && currentBonus.type === 'yellow_X') {
            MP.resolvePendingBonus(r, c);
            return;
        }

        // 3. Standard active choose click (if clicked directly on sheet instead of die)
        const hasYellow = rolledDice.some(d => d.color === 'yellow' && d.value === cellVal);
        if (hasYellow) {
            MP.pickActiveDie('yellow', { r, c });
        } else {
            // Must be White
            MP.pickActiveDie('white', { targetColor: 'yellow', r, c });
        }
    }

    private render_blue_cell(myId: string, sum: number) {
        const targetPlayerState = this.props.players[this.state.viewingPlayerId];
        if (!targetPlayerState) return null;

        const sumIndex = sum - 2;
        const isMarked = targetPlayerState.blue[sumIndex];

        // Clickable checks
        const canMark = this.is_blue_cell_clickable(myId, sumIndex, sum);

        return (
            <div
                key={sum}
                className={`blue-cell ${isMarked ? 'marked' : ''} ${canMark ? 'clickable' : ''}`}
                onClick={() => {
                    if (canMark) {
                        this.handle_blue_click(sumIndex, sum);
                    }
                }}
            >
                {sum}
            </div>
        );
    }

    private is_blue_cell_clickable(myId: string, sumIndex: number, sum: number): boolean {
        const { bonusesToResolve, rolledDice, gameStatus, currentPlayerId } = this.props;

        const isViewingSelf = this.state.viewingPlayerId === myId;
        if (!isViewingSelf) return false;

        // Check if marked
        const playerState = this.props.players[myId];
        if (playerState.blue[sumIndex]) return false;

        // Overlay pending bonus: Blue X
        const currentBonus = bonusesToResolve && bonusesToResolve.length > 0 ? bonusesToResolve[0] : null;
        if (currentBonus && currentBonus.type === 'blue_X') {
            return true;
        }

        // Standard active choose
        if (gameStatus === GameStatus.ActiveChoosing && myId === currentPlayerId && !currentBonus) {
            // Coupling sum of Blue + White must match sum!
            const blueDie = rolledDice.find(d => d.color === 'blue');
            const whiteDie = rolledDice.find(d => d.color === 'white');

            if (!blueDie && !whiteDie) return false;

            const blueVal = blueDie ? blueDie.value : 1; // fallback
            const whiteVal = whiteDie ? whiteDie.value : 1; // fallback

            const sumPair = blueVal + whiteVal;
            if (sumPair !== sum) return false;

            // They can pick either Blue or White to trigger it
            return rolledDice.some(d => d.color === 'blue' || d.color === 'white');
        }

        return false;
    }

    private handle_blue_click(sumIndex: number, sum: number) {
        const { bonusesToResolve, rolledDice, MP } = this.props;
        const currentBonus = bonusesToResolve && bonusesToResolve.length > 0 ? bonusesToResolve[0] : null;

        if (currentBonus && currentBonus.type === 'blue_X') {
            MP.resolvePendingBonus(sumIndex);
        } else {
            // Find which color to pick: Blue or White
            const hasBlue = rolledDice.some(d => d.color === 'blue');
            if (hasBlue) {
                MP.pickActiveDie('blue');
            } else {
                MP.pickActiveDie('white', 'blue');
            }
        }
    }

    private is_green_cell_clickable(myId: string, cellIndex: number): boolean {
        const { bonusesToResolve, rolledDice, gameStatus, currentPlayerId } = this.props;

        const isViewingSelf = this.state.viewingPlayerId === myId;
        if (!isViewingSelf) return false;

        const playerState = this.props.players[myId];
        if (playerState.green !== cellIndex) return false; // must fill left-to-right

        // Pending overlay
        const currentBonus = bonusesToResolve && bonusesToResolve.length > 0 ? bonusesToResolve[0] : null;
        if (currentBonus && currentBonus.type === 'green_X') {
            return true;
        }

        // Standard active choose
        if (gameStatus === GameStatus.ActiveChoosing && myId === currentPlayerId && !currentBonus) {
            const minRequired = GREEN_MINIMUMS[cellIndex];
            const hasGreen = rolledDice.some(d => d.color === 'green' && d.value >= minRequired);
            const hasWhite = rolledDice.some(d => d.color === 'white' && d.value >= minRequired);

            return hasGreen || hasWhite;
        }

        return false;
    }

    private handle_green_click() {
        const { bonusesToResolve, rolledDice, MP } = this.props;
        const currentBonus = bonusesToResolve && bonusesToResolve.length > 0 ? bonusesToResolve[0] : null;

        if (currentBonus && currentBonus.type === 'green_X') {
            MP.resolvePendingBonus(0); // auto placement
        } else {
            const greenIndex = this.props.players[this.props.MP.clientId].green;
            const minRequired = GREEN_MINIMUMS[greenIndex];

            const hasGreen = rolledDice.some(d => d.color === 'green' && d.value >= minRequired);
            if (hasGreen) {
                MP.pickActiveDie('green');
            } else {
                MP.pickActiveDie('white', 'green');
            }
        }
    }

    private is_orange_cell_clickable(myId: string, cellIndex: number): boolean {
        const { bonusesToResolve, rolledDice, gameStatus, currentPlayerId } = this.props;

        const isViewingSelf = this.state.viewingPlayerId === myId;
        if (!isViewingSelf) return false;

        const playerState = this.props.players[myId];
        const nextOrangeIndex = playerState.orange.indexOf(null);
        if (nextOrangeIndex !== cellIndex) return false; // must fill left-to-right

        // Pending overlay
        const currentBonus = bonusesToResolve && bonusesToResolve.length > 0 ? bonusesToResolve[0] : null;
        if (currentBonus && currentBonus.type === 'orange_num') {
            return true;
        }

        // Standard active choose
        if (gameStatus === GameStatus.ActiveChoosing && myId === currentPlayerId && !currentBonus) {
            return rolledDice.some(d => d.color === 'orange' || d.color === 'white');
        }

        return false;
    }

    private handle_orange_click(cellIndex: number) {
        const { bonusesToResolve, rolledDice, MP } = this.props;
        const currentBonus = bonusesToResolve && bonusesToResolve.length > 0 ? bonusesToResolve[0] : null;

        if (currentBonus && currentBonus.type === 'orange_num') {
            MP.resolvePendingBonus(cellIndex); // auto places predetermined bonus value
        } else {
            const hasOrange = rolledDice.some(d => d.color === 'orange');
            if (hasOrange) {
                MP.pickActiveDie('orange');
            } else {
                MP.pickActiveDie('white', 'orange');
            }
        }
    }

    private is_purple_cell_clickable(myId: string, cellIndex: number): boolean {
        const { bonusesToResolve, rolledDice, gameStatus, currentPlayerId } = this.props;

        const isViewingSelf = this.state.viewingPlayerId === myId;
        if (!isViewingSelf) return false;

        const playerState = this.props.players[myId];
        const nextPurpleIndex = playerState.purple.indexOf(null);
        if (nextPurpleIndex !== cellIndex) return false; // must fill left-to-right

        // Pending overlay
        const currentBonus = bonusesToResolve && bonusesToResolve.length > 0 ? bonusesToResolve[0] : null;
        if (currentBonus && currentBonus.type === 'purple_num') {
            return true;
        }

        // Standard active choose
        if (gameStatus === GameStatus.ActiveChoosing && myId === currentPlayerId && !currentBonus) {
            const lastVal = cellIndex > 0 ? playerState.purple[cellIndex - 1]! : 0;
            const checkVal = lastVal === 6 ? 0 : lastVal; // 6 resets

            const hasPurple = rolledDice.some(d => d.color === 'purple' && d.value > checkVal);
            const hasWhite = rolledDice.some(d => d.color === 'white' && d.value > checkVal);

            return hasPurple || hasWhite;
        }

        return false;
    }

    private handle_purple_click(cellIndex: number) {
        const { bonusesToResolve, rolledDice, MP } = this.props;
        const currentBonus = bonusesToResolve && bonusesToResolve.length > 0 ? bonusesToResolve[0] : null;

        if (currentBonus && currentBonus.type === 'purple_num') {
            MP.resolvePendingBonus(cellIndex); // auto places purple predetermined bonus value
        } else {
            const playerState = this.props.players[this.props.MP.clientId];
            const lastVal = cellIndex > 0 ? playerState.purple[cellIndex - 1]! : 0;
            const checkVal = lastVal === 6 ? 0 : lastVal;

            const hasPurple = rolledDice.some(d => d.color === 'purple' && d.value > checkVal);
            if (hasPurple) {
                MP.pickActiveDie('purple');
            } else {
                MP.pickActiveDie('white', 'purple');
            }
        }
    }

    private get_bonus_instructions(myId: string): string {
        const bonus = this.props.bonusesToResolve[0];
        if (!bonus) return '';

        switch (bonus.type) {
            case 'yellow_X':
                return 'Mark one box in the Yellow Grid of your choice (tap a cell in the Yellow section above).';
            case 'blue_X':
                return 'Mark one coupled sum in the Blue Grid of your choice (tap a sum value in the Blue section above).';
            case 'green_X':
                return 'Free Green X-Bonus! Next sequential cell in your Green row will be crossed off.';
            case 'orange_num':
                return `Free Orange Bonus! A value of ${bonus.value} will be automatically written in the next cell of your Orange row.`;
            case 'purple_num':
                return `Free Purple Bonus! A value of ${bonus.value} will be automatically written in the next cell of your Purple row.`;
            case 'choice_X_6':
                return 'Round 4 choice bonus! You must choose one of the options below:';
            default:
                return 'Select a cell on your sheet to apply your bonus.';
        }
    }

    private calculate_live_score(playerId: string): number {
        // Instantiate temporary class or extract calculations directly to display live score
        const player = this.props.players[playerId];
        if (!player) return 0;

        // Yellow: completed columns
        const colPoints = [10, 14, 16, 20];
        let yellowScore = 0;
        for (let col = 0; col < 4; col++) {
            let colCompleted = true;
            for (let row = 0; row < 4; row++) {
                if (!player.yellow[row][col]) {
                    colCompleted = false;
                    break;
                }
            }
            if (colCompleted) {
                yellowScore += colPoints[col];
            }
        }

        // Blue count
        const blueCount = player.blue.filter(x => x).length;
        const blueScore = blueCount > 0 ? BLUE_POINTS[blueCount - 1] : 0;

        // Green progressive star
        const greenScore = player.green > 0 ? GREEN_POINTS[player.green - 1] : 0;

        // Orange sum
        let orangeScore = 0;
        player.orange.forEach(val => {
            if (val !== null) orangeScore += val;
        });

        // Purple sum
        let purpleScore = 0;
        player.purple.forEach(val => {
            if (val !== null) purpleScore += val;
        });

        // Fox score
        const scores = [yellowScore, blueScore, greenScore, orangeScore, purpleScore];
        const minScore = Math.min(...scores);
        const foxScore = minScore * player.foxesTotal;

        return yellowScore + blueScore + greenScore + orangeScore + purpleScore + foxScore;
    }
}

// Final Leaderboard screen
class CleverGameOverScreen extends React.Component<CleverMainViewProps, {}> {
    render() {
        const { MP, players, playerIds, isHost } = this.props;

        // Calculate scores for all players
        const playerScores = playerIds.map(id => {
            const pState = players[id];
            // Yellow columns
            const colPoints = [10, 14, 16, 20];
            let yellowScore = 0;
            for (let col = 0; col < 4; col++) {
                let colCompleted = true;
                for (let row = 0; row < 4; row++) {
                    if (!pState.yellow[row][col]) {
                        colCompleted = false;
                        break;
                    }
                }
                if (colCompleted) yellowScore += colPoints[col];
            }

            // Blue sum count
            const blueCount = pState.blue.filter(x => x).length;
            const blueScore = blueCount > 0 ? BLUE_POINTS[blueCount - 1] : 0;

            // Green progressive
            const greenScore = pState.green > 0 ? GREEN_POINTS[pState.green - 1] : 0;

            // Orange sum
            let orangeScore = 0;
            pState.orange.forEach(val => {
                if (val !== null) orangeScore += val;
            });

            // Purple sum
            let purpleScore = 0;
            pState.purple.forEach(val => {
                if (val !== null) purpleScore += val;
            });

            // Fox score
            const minScore = Math.min(yellowScore, blueScore, greenScore, orangeScore, purpleScore);
            const foxScore = minScore * pState.foxesTotal;

            const total = yellowScore + blueScore + greenScore + orangeScore + purpleScore + foxScore;

            // Tie breaker value: highest individual color area score
            const highestIndividualAreaScore = Math.max(yellowScore, blueScore, greenScore, orangeScore, purpleScore);

            return {
                id,
                yellow: yellowScore,
                blue: blueScore,
                green: greenScore,
                orange: orangeScore,
                purple: purpleScore,
                foxes: foxScore,
                foxesCount: pState.foxesTotal,
                foxMinScore: minScore,
                totalScore: total,
                tiebreaker: highestIndividualAreaScore
            };
        });

        // Sort: totalScore descending, then tiebreaker descending
        playerScores.sort((a, b) => {
            if (b.totalScore !== a.totalScore) {
                return b.totalScore - a.totalScore;
            }
            return b.tiebreaker - a.tiebreaker;
        });

        const winningScore = playerScores[0]?.totalScore;

        return (
            <div className="clever-gameover-container">
                <h2 style={{ fontSize: '2em', fontWeight: 800 }}>Clever Leaderboard</h2>

                <div className="leaderboard-list">
                    {playerScores.map((scoreCard, index) => {
                        const isWinner = scoreCard.totalScore === winningScore;
                        let rankClass = "rank-item";
                        if (index === 0) rankClass += " rank-first";

                        return (
                            <div key={scoreCard.id} className={rankClass}>
                                <div className="rank-left">
                                    <span className="rank-num">#{index + 1}</span>
                                    <span className="rank-player-tag" style={{ fontSize: '1.2em', fontWeight: 800 }}>
                                        {MP.getPluginView('lobby', 'player-tag', { clientId: scoreCard.id })}
                                        {isWinner && <span style={{ color: '#f1c40f', marginLeft: '6px' }}>👑 Winner!</span>}
                                    </span>
                                </div>

                                <div className="rank-breakdown">
                                    <div className="breakdown-details" style={{ textAlign: 'right' }}>
                                        💛 {scoreCard.yellow} + 💙 {scoreCard.blue} + 💚 {scoreCard.green} + 🧡 {scoreCard.orange} + 💜 {scoreCard.purple} + 🦊 ({scoreCard.foxesCount}✕{scoreCard.foxMinScore}) {scoreCard.foxes}
                                    </div>
                                    <div className="rank-score-val" style={{ fontSize: '2em' }}>
                                        {scoreCard.totalScore} pts
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {isHost ? (
                    <div style={{ marginTop: '20px' }}>
                        <button
                            className="btn-start-game"
                            style={{ margin: 0 }}
                            onClick={() => MP.restartGame()}
                        >
                            🔄 Start New Game
                        </button>
                    </div>
                ) : (
                    <div style={{ color: '#a0aec0', fontSize: '1.1em', marginTop: '20px', fontWeight: 'bold' }}>
                        Waiting for Host to start a new game...
                    </div>
                )}
            </div>
        );
    }
}

export class CleverMainPage extends React.Component<CleverMainViewProps, {}> {
    public render() {
        const mp = this.props.MP;
        const myId = mp.clientId;
        const playerState = this.props.players[myId];

        // Determine icon tag for tab
        let scoreText = '0';
        if (playerState) {
            // Live score calculation
            const colPoints = [10, 14, 16, 20];
            let yellowScore = 0;
            for (let col = 0; col < 4; col++) {
                let colCompleted = true;
                for (let row = 0; row < 4; row++) {
                    if (!playerState.yellow[row][col]) {
                        colCompleted = false;
                        break;
                    }
                }
                if (colCompleted) yellowScore += colPoints[col];
            }

            const blueCount = playerState.blue.filter(x => x).length;
            const blueScore = blueCount > 0 ? BLUE_POINTS[blueCount - 1] : 0;
            const greenScore = playerState.green > 0 ? GREEN_POINTS[playerState.green - 1] : 0;

            let orangeScore = 0;
            playerState.orange.forEach(val => {
                if (val !== null) orangeScore += val;
            });

            let purpleScore = 0;
            playerState.purple.forEach(val => {
                if (val !== null) purpleScore += val;
            });

            const minScore = Math.min(yellowScore, blueScore, greenScore, orangeScore, purpleScore);
            const foxScore = minScore * playerState.foxesTotal;
            scoreText = (yellowScore + blueScore + greenScore + orangeScore + purpleScore + foxScore).toString();
        }

        const links = {
            'home': {
                'icon': 'gamepad',
                'label': 'Clever',
                'view': MainPage(this.props)
            },
            'rules': {
                'icon': 'book',
                'label': 'Rules',
                'view': <CleverGameRules />
            }
        };

        if (this.props.isHost) {
            links['settings'] = {
                'icon': 'cogs',
                'label': 'Settings',
                'view': (
                    <div style={{ padding: '24px', maxWidth: '400px', margin: '0 auto' }}>
                        <button
                            className="btn-roll"
                            style={{
                                background: '#e53e3e',
                                color: 'white',
                                width: '100%',
                                padding: '15px',
                                fontSize: '1.2em',
                                marginBottom: '15px'
                            }}
                            onClick={() => this.props.MP.restartGame()}
                        >
                            Restart Game
                        </button>
                        <button
                            className="btn-roll"
                            style={{
                                background: '#718096',
                                color: 'white',
                                width: '100%',
                                padding: '15px',
                                fontSize: '1.2em'
                            }}
                            onClick={() => this.props.MP.backToLobby()}
                        >
                            Back to Lobby
                        </button>
                    </div>
                )
            };
        }

        return mp.getPluginView(
            'gameshell',
            'HostShell-Main',
            {
                'links': links,
                'gameName': '',
                'topBarContent': this.props.gameStatus === GameStatus.GameOver
                    ? '🏆'
                    : `⭐x${scoreText}`
            });
    }
}
